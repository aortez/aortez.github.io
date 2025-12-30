import { World } from './world.js';
import { Controller } from './controller.js';

let ctx;
let world;
let controller;
let canvas;

function mouseDown( e ) {
  controller.mouseDown( e );
  canvas.removeEventListener( 'mousedown', mouseDown, false );
  canvas.addEventListener( 'mouseup', mouseUp, false );
  e.preventDefault();
}

function mouseUp( e ) {
  controller.mouseUp( e );
  canvas.removeEventListener( 'mouseup', mouseUp, false );
  canvas.addEventListener( 'mousedown', mouseDown, false );
}

function mouseOut( e ) {
  controller.mouseOut( e );
}

function mouseMove( e ) {
  controller.mouseMove( canvas, e );
}

function getTouchPos(canvasDom, touchEvent) {
  let rect = canvasDom.getBoundingClientRect();
  return {
    x: touchEvent.touches[0].clientX - rect.left,
    y: touchEvent.touches[0].clientY - rect.top
  };
}

export function init() {
  let FPS = 60;

  world = new World();
  world.init();
  controller = new Controller( world );

  let slider = document.getElementById( 'slider' );
  slider.addEventListener( 'input', (e) => {
    world.N_DIVS = parseInt(e.currentTarget.value);
    console.log( "N_DIVS: " + world.N_DIVS );
  }, false );
  slider.value = world.N_DIVS;

  let explode_slider = document.getElementById( 'explode_slider' );
  explode_slider.addEventListener( 'input', (e) => {
    world.EXPLODE_V_FACTOR = parseFloat(e.currentTarget.value);
    console.log( "EXPLODE_V_FACTOR: " + world.EXPLODE_V_FACTOR );
  }, false );
  explode_slider.value = world.EXPLODE_V_FACTOR;

  let exploder_size_slider = document.getElementById( 'exploder_size_slider' );
  exploder_size_slider.addEventListener( 'input', (e) => {
    world.EXPLODER_SIZE_FACTOR = parseFloat(e.currentTarget.value);
    console.log( "EXPLODER_SIZE_FACTOR: " + world.EXPLODER_SIZE_FACTOR );
  }, false );
  exploder_size_slider.value = world.EXPLODER_SIZE_FACTOR;

  let timescale_slider = document.getElementById( 'timescale_slider' );
  let timescale_scalar = 0.3;
  timescale_slider.addEventListener( 'input', (e) => {
    timescale_scalar = parseFloat(e.currentTarget.value);
    console.log( "TIMESCALE_SCALAR: " + timescale_scalar );
  }, false );
  timescale_slider.value = timescale_scalar;

  canvas = document.getElementById( 'pizza' );
  canvas.addEventListener( 'mousedown', mouseDown, false );
  canvas.addEventListener( 'mousemove', mouseMove, false );
  canvas.addEventListener( 'mouseout', mouseOut, false );
  canvas.addEventListener( 'touchstart', function (e) {
    if ( e.target == canvas ) { e.preventDefault(); }
    var touch = e.touches[ 0 ];
    var mouseEvent = new MouseEvent( 'mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
    }, false
  );
  canvas.addEventListener( 'touchend', function ( e ) {
      if ( e.target == canvas ) { e.preventDefault(); }
      var mouseEvent = new MouseEvent( 'mouseup', {} );
      canvas.dispatchEvent( mouseEvent );
    }, false
  );
  canvas.addEventListener( 'touchmove', function ( e ) {
    if ( e.target == canvas ) { e.preventDefault(); }
    var touch = e.touches[ 0 ];
    var mouseEvent = new MouseEvent( 'mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
    }, false
  );

  ctx = canvas.getContext( '2d' );

  document.getElementById( 'background_button' ).addEventListener( 'click', function() {
    world.setDrawBackground( !world.getDrawBackground() );
  });

  document.getElementById( 'pizza_button' ).addEventListener( 'click', function() {
    world.pizza_time = !world.pizza_time;
  });

  document.getElementById( 'reset_button' ).addEventListener( 'click', function() {
    world.init();
  });

  document.getElementById( 'planet_button' ).addEventListener( 'click', function() {
    controller.requestPlanet();
  });

  document.getElementById( 'ball_button' ).addEventListener( 'click', function() {
    controller.requestBall();
  });

  document.getElementById( 'pause_button' ).addEventListener( 'click', function() {
    controller.pause();
  });

  document.getElementById( 'quadtree_button' ).addEventListener( 'click', function() {
    controller.quadtree();
  });

  document.getElementById( 'purple_button' ).addEventListener( 'click', function() {
    controller.purple(canvas, ctx);
  });

  document.getElementById( 'debug_button' ).addEventListener( 'click', function() {
    controller.debug(canvas, ctx);
  });

  let previous = null;
  let smoothed_fps = 0;

  function advance() {
    canvas.height = window.innerHeight - document.getElementById('controls').offsetHeight - 30;
    canvas.width = document.body.clientWidth;

    let now = window.performance.now();
    let dt = now - previous;
    previous = now;

    let BASE_TIMESTEP_SCALAR = 0.003;
    controller.advance( dt * BASE_TIMESTEP_SCALAR );

    world.advance( dt * BASE_TIMESTEP_SCALAR * timescale_scalar, canvas );

    world.draw( canvas, ctx );

    let fps = 1000.0 / dt;
    let fps_alpha = 0.1;
    smoothed_fps = smoothed_fps * ( 1 - fps_alpha ) + fps * fps_alpha;
    updateInfoLabel( smoothed_fps );

    if ( smoothed_fps < 45 ) {
      if ( world.max_balls > 75 ) {
        world.max_balls -= 10;
      }
      if ( world.max_particles > 50 ) {
        world.max_particles -= 5;
      }
    } else {
      if ( world.max_balls < 300 ) {
        world.max_balls += 0.1;
      }
      if ( world.max_particles < 300 ) {
        world.max_particles += 1;
      }
    }

    requestAnimationFrame( advance );
  }

  requestAnimationFrame( advance );
}

function updateInfoLabel( fps ) {
  let fps_label = document.getElementById( 'fps_label' );
  fps_label.innerHTML = 'fps: ' + fps.toFixed( 0 ) + ' ';

  let num_balls_label = document.getElementById( 'num_balls_label' );
  num_balls_label.innerHTML = 'num balls: ' + world.balls.length + ' / ' + world.max_balls.toFixed( 0 );

  let num_particles_label = document.getElementById( 'num_particles_label' );
  num_particles_label.innerHTML = 'num particles: ' + world.particles.length + ' / ' + world.max_particles.toFixed( 0 );
}
