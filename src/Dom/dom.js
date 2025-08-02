function byId(id){
  return document.getElementById(id);
}

function createEl(tagName, attributes, content){
  var el = document.createElement(tagName);
  if (content) {
    switch (typeof content){
      case 'string':
        el.innerHTML = content;
        break;
    }
  }
  if (!attributes){
    return el;
  }
  setAttributes(el, attributes);
  return el;
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

function getClassNames(dom){
  var className = dom.className;
  if (!className) {
    return undefined;
  }
  var classNames = className.split(/\s+/);
  return classNames.length ? classNames : undefined;
}

function hasClass(dom, classNames, allOrSome){
  if (typeof classNames === 'string'){
    classNames = [classNames];
  }
  if (! (classNames instanceof Array) ) {
    throw new Error(`Invalid classname argument`);
  }
  var domClassNames = getClassNames(dom);
  if (domClassNames === undefined) {
    return false;
  }
  var noMatch;
  for (var i = 0; i < classNames.length; i++){
    noMatch = domClassNames.indexOf(classNames[i]) === -1;
    
    if (allOrSome && noMatch) {
      return false;
    }
    else 
    if (!allOrSome && !noMatch){
      return true;
    }
  }
  return !noMatch;
}

function replaceClass(dom, oldClass, newClass){
  var classNames = getClassNames(dom);
  var indexOfOldClass = classNames.indexOf(oldClass);
  if (indexOfOldClass === -1){
    return;
  }
  var args = [indexOfOldClass, 1];
  if (classNames.indexOf(newClass) === -1) {
    args.push(newClass);
  }
  Array.prototype.splice.apply(classNames, args);
  dom.className = classNames.join(' ');
}

function getAncestorWithTagName(dom, tagName, includeSelf){
  if (!dom) {
    return undefined;
  }
  
  if (includeSelf === undefined) {
    includeSelf = true;
  }

  tagName = tagName.toUpperCase();
  var node = includeSelf ? dom : dom.parentNode;
  while(isEl(node)) {
    if (node.tagName === tagName){
      return node;
    }
    node = node.parentNode;
  }    
  return undefined;
}

function getAncestorWithClassName(dom, classNames, allOrSome, includeSelf){
  if (!dom) {
    return undefined;
  }
  
  if (includeSelf === undefined) {
    includeSelf = true;
  }
  
  var node = includeSelf ? dom : dom.parentNode;
  while(isEl(node)) {
    if (hasClass(node, classNames, allOrSome)){
      return node;
    }
    node = node.parentNode;
  }    
  return undefined;
}

function getAncestorWithAttributeValue(dom, attributeName, attributeValue, includeSelf){
  if (!dom) {
    return undefined;
  }
  
  if (includeSelf === undefined) {
    includeSelf = true;
  }
  
  var node = includeSelf ? dom : dom.parentNode;
  while(isEl(node)) {
    var value = node.getAttribute(attributeName);
    if (value === attributeValue) {
      return node;
    }
    node = node.parentNode;
  }    
  return undefined;
}

function isEl(node){
  return node && node.nodeType === 1;
}

function getChildWithClassName(dom, className){
  var childNodes = dom.childNodes;
  for (var i = 0; i < childNodes.length; i++){
    var childNode = childNodes.item(i);
    if (!isEl(childNode)) {
      continue;
    }
    if (hasClass(childNode,className)){
      return childNode;
    }
  }
  return undefined;
  //throw new Error(`Couldn't find element with classname ${className}`);
}

function escapeHtmlText(text){
  return text.replace(/[&<>]/g, function(match){
    switch(match) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;'
      default:
        return match;
    }
  });
}

function getOptionLabel(option){
  return typeof option === 'string' ? option : option.label || option.value || '';
}

function optionHtml(option){
  var value = typeof option === 'string' ? option : option.value;
  var label = getOptionLabel(option);
  var selected = typeof option.selected === 'undefined' ? false : Boolean(option.selected);
  selected = selected ? ' selected="true"' : '';
  var disabled = typeof option.disabled === 'undefined' ? false : Boolean(option.disabled);
  disabled = disabled ? ' disabled="true"' : '';
  
  return `<option value="${value}" label="${label}"${selected}${disabled}>${label}</option>`;  
}

function optionsHtml(options, groupsSortKey){
  switch (typeof options){
    case 'undefined':
    case 'object':
      if (!options){
        return '';
      }
      break;
    default:
      throw new Error(`Invalid value for options`);
  }
  
  if (! (options instanceof Array)){
    options = Object.keys(options).map(function(key, index){
      var value = options[key];
      var type = typeof value;
      switch (type) {
        case 'number':
        case 'boolean':
          option = String(value);
        case 'string':
          option = {value: key, label: value};
          break;
        case 'undefined':
          option = {value: key, label: key};
          break;
        case 'object':
          if( value === null ){
            option = {value: key, label: ''};
            break;
          }
          else
          option = Object.assign({}, value, {value: key});
          break;
        default:
          throw new Error(`Invalid value of type ${type} for option ${index}`);
      }
      return option;
    });
  }
  options = options.sort(function(option1, option2){
    var group1 = option1.group;
    if (group1 && groupsSortKey) {
      group1 = groupsSortKey[group1] || group1;
    }
    
    var label1 = getOptionLabel(option1);
    
    var group2 = option2.group;
    if (group2 && groupsSortKey) {
      group2 = groupsSortKey[group2] || group2;
    }
    
    var label2 = getOptionLabel(option2);
    
    if (!group1 && group2 || group1 > group2) {
      return 1;
    }
    else 
    if (group1 && !group2 || group1 < group2){
      return -1;
    }
    
    if (label1 > label2){
      return 1;
    }
    else 
    if (label1 < label2){
      return -1;
    }
    
    return 0;
  });
  
  options = options.reduce(function(acc, curr){
    var optionGroup = curr.group;
    
    if (acc.currentGroup && optionGroup !== acc.currentGroup) {
      acc.html += '</optgroup>';
    }

    if (optionGroup && optionGroup !== acc.currentGroup) {      
      acc.html += `<optgroup label="${optionGroup}">`;
    }
    acc.currentGroup = optionGroup;
    
    acc.html += optionHtml(curr);
    return acc;
  }, {html: '', currentGroup: undefined});
  
  if (options.currentGroup){
    options.html += '</optgroup>';
  }
  
  return options.html;
}

function populateSelect(selector, options){
  if (typeof selector === 'string'){
    selector = document.querySelector(selector);
  }
  if (typeof selector !== 'object' || selector.tagName !== 'SELECT'){
    throw new Error(`No SELECT element`);
  }
  selector.innerHTML = optionsHtml(options);
}