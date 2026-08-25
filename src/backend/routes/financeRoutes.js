const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const PocketBase = require('pocketbase/cjs');

const dataDir = path.join(__dirname, '..', '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const financeStateFile = path.join(dataDir, 'finance_state.json');

function loadFinanceState() {
  try {
    if (fs.existsSync(financeStateFile)) {
      const data = fs.readFileSync(financeStateFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[FINANCE-BACKEND] Erro ao ler finance_state.json:', err);
  }
  return { groups: [], groupMapping: {}, hiddenProjects: [] };
}

function saveFinanceState(state) {
  try {
    fs.writeFileSync(financeStateFile, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[FINANCE-BACKEND] Erro ao gravar finance_state.json:', err);
  }
}

function calculateConfirmProjectTotals(rowsInput) {
  let rows = [];
  if (typeof rowsInput === 'string') {
    try { rowsInput = JSON.parse(rowsInput); } catch (e) {}
  }
  if (Array.isArray(rowsInput)) {
    rows = rowsInput;
  } else if (rowsInput && Array.isArray(rowsInput.values)) {
    rows = rowsInput.values;
  }
  if (!rows || rows.length === 0) {
    return { dutyPrepaid: 0, amountDuty: 0, paid: 0, balance: 0 };
  }

  const columns = rows[0].map(c => String(c || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
  const findCol = (targets) => {
    for (const target of targets) {
      const idx = columns.findIndex(c => c === target || c.includes(target));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dutyIdx = findCol(['AMOUNT DUTY', 'DUTY', 'TOTAL DUTY', 'VALOR DUTY']);
  const dutyPrepaidIdx = findCol(['DUTY PREPAID', 'PREPAID']);
  const balanceIdx = findCol(['BALANCE', 'BALANCO', 'SALDO']);
  const paidIdx = columns.findIndex((c, i) => {
    return (c.includes('PAID') || c.includes('PAGO')) && !c.includes('PREPAID') && !c.includes('DUTY') && i !== dutyIdx;
  });

  const parseVal = (val) => {
    if (!val) return 0;
    return parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
  };

  let totalDuty = 0;
  let totalPrepaid = 0;
  let totalPaid = 0;
  let totalBalance = 0;
  let foundValidRows = false;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const rowString = row.slice(0, 10).map(c => String(c || '').toUpperCase()).join(' ');
    if (rowString.includes('TOTAL')) continue;
    
    const dutyVal = dutyIdx !== -1 ? parseVal(row[dutyIdx]) : 0;
    const prepaidVal = dutyPrepaidIdx !== -1 ? parseVal(row[dutyPrepaidIdx]) : 0;
    const paidVal = paidIdx !== -1 ? parseVal(row[paidIdx]) : 0;
    const balanceVal = balanceIdx !== -1 ? parseVal(row[balanceIdx]) : 0;

    if (dutyVal || prepaidVal || paidVal || balanceVal) {
      foundValidRows = true;
    }
    totalDuty += dutyVal;
    totalPrepaid += prepaidVal;
    totalPaid += paidVal;
    totalBalance += balanceVal;
  }

  if (!foundValidRows) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const rowString = row.map(c => String(c || '').toUpperCase()).join(' ');
      if (rowString.includes('TOTAL')) {
        totalDuty = dutyIdx !== -1 ? parseVal(row[dutyIdx]) : 0;
        totalPrepaid = dutyPrepaidIdx !== -1 ? parseVal(row[dutyPrepaidIdx]) : 0;
        totalPaid = paidIdx !== -1 ? parseVal(row[paidIdx]) : 0;
        totalBalance = balanceIdx !== -1 ? parseVal(row[balanceIdx]) : 0;
        break;
      }
    }
  }

  return {
    dutyPrepaid: totalPrepaid,
    amountDuty: totalDuty,
    paid: totalPaid,
    balance: totalBalance
  };
}

let cachedConsolidated = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 20000; // 20 segundos de cache para máxima velocidade

// GET /api/finance/consolidated
router.get('/consolidated', async (req, res) => {
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const now = Date.now();

  if (!forceRefresh && cachedConsolidated && (now - lastCacheTime < CACHE_TTL_MS)) {
    return res.json(cachedConsolidated);
  }

  const pbUrl = process.env.POCKETBASE_URL || 'https://pocketbase.mycloudspaces.com';
  const pb = new PocketBase(pbUrl);
  pb.autoCancellation(false);

  const state = loadFinanceState();
  const hiddenSet = new Set(state.hiddenProjects || []);
  const groupMapping = state.groupMapping || {};

  try {
    // 1. Grupos do PocketBase ou do Estado Local
    let groups = state.groups || [];
    try {
      const pbGroups = await pb.collection('groups').getFullList({ sort: 'order' });
      if (pbGroups && pbGroups.length > 0) {
        groups = pbGroups;
        state.groups = pbGroups;
        saveFinanceState(state);
      }
    } catch (gErr) {}

    // 2. Projetos do Confirm
    const confirmProjects = await pb.collection('confirm_projects').getFullList({
      batch: 15,
      sort: '-created'
    });

    const sheets = confirmProjects
      .filter(p => !hiddenSet.has(p.id))
      .map(p => {
        const totals = calculateConfirmProjectTotals(p.sheet_data);
        const groupId = p.groupId || p.group_id || groupMapping[p.id] || (p.sheetId && groupMapping[p.sheetId]) || null;
        return {
          id: p.id,
          title: p.name || "Projeto Sem Nome",
          sourceUrl: p.sheetId ? `https://docs.google.com/spreadsheets/d/${p.sheetId}/edit` : "#",
          sheetId: p.sheetId,
          folderId: p.folderId,
          groupId: groupId,
          dutyPrepaid: totals.dutyPrepaid,
          amountDuty: totals.amountDuty,
          paid: totals.paid,
          balance: totals.balance,
          lastUpdated: p.updated || p.created || new Date().toISOString(),
          isConfirmProject: true
        };
      });

    cachedConsolidated = {
      groups,
      sheets,
      timestamp: new Date().toISOString()
    };
    lastCacheTime = Date.now();

    res.json(cachedConsolidated);
  } catch (err) {
    console.error("[FINANCE-BACKEND] Erro ao consolidar dados:", err.message);
    if (cachedConsolidated) {
      return res.json(cachedConsolidated);
    }
    res.status(500).json({ error: "Falha ao consolidar dados financeiros: " + err.message });
  }
});

// GET /api/finance/state
router.get('/state', (req, res) => {
  const state = loadFinanceState();
  res.json(state);
});

// POST /api/finance/group-mapping
router.post('/group-mapping', (req, res) => {
  const { projectId, sheetId, groupId, mappings } = req.body;
  const state = loadFinanceState();
  if (!state.groupMapping) state.groupMapping = {};

  if (Array.isArray(mappings)) {
    mappings.forEach(m => {
      const gId = m.groupId || null;
      if (!gId) {
        if (m.projectId) delete state.groupMapping[m.projectId];
        if (m.sheetId) delete state.groupMapping[m.sheetId];
      } else {
        if (m.projectId) state.groupMapping[m.projectId] = gId;
        if (m.sheetId) state.groupMapping[m.sheetId] = gId;
      }
    });
  } else {
    if (!projectId && !sheetId) {
      return res.status(400).json({ error: 'projectId, sheetId ou mappings obrigatório' });
    }
    if (!groupId) {
      if (projectId) delete state.groupMapping[projectId];
      if (sheetId) delete state.groupMapping[sheetId];
    } else {
      if (projectId) state.groupMapping[projectId] = groupId;
      if (sheetId) state.groupMapping[sheetId] = groupId;
    }
  }
  saveFinanceState(state);
  lastCacheTime = 0; // Invalidar cache para atualizar imediatamente
  res.json({ success: true, groupMapping: state.groupMapping });
});

// POST /api/finance/groups
router.post('/groups', (req, res) => {
  const { groups } = req.body;
  if (!Array.isArray(groups)) {
    return res.status(400).json({ error: 'groups deve ser um array' });
  }
  const state = loadFinanceState();
  state.groups = groups;
  saveFinanceState(state);
  lastCacheTime = 0; // Invalidar cache
  res.json({ success: true, groups: state.groups });
});

// POST /api/finance/hidden-projects
router.post('/hidden-projects', (req, res) => {
  const { hiddenProjects } = req.body;
  if (!Array.isArray(hiddenProjects)) {
    return res.status(400).json({ error: 'hiddenProjects deve ser um array' });
  }
  const state = loadFinanceState();
  state.hiddenProjects = hiddenProjects;
  saveFinanceState(state);
  lastCacheTime = 0; // Invalidar cache
  res.json({ success: true, hiddenProjects: state.hiddenProjects });
});

module.exports = router;
