const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'..','android','app','src','main','AndroidManifest.xml');
if(!fs.existsSync(file))throw new Error('AndroidManifest.xml not found; run npx cap add android and npx cap sync android first.');
let xml=fs.readFileSync(file,'utf8');
let cursor=0, found=false;
while(true){
  const start=xml.indexOf('<activity',cursor);
  if(start<0)break;
  const openEnd=xml.indexOf('>',start);
  if(openEnd<0)break;
  const openTag=xml.slice(start,openEnd+1);
  if(openTag.includes('android:name=".MainActivity"')){
    found=true;
    let nextTag=openTag;
    if(!nextTag.includes('android:launchMode='))nextTag=nextTag.slice(0,-1)+' android:launchMode="singleTask">';
    const close=xml.indexOf('</activity>',openEnd+1);
    if(close<0)throw new Error('MainActivity closing tag missing in AndroidManifest.xml.');
    let body=xml.slice(openEnd+1,close);
    if(!body.includes('android:scheme="collabzy"')){
      body += '\n  <intent-filter>\n    <action android:name="android.intent.action.VIEW" />\n    <category android:name="android.intent.category.DEFAULT" />\n    <category android:name="android.intent.category.BROWSABLE" />\n    <data android:scheme="collabzy" android:host="instagram" android:path="/callback" />\n  </intent-filter>\n';
    }
    xml=xml.slice(0,start)+nextTag+body+'</activity>'+xml.slice(close+11);
    break;
  }
  cursor=openEnd+1;
}
if(!found)throw new Error('Could not locate MainActivity in AndroidManifest.xml.');
fs.writeFileSync(file,xml);
console.log('Configured collabzy://instagram/callback and singleTask activity launch mode.');
