# Configurable hash length is exposed through a factory

`deterministicObjectHash` takes a rest parameter (`...objects: FlatJsonObject[]`), and JavaScript does not allow a fixed parameter after a rest parameter — so there was no way to add a length argument to the existing signature. We added `createDeterministicObjectHash(options?)`, which returns a hasher bound to one length, and left `deterministicObjectHash` untouched as the 32-character default. Both call a shared private helper, so there is one hashing implementation rather than two that could drift.

## Considered Options

- **A sibling function** — `deterministicObjectHashWithLength(length, ...objects)`. Rejected: passing the length on every call is noise when it is almost always fixed for a given call site, and it invites callers to vary the length by accident.
- **A breaking signature change** — `deterministicObjectHash(options, ...objects)`. Rejected: it forces every existing caller to migrate for a feature most of them will never use.
- **A bare number instead of an options object** — `createDeterministicObjectHash(16)`. Rejected: a bare number carries no unit at the call site, and the options object leaves room for a second option without another breaking change.

## Consequences

`deterministicObjectHash` stays a `function` declaration rather than becoming `const deterministicObjectHash = createDeterministicObjectHash({ hexLength: 32 })`. That alternative would have given the same single-implementation guarantee, but it changes the emitted `.d.ts` from `declare function` to `declare const` — a visible change to the published type surface of a library that sells stability. The shared private helper achieves the same thing without touching the existing declaration.

`createDeterministicObjectHash()` with no arguments is therefore a redundant spelling of `deterministicObjectHash`. That redundancy is accepted deliberately, as the price of an API that behaves sensibly when called with nothing.
