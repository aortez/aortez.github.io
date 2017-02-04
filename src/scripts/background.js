class Background
{
  constructor() {
    this.counter = -100;
    this.frameDuration = 0;
    this.dir = 1;
    this.counterMax = 70;
    this.rgb = new vec3();
  }

  advance( dt ) {
    this.counter += ( this.dir * dt );
    if ( this.counter > this.counterMax ) this.dir = -1;
    if ( this.counter <= -100 ) this.dir = 1;
  }

  draw() {
    let ratio = canvas.height / canvas.width;

    let num_cols = 20;
    let num_rows = ratio * num_cols;
    let cell_width = canvas.width / num_cols;
    let cell_height = canvas.height / num_rows;

    let red = 0;
    let green = 0;
    let blue = 0;
    let c = ( 255.0 * Math.pow( ( this.counter + 100 ) / ( this.counterMax + 100 ), 4 ) ).toFixed(0);
    ctx.fillStyle = "rgb(" + 0 + "," + c + "," + 0 + ")";
    ctx.fillRect( 0, 0, canvas.width, canvas.height );
    for ( let y = 0; y < num_rows; y++ ) {
      for ( let x = 0.0; x < num_cols; x++ ) {
        red = 0;
        green = this.counter.toFixed(0);
        blue = ( 256.0 * ( (  x + ( x % 2 === 0 ? y : -y ) + this.counter * 0.5 ) / num_cols ) ).toFixed(0);
        let cell_size = Math.pow( blue / 256, 0.1 );
        ctx.fillStyle = "rgb(" + red + "," + green + "," + blue + ")";
        ctx.fillRect( x * cell_width, y * cell_height, cell_width * cell_size, cell_height * cell_size );
      }
    }

    blue = 128;
    // red = (Math.random() * 256).toFixed(0);

    this.rgb.x = red;
    this.rgb.y = green;
    this.rgb.z = blue;
  }

}
