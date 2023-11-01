class World
{
  constructor() {
    this.min_x = 0;
    this.min_y = 0;
    this.max_x = 1;
    this.max_y = 1;
    this.g = 0.0005;
    this.c = new vec3( 0, 0, 255 );
    this.n_divs = 3;
    this.init();
    this.background = new Background();
    this.shouldDrawBackground = true;
    this.pizza_time = false;
    this.max_balls = 400;
    this.max_particles = 200;
    this.is_paused = false;
    this.use_quadtree = false;
    this.purple = false;
    this.debug = false;
  }

  init() {
    this.balls = [];
    this.planets = [];
    this.particles = [];

    let pink = new vec3( 255, 50, 50 );
    let blue = new vec3( 0, 0, 255 );
    let green = new vec3( 0, 255, 0 );

    let b1 = new Ball( 0.5, 0.5, 0.1, pink.copy() );
    b1.v.x = 0.001;
    b1.is_affected_by_gravity = true;
    b1.is_moving = true;
    b1.is_invincible = false;
    // this.addBall( b1 );

    // let b2 = new Ball( 1750, 150, 50, blue.copy() );
    // b2.v.x = -20;
    // b2.is_affected_by_gravity = true;
    // b2.is_moving = true;
    // b2.is_invincible = false;
    // this.addBall( b2 );
    //
    // let b3 = new Ball( 50, 500, 200, pink.copy() );
    // b3.v.x = 20;
    // b3.is_affected_by_gravity = true;
    // b3.is_moving = true;
    // b3.is_invincible = false;
    // this.addBall( b3 );
    //
    // let b4 = new Ball( 2000, 500, 50, green.copy() );
    // b4.v.x = -20;
    // b4.is_affected_by_gravity = true;
    // b4.is_moving = true;
    // b4.is_invincible = false;
    // this.addBall( b4 );
  }

  advance( dt ) {
    let particle_dt = dt;
    if ( this.is_paused ) {
      // its sort of cool when we let the object settling process take play while paused
      dt = 0;

      // but instead we delay any world updates at all
      // return;
    }
    this.background.advance( dt * 13 );

    let MIN_BALL_RADIUS = 0.004;
    let MIN_FRAG_RADIUS = 0.001;
    let WALL_ELASTIC_FACTOR = 0.9;

    for ( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];

      // move moving stuff
      if ( b.is_moving ) {
        b.center.plus( b.v.copy().times( dt ) );
      }

      // interact with other balls
      for ( let j = i + 1; j < this.balls.length; j++ ) {
        let b2 = this.balls[ j ];
        // crash em together
        if ( b.center.distance( b2.center ) < b.r + b2.r ) {
          b.collide( b2 );
        }
        // apply gravity
        if ( b.is_affected_by_gravity && b2.is_affected_by_gravity ) {
          // F = (G * m1 * m2) / (Distance^2)
          let d = b.center.distance( b2.center );
          let F = ( this.g * b.m * b2.m ) / ( d * d );
          let a = F / b.m;
          let a2 = F / b2.m;
          let D = ( b2.center.copy().minus( b.center ) ).normalize();
          b.v.plus( D.times( a ) );
          b2.v.minus( D.times( a2 ) );
        }
      }

      // interact with particles
      for ( let j = 0; j < this.particles.length; j++ ) {
        let b2 = this.particles[ j ];
        // possibly collide
        let was_invincible = b.is_invincible;
        let was_moving = b.is_moving;
        b.is_invincible = true;
        b.is_moving = false;
        if ( b.center.distance( b2.center ) < b.r + b2.r ) {
          b.collide( b2 );
        }
        b.is_invincible = was_invincible;
        b.is_moving = was_moving;
        // apply gravity
        if ( b.is_affected_by_gravity && b2.is_affected_by_gravity ) {
          // F = (G * m1 * m2) / (Distance^2)
          let d = b.center.distance( b2.center );
          let F = ( this.g * b.m * b2.m ) / ( d * d );
          let a = F / b.m;
          let a2 = F / b2.m;
          let D = ( b2.center.copy().minus( b.center ) ).normalize();
          b.v.plus( D.times( a ) );
          b2.v.minus( D.times( a2 ) );
        }
      }
    }

    // interact with planets
    for ( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];

      for ( let pIndex = 0; pIndex < this.planets.length; pIndex++ ) {
        let p = this.planets[ pIndex ];
        // apply gravity
        // F = (G * m1 * m2) / (Distance^2)
        let d = b.center.distance( p.center );
        let F = ( this.g * b.m * p.m ) / ( d * d );
        let a = F / b.m;
        let D = ( p.center.copy().minus( b.center ) ).normalize();
        b.v.plus( D.times( a ) );

        // crash em together
        if ( b.center.distance( p.center ) < b.r + p.r ) {
          b.collide( p );
        }
      }
    }

    // bounce off walls...
    // compute wall location
    let max_x = canvas.width / this.getDrawScale();
    let max_y = canvas.height / this.getDrawScale();
    for ( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];

      let fudge = 0.00001; // what is this for?
      if ( b.center.x + b.r >= max_x ) { b.center.x = max_x - b.r - fudge; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y + b.r >= max_y ) { b.center.y = max_y - b.r - fudge; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }
      if ( b.center.x - b.r <= this.min_x ) { b.center.x = this.min_x + b.r + fudge; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y - b.r <= this.min_y ) { b.center.y = this.min_y + b.r + fudge; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }
    }

    // remove dead balls from world
    let dead_balls = [];
    for ( let i = this.balls.length; i--; ) {
      let b = this.balls[ i ];
      if ( !b.is_invincible && b.hp < 0 ) {
        // console.log( "removing dead ball, hp: " + balls.hp );
        dead_balls.push( b );
        this.balls.splice( i, 1 );
      }
    }

    // Deal with the dead balls.
    // Some get removed from the world. Others get exploded into more balls.
    // First though, randomly sort the dead balls. This helps prevent new balls from having a bias
    // toward one direction.
    shuffle(dead_balls);
    let new_balls = [];
    for ( let i = 0; i < dead_balls.length && this.balls.length < this.max_balls; i++ ) {
      let ball = dead_balls[ i ];

      let dead_frags = ball.explode( N_DIVS, MIN_FRAG_RADIUS );
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

    // Add exploded fragments to the main collection.
    // Since we exit early if we're at max capacity, shuffle the new balls to prevent bias from the output
    // from the `explode` function.  Without it, we tend to get a bias toward new balls appearing in one direction.
    shuffle(new_balls);
    for (let i = 0; i < new_balls.length && this.balls.length < this.max_balls; i++) {
      let new_ball = new_balls[ i ];
      this.balls.push( new_ball );
    }

    // do particle stuff
    this.advanceParticles( particle_dt );

    if ( this.balls.length > this.max_balls ) {
      // console.log( "Before: this.balls[0].hp: " + this.balls[0].hp );
      // sort balls by hp
      this.balls.sort( function(a, b) {
        return parseFloat( b.hp ) - parseFloat( a.hp );
      });
      // console.log( "After: this.balls[0].hp: " + this.balls[0].hp );

      // Remove any balls beyond the limit.
      // TODO: There is probably a better way to prune this than in a loop.
      while ( this.balls.length > this.max_balls ) {
        this.balls.splice( this.balls.length - 1, 1 );
      }
    }

  }

  advanceParticles( dt ) {
    // if ( this.particles.length > 0 ) console.log( "num particles: " + this.particles.length );

    for ( let i = this.particles.length; i--; ) {
      let p = this.particles[ i ];
      // fade em 10x faster if past some limit
      let fade_scalar = ( this.particles.length > this.max_particles ) ? 10 : 1;
      p.hp -= 0.0005 * dt * fade_scalar;
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
        let F = ( this.g * p.m * planet.m ) / ( d * d );
        let a = F / p.m;
        let D = ( planet.center.copy().minus( p.center ) ).normalize();
        p.v.plus( D.times( a ) );

        // crash em together
        // if ( p.center.distance( planet.center ) < p.r + planet.r ) {
          p.collide( planet );
          // planet.collide( p );
        // }
      }

      // maybe could apply gravity against other objects
     }
  }

  addBall( b ) {
    console.log( 'adding ball: ' + b.toS() );
    if ( !b ) {
      return;
    }

    if ( this.purple && this.background ) {
      b.color.copyFrom( this.background.rgb );
    }

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

  addPlanet( p ) {
    console.log("adding planet");
    if ( this.purple && this.background ) {
      p.color.copyFrom( this.background.rgb );
    }

    this.planets.push( p );
    if ( !p ) {
      throw("planet NOT added");
    }
  }

  draw( ctx ) {
    if ( this.shouldDrawBackground ) {
      this.background.draw();
    } else {
      ctx.fillStyle = "rgb(" + 0 + "," + 0 + "," + 0 + ")";
      ctx.fillRect( 0, 0, canvas.width, canvas.height );
    }

    for ( let i = 0; i < this.particles.length; i++ ) {
      let p = this.particles[ i ];
      p.draw( ctx, this.getDrawScale(), this.pizza_time );
    }

    for ( let i = 0; i < this.planets.length; i++ ) {
      let p = this.planets[ i ];
      p.draw( ctx, this.getDrawScale(), this.pizza_time );
    }

    if ( !this.use_quadtree ) {
      for ( let i = 0; i < this.balls.length && !this.use_quadtree; i++ ) {
        let b = this.balls[ i ];
        b.draw( ctx, this.getDrawScale(), this.pizza_time );
      }
    } else {
      // lets try drawing the balls with the quadtree...
      // build quadtree
      let qt = new quadtree( this.min_x, this.min_y, this.max_x, this.max_y, 3 );

      // put some objects into the quad tree
      for ( let i = 0; i < this.balls.length; i++ ) {
        let ball = this.balls[ i ];
        if ( qt.fitsInside( ball ) ) {
          qt.insert( ball );
        }
      }

      if (debug_on) {
        console.log( qt.toS() );
      }

      // draw its contained objects
      let objects = qt.getObjectsRecursive();
      for ( let i = 0; i < objects.length; i++ ) {
        objects[ i ].draw( ctx, this.getDrawScale(), false );
        let o = objects[ i ];

        ctx.beginPath();
        let center = new vec2( canvas.width / 2, canvas.height / 2 );
        let corner = new vec2( 0, 0 );
        let radius_scalar = 1 - center.distance( o.center ) / center.distance( corner );
        ctx.arc( o.center.x, o.center.y, o.r * radius_scalar , 0, 2 * Math.PI, false );

        let r = this.background.rgb.x;
        let g = this.background.rgb.y;
        let b = this.background.rgb.z;

        ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
        ctx.fill();
        ctx.stroke();
        ctx.closePath();
      }

      // draw quadtree
      qt.draw( ctx, this.getDrawScale() );
    }

  }

  getDrawBackground() {
    return this.shouldDrawBackground;
  }

  getDrawScale() {
    let scale_factor = Math.max( canvas.width, canvas.height );
    return scale_factor;
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
    this.n_divs = this.n_divs.toFixed( 0 );
    console.log( "sliding: " + this.n_divs );
  }

}
