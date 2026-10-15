'use strict';
// Policy/request fixtures only. No provider account, real credential or network is used.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../extension/providers.js'),'utf8');
const key='fixture-provider-key-not-real';
const passed=[];
function fixture(){
  const state={built:0,requests:[]};
  const context=vm.createContext({URL,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,
    BeforewordAnalysisCore:{schema:{type:'object',properties:{reading:{type:'string',maxLength:100}}},buildRequest(input){state.built++;return {system:'Authored instruction.',user:input.text};}},
    fetch:async(url,options)=>{state.requests.push({url,options});return new Response(JSON.stringify({data:[{id:'fixture-model'}]}),{headers:{'Content-Type':'application/json'}});}
  });
  vm.runInContext(source,context);
  return {p:context.BeforewordProviders,state,context};
}
const normalize=value=>JSON.parse(JSON.stringify(value));
const config=(provider='openai',extra={})=>({provider,model:provider==='mistral'?'mistral-small-2603':'fixture-model',...extra});
const code=expected=>error=>{assert.equal(error.code,expected);assert.equal(error.message,expected);return true;};
async function confirm(p,value,credential=key){const selected=p.settings(value),profile=p.privacyProfile(selected);return {...selected,privacy:await p.privacyConfirmation(selected,credential,profile.requirements.map(item=>item.id))};}
async function test(name,fn){await fn();passed.push(name);}
(async()=>{
  await test('All nine provider choices remain and every profile is localized',async()=>{
    const {p}=fixture();assert.deepEqual(normalize(p.list().map(item=>item.id)),['openai','anthropic','gemini','xai','openrouter','deepseek','mistral','groq','compatible']);
    for(const item of p.list())for(const lang of ['ru','en']){
      const value=item.id==='compatible'?config('compatible',{protocol:'openai',endpoint:'https://models.example/v1/chat/completions'}):config(item.id);
      const profile=p.privacyProfile(value,lang);assert.ok(profile.summary);assert.equal(profile.accountVerified,false);assert.ok(profile.links.every(link=>new URL(link.url).protocol==='https:'));
    }
  });
  await test('Legacy configurations and unknown confirmations stop before reading material',async()=>{
    const {p,state}=fixture();for(const privacy of [undefined,true,{accepted:true},{version:'old',fingerprint:'a'.repeat(64)}])await assert.rejects(p.request({...p.settings(config()),privacy},{text:'private fixture'},key),code('PRIVACY_REVIEW_REQUIRED'));
    assert.equal(state.built,0);assert.equal(state.requests.length,0);
  });
  await test('Confirmation requires exactly the named checklist items',async()=>{
    const {p}=fixture(),value=config('gemini');const ids=p.privacyProfile(value).requirements.map(item=>item.id);
    for(const accepted of [true,[],ids.slice(1),[...ids,ids[0]],[...ids,'invented'],{}])await assert.rejects(p.privacyConfirmation(value,key,accepted),code('PRIVACY_REVIEW_REQUIRED'));
    const saved=await p.privacyConfirmation(value,key,ids);assert.equal(saved.version,p.privacyProfile(value).version);assert.equal(saved.profileId,'gemini');assert.match(saved.fingerprint,/^[a-f0-9]{64}$/);
  });
  await test('Saved proof contains no key and never claims account verification',async()=>{
    const {p}=fixture(),saved=await confirm(p,config());assert.ok(!JSON.stringify(saved).includes(key));
    const status=await p.privacyStatus(saved,key);assert.equal(status.eligible,true);assert.equal(status.accountVerified,false);assert.equal(status.profile.accountVerified,false);
    assert.deepEqual(normalize(p.settings({...saved,privacy:{...saved.privacy,apiKey:key,verified:true}}).privacy),normalize(saved.privacy));
  });
  await test('Key, provider, exact address, model and workspace changes invalidate the proof',async()=>{
    const {p}=fixture();const value=config('compatible',{protocol:'openai',endpoint:'https://models.example/v1/chat/completions'}),saved=await confirm(p,value);
    for(const next of [{...saved,endpoint:'https://other.example/v1/chat/completions'},{...saved,endpoint:'https://models.example/other/chat/completions'},{...saved,model:'other-model'},{...saved,protocol:'anthropic',endpoint:'https://models.example/v1/messages'}])assert.equal((await p.privacyStatus(next,key)).eligible,false);
    assert.equal((await p.privacyStatus(saved,key+'-changed')).eligible,false);
    const official=await confirm(p,config());assert.equal((await p.privacyStatus({...official,provider:'compatible'},key)).eligible,false);
    const anthropic=await confirm(p,config('anthropic',{workspace:'wrkspc_first'}));assert.equal((await p.privacyStatus({...anthropic,workspace:'wrkspc_second'},key)).eligible,false);
  });
  await test('Gemini model endpoint changes also revoke previous confirmation',async()=>{
    const {p}=fixture(),saved=await confirm(p,config('gemini'));assert.equal((await p.privacyStatus({...saved,model:'other-model'},key)).eligible,false);
  });
  await test('Malformed and outdated proof data cannot authorize transmission',async()=>{
    const {p,state}=fixture(),saved=await confirm(p,config());
    for(const mutate of [value=>value.version='old',value=>value.profileId='gemini',value=>value.fingerprint='f'.repeat(64),value=>value.confirmedAt=0,value=>value.accepted=[],value=>value.accepted=['sharing-disabled','sharing-disabled']]){
      const privacy=normalize(saved.privacy);mutate(privacy);await assert.rejects(p.request({...saved,privacy},{text:'private fixture'},key),code('PRIVACY_REVIEW_REQUIRED'));
    }
    assert.equal(state.built,0);
  });
  await test('OpenAI request always sets store false with privacy-safe transport defaults',async()=>{
    const {p}=fixture(),saved=await confirm(p,config());const request=await p.request({...saved,store:true},{text:'fixture text'},key);const body=JSON.parse(request.body);
    assert.equal(body.store,false);assert.equal(body.max_completion_tokens,8192);assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');assert.equal(request.cache,'no-store');assert.equal(request.referrerPolicy,'no-referrer');assert.equal(request.headers.Authorization,'Bearer '+key);
  });
  await test('OpenRouter routing constraints cannot be weakened by caller settings',async()=>{
    const {p}=fixture(),saved=await confirm(p,config('openrouter'));const request=await p.request({...saved,providerOptions:{zdr:false,data_collection:'allow'}},{text:'fixture'},key);
    assert.deepEqual(JSON.parse(request.body).provider,{require_parameters:true,data_collection:'deny',zdr:true});
  });
  await test('Compatible aliases for known providers keep official policy and routing restrictions',async()=>{
    const {p}=fixture();const openrouter=config('compatible',{protocol:'openai',endpoint:'https://openrouter.ai/api/v1/chat/completions'});
    assert.equal(p.privacyProfile(openrouter).id,'openrouter');const saved=await confirm(p,openrouter);assert.equal(JSON.parse((await p.request(saved,{text:'fixture'},key)).body).provider.zdr,true);
    for(const endpoint of ['https://api.deepseek.com/chat/completions','https://api.deepseek.com/v1/chat/completions'])assert.equal(p.privacyProfile(config('compatible',{protocol:'openai',endpoint})).status,'unavailable');
    assert.equal(p.privacyProfile(config('compatible',{protocol:'openai',endpoint:'https://api.mistral.ai/v1/chat/completions',model:'mistral-large-4'})).status,'unavailable');
    assert.equal(p.privacyProfile(config('compatible',{protocol:'openai',endpoint:'https://api.openai.com.evil.example/v1/chat/completions'})).id,'compatible-remote');
  });
  await test('DeepSeek stays discoverable but cannot be activated by a generic attestation',async()=>{
    const {p,state}=fixture(),value=config('deepseek');assert.equal(p.privacyProfile(value).status,'unavailable');
    await assert.rejects(p.privacyConfirmation(value,key,[]),code('PROVIDER_MODE_UNAVAILABLE'));await assert.rejects(p.request(p.settings(value),{text:'private fixture'},key),code('PROVIDER_MODE_UNAVAILABLE'));
    const models=await p.discover(value,key);assert.equal(models.length,1);assert.equal(state.built,0);assert.equal(state.requests.length,1);assert.equal(state.requests[0].options.body,undefined);
  });
  await test('Mistral allows only the reviewed GA IDs, including manual IDs',async()=>{
    const {p}=fixture();for(const model of ['mistral-small-2603','mistral-medium-3-5','mistral-large-2512']){
      const saved=await confirm(p,config('mistral',{model}));assert.equal(JSON.parse((await p.request(saved,{text:'fixture'},key)).body).model,model);
    }
    for(const model of ['mistral-large-4','mistral-small-latest','labs-model','mistral-preview','unreviewed-ga','']){
      const value=config('mistral',{model});assert.equal(p.privacyProfile(value).status,'unavailable');await assert.rejects(p.privacyConfirmation(value,key,['improvement-disabled']),code('PROVIDER_MODE_UNAVAILABLE'));
    }
  });
  await test('Standard provider modes do not fabricate unsupported store or ZDR parameters',async()=>{
    const {p}=fixture();for(const provider of ['anthropic','gemini','xai','mistral','groq']){
      const saved=await confirm(p,config(provider)),body=JSON.parse((await p.request(saved,{text:'fixture'},key)).body);assert.equal(body.store,undefined);assert.equal(body.zdr,undefined);assert.equal(body.zero_data_retention,undefined);
    }
  });
  await test('Local compatible mode requires local processing, not merely a loopback URL',async()=>{
    const {p}=fixture(),local=config('compatible',{protocol:'openai',endpoint:'http://127.0.0.1:11434/v1/chat/completions'});assert.equal(p.privacyProfile(local).id,'compatible-local');
    await assert.rejects(p.privacyConfirmation(local,key,[]),code('PRIVACY_REVIEW_REQUIRED'));const saved=await confirm(p,local);assert.equal((await p.privacyStatus(saved,key)).eligible,true);
    const remote={...local,endpoint:'https://models.example/v1/chat/completions',privacy:saved.privacy};assert.equal(p.privacyProfile(remote).id,'compatible-remote');assert.equal((await p.privacyStatus(remote,key)).eligible,false);
  });
  await test('Schema never embeds the selected material and stateless modes add no storage features',async()=>{
    const {p}=fixture();for(const provider of ['openai','anthropic','gemini','xai','openrouter','mistral','groq']){
      const saved=await confirm(p,config(provider)),body=JSON.parse((await p.request(saved,{text:'PRIVATE_SELECTED_FIXTURE'},key)).body);
      const schema=body.response_format?.json_schema?.schema||body.output_config?.format?.schema||body.generationConfig?.responseJsonSchema;if(schema)assert.ok(!JSON.stringify(schema).includes('PRIVATE_SELECTED_FIXTURE'));
      for(const feature of ['tools','cachedContent','cached_content','previous_response_id','files','conversation'])assert.equal(body[feature],undefined);
    }
  });
  await test('Discovery works before attestation and never sends analysis material',async()=>{
    const {p,state}=fixture();const models=await p.discover(config(),key);assert.equal(models[0].id,'fixture-model');assert.equal(state.built,0);assert.equal(state.requests.length,1);assert.equal(state.requests[0].options.method,'GET');assert.equal(state.requests[0].options.body,undefined);
  });
  await test('Aborted requests and invalid models remain rejected before analysis construction',async()=>{
    const {p,state}=fixture(),saved=await confirm(p,config());await assert.rejects(p.request(saved,{text:'private fixture'},key,{aborted:true}),code('ABORTED'));
    for(const model of ['bad model','x\n','../model','x?key=y'])assert.throws(()=>p.settings(config('gemini',{model})),error=>['INVALID_CONFIG','INVALID_ENDPOINT'].includes(error.code));assert.equal(state.built,0);
  });
  console.log(JSON.stringify({suite:'provider-privacy',passed:passed.length,tests:passed,limitations:'Mocked policy, binding and request tests; no provider-account or Chrome transport verification.'},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
