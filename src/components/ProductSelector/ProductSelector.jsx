import React from 'react';

const ProductSelector = ({ products, onSelect }) => {
  return (
    <div className="product-selector">
      <h2>Escolha a família de frasco</h2>
      <div className="product-grid">
        {products.map(product => (
          <div 
            key={product.id} 
            className="product-card"
            onClick={() => onSelect(product.id)}
            style={{
              border: '1px solid #ddd',
              padding: '1rem',
              margin: '1rem',
              cursor: 'pointer',
              borderRadius: '8px'
            }}
          >
            {product.image && (
              <img src={product.image} alt={product.name} width="100" />
            )}
            <h3>{product.name}</h3>
            <p>R$ {product.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductSelector;