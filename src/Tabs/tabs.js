function getTab(id){
  var tab = document.querySelector(`form[role=tablist] > div:has( > label[role=tab][for="${id}"] + input[type=radio]#${id} + *[role=tabpanel] )`);
  return tab;
}

function getTabPanel(id){
  var tab = getTab(id);
  var tabPanel = tab.querySelector('div[role=tabpanel]');
  return tabPanel;
}

