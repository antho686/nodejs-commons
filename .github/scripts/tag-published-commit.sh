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

tag="v$VERSION"

# The tag may already be there: a re-run of a job whose publish succeeded, or a
# publish the registry reported as a conflict. Re-creating it fails, so settle
# what the existing one means first. Annotated tags are dereferenced with ^{}
# to compare commits rather than tag objects.
existing=$(git ls-remote origin "refs/tags/$tag^{}" | cut -f1)
if [ -z "$existing" ]; then
  existing=$(git ls-remote origin "refs/tags/$tag" | cut -f1)
fi

if [ -n "$existing" ]; then
  if [ "$existing" = "$GITHUB_SHA" ]; then
    echo "$tag already points at $GITHUB_SHA; the commit is already tagged."
    exit 0
  fi
  # Two different commits claiming one version is exactly what tagging after a
  # successful publish exists to prevent, so it is never resolved silently.
  echo "$tag already exists and points at $existing, not the commit just published ($GITHUB_SHA)."
  echo "Refusing to move a release tag; resolve by hand."
  exit 1
fi

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git tag -a "$tag" -m "Release $tag" "$GITHUB_SHA"
git push origin "$tag"
