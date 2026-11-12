const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const fetch = require('node-fetch');

const router = express.Router();

const ETA_PB_BASE = (process.env.ETA_POCKETBASE_URL || 'https://cloud.mycloudspaces.com/jupiter/pocketbase').replace(/\/+$/, '');
const ETA_COLLECTION = 'etaGeral';
const REQUEST_TIMEOUT_MS = 25000;

// Force IPv4 where DNS resolves AAAA on hosts with slow/broken IPv6 paths (avoids Node undici 10s timeouts)
const ipv4HttpsAgent = new https.Agent({ keepAlive: true, family: 4 });
const ipv4HttpAgent = new http.Agent({ keepAlive: true, family: 4 });

function getAgentForUrl(targetUrl) {
  return targetUrl.startsWith('https:') ? ipv4HttpsAgent : ipv4HttpAgent;
}

async function pbRequest(pathSuffix, options = {}) {
  const url = `${ETA_PB_BASE}${pathSuffix}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      agent: getAgentForUrl(url),
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeStatusField(rawStatus) {
  if (!rawStatus) {
    return { actualStatus: 'Aguarda Chegada', changesStatus: [], dataStatus: '', own: 'No own' };
  }
  if (typeof rawStatus === 'string') {
    try {
      const parsed = JSON.parse(rawStatus);
      return normalizeStatusField(parsed);
    } catch (_) {
      return { actualStatus: rawStatus, changesStatus: [], dataStatus: '', own: 'No own' };
    }
  }
  return {
    actualStatus: rawStatus.actualStatus || 'Aguarda Chegada',
    changesStatus: Array.isArray(rawStatus.changesStatus) ? rawStatus.changesStatus : [],
    dataStatus: rawStatus.dataStatus || '',
    own: rawStatus.own || 'No own'
  };
}

function normalizeRecord(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    status: normalizeStatusField(item.status)
  };
}

function buildPbErrorMessage(payload, fallbackStatus) {
  if (payload && typeof payload === 'object') {
    if (payload.message) return payload.message;
    if (payload.error) return payload.error;
  }
  return `Erro no servidor ETA (HTTP ${fallbackStatus})`;
}

// GET /api/eta/records - Lista registos de ETA com paginação completa para a UI
router.get('/records', async (req, res) => {
  const startedAt = Date.now();
  const includeFinished = String(req.query.includeFinished || 'false').toLowerCase() === 'true';
  const sort = String(req.query.sort || 'etachegada').trim() || 'etachegada';
  const perPage = Math.min(Math.max(parseInt(req.query.perPage, 10) || 200, 1), 500);
  const maxPages = 5;

  try {
    const filterParam = includeFinished ? '' : "&filter=(status.actualStatus!='Finalizado')";
    let allItems = [];
    let page = 1;
    let totalItems = 0;
    let totalPages = 1;

    do {
      const query = `/api/collections/${ETA_COLLECTION}/records?page=${page}&perPage=${perPage}&sort=${encodeURIComponent(sort)}${filterParam}`;
      const pbRes = await pbRequest(query);
      const data = await pbRes.json().catch(() => ({}));

      if (!pbRes.ok) {
        return res.status(pbRes.status >= 400 ? pbRes.status : 502).json({
          error: buildPbErrorMessage(data, pbRes.status),
          details: data
        });
      }

      const pageItems = Array.isArray(data.items) ? data.items.map(normalizeRecord) : [];
      allItems = allItems.concat(pageItems);
      totalItems = typeof data.totalItems === 'number' ? data.totalItems : allItems.length;
      totalPages = typeof data.totalPages === 'number' ? data.totalPages : 1;
      page += 1;
    } while (page <= totalPages && page <= maxPages);

    res.json({
      items: allItems,
      totalItems,
      totalPages,
      includeFinished,
      latencyMs: Date.now() - startedAt
    });
  } catch (err) {
    console.error('[ETA GET RECORDS ERROR]', err.message);
    const isTimeout = err.name === 'AbortError' || /timeout/i.test(err.message);
    res.status(isTimeout ? 504 : 502).json({
      error: isTimeout
        ? 'Tempo limite excedido ao conectar ao servidor ETA.'
        : 'Falha ao conectar ao servidor ETA.',
      details: err.message
    });
  }
});

// POST /api/eta/records - Cria nova previsão de chegada
router.post('/records', async (req, res) => {
  const { referencia, conhecimento, agente, etachegada, status } = req.body || {};
  const normalizedStatus = normalizeStatusField(status);
  const requiresDate = normalizedStatus.actualStatus.toLowerCase() !== 'sem previsão';
  if (!referencia || !conhecimento || !agente || (requiresDate && !etachegada)) {
    return res.status(400).json({
      error: 'Campos obrigatórios em falta: referencia, conhecimento, agente e previsão de chegada.'
    });
  }

  const payload = {
    referencia: String(referencia).trim(),
    conhecimento: String(conhecimento).trim(),
    agente: String(agente).trim(),
    etachegada: String(etachegada || '').trim(),
    status: normalizedStatus
  };

  try {
    const pbRes = await pbRequest(`/api/collections/${ETA_COLLECTION}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await pbRes.json().catch(() => ({}));

    if (!pbRes.ok) {
      return res.status(pbRes.status >= 400 ? pbRes.status : 502).json({
        error: buildPbErrorMessage(data, pbRes.status),
        details: data
      });
    }

    res.status(201).json(normalizeRecord(data));
  } catch (err) {
    console.error('[ETA POST RECORD ERROR]', err.message);
    res.status(502).json({
      error: 'Erro ao guardar nova previsão no servidor ETA.',
      details: err.message
    });
  }
});

// PATCH /api/eta/records/:id - Atualiza registo / status mantendo histórico
router.patch('/records/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{8,40}$/.test(id || '')) {
    return res.status(400).json({ error: 'ID de registo ETA inválido.' });
  }

  const body = req.body || {};
  const payload = {};
  if (body.referencia !== undefined) payload.referencia = String(body.referencia).trim();
  if (body.conhecimento !== undefined) payload.conhecimento = String(body.conhecimento).trim();
  if (body.agente !== undefined) payload.agente = String(body.agente).trim();
  if (body.etachegada !== undefined) payload.etachegada = String(body.etachegada).trim();
  if (body.status !== undefined) payload.status = normalizeStatusField(body.status);

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Nenhum campo fornecido para atualização.' });
  }

  try {
    const pbRes = await pbRequest(`/api/collections/${ETA_COLLECTION}/records/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await pbRes.json().catch(() => ({}));

    if (!pbRes.ok) {
      return res.status(pbRes.status >= 400 ? pbRes.status : 502).json({
        error: buildPbErrorMessage(data, pbRes.status),
        details: data
      });
    }

    res.json(normalizeRecord(data));
  } catch (err) {
    console.error('[ETA PATCH RECORD ERROR]', err.message);
    res.status(502).json({
      error: 'Erro ao atualizar registo no servidor ETA.',
      details: err.message
    });
  }
});

// DELETE /api/eta/records/:id - Remove registo ETA
router.delete('/records/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{8,40}$/.test(id || '')) {
    return res.status(400).json({ error: 'ID de registo ETA inválido.' });
  }

  try {
    const pbRes = await pbRequest(`/api/collections/${ETA_COLLECTION}/records/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });

    if (!pbRes.ok) {
      const data = await pbRes.json().catch(() => ({}));
      return res.status(pbRes.status >= 400 ? pbRes.status : 502).json({
        error: buildPbErrorMessage(data, pbRes.status),
        details: data
      });
    }

    res.json({ deleted: true, id });
  } catch (err) {
    console.error('[ETA DELETE RECORD ERROR]', err.message);
    res.status(502).json({
      error: 'Erro ao apagar registo no servidor ETA.',
      details: err.message
    });
  }
});

// GET /api/eta/health - Diagnóstico de conectividade e latência
router.get('/health', async (req, res) => {
  const startedAt = Date.now();
  try {
    const [healthRes, sampleRes] = await Promise.all([
      pbRequest('/api/health', { timeoutMs: 12000 }),
      pbRequest(`/api/collections/${ETA_COLLECTION}/records?perPage=1`, { timeoutMs: 15000 })
    ]);

    const latencyMs = Date.now() - startedAt;
    const sampleData = await sampleRes.json().catch(() => ({}));

    res.json({
      ok: healthRes.ok && sampleRes.ok,
      healthStatus: healthRes.status,
      collectionStatus: sampleRes.status,
      totalRecords: typeof sampleData.totalItems === 'number' ? sampleData.totalItems : null,
      latencyMs,
      endpoint: ETA_PB_BASE,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: err.message,
      latencyMs: Date.now() - startedAt,
      endpoint: ETA_PB_BASE,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/eta/files/:id/:filename - Proxy seguro para ícones de carga do PocketBase ETA
router.get('/files/:id/:filename', async (req, res) => {
  const { id, filename } = req.params;
  if (!/^[a-zA-Z0-9_-]{8,40}$/.test(id || '') || !/^[a-zA-Z0-9._-]{1,160}$/.test(filename || '')) {
    return res.status(400).send('Parâmetros inválidos.');
  }

  try {
    const fileRes = await pbRequest(`/api/files/${ETA_COLLECTION}/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`, {
      timeoutMs: 15000
    });

    if (!fileRes.ok) {
      return res.status(fileRes.status).send('Ficheiro não encontrado.');
    }

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = await fileRes.buffer();
    res.send(buffer);
  } catch (err) {
    console.error('[ETA FILE PROXY ERROR]', err.message);
    res.status(502).send('Erro ao obter imagem.');
  }
});

module.exports = router;
