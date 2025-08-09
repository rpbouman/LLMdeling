async function inputOutputDialogUploadHandler(event){
  var target = event.target;
  var form = target.form;
  var formElements = form.elements;

  var text;
  var files = target.files;
  switch (files.length) {
    case 0:
      text = '';
      break;
    case 1:
    default:
      var file = files[0];
      text = await file.text();      
  }
  
  var textArea = form.querySelector('textarea');
  if (textArea.value != text) {
    textArea.value = text;
    dispatchChangeEvent(textArea);
  }
}

async function inputOutputDialogDownloadHandler(event){
  var target = event.target;
  var dialog = getAncestorWithTagName(target, 'DIALOG');
  var response = dialog.querySelector('*.response');
  var message = extractMessage(response, 'download');

  var content = message.content;
  var contentType = message.contentType;
  var extension = message.extension;

  var fileName = `LLMdeling.${extension}`;
  downloadBlob(content, fileName, contentType); 
}

async function inputOutputDialogCopyHandler(event){
  var target = event.target;
  var dialog = getAncestorWithTagName(target, 'DIALOG');
  var response = dialog.querySelector('*.response');
  var message = extractMessage(response, 'download');

  var content = message.content;
  copyToClipboard(content, 'text/plain');
}
