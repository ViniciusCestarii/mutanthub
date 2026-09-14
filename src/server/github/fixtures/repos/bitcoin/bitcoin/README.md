# Bitcoin Core (fixture)

This is a **fixture repository** bundled with MutantHub for offline development.
The files under `src/` are original, simplified code written for the fixture and
are not the upstream Bitcoin Core sources.

## Layout

- `src/script/` — script interpreter (push rules, opcode evaluation, verification)
- `src/consensus/` — transaction-level consensus checks
- `src/util/` — string encoding helpers
- `src/validation.cpp` — block-level validation entry points
- `src/test/` — unit tests

## Building

```sh
cmake -B build
cmake --build build -j$(nproc)
ctest --test-dir build
```
