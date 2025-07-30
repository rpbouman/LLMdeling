function byId(id){
  return document.getElementById(id);
}

function instantiateTemplate(templateId, idOrAttributes) {
  var template = byId(templateId);
  var clone = template.content.cloneNode(true);
  var index = 0, node;
  do {
    node = clone.childNodes.item(index++);
  } while (node && node.nodeType !== node.ELEMENT_NODE);
    
  var typeOfIdOrAttributes = typeof idOrAttributes;
  switch (typeOfIdOrAttributes) {
    case 'undefined':
      break;
    case 'string':
      node.setAttribute('id', idOrAttributes);
      break;
    case 'object':
      setAttributes(node, idOrAttributes);
      break;
    default:
      throw new Error(`Expected string id or attributes object, not ${typeOfIdOrAttributes}`);
  }
  return node;
}

function setAttribute(dom, attName, attValue){
  switch (attName) {
    case 'style':
      setStyle(dom, attValue);
      return;
    case 'class':
      setClass(dom, attValue);
      return;
    default:
  }    
  dom.setAttribute(attName, attValue);
}

function setStyle(dom, styleValue){
  switch (typeof styleValue){
    case 'undefined':
    case 'object':
      if (styleValue === null || styleValue === undefined){
        styleValue = '';
      }
      else {
        styleValue = Object.keys(styleValue).reduce(function(acc, curr){
          if (!acc) {
            acc = '';
          }
          else {
            acc += '\n';
          }
          acc += `${curr}: ${styleValue[curr]};`;
          return acc;
        });
      }
    case 'string':
      break;
    default:
      throw new Error(`Invalid value for style`);
  }
  dom.setAttribute('style', styleValue);
}

function setClass(dom, classNames){
  switch (typeof classNames) {
    case 'undefined':
    case 'object':
      if (classNames === null || classNames === undefined) {
        classNames = '';
      }
      else
      if (classNames instanceof Array) {
        classNames = classNames.join(' ');
      }
    case 'string':
      break;
  }
  dom.className = classNames;
}

function setAttributes(dom, attributes){
  for (var attName in attributes) {
    var attValue = attributes[attName];
    setAttribute(dom, attName, attValue);
  }
}
