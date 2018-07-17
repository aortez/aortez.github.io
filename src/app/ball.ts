import { Vec2 } from './vec2';
import { Vec3 } from './vec3';

export class Ball {

  center: Vec2;
  color: Vec3;
  r: number; // radius
  public v: Vec2; // velocity

  constructor( x, y, r, c ) {
    this.center = new Vec2( x, y );
    this.v = new Vec2( 0, 0 );
    this.r = r; // radius
    this.color = c; // color
    // this.m = this.r; // mass
    // this.is_affected_by_gravity = true;
    // this.is_moving = true;
    // this.is_invincible = false;
    // this.pattern = null;
  }

  public draw( ctx, scale: number, trans: Vec2, pizza_time ) {
    // if ( !this.pattern ) {
    //   var imageObj = new Image();
    //   // imageObj.src = 'http://www.html5canvastutorials.com/demos/assets/wood-pattern.png';
    //   imageObj.src = 'http://s3.amazonaws.com/spoonflower/public/design_thumbnails/0289/6414/rrrpizza_pepperoni_shop_preview.png';
    //   this.pattern = ctx.createPattern(imageObj, 'repeat');
    // }

    ctx.beginPath();
    const x = ( this.center.x + trans.x) * scale;
    const y = ( this.center.y + trans.y) * scale;
    const r = this.r * scale;
    console.log(`x: ${x}, y: ${y}, r: ${r}`);
    ctx.arc( x, y, r, 0, 2 * Math.PI, false );
    // if ( pizza_time ) {
    //   ctx.fillStyle = this.pattern;
    // } else {
    ctx.fillStyle = "rgb(" + this.color.x + "," + this.color.y + "," + this.color.z + ")";
    // }
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
  }

}
