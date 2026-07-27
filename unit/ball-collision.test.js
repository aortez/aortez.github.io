import assert from 'node:assert/strict';
import test from 'node:test';

import { Ball } from '../src/scripts/ball.js';
import { vec3 } from '../src/scripts/vec3.js';

function createBall(values, isMoving = true) {
  const result = new Ball(
    values[0],
    values[1],
    values[2],
    new vec3(100, 150, 200),
  );
  result.v.x = values[3];
  result.v.y = values[4];
  result.is_moving = isMoving;
  return result;
}

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) <= 1e-15,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function assertBallState(ball, expected, label) {
  assertClose(ball.center.x, expected.center.x, `${label} center.x`);
  assertClose(ball.center.y, expected.center.y, `${label} center.y`);
  assertClose(ball.v.x, expected.v.x, `${label} v.x`);
  assertClose(ball.v.y, expected.v.y, `${label} v.y`);
  assertClose(ball.hp, expected.hp, `${label} hp`);
}

test('allocation-light collision math preserves the legacy response', () => {
  const cases = [
    {
      left: [0.4, 0.45, 0.08, 0.03, -0.02],
      right: [0.51, 0.5, 0.05, -0.01, 0.04],
      leftMoving: true,
      rightMoving: true,
      expectedLeft: {
        center: { x: 0.3976551567218712, y: 0.4489341621463051 },
        v: { x: 0.01607688163767892, y: -0.026328690164691394 },
        hp: 0.07996259035404667,
      },
      expectedRight: {
        center: { x: 0.5160027987920098, y: 0.502728544905459 },
        v: { x: 0.008323456980144677, y: 0.04832884408188393 },
        hp: 0.04972423985812918,
      },
    },
    {
      left: [0.2, 0.3, 0.1, 0.02, 0.01],
      right: [0.27, 0.36, 0.03, -0.04, -0.02],
      leftMoving: false,
      rightMoving: true,
      expectedLeft: {
        center: { x: 0.2, y: 0.3 },
        v: { x: 0.02, y: 0.01 },
        hp: 0.09989053967724747,
      },
      expectedRight: {
        center: { x: 0.29870335830748856, y: 0.3846028785492759 },
        v: { x: 0.04489152725310309, y: 0.052764166216945504 },
        hp: 0.029315773473412347,
      },
    },
    {
      left: [0.7, 0.6, 0.04, -0.02, 0.05],
      right: [0.75, 0.67, 0.09, 0.03, -0.01],
      leftMoving: true,
      rightMoving: false,
      expectedLeft: {
        center: { x: 0.6744390348165175, y: 0.5642146487431244 },
        v: { x: -0.05520409584842576, y: 0.000714265812203952 },
        hp: 0.03968494493041894,
      },
      expectedRight: {
        center: { x: 0.75, y: 0.67 },
        v: { x: 0.03, y: -0.01 },
        hp: 0.08996644398056879,
      },
    },
  ];

  for (const [index, collision] of cases.entries()) {
    const left = createBall(collision.left, collision.leftMoving);
    const right = createBall(collision.right, collision.rightMoving);
    left.collide(right);
    assertBallState(left, collision.expectedLeft, `case ${index} left`);
    assertBallState(right, collision.expectedRight, `case ${index} right`);
  }
});

test('aligned and coincident collisions use stable normals without jitter', () => {
  const verticalLeft = createBall([0.5, 0.45, 0.1, 0, 0]);
  const verticalRight = createBall([0.5, 0.55, 0.1, 0, 0]);
  verticalLeft.collide(verticalRight);

  assert.equal(verticalLeft.center.x, 0.5);
  assert.equal(verticalRight.center.x, 0.5);
  assert.ok(verticalLeft.center.y < verticalRight.center.y);

  const coincidentLeft = createBall([0.5, 0.5, 0.1, 0, 0]);
  const coincidentRight = createBall([0.5, 0.5, 0.1, 0, 0]);
  coincidentLeft.collide(coincidentRight);

  for (const item of [coincidentLeft, coincidentRight]) {
    assert.equal(Number.isFinite(item.center.x), true);
    assert.equal(Number.isFinite(item.center.y), true);
    assert.equal(Number.isFinite(item.v.x), true);
    assert.equal(Number.isFinite(item.v.y), true);
  }
  assert.ok(coincidentLeft.center.x > coincidentRight.center.x);
});
