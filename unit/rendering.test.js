import assert from 'node:assert/strict';
import test from 'node:test';

import { Ball } from '../src/scripts/ball.js';
import { vec3 } from '../src/scripts/vec3.js';
import { World } from '../src/scripts/world.js';

const SQUARE_CANVAS = {
  width: 1000,
  height: 1000,
};

function recordingContext() {
  const calls = {
    arcs: 0,
    fills: 0,
    rectangles: 0,
    strokes: 0,
  };
  return {
    calls,
    arc() {
      calls.arcs++;
    },
    beginPath() {},
    closePath() {},
    fill() {
      calls.fills++;
    },
    fillRect() {
      calls.rectangles++;
    },
    stroke() {
      calls.strokes++;
    },
  };
}

test('cached RGB strings follow direct and method-based color mutations', () => {
  const color = new vec3( 10, 20, 30 );
  assert.equal( color.toRGB(), 'rgb(10,20,30)' );
  assert.equal( color.toRGB(), 'rgb(10,20,30)' );

  color.x = 40;
  assert.equal( color.toRGB(), 'rgb(40,20,30)' );

  color.set( 50, 60, 70 );
  assert.equal( color.toRGB(), 'rgb(50,60,70)' );
});

test('world rendering culls offscreen bodies and pixel-renders tiny particles', () => {
  const world = new World();
  world.shouldDrawBackground = false;
  world.particles = [
    new Ball( 0.5, 0.5, 0.0005, new vec3( 255, 0, 0 ) ),
    new Ball( -0.1, 0.5, 0.01, new vec3( 0, 255, 0 ) ),
  ];
  world.balls = [
    new Ball( 0.25, 0.25, 0.01, new vec3( 0, 0, 255 ) ),
  ];
  const context = recordingContext();

  const stats = world.draw( SQUARE_CANVAS, context );

  assert.equal( stats.attemptedBodies, 3 );
  assert.equal( stats.drawnBodies, 2 );
  assert.equal( stats.culledBodies, 1 );
  assert.equal( stats.pixelBodies, 1 );
  assert.equal( stats.circleBodies, 1 );
  assert.equal( stats.particles.pixelBodies, 1 );
  assert.equal( stats.particles.culledBodies, 1 );
  assert.equal( context.calls.rectangles, 2 );
  assert.equal( context.calls.arcs, 1 );
  assert.equal( context.calls.fills, 1 );
  assert.equal( context.calls.strokes, 1 );
});

test('dense rendering only outlines visually large circles', () => {
  const world = new World();
  world.shouldDrawBackground = false;
  world.maxFullOutlineBodyCount = 1;
  world.highLoadOutlineRadius = 8;
  world.balls = [
    new Ball( 0.25, 0.25, 0.004, new vec3( 255, 0, 0 ) ),
    new Ball( 0.75, 0.75, 0.01, new vec3( 0, 0, 255 ) ),
  ];
  const context = recordingContext();

  const stats = world.draw( SQUARE_CANVAS, context );

  assert.equal( stats.outlineLodActive, true );
  assert.equal( stats.circleBodies, 2 );
  assert.equal( stats.outlinedBodies, 1 );
  assert.equal( stats.balls.outlinedBodies, 1 );
  assert.equal( context.calls.arcs, 2 );
  assert.equal( context.calls.fills, 2 );
  assert.equal( context.calls.strokes, 1 );
});
