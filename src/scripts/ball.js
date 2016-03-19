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

  collide( b ) {
    var DAMAGE_SCALAR = 0.002;

    // distance between centers
    var D = this.center.copy().minus( b.center );

    // test to see if circles are in the exact same spot
    var delta = D.mag();
    // or if they are sitting exactly on top of each other
    var offset = Math.abs( this.center.x - b.center.x );
    while ( delta === 0 || offset < 0.001 ) {
      var max_jitter = 0.01;
      // give the other object a small random jitter
      b.center.x += Math.random() * max_jitter;
      b.center.y += Math.random() * max_jitter;
      D = this.center.copy().minus( b.center );
      delta = D.mag();
      offset = Math.abs( this.center.x - b.center.x );
    }

    // normalize vector between centers
    var Dn = D.normalize();

    // minimum translation distance to separate circles
    var T = new vec2( Dn.x, Dn.y );
    T.times( this.r + b.r - delta );

    // compute masses
    var m1 = this.r * this.r;
    var m2 = b.r * b.r;
    var M = m1 + m2;

    // push the circles apart proportional to their mass
    this.center.plus( T.copy().times( m2 / M ) );
    b.center.minus( T.copy().times( m1 / M ) );

    // vector tangential to the collision plane
    var Dt = new vec2( Dn.y, -Dn.x );

    // split the velocity vector of the first ball into a normal and a tangential component in respect of the collision plane
    var v1n = Dn.copy().times( this.v.dot( Dn ) );
    var v1t = Dt.copy().times( this.v.dot( Dt ) );

    // split the velocity vector of the second ball into a normal and a tangential component in respect of the collision plane
    var v2n = Dn.copy().times( b.v.dot( Dn ) );
    var v2t = Dt.copy().times( b.v.dot( Dt ) );

    // calculate new velocity vectors of the balls, the tangential component stays the same, the normal component changes
    var elastic_factor = 0.9;
    var dv1t = Dn.copy().times( ( m1 - m2 ) /  M * v1n.mag() + 2 * m2 / M * v2n.mag() );
    var dv2t = Dn.times( ( m2 - m1 ) / M * v2n.mag() + 2 * m1 / M * v1n.mag() );
    this.v = v1t.plus( dv1t.times( elastic_factor ) );
    b.v = v2t.minus( dv2t.times( elastic_factor ) );

    // damage life based upon change in momemtum
    this.hp -= ( dv1t.mag() * m1 * DAMAGE_SCALAR );
    b.hp -= ( dv2t.mag() * m2  * DAMAGE_SCALAR );
    // console.log( "this.hp: " + this.hp );
  }

  draw( ctx ) {
    ctx.fillStyle = this.c.toRGB();
    // var alpha = Math.pow( this.hp / this.hp_max, 0.1 );
    var alpha = 1;
    ctx.beginPath();
    ctx.arc( this.center.x, this.center.y, this.r * alpha, 0, 2 * Math.PI, false );
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
  }

  explode() {
    var EXPLODER_PARENT_VELOCITY_FACTOR = 0.2;
    var EXPLODER_SIZE_FACTOR = 0.4;
    var EXPLODE_V_FACTOR = 0.2;
    var EXPLODER_SIZE_RANGE_FACTOR = 0.5;
    var N_DIVS = 7;

    var frags = [];
    for ( var y = this.center.y - this.r; y < this.center.y + this.r; y += this.r / N_DIVS ) {
      for ( var x = this.center.x - this.r; x < this.center.x + this.r; x += this.r / N_DIVS ) {
        var new_center = new vec2( x, y );
        if ( new_center.distance( this.center ) > this.r ) continue;

        var r = Math.min( Math.random() + ( 1 - EXPLODER_SIZE_RANGE_FACTOR ) ) * this.r / N_DIVS * EXPLODER_SIZE_FACTOR;
        var new_ball = new Ball( x, y, r, this.c );
        // new_ball.v = this.v;
        var v = new_ball.center.copy().minus( this.center );
        v.times( EXPLODE_V_FACTOR );
        v.plus( this.v.copy().times( EXPLODER_PARENT_VELOCITY_FACTOR ) );
        new_ball.v = v;

        frags.push( new_ball );
      }
    }
    return frags;
  }

}
