/**
 * Módulo de Interface e UI para Bill Check
 */
import { formatMZN, formatDateDisplay } from './utils.js';
import { state, uploadBankStatement, saveBankIncome, listBankIncomes, searchPayments, markPaymentReconciled, updateGSheet, updateGSheetNote, getPaymentsByAllocatedTo, getPaymentsByMasterRef, listGDriveFiles } from './api.js';

/**
 * Controla o indicador de carregamento
 */
export function setLoader(show, message = 'A Processar') {
    const loader = document.getElementById('loader');
    if (loader) {
        const msgEl = loader.querySelector('span');
        if (msgEl) msgEl.innerText = message;
        
        if (show) {
            loader.style.display = 'flex';
        } else {
            loader.style.display = 'none';
        }
    }
}

/**
 * Mostra uma notificação toast premium
 */
export function toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-10 right-10 z-[10000] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-slate-900',
        warning: 'bg-orange-500'
    };

    toast.className = `${colors[type] || colors.info} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in pointer-events-auto cursor-pointer min-w-[280px] border border-white/10`;
    
    const icon = {
        success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    toast.innerHTML = `
        <div class="shrink-0">${icon[type] || icon.info}</div>
        <div class="flex-1 text-xs font-black uppercase tracking-wider">${message}</div>
    `;

    toast.onclick = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    };

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

/**
 * Controla o estado de carregamento de um botão
 */
export function setBtnLoading(btn, isLoading, originalText = null) {
    if (!btn) return;
    
    if (isLoading) {
        if (originalText) btn.dataset.originalText = originalText;
        else if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerText;
        
        btn.classList.add('btn-loading');
        if (btn.classList.contains('bg-black') || btn.classList.contains('bg-blue-600') || btn.classList.contains('bg-slate-900') || btn.classList.contains('bg-purple-600')) {
            btn.classList.add('btn-loading-white');
        }
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading');
        btn.classList.remove('btn-loading-white');
        btn.disabled = false;
        if (btn.dataset.originalText) {
            btn.innerText = btn.dataset.originalText;
        }
    }
}

/**
 * Utilitário para ocultar todas as visões principais
 */
function hideAllViews() {
    ['view-login', 'view-hub', 'view-dashboard', 'view-table', 'view-finance', 'view-team-dashboard', 'view-team-table', 'view-term-dashboard', 'view-term-table', 'view-confirm-dashboard', 'view-confirm-table', 'view-confirm-client-detail', 'view-bank-dashboard'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

/**
 * Mostra uma visão específica e oculta as restantes
 */
export function showView(viewId) {
    hideAllViews();
    const el = document.getElementById(viewId);
    if (el) {
        el.classList.remove('hidden');
        el.classList.remove('animate-fade-in');
        void el.offsetWidth; // Trigger reflow to restart animation
        el.classList.add('animate-fade-in');
        // Garantir que ações da tabela e outros elementos flutuantes sejam geridos
        const actions = document.getElementById('table-actions');
        const teamActions = document.getElementById('team-table-actions');

        if (actions) actions.classList.add('hidden');
        if (teamActions) teamActions.classList.add('hidden');

        if (viewId === 'view-table' && actions) actions.classList.remove('hidden');
        if (viewId === 'view-team-table' && teamActions) teamActions.classList.remove('hidden');

        const termActions = document.getElementById('term-table-actions');
        if (termActions) termActions.classList.add('hidden');
        if (viewId === 'view-term-table' && termActions) termActions.classList.remove('hidden');
    }
}

/**
 * Fecha um modal por ID
 */
export function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

/**
 * Abre um modal por ID
 */
export function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

/**
 * Renderiza a lista de tabelas no Dashboard
 */
export function renderDashboard(onOpenTable, onOpenActions) {
    const list = document.getElementById('tables-list');
    if (!list) return;

    list.innerHTML = '';

    if (state.tables.length === 0) {
        list.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400 uppercase text-[9px] font-bold tracking-widest">Sem tabelas ativas.</div>';
        return;
    }

    state.tables.forEach((table, idx) => {
        const balance = table.balance || 0;
        const isBalanceZero = Math.abs(balance) < 0.01;
        const bgColor = isBalanceZero ? 'bg-green-100/80' : 'bg-red-100/80';

        const card = document.createElement('div');
        card.className = `card-table ${bgColor} border-2 border-gray-400 rounded-xl p-6 hover:shadow-xl transition-all relative cursor-pointer`;
        card.onclick = () => onOpenTable(table.id);

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <h3 class="font-bold text-xs uppercase tracking-widest text-gray-800">${table.name}</h3>
                <span class="bg-slate-100 text-[9px] px-2 py-1 font-bold rounded">#${idx + 1}</span>
            </div>
            <button class="absolute top-3 right-3 text-gray-400 hover:text-black p-1 rounded-full hover:bg-gray-100" id="btn-actions-${table.id}">⋮</button>
            <div class="mt-4 flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Saldo:</span>
                <span class="font-bold text-[12px] ${balance > 0 ? 'text-red-700' : (balance < 0 ? 'text-blue-700' : 'text-gray-800')}">${formatMZN(balance)}</span>
            </div>
        `;

        list.appendChild(card);

        // Listener para ações da tabela
        const btn = card.querySelector(`#btn-actions-${table.id}`);
        btn.onclick = (e) => {
            e.stopPropagation();
            onOpenActions(table, btn);
        };
    });
}

/**
 * Renderiza o resumo do Dashboard
 */
export function renderDashboardSummary() {
    const summaryEl = document.getElementById('dashboard-summary');
    if (!summaryEl) return;

    const stats = state.tables.reduce((acc, table) => {
        const b = table.balance || 0;
        acc.total += b;
        if (Math.abs(b) < 0.01) acc.zero++;
        else if (b > 0) acc.debt++;
        else acc.credit++;
        return acc;
    }, { total: 0, debt: 0, credit: 0, zero: 0 });

    const isTotalZero = Math.abs(stats.total) < 0.01;
    const bgClass = isTotalZero ? 'bg-green-50 border-green-200' : (stats.total > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200');
    const totalColor = stats.total > 0 ? 'text-red-700' : (stats.total < 0 ? 'text-blue-700' : 'text-gray-800');

    summaryEl.innerHTML = `
        <div class="${bgClass} border-2 rounded-xl p-6 shadow-sm">
            <div class="flex flex-col md:flex-row justify-between items-center gap-6">
                <div class="text-center md:text-left">
                    <h3 class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Resumo Geral</h3>
                    <div class="flex items-baseline gap-2">
                        <span class="text-3xl font-bold ${totalColor}">${formatMZN(stats.total)}</span>
                        <span class="text-[10px] font-bold uppercase text-gray-400">Saldo Total</span>
                    </div>
                </div>
                <div class="flex gap-6 text-center">
                    <div><div class="text-xs font-bold uppercase text-gray-500 mb-1">Tabelas</div><div class="text-lg font-bold text-gray-800">${state.tables.length}</div></div>
                    <div><div class="text-xs font-bold uppercase text-gray-500 mb-1">Com Dívida</div><div class="text-lg font-bold text-red-700">${stats.debt}</div></div>
                    <div><div class="text-xs font-bold uppercase text-gray-500 mb-1">Com Crédito</div><div class="text-lg font-bold text-blue-700">${stats.credit}</div></div>
                    <div><div class="text-xs font-bold uppercase text-gray-500 mb-1">Liquidadas</div><div class="text-lg font-bold text-green-700">${stats.zero}</div></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renderiza os dados de uma tabela específica (Contentores e Pagamentos)
 */
export function renderTableDetails(onEditContainer) {
    const tbody = document.getElementById('table-body');
    const footer = document.getElementById('footer-logic');
    if (!tbody || !footer) return;

    tbody.innerHTML = '';
    footer.innerHTML = '';

    let totalDuty = 0, totalFreight = 0, totalLiability = 0;

    state.containers.forEach((c) => {
        const duty = parseFloat(c.duty) || 0;
        const freight = parseFloat(c.freight) || 0;
        const diff = duty - freight;

        totalDuty += duty;
        totalFreight += freight;
        totalLiability += diff;

        const tr = document.createElement('tr');
        tr.className = "cursor-pointer hover:bg-yellow-50 transition-colors";
        tr.onclick = () => onEditContainer(c);
        tr.innerHTML = `
            <td class="row-container">${c.container_id_str}</td>
            <td class="cell-data">${formatMZN(duty)}</td>
            <td class="cell-data">${formatMZN(freight)}</td>
            <td class="cell-data font-bold">${formatMZN(diff)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Subtotal
    footer.innerHTML += `
        <tr class="h-8"><td></td><td></td><td></td><td></td></tr>
        <tr class="font-bold bg-slate-50 text-[0.75rem]">
            <td class="text-center uppercase py-4">Total Bruto</td>
            <td class="text-center">${formatMZN(totalDuty)}</td>
            <td class="text-center">${formatMZN(totalFreight)}</td>
            <td class="text-center">${formatMZN(totalLiability)}</td>
        </tr>
    `;

    // Linhas de Pagamento
    let totalPaid = 0;
    state.balanceRecords.forEach((p, idx) => {
        const absAmount = Math.abs(parseFloat(p.amount) || 0);
        totalPaid += absAmount;
        footer.innerHTML += `
            <tr class="paid-row-style">
                <td class="text-center uppercase font-bold py-3 border-r-0">Paid ${idx + 1}</td>
                <td colspan="2" class="text-right italic pr-4 text-[9px] border-l-0">Liquidação via Caixa em ${new Date(p.payment_date).toLocaleDateString('pt-PT')}</td>
                <td class="text-center font-bold text-green-800">(${formatMZN(absAmount)})</td>
            </tr>
        `;
    });

    const currentBalance = totalLiability - totalPaid;
    state.activeBalance = currentBalance; // Atualiza o estado global para uso no modal de pagamento

    // Linha de Balanço Final
    const isCredit = currentBalance < 0;
    footer.innerHTML += `
        <tr class="balance-row ${isCredit ? 'balance-credit' : ''}">
            <td class="uppercase py-4">Balance</td>
            <td colspan="2" class="text-right text-[9px] pr-4 italic font-normal text-slate-700">
                ${isCredit ? 'Crédito Disponível' : 'Saldo Pendente (A Liquidar)'}
            </td>
            <td class="text-center font-bold">${formatMZN(currentBalance)}</td>
        </tr>
    `;
}

// --- MÓDULO FINANCE (UI) ---

/**
 * Renderiza o Dashboard Financeiro completo
 */
export function renderFinanceDashboard(onDeleteGroup, onRemoveSheet, onMoveSheet, onRenameGroup) {
    const list = document.getElementById('finance-content');
    if (!list) return;
    list.innerHTML = '';

    const groups = state.finance.groups;
    const sheets = state.finance.sheets;

    if (groups.length === 0 && sheets.length === 0) {
        list.innerHTML = '<div class="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl uppercase font-black text-gray-300 tracking-tighter text-lg">Nenhum dado consolidado</div>';
        return;
    }

    // Renderizar grupos
    groups.forEach(group => {
        const groupSheets = sheets.filter(s => s.groupId === group.id);
        list.appendChild(createFinanceGroupSection(group, groupSheets, onDeleteGroup, onRemoveSheet, onRenameGroup));
    });

    // Renderizar folhas sem grupo
    const ungrouped = sheets.filter(s => !s.groupId);
    if (ungrouped.length > 0) {
        const section = document.createElement('div');
        section.className = "mt-6";
        section.innerHTML = `
            <div class="flex items-center gap-2 mb-2 px-1">
                <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">Folhas Sem Grupo</span>
            </div>
        `;
        section.appendChild(createFinanceTable(ungrouped, onRemoveSheet));
        list.appendChild(section);
    }

    renderFinanceSummary(sheets);
}

function createFinanceGroupSection(group, sheets, onDelete, onRemoveSheet, onRename) {
    const section = document.createElement('div');
    section.className = "mb-8 border-b border-slate-100 pb-6";

    section.innerHTML = `
        <div class="flex justify-between items-center mb-3 px-1">
            <div class="flex items-center gap-4">
                <div class="flex flex-col gap-0.5 mr-2">
                    <button onclick="window.moveFinanceGroup('${group.id}', 'up')" class="text-slate-300 hover:text-slate-900 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    </button>
                    <button onclick="window.moveFinanceGroup('${group.id}', 'down')" class="text-slate-300 hover:text-slate-900 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                </div>
                <h3 class="text-sm font-black uppercase tracking-tight text-slate-900 border-b border-slate-900 pb-0.5">${group.name}</h3>
                <span class="text-[9px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded font-bold uppercase text-slate-400">${sheets.length} Itens</span>
            </div>
            <div class="flex gap-4">
                <button onclick="window.renameFinanceGroup('${group.id}')" class="text-[9px] font-black uppercase text-slate-400 hover:text-slate-900 transition-all">Renomear</button>
                <button onclick="window.deleteFinanceGroup('${group.id}')" class="text-[9px] font-black uppercase text-red-500/40 hover:text-red-500 transition-all">Remover</button>
            </div>
        </div>
    `;

    const tableContainer = createFinanceTable(sheets, onRemoveSheet);
    section.appendChild(tableContainer);

    return section;
}

function createFinanceTable(sheets, onRemove) {
    const tableContainer = document.createElement('div');
    tableContainer.className = "bg-white border border-slate-700 rounded-lg overflow-hidden shadow-[3px_3px_0px_0px_rgba(15,23,42,0.1)]";

    if (sheets.length === 0) {
        tableContainer.innerHTML = '<div class="p-6 text-center text-slate-300 uppercase font-black text-[9px] tracking-widest italic">Vazio - Mova folhas para aqui</div>';
        return tableContainer;
    }

    const table = document.createElement('table');
    table.className = "w-full text-left border-collapse";

    table.innerHTML = `
        <thead>
            <tr class="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-700">
                <th class="p-3">Documento</th>
                <th class="p-3 w-32">Grupo</th>
                <th class="p-3 text-center">Duty Prep</th>
                <th class="p-3 text-center">Amount</th>
                <th class="p-3 text-center">Paid</th>
                <th class="p-3 text-center">Balance</th>
                <th class="p-3 text-right w-10"></th>
            </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
            ${sheets.map(s => `
                <tr class="group hover:bg-slate-50 transition-colors">
                    <td class="p-3">
                        <div class="flex flex-col">
                            <span class="font-bold text-[10px] uppercase text-gray-900 leading-tight">${s.title}</span>
                            <a href="${s.sourceUrl}" target="_blank" class="text-[8px] text-gray-400 hover:text-blue-600 transition-all font-medium mt-0.5 truncate max-w-[150px]">Link Original</a>
                        </div>
                    </td>
                    <td class="p-3">
                        <select onchange="window.moveFinanceSheet('${s.id}', this.value)" class="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[8px] font-black uppercase outline-none focus:border-black transition-all">
                            <option value="">Sem Grupo</option>
                            ${state.finance.groups.map(g => `<option value="${g.id}" ${s.groupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
                        </select>
                    </td>
                    <td class="p-3 text-center font-bold text-[10px] text-gray-600">${formatMZN(s.dutyPrepaid)}</td>
                    <td class="p-3 text-center font-bold text-[10px] text-gray-900">${formatMZN(s.amountDuty)}</td>
                    <td class="p-3 text-center font-bold text-[10px] text-green-700">${formatMZN(s.paid)}</td>
                    <td class="p-3 text-center font-black text-[10px] ${s.balance > 0 ? 'text-red-700' : 'text-blue-700'}">${formatMZN(s.balance)}</td>
                    <td class="p-3 text-right">
                        <button onclick="window.removeFinanceSheet('${s.id}')" class="text-gray-200 hover:text-red-600 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
        <tfoot class="bg-slate-700 text-white font-black text-[9px] uppercase">
            <tr>
                <td class="p-3" colspan="2">Consolidado</td>
                <td class="p-3 text-center">${formatMZN(sheets.reduce((a, b) => a + b.dutyPrepaid, 0))}</td>
                <td class="p-3 text-center">${formatMZN(sheets.reduce((a, b) => a + b.amountDuty, 0))}</td>
                <td class="p-3 text-center text-green-300">${formatMZN(sheets.reduce((a, b) => a + b.paid, 0))}</td>
                <td class="p-3 text-center ${sheets.reduce((a, b) => a + b.balance, 0) > 0 ? 'text-red-300' : 'text-blue-200'}">
                    ${formatMZN(sheets.reduce((a, b) => a + b.balance, 0))}
                </td>
                <td></td>
            </tr>
        </tfoot>
    `;

    tableContainer.appendChild(table);
    return tableContainer;
}

export function renderFinanceSummary(sheets) {
    const el = document.getElementById('finance-summary');
    if (!el) return;

    const totals = sheets.reduce((acc, s) => {
        acc.duty += s.amountDuty;
        acc.paid += s.paid;
        acc.balance += s.balance;
        return acc;
    }, { duty: 0, paid: 0, balance: 0 });

    el.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white border border-slate-700 p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(15,23,42,0.8)]">
                <p class="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Dever Consolidado</p>
                <p class="text-lg font-black text-slate-900">${formatMZN(totals.duty)}</p>
            </div>
            <div class="bg-white border border-slate-700 p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(34,197,94,0.6)]">
                <p class="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Liquidado</p>
                <p class="text-lg font-black text-green-600">${formatMZN(totals.paid)}</p>
            </div>
            <div class="bg-slate-700 border border-slate-700 p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(15,23,42,0.3)]">
                <p class="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Balanço Global</p>
                <p class="text-lg font-black text-white">${formatMZN(totals.balance)}</p>
            </div>
        </div>
    `;
}
// --- MÓDULO TEAM (UI) ---

export function renderTeamDashboard(onOpenTable, onOpenActions) {
    const list = document.getElementById('team-tables-list');
    if (!list) return;
    list.innerHTML = '';

    if (state.team.tables.length === 0) {
        list.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400 uppercase text-[9px] font-bold tracking-widest">Sem relatórios de equipe ativos.</div>';
        return;
    }

    state.team.tables.forEach((table, idx) => {
        const card = document.createElement('div');
        card.className = `card-table bg-white border-2 border-gray-600 rounded-xl p-6 hover:shadow-xl transition-all relative cursor-pointer`;
        card.onclick = () => onOpenTable(table.id);

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="bg-orange-500 text-white p-2 rounded-lg mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <button class="text-gray-400 hover:text-black p-1 rounded-full hover:bg-gray-100" id="btn-team-actions-${table.id}">⋮</button>
            </div>
            <h3 class="font-bold text-xs uppercase tracking-widest text-gray-800">${table.name}</h3>
            <p class="text-[9px] text-gray-400 mt-1 uppercase font-bold">Relatório #${idx + 1}</p>
        `;

        list.appendChild(card);
        const btn = card.querySelector(`#btn-team-actions-${table.id}`);
        btn.onclick = (e) => {
            e.stopPropagation();
            onOpenActions(table, btn);
        };
    });
}

export function renderTeamTable(onEditRecord) {
    const tbody = document.getElementById('team-table-body');
    const footer = document.getElementById('team-table-footer');
    if (!tbody || !footer) return;

    tbody.innerHTML = '';
    footer.innerHTML = '';

    const groups = state.team.groups;
    const records = state.team.records;

    // Calcular estatísticas para o resumo de topo
    const stats = records.reduce((acc, r) => {
        acc.totalRecords++;
        if (r.interna_paid && r.maputo_paid && r.matola_paid && (parseFloat(r.termos_val) === 0 || r.termos_paid)) acc.completedRecords++;
        return acc;
    }, { totalRecords: 0, completedRecords: 0 });

    let globalTotals = { interna: 0, maputo: 0, matola: 0, termos: 0 };

    // Função para renderizar uma linha de soma (Laranja)
    const renderSumRow = (stats) => {
        const tr = document.createElement('tr');
        tr.className = "bg-orange-300 font-bold text-xs";
        tr.innerHTML = `
            <td class="py-1 px-2 border border-gray-600 text-center uppercase text-[8px]">Subtotal</td>
            <td class="py-1 px-2 border border-gray-600 text-center">${stats.interna || 0}</td><td class="border border-gray-600"></td>
            <td class="py-1 px-2 border border-gray-600 text-center">${stats.maputo || 0}</td><td class="border border-gray-600"></td>
            <td class="py-1 px-2 border border-gray-600 text-center">${stats.matola || 0}</td><td class="border border-gray-600"></td>
            <td class="py-1 px-2 border border-gray-600 text-center">${stats.termos || 0}</td><td class="border border-gray-600"></td>
        `;
        return tr;
    };

    let visibleGroupsCount = 0;

    // Renderizar por Grupos
    groups.forEach(group => {
        const groupRecords = records.filter(r => r.group_id === group.id);
        
        // Verificar se o lote está completamente pago ou sem contentores
        const allRecordsPaid = groupRecords.length > 0 && groupRecords.every(r => 
            r.interna_paid && r.maputo_paid && r.matola_paid && (parseFloat(r.termos_val) === 0 || r.termos_paid)
        );

        if (groupRecords.length === 0 || allRecordsPaid) {
            return; // Ocultar o lote completamente se estiver todo pago ou vazio
        }

        visibleGroupsCount++;
        let groupUnpaid = { interna: 0, maputo: 0, matola: 0, termos: 0 };

        groupRecords.forEach(r => {
            const isRowPaid = r.interna_paid && r.maputo_paid && r.matola_paid && (parseFloat(r.termos_val) === 0 || r.termos_paid);
            if (isRowPaid) return; // Omitir se concluído

            const tr = createTeamRow(r, onEditRecord);
            tbody.appendChild(tr);

            if (!r.interna_paid) groupUnpaid.interna += (parseFloat(r.interna_val) || 0);
            if (!r.maputo_paid) groupUnpaid.maputo += (parseFloat(r.maputo_val) || 0);
            if (!r.matola_paid) groupUnpaid.matola += (parseFloat(r.matola_val) || 0);
            if (!r.termos_paid) groupUnpaid.termos += (parseFloat(r.termos_val) || 0);
        });

        // Adicionar Linha Laranja (Somatório dos não pagos do grupo)
        tbody.appendChild(renderSumRow(groupUnpaid));

        // Espaçador entre lotes (Cinza Transparente)
        const spacer = document.createElement('tr');
        spacer.className = "h-4 bg-gray-100/50";
        spacer.innerHTML = '<td colspan="9" class="border border-gray-300"></td>';
        tbody.appendChild(spacer);

        globalTotals.interna += groupUnpaid.interna;
        globalTotals.maputo += groupUnpaid.maputo;
        globalTotals.matola += groupUnpaid.matola;
        globalTotals.termos += groupUnpaid.termos;
    });

    // Renderizar sem grupo
    const ungrouped = records.filter(r => !r.group_id);
    if (ungrouped.length > 0) {
        ungrouped.forEach(r => {
            const isRowPaid = r.interna_paid && r.maputo_paid && r.matola_paid && (parseFloat(r.termos_val) === 0 || r.termos_paid);
            if (isRowPaid) return; // Omitir se concluído

            tbody.appendChild(createTeamRow(r, onEditRecord));
            if (!r.interna_paid) globalTotals.interna += (parseFloat(r.interna_val) || 0);
            if (!r.maputo_paid) globalTotals.maputo += (parseFloat(r.maputo_val) || 0);
            if (!r.matola_paid) globalTotals.matola += (parseFloat(r.matola_val) || 0);
            if (!r.termos_paid) globalTotals.termos += (parseFloat(r.termos_val) || 0);
        });
    }

    const totalPendency = (globalTotals.interna || 0) + (globalTotals.maputo || 0) + (globalTotals.matola || 0) + (globalTotals.termos || 0);
    renderTeamSummary(totalPendency, visibleGroupsCount, stats.totalRecords, stats.completedRecords);

    footer.innerHTML = `
        <tr class="bg-yellow-400 text-black font-black uppercase text-xs">
            <td class="py-2 px-4 border-2 border-gray-800 text-center">PENDENTE</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center" colspan="2">${formatMZN(globalTotals.interna)}</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center" colspan="2">${formatMZN(globalTotals.maputo)}</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center" colspan="2">${formatMZN(globalTotals.matola)}</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center" colspan="2">${formatMZN(globalTotals.termos)}</td>
        </tr>
        <tr class="bg-orange-500 text-black font-black uppercase text-sm export-only">
            <td colspan="7" class="py-2 px-4 text-center border-2 border-gray-800">TOTAL GERAL PENDENTE</td>
            <td colspan="2" class="py-2 px-4 text-center border-2 border-gray-800">${formatMZN(totalPendency)}</td>
        </tr>
    `;
}

export function renderTeamSummary(total, lotesCount, contentoresCount, concluidosCount) {
    const el = document.getElementById('team-summary');
    if (!el) return;

    const pendentesCount = contentoresCount - concluidosCount;

    el.innerHTML = `
        <div class="bg-white border-2 border-gray-800 rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-center md:text-left">
                    <h3 class="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">BALANÇO TOTAL PENDENTE</h3>
                    <div class="flex items-baseline gap-2">
                        <span class="text-2xl font-black text-gray-900">${formatMZN(total)}</span>
                        <span class="text-[8px] font-bold uppercase text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Total em Falta</span>
                    </div>
                </div>
                <div class="flex gap-6 text-center border-l-2 border-gray-100 pl-6">
                    <div>
                        <div class="text-[8px] font-bold uppercase text-gray-400 mb-0.5">Lotes</div>
                        <div class="text-lg font-black text-gray-900">${lotesCount}</div>
                    </div>
                    <div>
                        <div class="text-[8px] font-bold uppercase text-gray-400 mb-0.5">Pendentes</div>
                        <div class="text-lg font-black text-orange-500">${pendentesCount}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createTeamRow(r, onEdit) {
    const isPaid = r.interna_paid && r.maputo_paid && r.matola_paid && (parseFloat(r.termos_val) === 0 || r.termos_paid);
    const tr = document.createElement('tr');
    tr.className = `cursor-pointer hover:opacity-80 transition-all ${isPaid ? 'bg-green-400' : 'bg-white'}`;
    tr.onclick = () => onEdit(r);

    const paidClass = "bg-green-300"; // Cor para células individuais pagas

    tr.innerHTML = `
        <td class="py-1 px-2 border border-gray-400 font-bold text-xs text-center">${r.container_id_str}</td>
        
        <td class="py-1 px-2 border border-gray-400 text-xs text-center ${r.interna_paid ? paidClass : ''}">${r.interna_val || ''}</td>
        <td class="py-1 px-2 border border-gray-400 text-[11px] text-center italic ${r.interna_paid ? paidClass : ''}">${formatDateDisplay(r.interna_month) || ''}</td>
        
        <td class="py-1 px-2 border border-gray-400 text-xs text-center ${r.maputo_paid ? paidClass : ''}">${r.maputo_val || ''}</td>
        <td class="py-1 px-2 border border-gray-400 text-[11px] text-center italic ${r.maputo_paid ? paidClass : ''}">${formatDateDisplay(r.maputo_month) || ''}</td>
        
        <td class="py-1 px-2 border border-gray-400 text-xs text-center ${r.matola_paid ? paidClass : ''}">${r.matola_val || ''}</td>
        <td class="py-1 px-2 border border-gray-400 text-[11px] text-center italic ${r.matola_paid ? paidClass : ''}">${formatDateDisplay(r.matola_month) || ''}</td>
        
        <td class="py-1 px-2 border border-gray-400 text-xs text-center ${(r.termos_paid || parseFloat(r.termos_val) === 0) ? paidClass : ''}">${r.termos_val || '0'}</td>
        <td class="py-1 px-2 border border-gray-400 text-[11px] text-center italic ${(r.termos_paid || parseFloat(r.termos_val) === 0) ? paidClass : ''}">${formatDateDisplay(r.termos_month) || ''}</td>
    `;
    return tr;
}

// --- MÓDULO TERM (UI) ---

export function renderTermDashboard(onOpenTable, onOpenActions) {
    const list = document.getElementById('term-tables-list');
    if (!list) return;
    list.innerHTML = '';

    if (state.term.tables.length === 0) {
        list.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400 uppercase text-[9px] font-bold tracking-widest">Sem relatórios TERM ativos.</div>';
        return;
    }

    state.term.tables.forEach((table, idx) => {
        const card = document.createElement('div');
        card.className = "card-table bg-white border-2 border-gray-600 rounded-xl p-6 hover:shadow-xl transition-all relative cursor-pointer";
        card.onclick = () => onOpenTable(table.id);

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="bg-green-600 text-white p-2 rounded-lg mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </div>
                <button class="text-gray-400 hover:text-black p-1 rounded-full hover:bg-gray-100" id="btn-term-actions-${table.id}">⋮</button>
            </div>
            <h3 class="font-bold text-xs uppercase tracking-widest text-gray-800">${table.name}</h3>
            <p class="text-[9px] text-gray-400 mt-1 uppercase font-bold">Relatório TERM #${idx + 1}</p>
        `;

        list.appendChild(card);
        const btn = card.querySelector(`#btn-term-actions-${table.id}`);
        btn.onclick = (e) => {
            e.stopPropagation();
            onOpenActions(table, btn);
        };
    });
}

export function renderTermTable(onEditRecord) {
    const tbody = document.getElementById('term-table-body');
    const footer = document.getElementById('term-table-footer');
    if (!tbody || !footer) return;

    tbody.innerHTML = '';
    footer.innerHTML = '';

    const records = state.term.records;

    let totals = {
        pending: 0,
        next: 0,
        paid: 0,
        global: 0
    };

    records.forEach(r => {
        const tcs = parseFloat(r.tcs) || 0;
        const unit = parseFloat(r.unit) || 0;
        const value = tcs * unit;
        const fiftyPercent = value * 0.5;
        const balance = fiftyPercent; // Conforme imagem

        if (r.status === 'PENDING') totals.pending += balance;
        else if (r.status === 'NEXT') totals.next += balance;
        else if (r.status === 'PAID') totals.paid += balance;

        const tr = document.createElement('tr');
        let bgColor = '';
        if (r.status === 'PAID') bgColor = 'bg-green-400';
        else if (r.status === 'PENDING') bgColor = 'bg-orange-300';
        else if (r.status === 'NEXT') bgColor = 'bg-blue-300';

        tr.className = `cursor-pointer hover:opacity-90 transition-all ${bgColor}`;
        tr.onclick = () => onEditRecord(r);

        tr.innerHTML = `
            <td class="py-1 px-2 border border-gray-600 font-bold text-xs text-center">${r.container_id_str}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center">${r.eta ? formatDateDisplay(r.eta) : ''}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center font-bold">${tcs}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center">${unit}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center">${formatMZN(value)}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center font-bold">${formatMZN(fiftyPercent)}</td>
            <td class="py-1 px-2 border border-gray-600 text-[10px] text-center font-black uppercase">${r.status}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center font-bold">${formatMZN(balance)}</td>
        `;
        tbody.appendChild(tr);
    });

    totals.global = totals.pending + totals.next;

    // Identificar o mês dos pendentes para o label do rodapé
    const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    let pendingMonthLabel = "MÊS";

    if (records.length > 0) {
        const firstPending = records.find(r => r.status === 'PENDING' && r.eta);
        if (firstPending) {
            const date = new Date(firstPending.eta);
            pendingMonthLabel = months[date.getUTCMonth()];
        } else {
            // Fallback para o mês atual se não houver pendentes com data
            pendingMonthLabel = months[new Date().getUTCMonth()];
        }
    }

    footer.innerHTML = `
        <tr class="bg-orange-400 font-black text-xs text-black">
            <td colspan="6" class="border-2 border-gray-800"></td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center uppercase">PENDING</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center">${formatMZN(totals.pending)}</td>
        </tr>
        <tr class="bg-blue-300 font-black text-xs text-black">
            <td colspan="6" class="border-2 border-gray-800"></td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center uppercase">NEXT AFTER (${pendingMonthLabel})</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center">${formatMZN(totals.next)}</td>
        </tr>
        <tr class="bg-green-500 font-black text-sm text-black">
            <td colspan="6" class="border-2 border-gray-800"></td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center uppercase">TOTAL</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center">${formatMZN(totals.global)}</td>
        </tr>
    `;

    renderTermSummary(totals.global, totals.pending, totals.next);
}

export function renderTermSummary(total, pending, next) {
    const el = document.getElementById('term-summary');
    if (!el) return;

    el.innerHTML = `
        <div class="bg-white border-2 border-gray-800 rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h3 class="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">TOTAL GERAL - TERM</h3>
                    <div class="flex items-baseline gap-2">
                        <span class="text-2xl font-black text-gray-900">${formatMZN(total)}</span>
                        <span class="text-[8px] font-bold uppercase text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Consolidado</span>
                    </div>
                </div>
                <div class="flex gap-6 text-center border-l-2 border-gray-100 pl-6">
                    <div>
                        <div class="text-[8px] font-bold uppercase text-orange-400 mb-0.5">PENDING</div>
                        <div class="text-lg font-black text-gray-900">${formatMZN(pending)}</div>
                    </div>
                    <div>
                        <div class="text-[8px] font-bold uppercase text-blue-400 mb-0.5">NEXT</div>
                        <div class="text-lg font-black text-gray-900">${formatMZN(next)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function renderConfirmList(data, filterText = "", statusFilter = "TODOS") {
    const container = document.getElementById('confirm-list-container');
    if (!container) return;

    container.innerHTML = '';
    const columns = data[0];
    if (!state.confirm) state.confirm = {};
    state.confirm.columns = columns;

    const columnsUpper = columns.map(c => String(c || '').toUpperCase());
    
    // Procura exata primeiro, depois parcial, respeitando a ordem de preferência dos targets
    const findCol = (targets) => {
        // 1. Tentar correspondência exata para cada target em ordem de prioridade
        for (const target of targets) {
            const idx = columnsUpper.findIndex(c => c === target);
            if (idx !== -1) return idx;
        }
        // 2. Tentar correspondência parcial para cada target em ordem de prioridade
        for (const target of targets) {
            const idx = columnsUpper.findIndex(c => c.includes(target));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const idCodeIdx = findCol(['ID CODE', 'CODE ID', 'ID']);
    const nameIdx = findCol(['NAME', 'NOME', 'CLIENTE', 'CLIENT']);
    const statusIdx = findCol(['CONFIRMATION', 'STATUS', 'CONFIRMAÇÃO', 'CONFIRM']);
    const dutyIdx = findCol(['AMOUNT DUTY', 'DUTY', 'TOTAL DUTY', 'VALOR DUTY']);
    const dutyPrepaidIdx = findCol(['DUTY PREPAID', 'PREPAID']);
    const balanceIdx = findCol(['BALANCE', 'BALANCO', 'SALDO']);
    
    // Para o PAID, queremos algo que tenha PAID/PAGO mas que não seja DUTY PREPAID ou AMOUNT DUTY
    const paidIdx = columnsUpper.findIndex((c, i) => 
        (c.includes('PAID') || c.includes('PAGO')) && !c.includes('PREPAID') && !c.includes('DUTY') && i !== dutyIdx
    );

    let noIdx = columns.findIndex(c => {
        const h = String(c || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return h === 'NO' || h === 'Nº' || h === 'N' || h === 'NUMERO' || h.startsWith('NO.') || h.startsWith('Nº.') || h.startsWith('N.');
    });
    if (noIdx === -1 && columns.length > 0) {
        noIdx = 0;
    }

    console.log(`[CONFIRM-DEBUG] Índices - Status: ${statusIdx} ("${columns[statusIdx]}"), Paid: ${paidIdx} ("${columns[paidIdx]}")`);

    let lastIdCode = '';
    let lastName = '';
    let lastNo = '';

    const groupedClients = new Map();
    // Processar merge cells visualmente e agrupar
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        // Verificar se a linha é um sumário "TOTAL" em qualquer uma das colunas iniciais
        const rowString = row.slice(0, 10).map(c => String(c || '').toUpperCase()).join(' ');
        if (rowString.includes('TOTAL')) continue;

        let idCode = idCodeIdx !== -1 ? String(row[idCodeIdx] || '').trim() : '';
        let name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
        let noValue = noIdx !== -1 ? String(row[noIdx] || '').trim() : '';

        // Detetar se esta linha inicia um novo bloco de cliente
        const isNewId = idCode !== '';
        const isNewName = name !== '';
        const isNewNo = noValue !== '';

        if (isNewId) lastIdCode = idCode;
        else idCode = lastIdCode;

        if (isNewName) lastName = name;
        else name = lastName;

        if (isNewNo) lastNo = noValue;
        else noValue = lastNo;

        if (filterText) {
            const searchStr = `${name} ${idCode}`.toLowerCase();
            if (!searchStr.includes(filterText.toLowerCase())) continue;
        }

        // Criar um ID de grupo único que combina ID + NOME para evitar colisões
        const groupId = `${idCode}_${name}`.replace(/\s+/g, '_') || `ROW_${i}`;

        if (!groupedClients.has(groupId)) {
            groupedClients.set(groupId, {
                displayIdCode: idCode,
                displayName: name,
                no: noValue,
                originalGlobalIndex: groupedClients.size + 1,
                rows: [],
                statuses: []
            });
        }

        const currentGroup = groupedClients.get(groupId);

        let rowStatus = String(row[statusIdx] || '').trim();

        const rawPaid = paidIdx !== -1 ? row[paidIdx] : 0;
        const paidVal = parseFloat(String(rawPaid || '0').replace(/[^0-9.-]+/g, '')) || 0;

        const rawPrepaid = dutyPrepaidIdx !== -1 ? row[dutyPrepaidIdx] : 0;
        const prepaidVal = parseFloat(String(rawPrepaid || '0').replace(/[^0-9.-]+/g, '')) || 0;

        const rawBalance = balanceIdx !== -1 ? row[balanceIdx] : 0;
        const balanceVal = parseFloat(String(rawBalance || '0').replace(/[^0-9.-]+/g, '')) || 0;

        // Regras de negócio quando o status está vazio ou como Pendente padrão
        if (rowStatus === '' || rowStatus.toUpperCase() === 'PENDENTE') {
            if (balanceVal === 0) {
                // Se o saldo for zero, está pago. Verificar método:
                if (prepaidVal > 0) {
                    rowStatus = 'CONFIRMADO'; // Prepaid não precisa de verificação
                } else if (paidVal > 0) {
                    rowStatus = 'PENDENTE'; // Paid precisa de confirmação bancária
                } else {
                    rowStatus = 'PENDENTE'; // Fallback
                }
            } else {
                // Se ainda tem saldo a pagar
                rowStatus = 'AGUARDA PAGAMENTO';
            }
        }

        currentGroup.rows.push({
            originalRow: row,
            originalIndex: i,
            status: rowStatus
        });
        currentGroup.statuses.push(rowStatus);
    }

    let groups = Array.from(groupedClients.values());

    // Ordenar os clientes de forma robusta pela numeração do Drive/GSheet (campo client.no)
    groups.sort((a, b) => {
        const noA = parseInt(a.no, 10);
        const noB = parseInt(b.no, 10);
        if (!isNaN(noA) && !isNaN(noB)) {
            return noA - noB;
        }
        return String(a.no || '').localeCompare(String(b.no || ''), undefined, { numeric: true, sensitivity: 'base' });
    });

    let totalDuty = 0;

    // Aplicar Filtro de Status (Robusto: ignora emojis, mas preserva hífens)
    if (statusFilter !== 'TODOS') {
        const target = statusFilter.toUpperCase().trim();
        groups = groups.filter(client => {
            return client.statuses.some(s => {
                const current = String(s || '').toUpperCase().replace(/[^A-Z0-9\s-]/g, '').trim();
                const targetClean = target.replace(/[^A-Z0-9\s-]/g, '').trim();
                return current.includes(targetClean) || targetClean.includes(current);
            });
        });
    }

    // Calcular Total Duty baseado nos grupos e status filtrados
    groups.forEach(client => {
        const target = statusFilter.toUpperCase().trim();
        const targetClean = target.replace(/[^A-Z0-9\s-]/g, '').trim();

        client.rows.forEach(r => {
            const current = String(r.status || '').toUpperCase().replace(/[^A-Z0-9\s-]/g, '').trim();
            if (statusFilter === 'TODOS' || current.includes(targetClean) || targetClean.includes(current)) {
                const rawVal = r.originalRow[dutyIdx];
                const duty = parseFloat(String(rawVal || '0').replace(/[^0-9.-]+/g, '')) || 0;
                totalDuty += duty;
            }
        });
    });

    // Atualizar Barra de Totais
    const totalsBar = document.getElementById('confirm-totals-bar');
    if (totalsBar) {
        totalsBar.classList.remove('hidden');
        document.getElementById('confirm-total-clients').innerText = groups.length;
        document.getElementById('confirm-total-duty').innerText = formatMZN(totalDuty);
    }

    if (groups.length === 0) {
        container.innerHTML = `<div class="col-span-full p-12 text-center text-gray-400 bg-white border-2 border-dashed border-gray-200 rounded-2xl font-bold uppercase">Nenhum cliente encontrado</div>`;
        return;
    }

    container.innerHTML = '';

    groups.forEach((client, idx) => {
        const card = document.createElement('div');
        card.className = "bg-white border border-gray-200 p-3 pt-8 pb-1.5 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group relative overflow-hidden";

        let clientStatus = 'PENDENTE';
        let statusClass = "bg-gray-100 text-gray-400";

        // Normalizar status para comparação robusta (remove emojis, mas preserva hífens)
        const cleanStatuses = client.statuses.map(s => 
            String(s || '').toUpperCase().replace(/[^A-Z0-9\s-]/g, '').trim()
        );

        if (cleanStatuses.some(s => s.includes('COMPROVATIVO ERRADO') || s.includes('ERRADO'))) {
            clientStatus = 'ERRADO';
            statusClass = "bg-red-600 text-white";
        } else if (cleanStatuses.some(s => s.includes('SEM COMPROVATIVO') || s.includes('SEM COMP'))) {
            clientStatus = 'SEM COMP.';
            statusClass = "bg-orange-500 text-white";
        } else if (cleanStatuses.some(s => s.includes('RE-VERIFICANDO') || s.includes('RE-VERIF'))) {
            clientStatus = 'RE-VERIF.';
            statusClass = "bg-blue-600 text-white";
        } else if (cleanStatuses.every(s => s.includes('CONFIRMADO'))) {
            clientStatus = 'CONFIRMADO';
            statusClass = "bg-green-600 text-white";
        } else if (cleanStatuses.some(s => s.includes('PENDENTE'))) {
            clientStatus = 'PENDENTE';
            statusClass = "bg-yellow-400 text-black font-black";
        } else {
            clientStatus = 'AGUARDA PAG.';
            statusClass = "bg-gray-100 text-gray-400";
        }

        const rowCount = client.rows.length;

        card.innerHTML = `
            <!-- Top Left Badge (Client Number) -->
            <div class="absolute top-0 left-0 px-3 py-1.5 bg-gray-100 text-black rounded-br-xl border-b border-r border-gray-200">
                <span class="text-[12px] font-black">${client.no || '—'}</span>
            </div>
            
            <!-- Top Right Badge (Status) -->
            <div class="absolute top-0 right-0 px-2.5 py-1 ${statusClass} rounded-bl-xl">
                <span class="text-[8px] font-black uppercase tracking-wider">${clientStatus}</span>
            </div>

            <div class="mt-3">
                <h4 class="font-bold text-[11px] uppercase tracking-tight leading-tight text-gray-500 group-hover:text-black transition-colors pr-2">${client.displayName || 'Cliente Sem Nome'}</h4>
                
                <div class="flex justify-between items-end mt-0.5">
                    <p class="text-[9px] font-bold uppercase text-gray-400 leading-none">${rowCount} ORDEM${rowCount > 1 ? 'S' : ''}</p>
                    <div class="text-gray-400 group-hover:text-yellow-600 transition-all shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </div>
            </div>
        `;

        card.onclick = () => showConfirmDetail(client, client.no || '—');
        container.appendChild(card);
    });
}

export async function showConfirmDetail(client, clientIndex) {
    const nameEl = document.getElementById('confirm-client-detail-name');
    const idEl = document.getElementById('confirm-client-detail-id');
    const breadcrumbEl = document.getElementById('confirm-breadcrumb');
    const body = document.getElementById('confirm-client-orders');

    if (breadcrumbEl) {
        const projectName = document.getElementById('confirm-project-active-name')?.textContent || 'PROJETO';
        const separator = `<svg class="text-gray-300" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        const displayIndex = clientIndex !== undefined ? clientIndex : '---';

        breadcrumbEl.innerHTML = `
            <span class="hover:text-black cursor-pointer transition-colors" onclick="ui.showView('view-confirm-table')">${projectName}</span>
            ${separator}
            <span class="text-gray-600">${displayIndex}</span>
            ${separator}
            <span class="text-black font-black">${client.displayName || 'SEM NOME'}</span>
        `;
    }

    if (nameEl) nameEl.innerText = client.displayName || 'Cliente Sem Nome';
    if (idEl) idEl.innerText = `ID CODE: ${client.displayIdCode || '---'}`;
    if (body) body.innerHTML = '';

    // Mapeamento de Colunas focado em DUTY (Refinado para evitar colisões)
    const columns = state.confirm.columns || [];
    const columnsUpper = columns.map(c => String(c || '').toUpperCase().trim());

    const findCol = (targets) => {
        for (const target of targets) {
            const idx = columnsUpper.findIndex(c => c === target);
            if (idx !== -1) return idx;
        }
        for (const target of targets) {
            const idx = columnsUpper.findIndex(c => c.includes(target));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const orderNumIdx = findCol(['HF2', 'REF', 'REFERENCIA', 'ORDER NUMBER', 'ORDER NUM', 'ORDER', 'CONV', 'CONTENTOR', 'Nº HF2', 'Nº ORDEM', 'NO.', 'N.O', 'N.º', 'Nº', 'N°', 'NO']);
    const cbmIdx = findCol(['CBM', 'M3', 'VOLUME', 'VOL']);
    const unitDutyIdx = findCol(['UNIT CBM DUTY', 'UNIT DUTY', 'CBM DUTY', 'UNIT']);
    const dutyPrepIdx = findCol(['DUTY PREPAID', 'PREPAID', 'PRE-PAGO']);
    const amtDutyIdx = findCol(['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
    
    const paidDutyIdx = columnsUpper.findIndex((c, i) => 
        (c.includes('PAID') || c.includes('PAGO')) && !c.includes('PREPAID') && !c.includes('DUTY')
    );
    
    const balanceIdx = findCol(['BALANCE', 'SALDO', 'BALANCO']);
    const bankDutyIdx = findCol(['BANK IN DUTY', 'BANK', 'BANCO']);
    const statusIdx = findCol(['CONFIRMATION', 'STATUS']);

    const getNum = (row, idx) => idx !== -1 ? (parseFloat(String(row[idx]).replace(/[^0-9.-]+/g, '')) || 0) : 0;
    const getRaw = (row, idx) => idx !== -1 && row[idx] !== undefined && row[idx] !== null && row[idx] !== '' ? row[idx] : '—';

    // Formatação Numérica (pt-BR para 2 casas decimais)
    const formatValue = (val) => new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val);

    let tbodyHtml = '';
    let totalPaid = 0;
    let totalDutyPrepaid = 0;
    let totalAmountDuty = 0;

    // Guarda os dados na global para podermos editar
    window.currentClientRows = [];

    if (!client.rows || client.rows.length === 0) {
        body.innerHTML = `<div id="empty-state" class="p-12 text-center text-slate-500 italic">Nenhum dado para exibir.</div>`;
    } else {
        client.rows.forEach((rowObj, index) => {
            const rowData = rowObj.originalRow;
            const originalIndex = rowObj.originalIndex;

            const orderNumber = getRaw(rowData, orderNumIdx);
            const cbm = getNum(rowData, cbmIdx);
            const unitDuty = getNum(rowData, unitDutyIdx);
            const dutyPrepaid = getNum(rowData, dutyPrepIdx);
            const amountDuty = getNum(rowData, amtDutyIdx);
            const paid = getNum(rowData, paidDutyIdx);
            const balance = getNum(rowData, balanceIdx);

            totalPaid += paid;
            totalDutyPrepaid += dutyPrepaid;
            totalAmountDuty += amountDuty;

            // Salva dados processados para facilitar edição
            window.currentClientRows.push({
                originalIndex,
                orderNumber, cbm, unitDuty, dutyPrepaid, amountDuty, paid, balance
            });

            let rowStatus = rowData[statusIdx] || 'PENDENTE';

            tbodyHtml += `
                <tr class="row-hover transition-colors border-b border-slate-50 hover:bg-[#f1f5f9] cursor-pointer" onclick="ui.openConfirmEditModal(${index})">
                    <td class="p-4 font-bold text-slate-800 text-[12px]">${orderNumber}</td>
                    <td class="p-4 text-center text-slate-600 text-[12px]">${cbm.toFixed(2)}</td>
                    <td class="p-4 text-center font-semibold text-blue-700 text-[12px]">${formatValue(amountDuty)}</td>
                    <td class="p-4 text-center text-slate-500 text-[12px]">${formatValue(dutyPrepaid)}</td>
                    <td class="p-4 text-center font-bold text-green-600 text-[12px]">${formatValue(paid)}</td>
                    <td class="p-4 text-center font-bold text-[12px] ${balance > 0 ? 'text-red-500' : 'text-slate-400'}">${formatValue(balance)}</td>
                    <td class="p-4 text-center">
                        <button onclick="event.stopPropagation(); window.onConfirmRow(${originalIndex}, ${JSON.stringify(rowData).replace(/"/g, '&quot;')})" 
                            class="px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-tighter shadow-sm transition-all border ${rowStatus === 'PENDENTE' ? 'bg-white text-slate-400 border-slate-200 hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-600' : (rowStatus === 'CONFIRMADO' ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-600 hover:text-white' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white')}">
                            ${rowStatus}
                        </button>
                    </td>
                </tr>
            `;
        });

        let projectName = 'Folha';
        const breadcrumbSpan = document.querySelector('#confirm-breadcrumb > span.hover\\:text-black.cursor-pointer.transition-colors');
        if (breadcrumbSpan) {
            projectName = breadcrumbSpan.innerText.trim();
        }
        const combinedInfo = `${client.no || ''} - ${projectName}`.replace(/(^ - )|( - $)/g, '').trim();

        let bankValue = '';
        let accountTerm = '';
        if (client.rows && client.rows.length > 0) {
            let rawBank = getRaw(client.rows[0].originalRow, bankDutyIdx);
            if (rawBank !== '—') {
                let parts = String(rawBank).toUpperCase().replace('BOSS', 'FILIPE').trim().split(/\s+/);
                bankValue = parts[0];
                if (parts.length > 1) accountTerm = parts.slice(1).join(' ');
            }
        }

        let targetAmount = totalAmountDuty; // Baseamos o alvo no total do dever (Duty)
        if (totalPaid > 0) targetAmount = totalPaid; // Se já tiverem preenchido o pago, usamos o pago
        if (totalDutyPrepaid > 0) targetAmount = totalDutyPrepaid; // Se for prepaid, o alvo é o prepaid

        // Buscar todos os pagamentos já alocados a este cliente
        const payments = await getPaymentsByAllocatedTo(combinedInfo);
        let totalAllocated = 0;
        let pbHtml = '';

        if (payments && payments.length > 0) {
            payments.forEach(p => totalAllocated += p.amount);

            // Lógica para carregar detalhes de partilha (siblings)
            // Vamos carregar em background para não travar a UI
            setTimeout(async () => {
                for (const p of payments) {
                    if (p.reference && p.reference.includes("(Ref Mestre:")) {
                        const siblings = await getPaymentsByMasterRef(p.reference);
                        if (siblings.length > 1) {
                            const containerId = `siblings-${p.id}`;
                            const el = document.getElementById(containerId);
                            if (el) {
                                let sibHtml = `
                                    <div class="mt-2 pt-2 border-t border-blue-100">
                                        <div class="text-[9px] font-black text-blue-400 uppercase mb-1">Divisão deste Pagamento:</div>
                                        <div class="space-y-1">
                                `;
                                let originalTotal = 0;
                                siblings.forEach(s => {
                                    originalTotal += s.amount;
                                    const isCurrent = s.id === p.id;
                                    const dest = s.allocated_to || '<span class="text-blue-400 italic">Livre / Não Alocado</span>';
                                    sibHtml += `
                                        <div class="flex justify-between items-center text-[10px] ${isCurrent ? 'bg-blue-100 px-1 rounded' : ''}">
                                            <span class="truncate max-w-[120px]">${dest}</span>
                                            <span class="font-bold">${formatValue(s.amount)}</span>
                                        </div>
                                    `;
                                });
                                sibHtml += `
                                        <div class="flex justify-between items-center text-[10px] font-black text-blue-800 pt-1 border-t border-blue-200 mt-1">
                                            <span>TOTAL ORIGINAL:</span>
                                            <span>${formatValue(originalTotal)}</span>
                                        </div>
                                    </div>
                                </div>`;
                                el.innerHTML = sibHtml;
                            }
                        }
                    }
                }
            }, 100);

            pbHtml = `
                <div class="mb-4 p-4 border border-blue-100 bg-blue-50 rounded-xl shadow-inner">
                    <div class="flex justify-between items-center mb-4 border-b border-blue-100 pb-2">
                        <h5 class="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Detalhes de Reconciliação</h5>
                        <span class="text-[10px] font-bold text-blue-600 bg-blue-200 px-3 py-1 rounded-full">${payments.length} Pagamento(s)</span>
                    </div>
                    <div class="space-y-4">
            `;

            payments.forEach((payment, idx) => {
                pbHtml += `
                    <div class="grid grid-cols-2 gap-2 text-[11px] text-blue-900 ${idx !== payments.length - 1 ? 'border-b border-blue-100 pb-3' : ''}">
                        <div><span class="font-bold text-blue-700">Banco:</span> ${payment.bank || '---'}</div>
                        <div><span class="font-bold text-blue-700">Titular da Conta:</span> ${payment.account_owner || '---'}</div>
                        <div><span class="font-bold text-blue-700">Valor (MZN):</span> ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(payment.amount)}</div>
                        <div><span class="font-bold text-blue-700">Data:</span> ${payment.date ? payment.date.split(' ')[0] : '---'}</div>
                        <div class="col-span-2"><span class="font-bold text-blue-700">Referência:</span> ${payment.reference || payment.description || '---'}</div>
                        <div class="col-span-2" id="siblings-${payment.id}"></div>
                    </div>
                `;
            });

            pbHtml += `</div></div>`;
        }

        let remainingToPay = targetAmount - totalAllocated;
        if (remainingToPay < 0) remainingToPay = 0;

        let cardBorder = "border-green-500";
        let textColor = "text-green-600";
        let titleLabel = "Somatório Total (PAID)";

        if (totalDutyPrepaid > 0) {
            cardBorder = "border-gray-200 bg-gray-50";
            textColor = "text-gray-400";
            titleLabel = "Duty Prepaid";
            // Não permitiremos clique abaixo
        }

        let cardClick = '';
        let cardCursor = '';
        let displayValueHtml = '';

        // Lógica de Interação: 
        if (totalDutyPrepaid > 0) {
            // 1. Caso seja Duty Prepaid (Pago na China)
            cardClick = "";
            cardCursor = "cursor-default opacity-60";
            displayValueHtml = formatValue(targetAmount);
            titleLabel = "Duty Prepaid (Pago na China)";
        } else if (remainingToPay <= 0 && targetAmount > 0) {
            // 2. Caso o pagamento já tenha sido concluído
            cardClick = "";
            cardCursor = "cursor-default opacity-60";
            cardBorder = "border-gray-200 bg-gray-50";
            textColor = "text-gray-400";
            titleLabel = "Pagamento Concluído";
            displayValueHtml = formatValue(targetAmount);
        } else {
            // 3. Caso esteja Pendente ou seja uma nova ordem (targetAmount = 0)
            cardClick = `onclick="ui.openPaymentMiniFilter('${combinedInfo.replace(/'/g, "\\'")}', '${bankValue}', '${remainingToPay}', '')"`;
            cardCursor = "cursor-pointer hover:shadow-xl hover:translate-y-[-2px] transition-all";

            if (payments && payments.length > 0) {
                displayValueHtml = `
                    <div class="text-[12px] text-gray-500 mb-1 font-semibold uppercase">Falta Pagar</div>
                    ${formatValue(remainingToPay)}
                    <div class="text-[10px] text-blue-500 mt-2 font-semibold">Total Esperado: ${formatValue(targetAmount)}</div>
                `;
                titleLabel = "Pagamento Parcial Pendente";
            } else {
                displayValueHtml = formatValue(targetAmount);
            }
        }

        const summaryCardHtml = `
            <!-- Somatório Focado -->
            <div id="summary-cards" class="flex justify-end mt-6 mr-4 mb-2">
                <div ${cardClick} class="${cardCursor} bg-white p-6 rounded-xl border-2 ${cardBorder} shadow-lg min-w-[300px]">
                    <p class="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest text-center">${titleLabel}</p>
                    <div class="text-4xl font-black ${textColor} text-center">
                        ${displayValueHtml}
                    </div>
                </div>
            </div>
        ` || '';

        // Estrutura HTML baseada no template do utilizador
        body.innerHTML = `
            <div id="payment-info-container">${pbHtml}</div>
            <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-slate-50 border-bottom border-slate-200 text-slate-500">
                        <tr>
                            <th class="p-4 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">Order Number</th>
                            <th class="p-4 text-[11px] font-bold uppercase tracking-wider text-center border-b border-slate-200">CBM</th>
                            <th class="p-4 text-[11px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Amount Duty</th>
                            <th class="p-4 text-[11px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Duty Prepaid</th>
                            <th class="p-4 text-[11px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Paid</th>
                            <th class="p-4 text-[11px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Balance</th>
                            <th class="p-4 text-[11px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Confirmação</th>
                        </tr>
                    </thead>
                    <tbody id="orders-tbody" class="divide-y divide-slate-100">
                        ${tbodyHtml}
                    </tbody>
                </table>
            </div>
            
            ${summaryCardHtml}

            <p class="text-right text-[10px] text-slate-400 mt-2 mr-4 italic pb-4">* Clique em uma linha para visualizar ou editar os valores</p>
        `;
    }

    showView('view-confirm-client-detail');

    // Abrir pasta automaticamente se existir número e nome
    if (window.autoOpenClientFolder) {
        window.autoOpenClientFolder(client.no || '', client.displayName);
    }
}

// === LÓGICA DO MODAL DE EDIÇÃO DE DUTY === //

export function openConfirmEditModal(index) {
    const o = window.currentClientRows[index];
    if (!o) return;

    document.getElementById('edit-index').value = index;
    document.getElementById('edit-orderNumber').value = o.orderNumber;
    document.getElementById('edit-cbm').value = o.cbm;
    document.getElementById('edit-unitDuty').value = o.unitDuty;
    document.getElementById('edit-dutyPrepaid').value = o.dutyPrepaid;
    document.getElementById('edit-amountDuty').value = o.amountDuty;
    document.getElementById('edit-paid').value = o.paid;
    document.getElementById('edit-balance').value = o.balance;

    document.getElementById('confirm-edit-modal').classList.remove('hidden');
}

export function closeConfirmEditModal() {
    document.getElementById('confirm-edit-modal').classList.add('hidden');
}

export function calculateConfirmDuty() {
    const cbm = parseFloat(document.getElementById('edit-cbm').value) || 0;
    const unitDuty = parseFloat(document.getElementById('edit-unitDuty').value) || 0;
    const paid = parseFloat(document.getElementById('edit-paid').value) || 0;

    const amount = cbm * unitDuty;
    const bal = amount - paid;

    document.getElementById('edit-amountDuty').value = amount.toFixed(2);
    document.getElementById('edit-balance').value = bal.toFixed(2);
}

export async function saveConfirmOrderEdit(e) {
    e.preventDefault();
    
    const index = parseInt(document.getElementById('edit-index').value);
    const o = window.currentClientRows[index];
    if (!o) return;

    const btn = document.getElementById('btn-confirm-edit-save');
    setBtnLoading(btn, true, "A gravar...");
    setLoader(true, "A atualizar Google Sheets...");

    const cbm = parseFloat(document.getElementById('edit-cbm').value) || 0;
    const unitDuty = parseFloat(document.getElementById('edit-unitDuty').value) || 0;
    const dutyPrepaid = parseFloat(document.getElementById('edit-dutyPrepaid').value) || 0;
    const amountDuty = parseFloat(document.getElementById('edit-amountDuty').value) || 0;
    const paid = parseFloat(document.getElementById('edit-paid').value) || 0;
    const balance = parseFloat(document.getElementById('edit-balance').value) || 0;

    // 1. Identificar colunas no GSheet
    const cols = state.confirm.columns;
    const cbmIdx = cols.findIndex(c => String(c).includes('CBM'));
    const unitDutyIdx = cols.findIndex(c => String(c).includes('UNIT DUTY'));
    const dutyPrepaidIdx = cols.findIndex(c => String(c).includes('DUTY PREPAID'));
    const amountDutyIdx = cols.findIndex(c => String(c).includes('AMOUNT DUTY'));
    const paidIdx = cols.findIndex(c => (String(c).toUpperCase().includes('PAID') || String(c).toUpperCase().includes('PAGO')) && !String(c).toUpperCase().includes('DUTY'));
    const balanceIdx = cols.findIndex(c => String(c).includes('BALANCE'));

    // 2. Preparar valores para a linha específica
    const rowData = [...state.confirm.data[o.originalIndex]];
    if (cbmIdx !== -1) rowData[cbmIdx] = cbm;
    if (unitDutyIdx !== -1) rowData[unitDutyIdx] = unitDuty;
    if (dutyPrepaidIdx !== -1) rowData[dutyPrepaidIdx] = dutyPrepaid;
    if (amountDutyIdx !== -1) rowData[amountDutyIdx] = amountDuty;
    if (paidIdx !== -1) rowData[paidIdx] = paid;
    if (balanceIdx !== -1) rowData[balanceIdx] = balance;

    try {
        const spreadsheetId = state.confirm.sheetId;
        const sheetName = state.confirm.range.split('!')[0] || 'Folha1';
        const rowNum = o.originalIndex + 1;
        const range = `${sheetName}!A${rowNum}:Z${rowNum}`;

        await updateGSheet(spreadsheetId, range, [rowData]);
        
        // Atualizar estado local
        state.confirm.data[o.originalIndex] = rowData;
        o.cbm = cbm;
        o.unitDuty = unitDuty;
        o.dutyPrepaid = dutyPrepaid;
        o.amountDuty = amountDuty;
        o.paid = paid;
        o.balance = balance;

        toast("Alterações gravadas com sucesso no Google Sheets!", "success");
        closeConfirmEditModal();
        
        // Re-renderizar os detalhes do cliente
        const currentClient = { 
            displayName: document.getElementById('confirm-client-detail-name').innerText,
            displayIdCode: document.getElementById('confirm-client-detail-id').innerText.replace('ID CODE: ', ''),
            rows: window.currentClientRows.map(r => ({ ...r, originalRow: state.confirm.data[r.originalIndex] }))
        };
        const breadcrumbText = document.getElementById('confirm-breadcrumb').innerText;
        const clientIdx = parseInt(breadcrumbText.split(' ')[1] || 0);
        showConfirmDetail(currentClient, clientIdx);

    } catch (err) {
        console.error(err);
        toast("Erro ao gravar no Google Sheets: " + err.message, "error");
    } finally {
        setLoader(false);
        setBtnLoading(btn, false);
    }
}

export function openConfirmTotalModal() {
    const t = document.getElementById('confirm-toast');
    if (t) {
        t.innerText = "Funcionalidade de confirmação total em desenvolvimento.";
        t.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
    }
}


export function renderDriveFiles(files, currentFolderId, containerId = 'confirm-drive-files') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!files || files.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center">
                <p class="text-gray-400 italic mb-4">Nenhum ficheiro encontrado nesta pasta.</p>
                <button onclick="window.triggerFileUpload('${currentFolderId}')" 
                    class="bg-black text-white px-4 py-2 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center gap-2 mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    ADICIONAR SUPORTE
                </button>
            </div>
        `;
        return;
    }

    files.forEach(file => {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const div = document.createElement('div');
        div.className = "flex items-center gap-3 p-2 border border-gray-200 rounded-lg hover:border-black transition-all bg-white cursor-pointer group";

        div.onclick = (e) => {
            if (isFolder) {
                window.navigateToFolder(file.id);
            } else {
                window.showFilePreview(file);
            }
        };

        const iconColor = isFolder ? 'text-blue-500' : 'text-gray-400';

        div.innerHTML = `
            <div class="${iconColor}">
                ${isFolder ?
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>' :
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>'
            }
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold truncate text-gray-700 group-hover:text-black text-xs">${file.name}</p>
                <p class="text-[7px] text-gray-400 uppercase">${isFolder ? 'Pasta' : 'Documento'}</p>
            </div>
            
            <div class="flex items-center gap-2">
                ${!isFolder ? `
                    <button onclick="event.stopPropagation(); window.confirmAndDeleteFile('${file.id}', '${file.name}', '${currentFolderId}')" 
                        class="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-lg opacity-0 group-hover:opacity-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                ` : ''}
                <div class="text-gray-300 group-hover:text-black transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

/**
 * Renderiza estado de erro/pasta não encontrada com opção de criar
 */
export function renderDriveError(message, folderName = null, parentId = null, containerId = 'confirm-drive-files') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let actionHtml = '';
    if (folderName && parentId) {
        actionHtml = `
            <button onclick="window.handleCreateFolder('${folderName.replace(/'/g, "\\'")}', '${parentId}')" 
                class="mt-4 bg-black text-white px-4 py-2 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center gap-2 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                CRIAR PASTA DO CLIENTE
            </button>
        `;
    }

    container.innerHTML = `
        <div class="p-8 text-center">
            <p class="text-gray-400 italic text-[10px] leading-tight">${message}</p>
            ${actionHtml}
        </div>
    `;
}

/**
 * Alterna a visualização lateral do Drive dentro do Mini-Filtro
 */
export async function toggleMiniFilterDrive() {
    const side = document.getElementById('mini-filter-drive-side');
    const container = document.getElementById('mini-filter-container');
    const content = document.getElementById('mini-filter-drive-content');

    if (!side || !container) return;

    const isOpen = side.classList.contains('w-80');

    if (!isOpen) {
        // ABRIR
        side.classList.remove('w-0');
        side.classList.add('w-80');
        container.classList.remove('max-w-3xl');
        container.classList.add('max-w-6xl');

        // Carregar conteúdo se houver uma pasta ativa
        if (state.confirm.activeClientFolderId) {
            content.innerHTML = '<div class="text-center py-10 text-slate-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">A carregar suportes...</div>';
            try {
                // Chamamos a API via window.listGDriveFiles (que está exposta no app.js ou api.js)
                const files = await listGDriveFiles(state.confirm.activeClientFolderId);
                renderDriveFiles(files, state.confirm.activeClientFolderId, 'mini-filter-drive-content');
            } catch (err) {
                renderDriveError("Erro ao carregar suportes.", null, null, 'mini-filter-drive-content');
            }
        } else {
            renderDriveError("Nenhuma pasta de cliente vinculada.", null, null, 'mini-filter-drive-content');
        }
    } else {
        // FECHAR
        side.classList.remove('w-80');
        side.classList.add('w-0');
        container.classList.remove('max-w-6xl');
        container.classList.add('max-w-3xl');
    }
}

export function renderConfirmProjects(projects, isSearch = false) {
    const container = document.getElementById('confirm-projects-list');
    if (!container) return;

    // Guardar no estado apenas se não for uma pesquisa (para manter a lista completa)
    if (!isSearch) {
        if (!state.confirm) state.confirm = {};
        state.confirm.projects = projects;
    }

    container.innerHTML = '';

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhum projeto gravado.</p>
                <button onclick="openConfirmProjectModal()" class="mt-4 text-blue-600 font-bold uppercase text-[10px] hover:underline">+ Adicionar Primeiro Projeto</button>
            </div>
        `;
        return;
    }

    projects.forEach(p => {
        const card = document.createElement('div');
        // Card inteiro clicável
        card.className = "bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group transition-all hover:shadow-md hover:border-black hover:bg-slate-50 cursor-pointer active:scale-[0.98]";
        card.onclick = () => selectConfirmProject(p.sheetId, p.folderId, p.name.replace(/'/g, "\\'"));

        card.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="bg-yellow-400 text-black w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                </div>
                <div class="overflow-hidden">
                    <h3 class="text-sm font-black text-slate-800 tracking-tight leading-none truncate group-hover:text-black transition-colors">${p.name}</h3>
                </div>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
                <button onclick="event.stopPropagation(); openConfirmProjectModal('${p.id}')" 
                    class="w-8 h-8 bg-slate-50 text-slate-300 rounded-lg flex items-center justify-center hover:bg-black hover:text-white transition-all border border-slate-100 active:scale-90">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
            </div>
        `;
        container.appendChild(card);
    });


}


export function showFilePreview(file) {
    // Verificar se o mini-filtro está aberto
    const miniFilter = document.getElementById('payment-mini-filter');
    const isMiniFilterActive = miniFilter && !miniFilter.classList.contains('hidden');

    if (isMiniFilterActive) {
        renderFilePreviewInSidebar(file);
        return;
    }

    const modal = document.getElementById('modal-file-preview');
    const content = document.getElementById('preview-content');
    const filenameEl = document.getElementById('preview-filename');
    const downloadLink = document.getElementById('preview-download-link');
    const ocrBtn = document.getElementById('btn-ocr-extract');

    if (!modal || !content || !filenameEl) return;

    filenameEl.innerText = file.name;
    if (downloadLink) downloadLink.href = `/api/google/drive/file/${file.id}`;
    content.innerHTML = '<div class="text-xs font-bold animate-pulse">A CARREGAR PRÉ-VISUALIZAÇÃO...</div>';

    if (ocrBtn) ocrBtn.classList.add('hidden');

    openModal('modal-file-preview');

    const isImage = file.mimeType.startsWith('image/');
    const isPDF = file.mimeType === 'application/pdf';

    if (isImage) {
        // Para imagens, usamos tag <img> direta para permitir OCR e cópia nativa
        const imgUrl = `/api/google/drive/file/${file.id}`;
        content.innerHTML = `<img id="preview-img-ocr" src="${imgUrl}" class="max-w-full max-h-full object-contain rounded-lg shadow-lg" crossorigin="anonymous">`;

        if (ocrBtn) {
            ocrBtn.classList.remove('hidden');
            ocrBtn.onclick = async () => {
                const originalText = ocrBtn.innerText;
                ocrBtn.innerText = "A PROCESSAR...";
                ocrBtn.disabled = true;

                try {
                    const img = document.getElementById('preview-img-ocr');
                    // @ts-ignore
                    const worker = await Tesseract.createWorker('por');
                    const ret = await worker.recognize(img.src);
                    const text = ret.data.text;
                    await worker.terminate();

                    if (text.trim()) {
                        await navigator.clipboard.writeText(text);
                        ocrBtn.innerText = "COPIADO!";
                        ocrBtn.classList.replace('bg-purple-600', 'bg-green-600');
                    } else {
                        ui.toast("Não foi possível extrair texto legível desta imagem.", "warning");
                        ocrBtn.innerText = originalText;
                    }
                } catch (err) {
                    console.error("Erro no OCR:", err);
                    ui.toast("Erro ao processar imagem para OCR.", "error");
                    ocrBtn.innerText = originalText;
                } finally {
                    ocrBtn.disabled = false;
                    setTimeout(() => {
                        ocrBtn.innerText = "COPIAR TEXTO (OCR)";
                        ocrBtn.classList.replace('bg-green-600', 'bg-purple-600');
                    }, 2000);
                }
            };
        }
    } else if (isPDF) {
        // Para PDFs, usamos o endpoint local para que o browser utilize o seu visualizador nativo.
        // O visualizador nativo (Chrome/Edge/Firefox) permite selecionar e copiar texto.
        const pdfUrl = `/api/google/drive/file/${file.id}`;
        content.innerHTML = `<iframe src="${pdfUrl}" class="w-full h-full border-0 rounded-lg shadow-lg"></iframe>`;
    } else {
        content.innerHTML = `<div class="p-10 text-center text-slate-400 font-bold uppercase text-xs">Pré-visualização não suportada para este tipo de ficheiro.</div>`;
    }
}

/**
 * Renderiza a pré-visualização dentro da barra lateral do mini-filtro
 */
function renderFilePreviewInSidebar(file) {
    const content = document.getElementById('mini-filter-drive-content');
    if (!content) return;

    const isImage = file.mimeType.startsWith('image/');
    const isPDF = file.mimeType === 'application/pdf';
    const fileUrl = `/api/google/drive/file/${file.id}`;

    let previewHtml = '';
    if (isImage) {
        previewHtml = `<img src="${fileUrl}" class="w-full rounded-lg shadow-md border border-slate-200">`;
    } else if (isPDF) {
        // Usar o visualizador nativo do browser dentro de um iframe
        previewHtml = `<iframe src="${fileUrl}" class="w-full h-[600px] border border-slate-200 rounded-lg shadow-inner"></iframe>`;
    } else {
        previewHtml = `
            <div class="p-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                <p class="text-[10px] font-black text-slate-300 uppercase">Pré-visualização não disponível</p>
            </div>
        `;
    }

    content.innerHTML = `
        <div class="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <button onclick="ui.backToDriveList()" class="self-start flex items-center gap-1 text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Voltar aos Ficheiros
            </button>
            
            <div class="flex flex-col gap-2">
                <h5 class="text-[10px] font-black uppercase text-slate-400 truncate tracking-tight px-1">${file.name}</h5>
                <div class="bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                    ${previewHtml}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <a href="${fileUrl}" target="_blank" class="bg-slate-900 text-white text-center py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all">Abrir Original</a>
                <button onclick="ui.backToDriveList()" class="bg-slate-100 text-slate-500 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Fechar</button>
            </div>
        </div>
    `;
}

/**
 * Volta para a lista de ficheiros dentro do mini-filtro
 */
export async function backToDriveList() {
    const content = document.getElementById('mini-filter-drive-content');
    if (!content || !state.confirm.activeClientFolderId) return;

    content.innerHTML = '<div class="text-center py-10 text-slate-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">A carregar lista...</div>';

    try {
        const files = await listGDriveFiles(state.confirm.activeClientFolderId);
        renderDriveFiles(files, state.confirm.activeClientFolderId, 'mini-filter-drive-content');
    } catch (err) {
        renderDriveError("Erro ao recarregar ficheiros.", null, null, 'mini-filter-drive-content');
    }
}

/**
 * --- MÓDULO BANK DASHBOARD ---
 */

/**
 * Mostra o Dashboard de Banco
 */
export async function showBankDashboard() {
    showView('view-bank-dashboard');

    // Resetar campos de busca ao entrar
    const searchInput = document.getElementById('input-bank-search');
    const bankSelect = document.getElementById('select-bank-filter');
    if (searchInput) searchInput.value = '';
    if (bankSelect) bankSelect.value = '';

    setLoader(true);
    try {
        // Por definição, puxar os últimos 10 para poupar tempo
        await listBankIncomes('', 10);
        renderBankIncomes();
        renderBankOwnerSummary();
    } catch (error) {
        console.error('[BANK] Erro ao carregar dados:', error);
    } finally {
        setLoader(false);
    }
}

/**
 * Atualiza os dados bancários com base nos filtros (Busca no Servidor)
 */
export async function refreshBankData() {
    const searchTerm = document.getElementById('input-bank-search')?.value || '';
    const bankFilter = document.getElementById('select-bank-filter')?.value || '';

    // Só enviamos filtro de busca ao PocketBase; o filtro de banco será aplicado localmente
    let pbFilter = '';
    if (searchTerm) {
        pbFilter = `(description ~ "${searchTerm}" || reference ~ "${searchTerm}" || order_id ~ "${searchTerm}")`;
    }

    // Se estiver filtrando, buscamos mais registros (ex: 100). Se não, apenas 10.
    const limit = (searchTerm || bankFilter) ? 100 : 10;

    // Não usamos loader aqui para a busca ser mais fluida (ou usamos um loader menor)
    try {
        await listBankIncomes(pbFilter, limit);
        renderBankIncomes();
        renderBankOwnerSummary();
    } catch (error) {
        console.error('[BANK] Erro na filtragem:', error);
    }
}

/**
 * Processa o upload de um extrato bancário
 */
export async function handleBankUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const btn = document.getElementById('btn-bank-upload');
    setBtnLoading(btn, true, "A processar...");
    setLoader(true, "A analisar ficheiro...");
    
    try {
        const data = await uploadBankStatement(file);

        if (data && data.length > 0) {
            setLoader(true, `A gravar ${data.length} movimentos...`);
            let countNew = 0;
            let countDup = 0;
            for (const item of data) {
                try {
                                        const result = await saveBankIncome(item);
                    // PocketBase returns `created` and `updated` timestamps.
                    // New record: timestamps are almost equal (<1s). Existing record: `created` is older.
                    const isNew = result && result.created && result.updated && (new Date(result.updated) - new Date(result.created) < 2000);
                    if (isNew) countNew++; else countDup++;
                } catch (e) {
                    console.warn('[BANK] Erro ao gravar item:', e.message);
                }
            }
            toast(`Importação concluída! Novos: ${countNew}, Duplicados: ${countDup}`, countNew > 0 ? 'success' : 'warning');
            await showBankDashboard();
        } else {
            toast("Nenhuma entrada de crédito encontrada no ficheiro.", "warning");
        }
    } catch (error) {
        toast("Erro no processamento: " + error.message, "error");
    } finally {
        setLoader(false);
        setBtnLoading(btn, false);
        input.value = '';
    }
}

/**
 * Renderiza a tabela de entradas bancárias
 */
export function renderBankIncomes() {
    const container = document.getElementById('bank-incomes-container');
    if (!container) return;

    // Os dados já vêm filtrados do servidor pelo refreshBankData, 
    // mas mantemos uma filtragem local básica para o que já está na memória
    const searchTerm = document.getElementById('input-bank-search')?.value.toUpperCase() || '';
    const bankFilter = document.getElementById('select-bank-filter')?.value || '';

    const filtered = state.bank.incomes.filter(item => {
        const matchesSearch = !searchTerm ||
            item.description.toUpperCase().includes(searchTerm) ||
            item.order_id.toUpperCase().includes(searchTerm) ||
            item.reference.toUpperCase().includes(searchTerm);
        const matchesBank = !bankFilter || item.bank === bankFilter;
        return matchesSearch && matchesBank;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="py-20 text-center">
                <p class="text-gray-400 text-xs font-bold uppercase tracking-widest italic">Nenhum registo encontrado</p>
                ${(searchTerm || bankFilter) ? `<button onclick="ui.refreshBankData()" class="mt-4 text-purple-600 font-black text-[10px] uppercase underline">Tentar busca profunda</button>` : ''}
            </div>
        `;
        return;
    }

    let html = `
        <table class="min-w-full text-left text-[10px] font-bold uppercase tracking-tighter">
            <thead class="bg-gray-50 text-gray-400">
                <tr>
                    <th class="py-3 px-4">Data</th>
                    <th class="py-3 px-4">Banco</th>
                    <th class="py-3 px-4">Descrição</th>
                    <th class="py-3 px-4">Montante</th>
                    <th class="py-3 px-4">Saldo</th>
                    <th class="py-3 px-4 text-center">Ordem</th>
                    <th class="py-3 px-4 text-center">Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
    `;

    filtered.forEach(item => {
        const amountClass = "text-purple-700 font-black";
        const statusClass = item.reconciled ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700";
        const statusText = item.reconciled ? "CONCILIADO" : "PENDENTE";

        html += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="py-3 px-4 text-gray-500 whitespace-nowrap">${item.date.split(' ')[0]}</td>
                <td class="py-3 px-4"><span class="bg-gray-100 px-2 py-1 rounded">${item.bank}</span></td>
                <td class="py-3 px-4 text-gray-900 max-w-xs truncate" title="${item.description}">${item.description}</td>
                <td class="py-3 px-4 ${amountClass}">${formatMZN(item.amount)}</td>
                <td class="py-3 px-4 text-gray-400">${formatMZN(item.balance)}</td>
                <td class="py-3 px-4 text-center">
                    ${item.order_id ? `<span class="bg-purple-100 text-purple-700 px-2 py-1 rounded">${item.order_id}</span>` : '<span class="text-gray-200">---</span>'}
                </td>
                <td class="py-3 px-4 text-center">
                    <span class="px-2 py-1 rounded-full text-[8px] font-black ${statusClass}">${statusText}</span>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Renderiza o resumo por titular
 */
export function renderBankOwnerSummary() {
    const container = document.getElementById('bank-owner-summary');
    if (!container) return;

    const owners = {};
    state.bank.incomes.forEach(item => {
        if (!owners[item.account_owner]) owners[item.account_owner] = 0;
        owners[item.account_owner] += item.amount;
    });

    let html = '';
    Object.entries(owners).forEach(([name, total]) => {
        html += `
            <div class="flex flex-col">
                <span class="text-[9px] font-bold text-gray-500 truncate">${name}</span>
                <span class="text-sm font-black text-gray-900">${formatMZN(total)}</span>
            </div>
        `;
    });

    if (html === '') html = '<div class="text-[9px] text-gray-300 italic">Sem dados.</div>';
    container.innerHTML = html;
}

// === LÓGICA DO MINI-FILTRO DE PAGAMENTOS === //

let selectedPaymentIdForLink = null;
let selectedPaymentDate = null;
let selectedPaymentRef = null;
let selectedPaymentMaxAmount = 0;
let searchPaymentTimeout = null;
let currentMiniFilterExpectedAmount = 0;

export function openPaymentMiniFilter(combinedInfo, defaultBank = '', defaultAmount = '', defaultTerm = '') {
    document.getElementById('payment-mini-filter').classList.remove('hidden');

    currentMiniFilterExpectedAmount = parseFloat(defaultAmount) || 0;

    // Atualizar opções do banco (para aceitar qualquer valor além dos default)
    const bankSelect = document.getElementById('mini-filter-bank');
    if (defaultBank && !Array.from(bankSelect.options).some(opt => opt.value === defaultBank)) {
        const newOpt = new Option(defaultBank, defaultBank);
        bankSelect.add(newOpt);
    }

    bankSelect.value = defaultBank;
    document.getElementById('mini-filter-amount').value = defaultAmount;
    document.getElementById('mini-filter-search').value = defaultTerm;

    document.getElementById('mini-filter-results').innerHTML = '';
    document.getElementById('mini-filter-empty').classList.add('hidden');
    document.getElementById('mini-filter-combined-info').value = combinedInfo;

    // Reset campos de alocação
    document.getElementById('mini-filter-allocate-amount').value = '';
    document.getElementById('mini-filter-max-available').innerText = '0.00';
    if (document.getElementById('mini-filter-status')) {
        document.getElementById('mini-filter-status').value = 'CONFIRMADO';
        document.getElementById('mini-filter-comment-container')?.classList.add('hidden');
        document.getElementById('mini-filter-comment').value = '';
    }

    selectedPaymentIdForLink = null;
    selectedPaymentDate = null;
    selectedPaymentMaxAmount = 0;

    searchPaymentMiniFilter();
}

export async function searchPaymentMiniFilter() {
    const bank = document.getElementById('mini-filter-bank').value.trim();
    const amount = document.getElementById('mini-filter-amount').value.trim();
    const term = document.getElementById('mini-filter-search').value.trim();

    const tbody = document.getElementById('mini-filter-results');
    const emptyMsg = document.getElementById('mini-filter-empty');

    clearTimeout(searchPaymentTimeout);

    searchPaymentTimeout = setTimeout(async () => {
        try {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">A procurar...</td></tr>';
            emptyMsg.classList.add('hidden');

            const results = await searchPayments(bank, amount, term);
            tbody.innerHTML = '';

            if (results.length === 0) {
                emptyMsg.classList.remove('hidden');
                return;
            }

            results.forEach(rec => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-50';

                const refText = rec.reference || rec.description || '';
                tr.onclick = () => selectPaymentResult(rec.id, rec.date, refText, tr, rec.amount);

                // Formatar Data
                const dateStr = rec.date ? rec.date.split(' ')[0] : '—';
                const amountFormatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(rec.amount);

                tr.innerHTML = `
                    <td class="px-4 py-3 whitespace-nowrap">${dateStr}</td>
                    <td class="px-4 py-3 font-semibold text-slate-700">${rec.bank || '—'}</td>
                    <td class="px-4 py-3 text-slate-600 truncate max-w-xs" title="${rec.description}">${rec.description || rec.reference || '—'}</td>
                    <td class="px-4 py-3 text-right font-bold text-green-600">${amountFormatted}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error("Erro na pesquisa do mini-filtro:", error);
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-400">Erro ao procurar pagamentos.</td></tr>';
        }
    }, 300);
}

export function selectPaymentResult(id, date, ref, trElement, fullAmount) {
    selectedPaymentIdForLink = id;
    selectedPaymentDate = date;
    selectedPaymentRef = ref;
    selectedPaymentMaxAmount = parseFloat(fullAmount);

    // Destacar linha
    const tbody = document.getElementById('mini-filter-results');
    Array.from(tbody.rows).forEach(r => r.classList.remove('bg-blue-100', 'border-blue-200'));
    trElement.classList.add('bg-blue-100', 'border-blue-200');

    // Preencher campo de alocação com o valor sugerido
    const suggested = Math.min(currentMiniFilterExpectedAmount, selectedPaymentMaxAmount);
    document.getElementById('mini-filter-allocate-amount').value = suggested.toFixed(2);
    document.getElementById('mini-filter-max-available').innerText = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPaymentMaxAmount);
}

export async function confirmPaymentSelection() {
    const status = document.getElementById('mini-filter-status').value;
    const combinedInfo = document.getElementById('mini-filter-combined-info').value;
    const allocatedAmount = parseFloat(document.getElementById('mini-filter-allocate-amount').value) || 0;

    if (status === 'CONFIRMADO') {
        if (!selectedPaymentIdForLink) {
            ui.toast('Para marcar como CONFIRMADO, selecione primeiro um pagamento na lista.', "warning");
            return;
        }




        if (allocatedAmount <= 0) {
            ui.toast("Por favor, insira um valor válido para alocar.", "warning");
            return;
        }

        if (allocatedAmount > selectedPaymentMaxAmount + 0.01) {
            ui.toast("O valor a alocar não pode ser superior ao valor disponível no pagamento.", "warning");
            return;
        }
    }

    const btn = document.querySelector('#payment-mini-filter button.bg-blue-600');

    try {
        setBtnLoading(btn, true, 'A processar...');
        setLoader(true, 'A gravar reconciliação...');

        // 1. Atualizar PocketBase com lógica de Split
        if (selectedPaymentIdForLink && allocatedAmount > 0) {
            await markPaymentReconciled(selectedPaymentIdForLink, combinedInfo, allocatedAmount);
        }

        // 2. Atualizar Google Sheet (marcar como CONFIRMADO e a DATA)
        if (window.currentClientRows && window.currentClientRows.length > 0) {
            const columns = state.confirm.columns || [];
            const columnsUpper = columns.map(c => String(c).toUpperCase().replace(/[^A-Z0-9\s-]/g, ''));
            
            // Deteção robusta de colunas
            const findStatusIdx = () => {
                const targets = ['CONFIRMATION', 'CONFIRMACAO', 'CONFIRM', 'STATUS'];
                for (const t of targets) {
                    const idx = columnsUpper.findIndex(c => c === t || c.includes(t));
                    if (idx !== -1) return idx;
                }
                return -1;
            };
            const statusIdx = findStatusIdx();

            const findPagIdx = (num) => {
                const target = `PAG ${num}`;
                const targetClean = `PAG${num}`;
                return columnsUpper.findIndex(c => 
                    c === target || 
                    c === targetClean || 
                    c.includes(target) || 
                    c.includes(`PAG-${num}`)
                );
            };

            const pag1Idx = findPagIdx(1);
            const pag2Idx = findPagIdx(2);
            const pag3Idx = findPagIdx(3);

            // Deteção de coluna de comentário/OBS
            const obsIdx = columnsUpper.findIndex(c => 
                c === 'OBS' || c === 'COMENTARIO' || c === 'NOTAS' || 
                c.includes('OBSERV') || c.includes('COMENT')
            );

            if (state.confirm.sheetId) {
                const getColLetter = (idx) => {
                    let colLetter = '';
                    while (idx >= 0) {
                        colLetter = String.fromCharCode(65 + (idx % 26)) + colLetter;
                        idx = Math.floor(idx / 26) - 1;
                    }
                    return colLetter;
                };

                let sheetName = '';
                if (state.confirm.range && state.confirm.range.includes('!')) {
                    sheetName = state.confirm.range.split('!')[0];
                }
                const prefix = sheetName ? `${sheetName}!` : '';

                // Formatar a data para o GSheet (MM/DD/YYYY) conforme solicitado
                let formattedDateForSheet = selectedPaymentDate;
                if (selectedPaymentDate) {
                    const d = new Date(selectedPaymentDate);
                    if (!isNaN(d.getTime())) {
                        const dd = String(d.getDate()).padStart(2, '0');
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const yyyy = d.getFullYear();
                        formattedDateForSheet = `${mm}/${dd}/${yyyy}`;
                    }
                }

                // Fazer o update para cada linha deste cliente
                for (const rowObj of window.currentClientRows) {
                    const sheetRowNumber = rowObj.originalIndex + 1;
                    const updates = [];

                    if (statusIdx !== -1) {
                        const newStatus = document.getElementById('mini-filter-status')?.value || 'CONFIRMADO';
                        updates.push({ idx: statusIdx, val: newStatus });
                    }

                    // Encontrar a primeira coluna PAG vazia
                    const pagIndices = [pag1Idx, pag2Idx, pag3Idx].filter(i => i !== -1);
                    let dateWritten = false;
                    for (const pIdx of pagIndices) {
                        const val = state.confirm.data[rowObj.originalIndex][pIdx];
                        if (!val || String(val).trim() === '') {
                            updates.push({ idx: pIdx, val: formattedDateForSheet });
                            dateWritten = true;
                            break;
                        }
                    }

                    // Se não houver PAG vazia mas as colunas existirem, sobrepõe a última
                    if (!dateWritten && pagIndices.length > 0) {
                        updates.push({ idx: pagIndices[pagIndices.length - 1], val: formattedDateForSheet });
                    }

                    // Enviar atualizações para o GSheet
                    for (const u of updates) {
                        const colLetter = getColLetter(u.idx);
                        const rangeToUpdate = `${prefix}${colLetter}${sheetRowNumber}`;

                        await updateGSheet(state.confirm.sheetId, rangeToUpdate, [[u.val]]);

                        // Atualizar estado local
                        state.confirm.data[rowObj.originalIndex][u.idx] = u.val;
                    }

                    // 3. Gerir a NOTA e a COR (DEPOIS de gravar os valores)
                    const comment = document.getElementById('mini-filter-comment')?.value || '';
                    if (statusIdx !== -1) {
                        try {
                            const cleanSheetName = sheetName.replace(/'/g, '');
                            
                            // Define a cor: Amarelo se tiver comentário, Branco se estiver vazio
                            const cellColor = comment.trim() !== '' ? 'yellow' : 'clear';
                            
                            // A chamada vai sempre acontecer para apagar a nota se estiver vazio
                            await updateGSheetNote(state.confirm.sheetId, cleanSheetName, rowObj.originalIndex, statusIdx, comment.trim(), cellColor);
                        } catch (noteErr) {
                            console.error("Erro ao gravar nota/cor:", noteErr);
                            ui.toast("Aviso: O status foi gravado, mas falhou ao atualizar a cor/nota na célula.", "warning");
                        }
                    }
                }
            }
        }

        closePaymentMiniFilter();

        // Mostrar toast
        const t = document.getElementById('confirm-toast');
        if (t) {
            t.innerText = "Pagamento vinculado e reconciliado com sucesso!";
            t.classList.remove('translate-y-20', 'opacity-0');
            setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
        }

        // Atualizar visualização preservando os filtros ativos
        if (typeof window.handleConfirmSearch === 'function') {
            window.handleConfirmSearch();
        } else {
            const termInput = document.getElementById('input-confirm-search');
            const term = termInput ? termInput.value.trim() : '';
            renderConfirmList(state.confirm.data, term);
        }
        
        // Mostrar a vista principal atualizada
        showView('view-confirm-table');

    } catch (e) {
        console.error('Erro ao vincular pagamento:', e);
        alert('Erro ao vincular pagamento: ' + e.message);
    } finally {
        setLoader(false);
        setBtnLoading(btn, false);
    }
}

export function closePaymentMiniFilter() {
    const side = document.getElementById('mini-filter-drive-side');
    const container = document.getElementById('mini-filter-container');
    const modal = document.getElementById('payment-mini-filter');

    if (side) {
        side.classList.remove('w-80');
        side.classList.add('w-0');
    }
    if (container) {
        container.classList.remove('max-w-6xl');
        container.classList.add('max-w-3xl');
    }
    if (modal) modal.classList.add('hidden');
}
