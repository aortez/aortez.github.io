import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampSimulationFrameMilliseconds,
  MAX_SIMULATION_FRAME_MS,
} from '../src/scripts/main.js';

test('simulation frame time is non-negative and capped at 30 FPS', () => {
  assert.equal(clampSimulationFrameMilliseconds(-1), 0);
  assert.equal(clampSimulationFrameMilliseconds(16), 16);
  assert.equal(
    clampSimulationFrameMilliseconds(250),
    MAX_SIMULATION_FRAME_MS,
  );
});
