#!/usr/bin/env bash
#
# Reports where this package publishes to, read from package.json, on
# $GITHUB_OUTPUT as:
#
#   registry=<publishConfig.registry>
#   scope=<the scope of the package name, e.g. @antho686>
#
# `npm publish` obeys `publishConfig.registry`, so setup-node is configured
# from the same field rather than from a second copy of the URL that could
# drift away from it.

set -euo pipefail

registry=$(node -p "
  const { publishConfig } = require('./package.json');
  const registry = publishConfig && publishConfig.registry;
  if (typeof registry !== 'string' || registry === '') {
    throw new TypeError('package.json must set publishConfig.registry to the registry to publish to.');
  }
  registry;
")

scope=$(node -p "
  const { name } = require('./package.json');
  if (typeof name !== 'string' || !name.startsWith('@') || !name.includes('/')) {
    throw new TypeError(\`package.json name must be scoped to publish to a scoped registry, got \${name}.\`);
  }
  name.split('/')[0];
")

echo "Publishing $scope packages to $registry."
echo "registry=$registry" >> "$GITHUB_OUTPUT"
echo "scope=$scope" >> "$GITHUB_OUTPUT"
