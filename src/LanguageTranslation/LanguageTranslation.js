var languageDisplayNamesStandard = new Intl.DisplayNames(undefined, {type: 'language', languageDisplay: 'standard'});

function letterIterator(callback){
  for (var i = 'a'.charCodeAt(); i <= 'z'.charCodeAt(); i++){
    callback(String.fromCharCode(i));
  }
}

function toLanguageCode(localeString){
  try {
    return (new Intl.Locale(localeString)).language;
  }
  catch(e){
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
    // get the language code for this locale
    var languageCode = toLanguageCode(candidateLanguageCode);
    if (languageCode === undefined){
      console.warn(`Invalid language code ${candidateLanguageCode}`);
      return;
    }
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
  
  var defaultLanguage = toLanguageCode(navigator.language);
  
  var preferredLanguages = (navigator.languages || [])
  .reduce(function(preferredLanguages, localeString, index){
    var languageCode = toLanguageCode(localeString);
    
    if (languageCode !== undefined && typeof preferredLanguages[languageCode] === 'undefined') {
      preferredLanguages[languageCode] = index;
    }
    
    return preferredLanguages;
  },{});
  
  var fromLanguages = [''];
  var toLanguages = [];
  
  Object.keys(languages)
  //remove language codes for which we couldn't obtain a display name
  .filter(function(languageCode){
    var languageName = languages[languageCode];
    return languageName !== languageCode;
  })
  //make option objects for the from and to language pickers
  .forEach(function(languageCode){
    var languageName = languages[languageCode];
    var option = {
      value: languageCode,
      label: languageName
    };
    fromLanguages.push(option);
    
    var toLanguageOption = Object.assign({}, option);
    if (toLanguageOption.value === defaultLanguage){
      toLanguageOption.selected = true;
    }
    if (typeof preferredLanguages[languageCode] !== 'undefined') {
      toLanguageOption.group = 'Preferred';
    }
    toLanguages.push(toLanguageOption);
  });
  
  populateSelect('#sourceLanguage-picker', fromLanguages);
  populateSelect('#targetLanguage-picker', toLanguages);
  
}  