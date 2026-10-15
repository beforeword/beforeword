'use strict';
// Real panel DOM logic in fixtures. This does not verify browser layout or provider behavior.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom'),base=path.resolve(__dirname,'../extension'),read=name=>fs.readFileSync(path.join(base,name),'utf8');
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
async function harness({language='en',analyze}={}){
 const {document,window:dom}=parseHTML(read('panel.html'));let focused=null,api,clock=0;
 const calls=[],copies=[],scrolls=[],timers=new Map();
 Object.defineProperty(document,'activeElement',{get:()=>focused});dom.HTMLElement.prototype.focus=function(){focused=this;};dom.HTMLElement.prototype.scrollIntoView=function(options){scrolls.push({id:this.id,options});};
 Object.defineProperty(dom.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||'';},set(value){for(const option of this.querySelectorAll('option'))option.toggleAttribute('selected',option.value===value);}});
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
 const sandbox={document,console,URL,Blob,AbortController,Intl,TextEncoder,TextDecoder,Node:dom.Node,Element:dom.Element,
  navigator:{language,clipboard:{writeText:async text=>copies.push(text)}},location:{href:'https://fixture.test/panel.html'},
  addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame(){},
  setTimeout(fn){const id=++clock;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  BeforewordWebHost:{initialLanguage:language,initialVisible:true,message:async()=>({ok:true}),attach(value){api=value;}},
  BeforewordAnalysisModel:{getStatus:async()=>({mode:'service',configured:true,trial:{limit:8,remaining:8}}),getPreferences:async()=>({mode:'service',protocol:'openai',endpoint:'',model:''}),clearSession:async()=>{},
   analyze:async input=>{calls.push(input);const raw=analyze?await analyze(input,calls.length):{language:input.language,items:[{quote:{text:input.text,occurrence:0},reading:'This **written form remains writing**.'}]};const supplied=vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify({text:input.text,language:input.language}))+')',sandbox);return {report:sandbox.BeforewordAnalysisCore.validateReport(JSON.stringify(raw),supplied),model:'fixture-model',trial:{limit:8,remaining:8-calls.length}};}}};
 sandbox.window=sandbox;vm.createContext(sandbox);
 for(const name of ['form-core.js','instructions.js','analysis-core.js','reading-surface.js','analysis-examples.js','reading-guide.js','panel.js'])vm.runInContext(read(name),sandbox,{filename:name});
 await flush();
 const one=selector=>{const el=document.querySelector(selector);assert(el,'Missing '+selector);return el;};
 const click=async selector=>{one(selector).dispatchEvent(new dom.Event('click',{bubbles:true,cancelable:true}));await flush();};
 const submit=async text=>{api.acceptSelection({text,origin:'https://fixture.test'});await click('#analyze');};
 return {document,dom,sandbox,api,one,click,submit,calls,copies,scrolls};
}
test('new compact notes display just the exact quote and added reading with no filler disclosure',async()=>{
 const f=await harness();await f.submit('The original.');assert.equal(f.calls.length,1);
 assert.equal(f.one('.quote-button').textContent,'The original.');assert.equal(f.one('.reading-step strong').textContent,'written form remains writing');
 assert.equal(f.document.querySelectorAll('.report-details,.grounds-field,.limit-field').length,0);
 await f.click('#copy-analysis');assert.ok(f.copies[0].includes('The original.'));assert.ok(f.copies[0].includes('This **written form remains writing**.'));assert.doesNotMatch(f.copies[0],/undefined|Basis for|Further qualification/);
});
test('all prepared examples render both languages without a model request',async()=>{
 for(const language of ['ru','en']){const f=await harness({language});for(const example of f.sandbox.BeforewordExamples){f.api.openExample(example.id);await flush();assert.equal(f.one('.quote-button').textContent,example.text[language]);assert.equal(f.document.querySelectorAll('.report-details').length,0);assert.equal(f.document.querySelectorAll('.reading-step strong').length,1);}assert.equal(f.calls.length,0);}
});
test('old reports remain readable behind a collapsed disclosure without relabelling model text',async()=>{
 const f=await harness({analyze:input=>({language:input.language,items:[{quote:{text:input.text,occurrence:0},reading:'Previous reading.',attribution:null,grounds:{kind:'record',explanation:'Exact previous explanation.',citations:[{text:input.text,occurrence:0}]},limit:'Previous limit.'}]})});
 await f.submit('Source.');assert.notEqual(f.one('.report-details').open,true);assert.equal(f.one('.grounds-field .report-text').textContent,'Exact previous explanation.');await f.click('#copy-analysis');assert.ok(f.copies[0].includes('Previous limit.'));
});
test('bold display cannot introduce HTML, links or scripts; copying keeps exact original prose',async()=>{
 const reading='**<img src=x onerror=evil()>** <script>evil()</script> [go](javascript:evil()) **unfinished';
 const f=await harness({analyze:input=>({language:input.language,items:[{quote:{text:input.text,occurrence:0},reading}]})});await f.submit('<svg onload=evil()>');
 const body=f.one('#analysis-items');assert.equal(body.querySelectorAll('img,script,svg,a').length,0);assert.equal(body.querySelector('strong').textContent,'<img src=x onerror=evil()>');await f.click('#copy-analysis');assert.ok(f.copies[0].includes(reading));
});
test('cancel stops waiting and rejects a late result; a following request can complete',async()=>{
 const held=deferred();const f=await harness({analyze:(input,count)=>count===1?held.promise:{language:input.language,items:[{quote:{text:input.text,occurrence:0},reading:'Second **complete note**.'}]}});
 await f.submit('First.');assert.equal(f.one('#cancel-analysis').hidden,false);await f.click('#cancel-analysis');assert.equal(f.calls[0].signal.aborted,true);
 held.resolve({language:'en',items:[{quote:{text:'First.',occurrence:0},reading:'Late result.'}]});await flush();assert.equal(f.document.querySelectorAll('.analysis-card').length,0);
 await f.submit('Second.');assert.equal(f.calls.length,2);assert.equal(f.one('.reading-step strong').textContent,'complete note');
});
test('changing the language during analysis cancels and prevents an old-language result from entering the panel',async()=>{
 const held=deferred(),f=await harness({analyze:()=>held.promise});await f.submit('First.');await f.click('[data-language="ru"]');assert.equal(f.calls[0].signal.aborted,true);
 held.resolve({language:'en',items:[{quote:{text:'First.',occurrence:0},reading:'Late result.'}]});await flush();assert.equal(f.document.querySelectorAll('.analysis-card').length,0);assert.equal(f.document.documentElement.lang,'ru');
});
test('the prepared walkthrough shows one complete phrase and one compact reading, without another basis field',async()=>{
 const f=await harness();assert.equal(f.document.querySelector('.bw-guide'),null);await f.click('#menu-help');f.one('#panel-guide').open=true;f.one('#panel-guide').dispatchEvent(new f.dom.Event('toggle'));await flush();await f.click('[data-guide="skip"]');
 const guide=f.one('.bw-guide');assert.equal(guide.getAttribute('data-stage'),'note');assert.equal(guide.querySelectorAll('.bw-guide-link').length,1);assert.equal(guide.querySelectorAll('.bw-guide-basis').length,0);assert.equal(guide.querySelector('.bw-guide-quote').textContent,'t r u s t');assert.match(guide.querySelector('.bw-guide-reading strong').textContent,/do not become trust/);assert.equal(f.calls.length,0);
});

test('the current-site first screen starts with an editable source and six direct examples, with no automatic walkthrough',async()=>{
 const f=await harness();assert.equal(f.one('#editor').open,true);assert.equal(f.one('#editor').hidden,false);assert.equal(f.one('#analysis-actions').hidden,false);assert.equal(f.one('#panel-guide').open,undefined);assert.equal(f.document.querySelector('.bw-guide'),null);assert.equal(f.document.querySelectorAll('#example-buttons button').length,6);assert.equal(f.one('#record-column').nextElementSibling.id,'analysis-section');assert.equal(f.calls.length,0);
 await f.click('[data-example="trust"]');assert.equal(f.calls.length,0);assert.equal(f.one('#record-output').textContent,'t r u s t');assert.equal(f.one('.quote-button').textContent,'t r u s t');assert.match(f.one('#analysis-origin').textContent,/Prepared example/);
});
test('source and explicit action precede the result after completion; editing is a separate reversible action',async()=>{
 const f=await harness();await f.submit('Exact source.');assert.equal(f.one('#record-details').nextElementSibling.id,'analysis-actions');assert.equal(f.one('#record-details').open,true);assert.equal(f.one('#editor').hidden,true);assert.equal(f.one('#record-column').nextElementSibling.id,'analysis-section');await f.click('#edit-source');assert.equal(f.one('#editor').hidden,false);assert.equal(f.one('#source').value,'Exact source.');assert.equal(f.calls.length,1);
});
test('menu closes on Escape and outside press, restores focus, and supports direct secondary tools',async()=>{
 const f=await harness();f.one('#reader-menu').open=true;const event=new f.dom.Event('keydown',{bubbles:true,cancelable:true});event.key='Escape';f.document.dispatchEvent(event);assert.equal(f.one('#reader-menu').open,false);assert.equal(f.document.activeElement.id,'reader-menu-trigger');f.one('#reader-menu').open=true;f.one('#source').dispatchEvent(new f.dom.Event('pointerdown',{bubbles:true}));assert.equal(f.one('#reader-menu').open,false);await f.click('#menu-data');assert.equal(f.one('#data-notice').hidden,false);assert.equal(f.one('#data-notice').open,true);assert.equal(f.calls.length,0);
});
test('each admitted repeat request shows progress and reveals an offscreen action without scrolling an already visible one',async()=>{
 const pending=[];const f=await harness({analyze:(input)=>{const held=deferred();pending.push({held,input});return held.promise;}});f.sandbox.innerHeight=700;f.one('#analyze').getBoundingClientRect=()=>({top:900,bottom:948});
 await f.submit('First.');assert.equal(f.one('#analysis-spinner').hasAttribute('hidden'),false);assert.ok(f.scrolls.some(item=>item.id==='analyze'));pending[0].held.resolve({language:'en',items:[{quote:{text:'First.',occurrence:0},reading:'The **first reading**.'}]});await flush();assert.equal(f.one('#analysis-spinner').hasAttribute('hidden'),true);
 f.scrolls.length=0;f.one('#analyze').getBoundingClientRect=()=>({top:0,bottom:48});await f.click('#analyze');assert.equal(f.calls.length,2);assert.equal(f.one('#analysis-spinner').hasAttribute('hidden'),false);assert.ok(!f.scrolls.some(item=>item.id==='analyze'));await f.click('#cancel-analysis');assert.equal(f.one('#analysis-spinner').hasAttribute('hidden'),true);assert.equal(f.calls[1].signal.aborted,true);
});

test('plain Enter does not send; Ctrl/Cmd+Enter deliberately sends the visible writing',async()=>{
 for(const modifier of ['ctrlKey','metaKey']){
  const f=await harness();const source=f.one('#source');source.value='Exact keyboard source.';source.dispatchEvent(new f.dom.Event('input',{bubbles:true}));await flush();
  const enter=new f.dom.Event('keydown',{bubbles:true,cancelable:true});enter.key='Enter';source.dispatchEvent(enter);await flush();assert.equal(f.calls.length,0);assert.equal(enter.defaultPrevented,false);
  const shortcut=new f.dom.Event('keydown',{bubbles:true,cancelable:true});shortcut.key='Enter';shortcut[modifier]=true;source.dispatchEvent(shortcut);await flush();assert.equal(f.calls.length,1);assert.equal(f.calls[0].text,'Exact keyboard source.');assert.equal(shortcut.defaultPrevented,true);
 }
});
test('a web entry opens the existing source editor after a selection without sending or losing writing',async()=>{
 const f=await harness();f.api.acceptSelection({text:'Keep this exact source.'});assert.equal(f.one('#editor').hidden,true);f.api.focusEditor();assert.equal(f.one('#editor').hidden,false);assert.equal(f.one('#source').value,'Keep this exact source.');assert.equal(f.document.activeElement.id,'source');assert.equal(f.calls.length,0);
});

test('menu navigation and controls are labelled in the selected interface language',async()=>{
 const f=await harness({language:'ru'});assert.equal(f.one('#reader-menu nav').getAttribute('aria-label'),'Меню');assert.equal(f.one('#reader-menu-trigger').getAttribute('aria-label'),'Меню');assert.equal(f.one('#close-menu').getAttribute('aria-label'),'Закрыть меню');await f.click('[data-language="en"]');assert.equal(f.one('#reader-menu nav').getAttribute('aria-label'),'Menu');assert.equal(f.one('#close-menu').getAttribute('aria-label'),'Close menu');
});

test('the first screen states the written-form boundary with one short continuation in RU and EN',async()=>{
 for(const [language,title,purpose]of [['ru','Написанное слово не становится тем, что им называют.','Даже когда мы умеем его читать.'],['en','A written word does not become what it names.','Even when we have learned to read it.']]){
  const f=await harness({language});assert.equal(f.one('#title').textContent,title);assert.equal(f.one('.purpose').textContent,purpose);assert.equal(f.calls.length,0);
 }
});
