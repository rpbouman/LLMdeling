
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
  // simple case: single suser prompt.
  if (promptList.length === 1 && promptList[0].role === 'user' && typeof promptList[0].content === 'string') {
    return promptList[0].content;
  }
  // complicated cases
  return promptList.map(function(item){
    var role = item.role;
    var content = item.content;
    var text;
    if (content instanceof Array){
      text = content.map(function(part){
        var typeofPart = typeof part;
        switch (typeofPart){
          case 'string':
            return part;
            break;
          case 'object':
            if (part.type){
              switch (part.type){
                case 'text':
                  return part.value;
                  break;
                case 'image':
                  var url = URL.createObjectURL(part.value);
                  return `![image](${url})`;
                  //return `<img src="${url}"/>`;
                  break;
                case 'audio':
                  break;
                default:
                  throw new Error(`Unsupported part of type ${part.type}`);
              }
            }
            else {
              throw new Error(`Expected part to have a type property`);
            }
            break;
          default:
            throw new Error(`Don't know how to handle part of type ${typeofPart}`);
        }
      }).join('\r\n');
    }
    else {
      text = content;
    }
    if (role){
      text = `${role}:\r\n${text}`;
    }
    return text;
  }).join('\r\n\r\n');
}

function extractTextFromPromptDialogListData(promptDialogListData){
  return promptDialogListData.map(function(listItem){
    var content = listItem.content;
    if (typeof content === 'string') {
      return content;
    }
    else 
    if (content instanceof Array) {
      return content
      .filter(function(item){
        return item.type === 'text' && typeof item.value === 'string' && item.value.length > 0;
      })
      .map(function(item){
        return item.value;
      })
      .join('\r\n');
    }
    else {
      return undefined;
    }
  })
  .filter(function(text){
    return typeof text === 'string';
  })
  .join('\r\n\r\n');
}

async function getPromptDialogConfig(dialog){
  var config = {};
  
  var promptDialogListData = await getPromptDialogListData(dialog);
  
  var textArea = getPromptTextArea(dialog);
  var text = textArea.value;
  
  text = text.trim();

  var messageForLanguageDetection, promptArg;
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
    promptArg = promptDialogListData;
    messageForLanguageDetection = extractTextFromPromptDialogListData(promptDialogListData);
  }
  else {
    messageForLanguageDetection = text;
    var roleElement = getPromptDialogRoleElement(dialog);
    var role = roleElement.value;
    promptArg = [{
      role: role,
      content: text
    }];
  }
  config.promptArg = promptArg;
  messageForLanguageDetection = messageForLanguageDetection.trim();
  if (messageForLanguageDetection.length){
    config.messageForLanguageDetection = messageForLanguageDetection;
  }
  
  var responseConstraint = getResponseConstraint(dialog);
  config.responseConstraint = responseConstraint;
  
  return config;
}

async function sendPrompt(event){
  var button = event.target;
  var dialog = getElementPromptDialog(button);
  
  var config = await getPromptDialogConfig(dialog);
  
  clearPromptDialogListData(dialog);
  
  // TODO: get any request options from the prompt dialog.
  var requestOptions = {};
  
  var message = {
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
      
  if (!currentChat.requestAbortController) {
    currentChat.requestAbortController = new AbortController();
  }
  requestOptions = Object.assign(requestOptions, {
    signal: currentChat.requestAbortController.signal
  });  

  var promptArg = config.promptArg;
  var messageForLanguageDetection = config.messageForLanguageDetection;
  var responseConstraint = config.responseConstraint;
  
  message.promptList = typeof promptArg === 'object' ? promptArg : undefined;
  message.text = typeof promptArg === 'string' && promptArg.length ? promptArg : undefined;
  
  var measuredInputUsage = await mesaureInputUsage(model, promptArg);
  message[historyDatabaseMessageMeasuredInputUsage] = measuredInputUsage;
 
  updateStatus('sending');
  
  if (messageForLanguageDetection) {
    var detectedLanguage = await detectLanguage(messageForLanguageDetection);
    message.detectedLanguage = detectedLanguage;
  }
  
  if (responseConstraint !== undefined){    
    requestOptions.responseConstraint = responseConstraint;
  }
  
  saveMessage(message);  
  var messageUi = createRequestUi(promptArg, undefined, measuredInputUsage, requestOptions.responseConstraint);
  if (detectedLanguage){
    setMessageUiLanguage(messageUi, detectedLanguage);
  }
  
  cleanupPromptDialog(dialog);
  
  var response = model.promptStreaming(promptArg, requestOptions);
  
  updateStatus('waiting for response');
  handleResponse(response);
}

function cleanupPromptDialog(dialog){
  var promptTextArea = getPromptTextArea(dialog);
  promptTextArea.value = '';
  promptTextArea.focus();
}

function getPromptText(dialog){
  var textArea = getPromptTextArea(dialog);
  return textArea.value;
}

function getPromptTextArea(dialog){
  var textArea = dialog.querySelector('textarea[name=input]');
  return textArea;
}

function getResponseConstraintText(dialog){
  var textArea = getResponseConstraintTextArea(dialog);
  return textArea.value;
}

function getResponseConstraintTextArea(dialog){
  var textArea = dialog.querySelector('textarea[name=responseConstraint]');
  return textArea;
}

function getResponseConstraint(dialog){
  var text = getResponseConstraintText(dialog);
  text = text.trim();
  
  if (text.length === 0){
    return;
  }
  
  var jsonSchema;
  try {
    jsonSchema = JSON.parse(text);
    var validationResult = hyperSchema.validate(jsonSchema);
    if (validationResult) {
      return jsonSchema;
    }
  }
  catch(e){
    //console.error(e);
  }
  
  var regex;
  try {
    regex = new RegExp(text);
    return regex;
  }
  catch(e){
  }
  
  return undefined;
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
  var selectedTab = getSelectedTab(dialog);
  
  var inputElement;
  switch (selectedTab.value){
    case 'input':
      inputElement = getPromptDialogInputElement(dialog);
      break;
    case 'responseConstraint':
      inputElement = getResponseConstraintTextArea(dialog);
      break;
  }
  
  if (inputElement){
    var file = files.item(0);
    inputElement.value = await file.text();
  }
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

function handleMediaInputChanged(event){
  var target = event.target;
  var label = target.parentNode;

  var files = target.files;
  var fileType, fileName;
  switch (files.length){
    case 0:
      fileType = 'none';
      fileName = '';
      break;
    case 1:
      file = files.item(0);
      fileType = file.type || 'text';
      fileName = file.name;
      break;
  }
  setAttributes(label, {
    'data-file-type': fileType,
    'data-file-name': fileName
  });

  var td = label.parentNode;
  var lastMediaInput = td.lastChild;
  if (lastMediaInput === label && fileType !== 'none'){
    td.appendChild( createMediaInput() );
  }
}

function createMediaInput(){  
  var input = createEl('input', {
    type: 'file',
    accept: 'audio/*,image/*,text/*',
    value: 'Browse...',
    'data-file-type': 'none'
  });
  input.addEventListener('change', handleMediaInputChanged);
  
  var label = createEl('label', {
  });
  label.appendChild(input);
  return label;
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

  cell = row.insertCell(cells.length);
  var mediaInput = createMediaInput();
  cell.appendChild(mediaInput);
  
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

async function getPromptDialogListData(promptDialog){
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
      switch (columnName) {
        case 'role':
        case 'text':
          dataRow[columnName] = dataCell.textContent;
          break;
        case 'media':
          var mediaInputs = dataCell.querySelectorAll('input[type=file]');
          if (mediaInputs && mediaInputs.length) {
            for (var k = 0; k < mediaInputs.length; k++){
              var mediaInput = mediaInputs.item(k);
              var files = mediaInput.files;
              if (files.length) {
                var file = files.item(0);
                var fileType = file.type || 'text';
                var fileTypeParts = fileType.split('/');
                var mediaRow = {
                  type: fileTypeParts[0],
                  value: file
                };
                
                if (fileType === 'text'){
                  mediaRow.value = await file.text();
                }
                
                if (dataRow.media === undefined) {
                  dataRow.media = [];
                }
                dataRow.media.push(mediaRow);
              }
            }
          }
      }
    }
    if (dataRow.media) {
      if (dataRow.text) {
        dataRow.media.unshift({type: 'text', value: dataRow.text})
        dataRow.content = dataRow.media;
        delete dataRow.text;
      }
      delete dataRow.media;      
    }
    else {
      dataRow.content = dataRow.text;
      delete dataRow.text;
    }
    dataRows.push(dataRow);
  }
  
  if (!dataRows.length){
    return undefined;
  }
  return dataRows;
}

function promptTabChanged(event){
  var target = event.target;
  var dialog = getAncestorWithTagName(target, 'DIALOG');
  var uploadButton = dialog.querySelector('div > form > menu[role=toolbar] > li > label > input[type=file]');
  
  var value = target.value;
  
  switch (value) {
    case 'input':
      uploadButton.setAttribute('accept', '.csv,.html,.md,text/*,.txt,.xml');
      break;
    case 'responseConstraint':
      uploadButton.setAttribute('accept', '.js,.json');
      break;
    case 'list':
      break;
  }
}

function getExpectedInputs(dialog){
  var expectedInputs = [];
  var expectedInputCheckboxes = dialog.querySelectorAll('div[role=tablist] > div:has( > input[type=radio][name=tabs][value=expectedInputs] ) > div[role=tabpanel] input[type=checkbox]');
  for (var i = 0; i < expectedInputCheckboxes.length; i++){
    var expectedInputCheckbox = expectedInputCheckboxes.item(i);
    if (!expectedInputCheckbox.checked){
      continue;
    }
    expectedInputs.push({type: expectedInputCheckbox.value});
  }
  return expectedInputs;
}

function getDialogModelOptions(dialog){
  var dialogToolbarForm = dialog.querySelector('form:has( menu[role=toolbar] )');
  var dialogToolbarFormElements = dialogToolbarForm.elements;
  var topKControl = dialogToolbarFormElements.topK;
  var temperatureControl = dialogToolbarFormElements.temperature;
  return {
    topK: topKControl.valueAsNumber,
    temperature: temperatureControl.valueAsNumber
  };
}

function cleanupModelConfigDialog(dialog){
  // reset everything to defaults
  clearPromptDialogListData(dialog);
  getResponseConstraintTextArea(dialog).value = '';
}

async function newModelHandler(event){
  var target = event.target;
  var dialog = getElementPromptDialog(target);
  var config = await getPromptDialogConfig(dialog);
  var expectedInputs = getExpectedInputs(dialog);
  var modelOptions = getDialogModelOptions(dialog);
  var newChatOptions = Object.assign(
    {}, 
    modelOptions, {
      expectedInputs: expectedInputs
    },
    {
      initialPrompts: config.promptArg,
    }
  );
  if (config.responseConstraint) {
    
    /*
    Passing constriaint as part of the prompt does not appear to work
    
    if (!newChatOptions.initialPrompts || !newChatOptions.initialPrompts.length) {
      var systemPrompt = 'You are a helpful assistant that provides responses structured and formatted according to the provided ';
      if (config.responseConstraint instanceof RegExp) {
        systemPrompt += 'regular expression.'
      }
      else {
        systemPrompt += 'json schema.'
      }
      newChatOptions.initialPrompts = [{
        role: 'system',
        content: systemPrompt
      }];
    }
    newChatOptions.initialPrompts[newChatOptions.initialPrompts.length - 1].responseConstraint = config.responseConstraint;
    */
    
    newChatOptions.responseConstraint = config.responseConstraint;
  }
  
  var currentChat = await newChat(newChatOptions);
  dialog.hidePopover();
  var genericPrompt = byId('generic-prompt');
  getResponseConstraintTextArea(genericPrompt).value = getResponseConstraintTextArea(dialog).value;
  cleanupModelConfigDialog(dialog);
  genericPrompt.showPopover();
  updateStatus('ready');
}

function responseConstraintChanged(event){
  var target = event.target;
  var dialog = getElementPromptDialog(target);
  var responseConstraint = getResponseConstraint(dialog);
  
  var dataAttribute;
  if (responseConstraint === undefined) {
    if (target.value.trim().length === 0) {
      dataAttribute = 'undefined';
    }
    else {
      dataAttribute = 'error';
    }
  }
  else
  if (responseConstraint instanceof RegExp){
    dataAttribute = 'regex';
  }
  else {
    dataAttribute = 'jsonschema';
  }
  target.setAttribute('data-response-constraint-type', dataAttribute);
}

function getResponseConstraintTextArea(dialog){
  return dialog.querySelector('textarea[name=responseConstraint]');
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
  
  var uploadPromptFileInputs = document.querySelectorAll('dialog.llm-prompt input[type=file][name="upload"]');
  for (var i = 0; i < uploadPromptFileInputs.length; i++){
    var uploadPromptFileInput = uploadPromptFileInputs.item(i);
    uploadPromptFileInput.addEventListener('change', uploadPrompt);
  }
  
  var addToListButtons = document.querySelectorAll('dialog.llm-prompt button[value=add-content-item]');
  for (var i = 0; i < addToListButtons.length; i++){
    var addToListButton = addToListButtons.item(i);
    addToListButton.addEventListener('click', addItemToPromptList);
  }
  
  var tabRadioButtons = document.querySelectorAll('dialog.llm-prompt input[type=radio][name=tabs]');
  for (var i = 0; i < tabRadioButtons.length; i++){
    var tabRadioButton = tabRadioButtons.item(i);
    tabRadioButton.addEventListener('change', promptTabChanged);
  }
  
  var responseConstraintTextAreas = document.querySelectorAll('dialog.llm-prompt textarea[name=responseConstraint]');
  for (var i = 0; i < responseConstraintTextAreas.length; i++){
    var responseConstraintTextArea = responseConstraintTextAreas.item(i);
    responseConstraintTextArea.addEventListener('change', responseConstraintChanged);
  }

  var button = byId('create-model-button');
  button.addEventListener('click', newModelHandler);
}
