
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

function serializePromptList(promptList){
  return promptList.map(function(item){
    return item.role + ':\r\n' + item.content;
  }).join('\r\n\r\n');
}

async function sendPrompt(event){
  var button = event.target;
  var dialog = getElementPromptDialog(button);
  
  var promptDialogListData = getPromptDialogListData(dialog);
  clearPromptDialogListData(dialog);
  
  var textArea = getPromptTextArea();
  var text = textArea.value;
  
  text = text.trim();
  // TODO: get any request options from the prompt dialog.
  var requestOptions = {};
  
  var message = {
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
      
  if (!currentChat.requestAbortController) {
    currentChat.requestAbortController = new AbortController();
  }
  requestOptions = Object.assign(requestOptions, {
    signal: currentChat.requestAbortController.signal
  });  

  var promptArg, messageForLanguageDetection;
  if (promptDialogListData) {
    if (text.length) {
      // we have a list but also a new prompt. We should append it to the list.
      // but then we need to fetch the current role from the prompt dialog.
      var roleElement = getPromptDialogRoleElement(dialog);
      var role = roleElement.value;
      promptDialogListData.push({
        role: role,
        content: text
      });
    }      
    message.promptList = promptDialogListData;
    promptArg = promptDialogListData;
    messageForLanguageDetection = promptDialogListData.map(function(listItem){
      return listItem.content;
    })
    .join('\r\n\r\n');
  }
  else {
    message.text = text;
    messageForLanguageDetection = text;
    promptArg = text;
  }

  updateStatus('sending');
  
  if (messageForLanguageDetection.trim().length) {
    var detectedLanguage = await detectLanguage(messageForLanguageDetection);
    message.detectedLanguage = detectedLanguage;
  }
  
  saveMessage(message);  
  var messageUi = createRequestUi(promptArg, undefined, measuredInputUsage);
  if (detectedLanguage){
    setMessageUiLanguage(messageUi, detectedLanguage);
  }
  
  var response = model.promptStreaming(promptArg, requestOptions);
  
  textArea.value = '';
  textArea.focus();
  
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
  return element;
}

function getPromptDialogInputElement(promptDialog){
  return getPromptDialogElement(promptDialog, '*:is( textarea, input)[name=input]');
}

function getPromptDialogRoleElement(promptDialog){
  return getPromptDialogElement(promptDialog, 'select[name=contentRole]');
}

function addItemToPromptList(event){
  var target = event.target;
  var dialog = getElementPromptDialog(target);
  
  var inputElement = getPromptDialogInputElement(dialog);
  var value = inputElement.value;
  value = value.trim();
  if (!value.length) {
    return;
  }
  
  var roleElement = getPromptDialogRoleElement(dialog);
  var role = roleElement.value;
  
  var list = getPromptDialogItemList(dialog);
  var tbody = list.tBodies.item(0);
  var rows = tbody.rows;
  var row = tbody.insertRow(rows.length);
  var cell;
  var cells = row.cells;
  
  cell = row.insertCell(cells.length);
  var checkbox = createEl('input', {
    type: 'checkbox'
  });
  cell.appendChild(checkbox);
  
  cell = row.insertCell(cells.length);
  cell.textContent = role;

  cell = row.insertCell(cells.length);
  cell.textContent = value;
  
  inputElement.value = '';
  inputElement.focus();
}

function getPromptDialogItemList(promptDialog){
  var list = promptDialog.querySelector('label[role=tab] + input[name=tabs][type=radio][value=list] + div[role=tabpanel] > table');
  return list;
}

function clearPromptDialogListData(promptDialog){
  var list = getPromptDialogItemList(promptDialog);
  var tbody = list.tBodies.item(0);
  var rows = tbody.rows;
  while (rows.length) {
    tbody.deleteRow(rows.item(0));
  }
}

function getPromptDialogListData(promptDialog){
  var list = getPromptDialogItemList(promptDialog);
  var tHead = list.tHead;
  var headerRow = tHead.rows.item(0);
  var headerCells = headerRow.cells;
  
  var tbody = list.tBodies.item(0);
  var rows = tbody.rows;
  var dataRows = [];
  for (var i = 0; i < rows.length; i++){
    var row = rows.item(i);
    var dataRow = {};
    var dataCells = row.cells;
    for (var j = 0; j < headerCells.length; j++){
      var headerCell = headerCells.item(j);
      var columnName = headerCell.getAttribute('data-column');
      if (!columnName) {
        continue;
      }
      var dataCell = dataCells.item(j);
      dataRow[columnName] = dataCell.textContent;
    }
    dataRows.push(dataRow);
  }
  
  if (!dataRows.length){
    return undefined;
  }
  return dataRows;
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
