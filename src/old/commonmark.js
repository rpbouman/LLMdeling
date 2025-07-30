function parse(markdown){
  
  // https://spec.commonmark.org/0.31.2/#characters-and-lines
  //
  // A line is a sequence of zero or more characters other than line feed (U+000A) or carriage return (U+000D), followed by a line ending or by the end of file.
  // A line ending is a line feed (U+000A), a carriage return (U+000D) not followed by a line feed, or a carriage return and a following line feed.
  //
  // HTML: depends. Lines indicate a block level element but which one depends on the type of line, which is typically revealed by the metachars at the start of the line.
  //
  var lines = markdown.split(/\r\n|\n|\r|$/);
  var blockTypes = {
    empty: /^$/,
    thematicBreak: /^ {0,3}[-_\*]{3}[ \t]*$/,
    atxHeading: /^ {0,3}(?<atxHeadingOpeningSequence>#{1,6})([ \t]+(#+[ \t]*|(?<inlineContent>((?!([ \t]+(#+[ \t]*)?)?$).)+)([ \t]+(#+[ \t]*)?)?)$|$)/,
    codeFence: /^(?<indentation>[ ]{0,3})((?<tildecodefence>~{3,})(?<tildeinfostring>((?![ \t]+$).)+)?|(?<backtickcodefence>`{3,})(?<backtickinfostring>((?![ \t]+$)[^`])+)?)[ \t]*$/,
    listItem: /^(?<indentation>[ \t]*)(?<listmarker>((?<bullet>[\-\+\*])|(?<ordered>(?<number>\d{1,9})[\.\)])))[ ]{1,4}(?<listItemContent>((?![ \t]+$).)+)[ \t]*$/,
    paragraphLine: /^(?<lineContent>.+)$/
  };
  var lineTypes = lines.map(function(line){
    for (var blockTypeName in blockTypes) {
      var blockTypeRegex = blockTypes[blockTypeName];
      var match = blockTypeRegex.exec(line);
      if (match){
        return {
          blockTypeName: blockTypeName,
          match: match[0],
          groups: match.groups,
        }
      }
    }
  });
  return JSON.stringify(lineTypes, null, 2);
  
  // https://spec.commonmark.org/0.31.2/#thematic-breaks
  //
  // A line consisting of optionally up to three spaces of indentation, followed by a sequence of three or more matching -, _, or * characters, each followed optionally by any number of spaces or tabs, forms a thematic break.
  // More than three characters may be used:
  // Spaces and tabs are allowed between the characters:
  // Spaces and tabs are allowed at the end:
  // However, no other characters may occur in the line:
  // It is required that all of the characters other than spaces or tabs be the same:
  // If a line of dashes that meets the above conditions for being a thematic break could also be interpreted as the underline of a setext heading, the interpretation as a setext heading takes precedence.
  // When both a thematic break and a list item are possible interpretations of a line, the thematic break takes precedence:
  // 
  // HTML: <hr/>
  // 
  var thematicBreak = /^ {0,3}[-_\*]{3}[ \t]*$/;
  
  // https://spec.commonmark.org/0.31.2/#atx-headings
  //
  // An ATX heading consists of a string of characters, parsed as inline content, between an opening sequence of 1–6 unescaped # characters and an optional closing sequence of any number of unescaped # characters.
  // The opening sequence of # characters must be followed by spaces or tabs, or by the end of line. 
  // The optional closing sequence of #s must be preceded by spaces or tabs and may be followed by spaces or tabs only. 
  // The opening # character may be preceded by up to three spaces of indentation. 
  // The raw contents of the heading are stripped of leading and trailing space or tabs before being parsed as inline content. 
  // The heading level is equal to the number of # characters in the opening sequence.
  // At least one space or tab is required between the # characters and the heading’s contents, unless the heading is empty.
  //  
  // HTML: <h1> through <h6>
  //
  var atxHeading = /^ {0,3}(?<atxHeadingOpeningSequence>#{1,6})([ \t]+(#+[ \t]*|(?<inlineContent>((?!([ \t]+(#+[ \t]*)?)?$).)+)([ \t]+(#+[ \t]*)?)?)$|$)/;
  
  // https://spec.commonmark.org/0.31.2/#setext-headings
  //
  // HTML: <h1> if the line character is =, <h2> if the line character is -
  //
  var setextHeadingUnderline = /^ {0,3}(-+|=+)[ \t]*$/;
  
  // https://spec.commonmark.org/0.31.2/#indented-code-blocks
  //
  // An indented code block is composed of one or more indented chunks separated by blank lines. 
  // An indented chunk is a sequence of non-blank lines, each preceded by four or more spaces of indentation. 
  // The contents of the code block are the literal contents of the lines, including trailing line endings, minus four spaces of indentation. 
  // An indented code block has no info string.
  // If there is any ambiguity between an interpretation of indentation as a code block and as indicating that material belongs to a list item, the list item interpretation takes precedence:
  // However, any non-blank line with fewer than four spaces of indentation ends the code block immediately.  
  // Blank lines preceding or following an indented code block are not included in it:
  
  // https://spec.commonmark.org/0.31.2/#fenced-code-blocks
  //
  // A code fence is a sequence of at least three consecutive backtick characters (`) or tildes (~). 
  // (Tildes and backticks cannot be mixed.) 
  // A fenced code block begins with a code fence, preceded by up to three spaces of indentation.
  // The line with the opening code fence may optionally contain some text following the code fence;
  // this is trimmed of leading and trailing spaces or tabs and called the info string. 
  // If the info string comes after a backtick fence, it may not contain any backtick characters. 
  // (The reason for this restriction is that otherwise some inline code would be incorrectly interpreted as the beginning of a fenced code block.)
  // The content of the code block consists of all subsequent lines, until a closing code fence of the same type as the code block began with (backticks or tildes), 
  // and with at least as many backticks or tildes as the opening code fence.
  // If the leading code fence is preceded by N spaces of indentation, then up to N spaces of indentation are removed from each line of the content (if present). 
  // (If a content line is not indented, it is preserved unchanged. If it is indented N spaces or less, all of the indentation is removed.)
  // The closing code fence must use the same character as the opening fence:
  // The closing code fence must be at least as long as the opening fence:
  // Unclosed code blocks are closed by the end of the document (or the enclosing block quote or list item):
  // A code block can have all empty lines as its content:
  // A code block can be empty:
  // Fences can be indented. If the opening fence is indented, content lines will have equivalent opening indentation removed, if present:
  // Four spaces of indentation is too many:
  // Closing fences may be preceded by up to three spaces of indentation, and their indentation need not match that of the opening fence:
  // An info string can be provided after the opening code fence. Although this spec doesn’t mandate any particular treatment of the info string, the first word is typically used to specify the language of the code block. 
  // In HTML output, the language is normally indicated by adding a class to the code element consisting of language- followed by the language name.
  
  var codeFence = /^(?<indentation>[ ]{0,3})((?<tildecodefence>~{3,})(?<tildeinfostring>((?![ \t]+$).)+)?|(?<backtickcodefence>`{3,})(?<backtickinfostring>((?![ \t]+$)[^`])+)?)[ \t]*$/;
  
  // https://spec.commonmark.org/0.31.2/#html-blocks
  //
  // An HTML block is a group of lines that is treated as raw HTML (and will not be escaped in HTML output).
  // There are seven kinds of HTML block, which can be defined by their start and end conditions. 
  // The block begins with a line that meets a start condition (after up to three optional spaces of indentation). 
  // It ends with the first subsequent line that meets a matching end condition, 
  // or the last line of the document, or the last line of the container block containing the current HTML block, 
  // if no line is encountered that meets the end condition. 
  // If the first line meets both the start condition and the end condition, the block will contain just that line.
  
  // https://spec.commonmark.org/0.31.2/#paragraphs
  //
  // A sequence of non-blank lines that cannot be interpreted as other kinds of blocks forms a paragraph. 
  // The contents of the paragraph are the result of parsing the paragraph’s raw content as inlines.
  // The paragraph’s raw content is formed by concatenating the lines and removing initial and final spaces or tabs.
  // Multiple blank lines between paragraphs have no effect:
  // Leading spaces or tabs are skipped:
  // Lines after the first may be indented any amount, since indented code blocks cannot interrupt paragraphs.
  // However, the first line may be preceded by up to three spaces of indentation. Four spaces of indentation is too many:
  // Final spaces or tabs are stripped before inline parsing, so a paragraph that ends with two or more spaces will not end with a hard line break
  
  // https://spec.commonmark.org/0.31.2/#blank-lines
  //
  // Blank lines between block-level elements are ignored, except for the role they play in determining whether a list is tight or loose.
  // Blank lines at the beginning and end of the document are also ignored.
  
  // https://spec.commonmark.org/0.31.2/#container-blocks
  //
  // A container block is a block that has other blocks as its contents.
  // There are two basic kinds of container blocks: block quotes and list items.
  // Lists are meta-containers for list items.
  // We define the syntax for container blocks recursively. The general form of the definition is:
  // If X is a sequence of blocks, then the result of transforming X in such-and-such a way is a container of type Y with these blocks as its content.
  // So, we explain what counts as a block quote or list item by explaining how these can be generated from their contents.
  // This should suffice to define the syntax, although it does not give a recipe for parsing these constructions.
  
  // https://spec.commonmark.org/0.31.2/#block-quotes
  //
  // A block quote marker, optionally preceded by up to three spaces of indentation, 
  // consists of (a) the character > together with a following space of indentation, 
  // or (b) a single character > not followed by a space of indentation.
  // 
  
  // https://spec.commonmark.org/0.31.2/#list-items
  // 
  // A list marker is a bullet list marker or an ordered list marker.
  // A bullet list marker is a -, +, or * character.
  // An ordered list marker is a sequence of 1–9 arabic digits (0-9), followed by either a . character or a ) character. 
  // (The reason for the length limit is that with 10 digits we start seeing integer overflows in some browsers.)
  var listItem = /^(?<indentation>[ \t]*)(?<listmarker>((?<bullet>[\-\+\*])|(?<ordered>(?<number>\d{1,9})[\.\)])))[ ]{1,4}(?<listItemContent>(?![ \t]+$).+)[ \t]*$/;
  return lines;
}

function onParseClicked(){
  var value = document.getElementById('input').value;
  var result = parse(value);
  document.getElementById('output').value = result;
}

function init(){
  document.getElementById('parse').onclick = onParseClicked;
}

init();