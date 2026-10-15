'use strict';
(function (root) {
  const SESSION_KEY = 'beforewordPublicSessionV1', PREFERENCES_KEY = 'beforewordModelPreferencesV1';
  const CUSTOM_KEY = 'beforewordCustomKeyV1', INSTALLATION_PREFIX = 'beforewordInstallationV1:';
  const RESPONSE_LIMIT = 262144, SESSION_RESPONSE_LIMIT = 4096;
  const browserAPI = root.BeforewordPlatform?.api || root.chrome;
  const sessionStorage = root.BeforewordPlatform?.session || browserAPI?.storage?.session;
  const extension = Boolean(browserAPI?.runtime?.id), controllers = new Set(), installations = new Map();
  const defaults = Object.freeze({mode:'service',protocol:'openai',endpoint:'',model:''});
  let memory = null, preferences = {...defaults}, personalKey = null, generation = 0;
  let sessionReadable = true, keyReadable = true, storageQueue = Promise.resolve();
  function fail(code, retryAfter) {
    const error = new Error(code); error.code = code;
    if (retryAfter !== undefined) error.retryAfter = retryAfter;
    throw error;
  }
  function queued(operation) {
    const next = storageQueue.then(operation, operation); storageQueue = next.catch(() => {}); return next;
  }
  function invalidate() { generation += 1; for (const controller of controllers) controller.abort(); }
  function assertActive(signal, current) { if (signal?.aborted || current !== generation) fail('ABORTED'); }
  function exact(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === keys.slice().sort().join(','); }
  function trialValue(value) {
    if (!exact(value,['limit','remaining']) || ![6,8].includes(value.limit) || !Number.isInteger(value.remaining) || value.remaining < 0 || value.remaining > value.limit) fail('INVALID_REPORT');
    return {limit:value.limit,remaining:value.remaining};
  }
  // The server owns the allowance. A six-slot cache must not suppress the
  // new eight-slot balance; late six-slot replies cannot downgrade it.
  function mergeTrial(previous, next) {
    if (!previous) return next;
    if (!next) return previous;
    if (previous.limit !== next.limit) return previous.limit > next.limit ? previous : next;
    return {limit:next.limit,remaining:Math.min(previous.remaining,next.remaining)};
  }
  function configuration() {
    const value = root.BeforewordServiceConfig;
    if (value?.mode === 'preview') return {mode:'preview'};
    if (value?.mode !== 'service' || typeof value.endpoint !== 'string') fail('SERVER_NOT_CONFIGURED');
    let url; try { url = new URL(value.endpoint); } catch { fail('SERVER_NOT_CONFIGURED'); }
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/api/analyze' ||
        !(url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '8787'))) fail('SERVER_NOT_CONFIGURED');
    return {mode:'service',endpoint:url.href,sessionEndpoint:url.origin + '/api/session'};
  }
  function customSettings(value, allowEmptyModel = false) {
    if (!root.BeforewordProviders?.privacyStatus || !root.BeforewordProviders?.request) fail('PRIVACY_REVIEW_REQUIRED');
    return root.BeforewordProviders.settings(value,{allowEmptyModel});
  }
  function permissionOrigins(value) { return root.BeforewordProviders ? root.BeforewordProviders.permissionOrigins(value) : [new URL(customSettings(value).endpoint).origin + '/*']; }
  function permissionOrigin(value) { return permissionOrigins(value)[0]; }
  function validKey(value) { return typeof value === 'string' && value.length >= 1 && value.length <= 512 && /^[\x21-\x7E]+$/.test(value); }
  function keyDestination(settings) { return settings.provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : settings.endpoint; }
  function keyMatches(value, settings) { return value && (value.provider || 'compatible') === (settings.provider || 'compatible') && value.protocol === settings.protocol && keyDestination(value) === keyDestination(settings) && (value.workspace || '') === (settings.workspace || '') && validKey(value.apiKey); }
  async function trustedSession() {
    if (!extension) return false;
    if (root.BeforewordPlatform) return root.BeforewordPlatform.ensureSessionTrust();
    try { await sessionStorage.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}); return true; }
    catch { return false; }
  }
  async function loadPreferences() {
    if (extension) {
      try {
        const saved = (await browserAPI.storage.local.get(PREFERENCES_KEY))?.[PREFERENCES_KEY];
        if (saved?.mode === 'custom') preferences = customSettings(saved,true);
        else if (saved?.mode === 'service') {
          try { preferences = {...customSettings(saved,true),mode:'service'}; }
          catch { preferences = {...defaults}; }
        }
      } catch { fail('STORAGE_UNAVAILABLE'); }
    }
    return {...preferences};
  }
  async function readPersonalKey(settings) {
    if (extension && keyReadable) {
      if (await trustedSession()) {
        try { const saved = (await sessionStorage.get(CUSTOM_KEY))?.[CUSTOM_KEY]; personalKey = keyMatches(saved,settings) ? {...saved} : null; }
        catch { keyReadable = false; }
      } else keyReadable = false;
    }
    return keyMatches(personalKey,settings) ? personalKey.apiKey : null;
  }
  async function disclosedPreferences(value,apiKey) {
    let privacy = {eligible:false,code:'PRIVACY_REVIEW_REQUIRED'};
    if (value.endpoint && root.BeforewordProviders?.privacyStatus) privacy = await root.BeforewordProviders.privacyStatus(value,apiKey);
    return {...value,hasKey:Boolean(apiKey),privacyEligible:privacy.eligible,privacyCode:privacy.code};
  }
  async function getPreferences() {
    await storageQueue; const value = await loadPreferences();
    return disclosedPreferences(value,await readPersonalKey(value));
  }
  async function savePreferences(value,{signal} = {}) {
    if (signal?.aborted) fail('ABORTED');
    if (configuration().mode === 'preview') fail('PREVIEW_ONLY');
    if (!value || !['service','custom'].includes(value.mode)) fail('INVALID_CONFIG');
    // Invalidate immediately; a late reply from the previous destination cannot display.
    invalidate();
    return queued(async () => {
      const previous = await loadPreferences();
      if (signal?.aborted) fail('ABORTED');
      const next = value.mode === 'custom' ? customSettings(value,true) : {...previous,mode:'service'};
      if (next.mode === 'custom') {
        if (!extension) fail('PERMISSION_REQUIRED');
        let granted = false;
        try { granted = await browserAPI.permissions.contains({origins:[permissionOrigin(next)]}); } catch {}
        if (!granted) fail('PERMISSION_REQUIRED');
      }
      const changed = (previous.provider || 'compatible') !== (next.provider || 'compatible') || previous.protocol !== next.protocol || keyDestination(previous) !== keyDestination(next) || (previous.workspace || '') !== (next.workspace || '');
      const supplied = next.mode === 'custom' && Object.hasOwn(value,'apiKey');
      if (supplied && !validKey(value.apiKey)) fail('INVALID_TOKEN');
      const oldKey = changed ? null : await readPersonalKey(previous);
      const apiKey = supplied ? value.apiKey : oldKey;
      // Only explicit UI checks can create a confirmation. Incoming serialized
      // confirmations are never trusted as a new review. Existing confirmations
      // survive only while the exact account/key/model/destination still match.
      delete next.privacy;
      if (next.mode === 'custom' && apiKey) {
        if (Object.hasOwn(value,'privacyAccepted')) {
          const accepted = value.privacyAccepted, profile = root.BeforewordProviders.privacyProfile(next);
          if (!Array.isArray(accepted) || accepted.some(id => typeof id !== 'string')) fail('INVALID_CONFIG');
          if (profile.status === 'available' && accepted.length === profile.requirements.length && new Set(accepted).size === accepted.length && profile.requirements.every(item => accepted.includes(item.id))) {
            next.privacy = await root.BeforewordProviders.privacyConfirmation(next,apiKey,accepted);
          }
        } else if ((await root.BeforewordProviders.privacyStatus(next,apiKey,previous.privacy)).eligible) next.privacy = previous.privacy;
      } else if (next.mode === 'service' && previous.privacy) next.privacy = previous.privacy;
      if (signal?.aborted) fail('ABORTED');
      const bound = apiKey ? {protocol:next.protocol,endpoint:next.endpoint,...(next.provider ? {provider:next.provider} : {}),...(next.workspace ? {workspace:next.workspace} : {}),apiKey} : null;
      // Never report a replacement saved if session storage still has an older
      // same-destination key: reopening the panel must not resurrect that key.
      if (extension && next.mode === 'custom' && (changed || supplied)) {
        personalKey = null; keyReadable = false;
        if (!await trustedSession()) fail('STORAGE_UNAVAILABLE');
        try {
          if (bound) await sessionStorage.set({[CUSTOM_KEY]:bound});
          else await sessionStorage.remove(CUSTOM_KEY);
        } catch { fail('STORAGE_UNAVAILABLE'); }
        keyReadable = true;
      }
      if (signal?.aborted) { personalKey = null; keyReadable = false; try { await sessionStorage.remove(CUSTOM_KEY); } catch {} fail('ABORTED'); }
      if (extension) {
        try { await browserAPI.storage.local.set({[PREFERENCES_KEY]:next}); }
        catch { personalKey = null; fail('STORAGE_UNAVAILABLE'); }
      }
      if (signal?.aborted) { personalKey = null; keyReadable = false; try { await sessionStorage.remove(CUSTOM_KEY); } catch {} fail('ABORTED'); }
      preferences = {...next}; personalKey = bound;
      return disclosedPreferences(next,apiKey);
    });
  }
  async function forgetCustomKey() {
    root.BeforewordProviderAuth?.cancel();
    invalidate(); personalKey = null; keyReadable = false;
    return queued(async () => {
      personalKey = null;
      if (extension) {
        try { await sessionStorage.remove(CUSTOM_KEY); const next = await loadPreferences(); delete next.privacy; await browserAPI.storage.local.set({[PREFERENCES_KEY]:next}); preferences = next; }
        catch { fail('STORAGE_UNAVAILABLE'); }
      }
    });
  }
  function randomInstallationId() {
    if (!root.crypto?.getRandomValues) fail('STORAGE_UNAVAILABLE');
    const bytes = root.crypto.getRandomValues(new Uint8Array(32)), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '', buffer = 0, bits = 0;
    for (const byte of bytes) { buffer = (buffer << 8) | byte; bits += 8; while (bits >= 6) { bits -= 6; result += alphabet[(buffer >>> bits) & 63]; } }
    if (bits) result += alphabet[(buffer << (6 - bits)) & 63];
    return result;
  }
  function validInstallation(value) { return value && typeof value.installationId === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.installationId); }
  function installationLock(endpoint, operation) {
    const key = INSTALLATION_PREFIX + encodeURIComponent(endpoint);
    if (root.navigator?.locks?.request) return root.navigator.locks.request(key,operation);
    return queued(operation);
  }
  async function readInstallation(endpoint, create) {
    const key = INSTALLATION_PREFIX + encodeURIComponent(endpoint);
    let value = installations.get(endpoint) || null;
    if (extension) {
      try { value = (await browserAPI.storage.local.get(key))?.[key] || value; }
      catch { if (create) fail('STORAGE_UNAVAILABLE'); }
    } else if (root.localStorage) {
      try { value = JSON.parse(root.localStorage.getItem(key)) || value; }
      catch { if (create) fail('STORAGE_UNAVAILABLE'); }
    }
    if (!validInstallation(value)) {
      if (!create) return null;
      value = {installationId:randomInstallationId(),trial:null};
      try {
        if (extension) await browserAPI.storage.local.set({[key]:value});
        else if (root.localStorage) root.localStorage.setItem(key,JSON.stringify(value));
      } catch { fail('STORAGE_UNAVAILABLE'); }
    }
    let trial = null; try { trial = trialValue(value.trial); } catch {}
    // Preserve a lower in-memory allowance if an optional earlier cache write failed.
    const known = installations.get(endpoint);
    if (known?.installationId === value.installationId && known.trial) trial = mergeTrial(trial,known.trial);
    const result = {installationId:value.installationId,trial}; installations.set(endpoint,result); return result;
  }
  async function installation(endpoint, create) { return installationLock(endpoint,() => readInstallation(endpoint,create)); }
  async function rememberTrial(endpoint, value, signal, current) {
    const next = trialValue(value); assertActive(signal,current);
    // Keep read + minimum + write under the same cross-panel lock. An older
    // response must never raise the displayed balance after a newer response.
    return installationLock(endpoint,async () => {
      const saved = await readInstallation(endpoint,false); assertActive(signal,current);
      if (!saved) fail('INVALID_REPORT');
      const trial = mergeTrial(saved.trial,next);
      const item = {...saved,trial}; installations.set(endpoint,item);
      const key = INSTALLATION_PREFIX + encodeURIComponent(endpoint);
      // The server remains authoritative if this optional display cache cannot persist.
      try {
        if (extension) await browserAPI.storage.local.set({[key]:item});
        else if (root.localStorage) root.localStorage.setItem(key,JSON.stringify(item));
      } catch {}
      assertActive(signal,current); return trial;
    });
  }
  function validSession(value, endpoint) {
    return Boolean(value && typeof value === 'object' && value.endpoint === endpoint &&
      typeof value.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.token) &&
      Number.isSafeInteger(value.expiresAt) && value.expiresAt > Date.now() + 30000 && value.expiresAt <= Date.now() + 172800000);
  }
  async function readSession(endpoint, signal, current) {
    await storageQueue; assertActive(signal,current);
    if (validSession(memory,endpoint)) return {...memory};
    if (extension && sessionReadable) {
      try { const saved = await sessionStorage.get(SESSION_KEY); assertActive(signal,current); if (validSession(saved?.[SESSION_KEY],endpoint)) memory = {...saved[SESSION_KEY]}; }
      catch (error) { if (error?.code === 'ABORTED') throw error; sessionReadable = false; }
    }
    assertActive(signal,current); return validSession(memory,endpoint) ? {...memory} : null;
  }
  async function rememberSession(value, signal, current) {
    assertActive(signal,current); memory = {...value};
    if (extension) await queued(async () => {
      assertActive(signal,current);
      try { await sessionStorage.set({[SESSION_KEY]:value}); sessionReadable = true; }
      catch { sessionReadable = false; }
      assertActive(signal,current);
    });
  }
  async function removePublicSession() {
    memory = null; sessionReadable = false;
    if (extension) await queued(async () => { try { await sessionStorage.remove(SESSION_KEY); } catch { fail('STORAGE_UNAVAILABLE'); } });
  }
  async function clearSession() { invalidate(); await removePublicSession(); }
  async function getStatus() {
    let config; try { config = configuration(); } catch { config = {mode:'service'}; }
    if (config.mode === 'preview') return {configured:false,mode:'preview',trial:null,hasKey:false};
    let value; try { value = await getPreferences(); } catch { return {configured:false,mode:'service',trial:null,hasKey:false}; }
    let trial = null; if (config.endpoint) { const saved = await installation(config.endpoint,false); trial = saved?.trial || null; }
    if (value.mode === 'custom') {
      let granted = false;
      try { granted = extension && await browserAPI.permissions.contains({origins:[permissionOrigin(value)]}); } catch {}
      return {configured:Boolean(value.hasKey && granted && value.model && value.privacyEligible),mode:'custom',hasKey:value.hasKey,privacyEligible:value.privacyEligible,privacyCode:value.privacyCode,trial};
    }
    return {configured:Boolean(config.endpoint),mode:'service',hasKey:value.hasKey,trial};
  }
  async function boundedJSON(response, limit = RESPONSE_LIMIT) {
    if (!response.body?.getReader) fail('INVALID_REPORT');
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) fail('RESPONSE_TOO_LARGE'); chunks.push(value); }
      const joined = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { joined.set(chunk,offset); offset += chunk.byteLength; }
      try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined)); } catch { fail('INVALID_REPORT'); }
    } finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
  }
  const ERROR_CODES = Object.freeze({
    INVALID_SESSION:'SESSION_EXPIRED',SESSION_EXPIRED:'SESSION_EXPIRED',UNAUTHORIZED:'AUTH',ORIGIN_NOT_ALLOWED:'AUTH',TRIAL_EXHAUSTED:'TRIAL_EXHAUSTED',
    SERVICE_NOT_CONFIGURED:'SERVER_NOT_CONFIGURED',STORE_UNAVAILABLE:'UNAVAILABLE',SERVICE_BUSY:'SERVICE_BUSY',
    SESSION_LIMIT:'SESSION_LIMIT',NETWORK_LIMIT:'NETWORK_LIMIT',SESSION_ISSUANCE_LIMIT:'SESSION_ISSUANCE_LIMIT',
    DAILY_LIMIT:'DAILY_LIMIT',MONTHLY_LIMIT:'MONTHLY_LIMIT',RATE_LIMITED:'RATE_LIMIT',UPSTREAM_RATE_LIMITED:'RATE_LIMIT',
    UPSTREAM_TIMEOUT:'TIMEOUT',UPSTREAM_AUTH:'PROVIDER_AUTH',UPSTREAM_UNAVAILABLE:'PROVIDER_ERROR',
    UPSTREAM_INVALID_RESPONSE:'INVALID_REPORT',UPSTREAM_RESPONSE_TOO_LARGE:'RESPONSE_TOO_LARGE',MODEL_OUTPUT_INCOMPLETE:'RESPONSE_INCOMPLETE',
    INVALID_CITATION:'INVALID_CITATION',REPORT_TOO_LARGE:'RESPONSE_TOO_LARGE',RESPONSE_TOO_LARGE:'RESPONSE_TOO_LARGE',RESPONSE_INCOMPLETE:'RESPONSE_INCOMPLETE',
    MODEL_REFUSAL:'MODEL_REFUSAL',INVALID_REPORT:'INVALID_REPORT',INPUT_TOO_LONG:'INPUT_TOO_LONG',EMPTY_INPUT:'EMPTY_INPUT'
  });
  async function responseError(response, endpoint, signal, current) {
    let data; try { data = await boundedJSON(response,SESSION_RESPONSE_LIMIT); } catch {}
    const rawCode = data?.error?.code;
    const fallback = response.status === 401 || response.status === 403 ? 'AUTH' : response.status === 429 ? 'RATE_LIMIT' : 'UNAVAILABLE';
    const code = Object.hasOwn(ERROR_CODES,rawCode || '') ? ERROR_CODES[rawCode] : fallback;
    if (code === 'TRIAL_EXHAUSTED') {
      const trial = trialValue(data?.trial); if (trial.remaining !== 0) fail('INVALID_REPORT');
      await rememberTrial(endpoint,trial,signal,current);
    }
    const rawRetry = response.headers?.get('retry-after');
    const retryAfter = typeof rawRetry === 'string' && /^\d{1,7}$/.test(rawRetry) && Number(rawRetry) <= 2678400 ? Number(rawRetry) : undefined;
    return {code,retryAfter};
  }
  function options(signal, body, headers = {}) {
    return {method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal,
      credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'};
  }
  async function createSession(config, signal, current) {
    const saved = await installation(config.endpoint,true); assertActive(signal,current);
    const response = await fetch(config.sessionEndpoint,options(signal,{installationId:saved.installationId,trialVersion:2}));
    if (!response.ok) { const error = await responseError(response,config.endpoint,signal,current); fail(error.code,error.retryAfter); }
    const value = await boundedJSON(response,SESSION_RESPONSE_LIMIT); assertActive(signal,current);
    if (!exact(value,['expiresAt','token','trial'])) fail('INVALID_REPORT');
    const session = {token:value.token,expiresAt:value.expiresAt,endpoint:config.endpoint};
    if (!validSession(session,config.endpoint)) fail('INVALID_REPORT');
    await rememberTrial(config.endpoint,value.trial,signal,current); await rememberSession(session,signal,current); return session;
  }
  async function serviceAnalysis(config, input, signal, current) {
    let session = await readSession(config.endpoint,signal,current);
    if (!session) session = await createSession(config,signal,current);
    assertActive(signal,current);
    const response = await fetch(config.endpoint,options(signal,{...input,reportVersion:root.BeforewordAnalysisCore.REPORT_VERSION,trialVersion:2},{Authorization:'Bearer ' + session.token}));
    if (!response.ok) {
      const error = await responseError(response,config.endpoint,signal,current); assertActive(signal,current);
      if (error.code === 'SESSION_EXPIRED') await removePublicSession();
      fail(error.code,error.retryAfter);
    }
    const value = await boundedJSON(response); assertActive(signal,current);
    if (!exact(value,['model','report','trial']) || typeof value.model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value.model)) fail('INVALID_REPORT');
    const report = checkedReport(value.report,input);
    const trial = await rememberTrial(config.endpoint,value.trial,signal,current);
    return {report,model:value.model,trial};
  }
  function checkedReport(value,input) {
    try { return root.BeforewordAnalysisCore.validateReport(value,input); }
    catch (error) {
      // Only stable categories leave validation. Never forward the provider's
      // text, a malformed quote, or an exception message into the panel.
      fail(error?.code === 'INVALID_CITATION' ? 'INVALID_CITATION' : error?.code === 'REPORT_TOO_LARGE' ? 'RESPONSE_TOO_LARGE' : 'INVALID_REPORT');
    }
  }
  async function providerRequest(settings,input,apiKey,signal) {
    if (!root.BeforewordProviders?.request || !root.BeforewordProviders?.assertPrivacy) fail('PRIVACY_REVIEW_REQUIRED');
    return root.BeforewordProviders.request(settings,input,apiKey,signal);
  }
  function providerText(protocol,value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_REPORT');
    if (protocol === 'openai') {
      const choice = value.choices?.[0];
      if (!Array.isArray(value.choices) || value.choices.length !== 1 || !choice?.message) fail('INVALID_REPORT');
      if (choice.message.refusal || choice.finish_reason === 'content_filter') fail('MODEL_REFUSAL');
      if (choice.finish_reason === 'length') fail('RESPONSE_INCOMPLETE');
      if (choice.finish_reason !== 'stop' || choice.message.role !== 'assistant' || choice.message.tool_calls?.length || typeof choice.message.content !== 'string') fail('INVALID_REPORT');
      return choice.message.content;
    }
    if (protocol === 'anthropic') {
      if (value.stop_reason === 'refusal' || value.stop_details?.type === 'refusal') fail('MODEL_REFUSAL');
      if (value.stop_reason === 'max_tokens') fail('RESPONSE_INCOMPLETE');
      if (value.type !== 'message' || value.role !== 'assistant' || value.stop_reason !== 'end_turn' || !Array.isArray(value.content) || !value.content.length || value.content.length > 128) fail('INVALID_REPORT');
      const texts = [];
      for (const block of value.content) {
        if (!block || typeof block !== 'object' || Array.isArray(block)) fail('INVALID_REPORT');
        if (block.type === 'text' && typeof block.text === 'string') texts.push(block.text);
        else if (block.type === 'thinking' && typeof block.thinking === 'string' && typeof block.signature === 'string') continue;
        else if (block.type === 'redacted_thinking' && typeof block.data === 'string') continue;
        else fail('INVALID_REPORT');
      }
      if (!texts.length) fail('INVALID_REPORT');
      // Only final text enters the exact report validator. Thinking is neither rendered nor persisted.
      return texts.join('');
    }
    if (value.promptFeedback?.blockReason) fail('MODEL_REFUSAL');
    const candidate = value.candidates?.[0];
    if (['SAFETY','RECITATION','BLOCKLIST','PROHIBITED_CONTENT','SPII'].includes(candidate?.finishReason)) fail('MODEL_REFUSAL');
    if (candidate?.finishReason === 'MAX_TOKENS') fail('RESPONSE_INCOMPLETE');
    if (!Array.isArray(value.candidates) || value.candidates.length !== 1 || candidate?.finishReason !== 'STOP' || !candidate.content || ![undefined,'model'].includes(candidate.content.role) || !Array.isArray(candidate.content.parts) || !candidate.content.parts.length || candidate.content.parts.length > 128) fail('INVALID_REPORT');
    const texts = [], nonTextData = ['inlineData','functionCall','functionResponse','fileData','executableCode','codeExecutionResult','toolCall','toolResponse'];
    for (const part of candidate.content.parts) {
      if (!part || typeof part !== 'object' || Array.isArray(part) || nonTextData.some(key => Object.hasOwn(part,key)) || (Object.hasOwn(part,'thought') && typeof part.thought !== 'boolean')) fail('INVALID_REPORT');
      if (part.thought === true) {
        if (typeof part.text !== 'string' && typeof part.thoughtSignature !== 'string') fail('INVALID_REPORT');
        continue;
      }
      if (typeof part.text === 'string') texts.push(part.text);
      else if (typeof part.thoughtSignature !== 'string') fail('INVALID_REPORT');
    }
    if (!texts.length) fail('INVALID_REPORT');
    return texts.join('');
  }
  async function customAnalysis(settings,input,signal,current) {
    if (!extension) fail('PERMISSION_REQUIRED');
    let granted = false; try { granted = await browserAPI.permissions.contains({origins:[permissionOrigin(settings)]}); } catch {}
    assertActive(signal,current); if (!granted) fail('PERMISSION_REQUIRED');
    const apiKey = await readPersonalKey(settings); assertActive(signal,current); if (!apiKey) fail('INVALID_TOKEN');
    const request = await providerRequest(settings,input,apiKey,signal); assertActive(signal,current);
    const response = await fetch(settings.endpoint,request); assertActive(signal,current);
    if (!response.ok) {
      try { await response.body?.cancel(); } catch {}
      fail(response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH' : response.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR');
    }
    const value = await boundedJSON(response); assertActive(signal,current);
    return {report:checkedReport(providerText(settings.protocol,value),input),model:settings.model};
  }
  async function analyze({text,language,signal,expectedDestination} = {}) {
    const input = root.BeforewordAnalysisCore.validateInput({text,language}), current = generation;
    assertActive(signal,current); const config = configuration(); if (config.mode === 'preview') fail('PREVIEW_ONLY');
    const controller = new AbortController(); controllers.add(controller); let timedOut = false;
    const abort = () => controller.abort(); signal?.addEventListener('abort',abort,{once:true}); if (signal?.aborted) controller.abort();
    const timer = setTimeout(() => { timedOut = true; controller.abort(); },110000);
    try {
      await storageQueue; assertActive(controller.signal,current);
      const settings = await loadPreferences(); assertActive(controller.signal,current);
      if (settings.mode === 'custom' && !settings.model) fail('INVALID_CONFIG');
      if (expectedDestination !== undefined && (!expectedDestination || expectedDestination.mode !== settings.mode ||
          (settings.mode === 'custom' && ['provider','protocol','endpoint','model','workspace'].some(key => expectedDestination[key] !== settings[key])))) fail('SETTINGS_CHANGED');
      const result = settings.mode === 'custom' ? await customAnalysis(settings,input,controller.signal,current) : await serviceAnalysis(config,input,controller.signal,current);
      assertActive(controller.signal,current); return result;
    } catch (error) {
      if (timedOut) fail('TIMEOUT');
      if (signal?.aborted || current !== generation || error?.name === 'AbortError') fail('ABORTED');
      if (typeof error?.code === 'string' && ['ABORTED','PREVIEW_ONLY','SERVER_NOT_CONFIGURED','INVALID_REPORT','STORAGE_UNAVAILABLE','OFFLINE','UNAVAILABLE','PERMISSION_REQUIRED','INVALID_CONFIG','INVALID_ENDPOINT','INVALID_TOKEN','INSTRUCTIONS_UNAVAILABLE','SETTINGS_CHANGED','PRIVACY_REVIEW_REQUIRED','PROVIDER_MODE_UNAVAILABLE',...Object.values(ERROR_CODES)].includes(error.code)) throw error;
      fail('OFFLINE');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); controllers.delete(controller); }
  }
  if (extension && browserAPI.storage.onChanged?.addListener) browserAPI.storage.onChanged.addListener((changes,area) => {
    if ((area === 'local' && changes[PREFERENCES_KEY]) || (area === 'session' && changes[CUSTOM_KEY])) {
      invalidate(); if (area === 'session') { personalKey = null; keyReadable = true; }
    }
  });
  async function listModels(candidate,{signal} = {}) {
    if (!extension) fail('PERMISSION_REQUIRED');
    if (!root.BeforewordProviders) fail('INVALID_CONFIG');
    const settings = customSettings(candidate,true), current = generation;
    assertActive(signal,current);
    let allowed = false;
    try { allowed = await browserAPI.permissions.contains({origins:permissionOrigins(settings)}); } catch {}
    if (!allowed) fail('PERMISSION_REQUIRED');
    const key = Object.hasOwn(candidate,'apiKey') ? candidate.apiKey : await readPersonalKey(settings);
    if (!validKey(key)) fail('INVALID_TOKEN');
    assertActive(signal,current);
    const controller = new AbortController(); controllers.add(controller); let timedOut = false;
    const abort = () => controller.abort(); signal?.addEventListener('abort',abort,{once:true}); if (signal?.aborted) abort();
    const timer = setTimeout(() => { timedOut = true; controller.abort(); },30000);
    try {
      const models = await root.BeforewordProviders.discover(settings,key,{signal:controller.signal});
      assertActive(controller.signal,current); return models;
    } catch (error) { if (timedOut) fail('TIMEOUT'); throw error; }
    finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); controllers.delete(controller); }
  }
  async function connectOpenRouter({model = '',signal} = {}) {
    if (!extension || !root.BeforewordProviderAuth?.available()) fail('OAUTH_UNAVAILABLE');
    if (signal?.aborted) fail('ABORTED');
    if (configuration().mode === 'preview') fail('PREVIEW_ONLY');
    const settings = customSettings({provider:'openrouter',model},true), current = generation;
    const abort = () => root.BeforewordProviderAuth.cancel();
    signal?.addEventListener('abort',abort,{once:true});
    try {
      const credential = await root.BeforewordProviderAuth.authorize();
      assertActive(signal,current);
      return await savePreferences({...settings,apiKey:credential.apiKey,privacyAccepted:[]},{signal});
    } finally { signal?.removeEventListener('abort',abort); }
  }
  root.BeforewordAnalysisModel = Object.freeze({getStatus,getPreferences,savePreferences,forgetCustomKey,permissionOrigin,permissionOrigins,clearSession,analyze,listModels,connectOpenRouter});
  if (typeof module === 'object' && module.exports) module.exports = root.BeforewordAnalysisModel;
})(globalThis);
