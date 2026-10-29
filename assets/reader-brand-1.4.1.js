'use strict';
/* Site-wide entry point. The release builder inserts the shared selection
 * widget into the marked closure. No browser namespace is overwritten. */
(function(root) {
  function createParagraphSuggestions(storage) {
    const key='beforewordParagraphSuggestionsV1',subscribers=new Set();let enabled=true;
    try{enabled=storage?.getItem(key)!=='false';}catch{}
    return Object.freeze({key,get enabled(){return enabled;},set(value){
      const next=value===true;if(next===enabled)return;enabled=next;
      for(const listener of subscribers)listener(enabled);
    },subscribe(listener){subscribers.add(listener);return()=>subscribers.delete(listener);}});
  }
  if(typeof module==='object'&&module.exports)module.exports={createParagraphSuggestions};
  if(root.__beforewordWebReaderV2||root.top!==root||!/^https?:$/.test(root.location.protocol))return;
  root.__beforewordWebReaderV2=true;
  const origin=root.location.origin, CHANNEL='beforeword:web:v1';
  const listeners=new Set();let preferenceStorage;
  try{preferenceStorage=root.localStorage;}catch{}
  const webParagraphSuggestions=createParagraphSuggestions(preferenceStorage);
  root.addEventListener('storage',event=>{if(event.key===webParagraphSuggestions.key||event.key===null)webParagraphSuggestions.set(event.newValue!=='false');});
  let host,frame,dialog,closeButton,launcher,ready=false,selection=null,queued=null,previousFocus=null;
  let language=document.documentElement.lang.toLowerCase().startsWith('ru')?'ru':'en';
  const label=(ru,en)=>language==='ru'?ru:en;
  function post(type,extra={}){if(ready&&frame?.contentWindow)frame.contentWindow.postMessage({channel:CHANNEL,type,...extra},origin);}
  function sendAnchor(type,extra={}) {
    if(!selection?.sourceAnchor)return {ok:true,state:'unavailable'};
    let result={ok:true,state:'unavailable'};
    for(const listener of listeners)listener({type,anchor:selection.sourceAnchor,text:selection.text,...extra},{id:'beforeword-website'},value=>{result=value;});
    return result;
  }
  function validSelection(value){return value&&typeof value.text==='string'&&value.text.length>0&&value.text.length<=12000&&value.origin===origin;}
  function choose(value) {
    if(!validSelection(value))return false;
    if(selection?.sourceAnchor?.id!==value.sourceAnchor?.id)sendAnchor('bw:anchor-clear');
    selection={text:value.text,origin,...(typeof value.sourceAnchor?.id==='string'?{sourceAnchor:{id:value.sourceAnchor.id,origin,sourceTabId:0,windowId:0}}:{})};
    queued={...selection};open();flush();return true;
  }
  function flush(){if(ready&&queued){post('set-source',{selection:queued});queued=null;}}
  function theme(){
    const explicit=document.documentElement.dataset.theme||document.documentElement.dataset.colorScheme;
    const value=['light','dark'].includes(explicit)?explicit:root.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
    if(host)host.dataset.theme=value;post('theme',{theme:value});
  }
  function publish(){
    if(dialog.open)document.documentElement.dataset.beforewordPanel=dialog.dataset.mode;else delete document.documentElement.dataset.beforewordPanel;
    document.dispatchEvent(new CustomEvent('beforeword:panel',{detail:{open:dialog.open,mode:dialog.dataset.mode,width:dialog.open?dialog.getBoundingClientRect().width:0}}));
  }
  function open(){
    if(!dialog)return;
    if(!dialog.open){previousFocus=document.activeElement;dialog.dataset.mode=root.innerWidth>=900?'side':'modal';if(dialog.dataset.mode==='modal')dialog.showModal();else dialog.show();closeButton.focus();}
    launcher.hidden=true;publish();theme();flush();post('panel-visible',{visible:true});
  }
  function close(){
    if(!dialog?.open)return;
    post('panel-visible',{visible:false});post('cancel');sendAnchor('bw:anchor-clear');
    if(selection?.sourceAnchor)post('anchor-event',{event:{anchor:selection.sourceAnchor,text:selection.text,state:'unavailable'}});
    selection=null;queued=null;dialog.close();launcher.hidden=false;publish();(previousFocus?.isConnected?previousFocus:launcher).focus({preventScroll:true});
  }
  function respond(id,result){post('response',{id,result});}
  function receive(event){
    if(event.origin!==origin||event.source!==frame?.contentWindow)return;
    const data=event.data;if(!data||data.channel!==CHANNEL)return;
    if(data.type==='ready'){ready=true;theme();post('set-language',{language});post('paragraph-suggestions',{enabled:webParagraphSuggestions.enabled});flush();post('panel-visible',{visible:dialog.open});return;}
    if(data.type==='paragraph-suggestions'&&typeof data.enabled==='boolean'){webParagraphSuggestions.set(data.enabled);return;}
    if(data.type==='language'&&['ru','en'].includes(data.language)){language=data.language;closeButton.textContent=label('Закрыть','Close');return;}
    if(data.type!=='request'||typeof data.id!=='string'||data.id.length>32)return;
    const request=data.request;if(!request||typeof request.type!=='string')return;
    if(request.type==='bw:clear'){sendAnchor('bw:anchor-clear');selection=null;respond(data.id,{ok:true});return;}
    if(request.type==='bw:return-source'){respond(data.id,{ok:true});close();return;}
    if(!['bw:anchor-status','bw:anchor-report','bw:anchor-focus','bw:anchor-clear'].includes(request.type))return;
    if(!selection||request.anchor?.id!==selection.sourceAnchor?.id||request.anchor?.origin!==origin||request.text!==selection.text){respond(data.id,{ok:true,state:'unavailable'});return;}
    const extra={};for(const key of ['items','start','end','quote','index','language','reportRevision'])if(Object.hasOwn(request,key))extra[key]=request[key];
    const result=sendAnchor(request.type,extra);respond(data.id,result);
    // A modal blocks the selected page. Return to it after focusing a quote,
    // without discarding the exact anchor or report.
    if(request.type==='bw:anchor-focus'&&result.state==='anchored'&&dialog.dataset.mode==='modal'){post('panel-visible',{visible:false});dialog.close();launcher.hidden=false;publish();}
  }
  const webSelectionRuntime={runtime:{id:'beforeword-website',onMessage:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)},async sendMessage(message){
    if(message?.type==='bw:widget-ready')return {ok:true,language};
    if(message?.type==='bw:widget-capture')return {ok:choose(message.selection)};
    if(message?.type==='bw:anchor-source-event'&&selection?.sourceAnchor?.id===message.id){
      if(Number.isInteger(message.index))open();
      post('anchor-event',{event:{anchor:selection.sourceAnchor,text:selection.text,state:message.state,...(Number.isInteger(message.index)?{index:message.index}:{})}});return {ok:true};
    }
    return {ok:false};
  }}};
  function mount(){
    if(document.getElementById('beta-reader'))return;
    host=document.createElement('div');host.setAttribute('data-beforeword-ui','');host.style.cssText='all:initial;position:relative;z-index:2147483645';
    const shadow=host.attachShadow({mode:'closed'}),style=document.createElement('style');
    style.textContent=':host{--paper:#f5f4ef;--ink:#161616;--line:#d0cfc6;color-scheme:light}:host([data-theme=dark]){--paper:#171815;--ink:#f2f1e9;--line:#494a41;color-scheme:dark}*{box-sizing:border-box}[hidden]{display:none!important}button{font:14px system-ui;cursor:pointer;touch-action:manipulation}button:focus-visible{outline:3px solid #9d88ec;outline-offset:3px}dialog{position:fixed;inset:12px 12px 12px auto;margin:0;width:460px;max-width:calc(100vw - 24px);height:calc(100dvh - 24px);max-height:none;padding:0;border:1px solid var(--line);border-radius:14px;background:var(--paper);color:var(--ink);box-shadow:0 8px 36px #0004;overflow:hidden}dialog[open]{display:flex;flex-direction:column}dialog[data-mode=modal]{inset:8px;margin:0;width:calc(100vw - 16px);max-width:none;height:calc(100dvh - 16px)}dialog::backdrop{background:#0008}.bar{height:48px;flex-shrink:0;display:flex;justify-content:space-between;align-items:center;padding:0 12px;border-bottom:1px solid var(--line);font:600 14px system-ui}.bar button{min-height:40px;padding:0 12px;border:0;background:transparent;color:inherit}iframe{display:block;width:100%;height:100%;min-height:0;flex:1;border:0}.launcher{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));display:flex;align-items:center;gap:9px;min-height:48px;padding:9px 15px;border:1px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink);box-shadow:0 3px 14px #0002}.launcher img{width:92px;height:20px;flex-shrink:0;color-scheme:light}:host([data-theme=dark]) .launcher img{filter:invert(1)}@media(forced-colors:active){dialog,.launcher{border-color:ButtonText;box-shadow:none}.launcher img{filter:none}}';
    dialog=document.createElement('dialog');dialog.setAttribute('aria-label',label('beforeword — рассмотреть написанное','beforeword — examine text'));
    const bar=document.createElement('div');bar.className='bar';const title=document.createElement('span');title.textContent='beforeword';
    closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent=label('Закрыть','Close');closeButton.addEventListener('click',close);bar.append(title,closeButton);
    frame=document.createElement('iframe');frame.title=label('Рассмотреть написанное в beforeword','Examine the writing with beforeword');frame.src='/beta/app/panel.html?v=0.5.5-ui1&lang='+language;frame.setAttribute('referrerpolicy','same-origin');
    dialog.append(bar,frame);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    launcher=document.createElement('button');launcher.type='button';launcher.className='launcher';launcher.setAttribute('aria-label',label('Открыть beforeword','Open beforeword'));
    const mark=document.createElement('img');mark.src='/model/assets/brand-1.4.1/wordmark-dark.svg';mark.alt='';launcher.append(mark,document.createTextNode(label('Рассмотреть написанное','Examine the writing')));launcher.addEventListener('click',open);
    shadow.append(style,dialog,launcher);document.documentElement.append(host);
    root.addEventListener('message',receive);
    document.addEventListener('click',event=>{const entry=event.target?.closest?.('[data-beforeword-open]');if(entry){event.preventDefault();open();}});
    document.addEventListener('beforeword:open',open);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open){event.preventDefault();close();}});
    root.addEventListener('resize',()=>{if(!dialog.open)return;const next=root.innerWidth>=900?'side':'modal';if(next===dialog.dataset.mode)return;dialog.close();dialog.dataset.mode=next;if(next==='modal')dialog.showModal();else dialog.show();publish();});
    root.addEventListener('pagehide',()=>{post('panel-visible',{visible:false});post('cancel');sendAnchor('bw:anchor-clear');});
    new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-color-scheme','class']});
    root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',theme);theme();
    root.BeforewordReader=Object.freeze({open,capture(text){return choose({text,origin});}});
    'use strict';

// Installed only on a site the person enabled. This isolated-world script
// proposes a local snapshot; only a trusted button activation sends it.
(() => {
  const chrome = webSelectionRuntime;
  const guard = '__beforewordSelectionWidgetV1';
  if (globalThis[guard] || window.top !== window || !/^https?:$/.test(location.protocol)) return;
  const MAX_CHARS = 12000;
  const MAX_NODES = 400;
  const HOVER_MS = 500;
  const BLOCKS = 'p,li,blockquote,pre,code,h1,h2,h3,h4,h5,h6';
  const EXCLUDED = 'input,textarea,select,iframe,object,embed,[contenteditable],[role="textbox"],[role="searchbox"],[role="combobox"],[role="slider"],[role="spinbutton"],[inert]';
  const CONTROLS = 'button,a,summary,[role="button"],[role="link"],[role="menuitem"]';
  const ROOTS = 'html,body,main,article,section';
  let stopped = false;
  let host;
  let button;
  let outline;
  let hoverTimer;
  let leaveTimer;
  let candidateObserver;
  let pendingCandidate = null;
  let pointerPosition = null;
  let current = null;
  let dismissedSelection = null;
  let dismissedCandidate = null;
  let language = 'en';
  let sourceAnchor = null;
  let anchorHost = null;
  let anchorLayer = null;
  let anchorPaint = null;
  let anchorNotes = null;
  let anchorPopup = null;
  let popupText = null;
  let popupTitle = null;
  let popupClose = null;
  let popupDetails = null;
  let anchorObserver = null;
  let anchorTimer = null;
  let anchorFrame = null;
  const listeners = [];
  listeners.push(webParagraphSuggestions.subscribe(enabled => {
    if (enabled) return;
    clearTimers(); candidateObserver?.disconnect(); pendingCandidate = null;
    if (current?.kind === 'hover') hide();
  }));

  function listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    listeners.push(() => target.removeEventListener(type, listener, options));
  }
  function clearTimers() {
    clearTimeout(hoverTimer);
    clearTimeout(leaveTimer);
    hoverTimer = leaveTimer = undefined;
  }
  function hide() {
    current = null;
    if (host) host.style.setProperty('display', 'none', 'important');
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimers();
    candidateObserver?.disconnect();
    clearAnchor();
    for (const remove of listeners.splice(0)) remove();
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch {}
    host?.remove();
    current = pendingCandidate = dismissedSelection = dismissedCandidate = null;
    delete globalThis[guard];
  }
  globalThis[guard] = { stop };
  function onMessage(message, sender, respond) {
    if (['bw:anchor-status','bw:anchor-report','bw:anchor-focus','bw:anchor-clear'].includes(message?.type)) {
      if (sender?.id !== chrome.runtime.id || sender?.tab) return;
      respond?.(handleAnchorMessage(message));
      return;
    }
    if (message?.type !== 'bw:widget-disable') return;
    if (message.origin && message.origin !== location.origin) return;
    stop();
    respond?.({ ok: true });
  }

  function elementOf(node) { return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement; }
  function excluded(node) {
    let element = elementOf(node);
    while (element) {
      if (element === host) return false;
      if (element.matches(EXCLUDED) || element.isContentEditable) return true;
      element = element.parentElement || element.getRootNode()?.host || null;
    }
    return false;
  }
  function visible(element, styleCache) {
    for (let node = element; node; node = node.parentElement) {
      const style = styleCache?.get(node) || getComputedStyle(node);
      styleCache?.set(node,style);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0 ||
          style.contentVisibility === 'hidden' || node.hidden) return false;
    }
    return element.getClientRects().length > 0;
  }
  function focusedEditor() {
    let focused = document.activeElement;
    // The widget itself may own keyboard focus while a selection remains.
    if (focused === host || focused === anchorHost) return false;
    while (focused) {
      if (excluded(focused)) return true;
      if (focused.isContentEditable) return true;
      focused = focused.shadowRoot?.activeElement || null;
    }
    return false;
  }
  function sameSelection(first, second) {
    return first && second && first.text === second.text && first.anchor === second.anchor &&
      first.focus === second.focus && first.anchorOffset === second.anchorOffset && first.focusOffset === second.focusOffset;
  }
  function ordinarySelection() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed || focusedEditor()) return null;
    if (excluded(selection.anchorNode) || excluded(selection.focusNode)) return null;
    const anchor = elementOf(selection.anchorNode);
    const focus = elementOf(selection.focusNode);
    if (!anchor || !focus || !visible(anchor) || !visible(focus)) return null;
    let examined = 0;
    for (let i = 0; i < selection.rangeCount; i += 1) {
      const range = selection.getRangeAt(i);
      // Walk only from the start of the selected range, never query the page.
      const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      // Element offsets count children. Skip the unselected preceding children,
      // including the case where the range begins just after its last child.
      let node = range.startContainer;
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (range.startOffset < node.childNodes.length) node = node.childNodes[range.startOffset];
        else {
          walker.currentNode = node;
          node = walker.nextSibling();
          while (!node && walker.parentNode()) node = walker.nextSibling();
        }
      }
      if (node) walker.currentNode = node;
      while (node) {
        if (++examined > MAX_NODES) return null;
        if (range.intersectsNode(node)) {
          const element = elementOf(node);
          if (excluded(element) || (node.nodeType === Node.TEXT_NODE && !visible(element))) return null;
        } else break;
        node = walker.nextNode();
      }
    }
    const text = selection.toString();
    if (!/\S/u.test(text) || text.length > MAX_CHARS) return null;
    const rects = selection.getRangeAt(selection.rangeCount - 1).getClientRects();
    const rect = rects[rects.length - 1];
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return { kind: 'selection', text, rect, anchor: selection.anchorNode, focus: selection.focusNode,
      anchorOffset: selection.anchorOffset, focusOffset: selection.focusOffset };
  }
  function hasSelection() {
    const selection = window.getSelection();
    return Boolean(selection && selection.rangeCount && !selection.isCollapsed);
  }
  function proposedCandidate(target) {
    if (!(target instanceof Element) || excluded(target) || target.closest(CONTROLS)) return null;
    const candidate = target.closest(BLOCKS);
    if (!candidate || candidate.matches(ROOTS) || excluded(candidate) || candidate.closest(CONTROLS)) return null;
    // A block nested in a control or editor is never a reading candidate.
    return candidate;
  }
  function blockSnapshot(candidate) {
    if (!webParagraphSuggestions.enabled) return null;
    if (!candidate?.isConnected || excluded(candidate) || !visible(candidate) || focusedEditor()) return null;
    const rect = candidate.getBoundingClientRect();
    if (rect.width < 12 || rect.height < 12 || rect.width > innerWidth ||
        rect.height > Math.min(720, innerHeight * 0.85) || rect.top < 0 || rect.bottom > innerHeight ||
        rect.left < 0 || rect.right > innerWidth) return null;
    const walker = document.createTreeWalker(candidate, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = candidate;
    let count = 0;
    while (node) {
      if (++count > MAX_NODES) return null;
      if (node.nodeType === Node.ELEMENT_NODE &&
          (excluded(node) || node.matches('button,summary,[role="button"],[role="menuitem"]') || !visible(node) || node.shadowRoot)) return null;
      if (node !== candidate && node.nodeType === Node.ELEMENT_NODE && node.matches(BLOCKS) && !node.matches('code')) return null;
      node = walker.nextNode();
    }
    // innerText is read once, from this bounded visible candidate only.
    const text = candidate.innerText;
    if (typeof text !== 'string' || !/\S/u.test(text) || text.length > MAX_CHARS) return null;
    return { kind: 'hover', text, rect, candidate };
  }
  function position(snapshot) {
    if (snapshot.rect.bottom < 0 || snapshot.rect.top > innerHeight) { hide(); return; }
    const padding = 8;
    const x = Math.max(padding, Math.min(innerWidth - 44 - padding, snapshot.rect.right + 8));
    const y = Math.max(padding, Math.min(innerHeight - 44 - padding, snapshot.rect.top - 4));
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    if (snapshot.kind === 'hover') {
      outline.style.display = 'block';
      outline.style.left = `${snapshot.rect.left - 3}px`;
      outline.style.top = `${snapshot.rect.top - 3}px`;
      outline.style.width = `${snapshot.rect.width + 6}px`;
      outline.style.height = `${snapshot.rect.height + 6}px`;
    } else outline.style.display = 'none';
  }
  function isPinnedSnapshot(snapshot) {
    const a = sourceAnchor;
    if (!a || a.state !== 'anchored' || !snapshot) return false;
    if (snapshot.kind === 'hover') {
      // A pinned passage already has its controls. Hovering its containing
      // paragraph must not resurrect the transient capture button.
      return snapshot.candidate?.contains(a.startNode) && snapshot.candidate.contains(a.endNode);
    }
    const selection = window.getSelection();
    if (snapshot.text !== a.text || selection?.rangeCount !== 1) return false;
    const range = selection.getRangeAt(0);
    return range.startContainer === a.startNode && range.startOffset === a.startOffset &&
      range.endContainer === a.endNode && range.endOffset === a.endOffset;
  }
  function show(snapshot) {
    if (stopped || !host?.isConnected) return;
    if (isPinnedSnapshot(snapshot)) { hide(); return; }
    current = snapshot;
    host.style.setProperty('display', 'block', 'important');
    position(snapshot);
  }
  function refreshSelection() {
    if (stopped || !host) return;
    const snapshot = ordinarySelection();
    if (!snapshot) {
      if (!hasSelection()) dismissedSelection = null;
      if (current?.kind === 'selection' || hasSelection()) hide();
      return;
    }
    clearTimers();
    candidateObserver?.disconnect();
    pendingCandidate = null;
    if (sameSelection(snapshot, dismissedSelection)) { hide(); return; }
    dismissedSelection = null;
    show(snapshot);
  }
  function scheduleProposal(candidate) {
    clearTimeout(hoverTimer);
    if (!webParagraphSuggestions.enabled) return;
    hoverTimer = setTimeout(() => {
      if (stopped || pendingCandidate !== candidate || candidate === dismissedCandidate || hasSelection()) return;
      const snapshot = blockSnapshot(candidate);
      if (snapshot) show(snapshot); else hide();
    }, HOVER_MS);
  }
  function observeCandidate(candidate) {
    candidateObserver?.disconnect();
    candidateObserver = new MutationObserver(() => {
      if (stopped || pendingCandidate !== candidate || candidate === dismissedCandidate) return;
      if (current?.candidate === candidate) hide();
      scheduleProposal(candidate);
    });
    // Watch only this proposed block, never the page or a feed container.
    candidateObserver.observe(candidate, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['hidden', 'style', 'class', 'contenteditable', 'role', 'inert'] });
  }
  function pointerMove(event) {
    if (!webParagraphSuggestions.enabled) return;
    if (!event.isTrusted || stopped || !host) return;
    if (event.composedPath().includes(host) || event.composedPath().includes(anchorHost)) { clearTimeout(leaveTimer); return; }
    pointerPosition = { x: event.clientX, y: event.clientY };
    if (event.buttons || hasSelection()) { clearTimeout(hoverTimer); return; }
    const candidate = proposedCandidate(event.target);
    if (candidate === pendingCandidate) return;
    clearTimers();
    candidateObserver?.disconnect();
    pendingCandidate = candidate;
    if (candidate !== dismissedCandidate) dismissedCandidate = null;
    if (!candidate) {
      if (excluded(event.target) || elementOf(event.target)?.closest(CONTROLS)) hide();
      else leaveTimer = setTimeout(() => { if (document.activeElement !== host) hide(); }, HOVER_MS);
      return;
    }
    if (candidate === dismissedCandidate) return;
    if (current?.candidate === candidate) return;
    observeCandidate(candidate);
    scheduleProposal(candidate);
  }
  function escape(event) {
    if (!event.isTrusted) return;
    if (event.key === 'Escape' && sourceAnchor?.popupIndex !== null && sourceAnchor?.popupIndex !== undefined) {
      event.preventDefault(); event.stopPropagation(); closePopup(true); return;
    }
    if (event.key === 'Tab' && !event.shiftKey && current?.kind === 'selection' && document.activeElement !== host) {
      event.preventDefault();
      button.focus({ preventScroll: true });
      return;
    }
    if (event.key !== 'Escape') return;
    if (current?.kind === 'selection') dismissedSelection = current;
    if (current?.kind === 'hover') dismissedCandidate = current.candidate;
    clearTimers();
    candidateObserver?.disconnect();
    hide();
  }
  function reposition() {
    scheduleAnchorRender();
    clearTimers();
    candidateObserver?.disconnect();
    pendingCandidate = null;
    if (current?.kind === 'selection' || hasSelection()) refreshSelection();
    else {
      hide();
      if (!webParagraphSuggestions.enabled || !pointerPosition) return;
      const candidate = proposedCandidate(document.elementFromPoint(pointerPosition.x, pointerPosition.y));
      if (!candidate || candidate === dismissedCandidate) return;
      pendingCandidate = candidate;
      observeCandidate(candidate);
      scheduleProposal(candidate);
    }
  }

  // A local snapshot pins exact DOM nodes and UTF-16 boundaries. Never search
  // for the same words elsewhere: replacement nodes mean this anchor is stale.
  function anchorSegments(range, text) {
    if (range.toString() !== text || range.startContainer.getRootNode() !== document || range.endContainer.getRootNode() !== document) return null;
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = range.startContainer;
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (range.startOffset < node.childNodes.length) node = node.childNodes[range.startOffset];
      else {
        walker.currentNode = node;
        node = walker.nextSibling();
        while (!node && walker.parentNode()) node = walker.nextSibling();
      }
    }
    if (node) walker.currentNode = node;
    const segments = [];
    let total = '', count = 0;
    while (node && range.intersectsNode(node)) {
      if (++count > MAX_NODES || excluded(node)) return null;
      if (node.nodeType === Node.TEXT_NODE) {
        if (!visible(elementOf(node))) return null;
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.data.length;
        if (end > start) {
          const part = node.data.slice(start,end);
          segments.push({node,parent:node.parentNode,start,end,offset:total.length,value:part});
          total += part;
        }
      }
      node = walker.nextNode();
    }
    return segments.length && total === text ? segments : null;
  }
  function clearAnchor() {
    anchorObserver?.disconnect(); anchorObserver = null;
    clearInterval(anchorTimer); anchorTimer = null;
    if (anchorFrame !== null) cancelAnimationFrame(anchorFrame);
    anchorFrame = null;
    anchorHost?.remove(); anchorHost = anchorLayer = anchorPaint = anchorNotes = null;
    anchorPopup = popupText = popupTitle = popupClose = popupDetails = null;
    sourceAnchor = null;
  }
  function anchorEvent(state, index) {
    if (!sourceAnchor) return;
    const message = {type:'bw:anchor-source-event',id:sourceAnchor.id,state};
    if (Number.isInteger(index)) message.index = index;
    try { Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => {}); } catch {}
  }
  function staleAnchor(state = 'stale') {
    if (!sourceAnchor || sourceAnchor.state !== 'anchored') return;
    sourceAnchor.state = state;
    anchorObserver?.disconnect(); anchorObserver = null;
    clearInterval(anchorTimer); anchorTimer = null;
    anchorHost?.remove(); anchorHost = anchorLayer = anchorPaint = anchorNotes = null;
    anchorPopup = popupText = popupTitle = popupClose = popupDetails = null;
    anchorEvent(state);
  }
  function anchorIntact(styleCache = new Map()) {
    const a = sourceAnchor;
    if (!a || a.state !== 'anchored') return false;
    try {
      if (a.range.startContainer !== a.startNode || a.range.endContainer !== a.endNode ||
          a.range.startOffset !== a.startOffset || a.range.endOffset !== a.endOffset ||
          !a.startNode.isConnected || !a.endNode.isConnected || a.range.toString() !== a.text ||
          a.segments.some(s => !s.node.isConnected || s.node.parentNode !== s.parent ||
            s.node.data.slice(s.start,s.end) !== s.value || excluded(s.node) || !visible(elementOf(s.node),styleCache))) {
        staleAnchor(); return false;
      }
      return true;
    } catch { staleAnchor(); return false; }
  }
  function excerptRange(start, end, quote) {
    if (!anchorIntact() || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 ||
        end <= start || end > sourceAnchor.text.length || sourceAnchor.text.slice(start,end) !== quote) return null;
    const first = sourceAnchor.segments.find(s => s.offset <= start && start < s.offset + s.value.length);
    const last = sourceAnchor.segments.find(s => s.offset < end && end <= s.offset + s.value.length);
    if (!first || !last) return null;
    const range = document.createRange();
    range.setStart(first.node,first.start + start - first.offset);
    range.setEnd(last.node,last.start + end - last.offset);
    return range.toString() === quote ? range : null;
  }
  function clippingChain(node, styleCache) {
    const chain = [];
    let parent=elementOf(node),depth=0;
    for (; parent && parent!==document.documentElement && depth<64; parent=parent.parentElement,depth+=1) {
      const style=styleCache.get(parent) || getComputedStyle(parent);
      styleCache.set(parent,style);
      // Rect overlays cannot faithfully follow rotated/transformed or masked
      // glyph areas. Preserve the source in the panel for these layouts.
      if ((style.transform && style.transform!=='none') || (style.clipPath && style.clipPath!=='none') ||
          (style.maskImage && style.maskImage!=='none')) return null;
      const modeX=style.overflowX || style.overflow || 'visible',modeY=style.overflowY || style.overflow || 'visible';
      const x=/^(auto|scroll|hidden|clip)$/u.test(modeX),y=/^(auto|scroll|hidden|clip)$/u.test(modeY);
      if (x || y) chain.push({node:parent,x,y,scrollX:x && modeX!=='clip',scrollY:y && modeY!=='clip'});
    }
    if (parent && parent!==document.documentElement) return null;
    if (parent===document.documentElement) {
      const style=styleCache.get(parent) || getComputedStyle(parent);
      styleCache.set(parent,style);
      if ((style.transform && style.transform!=='none') || (style.clipPath && style.clipPath!=='none') ||
          (style.maskImage && style.maskImage!=='none')) return null;
    }
    return chain;
  }
  function sharedClipChain(segments, styleCache = new Map()) {
    const chains=new Map();
    const read=node=>{const element=elementOf(node);if(!chains.has(element))chains.set(element,clippingChain(node,styleCache));return chains.get(element);};
    const first=read(segments[0].node);
    if (!first) return null;
    for (const segment of segments.slice(1)) {
      const next=read(segment.node);
      if (!next || next.length!==first.length || next.some((item,index)=>item.node!==first[index].node || item.x!==first[index].x || item.y!==first[index].y)) return null;
    }
    return first;
  }
  function clipBox(element) {
    const rect=element.getBoundingClientRect();
    const scaleX=element.offsetWidth ? rect.width/element.offsetWidth : 1;
    const scaleY=element.offsetHeight ? rect.height/element.offsetHeight : 1;
    const left=rect.left+(element.clientLeft||0)*scaleX, top=rect.top+(element.clientTop||0)*scaleY;
    return {left,top,right:left+(element.clientWidth??rect.width)*scaleX,bottom:top+(element.clientHeight??rect.height)*scaleY,scaleX,scaleY};
  }
  function clipViewport(segments, styleCache) {
    const clips=sharedClipChain(segments,styleCache);
    if (!clips) return null;
    let left=0,top=0,right=innerWidth,bottom=innerHeight;
    for (const clip of clips) {
      const box=clipBox(clip.node);
      if (clip.x) {left=Math.max(left,box.left);right=Math.min(right,box.right);}
      if (clip.y) {top=Math.max(top,box.top);bottom=Math.min(bottom,box.bottom);}
    }
    return {left,top,right,bottom};
  }
  function rangeRects(range, viewport) {
    const rects = Array.from(range.getClientRects());
    if (rects.length > 800 || !viewport) return null;
    const {left,top,right,bottom}=viewport;
    const seen=new Set(), result=[];
    for (const rect of rects) {
      const l=Math.max(left,rect.left),t=Math.max(top,rect.top),r=Math.min(right,rect.right),b=Math.min(bottom,rect.bottom);
      if (r<=l || b<=t) continue;
      const key=[l,t,r,b].join(',');if(seen.has(key))continue;seen.add(key);
      result.push({left:l,top:t,right:r,bottom:b,width:r-l,height:b-t});
    }
    return result;
  }
  function revealRange(range) {
    // Move the exact citation rect into each bounded clipping viewport. Scrolling
    // the paragraph alone can leave a later citation outside a nested scroller.
    const clips=sharedClipChain(sourceAnchor.segments);
    if (!clips) return false;
    function adjustment(rect,box) {
      return {left:rect.left<box.left || rect.right>box.right ? rect.left-box.left : 0,
        top:rect.top<box.top || rect.bottom>box.bottom ? rect.top-box.top-Math.max(0,(box.bottom-box.top-rect.height)/2) : 0};
    }
    for(const clip of clips) {
      const rect=range.getBoundingClientRect(),box=clipBox(clip.node),delta=adjustment(rect,box);
      if((clip.x&&delta.left&&!clip.scrollX)||(clip.y&&delta.top&&!clip.scrollY))return false;
      if(clip.x&&delta.left)clip.node.scrollLeft+=delta.left/(box.scaleX||1);
      if(clip.y&&delta.top)clip.node.scrollTop+=delta.top/(box.scaleY||1);
    }
    const delta=adjustment(range.getBoundingClientRect(),{left:8,top:64,right:innerWidth-8,bottom:innerHeight-56});
    if(delta.left||delta.top)window.scrollBy({left:delta.left,top:delta.top,behavior:'instant'});
    return true;
  }
  function scheduleAnchorRender() {
    if (!sourceAnchor || sourceAnchor.state !== 'anchored' || anchorFrame !== null) return;
    anchorFrame = requestAnimationFrame(() => { anchorFrame = null; renderAnchor(); });
  }
  function focusAnchor(range, index, scroll) {
    if (!anchorIntact()) return;
    sourceAnchor.focusRange = range;
    sourceAnchor.focusIndex = Number.isInteger(index) ? index : null;
    if (scroll && !revealRange(range)) { staleAnchor('unavailable'); return; }
    renderAnchor();
  }
  function closePopup(restoreFocus = false) {
    const index = sourceAnchor?.popupIndex;
    if (sourceAnchor) sourceAnchor.popupIndex = null;
    if (anchorPopup) anchorPopup.hidden = true;
    for (const note of sourceAnchor?.notes.values() || []) note.setAttribute('aria-expanded','false');
    if (restoreFocus) sourceAnchor?.notes.get(index)?.focus?.({preventScroll:true});
  }
  function openPopup(item, moveFocus = true) {
    if (!anchorIntact() || !anchorPopup || typeof item.note !== 'string' || !item.note.trim()) return false;
    sourceAnchor.popupIndex = item.index;
    const ru = (sourceAnchor.language || language) === 'ru';
    popupTitle.textContent = ru ? 'beforeword · пометка ИИ' : 'beforeword · AI note';
    // Model text is always an inert text node inside a separate shadow surface.
    // It is neither inserted into the original writing nor parsed as markup.
    popupText.textContent = item.note;
    popupClose.setAttribute('aria-label',ru ? 'Закрыть пометку' : 'Close note');
    popupDetails.textContent = ru ? 'Подробнее в панели' : 'Details in panel';
    anchorPopup.lang = ru ? 'ru' : 'en';
    renderPopup();
    if (moveFocus && !anchorPopup.hidden) popupClose.focus?.({preventScroll:true});
    return !anchorPopup.hidden;
  }
  function renderPopup(viewport) {
    if (!anchorPopup || !sourceAnchor || sourceAnchor.popupIndex === null) return;
    const item = sourceAnchor.items.find(entry => entry.index === sourceAnchor.popupIndex);
    const rects = item ? rangeRects(item.range,viewport || clipViewport(sourceAnchor.segments,new Map())) : null;
    if (!rects?.length) { closePopup(false); return; }
    const target = rects.at(-1), edge = 8, gap = 10;
    const width = Math.max(0,Math.min(360,innerWidth-edge*2));
    if (width < 160 || innerHeight < 120) { closePopup(false); return; }
    anchorPopup.style.width = `${width}px`;
    anchorPopup.style.maxHeight = `${Math.max(0,Math.min(360,innerHeight-edge*2))}px`;
    anchorPopup.hidden = false;
    const height = Math.min(anchorPopup.getBoundingClientRect().height,innerHeight-edge*2);
    const left = Math.max(edge,Math.min(innerWidth-edge-width,target.left));
    const below = target.bottom+gap;
    const above = rects[0].top-gap-height;
    const top = below+height <= innerHeight-edge ? below : above >= edge ? above : Math.max(edge,Math.min(innerHeight-edge-height,below));
    anchorPopup.style.left = `${left}px`; anchorPopup.style.top = `${top}px`;
    for (const [index,note] of sourceAnchor.notes) note.setAttribute('aria-expanded',String(index===item.index));
  }
  function renderAnchor() {
    // Style and clipping reads are shared within this pass only. Nothing is
    // cached across a page mutation, layout tick, scroll or resize.
    const styleCache=new Map();
    if (!anchorIntact(styleCache) || !anchorLayer) return;
    const a = sourceAnchor;
    const viewport=clipViewport(a.segments,styleCache);
    const rects = rangeRects(a.range,viewport);
    const active = a.focusRange ? rangeRects(a.focusRange,viewport) : [];
    if (!rects || !active) { staleAnchor('unavailable'); return; }
    anchorPaint.replaceChildren();
    for (const [set,cls] of [[rects,'mark'],[active,'mark active']]) {
      for (const rect of set) {
        const mark = document.createElement('span');
        mark.className = cls;
        mark.setAttribute('aria-hidden','true');
        mark.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`;
        anchorPaint.append(mark);
      }
    }
    if (isPinnedSnapshot(current)) hide();
    const items = a.items.concat({index:-1,range:a.range});
    const placement = rects.length ? railPlacement(a,items.length,viewport,styleCache) : null;
    anchorNotes.hidden = !placement;
    if (placement) {
      anchorNotes.style.left = `${placement.left}px`;
      anchorNotes.style.top = `${placement.top}px`;
      anchorNotes.style.flexDirection = placement.vertical ? 'column' : 'row';
    }
    const used = new Set(items.map(item => item.index));
    for (const item of items) {
      let note = a.notes.get(item.index);
      if (!note) {
        note = document.createElement('button');
        a.notes.set(item.index,note);
        note.className = 'note'; note.type = 'button';
        note.textContent = item.index < 0 ? '×' : String(item.index + 1);
        note.addEventListener('pointerdown',event => { if (event.isTrusted) { event.preventDefault(); event.stopPropagation(); } });
        note.addEventListener('click',event => {
          if (!event.isTrusted || !anchorIntact()) return;
          event.preventDefault(); event.stopPropagation();
          if (item.index < 0) { staleAnchor('unavailable'); return; }
          const currentItem = sourceAnchor.items.find(entry => entry.index === item.index);
          if (!currentItem) return;
          focusAnchor(currentItem.range,item.index,true);
          if (sourceAnchor?.state === 'anchored' && !openPopup(currentItem)) anchorEvent('anchored',item.index);
        });
        if (item.index < 0) anchorNotes.append(note);
        else anchorNotes.insertBefore(note,a.notes.get(-1) || null);
      }
      note.hidden = !placement;
      const label = item.index < 0 ? (language === 'ru' ? 'Снять подсветку beforeword' : 'Remove beforeword highlight') :
        (a.language || language) === 'ru' ? `Открыть пометку ${item.index + 1} beforeword` : `Open beforeword note ${item.index + 1}`;
      note.setAttribute('aria-label',label); note.title = label;
      note.setAttribute('aria-pressed',String(a.focusIndex === item.index));
      if (item.index >= 0 && item.note) { note.setAttribute('aria-haspopup','dialog'); note.setAttribute('aria-controls','beforeword-page-note'); }
    }
    for (const [index,note] of a.notes) note.hidden = !placement || !used.has(index);
    renderPopup(viewport);
  }
  function intersectsRect(a,b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }
  function railPlacement(anchor,count,viewport,styleCache) {
    // The rail occupies an empty margin, never a sentence ending. Geometry
    // checks visit bounded siblings of the source's ancestor chain only; no
    // page-wide selector, text extraction or relocation of source nodes.
    let sourceElement = elementOf(anchor.range.commonAncestorContainer);
    if (!sourceElement) return null;
    sourceElement = sourceElement.closest?.(BLOCKS) || sourceElement;
    let blockDepth = 0;
    while (sourceElement.parentElement && blockDepth < 64) {
      const style = styleCache.get(sourceElement) || getComputedStyle(sourceElement);
      styleCache.set(sourceElement,style);
      if (!/^inline/u.test(style.display) && style.display !== 'contents') break;
      sourceElement = sourceElement.parentElement; blockDepth += 1;
    }
    if (blockDepth === 64) return null;
    const bounds = sourceElement.getBoundingClientRect();
    if (!(bounds.width > 0 && bounds.height > 0)) return null;
    const obstacles = [bounds];
    let examined = 0, depth = 0, branch = sourceElement;
    for (let parent = branch.parentElement; parent && depth < 64; branch = parent,parent = parent.parentElement,depth += 1) {
      for (const sibling of parent.childNodes) {
        if (sibling === branch || sibling === host || sibling === anchorHost) continue;
        if (++examined > MAX_NODES) return null;
        let rects;
        if (sibling.nodeType === Node.ELEMENT_NODE) rects = sibling.getClientRects();
        else if (sibling.nodeType === Node.TEXT_NODE) {
          const range = document.createRange(); range.selectNodeContents(sibling); rects = range.getClientRects();
        } else continue;
        for (const rect of rects) {
          if (rect.width > 0 && rect.height > 0) obstacles.push(rect);
          if (obstacles.length > 800) return null;
        }
      }
    }
    if (branch.parentElement) return null;
    const cell = 44, gap = 8, edge = 8, border = 2;
    const narrow = cell + border, long = 24 + count * cell + border;
    const area = {left:Math.max(edge,viewport.left+edge),top:Math.max(edge,viewport.top+edge),
      right:Math.min(innerWidth-edge,viewport.right-edge),bottom:Math.min(innerHeight-edge,viewport.bottom-edge)};
    const clamp = (value,lo,hi) => Math.max(lo,Math.min(hi,value));
    const y = clamp(bounds.top,area.top,area.bottom-long);
    const x = clamp(bounds.left,area.left,area.right-long);
    const candidates = [
      {left:bounds.right+gap,top:y,width:narrow,height:long,vertical:true},
      {left:bounds.left-gap-narrow,top:y,width:narrow,height:long,vertical:true},
      {left:x,top:bounds.top-gap-narrow,width:long,height:narrow,vertical:false},
      {left:x,top:bounds.bottom+gap,width:long,height:narrow,vertical:false},
    ];
    for (const candidate of candidates) {
      candidate.right=candidate.left+candidate.width; candidate.bottom=candidate.top+candidate.height;
      if (candidate.left<area.left || candidate.top<area.top || candidate.right>area.right || candidate.bottom>area.bottom) continue;
      const padded={left:candidate.left-3,top:candidate.top-3,right:candidate.right+3,bottom:candidate.bottom+3};
      if (!obstacles.some(rect => intersectsRect(padded,rect))) return candidate;
    }
    // The panel retains citation links and close controls when this page has
    // no free margin. Never put a badge over writing to force a page control.
    return null;
  }

  function freezeAnchor(snapshot) {
    clearAnchor();
    try {
      let range;
      if (snapshot.kind === 'selection') {
        const selection = window.getSelection();
        if (selection.rangeCount !== 1) return null;
        range = selection.getRangeAt(0).cloneRange();
      } else {
        range = document.createRange(); range.selectNodeContents(snapshot.candidate);
      }
      const segments = anchorSegments(range,snapshot.text);
      if (!segments || !sharedClipChain(segments)) return null;
      sourceAnchor = {id:crypto.randomUUID(),text:snapshot.text,state:'anchored',range,segments,items:[],notes:new Map(),popupIndex:null,language,reportRevision:-1,
        startNode:range.startContainer,endNode:range.endContainer,startOffset:range.startOffset,endOffset:range.endOffset};
      anchorHost = document.createElement('div');
      anchorHost.setAttribute('data-beforeword-anchor','');
      anchorHost.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;width:0!important;height:0!important;overflow:visible!important;z-index:2147483646!important;pointer-events:none!important;';
      const shadow = anchorHost.attachShadow({mode:'closed'});
      const style = document.createElement('style');
      style.textContent = ':host{color-scheme:light}.mark{position:fixed;pointer-events:none;background:#b49a5738;border-bottom:1px solid #ad914c88;border-radius:2px;box-sizing:border-box}.active{background:#b49a5730;border-bottom:3px solid #ae9250}.rail{position:fixed;display:flex;box-sizing:border-box;border:1px solid #948b75;border-radius:10px;background:#f5f1e8;box-shadow:0 2px 7px #0002;pointer-events:auto}.rail[hidden],.note[hidden]{display:none}.rail-brand{display:flex;align-items:center;justify-content:center;flex:0 0 24px;min-width:0;min-height:0;color:#73664c;font:600 12px/1 system-ui,sans-serif}.note{all:initial;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:9px;color:#181815;font:600 12px/1 system-ui,sans-serif;cursor:pointer;pointer-events:auto;touch-action:manipulation}.note:hover,.note[aria-pressed="true"]{background:#e6dcc5}.note:focus-visible{outline:3px solid #181815;outline-offset:-3px}@media(forced-colors:active){.mark{background:transparent;outline:1px solid Highlight}.active{outline:2px solid Highlight}.rail{background:ButtonFace;border-color:ButtonText;box-shadow:none}.note,.rail-brand{color:ButtonText}.note:focus-visible{outline-color:Highlight}}';
      anchorLayer = document.createElement('div');
      anchorPaint = document.createElement('div'); anchorNotes = document.createElement('div');
      anchorNotes.className = 'rail'; anchorNotes.setAttribute('role','group');
      anchorNotes.setAttribute('aria-label',language === 'ru' ? 'beforeword · пункты разбора' : 'beforeword · reading links');
      const railBrand = document.createElement('span'); railBrand.className = 'rail-brand';
      railBrand.textContent = ''; railBrand.setAttribute('aria-hidden','true'); anchorNotes.append(railBrand);
      anchorLayer.append(anchorPaint,anchorNotes);
      const popupStyle = document.createElement('style');
      popupStyle.textContent = '.popup{position:fixed;z-index:1;box-sizing:border-box;overflow:auto;overscroll-behavior:contain;padding:14px 16px 10px;border:1px solid #948b75;border-radius:12px;background:#f5f1e8;color:#181815;box-shadow:0 5px 24px #0003;pointer-events:auto;font:16px/1.5 system-ui,sans-serif;text-align:start;overflow-wrap:anywhere}.popup[hidden]{display:none}.popup-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-6px -8px 2px 0}.popup-title{font-size:12px;font-weight:600;color:#655a45}.popup-close,.popup-details{all:initial;box-sizing:border-box;font:14px/1.4 system-ui,sans-serif;color:inherit;cursor:pointer;touch-action:manipulation;min-height:44px}.popup-close{display:flex;align-items:center;justify-content:center;min-width:44px;border-radius:8px;font-size:22px}.popup-details{display:block;margin-top:6px;text-decoration:underline;text-underline-offset:3px}.popup-close:hover,.popup-details:hover{background:#e6dcc5}.popup-close:focus-visible,.popup-details:focus-visible{outline:3px solid #73664c;outline-offset:1px}.popup-text{margin:0;white-space:pre-wrap}@media(prefers-color-scheme:dark){.popup{background:#20211d;color:#f2f1e9;border-color:#827b68}.popup-title{color:#c9c1ad}.popup-close:hover,.popup-details:hover{background:#34352e}}@media(forced-colors:active){.popup{background:Canvas;color:CanvasText;border-color:CanvasText;box-shadow:none}.popup-title{color:CanvasText}.popup-close:focus-visible,.popup-details:focus-visible{outline-color:Highlight}}';
      anchorPopup = document.createElement('div'); anchorPopup.id = 'beforeword-page-note'; anchorPopup.className = 'popup'; anchorPopup.hidden = true;
      anchorPopup.setAttribute('role','dialog'); anchorPopup.setAttribute('aria-modal','false'); anchorPopup.setAttribute('aria-labelledby','beforeword-page-note-title');
      const popupHead = document.createElement('div'); popupHead.className = 'popup-head';
      popupTitle = document.createElement('span'); popupTitle.id = 'beforeword-page-note-title'; popupTitle.className = 'popup-title';
      popupClose = document.createElement('button'); popupClose.type = 'button'; popupClose.className = 'popup-close'; popupClose.textContent = '×';
      popupClose.addEventListener('click',event => { if (event.isTrusted) { event.preventDefault(); event.stopPropagation(); closePopup(true); } });
      popupText = document.createElement('p'); popupText.className = 'popup-text';
      popupDetails = document.createElement('button'); popupDetails.type = 'button'; popupDetails.className = 'popup-details';
      popupDetails.addEventListener('click',event => {
        if (!event.isTrusted || !anchorIntact()) return;
        event.preventDefault(); event.stopPropagation(); const index = sourceAnchor.popupIndex; closePopup(false);
        if (Number.isInteger(index)) anchorEvent('anchored',index);
      });
      popupHead.append(popupTitle,popupClose); anchorPopup.append(popupHead,popupText,popupDetails); anchorLayer.append(anchorPopup);
      shadow.append(popupStyle);
      shadow.append(style,anchorLayer); document.documentElement.append(anchorHost);
      anchorObserver = new MutationObserver(records => {
        if (!sourceAnchor || sourceAnchor.state !== 'anchored') return;
        if (records.some(record => record.type === 'characterData' && sourceAnchor.segments.some(s => s.node === record.target))) { staleAnchor(); return; }
        if (anchorIntact()) scheduleAnchorRender();
      });
      const observed = new Set();
      for (const segment of segments) {
        anchorObserver.observe(segment.node,{characterData:true});
        for (let parent = segment.parent, depth = 0; parent && depth < 64; parent = parent.parentNode,depth += 1) {
          if (observed.has(parent)) break;
          observed.add(parent);
          anchorObserver.observe(parent,{childList:true,attributes:true,attributeFilter:['hidden','style','class','contenteditable','role','inert']});
        }
      }
      // Bounded geometry sampling handles layout shifts and transforms without
      // observing or scanning unrelated page text.
      anchorTimer = setInterval(() => { if (document.visibilityState !== 'hidden') scheduleAnchorRender(); },500);
      renderAnchor();
      return sourceAnchor?.state === 'anchored' ? {id:sourceAnchor.id} : null;
    } catch { clearAnchor(); return null; }
  }
  function handleAnchorMessage(message) {
    const a = sourceAnchor;
    if (!a || message.anchor?.id !== a.id || message.anchor?.origin !== location.origin || message.text !== a.text) return {ok:true,state:'unavailable'};
    if (message.type === 'bw:anchor-clear') { clearAnchor(); return {ok:true,state:'unavailable'}; }
    if (!anchorIntact()) return {ok:true,state:a.state};
    if (message.type === 'bw:anchor-report') {
      if (!Array.isArray(message.items) || message.items.length > 5) return {ok:true,state:'unavailable'};
      if (message.language !== undefined && !['ru','en'].includes(message.language)) return {ok:true,state:'unavailable'};
      if (message.reportRevision !== undefined && (!Number.isSafeInteger(message.reportRevision) || message.reportRevision < 0)) return {ok:true,state:'unavailable'};
      // Analysis A may finish after a newer result, section change or empty
      // report. An old delivery must never resurrect the retired page notes.
      if ((message.reportRevision === undefined && a.reportRevision >= 0) ||
          (message.reportRevision !== undefined && message.reportRevision <= a.reportRevision)) return {ok:true,state:a.state};
      if (message.items.some(item => !item || (item.note !== undefined && (typeof item.note !== 'string' || !item.note.trim() || item.note.length > 800)))) return {ok:true,state:'unavailable'};
      const items = message.items.map((item,index) => ({...item,range:item.index === index ? excerptRange(item.start,item.end,item.quote) : null}));
      if (items.some(item => !item.range)) { staleAnchor('unavailable'); return {ok:true,state:'unavailable'}; }
      closePopup(false); a.language = message.language || language;
      if (message.reportRevision !== undefined) a.reportRevision = message.reportRevision;
      a.items = items; a.focusRange = null; a.focusIndex = null; renderAnchor();
    } else if (message.type === 'bw:anchor-focus') {
      let range, index;
      if (message.start !== undefined) {
        range = excerptRange(message.start,message.end,message.quote);
        const item = a.items.find(item => item.index === message.index && item.start === message.start && item.end === message.end);
        if (item) index = item.index;
      }
      else if (message.index !== undefined) { index = message.index; range = a.items.find(item => item.index === index)?.range; }
      else range = a.range;
      if (!range) return {ok:true,state:'unavailable'};
      focusAnchor(range,index,true);
      if (Number.isInteger(index)) { const item = a.items.find(entry => entry.index === index); if (item) openPopup(item,false); }
    }
    return {ok:true,state:a.state};
  }

  function activate(event) {
    if (!event.isTrusted || stopped || !current) return;
    event.preventDefault();
    event.stopPropagation();
    const snapshot = current;
    // A changed selection or changed proposed block requires a fresh preview.
    const latest = snapshot.kind === 'selection' ? ordinarySelection() : blockSnapshot(snapshot.candidate);
    if (!latest || (snapshot.kind === 'selection' ? !sameSelection(snapshot, latest) : latest.text !== snapshot.text)) {
      hide(); return;
    }
    const anchor = freezeAnchor(latest);
    try {
      const delivery = chrome.runtime.sendMessage({ type: 'bw:widget-capture', selection: { text: snapshot.text, origin: location.origin, ...(anchor ? {sourceAnchor:anchor} : {}) } });
      Promise.resolve(delivery).then(result => {
        if (!result?.ok && sourceAnchor?.id === anchor?.id) clearAnchor();
        if (result?.error === 'SITE_ACCESS_REQUIRED') stop();
      }, stop);
    } catch { stop(); return; }
    if (snapshot.kind === 'selection') dismissedSelection = snapshot;
    else dismissedCandidate = snapshot.candidate;
    candidateObserver?.disconnect();
    hide();
  }
  function createInterface() {
    host = document.createElement('div');
    host.setAttribute('data-beforeword-widget', '');
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;width:0!important;height:0!important;overflow:visible!important;z-index:2147483647!important;pointer-events:none!important;display:none!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ':host{color-scheme:light}*{box-sizing:border-box}.outline{position:fixed;pointer-events:none;border:1.5px solid #736e60;border-radius:5px;background:transparent;display:none}.action{all:initial;box-sizing:border-box;position:fixed;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1px solid #bdb7aa;border-radius:14px;background:#f5f1e8;color:#181815;box-shadow:0 3px 14px #18181521;cursor:pointer;pointer-events:auto;touch-action:manipulation}.action:hover{background:#ebe5d8}.action:focus-visible{outline:3px solid #181815;outline-offset:3px}.action svg{width:38px;height:17px;pointer-events:none}@media(prefers-color-scheme:dark){.action svg{filter:invert(1)}}@media(forced-colors:active){.action{border:1px solid ButtonText;background:ButtonFace;color:ButtonText;box-shadow:none}.outline{border-color:Highlight}.action:focus-visible{outline-color:Highlight}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}';
    outline = document.createElement('div');
    outline.className = 'outline';
    outline.setAttribute('aria-hidden', 'true');
    button = document.createElement('button');
    button.className = 'action';
    button.type = 'button';
    const label = language === 'ru' ? 'Разобрать в beforeword' : 'Analyze in beforeword';
    button.setAttribute('aria-label', label);
    button.title = label;
    const description = document.createElement('span');
    description.id = 'beforeword-action-description';
    description.hidden = true;
    description.textContent = language === 'ru' ? 'Открыть этот текст в beforeword. Отправка — отдельной кнопкой в панели.' : 'Open this text in beforeword. Send it using the separate panel button.';
    button.setAttribute('aria-describedby', description.id);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 525 113');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    // Exact approved full wordmark. Existing action label and behavior are unchanged.
    const wordmark = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    wordmark.setAttribute('href', '/model/assets/brand-1.4.1/wordmark-dark.svg');
    wordmark.setAttribute('width', '525');
    wordmark.setAttribute('height', '113');
    svg.append(wordmark);
    button.append(svg);
    shadow.append(style, outline, button, description);
    document.documentElement.append(host);
    listen(button, 'pointerdown', event => { if (event.isTrusted) { event.preventDefault(); event.stopPropagation(); } });
    listen(button, 'click', activate);
    listen(button, 'focus', () => clearTimeout(leaveTimer));
    listen(document, 'selectionchange', refreshSelection);
    listen(document, 'pointermove', pointerMove, { passive: true });
    listen(document, 'keyup', event => { if (event.isTrusted && event.key !== 'Escape') refreshSelection(); });
    listen(document, 'keydown', escape, true);
    listen(document, 'pointerup', event => { if (event.isTrusted && !event.composedPath().includes(host)) refreshSelection(); });
    listen(document, 'focusin', event => { if (excluded(event.target)) hide(); });
    listen(window, 'scroll', reposition, { passive: true, capture: true });
    listen(window, 'resize', reposition, { passive: true });
    listen(window, 'pagehide', () => { staleAnchor(); clearAnchor(); });
    listen(document, 'visibilitychange', scheduleAnchorRender);
    refreshSelection();
  }
  try {
    chrome.runtime.onMessage.addListener(onMessage);
    Promise.resolve(chrome.runtime.sendMessage({ type: 'bw:widget-ready' })).then(result => {
      if (stopped) return;
      if (!result?.ok) { stop(); return; }
      language = result.language === 'ru' ? 'ru' : 'en';
      createInterface();
    }, stop);
  } catch { stop(); }
})();

    document.dispatchEvent(new CustomEvent('beforeword:ready'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(globalThis);
