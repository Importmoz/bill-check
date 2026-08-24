const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

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
  res.json({ success: true, hiddenProjects: state.hiddenProjects });
});

module.exports = router;
