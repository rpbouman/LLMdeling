var chatHistoryTabId = 'chatHistory';
var chatNodeTemplateId = 'chatHistoryNode';

function getChatHistoryTabPanel(){
  return getTabPanel(chatHistoryTabId); 
}

function formatFromToTimestamps(from, to){
  var start = new Date(from);
  var end = new Date(to);
  var startISO = start.toISOString();
  var endISO = end.toISOString();
  var startParts = startISO.split(/[T\.]/);
  var endParts = endISO.split(/[T\.]/);
  
  var timespan = '';
  if (startParts[0] === endParts[0]){
    timespan = startParts[0];
    timespan += ', ' + startParts[1];
    if (startParts[1] === endParts[1]){
      // noop
    }
    else {
      timespan += ` - ${endParts[1]}`; 
    }
  }
  else {
    timespan = `${startParts[0]} ${startParts[1]} - ${endParts[0]} ${endParts[1]}`; 
  }
  return timespan;
}

function updateChatStatistics(contents, messages){
  contents.setAttribute('data-messagecount', messages.length);
  
  var first = messages[0];
  var last = messages[messages.length - 1];
  var start = first[historyDatabaseMessageStoreTimestamp];
  var end = last[historyDatabaseMessageStoreTimestamp];
  var timespan = formatFromToTimestamps(start, end);
  contents.setAttribute('data-timespan', timespan);
}

async function chatNodeToggleHandler(event){
  if (event.newState === 'closed') {
    return;
  }
  
  var chatNode = event.target;
  var contents = chatNode.querySelector('div');
  if (contents.childNodes.length) {
    return;
  }

  contents.setAttribute('data-status', 'in progress');
  
  var chatId = getChatIdFromChatNode(chatNode);
  var messages = await getChatMessages(chatId);
  
  if (!messages.length){
    contents.setAttribute('data-status', 'ready');
    return;
  }
  
  updateChatStatistics(contents, messages);
  var first = messages[0];
  var last = messages[messages.length - 1];
  
  var currentSummary = undefined;
  var storedSummary = first.summary;
  // check if we have a stored summary
  if (storedSummary) {
    // we have! Now check if it's up to date
    // (the chat may have been extended after the last time the summary was generated)
    if (storedSummary[historyDatabaseMessageStoreTimestamp] >= last[historyDatabaseMessageStoreTimestamp]){
      // invalidate the current summary
      currentSummary = storedSummary;
    }
  }
  
  if (currentSummary){
    contents.appendChild(document.createTextNode(currentSummary.text));
  }
  else {
    try {
      currentSummary = await summarizeChat(messages);
      if (currentSummary instanceof Error || currentSummary === undefined){
        contents.setAttribute('data-status', 'ready');
        return;
      }
      
      var fullSummary = [];
      for await (var chunk of currentSummary) {
        fullSummary.push(chunk);
        contents.appendChild(document.createTextNode(chunk));
        contents.scrollIntoView(false);
      }
      fullSummary = fullSummary.join('');
      updateSummary(chatId, fullSummary);
    }
    catch (e){
      if (QuotaExceededError && e instanceof QuotaExceededError){
        debugger;
      }
    }
    finally {
      contents.setAttribute('data-status', 'ready');
    }
  }

  contents.setAttribute('data-status', 'ready');
}

function getChatIdFromChatNode(chatNode){
  return chatNode.getAttribute('data-' + historyDatabaseChatStoreId);
}

function getChatNodeFromButtonEvent(event){
  var button = event.target;
  var chatNode = button;
  var chatId;
  while (chatNode && (chatId = getChatIdFromChatNode(chatNode)) === null) {
    chatNode = chatNode.parentNode;
  }
  return chatNode;
}

async function restoreChatHandler(event){
  var chatNode = getChatNodeFromButtonEvent(event);
  var chatId = getChatIdFromChatNode(chatNode);
  var messages = await getChatMessages(chatId);
  
  var chat = {
    initialPrompts: undefined,
    modelOptions: {
      temperature: undefined,
      topK: undefined,
    },
    conversation: messages
  };
  
  if (messages && messages.length) {
    var first = messages[0];
    chat[historyDatabaseChatStoreId] = first[historyDatabaseChatStoreId];
    
    var modelParams = first.modelParams;
    chat.initialPrompts = modelParams.initialPrompts;
    chat.modelOptions.temperature = modelParams.temperature;
    chat.modelOptions.topK = modelParams.topK;

    var last = messages[messages.length - 1];
    chat[historyDatabaseMessageSequenceNumber] = last[historyDatabaseMessageSequenceNumber];
  }
  
  // TODO: update app state so user sees status information as creating a chat may take a while.
  currentChat = await createChat(chat);
  
  var promptId = messages.promptId || 'generic-prompt';
  byId(promptId).showPopover();
}

function deleteChatHandler(event){
  var chatNode = getChatNodeFromButtonEvent(event);
  var chatId = getChatIdFromChatNode(chatNode);
  deleteChatFromHistory(chatId);
  chatNode.parentNode.removeChild(chatNode);
}

async function extractAndCompileChat(chatId){
  var messages = await getChatMessages(chatId);
  var lines = [];
  messages.forEach(function(message){
    var type = message.type;
    var text = message.text;
    switch (type) {
      case 'request':
        break;
      case 'response':
        break;
    }
    lines.push(`**${type}:**`);
    lines.push('---');
    lines.push(`${text}`);
    lines.push('')
  });
  var plaintText = lines.join('\r\n');
  return plaintText;
}

async function copyChatHandler(event){
  var chatNode = getChatNodeFromButtonEvent(event);
  var chatId = getChatIdFromChatNode(chatNode);
  var plainText = await extractAndCompileChat(chatId);
  copyToClipboard(plainText, 'text/plain');
}

async function downloadChatHandler(event){
  var chatNode = getChatNodeFromButtonEvent(event);
  var chatId = getChatIdFromChatNode(chatNode);
  var plainText = await extractAndCompileChat(chatId);
  var fileName = `LLMdeling_${chatId}.md`;
  downloadBlob(plainText, fileName, 'text/markdown');
}

async function summarizeChatHandler(event){
  var chatNode = getChatNodeFromButtonEvent(event);
  var chatId = getChatIdFromChatNode(chatNode);
}

function createHistoryUiChatNode(chatRecord, append){
  var chatNode = instantiateTemplate(chatNodeTemplateId);
  chatNode.addEventListener('toggle', chatNodeToggleHandler);
  
  chatNode
  .querySelector('button[value=restoreChat]')
  .addEventListener('click', restoreChatHandler);

  chatNode
  .querySelector('button[value=deleteChat]')
  .addEventListener('click', deleteChatHandler);

  chatNode.querySelector('button[value=copyChat]')
  .addEventListener('click', copyChatHandler);

  chatNode.querySelector('button[value=summarizeChat]')
  .addEventListener('click', summarizeChatHandler);

  chatNode.querySelector('button[value=downloadChat]')
  .addEventListener('click', downloadChatHandler);

  var chatId = chatRecord[historyDatabaseChatStoreId];
  chatNode.setAttribute('data-' + historyDatabaseChatStoreId, chatId);

  var summary = chatNode.querySelector('summary');
  var ts = chatRecord[historyDatabaseMessageStoreTimestamp];
  
  var span = summary.querySelector('span');
  // note: do not use textContent!! If the text contains line breaks they will be rendered as <br>. 
  // by explicitly adding a text node, we avoid that.
  var label;
  if (chatRecord.promptList && chatRecord.promptList.length) {
    var text = extractTextFromPromptDialogListData(chatRecord.promptList);
    var lines = text.split(/[\r\n]+/);
    var line = lines.find(function(line){
      return Boolean(line.length);
    });
    label = line;
  }
  else
  if(chatRecord.text && chatRecord.text.length){
    label = chatRecord.text;
  }
  else
  if (chatRecord.requestOptions && chatRecord.requestOptions.responseConstraint) {
    var responseConstraint = chatRecord.requestOptions.responseConstraint;
    if (responseConstraint instanceof RegExp){
      label = `Regex: /${responseConstraint.source}/`;
    }
    else
    if (typeof responseConstraint === 'object') {
      label = JSON.stringify(responseConstraint);
    }
  }
  summary.title = `${(new Date(ts)).toISOString()}: ${label}`;
  span.appendChild( document.createTextNode(label) );
  
  var chatHistoryTabPanel = getChatHistoryTabPanel();
  
  if (append === undefined) {
    append = true;
  }
  if (append || chatHistoryTabPanel.childNodes.length === 0){
    chatHistoryTabPanel.appendChild(chatNode);
  }
  else {
    chatHistoryTabPanel.insertBefore(chatNode, chatHistoryTabPanel.firstChild);
  }
}

function initHistoryUi(){
  var chatHistoryTabPanel = getChatHistoryTabPanel();
  chatHistoryTabPanel.innerHTML = '';
  
  getMessageCursor(function(event){
    var cursor = event.target.result;
    if (!cursor) {
      return;
    }
    if (!cursor.value) {
      return;
    }
        
    if(cursor.value[historyDatabaseMessageSequenceNumber] === 1) {
      createHistoryUiChatNode(cursor.value);
    }
    cursor.continue();
  });
}