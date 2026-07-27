import assert from 'node:assert/strict';
import test from 'node:test';

import { Quadtree } from '../src/scripts/quadtree.js';
import {
  advanceBodies,
  BENCHMARK_SCENARIOS,
  createScenario,
} from '../benchmarks/scenarios.js';

function body(id, x, y, radius) {
  return {
    id,
    center: { x, y },
    r: radius,
  };
}

function intersects(left, right) {
  const dx = left.center.x - right.center.x;
  const dy = left.center.y - right.center.y;
  const radius = left.r + right.r;
  return dx * dx + dy * dy < radius * radius;
}

function pairKey(left, right) {
  return left.id < right.id
    ? `${left.id}:${right.id}`
    : `${right.id}:${left.id}`;
}

function bruteForceIntersections(bodies) {
  const pairs = new Set();
  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < bodies.length; rightIndex++) {
      const left = bodies[leftIndex];
      const right = bodies[rightIndex];
      if (intersects(left, right)) {
        pairs.add(pairKey(left, right));
      }
    }
  }
  return pairs;
}

function quadtreePairs(tree) {
  const candidates = new Set();
  const intersections = new Set();
  const duplicates = [];

  tree.forEachPotentialPair((left, right) => {
    const key = pairKey(left, right);
    if (candidates.has(key)) {
      duplicates.push(key);
    }
    candidates.add(key);
    if (intersects(left, right)) {
      intersections.add(key);
    }
  });

  return { candidates, intersections, duplicates };
}

function assertSameSet(actual, expected, message) {
  assert.deepEqual(
    [...actual].sort(),
    [...expected].sort(),
    message,
  );
}

test('validates bounds and options', () => {
  assert.throws(
    () => new Quadtree(1, 0, 0, 1),
    /bounds/i,
  );
  assert.throws(
    () => new Quadtree(0, 0, 1, Number.NaN),
    /finite/i,
  );
  assert.throws(
    () => new Quadtree(0, 0, 1, 1, { capacity: 0 }),
    /capacity/i,
  );
  assert.throws(
    () => new Quadtree(0, 0, 1, 1, { capacity: 1.5 }),
    /capacity/i,
  );
  assert.throws(
    () => new Quadtree(0, 0, 1, 1, { maxDepth: -1 }),
    /depth/i,
  );
});

test('accepts every outer-edge tangent and explicitly rejects out-of-bounds bodies', () => {
  const tree = new Quadtree(0, 0, 1, 1, { capacity: 2 });
  const tangentBodies = [
    body(0, 0.1, 0.5, 0.1),
    body(1, 0.9, 0.5, 0.1),
    body(2, 0.5, 0.1, 0.1),
    body(3, 0.5, 0.9, 0.1),
  ];

  for (const element of tangentBodies) {
    assert.equal(tree.fitsInside(element), true);
    assert.equal(tree.insert(element), true);
  }

  const outside = body(4, 0.95, 0.5, 0.1);
  assert.equal(tree.fitsInside(outside), false);
  assert.equal(tree.insert(outside), false);
  assert.equal(tree.getObjectsRecursive().length, tangentBodies.length);
});

test('rejects malformed elements without mutating the tree', () => {
  const tree = new Quadtree(0, 0, 1, 1);
  const malformed = [
    null,
    {},
    { center: { x: 0.5, y: 0.5 }, r: -1 },
    { center: { x: Number.NaN, y: 0.5 }, r: 0.1 },
    { center: { x: 0.5, y: Number.POSITIVE_INFINITY }, r: 0.1 },
  ];

  for (const element of malformed) {
    assert.throws(() => tree.insert(element), /element|center|radius|finite/i);
  }
  assert.equal(tree.getObjectsRecursive().length, 0);
});

test('rejects inserting the same object reference twice', () => {
  const tree = new Quadtree(0, 0, 1, 1);
  const element = body(0, 0.5, 0.5, 0.1);

  assert.equal(tree.insert(element), true);
  assert.throws(() => tree.insert(element), /already inserted/i);
  assert.equal(tree.getObjectsRecursive().length, 1);
});

test('subdivides bodies by center even when their radius crosses a split', () => {
  const tree = new Quadtree(0, 0, 1, 1, {
    capacity: 1,
    maxDepth: 8,
  });
  const quadrants = [
    body(0, 0.25, 0.25, 0.05),
    body(1, 0.25, 0.75, 0.05),
    body(2, 0.75, 0.25, 0.05),
    body(3, 0.75, 0.75, 0.05),
  ];

  for (const element of quadrants) {
    assert.equal(tree.insert(element), true);
  }

  assert.equal(tree.children.length, 4);
  assert.equal(tree.objects.length, 0);
  assert.deepEqual(
    tree.children.map(child => child.getObjectsRecursive().length),
    [1, 1, 1, 1],
  );

  const crossing = body(4, 0.5, 0.25, 0.1);
  assert.equal(tree.insert(crossing), true);
  assert.equal(tree.objects.length, 0);
  assert.equal(
    tree.children[2].getObjectsRecursive().includes(crossing),
    true,
  );
});

test('bounded depth safely stores coincident zero-radius elements', () => {
  const tree = new Quadtree(0, 0, 1, 1, {
    capacity: 1,
    maxDepth: 4,
  });
  const elements = Array.from(
    { length: 100 },
    (_, id) => body(id, 0.371, 0.619, 0),
  );

  for (const element of elements) {
    assert.equal(tree.insert(element), true);
  }

  const stats = tree.getStats();
  assert.equal(stats.storedObjects, elements.length);
  assert.equal(stats.maxDepth, 4);
  assert.equal(stats.maxLocalObjects, elements.length);
});

test('recursive retrieval returns a copy and never exposes a mutable internal array', () => {
  const tree = new Quadtree(0, 0, 1, 1, { capacity: 1 });
  tree.insert(body(0, 0.25, 0.25, 0.01));
  tree.insert(body(1, 0.75, 0.75, 0.01));

  const first = tree.getObjectsRecursive();
  first.length = 0;
  const second = tree.getObjectsRecursive();

  assert.equal(second.length, 2);
  assert.notEqual(first, second);
});

test('enumerates spatially compatible leaf pairs exactly once', () => {
  const tree = new Quadtree(0, 0, 1, 1, {
    capacity: 1,
    maxDepth: 8,
  });
  const elements = [
    body(0, 0.5, 0.25, 0.12),
    body(1, 0.45, 0.25, 0.02),
    body(2, 0.25, 0.25, 0.03),
    body(3, 0.28, 0.25, 0.03),
    body(4, 0.75, 0.75, 0.02),
  ];

  for (const element of elements) {
    tree.insert(element);
  }

  const actual = quadtreePairs(tree);
  assert.deepEqual(actual.duplicates, []);
  assert.equal(tree.countPotentialPairs(), actual.candidates.size);
  assertSameSet(
    actual.intersections,
    bruteForceIntersections(elements),
    'candidate traversal must contain every exact intersection',
  );
});

test('enumerates cross-tree intersections without duplicate pairs', () => {
  const leftBodies = createScenario('uniform', 200, 123);
  const rightBodies = createScenario('mixed', 180, 456);
  const leftTree = new Quadtree(0, 0, 1, 1, {
    capacity: 3,
    maxDepth: 16,
  });
  const rightTree = new Quadtree(0, 0, 1, 1, {
    capacity: 3,
    maxDepth: 16,
  });
  for (const element of leftBodies) {
    leftTree.insert(element);
  }
  for (const element of rightBodies) {
    rightTree.insert(element);
  }

  const expected = new Set();
  for (const left of leftBodies) {
    for (const right of rightBodies) {
      if (intersects(left, right)) {
        expected.add(`${left.id}:${right.id}`);
      }
    }
  }

  const candidates = new Set();
  const actual = new Set();
  let duplicates = 0;
  const emittedCount = leftTree.forEachPotentialPairBetween(
    rightTree,
    (left, right) => {
      const key = `${left.id}:${right.id}`;
      if (candidates.has(key)) {
        duplicates++;
      }
      candidates.add(key);
      if (intersects(left, right)) {
        actual.add(key);
      }
    },
  );

  assert.equal(duplicates, 0);
  assert.equal(emittedCount, candidates.size);
  assert.equal(leftTree.countPotentialPairsBetween(rightTree), candidates.size);
  assertSameSet(actual, expected, 'cross-tree traversal missed an intersection');
});

test('seeded scenarios match brute-force intersections without duplicate pairs', () => {
  const seeds = [0xC0FFEE, 1, 0xDEADBEEF, 0x12345678];

  for (const seed of seeds) {
    for (const scenario of BENCHMARK_SCENARIOS) {
      const bodies = createScenario(scenario, 120, seed);
      const frameCount = scenario === 'moving' ? 12 : 1;

      for (let frame = 0; frame < frameCount; frame++) {
        const tree = new Quadtree(0, 0, 1, 1, {
          capacity: 4,
          maxDepth: 16,
        });
        for (const element of bodies) {
          assert.equal(
            tree.insert(element),
            true,
            `${scenario} seed ${seed} frame ${frame} rejected body ${element.id}`,
          );
        }

        const actual = quadtreePairs(tree);
        assert.deepEqual(
          actual.duplicates,
          [],
          `${scenario} seed ${seed} frame ${frame} emitted duplicate candidates`,
        );
        assertSameSet(
          actual.intersections,
          bruteForceIntersections(bodies),
          `${scenario} seed ${seed} frame ${frame} differed from brute force`,
        );
        assert.equal(tree.getStats().storedObjects, bodies.length);

        advanceBodies(bodies, 1);
      }
    }
  }
});

test('representative 10,000-body layouts retain a linear-sized candidate set', () => {
  for (const scenario of ['grid', 'jittered', 'uniform', 'mixed']) {
    const bodies = createScenario(scenario, 10000, 0xC0FFEE);
    const tree = new Quadtree(0, 0, 1, 1, {
      capacity: 3,
      maxDepth: 16,
    });

    for (const element of bodies) {
      assert.equal(tree.insert(element), true);
    }

    const candidates = tree.countPotentialPairs();
    assert.ok(
      candidates <= bodies.length * 20,
      `${scenario} emitted ${candidates} candidates for ${bodies.length} bodies`,
    );
  }
});

test('calculates aggregate mass and center of mass without mutating bodies', () => {
  const elements = [
    { ...body(0, 0.2, 0.3, 0.01), m: 2 },
    { ...body(1, 0.8, 0.7, 0.01), m: 6 },
    { ...body(2, 0.4, 0.4, 0.01), m: 0 },
  ];
  const before = JSON.stringify(elements);
  const tree = new Quadtree(0, 0, 1, 1, { capacity: 1 });
  for (const element of elements) {
    tree.insert(element);
  }

  const aggregate = tree.calculateMassProperties();

  assert.equal(aggregate.mass, 8);
  assert.ok(Math.abs(aggregate.centerX - 0.65) < 1e-12);
  assert.ok(Math.abs(aggregate.centerY - 0.6) < 1e-12);
  assert.equal(aggregate.sourceCount, 2);
  assert.equal(JSON.stringify(elements), before);
});

test('theta zero emits every other positive-mass body as an exact source', () => {
  const elements = [
    { ...body(0, 0.2, 0.2, 0.01), m: 1 },
    { ...body(1, 0.8, 0.2, 0.01), m: 2 },
    { ...body(2, 0.2, 0.8, 0.01), m: 3 },
    { ...body(3, 0.8, 0.8, 0.01), m: 0 },
  ];
  const tree = new Quadtree(0, 0, 1, 1, { capacity: 1 });
  for (const element of elements) {
    tree.insert(element);
  }
  tree.calculateMassProperties();

  const sourceIds = [];
  const stats = tree.forEachMassInteraction(
    elements[0],
    0,
    (mass, x, y, source) => {
      assert.ok(mass > 0);
      assert.ok(Number.isFinite(x));
      assert.ok(Number.isFinite(y));
      assert.notEqual(source, null);
      sourceIds.push(source.id);
    },
  );

  assert.deepEqual(sourceIds.sort((left, right) => left - right), [1, 2]);
  assert.deepEqual(stats, { approximations: 0, exactSources: 2 });
});

test('construction and pair traversal do not mutate indexed bodies', () => {
  const bodies = createScenario('clustered', 100, 1234);
  const before = JSON.stringify(bodies);
  const tree = new Quadtree(0, 0, 1, 1, {
    capacity: 3,
    maxDepth: 16,
  });

  for (const element of bodies) {
    tree.insert(element);
  }
  tree.forEachPotentialPair(() => {});

  assert.equal(JSON.stringify(bodies), before);
});

test('requires a callback for potential-pair traversal', () => {
  const tree = new Quadtree(0, 0, 1, 1);
  assert.throws(() => tree.forEachPotentialPair(null), /callback/i);
});
