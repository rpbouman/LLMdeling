// see: https://developer.chrome.com/docs/ai/writer-api 

async function getWriter(options, downloadProgessListener){
  console.log(`getWriter`, navigator.userActivation);  
  var props = {
    sharedContext: undefined,
    tone: 'neutral',                    //formal, neutral, casual
    format: 'markdown',                 //markdown, plain-text
    length: 'medium',                   //short, medium, long
    expectedInputLanguages: ['en'],
    expectedContextLanguages: ['en'],
    outputLanguage: 'en'                //language
  };
  var writerOptions = Object.assign(props, options);
    
  if (typeof Writer === 'undefined') {
    var msg = `This browser does not support the Writer global. Try to enable chrome://flags/#:~:text=Writer%20API%20for%20Gemini%20Nano and retry.`;
    throw new Error(msg);
  }

  console.log(`check Writer availability`, navigator.userActivation);  
  var availability = await Writer.availability(writerOptions);
  if (availability === 'unavailable') {
    var msg = `The Writer API is not available.`;
    throw new Error(msg);
  }

  if (typeof downloadProgessListener === 'function'){
    writerOptions.monitor = function(m){
      m.addEventListener('downloadprogress', downloadProgessListener);
    };
  }
  
  var writer;
  try {
    console.log(`creating Writer`, navigator.userActivation);  
    writer = await Writer.create(writerOptions);
  }
  catch(e) {
    var name = e.name;
    var message = e.message;
    switch (name){
      case 'NotAllowedError':
        switch (message){
          case 'Requires a user gesture when availability is "downloading" or "downloadable".':
            break;
        }
        break;
      case 'InvalidState':
        switch (message){
          case 'The device is unable to create a session to run the model. Please check the result of availability() first.':
            break;
        }
        break;
      default:
    }
    console.error(e);
    throw e;
  }
  return writer;
}

async function write(writingInstruction, options, downloadProgessListener){
  console.log(`write`, navigator.userActivation);  
  options = options || {};
  
  var languageDetectionEnabled = options.languageDetectionEnabled || false;
  delete options.languageDetectionEnabled;
  if (languageDetectionEnabled === true && options.expectedInputLanguages === undefined) {
    var detectedInputLanguage = await detectLanguage(
      writingInstruction, 
      downloadProgessListener
    );
    if (detectedInputLanguage) {
      options.expectedInputLanguages = [detectedInputLanguage.detectedLanguage];
    }
  }
  
  if (languageDetectionEnabled === true && options.expectedContextLanguages === undefined) {
    var expectedContextLanguages = {};
    
    var detectedSharedContextLanguage;
    if (options.sharedContext){
      detectedSharedContextLanguage = await detectLanguage(
        options.sharedContext, 
        downloadProgessListener
      );
      if (detectedSharedContextLanguage){
        expectedContextLanguages[detectedSharedContextLanguage.detectedLanguage] = detectedSharedContextLanguage.confidence;
      }
    }
    
    var detectedContextLanguage;
    if (options.context) {
      detectedContextLanguage = await detectLanguage(
        options.context, 
        downloadProgessListener
      );
      if (detectedContextLanguage){
        expectedContextLanguages[detectedContextLanguage.detectedLanguage] = detectedContextLanguage.confidence;
      }
    }
    
    options.expectedContextLanguages = Object.keys(expectedContextLanguages);
    if (options.expectedContextLanguages.length === 0) {
      options.expectedContextLanguages = undefined;
    }
  }
  
  if (languageDetectionEnabled === true && options.outputLanguage === undefined) {
    if (options.expectedContextLanguages && options.expectedContextLanguages.length){
      options.outputLanguage = options.expectedContextLanguages[0];
    }
    else
    if (options.expectedInputLanguages && options.expectedInputLanguages.length) {
      options.outputLanguage = options.expectedInputLanguages[0];      
    }
  }
  
  var writer;
  try {
    writer = await getWriter(options, downloadProgessListener);
  }
  catch(e) {
    console.error(e);
    throw e;
  }

  var writerOptions;
  if (options.context) {
    writerOptions = { 
      context: options.context 
    };
  }
    
  var output;
  try {
    output = writer.writeStreaming(writingInstruction, writerOptions);
  }
  catch (e){
    console.error(e);
    return e;
  }
   
  return output;
}