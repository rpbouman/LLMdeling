//see: chrome://flags/#language-detection-api
//https://developer.chrome.com/docs/ai/language-detection

var languageDetector;

async function getLanguageDetectorInfo(downloadProgessListener){
  var languageDetectorInfo = {
    languageDetector: languageDetector,
    availability: undefined
  };
  
  if (languageDetector){
    languageDetectorInfo.availability = 'available';
    return languageDetectorInfo;
  }

  if (typeof LanguageDetector === 'undefined') {
    languageDetectorInfo.availability = 'no such API';
    return languageDetectorInfo;
  }

  var availability = await LanguageDetector.availability();
  languageDetectorInfo.availability = availability;
  switch (availability) {
    case 'unavailable':
    case 'downloading':
      return languageDetectorInfo;    
  }
  
  var languageDetectorOptions;
  if (typeof downloadProgessListener === 'function'){
    languageDetectorOptions = {
      monitor(m) {
        m.addEventListener('downloadprogress', downloadProgessListener);
      }
    };
    languageDetectorOptions.monitor = function(m){
      m.addEventListener('downloadprogress', downloadProgessListener);
    };
  }
  try {
    languageDetector = await LanguageDetector.create(languageDetectorOptions);
  }
  catch(e){
    console.error(e);
    console.error(e.stack);
    return languageDetector;
  }
  languageDetectorInfo.languageDetector = languageDetector;
  
  return languageDetectorInfo;
}

async function getLanguageDetector(downloadProgessListener){
  var languageDetectorInfo = await getLanguageDetectorInfo(downloadProgessListener);
  await languageDetector.ready;  
  return languageDetector;
}

async function detectLanguages(text, downloadProgessListener){
  var languageDetector = await getLanguageDetector( downloadProgessListener );
  var results = await languageDetector.detect( text );
  return results;
}

function applyEliminationResultsToLanguageDetectionResults(results, rules){
  if (!(rules instanceof Array)){
    return results;
  }  
  var rulesToApply = [].concat(rules);
  var filteredResults = [].concat(results);
  while (
    Boolean( rulesToApply.length ) && 
    Boolean( filteredResults.length > 1)
  ) {
    var rule = rulesToApply.shift();
    filteredResults = rule.call(null, filteredResults);
  };
  return filteredResults;
}

function eliminateLanguageDetectionResults(results, extraRules) {
  var defaultRules = [
    // this rule eliminates everything that has less than 50% confidence.
    function(results){
      return results.filter(function(result){
        return result.confidence > .5;
      });
    },
    // this rule calculates the average confidence, and eliminates all that have less than the average
    function(results){
      var sum = results.reduce(function(acc, curr){
        acc += curr.confidence;
        return acc;
      }, 0);
      var avg = sum / results.length;
      results = results.filter(function(result){
        return result.confidence > avg;
      });
      return results;
    }
  ];
  var rules = [].concat(defaultRules);
  if (extraRules instanceof Array){
    rules = [].concat(rules, extraRules);
  }  
  results = applyEliminationResultsToLanguageDetectionResults(results, rules);
  return results;
}

async function detectLanguage(text, downloadProgessListener){
  var languages;
  try {
    languages = await detectLanguages(text, downloadProgessListener);
  }
  catch(e){
    console.error(e);
    return;
  }
  languages = eliminateLanguageDetectionResults(languages);
  if (languages.length > 1) {
    return;
  }
  var language = languages[0];
  return language;
}
