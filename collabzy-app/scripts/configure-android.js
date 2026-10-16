const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'..','android','app','src','main','AndroidManifest.xml');
if(!fs.existsSync(file))throw new Error('AndroidManifest.xml not found; run npx cap add android and npx cap sync android first.');
let xml=fs.readFileSync(file,'utf8');
const activity=/<activity\\b(?=[^>]*android:name="\\.MainActivity")[^>]*>[\\s\\S]*?<\\/activity>/;
if(!activity.test(xml))throw new Error('Could not locate Capacitor MainActivity in AndroidManifest.xml.');
xml=xml.replace(activity,block=>{
  block=block.replace(/<activity\\b[^>]*>/,start=>{
    if(start.includes('android:launchMode='))return start;
    return start.replace('>', ' android:launchMode="singleTask">');
  });
  if(!block.includes('android:scheme="collabzy"')){
    block=block.replace('</activity',`  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="collabzy" android:host="instagram" android:path="/callback" />
  </intent-filter>
</activity`);
  }
  return block;
});
fs.writeFileSync(file,xml);
console.log('Configured collabzy://instagram/callback and singleTask activity launch mode.');
