function rewriterDialogStateChanged(event){
  
}

async function handleRewriteClicked(event){
  try {
    console.log(`handleRewriteClicked`, navigator.userActivation);
    await doRewrite();
  }
  catch(e){
    console.error(e);
  }  
}

async function doRewrite(){
  console.log(`doRewrite`, navigator.userActivation);
  var rewriterDialog = getRewriterDialog();
  var currentState = getFormStateInfo(rewriterDialog).currentState;
  
  var text = currentState['input'];
  var context = currentState['context'];
  if (context.trim().length === 0){
    context = undefined;
  }
  
  var writingTone = currentState['writingTone-picker'];
  var writingLength = currentState['writingLength-picker'];
  var writingOutputFormat = currentState['writingOutputFormat-picker'];
  var sharedContext = undefined;
  
  setBusy(rewriterDialog);
  var rewriterTextStream;
  try {
    rewriterTextStream = await rewrite(
      text, {
      context: context,
      sharedContext: sharedContext,
      //  "formal", "neutral", "casual" 
      tone: writingTone,    
      //  "short", "medium", "long" 
      length: writingLength,     
      //  markdown, plain-text
      format: writingOutputFormat
    });
  }
  catch(e) {
    showInfoDialog(e);
  }  
  var ui = rewriterDialog.querySelector('div.response');  
  if (rewriterTextStream ){
    await handleResponseStream(rewriterTextStream, ui);
  }
  setBusy(rewriterDialog, false);
}

function getRewriterDialog(){
  return byId('rewriter-dialog');
}

function initRewriterDialog(){
  var rewriterDialog = getRewriterDialog();
  
  var rewriteButton = rewriterDialog.querySelector('button[type=button][name=rewrite]') 
  rewriteButton.addEventListener('click', handleRewriteClicked); 
  var rewriterDialogStateElement = rewriterDialog.querySelector(stateElementSelector);
  rewriterDialogStateElement.addEventListener('change', rewriterDialogStateChanged, true);
  
  initInputOutputDialogHandlers( rewriterDialog );
}