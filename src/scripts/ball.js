class Ball
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

    this.pattern = null;
  }

  calcHp() {
    let hp = this.r;
    return hp;
  }

  collide( b ) {
    // let DAMAGE_SCALAR = 0.002;
    let DAMAGE_SCALAR = 0.1;

    // distance between centers
    let D = this.center.copy().minus( b.center );

    // test to see if circles are in the exact same spot
    let delta = D.mag();
    // or if they are sitting exactly on top of each other
    let offset = Math.abs( this.center.x - b.center.x );
    while ( delta === 0 || offset < 0.001 ) {
      let max_jitter = 0.01;
      // give the other object a small random jitter
      b.center.x += Math.random() * max_jitter;
      b.center.y += Math.random() * max_jitter;
      D = this.center.copy().minus( b.center );
      delta = D.mag();
      offset = Math.abs( this.center.x - b.center.x );
    }

    // normalize vector between centers
    let Dn = D.normalize();

    // minimum translation distance to separate circles
    let T = new vec2( Dn.x, Dn.y );
    T.times( this.r + b.r - delta );

    // compute masses
    let m1 = this.m;
    let m2 = b.m;
    let M = m1 + m2;

    if ( !this.is_moving ) {
      b.center.minus( T );
    }
    else if ( !b.is_moving ) {
     this.center.plus( T );
    }
    else {
      // push the circles apart proportional to their mass
      this.center.plus( T.copy().times( m2 / M ) );
      b.center.minus( T.copy().times( m1 / M ) );
    }

    // if neither can move, as soon as we've moved the objects, we don't need to adjust their velocity any further
    if ( !b.is_moving && !this.is_moving ) {
      return;
    }

    // vector tangential to the collision plane
    let Dt = new vec2( Dn.y, -Dn.x );

    // split the velocity vector of the first ball into a normal and a tangential component in respect of the collision plane
    let v1n = Dn.copy().times( this.v.dot( Dn ) );
    let v1t = Dt.copy().times( this.v.dot( Dt ) );

    // split the velocity vector of the second ball into a normal and a tangential component in respect of the collision plane
    let v2n = Dn.copy().times( b.v.dot( Dn ) );
    let v2t = Dt.copy().times( b.v.dot( Dt ) );

    // calculate new velocity vectors of the balls, the tangential component stays the same, the normal component changes
    let elastic_factor = 0.9;
    let dv1t = Dn.copy().times( ( m1 - m2 ) /  M * v1n.mag() + 2 * m2 / M * v2n.mag() );
    let dv2t = Dn.times( ( m2 - m1 ) / M * v2n.mag() + 2 * m1 / M * v1n.mag() );
    if ( this.is_moving ) {
      this.v = v1t.plus( dv1t.times( elastic_factor ) );
    }
    if ( b.is_moving ) {
      b.v = v2t.minus( dv2t.times( elastic_factor ) );
    }

    // damage life based upon change in momemtum
    if ( !this.is_invincible ) {
      this.hp -= ( dv1t.mag() * DAMAGE_SCALAR );
    }
    if ( !b.is_invincible ) {
      b.hp -= ( dv2t.mag() * DAMAGE_SCALAR );
    }
    // console.log( "this.hp: " + this.hp );
  }

  // world goes from 0 - 1
  // objects live inside this bounds
  // when drawing, scale object location to canvas size

  draw( ctx, scale_factor, pizza_time ) {
    if ( !this.pattern ) {
      var imageObj = new Image();
      // imageObj.src = 'http://www.html5canvastutorials.com/demos/assets/wood-pattern.png';
      imageObj.src = 'http://s3.amazonaws.com/spoonflower/public/design_thumbnails/0289/6414/rrrpizza_pepperoni_shop_preview.png';
      this.pattern = ctx.createPattern(imageObj, 'repeat');
    }

    ctx.beginPath();
    let x = this.center.x * scale_factor;
    let y = this.center.y * scale_factor;
    let r = this.r * scale_factor;
    ctx.arc( x, y, r, 0, 2 * Math.PI, false );
    if ( pizza_time ) {
      ctx.fillStyle = this.pattern;
    } else {
      ctx.fillStyle = "rgb(" + this.color.x + "," + this.color.y + "," + this.color.z + ")";
    }
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
  }

  explode( n_divs ) {
    let EXPLODER_PARENT_VELOCITY_FACTOR = 0.5;
    let MIN_FRAG_RADIUS = 1;

    let frags = [];
    let div_size = this.r / n_divs;
    for ( let y = this.center.y - this.r; y < this.center.y + this.r; y += div_size ) {
      for ( let x = this.center.x - this.r; x < this.center.x + this.r; x += div_size ) {
        const new_center = new vec2( x, y );
        if ( new_center.distance( this.center ) > this.r ) continue;

        let r = div_size * EXPLODER_SIZE_FACTOR * ( 0.3 + Math.random() * 0.7 );
        if ( r < MIN_FRAG_RADIUS ) continue;
        let c = this.color.copy();
        c.randColor( 100 );

        let new_ball = new Ball( x, y, r, c );

        let v = new_ball.center.copy().minus( this.center );
        v = v.plus( this.v.copy().times( EXPLODER_PARENT_VELOCITY_FACTOR ) );
        let mini_exploder_boost = ( EXPLODE_V_FACTOR < 0.1 && r < 4 ) ? Math.random() * 0.1 : 0;
        v.times( Math.random() * ( EXPLODE_V_FACTOR + mini_exploder_boost ) );
        new_ball.v = v;
        new_ball.is_affected_by_gravity = true;
        new_ball.is_moving = true;
        new_ball.is_invincible = false;

        frags.push( new_ball );
      }
    }
    return frags;
  }

  toS() {
    return "ball(" + this.center.toString() + ", " + this.r + ")";
  }

}
