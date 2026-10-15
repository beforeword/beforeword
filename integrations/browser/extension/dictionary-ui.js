/* Dictionary exploration is an explicit, non-generative operation. The source
 * is never rewritten and every definition remains attributed to its edition. */
(() => {
  'use strict';
  const WORD_LIMIT = 120, PATH_LIMIT = 32;
  const COPY = {
    en: {
      dictionary:'Open the dictionary',model:'Back to the notes',modes:'Additional tool',title:'Words explained with words.',purpose:'Choose a word. Read its dictionary definitions. Follow a word in a definition.',
      inputLabel:'Your text',entryGuide:'Paste text below. It stays here until you choose a word or request an AI reading.',placeholder:'Paste any text to explore its words.',
      open:'Explore the words',source:'Your writing · unchanged',sourceWords:'Words in the selected passage',anchoredChoose:'Open the passage words above, or look up a word or phrase below.',copy:'Copy text',copied:'Copied',copyFailed:'Could not copy. Select and copy the text.',
      choose:'Choose a word in the text, or look up a word or phrase below.',empty:'A dictionary explains a written word using other written words.',example:'Try an example',
      notice:'The chosen word is sent to Wiktionary. Your whole text stays here.',boundary:'A definition is writing too.',scope:'These are definitions from the selected dictionary. They do not show how you read the text or determine which sense applies.',
      term:'Word or phrase',edition:'Dictionary edition',auto:'Auto · Russian / English',ru:'Russian Wiktionary',en:'English Wiktionary',lookup:'Look up',looking:'Opening dictionary…',cancel:'Cancel',cancelled:'Lookup cancelled here.',editionChanged:'The pending lookup was cancelled. Choose “Look up” to use the new edition.',
      hint:'Select a phrase here explicitly. A Cyrillic letter selects the Russian edition in Auto mode; otherwise the English edition is used.',
      back:'Back',start:'New chain',path:'Your path',step:'Step',repeat:'Already visited at step {step}. This link returns to a previous dictionary entry.',
      limit:'This path contains 32 steps. Go back or start a new chain to continue.',missing:'No entry was found in this edition.',missingNote:'This does not mean the word has no meaning. Try a dictionary headword, another spelling, or the other edition.',
      unavailable:'The dictionary could not be reached.',unavailableNote:'Your text and the previous steps are unchanged. Try again.',unsupported:'This entry could not be displayed reliably.',unsupportedNote:'Open the dictionary source to inspect it. No definition has been invented or substituted.',retry:'Try again',invalid:'Enter a word or phrase of up to 120 characters.',
      query:'Chosen writing',lookedUp:'Dictionary lookup',redirectedTo:'Dictionary entry',transformation:'Lookup adjustments',definitions:'Definitions',sense:'Sense',formOf:'Form of',sourceLink:'Dictionary source',revision:'Revision',license:'License',
      follow:'Look up “{word}”',from:'From a definition of',keyboard:'Keyboard: Tab enters a passage, arrow keys move between words, Enter opens the selected word.',
      emptyDefinition:'This sense does not supply a displayed definition.',allSenses:'All extracted senses are shown. None has been selected for your text.',limitedSenses:'{shown} senses are shown; {omitted} more were omitted by the display limit. Open the dictionary source to see them.',trim:'Spaces at the beginning or end were removed for lookup.',lowercase:'A lowercase spelling was tried after the original spelling was not found.',redirect:'The dictionary redirected this spelling to another entry.',extraction:'Definition text is extracted from the displayed dictionary entry. HTML layout spacing is collapsed; examples, quotations and references are excluded. Open the source to see the complete entry.',clear:'Clear the chain',method:'About this dictionary view',methodText:'Definitions are downloaded only after a lookup and kept in this panel’s memory. The dictionary is edited by contributors; entries may be incomplete or ambiguous. Linked words are followed by their spelling, not by an automatically selected sense.'
    },
    ru: {
      dictionary:'Открыть словарь',model:'Вернуться к пометкам',modes:'Дополнительный инструмент',title:'Слова объясняются словами.',purpose:'Нажмите слово. Посмотрите словарные определения. Перейдите к слову в определении.',
      inputLabel:'Ваш текст',entryGuide:'Вставьте текст ниже. Он остаётся здесь, пока вы не выберете слово или не запросите разбор ИИ.',placeholder:'Вставьте любой текст, чтобы открыть его слова.',
      open:'Открыть слова',source:'Ваша запись · без изменений',sourceWords:'Слова исходного фрагмента',anchoredChoose:'Откройте слова фрагмента выше или найдите слово либо выражение ниже.',copy:'Скопировать текст',copied:'Скопировано',copyFailed:'Не удалось скопировать. Выделите и скопируйте текст.',
      choose:'Нажмите слово в тексте или найдите слово либо выражение ниже.',empty:'В словаре написанное слово объясняется другими написанными словами.',example:'Открыть пример',
      notice:'Выбранное слово отправится в Викисловарь. Текст целиком остаётся здесь.',boundary:'Определение — тоже написанный текст.',scope:'Это определения выбранного словаря. Они не показывают, как вы прочитали текст, и не определяют, какое значение подходит к нему.',
      term:'Слово или выражение',edition:'Словарная редакция',auto:'Авто · русский / английский',ru:'Русский Викисловарь',en:'Английский Викисловарь',lookup:'Найти',looking:'Открывается словарь…',cancel:'Отменить',cancelled:'Ожидание ответа отменено здесь.',editionChanged:'Ожидание ответа отменено. Нажмите «Найти», чтобы использовать новую редакцию.',
      hint:'Выражение нужно выбрать здесь явно. В режиме «Авто» кириллическая буква выбирает русскую редакцию; иначе используется английская.',
      back:'Назад',start:'Новая цепочка',path:'Ваш путь',step:'Шаг',repeat:'Уже открывалось на шаге {step}. Эта связь возвращает к прежней словарной статье.',
      limit:'В этом пути 32 шага. Вернитесь назад или начните новую цепочку.',missing:'В этой редакции статья не найдена.',missingNote:'Это не означает, что у слова нет значения. Попробуйте начальную форму, другое написание или другую редакцию.',
      unavailable:'Не удалось связаться со словарём.',unavailableNote:'Ваш текст и прежние шаги сохранены. Повторите запрос.',unsupported:'Эту статью не удалось отобразить надёжно.',unsupportedNote:'Откройте источник и проверьте статью. Определение не было придумано или подменено.',retry:'Повторить',invalid:'Введите слово или выражение длиной до 120 знаков.',
      query:'Выбранное написание',lookedUp:'Поиск в словаре',redirectedTo:'Словарная статья',transformation:'Изменения только для поиска',definitions:'Определения',sense:'Значение',formOf:'Форма слова',sourceLink:'Словарный источник',revision:'Редакция',license:'Лицензия',
      follow:'Открыть слово «{word}»',from:'Из определения слова',keyboard:'Клавиатура: Tab — к тексту, стрелки — между словами, Enter — открыть выбранное слово.',
      emptyDefinition:'Для этого значения определение не показано.',allSenses:'Показаны все извлечённые значения. Ни одно не выбрано за вас для этого текста.',limitedSenses:'Показано значений: {shown}; ещё {omitted} не показано из-за ограничения размера. Они доступны в словарном источнике.',trim:'Для поиска убраны пробелы в начале или конце.',lowercase:'После отсутствия исходного написания проверен вариант со строчными буквами.',redirect:'Словарь перенаправил это написание на другую статью.',extraction:'Текст определений извлечён из отображаемой словарной статьи. Пробелы HTML-вёрстки сведены к одному; примеры, цитаты и сноски исключены. Полная статья доступна в источнике.',clear:'Очистить цепочку',method:'Об этом режиме',methodText:'Определения загружаются только после запроса и хранятся в памяти этой панели. Словарь редактируют участники; статьи могут быть неполными или неоднозначными. Переход к другому слову выполняется по написанию, без автоматического выбора значения.'
    }
  };
  const node=(tag,className,text)=>{const value=document.createElement(tag);if(className)value.className=className;if(text!==undefined)value.textContent=text;return value;};
  const button=(className,text,action)=>{const value=node('button',className,text);value.type='button';if(action)value.addEventListener('click',action);return value;};
  const safeLink=(url,text)=>{try{const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))return node('span','',text);const link=node('a','',text);link.href=parsed.href;link.target='_blank';link.rel='noopener noreferrer';return link;}catch{return node('span','',text);}};
  const sameEntry=(a,b)=>Boolean(a?.status==='found'&&b?.status==='found'&&a.language===b.language&&a.source?.url&&a.source.url===b.source?.url);
  function mount(options={}) {
    const core=globalThis.BeforewordDictionary;
    let locale='en', mode='model', raw='', viewMode=false, anchored=false, edition='auto', sourceOpen=null;
    let path=[], pending=null, epoch=0, status='', statusTone='', draft='';
    const cache=new Map();
    const t=key=>COPY[locale][key]||key;
    const modes=node('div','dictionary-modes');modes.setAttribute('role','group');
    const dictionaryMode=button('dictionary-mode','',()=>setMode('dictionary'));
    const modelMode=button('dictionary-mode','',()=>setMode('model'));
    modes.append(dictionaryMode,modelMode);(document.getElementById('input-tools')||document.getElementById('editor')).after(modes);
    const root=node('section','dictionary-workspace');root.id='dictionary-workspace';root.setAttribute('aria-label','Dictionary');
    document.getElementById('editor').after(root);
    const notice=node('p','dictionary-send-notice');notice.id='dictionary-send-notice';
    const source=node('div','dictionary-source'),tools=node('div','dictionary-tools'),result=node('section','dictionary-result');
    result.id='dictionary-result';result.setAttribute('aria-label','Dictionary definitions');root.append(notice,source,tools,result);
    function words(text,language,via=null) {
      const passage=node('div','dictionary-writing');passage.dir='auto';
      const tokens=core?.tokenize?.(text)||[{text,isWord:false}],buttons=[];
      for(const token of tokens){
        if(!token.isWord){passage.append(document.createTextNode(token.text));continue;}
        const item=button('dictionary-word',token.text,()=>lookup(token.text,language,via));item.tabIndex=buttons.length?-1:0;
        item.setAttribute('aria-label',t('follow').replace('{word}',token.text));item.addEventListener('focus',()=>{for(const other of buttons)other.tabIndex=other===item?0:-1;});buttons.push(item);passage.append(item);
      }
      passage.addEventListener('keydown',event=>{const index=buttons.indexOf(document.activeElement);if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowRight'?1:-1)));buttons[next]?.focus();});
      return passage;
    }
    function chosenEdition(word,suggested) {return edition!=='auto'?edition:suggested||(/[\p{Script=Cyrillic}]/u.test(word)?'ru':'en');}
    function stop(){epoch++;pending?.abort();pending=null;}
    function resetPath(){stop();path=[];status='';statusTone='';renderResult();}
    function setMode(next){
      if(!['dictionary','model'].includes(next))return;
      const changed=next!==mode;mode=next;if(mode==='model')stop();
      if(changed)options.onModeChange?.(mode);
      render();
    }
    function renderSource(){
      source.replaceChildren();
      if(!viewMode){
        if(raw.length){source.append(button('primary dictionary-open',t('open'),()=>options.onPrepare?.()));}
        else{source.append(node('p','small-note',t('empty')),button('text-button',t('example'),()=>openExample('words')));}
        return;
      }
      const heading=node('div','dictionary-source-heading'),label=node('h2','',t('source'));
      const copy=button('text-button',t('copy'),async()=>{try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(raw);copy.textContent=t('copied');}catch{copy.textContent=t('copyFailed');}});
      heading.append(label,copy);
      if(raw.length>12000){source.append(heading,node('p','small-note',locale==='ru'?'Для большой записи введите нужное слово или выражение ниже. Исходный текст сохранён полностью.':'For a long text, enter a word or phrase below. Your full source writing is retained.'));}
      else if(anchored){const details=node('details','disclosure dictionary-source-details');details.open=sourceOpen===true;details.append(node('summary','',t('sourceWords')),heading,words(raw));details.addEventListener('toggle',()=>{sourceOpen=details.open;});source.append(details);}
      else source.append(heading,words(raw));
      source.append(node('p','dictionary-choose small-note',t(anchored?'anchoredChoose':'choose')));
    }
    function renderTools(){
      tools.replaceChildren();
      const form=node('form','dictionary-lookup');form.noValidate=true;
      const label=node('label','dictionary-term-label',t('term'));label.htmlFor='dictionary-term';
      const row=node('div','dictionary-lookup-row'),input=node('input','dictionary-term');input.id='dictionary-term';input.type='text';input.value=draft;input.maxLength=WORD_LIMIT;input.autocomplete='off';input.spellcheck=false;input.setAttribute('autocapitalize','off');input.setAttribute('aria-describedby','dictionary-send-notice');input.dir='auto';
      input.addEventListener('input',()=>{draft=input.value;});const submit=node('button','secondary dictionary-submit',t('lookup'));submit.type='submit';row.append(input,submit);
      const editionLabel=node('label','dictionary-edition-label',t('edition'));editionLabel.htmlFor='dictionary-edition';
      const select=node('select','dictionary-edition');select.id='dictionary-edition';for(const key of ['auto','ru','en']){const option=node('option','',t(key));option.value=key;select.append(option);}select.value=edition;select.addEventListener('change',()=>{edition=select.value;if(pending){stop();status=t('editionChanged');statusTone='';renderResult();}});
      form.append(label,row,editionLabel,select);form.addEventListener('submit',event=>{event.preventDefault();lookup(draft);});
      const about=node('details','disclosure dictionary-about'),summary=node('summary','',t('method')),body=node('div','disclosure-body');
      body.append(node('p','',t('methodText')),node('p','',t('extraction')),node('p','',t('hint')),node('p','',t('keyboard')));about.append(summary,body);tools.append(form,about);
    }
    function provenance(container,data){
      const info=data.source;if(!info)return;
      const block=node('div','dictionary-provenance');block.append(safeLink(info.url,info.name||t('sourceLink')));
      if(info.revision||info.snapshot){const revision=info.revision||(typeof info.snapshot==='object'?info.snapshot.revision||info.snapshot.revid||JSON.stringify(info.snapshot):info.snapshot);block.append(node('span','',`${t('revision')}: ${revision}`));}
      if(info.license)block.append(safeLink(info.licenseUrl,info.license));container.append(block);
    }
    function renderResult(){
      result.replaceChildren();result.setAttribute('aria-busy',String(Boolean(pending)));
      if(path.length){
        const nav=node('div','dictionary-navigation');const back=button('text-button',`← ${t('back')}`,()=>{stop();path.pop();status='';renderResult();});back.disabled=path.length<2;
        nav.append(back,node('span','dictionary-position',`${t('step')} ${path.length}`),button('text-button',t('start'),()=>{resetPath();document.getElementById('dictionary-term')?.focus();}));result.append(nav);
        const history=node('details','dictionary-path');const summary=node('summary','',t('path')),list=node('ol','');
        path.forEach((step,index)=>{const item=node('li','');item.append(button('text-button',step.word,()=>{stop();path=path.slice(0,index+1);status='';renderResult();}));list.append(item);});history.append(summary,list);result.append(history);
      }
      const announcement=node('p','dictionary-status',pending?t('looking'):status);announcement.id='dictionary-status';announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');announcement.dataset.tone=statusTone;result.append(announcement);
      if(pending){result.append(button('text-button',t('cancel'),()=>{stop();status=t('cancelled');statusTone='';renderResult();}));return;}
      const step=path.at(-1);if(!step)return;
      const heading=node('h2','dictionary-entry-title',step.word);heading.dir='auto';heading.tabIndex=-1;heading.id='dictionary-entry-title';result.append(heading);
      result.append(node('p','dictionary-result-edition small-note',t(step.language)));
      if(step.via)result.append(node('p','dictionary-from',`${t('from')} “${step.via.word}” · ${t('sense').toLowerCase()} ${step.via.sense}`));
      if(step.repeat!==undefined)result.append(node('p','dictionary-repeat',t('repeat').replace('{step}',String(step.repeat+1))));
      if(step.error){result.append(node('p','dictionary-error-title',t(step.error==='UNSUPPORTED'?'unsupported':'unavailable')),node('p','small-note',t(step.error==='UNSUPPORTED'?'unsupportedNote':'unavailableNote')));if(step.errorURL)result.append(safeLink(step.errorURL,t('sourceLink')));result.append(button('secondary',t('retry'),()=>lookup(step.word,step.language,step.via,true)));return;}
      const data=step.result;if(!data)return;
      if(data.lookup&&data.lookup!==data.query){result.append(node('p','dictionary-lookup-change',`${t('lookedUp')}: ${data.lookup}`));}
      const entryWords=[...new Set((data.entries||[]).map(entry=>entry.word).filter(word=>word&&word!==data.lookup))];if(entryWords.length)result.append(node('p','dictionary-lookup-change',`${t('redirectedTo')}: ${entryWords.join(', ')}`));
      if(data.transformations?.length){const details=node('details','dictionary-transformations');details.append(node('summary','',t('transformation')));const list=node('ul','');data.transformations.forEach(value=>list.append(node('li','',t(value==='source-redirect'?'redirect':value))));details.append(list);result.append(details);}
      if(data.status==='missing'){result.append(node('p','dictionary-error-title',t('missing')),node('p','small-note',t('missingNote')));provenance(result,data);return;}
      result.append(node('p','dictionary-boundary',t('boundary')),node('p','dictionary-all-senses small-note',data.truncation?t('limitedSenses').replace('{shown}',String(data.truncation.shownSenses)).replace('{omitted}',String(data.truncation.omittedSenses)):t('allSenses')));
      let senseNumber=0;
      for(const entry of data.entries||[]){
        const article=node('article','dictionary-entry');const entryHeading=node('h3','dictionary-entry-heading',entry.word||data.lookup||step.word);if(entry.pos)entryHeading.append(node('span','dictionary-pos',entry.pos));article.append(entryHeading);
        const list=node('ol','dictionary-senses');
        for(const sense of entry.senses||[]){
          senseNumber++;const senseIndex=senseNumber,item=node('li','dictionary-sense');item.value=senseNumber;
          const via={word:entry.word||step.word,sense:senseIndex,entryId:entry.id,senseId:sense.id};
          if(!sense.glosses?.length)item.append(node('p','small-note',t('emptyDefinition')));
          for(const gloss of sense.glosses||[])item.append(words(gloss,data.language||step.language,via));
          if(sense.formOf?.length){const form=node('p','dictionary-form-of',`${t('formOf')}: `);sense.formOf.forEach((word,index)=>{if(index)form.append(document.createTextNode(', '));form.append(button('dictionary-word',word,()=>lookup(word,data.language||step.language,via)));});item.append(form);}
          const sourceURL=sense.url||entry.url||data.source?.url;if(sourceURL){const source=node('p','dictionary-sense-source');source.append(safeLink(sourceURL,t('sourceLink')));item.append(source);}
          list.append(item);
        }
        article.append(list);result.append(article);
      }
      provenance(result,data);result.append(node('p','dictionary-scope small-note',t('scope')));
    }
    async function lookup(word,suggested,via=null,retry=false){
      const value=typeof word==='string'?word:'';
      if(!value.trim()||value.length>WORD_LIMIT){status=t('invalid');statusTone='error';renderResult();return;}
      if(!core?.lookup){status=t('unavailable');statusTone='error';renderResult();return;}
      if(!retry&&path.length>=PATH_LIMIT){status=t('limit');statusTone='error';renderResult();return;}
      const selected=chosenEdition(value,suggested);
      try{core.validate?.(value,selected);}catch{status=t('invalid');statusTone='error';renderResult();return;}
      stop();status='';statusTone='';draft=value;const input=document.getElementById('dictionary-term');if(input)input.value=value;
      const previous=path.findIndex(item=>item.word===value&&item.language===selected&&item.result);
      const step={word:value,language:selected,via};
      if(previous>=0){step.result=path[previous].result;if(step.result.status==='found')step.repeat=previous;if(retry)path[path.length-1]=step;else path.push(step);renderResult();result.scrollIntoView?.({behavior:'auto',block:'start'});document.getElementById('dictionary-entry-title')?.focus({preventScroll:true});return;}
      const cacheKey=`${selected}\u0000${value}`;
      if(cache.has(cacheKey)){step.result=cache.get(cacheKey);cache.delete(cacheKey);cache.set(cacheKey,step.result);const repeated=path.findIndex(item=>sameEntry(item.result,step.result));if(repeated>=0)step.repeat=repeated;if(retry)path[path.length-1]=step;else path.push(step);renderResult();result.scrollIntoView?.({behavior:'auto',block:'start'});document.getElementById('dictionary-entry-title')?.focus({preventScroll:true});return;}
      const controller=new AbortController(),request=++epoch;pending=controller;renderResult();result.scrollIntoView?.({behavior:'auto',block:'start'});
      try{
        const data=await core.lookup(value,selected,{signal:controller.signal});if(request!==epoch||controller.signal.aborted)return;
        step.result=data;cache.set(cacheKey,data);while(cache.size>32)cache.delete(cache.keys().next().value);const repeated=path.findIndex(item=>sameEntry(item.result,data));if(repeated>=0)step.repeat=repeated;
      }catch(error){if(request!==epoch||controller.signal.aborted||error?.name==='AbortError')return;step.error=error?.code==='UNSUPPORTED'?'UNSUPPORTED':'NETWORK';step.errorURL=error?.url||`https://${selected}.wiktionary.org/wiki/${encodeURIComponent(value)}`;}
      if(request!==epoch)return;pending=null;if(retry)path[path.length-1]=step;else path.push(step);renderResult();document.getElementById('dictionary-entry-title')?.focus({preventScroll:true});
    }
    function render(){
      document.documentElement.classList.toggle('dictionary-mode-active',mode==='dictionary');dictionaryMode.textContent=t('dictionary');modelMode.textContent=t('model');modes.setAttribute('aria-label',t('modes'));dictionaryMode.setAttribute('aria-pressed',String(mode==='dictionary'));modelMode.setAttribute('aria-pressed',String(mode==='model'));dictionaryMode.hidden=mode==='dictionary';modelMode.hidden=mode==='model';root.hidden=mode!=='dictionary';
      if(mode!=='dictionary')return;
      notice.textContent=t('notice');document.getElementById('data-send-notice').textContent=t('notice');
      document.getElementById('title').textContent=t('title');document.querySelector('.purpose').textContent=t('purpose');
      document.querySelector('#empty-entry .section-label').textContent=t('inputLabel');document.getElementById('entry-guide').textContent=t('entryGuide');document.getElementById('source').placeholder=t('placeholder');
      root.setAttribute('aria-label',t('dictionary'));result.setAttribute('aria-label',t('definitions'));renderSource();renderTools();renderResult();
    }
    function update(state={}){
      const nextRaw=typeof state.raw==='string'?state.raw:raw;
      const nextLocale=['ru','en'].includes(state.language)?state.language:locale;
      const changed=nextRaw!==raw, rerender=changed||nextLocale!==locale||viewMode!==Boolean(state.viewMode)||anchored!==Boolean(state.anchored);
      if(changed){resetPath();draft='';sourceOpen=null;cache.clear();}
      raw=nextRaw;locale=nextLocale;viewMode=Boolean(state.viewMode);anchored=Boolean(state.anchored);
      if(rerender||!root.dataset.ready){root.dataset.ready='true';render();}
      else if(mode==='dictionary'){document.getElementById('title').textContent=t('title');document.querySelector('.purpose').textContent=t('purpose');document.querySelector('#empty-entry .section-label').textContent=t('inputLabel');document.getElementById('entry-guide').textContent=t('entryGuide');document.getElementById('source').placeholder=t('placeholder');document.getElementById('data-send-notice').textContent=t('notice');}
    }
    function openExample(id){
      const examples={words:{ru:'Я читаю текст.',en:'I read a text.'},condition:{ru:'При этом условии.',en:'Under this condition.'},key:{ru:'Ключ к вопросу.',en:'A key to the question.'}};
      if(!examples[id])return;setMode('dictionary');options.onSetSource?.(examples[id][locale]);
    }
    function openSource(){sourceOpen=true;renderSource();source.scrollIntoView?.({behavior:'auto',block:'start'});source.querySelector('.dictionary-word')?.focus({preventScroll:true});}
    function reset(){resetPath();cache.clear();draft='';sourceOpen=null;render();}
    return Object.freeze({update,setMode,openExample,openSource,reset,getMode:()=>mode,focusWords:()=>root.querySelector('.dictionary-word')?.focus(),cancel:()=>{stop();renderResult();}});
  }
  globalThis.BeforewordDictionaryUI=Object.freeze({mount});
})();
