#!/usr/bin/env bash
#
# Publishes the package, and reports on $GITHUB_OUTPUT whether it actually
# published:
#
#   published=true|false
#
# `false` means the registry refused the version as already present, which is a
# routine skip rather than a failure — see the lookup's counterpart in
# resolve-publish-decision.sh. Any other failure exits non-zero.
#
# Only a `published=true` may lead to a tag: the tag claims the version is in
# the registry, so nothing but a real publish may create one.
#
# Expects NODE_AUTH_TOKEN to be set for the registry.

set -euo pipefail

publish_log="$(mktemp)"

set +e
npm publish 2>&1 | tee "$publish_log"
status=${PIPESTATUS[0]}
set -e

if [ "$status" -eq 0 ]; then
  echo "published=true" >> "$GITHUB_OUTPUT"
elif grep -qiE 'EPUBLISHCONFLICT|cannot publish over|409 Conflict' "$publish_log"; then
  echo "already published, skipping: the registry refused this version as already present."
  echo "published=false" >> "$GITHUB_OUTPUT"
else
  echo "The publish failed for a reason other than the version already existing."
  exit 1
fi
