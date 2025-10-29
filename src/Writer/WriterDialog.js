function writerDialogStateChanged(event){
  
}

async function handleWriteClicked(event){
  try {
    console.log(`handleWriteClicked`, navigator.userActivation);
    await doWrite();
  }
  catch(e){
    console.error(e);
  }  
}

async function doWrite(){
  console.log(`doWrite`, navigator.userActivation);
  var writerDialog = getWriterDialog();
  var currentState = getFormStateInfo(writerDialog).currentState;
  
  var text = currentState['input'];
  var context = currentState['context'];
  if (context.trim().length === 0){
    context = undefined;
  }
  
  var writingTone = currentState['writingTone-picker'];
  var writingLength = currentState['writingLength-picker'];
  var writingOutputFormat = currentState['writingOutputFormat-picker'];
  var sharedContext = undefined;
  
  setBusy(writerDialog);
  var writerTextStream;
  try {
    writerTextStream = await write(
      text, {
      context: context,
      sharedContext: sharedContext,
      //   "formal", "neutral", "casual" 
      tone: writingTone,
      //    "short", "medium", "long" 
      length: writingLength,      
      //  "plain-text", "markdown" 
      format: writingOutputFormat
    });
  }
  catch(e) {
    showInfoDialog(e);
  }  
  var ui = writerDialog.querySelector('div.response');  
  if (writerTextStream ){
    await handleResponseStream(writerTextStream, ui);
  }
  setBusy(writerDialog, false);
}

function getWriterDialog(){
  return byId('writer-dialog');
}

function initWriterDialog(){
  var writerDialog = getWriterDialog();
  
  var writeButton = writerDialog.querySelector('button[type=button][name=write]') 
  writeButton.addEventListener('click', handleWriteClicked); 
  var writerDialogStateElement = writerDialog.querySelector(stateElementSelector);
  writerDialogStateElement.addEventListener('change', writerDialogStateChanged, true);
  
  initInputOutputDialogHandlers( writerDialog );
}