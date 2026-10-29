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
    "id": "feeling",
    "authored": true,
    "label": {
      "ru": "«Я чувствую»",
      "en": "“I feel”"
    },
    "text": {
      "ru": "Я чувствую боль.",
      "en": "I feel pain."
    },
    "report": {
      "ru": {
        "language": "ru",
        "items": [
          {
            "quote": {
              "text": "Я чувствую боль.",
              "occurrence": 0
            },
            "reading": "«Я», «чувствую» и «боль» состоят из выученных букв. «Я чувствую» тоже записано. **Слова «чувствую» и «боль» не стали тем, что ими называют.** Это пояснение также составлено из слов."
          }
        ]
      },
      "en": {
        "language": "en",
        "items": [
          {
            "quote": {
              "text": "I feel pain.",
              "occurrence": 0
            },
            "reading": "“I”, “feel” and “pain” consist of learned letters. “I feel” is written too. **The words “feel” and “pain” do not become what they name.** This explanation is also made of words."
          }
        ]
      }
    }
  },
  {
    "id": "expectation",
    "authored": true,
    "label": {
      "ru": "«Хороший» и «хочешь»",
      "en": "“Good” and “want”"
    },
    "text": {
      "ru": "Ты хороший, если хочешь того же, что все.",
      "en": "You are good if you want what everyone else wants."
    },
    "report": {
      "ru": {
        "language": "ru",
        "items": [
          {
            "quote": {
              "text": "Ты хороший, если хочешь того же, что все.",
              "occurrence": 0
            },
            "reading": "«если» связывает «Ты хороший» с условием «хочешь того же, что все». **Общая формулировка «что все» предъявлена как условие описания «хороший».** Эти слова и это пояснение остаются записями."
          }
        ]
      },
      "en": {
        "language": "en",
        "items": [
          {
            "quote": {
              "text": "You are good if you want what everyone else wants.",
              "occurrence": 0
            },
            "reading": "“if” connects “You are good” with “you want what everyone else wants.” **The shared condition “what everyone else wants” is attached to the description “good”.** These words and this explanation remain writing."
          }
        ]
      }
    }
  },
  {
    "id": "world",
    "authored": true,
    "label": {
      "ru": "Описание мира",
      "en": "A description of the world"
    },
    "text": {
      "ru": "Мир состоит из материи.",
      "en": "The world consists of matter."
    },
    "report": {
      "ru": {
        "language": "ru",
        "items": [
          {
            "quote": {
              "text": "Мир состоит из материи.",
              "occurrence": 0
            },
            "reading": "«Мир», «состоит» и «материи» — выученные слова, соединённые в утверждение. **Эта запись не стала миром или материей, которые ею называют.** Объяснение этих слов продолжает запись."
          }
        ]
      },
      "en": {
        "language": "en",
        "items": [
          {
            "quote": {
              "text": "The world consists of matter.",
              "occurrence": 0
            },
            "reading": "“world”, “consists” and “matter” are learned words joined in a statement. **This writing does not become the world or matter it names.** Explaining these words continues the writing."
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
