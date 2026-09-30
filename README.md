# Elixir WebAssembly lab

An independent static browser lab for versioned Elixir/BEAM WebAssembly builds. It follows the Python lab's model: version selection, editable examples, separate output streams, fresh runtimes, explicit capability information and local artifacts.

Select **Direct OTP**, **Popcorn** or **AtomVM** under Runtime integration. Direct OTP and Popcorn evaluate editable source; AtomVM displays a read-only precompiled program. Their [compatibility and framework boundaries](docs/reference/backends.md) are recorded separately.

## Interfaces

```sh
python3 serve.py
```

Open `http://127.0.0.1:8130/web/`. The server requires Python 3.9 or later and only serves files; Elixir executes in a browser worker. No AI or remote compilation service is involved.

Import builds from the sibling builder:

```sh
cd ../elixir-wasm-builder
python3 scripts/export-lab.py ../elixir-wasm-lab builds/browser-1.20.4
```

The source catalogue contains the first and latest stable patches of every minor from 1.0 through 1.20. Entries without a matching exported bundle remain unavailable. See [documentation](docs/README.md) for measured compatibility and the learning path.

Developer interfaces after importing bundles:

```sh
yarn install --frozen-lockfile
yarn docs:build
yarn exec playwright install chromium
yarn test:e2e
python3 scripts/package-lab.py
```

The rendered documentation is at `/web/docs/README.html`. Browser evidence is written to `evidence/browser.json`; portable archives go to `dist/`. Yarn and Docker are build/test tools; an exported lab runs with Python and a browser alone.

## Files

| Path | Responsibility |
| --- | --- |
| `web/index.html`, `web/style.css`, `web/app.mjs` | Editor, version selection, examples and output |
| `web/worker.mjs` | Fresh Wasm VM, virtual filesystem loading and output forwarding |
| `web/versions.json` | Builder's pinned release catalogue |
| `web/runtimes.local.json`, `web/runtimes/` | Ignored generated catalogue and runtime files |
| `serve.py` | Loopback static server with cross-origin isolation headers |
| `tests/` | Browser acceptance checks |
| `docs/` | Generated copy of the builder documentation, refreshed on export; `SOURCE.json` records its hashes |

The Run button requires a browser build and cross-origin isolation. Selecting WASI filters the catalogue to separate AtomVM Preview 1 command bundles, with downloads and Wasmtime instructions. Host execution evidence is in `evidence/wasi.json`.
