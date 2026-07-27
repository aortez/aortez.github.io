import { vec2 } from './vec2.js';
import { vec3 } from './vec3.js';

let pizzaImage = null;
const pizzaPatterns = new WeakMap();

function getPizzaPattern( ctx ) {
  if ( typeof Image === 'undefined' ) {
    return null;
  }
  if ( !pizzaImage ) {
    pizzaImage = new Image();
    pizzaImage.src = new URL('../../pizza.png', import.meta.url).href;
  }
  if ( !pizzaImage.complete || pizzaImage.naturalWidth === 0 ) {
    return null;
  }
  if ( !pizzaPatterns.has( ctx ) ) {
    pizzaPatterns.set( ctx, ctx.createPattern( pizzaImage, 'repeat' ) );
  }
  return pizzaPatterns.get( ctx );
}

export class Ball
{
  constructor( x, y, r, c ) {
    this.center = new vec2( x, y );
    this.v = new vec2( 0, 0 );
    this.r = r; // radius
    this.color = c; // color
    this.hp = this.calcHp(); // current hit points
    this.m = this.r * this.r; // mass
    this.is_affected_by_gravity = true;
    this.is_moving = true;
    this.is_invincible = false;

  }

  calcHp() {
    let hp = this.r;
    return hp;
  }

  collide( b ) {
    // let DAMAGE_SCALAR = 0.002;
    const DAMAGE_SCALAR = 0.01;

    // distance between centers
    let dx = this.center.x - b.center.x;
    let dy = this.center.y - b.center.y;

    const delta = Math.sqrt( dx * dx + dy * dy );

    // Exactly coincident centers have no natural collision normal. Choose a
    // stable direction instead of randomly moving every nearly vertical pair.
    const normalX = delta === 0 ? 1 : dx / delta;
    const normalY = delta === 0 ? 0 : dy / delta;

    // minimum translation distance to separate circles
    const translationScale = this.r + b.r - delta;
    const translationX = normalX * translationScale;
    const translationY = normalY * translationScale;

    // compute masses
    const m1 = this.m;
    const m2 = b.m;
    const M = m1 + m2;

    if ( !this.is_moving ) {
      b.center.x -= translationX;
      b.center.y -= translationY;
    }
    else if ( !b.is_moving ) {
      this.center.x += translationX;
      this.center.y += translationY;
    }
    else {
      // Separate the circles so they don't overlap, proportional to their mass.
      const thisTranslationScale = m2 / M;
      const otherTranslationScale = m1 / M;
      this.center.x += translationX * thisTranslationScale;
      this.center.y += translationY * thisTranslationScale;
      b.center.x -= translationX * otherTranslationScale;
      b.center.y -= translationY * otherTranslationScale;
    }

    // If neither can move, as soon as we've separated the objects, we don't need to adjust their velocity any further.
    if ( !b.is_moving && !this.is_moving ) {
      return;
    }

    // vector tangential to the collision plane
    const tangentX = normalY;
    const tangentY = -normalX;

    // split the velocity vector of the first ball into a normal and a tangential component in respect of the collision plane
    const v1NormalDot = this.v.x * normalX + this.v.y * normalY;
    const v1NormalX = normalX * v1NormalDot;
    const v1NormalY = normalY * v1NormalDot;
    const v1TangentDot = this.v.x * tangentX + this.v.y * tangentY;
    const v1TangentX = tangentX * v1TangentDot;
    const v1TangentY = tangentY * v1TangentDot;

    // split the velocity vector of the second ball into a normal and a tangential component in respect of the collision plane
    const v2NormalDot = b.v.x * normalX + b.v.y * normalY;
    const v2NormalX = normalX * v2NormalDot;
    const v2NormalY = normalY * v2NormalDot;
    const v2TangentDot = b.v.x * tangentX + b.v.y * tangentY;
    const v2TangentX = tangentX * v2TangentDot;
    const v2TangentY = tangentY * v2TangentDot;

    // calculate new velocity vectors of the balls, the tangential component stays the same, the normal component changes
    const v1NormalMagnitude = Math.sqrt(
      v1NormalX * v1NormalX + v1NormalY * v1NormalY
    );
    const v2NormalMagnitude = Math.sqrt(
      v2NormalX * v2NormalX + v2NormalY * v2NormalY
    );
    const dv1Scale = (
      ( m2 - m1 ) / M * v1NormalMagnitude +
      2 * m2 / M * v2NormalMagnitude
    );
    const dv2Scale = (
      ( m1 - m2 ) / M * v2NormalMagnitude +
      2 * m1 / M * v1NormalMagnitude
    );
    const elastic_factor = 0.9;
    const rawDv1X = normalX * dv1Scale;
    const rawDv1Y = normalY * dv1Scale;
    const rawDv2X = normalX * dv2Scale;
    const rawDv2Y = normalY * dv2Scale;
    const dv1X = rawDv1X * elastic_factor;
    const dv1Y = rawDv1Y * elastic_factor;
    const dv2X = rawDv2X * elastic_factor;
    const dv2Y = rawDv2Y * elastic_factor;
    if ( this.is_moving ) {
      this.v.x = v1TangentX + dv1X;
      this.v.y = v1TangentY + dv1Y;
    }
    if ( b.is_moving ) {
      b.v.x = v2TangentX - dv2X;
      b.v.y = v2TangentY - dv2Y;
    }

    // Apply damage, based upon change in momentum.
    if ( !this.is_invincible ) {
      const damageX = this.is_moving ? dv1X : rawDv1X;
      const damageY = this.is_moving ? dv1Y : rawDv1Y;
      this.hp -= (
        Math.sqrt( damageX * damageX + damageY * damageY ) * DAMAGE_SCALAR
      );
    }
    if ( !b.is_invincible ) {
      const damageX = b.is_moving ? dv2X : rawDv2X;
      const damageY = b.is_moving ? dv2Y : rawDv2Y;
      b.hp -= (
        Math.sqrt( damageX * damageX + damageY * damageY ) * DAMAGE_SCALAR
      );
    }
    // console.log( "this.hp: " + this.hp );
  }

  getFillStyle( ctx, pizza_time ) {
    if ( pizza_time ) {
      return getPizzaPattern( ctx ) ?? this.color.toRGB();
    }
    return this.color.toRGB();
  }

  drawCircle( ctx, x, y, r, shouldStroke = true ) {
    ctx.beginPath();
    ctx.arc( x, y, r, 0, 2 * Math.PI, false );
    ctx.fill();
    if ( shouldStroke ) {
      ctx.stroke();
    }
    ctx.closePath();
  }

  drawPixel( ctx, x, y ) {
    ctx.fillRect( Math.floor( x ), Math.floor( y ), 1, 1 );
  }

  draw( ctx, scale_factor, pizza_time ) {
    // The world goes from 0 to 1, across the largest dimension.
    // The smaller dimension is sized relative to the larger.
    const x = this.center.x * scale_factor;
    const y = this.center.y * scale_factor;
    const r = this.r * scale_factor;
    ctx.fillStyle = this.getFillStyle( ctx, pizza_time );
    this.drawCircle( ctx, x, y, r );
  }

  explode( n_divs, min_frag_radius, EXPLODE_V_FACTOR, EXPLODER_SIZE_FACTOR ) {
    let EXPLODER_PARENT_VELOCITY_FACTOR = 0.5;
    let EXPLODER_RADIAL_VELOCITY_SCALAR = 1;

    let frags = [];
    let div_size = this.r / n_divs;
    for ( let y = this.center.y - this.r; y < this.center.y + this.r; y += div_size ) {
      for ( let x = this.center.x - this.r; x < this.center.x + this.r; x += div_size ) {
        const offsetX = x - this.center.x;
        const offsetY = y - this.center.y;
        if (
          Math.sqrt( offsetX * offsetX + offsetY * offsetY ) > this.r
        ) {
          continue;
        }

        let r = div_size * EXPLODER_SIZE_FACTOR * ( 0.1 + Math.random() * 0.9 );
        if ( r < min_frag_radius ) continue;
        let c = this.color.copy();
        c.randColor( 100 );

        let new_ball = new Ball( x, y, r, c );

        const velocityScale = Math.random() * EXPLODE_V_FACTOR;
        new_ball.v.x = (
          offsetX * EXPLODER_RADIAL_VELOCITY_SCALAR +
          this.v.x * EXPLODER_PARENT_VELOCITY_FACTOR
        ) * velocityScale;
        new_ball.v.y = (
          offsetY * EXPLODER_RADIAL_VELOCITY_SCALAR +
          this.v.y * EXPLODER_PARENT_VELOCITY_FACTOR
        ) * velocityScale;
        new_ball.is_affected_by_gravity = true;
        new_ball.is_moving = true;
        new_ball.is_invincible = false;

        frags.push( new_ball );
      }
    }
    return frags;
  }

  toS() {
    return "ball( center: " + this.center.toString() +
      ", radius: " + this.r +
      ", mass: " + this.m +
      ", hp: " + this.hp +
      ", v: " + this.v +
      ")";
  }

}
