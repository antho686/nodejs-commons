import { deterministicObjectHash } from './deterministicObjectHash';

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
