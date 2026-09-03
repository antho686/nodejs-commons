import { createHash } from 'crypto';

export type FlatJsonValue = string | number | boolean | null | undefined;
export type FlatJsonObject = Record<string, FlatJsonValue>;

/**
 * Named hash lengths, counted in **hex characters** of the returned string —
 * not bytes and not bits. Any integer between `Min` and `Max` is also valid;
 * these are the anchors most callers need.
 */
export const HexLength = Object.freeze({
  /** Shortest permitted hash length: 1 hex character. */
  Min: 1,
  Hex8: 8,
  Hex12: 12,
  Hex16: 16,
  /** The hash length produced by `deterministicObjectHash`: 32 hex characters. */
  Default: 32,
  Hex48: 48,
  /** The full SHA-256 hex digest: 64 hex characters. */
  Max: 64,
} as const);

export type DeterministicObjectHashOptions = {
  /**
   * Length of the returned hash, in hex characters. Must be an integer between
   * {@link HexLength.Min} and {@link HexLength.Max}. Omit the property (or the
   * whole options object) for {@link HexLength.Default}.
   */
  hexLength?: number;
};

export type DeterministicObjectHasher = (...objects: FlatJsonObject[]) => string;

/**
 * Every recognised option name. Derived from a record keyed by
 * `DeterministicObjectHashOptions` so that adding an option to the type without
 * listing it here is a compile error rather than an option silently rejected at
 * runtime as unknown.
 */
const OPTION_KEYS: readonly string[] = Object.keys({
  hexLength: true,
} satisfies Record<keyof DeterministicObjectHashOptions, true>);

/**
 * Both public entry points share one hashing implementation, so every error it
 * raises is prefixed with the name of the entry point the caller actually used.
 * A hasher built by the factory must never blame `deterministicObjectHash` for
 * a failure, since its caller may never have touched that function.
 */
const DIRECT_ENTRY_POINT = 'deterministicObjectHash';
const FACTORY_ENTRY_POINT = 'createDeterministicObjectHash';

const TAG = {
  string: 0,
  number: 1,
  boolean: 2,
  null: 3,
  undefined: 4,
} as const;

type CanonicalEntry = [key: string, tag: number, value: string | number | boolean | null];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function tagAndValue(
  value: unknown,
  entryPoint: string,
): [number, string | number | boolean | null] {
  if (value === null) {
    return [TAG.null, null];
  }
  if (value === undefined) {
    return [TAG.undefined, null];
  }
  if (typeof value === 'string') {
    return [TAG.string, value];
  }
  if (typeof value === 'boolean') {
    return [TAG.boolean, value];
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${entryPoint}: numeric values must be finite, received ${value}`);
    }
    return [TAG.number, value];
  }
  throw new TypeError(
    `${entryPoint}: values must be a string, number, boolean, null, or undefined; received ${typeof value}`,
  );
}

function canonicalizeObject(input: unknown, argIndex: number, entryPoint: string): string {
  if (!isPlainObject(input)) {
    throw new TypeError(
      `${entryPoint}: argument at index ${argIndex} must be a flat plain object`,
    );
  }

  const entries: CanonicalEntry[] = Object.keys(input)
    .sort()
    .map((key) => {
      const [tag, value] = tagAndValue(input[key], entryPoint);
      return [key, tag, value];
    });

  return JSON.stringify(entries);
}

/**
 * Describes a rejected `hexLength` for an error message. A number is shown by
 * value, since the value is what failed (`65`, `20.5`). Anything else is shown
 * by type, because printing the value would be misleading: the string `'32'`
 * would otherwise render as `32`, a length that is perfectly legal as a number.
 */
function describeRejectedHexLength(value: unknown): string {
  if (typeof value === 'number') {
    return String(value);
  }
  return value === null ? 'null' : typeof value;
}

/**
 * Validates the options bag and resolves the hash length in a single pass, so
 * the default lives in exactly one place. Deliberately does not reuse
 * `isPlainObject`: the options contract differs from the flat-object contract
 * (it may be absent, and its keys are a closed set) and carries its own errors.
 */
function resolveHexLength(options?: DeterministicObjectHashOptions): number {
  if (options === undefined || options === null) {
    return HexLength.Default;
  }

  if (typeof options !== 'object') {
    throw new TypeError(
      `${FACTORY_ENTRY_POINT}: options must be an object, received ${typeof options}`,
    );
  }

  const prototype = Object.getPrototypeOf(options);
  if (Array.isArray(options) || (prototype !== Object.prototype && prototype !== null)) {
    throw new TypeError(
      `${FACTORY_ENTRY_POINT}: options must be a plain object of type \`DeterministicObjectHashOptions\``,
    );
  }

  for (const key of Object.keys(options)) {
    if (!OPTION_KEYS.includes(key)) {
      throw new TypeError(`${FACTORY_ENTRY_POINT}: unknown option "${key}"`);
    }
  }

  // An absent key means "use the default"; a key that is present states an
  // intent, so its value must be a valid length whatever that value is.
  if (!Object.hasOwn(options, 'hexLength')) {
    return HexLength.Default;
  }

  const hexLength = options.hexLength;
  if (
    typeof hexLength !== 'number' ||
    !Number.isInteger(hexLength) ||
    hexLength < HexLength.Min ||
    hexLength > HexLength.Max
  ) {
    throw new TypeError(
      `${FACTORY_ENTRY_POINT}: hexLength must be an integer between ${HexLength.Min} and ${HexLength.Max}, received ${describeRejectedHexLength(hexLength)}`,
    );
  }

  return hexLength;
}

function hashObjects(hexLength: number, objects: FlatJsonObject[], entryPoint: string): string {
  if (objects.length === 0) {
    throw new TypeError(`${entryPoint}: at least one object is required`);
  }

  const canonicalObjects = objects.map((object, index) =>
    canonicalizeObject(object, index, entryPoint),
  );

  const seen = new Set<string>();
  for (const canonical of canonicalObjects) {
    if (seen.has(canonical)) {
      throw new TypeError(`${entryPoint}: input objects must not be structurally identical`);
    }
    seen.add(canonical);
  }

  const canonicalPayload = JSON.stringify(canonicalObjects.sort());

  return createHash('sha256').update(canonicalPayload).digest('hex').slice(0, hexLength);
}

/**
 * Builds a hasher that produces hashes of a fixed length. The options are
 * validated immediately, so a bad `hexLength` throws here rather than on the
 * first hash — hashers are typically built once and reused many times.
 *
 * The returned hasher is pure and safe to share.
 *
 * @throws {TypeError} If the options are not a plain object, carry an unknown
 * key, or specify a `hexLength` that is not an integer between
 * {@link HexLength.Min} and {@link HexLength.Max}.
 */
export function createDeterministicObjectHash(
  options?: DeterministicObjectHashOptions,
): DeterministicObjectHasher {
  const hexLength = resolveHexLength(options);

  return (...objects: FlatJsonObject[]): string =>
    hashObjects(hexLength, objects, FACTORY_ENTRY_POINT);
}

/**
 * Computes a deterministic hash over one or more flat objects, independent of
 * argument order and key order. `null`, `undefined`, and an absent key are
 * distinct values. Structurally identical input objects are rejected.
 *
 * The result is a 32-character lowercase hex string, safe for use as an S3
 * object key or key prefix. Equivalent to
 * `createDeterministicObjectHash({ hexLength: HexLength.Default })`.
 */
export function deterministicObjectHash(...objects: FlatJsonObject[]): string {
  return hashObjects(HexLength.Default, objects, DIRECT_ENTRY_POINT);
}
