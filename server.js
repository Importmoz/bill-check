require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const googleRoutes = require('./src/backend/routes/googleRoutes');
const bankRoutes = require('./src/backend/routes/bankRoutes');
const pautaRoutes = require('./src/backend/routes/pautaRoutes');
const financeRoutes = require('./src/backend/routes/financeRoutes');
// Force reload: 2026-05-12 14:20

const app = express();
const PORT = process.env.PORT || 3000; // Restaurando para 3000

app.set('trust proxy', 1);

// Evitar que o servidor pare completamente (crash) em caso de erros não tratados (ex: falhas de rede na API Google)
process.on('uncaughtException', (err) => {
  console.error('[V2] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[V2] Unhandled Rejection:', reason);
});

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

// Proteger o ficheiro pauta.json do acesso direto via browser
app.use('/data/pauta.json', (req, res) => {
  res.status(403).send('Forbidden: Acesso direto a este ficheiro está bloqueado.');
});

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
  const pocketbaseUrl = process.env.POCKETBASE_URL || 'https://pocketbase.mycloudspaces.com';
  const config = {
    POCKETBASE_URL: pocketbaseUrl
  };
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.POCKETBASE_CONFIG = ${JSON.stringify(config, null, 2)};`);
});

// Rota de Versão do Sistema para controlo de atualizações
const fs = require('fs');
const { execSync } = require('child_process');
let baseVersion = '1.0.0';
try {
  baseVersion = require('./package.json').version;
} catch (e) {}

app.get('/api/version', (req, res) => {
  let gitVersion = '';
  let updates = [];
  try {
    const headContent = fs.readFileSync(path.join(__dirname, '.git', 'HEAD'), 'utf8').trim();
    if (headContent.startsWith('ref:')) {
      const refPath = headContent.replace('ref:', '').trim();
      const commitHash = fs.readFileSync(path.join(__dirname, '.git', refPath), 'utf8').trim();
      gitVersion = commitHash.substring(0, 7);
    } else {
      gitVersion = headContent.substring(0, 7);
    }
  } catch (e) {
    // Fallback silencioso se não estiver em ambiente git
  }

  try {
    const gitLog = execSync('git log -n 5 --pretty=format:"%s"', { encoding: 'utf8' }).trim();
    updates = gitLog.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  } catch (e) {
    // Fallback silencioso se não for git
  }

  // Monitorar também a mtime dos ficheiros cruciais do frontend e backend
  let mtimes = [];
  const filesToTrack = [
    'package.json',
    'server.js',
    'src/frontend/js/ui.js',
    'src/frontend/js/app.js',
    'src/frontend/js/api.js'
  ];
  filesToTrack.forEach(f => {
    try {
      const stats = fs.statSync(path.join(__dirname, f));
      mtimes.push(stats.mtimeMs);
    } catch (e) {}
  });

  const mtimeHash = mtimes.length > 0 ? Math.max(...mtimes) : '0';
  res.json({
    version: `${baseVersion}-${gitVersion || 'no-git'}-${mtimeHash}`,
    updates
  });
});

// Rotas da API
app.use('/api/google', googleRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/pauta', pautaRoutes);
app.use('/api/finance', financeRoutes);

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
