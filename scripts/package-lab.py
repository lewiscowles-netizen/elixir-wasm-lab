#!/usr/bin/env python3
"""Create a standalone lab archive containing only the selected, verified local runtimes."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[1]
catalogue = json.loads((ROOT / 'web/runtimes.local.json').read_text())
selected = set()
for runtime in catalogue['runtimes']:
    directory = ROOT / 'web' / runtime['directory']
    if not directory.resolve().is_relative_to((ROOT / 'web/runtimes').resolve()):
        raise ValueError('Runtime path escapes the runtime directory')
    manifest_bytes = (directory / 'manifest.json').read_bytes()
    if hashlib.sha256(manifest_bytes).hexdigest() != runtime['manifestSha256']:
        raise ValueError('Runtime manifest changed: ' + runtime['id'])
    manifest = json.loads(manifest_bytes)
    for name, expected in manifest['files'].items():
        if Path(name).name != name:
            raise ValueError('Invalid artifact path')
        data = (directory / name).read_bytes()
        if len(data) != expected['bytes'] or hashlib.sha256(data).hexdigest() != expected['sha256']:
            raise ValueError('Runtime artifact changed: ' + name)
        selected.add(directory / name)
    selected.add(directory / 'manifest.json')
if not (ROOT / 'web/docs/README.html').exists():
    raise ValueError('Render the documentation first: yarn docs:build')
for directory in ['web', 'docs', 'evidence']:
    for file in (ROOT / directory).rglob('*'):
        if file.is_file() and not file.is_relative_to(ROOT / 'web/runtimes'):
            selected.add(file)
selected.update(ROOT / name for name in ['serve.py', 'ARCHIVE_README.md'])
output = ROOT / 'dist/elixir-wasm-lab.tar.gz'
output.parent.mkdir(exist_ok=True)
with output.open('wb') as stream, gzip.GzipFile(filename='', fileobj=stream, mode='wb', mtime=0) as compressed, tarfile.open(fileobj=compressed, mode='w|', format=tarfile.USTAR_FORMAT) as archive:
    for file in sorted(selected):
        data = file.read_bytes()
        name = 'README.md' if file.name == 'ARCHIVE_README.md' else file.relative_to(ROOT).as_posix()
        entry = tarfile.TarInfo('elixir-wasm-lab/' + name)
        entry.size, entry.mode = len(data), 0o644
        archive.addfile(entry, io.BytesIO(data))
hasher = hashlib.sha256()
with output.open('rb') as archive:
    for block in iter(lambda: archive.read(1024 * 1024), b''):
        hasher.update(block)
digest = hasher.hexdigest()
output.with_suffix(output.suffix + '.sha256').write_text(digest + '  ' + output.name + '\n')
print(str(output) + '\nSHA-256 ' + digest)
