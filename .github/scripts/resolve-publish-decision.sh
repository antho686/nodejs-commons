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

set -euo pipefail

error_log="$(mktemp)"

# The name and version decide what is looked up and what gets tagged, so a
# manifest that does not state them plainly is rejected rather than turned into
# an empty string that would look up "@" and tag "v".
name=$(node -p "
  const { name } = require('./package.json');
  if (typeof name !== 'string' || name === '') {
    throw new TypeError('package.json must set name to the package to publish.');
  }
  name;
")
version=$(node -p "
  const { version } = require('./package.json');
  if (typeof version !== 'string' || version === '') {
    throw new TypeError('package.json must set version to the version to publish.');
  }
  version;
")

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

# `npm view <name>@<version> version --json` reports an absent version by
# exiting non-zero and printing an E404 *error object on stdout* — not by
# printing nothing. A version that exists comes back as a JSON array of version
# strings (or a bare string). Anything else is not an answer about the version,
# and treating it as one would either skip a real release or block every one.
verdict=$(node -e '
  const text = String(process.argv[1] ?? "").trim();
  if (text === "" || text === "null") {
    // Says nothing on its own: only meaningful alongside the exit status.
    process.stdout.write("silent");
    process.exit(0);
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch {
    process.stdout.write("unknown");
    process.exit(0);
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const code = value.error && value.error.code;
    process.stdout.write(code === "E404" ? "absent" : "unknown");
    process.exit(0);
  }

  const versions = (Array.isArray(value) ? value : [value]).filter(
    (entry) => typeof entry === "string" && entry.trim() !== "",
  );
  process.stdout.write(versions.length > 0 ? `present ${versions[versions.length - 1]}` : "unknown");
' "$lookup")

# Empty output means "the version is absent" only when the lookup itself
# succeeded. Empty output from a failed lookup is silence, not an answer.
if [ "$verdict" = "silent" ]; then
  if [ "$status" -eq 0 ]; then
    verdict="absent"
  else
    verdict="unknown"
  fi
fi

# stdout did not settle it; a 404 on stderr still means absent.
if [ "$verdict" = "unknown" ] && grep -qE 'E404|404 Not Found' "$error_log"; then
  verdict="absent"
fi

case "$verdict" in
  present\ *)
    echo "already published, skipping: $name@${verdict#present } is already in the registry."
    echo "should-publish=false" >> "$GITHUB_OUTPUT"
    ;;
  absent)
    echo "$name@$version is not in the registry; it will be published."
    echo "should-publish=true" >> "$GITHUB_OUTPUT"
    ;;
  *)
    fail_lookup "$(printf 'stdout: %s\nstderr: %s' "$lookup" "$(cat "$error_log")")"
    ;;
esac
