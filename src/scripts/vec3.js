export class vec3
{
  constructor( x, y, z ) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.cachedRgb = null;
    this.cachedRgbX = null;
    this.cachedRgbY = null;
    this.cachedRgbZ = null;
  }

  copyFrom( that ) {
    this.x = that.x;
    this.y = that.y;
    this.z = that.z;
  }

  copy() {
    let c = new vec3( this.x, this.y, this.z );
    return c;
  }

  set( x, y, z ) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  randColor( variation ) {
    let c = this;
    c.x += Math.floor( variation * ( Math.random() - 0.5 ) );
    c.y += Math.floor( variation * ( Math.random() - 0.5 ) );
    c.z += Math.floor( variation * ( Math.random() - 0.5 ) );
    c.x = Math.min( 255, c.x ); c.x = Math.max( 0, c.x );
    c.y = Math.min( 255, c.y ); c.y = Math.max( 0, c.y );
    c.z = Math.min( 255, c.z ); c.z = Math.max( 0, c.z );
  }

  times( scalar ) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  toRGB() {
    if (
      this.cachedRgb === null ||
      this.cachedRgbX !== this.x ||
      this.cachedRgbY !== this.y ||
      this.cachedRgbZ !== this.z
    ) {
      this.cachedRgb = (
        "rgb(" + this.x + "," + this.y + "," + this.z + ")"
      );
      this.cachedRgbX = this.x;
      this.cachedRgbY = this.y;
      this.cachedRgbZ = this.z;
    }
    return this.cachedRgb;
  }

}
