import { createHash } from 'crypto';

export type FlatJsonValue = string | number | boolean | null | undefined;
export type FlatJsonObject = Record<string, FlatJsonValue>;

const HASH_LENGTH = 32;

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

function tagAndValue(value: unknown): [number, string | number | boolean | null] {
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
      throw new TypeError(
        `deterministicObjectHash: numeric values must be finite, received ${value}`,
      );
    }
    return [TAG.number, value];
  }
  throw new TypeError(
    `deterministicObjectHash: values must be a string, number, boolean, null, or undefined; received ${typeof value}`,
  );
}

function canonicalizeObject(input: unknown, argIndex: number): string {
  if (!isPlainObject(input)) {
    throw new TypeError(
      `deterministicObjectHash: argument at index ${argIndex} must be a flat plain object`,
    );
  }

  const entries: CanonicalEntry[] = Object.keys(input)
    .sort()
    .map((key) => {
      const [tag, value] = tagAndValue(input[key]);
      return [key, tag, value];
    });

  return JSON.stringify(entries);
}

/**
 * Computes a deterministic hash over one or more flat objects, independent of
 * argument order and key order. `null`, `undefined`, and an absent key are
 * distinct values. Structurally identical input objects are rejected.
 *
 * The result is a 32-character lowercase hex string, safe for use as an S3
 * object key or key prefix.
 */
export function deterministicObjectHash(...objects: FlatJsonObject[]): string {
  if (objects.length === 0) {
    throw new TypeError('deterministicObjectHash: at least one object is required');
  }

  const canonicalObjects = objects.map((object, index) => canonicalizeObject(object, index));

  const seen = new Set<string>();
  for (const canonical of canonicalObjects) {
    if (seen.has(canonical)) {
      throw new TypeError(
        'deterministicObjectHash: input objects must not be structurally identical',
      );
    }
    seen.add(canonical);
  }

  const canonicalPayload = JSON.stringify(canonicalObjects.sort());

  return createHash('sha256').update(canonicalPayload).digest('hex').slice(0, HASH_LENGTH);
}
