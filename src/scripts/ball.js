class Ball
{
  constructor( x, y, r, c ) {
    this.center = new vec2( x, y );
    this.v = new vec2( 0, 0 );
    this.r = r;
    this.c = c;
    this.hp = r * r;
    this.hp_max = r * r;
  }

  calcHp() {
    let hp = this.r * this.r;
    return hp;
  }

  collide( b ) {
    let DAMAGE_SCALAR = 0.002;

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
    let m1 = this.r * this.r;
    let m2 = b.r * b.r;
    let M = m1 + m2;

    // push the circles apart proportional to their mass
    this.center.plus( T.copy().times( m2 / M ) );
    b.center.minus( T.copy().times( m1 / M ) );

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
    this.v = v1t.plus( dv1t.times( elastic_factor ) );
    b.v = v2t.minus( dv2t.times( elastic_factor ) );

    // damage life based upon change in momemtum
    this.hp -= ( dv1t.mag() * m1 * DAMAGE_SCALAR );
    b.hp -= ( dv2t.mag() * m2  * DAMAGE_SCALAR );
    // console.log( "this.hp: " + this.hp );
  }

  draw( ctx ) {
    ctx.fillStyle = "rgb(" + this.c.x + "," + this.c.y + "," + this.c.z + ")";
    ctx.beginPath();
    ctx.arc( this.center.x, this.center.y, this.r, 0, 2 * Math.PI, false );
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
  }

  explode( n_divs ) {
    let EXPLODER_PARENT_VELOCITY_FACTOR = 0.2;
    let EXPLODER_SIZE_FACTOR = 0.4;
    let EXPLODE_V_FACTOR = 0.4;
    let EXPLODER_SIZE_RANGE_FACTOR = 0.5;
    let N_DIVS = 6;
    let MIN_FRAG_RADIUS = 4;
    if ( n_divs ) {
      console.log( "ball says: yo: " + n_divs );
      N_DIVS = n_divs;
    }

    let frags = [];
    const div_size = this.r / N_DIVS;
    for ( let y = this.center.y - this.r; y < this.center.y + this.r; y += div_size ) {
      for ( let x = this.center.x - this.r; x < this.center.x + this.r; x += div_size ) {
        const new_center = new vec2( x, y );
        if ( new_center.distance( this.center ) > this.r ) continue;

        // let r = this.r / N_DIVS * EXPLODER_SIZE_FACTOR;
        let r = div_size * 0.6;
        // let r = Math.pow( Math.random(), EXPLODER_SIZE_RANGE_FACTOR ) * this.r / N_DIVS * EXPLODER_SIZE_FACTOR;
        if ( r < MIN_FRAG_RADIUS ) continue;
        let c = this.c.copy();
        c.randColor( 100 );

        let new_ball = new Ball( x, y, r, c );

        let v = new_ball.center.copy().minus( this.center );
        v.times( Math.random() * EXPLODE_V_FACTOR );
        v.plus( this.v.copy().times( EXPLODER_PARENT_VELOCITY_FACTOR ) );
        new_ball.v = v;

        frags.push( new_ball );
      }
    }
    return frags;
  }

}
