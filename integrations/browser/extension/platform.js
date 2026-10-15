'use strict';

/* Shared browser boundary. No credentials or session content are written to
 * storage.local/storage.sync. WebExtension storage.session is privileged-only
 * by default; where setAccessLevel exists, explicitly keep that boundary.
 * Missing session support falls back to this context's memory only. Explicit
 * rejection of a security access change fails closed, without bypassing it.
 * A panel close or event-page suspension may clear that fallback, by design.
 */
(function (root) {
  if (root.BeforewordPlatform) return;
  let api = root.browser || root.chrome;
  if (!api?.runtime) return;
  let scheme = '';
  try { scheme = new URL(api.runtime.getURL('')).protocol; } catch {}
  const kind = scheme === 'moz-extension:' ? 'firefox' :
    scheme === 'safari-web-extension:' ? 'safari' : 'chromium';
  // Firefox's browser namespace provides the Promise contracts used here.
  // Chromium keeps its original API for older callback-only menu methods.
  api = (kind === 'chromium' ? root.chrome : root.browser) || api;
  if (root.chrome !== api) root.chrome = api;
  const copy = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const values = new Map();
  const memory = {
    async get(keys) {
      const result = {};
      const names = keys == null ? [...values.keys()] : typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      for (const key of names) {
        if (typeof key !== 'string') continue;
        if (values.has(key)) Object.defineProperty(result, key, {value:copy(values.get(key)), enumerable:true, configurable:true, writable:true});
        else if (keys && !Array.isArray(keys) && typeof keys === 'object') Object.defineProperty(result, key, {value:copy(keys[key]), enumerable:true, configurable:true, writable:true});
      }
      return result;
    },
    async set(items) { for (const [key,value] of Object.entries(items || {})) values.set(key,copy(value)); },
    async remove(keys) { for (const key of typeof keys === 'string' ? [keys] : keys) values.delete(key); },
    async clear() { values.clear(); },
  };
  let area = memory, sessionStorageKind = 'memory';
  const localIsolation = (async () => {
    if (typeof api.storage?.local?.setAccessLevel !== 'function') return false;
    try { await api.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}); return true; }
    catch { return false; }
  })();
  const ready = (async () => {
    const native = api.storage?.session;
    if (!native) return true;
    if (!native.get || !native.set || !native.remove) return false;
    try {
      if (typeof native.setAccessLevel === 'function') await native.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
      // Firefox/Safari session storage is trusted-only by default even where
      // their implementation does not expose a setAccessLevel method.
      area = native; sessionStorageKind = 'native';
    } catch { return false; }
    return true;
  })();
  const session = Object.freeze(Object.fromEntries(['get','set','remove','clear'].map(method => [method, async (...args) => {
    if (!await ready) throw new Error('STORAGE_UNAVAILABLE');
    if (typeof area[method] !== 'function') throw new Error('STORAGE_UNAVAILABLE');
    return area[method](...args);
  }])));
  // Optional APIs may appear only after their permission is granted. Do not
  // cache an absent namespace for the lifetime of an already-open panel.
  const identitySupported = () => Boolean(api.identity?.getRedirectURL && api.identity?.launchWebAuthFlow);
  const identityPermissionRequestable = () => {
    if (kind !== 'chromium') return false;
    try { return api.runtime.getManifest().optional_permissions?.includes('identity') === true; }
    catch { return false; }
  };
  root.BeforewordPlatform = Object.freeze({
    api, kind, session, ready, localIsolation,
    localAccessRestricted: localIsolation,
    canPersistNonsecret: Boolean(api.storage?.local?.get && api.storage?.local?.set),
    get sessionStorageKind() { return sessionStorageKind; },
    ensureSessionTrust: () => ready,
    get identitySupported() { return identitySupported(); },
    get identityPermissionRequestable() { return identityPermissionRequestable(); },
    getRedirectURL(path = '') {
      if (!identitySupported()) throw new Error('OAUTH_UNAVAILABLE');
      return api.identity.getRedirectURL(path);
    },
    async launchWebAuthFlow(details) {
      if (!identitySupported()) throw new Error('OAUTH_UNAVAILABLE');
      const result = await api.identity.launchWebAuthFlow(details);
      if (typeof result !== 'string') throw new Error('OAUTH_CANCELLED');
      return result;
    },
  });
})(globalThis);
