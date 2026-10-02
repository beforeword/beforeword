#!/usr/bin/env node
'use strict';
// Local JavaScript/DOM simulation only. No visual browser, imports, or live API calls.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {TextDecoder,TextEncoder}=require('node:util');
const input=process.argv[2];
if(!input){console.error('Usage: node scripts/test_guide.cjs /path/to/guide.html');process.exit(2)}
const html=fs.readFileSync(input,'utf8');
const dataMatch=html.match(/<script id="bundle-data" type="application\/json">([\s\S]*?)<\/script>/);
assert(dataMatch,'Embedded package data is missing');
const data=JSON.parse(dataMatch[1]);
const codeMatch=html.match(/<script>([\s\S]*?)<\/script>/);
assert(codeMatch,'Application script is missing');
const code=codeMatch[1];
assert(!/\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon\s*\(|eval\s*\(|new\s+Function\b)/.test(code),'Unexpected network or dynamic execution API');
assert(!/\.innerHTML\s*=/.test(code),'HTML insertion is not allowed in the guide');
assert(!html.includes('__STATIC_FALLBACK__'),'Static fallback placeholder is unresolved');
const noScript=html.match(/<noscript>([\s\S]*?)<\/noscript>/);
assert(noScript&&noScript[1].includes('beforeword'),'Static fallback is missing');
assert(!/<pre\b[^>]*\bid="evaluation-text"/.test(html),'Reader methodology must not be raw Markdown in a pre block');
for(const language of ['ru','en']){
 const body=data[language==='ru'?'evaluationHtmlRu':'evaluationHtml'];
 assert.equal(typeof body,'string','Missing rendered methodology for '+language);
 const article=html.match(new RegExp('<article id="evaluation-'+language+'"[^>]*>([\\s\\S]*?)<\\/article>'));
 assert(article,'Missing semantic methodology article for '+language);
 assert.equal(article[1],body,'Guide must include the complete rendered methodology');
 assert.equal((body.match(/<h4\b/g)||[]).length,4,'Preserve all four methodology sections');
 assert.equal((body.match(/<li>/g)||[]).length,7,'Preserve every method step');
 assert.equal((body.match(/<th scope="col">/g)||[]).length,2,'Comparison needs actual table headers');
 assert.equal((body.match(/<td>/g)||[]).length,6,'Comparison needs all three conditions');
 assert(body.includes('<code>met</code>'),'Ratings must use semantic inline code');
 assert(!/\]\([^\n]+\)|<script\b|\bon\w+\s*=/i.test(body),'Methodology must render links without executable HTML');
 for(const filename of ['eval-cases.jsonl','evaluation-results.json','validation-2026-10-02.json']){
  assert(body.includes('href="https://beforeword.xyz/model/reports/'+filename+'" download="'+filename+'"'),'Offline guide requires an absolute source-file link');
 }
 assert(noScript[1].includes('fallback-evaluation-'+language+'-section-'),'Methodology must be readable without JavaScript');
}
const sourceIds=[...html.slice(0,html.indexOf('<script id="bundle-data"')).matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(sourceIds).size,sourceIds.length,'Rendered reports must not create duplicate IDs');
assert.equal(data.connectors.length,9);
assert(data.api&&Object.keys(data.api).length===7,'Expected seven API registry entries');
for(const language of ['ru','en']){
 assert.equal(typeof data.skill[language],'string','Missing localized skill');
 for(const provider of ['openai','claude','skill'])assert(data.bundles[language][provider]?.data,'Missing localized bundle');
}
function element(){return {textContent:'',value:'',hidden:false,style:{},dataset:{},children:[],attrs:{},listeners:{},classList:{toggle(){},add(){}},setAttribute(name,value){this.attrs[name]=value},append(item){this.children.push(item)},replaceChildren(){this.children=[]},remove(){},click(){},addEventListener(name,handler){this.listeners[name]=handler}}}
const nodes={};
for(const match of html.matchAll(/id="([^"]+)"/g))nodes[match[1]]=element();
for(const item of Object.values(nodes))item.parentElement=element();
nodes['bundle-data'].textContent=JSON.stringify(data);
nodes['api-provider'].value='openai';nodes['api-max-tokens'].value='2048';
// Real textarea.value normalizes line endings; the file-source path must bypass it.
let textareaValue='';Object.defineProperty(nodes['api-input'],'value',{get(){return textareaValue},set(value){textareaValue=String(value).replace(/\r\n?/g,'\n')}});
const buttons=[...html.matchAll(/data-copy="([^"]+)"/g)].map(match=>Object.assign(element(),{dataset:{copy:match[1]}}));
const blobs=[];const downloads=[];
class LocalURL extends URL{static createObjectURL(blob){blobs.push(blob);return 'blob:local/'+blobs.length}static revokeObjectURL(){}}
const document={getElementById:id=>{assert(nodes[id],'Missing DOM ID '+id);return nodes[id]},documentElement:element(),querySelectorAll:()=>buttons,createElement:()=>{const item=element();item.click=()=>downloads.push(item.download);return item},body:element()};
function boot(hash,expectedLanguage){
 const location={_hash:hash,get hash(){return this._hash},set hash(value){this._hash=value.startsWith('#')?value:'#'+value}};
 const window={location,listeners:{},addEventListener(name,handler){this.listeners[name]=handler}};
 const context={document,window,setTimeout:()=>0,clearTimeout(){},Blob,URL:LocalURL,Uint8Array,atob,TextDecoder,console};
 vm.createContext(context);vm.runInContext(code,context,{filename:input});
 assert.equal(document.documentElement.lang,expectedLanguage,'Guide must honor the entry-link language');
 assert.equal(nodes[expectedLanguage+'-btn'].attrs['aria-pressed'],'true');
 assert.equal(nodes.prompt.textContent,data.compact[expectedLanguage],'Entry language must also select the copied instruction');
 assert.equal(document.title,expectedLanguage==='en'?'beforeword — advanced guide':'beforeword — расширенное руководство');
 assert.equal(nodes['guide-home'].href,'https://beforeword.xyz/model/'+(expectedLanguage==='en'?'en/':''),'Guide return link must preserve the entry language');
 assert.equal(nodes['evaluation-ru'].hidden,expectedLanguage!=='ru');
 assert.equal(nodes['evaluation-en'].hidden,expectedLanguage!=='en');
 return context;
}
boot('#en','en');boot('#ru','ru');boot('#unknown','ru');
const context=boot('','ru');
const run=source=>vm.runInContext(source,context);
const parsedPayload=()=>JSON.parse(nodes['api-out'].textContent);
const setProvider=value=>{nodes['api-provider'].value=value;nodes['api-provider'].listeners.change()};
function validInput(){nodes['api-model'].value='test-model';nodes['api-input'].value='e\u0301 ≠ é\n  «Я»\t<script>not executable</script>';nodes['api-history'].value='';nodes['api-max-tokens'].value='2048';nodes['api-endpoint'].value='https://example.invalid/v1/chat/completions'}
async function main(){
 let adapterSelections=0,apiCases=0;
 for(const language of ['ru','en']){
 run(`setLanguage('${language}')`);
  assert.equal(document.documentElement.lang,language);
  assert.equal(context.window.location.hash,'#'+language,'Language selection must produce a reusable URL');
  assert.equal(nodes[language+'-btn'].attrs['aria-pressed'],'true');
  assert.equal(nodes['evaluation-ru'].hidden,language!=='ru','Methodology visibility must follow selected language');
  assert.equal(nodes['evaluation-en'].hidden,language!=='en','Methodology visibility must follow selected language');
  assert(nodes['evaluation-online-note'].textContent.includes(language==='ru'?'подключение':'internet connection'),'Linked source files need a clear connection note');
  assert(nodes['mode-stop-copy'].textContent,'Stop instruction requires its own explanatory label');
  assert.equal(nodes['mode-stop-command'].textContent,language==='ru'?'Отключи режим beforeword для следующих ответов.':'Turn off beforeword mode for subsequent replies.');
  assert(!nodes['mode-command'].textContent.includes(nodes['mode-stop-command'].textContent),'Start example must not include the stop command');
  for(const connector of data.connectors){
   run(`chooseApp('${connector.id}')`);assert.equal(nodes['app-name'].textContent,connector.name);
   for(const mode of ['compact','core']){run(`setMode('${mode}')`);assert.equal(nodes.prompt.textContent,mode==='compact'?data.compact[language]:data.scope[language]+data.core[language]);assert.equal(nodes[mode+'-btn'].attrs['aria-pressed'],'true');adapterSelections++}
  }
  for(const provider of Object.keys(data.api)){
   setProvider(provider);validInput();
   for(const withHistory of [false,true]){
    nodes['api-history'].value=withHistory?'[{"role":"user","content":"old user\\r\\n"},{"role":"assistant","content":"old assistant"}]':'';
    assert(run('makePayload()'),provider);const body=parsedPayload();
    assert.equal(body.model,'test-model');
    const instruction=data.scope[language]+data.core[language];
    if(provider==='gemini'){
     assert.equal(body.system_instruction,instruction);
     if(withHistory){assert.equal(body.input.length,3);assert.equal(body.input[0].type,'user_input');assert.equal(body.input[1].type,'model_output');assert.equal(body.input[2].type,'user_input');assert(!('role' in body.input[0]));assert.equal(body.input[0].content[0].text,'old user\r\n');assert.equal(body.input.at(-1).content[0].text,nodes['api-input'].value)}
     else assert.equal(body.input,nodes['api-input'].value);
    }else{
     const messages=body.messages||body.input;assert.equal(messages.at(-1).content,nodes['api-input'].value);
     if(provider==='openai')assert.equal(body.instructions,instruction);else if(provider==='anthropic'){assert.equal(body.system,instruction);assert.equal(body.max_tokens,2048)}else assert.equal(messages[0].content,instruction);
     if(withHistory){const offset=provider==='openai'||provider==='anthropic'?0:1;assert.equal(messages[offset].content,'old user\r\n');assert.equal(messages[offset+1].content,'old assistant')}
    }
    assert.equal(nodes['api-out'].hidden,false);apiCases++;
   }
   assert(nodes['api-transport'].textContent.includes('POST'));
   assert(nodes['api-curl'].textContent.includes('--data-binary'));
   assert(nodes['api-sources'].children.length>0,'Provider source links missing');
  }
  for(const provider of ['openai','claude','skill']){
   const before=blobs.length;run(`downloadBundle('${provider}')`);assert.equal(blobs.length,before+1);
   const expected=data.bundles[language][provider];assert.equal(downloads.at(-1),expected.name);
   assert.deepEqual(Buffer.from(await blobs.at(-1).arrayBuffer()),Buffer.from(expected.data,'base64'));
  }
  run('downloadSkill()');assert.equal(await blobs.at(-1).text(),data.skill[language]);
 }
 context.window.location.hash='#ru';context.window.listeners.hashchange();
 assert.equal(document.documentElement.lang,'ru','History/hash navigation must restore Russian');
 assert.equal(nodes['guide-home'].href,'https://beforeword.xyz/model/');
 assert.equal(nodes.prompt.textContent,data.scope.ru+data.core.ru);
 context.window.location.hash='#en';context.window.listeners.hashchange();
 assert.equal(document.documentElement.lang,'en','History/hash navigation must restore English');
 assert.equal(nodes['guide-home'].href,'https://beforeword.xyz/model/en/');
 assert.equal(nodes.prompt.textContent,data.scope.en+data.core.en);
 for(const route of ['settings','skill','api']){run(`setRoute('${route}')`);for(const other of ['settings','skill','api']){assert.equal(nodes[other+'-section'].hidden,other!==route);assert.equal(nodes[other+'-route-btn'].attrs['aria-pressed'],String(other===route))}}
 validInput();setProvider('openai');
 for(const field of ['api-model','api-history','api-max-tokens','api-input','api-endpoint']){validInput();assert(run('makePayload()'));nodes[field].listeners.input();assert.equal(nodes['api-out'].hidden,true);assert.equal(nodes['api-out'].textContent,'')}
 validInput();assert(run('makePayload()'));setProvider('anthropic');assert.equal(nodes['api-out'].hidden,true);
 validInput();assert(run('makePayload()'));run("setLanguage('ru')");assert.equal(nodes['api-out'].hidden,true);
 setProvider('openai');validInput();
 for(const history of ['{}','null','[null]','[{"role":"system","content":"x"}]','[{"role":"user","content":2}]','[{"role":"user","content":"x","extra":1}]','[{"role":"assistant"}]']){nodes['api-history'].value=history;assert.equal(run('makePayload()'),null)}
 validInput();setProvider('anthropic');for(const tokens of ['','0','-1','1.2','NaN','9007199254740992']){nodes['api-max-tokens'].value=tokens;assert.equal(run('makePayload()'),null)}nodes['api-max-tokens'].value='4096';assert.equal(run('makePayload()').max_tokens,4096);
 validInput();setProvider('qwen');for(const endpoint of ['','http://example.invalid','https://user:pass@example.invalid','https://example.invalid?key=secret','https://example.invalid#key','not a URL']){nodes['api-endpoint'].value=endpoint;assert.equal(run('makePayload()'),null)}nodes['api-endpoint'].value='https://example.invalid/v1/chat/completions';assert(run('makePayload()'));
 setProvider('openai');validInput();nodes['api-input'].value='';assert(run('makePayload()'),'Empty input should be representable');nodes['api-model'].value='';assert.equal(run('makePayload()'),null);validInput();
 const original='\ufeffé\r\n  e\u0301\r\n';const bytes=new TextEncoder().encode(original);nodes['api-file'].files=[{name:'original.txt',arrayBuffer:async()=>bytes.buffer}];await run('loadInputFile()');assert.notEqual(nodes['api-input'].value,original,'Textarea test must normalize CRLF');assert.equal(run('inputText()'),original);assert.equal(run('makePayload()').input.at(-1).content,original);
 nodes['api-input'].value='edited\r\n';nodes['api-input'].listeners.input();assert.equal(run('inputText()'),'edited\n');assert.equal(nodes['api-out'].hidden,true);
 nodes['api-file'].files=[{name:'invalid.txt',arrayBuffer:async()=>new Uint8Array([0xff]).buffer}];await run('loadInputFile()');assert.equal(run('inputText()'),'edited\n');
 for(const button of buttons)assert(button.textContent&&!button.textContent.includes('undefined'));
 assert(data.developer?.data,'Developer source archive is missing');run('downloadDeveloper()');assert.equal(downloads.at(-1),data.developer.name);assert.deepEqual(Buffer.from(await blobs.at(-1).arrayBuffer()),Buffer.from(data.developer.data,'base64'));
 const report={status:'passed',scope:'simulated DOM and local JavaScript; no visual browser or live providers',adapter_selections:adapterSelections,api_cases:apiCases,languages:['ru','en'],language_entry_cases:['#en','#ru','unknown','default','hash navigation'],methodology:['semantic RU/EN articles','all sections and steps','comparison table','absolute source links','offline and no-JavaScript content','language switching'],routes:3,file_preservation:['BOM','CRLF','Unicode','spacing'],negative_checks:['history','max_tokens','Qwen endpoint','invalid UTF-8'],network_calls:0};
 console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1});
