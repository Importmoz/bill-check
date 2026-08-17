/**
 * Ponto de Entrada - Bill Check (Modularizado)
 */
import { initializeApp } from './init.js?v=20260817_1';
import * as api from './api.js?v=20260817_1';
import * as ui from './ui.js?v=20260817_1';
import * as utils from './utils.js?v=20260817_1';

const { state, pb } = api;

// --- EXPOSIÇÃO GLOBAL (Compatibilidade com onclick no HTML) ---
window.ui = ui;
window.api = api;
window.handleLogin = handleLogin;

// Inicialização da aplicação (Sendo um módulo, o código corre apenas uma vez e após o parse do DOM)
(async () => {
    if (window.__APP_LOADED__) return;
    window.__APP_LOADED__ = true;

    ui.setLoader(true);
    try {
        await initializeApp();
        
        // Iniciar verificador de actualizações da versão do sistema
        startSystemVersionChecker();
        
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
window.closeConfirmActionModal = closeConfirmActionModal;
window.showFilePreview = ui.showFilePreview;
window.autoOpenClientFolder = autoOpenClientFolder;
window.handleCreateFolder = handleCreateFolder;
window.handleFileUpload = handleFileUpload;
window.triggerFileUpload = triggerFileUpload;
window.showBank = showBank;

// --- LÓGICA DE APLICAÇÃO ---

async function showBank() {
    if (!checkModulePermission('EXTRACTOS')) return ui.toast('Acesso negado ao módulo EXTRACTOS.', 'error');
    await ui.showBankDashboard();
}

async function showSettings() {
    // Apenas ADMIN pode aceder às definições
    const role = api.pb.authStore.model?.role;
    if (role !== 'ADMIN') {
        ui.toast('Acesso negado. Apenas administradores podem aceder às definições.', 'error');
        return;
    }
    ui.showView('view-settings');
    await ui.loadSettingsUsers();
}
window.showSettings = showSettings;

// --- MÓDULO DEFINIÇÕES (USERS) LÓGICA ---

window.editUser = function(id) {
    ui.openUserModal(id);
};

window.deleteUser = async function(id, name) {
    if (!confirm(`Tem a certeza que deseja APAGAR o utilizador "${name}"?\nEsta ação não pode ser desfeita.`)) return;
    
    ui.setLoader(true, "A apagar utilizador...");
    try {
        await api.deleteSettingsUser(id);
        ui.toast("Utilizador apagado com sucesso!", "success");
        await ui.loadSettingsUsers();
    } catch (err) {
        console.error(err);
        ui.toast("Erro ao apagar utilizador: " + err.message, "error");
    } finally {
        ui.setLoader(false);
    }
};

window.saveUser = async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('user-id').value;
    const name = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    
    const checkboxes = document.querySelectorAll('#user-permissions input[type="checkbox"]:checked');
    const permissions = Array.from(checkboxes).map(cb => cb.value);
    
    const data = { name, role, permissions };
    if (!id) {
        data.email = email;
    }
    if (password) data.password = password;
    
    const btn = document.getElementById('btn-save-user');
    ui.setBtnLoading(btn, true, "A gravar...");
    
    try {
        if (id) {
            await api.updateSettingsUser(id, data);
            ui.toast("Utilizador atualizado com sucesso!", "success");
        } else {
            if (!password) throw new Error("A senha é obrigatória para novos utilizadores.");
            await api.createSettingsUser(data);
            ui.toast("Utilizador criado com sucesso!", "success");
        }
        ui.closeUserModal();
        await ui.loadSettingsUsers();
    } catch (err) {
        console.error(err);
        ui.toast("Erro ao gravar utilizador: " + err.message, "error");
    } finally {
        ui.setBtnLoading(btn, false);
    }
};

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
    const btn = document.getElementById('btn-global-news');
    if (btn) btn.remove();
    ui.showView('view-login');
}

function checkModulePermission(moduleName) {
    const user = api.pb.authStore.model;
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    const perms = user.permissions || [];
    return perms.includes(moduleName);
}

/**
 * Mostra o Dashboard Principal (Menu de Módulos)
 */
async function showHub() {
    ui.setLoader(true);
    try {
        ui.showView('view-hub');
        
        // RBAC: Mostrar/Ocultar Módulos
        const user = api.pb.authStore.model;
        if (user) {
            const role = user.role || 'USER';
            const permissions = user.permissions || [];
            
            const modules = ['BILL', 'FINANCE', 'TEAM', 'TERM', 'CONFIRM', 'EXTRACTOS', 'QUOTE'];
            modules.forEach(mod => {
                const card = document.getElementById(`card-module-${mod}`);
                if (card) {
                    if (role === 'ADMIN' || permissions.includes(mod)) {
                        card.classList.remove('hidden');
                    } else {
                        card.classList.add('hidden');
                    }
                }
            });
            
            const settingsCard = document.getElementById('card-module-SETTINGS');
            if (settingsCard) {
                if (role === 'ADMIN') {
                    settingsCard.classList.remove('hidden');
                } else {
                    settingsCard.classList.add('hidden');
                }
            }
        }
        if (window.__SYSTEM_VERSION__) {
            ui.checkAndShowNewsIcon(window.__SYSTEM_VERSION__);
        }
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
    if (!checkModulePermission('FINANCE')) return ui.toast('Acesso negado ao módulo FINANCE.', 'error');
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
    if (document.getElementById('view-finance').classList.contains('hidden')) return;

    const icon = document.getElementById('finance-refresh-icon');
    if (icon) icon.classList.add('animate-spin');

    try {
        await api.fetchFinanceData();
        ui.renderFinanceDashboard(deleteFinanceGroup, removeFinanceSheet, null, renameFinanceGroup);
    } catch (err) {
        console.warn("Falha ao atualizar dados financeiros do Confirm:", err);
    } finally {
        if (icon) icon.classList.remove('animate-spin');
    }
}

async function handleManualFinanceRefresh() {
    const btn = document.getElementById('btn-finance-refresh');
    ui.setBtnLoading(btn, true, "A actualizar...");
    ui.setLoader(true, "A sincronizar dados com Confirm...");
    try {
        await refreshAllFinanceSheets();
        ui.toast("Painel Financeiro atualizado!", "success");
    } finally {
        ui.setLoader(false);
        ui.setBtnLoading(btn, false);
    }
}

// Modais e Acções Financeiras (Integradas ao Confirm)
function openFinanceSheetModal() {
    openConfirmProjectModal();
}

async function addFinanceSheet() {
    openConfirmProjectModal();
    ui.closeModal('modal-finance-sheet');
}

async function removeFinanceSheet(id) {
    if (!confirm("Deseja ocultar este projeto da visualização do Finance? (O projeto no Confirm não será apagado)")) return;
    ui.setLoader(true);
    try {
        await api.deleteFinanceSheet(id);
        ui.toast("Projeto ocultado do Finance.", "success");
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
    if (!checkModulePermission('BILL')) return ui.toast('Acesso negado ao módulo BILL.', 'error');
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
    if (!checkModulePermission('TEAM')) return ui.toast('Acesso negado ao módulo TEAM.', 'error');
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
    if (!checkModulePermission('TERM')) return ui.toast('Acesso negado ao módulo TERM.', 'error');
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
    if (!checkModulePermission('CONFIRM')) return ui.toast('Acesso negado ao módulo CONFIRM.', 'error');
    ui.showView('view-confirm-dashboard');
    loadConfirmProjects();
}

async function loadConfirmProjects() {
    try {
        const role = api.pb.authStore.model?.role || 'USER';
        const btnNewProject = document.querySelector('button[onclick="openConfirmProjectModal()"]');
        if (btnNewProject) {
            btnNewProject.style.display = role === 'ADMIN' ? 'flex' : 'none';
        }
        const projects = await api.getConfirmProjects();
        if (!state.confirm) state.confirm = {};
        state.confirm.projects = projects;
        ui.renderConfirmProjects(projects);
    } catch (err) {
        console.error("Erro ao carregar projetos:", err);
    }
}

async function openConfirmProjectModal(projectId = null) {
    const role = api.pb.authStore.model?.role || 'USER';
    if (role !== 'ADMIN') {
        ui.toast("Acesso Negado: A criação/edição de projetos exige permissões de Administrador.", "error");
        return;
    }

    const title = document.getElementById('confirm-project-modal-title');
    const idInput = document.getElementById('input-project-id');
    const nameInput = document.getElementById('input-project-name');
    const sheetInput = document.getElementById('input-project-sheet-id');
    const driveInput = document.getElementById('input-project-drive-id');
    const dischargeInput = document.getElementById('input-project-discharge-date');
    const delContainer = document.getElementById('confirm-project-delete-container');

    if (projectId) {
        title.innerText = "EDITAR PROJETO";
        idInput.value = projectId;
        if (delContainer) delContainer.classList.remove('hidden');
        
        let p = state.confirm?.projects?.find(x => x.id === projectId);
        if (!p) {
            try {
                p = await api.pb.collection('confirm_projects').getOne(projectId);
            } catch (err) {
                console.error("Erro ao carregar dados do projeto no PocketBase:", err);
            }
        }

        if (p) {
            nameInput.value = p.name || p.title || '';
            sheetInput.value = p.sheetId || p.sheet_id || '';
            driveInput.value = p.folderId || p.folder_id || '';
            
            // Prefill discharge date
            let dDate = p.dischargeDate || p.discharge_date || '';
            const currentSheetId = p.sheetId || p.sheet_id;
            if (!dDate && state.confirm && state.confirm.sheetId === currentSheetId && state.confirm.dischargeDate) {
                dDate = state.confirm.dischargeDate;
            }
            if (dDate) {
                if (dDate.includes('T')) dDate = dDate.split('T')[0];
                dischargeInput.value = dDate;
            } else {
                dischargeInput.value = '';
            }
        }
    } else {
        title.innerText = "NOVO PROJETO";
        idInput.value = "";
        nameInput.value = "";
        sheetInput.value = "";
        driveInput.value = "";
        dischargeInput.value = "";
        if (delContainer) delContainer.classList.add('hidden');
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

    const dischargeDate = document.getElementById('input-project-discharge-date').value;
    const data = {
        id: document.getElementById('input-project-id').value,
        name: document.getElementById('input-project-name').value.trim(),
        sheetId: extractId(document.getElementById('input-project-sheet-id').value),
        folderId: extractId(document.getElementById('input-project-drive-id').value),
        dischargeDate: dischargeDate || '' // Gravar no PocketBase
    };

    if (!data.name || !data.sheetId) return ui.toast("Nome e ID da Folha são obrigatórios.", "error");

    const btn = document.getElementById('btn-confirm-project-save');
    ui.setBtnLoading(btn, true);
    try {
        await api.saveConfirmProject(data);
        
        // Gravar a data de descarga na planilha (fallback / redundância)
        if (data.sheetId) {
            const noteText = dischargeDate ? `DISCHARGE_DATE:${dischargeDate}` : '';
            await api.updateGSheetNote(data.sheetId, "", 0, 0, noteText);
            
            if (state.confirm && state.confirm.sheetId === data.sheetId) {
                state.confirm.dischargeDate = dischargeDate;
                
                // Forçar atualização do estado em memória e ecrã de detalhes se estiver aberto
                if (window.currentActiveClient) {
                    await showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
                }
            }
        }

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
    // Registar o acesso do projeto para o ranking
    if (sheetId && typeof ui.registerProjectAccess === 'function') {
        ui.registerProjectAccess(sheetId, projectName);
    }
    ui.setLoader(true);
    currentProjectSheetId = sheetId; // Guardar para recarregar depois
    
    // Atualizar título da página
    const nameEl = document.getElementById('confirm-project-active-name');
    if (nameEl) nameEl.innerText = projectName;

    try {
        const projectRecord = state.confirm?.projects?.find(x => x.sheetId === sheetId);
        const data = await api.readGSheet(projectRecord || sheetId);
        
        // Extrair Data de Descarga do PocketBase ou da nota da célula A1 se existir
        state.confirm.dischargeDate = '';
        if (projectRecord && projectRecord.dischargeDate) {
            state.confirm.dischargeDate = projectRecord.dischargeDate;
            console.log(`[WAREHOUSE] Data de Descarga carregada do PocketBase: ${state.confirm.dischargeDate}`);
        } else if (state.confirm && state.confirm.notes && state.confirm.notes[0] && state.confirm.notes[0][0]) {
            const note = state.confirm.notes[0][0];
            if (note.startsWith("DISCHARGE_DATE:")) {
                state.confirm.dischargeDate = note.replace("DISCHARGE_DATE:", "").trim();
                console.log(`[WAREHOUSE] Data de Descarga carregada da planilha (fallback): ${state.confirm.dischargeDate}`);
            }
        }
        
        const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
        ui.renderConfirmList(data, "", statusFilter);
        
        // Reconstruir locks ativos a partir dos eventos recentes (últimos 5 minutos)
        try {
            const recentEvents = await api.getRecentConfirmEvents(sheetId);
            window.activeConfirmLocks = {};
            const now = Date.now();
            recentEvents.forEach(record => {
                const row = Number(record.row_index);
                const type = record.type;
                const userId = record.user;
                const recordTime = new Date(record.created).getTime();
                
                // Ignorar se já passou de 5 minutos
                if (now - recordTime > 5 * 60 * 1000) return;
                
                if (type === 'LOCK') {
                    window.activeConfirmLocks[row] = {
                        user: record.payload?.name || 'Outro utilizador',
                        userId: userId,
                        timestamp: recordTime
                    };
                } else if (type === 'UNLOCK') {
                    if (window.activeConfirmLocks[row] && window.activeConfirmLocks[row].userId === userId) {
                        delete window.activeConfirmLocks[row];
                    }
                } else if (type === 'UPDATE') {
                    delete window.activeConfirmLocks[row];
                }
            });
        } catch (err) {
            console.warn("Erro ao reconstruir locks recentes:", err);
        }
        
        // Subscrever eventos realtime para este GSheet
        if (typeof api.subscribeConfirmEvents === 'function' && typeof ui.handleConfirmRealtimeEvent === 'function') {
            api.subscribeConfirmEvents(sheetId, ui.handleConfirmRealtimeEvent);
        }

        // Subscrever eventos de banco em tempo real
        if (typeof api.subscribeBankEvents === 'function' && typeof ui.handleBankRealtimeEvent === 'function') {
            api.subscribeBankEvents(ui.handleBankRealtimeEvent);
        }

        // Iniciar polling de atualizações externas da planilha
        startGSheetPolling(sheetId);
        
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

    // Função de normalização/canonicalização para correspondência ultra-robusta de nomes
    const canonicalize = (str) => {
        return String(str || '')
            .normalize('NFD')                     // Separar acentos dos caracteres base
            .replace(/\p{Diacritic}/gu, '')      // Remover todos os acentos
            .toUpperCase()                       // Converter para maiúsculas
            .replace(/[^A-Z0-9]/g, ' ')          // Substituir tudo o que não for alfanumérico por espaço
            .replace(/\s+/g, ' ')                // Colapsar múltiplos espaços
            .trim();
    };

    // Limpar o código de eventuais decimais (.0) que vêm do Excel
    const cleanCode = String(clientCode).split('.')[0].split(',')[0].trim();
    const targetPattern = canonicalize(`${cleanCode} ${clientName}`);

    console.log(`[AUTO-DRIVE] Tentando abertura instantânea (padrão canónico): "${targetPattern}"`);

    // Mostrar loader imediatamente
    const explorerContainer = document.getElementById('confirm-drive-files');
    if (explorerContainer) explorerContainer.innerHTML = '<div class="p-4 text-center text-xs animate-pulse font-bold text-gray-400">A LOCALIZAR PASTA...</div>';

    // Tentar usar o cache primeiro para ser instantâneo
    let targetFolder = null;
    if (projectFoldersCache) {
        targetFolder = projectFoldersCache.find(f => {
            const folderName = canonicalize(f.name);
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
            const folderName = canonicalize(f.name);
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
    const role = api.pb.authStore.model?.role || 'USER';
    if (role === 'USER' || role === 'USER_L1') {
        ui.toast("Acesso Negado: A alteração manual de estado exige nível de permissão Nível 2 ou superior.", "error");
        return;
    }

    console.log("[DEBUG-ONCONFIRM] Called onConfirmRow for rowIndex=" + rowIndex);
    // Limpar locks expirados (mais de 5 minutos)
    const now = Date.now();
    if (window.activeConfirmLocks) {
        Object.keys(window.activeConfirmLocks).forEach(r => {
            if (now - window.activeConfirmLocks[r].timestamp > 5 * 60 * 1000) {
                delete window.activeConfirmLocks[r];
            }
        });
    }

    if (window.activeConfirmLocks && window.activeConfirmLocks[rowIndex]) {
        const lockInfo = window.activeConfirmLocks[rowIndex];
        if (lockInfo.userId !== api.pb.authStore.model?.id) {
            ui.toast(`Este registo está a ser editado por ${lockInfo.user}`, 'warning');
            return;
        }
    }
    
    // Emit Lock Event
    if (api.state.confirm && api.state.confirm.sheetId) {
        api.emitConfirmEvent(api.state.confirm.sheetId, rowIndex, 'LOCK', { name: api.pb.authStore.model?.name || 'Utilizador' });
    }

    currentConfirmRow = { index: rowIndex, data: rowData };
    const columns = api.state.confirm.columns;

    const cleanString = (str) => String(str || '')
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]/g, "")
        .trim();

    const findCol = (targets) => {
        const cleanedTargets = targets.map(cleanString);
        for (const target of cleanedTargets) {
            const idx = columns.findIndex(c => cleanString(c) === target);
            if (idx !== -1) return idx;
        }
        for (const target of cleanedTargets) {
            const idx = columns.findIndex(c => cleanString(c).includes(target));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const idCodeIdx = findCol(['ID CODE', 'CODE ID', 'ID']);
    const statusIdx = findCol(['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);
    
    document.getElementById('confirm-action-title').textContent = `CONFIRMAR: ${rowData[idCodeIdx] || 'Registo'}`;
    
    let currentStatus = rowData[statusIdx] || 'PENDENTE';
    if (String(currentStatus).trim() === '?') {
        currentStatus = 'PENDENTE';
    }
    const selectStatus = document.getElementById('select-confirm-status');
    if (selectStatus) {
        selectStatus.value = currentStatus;
        document.getElementById('input-confirm-comment-container')?.classList.toggle('hidden', currentStatus === 'CONFIRMADO');
    }
    
    const datesContainer = document.getElementById('payment-dates-inputs');
    if (datesContainer) {
        datesContainer.innerHTML = '';
        ['PAG 1', 'PAG 2', 'PAG 3'].forEach(label => {
            const idx = findCol([label]);
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
    if (commentInput) {
        let confirmNote = '';
        // Procurar por qualquer nota de confirmação não vazia nas ordens do cliente ativo
        if (window.currentActiveClient && window.currentActiveClient.rows) {
            const rowWithNote = window.currentActiveClient.rows.find(r => r.confirmNote && r.confirmNote.trim() !== '');
            if (rowWithNote) {
                confirmNote = rowWithNote.confirmNote.trim();
            }
        }
        // Fallback para a nota da própria linha caso não tenha no cliente ativo
        if (!confirmNote) {
            const rowNotes = (api.state.confirm.notes && api.state.confirm.notes[rowIndex]) ? api.state.confirm.notes[rowIndex] : [];
            confirmNote = statusIdx !== -1 ? String(rowNotes[statusIdx] || '').trim() : '';
        }
        commentInput.value = confirmNote;
    }

    ui.openModal('modal-confirm-action');
}

function closeConfirmActionModal() {
    ui.closeModal('modal-confirm-action');
    const sheetId = currentProjectSheetId || (api.state.confirm && api.state.confirm.sheetId);
    if (currentConfirmRow && currentConfirmRow.index !== undefined && sheetId) {
        api.emitConfirmEvent(sheetId, currentConfirmRow.index, 'UNLOCK');
    }
}

async function saveConfirmToSheet() {
    if (!currentConfirmRow) return;
    
    const columns = api.state.confirm.columns;
    const spreadsheetId = currentProjectSheetId;

    const cleanString = (str) => String(str || '')
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]/g, "")
        .trim();

    const findCol = (targets) => {
        const cleanedTargets = targets.map(cleanString);
        for (const target of cleanedTargets) {
            const idx = columns.findIndex(c => cleanString(c) === target);
            if (idx !== -1) return idx;
        }
        for (const target of cleanedTargets) {
            const idx = columns.findIndex(c => cleanString(c).includes(target));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const statusIdx = findCol(['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);
    if (statusIdx === -1) {
        ui.toast("Erro: Coluna de Confirmação não encontrada no GSheet.", "error");
        ui.setLoader(false);
        return;
    }

    let selectedStatus = document.getElementById('select-confirm-status').value;
    const updatedRow = [...currentConfirmRow.data];

    const paidIdx = columns.findIndex((c, i) => {
        const h = cleanString(c);
        return (h.includes('PAID') || h.includes('PAGO')) && !h.includes('PREPAID') && !h.includes('DUTY');
    });
    const amtDutyIdx = findCol(['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
    const balanceIdx = findCol(['BALANCE', 'SALDO', 'BALANCO']);

    const amountDutyVal = amtDutyIdx !== -1 ? (parseFloat(String(currentConfirmRow.data[amtDutyIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0) : 0;

    if (selectedStatus === 'CONFIRMADO') {
        if (paidIdx !== -1) updatedRow[paidIdx] = amountDutyVal;
        if (balanceIdx !== -1) updatedRow[balanceIdx] = 0;
    } else if (selectedStatus === 'PENDENTE') {
        if (paidIdx !== -1) updatedRow[paidIdx] = '';
        if (balanceIdx !== -1) updatedRow[balanceIdx] = amountDutyVal;
    } else if (selectedStatus === 'PARCIAL' && balanceIdx !== -1) {
        const paidVal = paidIdx !== -1 ? (parseFloat(String(updatedRow[paidIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0) : 0;
        updatedRow[balanceIdx] = Math.max(0, amountDutyVal - paidVal);
    }

    updatedRow[statusIdx] = selectedStatus;
    
    // 2. Mapear datas de pagamento (PAG 1, PAG 2, PAG 3)
    // Agora salvamos as datas independentemente do status
    ['PAG 1', 'PAG 2', 'PAG 3'].forEach(label => {
        const idx = findCol([label]);
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
        if (window.activeConfirmLocks && window.activeConfirmLocks[currentConfirmRow.index]) {
            const lockInfo = window.activeConfirmLocks[currentConfirmRow.index];
            if (lockInfo.userId !== api.pb.authStore.model?.id) {
                ui.toast(`Este registo está a ser editado por ${lockInfo.user}`, 'warning');
                ui.closeModal('modal-confirm-action');
                ui.setBtnLoading(btn, false);
                return;
            }
        }

        let rawSheetName = 'Folha1';
        if (api.state.confirm.range && api.state.confirm.range.includes('!')) {
            rawSheetName = api.state.confirm.range.split('!')[0];
        }
        const cleanSheetName = rawSheetName.replace(/'/g, '');
        const targetRowIndex = currentConfirmRow.index;
        const rowNum = targetRowIndex + 1;

        // Criar lote para atualizar apenas as células modificadas
        const getColLetter = (idx) => {
            let colLetter = '';
            while (idx >= 0) {
                colLetter = String.fromCharCode(65 + (idx % 26)) + colLetter;
                idx = Math.floor(idx / 26) - 1;
            }
            return colLetter;
        };

        const batchUpdates = [];
        if (paidIdx !== -1) {
            batchUpdates.push({
                range: `${cleanSheetName}!${getColLetter(paidIdx)}${rowNum}`,
                values: [[updatedRow[paidIdx]]]
            });
        }
        // if (balanceIdx !== -1) {
        //     batchUpdates.push({
        //         range: `${cleanSheetName}!${getColLetter(balanceIdx)}${rowNum}`,
        //         values: [[updatedRow[balanceIdx]]]
        //     });
        // }
        if (statusIdx !== -1) {
            batchUpdates.push({
                range: `${cleanSheetName}!${getColLetter(statusIdx)}${rowNum}`,
                values: [[updatedRow[statusIdx]]]
            });
        }

        // PAG 1, PAG 2, PAG 3
        ['PAG 1', 'PAG 2', 'PAG 3'].forEach(label => {
            const idx = findCol([label]);
            if (idx !== -1) {
                batchUpdates.push({
                    range: `${cleanSheetName}!${getColLetter(idx)}${rowNum}`,
                    values: [[updatedRow[idx]]]
                });
            }
        });

        await api.updateGSheetBatch(spreadsheetId, batchUpdates);

        // 3. Gerir Comentário e Cor nativamente
        const comment = document.getElementById('input-confirm-comment')?.value || '';
        if (statusIdx !== -1) {
            try {
                
                // Encontrar o índice da primeira linha (ordem) do cliente ativo
                let targetRowIndex = currentConfirmRow.index;
                if (window.currentActiveClient && window.currentActiveClient.rows && window.currentActiveClient.rows.length > 0) {
                    const sortedRows = [...window.currentActiveClient.rows].sort((a, b) => a.originalIndex - b.originalIndex);
                    targetRowIndex = sortedRows[0].originalIndex;
                }
                
                // Define a cor: Amarelo se tiver comentário, Branco se estiver vazio
                const cellColor = comment.trim() !== '' ? 'yellow' : 'clear';
                
                // Gravar a nota apenas no targetRowIndex (primeira linha do cliente)
                await api.updateGSheetNote(currentProjectSheetId, cleanSheetName, targetRowIndex, statusIdx, comment.trim(), cellColor);
                
                // Atualizar estado local
                if (!api.state.confirm.notes) api.state.confirm.notes = [];
                if (!api.state.confirm.notes[targetRowIndex]) api.state.confirm.notes[targetRowIndex] = [];
                api.state.confirm.notes[targetRowIndex][statusIdx] = comment.trim();
                
                // Se a linha editada for diferente da primeira, limpamos a nota dela para evitar duplicação no GSheet
                if (targetRowIndex !== currentConfirmRow.index) {
                    await api.updateGSheetNote(currentProjectSheetId, cleanSheetName, currentConfirmRow.index, statusIdx, '', 'clear');
                    if (api.state.confirm.notes[currentConfirmRow.index]) {
                        api.state.confirm.notes[currentConfirmRow.index][statusIdx] = '';
                    }
                }
            } catch (noteErr) {
                console.error("Erro ao gravar nota/cor nativa:", noteErr);
                ui.toast("Aviso: O status foi gravado, mas falhou ao atualizar a NOTA/cor na célula.", "warning");
            }
        }

        ui.closeModal('modal-confirm-action');

        // Emissão do evento de update e unlock no real-time
        if (spreadsheetId && currentConfirmRow) {
            await api.emitConfirmEvent(spreadsheetId, currentConfirmRow.index, 'UPDATE', {
                status: selectedStatus,
                rowData: updatedRow,
                name: api.pb.authStore.model?.name || 'Utilizador'
            });
            await api.emitConfirmEvent(spreadsheetId, currentConfirmRow.index, 'UNLOCK');
        }
        
        // Atualizar estado local com os novos dados da linha de forma síncrona
        if (api.state.confirm && api.state.confirm.data) {
            api.state.confirm.data[currentConfirmRow.index] = updatedRow;
        }

        // Atualizar a lista localmente de forma instantânea
        const filterEl = document.getElementById('confirm-status-filter');
        if (filterEl) filterEl.value = 'PENDENTE';
        ui.renderConfirmList(api.state.confirm.data, "", "PENDENTE");
        ui.showView('view-confirm-table');
    } catch (err) { ui.toast("Erro ao gravar: " + err.message, "error"); }
    finally { ui.setBtnLoading(btn, false); }
}

// --- POLLING GOOGLE SHEETS METADATA ---
let gsheetPollingInterval = null;
let gsheetPollingActive = false;

function startGSheetPolling(spreadsheetId) {
    stopGSheetPolling();
    gsheetPollingActive = false;
    
    console.log(`[POLLING] Iniciando verificação de atualizações para o GSheet: ${spreadsheetId}`);
    gsheetPollingInterval = setInterval(async () => {
        if (gsheetPollingActive) {
            console.log("[POLLING] Ignorando verificação: leitura anterior ainda activa.");
            return;
        }

        const isConfirmTableVisible = !document.getElementById('view-confirm-table')?.classList.contains('hidden');
        const isClientDetailVisible = !document.getElementById('view-confirm-client-detail')?.classList.contains('hidden');
        
        if (!isConfirmTableVisible && !isClientDetailVisible) {
            return;
        }

        const editModal = document.getElementById('confirm-edit-modal');
        if (editModal && !editModal.classList.contains('hidden')) {
            return;
        }

        try {
            gsheetPollingActive = true;
            
            const lastTime = api.state.confirm.lastModifiedTime;
            const res = await fetch('/api/google/sheet/check-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spreadsheetId, lastModifiedTime: lastTime })
            });
            if (res.ok) {
                const checkData = await res.json();
                console.log(`[POLLING-DEBUG] lastTime enviado: ${lastTime} | Drive modifiedTime: ${checkData.modifiedTime} | updated: ${checkData.updated}`);
                
                // Se estávamos offline ou com alterações pendentes e o Google Sheets respondeu, sincronizar automaticamente!
                if (api.state.confirm.hasPendingSync) {
                    console.log("[POLLING] Google Sheets reconectado! Sincronizando alterações pendentes do PocketBase...");
                    try {
                        await api.syncPendingChangesToGSheet();
                        ui.toast("Google Sheets reconectado! Alterações sincronizadas com sucesso. ✅", "success");
                    } catch (syncErr) {
                        console.warn("[POLLING] Erro ao sincronizar automaticamente com Google Sheets:", syncErr.message);
                    }
                }

                if (checkData.updated) {
                    console.log(`[POLLING] Planilha modificada externamente! Novo modifiedTime: ${checkData.modifiedTime}. Recarregando silenciosamente...`);
                    
                    // Sincronizar o lastModifiedTime local de imediato para evitar que a próxima iteração use a data antiga
                    api.state.confirm.lastModifiedTime = checkData.modifiedTime;
                    
                    const projectRecord = api.state.confirm?.projects?.find(x => x.id === api.state.confirm.projectId) || spreadsheetId;
                    const freshData = await api.readGSheet(projectRecord, 'A1:AZ1000', true);
                    
                    // Atualiza a tabela principal se activa
                    if (isConfirmTableVisible) {
                        const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
                        const searchEl = document.getElementById('input-confirm-search');
                        const searchText = searchEl?.value || '';
                        ui.renderConfirmList(freshData, searchText, statusFilter);
                    }
                    
                    // Se estiver no detalhe do cliente ativo, atualiza suas ordens
                    if (isClientDetailVisible && window.currentActiveClient) {
                        const clientIndex = window.currentActiveClientIndex;
                        const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
                        const searchEl = document.getElementById('input-confirm-search');
                        const searchText = searchEl?.value || '';
                        ui.renderConfirmList(freshData, searchText, statusFilter);
                        
                        const freshClient = api.state.confirm.groupedClients?.find(c => 
                            (c.groupId && window.currentActiveClient.groupId && c.groupId === window.currentActiveClient.groupId) || 
                            (c.displayIdCode && c.displayIdCode === window.currentActiveClient.displayIdCode)
                        );
                        if (freshClient) {
                            console.log("[POLLING] Comparando e atualizando pontualmente faturas do cliente ativo:", freshClient.groupId);
                            
                            // Atualizar apenas as faturas/ordens que sofreram alterações reais no GSheet
                            if (window.currentActiveClient.rows && freshClient.rows) {
                                freshClient.rows.forEach(newRow => {
                                    const oldRow = window.currentActiveClient.rows.find(r => r.originalIndex === newRow.originalIndex);
                                    if (oldRow) {
                                        const hasChanged = JSON.stringify(oldRow.originalRow) !== JSON.stringify(newRow.originalRow);
                                        if (hasChanged) {
                                            console.log(`[POLLING] Linha ${newRow.originalIndex} modificada. Atualizando suavemente no DOM.`);
                                            ui.updateConfirmDetailRow(newRow.originalIndex, newRow.originalRow);
                                        }
                                    }
                                });
                            }
                            
                            // Manter a referência sincronizada na memória
                            window.currentActiveClient = freshClient;
                        }
                    }
                }
            } else {
                console.warn(`[POLLING] Falha na resposta da API check-update. Status: ${res.status}`);
            }
        } catch (pollErr) {
            console.warn("[POLLING] Erro ao verificar atualizações do GSheet:", pollErr);
        } finally {
            gsheetPollingActive = false;
        }
    }, 5000);
}

function stopGSheetPolling() {
    if (gsheetPollingInterval) {
        console.log("[POLLING] Parando polling de atualizações.");
        clearInterval(gsheetPollingInterval);
        gsheetPollingInterval = null;
    }
}

window.stopGSheetPolling = stopGSheetPolling;

// --- MÓDULO DE COTAÇÕES (QUOTE) CONTROLLER ---

async function showQuoteDashboard() {
    if (!checkModulePermission('QUOTE')) return ui.toast('Acesso negado ao módulo QUOTE.', 'error');
    ui.setLoader(true, "A carregar cotações e câmbio...");
    try {
        await api.listQuotes();
        
        // Carrega as moedas e taxas
        api.state.cambios = await api.listCambios();
        ui.renderCambioSelect();
        
        // Carrega a pauta se ainda não estiver carregada
        if (!api.state.pauta) {
            const loader = document.getElementById('pauta-loader');
            if (loader) loader.classList.remove('hidden');
            await api.loadPautaData();
            if (loader) loader.classList.add('hidden');
        }

        ui.showView('view-quote-dashboard');
        ui.renderQuoteDashboard();
    } catch (err) {
        console.error(err);
        ui.toast("Erro ao abrir módulo de cotações.", "error");
    } finally {
        ui.setLoader(false);
    }
}

function showQuoteForm(id) {
    if (!checkModulePermission('QUOTE')) return ui.toast('Acesso negado ao módulo QUOTE.', 'error');
    // For single-item compatibility, just load the saved quote which now opens the overlay
    if (id) {
        ui.loadSavedQuote(id);
    } else {
        ui.startNewQuote();
    }
}

function changeQuoteType() {
    const type = document.getElementById('input-quote-type')?.value || 'TRANSPORTE';
    
    const transportSection = document.getElementById('section-form-transport');
    const importSection = document.getElementById('section-form-import');
    
    if (type === 'TRANSPORTE') {
        transportSection?.classList.remove('hidden');
        importSection?.classList.add('hidden');
    } else if (type === 'IMPORTACAO') {
        transportSection?.classList.add('hidden');
        importSection?.classList.remove('hidden');
    } else if (type === 'GLOBAL') {
        transportSection?.classList.remove('hidden');
        importSection?.classList.remove('hidden');
    }
    
    handleQuoteFieldChange();
}

function handleQuoteFieldChange() {
    ui.updateQuotePreview();
}

function handleQuoteSearch() {
    ui.renderQuoteDashboard();
}

async function handleSaveQuote() {
    const id = document.getElementById('input-quote-id').value;
    const client = document.getElementById('input-quote-client').value.trim();
    const cargo = document.getElementById('input-quote-cargo').value.trim();
    const type = document.getElementById('input-quote-type').value;
    const status = document.getElementById('input-quote-status').value;
    const number = document.getElementById('input-quote-number').value.trim();
    const rate = parseFloat(document.getElementById('input-quote-rate').value) || 63.90;
    const terms = document.getElementById('input-quote-terms').value;

    if (!client || !cargo) {
        return ui.toast("Por favor preencha o Nome do Cliente e a Descrição da Carga.", "error");
    }

    const payload = {
        exchange_rate: rate,
        terms: terms
    };

    if (type === 'TRANSPORTE' || type === 'GLOBAL') {
        payload.origin = document.getElementById('input-trans-origin').value.trim();
        payload.destination = document.getElementById('input-trans-dest').value.trim();
        payload.cbm = parseFloat(document.getElementById('input-trans-cbm').value) || 0;
        payload.weight = parseFloat(document.getElementById('input-trans-weight').value) || 0;
        payload.container_type = document.getElementById('input-trans-container').value.trim();
        payload.freight_cost = parseFloat(document.getElementById('input-trans-freight-cost').value) || 0;
        payload.origin_fees = parseFloat(document.getElementById('input-trans-origin-fees').value) || 0;
        payload.local_fees = parseFloat(document.getElementById('input-trans-local-fees').value) || 0;
        payload.agent_fees = parseFloat(document.getElementById('input-trans-agent-fees').value) || 0;
        payload.margin_pct = parseFloat(document.getElementById('input-trans-margin').value) || 0;
    }

    if (type === 'IMPORTACAO' || type === 'GLOBAL') {
        payload.cif_cost = parseFloat(document.getElementById('input-imp-cif').value) || 0;
        payload.duties_pct = parseFloat(document.getElementById('input-imp-duties-pct').value) || 0;
        payload.iva_pct = parseFloat(document.getElementById('input-imp-iva-pct').value) || 0;
        payload.tsp_fees = parseFloat(document.getElementById('input-imp-tsp-fees').value) || 0;
        payload.clearing_fees = parseFloat(document.getElementById('input-imp-clearing-fees').value) || 0;
        payload.port_fees = parseFloat(document.getElementById('input-imp-port-fees').value) || 0;
        payload.import_margin_pct = parseFloat(document.getElementById('input-imp-margin').value) || 0;
    }

    const computedTotal = parseFloat(document.getElementById('view-quote-form').dataset.computedTotal) || 0;

    const quoteData = {
        client_name: client,
        cargo_description: cargo,
        type: type,
        status: status,
        quote_number: number,
        total_amount: computedTotal,
        payload: payload
    };

    if (id) {
        quoteData.id = id;
    }

    const btn = document.getElementById('btn-save-quote');
    ui.setBtnLoading(btn, true, "A gravar...");
    ui.setLoader(true, "A gravar cotação...");

    try {
        await api.saveQuote(quoteData);
        ui.toast("Cotação gravada com sucesso!", "success");
        await showQuoteDashboard();
    } catch (err) {
        console.error(err);
        ui.toast("Erro ao gravar cotação: " + err.message, "error");
    } finally {
        ui.setLoader(false);
        ui.setBtnLoading(btn, false);
    }
}

async function handleDeleteQuote(id) {
    if (!confirm("Tem a certeza que deseja eliminar esta cotação permanentemente?")) return;
    ui.setLoader(true, "A eliminar cotação...");
    try {
        await api.deleteQuote(id);
        ui.toast("Cotação eliminada.", "success");
        ui.renderQuoteDashboard();
    } catch (err) {
        console.error(err);
        ui.toast("Erro ao eliminar cotação.", "error");
    } finally {
        ui.setLoader(false);
    }
}

function handlePrintQuote() {
    const number = document.getElementById('input-quote-number')?.value || 'cotacao';
    utils.downloadElementAsImage('quote-print-area', `cotacao-${number}`);
}

// --- CONTROLO DE VERSÃO E ATUALIZAÇÕES DO SISTEMA ---
let loadedSystemVersion = null;

async function checkSystemVersion() {
    try {
        const res = await fetch('/api/version');
        if (res.ok) {
            const data = await res.json();
            const currentVersion = data.version;
            const updates = data.updates || [];
            
            // Definir globalmente para uso posterior
            window.__SYSTEM_VERSION__ = currentVersion;
            
            if (!loadedSystemVersion) {
                // Primeira verificação na carga da página
                loadedSystemVersion = currentVersion;
                console.log(`[VERSÃO] Versão inicial do sistema carregada: ${loadedSystemVersion}`);
                
                // Mostrar ícone de novidades se já estiver logado
                if (api.pb && api.pb.authStore && api.pb.authStore.isValid) {
                    ui.checkAndShowNewsIcon(currentVersion);
                }
            } else if (loadedSystemVersion !== currentVersion) {
                // Versão mudou! Mostrar alerta de atualização
                showSystemUpdateNotification(currentVersion, updates);
            }
        }
    } catch (err) {
        console.warn("[VERSÃO] Falha ao verificar a versão do sistema:", err);
    }
}

function startSystemVersionChecker() {
    // Primeira verificação imediata
    checkSystemVersion();
    // Verificar a cada 2 minutos (120.000 ms)
    setInterval(checkSystemVersion, 120000);
}

function showSystemUpdateNotification(newVersion, updates) {
    if (document.getElementById('system-update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'system-update-banner';
    // Estilo premium com gradiente de laranja a amber, z-index extremo e efeito glassmorphic blur (com flex-col para acomodar a lista de alterações)
    banner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-xl bg-gradient-to-r from-amber-500/95 to-orange-500/95 backdrop-blur-md text-white px-5 py-4 rounded-2xl shadow-2xl flex flex-col gap-3 border border-amber-400/50 transform transition-all duration-500 translate-y-[-100px] opacity-0';
    
    let updatesHtml = '';
    if (updates && updates.length > 0) {
        updatesHtml = `
            <div class="mt-1.5 border-t border-white/20 pt-2">
                <p class="text-[9px] font-black uppercase tracking-wider opacity-85 mb-1">Novidades desta versão:</p>
                <ul class="space-y-0.5 text-[10px] opacity-90 font-bold list-disc pl-4 leading-normal">
        `;
        updates.forEach(upd => {
            updatesHtml += `<li>${upd}</li>`;
        });
        updatesHtml += `
                </ul>
            </div>
        `;
    }

    banner.innerHTML = `
        <div class="flex items-center justify-between w-full gap-4">
            <div class="flex items-center gap-3">
                <div class="bg-white/20 p-2 rounded-xl animate-pulse shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
                    </svg>
                </div>
                <div>
                    <h4 class="font-extrabold text-xs md:text-sm tracking-wide uppercase leading-none">Atualização do Sistema!</h4>
                    <p class="text-[9px] md:text-[10px] opacity-95 mt-1 font-medium leading-tight">Uma nova versão foi publicada. Recarregue a página para ativar.</p>
                </div>
            </div>
            <button onclick="window.location.reload(true)" class="bg-white text-amber-600 hover:bg-amber-50 text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md shrink-0 active:scale-95 hover:shadow-lg">
                Recarregar
            </button>
        </div>
        ${updatesHtml}
    `;

    document.body.appendChild(banner);
    
    // Slide down smoothly
    setTimeout(() => {
        banner.classList.remove('translate-y-[-100px]', 'opacity-0');
        banner.classList.add('translate-y-0', 'opacity-100');
    }, 100);
}

window.showQuoteDashboard = showQuoteDashboard;
window.showQuoteForm = showQuoteForm;
window.changeQuoteType = changeQuoteType;
window.handleQuoteFieldChange = handleQuoteFieldChange;
window.handleQuoteSearch = handleQuoteSearch;
window.handleSaveQuote = handleSaveQuote;
window.handleDeleteQuote = handleDeleteQuote;
window.handlePrintQuote = handlePrintQuote;

// --- GSheet Sync Event Listeners ---
window.addEventListener('confirmModeChanged', (e) => {
    if (typeof ui.showSyncStatus === 'function') {
        ui.showSyncStatus(e.detail.offline);
    }
});

window.addEventListener('confirmSyncConflict', (e) => {
    if (typeof ui.showSyncConflict === 'function') {
        ui.showSyncConflict(e.detail);
    }
});

