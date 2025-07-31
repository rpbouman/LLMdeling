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
  var chatNode = event.target;
  var contents = chatNode.querySelector('div');
  if (contents.childNodes.length) {
    return;
  }

  contents.setAttribute('data-status', 'in progress');
  
  var chatId = getChatIdFromChatNode(chatNode);
  var messages = await getChatMessages(chatId);
  
  if (!messages.length){
    return;
  }
  
  updateChatStatistics(contents, messages);
  var first = messages[0];
  var last = messages[messages.length - 1];
  
  var storedSummary = first.summary;
  if (storedSummary) {
    if (storedSummary[historyDatabaseMessageStoreTimestamp] < last[historyDatabaseMessageStoreTimestamp]){
      storedSummary = undefined;
    }
  }
  
  if (storedSummary){
    contents.appendChild(document.createTextNode(storedSummary.text));
  }
  else {
    summary = await summarizeChat(messages);
    if (summary === undefined){
      return;
    }
    var fullSummary = [];
    for await (var chunk of summary) {
      fullSummary.push(chunk);
      contents.appendChild(document.createTextNode(chunk));
      contents.scrollIntoView(false);
    }
    fullSummary = fullSummary.join('');
    updateSummary(chatId, fullSummary);
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
  
  currentChat = await createChat(chat);
}

function deleteChatHandler(event){
  var chatNode = getChatNodeFromButtonEvent(event);
  var chatId = getChatIdFromChatNode(chatNode);
  deleteChatFromHistory(chatId);
  chatNode.parentNode.removeChild(chatNode);
}

async function copyChatHandler(event){
  var chatNode = getChatNodeFromButtonEvent(event);
  var chatId = getChatIdFromChatNode(chatNode);
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
  copyToClipboard(plaintText, 'text/plain');
}

async function downloadChatHandler(event){
  var chatNode = getChatNodeFromButtonEvent(event);
  var chatId = getChatIdFromChatNode(chatNode);
}

async function regenerateSummaryHandler(event){
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

  chatNode.querySelector('button[value=regenerateSummary]')
  .addEventListener('click', regenerateSummaryHandler);

  chatNode.querySelector('button[value=downloadChat]')
  .addEventListener('click', downloadChatHandler);

  var chatId = chatRecord[historyDatabaseChatStoreId];
  chatNode.setAttribute('data-' + historyDatabaseChatStoreId, chatId);

  var summary = chatNode.querySelector('summary');
  var ts = chatRecord[historyDatabaseMessageStoreTimestamp];
  summary.title = `${(new Date(ts)).toISOString()}: ${chatRecord.text}`;
  
  var span = summary.querySelector('span');
  // note: do not use textContent!! If the text contains line breaks they will be rendered as <br>. 
  // by explicitly adding a text node, we avoid that.
  span.appendChild( document.createTextNode(chatRecord.text) );
  
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