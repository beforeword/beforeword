// Authored demonstrations, never presented as live model output.
export const EXAMPLES = [
  {id:'trust', ru:{title:'д о в е р и е',source:'д о в е р и е',reading:'Буквы с пробелами можно прочитать как «доверие». **Написанное «д о в е р и е» не становится доверием.**'},en:{title:'t r u s t',source:'t r u s t',reading:'The spaced letters can be read as “trust”. **The written “t r u s t” does not become trust.**'}},
  {id:'names',ru:{title:'«называют»',source:'Написанное слово не становится тем, что им называют.',reading:'«называют» здесь тоже написано. **Это пояснение тоже состоит из написанных слов.**'},en:{title:'“names”',source:'A written word does not become what it names.',reading:'“names” is written here too. **This explanation also consists of written words.**'}},
  {id:'judgment',ru:{title:'Молчание → согласие',source:'Он молчит, значит, согласен.',reading:'«значит» связывает «молчит» с «согласен». **К написанному «молчит» добавлен вывод «согласен».** Написанное «согласен» не становится согласием.'},en:{title:'Silence → agreement',source:'He is silent, so he agrees.',reading:'“so” connects “is silent” with “agrees”. **The written “is silent” is made a premise for “agrees”.** The written “agrees” does not become agreement.'}},
  {id:'life',ru:{title:'Что такое жизнь?',source:'Что такое жизнь?',reading:'«жизнь» — выученная письменная форма. **Эта запись не становится тем, что называют жизнью.**'},en:{title:'What is life?',source:'What is life?',reading:'“life” is a learned written form. **The writing does not become what the word names.**'}},
  {id:'definition',ru:{title:'Обычное значение',source:'Дай обычное значение слова «река» одним предложением.',reading:'**Река** — естественный водный поток, текущий по руслу.'},en:{title:'Ordinary meaning',source:'Give the ordinary meaning of “river” in one sentence.',reading:'A **river** is a natural stream of water flowing in a channel.'}},
  {id:'arithmetic',ru:{title:'17 × 24',source:'Сколько будет 17 × 24?',reading:'17 × 24 = **408**.'},en:{title:'17 × 24',source:'What is 17 × 24?',reading:'17 × 24 = **408**.'}}
];

export function exampleState(id, locale) {
  const example = EXAMPLES.find(item => item.id === id);
  if (!example) throw new Error('UNKNOWN_EXAMPLE');
  const item = example[locale];
  return {sourceId:null,source:item.source,locale,report:{language:locale,items:[{quote:{text:item.source,occurrence:0},reading:item.reading}]},authored:true,exampleId:id};
}
