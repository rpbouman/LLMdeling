function updateStatus(status){
  var app = byId('app');
  app.setAttribute('data-app-status', status);
  console.log(`status: ${status}`);
}

async function initApiStatus(){
  var main = document.querySelector('main');
  var apiList = byId('apis-list');
  
  var apiInfos = [
    {global: 'LanguageModel', hash: 'prompt_api', flag: {hash: 'prompt-api-for-gemini-nano', name: 'Prompt API for Gemini Nano'}},
    {global: 'LanguageDetector', hash: 'language_detector_api'},
    {global: 'Proofreader', hash: 'proofreader_api', flag: {hash: 'proofreader-api-for-gemini-nano', name: 'Proofreader API for Gemini Nano'}},
    {global: 'Rewriter', hash: 'writer_and_rewriter_apis', flag: {hash: 'rewriter-api-for-gemini-nano', name: 'Rewriter API for Gemini Nano'}},
    {global: 'Summarizer', hash: 'summarizer_api', flag: {hash: 'summarization-api-for-gemini-nano', name: 'Summarization API for Gemini Nano'}},
    // the Translator availibility call is weird - it needs a arg with languagepairs, but as long as the languages are valid, it will always report "downloadable"
    {global: 'Translator', hash: 'translator_api', flag: {hash: 'translation-api', name: 'Experimental translation API'}, args: [{sourceLanguage: 'en', targetLanguage: 'nl'}]},
    {global: 'Writer', hash: 'writer_and_rewriter_apis', flag: {hash: 'writer-api-for-gemini-nano', name: 'Writer API for Gemini Nano'}},
  ];
  var scope = self;
  apiInfos.forEach(async function(apiInfo){
    var exists = typeof self[apiInfo.global] !== 'undefined';
    main.setAttribute('data-built-in-ai-' + apiInfo.global, exists);

    var docLink = createEl('a', {
      target: 'chrome',
      href: 'https://developer.chrome.com/docs/ai/built-in-apis#' + apiInfo.hash
    }, apiInfo.global);
    
    var dt = createEl('dt');
    dt.appendChild(docLink);
    var dd = createEl('dd');
    if (exists) {
      var gbl = self[apiInfo.global];
      var args = apiInfo.args || [];
      var availability = await gbl.availability.apply(gbl, args);
      dd.appendChild(document.createTextNode(availability));
    }
    else {
      dd.appendChild(document.createTextNode('Not avaiilable. Check the '));
      var flagLink = createEl('a', {
        target: 'chrome',
        href: 'chrome://flags#' + apiInfo.flag.hash
      }, apiInfo.flag.name);
      flagLink.addEventListener('click', function(ev){
        var link = ev.target;
        copyToClipboard(link.href);
        alert('URL to flag copied to clipboard. Open a new tab, paste in the addressbar, and visit to enable the flag or review its settings');
      });
      dd.appendChild( flagLink );
      dd.appendChild(document.createTextNode(' flag and relaunch chrome.'));
    }
    apiList.appendChild(dt);
    apiList.appendChild(dd);
  });
}

function initUi(){
  initLLMPrompts();
  initTranslationDialogOnFirstOpen();
  initSummarizationDialog();
  initWriterDialog();
  initConversation();
}

function getInfoDialog(){
  return byId('info-dialog');
}

async function showInfoDialog(options){
  var infoDialog = getInfoDialog();
  
  if (options instanceof Error){
    var error = options;
    options = {
      status: 'error',
      title: error.name,
      details: error.message,
      icon: String.fromCharCode(parseInt('ff62', 16))
    }
  }
  
  var status = options.status || 'info';
  if (options.status){
    infoDialog.setAttribute('data-status', status);
  }

  var heading = infoDialog.querySelector('div > header > h1');  
  var icon = options.icon || String.fromCharCode(parseInt('eac5', 16));
  heading.setAttribute('data-icon', icon);
  
  var title = options.title || 'Info';
  heading.innerHTML =  title;
  
  var details = options.details || '';
  infoDialog.querySelector('div > section').innerHTML = details;

  return showDialogWithHandler(infoDialog, options.buttonHandler, true);

}

function closeModal(btn){
  var dialog = btn;
  while (dialog.tagName !== 'DIALOG') {
    dialog = dialog.parentNode;
  }
  dialog.close();
}

function chromeFlags(){
  copyToClipboard('chrome://flags/#:~:text=Prompt API for Gemini Nano', 'text/plain');
  alert(
    [
      'A URL to find the Chrome flags you should enable to run this application has been copied to the clipboard.',
      'Paste it into your chrome address bar, navigate there, and enable the flags. Then hit relaunch to try again. '
    ].join('\n')
  );
}

async function init(){
  initApiStatus();
  initFormState();
  initDragableDialogs();
  initMarked();
  initUi();
  initHistoryBackend(function(info){
    switch (info.status){
      case 'success':
        initHistoryUi();
        break;
      case 'error':
        break;
    }
    updateStatus('ready');
  });
}