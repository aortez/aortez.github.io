import { Vec2 } from './vec2';

export class Ball {

  center: Vec2;

  constructor( x, y, r, c ) {
    this.center = new Vec2( x, y );
    // this.v = new vec2( 0, 0 );
    // this.r = r; // radius
    // this.color = c; // color
    // this.m = this.r; // mass
    // this.is_affected_by_gravity = true;
    // this.is_moving = true;
    // this.is_invincible = false;
    // this.pattern = null;
  }

  // draw( ctx, scale_factor, pizza_time ) {
  //   ctx.beginPath();
  //   let x = this.center.x;
  //   let y = this.center.y;
  //   let r = this.r * scale_factor;
  //   ctx.arc( x, y, r, 0, 2 * Math.PI, false );
  //   ctx.fillStyle = "rgb(" + this.color.x + "," + this.color.y + "," + this.color.z + ")";
  //   ctx.fill();
  //   ctx.stroke();
  //   ctx.closePath();
  // }

}
