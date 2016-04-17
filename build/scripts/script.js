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
    var c = new vec3( this.x, this.y, this.z );
    return c;
  }

  times( scalar ) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  toRGB() {
    var rgb = "rgb(" + this.x + "," + this.y + "," + this.z + ")";
    return rgb;
  }

  randColor( variation ) {
    var c = this;
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

  advance() {
    var b = this.ball;
    if ( this.mouseIsDown && b ) {
    //   ball.c.x = 255;
    //   ball.c.y = green;
    //   ball.c.z = blue;
      b.hp = b.calcHp() * 1000;
      // b.center.x = this.mousePos.x;
      // b.center.y = this.mousePos.y;
      b.v.x = 0;
      b.v.y = 0;
    }
  }

  mouseMove( canvas, e ) {
    var rect = canvas.getBoundingClientRect();
    this.mousePos.x = e.clientX - rect.left;
    this.mousePos.y = e.clientY - rect.top;

    var b = this.ball;
    if ( this.mouseIsDown && b ) {
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

    // check if cursor is over any balls
    var grabbed_ball = this.world.retrieveBall( this.mousePos.x, this.mousePos.y );
    if ( grabbed_ball ) {
      this.ball = grabbed_ball;
    }
    else {
      var r = Math.random() * 50 + 50;
      var c = new vec3( 128, 128, 128 );
      c.randColor( 255 );
      this.ball = new Ball( this.mousePos.x, this.mousePos.y, r, c );
      this.world.addBall( this.ball );
    }
  }

  mouseUp( e ) {
    console.log( "mouse up" );
    this.mouseIsDown = false;

    // set released ball to full life
    this.ball.hp = this.ball.calcHp();
    this.ball = null;
  }

  mouseOut( e ) {
    console.log("mouse out" );
  }

  mouseOver( e ) {
    console.log("mouse over" );
  }

}

var FPS = 60;
var counter = -100;
var ctx;
var frameDuration = 0;
var dir = 1;
var world;
var ball;
var controller;
var canvas;

function mouseDown( e ) {
  controller.mouseDown( e );
  canvas.removeEventListener( "mousedown", mouseDown, false );
  window.addEventListener( "mouseup", mouseUp, false );

  // e.preventDefault();
}

function mouseUp( e ) {
  controller.mouseUp( e );
  window.removeEventListener( "mouseup", mouseUp, false );
  canvas.addEventListener( "mousedown", mouseDown, false );
}

function mouseMove( e ) {
  controller.mouseMove( canvas, e );
}

function mouseOut( e ) {
  controller.mouseOut();
}

function mouseOver( e ) {
  controller.mouseOver();
}

function init() {

  world = new World();
  controller = new Controller( world );

  var slider = document.getElementById('slider');
  slider.addEventListener( 'value-change', world.sliding, false );

  setInterval( function() { advance(); }, 1000 / FPS );

  canvas = document.getElementById( 'pizza' );

  canvas.addEventListener( "mousedown", mouseDown, false );
  window.addEventListener( "mousemove", mouseMove, false );
  canvas.addEventListener( "mouseout", mouseOut, false );
  canvas.addEventListener( "mouseover", mouseOver, false );


  ctx = canvas.getContext( '2d' );
}

var previous = null;
function advance() {

  canvas.width  = window.innerWidth * 0.9;
  canvas.height = window.innerHeight * 0.8;
  world.max_x = canvas.width;
  world.max_y = canvas.height;

  var now = window.performance.now();
  var dt = now - previous;
  previous = now;

  draw( dt * 0.05 );

  controller.advance();

  world.doPhysics( dt * 0.05 );

  world.draw( ctx );
}

function draw( dt )
{
  var start = window.performance.now();

  var canvas = document.getElementById( 'pizza' );
  if ( !canvas.getContext ) {
    return;
  }
  if ( !ctx ) {
    ctx = getContext();
  }

  counter += ( dir * dt );
  var counterMax = 70;
  if ( counter > counterMax ) dir = -1;
  if ( counter <= -100 ) dir = 1;

  var ratio = canvas.height / canvas.width;

  var num_cols = 20;
  var num_rows = ratio * num_cols;
  var cell_width = canvas.width / num_cols;
  var cell_height = canvas.height / num_rows;

  var red = 0;
  var green = 0;
  var blue = 0;
  var c = ( 255.0 * Math.pow( ( counter + 100 ) / ( counterMax + 100 ), 4 ) ).toFixed(0);
  ctx.fillStyle = "rgb(" + 0 + "," + c + "," + 0 + ")";
  ctx.fillRect( 0, 0, canvas.width, canvas.height );
  for ( var y = 0; y < num_rows; y++ ) {
    for ( var x = 0.0; x < num_cols; x++ ) {
      red = 0;
      green = counter.toFixed(0);
      blue = ( 256.0 * ( (  x + ( x % 2 === 0 ? y : -y ) + counter * 0.5 ) / num_cols ) ).toFixed(0);
      var cell_size = Math.pow( blue / 256, 0.1 );
      ctx.fillStyle = "rgb(" + red + "," + green + "," + blue + ")";
      ctx.fillRect( x * cell_width, y * cell_height, cell_width * cell_size, cell_height * cell_size );
    }
  }

  var stop = window.performance.now();
  var elapsed = stop - start;
  frameDuration = 0.99 * frameDuration + 0.01 * elapsed;
  if ( counter % 50 === 0 ) { console.log( "frame duration: " + frameDuration ); }
}

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
    var hp = this.r * this.r;
    return hp;
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
    ctx.fillStyle = "rgb(" + this.c.x + "," + this.c.y + "," + this.c.z + ")";
    ctx.beginPath();
    ctx.arc( this.center.x, this.center.y, this.r, 0, 2 * Math.PI, false );
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
  }

  explode( n_divs ) {
    var EXPLODER_PARENT_VELOCITY_FACTOR = 0.2;
    var EXPLODER_SIZE_FACTOR = 0.4;
    var EXPLODE_V_FACTOR = 0.4;
    var EXPLODER_SIZE_RANGE_FACTOR = 0.5;
    var N_DIVS = 7;
    if ( n_divs ) { N_DIVS = n_divs; console.log( "n_divs: " + n_divs ); }

    var frags = [];
    for ( var y = this.center.y - this.r; y < this.center.y + this.r; y += this.r / N_DIVS ) {
      for ( var x = this.center.x - this.r; x < this.center.x + this.r; x += this.r / N_DIVS ) {
        var new_center = new vec2( x, y );
        if ( new_center.distance( this.center ) > this.r ) continue;

        var r = Math.min( Math.random() + ( 1 - EXPLODER_SIZE_RANGE_FACTOR ) ) * this.r / N_DIVS * EXPLODER_SIZE_FACTOR;
        if ( r < 4 ) continue;
        var c = this.c.copy();
        c.randColor( 100 );

        var new_ball = new Ball( x, y, r, c );

        var v = new_ball.center.copy().minus( this.center );
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
    var c = new vec2( this.x, this.y );
    return c;
  }

  distance( b ) {
    var dx = this.x - b.x;
    var dy = this.y - b.y;
    var d = Math.sqrt( dx * dx + dy * dy );
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

  mag() {
    var m = Math.sqrt( this.x * this.x + this.y * this.y );
    return m;
  }

  dot( b ) {
    var scalarProduct = this.x * b.x + this.y * b.y;
    return scalarProduct;
  }

  normalize() {
    var m = this.mag();
    this.x /= m;
    this.y /= m;
    return this;
  }

}

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
    this.c = new vec3( 0, 0, 255 );
    this.n_divs = 5;
    this.setupBalls();
  }

  setupBalls() {
    var pink = new vec3( 255, 50, 50 );
    var blue = new vec3( 0, 0, 255 );
    var b1 = new Ball( 50, 150, 50, pink );
    b1.v.x = 20;
    b1.hp *= 0.5;
    this.addBall( b1 );

    var b2 = new Ball( 650, 150, 50, blue );
    b2.v.x = -20;
    b2.hp *= 0.5;
    this.addBall( b2 );

    var b3 = new Ball( 50, 500, 100, pink );
    b3.v.x = 20;
    b3.hp *= 0.5;
    this.addBall( b3 );

    var b4 = new Ball( 650, 500, 100, blue );
    b4.v.x = -20;
    b4.hp *= 0.5;
    this.addBall( b4 );
  }

  addBall( b ) {
    console.log("adding ball");
    if ( b ) {
      this.balls.push( b );
      console.log("ball added");
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
    for ( i = balls.length; i--; ) {
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
        new_balls = new_balls.concat( ball.explode( this.n_divs ) );
        // console.log( "new_balls.length: " + new_balls.length );
      } else if (false) {
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

  sliding() {
    this.n_divs = slider.value;
    console.log( "sliding: " + this.n_divs );
  }

}
