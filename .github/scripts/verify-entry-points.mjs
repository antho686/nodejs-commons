/**
 * Fails the publish run if the build did not produce every entry point the
 * package promises: the `main`, `module` and `types` fields, plus each path
 * named by a condition in the `exports` map.
 *
 * A build that silently emitted nothing must fail here rather than reach a
 * consumer. This deliberately does not assert on an ESM `type: module` marker
 * file — that file does not exist, and the reason is recorded in antho686/nodejs-commons#2.
 */

import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));

/** Every path the manifest promises, each labelled with where it was promised. */
function promisedPaths(pkg) {
  const promises = [];

  for (const field of ['main', 'module', 'types']) {
    if (typeof pkg[field] === 'string') {
      promises.push({ source: field, path: pkg[field] });
    }
  }

  const walkExports = (node, trail) => {
    if (typeof node === 'string') {
      promises.push({ source: `exports${trail}`, path: node });
      return;
    }
    if (node && typeof node === 'object') {
      for (const [condition, child] of Object.entries(node)) {
        walkExports(child, `${trail}[${condition}]`);
      }
    }
  };
  walkExports(pkg.exports, '');

  return promises;
}

const missing = [];
for (const { source, path } of promisedPaths(manifest)) {
  const absolute = join(repositoryRoot, path);
  let isFile = false;
  try {
    isFile = statSync(absolute).isFile();
  } catch (error) {
    // A missing file is the case this check exists to catch. Anything else —
    // a permission error, an I/O error — is not evidence about the build and
    // must not be reported as a missing entry point.
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  if (isFile) {
    console.log(`ok   ${source} -> ${path}`);
  } else {
    console.error(`MISSING ${source} -> ${path}`);
    missing.push(`${source} -> ${path}`);
  }
}

if (missing.length > 0) {
  console.error(
    `\nThe build did not produce ${missing.length} promised entry point(s):\n  ${missing.join('\n  ')}`,
  );
  process.exit(1);
}

console.log('\nEvery promised entry point is present in the build output.');
