function updateStatus(status){
  var app = byId('app');
  app.setAttribute('data-app-status', status);
  console.log(`status: ${status}`);
}

function getUserAgentInfo(){
  var info = {}
  var userAgent = navigator.userAgent;
  var re = /([A-Za-z]+)\/(\d+(\.\d+)*)( \([^\)]+\))?/g;
  var match;
  while (match = re.exec(userAgent)){
    var name = match[1];
    var version = match[2];
    var platform = match[4]
    info[name] = {
      version: version,
      platform: platform
    }
  }
  return info;
}

async function initApiStatus(){
  var userAgentInfo = getUserAgentInfo();
  var vendor;
  if (userAgentInfo.Edg){
    vendor = 'edge';
  }
  else
  if (userAgentInfo.Chrome){
    vendor = 'chrome';
  }
  else
  if (userAgentInfo.Firefox){
    vendor = 'firefox';
  }
  else {
    vendor = undefined;
  }
  var main = document.querySelector('main');
  var apiList = byId('apis-list');
  
  var apiInfos = [
    {global: 'LanguageModel', 
      links: {
        explainer: 'https://github.com/webmachinelearning/prompt-api',
        specification: 'https://webmachinelearning.github.io/prompt-api/'        
      }, 
      hash: 'prompt_api', 
      flags: {
        chrome: {href: 'chrome://flags#prompt-api-for-gemini-nano', name: 'Prompt API for Gemini Nano'},
        edge: {href: 'edge://flags/#edge-llm-prompt-api-for-phi-mini', name: 'Prompt API for Phi mini'}
      }
    },
    {global: 'LanguageDetector', 
      links: {
        explainer: 'https://github.com/webmachinelearning/translation-api/?tab=readme-ov-file#language-detection',
        specification: 'https://webmachinelearning.github.io/translation-api/#language-detector-api'
      }
    },
    {global: 'Proofreader', 
      links: {
        explainer: 'https://github.com/webmachinelearning/proofreader-api'
      }, 
      hash: 'proofreader_api', 
      flags: {
        chrome: {href: 'chrome://flags#proofreader-api-for-gemini-nano', name: 'Proofreader API for Gemini Nano'}
      }
    },
    {global: 'Rewriter', 
      links: {
        explainer: 'https://github.com/webmachinelearning/writing-assistance-apis/?tab=readme-ov-file#rewriter-api',
        specification: 'https://webmachinelearning.github.io/writing-assistance-apis/#rewriter-api'
      }, 
      hash: 'writer_and_rewriter_apis', 
      flags: {
        chrome: {href: 'chrome://flags#rewriter-api-for-gemini-nano', name: 'Rewriter API for Gemini Nano'},
        edge: {href: 'edge://flags/#edge-llm-rewriter-api-for-phi-mini', name: ' Rewriter API for Phi mini'}
      }
    },
    {global: 'Summarizer', 
      links: {
        explainer: 'https://github.com/webmachinelearning/writing-assistance-apis/?tab=readme-ov-file#summarizer-api',
        specification: 'https://webmachinelearning.github.io/writing-assistance-apis/#summarizer-api'
      }, 
      hash: 'summarizer_api', 
      flags: {
        chrome: {href: 'chrome://flags#summarization-api-for-gemini-nano', name: 'Summarization API for Gemini Nano'},
        edge: {href: 'edge://flags/#edge-llm-summarization-api-for-phi-mini', name: ' Summarization API for Phi mini'}
      }
    },
    // the Translator availibility call is weird - it needs a arg with languagepairs, but as long as the languages are valid, it will always report "downloadable"
    {global: 'Translator', 
      links:{
        explainer: 'https://github.com/webmachinelearning/translation-api/?tab=readme-ov-file#translation',
        specification: 'https://webmachinelearning.github.io/translation-api/#translator-api'
      }, 
      hash: 'translator_api', 
      flags: {
        chrome: {href: 'chrome://flags#translation-api', name: 'Experimental translation API'},
        edge: {href: 'edge://flags/#edge-llm-prompt-api-for-phi-mini', name: 'Prompt API for Phi mini'} 
      },
      args: [{sourceLanguage: 'en', targetLanguage: 'nl'}]
    },
    {global: 'Writer', 
      links: {
        explainer: 'https://github.com/webmachinelearning/writing-assistance-apis/?tab=readme-ov-file#writer-api',
        specification: 'https://webmachinelearning.github.io/writing-assistance-apis/#writer-api'
      }, 
      hash: 'writer_and_rewriter_apis', 
      flags: {
        chrome: {href: 'chrome://flags#writer-api-for-gemini-nano', name: 'Writer API for Gemini Nano'},
        edge: {href: 'edge://flags/#edge-llm-writer-api-for-phi-mini', name: 'Writer API for Phi mini'}
      },
      flag: {hash: 'writer-api-for-gemini-nano', name: 'Writer API for Gemini Nano'}
    }
  ];
  var scope = self;
  apiInfos.forEach(async function(apiInfo){
    var exists = typeof self[apiInfo.global] !== 'undefined';
    main.setAttribute('data-built-in-ai-' + apiInfo.global, exists);
    
    var dt = createEl('dt');
    var dtText = apiInfo.global;
    var dd = createEl('dd');
    if (exists) {
      var gbl = self[apiInfo.global];
      var args = apiInfo.args || [];
      var availability = await gbl.availability.apply(gbl, args);
      dtText += ': ' + availability;
      for (var p in apiInfo.links){
        if (dd.childNodes.length) {
          dd.appendChild(document.createTextNode(' | '));
        }
        var link = createEl('a',{
          href: apiInfo.links[p],
          target: 'docs'
        }, p);
        dd.appendChild(link);
      }
    }
    else {
      dtText += ': not defined';
      dd.appendChild(document.createTextNode('API global not avaiilable.'));
      if (apiInfo.flags) {
        var flag = apiInfo.flags[vendor];
        if (flag){
          dd.appendChild(document.createTextNode(' Check the '));
          var flagLink = createEl('a', {
            target: 'flags',
            href: flag.href
          }, flag.name);
          flagLink.addEventListener('click', function(ev){
            var link = ev.target;
            copyToClipboard(link.href);
            alert('URL to flag copied to clipboard. Open a new tab, paste in the addressbar, and visit to enable the flag or review its settings');
          });
          dd.appendChild( flagLink );
          dd.appendChild(document.createTextNode(' flag and restart the browser.'));
        }
      }
    }
    dt.textContent = dtText;
    apiList.appendChild(dt);
    apiList.appendChild(dd);
  });
}

function initUi(){
  initLLMPrompts();
  initTranslationDialogOnFirstOpen();
  initSummarizationDialog();
  initWriterDialog();
  initRewriterDialog();
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