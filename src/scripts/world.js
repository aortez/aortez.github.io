class World
{
  constructor() {
    this.balls = [];
    this.particles = [];
    this.min_x = 0;
    this.min_y = 0;
    this.max_x = 100;
    this.max_y = 100;
    this.g = 0.2;
    this.dt = 0.2;
    this.c = new vec3( 0, 0, 255 );

    this.setupBalls();
  }

  setupBalls() {
    var b1 = new Ball( 50, 150, 50, new vec3( 0, 255, 0 ) );
    b1.v.x = 20;
    b1.hp *= 0.5;
    this.addBall( b1 );

    var b2 = new Ball( 650, 150, 50, new vec3( 255, 255, 0 ) );
    b2.v.x = -20;
    b2.hp *= 0.5;
    this.addBall( b2 );

    var b3 = new Ball( 50, 500, 100, new vec3( 0, 255, 0 ) );
    b3.v.x = 20;
    b3.hp *= 0.5;
    this.addBall( b3 );

    var b4 = new Ball( 650, 500, 100, new vec3( 255, 255, 0 ) );
    b4.v.x = -20;
    b4.hp *= 0.5;
    this.addBall( b4 );
  }

  addBall( b ) {
    if ( b ) {
      this.balls.push( b );
    }
  }

  draw( ctx ) {
    for ( var i = 0; i < this.balls.length; i++ ) {
      var b = this.balls[ i ];
      b.draw( ctx );
    }

    for ( i = 0; i < this.particles.length; i++ ) {
      var p = this.particles[ i ];
      p.draw( ctx );
    }
  }

  doPhysics( dt ) {
    var MAX_BALLS = 800;
    var MIN_EXPLODER_RADIUS = 10;
    var NEW_PARTICLE_HP = 1;
    var WALL_ELASTIC_FACTOR = 0.9;

    var balls = this.balls;
    for ( var i = 0; i < balls.length; i++ ) {
      var b = balls[ i ];

      // move ball
      b.v.y += this.g * dt;
      b.center.plus( b.v.copy().times( dt ) );

      // bounce off walls
      if ( b.center.x + b.r > this.max_x ) { b.center.x = this.max_x - b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y + b.r > this.max_y ) { b.center.y = this.max_y - b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }
      if ( b.center.x - b.r < this.min_x ) { b.center.x = this.min_x + b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y - b.r < this.min_y ) { b.center.y = this.min_y + b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }

      // bounce off other balls
      for ( var j = i + 1; j < balls.length; j++ ) {
        var b2 = balls[ j ];
        if ( b.center.distance( b2.center ) < b.r + b2.r ) {
          b.collide( b2 );
        }
      }

    }

    // remove dead balls from world
    var dead_balls = [];
    for( i = balls.length; i--; ) {
      if ( balls[ i ].hp < 0 ) {
        // console.log( "removing dead ball, hp: " + balls.hp );
        dead_balls.push( balls[ i ] );
        balls.splice( i, 1 );
      }
    }

    // ok, now we have these dead balls, what to do with them?
    var new_balls = [];
    for ( i = 0; i < dead_balls.length; i++ ) {
      var ball = dead_balls[ i ];

      // if they are big enough, then lets blow them into smaller pieces
      if ( ball.r > MIN_EXPLODER_RADIUS ) {
        // console.log( "exploded - r: " + ball.r );
        new_balls = new_balls.concat( ball.explode() );
        // console.log( "new_balls.length: " + new_balls.length );
      } else {
        // if they are smaller then they go into the particle loop
        var new_particles = ball.explode();
        for ( var p_index = new_particles.length; p_index--; ) {
          var p = new_particles[ p_index ];

          p.c = new vec3( 255, 255, 255 );
          p.hp_max = NEW_PARTICLE_HP;
          p.hp = NEW_PARTICLE_HP;
          // p.r = 50;
          // if ( p.r < 50 ) { p.hp = 0; }
          if ( p.r < 2 ) { new_particles.splice( p_index, 1 ); }
        }
        this.particles = this.particles.concat( new_particles );
        // console.log( "to particles - r: " + ball.r );
        // console.log( "particles.length: " + new_balls.length );
      }
    }

    // add exploded fragments to the main collection
    for ( i = 0; i < new_balls.length; i++ ) {
      if ( this.balls.length >= MAX_BALLS ) { break; }

      this.balls.push( new_balls[ i ] );
    }

    // do particle stuff
    this.advanceParticles( dt );
  }

  advanceParticles( dt ) {
    // console.log( "dt: " + dt );
    for ( var i = this.particles.length; i--; ) {
      var p = this.particles[ i ];

      // fade em
      p.hp = p.hp - ( p.max_hp * dt );

      // move em
      p.v.y += this.g * this.dt;
      p.center.plus( p.v.copy().times( this.dt ) );

      // bounce off walls
      var WALL_ELASTIC_FACTOR = 1;
      if ( p.center.x + p.r > this.max_x ) { p.center.x = this.max_x - p.r; p.v.x = -p.v.x * WALL_ELASTIC_FACTOR; }
      if ( p.center.y + p.r > this.max_y ) { p.center.y = this.max_y - p.r; p.v.y = -p.v.y * WALL_ELASTIC_FACTOR; }
      if ( p.center.x - p.r < this.min_x ) { p.center.x = this.min_x + p.r; p.v.x = -p.v.x * WALL_ELASTIC_FACTOR; }
      if ( p.center.y - p.r < this.min_y ) { p.center.y = this.min_y + p.r; p.v.y = -p.v.y * WALL_ELASTIC_FACTOR; }

      // remove the dead ones
      if ( p.hp <= 0 ) {
        // console.log( "removing dead particle, hp: " + p.hp );
        this.particles.splice( i, 1 );
      }
    }
  }

  retrieveBall( x, y ) {
    var pos = new vec2( x, y );

    for( var i = 0; i < this.balls.length; i++ ) {
      var b = this.balls[ i ];
      
      var dist = pos.distance( b.center );
      if ( dist <= b.r ) {
        return b;
      }
    }

    return null;
  }

}
