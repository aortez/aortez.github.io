class World
{
  constructor() {
    this.balls = [];
    this.min_x = 0;
    this.min_y = 0;
    this.max_x = 100;
    this.max_y = 100;
    this.g = 0.2;
  }

  addBall( b ) {
    if ( b ) {
      this.balls.push( b );
    }
  }

  draw( ctx ) {
    for ( var i = 0; i < this.balls.length; i++ ) {
      this.balls[ i ].draw( ctx );
    }
  }

  doPhysics() {
    for ( var i = 0; i < this.balls.length; i++ ) {
      var b = this.balls[ i ];

      // move ball
      b.v.y += this.g;
      b.center.plus( b.v );

      // bounce off walls
      var damp_factor = 0.9;
      if ( b.center.x + b.r > this.max_x ) { b.center.x = this.max_x - b.r; b.v.x = -b.v.x * damp_factor; }
      if ( b.center.y + b.r > this.max_y ) { b.center.y = this.max_y - b.r; b.v.y = -b.v.y * damp_factor; }
      if ( b.center.x - b.r < this.min_x ) { b.center.x = this.min_x + b.r; b.v.x = -b.v.x * damp_factor; }
      if ( b.center.y - b.r < this.min_y ) { b.center.y = this.min_y + b.r; b.v.y = -b.v.y * damp_factor; }

      // bounce off other balls
      for ( var j = i + 1; j < this.balls.length; j++ ) {
        var b2 = this.balls[ j ];
        if ( b.center.distance( b2.center ) < b.r + b2.r ) {
          b.v.x = -b.v.x;
          b.v.y = -b.v.y;
          b2.v.x = -b2.v.x;
          b2.v.y = -b2.v.y;
          b.collide( b2 );
        }
      }

    }
  }

}
