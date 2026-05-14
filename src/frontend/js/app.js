/**
 * Ponto de Entrada - Bill Check (Modularizado)
 */
import { initializeApp } from './init.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as utils from './utils.js';

const { state, pb } = api;

// --- EXPOSIÇÃO GLOBAL (Compatibilidade com onclick no HTML) ---
window.ui = ui;
window.handleLogin = handleLogin;

// Inicialização da aplicação (Sendo um módulo, o código corre apenas uma vez e após o parse do DOM)
(async () => {
    if (window.__APP_LOADED__) return;
    window.__APP_LOADED__ = true;

    ui.setLoader(true);
    try {
        await initializeApp();
        
        if (pb.authStore.isValid) {
            const userEl = document.getElementById('display-username');
            if (userEl) userEl.innerText = pb.authStore.model?.name || "Utilizador";
            await showHub();
        } else {
            ui.showView('view-login');
        }
    } catch (err) {
        console.error("Erro na inicialização:", err);
    } finally {
        ui.setLoader(false);
    }
})();

window.handleLogout = handleLogout;
window.showHub = showHub;
window.showDashboard = showDashboard;
window.showFinance = showFinance;
window.openFinanceSheetModal = openFinanceSheetModal;
window.addFinanceSheet = addFinanceSheet;
window.openFinanceGroupModal = openFinanceGroupModal;
window.saveFinanceGroup = saveFinanceGroup;
window.deleteFinanceGroup = deleteFinanceGroup;
window.moveFinanceGroup = moveFinanceGroup;
window.removeFinanceSheet = removeFinanceSheet;
window.moveFinanceSheet = moveFinanceSheet;
window.renameFinanceGroup = renameFinanceGroup;
window.handleManualFinanceRefresh = handleManualFinanceRefresh;
window.openTable = openTable;
window.createNewTable = createNewTable;
window.saveContainer = saveContainer;
window.deleteContainer = deleteContainer;
window.confirmPayment = confirmPayment;
window.confirmPaymentFull = confirmPaymentFull;
window.openNewTableModal = openNewTableModal;
window.openContainerModal = openContainerModal;
window.openPaymentModal = openPaymentModal;
window.closeModal = ui.closeModal;
window.downloadTableAsImage = downloadTableAsImage;

window.showTeam = showTeam;
window.openNewTeamTableModal = openNewTableModal;
window.createTeamTable = createTeamTable;
window.openTeamTable = openTeamTable;
window.openTeamRecordModal = openTeamRecordModal;
window.editTeamRecord = editTeamRecord;
window.saveTeamRecord = saveTeamRecord;
window.deleteTeamRecord = deleteTeamRecord;
window.openTeamGroupModal = openTeamGroupModal;
window.createTeamGroup = createTeamGroup;
window.downloadTeamTableAsImage = downloadTeamTableAsImage;

// --- TERM MODULE ---
window.showTerm = showTerm;
window.openNewTermTableModal = openNewTermTableModal;
window.createTermTable = createTermTable;
window.openTermTable = openTermTable;
window.openTermRecordModal = openTermRecordModal;
window.saveTermRecord = saveTermRecord;
window.deleteTermRecord = deleteTermRecord;
window.downloadTermTableAsImage = downloadTermTableAsImage;
window.handleTermDateChange = handleTermDateChange;

// --- CONFIRM MODULE ---
window.showConfirm = showConfirm;
window.openConfirmProjectModal = openConfirmProjectModal;
window.saveConfirmProject = saveConfirmProject;
window.deleteConfirmProject = deleteConfirmProject;
window.selectConfirmProject = selectConfirmProject;
window.openDriveExplorer = openDriveExplorer;
window.saveConfirmToSheet = saveConfirmToSheet;
window.handleConfirmSearch = handleConfirmSearch;
window.handleConfirmProjectSearch = handleConfirmProjectSearch;
window.navigateToFolder = navigateToFolder;

window.driveGoBack = driveGoBack;
window.onConfirmRow = onConfirmRow;
window.showFilePreview = ui.showFilePreview;
window.autoOpenClientFolder = autoOpenClientFolder;
window.handleCreateFolder = handleCreateFolder;
window.handleFileUpload = handleFileUpload;
window.triggerFileUpload = triggerFileUpload;
window.showBank = showBank;

// --- LÓGICA DE APLICAÇÃO ---

async function showBank() {
    await ui.showBankDashboard();
}

async function handleLogin() {
    const email = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const errorEl = document.getElementById('login-error');
    const errorMsgEl = document.getElementById('error-message');

    if (!email || !pass) return ui.toast("Preencha todos os campos.", "error");
    
    const btn = document.getElementById('btn-login');
    ui.setBtnLoading(btn, true, "A entrar...");
    errorEl.classList.add('hidden');

    try {
        await api.login(email, pass);
        const userEl = document.getElementById('display-username');
        if (userEl) userEl.innerText = pb.authStore.model?.name || "Utilizador";
        await showHub();
    } catch (err) {
        errorEl.classList.remove('hidden');
        errorMsgEl.innerText = err.message;
        ui.toast(err.message, 'error');
    } finally {
        ui.setBtnLoading(btn, false);
    }
}

function handleLogout() {
    api.logout();
    location.reload();
}

/**
 * Mostra o Dashboard Principal (Menu de Módulos)
 */
async function showHub() {
    ui.setLoader(true);
    try {
        ui.showView('view-hub');
    } catch (err) {
        console.error(err);
        ui.toast("Erro ao carregar menu principal.", "error");
    } finally {
        ui.setLoader(false);
    }
}

/**
 * Módulo FINANCE (Em desenvolvimento)
 */
/**
 * Módulo FINANCE (CONSOLIDATOR)
 */
let financeRefreshInterval = null;

async function showFinance() {
    ui.setLoader(true);
    try {
        await api.fetchFinanceData();
        ui.showView('view-finance');
        ui.renderFinanceDashboard(deleteFinanceGroup, removeFinanceSheet, null, renameFinanceGroup);
        
        // Iniciar auto-refresh
        if (!financeRefreshInterval) {
            financeRefreshInterval = setInterval(refreshAllFinanceSheets, 30000); // 30s
        }
    } catch (err) {
        console.error("Erro no módulo financeiro:", err);
        ui.toast("Erro ao carregar módulo financeiro", "error");
    } finally {
        ui.setLoader(false);
    }
}

async function refreshAllFinanceSheets() {
    const sheets = api.state.finance.sheets;
    if (sheets.length === 0 || document.getElementById('view-finance').classList.contains('hidden')) return;

    const icon = document.getElementById('finance-refresh-icon');
    if (icon) icon.classList.add('animate-spin');

    try {
        for (const sheet of sheets) {
            try {
                const newData = await api.processFinanceUrl(sheet.sourceUrl);
                const updated = { ...newData, groupId: sheet.groupId };
                await api.saveFinanceSheet(updated, sheet.id);
            } catch (e) { console.warn(`Falha ao atualizar folha ${sheet.id}`); }
        }
        await api.fetchFinanceData();
        ui.renderFinanceDashboard(deleteFinanceGroup, removeFinanceSheet, null, renameFinanceGroup);
    } finally {
        if (icon) icon.classList.remove('animate-spin');
    }
}

async function handleManualFinanceRefresh() {
    ui.setLoader(true);
    await refreshAllFinanceSheets();
    ui.setLoader(false);
}

// Modais e Acções Financeiras
function openFinanceSheetModal() {
    document.getElementById('input-finance-sheet-url').value = '';
    document.getElementById('modal-finance-sheet').classList.remove('hidden');
}

async function addFinanceSheet() {
    const url = document.getElementById('input-finance-sheet-url').value.trim();
    if (!url) return;

    const btn = document.getElementById('btn-finance-sheet-add');
    ui.setBtnLoading(btn, true, "A processar...");
    try {
        const data = await api.processFinanceUrl(url);
        await api.saveFinanceSheet(data);
        ui.closeModal('modal-finance-sheet');
        await showFinance();
    } catch (err) {
        ui.toast("Erro ao processar folha", "error");
    } finally {
        ui.setBtnLoading(btn, false);
    }
}

async function removeFinanceSheet(id) {
    if (!confirm("Remover esta folha do consolidado?")) return;
    ui.setLoader(true);
    try {
        await api.deleteFinanceSheet(id);
        await showFinance();
    } catch (err) { ui.toast(err.message, "error"); }
    finally { ui.setLoader(false); }
}

async function moveFinanceGroup(id, direction) {
    ui.setLoader(true);
    try {
        await api.updateFinanceGroupOrder(id, direction);
        await showFinance();
    } catch (err) { ui.toast(err.message, "error"); }
    finally { ui.setLoader(false); }
}

async function moveFinanceSheet(sheetId, groupId) {
    ui.setLoader(true);
    try {
        await api.saveFinanceSheet({ groupId: groupId || null }, sheetId);
        await showFinance();
    } catch (err) { ui.toast(err.message, "error"); }
    finally { ui.setLoader(false); }
}

function openFinanceGroupModal() {
    document.getElementById('input-finance-group-name').value = '';
    document.getElementById('modal-finance-group').classList.remove('hidden');
}

async function saveFinanceGroup() {
    const name = document.getElementById('input-finance-group-name').value.trim();
    if (!name) return;
    const btn = document.getElementById('btn-finance-group-save');
    ui.setBtnLoading(btn, true);
    try {
        await api.createFinanceGroup(name);
        ui.closeModal('modal-finance-group');
        await showFinance();
    } catch (err) { ui.toast(err.message, "error"); }
    finally { ui.setBtnLoading(btn, false); }
}

async function deleteFinanceGroup(id) {
    if (!confirm("Eliminar este grupo? As folhas ficarão sem grupo.")) return;
    ui.setLoader(true);
    try {
        await api.deleteFinanceGroup(id);
        await showFinance();
    } catch (err) { ui.toast(err.message, "error"); }
    finally { ui.setLoader(false); }
}

async function renameFinanceGroup(id) {
    const newName = prompt("Novo nome para o grupo:");
    if (!newName) return;
    ui.setLoader(true);
    try {
        await api.pb.collection('groups').update(id, { name: newName });
        await showFinance();
    } catch (err) { ui.toast(err.message, "error"); }
    finally { ui.setLoader(false); }
}

async function showDashboard() {
    ui.setLoader(true);
    try {
        await api.fetchDashboardData();
        ui.showView('view-dashboard');
        ui.renderDashboard(openTable, openTableActions);
        ui.renderDashboardSummary();
    } catch (err) {
        console.error(err);
        ui.toast("Erro ao carregar dashboard.", "error");
    } finally {
        ui.setLoader(false);
    }
}

async function openTable(id) {
    ui.setLoader(true);
    try {
        const table = state.tables.find(t => t.id === id);
        document.getElementById('current-table-title').innerText = table.name;
        document.getElementById('table-display-name').innerText = table.name;

        await api.fetchTableData(id);

        ui.showView('view-table');
        document.getElementById('table-actions').classList.remove('hidden');
        ui.renderTableDetails(editContainer);
    } catch (err) {
        console.error(err);
        ui.toast("Erro ao carregar tabela.", "error");
    } finally {
        ui.setLoader(false);
    }
}

async function createNewTable() {
    const name = document.getElementById('input-table-name').value.trim();
    if (!name) return;
    const btn = document.getElementById('modal-table-submit');
    ui.setBtnLoading(btn, true);
    try {
        await api.createTable(name);
        ui.closeModal('modal-new-table');
        await showDashboard();
    } catch (err) { ui.toast(err.message, "error"); }
    finally { ui.setBtnLoading(btn, false); }
}

async function saveContainer() {
    const id_str = document.getElementById('input-id').value.trim();
    const duty = parseFloat(document.getElementById('input-duty').value) || 0;
    const freight = parseFloat(document.getElementById('input-freight').value) || 0;
    const editId = document.getElementById('edit-id').value;

    if (!id_str) return ui.toast("Identificação necessária.", "error");
    if (duty < 0 || freight < 0) return ui.toast("Valores não podem ser negativos.", "error");

    const btn = document.getElementById('btn-container-save');
    ui.setBtnLoading(btn, true);
    try {
        await api.saveContainerData({ table_id: state.currentTableId, container_id_str: id_str, duty, freight }, editId);
        ui.closeModal('modal-container');
        await openTable(state.currentTableId);
    } catch (err) { alert(err.message); }
    finally { ui.setBtnLoading(btn, false); }
}

async function deleteContainer() {
    const editId = document.getElementById('edit-id').value;
    const btn = document.getElementById('btn-delete');
    if (editId && confirm("Eliminar registo permanentemente?")) {
        ui.setBtnLoading(btn, true);
        try {
            await api.deleteContainerData(editId);
            ui.closeModal('modal-container');
            await openTable(state.currentTableId);
        } catch (err) { alert(err.message); }
        finally { ui.setBtnLoading(btn, false); }
    }
}

async function confirmPayment() {
    const date = document.getElementById('input-pay-date').value;
    const amount = parseFloat(document.getElementById('input-pay-amount').value) || 0;
    
    if (!date || amount < 0.01) return ui.toast("Verifique a data e o valor.", "error");
    if (amount > Math.abs(state.activeBalance)) return ui.toast("Valor superior ao saldo disponível.", "error");

    const btn = document.getElementById('btn-payment-confirm');
    ui.setBtnLoading(btn, true);
    try {
        await api.registerPayment(state.currentTableId, amount, date);
        ui.closeModal('modal-payment');
        await openTable(state.currentTableId);
    } catch (err) { alert(err.message); }
    finally { ui.setBtnLoading(btn, false); }
}

async function confirmPaymentFull() {
    document.getElementById('input-pay-amount').value = Math.abs(state.activeBalance).toFixed(2);
    await confirmPayment();
}

// --- UTILITÁRIOS DE UI (COORDENAÇÃO) ---

function openTableActions(table, button) {
    const menu = document.createElement('div');
    menu.className = 'absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[120px]';
    menu.style.top = (button.offsetTop + button.offsetHeight + 5) + 'px';
    menu.style.left = (button.offsetLeft - 100) + 'px';
    
    const editOption = document.createElement('button');
    editOption.className = 'w-full text-left px-4 py-2 text-xs hover:bg-gray-100';
    editOption.textContent = 'Editar';
    editOption.onclick = (e) => {
        e.stopPropagation();
        openEditTableModal(table);
        document.body.removeChild(menu);
    };
    
    const deleteOption = document.createElement('button');
    deleteOption.className = 'w-full text-left px-4 py-2 text-xs hover:bg-gray-100 text-red-600';
    deleteOption.textContent = 'Eliminar';
    deleteOption.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Eliminar tabela "${table.name}" e todos os dados associados?`)) {
            api.deleteTable(table.id).then(() => showDashboard());
        }
        document.body.removeChild(menu);
    };
    
    menu.append(editOption, deleteOption);
    document.body.appendChild(menu);
    
    const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== button) {
            document.body.removeChild(menu);
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

function openEditTableModal(table) {
    document.getElementById('modal-new-table').classList.remove('hidden');
    document.getElementById('modal-table-title').innerText = 'Editar Tabela';
    document.getElementById('modal-table-submit').innerText = 'Atualizar Tabela';
    document.getElementById('input-table-name').value = table.name;
    
    const createBtn = document.getElementById('modal-table-submit');
    createBtn.className = 'w-full bg-blue-700 text-white py-3 rounded-lg font-bold uppercase text-xs hover:bg-blue-800 transition-all';
    
    createBtn.onclick = async () => {
        const newName = document.getElementById('input-table-name').value.trim();
        if (!newName) return;
        ui.setLoader(true);
        try {
            await api.updateTable(table.id, newName);
            ui.closeModal('modal-new-table');
            await showDashboard();
        } catch (err) { alert(err.message); }
        finally { ui.setLoader(false); resetTableModal(); }
    };
}

function resetTableModal() {
    document.getElementById('modal-table-title').innerText = 'Nova Tabela de Registo';
    document.getElementById('modal-table-submit').innerText = 'Criar Tabela';
    const createBtn = document.getElementById('modal-table-submit');
    createBtn.onclick = createNewTable;
    createBtn.className = 'w-full bg-black text-white py-3 rounded-lg font-bold uppercase text-xs hover:bg-gray-800 transition-all';
    document.getElementById('input-table-name').value = '';
}

function openNewTableModal() {
    resetTableModal();
    document.getElementById('modal-new-table').classList.remove('hidden');
    document.getElementById('input-table-name').focus();
}

function openContainerModal() {
    document.getElementById('modal-container').classList.remove('hidden');
    document.getElementById('modal-container-title').innerText = "Registo de Contentor";
    document.getElementById('btn-delete').classList.add('hidden');
    document.getElementById('edit-id').value = '';
    document.getElementById('input-id').value = '';
    document.getElementById('input-duty').value = '';
    document.getElementById('input-freight').value = '';
}

function editContainer(c) {
    document.getElementById('modal-container').classList.remove('hidden');
    document.getElementById('modal-container-title').innerText = "Editar Registo";
    document.getElementById('btn-delete').classList.remove('hidden');
    document.getElementById('edit-id').value = c.id;
    document.getElementById('input-id').value = c.container_id_str;
    document.getElementById('input-duty').value = c.duty;
    document.getElementById('input-freight').value = c.freight;
}

function openPaymentModal() {
    if (Math.abs(state.activeBalance) < 0.01) return ui.toast("O balanço já está liquidado.", "info");
    document.getElementById('modal-payment').classList.remove('hidden');
    
    const balance = state.activeBalance;
    const isCredit = balance < 0;
    
    document.getElementById('balance-label').textContent = isCredit ? 'CRÉDITO DISPONÍVEL' : 'SALDO A PAGAR';
    document.getElementById('current-balance-display').innerText = utils.formatMZN(balance);
    document.getElementById('current-balance-display').className = `text-xl font-bold ${isCredit ? 'text-blue-700' : 'text-green-700'}`;
    document.getElementById('input-pay-amount').value = Math.abs(balance).toFixed(2);
    document.getElementById('input-pay-date').value = new Date().toISOString().split('T')[0];
}

function downloadTableAsImage() {
    utils.downloadElementAsImage('capture-area', `extrato-${state.currentTableId}`);
}

// --- EVENTOS INICIAIS ---



document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (!document.getElementById('view-login').classList.contains('hidden')) handleLogin();
        else if (!document.getElementById('modal-new-table').classList.contains('hidden')) {
            const submitBtn = document.getElementById('modal-table-submit');
            if (submitBtn) submitBtn.click();
        }
        else if (!document.getElementById('modal-container').classList.contains('hidden')) saveContainer();
    }
});
// --- LÓGICA MÓDULO TEAM ---

async function showTeam() {
    ui.setLoader(true);
    try {
        const tables = await api.fetchTeamDashboardData();
        
        if (tables.length > 0) {
            // Se já existe um relatório, abre o primeiro automaticamente
            await openTeamTable(tables[0].id);
        } else {
            // Se não existe, cria o relatório único padrão
            const newTable = await api.createTeamTable("RELATÓRIO GERAL");
            await openTeamTable(newTable.id);
        }
    } catch (err) {
        console.error(err);
        ui.toast("Erro ao aceder ao módulo de equipes.", "error");
    } finally {
        ui.setLoader(false);
    }
}

async function openTeamTable(id) {
    ui.setLoader(true);
    try {
        const table = api.state.team.tables.find(t => t.id === id);
        // O H1 agora é fixo como "TEAM", não alteramos mais o innerText do H1
        
        await api.fetchTeamTableData(id);
        ui.showView('view-team-table');
        ui.renderTeamTable(editTeamRecord);
    } catch (err) {
        console.error("Erro no OpenTeamTable:", err);
        ui.toast(`Erro ao carregar relatório: ${err.message}`, "error");
    } finally {
        ui.setLoader(false);
    }
}

function openNewTeamTableModal() {
    document.getElementById('input-team-table-name').value = '';
    document.getElementById('modal-team-table').classList.remove('hidden');
}

async function createTeamTable() {
    const name = document.getElementById('input-team-table-name').value.trim();
    if (!name) return;
    const btn = document.getElementById('btn-team-table-create');
    ui.setBtnLoading(btn, true);
    try {
        await api.createTeamTable(name);
        ui.closeModal('modal-team-table');
        await showTeam();
    } catch (err) { alert(err.message); }
    finally { ui.setBtnLoading(btn, false); }
}

function openTeamTableActions(table, button) {
    const menu = document.createElement('div');
    menu.className = 'absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[120px]';
    menu.style.top = (button.offsetTop + button.offsetHeight + 5) + 'px';
    menu.style.left = (button.offsetLeft - 100) + 'px';
    
    const deleteOption = document.createElement('button');
    deleteOption.className = 'w-full text-left px-4 py-2 text-xs hover:bg-gray-100 text-red-600';
    deleteOption.textContent = 'Eliminar';
    deleteOption.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`Eliminar relatório "${table.name}"?`)) {
            ui.setLoader(true);
            try {
                await api.deleteTeamTable(table.id);
                document.body.removeChild(menu);
                await showTeam();
            } catch (err) { alert(err.message); }
            finally { ui.setLoader(false); }
        }
    };
    
    menu.append(deleteOption);
    document.body.appendChild(menu);
    const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== button) {
            document.body.removeChild(menu);
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

function openTeamGroupModal() {
    const name = prompt("Nome do Lote/Grupo (ex: Lote A):");
    if (name) createTeamGroup(name);
}

async function createTeamGroup(name) {
    ui.setLoader(true);
    try {
        await api.createTeamGroup(name, api.state.team.currentTableId);
        await openTeamTable(api.state.team.currentTableId);
    } catch (err) { alert(err.message); }
    finally { ui.setLoader(false); }
}

function openTeamRecordModal() {
    document.getElementById('modal-team-record').classList.remove('hidden');
    document.getElementById('team-record-modal-title').innerText = "Novo Registo (Equipes)";
    document.getElementById('btn-team-record-delete').classList.add('hidden');
    document.getElementById('team-record-id').value = '';
    
    // Reset inputs e valores padrão
    document.getElementById('input-team-container-id').value = '';
    
    // Valores Padrão
    const currentDate = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD para input type="date"
    
    document.getElementById('team-val-interna').value = '115000';
    document.getElementById('team-val-maputo').value = '15000';
    document.getElementById('team-val-matola').value = '15000';
    document.getElementById('team-val-termos').value = '';
    
    ['interna', 'maputo', 'matola', 'termos'].forEach(team => {
        document.getElementById(`team-month-${team}`).value = '';
        document.getElementById(`team-paid-${team}`).checked = false;
    });

    // Populate Groups
    const select = document.getElementById('select-team-group');
    select.innerHTML = '';
    const defOpt = document.createElement('option');
    defOpt.value = "";
    defOpt.textContent = "Sem Lote / Grupo";
    select.appendChild(defOpt);

    api.state.team.groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        select.appendChild(opt);
    });
}

function editTeamRecord(r) {
    openTeamRecordModal();
    document.getElementById('team-record-modal-title').innerText = "Editar Registo";
    document.getElementById('btn-team-record-delete').classList.remove('hidden');
    document.getElementById('team-record-id').value = r.id;
    document.getElementById('input-team-container-id').value = r.container_id_str;
    document.getElementById('select-team-group').value = r.group_id || '';

    ['interna', 'maputo', 'matola', 'termos'].forEach(team => {
        document.getElementById(`team-val-${team}`).value = r[`${team}_val`];
        document.getElementById(`team-month-${team}`).value = r[`${team}_month`];
        document.getElementById(`team-paid-${team}`).checked = r[`${team}_paid`];
    });
}

async function saveTeamRecord() {
    const containerId = document.getElementById('input-team-container-id').value.trim();
    if (!containerId) return ui.toast("ID do contentor é obrigatório.", "error");

    const data = {
        table_id: api.state.team.currentTableId,
        group_id: document.getElementById('select-team-group').value || null,
        container_id_str: containerId,
        interna_val: parseFloat(document.getElementById('team-val-interna').value) || 0,
        interna_month: document.getElementById('team-month-interna').value,
        interna_paid: document.getElementById('team-paid-interna').checked,
        maputo_val: parseFloat(document.getElementById('team-val-maputo').value) || 0,
        maputo_month: document.getElementById('team-month-maputo').value,
        maputo_paid: document.getElementById('team-paid-maputo').checked,
        matola_val: parseFloat(document.getElementById('team-val-matola').value) || 0,
        matola_month: document.getElementById('team-month-matola').value,
        matola_paid: document.getElementById('team-paid-matola').checked,
        termos_val: parseFloat(document.getElementById('team-val-termos').value) || 0,
        termos_month: document.getElementById('team-month-termos').value,
        termos_paid: document.getElementById('team-paid-termos').checked,
    };

    const btn = document.getElementById('btn-team-record-save');
    const editId = document.getElementById('team-record-id').value;
    ui.setBtnLoading(btn, true);
    try {
        await api.saveTeamRecord(data, editId);
        ui.closeModal('modal-team-record');
        await openTeamTable(api.state.team.currentTableId);
    } catch (err) { alert(err.message); }
    finally { ui.setBtnLoading(btn, false); }
}

async function deleteTeamRecord() {
    const id = document.getElementById('team-record-id').value;
    const btn = document.getElementById('btn-team-record-delete');
    if (id && confirm("Eliminar este registo permanentemente?")) {
        ui.setBtnLoading(btn, true);
        try {
            await api.deleteTeamRecord(id);
            ui.closeModal('modal-team-record');
            await openTeamTable(api.state.team.currentTableId);
        } catch (err) { alert(err.message); }
        finally { ui.setBtnLoading(btn, false); }
    }
}

function downloadTeamTableAsImage() {
    utils.downloadElementAsImage('team-capture-area', `relatorio-equipes-${api.state.team.currentTableId}`);
}

// --- LÓGICA MÓDULO TERM ---

async function showTerm() {
    ui.setLoader(true);
    try {
        const tables = await api.fetchTermDashboardData();
        
        if (tables && tables.length > 0) {
            await openTermTable(tables[0].id);
        } else {
            // Se chegamos aqui e o estado de tabelas é vazio, mostramos o dashboard
            // para permitir que o utilizador tente criar a primeira tabela
            ui.showView('view-term-dashboard');
            ui.renderTermDashboard(openTermTable, null);
        }
    } catch (err) {
        console.error("Erro ao carregar TERM:", err);
        if (err.status === 404) {
            ui.toast("ERRO DE CONFIGURAÇÃO: As coleções 'term_tables' e 'term_records' não existem no seu PocketBase. O módulo não funcionará até que sejam criadas.", "error");
            ui.showView('view-term-dashboard');
        } else {
            ui.toast("Erro ao aceder ao módulo TERM: " + err.message, "error");
        }
    } finally {
        ui.setLoader(false);
    }
}

async function openTermTable(id) {
    ui.setLoader(true);
    try {
        await api.fetchTermTableData(id);
        ui.showView('view-term-table');
        ui.renderTermTable(editTermRecord);
    } catch (err) {
        console.error(err);
        ui.toast(`Erro ao carregar relatório TERM: ${err.message}`, "error");
    } finally {
        ui.setLoader(false);
    }
}

function openNewTermTableModal() {
    document.getElementById('input-term-table-name').value = '';
    document.getElementById('modal-term-table').classList.remove('hidden');
}

async function createTermTable() {
    const name = document.getElementById('input-term-table-name').value.trim();
    if (!name) return;
    const btn = document.getElementById('btn-term-table-create');
    ui.setBtnLoading(btn, true);
    try {
        await api.createTermTable(name);
        ui.closeModal('modal-term-table');
        await showTerm();
    } catch (err) { ui.toast(err.message, "error"); }
    finally { ui.setBtnLoading(btn, false); }
}

function openTermRecordModal() {
    document.getElementById('modal-term-record').classList.remove('hidden');
    document.getElementById('term-record-modal-title').innerText = "Novo Registo (TERM)";
    document.getElementById('btn-term-record-delete').classList.add('hidden');
    document.getElementById('term-record-id').value = '';
    
    document.getElementById('input-term-container-id').value = '';
    document.getElementById('input-term-eta').value = '';
    document.getElementById('input-term-tcs').value = '3';
    document.getElementById('input-term-unit').value = '16000';
    
    const statusSelect = document.getElementById('select-term-status');
    statusSelect.value = 'PENDING';
    statusSelect.disabled = false;
}

function editTermRecord(r) {
    openTermRecordModal();
    document.getElementById('term-record-modal-title').innerText = "Editar Registo TERM";
    document.getElementById('btn-term-record-delete').classList.remove('hidden');
    document.getElementById('term-record-id').value = r.id;
    
    document.getElementById('input-term-container-id').value = r.container_id_str;
    
    // Garantir que carregamos apenas a data (YYYY-MM-DD) para o input
    const pureDate = r.eta ? r.eta.split(' ')[0] : '';
    document.getElementById('input-term-eta').value = pureDate;
    
    document.getElementById('input-term-tcs').value = r.tcs;
    document.getElementById('input-term-unit').value = r.unit;
    document.getElementById('select-term-status').value = r.status;
    
    // Atualizar estado bloqueado/valor do status baseado na data carregada
    handleTermDateChange();
}

async function saveTermRecord() {
    const containerId = document.getElementById('input-term-container-id').value.trim();
    if (!containerId) return ui.toast("ID do contentor é obrigatório.", "error");

    const data = {
        table_id: api.state.term.currentTableId,
        container_id_str: containerId,
        eta: document.getElementById('input-term-eta').value,
        tcs: parseFloat(document.getElementById('input-term-tcs').value) || 0,
        unit: parseFloat(document.getElementById('input-term-unit').value) || 0,
        status: document.getElementById('select-term-status').value
    };

    const editId = document.getElementById('term-record-id').value;
    const btn = document.getElementById('btn-term-record-save');
    ui.setBtnLoading(btn, true);
    try {
        await api.saveTermRecord(data, editId);
        ui.closeModal('modal-term-record');
        await openTermTable(api.state.term.currentTableId);
    } catch (err) { ui.toast(err.message, "error"); }
    finally { ui.setBtnLoading(btn, false); }
}

async function deleteTermRecord() {
    const id = document.getElementById('term-record-id').value;
    const btn = document.getElementById('btn-term-record-delete');
    if (id && confirm("Eliminar este registo permanently?")) {
        ui.setBtnLoading(btn, true);
        try {
            await api.deleteTermRecord(id);
            ui.closeModal('modal-term-record');
            await openTermTable(api.state.term.currentTableId);
        } catch (err) { ui.toast(err.message, "error"); }
        finally { ui.setBtnLoading(btn, false); }
    }
}

function downloadTermTableAsImage() {
    utils.downloadElementAsImage('term-capture-area', `relatorio-term-${api.state.term.currentTableId}`);
}

function handleTermDateChange() {
    const etaInput = document.getElementById('input-term-eta');
    const statusSelect = document.getElementById('select-term-status');
    
    // Se já estiver como PAID, permitimos manter
    if (statusSelect.value === 'PAID') {
        statusSelect.disabled = false;
        return;
    }

    if (!etaInput.value) {
        statusSelect.disabled = false;
        return;
    }

    const selectedDate = new Date(etaInput.value + 'T00:00:00');
    const now = new Date();
    
    // Comparar apenas mês e ano
    const selectedMonth = selectedDate.getUTCMonth();
    const selectedYear = selectedDate.getUTCFullYear();
    
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    if (selectedYear > currentYear || (selectedYear === currentYear && selectedMonth > currentMonth)) {
        statusSelect.value = 'NEXT';
    } else {
        statusSelect.value = 'PENDING';
    }
    
    // Deixamos habilitado para que o usuário possa trocar para PAID se necessário
    // Mas o valor automático PENDING/NEXT é sugerido pela data
    statusSelect.disabled = false; 
}

// --- MÓDULO CONFIRM ---
let currentConfirmRow = null;
let driveHistory = [];
let currentProjectSheetId = null; 
let currentProjectRootFolderId = null; 
let projectFoldersCache = null; // Cache de pastas para abertura instantânea




async function showConfirm() {
    ui.showView('view-confirm-dashboard');
    loadConfirmProjects();
}

async function loadConfirmProjects() {
    try {
        const projects = await api.getConfirmProjects();
        ui.renderConfirmProjects(projects);
    } catch (err) {
        console.error("Erro ao carregar projetos:", err);
    }
}

async function openConfirmProjectModal(projectId = null) {
    const title = document.getElementById('confirm-project-modal-title');
    const idInput = document.getElementById('input-project-id');
    const nameInput = document.getElementById('input-project-name');
    const sheetInput = document.getElementById('input-project-sheet-id');
    const driveInput = document.getElementById('input-project-drive-id');
    const delContainer = document.getElementById('confirm-project-delete-container');

    if (projectId) {
        // Modo Edição (busca no estado ou recarrega?)
        // Por simplicidade, assumimos que o estado api.state tem ou buscamos do DOM
        title.innerText = "EDITAR PROJETO";
        idInput.value = projectId;
        delContainer.classList.remove('hidden');
        
        // Buscar dados do projeto clicado (via atributo ou cache)
        const projects = api.state.confirm?.projects || [];
        const p = projects.find(x => x.id === projectId);
        if (p) {
            nameInput.value = p.name;
            sheetInput.value = p.sheetId;
            driveInput.value = p.folderId;
        }
    } else {
        title.innerText = "NOVO PROJETO";
        idInput.value = "";
        nameInput.value = "";
        sheetInput.value = "";
        driveInput.value = "";
        delContainer.classList.add('hidden');
    }
    ui.openModal('modal-confirm-project');
}

async function saveConfirmProject() {
    const extractId = (str) => {
        if (!str) return "";
        // Extrair ID de URL do Sheets ou Drive
        const match = str.match(/[-\w]{25,}/);
        return match ? match[0] : str.trim();
    };

    const data = {
        id: document.getElementById('input-project-id').value,
        name: document.getElementById('input-project-name').value.trim(),
        sheetId: extractId(document.getElementById('input-project-sheet-id').value),
        folderId: extractId(document.getElementById('input-project-drive-id').value),
    };

    if (!data.name || !data.sheetId) return ui.toast("Nome e ID da Folha são obrigatórios.", "error");

    const btn = document.getElementById('btn-confirm-project-save');
    ui.setBtnLoading(btn, true);
    try {
        await api.saveConfirmProject(data);
        ui.closeModal('modal-confirm-project');
        loadConfirmProjects();
    } catch (err) {
        ui.toast("Erro ao gravar projeto: " + err.message, "error");
    } finally {
        ui.setBtnLoading(btn, false);
    }
}

async function deleteConfirmProject() {
    const id = document.getElementById('input-project-id').value;
    const btn = document.getElementById('btn-confirm-project-delete');
    if (!confirm("Tem a certeza que deseja eliminar este projeto?")) return;

    ui.setBtnLoading(btn, true);
    try {
        await api.deleteConfirmProject(id);
        ui.closeModal('modal-confirm-project');
        loadConfirmProjects();
    } catch (err) {
        ui.toast("Erro ao eliminar: " + err.message, "error");
    } finally {
        ui.setBtnLoading(btn, false);
    }
}

async function selectConfirmProject(sheetId, folderId, projectName = "CONFIRM") {
    ui.setLoader(true);
    currentProjectSheetId = sheetId; // Guardar para recarregar depois
    
    // Atualizar título da página
    const nameEl = document.getElementById('confirm-project-active-name');
    if (nameEl) nameEl.innerText = projectName;

    try {
        // Carrega o GSheet lendo por defeito a aba primária ou o que estiver definido
        const data = await api.readGSheet(sheetId);
        const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
        ui.renderConfirmList(data, "", statusFilter);
        
        // Configura o explorador de Drive
        currentProjectRootFolderId = folderId;
        driveHistory = [folderId]; 
        ui.showView('view-confirm-table');
        
        // Carregar cache de pastas em background para abertura instantânea depois
        projectFoldersCache = null;
        api.listGDriveFiles(folderId).then(files => {
            projectFoldersCache = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
            console.log(`[CACHE] ${projectFoldersCache.length} pastas mapeadas para este projeto.`);
        }).catch(err => console.error("Erro ao carregar cache de pastas:", err));

        // Carrega o drive explorer somente ao abrir um cliente (autoOpenClientFolder cuidará disso)
        // if (folderId && folderId.trim() !== "") {
        //     openDriveExplorer(folderId, true); 
        // } else {
        //
        // }




    } catch (err) {
        ui.toast("Erro ao carregar projeto: " + err.message, "error");
    } finally {
        ui.setLoader(false);
    }
}

function handleConfirmSearch() {
    const filterText = document.getElementById('input-confirm-search').value;
    const statusFilter = document.getElementById('confirm-status-filter')?.value || 'TODOS';
    ui.renderConfirmList(api.state.confirm.data, filterText, statusFilter);
}

function handleConfirmProjectSearch() {
    const filterText = document.getElementById('input-confirm-project-search').value.toLowerCase();
    const projects = api.state.confirm?.projects || [];
    const filtered = projects.filter(p => p.name.toLowerCase().includes(filterText));
    ui.renderConfirmProjects(filtered, true); 
}


async function autoOpenClientFolder(clientCode, clientName) {
    const rootId = currentProjectRootFolderId;
    if (!rootId) return;

    // Limpar o histórico de navegação ao entrar num novo cliente
    if (typeof driveHistory !== 'undefined') {
        driveHistory = [];
    }

    // Limpar o código de eventuais decimais (.0) que vêm do Excel
    const cleanCode = String(clientCode).split('.')[0].split(',')[0].trim();
    // Normalizar nome da pasta: remover acentos, converter para maiúsculas e trocar espaços por underscores
    const cleanName = clientName
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');
    const targetPattern = `${cleanCode}-${cleanName}`;

    console.log(`[AUTO-DRIVE] Tentando abertura instantânea: "${targetPattern}"`);

    // Mostrar loader imediatamente
    const explorerContainer = document.getElementById('confirm-drive-files');
    if (explorerContainer) explorerContainer.innerHTML = '<div class="p-4 text-center text-xs animate-pulse font-bold text-gray-400">A LOCALIZAR PASTA...</div>';

    // Tentar usar o cache primeiro para ser instantâneo
    let targetFolder = null;
    if (projectFoldersCache) {
        targetFolder = projectFoldersCache.find(f => {
            const folderName = f.name.toUpperCase().replace(/\s+/g, '_');
            return folderName.includes(targetPattern);
        });
    }

    if (targetFolder) {
        console.log(`[AUTO-DRIVE] Encontrado no cache!`);
        openDriveExplorer(targetFolder.id);
        return;
    }

    // Se não estiver no cache (ou cache ainda carregando), tenta a API uma última vez
    try {
        const files = await api.listGDriveFiles(rootId);
        targetFolder = files.find(f => {
            if (f.mimeType !== 'application/vnd.google-apps.folder') return false;
            const folderName = f.name.toUpperCase().replace(/\s+/g, '_');
            return folderName.includes(targetPattern);
        });

        if (targetFolder) {
            state.confirm.activeClientFolderId = targetFolder.id;
            openDriveExplorer(targetFolder.id);
        } else {
            console.warn(`[AUTO-DRIVE] Pasta não localizada.`);
            ui.renderDriveError("Pasta do cliente não encontrada no Drive.", targetPattern, rootId);
        }
    } catch (err) {
        ui.renderDriveError("Erro ao procurar pasta do cliente.", targetPattern, rootId);
    }
}

async function handleCreateFolder(name, parentId) {
    ui.setLoader(true);
    try {
        const folder = await api.createGDriveFolder(name, parentId);
        // Limpar cache para forçar recarregamento na próxima vez
        projectFoldersCache = null;
        // Abrir a nova pasta
        openDriveExplorer(folder.id);
    } catch (err) {
        ui.toast("Erro ao criar pasta: " + err.message, "error");
    } finally {
        ui.setLoader(false);
    }
}

function triggerFileUpload(folderId) {
    const input = document.getElementById('input-confirm-drive-upload');
    if (input) {
        input.dataset.parentId = folderId;
        input.click();
    }
}

async function handleFileUpload(input) {
    const file = input.files[0];
    const parentId = input.dataset.parentId;
    if (!file || !parentId) return;

    ui.setLoader(true);
    const explorerContainer = document.getElementById('confirm-drive-files');
    if (explorerContainer) explorerContainer.innerHTML = '<div class="p-4 text-center text-xs animate-pulse font-bold text-gray-400">A ENVIAR FICHEIRO...</div>';

    try {
        await api.uploadGDriveFile(file, parentId);
        // Recarregar pasta
        openDriveExplorer(parentId);
    } catch (err) {
        ui.toast("Erro no upload: " + err.message, "error");
        openDriveExplorer(parentId);
    } finally {
        ui.setLoader(false);
        input.value = ''; // Limpar input
    }
}

async function confirmAndDeleteFile(fileId, fileName, parentId) {
    if (!confirm(`Tem a certeza que deseja apagar o ficheiro "${fileName}"?`)) return;

    ui.setLoader(true);
    try {
        await api.deleteGDriveFile(fileId);
        // Recarregar pasta
        openDriveExplorer(parentId);
    } catch (err) {
        ui.toast("Erro ao apagar ficheiro: " + err.message, "error");
        openDriveExplorer(parentId);
    } finally {
        ui.setLoader(false);
    }
}

window.confirmAndDeleteFile = confirmAndDeleteFile;
window.triggerFileUpload = triggerFileUpload;
window.handleFileUpload = handleFileUpload;
window.navigateToFolder = navigateToFolder;
window.driveGoBack = driveGoBack;
window.driveGoHome = driveGoHome;
window.showFilePreview = ui.showFilePreview;
window.onConfirmRow = onConfirmRow;
window.saveConfirmToSheet = saveConfirmToSheet;

async function openDriveExplorer(folderId = null, isBack = false) {
    const input = document.getElementById('input-confirm-drive-id');
    const id = folderId || (input ? input.value.trim() : null);

    // Guardar ID globalmente para o mini-filtro
    state.confirm.activeClientFolderId = id; 

    
    const explorerContainer = document.getElementById('confirm-drive-files');
    if (!id) {
        if (explorerContainer) explorerContainer.innerHTML = '<div class="p-4 text-center text-xs font-bold text-gray-400 italic">PASTA NÃO CONFIGURADA</div>';
        return;
    }

    if (!isBack && folderId && input && input.value && input.value !== folderId) {
        driveHistory.push(input.value);
    }

    if (folderId && input) input.value = id; 

    if (explorerContainer) explorerContainer.innerHTML = '<div class="p-4 text-center text-xs animate-pulse font-bold text-gray-400">A CARREGAR DRIVE...</div>';

    try {
        const files = await api.listGDriveFiles(id);
        ui.renderDriveFiles(files, id);
    } catch (err) { 
        console.error("Erro ao carregar Drive:", err);
        if (err.message.includes('AUTH_REQUIRED')) {
            ui.toast("Sessão Google expirada ou não autorizada. Por favor, re-autorize a aplicação.", "error");
            window.location.href = '/api/google/auth';
        } else {
            ui.toast("Não foi possível aceder à pasta. Verifique se o ID está correto e se autorizou o acesso à sua conta Google.", "error");
        }
    }
}

function navigateToFolder(folderId) {
    openDriveExplorer(folderId);
}

function driveGoBack() {
    if (driveHistory.length > 0) {
        const prevId = driveHistory.pop();
        openDriveExplorer(prevId, true);
    }
}

function driveGoHome() {
    if (typeof driveHistory !== 'undefined') driveHistory = [];
    if (state.confirm && state.confirm.activeClientFolderId) {
        openDriveExplorer(state.confirm.activeClientFolderId);
    } else if (typeof currentProjectRootFolderId !== 'undefined' && currentProjectRootFolderId) {
        openDriveExplorer(currentProjectRootFolderId);
    }
}

function onConfirmRow(rowIndex, rowData) {
    currentConfirmRow = { index: rowIndex, data: rowData };
    const columns = api.state.confirm.columns;
    const idCodeIdx = columns.findIndex(c => String(c).includes('ID CODE'));
    const statusIdx = columns.findIndex(c => String(c).includes('CONFIRMATION'));
    
    document.getElementById('confirm-action-title').textContent = `CONFIRMAR: ${rowData[idCodeIdx] || 'Registo'}`;
    
    const currentStatus = rowData[statusIdx] || 'PENDENTE';
    const selectStatus = document.getElementById('select-confirm-status');
    if (selectStatus) {
        selectStatus.value = currentStatus;
        document.getElementById('input-confirm-comment-container')?.classList.toggle('hidden', currentStatus === 'CONFIRMADO');
    }
    
    const datesContainer = document.getElementById('payment-dates-inputs');
    if (datesContainer) {
        datesContainer.innerHTML = '';
        ['PAG 1', 'PAG 2', 'PAG 3'].forEach(label => {
            const idx = columns.findIndex(c => String(c).trim() === label);
            if (idx !== -1) {
                const div = document.createElement('div');
                const labelEl = document.createElement('label');
                labelEl.className = "block text-[9px] font-bold uppercase mb-1 text-gray-500";
                labelEl.textContent = label;

                const input = document.createElement('input');
                input.type = "text";
                input.id = `input-pay-date-${label.replace(' ', '')}`;
                input.className = "w-full p-2 border-2 border-gray-100 rounded-lg font-bold";
                input.value = rowData[idx] || '';
                input.placeholder = "DD/MM/YYYY";

                div.appendChild(labelEl);
                div.appendChild(input);
                datesContainer.appendChild(div);
            }
        });
    }
    
    
    const commentInput = document.getElementById('input-confirm-comment');
    if (commentInput) commentInput.value = '';

    ui.openModal('modal-confirm-action');
}

async function saveConfirmToSheet() {
    if (!currentConfirmRow) return;
    
    const spreadsheetId = currentProjectSheetId;
    // 1. Deteção Robusta da Coluna de Confirmação
    const statusIdx = columns.findIndex(c => {
        const h = String(c).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return h.includes('CONFIRMATION') || h.includes('CONFIRMACAO') || h === 'STATUS';
    });
    
    if (statusIdx === -1) {
        ui.toast("Erro: Coluna de Confirmação não encontrada no GSheet.", "error");
        ui.setLoader(false);
        return;
    }

    const selectedStatus = document.getElementById('select-confirm-status').value;
    const updatedRow = [...currentConfirmRow.data];
    updatedRow[statusIdx] = selectedStatus;
    
    // 2. Mapear datas de pagamento (PAG 1, PAG 2, PAG 3)
    // Agora salvamos as datas independentemente do status
    ['PAG 1', 'PAG 2', 'PAG 3'].forEach(label => {
        const idx = columns.findIndex(c => {
            const h = String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');
            const l = label.toUpperCase().replace(/[^A-Z0-9]/g, '');
            return h === l || h.includes(l);
        });
        
        if (idx !== -1) {
            const inputId = `input-pay-date-${label.replace(' ', '')}`;
            const input = document.getElementById(inputId);
            if (input) {
                // Se o input existir, gravamos o valor (mesmo que vazio para limpar)
                updatedRow[idx] = input.value.trim();
            }
        }
    });

    const btn = document.getElementById('btn-confirm-to-sheet');
    ui.setBtnLoading(btn, true);
    try {
        await api.updateGSheet(spreadsheetId, `A${currentConfirmRow.index + 1}`, [updatedRow]);

        // 3. Gerir Comentário e Cor nativamente
        const comment = document.getElementById('input-confirm-comment')?.value || '';
        if (statusIdx !== -1) {
            try {
                const rawSheetName = api.state.confirm.range.split('!')[0] || 'Folha1';
                const cleanSheetName = rawSheetName.replace(/'/g, '');
                
                // Amarelo se tiver nota, Branco se estiver vazio
                const cellColor = comment.trim() !== '' ? 'yellow' : 'clear';
                
                await api.updateGSheetNote(currentProjectSheetId, cleanSheetName, currentConfirmRow.index, statusIdx, comment.trim(), cellColor);
            } catch (noteErr) {
                console.error("Erro ao gravar nota/cor nativa:", noteErr);
                ui.toast("Aviso: O status foi gravado, mas falhou ao atualizar a NOTA/cor na célula.", "warning");
            }
        }

        ui.closeModal('modal-confirm-action');

        
        // Recarregar a lista atual e forçar a vista para 'PENDENTE'
        if (currentProjectSheetId) {
            const data = await api.readGSheet(currentProjectSheetId);
            const filterEl = document.getElementById('confirm-status-filter');
            if (filterEl) filterEl.value = 'PENDENTE';
            ui.renderConfirmList(data, "", "PENDENTE");
            ui.showView('view-confirm-table');
        }
    } catch (err) { ui.toast("Erro ao gravar: " + err.message, "error"); }
    finally { ui.setBtnLoading(btn, false); }
}

