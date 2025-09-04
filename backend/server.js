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

// =================== CONFIGURAÇÃO CORS ===================
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // requests sem origin
    if (origin.match(/https?:\/\/localhost(:\d+)?$/) ||
        origin.match(/https?:\/\/127\.0\.0\.1(:\d+)?$/) ||
        origin.match(/https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept'],
  exposedHeaders: ['Content-Type','Authorization']
}));

app.options("*", (req,res)=>{
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

app.use((req,res,next)=>{
  const origin = req.headers.origin;
  if(origin && (origin.includes("localhost") || origin.includes("127.0.0.1"))){
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials','true');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-Requested-With');
  next();
});

app.use(express.json({ limit: "50mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =================== PASTA TEMP ===================
const tempDir = path.join(__dirname,'temp');
if(!fs.existsSync(tempDir)){
  fs.mkdirSync(tempDir,{recursive:true});
  console.log("Pasta temp criada:", tempDir);
}

// =================== CLIENTE GEMINI ===================
if(!process.env.GEMINI_API_KEY){
  console.error("⚠️ GEMINI_API_KEY não definida no .env");
  process.exit(1);
}
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

// =================== FUNÇÃO DE DOWNLOAD ===================
async function downloadImage(url, filename){
  const filePath = path.join(tempDir, filename);
  const file = fs.createWriteStream(filePath);

  return new Promise((resolve,reject)=>{
    const download = (currentUrl, redirectCount=0)=>{
      if(redirectCount>5) return reject(new Error("Muitos redirecionamentos"));

      const protocol = currentUrl.startsWith("https") ? https : http;
      const request = protocol.get(currentUrl, (response)=>{
        if(response.statusCode>=300 && response.statusCode<400 && response.headers.location){
          return download(response.headers.location, redirectCount+1);
        }
        if(response.statusCode!==200) return reject(new Error(`Falha no download: ${response.statusCode}`));
        response.pipe(file);
        file.on('finish',()=>{
          file.close();
          resolve(filePath);
        });
      }).on('error',(err)=>{
        fs.unlink(filePath,()=>{});
        reject(err);
      });
      request.setTimeout(30000, ()=>{
        request.destroy();
        reject(new Error("Timeout no download da imagem"));
      });
    };
    download(url);
  });
}

// =================== ROTAS DE IMAGEM ===================

// Servir imagem local
app.get("/api/image/:filename",(req,res)=>{
  const filePath = path.join(tempDir, req.params.filename);
  if(fs.existsSync(filePath)){
    res.sendFile(filePath);
  }else{
    res.status(404).json({error:"Imagem não encontrada"});
  }
});

// Proxy de imagem
app.get("/api/image-proxy", async (req,res)=>{
  try{
    const imageUrl = req.query.url;
    if(!imageUrl) return res.status(400).json({error:"URL parameter is required"});
    const response = await fetch(imageUrl,{headers:{'User-Agent':'Mozilla/5.0'}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type')||'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Cache-Control','public,max-age=86400');
    res.send(buffer);
  }catch(err){
    console.error("Erro no proxy:",err);
    res.status(500).json({error:"Failed to fetch image"});
  }
});

// Check image accessibility
async function checkImageAccessible(url){
  try{
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),5000);
    const response = await fetch(url,{method:"HEAD", signal: controller.signal});
    clearTimeout(timeout);
    const corsHeader = response.headers.get('access-control-allow-origin');
    return {accessible: response.ok, corsFriendly: corsHeader==='*', contentType: response.headers.get('content-type')};
  }catch(err){
    return {accessible:false, corsFriendly:false, error: err.message};
  }
}

app.get("/api/smart-image", async (req,res)=>{
  try{
    const imageUrl = req.query.url;
    if(!imageUrl) return res.status(400).json({error:"URL required"});
    const accessInfo = await checkImageAccessible(imageUrl);
    if(accessInfo.accessible && accessInfo.corsFriendly){
      return res.redirect(imageUrl);
    }else{
      req.query.url = imageUrl;
      return app._router.handle(req,res);
    }
  }catch(err){
    res.status(500).json({error:err.message});
  }
});

// Download de imagem
app.post("/api/download-image", async (req,res)=>{
  const {imageUrl} = req.body;
  if(!imageUrl) return res.status(400).json({error:"URL da imagem é obrigatória"});
  try{
    const urlObj = new URL(imageUrl);
    const filename = path.basename(urlObj.pathname)||`image_${Date.now()}.jpg`;
    const filePath = path.join(tempDir,filename);
    if(!fs.existsSync(filePath)) await downloadImage(imageUrl, filename);
    res.json({success:true, localUrl:`/api/image/${filename}`, filename});
  }catch(err){
    console.error("Erro ao baixar imagem:",err);
    res.status(500).json({error:"Erro ao baixar imagem", details: err.message});
  }
});

// =================== GERAÇÃO DE TEXTO ===================
app.post("/api/generate-text", async (req,res)=>{
  const {prompt} = req.body;
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

// =================== GERAÇÃO DE IMAGEM ===================

// Método padrão (base64)
app.post("/api/generate-image", async (req,res)=>{
  const {base64Image, prompt} = req.body;
  if(!base64Image || !prompt) return res.status(400).json({error:"Imagem e prompt são obrigatórios"});

  try{
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents:[{
        role:"user",
        parts:[
          {text: prompt},
          {inlineData:{mimeType:"image/png",data:base64Image}}
        ]
      }],
      config:{
        responseModalities:["IMAGE","TEXT"], // ✅ corrigido
        temperature:0.1,
        maxOutputTokens:2048
      }
    });

    const imagePart = response.candidates[0]?.content?.parts?.find(p=>p.inlineData);
    if(!imagePart) throw new Error("Nenhuma imagem foi gerada na resposta");

    res.json({success:true, generatedImage:`data:image/png;base64,${imagePart.inlineData.data}`});
  }catch(err){
    console.error("Erro ao gerar imagem:",err);
    res.status(500).json({error:"Erro ao gerar imagem", details: err.message});
  }
});

// Método simplificado (URL)
app.post("/api/generate-image-simple", async (req,res)=>{
  const {imageUrl, prompt} = req.body;
  if(!imageUrl || !prompt) return res.status(400).json({error:"URL da imagem e prompt são obrigatórios"});

  let filename;
  try{
    const urlObj = new URL(imageUrl);
    const extension = path.extname(urlObj.pathname) || ".jpg";
    filename = `image_${Date.now()}${extension}`;
    await downloadImage(imageUrl, filename);

    const imageBuffer = fs.readFileSync(path.join(tempDir,filename));
    const base64Image = imageBuffer.toString("base64");

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents:[{
        role:"user",
        parts:[
          {text: prompt},
          {inlineData:{mimeType:"image/jpeg", data: base64Image}}
        ]
      }],
      config:{responseModalities:["IMAGE","TEXT"], temperature:0.1, maxOutputTokens:2048}
    });

    const imagePart = response.candidates[0]?.content?.parts?.find(p=>p.inlineData);
    if(!imagePart) throw new Error("Nenhuma imagem foi gerada");

    res.json({success:true, generatedImage:`data:image/png;base64,${imagePart.inlineData.data}`});
  }catch(err){
    console.error("Erro ao gerar imagem (simplificado):",err);
    if(filename){
      const filePath = path.join(tempDir,filename);
      if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.status(500).json({error:"Erro ao gerar imagem", details:err.message});
  }
});

// =================== HEALTH CHECK ===================
app.get("/api/health",(req,res)=>{
  res.json({status:"OK", timestamp: new Date().toISOString(), tempDir, tempDirExists: fs.existsSync(tempDir)});
});

// =================== LISTAR MODELOS ===================
app.get("/api/list-models", async (req,res)=>{
  try{
    if(ai.models && typeof ai.models.list==='function'){
      const list = await ai.models.list();
      return res.json({ok:true, source:'sdk', list});
    }
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models',{
      headers:{Authorization:`Bearer ${process.env.GEMINI_API_KEY}`}
    });
    const list = await r.json();
    return res.json({ok:true, source:'rest', list});
  }catch(err){
    console.error('Erro ao listar modelos:',err);
    res.status(500).json({ok:false,error:err.message});
  }
});

// =================== LIMPEZA DE TEMP ===================
setInterval(()=>{
  if(fs.existsSync(tempDir)){
    fs.readdir(tempDir,(err,files)=>{
      if(err) return console.error("Erro ao ler temp:",err);
      const now = Date.now();
      const oneHour = 60*60*1000;
      for(const file of files){
        const filePath = path.join(tempDir,file);
        fs.stat(filePath,(err,stat)=>{
          if(err) return;
          if(now - stat.mtimeMs > oneHour) fs.unlink(filePath,()=>{});
        });
      }
    });
  }
},60*60*1000);

// =================== START SERVER ===================
app.listen(PORT,()=>{
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Pasta temp: ${tempDir}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
