
function abortRequest(){
  if (!currentChat) {
    return;
  }
  updateStatus('aborting');
  var message = {
    text: responseBuffer,
    type: 'abort'
  };
  message[historyDatabaseMessageModelInputUsage] = currentChat.model.inputUsage;

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

async function mesaureInputUsage(model, input) {
  var measuredInputUsage;
  try {
    measuredInputUsage = await model.measureInputUsage(input);
  }
  catch(e){
    measuredInputUsage = e.message;
  }
  return measuredInputUsage;
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
    updateStatus('creating-new-chat-session');
    currentChat = await newChat();
    updateStatus('new-chat-session-created');
  }
  message[historyDatabaseMessageSequenceNumber] = ++currentChat[historyDatabaseMessageSequenceNumber];
  var model = currentChat.model;
  
  var measuredInputUsage = await mesaureInputUsage(model, text);
  message[historyDatabaseMessageMeasuredInputUsage] = measuredInputUsage;
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
  var messageUi = createRequestUi(text, undefined, measuredInputUsage);
  if (detectedLanguage){
    setMessageUiLanguage(messageUi, detectedLanguage);
  }
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

function getElementPromptDialog(element){
  var dialog = element;
  while (dialog && dialog.tagName !== 'DIALOG') {
    dialog = dialog.parentNode;
  }
  if (!dialog){
    throw new Error(`Prompt dialog not found!`);
  }
  return dialog;
}

async function uploadPrompt(event){
  var target = event.target;
  var files = target.files;
  if (files.length === 0) {
    return;
  }
  
  var dialog = getElementPromptDialog(target);
  
  var file = files.item(0);
  var inputElement = getPromptDialogInputElement(dialog);
  inputElement.value = await file.text();
}

function getPromptDialogElement(promptDialog, elementSelector){
  var promptDialog = el(promptDialog);
  var element = promptDialog.querySelector(elementSelector);
  if (!element){
    throw new Error(`Prompt element ${elementSelector} not found!`);
  }
  return input;
}

function getPromptDialogInputElement(promptDialog){
  return getPromptDialogElement(promptDialog, '*:is( textarea, input)[name=input-prompt]')
}

function addItemToPromptList(event){
  var target = event.target;
  var dialog = getElementPromptDialog(target);
  
  var inputElement = getPromptDialogInputElement(promptDialog);
  var value = inputElement.value;
  value = value.trim();
  if (!value.length) {
    return;
  }
  
}

function getPromptDialogItemList(promptDialog){
  
}

function initLLMPrompts(){
  var sendPromptButtons = document.querySelectorAll('dialog.llm-prompt button[value="send-prompt"]');
  for (var i = 0; i < sendPromptButtons.length; i++){
    var sendPromptButton = sendPromptButtons.item(i);
    sendPromptButton.addEventListener('click', sendPrompt);
  }
  
  var abortResponseButtons = document.querySelectorAll('dialog.llm-prompt button[value="abort-response"]');
  for (var i = 0; i < abortResponseButtons.length; i++){
    var abortResponseButton = abortResponseButtons.item(i);
    abortResponseButton.addEventListener('click', abortRequest);
  }
  
  var uploadPromptFileInputs = document.querySelectorAll('dialog.llm-prompt input[type=file][name="uploadPromptText"]');
  for (var i = 0; i < uploadPromptFileInputs.length; i++){
    var uploadPromptFileInput = uploadPromptFileInputs.item(i);
    uploadPromptFileInput.addEventListener('change', uploadPrompt);
  }
  
  var addToListButtons = document.querySelectorAll('dialog.llm-prompt button[value=add-content-item]');
  for (var i = 0; i < addToListButtons.length; i++){
    var addToListButton = addToListButtons.item(i);
    addToListButton.addEventListener('click', addItemToPromptList);
  }
}
