const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf-8');
const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf-8');

let body = marked.parse(readme, { gfm: true });

// Strip the H1 (title is in the nav bar), keep the logo
body = body.replace(/<h1[^>]*>.*?<\/h1>\s*/, '');

const html = template
  .replace('$title$', 'Reddit Comments Overkill')
  .replace('$body$', body);

const outDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);

// Copy images referenced in README so they display on the site
const images = [
  'reddit-comments-overkill-web.png',
  'reddit-comments-overkill-screenshot.png'
];
for (const img of images) {
  const src = path.join(__dirname, '..', img);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(outDir, img));
  }
}

console.log('Built docs/index.html + assets');
