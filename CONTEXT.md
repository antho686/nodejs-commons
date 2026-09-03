# Node.js Commons

Shared utility modules for Node.js scripts and applications. This glossary pins the vocabulary the library's modules and docs use, so the same concept keeps the same name across code, tests, and documentation.

## Language

### Hashing

**Flat object**:
An object exactly one level deep, whose every value is a string, finite number, boolean, `null`, or `undefined`. The only shape the hashing module accepts as input.
_Avoid_: Record, dictionary, map, payload

**Hash length**:
The number of **hex characters** in a returned hash, between 1 and 64. Never a count of bytes or bits — a 32-hex-character hash is 16 bytes.
_Avoid_: Hash size, digest length, output size

**Hasher**:
A function that turns flat objects into a hash of one fixed length. Built by a factory and reusable; distinct from the factory that produces it.
_Avoid_: Hash function, hash instance, hash generator

**Prefix-consistency**:
The guaranteed property that, for the same input, a shorter hash is a strict prefix of a longer one. A promise the library makes, not an artefact of how truncation happens to be implemented.
_Avoid_: Truncation stability, prefix property
