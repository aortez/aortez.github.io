class Controller
{
  constructor( world ) {
    this.ball = null;
    this.mousePos = new vec2( 0, 0 );
    this.mouseIsDown = false;
    this.world = world;
    console.log("hello from Controller");
    console.log("this.mousePos: " + this.mousePos);
  }

  mouseMove( canvas, evt ) {
    var rect = canvas.getBoundingClientRect();
    this.mousePos.x = evt.clientX - rect.left;
    this.mousePos.y = evt.clientY - rect.top;

    var b = this.ball;
    if ( this.mouseIsDown && b ) {
    //   ball.c.x = 255;
    //   ball.c.y = green;
    //   ball.c.z = blue;
      b.hp = b.calcHp() * 1000;
      var alpha = 0.05;
      b.v.x = ( 1 - alpha ) * b.v.x + alpha * ( this.mousePos.x - b.center.x );
      b.v.y = ( 1 - alpha ) * b.v.y + alpha * ( this.mousePos.y - b.center.y );
      b.center.x = this.mousePos.x;
      b.center.y = this.mousePos.y;
    }
    
  }

  mouseDown( e ) {
    console.log( "mouse down" );
    this.mouseIsDown = true;

    // check if cursor is over any balls
    var grabbed_ball = this.world.retrieveBall( this.mousePos.x, this.mousePos.y );
    if ( grabbed_ball ) {
      ball = grabbed_ball;
    }
    else {
      var r = Math.random() * 50 + 50;
      var c = new vec3( 255, 0, 0 );
      this.ball = new Ball( this.mousePos.x, this.mousePos.y, r, c );
      this.world.addBall( this.ball );
    }
  }

  mouseUp( e ) {
    console.log( "mouse up" );
    this.mouseIsDown = false;

    // what is this stuff doing?
    this.ball.hp = this.ball.calcHp();
    var alpha = 1;
    this.ball.v.x = ( 1 - alpha ) * this.ball.v.x + alpha * ( this.mousePos.x - this.ball.center.x );
    this.ball.v.y = ( 1 - alpha ) * this.ball.v.y + alpha * ( this.mousePos.y - this.ball.center.y );
  }

}
