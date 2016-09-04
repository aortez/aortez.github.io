var NUM_EXPLOD_DIVS = 3;

class World
{
  constructor() {
    this.balls = [];
    this.planets = [];
    this.particles = [];
    this.min_x = 0;
    this.min_y = 0;
    this.max_x = 100;
    this.max_y = 100;
    this.g = 0.1;
    this.c = new vec3( 0, 0, 255 );
    this.n_divs = 3;
    this.init();
    this.background = new Background();
  }

  init() {
    this.balls = [];
    let pink = new vec3( 255, 50, 50 );
    let blue = new vec3( 0, 0, 255 );
    let b1 = new Ball( 50, 150, 50, pink );
    b1.v.x = 20;
    b1.is_affected_by_gravity = true;
    b1.is_moving = true;
    b1.is_invincible = false;
    this.addBall( b1 );

    let b2 = new Ball( 1750, 150, 50, blue );
    b2.v.x = -20;
    b2.is_affected_by_gravity = true;
    b2.is_moving = true;
    b2.is_invincible = false;
    this.addBall( b2 );

    let b3 = new Ball( 50, 500, 100, pink );
    b3.v.x = 20;
    b3.is_invincible = false;
    this.addBall( b3 );

    let b4 = new Ball( 2000, 500, 100, blue );
    b4.v.x = -20;
    b4.is_invincible = false;
    this.addBall( b4 );
  }

  advance( dt ) {
    this.background.advance( dt );

    let MAX_BALLS = 700;
    let MIN_EXPLODER_RADIUS = 25;
    let NEW_PARTICLE_HP = 1;
    let WALL_ELASTIC_FACTOR = 0.9;

    let balls = this.balls;
    for ( let i = 0; i < balls.length; i++ ) {
      let b = balls[ i ];

      // move moving stuff
      if ( b.is_moving ) {
        b.center.plus( b.v.copy().times( dt ) );
      }

      // bounce off walls
      if ( b.center.x + b.r > this.max_x ) { b.center.x = this.max_x - b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y + b.r > this.max_y ) { b.center.y = this.max_y - b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }
      if ( b.center.x - b.r < this.min_x ) { b.center.x = this.min_x + b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y - b.r < this.min_y ) { b.center.y = this.min_y + b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }

      // interact with other balls
      for ( let j = i + 1; j < balls.length; j++ ) {
        let b2 = balls[ j ];
        // crash em together
        if ( b.center.distance( b2.center ) < b.r + b2.r ) {
          b.collide( b2 );
        }
        // apply gravity
        if ( b.is_affected_by_gravity && b2.is_affected_by_gravity ) {
          // F = (G * m1 * m2) / (Distance^2)
          let d = b.center.distance( b2.center );
          let G = 1.0;
          let F = ( G * b.m * b2.m ) / ( d * d );
          let a = F / b.m;
          let a2 = F / b2.m;
          let D = ( b2.center.copy().minus( b.center ) ).normalize();
          b.v.plus( D.times( a ) );
          b2.v.minus( D.times( a2 ) );
        }
      }
    }

    // remove dead balls from world
    let dead_balls = [];
    for ( let i = balls.length; i--; ) {
      let b = balls[ i ];
      if ( !b.is_invincible && b.hp < 0 ) {
        // console.log( "removing dead ball, hp: " + balls.hp );
        dead_balls.push( b );
        balls.splice( i, 1 );
      }
    }

    // ok, now we have these dead balls, what to do with them?
    let new_balls = [];
    for ( let i = 0; i < dead_balls.length; i++ ) {
      let ball = dead_balls[ i ];

      // if they are big enough, then lets blow them into smaller pieces
      if ( ball.r > MIN_EXPLODER_RADIUS ) {
        // console.log( "exploded - r: " + ball.r );
        // console.log( "world says: this.n_divs: " + this.n_divs + ", foog: " + foog );
        new_balls = new_balls.concat( ball.explode( NUM_EXPLOD_DIVS ) );
        // console.log( "new_balls.length: " + new_balls.length );
      } else { //if ( ball.r > 1 ) {
        // if they are smaller then they go into the particle loop
        let new_particles = ball.explode( 2 );
        for ( let p_index = new_particles.length; p_index--; ) {
          let p = new_particles[ p_index ];

          // p.c = new vec3( 255, 255, 255 );
          p.hp_max = NEW_PARTICLE_HP;
          p.hp = NEW_PARTICLE_HP;
        }
        this.particles = this.particles.concat( new_particles );
        // console.log( "to particles - r: " + ball.r );
        // console.log( "particles.length: " + new_balls.length );
      }
    }

    // add exploded fragments to the main collection
    for ( let i = 0; i < new_balls.length; i++ ) {
      if ( this.balls.length >= MAX_BALLS ) { break; }

      this.balls.push( new_balls[ i ] );
    }

    // do particle stuff
    this.advanceParticles( dt );
  }

  advanceParticles( dt ) {
    // if ( this.particles.length > 0 ) console.log( "num particles: " + this.particles.length );

    for ( let i = this.particles.length; i--; ) {
      let p = this.particles[ i ];
      // fade em
      p.hp -= 0.02 * dt;
      // remove the dead ones
      if ( p.hp <= 0 ) {
        this.particles.splice( i, 1 );
        continue;
      }
      // move em
      // p.v.y += this.g * dt;
      p.center.plus( p.v.copy().times( dt ) );

      // bounce off walls
      // let WALL_ELASTIC_FACTOR = 1;
      // if ( p.center.x + p.r > this.max_x ) { p.center.x = this.max_x - p.r; p.v.x = -p.v.x * WALL_ELASTIC_FACTOR; }
      // if ( p.center.y + p.r > this.max_y ) { p.center.y = this.max_y - p.r; p.v.y = -p.v.y * WALL_ELASTIC_FACTOR; }
      // if ( p.center.x - p.r < this.min_x ) { p.center.x = this.min_x + p.r; p.v.x = -p.v.x * WALL_ELASTIC_FACTOR; }
      // if ( p.center.y - p.r < this.min_y ) { p.center.y = this.min_y + p.r; p.v.y = -p.v.y * WALL_ELASTIC_FACTOR; }
    }
  }

  addBall( b ) {
    console.log("adding ball");
    if ( b ) {
      this.balls.push( b );
      console.log("ball added");
    }
  }

  draw( ctx ) {
    this.background.draw();

    for ( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];
      b.draw( ctx );
    }

    for ( let i = 0; i < this.particles.length; i++ ) {
      let p = this.particles[ i ];
      p.draw( ctx );
    }
  }

  retrieveBall( x, y ) {
    let pos = new vec2( x, y );

    for( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];

      let dist = pos.distance( b.center );
      if ( dist <= b.r ) {
        return b;
      }
    }

    return null;
  }

  sliding( e ) {
    this.n_divs = e.currentTarget.value;
    NUM_EXPLOD_DIVS = this.n_divs;
    console.log( "sliding: " + this.n_divs );
  }

}
