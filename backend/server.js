import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// Chave CORS para acessar a API do WordPress
const CORS_KEY = 's1Fd)3pSI<8)d1(;5I|rW.]D{;b*Wzyw';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pasta temp
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// Cliente Gemini
if (!process.env.GEMINI_API_KEY) {
  console.error("⚠️ GEMINI_API_KEY não definida no .env");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Função para fazer requests para a API do WordPress com CORS key
async function fetchFromWordPress(endpoint, params = {}) {
  const baseUrl = process.env.WORDPRESS_URL || 'https://seusite.com';
  const url = new URL(`${baseUrl}/wp-json/wc/v3/${endpoint}`);
  
  // Adiciona a chave CORS aos parâmetros
  url.searchParams.append('cors_key', CORS_KEY);
  
  // Adiciona outros parâmetros
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Erro WordPress: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Função de download de imagens
async function downloadImage(url, filename) {
  const filePath = path.join(tempDir, filename);
  const file = fs.createWriteStream(filePath);

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const request = protocol.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadImage(response.headers.location, filename).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) return reject(new Error(`Falha no download: ${response.statusCode}`));
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve(filePath);
      });
    }).on("error", (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

// Rota para baixar imagem externa e retornar base64
app.post("/api/download-image", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "URL da imagem é obrigatória" });

    const urlObj = new URL(imageUrl);
    const filename = `image_${Date.now()}${path.extname(urlObj.pathname) || ".jpg"}`;
    const filePath = path.join(tempDir, filename);

    if (!fs.existsSync(filePath)) await downloadImage(imageUrl, filename);
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString("base64");

    res.json({ success: true, filename, base64 });
  } catch (err) {
    console.error("Erro ao baixar imagem:", err);
    res.status(500).json({ error: err.message });
  }
});

// Geração de imagens
app.post("/api/generate-image", async (req, res) => {
  try {
    const { base64Image, prompt } = req.body;
    if (!base64Image || !prompt) return res.status(400).json({ error: "Imagem e prompt são obrigatórios" });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: base64Image } }
          ]
        }
      ],
      config: { responseModalities: ["IMAGE", "TEXT"], temperature: 0.1, maxOutputTokens: 2048 }
    });

    const imagePart = response.candidates[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart) throw new Error("Nenhuma imagem foi gerada");

    res.json({ success: true, generatedImage: `data:image/png;base64,${imagePart.inlineData.data}` });
  } catch (err) {
    console.error("Erro ao gerar imagem:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/generate-text", async (req,res)=>{
  const { prompt } = req.body;
  if(!prompt) return res.status(400).json({error:"Prompt é obrigatório"});
  try{
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {temperature:0.7, maxOutputTokens:500}
    });
    res.json({text: response.text || "Não foi possível gerar conceitos"});
  }catch(err){
    console.error("Erro ao gerar texto:",err);
    res.status(500).json({error:"Erro ao gerar texto"});
  }
});

// Rota para buscar produtos do WordPress (usando a CORS_KEY)
app.get("/api/wordpress/products", async (req, res) => {
  try {
    const products = await fetchFromWordPress('products', req.query);
    res.json(products);
  } catch (err) {
    console.error("Erro ao buscar produtos:", err);
    res.status(500).json({ error: err.message });
  }
});

// Rota para buscar variações do WordPress (usando a CORS_KEY)
app.get("/api/wordpress/products/:id/variations", async (req, res) => {
  try {
    const variations = await fetchFromWordPress(`products/${req.params.id}/variations`, req.query);
    res.json(variations);
  } catch (err) {
    console.error("Erro ao buscar variações:", err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/api/health", (req, res) => res.json({ status: "OK" }));

// Limpeza de temp
setInterval(() => {
  if (!fs.existsSync(tempDir)) return;
  fs.readdir(tempDir, (err, files) => {
    if (err) return;
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > oneHour) fs.unlink(filePath, () => {});
      });
    });
  });
}, 60 * 60 * 1000);

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));