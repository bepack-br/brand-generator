import axios from 'axios';

// Detecta se está em desenvolvimento ou produção
const isDevelopment = import.meta.env?.MODE === 'development';

const UPLOADS_BASE = isDevelopment 
  ? ''  // Usa arquivos locais no public/ no dev
  : 'https://bepack.com.br/wp-content/uploads';  // URL absoluta em produção

export const apiService = {
  getProducts: () => axios.get(`${UPLOADS_BASE}/products.json`),
  
  getProduct: async (id) => {
    const res = await axios.get(`${UPLOADS_BASE}/products.json`);
    return { data: res.data.find(p => p.id === Number(id)) };
  },
  
  getVariations: async (id) => {
    const res = await axios.get(`${UPLOADS_BASE}/variations.json`);
    return { data: res.data[id] || [] };
  },
  
  getAttributeTerms: (attributeSlug) => 
    axios.get(`${UPLOADS_BASE}/attributes.json`).then(res => ({
      data: res.data[attributeSlug] || []
    }))
};