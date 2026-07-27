const DEFAULT_NODE_CAPACITY = 1024;
const DEFAULT_BODY_CAPACITY = 1024;

function validateCapacity(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer; got ${value}`);
  }
}

function grownCapacity(currentCapacity, requiredCapacity) {
  let capacity = currentCapacity;
  while (capacity < requiredCapacity) {
    capacity *= 2;
  }
  return capacity;
}

function growTypedArray(source, capacity) {
  const result = new source.constructor(capacity);
  result.set(source);
  return result;
}

/**
 * A reusable, structure-of-arrays view of an existing object quadtree.
 *
 * This deliberately leaves collision indexing on the established Quadtree.
 * It lets gravity measure contiguous node traversal independently before the
 * much larger collision-tree migration is considered.
 */
export class FlatGravityTree
{
  constructor({
    nodeCapacity = DEFAULT_NODE_CAPACITY,
    bodyCapacity = DEFAULT_BODY_CAPACITY,
  } = {}) {
    validateCapacity(nodeCapacity, 'Flat gravity node capacity');
    validateCapacity(bodyCapacity, 'Flat gravity body capacity');

    this.nodeCapacity = nodeCapacity;
    this.bodyCapacity = bodyCapacity;
    this.nodeCount = 0;
    this.bodyCount = 0;
    this.sourceTree = null;
    this.massReady = false;
    this.massTraversalMarker = 0;

    this.aggregateMass = new Float64Array(nodeCapacity);
    this.aggregateCenterX = new Float64Array(nodeCapacity);
    this.aggregateCenterY = new Float64Array(nodeCapacity);
    this.geometricCenterX = new Float64Array(nodeCapacity);
    this.geometricCenterY = new Float64Array(nodeCapacity);
    this.sizeSquared = new Float64Array(nodeCapacity);

    this.parent = new Int32Array(nodeCapacity);
    this.firstChild = new Int32Array(nodeCapacity);
    this.firstBody = new Int32Array(nodeCapacity);
    this.leafBodyCount = new Int32Array(nodeCapacity);
    this.aggregateSourceCount = new Int32Array(nodeCapacity);
    this.pathMarker = new Uint32Array(nodeCapacity);

    this.bodies = new Array(bodyCapacity);
    this.captureSourceStack = new Array(nodeCapacity);
    this.captureNodeStack = new Int32Array(nodeCapacity);
    this.traversalStack = new Int32Array(nodeCapacity);
    this.bodyGravityTotals = new Float64Array(3);
  }

  ensureNodeCapacity(requiredCapacity) {
    if (requiredCapacity <= this.nodeCapacity) {
      return;
    }

    const capacity = grownCapacity(
      this.nodeCapacity,
      requiredCapacity,
    );
    for (const field of [
      'aggregateMass',
      'aggregateCenterX',
      'aggregateCenterY',
      'geometricCenterX',
      'geometricCenterY',
      'sizeSquared',
      'parent',
      'firstChild',
      'firstBody',
      'leafBodyCount',
      'aggregateSourceCount',
      'pathMarker',
      'captureNodeStack',
      'traversalStack',
    ]) {
      this[field] = growTypedArray(this[field], capacity);
    }
    this.captureSourceStack.length = capacity;
    this.nodeCapacity = capacity;
  }

  ensureBodyCapacity(requiredCapacity) {
    if (requiredCapacity <= this.bodyCapacity) {
      return;
    }

    const capacity = grownCapacity(
      this.bodyCapacity,
      requiredCapacity,
    );
    const bodies = new Array(capacity);
    for (let index = 0; index < this.bodyCount; index++) {
      bodies[index] = this.bodies[index];
    }
    this.bodies = bodies;
    this.bodyCapacity = capacity;
  }

  reset() {
    for (let index = 0; index < this.bodyCount; index++) {
      this.bodies[index] = undefined;
    }
    this.nodeCount = 0;
    this.bodyCount = 0;
    this.sourceTree = null;
    this.massReady = false;
    this.bodyGravityTotals.fill(0);
  }

  capture(sourceTree) {
    if (!sourceTree || sourceTree.root !== sourceTree) {
      throw new Error(
        'Flat gravity capture requires an object-quadtree root',
      );
    }

    const previousBodyCount = this.bodyCount;
    this.ensureNodeCapacity(1);
    this.nodeCount = 1;
    this.bodyCount = 0;
    this.sourceTree = sourceTree;
    this.massReady = false;

    let stackLength = 1;
    this.captureSourceStack[0] = sourceTree;
    this.captureNodeStack[0] = 0;
    this.parent[0] = -1;

    while (stackLength > 0) {
      stackLength--;
      const sourceNode = this.captureSourceStack[stackLength];
      const nodeId = this.captureNodeStack[stackLength];
      this.captureSourceStack[stackLength] = undefined;
      sourceNode.gravityFlatIndex = nodeId;

      this.geometricCenterX[nodeId] = (
        sourceNode.min_x + sourceNode.max_x
      ) * 0.5;
      this.geometricCenterY[nodeId] = (
        sourceNode.min_y + sourceNode.max_y
      ) * 0.5;
      this.sizeSquared[nodeId] = sourceNode.sizeSquared;

      const children = sourceNode.children;
      if (children.length > 0) {
        if (children.length !== 4) {
          throw new Error(
            `Flat gravity expected four children; got ${children.length}`,
          );
        }

        const childStart = this.nodeCount;
        this.ensureNodeCapacity(childStart + 4);
        this.nodeCount += 4;
        this.firstChild[nodeId] = childStart;
        this.firstBody[nodeId] = -1;
        this.leafBodyCount[nodeId] = 0;

        for (let childOffset = 3; childOffset >= 0; childOffset--) {
          const childId = childStart + childOffset;
          this.parent[childId] = nodeId;
          this.captureSourceStack[stackLength] = children[childOffset];
          this.captureNodeStack[stackLength] = childId;
          stackLength++;
        }
        continue;
      }

      const objects = sourceNode.objects;
      this.ensureBodyCapacity(this.bodyCount + objects.length);
      this.firstChild[nodeId] = -1;
      this.firstBody[nodeId] = this.bodyCount;
      this.leafBodyCount[nodeId] = objects.length;
      for (let index = 0; index < objects.length; index++) {
        this.bodies[this.bodyCount++] = objects[index];
      }
    }

    for (
      let index = this.bodyCount;
      index < previousBodyCount;
      index++
    ) {
      this.bodies[index] = undefined;
    }

    return this;
  }

  calculateBodyMassProperties() {
    if (!this.sourceTree || this.nodeCount === 0) {
      throw new Error(
        'Flat gravity mass properties require a captured quadtree',
      );
    }

    for (let nodeId = this.nodeCount - 1; nodeId >= 0; nodeId--) {
      let mass = 0;
      let weightedX = 0;
      let weightedY = 0;
      let sourceCount = 0;
      const childStart = this.firstChild[nodeId];

      if (childStart === -1) {
        const bodyStart = this.firstBody[nodeId];
        const bodyEnd = bodyStart + this.leafBodyCount[nodeId];
        for (let bodyIndex = bodyStart; bodyIndex < bodyEnd; bodyIndex++) {
          const body = this.bodies[bodyIndex];
          const bodyMass = body.is_affected_by_gravity ? body.m : 0;
          if (!Number.isFinite(bodyMass) || bodyMass < 0) {
            throw new Error(
              `Flat gravity body mass must be finite and non-negative; ` +
              `got ${bodyMass}`,
            );
          }
          if (bodyMass === 0) {
            continue;
          }
          mass += bodyMass;
          weightedX += body.center.x * bodyMass;
          weightedY += body.center.y * bodyMass;
          sourceCount++;
        }
      } else {
        for (let childOffset = 0; childOffset < 4; childOffset++) {
          const childId = childStart + childOffset;
          const childMass = this.aggregateMass[childId];
          if (childMass === 0) {
            continue;
          }
          mass += childMass;
          weightedX += this.aggregateCenterX[childId] * childMass;
          weightedY += this.aggregateCenterY[childId] * childMass;
          sourceCount += this.aggregateSourceCount[childId];
        }
      }

      this.aggregateMass[nodeId] = mass;
      this.aggregateSourceCount[nodeId] = sourceCount;
      this.aggregateCenterX[nodeId] = mass === 0
        ? this.geometricCenterX[nodeId]
        : weightedX / mass;
      this.aggregateCenterY[nodeId] = mass === 0
        ? this.geometricCenterY[nodeId]
        : weightedY / mass;
    }

    this.massReady = true;
    return this;
  }

  resetBodyGravityTotals() {
    this.bodyGravityTotals.fill(0);
  }

  applyBodyMassAcceleration(
    target,
    thetaSquared,
    softeningSquared,
    gravityScale,
  ) {
    let marker = (this.massTraversalMarker + 1) >>> 0;
    if (marker === 0) {
      this.pathMarker.fill(0, 0, this.nodeCount);
      marker = 1;
    }
    this.massTraversalMarker = marker;

    const sourceLeaf = this.sourceTree.elementLeaves.get(target);
    let targetNodeId = sourceLeaf?.gravityFlatIndex ?? -1;
    while (targetNodeId >= 0) {
      this.pathMarker[targetNodeId] = marker;
      targetNodeId = this.parent[targetNodeId];
    }

    const targetX = target.center.x;
    const targetY = target.center.y;
    const stack = this.traversalStack;
    let stackLength = 1;
    stack[0] = 0;

    const aggregateMass = this.aggregateMass;
    const aggregateCenterX = this.aggregateCenterX;
    const aggregateCenterY = this.aggregateCenterY;
    const sizeSquared = this.sizeSquared;
    const firstChild = this.firstChild;
    const firstBody = this.firstBody;
    const leafBodyCount = this.leafBodyCount;
    const pathMarker = this.pathMarker;
    const bodies = this.bodies;

    let accelerationX = 0;
    let accelerationY = 0;
    let approximationCount = 0;
    let exactSourceCount = 0;
    let appliedSourceCount = 0;

    while (stackLength > 0) {
      const nodeId = stack[--stackLength];
      const nodeMass = aggregateMass[nodeId];
      if (nodeMass === 0) {
        continue;
      }

      const childStart = firstChild[nodeId];
      if (childStart === -1) {
        const bodyStart = firstBody[nodeId];
        const bodyEnd = bodyStart + leafBodyCount[nodeId];
        for (let bodyIndex = bodyStart; bodyIndex < bodyEnd; bodyIndex++) {
          const source = bodies[bodyIndex];
          if (source === target || !source.is_affected_by_gravity) {
            continue;
          }
          const sourceMass = source.m;
          if (sourceMass === 0) {
            continue;
          }
          exactSourceCount++;

          const dx = source.center.x - targetX;
          const dy = source.center.y - targetY;
          if (dx === 0 && dy === 0) {
            continue;
          }
          const distanceSquared = (
            dx * dx +
            dy * dy +
            softeningSquared
          );
          const inverseDistance = 1 / Math.sqrt(distanceSquared);
          const scale = sourceMass * inverseDistance / distanceSquared;
          accelerationX += dx * scale;
          accelerationY += dy * scale;
          appliedSourceCount++;
        }
        continue;
      }

      const dx = aggregateCenterX[nodeId] - targetX;
      const dy = aggregateCenterY[nodeId] - targetY;
      const distanceSquaredWithoutSoftening = dx * dx + dy * dy;
      if (
        pathMarker[nodeId] !== marker &&
        distanceSquaredWithoutSoftening > 0 &&
        sizeSquared[nodeId] < (
          thetaSquared * distanceSquaredWithoutSoftening
        )
      ) {
        const distanceSquared = (
          distanceSquaredWithoutSoftening +
          softeningSquared
        );
        const inverseDistance = 1 / Math.sqrt(distanceSquared);
        const scale = (
          nodeMass *
          inverseDistance /
          distanceSquared
        );
        accelerationX += dx * scale;
        accelerationY += dy * scale;
        approximationCount++;
        appliedSourceCount++;
        continue;
      }

      stack[stackLength++] = childStart + 3;
      stack[stackLength++] = childStart + 2;
      stack[stackLength++] = childStart + 1;
      stack[stackLength++] = childStart;
    }

    target.v.x += accelerationX * gravityScale;
    target.v.y += accelerationY * gravityScale;
    this.bodyGravityTotals[0] += exactSourceCount;
    this.bodyGravityTotals[1] += approximationCount;
    this.bodyGravityTotals[2] += appliedSourceCount;
  }

  getStats() {
    return {
      nodeCount: this.nodeCount,
      bodyCount: this.bodyCount,
      nodeCapacity: this.nodeCapacity,
      bodyCapacity: this.bodyCapacity,
    };
  }
}
