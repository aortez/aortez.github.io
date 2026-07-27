import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampSimulationFrameMilliseconds,
  MAX_SIMULATION_FRAME_MS,
  setSimulationFrameOverrideMilliseconds,
} from '../src/scripts/main.js';

test('simulation frame time is non-negative and capped at 30 FPS', () => {
  assert.equal(clampSimulationFrameMilliseconds(-1), 0);
  assert.equal(clampSimulationFrameMilliseconds(16), 16);
  assert.equal(
    clampSimulationFrameMilliseconds(250),
    MAX_SIMULATION_FRAME_MS,
  );
});

test('simulation frame override validates benchmark input', () => {
  assert.doesNotThrow(() => setSimulationFrameOverrideMilliseconds(16));
  assert.doesNotThrow(() => setSimulationFrameOverrideMilliseconds(null));
  assert.throws(
    () => setSimulationFrameOverrideMilliseconds(-1),
    /non-negative finite number/,
  );
  assert.throws(
    () => setSimulationFrameOverrideMilliseconds(Number.NaN),
    /non-negative finite number/,
  );
});
