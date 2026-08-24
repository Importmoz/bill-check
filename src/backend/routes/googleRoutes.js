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

function resolveRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  
  let protocol = req.headers['x-forwarded-proto'] || req.protocol;
  let host = req.get('host') || 'localhost:3000';
  
  // Normalizar 127.0.0.1 para localhost se acessado localmente
  if (host.startsWith('127.0.0.1')) {
    host = host.replace('127.0.0.1', 'localhost');
  }

  // Se o host for domínio com SSL (ou atrás de proxy HTTPS)
  if (host.includes('mycloudspaces.com') || host.includes('sslip.io') || req.headers['x-forwarded-proto'] === 'https') {
    protocol = 'https';
  }
  
  return `${protocol}://${host}/api/google/auth/callback`;
}

// Rota para iniciar autenticação
router.get('/auth', (req, res) => {
  try {
    const dynamicRedirectUri = resolveRedirectUri(req);
    console.log(`[AUTH] Iniciando OAuth com redirect_uri: ${dynamicRedirectUri}`);
    
    const oauth2Client = getOAuthClient(dynamicRedirectUri);
    const statePayload = Buffer.from(JSON.stringify({ redirect_uri: dynamicRedirectUri })).toString('base64');

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state: statePayload,
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
  const { code, state, error: authError } = req.query;

  if (authError) {
    console.warn(`[AUTH] Autenticação retornou erro do Google: ${authError}`);
    return res.status(400).send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #ef4444;">Autenticação Cancelada ou Recusada ⚠️</h1>
        <p>O Google retornou: <strong>${authError}</strong></p>
        <a href="/api/google/auth" style="display: inline-block; background: black; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: bold;">TENTAR NOVAMENTE</a>
      </div>
    `);
  }

  if (!code) {
    console.warn('[AUTH] Callback acedido diretamente sem código. Redirecionando para /api/google/auth...');
    return res.redirect('/api/google/auth');
  }

  let redirectUriToUse = resolveRedirectUri(req);
  if (state) {
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      if (parsed && parsed.redirect_uri) {
        redirectUriToUse = parsed.redirect_uri;
      }
    } catch (e) {}
  }

  try {
    console.log(`[AUTH] Trocando código OAuth com redirect_uri: ${redirectUriToUse}`);
    const oauth2Client = getOAuthClient(redirectUriToUse);
    const { tokens } = await oauth2Client.getToken(code);
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #22c55e;">Autenticação com Sucesso! ✅</h1>
        <p>A aplicação agora tem acesso à tua conta Google para planilhas e suportes.</p>
        <p>Podes fechar esta janela ou clicar no botão abaixo para voltar.</p>
        <a href="/" style="display: inline-block; background: black; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: bold;">VOLTAR AO SISTEMA</a>
      </div>
    `);
  } catch (error) {
    console.error("[AUTH] Erro ao processar token OAuth:", error.message);
    const clientIdHint = process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 15)}...` : '(não definido)';
    res.status(500).send(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px 20px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ef4444; font-size: 24px; margin-bottom: 8px;">Erro na Autenticação</h1>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">O Google recusou a troca de token: <strong>${error.message}</strong></p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: left; font-size: 12px; margin-bottom: 24px;">
          <p style="margin: 4px 0;"><strong>URI Utilizado:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${redirectUriToUse}</code></p>
          <p style="margin: 4px 0;"><strong>Client ID:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${clientIdHint}</code></p>
        </div>

        <a href="/api/google/auth" style="display: inline-block; background: black; color: white; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 13px;">TENTAR NOVAMENTE</a>
      </div>
    `);
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
    const parentId = req.body.parentId || req.query.parentId;
    const file = req.file;
    try {
      if (!file || !parentId) return res.status(400).json({ error: "Ficheiro e ID pai obrigatórios." });
  
      const auth = await getGoogleAuth();
      const drive = google.drive({ version: 'v3', auth });
  
      const { Readable } = require('stream');
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);
  
      // Usar req.body.name ou req.query.name se fornecido
      const nameParam = req.body.name || req.query.name;
      const finalName = nameParam || file.originalname;

    const response = await drive.files.create({
      resource: { name: finalName, parents: [parentId] },
      media: { mimeType: file.mimetype, body: bufferStream },
      fields: 'id, name, webViewLink'
    });

    // Adicionar permissão pública para poder ser visualizado
    try {
      await drive.permissions.create({
        fileId: response.data.id,
        resource: { role: 'reader', type: 'anyone' }
      });
    } catch (permErr) {
      console.warn('[DRIVE] Aviso: Não foi possível definir permissão pública:', permErr.message);
    }

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
    const { folderId, q } = req.body;
    let query = '';
    if (folderId) {
      query = `'${folderId}' in parents and trashed = false`;
    } else if (q) {
      query = q;
    } else {
      return res.status(400).json({ error: "Folder ID or query (q) is required" });
    }

    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.list({
      q: query,
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

    try {
      console.log(`[BACKEND] Tentando ler planilha com includeGridData para obter notas (otimizado via fields). Range: ${range || 'A1:AZ1000'}`);
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        ranges: [range || 'A1:AZ1000'],
        includeGridData: true,
        fields: 'sheets(properties(title,sheetId),data(rowData(values(note,formattedValue))))'
      });

      const sheet = response.data.sheets?.[0];
      const values = [];
      const notes = [];

      if (sheet && sheet.data && sheet.data[0]) {
        const gridData = sheet.data[0];
        const rowData = gridData.rowData || [];

        // 1. Descobrir o número máximo de colunas presente em qualquer linha para evitar arrays truncados
        let maxCols = 0;
        for (let r = 0; r < rowData.length; r++) {
          const cellValues = rowData[r].values || [];
          if (cellValues.length > maxCols) {
            maxCols = cellValues.length;
          }
        }

        // 2. Construir rowValues e rowNotes preenchendo até maxCols para garantir alinhamento perfeito
        for (let r = 0; r < rowData.length; r++) {
          const row = rowData[r];
          const rowValues = [];
          const rowNotes = [];
          const cellValues = row.values || [];

          for (let c = 0; c < maxCols; c++) {
            const cell = cellValues[c];
            if (cell) {
              const val = cell.formattedValue !== undefined ? cell.formattedValue : '';
              rowValues.push(val);
              rowNotes.push(cell.note || '');
            } else {
              rowValues.push('');
              rowNotes.push('');
            }
          }
          values.push(rowValues);
          notes.push(rowNotes);
        }
      }

      const nonEnumNotesCount = notes.flat().filter(n => n && n.trim() !== '').length;
      console.log(`[BACKEND] Leitura com includeGridData concluída. Linhas lidas: ${values.length}, Notas preenchidas encontradas: ${nonEnumNotesCount}`);
      
      let finalRange = range || 'A1:AZ1000';
      const sheetTitle = sheet?.properties?.title;
      if (sheetTitle && !finalRange.includes('!')) {
        const formattedTitle = (sheetTitle.includes(' ') || sheetTitle.includes('-') || /\W/.test(sheetTitle))
          ? `'${sheetTitle}'`
          : sheetTitle;
        finalRange = `${formattedTitle}!${finalRange}`;
      }

      return res.json({
        values,
        notes,
        range: finalRange,
        sheetId: sheet?.properties?.sheetId
      });
    } catch (getErr) {
      console.warn('[BACKEND] Falha ao ler com includeGridData. Usando fallback values.get. Erro:', getErr.message, getErr.response?.data || getErr);
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: range || 'A1:AZ1000' });
      return res.json({
        values: response.data.values || [],
        notes: [],
        range: response.data.range,
        sheetId: null
      });
    }
  } catch (error) {
    console.error('SERVER ERROR (Sheet Read):', error.message);
    if (error.message.includes('invalid_grant') && fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
    const status = (error.message.includes('AUTH_REQUIRED') || error.message.includes('invalid_grant')) ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

router.post('/sheet/batch-requests', async (req, res) => {
  try {
    const { spreadsheetId, requests } = req.body;
    if (!spreadsheetId) return res.status(400).json({ error: "Spreadsheet ID is required" });
    if (!requests || !Array.isArray(requests)) return res.status(400).json({ error: "Requests array is required" });

    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log(`[BACKEND] Executando batchUpdate estrutural. Total de requests: ${requests.length}`);
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: requests
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('SERVER ERROR (Sheet Structural Batch Update):', error.message);
    if (error.message.includes('invalid_grant') && fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
    const status = (error.message.includes('AUTH_REQUIRED') || error.message.includes('invalid_grant')) ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

function extractSpreadsheetId(idOrUrl) {
  if (!idOrUrl) return '';
  if (idOrUrl.includes('/d/')) {
    const match = idOrUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
  }
  return idOrUrl;
}

// Atualizar Sheets
router.post('/sheet/update', async (req, res) => {
  try {
    let { spreadsheetId, range, values } = req.body;
    spreadsheetId = extractSpreadsheetId(spreadsheetId);
    if (!spreadsheetId) return res.status(400).json({ error: "Spreadsheet ID is required" });

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

// Atualizar planilhas em lote (Batch Update)
router.post('/sheet/batch-update', async (req, res) => {
  try {
    let { spreadsheetId, data } = req.body;
    spreadsheetId = extractSpreadsheetId(spreadsheetId);
    if (!spreadsheetId) return res.status(400).json({ error: "Spreadsheet ID is required" });
    if (!data || !Array.isArray(data)) return res.status(400).json({ error: "Data array is required" });

    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log(`[BACKEND] Executando batchUpdate de planilhas. Total de ranges: ${data.length}`);
    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: data
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('SERVER ERROR (Sheet Batch Update):', error.message);
    if (error.message.includes('invalid_grant') && fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
    const status = (error.message.includes('AUTH_REQUIRED') || error.message.includes('invalid_grant')) ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});


// Verificar se a planilha foi atualizada (polling de metadados do Drive)
router.post('/sheet/check-update', async (req, res) => {
  try {
    const { spreadsheetId, lastModifiedTime } = req.body;
    if (!spreadsheetId) return res.status(400).json({ error: "Spreadsheet ID is required" });

    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.get({
      fileId: spreadsheetId,
      fields: 'modifiedTime',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const currentModifiedTime = response.data.modifiedTime;
    
    let updated = false;
    if (lastModifiedTime && currentModifiedTime) {
      updated = new Date(currentModifiedTime).getTime() > new Date(lastModifiedTime).getTime();
    }

    console.log(`[BACKEND][POLLING] ID Planilha: ${spreadsheetId} | Modificado Local (App): ${lastModifiedTime} | Modificado Google Drive: ${currentModifiedTime} | Tem Atualização: ${updated}`);

    res.json({
      updated,
      modifiedTime: currentModifiedTime
    });
  } catch (error) {
    console.error('SERVER ERROR (Sheet Check Update):', error.message);
    if (error.message.includes('invalid_grant') && fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
    const status = (error.message.includes('AUTH_REQUIRED') || error.message.includes('invalid_grant')) ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

module.exports = router;
