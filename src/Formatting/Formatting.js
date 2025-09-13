var nonHighlightingMarked;
var highlightingMarked;
var parseTreeMarked;
function md2html(text, highlighting){
  
  if (typeof highlighting === 'undefined') {
    highlighting = true;
  }
  
  var mk = highlighting === true ? highlightingMarked : nonHighlightingMarked;
  
  var mkHtml = mk.parse(text);
  //var html = mkHtml;
  // TODO: make this more safe. 
  // Objective here is to allow rendering of images from object urls.
  var html = DOMPurify.sanitize(mkHtml, {ALLOW_UNKNOWN_PROTOCOLS: true});
  return html;
}

function getCurrentFormat(ui){
  var ui = el(ui);
  var currentFormat = ui.querySelector('input[type=radio][name=format]:checked').value;
  return currentFormat;
}

function initMarked(){
  /**
  * Setup for highlighting code blocks.
  *   This requires "marked-highlight" a plugin for marked to allow code blocks to be handled separately.
  *   But "marked-highlight" only enables separate processing of code blocks, the actual highlighting is down by highlight.js
  * 
  * See: 
  *   https://marked.js.org/using_pro#extensions
  *   https://www.npmjs.com/package/marked-highlight
  *   https://highlightjs.readthedocs.io/en/latest/readme.html#id3
  */
  const { Marked } = globalThis.marked;
  const { markedHighlight } = globalThis.markedHighlight;
  
  nonHighlightingMarked = new Marked();
  highlightingMarked = new Marked(
    markedHighlight({
      emptyLangClass: 'hljs',
      langPrefix: 'hljs language-',
      highlight(code, lang, info) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      }
    })
  );
}

var parsingMarked;
function parseMarkdown(text){
  var tokens = undefined;
  if (parsingMarked === undefined) {
    const { Marked } = globalThis.marked;
    var parser = new Marked();
    var walkTokens = function(token){
      if (tokens === undefined) {
        tokens = [];
      }
      tokens.push(token);
    }
    parser.use({ walkTokens });
    parsingMarked = parser;
  }
  var output = parsingMarked.parse(text);
  return {
    output: output,
    tokens: [].concat(tokens)
  };
}