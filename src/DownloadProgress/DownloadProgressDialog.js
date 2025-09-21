function getDownloadProgressDialog(){
  return byId('download-progress-dialog');
}

var downloadProgressId = 0;
function createDownloadProgressMonitor(apiName, options){
  var carrier = {
    id: ++downloadProgressId,
    apiName: apiName,
    options: options,
  };
  var handler = globalDownloadProgressHandler.bind(carrier);
  return function(m){
    m.addEventListener('downloadprogress', handler);
  }
}

function globalDownloadProgressHandler(event){
  var loaded = event.loaded;
  var context = this;
  var progressDialog = getDownloadProgressDialog();
  var section = progressDialog.querySelector('section')
  var id = context.id;
  var progressItem, progressBar;
  
  switch (loaded) {
    case 0:
      progressItem = instantiateTemplate('model-download-progress-item', {
        id: 'model-download-progress-item' + id
      });
      var label = progressItem.querySelector('label');
      var labelText = `${context.apiName} ${id}`;
      label.textContent = labelText;
      section.appendChild(progressItem);
      progressDialog.showPopover();
      break;
    default:
      progressItem = byId('model-download-progress-item' + id);
      progressBar = progressItem.querySelector('progress');
      progressBar.value = loaded * 100;
      if (loaded < 1){
        break;
      }
      section.removeChild(progressItem);
      if (section.querySelector('div') === null){
        progressDialog.hidePopover();
      }
      break;
  }
}