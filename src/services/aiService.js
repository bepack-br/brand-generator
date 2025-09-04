const API_BASE = "http://localhost:3001/api";
const CORS_KEY = 's1Fd)3pSI<8)d1(;5I|rW.]D{;b*Wzyw';

// Faz fetch via Node proxy
async function fetchImageBase64(imageUrl) {
  const res = await fetch(`${API_BASE}/download-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl })
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.base64;
}

// Geração de imagem usando proxy
export async function generateBottleImageWithProxy(imageUrl, prompt) {
  try {
    const base64Image = await fetchImageBase64(imageUrl);
    const res = await fetch(`${API_BASE}/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Image, prompt })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.generatedImage;
  } catch (err) {
    console.error("Erro ao gerar imagem:", err);
    throw err;
  }
}

// Geração de conceitos (texto)
export async function generateConcepts(promptText) {
  const res = await fetch(`${API_BASE}/generate-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: promptText })
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.text;
}

// Buscar produtos do WordPress (usando a CORS_KEY através do servidor Node)
export async function getWordPressProducts() {
  try {
    const res = await fetch(`${API_BASE}/wordpress/products`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  } catch (err) {
    console.error("Erro ao buscar produtos:", err);
    throw err;
  }
}

// Buscar variações do WordPress (usando a CORS_KEY através do servidor Node)
export async function getWordPressVariations(productId) {
  try {
    const res = await fetch(`${API_BASE}/wordpress/products/${productId}/variations`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  } catch (err) {
    console.error("Erro ao buscar variações:", err);
    throw err;
  }
}

// Checagem do servidor
export async function checkServerHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    return true;
  } catch {
    return false;
  }
}