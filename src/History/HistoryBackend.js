var historyDatabase;
var historyDatabaseName = 'LLMdeling';
var historyDatabaseMessageStoreName = 'messages';
var historyDatabaseChatStoreId = 'chatId';
var historyDatabaseMessageSequenceNumber = 'messageSequence';
var historyDatabaseMessageStoreTimestamp = 'timestamp';
var historyDatabaseMessageStoreTimestampReceived = historyDatabaseMessageStoreTimestamp + 'Received';
var historyDatabaseMessageModelInputUsage = 'inputUsage';
var historyDatabaseMessageMeasuredInputUsage = 'measuredInputUsage';
var historyDatabaseModelLibraryStoreName = 'models';

function initHistoryBackend(callback){
  var historyDatabaseRequest = indexedDB.open(historyDatabaseName, 1);
  
  historyDatabaseRequest.onerror = function(event){
    console.error(`Error opening History database.`);
    if (typeof callback === 'function') {
      callback({
        status: 'error'
      });
    }
  };
  
  historyDatabaseRequest.onsuccess = function(event){
    historyDatabase = event.target.result;
    if (typeof callback === 'function'){
      callback({
        status: 'success'
      });
    }
  };
  
  historyDatabaseRequest.onupgradeneeded = function(event){
    var database = event.target.result;
    var messageStore = database.createObjectStore(historyDatabaseMessageStoreName, {autoIncrement: true});

    var indexOptions = {unique: false};
    var messageChatIndex = messageStore.createIndex(
      historyDatabaseChatStoreId, 
      historyDatabaseChatStoreId, 
      indexOptions
    );
    var messageSequenceIndex = messageStore.createIndex(
      historyDatabaseMessageSequenceNumber,
      historyDatabaseMessageSequenceNumber,
      indexOptions
    );
    
    var modelStore = database.createObjectStore(modelLibraryStoreName, {autoIncrement: true});
    var indexOptions = {unique: true};
    var modelNameIndex = modelStore.createIndex(
      modelLibraryStoreName, 
      modelLibraryStoreName, 
      indexOptions
    );
  }
}

function getMessageStore(options){
  if (!historyDatabase){
    return;
  }
  
  var otherOptions = {};
  switch (typeof options ) {
    case 'undefined':
      break;
    case 'string':
      otherOptions.mode = options;
      break;
    case 'object':
      if (options){
        otherOptions = Object.assign(options);
      }
  }
  var mode = otherOptions.mode || 'readonly';  
  delete otherOptions['mode'];
  
  var transaction = historyDatabase.transaction([historyDatabaseMessageStoreName], mode, otherOptions);
  var objectStore = transaction.objectStore(historyDatabaseMessageStoreName);
  
  return objectStore;
}

function serializeChatMessages(messages){
  var lines = [];
  messages.forEach(function(message){
    var type = message.type;
    var text;
    if (message.promptList) {
      text = serializePromptList(message.promptList);
    }
    else 
    if (message.text) {
      text = message.text;
    }
    lines.push(`**${type}:**`);
    lines.push('---');
    lines.push(`${text}`);
    lines.push('');
  });
  var plainText = lines.join('\r\n');
  return plainText;
}

async function summarizeChat(messages){
  var summary;
  try {
    var fullText = serializeChatMessages(messages);
    var summaryLength = getSummaryLength(messages);

    var options = {
      sharedContext: 'This is a conversation between a user and a chatbot. User prompts are preceded by **request:**-line. Bot replies are preceded by **response:**-line.',
      type: 'tldr',
      format: 'plain-text',
      length: summaryLength,
      context: `Summarize the conversation so it can be understood at a glance. Aim to extract the essence of the response(s) that satisfy the user's request(s). Don't dwell on the development of the dialog.`
    };

    summary = await summarize(fullText, options);
  }
  catch(e) {
    console.warn(e);
    return e;
  }
  finally {
  }
  return summary;
}

function getSummaryLength(messages){
  var length = messages.reduce(function(acc, curr){
    var text;
    
    var promptList = curr.promptList;

    if (promptList) {
      text = serializePromptList(promptList);
    }
    else {
      text = curr.text;
    }
    
    if (text) {
      acc += text.split(/\n/).length;
    }
    return acc;
  }, 0);
  if (length <= 3) {
    return 'short';
  }
  else
  if (length <= 5){
    return 'medium';
  }
  return 'medium';
}

function storeMessageInHistory(message){
  if (!historyDatabase){
    return;
  }
  message[historyDatabaseMessageStoreTimestamp] = Date.now();
  var messageStore = getMessageStore('readwrite');
  var addRequest = messageStore.add(message);
}

function getMessageCursor(onsuccess, onerror, options){
  var messageStore = getMessageStore('readonly');
  if (!messageStore){
    return;
  }
  
  var cursor = messageStore.openCursor(undefined, 'prev');
  if (typeof onsuccess === 'function'){
    cursor.onsuccess = onsuccess;
  }
  if (typeof onerror === 'function'){
    cursor.onerror = onerror;
  }
}

function updateSummary(chatId, fullSummary){
  getChatCursor(chatId, function(event){
    var cursor = event.target.result;
    if (!cursor) {
      return;
    }
    if (!cursor.value) {
      return;
    }
    
    var summary = {
      text: fullSummary
    };
    summary[historyDatabaseMessageStoreTimestamp] = Date.now();
    
    cursor.value.summary = summary;
    cursor.update(cursor.value);
    
  }, onerror, 'readwrite');
}

function getChatCursor(chatId, onsuccess, onerror, options){
  var messageStore = getMessageStore(options);
  if (!messageStore){
    return;
  }

  var chatIdIndex = messageStore.index(historyDatabaseChatStoreId);

  var cursor = chatIdIndex.openCursor(chatId);
  if (typeof onsuccess === 'function'){
    cursor.onsuccess = onsuccess;
  }
  if (typeof onerror === 'function'){
    cursor.onerror = onerror;
  }  
}

function deleteChatFromHistory(chatId){
  getChatCursor(chatId, function(event){
    var cursor = event.target.result;
    if (!cursor) {
      return;
    }
    if (!cursor.value) {
      return;
    }
    cursor.delete();
    cursor.continue();    
  }, undefined, {mode: 'readwrite'});
}

function getChatMessages(chatId){
  return new Promise(function(resolve, reject){

    var messages = [];
    getChatCursor(chatId, function(event){
      var cursor = event.target.result;
      if (cursor && cursor.value) {
        messages.push(cursor.value);
        cursor.continue();    
      }
      else {
        messages
        .sort(function(a, b){
          var aKey = a[historyDatabaseMessageSequenceNumber];
          var bKey = b[historyDatabaseMessageSequenceNumber];
          var sortKey;
          if (aKey > bKey){
            sortKey = 1;
          }
          else
          if (bKey > aKey) {
            sortKey = -1;
          }
          else {
            sortKey = 0;
          }
          return sortKey;
        });
        resolve(messages);
        return;
      }
    }, undefined, {mode: 'readonly'});  
  });
}

function saveMessage(message){
  if (message.requestOptions) {
    message = Object.assign({}, message);
    delete message.requestOptions.signal;
  }
  message[historyDatabaseChatStoreId] = currentChat[historyDatabaseChatStoreId];
  message[historyDatabaseMessageSequenceNumber] = currentChat[historyDatabaseMessageSequenceNumber];
  storeMessageInHistory(message);
  if (message[historyDatabaseMessageSequenceNumber] === 1) {
    createHistoryUiChatNode(message, false);
  }
}
