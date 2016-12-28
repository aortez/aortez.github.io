var NUM_EXPLOD_DIVS = 3;

class World
{
  constructor() {
    this.min_x = 0;
    this.min_y = 0;
    this.max_x = 100;
    this.max_y = 100;
    this.g = 0.1;
    this.c = new vec3( 0, 0, 255 );
    this.n_divs = 3;
    this.init();
    this.background = new Background();
    this.shouldDrawBackground = true;
    this.pizza_time = false;
    this.max_balls = 400;
  }

  init() {
    this.balls = [];
    this.planets = [];
    this.particles = [];
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

    let MIN_BALL_RADIUS = 6;
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

      // interact with planets
      for ( let pIndex = 0; pIndex < this.planets.length; pIndex++ ) {
        let p = this.planets[ pIndex ];
        // apply gravity
        // F = (G * m1 * m2) / (Distance^2)
        let d = b.center.distance( p.center );
        let G = 1.0;
        let F = ( G * b.m * p.m ) / ( d * d );
        let a = F / b.m;
        let D = ( p.center.copy().minus( b.center ) ).normalize();
        b.v.plus( D.times( a ) );

        // crash em together
        if ( b.center.distance( p.center ) < b.r + p.r ) {
          b.collide( p );
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

    // deal with the dead balls
    // some get removed from the world
    // some get exploded
    let new_balls = [];
    for ( let i = 0; i < dead_balls.length && this.balls.length < this.max_balls; i++ ) {
      let ball = dead_balls[ i ];

      let dead_frags = ball.explode( NUM_EXPLOD_DIVS );
      for ( let frag_index = 0; frag_index < dead_frags.length && this.balls.length < this.max_balls; frag_index++ ) {
        let frag = dead_frags[ frag_index ];
        if ( frag.r >= MIN_BALL_RADIUS ) {
          new_balls.push( frag );
        } else {
          frag.hp = frag.calcHp() * Math.random(); // add randomness to particle lifespan
          this.particles.push( frag );
        }
      }
    }

    // add exploded fragments to the main collection
    for ( let i = 0; i < new_balls.length && this.balls.length < this.max_balls; i++ ) {
      this.balls.push( new_balls[ i ] );
    }

    // do particle stuff
    this.advanceParticles( dt );

    // truncate balls to max
    if ( this.balls.length > this.max_balls ) {
      console.log( "**************** TRUNCATE ****************");
      this.balls = this.balls.slice( 0, this.max_balls.toFixed( 0 ) );
    }
  }

  advanceParticles( dt ) {
    // if ( this.particles.length > 0 ) console.log( "num particles: " + this.particles.length );

    for ( let i = this.particles.length; i--; ) {
      let p = this.particles[ i ];
      // fade em
      p.hp -= 0.05 * dt;
      // remove the dead ones
      if ( p.hp <= 0 ) {
        this.particles.splice( i, 1 );
        continue;
      }
      // move em
      p.center.plus( p.v.copy().times( dt ) );

      // interact with planets
      for ( let pIndex = 0; pIndex < this.planets.length; pIndex++ ) {
        let planet = this.planets[ pIndex ];

        // apply gravity
        let d = p.center.distance( planet.center );
        let G = 1.0;
        let F = ( G * p.m * planet.m ) / ( d * d );
        let a = F / p.m;
        let D = ( planet.center.copy().minus( p.center ) ).normalize();
        p.v.plus( D.times( a ) );

        // crash em together
        if ( p.center.distance( planet.center ) < p.r + planet.r ) {
          p.collide( planet );
        }
      }

      // maybe could apply gravity against other ojects
      }
  }

  addBall( b ) {
    console.log( 'adding ball' );
    if ( b ) {
       // if there is capacity, just add the ball
      if ( this.balls.length < this.max_balls ) {
        this.balls.push( b );
        console.log( 'ball added' );
      } else {
        // if we've exceeded capacity, replace a random ball
        let ball_index = Math.trunc( Math.random() * this.balls.length );
        this.balls[ ball_index ] = b;
        console.log( 'ball added, displacing ball at index: ' + ball_index );
      }

    }
  }

  addPlanet( p ) {
    console.log("adding planet");
    this.planets.push( p );
    if ( !p ) {
      console.log("planet NOT added");
    }
  }

  draw( ctx ) {
    if ( this.shouldDrawBackground ) {
      this.background.draw();
    } else {
      ctx.fillStyle = "rgb(" + 0 + "," + 0 + "," + 0 + ")";
      ctx.fillRect( 0, 0, canvas.width, canvas.height );
    }

    for ( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];
      b.draw( ctx, this.pizza_time );
    }

    for ( let i = 0; i < this.particles.length; i++ ) {
      let p = this.particles[ i ];
      p.draw( ctx, false );
    }

    for ( let i = 0; i < this.planets.length; i++ ) {
      let p = this.planets[ i ];
      p.draw( ctx, this.pizza_time );
    }

  }

  getDrawBackground() {
    return this.shouldDrawBackground;
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

    for( let i = 0; i < this.planets.length; i++ ) {
      let p = this.planets[ i ];

      let dist = pos.distance( p.center );
      if ( dist <= p.r ) {
        return p;
      }
    }


    return null;
  }

  setDrawBackground( shouldDrawBackground ) {
    this.shouldDrawBackground = shouldDrawBackground;
  }

  sliding( e ) {
    this.n_divs = e.currentTarget.value;
    NUM_EXPLOD_DIVS = this.n_divs;
    console.log( "sliding: " + this.n_divs );
  }

}
