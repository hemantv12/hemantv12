#!/usr/bin/env node
// Keeps the static AA Growth Studio site consistent.
//   node tools/site/build.mjs           rewrite pages in place
//   node tools/site/build.mjs --check   exit 1 if anything is out of date (for CI)
//
// 1. Writes the shared header and footer (tools/site/partials) into every public page,
//    with relative paths for the page's depth and aria-current on the active section.
// 2. Stamps every local CSS/JS reference (and image references that already carry ?v=)
//    with a short hash of the file's contents, so caches refresh only when a file changes.
// 3. Points canonical, Open Graph and structured-data URLs at SITE, and regenerates
//    sitemap.xml and robots.txt from the pages that are indexable.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', '..', 'rti-growth-studio');
const check = process.argv.includes('--check');
const partial = name => readFileSync(join(here, 'partials', name), 'utf8').trim();
const HEADER = partial('header.html');
const FOOTER = partial('footer.html');
// The public address of the site. Change it here (and add the old one to OLD_ORIGINS) when moving to a custom domain.
const SITE = 'https://aagrowthstudio.com';
const OLD_ORIGINS = /https:\/\/(rti-growth-studio\.onrender\.com|aa-growth-studio\.netlify\.app)/g;
// Redirect stubs and the admin app have no shared chrome.
const NO_CHROME = /^(admin|play|growth-lab|studio|team)\//;

const changed = [];
const hashCache = new Map();
const write = (file, before, after) => {
  if (before === after) return;
  changed.push(relative(site, file).replaceAll('\\', '/'));
  if (!check) writeFileSync(file, after);
};

function hashOf(assetPath) {
  if (!hashCache.has(assetPath)) {
    const file = join(site, assetPath);
    hashCache.set(assetPath, existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10) : null);
  }
  return hashCache.get(assetPath);
}

// Rewrites "…assets/x.css?v=old" (any relative prefix) to "?v=<content hash>".
function stamp(text, fromDir) {
  return text.replace(/((?:\.\.\/)*|\/)?(assets\/[\w./-]+\.(css|js|webp|png|jpe?g|svg))(\?v=[\w.-]+)?(?=["')])/g,
    (whole, prefix = '', path, ext, version) => {
      if (!version && !/^(css|js)$/.test(ext)) return whole;
      const resolved = prefix === '/' ? path : posix.normalize(posix.join(fromDir, prefix, path));
      const hash = hashOf(resolved);
      return hash ? `${prefix}${path}?v=${hash}` : whole;
    });
}

// Assets that reference other assets go first, in dependency order, so their own hashes are final.
for (const asset of ['assets/conversion-system.css', 'assets/visitor-analytics.js', 'assets/motion-system.js']) {
  const file = join(site, asset);
  const before = readFileSync(file, 'utf8');
  const after = stamp(before, '');
  write(file, before, after);
  hashCache.delete(asset);
  if (!check) hashOf(asset);
  else hashCache.set(asset, createHash('sha256').update(after).digest('hex').slice(0, 10));
}

const pages = [];
const indexable = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith('.html')) pages.push(full);
  }
})(site);

for (const file of pages) {
  const rel = relative(site, file).replaceAll('\\', '/');
  const depth = rel.split('/').length - 1;
  const root = '../'.repeat(depth);
  let html = readFileSync(file, 'utf8');
  const before = html;
  if (!NO_CHROME.test(rel) && html.includes('<header class="site-header">')) {
    const section = depth ? rel.split('/')[0] : '';
    const fill = s => s.replaceAll('{{home}}', root || './').replaceAll('{{root}}', root)
      .replaceAll('{{cta}}', rel === 'index.html' ? '#contact' : `${root}contact/`);
    let header = fill(HEADER);
    if (section) header = header.replace(`<a href="${root}${section}/">`, `<a href="${root}${section}/" aria-current="page">`);
    html = html.replace(/<header class="site-header">[\s\S]*?<\/header>/, () => header)
               .replace(/<footer class="site-footer">[\s\S]*?<\/footer>/, () => fill(FOOTER));
  }
  html = stamp(html, posix.dirname(rel) === '.' ? '' : posix.dirname(rel)).replace(OLD_ORIGINS, SITE);
  write(file, before, html);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (canonical?.startsWith(SITE) && !/<meta name="robots" content="[^"]*noindex/.test(html)) indexable.push(canonical);
}

// Shortest paths first, so the home page and section indexes lead the sitemap.
indexable.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
for (const [name, text] of [
  ['sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`],
  ['robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\n`],
]) {
  const file = join(site, name);
  write(file, existsSync(file) ? readFileSync(file, 'utf8') : '', text);
}

if (check && changed.length) {
  console.error(`Out of date (run: node tools/site/build.mjs):\n  ${changed.join('\n  ')}`);
  process.exit(1);
}
console.log(check ? 'Site is up to date.' : changed.length ? `Updated ${changed.length} file(s):\n  ${changed.join('\n  ')}` : 'Nothing to update.');
