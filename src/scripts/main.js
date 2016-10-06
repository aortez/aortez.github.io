let ctx;
let world;
let controller;
let canvas;

function mouseDown( e ) {
  controller.mouseDown( e );
  canvas.removeEventListener( "mousedown", mouseDown, false );
  canvas.addEventListener( "mouseup", mouseUp, false );
  e.preventDefault();
}

function mouseUp( e ) {
  controller.mouseUp( e );
  canvas.removeEventListener( "mouseup", mouseUp, false );
  canvas.addEventListener( "mousedown", mouseDown, false );
}

function mouseOut( e ) {
  controller.mouseOut( e );
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
  canvas.addEventListener( "mouseout", mouseOut, false );

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

  let reset_button = document.getElementById('reset_button');
  if ( reset_button.pressed ) {
    world.init();
  }

  let planet_button = document.getElementById('planet_button');
  if ( planet_button.pressed ) {
    controller.requestPlanet();
  }

  let ball_button = document.getElementById('ball_button');
  if ( ball_button.pressed ) {
    controller.requestBall();
  }

  world.advance( dt * 0.05 );

  world.draw( ctx );

  updateInfoLabel( dt );

  requestAnimationFrame( advance );
}

let smoothed_fps = 0;
function updateInfoLabel( dt ) {
  let fps = 1000.0 / dt;
  let alpha = 0.1;
  smoothed_fps = smoothed_fps * (1 - alpha) + fps * alpha;
  let new_fps = (smoothed_fps).toFixed(0);
  let fps_label = document.getElementById('fps_label');
  fps_label.innerHTML = "fps: " + new_fps + " ";

  let num_balls_label = document.getElementById('num_balls_label');
  num_balls_label.innerHTML = "num balls: " + world.balls.length;
}
