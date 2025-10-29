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
    
    var group2 = option2.group;
    if (group2 && groupsSortKey) {
      group2 = groupsSortKey[group2] || group2;
    }
    
    if (!group1 && group2 || group1 > group2) {
      return 1;
    }
    else 
    if (group1 && !group2 || group1 < group2){
      return -1;
    }
    
    var sortKey1 = option1.sortKey || getOptionLabel(option1);
    var sortKey2 = option2.sortKey || getOptionLabel(option2);
    
    if (sortKey1 > sortKey2){
      return 1;
    }
    else 
    if (sortKey1 < sortKey2){
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

function populateSelect(selector, options, groupSortKeys){
  if (typeof selector === 'string'){
    selector = document.querySelector(selector);
  }
  if (typeof selector !== 'object' || selector.tagName !== 'SELECT'){
    throw new Error(`No SELECT element`);
  }
  selector.innerHTML = optionsHtml(options, groupSortKeys);
}

function getSelectedOption(selector){
  var select = el(selector);
  if (!select || (!(select instanceof Node)) || select.tagName !== 'SELECT'){
    throw new Error(`SELECT not found`)
  }
  if (select.selectedIndex === -1){
    return;
  }
  var options = select.options;
  var selectedOption = options.item(select.selectedIndex);
  return selectedOption;
}