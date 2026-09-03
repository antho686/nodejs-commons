#!/usr/bin/env bash
#
# Decides whether the version in package.json still needs publishing, and
# reports the decision to the workflow on $GITHUB_OUTPUT as:
#
#   version=<the version in package.json>
#   should-publish=true|false
#
# Exits non-zero when the registry does not give an answer about the version at
# all — an authentication or network failure must never be mistaken for a
# routine skip. Expects NODE_AUTH_TOKEN to be set for the registry lookup.

set -uo pipefail

error_log="$(mktemp)"
name=$(node -p "require('./package.json').name")
version=$(node -p "require('./package.json').version")
echo "version=$version" >> "$GITHUB_OUTPUT"
echo "Looking up $name@$version in GitHub Packages."

set +e
published=$(npm view "$name@$version" version --json 2>"$error_log")
status=$?
set -e

if [ "$status" -eq 0 ] && [ -n "$published" ] && [ "$published" != "null" ]; then
  # The registry answered, and the version is there.
  echo "already published, skipping: $name@$version is already in the registry."
  echo "should-publish=false" >> "$GITHUB_OUTPUT"
elif [ "$status" -eq 0 ] || grep -qE 'E404|404 Not Found' "$error_log"; then
  # The registry answered, and the version is absent: either an empty result
  # for a package that exists, or a 404 for one that does not.
  echo "$name@$version is not in the registry; it will be published."
  echo "should-publish=true" >> "$GITHUB_OUTPUT"
else
  # Anything else is not an answer about the version, and must never be
  # mistaken for a routine skip.
  echo "The registry lookup for $name@$version failed for a reason other than the version being absent:"
  cat "$error_log"
  exit 1
fi
