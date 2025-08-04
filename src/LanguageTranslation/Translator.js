// see: https://developer.chrome.com/docs/ai/translator-api 

var translators = {
};

async function getTranslatorInfo(translatorOptions, downloadProgessListener){
  var translatorKey = getTranslatorKey(translatorOptions);
  var translator = translators[translatorKey];
  var translatorInfo = {
    options: translatorOptions,
    translatorKey: translatorKey,
    translator: undefined,
    availability: undefined
  };
  
  if (translator){
    translatorInfo.translator = translator;
    translatorInfo.availability = 'available';
    return translatorInfo;
  }
  
  if (typeof Translator === 'undefined'){
    translatorInfo.availability = 'no such API';
    return translatorInfo;
  }
  
  var availability = await Translator.availability(translatorOptions);
  translatorInfo.availability = availability;
  return translatorInfo;
}

function getTranslatorKey(translatorOptions){
  var translatorKey = JSON.stringify(translatorOptions);
  return translatorKey;
}

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
  
  var translatorInfo = await getTranslatorInfo(translatorOptions, downloadProgessListener);
  var translator;
  if (!translatorInfo.translator){
    var availability = translatorInfo.availability;
    if (availability === 'no such API') {
      throw new Error(`This browser does not support the Summarizer global.`);
    }

    if (availability === 'unavailable') {
      throw new Error(`There is no Translator available for ${translatorOptions.sourceLanguage} -> ${translatorOptions.targetLanguage}.`);
    }

    if (typeof downloadProgessListener === 'function'){
      translatorOptions.monitor = function(m){
        m.addEventListener('downloadprogress', downloadProgessListener);
      };
    }

    translator = await Translator.create(translatorOptions);
    translators[translatorInfo.translatorKey] = translator;
  }
  
  var translation = translator.translateStreaming(text);
  return translation;
}