const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const multer = require('multer');
const fs = require('fs');
const { getOAuthClient, getGoogleAuth, TOKENS_PATH } = require('../utils/googleAuth');

// Configuração Multer em Memória (seguro apenas para ficheiros muito pequenos de integração c/ drive, 
// embora no bank_parser usemos em disco). Para o Google Drive, manteremos na memória com limite de 50MB.
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // Limite 50MB
});

// Rota para iniciar autenticação
router.get('/auth', (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const dynamicRedirectUri = `${protocol}://${host}/api/google/auth/callback`;
    
    console.log(`[AUTH] Iniciando OAuth com redirect_uri: ${dynamicRedirectUri}`);
    
    const oauth2Client = getOAuthClient(dynamicRedirectUri);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ]
    });
    res.redirect(url);
  } catch (err) {
    res.status(500).send(`Erro ao configurar autenticação: ${err.message}`);
  }
});

// Rota de callback do Google
router.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const dynamicRedirectUri = `${protocol}://${host}/api/google/auth/callback`;
    
    const oauth2Client = getOAuthClient(dynamicRedirectUri);
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

// Criar pasta no Drive
router.post('/drive/create-folder', async (req, res) => {
  const { name, parentId } = req.body;
  try {
    if (!name || !parentId) return res.status(400).json({ error: "Nome e ID pai obrigatórios." });

    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.create({
      resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id, name'
    });

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

// Upload ficheiro no Drive
router.post('/drive/upload', upload.single('file'), async (req, res) => {
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
    if (error.message.includes('invalid_grant') && fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
    const status = (error.message.includes('AUTH_REQUIRED') || error.message.includes('invalid_grant')) ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Proxy para visualizar ficheiro do Drive
router.get('/drive/file/:fileId', async (req, res) => {
  const { fileId } = req.params;
  try {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    const metadata = await drive.files.get({ fileId, fields: 'mimeType, name' });
    const driveRes = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

    res.setHeader('Content-Type', metadata.data.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${metadata.data.name}"`);
    driveRes.data.pipe(res);
  } catch (error) {
    console.error('[DRIVE-PROXY] ERRO:', error.message);
    if (error.message.includes('invalid_grant') && fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
    const status = (error.message.includes('AUTH_REQUIRED') || error.message.includes('invalid_grant')) ? 401 : 500;
    res.status(status).send(error.message);
  }
});

// Listar pasta do Drive
router.post('/drive/list', async (req, res) => {
  try {
    const { folderId } = req.body;
    if (!folderId) return res.status(400).json({ error: "Folder ID is required" });

    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      pageSize: 1000,
      fields: 'files(id, name, mimeType, webViewLink, thumbnailLink)',
    });
    
    const files = response.data.files || [];
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    
    res.json(files);
  } catch (error) {
    console.error('SERVER ERROR (Drive List):', error.message);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Apagar (Lixeira) ficheiro do Drive
router.delete('/drive/file/:fileId', async (req, res) => {
  const { fileId } = req.params;
  try {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    await drive.files.update({ fileId: fileId, resource: { trashed: true } });
    res.json({ success: true, message: "Ficheiro movido para a lixeira" });
  } catch (error) {
    console.error('[DRIVE] ERRO ao apagar ficheiro:', error.message);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Atualizar Notas das Células (Comments nativos)
router.post('/sheet/update-notes', async (req, res) => {
  try {
    let { spreadsheetId, sheetName, row, col, note } = req.body;
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const rowIndex = parseInt(row);
    const colIndex = parseInt(col);
    const cleanSheetName = (sheetName || '').replace(/'/g, '').trim();

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    let sheet = spreadsheet.data.sheets.find(s => s.properties.title === cleanSheetName);
    
    if (!sheet) {
      sheet = spreadsheet.data.sheets[0];
    }

    if (!sheet) return res.status(404).json({ error: "Nenhuma aba encontrada." });
    
    const sheetId = sheet.properties.sheetId;

    let { color } = req.body;
    let bgColors = null;
    if (color === 'yellow') {
      bgColors = { red: 1.0, green: 0.95, blue: 0.6 }; // Amarelo claro
    } else if (color === 'red') {
      bgColors = { red: 1.0, green: 0.8, blue: 0.8 }; // Vermelho claro
    } else if (color === 'green') {
      bgColors = { red: 0.85, green: 0.95, blue: 0.85 }; // Verde claro
    } else if (color === 'clear') {
      bgColors = { red: 1.0, green: 1.0, blue: 1.0 }; // Branco
    }

    const cellData = { note: note || '' }; // Envia string vazia para limpar a nota
    let fields = 'note';

    if (bgColors) {
      cellData.userEnteredFormat = { backgroundColor: bgColors };
      fields += ',userEnteredFormat.backgroundColor';
    }

    // Usar repeatCell para garantir que a nota e a cor sejam aplicadas
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: colIndex,
              endColumnIndex: colIndex + 1
            },
            cell: cellData,
            fields: fields
          }
        }]
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('GOOGLE API ERROR:', error.response?.data || error.message);
    const detail = error.response?.data?.error?.message || error.message;
    res.status(500).json({ error: `Erro Google API: ${detail}` });
  }
});

// Ler Sheets
router.post('/sheet/read', async (req, res) => {
  try {
    const { spreadsheetId, range } = req.body;
    if (!spreadsheetId) return res.status(400).json({ error: "Spreadsheet ID is required" });

    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: range || 'A1:Z1000' });
    res.json({ values: response.data.values, range: response.data.range });
  } catch (error) {
    console.error('SERVER ERROR (Sheet Read):', error.message);
    if (error.message.includes('invalid_grant') && fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
    const status = (error.message.includes('AUTH_REQUIRED') || error.message.includes('invalid_grant')) ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Atualizar Sheets
router.post('/sheet/update', async (req, res) => {
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
    if (error.message.includes('invalid_grant') && fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
    const status = (error.message.includes('AUTH_REQUIRED') || error.message.includes('invalid_grant')) ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

module.exports = router;
