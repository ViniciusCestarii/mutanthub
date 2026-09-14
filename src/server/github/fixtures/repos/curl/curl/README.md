# curl (fixture)

This is a **fixture repository** bundled with MutantHub for offline development.
The sources under `lib/` are original, simplified code written for the fixture
and are not the upstream curl sources.

## Layout

- `lib/url.c` — URL scheme/host/port parsing helpers
- `lib/escape.c` — percent-encoding and decoding
- `lib/parsedate.c` — HTTP date parsing
- `lib/http.c` — status line and header handling
- `include/curl/curl.h` — public constants
- `tests/unit/` — unit tests

## Building

```sh
autoreconf -fi
./configure --with-openssl
make -j$(nproc)
make test
```
