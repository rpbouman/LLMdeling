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
  
  currentChat = newChat;
  
  var conversation = getConversation();
  conversation.innerHTML = '';
  
  if (options.conversation !== undefined) {
    var initialPrompts = modelOptions.initialPrompts;
    for (var i = 0; i < options.conversation.length; i++){
      var message = options.conversation[i];
      newChat[historyDatabaseMessageSequenceNumber] = message[historyDatabaseMessageSequenceNumber];
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
          updateTextUiElement(ui.querySelector('section'), text);
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

function updateTextUiElement(uiElement, text) {
  var html = md2html(text)
  uiElement.innerHTML = html;
  uiElement.parentNode.scrollIntoView(false);

  var parentNode = uiElement.parentNode;
  parentNode.querySelector('input[type=hidden]').value = text;
  
  if (parentNode.className !== 'response') {
    return;
  }

  var markdownHighlightedHtml = hljs.highlight(text, {language: 'markdown'}).value;
  parentNode.querySelector(':scope > pre > code.language-markdown').innerHTML = markdownHighlightedHtml;
  
  var htmlHighlightedHtml = hljs.highlight(html, {language: 'html'}).value;
  parentNode.querySelector(':scope > pre > code.language-html').innerHTML = htmlHighlightedHtml;
  
}

function bindMessageActionHandlers(container){
  var actionButtons = container.querySelectorAll(':scope *[role=menuitem] > button[type=button]');
  for (var i = 0; i < actionButtons.length; i++){
    var actionButton = actionButtons.item(i);
    actionButton.addEventListener('click', messageActionHandler);
  } 
}

function extractMessage(messageUi, actionCategory){
  var contentType = 'text/markdown';
  var extension = 'md';
  var messageText = messageUi.querySelector('input[type=hidden]').value;
  switch (actionCategory){
    case 'copy':
    case 'download':
      if (messageUi.className === 'response') {        
        var markdownFormatted = messageUi.querySelector('input[type=radio][name=format][value=markdown]');
        if (markdownFormatted.checked) {
          // if we're in markdown mode, we can just output the raw response
        }
        else {
          // if we're not in markdown mode, our output will be formatted (html). 
          contentType = 'text/html';
          extension = 'html';
          // but, the user can either be viewing the rendered html, or the html code view.
          // since its lame to have them return the same result, we will apply highlighting to the html code view.
          var highlighting = messageUi.querySelector('input[type=radio][name=format][value=html]').checked;
          
          messageText = md2html(messageText, highlighting);
        }
      }
      break;
    default:
  }
  return {
    content: messageText,
    type: contentType,
    extension: extension
  };
}

function messageActionHandler(event){
  var target = event.target;
  var actionCategory = target.name;
  var action = target.value;
  
  var messageUi = target;
  
  var conversation = getConversation();
  while (messageUi && messageUi.parentNode !== conversation) {
    messageUi = messageUi.parentNode;
  }
  if (!messageUi) {
    return;
  }
  var chatId = messageUi.getAttribute('data-' + historyDatabaseChatStoreId);
  var messageSequenceNumber = messageUi.getAttribute('data-' + historyDatabaseMessageSequenceNumber);

  var message = extractMessage(messageUi, actionCategory);
  var content = message.content;
  var contentType = message.contentType;
  var extension = message.extension;
  switch (actionCategory) {
    case 'download':
      var fileName = `LLMdeling_${chatId}_${messageUi.className}_${messageSequenceNumber}.${extension}`;
      downloadBlob(content, fileName, contentType);
      break;
    case 'copy':
      copyToClipboard(content, 'text/plain');
      break;
  }
}

function getMessageAttributes(){
  var attributes = {};
  [historyDatabaseChatStoreId, historyDatabaseMessageSequenceNumber].forEach(function(attribute){
    attributes['data-' + attribute] = currentChat[attribute];
  });  
  return attributes;
}

function createRequestUi(text, timestamp){
  timestamp = timestamp || Date.now();
  
  var requestUi = instantiateTemplate('request-ui', getMessageAttributes());

  var header = requestUi.querySelector('header');  
  header.setAttribute(
    'data-ts-sent-string', 
    (new Date(timestamp)).toLocaleString()
  );  
  bindMessageActionHandlers(header);
  
  updateTextUiElement(requestUi.querySelector('section'), text);
  
  var conversation = getConversation();
  conversation.append(requestUi);
  return requestUi;
}

function createResponseUi(timestamp){
  timestamp = timestamp || Date.now();
  var responseUi = instantiateTemplate('response-ui', getMessageAttributes());

  var header = responseUi.querySelector('header');  
  header.setAttribute(
    'data-ts-received-string', 
    (new Date(timestamp)).toLocaleString()
  );
  bindMessageActionHandlers(header);
  
  var conversation = getConversation();
  conversation.append(responseUi);
  return responseUi;
}

async function newChat(){
  await createChat();
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
    var detectedLanguage = await detectLanguage(message.text);
    message.detectedLanguage = detectedLanguage;    
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
