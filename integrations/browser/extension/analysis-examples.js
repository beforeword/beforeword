'use strict';
/* Prepared examples. Opening one never sends a model request. */
(function(root){
const examples=[
  {
    "id": "name",
    "authored": true,
    "label": {
      "ru": "Имя в списке",
      "en": "A name on a list"
    },
    "text": {
      "ru": "В списке участников стоит моё имя. Значит, эта запись — я?",
      "en": "My name is on the participant list. Does that mean this written entry is me?"
    },
    "report": {
      "ru": {
        "language": "ru",
        "items": [
          {
            "quote": {
              "text": "В списке участников стоит моё имя. Значит, эта запись — я?",
              "occurrence": 0
            },
            "reading": "После «моё имя» следует «эта запись — я?». Имя можно выучить и узнавать как относящееся к себе. **Здесь написанное имя предложено считать тем, кого им называют.** Даже прочитанное как твоё, имя остаётся записью."
          }
        ]
      },
      "en": {
        "language": "en",
        "items": [
          {
            "quote": {
              "text": "My name is on the participant list. Does that mean this written entry is me?",
              "occurrence": 0
            },
            "reading": "After “My name”, the question asks whether “this written entry is me”. A name can be learned and recognized as referring to you. **That step proposes treating the written name as the person it names.** Even when read as yours, the name remains writing."
          }
        ]
      }
    }
  },
  {
    "id": "demand",
    "authored": true,
    "label": {
      "ru": "Условие согласия",
      "en": "Conditional agreement"
    },
    "text": {
      "ru": "Ты должен согласиться, иначе тебя исключат из группы.",
      "en": "You must agree, or you’ll be removed from the group."
    },
    "report": {
      "ru": {
        "language": "ru",
        "items": [
          {
            "quote": {
              "text": "Ты должен согласиться, иначе тебя исключат из группы.",
              "occurrence": 0
            },
            "reading": "«Иначе» связывает «должен согласиться» и «тебя исключат из группы»: согласие прочитано как условие участия. **Написанное условие не становится ни согласием, ни самим исключением.**"
          }
        ]
      },
      "en": {
        "language": "en",
        "items": [
          {
            "quote": {
              "text": "You must agree, or you’ll be removed from the group.",
              "occurrence": 0
            },
            "reading": "“or” connects “must agree” with “you’ll be removed from the group”: agreement is read as a condition of remaining. **The written condition does not become either agreement or the removal itself.**"
          }
        ]
      }
    }
  },
  {
    "id": "math",
    "authored": true,
    "label": {
      "ru": "Запись равенства",
      "en": "A written equality"
    },
    "text": {
      "ru": "2 + 2 = 4",
      "en": "2 + 2 = 4"
    },
    "report": {
      "ru": {
        "language": "ru",
        "items": [
          {
            "quote": {
              "text": "2 + 2 = 4",
              "occurrence": 0
            },
            "reading": "«+» и «=» прочитаны по выученным правилам арифметики. **Записи «2 + 2» и «4» здесь прочитаны как обозначающие одно количество.** Это не превращает начертания в называемое количество."
          }
        ]
      },
      "en": {
        "language": "en",
        "items": [
          {
            "quote": {
              "text": "2 + 2 = 4",
              "occurrence": 0
            },
            "reading": "“+” and “=” are read through learned rules of arithmetic. **The written “2 + 2” and “4” are read here as denoting the same quantity.** This does not turn the marks into the quantity they name."
          }
        ]
      }
    }
  },
  {
    "id": "trust",
    "authored": true,
    "label": {
      "ru": "Написанное доверие",
      "en": "Written trust"
    },
    "text": {
      "ru": "д о в е р и е",
      "en": "t r u s t"
    },
    "report": {
      "ru": {
        "language": "ru",
        "items": [
          {
            "quote": {
              "text": "д о в е р и е",
              "occurrence": 0
            },
            "reading": "Пробелы разделяют буквы, которые здесь можно связать в выученное слово «доверие». **Эти начертания не становятся доверием, когда слово прочитано.**"
          }
        ]
      },
      "en": {
        "language": "en",
        "items": [
          {
            "quote": {
              "text": "t r u s t",
              "occurrence": 0
            },
            "reading": "Spaces separate letters that can be joined here into the learned word “trust”. **These marks do not become trust when the word is read.**"
          }
        ]
      }
    }
  },
  {
    "id": "life",
    "authored": true,
    "label": {
      "ru": "Что такое жизнь",
      "en": "What is life"
    },
    "text": {
      "ru": "Что такое жизнь?",
      "en": "What is life?"
    },
    "report": {
      "ru": {
        "language": "ru",
        "items": [
          {
            "quote": {
              "text": "Что такое жизнь?",
              "occurrence": 0
            },
            "reading": "«Жизнь» — выученная письменная форма. **Эта запись не становится тем, что называют жизнью.**"
          }
        ]
      },
      "en": {
        "language": "en",
        "items": [
          {
            "quote": {
              "text": "What is life?",
              "occurrence": 0
            },
            "reading": "“Life” is a learned written form. **The writing does not become what the word names.**"
          }
        ]
      }
    }
  },
  {
    "id": "judgment",
    "authored": true,
    "label": {
      "ru": "От молчания к согласию",
      "en": "From silence to agreement"
    },
    "text": {
      "ru": "Он молчит, значит, согласен.",
      "en": "He is silent, so he agrees."
    },
    "report": {
      "ru": {
        "language": "ru",
        "items": [
          {
            "quote": {
              "text": "Он молчит, значит, согласен.",
              "occurrence": 0
            },
            "reading": "«Значит» связывает «молчит» с «согласен». **К написанному «молчит» добавлен вывод «согласен».** Написанное «согласен» не становится согласием."
          }
        ]
      },
      "en": {
        "language": "en",
        "items": [
          {
            "quote": {
              "text": "He is silent, so he agrees.",
              "occurrence": 0
            },
            "reading": "“so” connects “is silent” with “agrees”. **The written “is silent” is made a premise for “agrees”.** The written “agrees” does not become agreement."
          }
        ]
      }
    }
  }
];
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
root.BeforewordExamples=freeze(examples);
if(typeof module==='object'&&module.exports)module.exports=root.BeforewordExamples;
})(globalThis);
