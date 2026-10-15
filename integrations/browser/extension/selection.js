'use strict';

// Installed only on a site the person enabled. This isolated-world script
// proposes a local snapshot; only a trusted button activation sends it.
(() => {
  const chrome = globalThis.browser || globalThis.chrome;
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
      if (!pointerPosition) return;
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
    popupText.replaceChildren();
    for (const part of item.note.split(/(\*\*[^\n*]+\*\*)/u)) {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const strong = document.createElement('strong'); strong.textContent = part.slice(2, -2); popupText.append(strong);
      } else popupText.append(document.createTextNode(part));
    }
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
      railBrand.textContent = 'b/'; railBrand.setAttribute('aria-hidden','true'); anchorNotes.append(railBrand);
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
    style.textContent = ':host{color-scheme:light}*{box-sizing:border-box}.outline{position:fixed;pointer-events:none;border:1.5px solid #736e60;border-radius:5px;background:transparent;display:none}.action{all:initial;box-sizing:border-box;position:fixed;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1px solid #bdb7aa;border-radius:14px;background:#f5f1e8;color:#181815;box-shadow:0 3px 14px #18181521;cursor:pointer;pointer-events:auto;touch-action:manipulation}.action:hover{background:#ebe5d8}.action:focus-visible{outline:3px solid #181815;outline-offset:3px}.action svg{width:27px;height:25px;pointer-events:none;fill:currentColor}@media(forced-colors:active){.action{border:1px solid ButtonText;background:ButtonFace;color:ButtonText;box-shadow:none}.outline{border-color:Highlight}.action:focus-visible{outline-color:Highlight}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}';
    outline = document.createElement('div');
    outline.className = 'outline';
    outline.setAttribute('aria-hidden', 'true');
    button = document.createElement('button');
    button.className = 'action';
    button.type = 'button';
    const label = language === 'ru' ? 'Открыть запись в beforeword' : 'Open writing in beforeword';
    button.setAttribute('aria-label', label);
    button.title = label;
    const description = document.createElement('span');
    description.id = 'beforeword-action-description';
    description.hidden = true;
    description.textContent = language === 'ru' ? 'Перенести точный текст в панель. Отправка модели — отдельной кнопкой.' : 'Bring the exact text into the panel. Sending it to a model is a separate action.';
    button.setAttribute('aria-describedby', description.id);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '194 239 908 762');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    // Exact vector paths from extension/assets/brand.svg, with no network load.
    const paths = [["M0 0 C8.19 0.23 16.38 1.51 24.49 2.63 C25.08 2.71 25.08 2.71 28.08 3.11 C31.3 3.55 34.52 3.99 37.73 4.44 C41.14 4.9 44.54 5.37 47.94 5.83 C54.39 6.71 60.84 7.59 67.29 8.47 C74.55 9.47 81.81 10.46 89.07 11.45 C97.97 12.66 106.86 13.88 115.76 15.09 C116.38 15.18 116.38 15.18 119.54 15.61 C121.95 15.94 124.37 16.27 126.79 16.61 C132.41 17.38 138.03 18.14 143.66 18.84 C144.18 18.91 144.18 18.91 146.79 19.24 C148.72 19.49 150.64 19.73 152.57 19.96 C154.72 20.24 156.86 20.61 159 21 C160.59 24.19 159.32 27.32 158.62 30.69 C158.54 31.09 158.54 31.09 158.14 33.13 C157.59 35.85 157.04 38.57 156.48 41.28 C156.09 43.23 155.7 45.18 155.31 47.12 C154.24 52.46 153.16 57.79 152.08 63.12 C150.93 68.8 149.78 74.48 148.64 80.16 C146.45 91.04 144.25 101.92 142.05 112.8 C139.39 125.95 136.74 139.09 134.09 152.24 C133.14 156.94 132.19 161.65 131.24 166.36 C131.01 167.52 130.78 168.69 130.53 169.89 C129.1 176.98 127.67 184.08 126.24 191.18 C119.59 224.11 112.98 257.05 106.39 290 C105.97 292.1 105.55 294.2 105.13 296.31 C105.03 296.83 105.03 296.83 104.51 299.43 C103.5 304.5 102.48 309.57 101.47 314.63 C101.28 315.61 101.08 316.58 100.88 317.58 C95.5 344.51 90.08 371.42 84.65 398.34 C83.84 402.35 83.03 406.36 82.23 410.37 C78.72 427.74 75.22 445.11 71.71 462.48 C70.83 466.85 69.95 471.22 69.07 475.58 C50.87 565.76 32.53 655.9 14 746 C4.43 746.13 -4.98 745.77 -14.53 745.01 C-15.92 744.9 -17.31 744.79 -18.7 744.69 C-22.43 744.4 -26.17 744.11 -29.9 743.81 C-33.83 743.5 -37.77 743.2 -41.7 742.9 C-49.14 742.32 -56.58 741.74 -64.02 741.16 C-72.45 740.5 -80.88 739.84 -89.31 739.19 C-101.77 738.23 -114.23 737.26 -126.68 736.28 C-128.65 736.13 -130.62 735.98 -132.59 735.82 C-140.06 735.24 -147.53 734.63 -155 734 C-154.37 727.53 -153.35 721.27 -152.02 714.92 C-151.82 713.94 -151.62 712.96 -151.41 711.96 C-150.74 708.7 -150.06 705.44 -149.38 702.19 C-148.9 699.84 -148.41 697.5 -147.93 695.16 C-146.75 689.44 -145.56 683.73 -144.37 678.01 C-143.4 673.31 -142.42 668.6 -141.45 663.9 C-129.21 604.84 -116.86 545.81 -104.47 486.78 C-102.59 477.81 -100.71 468.84 -98.83 459.87 C-80.02 370.1 -61.12 280.35 -32.09 145.32 C-29.19 131.91 -26.32 118.51 -23.45 105.1 C-21.59 96.37 -19.71 87.65 -17.84 78.93 C-17.24 76.1 -16.63 73.26 -16.02 70.43 C-14.01 61.04 -11.99 51.65 -9.97 42.26 C-9.05 38 -8.14 33.75 -7.22 29.49 C-6.37 25.51 -5.52 21.53 -4.66 17.55 C-4.34 16.07 -4.02 14.59 -3.7 13.11 C-3.27 11.08 -2.83 9.05 -2.39 7.02 C-2.15 5.87 -1.9 4.73 -1.65 3.55 C-1 1 -1 1 0 0 Z", "translate(934,247)"], ["M0 0 C71.94 0 143.88 0 218 0 C218 81.84 218 163.68 218 248 C290 247.88 290 247.88 312.53 247.82 C321.78 247.81 321.78 247.81 326.14 247.81 C329.12 247.81 332.1 247.8 335.07 247.79 C351.19 247.73 367.25 247.89 383.34 248.9 C384.61 248.98 385.88 249.06 387.19 249.14 C444.45 253.08 499.83 269.83 541 311 C541.55 311.5 542.1 312.01 542.67 312.53 C574.42 341.99 587.18 392.45 589 434 C589.19 441.73 589.17 449.47 589.17 457.21 C589.17 459.47 589.17 461.73 589.18 463.99 C589.18 468.71 589.19 473.43 589.19 478.15 C589.19 484.14 589.2 490.12 589.22 496.1 C589.23 500.77 589.23 505.43 589.23 510.1 C589.23 512.3 589.23 514.5 589.24 516.71 C589.43 574.58 576.02 629.46 535 672 C534.24 672.83 533.47 673.65 532.69 674.5 C494.37 714.83 435.06 732.18 381 735 C375.62 735.13 370.24 735.13 364.85 735.12 C363.27 735.12 361.69 735.12 360.11 735.12 C355.8 735.13 351.49 735.12 347.18 735.12 C342.45 735.11 337.72 735.11 332.99 735.11 C323.82 735.11 314.65 735.11 305.48 735.1 C294.86 735.1 284.25 735.1 273.64 735.09 C245.63 735.09 217.63 735.08 189.62 735.06 C127.05 735.04 64.47 735.02 0 735 C0 492.45 0 249.9 0 0 Z M218 383 C217.98 411.02 217.96 439.03 217.95 467.05 C217.94 480.05 217.94 493.06 217.92 506.07 C217.91 517.4 217.91 528.73 217.91 540.06 C217.9 546.07 217.9 552.07 217.89 558.08 C217.89 563.72 217.89 569.37 217.89 575.01 C217.89 577.09 217.88 579.17 217.88 581.25 C217.88 584.07 217.88 586.89 217.88 589.72 C217.88 590.55 217.87 591.38 217.87 592.24 C217.89 597.89 217.89 597.89 219 599 C220.97 599.1 222.93 599.14 224.9 599.15 C226.17 599.15 227.44 599.16 228.74 599.16 C230.14 599.17 231.54 599.17 232.94 599.17 C234.38 599.17 235.81 599.17 237.25 599.18 C240.28 599.18 243.31 599.19 246.34 599.19 C249.42 599.19 252.5 599.19 255.57 599.21 C313.68 599.46 313.68 599.46 333.75 580.81 C351.09 562.42 352.32 537.54 352.34 513.65 C352.34 511.59 352.35 509.53 352.36 507.46 C352.37 503.15 352.37 498.84 352.37 494.53 C352.37 489.06 352.4 483.6 352.43 478.13 C352.45 473.87 352.46 469.61 352.46 465.35 C352.46 463.34 352.47 461.32 352.48 459.31 C352.64 436.85 350.47 413.92 334.12 397.07 C322.88 386.53 307.78 382.81 292.7 382.89 C292.29 382.89 292.29 382.89 290.24 382.89 C287.58 382.89 284.92 382.89 282.26 382.9 C280.41 382.9 278.55 382.91 276.7 382.91 C271.84 382.91 266.98 382.92 262.11 382.93 C257.15 382.94 252.18 382.95 247.21 382.95 C237.47 382.96 227.74 382.98 218 383 Z", "translate(202,250)"]];
    for (const [data, transform] of paths) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', data);
      path.setAttribute('transform', transform);
      svg.append(path);
    }
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
