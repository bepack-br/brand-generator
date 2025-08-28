import React, { useEffect, useState, useCallback } from 'react';
import { getColorCode } from './colorMapping';
import { apiService } from '../../services/api';
import './BottleCustomizer.css';

function BottleCustomizer({ onComplete }) {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variations, setVariations] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [allOptions, setAllOptions] = useState({});

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
  }, [variations]);

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
              src={selectedVariation.image?.src || selectedProduct.images?.[0]?.src || selectedProduct.image}
              alt={selectedProduct.name}
            />
            
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

            <div className="button-group">
              <button className="btn btn-primary" onClick={onComplete}>
                Continuar para Design AI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BottleCustomizer;