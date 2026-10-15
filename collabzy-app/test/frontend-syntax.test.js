const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('public frontend JavaScript parses without syntax errors',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
 const match=html.match(/<script>([\\s\\S]*?)<\\/script>/);
 assert.ok(match,'main frontend script should exist');
 assert.doesNotThrow(()=>new vm.Script(match[1]),'frontend script must parse');
});
