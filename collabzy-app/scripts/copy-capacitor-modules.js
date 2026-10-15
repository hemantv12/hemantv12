const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const copies=[
  {from:'node_modules/@capacitor/core/dist/esm',to:'public/vendor/capacitor-core'},
  {from:'node_modules/@capacitor/app/dist/esm',to:'public/vendor/capacitor-app'},
  {from:'node_modules/@capacitor/browser/dist/esm',to:'public/vendor/capacitor-browser'}
];
for(const item of copies){
  const from=path.join(root,item.from),to=path.join(root,item.to);
  if(!fs.existsSync(from))throw new Error('Capacitor plugin module directory missing: '+item.from);
  fs.rmSync(to,{recursive:true,force:true});
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.cpSync(from,to,{recursive:true});
}
console.log('Copied local Capacitor ESM modules for offline APK OAuth support.');
