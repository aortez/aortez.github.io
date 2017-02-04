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
  var rect = canvasDom.getBoundingClientRect();
  return {
    x: touchEvent.touches[0].clientX - rect.left,
    y: touchEvent.touches[0].clientY - rect.top
  };
}

function init() {
  let FPS = 60;

  world = new World();
  world.init();
  controller = new Controller( world );

  let slider = document.getElementById( 'slider' );
  slider.addEventListener( 'value-change', world.sliding, false );
  slider.value = N_DIVS;

  let explode_slider = document.getElementById( 'explode_slider' );
  explode_slider.addEventListener( 'value-change', controller.explodeSlider, false );
  explode_slider.value = 0.5;

  let exploder_size_slider = document.getElementById( 'exploder_size_slider' );
  exploder_size_slider.addEventListener( 'value-change', controller.exploderSizeSlider, false );
  exploder_size_slider.value = EXPLODER_SIZE_FACTOR;

  let timescale_slider = document.getElementById( 'timescale_slider' );
  timescale_slider.addEventListener( 'value-change', controller.timescaleSlider, false );
  timescale_slider.value = TIMESCALE_SCALAR;

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
    controller.purple();
  });

  document.getElementById( 'debug_button' ).addEventListener( 'click', function() {
    controller.debug();
  });

  requestAnimationFrame( advance );
}

let previous = null;
let smoothed_fps = 0;
function advance() {

  let controls_height = document.getElementById('controls_div').offsetHeight + document.getElementById('controls_div2').offsetHeight;
  let pizza_height = document.getElementById('pizza').offsetHeight;
  let fps_height = document.getElementById('fps_div').offsetHeight;
  canvas.height = window.innerHeight - ( fps_height + controls_height + 30 );
  canvas.width  = window.innerWidth * 0.9;
  // world.max_x = canvas.width;
  // world.max_y = canvas.height;

  let now = window.performance.now();
  let dt = now - previous;
  previous = now;

  controller.advance( dt * 0.05 );

  world.advance( dt * 0.05 * TIMESCALE_SCALAR );

  world.draw( ctx );

  let fps = 1000.0 / dt;
  let fps_alpha = 0.1;
  smoothed_fps = smoothed_fps * ( 1 - fps_alpha ) + fps * fps_alpha;
  updateInfoLabel( smoothed_fps );

  if ( smoothed_fps < 45 ) {
    if ( world.max_balls > 75 ) {
      world.max_balls -= 5;
    }
    if ( world.max_particles > 50 ) {
      world.max_particles -= 5;
    }
  } else {
    if ( world.max_balls < 400 ) {
      world.max_balls += 0.1;
    }
    if ( world.max_particles < 200 ) {
      world.max_particles += 1;
    }
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
