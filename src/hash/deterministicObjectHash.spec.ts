import {
  createDeterministicObjectHash,
  deterministicObjectHash,
  HexLength,
} from './deterministicObjectHash';

describe('deterministicObjectHash', () => {
  it('returns a 32-character lowercase hex string', () => {
    const hash = deterministicObjectHash({ a: 1 });
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is stable regardless of argument order and key order', () => {
    const objectA = { alpha: 1, beta: 'two', gamma: true };
    const objectB = { zulu: null, yankee: 'x' };

    const first = deterministicObjectHash(objectA, objectB);
    const second = deterministicObjectHash(
      { yankee: 'x', zulu: null },
      { gamma: true, beta: 'two', alpha: 1 },
    );

    expect(second).toBe(first);
  });

  it('produces a different hash when the input set of objects differs', () => {
    const objectA = { alpha: 1, beta: 'two', gamma: true };
    const objectB = { zulu: null, yankee: 'x' };
    const objectC = { totally: 'different' };
    const objectD = { another: 'one' };

    const baseline = deterministicObjectHash(objectA, objectB);
    const withThirdObject = deterministicObjectHash(objectA, objectC, objectD);

    expect(withThirdObject).not.toBe(baseline);
  });

  it('treats numerically equal values as equal regardless of literal form', () => {
    const first = deterministicObjectHash({ a: 1 });
    const second = deterministicObjectHash({ a: 1.0 });

    expect(second).toBe(first);
  });

  it('produces a valid, consistent hash for an empty object', () => {
    const first = deterministicObjectHash({});
    const second = deterministicObjectHash({});

    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).toBe(first);
  });

  it('distinguishes null, undefined, and an absent key from each other', () => {
    const withNull = deterministicObjectHash({ a: null });
    const withUndefined = deterministicObjectHash({ a: undefined });
    const absent = deterministicObjectHash({});

    expect(withNull).not.toBe(withUndefined);
    expect(withNull).not.toBe(absent);
    expect(withUndefined).not.toBe(absent);
  });

  it('throws when called with no arguments', () => {
    expect(() => deterministicObjectHash()).toThrow(TypeError);
  });

  it('throws when two input objects are structurally identical', () => {
    const objectA = { a: 1, b: 2 };
    const objectB = { b: 2, a: 1 };

    expect(() => deterministicObjectHash(objectA, objectB)).toThrow(TypeError);
  });

  it('throws on NaN values', () => {
    expect(() => deterministicObjectHash({ a: NaN })).toThrow(TypeError);
  });

  it('throws on Infinity and -Infinity values', () => {
    expect(() => deterministicObjectHash({ a: Infinity })).toThrow(TypeError);
    expect(() => deterministicObjectHash({ a: -Infinity })).toThrow(TypeError);
  });

  it('throws on nested object values', () => {
    expect(() => deterministicObjectHash({ a: { b: 1 } } as never)).toThrow(TypeError);
  });

  it('throws on array values', () => {
    expect(() => deterministicObjectHash({ a: [1, 2] } as never)).toThrow(TypeError);
  });

  it('throws when an argument is not a plain object', () => {
    expect(() => deterministicObjectHash('not an object' as never)).toThrow(TypeError);
    expect(() => deterministicObjectHash([1, 2] as never)).toThrow(TypeError);
    expect(() => deterministicObjectHash(null as never)).toThrow(TypeError);
    expect(() => deterministicObjectHash(new Date() as never)).toThrow(TypeError);
  });
});

describe('HexLength', () => {
  it('exposes the documented anchors', () => {
    expect(HexLength.Min).toBe(1);
    expect(HexLength.Default).toBe(32);
    expect(HexLength.Max).toBe(64);
  });

  it('is frozen, so downstream defaults cannot be repointed at a distance', () => {
    expect(Object.isFrozen(HexLength)).toBe(true);
  });
});

describe('createDeterministicObjectHash', () => {
  it('produces a hash of the requested length', () => {
    const hash = createDeterministicObjectHash({ hexLength: HexLength.Hex12 });

    expect(hash({ a: 1 })).toMatch(/^[0-9a-f]{12}$/);
  });

  it('accepts any integer length within the permitted range', () => {
    expect(createDeterministicObjectHash({ hexLength: 20 })({ a: 1 })).toHaveLength(20);
    expect(createDeterministicObjectHash({ hexLength: HexLength.Min })({ a: 1 })).toHaveLength(1);
    expect(createDeterministicObjectHash({ hexLength: HexLength.Max })({ a: 1 })).toHaveLength(64);
  });

  it('defaults to 32 when the options are absent, nullish, or empty', () => {
    const expected = deterministicObjectHash({ a: 1 });

    expect(createDeterministicObjectHash()({ a: 1 })).toBe(expected);
    expect(createDeterministicObjectHash(undefined)({ a: 1 })).toBe(expected);
    expect(createDeterministicObjectHash(null as never)({ a: 1 })).toBe(expected);
    expect(createDeterministicObjectHash({})({ a: 1 })).toBe(expected);
  });

  it('is equivalent to deterministicObjectHash at the default length', () => {
    const objectA = { alpha: 1, beta: 'two', gamma: true };
    const objectB = { zulu: null, yankee: 'x' };
    const hash = createDeterministicObjectHash({ hexLength: HexLength.Default });

    expect(hash(objectA, objectB)).toBe(deterministicObjectHash(objectA, objectB));
  });

  it('produces shorter hashes that are strict prefixes of longer ones', () => {
    const input = { documentId: 'doc_8f21a4', version: 3 };
    const full = createDeterministicObjectHash({ hexLength: HexLength.Max })(input);

    for (const hexLength of [HexLength.Min, HexLength.Hex8, HexLength.Hex12, HexLength.Default]) {
      expect(createDeterministicObjectHash({ hexLength })(input)).toBe(full.slice(0, hexLength));
    }
  });

  it('returns a reusable hasher that is stable across calls', () => {
    const hash = createDeterministicObjectHash({ hexLength: HexLength.Hex16 });

    expect(hash({ a: 1 })).toBe(hash({ a: 1 }));
  });

  it('applies the same input rules as deterministicObjectHash', () => {
    const hash = createDeterministicObjectHash({ hexLength: HexLength.Hex16 });

    expect(() => hash()).toThrow(TypeError);
    expect(() => hash({ a: 1 }, { a: 1 })).toThrow(TypeError);
    expect(() => hash({ a: NaN })).toThrow(TypeError);
    expect(() => hash({ a: { b: 1 } } as never)).toThrow(TypeError);
  });

  it('throws at configure time rather than on the first hash', () => {
    expect(() => createDeterministicObjectHash({ hexLength: 0 })).toThrow(TypeError);
  });

  it('throws when hexLength is present but not a valid number', () => {
    expect(() => createDeterministicObjectHash({ hexLength: undefined })).toThrow(TypeError);
    expect(() => createDeterministicObjectHash({ hexLength: null as never })).toThrow(TypeError);
    expect(() => createDeterministicObjectHash({ hexLength: '32' as never })).toThrow(TypeError);
    expect(() => createDeterministicObjectHash({ hexLength: NaN })).toThrow(TypeError);
    expect(() => createDeterministicObjectHash({ hexLength: Infinity })).toThrow(TypeError);
  });

  it('throws when hexLength is outside 1..64 or not an integer', () => {
    expect(() => createDeterministicObjectHash({ hexLength: 0 })).toThrow(TypeError);
    expect(() => createDeterministicObjectHash({ hexLength: -1 })).toThrow(TypeError);
    expect(() => createDeterministicObjectHash({ hexLength: 65 })).toThrow(TypeError);
    expect(() => createDeterministicObjectHash({ hexLength: 20.5 })).toThrow(TypeError);
  });

  it('throws on an unknown option rather than silently using the default', () => {
    expect(() => createDeterministicObjectHash({ hexLenght: 12 } as never)).toThrow(
      /unknown option "hexLenght"/,
    );
  });

  it('throws when the options are not a plain object', () => {
    expect(() => createDeterministicObjectHash(42 as never)).toThrow(TypeError);
    expect(() => createDeterministicObjectHash('32' as never)).toThrow(TypeError);
    expect(() => createDeterministicObjectHash([] as never)).toThrow(TypeError);
    expect(() => createDeterministicObjectHash(new Date() as never)).toThrow(TypeError);
  });
});
