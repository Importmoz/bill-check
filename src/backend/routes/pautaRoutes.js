const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

let pautaData = [];
let isLoaded = false;

// Load lazily or on startup
function loadPautaData() {
    if (isLoaded) return;
    try {
        // O ficheiro encontra-se no diretório src/frontend/data/pauta.json
        const dataPath = path.join(__dirname, '..', '..', 'frontend', 'data', 'pauta.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        pautaData = JSON.parse(rawData);
        isLoaded = true;
        console.log(`[PAUTA BACKEND] Pauta carregada na memória do servidor com ${pautaData.length} registos.`);
    } catch (error) {
        console.error('[PAUTA BACKEND] Erro ao carregar pauta.json no servidor:', error);
    }
}

// Ensure data is loaded
loadPautaData();

router.get('/search', (req, res) => {
    try {
        const q = (req.query.q || '').toLowerCase().trim();
        const limit = parseInt(req.query.limit) || 50;
        
        if (!q) {
            return res.json([]);
        }
        
        const results = pautaData.filter(p => {
            const code = p.code ? String(p.code).toLowerCase() : '';
            const desc = p.description ? String(p.description).toLowerCase() : '';
            return code.startsWith(q) || desc.includes(q);
        }).slice(0, limit);
        
        res.json(results);
    } catch (error) {
        console.error('[PAUTA BACKEND] Erro na pesquisa:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
