const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const root=path.join(__dirname,'..');
const outfile=path.join(root,'public','vendor','capacitor-bridge.js');
fs.mkdirSync(path.dirname(outfile),{recursive:true});
const source=`
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
window.CollabzyNative = { App, Browser, Capacitor };
if (Capacitor.isNativePlatform()) {
  App.addListener('appUrlOpen', async ({ url }) => {
    if (typeof url === 'string' && url.startsWith('collabzy://instagram/callback')) {
      try { await Browser.close(); } catch (_) {}
      window.dispatchEvent(new CustomEvent('collabzy:oauth-return', { detail: { url } }));
    }
  });
}
`;
esbuild.buildSync({
  stdin:{contents:source,resolveDir:root,sourcefile:'collabzy-capacitor-bridge.js',loader:'js'},
  bundle:true,platform:'browser',format:'iife',target:['es2020'],outfile,
  legalComments:'none',minify:true
});
console.log('Bundled Capacitor App/Browser bridge:',path.relative(root,outfile));
