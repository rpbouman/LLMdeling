function updateStatus(status){
  var app = byId('app');
  app.setAttribute('data-app-status', status);
  console.log(`status: ${status}`);
}

async function initApiStatus(){
  var main = document.querySelector('main');
  var apiGlobals = [
    'LanguageModel',
    'LanguageDetector',
    'Proofreader',
    'Rewriter',
    'Summarizer',
    'Translator',
    'Writer'
  ];
  var scope = self;
  apiGlobals.forEach(function(name){
    var exists = typeof self[name] !== 'undefined';
    main.setAttribute('data-built-in-ai-' + name, exists)
  });
}

function initUi(){
  initLLMPrompts();
  getTranslationDialog()
  .addEventListener('toggle', async function(event){
    await initTranslationDialog();
  }, {
    once: true
  });
  initSummarizationDialog();
  byId('new-chat').addEventListener('click', newChat);
}

function getInfoDialog(){
  return byId('info-dialog');
}

async function showInfoDialog(options){
  var infoDialog = getInfoDialog();
  var status = options.status || 'info';
  if (options.status){
    infoDialog.setAttribute('data-status', options.status);
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