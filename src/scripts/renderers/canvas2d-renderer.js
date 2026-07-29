export class Canvas2DRenderer
{
  constructor( canvas ) {
    const context = canvas.getContext( '2d' );
    if ( !context ) {
      throw new Error( 'Canvas2D is unavailable' );
    }

    this.backend = 'canvas2d';
    this.canvas = canvas;
    this.context = context;
    this.graphicsInfo = Object.freeze({
      renderer: 'Canvas2D',
      shadingLanguageVersion: null,
      vendor: null,
      version: null,
    });
    this.capabilities = Object.freeze({
      animatedBackground: true,
      debugOverlay: true,
      pizzaTexture: true,
      purpleMode: true,
      quadtreeOverlay: true,
    });
  }

  resize( width, height ) {
    if ( this.canvas.width !== width ) {
      this.canvas.width = width;
    }
    if ( this.canvas.height !== height ) {
      this.canvas.height = height;
    }
  }

  render( world ) {
    const breakdown = world.draw( this.canvas, this.context );
    breakdown.backend = this.backend;
    breakdown.packMs = 0;
    breakdown.uploadMs = 0;
    breakdown.submitMs = breakdown.totalMs;
    return breakdown;
  }

  synchronize() {
    return 0;
  }

  dispose() {}
}
