// see: https://developer.chrome.com/docs/ai/summarizer-api 

var summarizers = {
};

async function getSummarizer(options, downloadProgessListener){
  console.log(`getSummarizer`, navigator.userActivation);  
  var props = {
    sharedContext: undefined,
    type: 'key-points',                 //tldr, teaser, key-points, headline
    format: 'markdown',                 //markdown, plain-text
    length: 'medium',                   //short, medium, long
    expectedInputLanguages: ['en'],
    expectedContextLanguages: ['en'],
    outputLanguage: 'en'                //language
  };
  var summarizerOptions = Object.assign(props, options);
  delete summarizerOptions.context;
  delete summarizerOptions.includeInputUsage;
  delete summarizerOptions.includeOutput;
  
  var summarizerKey = JSON.stringify(summarizerOptions);
  var summarizer = summarizers[summarizerKey];
  if (summarizer){
    return summarizer;
  }
  
  if (typeof Summarizer === 'undefined') {
    var msg = `This browser does not support the Summarizer global. Try to enable chrome://flags/#:~:text=Summarization%20API%20for%20Gemini%20Nano and retry.`;
    throw new Error(msg);
  }

  console.log(`check Summarizer availability`, navigator.userActivation);  
  var availability = await Summarizer.availability(summarizerOptions);
  if (availability === 'unavailable') {
    var msg = `The Summarizer API is not available.`;
    throw new Error(msg);
  }

  if (typeof downloadProgessListener === 'function'){
    summarizerOptions.monitor = function(m){
      m.addEventListener('downloadprogress', downloadProgessListener);
    };
  }

  try {
    console.log(`creating Summarizer`, navigator.userActivation);  
    summarizer = await Summarizer.create(summarizerOptions);
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
  summarizers[summarizerKey] = summarizer;
  return summarizer;
}

async function getSummarizerInputUsage(text, options, downloadProgessListener){
  console.log(`getSummarizerInputUsage`, navigator.userActivation);  
  var summarizer = await getSummarizer(options, downloadProgessListener);  
  var ret = {
    inputQuota: summarizer.inputQuota
  };
  
  try {
    var inputUsage = await summarizer.measureInputUsage(text);
    ret.inputUsage = inputUsage;
  }
  catch(e){
    switch (e.name){
      case 'OperationError':
        switch (e.message) {
          case 'The usage cannot be calculated.':
            break;
          default:
        }
        break;
    }
    console.error(e);
    ret.error = e;
  }
  
  return ret;
}

async function summarize(text, options, downloadProgessListener){
  console.log(`summarize`, navigator.userActivation);  
  options = options || {};
  
  var languageDetectionEnabled = options.languageDetectionEnabled || false;
  delete options.languageDetectionEnabled;
  if (languageDetectionEnabled === true && options.expectedInputLanguages === undefined) {
    var detectedInputLanguage = await detectLanguage(
      text, 
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
  
  var summarizer;
  try {
    summarizer = await getSummarizer(options, downloadProgessListener);
  }
  catch(e) {
    console.error(e);
    throw e;
  }

  var summaryOptions;
  if (options.context) {
    summaryOptions = { 
      context: options.context 
    };
  }
  
  var inputUsage = await getSummarizerInputUsage(text, options);
  if (inputUsage instanceof Error) {
    inputUsage;
  }
  
  var summary;
  try {
    summary = summarizer.summarizeStreaming(text, summaryOptions);
  }
  catch (e){
    console.error(e);
    return e;
  }
   
  return summary;
}