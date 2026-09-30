const send = (type, data) => postMessage({ type, ...data });
self.onmessage = async ({ data }) => {
  try {
    const base = new URL(data.runtime, self.location.href);
    const files = await Promise.all(['program.avm', 'atomvmlib.avm'].map(async name => {
      const response = await fetch(new URL(name, base));
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      return [name, new Uint8Array(await response.arrayBuffer())];
    }));
    const { default: createModule } = await import(new URL('AtomVM.mjs', base).href);
    send('status', { text: 'Starting the precompiled program on AtomVM…' });
    await createModule({
      arguments: ['/program.avm', '/atomvmlib.avm'],
      print: text => send('stdout', { text: text + '\n' }),
      printErr: text => send('stderr', { text: text + '\n' }),
      onExit: code => send('exit', { code }),
      onAbort: text => send('error', { text: String(text) }),
      preRun: [module => {
        for (const [name, bytes] of files) module.FS_createDataFile('/' + name, null, bytes, true, true, true);
      }],
    });
  } catch (error) {
    send('error', { text: error.stack || String(error) });
  }
};
