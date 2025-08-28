import React from 'react';

const AIGenerator = ({ variation, onBack }) => {
  return (
    <div>
      <h2>Geração com IA</h2>
      <p>Variação: {variation.id}</p>
      <button onClick={onBack}>Voltar</button>
    </div>
  );
};

export default AIGenerator;