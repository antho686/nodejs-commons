# Hash Module

The hash module provides `deterministicObjectHash`, a function for turning one or more flat objects into a short, deterministic, order-independent hash. It exists to produce identifiers you can compute independently on both ends of a system — for example, deriving the same storage key from the same metadata whether you're writing a file or later looking it up — without needing to store a lookup table anywhere.

```ts
import { deterministicObjectHash } from 'oclare-node-commons';
```

## Quick start

```ts
import { deterministicObjectHash } from 'oclare-node-commons';

const metadata = {
  documentId: 'doc_8f21a4',
  version: 3,
  locale: 'en-CA',
};

const keyPrefix = deterministicObjectHash(metadata);
// => "e97db807d40c19391c065142a5e1f864"

const s3Key = `documents/${keyPrefix}/report.pdf`;
```

Because the hash is order-independent, you don't need to worry about how the object was assembled — reconstructing it with keys in a different order, or from a different code path, produces the exact same result:

```ts
const a = deterministicObjectHash({ documentId: 'doc_8f21a4', version: 3, locale: 'en-CA' });
const b = deterministicObjectHash({ locale: 'en-CA', version: 3, documentId: 'doc_8f21a4' });

a === b; // true
```

## Types

### `FlatJsonValue`

```ts
type FlatJsonValue = string | number | boolean | null | undefined;
```

A single value allowed inside a flat object: a string, a finite number, a boolean, `null`, or `undefined`. Nested objects and arrays are not values — see [Rejected inputs](#rejected-inputs).

### `FlatJsonObject`

```ts
type FlatJsonObject = Record<string, FlatJsonValue>;
```

An object whose values are all `FlatJsonValue`s. "Flat" means one level deep: no property may itself be an object or array. This guide uses **flat object** as shorthand for a value of this type.

## API

```ts
function deterministicObjectHash(...objects: FlatJsonObject[]): string;
```

Takes one or more flat objects and returns a 32-character lowercase hexadecimal string. Throws `TypeError` if the input is invalid — see [Rejected inputs](#rejected-inputs) below for the full list of what's rejected and why.

Combining several objects into one call is useful when a key is built from more than one independent concern — for example, a document's identity plus the rendering options used to produce a particular artifact from it:

```ts
const documentIdentity = { documentId: 'doc_8f21a4', version: 3 };
const renderOptions = { locale: 'en-CA', theme: 'print' };

const cacheKey = deterministicObjectHash(documentIdentity, renderOptions);
```

This is equivalent to merging the two objects before hashing, except it also lets the "structurally identical inputs are rejected" rule (below) catch the case where `documentIdentity` and `renderOptions` accidentally overlap in a way that makes the call meaningless.

## Business rules

### The hash is a pure function of value, not of how the value was built

Two calls with the same set of objects — regardless of argument order, and regardless of key order within each object — always produce the same hash. This is the entire reason the function exists: it lets independent parts of a system compute the same identifier from the same logical data without coordinating on serialization order.

### `null`, `undefined`, and an absent key are three distinct states

Flat objects in this system distinguish "the key is present with value `null`", "the key is present with value `undefined`", and "the key was never set" — and the hash preserves that distinction:

```ts
deterministicObjectHash({ locale: null });      // key present, explicitly null
deterministicObjectHash({ locale: undefined }); // key present, explicitly undefined
deterministicObjectHash({});                    // key absent entirely

// all three produce different hashes
```

This matters whenever "unset" and "explicitly cleared" are meaningfully different in your domain (e.g. a field that was never asked about vs. one the user explicitly cleared).

### Numbers are compared by value, not by literal form

JavaScript has a single numeric type, so `1` and `1.0` are the same number and always hash identically — there's no separate integer/float distinction to preserve:

```ts
deterministicObjectHash({ count: 1 }) === deterministicObjectHash({ count: 1.0 }); // true
```

Numbers must be finite. `NaN`, `Infinity`, and `-Infinity` are rejected (see below) rather than silently normalized, since none of them can be a meaningful piece of stored identity.

### Structurally identical input objects are rejected, not deduplicated

If you pass the same logical object twice — even via two different variables, even with keys in a different order — the call throws instead of silently collapsing them into one:

```ts
deterministicObjectHash({ a: 1, b: 2 }, { b: 2, a: 1 }); // throws TypeError
```

This is deliberate: since the hash is often used as identity for stored data, a silent collapse of "two objects" into "actually the same object" would be a much harder bug to track down than an explicit error at the call site. If you legitimately want to hash the same object twice for some reason, that's a sign the objects should carry a distinguishing field instead.

## Rejected inputs

`deterministicObjectHash` throws `TypeError` — it never returns a partial or best-effort result — for:

| Input | Example | Why |
|---|---|---|
| No arguments | `deterministicObjectHash()` | There's nothing to derive an identity from. |
| A non-object argument | `deterministicObjectHash('x' as never)`, `deterministicObjectHash([1, 2] as never)`, `deterministicObjectHash(new Date() as never)`, `deterministicObjectHash(null as never)` | Only object literals (`{ }`) are flat objects; class instances, arrays, and primitives aren't. |
| A nested object or array value | `deterministicObjectHash({ a: { b: 1 } } as never)`, `deterministicObjectHash({ a: [1, 2] } as never)` | Flat objects are one level deep by definition — nesting would need its own canonicalization rules this function doesn't define. |
| A non-finite number | `deterministicObjectHash({ a: NaN })`, `deterministicObjectHash({ a: Infinity })` | `NaN` and `Infinity` aren't meaningful, comparable pieces of identity. |
| Two or more structurally identical objects | `deterministicObjectHash({ a: 1 }, { a: 1 })` | See [Structurally identical input objects are rejected](#structurally-identical-input-objects-are-rejected-not-deduplicated) above. |

An empty object (`{}`) is valid input — it hashes to a fixed, consistent value like any other flat object.

## Stability across versions

The output of `deterministicObjectHash` is treated as a locked contract, not an implementation detail: for a given set of inputs, the returned hash is guaranteed not to change within a major version. This matters because callers persist these hashes as storage keys (for example, as S3 key prefixes) — if the algorithm changed silently, previously stored data would become unreachable under the hash a caller recomputes later.

Any change to what a given input hashes to will only ship as a breaking major-version release, with migration guidance for re-keying data hashed under the previous scheme — never as a routine or patch-level change.
