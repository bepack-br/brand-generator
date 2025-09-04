import React, { useEffect, useState, useMemo } from 'react';
import { getColorCode } from './colorMapping';
import { apiService } from '../../services/api';
import { 
  generateConcepts, 
  generateBottleImageWithProxy,
  checkServerHealth
} from '../../services/aiService';
import './BottleCustomizer.css';

// Hook para pré-carregar imagens
const useImagePreloader = (imageUrls) => {
  useEffect(() => {
    if (imageUrls && imageUrls.length > 0) {
      const timer = setTimeout(() => {
        imageUrls.forEach(url => {
          if (url) {
            const img = new Image();
            img.src = url;
          }
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [imageUrls]);
};

// Funções auxiliares para extrair informações dos conceitos
const extractBrandName = (concept) => {
  if (!concept) return 'Marca Personalizada';
  
  const lines = concept.split('\n');
  for (const line of lines) {
    const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
    if (cleanLine && !cleanLine.toLowerCase().includes('slogan') && 
        !cleanLine.toLowerCase().includes('frase') && cleanLine.length > 2) {
      return cleanLine;
    }
  }
  return 'Marca Personalizada';
};

const extractMainColors = (concept) => {
  if (!concept) return 'cores modernas e elegantes';
  
  const colorKeywords = ['azul', 'verde', 'vermelho', 'amarelo', 'roxo', 'rosa', 
                         'laranja', 'marrom', 'preto', 'branco', 'cinza', 'dourado', 
                         'prateado', 'pastel', 'neutro', 'vibrante'];
  
  const foundColors = [];
  const words = concept.toLowerCase().split(/\s+/);
  
  words.forEach(word => {
    if (colorKeywords.includes(word) && !foundColors.includes(word)) {
      foundColors.push(word);
    }
  });
  
  return foundColors.length > 0 ? foundColors.join(', ') : 'cores modernas e elegantes';
};

const extractDesignStyle = (concept) => {
  if (!concept) return 'design clean e moderno';
  
  const styleKeywords = ['minimalista', 'moderno', 'elegante', 'sofisticado', 'luxo',
                        'natural', 'orgânico', 'vibrante', 'jovem', 'clássico', 'retrô',
                        'futurista', 'clean', 'simples', 'complexo', 'detalhado'];
  
  for (const word of concept.toLowerCase().split(/\s+/)) {
    if (styleKeywords.includes(word)) {
      return word;
    }
  }
  
  return 'design clean e moderno';
};

const extractVolumeFromProduct = (product) => {
  if (!product) return '250 ml';
  
  const volumeMatch = product.name?.match(/(\d+)\s*ml/i) || 
                     product.description?.match(/(\d+)\s*ml/i);
  
  return volumeMatch ? `${volumeMatch[1]} ml` : '250 ml';
};

function BottleCustomizer({ onComplete }) {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variations, setVariations] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [allOptions, setAllOptions] = useState({});
  const [prompt, setPrompt] = useState('');
  const [brandConcept, setBrandConcept] = useState('');
  const [packagingConcept, setPackagingConcept] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // Pré-carregar imagens
  const imagesToPreload = useMemo(() => {
    if (!variations.length || !selectedProduct) return [];
    return variations
      .slice(0, 20)
      .map(v => v.image?.src || selectedProduct.images?.[0]?.src || selectedProduct.image)
      .filter(Boolean)
      .filter((url, index, self) => self.indexOf(url) === index);
  }, [variations, selectedProduct]);

  useImagePreloader(imagesToPreload);

  // Extrair todas as opções das variações
  const extractAllOptionsFromVariations = (variations) => {
    const options = {};
    variations.forEach(variation => {
      if (variation.attributes) {
        Object.entries(variation.attributes).forEach(([attrName, attrValue]) => {
          if (!options[attrName]) options[attrName] = new Set();
          if (attrValue) options[attrName].add(attrValue);
        });
      }
    });
    const result = {};
    Object.entries(options).forEach(([attrName, valuesSet]) => {
      result[attrName] = Array.from(valuesSet).filter(value => value);
    });
    return result;
  };

  // Encontrar variação padrão (sem anel/fechamento)
  const findVariationWithoutAccessories = (variations) => {
    for (const variation of variations) {
      if (!variation.attributes) continue;
      const hasRing = Object.entries(variation.attributes).some(
        ([key, value]) => key.toLowerCase().includes('anel') && value && value !== 'sem-anel' && value !== 'none'
      );
      const hasClosure = Object.entries(variation.attributes).some(
        ([key, value]) => key.toLowerCase().includes('fechamento') && value && value !== 'sem-fechamento' && value !== 'none'
      );
      if (!hasRing && !hasClosure) return variation;
    }
    return variations.length > 0 ? variations[0] : null;
  };

  // Carregar produtos
  useEffect(() => {
    apiService.getProducts()
      .then(res => {
        setProducts(res.data);
        if (res.data.length > 0) handleFamilyChange(res.data[0].id);
      })
      .catch(err => console.error("Erro ao carregar produtos:", err));
  }, []);

  // Mudar família
  const handleFamilyChange = async (id) => {
    if (!id) return;
    const product = products.find(p => p.id === Number(id));
    setSelectedProduct(product);
    try {
      const res = await apiService.getVariations(id);
      const productVariations = res.data || [];
      setVariations(productVariations);
      setAllOptions(extractAllOptionsFromVariations(productVariations));
      setSelectedVariation(findVariationWithoutAccessories(productVariations));
    } catch (err) {
      console.error("Erro ao carregar variações:", err);
      setSelectedVariation(null);
    }
  };

  // Helpers de opções
  const formatDisplayText = (text) =>
    !text ? '' : text.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const isOptionAvailable = (attrName, value) => {
    if (!selectedVariation || !value) return false;
    const newAttributes = { ...selectedVariation.attributes, [attrName]: value };
    return variations.some(v =>
      Object.entries(newAttributes).every(([k, val]) => !val || v.attributes[k] === val)
    );
  };

  const handleAttributeChange = (attrName, value) => {
    if (!selectedVariation) return;
    const newAttributes = { ...selectedVariation.attributes, [attrName]: value };
    const matched = variations.find(v =>
      Object.entries(newAttributes).every(([k, val]) => !val || v.attributes[k] === val)
    );
    setSelectedVariation(matched || { attributes: newAttributes, invalid: true });
  };

  const handleColorSelect = (attrName, colorValue) => {
    if (colorValue && isOptionAvailable(attrName, colorValue)) {
      handleAttributeChange(attrName, colorValue);
    }
  };

  const handleToggleSelect = (attrName, value) => {
    if (value && isOptionAvailable(attrName, value)) {
      handleAttributeChange(attrName, value);
    }
  };

  const getAvailableOptions = (attrName) => {
    if (!selectedVariation) return [];
    return variations
      .filter(v => Object.entries(selectedVariation.attributes || {})
        .every(([k, val]) => !val || k === attrName || v.attributes[k] === val))
      .map(v => v.attributes[attrName])
      .filter((value, index, self) => value && self.indexOf(value) === index);
  };

  const isColorAttribute = (attrName) =>
    attrName.toLowerCase().includes('cor') || attrName.toLowerCase().includes('color');

  const isToggleAttribute = (attrName) => {
    const lower = attrName.toLowerCase();
    return lower.includes('volumetria') || lower.includes('anel') || lower.includes('fechamento');
  };

  const clearFilters = () => {
    if (variations.length > 0) {
      setSelectedVariation(findVariationWithoutAccessories(variations));
    }
    setBrandConcept('');
    setPackagingConcept('');
    setGeneratedImage(null);
  };

  // Gerar conceitos
  const generateConceptsHandler = async () => {
    if (!prompt.trim()) {
      setError('Por favor, descreva sua marca');
      return;
    }
    setIsGenerating(true);
    setError('');

    try {
      const structuredPrompt = `
Crie conceitos para uma marca de cosméticos baseada na seguinte descrição:
"${prompt}"

Gere o resultado no seguinte formato, exatamente assim:

CONCEITO DE MARCA:
- [nome da marca, slogans curtos, variações de frases criativas]

CONCEITO DE EMBALAGEM:
- [cores, design, sensação visual, estilo do rótulo]

Não inclua nada fora desses dois blocos. Use frases curtas, claras e impactantes.
`;

      const response = await generateConcepts(structuredPrompt);
      console.log("Texto gerado:", response);

      const [brandPartRaw, packagingPartRaw] = response.split('CONCEITO DE EMBALAGEM:');
      const brandPart = brandPartRaw?.replace('CONCEITO DE MARCA:', '').trim() || 'Não foi possível gerar conceitos.';
      const packagingPart = packagingPartRaw?.trim() || 'Conceito de embalagem não gerado';

      setBrandConcept(brandPart);
      setPackagingConcept(packagingPart);

    } catch (err) {
      console.error(err);
      setError('Erro ao gerar conceitos. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Aplicar conceito na imagem (versão serigrafia)
const applyConceptToBottle = async () => {
  if (!selectedVariation?.image?.src || !brandConcept || !packagingConcept) {
    setError("Faltam informações para gerar imagem.");
    return;
  }
  
  setIsGenerating(true);
  setError('');
  
  try {
    // Verificar se o servidor está respondendo
    const isServerHealthy = await checkServerHealth();
    if (!isServerHealthy) {
      throw new Error("Servidor de geração de imagens não está respondendo. Verifique se o servidor está rodando na porta 3001.");
    }
    
    // Extrair informações para o prompt detalhado
    const brandName = extractBrandName(brandConcept);
    const mainColors = extractMainColors(packagingConcept);
    const designStyle = extractDesignStyle(packagingConcept);
    const volume = extractVolumeFromProduct(selectedProduct);
    
    // Prompt detalhado para simular serigrafia
    const detailedPrompt = `
APLIQUE O DESIGN NO FRASCO COMO SERIGRAFIA, MANTENDO SEMPRE A COR ORIGINAL DO FRASCO.

INFORMAÇÕES DO PRODUTO:
- Marca: ${brandName}
- Nome do produto: ${brandName} ${selectedProduct?.name?.split(' ')[0] || 'Premium'}
- Volume: ${volume}

CONCEITO DE MARCA:
${brandConcept}

CONCEITO DE EMBALAGEM:
${packagingConcept}

INSTRUÇÕES ESPECÍFICAS:
1. Mantenha a cor, brilho e transparência originais do frasco.
2. A serigrafia pode ter qualquer cor, contraste ou estilo.
3. Aplique a arte diretamente na superfície do frasco.
4. Respeite perspectiva, curvatura e textura do frasco.
5. Fundo original do frasco deve permanecer intacto.
6. Nome da marca legível, estilo harmonioso com o design da embalagem.

RESULTADO ESPERADO: Imagem realista do frasco com a arte aplicada como serigrafia, sem alterar o frasco.
`;

    console.log("Prompt detalhado para serigrafia:", detailedPrompt);
    
    // Usar método com proxy para evitar problemas de CORS
    const newImage = await generateBottleImageWithProxy(
      selectedVariation.image.src, 
      detailedPrompt
    );
    
    setGeneratedImage(newImage);
    
  } catch (err) {
    console.error("Erro ao processar a imagem:", err);
    setError(err.message);
  } finally {
    setIsGenerating(false);
  }
};


  // Renderizar opções
  const renderOptionGroups = () => {
    if (!selectedVariation || variations.length === 0) return null;
    return Object.keys(allOptions).map(attrName => {
      const availableValues = getAvailableOptions(attrName);
      const allValues = allOptions[attrName] || [];
      const displayName = formatDisplayText(attrName.replace('attribute_pa_', ''));
      if (allValues.length === 0) return null;

      if (isColorAttribute(attrName)) {
        return (
          <div className="option-group" key={attrName}>
            <h4 className="option-title">{displayName}</h4>
            <div className="color-options-container">
              {allValues.map(colorValue => {
                const isSelected = selectedVariation.attributes?.[attrName] === colorValue;
                const isAvailable = isOptionAvailable(attrName, colorValue);
                return (
                  <div
                    key={`${attrName}-${colorValue}`}
                    className={`color-option ${isSelected ? 'active' : ''} ${!isAvailable ? 'unavailable' : ''}`}
                    style={{ backgroundColor: getColorCode(colorValue) }}
                    onClick={() => isAvailable && handleColorSelect(attrName, colorValue)}
                    title={formatDisplayText(colorValue)}
                  />
                );
              })}
            </div>
          </div>
        );
      }

      if (isToggleAttribute(attrName)) {
        return (
          <div className="toggle-group" key={attrName}>
            <h4 className="option-title">{displayName}</h4>
            <div className="toggle-options-container">
              {allValues.map(value => {
                const isSelected = selectedVariation.attributes?.[attrName] === value;
                const isAvailable = isOptionAvailable(attrName, value);
                return (
                  <button
                    key={`${attrName}-${value}`}
                    className={`toggle-option ${isSelected ? 'active' : ''} ${!isAvailable ? 'unavailable' : ''}`}
                    onClick={() => isAvailable && handleToggleSelect(attrName, value)}
                    disabled={!isAvailable}
                  >
                    {formatDisplayText(value)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      return (
        <div className="option-group" key={attrName}>
          <h4 className="option-title">{displayName}</h4>
          <select
            value={selectedVariation.attributes?.[attrName] || ''}
            onChange={(e) => handleAttributeChange(attrName, e.target.value)}
          >
            <option value="">Selecione</option>
            {availableValues.map(val => (
              <option key={val} value={val}>{formatDisplayText(val)}</option>
            ))}
          </select>
        </div>
      );
    });
  };

  return (
    <div className="bottle-customizer-container">
      <div className="customizer-header">
        <h2>Personalize seu frasco</h2>
        {selectedProduct && (
          <button className="btn btn-secondary clear-filters-btn" onClick={clearFilters}>
            Limpar Filtros
          </button>
        )}
      </div>

      <div className="option-group">
        <label>Família</label>
        <select value={selectedProduct?.id || ''} onChange={(e) => handleFamilyChange(e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {selectedProduct && selectedVariation && (
        <div className="customizer-wrapper">
          <div className="left-column">
            <img
              className="bottle-image"
              src={generatedImage || selectedVariation.image?.src || selectedProduct.images?.[0]?.src || selectedProduct.image}
              alt={selectedProduct.name}
              loading="lazy"
            />

            <div className="concepts-output">
              <div className="output-section">
                <h4>Conceito da Marca</h4>
                <div className="output-text">{brandConcept || 'Descreva sua marca...'}</div>
              </div>
              <div className="output-section">
                <h4>Conceito da Embalagem</h4>
                <div className="output-text">{packagingConcept || 'Descreva sua marca...'}</div>
              </div>
            </div>

            {!selectedVariation.invalid ? (
              <div className="variation-info">
                <p><strong>SKU:</strong> {selectedVariation.sku || 'N/A'}</p>
                <p><strong>Estoque:</strong> {selectedVariation.stock_status || 'N/A'}</p>
                <p className="price">R$ {selectedVariation.price || 'N/A'}</p>
              </div>
            ) : (
              <div className="variation-info">
                <p style={{ color: 'red' }}>❌ Combinação indisponível</p>
              </div>
            )}
          </div>

          <div className="right-column">
            <h3>Configurações</h3>

            {renderOptionGroups()}

            <div className="prompt-input-group">
              <h4 className="option-title">Descreva sua marca</h4>
              <textarea
                className="prompt-textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: marca natural e premium para cabelos, com embalagens sustentáveis, cores terrosas e design elegante..."
                rows={4}
              />

              {error && <div className="error-message">{error}</div>}

              <button 
                className="btn btn-primary" 
                onClick={generateConceptsHandler}
                disabled={!prompt.trim() || isGenerating}
              >
                {isGenerating ? 'Gerando...' : 'Gerar Conceitos'}
              </button>

              <button 
                className="btn btn-success"
                onClick={applyConceptToBottle}
                disabled={isGenerating || !brandConcept || !packagingConcept}
              >
                {isGenerating ? "Gerando imagem..." : "Aplicar Conceito no Frasco"}
              </button>
              
              {isGenerating && (
                <div className="generating-overlay">
                  <div className="spinner"></div>
                  <p>Gerando... Isso pode levar alguns segundos</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BottleCustomizer;