var ObjectType = {
  NONE: 1,
  BALL: 2,
  PLANET: 3
};

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

    let b = this.ball;
    if ( this.mouseIsDown && b ) {
      b.hp = b.calcHp() * 1000;
    }
  }

  pause() {
    world.is_paused = !world.is_paused;
  }

  quadtree() {
    world.use_quadtree = !world.use_quadtree;
  }

  mouseMove( canvas, e ) {
    let rect = canvas.getBoundingClientRect();
    this.mousePos.x = e.clientX - rect.left;
    this.mousePos.y = e.clientY - rect.top;

    let b = this.ball;
    if ( this.mouseIsDown && b ) {
      // record cursor movement while the button is down
      let d = this.mousePos.copy().minus( b.center );
      let alpha = 0.5;
      this.cursor_v.x = this.cursor_v.x * ( 1 - alpha ) + alpha * d.x;
      this.cursor_v.y = this.cursor_v.y * ( 1 - alpha ) + alpha * d.y;

      // keep the ball alive and move it to follow the cursor
      b.hp = b.calcHp() * 1000;
      b.center.x = b.center.x + this.cursor_v.x;
      b.center.y = b.center.y + this.cursor_v.y;
    }

  }

  mouseDown( e ) {
    console.log( "mouse down" );
    this.mouseIsDown = true;

    // check if cursor is over any balls
    let grabbed_ball = this.world.retrieveBall( this.mousePos.x, this.mousePos.y );
    if ( grabbed_ball ) {
      console.log("grabbed");
      this.ball = grabbed_ball;
    } else {
      let r = Math.random() * 50 + 50;
      let c = new vec3( 128, 128, 128 );
      c.randColor( 255 );
      this.ball = new Ball( this.mousePos.x, this.mousePos.y, r, c );
      if ( this.next_object_type == ObjectType.PLANET ) {
        this.ball.r = this.ball.r * 2;
        this.ball.is_affected_by_gravity = true;
        this.ball.m = this.ball.r * this.ball.r * 10;
        this.ball.hp = this.ball.r * this.ball.r * 10000;
        this.ball.is_moving = false;
        this.ball.is_invincible = true;
        this.world.addPlanet( this.ball );
        console.log("adding planet");
      } else {
        this.ball.is_affected_by_gravity = true;
        this.ball.v = this.cursor_v;
        this.ball.m = this.ball.r * this.ball.r;
        this.ball.is_moving = false;
        this.ball.is_invincible = false;
        this.ball.can_move = true;
        this.world.addBall( this.ball );
        console.log("adding ball");
      }
    }
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

    // toss it in the direction of recent movement
    b.v = this.cursor_v.copy();
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
    }
    // and when the world turns back from purple...
    else {
      for ( let i = 0; i < this.world.balls.length; i++ ) {
        let b = this.world.balls[ i ];
        b.color.set( 128, 128, 128 );
        b.color.randColor( 255 );
      }
    }
  }
}
