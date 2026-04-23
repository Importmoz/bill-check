const express = require('express');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Logger de pedidos para depuração
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.url}`);
  next();
});

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

// --- GOOGLE OAUTH2 SETUP ---
const OAUTH_PATH = path.join(__dirname, 'google-oauth.json');
const TOKENS_PATH = path.join(__dirname, 'tokens.json');

function getOAuthClient() {
  if (!fs.existsSync(OAUTH_PATH)) {
    throw new Error(`Ficheiro google-oauth.json não encontrado.`);
  }
  const credentials = JSON.parse(fs.readFileSync(OAUTH_PATH, 'utf8'));
  return new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uri
  );
}

async function getGoogleAuth() {
  const oauth2Client = getOAuthClient();

  if (!fs.existsSync(TOKENS_PATH)) {
    throw new Error("AUTH_REQUIRED: Precisas de autorizar a aplicação primeiro. Acede a /api/google/auth");
  }

  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
  oauth2Client.setCredentials(tokens);

  // Escutar por novos tokens (refresh) e guardar
  oauth2Client.on('tokens', (newTokens) => {
    const currentTokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    const mergedTokens = { ...currentTokens, ...newTokens };
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(mergedTokens, null, 2));
    console.log('[AUTH] Tokens atualizados com sucesso.');
  });

  return oauth2Client;
}

// Rota para iniciar autenticação
app.get('/api/google/auth', (req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  });
  res.redirect(url);
});

// Rota de callback do Google
app.get('/api/google/auth/callback', async (req, res) => {
  const { code } = req.query;
  const oauth2Client = getOAuthClient();
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #22c55e;">Autenticação com Sucesso! ✅</h1>
        <p>A aplicação agora tem acesso à tua conta Google para uploads.</p>
        <p>Podes fechar esta janela e voltar ao Dashboard.</p>
        <a href="/" style="display: inline-block; background: black; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; margin-top: 20px;">VOLTAR AO DASHBOARD</a>
      </div>
    `);
  } catch (error) {
    res.status(500).send(`Erro na autenticação: ${error.message}`);
  }
});

// Endpoint para criar pasta no Drive
app.post('/api/google/drive/create-folder', async (req, res) => {
  const { name, parentId } = req.body;
  try {
    if (!name || !parentId) return res.status(400).json({ error: "Nome e ID pai obrigatórios." });

    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    
    const response = await drive.files.create({
      resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id, name'
    });

    // Opcional: Tornar a pasta pública (leitura)
    await drive.permissions.create({
      fileId: response.data.id,
      resource: { role: 'reader', type: 'anyone' }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('[DRIVE] ERRO ao criar pasta:', error.message);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Endpoint para upload de ficheiro para o Drive
app.post('/api/google/drive/upload', upload.single('file'), async (req, res) => {
  const { parentId } = req.body;
  const file = req.file;
  try {
    if (!file || !parentId) return res.status(400).json({ error: "Ficheiro e ID pai obrigatórios." });

    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    
    const { Readable } = require('stream');
    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);

    const response = await drive.files.create({
      resource: { name: file.originalname, parents: [parentId] },
      media: { mimeType: file.mimetype, body: bufferStream },
      fields: 'id, name, webViewLink'
    });

    await drive.permissions.create({
      fileId: response.data.id,
      resource: { role: 'reader', type: 'anyone' }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('[DRIVE] ERRO no upload:', error.message);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Endpoint para visualizar ficheiro (Proxy)
app.get('/api/google/drive/file/:fileId', async (req, res) => {
  const { fileId } = req.params;
  try {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    
    // Obter metadados
    const metadata = await drive.files.get({ fileId, fields: 'mimeType, name' });
    
    // Obter conteúdo com suporte a redirecionamentos
    const driveRes = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    
    res.setHeader('Content-Type', metadata.data.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${metadata.data.name}"`);
    driveRes.data.pipe(res);
  } catch (error) {
    console.error('[DRIVE-PROXY] ERRO:', error.message);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 500;
    res.status(status).send(error.message);
  }
});

// Endpoint para ler GSheet
app.post('/api/google/sheet/read', async (req, res) => {
  try {
    const { spreadsheetId, range } = req.body;
    if (!spreadsheetId) return res.status(400).json({ error: "Spreadsheet ID is required" });
    
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: range || 'A1:Z1000' });
    res.json(response.data.values);
  } catch (error) {
    console.error('SERVER ERROR (Sheet Read):', error.message);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Endpoint para atualizar GSheet
app.post('/api/google/sheet/update', async (req, res) => {
  try {
    const { spreadsheetId, range, values } = req.body;
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId, range: range || 'A1', valueInputOption: 'USER_ENTERED', resource: { values }
    });
    res.json(response.data);
  } catch (error) {
    console.error('SERVER ERROR (Sheet Update):', error.message);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Endpoint para listar Drive
app.post('/api/google/drive/list', async (req, res) => {
  try {
    const { folderId } = req.body;
    if (!folderId) return res.status(400).json({ error: "Folder ID is required" });

    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, thumbnailLink)',
    });
    res.json(response.data.files);
  } catch (error) {
    console.error('SERVER ERROR (Drive List):', error.message);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Endpoint para apagar (lixeira) ficheiro do Drive
app.delete('/api/google/drive/file/:fileId', async (req, res) => {
  const { fileId } = req.params;
  console.log(`[DRIVE] Solicitação para apagar ficheiro: ${fileId}`);
  
  try {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    
    // Mover para a lixeira (trash) é mais seguro que apagar permanentemente
    await drive.files.update({
      fileId: fileId,
      resource: { trashed: true }
    });
    
    console.log(`[DRIVE] Ficheiro ${fileId} movido para a lixeira.`);
    res.json({ success: true, message: "Ficheiro movido para a lixeira" });
  } catch (error) {
    console.error('[DRIVE] ERRO ao apagar ficheiro:', error.message);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Rota de health check para o Coolify e depuração
app.get('/health', (req, res) => {
  const authExists = fs.existsSync(TOKENS_PATH);
  res.status(200).json({ 
    status: 'OK', 
    version: '1.0.6-OAUTH',
    authenticated: authExists,
    timestamp: new Date().toISOString() 
  });
});

// Capturar todas as rotas para SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
  console.log(`POCKETBASE: ${process.env.POCKETBASE_URL || 'Padrão'}`);
  if (!fs.existsSync(TOKENS_PATH)) {
    console.log(`\n\x1b[33m[AVISO] Autenticação necessária! Acede a: http://localhost:3000/api/google/auth\x1b[0m\n`);
  }
});
