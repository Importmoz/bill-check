const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const PocketBase = require('pocketbase/cjs');

const dataDir = path.join(__dirname, '..', '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const billStateFile = path.join(dataDir, 'bill_state.json');

function loadBillState() {
  try {
    if (fs.existsSync(billStateFile)) {
      const data = fs.readFileSync(billStateFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[BILL-BACKEND] Erro ao ler bill_state.json:', err);
  }
  return { tables: {} };
}

function saveBillState(state) {
  try {
    fs.writeFileSync(billStateFile, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[BILL-BACKEND] Erro ao gravar bill_state.json:', err);
  }
}

function cleanString(str) {
  return String(str || '')
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function parseVal(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
}

function normalizeRows(rowsInput) {
  let rows = rowsInput;
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows); } catch (e) {}
  }
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows); } catch (e) {}
  }
  if (rows && Array.isArray(rows.values)) {
    rows = rows.values;
  }
  if (!Array.isArray(rows)) return [];
  return rows;
}

/**
 * Calcula os totais de Duty, Freight e Pagamentos de uma folha Confirm
 * Regras:
 * - Duty Paid in China: Vem estritamente da coluna DUTY PREPAID
 * - Freight Paid in MOZ: Soma das linhas onde:
 *   1. PAID FREIGHT >= AMOUNT FREIGHT (e PAID FREIGHT > 0)
 *   2. BANK IN FREIGHT não está vazio
 *   3. NOTA FREIGHT é igual a "PAID TO JUPITER"
 */
function calculateSheetBillTotals(rowsInput) {
  const rows = normalizeRows(rowsInput);
  if (!rows || rows.length === 0) {
    return { duty: 0, freight: 0, diff: 0, paid: 0, balance: 0 };
  }

  const columns = rows[0].map(c => cleanString(c));
  const findCol = (targets) => {
    const cleanedTargets = targets.map(cleanString);
    for (const t of cleanedTargets) {
      const idx = columns.findIndex(c => c === t);
      if (idx !== -1) return idx;
    }
    for (const t of cleanedTargets) {
      const idx = columns.findIndex(c => c.includes(t));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dutyPrepaidIdx = findCol(['DUTYPREPAID', 'PREPAID']);
  const amtDutyIdx = findCol(['AMOUNTDUTY', 'TOTALDUTY', 'VALORDUTY', 'DUTY']);
  const amtFreightIdx = findCol(['AMOUNTFREIGHT', 'TOTALFREIGHT', 'VALORFRETE', 'FREIGHT']);
  const paidDutyIdx = columns.findIndex((c, i) => {
    return (c.includes('PAID') || c.includes('PAGO')) && !c.includes('PREPAID') && !c.includes('FREIGHT') && i !== amtDutyIdx;
  });
  const paidFreightIdx = findCol(['PAIDFREIGHT', 'PAGOFRETE', 'FREIGHTPAID']);
  const bankFreightIdx = columns.findIndex(c => c.includes('BANK') && c.includes('FREIGHT'));
  const notaFreightIdx = columns.findIndex(c => (c.includes('NOTA') || c.includes('NOTE')) && c.includes('FREIGHT'));

  let totalDuty = 0;
  let totalFreight = 0;
  let totalPaid = 0;
  let foundValidRows = false;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const rowStr = row.slice(0, 10).map(c => String(c || '').toUpperCase()).join(' ');
    if (rowStr.includes('TOTAL')) continue;

    // 1. Custo Duty: estritamente da coluna DUTY PREPAID
    const dutyVal = dutyPrepaidIdx !== -1 ? parseVal(row[dutyPrepaidIdx]) : 0;

    // 2. Freight Paid in MOZ: condicional
    const paidFreightVal = paidFreightIdx !== -1 ? parseVal(row[paidFreightIdx]) : 0;
    const amtFreightVal = amtFreightIdx !== -1 ? parseVal(row[amtFreightIdx]) : 0;
    const bankFreightVal = bankFreightIdx !== -1 ? String(row[bankFreightIdx] || '').trim() : '';
    const notaFreightVal = notaFreightIdx !== -1 ? String(row[notaFreightIdx] || '').trim().toUpperCase() : '';

    const condPaidFreight = paidFreightVal >= amtFreightVal && paidFreightVal > 0;
    const condBank = bankFreightVal !== '' && bankFreightVal !== '0' && bankFreightVal !== '-';
    const condNota = notaFreightVal === 'PAID TO JUPITER';

    const freightVal = (condPaidFreight && condBank && condNota) ? paidFreightVal : 0;

    const paidDutyVal = paidDutyIdx !== -1 ? parseVal(row[paidDutyIdx]) : 0;

    if (dutyVal || freightVal || paidDutyVal || paidFreightVal) {
      foundValidRows = true;
    }

    totalDuty += dutyVal;
    totalFreight += freightVal;
    totalPaid += (paidDutyVal + paidFreightVal);
  }

  const diff = totalDuty - totalFreight;
  return {
    duty: totalDuty,
    freight: totalFreight,
    diff: diff,
    paid: totalPaid,
    balance: diff - totalPaid
  };
}

/**
 * Converte linhas individuais de uma folha específica em itens/contentores para a tabela BILL
 */
function parseSheetIndividualItems(rowsInput) {
  const rows = normalizeRows(rowsInput);
  if (!rows || rows.length < 2) return [];

  const columns = rows[0].map(c => cleanString(c));
  const findCol = (targets) => {
    const cleanedTargets = targets.map(cleanString);
    for (const t of cleanedTargets) {
      const idx = columns.findIndex(c => c === t);
      if (idx !== -1) return idx;
    }
    for (const t of cleanedTargets) {
      const idx = columns.findIndex(c => c.includes(t));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idCol = findCol(['CONTAINER', 'IDCODE', 'ID', 'ORDERNUMBER', 'NAME', 'NO']);
  const nameCol = findCol(['NAME', 'CLIENTE', 'CLIENT']);
  const dutyPrepaidIdx = findCol(['DUTYPREPAID', 'PREPAID']);
  const amtDutyIdx = findCol(['AMOUNTDUTY', 'TOTALDUTY', 'VALORDUTY', 'DUTY']);
  const amtFreightIdx = findCol(['AMOUNTFREIGHT', 'TOTALFREIGHT', 'VALORFRETE', 'FREIGHT']);
  const paidDutyIdx = columns.findIndex((c, i) => {
    return (c.includes('PAID') || c.includes('PAGO')) && !c.includes('PREPAID') && !c.includes('FREIGHT') && i !== amtDutyIdx;
  });
  const paidFreightIdx = findCol(['PAIDFREIGHT', 'PAGOFRETE', 'FREIGHTPAID']);
  const bankFreightIdx = columns.findIndex(c => c.includes('BANK') && c.includes('FREIGHT'));
  const notaFreightIdx = columns.findIndex(c => (c.includes('NOTA') || c.includes('NOTE')) && c.includes('FREIGHT'));

  const items = [];
  let lastIdStr = '';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const rowStr = row.slice(0, 10).map(c => String(c || '').toUpperCase()).join(' ');
    if (rowStr.includes('TOTAL')) continue;

    let idVal = idCol !== -1 ? String(row[idCol] || '').trim() : '';
    const nameVal = nameCol !== -1 ? String(row[nameCol] || '').trim() : '';

    if (idVal) lastIdStr = idVal;
    else if (lastIdStr) idVal = lastIdStr;

    // O custo para a coluna 'Duty Paid in China' vem estritamente da coluna DUTY PREPAID
    const duty = dutyPrepaidIdx !== -1 ? parseVal(row[dutyPrepaidIdx]) : 0;

    // Freight Paid in MOZ: condicional
    const paidFreightVal = paidFreightIdx !== -1 ? parseVal(row[paidFreightIdx]) : 0;
    const amtFreightVal = amtFreightIdx !== -1 ? parseVal(row[amtFreightIdx]) : 0;
    const bankFreightVal = bankFreightIdx !== -1 ? String(row[bankFreightIdx] || '').trim() : '';
    const notaFreightVal = notaFreightIdx !== -1 ? String(row[notaFreightIdx] || '').trim().toUpperCase() : '';

    const condPaidFreight = paidFreightVal >= amtFreightVal && paidFreightVal > 0;
    const condBank = bankFreightVal !== '' && bankFreightVal !== '0' && bankFreightVal !== '-';
    const condNota = notaFreightVal === 'PAID TO JUPITER';

    const freight = (condPaidFreight && condBank && condNota) ? paidFreightVal : 0;

    const paidDuty = paidDutyIdx !== -1 ? parseVal(row[paidDutyIdx]) : 0;

    if (!duty && !freight && !paidDuty && !paidFreightVal && !idVal) continue;

    const diff = duty - freight;
    items.push({
      container_id_str: idVal || nameVal || `Linha #${i}`,
      duty,
      freight,
      diff,
      paid: paidDuty + paidFreightVal,
      clientName: nameVal
    });
  }

  return items;
}

// GET /api/bill/config/:tableId
router.get('/config/:tableId', (req, res) => {
  const { tableId } = req.params;
  const state = loadBillState();
  const config = state.tables[tableId] || { mode: 'OLD', source: null };
  res.json(config);
});

// POST /api/bill/config/:tableId
router.post('/config/:tableId', (req, res) => {
  const { tableId } = req.params;
  const { mode, source } = req.body;
  const state = loadBillState();
  state.tables[tableId] = {
    mode: mode === 'NEW' ? 'NEW' : 'OLD',
    source: source || null,
    updatedAt: new Date().toISOString()
  };
  saveBillState(state);
  res.json({ success: true, config: state.tables[tableId] });
});

// GET /api/bill/sources
// Retorna listas de fontes disponíveis (Grupos do Finance e Folhas do Confirm)
router.get('/sources', async (req, res) => {
  const pbUrl = process.env.POCKETBASE_URL || 'https://pocketbase.mycloudspaces.com';
  const pb = new PocketBase(pbUrl);
  pb.autoCancellation(false);

  try {
    const [confirmProjects, groups] = await Promise.all([
      pb.collection('confirm_projects').getFullList({ fields: 'id,name,sheetId,groupId,group_id,created', sort: '-created' }).catch(() => []),
      pb.collection('groups').getFullList({ fields: 'id,name,order', sort: 'order' }).catch(() => [])
    ]);

    res.json({
      success: true,
      projects: confirmProjects.map(p => ({
        id: p.id,
        name: p.name || 'Sem Nome',
        sheetId: p.sheetId,
        groupId: p.groupId || p.group_id || null
      })),
      groups: groups.map(g => ({
        id: g.id,
        name: g.name
      }))
    });
  } catch (err) {
    console.error('[BILL-BACKEND] Erro ao carregar fontes:', err);
    res.status(500).json({ error: 'Falha ao carregar fontes do PocketBase' });
  }
});

// GET /api/bill/realtime/:tableId
// Obtém dados consolidados em tempo real a partir do Google Sheets / Confirm
router.get('/realtime/:tableId', async (req, res) => {
  const { tableId } = req.params;
  const { sourceType, sourceId } = req.query;

  const pbUrl = process.env.POCKETBASE_URL || 'https://pocketbase.mycloudspaces.com';
  const pb = new PocketBase(pbUrl);
  pb.autoCancellation(false);

  const state = loadBillState();
  const savedConfig = state.tables[tableId] || {};
  const effectiveType = sourceType || savedConfig.source?.type || 'auto';
  const effectiveId = sourceId || savedConfig.source?.id || null;

  try {
    // 1. Caso a fonte seja uma folha específica (single sheet)
    if (effectiveType === 'sheet' && effectiveId) {
      let project = null;
      try {
        project = await pb.collection('confirm_projects').getOne(effectiveId);
      } catch (e) {
        project = await pb.collection('confirm_projects').getFirstListItem(`name = "${effectiveId}"`).catch(() => null);
      }

      if (!project) {
        return res.status(404).json({ error: 'Projeto Confirm não encontrado' });
      }

      const rows = project.sheet_data?.values || project.sheet_data || [];
      const items = parseSheetIndividualItems(rows);
      const totals = calculateSheetBillTotals(rows);

      return res.json({
        success: true,
        sourceType: 'sheet',
        sourceName: project.name,
        sheetId: project.sheetId,
        items,
        totals,
        lastUpdated: project.updated || project.created || new Date().toISOString()
      });
    }

    // 2. Caso a fonte seja um grupo do Finance
    if (effectiveType === 'group' && effectiveId) {
      const allProjects = await pb.collection('confirm_projects').getFullList({ sort: '-created' });
      const groupProjects = allProjects.filter(p => (p.groupId === effectiveId || p.group_id === effectiveId));

      const items = groupProjects.map(p => {
        const totals = calculateSheetBillTotals(p.sheet_data);
        return {
          container_id_str: p.name,
          duty: totals.duty,
          freight: totals.freight,
          diff: totals.diff,
          paid: totals.paid,
          balance: totals.balance,
          sheetId: p.sheetId,
          projectId: p.id
        };
      });

      let totalDuty = 0, totalFreight = 0, totalPaid = 0;
      items.forEach(it => {
        totalDuty += it.duty;
        totalFreight += it.freight;
        totalPaid += it.paid;
      });
      const totalLiability = totalDuty - totalFreight;

      return res.json({
        success: true,
        sourceType: 'group',
        sourceId: effectiveId,
        items,
        totals: {
          duty: totalDuty,
          freight: totalFreight,
          diff: totalLiability,
          paid: totalPaid,
          balance: totalLiability - totalPaid
        }
      });
    }

    // 3. Modo Auto: tenta associar com base nos contentores já existentes na tabela ou nome da tabela
    let table = null;
    try { table = await pb.collection('tables').getOne(tableId); } catch (e) {}

    const [containers, allProjects] = await Promise.all([
      pb.collection('containers').getFullList({ filter: `table_id = "${tableId}"`, sort: 'created' }).catch(() => []),
      pb.collection('confirm_projects').getFullList({ sort: '-created' }).catch(() => [])
    ]);

    const projectMap = new Map();
    allProjects.forEach(p => {
      if (p.name) {
        const rawName = String(p.name).trim().toUpperCase();
        const cleanedName = cleanString(p.name);
        const strippedName = cleanedName.replace(/^LISTA/, '');
        projectMap.set(rawName, p);
        projectMap.set(cleanedName, p);
        if (strippedName) projectMap.set(strippedName, p);
      }
    });

    // Se a tabela tem contentores (ex: 523 a 540, ou 603 a 613, etc.)
    // Assegura paridade de 100% com a lista de contentores da tabela OLD
    if (containers.length > 0) {
      let matchedAny = false;
      const items = containers.map(c => {
        const key = String(c.container_id_str || '').trim().toUpperCase();
        const cleanKey = cleanString(c.container_id_str);
        const strippedKey = cleanKey.replace(/^LISTA/, '');
        const match = projectMap.get(key) || projectMap.get(cleanKey) || projectMap.get(strippedKey);

        if (match) {
          matchedAny = true;
          const totals = calculateSheetBillTotals(match.sheet_data);
          return {
            id: c.id,
            container_id_str: c.container_id_str,
            duty: totals.duty,
            freight: totals.freight,
            diff: totals.diff,
            sheetId: match.sheetId,
            projectId: match.id
          };
        } else {
          const duty = parseFloat(c.duty) || 0;
          const freight = parseFloat(c.freight) || 0;
          return {
            id: c.id,
            container_id_str: c.container_id_str,
            duty,
            freight,
            diff: duty - freight
          };
        }
      });

      let totalDuty = 0, totalFreight = 0;
      items.forEach(it => {
        totalDuty += it.duty;
        totalFreight += it.freight;
      });
      const totalLiability = totalDuty - totalFreight;

      return res.json({
        success: true,
        sourceType: matchedAny ? 'auto_matched_containers' : 'containers',
        items,
        totals: {
          duty: totalDuty,
          freight: totalFreight,
          diff: totalLiability
        }
      });
    }

    // Caso o nome da própria tabela corresponda a um projeto Confirm
    if (table && table.name) {
      const cleanTableName = String(table.name).trim().toUpperCase();
      const directMatch = projectMap.get(cleanTableName) || 
        allProjects.find(p => cleanTableName.includes(String(p.name || '').trim().toUpperCase()));

      if (directMatch) {
        const rows = directMatch.sheet_data?.values || directMatch.sheet_data || [];
        const items = parseSheetIndividualItems(rows);
        const totals = calculateSheetBillTotals(rows);

        return res.json({
          success: true,
          sourceType: 'sheet_direct_match',
          sourceName: directMatch.name,
          sheetId: directMatch.sheetId,
          items,
          totals
        });
      }
    }

    // Se nada corresponder automaticamente, retorna lista vazia para o utilizador selecionar a fonte no topo
    return res.json({
      success: true,
      sourceType: 'none',
      items: [],
      totals: { duty: 0, freight: 0, diff: 0, paid: 0, balance: 0 },
      message: 'Selecione uma folha ou lote para vincular a esta tabela'
    });

  } catch (err) {
    console.error('[BILL-BACKEND] Erro ao obter dados em tempo real:', err);
    res.status(500).json({ error: 'Erro ao consolidar dados da folha em tempo real' });
  }
});

module.exports = router;
