let ctx;
let world;
let controller;
let canvas;

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
  let FPS = 60;

  world = new World();
  controller = new Controller( world );

  let slider = document.getElementById('slider');
  slider.addEventListener( 'value-change', world.sliding, false );

  canvas = document.getElementById( 'pizza' );

  canvas.addEventListener( "mousedown", mouseDown, false );
  canvas.addEventListener( "mousemove", mouseMove, false );

  ctx = canvas.getContext( '2d' );

  requestAnimationFrame( advance );
}

let previous = null;
function advance() {

  canvas.width  = window.innerWidth * 0.9;
  canvas.height = window.innerHeight * 0.8;
  world.max_x = canvas.width;
  world.max_y = canvas.height;

  let now = window.performance.now();
  let dt = now - previous;
  previous = now;

  let button = document.getElementById('button');
  if ( button.pressed ) {
    world.init();
  }

  world.advance( dt * 0.05 );

  world.draw( ctx );

  requestAnimationFrame( advance );
}
