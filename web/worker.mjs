const encoder = new TextEncoder();
const decoder = new TextDecoder();
const outputDecoders = { 1: new TextDecoder(), 2: new TextDecoder() };
const send = (type, data) => postMessage({ type, ...data });

function unpack(bytes, module) {
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const field = (start, end) => decoder.decode(header.subarray(start, end)).replace(/\0.*$/s, "");
    const name = [field(345, 500), field(0, 100)].filter(Boolean).join("/");
    const size = parseInt(field(124, 136).trim(), 8) || 0;
    if (name.startsWith("/") || name.split("/").includes("..")) throw new Error("Unsafe archive path");
    if (![0, 48].includes(header[156])) throw new Error(`Unsupported archive entry: ${name}`);
    const path = `/${name}`;
    module.FS_mkdirTree(path.slice(0, path.lastIndexOf("/")) || "/");
    module.FS_createDataFile(path, null, bytes.slice(offset + 512, offset + 512 + size), true, true, true);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
}

self.onmessage = async ({ data }) => {
  try {
    const base = new URL(data.runtime, self.location.href);
    const manifestResponse = await fetch(new URL("manifest.json", base));
    if (!manifestResponse.ok) throw new Error("Runtime manifest is unavailable");
    const manifest = await manifestResponse.json();
    const response = await fetch(new URL("filesystem.tar.gz", base));
    if (!response.ok) throw new Error(`Filesystem download: HTTP ${response.status}`);
    const fs = new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    const { default: createModule } = await import(new URL("beam.mjs", base).href);
    const stream = (type, chunk) => {
      send(type, { text: chunk });
    };
    send("status", { text: "Starting BEAM in WebAssembly…" });
    await createModule({
      print: text => stream("stdout", text + "\n"),
      printErr: text => stream("stderr", text + "\n"),
      onTtyChunk: (fd, chunk) => stream(fd === 1 ? "stdout" : "stderr", outputDecoders[fd === 1 ? 1 : 2].decode(chunk, { stream: true })),
      onAbort: text => send("error", { text: String(text) }),
      onError: text => send("error", { text: String(text) }),
      onExit: code => {
        for (const fd of [1, 2]) stream(fd === 1 ? "stdout" : "stderr", outputDecoders[fd].decode());
        send("exit", { code });
      },
      onBeamMessage: () => {},
      arguments: ["-S", "1:1", "-SDcpu", "1", "-SDio", "1", "--", "-root", "/", "-bindir", "/bin", "-progname", "erl", "-home", "/home/web_user", "-boot", "/bin/vm", "-kernel", "start_distribution", "false", "-noshell", ...manifest.codePaths.flatMap(path => ["-pa", path]), "-s", "lab_runner", "start"],
      preRun: [module => {
        Object.assign(module.ENV, { BINDIR: "/bin", EMU: "beam", HOME: "/home/web_user", USER: "web_user", LOGNAME: "web_user", ERL_INETRC: "/etc/inetrc" });
        unpack(fs, module);
        module.FS_mkdirTree("/tmp");
        module.FS_mkdirTree("/home/web_user");
        module.FS_createDataFile("/main.exs", null, encoder.encode(data.source), true, true, true);
      }],
    });
  } catch (error) {
    send("error", { text: error.stack || String(error) });
  }
};
