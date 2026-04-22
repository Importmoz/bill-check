const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos da pasta atual
app.use(express.static(__dirname));

// Endpoint de configuração para o frontend
app.get('/config.js', (req, res) => {
  const pocketbaseUrl = process.env.POCKETBASE_URL || 'http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io';
  const config = {
    POCKETBASE_URL: pocketbaseUrl
  };
  
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.POCKETBASE_CONFIG = ${JSON.stringify(config, null, 2)};`);
});

// Rota padrão para index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota de health check para o Coolify
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Capturar todas as rotas para SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
  console.log(`PocketBase URL: ${process.env.POCKETBASE_URL || 'Usando URL padrão'}`);
});