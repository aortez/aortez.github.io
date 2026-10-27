import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { addFrameApp, releaseArchiveUrl } from '../tools/frame-app.mjs';

function directory( t, files ) {
  const path = mkdtempSync( join( tmpdir(), 'frame-app-' ) );
  t.after( () => rmSync( path, { recursive: true, force: true } ) );
  for ( const [ name, body ] of Object.entries( files ) ) {
    mkdirSync( dirname( join( path, name ) ), { recursive: true } );
    writeFileSync( join( path, name ), body );
  }
  return path;
}

function release( t ) {
  const source = directory( t, { 'assets/frame-1.js': 'app', 'frame/index.html': 'frame', 'wifi/index.html': 'wifi' } );
  const archive = execFileSync( 'tar', [ '-czf', '-', '-C', source, 'assets', 'frame', 'wifi' ] );
  return { archive, sha256: createHash( 'sha256' ).update( archive ).digest( 'hex' ) };
}

test('the pinned archive is added beside the site build', t => {
  const { archive, sha256 } = release( t );
  const dist = directory( t, { 'index.html': 'site', 'assets/main-1.js': 'site' } );
  addFrameApp( archive, sha256, dist );
  assert.equal( readFileSync( join( dist, 'frame/index.html' ), 'utf8' ), 'frame' );
  assert.equal( readFileSync( join( dist, 'assets/frame-1.js' ), 'utf8' ), 'app' );
  assert.equal( readFileSync( join( dist, 'assets/main-1.js' ), 'utf8' ), 'site' );
  assert.equal(
    releaseArchiveUrl( 'app-v0.2.2' ),
    'https://github.com/aortez/inky-soup/releases/download/app-v0.2.2/frame-web.tar.gz',
  );
});

test('a different archive, or a site file in its place, is refused before extracting', t => {
  const { archive, sha256 } = release( t );
  const dist = directory( t, { 'frame/index.html': 'old copy' } );
  assert.throws( () => addFrameApp( archive, 'a'.repeat( 64 ), dist ), /pins a{64}/ );
  assert.throws( () => addFrameApp( archive, sha256, dist ), /already has frame\/index\.html/ );
  assert.equal( readFileSync( join( dist, 'frame/index.html' ), 'utf8' ), 'old copy' );
  assert.equal( existsSync( join( dist, 'wifi/index.html' ) ), false );
});
