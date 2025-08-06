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

function getTranslationDialog(){
  var translationDialog = byId('translation-dialog');
  return translationDialog;
}

async function handleTranslateClicked(event){
  var target = event.target;
  var translationDialog = getAncestorWithTagName(target, 'DIALOG');
  translationDialog.setAttribute('aria-busy', true);
  
  var form = target.form;
  var formElements = form.elements;
  
  var untranslatedText = formElements['sourceLanguage-text'].value;
  console.log(`\nTranslating text:\n`);
  console.log(untranslatedText);
  var untranslatedPreProcessedText = preProcessTranslatorInputText(untranslatedText);
  console.log('\nPreprocessed\n');
  console.log(untranslatedPreProcessedText);
  //var untranslatedPreProcessedText = untranslatedText;
  
  var sourceLanguage = formElements['sourceLanguage'].value;
  var targetLanguage = formElements['targetLanguage-picker'].value;
  
  var translatedTextStream = await translate(
    untranslatedPreProcessedText, {
    sourceLanguage: sourceLanguage,
    targetLanguage: targetLanguage
  });
  var ui = translationDialog.querySelector('div.response');
  await handleResponseStream(translatedTextStream, ui);
  translationDialog.removeAttribute('aria-busy');
}

async function handleResponseStream(reponseStream, ui){
  var responseText = '';
  var postProcessedText;
  
  var rawOutputUi = ui.querySelector('input[type=hidden]');
  var formattedOutputUi = ui.querySelector(':scope > section');
  var markdownOutputUi = ui.querySelector(':scope > pre > code.language-markdown');
  var htmlCodeOutputUi = ui.querySelector(':scope > pre > code.language-html');
  
  for await (const chunk of reponseStream){
    responseText += chunk;
    
    // this reverses the input pre processing.
    postProcessedText = postProcessTranslatorOutputText(responseText);
    //var postProcessedText = responseText;
    
    var html = md2html(postProcessedText)
    if (formattedOutputUi) {
      formattedOutputUi.innerHTML = html;
      formattedOutputUi.scrollIntoView(false);
    }

    if (markdownOutputUi){
      var markdownHighlightedHtml = hljs.highlight(postProcessedText, {language: 'markdown'}).value;
      markdownOutputUi.innerHTML = markdownHighlightedHtml;
      markdownOutputUi.scrollIntoView(false);
    }

    if (htmlCodeOutputUi){
      var htmlHighlightedHtml = hljs.highlight(html, {language: 'html'}).value;
      htmlCodeOutputUi.innerHTML = htmlHighlightedHtml;
      htmlCodeOutputUi.scrollIntoView(false);
    }
  }
  console.log('\nReceived translation:\n');
  console.log(responseText);
  console.log('\nPostprocessed translation:\n');
  console.log(postProcessedText);
}

// this can be called when a change in the dialog could potentially require language detection.
// examples of changes that would require calling this:
// - if the value of language picker changes from a chosen language to 'auto'
// - if the value of the language picker is auto and the sourceText changes
function triggerSourceLanguageDetection(forElement){
  var translationDialog = getAncestorWithTagName(forElement, 'DIALOG');
  
  var form = forElement.form;
  var formElements = form.elements;
  
  var sourceLanguagePicker = formElements['sourceLanguage-picker'];
  var sourceLanguage = sourceLanguagePicker.value; 

  if (sourceLanguage === 'auto'){
    // picking the 'auto' option will initiate language detection
    // so whatever is the current value of the detected language reflected in the label should be reset
    var selectedOption = getSelectedOption(sourceLanguagePicker);
    selectedOption.label = '(none)';
  }

  // copy the chosen language to the hidden source language control
  var sourceLanguageElement = formElements['sourceLanguage'];
  
  // if the picked value and the current one are the same we need not update 
  if (sourceLanguageElement.value !== sourceLanguage || sourceLanguage === 'auto') {
    // update the hidden sourceLanguage
    sourceLanguageElement.value = sourceLanguage;
    dispatchChangeEvent(sourceLanguageElement);
  }
  
}

function sourceTextChangedHandler(event){
  var target = event.target;
  //since the text changed we might need to auto-detect again
  triggerSourceLanguageDetection( target );
}

function updateTargetLanguagePicker(){
}

async function sourceLanguagePickerChangedHandler(event){
  var target = event.target;
  triggerSourceLanguageDetection( target );

  var form = target.form;
  var formElements = form.elements;
  
  var sourceLanguage = target.value;
  if (sourceLanguage === 'auto'){
    sourceLanguage = formElements['sourceLanguage'].value;
  }
}

async function sourceLanguageChangedHandler(event){
  var sourceLanguageElement = event.target;
  var sourceLanguage = sourceLanguageElement.value;

  var form = sourceLanguageElement.form;
  var formElements = form.elements;
  var sourceLanguagePicker = formElements['sourceLanguage-picker'];
  
  var sourceLanguageText = formElements['sourceLanguage-text'];
  
  if (sourceLanguage === 'auto') {
    try {
      var sourceText = sourceLanguageText.value;
      var detectedLanguage = await detectLanguage(sourceText);
      sourceLanguage = detectedLanguage.detectedLanguage;
    }
    catch(e){
    }

    if (sourceLanguage !== 'auto'){
      sourceLanguageElement.value = sourceLanguage;
      dispatchChangeEvent(sourceLanguageElement);
    }
    
    sourceLanguageText.removeAttribute('lang');
    sourceLanguageText.removeAttribute('spellcheck');
  }
  else {    
    // update the label of the sourceLanguage picker to reflect the detected language
    if (sourceLanguagePicker.value === 'auto') {
      var detectedLanguageLabel;
      var options = sourceLanguagePicker.options;
      var selectedOption;
      for (var i = 0; i < options.length; i++){
        var option = options.item(i);
        if (option.value !== sourceLanguage) {
          continue;
        }
        detectedLanguageLabel = option.label + ' (detected)';
        break;
      }
      selectedOption = options[sourceLanguagePicker.selectedIndex];
      selectedOption.label = detectedLanguageLabel;
    }

    // update the target languge picker to only show items 
    // for wich a translator exists for the chosen source language.
    var targetLanguagePicker = formElements['targetLanguage-picker'];
    var selectedOptionIndex = targetLanguagePicker.selectedIndex;
    
    var promises = [];
    var options = targetLanguagePicker.options;
    var selectedOption = options.item(selectedOptionIndex);
    for (var i = 0; i < options.length; i++){
      var option = options.item(i);
      var promise = getTranslatorInfo({
        sourceLanguage: sourceLanguage,
        targetLanguage: option.value
      });
      promises.push(promise);
    }
    
    var results = await Promise.all(promises);
    for (var i = 0; i < results.length; i++){
      var option = options.item(i);
      var translatorInfo = results[i];
      switch(translatorInfo.availability){
        case 'unavailable':
        case 'no such API':
          option.disabled = true;
          if (option === selectedOption){
            targetLanguagePicker.value = '';
            dispatchChangeEvent(targetLanguagePicker);
          }
          break;
        default:
          option.disabled = false;
      }
    }

    // update the lang attribute of the sourceText
    sourceLanguageText.removeAttribute('spellcheck');
    sourceLanguageText.setAttribute('lang', sourceLanguage);
    setTimeout(function(){
      sourceLanguageText.setAttribute('spellcheck', true);
    }, 100);
  }
  
}

function liveTranslationChangedHandler(event){
}

function targetLanguageChangedHandler(event){
}

async function translationDialogStateChanged(event){
  var target = event.target;
  var form = target.form;
  var formElements = form.elements;
  
  var detail = event.detail;
  var previousState = detail.previousState;
  var currentState = detail.currentState;
  var stateChange = detail.stateChange;
  
  var element, elementName;
  
  elementName = 'uploadSourceText';
  if (stateChange[elementName]){
    element = formElements[elementName];
    var files = element.files;
    if (files.length === 1 ){
      var file = files[0];
      var text = await file.text();
      var sourceLanguageText = formElements['sourceLanguage-text'];
      sourceLanguageText.value = text;
      dispatchChangeEvent(sourceLanguageText);
    }
  }    
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
  
  var fromLanguages = [{
    value: 'auto', 
    label: '(none)', 
    group: 'Auto-detected'
  }];
  
  var languageDetectorInfo = await getLanguageDetectorInfo();

  if (typeof languageDetectorInfo.languageDetector === 'undefined'){
    fromLanguages[0].disabled = true;
    console.warn('Language detection is unavailable. Check the chrome flag chrome://flags/#language-detection-api');
  }
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
      label: languageName,
      group: 'Pick a language'
    };
    fromLanguages.push(option);
    
    var toLanguageOption = Object.assign({}, option);
    if (toLanguageOption.value === defaultLanguage){
      toLanguageOption.selected = true;
    }
    toLanguageOption.group = typeof preferredLanguages[languageCode] === 'undefined' ? 'Other' : 'Preferred';
    toLanguages.push(toLanguageOption);
  });
  
  populateSelect('#sourceLanguage-picker', fromLanguages);
  populateSelect('#targetLanguage-picker', toLanguages, {
    'Preferred': '1',
    'Other': '2'
  });
  
  byId('sourceLanguage-text').addEventListener('change', sourceTextChangedHandler, true);
  
  var sourceLanguagePicker = byId('sourceLanguage-picker');
  sourceLanguagePicker.addEventListener('change', sourceLanguagePickerChangedHandler, true);
  
  byId('sourceLanguage').addEventListener('change', sourceLanguageChangedHandler, true);
  byId('liveTranslation').addEventListener('change', liveTranslationChangedHandler, true);
  byId('targetLanguage-picker').addEventListener('change', targetLanguageChangedHandler, true);

  byId('translate').addEventListener('click', handleTranslateClicked, true);

  getTranslationDialog().querySelector(stateElementSelector).addEventListener('change', translationDialogStateChanged, true);
  
  var sourceLanguagePickerValue = typeof languageDetectorInfo.languageDetector === 'undefined' ? defaultLanguage : 'auto';
  if (sourceLanguagePickerValue !== sourceLanguagePicker.value){
     sourceLanguagePicker.value = sourceLanguagePickerValue;
    dispatchChangeEvent(sourceLanguagePicker);
  }
}

// the translartor has an issue with linebreaks - they get removed.
// this is a real pita when the input text is markdown
// but, we noticed that HTML remains unscathed. 
function preProcessTranslatorInputText(text){
  var preProcessedText = text.replace(/\r\n|\r|\n/g, function(match){
    var breakTag;
    switch (match){
      case '\r\n':
        breakTag = '<x:crlf/>';
        break;
      case '\r':
        breakTag = '<x:cr/>';
        break;
      case '\n':
        breakTag = '<x:lf/>';
        break;
    }
    return breakTag;
  });
  return preProcessedText;
}

function postProcessTranslatorOutputText(text) {
  var postProcessedText = text.replace(/<x:crlf\/>|<x:cr\/>|<x:lf\/>/g, function(match){
    var lineBreak;
    match = match.trim();
    switch (match){
      case '<x:crlf/>':
        lineBreak = '\r\n';
        break;
      case '<x:cr/>':
        lineBreak = '\r';
        break;
      case '<x:lf/>':
        lineBreak = '\n';
        break;
    }
    return lineBreak;
  });
  return postProcessedText;
}

function setTranslationDialogState(state){
  var translationDialog = getTranslationDialog();
  var dialogState = getFormStateInfo(translationDialog).currentState;
  delete dialogState['uploadSourceText'];

  var text = state.text;
  
  if (text){
    dialogState['sourceLanguage-text'] = text;
  }
  delete state.formatting;
    
  var sourceLanguage = state.sourceLanguage || 'auto';
  dialogState['sourceLanguage-picker'] = sourceLanguage;
  dialogState['sourceLanguage'] = sourceLanguage;

  if (state.targetLanguage){
    dialogState['targetLanguage-picker'] = state.targetLanguage;
  }
  setFormState(translationDialog, dialogState);
}