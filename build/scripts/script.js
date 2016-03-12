"use strict";
var FPS = 60;
var counter = -100;
var ctx;
var frameDuration = 0;
var dir = 1;
var mousePos = { x: 0, y: 0 };
var mouseIsDown = false;
var world;

var ball;
var c = "rgb(255,0,0)";

function writeMessage( canvas, message )
{
  var context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '18pt Calibri';
  context.fillStyle = 'black';
  context.fillText(message, 10, 25);
}

function getMousePos( canvas, evt )
{
  var rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

function init()
{
  world = new World();

  setInterval( function() { draw(); }, 1000 / FPS );

  var canvas = document.getElementById( 'pizza' );
  if ( !canvas.getContext )
  {
    return;
  }

  canvas.onmousedown = function( e ) {
      // dragOffset.x = e.x - mainLayer.trans.x;
      // dragOffset.y = e.y - mainLayer.trans.y;
      console.log( "mouse down" );
      mouseIsDown = true;

      ball = new Ball( mousePos.x, mousePos.y, 50, c );
  };

  canvas.onmouseup = function( e ) {
    console.log( "mouse up" );
    mouseIsDown = false;

    if ( ball ) {
      world.addBall( ball );
      ball = undefined;
    }
  };

  canvas.onmousemove = function( evt ) {
    mousePos = getMousePos( canvas, evt );
    // var message = 'Mouse position: ' + mousePos.x + ',' + mousePos.y;
    // writeMessage( canvas, message );
  };

  canvas.onmouseout = function( evt ) {
    mouseIsDown = false;
    if ( ball ) {
      world.addBall( ball );
      ball = undefined;
    }
  };

  ctx = canvas.getContext( '2d' );
}

function draw()
{
  var start = window.performance.now();

  var canvas = document.getElementById( 'pizza' );
  if ( !canvas.getContext )
  {
    return;
  }
  if ( !ctx )
  {
    ctx = getContext();
  }

  counter += dir;
  var counterMax = 70;
  if ( counter > counterMax ) dir = -1;
  if ( counter <= -100 ) dir = 1;

  canvas.width  = window.innerWidth * 0.9;
  canvas.height = window.innerHeight * 0.9;
  world.max_x = canvas.width;
  world.max_y = canvas.height;
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
  for ( var y = 0; y < num_rows; y++ )
  {
    for ( var x = 0.0; x < num_cols; x++ )
    {
      red = 0;
      green = counter.toFixed(0);
      blue = ( 256.0 * ( (  x + ( x % 2 === 0 ? y : -y ) + counter * 0.5 ) / num_cols ) ).toFixed(0);
      var cell_size = Math.pow( blue / 256, 0.1 );
      ctx.fillStyle = "rgb(" + red + "," + green + "," + blue + ")";
      ctx.fillRect( x * cell_width, y * cell_height, cell_width * cell_size, cell_height * cell_size );
    }
  }

  if ( mouseIsDown )
  {
    red += 90 + Math.abs( counter );
    c = "rgb(" + red + "," + green + "," + blue + ")";
    ball.c = c;
    var alpha = 0.05;
    ball.xv = ( 1 - alpha ) * ball.xv + alpha * ( mousePos.x - ball.x );
    ball.yv = ( 1 - alpha ) * ball.yv + alpha * ( mousePos.y - ball.y );

    ball.x += ball.xv;
    ball.y += ball.yv;

    ball.draw( ctx );
  }

  world.doPhysics();
  world.draw( ctx );

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
          b.collide( b2 );
        }
      }

    }
  }

}
