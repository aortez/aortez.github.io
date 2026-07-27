import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_BALL_SPAWN_RATE,
  MAX_DESIRED_BALLS,
  MIN_BALL_SPAWN_RATE,
  World,
} from '../src/scripts/world.js';

const WIDE_CANVAS = {
  width: 1200,
  height: 600,
};

test('ball spawner adds at most one random ball per frame toward its target', () => {
  const world = new World();
  world.setDesiredBallCount( 3 );
  world.setBallSpawnRate( MAX_BALL_SPAWN_RATE );

  assert.equal( world.advanceBallSpawner( WIDE_CANVAS, () => 0 ), 1 );
  assert.equal( world.advanceBallSpawner( WIDE_CANVAS, () => 0 ), 1 );
  assert.equal( world.advanceBallSpawner( WIDE_CANVAS, () => 0 ), 1 );
  assert.equal( world.advanceBallSpawner( WIDE_CANVAS, () => 0 ), 0 );
  assert.equal( world.balls.length, 3 );

  for ( const ball of world.balls ) {
    assert.ok( ball.center.x - ball.r >= 0 );
    assert.ok( ball.center.y - ball.r >= 0 );
    assert.ok( ball.center.x + ball.r <= 1 );
    assert.ok( ball.center.y + ball.r <= 0.5 );
  }
});

test('ball spawn probability controls whether a frame adds a ball', () => {
  const world = new World();
  world.setDesiredBallCount( 1 );
  world.setBallSpawnRate( 0.25 );

  assert.equal( world.advanceBallSpawner( WIDE_CANVAS, () => 0.25 ), 0 );
  assert.equal( world.advanceBallSpawner( WIDE_CANVAS, () => 0 ), 1 );
});

test('lowering desired ball count immediately removes excess balls', () => {
  const world = new World();
  world.balls = [ {}, {}, {}, {}, {} ];

  assert.equal( world.setDesiredBallCount( 2 ), 2 );
  assert.equal( world.balls.length, 2 );
});

test('ball slider settings stay within their supported ranges', () => {
  const world = new World();

  assert.equal(
    world.setDesiredBallCount( MAX_DESIRED_BALLS + 100 ),
    MAX_DESIRED_BALLS,
  );
  assert.equal( world.setDesiredBallCount( -1 ), 0 );
  assert.equal( world.setBallSpawnRate( 0 ), MIN_BALL_SPAWN_RATE );
  assert.equal(
    world.setBallSpawnRate( MAX_BALL_SPAWN_RATE + 1 ),
    MAX_BALL_SPAWN_RATE,
  );
  assert.throws(
    () => world.setDesiredBallCount( Number.NaN ),
    /finite number/,
  );
  assert.throws(
    () => world.setBallSpawnRate( Number.NaN ),
    /finite number/,
  );
});
