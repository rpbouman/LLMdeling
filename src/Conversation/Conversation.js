var responseUi;
var responseBuffer;
var currentChat;

async function checkModelAvailability(){
  return new Promise(async function(resolve, reject){
    if (typeof LanguageModel === 'undefined') {
      showInfoDialog({
        status: 'error',
        icon: String.fromCharCode(parseInt('f634', 16)),
        title: 'LanguageModel not supported',
        details: [
          '<p>This browser does not appear to have a LanguageModel global. ',
          'This means you cannot run this application.</p>',
          '<p>Enable the Gemini API flags and try again:<p>',
          '<a href="javascript:chromeFlags()">chrome://flags</a>'
        ].join('\n')
      });
      resolve( false );
      return;
    }
    var availability = await LanguageModel.availability();
    switch (availability) {
      case 'unavailable':
        resolve(false);
        break;
      case 'available':
      case 'downloadable':
      case 'downloading':
        resolve(true);
    }
  });
}

async function createChat(options){ 
  options = Object.assign({}, options);
  var modelAbortController = new AbortController();
  var modelOptions = Object.assign({initialPrompts: options.initialPrompts || []}, options.modelOptions, {
    signal: modelAbortController.signal
  });

  var newChat = {
    modelAbortController: modelAbortController,
    options: options
  };

  newChat[historyDatabaseChatStoreId] = options[historyDatabaseChatStoreId] || crypto.randomUUID();
  newChat[historyDatabaseMessageSequenceNumber] = options[historyDatabaseMessageSequenceNumber] || 0;
  
  var conversation = getConversation();
  conversation.innerHTML = '';
  
  if (options.conversation !== undefined) {
    var initialPrompts = modelOptions.initialPrompts;
    for (var i = 0; i < options.conversation.length; i++){
      var message = options.conversation[i];
      var text = message.text;
      var type = message.type;
      var initialPrompt = {content: text};
      var role;
      var ui;
      switch (type){ 
        case 'request':
          ui = createRequestUi(text, message[historyDatabaseMessageStoreTimestamp]);
          role = 'user';
          break;
        case 'response':
        default:
          role = 'assistant';
          ui = createResponseUi(message[historyDatabaseMessageStoreTimestampReceived]);
          ui.querySelector('section').innerHTML = md2html(text);
          finishResponse('finished', message[historyDatabaseMessageStoreTimestamp], ui);
          break;
      }     
      ui.scrollIntoView(false);
      initialPrompt.role = role;
      initialPrompts.push(initialPrompt);
    }
  }

  var model = await LanguageModel.create(modelOptions);
  newChat.model = model;
  return newChat;
}

function getConversation(){
  return byId('conversation');
}

function md2html(text){
  var mkHtml = marked.parse(text);
  var html = DOMPurify.sanitize(mkHtml);
  return html;
}

function updateTextUiElement(uiElement, text) {
  var html = md2html(text)
  uiElement.innerHTML = html;
  uiElement.parentNode.scrollIntoView(false);
}

function createRequestUi(text, timestamp){
  timestamp = timestamp || Date.now();
  var requestUi = instantiateTemplate('request-ui');
  
  requestUi.querySelector('header')
  .setAttribute(
    'data-ts-sent-string', 
    (new Date(timestamp)).toLocaleString()
  );
  
  var conversation = getConversation();
  conversation.append(requestUi);
  updateTextUiElement(requestUi.querySelector('section'), text);
  return requestUi;
}

function createResponseUi(timestamp){
  timestamp = timestamp || Date.now();
  var responseUi = instantiateTemplate('response-ui');

  responseUi.querySelector('header')
  .setAttribute(
    'data-ts-received-string', 
    (new Date(timestamp)).toLocaleString()
  );
  
  var conversation = getConversation();
  conversation.append(responseUi);
  return responseUi;
}

async function newChat(){
  currentChat = await createChat();
  var conversation = getConversation();
  conversation.innerHTML = '';
  var textArea = getPromptTextArea();
  textArea.focus();
  return currentChat;
}

async function handleResponse(response){
  var timestamp = Date.now();
  try {
    updateStatus('receiving');
    responseUi = createResponseUi(timestamp);
    responseUi.setAttribute('data-status', 'in progress');
    responseBuffer = '';
    for await (const chunk of response){
      handleResponseChunk(chunk);
    }

    var message = {
      text: responseBuffer,
      type: 'response',
      inputUsage: currentChat.model.inputUsage
    };
    message[historyDatabaseMessageStoreTimestampReceived] = timestamp;
    saveMessage(message);
  }
  catch (err) {
  }
  finally {
    finishResponse('finished');
    updateStatus('ready');
  }
}

function finishResponse(status, timestamp, ui){
  timestamp = timestamp || Date.now();
  ui = ui || responseUi;
  ui.setAttribute('data-status', status || 'finished');
  
  ui.querySelector('footer')
  .setAttribute(
    'data-ts-finished-string', 
    (new Date(timestamp)).toLocaleString()
  );
}

function handleResponseChunk(chunk){
  responseBuffer += chunk;
  updateTextUiElement(responseUi.querySelector('section'), responseBuffer);
}
