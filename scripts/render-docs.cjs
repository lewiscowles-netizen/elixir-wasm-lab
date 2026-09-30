const fs = require('node:fs');
const path = require('node:path');
const markdown = require('markdown-it')({ html: false });
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'docs');
const target = path.join(root, 'web/docs');
const escape = markdown.utils.escapeHtml;
const pages = fs.readdirSync(source, { recursive: true }).filter(name => name.endsWith('.md')).sort().map(name => {
  const content = fs.readFileSync(path.join(source, name), 'utf8');
  return { name, output: name.replace(/\.md$/, '.html'), content, title: content.match(/^# (.+)$/m)?.[1] || name };
});
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  const href = token.attrGet('href');
  if (href && !/^[a-z]+:/i.test(href)) token.attrSet('href', href.replace(/\.md(?=#|$)/, '.html'));
  return renderer.renderToken(tokens, index, options);
};
fs.mkdirSync(target, { recursive: true });
for (const page of pages) {
  const directory = path.dirname(path.join(target, page.output));
  const relative = file => path.relative(directory, path.join(target, file)).split(path.sep).join('/');
  const nav = ['tutorials', 'how-to', 'reference', 'explanation'].map(group => `<h2>${escape(group === 'how-to' ? 'How-to guides' : group[0].toUpperCase() + group.slice(1))}</h2><ul>${pages.filter(item => item.name.startsWith(group + '/')).map(item => `<li><a href="${escape(relative(item.output))}"${item.name === page.name ? ' aria-current="page"' : ''}>${escape(item.title)}</a></li>`).join('')}</ul>`).join('');
  const css = path.relative(directory, path.join(root, 'web/docs.css')).split(path.sep).join('/');
  const lab = path.relative(directory, path.join(root, 'web/index.html')).split(path.sep).join('/');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)} · Elixir Wasm</title><link rel="stylesheet" href="${css}"></head><body><a class="skip" href="#content">Skip to content</a><header><a href="${lab}">λ / Elixir Wasm lab</a><a href="${escape(relative('README.html'))}">Documentation</a></header><div class="layout"><nav aria-label="Documentation">${nav}</nav><main id="content"><article>${markdown.render(page.content)}</article><footer>Generated from the builder's Diátaxis documentation. <a href="${escape(relative('SOURCE.json'))}">Source hashes</a></footer></main></div></body></html>\n`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(target, page.output), html);
}
for (const name of fs.readdirSync(source, { recursive: true }).filter(name => name.endsWith('.json'))) {
  fs.mkdirSync(path.dirname(path.join(target, name)), { recursive: true });
  fs.copyFileSync(path.join(source, name), path.join(target, name));
}
console.log(`Rendered ${pages.length} documentation pages`);
