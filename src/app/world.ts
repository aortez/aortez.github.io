import { Ball } from './ball';
import { Vec2 } from './vec2';
import { Vec3 } from './vec3';

export class World {
  ball: Ball;
  background_color: Vec3;

  constructor() {
    this.background_color = new Vec3( 0, 0, 255 );
    const pink = new Vec3( 255, 50, 50 );
    // const blue = new Vec3( 0, 0, 255 );
    // const green = new Vec3( 0, 255, 0 );

    this.ball = new Ball( 0.5, 0.5, 0.1, pink.copy() );
  }
}
