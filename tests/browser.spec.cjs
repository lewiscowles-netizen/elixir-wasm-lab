const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, '../web/runtimes.local.json')));

async function run(page, source) {
  if (source !== null) await page.getByLabel('Elixir source code').fill(source);
  await page.getByRole('button', { name: 'Run Elixir' }).click();
  await expect(page.locator('#stop')).toBeDisabled({ timeout: 125000 });
  return { status: await page.locator('#status').innerText(), stdout: await page.locator('#stdout').innerText(), stderr: await page.locator('#stderr').innerText() };
}

for (const runtime of catalogue.runtimes.filter(entry => !entry.target || entry.target === "browser-emscripten")) {
  test(`execute ${runtime.id || runtime.version} without external network`, async ({ page, context, browser }, testInfo) => {
    const external = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:8130') return route.continue();
      external.push(url.href);
      return route.abort();
    });
    await page.goto('/web/');
    const backend = runtime.backend || 'direct';
    await page.getByLabel('Runtime integration', { exact: true }).selectOption(backend);
    await page.getByLabel('Elixir release', { exact: true }).selectOption(runtime.id || runtime.version);
    const hasJson = Number(runtime.version.split('.')[1]) >= 18;
    const jsonProbe = hasJson ? '\ndecoded = JSON.decode!(JSON.encode!(%{"values" => [20, 22]}))\nIO.puts("JSON=#{Enum.sum(Map.fetch!(decoded, \"values\"))}")' : '';
    const bridgeProbe = backend === 'popcorn' ? '\nIO.puts("BRIDGE=#{Popcorn.Wasm.run_js!(\"() => 6 * 7\")}")' : '';
    const result = await run(page, backend === 'atomvm' ? null : 'IO.puts("VERSION=" <> System.version())\nIO.puts("OTP=" <> to_string(:erlang.system_info(:otp_release)))\nIO.inspect(Enum.map([1, 2, 3], fn n -> n * n end))\nparent = self()\nspawn(fn -> send(parent, {:ok, 42}) end)\nreceive do {:ok, n} -> IO.puts("MESSAGE=#{n}") after 1000 -> raise "timeout" end\ndefmodule BrowserProof do\n def answer, do: 6 * 7\nend\nFile.write!("/tmp/proof.txt", "local file")\nIO.puts(File.read!("/tmp/proof.txt"))' + jsonProbe + bridgeProbe + '\nBrowserProof.answer()');
    const manifest = fs.readFileSync(path.join(__dirname, '../web', runtime.directory, 'manifest.json'));
    await testInfo.attach('runtime-evidence', { body: JSON.stringify({ runtime, browser: browser.version(), manifestSha256: crypto.createHash('sha256').update(manifest).digest('hex'), result, externalRequests: external }, null, 2), contentType: 'application/json' });
    expect(result.status).toMatch(/^Completed/);
    if (backend === 'atomvm') {
      expect(result.stdout).toContain('COMPILER=' + runtime.version);
      expect(result.stdout).toContain('Hello from stock AtomVM');
      expect(result.stdout).toContain('{squares,[1,4,9]}');
      expect(result.stdout).toContain('MESSAGE=42');
      await expect(page.getByLabel('Elixir source code')).toHaveAttribute('readonly', '');
      await expect(page.getByLabel('Example', { exact: true })).toBeDisabled();
    } else {
      expect(result.stdout).toContain('VERSION=' + runtime.version);
      expect(result.stdout).toContain('OTP=' + runtime.otp.split('.')[0]);
      expect(result.stdout).toContain('[1, 4, 9]');
      expect(result.stdout).toContain('MESSAGE=42');
      expect(result.stdout).toContain('local file');
      expect(result.stdout).toContain('=> 42');
      if (hasJson) expect(result.stdout).toContain('JSON=42');
      if (backend === 'popcorn') expect(result.stdout).toContain('BRIDGE=42');
    }
    expect(external).toEqual([]);
    if (runtime.application === 'receipts') {
      const project = await run(page, '{:ok, _} = Application.ensure_all_started(:receipts)\nIO.inspect(Receipts.remember([1200, 450, 350]))\nIO.inspect(Receipts.remember([100, 200]))\nIO.inspect(Receipts.history())\nIO.puts(File.read!(Path.join(to_string(:code.priv_dir(:receipts)), "receipt-label.txt")))');
      await testInfo.attach('project-evidence', { body: JSON.stringify(project), contentType: 'application/json' });
      expect(project.status).toMatch(/^Completed/);
      expect(project.stdout).toContain('[2000, 300]');
      expect(project.stdout).toContain('A receipt from your browser');
    }
  });
}

for (const backend of ['direct', 'popcorn'].filter(name => catalogue.runtimes.some(runtime => (runtime.backend || 'direct') === name))) {
test(`${backend}: fresh state, error recovery, stop and target boundaries`, async ({ page }) => {
  await page.goto('/web/');
  const runtime = catalogue.runtimes.find(entry => entry.version === '1.20.4' && !entry.application && (entry.backend || 'direct') === backend);
  await page.getByLabel('Runtime integration', { exact: true }).selectOption(backend);
  await page.getByLabel('Elixir release', { exact: true }).selectOption(runtime.id || runtime.version);
  const failed = await run(page, 'IO.puts(:stderr, "ERROR_STREAM")\nraise "deliberate failure"');
  expect(failed.status).toMatch(/^Failed/);
  expect(failed.stderr).toContain('ERROR_STREAM');
  expect(failed.stderr).toContain('deliberate failure');
  const recovered = await run(page, 'IO.inspect(File.exists?("/tmp/proof.txt"))\n21 * 2');
  expect(recovered.status).toMatch(/^Completed/);
  expect(recovered.stdout).toContain('false');
  expect(recovered.stdout).toContain('=> 42');
  await page.getByLabel('Example', { exact: true }).selectOption('loop');
  await page.getByLabel('Elixir source code').fill('IO.puts("LOOP_STARTED")\ndefmodule Forever do\n def run, do: run()\nend\nForever.run()');
  await page.getByRole('button', { name: 'Run Elixir' }).click();
  await expect(page.locator('#stdout')).toContainText('LOOP_STARTED', { timeout: 125000 });
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Stopped.');
  const restarted = await run(page, '6 * 7');
  expect(restarted.status).toMatch(/^Completed/);
  expect(restarted.stdout).toContain('=> 42');
  await page.getByLabel('Execution target').selectOption('wasi');
  await expect(page.locator('#run')).toBeDisabled();
  await expect(page.locator('#requirements')).toContainText('No WASI build is available for this integration');
  await page.getByLabel('Execution target').selectOption('browser');
  await page.route('**/runtimes.local.json', route => route.fulfill({ json: { ...catalogue, runtimes: catalogue.runtimes.filter(entry => entry.version !== runtime.version) } }));
  await page.reload();
  await page.getByLabel('Runtime integration', { exact: true }).selectOption(backend);
  await page.getByLabel('Elixir release', { exact: true }).selectOption(runtime.version);
  await expect(page.locator('#run')).toBeDisabled();
  await expect(page.locator('#requirements')).toContainText('compatible runtime bundle has been built and imported');
});
}

for (const runtime of catalogue.runtimes.filter(entry => entry.target === 'wasm32-wasip1')) {
  test(`WASI selection and download ${runtime.id}`, async ({ page }) => {
    await page.goto('/web/');
    await page.getByLabel('Runtime integration', { exact: true }).selectOption('atomvm');
    await page.getByLabel('Execution target').selectOption('wasi');
    await page.getByLabel('Elixir release', { exact: true }).selectOption(runtime.id);
    await expect(page.locator('#run')).toBeDisabled();
    await expect(page.locator('#wasi-command')).toBeVisible();
    await expect(page.locator('#wasi-instructions')).toContainText('wasmtime run --dir .::/bundle AtomVM.wasm');
    await expect(page.locator('#code')).toHaveValue(/Hello from Elixir on WASI/);
    await expect(page.locator('#provenance a')).toHaveAttribute('href', runtime.directory + 'manifest.json');
    const response = await page.request.get('/web/' + runtime.archive.url);
    expect(response.ok()).toBe(true);
    expect(crypto.createHash('sha256').update(await response.body()).digest('hex')).toBe(runtime.archive.sha256);
    await page.getByLabel('Execution target').selectOption('browser');
    await expect(page.locator('#wasi-command')).toBeHidden();
    await expect(page.locator('#run')).toBeEnabled();
  });
}
