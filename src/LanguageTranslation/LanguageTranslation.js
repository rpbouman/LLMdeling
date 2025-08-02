var languageDisplayNamesStandard = new Intl.DisplayNames(undefined, {type: 'language', languageDisplay: 'standard'});

function letterIterator(callback){
  for (var i = 'a'.charCodeAt(); i <= 'z'.charCodeAt(); i++){
    callback(String.fromCharCode(i));
  }
}

/**
* This is to establish a list of languages for tranlation
*
* The google Translator api appears to only support checking language pairs based on 2 letter language codes
* see https://developer.chrome.com/docs/ai/translator-api#language-support
*
* This means we only need to iterate over 2 letter codes (and we can skip 3 letter codes)
*/
function initLanguages(){
  var languages = {};

  function checkLanguageCodeValid(candidateLanguageCode){
    var locale;
    
    // check if the 2-letter language code is valid
    try {
      locale = new Intl.Locale(candidateLanguageCode);
    }
    catch(e){
      //not valid, skip it
      console.error(candidateLanguageCode);
      return;
    }
    
    // get the language code for this locale
    var languageCode = locale.language;
    if (languageCode.length > 2) {
      // if the language code is not a 2-letter code, skip it
      return;
    }
    
    if (languages[languageCode]){
      // if we already have this language code, skip it.
      return;
    }
      
    var languageName = languageDisplayNamesStandard.of(languageCode);
    languages[languageCode] = languageName;
  }

  return new Promise(function(resolve, reject){
    letterIterator(function(letter1){
      letterIterator(function(letter2){
        var languageCode2 = letter1 + letter2;
        checkLanguageCodeValid(languageCode2);
      });
      
    });
        
    resolve(languages);
  });
}

async function initTranslationDialog(){
  var languages = await initLanguages();
  
  function optionHtml(value, label){
    return `<option value="${value}" label="${label}">${label}</option>`;
  }
  
  var options = Object
  .keys(languages)
  .filter(function(languageCode){
    return languageCode !== languages[languageCode];
  })
  .sort(function(a, b){
    a = languages[a];
    b = languages[b];
    if ( a > b ){
      return 1;
    }
    else
    if ( a < b ){
      return -1;
    }
    return 0;
  })
  .map(function(languageCode){
    var languageName = languages[languageCode];
    return optionHtml(languageCode, languageName);
  });

  options = optionHtml('', '') + options;

  var fromLanguagePicker = byId('translate-from-language-picker');
  fromLanguagePicker.innerHTML = options;
  
  var toLanguagePicker = byId('translate-to-language-picker');
  toLanguagePicker.innerHTML = options;
}  