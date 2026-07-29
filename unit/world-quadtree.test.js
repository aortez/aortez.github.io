import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BENCHMARK_SCENARIOS,
  createScenario,
} from '../benchmarks/scenarios.js';
import { Ball } from '../src/scripts/ball.js';
import { quadtree } from '../src/scripts/quadtree.js';
import { vec3 } from '../src/scripts/vec3.js';
import {
  GravityImplementation,
  GravityMode,
  World,
} from '../src/scripts/world.js';

const SQUARE_CANVAS = {
  width: 1000,
  height: 1000,
};

function pairKey(left, right) {
  return left.id < right.id
    ? `${left.id}:${right.id}`
    : `${right.id}:${left.id}`;
}

function recordingBodies(source, collisions) {
  return source.map(body => ({
    id: body.id,
    center: {
      x: body.center.x,
      y: body.center.y,
    },
    r: body.r,
    collide(other) {
      collisions.add(pairKey(this, other));
    },
  }));
}

function fixedBoundsTree(bodies) {
  const tree = new quadtree(0, 0, 1, 1, {
    capacity: 3,
    maxDepth: 16,
  });
  const rejected = [];
  for (const body of bodies) {
    if (!tree.insert(body)) {
      rejected.push(body);
    }
  }
  return { tree, rejected };
}

function collisionSet(source, useQuadtree, fixedBounds = false) {
  const collisions = new Set();
  const world = new World();
  world.balls = recordingBodies(source, collisions);

  if (useQuadtree) {
    if (fixedBounds) {
      const built = fixedBoundsTree(world.balls);
      world.quadtreeRejected = built.rejected;
      world.applyBallCollisionsQuadtree(SQUARE_CANVAS, built.tree);
    } else {
      world.applyBallCollisionsQuadtree(SQUARE_CANVAS);
    }
  } else {
    world.applyBallCollisionsBruteForce();
  }

  return {
    collisions,
    rejected: world.quadtreeRejected,
    collisionStats: world.lastCollisionStats,
  };
}

function crossCollisionSet(
  ballSource,
  particleSource,
  useQuadtree,
  fixedBounds = false,
) {
  const collisions = new Set();
  const world = new World();
  world.balls = ballSource.map(item => ({
    id: `b${item.id}`,
    center: { x: item.center.x, y: item.center.y },
    r: item.r,
    is_invincible: false,
    is_moving: true,
    collide(other) {
      collisions.add(`${this.id}:${other.id}`);
    },
  }));
  world.particles = particleSource.map(item => ({
    id: `p${item.id}`,
    center: { x: item.center.x, y: item.center.y },
    r: item.r,
  }));

  if (useQuadtree) {
    let ballTree;
    let particleTree;
    if (fixedBounds) {
      const builtBalls = fixedBoundsTree(world.balls);
      const builtParticles = fixedBoundsTree(world.particles);
      ballTree = builtBalls.tree;
      particleTree = builtParticles.tree;
      world.quadtreeRejected = builtBalls.rejected;
      world.particleQuadtreeRejected = builtParticles.rejected;
    } else {
      ballTree = world.buildQuadtree(SQUARE_CANVAS);
      particleTree = world.buildParticleQuadtree(SQUARE_CANVAS);
    }
    world.applyBallParticleCollisionsQuadtree(ballTree, particleTree);
  } else {
    world.applyBallParticleCollisionsBruteForce();
  }

  return {
    collisions,
    rejectedBalls: world.quadtreeRejected,
    rejectedParticles: world.particleQuadtreeRejected,
    collisionStats: world.lastCollisionStats,
  };
}

function ball(id, x, y, radius) {
  const result = new Ball(x, y, radius, new vec3(100, 150, 200));
  result.id = id;
  result.is_affected_by_gravity = false;
  return result;
}

function physicsSnapshot(balls) {
  return balls.map(item => ({
    center: { x: item.center.x, y: item.center.y },
    velocity: { x: item.v.x, y: item.v.y },
    hp: item.hp,
  }));
}

function simulationBalls(source) {
  return source.map(item => {
    const result = ball(item.id, item.center.x, item.center.y, item.r);
    result.m = item.r * item.r;
    result.is_affected_by_gravity = true;
    return result;
  });
}

function assertGravityClose(actual, expected, tolerance = 1e-12) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index++) {
    for (const component of ['x', 'y']) {
      const difference = Math.abs(
        actual[index].v[component] - expected[index].v[component],
      );
      assert.ok(
        difference <= tolerance,
        `body ${index} velocity ${component} differed by ${difference}`,
      );
    }
  }
}

function gravityErrorProfile(theta) {
  const source = createScenario('uniform', 1000, 0xC0FFEE);
  const exactBalls = simulationBalls(source);
  const approximateBalls = simulationBalls(source);

  const exactWorld = new World();
  exactWorld.g = 1;
  exactWorld.balls = exactBalls;
  exactWorld.applyBallGravityExact();

  const approximateWorld = new World();
  approximateWorld.g = 1;
  approximateWorld.barnesHutTheta = theta;
  approximateWorld.balls = approximateBalls;
  const tree = approximateWorld.buildQuadtree(SQUARE_CANVAS);
  const stats = approximateWorld.applyBallGravityBarnesHut(tree);

  let squaredError = 0;
  let squaredReference = 0;
  const relativeErrors = [];
  for (let index = 0; index < source.length; index++) {
    const dx = approximateBalls[index].v.x - exactBalls[index].v.x;
    const dy = approximateBalls[index].v.y - exactBalls[index].v.y;
    const error = Math.hypot(dx, dy);
    const reference = Math.hypot(exactBalls[index].v.x, exactBalls[index].v.y);
    squaredError += error * error;
    squaredReference += reference * reference;
    relativeErrors.push(error / Math.max(reference, 1e-12));
  }
  relativeErrors.sort((left, right) => left - right);

  return {
    bodyCount: source.length,
    normalizedRmsError: Math.sqrt(squaredError / squaredReference),
    p95RelativeError: relativeErrors[Math.floor(source.length * 0.95)],
    stats,
  };
}

test('gravity modes explicitly configure accuracy and particle coupling', () => {
  const world = new World();
  assert.equal(world.gravityMode, GravityMode.FAST);
  assert.equal(
    world.gravityImplementation,
    GravityImplementation.FLAT,
  );
  assert.equal(world.barnesHutTheta, 0.7);
  assert.equal(world.useBallParticleGravity, false);

  assert.equal(world.setGravityMode(GravityMode.FULL), GravityMode.FULL);
  assert.equal(world.gravityMode, GravityMode.FULL);
  assert.equal(world.barnesHutTheta, 0.5);
  assert.equal(world.useBallParticleGravity, true);

  assert.equal(world.toggleGravityMode(), GravityMode.FAST);
  assert.throws(() => world.setGravityMode('unknown'), /gravity mode/i);
  assert.equal(
    world.setGravityImplementation(GravityImplementation.OPTIMIZED),
    GravityImplementation.OPTIMIZED,
  );
  assert.throws(
    () => world.setGravityImplementation('unknown'),
    /gravity implementation/i,
  );
});

test('fast mode skips cross gravity but retains indexed particle collisions', () => {
  const world = new World();
  let crossGravityCalls = 0;
  let crossCollisionCalls = 0;

  world.applyBallGravityBarnesHut = () => ({
    mode: 'barnes-hut',
    exactInteractions: 0,
    approximations: 0,
    appliedSources: 0,
    theta: world.barnesHutTheta,
  });
  world.applyBallParticleGravityBarnesHut = () => {
    crossGravityCalls++;
    return {
      mode: 'barnes-hut-cross',
      exactInteractions: 0,
      approximations: 0,
      appliedSources: 0,
      ballTargetSources: 0,
      particleTargetSources: 0,
      ballTargetMs: 0,
      particleTargetMs: 0,
    };
  };
  world.applyBallParticleCollisionsQuadtree = () => {
    crossCollisionCalls++;
    return 0;
  };

  world.advance(0, SQUARE_CANVAS);
  assert.equal(crossGravityCalls, 0);
  assert.equal(crossCollisionCalls, 1);
  assert.equal(world.lastGravityStats.particleGravityEnabled, false);

  world.setGravityMode(GravityMode.FULL);
  world.advance(0, SQUARE_CANVAS);
  assert.equal(crossGravityCalls, 1);
  assert.equal(crossCollisionCalls, 2);
  assert.equal(world.lastGravityStats.particleGravityEnabled, true);
});

test('quadtree collision broad phase matches brute force on every seeded scenario', () => {
  for (const scenario of BENCHMARK_SCENARIOS) {
    const bodies = createScenario(scenario, 120, 0xC0FFEE);
    const brute = collisionSet(bodies, false);
    const indexed = collisionSet(bodies, true);

    assert.deepEqual(
      [...indexed.collisions].sort(),
      [...brute.collisions].sort(),
      `${scenario} collision pairs differed`,
    );
    assert.equal(indexed.rejected.length, 0, `${scenario} rejected a body`);
  }
});

test('quadtree collision mode processes rejected bodies through fallback exactly once', () => {
  const source = [
    { id: 0, center: { x: 0.02, y: 0.25 }, r: 0.05 },
    { id: 1, center: { x: 0.07, y: 0.25 }, r: 0.05 },
    { id: 2, center: { x: 0.98, y: 0.75 }, r: 0.05 },
    { id: 3, center: { x: 0.93, y: 0.75 }, r: 0.05 },
  ];

  const brute = collisionSet(source, false);
  const indexed = collisionSet(source, true, true);

  assert.deepEqual([...indexed.collisions].sort(), [...brute.collisions].sort());
  assert.equal(indexed.rejected.length, 2);
  assert.deepEqual([...indexed.collisions].sort(), ['0:1', '2:3']);
  assert.equal(indexed.collisionStats.ballFallbackCandidates, 5);
});

test('cross-tree ball-particle collisions match brute force', () => {
  const balls = createScenario('uniform', 200, 123);
  const particles = createScenario('clustered', 180, 456);
  const brute = crossCollisionSet(balls, particles, false);
  const indexed = crossCollisionSet(balls, particles, true);

  assert.deepEqual(
    [...indexed.collisions].sort(),
    [...brute.collisions].sort(),
  );
  assert.equal(indexed.rejectedBalls.length, 0);
  assert.equal(indexed.rejectedParticles.length, 0);
});

test('world trees expand to index canvas-straddling bodies', () => {
  const balls = [
    { id: 0, center: { x: 0.07, y: 0.25 }, r: 0.05 },
  ];
  const particles = [
    { id: 0, center: { x: 0.02, y: 0.25 }, r: 0.05 },
  ];
  const brute = crossCollisionSet(balls, particles, false);
  const indexed = crossCollisionSet(balls, particles, true);

  assert.deepEqual([...indexed.collisions], [...brute.collisions]);
  assert.equal(indexed.rejectedParticles.length, 0);
  assert.equal(indexed.collisionStats.ballParticleFallbackCandidates, 0);
});

test('cross-tree collisions retain the fixed-bounds rejection fallback', () => {
  const balls = [
    { id: 0, center: { x: 0.07, y: 0.25 }, r: 0.05 },
  ];
  const particles = [
    { id: 0, center: { x: 0.02, y: 0.25 }, r: 0.05 },
  ];
  const brute = crossCollisionSet(balls, particles, false);
  const indexed = crossCollisionSet(balls, particles, true, true);

  assert.deepEqual([...indexed.collisions], [...brute.collisions]);
  assert.equal(indexed.rejectedParticles.length, 1);
  assert.equal(indexed.collisionStats.ballParticleFallbackCandidates, 1);
});

test('advance contains moved balls before constructing spatial indexes', () => {
  const world = new World();
  const movingBall = ball(0, 0.9, 0.5, 0.05);
  movingBall.v.x = 1;
  movingBall.is_invincible = true;
  world.balls = [movingBall];

  world.advance(0.2, SQUARE_CANVAS);

  assert.ok(movingBall.center.x + movingBall.r < 1);
  assert.equal(world.quadtreeRejected.length, 0);
  assert.equal(world.lastPhysicsBreakdown.preTreeWallCorrections, 1);
});

test('explosion processing stops after replacement ball slots are filled', () => {
  const world = new World();
  const bodyCount = 100;
  world.max_balls = bodyCount;
  world.max_particles = 0;
  world.is_paused = true;
  world.balls = Array.from({ length: bodyCount }, (_, index) => {
    const item = ball(
      index,
      0.05 + (index % 10) * 0.1,
      0.05 + Math.floor(index / 10) * 0.1,
      0.03,
    );
    item.hp = -1;
    item.is_moving = false;
    return item;
  });

  world.advance(0, SQUARE_CANVAS);

  const lifecycle = world.lastPhysicsBreakdown.lifecycle;
  assert.equal(lifecycle.removedBalls, bodyCount);
  assert.equal(lifecycle.addedBalls, bodyCount);
  assert.equal(world.balls.length, bodyCount);
  assert.ok(lifecycle.explodedBalls < bodyCount);
  assert.equal(
    lifecycle.skippedExplosions,
    bodyCount - lifecycle.explodedBalls,
  );
  assert.ok(lifecycle.generatedFragments < bodyCount * 2);
});

test('particle expiry compacts survivors without repeated array splices', () => {
  const world = new World();
  world.particles = Array.from({ length: 1000 }, (_, index) => {
    const item = ball(index, 0.5, 0.5, 0.001);
    item.hp = index % 2 === 0 ? 0 : 1;
    item.is_moving = false;
    return item;
  });

  assert.equal(world.advanceParticles(0), 500);
  assert.equal(world.particles.length, 500);
  assert.deepEqual(
    world.particles.map(item => item.id),
    Array.from({ length: 500 }, (_, index) => index * 2 + 1),
  );
});

test('a controlled two-ball collision has identical brute-force and quadtree results', () => {
  const bruteBalls = [
    ball(0, 0.44, 0.5, 0.08),
    ball(1, 0.56, 0.5, 0.08),
  ];
  bruteBalls[0].v.x = 0.01;
  bruteBalls[1].v.x = -0.01;

  const indexedBalls = [
    ball(0, 0.44, 0.5, 0.08),
    ball(1, 0.56, 0.5, 0.08),
  ];
  indexedBalls[0].v.x = 0.01;
  indexedBalls[1].v.x = -0.01;

  const bruteWorld = new World();
  bruteWorld.balls = bruteBalls;
  assert.equal(bruteWorld.applyBallCollisionsBruteForce(), 1);

  const indexedWorld = new World();
  indexedWorld.balls = indexedBalls;
  assert.equal(indexedWorld.applyBallCollisionsQuadtree(SQUARE_CANVAS), 1);

  assert.deepEqual(
    physicsSnapshot(indexedBalls),
    physicsSnapshot(bruteBalls),
  );
});

test('Barnes-Hut theta zero matches exact gravity', () => {
  const source = createScenario('uniform', 80, 0xC0FFEE);
  const exactBalls = simulationBalls(source);
  const approximateBalls = simulationBalls(source);

  const exactWorld = new World();
  exactWorld.balls = exactBalls;
  const exactStats = exactWorld.applyBallGravityExact();

  const approximateWorld = new World();
  approximateWorld.balls = approximateBalls;
  approximateWorld.barnesHutTheta = 0;
  const tree = approximateWorld.buildQuadtree(SQUARE_CANVAS);
  const approximateStats = approximateWorld.applyBallGravityBarnesHut(tree);

  assertGravityClose(approximateBalls, exactBalls);
  assert.equal(exactStats.exactInteractions, source.length * (source.length - 1) / 2);
  assert.equal(approximateStats.exactInteractions, source.length * (source.length - 1));
  assert.equal(approximateStats.approximations, 0);
});

test('specialized Barnes-Hut traversals match the reference', () => {
  for (const scenario of ['uniform', 'clustered', 'mixed']) {
    const source = createScenario(scenario, 250, 0xC0FFEE);
    const referenceBalls = simulationBalls(source);
    for (let index = 0; index < source.length; index += 11) {
      referenceBalls[index].is_affected_by_gravity = false;
    }

    const referenceWorld = new World();
    referenceWorld.balls = referenceBalls;
    referenceWorld.barnesHutTheta = 0.7;
    referenceWorld.setGravityImplementation(
      GravityImplementation.REFERENCE,
    );
    const referenceTree = referenceWorld.buildQuadtree(SQUARE_CANVAS);
    const referenceStats = referenceWorld.applyBallGravityBarnesHut(
      referenceTree,
    );

    for (const implementation of [
      GravityImplementation.OPTIMIZED,
      GravityImplementation.FLAT,
    ]) {
      const candidateBalls = simulationBalls(source);
      for (let index = 0; index < source.length; index += 11) {
        candidateBalls[index].is_affected_by_gravity = false;
      }
      const candidateWorld = new World();
      candidateWorld.balls = candidateBalls;
      candidateWorld.barnesHutTheta = 0.7;
      candidateWorld.setGravityImplementation(implementation);
      const candidateTree = candidateWorld.buildQuadtree(SQUARE_CANVAS);
      const candidateStats = candidateWorld.applyBallGravityBarnesHut(
        candidateTree,
      );

      assertGravityClose(candidateBalls, referenceBalls);
      assert.equal(
        candidateStats.exactInteractions,
        referenceStats.exactInteractions,
      );
      assert.equal(
        candidateStats.approximations,
        referenceStats.approximations,
      );
      assert.equal(
        candidateStats.appliedSources,
        referenceStats.appliedSources,
      );
    }
  }
});

test('full-mode Barnes-Hut gravity keeps the accuracy-oriented error bound', () => {
  const profile = gravityErrorProfile(0.5);
  assert.ok(
    profile.normalizedRmsError < 0.001,
    `RMS error was ${profile.normalizedRmsError}`,
  );
  assert.ok(
    profile.p95RelativeError < 0.05,
    `p95 error was ${profile.p95RelativeError}`,
  );
  assert.ok(
    profile.stats.appliedSources <
      profile.bodyCount * (profile.bodyCount - 1) * 0.25,
    `Barnes-Hut applied ${profile.stats.appliedSources} sources`,
  );
});

test('fast-mode Barnes-Hut gravity keeps its throughput-oriented error bound', () => {
  const profile = gravityErrorProfile(0.7);
  assert.ok(
    profile.normalizedRmsError < 0.001,
    `RMS error was ${profile.normalizedRmsError}`,
  );
  assert.ok(
    profile.p95RelativeError < 0.1,
    `p95 error was ${profile.p95RelativeError}`,
  );
  assert.ok(
    profile.stats.appliedSources <
      profile.bodyCount * (profile.bodyCount - 1) * 0.2,
    `Barnes-Hut applied ${profile.stats.appliedSources} sources`,
  );
});

test('specialized Barnes-Hut gravity includes rejected bodies', () => {
  const source = [
    { id: 0, center: { x: 0.02, y: 0.25 }, r: 0.05 },
    { id: 1, center: { x: 0.4, y: 0.3 }, r: 0.03 },
    { id: 2, center: { x: 0.8, y: 0.7 }, r: 0.04 },
  ];
  const exactBalls = simulationBalls(source);

  const exactWorld = new World();
  exactWorld.balls = exactBalls;
  exactWorld.applyBallGravityExact();

  for (const implementation of [
    GravityImplementation.OPTIMIZED,
    GravityImplementation.FLAT,
  ]) {
    const candidateBalls = simulationBalls(source);
    const candidateWorld = new World();
    candidateWorld.balls = candidateBalls;
    candidateWorld.barnesHutTheta = 0;
    candidateWorld.setGravityImplementation(implementation);
    const built = fixedBoundsTree(candidateWorld.balls);
    candidateWorld.quadtreeRejected = built.rejected;
    assert.equal(candidateWorld.quadtreeRejected.length, 1);
    candidateWorld.applyBallGravityBarnesHut(built.tree);

    assertGravityClose(candidateBalls, exactBalls);
  }
});

test('cross-tree Barnes-Hut theta zero matches exact ball-particle gravity', () => {
  const ballSource = createScenario('uniform', 40, 123);
  const particleSource = createScenario('mixed', 30, 456);
  const exactBalls = simulationBalls(ballSource);
  const exactParticles = simulationBalls(particleSource);
  const approximateBalls = simulationBalls(ballSource);
  const approximateParticles = simulationBalls(particleSource);

  const exactWorld = new World();
  exactWorld.balls = exactBalls;
  exactWorld.particles = exactParticles;
  const exactStats = exactWorld.applyBallParticleGravityExact();

  const approximateWorld = new World();
  approximateWorld.balls = approximateBalls;
  approximateWorld.particles = approximateParticles;
  approximateWorld.barnesHutTheta = 0;
  const ballTree = approximateWorld.buildQuadtree(SQUARE_CANVAS);
  const particleTree = approximateWorld.buildParticleQuadtree(SQUARE_CANVAS);
  const approximateStats = (
    approximateWorld.applyBallParticleGravityBarnesHut(ballTree, particleTree)
  );

  assertGravityClose(approximateBalls, exactBalls);
  assertGravityClose(approximateParticles, exactParticles);
  assert.equal(exactStats.exactInteractions, ballSource.length * particleSource.length);
  assert.equal(
    approximateStats.exactInteractions,
    ballSource.length * particleSource.length * 2,
  );
  assert.equal(approximateStats.approximations, 0);
});

test('specialized cross-tree Barnes-Hut traversals match the reference', () => {
  const ballSource = createScenario('clustered', 100, 123);
  const particleSource = createScenario('mixed', 90, 456);
  const referenceBalls = simulationBalls(ballSource);
  const referenceParticles = simulationBalls(particleSource);

  for (let index = 0; index < ballSource.length; index += 13) {
    referenceBalls[index].is_affected_by_gravity = false;
  }
  for (let index = 0; index < particleSource.length; index += 17) {
    referenceParticles[index].is_affected_by_gravity = false;
  }

  const referenceWorld = new World();
  referenceWorld.balls = referenceBalls;
  referenceWorld.particles = referenceParticles;
  referenceWorld.barnesHutTheta = 0.7;
  referenceWorld.setGravityImplementation(GravityImplementation.REFERENCE);
  const referenceBallTree = referenceWorld.buildQuadtree(SQUARE_CANVAS);
  const referenceParticleTree = referenceWorld.buildParticleQuadtree(
    SQUARE_CANVAS,
  );
  const referenceStats = referenceWorld.applyBallParticleGravityBarnesHut(
    referenceBallTree,
    referenceParticleTree,
  );

  for (const implementation of [
    GravityImplementation.OPTIMIZED,
    GravityImplementation.FLAT,
  ]) {
    const candidateBalls = simulationBalls(ballSource);
    const candidateParticles = simulationBalls(particleSource);
    for (let index = 0; index < ballSource.length; index += 13) {
      candidateBalls[index].is_affected_by_gravity = false;
    }
    for (let index = 0; index < particleSource.length; index += 17) {
      candidateParticles[index].is_affected_by_gravity = false;
    }

    const candidateWorld = new World();
    candidateWorld.balls = candidateBalls;
    candidateWorld.particles = candidateParticles;
    candidateWorld.barnesHutTheta = 0.7;
    candidateWorld.setGravityImplementation(implementation);
    const candidateBallTree = candidateWorld.buildQuadtree(SQUARE_CANVAS);
    const candidateParticleTree = candidateWorld.buildParticleQuadtree(
      SQUARE_CANVAS,
    );
    const candidateStats = (
      candidateWorld.applyBallParticleGravityBarnesHut(
        candidateBallTree,
        candidateParticleTree,
      )
    );

    assertGravityClose(candidateBalls, referenceBalls);
    assertGravityClose(candidateParticles, referenceParticles);
    assert.equal(
      candidateStats.exactInteractions,
      referenceStats.exactInteractions,
    );
    assert.equal(
      candidateStats.approximations,
      referenceStats.approximations,
    );
    assert.equal(
      candidateStats.appliedSources,
      referenceStats.appliedSources,
    );
    assert.equal(
      candidateStats.ballTargetSources,
      referenceStats.ballTargetSources,
    );
    assert.equal(
      candidateStats.particleTargetSources,
      referenceStats.particleTargetSources,
    );
  }
});

test('coincident centers do not create non-finite exact gravity state', () => {
  const world = new World();
  world.balls = [
    ball(0, 0.5, 0.5, 0.05),
    ball(1, 0.5, 0.5, 0.05),
  ];

  world.applyBallGravityExact();

  for (const item of world.balls) {
    assert.equal(Number.isFinite(item.v.x), true);
    assert.equal(Number.isFinite(item.v.y), true);
  }
});

test('drawing an existing overlay never rebuilds its quadtree', () => {
  const world = new World();
  world.shouldDrawBackground = false;
  world.showQuadtreeOverlay = true;
  world.lastQuadtree = world.buildQuadtree(SQUARE_CANVAS);
  world.buildQuadtree = () => {
    throw new Error('draw attempted to rebuild the quadtree');
  };

  const context = {
    fillRect() {},
    restore() {},
    save() {},
    strokeRect() {},
  };

  assert.doesNotThrow(() => world.draw(SQUARE_CANVAS, context));
});
