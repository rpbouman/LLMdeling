var conversationModel;
var abortController;
var inputUsageBeforeRequest;
var tsReq;
var responseUi;
var currentResponseNode;

function getApp(){
  var app = byId('app');
  return app;
}

function getConversation(){
  var conversation = byId('conversation');
  return conversation;
}

function getPrompt(){
  var taPrompt = document.getElementById('prompt');
  return taPrompt;
}

function createModel(callback, errorCallback, options){
  if (typeof LanguageModel === 'undefined'){
    errorCallback(new Error('This browser does not appear to support the LanguageModel global.'));
  }
  else {
    if (AbortController && !abortController) {
      abortController = new AbortController();
    }
    LanguageModel.create(options)
    .then(callback)
    .catch(errorCallback)
  }
  ;
}

var schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "additionalProperties": false,
  "type": "object",
  "description": "Schema for a flat stream of SAX-style events describing a styled and structured document.",
  "required": ["contentStream"],
  "properties": {
    "contentStream": {
      "type": "array",
      "items": {
        "type": "object",
        "oneOf": [
          {
            "type": "object",
            "description": "This opens a block to be closed by a subsequent tagClose chunk having the same tagname. This is like a HTML open tag.",
            "required": ["chunktype", "tagname"],
            "properties": {
              "chunktype": {
                "const": "tagOpen"
              },
              "tagname": {
                "description": "Tagnames define the structural function and visual appearance of the block defined by the tagOpen/tagClose pair.",
                "enum": ['paragraph', 'heading', 'list', 'listitem']
              },
              "attributes": {
                "description": "Attributes are name/value pairs that embellish or modify the appearance of the block defined by the tagOpen/tagClose pair. This is like HTML attributes.",
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["name", "value"],
                  "properties": {
                    "name": {
                      "type": "string"
                    },
                    "value": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          {
            "type": "object",
            "description": "This closes the previous tagOpen chunk with the same tagname, thus forming a block. This is like a HTML close tag",
            "required": ["chunktype", "tagname"],
            "properties": {
              "chunktype": {
                "const": "tagClose"
              },
              "tagname": {
                "enum": ['paragraph', 'heading', 'list', 'listitem']
              }
            }
          },
          {
            "type": "object",
            "description": "The text chunks carry literal text. Text MUST NOT contain markdown. All styling and structure must be conveyed through the tagOpen/tagClose chunks, as implied by their tagName and the attributes of the tagOpen chunk.",
            "required": ["chunktype", "text"],
            "properties": {
              "chunktype": {
                "const": "text"
              },
              "text": {
                "description": "Literal text.",
                "type": "string"
              }
            }
          }
        ]
      }
    }
  }
};

function createConversationModel(callback, errorCallback){
    
  createModel(
    callback,
    errorCallback,
    {
      initialPrompts: [
        {
          role: 'system',
          content: `
            Your name is "LocalBanter". 
            You are a LLM that responds with valid JSON that conforms to the specified schema:
            
            ${JSON.stringify(schema, null, 2)}
          `
        }
      ],
      responseConstraint: schema
    }
  )
}

function updateConversationStatus(status){
  var app = this.getApp();
  app.setAttribute('data-conversation-status', status);
}

function handleResponsePart(part){
  console.log([part])
  responseBuffer += part;
  var text = document.createTextNode(part);
  currentResponseNode.appendChild(text);
  scrollToContent();
}

function scrollToContent(){
  responseUi.scrollIntoView(false);
}

async function handleResponse(response){
  currentResponseNode = responseUi.querySelector('pre');
  responseBuffer = '';
  for await (const part of response) {
    try {
      handleResponsePart(part);
      updateConversationStatus('partial-response-received');
    }
    catch(error){
      alert(error);
      console.error(error);
      console.log(part)
      console.log(responseBuffer);
      handleStopClicked();
    }
  }  
  updateConversationStatus('response-received');
  finishResponse();
}

function finishResponse(){
  var tsRes = Date.now();
    
  responseUi.setAttribute('data-timestamp', tsRes );
  responseUi.setAttribute('data-time-elapsed', tsRes - tsReq);
  responseUi.setAttribute('data-input-usage-difference', (conversationModel.inputUsage - inputUsageBeforeRequest));
  responseUi.setAttribute('data-input-usage', conversationModel.inputUsage );
  responseUi.setAttribute('data-input-quota', conversationModel.inputQuota );
  responseUi.setAttribute('data-input-ratio', Math.round(100*conversationModel.inputUsage/conversationModel.inputQuota) );
  
  updateConversationStatus('ready');
}

async function handlePromptClicked(event){
  updateConversationStatus('prompt-received');
  var conversation = getConversation();
  
  var taPrompt = getPrompt();
  var text = taPrompt.value;
  
  var promptUi = instantiateTemplate('request');
  
  promptUi.innerText = text;
  conversation.appendChild(promptUi);
  promptUi.scrollIntoView(false);
  
  responseUi = instantiateTemplate('response');  
  conversation.appendChild(responseUi);
  taPrompt.value = '';
  
  tsReq = Date.now();
  inputUsageBeforeRequest = conversationModel.inputUsage;
  promptUi.setAttribute('data-timestamp', tsReq );
  updateConversationStatus('awaiting-response');
    
  var promptOptions = Object.assign({}, {
    signal: abortController.signal,
    responseConstraint: schema
  });
  
  try {
    var response = conversationModel.promptStreaming(
      text,
      promptOptions
    );
    await handleResponse(response);
  }
  catch(e){
    debugger;
  }
}

async function handleStopClicked(event){
  abortController.abort();
    
  var conversation = getConversation();
  var abortNode = instantiateTemplate('abortNode');
  abortNode.textContent = 'ABORTED';
  responseUi.appendChild(abortNode)
  
  abortController = new AbortController();
  finishResponse();
}

function handleClearClicked(event){
  createConversationModel(
    function(m){
      var conversation = getConversation();
      conversation.innerHTML = '';
      conversationModel = m;
    },
    function(err){
      alert(err);
      console.error(err.stack);
    },
  );
}

function init(){
  createConversationModel(function(m){
    if (conversationModel) {
      conversationModel.destroy();
      conversationModel = null;
    }

    conversationModel = m;

    byId('promptModel')
    .addEventListener('click', handlePromptClicked);

    byId('stop')
    .addEventListener('click', handleStopClicked);

    byId('clear')
    .addEventListener('click', handleClearClicked);
    
    updateConversationStatus('ready');
    byId('prompt').setAttribute('placeholder', 'Type to get started.');
  }, function(error){
    alert('Oops! Could not initialize LLM. ' + error);    
  });
}

init();


