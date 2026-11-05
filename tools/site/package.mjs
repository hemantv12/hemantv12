#!/usr/bin/env node
// Builds a clean upload folder for shared hosting (ServerByt / cPanel):
//   node tools/site/package.mjs
// Runs the site build, then copies rti-growth-studio/ to deploy/public_html/ without source
// photos, drafts and redirect stubs, adds the Apache .htaccess, and zips it to deploy/aagrowthstudio-site.zip.
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const site = join(repo, 'rti-growth-studio');
const out = join(repo, 'deploy');
const pub = join(out, 'public_html');

// Not part of the live site: original photos (webp versions are used), drafts, templates,
// and stub pages that .htaccess now redirects.
const EXCLUDE = [
  /^assets\/team\/.*\.(jpe?g|png)$/i,
  /^assets\/social-launch(\/|$)/,
  /\.b64$/,
  /\.md$/,
  /^work\/case-study-template\.html$/,
  /^(studio|team|growth-lab|play)(\/|$)/,
];

execFileSync(process.execPath, [join(here, 'build.mjs')], { stdio: 'inherit' });
const zip = join(out, 'aagrowthstudio-site.zip');
rmSync(pub, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(pub, { recursive: true });
cpSync(site, pub, {
  recursive: true,
  filter: src => {
    const rel = relative(site, src).split(sep).join('/');
    return !rel || !EXCLUDE.some(rule => rule.test(rel));
  },
});
copyFileSync(join(here, 'htaccess'), join(pub, '.htaccess'));

if (process.platform === 'win32') {
  // Windows' bsdtar writes forward-slash zip paths; Compress-Archive in PowerShell 5 writes backslashes,
  // which Linux hosting extracts as odd file names.
  execFileSync(join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-a', '-cf', '../aagrowthstudio-site.zip', '.'], { cwd: pub, stdio: 'inherit' });
} else {
  execFileSync('zip', ['-qr', zip, '.'], { cwd: pub, stdio: 'inherit' });
}
console.log(`Upload folder: ${pub}\nZip: ${zip}`);
