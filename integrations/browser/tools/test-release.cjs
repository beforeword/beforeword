'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'../extension'),read=name=>fs.readFileSync(path.join(base,name)),sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const policy=JSON.parse(fs.readFileSync(path.join(__dirname,'release-policy.json'),'utf8'));
test('each request contains the complete pinned core followed only by its application contract',()=>{
 const pin=JSON.parse(fs.readFileSync(path.join(__dirname,'../release-pin.json'),'utf8'));
 require('../extension/instructions.js');const instruction=globalThis.BeforewordInstructions,core=require('../extension/analysis-core.js');
 assert.equal(instruction.version,pin.version);assert.equal(sha(Buffer.from(instruction.core)),pin.sha256);assert.equal(Buffer.byteLength(instruction.core),pin.bytes);
 const source={text:'  Я чувствую.\r\n<record>&amp;</record> é е 😀  ',language:'ru'};
 for(const reportVersion of [1,2,3]){const request=core.buildRequest(source,{reportVersion});assert.ok(request.system.startsWith(instruction.core+'\n\nEXCERPT READER CONTRACT:'));assert.equal(request.system.split(instruction.core).length-1,1);assert.deepEqual(JSON.parse(request.user),source);assert.ok(request.system.endsWith(JSON.stringify(core.schemaForVersion(reportVersion))));}
});
test('protected runtime modules retain their exact downloadable baseline bytes',()=>{
 for(const [name,expected] of Object.entries(policy.protectedFiles))assert.equal(sha(read(name)),expected,name);
 const original=policy.baselineManifest,candidate=JSON.parse(read('manifest.json'));assert.equal(candidate.version,policy.version);assert.deepEqual({...candidate,version:original.version},original);
});
test('selection code differs only by the recorded reversible branding edits',()=>{
 const guard=JSON.parse(fs.readFileSync(path.join(__dirname,'selection-brand-guard.json'),'utf8'));let restored=read('selection.js').toString();assert.equal(sha(Buffer.from(restored)),guard.candidateSha256);
 for(const change of [...guard.changes].reverse()){
  if(change.after){assert.equal(restored.split(change.after).length-1,1);restored=restored.replace(change.after,change.before);}
  else{const marker='      anchorLayer.append(anchorPaint,anchorNotes);';assert.equal(restored.split(marker).length-1,1);restored=restored.replace(marker,change.before+marker);}
 }
 assert.equal(sha(Buffer.from(restored)),guard.baselineSha256);
});
test('icons have their declared native dimensions and UI uses native SVG paths without the legacy sign',()=>{
 for(const size of [16,32,48,128]){const png=read('icons/icon-'+size+'.png');assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
 for(const name of ['panel.html','welcome.html','privacy.html']){const html=read(name).toString();assert.ok(html.includes('class="brand-wordmark" aria-hidden="true" focusable="false"'));assert.doesNotMatch(html,/<img src="assets\/brand.svg"/);}
 const selection=read('selection.js').toString();assert.doesNotMatch(selection,/railBrand.textContent = 'b\/'|194 239 908 762/);assert.ok(selection.includes('width:94px;height:44px'));assert.ok(selection.includes('innerWidth - 94 - padding'));
});
