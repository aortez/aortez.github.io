#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import { chromium } from '@playwright/test';
import { BENCHMARK_SCENARIOS } from './scenarios.js';

const DEFAULT_SPATIAL_SIZES = [400, 1000, 5000, 10000];
const FULL_SPATIAL_SIZES = [400, 1000, 5000, 10000, 25000];
const DEFAULT_EXACT_SIZES = [400, 1000];

function parseInteger(value, option, minimum = 1) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${option} requires an integer >= ${minimum}`);
  }
  return parsed;
}

function parseNumber(value, option, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`${option} requires a number >= ${minimum}`);
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
    spatialSizes: DEFAULT_SPATIAL_SIZES,
    exactSizes: DEFAULT_EXACT_SIZES,
    samples: 60,
    warmup: 20,
    theta: 0.7,
    scenario: 'jittered',
    stress: false,
    busy: false,
    churn: false,
    busyBalls: 10000,
    busyParticles: null,
    particleGravity: false,
    renderOutlines: true,
    adaptiveOutlines: true,
    highLoadOutlineRadius: 8,
    sharedRenderColor: false,
    json: false,
  };
  let thetaExplicit = false;

  for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index];
    switch (argument) {
      case '--full':
        options.spatialSizes = FULL_SPATIAL_SIZES;
        break;
      case '--sizes':
        options.spatialSizes = parseSizes(
          optionValue(argumentsList, index, argument),
          argument,
        );
        index++;
        break;
      case '--exact-sizes':
        options.exactSizes = parseSizes(
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
      case '--theta':
        options.theta = parseNumber(
          optionValue(argumentsList, index, argument),
          argument,
        );
        thetaExplicit = true;
        index++;
        break;
      case '--scenario': {
        const scenario = optionValue(argumentsList, index, argument);
        if (!BENCHMARK_SCENARIOS.includes(scenario)) {
          throw new Error(
            `${argument} requires one of: ${BENCHMARK_SCENARIOS.join(', ')}`,
          );
        }
        options.scenario = scenario;
        index++;
        break;
      }
      case '--stress':
        options.stress = true;
        break;
      case '--busy':
        options.busy = true;
        break;
      case '--churn':
        options.churn = true;
        break;
      case '--busy-balls':
        options.busyBalls = parseInteger(
          optionValue(argumentsList, index, argument),
          argument,
        );
        index++;
        break;
      case '--busy-particles':
        options.busyParticles = parseInteger(
          optionValue(argumentsList, index, argument),
          argument,
          0,
        );
        index++;
        break;
      case '--full-gravity':
        options.particleGravity = true;
        if (!thetaExplicit) {
          options.theta = 0.5;
        }
        break;
      case '--no-particle-gravity':
        options.particleGravity = false;
        if (!thetaExplicit) {
          options.theta = 0.7;
        }
        break;
      case '--no-outlines':
        options.renderOutlines = false;
        break;
      case '--all-outlines':
        options.adaptiveOutlines = false;
        break;
      case '--high-load-outline-radius':
        options.highLoadOutlineRadius = parseNumber(
          optionValue(argumentsList, index, argument),
          argument,
        );
        index++;
        break;
      case '--shared-color':
        options.sharedRenderColor = true;
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

  if ([options.stress, options.busy, options.churn].filter(Boolean).length > 1) {
    throw new Error('--stress, --busy, and --churn select different fixtures');
  }

  return options;
}

function printHelp() {
  console.log(`Usage: npm run bench:browser -- [options]

Options:
  --full              Add the 25,000-body spatial case.
  --sizes LIST        Comma-separated spatial-mode body counts.
  --exact-sizes LIST  Comma-separated exact-mode body counts.
  --samples NUMBER    Recorded frames per case (default: 60).
  --warmup NUMBER     Warmup frames per case (default: 20).
  --theta NUMBER      Override the mode's Barnes-Hut opening parameter.
  --scenario NAME     Fixture for standard cases (default: jittered).
  --stress            Run only a 6,600-ball + 10,000-particle clustered case.
  --busy              Run an active 10,000-ball + 10,000-particle gameplay case.
  --churn             Repeatedly replace 75% of a busy scene to measure waves.
  --busy-balls NUMBER Override the busy fixture's ball count.
  --busy-particles NUMBER
                      Override the busy fixture's particle count.
  --full-gravity      Enable mutual ball-particle gravity (defaults theta to 0.5).
  --no-particle-gravity
                      Use visual-effect particles (the default, theta 0.7).
  --no-outlines       Benchmark filled circles without per-body strokes.
  --all-outlines      Disable outline LOD and stroke every visible circle.
  --high-load-outline-radius NUMBER
                      Pixel radius outlined in dense scenes (default: 8).
  --shared-color      Benchmark every body with one shared fill color.
  --json              Emit structured JSON only.
  --help              Show this help.

Standard cases use the production Fast gravity mode and a deterministic
non-overlapping jittered grid. The stress case adds clustered bodies and
persistent particle boundary straddlers to represent an explosion-heavy
gameplay frame. The busy case adds mixed radii, movement, and off-canvas
particles like a saturated live scene. It uses a 1536x1280 viewport; other
cases use 1280x900. The churn case defaults to 10,000 balls and 16,000
particles. All cases run the production animation loop. Timing values are
informational; correctness remains covered by the unit and browser tests.`);
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
      // The server is still starting.
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

async function configureCase(page, testCase, theta) {
  return await page.evaluate(async ({
    count,
    mode,
    overlay,
    particleCount,
    scenario,
    edgeStraddlers,
    active,
    busy,
    churn,
    particleGravity,
    renderOutlines,
    adaptiveOutlines,
    highLoadOutlineRadius,
    sharedRenderColor,
    thetaValue,
  }) => {
    const [
      { getRuntime },
      { createScenario, createSeededRandom },
      { Ball },
      { vec3 },
    ] = await Promise.all([
      import('/src/scripts/main.js'),
      import('/benchmarks/scenarios.js'),
      import('/src/scripts/ball.js'),
      import('/src/scripts/vec3.js'),
    ]);

    const { canvas, world } = getRuntime();
    world.init();
    world.shouldDrawBackground = false;
    world.is_paused = !active;
    world.max_balls = Math.max(count, 10000);
    world.max_particles = Math.max(particleCount, 25000);
    world.useQuadtreeCollisions = mode === 'spatial';
    world.useBarnesHutGravity = mode === 'spatial';
    world.showQuadtreeOverlay = overlay;
    world.setGravityMode(particleGravity ? 'full' : 'fast');
    world.barnesHutTheta = thetaValue;
    world.renderOutlines = renderOutlines;
    world.adaptiveOutlines = adaptiveOutlines;
    world.highLoadOutlineRadius = highLoadOutlineRadius;
    world.renderFillStyleOverride = (
      sharedRenderColor ? 'rgb(128,128,128)' : null
    );

    const maxX = canvas.width / world.getDrawScale(canvas);
    const maxY = canvas.height / world.getDrawScale(canvas);
    const radiusScale = Math.min(maxX, maxY);
    const fixture = createScenario(scenario, count, 0xC0FFEE);
    const random = createSeededRandom(0xA11CE);
    const color = new vec3(80, 160, 240);
    world.balls = fixture.map((item, index) => {
      let radius = item.r * radiusScale;
      if (busy && index % 100 === 0) {
        radius = (0.025 + random() * 0.075) * radiusScale;
      } else if (busy && index % 10 === 0) {
        radius = (0.004 + random() * 0.018) * radiusScale;
      } else if (busy) {
        radius *= 0.5 + random();
      }
      if (churn) {
        radius = Math.max(radius, 0.006 * radiusScale);
      }
      const ball = new Ball(
        Math.max(radius, Math.min(maxX - radius, item.center.x * maxX)),
        Math.max(radius, Math.min(maxY - radius, item.center.y * maxY)),
        radius,
        color,
      );
      ball.id = item.id;
      ball.is_invincible = true;
      if (churn) {
        ball.hp = 1000000000;
      }
      ball.is_moving = active;
      if (active) {
        const angle = random() * Math.PI * 2;
        const speed = 0.002 + random() * 0.018;
        ball.v.x = Math.cos(angle) * speed;
        ball.v.y = Math.sin(angle) * speed;
      }
      if (edgeStraddlers && index % 200 === 0) {
        ball.center.x = maxX - ball.r * 0.25;
      }
      return ball;
    });
    const particleFixture = createScenario(
      scenario,
      particleCount,
      0xBAD5EED,
    );
    const particleRandom = createSeededRandom(0xF17E5);
    const particleColor = new vec3(240, 160, 80);
    world.particles = particleFixture.map((item, index) => {
      const radius = item.r * radiusScale * 0.35;
      const particle = new Ball(
        item.center.x * maxX,
        item.center.y * maxY,
        radius,
        particleColor,
      );
      particle.id = item.id;
      particle.hp = 1000000000;
      particle.is_invincible = true;
      particle.is_moving = active;
      if (active) {
        const angle = particleRandom() * Math.PI * 2;
        const speed = 0.02 + particleRandom() * 0.18;
        particle.v.x = Math.cos(angle) * speed;
        particle.v.y = Math.sin(angle) * speed;
      }
      if (busy && index % 4 === 0) {
        const distance = 0.01 + particleRandom() * 0.25;
        switch (index % 16) {
          case 0:
            particle.center.x = -distance - radius;
            break;
          case 4:
            particle.center.x = maxX + distance + radius;
            break;
          case 8:
            particle.center.y = -distance - radius;
            break;
          default:
            particle.center.y = maxY + distance + radius;
            break;
        }
      }
      if (edgeStraddlers && index % 200 === 0) {
        particle.center.y = maxY - particle.r * 0.25;
      }
      return particle;
    });

    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      maxX,
      maxY,
      gravityMode: world.gravityMode,
      particleGravityEnabled: world.useBallParticleGravity,
      renderOutlines: world.renderOutlines,
      adaptiveOutlines: world.adaptiveOutlines,
      highLoadOutlineRadius: world.highLoadOutlineRadius,
      sharedRenderColor: world.renderFillStyleOverride !== null,
      theta: world.barnesHutTheta,
    };
  }, {
    count: testCase.count,
    mode: testCase.mode,
    overlay: testCase.overlay,
    particleCount: testCase.particleCount ?? 0,
    scenario: testCase.scenario,
    edgeStraddlers: testCase.edgeStraddlers ?? false,
    active: testCase.active ?? false,
    busy: testCase.busy ?? false,
    churn: testCase.churn ?? false,
    particleGravity: testCase.particleGravity,
    renderOutlines: testCase.renderOutlines,
    adaptiveOutlines: testCase.adaptiveOutlines,
    highLoadOutlineRadius: testCase.highLoadOutlineRadius,
    sharedRenderColor: testCase.sharedRenderColor,
    thetaValue: theta,
  });
}

async function collectFrames(page, warmup, sampleCount, churn = false) {
  return await page.evaluate(async ({
    warmupFrames,
    recordedFrames,
    churnEnabled,
  }) => {
    const { getRuntime } = await import('/src/scripts/main.js');
    const { world } = getRuntime();

    return await new Promise(resolve => {
      const samples = [];
      let observedFrames = 0;
      let lastFrameId = world.lastFrameStats?.frameId ?? -1;

      const armChurnFrame = () => {
        if (!churnEnabled) {
          return;
        }

        for (const ball of world.balls) {
          ball.is_invincible = true;
          ball.hp = 1000000000;
        }
        const deadBallCount = Math.floor(world.balls.length * 0.75);
        for (let index = 0; index < deadBallCount; index++) {
          const ball = world.balls[index];
          ball.r = Math.max(ball.r, 0.006);
          ball.m = ball.r * ball.r;
          ball.is_invincible = false;
          ball.hp = -1;
        }

        for (const particle of world.particles) {
          particle.hp = 1000000000;
        }
        const deadParticleCount = Math.floor(world.particles.length * 0.5);
        for (let index = 0; index < deadParticleCount; index++) {
          world.particles[index].hp = 0;
        }
      };

      armChurnFrame();
      const observe = () => {
        const stats = world.lastFrameStats;
        if (stats && stats.frameId !== lastFrameId) {
          lastFrameId = stats.frameId;
          if (observedFrames >= warmupFrames) {
            samples.push({
              frameIntervalMs: stats.frameIntervalMs,
              measuredFrameMs: stats.measuredFrameMs,
              physicsMs: stats.physicsMs,
              renderMs: stats.renderMs,
              renderBreakdown: stats.renderBreakdown,
              physicsBreakdown: stats.physicsBreakdown,
            });
          }
          observedFrames++;
          armChurnFrame();
        }

        if (samples.length >= recordedFrames) {
          resolve(samples);
        } else {
          requestAnimationFrame(observe);
        }
      };

      requestAnimationFrame(observe);
    });
  }, {
    warmupFrames: warmup,
    recordedFrames: sampleCount,
    churnEnabled: churn,
  });
}

async function inspectCase(page) {
  return await page.evaluate(async () => {
    const { getRuntime } = await import('/src/scripts/main.js');
    const { world } = getRuntime();
    return {
      candidates: world.lastQuadtree?.countPotentialPairs() ?? null,
      crossCandidates: (
        world.lastQuadtree && world.lastParticleQuadtree
          ? world.lastQuadtree.countPotentialPairsBetween(
            world.lastParticleQuadtree,
          )
          : null
      ),
      rejected: world.quadtreeRejected.length,
      rejectedParticles: world.particleQuadtreeRejected.length,
      tree: world.lastQuadtree?.getStats() ?? null,
      gravity: world.lastGravityStats,
      collisions: world.lastCollisionStats,
      physicsBreakdown: world.lastPhysicsBreakdown,
      renderBreakdown: world.lastRenderBreakdown,
      ballCount: world.balls.length,
      particleCount: world.particles.length,
    };
  });
}

function formatTiming(summary) {
  return `${summary.medianMs.toFixed(2)}/${summary.p95Ms.toFixed(2)}`;
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
    await waitForServer(baseUrl, server);
    browser = await chromium.launch({ headless: true });
    const viewport = options.busy || options.churn
      ? { width: 1536, height: 1280 }
      : { width: 1280, height: 900 };
    const context = await browser.newContext({
      viewport,
    });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') {
        route.continue();
      } else {
        route.fulfill({
          status: 204,
          body: '',
        });
      }
    });

    const page = await context.newPage();
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        browserErrors.push(message.text());
      }
    });
    await page.goto(baseUrl);
    await page.locator('#pizza').waitFor({ state: 'visible' });
    await page.waitForFunction(() => (
      document.querySelector('#pizza').width > 100 &&
      document.querySelector('#pizza').height > 100
    ));

    const standardCases = [
      ...options.spatialSizes.map(count => ({
        name: 'spatial',
        mode: 'spatial',
        overlay: false,
        particleCount: 0,
        count,
        scenario: options.scenario,
        particleGravity: options.particleGravity,
        renderOutlines: options.renderOutlines,
        adaptiveOutlines: options.adaptiveOutlines,
        highLoadOutlineRadius: options.highLoadOutlineRadius,
        sharedRenderColor: options.sharedRenderColor,
      })),
      ...options.exactSizes.map(count => ({
        name: 'exact',
        mode: 'exact',
        overlay: false,
        particleCount: 0,
        count,
        scenario: options.scenario,
        particleGravity: options.particleGravity,
        renderOutlines: options.renderOutlines,
        adaptiveOutlines: options.adaptiveOutlines,
        highLoadOutlineRadius: options.highLoadOutlineRadius,
        sharedRenderColor: options.sharedRenderColor,
      })),
      {
        name: 'spatial+overlay',
        mode: 'spatial',
        overlay: true,
        particleCount: 0,
        count: 1000,
        scenario: options.scenario,
        particleGravity: options.particleGravity,
        renderOutlines: options.renderOutlines,
        adaptiveOutlines: options.adaptiveOutlines,
        highLoadOutlineRadius: options.highLoadOutlineRadius,
        sharedRenderColor: options.sharedRenderColor,
      },
      {
        name: 'spatial+particles',
        mode: 'spatial',
        overlay: false,
        particleCount: 1000,
        count: 1000,
        scenario: options.scenario,
        particleGravity: options.particleGravity,
        renderOutlines: options.renderOutlines,
        adaptiveOutlines: options.adaptiveOutlines,
        highLoadOutlineRadius: options.highLoadOutlineRadius,
        sharedRenderColor: options.sharedRenderColor,
      },
    ];
    const cases = options.churn
      ? [{
        name: (
          options.particleGravity
            ? 'spatial+churn-full'
            : 'spatial+churn-fast'
        ),
        mode: 'spatial',
        overlay: false,
        particleCount: options.busyParticles ?? 16000,
        count: options.busyBalls,
        scenario: 'clustered',
        active: true,
        busy: true,
        churn: true,
        particleGravity: options.particleGravity,
        renderOutlines: options.renderOutlines,
        adaptiveOutlines: options.adaptiveOutlines,
        highLoadOutlineRadius: options.highLoadOutlineRadius,
        sharedRenderColor: options.sharedRenderColor,
      }]
      : options.busy
      ? [{
        name: (
          options.particleGravity
            ? 'spatial+busy-full'
            : 'spatial+busy-fast'
        ),
        mode: 'spatial',
        overlay: false,
        particleCount: options.busyParticles ?? 10000,
        count: options.busyBalls,
        scenario: 'clustered',
        active: true,
        busy: true,
        particleGravity: options.particleGravity,
        renderOutlines: options.renderOutlines,
        adaptiveOutlines: options.adaptiveOutlines,
        highLoadOutlineRadius: options.highLoadOutlineRadius,
        sharedRenderColor: options.sharedRenderColor,
      }]
      : options.stress
        ? [{
        name: (
          options.particleGravity
            ? 'spatial+stress-full'
            : 'spatial+stress-fast'
        ),
        mode: 'spatial',
        overlay: false,
        particleCount: 10000,
        count: 6600,
        scenario: 'clustered',
        edgeStraddlers: true,
        particleGravity: options.particleGravity,
        renderOutlines: options.renderOutlines,
        adaptiveOutlines: options.adaptiveOutlines,
        highLoadOutlineRadius: options.highLoadOutlineRadius,
        sharedRenderColor: options.sharedRenderColor,
        }]
        : standardCases;
    const results = [];

    for (const testCase of cases) {
      const worldBounds = await configureCase(page, testCase, options.theta);
      const frames = await collectFrames(
        page,
        options.warmup,
        options.samples,
        testCase.churn ?? false,
      );
      const inspection = await inspectCase(page);
      const interval = summarize(frames.map(frame => frame.frameIntervalMs));
      const measured = summarize(frames.map(frame => frame.measuredFrameMs));
      const physics = summarize(frames.map(frame => frame.physicsMs));
      const render = summarize(frames.map(frame => frame.renderMs));
      const renderStageSummary = stageName => summarize(frames.map(frame => (
        frame.renderBreakdown?.[stageName] ?? 0
      )));
      const stageSummary = stageName => summarize(frames.map(frame => (
        frame.physicsBreakdown?.[stageName] ?? 0
      )));
      const treeBuild = summarize(frames.map(frame => (
        (frame.physicsBreakdown?.ballTreeBuildMs ?? 0) +
        (frame.physicsBreakdown?.particleTreeBuildMs ?? 0)
      )));
      const collisionTiming = summarize(frames.map(frame => (
        (frame.physicsBreakdown?.ballCollisionMs ?? 0) +
        (frame.physicsBreakdown?.ballParticleCollisionMs ?? 0)
      )));
      const particleAdvanceTiming = stageSummary('particleAdvanceMs');
      const removedTiming = summarize(frames.map(frame => (
        (frame.physicsBreakdown?.lifecycle?.removedBalls ?? 0) +
        (frame.physicsBreakdown?.lifecycle?.removedParticles ?? 0)
      )));
      const fragmentTiming = summarize(frames.map(frame => (
        frame.physicsBreakdown?.lifecycle?.generatedFragments ?? 0
      )));

      results.push({
        ...testCase,
        worldBounds,
        interval,
        measured,
        physics,
        render,
        particleRenderTiming: renderStageSummary('particleMs'),
        ballRenderTiming: renderStageSummary('ballMs'),
        treeBuild,
        gravityTiming: stageSummary('gravityMs'),
        collisionTiming,
        lifecycleTiming: stageSummary('lifecycleMs'),
        particleAdvanceTiming,
        removedTiming,
        fragmentTiming,
        framesOver16_7: frames.filter(frame => frame.frameIntervalMs > 16.7).length,
        framesOver33_3: frames.filter(frame => frame.frameIntervalMs > 33.3).length,
        ...inspection,
      });
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
        viewport,
        options,
      },
      results,
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('Browser frame benchmark');
      console.log(`Commit: ${report.metadata.commit}${report.metadata.dirty ? ' (dirty)' : ''}`);
      console.log(`Browser: ${report.metadata.browser}`);
      console.log(`CPU: ${report.metadata.cpu}`);
      console.log('Times are median/p95 milliseconds.\n');
      console.table(results.map(result => ({
        mode: result.name,
        gravityMode: result.worldBounds.gravityMode,
        theta: result.worldBounds.theta,
        outlines: !result.worldBounds.renderOutlines
          ? 'off'
          : result.worldBounds.adaptiveOutlines
            ? `adaptive≥${result.worldBounds.highLoadOutlineRadius}px`
            : 'all',
        color: result.worldBounds.sharedRenderColor ? 'shared' : 'normal',
        bodies: (
          result.count.toLocaleString('en-US') +
          (result.particleCount
            ? ` + ${result.particleCount.toLocaleString('en-US')}p`
            : '')
        ),
        interval: formatTiming(result.interval),
        measured: formatTiming(result.measured),
        physics: formatTiming(result.physics),
        render: formatTiming(result.render),
        renderParticles: formatTiming(result.particleRenderTiming),
        renderBalls: formatTiming(result.ballRenderTiming),
        trees: formatTiming(result.treeBuild),
        gravity: formatTiming(result.gravityTiming),
        collisions: formatTiming(result.collisionTiming),
        lifecycle: formatTiming(result.lifecycleTiming),
        particles: formatTiming(result.particleAdvanceTiming),
        candidates: result.candidates?.toLocaleString('en-US') ?? '—',
        crossPairs: result.crossCandidates?.toLocaleString('en-US') ?? '—',
        fallbackPairs: (
          (
            (result.collisions?.ballFallbackCandidates ?? 0) +
            (result.collisions?.ballParticleFallbackCandidates ?? 0)
          ).toLocaleString('en-US')
        ),
        hits: (
          (
            (result.collisions?.ballCollisions ?? 0) +
            (result.collisions?.ballParticleCollisions ?? 0)
          ).toLocaleString('en-US')
        ),
        gravitySources: result.gravity?.appliedSources?.toLocaleString('en-US') ?? '—',
        over33ms: `${result.framesOver33_3}/${options.samples}`,
        rejected: result.rejected + result.rejectedParticles,
        culled: (
          result.renderBreakdown?.culledBodies?.toLocaleString('en-US') ?? '—'
        ),
        pixels: (
          result.renderBreakdown?.pixelBodies?.toLocaleString('en-US') ?? '—'
        ),
        outlined: (
          result.renderBreakdown?.outlinedBodies?.toLocaleString('en-US') ?? '—'
        ),
        removed: (
          Math.round(result.removedTiming.medianMs).toLocaleString('en-US')
        ),
        fragments: (
          Math.round(result.fragmentTiming.medianMs).toLocaleString('en-US')
        ),
        finalBodies: (
          `${result.ballCount.toLocaleString('en-US')} + ` +
          `${result.particleCount.toLocaleString('en-US')}p`
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
