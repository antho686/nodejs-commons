# Prefix-truncation is a locked contract, not an implementation detail

Hashes are produced by truncating a SHA-256 hex digest with `slice(0, hexLength)`, so for the same input a shorter hash is a strict prefix of a longer one. We decided to **document that as a guarantee** rather than leave it as an unstated implementation detail, which means it can never change within a major version.

## Considered Options

The alternative was **domain separation**: mixing `hexLength` into the digest input so that different lengths produce unrelated outputs. That is the cryptographically tidier design — a short hash would not reveal the leading characters of a longer one.

It was ruled out by a decision already made: `deterministicObjectHash` is locked to the exact 32-character output it produces today, and that output *is* a prefix-truncation. Domain separation could therefore never apply at length 32 without breaking that lock, leaving 32 as a bizarre special case behaving unlike every other length.

The decision was also forced in the sense that silence was not an option. Callers would notice the prefix relationship and depend on it whether or not we blessed it, so the only real choice was to guarantee it or to explicitly forbid relying on it.

## Consequences

Callers may shorten a stored key without recomputing it, and may prefix-match short hashes against long ones.

In exchange, hashes of different lengths for the same input are permanently related, and a short hash leaks the leading characters of the longer one. This module is not suitable where lengths must be independent or where a short hash must not narrow the search space for a longer one.
