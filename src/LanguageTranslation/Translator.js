// see: https://developer.chrome.com/docs/ai/translator-api 

var translators = {
};

async function translate(text, options, downloadProgessListener){
  var props = {
    sourceLanguage: undefined,
    targetLanguage: undefined
  };
  var translatorOptions = Object.assign(props, options);

  // determine the target language
  if (!props.targetLanguage){
    //https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language
    var preferredBrowserLanguage = navigator.language;
    
    if (!preferredBrowserLanguage) {
      // this really shouldn't happen but if it does we cannt translate anyway
      throw new Error(`The targetLanguage is not set and no browser default is available.`);
    }
    
    translatorOptions.targetLanguage = preferredBrowserLanguage;
  }
  
  if (!props.sourceLanguage){
    var detectedLanguage = await detectLanguage(text, downloadProgessListener);
    if (!detectedLanguage){
      // simle language detection failed, caller should try more advanced ways to detect the source language
      throw new Error(`The sourceLanguage is not set and simple lanague detection failed.`);
    }
    
    translatorOptions.targetLanguage = detectedLanguage;;
  }
  
  var translatorKey = JSON.stringify(translatorOptions);
  var translator = translators[translatorKey];
  
  if (!translator){
    if (typeof Translator === 'undefined') {
      throw new Error(`This browser does not support the Summarizer global.`);
    }

    var availability = await Translator.availability(translatorOptions);
    if (availability === 'unavailable') {
      throw new Error(`There is no Translator available for ${translatorOptions.sourceLanguage} -> ${translatorOptions.targetLanguage}.`);
    }

    if (typeof downloadProgessListener === 'function'){
      translatorOptions.monitor = function(m){
        m.addEventListener('downloadprogress', downloadProgessListener);
      };
    }

    translator = await Translator.create(translatorOptions);
    translators[translatorKey] = translator;
  }
  
  var translation = translator.translateStreaming(text);
  return translation;
}