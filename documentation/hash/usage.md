# Hash Module

The hash module provides `deterministicObjectHash`, a function for turning one or more flat objects into a short, deterministic, order-independent hash. It exists to produce identifiers you can compute independently on both ends of a system — for example, deriving the same storage key from the same metadata whether you're writing a file or later looking it up — without needing to store a lookup table anywhere.

`createDeterministicObjectHash` builds the same thing at a hash length you choose.

```ts
import { deterministicObjectHash } from '@antho686/nodejs-commons';
```

## Quick start

```ts
import { deterministicObjectHash } from '@antho686/nodejs-commons';

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

### `HexLength`

```ts
const HexLength: Readonly<{
  Min: 1;
  Hex8: 8;
  Hex12: 12;
  Hex16: 16;
  Default: 32;
  Hex48: 48;
  Max: 64;
}>;
```

Named anchors for the hash lengths you're most likely to want. **The unit is hex characters of the returned string** — not bytes, not bits. `Min` is the shortest permitted length, `Default` is what `deterministicObjectHash` produces, and `Max` is the full SHA-256 digest length.

These are a convenience, not a constraint: any integer between `Min` and `Max` is valid, so reach for a literal when you genuinely need a length the anchors don't cover.

### `DeterministicObjectHashOptions`

```ts
type DeterministicObjectHashOptions = {
  hexLength?: number;
};
```

Options for `createDeterministicObjectHash`. Omit `hexLength` — or the whole object — for `HexLength.Default`.

### `DeterministicObjectHasher`

```ts
type DeterministicObjectHasher = (...objects: FlatJsonObject[]) => string;
```

A **hasher**: a function returned by `createDeterministicObjectHash` that produces hashes of one fixed length. Hashers are pure and safe to build once at module scope and reuse.

## API

```ts
function deterministicObjectHash(...objects: FlatJsonObject[]): string;
```

Takes one or more flat objects and returns a 32-character lowercase hexadecimal string. Throws `TypeError` if the input is invalid — see [Rejected inputs](#rejected-inputs) below for the full list of what's rejected and why.

It is exactly equivalent to `createDeterministicObjectHash({ hexLength: HexLength.Default })`.

Combining several objects into one call is useful when a key is built from more than one independent concern — for example, a document's identity plus the rendering options used to produce a particular artifact from it:

```ts
const documentIdentity = { documentId: 'doc_8f21a4', version: 3 };
const renderOptions = { locale: 'en-CA', theme: 'print' };

const cacheKey = deterministicObjectHash(documentIdentity, renderOptions);
```

This is equivalent to merging the two objects before hashing, except it also lets the "structurally identical inputs are rejected" rule (below) catch the case where `documentIdentity` and `renderOptions` accidentally overlap in a way that makes the call meaningless.

### `createDeterministicObjectHash`

```ts
function createDeterministicObjectHash(
  options?: DeterministicObjectHashOptions,
): DeterministicObjectHasher;
```

Returns a hasher that produces hashes of a fixed length:

```ts
import { createDeterministicObjectHash, HexLength } from '@antho686/nodejs-commons';

const shortHash = createDeterministicObjectHash({ hexLength: HexLength.Hex12 });

const key = shortHash({ documentId: 'doc_8f21a4', version: 3 });
// => "a1152ea01e2d"
```

Options are validated **when the hasher is built**, not when it's used, so a bad `hexLength` throws at the call site that configured it rather than on some later hash:

```ts
createDeterministicObjectHash({ hexLength: 99 }); // throws TypeError immediately
```

That matters because hashers are normally built once and reused, often far from where they're eventually called.

Calling it with nothing gives you a default-length hasher, which is just a longer way of writing `deterministicObjectHash`:

```ts
createDeterministicObjectHash();   // 32-character hashes
createDeterministicObjectHash({}); // 32-character hashes
```

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

### A shorter hash is always a prefix of a longer one

For the same inputs, a hash of length _n_ is a strict prefix of any longer hash. This is a **guarantee**, not an implementation detail you happened to notice:

```ts
const input = { documentId: 'doc_8f21a4', version: 3 };

const long = createDeterministicObjectHash({ hexLength: HexLength.Default })(input);
const short = createDeterministicObjectHash({ hexLength: HexLength.Hex12 })(input);

long.startsWith(short); // true, always
```

So you can shorten an already-stored key without recomputing anything, and prefix-match short keys against long ones. The trade-off this locks in: hashes of different lengths for the same input are *related*, and a short hash reveals the leading characters of the long one. If you need lengths to be independent of each other, this function is the wrong tool.

### Choosing a hash length is a capacity decision

Shorter hashes collide sooner. Roughly, you can expect a 50% chance of at least one collision once you've hashed this many distinct inputs:

| `hexLength` | ~50% collision chance at |
| --- | --- |
| 8 | ~77 thousand items |
| 12 | ~20 million items |
| 16 | ~5 billion items |
| 32 (default) | ~2 × 10¹⁹ items |

Nothing stops you going as low as `HexLength.Min` — the function won't second-guess a length you asked for. But if these hashes are storage keys, a collision means two different inputs pointing at the same stored object, so pick a length with room for the number of items you'll realistically have.

### `hexLength` follows the same three-state rule as flat objects

An absent `hexLength` means "use the default". A **present** `hexLength` states an intent, so its value has to be a valid length — including when that value is `undefined`:

```ts
createDeterministicObjectHash({});                      // default (32) — key absent
createDeterministicObjectHash({ hexLength: undefined }); // throws — key present
createDeterministicObjectHash({ hexLength: null });      // throws — key present
```

This is the same "absent, `null`, and `undefined` are three distinct states" distinction the module applies to flat objects, turned on its own options.

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

### Rejected options

`createDeterministicObjectHash` throws `TypeError` at configure time for:

| Options | Example | Why |
|---|---|---|
| A non-object | `createDeterministicObjectHash(42 as never)`, `createDeterministicObjectHash('32' as never)` | A bare number is ambiguous — hex characters or bytes? The options object carries the unit in its key name. |
| A non-plain object | `createDeterministicObjectHash([] as never)`, `createDeterministicObjectHash(new Date() as never)` | Arrays and class instances aren't options bags. |
| An unknown key | `createDeterministicObjectHash({ hexLenght: 12 } as never)` | A typo would otherwise silently give you a 32-character hash instead of the 12 you asked for — a wrong-length storage key, discovered much later. |
| A `hexLength` that isn't an integer in 1–64 | `createDeterministicObjectHash({ hexLength: 0 })`, `{ hexLength: 65 }`, `{ hexLength: 20.5 }`, `{ hexLength: NaN }`, `{ hexLength: undefined }` | 64 is the full SHA-256 hex digest; anything longer doesn't exist, and anything below 1 isn't a hash. `undefined` and `null` are rejected here too — see the three-state rule above. |

Absent options (`createDeterministicObjectHash()`), `null`, and `{}` are all valid and give you `HexLength.Default`.

## Stability across versions

The output of both functions is treated as a locked contract, not an implementation detail: for a given set of inputs **and a given `hexLength`**, the returned hash is guaranteed not to change within a major version. This matters because callers persist these hashes as storage keys (for example, as S3 key prefixes) — if the algorithm changed silently, previously stored data would become unreachable under the hash a caller recomputes later.

Two things are covered by this guarantee:

- What a given input hashes to at a given length.
- That a shorter hash is a prefix of a longer one for the same input (see [above](#a-shorter-hash-is-always-a-prefix-of-a-longer-one)). This rules out ever mixing `hexLength` into the digest input to make lengths independent, since that would change what `HexLength.Default` produces today.

Any change to either will only ship as a breaking major-version release, with migration guidance for re-keying data hashed under the previous scheme — never as a routine or patch-level change.
