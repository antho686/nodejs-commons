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
lookup=$(npm view "$name@$version" version --json 2>"$error_log")
status=$?
set -e

fail_lookup() {
  echo "The registry lookup for $name@$version did not answer whether the version exists:"
  echo "$1"
  exit 1
}

if [ "$status" -ne 0 ] && ! grep -qE 'E404|404 Not Found' "$error_log"; then
  # Not an answer about the version — authentication, network, a server error.
  fail_lookup "$(cat "$error_log")"
fi

# `npm view <name>@<version> version --json` prints a JSON string for a version
# that exists, nothing at all for one that does not, and a JSON array when the
# registry matches more than one. Anything else is not a version, and treating
# it as one would silently skip a real release.
set +e
resolved=$(node -e '
  const text = String(process.argv[1] ?? "").trim();
  if (text === "") process.exit(0);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    process.exit(2);
  }
  if (value === null) process.exit(0);
  const versions = (Array.isArray(value) ? value : [value]).filter(
    (entry) => typeof entry === "string" && entry.trim() !== "",
  );
  if (versions.length === 0) process.exit(2);
  process.stdout.write(versions[versions.length - 1]);
' "$lookup")
parse_status=$?
set -e

if [ "$parse_status" -ne 0 ]; then
  fail_lookup "Unrecognised output from npm view: $lookup"
fi

if [ -n "$resolved" ]; then
  echo "already published, skipping: $name@$resolved is already in the registry."
  echo "should-publish=false" >> "$GITHUB_OUTPUT"
else
  echo "$name@$version is not in the registry; it will be published."
  echo "should-publish=true" >> "$GITHUB_OUTPUT"
fi
