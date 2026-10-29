// Explicit local test host. Never bundled into the production widget.
import { EXAMPLES } from './examples.js';
const frame=document.getElementById('widget');const sources=new Map();let sequence=0;
const context=()=>({theme:document.getElementById('theme').value,locale:document.getElementById('locale').value});
const send=value=>frame.contentWindow.postMessage(value,location.origin);
function result(id,value){send({jsonrpc:'2.0',id,result:value});}
function notify(method,params){send({jsonrpc:'2.0',method,params});}
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!==location.origin)return;const message=event.data;if(!message||message.jsonrpc!=='2.0')return;
  if(message.method==='ui/initialize')return result(message.id,{protocolVersion:'2026-01-26',hostInfo:{name:'beforeword-explicit-local-preview',version:'1.4.1'},hostCapabilities:{serverTools:{},message:{text:{}}},hostContext:context()});
  if(message.method==='ui/notifications/size-changed'){
    const height=message.params?.height;if(Number.isFinite(height)&&height>0)frame.style.height=Math.min(3000,Math.max(300,Math.ceil(height)))+'px';return;
  }
  if(message.method==='tools/call'){
    const args=message.params?.arguments;
    if(message.params?.name!=='submit_source'||typeof args?.source!=='string')return result(message.id,{isError:true,content:[{type:'text',text:'Preview tool rejected.'}]});
    const sourceId=String(++sequence).padStart(43,'P');const state={sourceId,source:args.source,locale:args.locale,report:null,maxChars:12000,expiresAt:new Date(Date.now()+1800000).toISOString()};sources.set(sourceId,state);
    return result(message.id,{content:[],structuredContent:state});
  }
  if(message.method==='ui/message'){
    const mode=document.getElementById('mode').value;result(message.id,mode==='rejected'?{isError:true}:{});if(mode!=='normal')return;
    const text=message.params?.content?.[0]?.text||'';const sourceId=[...sources.keys()].findLast(id=>text.includes(JSON.stringify(id)));const state=sources.get(sourceId);if(!state)return;
    const fixture=EXAMPLES.find(item=>item[state.locale].source===state.source)?.[state.locale];
    const reading=fixture?.reading||(state.locale==='ru'?'**Тестовый ответ интерфейса.** Здесь проверяется только доставка и показ; модель не запускалась.':'**Interface test response.** This checks delivery and display only; no model ran.');
    setTimeout(()=>notify('ui/notifications/tool-result',{content:[],structuredContent:{...state,report:{language:state.locale,items:[{quote:{text:state.source.slice(0,Math.min(1000,state.source.length)),occurrence:0},reading}]}}}),5000);return;
  }
  if(message.method==='ping')return result(message.id,{});
  if(message.id!==undefined)send({jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Unsupported preview method'}});
});
for(const id of ['locale','theme'])document.getElementById(id).addEventListener('change',()=>notify('ui/notifications/host-context-changed',context()));
document.getElementById('reset').addEventListener('click',()=>{sources.clear();frame.src='../dist/app.html?reset='+Date.now();});
