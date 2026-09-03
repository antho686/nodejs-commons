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

/**
 * Every path the manifest promises, each labelled with where it was promised.
 *
 * A manifest that does not promise what this package is documented to promise
 * is itself the failure: silently returning fewer paths would let the check
 * pass green having verified nothing.
 */
function promisedPaths(pkg) {
  const promises = [];

  for (const field of ['main', 'module', 'types']) {
    if (typeof pkg[field] !== 'string') {
      throw new TypeError(
        `package.json "${field}" must be a string naming an entry point, got ${typeof pkg[field]}.`,
      );
    }
    promises.push({ source: field, path: pkg[field] });
  }

  const walkExports = (node, trail) => {
    if (typeof node === 'string') {
      promises.push({ source: `exports${trail}`, path: node });
      return;
    }
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      throw new TypeError(
        `package.json "exports${trail}" must be a string or an object of conditions, got ${
          Array.isArray(node) ? 'array' : node === null ? 'null' : typeof node
        }.`,
      );
    }
    for (const [condition, child] of Object.entries(node)) {
      walkExports(child, `${trail}[${condition}]`);
    }
  };
  walkExports(pkg.exports, '');

  return promises;
}

const promised = promisedPaths(manifest);
if (promised.length === 0) {
  throw new TypeError('package.json promises no entry points at all; there is nothing to verify.');
}

const missing = [];
for (const { source, path } of promised) {
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

console.log(`\nAll ${promised.length} promised entry points are present in the build output.`);
