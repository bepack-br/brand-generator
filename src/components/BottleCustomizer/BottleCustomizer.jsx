import React, { useEffect, useState, useCallback } from 'react';
import { getColorCode } from './colorMapping';
import { apiService } from '../../services/api';
import './BottleCustomizer.css';

// Sua chave API (em produção, use variáveis de ambiente)
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || 'AIzaSyDKkwdA-AWwtPOWBd187SkyG9KidcNK1A0';

function BottleCustomizer({ onComplete }) {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variations, setVariations] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [allOptions, setAllOptions] = useState({});
  const [prompt, setPrompt] = useState('');
  const [brandConcept, setBrandConcept] = useState('');
  const [packagingConcept, setPackagingConcept] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [customizedImage, setCustomizedImage] = useState(null);
  const [error, setError] = useState('');

  // Função para gerar texto com Gemini
  const generateWithGemini = async (promptText) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: promptText
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Erro na API Gemini: ${response.status} - ${errorData}`);
      }
      
      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (err) {
      console.error('Erro na API Gemini:', err);
      throw new Error(`Erro na API Gemini: ${err.message}`);
    }
  };

  // Função para converter imagem para base64
  const imageToBase64 = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error('Erro ao converter imagem para base64:', err);
      throw err;
    }
  };

  // Função para gerar imagem com Gemini
  const generateImageWithGemini = async (promptText, imageUrl) => {
    try {
      const imageBase64 = await imageToBase64(imageUrl);
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { 
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Erro na API Gemini: ${response.status} - ${errorData}`);
      }
      
      const data = await response.json();
      
      // Verificar se a resposta contém texto com uma imagem em base64
      const responseText = data.candidates[0].content.parts[0].text;
      
      // Se a resposta contém uma imagem em base64, retorná-la
      if (responseText.includes('data:image')) {
        return responseText;
      } else {
        // Se não, tentar extrair a URL de uma imagem gerada
        const imageMatch = responseText.match(/\!\[.*?\]\((.*?)\)/);
        if (imageMatch && imageMatch[1]) {
          return imageMatch[1];
        } else {
          throw new Error('Não foi possível encontrar uma imagem na resposta da API');
        }
      }
    } catch (err) {
      console.error('Erro na geração de imagem:', err);
      throw err;
    }
  };

  // Função para formatar textos
  const formatDisplayText = (text) => {
    if (!text) return '';
    return text
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Função para formatar textos de toggle (uma linha)
  const formatToggleText = (text) => {
    if (!text) return '';
    return text
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // 🔹 Extrair todas as opções possíveis das variações
  const extractAllOptionsFromVariations = useCallback((variations) => {
    const options = {};
    
    variations.forEach(variation => {
      if (variation.attributes) {
        Object.entries(variation.attributes).forEach(([attrName, attrValue]) => {
          if (!options[attrName]) {
            options[attrName] = new Set();
          }
          if (attrValue) {
            options[attrName].add(attrValue);
          }
        });
      }
    });
    
    // Converter Sets para Arrays
    const result = {};
    Object.entries(options).forEach(([attrName, valuesSet]) => {
      result[attrName] = Array.from(valuesSet).filter(value => value);
    });
    
    return result;
  }, []);

  // 🔹 Carregar produtos (famílias)
  useEffect(() => {
    apiService.getProducts()
      .then(res => {
        setProducts(res.data);
        if (res.data.length > 0) handleFamilyChange(res.data[0].id);
      })
      .catch(err => console.error("Erro ao carregar produtos:", err));
  }, []);

  // 🔹 Mudar família (produto)
  const handleFamilyChange = useCallback(async (id) => {
    if (!id) return;
    setSelectedProduct(products.find(p => p.id === Number(id)) || null);

    // Carregar variações usando a apiService
    apiService.getVariations(id)
      .then(res => {
        const productVariations = res.data || [];
        setVariations(productVariations);
        
        // Extrair todas as opções das variações
        const options = extractAllOptionsFromVariations(productVariations);
        setAllOptions(options);
        
        if (productVariations.length > 0) {
          setSelectedVariation(productVariations[0]);
        } else {
          setSelectedVariation(null);
        }
      })
      .catch(err => console.error("Erro ao carregar variações:", err));
  }, [products, extractAllOptionsFromVariations]);

  // 🔹 Verificar se uma opção está disponível
  const isOptionAvailable = useCallback((attrName, value) => {
    if (!selectedVariation || !value) return false;
    
    const newAttributes = { ...selectedVariation.attributes, [attrName]: value };
    const matched = variations.find(v =>
      Object.entries(newAttributes).every(([k, val]) => !val || v.attributes[k] === val)
    );
    
    return !!matched;
  }, [selectedVariation, variations]);

  // 🔹 Alterar atributo da variação
  const handleAttributeChange = useCallback((attrName, value) => {
    if (!selectedVariation) return;

    const newAttributes = { ...selectedVariation.attributes, [attrName]: value };
    const matched = variations.find(v =>
      Object.entries(newAttributes).every(([k, val]) => !val || v.attributes[k] === val)
    );

    if (matched) setSelectedVariation(matched);
    else setSelectedVariation({ attributes: newAttributes, invalid: true });
  }, [selectedVariation, variations]);

  const handleColorSelect = useCallback((attrName, colorValue) => {
    if (colorValue && isOptionAvailable(attrName, colorValue)) {
      handleAttributeChange(attrName, colorValue);
    }
  }, [handleAttributeChange, isOptionAvailable]);

  const handleToggleSelect = useCallback((attrName, value) => {
    if (value && isOptionAvailable(attrName, value)) {
      handleAttributeChange(attrName, value);
    }
  }, [handleAttributeChange, isOptionAvailable]);

  const getAvailableOptions = useCallback((attrName) => {
    if (!selectedVariation) return [];
    const valid = variations.filter(v =>
      Object.entries(selectedVariation.attributes || {}).every(([k, val]) => {
        if (!val || k === attrName) return true;
        return v.attributes[k] === val;
      })
    );
    return Array.from(new Set(valid.map(v => v.attributes[attrName])))
      .filter(value => value);
  }, [selectedVariation, variations]);

  // 🔹 Obter todas as opções para um atributo
  const getAllOptionsForAttribute = useCallback((attrName) => {
    return allOptions[attrName] || [];
  }, [allOptions]);

  // 🔹 Obter todos os nomes de atributos disponíveis
  const getAllAttributeNames = useCallback(() => {
    return Object.keys(allOptions);
  }, [allOptions]);

  const isColorAttribute = (attrName) => {
    const lowerAttr = attrName.toLowerCase();
    return lowerAttr.includes('cor') || lowerAttr.includes('color');
  };

  const isToggleAttribute = (attrName) => {
    const lowerAttr = attrName.toLowerCase();
    return lowerAttr.includes('volumetria') ||
           lowerAttr.includes('anel') ||
           lowerAttr.includes('fechamento');
  };

  const clearFilters = useCallback(() => {
    if (variations.length > 0) setSelectedVariation(variations[0]);
    setBrandConcept('');
    setPackagingConcept('');
    setCustomizedImage(null);
  }, [variations]);

  // Função para gerar conceitos com IA
  const generateConcepts = async () => {
    if (!prompt.trim()) {
      setError('Por favor, descreva sua marca');
      return;
    }
    
    setIsGenerating(true);
    setError('');
    
    try {
      const brandPrompt = `
        Gere um conceito de marca para um produto de cuidados pessoais com base na seguinte descrição: ${prompt}.
        A marca deve ter um nome criativo, posicionamento claro e valores bem definidos.
        Retorne apenas o conceito, sem introduções ou markdown.
      `;
      
      const packagingPrompt = `
        Gere um conceito de embalagem para um frasco de produto de cuidados pessoais com base na seguinte descrição: ${prompt}.
        Considere que a arte será aplicada em serigrafia diretamente no vidro, sem rótulos colados.
        Inclua elementos como: nome da marca, quantidade em ML, e descritores como "refrescante" ou "suave" quando apropriado.
        Retorne apenas o conceito, sem introduções ou markdown.
      `;
      
      const brandResponse = await generateWithGemini(brandPrompt);
      const packagingResponse = await generateWithGemini(packagingPrompt);
      
      setBrandConcept(brandResponse);
      setPackagingConcept(packagingResponse);
    } catch (err) {
      setError('Erro ao gerar conceitos. Tente novamente.');
      console.error('Erro no Gemini:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Função para gerar a imagem personalizada
  const generateCustomImage = async () => {
    if (!brandConcept || !packagingConcept || !selectedVariation) {
      setError('Gere os conceitos primeiro antes de criar a imagem');
      return;
    }
    
    setIsGeneratingImage(true);
    setError('');
    
    try {
      const imageUrl = selectedVariation.image?.src || selectedProduct.images?.[0]?.src || selectedProduct.image;
      
      const imagePrompt = `
        Crie uma visualização realista de um frasco com serigrafia baseada nos seguintes conceitos:
        CONCEITO DA MARCA: ${brandConcept}
        CONCEITO DA EMBALAGEM: ${packagingConcept}
        
        DIRETRIZES CRÍTICAS:
        - A arte deve ser em SERIGRAFIA diretamente no vidro, NÃO como rótulos colados
        - NÃO altere o formato ou cor do frasco
        - Mantenha a forma e cor original do frasco
        - Inclua informações como nome da marca, quantidade em ML e descritores curtos
        - Estilo clean e profissional
        - A serigrafia deve seguir a curvatura do frasco
      `;
      
      const generatedImage = await generateImageWithGemini(imagePrompt, imageUrl);
      setCustomizedImage(generatedImage);
      
      // Chamar onComplete se fornecido
      if (onComplete) {
        onComplete({
          product: selectedProduct,
          variation: selectedVariation,
          brandConcept,
          packagingConcept,
          customizedImage: generatedImage
        });
      }
    } catch (err) {
      setError('Erro ao gerar imagem. Tente novamente.');
      console.error('Erro no Gemini Image:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Renderizar grupos de opções
  const renderOptionGroups = useCallback(() => {
    if (!selectedVariation || variations.length === 0) return null;

    const attributeNames = getAllAttributeNames();

    return attributeNames.map(attrName => {
      const availableValues = getAvailableOptions(attrName);
      const allValues = getAllOptionsForAttribute(attrName);
      const displayName = formatDisplayText(attrName.replace('attribute_pa_', ''));

      // Se não temos valores, não renderizar o grupo
      if (allValues.length === 0) {
        return null;
      }

      if (isColorAttribute(attrName)) {
        return (
          <div className="option-group" key={attrName}>
            <h4 className="option-title">{displayName}</h4>
            <div className="color-options-container">
              {allValues.map(colorValue => {
                const isSelected = selectedVariation.attributes && selectedVariation.attributes[attrName] === colorValue;
                const isAvailable = isOptionAvailable(attrName, colorValue);
                
                return (
                  <div
                    key={`${attrName}-${colorValue}`}
                    className={`color-option ${isSelected ? 'active' : ''} ${!isAvailable ? 'unavailable' : ''}`}
                    style={{
                      backgroundColor: getColorCode(colorValue),
                      border: `2px solid ${isSelected ? '#3498db' : '#ddd'}`
                    }}
                    onClick={() => isAvailable && handleColorSelect(attrName, colorValue)}
                    title={`${formatDisplayText(colorValue)}${!isAvailable ? ' (Indisponível)' : ''}`}
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
                const isSelected = selectedVariation.attributes && selectedVariation.attributes[attrName] === value;
                const isAvailable = isOptionAvailable(attrName, value);
                
                return (
                  <button
                    key={`${attrName}-${value}`}
                    type="button"
                    className={`toggle-option ${isSelected ? 'active' : ''} ${!isAvailable ? 'unavailable' : ''}`}
                    onClick={() => isAvailable && handleToggleSelect(attrName, value)}
                    title={`${formatToggleText(value)}${!isAvailable ? ' (Indisponível)' : ''}`}
                    disabled={!isAvailable}
                  >
                    {formatToggleText(value)}
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
            value={selectedVariation.attributes && selectedVariation.attributes[attrName] || ''}
            onChange={(e) => handleAttributeChange(attrName, e.target.value)}
          >
            <option value="">Selecione</option>
            {availableValues.map(val => (
              <option key={`${attrName}-${val}`} value={val}>
                {formatDisplayText(val)}
              </option>
            ))}
          </select>
        </div>
      );
    });
  }, [selectedVariation, variations, getAvailableOptions, getAllOptionsForAttribute, getAllAttributeNames, isOptionAvailable, handleColorSelect, handleToggleSelect, handleAttributeChange]);

  return (
    <div className="bottle-customizer-container">
      <div className="customizer-header">
        <h2>Personalize seu frasco</h2>
        {selectedProduct && (
          <button
            className="btn btn-secondary clear-filters-btn"
            onClick={clearFilters}
            disabled={!variations.length || variations.length <= 1}
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Seleção da família */}
      <div className="option-group">
        <label>Família</label>
        <select
          value={selectedProduct?.id || ''}
          onChange={(e) => handleFamilyChange(e.target.value)}
        >
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {selectedProduct && selectedVariation && (
        <div className="customizer-wrapper">
          {/* Coluna esquerda → imagem e info */}
          <div className="left-column">
            <img
              className="bottle-image"
              src={customizedImage || selectedVariation.image?.src || selectedProduct.images?.[0]?.src || selectedProduct.image}
              alt={selectedProduct.name}
            />
            
            {/* Outputs de texto abaixo da imagem */}
            <div className="concepts-output">
              <div className="output-section">
                <h4>Conceito da Marca</h4>
                <div className="output-text">
                  {brandConcept || 'Descreva sua marca e gere os conceitos...'}
                </div>
              </div>
              
              <div className="output-section">
                <h4>Conceito da Embalagem</h4>
                <div className="output-text">
                  {packagingConcept || 'Descreva sua marca e gere os conceitos...'}
                </div>
              </div>
            </div>

            {!selectedVariation.invalid ? (
              <div className="variation-info">
                <p><strong>SKU:</strong> {selectedVariation.sku || 'N/A'}</p>
                <p><strong>Estoque:</strong> {selectedVariation.stock_status || 'N/A'}</p>
                <p className="price">R$ {selectedVariation.price || selectedVariation.display_price || 'N/A'}</p>
              </div>
            ) : (
              <div className="variation-info">
                <p style={{ color: 'red' }}>❌ Combinação indisponível</p>
              </div>
            )}
          </div>

          {/* Coluna direita → atributos */}
          <div className="right-column">
            <h3>Configurações</h3>
            {renderOptionGroups()}

            {/* Textarea para prompt */}
            <div className="prompt-input-group">
              <h4 className="option-title">Descreva sua marca</h4>
              <textarea
                className="prompt-textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Descreva com palavras-chave ou detalhes como quer sua marca (ex: natural, premium, vibrante, para pele sensível...)"
                rows={4}
              />
              
              {error && <div className="error-message">{error}</div>}
              
              <div className="action-buttons">
                <button 
                  className="btn btn-primary" 
                  onClick={generateConcepts}
                  disabled={!prompt.trim() || isGenerating}
                >
                  {isGenerating ? 'Gerando...' : 'Gerar Conceitos'}
                </button>
                
                {(brandConcept && packagingConcept) && (
                  <button 
                    className="btn btn-accent" 
                    onClick={generateCustomImage}
                    disabled={isGeneratingImage}
                  >
                    {isGeneratingImage ? 'Criando Frasco...' : 'Criar Frasco Personalizado'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BottleCustomizer;