// see: https://developer.chrome.com/docs/ai/summarizer-api 

var summarizers = {
};

async function summarize(text, options, downloadProgessListener){
  var props = {
    sharedContext: undefined,
    type: 'key-points',                 //tldr, teaser, key-points, headline
    format: 'markdown',                 //markdown, plain-text
    length: 'medium',                   //short, medium, long
    expectedInputLanguages: ['en'],
    expectedOutputLanguages: ['en'],
    outputLanguage: 'en'  //short, medium, long
  };
  var summarizerOptions = Object.assign(props, options);
  delete summarizerOptions.context;
  delete summarizerOptions.includeInputUsage;
  delete summarizerOptions.includeOutput;
  
  var summarizerKey = JSON.stringify(summarizerOptions);
  var summarizer = summarizers[summarizerKey];
  if (!summarizer){
    if (typeof Summarizer === 'undefined') {
      var msg = `This browser does not support the Summarizer global. Try to enable chrome://flags/#:~:text=Summarization%20API%20for%20Gemini%20Nano and retry.`;
      throw new Error(msg);
    }

    var availability = await Summarizer.availability();
    if (availability === 'unavailable') {
      var msg = `The Summarizer API is not available.`;
      throw new Error(msg);
    }

    if (typeof downloadProgessListener === 'function'){
      summarizerOptions.monitor = function(m){
        m.addEventListener('downloadprogress', downloadProgessListener);
      };
    }

    summarizer = await Summarizer.create(summarizerOptions);
    summarizers[summarizerKey] = summarizer;
  }
  
  var summaryOptions;
  if (options.context) {
    summaryOptions = { 
      context: options.context 
    };
  }
  var inputUsage = await summarizer.measureInputUsage(text);
  var summary = summarizer.summarizeStreaming(text, summaryOptions);
  return summary;
}