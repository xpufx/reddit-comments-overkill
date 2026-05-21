const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf-8');
const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf-8');

const body = marked.parse(readme, { gfm: true });
const html = template
  .replace('$title$', 'Reddit Comments Overkill')
  .replace('$body$', body);

const outDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('Built docs/index.html');
