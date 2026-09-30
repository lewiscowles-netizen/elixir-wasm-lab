export function createPopcornExecution() {
  let instance = null, closed = false;
  const emit = (type, payload) => { if (!closed) adapter.onmessage?.({ data: { type, ...payload } }); };
  const adapter = {
    onmessage: null,
    onerror: null,
    terminate() { closed = true; instance?.deinit(); },
    async postMessage(data) {
      try {
        const base = new URL(data.runtime, location.href);
        const { Popcorn } = await import(new URL('popcorn.mjs', base).href);
        if (closed) return;
        emit('status', { text: 'Starting Popcorn and its GenServer bridge…' });
        instance = new Popcorn({
          workerUrl: new URL('popcorn-worker.mjs', base),
          beam: { otpAssetsRoot: base.href, emulatorArgs: ['-S', '1:1', '-SDcpu', '1', '-SDio', '1'], extraArgs: ['-noshell'] },
          timeoutsMs: { boot: 30000, appStartup: 60000 },
          onStdout: text => emit('stdout', { text }),
          onStderr: text => emit('stderr', { text }),
          onError: error => emit('error', { text: JSON.stringify(error) }),
        });
        const boot = await instance.boot();
        if (closed) return;
        if (!boot.ok) throw boot.error;
        const reply = await instance.genserver.call('lab_evaluator', ['eval', data.source], { timeoutMs: 120000 });
        if (closed) return;
        if (!reply.ok) throw reply.error;
        const result = reply.data;
        emit(result.ok ? 'stdout' : 'stderr', { text: result.ok ? '\n=> ' + result.value + '\n' : result.error + '\n' });
        emit('exit', { code: result.ok ? 0 : 1 });
      } catch (error) {
        emit('error', { text: error.stack || String(error) });
      }
    },
  };
  return adapter;
}
