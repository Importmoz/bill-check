/**
 * Módulo de Interface e UI para Bill Check
 */
import { formatMZN, formatDateDisplay } from './utils.js';
import { state, pb, emitConfirmEvent, subscribeConfirmEvents, unsubscribeConfirmEvents, unsubscribeBankEvents, getSettingsUsers, uploadBankStatement, saveBankIncome, listBankIncomes, searchPayments, markPaymentReconciled, readGSheet, updateGSheet, updateGSheetBatch, updateGSheetNote, getPaymentsByAllocatedTo, getPaymentsByMasterRef, listGDriveFiles } from './api.js';

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
 * Retorna a letra da coluna correspondente ao índice (0 = A, 1 = B, etc.)
 */
export function getColLetter(idx) {
    let colLetter = '';
    while (idx >= 0) {
        colLetter = String.fromCharCode(65 + (idx % 26)) + colLetter;
        idx = Math.floor(idx / 26) - 1;
    }
    return colLetter;
}

/**
 * Copia texto para a área de transferência com notificação toast
 */
window.copyToClipboard = async function(text, successMsg = "Copiado para a área de transferência!") {
    try {
        await navigator.clipboard.writeText(text);
        toast(successMsg, "success");
    } catch (err) {
        console.error("Erro ao copiar para clipboard:", err);
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast(successMsg, "success");
        } catch (e) {
            toast("Erro ao copiar contacto.", "error");
        }
    }
};

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
    ['view-login', 'view-hub', 'view-dashboard', 'view-table', 'view-finance', 'view-team-dashboard', 'view-team-table', 'view-term-dashboard', 'view-term-table', 'view-confirm-dashboard', 'view-confirm-table', 'view-confirm-client-detail', 'view-bank-dashboard', 'view-settings', 'view-quote-dashboard', 'view-quote-form'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

/**
 * Mostra uma visão específica e oculta as restantes
 */
export function showView(viewId) {
    hideAllViews();
    
    // Se estivermos a sair do módulo CONFIRM (GSheet específico), cancelamos a subscrição
    if (!viewId.startsWith('view-confirm-')) {
        if (typeof unsubscribeConfirmEvents === 'function') {
            unsubscribeConfirmEvents();
        }
        if (typeof unsubscribeBankEvents === 'function') {
            unsubscribeBankEvents();
        }
        if (typeof window.stopGSheetPolling === 'function') {
            window.stopGSheetPolling();
        }
        window.activeConfirmLocks = {}; // Limpar memória de locks
    }
    
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
        else if (r.status === 'PAID') {
            totals.paid += balance;
            return; // Pular os registros pagos (Paid) para sumirem do mapa/tabela
        }

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

export function registerClientAccess(no, name) {
    try {
        const key = `confirm_client_access_${no}_${name.replace(/\s+/g, '_')}`;
        let count = parseInt(localStorage.getItem(key) || '0', 10);
        localStorage.setItem(key, count + 1);
    } catch (e) {
        console.error("Erro ao registrar acesso do cliente:", e);
    }
}
window.registerClientAccess = registerClientAccess;

export function setConfirmViewMode(mode) {
    if (!state.confirm) state.confirm = {};
    state.confirm.viewMode = mode;
    localStorage.setItem('confirm_view_mode', mode);

    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');
    const btnTable = document.getElementById('btn-view-table');

    if (btnGrid) btnGrid.className = `p-2 rounded-lg transition-all ${mode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnList) btnList.className = `p-2 rounded-lg transition-all ${mode === 'list' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnTable) btnTable.className = `p-2 rounded-lg transition-all ${mode === 'table' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;

    if (typeof window.handleConfirmSearch === 'function') {
        window.handleConfirmSearch();
    }
}
window.setConfirmViewMode = setConfirmViewMode;

export function registerProjectAccess(sheetId, name) {
    try {
        const key = `confirm_project_access_${sheetId}`;
        let count = parseInt(localStorage.getItem(key) || '0', 10);
        localStorage.setItem(key, count + 1);
    } catch (e) {
        console.error("Erro ao registrar acesso do projeto:", e);
    }
}
window.registerProjectAccess = registerProjectAccess;

export function getProjectAccessCount(sheetId) {
    try {
        const key = `confirm_project_access_${sheetId}`;
        return parseInt(localStorage.getItem(key) || '0', 10);
    } catch (e) {
        return 0;
    }
}
window.getProjectAccessCount = getProjectAccessCount;

export function setConfirmProjectViewMode(mode) {
    if (!state.confirm) state.confirm = {};
    state.confirm.projectViewMode = mode;
    localStorage.setItem('confirm_project_view_mode', mode);

    const btnGrid = document.getElementById('btn-proj-view-grid');
    const btnList = document.getElementById('btn-proj-view-list');
    const btnTable = document.getElementById('btn-proj-view-table');

    if (btnGrid) btnGrid.className = `p-2 rounded-lg transition-all ${mode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnList) btnList.className = `p-2 rounded-lg transition-all ${mode === 'list' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnTable) btnTable.className = `p-2 rounded-lg transition-all ${mode === 'table' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;

    if (typeof window.handleConfirmProjectSearch === 'function') {
        window.handleConfirmProjectSearch();
    }
}
window.setConfirmProjectViewMode = setConfirmProjectViewMode;

export function renderConfirmList(data, filterText = "", statusFilter = "TODOS") {
    const container = document.getElementById('confirm-list-container');
    if (!container) return;

    container.innerHTML = '';
    const columns = data[0];
    if (!state.confirm) state.confirm = {};
    state.confirm.columns = columns;

    // Verificar e criar colunas de Armazém em falta
    const requiredCols = ['DISCHARGE', 'DELIVER', 'DELIVER DATE', 'DELIVER TO', 'CONTACTO', 'STORAGE PAID', 'DELIVERED'];
    const hasAllCols = requiredCols.every(req => {
        const idx = columns.findIndex(c => {
            const clean = String(c || '').toUpperCase().trim();
            if (req === 'CONTACTO') return clean === 'CONTACTO' || clean === 'CONTACT';
            return clean === req;
        });
        return idx !== -1;
    });
    if (!hasAllCols && !state.confirm.isCreatingColumns) {
        state.confirm.isCreatingColumns = true;
        setTimeout(async () => {
            try {
                await checkAndCreateWarehouseColumns();
            } finally {
                state.confirm.isCreatingColumns = false;
            }
        }, 100);
    }

    const columnsUpper = columns.map(c => String(c || '').toUpperCase());
    
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
    const nameIdx = findCol(['NAME', 'NOME', 'CLIENTE', 'CLIENT']);
    const statusIdx = findCol(['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);
    const dutyIdx = findCol(['AMOUNT DUTY', 'DUTY', 'TOTAL DUTY', 'VALOR DUTY']);
    const dutyPrepaidIdx = findCol(['DUTY PREPAID', 'PREPAID']);
    const balanceIdx = findCol(['BALANCE', 'BALANCO', 'SALDO']);
    const notaDutyIdx = findCol(['NOTA DUTY', 'NOTA', 'OBSERVACAO', 'OBSERVACOES', 'OBS', 'NOTA_DUTY']);
    
    const paidIdx = columns.findIndex((c, i) => {
        const h = cleanString(c);
        return (h.includes('PAID') || h.includes('PAGO')) && !h.includes('PREPAID') && !h.includes('DUTY') && i !== dutyIdx;
    });

    let noIdx = columns.findIndex(c => {
        const h = String(c || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return h === 'NO' || h === 'Nº' || h === 'N' || h === 'NUMERO' || h.startsWith('NO.') || h.startsWith('Nº.') || h.startsWith('N.');
    });
    if (noIdx === -1 && columns.length > 0) {
        noIdx = 0;
    }

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

        // Filtro de busca de texto será aplicado no final de forma agregada

        // Criar um ID de grupo único que combina ID + NOME para evitar colisões
        const groupId = `${idCode}_${name}`.replace(/\s+/g, '_') || `ROW_${i}`;

        if (!groupedClients.has(groupId)) {
            groupedClients.set(groupId, {
                groupId: groupId,
                displayIdCode: idCode,
                displayName: name,
                no: noValue,
                originalGlobalIndex: groupedClients.size + 1,
                rows: [],
                statuses: [],
                hasResponse: false
            });
        }

        const currentGroup = groupedClients.get(groupId);

        let rowStatus = String(row[statusIdx] || '').trim();
        if (rowStatus === '?') {
            rowStatus = 'PENDENTE';
        }

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

        if (rowStatus.toUpperCase() === 'CONFIRMADO' && balanceVal > 1.0) {
            rowStatus = 'PARCIAL';
        }

        const rawNota = notaDutyIdx !== -1 ? String(row[notaDutyIdx] || '').trim() : '';
        const hasRowResponse = rawNota.toUpperCase().includes('RESPOSTA:');
        if (hasRowResponse) {
            currentGroup.hasResponse = true;
        }

        const rowNotes = (state.confirm.notes && state.confirm.notes[i]) ? state.confirm.notes[i] : [];
        const confirmNote = statusIdx !== -1 ? String(rowNotes[statusIdx] || '').trim() : '';

        currentGroup.rows.push({
            originalRow: row,
            originalIndex: i,
            status: rowStatus,
            confirmNote: confirmNote
        });
        currentGroup.statuses.push(rowStatus);
    }

    let groups = Array.from(groupedClients.values());
    if (!state.confirm) state.confirm = {};
    state.confirm.groupedClients = groups;

    // Aplicar Filtro de Busca de Texto para renderização visual
    if (filterText) {
        const term = filterText.toLowerCase();
        groups = groups.filter(client => {
            const nameMatch = (client.displayName || '').toLowerCase().includes(term);
            const idMatch = (client.displayIdCode || '').toLowerCase().includes(term);
            return nameMatch || idMatch;
        });
    }

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
        const targetClean = target.replace(/[^A-Z0-9\s-]/g, '').trim();
        groups = groups.filter(client => {
            const matches = client.statuses.some(s => {
                const current = String(s || '').toUpperCase().replace(/[^A-Z0-9\s-]/g, '').trim();
                // Exibir PARCIAL junto com PENDENTE
                if (targetClean === 'PENDENTE' && current.includes('PARCIAL')) {
                    return true;
                }
                
                return current.includes(targetClean) || targetClean.includes(current);
            });
            return matches;
        });
    }

    // Calcular Total Duty baseado nos grupos e status filtrados
    groups.forEach(client => {
        const target = statusFilter.toUpperCase().trim();
        const targetClean = target.replace(/[^A-Z0-9\s-]/g, '').trim();

        client.rows.forEach(r => {
            const current = String(r.status || '').toUpperCase().replace(/[^A-Z0-9\s-]/g, '').trim();
            const isMatch = statusFilter === 'TODOS' || current.includes(targetClean) || targetClean.includes(current) || (targetClean === 'PENDENTE' && current.includes('PARCIAL'));
            
            if (isMatch) {
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

    container.innerHTML = '';

    // Sincronizar classes de botões ativos no topo
    const viewMode = state.confirm.viewMode || localStorage.getItem('confirm_view_mode') || 'grid';
    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');
    const btnTable = document.getElementById('btn-view-table');

    if (btnGrid) btnGrid.className = `p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnList) btnList.className = `p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnTable) btnTable.className = `p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;

    // Helper de status
    const getClientStatusAndClass = (client) => {
        let clientStatus = 'PENDENTE';
        let statusClass = "bg-gray-100 text-gray-400";

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
        } else if (cleanStatuses.some(s => s.includes('PARCIAL')) || (cleanStatuses.some(s => s.includes('CONFIRMADO')) && cleanStatuses.some(s => s.includes('PENDENTE') || s.includes('AGUARDA')))) {
            clientStatus = 'PARCIAL';
            statusClass = "bg-yellow-500 text-white font-black";
        } else if (cleanStatuses.some(s => s.includes('PENDENTE'))) {
            clientStatus = 'PENDENTE';
            statusClass = "bg-yellow-400 text-black font-black";
        } else {
            clientStatus = 'AGUARDA PAG.';
            statusClass = "bg-gray-100 text-gray-400";
        }
        return { clientStatus, statusClass };
    };

    // === 1 - MODOS DE EXIBIÇÃO ===
    if (viewMode === 'grid') {
        container.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4";
        groups.forEach((client) => {
            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 p-3 pt-8 pb-1.5 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group relative overflow-hidden";

            const { clientStatus, statusClass } = getClientStatusAndClass(client);
            const rowCount = client.rows.length;

            const hasActiveLock = client.rows.some(r => {
                const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[r.originalIndex];
                return lockInfo && lockInfo.userId !== pb.authStore.model?.id;
            });
            const lockingUser = client.rows.reduce((name, r) => {
                if (name) return name;
                const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[r.originalIndex];
                if (lockInfo && lockInfo.userId !== pb.authStore.model?.id) {
                    return lockInfo.user;
                }
                return name;
            }, null);

            let lockBadgeHtml = '';
            if (hasActiveLock) {
                lockBadgeHtml = `
                    <div class="absolute top-0 left-12 px-2 py-1 bg-red-50 text-red-600 border-b border-l border-r border-red-100 rounded-b-lg flex items-center gap-1 animate-pulse z-10">
                        <span class="text-[8px] font-black uppercase tracking-wider">🔒 ${lockingUser}</span>
                    </div>
                `;
            }

            card.innerHTML = `
                <!-- Top Left Badge (Client Number) -->
                <div class="absolute top-0 left-0 px-3 py-1.5 bg-gray-100 text-black rounded-br-xl border-b border-r border-gray-200">
                    <span class="text-[12px] font-black">${client.no || '—'}</span>
                </div>
                
                ${lockBadgeHtml}
                
                <!-- Top Right Badge (Status & Response) -->
                <div class="absolute top-0 right-0 flex items-stretch shrink-0 h-7 overflow-hidden rounded-bl-xl z-20">
                    ${client.hasResponse ? `
                        <div class="px-2.5 bg-indigo-600 text-white flex items-center justify-center gap-1 border-r border-indigo-500/30 h-full rounded-none" title="Cliente já respondeu à nota de confirmação">
                            <span class="text-[8px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">💬 RESPONDIDO</span>
                        </div>
                    ` : ''}
                    <div class="px-3 flex items-center justify-center h-full rounded-none ${statusClass}">
                        <span class="text-[8px] font-black uppercase tracking-wider">${clientStatus}</span>
                    </div>
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
    else if (viewMode === 'list') {
        container.className = "flex flex-col gap-3 px-4 w-full col-span-full";
        groups.forEach((client) => {
            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 hover:border-gray-300 p-3 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-between group";

            const { clientStatus, statusClass } = getClientStatusAndClass(client);
            const rowCount = client.rows.length;

            const hasActiveLock = client.rows.some(r => {
                const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[r.originalIndex];
                return lockInfo && lockInfo.userId !== pb.authStore.model?.id;
            });
            const lockingUser = client.rows.reduce((name, r) => {
                if (name) return name;
                const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[r.originalIndex];
                if (lockInfo && lockInfo.userId !== pb.authStore.model?.id) {
                    return lockInfo.user;
                }
                return name;
            }, null);

            let lockStatusHtml = '';
            if (hasActiveLock) {
                lockStatusHtml = `<span class="text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-red-50 text-red-600 border border-red-100 flex items-center gap-1 animate-pulse mr-2">🔒 ${lockingUser}</span>`;
            }

            card.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 font-black text-xs text-black border border-gray-200">
                        ${client.no || '—'}
                    </div>
                    <div>
                        <h4 class="font-black text-xs uppercase tracking-tight text-slate-800 leading-tight group-hover:text-black transition-colors">${client.displayName || 'Cliente Sem Nome'}</h4>
                        <p class="text-[9px] font-bold uppercase text-gray-400 leading-none mt-1">${rowCount} ORDEM${rowCount > 1 ? 'S' : ''}</p>
                    </div>
                </div>
                
                <div class="flex items-center gap-4 shrink-0">
                    ${lockStatusHtml}
                    ${client.hasResponse ? `
                        <span class="text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 animate-pulse flex items-center gap-1" title="Cliente já respondeu à nota de confirmação">💬 RESPONDIDO</span>
                    ` : ''}
                    <span class="text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded inline-block ${statusClass}">${clientStatus}</span>
                    <div class="text-gray-300 group-hover:text-yellow-600 transition-all shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </div>
            `;

            card.onclick = () => showConfirmDetail(client, client.no || '—');
            container.appendChild(card);
        });
    } 
    else if (viewMode === 'table') {
        container.className = "w-full col-span-full px-4 overflow-x-auto custom-scrollbar";
        
        const wrapper = document.createElement('div');
        wrapper.className = "bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm w-full";
        
        let tableRowsHtml = '';
        groups.forEach((client) => {
            const { clientStatus, statusClass } = getClientStatusAndClass(client);
            const rowCount = client.rows.length;

            const hasActiveLock = client.rows.some(r => {
                const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[r.originalIndex];
                return lockInfo && lockInfo.userId !== pb.authStore.model?.id;
            });
            const lockingUser = client.rows.reduce((name, r) => {
                if (name) return name;
                const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[r.originalIndex];
                if (lockInfo && lockInfo.userId !== pb.authStore.model?.id) {
                    return lockInfo.user;
                }
                return name;
            }, null);

            let tableLockHtml = '';
            if (hasActiveLock) {
                tableLockHtml = `<span class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 inline-flex items-center gap-1 animate-pulse ml-2">🔒 ${lockingUser}</span>`;
            }

            // Calcular somatório do Duty
            let clientDuty = 0;
            client.rows.forEach(r => {
                const rawVal = r.originalRow[dutyIdx];
                const duty = parseFloat(String(rawVal || '0').replace(/[^0-9.-]+/g, '')) || 0;
                clientDuty += duty;
            });

            const trId = `tr-client-${client.no || 'X'}-${client.displayName.replace(/\s+/g, '_')}`;

            tableRowsHtml += `
                <tr id="${trId}" class="hover:bg-slate-50 border-b border-gray-100 transition-all cursor-pointer group">
                    <td class="p-3 text-center font-black text-xs text-slate-800">${client.no || '—'}</td>
                    <td class="p-3 font-bold text-xs uppercase text-slate-700 group-hover:text-black transition-colors">${client.displayName || 'Cliente Sem Nome'} ${tableLockHtml}</td>
                    <td class="p-3 text-center text-xs font-semibold text-slate-500">${rowCount}</td>
                    <td class="p-3 text-right font-black text-xs text-slate-800">${formatMZN(clientDuty)}</td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-2">
                            ${client.hasResponse ? `
                                <span class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 animate-pulse flex items-center gap-1" title="Cliente já respondeu à nota de confirmação">💬 RESPONDIDO</span>
                            ` : ''}
                            <span class="text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded inline-block ${statusClass}">${clientStatus}</span>
                        </div>
                    </td>
                    <td class="p-3 text-center">
                        <div class="text-gray-300 group-hover:text-yellow-600 transition-all flex justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                    </td>
                </tr>
            `;
        });

        wrapper.innerHTML = `
            <table class="w-full border-collapse text-left">
                <thead class="bg-slate-50 border-b border-gray-200 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                    <tr>
                        <th class="p-3 text-center w-16">Nº</th>
                        <th class="p-3">Cliente</th>
                        <th class="p-3 text-center w-24">Ordens</th>
                        <th class="p-3 text-right w-36">Total Duty</th>
                        <th class="p-3 text-center w-36">Status</th>
                        <th class="p-3 text-center w-12"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${tableRowsHtml}
                </tbody>
            </table>
        `;
        
        container.appendChild(wrapper);

        groups.forEach((client) => {
            const trId = `tr-client-${client.no || 'X'}-${client.displayName.replace(/\s+/g, '_')}`;
            const tr = document.getElementById(trId);
            if (tr) {
                tr.onclick = () => showConfirmDetail(client, client.no || '—');
            }
        });
    }
}

export async function showConfirmDetail(client, clientIndex) {
    const isSameClient = window.currentActiveClient && String(window.currentActiveClientIndex) === String(clientIndex);
    window.currentActiveClient = client;
    window.currentActiveClientIndex = clientIndex;
    const nameEl = document.getElementById('confirm-client-detail-name');
    const idEl = document.getElementById('confirm-client-detail-id');
    const breadcrumbEl = document.getElementById('confirm-breadcrumb');
    const body = document.getElementById('confirm-client-orders');

    // Mapeamento de Colunas focado em DUTY (Refinado para evitar colisões)
    const columns = state.confirm.columns || [];
    const columnsUpper = columns.map(c => String(c || '').toUpperCase().trim());

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

    const getRaw = (row, idx) => idx !== -1 && row[idx] !== undefined && row[idx] !== null && row[idx] !== '' ? row[idx] : '—';
    const phoneIdx = findCol(['PHONE NUMBER', 'PHONE', 'TELEFONE', 'CONTACTO', 'CELULAR', 'PHONE_NUMBER']);

    let clientPhone = '—';
    if (client.rows && client.rows.length > 0) {
        for (const rowObj of client.rows) {
            const rawPhone = getRaw(rowObj.originalRow, phoneIdx);
            if (rawPhone !== '—' && String(rawPhone).trim() !== '') {
                clientPhone = String(rawPhone).trim();
                break;
            }
        }
    }

    if (breadcrumbEl) {
        const projectName = document.getElementById('confirm-project-active-name')?.textContent || 'PROJETO';
        const separator = `<svg class="text-gray-300" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        const displayIndex = clientIndex !== undefined ? clientIndex : '---';

        let clientNoHtml = '';
        if (displayIndex && displayIndex !== '---') {
            const noParts = String(displayIndex).split(/(?:[\s,;/|]+)|(?:\s+e\s+)/i).map(p => p.trim()).filter(p => p.length > 0);
            if (noParts.length > 0) {
                clientNoHtml = `<span class="inline-flex items-center gap-1">`;
                noParts.forEach((part, pIdx) => {
                    if (pIdx > 0) {
                        clientNoHtml += `<span class="text-gray-300 font-bold mx-0.5">/</span>`;
                    }
                    clientNoHtml += `
                        <span onclick="window.copyToClipboard('${part.replace(/'/g, "\\'")}', 'Nº de Cliente ${part} copiado!')" class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black rounded-md font-bold text-[10px] tracking-normal cursor-pointer transition-all inline-flex items-center gap-1 select-all" title="Clique para copiar Nº ${part}">
                            ${part}
                        </span>
                    `;
                });
                clientNoHtml += `</span>`;
            } else {
                clientNoHtml = `<span class="text-gray-600 font-bold">${displayIndex}</span>`;
            }
        } else {
            clientNoHtml = `<span class="text-gray-600 font-bold">${displayIndex}</span>`;
        }

        let phoneHtml = '';
        if (clientPhone && clientPhone !== '—') {
            const parts = clientPhone.split(/(?:[\s,;/|]+)|(?:\s+e\s+)/i).map(p => p.trim()).filter(p => p.length > 0);
            if (parts.length > 0) {
                phoneHtml = `<span class="ml-2 inline-flex items-center gap-1.5">`;
                parts.forEach(part => {
                    phoneHtml += `
                        <span onclick="window.copyToClipboard('${part.replace(/'/g, "\\'")}', 'Contacto ${part} copiado!')" class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black rounded-full font-bold text-[10px] tracking-normal cursor-pointer transition-all inline-flex items-center gap-1 normal-case select-all" title="Clique para copiar ${part}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="inline-block"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            ${part}
                        </span>
                    `;
                });
                phoneHtml += `</span>`;
            }
        }

        breadcrumbEl.innerHTML = `
            <span class="hover:text-black cursor-pointer transition-colors" onclick="ui.showView('view-confirm-table')">${projectName}</span>
            ${separator}
            ${clientNoHtml}
            ${separator}
            <span class="text-black font-black inline-flex items-center">${client.displayName || 'SEM NOME'}${phoneHtml}</span>
        `;
    }

    if (nameEl) nameEl.innerText = client.displayName || 'Cliente Sem Nome';
    if (idEl) idEl.innerText = `ID CODE: ${client.displayIdCode || '---'}`;
    if (body) body.innerHTML = '';

    const orderNumIdx = findCol(['HF2', 'REF', 'REFERENCIA', 'ORDER NUMBER', 'ORDER NUM', 'ORDER', 'CONV', 'CONTENTOR', 'Nº HF2', 'Nº ORDEM', 'NO.', 'N.O', 'N.º', 'Nº', 'N°', 'NO']);
    const cbmIdx = findCol(['CBM', 'M3', 'VOLUME', 'VOL']);
    const unitDutyIdx = findCol(['UNIT CBM DUTY', 'UNIT DUTY', 'CBM DUTY', 'UNIT']);
    const dutyPrepIdx = findCol(['DUTY PREPAID', 'PREPAID', 'PRE-PAGO']);
    const amtDutyIdx = findCol(['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
    
    const paidDutyIdx = columns.findIndex((c, i) => {
        const h = cleanString(c);
        return (h.includes('PAID') || h.includes('PAGO')) && !h.includes('PREPAID') && !h.includes('DUTY');
    });
    
    const balanceIdx = findCol(['BALANCE', 'SALDO', 'BALANCO']);
    const bankDutyIdx = findCol(['BANK IN DUTY', 'BANK', 'BANCO']);
    const statusIdx = findCol(['CONFIRMATION', 'STATUS']);
    const notaDutyIdx = findCol(['NOTA DUTY', 'NOTA', 'OBSERVACAO', 'OBSERVACOES', 'OBS', 'NOTA_DUTY']);

    // Determinar se o cliente já respondeu à nota de confirmação e mostrar/ocultar o badge no cabeçalho
    const hasResponse = client.rows && client.rows.some(r => {
        const rawNota = notaDutyIdx !== -1 ? String(r.originalRow[notaDutyIdx] || '').trim() : '';
        return rawNota.toUpperCase().includes('RESPOSTA:');
    });
    const badgeResponded = document.getElementById('badge-client-responded');
    if (badgeResponded) {
        if (hasResponse) {
            badgeResponded.classList.remove('hidden');
        } else {
            badgeResponded.classList.add('hidden');
        }
    }
    
    // Novas colunas para Armazém e Frete
    const packagesIdx = findCol(['PACKAGES']);
    const unitFreightIdx = findCol(['UNIT CBM FREIGHT']);
    const amtFreightIdx = findCol(['AMOUNT FREIGHT']);
    const paidFreightIdx = findCol(['PAID FREIGHT']);
    const balanceFreightIdx = findCol(['BALANCE FREIGHT']);
    const bankFreightIdx = findCol(['BANK IN FREIGHT']);
    const notaFreightIdx = findCol(['NOTA FREIGHT']);
    const getNum = (row, idx) => idx !== -1 ? (parseFloat(String(row[idx]).replace(/[^0-9.-]+/g, '')) || 0) : 0;

    // Formatação Numérica (pt-BR para 2 casas decimais)
    const formatValue = (val) => new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val);

    let tbodyHtml = '';
    let totalPaid = 0;
    let totalDutyPrepaid = 0;
    let totalAmountDuty = 0;
    let totalGSheetBalance = 0;
    let allConfirmed = true;
    
    // Novas Variáveis Armazém
    let totalPackages = 0;
    let totalCbm = 0;
    let totalAmountFreight = 0;
    let totalPaidFreight = 0;
    let totalBalanceFreight = 0;
    let armazemFreightNotes = [];

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
            const bankDuty = getRaw(rowData, bankDutyIdx);
            
            // Armazém / Frete dados
            const packages = getNum(rowData, packagesIdx);
            const amtFreight = getNum(rowData, amtFreightIdx);
            const pdFreight = getNum(rowData, paidFreightIdx);
            const balFreight = getNum(rowData, balanceFreightIdx);
            const noteFreight = getRaw(rowData, notaFreightIdx);

            totalPaid += paid;
            totalDutyPrepaid += dutyPrepaid;
            totalAmountDuty += amountDuty;
            totalGSheetBalance += balance;
            
            totalPackages += packages;
            totalCbm += cbm;
            totalAmountFreight += amtFreight;
            totalPaidFreight += pdFreight;
            totalBalanceFreight += balFreight;
            if (noteFreight && noteFreight !== '—' && String(noteFreight).trim() !== '') {
                armazemFreightNotes.push(String(noteFreight).trim());
            }

            // Salva dados processados para facilitar edição
            window.currentClientRows.push({
                originalIndex,
                orderNumber, cbm, unitDuty, dutyPrepaid, amountDuty, paid, balance,
                bankDuty: bankDuty === '—' ? '' : bankDuty,
                packages, amtFreight, pdFreight, balFreight
            });

            let rowStatus = String(rowData[statusIdx] || 'PENDENTE').trim();
            if (rowStatus === '?') rowStatus = 'PENDENTE';
            rowStatus = rowStatus.toUpperCase();
            if (rowStatus === 'CONFIRMADO' && balance > 1.0) {
                rowStatus = 'PARCIAL';
            }

            if (rowStatus !== 'CONFIRMADO') {
                allConfirmed = false;
            }

            const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[originalIndex];
            const isLockedByOther = lockInfo && lockInfo.userId !== pb.authStore.model?.id;

            // Construir o select de banco
            const cleanCurrent = String(bankDuty || '').trim();
            const options = ['?', 'BCI BOSS', 'BIM BOSS', 'BCI JUPITER', 'BIM JUPITER', 'STB JUPITER', 'NED JUPITER', 'PAID IN CHINA', 'REPOSIÇÃO', 'COTACAO', 'EMOLA BOSS'];
            if (cleanCurrent && cleanCurrent !== '—' && !options.includes(cleanCurrent)) {
                options.push(cleanCurrent);
            }
            let optionsHtml = '';
            options.forEach(opt => {
                const isSelected = opt === cleanCurrent || (opt === '?' && (!cleanCurrent || cleanCurrent === '—'));
                optionsHtml += `<option value="${opt}" ${isSelected ? 'selected' : ''}>${opt}</option>`;
            });

            const bankSelectHtml = `
                <select onclick="event.stopPropagation();" onchange="ui.changeBankInDuty(${originalIndex}, this.value)" class="py-0.5 px-1 text-slate-700 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold focus:outline-blue-500 focus:bg-white transition-all max-w-[130px] inline-block" ${isLockedByOther ? 'disabled' : ''}>
                    ${optionsHtml}
                </select>
            `;

            tbodyHtml += `
                <tr data-original-index="${originalIndex}" class="row-hover transition-colors border-b border-slate-50 hover:bg-[#f1f5f9] cursor-pointer ${isLockedByOther ? 'opacity-50 pointer-events-none' : ''}" ${isLockedByOther ? `title="A ser editado por ${lockInfo.user}"` : ''} onclick="ui.openConfirmEditModal(${index})">
                    <td class="py-0.5 px-4 font-bold text-slate-800 text-[11px]">${orderNumber}</td>
                    <td class="py-0.5 px-4 text-center text-slate-600 text-[11px]">${cbm.toFixed(2)}</td>
                    <td class="py-0.5 px-4 text-center font-semibold text-blue-700 text-[11px]">${formatValue(amountDuty)}</td>
                    <td class="py-0.5 px-4 text-center text-slate-500 text-[11px]">${formatValue(dutyPrepaid)}</td>
                    <td class="py-0.5 px-4 text-center font-bold text-green-600 text-[11px]">${formatValue(paid)}</td>
                    <td class="py-0.5 px-4 text-center font-bold text-[11px] ${balance > 0 ? 'text-red-500' : 'text-slate-400'}">${formatValue(balance)}</td>
                    <td class="py-0.5 px-4 text-center">${bankSelectHtml}</td>
                    <td class="py-0.5 px-4 text-center">
                        <button onclick="event.stopPropagation(); window.onConfirmRow(${originalIndex}, ${JSON.stringify(rowData).replace(/"/g, '&quot;')})" 
                            class="px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-tighter shadow-sm transition-all border ${rowStatus === 'PENDENTE' ? 'bg-white text-slate-400 border-slate-200 hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-600' : (rowStatus === 'CONFIRMADO' ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-600 hover:text-white' : (rowStatus === 'PARCIAL' ? 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-600 hover:text-white' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white'))}"
                            ${isLockedByOther ? 'disabled' : ''}>
                            ${isLockedByOther ? '🔒 ' : ''}${rowStatus}
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
        let clientNotaDuty = '—';

        if (client.rows && client.rows.length > 0) {
            let rawBank = getRaw(client.rows[0].originalRow, bankDutyIdx);
            if (rawBank !== '—') {
                let parts = String(rawBank).toUpperCase().replace('BOSS', 'FILIPE').trim().split(/\s+/);
                bankValue = parts[0];
                if (parts.length > 1) accountTerm = parts.slice(1).join(' ');
            }

            // Puxar nota de duty
            const notas = [];
            for (const rowObj of client.rows) {
                const rawNota = getRaw(rowObj.originalRow, notaDutyIdx);
                if (rawNota !== '—' && String(rawNota).trim() !== '') {
                    const cleaned = String(rawNota).trim();
                    if (!notas.includes(cleaned)) {
                        notas.push(cleaned);
                    }
                }
            }
            if (notas.length > 0) {
                clientNotaDuty = notas.join(' | ');
            }
        }

        const isFullyPrepaid = totalAmountDuty > 0 && Math.abs(totalAmountDuty - totalDutyPrepaid) < 0.01;
        let targetAmount = totalAmountDuty - totalDutyPrepaid;
        if (isFullyPrepaid) {
            targetAmount = totalDutyPrepaid; // Se for totalmente prepaid, o alvo é o prepaid
        } else if (totalPaid > targetAmount) {
            targetAmount = totalPaid; // Se houver overpayment local
        }

        // Buscar todos os pagamentos já alocados a este cliente
        const payments = await getPaymentsByAllocatedTo(combinedInfo);
        const freightPayments = await getPaymentsByAllocatedTo(`FRETE - ${combinedInfo}`);
        
        let totalAllocated = 0;
        let pbHtml = '';

        // FUNÇÃO AUXILIAR PARA GERAR O HTML DE RECONCILIAÇÃO E BUSCAR SIBLINGS
        const renderReconciliationBlock = (pmts, title, color) => {
            if (!pmts || pmts.length === 0) return '';
            
            let html = `
                <div class="mb-4 p-4 border border-${color}-100 bg-${color}-50 rounded-xl shadow-inner">
                    <div class="flex justify-between items-center mb-4 border-b border-${color}-100 pb-2">
                        <h5 class="text-[10px] font-bold text-${color}-800 uppercase tracking-wider">${title}</h5>
                        <span class="text-[10px] font-bold text-${color}-600 bg-${color}-200 px-3 py-1 rounded-full">${pmts.length} Pagamento(s)</span>
                    </div>
                    <div class="space-y-4">
            `;

            pmts.forEach((payment, idx) => {
                html += `
                    <div class="grid grid-cols-2 gap-2 text-[11px] text-${color}-900 ${idx !== pmts.length - 1 ? `border-b border-${color}-100 pb-3` : ''}">
                        <div><span class="font-bold text-${color}-700">Banco:</span> ${payment.bank || '---'}</div>
                        <div><span class="font-bold text-${color}-700">Titular da Conta:</span> ${payment.account_owner || '---'}</div>
                        <div><span class="font-bold text-${color}-700">Valor (MZN):</span> ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(payment.amount)}</div>
                        <div><span class="font-bold text-${color}-700">Data:</span> ${payment.date ? payment.date.split(' ')[0] : '---'}</div>
                        <div class="col-span-2"><span class="font-bold text-${color}-700">Referência:</span> ${payment.reference || payment.description || '---'}</div>
                        <div class="col-span-2" id="siblings-${payment.id}"></div>
                    </div>
                `;
            });

            html += `</div></div>`;

            // Lógica para carregar detalhes de partilha (siblings)
            setTimeout(async () => {
                for (const p of pmts) {
                    if (p.reference && p.reference.includes("(Ref Mestre:")) {
                        const siblings = await getPaymentsByMasterRef(p.reference);
                        if (siblings.length > 1) {
                            const containerId = `siblings-${p.id}`;
                            const el = document.getElementById(containerId);
                            if (el) {
                                let sibHtml = `
                                    <div class="mt-2 pt-2 border-t border-${color}-100">
                                        <div class="text-[9px] font-black text-${color}-500 uppercase mb-1">Divisão deste Pagamento:</div>
                                        <div class="space-y-1">
                                `;
                                let originalTotal = 0;
                                siblings.forEach(s => {
                                    originalTotal += s.amount;
                                    const isCurrent = s.id === p.id;
                                    const dest = s.allocated_to || `<span class="text-${color}-400 italic">Livre / Não Alocado</span>`;
                                    sibHtml += `
                                        <div class="flex justify-between items-center text-[10px] ${isCurrent ? `bg-${color}-100 px-1 rounded` : ''}">
                                            <span class="truncate max-w-[120px]">${dest}</span>
                                            <span class="font-bold">${formatValue(s.amount)}</span>
                                        </div>
                                    `;
                                });
                                sibHtml += `
                                        <div class="flex justify-between items-center text-[10px] font-black text-${color}-800 pt-1 border-t border-${color}-200 mt-1">
                                            <span>TOTAL ORIGINAL:</span>
                                            <span>${formatValue(originalTotal)}</span>
                                        </div>
                                    </div>
                                `;
                                el.innerHTML = sibHtml;
                            }
                        }
                    }
                }
            }, 100);

            return html;
        };

        if (payments && payments.length > 0) {
            payments.forEach(p => totalAllocated += p.amount);
            pbHtml += renderReconciliationBlock(payments, 'Detalhes de Reconciliação - DUTY', 'blue');
        }

        if (freightPayments && freightPayments.length > 0) {
            pbHtml += renderReconciliationBlock(freightPayments, 'Detalhes de Reconciliação - FRETE', 'rose');
        }

        let remainingToPay = targetAmount - totalAllocated;
        if (remainingToPay < 0) remainingToPay = 0;

        let trueRemaining = (totalAmountDuty - totalDutyPrepaid) - totalAllocated;
        if (trueRemaining < 0) trueRemaining = 0;

        window.currentActiveClientState = {
            combinedInfo,
            bankValue,
            clientPhone,
            clientNotaDuty,
            targetAmount,
            totalAllocated,
            remainingToPay,
            totalDutyPrepaid,
            trueRemaining,
            payments,
            totalGSheetBalance,
            allConfirmed,
            totalPaid,
            isFullyPrepaid
        };

        const cardHtml = getPaymentCardHtml(client, window.currentActiveClientState);
        const summaryCardHtml = `
            <!-- Somatório Focado -->
            <div id="summary-cards" class="flex justify-end mt-6 mr-4 mb-2 ${cardHtml === '' ? 'hidden' : ''}">
                ${cardHtml}
            </div>
        `;

        // Determinar status agrupado do cliente para exibição de notas
        const cleanStatuses = client.statuses ? client.statuses.map(s => 
            String(s || '').toUpperCase().replace(/[^A-Z0-9\s-]/g, '').trim()
        ) : [];

        let clientStatus = 'PENDENTE';
        if (cleanStatuses.some(s => s.includes('COMPROVATIVO ERRADO') || s.includes('ERRADO'))) {
            clientStatus = 'ERRADO';
        } else if (cleanStatuses.some(s => s.includes('SEM COMPROVATIVO') || s.includes('SEM COMP'))) {
            clientStatus = 'SEM COMP.';
        } else if (cleanStatuses.some(s => s.includes('RE-VERIFICANDO') || s.includes('RE-VERIF'))) {
            clientStatus = 'RE-VERIF.';
        } else if (cleanStatuses.every(s => s.includes('CONFIRMADO'))) {
            clientStatus = 'CONFIRMADO';
        } else if (cleanStatuses.some(s => s.includes('PARCIAL')) || (cleanStatuses.some(s => s.includes('CONFIRMADO')) && cleanStatuses.some(s => s.includes('PENDENTE') || s.includes('AGUARDA')))) {
            clientStatus = 'PARCIAL';
        } else if (cleanStatuses.some(s => s.includes('PENDENTE'))) {
            clientStatus = 'PENDENTE';
        } else {
            clientStatus = 'AGUARDA PAG.';
        }

        const isExcluded = ['PENDENTE', 'CONFIRMADO', 'AGUARDA PAG.', 'AGUARDA PAGAMENTO'].includes(clientStatus.toUpperCase().trim());

        const confirmationNotes = [];
        if (client.rows) {
            client.rows.forEach(rowObj => {
                if (rowObj.confirmNote && rowObj.confirmNote.trim() !== '') {
                    const note = rowObj.confirmNote.trim();
                    if (!confirmationNotes.includes(note)) {
                        confirmationNotes.push(note);
                    }
                }
            });
        }

        let confirmationNotesHtml = '';
        if (!isExcluded && confirmationNotes.length > 0) {
            confirmationNotesHtml = `
                <div class="mt-4 mb-4 p-4 bg-amber-50/70 border border-amber-200 rounded-2xl shadow-sm mr-4 ml-4">
                    <div class="flex items-center gap-2 mb-2 text-amber-800">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        <span class="text-[10px] font-black uppercase tracking-wider">Notas de Confirmação (Motivo do Estado) - Clique para Responder:</span>
                    </div>
                    <ul class="space-y-2 text-xs text-slate-700 font-bold">
                        ${confirmationNotes.map(note => `
                            <li onclick="ui.replyToConfirmationNote('${escapeJSAndHTML(note)}')" 
                                class="cursor-pointer hover:text-amber-900 hover:underline transition-colors flex items-start gap-2 py-1 bg-amber-100/50 hover:bg-amber-100 px-3 py-2 rounded-xl border border-amber-200/50 active:scale-[0.98]"
                                title="Clique para responder a esta nota e alterar o estado para Pendente">
                                <span class="text-amber-500 font-extrabold text-sm leading-none">💬</span>
                                <span>${note}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        // Estrutura HTML baseada no template do utilizador
        body.innerHTML = `
            <div id="payment-info-container">${pbHtml}</div>
            <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-slate-50 border-bottom border-slate-200 text-slate-500">
                        <tr>
                            <th class="py-1 px-4 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">Order Number</th>
                            <th class="py-1 px-4 text-[10px] font-bold uppercase tracking-wider text-center border-b border-slate-200">CBM</th>
                            <th class="py-1 px-4 text-[10px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Amount Duty</th>
                            <th class="py-1 px-4 text-[10px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Duty Prepaid</th>
                            <th class="py-1 px-4 text-[10px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Paid</th>
                            <th class="py-1 px-4 text-[10px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Balance</th>
                            <th class="py-1 px-4 text-[10px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Bank in Duty</th>
                            <th class="py-1 px-4 text-[10px] font-bold uppercase tracking-wider text-center border-b border-slate-200">Confirmação</th>
                        </tr>
                    </thead>
                    <tbody id="orders-tbody" class="divide-y divide-slate-100">
                        ${tbodyHtml}
                    </tbody>
                </table>
            </div>
            
            ${confirmationNotesHtml}
            
            ${summaryCardHtml}

            <p class="text-right text-[10px] text-slate-400 mt-2 mr-4 italic pb-4">* Clique em uma linha para visualizar ou editar os valores</p>
        `;
    }

    const detailView = document.getElementById('view-confirm-client-detail');
    if (!detailView || detailView.classList.contains('hidden')) {
        showView('view-confirm-client-detail');
    }

    // Abrir pasta automaticamente se existir número e nome
    if (window.autoOpenClientFolder) {
        window.autoOpenClientFolder(client.no || '', client.displayName);
    }

    // Atualizar UI dos Locks
    updateLocksUI();

    // Configurar e limpar seletores em massa
    const role = pb.authStore.model?.role || 'USER';
    const isL1 = role === 'USER' || role === 'USER_L1';
    const bulkBankSelect = document.getElementById('bulk-bank');
    const bulkStatusSelect = document.getElementById('bulk-status');
    if (bulkBankSelect) {
        bulkBankSelect.value = '';
    }
    if (bulkStatusSelect) {
        bulkStatusSelect.value = '';
        if (isL1) {
            bulkStatusSelect.disabled = true;
            bulkStatusSelect.classList.add('bg-slate-100', 'cursor-not-allowed', 'opacity-60');
            bulkStatusSelect.classList.remove('bg-white', 'cursor-pointer');
        } else {
            bulkStatusSelect.disabled = false;
            bulkStatusSelect.classList.remove('bg-slate-100', 'cursor-not-allowed', 'opacity-60');
            bulkStatusSelect.classList.add('bg-white', 'cursor-pointer');
        }
    }
    // Atualizar UI do Armazém
    const pkgEl = document.getElementById('armazem-total-packages');
    const cbmEl = document.getElementById('armazem-total-volume');

    if (pkgEl) pkgEl.innerText = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(totalPackages));
    if (cbmEl) cbmEl.innerText = formatValue(totalCbm);

    // Renderizar tabela e controlo de entrega do Armazém
    renderArmazemDetails(client, totalBalanceFreight, totalAmountFreight, allConfirmed);

    // Botão Mini de Frete na aba Confirm
    const miniFreightBtn = document.getElementById('btn-confirm-freight-mini');
    const miniFreightStatus = document.getElementById('confirm-freight-mini-status');
    if (miniFreightBtn && miniFreightStatus) {
        if (totalAmountFreight > 0 || totalPaidFreight > 0 || totalBalanceFreight > 0) {
            miniFreightBtn.dataset.hasFreight = 'true';
            miniFreightBtn.classList.remove('hidden');
            if (totalBalanceFreight <= 0 && totalAmountFreight > 0) {
                miniFreightStatus.innerText = 'PAGO';
                miniFreightStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-green-100 text-green-700';
            } else if (totalPaidFreight > 0 && totalBalanceFreight > 0) {
                miniFreightStatus.innerText = 'PARCIAL';
                miniFreightStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-700';
            } else {
                miniFreightStatus.innerText = 'PENDENTE';
                miniFreightStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700';
            }
        } else {
            miniFreightBtn.dataset.hasFreight = 'false';
            miniFreightBtn.classList.add('hidden');
        }
    }

    // Restaurar/manter a aba ativa correspondente
    let activeTab = 'confirm';
    if (isSameClient) {
        const armazemTab = document.getElementById('btn-tab-armazem');
        if (armazemTab && armazemTab.classList.contains('bg-white')) {
            activeTab = 'armazem';
        }
    }
    toggleConfirmArmazem(activeTab);
}

export async function replyToConfirmationNote(note) {
    const client = window.currentActiveClient;
    if (!client || !client.rows || client.rows.length === 0) {
        toast('Erro: Nenhum cliente ativo selecionado.', 'error');
        return;
    }

    const columns = state.confirm.columns || [];
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
    const notaDutyIdx = findCol(['NOTA DUTY', 'NOTA', 'OBSERVACAO', 'OBSERVACOES', 'OBS', 'NOTA_DUTY']);

    if (statusIdx === -1) {
        toast('Erro: Coluna de Confirmação não encontrada.', 'error');
        return;
    }
    if (notaDutyIdx === -1) {
        toast('Erro: Coluna NOTA DUTY não encontrada.', 'error');
        return;
    }

    // Solicitar resposta ao utilizador
    const reply = prompt(`Responder ao motivo do estado: "${note}"\n\nIntroduza a sua resposta para salvar na coluna NOTA DUTY (o estado será alterado para Pendente):`);
    if (reply === null) return; // Utilizador cancelou
    const cleanReply = reply.trim();
    if (cleanReply === '') {
        toast('A resposta não pode ser vazia.', 'warning');
        return;
    }

    // Construir atualizações em massa para todas as linhas do cliente
    const batchUpdates = [];
    let sheetName = 'Folha1';
    if (state.confirm.range && state.confirm.range.includes('!')) {
        sheetName = state.confirm.range.split('!')[0];
    }
    const cleanSheetName = sheetName.replace(/'/g, '');
    const prefixClean = cleanSheetName ? `${cleanSheetName}!` : '';

    const updatedRows = [];

    client.rows.forEach(r => {
        const rowIndex = r.originalIndex;
        const rowNum = rowIndex + 1;
        const rowData = [...state.confirm.data[rowIndex]];

        // 1. NOTA DUTY
        const existingNote = rowData[notaDutyIdx] !== undefined && rowData[notaDutyIdx] !== null && rowData[notaDutyIdx] !== '—' ? String(rowData[notaDutyIdx]).trim() : '';
        const newNote = existingNote ? `${existingNote} | Resposta: ${cleanReply}` : `Resposta: ${cleanReply}`;
        rowData[notaDutyIdx] = newNote;
        batchUpdates.push({
            range: `${prefixClean}${getColLetter(notaDutyIdx)}${rowNum}`,
            values: [[newNote]]
        });

        // 2. CONFIRMATION para "?"
        rowData[statusIdx] = '?';
        batchUpdates.push({
            range: `${prefixClean}${getColLetter(statusIdx)}${rowNum}`,
            values: [['?']]
        });

        updatedRows.push({ rowIndex, rowData });
    });

    try {
        setLoader(true, 'A gravar resposta...');
        await updateGSheetBatch(state.confirm.sheetId, batchUpdates);

        // Atualizar estado em memória local
        updatedRows.forEach(item => {
            state.confirm.data[item.rowIndex] = item.rowData;
            const rObj = client.rows.find(r => r.originalIndex === item.rowIndex);
            if (rObj) {
                rObj.originalRow = item.rowData;
                rObj.confirmNote = ''; // Limpar a nota de confirmação local visto que o estado agora é "?" (Pendente)
            }
        });

        // Mapear também os status agrupados do cliente
        if (client.statuses) {
            client.statuses = client.statuses.map(() => 'PENDENTE');
        }

        toast('Resposta gravada e estado alterado para Pendente!', 'success');

        // Re-renderizar o detalhe do cliente
        await showConfirmDetail(client, window.currentActiveClientIndex);
    } catch (err) {
        console.error('[CONFIRM-REPLY] Erro ao gravar resposta:', err);
        toast('Erro ao gravar dados no GSheet: ' + err.message, 'error');
    } finally {
        setLoader(false);
    }
}

export function toggleConfirmArmazem(mode) {
    const confirmTab = document.getElementById('btn-tab-confirm');
    const armazemTab = document.getElementById('btn-tab-armazem');
    const confirmContent = document.getElementById('confirm-client-orders');
    const armazemContent = document.getElementById('armazem-client-details');
    const bulkPanel = document.getElementById('btn-toggle-bulk-actions');
    const bulkContent = document.getElementById('confirm-bulk-actions-panel');
    const summaryCards = document.getElementById('summary-cards');
    const miniFreightBtn = document.getElementById('btn-confirm-freight-mini');
    const mainCol = document.getElementById('confirm-main-content-col');
    const sideSuportes = document.getElementById('confirm-side-suportes');
    const reconciliationPanel = document.getElementById('btn-toggle-reconciliation');
    const paymentInfoContainer = document.getElementById('payment-info-container');

    if (mode === 'confirm') {
        confirmTab.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
        confirmTab.classList.remove('bg-transparent', 'text-slate-400');
        armazemTab.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
        armazemTab.classList.add('bg-transparent', 'text-slate-400');

        confirmContent.classList.remove('hidden');
        armazemContent.classList.add('hidden');
        if (bulkPanel) bulkPanel.style.display = '';
        if (reconciliationPanel) reconciliationPanel.style.display = '';
        if (summaryCards) summaryCards.style.display = '';
        if (miniFreightBtn && miniFreightBtn.dataset.hasFreight === 'true') {
            miniFreightBtn.classList.remove('hidden');
        }
        const badgeResponded = document.getElementById('badge-client-responded');
        if (badgeResponded) {
            const hasResponse = window.currentActiveClient?.rows?.some(r => {
                const columns = state.confirm.columns || [];
                const cleanString = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[^A-Z0-9]/g, "").trim();
                const notaDutyIdx = columns.findIndex(c => cleanString(c) === 'NOTADUTY' || cleanString(c).includes('NOTADUTY') || cleanString(c) === 'NOTA');
                const rawNota = notaDutyIdx !== -1 ? String(r.originalRow[notaDutyIdx] || '').trim() : '';
                return rawNota.toUpperCase().includes('RESPOSTA:');
            });
            if (hasResponse) {
                badgeResponded.classList.remove('hidden');
            } else {
                badgeResponded.classList.add('hidden');
            }
        }

        // Mostrar suportes e restaurar coluna principal para lg:col-span-3
        if (sideSuportes) sideSuportes.classList.remove('hidden');
        if (mainCol) {
            mainCol.classList.remove('lg:col-span-4');
            mainCol.classList.add('lg:col-span-3');
        }
    } else {
        armazemTab.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
        armazemTab.classList.remove('bg-transparent', 'text-slate-400');
        confirmTab.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
        confirmTab.classList.add('bg-transparent', 'text-slate-400');

        confirmContent.classList.add('hidden');
        armazemContent.classList.remove('hidden');
        if (bulkPanel) bulkPanel.style.display = 'none';
        if (bulkContent) bulkContent.classList.add('hidden');
        if (reconciliationPanel) reconciliationPanel.style.display = 'none';
        if (paymentInfoContainer) paymentInfoContainer.classList.add('hidden');
        if (summaryCards) summaryCards.style.display = 'none';
        if (miniFreightBtn) miniFreightBtn.classList.add('hidden');
        const badgeResponded = document.getElementById('badge-client-responded');
        if (badgeResponded) badgeResponded.classList.add('hidden');

        // Ocultar suportes e expandir coluna principal para lg:col-span-4
        if (sideSuportes) sideSuportes.classList.add('hidden');
        if (mainCol) {
            mainCol.classList.remove('lg:col-span-3');
            mainCol.classList.add('lg:col-span-4');
        }
    }
}

export async function updateConfirmDetailRow(rowIndex, rowData) {
    if (!window.currentActiveClient || !window.currentActiveClient.rows) return;

    // 1. Atualizar o objeto local na memória
    const foundRow = window.currentActiveClient.rows.find(r => r.originalIndex === rowIndex);
    if (!foundRow) return;
    foundRow.originalRow = rowData;

    // 2. Encontrar o elemento no DOM
    const tr = document.querySelector(`tr[data-original-index="${rowIndex}"]`);
    if (!tr) return;

    // 3. Mapear Colunas para obter os índices necessários
    const columns = state.confirm.columns || [];
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

    const orderNumIdx = findCol(['HF2', 'REF', 'REFERENCIA', 'ORDER NUMBER', 'ORDER NUM', 'ORDER', 'CONV', 'CONTENTOR', 'Nº HF2', 'Nº ORDEM', 'NO.', 'N.O', 'N.º', 'Nº', 'N°', 'NO']);
    const cbmIdx = findCol(['CBM', 'M3', 'VOLUME', 'VOL']);
    const unitDutyIdx = findCol(['UNIT CBM DUTY', 'UNIT DUTY', 'CBM DUTY', 'UNIT']);
    const dutyPrepIdx = findCol(['DUTY PREPAID', 'PREPAID', 'PRE-PAGO']);
    const amtDutyIdx = findCol(['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
    
    const paidIdx = columns.findIndex((c, i) => {
        const h = cleanString(c);
        return (h.includes('PAID') || h.includes('PAGO')) && !h.includes('PREPAID') && !h.includes('DUTY');
    });
    
    const balanceIdx = findCol(['BALANCE', 'SALDO', 'BALANCO']);
    const bankDutyIdx = findCol(['BANK IN DUTY', 'BANK', 'BANCO']);
    const statusIdx = findCol(['CONFIRMATION', 'STATUS']);

    const getNum = (row, idx) => idx !== -1 ? (parseFloat(String(row[idx]).replace(/[^0-9.-]+/g, '')) || 0) : 0;
    const getRaw = (row, idx) => idx !== -1 && row[idx] !== undefined && row[idx] !== null && row[idx] !== '' ? row[idx] : '—';
    const formatValue = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

    const orderNumber = getRaw(rowData, orderNumIdx);
    const cbm = getNum(rowData, cbmIdx);
    const unitDuty = getNum(rowData, unitDutyIdx);
    const dutyPrepaid = getNum(rowData, dutyPrepIdx);
    const amountDuty = getNum(rowData, amtDutyIdx);
    const paid = getNum(rowData, paidIdx);
    const balance = getNum(rowData, balanceIdx);
    const bankDuty = getRaw(rowData, bankDutyIdx);

    let rowStatus = String(rowData[statusIdx] || 'PENDENTE').trim();
    if (rowStatus === '?') rowStatus = 'PENDENTE';
    rowStatus = rowStatus.toUpperCase();
    if (rowStatus === 'CONFIRMADO' && balance > 1.0) {
        rowStatus = 'PARCIAL';
    }

    const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[rowIndex];
    const isLockedByOther = lockInfo && lockInfo.userId !== pb.authStore.model?.id;

    // Atualizar HTML interno da linha
    const cleanCurrent = String(bankDuty || '').trim();
    const options = ['?', 'BCI BOSS', 'BIM BOSS', 'BCI JUPITER', 'BIM JUPITER', 'STB JUPITER', 'NED JUPITER', 'PAID IN CHINA', 'REPOSIÇÃO', 'COTACAO', 'EMOLA BOSS'];
    if (cleanCurrent && cleanCurrent !== '—' && !options.includes(cleanCurrent)) {
        options.push(cleanCurrent);
    }
    let optionsHtml = '';
    options.forEach(opt => {
        const isSelected = opt === cleanCurrent || (opt === '?' && (!cleanCurrent || cleanCurrent === '—'));
        optionsHtml += `<option value="${opt}" ${isSelected ? 'selected' : ''}>${opt}</option>`;
    });

    const bankSelectHtml = `
        <select onclick="event.stopPropagation();" onchange="ui.changeBankInDuty(${rowIndex}, this.value)" class="py-0.5 px-1 text-slate-700 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold focus:outline-blue-500 focus:bg-white transition-all max-w-[130px] inline-block" ${isLockedByOther ? 'disabled' : ''}>
            ${optionsHtml}
        </select>
    `;

    const buttonClass = `px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-tighter shadow-sm transition-all border ${rowStatus === 'PENDENTE' ? 'bg-white text-slate-400 border-slate-200 hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-600' : (rowStatus === 'CONFIRMADO' ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-600 hover:text-white' : (rowStatus === 'PARCIAL' ? 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-600 hover:text-white' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white'))}`;

    // Atualiza os TDs individualmente para não perder referências
    tr.className = `row-hover transition-colors border-b border-slate-50 hover:bg-[#f1f5f9] cursor-pointer ${isLockedByOther ? 'opacity-50 pointer-events-none' : ''}`;
    tr.title = isLockedByOther ? `A ser editado por ${lockInfo.user}` : '';
    
    // Configurar o evento onclick da linha com o índice correto na UI
    const indexInActiveClient = window.currentActiveClient.rows.findIndex(r => r.originalIndex === rowIndex);
    tr.onclick = () => ui.openConfirmEditModal(indexInActiveClient);

    tr.innerHTML = `
        <td class="py-0.5 px-4 font-bold text-slate-800 text-[11px]">${orderNumber}</td>
        <td class="py-0.5 px-4 text-center text-slate-600 text-[11px]">${cbm.toFixed(2)}</td>
        <td class="py-0.5 px-4 text-center font-semibold text-blue-700 text-[11px]">${formatValue(amountDuty)}</td>
        <td class="py-0.5 px-4 text-center text-slate-500 text-[11px]">${formatValue(dutyPrepaid)}</td>
        <td class="py-0.5 px-4 text-center font-bold text-green-600 text-[11px]">${formatValue(paid)}</td>
        <td class="py-0.5 px-4 text-center font-bold text-[11px] ${balance > 0 ? 'text-red-500' : 'text-slate-400'}">${formatValue(balance)}</td>
        <td class="py-0.5 px-4 text-center">${bankSelectHtml}</td>
        <td class="py-0.5 px-4 text-center">
            <button onclick="event.stopPropagation(); window.onConfirmRow(${rowIndex}, ${JSON.stringify(rowData).replace(/"/g, '&quot;')})" 
                class="${buttonClass}"
                ${isLockedByOther ? 'disabled' : ''}>
                ${isLockedByOther ? '🔒 ' : ''}${rowStatus}
            </button>
        </td>
    `;

    // 4. Recalcular os totais agregados e atualizar o card de pagamento suavemente
    let totalPaid = 0;
    let totalDutyPrepaid = 0;
    let totalAmountDuty = 0;
    let totalGSheetBalance = 0;
    let allConfirmed = true;

    window.currentActiveClient.rows.forEach(r => {
        const rData = r.originalRow;
        totalPaid += getNum(rData, paidIdx);
        totalDutyPrepaid += getNum(rData, dutyPrepIdx);
        totalAmountDuty += getNum(rData, amtDutyIdx);
        
        const bal = getNum(rData, balanceIdx);
        totalGSheetBalance += bal;

        let rStatus = String(rData[statusIdx] || 'PENDENTE').trim();
        if (rStatus === '?') rStatus = 'PENDENTE';
        rStatus = rStatus.toUpperCase();
        if (rStatus === 'CONFIRMADO' && bal > 1.0) rStatus = 'PARCIAL';

        if (rStatus !== 'CONFIRMADO') allConfirmed = false;
    });

    // Atualizar no estado global do cliente ativo para o card de pagamento
    if (window.currentActiveClientState) {
        const isFullyPrepaid = totalAmountDuty > 0 && Math.abs(totalAmountDuty - totalDutyPrepaid) < 0.01;
        let targetAmount = totalAmountDuty - totalDutyPrepaid;
        if (isFullyPrepaid) {
            targetAmount = totalDutyPrepaid;
        } else if (totalPaid > targetAmount) {
            targetAmount = totalPaid;
        }

        const payments = window.currentActiveClientState.payments || [];
        let totalAllocated = 0;
        payments.forEach(p => totalAllocated += p.amount);

        let remainingToPay = targetAmount - totalAllocated;
        if (remainingToPay < 0) remainingToPay = 0;

        let trueRemaining = (totalAmountDuty - totalDutyPrepaid) - totalAllocated;
        if (trueRemaining < 0) trueRemaining = 0;

        window.currentActiveClientState.targetAmount = targetAmount;
        window.currentActiveClientState.remainingToPay = remainingToPay;
        window.currentActiveClientState.totalDutyPrepaid = totalDutyPrepaid;
        window.currentActiveClientState.trueRemaining = trueRemaining;
        window.currentActiveClientState.totalGSheetBalance = totalGSheetBalance;
        window.currentActiveClientState.allConfirmed = allConfirmed;
        window.currentActiveClientState.totalPaid = totalPaid;
        window.currentActiveClientState.isFullyPrepaid = isFullyPrepaid;

        // Atualiza a UI do card de pagamento sem destruir nada além do card
        updatePaymentCardUI();
    }
}

// === LÓGICA DO MODAL DE EDIÇÃO DE DUTY === //

export function openConfirmEditModal(index) {
    const o = window.currentClientRows[index];
    if (!o) return;

    // Limpar locks expirados (mais de 5 minutos)
    const now = Date.now();
    if (window.activeConfirmLocks) {
        Object.keys(window.activeConfirmLocks).forEach(r => {
            if (now - window.activeConfirmLocks[r].timestamp > 5 * 60 * 1000) {
                delete window.activeConfirmLocks[r];
            }
        });
    }

    // Verificar Lock
    const originalIndex = o.originalIndex;
    if (window.activeConfirmLocks && window.activeConfirmLocks[originalIndex]) {
        const lockInfo = window.activeConfirmLocks[originalIndex];
        if (lockInfo.userId !== pb.authStore.model?.id) {
            toast(`Este registo está a ser editado por ${lockInfo.user}`, 'warning');
            return;
        }
    }
    
    // Emitir Lock Event
    if (state.confirm && state.confirm.sheetId) {
        emitConfirmEvent(state.confirm.sheetId, originalIndex, 'LOCK', { name: pb.authStore.model?.name || 'Utilizador' });
    }

    document.getElementById('edit-index').value = index;
    document.getElementById('edit-orderNumber').value = o.orderNumber;
    document.getElementById('edit-cbm').value = o.cbm;
    document.getElementById('edit-unitDuty').value = o.unitDuty;
    document.getElementById('edit-dutyPrepaid').value = o.dutyPrepaid;
    document.getElementById('edit-amountDuty').value = o.amountDuty;
    document.getElementById('edit-paid').value = o.paid;
    document.getElementById('edit-balance').value = o.balance;

    const badge = document.getElementById('modal-order-badge');
    if (badge) {
        badge.innerText = `#${o.orderNumber}`;
    }

    const selectEl = document.getElementById('edit-bankDuty');
    if (selectEl) {
        const val = o.bankDuty || '?';
        if (val && !Array.from(selectEl.options).some(opt => opt.value === val)) {
            const newOpt = new Option(val, val);
            selectEl.add(newOpt);
        }
        selectEl.value = val;
    }

    // Carregar o estado da confirmação como apenas leitura
    const cols = state.confirm.columns || [];
    const cleanString = (str) => String(str || '')
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]/g, "")
        .trim();
    const findCol = (targets) => {
        const cleanedTargets = targets.map(cleanString);
        for (const target of cleanedTargets) {
            const idx = cols.findIndex(c => cleanString(c) === target);
            if (idx !== -1) return idx;
        }
        for (const target of cleanedTargets) {
            const idx = cols.findIndex(c => cleanString(c).includes(target));
            if (idx !== -1) return idx;
        }
        return -1;
    };
    const statusIdx = findCol(['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);
    let rowStatus = 'PENDENTE';
    if (statusIdx !== -1 && state.confirm.data && state.confirm.data[o.originalIndex]) {
        rowStatus = String(state.confirm.data[o.originalIndex][statusIdx] || 'PENDENTE').trim();
        if (rowStatus === '?') rowStatus = 'PENDENTE';
        rowStatus = rowStatus.toUpperCase();
        if (rowStatus === 'CONFIRMADO' && o.balance > 1.0) {
            rowStatus = 'PARCIAL';
        }
    }
    const editStatusEl = document.getElementById('edit-status');
    if (editStatusEl) {
        editStatusEl.value = rowStatus;
    }

    document.getElementById('confirm-edit-modal').classList.remove('hidden');
}

export function closeConfirmEditModal() {
    document.getElementById('confirm-edit-modal').classList.add('hidden');
    // Emit Unlock Event
    const indexStr = document.getElementById('edit-index')?.value;
    if (indexStr !== undefined && indexStr !== '') {
        const o = window.currentClientRows[parseInt(indexStr)];
        if (o && state.confirm && state.confirm.sheetId) {
            emitConfirmEvent(state.confirm.sheetId, o.originalIndex, 'UNLOCK');
        }
        document.getElementById('edit-index').value = '';
    }
}

export function calculateConfirmDuty() {
    const cbm = parseFloat(document.getElementById('edit-cbm').value) || 0;
    const unitDuty = parseFloat(document.getElementById('edit-unitDuty').value) || 0;
    const paid = parseFloat(document.getElementById('edit-paid').value) || 0;
    const dutyPrepaid = parseFloat(document.getElementById('edit-dutyPrepaid').value) || 0;

    const amount = cbm * unitDuty;
    const bal = amount - paid - dutyPrepaid;

    document.getElementById('edit-amountDuty').value = amount.toFixed(2);
    document.getElementById('edit-balance').value = bal.toFixed(2);
}

// --- REAL-TIME EVENT HANDLER ---
window.activeConfirmLocks = {};

export function handleConfirmRealtimeEvent(e) {
    const record = e.record;
    if (!record) {
        console.warn("[SSE-FASE-4][RECEÇÃO-UI] Evento recebido vazio.");
        return;
    }
    
    const row = Number(record.row_index);
    const type = record.type;
    const payload = record.payload || {};
    const userId = record.user;
    const userName = payload.name || 'Outro utilizador';

    console.log(`[SSE-FASE-4][PROCESSAR-UI] Evento '${type}' recebido para linha ${row} (User: ${userName}, ID: ${userId})`);

    // Remove lock se expirado (mais de 5 minutos)
    const now = new Date().getTime();
    Object.keys(window.activeConfirmLocks).forEach(r => {
        if (now - window.activeConfirmLocks[r].timestamp > 5 * 60 * 1000) {
            console.log(`[SSE-FASE-4][LOCK-EXPIRADO] Removendo lock antigo da linha ${r}`);
            delete window.activeConfirmLocks[r];
        }
    });

    if (type === 'LOCK') {
        window.activeConfirmLocks[row] = { user: userName, userId: userId, timestamp: now };
        console.log(`[SSE-FASE-4][LOCK-ADICIONADO] Linha ${row} bloqueada por ${userName}. Locks ativos:`, window.activeConfirmLocks);
    } else if (type === 'UNLOCK') {
        if (window.activeConfirmLocks[row] && window.activeConfirmLocks[row].userId === userId) {
            delete window.activeConfirmLocks[row];
            console.log(`[SSE-FASE-4][LOCK-REMOVIDO] Linha ${row} desbloqueada por ${userName}. Locks ativos:`, window.activeConfirmLocks);
        } else {
            console.log(`[SSE-FASE-4][LOCK-IGNORADO] UNLOCK ignorado para linha ${row} (não bloqueada por este utilizador ou já desbloqueada).`);
        }
    } else if (type === 'UPDATE') {
        if (payload.rowData) {
            console.log(`[SSE-FASE-4][DADOS-ATUALIZADOS] Atualizando dados da linha ${row} com:`, payload.rowData);
            state.confirm.data[row] = payload.rowData;
            
            if (window.currentActiveClient && window.currentActiveClient.rows) {
                const foundRow = window.currentActiveClient.rows.find(r => r.originalIndex === row);
                if (foundRow) {
                    console.log("[SSE-FASE-4][DETALHE-RE-RENDER] Linha em edição encontrada nos dados do cliente ativo.");
                    foundRow.originalRow = payload.rowData;
                    
                    // Apenas atualiza visualmente o detalhe se o usuário estiver de facto na tela de detalhes
                    const detailView = document.getElementById('view-confirm-client-detail');
                    if (detailView && !detailView.classList.contains('hidden')) {
                        console.log("[SSE-FASE-4][DETALHE-RE-RENDER] O ecrã de detalhe está ativo e visível. Atualizando linha suavemente...");
                        updateConfirmDetailRow(row, payload.rowData);
                    }
                }
            }
            
            const viewEl = document.getElementById('view-confirm-table');
            if (viewEl && !viewEl.classList.contains('hidden')) {
                console.log("[SSE-FASE-4][TABELA-RE-RENDER] Re-renderizando tabela principal...");
                const filterEl = document.getElementById('confirm-status-filter');
                const statusFilter = filterEl?.value || 'PENDENTE';
                const searchEl = document.getElementById('input-confirm-search');
                const searchText = searchEl?.value || '';
                renderConfirmList(state.confirm.data, searchText, statusFilter);
            }
        }
        delete window.activeConfirmLocks[row];
        console.log(`[SSE-FASE-4][UPDATE-COMPLETO] Dados da linha ${row} atualizados. Lock removido.`);
    }
    
    // Atualizar UI dos Locks
    console.log("[SSE-FASE-5][REDESENHAR-UI] Atualizando locks visuais na lista de ordens (detalhe)...");
    updateLocksUI();
    
    // Re-renderizar lista principal para atualizar cadeados e estados visuais
    const filterEl = document.getElementById('confirm-status-filter');
    const statusFilter = filterEl?.value || 'PENDENTE';
    const searchEl = document.getElementById('input-confirm-search');
    const searchText = searchEl?.value || '';
    renderConfirmList(state.confirm.data, searchText, statusFilter);
}

export function handleBankRealtimeEvent(e) {
    const record = e.record;
    if (!record) return;

    console.log(`[SSE-BANCO][RECEÇÃO-UI] Evento '${e.action}' no bank_incomes:`, record);

    // 1. Se estivermos na aba Banco (Extratos), atualiza a tabela
    const financeView = document.getElementById('view-finance');
    if (financeView && !financeView.classList.contains('hidden')) {
        console.log("[SSE-BANCO][UI] Tela do Banco está ativa. Atualizando extratos...");
        if (typeof window.handleManualFinanceRefresh === 'function') {
            window.handleManualFinanceRefresh();
        }
    }

    // 2. Se o mini-filtro de pagamentos estiver aberto, atualiza a lista
    const paymentMiniFilter = document.getElementById('payment-mini-filter');
    if (paymentMiniFilter && !paymentMiniFilter.classList.contains('hidden')) {
        console.log("[SSE-BANCO][UI] Mini-filtro de pagamentos está aberto. Atualizando a lista...");
        if (typeof searchPaymentMiniFilter === 'function') {
            searchPaymentMiniFilter();
        }
    }
}

function updateLocksUI() {
    const trs = document.querySelectorAll('#orders-tbody tr');
    console.log(`[SSE-FASE-5][LOCKS-DETALHE] Atualizando estado de bloqueio visual para ${trs.length} linhas de ordens.`);
    trs.forEach(tr => {
        const rowAttr = tr.getAttribute('data-original-index');
        if (!rowAttr) return;
        const rowIndex = parseInt(rowAttr);
        
        const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[rowIndex];
        if (lockInfo && lockInfo.userId !== pb.authStore.model?.id) {
            console.log(`[SSE-FASE-5][LINHA-BLOQUEADA] Aplicando cadeado e bloqueando edição da linha ${rowIndex} (Editada por: ${lockInfo.user})`);
            tr.classList.add('opacity-50', 'pointer-events-none');
            tr.title = `A ser editado por ${lockInfo.user}`;
            const btn = tr.querySelector('button');
            if (btn) {
                let cleanText = btn.innerHTML.replace('🔒 ', '').trim();
                btn.innerHTML = '🔒 ' + cleanText;
                btn.disabled = true;
            }
            const select = tr.querySelector('select');
            if (select) select.disabled = true;
        } else {
            tr.classList.remove('opacity-50', 'pointer-events-none');
            tr.title = "";
            const btn = tr.querySelector('button');
            if (btn) {
                btn.innerHTML = btn.innerHTML.replace('🔒 ', '').trim();
                btn.disabled = false;
            }
            const select = tr.querySelector('select');
            if (select) select.disabled = false;
        }
    });

    // Atualizar o card de pagamento se estivermos no detalhe do cliente
    updatePaymentCardUI();
}

function escapeJSAndHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ');
}

export function getPaymentCardHtml(client, stateObj) {
    if (!client || !stateObj) return '';

    const {
        combinedInfo,
        bankValue,
        clientPhone,
        clientNotaDuty,
        targetAmount,
        totalAllocated,
        remainingToPay,
        totalDutyPrepaid,
        trueRemaining,
        payments,
        totalGSheetBalance,
        allConfirmed,
        totalPaid,
        isFullyPrepaid
    } = stateObj;

    // Lógica do utilizador adaptada para pagamentos parciais:
    // O card deve estar visível se o cliente não estiver totalmente confirmado
    // E (o saldo na planilha for zero, OU houver pagamentos vinculados, OU houver um valor pago na planilha).
    const isBalanceZero = totalGSheetBalance !== undefined && Math.abs(totalGSheetBalance) < 0.01;
    const isAllConfirmed = allConfirmed === true;
    const hasPaymentsLinked = payments && payments.length > 0;
    const hasPaidAmount = totalPaid !== undefined && totalPaid > 0.01;

    const shouldShowCard = !isAllConfirmed && (isBalanceZero || hasPaymentsLinked || hasPaidAmount);
    if (!shouldShowCard) {
        return '';
    }

    // Formatação Numérica (pt-BR para 2 casas decimais)
    const formatValue = (val) => new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val);

    const isClientLockedByOther = client.rows && client.rows.some(rowObj => {
        const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[rowObj.originalIndex];
        return lockInfo && lockInfo.userId !== pb.authStore.model?.id;
    });

    let cardBorder = "border-green-500";
    let textColor = "text-green-600";
    let titleLabel = "Somatório Total (PAID)";

    if (isFullyPrepaid) {
        cardBorder = "border-gray-200 bg-gray-50";
        textColor = "text-gray-400";
        titleLabel = "Duty Prepaid";
    }

    let cardClick = '';
    let cardCursor = '';
    let displayValueHtml = '';

    if (isClientLockedByOther) {
        const lockingUser = client.rows.reduce((name, rowObj) => {
            if (name) return name;
            const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[rowObj.originalIndex];
            if (lockInfo && lockInfo.userId !== pb.authStore.model?.id) return lockInfo.user;
            return name;
        }, null);
        cardClick = "";
        cardCursor = "cursor-not-allowed opacity-50";
        cardBorder = "border-red-300 bg-red-50";
        textColor = "text-red-600";
        titleLabel = `Bloqueado: Editado por ${lockingUser || 'Outro'}`;
        displayValueHtml = `<span class="flex items-center justify-center gap-2">🔒 ${formatValue(targetAmount)}</span>`;
    } else if (isFullyPrepaid) {
        cardClick = "";
        cardCursor = "cursor-default opacity-60";
        displayValueHtml = formatValue(targetAmount);
        titleLabel = "Duty Prepaid (Pago na China)";
    } else if (remainingToPay <= 0 && targetAmount > 0) {
        cardClick = "";
        cardCursor = "cursor-default opacity-60";
        cardBorder = "border-gray-200 bg-gray-50";
        textColor = "text-gray-400";
        titleLabel = "Pagamento Concluído";
        displayValueHtml = formatValue(targetAmount);
    } else {
        cardClick = `onclick="window.paymentReconciliationContext = null; ui.openPaymentMiniFilter('${escapeJSAndHTML(combinedInfo)}', '${escapeJSAndHTML(bankValue)}', '${escapeJSAndHTML(trueRemaining)}', '', '${escapeJSAndHTML(client.displayName)}', '${escapeJSAndHTML(clientPhone)}', '${escapeJSAndHTML(clientNotaDuty)}')"`;
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

    return `
        <div ${cardClick} class="${cardCursor} bg-white p-6 rounded-xl border-2 ${cardBorder} shadow-lg min-w-[300px]">
            <p class="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest text-center">${titleLabel}</p>
            <div class="text-4xl font-black ${textColor} text-center">
                ${displayValueHtml}
            </div>
        </div>
    `;
}

export function updatePaymentCardUI() {
    const summaryCardsEl = document.getElementById('summary-cards');
    if (!summaryCardsEl) return;
    if (window.currentActiveClient && window.currentActiveClientState) {
        console.log("[SSE-FASE-5][LOCKS-CARD-PAGAMENTO] Atualizando card de pagamento em tempo real baseado em active locks.");
        const html = getPaymentCardHtml(window.currentActiveClient, window.currentActiveClientState);
        summaryCardsEl.innerHTML = html;
        if (html === '') {
            summaryCardsEl.classList.add('hidden');
        } else {
            summaryCardsEl.classList.remove('hidden');
        }
    }
}

export async function saveConfirmOrderEdit(e) {
    e.preventDefault();
    
    const index = parseInt(document.getElementById('edit-index').value);
    const o = window.currentClientRows[index];
    if (!o) return;

    if (window.activeConfirmLocks && window.activeConfirmLocks[o.originalIndex]) {
        const lockInfo = window.activeConfirmLocks[o.originalIndex];
        if (lockInfo.userId !== pb.authStore.model?.id) {
            toast(`Este registo está a ser editado por ${lockInfo.user}`, 'warning');
            closeConfirmEditModal();
            if (window.currentActiveClient) {
                showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
            }
            return;
        }
    }

    const btn = document.getElementById('btn-confirm-edit-save');
    setBtnLoading(btn, true, "A gravar...");
    setLoader(true, "A atualizar Google Sheets...");

    const cbm = parseFloat(document.getElementById('edit-cbm').value) || 0;
    const unitDuty = parseFloat(document.getElementById('edit-unitDuty').value) || 0;
    const dutyPrepaid = parseFloat(document.getElementById('edit-dutyPrepaid').value) || 0;
    const amountDuty = parseFloat(document.getElementById('edit-amountDuty').value) || 0;
    const paid = parseFloat(document.getElementById('edit-paid').value) || 0;
    const balance = parseFloat(document.getElementById('edit-balance').value) || 0;
    const bankDutyVal = document.getElementById('edit-bankDuty').value;
    const bankDuty = bankDutyVal === '?' ? '' : bankDutyVal;

    // 1. Identificar colunas no GSheet
    const cols = state.confirm.columns || [];

    const cleanString = (str) => String(str || '')
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]/g, "")
        .trim();

    const findCol = (targets) => {
        const cleanedTargets = targets.map(cleanString);
        for (const target of cleanedTargets) {
            const idx = cols.findIndex(c => cleanString(c) === target);
            if (idx !== -1) return idx;
        }
        for (const target of cleanedTargets) {
            const idx = cols.findIndex(c => cleanString(c).includes(target));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const cbmIdx = findCol(['CBM', 'M3', 'VOLUME', 'VOL']);
    const unitDutyIdx = findCol(['UNIT CBM DUTY', 'UNIT DUTY', 'CBM DUTY', 'UNIT']);
    const dutyPrepaidIdx = findCol(['DUTY PREPAID', 'PREPAID', 'PRE-PAGO']);
    const amountDutyIdx = findCol(['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
    
    const paidIdx = cols.findIndex((c, i) => {
        const h = cleanString(c);
        return (h.includes('PAID') || h.includes('PAGO')) && !h.includes('PREPAID') && !h.includes('DUTY');
    });
    
    const balanceIdx = findCol(['BALANCE', 'SALDO', 'BALANCO']);
    const bankDutyIdx = findCol(['BANK IN DUTY', 'BANK', 'BANCO']);
    const statusIdx = findCol(['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);

    // 2. Preparar valores para a linha específica
    const rowData = [...state.confirm.data[o.originalIndex]];
    if (cbmIdx !== -1) rowData[cbmIdx] = cbm;
    if (unitDutyIdx !== -1) rowData[unitDutyIdx] = unitDuty;
    if (dutyPrepaidIdx !== -1) rowData[dutyPrepaidIdx] = dutyPrepaid;
    if (amountDutyIdx !== -1) rowData[amountDutyIdx] = amountDuty;
    if (paidIdx !== -1) rowData[paidIdx] = paid;
    if (balanceIdx !== -1) rowData[balanceIdx] = balance;
    if (bankDutyIdx !== -1) rowData[bankDutyIdx] = bankDuty;



    try {
        const spreadsheetId = state.confirm.sheetId;
        let sheetName = 'Folha1';
        if (state.confirm.range && state.confirm.range.includes('!')) {
            sheetName = state.confirm.range.split('!')[0];
        }
        const rowNum = o.originalIndex + 1;
        const cleanSheetName = sheetName.replace(/'/g, '');

        // Criar lote para atualizar apenas as células modificadas
        const batchUpdates = [];
        if (cbmIdx !== -1) {
            batchUpdates.push({
                range: `${cleanSheetName}!${getColLetter(cbmIdx)}${rowNum}`,
                values: [[cbm]]
            });
        }
        if (unitDutyIdx !== -1) {
            batchUpdates.push({
                range: `${cleanSheetName}!${getColLetter(unitDutyIdx)}${rowNum}`,
                values: [[unitDuty]]
            });
        }
        if (dutyPrepaidIdx !== -1) {
            batchUpdates.push({
                range: `${cleanSheetName}!${getColLetter(dutyPrepaidIdx)}${rowNum}`,
                values: [[dutyPrepaid]]
            });
        }
        if (amountDutyIdx !== -1) {
            batchUpdates.push({
                range: `${cleanSheetName}!${getColLetter(amountDutyIdx)}${rowNum}`,
                values: [[amountDuty]]
            });
        }
        if (paidIdx !== -1) {
            batchUpdates.push({
                range: `${cleanSheetName}!${getColLetter(paidIdx)}${rowNum}`,
                values: [[paid]]
            });
        }
        // if (balanceIdx !== -1) {
        //     batchUpdates.push({
        //         range: `${cleanSheetName}!${getColLetter(balanceIdx)}${rowNum}`,
        //         values: [[balance]]
        //     });
        // }
        if (bankDutyIdx !== -1) {
            batchUpdates.push({
                range: `${cleanSheetName}!${getColLetter(bankDutyIdx)}${rowNum}`,
                values: [[bankDuty]]
            });
        }


        if (batchUpdates.length > 0) {
            await updateGSheetBatch(spreadsheetId, batchUpdates);
        }
        
        // Atualizar estado local
        state.confirm.data[o.originalIndex] = rowData;
        o.cbm = cbm;
        o.unitDuty = unitDuty;
        o.dutyPrepaid = dutyPrepaid;
        o.amountDuty = amountDuty;
        o.paid = paid;
        o.balance = balance;
        o.bankDuty = bankDuty;

        toast("Alterações gravadas com sucesso no Google Sheets!", "success");
        closeConfirmEditModal();
        
        // Emit Update Event
        if (state.confirm && state.confirm.sheetId) {
            emitConfirmEvent(state.confirm.sheetId, o.originalIndex, 'UPDATE', {
                status: rowData[statusIdx],
                rowData: rowData
            });
        }
        
        // Re-renderizar os detalhes do cliente suavemente
        if (window.currentActiveClient) {
            updateConfirmDetailRow(o.originalIndex, rowData);
        }

    } catch (err) {
        console.error(err);
        toast("Erro ao gravar no Google Sheets: " + err.message, "error");
    } finally {
        setLoader(false);
        setBtnLoading(btn, false);
    }
}

export async function changeBankInDuty(originalRowIndex, newBankValue) {
    if (window.activeConfirmLocks && window.activeConfirmLocks[originalRowIndex]) {
        const lockInfo = window.activeConfirmLocks[originalRowIndex];
        if (lockInfo.userId !== pb.authStore.model?.id) {
            toast(`Este registo está a ser editado por ${lockInfo.user}`, 'warning');
            if (window.currentActiveClient) {
                showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
            }
            return;
        }
    }

    setLoader(true, "A atualizar banco no Google Sheets...");
    try {
        const cols = state.confirm.columns;
        const bankDutyIdx = cols.findIndex(c => {
            const name = String(c).toUpperCase().trim();
            return name === 'BANK IN DUTY' || name === 'BANK' || name === 'BANCO';
        });

        if (bankDutyIdx === -1) {
            throw new Error("Coluna BANK IN DUTY não encontrada no Google Sheets.");
        }

        // 1. Preparar valores para a linha específica
        const rowData = [...state.confirm.data[originalRowIndex]];
        rowData[bankDutyIdx] = newBankValue === '?' ? '' : newBankValue;

        const spreadsheetId = state.confirm.sheetId;
        let sheetName = 'Folha1';
        if (state.confirm.range && state.confirm.range.includes('!')) {
            sheetName = state.confirm.range.split('!')[0];
        }
        const rowNum = originalRowIndex + 1;
        const cleanSheetName = sheetName.replace(/'/g, '');
        const colLetter = getColLetter(bankDutyIdx);
        const cellRange = `${cleanSheetName}!${colLetter}${rowNum}`;

        await updateGSheet(spreadsheetId, cellRange, [[newBankValue === '?' ? '' : newBankValue]]);
        
        // 2. Atualizar estado local
        state.confirm.data[originalRowIndex] = rowData;
        
        toast("Banco atualizado com sucesso no Google Sheets!", "success");

        // Emitir evento UPDATE para outros utilizadores saberem em tempo real
        if (state.confirm && state.confirm.sheetId) {
            const statusIdx = cols.findIndex(c => {
                const name = String(c).toUpperCase().trim();
                return name === 'CONFIRMATION' || name === 'STATUS' || name === 'CONFIRM';
            });
            let status = statusIdx !== -1 ? rowData[statusIdx] : 'PENDENTE';
            if (String(status).trim() === '?') {
                status = 'PENDENTE';
            }
            emitConfirmEvent(state.confirm.sheetId, originalRowIndex, 'UPDATE', {
                status: status,
                rowData: rowData
            });
        }

        // 3. Re-renderizar suavemente
        if (window.currentActiveClient) {
            updateConfirmDetailRow(originalRowIndex, rowData);
        }
    } catch (err) {
        console.error(err);
        toast("Erro ao atualizar banco no Google Sheets: " + err.message, "error");
    } finally {
        setLoader(false);
    }
}

export async function applyBulkUpdate() {
    const role = pb.authStore.model?.role || 'USER';
    const isL1 = role === 'USER' || role === 'USER_L1';

    if (!window.currentActiveClient || !window.currentClientRows || window.currentClientRows.length === 0) {
        toast("Nenhuma ordem ativa para atualizar.", "error");
        return;
    }

    const bulkBankSelect = document.getElementById('bulk-bank');
    const bulkStatusSelect = document.getElementById('bulk-status');
    if (!bulkBankSelect || !bulkStatusSelect) return;

    const selectedBank = bulkBankSelect.value;
    const selectedStatus = bulkStatusSelect.value;

    if (isL1 && selectedStatus) {
        toast("Acesso Negado: A alteração de estado em massa exige nível de permissão Nível 2 ou superior.", "error");
        return;
    }

    if (!selectedBank && !selectedStatus) {
        toast("Por favor, selecione um Banco ou um Estado para aplicar.", "warning");
        return;
    }

    let applyConfirmAndPay = false;
    if (selectedBank) {
        const updateValues = confirm("Deseja também atualizar os valores destas ordens como pagos (Paid = Amount Duty)?");
        if (updateValues) {
            if (isL1) {
                toast("Aviso: Apenas o banco será atualizado. Atualizar valores exige permissões de Nível 2 ou superior.", "warning");
            } else {
                applyConfirmAndPay = true;
            }
        }
    }

    let confirmMsg = "Tem a certeza que deseja aplicar esta alteração em massa a todas as ordens deste cliente?";
    if (!confirm(confirmMsg)) return;

    setLoader(true, "A atualizar ordens em massa no Google Sheets...");

    try {
        const columns = state.confirm.columns;
        const spreadsheetId = state.confirm.sheetId;

        let sheetName = 'Folha1';
        if (state.confirm.range && state.confirm.range.includes('!')) {
            sheetName = state.confirm.range.split('!')[0];
        }
        const cleanSheetName = sheetName.replace(/'/g, '');

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

        const bankDutyIdx = findCol(['BANK IN DUTY', 'BANK', 'BANCO']);
        const statusIdx = findCol(['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);
        const paidIdx = columns.findIndex((c, i) => {
            const h = cleanString(c);
            return (h.includes('PAID') || h.includes('PAGO')) && !h.includes('PREPAID') && !h.includes('DUTY');
        });
        const amtDutyIdx = findCol(['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
        const balanceIdx = findCol(['BALANCE', 'SALDO', 'BALANCO']);

        let updatedCount = 0;
        let skippedCount = 0;
        const batchUpdates = [];
        const localUpdates = [];

        for (const rowInfo of window.currentClientRows) {
            const originalIndex = rowInfo.originalIndex;

            // Verificar se o registo está bloqueado por outro utilizador
            const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[originalIndex];
            const isLockedByOther = lockInfo && lockInfo.userId !== pb.authStore.model?.id;
            if (isLockedByOther) {
                skippedCount++;
                continue;
            }

            // Preparar a linha clonada
            const rowData = [...state.confirm.data[originalIndex]];
            let modified = false;

            // Atualizar Banco se selecionado
            if (selectedBank) {
                if (bankDutyIdx !== -1) {
                    rowData[bankDutyIdx] = selectedBank === '?' ? '' : selectedBank;
                    modified = true;
                }
            }

            // Se o usuário optou por atualizar os valores como pagos
            if (applyConfirmAndPay) {
                const amountDutyVal = amtDutyIdx !== -1 ? (parseFloat(String(rowData[amtDutyIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0) : 0;
                if (paidIdx !== -1) rowData[paidIdx] = amountDutyVal;
                if (balanceIdx !== -1) rowData[balanceIdx] = 0;
                modified = true;
            }

            // Determinar o status efetivo (apenas se selecionado no dropdown)
            const effectiveStatus = selectedStatus;

            // Atualizar Status se selecionado
            if (effectiveStatus) {
                if (statusIdx !== -1) {
                    rowData[statusIdx] = effectiveStatus;
                    modified = true;

                    const amountDutyVal = amtDutyIdx !== -1 ? (parseFloat(String(rowData[amtDutyIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0) : 0;

                    if (effectiveStatus === 'CONFIRMADO') {
                        if (paidIdx !== -1) rowData[paidIdx] = amountDutyVal;
                        if (balanceIdx !== -1) rowData[balanceIdx] = 0;
                    } else if (effectiveStatus === 'PENDENTE') {
                        if (paidIdx !== -1) rowData[paidIdx] = '';
                        if (balanceIdx !== -1) rowData[balanceIdx] = amountDutyVal;
                    }
                }
            }

            if (modified) {
                // Emitir LOCK temporário para o real-time
                emitConfirmEvent(spreadsheetId, originalIndex, 'LOCK', { name: pb.authStore.model?.name || 'Utilizador' });

                // Acumular apenas as células modificadas no Google Sheets
                const rowNum = originalIndex + 1;
                if (selectedBank && bankDutyIdx !== -1) {
                    batchUpdates.push({
                        range: `${cleanSheetName}!${getColLetter(bankDutyIdx)}${rowNum}`,
                        values: [[rowData[bankDutyIdx]]]
                    });
                }
                
                let wrotePaidAndBalance = false;
                if (applyConfirmAndPay) {
                    if (paidIdx !== -1) {
                        batchUpdates.push({
                            range: `${cleanSheetName}!${getColLetter(paidIdx)}${rowNum}`,
                            values: [[rowData[paidIdx]]]
                        });
                    }
                    // if (balanceIdx !== -1) {
                    //     batchUpdates.push({
                    //         range: `${cleanSheetName}!${getColLetter(balanceIdx)}${rowNum}`,
                    //         values: [[rowData[balanceIdx]]]
                    //     });
                    // }
                    wrotePaidAndBalance = true;
                }

                if (effectiveStatus) {
                    if (statusIdx !== -1) {
                        batchUpdates.push({
                            range: `${cleanSheetName}!${getColLetter(statusIdx)}${rowNum}`,
                            values: [[rowData[statusIdx]]]
                        });
                    }
                    if (!wrotePaidAndBalance) {
                        if (paidIdx !== -1) {
                            batchUpdates.push({
                                range: `${cleanSheetName}!${getColLetter(paidIdx)}${rowNum}`,
                                values: [[rowData[paidIdx]]]
                            });
                        }
                        // if (balanceIdx !== -1) {
                        //     batchUpdates.push({
                        //         range: `${cleanSheetName}!${getColLetter(balanceIdx)}${rowNum}`,
                        //         values: [[rowData[balanceIdx]]]
                        //     });
                        // }
                    }
                }

                localUpdates.push({
                    originalIndex,
                    rowData,
                    status: effectiveStatus || rowData[statusIdx] || 'PENDENTE'
                });

                updatedCount++;
            }
        }

        if (batchUpdates.length > 0) {
            await updateGSheetBatch(spreadsheetId, batchUpdates);

            for (const item of localUpdates) {
                // Atualizar estado local
                state.confirm.data[item.originalIndex] = item.rowData;

                // Emitir UPDATE e UNLOCK
                emitConfirmEvent(spreadsheetId, item.originalIndex, 'UPDATE', {
                    status: item.status,
                    rowData: item.rowData,
                    name: pb.authStore.model?.name || 'Utilizador'
                });
                emitConfirmEvent(spreadsheetId, item.originalIndex, 'UNLOCK');
            }
        }

        if (updatedCount > 0) {
            toast(`${updatedCount} ordens atualizadas com sucesso em massa!`, "success");
        }
        if (skippedCount > 0) {
            toast(`${skippedCount} ordens ignoradas por estarem a ser editadas por outros utilizadores.`, "warning");
        }

        // Resetar selects
        bulkBankSelect.value = "";
        bulkStatusSelect.value = "";

        // Reprocessar agrupamentos
        const filterText = document.getElementById('input-confirm-search')?.value || '';
        const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
        renderConfirmList(state.confirm.data, filterText, statusFilter);

        // Re-exibir o detalhe do cliente atualizado
        const freshClient = state.confirm.groupedClients?.find(c => 
            (c.groupId && window.currentActiveClient.groupId && c.groupId === window.currentActiveClient.groupId) || 
            (c.displayIdCode && c.displayIdCode === window.currentActiveClient.displayIdCode)
        );

        if (freshClient) {
            await showConfirmDetail(freshClient, window.currentActiveClientIndex);
        } else {
            showView('view-confirm-table');
        }

    } catch (err) {
        console.error(err);
        toast("Erro ao aplicar alterações em massa: " + err.message, "error");
    } finally {
        setLoader(false);
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
        div.className = "flex items-center gap-2 p-1 px-2 border border-slate-100 hover:border-slate-200 rounded-lg hover:shadow-xs transition-all bg-white hover:bg-slate-50 cursor-pointer group";

        div.onclick = (e) => {
            if (isFolder) {
                window.navigateToFolder(file.id);
            } else {
                window.showFilePreview(file);
            }
        };

        const iconColor = isFolder ? 'text-blue-500' : 'text-slate-400';

        div.innerHTML = `
            <div class="${iconColor} shrink-0 flex items-center justify-center">
                ${isFolder ?
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>' :
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>'
            }
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold truncate text-slate-700 group-hover:text-slate-950 text-[10px] leading-tight">${file.name}</p>
                ${isFolder ? `<p class="text-[7px] text-blue-500 font-bold uppercase tracking-wider mt-0.5">Pasta</p>` : ''}
            </div>
            
            <div class="flex items-center gap-1 shrink-0">
                ${!isFolder ? `
                    <button onclick="event.stopPropagation(); window.confirmAndDeleteFile('${file.id}', '${file.name}', '${currentFolderId}')" 
                        class="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all rounded opacity-0 group-hover:opacity-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                ` : ''}
                <div class="text-slate-300 group-hover:text-slate-500 transition-all p-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
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

    const isProjAdmin = (pb.authStore.model?.role || 'USER') === 'ADMIN';

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
                ${isProjAdmin ? `<button onclick="openConfirmProjectModal()" class="mt-4 text-blue-600 font-bold uppercase text-[10px] hover:underline">+ Adicionar Primeiro Projeto</button>` : ''}
            </div>
        `;
        return;
    }

    // Sincronizar botões de modo de exibição de projetos
    const viewMode = state.confirm.projectViewMode || localStorage.getItem('confirm_project_view_mode') || 'grid';
    const btnGrid = document.getElementById('btn-proj-view-grid');
    const btnList = document.getElementById('btn-proj-view-list');
    const btnTable = document.getElementById('btn-proj-view-table');

    if (btnGrid) btnGrid.className = `p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnList) btnList.className = `p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnTable) btnTable.className = `p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;

    // === 2 - SEÇÃO DE ACESSO RÁPIDO A PROJETOS (RANKING) ===
    const accessedProjects = projects
        .map(p => ({ ...p, accessCount: getProjectAccessCount(p.sheetId) }))
        .filter(p => p.accessCount > 0)
        .sort((a, b) => b.accessCount - a.accessCount);

    const topAccessed = accessedProjects.slice(0, 4);

    if (topAccessed.length > 0 && !isSearch) {
        const rankingContainer = document.createElement('div');
        rankingContainer.className = "col-span-full mb-2 bg-gradient-to-r from-yellow-50 to-amber-50/50 border border-yellow-100 rounded-2xl p-4 shadow-sm";
        
        rankingContainer.innerHTML = `
            <div class="flex items-center gap-1.5 mb-3">
                <span class="text-xs">⚡</span>
                <h4 class="text-[9px] font-black uppercase tracking-wider text-yellow-800">Acesso Rápido (Projetos Mais Utilizados)</h4>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3"></div>
        `;
        
        const cardsGrid = rankingContainer.querySelector('.grid');
        topAccessed.forEach((p, rankIdx) => {
            const card = document.createElement('div');
            card.className = "bg-white/90 p-3 rounded-xl border border-yellow-100/70 flex items-center justify-between gap-2 hover:border-yellow-400 hover:bg-white cursor-pointer transition-all active:scale-[0.98]";
            card.onclick = () => selectConfirmProject(p.sheetId, p.folderId, p.name.replace(/'/g, "\\'"));
            
            const medal = rankIdx === 0 ? '🥇' : rankIdx === 1 ? '🥈' : rankIdx === 2 ? '🥉' : '⭐';
            
            card.innerHTML = `
                <div class="flex items-center gap-2 overflow-hidden w-full">
                    <div class="bg-yellow-400 text-black w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm font-black text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div class="overflow-hidden w-full">
                        <h5 class="text-xs font-black text-slate-800 truncate uppercase leading-tight">${p.name}</h5>
                        <p class="text-[8px] text-slate-400 font-bold uppercase">${medal} Rank ${rankIdx + 1} (${p.accessCount} ${p.accessCount === 1 ? 'acesso' : 'acessos'})</p>
                    </div>
                </div>
            `;
            cardsGrid.appendChild(card);
        });
        container.appendChild(rankingContainer);
    }

    // === 1 - MODOS DE EXIBIÇÃO DE PROJETOS ===
    if (viewMode === 'grid') {
        container.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 px-4";
        projects.forEach(p => {
            const card = document.createElement('div');
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
                
                ${isProjAdmin ? `
                <div class="flex items-center gap-2 shrink-0">
                    <button onclick="event.stopPropagation(); openConfirmProjectModal('${p.id}')" 
                        class="w-8 h-8 bg-slate-50 text-slate-300 rounded-lg flex items-center justify-center hover:bg-black hover:text-white transition-all border border-slate-100 active:scale-90">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                </div>
                ` : ''}
            `;
            container.appendChild(card);
        });
    }
    else if (viewMode === 'list') {
        container.className = "flex flex-col gap-2.5 px-4 w-full col-span-full";
        projects.forEach(p => {
            const card = document.createElement('div');
            card.className = "bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between group transition-all hover:border-black cursor-pointer hover:shadow-sm active:scale-[0.99]";
            card.onclick = () => selectConfirmProject(p.sheetId, p.folderId, p.name.replace(/'/g, "\\'"));

            card.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="bg-yellow-400 text-black w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div>
                        <h3 class="text-xs font-black text-slate-800 uppercase tracking-tight leading-none group-hover:text-black transition-colors">${p.name}</h3>
                        <p class="text-[8px] text-slate-400 font-bold uppercase mt-1 leading-none">Sheet ID: ${p.sheetId.slice(0, 15)}...</p>
                    </div>
                </div>
                
                ${isProjAdmin ? `
                <div class="flex items-center gap-2 shrink-0">
                    <button onclick="event.stopPropagation(); openConfirmProjectModal('${p.id}')" 
                        class="w-7 h-7 bg-slate-50 text-slate-300 rounded-lg flex items-center justify-center hover:bg-black hover:text-white transition-all border border-slate-100 active:scale-90">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                </div>
                ` : ''}
            `;
            container.appendChild(card);
        });
    }
    else if (viewMode === 'table') {
        container.className = "w-full col-span-full px-4 overflow-x-auto custom-scrollbar";
        
        const wrapper = document.createElement('div');
        wrapper.className = "bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm w-full";
        
        let tableRowsHtml = '';
        projects.forEach(p => {
            const trId = `tr-proj-${p.id}`;
            tableRowsHtml += `
                <tr id="${trId}" class="hover:bg-slate-50 border-b border-gray-100 transition-all cursor-pointer group">
                    <td class="p-3 font-black text-xs uppercase text-slate-700 group-hover:text-black transition-colors flex items-center gap-2">
                        <div class="bg-yellow-400 text-black w-6 h-6 rounded-md flex items-center justify-center shrink-0 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        </div>
                        ${p.name}
                    </td>
                    <td class="p-3 text-slate-500 font-mono text-[10px] truncate max-w-[150px]">${p.sheetId}</td>
                    <td class="p-3 text-slate-500 font-mono text-[10px] truncate max-w-[150px]">${p.folderId || '—'}</td>
                    ${isProjAdmin ? `
                    <td class="p-3 text-center">
                        <button onclick="event.stopPropagation(); openConfirmProjectModal('${p.id}')" 
                            class="w-7 h-7 bg-slate-50 text-slate-400 rounded-lg inline-flex items-center justify-center hover:bg-black hover:text-white transition-all border border-slate-100 active:scale-90 mx-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </td>
                    ` : ''}
                </tr>
            `;
        });

        wrapper.innerHTML = `
            <table class="w-full border-collapse text-left">
                <thead class="bg-slate-50 border-b border-gray-200 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                    <tr>
                        <th class="p-3">Nome do Projeto</th>
                        <th class="p-3">ID da Planilha (Sheet ID)</th>
                        <th class="p-3">ID da Pasta (Folder ID)</th>
                        ${isProjAdmin ? '<th class="p-3 text-center w-24">Ações</th>' : ''}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${tableRowsHtml}
                </tbody>
            </table>
        `;
        
        container.appendChild(wrapper);

        // Atribuir manipuladores de cliques aos TRs
        projects.forEach(p => {
            const tr = document.getElementById(`tr-proj-${p.id}`);
            if (tr) {
                tr.onclick = () => selectConfirmProject(p.sheetId, p.folderId, p.name.replace(/'/g, "\\'"));
            }
        });
    }
}

function parseWhatsAppFormat(text) {
    if (!text) return "";
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
    html = html.replace(/_(.*?)_/g, "<em>$1</em>");
    html = html.replace(/~(.*?)~/g, "<del>$1</del>");
    html = html.replace(/```(.*?)```/gs, "<code class='bg-black/5 p-1 rounded font-mono text-[11px]'>$1</code>");
    return html;
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
    const zoomControls = document.getElementById('preview-zoom-controls');

    if (!modal || !content || !filenameEl) return;

    filenameEl.innerText = file.name;
    if (downloadLink) downloadLink.href = `/api/google/drive/file/${file.id}`;
    content.innerHTML = '<div class="text-xs font-bold animate-pulse">A CARREGAR PRÉ-VISUALIZAÇÃO...</div>';

    if (zoomControls) zoomControls.classList.add('hidden');

    openModal('modal-file-preview');

    const isImage = file.mimeType.startsWith('image/');
    const isPDF = file.mimeType === 'application/pdf';
    const isMD = file.mimeType === 'text/markdown' || file.name.toLowerCase().endsWith('.md');

    if (isImage) {
        const imgUrl = `/api/google/drive/file/${file.id}`;
        content.innerHTML = `
            <div id="preview-img-wrapper" class="flex items-center justify-center w-full h-full p-4" style="width: 100%; height: 100%;">
                <img id="preview-img-zoom" src="${imgUrl}" class="max-w-full max-h-full object-contain rounded-lg shadow-lg transition-transform duration-200" style="transform: scale(1.0); transform-origin: center;" crossorigin="anonymous">
            </div>
        `;
        window.imgZoomScale = 1.0;
        if (zoomControls) {
            zoomControls.classList.remove('hidden');
            const zoomLevelEl = document.getElementById('preview-zoom-level');
            if (zoomLevelEl) zoomLevelEl.innerText = "100%";
        }
    } else if (isPDF) {
        // Para PDFs, usamos o endpoint local para que o browser utilize o seu visualizador nativo.
        // O visualizador nativo (Chrome/Edge/Firefox) permite selecionar e copiar texto.
        const fileUrl = `/api/google/drive/file/${file.id}`;
        content.innerHTML = `<iframe src="${fileUrl}" class="w-full h-full border-0 rounded-lg shadow-lg bg-white"></iframe>`;
    } else if (isMD) {
        const fileUrl = `/api/google/drive/file/${file.id}`;
        content.innerHTML = `<div class="p-10 flex justify-center items-center h-full w-full bg-[#efeae2] rounded-lg"><div class="animate-pulse font-bold text-gray-500">A processar formato WhatsApp...</div></div>`;
        
        fetch(fileUrl)
            .then(res => res.text())
            .then(text => {
                const waHtml = parseWhatsAppFormat(text);
                content.innerHTML = `
                <div class="w-full h-full bg-[#efeae2] p-4 md:p-8 overflow-y-auto flex flex-col rounded-lg shadow-lg relative" style="background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');">
                    <button id="btn-copy-md" class="absolute top-2 right-2 md:top-4 md:right-4 bg-[#00a884] text-white px-3 py-1.5 rounded-full shadow-md text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-[#008f6f] transition-all z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        COPIAR
                    </button>
                    <div class="max-w-2xl mx-auto w-full flex flex-col gap-2 mt-8 md:mt-0">
                        <div class="self-start bg-white text-[#111b21] p-3 rounded-xl rounded-tl-none shadow-sm text-[14px] leading-relaxed whitespace-pre-wrap break-words font-sans max-w-[90%]">${waHtml}</div>
                    </div>
                </div>`;
                
                const copyBtn = document.getElementById('btn-copy-md');
                if (copyBtn) {
                    copyBtn.onclick = async () => {
                        await window.copyToClipboard(text, "Texto Markdown copiado!");
                        const originalHTML = copyBtn.innerHTML;
                        copyBtn.innerHTML = "COPIADO!";
                        copyBtn.classList.replace('bg-[#00a884]', 'bg-gray-500');
                        setTimeout(() => {
                            copyBtn.innerHTML = originalHTML;
                            copyBtn.classList.replace('bg-gray-500', 'bg-[#00a884]');
                        }, 2000);
                    };
                }
            })
            .catch(err => {
                content.innerHTML = `<div class="p-10 text-center text-red-500 font-bold bg-[#efeae2] w-full h-full rounded-lg">Erro ao carregar ficheiro Markdown.</div>`;
            });
    } else {
        content.innerHTML = `<div class="p-10 text-center text-slate-400 font-bold uppercase text-xs">Pré-visualização não suportada para este tipo de ficheiro.</div>`;
    }
}

// Controle de Zoom na Imagem
window.imgZoomScale = 1.0;

export function zoomImage(delta) {
    const img = document.getElementById('preview-img-zoom');
    const wrapper = document.getElementById('preview-img-wrapper');
    const zoomLevelEl = document.getElementById('preview-zoom-level');
    if (!img || !wrapper) return;

    window.imgZoomScale = Math.max(0.4, Math.min(4.0, window.imgZoomScale + delta));
    
    // Atualizar transform scale na imagem
    img.style.transform = `scale(${window.imgZoomScale})`;
    
    // Ajustar o tamanho do wrapper para habilitar scroll no container overflow-auto
    if (window.imgZoomScale > 1.0) {
        wrapper.style.width = `${100 * window.imgZoomScale}%`;
        wrapper.style.height = `${100 * window.imgZoomScale}%`;
    } else {
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
    }
    
    if (zoomLevelEl) {
        zoomLevelEl.innerText = `${Math.round(window.imgZoomScale * 100)}%`;
    }
}

export function resetZoomImage() {
    const img = document.getElementById('preview-img-zoom');
    const wrapper = document.getElementById('preview-img-wrapper');
    const zoomLevelEl = document.getElementById('preview-zoom-level');
    if (!img || !wrapper) return;

    window.imgZoomScale = 1.0;
    img.style.transform = 'scale(1.0)';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    
    if (zoomLevelEl) {
        zoomLevelEl.innerText = '100%';
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
    const isMD = file.mimeType === 'text/markdown' || file.name.toLowerCase().endsWith('.md');
    const fileUrl = `/api/google/drive/file/${file.id}`;

    let previewHtml = '';
    if (isImage) {
        previewHtml = `<img src="${fileUrl}" class="w-full rounded-lg shadow-md border border-slate-200">`;
    } else if (isPDF) {
        // Usar o visualizador nativo do browser dentro de um iframe
        previewHtml = `<iframe src="${fileUrl}" class="w-full h-[600px] border border-slate-200 rounded-lg shadow-inner bg-white"></iframe>`;
    } else if (isMD) {
        const containerId = 'wa-preview-' + Date.now();
        previewHtml = `<div id="${containerId}" class="w-full h-[600px] bg-[#efeae2] p-3 overflow-y-auto flex flex-col rounded-lg shadow-inner" style="background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');">
            <div class="animate-pulse text-xs text-center text-gray-500 mt-10 bg-white/80 rounded px-2 py-1 mx-auto">A formatar...</div>
        </div>`;
        
        setTimeout(() => {
            fetch(fileUrl)
                .then(res => res.text())
                .then(text => {
                    const waHtml = parseWhatsAppFormat(text);
                    const el = document.getElementById(containerId);
                    if(el) {
                        el.innerHTML = `
                        <div class="relative w-full h-full flex flex-col">
                            <button id="btn-copy-md-side" class="absolute top-1 right-1 bg-[#00a884] text-white px-2 py-1 rounded shadow-md text-[9px] font-bold uppercase flex items-center gap-1 hover:bg-[#008f6f] transition-all z-10">
                                COPIAR
                            </button>
                            <div class="self-start bg-white text-[#111b21] p-2.5 rounded-xl rounded-tl-none shadow-sm text-[13px] leading-relaxed whitespace-pre-wrap break-words font-sans max-w-[95%] mt-6">${waHtml}</div>
                        </div>`;
                        
                        const copyBtn = document.getElementById('btn-copy-md-side');
                        if (copyBtn) {
                            copyBtn.onclick = async () => {
                                await window.copyToClipboard(text, "Texto Markdown copiado!");
                                copyBtn.innerHTML = "COPIADO!";
                                copyBtn.classList.replace('bg-[#00a884]', 'bg-gray-500');
                                setTimeout(() => {
                                    copyBtn.innerHTML = "COPIAR";
                                    copyBtn.classList.replace('bg-gray-500', 'bg-[#00a884]');
                                }, 2000);
                            };
                        }
                    }
                });
        }, 50);
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

let selectedPaymentsForLink = [];
let searchPaymentTimeout = null;
let currentMiniFilterExpectedAmount = 0;

export function setMiniFilterSearch(value) {
    const searchInput = document.getElementById('mini-filter-search');
    if (searchInput) {
        searchInput.value = value;
        searchPaymentMiniFilter();
    }
}

export function openPaymentMiniFilter(combinedInfo, defaultBank = '', defaultAmount = '', defaultTerm = '', clientName = '', phoneNumber = '', notaDuty = '') {
    const role = pb.authStore.model?.role || 'USER';
    if (role === 'USER' || role === 'USER_L1') {
        toast("Acesso Negado: A vinculação de pagamentos exige nível de permissão Nível 2 ou superior.", "error");
        return;
    }

    // 1. Emitir LOCK para todas as ordens (linhas) deste cliente
    if (window.currentActiveClient && window.currentActiveClient.rows && state.confirm && state.confirm.sheetId) {
        console.log(`[SSE-FASE-1][EMISSÃO-PAGAMENTO] Bloqueando todas as ordens do cliente '${clientName}' para pagamento concorrente.`);
        window.currentActiveClient.rows.forEach(rowObj => {
            const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[rowObj.originalIndex];
            if (!lockInfo || lockInfo.userId === pb.authStore.model?.id) {
                emitConfirmEvent(state.confirm.sheetId, rowObj.originalIndex, 'LOCK', { name: pb.authStore.model?.name || 'Utilizador' });
            }
        });
    }

    document.getElementById('payment-mini-filter').classList.remove('hidden');

    currentMiniFilterExpectedAmount = parseFloat(defaultAmount) || 0;

    // Atualizar info box do cliente
    const infoBox = document.getElementById('mini-filter-header-client-info');
    const nameEl = document.getElementById('mini-filter-client-name');
    const phoneEl = document.getElementById('mini-filter-client-phone');
    const notaEl = document.getElementById('mini-filter-client-nota');

    if (infoBox && nameEl && phoneEl && notaEl) {
        const hasInfo = clientName || phoneNumber || (notaDuty && notaDuty !== '—' && notaDuty.trim() !== '');
        if (hasInfo) {
            nameEl.innerText = clientName || '—';
            
            // Renderizar números de telefone como badges clicáveis
            if (phoneNumber && phoneNumber !== '—' && phoneNumber.trim() !== '') {
                const parts = phoneNumber.split(/[\s|,\/]+/).map(p => p.trim()).filter(p => p.length > 0);
                if (parts.length > 0) {
                    let html = '';
                    parts.forEach(part => {
                        html += `<span onclick="window.copyToClipboard('${part.replace(/'/g, "\\'")}', 'Contacto ${part} copiado!'); ui.setMiniFilterSearch('${part.replace(/'/g, "\\'")}')" class="cursor-pointer text-blue-600 hover:text-blue-800 hover:bg-blue-100 transition-all font-black bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 text-[10px] inline-block mr-1 my-0.5" title="Clique para copiar e filtrar ${part}">${part}</span>`;
                    });
                    phoneEl.innerHTML = html;
                } else {
                    phoneEl.innerText = '—';
                }
            } else {
                phoneEl.innerText = '—';
            }
            
            const notaContainer = document.getElementById('mini-filter-client-nota-container');
            if (notaContainer) {
                if (notaDuty && notaDuty !== '—' && notaDuty.trim() !== '') {
                    notaEl.innerText = notaDuty;
                    notaContainer.classList.remove('hidden');
                } else {
                    notaContainer.classList.add('hidden');
                }
            }
            // Injetar Notas/Comentários agregados das ordens do cliente, se existirem
            const commentsContainer = document.getElementById('mini-filter-client-comments-container');
            const commentsEl = document.getElementById('mini-filter-client-comments');
            if (commentsContainer && commentsEl) {
                console.log("[DEBUG-CONFIRM-NOTES] Abrindo payment-mini-filter para o cliente:", clientName);
                console.log("[DEBUG-CONFIRM-NOTES] window.currentActiveClient:", window.currentActiveClient);
                if (window.currentActiveClient && window.currentActiveClient.rows) {
                    console.log("[DEBUG-CONFIRM-NOTES] Linhas do cliente:", window.currentActiveClient.rows.map(r => ({
                        originalIndex: r.originalIndex,
                        status: r.status,
                        confirmNote: r.confirmNote
                    })));
                }
                const rowsWithNotes = (window.currentActiveClient && window.currentActiveClient.rows)
                    ? window.currentActiveClient.rows.filter(r => r.confirmNote && r.confirmNote.trim() !== '')
                    : [];
                console.log("[DEBUG-CONFIRM-NOTES] Linhas com notas encontradas:", rowsWithNotes.length);

                if (rowsWithNotes.length > 0) {
                    const uniqueNotes = Array.from(new Set(rowsWithNotes.map(r => r.confirmNote.trim())));
                    let html = '';
                    uniqueNotes.forEach(noteText => {
                        html += `
                            <div class="py-2 px-3 hover:bg-amber-100/30 rounded-lg transition-colors border-l-4 border-amber-400 bg-amber-50/20 font-bold text-[11px] leading-relaxed text-slate-700">
                                ${noteText}
                            </div>
                        `;
                    });
                    commentsEl.innerHTML = html;
                    commentsContainer.classList.remove('hidden');
                } else {
                    commentsContainer.classList.add('hidden');
                }
            }

            infoBox.classList.remove('hidden');
        } else {
            infoBox.classList.add('hidden');
        }
    }

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

    selectedPaymentsForLink = [];

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
                const isSelected = selectedPaymentsForLink.some(p => p.id === rec.id);
                const checkedAttr = isSelected ? 'checked' : '';
                const rowClass = isSelected ? 'bg-blue-100 border-blue-200 font-bold' : 'hover:bg-blue-50';

                tr.className = `${rowClass} cursor-pointer transition-colors border-b border-slate-50`;
                tr.dataset.id = rec.id;

                const refText = rec.reference || rec.description || '';
                tr.onclick = () => togglePaymentSelection(rec.id, rec.date, refText, rec.amount);

                // Formatar Data
                const dateStr = rec.date ? rec.date.split(' ')[0] : '—';
                const amountFormatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(rec.amount);

                tr.innerHTML = `
                    <td class="px-3 py-2 text-center" onclick="event.stopPropagation();">
                        <input type="checkbox" ${checkedAttr} onchange="ui.togglePaymentSelection('${rec.id}', '${rec.date}', '${refText.replace(/'/g, "\\'")}', parseFloat('${rec.amount}'))" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
                    </td>
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

export function checkMiniFilterStatus() {
    const allocated = parseFloat(document.getElementById('mini-filter-allocate-amount').value) || 0;
    const statusSelect = document.getElementById('mini-filter-status');
    if (statusSelect) {
        if (allocated > 0 && allocated < (currentMiniFilterExpectedAmount - 1.0)) {
            if (statusSelect.value !== 'PARCIAL') {
                statusSelect.value = 'PARCIAL';
                document.getElementById('mini-filter-comment-container').classList.remove('hidden');
            }
        } else if (allocated > 0 && allocated >= (currentMiniFilterExpectedAmount - 1.0)) {
            if (statusSelect.value === 'PARCIAL' || statusSelect.value === 'PENDENTE') {
                statusSelect.value = 'CONFIRMADO';
                document.getElementById('mini-filter-comment-container').classList.add('hidden');
            }
        }
    }
}

export function togglePaymentSelection(id, date, ref, fullAmount) {
    const idx = selectedPaymentsForLink.findIndex(p => p.id === id);
    if (idx !== -1) {
        selectedPaymentsForLink.splice(idx, 1);
    } else {
        selectedPaymentsForLink.push({
            id: id,
            date: date,
            ref: ref,
            amount: parseFloat(fullAmount)
        });
    }

    // Atualizar a linha correspondente no DOM (se estiver visível)
    const tbody = document.getElementById('mini-filter-results');
    if (tbody) {
        const row = Array.from(tbody.rows).find(r => r.dataset.id === id);
        if (row) {
            const isSelected = selectedPaymentsForLink.some(p => p.id === id);
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = isSelected;
            if (isSelected) {
                row.classList.add('bg-blue-100', 'border-blue-200', 'font-bold');
                row.classList.remove('hover:bg-blue-50');
            } else {
                row.classList.remove('bg-blue-100', 'border-blue-200', 'font-bold');
                row.classList.add('hover:bg-blue-50');
            }
        }
    }

    // Recalcular o total disponível selecionado
    const totalMaxAvailable = selectedPaymentsForLink.reduce((sum, p) => sum + p.amount, 0);

    // Preencher campo de alocação com o valor sugerido
    const suggested = Math.min(currentMiniFilterExpectedAmount, totalMaxAvailable);
    document.getElementById('mini-filter-allocate-amount').value = suggested > 0 ? suggested.toFixed(2) : '';
    document.getElementById('mini-filter-max-available').innerText = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(totalMaxAvailable);

    // Atualizar visualização do status para refletir a nova alocação
    checkMiniFilterStatus();
}

// Manter retrocompatibilidade se alguma outra parte chamar
export function selectPaymentResult(id, date, ref, trElement, fullAmount) {
    togglePaymentSelection(id, date, ref, fullAmount);
}

export async function confirmPaymentSelection() {
    const status = document.getElementById('mini-filter-status').value;
    const combinedInfo = document.getElementById('mini-filter-combined-info').value;
    const allocatedAmount = parseFloat(document.getElementById('mini-filter-allocate-amount').value) || 0;

    const totalMaxAvailable = selectedPaymentsForLink.reduce((sum, p) => sum + p.amount, 0);

    if (status === 'CONFIRMADO') {
        if (selectedPaymentsForLink.length === 0) {
            ui.toast('Para marcar como CONFIRMADO, selecione primeiro um ou mais pagamentos na lista.', "warning");
            return;
        }

        if (allocatedAmount <= 0) {
            ui.toast("Por favor, insira um valor válido para alocar.", "warning");
            return;
        }

        if (allocatedAmount > totalMaxAvailable + 0.01) {
            ui.toast("O valor a alocar não pode ser superior ao valor disponível nos pagamentos selecionados.", "warning");
            return;
        }
    }

    const btn = document.querySelector('#payment-mini-filter button.bg-blue-600');

    try {
        setBtnLoading(btn, true, 'Vincular...');
        setLoader(true, 'A gravar reconciliação...');

        // 1. Distribuir o valor alocado e atualizar PocketBase
        const usedPayments = [];
        if (selectedPaymentsForLink.length > 0 && allocatedAmount > 0) {
            let allocatedAmountRemaining = allocatedAmount;
            for (const pay of selectedPaymentsForLink) {
                if (allocatedAmountRemaining <= 0) break;
                const toAllocate = Math.min(allocatedAmountRemaining, pay.amount);
                if (toAllocate > 0) {
                    usedPayments.push({
                        id: pay.id,
                        date: pay.date,
                        ref: pay.ref,
                        amount: toAllocate
                    });
                    allocatedAmountRemaining -= toAllocate;
                }
            }
        }

        for (const up of usedPayments) {
            await markPaymentReconciled(up.id, combinedInfo, up.amount);
        }

        // 2. Google Sheet - Distribuir saldos e escrever as datas das respectivas transações utilizadas
        if (window.currentClientRows && window.currentClientRows.length > 0) {
            const columns = state.confirm.columns || [];
            
            const cleanString = (str) => String(str || '')
                .toUpperCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z0-9]/g, "")
                .trim();

            const isFreight = window.paymentReconciliationContext === 'FREIGHT';

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

            let statusIdx = -1, pag1Idx = -1, pag2Idx = -1, pag3Idx = -1, obsIdx = -1, paidIdx = -1, balanceIdx = -1, amountIdx = -1;
            let bankFreightIdx = -1, notaFreightIdx = -1, notaDutyIdx = -1;

            if (isFreight) {
                paidIdx = findCol(['PAID FREIGHT']);
                balanceIdx = findCol(['BALANCE FREIGHT']);
                amountIdx = findCol(['AMOUNT FREIGHT']);
                bankFreightIdx = findCol(['BANK IN FREIGHT']);
                notaFreightIdx = findCol(['NOTA FREIGHT']);
                pag1Idx = findCol(['PAG FRETE 1']);
                pag2Idx = findCol(['PAG FRETE 2']);
                pag3Idx = findCol(['PAG FRETE 3']);
            } else {
                statusIdx = findCol(['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);
                notaDutyIdx = findCol(['NOTA DUTY', 'NOTA', 'OBSERVACAO', 'OBSERVACOES', 'OBS', 'NOTA_DUTY']);
                pag1Idx = findCol(['PAG 1', 'PAG1']);
                pag2Idx = findCol(['PAG 2', 'PAG2']);
                pag3Idx = findCol(['PAG 3', 'PAG3']);
                obsIdx = findCol(['OBS', 'COMENTARIO', 'NOTAS', 'OBSERVACAO', 'OBSERVACOES']);
                paidIdx = columns.findIndex((c, i) => {
                    const h = cleanString(c);
                    return (h.includes('PAID') || h.includes('PAGO')) && !h.includes('PREPAID') && !h.includes('DUTY');
                });
                balanceIdx = findCol(['BALANCE', 'SALDO', 'BALANCO']);
                amountIdx = findCol(['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
            }

            if (state.confirm.sheetId) {
                let sheetName = '';
                if (state.confirm.range && state.confirm.range.includes('!')) {
                    sheetName = state.confirm.range.split('!')[0];
                }
                const prefix = sheetName ? `${sheetName}!` : '';

                // Encontrar o originalIndex da primeira linha (ordem) do cliente ativo
                const sortedClientRows = [...window.currentClientRows].sort((a, b) => a.originalIndex - b.originalIndex);
                const firstRowIndex = sortedClientRows[0]?.originalIndex;

                let allocatedAmountRemaining = allocatedAmount;
                const filterStatus = document.getElementById('mini-filter-status')?.value || 'CONFIRMADO';

                // Formatar as datas de todos os pagamentos selecionados para vínculo
                const formattedDates = selectedPaymentsForLink.map(p => {
                    if (!p.date) return '';
                    const d = new Date(p.date);
                    if (isNaN(d.getTime())) return p.date;
                    const dd = String(d.getDate()).padStart(2, '0');
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    // Usar YYYY-MM-DD para compatibilidade universal
                    return `${yyyy}-${mm}-${dd}`;
                });

                console.log("[DEBUG-VINCULO] formattedDates dos pagamentos selecionados:", formattedDates);

                const batchUpdates = [];
                const localStateUpdates = [];
                
                let firstRowPassed = false;

                // Fazer o update para cada linha deste cliente
                for (const rowObj of window.currentClientRows) {
                    const sheetRowNumber = rowObj.originalIndex + 1;
                    const originalIndex = rowObj.originalIndex;
                    const rowData = [...state.confirm.data[originalIndex]];

                    let newStatus = filterStatus;

                    if (newStatus === 'PENDENTE' && !isFreight) {
                        // Reverter pagamentos (apenas para duty)
                        if (paidIdx !== -1) rowData[paidIdx] = '';
                        if (balanceIdx !== -1) rowData[balanceIdx] = rowObj.amountDuty;
                    } else {
                        // Distribuir o valor do pagamento
                        const currentBalance = isFreight ? rowObj.balFreight : rowObj.balance;
                        const currentPaid = isFreight ? rowObj.pdFreight : rowObj.paid;
                        
                        let allocatedForThisRow = 0;
                        if (currentBalance > 0 && allocatedAmountRemaining > 0) {
                            allocatedForThisRow = Math.min(allocatedAmountRemaining, currentBalance);
                            allocatedAmountRemaining -= allocatedForThisRow;
                        }

                        const newPaid = currentPaid + allocatedForThisRow;
                        const newBalance = Math.max(0, currentBalance - allocatedForThisRow);

                        if (paidIdx !== -1) rowData[paidIdx] = newPaid;
                        if (balanceIdx !== -1) rowData[balanceIdx] = newBalance;

                        if (newStatus === 'CONFIRMADO' && !isFreight) {
                            if (newBalance > 1.0) newStatus = 'PARCIAL';
                        }

                        // Mapear as datas dos pagamentos selecionados diretamente nas colunas correspondentes (PAG 1, PAG 2, PAG 3)
                        const pagIndices = [pag1Idx, pag2Idx, pag3Idx].filter(i => i !== -1);
                        for (let i = 0; i < pagIndices.length; i++) {
                            const pIdx = pagIndices[i];
                            const dateVal = formattedDates[i];
                            if (dateVal !== undefined) {
                                console.log(`[DEBUG-VINCULO] Linha ${sheetRowNumber} - Coluna PAG ${i + 1} (index ${pIdx}) recebe data: "${dateVal}"`);
                                rowData[pIdx] = dateVal;
                            }
                        }
                    }

                    if (statusIdx !== -1 && !isFreight) {
                        rowData[statusIdx] = newStatus;
                    }

                    if (newStatus !== 'CONFIRMADO' && !isFreight && notaDutyIdx !== -1) {
                        // Se o status for diferente de Confirmado, limpar a Nota Duty (resposta do operador)
                        rowData[notaDutyIdx] = '';
                    }

                    if (newStatus === 'PENDENTE' && !isFreight) {
                        // Se for PENDENTE, limpar as datas de pagamento
                        const pagIndices = [pag1Idx, pag2Idx, pag3Idx].filter(i => i !== -1);
                        for (const pIdx of pagIndices) {
                            rowData[pIdx] = '';
                        }
                    }

                    // Gravar Nota e Banco na Primeira Linha (apenas para Frete)
                    if (isFreight && !firstRowPassed) {
                        const noteSelect = document.getElementById('select-freight-note')?.value || '';
                        const noteCustom = document.getElementById('input-freight-note-custom')?.value || '';
                        const bankVal = document.getElementById('select-freight-bank')?.value || '';
                        let finalNote = noteSelect === 'CUSTOM' ? noteCustom.trim() : noteSelect;
                        
                        if (bankFreightIdx !== -1 && bankVal) rowData[bankFreightIdx] = bankVal;
                        if (notaFreightIdx !== -1 && finalNote) rowData[notaFreightIdx] = finalNote;
                    }

                    // Acumular apenas as células modificadas para o Google Sheets
                    const cleanSheetName = sheetName.replace(/'/g, '');
                    const prefixClean = cleanSheetName ? `${cleanSheetName}!` : '';

                    if (paidIdx !== -1) {
                        batchUpdates.push({ range: `${prefixClean}${getColLetter(paidIdx)}${sheetRowNumber}`, values: [[rowData[paidIdx]]] });
                    }
                    // if (balanceIdx !== -1 && !isFreight) {
                    //     batchUpdates.push({ range: `${prefixClean}${getColLetter(balanceIdx)}${sheetRowNumber}`, values: [[rowData[balanceIdx]]] });
                    // }
                    if (statusIdx !== -1 && !isFreight) {
                        batchUpdates.push({ range: `${prefixClean}${getColLetter(statusIdx)}${sheetRowNumber}`, values: [[rowData[statusIdx]]] });
                    }
                    if (newStatus !== 'CONFIRMADO' && !isFreight && notaDutyIdx !== -1) {
                        batchUpdates.push({ range: `${prefixClean}${getColLetter(notaDutyIdx)}${sheetRowNumber}`, values: [['']] });
                    }
                    if (isFreight && !firstRowPassed) {
                        if (bankFreightIdx !== -1) {
                            batchUpdates.push({ range: `${prefixClean}${getColLetter(bankFreightIdx)}${sheetRowNumber}`, values: [[rowData[bankFreightIdx]]] });
                        }
                        if (notaFreightIdx !== -1) {
                            batchUpdates.push({ range: `${prefixClean}${getColLetter(notaFreightIdx)}${sheetRowNumber}`, values: [[rowData[notaFreightIdx]]] });
                        }
                    }
                    
                    firstRowPassed = true;

                    // PAG 1, PAG 2, PAG 3
                    const pagIndices = [pag1Idx, pag2Idx, pag3Idx].filter(i => i !== -1);
                    for (let i = 0; i < pagIndices.length; i++) {
                        const pIdx = pagIndices[i];
                        const dateVal = formattedDates[i];
                        if (newStatus === 'PENDENTE' && !isFreight) {
                            batchUpdates.push({
                                range: `${prefixClean}${getColLetter(pIdx)}${sheetRowNumber}`,
                                values: [['']]
                            });
                        } else if (dateVal !== undefined) {
                            batchUpdates.push({
                                range: `${prefixClean}${getColLetter(pIdx)}${sheetRowNumber}`,
                                values: [[dateVal]]
                            });
                        }
                    }

                    localStateUpdates.push({
                        originalIndex,
                        rowData,
                        newStatus
                    });
                }

                // 1. Enviar todas as atualizações de valores no GSheet em uma única chamada de lote
                if (batchUpdates.length > 0) {
                    await updateGSheetBatch(state.confirm.sheetId, batchUpdates);
                }

                // 2. Atualizar estado local
                for (const item of localStateUpdates) {
                    state.confirm.data[item.originalIndex] = item.rowData;
                }

                // 3. Gerir as NOTAS e as CORES de forma otimizada
                if (statusIdx !== -1) {
                    const comment = document.getElementById('mini-filter-comment')?.value || '';
                    const cleanSheetName = sheetName.replace(/'/g, '');

                    for (const item of localStateUpdates) {
                        const originalIndex = item.originalIndex;
                        try {
                            if (originalIndex === firstRowIndex) {
                                const existingNote = state.confirm.notes?.[originalIndex]?.[statusIdx] || '';
                                const hasNewComment = comment.trim() !== '';
                                const needsNoteUpdate = hasNewComment || existingNote.trim() !== '';

                                if (needsNoteUpdate) {
                                    const cellColor = hasNewComment ? 'yellow' : 'clear';
                                    await updateGSheetNote(state.confirm.sheetId, cleanSheetName, originalIndex, statusIdx, comment.trim(), cellColor);
                                    
                                    // Atualizar estado local
                                    if (!state.confirm.notes) state.confirm.notes = [];
                                    if (!state.confirm.notes[originalIndex]) state.confirm.notes[originalIndex] = [];
                                    state.confirm.notes[originalIndex][statusIdx] = comment.trim();
                                }
                            } else {
                                const existingNote = state.confirm.notes?.[originalIndex]?.[statusIdx] || '';
                                if (existingNote.trim() !== '') {
                                    await updateGSheetNote(state.confirm.sheetId, cleanSheetName, originalIndex, statusIdx, '', 'clear');
                                    
                                    // Atualizar estado local
                                    if (state.confirm.notes && state.confirm.notes[originalIndex]) {
                                        state.confirm.notes[originalIndex][statusIdx] = '';
                                    }
                                }
                            }
                        } catch (noteErr) {
                            console.error("Erro ao gravar nota/cor:", noteErr);
                            ui.toast("Aviso: O status foi gravado, mas falhou ao atualizar a cor/nota na célula.", "warning");
                        }
                    }
                }

                // 4. Emitir eventos UPDATE para o real-time
                for (const item of localStateUpdates) {
                    if (state.confirm && state.confirm.sheetId) {
                        emitConfirmEvent(state.confirm.sheetId, item.originalIndex, 'UPDATE', { 
                            status: item.newStatus,
                            rowData: item.rowData
                        });
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
        
        // Atualizar suavemente os detalhes do cliente se o operador estiver nele
        const detailView = document.getElementById('view-confirm-client-detail');
        if (detailView && !detailView.classList.contains('hidden')) {
            if (window.currentActiveClient && window.currentActiveClient.rows) {
                window.currentClientRows.forEach(rowObj => {
                    const updatedRowData = state.confirm.data[rowObj.originalIndex];
                    updateConfirmDetailRow(rowObj.originalIndex, updatedRowData);
                });
                // Re-renderizar o detalhe inteiro para exibir o card "Detalhes de Reconciliação" atualizado
                await showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
            }
        } else {
            showView('view-confirm-table');
        }

    } catch (e) {
        console.error('Erro ao vincular pagamento:', e);
        let detail = '';
        if (e.data && typeof e.data === 'object') {
            detail = '\nDetalhes: ' + JSON.stringify(e.data, null, 2);
        }
        alert('Erro ao vincular pagamento: ' + e.message + detail);
    } finally {
        setLoader(false);
        setBtnLoading(btn, false);
    }
}

export function closePaymentMiniFilter() {
    // 1. Emitir UNLOCK para todas as ordens (linhas) deste cliente
    if (window.currentActiveClient && window.currentActiveClient.rows && state.confirm && state.confirm.sheetId) {
        console.log("[SSE-FASE-1][EMISSÃO-PAGAMENTO] Desbloqueando todas as ordens do cliente para fecho do popup de pagamento.");
        window.currentActiveClient.rows.forEach(rowObj => {
            const lockInfo = window.activeConfirmLocks && window.activeConfirmLocks[rowObj.originalIndex];
            if (lockInfo && lockInfo.userId === pb.authStore.model?.id) {
                emitConfirmEvent(state.confirm.sheetId, rowObj.originalIndex, 'UNLOCK');
            }
        });
    }

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
    
    // Limpar o contexto de vínculo para evitar conflitos com Duty
    window.paymentReconciliationContext = null;
}

// --- MÓDULO DEFINIÇÕES (USERS) ---

export async function loadSettingsUsers() {
    const tbody = document.getElementById('settings-users-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500 font-bold">A carregar utilizadores...</td></tr>';
    
    try {
        const users = await getSettingsUsers();
        tbody.innerHTML = '';
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-400 font-bold">Nenhum utilizador encontrado.</td></tr>';
            return;
        }
        
        users.forEach(user => {
            const role = user.role || 'USER_L1';
            let roleBadge = '';
            if (role === 'ADMIN') {
                roleBadge = '<span class="px-2 py-1 bg-black text-white rounded-md text-[10px] font-black tracking-widest">ADMIN</span>';
            } else if (role === 'USER_L2') {
                roleBadge = '<span class="px-2 py-1 bg-indigo-600 text-white rounded-md text-[10px] font-black tracking-widest font-sans uppercase">NÍVEL 2</span>';
            } else {
                roleBadge = '<span class="px-2 py-1 bg-slate-200 text-slate-600 rounded-md text-[10px] font-black tracking-widest font-sans uppercase">NÍVEL 1</span>';
            }
                
            const perms = user.permissions || [];
            const permsHtml = perms.length > 0 
                ? perms.map(p => `<span class="px-2 py-1 border border-gray-200 rounded text-[10px] font-bold text-gray-600">${p}</span>`).join(' ')
                : '<span class="text-xs text-gray-400 italic">Nenhum</span>';
                
            const tr = document.createElement('tr');
            tr.className = 'border-b-2 border-gray-100 hover:bg-gray-50 transition-colors';
            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-gray-900">${user.name || '---'}</td>
                <td class="px-6 py-4 text-gray-600">${user.email || '<span class="text-gray-400 italic">Oculto</span>'}</td>
                <td class="px-6 py-4">${roleBadge}</td>
                <td class="px-6 py-4 flex flex-wrap gap-1">${permsHtml}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="window.editUser('${user.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    ${user.id !== pb.authStore.model?.id ? `
                    <button onclick="window.deleteUser('${user.id}', '${(user.name || user.email).replace(/'/g, "\\'")}')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Apagar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Armazenar localmente para edição rápida
        window.__SETTINGS_USERS__ = users;
        
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500 font-bold">Erro: ${err.message}</td></tr>`;
    }
}

export function openUserModal(userId = null) {
    const modal = document.getElementById('modal-user');
    const title = document.getElementById('modal-user-title');
    const idInput = document.getElementById('user-id');
    const nameInput = document.getElementById('user-name');
    const emailInput = document.getElementById('user-email');
    const passInput = document.getElementById('user-password');
    const passHint = document.getElementById('user-password-hint');
    const roleSelect = document.getElementById('user-role');
    const checkboxes = document.querySelectorAll('#user-permissions input[type="checkbox"]');
    
    // Reset formulário
    document.getElementById('form-user').reset();
    checkboxes.forEach(cb => cb.checked = false);
    
    if (userId) {
        // Edit Mode
        title.innerText = "Editar Utilizador";
        passInput.required = false;
        passHint.classList.remove('hidden');
        idInput.value = userId;
        emailInput.disabled = true;
        emailInput.classList.add('bg-gray-100', 'cursor-not-allowed');
        
        const user = (window.__SETTINGS_USERS__ || []).find(u => u.id === userId);
        if (user) {
            nameInput.value = user.name || '';
            emailInput.value = user.email || '';
            let rVal = user.role || 'USER_L1';
            if (rVal === 'USER') rVal = 'USER_L1';
            roleSelect.value = rVal;
            
            const perms = user.permissions || [];
            checkboxes.forEach(cb => {
                if (perms.includes(cb.value)) cb.checked = true;
            });
        }
    } else {
        // Create Mode
        title.innerText = "Novo Utilizador";
        passInput.required = true;
        passHint.classList.add('hidden');
        idInput.value = "";
        emailInput.disabled = false;
        emailInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
    }
    
    modal.classList.remove('hidden');
    // Animação de fade-in
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
    }, 10);
}

export function closeUserModal() {
    const modal = document.getElementById('modal-user');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// --- MÓDULO DE CÂMBIO (CAMBIO) RENDERING ---

export function renderCambioSelect() {
    const select = document.getElementById('input-quote-currency');
    const inputEx = document.getElementById('input-quote-exchange');
    const wrapper = document.getElementById('wrapper-quote-currency');
    if (!select || !inputEx) return;

    // Se existirem dados, populamos o dropdown
    if (state.cambios && state.cambios.length > 0) {
        select.innerHTML = '';
        state.cambios.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.moeda;
            opt.text = c.moeda;
            opt.dataset.taxa = c.taxa;
            if (c.today) {
                // Formata a data se existir
                const d = new Date(c.today);
                opt.dataset.date = d.toLocaleDateString('pt-PT');
            } else {
                opt.dataset.date = '';
            }
            select.appendChild(opt);
        });

        // Tentar manter o USD selecionado se existir, senão usa o primeiro
        const usdOpt = Array.from(select.options).find(o => o.value === 'USD');
        const defaultOpt = usdOpt || select.options[0];
        
        select.value = defaultOpt.value;
        inputEx.value = parseFloat(defaultOpt.dataset.taxa).toFixed(2);
        if (wrapper && defaultOpt.dataset.date) {
            wrapper.title = `Atualizado a: ${defaultOpt.dataset.date}`;
        }
    }
}

window.handleCurrencyChange = function() {
    const select = document.getElementById('input-quote-currency');
    const inputEx = document.getElementById('input-quote-exchange');
    const wrapper = document.getElementById('wrapper-quote-currency');
    if (!select || !inputEx) return;

    const opt = select.options[select.selectedIndex];
    if (opt && opt.dataset.taxa) {
        inputEx.value = parseFloat(opt.dataset.taxa).toFixed(2);
        if (wrapper) {
            wrapper.title = opt.dataset.date ? `Atualizado a: ${opt.dataset.date}` : 'Câmbio';
        }
    }
    
    // Atualizar a fatura com a nova taxa
    if (typeof window.calculateFullInvoice === 'function') {
        window.calculateFullInvoice();
    }
};

// --- MÓDULO DE COTAÇÕES (QUOTE) RENDERING ---

export function renderQuoteDashboard() {
    const list = document.getElementById('quote-history-list');
    if (!list) return;

    list.innerHTML = '';
    
    // Filtro básico de pesquisa
    const searchQuery = (document.getElementById('input-quote-history-search')?.value || '').toUpperCase().trim();
    
    const filtered = (state.quotes || []).filter(q => {
        return !searchQuery || 
            q.client_name.toUpperCase().includes(searchQuery) || 
            q.quote_number.toUpperCase().includes(searchQuery);
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div class="text-center py-10">
            <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhuma cotação encontrada.</p>
        </div>`;
        return;
    }

    filtered.forEach(q => {
        const payload = q.payload || {};
        const code = payload.itemCode || '---';
        const fob = parseFloat(payload.fob) || 0;
        const total = parseFloat(payload.results?.totalImport) || 0;
        
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-2xl border-2 border-gray-100 hover:border-indigo-500 cursor-pointer transition-all relative group shadow-sm";
        card.onclick = () => window.loadSavedQuote(q.id);

        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="text-[9px] font-black text-gray-400 uppercase tracking-wider">${q.quote_number || 'S/N'}</span>
                <button onclick="event.stopPropagation(); window.handleDeleteQuote('${q.id}')" class="text-gray-300 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
            <h4 class="text-sm font-black text-gray-900 group-hover:text-indigo-600 truncate mb-1" title="${q.client_name}">${q.client_name}</h4>
            <div class="flex items-center gap-2 mb-3">
                <span class="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">HS: ${code}</span>
            </div>
            <div class="flex justify-between items-end border-t border-gray-100 pt-2">
                <span class="text-[9px] font-black text-gray-500 uppercase">Total Estimado</span>
                <span class="text-xs font-black text-gray-900">${formatMZN(total)}</span>
            </div>
        `;
        list.appendChild(card);
    });
}

// ------------------------------------------
// SIMULADOR PAUTAL (Lado Direito)
// ------------------------------------------

window.currentPautaItem = null;

// Debounce para a pesquisa
let pautaSearchTimeout = null;

// Delegação de eventos para inputs carregados dinamicamente
document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'input-pauta-search') {
        clearTimeout(pautaSearchTimeout);
        pautaSearchTimeout = setTimeout(() => {
            const val = e.target.value.trim();
            if (val.length < 2) {
                const res = document.getElementById('pauta-search-results');
                if (res) res.classList.add('hidden');
                return;
            }
            if (api) {
                api.searchPauta(val, 20).then(results => {
                    renderPautaSearchResults(results);
                }).catch(err => console.error(err));
            }
        }, 300);
    }
    
    if (e.target && e.target.id === 'input-quote-history-search') {
        renderQuoteDashboard();
    }
});

// Fechar dropdown ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('#input-pauta-search') && !e.target.closest('#pauta-search-results')) {
        const res = document.getElementById('pauta-search-results');
        if (res) res.classList.add('hidden');
    }
});

function renderPautaSearchResults(results) {
    const container = document.getElementById('pauta-search-results');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-sm font-bold text-gray-400">Nenhum resultado encontrado.</div>';
        container.classList.remove('hidden');
        return;
    }

    container.innerHTML = '';
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = "p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors";
        div.onclick = () => {
            window.selectPautaItem(item);
            container.classList.add('hidden');
            if (pautaSearchInput) pautaSearchInput.value = '';
        };
        div.innerHTML = `
            <div class="font-black text-indigo-700 text-sm mb-0.5">${item.code}</div>
            <div class="text-xs text-gray-600 line-clamp-2">${item.description}</div>
        `;
        container.appendChild(div);
    });
    
    container.classList.remove('hidden');
}

window.selectPautaItem = function(item) {
    window.currentPautaItem = item;
    
    document.getElementById('pauta-workspace-empty').classList.add('hidden');
    document.getElementById('pauta-workspace-content').classList.remove('hidden');
    
    document.getElementById('lbl-item-code').innerText = item.code || '---';
    document.getElementById('lbl-item-desc').innerText = item.description || 'Sem descrição';
    
    // Renderizar tabela de taxas base
    const tbody = document.getElementById('table-base-duties');
    tbody.innerHTML = '';
    
    if (item.duties && item.duties.length > 0) {
        item.duties.forEach(d => {
            const name = d['Nome da Taxa'] || d['Taxa Description'] || 'N/A';
            const val = d['Taxa'] || d['Value'] || 'N/A';
            tbody.innerHTML += `
                <tr>
                    <td class="px-4 py-2 text-xs font-bold text-gray-700">${name}</td>
                    <td class="px-4 py-2 text-center">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">${val}</span>
                    </td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="2" class="px-4 py-4 text-center text-xs font-bold text-gray-400 italic">Nenhuma taxa definida.</td></tr>`;
    }
    
    // Reset inputs
    document.getElementById('input-sim-fob').value = '';
    document.getElementById('input-sim-freight').value = '';
    document.getElementById('input-sim-insurance').value = '';
    document.getElementById('input-sim-other').value = '';
    
    document.getElementById('btn-save-quote').disabled = false;
    
    window.calculateSimulation();
};

// --- QUOTE EDITOR LOGIC (Multi-Item Invoice) ---

window.quoteEditorState = {
    id: null,
    currency: 'USD',
    exchangeRate: 64.00,
    items: [],
    totals: {
        fobForeign: 0,
        freightForeign: 0,
        insForeign: 0,
        cifMzn: 0,
        daMzn: 0,
        iceMzn: 0,
        ivaMzn: 0,
        tsaMzn: 0,
        grandTotalMzn: 0
    }
};

window.openQuoteEditor = function() {
    document.getElementById('quote-history-workspace').classList.add('hidden');
    document.getElementById('quote-editor-workspace').classList.remove('hidden');
    document.getElementById('quote-editor-workspace').classList.add('flex');
    window.renderQuoteItemsTable();
    window.calculateFullInvoice();
};

window.closeQuoteEditor = function() {
    document.getElementById('quote-editor-workspace').classList.add('hidden');
    document.getElementById('quote-editor-workspace').classList.remove('flex');
    document.getElementById('quote-history-workspace').classList.remove('hidden');
};

window.toggleQuoteSidebar = function() {
    const sidebar = document.getElementById('quote-editor-sidebar');
    const icon = document.getElementById('quote-sidebar-icon');
    if (!sidebar) return;
    
    // Toggle the translate-x-full class to slide in/out
    sidebar.classList.toggle('translate-x-full');
    
    // Update the arrow icon based on state
    if (sidebar.classList.contains('translate-x-full')) {
        // Closed state -> left arrow
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />';
    } else {
        // Open state -> right arrow
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />';
    }
};

window.startNewQuote = function() {
    window.quoteEditorState = {
        id: null,
        currency: 'USD',
        exchangeRate: 64.00,
        items: [],
        totals: { fobForeign: 0, freightForeign: 0, insForeign: 0, cifMzn: 0, daMzn: 0, iceMzn: 0, ivaMzn: 0, tsaMzn: 0, grandTotalMzn: 0 }
    };
    
    document.getElementById('input-quote-currency').value = 'USD';
    document.getElementById('input-quote-exchange').value = '64.00';
    document.getElementById('input-global-freight').value = '';
    document.getElementById('input-global-insurance').value = '';
    document.getElementById('input-global-others').value = '';
    document.getElementById('lbl-quote-editor-title').innerText = "Nova Fatura / Cotação";
    
    window.calculateFullInvoice();
    window.openQuoteEditor();
};

window.addQuoteRow = function() {
    window.quoteEditorState.items.push({
        id: Date.now() + Math.random(),
        description: '',
        hsCode: '',
        qty: '',
        unitPrice: '',
        fob: 0,
        freight: null,
        insurance: null,
        others: null,
        cifMzn: 0,
        daValue: 0,
        iceValue: 0,
        ivaValue: 0,
        tsaValue: 0,
        pauta: null
    });
    window.calculateFullInvoice();
    window.renderQuoteItemsTable();
};

window.removeQuoteRow = function(id) {
    window.quoteEditorState.items = window.quoteEditorState.items.filter(item => item.id !== id);
    window.calculateFullInvoice();
    window.renderQuoteItemsTable();
};

window.updateQuoteRow = function(id, field, value) {
    const item = window.quoteEditorState.items.find(i => i.id === id);
    if (!item) return;
    
    if (field === 'freight' || field === 'insurance' || field === 'others') {
        item[field] = value === '' ? null : parseFloat(value);
    } else if (field === 'qty' || field === 'unitPrice') {
        item[field] = parseFloat(value) || 0;
    } else {
        item[field] = value;
    }
    
    if (field === 'hsCode') {
        if (value.length === 8) {
            if (api) {
                api.searchPauta(value, 1).then(results => {
                    if (results && results.length > 0) {
                        item.pauta = results[0];
                    } else {
                        item.pauta = null;
                    }
                    window.calculateFullInvoice();
                    window.updateRowDOM(item);
                }).catch(() => {
                    item.pauta = null;
                    window.calculateFullInvoice();
                    window.updateRowDOM(item);
                });
            }
            return; // We exit because calculation happens async

        } else {
            item.pauta = null;
        }
    }
    
    window.calculateFullInvoice();
    window.updateRowDOM(item);
};

window.updateRowDOM = function(item) {
    const tr = document.getElementById(`row-${item.id}`);
    if (!tr) return;
    
    const daRate = item.pauta ? getRateFromPauta(item.pauta, ['Direitos', 'Aduaneiros']) : 0;
    const iceRate = item.pauta ? getRateFromPauta(item.pauta, ['ICE', 'Consumo Espec']) : 0;
    const ivaRate = item.pauta ? getRateFromPauta(item.pauta, ['IVA', 'Valor Acrescentado']) : 0;
    
    tr.querySelector('.cell-fob').innerText = formatCurrencyVal(item.fob);
    tr.querySelector('.cell-cif').innerText = formatCurrencyVal(item.cifMzn);
    tr.querySelector('.cell-da').innerHTML = `${formatCurrencyVal(item.daValue)} <span class="text-[9px] text-gray-400">(${(daRate*100).toFixed(0)}%)</span>`;
    if (tr.querySelector('.cell-ice')) {
        tr.querySelector('.cell-ice').innerHTML = `${formatCurrencyVal(item.iceValue || 0)} <span class="text-[9px] text-gray-400">(${(iceRate*100).toFixed(0)}%)</span>`;
    }
    tr.querySelector('.cell-iva').innerHTML = `${formatCurrencyVal(item.ivaValue)} <span class="text-[9px] text-gray-400">(${(ivaRate*100).toFixed(0)}%)</span>`;

    const inFrt = tr.querySelector('.input-readonly-freight');
    if (inFrt) inFrt.value = formatCurrencyVal(item.actualFreight || 0);
    const inIns = tr.querySelector('.input-readonly-insurance');
    if (inIns) inIns.value = formatCurrencyVal(item.actualInsurance || 0);
    const inOth = tr.querySelector('.input-readonly-others');
    if (inOth) inOth.value = formatCurrencyVal(item.actualOthers || 0);

    const hsInput = tr.querySelector('.input-hscode');
    if (hsInput) {
        hsInput.classList.remove('text-indigo-700', 'text-emerald-600', 'text-red-500');
        if (item.hsCode && item.hsCode.length === 8) {
            hsInput.classList.add(item.pauta ? 'text-emerald-600' : 'text-red-500');
        } else {
            hsInput.classList.add('text-indigo-700');
        }
    }
};

function formatCurrencyVal(val) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function getRateFromPauta(pautaItem, nameFragments) {
    if (!pautaItem || !pautaItem.duties) return 0;
    const duty = pautaItem.duties.find(d => {
        const dutyName = (d['Nome da Taxa'] || d['Taxa Description'] || '').toLowerCase();
        return nameFragments.some(frag => dutyName.includes(frag.toLowerCase()));
    });
    if (!duty) return 0;
    const rateStr = duty['Taxa'] || duty['Value'] || '0';
    if (rateStr.includes('%')) {
        return parseFloat(rateStr.replace('%', '')) / 100;
    }
    return 0;
}

window.calculateFullInvoice = function() {
    const curr = document.getElementById('input-quote-currency').value.toUpperCase() || 'USD';
    const excRate = parseFloat(document.getElementById('input-quote-exchange').value) || 64.00;
    
    window.quoteEditorState.currency = curr;
    window.quoteEditorState.exchangeRate = excRate;
    
    let tFob = 0, tFrt = 0, tIns = 0, tOth = 0;
    let tCifMzn = 0, tDaMzn = 0, tIceMzn = 0, tIvaMzn = 0, tTsaMzn = 0;
    
    document.querySelectorAll('.lbl-currency').forEach(el => el.innerText = curr);
    const printCaption = document.getElementById('print-currency-note');
    if (printCaption) printCaption.innerText = `${curr} | ${excRate.toFixed(2)}`;
    
    const globalFreightInput = document.getElementById('input-global-freight').value;
    const globalInsuranceInput = document.getElementById('input-global-insurance').value;
    const globalOthersInput = document.getElementById('input-global-others').value;
    
    const globalFrt = globalFreightInput === '' ? null : parseFloat(globalFreightInput);
    const globalIns = globalInsuranceInput === '' ? null : parseFloat(globalInsuranceInput);
    const globalOth = globalOthersInput === '' ? null : parseFloat(globalOthersInput);
    
    let grandTotalFob = 0;
    window.quoteEditorState.items.forEach(item => {
        item.fob = (item.qty || 0) * (item.unitPrice || 0);
        grandTotalFob += item.fob;
    });
    
    window.quoteEditorState.items.forEach(item => {
        const ratio = grandTotalFob > 0 ? (item.fob / grandTotalFob) : 0;
        
        let frt = globalFrt !== null ? (globalFrt * ratio) : (item.fob * 0.10);
        let ins = globalIns !== null ? (globalIns * ratio) : ((item.fob + frt) * 0.02);
        let oth = globalOth !== null ? (globalOth * ratio) : 0;
        
        item.actualFreight = frt;
        item.actualInsurance = ins;
        item.actualOthers = oth;
        
        const cifForeign = item.fob + frt + ins + oth;
        const cifMzn = cifForeign * excRate;
        item.cifMzn = cifMzn;
        
        const daRate = item.pauta ? getRateFromPauta(item.pauta, ['Direitos', 'Aduaneiros']) : 0;
        const iceRate = item.pauta ? getRateFromPauta(item.pauta, ['Consumo', 'Específico', 'ICE']) : 0;
        const tsaRate = item.pauta ? getRateFromPauta(item.pauta, ['Sobretaxa']) : 0;
        const ivaRate = item.pauta ? getRateFromPauta(item.pauta, ['IVA', 'Valor Acrescentado']) : 0;
        
        item.daValue = cifMzn * daRate;
        item.iceValue = cifMzn * iceRate;
        item.tsaValue = cifMzn * tsaRate;
        
        const ivaBase = cifMzn + item.daValue + item.iceValue;
        item.ivaValue = ivaBase * ivaRate;
        
        tFob += item.fob;
        tFrt += frt;
        tIns += ins;
        tOth += oth;
        
        tCifMzn += cifMzn;
        tDaMzn += item.daValue;
        tIceMzn += item.iceValue;
        tTsaMzn += item.tsaValue;
        tIvaMzn += item.ivaValue;
        
        window.updateRowDOM(item);
    });
    
    const grandTotal = tCifMzn + tDaMzn + tIceMzn + tIvaMzn + tTsaMzn;
    
    window.quoteEditorState.totals = {
        fobForeign: tFob, freightForeign: tFrt, insForeign: tIns, othForeign: tOth,
        cifMzn: tCifMzn, daMzn: tDaMzn, iceMzn: tIceMzn, ivaMzn: tIvaMzn, tsaMzn: tTsaMzn,
        grandTotalMzn: grandTotal
    };
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };
    
    setTxt('tot-fob-foreign', formatCurrencyVal(tFob));
    setTxt('tot-freight-foreign', formatCurrencyVal(tFrt));
    setTxt('tot-ins-foreign', formatCurrencyVal(tIns));
    setTxt('tot-oth-foreign', formatCurrencyVal(tOth));
    setTxt('tot-cif-foreign', formatCurrencyVal(tFob + tFrt + tIns + tOth));
    
    setTxt('tot-cif-mzn', formatMZN(tCifMzn));
    setTxt('tot-da-mzn', formatMZN(tDaMzn));
    setTxt('tot-ice-mzn', formatMZN(tIceMzn));
    setTxt('tot-iva-mzn', formatMZN(tIvaMzn));
    setTxt('tot-tsa-mzn', formatMZN(tTsaMzn));
    
    setTxt('tot-grand-mzn', formatMZN(grandTotal));
    
    // Table Footer Totals
    setTxt('foot-tot-fob', formatCurrencyVal(tFob));
    const gFrtInput = document.getElementById('input-global-freight');
    if (gFrtInput) gFrtInput.placeholder = formatCurrencyVal(tFrt);
    const gInsInput = document.getElementById('input-global-insurance');
    if (gInsInput) gInsInput.placeholder = formatCurrencyVal(tIns);
    const gOthInput = document.getElementById('input-global-others');
    if (gOthInput) gOthInput.placeholder = formatCurrencyVal(tOth);
    setTxt('foot-tot-cif', formatCurrencyVal(tCifMzn));
    setTxt('foot-tot-da', formatCurrencyVal(tDaMzn));
    setTxt('foot-tot-ice', formatCurrencyVal(tIceMzn));
    setTxt('foot-tot-iva', formatCurrencyVal(tIvaMzn));
};

window.handleQuoteInputKeydown = function(e, element) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const tbody = document.getElementById('quote-items-tbody');
        if (!tbody) return;
        const inputs = Array.from(tbody.querySelectorAll('input:not([disabled])'));
        const index = inputs.indexOf(element);
        if (index > -1) {
            if (index < inputs.length - 1) {
                inputs[index + 1].focus();
                inputs[index + 1].select();
            } else {
                element.blur();
            }
        }
    }
};

window.renderQuoteItemsTable = function() {
    const tbody = document.getElementById('quote-items-tbody');
    if (!tbody) return;
    
    const tfoot = document.getElementById('quote-items-tfoot');
    
    if (window.quoteEditorState.items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-gray-400 font-bold">Nenhum artigo adicionado.</td></tr>`;
        if (tfoot) tfoot.classList.add('hidden');
        return;
    }
    
    if (tfoot) tfoot.classList.remove('hidden');
    
    tbody.innerHTML = window.quoteEditorState.items.map((item, index) => {
        const daRate = item.pauta ? getRateFromPauta(item.pauta, ['Direitos', 'Aduaneiros']) : 0;
        const iceRate = item.pauta ? getRateFromPauta(item.pauta, ['ICE', 'Consumo Especifico', 'Consumo Específico']) : 0;
        const ivaRate = item.pauta ? getRateFromPauta(item.pauta, ['IVA', 'Valor Acrescentado']) : 0;
        
        let hsColorClass = 'text-indigo-700';
        if (item.hsCode && item.hsCode.length === 8) {
            hsColorClass = item.pauta ? 'text-emerald-600' : 'text-red-500';
        }
        
        return `
        <tr id="row-${item.id}" class="hover:bg-gray-50/50 transition-colors h-7">
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-[10px] text-gray-400">${index + 1}</td>
            <td class="p-0 border-b border-r border-gray-100">
                <input type="text" class="input-desc w-full text-xs py-0.5 px-1 border-none hover:bg-white focus:ring-0 outline-none rounded bg-transparent h-6" value="${item.description}" onchange="window.updateQuoteRow(${item.id}, 'description', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="Descrição">
            </td>
            <td class="p-0 border-b border-r border-gray-100">
                <input type="text" maxlength="8" class="input-hscode w-full text-xs ${hsColorClass} py-0.5 px-1 border-none hover:bg-white focus:ring-0 outline-none rounded bg-transparent h-6 text-center" value="${item.hsCode}" oninput="this.value = this.value.replace(/[^0-9]/g, ''); window.updateQuoteRow(${item.id}, 'hsCode', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="Ex: 8703">
            </td>
            <td class="p-0 border-b border-r border-gray-100">
                <input type="number" class="w-full text-xs text-center py-0.5 px-1 border-none hover:bg-white focus:ring-0 outline-none rounded bg-transparent h-6 placeholder-gray-300" value="${item.qty}" oninput="window.updateQuoteRow(${item.id}, 'qty', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="0">
            </td>
            <td class="p-0 border-b border-r border-gray-100">
                <input type="number" class="w-full text-xs text-center py-0.5 px-1 border-none hover:bg-white focus:ring-0 outline-none rounded bg-transparent h-6 placeholder-gray-300" value="${item.unitPrice}" oninput="window.updateQuoteRow(${item.id}, 'unitPrice', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="0.00">
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-xs text-gray-800 bg-indigo-50/30 cell-fob font-medium">
                ${formatCurrencyVal(item.fob)}
            </td>
            <td class="p-0 border-b border-r border-gray-100">
                <input type="text" readonly class="input-readonly-freight w-full text-xs text-center py-0.5 px-1 border-none outline-none focus:ring-0 rounded bg-gray-50/50 text-gray-500 cursor-not-allowed h-6" value="${formatCurrencyVal(item.actualFreight || 0)}" title="Rateio Automático">
            </td>
            <td class="p-0 border-b border-r border-gray-100">
                <input type="text" readonly class="input-readonly-insurance w-full text-xs text-center py-0.5 px-1 border-none outline-none focus:ring-0 rounded bg-gray-50/50 text-gray-500 cursor-not-allowed h-6" value="${formatCurrencyVal(item.actualInsurance || 0)}" title="Rateio Automático">
            </td>
            <td class="p-0 border-b border-r border-gray-100">
                <input type="text" readonly class="input-readonly-others w-full text-xs text-center py-0.5 px-1 border-none outline-none focus:ring-0 rounded bg-gray-50/50 text-gray-500 cursor-not-allowed h-6" value="${formatCurrencyVal(item.actualOthers || 0)}" title="Rateio Automático">
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-xs text-indigo-700 bg-indigo-50/30 cell-cif font-medium">
                ${formatCurrencyVal(item.cifMzn)}
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-[10px] text-gray-700 cell-da leading-tight whitespace-nowrap">
                ${formatCurrencyVal(item.daValue)} <span class="text-[9px] text-gray-400">(${(daRate*100).toFixed(0)}%)</span>
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-[10px] text-gray-700 cell-ice leading-tight whitespace-nowrap">
                ${formatCurrencyVal(item.iceValue)} <span class="text-[9px] text-gray-400">(${(iceRate*100).toFixed(0)}%)</span>
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-[10px] text-gray-700 cell-iva leading-tight whitespace-nowrap">
                ${formatCurrencyVal(item.ivaValue)} <span class="text-[9px] text-gray-400">(${(ivaRate*100).toFixed(0)}%)</span>
            </td>
            <td class="p-0 border-gray-100 text-center">
                <button onclick="window.removeQuoteRow(${item.id})" class="btn-action-scale btn-delete text-gray-300 p-0.5 rounded-md inline-flex items-center justify-center hover:text-red-500" title="Remover Artigo">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </td>
        </tr>
        `;
    }).join('') + '<tr class="h-full"><td colspan="14" class="border-none bg-transparent p-0 m-0"></td></tr>';
};

window.saveQuoteSimulation = function() {
    if (window.quoteEditorState.items.length === 0) {
        toast("A fatura não contém artigos.", "error");
        return;
    }
    
    const modal = document.getElementById('modal-save-quote');
    if (modal) {
        document.getElementById('input-save-quote-name').value = '';
        document.getElementById('hidden-quote-id').value = window.quoteEditorState.id || '';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('div').classList.remove('scale-95');
        }, 10);
    }
};

window.closeSaveQuoteModal = function() {
    const modal = document.getElementById('modal-save-quote');
    if (modal) {
        modal.classList.add('opacity-0');
        modal.querySelector('div').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    }
};

window.confirmSaveQuote = async function() {
    const name = document.getElementById('input-save-quote-name').value.trim();
    if (!name) {
        toast("Por favor, insira o nome da cotação.", "error");
        return;
    }
    
    const quoteId = document.getElementById('hidden-quote-id').value;
    const btn = document.querySelector('#modal-save-quote button:nth-child(2)');
    btn.disabled = true;
    btn.innerHTML = 'A guardar...';
    
    try {
        const quoteData = {
            id: quoteId || null,
            client_name: name,
            type: 'IMPORTACAO',
            status: 'RASCUNHO',
            total_amount: window.quoteEditorState.totals.grandTotalMzn,
            cargo_description: window.quoteEditorState.items[0]?.description || 'Múltiplos Artigos',
            payload: window.quoteEditorState
        };
        
        const saved = await api.saveQuote(quoteData);
        window.quoteEditorState.id = saved.id;
        
        toast("Fatura guardada com sucesso!", "success");
        window.closeSaveQuoteModal();
        window.closeQuoteEditor();
        renderQuoteDashboard(); 
    } catch (err) {
        console.error(err);
        toast("Erro ao guardar cotação.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Guardar
        `;
    }
};

window.loadSavedQuote = function(id) {
    const quote = (state.quotes || []).find(q => q.id === id);
    if (!quote || !quote.payload) {
        toast("Esta cotação não possui dados simulados válidos.", "error");
        return;
    }
    
    if (quote.payload.items) {
        // Formato Novo (Multi-Item)
        window.quoteEditorState = quote.payload;
        window.quoteEditorState.id = quote.id; // ensure ID is set for editing
        
        document.getElementById('input-quote-currency').value = window.quoteEditorState.currency || 'USD';
        document.getElementById('input-quote-exchange').value = window.quoteEditorState.exchangeRate || 64.00;
        
        document.getElementById('lbl-quote-editor-title').innerText = `Cotação: ${quote.client_name}`;
        
        window.openQuoteEditor();
    } else {
        // Formato Antigo (Single Item) -> Migrar dinamicamente para o novo
        const old = quote.payload;
        window.quoteEditorState = {
            id: quote.id,
            currency: 'MT', // Old simulator was purely in MT
            exchangeRate: 1, // 1 to 1 mapping
            items: [
                {
                    id: Date.now(),
                    description: old.item.description,
                    hsCode: old.item.code,
                    qty: 1,
                    unitPrice: old.inputs.fob,
                    fob: old.inputs.fob,
                    freight: old.inputs.freight,
                    insurance: old.inputs.ins,
                    cif: 0, daValue: 0, iceValue: 0, ivaValue: 0, tsaValue: 0, pauta: old.item
                }
            ],
            totals: { fobForeign: 0, freightForeign: 0, insForeign: 0, cifMzn: 0, daMzn: 0, iceMzn: 0, ivaMzn: 0, tsaMzn: 0, grandTotalMzn: 0 }
        };
        
        document.getElementById('input-quote-currency').value = 'MT';
        document.getElementById('input-quote-exchange').value = '1';
        document.getElementById('lbl-quote-editor-title').innerText = `Cotação Migrada: ${quote.client_name}`;
        
        window.openQuoteEditor();
    }
};

// ==========================================
// FREIGHT MODAL LOGIC
// ==========================================

export function openFreightModal() {
    const totalBal = (window.currentClientRows || []).reduce((acc, r) => acc + (r.balFreight || 0), 0);
    const totalFrt = (window.currentClientRows || []).reduce((acc, r) => acc + (r.amtFreight || 0), 0);

    // Se não há frete a pagar ou já está todo pago, não abre o popup
    if (totalBal <= 0 && totalFrt > 0) {
        toast("Este frete já se encontra pago e saldado.", "success");
        return;
    }

    const modal = document.getElementById('modal-freight-update');
    if (modal) {
        document.getElementById('select-freight-bank').value = '';
        
        document.getElementById('modal-freight-total-value').innerText = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalFrt);

        setFreightOrigin('local');
        
        modal.classList.remove('hidden');
    }
}

export function setFreightOrigin(origin) {
    const btnChina = document.getElementById('btn-freight-origin-china');
    const btnLocal = document.getElementById('btn-freight-origin-local');
    const localFields = document.getElementById('freight-local-fields');
    const btnVincular = document.getElementById('btn-freight-vincular');

    if (origin === 'china') {
        btnChina.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
        btnChina.classList.remove('bg-transparent', 'text-slate-500');
        btnLocal.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
        btnLocal.classList.add('bg-transparent', 'text-slate-500');
        
        localFields.classList.add('hidden');
        if (btnVincular) btnVincular.classList.add('hidden');
        window.currentFreightOrigin = 'china';
    } else {
        btnLocal.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
        btnLocal.classList.remove('bg-transparent', 'text-slate-500');
        btnChina.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
        btnChina.classList.add('bg-transparent', 'text-slate-500');
        
        localFields.classList.remove('hidden');
        if (btnVincular) btnVincular.classList.remove('hidden');
        window.currentFreightOrigin = 'local';
    }
}

export function vincularPagamentoFrete() {
    closeFreightModal();
    if (!window.currentActiveClient) return;

    window.paymentReconciliationContext = 'FREIGHT';

    const bankValue = document.getElementById('select-freight-bank').value;
    const finalNote = 'PAID TO JUPITER';

    const trueRemaining = (window.currentClientRows || []).reduce((acc, r) => acc + (r.balFreight || 0), 0);

    let projectName = 'Folha';
    const breadcrumbSpan = document.querySelector('#confirm-breadcrumb > span.hover\\:text-black.cursor-pointer.transition-colors');
    if (breadcrumbSpan) {
        projectName = breadcrumbSpan.innerText.trim();
    }
    const combinedInfo = `FRETE - ${window.currentActiveClient.no || ''} - ${projectName}`.replace(/(^ - )|( - $)/g, '').trim();

    ui.openPaymentMiniFilter(
        combinedInfo,
        bankValue,
        trueRemaining,
        '',
        window.currentActiveClient.displayName || '',
        window.currentActiveClientState?.clientPhone || '',
        finalNote
    );
}

export function closeFreightModal() {
    const modal = document.getElementById('modal-freight-update');
    if (modal) {
        modal.classList.add('hidden');
    }
}

export async function saveFreightModal() {
    if (!window.currentActiveClient || !window.currentActiveClient.rows || window.currentActiveClient.rows.length === 0) {
        toast("Erro: Nenhum cliente selecionado.", "error");
        return;
    }

    let finalNote = '';
    let bankVal = '';
    const isChina = window.currentFreightOrigin === 'china';

    if (!isChina) {
        bankVal = document.getElementById('select-freight-bank').value;
        finalNote = 'PAID TO JUPITER';

        if (!bankVal) {
            toast("Por favor, selecione um banco para continuar.", "info");
            return;
        }
    }

    const btn = document.querySelector('#modal-freight-update button:nth-child(2)');
    if (btn) btn.disabled = true;

    try {
        const columns = state.confirm.columns || [];
        const cleanString = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
        const findCol = (targets) => {
            const cleanedTargets = targets.map(cleanString);
            for (const target of cleanedTargets) {
                const idx = columns.findIndex(c => cleanString(c) === target);
                if (idx !== -1) return idx;
            }
            return -1;
        };

        const bankFreightIdx = findCol(['BANK IN FREIGHT']);
        const notaFreightIdx = findCol(['NOTA FREIGHT']);
        const paidFreightIdx = findCol(['PAID FREIGHT']);
        const amountFreightIdx = findCol(['AMOUNT FREIGHT']);
        const balanceFreightIdx = findCol(['BALANCE FREIGHT']);

        const currentProjectSheetId = state.confirm.sheetId;
        
        let cleanSheetName = '';
        if (state.confirm.range && state.confirm.range.includes('!')) {
            cleanSheetName = state.confirm.range.split('!')[0].replace(/'/g, '');
        }

        const updates = [];
        
        // Loop sobre todas as ordens deste cliente
        for (const rowObj of window.currentActiveClient.rows) {
            const rowIndex = rowObj.originalIndex + 1; // +1 porque google sheets é 1-indexed

            if (!isChina) {
                // Update Bank in Freight
                if (bankVal !== '' && bankFreightIdx !== -1) {
                    updates.push({
                        range: `${cleanSheetName}!${String.fromCharCode(65 + bankFreightIdx)}${rowIndex}`,
                        values: [[bankVal === '?' ? '' : bankVal]]
                    });
                }
                
                // Update Nota Freight
                if (finalNote !== '' && notaFreightIdx !== -1) {
                    updates.push({
                        range: `${cleanSheetName}!${String.fromCharCode(65 + notaFreightIdx)}${rowIndex}`,
                        values: [[finalNote]]
                    });
                }
            }

            // Update PAID FREIGHT (o BALANCE FREIGHT será calculado por fórmula para ambas as origens)
            if (paidFreightIdx !== -1 && amountFreightIdx !== -1) {
                // Ir buscar o AMOUNT FREIGHT da linha
                const amountVal = state.confirm.data[rowObj.originalIndex][amountFreightIdx];
                const amt = parseFloat(String(amountVal).replace(/[^0-9.-]+/g, "")) || 0;
                
                updates.push({
                    range: `${cleanSheetName}!${String.fromCharCode(65 + paidFreightIdx)}${rowIndex}`,
                    values: [[amt]]
                });
            }
        }

        if (updates.length > 0) {
            await updateGSheetBatch(currentProjectSheetId, updates);
            toast("Frete atualizado com sucesso no GSheet!", "success");
        } else {
            toast("Erro: Colunas de Frete não encontradas no GSheet.", "warning");
        }

        closeFreightModal();

        // Recarregar os dados para refletir na UI
        if (typeof window.startGSheetPolling === 'function') {
            const freshData = await api.readGSheet(currentProjectSheetId, 'A1:AZ1000', true);
            if (freshData && typeof window.processGSheetData === 'function') {
                window.processGSheetData(freshData);
                const freshClient = window.currentConfirmClients.find(c => c.displayName === window.currentActiveClient.displayName);
                if (freshClient) {
                    await showConfirmDetail(freshClient, window.currentActiveClientIndex);
                }
            }
        }

    } catch (err) {
        console.error(err);
        toast("Erro ao gravar no GSheet.", "error");
    } finally {
        if (btn) btn.disabled = false;
    }
}

/**
 * Verifica e cria colunas de Armazém em falta no GSheet
 */
export async function checkAndCreateWarehouseColumns() {
    const columns = state.confirm.columns || [];
    const required = ['DISCHARGE', 'DELIVER', 'DELIVER DATE', 'DELIVER TO', 'CONTACTO', 'STORAGE PAID', 'DELIVERED'];
    
    const missing = [];
    required.forEach(req => {
        const found = columns.findIndex(c => {
            const clean = String(c || '').toUpperCase().trim();
            if (req === 'CONTACTO') return clean === 'CONTACTO' || clean === 'CONTACT';
            return clean === req;
        });
        if (found === -1) {
            missing.push(req);
        }
    });

    if (missing.length === 0) return;

    console.log('[WAREHOUSE] Colunas em falta no GSheet:', missing);
    const newColumns = [...columns, ...missing];
    
    let cleanSheetName = '';
    if (state.confirm.range) {
        cleanSheetName = state.confirm.range.split('!')[0].replace(/'/g, '');
    }
    const sheetPrefix = cleanSheetName ? `'${cleanSheetName}'!` : '';
    const lastColLetter = getColLetter(newColumns.length - 1);
    const range = `${sheetPrefix}A1:${lastColLetter}1`;

    try {
        setLoader(true, 'A criar colunas de Armazém...');
        await updateGSheet(state.confirm.sheetId, range, [newColumns]);
        
        // Atualizar colunas e re-ler
        const freshData = await readGSheet(state.confirm.sheetId, 'A1:AZ1000', true);
        toast('Colunas de Armazém criadas com sucesso!', 'success');
        
        const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
        renderConfirmList(freshData, "", statusFilter);
        if (window.currentActiveClient) {
            await showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
        }
    } catch (err) {
        console.error('[WAREHOUSE] Erro ao criar colunas:', err);
        toast('Erro ao criar colunas de Armazém: ' + err.message, 'error');
    } finally {
        setLoader(false);
    }
}

/**
 * Renderiza o painel operacional de Armazém nos detalhes do cliente
 */
export function parseDate(dateStr) {
    if (!dateStr || dateStr === '—') return null;
    const trimmed = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const parts = trimmed.split('-');
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
    }
    const parts = trimmed.split('/');
    if (parts.length === 3) {
        const dd = Number(parts[0]);
        const mm = Number(parts[1]);
        const yyyy = Number(parts[2]);
        if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
            return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
        }
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
        const d = new Date(parsed);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    return null;
}

export async function renderArmazemDetails(client, totalBalanceFreight, totalAmountFreight, allConfirmed) {
    const container = document.getElementById('armazem-operations-container');
    if (!container) return;

    try {
        const role = pb.authStore.model?.role || 'USER';
        const isAdmin = role === 'ADMIN';

        const formatDateForInput = (dateStr) => {
            if (!dateStr || dateStr === '—') return '';
            const trimmed = String(dateStr).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
            const parts = trimmed.split('/');
            if (parts.length === 3) {
                const dd = parts[0].padStart(2, '0');
                const mm = parts[1].padStart(2, '0');
                const yyyy = parts[2];
                if (yyyy.length === 4) {
                    return `${yyyy}-${mm}-${dd}`;
                }
            }
            return trimmed;
        };

        // Detetar índices das colunas
        const columns = state.confirm?.columns || [];
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

        const orderNumIdx = findCol(['HF2', 'REF', 'REFERENCIA', 'ORDER NUMBER', 'ORDER NUM', 'ORDER', 'CONV', 'CONTENTOR', 'Nº HF2', 'Nº ORDEM', 'NO.', 'N.O', 'N.º', 'Nº', 'N°', 'NO']);
        const packagesIdx = findCol(['PACKAGES']);
        const dischargeIdx = findCol(['DISCHARGE']);
        const deliverIdx = findCol(['DELIVER']);
        const deliverDateIdx = findCol(['DELIVER DATE']);
        const deliverToIdx = findCol(['DELIVER TO']);
        const contactoIdx = findCol(['CONTACTO', 'CONTACT']);
        const storagePaidIdx = findCol(['STORAGE PAID', 'ARMAZENAGEM PAGO', 'STORAGE_PAID']);
        const deliveredIdx = findCol(['DELIVERED', 'ENTREGUE', 'STATUS ENTREGA', 'DELIVERY STATUS']);
        const dutyIdx = findCol(['AMOUNT DUTY', 'DUTY', 'TOTAL DUTY', 'VALOR DUTY']);
        const dutyPrepaidIdx = findCol(['DUTY PREPAID', 'PREPAID']);
        const balanceIdx = findCol(['BALANCE', 'BALANCO', 'SALDO']);
        const pag1Idx = findCol(['PAG 1', 'PAG1']);
        const pag2Idx = findCol(['PAG 2', 'PAG2']);
        const pag3Idx = findCol(['PAG 3', 'PAG3']);

        // Verificar se todas as colunas de armazém existem
        const required = ['DISCHARGE', 'DELIVER', 'DELIVER DATE', 'DELIVER TO', 'CONTACTO', 'STORAGE PAID', 'DELIVERED'];
        const hasAll = required.every(req => {
            const idx = columns.findIndex(c => {
                const clean = String(c || '').toUpperCase().trim();
                if (req === 'CONTACTO') return clean === 'CONTACTO' || clean === 'CONTACT';
                return clean === req;
            });
            return idx !== -1;
        });

        if (!hasAll) {
            container.innerHTML = `
                <div class="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center">
                    <p class="text-xs font-bold text-slate-500 mb-4 uppercase">Para gerir o Armazém e custos, é necessário criar as colunas de controlo (Discharge, Deliver, Deliver Date, Deliver To, Contacto, Storage Paid, Delivered) no GSheet.</p>
                    <button onclick="ui.checkAndCreateWarehouseColumns()" class="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer">
                        Criar Colunas de Armazém
                    </button>
                </div>
            `;
            return;
        }

        // Regras de negócio para autorização de entrega:
        // 1. Direitos aduaneiros (Duty) vinculados e confirmados (allConfirmed === true)
        // 2. Frete pago (totalBalanceFreight <= 0)
        const isDutyConfirmed = allConfirmed;
        const isFreightPaid = totalBalanceFreight <= 0;
        const allowDelivery = isDutyConfirmed && isFreightPaid;

        // Calcular agregados
        let totalOriginal = 0;
        const ordersList = [];
        client.rows.forEach(r => {
            const orderNum = orderNumIdx !== -1 ? String(r.originalRow[orderNumIdx] || '').trim() : '';
            if (orderNum && orderNum !== '—') ordersList.push(orderNum);

            const pkgs = packagesIdx !== -1 ? parseFloat(r.originalRow[packagesIdx]) || 0 : 0;
            totalOriginal += pkgs;
        });

        const ordersString = ordersList.join(', ') || '—';

        // Calcular agregados de Discharge e Deliver
        let totalDischarged = 0;
        let totalDelivered = 0;
        let hasAnyDischarge = false;
        let hasAnyDeliver = false;

        client.rows.forEach(r => {
            if (dischargeIdx !== -1) {
                const val = parseFloat(r.originalRow[dischargeIdx]);
                if (!isNaN(val)) {
                    totalDischarged += val;
                    hasAnyDischarge = true;
                }
            }
            if (deliverIdx !== -1) {
                const val = parseFloat(r.originalRow[deliverIdx]);
                if (!isNaN(val)) {
                    totalDelivered += val;
                    hasAnyDeliver = true;
                }
            }
        });

        const dischargeVal = hasAnyDischarge ? totalDischarged : '';
        const deliverVal = hasAnyDeliver ? totalDelivered : '';

        // Ler valores textuais da primeira linha do cliente
        const firstRowIndex = client.rows[0].originalIndex;
        const firstRowData = state.confirm?.data?.[firstRowIndex] || [];
        const deliverDateVal = deliverDateIdx !== -1 ? (firstRowData[deliverDateIdx] || '') : '';
        const deliverToVal = deliverToIdx !== -1 ? (firstRowData[deliverToIdx] || '') : '';
        const contactoVal = contactoIdx !== -1 ? (firstRowData[contactoIdx] || '') : '';
        const storagePaidVal = storagePaidIdx !== -1 ? String(firstRowData[storagePaidIdx] || '').trim().toUpperCase() : 'NAO';
        const deliveredVal = deliveredIdx !== -1 ? String(firstRowData[deliveredIdx] || '').trim().toUpperCase() : 'NAO';
        const isDelivered = (deliveredVal === 'SIM' || deliveredVal === 'ENTREGUE' || deliveredVal === 'YES');

        // --- CÁLCULO DE CUSTO DE ARMAZENAGEM ---
        const dischargeDateStr = state.confirm?.dischargeDate || ''; // YYYY-MM-DD
        const dDate = parseDate(dischargeDateStr);
        
        // Determinar se o pagamento do Duty foi antecipado
        let totalDuty = 0;
        let totalPrepaid = 0;
        let totalBalance = 0;
        let hasPaymentAfterDischarge = false;

        client.rows.forEach(r => {
            const rowData = r.originalRow;
            const dVal = dutyIdx !== -1 ? parseFloat(String(rowData[dutyIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
            const pVal = dutyPrepaidIdx !== -1 ? parseFloat(String(rowData[dutyPrepaidIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
            const bVal = balanceIdx !== -1 ? parseFloat(String(rowData[balanceIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
            
            totalDuty += dVal;
            totalPrepaid += pVal;
            totalBalance += bVal;
            
            // Analisar datas nas colunas PAG 1, 2, 3
            const pagIndices = [pag1Idx, pag2Idx, pag3Idx].filter(idx => idx !== -1);
            pagIndices.forEach(idx => {
                const dateStr = rowData[idx];
                if (dateStr && String(dateStr).trim() !== '' && String(dateStr).trim() !== '—') {
                    const pDate = parseDate(dateStr);
                    if (pDate && dDate && pDate.getTime() > dDate.getTime()) {
                        hasPaymentAfterDischarge = true;
                    }
                }
            });
        });

        const isFullyPaid = (totalBalance <= 1.0);
        const isAnticipated = (totalPrepaid >= totalDuty) || (isFullyPaid && !hasPaymentAfterDischarge);

        // Calcular dias decorridos
        const deliverDateStr = deliverDateVal && deliverDateVal !== '—' ? deliverDateVal : '';
        const todayStr = new Date().toISOString().split('T')[0];
        const targetEndDateStr = deliverDateStr || todayStr;
        const targetEndDate = parseDate(targetEndDateStr);
        
        let daysDiff = 0;
        if (dDate && targetEndDate) {
            const timeDiff = targetEndDate.getTime() - dDate.getTime();
            daysDiff = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
        }

        // Aplicar a regra de armazenamento
        let storageCost = 0;
        if (dischargeDateStr) {
            if (isAnticipated) {
                if (daysDiff <= 3) {
                    storageCost = 0;
                } else {
                    storageCost = (daysDiff - 3) * 1000;
                }
            } else {
                if (daysDiff <= 3) {
                    storageCost = daysDiff * 500;
                } else {
                    storageCost = 1500 + (daysDiff - 3) * 1000;
                }
            }
        }

        // Estado do pagamento da armazenagem
        const isStoragePaid = (storagePaidVal === 'SIM' || storagePaidVal === 'PAGO' || storageCost === 0);

        // Verificar se toda a informação necessária para a emissão da guia está gravada
        const hasDeliveryInfoSaved = totalDelivered > 0 && 
                                     String(deliverDateVal).trim() !== '' && 
                                     String(deliverDateVal).trim() !== '—' &&
                                     String(deliverToVal).trim() !== '' && 
                                     String(deliverToVal).trim() !== '—' &&
                                     String(contactoVal).trim() !== '' && 
                                     String(contactoVal).trim() !== '—';

        const canEmitGuia = hasDeliveryInfoSaved && isStoragePaid;
        const isEditable = !isDelivered && (!hasDeliveryInfoSaved || isAdmin);

        // Cabeçalho da Guia com a data de descarga e dados de armazenagem
        const formatDateForDisplay = (dateStr) => {
            if (!dateStr) return '';
            const p = parseDate(dateStr);
            return p ? p.toLocaleDateString('pt-PT') : dateStr;
        };

        let bannerHtml = '';
        if (isDelivered) {
            bannerHtml = `
                <div class="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-3xl flex items-start gap-3 border-l-4 border-l-emerald-500">
                    <div class="p-2 bg-emerald-100 rounded-xl text-emerald-600 flex-shrink-0">
                        <svg class="w-5 h-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h4 class="font-black text-xs uppercase tracking-wider text-emerald-900">Carga Entregue ✅</h4>
                        <p class="text-[11px] text-emerald-700 font-semibold mt-1">A entrega desta carga foi confirmada e encerrada. A edição dos dados está bloqueada.</p>
                    </div>
                </div>
            `;
        } else if (allowDelivery) {
            if (storageCost > 0 && !isStoragePaid) {
                bannerHtml = `
                    <div class="bg-red-50 border border-red-200 text-red-800 p-4 rounded-3xl flex items-start gap-3 border-l-4 border-l-red-500">
                        <div class="p-2 bg-red-100 rounded-xl text-red-600 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-wider text-red-900">Emissão Bloqueada (Armazenagem Pendente) ❌</h4>
                            <p class="text-[11px] text-red-700 font-semibold mt-1">A entrega está financeiramente autorizada (Duty e Frete confirmados), mas a guia de entrega está bloqueada até que o custo de armazenagem de <strong>${formatMZN(storageCost)}</strong> seja pago.</p>
                        </div>
                    </div>
                `;
            } else if (hasDeliveryInfoSaved) {
                bannerHtml = `
                    <div class="bg-green-50 border border-green-200 text-green-800 p-4 rounded-3xl flex items-start gap-3 border-l-4 border-l-green-500">
                        <div class="p-2 bg-green-100 rounded-xl text-green-600 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-wider text-green-900">Entrega Autorizada ✅</h4>
                            <p class="text-[11px] text-green-700 font-semibold mt-1">Os Direitos Aduaneiros estão CONFIRMADOS, o Frete está PAGO e a Armazenagem está liquidada/isenta. A guia de entrega está pronta para emissão.</p>
                        </div>
                    </div>
                `;
            } else {
                bannerHtml = `
                    <div class="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-3xl flex items-start gap-3 border-l-4 border-l-amber-500">
                        <div class="p-2 bg-amber-100 rounded-xl text-amber-600 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-wider text-amber-900">Aguardando Informações de Entrega ⚠️</h4>
                            <p class="text-[11px] text-amber-700 font-semibold mt-1">A entrega está pré-autorizada (Duty Confirmado e Frete Pago), mas a guia só pode ser emitida após gravar os dados de descarga/entrega e confirmar a armazenagem.</p>
                        </div>
                    </div>
                `;
            }
        } else {
            bannerHtml = `
                <div class="bg-red-50 border border-red-200 text-red-800 p-4 rounded-3xl flex items-start gap-3 border-l-4 border-l-red-500">
                    <div class="p-2 bg-red-100 rounded-xl text-red-600 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <div>
                        <h4 class="font-black text-xs uppercase tracking-wider text-red-900">Entrega Bloqueada 🔒</h4>
                        <p class="text-[11px] text-red-700 font-bold mt-1">A carga não pode ser entregue até que as pendências sejam resolvidas:</p>
                        <ul class="list-disc pl-5 mt-1 text-[11px] text-red-700 font-bold space-y-0.5">
                            ${!isDutyConfirmed ? '<li>Os Direitos Aduaneiros (Duty) não estão totalmente CONFIRMADOS.</li>' : ''}
                            ${!isFreightPaid ? '<li>O Frete não está totalmente PAGO (Saldo pendente).</li>' : ''}
                        </ul>
                    </div>
                </div>
            `;
        }

        let buttonsHtml = '';
        const btnSpan = storageCost === 0 ? 'md:col-span-3' : 'md:col-span-2';
        
        if (isDelivered) {
            if (isAdmin) {
                buttonsHtml = `
                    <div class="${btnSpan} flex gap-1.5 flex-wrap md:flex-nowrap">
                        <button onclick="ui.reopenDelivery(${firstRowIndex}, this)" 
                            class="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer h-[38px]" title="Reabrir edição da entrega">
                            <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                            Reabrir
                        </button>
                        <button onclick="ui.printDeliveryNote()" 
                            class="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer h-[38px]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path><path d="M12 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V2"></path></svg>
                            Emitir Guia
                        </button>
                    </div>
                `;
            } else {
                buttonsHtml = `
                    <div class="${btnSpan}">
                        <button onclick="ui.printDeliveryNote()" 
                            class="w-full py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer h-[38px]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path><path d="M12 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V2"></path></svg>
                            Emitir Guia
                        </button>
                    </div>
                `;
            }
        } else {
            if (!hasDeliveryInfoSaved) {
                buttonsHtml = `
                    <div class="${btnSpan}">
                        <button onclick="ui.saveArmazemRow(${firstRowIndex}, this)" 
                            class="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer h-[38px]">
                            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            Gravar
                        </button>
                    </div>
                `;
            } else {
                buttonsHtml = `
                    <div class="${btnSpan} flex gap-1.5 flex-wrap md:flex-nowrap">
                        ${isAdmin ? `
                            <button onclick="ui.saveArmazemRow(${firstRowIndex}, this)" 
                                class="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer h-[38px]" title="Atualizar dados operacionais">
                                Actualizar
                            </button>
                        ` : ''}
                        <button onclick="ui.confirmDelivery(${firstRowIndex}, this)" 
                            class="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer h-[38px]" title="Confirmar entrega da carga e encerrar edição">
                            <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            Entregue
                        </button>
                        <button onclick="${canEmitGuia ? 'ui.printDeliveryNote()' : 'ui.toast(\'Bloqueado: O pagamento de armazenagem está pendente.\', \'warning\')'}" 
                            class="flex-1 py-2 px-3 ${canEmitGuia ? 'bg-green-600 hover:bg-green-700 cursor-pointer' : 'bg-gray-400 cursor-not-allowed opacity-50'} text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 h-[38px]" title="${canEmitGuia ? 'Emitir Guia de Entrega' : 'Bloqueado: Pagamento de armazenagem pendente'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path><path d="M12 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V2"></path></svg>
                            Emitir Guia
                        </button>
                    </div>
                `;
            }
        }

        // Badges de Armazenagem
        const dischargeDateBadge = `
            <span class="text-slate-400 font-bold uppercase text-[9px] bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                Descarga: <strong class="text-amber-900 ml-1 font-extrabold">${dischargeDateStr ? formatDateForDisplay(dischargeDateStr) : 'NÃO DEFINIDA'}</strong>
            </span>
        `;

        let storageBadgesHtml = '';
        if (dischargeDateStr && storageCost > 0) {
            const statusColor = isStoragePaid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200 animate-pulse';
            const textStatus = isStoragePaid ? 'Pago' : 'Pendente';
            storageBadgesHtml = `
                <span class="text-slate-400 font-bold uppercase text-[9px] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    Dias: <strong class="text-slate-700 ml-1 font-extrabold">${daysDiff}d</strong>
                </span>
                <span class="text-slate-400 font-bold uppercase text-[9px] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    Tarifa: <strong class="text-slate-700 ml-1 font-extrabold">${isAnticipated ? 'Antecipado' : 'Normal/Multa'}</strong>
                </span>
                <span class="font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg border ${statusColor}">
                    Armazenagem: <strong class="ml-1 font-extrabold">${formatMZN(storageCost)} (${textStatus})</strong>
                </span>
            `;
        }

        const deliveryStatusBadge = `
            <span class="font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg border ${isDelivered ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}">
                Entrega: <strong class="ml-1 font-extrabold text-[9px]">${isDelivered ? 'ENTREGUE ✅' : 'PENDENTE'}</strong>
            </span>
        `;

        container.innerHTML = `
            ${bannerHtml}
            
            ${allowDelivery ? `
            <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
                    <h4 class="font-black text-xs uppercase tracking-wider text-slate-700">Controlo Operacional (Armazém)</h4>
                    
                    <!-- Resumos e Quantidades Totais -->
                    <div class="flex flex-wrap items-center gap-2.5 text-xs">
                        <span class="text-slate-400 font-bold uppercase text-[9px] bg-slate-100 px-2.5 py-1 rounded-lg">
                            Ordens: <strong class="text-slate-700 ml-1 font-extrabold">${ordersString}</strong>
                        </span>
                        <span class="text-slate-400 font-bold uppercase text-[9px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
                            Total Original: <strong class="text-indigo-900 ml-1 font-extrabold">${totalOriginal} Vol</strong>
                        </span>
                        <span class="text-slate-400 font-bold uppercase text-[9px] bg-sky-50 text-sky-700 px-2.5 py-1 rounded-lg">
                            Descarregado: <strong class="text-sky-900 ml-1 font-extrabold">${dischargeVal || '0'} Vol</strong>
                        </span>
                        <span class="text-slate-400 font-bold uppercase text-[9px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg">
                            Entregue: <strong class="text-emerald-900 ml-1 font-extrabold">${deliverVal || '0'} Vol</strong>
                        </span>
                        ${dischargeDateBadge}
                        ${storageBadgesHtml}
                        ${deliveryStatusBadge}
                    </div>
                </div>
                
                <div id="armazem-form-container" class="grid grid-cols-1 md:grid-cols-8 gap-3 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    <div>
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Descarregado</label>
                        <input type="number" name="discharge" value="${dischargeVal}" placeholder="Qtd" 
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full text-center py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                    </div>
                    <div>
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Entregue</label>
                        <input type="number" name="deliver" value="${deliverVal}" placeholder="Qtd" 
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full text-center py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                    </div>
                    <div>
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Data Entrega</label>
                        <input type="date" name="deliverDate" value="${formatDateForInput(deliverDateVal)}" 
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full text-center py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                    </div>
                    <div>
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Entregue A</label>
                        <input type="text" name="deliverTo" value="${deliverToVal}" placeholder="Nome" 
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                    </div>
                    <div>
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Contacto</label>
                        <input type="text" name="contacto" value="${contactoVal}" placeholder="Contacto" 
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                    </div>
                    <div class="${storageCost === 0 ? 'hidden' : ''}">
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Armazenagem</label>
                        <select name="storagePaid" ${!isEditable ? 'disabled' : ''}
                            class="w-full text-center py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                            <option value="NAO" ${storageCost > 0 && storagePaidVal === 'NAO' ? 'selected' : ''}>❌ PENDENTE</option>
                            <option value="SIM" ${storageCost === 0 || storagePaidVal === 'SIM' ? 'selected' : ''}>✅ PAGO</option>
                        </select>
                    </div>
                    ${buttonsHtml}
                </div>
            </div>
            ` : ''}
        `;
    } catch (err) {
        console.error('[WAREHOUSE] Erro ao renderizar detalhes de Armazém:', err);
        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl text-center">
                <h4 class="font-black text-xs uppercase text-red-900 mb-2">Erro de Renderização ❌</h4>
                <p class="text-xs font-semibold">${err.message}</p>
                <pre class="text-[9px] text-left bg-white/50 p-3 rounded-lg mt-3 overflow-auto">${err.stack}</pre>
            </div>
        `;
    }
}

/**
 * Grava dados da linha operacional do Armazém no GSheet
 */
export async function saveArmazemRow(originalIndex, buttonEl) {
    const container = buttonEl.closest('#armazem-operations-container') || buttonEl.closest('#armazem-form-container') || document;
    if (!container) return;

    // Obter inputs
    const dischargeInput = container.querySelector('input[name="discharge"]');
    const deliverInput = container.querySelector('input[name="deliver"]');
    const deliverDateInput = container.querySelector('input[name="deliverDate"]');
    const deliverToInput = container.querySelector('input[name="deliverTo"]');
    const contactoInput = container.querySelector('input[name="contacto"]');
    const storagePaidInput = container.querySelector('select[name="storagePaid"]');

    const formatDateForSheet = (dateStr) => {
        if (!dateStr) return '';
        const trimmed = String(dateStr).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const parts = trimmed.split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return trimmed;
    };

    const dischargeVal = dischargeInput ? dischargeInput.value.trim() : '';
    const deliverVal = deliverInput ? deliverInput.value.trim() : '';
    const deliverDateValRaw = deliverDateInput ? deliverDateInput.value.trim() : '';
    const deliverDateVal = formatDateForSheet(deliverDateValRaw);
    const deliverToVal = deliverToInput ? deliverToInput.value.trim() : '';
    const contactoVal = contactoInput ? contactoInput.value.trim() : '';
    const storagePaidVal = storagePaidInput ? storagePaidInput.value.trim().toUpperCase() : 'NAO';

    const columns = state.confirm.columns || [];
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

    const packagesIdx = findCol(['PACKAGES']);
    const dischargeIdx = findCol(['DISCHARGE']);
    const deliverIdx = findCol(['DELIVER']);
    const deliverDateIdx = findCol(['DELIVER DATE']);
    const deliverToIdx = findCol(['DELIVER TO']);
    const contactoIdx = findCol(['CONTACTO', 'CONTACT']);
    const storagePaidIdx = findCol(['STORAGE PAID', 'ARMAZENAGEM PAGO', 'STORAGE_PAID']);
    const deliveredIdx = findCol(['DELIVERED', 'ENTREGUE', 'STATUS ENTREGA', 'DELIVERY STATUS']);

    if (dischargeIdx === -1 || deliverIdx === -1 || deliverDateIdx === -1 || deliverToIdx === -1 || contactoIdx === -1 || storagePaidIdx === -1 || deliveredIdx === -1) {
        toast('Erro: Colunas de Armazém não encontradas.', 'error');
        return;
    }

    const client = window.currentActiveClient;
    if (!client) {
        toast('Erro: Cliente ativo não encontrado.', 'error');
        return;
    }

    const firstRowIndex = client.rows[0].originalIndex;
    const firstRowData = state.confirm?.data?.[firstRowIndex] || [];
    const deliveredInput = container.querySelector('input[name="delivered"]');
    const deliveredVal = deliveredInput ? deliveredInput.value.trim().toUpperCase() : (deliveredIdx !== -1 && firstRowData[deliveredIdx] ? String(firstRowData[deliveredIdx]).trim().toUpperCase() : 'NAO');

    const totalDischargeInput = dischargeVal !== '' ? parseFloat(dischargeVal) : null;
    const totalDeliverInput = deliverVal !== '' ? parseFloat(deliverVal) : null;

    let remainingDischarge = totalDischargeInput !== null ? totalDischargeInput : 0;
    let remainingDeliver = totalDeliverInput !== null ? totalDeliverInput : 0;

    const batchUpdates = [];
    let sheetName = 'Folha1';
    if (state.confirm.range && state.confirm.range.includes('!')) {
        sheetName = state.confirm.range.split('!')[0];
    }
    const cleanSheetName = sheetName.replace(/'/g, '');
    const prefixClean = cleanSheetName ? `${cleanSheetName}!` : '';

    const updatedClientRows = [];

    client.rows.forEach((r, idx) => {
        const rowIndex = r.originalIndex;
        const rowNum = rowIndex + 1;
        const rowData = [...state.confirm.data[rowIndex]];
        const origPackages = packagesIdx !== -1 ? (parseFloat(rowData[packagesIdx]) || 0) : 0;

        // Distribuição de Descarregado pelas ordens
        if (dischargeIdx !== -1) {
            let allocatedDischarge = '';
            if (totalDischargeInput !== null) {
                if (idx === client.rows.length - 1) {
                    allocatedDischarge = String(Math.max(0, remainingDischarge));
                } else {
                    const alloc = Math.min(remainingDischarge, origPackages);
                    allocatedDischarge = String(alloc);
                    remainingDischarge = Math.max(0, remainingDischarge - alloc);
                }
            }
            rowData[dischargeIdx] = allocatedDischarge;
            batchUpdates.push({ range: `${prefixClean}${getColLetter(dischargeIdx)}${rowNum}`, values: [[allocatedDischarge]] });
        }

        // Distribuição de Entregue pelas ordens
        if (deliverIdx !== -1) {
            let allocatedDeliver = '';
            if (totalDeliverInput !== null) {
                if (idx === client.rows.length - 1) {
                    allocatedDeliver = String(Math.max(0, remainingDeliver));
                } else {
                    const alloc = Math.min(remainingDeliver, origPackages);
                    allocatedDeliver = String(alloc);
                    remainingDeliver = Math.max(0, remainingDeliver - alloc);
                }
            }
            rowData[deliverIdx] = allocatedDeliver;
            batchUpdates.push({ range: `${prefixClean}${getColLetter(deliverIdx)}${rowNum}`, values: [[allocatedDeliver]] });
        }

        // Metadados replicados para todas as ordens
        if (deliverDateIdx !== -1) {
            rowData[deliverDateIdx] = deliverDateVal;
            batchUpdates.push({ range: `${prefixClean}${getColLetter(deliverDateIdx)}${rowNum}`, values: [[deliverDateVal]] });
        }
        if (deliverToIdx !== -1) {
            rowData[deliverToIdx] = deliverToVal;
            batchUpdates.push({ range: `${prefixClean}${getColLetter(deliverToIdx)}${rowNum}`, values: [[deliverToVal]] });
        }
        if (contactoIdx !== -1) {
            rowData[contactoIdx] = contactoVal;
            batchUpdates.push({ range: `${prefixClean}${getColLetter(contactoIdx)}${rowNum}`, values: [[contactoVal]] });
        }
        if (storagePaidIdx !== -1) {
            rowData[storagePaidIdx] = storagePaidVal;
            batchUpdates.push({ range: `${prefixClean}${getColLetter(storagePaidIdx)}${rowNum}`, values: [[storagePaidVal]] });
        }
        if (deliveredIdx !== -1) {
            rowData[deliveredIdx] = deliveredVal;
            batchUpdates.push({ range: `${prefixClean}${getColLetter(deliveredIdx)}${rowNum}`, values: [[deliveredVal]] });
        }

        updatedClientRows.push({ rowIndex, rowData });
    });

    try {
        setBtnLoading(buttonEl, true);
        await updateGSheetBatch(state.confirm.sheetId, batchUpdates);
        
        // Atualizar estado em memória local
        updatedClientRows.forEach(item => {
            state.confirm.data[item.rowIndex] = item.rowData;
            const rObj = client.rows.find(r => r.originalIndex === item.rowIndex);
            if (rObj) {
                rObj.originalRow = item.rowData;
            }
        });

        // Re-renderizar o detalhe do cliente para atualizar a tabela
        await showConfirmDetail(client, window.currentActiveClientIndex);
        
        toast('Dados de Armazém gravados com sucesso!', 'success');
    } catch (err) {
        console.error('[WAREHOUSE] Erro ao gravar dados:', err);
        toast('Erro ao gravar dados no GSheet: ' + err.message, 'error');
    } finally {
        setBtnLoading(buttonEl, false);
    }
}

/**
 * Confirma a entrega da carga (marca como ENTREGUE) e bloqueia edições
 */
export async function confirmDelivery(originalIndex, buttonEl) {
    const container = buttonEl.closest('#armazem-operations-container') || buttonEl.closest('#armazem-form-container') || document;
    if (!container) return;

    const deliverInput = container.querySelector('input[name="deliver"]');
    const deliverDateInput = container.querySelector('input[name="deliverDate"]');
    const deliverToInput = container.querySelector('input[name="deliverTo"]');
    const contactoInput = container.querySelector('input[name="contacto"]');

    const deliverVal = deliverInput ? deliverInput.value.trim() : '';
    const deliverDateVal = deliverDateInput ? deliverDateInput.value.trim() : '';
    const deliverToVal = deliverToInput ? deliverToInput.value.trim() : '';
    const contactoVal = contactoInput ? contactoInput.value.trim() : '';

    if (!deliverVal || parseFloat(deliverVal) <= 0) {
        toast('Erro: Introduza uma quantidade válida de volumes entregues.', 'warning');
        return;
    }
    if (!deliverDateVal) {
        toast('Erro: Introduza a data de entrega.', 'warning');
        return;
    }
    if (!deliverToVal) {
        toast('Erro: Introduza o nome de quem recebeu a mercadoria.', 'warning');
        return;
    }
    if (!contactoVal) {
        toast('Erro: Introduza o contacto de quem recebeu.', 'warning');
        return;
    }

    if (!confirm('Deseja confirmar a entrega da carga? Esta ação irá bloquear futuras edições.')) {
        return;
    }

    let deliveredInput = container.querySelector('input[name="delivered"]');
    if (!deliveredInput) {
        deliveredInput = document.createElement('input');
        deliveredInput.type = 'hidden';
        deliveredInput.name = 'delivered';
        container.appendChild(deliveredInput);
    }
    deliveredInput.value = 'SIM';

    await saveArmazemRow(originalIndex, buttonEl);
}

/**
 * Reabre a entrega da carga permitindo edições (apenas Admin)
 */
export async function reopenDelivery(originalIndex, buttonEl) {
    if (!confirm('Deseja reabrir a edição da entrega para este cliente?')) {
        return;
    }

    const container = buttonEl.closest('#armazem-operations-container') || buttonEl.closest('#armazem-form-container') || document;
    let deliveredInput = container.querySelector('input[name="delivered"]');
    if (!deliveredInput) {
        deliveredInput = document.createElement('input');
        deliveredInput.type = 'hidden';
        deliveredInput.name = 'delivered';
        container.appendChild(deliveredInput);
    }
    deliveredInput.value = 'NAO';

    await saveArmazemRow(originalIndex, buttonEl);
}

/**
 * Abre o ecrã de impressão para emissão de Guia de Entrega
 */
export function printDeliveryNote() {
    const client = window.currentActiveClient;
    if (!client) return;

    const projectName = document.getElementById('confirm-project-active-name')?.textContent || 'PROJETO';
    const clientName = client.displayName || 'Cliente Sem Nome';
    const clientCode = client.displayIdCode || '---';
    const clientNo = client.no || '—';

    const columns = state.confirm.columns || [];
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

    const orderNumIdx = findCol(['HF2', 'REF', 'REFERENCIA', 'ORDER NUMBER', 'ORDER NUM', 'ORDER', 'CONV', 'CONTENTOR', 'Nº HF2', 'Nº ORDEM', 'NO.', 'N.O', 'N.º', 'Nº', 'N°', 'NO']);
    const packagesIdx = findCol(['PACKAGES']);
    const dischargeIdx = findCol(['DISCHARGE']);
    const deliverIdx = findCol(['DELIVER']);
    const deliverDateIdx = findCol(['DELIVER DATE']);
    const deliverToIdx = findCol(['DELIVER TO']);
    const contactoIdx = findCol(['CONTACTO', 'CONTACT']);
    const storagePaidIdx = findCol(['STORAGE PAID', 'ARMAZENAGEM PAGO', 'STORAGE_PAID']);
    const dutyIdx = findCol(['AMOUNT DUTY', 'DUTY', 'TOTAL DUTY', 'VALOR DUTY']);
    const dutyPrepaidIdx = findCol(['DUTY PREPAID', 'PREPAID']);
    const balanceIdx = findCol(['BALANCE', 'BALANCO', 'SALDO']);
    const pag1Idx = findCol(['PAG 1', 'PAG1']);
    const pag2Idx = findCol(['PAG 2', 'PAG2']);
    const pag3Idx = findCol(['PAG 3', 'PAG3']);

    let totalOriginal = 0;
    const ordersList = [];
    client.rows.forEach(r => {
        const orderNum = orderNumIdx !== -1 ? String(r.originalRow[orderNumIdx] || '').trim() : '';
        if (orderNum && orderNum !== '—') ordersList.push(orderNum);

        const pkgs = packagesIdx !== -1 ? parseFloat(r.originalRow[packagesIdx]) || 0 : 0;
        totalOriginal += pkgs;
    });

    const ordersString = ordersList.join(', ') || '—';

    // Ler da primeira linha
    const firstRowData = client.rows[0].originalRow;
    
    // Calcular agregados de Discharge e Deliver sobre todas as ordens
    let totalDischarged = 0;
    let totalDelivered = 0;
    client.rows.forEach(r => {
        if (dischargeIdx !== -1) totalDischarged += parseFloat(r.originalRow[dischargeIdx]) || 0;
        if (deliverIdx !== -1) totalDelivered += parseFloat(r.originalRow[deliverIdx]) || 0;
    });

    let receiverName = '—';
    let receiverContact = '—';
    let deliveryDate = new Date().toLocaleDateString('pt-BR');

    const deliverDateVal = deliverDateIdx !== -1 ? (firstRowData[deliverDateIdx] || '') : '';
    const deliverToVal = deliverToIdx !== -1 ? (firstRowData[deliverToIdx] || '') : '';
    const contactoVal = contactoIdx !== -1 ? (firstRowData[contactoIdx] || '') : '';
    const storagePaidVal = storagePaidIdx !== -1 ? String(firstRowData[storagePaidIdx] || '').trim().toUpperCase() : 'NAO';

    if (deliverToVal && deliverToVal !== '—') receiverName = deliverToVal;
    if (contactoVal && contactoVal !== '—') receiverContact = contactoVal;
    if (deliverDateVal && deliverDateVal !== '—') deliveryDate = deliverDateVal;

    // --- CÁLCULO DE ARMAZENAGEM PARA IMPRESSÃO ---
    const dischargeDateStr = state.confirm.dischargeDate || '';
    const dDate = parseDate(dischargeDateStr);
    
    let totalDuty = 0;
    let totalPrepaid = 0;
    let totalBalance = 0;
    let hasPaymentAfterDischarge = false;

    client.rows.forEach(r => {
        const rowData = r.originalRow;
        const dVal = dutyIdx !== -1 ? parseFloat(String(rowData[dutyIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
        const pVal = dutyPrepaidIdx !== -1 ? parseFloat(String(rowData[dutyPrepaidIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
        const bVal = balanceIdx !== -1 ? parseFloat(String(rowData[balanceIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
        
        totalDuty += dVal;
        totalPrepaid += pVal;
        totalBalance += bVal;
        
        const pagIndices = [pag1Idx, pag2Idx, pag3Idx].filter(idx => idx !== -1);
        pagIndices.forEach(idx => {
            const dateStr = rowData[idx];
            if (dateStr && String(dateStr).trim() !== '' && String(dateStr).trim() !== '—') {
                const pDate = parseDate(dateStr);
                if (pDate && dDate && pDate.getTime() > dDate.getTime()) {
                    hasPaymentAfterDischarge = true;
                }
            }
        });
    });

    const isFullyPaid = (totalBalance <= 1.0);
    const isAnticipated = (totalPrepaid >= totalDuty) || (isFullyPaid && !hasPaymentAfterDischarge);

    const targetEndDate = parseDate(deliveryDate || new Date().toISOString().split('T')[0]);
    let daysDiff = 0;
    if (dDate && targetEndDate) {
        const timeDiff = targetEndDate.getTime() - dDate.getTime();
        daysDiff = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
    }

    let storageCost = 0;
    if (dischargeDateStr) {
        if (isAnticipated) {
            if (daysDiff <= 3) {
                storageCost = 0;
            } else {
                storageCost = (daysDiff - 3) * 1000;
            }
        } else {
            if (daysDiff <= 3) {
                storageCost = daysDiff * 500;
            } else {
                storageCost = 1500 + (daysDiff - 3) * 1000;
            }
        }
    }

    const isStoragePaid = (storagePaidVal === 'SIM' || storagePaidVal === 'PAGO' || storageCost === 0);
    const textStoragePaid = isStoragePaid ? 'LIVRE / PAGO' : 'PENDENTE';

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Guia de Entrega - ${clientName}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
                .logo-section h1 { margin: 0; color: #4f46e5; font-size: 28px; font-weight: 800; tracking-tight: -0.05em; }
                .logo-section p { margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.1em; }
                .doc-info { text-align: right; }
                .doc-info h2 { margin: 0; color: #1e293b; font-size: 20px; font-weight: 800; text-transform: uppercase; }
                .doc-info p { margin: 5px 0 0 0; font-size: 12px; color: #64748b; font-weight: 600; }
                .details-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 40px; }
                .card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; background: #f8fafc; }
                .card h3 { margin: 0 0 10px 0; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #4f46e5; letter-spacing: 0.05em; }
                .card p { margin: 4px 0; font-size: 12px; font-weight: 600; }
                .card span { color: #64748b; font-weight: normal; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                th { background: #f1f5f9; padding: 12px 10px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 800; color: #475569; border-bottom: 2px solid #cbd5e1; }
                .totals-row { background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: bold; }
                .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
                .sig-box { border-top: 1px dashed #cbd5e1; padding-top: 15px; text-align: center; }
                .sig-box p { margin: 5px 0 0 0; font-size: 12px; font-weight: bold; color: #1e293b; }
                .sig-box span { font-size: 10px; color: #64748b; }
                .btn-print { background: #4f46e5; color: white; padding: 10px 20px; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; display: block; margin: 0 auto 30px auto; }
                @media print {
                    .btn-print { display: none; }
                    body { margin: 20px; }
                }
            </style>
        </head>
        <body>
            <button class="btn-print" onclick="window.print()">Imprimir Guia de Entrega</button>

            <div class="header">
                <div class="logo-section">
                    <h1 style="color: #0f172a; margin: 0 0 6px 0; font-size: 26px; font-weight: 800; letter-spacing: -0.03em;">JUPITER LOGISTICS LDA</h1>
                    <div style="font-size: 9px; color: #475569; font-weight: 600; line-height: 1.4;">
                        Av. do Trabalho nº 1412, 3º Andar<br>
                        Tel: +258 21401334 | Cel: +258 84 0485 691<br>
                        NUIT: 400574472 | Email: commercial@jupiter-logistics.co.mz
                    </div>
                </div>
                <div class="doc-info">
                    <h2>Guia de Entrega</h2>
                    <p>Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            <div class="details-grid">
                <div class="card">
                    <h3>Dados do Cliente</h3>
                    <p><span>Cliente:</span> ${clientName}</p>
                    <p><span>ID Code:</span> ${clientCode}</p>
                    <p><span>Nº do Cliente:</span> ${clientNo}</p>
                    <p><span>Projeto/Lista:</span> ${projectName}</p>
                </div>
                <div class="card">
                    <h3>Informações de Recebimento</h3>
                    <p><span>Entregue A:</span> ${receiverName}</p>
                    <p><span>Contacto:</span> ${receiverContact}</p>
                    <p><span>Data de Entrega:</span> ${deliveryDate}</p>
                </div>
                <div class="card">
                    <h3>Controlo de Armazenagem</h3>
                    <p><span>Data Descarga:</span> ${dischargeDateStr ? new Date(dischargeDateStr + 'T00:00:00').toLocaleDateString('pt-PT') : '—'}</p>
                    <p><span>Dias Decorridos:</span> ${daysDiff} dias</p>
                    <p><span>Custo Armazenagem:</span> ${formatMZN(storageCost)}</p>
                    <p><span>Estado Pagamento:</span> <strong style="color: ${isStoragePaid ? '#10b981' : '#ef4444'};">${textStoragePaid}</strong></p>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 45%;">Descrição da Mercadoria</th>
                        <th style="width: 15%; text-align: center;">Volumes Enviados</th>
                        <th style="width: 20%; text-align: center;">Volumes Descarregados</th>
                        <th style="width: 20%; text-align: center;">Volumes Entregues</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px 10px; font-weight: bold; font-size: 12px; color: #1e293b;">
                            Mercadoria do Cliente (Ordens: ${ordersString})
                        </td>
                        <td style="padding: 12px 10px; text-align: center; font-size: 12px; color: #334155;">${totalOriginal}</td>
                        <td style="padding: 12px 10px; text-align: center; font-size: 12px; color: #334155;">${totalDischarged}</td>
                        <td style="padding: 12px 10px; text-align: center; font-weight: bold; font-size: 12px; color: #10b981;">${totalDelivered}</td>
                    </tr>
                    <tr class="totals-row">
                        <td style="padding: 12px 10px; font-weight: bold;">TOTAL</td>
                        <td style="padding: 12px 10px; text-align: center; font-weight: bold;">${totalOriginal}</td>
                        <td style="padding: 12px 10px; text-align: center; font-weight: bold;">${totalDischarged}</td>
                        <td style="padding: 12px 10px; text-align: center; font-weight: bold; color: #10b981;">${totalDelivered}</td>
                    </tr>
                </tbody>
            </table>

            <div style="font-size: 11px; color: #64748b; margin-top: 40px; border-left: 3px solid #cbd5e1; padding-left: 15px;">
                <strong>Nota:</strong> Esta guia confirma que os volumes acima listados foram devidamente conferidos e entregues em perfeitas condições. O recebedor declara ter recebido a mercadoria conforme descrito.
            </div>

            <div class="signatures">
                <div class="sig-box">
                    <p>Jupiter Logistics Lda</p>
                    <span>Assinatura do Responsável</span>
                </div>
                <div class="sig-box">
                    <p>${receiverName}</p>
                    <span>Assinatura do Recebedor</span>
                </div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

export function checkAndShowNewsIcon(version) {
    if (!pb.authStore.isValid) return;
    if (localStorage.getItem('viewed-version-' + version) === 'true') return;
    
    // Se o botão já existir, não criar duplicado
    if (document.getElementById('btn-global-news')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-global-news';
    btn.className = 'fixed top-3.5 right-16 z-[9990] bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all animate-bounce cursor-pointer flex items-center justify-center border border-indigo-400';
    btn.title = 'Novidades da Versão (V1.2.0)';
    btn.onclick = () => showChangelogModal();
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1M19 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5" />
        </svg>
        <span class="absolute top-0 right-0 flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
    `;
    document.body.appendChild(btn);
}

export function showChangelogModal() {
    if (document.getElementById('modal-changelog')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-changelog';
    modal.className = 'modal-bg fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-md';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 text-black flex flex-col overflow-hidden scale-in">
            <!-- Header -->
            <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="bg-indigo-600 text-white p-2 rounded-xl shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1M19 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-base md:text-lg font-black uppercase tracking-tight text-slate-800">Notas de Atualização</h3>
                        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">O que há de novo nesta versão do sistema</p>
                    </div>
                </div>
                <button onclick="ui.closeChangelogModal()" class="bg-white border border-gray-200 p-2 rounded-xl font-bold hover:bg-red-50 hover:text-red-600 transition-all text-slate-500">✕</button>
            </div>
            
            <!-- Body -->
            <div class="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/30">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-650 leading-relaxed">
                    <!-- Coluna 1 -->
                    <div class="space-y-3">
                        <div class="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-xs">
                            <span class="text-[8px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black uppercase tracking-wider block w-fit mb-1.5">Módulo Confirm & Infraestrutura</span>
                            <p class="font-bold text-[10px] text-slate-800">🛡️ Modo Offline e Sincronização Automática:</p>
                            <p class="text-[10px] text-slate-500 font-medium mt-1">O sistema agora tem tolerância a falhas do GSheet. Se a planilha cair, o <code>Modo Backup Ativo</code> entra em ação permitindo continuar o trabalho. As alterações ficam no PocketBase e são injetadas no GSheet quando a ligação voltar.</p>
                        </div>
                        <div class="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-xs">
                            <span class="text-[8px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-black uppercase tracking-wider block w-fit mb-1.5">Prevenção de Perdas</span>
                            <p class="font-bold text-[10px] text-slate-800">⚖️ Resolução de Conflitos:</p>
                            <p class="text-[10px] text-slate-500 font-medium mt-1">Se alguém alterar o GSheet em casa enquanto o armazém trabalhava em Modo Offline, o sistema deteta e exibe o "Modal de Conflito de Sincronização", permitindo escolher entre a versão do Sistema ou a versão GSheet para evitar perda de dados.</p>
                        </div>
                    </div>
                    <!-- Coluna 2 -->
                    <div class="space-y-3">
                        <div class="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-xs">
                            <span class="text-[8px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black uppercase tracking-wider block w-fit mb-1.5">Reconciliação</span>
                            <p class="font-bold text-[10px] text-slate-800">🧮 Preservação de Fórmulas (Duty & Frete):</p>
                            <p class="text-[10px] text-slate-500 font-medium mt-1">Ações em massa e reconciliações individuais deixaram de exportar valores fixos para as colunas de <code>BALANCE</code>. Agora o sistema apenas atualiza pagamentos e datas, permitindo que a fórmula nativa do Google Sheets continue a operar de forma inteligente.</p>
                        </div>
                        <div class="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-xs">
                            <span class="text-[8px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black uppercase tracking-wider block w-fit mb-1.5">Módulo Armazém</span>
                            <p class="font-bold text-[10px] text-slate-800">📅 Atualizações Estáveis:</p>
                            <p class="text-[10px] text-slate-500 font-medium mt-1">Mantido o calendário nativo (datepicker) que salva no GSheet em formato standard e a ocultação de botões redundantes. O sistema geral está mais robusto contra latência da Google API.</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                <button onclick="ui.closeChangelogModal(true)" class="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer">
                    Entendido, obrigado!
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

export function closeChangelogModal(markAsViewed = false) {
    const modal = document.getElementById('modal-changelog');
    if (modal) modal.remove();

    if (markAsViewed) {
        const version = window.__SYSTEM_VERSION__ || 'v1.2.0';
        localStorage.setItem('viewed-version-' + version, 'true');
        const btn = document.getElementById('btn-global-news');
        if (btn) btn.remove();
    }
}

export function showSyncStatus(isOffline) {
    let banner = document.getElementById('sync-status-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'sync-status-banner';
        banner.className = 'fixed top-0 left-0 w-full z-[999] transition-all duration-500 flex justify-center items-center pointer-events-none opacity-0 -translate-y-full';
        document.body.appendChild(banner);
    }
    
    if (isOffline) {
        banner.innerHTML = `
            <div class="bg-red-500 text-white px-4 py-2 rounded-b-xl shadow-lg flex items-center gap-2 pointer-events-auto">
                <i class="fas fa-exclamation-triangle text-sm"></i>
                <span class="text-xs font-bold uppercase tracking-wide">Modo Backup Ativo (Offline)</span>
            </div>
        `;
        requestAnimationFrame(() => {
            banner.classList.remove('opacity-0', '-translate-y-full');
            banner.classList.add('opacity-100', 'translate-y-0');
        });
    } else {
        banner.classList.remove('opacity-100', 'translate-y-0');
        banner.classList.add('opacity-0', '-translate-y-full');
    }
}

export function showSyncConflict(conflictData) {
    const { projectId, spreadsheetId, pbRecord } = conflictData;
    let modal = document.getElementById('modal-sync-conflict');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'modal-sync-conflict';
    modal.className = "fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4";
    modal.innerHTML = `
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200">
            <div class="p-6 bg-red-50 border-b border-red-100 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <i class="fas fa-exclamation-circle text-2xl text-red-600"></i>
                </div>
                <div>
                    <h2 class="text-lg font-black text-slate-800 tracking-tight">Conflito de Sincronização</h2>
                    <p class="text-xs font-medium text-red-600">Detetámos alterações em ambos os locais.</p>
                </div>
            </div>
            
            <div class="p-6 space-y-4">
                <p class="text-sm text-slate-600 font-medium">A Planilha Google foi modificada externamente enquanto a app operava em Modo Offline. O que deseja fazer?</p>
                
                <div class="grid grid-cols-1 gap-3 mt-4">
                    <button id="btn-resolve-system" class="w-full text-left p-4 rounded-xl border-2 border-indigo-100 hover:border-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 transition-colors group cursor-pointer">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-sm text-indigo-900">Forçar Versão do Sistema</span>
                            <i class="fas fa-arrow-right text-indigo-400 group-hover:text-indigo-600"></i>
                        </div>
                        <p class="text-[10px] text-indigo-600/70 mt-1 font-medium">Substitui a Planilha Google com os dados guardados localmente nesta app.</p>
                    </button>
                    
                    <button id="btn-resolve-gsheet" class="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-slate-400 bg-slate-50 transition-colors group cursor-pointer">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-sm text-slate-700">Usar Versão da Planilha</span>
                            <i class="fas fa-download text-slate-400 group-hover:text-slate-600"></i>
                        </div>
                        <p class="text-[10px] text-slate-500 mt-1 font-medium">Descarta as edições feitas na app e carrega os dados atuais do Google Sheets.</p>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('btn-resolve-system').onclick = async () => {
        const btn = document.getElementById('btn-resolve-system');
        const icon = btn.querySelector('i');
        icon.className = 'fas fa-spinner fa-spin text-indigo-600';
        try {
            // Fetch PB explicitamente, é mais seguro que usar pb globals
            const pb_url = window.POCKETBASE_CONFIG && window.POCKETBASE_CONFIG.POCKETBASE_URL ? window.POCKETBASE_CONFIG.POCKETBASE_URL : 'http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io';
            const restoreData = pbRecord.sheet_data.values || pbRecord.sheet_data;
            await fetch('/api/google/sheet/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spreadsheetId, range: 'A1', values: restoreData })
            });
            // Limpa flag
            const { pb } = await import('./api.js');
            await pb.collection('confirm_projects').update(projectId, { has_pending_sync: false });
            window.location.reload();
        } catch (e) {
            alert("Erro ao forçar gravação: " + e.message);
            icon.className = 'fas fa-arrow-right text-indigo-600';
        }
    };
    
    document.getElementById('btn-resolve-gsheet').onclick = async () => {
        const btn = document.getElementById('btn-resolve-gsheet');
        const icon = btn.querySelector('i');
        icon.className = 'fas fa-spinner fa-spin text-slate-600';
        try {
            // Limpa flag e recarrega
            const { pb } = await import('./api.js');
            await pb.collection('confirm_projects').update(projectId, { has_pending_sync: false });
            window.location.reload();
        } catch (e) {
            alert("Erro ao limpar flag: " + e.message);
            icon.className = 'fas fa-download text-slate-600';
        }
    };
}
