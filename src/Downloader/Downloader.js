function downloadURL(url, fileName) {
  var a;
  a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.style = 'display: none';
  a.click();
  a.remove();
}

function downloadBlob(data, fileName, mimeType, timeout) {
  var blob, url;
  blob = new Blob(
    [data]
  , {type: mimeType}
  );
  url = window.URL.createObjectURL(blob);
  downloadURL(url, fileName);
  timeout = typeof timeout === 'undefined' ? 1000 : timeout;
  setTimeout(function() {
    return window.URL.revokeObjectURL(url);
  }, timeout);
}
