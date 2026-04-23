/**
 * Módulo de API e Gestão de Estado para Bill Check
 */

const PB_URL = (window.POCKETBASE_CONFIG && window.POCKETBASE_CONFIG.POCKETBASE_URL) || 'http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io';

// @ts-ignore - PocketBase carregado via CDN
export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// Estado da Aplicação
export const state = {
    tables: [],
    currentTableId: null,
    containers: [],
    balanceRecords: [],
    activeBalance: 0,
    finance: {
        groups: [],
        sheets: []
    },
    team: {
        tables: [],
        currentTableId: null,
        groups: [],
        records: []
    },
    term: {
        tables: [],
        currentTableId: null,
        records: []
    },
    confirm: {
        sheetId: localStorage.getItem('confirm_sheet_id') || '',
        data: [],
        columns: [],
        driveFiles: []
    }
};

/**
 * Realiza o login do utilizador
 */
export async function login(email, pass) {
    return await pb.collection('users').authWithPassword(email, pass);
}

/**
 * Limpa a sessão
 */
export function logout() {
    pb.authStore.clear();
}

/** --- MÓDULO CONFIRM (GOOGLE API) --- **/

export async function readGSheet(spreadsheetId, range = 'A1:Z1000') {
    const res = await fetch('/api/google/sheet/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, range })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao ler GSheet");
    }
    const data = await res.json();
    state.confirm.data = data;
    if (data && data.length > 0) state.confirm.columns = data[0];
    return data;
}

export async function updateGSheet(spreadsheetId, range, values) {
    const res = await fetch('/api/google/sheet/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, range, values })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao atualizar GSheet");
    }
    return await res.json();
}

export async function listGDriveFiles(folderId) {
    const res = await fetch('/api/google/drive/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao listar GDrive");
    }
    const files = await res.json();
    state.confirm.driveFiles = files || [];
    return state.confirm.driveFiles;
}

export async function createGDriveFolder(name, parentId) {
    const res = await fetch('/api/google/drive/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId })
    });
    
    if (!res.ok) {
        const text = await res.text();
        let errorMsg = "Erro ao criar pasta";
        try {
            const error = JSON.parse(text);
            errorMsg = error.error || errorMsg;
        } catch (e) {
            console.error("Servidor retornou HTML/Texto:", text);
        }
        throw new Error(errorMsg);
    }
    
    return await res.json();
}

export async function uploadGDriveFile(file, parentId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parentId', parentId);
    
    const res = await fetch('/api/google/drive/upload', {
        method: 'POST',
        body: formData
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao fazer upload");
    }
    
    return await res.json();
}

export async function deleteGDriveFile(fileId) {
    const res = await fetch(`/api/google/drive/file/${fileId}`, {
        method: 'DELETE'
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao apagar ficheiro");
    }
    
    return await res.json();
}

// --- POCKETBASE: CONFIRM PROJECTS ---
export async function getConfirmProjects() {
    return await pb.collection('confirm_projects').getFullList({ sort: '-created' });
}

export async function saveConfirmProject(data) {
    if (data.id) {
        return await pb.collection('confirm_projects').update(data.id, data);
    } else {
        return await pb.collection('confirm_projects').create(data);
    }
}

export async function deleteConfirmProject(id) {
    return await pb.collection('confirm_projects').delete(id);
}

/**
 * Procura todas as tabelas e calcula balanços
 */
export async function fetchDashboardData() {
    const userId = pb.authStore.model.id;
    const [tables, containers, balance] = await Promise.all([
        pb.collection('tables').getFullList({ filter: `user_id = "${userId}"`, sort: '-created' }),
        pb.collection('containers').getFullList({ filter: `user_id = "${userId}"`, sort: 'created' }),
        pb.collection('balance').getFullList({ filter: `user_id = "${userId}"`, sort: 'created' })
    ]);

    // Calcular balanço para cada tabela
    tables.forEach(table => {
        const tableContainers = containers.filter(c => c.table_id === table.id);
        const tableBalances = balance.filter(b => b.table_id === table.id);
        
        let totalLiability = 0;
        tableContainers.forEach(c => {
            const duty = parseFloat(c.duty) || 0;
            const freight = parseFloat(c.freight) || 0;
            totalLiability += (duty - freight);
        });
        
        let totalPaid = 0;
        tableBalances.forEach(b => {
            const amount = parseFloat(b.amount) || 0;
            totalPaid += Math.abs(amount);
        });
        
        table.balance = totalLiability - totalPaid;
    });

    state.tables = tables;
    return tables;
}

/**
 * Carrega dados de uma tabela específica
 */
export async function fetchTableData(tableId) {
    const userId = pb.authStore.model.id;
    state.currentTableId = tableId;
    
    const [containers, balance] = await Promise.all([
        pb.collection('containers').getFullList({ filter: `table_id = "${tableId}" && user_id = "${userId}"`, sort: 'created' }),
        pb.collection('balance').getFullList({ filter: `table_id = "${tableId}" && user_id = "${userId}"`, sort: 'created' })
    ]);

    state.containers = containers;
    state.balanceRecords = balance;
    return { containers, balance };
}

// Operações de Mutação

export async function createTable(name) {
    return await pb.collection('tables').create({ name, user_id: pb.authStore.model.id });
}

export async function updateTable(id, name) {
    return await pb.collection('tables').update(id, { name });
}

export async function deleteTable(id) {
    // Primeiro eliminar dependências (o PocketBase não tem cascade delete nativo em todas as configs)
    const containers = await pb.collection('containers').getFullList({ filter: `table_id = "${id}"` });
    for (const c of containers) await pb.collection('containers').delete(c.id);
    
    const balances = await pb.collection('balance').getFullList({ filter: `table_id = "${id}"` });
    for (const b of balances) await pb.collection('balance').delete(b.id);
    
    return await pb.collection('tables').delete(id);
}

export async function saveContainerData(data, editId = null) {
    const payload = { ...data, user_id: pb.authStore.model.id };
    if (editId) {
        return await pb.collection('containers').update(editId, payload);
    } else {
        return await pb.collection('containers').create(payload);
    }
}

export async function deleteContainerData(id) {
    return await pb.collection('containers').delete(id);
}

export async function registerPayment(tableId, amount, date) {
    return await pb.collection('balance').create({ 
        table_id: tableId, 
        amount: Math.abs(amount), 
        payment_date: date,
        user_id: pb.authStore.model.id 
    });
}

// --- MÓDULO FINANCE (CONSOLIDATOR) ---

/**
 * Carrega todos os grupos e folhas financeiras
 */
export async function fetchFinanceData() {
    const userId = pb.authStore.model.id;
    const [groups, sheets] = await Promise.all([
        pb.collection('groups').getFullList({ filter: `user_id = "${userId}"`, sort: 'order' }),
        pb.collection('sheets').getFullList({ filter: `user_id = "${userId}"`, sort: '-created' })
    ]);

    state.finance.groups = groups;
    state.finance.sheets = sheets;
    return { groups, sheets };
}

export async function createFinanceGroup(name) {
    const maxOrder = state.finance.groups.length > 0 ? Math.max(...state.finance.groups.map(g => g.order || 0)) : 0;
    return await pb.collection('groups').create({ name, order: maxOrder + 100, user_id: pb.authStore.model.id });
}

export async function updateFinanceGroupOrder(groupId, direction) {
    const groups = state.finance.groups;
    const index = groups.findIndex(g => g.id === groupId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return;

    const groupA = groups[index];
    const groupB = groups[targetIndex];

    const orderA = groupA.order || 0;
    const orderB = groupB.order || 0;

    // Swap orders
    await Promise.all([
        pb.collection('groups').update(groupA.id, { order: orderB }),
        pb.collection('groups').update(groupB.id, { order: orderA })
    ]);
}

export async function deleteFinanceGroup(groupId) {
    // Ungroup sheets first
    const affected = state.finance.sheets.filter(s => s.groupId === groupId);
    for (const sheet of affected) {
        await pb.collection('sheets').update(sheet.id, { groupId: null });
    }
    return await pb.collection('groups').delete(groupId);
}

export async function saveFinanceSheet(data, id = null) {
    const payload = { ...data, user_id: pb.authStore.model.id };
    if (id) return await pb.collection('sheets').update(id, payload);
    return await pb.collection('sheets').create(payload);
}

export async function deleteFinanceSheet(id) {
    return await pb.collection('sheets').delete(id);
}

/**
 * Motor de Extração (Baseado no projeto original)
 */
export async function processFinanceUrl(url) {
    try {
        const normalize = (str) => String(str || '').trim().toLowerCase();
        let rawData;

        if (url.includes('google.com')) {
            rawData = await fetchGoogleSheet(url);
        } else {
            rawData = await fetchExcelSheet(url);
        }

        const { rows, title } = rawData;
        const data = extractDataFromRows(rows, url, normalize);
        data.title = title || "Folha Sem Nome";
        
        return data;
    } catch (err) {
        console.error("Erro na extração:", err);
        throw err;
    }
}

function cleanTitle(title) {
    if (!title) return "Documento Sem Nome";
    return title.trim()
        .replace(/ - Google (Sheets|Folhas|Drive)/gi, '')
        .replace(/ - Excel/gi, '')
        .replace(/ - OneDrive/gi, '')
        .replace(/\.xlsx$/i, '')
        .replace(/\.xls$/i, '')
        .replace(/\.csv$/i, '')
        .trim();
}

async function fetchGoogleSheet(url) {
    let fetchUrl = url;
    let title = "Google Sheet";

    // Tentar extrair título do HTML primeiro
    if (url.includes('/pubhtml') || url.includes('/pub?')) {
        try {
            const htmlUrl = url.replace(/\/pub\?.*$/, '/pubhtml').replace(/\/pub$/, '/pubhtml');
            const htmlRes = await fetch(htmlUrl);
            if (htmlRes.ok) {
                const htmlText = await htmlRes.text();
                const titleMatch = htmlText.match(/<title>(.*?)<\/title>/i);
                if (titleMatch) {
                    title = titleMatch[1];
                }
            }
        } catch (e) { console.warn("Erro ao obter título do GS", e); }
    }

    if (url.includes('docs.google.com/spreadsheets')) {
        if (url.includes('/pubhtml')) {
            fetchUrl = url.replace('/pubhtml', '/pub?output=csv');
        } else if (url.includes('/edit')) {
            fetchUrl = url.replace(/\/edit.*$/, '/export?format=csv');
        }
    }

    const response = await fetch(`${fetchUrl}${fetchUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
    if (!response.ok) throw new Error("Falha ao aceder ao Google Sheet.");

    const text = await response.text();
    // @ts-ignore - XLSX carregado via CDN
    const workbook = XLSX.read(text, { type: 'string' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return {
        rows: XLSX.utils.sheet_to_json(sheet, { header: 1 }),
        title: cleanTitle(title)
    };
}

async function fetchExcelSheet(url) {
    let fetchUrl = url;
    let title = "Ficheiro Excel";

    if (url.includes('sharepoint.com') || url.includes('1drv.ms')) {
        if (url.includes('?dru=0')) fetchUrl = url.replace('?dru=0', '?download=1');
    }

    // Tentar extrair do URL
    const urlMatches = url.match(/\/([^/?#]+\.xlsx)/i);
    if (urlMatches) {
        title = decodeURIComponent(urlMatches[1]);
    }

    const response = await fetch(`${fetchUrl}${fetchUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
    if (!response.ok) throw new Error("Falha ao aceder ao ficheiro Excel.");

    // Tentar extrair de cabeçalhos
    const disposition = response.headers.get('Content-Disposition');
    if (disposition) {
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) title = decodeURIComponent(filenameMatch[1]);
    }

    const arrayBuffer = await response.arrayBuffer();
    // @ts-ignore
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return {
        rows: XLSX.utils.sheet_to_json(sheet, { header: 1 }),
        title: cleanTitle(title)
    };
}

function extractDataFromRows(rows, sourceUrl, normalize) {
    let headerRowIndex = -1;
    const targetHeaders = ['duty', 'paid', 'status', 'balance', 'amount'];

    // Detectar cabeçalho
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
        const rowStr = rows[i].map(normalize).join(' ');
        const score = targetHeaders.reduce((acc, key) => rowStr.includes(key) ? acc + 1 : acc, 0);
        if (score >= 2) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) throw new Error("Não foi possível detectar a linha de cabeçalho.");

    const headers = rows[headerRowIndex].map(normalize);
    const colMap = {
        dutyPrepaid: headers.findIndex(h => h.includes('duty') && h.includes('prepaid')),
        amountDuty: headers.findIndex(h => (h.includes('amount') && h.includes('duty')) || h === 'duty' || h === 'total duty'),
        paid: headers.findIndex(h => h === 'paid' || h === 'amount paid' || h === 'total paid'),
        balance: headers.findIndex(h => h.includes('balance'))
    };

    // Procurar linha de Totais
    let totalRow = null;
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        if (rows[i].map(normalize).join(' ').includes('total')) {
            totalRow = rows[i];
            break;
        }
    }

    if (!totalRow) {
        // Fallback para última linha com números
        for (let i = rows.length - 1; i > headerRowIndex; i--) {
            if (rows[i].some(cell => !isNaN(parseFloat(cell)))) {
                totalRow = rows[i];
                break;
            }
        }
    }

    if (!totalRow) throw new Error("Não foi possível encontrar a linha de totais.");

    const parseVal = (val) => {
        if (!val) return 0;
        return parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
    };

    return {
        sourceUrl,
        dutyPrepaid: colMap.dutyPrepaid !== -1 ? parseVal(totalRow[colMap.dutyPrepaid]) : 0,
        amountDuty: colMap.amountDuty !== -1 ? parseVal(totalRow[colMap.amountDuty]) : 0,
        paid: colMap.paid !== -1 ? parseVal(totalRow[colMap.paid]) : 0,
        balance: colMap.balance !== -1 ? parseVal(totalRow[colMap.balance]) : 0,
        lastUpdated: new Date().toISOString()
    };
}
// --- MÓDULO TEAM (RELATÓRIOS DE EQUIPES) ---

/**
 * Procura todos os relatórios de equipe
 */
export async function fetchTeamDashboardData() {
    const userId = pb.authStore.model.id;
    const tables = await pb.collection('team_tables').getFullList({ 
        filter: `user_id = "${userId}"`, 
        sort: '-created' 
    });
    state.team.tables = tables;
    return tables;
}

/**
 * Carrega dados de um relatório de equipe específico
 */
export async function fetchTeamTableData(tableId) {
    const userId = pb.authStore.model.id;
    state.team.currentTableId = tableId;
    
        console.log("Fetching data for table:", tableId, "User:", userId);
        const [groups, records] = await Promise.all([
            pb.collection('team_groups').getFullList({ 
                filter: `table_id = "${tableId}" && user_id = "${userId}"`, 
                sort: 'created' 
            }),
            pb.collection('team_records').getFullList({ 
                filter: `table_id = "${tableId}" && user_id = "${userId}"`, 
                sort: 'created' 
            })
        ]);
        console.log("Groups found:", groups.length, "Records found:", records.length);

    state.team.groups = groups;
    state.team.records = records;
    return { groups, records };
}

export async function createTeamTable(name) {
    const record = await pb.collection('team_tables').create({ 
        name, 
        user_id: pb.authStore.model.id 
    });
    state.team.tables.push(record);
    return record;
}

export async function updateTeamTable(id, name) {
    return await pb.collection('team_tables').update(id, { name });
}

export async function deleteTeamTable(id) {
    // Eliminar dependências
    const groups = await pb.collection('team_groups').getFullList({ filter: `table_id = "${id}"` });
    for (const g of groups) await pb.collection('team_groups').delete(g.id);
    
    const records = await pb.collection('team_records').getFullList({ filter: `table_id = "${id}"` });
    for (const r of records) await pb.collection('team_records').delete(r.id);
    
    return await pb.collection('team_tables').delete(id);
}

export async function createTeamGroup(name, tableId) {
    return await pb.collection('team_groups').create({
        name,
        table_id: tableId,
        user_id: pb.authStore.model.id
    });
}

export async function deleteTeamGroup(id) {
    // Desvincular registos antes de eliminar o grupo
    const affected = state.team.records.filter(r => r.group_id === id);
    for (const rec of affected) {
        await pb.collection('team_records').update(rec.id, { group_id: null });
    }
    return await pb.collection('team_groups').delete(id);
}

export async function saveTeamRecord(data, editId = null) {
    const payload = { ...data, user_id: pb.authStore.model.id };
    if (editId) {
        return await pb.collection('team_records').update(editId, payload);
    } else {
        return await pb.collection('team_records').create(payload);
    }
}

export async function deleteTeamRecord(id) {
    return await pb.collection('team_records').delete(id);
}

// --- MÓDULO TERM (RELATÓRIOS DE CONTENTOR) ---

/**
 * Procura todos os relatórios TERM
 */
export async function fetchTermDashboardData() {
    try {
        const userId = pb.authStore.model.id;
        const tables = await pb.collection('term_v2_tables').getFullList({ 
            filter: `user_id = "${userId}"`, 
            sort: '-created' 
        });
        state.term.tables = tables;
        return tables;
    } catch (err) {
        if (err.status === 404) {
            console.warn("Coleção 'term_tables' não encontrada. O utilizador deve criá-la no PocketBase.");
            state.term.tables = [];
            return [];
        }
        throw err;
    }
}

/**
 * Carrega dados de um relatório TERM específico
 */
export async function fetchTermTableData(tableId) {
    try {
        const userId = pb.authStore.model.id;
        state.term.currentTableId = tableId;
        
        const records = await pb.collection('term_v2_records').getFullList({ 
            filter: `table_id = "${tableId}" && user_id = "${userId}"`, 
            sort: 'created' 
        });

        state.term.records = records;
        return { records };
    } catch (err) {
        if (err.status === 404) {
            state.term.records = [];
            return { records: [] };
        }
        throw err;
    }
}

export async function createTermTable(name) {
    const record = await pb.collection('term_v2_tables').create({ 
        name, 
        user_id: pb.authStore.model.id 
    });
    state.term.tables.push(record);
    return record;
}

export async function deleteTermTable(id) {
    const records = await pb.collection('term_v2_records').getFullList({ filter: `table_id = "${id}"` });
    for (const r of records) await pb.collection('term_v2_records').delete(r.id);
    
    return await pb.collection('term_v2_tables').delete(id);
}

export async function saveTermRecord(data, editId = null) {
    const payload = { ...data, user_id: pb.authStore.model.id };
    if (editId) {
        return await pb.collection('term_v2_records').update(editId, payload);
    } else {
        return await pb.collection('term_v2_records').create(payload);
    }
}

export async function deleteTermRecord(id) {
    return await pb.collection('term_v2_records').delete(id);
}

