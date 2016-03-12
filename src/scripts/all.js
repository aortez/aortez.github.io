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