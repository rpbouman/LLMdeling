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
  doTranslate();
}

async function doTranslate(){
  var translationDialog = getTranslationDialog();
  var currentState = getFormStateInfo(translationDialog).currentState;
  
  var sourceLanguage = currentState['sourceLanguage'];
  if (sourceLanguage === '' || sourceLanguage === 'auto'){
    return;
  }
 
  var targetLanguage = currentState['targetLanguage-picker'];
  if (targetLanguage === ''){
    return;
  }
  
  var sourceText = currentState['input'];
  if (!sourceText.trim().length) {
    return;
  }
  
  setBusy(translationDialog);
  var untranslatedText = sourceText;
  var untranslatedPreProcessedText = preProcessTranslatorInputText(untranslatedText);
    
  var translatedTextStream = await translate(
    untranslatedPreProcessedText, {
    sourceLanguage: sourceLanguage,
    targetLanguage: targetLanguage
  });
  
  var transformer = {
    transform: function(chunk, controller){
      var postProcessedChunk = postProcessTranslatorOutputText(chunk);
      controller.enqueue(postProcessedChunk);
    }
  };
  var translatedAndPostProcessedTextStream = translatedTextStream.pipeThrough(
    new TransformStream(
      transformer
    )
  ); 

  var ui = translationDialog.querySelector('div.response');  
  await handleResponseStream(translatedAndPostProcessedTextStream, ui);
  setBusy(translationDialog, false);
}

async function handleResponseStream(reponseStream, ui){
  var responseText = '';
  
  var rawOutputUi = ui.querySelector('input[type=hidden]');
  var formattedOutputUi = ui.querySelector(':scope > section');
  var markdownOutputUi = ui.querySelector(':scope > pre > code.language-markdown');
  var htmlCodeOutputUi = ui.querySelector(':scope > pre > code.language-html');
  
  for await (const chunk of reponseStream){
    responseText += chunk;
        
    var html = md2html(responseText)
    if (formattedOutputUi) {
      formattedOutputUi.innerHTML = html;
      formattedOutputUi.scrollIntoView(false);
    }

    if (markdownOutputUi){
      var markdownHighlightedHtml = hljs.highlight(responseText, {language: 'markdown'}).value;
      markdownOutputUi.innerHTML = markdownHighlightedHtml;
      markdownOutputUi.scrollIntoView(false);
    }

    if (htmlCodeOutputUi){
      var htmlHighlightedHtml = hljs.highlight(html, {language: 'html'}).value;
      htmlCodeOutputUi.innerHTML = htmlHighlightedHtml;
      htmlCodeOutputUi.scrollIntoView(false);
    }
    
    if (rawOutputUi) {
      rawOutputUi.value = responseText;
    }
  }
}

// this can be called when a change in the dialog could potentially require language detection.
// examples of changes that would require calling this:
// - if the value of language picker changes from a chosen language to 'auto'
// - if the value of the language picker is auto and the sourceText changes
function triggerSourceLanguageDetection(forElement){
  
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
    sourceLanguageElement.setAttribute('value', sourceLanguage);
    dispatchChangeEvent(sourceLanguageElement);
  }
  
}

function sourceTextChangedHandler(event){
  var target = event.target;
  triggerSourceLanguageDetection( target );
}

async function sourceLanguagePickerChangedHandler(event){
  var target = event.target;
  triggerSourceLanguageDetection( target );
}

async function updateTargetLanguagePicker(sourceLanguageElement){
  var form = sourceLanguageElement.form;
  var formElements = form.elements;
  
  var targetLanguagePicker = formElements['targetLanguage-picker'];
  var options = targetLanguagePicker.options;
  
  var sourceLanguage = sourceLanguageElement.value;
  if (sourceLanguage === 'auto' || sourceLanguage === ''){
    for (var i = 0; i < options.length; i++){
      var option = options.item(i);
      option.disabled = true;
    }
  }
  else {
    var selectedOptionIndex = targetLanguagePicker.selectedIndex;
    
    var promises = [];
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
  }
}

async function sourceLanguageChangedHandler(event){
  var sourceLanguageElement = event.target;
  var sourceLanguage = sourceLanguageElement.value;

  var form = sourceLanguageElement.form;
  var formElements = form.elements;
  var sourceLanguagePicker = formElements['sourceLanguage-picker'];
  
  var sourceLanguageText = formElements['input'];
  
  if (sourceLanguage === 'auto') {
    try {
      var sourceText = sourceLanguageText.value;
      if (sourceText.trim().length){
        var detectedLanguage = await detectLanguage(sourceText);
        sourceLanguage = detectedLanguage.detectedLanguage;
      }
    }
    catch(e){
    }

    if (sourceLanguage === 'auto'){
    }
    else {
      sourceLanguageElement.setAttribute('value', sourceLanguage);
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

    // update the lang attribute of the sourceText
    sourceLanguageText.removeAttribute('spellcheck');
    sourceLanguageText.setAttribute('lang', sourceLanguage);
    setTimeout(function(){
      sourceLanguageText.setAttribute('spellcheck', true);
    }, 100);
  }
  updateTargetLanguagePicker(sourceLanguageElement);
}

async function translationDialogStateChanged(event){
  var target = event.target;
  var form = target.form;
  var formElements = form.elements;
  
  var detail = event.detail;
  var previousState = detail.previousState;
  var currentState = detail.currentState;
  var stateChange = detail.stateChange;
 
  // check if we should start translating
  var autoTranslate = currentState['autoTranslate'];
  if (autoTranslate === false){
    return;
  }
  doTranslate();  
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
    toLanguageOption.disabled = true;
    toLanguages.push(toLanguageOption);
  });
  toLanguages.value = '';
  
  var translationDialog = getTranslationDialog();
  var translationDialogStateElement = translationDialog.querySelector(stateElementSelector);
  translationDialogStateElement.addEventListener('change', translationDialogStateChanged, true);

  var translationDialogStateForm = translationDialogStateElement.form;
  var translationDialogStateFormElements = translationDialogStateForm.elements;
  
  populateSelect(translationDialogStateFormElements['sourceLanguage-picker'], fromLanguages);
  populateSelect(translationDialogStateFormElements['targetLanguage-picker'], toLanguages, {
    'Preferred': '1',
    'Other': '2'
  });
  
  translationDialogStateFormElements['uploadSourceText'].addEventListener('change', inputOutputDialogUploadHandler, true);
  translationDialogStateFormElements['input'].addEventListener('change', sourceTextChangedHandler, true);
  
  var sourceLanguagePicker = translationDialogStateFormElements['sourceLanguage-picker'];
  sourceLanguagePicker.addEventListener('change', sourceLanguagePickerChangedHandler, true);
  
  translationDialogStateFormElements['sourceLanguage'].addEventListener('change', sourceLanguageChangedHandler, true);

  translationDialogStateFormElements['translate'].addEventListener('click', handleTranslateClicked, true);

  
  var sourceLanguagePickerValue = typeof languageDetectorInfo.languageDetector === 'undefined' ? defaultLanguage : 'auto';
  if (sourceLanguagePickerValue !== sourceLanguagePicker.value){
     sourceLanguagePicker.value = sourceLanguagePickerValue;
    dispatchChangeEvent(sourceLanguagePicker);
  }
  
  translationDialog.querySelector('button[type=button][name=download]').addEventListener('click', inputOutputDialogDownloadHandler);
  translationDialog.querySelector('button[type=button][name=copy]').addEventListener('click', inputOutputDialogCopyHandler);
}

// the translartor has an issue with linebreaks - they get removed.
// see: https://issues.chromium.org/issues/436065980
// 
// this is a real pita when the input text is markdown
// but, we noticed that HTML remains unscathed. 
// with some further experimentation we found that 
// substituting CR, LF, tab and space with HTML character entities,
// will return the character entities in the translation, so this can be used to reconstruct the formatting.
//
function preProcessTranslatorInputText(text){
  var preProcessedText = text.replace(/\r\n|\r|\n|\*|_| [ \t]+ |^#+\s+/g, function(match){
    var breakTag;
    switch (match){
      case '\r\n':
        breakTag = '&#13;&#10;';
        break;
      case '\r':
      case '\n':
      case '*':
      case '_':
        breakTag = `&#${match.charCodeAt(0)};`;
        break;
      default:
        var substitution = match.slice(1, -1).split('').map(function(ch){
          var charCode = String(ch.charCodeAt(0));
          if (charCode.length === 1) {
            charCode = '0' + charCode;
          }
          return `&#${charCode};`;
        }).join('');
        breakTag = match.charAt(0) + substitution + match.charAt(match.length - 1);
    }
    return breakTag;
  });
  return preProcessedText;
}

function postProcessTranslatorOutputText(text) {
  var postProcessedText = text.replace(/&#(\d+);/g, function(match, charCodeAsString){
    var charCode = parseInt(charCodeAsString, 10);
    var ch = String.fromCharCode(charCode);
    return ch;
  });
  return postProcessedText;
}

function setTranslationDialogState(state){
  var translationDialog = getTranslationDialog();
  var dialogState = getFormStateInfo(translationDialog).currentState;
  delete dialogState['uploadSourceText'];

  var text = state.text;
  
  if (text){
    dialogState['input'] = text;
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