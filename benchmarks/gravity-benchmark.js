#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import { chromium } from '@playwright/test';
import { BENCHMARK_SCENARIOS } from './scenarios.js';

const DEFAULT_SIZES = [1000, 5000, 10000];
const DEFAULT_SCENARIOS = ['jittered', 'clustered'];
const GRAVITY_SCENARIOS = [...BENCHMARK_SCENARIOS, 'busy'];
const GRAVITY_IMPLEMENTATIONS = ['reference', 'optimized'];

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

function parseList(value, option) {
  const values = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error(`${option} requires at least one value`);
  }
  return [...new Set(values)];
}

function parseSizes(value, option) {
  return parseList(value, option)
    .map(item => parseInteger(item, option))
    .sort((left, right) => left - right);
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
    sizes: DEFAULT_SIZES,
    scenarios: DEFAULT_SCENARIOS,
    samples: 30,
    warmup: 10,
    theta: 0.7,
    oracleLimit: 1000,
    diagnosticTargets: 128,
    implementations: GRAVITY_IMPLEMENTATIONS,
    profileAllocations: false,
    allocationSamplingInterval: 32768,
    json: false,
  };

  for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index];
    switch (argument) {
      case '--full':
        options.sizes = [1000, 5000, 10000, 25000, 50000];
        break;
      case '--sizes':
        options.sizes = parseSizes(
          optionValue(argumentsList, index, argument),
          argument,
        );
        index++;
        break;
      case '--scenario':
      case '--scenarios': {
        const scenarios = parseList(
          optionValue(argumentsList, index, argument),
          argument,
        );
        for (const scenario of scenarios) {
          if (!GRAVITY_SCENARIOS.includes(scenario)) {
            throw new Error(
              `${argument} requires values from: ` +
              GRAVITY_SCENARIOS.join(', '),
            );
          }
        }
        options.scenarios = scenarios;
        index++;
        break;
      }
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
        index++;
        break;
      case '--oracle-limit':
        options.oracleLimit = parseInteger(
          optionValue(argumentsList, index, argument),
          argument,
          0,
        );
        index++;
        break;
      case '--diagnostic-targets':
        options.diagnosticTargets = parseInteger(
          optionValue(argumentsList, index, argument),
          argument,
          0,
        );
        index++;
        break;
      case '--implementation': {
        const implementation = optionValue(
          argumentsList,
          index,
          argument,
        );
        if (implementation === 'both') {
          options.implementations = GRAVITY_IMPLEMENTATIONS;
        } else if (GRAVITY_IMPLEMENTATIONS.includes(implementation)) {
          options.implementations = [implementation];
        } else {
          throw new Error(
            `${argument} requires one of: reference, optimized, both`,
          );
        }
        index++;
        break;
      }
      case '--profile-allocations':
        options.profileAllocations = true;
        break;
      case '--allocation-sampling-interval':
        options.allocationSamplingInterval = parseInteger(
          optionValue(argumentsList, index, argument),
          argument,
        );
        index++;
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
  console.log(`Usage: npm run bench:gravity -- [options]

Options:
  --full                Include 25,000 and 50,000 bodies.
  --sizes LIST          Comma-separated body counts.
  --scenario LIST       Seeded scenarios (default: jittered,clustered).
  --samples NUMBER      Recorded iterations per case (default: 30).
  --warmup NUMBER       Warmup iterations per case (default: 10).
  --theta NUMBER        Barnes-Hut opening parameter (default: 0.7).
  --oracle-limit NUMBER Maximum exact-force oracle size (default: 1,000).
  --diagnostic-targets NUMBER
                        Targets sampled for structural traversal diagnostics
                        outside the timed region (default: 128).
  --implementation NAME Reference, optimized, or both (default: both).
  --profile-allocations  Collect a V8 sampling allocation profile. This
                         perturbs timings and should be a separate run.
  --allocation-sampling-interval NUMBER
                         Approximate sampled bytes (default: 32,768).
  --json                Emit structured JSON only.
  --help                Show this help.

Each recorded iteration rebuilds the production quadtree, aggregates mass, and
calculates acceleration for every body. Tree construction, mass aggregation,
and traversal are timed separately. Correctness and structural diagnostics run
outside the timed region.`);
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
    p99Ms: percentile(sorted, 0.99),
    meanMs: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    minMs: sorted[0],
    maxMs: sorted.at(-1),
  };
}

function formatTiming(summary) {
  return `${summary.medianMs.toFixed(2)}/${summary.p95Ms.toFixed(2)}`;
}

function formatPercent(value) {
  return value === null ? '—' : `${(value * 100).toFixed(3)}%`;
}

function summarizeAllocationProfile(profile, limit = 10) {
  const nodes = new Map();
  const visit = node => {
    nodes.set(node.id, node);
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(profile.head);

  const entries = new Map();
  let totalSampledBytes = 0;
  for (const sample of profile.samples ?? []) {
    const node = nodes.get(sample.nodeId);
    if (!node) {
      continue;
    }
    const frame = node.callFrame;
    const key = [
      frame.functionName || '(anonymous)',
      frame.url || '(unknown)',
      frame.lineNumber + 1,
    ].join(':');
    const entry = entries.get(key) ?? {
      functionName: frame.functionName || '(anonymous)',
      url: frame.url || '(unknown)',
      lineNumber: frame.lineNumber + 1,
      sampledBytes: 0,
      sampleCount: 0,
    };
    entry.sampledBytes += sample.size;
    entry.sampleCount++;
    totalSampledBytes += sample.size;
    entries.set(key, entry);
  }

  return {
    totalSampledBytes,
    top: [...entries.values()]
      .sort((left, right) => right.sampledBytes - left.sampledBytes)
      .slice(0, limit),
  };
}

async function configureCase(
  page,
  scenario,
  bodyCount,
  theta,
  implementation,
) {
  return await page.evaluate(async ({
    scenarioName,
    count,
    thetaValue,
    implementationName,
  }) => {
    const [
      { Ball },
      { createScenario, createSeededRandom },
      { vec3 },
      { World },
    ] = await Promise.all([
      import('/src/scripts/ball.js'),
      import('/benchmarks/scenarios.js'),
      import('/src/scripts/vec3.js'),
      import('/src/scripts/world.js'),
    ]);

    const canvas = document.getElementById('benchmark_canvas');
    const fixtureScenario = scenarioName === 'busy'
      ? 'clustered'
      : scenarioName;
    const fixture = createScenario(fixtureScenario, count, 0xC0FFEE);
    const random = createSeededRandom(0xA11CE ^ count);
    const color = new vec3(80, 160, 240);
    const world = new World();
    world.init();
    world.g = 1;
    world.barnesHutTheta = thetaValue;
    world.gravitySoftening = 0.000001;
    world.setGravityImplementation(implementationName);
    world.max_balls = Math.max(10000, count);
    world.balls = fixture.map((item, index) => {
      let radius = item.r;
      if (scenarioName === 'busy' && index % 100 === 0) {
        radius = 0.025 + random() * 0.075;
      } else if (scenarioName === 'busy' && index % 10 === 0) {
        radius = 0.004 + random() * 0.018;
      } else if (scenarioName === 'busy') {
        radius *= 0.5 + random();
      }
      const ball = new Ball(
        Math.max(radius, Math.min(1 - radius, item.center.x)),
        Math.max(radius, Math.min(1 - radius, item.center.y)),
        radius,
        color,
      );
      ball.id = index;
      ball.is_invincible = true;
      ball.is_moving = false;
      return ball;
    });

    globalThis.__gravityBenchmark = {
      canvas,
      world,
    };
    return {
      bodyCount: world.balls.length,
      scenario: scenarioName,
      theta: world.barnesHutTheta,
      implementation: world.gravityImplementation,
    };
  }, {
    scenarioName: scenario,
    count: bodyCount,
    thetaValue: theta,
    implementationName: implementation,
  });
}

async function collectSamples(page, warmup, sampleCount) {
  return await page.evaluate(async ({
    warmupIterations,
    recordedIterations,
  }) => {
    const { canvas, world } = globalThis.__gravityBenchmark;
    const frames = [];
    const totalIterations = warmupIterations + recordedIterations;

    for (let iteration = 0; iteration < totalIterations; iteration++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      for (const ball of world.balls) {
        ball.v.x = 0;
        ball.v.y = 0;
      }

      const totalStart = performance.now();
      const buildStart = totalStart;
      const tree = world.buildQuadtree(canvas);
      const buildEnd = performance.now();
      const gravityStats = world.applyBallGravityBarnesHut(tree);
      const totalEnd = performance.now();

      let checksumX = 0;
      let checksumY = 0;
      for (let index = 0; index < world.balls.length; index++) {
        const weight = index + 1;
        checksumX += world.balls[index].v.x * weight;
        checksumY += world.balls[index].v.y * weight;
      }

      if (iteration >= warmupIterations) {
        frames.push({
          aggregateMs: gravityStats.massAggregationMs,
          appliedSources: gravityStats.appliedSources,
          approximations: gravityStats.approximations,
          buildMs: buildEnd - buildStart,
          checksumX,
          checksumY,
          exactSources: gravityStats.exactInteractions,
          gravityMs: totalEnd - buildEnd,
          totalMs: totalEnd - totalStart,
          traversalMs: gravityStats.traversalMs,
        });
      }
      globalThis.__gravityBenchmark.tree = tree;
    }
    return frames;
  }, {
    warmupIterations: warmup,
    recordedIterations: sampleCount,
  });
}

async function collectDiagnostics(page, requestedTargetCount) {
  return await page.evaluate(requestedTargets => {
    const { tree, world } = globalThis.__gravityBenchmark;
    const targetCount = Math.min(requestedTargets, world.balls.length);
    if (targetCount === 0) {
      return {
        sampledTargets: 0,
        averageVisitedNodes: 0,
        maximumVisitedNodes: 0,
      };
    }

    let totalVisitedNodes = 0;
    let maximumVisitedNodes = 0;
    let totalExactSources = 0;
    let totalApproximations = 0;
    for (let sample = 0; sample < targetCount; sample++) {
      const index = Math.floor(sample * world.balls.length / targetCount);
      const stats = tree.forEachMassInteraction(
        world.balls[index],
        world.barnesHutTheta,
        () => {},
      );
      totalVisitedNodes += stats.visitedNodes;
      maximumVisitedNodes = Math.max(
        maximumVisitedNodes,
        stats.visitedNodes,
      );
      totalExactSources += stats.exactSources;
      totalApproximations += stats.approximations;
    }

    return {
      sampledTargets: targetCount,
      averageVisitedNodes: totalVisitedNodes / targetCount,
      maximumVisitedNodes,
      averageExactSources: totalExactSources / targetCount,
      averageApproximations: totalApproximations / targetCount,
      treeStats: tree.getStats(),
    };
  }, requestedTargetCount);
}

async function collectAccuracy(page, oracleLimit) {
  return await page.evaluate(async limit => {
    const { canvas, world } = globalThis.__gravityBenchmark;
    if (world.balls.length > limit) {
      return null;
    }

    const [{ Ball }, { World }] = await Promise.all([
      import('/src/scripts/ball.js'),
      import('/src/scripts/world.js'),
    ]);
    const cloneBalls = () => world.balls.map((source, index) => {
      const ball = new Ball(
        source.center.x,
        source.center.y,
        source.r,
        source.color,
      );
      ball.id = index;
      ball.is_affected_by_gravity = source.is_affected_by_gravity;
      ball.is_invincible = true;
      ball.is_moving = false;
      return ball;
    });

    const exactWorld = new World();
    exactWorld.init();
    exactWorld.g = 1;
    exactWorld.gravitySoftening = world.gravitySoftening;
    exactWorld.balls = cloneBalls();
    exactWorld.applyBallGravityExact();

    const approximateWorld = new World();
    approximateWorld.init();
    approximateWorld.g = 1;
    approximateWorld.barnesHutTheta = world.barnesHutTheta;
    approximateWorld.gravitySoftening = world.gravitySoftening;
    approximateWorld.setGravityImplementation(world.gravityImplementation);
    approximateWorld.balls = cloneBalls();
    const tree = approximateWorld.buildQuadtree(canvas);
    approximateWorld.applyBallGravityBarnesHut(tree);

    let squaredError = 0;
    let squaredReference = 0;
    let maximumRelativeError = 0;
    const relativeErrors = [];
    for (let index = 0; index < world.balls.length; index++) {
      const exact = exactWorld.balls[index].v;
      const approximate = approximateWorld.balls[index].v;
      const error = Math.hypot(
        approximate.x - exact.x,
        approximate.y - exact.y,
      );
      const reference = Math.hypot(exact.x, exact.y);
      const relativeError = error / Math.max(reference, 1e-12);
      squaredError += error * error;
      squaredReference += reference * reference;
      maximumRelativeError = Math.max(
        maximumRelativeError,
        relativeError,
      );
      relativeErrors.push(relativeError);
    }
    relativeErrors.sort((left, right) => left - right);

    return {
      normalizedRmsError: squaredReference === 0
        ? 0
        : Math.sqrt(squaredError / squaredReference),
      p95RelativeError: relativeErrors[
        Math.min(
          relativeErrors.length - 1,
          Math.ceil(relativeErrors.length * 0.95) - 1,
        )
      ] ?? 0,
      maximumRelativeError,
    };
  }, oracleLimit);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const benchmarkUrl = `${baseUrl}/benchmarks/gravity-benchmark.html`;
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
    await waitForServer(benchmarkUrl, server);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1024, height: 1024 },
    });
    const page = await context.newPage();
    const cdpSession = options.profileAllocations
      ? await context.newCDPSession(page)
      : null;
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        browserErrors.push(message.text());
      }
    });

    const results = [];
    let caseIndex = 0;
    for (const scenario of options.scenarios) {
      for (const bodyCount of options.sizes) {
        const implementations = caseIndex % 2 === 0
          ? options.implementations
          : [...options.implementations].reverse();
        caseIndex++;
        for (const implementation of implementations) {
          await page.goto(benchmarkUrl);
          const caseInfo = await configureCase(
            page,
            scenario,
            bodyCount,
            options.theta,
            implementation,
          );
          let samples;
          let allocationProfile = null;
          if (cdpSession) {
            await collectSamples(page, options.warmup, 0);
            await cdpSession.send('HeapProfiler.enable');
            await cdpSession.send('HeapProfiler.startSampling', {
              samplingInterval: options.allocationSamplingInterval,
              includeObjectsCollectedByMajorGC: true,
              includeObjectsCollectedByMinorGC: true,
            });
            const heapBefore = await cdpSession.send('Runtime.getHeapUsage');
            samples = await collectSamples(page, 0, options.samples);
            const heapAfter = await cdpSession.send('Runtime.getHeapUsage');
            const allocationResult = await cdpSession.send(
              'HeapProfiler.stopSampling',
            );
            allocationProfile = {
              ...summarizeAllocationProfile(allocationResult.profile),
              heapBefore,
              heapAfter,
            };
          } else {
            samples = await collectSamples(
              page,
              options.warmup,
              options.samples,
            );
          }
          const diagnostics = await collectDiagnostics(
            page,
            options.diagnosticTargets,
          );
          const accuracy = await collectAccuracy(page, options.oracleLimit);
          const lastSample = samples.at(-1);
          const traversal = summarize(
            samples.map(sample => sample.traversalMs),
          );
          results.push({
            implementation,
            scenario,
            bodies: bodyCount,
            caseInfo,
            build: summarize(samples.map(sample => sample.buildMs)),
            aggregate: summarize(
              samples.map(sample => sample.aggregateMs),
            ),
            traversal,
            gravity: summarize(samples.map(sample => sample.gravityMs)),
            total: summarize(samples.map(sample => sample.totalMs)),
            lastSample,
            diagnostics,
            accuracy,
            allocationProfile,
            medianNanosecondsPerAppliedSource: (
              traversal.medianMs * 1e6 /
              Math.max(1, lastSample.appliedSources)
            ),
          });
        }
      }
    }

    for (const result of results) {
      const reference = results.find(candidate => (
        candidate.implementation === 'reference' &&
        candidate.scenario === result.scenario &&
        candidate.bodies === result.bodies
      ));
      result.traversalSpeedup = (
        reference && result.implementation === 'optimized'
          ? reference.traversal.medianMs / result.traversal.medianMs
          : null
      );
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
      console.log('Barnes-Hut gravity browser benchmark');
      console.log(
        `Commit: ${report.metadata.commit}` +
        `${report.metadata.dirty ? ' (dirty)' : ''}`,
      );
      console.log(`Browser: ${report.metadata.browser}`);
      console.log(`CPU: ${report.metadata.cpu}`);
      console.log(`Theta: ${options.theta}`);
      if (options.profileAllocations) {
        console.log(
          'Allocation profiling is enabled; timing results are perturbed.',
        );
      }
      console.log('Times are median/p95 milliseconds.\n');
      console.table(results.map(result => ({
        implementation: result.implementation,
        scenario: result.scenario,
        bodies: result.bodies.toLocaleString('en-US'),
        total: formatTiming(result.total),
        build: formatTiming(result.build),
        aggregate: formatTiming(result.aggregate),
        traversal: formatTiming(result.traversal),
        sources: result.lastSample.appliedSources.toLocaleString('en-US'),
        exact: result.lastSample.exactSources.toLocaleString('en-US'),
        approximated: (
          result.lastSample.approximations.toLocaleString('en-US')
        ),
        nodes: (
          result.diagnostics.treeStats?.nodeCount.toLocaleString('en-US') ??
          '—'
        ),
        visitsPerTarget: result.diagnostics.averageVisitedNodes.toFixed(1),
        nsPerSource: result.medianNanosecondsPerAppliedSource.toFixed(1),
        speedup: result.traversalSpeedup === null
          ? '—'
          : `${result.traversalSpeedup.toFixed(2)}×`,
        rmsError: formatPercent(
          result.accuracy?.normalizedRmsError ?? null,
        ),
        p95Error: formatPercent(
          result.accuracy?.p95RelativeError ?? null,
        ),
      })));
      if (options.profileAllocations) {
        for (const result of results) {
          console.log(
            `\n${result.implementation}/${result.scenario}/` +
            `${result.bodies.toLocaleString('en-US')}: ` +
            `${(result.allocationProfile.totalSampledBytes / 1024 / 1024)
              .toFixed(2)} MiB sampled`,
          );
          console.table(result.allocationProfile.top.map(entry => ({
            function: entry.functionName,
            location: `${entry.url}:${entry.lineNumber}`,
            sampledMiB: (
              entry.sampledBytes / 1024 / 1024
            ).toFixed(2),
            samples: entry.sampleCount,
          })));
        }
      }
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
