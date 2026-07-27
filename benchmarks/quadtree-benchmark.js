#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import os from 'node:os';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

import { quadtree } from '../src/scripts/quadtree.js';
import {
  advanceBodies,
  BENCHMARK_SCENARIOS,
  createScenario,
} from './scenarios.js';

const LEGACY_SIZES = [50, 100, 200, 400, 800];
const FULL_SIZES = [50, 100, 200, 400, 800, 1000];
const SCALE_SIZES = [1000, 5000, 10000, 25000, 50000, 100000];
const DEFAULT_SEED = 0xC0FFEE;

let timingSink = 0;

class BenchmarkPoint {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  toString() {
    return `(${this.x}, ${this.y})`;
  }
}

class BenchmarkElement {
  constructor(body) {
    this.id = body.id;
    this.center = new BenchmarkPoint(body.center.x, body.center.y);
    this.r = body.r;
  }

  toS() {
    return `benchmarkElement(${this.id}, ${this.center.x}, ${this.center.y}, ${this.r})`;
  }
}

function printHelp() {
  console.log(`Usage: npm run bench:quadtree -- [options]

Options:
  --full                 Include the extended current-implementation sizes.
  --scale                Exercise 1,000 through 100,000 objects.
  --sizes LIST           Comma-separated custom sizes.
  --scenario LIST        Comma-separated scenario names.
  --seed NUMBER          Decimal or 0x-prefixed seed (default: 0xC0FFEE).
  --samples NUMBER       Samples per timed operation (default: 9).
  --sample-ms NUMBER     Target duration of each batched sample (default: 30).
  --max-case-ms NUMBER   Skip predicted/observed slow cases (default: 1000).
  --max-candidates N     Skip timing above this candidate count (default: 20M).
  --oracle-limit NUMBER  Largest brute-force correctness case (default: 1000).
  --moving-frames NUMBER Number of deterministic moving frames (default: 16).
  --force                Disable predictive and observed-duration skipping.
  --json                 Emit structured JSON only.
  --help                 Show this help.

Scenarios:
  ${BENCHMARK_SCENARIOS.join(', ')}

Timing values are informational. Correctness failures set a non-zero exit code.`);
}

function parseNumber(value, optionName, { integer = false, minimum = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${optionName} requires a ${integer ? 'whole ' : ''}number >= ${minimum}`);
  }
  return parsed;
}

function parseList(value, optionName) {
  if (!value) {
    throw new Error(`${optionName} requires a comma-separated value`);
  }
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function takeOptionValue(argumentsList, index, optionName) {
  const value = argumentsList[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }
  return value;
}

function parseArguments(argumentsList) {
  const options = {
    sizes: LEGACY_SIZES,
    scenarios: [...BENCHMARK_SCENARIOS],
    seed: DEFAULT_SEED,
    samples: 9,
    sampleMs: 30,
    maxCaseMs: 1000,
    maxCandidates: 20000000,
    oracleLimit: 1000,
    movingFrames: 16,
    force: false,
    json: false,
  };

  for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index];
    switch (argument) {
      case '--help':
        options.help = true;
        break;
      case '--full':
        options.sizes = FULL_SIZES;
        break;
      case '--scale':
        options.sizes = SCALE_SIZES;
        break;
      case '--sizes': {
        const value = takeOptionValue(argumentsList, index, argument);
        options.sizes = parseList(value, argument).map(item => (
          parseNumber(item, argument, { integer: true, minimum: 1 })
        ));
        index++;
        break;
      }
      case '--scenario': {
        const value = takeOptionValue(argumentsList, index, argument);
        options.scenarios = parseList(value, argument);
        index++;
        break;
      }
      case '--seed': {
        const value = takeOptionValue(argumentsList, index, argument);
        options.seed = parseNumber(value, argument, { integer: true, minimum: 0 }) >>> 0;
        index++;
        break;
      }
      case '--samples': {
        const value = takeOptionValue(argumentsList, index, argument);
        options.samples = parseNumber(value, argument, { integer: true, minimum: 3 });
        index++;
        break;
      }
      case '--sample-ms': {
        const value = takeOptionValue(argumentsList, index, argument);
        options.sampleMs = parseNumber(value, argument, { minimum: 1 });
        index++;
        break;
      }
      case '--max-case-ms': {
        const value = takeOptionValue(argumentsList, index, argument);
        options.maxCaseMs = parseNumber(value, argument, { minimum: 1 });
        index++;
        break;
      }
      case '--max-candidates': {
        const value = takeOptionValue(argumentsList, index, argument);
        options.maxCandidates = parseNumber(
          value,
          argument,
          { integer: true, minimum: 1 },
        );
        index++;
        break;
      }
      case '--oracle-limit': {
        const value = takeOptionValue(argumentsList, index, argument);
        options.oracleLimit = parseNumber(value, argument, { integer: true, minimum: 1 });
        index++;
        break;
      }
      case '--moving-frames': {
        const value = takeOptionValue(argumentsList, index, argument);
        options.movingFrames = parseNumber(value, argument, { integer: true, minimum: 1 });
        index++;
        break;
      }
      case '--force':
        options.force = true;
        break;
      case '--json':
        options.json = true;
        break;
      default:
        throw new Error(`Unknown option "${argument}". Run with --help for usage.`);
    }
  }

  options.sizes = [...new Set(options.sizes)].sort((left, right) => left - right);
  options.scenarios = [...new Set(options.scenarios)];

  const unknownScenarios = options.scenarios.filter(
    scenario => !BENCHMARK_SCENARIOS.includes(scenario),
  );
  if (unknownScenarios.length > 0) {
    throw new Error(
      `Unknown scenario(s): ${unknownScenarios.join(', ')}. ` +
      `Expected: ${BENCHMARK_SCENARIOS.join(', ')}`,
    );
  }

  return options;
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

function collectMetadata(options) {
  const status = safeGit(['status', '--porcelain'], '');
  return {
    timestamp: new Date().toISOString(),
    commit: safeGit(['rev-parse', 'HEAD']),
    branch: safeGit(['branch', '--show-current']),
    dirty: status.length > 0,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: os.cpus().length,
    options: {
      sizes: options.sizes,
      scenarios: options.scenarios,
      seed: options.seed,
      samples: options.samples,
      sampleMs: options.sampleMs,
      maxCaseMs: options.maxCaseMs,
      maxCandidates: options.maxCandidates,
      oracleLimit: options.oracleLimit,
      movingFrames: options.movingFrames,
      force: options.force,
    },
  };
}

function createElementFrames(scenario, count, seed, movingFrameCount) {
  const bodies = createScenario(scenario, count, seed);
  const frameCount = scenario === 'moving' ? movingFrameCount : 1;
  const frames = [];

  for (let frame = 0; frame < frameCount; frame++) {
    frames.push(bodies.map(body => new BenchmarkElement(body)));
    advanceBodies(bodies, 1);
  }

  return frames;
}

function buildTree(elements) {
  const tree = new quadtree(0, 0, 1, 1, 3);
  let rejected = 0;

  for (const element of elements) {
    if (!tree.insert(element)) {
      rejected++;
    }
  }

  return { tree, rejected };
}

function traverseTree(tree) {
  if (typeof tree.getStats === 'function') {
    return tree.getStats();
  }

  const stats = {
    nodeCount: 0,
    leafCount: 0,
    maxDepth: 0,
    maxLocalObjects: 0,
    storedObjects: 0,
  };

  function visit(node, depth) {
    const children = Array.isArray(node.children) ? node.children : [];
    const objects = Array.isArray(node.objects) ? node.objects : [];
    stats.nodeCount++;
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    stats.maxLocalObjects = Math.max(stats.maxLocalObjects, objects.length);
    stats.storedObjects += objects.length;

    if (children.length === 0) {
      stats.leafCount++;
    }
    for (const child of children) {
      visit(child, depth + 1);
    }
  }

  visit(tree, 0);
  return stats;
}

function retrieveObjects(tree) {
  if (typeof tree.getObjectsRecursive === 'function') {
    return tree.getObjectsRecursive();
  }
  if (typeof tree.getObjects === 'function') {
    return tree.getObjects();
  }

  const objects = [];
  function visit(node) {
    if (Array.isArray(node.objects)) {
      objects.push(...node.objects);
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }
  visit(tree);
  return objects;
}

function validateStorage(tree, elements, rejected) {
  const errors = [];
  const objects = retrieveObjects(tree);
  const expectedIds = new Set(elements.map(element => element.id));
  const seenIds = new Set();
  let duplicateCount = 0;

  for (const object of objects) {
    if (seenIds.has(object.id)) {
      duplicateCount++;
    }
    seenIds.add(object.id);
  }

  if (rejected !== 0) {
    errors.push(`${rejected} object(s) were rejected by the root bounds`);
  }
  if (objects.length !== elements.length) {
    errors.push(`stored ${objects.length} object(s), expected ${elements.length}`);
  }
  if (duplicateCount !== 0) {
    errors.push(`stored ${duplicateCount} duplicate object reference(s)`);
  }

  const missing = [];
  for (const id of expectedIds) {
    if (!seenIds.has(id)) {
      missing.push(id);
      if (missing.length === 5) {
        break;
      }
    }
  }
  if (missing.length > 0) {
    errors.push(`missing object IDs: ${missing.join(', ')}`);
  }

  return errors;
}

function intersects(left, right) {
  const dx = left.center.x - right.center.x;
  const dy = left.center.y - right.center.y;
  const radius = left.r + right.r;
  return dx * dx + dy * dy < radius * radius;
}

function countBruteForceIntersections(elements) {
  let intersections = 0;
  for (let leftIndex = 0; leftIndex < elements.length; leftIndex++) {
    const left = elements[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex++) {
      if (intersects(left, elements[rightIndex])) {
        intersections++;
      }
    }
  }
  timingSink ^= intersections;
  return intersections;
}

function pairKey(left, right) {
  return left.id < right.id
    ? `${left.id}:${right.id}`
    : `${right.id}:${left.id}`;
}

function bruteForceIntersectionSet(elements) {
  const intersections = new Set();
  for (let leftIndex = 0; leftIndex < elements.length; leftIndex++) {
    const left = elements[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex++) {
      const right = elements[rightIndex];
      if (intersects(left, right)) {
        intersections.add(pairKey(left, right));
      }
    }
  }
  return intersections;
}

function supportsCandidatePairs(tree) {
  return typeof tree.forEachPotentialPair === 'function';
}

function countPotentialPairs(tree) {
  if (typeof tree.countPotentialPairs === 'function') {
    return tree.countPotentialPairs();
  }

  let pairCount = 0;
  const visit = (node, ancestorObjectCount) => {
    const objects = Array.isArray(node.objects) ? node.objects : [];
    const children = Array.isArray(node.children) ? node.children : [];
    pairCount += objects.length * (objects.length - 1) / 2;
    pairCount += objects.length * ancestorObjectCount;

    const descendantAncestorCount = ancestorObjectCount + objects.length;
    for (const child of children) {
      visit(child, descendantAncestorCount);
    }
  };

  visit(tree, 0);
  return pairCount;
}

function collectCandidatePairs(tree) {
  const pairs = new Set();
  const intersections = new Set();
  let duplicates = 0;

  tree.forEachPotentialPair((left, right) => {
    const key = pairKey(left, right);
    if (pairs.has(key)) {
      duplicates++;
    }
    pairs.add(key);
    if (intersects(left, right)) {
      intersections.add(key);
    }
  });

  return {
    candidateCount: pairs.size,
    duplicateCount: duplicates,
    intersectionCount: intersections.size,
    intersections,
  };
}

function comparePairSets(expected, actual) {
  const missing = [];
  const unexpected = [];

  for (const key of expected) {
    if (!actual.has(key)) {
      missing.push(key);
      if (missing.length === 5) {
        break;
      }
    }
  }
  for (const key of actual) {
    if (!expected.has(key)) {
      unexpected.push(key);
      if (unexpected.length === 5) {
        break;
      }
    }
  }

  return { missing, unexpected };
}

function candidateCounts(tree, filterIntersections) {
  let candidates = 0;
  let intersectionCount = 0;

  tree.forEachPotentialPair((left, right) => {
    candidates++;
    timingSink ^= left.id + right.id;
    if (filterIntersections && intersects(left, right)) {
      intersectionCount++;
    }
  });

  timingSink ^= intersectionCount;
  return { candidates, intersectionCount };
}

function percentile(sortedSamples, quantile) {
  const index = Math.min(
    sortedSamples.length - 1,
    Math.max(0, Math.ceil(sortedSamples.length * quantile) - 1),
  );
  return sortedSamples[index];
}

function measureOperation(operation, options) {
  const warmupCount = 2;
  for (let index = 0; index < warmupCount; index++) {
    operation();
  }

  const estimateStart = performance.now();
  operation();
  const estimatedDuration = Math.max(performance.now() - estimateStart, 0.001);

  if (!options.force && estimatedDuration > options.maxCaseMs) {
    return {
      skipped: true,
      reason: `single operation took ${estimatedDuration.toFixed(1)} ms`,
      estimatedMs: estimatedDuration,
    };
  }

  const batchSize = Math.max(
    1,
    Math.min(10000, Math.ceil(options.sampleMs / estimatedDuration)),
  );
  const samples = [];

  for (let sample = 0; sample < options.samples; sample++) {
    const start = performance.now();
    for (let iteration = 0; iteration < batchSize; iteration++) {
      operation();
    }
    samples.push((performance.now() - start) / batchSize);
  }

  samples.sort((left, right) => left - right);
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  return {
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    meanMs: mean,
    minMs: samples[0],
    maxMs: samples[samples.length - 1],
    batchSize,
    sampleCount: samples.length,
  };
}

function predictedDuration(previous, count) {
  if (!previous) {
    return null;
  }
  if (previous.timing.skipped) {
    return Number.POSITIVE_INFINITY;
  }
  const ratio = count / previous.count;
  return previous.timing.medianMs * ratio * ratio;
}

function makeSkippedResult(scenario, count, reason) {
  return {
    scenario,
    count,
    possiblePairs: count * (count - 1) / 2,
    status: 'skipped',
    errors: [],
    skipReason: reason,
    timings: {},
  };
}

function benchmarkCase(scenario, count, options) {
  const frames = createElementFrames(
    scenario,
    count,
    options.seed,
    options.movingFrames,
  );
  const validationFrameIndexes = frames.length > 1
    ? [0, frames.length - 1]
    : [0];
  const errors = [];
  let representative = null;

  for (const frameIndex of validationFrameIndexes) {
    const built = buildTree(frames[frameIndex]);
    errors.push(...validateStorage(built.tree, frames[frameIndex], built.rejected));
    if (frameIndex === 0) {
      representative = built;
    }
  }

  const tree = representative.tree;
  const treeStats = traverseTree(tree);
  const hasCandidatePairs = supportsCandidatePairs(tree);
  let bruteIntersections = null;
  let candidateSummary = null;

  if (count <= options.oracleLimit) {
    bruteIntersections = countBruteForceIntersections(frames[0]);
  }

  if (hasCandidatePairs) {
    const structuralCandidateCount = countPotentialPairs(tree);

    if (count <= options.oracleLimit) {
      candidateSummary = collectCandidatePairs(tree);
      if (candidateSummary.candidateCount !== structuralCandidateCount) {
        errors.push(
          `candidate traversal emitted ${candidateSummary.candidateCount} pair(s), ` +
          `structural count predicted ${structuralCandidateCount}`,
        );
      }
      if (candidateSummary.duplicateCount !== 0) {
        errors.push(
          `candidate traversal emitted ${candidateSummary.duplicateCount} duplicate pair(s)`,
        );
      }

      const expected = bruteForceIntersectionSet(frames[0]);
      const comparison = comparePairSets(expected, candidateSummary.intersections);
      if (comparison.missing.length > 0) {
        errors.push(`missing intersecting pairs: ${comparison.missing.join(', ')}`);
      }
      if (comparison.unexpected.length > 0) {
        errors.push(`unexpected intersecting pairs: ${comparison.unexpected.join(', ')}`);
      }
    } else {
      candidateSummary = {
        candidateCount: structuralCandidateCount,
        duplicateCount: null,
        intersectionCount: null,
      };
    }
  }

  let buildFrame = 0;
  const buildTiming = measureOperation(() => {
    const built = buildTree(frames[buildFrame]);
    timingSink ^= built.tree.children?.length ?? 0;
    timingSink ^= built.rejected;
    buildFrame = (buildFrame + 1) % frames.length;
  }, options);

  const timings = { build: buildTiming };

  if (typeof tree.getObjectsRecursive === 'function' || typeof tree.getObjects === 'function') {
    timings.retrieve = measureOperation(() => {
      const objects = retrieveObjects(tree);
      timingSink ^= objects.length;
    }, options);
  }

  if (count <= options.oracleLimit) {
    let bruteFrame = 0;
    timings.bruteForce = measureOperation(() => {
      countBruteForceIntersections(frames[bruteFrame]);
      bruteFrame = (bruteFrame + 1) % frames.length;
    }, options);
  }

  if (hasCandidatePairs) {
    const candidateTimingAllowed = (
      options.force ||
      candidateSummary.candidateCount <= options.maxCandidates
    );
    if (candidateTimingAllowed) {
      timings.candidates = measureOperation(() => {
        candidateCounts(tree, false);
      }, options);
      timings.candidatesAndFilter = measureOperation(() => {
        candidateCounts(tree, true);
      }, options);

      let totalFrame = 0;
      timings.totalBroadPhase = measureOperation(() => {
        const built = buildTree(frames[totalFrame]);
        candidateCounts(built.tree, true);
        timingSink ^= built.rejected;
        totalFrame = (totalFrame + 1) % frames.length;
      }, options);
    } else {
      const reason = (
        `${candidateSummary.candidateCount} candidates exceed ` +
        `${options.maxCandidates} timing limit`
      );
      const skipped = { skipped: true, reason };
      timings.candidates = skipped;
      timings.candidatesAndFilter = skipped;
      timings.totalBroadPhase = skipped;
    }
  }

  return {
    scenario,
    count,
    possiblePairs: count * (count - 1) / 2,
    status: errors.length === 0 ? 'ok' : 'failed',
    errors,
    bruteIntersections,
    candidateSummary: candidateSummary
      ? {
        candidateCount: candidateSummary.candidateCount,
        duplicateCount: candidateSummary.duplicateCount,
        intersectionCount: candidateSummary.intersectionCount,
        reductionRatio: candidateSummary.candidateCount === 0
          ? null
          : (count * (count - 1) / 2) / candidateSummary.candidateCount,
      }
      : null,
    tree: treeStats,
    timings,
  };
}

function formatCount(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  return new Intl.NumberFormat('en-US').format(value);
}

function formatTiming(timing) {
  if (!timing) {
    return '—';
  }
  if (timing.skipped) {
    return 'skip';
  }
  return `${timing.medianMs.toFixed(3)}/${timing.p95Ms.toFixed(3)}`;
}

function printHumanReport(report) {
  console.log('Quadtree benchmark');
  console.log(`Commit: ${report.metadata.commit}${report.metadata.dirty ? ' (dirty)' : ''}`);
  console.log(`Branch: ${report.metadata.branch}`);
  console.log(`Runtime: ${report.metadata.node}`);
  console.log(`CPU: ${report.metadata.cpu}`);
  console.log('Times are median/p95 milliseconds. Timing values are informational.\n');

  for (const scenario of report.metadata.options.scenarios) {
    const rows = report.results
      .filter(result => result.scenario === scenario)
      .map(result => ({
        n: formatCount(result.count),
        pairs: formatCount(result.possiblePairs),
        brute: formatTiming(result.timings.bruteForce),
        build: formatTiming(result.timings.build),
        retrieve: formatTiming(result.timings.retrieve),
        candidates: result.candidateSummary
          ? formatCount(result.candidateSummary.candidateCount)
          : 'not implemented',
        candidateTime: formatTiming(result.timings.candidatesAndFilter),
        nodes: result.tree ? formatCount(result.tree.nodeCount) : '—',
        depth: result.tree?.maxDepth ?? '—',
        maxLocal: result.tree?.maxLocalObjects ?? '—',
        status: result.status === 'skipped'
          ? `skipped: ${result.skipReason}`
          : result.status,
      }));

    console.log(`Scenario: ${scenario}`);
    console.table(rows);
  }

  if (report.failures.length > 0) {
    console.error('Correctness failures:');
    for (const failure of report.failures) {
      console.error(
        `- ${failure.scenario} n=${failure.count}: ${failure.errors.join('; ')}`,
      );
    }
  }

  console.log(`Timing sink: ${timingSink}`);
}

function runBenchmark(options) {
  const report = {
    metadata: collectMetadata(options),
    results: [],
    failures: [],
  };

  for (const scenario of options.scenarios) {
    let previousBuild = null;

    for (const count of options.sizes) {
      const prediction = predictedDuration(previousBuild, count);
      if (!options.force && prediction !== null && prediction > options.maxCaseMs) {
        report.results.push(makeSkippedResult(
          scenario,
          count,
          `quadratic upper-bound prediction ${prediction.toFixed(1)} ms exceeds ` +
          `${options.maxCaseMs} ms`,
        ));
        continue;
      }

      const result = benchmarkCase(scenario, count, options);
      report.results.push(result);

      if (result.status === 'failed') {
        report.failures.push(result);
      }
      if (result.timings.build) {
        previousBuild = {
          count,
          timing: result.timings.build,
        };
      }
    }
  }

  return report;
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    const report = runBenchmark(options);
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printHumanReport(report);
    }
    if (report.failures.length > 0) {
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
