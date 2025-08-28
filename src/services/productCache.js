// services/productCache.js
const CACHE_KEY = 'product_variations_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas

export const productCache = {
  // Salvar no localStorage
  set: (productId, variations) => {
    const cache = {
      data: variations,
      timestamp: Date.now()
    };
    localStorage.setItem(`${CACHE_KEY}_${productId}`, JSON.stringify(cache));
  },

  // Recuperar do localStorage
  get: (productId) => {
    const cached = localStorage.getItem(`${CACHE_KEY}_${productId}`);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Verificar se o cache expirou
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(`${CACHE_KEY}_${productId}`);
      return null;
    }
    
    return data;
  },

  // Forçar atualização do cache
  update: async (productId) => {
    try {
      const variations = await apiService.getAllVariations(productId);
      productCache.set(productId, variations);
      return variations;
    } catch (error) {
      console.error('Erro ao atualizar cache:', error);
      return null;
    }
  }
};