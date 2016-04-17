class Background
{
  constructor() {
    this.counter = -100;
    this.frameDuration = 0;
    this.dir = 1;
    this.counterMax = 70;
  }

  advance( dt ) {
    this.counter += ( this.dir * dt );
    if ( this.counter > this.counterMax ) this.dir = -1;
    if ( this.counter <= -100 ) this.dir = 1;
  }

  draw() {
    var ratio = canvas.height / canvas.width;

    var num_cols = 20;
    var num_rows = ratio * num_cols;
    var cell_width = canvas.width / num_cols;
    var cell_height = canvas.height / num_rows;

    var red = 0;
    var green = 0;
    var blue = 0;
    var c = ( 255.0 * Math.pow( ( this.counter + 100 ) / ( this.counterMax + 100 ), 4 ) ).toFixed(0);
    ctx.fillStyle = "rgb(" + 0 + "," + c + "," + 0 + ")";
    ctx.fillRect( 0, 0, canvas.width, canvas.height );
    for ( var y = 0; y < num_rows; y++ ) {
      for ( var x = 0.0; x < num_cols; x++ ) {
        red = 0;
        green = this.counter.toFixed(0);
        blue = ( 256.0 * ( (  x + ( x % 2 === 0 ? y : -y ) + this.counter * 0.5 ) / num_cols ) ).toFixed(0);
        var cell_size = Math.pow( blue / 256, 0.1 );
        ctx.fillStyle = "rgb(" + red + "," + green + "," + blue + ")";
        ctx.fillRect( x * cell_width, y * cell_height, cell_width * cell_size, cell_height * cell_size );
      }
    }

  }

}
