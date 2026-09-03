#!/usr/bin/env bash
#
# Tags the commit that was just published as v<version>, attributed to the
# GitHub Actions bot rather than to a person.
#
# Runs only after a publish that actually succeeded, so the tag existing is a
# truthful claim that the version is in the registry — see
# docs/adr/0003-releases-are-human-versioned-and-published-only-when-new.md.
#
# Expects VERSION and GITHUB_SHA in the environment.

set -euo pipefail

: "${VERSION:?VERSION must name the published version}"
: "${GITHUB_SHA:?GITHUB_SHA must name the commit that was built and published}"

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git tag -a "v$VERSION" -m "Release v$VERSION" "$GITHUB_SHA"
git push origin "v$VERSION"
