import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mountBeforeword,validateState,locateQuote,modelMessage } from '../view.js';
import { EXAMPLES,exampleState } from '../examples.js';
const require = createRequire(import.meta.url);
const {parseHTML} = require('linkedom');
const html = readFileSync(new URL('../app.html',import.meta.url),'utf8');
const id = n => String(n).padStart(43,'A');
const state = (source,number=1,locale='en',reading=null)=>({sourceId:id(number),source,locale,report:reading===null?null:{language:locale,items:[{quote:{text:source,occurrence:0},reading}]}});
const deferred = ()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick = async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function setup(bridge={}) {
  const {document,window} = parseHTML(html); const calls=[];let sequence=0;
  const clock={next:0,timers:new Map(),setTimeout(fn,ms){const key=++this.next;this.timers.set(key,{fn,ms});return key;},clearTimeout(key){this.timers.delete(key);},run(ms){for(const [key,item]of [...this.timers])if(item.ms===ms){this.timers.delete(key);item.fn();}}};
  const view=mountBeforeword({document,clock,waitMs:900,operationMs:100,clipboard:{writeText:async text=>calls.push(['copy',text])},bridge:{submit:async args=>{calls.push(['submit',args]);return{structuredContent:state(args.source,++sequence,args.locale)};},message:async text=>{calls.push(['message',text]);return{};},...bridge}});
  const get=id=>document.getElementById(id);
  const input=text=>{get('source').value=text;get('source').dispatchEvent(new window.Event('input'));};
  return{document,window,clock,view,calls,get,input,connect:()=>view.connect({serverTools:{},message:{text:{}}})};
}
test('all twelve authored examples validate exact compact quotes and useful boundaries',()=>{
  assert.equal(EXAMPLES.length,6);
  for(const example of EXAMPLES)for(const locale of ['ru','en']){
    const parsed=validateState(exampleState(example.id,locale),{authored:true});
    assert.equal(parsed.report.items[0].quote.text,parsed.source);
    assert.equal(parsed.report.items[0].quote.start,0);
    assert.equal(parsed.report.items[0].quote.end,parsed.source.length);
  }
  assert.equal(exampleState('arithmetic','ru').report.items[0].reading,'17 × 24 = **408**.');
});
test('literal citation locations handle overlapping repeats and UTF16 without splitting surrogate pairs',()=>{
  assert.equal(locateQuote('aaa',{text:'aa',occurrence:1}).start,1);
  assert.deepEqual(locateQuote('😀 z 😀',{text:'😀',occurrence:1}),{text:'😀',occurrence:1,start:5,end:7});
  assert.throws(()=>locateQuote('😀',{text:'\ud83d',occurrence:0}));
  assert.throws(()=>locateQuote(' x ',{text:'x',occurrence:0,start:0,end:1}));
  assert.throws(()=>locateQuote('a',{text:'a',occurrence:1}));
});
test('no auto send when opening a source or prepared example, locale UI and result language remain distinct',()=>{
  const t=setup();t.connect();t.view.receive(state('  exact\nsource  ',8));
  assert.equal(t.calls.length,0);assert.equal(t.get('exact-source').textContent,'  exact\nsource  ');
  t.get('lang-ru').click();t.view.openExample('trust');assert.equal(t.calls.length,0);
  assert.match(t.get('origin').textContent,/Готовый пример/);
  t.get('lang-en').click();assert.match(t.get('origin').textContent,/Русский/);
  assert.equal(t.get('source-label').textContent,'Writing or a question');
});
test('HTML stays literal in source, quote, bold reading and copied exact markdown',async()=>{
  const t=setup();t.connect();const source='<img src=x onerror=alert(1)> & <script>x</script>';
  t.view.receive(state(source,2,'en','**<svg onload=alert(1)>** is written.'));
  assert.equal(t.get('readings').querySelector('img'),null);assert.equal(t.get('readings').querySelector('svg'),null);assert.equal(t.get('readings').querySelector('script'),null);
  assert.equal(t.get('readings').querySelector('strong').textContent,'<svg onload=alert(1)>');
  t.get('readings').querySelector('.quote').click();assert.equal(t.get('exact-source').textContent,source);assert.equal(t.get('exact-source').querySelector('mark').textContent,source);
  t.get('copy').click();await tick();assert.equal(t.calls.at(-1)[1],source+'\n\n**<svg onload=alert(1)>** is written.');
});
test('explicit submission preserves exact string, receives result and repeats spinner with new capability',async()=>{
  const t=setup();t.connect();t.input('  word\n word  ');await t.view.submit();
  assert.equal(t.calls[0][1].source,'  word\n word  ');assert.equal(t.view.getState().busy,true);assert.equal(t.get('spinner').hasAttribute('hidden'),false);
  t.view.receive(state('  word\n word  ',1,'en','A **reading**.'));assert.equal(t.view.getState().busy,false);assert.equal(t.get('spinner').hasAttribute('hidden'),true);
  await t.view.submit();assert.equal(t.view.getState().activeId,id(2));assert.equal(t.get('spinner').hasAttribute('hidden'),false);
  assert.equal(t.view.receive(state('  word\n word  ',1,'en','Old reply')),false);
  t.view.receive(state('  word\n word  ',2,'en','New reply'));assert.equal(t.get('spinner').hasAttribute('hidden'),true);assert.equal(t.get('readings').textContent.includes('New reply'),true);
});
test('source edits invalidate result without sending; late old result never overwrites draft',()=>{
  const t=setup();t.connect();t.view.receive(state('old',1,'en','Old reading'));t.get('edit-source').click();t.input('new');
  assert.equal(t.get('result').hidden,true);assert.equal(t.calls.length,0);
  assert.equal(t.view.receive(state('old',1,'en','late')),false);assert.equal(t.get('source').value,'new');
});
test('cancel during save leaves no spinner and ignores the later save completion',async()=>{
  const pending=deferred();let messages=0;const t=setup({submit:()=>pending.promise,message:async()=>{messages++;return{};}});t.connect();t.input('x');const work=t.view.submit();t.view.cancel();pending.resolve({structuredContent:state('x')});await work;
  assert.equal(messages,0);assert.equal(t.get('spinner').hasAttribute('hidden'),true);assert.equal(t.view.getState().record,null);assert.equal(t.view.getState().statusKey,'stopped');
});
test('cancel after delivery stops local waiting; retry cannot accept old capability',async()=>{
  const t=setup();t.connect();t.input('x');await t.view.submit();t.view.cancel();assert.equal(t.view.getState().statusKey,'stopped');await t.view.submit();
  assert.equal(t.view.receive(state('x',1,'en','old')),false);assert.equal(t.view.getState().busy,true);t.view.receive(state('x',2,'en','new'));assert.equal(t.view.getState().busy,false);
});
test('language switch while saving cancels pending dispatch without changing old-language result',async()=>{
  const pending=deferred();const t=setup({submit:()=>pending.promise});t.connect();t.input('x');const work=t.view.submit();t.get('lang-ru').click();pending.resolve(state('x'));await work;
  assert.equal(t.view.getState().locale,'ru');assert.equal(t.view.getState().busy,false);assert.equal(t.calls.length,0);
});
test('host rejection, save error and deadlines all clear busy and allow another explicit attempt',async()=>{
  for(const kind of ['message','save','hung']){
    const t=setup(kind==='message'?{message:async()=>({isError:true})}:kind==='save'?{submit:async()=>({isError:true})}:{submit:()=>new Promise(()=>{})});t.connect();t.input('x');const work=t.view.submit();if(kind==='hung'){t.clock.run(100);}await work;
    assert.equal(t.view.getState().busy,false,kind);assert.equal(t.get('spinner').hasAttribute('hidden'),true,kind);assert.equal(t.get('submit').disabled,false,kind);assert.equal(t.view.getState().statusKey,'failed');
  }
  const t=setup();t.connect();t.input('x');await t.view.submit();t.clock.run(900);assert.equal(t.view.getState().statusKey,'timeout');assert.equal(t.get('spinner').hasAttribute('hidden'),true);
});
test('result arriving before message acknowledgment survives later acknowledgment',async()=>{
  const pending=deferred();const t=setup({message:()=>pending.promise});t.connect();t.input('x');const work=t.view.submit();await tick();
  t.view.receive(state('x',1,'en','Immediate'));pending.resolve({});await work;assert.equal(t.view.getState().busy,false);assert.equal([...t.clock.timers.values()].filter(x=>x.ms===900).length,0);
});
test('mismatched source and invalid report cannot appear as a valid answer',async()=>{
  const t=setup();t.connect();t.input('x');await t.view.submit();t.view.receive(state('y',1,'en','Wrong'));assert.equal(t.get('result').hidden,true);assert.equal(t.view.getState().statusKey,'invalid');
  const bad=state('x',2,'en','Wrong');bad.report.items[0].quote.text='not in source';assert.throws(()=>validateState(bad));
});
test('missing host capability blocks sends; connection loss resets busy',async()=>{
  const t=setup();t.view.connect({serverTools:{}});t.input('x');await t.view.submit();assert.equal(t.calls.length,0);assert.equal(t.get('submit').disabled,true);assert.equal(t.view.getState().statusKey,'unsupported');
  t.connect();await t.view.submit();t.view.disconnect();assert.equal(t.get('spinner').hasAttribute('hidden'),true);assert.equal(t.get('submit').disabled,true);
});
test('empty and overlong text stay local; native Enter does not send; modified Enter does',async()=>{
  const t=setup();t.connect();t.input(' \n ');await t.view.submit();assert.equal(t.calls.length,0);t.input('x'.repeat(12001));await t.view.submit();assert.equal(t.calls.length,0);
  t.input('x');const enter=new t.window.Event('keydown',{cancelable:true});Object.defineProperty(enter,'key',{value:'Enter'});t.get('source').dispatchEvent(enter);await tick();assert.equal(t.calls.length,0);
  const modified=new t.window.Event('keydown',{cancelable:true});Object.defineProperties(modified,{key:{value:'Enter'},ctrlKey:{value:true}});t.get('source').dispatchEvent(modified);await tick();assert.equal(t.calls[0][0],'submit');
});
test('request context preserves literal user data and exact capability without a separate provider',()=>{
  const value=state('"\n</script>  ',2,'ru');const request=modelMessage(value);assert.ok(request.endsWith(JSON.stringify(value.source)));assert.ok(request.includes(JSON.stringify(value.sourceId)));assert.match(request,/Preserve practical requests/);
});
test('admitted repeat requests reveal an offscreen action without moving an already visible one',async()=>{
  const t=setup();t.connect();t.input('x');let scrolled=0;
  Object.defineProperty(t.window,'innerHeight',{value:600,configurable:true});
  t.get('submit').getBoundingClientRect=()=>({top:610,bottom:658});t.get('submit').scrollIntoView=()=>{scrolled++;};
  await t.view.submit();assert.equal(scrolled,1);t.view.cancel();
  t.get('submit').getBoundingClientRect=()=>({top:0,bottom:600});await t.view.submit();assert.equal(scrolled,1);assert.equal(t.get('spinner').hasAttribute('hidden'),false);
});
test('expired server capability leaves the source visible and retry creates a fresh revision',async()=>{
  const t=setup();t.connect();t.input('exact');await t.view.submit();
  t.view.receive({isError:true,structuredContent:{error:'SOURCE_NOT_FOUND'}});
  assert.equal(t.view.getState().statusKey,'expired');assert.equal(t.get('exact-source').textContent,'exact');assert.equal(t.get('spinner').hasAttribute('hidden'),true);
  await t.view.submit();assert.equal(t.view.getState().activeId,id(2));assert.equal(t.get('spinner').hasAttribute('hidden'),false);
});
test('RU accessible names, status announcements, quote controls and normal editor labels are present',()=>{
  const t=setup();t.connect();t.get('lang-ru').click();t.view.openExample('names');
  assert.equal(t.document.documentElement.lang,'ru');assert.equal(t.document.querySelector('.languages').getAttribute('aria-label'),'Язык');
  assert.equal(t.get('source-label').getAttribute('for'),'source');assert.equal(t.get('status').getAttribute('aria-live'),'polite');
  assert.equal(t.get('new-source').getAttribute('aria-label'),'Новая запись');assert.equal(t.get('copy').getAttribute('aria-label'),'Скопировать ответ');
  assert.ok(t.get('readings').querySelector('.quote').getAttribute('aria-label').startsWith('Показать эту цитату'));
});
test('SVG spinner changes the actual hidden attribute, independent of a nonreflecting hidden property',async()=>{
  const t=setup();t.connect();Object.defineProperty(t.get('spinner'),'hidden',{value:true,writable:true});
  t.input('x');await t.view.submit();assert.equal(t.get('spinner').hasAttribute('hidden'),false);t.view.cancel();assert.equal(t.get('spinner').hasAttribute('hidden'),true);
  await t.view.submit();assert.equal(t.get('spinner').hasAttribute('hidden'),false);t.view.receive(state('x',2,'en','Done'));assert.equal(t.get('spinner').hasAttribute('hidden'),true);
});
