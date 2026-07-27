import assert from 'node:assert/strict';
import test from 'node:test';

import { FlatGravityTree } from '../src/scripts/flat-gravity-tree.js';
import { quadtree } from '../src/scripts/quadtree.js';

function body(id, x, y, mass, affected = true) {
  return {
    id,
    center: { x, y },
    r: 0.01,
    m: mass,
    is_affected_by_gravity: affected,
    v: { x: 0, y: 0 },
  };
}

function treeWithBodies(bodies) {
  const tree = new quadtree(0, 0, 1, 1, {
    capacity: 1,
    maxDepth: 8,
  });
  for (const item of bodies) {
    assert.equal(tree.insert(item), true);
  }
  return tree;
}

test('flat gravity capture preserves tree and mass structure', () => {
  const bodies = [
    body(0, 0.1, 0.1, 2),
    body(1, 0.2, 0.2, 3),
    body(2, 0.8, 0.8, 5),
    body(3, 0.9, 0.1, 7, false),
  ];
  const tree = treeWithBodies(bodies);
  const reference = tree.calculateMassProperties(item => (
    item.is_affected_by_gravity ? item.m : 0
  ));
  const flat = new FlatGravityTree({
    nodeCapacity: 1,
    bodyCapacity: 1,
  });

  flat.capture(tree);
  flat.calculateBodyMassProperties();
  const capture = flat.getStats();
  const aggregate = {
    mass: flat.aggregateMass[0],
    centerX: flat.aggregateCenterX[0],
    centerY: flat.aggregateCenterY[0],
    sourceCount: flat.aggregateSourceCount[0],
  };

  assert.equal(capture.nodeCount, tree.getStats().nodeCount);
  assert.equal(capture.bodyCount, bodies.length);
  assert.ok(capture.nodeCapacity >= capture.nodeCount);
  assert.ok(capture.bodyCapacity >= capture.bodyCount);
  assert.deepEqual(aggregate, reference);
});

test('flat gravity storage reuses capacity and releases stale body references', () => {
  const largerBodies = Array.from({ length: 20 }, (_, index) => (
    body(
      index,
      0.05 + (index % 5) * 0.2,
      0.05 + Math.floor(index / 5) * 0.2,
      index + 1,
    )
  ));
  const smallerBodies = [body(100, 0.25, 0.25, 1)];
  const flat = new FlatGravityTree({
    nodeCapacity: 1,
    bodyCapacity: 1,
  });

  flat.capture(treeWithBodies(largerBodies));
  const nodeCapacity = flat.nodeCapacity;
  const bodyCapacity = flat.bodyCapacity;

  flat.capture(treeWithBodies(smallerBodies));

  assert.equal(flat.nodeCapacity, nodeCapacity);
  assert.equal(flat.bodyCapacity, bodyCapacity);
  assert.equal(flat.nodeCount, 1);
  assert.equal(flat.bodyCount, 1);
  assert.equal(flat.bodies[0], smallerBodies[0]);
  assert.equal(
    flat.bodies
      .slice(flat.bodyCount)
      .every(item => item === undefined),
    true,
  );

  flat.reset();
  assert.equal(flat.nodeCount, 0);
  assert.equal(flat.bodyCount, 0);
  assert.equal(flat.sourceTree, null);
  assert.equal(flat.bodies.every(item => item === undefined), true);
});
