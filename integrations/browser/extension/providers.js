'use strict';
(function (root) {
  const definitions = [
    ['openai','OpenAI','openai','https://api.openai.com/v1/chat/completions','https://api.openai.com/v1/models','https://platform.openai.com/api-keys'],
    ['anthropic','Claude · Anthropic','anthropic','https://api.anthropic.com/v1/messages','https://api.anthropic.com/v1/models','https://platform.claude.com/settings/keys'],
    ['gemini','Gemini · Google','gemini','https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent','https://generativelanguage.googleapis.com/v1beta/models','https://aistudio.google.com/api-keys'],
    ['xai','Grok · xAI','openai','https://api.x.ai/v1/chat/completions','https://api.x.ai/v1/language-models','https://console.x.ai/'],
    ['openrouter','OpenRouter','openai','https://openrouter.ai/api/v1/chat/completions','https://openrouter.ai/api/v1/models','https://openrouter.ai/keys'],
    ['deepseek','DeepSeek','openai','https://api.deepseek.com/chat/completions','https://api.deepseek.com/models','https://platform.deepseek.com/api_keys'],
    ['mistral','Mistral','openai','https://api.mistral.ai/v1/chat/completions','https://api.mistral.ai/v1/models','https://console.mistral.ai/api-keys/'],
    ['groq','Groq','openai','https://api.groq.com/openai/v1/chat/completions','https://api.groq.com/openai/v1/models','https://console.groq.com/keys'],
    ['compatible','Compatible API','openai','','',''],
  ];
  const presets = Object.freeze(definitions.map(([id,label,protocol,endpoint,modelsURL,keyURL]) => Object.freeze({id,label,protocol,endpoint,modelsURL,keyURL,accountLogin:id === 'openrouter'})));
  function fail(code) { const error = new Error(code); error.code = code; throw error; }
  function get(id) { return presets.find(value => value.id === id) || null; }
  function modelID(value, empty = false) { return typeof value === 'string' && ((empty && value === '') || /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value)); }
  function endpointURL(value) {
    if (typeof value !== 'string' || value.length > 2048 || value !== value.trim() || /[\x00-\x20\x7f]/.test(value)) fail('INVALID_ENDPOINT');
    let url; try { url = new URL(value); } catch { fail('INVALID_ENDPOINT'); }
    if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname)))) fail('INVALID_ENDPOINT');
    return url;
  }
  function settings(value, {allowEmptyModel = false} = {}) {
    if (!value || typeof value !== 'object') fail('INVALID_CONFIG');
    const provider = value.provider || 'compatible', preset = get(provider);
    if (!preset || !modelID(value.model,allowEmptyModel)) fail('INVALID_CONFIG');
    const protocol = provider === 'compatible' ? value.protocol : preset.protocol;
    if (!['openai','anthropic','gemini'].includes(protocol)) fail('INVALID_CONFIG');
    const model = value.model;
    if (protocol === 'gemini' && model && !/^[A-Za-z0-9._-]+$/.test(model)) fail('INVALID_ENDPOINT');
    const endpoint = provider === 'compatible' ? value.endpoint : preset.endpoint.replace('{model}',encodeURIComponent(model));
    const url = endpointURL(endpoint);
    if (provider === 'compatible') {
      if (protocol === 'openai' && !url.pathname.endsWith('/chat/completions')) fail('INVALID_ENDPOINT');
      if (protocol === 'anthropic' && !url.pathname.endsWith('/messages')) fail('INVALID_ENDPOINT');
      if (protocol === 'gemini') {
        const match = url.pathname.match(/\/models\/([^/]+):generateContent$/);
        let decoded; try { decoded = match && decodeURIComponent(match[1]); } catch { fail('INVALID_ENDPOINT'); }
        if (!match || (model && decoded !== model)) fail('INVALID_ENDPOINT');
      }
    }
    let workspace;
    if (value.workspace) {
      if (protocol !== 'anthropic' || typeof value.workspace !== 'string' || !/^wrkspc_[A-Za-z0-9]{1,100}$/.test(value.workspace)) fail('INVALID_CONFIG');
      workspace = value.workspace;
    }
    const privacy = savedPrivacy(value.privacy);
    return {mode:'custom',provider,protocol,endpoint:url.href,model,...(workspace ? {workspace} : {}),...(privacy ? {privacy} : {})};
  }
  const PRIVACY_VERSION = '2026-10-15.1';
  // Reviewed GA snapshots, not moving aliases. A new catalog entry needs review.
  const MISTRAL_GA_MODELS = new Set(['mistral-small-2603','mistral-medium-3-5','mistral-large-2512']);
  const officialPrivacyHosts = Object.freeze({'api.openai.com':'openai','api.anthropic.com':'anthropic','generativelanguage.googleapis.com':'gemini','api.x.ai':'xai','openrouter.ai':'openrouter','api.deepseek.com':'deepseek','api.mistral.ai':'mistral','api.groq.com':'groq'});
  function privacyProvider(selected) { return officialPrivacyHosts[new URL(selected.endpoint).hostname] || selected.provider; }
  const words = (en,ru) => ({en,ru});
  const requirement = (id,en,ru) => ({id,label:words(en,ru)});
  const policyLink = (label,url) => ({label,url});
  const privacyProfiles = {
    openai:{
      summary:words('API data is not used for general model training by default. Standard security retention still applies; store:false is not zero retention.','По умолчанию данные API не используются для общего обучения моделей. Сохранение для безопасности остаётся; store:false не означает нулевого хранения.'),
      requirements:[requirement('sharing-disabled','I checked that sharing API inputs and outputs for model improvement is disabled for this project.','Я проверил, что для этого API-проекта отключена передача запросов и ответов для улучшения моделей.')],
      links:[policyLink('OpenAI API data controls','https://developers.openai.com/api/docs/guides/your-data')]
    },
    anthropic:{
      summary:words('The commercial API does not train on content without permission. Standard retention applies; organization, workspace and model settings can differ.','Коммерческий API не обучается на содержимом без разрешения. Действует стандартное хранение; настройки организации, рабочего пространства и модели могут отличаться.'),
      requirements:[requirement('training-not-permitted','This API organization has not permitted general model training on these inputs or outputs.','Эта API-организация не разрешала общее обучение моделей на этих запросах и ответах.')],
      links:[policyLink('Claude API data retention','https://platform.claude.com/docs/en/manage-claude/api-and-data-retention')]
    },
    gemini:{
      summary:words('Use a billing-enabled Gemini API project without contribution of this material to training. Paid processing still includes security retention.','Используйте API-проект Gemini с активным биллингом без передачи этого материала для обучения. Платный режим также предусматривает хранение для безопасности.'),
      requirements:[
        requirement('active-billing','This key belongs to a Cloud project with an active billing account.','Этот ключ относится к Cloud-проекту с активным платёжным аккаунтом.'),
        requirement('no-contribution','I will not contribute this extension’s inputs or outputs through shared datasets or feedback for model improvement.','Я не передаю запросы и ответы расширения в общие наборы данных или отзывы для улучшения моделей.'),
        requirement('eligible-use','I am 18 or older and use Gemini for an eligible professional or business purpose in a supported region.','Мне не меньше 18 лет; я использую Gemini для допустимой профессиональной или деловой задачи в поддерживаемом регионе.')
      ],
      links:[policyLink('Gemini API terms','https://ai.google.dev/gemini-api/terms'),policyLink('Gemini logging and sharing','https://ai.google.dev/gemini-api/docs/logs-policy')]
    },
    xai:{
      summary:words('The API does not use content for general training without permission. Standard audit retention is separate from optional team-level zero retention.','API не использует содержимое для общего обучения без разрешения. Стандартное хранение для проверки нарушений отличается от дополнительного режима нулевого хранения команды.'),
      requirements:[requirement('training-not-permitted','This API team has not permitted general model training on these inputs or outputs.','Эта API-команда не разрешала общее обучение моделей на этих запросах и ответах.')],
      links:[policyLink('xAI API data handling','https://docs.x.ai/developers/faq/security')]
    },
    openrouter:{
      summary:words('Requests require upstream routes that deny data collection and support ZDR. OpenRouter’s own account logging and sharing settings remain separate.','Запросы используют только маршруты без сбора данных с поддержкой ZDR. Собственные настройки журналов и передачи данных OpenRouter проверяются отдельно.'),
      requirements:[
        requirement('prompt-logging-disabled','Prompt and response logging is disabled in my OpenRouter account.','В моём аккаунте OpenRouter отключено сохранение запросов и ответов.'),
        requirement('sharing-disabled','Data-sharing discounts and other model-improvement sharing are disabled for this account.','Для этого аккаунта отключены скидки за передачу данных и другая передача для улучшения моделей.'),
        requirement('broadcast-disabled','Broadcast/export of this extension’s input and output to other services is disabled.','Broadcast и экспорт запросов и ответов расширения в другие сервисы отключены.')
      ],
      links:[policyLink('OpenRouter provider routing','https://openrouter.ai/docs/guides/routing/provider-selection'),policyLink('OpenRouter ZDR','https://openrouter.ai/docs/guides/features/zdr')]
    },
    deepseek:{
      unavailableReason:words('A documented API-wide no-training mode has not been established for this direct provider. Model discovery is available; text analysis is not enabled.','Для прямого API не установлен документированный режим без общего обучения на всех запросах. Список моделей доступен; отправка текста для разбора пока отключена.'),
      summary:words('Personal-data opt-out alone does not establish an account-wide API processing mode for selected webpage text.','Исключение персональных данных из обучения само по себе не устанавливает режим обработки всех записей, переданных через API.'),requirements:[],
      links:[policyLink('DeepSeek privacy policy','https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html')]
    },
    mistral:{
      summary:words('Use the commercial API with Anonymous improvement data disabled. Experimental, Labs and Preview models have separate terms and are not enabled here.','Используйте коммерческий API с отключённой настройкой Anonymous improvement data. Для Experimental, Labs и Preview действуют отдельные условия; такие модели здесь не включены.'),
      requirements:[requirement('improvement-disabled','I disabled Anonymous improvement data in this account’s Admin → Privacy settings.','Я отключил Anonymous improvement data в настройках Admin → Privacy этого аккаунта.')],
      links:[policyLink('Mistral API training opt-out','https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training'),policyLink('Mistral commercial terms','https://legal.mistral.ai/terms/commercial-terms-of-service/'),policyLink('Small 2603 · GA','https://docs.mistral.ai/models/mistral-small-4-0-26-03'),policyLink('Medium 3.5 · GA','https://docs.mistral.ai/models/mistral-medium-3-5-26-04'),policyLink('Large 2512 · GA','https://docs.mistral.ai/models/mistral-large-3-25-12')]
    },
    groq:{
      summary:words('Groq does not generally train on API content without customer instructions. Retention settings are account-level; this API has no supported store switch.','Groq не использует содержимое API для общего обучения без указания клиента. Настройки хранения относятся к аккаунту; параметр store этим API не поддерживается.'),
      requirements:[requirement('training-not-permitted','This API account has not instructed Groq to use these inputs or outputs for general model training.','Этот API-аккаунт не поручал Groq использовать эти запросы или ответы для общего обучения моделей.')],
      links:[policyLink('Groq data controls','https://console.groq.com/settings/data-controls'),policyLink('Groq data handling','https://console.groq.com/docs/your-data')]
    }
  };
  function savedPrivacy(value) {
    if (!value || typeof value !== 'object' || value.version !== PRIVACY_VERSION || typeof value.profileId !== 'string' || !/^[a-z-]{1,40}$/.test(value.profileId) || !/^[a-f0-9]{64}$/.test(value.fingerprint || '') || !Number.isSafeInteger(value.confirmedAt) || value.confirmedAt <= 0 || !Array.isArray(value.accepted) || value.accepted.length > 12 || new Set(value.accepted).size !== value.accepted.length || value.accepted.some(id => typeof id !== 'string' || !/^[a-z-]{1,60}$/.test(id))) return null;
    return {version:value.version,profileId:value.profileId,fingerprint:value.fingerprint,accepted:[...value.accepted],confirmedAt:value.confirmedAt};
  }
  function privacyProfile(value, language = 'en') {
    const selected = settings(value,{allowEmptyModel:true}), lang = language === 'ru' ? 'ru' : 'en';
    const local = ['localhost','127.0.0.1'].includes(new URL(selected.endpoint).hostname);
    const provider = privacyProvider(selected);
    let profile = privacyProfiles[provider], id = provider;
    if (provider === 'compatible') {
      id = local ? 'compatible-local' : 'compatible-remote';
      profile = local ? {
        summary:words('This is a loopback address. The address alone cannot prove that its server keeps processing on this computer.','Это локальный адрес. Сам адрес не доказывает, что его сервер обрабатывает данные только на этом компьютере.'),
        requirements:[requirement('local-only','I operate or have checked this server: it processes this material locally and does not forward it to external providers or general training.','Я управляю этим сервером или проверил его: материал обрабатывается локально и не передаётся внешним поставщикам или для общего обучения.')],links:[]
      } : {
        summary:words('An API-compatible format gives no privacy guarantee. Review the actual server operator and every downstream processor.','Совместимый формат API не гарантирует определённой обработки данных. Проверьте оператора сервера и всех дальнейших обработчиков.'),
        requirements:[
          requirement('processor-policy','I checked that this endpoint and its downstream processors use this material only for the requested feature and related security operations.','Я проверил, что этот адрес и дальнейшие обработчики используют материал только для запрошенной функции и связанных операций безопасности.'),
          requirement('no-general-training','The applicable processor policy excludes general model training and unrelated reuse of these inputs and outputs.','Действующие условия обработчиков исключают общее обучение моделей и постороннее использование этих запросов и ответов.')
        ],links:[]
      };
    }
    let unavailableReason = profile.unavailableReason?.[lang] || '';
    if (provider === 'mistral' && !MISTRAL_GA_MODELS.has(selected.model)) unavailableReason = words('Choose a reviewed GA model: mistral-small-2603, mistral-medium-3-5 or mistral-large-2512. Other IDs, including moving aliases and Preview/Labs models, are not enabled for text analysis.','Выберите проверенную GA-модель: mistral-small-2603, mistral-medium-3-5 или mistral-large-2512. Другие ID, включая меняющиеся псевдонимы и Preview/Labs, пока не включены для отправки текста.')[lang];
    return {version:PRIVACY_VERSION,id,status:unavailableReason ? 'unavailable' : 'available',summary:profile.summary[lang],requirements:profile.requirements.map(item => ({id:item.id,label:item.label[lang]})),links:profile.links.map(item => ({...item})),unavailableReason,accountVerified:false,...(provider === 'mistral' ? {reviewedModelIds:[...MISTRAL_GA_MODELS],catalogReviewedAt:'2026-10-15'} : {})};
  }
  async function privacyFingerprint(value,key) {
    const selected = settings(value,{allowEmptyModel:true});
    if (typeof key !== 'string' || !/^[\x21-\x7e]{1,512}$/.test(key)) fail('INVALID_TOKEN');
    if (!root.crypto?.subtle || !root.TextEncoder) fail('PRIVACY_REVIEW_REQUIRED');
    const scope = JSON.stringify([PRIVACY_VERSION,selected.provider,selected.protocol,selected.endpoint,selected.model,selected.workspace || '',key]);
    const digest = await root.crypto.subtle.digest('SHA-256',new root.TextEncoder().encode(scope));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  }
  function acceptedRequirements(profile,ids) {
    return Array.isArray(ids) && ids.length === profile.requirements.length && new Set(ids).size === ids.length && profile.requirements.every(item => ids.includes(item.id));
  }
  async function privacyConfirmation(value,key,accepted) {
    const profile = privacyProfile(value);
    if (profile.status !== 'available') fail('PROVIDER_MODE_UNAVAILABLE');
    if (!acceptedRequirements(profile,accepted)) fail('PRIVACY_REVIEW_REQUIRED');
    return {version:PRIVACY_VERSION,profileId:profile.id,fingerprint:await privacyFingerprint(value,key),accepted:[...accepted],confirmedAt:Date.now()};
  }
  async function privacyStatus(value,key,confirmation = value?.privacy) {
    const profile = privacyProfile(value), saved = savedPrivacy(confirmation);
    if (profile.status !== 'available') return {eligible:false,code:'PROVIDER_MODE_UNAVAILABLE',profile,accountVerified:false};
    if (!saved || saved.profileId !== profile.id || !acceptedRequirements(profile,saved.accepted) || typeof key !== 'string' || !key) return {eligible:false,code:'PRIVACY_REVIEW_REQUIRED',profile,accountVerified:false};
    const eligible = saved.fingerprint === await privacyFingerprint(value,key);
    return {eligible,code:eligible ? null : 'PRIVACY_REVIEW_REQUIRED',profile,accountVerified:false};
  }
  async function assertPrivacy(value,key,confirmation = value?.privacy) {
    const status = await privacyStatus(value,key,confirmation);
    if (!status.eligible) fail(status.code);
    return status;
  }
  function permissionOrigins(value) {
    const selected = settings(value,{allowEmptyModel:true});
    return [new URL(selected.endpoint).origin + '/*'];
  }
  function discoveryURL(selected) {
    const preset = get(selected.provider);
    if (preset?.modelsURL) return preset.modelsURL;
    const url = endpointURL(selected.endpoint);
    if (selected.protocol === 'openai') url.pathname = url.pathname.replace(/\/chat\/completions$/,'/models');
    else if (selected.protocol === 'anthropic') url.pathname = url.pathname.replace(/\/messages$/,'/models');
    else url.pathname = url.pathname.replace(/\/models\/[^/]+:generateContent$/,'/models');
    return url.href;
  }
  function headers(selected,key) {
    if (selected.protocol === 'anthropic') return {
      'x-api-key':key,'anthropic-version':'2023-06-01',
      // Match Anthropic's browser client for both discovery and Messages.
      // User-entered keys stay in this trusted extension context. Do not add
      // this provider-specific opt-in to unrelated compatible API servers.
      ...(new URL(selected.endpoint).hostname === 'api.anthropic.com' ? {'anthropic-dangerous-direct-browser-access':'true'} : {}),
      ...(selected.workspace ? {'anthropic-workspace-id':selected.workspace} : {}),
    };
    if (selected.protocol === 'gemini') return {'x-goog-api-key':key};
    return {Authorization:'Bearer ' + key};
  }
  // A portable subset of the authored schema; the full local validator remains authoritative.
  function portableSchema(value) {
    if (Array.isArray(value)) return value.map(portableSchema);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !['minimum','maximum','minLength','maxLength','minItems','maxItems'].includes(key)).map(([key,item]) => [key,portableSchema(item)]));
  }
  async function request(selected,input,key,signal) {
    selected = settings(selected);
    if (signal?.aborted) fail('ABORTED');
    await assertPrivacy(selected,key);
    if (signal?.aborted) fail('ABORTED');
    const built = root.BeforewordAnalysisCore.buildRequest(input);
    const schema = portableSchema(root.BeforewordAnalysisCore.schema);
    let body;
    if (selected.protocol === 'anthropic') body = {model:selected.model,max_tokens:8192,system:built.system,messages:[{role:'user',content:built.user}],...(selected.provider === 'anthropic' ? {output_config:{format:{type:'json_schema',schema}}} : {})};
    else if (selected.protocol === 'gemini') body = {systemInstruction:{parts:[{text:built.system}]},contents:[{role:'user',parts:[{text:built.user}]}],generationConfig:{candidateCount:1,maxOutputTokens:8192,responseMimeType:'application/json',...(selected.provider === 'gemini' ? {responseJsonSchema:schema} : {})}};
    else {
      const officialOpenAI = selected.provider === 'openai' || new URL(selected.endpoint).hostname === 'api.openai.com';
      body = {model:selected.model,...(officialOpenAI ? {store:false,max_completion_tokens:8192} : {max_tokens:8192}),messages:[{role:officialOpenAI ? 'developer' : 'system',content:built.system},{role:'user',content:built.user}]};
      if (['openai','xai','openrouter','mistral'].includes(selected.provider)) body.response_format = {type:'json_schema',json_schema:{name:'beforeword_analysis',strict:true,schema}};
      // DeepSeek and Groq vary in schema support. JSON mode plus exact local validation is used without retrying.
      if (['deepseek','groq'].includes(selected.provider)) body.response_format = {type:'json_object'};
      if (privacyProvider(selected) === 'openrouter') body.provider = {require_parameters:true,data_collection:'deny',zdr:true};
    }
    return {method:'POST',headers:{'Content-Type':'application/json',...headers(selected,key)},body:JSON.stringify(body),signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'};
  }
  async function bounded(response) {
    if (!response.body?.getReader) fail('INVALID_MODELS');
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      while (true) { const {value,done} = await reader.read(); if (done) break; size += value.byteLength; if (size > 2097152) fail('INVALID_MODELS'); chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
      try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); } catch { fail('INVALID_MODELS'); }
    } finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
  }
  async function discover(value,key,{signal} = {}) {
    const selected = settings(value,{allowEmptyModel:true});
    if (typeof key !== 'string' || !/^[\x21-\x7e]{1,512}$/.test(key)) fail('INVALID_TOKEN');
    const base = new URL(discoveryURL(selected)); const results = new Map(); let next = base.href, pages = 0;
    try {
      do {
        if (signal?.aborted) fail('ABORTED');
        const response = await root.fetch(next,{method:'GET',headers:headers(selected,key),signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
        if (!response.ok) { try { await response.body?.cancel(); } catch {} fail([401,403].includes(response.status) ? 'PROVIDER_AUTH' : response.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR'); }
        const data = await bounded(response);
        const items = Array.isArray(data) ? data : data.data || data.models;
        if (!Array.isArray(items)) fail('INVALID_MODELS');
        for (const item of items) {
          const id = selected.protocol === 'gemini' ? String(item?.name || '').replace(/^models\//,'') : item?.id;
          if (!modelID(id)) continue;
          if (selected.protocol === 'gemini' && !item.supportedGenerationMethods?.includes('generateContent')) continue;
          if (selected.provider === 'mistral' && item.capabilities?.completion_chat === false) continue;
          if (selected.provider === 'groq' && item.active === false) continue;
          if (selected.provider === 'xai' && item.output_modalities && !item.output_modalities.includes('text')) continue;
          if (selected.provider === 'openrouter' && (!item.supported_parameters?.includes('structured_outputs') || (item.architecture?.output_modalities && !item.architecture.output_modalities.includes('text')))) continue;
          const label = [item.display_name,item.displayName,item.name].find(text => typeof text === 'string' && text.length <= 200 && !/[\x00-\x1f\x7f]/.test(text)) || id;
          results.set(id,{id,label});
        }
        pages += 1; next = null;
        if (selected.protocol === 'gemini' && data.nextPageToken) {
          if (typeof data.nextPageToken !== 'string' || data.nextPageToken.length > 2048) fail('INVALID_MODELS');
          const url = new URL(base); url.searchParams.set('pageToken',data.nextPageToken); next = url.href;
        } else if (selected.protocol === 'anthropic' && data.has_more) {
          if (!modelID(data.last_id)) fail('INVALID_MODELS');
          const url = new URL(base); url.searchParams.set('after_id',data.last_id); next = url.href;
        }
        if (next && pages >= 12) fail('INVALID_MODELS');
      } while (next);
      if (signal?.aborted) fail('ABORTED');
      return [...results.values()].sort((a,b) => a.label.localeCompare(b.label));
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') fail('ABORTED');
      if (['INVALID_MODELS','INVALID_TOKEN','PROVIDER_AUTH','RATE_LIMIT','PROVIDER_ERROR','ABORTED'].includes(error?.code)) throw error;
      fail('OFFLINE');
    }
  }
  root.BeforewordProviders = Object.freeze({list:() => presets.slice(),get,settings,permissionOrigins,discoveryURL,request,discover,modelID,privacyProfile,privacyFingerprint,privacyConfirmation,privacyStatus,assertPrivacy});
  if (typeof module === 'object' && module.exports) module.exports = root.BeforewordProviders;
})(globalThis);
