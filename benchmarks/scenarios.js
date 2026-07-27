const SCENARIO_NAMES = [
  'grid',
  'jittered',
  'uniform',
  'clustered',
  'boundary',
  'mixed',
  'coincident',
  'moving',
];

export const BENCHMARK_SCENARIOS = Object.freeze(SCENARIO_NAMES);

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createNormalRandom(random) {
  let spare = null;
  return function normal() {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }

    let x;
    let y;
    let magnitudeSquared;
    do {
      x = random() * 2 - 1;
      y = random() * 2 - 1;
      magnitudeSquared = x * x + y * y;
    } while (magnitudeSquared === 0 || magnitudeSquared >= 1);

    const scale = Math.sqrt(-2 * Math.log(magnitudeSquared) / magnitudeSquared);
    spare = y * scale;
    return x * scale;
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function radiusScale(count, scale, maximum = 0.02) {
  return Math.min(maximum, scale / Math.ceil(Math.sqrt(count)));
}

function randomCoordinate(random, radius) {
  return radius + random() * (1 - radius * 2);
}

function createBody(id, x, y, radius, velocityX = 0, velocityY = 0) {
  return {
    id,
    center: { x, y },
    r: radius,
    velocity: { x: velocityX, y: velocityY },
  };
}

function createGrid(count) {
  const side = Math.ceil(Math.sqrt(count));
  const radius = radiusScale(count, 0.18);
  const bodies = [];

  for (let index = 0; index < count; index++) {
    const column = index % side;
    const row = Math.floor(index / side);
    bodies.push(createBody(
      index,
      (column + 0.5) / side,
      (row + 0.5) / side,
      radius,
    ));
  }

  return bodies;
}

function createJitteredGrid(count, random) {
  const side = Math.ceil(Math.sqrt(count));
  const radius = radiusScale(count, 0.10);
  const bodies = [];

  for (let index = 0; index < count; index++) {
    const column = index % side;
    const row = Math.floor(index / side);
    const jitterX = (random() - 0.5) * 0.4;
    const jitterY = (random() - 0.5) * 0.4;
    bodies.push(createBody(
      index,
      (column + 0.5 + jitterX) / side,
      (row + 0.5 + jitterY) / side,
      radius,
    ));
  }

  return bodies;
}

function createUniform(count, random, moving = false) {
  const side = Math.ceil(Math.sqrt(count));
  const minimumRadius = 0.07 / side;
  const radiusRange = 0.15 / side;
  const bodies = [];

  for (let index = 0; index < count; index++) {
    const radius = minimumRadius + random() * radiusRange;
    const speed = moving ? 0.001 + random() * 0.003 : 0;
    const angle = random() * Math.PI * 2;
    bodies.push(createBody(
      index,
      randomCoordinate(random, radius),
      randomCoordinate(random, radius),
      radius,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
    ));
  }

  return bodies;
}

function createClustered(count, random) {
  const normal = createNormalRandom(random);
  const radius = radiusScale(count, 0.10);
  const centers = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ];
  const bodies = [];

  for (let index = 0; index < count; index++) {
    const center = centers[index % centers.length];
    const x = clamp(center[0] + normal() * 0.045, radius, 1 - radius);
    const y = clamp(center[1] + normal() * 0.045, radius, 1 - radius);
    bodies.push(createBody(index, x, y, radius));
  }

  return bodies;
}

function createBoundaryStraddlers(count, random) {
  const radius = radiusScale(count, 0.18);
  const bodies = [];

  for (let index = 0; index < count; index++) {
    let x = randomCoordinate(random, radius);
    let y = randomCoordinate(random, radius);

    if (index % 3 === 0) {
      x = 0.5 + (random() - 0.5) * radius;
    } else if (index % 3 === 1) {
      y = 0.5 + (random() - 0.5) * radius;
    } else {
      x = 0.5 + (random() - 0.5) * radius;
      y = 0.5 + (random() - 0.5) * radius;
    }

    bodies.push(createBody(index, x, y, radius));
  }

  return bodies;
}

function createMixedRadii(count, random) {
  const side = Math.ceil(Math.sqrt(count));
  const smallRadius = 0.08 / side;
  const largeRadius = Math.min(0.04, 1.5 / side);
  const bodies = [];

  for (let index = 0; index < count; index++) {
    const isLarge = index % 100 === 0;
    const radius = isLarge
      ? largeRadius * (0.6 + random() * 0.4)
      : smallRadius * (0.5 + random());
    bodies.push(createBody(
      index,
      randomCoordinate(random, radius),
      randomCoordinate(random, radius),
      radius,
    ));
  }

  return bodies;
}

function createCoincident(count) {
  const radius = radiusScale(count, 0.12);
  return Array.from(
    { length: count },
    (_, index) => createBody(index, 0.371, 0.619, radius),
  );
}

export function createScenario(name, count, seed = 0xC0FFEE) {
  if (!SCENARIO_NAMES.includes(name)) {
    throw new Error(
      `Unknown scenario "${name}". Expected one of: ${SCENARIO_NAMES.join(', ')}`,
    );
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Scenario count must be a non-negative integer; got ${count}`);
  }

  const scenarioSeed = (seed ^ hashString(name) ^ count) >>> 0;
  const random = createSeededRandom(scenarioSeed);

  switch (name) {
    case 'grid':
      return createGrid(count);
    case 'jittered':
      return createJitteredGrid(count, random);
    case 'uniform':
      return createUniform(count, random);
    case 'clustered':
      return createClustered(count, random);
    case 'boundary':
      return createBoundaryStraddlers(count, random);
    case 'mixed':
      return createMixedRadii(count, random);
    case 'coincident':
      return createCoincident(count);
    case 'moving':
      return createUniform(count, random, true);
    default:
      throw new Error(`Unhandled scenario "${name}"`);
  }
}

export function advanceBodies(bodies, timeStep = 1) {
  for (const body of bodies) {
    body.center.x += body.velocity.x * timeStep;
    body.center.y += body.velocity.y * timeStep;

    if (body.center.x - body.r < 0) {
      body.center.x = body.r;
      body.velocity.x = Math.abs(body.velocity.x);
    } else if (body.center.x + body.r > 1) {
      body.center.x = 1 - body.r;
      body.velocity.x = -Math.abs(body.velocity.x);
    }

    if (body.center.y - body.r < 0) {
      body.center.y = body.r;
      body.velocity.y = Math.abs(body.velocity.y);
    } else if (body.center.y + body.r > 1) {
      body.center.y = 1 - body.r;
      body.velocity.y = -Math.abs(body.velocity.y);
    }
  }
}

export function cloneBodies(bodies) {
  return bodies.map(body => createBody(
    body.id,
    body.center.x,
    body.center.y,
    body.r,
    body.velocity.x,
    body.velocity.y,
  ));
}
