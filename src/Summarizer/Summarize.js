function getSummarizationDialog(){
  var summarizationDialog = byId('summarization-dialog');
  return summarizationDialog;
}

async function handleSummarizeClicked(event){
  doSummarize();
}

async function doSummarize(){
  var summarizationDialog = getSummarizationDialog();
  var currentState = getFormStateInfo(summarizationDialog).currentState;
  
  var text = currentState['input'];
  
  var sharedContext = currentState['sharedContext'];
  var summaryType = currentState['summaryType-picker'];
  var summaryLength = currentState['summaryLength-picker'];
  var summaryFormat = currentState['summaryOutputFormat-picker']
  
  setBusy(summarizationDialog);
  var summaryTextStream = await summarize(
    text, {
    sharedContext: sharedContext,
    type: summaryType,            //tldr, teaser, key-points, headline
    length: summaryLength,        //short, medium, long      
    format: summaryFormat         //markdown, plain-text
  });
  
  var ui = summarizationDialog.querySelector('div.response');  
  await handleResponseStream(summaryTextStream, ui);
  setBusy(summarizationDialog, false);
}

async function summarizationDialogStateChanged(event){
  var target = event.target;
  var form = target.form;
  var formElements = form.elements;
  
  var detail = event.detail;
  var previousState = detail.previousState;
  var currentState = detail.currentState;
  var stateChange = detail.stateChange;
 
  // check if we should start translating
  var autoSummarize = currentState['autoSummarize'];
  if (autoSummarize === false){
    return;
  }
  doSummarize();  
}

async function initSummarizationDialog(){

  var summarizationDialog = getSummarizationDialog();
  
  var summarizeButton = summarizationDialog.querySelector('button[type=button][name=summarize]') 
  summarizeButton.addEventListener('click', handleSummarizeClicked); 
  var summarizationDialogStateElement = summarizationDialog.querySelector(stateElementSelector);
  summarizationDialogStateElement.addEventListener('change', summarizationDialogStateChanged, true);
  
  initInputOutputDialogHandlers(summarizationDialog);
}

function setSummarizationDialogState(state){
  var summarizationDialog = getSummarizationDialog();
  var dialogState = getFormStateInfo(summarizationDialog).currentState;
  delete dialogState['upload'];  

  var text = state.text;
  if (text){
    dialogState['input'] = text;
  }
  var context = state.context;
  if (context){
    dialogState['context'] = context;
  }
  setFormState(summarizationDialog, dialogState);
}