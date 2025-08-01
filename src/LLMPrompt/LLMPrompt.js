
function abortRequest(){
  if (!currentChat) {
    return;
  }
  updateStatus('aborting');
  var message = {
    text: responseBuffer,
    type: 'abort',
    inputUsage: currentChat.model.inputUsage
  };
  saveMessage(message);
  try {
    currentChat.requestAbortController.abort();
  }
  catch(e){
  }
  finishResponse('aborted');
  currentChat.requestAbortController = new AbortController();
  updateStatus('ready');
}

async function sendPrompt(){
  var textArea = getPromptTextArea();
  var text = textArea.value;
  
  // TODO: get any request options from the prompt dialog.
  var requestOptions = {};
  
  var message = {
    text: text,
    type: 'request',
    requestOptions: requestOptions
  };
  if (!currentChat) {
    currentChat = await newChat();
  }
  message[historyDatabaseMessageSequenceNumber] = ++currentChat[historyDatabaseMessageSequenceNumber];
  var model = currentChat.model;
  if (currentChat[historyDatabaseMessageSequenceNumber] === 1) {
    message.chatOptions = currentChat.options;
    var modelParams = {
      inputQuota: model.inputQuota,
      temperature: model.temperature,
      topK: model.topK
    };
    message.modelParams = modelParams;
  }
  var detectedLanguage = await detectLanguage(message.text);
  message.detectedLanguage = detectedLanguage;
  saveMessage(message);  
  updateStatus('sending');
  createRequestUi(text);
  
  textArea.value = '';
  textArea.focus();
  
  if (!currentChat.requestAbortController) {
    currentChat.requestAbortController = new AbortController();
  }
  requestOptions = Object.assign(requestOptions, {
    signal: currentChat.requestAbortController.signal
  });  
  
  var response = model.promptStreaming(text, requestOptions);
  updateStatus('waiting for response');
  handleResponse(response);
}

function getPromptText(){
  var textArea = getPromptTextArea();
  return textArea.value;
}

function getPromptTextArea(){
  var textArea = byId('prompt-text');
  return textArea;
}

function initLLMPrompts(){
  var sendPromptButtons = document.querySelectorAll('dialog.llm-prompt button[value="send-prompt"]');
  for (var i = 0; i < sendPromptButtons.length; i++){
    sendPromptButton = sendPromptButtons.item(i);
    sendPromptButton.addEventListener('click', sendPrompt);
  }
  
  var abortResponseButtons = document.querySelectorAll('dialog.llm-prompt button[value="abort-response"]');
  for (var i = 0; i < abortResponseButtons.length; i++){
    abortResponseButton = abortResponseButtons.item(i);
    abortResponseButton.addEventListener('click', abortRequest);
  }
  
}
