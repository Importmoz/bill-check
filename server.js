require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const googleRoutes = require('./src/backend/routes/googleRoutes');
const bankRoutes = require('./src/backend/routes/bankRoutes');
// Force reload: 2026-05-12 14:20

const app = express();
const PORT = process.env.PORT || 3000; // Restaurando para 3000

// Segurança: Helmet ajuda a proteger contra várias vulnerabilidades
// app.use(helmet({
//   contentSecurityPolicy: false,
//   crossOriginEmbedderPolicy: false,
// }));

// CORS
app.use(cors());

// Rate Limiting para evitar abusos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000 // Aumentado significativamente para suportar a nova lógica de conciliação
});
app.use('/api/', limiter);

app.use(express.json());

// Servir arquivos estáticos do frontend modularizado
app.use(express.static(path.join(__dirname, 'src', 'frontend'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Rota de configuração para o PocketBase
app.get('/config.js', (req, res) => {
  const pocketbaseUrl = process.env.POCKETBASE_URL || 'http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io';
  const config = {
    POCKETBASE_URL: pocketbaseUrl
  };
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.POCKETBASE_CONFIG = ${JSON.stringify(config, null, 2)};`);
});

// Rotas da API
app.use('/api/google', googleRoutes);
app.use('/api/bank', bankRoutes);

// Rota base para SPA
app.get(/.*/, (req, res) => {
  if (req.url.includes('.') && !req.url.endsWith('.html')) {
    console.warn(`[V2] Recurso não encontrado: ${req.url}`);
    return res.status(404).send('Not Found');
  }
  res.sendFile(path.join(__dirname, 'src', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[V2] Servidor rodando na porta ${PORT}`);
  console.log(`[V2] Acesse: http://localhost:${PORT}`);
});
