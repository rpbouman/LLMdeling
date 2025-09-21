var responseUi;
var responseBuffer;
var currentChat;

function setMessageUiMeta(messageUi, message) {
  if (message.detectedLanguage){
    setMessageUiLanguage(messageUi, message.detectedLanguage);
  }
  messageUi.querySelector('header').setAttribute('data-model-input-usage', message.inputUsage);
}

function setMessageUiLanguage(messageUi, detectedLanguage){
  var section = messageUi.querySelector('section');
  section.setAttribute('lang', detectedLanguage.detectedLanguage);
  var attributeValue = JSON.stringify(detectedLanguage, null, 0);
  section.setAttribute('data-detected-language', attributeValue);
}

function getMessageUiLanguage(messageUi){
  var section = messageUi.querySelector('section');
  var detectedLanguage = section.getAttribute('data-detected-language');
  if (detectedLanguage) {
    try {
      detectedLanguage = JSON.parse(detectedLanguage);
    }
    catch(e){
      detectedLanguage = undefined;
    }
  }
  return detectedLanguage;  
}

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

function clearConversation(){
  var conversation = getConversation(); 
  conversation.setAttribute('data-expected-input-text', true);
  conversation.setAttribute('data-expected-input-image', false);
  conversation.setAttribute('data-expected-input-audio', false);
  conversation.innerHTML = '';
  return conversation;
}

async function createChat(options){ 
  options = Object.assign({}, options);
  var modelAbortController = new AbortController();

  var downloadProgressHandler = options.downloadProgressHandler;
  if (downloadProgressHandler){
    delete options.downloadProgressHandler;
  }
  else {
    downloadProgressHandler = globalDownloadProgressHandler;
  }
  
  var modelOptions = Object.assign(
    {
      initialPrompts: options.initialPrompts || []
    }, 
    options.modelOptions, 
    {
      expectedInputs: options.expectedInputs
    },
    {
      signal: modelAbortController.signal
    },
    {
      monitor: createDownloadProgressMonitor(
        'LanguageModel',
        modelOptions
      )
    }
  );

  var newChat = {
    modelAbortController: modelAbortController,
    options: options
  };

  newChat[historyDatabaseChatStoreId] = options[historyDatabaseChatStoreId] || crypto.randomUUID();
  newChat[historyDatabaseMessageSequenceNumber] = options[historyDatabaseMessageSequenceNumber] || 0;
  
  currentChat = newChat;
  
  var conversation = clearConversation();
  
  if (options.conversation !== undefined) {
    var promptsToAppend = [];
    for (var i = 0; i < options.conversation.length; i++){
      var message = options.conversation[i];
      newChat[historyDatabaseMessageSequenceNumber] = message[historyDatabaseMessageSequenceNumber];
      var text = message.text;
      var requestOptions = message.requestOptions;
      var promptList = message.promptList;
      var type = message.type;
      var promptToAppend;
      
      if (promptList) {
        promptToAppend = promptList;
      }
      else {
        promptToAppend = {content: text};
      }
      
      if (requestOptions && requestOptions.responseConstraint){
        promptToAppend.responseConstraint = requestOptions.responseConstraint;
      }
      
      var role;
      var ui;
      switch (type){ 
        case 'request':
          ui = createRequestUi(
            promptToAppend, 
            message[historyDatabaseMessageStoreTimestamp], 
            message[historyDatabaseMessageMeasuredInputUsage]
          );
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
      if (message.detectedLanguage) {
        setMessageUiLanguage(ui, message.detectedLanguage);
      }
      ui.scrollIntoView(false);
      if (promptToAppend instanceof Array) {
        promptsToAppend = promptsToAppend.concat(promptToAppend);
      }
      else {
        promptToAppend.role = role;
        promptsToAppend.push(promptToAppend);
      }
    }
  }
  updateStatus('creating-model');
  var model;
  try {
    model = await LanguageModel.create(modelOptions);
  }
  catch(e) {
    debugger;
    e_name: switch (e.name){
      case 'NotAllowedError': 
        e_message: switch (e.message) {
          case 'The model process crashed too many times for this version.':
            showInfoDialog({
              info: `Error: ${e.name}`,
              details: `${e.message}.\r\nYou may try to clear the crash count in chrome://on-device-internals/` 
            });
            break e_name;
          default:
        }
        break;
      default:
        showInfoDialog({
          info: `Error: ${e.name}`,
          details: e.message
        });
    }
    console.error(e);
    return;
  }
  
  if (modelOptions.expectedInputs) {
    for (var i = 0; i < modelOptions.expectedInputs.length; i++){
      var expectedInput = modelOptions.expectedInputs[i];
      conversation.setAttribute('data-expected-input-' + expectedInput.type, true);
    }
  }
  
  if (promptsToAppend && promptsToAppend.length){
    updateStatus('appending-model-context');
    var appendResult = await model.append(promptsToAppend);
    updateStatus('model-context-appended');
  }
  newChat.model = model;
  updateStatus('ready');
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
      // normally, we just want to extract markdown
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
    case 'translate':
      var detectedLanguage = getMessageUiLanguage(messageUi);
      if (detectedLanguage) {
        detectedLanguage = detectedLanguage.detectedLanguage;
      }
      else {
        detectedLanguage = 'auto';
      }
      setTranslationDialogState({
        'text': content,
        'sourceLanguage': detectedLanguage
      });
      break;
    case 'summarize':
      setSummarizationDialogState({
        text: content
      });
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

function createRequestUi(promptToAppend, timestamp, measuredInputUsage){
  timestamp = timestamp || Date.now();
  
  var requestUi = instantiateTemplate('request-ui', getMessageAttributes());

  var header = requestUi.querySelector('header');  
  setAttributes(header, {
    'data-ts-sent-string': (new Date(timestamp)).toLocaleString(),
    'data-measured-input-usage': measuredInputUsage
  });  
  bindMessageActionHandlers(header);
  
  var text;
  if (typeof promptToAppend === 'string'){
    text = promptToAppend;
  }
  else 
  if (promptToAppend instanceof Array){
    text = serializePromptList(promptToAppend);
  }
  else
  if (typeof promptToAppend === 'object'){
    text = promptToAppend.content || '';
  }
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
    (new Date(timestamp)).toLocaleString(),
  );
  bindMessageActionHandlers(header);
  
  var conversation = getConversation();
  conversation.append(responseUi);
  return responseUi;
}

async function newChat(options){
  if (currentChat){
    try {
      if (currentChat.model) {
        currentChat.model.destroy();
        currentChat = null;
      }
    }
    catch(e){
      console.error(e);
      debugger;
    }
  }
  updateStatus('creating-new-chat-session');  
  var chat = await createChat(options);
  if (!chat) {
    return;
  }
  var conversation = getConversation();
  conversation.innerHTML = '';
  updateStatus('new-chat-session-created');
  updateStatus('ready');
  return currentChat;
}

async function handleResponse(response){
  var message = {
    type: 'response',
  };
  message[historyDatabaseMessageStoreTimestampReceived] = Date.now();
  message[historyDatabaseMessageSequenceNumber] = ++currentChat[historyDatabaseMessageSequenceNumber];
  try {
    updateStatus('receiving');
    responseUi = createResponseUi(message[historyDatabaseMessageStoreTimestampReceived]);
    message.text = await handleResponseStream(response, responseUi);
    
    message[historyDatabaseMessageModelInputUsage] = currentChat.model.inputUsage;
    var detectedLanguage = await detectLanguage(message.text);
    if (detectedLanguage) {
      message.detectedLanguage = detectedLanguage;
    }
    setMessageUiMeta(responseUi, message);      
    saveMessage(message);
  }
  catch (err) {
    console.error(err);
    debugger;
  }
  finally {
    finishResponse('finished', message[historyDatabaseMessageStoreTimestamp], responseUi);
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

function newChatHandler(event){
  newChat();
}

function initConversation(){
  byId('new-chat').addEventListener('click', newChatHandler);  
}