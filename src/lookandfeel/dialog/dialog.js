async function showDialogWithHandler(dialogSelector, handler, modal, scope){
  var dialog = el(dialogSelector, scope);
  if (!dialog) {
    throw new Error(`Selector ${dialogSelector} didn't match an object`);
  }
  if (dialog.tagName !== 'DIALOG'){
    throw new Error(`Selector ${dialogSelector} didn't match a dialog element`);
  }
  return new Promise(async function(resolve, reject){
    if (typeof handler === 'function') {
      dialog.addEventListener('close', function(event){
        resolve(event.target.returnValue);
      }, {once: true});
      
      dialog.addEventListener('close', handler, {once: true});
      
      var dialogButtons = dialog.querySelectorAll(`div > footer:last-child > *[role=toolbar] > button[type=button]`);
      for (var i = 0; i < dialogButtons.length; i++){
        var dialogButton = dialogButtons.item(i);
        dialogButton.addEventListener('click', handler, {
          once: true
        });
      }
    }
    
    dialog[`show${modal ? 'Modal' : ''}`]();
  });
}

