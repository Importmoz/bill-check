const express = require('express');
const router = express.Router();
const fetch = globalThis.fetch || require('node-fetch');

// IP / URL padrão do servidor de impressão
const DEFAULT_PRINT_SERVER = process.env.PRINT_SERVER_URL || 'http://192.168.88.10:5000';

function getTargetServer(req) {
  const queryServer = req.query.serverUrl || req.body?.serverUrl;
  let target = (queryServer && String(queryServer).trim()) || DEFAULT_PRINT_SERVER;
  target = target.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(target)) {
    target = 'http://' + target;
  }
  return target;
}

function getAuthHeaders(req) {
  const token = req.query.token || req.body?.token || process.env.IMPRESSAO_API_TOKEN;
  const headers = {};
  if (token && String(token).trim()) {
    headers['Authorization'] = `Bearer ${String(token).trim()}`;
    headers['X-API-Token'] = String(token).trim();
  }
  return headers;
}

/**
 * GET /api/print/status
 * Verifica conectividade com o servidor de impressão e devolve status e impressora padrão
 */
router.get('/status', async (req, res) => {
  const serverUrl = getTargetServer(req);
  const authHeaders = getAuthHeaders(req);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${serverUrl}/api/status`, {
      method: 'GET',
      headers: authHeaders,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(response.status).json({
        ok: false,
        error: `Servidor de impressão respondeu com erro HTTP ${response.status}`,
        details: errText,
        serverUrl
      });
    }

    const data = await response.json();
    return res.json({
      ok: true,
      serverUrl,
      ...data
    });
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return res.status(503).json({
      ok: false,
      error: isTimeout ? 'Tempo limite esgotado ao contactar o servidor de impressão' : 'Não foi possível conectar ao servidor de impressão',
      message: err.message,
      serverUrl
    });
  }
});

/**
 * GET /api/print/impressoras
 * Lista as impressoras disponíveis no servidor de impressão
 */
router.get('/impressoras', async (req, res) => {
  const serverUrl = getTargetServer(req);
  const authHeaders = getAuthHeaders(req);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${serverUrl}/api/impressoras`, {
      method: 'GET',
      headers: authHeaders,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(response.status).json({
        ok: false,
        error: `Erro ao obter impressoras (HTTP ${response.status})`,
        details: errText
      });
    }

    const data = await response.json();
    return res.json({
      ok: true,
      serverUrl,
      impressoras: data.impressoras || [],
      padrao: data.padrao || null
    });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      error: 'Não foi possível listar as impressoras do servidor',
      message: err.message,
      serverUrl
    });
  }
});

/**
 * POST /api/print/imprimir
 * Envia um documento (PDF, imagem, etc.) para impressão direta via servidor de impressão
 * Espera JSON: { serverUrl, impressora, nome, arquivo (base64), token }
 */
router.post('/imprimir', async (req, res) => {
  const serverUrl = getTargetServer(req);
  const authHeaders = getAuthHeaders(req);
  const { impressora, nome, arquivo, arquivo_base64, base64 } = req.body || {};

  const fileData = arquivo || arquivo_base64 || base64;
  if (!fileData) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Nenhum conteúdo recebido para impressão (campo "arquivo" base64 obrigatório).'
    });
  }

  const payload = {
    nome: nome || 'documento.pdf',
    arquivo: fileData
  };
  if (impressora && String(impressora).trim()) {
    payload.impressora = String(impressora).trim();
  }

  try {
    const controller = new AbortController();
    // 30 segundos de timeout para impressões grandes / rasterização 300DPI
    const timeout = setTimeout(() => controller.abort(), 35000);

    const response = await fetch(`${serverUrl}/api/imprimir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await response.json().catch(async () => {
      const raw = await response.text();
      return { sucesso: false, erro: raw || `Resposta inválida do servidor (HTTP ${response.status})` };
    });

    return res.status(response.status).json(data);
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    console.error('[PRINT PROXY ERROR]', err);
    return res.status(500).json({
      sucesso: false,
      erro: isTimeout ? 'Tempo limite esgotado ao enviar documento para a impressora' : `Falha na comunicação com o servidor de impressão: ${err.message}`,
      serverUrl
    });
  }
});

/**
 * POST /api/print/teste
 * Imprime uma página de teste rápida com data e hora
 */
router.post('/teste', async (req, res) => {
  const serverUrl = getTargetServer(req);
  const authHeaders = getAuthHeaders(req);
  const { impressora } = req.body || {};

  const testContent = `=====================================================
         JUPITER LOGISTICS LDA - TESTE DE IMPRESSAO
=====================================================
Data / Hora : ${new Date().toLocaleString('pt-PT')}
Impressora  : ${impressora || 'Predefinida do Servidor'}
Servidor    : ${serverUrl}
Status      : COMUNICACAO OK - IMPRESSAO DIRECTA ACTIVA
=====================================================
`;

  const payload = {
    nome: 'teste_impressao.txt',
    arquivo: Buffer.from(testContent, 'utf-8').toString('base64'),
    impressora: impressora || undefined
  };

  try {
    const response = await fetch(`${serverUrl}/api/imprimir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: err.message });
  }
});

module.exports = router;
