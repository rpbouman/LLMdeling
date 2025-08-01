function updateStatus(status){
  var app = byId('app');
  app.setAttribute('data-app-status', status);
  console.log(`status: ${status}`);
}

function initUi(){
  initLLMPrompts();
  byId('new-chat').addEventListener('click', newChat);
}

function getInfoDialog(){
  return byId('info-dialog');
}

function showInfoDialog(options){
  var infoDialog = getInfoDialog();
  var status = options.status || 'info';
  if (options.status){
    infoDialog.setAttribute('data-status', options.status);
  }

  var heading = infoDialog.querySelector('div > header > h1');  
  var icon = options.icon || 'eac5';
  heading.setAttribute('data-icon', icon);
  
  var title = options.title || 'Info';
  heading.innerHTML =  title;
  
  var details = options.details || '';
  infoDialog.querySelector('div > section').innerHTML = details;
  
  infoDialog.showModal();
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
  initDragableDialogs();
  initMarked();
  var available = await checkModelAvailability();
  if (!available) {
    return;
  }  
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

init();