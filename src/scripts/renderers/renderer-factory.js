import { Canvas2DRenderer } from './canvas2d-renderer.js';
import { WebGL2Renderer } from './webgl2-renderer.js';

export const RendererBackend = Object.freeze({
  CANVAS_2D: 'canvas2d',
  WEBGL_2: 'webgl2',
});

export function normalizeRendererBackend( value ) {
  return value === RendererBackend.WEBGL_2
    ? RendererBackend.WEBGL_2
    : RendererBackend.CANVAS_2D;
}

export function rendererBackendFromSearch( search = '' ) {
  const parameters = new URLSearchParams( search );
  return normalizeRendererBackend( parameters.get( 'renderer' ) );
}

export function urlForRenderer( locationLike, backend ) {
  const url = new URL( locationLike.href );
  url.searchParams.set( 'renderer', normalizeRendererBackend( backend ) );
  return url.toString();
}

export function createRenderer( canvas, requestedBackend ) {
  const normalizedBackend = normalizeRendererBackend( requestedBackend );
  if ( normalizedBackend === RendererBackend.WEBGL_2 ) {
    try {
      return {
        fallbackReason: null,
        renderer: new WebGL2Renderer( canvas ),
        requestedBackend: normalizedBackend,
      };
    } catch ( error ) {
      const fallbackReason = error instanceof Error
        ? error.message
        : String( error );
      return {
        fallbackReason,
        renderer: new Canvas2DRenderer( canvas ),
        requestedBackend: normalizedBackend,
      };
    }
  }

  return {
    fallbackReason: null,
    renderer: new Canvas2DRenderer( canvas ),
    requestedBackend: normalizedBackend,
  };
}
