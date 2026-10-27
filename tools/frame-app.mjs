// Adds /frame/, /setup/, and /wifi/ to dist/ from the inky-soup release pinned in frame-app.json.
// inky-soup owns and tests these pages; see its app/README.md.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath( new URL( '..', import.meta.url ) );

export function releaseArchiveUrl( tag ) {
  return `https://github.com/aortez/inky-soup/releases/download/${tag}/frame-web.tar.gz`;
}

// Refuses an archive that differs from the pin, or one that would replace a file the site built itself.
export function addFrameApp( archive, sha256, dist ) {
  const actual = createHash( 'sha256' ).update( archive ).digest( 'hex' );
  if ( actual !== sha256 ) {
    throw new Error( `The Frame app archive has SHA-256 ${actual}, but frame-app.json pins ${sha256}.` );
  }
  const entries = execFileSync( 'tar', [ '-tzf', '-' ], { input: archive, encoding: 'utf8' } ).split( '\n' ).filter( Boolean );
  const clashes = entries.filter( entry => !entry.endsWith( '/' ) && existsSync( join( dist, entry ) ) );
  if ( clashes.length ) {
    throw new Error( `The site's own build already has ${clashes.join( ', ' )}; the Frame app must come only from its release.` );
  }
  execFileSync( 'tar', [ '-xzf', '-', '-C', dist ], { input: archive } );
  return entries;
}

async function main() {
  const { tag, sha256 } = JSON.parse( readFileSync( join( root, 'frame-app.json' ), 'utf8' ) );
  const url = releaseArchiveUrl( tag );
  const response = await fetch( url );
  if ( !response.ok ) throw new Error( `Could not download ${url}: HTTP ${response.status}.` );
  const entries = addFrameApp( Buffer.from( await response.arrayBuffer() ), sha256, join( root, 'dist' ) );
  console.log( `Added ${entries.filter( entry => !entry.endsWith( '/' ) ).length} Frame app files from inky-soup ${tag}.` );
}

if ( process.argv[1] && import.meta.url === pathToFileURL( process.argv[1] ).href ) await main();
