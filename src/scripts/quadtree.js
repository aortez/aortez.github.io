export let debug_on = false;

export function setDebugOn(value) {
  debug_on = Boolean(value);
}

class Point
{
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  toString() {
    return `(${this.x}, ${this.y})`;
  }
}

export class QuadtreeElement
{
  constructor(x, y, radius) {
    this.center = new Point(x, y);
    this.r = radius;
  }

  toS() {
    return `quadtreeElement(${this.center.x}, ${this.center.y}, ${this.r})`;
  }
}

function validatePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer; got ${value}`);
  }
}

function validateNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer; got ${value}`);
  }
}

function normalizeOptions(options) {
  if (typeof options === 'number') {
    return {
      capacity: options,
      maxDepth: 16,
      depth: 0,
      root: null,
      parent: null,
    };
  }
  if (options === undefined) {
    return {
      capacity: 3,
      maxDepth: 16,
      depth: 0,
      root: null,
      parent: null,
    };
  }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Quadtree options must be an object or a numeric capacity');
  }

  return {
    capacity: options.capacity ?? 3,
    maxDepth: options.maxDepth ?? 16,
    depth: options.depth ?? 0,
    root: options._root ?? null,
    parent: options._parent ?? null,
  };
}

function validateElement(element) {
  if (element === null || typeof element !== 'object') {
    throw new Error('Quadtree element must be an object');
  }
  if (element.center === null || typeof element.center !== 'object') {
    throw new Error('Quadtree element center must be an object');
  }
  if (!Number.isFinite(element.center.x) || !Number.isFinite(element.center.y)) {
    throw new Error('Quadtree element center coordinates must be finite');
  }
  if (!Number.isFinite(element.r) || element.r < 0) {
    throw new Error('Quadtree element radius must be finite and non-negative');
  }
}

function describeElement(element) {
  if (typeof element.toS === 'function') {
    return element.toS();
  }
  const id = element.id === undefined ? '' : ` id=${element.id}`;
  return `element(${element.center.x}, ${element.center.y}, r=${element.r}${id})`;
}

export class Quadtree
{
  constructor(minX, minY, maxX, maxY, options) {
    const bounds = [minX, minY, maxX, maxY];
    if (!bounds.every(Number.isFinite)) {
      throw new Error('Quadtree bounds must be finite numbers');
    }
    if (minX >= maxX || minY >= maxY) {
      throw new Error(
        `Quadtree bounds must have positive area; got ` +
        `x[${minX}, ${maxX}], y[${minY}, ${maxY}]`,
      );
    }

    const normalized = normalizeOptions(options);
    validatePositiveInteger(normalized.capacity, 'Quadtree capacity');
    validateNonNegativeInteger(normalized.maxDepth, 'Quadtree max depth');
    validateNonNegativeInteger(normalized.depth, 'Quadtree depth');
    if (normalized.depth > normalized.maxDepth) {
      throw new Error(
        `Quadtree depth ${normalized.depth} cannot exceed max depth ` +
        `${normalized.maxDepth}`,
      );
    }

    this.min_x = minX;
    this.min_y = minY;
    this.max_x = maxX;
    this.max_y = maxY;
    this.max_local_objects = normalized.capacity;
    this.maxDepth = normalized.maxDepth;
    this.depth = normalized.depth;
    this.objects = [];
    this.children = [];
    this.splitBlocked = false;
    this.maxRadius = 0;
    this.sizeSquared = Math.max(maxX - minX, maxY - minY) ** 2;
    this.subtreeObjectCount = 0;
    this.aggregateMass = 0;
    this.aggregateCenterX = this.centerX();
    this.aggregateCenterY = this.centerY();
    this.aggregateSourceCount = 0;
    this.massPathMarker = 0;
    this.parent = normalized.parent;
    this.root = normalized.root ?? this;
    if (this.root === this) {
      this.insertedElements = new WeakSet();
      this.elementLeaves = new WeakMap();
      this.massTraversalMarker = 0;
      this.massTraversalStack = [];
      this.massAccessor = null;
    }
  }

  centerX() {
    return (this.min_x + this.max_x) * 0.5;
  }

  centerY() {
    return (this.min_y + this.max_y) * 0.5;
  }

  hasChildren() {
    return this.children.length > 0;
  }

  hasObjects() {
    return this.objects.length > 0;
  }

  fitsInside(element) {
    validateElement(element);
    return this._fitsInside(element);
  }

  _fitsInside(element) {
    return (
      element.center.x - element.r >= this.min_x &&
      element.center.x + element.r <= this.max_x &&
      element.center.y - element.r >= this.min_y &&
      element.center.y + element.r <= this.max_y
    );
  }

  insert(element) {
    validateElement(element);
    if (this !== this.root) {
      throw new Error('Quadtree elements must be inserted through the root node');
    }
    if (!this._fitsInside(element)) {
      return false;
    }
    if (this.insertedElements.has(element)) {
      throw new Error('Quadtree element is already inserted');
    }

    this.insertedElements.add(element);
    this._insertByCenter(element);
    return true;
  }

  _insertByCenter(element) {
    this.subtreeObjectCount++;
    this.maxRadius = Math.max(this.maxRadius, element.r);

    if (this.hasChildren()) {
      this._childForCenter(element)._insertByCenter(element);
      return;
    }

    this.objects.push(element);
    this.root.elementLeaves.set(element, this);
    if (
      this.objects.length > this.max_local_objects &&
      this.depth < this.maxDepth &&
      !this.splitBlocked
    ) {
      this.split();
    }
  }

  _childForCenter(element) {
    const rightOffset = element.center.x >= this.centerX() ? 2 : 0;
    const bottomOffset = element.center.y >= this.centerY() ? 1 : 0;
    return this.children[rightOffset + bottomOffset];
  }

  split() {
    if (this.hasChildren()) {
      throw new Error('A quadtree node can only be split once');
    }
    if (this.depth >= this.maxDepth) {
      this.splitBlocked = true;
      return false;
    }

    const centerX = this.centerX();
    const centerY = this.centerY();
    if (
      centerX <= this.min_x ||
      centerX >= this.max_x ||
      centerY <= this.min_y ||
      centerY >= this.max_y
    ) {
      this.splitBlocked = true;
      return false;
    }

    const childOptions = {
      capacity: this.max_local_objects,
      maxDepth: this.maxDepth,
      depth: this.depth + 1,
      _root: this.root,
      _parent: this,
    };
    this.children = [
      new Quadtree(
        this.min_x,
        this.min_y,
        centerX,
        centerY,
        childOptions,
      ),
      new Quadtree(
        this.min_x,
        centerY,
        centerX,
        this.max_y,
        childOptions,
      ),
      new Quadtree(
        centerX,
        this.min_y,
        this.max_x,
        centerY,
        childOptions,
      ),
      new Quadtree(
        centerX,
        centerY,
        this.max_x,
        this.max_y,
        childOptions,
      ),
    ];

    const previousObjects = this.objects;
    this.objects = [];
    for (const element of previousObjects) {
      this._childForCenter(element)._insertByCenter(element);
    }
    return true;
  }

  getObjectsRecursive() {
    const objects = [...this.objects];
    for (const child of this.children) {
      objects.push(...child.getObjectsRecursive());
    }
    return objects;
  }

  _boundsDistanceSquared(other) {
    const dx = this.max_x < other.min_x
      ? other.min_x - this.max_x
      : other.max_x < this.min_x
        ? this.min_x - other.max_x
        : 0;
    const dy = this.max_y < other.min_y
      ? other.min_y - this.max_y
      : other.max_y < this.min_y
        ? this.min_y - other.max_y
        : 0;
    return dx * dx + dy * dy;
  }

  _couldOverlapNode(other) {
    if (this.subtreeObjectCount === 0 || other.subtreeObjectCount === 0) {
      return false;
    }
    const radius = this.maxRadius + other.maxRadius;
    return this._boundsDistanceSquared(other) <= radius * radius;
  }

  _area() {
    return (this.max_x - this.min_x) * (this.max_y - this.min_y);
  }

  _visitPotentialLeafPairs(onSameLeaf, onCrossLeaf) {
    const visitCross = (left, right) => {
      if (!left._couldOverlapNode(right)) {
        return;
      }

      const leftIsLeaf = !left.hasChildren();
      const rightIsLeaf = !right.hasChildren();
      if (leftIsLeaf && rightIsLeaf) {
        onCrossLeaf(left, right);
        return;
      }

      const splitLeft = (
        !leftIsLeaf &&
        (rightIsLeaf || left._area() >= right._area())
      );
      if (splitLeft) {
        for (const child of left.children) {
          visitCross(child, right);
        }
      } else {
        for (const child of right.children) {
          visitCross(left, child);
        }
      }
    };

    const visitSame = node => {
      if (node.subtreeObjectCount < 2) {
        return;
      }
      if (!node.hasChildren()) {
        onSameLeaf(node);
        return;
      }

      for (const child of node.children) {
        visitSame(child);
      }
      for (let leftIndex = 0; leftIndex < node.children.length; leftIndex++) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < node.children.length;
          rightIndex++
        ) {
          visitCross(
            node.children[leftIndex],
            node.children[rightIndex],
          );
        }
      }
    };

    visitSame(this);
  }

  _visitCrossTreeLeafPairs(other, onCrossLeaf) {
    const visitCross = (left, right) => {
      if (!left._couldOverlapNode(right)) {
        return;
      }

      const leftIsLeaf = !left.hasChildren();
      const rightIsLeaf = !right.hasChildren();
      if (leftIsLeaf && rightIsLeaf) {
        onCrossLeaf(left, right);
        return;
      }

      const splitLeft = (
        !leftIsLeaf &&
        (rightIsLeaf || left._area() >= right._area())
      );
      if (splitLeft) {
        for (const child of left.children) {
          visitCross(child, right);
        }
      } else {
        for (const child of right.children) {
          visitCross(left, child);
        }
      }
    };

    visitCross(this, other);
  }

  forEachPotentialPair(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Quadtree potential-pair callback must be a function');
    }

    let pairCount = 0;
    this._visitPotentialLeafPairs(
      leaf => {
        for (
          let leftIndex = 0;
          leftIndex < leaf.objects.length;
          leftIndex++
        ) {
          for (
            let rightIndex = leftIndex + 1;
            rightIndex < leaf.objects.length;
            rightIndex++
          ) {
            callback(leaf.objects[leftIndex], leaf.objects[rightIndex]);
            pairCount++;
          }
        }
      },
      (leftLeaf, rightLeaf) => {
        for (const left of leftLeaf.objects) {
          for (const right of rightLeaf.objects) {
            callback(left, right);
            pairCount++;
          }
        }
      },
    );
    return pairCount;
  }

  countPotentialPairs() {
    let pairCount = 0;
    this._visitPotentialLeafPairs(
      leaf => {
        pairCount += leaf.objects.length * (leaf.objects.length - 1) / 2;
      },
      (leftLeaf, rightLeaf) => {
        pairCount += leftLeaf.objects.length * rightLeaf.objects.length;
      },
    );
    return pairCount;
  }

  forEachPotentialPairBetween(other, callback) {
    if (!(other instanceof Quadtree)) {
      throw new Error('Quadtree cross-pair traversal requires another quadtree');
    }
    if (other.root === this.root) {
      throw new Error('Use forEachPotentialPair for pairs within one quadtree');
    }
    if (typeof callback !== 'function') {
      throw new Error('Quadtree cross-pair callback must be a function');
    }

    let pairCount = 0;
    this._visitCrossTreeLeafPairs(other, (leftLeaf, rightLeaf) => {
      for (const left of leftLeaf.objects) {
        for (const right of rightLeaf.objects) {
          callback(left, right);
          pairCount++;
        }
      }
    });
    return pairCount;
  }

  countPotentialPairsBetween(other) {
    if (!(other instanceof Quadtree)) {
      throw new Error('Quadtree cross-pair count requires another quadtree');
    }
    if (other.root === this.root) {
      throw new Error('Use countPotentialPairs for pairs within one quadtree');
    }

    let pairCount = 0;
    this._visitCrossTreeLeafPairs(other, (leftLeaf, rightLeaf) => {
      pairCount += leftLeaf.objects.length * rightLeaf.objects.length;
    });
    return pairCount;
  }

  calculateMassProperties(massAccessor = element => element.m) {
    if (this !== this.root) {
      throw new Error('Quadtree mass properties must be calculated from the root');
    }
    if (typeof massAccessor !== 'function') {
      throw new Error('Quadtree mass accessor must be a function');
    }

    this.massAccessor = massAccessor;

    const visit = node => {
      let mass = 0;
      let weightedX = 0;
      let weightedY = 0;
      let sourceCount = 0;

      for (const element of node.objects) {
        const elementMass = massAccessor(element);
        if (!Number.isFinite(elementMass) || elementMass < 0) {
          throw new Error(
            `Quadtree element mass must be finite and non-negative; ` +
            `got ${elementMass}`,
          );
        }
        if (elementMass === 0) {
          continue;
        }
        mass += elementMass;
        weightedX += element.center.x * elementMass;
        weightedY += element.center.y * elementMass;
        sourceCount++;
      }

      for (const child of node.children) {
        visit(child);
        if (child.aggregateMass === 0) {
          continue;
        }
        mass += child.aggregateMass;
        weightedX += child.aggregateCenterX * child.aggregateMass;
        weightedY += child.aggregateCenterY * child.aggregateMass;
        sourceCount += child.aggregateSourceCount;
      }

      node.aggregateMass = mass;
      node.aggregateSourceCount = sourceCount;
      node.aggregateCenterX = mass === 0
        ? node.centerX()
        : weightedX / mass;
      node.aggregateCenterY = mass === 0
        ? node.centerY()
        : weightedY / mass;
    };

    visit(this);
    return {
      mass: this.aggregateMass,
      centerX: this.aggregateCenterX,
      centerY: this.aggregateCenterY,
      sourceCount: this.aggregateSourceCount,
    };
  }

  forEachMassInteraction(target, theta, callback) {
    if (this !== this.root) {
      throw new Error('Quadtree mass interactions must start from the root');
    }
    validateElement(target);
    if (!Number.isFinite(theta) || theta < 0) {
      throw new Error(`Barnes-Hut theta must be finite and non-negative; got ${theta}`);
    }
    if (typeof callback !== 'function') {
      throw new Error('Quadtree mass-interaction callback must be a function');
    }
    if (typeof this.massAccessor !== 'function') {
      throw new Error(
        'Quadtree mass properties must be calculated before mass interactions',
      );
    }

    const marker = ++this.massTraversalMarker;
    let targetNode = this.elementLeaves.get(target);
    while (targetNode) {
      targetNode.massPathMarker = marker;
      targetNode = targetNode.parent;
    }

    let approximationCount = 0;
    let exactSourceCount = 0;

    const visit = node => {
      if (node.aggregateMass === 0) {
        return;
      }

      if (!node.hasChildren()) {
        for (const source of node.objects) {
          if (source === target) {
            continue;
          }
          const sourceMass = this.massAccessor(source);
          if (sourceMass === 0) {
            continue;
          }
          callback(
            sourceMass,
            source.center.x,
            source.center.y,
            source,
          );
          exactSourceCount++;
        }
        return;
      }

      const dx = node.aggregateCenterX - target.center.x;
      const dy = node.aggregateCenterY - target.center.y;
      const distanceSquared = dx * dx + dy * dy;
      const nodeSize = Math.max(
        node.max_x - node.min_x,
        node.max_y - node.min_y,
      );
      const canApproximate = (
        node.massPathMarker !== marker &&
        distanceSquared > 0 &&
        nodeSize * nodeSize < theta * theta * distanceSquared
      );

      if (canApproximate) {
        callback(
          node.aggregateMass,
          node.aggregateCenterX,
          node.aggregateCenterY,
          null,
        );
        approximationCount++;
        return;
      }

      for (const child of node.children) {
        visit(child);
      }
    };

    visit(this);
    return {
      approximations: approximationCount,
      exactSources: exactSourceCount,
    };
  }

  calculateMassAcceleration(target, theta, softening = 0) {
    if (this !== this.root) {
      throw new Error('Quadtree mass acceleration must start from the root');
    }
    validateElement(target);
    if (!Number.isFinite(theta) || theta < 0) {
      throw new Error(`Barnes-Hut theta must be finite and non-negative; got ${theta}`);
    }
    if (!Number.isFinite(softening) || softening < 0) {
      throw new Error(
        `Gravity softening must be finite and non-negative; got ${softening}`,
      );
    }
    if (typeof this.massAccessor !== 'function') {
      throw new Error(
        'Quadtree mass properties must be calculated before mass acceleration',
      );
    }

    const marker = ++this.massTraversalMarker;
    let targetNode = this.elementLeaves.get(target);
    while (targetNode) {
      targetNode.massPathMarker = marker;
      targetNode = targetNode.parent;
    }

    const thetaSquared = theta * theta;
    const softeningSquared = softening * softening;
    const stack = this.massTraversalStack;
    stack.length = 0;
    stack.push(this);

    let accelerationX = 0;
    let accelerationY = 0;
    let approximationCount = 0;
    let exactSourceCount = 0;
    let appliedSourceCount = 0;

    while (stack.length > 0) {
      const node = stack.pop();
      if (node.aggregateMass === 0) {
        continue;
      }

      if (!node.hasChildren()) {
        for (const source of node.objects) {
          if (source === target) {
            continue;
          }
          const sourceMass = this.massAccessor(source);
          if (sourceMass === 0) {
            continue;
          }
          exactSourceCount++;

          const dx = source.center.x - target.center.x;
          const dy = source.center.y - target.center.y;
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

      const dx = node.aggregateCenterX - target.center.x;
      const dy = node.aggregateCenterY - target.center.y;
      const distanceSquaredWithoutSoftening = dx * dx + dy * dy;
      const canApproximate = (
        node.massPathMarker !== marker &&
        distanceSquaredWithoutSoftening > 0 &&
        node.sizeSquared < thetaSquared * distanceSquaredWithoutSoftening
      );

      if (canApproximate) {
        const distanceSquared = (
          distanceSquaredWithoutSoftening +
          softeningSquared
        );
        const inverseDistance = 1 / Math.sqrt(distanceSquared);
        const scale = (
          node.aggregateMass *
          inverseDistance /
          distanceSquared
        );
        accelerationX += dx * scale;
        accelerationY += dy * scale;
        approximationCount++;
        appliedSourceCount++;
        continue;
      }

      for (let index = node.children.length - 1; index >= 0; index--) {
        stack.push(node.children[index]);
      }
    }

    return {
      x: accelerationX,
      y: accelerationY,
      approximations: approximationCount,
      exactSources: exactSourceCount,
      appliedSources: appliedSourceCount,
    };
  }

  getStats() {
    const stats = {
      nodeCount: 0,
      leafCount: 0,
      maxDepth: this.depth,
      maxLocalObjects: 0,
      storedObjects: 0,
    };

    const visit = node => {
      stats.nodeCount++;
      stats.maxDepth = Math.max(stats.maxDepth, node.depth);
      stats.maxLocalObjects = Math.max(
        stats.maxLocalObjects,
        node.objects.length,
      );
      stats.storedObjects += node.objects.length;

      if (!node.hasChildren()) {
        stats.leafCount++;
      }
      for (const child of node.children) {
        visit(child);
      }
    };

    visit(this);
    return stats;
  }

  toS() {
    const lines = [
      `quadtree depth=${this.depth}: ` +
      `x[${this.min_x}, ${this.max_x}], y[${this.min_y}, ${this.max_y}]`,
    ];

    if (this.hasObjects()) {
      lines.push(
        `  Objects ${this.objects.length}/${this.max_local_objects}:`,
      );
      for (const element of this.objects) {
        lines.push(`    ${describeElement(element)}`);
      }
    }
    if (this.hasChildren()) {
      lines.push(`  Children[${this.children.length}]:`);
      for (let index = 0; index < this.children.length; index++) {
        const child = this.children[index];
        const childLines = child.toS().split('\n');
        lines.push(`    child[${index}] ${childLines[0]}`);
        for (let lineIndex = 1; lineIndex < childLines.length; lineIndex++) {
          lines.push(`    ${childLines[lineIndex]}`);
        }
      }
    }
    return lines.join('\n');
  }
}

export {
  Quadtree as quadtree,
  QuadtreeElement as qtElement,
};
