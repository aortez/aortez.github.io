import { Ball } from './ball';
import { Vec2 } from './vec2';
import { Vec3 } from './vec3';

export class World {
  ball: Ball;
  background_color: Vec3;
  theta: number;
  min: Vec2;
  max: Vec2;

  constructor() {
    this.theta = 0;
    this.background_color = new Vec3( 0, 0, 255 );
    const pink = new Vec3( 255, 50, 50 );
    // const blue = new Vec3( 0, 0, 255 );
    // const green = new Vec3( 0, 255, 0 );

    this.ball = new Ball( 0, 0, 0.1, pink.copy() );
    this.ball.v = new Vec2( 0.0005, 0.0005 );
    this.min = new Vec2( -1, -1 );
    this.max = new Vec2( 1, 1 );
  }

  public advance( dt: number ) {

    const b = this.ball;

    // move moving stuff
    b.center.plus( b.v.copy().times( dt ) );

    const WALL_ELASTIC_FACTOR = 1;
    if ( b.center.x + b.r >= this.max.x ) {
      b.center.x = this.max.x - b.r;
      b.v.x = -b.v.x * WALL_ELASTIC_FACTOR;
      console.log("bounce max x");
    }
    if ( b.center.y + b.r >= this.max.y ) {
      b.center.y = this.max.y - b.r;
      b.v.y = -b.v.y * WALL_ELASTIC_FACTOR;
      console.log("bounce max y");
    }
    if ( b.center.x - b.r <= this.min.x ) { b.center.x = this.min.x + b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
    if ( b.center.y - b.r <= this.min.y ) { b.center.y = this.min.y + b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }

  }

  public draw( ctx, scale, trans ) {

    this.ball.draw( ctx, scale, trans, false );

  }

  public setBoundingBox( min: Vec2, max: Vec2, ) {
    this.min = min;
    this.max = max;
  }
}
