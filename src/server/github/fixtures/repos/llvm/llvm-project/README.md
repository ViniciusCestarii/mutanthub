# The LLVM Compiler Infrastructure (fixture)

This is a **fixture repository** bundled with MutantHub for offline development.
The sources under `llvm/` and `clang/` are original, simplified code written
for the fixture and are not the upstream LLVM sources.

## Layout

- `llvm/lib/Support/` — APInt and StringRef utilities
- `llvm/lib/Analysis/` — value tracking helpers
- `llvm/include/llvm/ADT/` — ADT headers
- `clang/lib/Lex/` — lexer helpers
- `llvm/unittests/` — unit tests

## Building

```sh
cmake -S llvm -B build -G Ninja -DLLVM_ENABLE_PROJECTS=clang
ninja -C build check-llvm-unit
```
