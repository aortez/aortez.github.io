import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RendererBackend,
  rendererBackendFromSearch,
  urlForRenderer,
} from '../src/scripts/renderers/renderer-factory.js';

test('renderer query selection defaults to WebGL2', () => {
  assert.equal(
    rendererBackendFromSearch( '' ),
    RendererBackend.WEBGL_2,
  );
  assert.equal(
    rendererBackendFromSearch( '?renderer=unknown' ),
    RendererBackend.WEBGL_2,
  );
  assert.equal(
    rendererBackendFromSearch( '?renderer=webgl2' ),
    RendererBackend.WEBGL_2,
  );
  assert.equal(
    rendererBackendFromSearch( '?renderer=canvas2d' ),
    RendererBackend.CANVAS_2D,
  );
});

test('renderer URLs preserve unrelated query parameters', () => {
  const locationLike = {
    href: 'https://example.test/?debug=1#controls',
  };
  const result = new URL( urlForRenderer(
    locationLike,
    RendererBackend.WEBGL_2,
  ) );

  assert.equal( result.searchParams.get( 'debug' ), '1' );
  assert.equal( result.searchParams.get( 'renderer' ), 'webgl2' );
  assert.equal( result.hash, '#controls' );
});
