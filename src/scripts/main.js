var FPS = 60;
var ctx;
var world;
var ball;
var controller;
var canvas;

function mouseDown( e ) {
  controller.mouseDown( e );
  canvas.removeEventListener( "mousedown", mouseDown, false );
  canvas.addEventListener( "mouseup", mouseUp, false );
  // e.preventDefault();
}

function mouseUp( e ) {
  controller.mouseUp( e );
  canvas.removeEventListener( "mouseup", mouseUp, false );
  canvas.addEventListener( "mousedown", mouseDown, false );
}

function mouseMove( e ) {
  controller.mouseMove( canvas, e );
}

function init() {

  world = new World();
  controller = new Controller( world );

  var slider = document.getElementById('slider');
  slider.addEventListener( 'value-change', world.sliding, false );

  setInterval( function() { advance(); }, 1000 / FPS );

  canvas = document.getElementById( 'pizza' );

  canvas.addEventListener( "mousedown", mouseDown, false );
  canvas.addEventListener( "mousemove", mouseMove, false );

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

  world.advance( dt * 0.05 );

  world.draw( ctx );
}
