var ObjectType = {
  NONE: 1,
  BALL: 2,
  PLANET: 3
};

var EXPLODE_V_FACTOR = 0.1;
var EXPLODER_SIZE_FACTOR = 1.5;
var N_DIVS = 2;
var TIMESCALE_SCALAR = 0.3;

class Controller
{
  constructor( world ) {
    this.ball = null;
    this.mousePos = new vec2( 0, 0 );
    this.mouseIsDown = false;
    this.world = world;
    this.cursor_v = new vec2( 0, 0 );
    this.next_object_type = ObjectType.BALL;
    this.dt = 0;
  }

  advance( dt ) {
    this.dt = dt;

    // If the user is mouse down on a ball, move it to follow the cursor.
    let b = this.ball;
    if ( this.mouseIsDown && b ) {
      // Compute the vector from the ball to the mouse.
      let d = this.mousePos.copy().minus( b.center );
      let distance = d.mag();
      // console.log("d: " + d + "mousePos: " + this.mousePos.toString());

      // Normalize to the direction component.
      if ( distance > 0 ) {
        d.normalize();
      }

      // The velocity will be relative to the distance to the mouse.
      // But let's clamp it, such that whenever the mouse is outside the ball's radius, this is the max speed.
      // Anything closer will be relatively slower.
      if ( distance > b.r ) {
        distance = b.r;
        // console.log("d2: " + d + ", d2.mag(): " + d.mag() + ", b.r: " + b.r, ", ball.m: " + b.m);
      }

      // Thus, at the max distance, with a force of 1, the velocity will be enough to move
      // a ball of mass 1 to the mouse in 1 second. However, a mass of 1 is pretty big, as the mass is the square of the
      // radius and the world is 1.0 x 1.0.  So let's use a value that is relative to the expected masses
      // (something significantly less than 1.0).
      // TODO: Maybe parameterize with a slider.
      let f = 0.05;

      // Apply a force to the ball in the direction of the mouse.
      // f = m * a
      // a = f / m
      // v = a * t ... thus:
      // v = f / m * t
      let v = d.times( f / b.m ).times( distance );

      // Do a bit of smoothing. It gives it a nice rubbery feel.
      let alpha = 0.80;
      this.cursor_v.times( alpha ).plus( v.times( 1 - alpha ) );

      // Manually apply the velocity to the ball.
      b.center.plus( this.cursor_v.copy().times( this.dt ) );
    }
  }

  debug() {
    // this.world.debug = true;
    debug_on = true;
    console.log('debug it all');
    this.world.draw( ctx );
    debug_on = false;
    // this.world.debug = false;
  }

  pause() {
    world.is_paused = !world.is_paused;
  }

  quadtree() {
    world.use_quadtree = !world.use_quadtree;
  }

  mouseMove( canvas, e ) {
    // Compute the mouse location in world coordinates.
    let rect = canvas.getBoundingClientRect();

    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    this.mousePos.x = x / this.world.getDrawScale();
    this.mousePos.y = y / this.world.getDrawScale();
  }

  mouseDown( e ) {
    console.log( "mouse down" );

    // If cursor is over a ball, grab it, otherwise create a new one.
    let x = this.mousePos.x;
    let y = this.mousePos.y;
    let grabbed_ball = this.world.retrieveBall( x, y );
    if ( grabbed_ball ) {
      console.log("grabbed");
      this.ball = grabbed_ball;
      this.ball.is_moving = false;
      this.ball.v = this.cursor_v;
    } else {
      let r = Math.random() * 0.07 + 0.01;
      let c = new vec3( 128, 128, 128 );
      c.randColor( 255 );
      this.ball = new Ball( x, y, r, c );
      if ( this.next_object_type == ObjectType.PLANET ) {
        this.ball.r = this.ball.r * 2;
        this.ball.is_affected_by_gravity = true;
        this.ball.m = this.ball.r * 5;
        this.ball.hp = this.ball.r * 10000;
        this.ball.is_moving = false;
        this.ball.is_invincible = true;
        this.world.addPlanet( this.ball );
        console.log("adding planet");
      } else {
        this.ball.is_affected_by_gravity = true;
        this.ball.v = this.cursor_v;
        this.ball.is_moving = false;
        this.ball.is_invincible = true;
        this.ball.can_move = true;
        this.world.addBall( this.ball );
        console.log("adding ball");
      }
    }
    this.mouseIsDown = true;
  }

  mouseUp( e ) {
    console.log( "mouse up" );
    if ( !this.mouseIsDown ) {
      console.log( "mouse is _not_ down" );
      return;
    }
    this.mouseIsDown = false;

    let b = this.ball;

    // set released ball to full life
    b.hp = b.calcHp();

    // make it mortal
    b.is_invincible = false;

    // Let the normal physics take over.
    b.is_moving = true;

    // clear recent cursor movement so we don't accidentally reuse it
    this.cursor_v = new vec2( 0, 0 );

    // good bye ball
    this.ball = null;
  }

  mouseOut( e ) {
    console.log( "mouse OUT" );
    if ( this.mouseIsDown ) {
      this.mouseUp( e );
    }
  }

  mouseOver( e ) {
    console.log( "mouse over" );
  }

  requestPlanet() {
    console.log( "I want a planet!!!!!!!!!!!!" );
    this.next_object_type = ObjectType.PLANET;
  }

  requestBall() {
    console.log( "I want a ball &&&&&&&&&&&&&&" );
    this.next_object_type = ObjectType.BALL;
  }

  purple() {
    console.log( "purple" );

    // flip the purple flag
    this.world.purple = !this.world.purple;

    // react to the new state...
    // when we turn the world purple, turn all the balls purple
    if ( this.world.purple ) {
      let bg = this.world.background;
      for ( let i = 0; i < this.world.balls.length; i++ ) {
        let b = this.world.balls[ i ];
        b.color.copyFrom( bg.rgb );
        bg.advance( this.dt );
        bg.draw(ctx);
      }
      // planets also
      for ( let i = 0; i < this.world.planets.length; i++ ) {
        let p = this.world.planets[ i ];
        p.color.copyFrom( bg.rgb );
        bg.advance( this.dt );
        bg.draw(ctx);
      }
    }
    // and when the world turns back from purple...
    else {
      for ( let i = 0; i < this.world.balls.length; i++ ) {
        let b = this.world.balls[ i ];
        b.color.set( 128, 128, 128 );
        b.color.randColor( 255 );
      }
      // planets also
      for ( let i = 0; i < this.world.planets.length; i++ ) {
        let p = this.world.planets[ i ];
        p.color.set( 128, 128, 128 );
        p.color.randColor( 255 );
      }
    }
  }

  explodeSlider( e ) {
    EXPLODE_V_FACTOR = e.currentTarget.value;
    console.log( "EXPLODE_V_FACTOR: " + EXPLODE_V_FACTOR );
  }

  exploderSizeSlider( e ) {
    EXPLODER_SIZE_FACTOR = e.currentTarget.value;
    console.log( "EXPLODER_SIZE_FACTOR: " + EXPLODER_SIZE_FACTOR );
  }

  timescaleSlider( e ) {
    TIMESCALE_SCALAR = e.currentTarget.value;
    console.log( "TIMESCALE_SCALAR: " + TIMESCALE_SCALAR );
  }

}
