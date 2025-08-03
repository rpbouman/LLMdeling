var stateElementType = 'hidden';
var stateElementName = 'state';
var stateElementSelector = `input[type=${stateElementType}][name=${stateElementName}]`;

function dispatchChangeEvent(target, detail){
  target.dispatchEvent(new CustomEvent('change', {
    detail: detail
  }));
}

function getFormStateInfo(form){
  if (!form instanceof Node) {
    throw new Error('Form must be a node');
  }
  
  var stateElement;
  if (form.type !== stateElementType || form.name !== stateElementName){
    stateElement = form.querySelector(stateElementSelector);
    if (!stateElement) {
      throw new Error(`This form does not appear to be state-managed`);
    }
  }
  else {
    stateElement = form;
  }
  
  form = stateElement.form;
  var formElements = form.elements;
  
  var previousState = JSON.parse(stateElement.value || 'null');
  
  var currentState = {};
  var stateChange = {};
  
  for (var element of formElements){
    if (element === stateElement) {
      continue;
    }

    var elementName = element.name;
    var currentValue;
    switch (element.type) {
      case 'file':
        // for file inputs, the value is no good because that gets represented as a fake path - not the actual file contents.
        currentValue = [] ;
        var files = element.files;
        for (var i = 0; i < files.length; i++){
          var file = files[i];
          currentValue.push({
            name: file.name,
            lastModified: file.lastModified,
            size: file.size,
            type: file.type
          });
        }
        currentValue = JSON.stringify(currentValue);
        break;
      default:
        currentValue = element.value;
    }
    currentState[elementName] = currentValue;
    
    var previousValue = previousState ? previousState[elementName] : undefined;
    if (currentValue !== previousValue) {
      stateChange[elementName] = {
        previous: previousValue,
        current: currentValue
      }
    }
  }
  
  return {
    previousState: previousState,
    currentState: currentState,
    stateChange: stateChange
  };
}

// this will find all forms that have a hidden input called state, and set up event handlers to manage state.
function initFormState(){
  
  var handler =  function(e){
    var target = e.target;
    var form = target.form;
    var formStateInfo = getFormStateInfo(form);
    
    if (Object.keys(formStateInfo.stateChange).length) {
      dispatchChangeEvent(stateElement, formStateInfo);
    }
    
    stateElement.value = JSON.stringify(currentState);
  };
  
  var stateManagedForms = document.querySelectorAll(`form:has( ${stateElementSelector} )`);
  for (var i = 0; i < stateManagedForms.length; i++){
    
    var stateManagedForm = stateManagedForms.item(i);
    var formElements = stateManagedForm.elements;
    var stateElement = stateManagedForm[stateElementName];
    
    for (var element of formElements){
      if (element === stateElement) {
        continue;
      }
      // register a change handler for the bubbling phase, i.e. AFTER 
      element.addEventListener('change', handler, {
        capture: false
      });
    }
  }
}

function setFormState(form, state){
  var stateElement = form.querySelector(stateElementSelector); 
  form = stateElement.form;
  var formElements = form.elements;
  
  var formStateInfo = getFormStateInfo(form);
  var previousState = formStateInfo.currentState;
  var currentState = Object.assign({}, formStateInfo.currentState);
  var stateChange = {};
  var newState = {};
  for (var elementName in state){
    var element = formElements[elementName];
    if (typeof element === 'undefined') {
      continue;
    }
    if (element.type === 'file') {
      throw new Error(`Cannot set value of type file on element ${elementName}`);
    }
    var previousValue = currentState[elementName];
    var currentValue = state[elementName];
    if (previousValue === currentValue) {
      continue;
    }
    stateChange[elementName] = {
      previous: previousValue,
      current: currentValue
    }
    element.value = currentValue;
  } 
  dispatchChangeEvent(stateElement, {
    previousState: previousState,
    currentState: currentState,
    stateChange: stateChange
  });
}