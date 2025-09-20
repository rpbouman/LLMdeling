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
  
  var writingTonePicker = currentState['writingTone-picker'];
  var writingLengthPicker = currentState['writingLength-picker'];
  var writingOutputFormatPicker = currentState['writingOutputFormat-picker'];
  var sharedContext = undefined;
  
  setBusy(writerDialog);
  var writerTextStream;
  try {
    writerTextStream = await write(
      text, {
      context: context,
      sharedContext: sharedContext,
      tone: writingTonePicker.value,            //tldr, teaser, key-points, headline
      length: writingLengthPicker.value,        //short, medium, long      
      format: writingOutputFormatPicker.value         //markdown, plain-text
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