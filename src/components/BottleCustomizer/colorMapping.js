export const colorMap = {

  //lapidado
  'ambar-lapidado': '#E1D57C',
  'ametista-lapidado': '#C5AFE7',
  'bordo-lapidado': '#C9A1BB',
  'carbono-lapidado': '#4A41B9',
  'citrino-lapidado': '#D68D73',
  'cristal-lapidado': '#DCDCDD',
  'esmeralda-lapidado': '#437039',
  'granada-lapidado': '#8F0000',
  'jade-lapiddo': '#26410F',
  'morganita-lapidado': '#E6D8E1',
  'onix-lapidado': '#393939',
  'opala-lapidado': '#68390E',
  'rubi-lapidado': '#C400B6',
  'tanzanita-lapidado': '#4400A2',
  'topazio-lapidado': '#D73F7C',
  'turquesa-lapidado': '#EDD6DE',
  'verde-fluorescente-lapidado': '#9BCE3F',
  'agua-marinha': '#CBD9D9',
  'ambar': '#F9D82F',
  'ametista': '#9668F4',
  'aventurina': '#B4FFC9',
  'berilo': '#520C0C',
  'bordo': '#360D0C',
  'branco': '#F4F4F4',
  'carbono': '#10143D',
  'citrino': '#FF351B',
  'esmeralda': '#37DFA6',
  'heliodoro': '#F2F2BC',  
  'lolita': '#F0E4F3',
  'morganita': '#EDD6DE',
  'onix': '#1B1B1B',
  'opala': '#28180C',
  'rubi': '#F94DB2',
  'safira': '#00BEE6',
  'tanzanita': '#1B0036',
  'topazio': '#FF7FA2',
  'turmalina': '#D8C6B9',
  'verde-fluorescente': '#B4F164',
  'jade-lapidado': '#166C17',

  // Transparente
  'cristal-lapidado': 'transparent',
  
  
};

export const toggleDisplayMap = {
  'sim': 'Com',
  'não': 'Sem', 
  'com': 'Com',
  'sem': 'Sem',
  'yes': 'Com',
  'no': 'Sem',
  'with': 'Com',
  'without': 'Sem'
};

// Função para obter o código da cor
export const getColorCode = (colorName) => {
  return colorMap[colorName] || '#CCCCCC'; // Retorna cinza se a cor não for encontrada
};

// Função para formatar a exibição dos valores (remover hífens e capitalizar)
export const getToggleDisplay = (value) => {
  if (!value) return '';
  
  return value
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};