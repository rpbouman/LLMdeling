function getTab(id){
  var tab = document.querySelector(`*[role=tablist] > div:has( > label[role=tab][for="${id}"] + input[type=radio]#${id} + *[role=tabpanel] )`);
  return tab;
}

function getTabPanel(id){
  var tab = getTab(id);
  var tabPanel = tab.querySelector('div[role=tabpanel]');
  return tabPanel;
}

function addTabSelectionChangedHandler(elementsOrSelector, handler){
  var dom = el(elementsOrSelector);
  var tabList = dom.querySelector('*[role=tablist]');
  var tabs = tabList.querySelectorAll('label[role=tab] + input[type=radio][name=tabs]');
  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs.item(i);
    tab.addEventListener('change', handler);
  }
}

function getSelectedTab(elementOrSelector){
  var dom = el(elementOrSelector);
  var tabList = dom.querySelector('*[role=tablist]');
  var tab = tabList.querySelector('label[role=tab] + input[type=radio][name=tabs]:checked');
  return tab;
}

