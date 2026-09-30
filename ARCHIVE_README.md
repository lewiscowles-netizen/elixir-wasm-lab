# Run the Elixir WebAssembly lab

This archive contains the browser lab, its selected runtime bundles, rendered documentation and recorded browser test evidence. You need Python 3.9 or later and a browser with WebAssembly threads. The recorded acceptance tests use Chromium.

Extract the archive, enter its `elixir-wasm-lab` directory, then run:

```sh
python3 serve.py
```

Open `http://127.0.0.1:8130/web/`. Choose an Elixir release, enter a script and press **Run Elixir**. Python serves the files; Elixir executes inside the browser. Docker, Node, Yarn and an internet connection are unnecessary for running the included examples.

The runtime selector offers Direct OTP, Popcorn and AtomVM. The first two evaluate editable source. AtomVM executes the bundled compiled program and displays its source read-only. Available compiler versions differ between integrations; choose an entry marked available.

Keep the server running while using the lab. Opening `index.html` directly cannot provide the response headers required by WebAssembly threads. Stop the server with Ctrl+C when finished.

Follow the **Tutorials, how-to, reference & explanations** link to start with a simple script and progress to the included Mix project. The compatibility matrix records measured results; historical Elixir builds use explicit retargeting onto the modern OTP VM. Select AtomVM and WASI for the separate Preview 1 command bundles, host instructions and Wasmtime evidence. The browser Run button applies only to browser bundles.

The builder and lab source repositories contain the build and test tooling. The archive is an execution package. Each runtime's manifest records its sources, transformations, capabilities and artifact hashes; `evidence/browser.json` records which exact manifests were tested.
