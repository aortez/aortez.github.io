"use strict";
class vec3
{
  constructor( x, y, z ) {
    this.x = x;
    this.y = y;
    this.z = z;
    // console.log( "x, y: " + x + ", " + y );
  }

  copy() {
    let c = new vec3( this.x, this.y, this.z );
    return c;
  }

  times( scalar ) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  toRGB() {
    let rgb = "rgb(" + this.x + "," + this.y + "," + this.z + ")";
    return rgb;
  }

  // toHex() {
  //   var hex = "0x" + ((1 << 24) + (this.x << 16) + (this.y << 8) + this.z).toString(16).substr(1);
  //   // let hex = "0x" + this.x + "" + this.y + "" + this. z;
  //   console.log( "hex: " + hex + ", color: " + this );
  //   return hex;
  // }

  randColor( variation ) {
    let c = this;
    c.x += Math.floor( variation * ( Math.random() - 0.5 ) );
    c.y += Math.floor( variation * ( Math.random() - 0.5 ) );
    c.z += Math.floor( variation * ( Math.random() - 0.5 ) );
    c.x = Math.min( 255, c.x ); c.x = Math.max( 0, c.x );
    c.y = Math.min( 255, c.y ); c.y = Math.max( 0, c.y );
    c.z = Math.min( 255, c.z ); c.z = Math.max( 0, c.z );
  }

}

class Controller
{
  constructor( world ) {
    this.ball = null;
    this.mousePos = new vec2( 0, 0 );
    this.mouseIsDown = false;
    this.world = world;
    this.cursor_v = new vec2( 0, 0 );
  }

  mouseMove( doc, e ) {
    // let rect = doc.getBoundingClientRect();
    // this.mousePos.x = e.clientX - rect.left;
    // this.mousePos.y = e.clientY - rect.top;
    this.mousePos.x = e.clientX;
    this.mousePos.y = e.clientY - 200;
// ballSprite.position.set( event.clientX, event.clientY, 0 )

    let b = this.ball;
    if ( this.mouseIsDown && b ) {
      // record cursor movement while the button is down
      this.cursor_v = this.mousePos.copy().minus( b.center );

      // keep the ball alive and move it to follow the cursor
      b.hp = b.calcHp() * 1000;
      b.center.x = this.mousePos.x;
      b.center.y = this.mousePos.y;
      b.v.x = 0;
      b.v.y = 0;
    }

  }

  mouseDown( e ) {
    console.log( "mouse down" );
    this.mouseIsDown = true;
    console.log( "mouse pos: " + this.mousePos.x + ", " + this.mousePos.y );

    // check if cursor is over any balls
    let grabbed_ball = this.world.retrieveBall( this.mousePos.x, this.mousePos.y );
    if ( grabbed_ball ) {
      this.ball = grabbed_ball;
    }
    else {
      let r = Math.random() * 10 + 10;
      let c = new vec3( 128, 128, 128 );
      c.randColor( 255 );
      this.ball = new Ball( this.mousePos.x, this.mousePos.y, r, c );
      this.world.addBall( this.ball );
    }
  }

  mouseUp( e ) {
    console.log( "mouse up" );
    this.mouseIsDown = false;

    let b = this.ball;

    // set released ball to full life
    b.hp = b.calcHp();

    // toss it in the direction of recent movement
    b.v = this.cursor_v.copy();

    // clear recent cursor movement so we don't accidentally reuse it
    this.cursor_v = new vec2( 0, 0 );

    // good bye ball
    this.ball = null;
  }

  mouseOut( e ) {
    console.log("mouse out" );
  }

  mouseOver( e ) {
    console.log("mouse over" );
  }

}

class Background
{
  constructor() {
    this.counter = -100;
    this.frameDuration = 0;
    this.dir = 1;
    this.counterMax = 70;
  }

  advance( dt ) {
    this.counter += ( this.dir * dt );
    if ( this.counter > this.counterMax ) this.dir = -1;
    if ( this.counter <= -100 ) this.dir = 1;
  }

  draw() {
    let ratio = canvas.height / canvas.width;

    let num_cols = 20;
    let num_rows = ratio * num_cols;
    let cell_width = canvas.width / num_cols;
    let cell_height = canvas.height / num_rows;

    let red = 0;
    let green = 0;
    let blue = 0;
    let c = ( 255.0 * Math.pow( ( this.counter + 100 ) / ( this.counterMax + 100 ), 4 ) ).toFixed(0);
    ctx.fillStyle = "rgb(" + 0 + "," + c + "," + 0 + ")";
    ctx.fillRect( 0, 0, canvas.width, canvas.height );
    for ( let y = 0; y < num_rows; y++ ) {
      for ( let x = 0.0; x < num_cols; x++ ) {
        red = 0;
        green = this.counter.toFixed(0);
        blue = ( 256.0 * ( (  x + ( x % 2 === 0 ? y : -y ) + this.counter * 0.5 ) / num_cols ) ).toFixed(0);
        let cell_size = Math.pow( blue / 256, 0.1 );
        ctx.fillStyle = "rgb(" + red + "," + green + "," + blue + ")";
        ctx.fillRect( x * cell_width, y * cell_height, cell_width * cell_size, cell_height * cell_size );
      }
    }

  }

}

class Ball
{
  constructor( x, y, r, c ) {
    this.center = new vec2( x, y );
    this.v = new vec2( 0, 0 );
    this.r = r;
    this.color = c;
    this.hp = r * r;
    this.hp_max = r * r;
    this.view_object = null;
  }

  calcHp() {
    let max_hp = this.r * this.r * this.r;
    return max_hp;
  }

  collide( b ) {
    let DAMAGE_SCALAR = 0.0001;
//    let DAMAGE_SCALAR = 0.05;

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
    let m1 = this.calcHp();
    let m2 = b.calcHp();
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

  draw( view ) {
    if ( this.view_object === null ) {
      let radius = this.r;
      let segments = 32;
      let material = new THREE.LineBasicMaterial( { color: new THREE.Color( this.color.toRGB() ) } );
      let geometry = new THREE.CircleGeometry( radius, segments );

      // Remove center vertex
      geometry.vertices.shift();

      this.view_object = new THREE.Line( geometry, material );
      view.addObject( this.view_object );
    }
    this.view_object.position.x = this.center.x;
    this.view_object.position.y = this.center.y;
  }

  explode( n_divs ) {
    let EXPLODER_PARENT_VELOCITY_FACTOR = 0.2;
    let EXPLODER_SIZE_FACTOR = 0.4;
    let EXPLODE_V_FACTOR = 0.4;
    let EXPLODER_SIZE_RANGE_FACTOR = 0.5;
    let N_DIVS = 6;
    let MIN_FRAG_RADIUS = 4;
    if ( n_divs ) {
      // console.log( "ball says: yo: " + n_divs );
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
        let c = this.color.copy();
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


class vec2
{
  constructor( x, y ) {
    this.x = x;
    this.y = y;
    // console.log( "x, y: " + x + ", " + y );
  }

  copy() {
    let c = new vec2( this.x, this.y );
    return c;
  }

  distance( b ) {
    let dx = this.x - b.x;
    let dy = this.y - b.y;
    let d = Math.sqrt( dx * dx + dy * dy );
    return d;
  }

  plus( a ) {
    this.x += a.x;
    this.y += a.y;
    return this;
  }

  minus( a ) {
    this.x -= a.x;
    this.y -= a.y;
    return this;
  }

  times( scalar ) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  div( scalar ) {
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  mag() {
    let m = Math.sqrt( this.x * this.x + this.y * this.y );
    return m;
  }

  dot( b ) {
    let scalarProduct = this.x * b.x + this.y * b.y;
    return scalarProduct;
  }

  normalize() {
    let m = this.mag();
    this.x /= m;
    this.y /= m;
    return this;
  }

}

let NUM_EXPLOD_DIVS = 3;

class World
{
  constructor() {
    this.balls = [];
    this.particles = [];
    this.min_x = -100;
    this.min_y = -100;
    this.max_x = 100;
    this.max_y = 100;
    this.g = 0.2;
    this.c = new vec3( 0, 0, 255 );
    this.n_divs = 3;
    this.init();
    this.background = new Background();
    this.DRAW_BACKGROUND = true;
  }

  init() {
    this.balls = [];
    let pink = new vec3( 255, 50, 50 );
    let blue = new vec3( 0, 0, 255 );
    let b1 = new Ball( -75, 0, 10, pink );
    b1.v.x = 2;
    this.addBall( b1 );

    let b2 = new Ball( 25, 0, 5, blue );
    b2.v.x = -2;
    this.addBall( b2 );

    let b3 = new Ball( -75, 50, 5, pink );
    b3.v.x = 2;
    this.addBall( b3 );

    let b4 = new Ball( 50, 50, 30, blue );
    b4.v.x = 5;
    this.addBall( b4 );
  }

  advance( dt ) {

    if (this.DRAW_BACKGROUND) {
      this.background.advance( dt );
    }

    let MAX_BALLS = 600;
    let MIN_EXPLODER_RADIUS = 10;
    let NEW_PARTICLE_HP = 1;
    let WALL_ELASTIC_FACTOR = 0.9;

    let balls = this.balls;
    for ( let i = 0; i < balls.length; i++ ) {
      let b = balls[ i ];

      // apply downward gravity
      b.v.y -= this.g * dt;

      // move ball
      b.center.plus( b.v.copy().times( dt ) );

      // bounce off walls
      if ( b.center.x + b.r > this.max_x ) { b.center.x = this.max_x - b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y + b.r > this.max_y ) { b.center.y = this.max_y - b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }
      if ( b.center.x - b.r < this.min_x ) { b.center.x = this.min_x + b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y - b.r < this.min_y ) { b.center.y = this.min_y + b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }

      // bounce off other balls
      for ( let j = i + 1; j < balls.length; j++ ) {
        let b2 = balls[ j ];
        if ( b.center.distance( b2.center ) < b.r + b2.r ) {
          b.collide( b2 );
        }
      }
    }

    // remove dead balls from world
    let dead_balls = [];
    for ( let i = balls.length; i--; ) {
      if ( balls[ i ].hp < 0 ) {
        // console.log( "removing dead ball, hp: " + balls.hp );
        dead_balls.push( balls[ i ] );
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
      } else if ( false ) {
        // if they are smaller then they go into the particle loop
        let new_particles = ball.explode();
        for ( let p_index = new_particles.length; p_index--; ) {
          let p = new_particles[ p_index ];

          p.c = new vec3( 255, 255, 255 );
          p.hp_max = NEW_PARTICLE_HP;
          p.hp = NEW_PARTICLE_HP;

          if ( p.r < 2 ) { new_particles.splice( p_index, 1 ); }
        }
        this.particles = this.particles.concat( new_particles );
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
    // console.log( "dt: " + dt );
    for ( let i = this.particles.length; i--; ) {
      let p = this.particles[ i ];

      // fade em
      p.hp = p.hp - ( p.max_hp * dt );

      // move em
      p.v.y += this.g * this.dt;
      p.center.plus( p.v.copy().times( this.dt ) );

      // bounce off walls
      let WALL_ELASTIC_FACTOR = 1;
      if ( p.center.x + p.r > this.max_x ) { p.center.x = this.max_x - p.r; p.v.x = -p.v.x * WALL_ELASTIC_FACTOR; }
      if ( p.center.y + p.r > this.max_y ) { p.center.y = this.max_y - p.r; p.v.y = -p.v.y * WALL_ELASTIC_FACTOR; }
      if ( p.center.x - p.r < this.min_x ) { p.center.x = this.min_x + p.r; p.v.x = -p.v.x * WALL_ELASTIC_FACTOR; }
      if ( p.center.y - p.r < this.min_y ) { p.center.y = this.min_y + p.r; p.v.y = -p.v.y * WALL_ELASTIC_FACTOR; }

      // remove the dead ones
      if ( p.hp <= 0 ) {
        this.particles.splice( i, 1 );
      }
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
    // this.background.draw();

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

class SpaceWorld
{
  constructor() {
    this.balls = [];
    this.particles = [];
    this.min_x = 0;
    this.min_y = 0;
    this.max_x = 100;
    this.max_y = 100;
    this.g = 0.2;
    this.c = new vec3( 0, 0, 255 );
    this.n_divs = 3;
    this.init();

    let red = new vec3( 255, 0, 0 );
    this.sun = new Ball( 500, 500, 50, red );
  }

  init() {
    this.balls = [];
    let pink = new vec3( 255, 50, 50 );
    let blue = new vec3( 0, 0, 255 );
    let b1 = new Ball( 50, 150, 50, pink );
    b1.v.x = 2;
    this.addBall( b1 );

    let b2 = new Ball( 1750, 150, 50, blue );
    b2.v.x = -2;
    this.addBall( b2 );

    let b3 = new Ball( 50, 500, 100, pink );
    b3.v.x = 2;
    this.addBall( b3 );

    let b4 = new Ball( 2000, 500, 100, blue );
    b4.v.x = -2;
    this.addBall( b4 );
  }

  advance( dt ) {
    let MAX_BALLS = 600;
    let MIN_EXPLODER_RADIUS = 20;
    let NEW_PARTICLE_HP = 1;
    let WALL_ELASTIC_FACTOR = 0.9;

    let balls = this.balls;
    for ( let i = 0; i < balls.length; i++ ) {
      let b = balls[ i ];

      // move ball
      b.center.plus( b.v.copy().times( dt ) );

      // bounce off walls
      if ( b.center.x + b.r > this.max_x ) { b.center.x = this.max_x - b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y + b.r > this.max_y ) { b.center.y = this.max_y - b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }
      if ( b.center.x - b.r < this.min_x ) { b.center.x = this.min_x + b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y - b.r < this.min_y ) { b.center.y = this.min_y + b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }

      // interact with other balls
      for ( let j = i + 1; j < balls.length; j++ ) {

        // bounce
        let b2 = balls[ j ];
        if ( b.center.distance( b2.center ) < b.r + b2.r ) {
          b.collide( b2 );
        }
      }

      // orbit sol
      let G = 0.0001;
      let m1 = b.calcHp();
      let m2 = this.sun.calcHp();
      let r = b.center.distance( this.sun.center );
      let angle = b.center.copy().minus( this.sun.center ).normalize();
      let f = angle.times( ( G * m1 * m2 ) / ( r * r ) );
      b.v.minus( f.copy().div( m1 ) );
    }

    // remove dead balls from SpaceWorld
    let dead_balls = [];
    for ( let i = balls.length; i--; ) {
      if ( balls[ i ].hp < 0 ) {
        // console.log( "removing dead ball, hp: " + balls.hp );
        dead_balls.push( balls[ i ] );
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
        // console.log( "SpaceWorld says: this.n_divs: " + this.n_divs + ", foog: " + foog );
        new_balls = new_balls.concat( ball.explode( NUM_EXPLOD_DIVS ) );
        // console.log( "new_balls.length: " + new_balls.length );
      } else if (false) {
        // if they are smaller then they go into the particle loop
        let new_particles = ball.explode();
        for ( let p_index = new_particles.length; p_index--; ) {
          let p = new_particles[ p_index ];

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
    for ( let i = 0; i < new_balls.length; i++ ) {
      if ( this.balls.length >= MAX_BALLS ) { break; }

      this.balls.push( new_balls[ i ] );
    }

    // do particle stuff
    this.advanceParticles( dt );
  }

  advanceParticles( dt ) {
    // console.log( "dt: " + dt );
    for ( let i = this.particles.length; i--; ) {
      let p = this.particles[ i ];

      // fade em
      p.hp = p.hp - ( p.max_hp * dt );

      // move em
      p.v.y += this.g * this.dt;
      p.center.plus( p.v.copy().times( this.dt ) );

      // bounce off walls
      let WALL_ELASTIC_FACTOR = 1;
      if ( p.center.x + p.r > this.max_x ) { p.center.x = this.max_x - p.r; p.v.x = -p.v.x * WALL_ELASTIC_FACTOR; }
      if ( p.center.y + p.r > this.max_y ) { p.center.y = this.max_y - p.r; p.v.y = -p.v.y * WALL_ELASTIC_FACTOR; }
      if ( p.center.x - p.r < this.min_x ) { p.center.x = this.min_x + p.r; p.v.x = -p.v.x * WALL_ELASTIC_FACTOR; }
      if ( p.center.y - p.r < this.min_y ) { p.center.y = this.min_y + p.r; p.v.y = -p.v.y * WALL_ELASTIC_FACTOR; }

      // remove the dead ones
      if ( p.hp <= 0 ) {
        this.particles.splice( i, 1 );
      }
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
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillRect( 0, 0, this.max_x, this.max_y );

    for ( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];
      b.draw( ctx );
    }

    for ( let i = 0; i < this.particles.length; i++ ) {
      let p = this.particles[ i ];
      p.draw( ctx );
    }

    this.sun.draw( ctx );
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

class View
{
  constructor() {
    this.scene = new THREE.Scene();
    let aspect_ratio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera( 100, aspect_ratio, 0.1, 1000 );
    this.camera.position.z = 100;

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( this.renderer.domElement );

    // var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
    // var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 20000;
    // camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);
  }

  addObject( object ) {
    this.scene.add( object );
  }

  clear() {
    this.scene = new THREE.Scene();
  }

  render() {
    this.renderer.render( this.scene, this.camera );
  }

}

let world;
let controller;
let canvas;
let view;

function mouseDown( e ) {
  controller.mouseDown( e );
  document.removeEventListener( "mousedown", mouseDown, false );
  document.addEventListener( "mouseup", mouseUp, false );
  // e.preventDefault();
}

function mouseUp( e ) {
  controller.mouseUp( e );
  document.removeEventListener( "mouseup", mouseUp, false );
  document.addEventListener( "mousedown", mouseDown, false );
}

function mouseMove( e ) {
  controller.mouseMove( document, e );
}

function ball_button( e ) {
  world = new World();
  view.clear();
  controller = new Controller( world );
  console.log( "ball time" );
}

function space_button( e ) {
  world = new SpaceWorld();
  controller = new Controller( world );
  console.log( "space time" );
}

function init() {
  view = new View();

  ball_button();

  console.log( "hello Ramona" );
	document.addEventListener( 'mousedown', mouseDown, false );
  document.addEventListener( "mousemove", mouseMove, false );

  // need to reimplement click on display
  // canvas = document.getElementById( 'pizza' );
  // canvas.addEventListener( "mousedown", mouseDown, false );

  let slider = document.getElementById('slider');
  slider.addEventListener( 'value-change', world.sliding, false );

  requestAnimationFrame( advance );
}

let previous = null;
function advance() {
  let now = window.performance.now();
  let dt = now - previous;
  previous = now;

  world.advance( dt * 0.05 );

  world.draw( view );

  view.render();

  requestAnimationFrame( advance );
}
