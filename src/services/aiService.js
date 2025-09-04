const API_BASE = 'http://localhost:3001/api';

export async function generateConcepts(promptText) {
  try {
    console.log("Enviando prompt para geração de texto:", promptText.substring(0, 100) + "...");
    
    const response = await fetch(`${API_BASE}/generate-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na resposta do servidor:", errorText);
      throw new Error(`Erro no backend: ${errorText}`);
    }

    const data = await response.json();
    return data.text || "Não foi possível gerar conceitos.";
  } catch (error) {
    console.error("Erro em generateConcepts:", error);
    throw new Error(`Erro ao gerar conceitos: ${error.message}`);
  }
}

export async function downloadAndCacheImage(imageUrl) {
  try {
    console.log("Iniciando download da imagem:", imageUrl);
    
    const response = await fetch(`${API_BASE}/download-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na resposta do servidor:", errorText);
      throw new Error(`Erro ao baixar imagem: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || "Falha no download da imagem");
    }
    
    console.log("Download concluído com sucesso:", data.localUrl);
    return data.localUrl;
    
  } catch (error) {
    console.error("Erro em downloadAndCacheImage:", error);
    throw new Error(`Erro ao baixar imagem: ${error.message}`);
  }
}

export async function generateBottleImage(imageUrl, promptText, productInfo) {
  try {
    console.log("Iniciando geração de imagem para o frasco...");
    console.log("URL da imagem original:", imageUrl);
    console.log("Tamanho do prompt:", promptText.length, "caracteres");
    
    // Primeiro baixe a imagem para evitar problemas de CORS
    const localImageUrl = await downloadAndCacheImage(imageUrl);
    
    console.log("Carregando imagem local:", localImageUrl);
    
    // Carregue a imagem localmente
    const response = await fetch(`http://localhost:3001${localImageUrl}`);
    
    if (!response.ok) {
      throw new Error(`Erro ao carregar imagem local: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // Converta para base64
    const base64Image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (result && typeof result === 'string') {
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        } else {
          reject(new Error("Falha ao converter imagem para base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    console.log("Imagem convertida para base64, tamanho:", base64Image.length, "bytes");
    console.log("Iniciando geração com Gemini...");
    
    // Continue com o processo normal de geração de imagem
    const genResponse = await fetch(`${API_BASE}/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        base64Image: base64Image,
        prompt: promptText,
        productInfo: productInfo
      })
    });

    if (!genResponse.ok) {
      const errorText = await genResponse.text();
      console.error("Erro na geração de imagem:", errorText);
      throw new Error(`Erro no backend: ${errorText}`);
    }

    const data = await genResponse.json();
    
    if (data.success && data.generatedImage) {
      console.log("Imagem gerada com sucesso!");
      return data.generatedImage;
    } else {
      throw new Error("Falha ao gerar imagem: " + (data.error || "Resposta inválida"));
    }

  } catch (error) {
    console.error("Erro em generateBottleImage:", error);
    throw new Error(`Erro ao processar imagem: ${error.message}`);
  }
}

// Método alternativo simplificado
export async function generateBottleImageSimple(imageUrl, promptText) {
  try {
    console.log("Usando método simples para geração de imagem...");
    console.log("URL da imagem:", imageUrl);
    console.log("Tamanho do prompt:", promptText.length);
    
    const apiUrl = `${API_BASE}/generate-image-simple`;
    console.log("Fazendo request para:", apiUrl);
    
    // Testar se a URL é acessível primeiro
    try {
      const testResponse = await fetch(apiUrl, { 
        method: 'OPTIONS',
        mode: 'cors'
      });
      console.log("OPTIONS request status:", testResponse.status);
    } catch (testError) {
      console.warn("OPTIONS test failed:", testError);
    }
    
    // Usar apenas la URL diretamente (o servidor fará o download)
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ 
        imageUrl: imageUrl,
        prompt: promptText
      }),
      mode: 'cors',
      credentials: 'include'
    });

    console.log("Status da resposta:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro detalhado:", errorText);
      throw new Error(`Erro no backend: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.success && data.generatedImage) {
      console.log("Imagem gerada com sucesso!");
      return data.generatedImage;
    } else {
      throw new Error("Falha ao gerar imagem: " + (data.error || "Resposta inválida"));
    }

  } catch (error) {
    console.error("Erro em generateBottleImageSimple:", error);
    
    // Verificar se é erro de CORS
    if (error.message.includes('CORS') || error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      throw new Error(`Problema de conexão com o servidor. Verifique se:
      1. O servidor está rodando na porta 3001
      2. As configurações CORS estão corretas
      3. Não há bloqueios de firewall
      Erro detalhado: ${error.message}`);
    }
    
    throw new Error(`Erro ao processar imagem: ${error.message}`);
  }
}

// Função para verificar saúde do servidor
export async function checkServerHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: "GET",
      mode: 'cors'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("Servidor está saudável:", data);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Servidor não está respondendo:", error);
    return false;
  }
}

// Função para verificar se uma imagem é acessível
export async function checkImageAccessible(imageUrl) {
  try {
    const response = await fetch(`${API_BASE}/check-image-access?url=${encodeURIComponent(imageUrl)}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Erro ao verificar acesso à imagem:", error);
    return { accessible: false, corsFriendly: false, error: error.message };
  }
}

// Função otimizada para obter imagens
export async function getOptimizedImageUrl(originalUrl) {
  try {
    // Primeiro verificar se podemos acessar diretamente
    const checkData = await checkImageAccessible(originalUrl);
    
    if (checkData.accessible && checkData.corsFriendly) {
      console.log("Imagem acessível diretamente, usando URL original");
      return originalUrl; // Usar URL diretamente
    } else {
      console.log("Imagem não acessível diretamente, usando proxy");
      return `${API_BASE}/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    }
  } catch (error) {
    console.warn("Erro ao verificar acesso à imagem, usando proxy como fallback:", error);
    return `${API_BASE}/image-proxy?url=${encodeURIComponent(originalUrl)}`;
  }
}

// Nova função usando proxy de imagem
export async function generateBottleImageWithProxy(imageUrl, promptText) {
  try {
    console.log("Usando proxy para geração de imagem...");
    
    // Obter a URL otimizada para a imagem
    const optimizedUrl = await getOptimizedImageUrl(imageUrl);
    
    const response = await fetch(`${API_BASE}/generate-image-simple`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ 
        imageUrl: optimizedUrl,
        prompt: promptText
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro no backend: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.success && data.generatedImage) {
      console.log("Imagem gerada com sucesso!");
      return data.generatedImage;
    } else {
      throw new Error("Falha ao gerar imagem: " + (data.error || "Resposta inválida"));
    }

  } catch (error) {
    console.error("Erro em generateBottleImageWithProxy:", error);
    throw new Error(`Erro ao processar imagem: ${error.message}`);
  }
}

// Fallback completo com múltiplas estratégias
export async function getImageWithFallbacks(imageUrl, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Tentativa ${attempt} de obter imagem: ${imageUrl}`);
      
      // Estratégia 1: Tentar diretamente (se possível)
      if (attempt === 1) {
        try {
          const checkData = await checkImageAccessible(imageUrl);
          
          if (checkData.accessible && checkData.corsFriendly) {
            return imageUrl;
          }
        } catch (checkError) {
          console.log("Verificação de acesso falhou, tentando próximo método");
        }
      }
      
      // Estratégia 2: Proxy normal
      if (attempt <= 2) {
        const proxyUrl = `${API_BASE}/image-proxy?url=${encodeURIComponent(imageUrl)}`;
        // Testar se o proxy funciona
        const testResponse = await fetch(proxyUrl, { method: 'HEAD' });
        if (testResponse.ok) {
          return proxyUrl;
        }
      }
      
      // Estratégia 3: Download e cache local
      if (attempt === 3) {
        const localUrl = await downloadAndCacheImage(imageUrl);
        return `http://localhost:3001${localUrl}`;
      }
      
    } catch (error) {
      lastError = error;
      console.warn(`Tentativa ${attempt} falhou:`, error.message);
      
      // Aguardar um pouco antes da próxima tentativa
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw new Error(`Todas as tentativas falharam: ${lastError?.message}`);
}