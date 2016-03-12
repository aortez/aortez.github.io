class Ball
{
  constructor( x, y, r, c ) {
    this.center = new vec2( x, y );
    this.v = new vec2( 0, 0 );
    this.r = r;
    this.c = c;
  }

  draw( ctx ) {
    ctx.fillStyle = this.c;

    ctx.beginPath();
    ctx.arc( this.center.x, this.center.y, this.r, 0, 2 * Math.PI, false );
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
  }

  collide( b ) {
    // distance between centers
    var D = this.center.copy().minus( b.center );

    // test to see if circles are in the exact same spot
    var delta = D.mag();
    while ( delta === 0 ) {
      var max_jitter = 0.01;
      // give the other object a small random jitter
      b.center.x += Math.random() * max_jitter;
      b.center.y += Math.random() * max_jitter;
      D = this.center.copy().minus( b.mCenter );
      delta = D.center.mag();
    }
    console.log( "collision!" );

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
    //   mCenter += ( mT * m2 / M );
    //   b.mCenter -= ( mT * m1 / M  );
    // 63
    // 64     // the velocity vectors of the balls before the collision
    // 65     const Vec2f v1 = mVelocity;
    // 66     const Vec2f v2 = b.mVelocity;
    // 67
    // 68     // damage the circles based upon their momentum
    // 69     const float p1 = m1 * v1.magnitude();
    // 70     const float p2 = m2 * v2.magnitude();
    // 71     mHP -= p1;
    // 72     b.mHP -= p2;
    // 73
    // 74     // The tangential vector of the collision plane
    // 75     const Vec2f Dt( Dn.Y, -Dn.X );
    // 76
    // 77     // split the velocity vector of the first ball into a normal and a tangential component in respect of the collision plane
    // 78     const Vec2f v1n = Dn * dot( v1, Dn );
    // 79     const Vec2f v1t = Dt * dot( v1, Dt );
    // 80
    // 81     // split the velocity vector of the second ball into a normal and a tangential component in respect of the collision plane
    // 82     const Vec2f v2n = Dn * dot( v2, Dn );
    // 83     const Vec2f v2t = Dt * dot( v2, Dt );
    // 84
    // 85     // calculate new velocity vectors of the balls, the tangential component stays the same, the normal component changes
    // 86     mVelocity = v1t + Dn * ( ( m1 - m2 ) / M * v1n.magnitude() + 2 * m2 / M * v2n.magnitude() );
    // 87     b.mVelocity = v2t - Dn * ( (m2 - m1) / M * v2n.magnitude() + 2 * m1 / M * v1n.magnitude() );
    // 88 }

  }

}
