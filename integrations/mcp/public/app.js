import { App } from '@modelcontextprotocol/ext-apps';
import { mountBeforeword } from './view.js';

const app = new App({name:'beforeword',version:'1.4.1'},{});
const view = mountBeforeword({document,bridge:{
  submit:arguments_=>app.callServerTool({name:'submit_source',arguments:arguments_},{timeout:15000}),
  message:text=>app.sendMessage({role:'user',content:[{type:'text',text}]},{timeout:15000})
}});
app.ontoolresult = result=>view.receive(result);
app.onhostcontextchanged = context=>view.setContext(context);
app.ontoolcancelled = ()=>view.cancel();
app.onteardown = async()=>{ view.destroy(); return {}; };
const connectionTimeout = setTimeout(()=>view.disconnect(),15000);
try {
  await app.connect();
  clearTimeout(connectionTimeout);
  view.setContext(app.getHostContext());
  view.connect(app.getHostCapabilities());
} catch {
  clearTimeout(connectionTimeout);
  view.disconnect();
}
