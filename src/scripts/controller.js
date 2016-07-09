class Controller
{
  constructor( world ) {
    this.ball = null;
    this.mousePos = new vec2( 0, 0 );
    this.mouseIsDown = false;
    this.world = world;
    this.cursor_v = new vec2( 0, 0 );
  }

  mouseMove( doc, e, view ) {

    // translate into world space
    var vector = new THREE.Vector3();
    vector.set(
        ( event.clientX / window.innerWidth ) * 2 - 1,
        - ( event.clientY / window.innerHeight ) * 2 + 1,
        0.5 );
    let camera = view.camera;
    vector.unproject( camera );
    let dir = vector.sub( camera.position ).normalize();
    let distance = - camera.position.z / dir.z;
    let pos = camera.position.clone().add( dir.multiplyScalar( distance ) );
    // console.log( pos );

    this.mousePos.x = pos.x;
    this.mousePos.y = pos.y;

    // if mouse button is down, move any ball under the cursor
    let b = this.ball;
    if ( this.mouseIsDown && b ) {
      // record cursor movement while the button is down
      this.cursor_v = this.mousePos.copy().minus( b.center );

      // keep the ball alive and move it to follow the cursor
      b.hp = b.calcHp() * 1000;
      b.center.x = this.mousePos.x;
      b.center.y = this.mousePos.y;
      b.v.x = 0;
      b.v.y = 0;
    }

  }

  mouseDown( e ) {
    console.log( "mouse down" );
    this.mouseIsDown = true;
    console.log( "mouse pos: " + this.mousePos.x + ", " + this.mousePos.y );

    // check if cursor is over any balls
    let grabbed_ball = this.world.retrieveBall( this.mousePos.x, this.mousePos.y );
    if ( grabbed_ball ) {
      this.ball = grabbed_ball;
    }
    else {
      let r = Math.random() * 10 + 10;
      let c = new vec3( 128, 128, 128 );
      c.randColor( 255 );
      this.ball = new Ball( this.mousePos.x, this.mousePos.y, r, c );
      this.world.addBall( this.ball );
    }
  }

  mouseUp( e ) {
    console.log( "mouse up" );
    this.mouseIsDown = false;

    let b = this.ball;

    // set released ball to full life
    b.hp = b.calcHp();

    // toss it in the direction of recent movement
    b.v = this.cursor_v.copy();

    // clear recent cursor movement so we don't accidentally reuse it
    this.cursor_v = new vec2( 0, 0 );

    // good bye ball
    this.ball = null;
  }

  mouseOut( e ) {
    console.log("mouse out" );
  }

  mouseOver( e ) {
    console.log("mouse over" );
  }

}
