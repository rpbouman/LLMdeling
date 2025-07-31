var nonHighlightingMarked;
var highlightingMarked;
function md2html(text, highlighting){
  
  if (typeof highlighting === 'undefined') {
    highlighting = true;
  }
  
  var mk = highlighting === true ? highlightingMarked : nonHighlightingMarked;
  
  var mkHtml = mk.parse(text);
  var html = DOMPurify.sanitize(mkHtml);

  return html;
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