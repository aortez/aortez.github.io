#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import { chromium } from '@playwright/test';

const DEFAULT_SIZES = [10000, 25000, 50000, 100000];
const RENDERER_BACKENDS = ['canvas2d', 'webgl2'];

function parseInteger(value, option, minimum = 1) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${option} requires an integer >= ${minimum}`);
  }
  return parsed;
}

function parseSizes(value, option) {
  const sizes = value
    .split(',')
    .filter(Boolean)
    .map(item => parseInteger(item.trim(), option));
  if (sizes.length === 0) {
    throw new Error(`${option} requires at least one size`);
  }
  return [...new Set(sizes)].sort((left, right) => left - right);
}

function optionValue(argumentsList, index, option) {
  const value = argumentsList[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function parseArguments(argumentsList) {
  const options = {
    renderers: RENDERER_BACKENDS,
    sizes: DEFAULT_SIZES,
    samples: 30,
    warmup: 10,
    width: 1536,
    height: 1024,
    churn: false,
    softwareWebgl: false,
    json: false,
  };

  for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index];
    switch (argument) {
      case '--renderer': {
        const renderer = optionValue(argumentsList, index, argument);
        if (renderer === 'both') {
          options.renderers = RENDERER_BACKENDS;
        } else if (RENDERER_BACKENDS.includes(renderer)) {
          options.renderers = [renderer];
        } else {
          throw new Error(
            `${argument} requires one of: canvas2d, webgl2, both`,
          );
        }
        index++;
        break;
      }
      case '--sizes':
        options.sizes = parseSizes(
          optionValue(argumentsList, index, argument),
          argument,
        );
        index++;
        break;
      case '--samples':
        options.samples = parseInteger(
          optionValue(argumentsList, index, argument),
          argument,
          3,
        );
        index++;
        break;
      case '--warmup':
        options.warmup = parseInteger(
          optionValue(argumentsList, index, argument),
          argument,
          0,
        );
        index++;
        break;
      case '--width':
        options.width = parseInteger(
          optionValue(argumentsList, index, argument),
          argument,
        );
        index++;
        break;
      case '--height':
        options.height = parseInteger(
          optionValue(argumentsList, index, argument),
          argument,
        );
        index++;
        break;
      case '--churn':
        options.churn = true;
        break;
      case '--software-webgl':
        options.softwareWebgl = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--help':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option "${argument}"`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: npm run bench:render -- [options]

Options:
  --renderer NAME     canvas2d, webgl2, or both (default: both).
  --sizes LIST        Comma-separated visible body counts.
  --samples NUMBER    Recorded frames per case (default: 30).
  --warmup NUMBER     Warmup frames per case (default: 10).
  --width NUMBER      Canvas width (default: 1536).
  --height NUMBER     Canvas height (default: 1024).
  --churn              Mutate 75% of bodies before every render.
  --software-webgl    Force SwiftShader when hardware WebGL is unavailable.
  --json              Emit structured JSON only.
  --help              Show this help.

The benchmark renders a frozen synthetic world without running physics or the
production animation loop. Submission time measures main-thread renderer work.
For WebGL2, synchronized time also includes an explicit gl.finish() wait.
Canvas2D synchronization remains browser-managed and is reported as zero.`);
}

function safeGit(argumentsList, fallback = 'unknown') {
  try {
    return execFileSync('git', argumentsList, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return fallback;
  }
}

async function availablePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(error => {
        if (error) {
          reject(error);
        } else {
          resolve(address.port);
        }
      });
    });
  });
}

async function waitForServer(url, server) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (${server.exitCode})`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Vite is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopServer(server) {
  if (server.exitCode !== null) {
    return;
  }
  server.kill('SIGTERM');
  const exited = new Promise(resolve => server.once('exit', resolve));
  await Promise.race([exited, delay(3000)]);
  if (server.exitCode === null) {
    server.kill('SIGKILL');
  }
}

function percentile(sortedValues, quantile) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * quantile) - 1),
  );
  return sortedValues[index];
}

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    meanMs: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    minMs: sorted[0],
    maxMs: sorted.at(-1),
  };
}

function formatTiming(summary) {
  return `${summary.medianMs.toFixed(2)}/${summary.p95Ms.toFixed(2)}`;
}

async function configureCase(
  page,
  rendererBackend,
  bodyCount,
  width,
  height,
) {
  return await page.evaluate(async ({
    backend,
    count,
    canvasWidth,
    canvasHeight,
  }) => {
    const [
      { Ball },
      { createSeededRandom },
      { createRenderer },
      { vec3 },
      { World },
    ] = await Promise.all([
      import('/src/scripts/ball.js'),
      import('/benchmarks/scenarios.js'),
      import('/src/scripts/renderers/renderer-factory.js'),
      import('/src/scripts/vec3.js'),
      import('/src/scripts/world.js'),
    ]);

    const canvas = document.getElementById('benchmark_canvas');
    const selection = createRenderer(canvas, backend);
    if (selection.fallbackReason) {
      throw new Error(
        `Renderer fallback prevented this benchmark: ` +
        selection.fallbackReason,
      );
    }
    const renderer = selection.renderer;
    renderer.resize(canvasWidth, canvasHeight);
    if (
      renderer.backend === 'webgl2' &&
      renderer.context.isContextLost()
    ) {
      throw new Error(
        'The WebGL2 context was lost; use --software-webgl in a ' +
        'headless environment without GPU access',
      );
    }

    const world = new World();
    world.init();
    world.shouldDrawBackground = false;
    const scale = world.getDrawScale(canvas);
    const maxX = canvas.width / scale;
    const maxY = canvas.height / scale;
    const random = createSeededRandom(0xA11CE ^ count);
    const particleCount = Math.floor(count * 0.4);
    const ballCount = count - particleCount;
    const baseRadius = Math.max(0.0002, 0.08 / Math.sqrt(count));

    const makeBody = (index, particle) => {
      let radius = baseRadius * (0.5 + random());
      if (index % 1000 === 0) {
        radius = 0.012 + random() * 0.03;
      } else if (index % 20 === 0) {
        radius = 0.002 + random() * 0.006;
      }
      if (particle) {
        radius *= 0.35;
      }
      radius = Math.min(radius, maxX / 2, maxY / 2);
      const body = new Ball(
        radius + random() * Math.max(0, maxX - 2 * radius),
        radius + random() * Math.max(0, maxY - 2 * radius),
        radius,
        new vec3(
          Math.floor(random() * 256),
          Math.floor(random() * 256),
          Math.floor(random() * 256),
        ),
      );
      body.is_invincible = true;
      body.is_moving = false;
      return body;
    };

    world.particles = Array.from(
      { length: particleCount },
      (_, index) => makeBody(index, true),
    );
    world.balls = Array.from(
      { length: ballCount },
      (_, index) => makeBody(index + particleCount, false),
    );

    globalThis.__renderBenchmark = {
      canvas,
      maxX,
      maxY,
      random,
      renderer,
      world,
    };
    return {
      backend: renderer.backend,
      ballCount,
      canvasHeight: canvas.height,
      canvasWidth: canvas.width,
      graphicsInfo: renderer.graphicsInfo,
      particleCount,
    };
  }, {
    backend: rendererBackend,
    count: bodyCount,
    canvasWidth: width,
    canvasHeight: height,
  });
}

async function collectFrames(page, warmup, samples, churn) {
  return await page.evaluate(async ({
    warmupFrames,
    recordedFrames,
    churnEnabled,
  }) => {
    const state = globalThis.__renderBenchmark;
    const bodies = [
      ...state.world.particles,
      ...state.world.balls,
    ];
    const mutateBodies = () => {
      if (!churnEnabled) {
        return;
      }
      const changedCount = Math.floor(bodies.length * 0.75);
      for (let index = 0; index < changedCount; index++) {
        const body = bodies[index];
        body.center.x = body.r + state.random() * Math.max(
          0,
          state.maxX - 2 * body.r,
        );
        body.center.y = body.r + state.random() * Math.max(
          0,
          state.maxY - 2 * body.r,
        );
        body.color.set(
          Math.floor(state.random() * 256),
          Math.floor(state.random() * 256),
          Math.floor(state.random() * 256),
        );
      }
    };

    const results = [];
    const totalFrames = warmupFrames + recordedFrames;
    for (let frame = 0; frame < totalFrames; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      mutateBodies();
      const submissionStart = performance.now();
      const renderStats = state.renderer.render(state.world);
      const submissionMs = performance.now() - submissionStart;
      const synchronizeMs = state.renderer.synchronize();
      if (frame >= warmupFrames) {
        results.push({
          submissionMs,
          synchronizeMs,
          synchronizedMs: submissionMs + synchronizeMs,
          packMs: renderStats.packMs ?? 0,
          uploadMs: renderStats.uploadMs ?? 0,
          submitMs: renderStats.submitMs ?? renderStats.totalMs,
          attemptedBodies: renderStats.attemptedBodies,
          drawnBodies: renderStats.drawnBodies,
          culledBodies: renderStats.culledBodies,
          pixelBodies: renderStats.pixelBodies,
          outlinedBodies: renderStats.outlinedBodies,
          bufferCapacity: renderStats.bufferCapacity ?? null,
          cpuBufferBytes: renderStats.cpuBufferBytes ?? null,
          gpuBufferBytes: renderStats.gpuBufferBytes ?? null,
        });
      }
    }
    return results;
  }, {
    warmupFrames: warmup,
    recordedFrames: samples,
    churnEnabled: churn,
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const vitePath = new URL('../node_modules/vite/bin/vite.js', import.meta.url);
  const server = spawn(
    process.execPath,
    [
      vitePath.pathname,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
      '--mode',
      'headless',
    ],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );

  let serverErrors = '';
  server.stderr.on('data', chunk => {
    serverErrors += chunk.toString();
  });

  let browser;
  try {
    await waitForServer(
      `${baseUrl}/benchmarks/render-benchmark.html`,
      server,
    );
    const launchArguments = options.softwareWebgl
      ? [
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
      ]
      : [];
    browser = await chromium.launch({
      args: launchArguments,
      headless: true,
    });
    const context = await browser.newContext({
      viewport: {
        width: options.width,
        height: options.height,
      },
    });
    const page = await context.newPage();
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        browserErrors.push(message.text());
      }
    });

    const results = [];
    for (const rendererBackend of options.renderers) {
      for (const bodyCount of options.sizes) {
        await page.goto(`${baseUrl}/benchmarks/render-benchmark.html`);
        const caseInfo = await configureCase(
          page,
          rendererBackend,
          bodyCount,
          options.width,
          options.height,
        );
        const frames = await collectFrames(
          page,
          options.warmup,
          options.samples,
          options.churn,
        );
        results.push({
          renderer: rendererBackend,
          bodies: bodyCount,
          mode: options.churn ? 'churn' : 'static',
          caseInfo,
          submission: summarize(frames.map(frame => frame.submissionMs)),
          synchronized: summarize(frames.map(frame => frame.synchronizedMs)),
          synchronize: summarize(frames.map(frame => frame.synchronizeMs)),
          pack: summarize(frames.map(frame => frame.packMs)),
          upload: summarize(frames.map(frame => frame.uploadMs)),
          submit: summarize(frames.map(frame => frame.submitMs)),
          lastFrame: frames.at(-1),
        });
      }
    }

    if (browserErrors.length > 0) {
      throw new Error(`Browser errors:\n${browserErrors.join('\n')}`);
    }

    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        commit: safeGit(['rev-parse', 'HEAD']),
        branch: safeGit(['branch', '--show-current']),
        dirty: safeGit(['status', '--porcelain'], '').length > 0,
        node: process.version,
        browser: await browser.version(),
        cpu: os.cpus()[0]?.model ?? 'unknown',
        logicalCpuCount: os.cpus().length,
        options,
      },
      results,
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('Render-only browser benchmark');
      console.log(
        `Commit: ${report.metadata.commit}` +
        `${report.metadata.dirty ? ' (dirty)' : ''}`,
      );
      console.log(`Browser: ${report.metadata.browser}`);
      console.log(`CPU: ${report.metadata.cpu}`);
      console.log('Times are median/p95 milliseconds.');
      console.log(
        'Submission is main-thread renderer work; synchronized additionally ' +
        'waits for WebGL2 via gl.finish().\n',
      );
      console.table(results.map(result => ({
        renderer: result.renderer,
        graphics: result.caseInfo.graphicsInfo.renderer,
        mode: result.mode,
        bodies: result.bodies.toLocaleString('en-US'),
        submission: formatTiming(result.submission),
        synchronized: formatTiming(result.synchronized),
        wait: formatTiming(result.synchronize),
        pack: formatTiming(result.pack),
        upload: formatTiming(result.upload),
        submit: formatTiming(result.submit),
        drawn: result.lastFrame.drawnBodies.toLocaleString('en-US'),
        pixels: result.lastFrame.pixelBodies.toLocaleString('en-US'),
        outlined: result.lastFrame.outlinedBodies.toLocaleString('en-US'),
        capacity: result.lastFrame.bufferCapacity?.toLocaleString('en-US') ?? '—',
        buffers: result.lastFrame.cpuBufferBytes === null
          ? '—'
          : (
            `${((
              result.lastFrame.cpuBufferBytes +
              result.lastFrame.gpuBufferBytes
            ) / 1024 / 1024).toFixed(2)} MiB`
          ),
      })));
    }

    await context.close();
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopServer(server);
    if (server.exitCode && server.exitCode !== 0 && serverErrors) {
      process.stderr.write(serverErrors);
    }
  }
}

main().catch(error => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
