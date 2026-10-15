'use strict';
(function (root) {
  let active = null;
  function fail(code) { const error = new Error(code); error.code = code; throw error; }
  function available() { const p = root.BeforewordPlatform; return Boolean(p?.identitySupported && p?.getRedirectURL && p?.launchWebAuthFlow && root.crypto?.subtle && root.crypto?.getRandomValues); }
  // For the connection button before optional Chrome permission is granted.
  // authorize() still requires the actual API after the permission request.
  function canConnect() { return available() || Boolean(root.BeforewordPlatform?.identityPermissionRequestable && root.crypto?.subtle && root.crypto?.getRandomValues); }
  function base64url(bytes) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let result = '', buffer = 0, bits = 0;
    for (const byte of bytes) { buffer = (buffer << 8) | byte; bits += 8; while (bits >= 6) { bits -= 6; result += chars[(buffer >>> bits) & 63]; } }
    if (bits) result += chars[(buffer << (6 - bits)) & 63]; return result;
  }
  function random() { return base64url(root.crypto.getRandomValues(new Uint8Array(32))); }
  function cancel() { if (active) { active.controller.abort(); active = null; } }
  function abortable(promise,signal) {
    return new Promise((resolve,reject) => {
      const abort = () => { const error = new Error('ABORTED'); error.code = 'ABORTED'; reject(error); };
      signal.addEventListener('abort',abort,{once:true});
      if (signal.aborted) abort();
      Promise.resolve(promise).then(value => { signal.removeEventListener('abort',abort); resolve(value); },error => { signal.removeEventListener('abort',abort); reject(error); });
    });
  }
  async function authorize() {
    if (!available()) fail('OAUTH_UNAVAILABLE');
    if (active) fail('OAUTH_BUSY');
    const platform = root.BeforewordPlatform;
    let callback; try { callback = new URL(platform.getRedirectURL('beforeword-openrouter')); } catch { fail('OAUTH_UNAVAILABLE'); }
    if (callback.protocol !== 'https:' || callback.username || callback.password || callback.search || callback.hash) fail('OAUTH_UNAVAILABLE');
    const attempt = {state:random(),verifier:random(),controller:new AbortController()}; active = attempt;
    let expired = false;
    const timer = setTimeout(() => { expired = true; attempt.controller.abort(); if (active === attempt) active = null; },600000);
    const assertActive = () => { if (expired) fail('OAUTH_EXPIRED'); if (active !== attempt || attempt.controller.signal.aborted) fail('ABORTED'); };
    try {
      const allowed = await platform.api.permissions.contains({origins:['https://openrouter.ai/*'],permissions:['identity']});
      if (!allowed) fail('PERMISSION_REQUIRED');
      const challenge = base64url(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(attempt.verifier))));
      assertActive();
      const url = new URL('https://openrouter.ai/auth');
      for (const [key,value] of Object.entries({callback_url:callback.href,code_challenge:challenge,code_challenge_method:'S256',state:attempt.state,key_label:'beforeword'})) url.searchParams.set(key,value);
      let returned; try { returned = await abortable(platform.launchWebAuthFlow({url:url.href,interactive:true}),attempt.controller.signal); } catch { assertActive(); fail('OAUTH_CANCELLED'); }
      assertActive();
      let actual; try { actual = new URL(returned); } catch { fail('OAUTH_INVALID'); }
      if (actual.protocol !== callback.protocol || actual.host !== callback.host || actual.pathname !== callback.pathname || actual.username || actual.password || actual.hash) fail('OAUTH_INVALID');
      if (actual.searchParams.get('error')) fail('OAUTH_CANCELLED');
      // OpenRouter documents top-level state echo in OAuth / Optional Parameters:
      // https://openrouter.ai/docs/guides/overview/auth/oauth (reviewed 2026-10-12).
      if (actual.searchParams.getAll('state').length !== 1 || actual.searchParams.get('state') !== attempt.state || actual.searchParams.getAll('code').length !== 1) fail('OAUTH_INVALID');
      const code = actual.searchParams.get('code');
      if (!code || code.length > 2048 || /[\x00-\x20\x7f]/.test(code)) fail('OAUTH_INVALID');
      const response = await root.fetch('https://openrouter.ai/api/v1/auth/keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,code_verifier:attempt.verifier,code_challenge_method:'S256'}),signal:attempt.controller.signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
      assertActive();
      if (!response.ok) { try { await response.body?.cancel(); } catch {} fail(response.status === 403 ? 'OAUTH_EXPIRED' : 'OAUTH_FAILED'); }
      if (!response.body?.getReader) fail('OAUTH_INVALID');
      const reader = response.body.getReader(); const chunks = []; let size = 0, value;
      try {
        while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 4096) fail('OAUTH_INVALID'); chunks.push(part.value); }
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
        try { value = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); } catch { fail('OAUTH_INVALID'); }
      } finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
      assertActive();
      if (typeof value?.key !== 'string' || !/^[\x21-\x7e]{1,512}$/.test(value.key)) fail('OAUTH_INVALID');
      return {apiKey:value.key}; // Trusted analysis adapter consumes this; never sent to a page or rendered.
    } catch (error) {
      if (['OAUTH_CANCELLED','OAUTH_EXPIRED','OAUTH_INVALID','OAUTH_FAILED','ABORTED','PERMISSION_REQUIRED'].includes(error?.code)) throw error;
      if (expired) fail('OAUTH_EXPIRED');
      if (attempt.controller.signal.aborted) fail('ABORTED');
      fail('OAUTH_FAILED');
    } finally { clearTimeout(timer); attempt.verifier = ''; attempt.state = ''; if (active === attempt) active = null; }
  }
  root.BeforewordProviderAuth = Object.freeze({available,canConnect,authorize,cancel});
  if (typeof module === 'object' && module.exports) module.exports = root.BeforewordProviderAuth;
})(globalThis);
