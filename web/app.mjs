import { createPopcornExecution } from './popcorn-adapter.mjs';
const $ = id => document.getElementById(id);
const examples = {
  hello: 'IO.puts("Elixir " <> System.version())\nIO.puts("OTP " <> to_string(:erlang.system_info(:otp_release)))\nIO.inspect(Enum.map([1, 2, 3], fn n -> n * n end))\n6 * 7',
  processes: 'parent = self()\nspawn(fn -> send(parent, {:answer, 6 * 7}) end)\nreceive do\n  {:answer, value} -> IO.inspect(value)\nafter\n  1000 -> raise "Timed out"\nend',
  modules: 'defmodule Greeter do\n  def hello(name), do: "Hello, " <> name <> "!"\nend\nGreeter.hello("WebAssembly")',
  files: 'File.write!("/tmp/greeting.txt", "Hello from Elixir")\nIO.puts(File.read!("/tmp/greeting.txt"))\nFile.ls!("/tmp")',
  errors: 'IO.puts("This goes to stdout")\nIO.puts(:stderr, "This goes to stderr")\nraise "An intentional example error"',
  loop: 'defmodule Forever do\n  def run, do: run()\nend\nForever.run()',
};
let catalog = [], versions = [], runtimes = [], worker = null, timer = null, started = 0;
let editableSource = examples.hello, sourceToken = 0;
const available = () => catalog.find(runtime => (runtime.id || runtime.version) === $("version").value);
const finish = status => {
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(timer);
  $("stop").disabled = true;
  $("status").textContent = status;
  updateSelection();
};
function updateSelection() {
  const runtime = available();
  const backend = $("backend").value;
  const browser = $("target").value === "browser";
  const ready = Boolean(runtime?.directory) && browser && crossOriginIsolated;
  $("run").disabled = !ready || Boolean(worker);
  $("timeout").disabled = !browser;
  $("runtime-info").textContent = runtime ? `Elixir ${runtime.version}${backend === "atomvm" ? " compiler" : ""} · ${runtime.application ? "bundled " + runtime.application + " project" : runtime.position + " stable patch in " + runtime.series} · ${runtime.directory ? (backend === "atomvm" ? "AtomVM " + runtime.runtimeVersion : "OTP " + runtime.otp) + (browser ? " / browser build available" : " / WASI command available") : runtime.status || "Source pinned; build not yet verified"}` : "No runtime selected.";
  $("backend-info").textContent = { direct: "Direct OTP API: no Popcorn application framework or AtomVM. The OTP VM retains attributed Popcorn portability patches.", popcorn: "Popcorn 0.4 prerelease integration: OTP runtime, Popcorn JavaScript SDK and Elixir GenServer bridge.", atomvm: (browser ? "Stock AtomVM" : "AtomVM WASI port") + ": a smaller BEAM runtime with its own library subset. Programs are compiled before execution; no Popcorn code." }[backend];
  $("execution-note").textContent = !browser ? "Run the downloaded command bundle in a WASI host. Browser execution is available under the Browser target." : backend === "atomvm" ? "This source is read-only because the imported program is already compiled. Rebuild with --backend atomvm --script to change it. Each run starts a fresh VM." : "Each run starts a fresh VM. Files are temporary. Execution uses your browser; no AI or compilation server is involved.";
  if (runtime?.profile === "historical-retarget") $("runtime-info").textContent += ` · compiled with OTP ${runtime.compilerOtp}, experimentally retargeted to OTP ${runtime.otp}`;
  if (runtime?.directory) $("runtime-info").textContent += runtime.proofStatus === "passed" ? (browser ? " · Chromium backend probes passed" : " · Wasmtime host probes passed") : runtime.proofStatus ? " · execution probe: " + runtime.proofStatus : " · execution test pending";
  $("requirements").textContent = !browser ? (runtime?.directory ? "WASI Preview 1 command · single scheduler · explicit directory grants · no JavaScript host required" : "No WASI build is available for this integration and release. Select AtomVM and a supported release to download a WASI command.") : !crossOriginIsolated ? "WebAssembly threads need a secure context and COOP/COEP response headers. Start the lab with python3 serve.py." : !runtime?.directory ? "This release cannot run until its compatible runtime bundle has been built and imported." : "WebAssembly threads ready · temporary filesystem · no native sockets or subprocesses";
  $("wasi-command").hidden = browser || !runtime?.directory;
  if (!browser && runtime?.directory) {
    $("wasi-download").href = runtime.archive.url;
    $("wasi-download").textContent = `Download Elixir ${runtime.version} WASI bundle`;
    $("wasi-instructions").textContent = `tar -xzf ${runtime.id}.tar.gz
cd ${runtime.id}
wasmtime run --dir .::/bundle AtomVM.wasm /bundle/program.avm /bundle/atomvmlib.avm`;
    $("wasi-checksum").textContent = "Archive SHA-256: " + runtime.archive.sha256;
  }
  $("provenance").replaceChildren();
  if (runtime?.directory) {
    const link = document.createElement("a");
    link.href = runtime.directory + "manifest.json";
    link.textContent = "Exact sources, capabilities & artifact hashes";
    $("provenance").append(link);
  }
}
function refreshCatalog() {
  const backend = $("backend").value;
  const target = $("target").value === "wasi" ? "wasm32-wasip1" : "browser-emscripten";
  const matches = runtimes.filter(runtime => runtime.backend === backend && runtime.target === target);
  catalog = versions.map(version => ({ ...version, ...matches.find(runtime => runtime.version === version.version && !runtime.application) }));
  catalog.push(...matches.filter(runtime => runtime.application).map(runtime => ({ ...versions.find(version => version.version === runtime.version), ...runtime })));
  $("version").replaceChildren();
  for (const runtime of [...catalog].reverse()) {
    const option = document.createElement("option");
    option.value = runtime.id || runtime.version;
    option.textContent = `${runtime.version} · ${runtime.application || runtime.position}${runtime.directory ? " · available" : " · unverified"}`;
    $("version").append(option);
  }
  const newest = [...catalog].reverse().find(runtime => runtime.directory && !runtime.application);
  if (newest) $("version").value = newest.id || newest.version;
  $("version").disabled = false;
  $("count").textContent = `${catalog.filter(runtime => runtime.directory).length} ${backend} builds / ${versions.length} pinned releases`;
  updateSelection();
  refreshSource();
}
async function refreshSource() {
  const token = ++sourceToken;
  const precompiled = $("backend").value === "atomvm";
  if (precompiled && !$("code").readOnly) editableSource = $("code").value;
  if (!precompiled && $("code").readOnly) $("code").value = editableSource;
  $("code").readOnly = precompiled;
  $("example").disabled = precompiled;
  if (!precompiled) return;
  const runtime = available();
  $("code").value = "No precompiled program has been imported for this release.";
  if (!runtime?.directory || !runtime.programSource) return;
  try {
    const response = await fetch(runtime.directory + runtime.programSource);
    if (!response.ok) throw new Error("Cannot load the compiled program's source");
    const source = await response.text();
    if (token === sourceToken) $("code").value = source;
  } catch (error) {
    if (token === sourceToken) $("status").textContent = error.message;
  }
}
$("example").addEventListener("change", () => { $("code").value = examples[$("example").value]; });
$("version").addEventListener("change", () => { if (worker) finish("Stopped for version change."); updateSelection(); refreshSource(); });
$("backend").addEventListener("change", () => { if (worker) finish("Stopped for runtime change."); refreshCatalog(); });
$("target").addEventListener("change", () => { if (worker) finish("Stopped for target change."); refreshCatalog(); });
$("stop").addEventListener("click", () => finish("Stopped."));
$("clear").addEventListener("click", () => { $("stdout").textContent = ""; $("stderr").textContent = ""; });
$("run").addEventListener("click", () => {
  const runtime = available();
  if (!runtime?.directory || worker || $("run").disabled) return;
  $("stdout").textContent = "";
  $("stderr").textContent = "";
  $("status").textContent = "Loading local runtime assets…";
  started = performance.now();
  const activeWorker = runtime.backend === "popcorn" ? createPopcornExecution() : new Worker(new URL(runtime.backend === "atomvm" ? "atomvm-worker.mjs" : "worker.mjs", import.meta.url), { type: "module" });
  worker = activeWorker;
  $("run").disabled = true;
  $("stop").disabled = false;
  worker.onmessage = ({ data }) => {
    if (worker !== activeWorker) return;
    if (data.type === "stdout" || data.type === "stderr") {
      const output = $(data.type);
      if (output.textContent.length < 200000) output.textContent += String(data.text).slice(0, 200000 - output.textContent.length);
    } else if (data.type === "status") $("status").textContent = data.text;
    else if (data.type === "exit") finish(`${data.code === 0 ? "Completed" : "Failed"} · exit ${data.code} · ${((performance.now() - started) / 1000).toFixed(2)} s`);
    else if (data.type === "error") { $("stderr").textContent += data.text; finish("Runtime error."); }
  };
  worker.onerror = event => { if (worker !== activeWorker) return; $("stderr").textContent += event.message; finish("Worker error."); };
  timer = setTimeout(() => { if (worker === activeWorker) finish("Time limit reached. VM stopped."); }, Number($("timeout").value) * 1000);
  worker.postMessage({ runtime: new URL(runtime.directory, location.href).href, source: $("code").value });
});
$("code").value = examples.hello;
try {
  const response = await fetch("versions.json");
  if (!response.ok) throw new Error(`Version catalogue: HTTP ${response.status}`);
  versions = (await response.json()).versions;
  const local = await fetch("runtimes.local.json");
  if (local.ok) {
    runtimes = (await local.json()).runtimes.map(runtime => ({ backend: "direct", target: "browser-emscripten", ...runtime }));
  }
  const proofResponse = await fetch("../evidence/browser.json");
  if (proofResponse.ok) {
    const proof = await proofResponse.json();
    for (const runtime of runtimes) {
      runtime.proofStatus = proof.results.find(test => runtime.manifestSha256 && test.evidence?.manifestSha256 === runtime.manifestSha256)?.status;
    }
  }
  const wasiResponse = await fetch("../evidence/wasi.json");
  if (wasiResponse.ok) {
    const proof = await wasiResponse.json();
    for (const runtime of runtimes.filter(entry => entry.target === "wasm32-wasip1")) {
      runtime.proofStatus = proof.results.find(result => result.manifestSha256 === runtime.manifestSha256)?.status;
    }
  }
  refreshCatalog();
  $("backend").disabled = false;
  $("target").disabled = false;
  $("status").textContent = "Ready.";
  updateSelection();
} catch (error) {
  $("status").textContent = error.message;
}
