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

  var textArea = form.querySelector(':scope > textarea, :scope > *[role=tablist] > *:has( > input[type=radio][name=tabs]:checked ) > textarea[role=tabpanel] ');
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

async function handleResponseStream(reponseStream, ui){
  ui.setAttribute('data-status', 'waiting for response');
  var responseText = '';
  
  var rawOutputUi = ui.querySelector('input[type=hidden]');
  var formattedOutputUi = ui.querySelector(':scope > section');
  var markdownOutputUi = ui.querySelector(':scope > pre > code.language-markdown');
  var htmlCodeOutputUi = ui.querySelector(':scope > pre > code.language-html');
  
  try{
    for await (const chunk of reponseStream){
      if (ui.getAttribute('data-status') === 'waiting for response') {
        ui.setAttribute('data-status', 'in progress');
      }
      responseText += chunk;
          
      var html = md2html(responseText)
      if (formattedOutputUi) {
        formattedOutputUi.innerHTML = html;
        formattedOutputUi.scrollIntoView(false);
      }

      if (markdownOutputUi){
        var markdownHighlightedHtml = hljs.highlight(responseText, {language: 'markdown'}).value;
        markdownOutputUi.innerHTML = markdownHighlightedHtml;
        markdownOutputUi.scrollIntoView(false);
      }

      if (htmlCodeOutputUi){
        var htmlHighlightedHtml = hljs.highlight(html, {language: 'html'}).value;
        htmlCodeOutputUi.innerHTML = htmlHighlightedHtml;
        htmlCodeOutputUi.scrollIntoView(false);
      }
      
      if (rawOutputUi) {
        rawOutputUi.value = responseText;
      }
    }
  }
  catch(error){
    debugger;
  }
  finally {
  }
  return responseText;
}

function initInputOutputDialogExportHandlers(inputOutputDialog){
  inputOutputDialog = el(inputOutputDialog);
  
  inputOutputDialog
  .querySelector('button[type=button][name=download]')
  .addEventListener(
    'click', 
    inputOutputDialogDownloadHandler
  );
  
  inputOutputDialog
  .querySelector('button[type=button][name=copy]')
  .addEventListener(
    'click', 
    inputOutputDialogCopyHandler
  );
}

function initInputOutputDialogImportHandlers(inputOutputDialog){
  inputOutputDialog = el(inputOutputDialog);
  
  inputOutputDialog
  .querySelector('label[for] > input[type=file]')
  .addEventListener(
    'change', 
    inputOutputDialogUploadHandler,
    true
  );
  
}

function initInputOutputDialogHandlers(inputOutputDialog){
  initInputOutputDialogImportHandlers(inputOutputDialog);
  initInputOutputDialogExportHandlers(inputOutputDialog);
}
