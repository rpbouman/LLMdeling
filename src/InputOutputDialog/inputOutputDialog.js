async function inputOutputDialogUploadHandler(event){
  var target = event.target;
  var form = target.form;
  var formElements = form.elements;

  var files = target.files;
  if (files.length === 1 ){
    var file = files[0];
    var text = await file.text();
    var textArea = form.querySelector('textarea');
    textArea .value = text;
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
