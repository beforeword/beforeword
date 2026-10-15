'use strict';

if (!globalThis.BeforewordPlatform && typeof importScripts === 'function') importScripts('platform.js');
const platform = globalThis.BeforewordPlatform;
const sessionStorage = platform?.session || chrome.storage.session;

const MAX_SELECTION_CHARS = 12000;
const MENU_ID = 'beforeword-selection';
const LANGUAGES = new Set(['auto', 'ru', 'en']);
const CAPTURE_ERRORS = new Set([
  'NO_SELECTION', 'EDITABLE_SELECTION', 'SELECTION_TOO_LONG',
  'CAPTURE_UNAVAILABLE', 'STORAGE_UNAVAILABLE',
]);
let captureGeneration = 0;
let commitQueue = Promise.resolve();
let siteQueue = Promise.resolve();
const SITE_SCRIPT_PREFIX = 'bw-site-';
const MAX_OPTED_SITES = 64;
const PANEL_CONTEXT_KEY = 'beforeword.panel-contexts.v1';
let panelQueue = Promise.resolve();
let activeAnchorGesture = null;

// Session captures/keys remain privileged. Unsupported local access control is
// handled separately by the model client, without storing local secrets.
const storageIsolationReady = platform ? platform.ensureSessionTrust() : Promise.all([chrome.storage.local, chrome.storage.session].map(async area => {
  try { await area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }); return true; } catch { return false; }
})).then(results => results.every(Boolean));

function sourceOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch { return null; }
}

function validAnchor(value) {
  if (!value || typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/u.test(value.id) ||
      !Number.isInteger(value.sourceTabId) || value.sourceTabId < 0 ||
      !Number.isInteger(value.windowId) || value.windowId < 0 || !exactOrigin(value.origin)) return null;
  return {id:value.id,sourceTabId:value.sourceTabId,windowId:value.windowId,origin:value.origin};
}
function sameAnchor(a, b) {
  return a && b && a.id === b.id && a.sourceTabId === b.sourceTabId && a.windowId === b.windowId && a.origin === b.origin;
}

function validatedSelection(value) {
  if (!value || typeof value.text !== 'string' || !/\S/u.test(value.text) ||
      value.text.length > MAX_SELECTION_CHARS) return null;
  const origin = sourceOrigin(value.origin);
  if (!origin) return null;
  const selection = { text: value.text, origin };
  const anchor = validAnchor(value.sourceAnchor);
  if (anchor && anchor.origin === origin) selection.sourceAnchor = anchor;
  if (typeof value.analysisIntent?.id === 'string' && /^[a-zA-Z0-9_-]{16,100}$/u.test(value.analysisIntent.id)) {
    if (Number.isInteger(value.analysisIntent.windowId) && value.analysisIntent.windowId >= 0) {
      selection.analysisIntent = { id: value.analysisIntent.id, windowId: value.analysisIntent.windowId };
      if (Number.isInteger(value.analysisIntent.sourceTabId) && value.analysisIntent.sourceTabId >= 0) selection.analysisIntent.sourceTabId = value.analysisIntent.sourceTabId;
      if (typeof value.analysisIntent.panelContextId === 'string' && /^[a-zA-Z0-9_-]{16,100}$/u.test(value.analysisIntent.panelContextId)) selection.analysisIntent.panelContextId = value.analysisIntent.panelContextId;
    }
  }
  return selection;
}

async function languagePreference() {
  try {
    const { language } = await chrome.storage.local.get('language');
    return LANGUAGES.has(language) ? language : 'auto';
  } catch { return 'auto'; }
}

function resolvedLanguage(preference) {
  return preference === 'ru' || preference === 'en' ? preference :
    chrome.i18n.getUILanguage().toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

async function getState() {
  const language = await languagePreference();
  try {
    const state = await sessionStorage.get(['selection', 'captureError']);
    return {
      ok: true,
      selection: validatedSelection(state.selection),
      captureError: CAPTURE_ERRORS.has(state.captureError) ? state.captureError : null,
      language,
    };
  } catch {
    return { ok: true, selection: null, captureError: 'STORAGE_UNAVAILABLE', language };
  }
}

async function broadcastSelection(selection) {
  try { await chrome.runtime.sendMessage({ type: 'bw:selection', selection }); } catch {}
}

function commitCapture(generation, selection, captureError) {
  const commit = commitQueue.then(async () => {
    // An older, slower capture must never replace a newer request or a clear.
    if (generation !== captureGeneration) return true;
    try {
      const intent = selection?.analysisIntent;
      const previous = await sessionStorage.get(['selectionOwner', 'selection']);
      if (generation !== captureGeneration) return true;
      const update = {selection,captureError};
      if (intent?.panelContextId) update.selectionOwner = {contextId:intent.panelContextId, sourceTabId:intent.sourceTabId, windowId:intent.windowId};
      else if (previous?.selectionOwner) update.selectionOwner = null;
      await sessionStorage.set(update);
      activeAnchorGesture = selection?.sourceAnchor || null;
      const old = validatedSelection(previous.selection);
      if (old?.sourceAnchor && !sameAnchor(old.sourceAnchor, selection?.sourceAnchor)) await clearPageAnchor(old.sourceAnchor, old.text);
      await broadcastSelection(selection);
      return true;
    } catch { return false; }
  });
  commitQueue = commit.then(() => {}, () => {});
  return commit;
}

async function finishCapture(generation, selection, captureError) {
  const saved = await commitCapture(generation, selection, captureError);
  const state = await getState();
  return saved ? state : { ...state, selection: null, captureError: 'STORAGE_UNAVAILABLE' };
}

function consumeIntent(id, windowId, sender) {
  const operation = commitQueue.then(async () => {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/u.test(id)) return { ok: true, accepted: false };
    const { selection: stored } = await sessionStorage.get('selection');
    const selection = validatedSelection(stored);
    if (selection?.analysisIntent?.id !== id || selection.analysisIntent.windowId !== windowId) return { ok: true, accepted: false };
    const contextId = panelContextId(sender);
    if ((selection.analysisIntent.panelContextId || null) !== contextId) return {ok:true,accepted:false};
    // panel.html also serves the browser's options tab. That tab is not the
    // native sidebar opened by this gesture and must not win its one-shot send.
    if (!contextId && sender?.tab) return {ok:true,accepted:false};
    if (contextId) {
      const source = await sourceTabForPanel(sender, windowId);
      if (!source || source.id !== selection.analysisIntent.sourceTabId) return {ok:true,accepted:false};
    }
    // Clearing and acceptance share the same queue as capture commits and reset.
    // A service-worker restart sees the cleared record, so it cannot replay it.
    const snapshot = { text: selection.text, origin: selection.origin };
    if (selection.sourceAnchor) snapshot.sourceAnchor = selection.sourceAnchor;
    await sessionStorage.set({ selection: snapshot });
    return { ok: true, accepted: true, selection: snapshot };
  });
  commitQueue = operation.then(() => {}, () => {});
  return operation;
}

function queuedSite(operation) {
  const pending = siteQueue.then(operation);
  siteQueue = pending.then(() => {}, () => {});
  return pending;
}

function exactOrigin(value) {
  const origin = sourceOrigin(value);
  return origin && origin === value && origin.length <= 300 ? origin : null;
}

async function optedSites() {
  const { siteOrigins } = await chrome.storage.local.get('siteOrigins');
  return Array.isArray(siteOrigins) ? [...new Set(siteOrigins.filter(exactOrigin))].slice(0, MAX_OPTED_SITES) : [];
}

async function siteScriptId(origin) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(origin));
  return SITE_SCRIPT_PREFIX + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hasSiteAccess(origin) {
  return Boolean(origin) && chrome.permissions.contains({ origins: [origin + '/*'] });
}

function activeTabQuery(windowId) {
  return Number.isInteger(windowId) && windowId >= 0 ? { active: true, windowId } : { active: true, lastFocusedWindow: true };
}

function panelContextId(sender) {
  try {
    const value = new URL(sender?.url).searchParams.get('context');
    return typeof value === 'string' && /^[a-zA-Z0-9_-]{16,100}$/u.test(value) ? value : null;
  } catch { return null; }
}

async function panelContexts() {
  const saved = (await sessionStorage.get(PANEL_CONTEXT_KEY))?.[PANEL_CONTEXT_KEY];
  return Array.isArray(saved) ? saved.filter(item => item &&
    typeof item.id === 'string' && /^[a-zA-Z0-9_-]{16,100}$/u.test(item.id) &&
    Number.isInteger(item.sourceTabId) && item.sourceTabId >= 0 &&
    Number.isInteger(item.windowId) && item.windowId >= 0).slice(-64) : [];
}

async function sourceTabForPanel(sender, windowId) {
  const contextId = panelContextId(sender);
  if (!contextId) return (await chrome.tabs.query(activeTabQuery(windowId)))[0] || null;
  // A fallback panel may only address the source assigned by this background.
  // Page-provided tab IDs, other windows and arbitrary URL queries are refused.
  if (!Number.isInteger(sender?.tab?.id) || !Number.isInteger(sender.tab.windowId)) return null;
  const context = (await panelContexts()).find(item => item.id === contextId);
  if (!context || context.windowId !== sender.tab.windowId ||
      (Number.isInteger(windowId) && windowId !== context.windowId) ||
      (Number.isInteger(context.panelTabId) && context.panelTabId !== sender.tab.id)) return null;
  try {
    const tab = await chrome.tabs.get(context.sourceTabId);
    return tab?.windowId === context.windowId && tab.id !== sender.tab.id ? tab : null;
  } catch { return null; }
}

function openFallbackPanel(tab) {
  const operation = panelQueue.then(async () => {
    if (!Number.isInteger(tab?.id) || tab.id < 0) return;
    const source = Number.isInteger(tab.windowId) ? tab : await chrome.tabs.get(tab.id);
    if (!Number.isInteger(source?.windowId) || source.windowId < 0) return;
    const contexts = await panelContexts();
    // One companion tab per window avoids competing panels with independent
    // credentials attempting to consume one explicitly requested analysis.
    const existing = contexts.find(item => item.windowId === source.windowId);
    if (Number.isInteger(existing?.panelTabId)) {
      try {
        const previous = await chrome.tabs.get(existing.panelTabId);
        const expected = chrome.runtime.getURL('panel.html') + '?context=' + existing.id;
        if (previous?.url === expected && previous.windowId === source.windowId) {
          existing.sourceTabId = source.id;
          await sessionStorage.set({[PANEL_CONTEXT_KEY]:contexts});
          await chrome.tabs.update(previous.id, {active:true});
          return {contextId:existing.id};
        }
      } catch { /* A closed fallback is replaced with a fresh panel. */ }
    }
    const context = {id:crypto.randomUUID(), sourceTabId:source.id, windowId:source.windowId};
    const next = contexts.filter(item => item !== existing).slice(-63).concat(context);
    // Persist the opaque context before the panel can send its first message.
    await sessionStorage.set({[PANEL_CONTEXT_KEY]:next});
    const created = await chrome.tabs.create({
      url:chrome.runtime.getURL('panel.html') + '?context=' + context.id,
      windowId:source.windowId, active:true,
    });
    if (Number.isInteger(created?.id)) {
      context.panelTabId = created.id;
      await sessionStorage.set({[PANEL_CONTEXT_KEY]:next});
    }
    return {contextId:context.id};
  });
  panelQueue = operation.catch(() => {});
  return operation;
}

async function panelState(sender) {
  const state = await getState();
  if (state.captureError === 'STORAGE_UNAVAILABLE') return state;
  const contextId = panelContextId(sender);
  if (contextId) {
    state.canReturnToSource = Boolean(await sourceTabForPanel(sender, sender?.tab?.windowId));
    if (!state.canReturnToSource) state.selection = null;
  }
  const owner = (await sessionStorage.get('selectionOwner'))?.selectionOwner;
  if (owner?.contextId && owner.contextId !== contextId) state.selection = null;
  if (state.selection?.analysisIntent && (state.selection.analysisIntent.panelContextId || null) !== contextId) state.selection = null;
  if (state.selection?.analysisIntent && !contextId && sender?.tab) state.selection = null;
  return state;
}

async function returnToSource(sender) {
  if (!panelContextId(sender)) return {ok:false,error:'SITE_UNAVAILABLE'};
  const tab = await sourceTabForPanel(sender, sender?.tab?.windowId);
  if (!tab) return {ok:false,error:'SITE_UNAVAILABLE'};
  await chrome.tabs.update(tab.id, {active:true});
  return {ok:true};
}

async function currentSite(windowId, sender) {
  const tab = await sourceTabForPanel(sender, windowId);
  const origin = sourceOrigin(tab?.url);
  const available = Boolean(origin && Number.isInteger(tab?.id) && tab.id >= 0);
  if (!available) return { ok: true, origin: null, enabled: false, available: false };
  const sites = await optedSites();
  const enabled = sites.includes(origin) && await hasSiteAccess(origin);
  return { ok: true, origin, enabled, available: true };
}

async function disableWidgets(origin) {
  try {
    const tabs = await chrome.tabs.query({});
    // Tab URLs can become unavailable immediately after host access is revoked.
    // Address messages by opaque tab ID; each widget checks its own origin.
    await Promise.allSettled(tabs.filter(tab => Number.isInteger(tab.id)).map(tab =>
      chrome.tabs.sendMessage(tab.id, { type: 'bw:widget-disable', origin }, { frameId: 0 })));
  } catch {}
}

async function registerSite(origin) {
  const id = await siteScriptId(origin);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  const script = {
    id, matches: [origin + '/*'], js: ['selection.js'], runAt: 'document_idle',
    allFrames: false, persistAcrossSessions: true,
  };
  if (platform?.kind !== 'safari') script.world = 'ISOLATED';
  if (!existing.length) await chrome.scripting.registerContentScripts([script]);
}

async function reconcileSites() {
  const sites = await optedSites();
  const retained = [];
  for (const origin of sites) {
    if (await hasSiteAccess(origin)) retained.push(origin);
    else await disableWidgets(origin);
  }
  if (retained.length !== sites.length) await chrome.storage.local.set({ siteOrigins: retained });
  const ids = new Set(await Promise.all(retained.map(siteScriptId)));
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const stale = registered.filter(script => script.id.startsWith(SITE_SCRIPT_PREFIX) && !ids.has(script.id)).map(script => script.id);
  if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });
  for (const origin of retained) await registerSite(origin);
}

async function changeSite(origin, enabled, windowId, sender) {
  if (!exactOrigin(origin)) return { ok: false, error: 'SITE_UNAVAILABLE' };
  const tab = await sourceTabForPanel(sender, windowId);
  if (sourceOrigin(tab?.url) !== origin || !Number.isInteger(tab?.id)) return { ok: false, error: 'SITE_UNAVAILABLE' };
  const sites = await optedSites();
  if (enabled) {
    if (!await storageIsolationReady) return { ok: false, error: 'STORAGE_UNAVAILABLE' };
    if (!await hasSiteAccess(origin)) return { ok: false, error: 'SITE_ACCESS_REQUIRED' };
    if (!sites.includes(origin)) {
      if (sites.length >= MAX_OPTED_SITES) return { ok: false, error: 'SITE_LIMIT' };
      await chrome.storage.local.set({ siteOrigins: [...sites, origin] });
    }
    try {
      await registerSite(origin);
      // Ready handshake checks the live document again if this tab navigates meanwhile.
      const injection = { target: { tabId: tab.id, frameIds: [0] }, files: ['selection.js'] };
      if (platform?.kind !== 'safari') injection.world = 'ISOLATED';
      await chrome.scripting.executeScript(injection);
    } catch {
      await chrome.storage.local.set({ siteOrigins: sites });
      if (!sites.includes(origin)) {
        try { await chrome.scripting.unregisterContentScripts({ ids: [await siteScriptId(origin)] }); } catch {}
      }
      return { ok: false, error: 'SITE_UNAVAILABLE' };
    }
  } else {
    await chrome.storage.local.set({ siteOrigins: sites.filter(value => value !== origin) });
    await chrome.scripting.unregisterContentScripts({ ids: [await siteScriptId(origin)] });
    await disableWidgets(origin);
    // Host access may also authorize a user-configured provider on the same origin.
    // Disabling selection is therefore separate from revoking browser host permission.
  }
  return { ok: true, origin, enabled, available: true };
}

function widgetSender(sender) {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || sender.tab.id < 0 || !Number.isInteger(sender.tab.windowId) || sender.tab.windowId < 0) return null;
  const origin = sourceOrigin(sender.url);
  return origin && origin === sourceOrigin(sender.tab.url) ? origin : null;
}

async function widgetAccess(sender, origin) {
  if (!await storageIsolationReady) return false;
  const sites = await optedSites();
  if (!sites.includes(origin) || !await hasSiteAccess(origin)) return false;
  const tab = await chrome.tabs.get(sender.tab.id);
  return sourceOrigin(tab?.url) === origin;
}

async function captureWidget(message, sender, origin, generation, surface) {
  if (!await widgetAccess(sender, origin)) return { ok: false, error: 'SITE_ACCESS_REQUIRED' };
  const value = validatedSelection({ text: message.selection?.text, origin });
  if (!value || message.selection?.origin !== origin) return { ok: false, error: 'CAPTURE_UNAVAILABLE' };
  const opened = await surface;
  if (!opened) return {ok:false,error:'CAPTURE_UNAVAILABLE'};
  if (typeof message.selection?.sourceAnchor?.id === 'string') {
    const anchor = validAnchor({id:message.selection.sourceAnchor.id,sourceTabId:sender.tab.id,windowId:sender.tab.windowId,origin});
    if (anchor) {
      const status = await pageAnchor(anchor, value.text, 'bw:anchor-status');
      if (status.state === 'anchored') value.sourceAnchor = anchor;
    }
  }
  // Legacy field name: routing acknowledgement only. The panel displays the
  // captured writing and requires its separate, deliberate analysis action.
  value.analysisIntent = { id: crypto.randomUUID(), windowId: sender.tab.windowId, sourceTabId:sender.tab.id };
  if (opened.contextId) value.analysisIntent.panelContextId = opened.contextId;
  return finishCapture(generation, value, null);
}

// This function is serialized by Chrome and runs only after an explicit capture.
// It reads the browser selection, never form values or the full page's text.
function readOrdinarySelection(maxChars) {
  const editableSelector = 'input,textarea,select,[contenteditable],[role="textbox"],[role="searchbox"],[role="combobox"]';
  function editableAncestor(node) {
    let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (element) {
      if (element.matches('input,textarea,select,[role="textbox"],[role="searchbox"],[role="combobox"]') ||
          element.isContentEditable) return true;
      element = element.parentElement || element.getRootNode()?.host || null;
    }
    return false;
  }
  let focused = document.activeElement;
  while (focused) {
    if (editableAncestor(focused)) return { error: 'EDITABLE_SELECTION' };
    focused = focused.shadowRoot?.activeElement || null;
  }
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed) return { error: 'NO_SELECTION' };
  if (editableAncestor(selection.anchorNode) || editableAncestor(selection.focusNode)) {
    return { error: 'EDITABLE_SELECTION' };
  }
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    const ancestor = range.commonAncestorContainer;
    const candidates = ancestor.querySelectorAll?.(editableSelector) || [];
    for (const candidate of candidates) {
      if (editableAncestor(candidate) && range.intersectsNode(candidate)) {
        return { error: 'EDITABLE_SELECTION' };
      }
    }
  }
  const text = selection.toString();
  if (!/\S/u.test(text)) return { error: 'NO_SELECTION' };
  if (text.length > maxChars) return { error: 'SELECTION_TOO_LONG' };
  if (location.protocol !== 'https:' && location.protocol !== 'http:') {
    return { error: 'CAPTURE_UNAVAILABLE' };
  }
  return { text, origin: location.origin };
}

async function captureTab(tab, generation) {
  if (!Number.isInteger(tab?.id) || tab.id < 0) {
    return finishCapture(generation, null, 'CAPTURE_UNAVAILABLE');
  }
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: readOrdinarySelection,
      args: [MAX_SELECTION_CHARS],
    });
    const result = results.find(item => item.frameId === 0)?.result;
    const selection = validatedSelection(result);
    const error = selection ? null : CAPTURE_ERRORS.has(result?.error) ? result.error : 'CAPTURE_UNAVAILABLE';
    return finishCapture(generation, selection, error);
  } catch { return finishCapture(generation, null, 'CAPTURE_UNAVAILABLE'); }
}

function openPanelFromGesture(tab) {
  const target = Number.isInteger(tab?.id) && tab.id >= 0 ? { tabId: tab.id } :
    Number.isInteger(tab?.windowId) ? { windowId: tab.windowId } : null;
  if (!target) return Promise.resolve(null);
  // Keep this synchronous call before all storage reads, queries and injections.
  try {
    if (chrome.sidePanel?.open) {
      return Promise.resolve(chrome.sidePanel.open(target)).then(() => ({native:true})).catch(() => openFallbackPanel(tab)).catch(() => null);
    } else if (chrome.sidebarAction?.open) {
      return Promise.resolve(chrome.sidebarAction.open()).then(() => ({native:true})).catch(() => openFallbackPanel(tab)).catch(() => null);
    } else {
      return openFallbackPanel(tab).catch(() => null);
    }
  } catch { return openFallbackPanel(tab).catch(() => null); }
}

chrome.action.onClicked.addListener((tab) => {
  openPanelFromGesture(tab);
  return captureTab(tab, ++captureGeneration);
});

chrome.contextMenus?.onClicked?.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  openPanelFromGesture(tab);
  const generation = ++captureGeneration;
  if (info.editable === true) return finishCapture(generation, null, 'EDITABLE_SELECTION');
  const text = info.selectionText;
  if (typeof text !== 'string' || !/\S/u.test(text)) return finishCapture(generation, null, 'NO_SELECTION');
  if (text.length > MAX_SELECTION_CHARS) return finishCapture(generation, null, 'SELECTION_TOO_LONG');
  const origin = sourceOrigin(info.frameUrl || info.pageUrl || tab?.url);
  if (!origin) return finishCapture(generation, null, 'CAPTURE_UNAVAILABLE');
  return finishCapture(generation, { text, origin }, null);
});

function panelSender(sender) {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== 'string') return false;
  try {
    const actual = new URL(sender.url);
    const expected = new URL(chrome.runtime.getURL('panel.html'));
    return actual.protocol === expected.protocol && actual.host === expected.host &&
      actual.pathname === expected.pathname && (!Number.isInteger(sender.frameId) || sender.frameId === 0);
  } catch { return false; }
}


// Anchors are local references to one captured top-document range. They never
// enter model input and cannot be addressed using a page URL or a text search.
async function pageAnchor(anchor, text, type, detail = {}) {
  try {
    const tab = await chrome.tabs.get(anchor.sourceTabId);
    if (tab.windowId !== anchor.windowId || sourceOrigin(tab.url) !== anchor.origin) return {ok:true,state:'unavailable'};
    const result = await chrome.tabs.sendMessage(anchor.sourceTabId,
      {type, anchor, text, ...detail}, {frameId:0});
    return {ok:true,state:['anchored','stale','unavailable'].includes(result?.state) ? result.state : 'unavailable'};
  } catch { return {ok:true,state:'unavailable'}; }
}
function clearPageAnchor(anchor, text) { return pageAnchor(anchor, text, 'bw:anchor-clear'); }
function validAnchorExcerpt(item, text) {
  return item && Number.isInteger(item.start) && Number.isInteger(item.end) && item.start >= 0 &&
    item.end > item.start && item.end <= text.length && typeof item.quote === 'string' && text.slice(item.start,item.end) === item.quote;
}
async function authorizedAnchor(message, sender) {
  const anchor = validAnchor(message.anchor);
  if (!anchor || message.windowId !== anchor.windowId || typeof message.text !== 'string') return null;
  const saved = await sessionStorage.get(['selection','selectionOwner']);
  const selection = validatedSelection(saved.selection);
  if (!sameAnchor(selection?.sourceAnchor, anchor) || selection.text !== message.text) return null;
  const contextId = panelContextId(sender);
  if ((saved.selectionOwner?.contextId || null) !== contextId) return null;
  if (contextId) {
    const tab = await sourceTabForPanel(sender, anchor.windowId);
    if (tab?.id !== anchor.sourceTabId) return null;
  } else if (sender.tab) return null; // An options tab cannot control a native panel capture.
  activeAnchorGesture = anchor;
  return {anchor,text:selection.text};
}
async function relayAnchor(message, sender) {
  const selected = await authorizedAnchor(message, sender);
  if (!selected) return {ok:true,state:'unavailable'};
  const detail = {};
  if (message.type === 'bw:anchor-report') {
    if (!Array.isArray(message.items) || message.items.length > 5 ||
        !message.items.every((item,index) => item?.index === index && validAnchorExcerpt(item, selected.text) &&
          (item.note === undefined || (typeof item.note === 'string' && item.note.trim() && item.note.length <= 800)))) return {ok:true,state:'unavailable'};
    if (message.language !== undefined && !['ru','en'].includes(message.language)) return {ok:true,state:'unavailable'};
    if (message.reportRevision !== undefined && (!Number.isSafeInteger(message.reportRevision) || message.reportRevision < 0)) return {ok:true,state:'unavailable'};
    detail.items = message.items.map(({index,start,end,quote,note}) => ({index,start,end,quote,...(note === undefined ? {} : {note})}));
    if (message.language) detail.language = message.language;
    if (message.reportRevision !== undefined) detail.reportRevision = message.reportRevision;
  } else if (message.type === 'bw:anchor-focus') {
    if (message.start !== undefined || message.end !== undefined || message.quote !== undefined) {
      if (!validAnchorExcerpt(message, selected.text)) return {ok:true,state:'unavailable'};
      Object.assign(detail, {start:message.start,end:message.end,quote:message.quote});
      if (Number.isInteger(message.index) && message.index >= 0 && message.index < 5) detail.index = message.index;
    } else if (message.index !== undefined) {
      if (!Number.isInteger(message.index) || message.index < 0 || message.index > 4) return {ok:true,state:'unavailable'};
      detail.index = message.index;
    }
  }
  return pageAnchor(selected.anchor,selected.text,message.type,detail);
}
async function relayAnchorEvent(message, sender, origin) {
  const saved = validatedSelection((await sessionStorage.get('selection')).selection);
  const anchor = saved?.sourceAnchor;
  if (!anchor || message.id !== anchor.id || sender.tab.id !== anchor.sourceTabId ||
      sender.tab.windowId !== anchor.windowId || origin !== anchor.origin ||
      !['anchored','stale','unavailable'].includes(message.state)) return {ok:false};
  if (!await widgetAccess(sender, origin)) return {ok:false};
  const detail = {};
  if (message.index !== undefined) {
    if (message.state !== 'anchored' || !Number.isInteger(message.index) || message.index < 0 || message.index > 4) return {ok:false};
    detail.index = message.index;
  }
  try { await chrome.runtime.sendMessage({type:'bw:anchor-event',anchor,text:saved.text,state:message.state,...detail}); } catch {}
  return {ok:true};
}

// Disconnect is a best-effort native-panel lifecycle signal. Explicit reset and
// source replacement also clear anchors, and content pagehide removes its UI.
chrome.runtime.onConnect?.addListener(port => {
  if (port.name !== 'bw:anchor-panel' || !panelSender(port.sender)) { try { port.disconnect(); } catch {} return; }
  let bound = null, disconnected = false, serial = 0;
  port.onMessage.addListener(message => {
    const revision = ++serial;
    Promise.resolve(authorizedAnchor(message,port.sender)).then(selected => {
      if (revision !== serial || !selected) return;
      if (disconnected) { void clearPageAnchor(selected.anchor,selected.text); return; }
      bound = selected;
    }).catch(() => {});
  });
  port.onDisconnect.addListener(() => {
    disconnected = true;
    if (bound) void clearPageAnchor(bound.anchor,bound.text);
  });
});

function updateMenuLanguage(preference) {
  const title = resolvedLanguage(preference) === 'ru' ? 'Открыть выделенное в beforeword' : 'Open selection in beforeword';
  try {
    if (platform?.kind === 'firefox' || platform?.kind === 'safari') {
      Promise.resolve(chrome.contextMenus.update(MENU_ID, {title})).catch(() => {});
      return;
    }
    chrome.contextMenus.update(MENU_ID, { title }, () => { void chrome.runtime.lastError; });
  } catch {}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;
  const origin = widgetSender(sender);
  if (origin && message.type === 'bw:anchor-source-event') {
    // A trusted footnote activation may reopen its panel, but never creates an
    // analysis intent or replaces the saved record. Keep gesture before awaits.
    if (message.state === 'anchored' && Number.isInteger(message.index) && message.index >= 0 && message.index < 5 &&
        activeAnchorGesture?.id === message.id && activeAnchorGesture.sourceTabId === sender.tab.id &&
        activeAnchorGesture.windowId === sender.tab.windowId && activeAnchorGesture.origin === origin) void openPanelFromGesture(sender.tab);
    relayAnchorEvent(message,sender,origin).then(sendResponse,() => sendResponse({ok:false}));
    return true;
  }
  if (origin && (message.type === 'bw:widget-ready' || message.type === 'bw:widget-capture')) {
    let operation;
    if (message.type === 'bw:widget-capture') {
      // A trusted logo click sends this message directly; open before any await.
      // The content script has no page-event/message bridge and checks isTrusted.
      if (!validatedSelection({ text: message.selection?.text, origin }) || message.selection?.origin !== origin) {
        sendResponse({ ok: false, error: 'CAPTURE_UNAVAILABLE' }); return false;
      }
      const surface = openPanelFromGesture(sender.tab);
      operation = captureWidget(message, sender, origin, ++captureGeneration, surface);
    } else {
      operation = widgetAccess(sender, origin).then(async allowed => allowed ?
        { ok: true, language: resolvedLanguage(await languagePreference()) } : { ok: false, error: 'SITE_ACCESS_REQUIRED' });
    }
    operation.then(sendResponse, () => sendResponse({ ok: false, error: 'CAPTURE_UNAVAILABLE' }));
    return true;
  }
  if (!panelSender(sender)) return false;
  let operation;
  if (['bw:anchor-status','bw:anchor-report','bw:anchor-focus','bw:anchor-clear'].includes(message.type)) {
    operation = relayAnchor(message,sender);
  } else if (message.type === 'bw:get-state') {
    operation = panelState(sender);
  } else if (message.type === 'bw:consume-intent') {
    operation = consumeIntent(message.id, message.windowId, sender);
  } else if (message.type === 'bw:get-site') {
    operation = currentSite(message.windowId, sender);
  } else if (message.type === 'bw:enable-site' || message.type === 'bw:disable-site') {
    operation = queuedSite(() => changeSite(message.origin, message.type === 'bw:enable-site', message.windowId, sender));
  } else if (message.type === 'bw:capture') {
    const generation = ++captureGeneration;
    operation = sourceTabForPanel(sender, message.windowId).then(
      tab => captureTab(tab, generation),
      () => finishCapture(generation, null, 'CAPTURE_UNAVAILABLE'),
    );
  } else if (message.type === 'bw:return-source') {
    operation = returnToSource(sender);
  } else if (message.type === 'bw:set-language') {
    if (!LANGUAGES.has(message.language)) {
      sendResponse({ ok: false, error: 'INVALID_LANGUAGE' });
      return false;
    }
    operation = chrome.storage.local.set({ language: message.language }).then(() => {
      updateMenuLanguage(message.language);
      return { ok: true };
    });
  } else if (message.type === 'bw:clear') {
    operation = commitCapture(++captureGeneration, null, null).then(saved =>
      saved ? { ok: true } : { ok: false, error: 'STORAGE_UNAVAILABLE' });
  } else {
    return false;
  }
  operation.then(sendResponse, () => sendResponse({ ok: false, error: 'STORAGE_UNAVAILABLE' }));
  return true;
});


async function invalidateSourceTab(tabId) {
  try {
    const selected = validatedSelection((await sessionStorage.get('selection')).selection);
    if (selected?.sourceAnchor?.sourceTabId !== tabId) return;
    await chrome.runtime.sendMessage({type:'bw:anchor-event',anchor:selected.sourceAnchor,text:selected.text,state:'stale'});
  } catch {}
}
chrome.tabs.onUpdated?.addListener((tabId,change) => {
  if (change.status === 'loading' || typeof change.url === 'string') void invalidateSourceTab(tabId);
});
chrome.tabs.onRemoved?.addListener(tabId => { void invalidateSourceTab(tabId); });

chrome.runtime.onStartup.addListener(() => queuedSite(reconcileSites).catch(() => {}));
chrome.permissions.onRemoved.addListener(() => queuedSite(reconcileSites).catch(() => {}));
chrome.runtime.onInstalled.addListener(() => {
  void queuedSite(reconcileSites).catch(() => {});
  void languagePreference().then(preference => {
    if (!chrome.contextMenus?.removeAll || !chrome.contextMenus?.create) return;
    if (platform?.kind === 'firefox' || platform?.kind === 'safari') {
      const title = resolvedLanguage(preference) === 'ru' ? 'Открыть выделенное в beforeword' : 'Open selection in beforeword';
      return Promise.resolve(chrome.contextMenus.removeAll()).then(() => chrome.contextMenus.create({
        id:MENU_ID, title, contexts:['selection'], documentUrlPatterns:['http://*/*','https://*/*'],
      }));
    }
    // Callback form supports the declared Chrome 116 minimum.
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) return;
      const title = resolvedLanguage(preference) === 'ru' ? 'Открыть выделенное в beforeword' : 'Open selection in beforeword';
      chrome.contextMenus.create({
        id: MENU_ID, title, contexts: ['selection'], documentUrlPatterns: ['http://*/*', 'https://*/*'],
      }, () => { void chrome.runtime.lastError; });
    });
  }).catch(() => {});
});
