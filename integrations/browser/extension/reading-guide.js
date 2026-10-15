/* A local, prepared walkthrough. No provider, source or report state is used. */
(function (root) {
  'use strict';
  let sequence = 0;
  const COPY = {
    ru: {
      title:'От выделения к прочтению',steps:'Шаги',path:['Выделите текст','Нажмите значок справа','Разберите текст','Рассмотрите прочтение'],source:'Письменная форма',phrase:'д о в е р и е',context:'Выученная письменная форма остаётся написанным. Рядом добавлено короткое прочтение.',
      idle:'1. Выделите фразу или нажмите на неё.',selected:'2. Нажмите значок beforeword справа.',
      panel:'3. В открывшейся панели нажмите «Рассмотреть запись».',note:'4. Сопоставьте цитату и добавленное прочтение.',
      phraseLabel:'Выделить фразу «д о в е р и е»',open:'Открыть beforeword',analyze:'Рассмотреть запись',
      panelTitle:'Панель beforeword',panelHelp:'В панели появится выбранный текст.',result:'От записи к прочтению',
      fragmentLabel:'Фрагмент записи',direction:'Предложено читать как',additionLabel:'Добавлено этим пояснением',
      links:[
        {quote:'д о в е р и е',reading:'Разделённые пробелами буквы прочитаны как выученное слово «доверие».'}
      ],
      boundary:'Эти начертания не становятся доверием, когда слово прочитано.',placeholder:'Здесь появятся точная цитата и короткое прочтение рядом.',
      prepared:'Готовый пример · без запроса к ИИ',try:'Попробовать',replay:'Повторить показ',skip:'Показать результат',
      whole:'В этом примере разбирается вся фраза «д о в е р и е».',help:'Можно выделить мышью, нажать на фразу или использовать Enter.',
    },
    en: {
      title:'From selection to reading',steps:'Steps',path:['Select text','Tap beforeword on the right','Examine writing','Examine the reading'],source:'Written form',phrase:'t r u s t',context:'The learned written form remains writing. A short proposed reading is added beside it.',
      idle:'1. Select the phrase, or tap it.',selected:'2. Tap the beforeword symbol on the right.',
      panel:'3. In the panel that opens, choose “Examine writing”.',note:'4. Compare the excerpt and the added reading.',
      phraseLabel:'Select the phrase “t r u s t”',open:'Open beforeword',analyze:'Examine writing',
      panelTitle:'beforeword panel',panelHelp:'The selected text appears in the panel.',result:'From writing to a proposed reading',
      fragmentLabel:'Source fragment',direction:'Proposed reading',additionLabel:'Wording added here',
      links:[
        {quote:'t r u s t',reading:'The separated letters are read as the learned word “trust”.'}
      ],
      boundary:'These marks do not become trust when the word is read.',placeholder:'An exact excerpt and a short proposed reading will appear together.',
      prepared:'Prepared example · no AI request',try:'Try it',replay:'Replay',skip:'Show the result',
      whole:'This example uses the whole phrase “t r u s t”.',help:'Select with a mouse, tap the phrase, or press Enter.',
    }
  };
  function mount(container, options = {}) {
    if (!container || typeof container.replaceChildren !== 'function') return null;
    let language = options.language === 'ru' ? 'ru' : 'en';
    let stage = 'idle', visible = options.visible !== false, played = false, playing = false, destroyed = false;
    const timers = new Set(), listeners = [], uid = `bw-guide-${++sequence}`;
    const doc = container.ownerDocument || document;
    const requireAnalyze=options.requireAnalyze!==false;
    const media = typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const element = (tag, className, key) => {
      const value = doc.createElement(tag); if(className)value.className=className;
      if(key)value.dataset.guide=key;
      return value;
    };
    const box=element('section','bw-guide','root');box.classList.toggle('bw-guide--compact',Boolean(options.compact));
    const heading=element('p','bw-guide-title');
    const steps=element('p','bw-guide-step','status');steps.id=`${uid}-status`;steps.setAttribute('role','status');steps.setAttribute('aria-live','polite');steps.setAttribute('aria-atomic','true');
    const path=element('ol','bw-guide-path','steps');
    const pathItems=Array.from({length:requireAnalyze?4:3},()=>element('li','bw-guide-path-item'));path.append(...pathItems);
    const columns=element('div','bw-guide-columns');
    const source=element('div','bw-guide-source');
    const sourceLabel=element('p','bw-guide-label');
    const context=element('p','bw-guide-context');
    const row=element('div','bw-guide-row');
    const phrase=element('span','bw-guide-phrase','phrase');phrase.tabIndex=0;phrase.setAttribute('role','button');phrase.setAttribute('aria-describedby',steps.id);
    const action=element('button','bw-guide-open','open');action.type='button';
    const brand=element('img','bw-guide-brand');brand.src=options.brandSrc||'assets/brand.svg';brand.alt='';brand.width=28;brand.height=25;action.append(brand);
    const cursor=element('span','bw-guide-cursor');cursor.setAttribute('aria-hidden','true');cursor.innerHTML='<svg viewBox="0 0 28 32" width="25" height="29" focusable="false"><path d="M3 2 23 20 14 21 10 29Z" fill="currentColor" stroke="var(--bw-guide-paper)" stroke-width="2" stroke-linejoin="round"/></svg>';
    row.append(phrase,action,cursor);source.append(sourceLabel,row,context);
    const result=element('div','bw-guide-result','result');result.setAttribute('aria-live','off');
    const resultLabel=element('p','bw-guide-label');resultLabel.tabIndex=-1;
    const empty=element('p','bw-guide-placeholder');
    const panel=element('div','bw-guide-panel');
    const panelHelp=element('p','bw-guide-panel-help');
    const panelPhrase=element('p','bw-guide-panel-phrase');
    const analyze=element('button','bw-guide-analyze','analyze');analyze.type='button';
    panel.append(panelHelp,panelPhrase,analyze);
    const note=element('div','bw-guide-note');
    const links=element('div','bw-guide-links');
    const linkRows=Array.from({length:1},()=>{
      const card=element('section','bw-guide-link');
      const fragmentLabel=element('p','bw-guide-field-label');
      const quote=element('q','bw-guide-quote');
      const direction=element('p','bw-guide-direction');
      const added=element('div','bw-guide-added');
      const addedLabel=element('p','bw-guide-field-label');
      const reading=element('p','bw-guide-reading');
      added.append(addedLabel,reading);card.append(fragmentLabel,quote,direction,added);links.append(card);
      return {card,fragmentLabel,quote,direction,addedLabel,reading};
    });
    const boundary=element('strong','bw-guide-boundary');linkRows[0].reading.append(boundary);note.append(links);
    result.append(resultLabel,empty,panel,note);columns.append(source,result);
    const footer=element('div','bw-guide-footer');
    const prepared=element('p','bw-guide-prepared');
    const controls=element('div','bw-guide-controls');
    const tryButton=element('button','bw-guide-control','try');tryButton.type='button';
    const replay=element('button','bw-guide-control','replay');replay.type='button';
    const skip=element('button','bw-guide-control','skip');skip.type='button';
    controls.append(tryButton,replay,skip);footer.append(prepared,controls);box.append(heading,steps,path,columns,footer);container.replaceChildren(box);
    function listen(target,type,handler){target.addEventListener(type,handler);listeners.push(()=>target.removeEventListener(type,handler));}
    function clear(){for(const id of timers)root.clearTimeout(id);timers.clear();playing=false;box.classList.remove('bw-guide--playing','bw-guide--selecting','bw-guide--at-button','bw-guide--press-analyze');}
    function later(delay,callback){const id=root.setTimeout(()=>{timers.delete(id);if(!destroyed&&visible)callback();},delay);timers.add(id);}
    function render(extra='') {
      const c=COPY[language];box.lang=language;box.dataset.stage=stage;
      heading.textContent=c.title;path.setAttribute('aria-label',c.steps);
      const labels=requireAnalyze?c.path:[c.path[0],c.path[1],c.path[3]],current=stage==='idle'?0:stage==='selected'?1:stage==='panel'?2:pathItems.length-1;
      pathItems.forEach((item,index)=>{item.textContent=`${index+1}. ${labels[index]}`;if(index===current)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
      sourceLabel.textContent=c.source;context.textContent=c.context;if(phrase.textContent!==c.phrase)phrase.textContent=c.phrase;phrase.setAttribute('aria-label',c.phraseLabel);phrase.title=c.help;
      action.setAttribute('aria-label',c.open);action.title=c.open;action.disabled=stage==='idle';action.setAttribute('aria-hidden',String(stage==='idle'));
      phrase.setAttribute('aria-pressed',String(stage!=='idle'));
      const instruction=stage==='note'&&!requireAnalyze?c.note.replace('4.','3.'):c[stage];
      steps.textContent=extra?`${extra} ${instruction}`:instruction;
      resultLabel.textContent=stage==='panel'?c.panelTitle:c.result;empty.textContent=c.placeholder;empty.hidden=stage==='panel'||stage==='note';panel.hidden=stage!=='panel';note.hidden=stage!=='note';
      panelHelp.textContent=c.panelHelp;panelPhrase.textContent=c.phrase;analyze.textContent=c.analyze;
      linkRows.forEach((row,index)=>{
        const link=c.links[index];row.fragmentLabel.textContent=c.fragmentLabel;row.quote.textContent=link.quote;
        row.direction.textContent=c.direction;row.addedLabel.textContent=c.additionLabel;row.reading.replaceChildren(doc.createTextNode(link.reading+' '),boundary);
      });boundary.textContent=c.boundary;
      prepared.textContent=c.prepared;tryButton.textContent=c.try;replay.textContent=c.replay;skip.textContent=c.skip;skip.hidden=stage==='note';
    }
    function setStage(next,extra=''){stage=next;render(extra);}
    function finish(){if(destroyed)return;clear();played=true;setStage('note');}
    function play(){
      if(destroyed||!visible||doc.hidden)return;clear();played=true;
      if(media?.matches){setStage('note');return;}
      setStage('idle');playing=true;box.classList.add('bw-guide--playing');
      later(150,()=>box.classList.add('bw-guide--selecting'));
      later(1300,()=>{box.classList.remove('bw-guide--selecting');setStage('selected');});
      later(2200,()=>box.classList.add('bw-guide--at-button'));
      later(3100,()=>{setStage(requireAnalyze?'panel':'note');box.classList.remove('bw-guide--at-button');});
      later(3900,()=>box.classList.add('bw-guide--press-analyze'));
      later(4700,()=>{box.classList.remove('bw-guide--press-analyze');setStage('note');});
      later(6200,()=>{clear();});
    }
    function userAction(){if(playing)clear();box.classList.remove('bw-guide--at-button');played=true;}
    function selectPhrase(){
      if(!visible||destroyed)return;
      userAction();let partial=false;
      const selection=typeof root.getSelection==='function'?root.getSelection():null;
      if(selection&&!selection.isCollapsed&&phrase.contains(selection.anchorNode)&&phrase.contains(selection.focusNode))partial=selection.toString()!==COPY[language].phrase;
      setStage('selected',partial?COPY[language].whole:'');
    }
    listen(phrase,'click',selectPhrase);
    listen(phrase,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectPhrase();}});
    listen(phrase,'pointerup',event=>{if(event.pointerType==='mouse'){const selection=root.getSelection?.();if(selection&&!selection.isCollapsed&&phrase.contains(selection.anchorNode)&&phrase.contains(selection.focusNode))selectPhrase();}});
    listen(action,'click',()=>{if(!visible||destroyed||stage==='idle')return;userAction();setStage(requireAnalyze?'panel':'note');if(requireAnalyze)analyze.focus({preventScroll:true});});
    listen(analyze,'click',()=>{if(!visible||destroyed)return;userAction();setStage('note');resultLabel.focus({preventScroll:true});});
    listen(tryButton,'click',()=>{if(!visible||destroyed)return;userAction();setStage('idle');phrase.focus({preventScroll:true});});
    listen(replay,'click',play);listen(skip,'click',()=>{if(visible&&!destroyed){finish();resultLabel.focus({preventScroll:true});}});
    listen(box,'pointerdown',()=>{if(playing)userAction();});
    listen(box,'keydown',()=>{if(playing)userAction();});
    listen(doc,'visibilitychange',()=>{if(doc.hidden&&playing)finish();else if(!doc.hidden&&visible&&options.autoPlay&&!played)play();});
    listen(doc,'selectionchange',()=>{
      if(!visible||destroyed||doc.hidden)return;
      const selection=root.getSelection?.();
      if(selection&&!selection.isCollapsed&&phrase.contains(selection.anchorNode)&&phrase.contains(selection.focusNode))selectPhrase();
    });
    if(media?.addEventListener)listen(media,'change',event=>{if(event.matches)finish();});
    render();
    if(doc.hidden||media?.matches)setStage('note');
    if(options.autoPlay&&visible&&!doc.hidden)play();
    return Object.freeze({
      play,finish,
      setVisible(next){if(destroyed)return;visible=Boolean(next);if(!visible){if(playing)finish();}else if(options.autoPlay&&!played)play();},
      setLanguage(next){if(destroyed||!['ru','en'].includes(next)||next===language)return;clear();language=next;render();},
      destroy(){if(destroyed)return;clear();destroyed=true;for(const off of listeners)off();container.replaceChildren();}
    });
  }
  root.BeforewordGuide=Object.freeze({mount});
})(globalThis);
