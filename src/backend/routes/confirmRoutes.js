const express = require('express');
const router = express.Router();
const multer = require('multer');
const { google } = require('googleapis');
const { Readable } = require('stream');
const PocketBase = require('pocketbase/cjs');
const { getGoogleAuth, TOKENS_PATH } = require('../utils/googleAuth');

// Configuração do Multer em memória para ficheiros (limite 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const pbUrl = process.env.POCKETBASE_URL || 'https://pocketbase.mycloudspaces.com';

function cleanString(str) {
  return String(str || '')
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function canonicalizeName(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getColLetter(colIndex) {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * POST /api/confirm/fill-client
 * Preenche dados de cliente e artigos no Google Sheets e faz upload de ficheiros para o Google Drive
 */
router.post('/fill-client', upload.array('files', 10), async (req, res) => {
  try {
    let payload = {};
    if (req.body.data) {
      payload = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else {
      payload = req.body;
    }

    const { container, projectId, client, articles } = payload;
    const files = req.files || [];

    if (!container && !projectId) {
      return res.status(400).json({ error: 'Identificador do contentor/projeto é obrigatório.' });
    }

    if (!client || !client.name) {
      return res.status(400).json({ error: 'Dados do cliente (nome obrigatório) não informados.' });
    }

    const inputArticles = Array.isArray(articles) ? articles : (Array.isArray(orders) ? orders : (articles ? [articles] : (orders ? [orders] : [])));

    // 1. Obter projeto no PocketBase
    const pb = new PocketBase(pbUrl);
    pb.autoCancellation(false);

    let project = null;
    if (projectId) {
      project = await pb.collection('confirm_projects').getOne(projectId).catch(() => null);
    }
    if (!project && container) {
      const cleanCont = String(container).trim();
      project = await pb.collection('confirm_projects').getFirstListItem(`name = "${cleanCont}"`).catch(() => null);
      if (!project) {
        // Tenta buscar por substring
        const allProjects = await pb.collection('confirm_projects').getFullList().catch(() => []);
        project = allProjects.find(p => String(p.name || '').trim().toUpperCase() === cleanCont.toUpperCase());
      }
    }

    if (!project || !project.sheetId) {
      return res.status(404).json({ error: `Projeto/Contentor "${container || projectId}" não encontrado ou sem folha vinculada.` });
    }

    const spreadsheetId = project.sheetId;
    const projectFolderId = project.folderId || null;

    // 2. Inicializar APIs do Google
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Obter dados actuais da planilha
    const metaRes = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title))'
    });

    const firstSheet = metaRes.data.sheets?.[0]?.properties;
    const sheetTabId = firstSheet?.sheetId ?? 0;
    const sheetTitle = firstSheet?.title || 'Folha1';

    const sheetValuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTitle}!A1:AZ1000`
    });

    const rows = sheetValuesRes.data.values || [];
    if (rows.length === 0) {
      return res.status(500).json({ error: 'A folha de cálculo está vazia ou sem cabeçalhos.' });
    }

    const headers = rows[0].map(h => String(h || '').trim());
    const cleanHeaders = headers.map(cleanString);

    // Mapeamento de colunas
    const colMap = {
      status: cleanHeaders.findIndex(h => h === 'STATUS' || h === 'ESTADO'),
      no: cleanHeaders.findIndex(h => h === 'NO' || h === 'NUMERO' || h.startsWith('NO.')),
      idCode: cleanHeaders.findIndex(h => h === 'IDCODE' || h === 'CODEID' || h === 'ID'),
      name: cleanHeaders.findIndex(h => h === 'NAME' || h === 'NOME' || h === 'CLIENTE' || h === 'CLIENT'),
      phone: cleanHeaders.findIndex(h => h === 'PHONENUMBER' || h === 'PHONE' || h === 'TELEFONE' || h === 'CONTACTO'),
      orderNumber: cleanHeaders.findIndex(h => h === 'ORDERNUMBER' || h === 'ORDERNUM' || h === 'ORDER' || h === 'REFERENCIA' || h === 'HF2'),
      description: cleanHeaders.findIndex(h => h.includes('DESCRIPTION') || h.includes('DESCRICAO') || h === 'CARGO'),
      cbm: cleanHeaders.findIndex(h => h === 'CBM' || h === 'M3' || h === 'VOLUME'),
      unitDuty: cleanHeaders.findIndex(h => h === 'UNITCBMDUTY' || h === 'UNITDUTY' || h === 'CBMDUTY'),
      dutyPrepaid: cleanHeaders.findIndex(h => h === 'DUTYPREPAID' || h === 'PREPAID' || h === 'PROPAGO'),
      amountDuty: cleanHeaders.findIndex(h => h === 'AMOUNTDUTY' || h === 'AMTDUTY' || h === 'TOTALDUTY' || h === 'VALORDUTY'),
      paid: cleanHeaders.findIndex((h, i) => (h === 'PAID' || h === 'PAGO') && !h.includes('PREPAID') && !h.includes('DUTY') && !h.includes('FREIGHT')),
      balance: cleanHeaders.findIndex(h => h === 'BALANCE' || h === 'SALDO' || h === 'BALANCO'),
      bankDuty: cleanHeaders.findIndex(h => h === 'BANKINDUTY' || h === 'BANK' || h === 'BANCO'),
      confirmation: cleanHeaders.findIndex(h => h === 'CONFIRMATION' || h === 'CONFIRMACAO'),
      packages: cleanHeaders.findIndex(h => h === 'PACKAGES' || h === 'VOLUMES' || h === 'QTD'),
      unitFreight: cleanHeaders.findIndex(h => h === 'UNITCBMFREIGHT' || h === 'UNITFREIGHT'),
      amountFreight: cleanHeaders.findIndex(h => h === 'AMOUNTFREIGHT' || h === 'TOTALFREIGHT'),
      paidFreight: cleanHeaders.findIndex(h => h === 'PAIDFREIGHT'),
      balanceFreight: cleanHeaders.findIndex(h => h === 'BALANCEFREIGHT'),
      bankFreight: cleanHeaders.findIndex(h => h === 'BANKINFREIGHT'),
      notaFreight: cleanHeaders.findIndex(h => h === 'NOTAFREIGHT'),
      notaDuty: cleanHeaders.findIndex(h => h === 'NOTADUTY' || h === 'NOTA' || h === 'OBSERVACAO')
    };

    // Fallbacks para colunas comuns se não encontradas
    if (colMap.status === -1) colMap.status = 0;
    if (colMap.no === -1) colMap.no = 1;
    if (colMap.idCode === -1) colMap.idCode = 2;
    if (colMap.name === -1) colMap.name = 3;
    if (colMap.phone === -1) colMap.phone = 4;
    if (colMap.orderNumber === -1) colMap.orderNumber = 5;
    if (colMap.description === -1) colMap.description = 6;
    if (colMap.cbm === -1) colMap.cbm = 7;
    if (colMap.unitDuty === -1) colMap.unitDuty = 8;
    if (colMap.dutyPrepaid === -1) colMap.dutyPrepaid = 9;
    if (colMap.amountDuty === -1) colMap.amountDuty = 10;
    if (colMap.paid === -1) colMap.paid = 11;
    if (colMap.balance === -1) colMap.balance = 12;
    if (colMap.bankDuty === -1) colMap.bankDuty = 13;
    if (colMap.confirmation === -1) colMap.confirmation = 14;

    // 3. Identificar o cliente existente na folha
    const clientNameNorm = client ? canonicalizeName(client.name) : '';
    const clientNoStr = client && client.no !== undefined && client.no !== null ? String(client.no).trim() : '';
    const clientIdCodeStr = client && client.idCode ? String(client.idCode).trim().toUpperCase() : '';

    let existingClientStartIdx = -1;
    let existingClientEndIdx = -1;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const rowNo = String(r[colMap.no] || '').trim();
      const rowName = canonicalizeName(r[colMap.name]);
      const rowIdCode = String(r[colMap.idCode] || '').trim().toUpperCase();

      const matchNo = clientNoStr && rowNo === clientNoStr;
      const matchName = clientNameNorm && rowName === clientNameNorm;
      const matchIdCode = clientIdCodeStr && rowIdCode && rowIdCode === clientIdCodeStr;

      if (matchNo || matchName || matchIdCode) {
        existingClientStartIdx = i;
        // Encontrar onde termina o bloco do cliente (próxima linha com NO preenchido ou TOTAL)
        let j = i + 1;
        while (j < rows.length) {
          const nextRow = rows[j] || [];
          const nextRowString = nextRow.slice(0, 10).map(c => String(c || '').toUpperCase()).join(' ');
          if (nextRowString.includes('TOTAL')) break;
          const nextRowNo = String(nextRow[colMap.no] || '').trim();
          const nextRowName = String(nextRow[colMap.name] || '').trim();
          if (nextRowNo !== '' || nextRowName !== '') break;
          j++;
        }
        existingClientEndIdx = j;
        break;
      }
    }

    if (existingClientStartIdx === -1) {
      return res.status(404).json({
        error: `Cliente "${client?.name || clientNoStr || clientIdCodeStr}" não foi encontrado no contentor ${project.name}. Apenas ordens de clientes existentes podem ser atualizadas.`
      });
    }

    const effectiveClientNo = String(rows[existingClientStartIdx][colMap.no] || clientNoStr || '').trim();
    const effectiveClientName = String(rows[existingClientStartIdx][colMap.name] || client.name || '').trim();
    const effectiveClientIdCode = String(rows[existingClientStartIdx][colMap.idCode] || client.idCode || '').trim();

    // 4. Atualizar status geral ou telefone do cliente, se fornecido
    if (client.status && colMap.status !== -1) {
      rows[existingClientStartIdx][colMap.status] = client.status;
    }
    if (client.phone && colMap.phone !== -1) {
      rows[existingClientStartIdx][colMap.phone] = client.phone;
    }

    // 5. Atualizar as ORDENS EXISTENTES do cliente (NÃO cria linhas novas)
    const updatedOrdersList = [];
    const unmatchedOrdersList = [];
    let hasSheetModifications = false;

    // Se foram enviados artigos/ordens para atualizar
    if (inputArticles.length > 0) {
      inputArticles.forEach((art) => {
        const targetOrderNo = cleanString(art.orderNo || art.orderNumber || art.order || '');
        let matchedRowIdx = -1;

        // Se especificou número da ordem, procura nas linhas do cliente
        if (targetOrderNo) {
          for (let rIdx = existingClientStartIdx; rIdx < existingClientEndIdx; rIdx++) {
            const rowOrderNo = cleanString(rows[rIdx]?.[colMap.orderNumber] || '');
            if (rowOrderNo === targetOrderNo) {
              matchedRowIdx = rIdx;
              break;
            }
          }
        } else if ((existingClientEndIdx - existingClientStartIdx) === 1) {
          // Cliente só tem 1 ordem e não informou orderNo: atualiza essa única ordem
          matchedRowIdx = existingClientStartIdx;
        }

        if (matchedRowIdx !== -1) {
          const rowArr = rows[matchedRowIdx] || [];
          // Garantir tamanho do array da linha
          while (rowArr.length < headers.length) {
            rowArr.push('');
          }
          const targetRowNum = matchedRowIdx + 1; // 1-based para fórmulas do Google Sheets

          // Pagamento Duty
          if (art.paid !== undefined || art.paidDuty !== undefined || art.pago !== undefined) {
            const pVal = art.paid !== undefined ? art.paid : (art.paidDuty !== undefined ? art.paidDuty : art.pago);
            if (colMap.paid !== -1) rowArr[colMap.paid] = pVal;
          }

          // Duty Prepaid
          if (art.dutyPrepaid !== undefined || art.prepaid !== undefined || art.propago !== undefined) {
            const dpVal = art.dutyPrepaid !== undefined ? art.dutyPrepaid : (art.prepaid !== undefined ? art.prepaid : art.propago);
            if (colMap.dutyPrepaid !== -1) rowArr[colMap.dutyPrepaid] = dpVal;
          }

          // Banco Duty
          const bDuty = art.bankDuty || art.bank || art.bankInDuty || art.banco;
          if (bDuty && colMap.bankDuty !== -1) rowArr[colMap.bankDuty] = bDuty;

          // Confirmação / Status
          const confStatus = art.confirmation || art.status || art.confirmacao;
          if (confStatus && colMap.confirmation !== -1) rowArr[colMap.confirmation] = confStatus;

          // Frete
          if (art.paidFreight !== undefined || art.pagoFrete !== undefined) {
            const pfVal = art.paidFreight !== undefined ? art.paidFreight : art.pagoFrete;
            if (colMap.paidFreight !== -1) rowArr[colMap.paidFreight] = pfVal;
          }
          const bFreight = art.bankFreight || art.bankInFreight || art.bancoFrete;
          if (bFreight && colMap.bankFreight !== -1) rowArr[colMap.bankFreight] = bFreight;

          // Notas / Observações
          if (art.notaDuty !== undefined && colMap.notaDuty !== -1) rowArr[colMap.notaDuty] = art.notaDuty;
          if (art.notaFreight !== undefined && colMap.notaFreight !== -1) rowArr[colMap.notaFreight] = art.notaFreight;

          // Campos Físicos (CBM, Packages, Description) se fornecidos
          if (art.cbm !== undefined && colMap.cbm !== -1) rowArr[colMap.cbm] = art.cbm;
          if ((art.packages !== undefined || art.pcs !== undefined || art.volumes !== undefined) && colMap.packages !== -1) {
            rowArr[colMap.packages] = art.packages || art.pcs || art.volumes;
          }
          if (art.description !== undefined && colMap.description !== -1) rowArr[colMap.description] = art.description;

          // Fórmulas para AMOUNT DUTY e BALANCE
          const cbmCol = colMap.cbm !== -1 ? getColLetter(colMap.cbm) : 'H';
          const unitDutyCol = colMap.unitDuty !== -1 ? getColLetter(colMap.unitDuty) : 'I';
          const amtDutyCol = colMap.amountDuty !== -1 ? getColLetter(colMap.amountDuty) : 'K';
          const paidCol = colMap.paid !== -1 ? getColLetter(colMap.paid) : 'L';

          if (colMap.amountDuty !== -1) {
            rowArr[colMap.amountDuty] = `=${cbmCol}${targetRowNum}*${unitDutyCol}${targetRowNum}`;
          }
          if (colMap.balance !== -1) {
            rowArr[colMap.balance] = `=${amtDutyCol}${targetRowNum}-${paidCol}${targetRowNum}`;
          }

          rows[matchedRowIdx] = rowArr;
          updatedOrdersList.push(String(rowArr[colMap.orderNumber] || targetOrderNo));
          hasSheetModifications = true;
        } else {
          unmatchedOrdersList.push(art.orderNo || art.orderNumber || 'Ordem não identificada');
        }
      });
    }

    // Se houve modificação de status/telefone no cliente, marca como modificado
    if (client.status || client.phone) {
      hasSheetModifications = true;
    }

    // 6. Gravar alterações na folha (apenas nas linhas existentes deste cliente)
    if (hasSheetModifications) {
      const clientStartRow = existingClientStartIdx + 1; // 1-based
      const clientEndRow = existingClientEndIdx; // 1-based inclusivo
      const endColLetter = getColLetter(headers.length - 1);
      const updateRange = `${sheetTitle}!A${clientStartRow}:${endColLetter}${clientEndRow}`;

      const sliceValues = rows.slice(existingClientStartIdx, existingClientEndIdx);

      console.log(`[CONFIRM API] Atualizando linhas existentes no range "${updateRange}"...`);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        resource: { values: sliceValues }
      });
    }

    // 7. Processar Ficheiros no Google Drive (SUPORTES)
    let uploadedFilesResult = [];
    let clientFolderId = null;

    if (projectFolderId) {
      try {
        const folderTargetPattern = canonicalizeName(`${effectiveClientNo} ${client.name}`);
        console.log(`[CONFIRM API] Localizando pasta no Drive para "${folderTargetPattern}"...`);

        const listRes = await drive.files.list({
          q: `'${projectFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)'
        });

        const existingFolder = (listRes.data.files || []).find(f => {
          const norm = canonicalizeName(f.name);
          return norm.includes(folderTargetPattern) || (client.idCode && norm.includes(canonicalizeName(client.idCode)));
        });

        if (existingFolder) {
          clientFolderId = existingFolder.id;
        } else {
          // Criar subpasta do cliente
          const newFolderName = `${effectiveClientNo} ${client.name}`.trim();
          console.log(`[CONFIRM API] Criando pasta no Drive: "${newFolderName}"`);
          const createFolderRes = await drive.files.create({
            resource: {
              name: newFolderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [projectFolderId]
            },
            fields: 'id, name'
          });
          clientFolderId = createFolderRes.data.id;

          // Permissão de leitura pública
          try {
            await drive.permissions.create({
              fileId: clientFolderId,
              resource: { role: 'reader', type: 'anyone' }
            });
          } catch (e) {}
        }

        // Fazer upload de cada ficheiro recebido
        if (clientFolderId && files.length > 0) {
          for (const f of files) {
            const bufferStream = new Readable();
            bufferStream.push(f.buffer);
            bufferStream.push(null);

            const fileUploadRes = await drive.files.create({
              resource: { name: f.originalname, parents: [clientFolderId] },
              media: { mimeType: f.mimetype, body: bufferStream },
              fields: 'id, name, webViewLink'
            });

            try {
              await drive.permissions.create({
                fileId: fileUploadRes.data.id,
                resource: { role: 'reader', type: 'anyone' }
              });
            } catch (e) {}

            uploadedFilesResult.push({
              id: fileUploadRes.data.id,
              name: fileUploadRes.data.name,
              link: fileUploadRes.data.webViewLink
            });
          }
          console.log(`[CONFIRM API] ${uploadedFilesResult.length} arquivo(s) enviado(s) para a pasta do cliente.`);
        }
      } catch (driveErr) {
        console.warn('[CONFIRM API] Erro ao gerenciar Google Drive:', driveErr.message);
      }
    }

    // 9. Atualizar PocketBase com dados novos para refletir instantaneamente
    try {
      const refreshedValuesRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetTitle}!A1:AZ1000`
      });
      const freshValues = refreshedValuesRes.data.values || [];
      await pb.collection('confirm_projects').update(project.id, {
        sheet_data: {
          values: freshValues,
          range: `${sheetTitle}!A1:AZ1000`,
          updatedAt: new Date().toISOString()
        },
        last_sync: new Date().toISOString()
      });
      console.log(`[CONFIRM API] Cache local do PocketBase atualizado com sucesso.`);
    } catch (pbErr) {
      console.warn('[CONFIRM API] Falha ao atualizar cache no PocketBase:', pbErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Ordens atualizadas e documentos processados com sucesso!',
      container: project.name,
      client: {
        no: effectiveClientNo,
        name: effectiveClientName,
        phone: rows[existingClientStartIdx][colMap.phone] || '',
        idCode: effectiveClientIdCode
      },
      updatedOrders: updatedOrdersList,
      unmatchedOrders: unmatchedOrdersList,
      clientFolderId,
      uploadedFiles: uploadedFilesResult
    });

  } catch (error) {
    console.error('[CONFIRM API] Erro ao processar preenchimento:', error);
    if (error.message.includes('invalid_grant') && require('fs').existsSync(TOKENS_PATH)) {
      require('fs').unlinkSync(TOKENS_PATH);
    }
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 500;
    return res.status(status).json({ error: error.message || 'Erro interno ao preencher dados.' });
  }
});

/**
 * POST /api/confirm/get-client
 * Retorna as informações completas do cliente, ordens e ficheiros do Google Drive
 */
router.post('/get-client', async (req, res) => {
  try {
    const { container, projectId, client } = req.body || {};

    if (!container && !projectId) {
      return res.status(400).json({ error: 'Identificador do contentor/projeto (container ou projectId) é obrigatório.' });
    }

    if (!client || (!client.name && !client.no && !client.idCode && !client.phone)) {
      return res.status(400).json({ error: 'Identificador do cliente (name, no, idCode ou phone) é obrigatório.' });
    }

    // 1. Obter projeto no PocketBase
    const pb = new PocketBase(pbUrl);
    pb.autoCancellation(false);

    let project = null;
    if (projectId) {
      project = await pb.collection('confirm_projects').getOne(projectId).catch(() => null);
    }
    if (!project && container) {
      const cleanCont = String(container).trim();
      project = await pb.collection('confirm_projects').getFirstListItem(`name = "${cleanCont}"`).catch(() => null);
      if (!project) {
        const allProjects = await pb.collection('confirm_projects').getFullList().catch(() => []);
        project = allProjects.find(p => String(p.name || '').trim().toUpperCase() === cleanCont.toUpperCase());
      }
    }

    if (!project || !project.sheetId) {
      return res.status(404).json({ error: `Projeto/Contentor "${container || projectId}" não encontrado.` });
    }

    const spreadsheetId = project.sheetId;
    const projectFolderId = project.folderId || null;

    // 2. Obter dados da planilha
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    const metaRes = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title))'
    });
    const firstSheet = metaRes.data.sheets?.[0]?.properties;
    const sheetTitle = firstSheet?.title || 'Folha1';

    const sheetValuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTitle}!A1:AZ1000`
    });

    const rows = sheetValuesRes.data.values || [];
    if (rows.length === 0) {
      return res.status(500).json({ error: 'A folha de cálculo está vazia.' });
    }

    const headers = rows[0].map(h => String(h || '').trim());
    const cleanHeaders = headers.map(cleanString);

    const colMap = {
      status: cleanHeaders.findIndex(h => h === 'STATUS' || h === 'ESTADO'),
      no: cleanHeaders.findIndex(h => h === 'NO' || h === 'NUMERO' || h.startsWith('NO.')),
      idCode: cleanHeaders.findIndex(h => h === 'IDCODE' || h === 'CODEID' || h === 'ID'),
      name: cleanHeaders.findIndex(h => h === 'NAME' || h === 'NOME' || h === 'CLIENTE' || h === 'CLIENT'),
      phone: cleanHeaders.findIndex(h => h === 'PHONENUMBER' || h === 'PHONE' || h === 'TELEFONE' || h === 'CONTACTO'),
      orderNumber: cleanHeaders.findIndex(h => h === 'ORDERNUMBER' || h === 'ORDERNUM' || h === 'ORDER' || h === 'REFERENCIA' || h === 'HF2'),
      description: cleanHeaders.findIndex(h => h.includes('DESCRIPTION') || h.includes('DESCRICAO') || h === 'CARGO'),
      cbm: cleanHeaders.findIndex(h => h === 'CBM' || h === 'M3' || h === 'VOLUME'),
      unitDuty: cleanHeaders.findIndex(h => h === 'UNITCBMDUTY' || h === 'UNITDUTY' || h === 'CBMDUTY'),
      dutyPrepaid: cleanHeaders.findIndex(h => h === 'DUTYPREPAID' || h === 'PREPAID' || h === 'PROPAGO'),
      amountDuty: cleanHeaders.findIndex(h => h === 'AMOUNTDUTY' || h === 'AMTDUTY' || h === 'TOTALDUTY' || h === 'VALORDUTY'),
      paid: cleanHeaders.findIndex((h, i) => (h === 'PAID' || h === 'PAGO') && !h.includes('PREPAID') && !h.includes('DUTY') && !h.includes('FREIGHT')),
      balance: cleanHeaders.findIndex(h => h === 'BALANCE' || h === 'SALDO' || h === 'BALANCO'),
      bankDuty: cleanHeaders.findIndex(h => h === 'BANKINDUTY' || h === 'BANK' || h === 'BANCO'),
      confirmation: cleanHeaders.findIndex(h => h === 'CONFIRMATION' || h === 'CONFIRMACAO'),
      packages: cleanHeaders.findIndex(h => h === 'PACKAGES' || h === 'VOLUMES' || h === 'QTD'),
      unitFreight: cleanHeaders.findIndex(h => h === 'UNITCBMFREIGHT' || h === 'UNITFREIGHT'),
      amountFreight: cleanHeaders.findIndex(h => h === 'AMOUNTFREIGHT' || h === 'TOTALFREIGHT'),
      paidFreight: cleanHeaders.findIndex(h => h === 'PAIDFREIGHT'),
      balanceFreight: cleanHeaders.findIndex(h => h === 'BALANCEFREIGHT'),
      bankFreight: cleanHeaders.findIndex(h => h === 'BANKINFREIGHT'),
      notaFreight: cleanHeaders.findIndex(h => h === 'NOTAFREIGHT'),
      notaDuty: cleanHeaders.findIndex(h => h === 'NOTADUTY' || h === 'NOTA' || h === 'OBSERVACAO')
    };

    if (colMap.status === -1) colMap.status = 0;
    if (colMap.no === -1) colMap.no = 1;
    if (colMap.idCode === -1) colMap.idCode = 2;
    if (colMap.name === -1) colMap.name = 3;
    if (colMap.phone === -1) colMap.phone = 4;
    if (colMap.orderNumber === -1) colMap.orderNumber = 5;
    if (colMap.description === -1) colMap.description = 6;
    if (colMap.cbm === -1) colMap.cbm = 7;
    if (colMap.unitDuty === -1) colMap.unitDuty = 8;
    if (colMap.dutyPrepaid === -1) colMap.dutyPrepaid = 9;
    if (colMap.amountDuty === -1) colMap.amountDuty = 10;
    if (colMap.paid === -1) colMap.paid = 11;
    if (colMap.balance === -1) colMap.balance = 12;
    if (colMap.bankDuty === -1) colMap.bankDuty = 13;
    if (colMap.confirmation === -1) colMap.confirmation = 14;

    // 3. Localizar o cliente
    const clientNameNorm = client.name ? canonicalizeName(client.name) : '';
    const clientNoStr = client.no !== undefined && client.no !== null ? String(client.no).trim() : '';
    const clientIdCodeStr = client.idCode ? String(client.idCode).trim().toUpperCase() : '';
    const clientPhoneClean = client.phone ? cleanString(client.phone) : '';

    let existingClientStartIdx = -1;
    let existingClientEndIdx = -1;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const rowNo = String(r[colMap.no] || '').trim();
      const rowName = canonicalizeName(r[colMap.name]);
      const rowIdCode = String(r[colMap.idCode] || '').trim().toUpperCase();
      const rowPhone = cleanString(r[colMap.phone] || '');

      const matchNo = clientNoStr && rowNo === clientNoStr;
      const matchName = clientNameNorm && rowName === clientNameNorm;
      const matchIdCode = clientIdCodeStr && rowIdCode && rowIdCode === clientIdCodeStr;
      const matchPhone = clientPhoneClean && rowPhone && rowPhone === clientPhoneClean;

      if (matchNo || matchName || matchIdCode || matchPhone) {
        existingClientStartIdx = i;
        let j = i + 1;
        while (j < rows.length) {
          const nextRow = rows[j] || [];
          const nextRowString = nextRow.slice(0, 10).map(c => String(c || '').toUpperCase()).join(' ');
          if (nextRowString.includes('TOTAL')) break;
          const nextRowNo = String(nextRow[colMap.no] || '').trim();
          const nextRowName = String(nextRow[colMap.name] || '').trim();
          if (nextRowNo !== '' || nextRowName !== '') break;
          j++;
        }
        existingClientEndIdx = j;
        break;
      }
    }

    if (existingClientStartIdx === -1) {
      return res.status(404).json({
        error: `Cliente "${client.name || clientNoStr || clientIdCodeStr}" não encontrado no contentor ${project.name}.`
      });
    }

    const firstRow = rows[existingClientStartIdx];
    const clientNo = String(firstRow[colMap.no] || clientNoStr || '').trim();
    const clientName = String(firstRow[colMap.name] || client.name || '').trim();
    const clientIdCode = String(firstRow[colMap.idCode] || client.idCode || '').trim();
    const clientPhone = String(firstRow[colMap.phone] || client.phone || '').trim();
    const clientStatus = String(firstRow[colMap.status] || '').trim();

    // 4. Extrair ordens do cliente e calcular totais
    const orders = [];
    const totals = {
      cbm: 0,
      amountDuty: 0,
      dutyPrepaid: 0,
      paid: 0,
      balance: 0,
      packages: 0,
      amountFreight: 0,
      paidFreight: 0,
      balanceFreight: 0
    };

    const parseNum = (val) => {
      if (!val) return 0;
      const clean = String(val).replace(/\s/g, '').replace(/,/g, '.');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    for (let rIdx = existingClientStartIdx; rIdx < existingClientEndIdx; rIdx++) {
      const r = rows[rIdx] || [];
      const orderNumber = String(r[colMap.orderNumber] || '').trim();
      const description = String(r[colMap.description] || '').trim();
      const cbm = parseNum(r[colMap.cbm]);
      const unitDuty = parseNum(r[colMap.unitDuty]);
      const dutyPrepaid = parseNum(r[colMap.dutyPrepaid]);
      const amountDuty = parseNum(r[colMap.amountDuty]);
      const paid = parseNum(r[colMap.paid]);
      const balance = parseNum(r[colMap.balance]);
      const bankDuty = String(r[colMap.bankDuty] || '').trim();
      const confirmation = String(r[colMap.confirmation] || '').trim();
      const packages = parseInt(r[colMap.packages], 10) || 0;

      const unitFreight = parseNum(r[colMap.unitFreight]);
      const amountFreight = parseNum(r[colMap.amountFreight]);
      const paidFreight = parseNum(r[colMap.paidFreight]);
      const balanceFreight = parseNum(r[colMap.balanceFreight]);
      const bankFreight = String(r[colMap.bankFreight] || '').trim();
      const notaDuty = String(r[colMap.notaDuty] || '').trim();
      const notaFreight = String(r[colMap.notaFreight] || '').trim();

      // Somar totais
      totals.cbm += cbm;
      totals.amountDuty += amountDuty;
      totals.dutyPrepaid += dutyPrepaid;
      totals.paid += paid;
      totals.balance += balance;
      totals.packages += packages;
      totals.amountFreight += amountFreight;
      totals.paidFreight += paidFreight;
      totals.balanceFreight += balanceFreight;

      orders.push({
        row: rIdx + 1,
        orderNumber,
        description,
        packages,
        cbm: parseFloat(cbm.toFixed(3)),
        unitDuty,
        dutyPrepaid,
        amountDuty,
        paid,
        balance,
        bankDuty,
        confirmation,
        unitFreight,
        amountFreight,
        paidFreight,
        balanceFreight,
        bankFreight,
        notaDuty,
        notaFreight
      });
    }

    // Arredondar totais para 2 casas decimais
    totals.cbm = parseFloat(totals.cbm.toFixed(3));
    totals.amountDuty = parseFloat(totals.amountDuty.toFixed(2));
    totals.dutyPrepaid = parseFloat(totals.dutyPrepaid.toFixed(2));
    totals.paid = parseFloat(totals.paid.toFixed(2));
    totals.balance = parseFloat(totals.balance.toFixed(2));
    totals.amountFreight = parseFloat(totals.amountFreight.toFixed(2));
    totals.paidFreight = parseFloat(totals.paidFreight.toFixed(2));
    totals.balanceFreight = parseFloat(totals.balanceFreight.toFixed(2));

    // 5. Obter ficheiros do cliente no Google Drive
    let clientFolderId = null;
    let files = [];

    if (projectFolderId) {
      try {
        const folderTargetPattern = canonicalizeName(`${clientNo} ${clientName}`);
        const listFolders = await drive.files.list({
          q: `'${projectFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)'
        });

        const clientFolder = (listFolders.data.files || []).find(f => {
          const norm = canonicalizeName(f.name);
          return norm.includes(folderTargetPattern) || (clientIdCode && norm.includes(canonicalizeName(clientIdCode)));
        });

        if (clientFolder) {
          clientFolderId = clientFolder.id;
          const listFilesRes = await drive.files.list({
            q: `'${clientFolderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, createdTime)'
          });
          files = (listFilesRes.data.files || []).map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size ? parseInt(f.size, 10) : null,
            webViewLink: f.webViewLink,
            webContentLink: f.webContentLink,
            createdTime: f.createdTime
          }));
        }
      } catch (driveErr) {
        console.warn('[CONFIRM API] Erro ao listar ficheiros do Drive:', driveErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      container: project.name,
      projectId: project.id,
      client: {
        no: clientNo,
        name: clientName,
        idCode: clientIdCode,
        phone: clientPhone,
        status: clientStatus,
        clientFolderId,
        totals
      },
      ordersCount: orders.length,
      orders,
      filesCount: files.length,
      files
    });

  } catch (error) {
    console.error('[CONFIRM API] Erro ao buscar dados do cliente:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao buscar cliente.' });
  }
});

module.exports = router;
