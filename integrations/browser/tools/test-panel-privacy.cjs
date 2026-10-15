'use strict';
// Actual panel + provider profile + transport modules, with DOM/browser APIs mocked.
// No real provider, API key or network is used.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto'),{parseHTML}=require('linkedom');
const base=path.resolve(__dirname,'../extension'),read=name=>fs.readFileSync(path.join(base,name),'utf8');
const prefsKey='beforewordModelPreferencesV1',keyKey='beforewordCustomKeyV1',fixtureKey='fixture-key-not-real';
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
const until=async condition=>{for(let i=0;i<1000&&!condition();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(condition(),'UI operation completed');};
async function harness({language='en',saved=null,key=null,selection=null}={}){
 const {document,window:dom}=parseHTML(read('panel.html'));let focused=null;
 Object.defineProperty(document,'activeElement',{get:()=>focused});dom.HTMLElement.prototype.focus=function(){focused=this;};dom.HTMLElement.prototype.scrollIntoView=function(){};
 Object.defineProperty(dom.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||'';},set(value){for(const option of this.querySelectorAll('option'))option.toggleAttribute('selected',option.value===value);}});
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
 const state={local:saved?{[prefsKey]:structuredClone(saved)}:{},session:key?{[keyKey]:structuredClone(key)}:{},requests:[],permissions:[]};
 const listeners=[];const storage=area=>({get:async key=>({[key]:state[area][key]}),set:async value=>{const changes={};for(const [key,item]of Object.entries(value)){changes[key]={oldValue:state[area][key],newValue:structuredClone(item)};state[area][key]=structuredClone(item);}for(const listener of listeners)listener(changes,area);},remove:async key=>{const oldValue=state[area][key];delete state[area][key];for(const listener of listeners)listener({[key]:{oldValue}},area);},setAccessLevel:async()=>{}});
 const sandbox={document,console,URL,Blob,AbortController,Intl,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,Node:dom.Node,Element:dom.Element,
  navigator:{language,clipboard:{writeText:async()=>{}}},location:{href:'chrome-extension://fixture/panel.html'},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame(){},setTimeout,clearTimeout,
  BeforewordServiceConfig:{mode:'service',endpoint:'https://api.beforeword.xyz/api/analyze'},
  chrome:{windows:{getCurrent:async()=>({id:1})},runtime:{id:'fixture',onMessage:{addListener(){}},sendMessage:async({type})=>type==='bw:get-state'?{ok:true,language,selection}:type==='bw:consume-intent'?{ok:true,accepted:true,selection}:{ok:true,available:false}},storage:{local:storage('local'),session:storage('session'),onChanged:{addListener:listener=>listeners.push(listener)}},permissions:{contains:async()=>true,request:async value=>{state.permissions.push(value);return true;}}},
  fetch:async(url,options)=>{state.requests.push({url,options});if(options.method==='GET')return new Response(JSON.stringify({data:[{id:'fixture-model'}]}));const input=JSON.parse(options.body).messages.at(-1).content;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({language:'en',items:[{quote:{text:'The writing.',occurrence:0},reading:'The form **remains writing**.'}]})}}]}));}};
 sandbox.window=sandbox;vm.createContext(sandbox);
 for(const name of ['form-core.js','instructions.js','analysis-core.js','providers.js','analysis-model.js','reading-surface.js','analysis-examples.js','reading-guide.js','panel.js'])vm.runInContext(read(name),sandbox,{filename:name});
 await flush();
 const one=selector=>{const node=document.querySelector(selector);assert(node,'Missing '+selector);return node;};
 const click=async selector=>{one(selector).dispatchEvent(new dom.Event('click',{bubbles:true,cancelable:true}));await flush();};
 const input=async(selector,value)=>{const el=one(selector);el.value=value;el.dispatchEvent(new dom.Event('input',{bubbles:true}));await flush();};
 const check=async(el,checked=true)=>{el.checked=checked;el.dispatchEvent(new dom.Event('change',{bubbles:true}));await flush();};
 const submit=async()=>{one('#model-form').dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!one('#save-model').disabled);await flush();};
 const checks=()=>[...document.querySelectorAll('[name=privacy-requirement]')];
 const open=()=>click('#settings');
 const configure=async(provider='openai')=>{await open();await input('#model-mode','custom');await input('#model-provider',provider);await input('#model-name','fixture-model');await input('#model-key',fixtureKey);};
 return {document,sandbox,state,one,click,input,check,checks,submit,open,configure,run:code=>vm.runInContext(code,sandbox)};
}
test('new custom account shows concrete processing checks unchecked, preserving provider choices',async()=>{
 const f=await harness();await f.configure();assert.equal(f.one('#model-provider').options.length,9);assert.equal(f.checks().length,1);assert.equal(Boolean(f.checks()[0].checked),false);assert.match(f.one('#provider-privacy-summary').textContent,/not zero retention/);assert.match(f.checks()[0].parentElement.textContent,/sharing API inputs/);assert.equal(f.state.requests.length,0);
 await f.submit();assert.equal(f.state.local[prefsKey].privacy,undefined);assert.equal((await f.run('BeforewordAnalysisModel.getStatus()')).configured,false);assert.match(f.one('#settings-status').textContent,/Review the processing/);
});
test('reviewed checks can be saved, then a manually requested analysis reaches the provider',async()=>{
 const f=await harness();await f.configure();for(const item of f.checks())await f.check(item);await f.submit();assert.equal((await f.run('BeforewordAnalysisModel.getStatus()')).configured,true);assert.equal(f.checks()[0].checked,true);assert.match(f.one('#provider-privacy-status').textContent,/not independently verified/);assert.equal(f.state.requests.length,0);
 await f.click('#close-settings');await f.input('#source','The writing.');await f.click('#analyze');assert.equal(f.state.requests.length,1);assert.equal(f.one('.reading-step strong').textContent,'remains writing');
});
test('old saved key cannot silently send; explicit analysis opens the review without sending text',async()=>{
 const saved={mode:'custom',provider:'openai',protocol:'openai',endpoint:'https://api.openai.com/v1/chat/completions',model:'fixture-model'};
 const f=await harness({saved,key:{...saved,apiKey:fixtureKey}});await f.input('#source','The writing.');await f.click('#analyze');assert.equal(f.one('#settings-dialog').open,true);assert.equal(Boolean(f.checks()[0].checked),false);assert.equal(f.state.requests.length,0);assert.match(f.one('#send-notice').textContent,/Review this provider/);
});
test('key, provider, model, remote endpoint and workspace edits clear all draft checks',async()=>{
 const f=await harness();await f.configure();for(const [selector,value]of [['#model-key','replacement-key'],['#model-name','other-model'],['#model-provider','anthropic'],['#model-workspace','wrkspc_changed']]){
   for(const item of f.checks())await f.check(item);await f.input(selector,value);assert.ok(f.checks().every(item=>!item.checked),selector);
 }
 await f.input('#model-provider','compatible');await f.input('#model-protocol','openai');await f.input('#model-endpoint','https://custom.example/v1/chat/completions');await f.input('#model-name','fixture-model');for(const item of f.checks())await f.check(item);await f.input('#model-endpoint','https://second.example/v1/chat/completions');assert.equal(f.checks().length,2);assert.ok(f.checks().every(item=>!item.checked));assert.equal(f.state.requests.length,0);
});
test('model discovery does not check controls or send text and confirmation is not reset by harmless rerenders',async()=>{
 const f=await harness();await f.configure();await f.click('#load-models');assert.equal(f.state.requests.length,1);assert.equal(f.state.requests[0].options.body,undefined);assert.equal(Boolean(f.checks()[0].checked),false);
 await f.check(f.checks()[0]);await f.click('#load-models');assert.equal(f.checks()[0].checked,true);assert.equal(f.state.requests.length,2);assert.ok(f.state.requests.every(item=>item.options.method==='GET'));
});
test('unavailable provider keeps discovery and shows the reason without a generic waiver checkbox',async()=>{
 const f=await harness();await f.configure('deepseek');assert.equal(f.checks().length,0);assert.equal(f.one('#provider-privacy-unavailable').hidden,false);assert.match(f.one('#provider-privacy-unavailable').textContent,/not enabled/);assert.equal(f.one('#load-models').disabled,false);await f.submit();assert.equal((await f.run('BeforewordAnalysisModel.getStatus()')).privacyCode,'PROVIDER_MODE_UNAVAILABLE');assert.equal(f.state.requests.length,0);
});
test('local and remote compatible endpoints have different clear checks; the address is not certified',async()=>{
 const f=await harness({language:'ru'});await f.configure('compatible');await f.input('#model-endpoint','http://localhost:11434/v1/chat/completions');assert.equal(f.checks().length,1);assert.match(f.one('#provider-privacy-summary').textContent,/не доказывает/);assert.match(f.checks()[0].parentElement.textContent,/не передаётся/);await f.input('#model-endpoint','https://custom.example/v1/chat/completions');assert.equal(f.checks().length,2);assert.match(f.one('#provider-privacy-summary').textContent,/оператора/);assert.ok(f.checks().every(item=>!item.checked));
});
test('closing unsaved review discards draft checks, and switching language keeps their meaning and state',async()=>{
 const f=await harness();await f.configure();await f.check(f.checks()[0]);await f.click('[data-language="ru"]');assert.equal(f.checks()[0].checked,true);assert.match(f.one('#provider-privacy-summary').textContent,/По умолчанию/);await f.click('#close-settings');await f.open();await f.input('#model-mode','custom');assert.ok(f.checks().every(item=>!item.checked));assert.equal(f.state.requests.length,0);
});

test('toolbar, context-menu capture and legacy inline selection intents only display the exact writing before a separate action',async()=>{
 for(const intent of [false,true]){
  const selection={text:'The writing.',origin:'https://source.example',...(intent?{analysisIntent:{id:'legacy-routing-intent',windowId:1,sourceTabId:2}}:{})};const f=await harness({selection});
  assert.equal(f.one('#record-output').textContent,selection.text);assert.equal(f.one('#record-details').open,true);assert.equal(f.state.requests.length,0);assert.equal(f.one('#analysis-spinner').hasAttribute('hidden'),true);
  await f.configure();for(const item of f.checks())await f.check(item);await f.submit();await f.click('#close-settings');assert.equal(f.state.requests.length,0);await f.click('#analyze');assert.equal(f.state.requests.length,1);assert.equal(f.one('.quote-button').textContent,selection.text);
 }
});
