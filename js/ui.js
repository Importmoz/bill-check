/**
 * Módulo de Interface e UI para Bill Check
 */
import { formatMZN } from './utils.js';
import { state } from './api.js';

/**
 * Controla o indicador de carregamento
 */
export function setLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

/**
 * Utilitário para ocultar todas as visões principais
 */
function hideAllViews() {
    ['view-login', 'view-hub', 'view-dashboard', 'view-table', 'view-finance', 'view-team-dashboard', 'view-team-table', 'view-term-dashboard', 'view-term-table'].forEach(id => {
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

    // Renderizar por Grupos
    groups.forEach(group => {
        const groupRecords = records.filter(r => r.group_id === group.id);
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
    renderTeamSummary(totalPendency, groups.length, stats.totalRecords, stats.completedRecords);

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
                        <div class="text-[8px] font-bold uppercase text-gray-400 mb-0.5">Contentores</div>
                        <div class="text-lg font-black text-gray-900">${contentoresCount}</div>
                    </div>
                    <div>
                        <div class="text-[8px] font-bold uppercase text-gray-400 mb-0.5">Concluídos</div>
                        <div class="text-lg font-black text-green-600">${concluidosCount}</div>
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

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    // Extrair apenas a parte da data (YYYY-MM-DD) caso venha com hora (PocketBase format)
    const pureDate = dateStr.split(' ')[0];
    if (!pureDate.includes('-')) return dateStr;
    
    const [y, m, d] = pureDate.split('-');
    if (!y || !m || !d) return dateStr;
    return `${d}/${m}/${y}`;
}

