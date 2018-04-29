import { Ball } from './ball';
import { Vec2 } from './vec2';
import { Vec3 } from './vec3';

export class World {
  ball: Ball;
  background_color: Vec3;
  theta: number;

  constructor() {
    this.theta = 0;
    this.background_color = new Vec3( 0, 0, 255 );
    const pink = new Vec3( 255, 50, 50 );
    // const blue = new Vec3( 0, 0, 255 );
    // const green = new Vec3( 0, 255, 0 );

    this.ball = new Ball( 0.5, 0.5, 0.1, pink.copy() );
  }

  advance() {
    this.background_color.x = 255/2 * Math.sin(this.theta) + 255/2;

    this.theta += 0.02;
  }
}
