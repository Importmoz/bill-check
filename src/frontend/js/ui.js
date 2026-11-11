/**
 * Módulo de Interface e UI para Bill Check
 */
import { formatMZN, formatDateDisplay } from './utils.js';
import { state, pb, emitConfirmEvent, subscribeConfirmEvents, unsubscribeConfirmEvents, unsubscribeBankEvents, getSettingsUsers, uploadBankStatement, saveBankIncome, listBankIncomes, searchPayments, markPaymentReconciled, unallocatePayment, logConfirmAudit, getClientAuditLogs, readGSheet, updateGSheet, updateGSheetBatch, updateGSheetNote, insertGSheetColumn, syncPendingChangesToGSheet, getPaymentsByAllocatedTo, getPaymentsByAllocatedPrefix, getPaymentsByMasterRef, listGDriveFiles, saveQuote, deleteQuote, listQuotes, searchPauta, saveQuoteClient, getQuoteClient, getAllClients, buildSearchFilter } from './api.js';
import { cleanHeaderString, findWarehouseCol, formatLocalYMD, parseWarehouseDate, hasValidDischargeDate, formatFeeSheetStatus, parseStorageInfo, calculateClientStorage, parseDespachoCopyInfo, calculateClientDespachoCopy } from './warehouseStorage.js?v=20261112_01';

const DESPACHO_DEFAULT_PRICE_KEY = 'despacho_copy_default_price';

export function getDespachoCopyDefaultPrice() {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DESPACHO_DEFAULT_PRICE_KEY) : null;
        if (raw === null || raw === '') return 500;
        const parsed = parseFloat(raw);
        return (!isNaN(parsed) && parsed >= 0) ? parsed : 500;
    } catch (e) {
        return 500;
    }
}

export function setDespachoCopyDefaultPrice(val) {
    const num = Math.max(0, parseFloat(val) || 0);
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(DESPACHO_DEFAULT_PRICE_KEY, String(num));
        }
    } catch (e) {
        console.warn('[DESPACHO] Aviso ao gravar valor padrão em localStorage:', e);
    }
    return num;
}
import { getRateFromPauta, getComplexRateFromPauta, calculateInvoice } from './quoteCalculator.js';
import { JUPITER_LOGO_DATA_URL } from './logoData.js';
import { printService } from './printService.js';

export function getPaymentBankDisplay(payment) {
    let rawBank = payment.bank;
    if (Array.isArray(rawBank)) rawBank = rawBank[0];
    let bankDisplay = String(rawBank || '—').toUpperCase();
    
    if (payment.account_owner) {
        const ownerUpper = String(payment.account_owner).toUpperCase();
        if (!bankDisplay.includes('BOSS') && !bankDisplay.includes('JUPITER')) {
            if (ownerUpper.includes('BOSS') || ownerUpper.includes('FILIPE')) {
                bankDisplay += ' BOSS';
            } else if (ownerUpper.includes('JUPITER')) {
                bankDisplay += ' JUPITER';
            }
        }
    }
    return bankDisplay;
}

export function getBankLogoHtml(bankName, extraClass = 'w-4 h-4 rounded-[2px] object-contain shrink-0') {
    if (!bankName) return '';
    const b = String(bankName).toUpperCase();
    if (b.includes('BIM')) {
        return `<img src="assets/banks/bim.png" alt="BIM" class="${extraClass}">`;
    }
    if (b.includes('BCI')) {
        return `<img src="assets/banks/bci.jpg" alt="BCI" class="${extraClass}">`;
    }
    if (b.includes('STB') || b.includes('STANDARD')) {
        return `<img src="assets/banks/stb.png" alt="STB" class="${extraClass}">`;
    }
    if (b.includes('NEDBANK')) {
        return `<img src="assets/banks/nedbank.png" alt="NEDBANK" class="${extraClass}">`;
    }
    if (b.includes('EMOLA') || b.includes('MPESA') || b.includes('M-PESA')) {
        return `<img src="assets/banks/emola.png" alt="EMOLA" class="${extraClass}">`;
    }
    return '';
}
window.getBankLogoHtml = getBankLogoHtml;
/**
 * Controla o indicador de carregamento
 */
window.quoteIsDirty = false;
window.updateQuoteActionsUI = function() {
    const btnQuote = document.getElementById('btn-switch-to-quote');
    const btnSave = document.getElementById('btn-save-simulation');
    
    if (btnQuote) {
        if (window.quoteEditorState && window.quoteEditorState.id) {
            btnQuote.style.display = 'flex';
        } else {
            btnQuote.style.display = 'none';
        }
    }
    
    if (btnSave) {
        if (!window.quoteEditorState || !window.quoteEditorState.id) {
            btnSave.style.display = 'flex';
            btnSave.innerHTML = '<i class="fas fa-save"></i> Gravar';
        } else {
            if (window.quoteIsDirty) {
                btnSave.style.display = 'flex';
                btnSave.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
            } else {
                btnSave.style.display = 'none';
            }
        }
    }
    
    const btnAttach = document.getElementById('btn-attach-quote-global');
    const btnView = document.getElementById('btn-view-quote-global');
    
    if (btnAttach) {
        if (window.quoteEditorState && window.quoteEditorState.attachment) {
            btnAttach.classList.remove('text-red-600', 'bg-red-50', 'hover:bg-red-100', 'active:bg-red-200', 'border-red-100', 'hover:text-red-800', 'text-blue-600', 'bg-blue-50', 'hover:bg-blue-100', 'active:bg-blue-200', 'border-blue-100', 'hover:text-blue-800');
            btnAttach.classList.add('text-green-600', 'bg-green-50', 'hover:bg-green-100', 'active:bg-green-200', 'border-green-100', 'hover:text-green-800');
            btnAttach.title = "Substituir Anexo: " + (window.quoteEditorState.attachment.name || "Fatura/Documento anexado");
            if (btnView) btnView.style.display = 'flex';
        } else {
            btnAttach.classList.remove('text-green-600', 'bg-green-50', 'hover:bg-green-100', 'active:bg-green-200', 'border-green-100', 'hover:text-green-800', 'text-blue-600', 'bg-blue-50', 'hover:bg-blue-100', 'active:bg-blue-200', 'border-blue-100', 'hover:text-blue-800');
            btnAttach.classList.add('text-red-600', 'bg-red-50', 'hover:bg-red-100', 'active:bg-red-200', 'border-red-100', 'hover:text-red-800');
            btnAttach.title = "Sem Anexo (Clique para adicionar Fatura/Documento)";
            if (btnView) btnView.style.display = 'none';
        }
    }
};

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
 * Formata um range com nome de aba seguro e aspas simples quando necessário
 */
export function formatSheetRange(sheetNameOrPrefix, cellRef) {
    if (!sheetNameOrPrefix) return cellRef;
    let sName = sheetNameOrPrefix.endsWith('!') ? sheetNameOrPrefix.slice(0, -1) : sheetNameOrPrefix;
    sName = sName.replace(/^'+|'+$/g, '').trim();
    if (!sName) return cellRef;
    const escapedName = sName.replace(/'/g, "''");
    return `'${escapedName}'!${cellRef}`;
}
window.formatSheetRange = formatSheetRange;

/**
 * Procura índice de coluna com correspondência exata, por palavra inteira ou substring segura
 */
export function findColumnIndex(columns, targets) {
    if (!columns || !Array.isArray(columns) || !targets) return -1;
    const cleanString = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
    const getWords = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, " ").trim().split(/\s+/).filter(Boolean);

    const targetList = Array.isArray(targets) ? targets : [targets];

    // 1. Correspondência exata no texto limpo
    for (const target of targetList) {
        const ct = cleanString(target);
        if (!ct) continue;
        const idx = columns.findIndex(c => cleanString(c) === ct);
        if (idx !== -1) return idx;
    }

    // 2. Correspondência por palavra ou frase completa
    for (const target of targetList) {
        const tWords = getWords(target);
        if (tWords.length === 0) continue;
        const tPhrase = tWords.join(' ');
        const idx = columns.findIndex(c => {
            const cWords = getWords(c);
            const cPhrase = cWords.join(' ');
            if (cPhrase === tPhrase) return true;
            if (tWords.length === 1 && cWords.includes(tWords[0])) return true;
            return false;
        });
        if (idx !== -1) return idx;
    }

    // 3. Substring apenas para termos longos (>= 4 caracteres e não ambíguos)
    for (const target of targetList) {
        const ct = cleanString(target);
        if (!ct || ct.length < 4 || ct === 'DUTY' || ct === 'PAID') continue;
        const idx = columns.findIndex(c => cleanString(c).includes(ct));
        if (idx !== -1) return idx;
    }

    return -1;
}
window.findColumnIndex = findColumnIndex;

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
export function setBtnLoading(btn, isLoading, loadingText = null) {
    if (!btn) return;
    
    if (isLoading) {
        // Guardar sempre o HTML original para não perder ícones/formatação
        if (!btn.dataset.originalHtml) {
            btn.dataset.originalHtml = btn.innerHTML;
        }
        
        btn.classList.add('btn-loading');
        if (btn.classList.contains('bg-black') || btn.classList.contains('bg-blue-600') || btn.classList.contains('bg-slate-900') || btn.classList.contains('bg-purple-600')) {
            btn.classList.add('btn-loading-white');
        }
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading');
        btn.classList.remove('btn-loading-white');
        btn.disabled = false;
        
        // Restaurar o HTML original
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            // Remover para permitir novas alterações de estado corretas no futuro
            delete btn.dataset.originalHtml;
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
    
    const financeBulkBar = document.getElementById('finance-bulk-bar');
    if (financeBulkBar && viewId !== 'view-finance') {
        financeBulkBar.classList.add('hidden');
    }
    
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

        if (viewId === 'view-confirm-table') {
            const filterText = document.getElementById('input-confirm-search')?.value || '';
            const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
            if (typeof renderConfirmList === 'function' && state.confirm && state.confirm.data && state.confirm.data.length > 0) {
                renderConfirmList(state.confirm.data, filterText, statusFilter);
            }
        }
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

    const showZero = !!state.showZeroBalanceTables;
    const zeroTablesCount = state.tables.filter(t => Math.abs(t.balance || 0) < 0.01).length;
    const nonZeroTables = state.tables.filter(t => Math.abs(t.balance || 0) >= 0.01);
    const visibleTables = showZero ? state.tables : nonZeroTables;

    // Atualizar botão de alternar visualização das tabelas com saldo 0 (apenas ícone de visualizar)
    const toggleBtn = document.getElementById('btn-toggle-zero-tables');
    if (toggleBtn) {
        if (showZero) {
            toggleBtn.className = "p-2.5 rounded-xl transition-all border flex items-center justify-center bg-gray-900 text-white border-gray-900 shadow-sm active:scale-90";
            toggleBtn.title = `Ocultar tabelas com saldo 0 (${zeroTablesCount})`;
            toggleBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                </svg>
            `;
        } else {
            toggleBtn.className = "p-2.5 rounded-xl transition-all border flex items-center justify-center bg-white hover:bg-gray-100 text-gray-500 hover:text-black border-gray-200 shadow-sm active:scale-90";
            toggleBtn.title = `Visualizar tabelas com saldo 0 (${zeroTablesCount})`;
            toggleBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
            `;
        }
        if (zeroTablesCount === 0) {
            toggleBtn.classList.add('opacity-40', 'pointer-events-none');
        } else {
            toggleBtn.classList.remove('opacity-40', 'pointer-events-none');
        }
    }

    if (visibleTables.length === 0) {
        if (!showZero && zeroTablesCount > 0) {
            list.innerHTML = `
                <div class="col-span-full text-center py-16 bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                    <div class="w-12 h-12 mx-auto mb-3 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <h3 class="font-black text-sm uppercase text-gray-800 mb-1">Todas as tabelas estão liquidadas!</h3>
                    <p class="text-xs text-gray-500 mb-4">Nenhuma tabela com saldo pendente no momento.</p>
                    <button onclick="window.toggleShowZeroTables(true)" class="px-5 py-2.5 bg-black text-white text-xs font-bold uppercase rounded-xl hover:bg-gray-800 transition-all shadow-md active:scale-95">
                        Ver Tabelas Liquidadas (${zeroTablesCount})
                    </button>
                </div>
            `;
        } else {
            list.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400 uppercase text-[9px] font-bold tracking-widest">Sem tabelas encontradas.</div>';
        }
        return;
    }

    visibleTables.forEach((table, idx) => {
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
                    <div class="cursor-pointer hover:bg-green-100/60 p-2 rounded-xl transition-all" onclick="window.toggleShowZeroTables()" title="Clique para alternar tabelas com saldo 0">
                        <div class="text-xs font-bold uppercase text-gray-500 mb-1 underline decoration-dotted">Liquidadas (0)</div>
                        <div class="text-lg font-bold text-green-700">${stats.zero}</div>
                    </div>
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
            <td class="cell-data font-normal">${formatMZN(diff)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Subtotal
    footer.innerHTML += `
        <tr class="h-8"><td></td><td></td><td></td><td></td></tr>
        <tr class="font-normal bg-slate-50 text-[0.75rem]">
            <td class="text-center uppercase py-4">Total Bruto</td>
            <td class="text-center">${formatMZN(totalDuty)}</td>
            <td class="text-center">${formatMZN(totalFreight)}</td>
            <td class="text-center">${formatMZN(totalLiability)}</td>
        </tr>
    `;

    // Linhas de Pagamento e Saídas
    let netPayments = 0;
    state.balanceRecords.forEach((p, idx) => {
        const rawAmount = parseFloat(p.amount) || 0;
        const isSaida = p.type === 'SAIDA' || p.type === 'REFUND' || rawAmount < 0;
        const absAmount = Math.abs(rawAmount);

        if (isSaida) {
            netPayments -= absAmount;
        } else {
            netPayments += absAmount;
        }

        const dateFormatted = p.payment_date ? new Date(p.payment_date).toLocaleDateString('pt-PT') : '—';
        const label = isSaida ? `Saída / Devolução ${idx + 1}` : `Paid ${idx + 1}`;
        const rowClass = isSaida ? 'refund-row-style' : 'paid-row-style';
        const textClass = isSaida ? 'text-amber-800' : 'text-green-800';
        const noteText = p.note ? ` • ${p.note}` : '';
        const descText = isSaida 
            ? `Saída de Caixa (Devolução/Credor) em ${dateFormatted}${noteText}` 
            : `Liquidação via Caixa em ${dateFormatted}${noteText}`;

        footer.innerHTML += `
            <tr class="${rowClass}">
                <td class="text-center uppercase font-normal py-3 border-r-0">${label}</td>
                <td colspan="2" class="text-right italic pr-4 text-[9px] border-l-0">${descText}</td>
                <td class="text-center font-normal ${textClass}">${isSaida ? `+${formatMZN(absAmount)}` : `(${formatMZN(absAmount)})`}</td>
            </tr>
        `;
    });

    const currentBalance = totalLiability - netPayments;
    state.activeBalance = currentBalance; // Atualiza o estado global para uso no modal de pagamento

    // Linha de Balanço Final
    const isCredit = currentBalance < 0;
    footer.innerHTML += `
        <tr class="balance-row ${isCredit ? 'balance-credit' : ''}">
            <td class="uppercase py-4">Balance</td>
            <td colspan="2" class="text-right text-[9px] pr-4 italic font-normal text-slate-700">
                ${isCredit ? 'Crédito Disponível (Excedente)' : 'Saldo Pendente (A Liquidar)'}
            </td>
            <td class="text-center font-normal">${formatMZN(currentBalance)}</td>
        </tr>
    `;
}

/**
 * Renderiza os dados em tempo real vindos do Google Sheets (Modo NEW)
 */
export function renderRealtimeBillDetails(realtimeData, onEditContainer = null) {
    const tbody = document.getElementById('table-body');
    const footer = document.getElementById('footer-logic');
    if (!tbody || !footer) return;

    tbody.innerHTML = '';
    footer.innerHTML = '';

    const items = realtimeData?.items || [];
    const totals = realtimeData?.totals || { duty: 0, freight: 0, diff: 0 };

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-10 text-gray-400 font-bold uppercase text-xs">
                    Nenhum registo encontrado.
                </td>
            </tr>
        `;
        return;
    }

    let totalDuty = 0, totalFreight = 0, totalLiability = 0;

    items.forEach((c) => {
        const duty = parseFloat(c.duty) || 0;
        const freight = parseFloat(c.freight) || 0;
        const diff = duty - freight;

        totalDuty += duty;
        totalFreight += freight;
        totalLiability += diff;

        const tr = document.createElement('tr');
        tr.className = (onEditContainer ? "cursor-pointer " : "") + "hover:bg-yellow-50 transition-colors";
        if (onEditContainer) {
            tr.onclick = () => onEditContainer(c);
        }
        tr.innerHTML = `
            <td class="row-container">${c.container_id_str}</td>
            <td class="cell-data">${formatMZN(duty)}</td>
            <td class="cell-data">${formatMZN(freight)}</td>
            <td class="cell-data font-normal">${formatMZN(diff)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Subtotal
    footer.innerHTML += `
        <tr class="h-8"><td></td><td></td><td></td><td></td></tr>
        <tr class="font-normal bg-slate-50 text-[0.75rem]">
            <td class="text-center uppercase py-4">Total Bruto</td>
            <td class="text-center">${formatMZN(totalDuty)}</td>
            <td class="text-center">${formatMZN(totalFreight)}</td>
            <td class="text-center">${formatMZN(totalLiability)}</td>
        </tr>
    `;

    // Linhas de Pagamento e Saídas (as mesmas do sistema, para ter paridade total)
    let netPayments = 0;
    if (state.balanceRecords && state.balanceRecords.length > 0) {
        state.balanceRecords.forEach((p, idx) => {
            const rawAmount = parseFloat(p.amount) || 0;
            const isSaida = p.type === 'SAIDA' || p.type === 'REFUND' || rawAmount < 0;
            const absAmount = Math.abs(rawAmount);

            if (isSaida) {
                netPayments -= absAmount;
            } else {
                netPayments += absAmount;
            }

            const dateFormatted = p.payment_date ? new Date(p.payment_date).toLocaleDateString('pt-PT') : '—';
            const label = isSaida ? `Saída / Devolução ${idx + 1}` : `Paid ${idx + 1}`;
            const rowClass = isSaida ? 'refund-row-style' : 'paid-row-style';
            const textClass = isSaida ? 'text-amber-800' : 'text-green-800';
            const noteText = p.note ? ` • ${p.note}` : '';
            const descText = isSaida 
                ? `Saída de Caixa (Devolução/Credor) em ${dateFormatted}${noteText}` 
                : `Liquidação via Caixa em ${dateFormatted}${noteText}`;

            footer.innerHTML += `
                <tr class="${rowClass}">
                    <td class="text-center uppercase font-normal py-3 border-r-0">${label}</td>
                    <td colspan="2" class="text-right italic pr-4 text-[9px] border-l-0">${descText}</td>
                    <td class="text-center font-normal ${textClass}">${isSaida ? `+${formatMZN(absAmount)}` : `(${formatMZN(absAmount)})`}</td>
                </tr>
            `;
        });
    }

    const currentBalance = totalLiability - netPayments;
    state.activeBalance = currentBalance;

    // Linha de Balanço Final
    const isCredit = currentBalance < 0;
    footer.innerHTML += `
        <tr class="balance-row ${isCredit ? 'balance-credit' : ''}">
            <td class="uppercase py-4">Balance</td>
            <td colspan="2" class="text-right text-[9px] pr-4 italic font-normal text-slate-700">
                ${isCredit ? 'Crédito Disponível (Excedente)' : 'Saldo Pendente (A Liquidar)'}
            </td>
            <td class="text-center font-normal">${formatMZN(currentBalance)}</td>
        </tr>
    `;
}

/**
 * Atualiza os botões e barras da UI conforme o modo OLD ou NEW e a política da tabela
 */
export function updateBillModeUI(mode, policy = null) {
    const switchWrapper = document.getElementById('bill-mode-switch-wrapper');
    const btnOld = document.getElementById('btn-bill-mode-old');
    const btnNew = document.getElementById('btn-bill-mode-new');
    const btnRefresh = document.getElementById('btn-bill-refresh');
    const tableActions = document.getElementById('table-actions');
    const syncLoader = document.getElementById('bill-sync-loader');

    const effectivePolicy = policy || mode;

    if (effectivePolicy === 'NEW') {
        // Tabela de Actualização Automática (BILL >= 68 ou Nacala >= 2):
        // Remove botão de Actualização Automática e Modo Manual, mantendo unicamente o botão Actualizar
        if (switchWrapper) switchWrapper.classList.add('hidden');
        if (btnOld) btnOld.classList.add('hidden');
        if (btnNew) btnNew.classList.add('hidden');
        if (btnRefresh) btnRefresh.classList.remove('hidden');
    } else {
        // Tabela Antiga / Manual (BILL < 68 ou Nacala < 2):
        // Oculta botão Actualizar e botão Actualização Automática, exibe Modo Manual
        if (btnRefresh) btnRefresh.classList.add('hidden');
        if (btnNew) btnNew.classList.add('hidden');
        if (syncLoader) syncLoader.classList.add('hidden');
        if (switchWrapper) switchWrapper.classList.remove('hidden');
        if (btnOld) {
            btnOld.classList.remove('hidden');
            btnOld.className = "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 bg-gray-800 text-white shadow-sm";
            btnOld.innerText = "Modo Manual";
        }
    }

    // Botões de ação (+ Contentor e Quitar Balanço) disponíveis em ambos os modos
    if (tableActions) tableActions.classList.remove('hidden');
}

// --- MÓDULO FINANCE (UI) ---

/**
 * Renderiza o Seletor de Modo de Visualização do Finance
 */

/**
 * Retorna o indicador visual (ícone) de ordenação de uma coluna
 */
function getSortIndicator(field) {
    const currentField = state.finance.sortField || 'default';
    const currentDir = state.finance.sortDirection || 'asc';

    if (currentField !== field) {
        return '<span class="inline-block ml-1 opacity-25 text-[8px] transition-opacity group-hover:opacity-80">↕</span>';
    }
    if (currentDir === 'desc') {
        return '<span class="inline-block ml-1 text-blue-600 font-black text-[9px]">▼</span>';
    }
    return '<span class="inline-block ml-1 text-blue-600 font-black text-[9px]">▲</span>';
}

/**
 * Ordena as folhas/projetos de acordo com o campo e direção configurados
 */
export function sortFinanceSheets(sheets) {
    if (!sheets || sheets.length <= 1) return sheets ? [...sheets] : [];

    const field = state.finance.sortField || 'default';
    const direction = state.finance.sortDirection || 'asc';

    if (field === 'default') return [...sheets];

    const sorted = [...sheets];
    const modifier = direction === 'desc' ? -1 : 1;
    const groupMap = new Map((state.finance.groups || []).map(g => [g.id, g.name]));

    sorted.sort((a, b) => {
        // Regra especial: Pendentes no topo (Saldo > 0 primeiro)
        if (field === 'pending_first') {
            const aPending = (a.balance || 0) > 0 ? 1 : 0;
            const bPending = (b.balance || 0) > 0 ? 1 : 0;
            if (aPending !== bPending) return bPending - aPending;
            return ((b.balance || 0) - (a.balance || 0)) * modifier;
        }

        // Regra especial: Liquidados no topo (Saldo <= 0 primeiro)
        if (field === 'settled_first') {
            const aSettled = (a.balance || 0) <= 0 ? 1 : 0;
            const bSettled = (b.balance || 0) <= 0 ? 1 : 0;
            if (aSettled !== bSettled) return bSettled - aSettled;
            return ((a.balance || 0) - (b.balance || 0)) * modifier;
        }

        // Ordenação por Grupo / Lote
        if (field === 'group') {
            const nameA = a.groupId && groupMap.has(a.groupId) ? groupMap.get(a.groupId) : 'Sem Grupo';
            const nameB = b.groupId && groupMap.has(b.groupId) ? groupMap.get(b.groupId) : 'Sem Grupo';
            const cmp = nameA.localeCompare(nameB, 'pt', { numeric: true, sensitivity: 'base' });
            if (cmp !== 0) return cmp * modifier;
            return String(a.title || '').localeCompare(String(b.title || ''), 'pt', { numeric: true });
        }

        // Ordenação por Documento / Nome
        if (field === 'title') {
            const strA = String(a.title || '').toLowerCase();
            const strB = String(b.title || '').toLowerCase();
            return strA.localeCompare(strB, 'pt', { numeric: true, sensitivity: 'base' }) * modifier;
        }

        // Ordenação por campos numéricos: dutyPrepaid, amountDuty, paid, balance
        if (['dutyPrepaid', 'amountDuty', 'paid', 'balance'].includes(field)) {
            const numA = Number(a[field]) || 0;
            const numB = Number(b[field]) || 0;
            if (numA !== numB) {
                return (numA - numB) * modifier;
            }
            return String(a.title || '').localeCompare(String(b.title || ''), 'pt', { numeric: true });
        }

        return 0;
    });

    return sorted;
}

export function renderFinanceViewSwitcher(sheets) {
    const container = document.getElementById('finance-view-switcher');
    if (!container) return;

    const currentMode = state.finance.viewMode || 'groups';
    const totalCount = (sheets || []).length;
    const selectedCount = state.finance.selectedSheets ? state.finance.selectedSheets.size : 0;
    const currentSortField = state.finance.sortField || 'default';
    const currentSortDir = state.finance.sortDirection || 'asc';

    let currentPreset = 'default';
    if (currentSortField === 'pending_first' || currentSortField === 'settled_first') {
        currentPreset = currentSortField;
    } else if (currentSortField !== 'default') {
        currentPreset = `${currentSortField}_${currentSortDir}`;
    }

    const getBtnClass = (mode) => {
        const isActive = currentMode === mode;
        if (isActive) {
            return "bg-slate-900 text-white border-slate-900 font-black shadow-sm ring-1 ring-slate-900";
        }
        return "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-300 font-bold";
    };

    const isCustomSort = currentSortField !== 'default';

    container.innerHTML = `
        <div class="space-y-2.5">
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-slate-100/90 border border-slate-300/80 rounded-2xl shadow-sm">
                <div class="flex items-center gap-1.5 overflow-x-auto p-0.5">
                    <button onclick="window.setFinanceViewMode('groups')" class="px-3 py-1.5 text-[10px] uppercase rounded-xl border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${getBtnClass('groups')}" title="Visualizar agrupado por lotes/pastas">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        <span>Por Grupos</span>
                    </button>
                    <button onclick="window.setFinanceViewMode('all')" class="px-3 py-1.5 text-[10px] uppercase rounded-xl border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${getBtnClass('all')}" title="Visualizar todas as listas numa tabela única">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        <span>Tabela Única (Todas)</span>
                        <span class="px-1.5 py-0.2 text-[9px] font-black rounded-full ${currentMode === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}">${totalCount}</span>
                    </button>
                    <button onclick="window.setFinanceViewMode('selected')" class="px-3 py-1.5 text-[10px] uppercase rounded-xl border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${getBtnClass('selected')}" title="Visualizar apenas as listas que foram marcadas com checkbox">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                        <span>Tabela Única (Marcadas)</span>
                        <span class="px-1.5 py-0.2 text-[9px] font-black rounded-full ${currentMode === 'selected' ? 'bg-white/20 text-white' : (selectedCount > 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700')}">${selectedCount}</span>
                    </button>
                </div>
                <div class="flex items-center gap-1 self-end sm:self-auto px-1">
                    <button onclick="window.toggleSelectAllFinanceSheets(true)" class="px-2.5 py-1 text-[9px] font-bold uppercase text-slate-600 hover:text-black hover:bg-slate-200/80 rounded-lg transition-all cursor-pointer" title="Marcar todas as listas">
                        Marcar Todas
                    </button>
                    <span class="text-slate-300">|</span>
                    <button onclick="window.toggleSelectAllFinanceSheets(false)" class="px-2.5 py-1 text-[9px] font-bold uppercase text-slate-600 hover:text-black hover:bg-slate-200/80 rounded-lg transition-all cursor-pointer" title="Desmarcar todas as listas">
                        Desmarcar
                    </button>
                </div>
            </div>

            <!-- Barra de Ordenação e Regras de Organização -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-3.5 py-2 bg-white border border-slate-300/80 rounded-xl shadow-xs">
                <div class="flex items-center gap-2 flex-wrap">
                    <div class="flex items-center gap-1.5 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>
                        <span class="text-[9px] font-black uppercase tracking-wider text-slate-600 whitespace-nowrap">Organizar itens:</span>
                    </div>
                    <select onchange="window.setFinanceSortPreset(this.value)" class="text-[10px] font-bold uppercase bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-900 outline-none focus:border-black cursor-pointer transition-all hover:bg-slate-100">
                        <option value="default" ${currentPreset === 'default' ? 'selected' : ''}>Ordem Padrão (Original)</option>
                        <optgroup label="Alfabética / Documento">
                            <option value="title_asc" ${currentPreset === 'title_asc' ? 'selected' : ''}>Documento (A → Z)</option>
                            <option value="title_desc" ${currentPreset === 'title_desc' ? 'selected' : ''}>Documento (Z → A)</option>
                        </optgroup>
                        <optgroup label="Balanço & Saldo">
                            <option value="balance_desc" ${currentPreset === 'balance_desc' ? 'selected' : ''}>Maior Saldo Devedor (Decrescente)</option>
                            <option value="balance_asc" ${currentPreset === 'balance_asc' ? 'selected' : ''}>Menor Saldo (Crescente)</option>
                            <option value="pending_first" ${currentPreset === 'pending_first' ? 'selected' : ''}>Pendentes no Topo (Saldo &gt; 0 primeiro)</option>
                            <option value="settled_first" ${currentPreset === 'settled_first' ? 'selected' : ''}>Liquidados no Topo (Saldo &le; 0 primeiro)</option>
                        </optgroup>
                        <optgroup label="Valores / Dever">
                            <option value="amountDuty_desc" ${currentPreset === 'amountDuty_desc' ? 'selected' : ''}>Maior Dever / Amount (Decrescente)</option>
                            <option value="amountDuty_asc" ${currentPreset === 'amountDuty_asc' ? 'selected' : ''}>Menor Dever / Amount (Crescente)</option>
                        </optgroup>
                        <optgroup label="Pagamentos Liquidados">
                            <option value="paid_desc" ${currentPreset === 'paid_desc' ? 'selected' : ''}>Maior Valor Pago (Decrescente)</option>
                            <option value="paid_asc" ${currentPreset === 'paid_asc' ? 'selected' : ''}>Menor Valor Pago (Crescente)</option>
                        </optgroup>
                        <optgroup label="Duty Prepaid">
                            <option value="dutyPrepaid_desc" ${currentPreset === 'dutyPrepaid_desc' ? 'selected' : ''}>Maior Duty Prepaid</option>
                            <option value="dutyPrepaid_asc" ${currentPreset === 'dutyPrepaid_asc' ? 'selected' : ''}>Menor Duty Prepaid</option>
                        </optgroup>
                    </select>

                    ${isCustomSort ? `
                    <button onclick="window.toggleFinanceSortDirection()" class="px-2 py-1 text-[9px] font-black uppercase rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all flex items-center gap-1 cursor-pointer" title="Inverter direção da ordenação">
                        <span>${currentSortDir === 'desc' ? 'Decrescente ▼' : 'Crescente ▲'}</span>
                    </button>
                    <button onclick="window.resetFinanceSort()" class="px-2 py-1 text-[9px] font-bold uppercase rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer" title="Restaurar ordem original">
                        Limpar Ordem
                    </button>
                    ` : ''}
                </div>

                <div class="text-[9px] text-slate-400 font-semibold self-end sm:self-auto hidden md:block">
                    Dica: Pode também clicar nos cabeçalhos das colunas (▲/▼)
                </div>
            </div>
        </div>
    `;
}

/**
 * Renderiza o Dashboard Financeiro completo
 */
export function renderFinanceDashboard(onDeleteGroup, onRemoveSheet, onMoveSheet, onRenameGroup) {
    const list = document.getElementById('finance-content');
    if (!list) return;
    list.innerHTML = '';

    const groups = state.finance.groups;
    const sheets = state.finance.sheets;
    const viewMode = state.finance.viewMode || 'groups';

    // Sempre renderizar o seletor de visualização (abaixo do sumário)
    renderFinanceViewSwitcher(sheets);

    // Controle de visibilidade do botão Expandir/Recolher grupos no cabeçalho
    const toggleAllBtn = document.getElementById('btn-finance-toggle-all');
    if (toggleAllBtn) {
        if (viewMode === 'groups') {
            toggleAllBtn.classList.remove('hidden');
        } else {
            toggleAllBtn.classList.add('hidden');
        }
    }

    if (groups.length === 0 && sheets.length === 0) {
        list.innerHTML = '<div class="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl uppercase font-black text-gray-300 tracking-tighter text-lg">Nenhum dado consolidado</div>';
        renderFinanceSummary([]);
        updateFinanceBulkBar();
        return;
    }

    if (viewMode === 'all') {
        // Tabela Única com todas as folhas
        list.appendChild(createUnifiedFinanceTable(sheets, onRemoveSheet, false));
        renderFinanceSummary(sheets);
    } else if (viewMode === 'selected') {
        // Tabela Única apenas com as folhas marcadas
        const selectedSheets = sheets.filter(s => state.finance.selectedSheets && state.finance.selectedSheets.has(s.id));
        list.appendChild(createUnifiedFinanceTable(selectedSheets, onRemoveSheet, true));
        renderFinanceSummary(selectedSheets);
    } else {
        // Modo Padrão: Por Grupos
        const validGroupIds = new Set(groups.map(g => g.id));

        // Renderizar grupos normais
        groups.forEach(group => {
            const groupSheets = sheets.filter(s => s.groupId === group.id);
            list.appendChild(createFinanceGroupSection(group, groupSheets, onDeleteGroup, onRemoveSheet, onRenameGroup, false));
        });

        // Renderizar folhas sem grupo (ou cujo grupo associado já não existe)
        const ungrouped = sheets.filter(s => !s.groupId || !validGroupIds.has(s.groupId));
        if (ungrouped.length > 0) {
            const ungroupedGroup = { id: 'ungrouped', name: 'Folhas Sem Grupo' };
            list.appendChild(createFinanceGroupSection(ungroupedGroup, ungrouped, null, onRemoveSheet, null, true));
        }

        renderFinanceSummary(sheets);

        // Atualizar texto do botão global de expandir/recolher
        const toggleAllBtnText = document.getElementById('btn-finance-toggle-all-text');
        if (toggleAllBtnText) {
            const allIds = [...groups.map(g => g.id), 'ungrouped'];
            const allExpanded = allIds.length > 0 && allIds.every(id => state.finance.expandedGroups.has(id));
            toggleAllBtnText.innerText = allExpanded ? 'Recolher Todos' : 'Expandir Todos';
        }
    }

    updateFinanceBulkBar();
}

function createFinanceGroupSection(group, sheets, onDelete, onRemoveSheet, onRename, isUngrouped = false) {
    const section = document.createElement('div');
    const isCollapsed = !state.finance.expandedGroups.has(group.id);
    section.className = isCollapsed ? "mb-1.5 max-w-4xl mx-auto" : "mb-6 max-w-4xl mx-auto";

    // Totais do grupo para exibição resumida quando colapsado
    const groupTotals = sheets.reduce((acc, s) => {
        acc.dutyPrepaid += (s.dutyPrepaid || 0);
        acc.amountDuty += (s.amountDuty || 0);
        acc.paid += (s.paid || 0);
        acc.balance += (s.balance || 0);
        return acc;
    }, { dutyPrepaid: 0, amountDuty: 0, paid: 0, balance: 0 });

    const moveButtons = !isUngrouped ? `
        <div class="flex items-center gap-0.5 mr-1" onclick="event.stopPropagation()">
            <button onclick="window.moveFinanceGroup('${group.id}', 'up')" class="p-1 text-slate-300 hover:text-slate-900 transition-all rounded" title="Mover grupo para cima">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
            <button onclick="window.moveFinanceGroup('${group.id}', 'down')" class="p-1 text-slate-300 hover:text-slate-900 transition-all rounded" title="Mover grupo para baixo">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
        </div>
    ` : '';

    const actionButtons = `
        <button onclick="window.printFinanceGroup('${group.id}')" class="text-[9px] font-black uppercase text-slate-500 hover:text-slate-900 transition-all flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-300/40" title="Imprimir lista e valores deste grupo">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Imprimir
        </button>
        ${(!isUngrouped && !isCollapsed) ? `
        <button onclick="window.renameFinanceGroup('${group.id}')" class="text-[9px] font-black uppercase text-slate-400 hover:text-slate-900 transition-all">Renomear</button>
        <button onclick="window.deleteFinanceGroup('${group.id}')" class="text-[9px] font-black uppercase text-red-500/40 hover:text-red-500 transition-all">Remover</button>
        ` : ''}
    `;

    const headerClass = "flex flex-col md:flex-row justify-between items-start md:items-center gap-2 px-2 py-2 cursor-pointer select-none rounded-xl hover:bg-slate-200/50 transition-all mb-1";

    section.innerHTML = `
        <div class="${headerClass}" onclick="window.toggleFinanceGroupCollapse('${group.id}')">
            <div class="flex items-center gap-3 select-none group flex-wrap flex-1">
                ${moveButtons}
                <div class="flex items-center gap-2">
                    <h3 class="text-sm font-black uppercase tracking-tight text-slate-900">${group.name}</h3>
                    <span class="text-[9px] bg-slate-200/80 border border-slate-300/60 px-2 py-0.5 rounded font-bold uppercase text-slate-600">${sheets.length} Itens</span>
                </div>
                ${isCollapsed ? `
                <div class="flex items-center gap-2.5 text-[9px] font-bold uppercase text-slate-500 bg-slate-200/65 border border-slate-300/50 px-2.5 py-1 rounded-lg ml-1">
                    <span>Dever: <strong class="text-slate-900">${formatMZN(groupTotals.amountDuty)}</strong></span>
                    <span class="text-slate-300">•</span>
                    <span>Pago: <strong class="text-green-700">${formatMZN(groupTotals.paid)}</strong></span>
                    <span class="text-slate-300">•</span>
                    <span>Saldo: <strong class="${groupTotals.balance > 0 ? 'text-red-700' : 'text-blue-700'}">${formatMZN(groupTotals.balance)}</strong></span>
                </div>
                ` : ''}
            </div>
            <div class="flex items-center gap-3 ml-auto md:ml-0" onclick="event.stopPropagation()">
                ${actionButtons}
            </div>
        </div>
    `;

    const tableContainer = createFinanceTable(sheets, onRemoveSheet, group.id);
    if (isCollapsed) {
        tableContainer.classList.add('hidden');
    }
    tableContainer.id = `finance-group-table-${group.id}`;
    section.appendChild(tableContainer);

    return section;
}

function createFinanceTable(sheets, onRemove, groupId = '') {
    const tableContainer = document.createElement('div');
    tableContainer.className = "bg-white border border-slate-700 rounded-lg overflow-hidden shadow-[3px_3px_0px_0px_rgba(15,23,42,0.1)] transition-all";

    if (sheets.length === 0) {
        tableContainer.innerHTML = '<div class="p-6 text-center text-slate-300 uppercase font-black text-[9px] tracking-widest italic">Vazio - Selecione folhas e aloque para este grupo</div>';
        return tableContainer;
    }

    const allInGroupSelected = sheets.length > 0 && sheets.every(s => state.finance.selectedSheets && state.finance.selectedSheets.has(s.id));
    const sortedSheets = sortFinanceSheets(sheets);

    const table = document.createElement('table');
    table.className = "w-full text-left border-collapse";

    table.innerHTML = `
        <thead>
            <tr class="bg-slate-50 text-[9px] font-normal uppercase tracking-widest text-slate-500 border-b border-slate-700 select-none">
                <th class="py-2 px-3 w-10 text-center">
                    <input type="checkbox" id="chk-group-${groupId}" ${allInGroupSelected ? 'checked' : ''} onchange="window.toggleSelectAllFinanceGroup('${groupId}', this.checked)" class="w-3.5 h-3.5 rounded border-gray-300 text-black focus:ring-black cursor-pointer align-middle" title="Selecionar todas as folhas deste grupo">
                </th>
                <th onclick="window.setFinanceSort('title')" class="py-2 px-3 cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Documento (A-Z / Z-A)">
                    <div class="flex items-center gap-1">
                        <span>Documento</span>
                        ${getSortIndicator('title')}
                    </div>
                </th>
                <th onclick="window.setFinanceSort('dutyPrepaid')" class="py-2 px-3 text-center cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Duty Prepaid">
                    <div class="flex items-center justify-center gap-1">
                        <span>Duty Prep</span>
                        ${getSortIndicator('dutyPrepaid')}
                    </div>
                </th>
                <th onclick="window.setFinanceSort('amountDuty')" class="py-2 px-3 text-center cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Amount (Dever)">
                    <div class="flex items-center justify-center gap-1">
                        <span>Amount</span>
                        ${getSortIndicator('amountDuty')}
                    </div>
                </th>
                <th onclick="window.setFinanceSort('paid')" class="py-2 px-3 text-center cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Valor Pago (Liquidado)">
                    <div class="flex items-center justify-center gap-1">
                        <span>Paid</span>
                        ${getSortIndicator('paid')}
                    </div>
                </th>
                <th onclick="window.setFinanceSort('balance')" class="py-2 px-3 text-center cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Saldo (Balanço)">
                    <div class="flex items-center justify-center gap-1">
                        <span>Balance</span>
                        ${getSortIndicator('balance')}
                    </div>
                </th>
                <th class="py-2 px-3 text-right w-10"></th>
            </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
            ${sortedSheets.map(s => {
                const isSelected = state.finance.selectedSheets && state.finance.selectedSheets.has(s.id);
                return `
                <tr class="group hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/70' : ''}" id="finance-row-${s.id}">
                    <td class="py-1 px-3 text-center">
                        <input type="checkbox" data-sheet-id="${s.id}" ${isSelected ? 'checked' : ''} onchange="window.toggleFinanceSheetSelect('${s.id}', this.checked)" class="finance-sheet-checkbox w-3.5 h-3.5 rounded border-gray-300 text-black focus:ring-black cursor-pointer align-middle">
                    </td>
                    <td class="py-1 px-3">
                        <span onclick="window.selectConfirmProject('${s.sheetId}', '${s.folderId || ''}', '${(s.title || '').replace(/'/g, "\\'")}')" class="font-bold text-[10px] uppercase text-gray-900 leading-tight cursor-pointer hover:text-blue-600 transition-colors" title="Abrir grelha operacional no módulo Confirm">
                            ${s.title}
                        </span>
                    </td>
                    <td class="py-1 px-3 text-center font-normal text-[10px] text-gray-600">${formatMZN(s.dutyPrepaid)}</td>
                    <td class="py-1 px-3 text-center font-normal text-[10px] text-gray-900">${formatMZN(s.amountDuty)}</td>
                    <td class="py-1 px-3 text-center font-normal text-[10px] text-green-700">${formatMZN(s.paid)}</td>
                    <td class="py-1 px-3 text-center font-normal text-[10px] ${s.balance > 0 ? 'text-red-700' : 'text-blue-700'}">${formatMZN(s.balance)}</td>
                    <td class="py-1 px-3 text-right">
                        <button onclick="window.removeFinanceSheet('${s.id}')" class="text-gray-200 hover:text-red-600 transition-all" title="Ocultar folha do painel financeiro">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                    </td>
                </tr>
                `;
            }).join('')}
        </tbody>
        <tfoot class="bg-slate-700 text-white font-black text-[9px] uppercase">
            <tr>
                <td class="py-2 px-3"></td>
                <td class="py-2 px-3">Consolidado</td>
                <td class="py-2 px-3 text-center">${formatMZN(sheets.reduce((a, b) => a + (b.dutyPrepaid || 0), 0))}</td>
                <td class="py-2 px-3 text-center">${formatMZN(sheets.reduce((a, b) => a + (b.amountDuty || 0), 0))}</td>
                <td class="py-2 px-3 text-center text-green-300">${formatMZN(sheets.reduce((a, b) => a + (b.paid || 0), 0))}</td>
                <td class="py-2 px-3 text-center ${sheets.reduce((a, b) => a + (b.balance || 0), 0) > 0 ? 'text-red-300' : 'text-blue-200'}">
                    ${formatMZN(sheets.reduce((a, b) => a + (b.balance || 0), 0))}
                </td>
                <td class="py-2 px-3"></td>
            </tr>
        </tfoot>
    `;

    tableContainer.appendChild(table);
    return tableContainer;
}

/**
 * Cria a Tabela Única de Finanças (Todas ou Marcadas)
 */
export function createUnifiedFinanceTable(sheets, onRemoveSheet, isSelectedOnly = false) {
    const tableContainer = document.createElement('div');
    tableContainer.className = "bg-white border border-slate-700 rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(15,23,42,0.8)] transition-all max-w-4xl mx-auto";

    if (sheets.length === 0) {
        if (isSelectedOnly) {
            tableContainer.innerHTML = `
                <div class="p-10 text-center">
                    <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    </div>
                    <h4 class="text-xs font-black uppercase text-slate-800 mb-1">Nenhuma lista marcada</h4>
                    <p class="text-[10px] text-slate-500 max-w-md mx-auto mb-4">Marque as caixas de seleção das listas para visualizá-las aqui ou visualize todas as listas de uma vez.</p>
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="window.toggleSelectAllFinanceSheets(true)" class="px-3 py-1.5 bg-black text-white text-[10px] font-bold uppercase rounded-xl hover:bg-slate-800 transition-all cursor-pointer">
                            Marcar Todas as Listas
                        </button>
                        <button onclick="window.setFinanceViewMode('all')" class="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-[10px] font-bold uppercase rounded-xl hover:bg-slate-50 transition-all cursor-pointer">
                            Ver Tabela Completa
                        </button>
                    </div>
                </div>
            `;
            return tableContainer;
        }
        tableContainer.innerHTML = '<div class="p-8 text-center text-slate-400 uppercase font-black text-[10px] tracking-widest">Nenhum dado consolidado</div>';
        return tableContainer;
    }

    const allInTableSelected = sheets.length > 0 && sheets.every(s => state.finance.selectedSheets && state.finance.selectedSheets.has(s.id));
    const groupMap = new Map((state.finance.groups || []).map(g => [g.id, g.name]));
    const sortedSheets = sortFinanceSheets(sheets);

    const topBar = document.createElement('div');
    topBar.className = "flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-700";
    topBar.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-800">
                ${isSelectedOnly ? 'Tabela Consolidada (Listas Marcadas)' : 'Tabela Consolidada (Todas as Listas)'}
            </span>
            <span class="px-2 py-0.5 text-[9px] font-black rounded-full bg-slate-200 text-slate-700">${sheets.length}</span>
        </div>
        <button onclick="window.printUnifiedFinanceTable()" class="px-2.5 py-1 text-[9px] font-black uppercase bg-white border border-slate-300 text-slate-700 hover:text-black hover:border-black rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer" title="Imprimir ou exportar em PDF esta tabela">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Imprimir Tabela
        </button>
    `;
    tableContainer.appendChild(topBar);

    const table = document.createElement('table');
    table.className = "w-full text-left border-collapse";

    table.innerHTML = `
        <thead>
            <tr class="bg-slate-50 text-[9px] font-normal uppercase tracking-widest text-slate-500 border-b border-slate-700 select-none">
                <th class="py-2.5 px-3 w-10 text-center">
                    <input type="checkbox" id="chk-unified-all" ${allInTableSelected ? 'checked' : ''} onchange="window.toggleSelectAllUnifiedSheets(this.checked)" class="w-3.5 h-3.5 rounded border-gray-300 text-black focus:ring-black cursor-pointer align-middle" title="Marcar ou desmarcar todas">
                </th>
                <th onclick="window.setFinanceSort('title')" class="py-2.5 px-3 cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Documento / Nome">
                    <div class="flex items-center gap-1">
                        <span>Documento / Lista</span>
                        ${getSortIndicator('title')}
                    </div>
                </th>
                <th onclick="window.setFinanceSort('group')" class="py-2.5 px-3 cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Grupo / Lote">
                    <div class="flex items-center gap-1">
                        <span>Grupo / Lote</span>
                        ${getSortIndicator('group')}
                    </div>
                </th>
                <th onclick="window.setFinanceSort('dutyPrepaid')" class="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Duty Prepaid">
                    <div class="flex items-center justify-center gap-1">
                        <span>Duty Prep</span>
                        ${getSortIndicator('dutyPrepaid')}
                    </div>
                </th>
                <th onclick="window.setFinanceSort('amountDuty')" class="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Amount (Dever)">
                    <div class="flex items-center justify-center gap-1">
                        <span>Amount</span>
                        ${getSortIndicator('amountDuty')}
                    </div>
                </th>
                <th onclick="window.setFinanceSort('paid')" class="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Valor Pago (Liquidado)">
                    <div class="flex items-center justify-center gap-1">
                        <span>Paid</span>
                        ${getSortIndicator('paid')}
                    </div>
                </th>
                <th onclick="window.setFinanceSort('balance')" class="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200/60 transition-colors group" title="Ordenar por Saldo (Balanço)">
                    <div class="flex items-center justify-center gap-1">
                        <span>Balance</span>
                        ${getSortIndicator('balance')}
                    </div>
                </th>
                <th class="py-2.5 px-3 text-right w-10"></th>
            </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
            ${sortedSheets.map(s => {
                const isSelected = state.finance.selectedSheets && state.finance.selectedSheets.has(s.id);
                const groupName = s.groupId && groupMap.has(s.groupId) ? groupMap.get(s.groupId) : 'Sem Grupo';
                return `
                <tr class="group hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/70' : ''}" id="finance-unified-row-${s.id}">
                    <td class="py-1.5 px-3 text-center">
                        <input type="checkbox" data-sheet-id="${s.id}" ${isSelected ? 'checked' : ''} onchange="window.toggleFinanceSheetSelect('${s.id}', this.checked)" class="finance-sheet-checkbox w-3.5 h-3.5 rounded border-gray-300 text-black focus:ring-black cursor-pointer align-middle">
                    </td>
                    <td class="py-1.5 px-3">
                        <span onclick="window.selectConfirmProject('${s.sheetId}', '${s.folderId || ''}', '${(s.title || '').replace(/'/g, "\\'")}')" class="font-bold text-[10px] uppercase text-gray-900 leading-tight cursor-pointer hover:text-blue-600 transition-colors" title="Abrir grelha operacional no módulo Confirm">
                            ${s.title}
                        </span>
                    </td>
                    <td class="py-1.5 px-3">
                        <span class="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase whitespace-nowrap">
                            ${groupName}
                        </span>
                    </td>
                    <td class="py-1.5 px-3 text-center font-normal text-[10px] text-gray-600">${formatMZN(s.dutyPrepaid)}</td>
                    <td class="py-1.5 px-3 text-center font-normal text-[10px] text-gray-900">${formatMZN(s.amountDuty)}</td>
                    <td class="py-1.5 px-3 text-center font-normal text-[10px] text-green-700 font-semibold">${formatMZN(s.paid)}</td>
                    <td class="py-1.5 px-3 text-center font-normal text-[10px] font-semibold ${s.balance > 0 ? 'text-red-700' : 'text-blue-700'}">${formatMZN(s.balance)}</td>
                    <td class="py-1.5 px-3 text-right">
                        <button onclick="window.removeFinanceSheet('${s.id}')" class="text-gray-300 hover:text-red-600 transition-all cursor-pointer" title="Ocultar folha do painel financeiro">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                    </td>
                </tr>
                `;
            }).join('')}
        </tbody>
        <tfoot class="bg-slate-700 text-white font-black text-[9px] uppercase">
            <tr>
                <td class="py-2.5 px-3"></td>
                <td class="py-2.5 px-3" colspan="2">Consolidado (${sheets.length} ${sheets.length === 1 ? 'lista' : 'listas'})</td>
                <td class="py-2.5 px-3 text-center">${formatMZN(sheets.reduce((a, b) => a + (b.dutyPrepaid || 0), 0))}</td>
                <td class="py-2.5 px-3 text-center">${formatMZN(sheets.reduce((a, b) => a + (b.amountDuty || 0), 0))}</td>
                <td class="py-2.5 px-3 text-center text-green-300">${formatMZN(sheets.reduce((a, b) => a + (b.paid || 0), 0))}</td>
                <td class="py-2.5 px-3 text-center ${sheets.reduce((a, b) => a + (b.balance || 0), 0) > 0 ? 'text-red-300' : 'text-blue-200'}">
                    ${formatMZN(sheets.reduce((a, b) => a + (b.balance || 0), 0))}
                </td>
                <td class="py-2.5 px-3"></td>
            </tr>
        </tfoot>
    `;

    tableContainer.appendChild(table);
    return tableContainer;
}

export function updateFinanceBulkBar() {
    const bar = document.getElementById('finance-bulk-bar');
    if (!bar) return;

    const count = state.finance.selectedSheets ? state.finance.selectedSheets.size : 0;
    if (count > 0) {
        bar.classList.remove('hidden');
        const countEl = document.getElementById('finance-bulk-count');
        if (countEl) countEl.innerText = count;

        const selectEl = document.getElementById('finance-bulk-target-group');
        if (selectEl) {
            const currentVal = selectEl.value;
            selectEl.innerHTML = `
                <option value="">Sem Grupo (Desagrupar)</option>
                ${state.finance.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
            `;
            if (currentVal) selectEl.value = currentVal;
        }
    } else {
        bar.classList.add('hidden');
    }

    // Mantém os badges do seletor de visualização sincronizados
    if (document.getElementById('finance-view-switcher') && state.finance.sheets) {
        renderFinanceViewSwitcher(state.finance.sheets);
    }
}

export function renderFinanceSummary(sheets) {
    const el = document.getElementById('finance-summary');
    if (!el) return;

    const totals = (sheets || []).reduce((acc, s) => {
        acc.duty += (s.amountDuty || 0);
        acc.paid += (s.paid || 0);
        acc.balance += (s.balance || 0);
        return acc;
    }, { duty: 0, paid: 0, balance: 0 });

    const isSelectedMode = state.finance.viewMode === 'selected';
    const tag = isSelectedMode ? ` <span class="text-blue-600 font-bold">(${sheets.length} marcadas)</span>` : '';

    el.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white border border-slate-700 p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(15,23,42,0.8)]">
                <p class="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Dever Consolidado${tag}</p>
                <p class="text-lg font-black text-slate-900">${formatMZN(totals.duty)}</p>
            </div>
            <div class="bg-white border border-slate-700 p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(34,197,94,0.6)]">
                <p class="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Liquidado${tag}</p>
                <p class="text-lg font-black text-green-600">${formatMZN(totals.paid)}</p>
            </div>
            <div class="bg-slate-700 border border-slate-700 p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(15,23,42,0.3)]">
                <p class="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Balanço Global${tag}</p>
                <p class="text-lg font-black text-white">${formatMZN(totals.balance)}</p>
            </div>
        </div>
    `;
}



/**
 * Gera e dispara a impressão de uma lista/tabela de finanças
 */
function renderAndTriggerFinancePrint(reportTitle, sheets, showGroupCol = false) {
    const totals = (sheets || []).reduce((acc, s) => {
        acc.dutyPrepaid += (s.dutyPrepaid || 0);
        acc.amountDuty += (s.amountDuty || 0);
        acc.paid += (s.paid || 0);
        acc.balance += (s.balance || 0);
        return acc;
    }, { dutyPrepaid: 0, amountDuty: 0, paid: 0, balance: 0 });

    const groupMap = new Map((state.finance.groups || []).map(g => [g.id, g.name]));
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-PT');
    const timeStr = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    const htmlContent = `<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <title>Relatório Financeiro - ${reportTitle}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm 12mm 14mm 12mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #f8fafc;
            margin: 0;
            padding: 20px;
        }
        @media print {
            body {
                background: #ffffff;
                padding: 0;
            }
            .no-print {
                display: none !important;
            }
            .container {
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                max-width: 100% !important;
            }
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 28px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06);
        }
        .header-bar {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }
        .brand-title {
            font-size: 20px;
            font-weight: 900;
            letter-spacing: -0.5px;
            text-transform: uppercase;
            margin: 0 0 6px 0;
            color: #0f172a;
        }
        .group-badge {
            display: inline-block;
            background: #0f172a;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 10px;
            border-radius: 6px;
            text-transform: uppercase;
        }
        .meta-info {
            text-align: right;
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
            line-height: 1.5;
        }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 22px;
        }
        .kpi-card {
            border: 1.5px solid #0f172a;
            border-radius: 8px;
            padding: 12px 14px;
            background: #ffffff;
        }
        .kpi-card.kpi-balance {
            background: #1e293b;
            color: #ffffff;
        }
        .kpi-label {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 3px;
        }
        .kpi-balance .kpi-label {
            color: #94a3b8;
        }
        .kpi-val {
            font-size: 16px;
            font-weight: 900;
            color: #0f172a;
        }
        .kpi-paid .kpi-val {
            color: #16a34a;
        }
        .kpi-balance .kpi-val {
            color: #ffffff;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 20px;
        }
        th {
            background: #f1f5f9;
            color: #334155;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 9px 10px;
            border-top: 1.5px solid #0f172a;
            border-bottom: 1.5px solid #0f172a;
            text-align: left;
        }
        td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
            vertical-align: middle;
        }
        tr:nth-child(even) td {
            background-color: #f8fafc;
        }
        tfoot td {
            background: #1e293b !important;
            color: #ffffff !important;
            font-weight: 900;
            font-size: 11px;
            text-transform: uppercase;
            border-top: 2px solid #0f172a;
            padding: 10px;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .footer-note {
            margin-top: 28px;
            padding-top: 14px;
            border-top: 1px dashed #cbd5e1;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
        }
        .sign-area {
            text-align: right;
            line-height: 2;
        }
    </style>
</head>
<body>
    <div class="no-print" style="position: sticky; top: 12px; z-index: 100; max-width: 900px; margin: 0 auto 16px auto; background: #0f172a; color: #ffffff; padding: 10px 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 16px rgba(0,0,0,0.2);">
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Pré-visualização de Impressão</span>
            <span style="font-size: 10px; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 9999px;">${sheets.length} itens</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <button onclick="window.print()" style="background: #ffffff; color: #0f172a; border: none; padding: 7px 16px; font-size: 11px; font-weight: 900; text-transform: uppercase; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Imprimir / Guardar PDF
            </button>
            <button onclick="window.close()" style="background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); padding: 7px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-radius: 8px; cursor: pointer;">
                Fechar
            </button>
        </div>
    </div>

    <div class="container">
        <div class="header-bar">
            <div>
                <h1 class="brand-title">RELATÓRIO FINANCEIRO</h1>
                <div class="group-badge">${reportTitle}</div>
            </div>
            <div class="meta-info">
                <div><strong>Data:</strong> ${dateStr} às ${timeStr}</div>
                <div><strong>Total:</strong> ${sheets.length} documento(s)</div>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Dever Consolidado</div>
                <div class="kpi-val">${formatMZN(totals.amountDuty)}</div>
            </div>
            <div class="kpi-card kpi-paid">
                <div class="kpi-label">Total Liquidado</div>
                <div class="kpi-val">${formatMZN(totals.paid)}</div>
            </div>
            <div class="kpi-card kpi-balance">
                <div class="kpi-label">Balanço Global</div>
                <div class="kpi-val">${formatMZN(totals.balance)}</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 35px; text-align: center;">#</th>
                    <th>Documento / Lista</th>
                    ${showGroupCol ? '<th style="width: 140px;">Grupo / Lote</th>' : ''}
                    <th style="width: 110px; text-align: center;">Duty Prep</th>
                    <th style="width: 110px; text-align: center;">Amount</th>
                    <th style="width: 110px; text-align: center;">Paid</th>
                    <th style="width: 110px; text-align: center;">Balance</th>
                </tr>
            </thead>
            <tbody>
                ${sheets.map((s, idx) => {
                    const groupBadge = showGroupCol 
                        ? `<td style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase;">${(s.groupId && groupMap.get(s.groupId)) || 'Sem Grupo'}</td>`
                        : '';
                    return `
                    <tr>
                        <td style="text-align: center; font-size: 10px; color: #64748b; font-weight: 700;">${idx + 1}</td>
                        <td style="font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase;">${s.title || 'Sem Título'}</td>
                        ${groupBadge}
                        <td style="text-align: center; font-size: 11px; color: #475569;">${formatMZN(s.dutyPrepaid)}</td>
                        <td style="text-align: center; font-size: 11px; font-weight: 700; color: #0f172a;">${formatMZN(s.amountDuty)}</td>
                        <td style="text-align: center; font-size: 11px; font-weight: 700; color: #16a34a;">${formatMZN(s.paid)}</td>
                        <td style="text-align: center; font-size: 11px; font-weight: 800; color: ${s.balance > 0 ? '#dc2626' : '#2563eb'};">${formatMZN(s.balance)}</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td style="text-align: center;"></td>
                    <td ${showGroupCol ? 'colspan="2"' : ''}>Consolidado (${sheets.length} ${sheets.length === 1 ? 'item' : 'itens'})</td>
                    <td style="text-align: center;">${formatMZN(totals.dutyPrepaid)}</td>
                    <td style="text-align: center;">${formatMZN(totals.amountDuty)}</td>
                    <td style="text-align: center; color: #86efac;">${formatMZN(totals.paid)}</td>
                    <td style="text-align: center; color: ${totals.balance > 0 ? '#fca5a5' : '#bfdbfe'};">${formatMZN(totals.balance)}</td>
                </tr>
            </tfoot>
        </table>

        <div class="footer-note">
            <div>
                Documento emitido automaticamente pelo módulo FINANCE.<br>
                BILL-CHECK &bull; Gestão Operacional e Financeira
            </div>
            <div class="sign-area">
                Conferido por: ___________________________________<br>
                Data: _____ / _____ / __________
            </div>
        </div>
    </div>

    <script>
        window.addEventListener('load', () => {
            setTimeout(() => {
                window.print();
            }, 350);
        });
    </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=960,height=900');
    if (!printWindow) {
        // Fallback por iframe invisível caso popups estejam bloqueados
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
            setTimeout(() => {
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            }, 2000);
        }, 500);
        return;
    }

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
}

/**
 * Imprime a lista completa e consolidação de um grupo específico
 */
export function printFinanceGroup(groupId) {
    const validGroupIds = new Set(state.finance.groups.map(g => g.id));
    let groupName = 'Folhas Sem Grupo';
    let sheets = [];

    if (groupId === 'ungrouped') {
        sheets = state.finance.sheets.filter(s => !s.groupId || !validGroupIds.has(s.groupId));
    } else {
        const group = state.finance.groups.find(g => g.id === groupId);
        if (!group) {
            toast("Grupo não encontrado.", "error");
            return;
        }
        groupName = group.name;
        sheets = state.finance.sheets.filter(s => s.groupId === groupId);
    }

    if (sheets.length === 0) {
        toast("Este grupo não contém nenhuma lista/documento para imprimir.", "warning");
        return;
    }

    renderAndTriggerFinancePrint(`LOTE / GRUPO: ${groupName}`, sortFinanceSheets(sheets), false);
}

/**
 * Imprime a lista/tabela consolidada do Finance (Todas ou Marcadas)
 */
export function printUnifiedFinanceTable() {
    const viewMode = state.finance.viewMode || 'groups';
    let title = 'TODAS AS LISTAS CONSOLIDADAS';
    let sheets = [];

    if (viewMode === 'selected') {
        sheets = state.finance.sheets.filter(s => state.finance.selectedSheets && state.finance.selectedSheets.has(s.id));
        title = 'LISTAS MARCADAS (CONSOLIDADO)';
    } else {
        sheets = state.finance.sheets;
        title = 'TODAS AS LISTAS (CONSOLIDADO)';
    }

    if (sheets.length === 0) {
        toast("Nenhuma lista disponível para imprimir.", "warning");
        return;
    }

    renderAndTriggerFinancePrint(title, sortFinanceSheets(sheets), true);
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

    // Helper para verificar se um registo está totalmente liquidado
    const isRecordFullyPaid = (r) => {
        const isInterna = r.interna_paid || parseFloat(r.interna_val) === 0;
        const isMaputo = r.maputo_paid || parseFloat(r.maputo_val) === 0;
        const isMatola = r.matola_paid || parseFloat(r.matola_val) === 0;
        const isInvestigacao = r.investigacao_paid || parseFloat(r.investigacao_val) === 0 || r.investigacao_val === undefined || r.investigacao_val === '';
        const consignacaoVal = r.consignacao_val !== undefined ? r.consignacao_val : r.termos_val;
        const consignacaoPaid = r.consignacao_paid !== undefined ? r.consignacao_paid : r.termos_paid;
        const isConsignacao = consignacaoPaid || parseFloat(consignacaoVal) === 0;
        return isInterna && isMaputo && isMatola && isInvestigacao && isConsignacao;
    };

    // Calcular estatísticas para o resumo de topo
    const stats = records.reduce((acc, r) => {
        acc.totalRecords++;
        if (isRecordFullyPaid(r)) acc.completedRecords++;
        return acc;
    }, { totalRecords: 0, completedRecords: 0 });

    let globalTotals = { interna: 0, maputo: 0, matola: 0, investigacao: 0, consignacao: 0 };

    // Função para renderizar uma linha de soma (Laranja)
    const renderSumRow = (stats) => {
        const tr = document.createElement('tr');
        tr.className = "bg-orange-300 font-bold text-xs";
        tr.innerHTML = `
            <td class="py-1 px-2 border border-gray-600 text-center uppercase text-[8px]">Subtotal</td>
            <td class="py-1 px-2 border border-gray-600 text-center">${stats.interna || 0}</td><td class="border border-gray-600"></td>
            <td class="py-1 px-2 border border-gray-600 text-center">${stats.maputo || 0}</td><td class="border border-gray-600"></td>
            <td class="py-1 px-2 border border-gray-600 text-center">${stats.matola || 0}</td><td class="border border-gray-600"></td>
            <td class="py-1 px-2 border border-gray-600 text-center">${stats.investigacao || 0}</td><td class="border border-gray-600"></td>
            <td class="py-1 px-2 border border-gray-600 text-center">${stats.consignacao || 0}</td><td class="border border-gray-600"></td>
        `;
        return tr;
    };

    let visibleGroupsCount = 0;

    // Renderizar por Grupos
    groups.forEach(group => {
        const groupRecords = records.filter(r => r.group_id === group.id);
        
        // Verificar se o lote está completamente pago ou sem contentores
        const allRecordsPaid = groupRecords.length > 0 && groupRecords.every(r => isRecordFullyPaid(r));

        if (groupRecords.length === 0 || allRecordsPaid) {
            return; // Ocultar o lote completamente se estiver todo pago ou vazio
        }

        visibleGroupsCount++;
        let groupUnpaid = { interna: 0, maputo: 0, matola: 0, investigacao: 0, consignacao: 0 };

        groupRecords.forEach(r => {
            const isRowPaid = isRecordFullyPaid(r);
            if (isRowPaid) return; // Omitir se concluído

            const tr = createTeamRow(r, onEditRecord);
            tbody.appendChild(tr);

            if (!r.interna_paid) groupUnpaid.interna += (parseFloat(r.interna_val) || 0);
            if (!r.maputo_paid) groupUnpaid.maputo += (parseFloat(r.maputo_val) || 0);
            if (!r.matola_paid) groupUnpaid.matola += (parseFloat(r.matola_val) || 0);
            if (!r.investigacao_paid) groupUnpaid.investigacao += (parseFloat(r.investigacao_val) || 0);
            const cVal = parseFloat(r.consignacao_val !== undefined ? r.consignacao_val : r.termos_val) || 0;
            const cPaid = r.consignacao_paid !== undefined ? r.consignacao_paid : r.termos_paid;
            if (!cPaid) groupUnpaid.consignacao += cVal;
        });

        // Adicionar Linha Laranja (Somatório dos não pagos do grupo)
        tbody.appendChild(renderSumRow(groupUnpaid));

        // Espaçador entre lotes (Cinza Transparente)
        const spacer = document.createElement('tr');
        spacer.className = "h-4 bg-gray-100/50";
        spacer.innerHTML = '<td colspan="11" class="border border-gray-300"></td>';
        tbody.appendChild(spacer);

        globalTotals.interna += groupUnpaid.interna;
        globalTotals.maputo += groupUnpaid.maputo;
        globalTotals.matola += groupUnpaid.matola;
        globalTotals.investigacao += groupUnpaid.investigacao;
        globalTotals.consignacao += groupUnpaid.consignacao;
    });

    // Renderizar sem grupo
    const ungrouped = records.filter(r => !r.group_id);
    if (ungrouped.length > 0) {
        ungrouped.forEach(r => {
            const isRowPaid = isRecordFullyPaid(r);
            if (isRowPaid) return; // Omitir se concluído

            tbody.appendChild(createTeamRow(r, onEditRecord));
            if (!r.interna_paid) globalTotals.interna += (parseFloat(r.interna_val) || 0);
            if (!r.maputo_paid) globalTotals.maputo += (parseFloat(r.maputo_val) || 0);
            if (!r.matola_paid) globalTotals.matola += (parseFloat(r.matola_val) || 0);
            if (!r.investigacao_paid) globalTotals.investigacao += (parseFloat(r.investigacao_val) || 0);
            const cVal = parseFloat(r.consignacao_val !== undefined ? r.consignacao_val : r.termos_val) || 0;
            const cPaid = r.consignacao_paid !== undefined ? r.consignacao_paid : r.termos_paid;
            if (!cPaid) globalTotals.consignacao += cVal;
        });
    }

    const totalPendency = (globalTotals.interna || 0) + (globalTotals.maputo || 0) + (globalTotals.matola || 0) + (globalTotals.investigacao || 0) + (globalTotals.consignacao || 0);
    renderTeamSummary(totalPendency, visibleGroupsCount, stats.totalRecords, stats.completedRecords);

    footer.innerHTML = `
        <tr class="bg-yellow-400 text-black font-normal uppercase text-xs">
            <td class="py-2 px-4 border-2 border-gray-800 text-center">PENDENTE</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center" colspan="2">${formatMZN(globalTotals.interna)}</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center" colspan="2">${formatMZN(globalTotals.maputo)}</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center" colspan="2">${formatMZN(globalTotals.matola)}</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center" colspan="2">${formatMZN(globalTotals.investigacao)}</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center" colspan="2">${formatMZN(globalTotals.consignacao)}</td>
        </tr>
        <tr class="bg-orange-500 text-black font-normal uppercase text-sm export-only">
            <td colspan="9" class="py-2 px-4 text-center border-2 border-gray-800">TOTAL GERAL PENDENTE</td>
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
    const isInterna = r.interna_paid || parseFloat(r.interna_val) === 0;
    const isMaputo = r.maputo_paid || parseFloat(r.maputo_val) === 0;
    const isMatola = r.matola_paid || parseFloat(r.matola_val) === 0;
    const isInvestigacao = r.investigacao_paid || parseFloat(r.investigacao_val) === 0 || r.investigacao_val === undefined || r.investigacao_val === '';
    const consignacaoVal = r.consignacao_val !== undefined ? r.consignacao_val : r.termos_val;
    const consignacaoMonth = r.consignacao_month !== undefined ? r.consignacao_month : r.termos_month;
    const consignacaoPaid = r.consignacao_paid !== undefined ? r.consignacao_paid : r.termos_paid;
    const isConsignacao = consignacaoPaid || parseFloat(consignacaoVal) === 0;

    const isPaid = isInterna && isMaputo && isMatola && isInvestigacao && isConsignacao;
    const tr = document.createElement('tr');
    tr.className = `cursor-pointer hover:opacity-80 transition-all ${isPaid ? 'bg-green-400' : 'bg-white'}`;
    tr.onclick = () => onEdit(r);

    const paidClass = "bg-green-300"; // Cor para células individuais pagas

    tr.innerHTML = `
        <td class="py-1 px-2 border border-gray-400 font-normal text-xs text-center">${r.container_id_str}</td>
        
        <td class="py-1 px-2 border border-gray-400 text-xs text-center ${r.interna_paid ? paidClass : ''}">${r.interna_val || ''}</td>
        <td class="py-1 px-2 border border-gray-400 text-[11px] text-center italic ${r.interna_paid ? paidClass : ''}">${formatDateDisplay(r.interna_month) || ''}</td>
        
        <td class="py-1 px-2 border border-gray-400 text-xs text-center ${r.maputo_paid ? paidClass : ''}">${r.maputo_val || ''}</td>
        <td class="py-1 px-2 border border-gray-400 text-[11px] text-center italic ${r.maputo_paid ? paidClass : ''}">${formatDateDisplay(r.maputo_month) || ''}</td>
        
        <td class="py-1 px-2 border border-gray-400 text-xs text-center ${r.matola_paid ? paidClass : ''}">${r.matola_val || ''}</td>
        <td class="py-1 px-2 border border-gray-400 text-[11px] text-center italic ${r.matola_paid ? paidClass : ''}">${formatDateDisplay(r.matola_month) || ''}</td>
        
        <td class="py-1 px-2 border border-gray-400 text-xs text-center ${(r.investigacao_paid || parseFloat(r.investigacao_val) === 0) ? paidClass : ''}">${r.investigacao_val || '0'}</td>
        <td class="py-1 px-2 border border-gray-400 text-[11px] text-center italic ${(r.investigacao_paid || parseFloat(r.investigacao_val) === 0) ? paidClass : ''}">${formatDateDisplay(r.investigacao_month) || ''}</td>

        <td class="py-1 px-2 border border-gray-400 text-xs text-center ${(consignacaoPaid || parseFloat(consignacaoVal) === 0) ? paidClass : ''}">${consignacaoVal || '0'}</td>
        <td class="py-1 px-2 border border-gray-400 text-[11px] text-center italic ${(consignacaoPaid || parseFloat(consignacaoVal) === 0) ? paidClass : ''}">${formatDateDisplay(consignacaoMonth) || ''}</td>
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
            <td class="py-1 px-2 border border-gray-600 font-normal text-xs text-center">${r.container_id_str}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center">${r.eta ? formatDateDisplay(r.eta) : ''}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center font-normal">${tcs}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center">${unit}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center">${formatMZN(value)}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center font-normal">${formatMZN(fiftyPercent)}</td>
            <td class="py-1 px-2 border border-gray-600 text-[10px] text-center font-normal uppercase">${r.status}</td>
            <td class="py-1 px-2 border border-gray-600 text-xs text-center font-normal">${formatMZN(balance)}</td>
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
        <tr class="bg-orange-400 font-normal text-xs text-black">
            <td colspan="6" class="border-2 border-gray-800"></td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center uppercase">PENDING</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center">${formatMZN(totals.pending)}</td>
        </tr>
        <tr class="bg-blue-300 font-normal text-xs text-black">
            <td colspan="6" class="border-2 border-gray-800"></td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center uppercase">NEXT AFTER (${pendingMonthLabel})</td>
            <td class="py-2 px-4 border-2 border-gray-800 text-center">${formatMZN(totals.next)}</td>
        </tr>
        <tr class="bg-green-500 font-normal text-sm text-black">
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


export function getCanonicalStatus(str) {
    const u = String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!u) return '';
    if (u.includes('ERRADO')) return 'COMPROVATIVO ERRADO';
    if (u.includes('SEM COMP')) return 'SEM COMPROVATIVO';
    if (u.includes('RE-VERIF') || u.includes('VERIFIC')) return 'RE-VERIFICANDO';
    if (u.includes('PARCIAL')) return 'PARCIAL';
    if (u.includes('CONFIRM')) return 'CONFIRMADO';
    if (u.includes('AGUARDA')) return 'AGUARDA PAGAMENTO';
    if (u.includes('PENDENTE')) return 'PENDENTE';
    return u;
}
window.getCanonicalStatus = getCanonicalStatus;

export function calculateRowStatus(confStr, balanceVal, bankDutyStr, paidVal = 0, prepaidVal = 0) {
    const rawConf = String(confStr || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cleanBank = String(bankDutyStr || '').trim().toUpperCase();
    const hasBank = cleanBank !== '' && cleanBank !== '?' && cleanBank !== 'NIL' && cleanBank !== '-' && cleanBank !== 'SEM BANCO';
    const numBalance = typeof balanceVal === 'number' ? balanceVal : (parseFloat(String(balanceVal || '0').replace(/[^0-9.-]+/g, '')) || 0);
    const numPaid = typeof paidVal === 'number' ? paidVal : (parseFloat(String(paidVal || '0').replace(/[^0-9.-]+/g, '')) || 0);
    const numPrepaid = typeof prepaidVal === 'number' ? prepaidVal : (parseFloat(String(prepaidVal || '0').replace(/[^0-9.-]+/g, '')) || 0);

    const isZeroBalance = numBalance <= 0.01;

    // 1. Estados explícitos manuais de auditoria / comprovativos
    if (rawConf.includes('ERRADO')) {
        return 'COMPROVATIVO ERRADO';
    }
    if (rawConf.includes('SEM COMP')) {
        return 'SEM COMPROVATIVO';
    }
    if (rawConf.includes('RE-VERIF') || rawConf.includes('VERIFIC')) {
        return 'RE-VERIFICANDO';
    }
    if (rawConf.includes('PARCIAL')) {
        return 'PARCIAL';
    }

    // 2. Se marcado expressamente como CONFIRMADO na folha
    if (rawConf.includes('CONFIRM')) {
        if (!isZeroBalance) {
            return 'PARCIAL';
        }
        return 'CONFIRMADO';
    }

    // 3. Se CONFIRMATION for '?' ou vazio ou 'PENDENTE'
    if (isZeroBalance) {
        if (hasBank) {
            return 'PENDENTE';
        }
        if (numPrepaid > 0) {
            return 'CONFIRMADO';
        }
        return 'PENDENTE';
    }

    // 4. Saldo em dívida (> 0)
    if (hasBank || numPaid > 0) {
        return 'PARCIAL';
    }

    return 'AGUARDA PAGAMENTO';
}
window.calculateRowStatus = calculateRowStatus;

export function getRowStatusButtonClass(status) {
    const s = getCanonicalStatus(status);
    switch (s) {
        case 'CONFIRMADO':
            return 'bg-green-50 text-green-700 border-green-300 hover:bg-green-600 hover:text-white';
        case 'PENDENTE':
            return 'bg-yellow-400 text-black font-black border-yellow-500 hover:bg-yellow-500';
        case 'PARCIAL':
            return 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-600 hover:text-white';
        case 'RE-VERIFICANDO':
            return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-600 hover:text-white';
        case 'SEM COMPROVATIVO':
            return 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-600 hover:text-white';
        case 'COMPROVATIVO ERRADO':
            return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-600 hover:text-white';
        case 'AGUARDA PAGAMENTO':
        default:
            return 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200';
    }
}
window.getRowStatusButtonClass = getRowStatusButtonClass;

export function renderConfirmList(data, filterText = "", statusFilter = null, isUserFilter = false) {
    const container = document.getElementById('confirm-list-container');
    if (!container) return;

    if (!statusFilter) {
        statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
    }

    const statusSelect = document.getElementById('confirm-status-filter');
    if (statusSelect && statusSelect.value !== statusFilter) {
        statusSelect.value = statusFilter;
    }

    container.innerHTML = '';
    const columns = data[0];
    if (!state.confirm) state.confirm = {};
    state.confirm.data = data;
    state.confirm.columns = columns;

    const btnWarehouse = document.getElementById('btn-warehouse-status');
    if (btnWarehouse) {
        if (state.confirm.dischargeDate) {
            btnWarehouse.classList.remove('hidden');
        } else {
            btnWarehouse.classList.add('hidden');
        }
    }


    const columnsUpper = columns.map(c => String(c || '').toUpperCase());
    
    const cleanString = (str) => String(str || '')
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]/g, "")
        .trim();

    const idCodeIdx = findColumnIndex(columns, ['ID CODE', 'CODE ID', 'ID']);
    const nameIdx = findColumnIndex(columns, ['NAME', 'NOME', 'CLIENTE', 'CLIENT']);
    const statusIdx = findColumnIndex(columns, ['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);
    const dutyIdx = findColumnIndex(columns, ['AMOUNT DUTY', 'DUTY', 'TOTAL DUTY', 'VALOR DUTY']);
    const dutyPrepaidIdx = findColumnIndex(columns, ['DUTY PREPAID', 'PREPAID']);
    const balanceIdx = findColumnIndex(columns, ['BALANCE', 'BALANCO', 'SALDO']);
    const notaDutyIdx = findColumnIndex(columns, ['NOTA DUTY', 'NOTA', 'OBSERVACAO', 'OBSERVACOES', 'OBS', 'NOTA_DUTY']);
    const bankDutyIdx = findColumnIndex(columns, ['BANK IN DUTY', 'BANK DUTY', 'BANK', 'BANCO']);
    
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

        const rawDuty = dutyIdx !== -1 ? row[dutyIdx] : 0;
        const dutyVal = parseFloat(String(rawDuty || '0').replace(/[^0-9.-]+/g, '')) || 0;

        const rawPaid = paidIdx !== -1 ? row[paidIdx] : 0;
        const paidVal = parseFloat(String(rawPaid || '0').replace(/[^0-9.-]+/g, '')) || 0;

        const rawPrepaid = dutyPrepaidIdx !== -1 ? row[dutyPrepaidIdx] : 0;
        const prepaidVal = parseFloat(String(rawPrepaid || '0').replace(/[^0-9.-]+/g, '')) || 0;

        const rawBalance = balanceIdx !== -1 ? row[balanceIdx] : 0;
        let balanceVal = parseFloat(String(rawBalance || '0').replace(/[^0-9.-]+/g, '')) || 0;

        // Fallback robusto para saldo real se a célula estiver vazia ou zero
        if (balanceVal === 0 && dutyVal > 0 && (paidVal + prepaidVal) < dutyVal) {
            balanceVal = Math.max(0, dutyVal - prepaidVal - paidVal);
        }
        if (dutyVal > 0 && (paidVal + prepaidVal) >= dutyVal) {
            balanceVal = 0;
        }

        const rawBankDuty = bankDutyIdx !== -1 ? String(row[bankDutyIdx] || '').trim() : '';
        const rowStatus = calculateRowStatus(row[statusIdx], balanceVal, rawBankDuty, paidVal, prepaidVal);

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

    // Helper de status canónico e classes
    const getCanonicalStatus = (str) => {
        const u = String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (!u) return '';
        if (u.includes('ERRADO')) return 'COMPROVATIVO ERRADO';
        if (u.includes('SEM COMP')) return 'SEM COMPROVATIVO';
        if (u.includes('RE-VERIF') || u.includes('VERIFIC')) return 'RE-VERIFICANDO';
        if (u.includes('PARCIAL')) return 'PARCIAL';
        if (u.includes('CONFIRM')) return 'CONFIRMADO';
        if (u.includes('AGUARDA')) return 'AGUARDA PAGAMENTO';
        if (u.includes('PENDENTE')) return 'PENDENTE';
        return u;
    };

    const getClientStatusAndClass = (client) => {
        const cleanStatuses = (client.statuses || []).map(getCanonicalStatus);

        let clientStatus = 'PENDENTE';
        let displayStatus = 'PENDENTE';
        let statusClass = "bg-yellow-400 text-black font-black";

        if (cleanStatuses.some(s => s === 'COMPROVATIVO ERRADO')) {
            clientStatus = 'COMPROVATIVO ERRADO';
            displayStatus = 'ERRADO';
            statusClass = "bg-red-600 text-white font-black";
        } else if (cleanStatuses.some(s => s === 'SEM COMPROVATIVO')) {
            clientStatus = 'SEM COMPROVATIVO';
            displayStatus = 'SEM COMP.';
            statusClass = "bg-orange-500 text-white font-black";
        } else if (cleanStatuses.some(s => s === 'RE-VERIFICANDO')) {
            clientStatus = 'RE-VERIFICANDO';
            displayStatus = 'RE-VERIF.';
            statusClass = "bg-blue-600 text-white font-black";
        } else if (cleanStatuses.length > 0 && cleanStatuses.every(s => s === 'CONFIRMADO')) {
            clientStatus = 'CONFIRMADO';
            displayStatus = 'CONFIRMADO';
            statusClass = "bg-green-600 text-white font-black";
        } else if (cleanStatuses.some(s => s === 'PARCIAL') || (cleanStatuses.some(s => s === 'CONFIRMADO') && cleanStatuses.some(s => s === 'PENDENTE' || s === 'AGUARDA PAGAMENTO'))) {
            clientStatus = 'PARCIAL';
            displayStatus = 'PARCIAL';
            statusClass = "bg-yellow-500 text-white font-black";
        } else if (cleanStatuses.some(s => s === 'PENDENTE')) {
            clientStatus = 'PENDENTE';
            displayStatus = 'PENDENTE';
            statusClass = "bg-yellow-400 text-black font-black";
        } else {
            clientStatus = 'AGUARDA PAGAMENTO';
            displayStatus = 'AGUARDA PAG.';
            statusClass = "bg-gray-100 text-gray-500 font-bold";
        }
        return { clientStatus, displayStatus, statusClass };
    };

    // Se for o carregamento inicial de um CTR (sem o utilizador ter selecionado manualmente no dropdown)
    // e o filtro estiver 'PENDENTE', mas este projeto não tiver nenhum cliente PENDENTE:
    if (!isUserFilter && statusFilter === 'PENDENTE') {
        const hasPending = groups.some(c => getClientStatusAndClass(c).clientStatus === 'PENDENTE');
        if (!hasPending) {
            const hasParcial = groups.some(c => getClientStatusAndClass(c).clientStatus === 'PARCIAL');
            if (hasParcial) {
                statusFilter = 'PARCIAL';
            } else {
                statusFilter = 'TODOS';
            }
        }
    }

    if (statusSelect && statusSelect.value !== statusFilter) {
        statusSelect.value = statusFilter;
    }

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

    // Aplicar Filtro de Status Canónico
    const targetCanonical = getCanonicalStatus(statusFilter);
    if (targetCanonical && targetCanonical !== 'TODOS') {
        groups = groups.filter(client => {
            const { clientStatus } = getClientStatusAndClass(client);

            if (targetCanonical === 'CONFIRMADO') {
                return clientStatus === 'CONFIRMADO';
            }
            if (targetCanonical === 'PARCIAL') {
                return clientStatus === 'PARCIAL';
            }
            if (targetCanonical === 'PENDENTE') {
                return clientStatus === 'PENDENTE';
            }
            if (targetCanonical === 'AGUARDA PAGAMENTO') {
                return clientStatus === 'AGUARDA PAGAMENTO';
            }

            // Para status específicos (RE-VERIFICANDO, SEM COMPROVATIVO, COMPROVATIVO ERRADO)
            if (clientStatus === targetCanonical) return true;
            return client.statuses.some(s => getCanonicalStatus(s) === targetCanonical);
        });
    }

    // Calcular Total Duty baseado nos grupos e status filtrados
    groups.forEach(client => {
        client.rows.forEach(r => {
            const rowCanonical = getCanonicalStatus(r.status);
            let isMatch = false;
            if (targetCanonical === 'TODOS' || targetCanonical === 'PARCIAL') {
                isMatch = true;
            } else if (targetCanonical === 'CONFIRMADO') {
                isMatch = (rowCanonical === 'CONFIRMADO');
            } else if (targetCanonical === 'PENDENTE') {
                isMatch = (rowCanonical === 'PENDENTE');
            } else if (targetCanonical === 'AGUARDA PAGAMENTO') {
                isMatch = (rowCanonical === 'AGUARDA PAGAMENTO');
            } else {
                isMatch = (rowCanonical === targetCanonical);
            }

            if (isMatch) {
                const rawVal = r.originalRow[dutyIdx];
                const duty = parseFloat(String(rawVal || '0').replace(/[^0-9.-]+/g, '')) || 0;
                totalDuty += duty;
            }
        });
    });

    if (totalDuty === 0 && groups.length > 0) {
        groups.forEach(client => {
            client.rows.forEach(r => {
                const rawVal = r.originalRow[dutyIdx];
                const duty = parseFloat(String(rawVal || '0').replace(/[^0-9.-]+/g, '')) || 0;
                totalDuty += duty;
            });
        });
    }

    // Atualizar Barra de Totais
    const totalsBar = document.getElementById('confirm-totals-bar');
    if (totalsBar) {
        totalsBar.classList.remove('hidden');
        document.getElementById('confirm-total-clients').innerText = groups.length;
        document.getElementById('confirm-total-duty').innerText = formatMZN(totalDuty);
    }

    container.innerHTML = '';

    // Se nenhum cliente corresponder ao filtro, exibir mensagem amigável
    if (groups.length === 0) {
        container.className = "col-span-full py-16 text-center w-full";
        container.innerHTML = `
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Nenhum cliente com status "${statusFilter}"</p>
            <p class="text-[10px] text-gray-400 mt-1">Selecione outro status ou "TODOS OS STATUS" para visualizar os clientes.</p>
        `;
        return groups;
    }

    // Sincronizar classes de botões ativos no topo
    const viewMode = state.confirm.viewMode || localStorage.getItem('confirm_view_mode') || 'grid';
    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');
    const btnTable = document.getElementById('btn-view-table');

    if (btnGrid) btnGrid.className = `p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnList) btnList.className = `p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnTable) btnTable.className = `p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;

    // === 1 - MODOS DE EXIBIÇÃO ===
    if (viewMode === 'grid') {
        container.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4";
        groups.forEach((client) => {
            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 p-3 pt-8 pb-1.5 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group relative overflow-hidden";

            const { clientStatus, displayStatus, statusClass } = getClientStatusAndClass(client);
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
                        <span class="text-[8px] font-black uppercase tracking-wider">${displayStatus || clientStatus}</span>
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

            card.onclick = () => window.openClientWithLoader(client.groupId);
            container.appendChild(card);
        });
    } 
    else if (viewMode === 'list') {
        container.className = "flex flex-col gap-3 px-4 w-full col-span-full";
        groups.forEach((client) => {
            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 hover:border-gray-300 p-3 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-between group";

            const { clientStatus, displayStatus, statusClass } = getClientStatusAndClass(client);
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
                    <span class="text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded inline-block ${statusClass}">${displayStatus || clientStatus}</span>
                    <div class="text-gray-300 group-hover:text-yellow-600 transition-all shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </div>
            `;

            card.onclick = () => window.openClientWithLoader(client.groupId);
            container.appendChild(card);
        });
    } 
    else if (viewMode === 'table') {
        container.className = "w-full col-span-full px-4 overflow-x-auto custom-scrollbar";
        
        const wrapper = document.createElement('div');
        wrapper.className = "bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm w-full";
        
        let tableRowsHtml = '';
        groups.forEach((client) => {
            const { clientStatus, displayStatus, statusClass } = getClientStatusAndClass(client);
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
                    <td class="p-3 text-center font-normal text-xs text-slate-800">${client.no || '—'}</td>
                    <td class="p-3 font-normal text-xs uppercase text-slate-700 group-hover:text-black transition-colors">${client.displayName || 'Cliente Sem Nome'} ${tableLockHtml}</td>
                    <td class="p-3 text-center text-xs font-normal text-slate-500">${rowCount}</td>
                    <td class="p-3 text-right font-normal text-xs text-slate-800">${formatMZN(clientDuty)}</td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-2">
                            ${client.hasResponse ? `
                                <span class="text-[8px] font-normal uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 animate-pulse flex items-center gap-1" title="Cliente já respondeu à nota de confirmação">💬 RESPONDIDO</span>
                            ` : ''}
                            <span class="text-[8px] font-normal uppercase tracking-wider px-2 py-1 rounded inline-block ${statusClass}">${displayStatus || clientStatus}</span>
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
                tr.onclick = () => window.openClientWithLoader(client.groupId);
            }
        });
    }

    // Verificação de Auto-Abertura Pendente do Modo Verify
    if (state.confirm?.pendingAutoOpenClient) {
        const term = state.confirm.pendingAutoOpenClient.toLowerCase();
        const clientToOpen = groups.find(c => 
            (c.displayName || '').toLowerCase().includes(term) || 
            (c.displayIdCode || '').toLowerCase().includes(term)
        );
        if (clientToOpen) {
            console.log("[VERIFY] Abertura automática de detalhes solicitada para:", clientToOpen.displayName);
            state.confirm.pendingAutoOpenClient = null; // Limpar estado pendente
            setTimeout(() => {
                if (typeof showConfirmDetail === 'function') {
                    showConfirmDetail(clientToOpen, clientToOpen.originalGlobalIndex || clientToOpen.no || '—');
                } else if (typeof window.showConfirmDetail === 'function') {
                    window.showConfirmDetail(clientToOpen, clientToOpen.originalGlobalIndex || clientToOpen.no || '—');
                }
            }, 200);
        }
    }

    return groups;
}


export function setReconciliationViewMode(mode) {
    window.reconciliationViewMode = mode;
    window.reconciliationUserChoice = mode;
    try {
        localStorage.setItem('reconciliation_view_mode', mode);
        localStorage.setItem('reconciliation_user_choice', mode);
    } catch (e) {}

    document.querySelectorAll('.recon-grid-view').forEach(el => {
        el.classList.toggle('hidden', mode !== 'grid');
    });
    document.querySelectorAll('.recon-list-view').forEach(el => {
        el.classList.toggle('hidden', mode !== 'list');
    });

    document.querySelectorAll('.btn-recon-view-grid').forEach(btn => {
        if (mode === 'grid') {
            btn.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
            btn.classList.remove('bg-transparent', 'text-slate-400');
        } else {
            btn.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
            btn.classList.add('bg-transparent', 'text-slate-400');
        }
    });
    document.querySelectorAll('.btn-recon-view-list').forEach(btn => {
        if (mode === 'list') {
            btn.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
            btn.classList.remove('bg-transparent', 'text-slate-400');
        } else {
            btn.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
            btn.classList.add('bg-transparent', 'text-slate-400');
        }
    });
}
window.setReconciliationViewMode = setReconciliationViewMode;
if (typeof window !== 'undefined') {
    try {
        window.reconciliationUserChoice = localStorage.getItem('reconciliation_user_choice') || 'list';
    } catch (e) {
        window.reconciliationUserChoice = 'list';
    }
}

export async function showConfirmDetail(client, clientIndex) {
    const isSameClient = window.currentActiveClient && String(window.currentActiveClientIndex) === String(clientIndex);
    window.currentActiveClient = client;
    window.currentActiveClientIndex = clientIndex;
    window.currentClientStorageInfo = null;
    window.currentClientStoragePayments = [];
    window.currentClientDespachoInfo = null;
    window.currentClientDespachoPayments = [];

    // Inicialmente ocultar botão de auditoria até verificar se existem registos
    setAuditHistoryButtonVisible(false);

    // Carregar metadados de auditoria recentes do cliente (armazém, guia)
    let auditLogs = [];
    try {
        const sheetId = state.confirm?.sheetId || '';
        if (sheetId && client.no) {
            auditLogs = await getClientAuditLogs(sheetId, client.no);
            if (auditLogs && auditLogs.length > 0) {
                const lastSave = auditLogs.find(l => l.type === 'AUDIT_ARMAZEM_GRAVADO' || l.type === 'AUDIT_ARMAZEM_ENTREGUE');
                if (lastSave) {
                    client.lastWarehouseSavedBy = lastSave.payload?.userName || lastSave.expand?.user?.name || 'Operador';
                    client.lastWarehouseSavedAt = lastSave.created;
                }
                const lastGuia = auditLogs.find(l => l.type === 'AUDIT_GUIA_EMITIDA');
                if (lastGuia) {
                    client.lastGuiaIssuedBy = lastGuia.payload?.emitidoPor || lastGuia.payload?.userName || lastGuia.expand?.user?.name || 'Operador';
                    client.lastGuiaIssuedAt = lastGuia.created;
                }
            }
        }
    } catch (auditFetchErr) {
        console.warn('[Audit] Erro ao carregar logs preliminares do cliente:', auditFetchErr);
    }
    client.auditLogs = auditLogs;
    setAuditHistoryButtonVisible(Boolean(auditLogs && auditLogs.length > 0));
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

    const getRaw = (row, idx) => idx !== -1 && row[idx] !== undefined && row[idx] !== null && row[idx] !== '' ? row[idx] : '—';
    const phoneIdx = findColumnIndex(columns, ['PHONE NUMBER', 'PHONE', 'TELEFONE', 'CONTACTO', 'CELULAR', 'PHONE_NUMBER']);

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
    if (body && !isSameClient) {
        body.innerHTML = `
            <div class="flex flex-col items-center justify-center p-12 text-slate-400">
                <svg class="animate-spin h-8 w-8 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span class="text-xs font-bold uppercase tracking-widest animate-pulse">A carregar detalhes...</span>
            </div>
        `;
    }

    const orderNumIdx = findColumnIndex(columns, ['HF2', 'REF', 'REFERENCIA', 'ORDER NUMBER', 'ORDER NUM', 'ORDER', 'CONV', 'CONTENTOR', 'Nº HF2', 'Nº ORDEM', 'NO.', 'N.O', 'N.º', 'Nº', 'N°', 'NO']);
    const cbmIdx = findColumnIndex(columns, ['CBM', 'M3', 'VOLUME', 'VOL']);
    const unitDutyIdx = findColumnIndex(columns, ['UNIT CBM DUTY', 'UNIT DUTY', 'CBM DUTY', 'UNIT']);
    const dutyPrepIdx = findColumnIndex(columns, ['DUTY PREPAID', 'PREPAID', 'PRE-PAGO']);
    const amtDutyIdx = findColumnIndex(columns, ['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
    
    let paidDutyIdx = findColumnIndex(columns, ['PAID', 'PAID DUTY', 'DUTY PAID', 'VALOR PAGO', 'PAGO']);
    if (paidDutyIdx !== -1 && cleanString(columns[paidDutyIdx]).includes('FREIGHT')) {
        paidDutyIdx = columns.findIndex(c => {
            const h = cleanString(c);
            return (h === 'PAID' || h === 'PAIDDUTY' || h === 'DUTYPAID' || h === 'PAGO') && !h.includes('FREIGHT');
        });
    }
    
    const balanceIdx = findColumnIndex(columns, ['BALANCE', 'SALDO', 'BALANCO']);
    const bankDutyIdx = findColumnIndex(columns, ['BANK IN DUTY', 'BANK', 'BANCO']);
    const statusIdx = findColumnIndex(columns, ['CONFIRMATION', 'STATUS']);
    const notaDutyIdx = findColumnIndex(columns, ['NOTA DUTY', 'NOTA', 'OBSERVACAO', 'OBSERVACOES', 'OBS', 'NOTA_DUTY']);

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
    const packagesIdx = findColumnIndex(columns, ['PACKAGES']);
    const unitFreightIdx = findColumnIndex(columns, ['UNIT CBM FREIGHT']);
    const amtFreightIdx = findColumnIndex(columns, ['AMOUNT FREIGHT']);
    const paidFreightIdx = findColumnIndex(columns, ['PAID FREIGHT']);
    const balanceFreightIdx = findColumnIndex(columns, ['BALANCE FREIGHT']);
    const bankFreightIdx = findColumnIndex(columns, ['BANK IN FREIGHT']);
    const notaFreightIdx = findColumnIndex(columns, ['NOTA FREIGHT']);
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
    let payments = [];
    let freightPayments = [];
    let storagePayments = [];
    let despachoPayments = [];
    let isFullyPrepaid = false;
    
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
            const rowData = (state.confirm?.data && state.confirm.data[rowObj.originalIndex]) || rowObj.originalRow || [];
            rowObj.originalRow = rowData;
            const originalIndex = rowObj.originalIndex;

            const orderNumber = getRaw(rowData, orderNumIdx);
            const cbm = getNum(rowData, cbmIdx);
            const unitDuty = getNum(rowData, unitDutyIdx);
            const dutyPrepaid = getNum(rowData, dutyPrepIdx);
            const amountDuty = getNum(rowData, amtDutyIdx);
            const paid = getNum(rowData, paidDutyIdx);
            let balance = balanceIdx !== -1 && rowData[balanceIdx] !== '' && rowData[balanceIdx] !== undefined 
                ? getNum(rowData, balanceIdx) 
                : Math.max(0, amountDuty - dutyPrepaid - paid);
            if (balance === 0 && amountDuty > 0 && (paid + dutyPrepaid) < amountDuty) {
                balance = Math.max(0, amountDuty - dutyPrepaid - paid);
            }
            if (amountDuty > 0 && (paid + dutyPrepaid) >= amountDuty) {
                balance = 0;
            }
            const bankDuty = getRaw(rowData, bankDutyIdx);
            
            // Armazém / Frete dados
            const packages = getNum(rowData, packagesIdx);
            const amtFreight = getNum(rowData, amtFreightIdx);
            const pdFreight = getNum(rowData, paidFreightIdx);
            let balFreight = balanceFreightIdx !== -1 && rowData[balanceFreightIdx] !== '' && rowData[balanceFreightIdx] !== undefined 
                ? getNum(rowData, balanceFreightIdx) 
                : Math.max(0, amtFreight - pdFreight);
            if (amtFreight > 0 && pdFreight >= amtFreight) {
                balFreight = 0;
            }
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

            const rowStatus = calculateRowStatus(rowData[statusIdx], balance, bankDuty, paid, dutyPrepaid);

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
                <select onclick="event.stopPropagation();" onchange="ui.changeBankInDuty(${originalIndex}, this.value)" class="py-0.5 px-1 text-slate-700 bg-slate-50 border border-slate-200 rounded text-[10px] font-normal focus:outline-blue-500 focus:bg-white transition-all max-w-[130px] inline-block" ${isLockedByOther ? 'disabled' : ''}>
                    ${optionsHtml}
                </select>
            `;

            tbodyHtml += `
                <tr data-original-index="${originalIndex}" class="row-hover transition-colors border-b border-slate-50 hover:bg-[#f1f5f9] cursor-pointer ${isLockedByOther ? 'opacity-50 pointer-events-none' : ''}" ${isLockedByOther ? `title="A ser editado por ${lockInfo.user}"` : ''} onclick="ui.openConfirmEditModal(${index})">
                    <td class="py-0.5 px-4 font-normal text-slate-800 text-[11px]">${orderNumber}</td>
                    <td class="py-0.5 px-4 text-center text-slate-600 text-[11px]">${cbm.toFixed(2)}</td>
                    <td class="py-0.5 px-4 text-center font-normal text-blue-700 text-[11px]">${formatValue(amountDuty)}</td>
                    <td class="py-0.5 px-4 text-center text-slate-500 text-[11px]">${formatValue(dutyPrepaid)}</td>
                    <td class="py-0.5 px-4 text-center font-normal text-green-600 text-[11px]">${formatValue(paid)}</td>
                    <td class="py-0.5 px-4 text-center font-normal text-[11px] ${balance > 0 ? 'text-red-500' : 'text-slate-400'}">${formatValue(balance)}</td>
                    <td class="py-0.5 px-4 text-center">${bankSelectHtml}</td>
                    <td class="py-0.5 px-4 text-center">
                        <button onclick="event.stopPropagation(); window.onConfirmRow(${originalIndex}, ${JSON.stringify(rowData).replace(/"/g, '&quot;')})" 
                            class="px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-tighter shadow-sm transition-all border ${getRowStatusButtonClass(rowStatus)}"
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

        isFullyPrepaid = totalAmountDuty > 0 && Math.abs(totalAmountDuty - totalDutyPrepaid) < 0.01;
        let targetAmount = totalAmountDuty - totalDutyPrepaid;
        if (isFullyPrepaid) {
            targetAmount = totalDutyPrepaid; // Se for totalmente prepaid, o alvo é o prepaid
        } else if (totalPaid > targetAmount) {
            targetAmount = totalPaid; // Se houver overpayment local
        }

        // Buscar todos os pagamentos já alocados a este cliente (Duty, Frete, Armazém e Cópia de Despacho)
        const [fetchedDutyPmts, fetchedFreightPmts, fetchedStoragePmts, fetchedDespachoPmts] = await Promise.all([
            getPaymentsByAllocatedTo(combinedInfo),
            getPaymentsByAllocatedTo(`FRETE - ${combinedInfo}`),
            getPaymentsByAllocatedTo(`ARMAZEM - ${combinedInfo}`),
            getPaymentsByAllocatedTo(`DESPACHO - ${combinedInfo}`)
        ]);
        payments = fetchedDutyPmts;
        freightPayments = fetchedFreightPmts;
        storagePayments = fetchedStoragePmts;
        despachoPayments = fetchedDespachoPmts;
        window.currentClientStoragePayments = storagePayments;
        window.currentClientDespachoPayments = despachoPayments;
        
        let totalAllocated = 0;
        let pbHtml = '';

        const RECON_THEMES = {
            DUTY: {
                card: 'bg-blue-50/25 hover:bg-blue-50/40 border-blue-200/90 hover:border-blue-400',
                amountText: 'text-blue-800',
                refBox: 'bg-white/90 border-blue-100/90',
                divider: 'border-blue-100/70',
                badge: 'bg-blue-100 text-blue-800 border border-blue-200',
                rowHover: 'hover:bg-blue-100/40 border-b border-blue-100/60',
                sibRowBorder: 'border-blue-100/60',
                sibBoxBorder: 'border-blue-200/70',
                tableBorder: 'border-blue-200/90',
                tableBg: 'bg-blue-50/45',
                thBg: 'bg-blue-50/70 text-blue-950 border-blue-200/70',
                tbodyDivide: 'divide-blue-100/50',
                sibTitle: 'text-blue-600',
                sibActive: 'bg-blue-100/80 font-bold px-1.5 rounded',
                sibDivider: 'border-blue-200'
            },
            FRETE: {
                card: 'bg-rose-50/25 hover:bg-rose-50/40 border-rose-200/90 hover:border-rose-400',
                amountText: 'text-rose-800',
                refBox: 'bg-white/90 border-rose-100/90',
                divider: 'border-rose-100/70',
                badge: 'bg-rose-100 text-rose-800 border border-rose-200',
                rowHover: 'hover:bg-rose-100/40 border-b border-rose-100/60',
                sibRowBorder: 'border-rose-100/60',
                sibBoxBorder: 'border-rose-200/70',
                tableBorder: 'border-rose-200/90',
                tableBg: 'bg-rose-50/45',
                thBg: 'bg-rose-50/70 text-rose-950 border-rose-200/70',
                tbodyDivide: 'divide-rose-100/50',
                sibTitle: 'text-rose-600',
                sibActive: 'bg-rose-100/80 font-bold px-1.5 rounded',
                sibDivider: 'border-rose-200'
            },
            ARMAZEM: {
                card: 'bg-indigo-50/25 hover:bg-indigo-50/40 border-indigo-200/90 hover:border-indigo-400',
                amountText: 'text-indigo-800',
                refBox: 'bg-white/90 border-indigo-100/90',
                divider: 'border-indigo-100/70',
                badge: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
                rowHover: 'hover:bg-indigo-100/40 border-b border-indigo-100/60',
                sibRowBorder: 'border-indigo-100/60',
                sibBoxBorder: 'border-indigo-200/70',
                tableBorder: 'border-indigo-200/90',
                tableBg: 'bg-indigo-50/45',
                thBg: 'bg-indigo-50/70 text-indigo-950 border-indigo-200/70',
                tbodyDivide: 'divide-indigo-100/50',
                sibTitle: 'text-indigo-600',
                sibActive: 'bg-indigo-100/80 font-bold px-1.5 rounded',
                sibDivider: 'border-indigo-200'
            },
            DESPACHO: {
                card: 'bg-teal-50/25 hover:bg-teal-50/40 border-teal-200/90 hover:border-teal-400',
                amountText: 'text-teal-800',
                refBox: 'bg-white/90 border-teal-100/90',
                divider: 'border-teal-100/70',
                badge: 'bg-teal-100 text-teal-800 border border-teal-200',
                rowHover: 'hover:bg-teal-100/40 border-b border-teal-100/60',
                sibRowBorder: 'border-teal-100/60',
                sibBoxBorder: 'border-teal-200/70',
                tableBorder: 'border-teal-200/90',
                tableBg: 'bg-teal-50/45',
                thBg: 'bg-teal-50/70 text-teal-950 border-teal-200/70',
                tbodyDivide: 'divide-teal-100/50',
                sibTitle: 'text-teal-600',
                sibActive: 'bg-teal-100/80 font-bold px-1.5 rounded',
                sibDivider: 'border-teal-200'
            }
        };

        const resolveReconType = (p, fallbackTitle = '') => {
            if (p.reconType) return p.reconType;
            const alloc = String(p.allocated_to || '').toUpperCase();
            if (alloc.startsWith('FRETE')) return 'FRETE';
            if (alloc.startsWith('ARMAZEM')) return 'ARMAZEM';
            if (alloc.startsWith('DESPACHO')) return 'DESPACHO';
            const upperTitle = String(fallbackTitle || '').toUpperCase();
            if (upperTitle.includes('FRETE')) return 'FRETE';
            if (upperTitle.includes('ARMAZEM')) return 'ARMAZEM';
            if (upperTitle.includes('DESPACHO')) return 'DESPACHO';
            return 'DUTY';
        };

        const extractReconMeta = (payment, fallbackTitle = '') => {
            let vinculadorName = payment.reconciled_by_name || '';
            let vinculadoEm = payment.reconciled_at || '';
            if (!vinculadorName && payment.reference) {
                const match = payment.reference.match(/\[Vinculado:\s*([^\]]+)\]/i);
                if (match) {
                    const raw = match[1].trim();
                    const emIndex = raw.toLowerCase().indexOf(' em ');
                    if (emIndex !== -1) {
                        vinculadorName = raw.substring(0, emIndex).trim();
                        vinculadoEm = raw.substring(emIndex + 4).trim();
                    } else {
                        vinculadorName = raw;
                    }
                }
            }
            const reconType = resolveReconType(payment, fallbackTitle);
            const theme = RECON_THEMES[reconType] || RECON_THEMES.DUTY;
            const displayRef = (payment.reference || payment.description || '---').replace(/\[Vinculado:[^\]]+\]/g, '').trim();
            return {
                vinculadorName,
                vinculadoEm,
                displayRef,
                bankDisplay: getPaymentBankDisplay(payment),
                ownerDisplay: payment.account_owner || '',
                dateDisplay: payment.date ? payment.date.split(' ')[0] : '---',
                formattedAmount: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(payment.amount),
                reconType,
                theme,
                typeBadgeHtml: `<span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${theme.badge}">${reconType}</span>`
            };
        };

        // FUNÇÃO AUXILIAR PARA GERAR O HTML DE RECONCILIAÇÃO E BUSCAR SIBLINGS (GRADE / LISTA UNIFICADA)
        const renderReconciliationBlock = (pmts, title = 'Detalhes de Reconciliação', color = 'blue', meta = null) => {
            if (!pmts || pmts.length === 0) return '';
            const userRole = pb.authStore.model?.role || 'USER';
            const canUnallocate = (userRole !== 'USER' && userRole !== 'USER_L1');
            // Regra de visualização padrão:
            // - 1 reconciliação: default 'list'
            // - 2 reconciliações: default 'grid'
            // - 3 ou mais: a critério do usuário (preferência salva)
            let currentMode;
            if (pmts.length === 1) {
                currentMode = 'list';
            } else if (pmts.length === 2) {
                currentMode = 'grid';
            } else {
                const userChoice = (typeof window !== 'undefined' && window.reconciliationUserChoice)
                    ? window.reconciliationUserChoice
                    : (typeof localStorage !== 'undefined' ? (localStorage.getItem('reconciliation_user_choice') || 'list') : 'list');
                currentMode = userChoice;
            }
            window.reconciliationViewMode = currentMode;

            let gridColsClass = 'grid-cols-1';
            if (pmts.length === 2) {
                gridColsClass = 'grid-cols-1 md:grid-cols-2';
            } else if (pmts.length >= 3) {
                gridColsClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
            }

            let html = `
                <div class="mb-3.5 reconciliation-block w-full">
                    <!-- Toggle Grade vs Lista (Estilo Confirm & Armazém - Apenas Ícones) -->
                    <div class="flex items-center justify-end mb-2.5">
                        <div class="bg-slate-100 p-1 rounded-xl flex items-center shadow-inner border border-slate-200">
                            <button type="button" onclick="ui.setReconciliationViewMode('grid')" 
                                class="btn-recon-view-grid px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer select-none ${currentMode === 'grid' ? 'shadow-sm bg-white text-slate-800' : 'bg-transparent text-slate-400 hover:text-slate-600'}" 
                                title="Visualização em Grade">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            </button>
                            <button type="button" onclick="ui.setReconciliationViewMode('list')" 
                                class="btn-recon-view-list px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer select-none ${currentMode === 'list' ? 'shadow-sm bg-white text-slate-800' : 'bg-transparent text-slate-400 hover:text-slate-600'}" 
                                title="Visualização em Lista">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>

                    <!-- 1. MODO GRADE (Cards com Ocupação Total do Espaço Horizontal e Máximo de 3 por Linha) -->
                    <div class="recon-grid-view ${currentMode === 'grid' ? '' : 'hidden'} grid ${gridColsClass} gap-3.5 w-full">
            `;

            pmts.forEach((payment) => {
                const {
                    vinculadorName, vinculadoEm, displayRef, bankDisplay,
                    ownerDisplay, dateDisplay, formattedAmount, reconType, theme, typeBadgeHtml
                } = extractReconMeta(payment, title);

                html += `
                    <div class="${theme.card} p-3.5 sm:p-4 rounded-xl border shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between w-full">
                        <div>
                            <!-- Topo: Tipo (DUTY/FRETE/ARMAZEM), Banco, Titular e Data -->
                            <div class="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b ${theme.divider}">
                                <div class="flex items-center gap-1.5 truncate text-[10.5px] font-bold text-slate-700">
                                    ${typeBadgeHtml}
                                    <span>${bankDisplay}</span>
                                    ${ownerDisplay ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-white/90 text-slate-600 border border-slate-200/70 font-semibold truncate max-w-[130px]">${ownerDisplay}</span>` : ''}
                                </div>
                                <span class="text-[9.5px] text-slate-400 font-mono shrink-0">${dateDisplay}</span>
                            </div>

                            <!-- Valor em Destaque & ID -->
                            <div class="flex items-baseline justify-between gap-1 my-1.5">
                                <span class="text-[15px] font-black ${theme.amountText} tracking-tight">${formattedAmount} <small class="text-[10px] font-bold text-slate-400">MT</small></span>
                                <span class="text-[8.5px] font-mono text-slate-400">#${payment.id.slice(-6)}</span>
                            </div>

                            <!-- Referência -->
                            <div class="text-[10px] text-slate-700 ${theme.refBox} p-2 rounded-lg border truncate mb-2" title="${displayRef.replace(/"/g, '&quot;')}">
                                <span class="font-bold text-slate-400 uppercase text-[8px] mr-1">Ref:</span>${displayRef}
                            </div>
                        </div>

                        <!-- Rodapé: Vinculador & Desalocar -->
                        <div class="pt-2 border-t ${theme.divider} flex items-center justify-between gap-2">
                            <div class="text-[9px] text-slate-500 truncate max-w-[160px]" title="${vinculadorName ? `Vinculado por ${vinculadorName}${vinculadoEm ? ` em ${vinculadoEm}` : ''}` : ''}">
                                ${vinculadorName ? `
                                    <span class="flex items-center gap-1 truncate">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-blue-500 shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>
                                        <strong class="font-bold text-slate-700 truncate">${vinculadorName}</strong>
                                    </span>
                                ` : '<span class="text-slate-400 italic">Vinculado</span>'}
                            </div>

                            ${canUnallocate ? `
                                <button type="button" onclick="event.stopPropagation(); window.confirmUnallocatePayment('${payment.id}', ${payment.amount}, '${displayRef.replace(/'/g, "\\'")}', '${reconType}')"
                                    class="py-1 px-2.5 text-[9px] font-black uppercase text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                                    title="Desalocar este pagamento">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="9.5" height="9.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                                    <span>Desalocar</span>
                                </button>
                            ` : ''}
                        </div>

                        <!-- Container para Subdivisões (Siblings) em Grade -->
                        <div id="siblings-grid-${payment.id}"></div>
                    </div>
                `;
            });

            html += `</div>`; // Fecho do recon-grid-view

            // 2. MODO LISTA (Separado em Cards Dedicados: DUTY, FRETE, ARMAZEM e DESPACHO)
            const dutyPayments = pmts.filter(p => resolveReconType(p, title) === 'DUTY');
            const fretePayments = pmts.filter(p => resolveReconType(p, title) === 'FRETE');
            const armazemPayments = pmts.filter(p => resolveReconType(p, title) === 'ARMAZEM');
            const despachoListPayments = pmts.filter(p => resolveReconType(p, title) === 'DESPACHO');

            const renderListRow = (payment) => {
                const {
                    vinculadorName, vinculadoEm, displayRef, bankDisplay,
                    ownerDisplay, dateDisplay, formattedAmount, reconType, theme, typeBadgeHtml
                } = extractReconMeta(payment, title);

                return `
                    <tr class="${theme.rowHover} transition-colors">
                        <td class="py-2.5 px-2 text-center whitespace-nowrap">
                            ${typeBadgeHtml}
                        </td>
                        <td class="py-2.5 px-2.5">
                            <div class="truncate">
                                <span class="font-bold text-slate-800 text-[10.5px] truncate block">${bankDisplay}</span>
                                ${ownerDisplay ? `<span class="inline-block text-[8px] px-1.5 py-0.2 rounded bg-white/90 border border-slate-200/70 text-slate-600 font-semibold truncate max-w-full">${ownerDisplay}</span>` : ''}
                            </div>
                        </td>
                        <td class="py-2.5 px-2 font-mono text-[9.5px] text-slate-500 whitespace-nowrap">${dateDisplay}</td>
                        <td class="py-2.5 px-2.5 text-slate-700 truncate" title="${displayRef.replace(/"/g, '&quot;')}">
                            ${displayRef}
                        </td>
                        <td class="py-2.5 px-3 text-right font-black text-xs ${theme.amountText} whitespace-nowrap">
                            ${formattedAmount} <span class="text-[8.5px] font-bold text-slate-400">MT</span>
                        </td>
                        <td class="py-2.5 px-2 text-slate-600">
                            ${vinculadorName ? `
                                <div class="truncate" title="${vinculadorName}${vinculadoEm ? ` (${vinculadoEm})` : ''}">
                                    <span class="font-bold text-slate-800 text-[10px] block truncate">${vinculadorName}</span>
                                    ${vinculadoEm ? `<span class="text-[8.5px] text-slate-400 font-mono block">${vinculadoEm.split(' ')[0]}</span>` : ''}
                                </div>
                            ` : '<span class="text-slate-300 italic">—</span>'}
                        </td>
                        <td class="py-2.5 px-2 text-right whitespace-nowrap pr-3">
                            ${canUnallocate ? `
                                <button type="button" onclick="event.stopPropagation(); window.confirmUnallocatePayment('${payment.id}', ${payment.amount}, '${displayRef.replace(/'/g, "\\'")}', '${reconType}')"
                                    class="py-1 px-2.5 text-[9px] font-black uppercase text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg transition-all inline-flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                                    title="Desalocar este pagamento">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="9.5" height="9.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                                    <span>Desalocar</span>
                                </button>
                            ` : '<span class="text-slate-300">—</span>'}
                        </td>
                    </tr>
                    <!-- Linha para Siblings em Lista (se existirem) -->
                    <tr id="siblings-row-${payment.id}" class="hidden">
                        <td colspan="7" class="p-2 border-b ${theme.sibRowBorder}">
                            <div id="siblings-list-${payment.id}" class="px-3 py-2 bg-white/60 rounded-lg border ${theme.sibBoxBorder} shadow-2xs"></div>
                        </td>
                    </tr>
                `;
            };

            const renderListTable = (type, paymentsList) => {
                if (!paymentsList || paymentsList.length === 0) return '';
                const theme = RECON_THEMES[type] || RECON_THEMES.DUTY;

                let rowsHtml = '';
                paymentsList.forEach(p => { rowsHtml += renderListRow(p); });

                return `
                    <div class="overflow-hidden rounded-xl border ${theme.tableBorder} ${theme.tableBg} shadow-2xs w-full">
                        <table class="w-full table-fixed text-left text-xs border-collapse">
                            <colgroup>
                                <col style="width: 75px;">
                                <col style="width: 160px;">
                                <col style="width: 85px;">
                                <col style="width: auto;">
                                <col style="width: 125px;">
                                <col style="width: 135px;">
                                <col style="width: 110px;">
                            </colgroup>
                            <thead class="${theme.thBg} text-[9px] uppercase font-black border-b">
                                <tr>
                                    <th class="py-2.5 px-2 text-center">Tipo</th>
                                    <th class="py-2.5 px-2.5">Banco & Titular</th>
                                    <th class="py-2.5 px-2">Data Extrato</th>
                                    <th class="py-2.5 px-2.5">Referência</th>
                                    <th class="py-2.5 px-3 text-right">Valor</th>
                                    <th class="py-2.5 px-2">Vinculado Por</th>
                                    <th class="py-2.5 px-2 text-right pr-3">Ação</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y ${theme.tbodyDivide} text-[10.5px]">
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                `;
            };

            html += `
                <div class="recon-list-view ${currentMode === 'list' ? '' : 'hidden'} space-y-3 w-full">
                    ${renderListTable('DUTY', dutyPayments)}
                    ${renderListTable('FRETE', fretePayments)}
                    ${renderListTable('ARMAZEM', armazemPayments)}
                    ${renderListTable('DESPACHO', despachoListPayments)}
                </div>
            `;

            html += `</div>`; // Fecho do card container

            // Lógica para carregar detalhes de partilha (siblings) tanto no grid quanto na lista
            setTimeout(async () => {
                for (const p of pmts) {
                    if (p.reference && p.reference.includes("(Ref Mestre:")) {
                        const siblings = await getPaymentsByMasterRef(p.reference);
                        if (siblings.length > 1) {
                            let originalTotal = 0;
                            let sibRowsHtml = '';
                            const reconType = resolveReconType(p, title);
                            const theme = RECON_THEMES[reconType] || RECON_THEMES.DUTY;

                            siblings.forEach(s => {
                                originalTotal += s.amount;
                                const isCurrent = s.id === p.id;
                                const dest = s.allocated_to || 'Livre / Não Alocado';
                                const activeClass = isCurrent ? theme.sibActive : 'text-slate-500';
                                sibRowsHtml += `
                                    <div class="flex justify-between items-center text-[9px] py-0.5 ${activeClass}">
                                        <span class="truncate max-w-[160px]">${dest}</span>
                                        <span>${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(s.amount)} MT</span>
                                    </div>
                                `;
                            });

                            const sibBoxContent = `
                                <div class="mt-1 pt-1 text-[8.5px]">
                                    <div class="text-[8px] font-black ${theme.sibTitle} uppercase mb-0.5">Partilha deste Movimento:</div>
                                    <div class="space-y-0.5">${sibRowsHtml}</div>
                                    <div class="flex justify-between items-center text-[8.5px] font-black text-slate-700 pt-1 border-t ${theme.sibDivider} mt-1">
                                        <span>TOTAL ORIGINAL:</span>
                                        <span>${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(originalTotal)} MT</span>
                                    </div>
                                </div>
                            `;

                            // Injetar no Grid
                            const elGrid = document.getElementById(`siblings-grid-${p.id}`);
                            if (elGrid) elGrid.innerHTML = sibBoxContent;

                            // Injetar na Lista
                            const elList = document.getElementById(`siblings-list-${p.id}`);
                            const rowList = document.getElementById(`siblings-row-${p.id}`);
                            if (elList && rowList) {
                                elList.innerHTML = sibBoxContent;
                                rowList.classList.remove('hidden');
                            }
                        }
                    }
                }
            }, 100);

            return html;
        };

        const allReconPayments = [];
        let dutySum = 0;
        let freightSum = 0;
        let storageSum = 0;
        let despachoSum = 0;

        if (payments && payments.length > 0) {
            payments.forEach(p => {
                totalAllocated += p.amount;
                dutySum += p.amount;
                allReconPayments.push({ ...p, reconType: 'DUTY' });
            });
        }

        if (freightPayments && freightPayments.length > 0) {
            freightPayments.forEach(p => {
                freightSum += p.amount;
                allReconPayments.push({ ...p, reconType: 'FRETE' });
            });
        }

        if (storagePayments && storagePayments.length > 0) {
            storagePayments.forEach(p => {
                storageSum += p.amount;
                allReconPayments.push({ ...p, reconType: 'ARMAZEM' });
            });
        }

        if (despachoPayments && despachoPayments.length > 0) {
            despachoPayments.forEach(p => {
                despachoSum += p.amount;
                allReconPayments.push({ ...p, reconType: 'DESPACHO' });
            });
        }

        if (allReconPayments.length > 0) {
            pbHtml += renderReconciliationBlock(allReconPayments, 'Detalhes de Reconciliação', 'blue', { dutySum, freightSum, storageSum, despachoSum });
        }

        // 1. Fonte Primária: Google Sheets (Planilha)
        let gSheetRemaining = null;
        if (totalGSheetBalance !== undefined && totalGSheetBalance !== null && !isNaN(totalGSheetBalance) && totalGSheetBalance > 0.01) {
            gSheetRemaining = totalGSheetBalance;
        } else if (allConfirmed) {
            gSheetRemaining = 0;
        } else if (totalAmountDuty > 0) {
            if (totalAllocated > 0) {
                gSheetRemaining = Math.max(0, targetAmount - totalAllocated);
            } else {
                gSheetRemaining = targetAmount;
            }
        }

        // 2. Fonte de Segurança / Auditoria: PocketBase (contingência se a planilha não conseguir determinar)
        let trueRemaining = 0;
        if (gSheetRemaining !== null && !isNaN(gSheetRemaining)) {
            trueRemaining = gSheetRemaining;
        } else if (targetAmount > 0 && totalAllocated > 0) {
            trueRemaining = Math.max(0, targetAmount - totalAllocated);
        } else {
            trueRemaining = Math.max(0, targetAmount);
        }

        let remainingToPay = trueRemaining;

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
                            <th class="py-1 px-4 text-[10px] font-normal uppercase tracking-wider border-b border-slate-200">Order Number</th>
                            <th class="py-1 px-4 text-[10px] font-normal uppercase tracking-wider text-center border-b border-slate-200">CBM</th>
                            <th class="py-1 px-4 text-[10px] font-normal uppercase tracking-wider text-center border-b border-slate-200">Amount Duty</th>
                            <th class="py-1 px-4 text-[10px] font-normal uppercase tracking-wider text-center border-b border-slate-200">Duty Prepaid</th>
                            <th class="py-1 px-4 text-[10px] font-normal uppercase tracking-wider text-center border-b border-slate-200">Paid</th>
                            <th class="py-1 px-4 text-[10px] font-normal uppercase tracking-wider text-center border-b border-slate-200">Balance</th>
                            <th class="py-1 px-4 text-[10px] font-normal uppercase tracking-wider text-center border-b border-slate-200">Bank in Duty</th>
                            <th class="py-1 px-4 text-[10px] font-normal uppercase tracking-wider text-center border-b border-slate-200">Confirmação</th>
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

    // Abrir pasta automaticamente se existir número e nome (apenas se for um cliente diferente)
    if (window.autoOpenClientFolder && !isSameClient) {
        window.autoOpenClientFolder(client.no || '', client.displayName);
    }

    // Atualizar UI dos Locks
    updateLocksUI();

    // Configurar e limpar seletores em massa
    const role = pb.authStore.model?.role || 'USER';
    const isL1 = role === 'USER' || role === 'USER_L1';
    const isAdmin = role === 'ADMIN';

    // Botão Adicionar Artigo (Apenas Administrador)
    const addArticleBtn = document.getElementById('btn-add-confirm-article');
    if (addArticleBtn) {
        if (isAdmin) {
            addArticleBtn.classList.remove('hidden');
        } else {
            addArticleBtn.classList.add('hidden');
        }
    }

    // Botão de Histórico de Auditoria (Apenas se existirem registos)
    setAuditHistoryButtonVisible(Boolean(auditLogs && auditLogs.length > 0));

    closeBulkActionsPanel();
    resetBulkDropdownsUI(isL1);
    // Atualizar UI do Armazém
    const pkgEl = document.getElementById('armazem-total-packages');
    const cbmEl = document.getElementById('armazem-total-volume');

    if (pkgEl) pkgEl.innerText = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(totalPackages));
    if (cbmEl) cbmEl.innerText = formatValue(totalCbm);

    // Renderizar tabela e controlo de entrega do Armazém
    await renderArmazemDetails(client, totalBalanceFreight, totalAmountFreight, allConfirmed, storagePayments, despachoPayments);

    // Botão Mini de Frete na aba Confirm
    const miniFreightBtn = document.getElementById('btn-confirm-freight-mini');
    const miniFreightStatus = document.getElementById('confirm-freight-mini-status');
    if (miniFreightBtn && miniFreightStatus) {
        if (totalAmountFreight > 0 || totalPaidFreight > 0 || totalBalanceFreight > 0) {
            miniFreightBtn.dataset.hasFreight = 'true';
            miniFreightBtn.classList.remove('hidden');
            if (totalAmountFreight > 0 && (totalBalanceFreight <= 0 || totalPaidFreight >= totalAmountFreight)) {
                miniFreightStatus.innerText = 'PAGO';
                miniFreightStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-green-100 text-green-700';
                miniFreightBtn.title = 'Frete totalmente pago';
                miniFreightBtn.classList.remove('cursor-pointer', 'active:scale-95');
                miniFreightBtn.classList.add('cursor-default');
            } else if (totalPaidFreight > 0 && totalBalanceFreight > 0) {
                miniFreightStatus.innerText = 'PARCIAL';
                miniFreightStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-700';
                miniFreightBtn.title = 'Clique para atualizar frete (Saldo Pendente)';
                miniFreightBtn.classList.add('cursor-pointer', 'active:scale-95');
                miniFreightBtn.classList.remove('cursor-default');
            } else {
                miniFreightStatus.innerText = 'PENDENTE';
                miniFreightStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700';
                miniFreightBtn.title = 'Clique para atualizar frete (Pendente)';
                miniFreightBtn.classList.add('cursor-pointer', 'active:scale-95');
                miniFreightBtn.classList.remove('cursor-default');
            }
        } else {
            miniFreightBtn.dataset.hasFreight = 'false';
            miniFreightBtn.classList.add('hidden');
        }
    }

    // Regras de Visibilidade da Aba Armazém:
    // Ocultar quando o valor ainda não estiver vinculado e com o frete não pago
    const isDutySettled = (payments && payments.length > 0) || allConfirmed || isFullyPrepaid || (totalAmountDuty <= 0);
    const isFreightPaid = (totalAmountFreight <= 0) || (totalBalanceFreight <= 0) || (totalPaidFreight >= totalAmountFreight) || (freightPayments && freightPayments.length > 0);
    
    const motivoIsencaoColIdx = findColumnIndex(columns, ['MOTIVO ISENCAO ARMAZENAGEM', 'MOTIVO ISENCAO', 'MOTIVO DE ISENCAO', 'MOTIVO']);
    const isExtraordinaria = client.rows?.some(r => {
        const raw = motivoIsencaoColIdx !== -1 ? String(r.originalRow[motivoIsencaoColIdx] || '') : '';
        return raw.toUpperCase().includes('[EXTRAORDINÁRIA]') || raw.toUpperCase().includes('[EXTRAORDINARIA]');
    }) || false;

    const isArmazemAllowed = isExtraordinaria || (isDutySettled && isFreightPaid);
    window.currentClientArmazemAllowed = isArmazemAllowed;

    const armazemTab = document.getElementById('btn-tab-armazem');
    if (armazemTab) {
        if (isArmazemAllowed) {
            armazemTab.classList.remove('hidden');
            armazemTab.style.display = '';
        } else {
            armazemTab.classList.add('hidden');
            armazemTab.style.display = 'none';
        }
    }

    // Botão Mini / Card de Armazenagem na aba Confirm
    // Quando o armazém for igual a 0 (ou isento), não mostrar o card ARMAZEM
    const miniStorageBtn = document.getElementById('btn-confirm-storage-mini');
    const miniStorageStatus = document.getElementById('confirm-storage-mini-status');
    const stInfo = window.currentClientStorageInfo;
    if (miniStorageBtn && miniStorageStatus) {
        if (!stInfo || (stInfo.cost <= 0 && !stInfo.paidAmount) || stInfo.isExempt) {
            miniStorageBtn.classList.add('hidden');
        } else {
            miniStorageBtn.classList.remove('hidden');
            if (stInfo.isPartial) {
                miniStorageStatus.innerText = `PARCIAL (FALTA ${formatMZN(stInfo.remainingBalance)})`;
                miniStorageStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-extrabold';
            } else if (!stInfo.isPaid) {
                miniStorageStatus.innerText = `PENDENTE (${formatMZN(stInfo.cost)})`;
                miniStorageStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-extrabold animate-pulse';
            } else {
                miniStorageStatus.innerText = `PAGO (${formatMZN(stInfo.cost)})`;
                miniStorageStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold';
            }
        }
    }

    // Restaurar/manter a aba ativa correspondente
    let activeTab = 'confirm';
    if (isSameClient && isArmazemAllowed) {
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

    const updatedRows = [];

    client.rows.forEach(r => {
        const rowIndex = r.originalIndex;
        const rowNum = rowIndex + 1;
        const rawRow = (state.confirm?.data && state.confirm.data[rowIndex]) || r.originalRow || [];
        const rowData = [...rawRow];

        // 1. NOTA DUTY
        const existingNote = rowData[notaDutyIdx] !== undefined && rowData[notaDutyIdx] !== null && rowData[notaDutyIdx] !== '—' ? String(rowData[notaDutyIdx]).trim() : '';
        const newNote = existingNote ? `${existingNote} | Resposta: ${cleanReply}` : `Resposta: ${cleanReply}`;
        rowData[notaDutyIdx] = newNote;
        batchUpdates.push({
            range: formatSheetRange(sheetName, `${getColLetter(notaDutyIdx)}${rowNum}`),
            values: [[newNote]]
        });

        // 2. CONFIRMATION para "?"
        rowData[statusIdx] = '?';
        batchUpdates.push({
            range: formatSheetRange(sheetName, `${getColLetter(statusIdx)}${rowNum}`),
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

        // Emitir atualização em tempo real para sincronização SSE entre clientes
        updatedRows.forEach(item => {
            emitConfirmEvent(state.confirm.sheetId, item.rowIndex, 'UPDATE', { rowData: item.rowData });
        });

        toast('Resposta gravada e estado alterado para Pendente!', 'success');

        // Re-renderizar o detalhe do cliente
        await showConfirmDetail(client, window.currentActiveClientIndex);
    } catch (err) {
        console.error('[CONFIRM-REPLY] Erro ao gravar resposta:', err);
        toast('Erro ao gravar dados no GSheet: ' + err.message, 'error');
    } finally {
        setLoader(false);
        closeBulkActionsPanel();
    }
}

/**
 * Confirma e executa a desalocação de um pagamento bancário no PocketBase.
 * Liberta o movimento para ficar disponível novamente para o cliente correto.
 */
export async function confirmUnallocatePayment(paymentId, amount, ref, type = 'DUTY') {
    const role = pb.authStore.model?.role || 'USER';
    if (role === 'USER' || role === 'USER_L1') {
        alert("Acesso Negado: A desalocação de pagamentos exige nível de permissão Nível 2 ou Administrador.");
        return;
    }

    const formattedAmount = formatMZN(amount);
    const clientNo = window.currentActiveClient?.no || '';
    const clientName = window.currentActiveClient?.displayName || window.currentActiveClient?.name || '';
    const sheetId = state.confirm?.sheetId || '';

    const confirmMsg = `Tem a certeza que deseja desalocar este movimento bancário de ${formattedAmount} deste cliente?\n\n` +
        `• O movimento voltará a ficar LIVRE no sistema e poderá ser atribuído ao cliente correto.\n` +
        `• Se foi uma divisão (split), o valor será reintegrado ao movimento mestre se este estiver livre.\n\n` +
        `Confirmar desalocação?`;

    if (!confirm(confirmMsg)) return;

    try {
        if (typeof showLoader === 'function') showLoader();

        const res = await unallocatePayment(paymentId);

        const prevAllocUpper = String(res?.prevAllocatedTo || '').toUpperCase();
        const feeKeyUnalloc = (type === 'DESPACHO' || prevAllocUpper.startsWith('DESPACHO'))
            ? 'DESPACHO'
            : ((type === 'ARMAZEM' || prevAllocUpper.startsWith('ARMAZEM')) ? 'STORAGE' : null);
        if (feeKeyUnalloc && window.currentActiveClient && window.currentActiveClient.rows && state.confirm?.sheetId) {
            try {
                const prefixLabel = feeKeyUnalloc === 'DESPACHO' ? 'DESPACHO' : 'ARMAZEM';
                await syncClientFeeAfterUnallocate(feeKeyUnalloc, window.currentActiveClient, res?.prevAllocatedTo || `${prefixLabel} - ${clientNo}`);
            } catch (syncErr) {
                console.warn(`[${feeKeyUnalloc}] Aviso ao sincronizar GSheet após desalocação:`, syncErr);
            }
        }

        // Registar auditoria detalhada
        try {
            await logConfirmAudit(sheetId, clientNo, clientName, 'PAGAMENTO_DESALOCADO', {
                paymentId,
                amount,
                ref,
                tipo: type,
                mergedWithMaster: Boolean(res.mergedWithMaster),
                masterId: res.masterId || ''
            });
        } catch (auditErr) {
            console.warn('[Audit] Erro ao registar auditoria de desalocação:', auditErr);
        }

        const successMsg = `Movimento de ${formattedAmount} desalocado com sucesso! O pagamento está agora LIVRE.`;
        if (typeof toast === 'function') {
            toast(successMsg, "success");
        } else if (typeof ui.toast === 'function') {
            ui.toast(successMsg, "success");
        } else {
            alert(successMsg);
        }

        // Atualizar os detalhes do cliente se estiver aberto
        if (window.currentActiveClient) {
            await showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
        }

        // Se a lista de movimentos bancários estiver visível ou aberta, atualizar
        if (typeof renderBankIncomes === 'function' && state.bank && state.bank.incomes) {
            const item = state.bank.incomes.find(b => b.id === paymentId);
            if (item) {
                item.reconciled = false;
                item.allocated_to = '';
            }
            renderBankIncomes();
        }

        // Se o mini filtro de pagamentos estiver aberto, atualizar a pesquisa
        const miniFilterModal = document.getElementById('payment-mini-filter');
        if (miniFilterModal && !miniFilterModal.classList.contains('hidden')) {
            if (typeof searchPaymentMiniFilter === 'function') {
                searchPaymentMiniFilter();
            }
        }
    } catch (err) {
        console.error("Erro ao desalocar pagamento:", err);
        alert("Erro ao desalocar pagamento: " + (err.message || err));
    } finally {
        if (typeof hideLoader === 'function') hideLoader();
    }
}
window.confirmUnallocatePayment = confirmUnallocatePayment;

/**
 * Abre o modal que lista mercadorias pendentes no armazém, 
 * verificando o status de pagamento de Duty e Frete de cada uma.
 */
export async function openWarehouseStatusModal() {
    if (!state.confirm || !state.confirm.data) return;
    
    const columns = state.confirm.columns || [];
    const findCol = (targets, opts) => findWarehouseCol(columns, targets, opts);

    const idCodeIdx = findCol(['ID CODE', 'CODE ID', 'ID']);
    const nameIdx = findCol(['NAME', 'NOME', 'CLIENTE', 'CLIENT']);
    const balanceIdx = findCol(['BALANCE', 'BALANCO', 'SALDO'], { exclude: ['FREIGHT'] });
    const statusIdx = findCol(['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);
    
    const deliveredIdx = findCol(['DELIVERED', 'ENTREGUE']);
    const balanceFreightIdx = findCol(['BALANCE FREIGHT', 'SALDO FRETE']);
    const packagesIdx = findCol(['PACKAGES', 'VOLUMES', 'QTIES']);

    const phoneIdx = findCol(['PHONE NUMBER', 'PHONE', 'TELEFONE', 'CELULAR', 'PHONE_NUMBER', 'TEL', 'MOBILE']);
    const contactoIdx = findCol(['CONTACTO', 'CONTACT']);
    const contactNoteIdx = findCol(['NOTA CONTACTO', 'ESTADO CONTACTO', 'OBS CONTACTO', 'NOTA ARMAZEM', 'OBS ARMAZEM', 'CONTACT NOTE']);

    const dischargeDateStr = state.confirm?.dischargeDate || '';

    // Buscar pagamentos bancários vinculados à armazenagem em 1 consulta única
    const storagePmtsByAllocKey = new Map();
    try {
        const allStoragePmts = await getPaymentsByAllocatedPrefix('ARMAZEM - ');
        if (Array.isArray(allStoragePmts)) {
            allStoragePmts.forEach(p => {
                const key = String(p.allocated_to || '').trim().toUpperCase();
                if (!key) return;
                if (!storagePmtsByAllocKey.has(key)) storagePmtsByAllocKey.set(key, []);
                storagePmtsByAllocKey.get(key).push(p);
            });
        }
    } catch (e) {
        console.warn('[WAREHOUSE MODAL] Aviso ao carregar vínculos bancários de armazém:', e);
    }
    
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
    
    for (let i = 1; i < state.confirm.data.length; i++) {
        const row = state.confirm.data[i];
        if (!row || row.length === 0) continue;
        
        const rowString = row.slice(0, 10).map(c => String(c || '').toUpperCase()).join(' ');
        if (rowString.includes('TOTAL')) continue;
        
        let idCode = idCodeIdx !== -1 ? String(row[idCodeIdx] || '').trim() : '';
        let name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
        let noVal = noIdx !== -1 ? String(row[noIdx] || '').trim() : '';
        
        if (idCode !== '') lastIdCode = idCode;
        else idCode = lastIdCode;
        
        if (name !== '') lastName = name;
        else name = lastName;
        
        if (noVal !== '') lastNo = noVal;
        else noVal = lastNo;
        
        if (!idCode && !name) continue;
        const groupId = `${idCode}_${name}`.replace(/\s+/g, '_') || `ROW_${i}`;
        
        if (!groupedClients.has(groupId)) {
            groupedClients.set(groupId, { idCode, name, no: noVal, rows: [] });
        }
        groupedClients.get(groupId).rows.push(row);
    }

    const groupedUndelivered = new Map();
    groupedClients.forEach((client, key) => {
        let hasUndelivered = false;
        client.rows.forEach(r => {
            const deliveredVal = deliveredIdx !== -1 ? String(r[deliveredIdx] || '').toUpperCase().trim() : '';
            if (deliveredVal !== 'SIM' && deliveredVal !== 'YES' && deliveredVal !== 'ENTREGUE') {
                hasUndelivered = true;
            }
        });
        if (hasUndelivered) {
            groupedUndelivered.set(key, client);
        }
    });
    
    // Obter o nome do projeto ativo
    const projectName = document.getElementById('confirm-project-active-name')?.innerText || 'Projeto Atual';

    let grandTotalQuantity = 0;
    let grandTotalStorage = 0;
    let grandTotalPendingStorage = 0;
    let grandTotalPaidStorage = 0;
    const clientList = [];

    groupedUndelivered.forEach((client, key) => {
        let totalDutyBalance = 0;
        let totalFreightBalance = 0;
        let totalQuantity = 0;
        let isDutyConfirmed = true;

        client.rows.forEach(r => {
            const bal = balanceIdx !== -1 ? parseFloat(String(r[balanceIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
            const status = statusIdx !== -1 ? String(r[statusIdx] || '').toUpperCase() : '';
            
            totalDutyBalance += bal;
            if (status === '' || status === 'PENDENTE' || status === 'AGUARDA PAGAMENTO' || status === '?' || status.includes('ERRADO')) {
                if (bal > 0) isDutyConfirmed = false;
            }
            
            const fBal = balanceFreightIdx !== -1 ? parseFloat(String(r[balanceFreightIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
            totalFreightBalance += fBal;
            
            const qty = packagesIdx !== -1 ? parseFloat(String(r[packagesIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
            totalQuantity += qty;
        });
        
        if (totalDutyBalance > 1.0) isDutyConfirmed = false;
        const isFreightConfirmed = totalFreightBalance <= 1.0;

        const baseAllocKey = `${client.no || ''} - ${projectName.trim()}`.replace(/(^ - )|( - $)/g, '').trim();
        const clientAllocKey = `ARMAZEM - ${baseAllocKey}`.toUpperCase();
        const clientBankStoragePmts = storagePmtsByAllocKey.has(clientAllocKey) ? storagePmtsByAllocKey.get(clientAllocKey) : [];

        const storageCalc = calculateClientStorage({
            rows: client.rows,
            columns,
            dischargeDateStr,
            bankPayments: clientBankStoragePmts
        });
        const storageInfo = storageCalc.storageInfo;
        const storageCost = storageInfo.cost;
        const isStoragePaid = storageInfo.isPaid;
        const isStoragePartial = storageInfo.isPartial;
        const storageRemaining = storageInfo.remainingBalance;
        const daysDiff = storageCalc.daysDiff;

        grandTotalQuantity += totalQuantity;
        grandTotalStorage += storageCost;
        if (isStoragePaid) {
            grandTotalPaidStorage += storageCost;
        } else {
            grandTotalPaidStorage += storageInfo.paidAmount || 0;
            grandTotalPendingStorage += storageRemaining;
        }

        // Extrair contacto/telefone do cliente
        let clientPhone = '';
        const phoneCols = [phoneIdx, contactoIdx].filter(idx => idx !== -1);
        for (const pIdx of phoneCols) {
            for (const r of client.rows) {
                const val = r[pIdx];
                if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '—' && String(val).trim() !== '-') {
                    clientPhone = String(val).trim();
                    break;
                }
            }
            if (clientPhone) break;
        }

        if (!clientPhone && state.confirm?.groupedClients) {
            const foundGroup = state.confirm.groupedClients.find(g => g.groupId === key);
            if (foundGroup) {
                if (foundGroup.clientPhone && foundGroup.clientPhone !== '—') clientPhone = foundGroup.clientPhone;
                else if (foundGroup.phone && foundGroup.phone !== '—') clientPhone = foundGroup.phone;
            }
        }

        let phoneHtml = '<span class="text-slate-300 font-normal text-[11px]">—</span>';
        if (clientPhone) {
            const rawParts = clientPhone.split(/(?:[,;/|]+)|(?:\s+e\s+)/i).map(p => p.trim()).filter(Boolean);
            const parts = [];
            rawParts.forEach(p => {
                const sub = p.split(/\s+/).filter(Boolean);
                if (sub.length > 1 && sub.every(s => /^\+?\d{8,12}$/.test(s))) {
                    parts.push(...sub);
                } else {
                    parts.push(p);
                }
            });

            if (parts.length > 0) {
                phoneHtml = `<div class="inline-flex items-center gap-1 flex-wrap">` + parts.map(part => `
                    <span onclick="event.stopPropagation(); window.copyToClipboard('${part.replace(/'/g, "\\'")}', 'Contacto ${part} copiado!')" 
                          class="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded font-semibold text-[10px] tracking-normal cursor-pointer transition-colors inline-flex items-center gap-1 select-all" 
                          title="Clique para copiar ${part}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        ${part}
                    </span>
                `).join('') + `</div>`;
            }
        }

        // Extrair nota de contacto sobre pagamento/retirada
        let contactNote = '';
        if (contactNoteIdx !== -1) {
            for (const r of client.rows) {
                const val = r[contactNoteIdx];
                if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '—' && String(val).trim() !== '-') {
                    contactNote = String(val).trim();
                    break;
                }
            }
        }
        if (!contactNote && state.confirm?.groupedClients) {
            const foundGroup = state.confirm.groupedClients.find(g => g.groupId === key);
            if (foundGroup && foundGroup.contactNote) {
                contactNote = String(foundGroup.contactNote).trim();
            }
        }

        let contactNoteHtml = '';
        if (contactNote) {
            contactNoteHtml = `
                <div class="flex items-center gap-1.5 group max-w-xs">
                    <span onclick="event.stopPropagation(); ui.openContactNoteModal('${key}')" 
                          class="text-[10px] text-slate-700 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 rounded-lg px-2 py-1 leading-snug cursor-pointer transition-all flex items-start gap-1 flex-1 select-all" 
                          title="Clique para editar: ${contactNote.replace(/"/g, '&quot;')}">
                        <span class="text-amber-600 font-bold flex-shrink-0">💬</span>
                        <span class="line-clamp-2">${contactNote}</span>
                    </span>
                    <button type="button" onclick="event.stopPropagation(); ui.openContactNoteModal('${key}')" 
                            class="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded transition-all cursor-pointer flex-shrink-0" 
                            title="Editar nota">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                </div>
            `;
        } else {
            contactNoteHtml = `
                <button type="button" onclick="event.stopPropagation(); ui.openContactNoteModal('${key}')" 
                        class="px-2 py-0.5 rounded-lg border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/70 text-slate-400 hover:text-indigo-600 font-bold text-[9px] uppercase tracking-wider transition-all inline-flex items-center gap-1 cursor-pointer"
                        title="Adicionar nota de contacto sobre pagamento/retirada">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Nota
                </button>
            `;
        }

        clientList.push({
            key,
            client,
            clientPhone,
            phoneHtml,
            contactNote,
            contactNoteHtml,
            totalQuantity,
            isDutyConfirmed,
            isFreightConfirmed,
            storageCost,
            isStoragePaid,
            isStoragePartial,
            storageRemaining,
            daysDiff
        });
    });
    
    let html = `
    <div id="modal-warehouse-status" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-2 sm:p-4 md:p-6" onclick="ui.closeModal('modal-warehouse-status')">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] xl:max-w-[1440px] 2xl:max-w-[1600px] max-h-[92vh] flex flex-col overflow-hidden animate-slide-up" onclick="event.stopPropagation()">
            
            <div id="warehouse-export-wrapper" class="flex flex-col flex-1 overflow-hidden bg-white">
                <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-wrap gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        </div>
                        <div>
                            <h2 class="text-lg font-black text-slate-800 tracking-tight">Mercadorias em Armazém - <span class="text-indigo-600">${projectName}</span></h2>
                            <div class="flex items-center gap-2 flex-wrap text-[11px] font-medium text-slate-500 mt-0.5">
                                <span>Data: ${new Date().toLocaleDateString('pt-PT')}</span>
                                <span>•</span>
                                <span class="bg-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded-md">Volumes: <strong>${grandTotalQuantity} Vol</strong></span>
                                <span class="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-100">Armazenagem Total: <strong>${formatMZN(grandTotalStorage)}</strong></span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2" id="modal-actions-exclude">
                        <button onclick="ui.downloadWarehouseImage()" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5 text-xs font-bold" title="Baixar Imagem PNG da Tabela">
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            <span>Imagem</span>
                        </button>
                        <button onclick="ui.downloadWarehousePDF()" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5 text-xs font-bold" title="Baixar PDF da Tabela">
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            <span>PDF</span>
                        </button>
                        <button onclick="ui.closeModal('modal-warehouse-status')" class="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors cursor-pointer ml-1" title="Fechar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                
                <div class="flex-1 overflow-auto p-4 bg-white custom-scrollbar relative">
                    <table id="warehouse-table-export" class="w-full min-w-full text-left border-collapse bg-white">
                        <thead class="sticky top-0 bg-white shadow-sm z-10">
                            <tr class="bg-slate-50/80">
                                <th class="px-2.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 w-10 text-center">#</th>
                                <th class="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 whitespace-nowrap">ID / Nº Processo</th>
                                <th class="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 min-w-[160px]">Cliente</th>
                                <th class="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 whitespace-nowrap">Contacto</th>
                                <th class="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 min-w-[180px]">Nota / Estado Contacto</th>
                                <th class="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 text-center whitespace-nowrap">Volumes</th>
                                <th class="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 text-center whitespace-nowrap">Duty</th>
                                <th class="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 text-center whitespace-nowrap">Frete</th>
                                <th class="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right whitespace-nowrap">Armazenagem</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 bg-white">
    `;
    
    if (clientList.length === 0) {
        html += `
            <tr>
                <td colspan="9" class="px-6 py-12 text-center text-slate-400">
                    <div class="flex justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <p class="text-sm font-bold text-slate-600">Nenhuma mercadoria pendente</p>
                    <p class="text-[11px]">Não há mercadorias retidas no armazém para este projeto.</p>
                </td>
            </tr>
        `;
    } else {
        clientList.forEach(item => {
            const dutyBadge = item.isDutyConfirmed 
                ? '<span class="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold text-[9px] uppercase">✅ Pago</span>'
                : '<span class="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[9px] uppercase">❌ Pendente</span>';
                
            const freightBadge = item.isFreightConfirmed
                ? '<span class="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold text-[9px] uppercase">✅ Pago</span>'
                : '<span class="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[9px] uppercase">❌ Pendente</span>';
            
            html += `
                <tr class="hover:bg-slate-50 transition-colors cursor-pointer" onclick="window.openClientFromWarehouse('${item.key}')" title="Clique para abrir detalhes do cliente">
                    <td class="px-2.5 py-2 text-[10px] font-bold text-slate-400 text-center">${item.client.no || ''}</td>
                    <td class="px-3 py-2 text-[11px] font-bold text-slate-700 whitespace-nowrap">${item.client.idCode}</td>
                    <td class="px-3 py-2 text-[11px] font-bold text-slate-900">${item.client.name}</td>
                    <td class="px-3 py-2 text-[11px] text-slate-600 whitespace-nowrap">${item.phoneHtml}</td>
                    <td class="px-3 py-2 text-[11px] text-slate-700">${item.contactNoteHtml}</td>
                    <td class="px-3 py-2 text-[11px] font-black text-slate-600 text-center whitespace-nowrap">${item.totalQuantity}</td>
                    <td class="px-3 py-2 text-center whitespace-nowrap">${dutyBadge}</td>
                    <td class="px-3 py-2 text-center whitespace-nowrap">${freightBadge}</td>
                    <td class="px-4 py-2 text-right whitespace-nowrap">
                        <span class="text-[11px] font-black ${item.storageCost > 0 ? (item.isStoragePaid ? 'text-green-700' : (item.isStoragePartial ? 'text-amber-700' : 'text-slate-900')) : 'text-slate-400'}">
                            ${formatMZN(item.storageCost)}
                        </span>
                        ${item.storageCost > 0 ? (item.isStoragePaid 
                            ? '<span class="ml-1 text-[8px] font-bold text-green-700 bg-green-100 px-1 py-0.5 rounded uppercase">Pago</span>' 
                            : (item.isStoragePartial
                                ? `<span class="ml-1 text-[8px] font-bold text-amber-800 bg-amber-100 px-1 py-0.5 rounded uppercase" title="Falta pagar ${formatMZN(item.storageRemaining)}">Parcial</span>`
                                : '<span class="ml-1 text-[8px] font-bold text-red-700 bg-red-100 px-1 py-0.5 rounded uppercase">Pendente</span>'))
                        : ''}
                    </td>
                </tr>
            `;
        });
    }
    
    html += `
                    </tbody>
                    ${clientList.length > 0 ? `
                    <tfoot class="sticky bottom-0 bg-slate-50 shadow-sm border-t-2 border-slate-200">
                        <tr class="font-black text-slate-800">
                            <td colspan="5" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-700">
                                TOTAL GERAL (${clientList.length} Clientes)
                            </td>
                            <td class="px-3 py-2.5 text-[11px] font-black text-center text-slate-900 whitespace-nowrap">
                                ${grandTotalQuantity} Vol
                            </td>
                            <td class="px-3 py-2.5 text-center text-[10px] text-slate-400">—</td>
                            <td class="px-3 py-2.5 text-center text-[10px] text-slate-400">—</td>
                            <td class="px-4 py-2.5 text-[12px] font-black text-right text-indigo-700 whitespace-nowrap">
                                ${formatMZN(grandTotalStorage)}
                            </td>
                        </tr>
                    </tfoot>
                    ` : ''}
                    </table>
                </div>
            </div>
        </div>
    </div>
    `;

    const modalsContainer = document.getElementById('modals-container');
    if (modalsContainer) {
        const existing = document.getElementById('modal-warehouse-status');
        if (existing) existing.remove();
        modalsContainer.insertAdjacentHTML('beforeend', html);
    }
}

export async function downloadWarehousePDF() {
    try {
        const tableEl = document.getElementById('warehouse-table-export');
        if (!tableEl) {
            toast('Tabela não encontrada.', 'error');
            return;
        }
        
        if (typeof window.jspdf === 'undefined') {
            toast('Biblioteca jsPDF não está carregada.', 'error');
            return;
        }
        
        setLoader(true, 'A gerar PDF com alta qualidade...');
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'pt', 'a4');
        
        const projectNameStr = document.getElementById('confirm-project-active-name')?.innerText || 'projeto';
        const safeName = projectNameStr.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Configurar Título
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59); // text-slate-800
        doc.text(`Mercadorias em Armazem - ${projectNameStr}`, 40, 40);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // text-slate-500
        doc.text(`Data do Relatorio: ${new Date().toLocaleDateString('pt-PT')} | Gerado pelo Bill-Check`, 40, 56);
        
        // Gerar Tabela Automática
        doc.autoTable({
            html: '#warehouse-table-export',
            startY: 75,
            theme: 'grid',
            headStyles: {
                fillColor: [79, 70, 229], // indigo-600
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                textColor: [71, 85, 105], // slate-600
                fontSize: 8.5
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252] // slate-50
            },
            footStyles: {
                fillColor: [241, 245, 249], // slate-100
                textColor: [30, 41, 59], // slate-800
                fontStyle: 'bold',
                fontSize: 9
            },
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' }, // #
                1: { cellWidth: 65 },                   // ID / Nº Processo
                2: { cellWidth: 90 },                   // Cliente
                3: { cellWidth: 65 },                   // Contacto
                4: { cellWidth: 85 },                   // Nota / Contacto
                5: { cellWidth: 40, halign: 'center' }, // Volumes
                6: { cellWidth: 45, halign: 'center' }, // Duty
                7: { cellWidth: 45, halign: 'center' }, // Frete
                8: { cellWidth: 60, halign: 'right' }   // Armazenagem
            },
            didParseCell: function(data) {
                // Limpar texto de Contacto na exportação
                if (data.section === 'body' && data.column.index === 3) {
                    const rawText = (data.cell.raw.innerText || data.cell.raw.textContent || '').replace(/[^\x00-\x7F\sA-Za-z0-9.,/+-]/g, '').trim();
                    data.cell.text = [rawText || '—'];
                }
                // Limpar texto de Nota na exportação
                if (data.section === 'body' && data.column.index === 4) {
                    let rawText = (data.cell.raw.innerText || data.cell.raw.textContent || '').replace(/[^\x00-\x7F\sA-Za-z0-9.,/+-]/g, '').trim();
                    if (rawText.toUpperCase() === 'NOTA' || rawText === '+ NOTA') rawText = '—';
                    data.cell.text = [rawText || '—'];
                }
                // Centralizar coluna de volumes
                if (data.column.index === 5) {
                    data.cell.styles.halign = 'center';
                }
                // Remove emojis and style status columns (Duty e Frete)
                if (data.section === 'body' && (data.column.index === 6 || data.column.index === 7)) {
                    const rawText = (data.cell.raw.innerText || data.cell.raw.textContent || '').toUpperCase();
                    if (rawText.includes('PAGO')) {
                        data.cell.text = ['PAGO'];
                        data.cell.styles.textColor = [22, 163, 74]; // green-600
                        data.cell.styles.fontStyle = 'bold';
                    } else if (rawText.includes('PENDENTE')) {
                        data.cell.text = ['PENDENTE'];
                        data.cell.styles.textColor = [220, 38, 38]; // red-600
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
                // Alinhar a coluna e rodapé de Armazenagem à direita
                if (data.column.index === 8) {
                    data.cell.styles.halign = 'right';
                    data.cell.styles.fontStyle = 'bold';
                    if (data.section === 'body') {
                        const rawText = (data.cell.raw.innerText || data.cell.raw.textContent || '').replace(/[^\x00-\x7F\sA-Za-z0-9.,-]/g, '').trim();
                        data.cell.text = [rawText];
                    }
                }
            }
        });
        
        doc.save(`armazem_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
        
        setLoader(false);
        toast('PDF descarregado com sucesso!', 'success');
    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        setLoader(false);
        alert('Falha ao gerar PDF: ' + err.message);
        toast('Erro ao gerar PDF.', 'error');
    }
}

export async function downloadWarehouseImage() {
    try {
        const wrapperEl = document.getElementById('warehouse-export-wrapper');
        if (!wrapperEl) {
            toast('Elemento da tabela não encontrado.', 'error');
            return;
        }
        if (typeof window.html2canvas === 'undefined') {
            toast('Biblioteca html2canvas não está carregada.', 'error');
            return;
        }
        setLoader(true, 'A gerar imagem PNG de alta resolução...');
        
        const projectNameStr = document.getElementById('confirm-project-active-name')?.innerText || 'projeto';
        const safeName = projectNameStr.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        const canvas = await window.html2canvas(wrapperEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            ignoreElements: (element) => element.id === 'modal-actions-exclude'
        });
        
        const link = document.createElement('a');
        link.download = `armazem_${safeName}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        setLoader(false);
        toast('Imagem descarregada com sucesso!', 'success');
    } catch (err) {
        console.error('Erro ao gerar imagem:', err);
        setLoader(false);
        toast('Erro ao gerar imagem: ' + (err.message || err), 'error');
    }
}
window.downloadWarehouseImage = downloadWarehouseImage;
window.downloadWarehousePDF = downloadWarehousePDF;

window.openClientFromWarehouse = function(groupId) {
    if (!state.confirm || !state.confirm.groupedClients) return;
    const client = state.confirm.groupedClients.find(g => g.groupId === groupId);
    if (client) {
        setLoader(true, 'A carregar cliente...');
        closeModal('modal-warehouse-status');
        
        setTimeout(async () => {
            try {
                await showConfirmDetail(client, client.no || '—');
            } catch (err) {
                console.error('[CONFIRM] Erro ao carregar detalhes do cliente:', err);
                toast('Erro ao abrir cliente: ' + (err.message || err), 'error');
            } finally {
                setLoader(false);
            }
        }, 50);
    } else {
        toast('Não foi possível carregar os detalhes do cliente.', 'error');
    }
};

window.openClientWithLoader = function(groupId) {
    if (!state.confirm || !state.confirm.groupedClients) return;
    const client = state.confirm.groupedClients.find(g => g.groupId === groupId);
    if (client) {
        setLoader(true, 'A carregar cliente...');
        setTimeout(async () => {
            try {
                await showConfirmDetail(client, client.no || '—');
            } catch (err) {
                console.error('[CONFIRM] Erro ao carregar detalhes do cliente:', err);
                toast('Erro ao abrir cliente: ' + (err.message || err), 'error');
            } finally {
                setLoader(false);
            }
        }, 50);
    } else {
        toast('Não foi possível carregar os detalhes do cliente.', 'error');
    }
};

/**
 * Garante que a coluna NOTA CONTACTO existe no GSheet e em memória
 */
const _ensureColumnLocks = new Map();

/**
 * Garante a existência de uma coluna opcional/estrutural na folha ativa, evitando duplicação por concorrência.
 * Quando options.insertAfterTargets é fornecido, insere a nova coluna imediatamente após a coluna âncora no GSheet e desloca a matriz local.
 */
export async function ensureConfirmColumn(canonicalHeader, matchTargets, options = {}) {
    const lockKey = `${state.confirm?.sheetId || 'local'}::${canonicalHeader}`;
    if (_ensureColumnLocks.has(lockKey)) {
        return _ensureColumnLocks.get(lockKey);
    }

    const taskPromise = (async () => {
        const columns = state.confirm.columns || (state.confirm.data && state.confirm.data[0]) || [];
        const existingIdx = findWarehouseCol(columns, matchTargets);
        if (existingIdx !== -1) return existingIdx;

        let cleanSheetName = '';
        if (state.confirm.range && state.confirm.range.includes('!')) {
            cleanSheetName = state.confirm.range.split('!')[0].replace(/^'+|'+$/g, '').trim();
        } else if (state.confirm.sheetTitle) {
            cleanSheetName = String(state.confirm.sheetTitle).trim();
        }

        const insertAfterTargets = options.insertAfterTargets;
        if (Array.isArray(insertAfterTargets) && insertAfterTargets.length > 0) {
            const anchorIdx = findWarehouseCol(columns, insertAfterTargets);
            const desiredIdx = anchorIdx !== -1 ? anchorIdx + 1 : columns.length;
            let effectiveIdx = desiredIdx;

            if (state.confirm.sheetId) {
                try {
                    const res = await insertGSheetColumn(state.confirm.sheetId, cleanSheetName, desiredIdx, canonicalHeader);
                    if (res && typeof res.columnIndex === 'number') {
                        effectiveIdx = res.columnIndex;
                    }
                    if (res && res.alreadyExists) {
                        const alreadyIdx = findWarehouseCol(columns, matchTargets);
                        if (alreadyIdx !== -1) return alreadyIdx;
                    }
                } catch (e) {
                    console.warn(`Erro ao inserir coluna ${canonicalHeader} no GSheet:`, e.message);
                }
            }

            const spliceAt = (arr, idx, fillVal) => {
                if (!Array.isArray(arr)) return;
                while (arr.length < idx) arr.push('');
                arr.splice(idx, 0, fillVal);
            };

            const origCols = state.confirm.columns;
            if (Array.isArray(origCols)) {
                spliceAt(origCols, effectiveIdx, canonicalHeader);
            } else {
                const cloned = [...columns];
                spliceAt(cloned, effectiveIdx, canonicalHeader);
                state.confirm.columns = cloned;
            }

            if (Array.isArray(state.confirm.data) && state.confirm.data.length > 0) {
                state.confirm.data.forEach((row, rIdx) => {
                    if (rIdx === 0 && row === origCols) return;
                    if (Array.isArray(row)) spliceAt(row, effectiveIdx, rIdx === 0 ? canonicalHeader : '');
                });
            }

            if (Array.isArray(state.confirm.notes)) {
                state.confirm.notes.forEach(noteRow => {
                    if (Array.isArray(noteRow)) spliceAt(noteRow, effectiveIdx, '');
                });
            }

            const syncGroupedRows = (clientsList) => {
                if (!Array.isArray(clientsList)) return;
                clientsList.forEach(gc => {
                    if (!Array.isArray(gc.rows)) return;
                    gc.rows.forEach(rObj => {
                        const backing = state.confirm.data?.[rObj.originalIndex];
                        if (rObj.originalRow && rObj.originalRow !== backing && Array.isArray(rObj.originalRow)) {
                            spliceAt(rObj.originalRow, effectiveIdx, '');
                        }
                    });
                });
            };
            syncGroupedRows(state.confirm.groupedClients);
            if (window.currentActiveClient) syncGroupedRows([window.currentActiveClient]);

            return effectiveIdx;
        }

        // Modo append no final do cabeçalho
        const newColumns = [...columns, canonicalHeader];
        const idx = newColumns.length - 1;
        const sheetPrefix = cleanSheetName ? `'${cleanSheetName.replace(/'/g, "''")}'!` : '';
        const lastColLetter = getColLetter(idx);
        const range = `${sheetPrefix}${lastColLetter}1`;

        try {
            state.confirm.columns = newColumns;
            if (state.confirm.data && state.confirm.data.length > 0) {
                state.confirm.data[0] = newColumns;
                for (let i = 1; i < state.confirm.data.length; i++) {
                    if (state.confirm.data[i] && Array.isArray(state.confirm.data[i])) {
                        while (state.confirm.data[i].length < newColumns.length) {
                            state.confirm.data[i].push('');
                        }
                    }
                }
            }
            if (state.confirm.sheetId) {
                await updateGSheet(state.confirm.sheetId, range, [[canonicalHeader]]);
            }
        } catch (e) {
            console.warn(`Erro ao criar coluna ${canonicalHeader} no GSheet:`, e.message);
        }

        return idx;
    })();

    _ensureColumnLocks.set(lockKey, taskPromise);
    try {
        return await taskPromise;
    } finally {
        _ensureColumnLocks.delete(lockKey);
    }
}

export function ensureContactNoteColumn() {
    return ensureConfirmColumn('NOTA CONTACTO', ['NOTA CONTACTO', 'ESTADO CONTACTO', 'OBS CONTACTO', 'NOTA ARMAZEM', 'OBS ARMAZEM', 'CONTACT NOTE']);
}
window.ensureContactNoteColumn = ensureContactNoteColumn;

export function ensureViaturaColumn() {
    return ensureConfirmColumn('VIATURA / MATRÍCULA', ['VIATURA', 'MATRICULA', 'VIATURA MATRICULA', 'PLACA', 'CARRO', 'VEICULO', 'VEHICLE']);
}
window.ensureViaturaColumn = ensureViaturaColumn;

export function ensureMotivoIsencaoColumn() {
    return ensureConfirmColumn('MOTIVO ISENCAO ARMAZENAGEM', ['MOTIVO ISENCAO ARMAZENAGEM', 'MOTIVO ISENCAO', 'MOTIVO DE ISENCAO']);
}
window.ensureMotivoIsencaoColumn = ensureMotivoIsencaoColumn;

export function ensureStorageValueColumn() {
    return ensureConfirmColumn(
        'STORAGE VALUE',
        ['STORAGE VALUE', 'VALOR ARMAZENAGEM', 'ARMAZENAGEM VALOR', 'STORAGE_VALUE'],
        { insertAfterTargets: ['STORAGE PAID', 'ARMAZENAGEM PAGO', 'STORAGE_PAID'] }
    );
}
window.ensureStorageValueColumn = ensureStorageValueColumn;

export async function ensureDespachoCopyColumns() {
    await ensureConfirmColumn(
        'COPIA DESPACHO',
        ['COPIA DESPACHO', 'COPIA DE DESPACHO', 'DESPACHO COPY', 'COPIA_DESPACHO'],
        { insertAfterTargets: ['DELIVERED', 'ENTREGUE', 'STORAGE VALUE', 'STORAGE PAID'] }
    );
    return ensureConfirmColumn(
        'COPIA DESPACHO VALOR',
        ['COPIA DESPACHO VALOR', 'VALOR COPIA DESPACHO', 'COPIA DESPACHO VALUE', 'DESPACHO VALUE', 'DESPACHO VALOR'],
        { insertAfterTargets: ['COPIA DESPACHO', 'COPIA DE DESPACHO', 'DESPACHO COPY', 'COPIA_DESPACHO'] }
    );
}
window.ensureDespachoCopyColumns = ensureDespachoCopyColumns;

/**
 * Abre o modal de edição de nota de contacto do cliente
 */
export function openContactNoteModal(clientKey) {
    if (!state.confirm || !state.confirm.data) {
        toast('Dados da tabela não carregados.', 'warning');
        return;
    }

    let clientName = '';
    let clientIdCode = '';
    let clientPhone = '';
    let currentNote = '';

    const columns = state.confirm.columns || state.confirm.data[0] || [];
    const cleanString = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
    
    const findCol = (targets) => {
        const cleaned = targets.map(cleanString);
        for (const t of cleaned) {
            const idx = columns.findIndex(c => cleanString(c) === t);
            if (idx !== -1) return idx;
        }
        for (const t of cleaned) {
            const idx = columns.findIndex(c => cleanString(c).includes(t));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const idCodeIdx = findCol(['ID CODE', 'CODE ID', 'ID']);
    const nameIdx = findCol(['NAME', 'NOME', 'CLIENTE', 'CLIENT']);
    const phoneIdx = findCol(['PHONE NUMBER', 'PHONE', 'TELEFONE', 'CELULAR', 'PHONE_NUMBER', 'TEL', 'MOBILE']);
    const contactoIdx = findCol(['CONTACTO', 'CONTACT']);
    const contactNoteIdx = findCol(['NOTA CONTACTO', 'ESTADO CONTACTO', 'OBS CONTACTO', 'NOTA ARMAZEM', 'OBS ARMAZEM', 'CONTACT NOTE']);

    // Procurar nas linhas do cliente
    const clientRows = [];
    let lastId = '';
    let lastName = '';
    for (let i = 1; i < state.confirm.data.length; i++) {
        const r = state.confirm.data[i];
        if (!r || r.length === 0) continue;
        const idVal = idCodeIdx !== -1 ? String(r[idCodeIdx] || '').trim() : '';
        const nameVal = nameIdx !== -1 ? String(r[nameIdx] || '').trim() : '';
        if (idVal) lastId = idVal;
        if (nameVal) lastName = nameVal;
        const gid = `${lastId}_${lastName}`.replace(/\s+/g, '_') || `ROW_${i}`;
        if (gid === clientKey) {
            clientRows.push({ row: r, index: i });
            if (!clientName) clientName = lastName;
            if (!clientIdCode) clientIdCode = lastId;
        }
    }

    // Se tiver grupo em memória
    const group = state.confirm.groupedClients?.find(g => g.groupId === clientKey);
    if (group) {
        if (!clientName) clientName = group.displayName || group.name;
        if (!clientIdCode) clientIdCode = group.displayIdCode || group.idCode;
        if (group.contactNote) currentNote = group.contactNote;
    }

    // Telefone
    const phoneCols = [phoneIdx, contactoIdx].filter(x => x !== -1);
    for (const pIdx of phoneCols) {
        for (const item of clientRows) {
            const v = item.row[pIdx];
            if (v && String(v).trim() !== '' && String(v).trim() !== '—') {
                clientPhone = String(v).trim();
                break;
            }
        }
        if (clientPhone) break;
    }

    // Nota atual
    if (!currentNote && contactNoteIdx !== -1) {
        for (const item of clientRows) {
            const v = item.row[contactNoteIdx];
            if (v && String(v).trim() !== '' && String(v).trim() !== '—') {
                currentNote = String(v).trim();
                break;
            }
        }
    }

    const modalId = 'modal-contact-note-editor';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const quickChips = [
        "📞 Contactado - Promete Pagar",
        "🚚 Contactado - Promete Retirar",
        "⏳ Aguarda Pagamento",
        "❌ Não Atende / Sem Resposta",
        "📲 Enviado WhatsApp",
        "🧾 Comprovativo Enviado",
        "✅ Carga Pronta para Retirar"
    ];

    const todayDate = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });

    const html = `
    <div id="${modalId}" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] animate-fade-in p-4" onclick="ui.closeModal('${modalId}')">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-slate-100" onclick="event.stopPropagation()">
            <!-- Cabeçalho -->
            <div class="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div>
                        <h3 class="text-sm font-black text-slate-800 tracking-tight">Estado do Contacto com Cliente</h3>
                        <p class="text-[11px] text-slate-500 font-medium">Registo para pagamento e retirada da carga</p>
                    </div>
                </div>
                <button type="button" onclick="ui.closeModal('${modalId}')" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <!-- Dados do Cliente -->
            <div class="px-6 py-3 bg-amber-50/50 border-b border-amber-100/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div>
                    <span class="text-[10px] uppercase font-bold text-slate-400 block">Cliente</span>
                    <strong class="text-slate-800 font-bold">${clientName || 'Cliente'}</strong>
                    ${clientIdCode ? `<span class="text-slate-500 text-[11px] ml-1">(${clientIdCode})</span>` : ''}
                </div>
                ${clientPhone ? `
                <div class="text-right">
                    <span class="text-[10px] uppercase font-bold text-slate-400 block">Contacto</span>
                    <span class="text-indigo-600 font-bold text-[11px] inline-flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        ${clientPhone}
                    </span>
                </div>
                ` : ''}
            </div>

            <!-- Corpo -->
            <div class="p-6 space-y-4">
                <!-- Sugestões rápidas -->
                <div>
                    <label class="block text-[10px] font-black uppercase text-slate-400 mb-2">Sugestões Rápidas (Clique para inserir):</label>
                    <div class="flex flex-wrap gap-1.5">
                        ${quickChips.map(chip => `
                            <button type="button" 
                                    onclick="ui.applyQuickContactChip('${chip.replace(/'/g, "\\'")}', '${todayDate}')"
                                    class="text-[10px] font-semibold bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 px-2 py-1 rounded-lg border border-slate-200/80 transition-colors cursor-pointer">
                                ${chip}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Campo de Texto -->
                <div>
                    <label class="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Nota / Resumo da Conversa:</label>
                    <textarea id="modal-contact-note-input" rows="3" 
                              class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
                              placeholder="Descreva o ponto de situação do contacto com o cliente (ex: Prometeu pagar até amanhã e levantar a carga no sábado)...">${currentNote}</textarea>
                </div>
            </div>

            <!-- Rodapé / Ações -->
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                ${currentNote ? `
                <button type="button" onclick="ui.saveContactNote('${clientKey}', '')" class="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer">
                    Remover Nota
                </button>
                ` : '<div></div>'}
                <div class="flex items-center gap-2">
                    <button type="button" onclick="ui.closeModal('${modalId}')" class="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer">
                        Cancelar
                    </button>
                    <button type="button" id="btn-save-contact-note" onclick="ui.saveContactNote('${clientKey}')" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Guardar Nota
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;

    document.getElementById('modals-container')?.insertAdjacentHTML('beforeend', html);
    document.getElementById('modal-contact-note-input')?.focus();
}
window.openContactNoteModal = openContactNoteModal;

/**
 * Insere um chip rápido na nota de contacto
 */
export function applyQuickContactChip(chipText, dateStr) {
    const textarea = document.getElementById('modal-contact-note-input');
    if (!textarea) return;
    const current = textarea.value.trim();
    const entry = dateStr ? `[${dateStr}] ${chipText}` : chipText;
    if (!current) {
        textarea.value = entry;
    } else {
        textarea.value = `${current} | ${entry}`;
    }
    textarea.focus();
}
window.applyQuickContactChip = applyQuickContactChip;

/**
 * Salva a nota de contacto no GSheet e em memória
 */
export async function saveContactNote(clientKey, directNote = null) {
    const input = document.getElementById('modal-contact-note-input');
    const newNote = directNote !== null ? directNote : (input ? input.value.trim() : '');
    const btn = document.getElementById('btn-save-contact-note');

    try {
        if (btn) setBtnLoading(btn, true);

        // Garantir que a coluna NOTA CONTACTO existe no GSheet e em memória
        const contactNoteIdx = await ensureContactNoteColumn();
        if (contactNoteIdx === -1) {
            throw new Error('Não foi possível identificar ou criar a coluna NOTA CONTACTO.');
        }

        const columns = state.confirm.columns || state.confirm.data[0] || [];
        const cleanString = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
        const idCodeIdx = findColumnIndex(columns, ['ID CODE', 'CODE ID', 'ID']);
        const nameIdx = findColumnIndex(columns, ['NAME', 'NOME', 'CLIENTE', 'CLIENT']);

        const batchUpdates = [];
        let sheetName = 'Folha1';
        if (state.confirm.range && state.confirm.range.includes('!')) {
            sheetName = state.confirm.range.split('!')[0];
        }

        let lastId = '';
        let lastName = '';
        let clientNo = '—';
        let clientName = '';

        for (let i = 1; i < state.confirm.data.length; i++) {
            const r = state.confirm.data[i];
            if (!r || r.length === 0) continue;
            const idVal = idCodeIdx !== -1 ? String(r[idCodeIdx] || '').trim() : '';
            const nameVal = nameIdx !== -1 ? String(r[nameIdx] || '').trim() : '';
            if (idVal) lastId = idVal;
            if (nameVal) lastName = nameVal;
            const gid = `${lastId}_${lastName}`.replace(/\s+/g, '_') || `ROW_${i}`;

            if (gid === clientKey) {
                while (r.length <= contactNoteIdx) r.push('');
                r[contactNoteIdx] = newNote;
                batchUpdates.push({
                    range: formatSheetRange(sheetName, `${getColLetter(contactNoteIdx)}${i + 1}`),
                    values: [[newNote]]
                });
                if (!clientName) clientName = lastName;
            }
        }

        // Atualizar no grupo em memória
        if (state.confirm.groupedClients) {
            const group = state.confirm.groupedClients.find(g => g.groupId === clientKey);
            if (group) {
                group.contactNote = newNote;
                if (group.no) clientNo = group.no;
                if (group.displayName) clientName = group.displayName;
                if (group.rows) {
                    group.rows.forEach(rObj => {
                        if (rObj.originalRow) {
                            while (rObj.originalRow.length <= contactNoteIdx) rObj.originalRow.push('');
                            rObj.originalRow[contactNoteIdx] = newNote;
                        }
                    });
                }
            }
        }

        // Enviar batch ao GSheet
        if (batchUpdates.length > 0) {
            await updateGSheetBatch(state.confirm.sheetId, batchUpdates);
        }

        // Registar auditoria
        logConfirmAudit(state.confirm.sheetId, clientNo, clientName, 'NOTA_CONTACTO_ATUALIZADA', {
            nota: newNote,
            clientKey
        }).catch(err => console.warn('[Audit] Erro ao registar nota de contacto:', err));

        // Fechar modal do editor de nota
        closeModal('modal-contact-note-editor');

        // Reabrir / atualizar modal de mercadorias em armazém para refletir a nova nota imediatamente
        openWarehouseStatusModal();

        toast(newNote ? 'Nota de contacto guardada com sucesso!' : 'Nota removida com sucesso.', 'success');
    } catch (err) {
        console.error('Erro ao guardar nota de contacto:', err);
        toast('Erro ao guardar nota: ' + err.message, 'error');
    } finally {
        if (btn) setBtnLoading(btn, false);
    }
}
window.saveContactNote = saveContactNote;

export function toggleConfirmArmazem(mode) {
    const confirmTab = document.getElementById('btn-tab-confirm');
    const armazemTab = document.getElementById('btn-tab-armazem');
    const confirmContent = document.getElementById('confirm-client-orders');
    const armazemContent = document.getElementById('armazem-client-details');
    const bulkPanel = document.getElementById('btn-toggle-bulk-actions');
    const bulkContent = document.getElementById('confirm-bulk-actions-panel');
    const summaryCards = document.getElementById('summary-cards');
    const miniFreightBtn = document.getElementById('btn-confirm-freight-mini');
    const miniStorageBtn = document.getElementById('btn-confirm-storage-mini');
    const mainCol = document.getElementById('confirm-main-content-col');
    const sideSuportes = document.getElementById('confirm-side-suportes');
    const paymentInfoContainer = document.getElementById('payment-info-container');

    if (mode === 'confirm') {
        confirmTab.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
        confirmTab.classList.remove('bg-transparent', 'text-slate-400');
        if (armazemTab) {
            armazemTab.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
            armazemTab.classList.add('bg-transparent', 'text-slate-400');
        }

        confirmContent.classList.remove('hidden');
        armazemContent.classList.add('hidden');
        if (bulkPanel) bulkPanel.style.display = '';
        closeBulkActionsPanel();
        if (paymentInfoContainer) paymentInfoContainer.classList.remove('hidden');
        const role = pb.authStore.model?.role || 'USER';
        const isAdmin = role === 'ADMIN';
        const addArticleBtn = document.getElementById('btn-add-confirm-article');
        if (addArticleBtn) {
            if (isAdmin) addArticleBtn.classList.remove('hidden');
            else addArticleBtn.classList.add('hidden');
        }
        if (summaryCards) summaryCards.style.display = '';
        if (miniFreightBtn && miniFreightBtn.dataset.hasFreight === 'true') {
            miniFreightBtn.classList.remove('hidden');
        }
        if (miniStorageBtn) {
            const stInfo = window.currentClientStorageInfo;
            if (stInfo && stInfo.cost > 0 && !stInfo.isExempt) {
                miniStorageBtn.classList.remove('hidden');
            } else {
                miniStorageBtn.classList.add('hidden');
            }
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
        if (armazemTab) {
            armazemTab.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
            armazemTab.classList.remove('bg-transparent', 'text-slate-400');
        }
        confirmTab.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
        confirmTab.classList.add('bg-transparent', 'text-slate-400');

        confirmContent.classList.add('hidden');
        armazemContent.classList.remove('hidden');
        if (bulkPanel) bulkPanel.style.display = 'none';
        if (bulkContent) {
            bulkContent.classList.add('hidden');
            bulkContent.classList.remove('flex');
        }
        if (paymentInfoContainer) paymentInfoContainer.classList.add('hidden');
        const addArticleBtn = document.getElementById('btn-add-confirm-article');
        if (addArticleBtn) addArticleBtn.classList.add('hidden');
        if (summaryCards) summaryCards.style.display = 'none';
        if (miniFreightBtn) miniFreightBtn.classList.add('hidden');
        if (miniStorageBtn) miniStorageBtn.classList.add('hidden');
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
    let balance = balanceIdx !== -1 && rowData[balanceIdx] !== '' && rowData[balanceIdx] !== undefined
        ? getNum(rowData, balanceIdx)
        : Math.max(0, amountDuty - dutyPrepaid - paid);
    if (balance === 0 && amountDuty > 0 && (paid + dutyPrepaid) < amountDuty) {
        balance = Math.max(0, amountDuty - dutyPrepaid - paid);
    }
    if (amountDuty > 0 && (paid + dutyPrepaid) >= amountDuty) {
        balance = 0;
    }
    const bankDuty = getRaw(rowData, bankDutyIdx);

    const rowStatus = calculateRowStatus(rowData[statusIdx], balance, bankDuty, paid, dutyPrepaid);

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
        <select onclick="event.stopPropagation();" onchange="ui.changeBankInDuty(${rowIndex}, this.value)" class="py-0.5 px-1 text-slate-700 bg-slate-50 border border-slate-200 rounded text-[10px] font-normal focus:outline-blue-500 focus:bg-white transition-all max-w-[130px] inline-block" ${isLockedByOther ? 'disabled' : ''}>
            ${optionsHtml}
        </select>
    `;

    const buttonClass = `px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-tighter shadow-sm transition-all border ${getRowStatusButtonClass(rowStatus)}`;

    // Atualiza os TDs individualmente para não perder referências
    tr.className = `row-hover transition-colors border-b border-slate-50 hover:bg-[#f1f5f9] cursor-pointer ${isLockedByOther ? 'opacity-50 pointer-events-none' : ''}`;
    tr.title = isLockedByOther ? `A ser editado por ${lockInfo.user}` : '';
    
    // Configurar o evento onclick da linha com o índice correto na UI
    const indexInActiveClient = window.currentActiveClient.rows.findIndex(r => r.originalIndex === rowIndex);
    tr.onclick = () => ui.openConfirmEditModal(indexInActiveClient);

    tr.innerHTML = `
        <td class="py-0.5 px-4 font-normal text-slate-800 text-[11px]">${orderNumber}</td>
        <td class="py-0.5 px-4 text-center text-slate-600 text-[11px]">${cbm.toFixed(2)}</td>
        <td class="py-0.5 px-4 text-center font-normal text-blue-700 text-[11px]">${formatValue(amountDuty)}</td>
        <td class="py-0.5 px-4 text-center text-slate-500 text-[11px]">${formatValue(dutyPrepaid)}</td>
        <td class="py-0.5 px-4 text-center font-normal text-green-600 text-[11px]">${formatValue(paid)}</td>
        <td class="py-0.5 px-4 text-center font-normal text-[11px] ${balance > 0 ? 'text-red-500' : 'text-slate-400'}">${formatValue(balance)}</td>
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
        
        let bal = balanceIdx !== -1 && rData[balanceIdx] !== '' && rData[balanceIdx] !== undefined
            ? getNum(rData, balanceIdx)
            : Math.max(0, amtDutyIdx !== -1 ? (getNum(rData, amtDutyIdx) - getNum(rData, dutyPrepIdx) - getNum(rData, paidIdx)) : 0);
        if (bal === 0 && amtDutyIdx !== -1 && getNum(rData, amtDutyIdx) > 0 && (getNum(rData, paidIdx) + getNum(rData, dutyPrepIdx)) < getNum(rData, amtDutyIdx)) {
            bal = Math.max(0, getNum(rData, amtDutyIdx) - getNum(rData, dutyPrepIdx) - getNum(rData, paidIdx));
        }
        if (amtDutyIdx !== -1 && getNum(rData, amtDutyIdx) > 0 && (getNum(rData, paidIdx) + getNum(rData, dutyPrepIdx)) >= getNum(rData, amtDutyIdx)) {
            bal = 0;
        }
        totalGSheetBalance += bal;

        let rStatus = String(rData[statusIdx] || 'PENDENTE').trim();
        if (rStatus === '?') rStatus = 'PENDENTE';
        rStatus = rStatus.toUpperCase();
        if (rStatus === 'CONFIRMADO' && bal > 1.0) {
            rStatus = 'PARCIAL';
        }

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

        // 1. Fonte Primária: Google Sheets (Planilha)
        let gSheetRemaining = null;
        if (totalGSheetBalance !== undefined && totalGSheetBalance !== null && !isNaN(totalGSheetBalance) && totalGSheetBalance > 0.01) {
            gSheetRemaining = totalGSheetBalance;
        } else if (allConfirmed) {
            gSheetRemaining = 0;
        } else if (totalAmountDuty > 0) {
            if (totalAllocated > 0) {
                gSheetRemaining = Math.max(0, targetAmount - totalAllocated);
            } else {
                gSheetRemaining = targetAmount;
            }
        }

        // 2. Fonte de Segurança / Auditoria: PocketBase (contingência se a planilha não conseguir determinar)
        let trueRemaining = 0;
        if (gSheetRemaining !== null && !isNaN(gSheetRemaining)) {
            trueRemaining = gSheetRemaining;
        } else if (targetAmount > 0 && totalAllocated > 0) {
            trueRemaining = Math.max(0, targetAmount - totalAllocated);
        } else {
            trueRemaining = Math.max(0, targetAmount);
        }

        let remainingToPay = trueRemaining;

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
        }
        delete window.activeConfirmLocks[row];
        console.log(`[SSE-FASE-4][UPDATE-COMPLETO] Dados da linha ${row} atualizados. Lock removido.`);
    }
    
    // Re-renderizar lista principal para atualizar cadeados e estados visuais, e capturar os novos grupos
    const filterEl = document.getElementById('confirm-status-filter');
    const statusFilter = filterEl?.value || 'PENDENTE';
    const searchEl = document.getElementById('input-confirm-search');
    const searchText = searchEl?.value || '';
    const groups = renderConfirmList(state.confirm.data, searchText, statusFilter);

    // 2. Se o painel de detalhe do cliente estiver aberto, isolar alterações apenas ao cliente relevante
    const detailView = document.getElementById('view-confirm-client-detail');
    const isClientDetailOpen = detailView && !detailView.classList.contains('hidden') && window.currentActiveClient;

    if (isClientDetailOpen) {
        const clientRows = window.currentActiveClient.rows || [];
        const isRowInCurrentClient = clientRows.some(r => r.originalIndex === row);

        if (isRowInCurrentClient) {
            console.log(`[SSE-FASE-5][DETALHE-UPDATE-SUAVE] Linha ${row} pertence ao cliente ativo. Atualizando pontualmente sem recarregar tela.`);
            if (type === 'UPDATE' && payload.rowData) {
                // Atualizar pontualmente a linha que mudou no DOM (sem destruir o formulário de Armazém nem o Drive)
                updateConfirmDetailRow(row, payload.rowData);
            }
            // Atualizar os cadeados específicos e o card de pagamento
            updateLocksUI();
            updatePaymentCardUI();
        } else {
            // A linha pertence a OUTRO cliente: preservar a visualização atual intacta!
            updateLocksUI();
        }
    } else {
        updateLocksUI();
    }
    
    // Atualizar UI dos Locks
    console.log("[SSE-FASE-6][REDESENHAR-UI] Atualizando locks visuais na lista de ordens (detalhe)...");
    updateLocksUI();
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

    // 1. Fonte Primária: Planilha Google Sheets
    // O card deve estar visível se o cliente não estiver totalmente confirmado
    // e possuir dados a regularizar na planilha ou pagamentos vinculados
    const isBalanceZero = totalGSheetBalance !== undefined && Math.abs(totalGSheetBalance) < 0.01;
    const isAllConfirmed = allConfirmed === true && (remainingToPay === undefined || remainingToPay <= 0.01) && (totalGSheetBalance === undefined || totalGSheetBalance <= 0.01);
    const hasRemainingBalance = totalGSheetBalance !== undefined && totalGSheetBalance > 0.01;
    const hasPaidAmount = totalPaid !== undefined && totalPaid > 0.01;
    const hasPaymentsLinked = payments && payments.length > 0;

    const shouldShowCard = !isAllConfirmed && (hasRemainingBalance || hasPaidAmount || isBalanceZero || hasPaymentsLinked || targetAmount > 0);
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
    } else {
        const amountToPass = (trueRemaining > 0) ? trueRemaining : ((remainingToPay > 0) ? remainingToPay : targetAmount);
        cardClick = `onclick="window.paymentReconciliationContext = null; ui.openPaymentMiniFilter('${escapeJSAndHTML(combinedInfo)}', '${escapeJSAndHTML(bankValue)}', '${escapeJSAndHTML(amountToPass)}', '', '${escapeJSAndHTML(client.displayName)}', '${escapeJSAndHTML(clientPhone)}', '${escapeJSAndHTML(clientNotaDuty)}')"`;
        cardCursor = "cursor-pointer hover:shadow-xl hover:translate-y-[-2px] transition-all";

        // Se houver valor pago na planilha OU saldo pendente menor que o total OU pagamentos no PocketBase
        const isPartialOnGSheet = (totalGSheetBalance > 0.01 && targetAmount > totalGSheetBalance) || (totalPaid > 0 && remainingToPay > 0.01);
        const isPartialOnPocketBase = payments && payments.length > 0 && remainingToPay > 0.01;
        const isPartial = isPartialOnGSheet || isPartialOnPocketBase || (totalPaid > 0 && totalPaid < targetAmount);

        if (isPartial) {
            cardBorder = "border-amber-400 bg-amber-50/20";
            textColor = "text-amber-600";
            displayValueHtml = `
                <div class="text-[12px] text-amber-700 mb-1 font-black uppercase">Falta Pagar</div>
                ${formatValue(remainingToPay)}
                <div class="text-[10px] text-slate-500 mt-2 font-bold">Total Esperado: ${formatValue(targetAmount)}${totalPaid > 0 ? ` | Já Pago na Folha: ${formatValue(totalPaid)}` : ''}</div>
            `;
            titleLabel = "Pagamento Parcial Pendente";
        } else {
            displayValueHtml = formatValue(targetAmount > 0 ? targetAmount : remainingToPay);
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

    const cbmIdx = findColumnIndex(cols, ['CBM', 'M3', 'VOLUME', 'VOL']);
    const unitDutyIdx = findColumnIndex(cols, ['UNIT CBM DUTY', 'UNIT DUTY', 'CBM DUTY', 'UNIT']);
    const dutyPrepaidIdx = findColumnIndex(cols, ['DUTY PREPAID', 'PREPAID', 'PRE-PAGO']);
    const amountDutyIdx = findColumnIndex(cols, ['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
    
    const cleanString = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
    const paidIdx = cols.findIndex((c, i) => {
        const h = cleanString(c);
        return (h.includes('PAID') || h.includes('PAGO')) && !h.includes('PREPAID') && !h.includes('DUTY');
    });
    
    const balanceIdx = findColumnIndex(cols, ['BALANCE', 'SALDO', 'BALANCO']);
    const bankDutyIdx = findColumnIndex(cols, ['BANK IN DUTY', 'BANK', 'BANCO']);
    const statusIdx = findColumnIndex(cols, ['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);

    // 2. Preparar valores para a linha específica
    const rawRow = (state.confirm?.data && state.confirm.data[o.originalIndex]) || o.originalRow || [];
    const rowData = [...rawRow];
    if (cbmIdx !== -1) rowData[cbmIdx] = cbm;
    if (unitDutyIdx !== -1) rowData[unitDutyIdx] = unitDuty;
    if (dutyPrepaidIdx !== -1) rowData[dutyPrepaidIdx] = dutyPrepaid;
    if (amountDutyIdx !== -1) rowData[amountDutyIdx] = amountDuty;
    if (paidIdx !== -1) rowData[paidIdx] = paid;
    if (balanceIdx !== -1) rowData[balanceIdx] = balance;
    if (bankDutyIdx !== -1) rowData[bankDutyIdx] = bankDuty;

    try {
        const spreadsheetId = state.confirm.sheetId;
        let sheetName = state.confirm.sheetTitle || 'Sheet1';
        if (state.confirm.range && state.confirm.range.includes('!')) {
            sheetName = state.confirm.range.split('!')[0];
        }
        sheetName = (sheetName || '').replace(/^'+|'+$/g, '').trim();
        if (!sheetName || sheetName.toUpperCase() === 'FOLHA1') {
            if (state.confirm.sheetTitle && state.confirm.sheetTitle.toUpperCase() !== 'FOLHA1') {
                sheetName = state.confirm.sheetTitle;
            } else {
                sheetName = 'Sheet1';
            }
        }
        const rowNum = o.originalIndex + 1;

        // Criar lote para atualizar apenas as células modificadas
        const batchUpdates = [];
        if (cbmIdx !== -1) {
            batchUpdates.push({
                range: formatSheetRange(sheetName, `${getColLetter(cbmIdx)}${rowNum}`),
                values: [[cbm]]
            });
        }
        if (unitDutyIdx !== -1) {
            batchUpdates.push({
                range: formatSheetRange(sheetName, `${getColLetter(unitDutyIdx)}${rowNum}`),
                values: [[unitDuty]]
            });
        }
        if (dutyPrepaidIdx !== -1) {
            batchUpdates.push({
                range: formatSheetRange(sheetName, `${getColLetter(dutyPrepaidIdx)}${rowNum}`),
                values: [[dutyPrepaid]]
            });
        }
        // Coluna protegida (tem fórmula no GSheet):
        // if (amountDutyIdx !== -1) {
        //     batchUpdates.push({
        //         range: formatSheetRange(sheetName, `${getColLetter(amountDutyIdx)}${rowNum}`),
        //         values: [[amountDuty]]
        //     });
        // }
        if (paidIdx !== -1) {
            batchUpdates.push({
                range: formatSheetRange(sheetName, `${getColLetter(paidIdx)}${rowNum}`),
                values: [[paid]]
            });
        }
        // if (balanceIdx !== -1) {
        //     batchUpdates.push({
        //         range: formatSheetRange(sheetName, `${getColLetter(balanceIdx)}${rowNum}`),
        //         values: [[balance]]
        //     });
        // }
        if (bankDutyIdx !== -1) {
            batchUpdates.push({
                range: formatSheetRange(sheetName, `${getColLetter(bankDutyIdx)}${rowNum}`),
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
        const rawRow = (state.confirm?.data && state.confirm.data[originalRowIndex]) || [];
        const rowData = [...rawRow];
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

/**
 * Solicita e valida uma chave secreta para autorizar a confirmação manual do estado CONFIRMADO
 */
export async function verifyConfirmSecretKey() {
    const entered = window.prompt(
        "🔐 AUTORIZAÇÃO DE CONFIRMAÇÃO MANUAL\n\n" +
        "O estado 'CONFIRMADO' só deve ser atribuído vinculando o pagamento bancário ou através de autorização com chave secreta.\n\n" +
        "Introduza a Chave Secreta ou a sua palavra-passe de utilizador:"
    );

    if (entered === null || entered.trim() === '') {
        toast("Operação cancelada: Chave secreta não introduzida.", "warning");
        return false;
    }

    const trimmed = entered.trim();
    const upper = trimmed.toUpperCase();

    // 1. Chave configurada localmente no navegador (se existir)
    const customKey1 = localStorage.getItem('confirm_secret_key');
    const customKey2 = localStorage.getItem('jupiter_secret_key');
    if ((customKey1 && trimmed === customKey1.trim()) || (customKey2 && trimmed === customKey2.trim())) {
        toast("Autorização concedida via chave configurada! ✅", "success");
        return true;
    }

    // 2. Chaves mestras predefinidas
    const validMasterKeys = ['2026', 'JUPITER2026', 'JUPITER', 'ADMIN2026'];
    if (validMasterKeys.includes(upper)) {
        toast("Autorização concedida com sucesso! ✅", "success");
        return true;
    }

    // 3. Validação via palavra-passe da conta atual no PocketBase
    try {
        if (typeof pb !== 'undefined' && pb.authStore && pb.authStore.model) {
            const loginId = pb.authStore.model.email || pb.authStore.model.username;
            if (loginId) {
                const authCheck = await pb.collection('users').authWithPassword(loginId, trimmed);
                if (authCheck && authCheck.token) {
                    toast("Autorização concedida via credenciais de utilizador! ✅", "success");
                    return true;
                }
            }
        }
    } catch (e) {
        // Palavra-passe incorreta
    }

    toast("Chave secreta incorreta! A alteração para CONFIRMADO foi recusada. ❌", "error");
    return false;
}
window.verifyConfirmSecretKey = verifyConfirmSecretKey;

export function toggleBulkDropdown(type, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (type === 'status') {
        const role = pb.authStore.model?.role || 'USER';
        const isL1 = role === 'USER' || role === 'USER_L1';
        if (isL1) {
            toast("Apenas Nível 2 ou superior pode alterar o estado em massa.", "warning");
            return;
        }
    }
    const targetList = document.getElementById(`list-dropdown-bulk-${type}`);
    const otherType = type === 'bank' ? 'status' : 'bank';
    const otherList = document.getElementById(`list-dropdown-bulk-${otherType}`);
    const targetArrow = document.getElementById(`arrow-bulk-${type}`);
    const otherArrow = document.getElementById(`arrow-bulk-${otherType}`);

    if (otherList) otherList.classList.add('hidden');
    if (otherArrow) otherArrow.classList.remove('rotate-180');

    if (targetList) {
        const isClosed = targetList.classList.contains('hidden');
        if (isClosed) {
            targetList.classList.remove('hidden');
            if (targetArrow) targetArrow.classList.add('rotate-180');
        } else {
            targetList.classList.add('hidden');
            if (targetArrow) targetArrow.classList.remove('rotate-180');
        }
    }
}
window.toggleBulkDropdown = toggleBulkDropdown;

export function closeAllBulkDropdowns() {
    const bankList = document.getElementById('list-dropdown-bulk-bank');
    const statusList = document.getElementById('list-dropdown-bulk-status');
    const bankArrow = document.getElementById('arrow-bulk-bank');
    const statusArrow = document.getElementById('arrow-bulk-status');
    if (bankList) bankList.classList.add('hidden');
    if (statusList) statusList.classList.add('hidden');
    if (bankArrow) bankArrow.classList.remove('rotate-180');
    if (statusArrow) statusArrow.classList.remove('rotate-180');
}
window.closeAllBulkDropdowns = closeAllBulkDropdowns;

export function selectBulkOption(type, value, displayLabel) {
    const select = document.getElementById(`bulk-${type}`);
    const label = document.getElementById(`label-bulk-${type}`);
    const btn = document.getElementById(`btn-dropdown-bulk-${type}`);

    if (select) {
        select.value = value;
    }

    if (label) {
        if (!value) {
            label.textContent = type === 'bank' ? 'Banco...' : 'Estado...';
        } else {
            label.textContent = displayLabel || value;
        }
    }

    if (btn) {
        if (value) {
            btn.classList.add('border-blue-400', 'text-blue-700', 'bg-blue-50/50');
            btn.classList.remove('border-slate-200', 'text-slate-700', 'bg-white');
        } else {
            btn.classList.remove('border-blue-400', 'text-blue-700', 'bg-blue-50/50');
            btn.classList.add('border-slate-200', 'text-slate-700', 'bg-white');
        }
    }

    const options = document.querySelectorAll(`.bulk-${type}-opt`);
    options.forEach(opt => {
        if (opt.getAttribute('data-val') === value) {
            opt.classList.add('bg-blue-50', 'text-blue-700');
        } else {
            opt.classList.remove('bg-blue-50', 'text-blue-700');
        }
    });

    closeAllBulkDropdowns();
}
window.selectBulkOption = selectBulkOption;

export function resetBulkDropdownsUI(isL1 = false) {
    const bankSelect = document.getElementById('bulk-bank');
    const statusSelect = document.getElementById('bulk-status');
    const labelBank = document.getElementById('label-bulk-bank');
    const labelStatus = document.getElementById('label-bulk-status');
    const btnBank = document.getElementById('btn-dropdown-bulk-bank');
    const btnStatus = document.getElementById('btn-dropdown-bulk-status');

    if (bankSelect) bankSelect.value = '';
    if (statusSelect) statusSelect.value = '';
    if (labelBank) labelBank.textContent = 'Banco...';
    if (labelStatus) labelStatus.textContent = 'Estado...';

    if (btnBank) {
        btnBank.classList.remove('border-blue-400', 'text-blue-700', 'bg-blue-50/50');
        btnBank.classList.add('border-slate-200', 'text-slate-700', 'bg-white');
    }

    if (btnStatus) {
        btnStatus.classList.remove('border-blue-400', 'text-blue-700', 'bg-blue-50/50');
        if (isL1) {
            btnStatus.disabled = true;
            btnStatus.classList.add('bg-slate-100', 'cursor-not-allowed', 'opacity-60', 'pointer-events-none');
            btnStatus.classList.remove('bg-white', 'cursor-pointer');
            btnStatus.title = 'Apenas Nível 2 ou superior pode alterar estado em massa';
        } else {
            btnStatus.disabled = false;
            btnStatus.classList.remove('bg-slate-100', 'cursor-not-allowed', 'opacity-60', 'pointer-events-none');
            btnStatus.classList.add('bg-white', 'cursor-pointer', 'border-slate-200', 'text-slate-700');
            btnStatus.title = 'Selecionar Estado';
        }
    }

    document.querySelectorAll('.bulk-bank-opt').forEach(opt => opt.classList.remove('bg-blue-50', 'text-blue-700'));
    document.querySelectorAll('.bulk-status-opt').forEach(opt => opt.classList.remove('bg-blue-50', 'text-blue-700'));

    closeAllBulkDropdowns();
}
window.resetBulkDropdownsUI = resetBulkDropdownsUI;

export function openBulkActionsPanel() {
    const btn = document.getElementById('btn-toggle-bulk-actions');
    const panel = document.getElementById('confirm-bulk-actions-panel');
    if (btn) btn.classList.add('hidden');
    if (panel) {
        panel.classList.remove('hidden');
        panel.classList.add('flex');
    }
}
window.openBulkActionsPanel = openBulkActionsPanel;

export function closeBulkActionsPanel() {
    const btn = document.getElementById('btn-toggle-bulk-actions');
    const panel = document.getElementById('confirm-bulk-actions-panel');
    if (panel) {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
    }
    if (btn) btn.classList.remove('hidden');
    resetBulkDropdownsUI();
}
window.closeBulkActionsPanel = closeBulkActionsPanel;

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

    // Se o utilizador selecionou CONFIRMADO, exigir chave secreta
    if (selectedStatus === 'CONFIRMADO') {
        const authorized = await verifyConfirmSecretKey();
        if (!authorized) {
            return;
        }
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
        const columns = state.confirm.columns || [];
        const spreadsheetId = state.confirm.sheetId;

        let sheetName = state.confirm.sheetTitle || 'Sheet1';
        if (state.confirm.range && state.confirm.range.includes('!')) {
            sheetName = state.confirm.range.split('!')[0];
        }
        sheetName = (sheetName || '').replace(/^'+|'+$/g, '').trim();
        if (!sheetName || sheetName.toUpperCase() === 'FOLHA1') {
            if (state.confirm.sheetTitle && state.confirm.sheetTitle.toUpperCase() !== 'FOLHA1') {
                sheetName = state.confirm.sheetTitle;
            } else {
                sheetName = 'Sheet1';
            }
        }

        const bankDutyIdx = findColumnIndex(columns, ['BANK IN DUTY', 'BANK', 'BANCO']);
        const statusIdx = findColumnIndex(columns, ['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);
        
        const cleanString = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
        const paidIdx = columns.findIndex((c, i) => {
            const h = cleanString(c);
            return (h.includes('PAID') || h.includes('PAGO')) && !h.includes('PREPAID') && !h.includes('DUTY');
        });
        const amtDutyIdx = findColumnIndex(columns, ['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
        const balanceIdx = findColumnIndex(columns, ['BALANCE', 'SALDO', 'BALANCO']);

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
            const rawRow = (state.confirm?.data && state.confirm.data[originalIndex]) || rowInfo.originalRow || [];
            const rowData = [...rawRow];
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
                        const curPaid = paidIdx !== -1 ? (parseFloat(String(rowData[paidIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0) : 0;
                        if (curPaid > 0 && curPaid < (amountDutyVal - 1.0)) {
                            rowData[statusIdx] = 'PARCIAL';
                            if (balanceIdx !== -1) rowData[balanceIdx] = Math.max(0, amountDutyVal - curPaid);
                        } else {
                            if (paidIdx !== -1) rowData[paidIdx] = amountDutyVal;
                            if (balanceIdx !== -1) rowData[balanceIdx] = 0;
                            rowData[statusIdx] = 'CONFIRMADO';
                        }
                    } else if (effectiveStatus === 'PENDENTE') {
                        if (paidIdx !== -1) rowData[paidIdx] = '';
                        if (balanceIdx !== -1) rowData[balanceIdx] = amountDutyVal;
                        rowData[statusIdx] = '?';
                    } else if (effectiveStatus === 'AGUARDA PAGAMENTO') {
                        if (paidIdx !== -1) rowData[paidIdx] = '';
                        if (balanceIdx !== -1) rowData[balanceIdx] = amountDutyVal;
                        rowData[statusIdx] = 'AGUARDA PAGAMENTO';
                    } else {
                        rowData[statusIdx] = effectiveStatus;
                    }
                }
            }

            if (modified) {
                // Sincronizar em memória local imediatamente
                if (rowInfo.originalRow) {
                    if (selectedBank && bankDutyIdx !== -1) rowInfo.originalRow[bankDutyIdx] = rowData[bankDutyIdx];
                    if (paidIdx !== -1) rowInfo.originalRow[paidIdx] = rowData[paidIdx];
                    if (balanceIdx !== -1) rowInfo.originalRow[balanceIdx] = rowData[balanceIdx];
                    if (statusIdx !== -1) rowInfo.originalRow[statusIdx] = rowData[statusIdx];
                }
                if (window.currentActiveClient && window.currentActiveClient.rows) {
                    const acr = window.currentActiveClient.rows.find(r => r.originalIndex === originalIndex);
                    if (acr) {
                        if (paidIdx !== -1) acr.paid = rowData[paidIdx];
                        if (balanceIdx !== -1) acr.balance = rowData[balanceIdx];
                        if (acr.originalRow) {
                            if (selectedBank && bankDutyIdx !== -1) acr.originalRow[bankDutyIdx] = rowData[bankDutyIdx];
                            if (paidIdx !== -1) acr.originalRow[paidIdx] = rowData[paidIdx];
                            if (balanceIdx !== -1) acr.originalRow[balanceIdx] = rowData[balanceIdx];
                            if (statusIdx !== -1) acr.originalRow[statusIdx] = rowData[statusIdx];
                        }
                    }
                }

                // Emitir LOCK temporário para o real-time
                emitConfirmEvent(spreadsheetId, originalIndex, 'LOCK', { name: pb.authStore.model?.name || 'Utilizador' });

                // Acumular apenas as células modificadas no Google Sheets
                const rowNum = originalIndex + 1;
                if (selectedBank && bankDutyIdx !== -1) {
                    batchUpdates.push({
                        range: formatSheetRange(sheetName, `${getColLetter(bankDutyIdx)}${rowNum}`),
                        values: [[rowData[bankDutyIdx]]]
                    });
                }
                
                let wrotePaidAndBalance = false;
                if (applyConfirmAndPay) {
                    if (paidIdx !== -1) {
                        batchUpdates.push({
                            range: formatSheetRange(sheetName, `${getColLetter(paidIdx)}${rowNum}`),
                            values: [[rowData[paidIdx]]]
                        });
                    }
                    wrotePaidAndBalance = true;
                }

                if (effectiveStatus) {
                    if (statusIdx !== -1) {
                        batchUpdates.push({
                            range: formatSheetRange(sheetName, `${getColLetter(statusIdx)}${rowNum}`),
                            values: [[rowData[statusIdx]]]
                        });
                    }
                    if (!wrotePaidAndBalance) {
                        if (paidIdx !== -1) {
                            batchUpdates.push({
                                range: formatSheetRange(sheetName, `${getColLetter(paidIdx)}${rowNum}`),
                                values: [[rowData[paidIdx]]]
                            });
                        }
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
            try {
                const clientNo = window.currentActiveClient?.no || '';
                const clientName = window.currentActiveClient?.displayName || '';
                logConfirmAudit(spreadsheetId, clientNo, clientName, 'ATUALIZACAO_EM_MASSA', {
                    banco: selectedBank || null,
                    estado: selectedStatus || null,
                    qtdOrdens: updatedCount,
                    atualizouPagamento: applyConfirmAndPay
                }).catch(e => console.warn('[Audit] Erro ao registar auditoria de bulk update:', e));
            } catch (auditErr) {
                console.warn('[Audit] Erro ao disparar auditoria de bulk update:', auditErr);
            }
        }
        if (skippedCount > 0) {
            toast(`${skippedCount} ordens ignoradas por estarem a ser editadas por outros utilizadores.`, "warning");
        }

        // Resetar selects e painel
        resetBulkDropdownsUI(isL1);
        closeBulkActionsPanel();

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
        div.className = "flex items-center gap-2 p-1.5 px-2 border border-slate-100 hover:border-slate-200 rounded-lg hover:shadow-xs transition-all bg-white hover:bg-slate-50 cursor-pointer group";

        div.onclick = (e) => {
            if (isFolder) {
                window.navigateToFolder(file.id);
            } else {
                window.showFilePreview(file);
            }
        };

        const iconColor = isFolder ? 'text-blue-500' : 'text-slate-400';

        let metaHtml = '';
        if (isFolder) {
            metaHtml = `<p class="text-[7px] text-blue-500 font-bold uppercase tracking-wider mt-0.5">Pasta</p>`;
        } else {
            const uploader = file.appProperties?.uploadedBy || 
                (file.description && file.description.includes('Carregado por:') ? file.description.replace(/Carregado por:\s*/i, '').split(/\s+em\s+/)[0]?.trim() : '');
            
            const rawDate = file.appProperties?.uploadedAt || file.createdTime;
            let dateStr = '';
            if (rawDate) {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                }
            }

            if (uploader || dateStr) {
                metaHtml = `
                    <div class="text-[8px] text-slate-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                        ${uploader ? `
                            <span class="text-slate-600 font-bold flex items-center gap-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                ${uploader}
                            </span>
                        ` : ''}
                        ${uploader && dateStr ? `<span>•</span>` : ''}
                        ${dateStr ? `<span>${dateStr}</span>` : ''}
                    </div>
                `;
            }
        }

        div.innerHTML = `
            <div class="${iconColor} shrink-0 flex items-center justify-center">
                ${isFolder ?
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>' :
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>'
            }
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold truncate text-slate-700 group-hover:text-slate-950 text-[10px] leading-tight">${file.name}</p>
                ${metaHtml}
            </div>
            
            <div class="flex items-center gap-1 shrink-0">
                ${!isFolder ? `
                    <button onclick="event.stopPropagation(); window.confirmAndDeleteFile('${file.id}', '${(file.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${currentFolderId}')" 
                        class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-md cursor-pointer flex items-center justify-center" title="Apagar ficheiro">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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

    const reconnectHtml = `
        <button onclick="window.location.href='/api/google/auth'" 
            class="mt-3 bg-blue-600/90 text-white px-3.5 py-2 rounded-xl font-extrabold uppercase text-[9px] tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-1.5 mx-auto shadow-sm">
            <i class="fas fa-plug text-xs"></i>
            RECONECTAR AO GOOGLE
        </button>
    `;

    container.innerHTML = `
        <div class="p-6 text-center space-y-2">
            <p class="text-gray-400 italic text-[10px] leading-tight">${message}</p>
            ${actionHtml}
            ${reconnectHtml}
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
        container.classList.remove('max-w-5xl');
        container.classList.add('max-w-7xl');

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
        container.classList.remove('max-w-7xl');
        container.classList.add('max-w-5xl');
    }
}

export function renderConfirmIntervalBar(totalCount, startItem, endItem, currentPage, totalPages, pageSize, isSearch) {
    const intervalBar = document.getElementById('confirm-interval-bar');
    if (!intervalBar) return;

    if (totalCount === 0) {
        intervalBar.innerHTML = '';
        return;
    }

    let intervalOptionsHtml = '';
    const numericSize = pageSize === 'all' ? 30 : (parseInt(pageSize, 10) || 30);
    const intervalsCount = Math.max(1, Math.ceil(totalCount / numericSize));

    for (let i = 1; i <= intervalsCount; i++) {
        const s = (i - 1) * numericSize + 1;
        const e = Math.min(i * numericSize, totalCount);
        const label = i === 1 
            ? `${s} - ${e} (Últimos Adicionados)` 
            : `${s} - ${e}`;
        const isSelected = (pageSize !== 'all' && currentPage === i);
        intervalOptionsHtml += `<option value="${i}" ${isSelected ? 'selected' : ''}>${label}</option>`;
    }
    intervalOptionsHtml += `<option value="all" ${pageSize === 'all' ? 'selected' : ''}>Todas as CTRs (${totalCount})</option>`;

    intervalBar.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
            <!-- Esquerda: Tag informativa e Salto Rápido por Intervalo -->
            <div class="flex items-center flex-wrap gap-2.5">
                <div class="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-200/80 rounded-xl text-yellow-900 shadow-xs">
                    <span class="text-xs">⚡</span>
                    <span class="text-[10px] font-black uppercase tracking-wider">
                        ${isSearch 
                            ? `Pesquisa: ${totalCount} CTR(s) encontrada(s)` 
                            : (currentPage === 1 && pageSize === 30 ? `Últimas 30 CTRs adicionadas` : `A exibir CTRs ${startItem}–${endItem} de ${totalCount}`)}
                    </span>
                </div>

                <div class="flex items-center gap-1.5">
                    <label class="text-[9px] font-bold text-gray-400 uppercase tracking-wider hidden sm:inline">Intervalo:</label>
                    <select onchange="window.setConfirmProjectInterval(this.value)" 
                            class="bg-gray-50 border border-gray-200 hover:border-black text-gray-800 text-[10px] font-bold uppercase rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer transition-all">
                        ${intervalOptionsHtml}
                    </select>
                </div>
            </div>

            <!-- Direita: Tamanho do Intervalo e Navegação Anterior / Próximo -->
            <div class="flex items-center flex-wrap gap-2">
                <div class="flex items-center gap-1.5">
                    <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider hidden md:inline">Por vez:</span>
                    <select onchange="window.setConfirmProjectPageSize(this.value)"
                            class="bg-gray-50 border border-gray-200 hover:border-black text-gray-800 text-[10px] font-bold uppercase rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer transition-all">
                        <option value="30" ${pageSize === 30 || pageSize === '30' ? 'selected' : ''}>30 (Padrão)</option>
                        <option value="50" ${pageSize === 50 || pageSize === '50' ? 'selected' : ''}>50</option>
                        <option value="100" ${pageSize === 100 || pageSize === '100' ? 'selected' : ''}>100</option>
                        <option value="all" ${pageSize === 'all' ? 'selected' : ''}>Todas (${totalCount})</option>
                    </select>
                </div>

                <div class="flex items-center gap-1">
                    <button onclick="window.prevConfirmProjectPage()" 
                            ${currentPage <= 1 || pageSize === 'all' ? 'disabled' : ''}
                            class="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-black hover:text-white hover:border-black disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 flex items-center gap-1"
                            title="Intervalo Anterior">
                        ‹ <span class="hidden sm:inline">Anterior</span>
                    </button>
                    <span class="text-[10px] font-black text-slate-700 uppercase px-2">
                        ${pageSize === 'all' ? 'Todas' : `${currentPage} / ${totalPages}`}
                    </span>
                    <button onclick="window.nextConfirmProjectPage()" 
                            ${currentPage >= totalPages || pageSize === 'all' ? 'disabled' : ''}
                            class="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-black hover:text-white hover:border-black disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 flex items-center gap-1"
                            title="Próximo Intervalo">
                        <span class="hidden sm:inline">Próximo</span> ›
                    </button>
                </div>
            </div>
        </div>
    `;
}
window.renderConfirmIntervalBar = renderConfirmIntervalBar;

export function renderConfirmProjects(projects, isSearch = false) {
    const container = document.getElementById('confirm-projects-list');
    const normalContainer = document.getElementById('confirm-normal-container');
    const intervalBar = document.getElementById('confirm-interval-bar');
    if (!container) return;

    // Se estiver no separador 'verify', assegurar que o container normal e a lista ficam estritamente ocultos
    if (state.confirm?.dashboardTab === 'verify') {
        if (normalContainer) normalContainer.classList.add('hidden');
        container.classList.add('hidden');
        if (intervalBar) intervalBar.classList.add('hidden');
    } else {
        if (normalContainer) normalContainer.classList.remove('hidden');
        container.classList.remove('hidden');
        if (intervalBar) intervalBar.classList.remove('hidden');
    }

    const isProjAdmin = (pb.authStore.model?.role || 'USER') === 'ADMIN';

    // Guardar no estado apenas se não for uma pesquisa (para manter a lista completa)
    if (!isSearch) {
        if (!state.confirm) state.confirm = {};
        state.confirm.projects = projects;
        state.confirm.allClientsCache = null; // Invalida cache de parsing consolidado
    }

    container.innerHTML = '';

    if (!projects || projects.length === 0) {
        if (intervalBar) intervalBar.innerHTML = '';
        container.innerHTML = `
            <div class="col-span-full py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">${isSearch ? 'Nenhuma CTR encontrada para esta pesquisa.' : 'Nenhum projeto gravado.'}</p>
                ${isProjAdmin && !isSearch ? `<button onclick="openConfirmProjectModal()" class="mt-4 text-blue-600 font-bold uppercase text-[10px] hover:underline">+ Adicionar Primeiro Projeto</button>` : ''}
            </div>
        `;
        return;
    }

    // === GESTÃO DE INTERVALOS / PAGINAÇÃO DE CTRs ===
    if (!state.confirm) state.confirm = {};
    if (!state.confirm.projectPageSize) state.confirm.projectPageSize = 30;
    if (!state.confirm.projectPage) state.confirm.projectPage = 1;

    const pageSize = state.confirm.projectPageSize;
    let currentPage = state.confirm.projectPage;
    const totalCount = projects.length;

    let totalPages = 1;
    let paginatedProjects = projects;
    let startItem = 1;
    let endItem = totalCount;

    if (pageSize !== 'all') {
        const numericSize = parseInt(pageSize, 10) || 30;
        totalPages = Math.max(1, Math.ceil(totalCount / numericSize));
        if (currentPage > totalPages) {
            currentPage = totalPages;
            state.confirm.projectPage = totalPages;
        }
        if (currentPage < 1) {
            currentPage = 1;
            state.confirm.projectPage = 1;
        }

        const startIdx = (currentPage - 1) * numericSize;
        const endIdx = Math.min(startIdx + numericSize, totalCount);
        paginatedProjects = projects.slice(startIdx, endIdx);
        startItem = totalCount > 0 ? startIdx + 1 : 0;
        endItem = endIdx;
    }

    // Renderizar barra de intervalos no topo
    renderConfirmIntervalBar(totalCount, startItem, endItem, currentPage, totalPages, pageSize, isSearch);

    // Sincronizar botões de modo de exibição de projetos
    const viewMode = state.confirm.projectViewMode || localStorage.getItem('confirm_project_view_mode') || 'grid';
    const btnGrid = document.getElementById('btn-proj-view-grid');
    const btnList = document.getElementById('btn-proj-view-list');
    const btnTable = document.getElementById('btn-proj-view-table');

    if (btnGrid) btnGrid.className = `p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnList) btnList.className = `p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;
    if (btnTable) btnTable.className = `p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`;

    // === MODOS DE EXIBIÇÃO DE PROJETOS (PAGINADOS) ===
    if (viewMode === 'grid') {
        container.className = "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2.5 px-4";
        paginatedProjects.forEach(p => {
            const card = document.createElement('div');
            card.className = "bg-white px-2.5 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group transition-all hover:shadow-md hover:border-black hover:bg-slate-50 cursor-pointer active:scale-[0.98]";
            card.onclick = () => selectConfirmProject(p.sheetId, p.folderId, p.name.replace(/'/g, "\\'"));

            card.innerHTML = `
                <div class="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                    <div class="bg-yellow-400 text-black w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div class="overflow-hidden min-w-0 flex-1">
                        <h3 class="text-xs font-black text-slate-800 tracking-tight leading-none truncate group-hover:text-black transition-colors" title="${p.name}">${p.name}</h3>
                    </div>
                </div>
                
                ${isProjAdmin ? `
                <div class="flex items-center shrink-0 ml-1">
                    <button onclick="event.stopPropagation(); openConfirmProjectModal('${p.id}')" 
                        class="w-6 h-6 bg-slate-50 text-slate-300 rounded-lg flex items-center justify-center hover:bg-black hover:text-white transition-all border border-slate-100 active:scale-90" title="Editar Projeto">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                </div>
                ` : ''}
            `;
            container.appendChild(card);
        });
    }
    else if (viewMode === 'list') {
        container.className = "flex flex-col gap-2.5 px-4 w-full col-span-full";
        paginatedProjects.forEach(p => {
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
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
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
        paginatedProjects.forEach(p => {
            const trId = `tr-proj-${p.id}`;
            tableRowsHtml += `
                <tr id="${trId}" class="hover:bg-slate-50 border-b border-gray-100 transition-all cursor-pointer group">
                    <td class="p-3 font-normal text-xs uppercase text-slate-700 group-hover:text-black transition-colors flex items-center gap-2">
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
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
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
        paginatedProjects.forEach(p => {
            const tr = document.getElementById(`tr-proj-${p.id}`);
            if (tr) {
                tr.onclick = () => selectConfirmProject(p.sheetId, p.folderId, p.name.replace(/'/g, "\\'"));
            }
        });
    }

    // Se estiver no modo verify, assegurar estritamente que permanece oculto
    if (state.confirm?.dashboardTab === 'verify') {
        if (normalContainer) normalContainer.classList.add('hidden');
        container.classList.add('hidden');
        if (intervalBar) intervalBar.classList.add('hidden');
    }
}
window.renderConfirmProjects = renderConfirmProjects;

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

    const wrapper = document.getElementById('bank-incomes-wrapper');
    if (wrapper) wrapper.classList.add('hidden');
    
    const container = document.getElementById('bank-incomes-container');
    if (container) container.innerHTML = '';
}

/**
 * Atualiza os dados bancários com base nos filtros (Busca no Servidor)
 */
export async function refreshBankData() {
    const searchTerm = document.getElementById('input-bank-search')?.value || '';
    const bankFilter = document.getElementById('select-bank-filter')?.value || '';
    const wrapper = document.getElementById('bank-incomes-wrapper');

    if (!searchTerm.trim() && !bankFilter) {
        if (wrapper) wrapper.classList.add('hidden');
        return;
    }

    if (wrapper) wrapper.classList.remove('hidden');

    let filters = [];
    if (bankFilter) {
        let cleanBank = bankFilter.replace(' BOSS', '').replace(' JUPITER', '').trim();
        filters.push(`bank ~ "${cleanBank}"`);
    }

    if (searchTerm) {
        const termFilter = buildSearchFilter(searchTerm);
        if (termFilter) {
            filters.push(termFilter);
        }
    }
    
    let pbFilter = filters.join(' && ');

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
 * Processa o upload de extratos bancários (suporta múltiplos ficheiros)
 */
export async function handleBankUpload(input) {
    const files = Array.from(input.files || []);
    if (files.length === 0) return;

    const btn = document.getElementById('btn-bank-upload');
    setBtnLoading(btn, true, "A processar...");
    
    const totalFiles = files.length;
    let totalNew = 0;
    let totalDup = 0;
    let totalFound = 0;
    let errors = [];

    try {
        for (let fIdx = 0; fIdx < totalFiles; fIdx++) {
            const file = files[fIdx];
            const fileNum = fIdx + 1;
            const prefix = totalFiles > 1 ? `[${fileNum}/${totalFiles}] ` : '';

            setLoader(true, `${prefix}A analisar ${file.name}...`);

            try {
                const data = await uploadBankStatement(file);

                if (data && data.length > 0) {
                    totalFound += data.length;
                    for (let i = 0; i < data.length; i++) {
                        const item = data[i];
                        if ((i + 1) % 5 === 0 || i === data.length - 1) {
                            setLoader(true, `${prefix}A gravar movimento ${i + 1} de ${data.length} (${file.name})...`);
                        }
                        try {
                            const result = await saveBankIncome(item);
                            if (result && result._isNew) {
                                totalNew++;
                            } else if (result && result._isDuplicate) {
                                totalDup++;
                            } else {
                                const isNew = result && result.created && result.updated && (new Date(result.updated) - new Date(result.created) < 2000);
                                if (isNew) totalNew++; else totalDup++;
                            }
                        } catch (e) {
                            console.warn(`[BANK] Erro ao gravar item de ${file.name}:`, e.message);
                        }
                    }
                } else {
                    console.warn(`[BANK] Nenhuma entrada encontrada em ${file.name}`);
                }
            } catch (err) {
                console.error(`[BANK] Erro ao processar ${file.name}:`, err);
                errors.push(`${file.name}: ${err.message}`);
            }
        }

        if (totalFound > 0 || totalNew > 0 || totalDup > 0) {
            const fileLabel = totalFiles > 1 ? ` de ${totalFiles} ficheiros` : '';
            toast(`Importação${fileLabel} concluída! Novos: ${totalNew}, Duplicados: ${totalDup}`, totalNew > 0 ? 'success' : 'warning');
            
            // Recarregar os movimentos no ecrã para que o utilizador veja imediatamente os dados importados
            await listBankIncomes('', 50);
            const wrapper = document.getElementById('bank-incomes-wrapper');
            if (wrapper) wrapper.classList.remove('hidden');
            renderBankIncomes();
            renderBankOwnerSummary();
        } else if (errors.length === 0) {
            toast("Nenhuma entrada de crédito encontrada no(s) ficheiro(s) selecionado(s).", "warning");
        }

        if (errors.length > 0) {
            toast(`Erro em ${errors.length} ficheiro(s): ${errors.slice(0, 2).join('; ')}`, "error");
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
    const searchTerm = document.getElementById('input-bank-search')?.value || '';
    const bankFilter = document.getElementById('select-bank-filter')?.value || '';

    // Function to normalize string (remove accents and make uppercase)
    const normalizeStr = (str) => {
        return str ? str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() : '';
    };

    const searchTermsMatches = normalizeStr(searchTerm).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const searchTerms = searchTermsMatches.map(t => t.replace(/^"|"$/g, '').trim()).filter(t => t.length > 0);
    const filtered = state.bank.incomes.filter(item => {
        let matchesSearch = true;
        if (searchTerms.length > 0) {
            matchesSearch = searchTerms.every(term => {
                // Se for termo de busca avançada (contém ':', '>', '<', '=', ou formato de data '/'), confiamos no backend
                if (term.includes(':') || term.includes('>') || term.includes('<') || term.includes('=') || term.includes('/')) return true;
                
                const amountStr = String(item.amount);
                const dateStr = String(item.date); // Permitir match parcial na data literal
                return normalizeStr(item.description).includes(term) ||
                       normalizeStr(item.order_id).includes(term) ||
                       normalizeStr(item.reference).includes(term) ||
                       normalizeStr(item.info).includes(term) ||
                       normalizeStr(item.account_owner).includes(term) ||
                       normalizeStr(item.account_number).includes(term) ||
                       normalizeStr(item.bank).includes(term) ||
                       dateStr.includes(term) ||
                       amountStr.includes(term);
            });
        }
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
        <table class="min-w-full text-left text-[10px] font-normal uppercase tracking-tighter">
            <thead class="bg-gray-50 text-gray-400">
                <tr>
                    <th class="py-3 px-4">Data</th>
                    <th class="py-3 px-4">Banco</th>
                    <th class="py-3 px-4">Descrição</th>
                    <th class="py-3 px-4">Detalhes</th>
                    <th class="py-3 px-4 text-right">Montante</th>
                    <th class="py-3 px-4 text-right">Saldo</th>
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
        
        const extraInfoParts = [item.info, item.reference, item.account_owner, item.account_number].filter(Boolean);
        let extraInfoHtml = '---';
        if (extraInfoParts.length > 0) {
            extraInfoHtml = extraInfoParts.map(part => {
                const escapedPart = part.replace(/'/g, "\\'");
                return `<span onclick="window.setBankSearchFilter('${escapedPart}')" class="cursor-pointer text-purple-600 hover:text-purple-800 hover:bg-purple-100 transition-all font-bold bg-purple-50 px-1 py-0.5 rounded border border-purple-100 inline-block mr-1 my-0.5" title="Filtrar por ${escapedPart}">${part}</span>`;
            }).join('');
        }

        html += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="py-3 px-4 text-gray-500 whitespace-nowrap">${item.date.split(' ')[0]}</td>
                <td class="py-3 px-4"><span onclick="window.setBankSearchFilter('${item.bank}')" class="cursor-pointer hover:bg-gray-200 transition-all bg-gray-100 px-2 py-1 rounded" title="Filtrar por banco">${getPaymentBankDisplay(item)}</span></td>
                <td class="py-3 px-4 text-gray-900 max-w-[200px] truncate" title="${item.description}">${item.description}</td>
                <td class="py-3 px-4 text-gray-500 max-w-[300px] leading-tight">${extraInfoHtml}</td>
                <td class="py-3 px-4 text-right ${amountClass}">${formatMZN(item.amount)}</td>
                <td class="py-3 px-4 text-right text-gray-400">${formatMZN(item.balance)}</td>
                <td class="py-3 px-4 text-center">
                    ${item.order_id ? `<span onclick="window.setBankSearchFilter('${item.order_id}')" title="Filtrar por ID ${item.order_id}" class="cursor-pointer hover:bg-purple-200 transition-all bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">${item.order_id}</span>` : '<span class="text-gray-200">---</span>'}
                </td>
                <td class="py-3 px-4 text-center">
                    <span class="px-2 py-1 rounded-full text-[8px] font-normal ${statusClass}">${statusText}</span>
                    ${item.allocated_to ? `<div class="text-[8px] text-gray-500 font-bold mt-1 truncate max-w-[120px]" title="Alocado a: ${item.allocated_to}">Alocado a: ${item.allocated_to}</div>` : ''}
                    ${(item.reconciled && pb.authStore.model?.role !== 'USER' && pb.authStore.model?.role !== 'USER_L1') ? `
                        <div>
                            <button onclick="event.stopPropagation(); window.confirmUnallocatePayment('${item.id}', ${item.amount}, '${(item.reference || '').replace(/'/g, "\\'")}', 'BANCO')" 
                                class="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 rounded transition-all shadow-2xs cursor-pointer" title="Desalocar pagamento">
                                <span>Desalocar</span>
                            </button>
                        </div>
                    ` : ''}
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

window.setBankSearchFilter = function(term) {
    const input = document.getElementById('input-bank-search');
    if (input) {
        input.value = term;
        refreshBankData();
    }
};

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
        if (value) {
            toggleMiniFilterExtraFilters(true);
        }
        searchPaymentMiniFilter();
    }
}

export function setMiniFilterReference(refVal) {
    const refInput = document.getElementById('mini-filter-reference');
    if (refInput) {
        refInput.value = refVal;
        searchPaymentMiniFilter();
    }
}

export function handleAmountModeChange() {
    const mode = document.getElementById('mini-filter-amount-mode')?.value || 'exact';
    const singleContainer = document.getElementById('mini-filter-amount-single-container');
    const rangeContainer = document.getElementById('mini-filter-range-container');
    
    if (mode === 'range') {
        if (singleContainer) singleContainer.classList.add('hidden');
        if (rangeContainer) rangeContainer.classList.remove('hidden');
    } else {
        if (singleContainer) singleContainer.classList.remove('hidden');
        if (rangeContainer) rangeContainer.classList.add('hidden');
    }
    searchPaymentMiniFilter();
}

export function setMiniFilterDatePreset(preset) {
    const fromEl = document.getElementById('mini-filter-date-from');
    const toEl = document.getElementById('mini-filter-date-to');
    if (!fromEl || !toEl) return;

    const today = new Date();
    const formatYMD = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (preset === 'today') {
        const todayStr = formatYMD(today);
        fromEl.value = todayStr;
        toEl.value = todayStr;
    } else if (preset === '3d') {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        fromEl.value = formatYMD(d);
        toEl.value = formatYMD(today);
    } else if (preset === '7d') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        fromEl.value = formatYMD(d);
        toEl.value = formatYMD(today);
    } else if (preset === 'month') {
        const d = new Date(today.getFullYear(), today.getMonth(), 1);
        fromEl.value = formatYMD(d);
        toEl.value = formatYMD(today);
    } else if (preset === 'all') {
        fromEl.value = '';
        toEl.value = '';
    }

    searchPaymentMiniFilter();
}

export function toggleMiniFilterExtraFilters(forceOpen = null) {
    const container = document.getElementById('mini-filter-extra-filters');
    const textEl = document.getElementById('text-toggle-mini-extra-filters');
    const iconEl = document.getElementById('icon-toggle-mini-extra-filters');
    if (!container) return;

    const willBeOpen = forceOpen !== null ? Boolean(forceOpen) : container.classList.contains('hidden');

    if (willBeOpen) {
        container.classList.remove('hidden');
        if (textEl) textEl.innerText = "Ocultar Filtros Adicionais (Datas, Canal, Descrição)";
        if (iconEl) {
            iconEl.innerHTML = '<line x1="5" y1="12" x2="19" y2="12"></line>';
        }
    } else {
        container.classList.add('hidden');
        if (textEl) textEl.innerText = "Mais Filtros (Datas, Canal, Descrição)";
        if (iconEl) {
            iconEl.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>';
        }
    }
}

export function clearAmountAndSearch() {
    const amountInput = document.getElementById('mini-filter-amount');
    if (amountInput) amountInput.value = '';
    const minInput = document.getElementById('mini-filter-amount-min');
    if (minInput) minInput.value = '';
    const maxInput = document.getElementById('mini-filter-amount-max');
    if (maxInput) maxInput.value = '';
    searchPaymentMiniFilter();
}
window.clearAmountAndSearch = clearAmountAndSearch;

export function resetPaymentMiniFilter() {
    const bankSelect = document.getElementById('mini-filter-bank');
    if (bankSelect) bankSelect.value = '';
    
    const ownerSelect = document.getElementById('mini-filter-owner');
    if (ownerSelect) ownerSelect.value = '';
    renderMiniFilterOwnerDisplay('');

    const modeSelect = document.getElementById('mini-filter-amount-mode');
    if (modeSelect) modeSelect.value = 'exact';
    renderMiniFilterAmountModeDisplay('exact');

    const amountInput = document.getElementById('mini-filter-amount');
    if (amountInput) amountInput.value = '';

    const minInput = document.getElementById('mini-filter-amount-min');
    if (minInput) minInput.value = '';
    const maxInput = document.getElementById('mini-filter-amount-max');
    if (maxInput) maxInput.value = '';

    const singleContainer = document.getElementById('mini-filter-amount-single-container');
    const rangeContainer = document.getElementById('mini-filter-range-container');
    if (singleContainer) singleContainer.classList.remove('hidden');
    if (rangeContainer) rangeContainer.classList.add('hidden');

    const refInput = document.getElementById('mini-filter-reference');
    if (refInput) refInput.value = '';

    const dateFrom = document.getElementById('mini-filter-date-from');
    if (dateFrom) dateFrom.value = '';
    const dateTo = document.getElementById('mini-filter-date-to');
    if (dateTo) dateTo.value = '';

    const channelSelect = document.getElementById('mini-filter-channel');
    if (channelSelect) channelSelect.value = '';
    renderMiniFilterChannelDisplay('');

    const searchInput = document.getElementById('mini-filter-search');
    if (searchInput) searchInput.value = '';

    const usedCheckbox = document.getElementById('mini-filter-show-used');
    if (usedCheckbox) usedCheckbox.checked = false;

    // Resetar visibilidade dos filtros 5, 6 e 7 para oculto por padrão
    toggleMiniFilterExtraFilters(false);
    renderMiniFilterBankDisplay('');
    renderMiniFilterOwnerDisplay('');
    renderMiniFilterAmountModeDisplay('exact');
    renderMiniFilterChannelDisplay('');
    renderMiniFilterStatusDisplay('CONFIRMADO');
    closeAllMiniFilterDropdowns();

    searchPaymentMiniFilter();
}

export function openPaymentMiniFilter(combinedInfo, defaultBank = '', defaultAmount = '', defaultTerm = '', clientName = '', phoneNumber = '', notaDuty = '') {
    if (defaultBank) {
        const dbUpper = String(defaultBank).trim().toUpperCase();
        if (dbUpper === '—' || dbUpper === '-' || dbUpper === 'NIL' || dbUpper === 'N/A' || dbUpper === 'NULL' || dbUpper === 'NONE') {
            defaultBank = '';
        } else if (dbUpper.includes('BIM')) {
            defaultBank = 'BIM';
        } else if (dbUpper.includes('BCI')) {
            defaultBank = 'BCI';
        } else if (dbUpper.includes('STB') || dbUpper.includes('STANDARD')) {
            defaultBank = 'STB';
        } else if (dbUpper.includes('NEDBANK')) {
            defaultBank = 'NEDBANK';
        } else if (dbUpper.includes('EMOLA') || dbUpper.includes('MPESA') || dbUpper.includes('M-PESA')) {
            defaultBank = 'EMOLA';
        } else {
            defaultBank = String(defaultBank).replace(' BOSS', '').replace(' JUPITER', '').trim();
        }
    }
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

    // Garantir que os filtros adicionais 5, 6 e 7 iniciem ocultos por padrão (exceto se houver defaultTerm)
    toggleMiniFilterExtraFilters(Boolean(defaultTerm));

    // 1. Fonte Primária: Saldo e Totais para Duty, Frete ou Armazém
    const isFreight = window.paymentReconciliationContext === 'FREIGHT';
    const isFeeContext = window.paymentReconciliationContext === 'STORAGE' || window.paymentReconciliationContext === 'DESPACHO';
    const clientRows = window.currentClientRows || window.currentActiveClient?.rows || [];

    let totalExpected = 0;
    let alreadyPaid = 0;
    let expectedAmount = 0;

    if (isFeeContext) {
        const feeCtx = window.feeReconciliationContext || window.storageReconciliationContext || {};
        totalExpected = parseFloat(feeCtx.totalExpected) || parseFloat(defaultAmount) || 0;
        alreadyPaid = parseFloat(feeCtx.alreadyPaid) || 0;
        if (feeCtx.remainingBalance !== undefined && feeCtx.remainingBalance !== null) {
            expectedAmount = Math.max(0, parseFloat(feeCtx.remainingBalance) || 0);
        } else if (parseFloat(defaultAmount) > 0) {
            expectedAmount = parseFloat(defaultAmount);
        } else {
            expectedAmount = Math.max(0, totalExpected - alreadyPaid);
        }
    } else if (isFreight) {
        totalExpected = clientRows.reduce((sum, r) => sum + (parseFloat(r.amtFreight) || 0), 0);
        alreadyPaid = clientRows.reduce((sum, r) => sum + (parseFloat(r.pdFreight) || 0), 0);
        const freightBal = clientRows.reduce((sum, r) => sum + (parseFloat(r.balFreight) || 0), 0);
        
        if (window.freightExtrasContext && window.freightExtrasContext.totalExpectedInBank > 0) {
            expectedAmount = window.freightExtrasContext.totalExpectedInBank;
            totalExpected = Math.max(totalExpected, expectedAmount);
        } else if (parseFloat(defaultAmount) > 0) {
            expectedAmount = parseFloat(defaultAmount);
            totalExpected = Math.max(totalExpected, expectedAmount);
        } else {
            expectedAmount = freightBal > 0 ? freightBal : Math.max(0, totalExpected - alreadyPaid);
        }
    } else {
        totalExpected = window.currentActiveClientState?.targetAmount || clientRows.reduce((sum, r) => sum + (parseFloat(r.amountDuty) || 0), 0);
        const totalPrepaid = window.currentActiveClientState?.totalDutyPrepaid || clientRows.reduce((sum, r) => sum + (parseFloat(r.dutyPrepaid) || 0), 0);
        alreadyPaid = window.currentActiveClientState?.totalPaid || clientRows.reduce((sum, r) => sum + (parseFloat(r.paid) || 0), 0);
        
        if (window.currentActiveClientState && window.currentActiveClientState.trueRemaining > 0) {
            expectedAmount = window.currentActiveClientState.trueRemaining;
        } else if (window.currentActiveClientState && window.currentActiveClientState.totalGSheetBalance > 0) {
            expectedAmount = window.currentActiveClientState.totalGSheetBalance;
        } else if (parseFloat(defaultAmount) > 0) {
            expectedAmount = parseFloat(defaultAmount);
        } else if (window.currentActiveClientState && window.currentActiveClientState.remainingToPay > 0) {
            expectedAmount = window.currentActiveClientState.remainingToPay;
        } else {
            const rawBal = clientRows.reduce((sum, r) => sum + (parseFloat(r.balance) || 0), 0);
            expectedAmount = rawBal > 0 ? rawBal : Math.max(0, totalExpected - totalPrepaid - alreadyPaid);
        }
    }
    currentMiniFilterExpectedAmount = expectedAmount;

    // Atualizar badge e resumo financeiro do modal
    const expectedBadge = document.getElementById('mini-filter-expected-badge');
    if (expectedBadge) {
        if (expectedAmount > 0) {
            expectedBadge.innerText = `Saldo: ${formatMZN(expectedAmount)}`;
            expectedBadge.classList.remove('hidden');
        } else {
            expectedBadge.classList.add('hidden');
        }
    }

    const summaryExpectedEl = document.getElementById('mini-filter-summary-expected');
    if (summaryExpectedEl) {
        summaryExpectedEl.innerText = formatMZN(totalExpected > 0 ? totalExpected : expectedAmount);
    }
    const summaryAlreadyPaidEl = document.getElementById('mini-filter-summary-already-paid');
    if (summaryAlreadyPaidEl) {
        summaryAlreadyPaidEl.innerText = formatMZN(alreadyPaid);
    }
    const summaryAllocatingEl = document.getElementById('mini-filter-summary-allocating');
    if (summaryAllocatingEl) {
        summaryAllocatingEl.innerText = formatMZN(0);
    }
    const diffValEl = document.getElementById('mini-filter-difference-val');
    if (diffValEl) {
        diffValEl.innerText = formatMZN(expectedAmount);
    }

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
                const rowsWithNotes = (window.currentActiveClient && window.currentActiveClient.rows)
                    ? window.currentActiveClient.rows.filter(r => r.confirmNote && r.confirmNote.trim() !== '')
                    : [];

                if (rowsWithNotes.length > 0) {
                    const uniqueNotes = Array.from(new Set(rowsWithNotes.map(r => r.confirmNote.trim())));
                    let html = '';
                    uniqueNotes.forEach(noteText => {
                        html += `
                            <div class="py-1.5 px-2.5 hover:bg-amber-100/30 rounded-lg transition-colors border-l-4 border-amber-400 bg-amber-50/20 font-bold text-[11px] leading-relaxed text-slate-700">
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
    if (bankSelect && defaultBank && !Array.from(bankSelect.options).some(opt => opt.value === defaultBank)) {
        const newOpt = new Option(defaultBank, defaultBank);
        bankSelect.add(newOpt);
    }
    if (bankSelect) bankSelect.value = defaultBank;
    renderMiniFilterBankDisplay(defaultBank || '');

    // Reset filtros adicionais
    const ownerSelect = document.getElementById('mini-filter-owner');
    if (ownerSelect) ownerSelect.value = '';

    const modeSelect = document.getElementById('mini-filter-amount-mode');
    if (modeSelect) modeSelect.value = 'exact';
    handleAmountModeChange();

    const amountInput = document.getElementById('mini-filter-amount');
    if (amountInput) amountInput.value = expectedAmount > 0 ? expectedAmount.toFixed(2) : defaultAmount;

    const minInput = document.getElementById('mini-filter-amount-min');
    if (minInput) minInput.value = '';
    const maxInput = document.getElementById('mini-filter-amount-max');
    if (maxInput) maxInput.value = '';

    const refInput = document.getElementById('mini-filter-reference');
    if (refInput) refInput.value = '';

    const dateFrom = document.getElementById('mini-filter-date-from');
    if (dateFrom) dateFrom.value = '';
    const dateTo = document.getElementById('mini-filter-date-to');
    if (dateTo) dateTo.value = '';

    const channelSelect = document.getElementById('mini-filter-channel');
    if (channelSelect) channelSelect.value = '';

    const searchInput = document.getElementById('mini-filter-search');
    if (searchInput) searchInput.value = defaultTerm;

    const usedCheckbox = document.getElementById('mini-filter-show-used');
    if (usedCheckbox) usedCheckbox.checked = false;

    document.getElementById('mini-filter-results').innerHTML = '';
    document.getElementById('mini-filter-empty').classList.add('hidden');
    document.getElementById('mini-filter-combined-info').value = combinedInfo;

    // Reset campos de alocação
    document.getElementById('mini-filter-allocate-amount').value = '';
    document.getElementById('mini-filter-max-available').innerText = '0.00';
    if (document.getElementById('mini-filter-status')) {
        document.getElementById('mini-filter-status').value = 'CONFIRMADO';
        renderMiniFilterStatusDisplay('CONFIRMADO');
        closeMiniFilterStatusDropdown();
        document.getElementById('mini-filter-comment-container')?.classList.add('hidden');
        document.getElementById('mini-filter-comment').value = '';
    }

    selectedPaymentsForLink = [];

    checkMiniFilterStatus();

    searchPaymentMiniFilter();
}

export async function searchPaymentMiniFilter() {
    const bank = document.getElementById('mini-filter-bank')?.value.trim() || '';
    const owner = document.getElementById('mini-filter-owner')?.value.trim() || '';
    const amountMode = document.getElementById('mini-filter-amount-mode')?.value || 'exact';
    const amount = document.getElementById('mini-filter-amount')?.value.trim() || '';
    const amountMin = document.getElementById('mini-filter-amount-min')?.value.trim() || '';
    const amountMax = document.getElementById('mini-filter-amount-max')?.value.trim() || '';
    const reference = document.getElementById('mini-filter-reference')?.value.trim() || '';
    const dateFrom = document.getElementById('mini-filter-date-from')?.value || '';
    const dateTo = document.getElementById('mini-filter-date-to')?.value || '';
    const channel = document.getElementById('mini-filter-channel')?.value || '';
    const term = document.getElementById('mini-filter-search')?.value.trim() || '';
    const includeUsed = document.getElementById('mini-filter-show-used')?.checked || false;

    const tbody = document.getElementById('mini-filter-results');
    const emptyMsg = document.getElementById('mini-filter-empty');
    const countBadge = document.getElementById('mini-filter-count-badge');

    clearTimeout(searchPaymentTimeout);

    searchPaymentTimeout = setTimeout(async () => {
        try {
            tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400 font-bold text-xs"><span class="inline-block animate-pulse">A procurar pagamentos no banco...</span></td></tr>';
            emptyMsg.classList.add('hidden');
            if (countBadge) countBadge.innerText = 'A procurar...';

            let amountTolerance = 0;
            if (amountMode.startsWith('tol_')) {
                amountTolerance = parseFloat(amountMode.replace('tol_', '')) || 0;
            }

            const searchParams = {
                bank,
                accountOwner: owner,
                amount: amountMode !== 'range' ? amount : '',
                amountTolerance,
                amountMin: amountMode === 'range' ? amountMin : '',
                amountMax: amountMode === 'range' ? amountMax : '',
                reference,
                dateFrom,
                dateTo,
                channel,
                term,
                includeReconciled: includeUsed,
                limit: 150
            };

            const results = await searchPayments(searchParams);
            tbody.innerHTML = '';

            const totalSum = results.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
            if (countBadge) {
                countBadge.innerText = results.length + ' movimentos (' + formatMZN(totalSum) + ')';
            }

            if (results.length === 0) {
                emptyMsg.classList.remove('hidden');
                return;
            }

            results.forEach(rec => {
                const tr = document.createElement('tr');
                const isSelected = selectedPaymentsForLink.some(p => p.id === rec.id);
                const checkedAttr = isSelected ? 'checked' : '';
                let rowClass = isSelected ? 'bg-blue-100/80 border-blue-200 font-bold' : 'hover:bg-blue-50/70';
                if (rec.reconciled && !isSelected) {
                    rowClass = 'bg-slate-100/70 opacity-60 cursor-not-allowed';
                } else {
                    rowClass += ' cursor-pointer';
                }

                tr.className = rowClass + ' transition-colors border-b border-slate-100';
                tr.dataset.id = rec.id;

                const refText = rec.reference || rec.description || '';
                const bankDisplay = getPaymentBankDisplay(rec);
                
                // Permitir clique na linha se não estiver reconciliado (usado)
                if (!rec.reconciled) {
                    tr.onclick = () => togglePaymentSelection(rec.id, rec.date, refText, rec.amount, bankDisplay, rec.account_owner || '');
                }

                // 1. Data formatada DD/MM/AAAA
                const dateRaw = rec.date ? rec.date.split(' ')[0] : '—';
                let dateFormatted = dateRaw;
                if (dateRaw && dateRaw.includes('-')) {
                    const dp = dateRaw.split('-');
                    if (dp.length === 3) dateFormatted = dp[2] + '/' + dp[1] + '/' + dp[0];
                }

                // 2. Banco e Titular Badges
                const rawBank = (Array.isArray(rec.bank) ? rec.bank[0] : (rec.bank || '')).toUpperCase();
                let bankBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                if (rawBank.includes('BIM')) bankBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                else if (rawBank.includes('BCI')) bankBadgeClass = 'bg-orange-50 text-orange-700 border-orange-200';
                else if (rawBank.includes('STB') || rawBank.includes('STANDARD')) bankBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                else if (rawBank.includes('NEDBANK')) bankBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                else if (rawBank.includes('EMOLA') || rawBank.includes('MPESA')) bankBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';

                const ownerUpper = (rec.account_owner || '').toUpperCase();
                let ownerBadge = '';
                if (ownerUpper.includes('BOSS') || ownerUpper.includes('FILIPE')) {
                    ownerBadge = '<span class="text-[8px] font-black text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">BOSS</span>';
                } else if (ownerUpper.includes('JUPITER')) {
                    ownerBadge = '<span class="text-[8px] font-black text-slate-600 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">JUPITER</span>';
                }

                // 3. Referência / Documento
                let displayRef = rec.reference || '';
                if (!displayRef && rec.description) {
                    const refM = rec.description.match(/Ref\.?\s*([0-9A-Z]+)/i);
                    if (refM) displayRef = refM[0];
                }
                const cleanDisplayRef = displayRef ? displayRef.split(' (Ref Mestre:')[0] : '';

                // 4. Canal e Descrição
                const descUpper = (rec.description || '').toUpperCase();
                let channelBadge = '';
                if (descUpper.includes('MPESA') || descUpper.includes('M-PESA')) {
                    channelBadge = '<span class="bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded mr-1">M-PESA</span>';
                } else if (descUpper.includes('EMOLA') || descUpper.includes('E-MOLA')) {
                    channelBadge = '<span class="bg-orange-100 text-orange-800 text-[8px] font-black px-1.5 py-0.5 rounded mr-1">E-MOLA</span>';
                } else if (descUpper.includes('P24') || descUpper.includes('SIMO')) {
                    channelBadge = '<span class="bg-purple-100 text-purple-800 text-[8px] font-black px-1.5 py-0.5 rounded mr-1">P24</span>';
                } else if (descUpper.includes('ATM')) {
                    channelBadge = '<span class="bg-blue-100 text-blue-800 text-[8px] font-black px-1.5 py-0.5 rounded mr-1">ATM</span>';
                } else if (descUpper.includes('IZI')) {
                    channelBadge = '<span class="bg-rose-100 text-rose-800 text-[8px] font-black px-1.5 py-0.5 rounded mr-1">IZI</span>';
                } else if (descUpper.includes('INTERNET BANKING') || descUpper.includes(' SCI MB') || descUpper.includes('IB|')) {
                    channelBadge = '<span class="bg-sky-100 text-sky-800 text-[8px] font-black px-1.5 py-0.5 rounded mr-1">IB</span>';
                }

                let descHtml = channelBadge + '<span class="text-slate-700">' + (rec.description || '—') + '</span>';
                if (rec.reconciled) {
                    const allocatedToInfo = rec.allocated_to ? (' Alocado a: ' + rec.allocated_to) : '';
                    descHtml = `
                        <div class="flex flex-col gap-1">
                            <div>
                                <span class="bg-slate-200 text-slate-600 px-1 py-0.5 rounded text-[8px] font-black mr-1 border border-slate-300" title="${rec.allocated_to || 'Já alocado'}">USADO</span>
                                ${descHtml}
                            </div>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="text-[9px] text-red-600 font-bold truncate max-w-[200px]" title="${allocatedToInfo}">
                                    Alocado a: <strong class="text-red-700">${rec.allocated_to || 'Outro Cliente'}</strong>
                                </span>
                                <button type="button" class="mini-filter-reassign-btn inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black text-amber-800 bg-amber-50 hover:bg-amber-100 hover:text-amber-900 border border-amber-300 shadow-2xs transition-all cursor-pointer whitespace-nowrap active:scale-95" title="Desalocar deste cliente e selecionar para o cliente atual">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M4 20L21 3"></path><path d="M21 16v5h-5"></path><path d="M15 15l6 6"></path><path d="M4 4l5 5"></path></svg>
                                    <span>⇄ Desalocar e Usar Aqui</span>
                                </button>
                            </div>
                        </div>
                    `;
                }

                // 5. Montante Formatado
                const amountFormatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(rec.amount);
                const checkboxDisabled = rec.reconciled ? 'disabled' : '';
                const bankLogoHtml = getBankLogoHtml(rawBank, 'w-4 h-4 rounded-[2px] object-contain shrink-0');

                tr.innerHTML = `
                    <td class="px-3 py-2 text-center" onclick="event.stopPropagation();">
                        <input type="checkbox" ${checkedAttr} ${checkboxDisabled} class="mini-filter-chk w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${rec.reconciled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}">
                    </td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs font-semibold text-slate-600">${dateFormatted}</td>
                    <td class="px-3 py-2 whitespace-nowrap">
                        <div class="flex items-center gap-1.5">
                            ${bankLogoHtml}
                            <span class="text-xs font-bold text-slate-700 uppercase">${rawBank || '—'}</span>
                            ${ownerBadge}
                        </div>
                    </td>
                    <td class="px-3 py-2 text-xs font-mono font-bold text-slate-800 max-w-[150px] truncate" title="${cleanDisplayRef}">
                        ${cleanDisplayRef ? '<span class="mini-filter-ref-btn cursor-pointer hover:text-blue-600 transition-colors" title="Clique para copiar e filtrar">' + cleanDisplayRef + '</span>' : '<span class="text-slate-300 font-normal">—</span>'}
                    </td>
                    <td class="px-3 py-2 text-xs text-slate-600 max-w-[280px] truncate" title="${(rec.description || '').replace(/"/g, '&quot;')}">${descHtml}</td>
                    <td class="px-3 py-2 text-right font-black text-xs md:text-sm text-green-600 whitespace-nowrap">${amountFormatted} <span class="text-[9px] font-bold text-slate-400">MT</span></td>
                `;

                // Configurar eventos sem interpolação de strings no HTML
                const chk = tr.querySelector('.mini-filter-chk');
                if (chk) {
                    chk.onchange = () => togglePaymentSelection(rec.id, rec.date, refText, parseFloat(rec.amount), bankDisplay, rec.account_owner || '');
                }

                const refBtn = tr.querySelector('.mini-filter-ref-btn');
                if (refBtn) {
                    refBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (window.copyToClipboard) window.copyToClipboard(cleanDisplayRef, 'Referência copiada!');
                        setMiniFilterReference(cleanDisplayRef);
                    };
                }

                const reassignBtn = tr.querySelector('.mini-filter-reassign-btn');
                if (reassignBtn) {
                    reassignBtn.onclick = async (e) => {
                        e.stopPropagation();
                        await reassignPaymentToCurrent(rec, refText, bankDisplay);
                    };
                }

                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error("Erro na pesquisa do mini-filtro:", error);
            tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold text-xs">Erro ao procurar pagamentos. Verifique a ligação de rede.</td></tr>';
            if (countBadge) countBadge.innerText = 'Erro';
        }
    }, 300);
}


export function renderMiniFilterBankDisplay(bankVal) {
    const displayEl = document.getElementById('selected-mini-filter-bank-display');
    if (!displayEl) return;

    const b = String(bankVal || '').trim().toUpperCase();
    let normVal = '';
    if (b.includes('BIM')) normVal = 'BIM';
    else if (b.includes('BCI')) normVal = 'BCI';
    else if (b.includes('STB') || b.includes('STANDARD')) normVal = 'STB';
    else if (b.includes('NEDBANK')) normVal = 'NEDBANK';
    else if (b.includes('EMOLA') || b.includes('MPESA') || b.includes('M-PESA')) normVal = 'EMOLA';
    else if (b) normVal = b;

    let html = '';
    switch (normVal) {
        case 'BIM':
            html = `<div class="flex items-center gap-1.5 truncate">
                <img src="assets/banks/bim.png" alt="BIM" class="w-4 h-4 rounded-[2px] object-contain shrink-0">
                <span class="text-xs font-bold text-slate-800">BIM</span>
            </div>`;
            break;
        case 'BCI':
            html = `<div class="flex items-center gap-1.5 truncate">
                <img src="assets/banks/bci.jpg" alt="BCI" class="w-4 h-4 rounded-[2px] object-contain shrink-0">
                <span class="text-xs font-bold text-slate-800">BCI</span>
            </div>`;
            break;
        case 'STB':
            html = `<div class="flex items-center gap-1.5 truncate">
                <img src="assets/banks/stb.png" alt="STB" class="w-4 h-4 rounded-[2px] object-contain shrink-0">
                <span class="text-xs font-bold text-slate-800">STB</span>
            </div>`;
            break;
        case 'NEDBANK':
            html = `<div class="flex items-center gap-1.5 truncate">
                <img src="assets/banks/nedbank.png" alt="NEDBANK" class="w-4 h-4 rounded-[2px] object-contain shrink-0">
                <span class="text-xs font-bold text-slate-800">NEDBANK</span>
            </div>`;
            break;
        case 'EMOLA':
            html = `<div class="flex items-center gap-1.5 truncate">
                <img src="assets/banks/emola.png" alt="EMOLA" class="w-4 h-4 rounded-[2px] object-contain shrink-0">
                <span class="text-xs font-bold text-slate-800">EMOLA</span>
            </div>`;
            break;
        case '':
            html = `<span>🏦 Todos os Bancos</span>`;
            break;
        default:
            const logo = getBankLogoHtml(normVal, 'w-4 h-4 rounded-[2px] object-contain shrink-0');
            html = `<div class="flex items-center gap-1.5 truncate">
                ${logo || '🏦'}
                <span class="text-xs font-bold text-slate-800">${bankVal}</span>
            </div>`;
    }
    displayEl.innerHTML = html;

    document.querySelectorAll('.mini-bank-opt').forEach(opt => {
        const optVal = (opt.getAttribute('data-val') || '').trim().toUpperCase();
        if (optVal === normVal || (!normVal && !optVal)) {
            opt.classList.add('bg-slate-100', 'font-black');
        } else {
            opt.classList.remove('bg-slate-100', 'font-black');
        }
    });
}
window.renderMiniFilterBankDisplay = renderMiniFilterBankDisplay;

export function toggleMiniFilterBankDropdown(e) {
    if (e) e.stopPropagation();
    const list = document.getElementById('list-dropdown-mini-filter-bank');
    const arrow = document.getElementById('arrow-mini-filter-bank');
    if (!list) return;

    const willOpen = list.classList.contains('hidden');
    closeAllMiniFilterDropdowns();

    if (willOpen) {
        list.classList.remove('hidden');
        if (arrow) arrow.classList.add('rotate-180');
    }
}
window.toggleMiniFilterBankDropdown = toggleMiniFilterBankDropdown;

export function closeMiniFilterBankDropdown() {
    const list = document.getElementById('list-dropdown-mini-filter-bank');
    const arrow = document.getElementById('arrow-mini-filter-bank');
    if (list) list.classList.add('hidden');
    if (arrow) arrow.classList.remove('rotate-180');
}
window.closeMiniFilterBankDropdown = closeMiniFilterBankDropdown;

export function selectMiniFilterBank(val) {
    const selectEl = document.getElementById('mini-filter-bank');
    if (selectEl) {
        if (val && !Array.from(selectEl.options).some(opt => opt.value === val)) {
            selectEl.add(new Option(val, val));
        }
        selectEl.value = val;
    }
    renderMiniFilterBankDisplay(val);
    closeMiniFilterBankDropdown();
    searchPaymentMiniFilter();
}
window.selectMiniFilterBank = selectMiniFilterBank;

export function renderMiniFilterOwnerDisplay(ownerVal) {
    const displayEl = document.getElementById('selected-mini-filter-owner-display');
    if (!displayEl) return;

    let html = '';
    switch (ownerVal) {
        case 'JUPITER':
            html = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-blue-50 text-blue-700 border-blue-200 shadow-2xs">
                🏢 JUPITER
            </span>`;
            break;
        case 'FILIPE':
            html = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-amber-50 text-amber-800 border-amber-200 shadow-2xs">
                👑 FILIPE (BOSS)
            </span>`;
            break;
        case '':
        default:
            html = `<span>👤 Todos os Titulares</span>`;
    }
    displayEl.innerHTML = html;

    document.querySelectorAll('.mini-owner-opt').forEach(opt => {
        if (opt.getAttribute('data-val') === (ownerVal || '')) {
            opt.classList.add('bg-slate-100', 'font-black');
        } else {
            opt.classList.remove('bg-slate-100', 'font-black');
        }
    });
}
window.renderMiniFilterOwnerDisplay = renderMiniFilterOwnerDisplay;

export function toggleMiniFilterOwnerDropdown(e) {
    if (e) e.stopPropagation();
    const list = document.getElementById('list-dropdown-mini-filter-owner');
    const arrow = document.getElementById('arrow-mini-filter-owner');
    if (!list) return;

    const willOpen = list.classList.contains('hidden');
    closeAllMiniFilterDropdowns();

    if (willOpen) {
        list.classList.remove('hidden');
        if (arrow) arrow.classList.add('rotate-180');
    }
}
window.toggleMiniFilterOwnerDropdown = toggleMiniFilterOwnerDropdown;

export function closeMiniFilterOwnerDropdown() {
    const list = document.getElementById('list-dropdown-mini-filter-owner');
    const arrow = document.getElementById('arrow-mini-filter-owner');
    if (list) list.classList.add('hidden');
    if (arrow) arrow.classList.remove('rotate-180');
}
window.closeMiniFilterOwnerDropdown = closeMiniFilterOwnerDropdown;

export function selectMiniFilterOwner(val) {
    const selectEl = document.getElementById('mini-filter-owner');
    if (selectEl) {
        selectEl.value = val;
    }
    renderMiniFilterOwnerDisplay(val);
    closeMiniFilterOwnerDropdown();
    searchPaymentMiniFilter();
}
window.selectMiniFilterOwner = selectMiniFilterOwner;

export function renderMiniFilterAmountModeDisplay(modeVal) {
    const displayEl = document.getElementById('selected-mini-filter-amount-mode-display');
    if (!displayEl) return;

    let label = '= Exato';
    switch (modeVal) {
        case 'tol_10':
            label = '± 10 MT';
            break;
        case 'tol_50':
            label = '± 50 MT';
            break;
        case 'tol_100':
            label = '± 100 MT';
            break;
        case 'range':
            label = 'Min ↔ Max';
            break;
        case 'exact':
        default:
            label = '= Exato';
    }
    displayEl.innerText = label;

    document.querySelectorAll('.mini-amount-mode-opt').forEach(opt => {
        if (opt.getAttribute('data-val') === (modeVal || 'exact')) {
            opt.classList.add('bg-blue-50', 'font-black');
        } else {
            opt.classList.remove('bg-blue-50', 'font-black');
        }
    });
}
window.renderMiniFilterAmountModeDisplay = renderMiniFilterAmountModeDisplay;

export function toggleMiniFilterAmountModeDropdown(e) {
    if (e) e.stopPropagation();
    const list = document.getElementById('list-dropdown-mini-filter-amount-mode');
    const arrow = document.getElementById('arrow-mini-filter-amount-mode');
    if (!list) return;

    const willOpen = list.classList.contains('hidden');
    closeAllMiniFilterDropdowns();

    if (willOpen) {
        list.classList.remove('hidden');
        if (arrow) arrow.classList.add('rotate-180');
    }
}
window.toggleMiniFilterAmountModeDropdown = toggleMiniFilterAmountModeDropdown;

export function closeMiniFilterAmountModeDropdown() {
    const list = document.getElementById('list-dropdown-mini-filter-amount-mode');
    const arrow = document.getElementById('arrow-mini-filter-amount-mode');
    if (list) list.classList.add('hidden');
    if (arrow) arrow.classList.remove('rotate-180');
}
window.closeMiniFilterAmountModeDropdown = closeMiniFilterAmountModeDropdown;

export function selectMiniFilterAmountMode(val) {
    const selectEl = document.getElementById('mini-filter-amount-mode');
    if (selectEl) {
        selectEl.value = val;
    }
    renderMiniFilterAmountModeDisplay(val);
    closeMiniFilterAmountModeDropdown();
    handleAmountModeChange();
}
window.selectMiniFilterAmountMode = selectMiniFilterAmountMode;

export function renderMiniFilterChannelDisplay(channelVal) {
    const displayEl = document.getElementById('selected-mini-filter-channel-display');
    if (!displayEl) return;

    let html = '';
    switch (channelVal) {
        case 'IB':
            html = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-blue-50 text-blue-700 border-blue-200 shadow-2xs">
                💻 Internet Banking
            </span>`;
            break;
        case 'P24':
            html = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs">
                🏧 P24 / ATM
            </span>`;
            break;
        case 'MPESA':
            html = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-red-50 text-red-700 border-red-200 shadow-2xs">
                📱 M-Pesa
            </span>`;
            break;
        case 'EMOLA':
            html = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-amber-50 text-amber-700 border-amber-200 shadow-2xs">
                📲 e-Mola
            </span>`;
            break;
        case 'IZI':
            html = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-yellow-50 text-yellow-800 border-yellow-200 shadow-2xs">
                ⚡ IZI Transfer
            </span>`;
            break;
        case 'TRF':
            html = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-slate-100 text-slate-700 border-slate-300 shadow-2xs">
                📄 Transferência
            </span>`;
            break;
        case '':
        default:
            html = `<span>🌐 Todos os Canais</span>`;
    }
    displayEl.innerHTML = html;

    document.querySelectorAll('.mini-channel-opt').forEach(opt => {
        if (opt.getAttribute('data-val') === (channelVal || '')) {
            opt.classList.add('bg-slate-100', 'font-black');
        } else {
            opt.classList.remove('bg-slate-100', 'font-black');
        }
    });
}
window.renderMiniFilterChannelDisplay = renderMiniFilterChannelDisplay;

export function toggleMiniFilterChannelDropdown(e) {
    if (e) e.stopPropagation();
    const list = document.getElementById('list-dropdown-mini-filter-channel');
    const arrow = document.getElementById('arrow-mini-filter-channel');
    if (!list) return;

    const willOpen = list.classList.contains('hidden');
    closeAllMiniFilterDropdowns();

    if (willOpen) {
        list.classList.remove('hidden');
        if (arrow) arrow.classList.add('rotate-180');
    }
}
window.toggleMiniFilterChannelDropdown = toggleMiniFilterChannelDropdown;

export function closeMiniFilterChannelDropdown() {
    const list = document.getElementById('list-dropdown-mini-filter-channel');
    const arrow = document.getElementById('arrow-mini-filter-channel');
    if (list) list.classList.add('hidden');
    if (arrow) arrow.classList.remove('rotate-180');
}
window.closeMiniFilterChannelDropdown = closeMiniFilterChannelDropdown;

export function selectMiniFilterChannel(val) {
    const selectEl = document.getElementById('mini-filter-channel');
    if (selectEl) {
        selectEl.value = val;
    }
    renderMiniFilterChannelDisplay(val);
    closeMiniFilterChannelDropdown();
    searchPaymentMiniFilter();
}
window.selectMiniFilterChannel = selectMiniFilterChannel;

export function closeAllMiniFilterDropdowns() {
    closeMiniFilterBankDropdown();
    closeMiniFilterOwnerDropdown();
    closeMiniFilterAmountModeDropdown();
    closeMiniFilterChannelDropdown();
    closeMiniFilterStatusDropdown();
}
window.closeAllMiniFilterDropdowns = closeAllMiniFilterDropdowns;

export function renderMiniFilterStatusDisplay(statusValue) {
    const displayEl = document.getElementById('selected-mini-filter-status-display');
    if (!displayEl) return;

    let badgeHtml = '';
    switch (statusValue) {
        case 'CONFIRMADO':
            badgeHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-green-50 text-green-700 border-green-300 shadow-2xs">
                <svg class="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                CONFIRMADO
            </span>`;
            break;
        case 'PARCIAL':
            badgeHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-amber-100 text-amber-800 border-amber-300 shadow-2xs">
                <svg class="w-2.5 h-2.5 text-amber-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                PARCIAL
            </span>`;
            break;
        case 'AGUARDA PAGAMENTO':
            badgeHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-slate-100 text-slate-600 border-slate-300 shadow-2xs">
                <svg class="w-2.5 h-2.5 text-slate-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                AGUARDA PAGAMENTO
            </span>`;
            break;
        case 'RE-VERIFICANDO':
            badgeHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-blue-100 text-blue-800 border-blue-300 shadow-2xs">
                <svg class="w-2.5 h-2.5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                RE-VERIFICANDO
            </span>`;
            break;
        case 'SEM COMPROVATIVO':
            badgeHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-orange-100 text-orange-800 border-orange-300 shadow-2xs">
                <svg class="w-2.5 h-2.5 text-orange-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                SEM COMPROVATIVO
            </span>`;
            break;
        case 'COMPROVATIVO ERRADO':
            badgeHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-red-100 text-red-800 border-red-300 shadow-2xs">
                <svg class="w-2.5 h-2.5 text-red-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                COMPROVATIVO ERRADO
            </span>`;
            break;
        case 'PENDENTE':
            badgeHtml = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter border bg-yellow-400 text-black border-yellow-500 shadow-2xs">
                <svg class="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                PENDENTE
            </span>`;
            break;
        default:
            badgeHtml = `<span class="font-black text-xs text-slate-700 uppercase">${statusValue || 'Status...'}</span>`;
    }
    displayEl.innerHTML = badgeHtml;

    // Atualizar estilo ativo na lista customizada
    document.querySelectorAll('.mini-status-opt').forEach(opt => {
        if (opt.getAttribute('data-val') === statusValue) {
            opt.classList.add('bg-slate-100', 'font-black');
        } else {
            opt.classList.remove('bg-slate-100', 'font-black');
        }
    });
}
window.renderMiniFilterStatusDisplay = renderMiniFilterStatusDisplay;

export function toggleMiniFilterStatusDropdown(e) {
    if (e) e.stopPropagation();
    const list = document.getElementById('list-dropdown-mini-filter-status');
    const arrow = document.getElementById('arrow-mini-filter-status');
    if (!list) return;

    const willOpen = list.classList.contains('hidden');
    closeAllMiniFilterDropdowns();

    if (willOpen) {
        list.classList.remove('hidden');
        if (arrow) arrow.classList.add('rotate-180');
    }
}
window.toggleMiniFilterStatusDropdown = toggleMiniFilterStatusDropdown;

export function closeMiniFilterStatusDropdown() {
    const list = document.getElementById('list-dropdown-mini-filter-status');
    const arrow = document.getElementById('arrow-mini-filter-status');
    if (list) list.classList.add('hidden');
    if (arrow) arrow.classList.remove('rotate-180');
}
window.closeMiniFilterStatusDropdown = closeMiniFilterStatusDropdown;

export function selectMiniFilterStatus(val) {
    const selectEl = document.getElementById('mini-filter-status');
    if (selectEl) {
        selectEl.value = val;
        selectEl.dispatchEvent(new Event('change'));
    }
    renderMiniFilterStatusDisplay(val);
    closeMiniFilterStatusDropdown();
}
window.selectMiniFilterStatus = selectMiniFilterStatus;

export function checkMiniFilterStatus() {
    const allocated = parseFloat(document.getElementById('mini-filter-allocate-amount')?.value) || 0;
    const statusSelect = document.getElementById('mini-filter-status');
    const commentContainer = document.getElementById('mini-filter-comment-container');
    
    // Atualizar "A Alocar Agora" no resumo financeiro
    const summaryAllocatingEl = document.getElementById('mini-filter-summary-allocating');
    if (summaryAllocatingEl) {
        summaryAllocatingEl.innerText = formatMZN(allocated);
    }

    // Calcular diferença / falta pagar
    const diff = Math.max(0, currentMiniFilterExpectedAmount - allocated);
    const diffValEl = document.getElementById('mini-filter-difference-val');
    const diffLabelEl = document.getElementById('mini-filter-difference-label');
    const statusPill = document.getElementById('mini-filter-status-pill');

    if (diffValEl) diffValEl.innerText = formatMZN(diff);

    if (allocated > 0 && currentMiniFilterExpectedAmount > 0 && diff > 0.05) {
        // PARCIAL
        if (statusSelect && statusSelect.value !== 'PARCIAL') {
            statusSelect.value = 'PARCIAL';
            renderMiniFilterStatusDisplay('PARCIAL');
        }
        if (statusPill) {
            statusPill.innerText = 'PARCIAL';
            statusPill.className = 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 shadow-sm';
        }
        if (diffLabelEl) {
            diffLabelEl.innerText = 'Falta Pagar';
            diffLabelEl.className = 'text-[9px] font-black uppercase text-amber-600 tracking-wider block';
        }
        if (diffValEl) {
            diffValEl.className = 'font-black text-amber-600 text-xs md:text-sm';
        }
        if (commentContainer) commentContainer.classList.remove('hidden');
    } else if (allocated > 0 && (currentMiniFilterExpectedAmount <= 0 || diff <= 0.05)) {
        // CONFIRMADO
        if (statusSelect && (statusSelect.value === 'PARCIAL' || statusSelect.value === 'PENDENTE')) {
            statusSelect.value = 'CONFIRMADO';
            renderMiniFilterStatusDisplay('CONFIRMADO');
        }
        if (statusPill) {
            statusPill.innerText = 'CONFIRMADO';
            statusPill.className = 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm';
        }
        if (diffLabelEl) {
            diffLabelEl.innerText = 'Total Coberto';
            diffLabelEl.className = 'text-[9px] font-black uppercase text-emerald-600 tracking-wider block';
        }
        if (diffValEl) {
            diffValEl.className = 'font-black text-emerald-600 text-xs md:text-sm';
        }
        if (commentContainer) commentContainer.classList.add('hidden');
    } else {
        // Sem valor selecionado para alocação (allocated === 0)
        if (statusPill) {
            statusPill.innerText = diff > 0.05 ? 'A RECONCILIAR' : 'COBERTO';
            statusPill.className = 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300 shadow-sm';
        }
        if (diffLabelEl) {
            diffLabelEl.innerText = 'A Regularizar';
            diffLabelEl.className = 'text-[9px] font-black uppercase text-slate-500 tracking-wider block';
        }
        if (diffValEl) {
            diffValEl.className = 'font-black text-slate-700 text-xs md:text-sm';
        }
    }
}
window.checkMiniFilterStatus = checkMiniFilterStatus;

export function togglePaymentSelection(id, date, ref, fullAmount, bank = '', accountOwner = '') {
    const idx = selectedPaymentsForLink.findIndex(p => p.id === id);
    if (idx !== -1) {
        selectedPaymentsForLink.splice(idx, 1);
    } else {
        selectedPaymentsForLink.push({
            id: id,
            date: date,
            ref: ref,
            amount: parseFloat(fullAmount),
            bank: bank,
            accountOwner: accountOwner
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
    const suggested = currentMiniFilterExpectedAmount > 0
        ? Math.min(currentMiniFilterExpectedAmount, totalMaxAvailable)
        : totalMaxAvailable;
    document.getElementById('mini-filter-allocate-amount').value = suggested > 0 ? suggested.toFixed(2) : '';
    document.getElementById('mini-filter-max-available').innerText = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(totalMaxAvailable);

    // Atualizar visualização do status para refletir a nova alocação
    checkMiniFilterStatus();
}

// Manter retrocompatibilidade se alguma outra parte chamar
export function selectPaymentResult(id, date, ref, trElement, fullAmount) {
    togglePaymentSelection(id, date, ref, fullAmount);
}

/**
 * Desaloca um pagamento que já estava alocado a outro cliente e seleciona-o imediatamente para o cliente atual
 */
export async function reassignPaymentToCurrent(rec, refText, bankDisplay) {
    const role = pb.authStore.model?.role || 'USER';
    if (role === 'USER' || role === 'USER_L1') {
        alert("Acesso Negado: A desalocação e reatribuição de pagamentos exige nível de permissão Nível 2 ou Administrador.");
        return;
    }

    const combinedInfo = document.getElementById('mini-filter-combined-info')?.value || '';
    const clientName = window.currentActiveClient?.displayName || window.currentActiveClient?.name || '';
    const clientNo = window.currentActiveClient?.no || '';
    const sheetId = state.confirm?.sheetId || '';

    const formattedAmount = formatMZN(rec.amount);
    const allocatedTo = rec.allocated_to || 'outro cliente';
    const targetLabel = `${clientNo ? '#' + clientNo + ' ' : ''}${clientName || combinedInfo}`;

    const confirmMsg = `Este movimento bancário no valor de ${formattedAmount} está atualmente alocado a:\n\n` +
        `"${allocatedTo}"\n\n` +
        `Deseja desalocá-lo desse cliente e selecioná-lo imediatamente para o cliente atual (${targetLabel})?`;

    if (!confirm(confirmMsg)) return;

    try {
        if (typeof showLoader === 'function') showLoader();

        // 1. Desalocar o pagamento no PocketBase mantendo o registo individual (sem fundir split)
        await unallocatePayment(rec.id, { mergeSplit: false });

        // 2. Registar auditoria de transferência
        try {
            await logConfirmAudit(sheetId, clientNo, clientName, 'PAGAMENTO_TRANSFERIDO', {
                paymentId: rec.id,
                amount: rec.amount,
                ref: rec.reference || rec.description || '',
                de: allocatedTo,
                para: combinedInfo || clientName
            });
        } catch (auditErr) {
            console.warn('[Audit] Erro ao registar auditoria de reatribuição:', auditErr);
        }

        // 3. Atualizar estado local do registo
        rec.reconciled = false;
        rec.allocated_to = '';

        // 4. Selecionar automaticamente o movimento para o cliente atual se ainda não estiver selecionado
        if (!selectedPaymentsForLink.some(p => p.id === rec.id)) {
            togglePaymentSelection(rec.id, rec.date, refText, parseFloat(rec.amount), bankDisplay, rec.account_owner || '');
        }

        // 5. Atualizar os resultados da pesquisa do mini-filtro para refletir a nova seleção
        await searchPaymentMiniFilter();

        const successMsg = `Movimento desalocado de "${allocatedTo}" e selecionado com sucesso!`;
        if (typeof toast === 'function') {
            toast(successMsg, "success");
        } else if (typeof ui.toast === 'function') {
            ui.toast(successMsg, "success");
        } else {
            alert(successMsg);
        }
    } catch (err) {
        console.error("Erro ao desalocar e reatribuir pagamento:", err);
        alert("Erro ao desalocar o pagamento: " + (err.message || err));
    } finally {
        if (typeof hideLoader === 'function') hideLoader();
    }
}
window.reassignPaymentToCurrent = reassignPaymentToCurrent;

export async function confirmPaymentSelection() {
    let status = document.getElementById('mini-filter-status').value;
    const combinedInfo = document.getElementById('mini-filter-combined-info').value;
    const allocatedAmount = parseFloat(document.getElementById('mini-filter-allocate-amount').value) || 0;

    const totalMaxAvailable = selectedPaymentsForLink.reduce((sum, p) => sum + p.amount, 0);

    if (status === 'CONFIRMADO' || status === 'PARCIAL') {
        if (selectedPaymentsForLink.length === 0) {
            ui.toast('Para vincular o pagamento, selecione primeiro um ou mais pagamentos na lista.', "warning");
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

    // Se o valor alocado for menor que o esperado, forçar status para PARCIAL
    if (allocatedAmount > 0 && currentMiniFilterExpectedAmount > 0 && allocatedAmount < (currentMiniFilterExpectedAmount - 0.05)) {
        if (status === 'CONFIRMADO') {
            status = 'PARCIAL';
            const statusSelect = document.getElementById('mini-filter-status');
            if (statusSelect) {
                statusSelect.value = 'PARCIAL';
                renderMiniFilterStatusDisplay('PARCIAL');
            }
        }
    }

    const btn = document.querySelector('#payment-mini-filter button.bg-blue-600');

    try {
        setBtnLoading(btn, true, 'Vincular...');
        setLoader(true, 'A gravar reconciliação...');

        // 1. Distribuir o valor alocado em memória para as transações selecionadas
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
            const feeKey = (window.paymentReconciliationContext === 'STORAGE' || window.paymentReconciliationContext === 'DESPACHO')
                ? window.paymentReconciliationContext
                : null;

            if (feeKey) {
                const feeCfg = CLIENT_FEE_CONFIG[feeKey];
                const feeCtx = window.feeReconciliationContext || window.storageReconciliationContext || {};
                const feeAllocatedTo = feeCtx.allocatedToKey || (combinedInfo.startsWith(`${feeCfg.prefix} -`) ? combinedInfo : `${feeCfg.prefix} - ${combinedInfo}`);
                const clientNo = window.currentActiveClient?.no || (window.currentClientRows?.[0]?.no) || '';
                const clientName = window.currentActiveClient?.displayName || (window.currentClientRows?.[0]?.client) || '';
                const sheetId = state.confirm?.sheetId || '';

                await feeCfg.ensureColumnsFn();
                const updatedCols = state.confirm.columns || [];
                const sortedClientRows = [...window.currentClientRows].sort((a, b) => a.originalIndex - b.originalIndex);
                const newlyAllocatedSum = usedPayments.reduce((sum, p) => sum + p.amount, 0);

                let existingAllocatedOtherSum = 0;
                try {
                    const existingPmts = await getPaymentsByAllocatedTo(feeAllocatedTo);
                    if (existingPmts && existingPmts.length > 0) {
                        existingAllocatedOtherSum = existingPmts
                            .filter(p => !usedPayments.some(u => u.id === p.id))
                            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                    }
                } catch (fetchErr) {
                    console.warn(`[confirmPaymentSelection][${feeKey}] Aviso ao consultar vínculos existentes:`, fetchErr);
                }

                const totalBankFunds = existingAllocatedOtherSum + newlyAllocatedSum;
                let agreedCost = parseFloat(feeCtx.agreedCost);
                let standardCost = parseFloat(feeCtx.standardCost);
                if (isNaN(agreedCost) || isNaN(standardCost)) {
                    if (feeKey === 'DESPACHO') {
                        const calc = calculateClientDespachoCopy({
                            rows: sortedClientRows,
                            columns: updatedCols,
                            defaultPrice: getDespachoCopyDefaultPrice(),
                            bankPayments: []
                        });
                        if (isNaN(standardCost)) standardCost = calc.defaultPrice;
                        if (isNaN(agreedCost)) agreedCost = calc.cost > 0 ? calc.cost : calc.defaultPrice;
                    } else {
                        const calc = calculateClientStorage({
                            rows: sortedClientRows,
                            columns: updatedCols,
                            dischargeDateStr: state.confirm?.dischargeDate || '',
                            bankPayments: []
                        });
                        if (isNaN(standardCost)) standardCost = calc.standardCost;
                        if (isNaN(agreedCost)) agreedCost = calc.storageInfo.cost;
                    }
                }

                const remainingAfter = Math.max(0, agreedCost - totalBankFunds);
                const isFullyPaidAfter = (agreedCost === 0 && totalBankFunds > 0) || (agreedCost > 0 && remainingAfter <= 0.05) || (agreedCost === 0 && feeKey === 'STORAGE');
                const { statusCellVal, valueCellVal } = formatFeeSheetStatus({
                    isRequested: true,
                    targetCost: agreedCost,
                    standardCost,
                    bankPaidAmount: totalBankFunds,
                    manualStatus: 'NAO',
                    zeroCostPendingLabel: feeCfg.zeroCostPendingLabel,
                    preferAmountOnPaid: feeCfg.preferAmountOnPaid
                });

                await syncClientFeeToGSheet(feeKey, window.currentActiveClient, {
                    statusCellVal,
                    valueCellVal,
                    emitStatus: isFullyPaidAfter ? 'PAGO' : 'PARCIAL'
                });

                if (usedPayments.length > 0) {
                    try {
                        for (const up of usedPayments) {
                            await markPaymentReconciled(up.id, feeAllocatedTo, up.amount);
                        }
                    } catch (pbErr) {
                        console.warn(`[PocketBase][${feeKey}] Falha ao registar conciliação no PocketBase:`, pbErr);
                    }
                }

                try {
                    logConfirmAudit(sheetId, clientNo, clientName, 'PAGAMENTO_VINCULADO', {
                        tipo: feeCfg.auditLabel,
                        allocatedAmount,
                        totalBankPaid: totalBankFunds,
                        feeValue: valueCellVal,
                        status: isFullyPaidAfter ? 'PAGO' : 'PARCIAL',
                        payments: usedPayments.map(p => ({ id: p.id, date: p.date, ref: p.ref, amount: p.amount })),
                        comment: document.getElementById('mini-filter-comment')?.value || ''
                    }).catch(auditErr => console.warn('[Audit] Erro ao registar auditoria:', auditErr));
                } catch (auditErr) {
                    console.warn('[Audit] Erro ao disparar auditoria:', auditErr);
                }
            } else {
            let statusIdx = -1, pag1Idx = -1, pag2Idx = -1, pag3Idx = -1, obsIdx = -1, paidIdx = -1, balanceIdx = -1, amountIdx = -1;
            let bankFreightIdx = -1, notaFreightIdx = -1, notaDutyIdx = -1, bankDutyIdx = -1;

            if (isFreight) {
                paidIdx = findColumnIndex(columns, ['PAID FREIGHT']);
                balanceIdx = findColumnIndex(columns, ['BALANCE FREIGHT']);
                amountIdx = findColumnIndex(columns, ['AMOUNT FREIGHT']);
                bankFreightIdx = findColumnIndex(columns, ['BANK IN FREIGHT']);
                notaFreightIdx = findColumnIndex(columns, ['NOTA FREIGHT']);
                pag1Idx = findColumnIndex(columns, ['PAG FRETE 1']);
                pag2Idx = findColumnIndex(columns, ['PAG FRETE 2']);
                pag3Idx = findColumnIndex(columns, ['PAG FRETE 3']);
            } else {
                statusIdx = findColumnIndex(columns, ['CONFIRMATION', 'STATUS', 'CONFIRMACAO', 'CONFIRM']);
                bankDutyIdx = findColumnIndex(columns, ['BANK IN DUTY', 'BANK', 'BANCO']);
                notaDutyIdx = findColumnIndex(columns, ['NOTA DUTY', 'NOTA', 'OBSERVACAO', 'OBSERVACOES', 'OBS', 'NOTA_DUTY']);
                pag1Idx = findColumnIndex(columns, ['PAG 1', 'PAG1']);
                pag2Idx = findColumnIndex(columns, ['PAG 2', 'PAG2']);
                pag3Idx = findColumnIndex(columns, ['PAG 3', 'PAG3']);
                obsIdx = findColumnIndex(columns, ['OBS', 'COMENTARIO', 'NOTAS', 'OBSERVACAO', 'OBSERVACOES']);
                paidIdx = findColumnIndex(columns, ['PAID', 'PAID DUTY', 'DUTY PAID', 'VALOR PAGO', 'PAGO']);
                if (paidIdx !== -1 && cleanString(columns[paidIdx]).includes('FREIGHT')) {
                    paidIdx = columns.findIndex(c => {
                        const h = cleanString(c);
                        return (h === 'PAID' || h === 'PAIDDUTY' || h === 'DUTYPAID' || h === 'PAGO') && !h.includes('FREIGHT');
                    });
                }
                balanceIdx = findColumnIndex(columns, ['BALANCE', 'SALDO', 'BALANCO']);
                if (balanceIdx !== -1 && cleanString(columns[balanceIdx]).includes('FREIGHT')) {
                    balanceIdx = columns.findIndex(c => {
                        const h = cleanString(c);
                        return (h === 'BALANCE' || h === 'SALDO' || h === 'BALANCO') && !h.includes('FREIGHT');
                    });
                }
                amountIdx = findColumnIndex(columns, ['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'ADUANEIROS']);
            }

            if (state.confirm.sheetId) {
                let sheetName = '';
                if (state.confirm.range && state.confirm.range.includes('!')) {
                    sheetName = state.confirm.range.split('!')[0];
                } else if (state.confirm.sheetTitle) {
                    sheetName = state.confirm.sheetTitle;
                }
                sheetName = (sheetName || '').replace(/^'+|'+$/g, '').trim();
                if (!sheetName || sheetName.toUpperCase() === 'FOLHA1') {
                    if (state.confirm.sheetTitle && state.confirm.sheetTitle.toUpperCase() !== 'FOLHA1') {
                        sheetName = state.confirm.sheetTitle;
                    } else if (state.confirm.range && state.confirm.range.includes('Sheet1')) {
                        sheetName = 'Sheet1';
                    } else {
                        sheetName = 'Sheet1';
                    }
                }

                // Resolver banco para Duty a partir dos pagamentos selecionados
                let dutyBankVal = '';
                if (!isFreight && selectedPaymentsForLink.length > 0) {
                    const firstPayment = selectedPaymentsForLink[0];
                    let rawSelectedBank = firstPayment ? String(firstPayment.bank || '').toUpperCase().trim() : '';
                    if (rawSelectedBank && rawSelectedBank !== '—') {
                        if ((rawSelectedBank === 'BCI' || rawSelectedBank === 'BIM') && !rawSelectedBank.includes('BOSS') && !rawSelectedBank.includes('JUPITER')) {
                            const owner = firstPayment ? String(firstPayment.account_owner || firstPayment.accountOwner || '').toUpperCase() : '';
                            const ref = firstPayment ? String(firstPayment.reference || firstPayment.ref || '').toUpperCase() : '';
                            if (owner.includes('BOSS') || owner.includes('FILIPE') || ref.includes('BOSS') || ref.includes('FILIPE')) {
                                rawSelectedBank = `${rawSelectedBank} BOSS`;
                            } else if (owner.includes('JUPITER') || ref.includes('JUPITER')) {
                                rawSelectedBank = `${rawSelectedBank} JUPITER`;
                            } else {
                                rawSelectedBank = `${rawSelectedBank} JUPITER`;
                            }
                        }
                        dutyBankVal = rawSelectedBank;
                    }
                }

                // Encontrar o originalIndex da primeira linha (ordem) do cliente ativo
                const sortedClientRows = [...window.currentClientRows].sort((a, b) => a.originalIndex - b.originalIndex);
                const firstRowIndex = sortedClientRows[0]?.originalIndex;

                const newlyAllocatedSum = usedPayments.reduce((sum, p) => sum + p.amount, 0);

                // Buscar outros pagamentos já alocados a este cliente no PocketBase para somar o valor total bancário
                let existingAllocatedOtherSum = 0;
                try {
                    const existingPmts = await getPaymentsByAllocatedTo(isFreight ? `FRETE - ${combinedInfo}` : combinedInfo);
                    if (existingPmts && existingPmts.length > 0) {
                        existingAllocatedOtherSum = existingPmts
                            .filter(p => !usedPayments.some(u => u.id === p.id))
                            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                    }
                } catch (fetchErr) {
                    console.warn("[confirmPaymentSelection] Aviso ao consultar pagamentos existentes:", fetchErr);
                }

                // O total de fundos bancários disponíveis para cobrir as ordens deste cliente:
                const totalBankFundsForClient = existingAllocatedOtherSum + newlyAllocatedSum;
                let fundsRemaining = totalBankFundsForClient;

                // Calcular meta total líquida do cliente
                const totalClientNetTarget = sortedClientRows.reduce((sum, r) => {
                    const a = isFreight ? (parseFloat(r.amtFreight) || 0) : (parseFloat(r.amountDuty) || 0);
                    const p = isFreight ? 0 : (parseFloat(r.dutyPrepaid) || 0);
                    return sum + Math.max(0, a - p);
                }, 0);

                let filterStatus = status;
                if (totalClientNetTarget > 0 && totalBankFundsForClient < (totalClientNetTarget - 0.05)) {
                    filterStatus = 'PARCIAL';
                }

                // Formatar as datas de todos os pagamentos selecionados para vínculo usando parseDate
                const formattedDates = selectedPaymentsForLink.map(p => {
                    if (!p.date) return '';
                    const d = parseDate(p.date);
                    if (!d || isNaN(d.getTime())) return String(p.date);
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

                // Fazer o update para cada linha deste cliente na ordem correta
                for (const rowObj of sortedClientRows) {
                    const sheetRowNumber = rowObj.originalIndex + 1;
                    const originalIndex = rowObj.originalIndex;
                    const rawRow = (state.confirm?.data && state.confirm.data[originalIndex]) || rowObj.originalRow || [];
                    const rowData = [...rawRow];

                    let newStatus = filterStatus;
                    const isExceptionStatus = ['AGUARDA PAGAMENTO', 'RE-VERIFICANDO', 'SEM COMPROVATIVO', 'COMPROVATIVO ERRADO'].includes(filterStatus);

                    if (filterStatus === 'PENDENTE' && !isFreight) {
                        // Reverter pagamentos (apenas para duty)
                        newStatus = 'PENDENTE';
                        if (paidIdx !== -1) rowData[paidIdx] = '';
                        if (balanceIdx !== -1) rowData[balanceIdx] = rowObj.amountDuty;
                        if (bankDutyIdx !== -1) rowData[bankDutyIdx] = '';
                    } else {
                        // Distribuir o valor do pagamento sequencialmente a partir dos fundos bancários
                        const amt = isFreight ? (parseFloat(rowObj.amtFreight) || 0) : (parseFloat(rowObj.amountDuty) || 0);
                        const prep = isFreight ? 0 : (parseFloat(rowObj.dutyPrepaid) || 0);
                        const netTarget = Math.max(0, amt - prep);

                        let allocatedForThisRow = 0;
                        if (fundsRemaining > 0 && netTarget > 0) {
                            allocatedForThisRow = Math.min(fundsRemaining, netTarget);
                            fundsRemaining -= allocatedForThisRow;
                        }

                        const newPaid = allocatedForThisRow;
                        const newBalance = Math.max(0, netTarget - newPaid);

                        if (paidIdx !== -1) rowData[paidIdx] = newPaid;
                        if (balanceIdx !== -1) rowData[balanceIdx] = newBalance;

                        if (isFreight) {
                            rowObj.pdFreight = newPaid;
                            rowObj.balFreight = newBalance;
                            if (rowObj.originalRow) {
                                if (paidIdx !== -1) rowObj.originalRow[paidIdx] = newPaid;
                                if (balanceIdx !== -1) rowObj.originalRow[balanceIdx] = newBalance;
                            }
                            if (window.currentActiveClient && window.currentActiveClient.rows) {
                                const activeClientRow = window.currentActiveClient.rows.find(r => r.originalIndex === originalIndex);
                                if (activeClientRow) {
                                    activeClientRow.pdFreight = newPaid;
                                    activeClientRow.balFreight = newBalance;
                                    if (activeClientRow.originalRow) {
                                        if (paidIdx !== -1) activeClientRow.originalRow[paidIdx] = newPaid;
                                        if (balanceIdx !== -1) activeClientRow.originalRow[balanceIdx] = newBalance;
                                    }
                                }
                            }
                        } else {
                            rowObj.paid = newPaid;
                            rowObj.balance = newBalance;
                            if (dutyBankVal) rowObj.bankDuty = dutyBankVal;
                            if (rowObj.originalRow) {
                                if (paidIdx !== -1) rowObj.originalRow[paidIdx] = newPaid;
                                if (balanceIdx !== -1) rowObj.originalRow[balanceIdx] = newBalance;
                                if (bankDutyIdx !== -1 && dutyBankVal) rowObj.originalRow[bankDutyIdx] = dutyBankVal;
                            }
                            if (window.currentActiveClient && window.currentActiveClient.rows) {
                                const activeClientRow = window.currentActiveClient.rows.find(r => r.originalIndex === originalIndex);
                                if (activeClientRow) {
                                    activeClientRow.paid = newPaid;
                                    activeClientRow.balance = newBalance;
                                    activeClientRow.status = newStatus;
                                    if (dutyBankVal) activeClientRow.bankDuty = dutyBankVal;
                                    if (activeClientRow.originalRow) {
                                        if (paidIdx !== -1) activeClientRow.originalRow[paidIdx] = newPaid;
                                        if (balanceIdx !== -1) activeClientRow.originalRow[balanceIdx] = newBalance;
                                        if (bankDutyIdx !== -1 && dutyBankVal) activeClientRow.originalRow[bankDutyIdx] = dutyBankVal;
                                    }
                                }
                            }
                        }

                        // Determinar status por ordem individual:
                        if (isExceptionStatus) {
                            newStatus = filterStatus;
                        } else if (!isFreight) {
                            if (newBalance <= 1.0 && (newPaid > 0 || prep > 0 || amt === 0)) {
                                newStatus = 'CONFIRMADO';
                            } else if (newBalance > 1.0 && (newPaid > 0 || prep > 0 || allocatedForThisRow > 0)) {
                                newStatus = 'PARCIAL';
                            } else if (filterStatus === 'PARCIAL') {
                                newStatus = 'PARCIAL';
                            } else {
                                const rawCur = String(rawRow[statusIdx] || 'PENDENTE').trim().toUpperCase();
                                newStatus = (rawCur === 'CONFIRMADO' || rawCur === 'PARCIAL') ? 'PENDENTE' : (rawCur || 'PENDENTE');
                            }
                        }

                        // Mapear as datas dos pagamentos selecionados diretamente nas colunas correspondentes (PAG 1, PAG 2, PAG 3)
                        const pagIndices = [pag1Idx, pag2Idx, pag3Idx].filter(i => i !== -1);
                        for (let i = 0; i < pagIndices.length; i++) {
                            const pIdx = pagIndices[i];
                            const dateVal = formattedDates[i];
                            if (dateVal !== undefined) {
                                console.log(`[DEBUG-VINCULO] Linha ${sheetRowNumber} - Coluna PAG ${i + 1} (index ${pIdx}) recebe data: "${dateVal}"`);
                                rowData[pIdx] = dateVal;
                                if (rowObj.originalRow) rowObj.originalRow[pIdx] = dateVal;
                            }
                        }
                    }

                    if (statusIdx !== -1 && !isFreight) {
                        rowData[statusIdx] = newStatus;
                        if (rowObj.originalRow) rowObj.originalRow[statusIdx] = newStatus;
                        if (window.currentActiveClient && window.currentActiveClient.rows) {
                            const acr = window.currentActiveClient.rows.find(r => r.originalIndex === originalIndex);
                            if (acr) {
                                acr.status = newStatus;
                                if (acr.originalRow) acr.originalRow[statusIdx] = newStatus;
                            }
                        }
                    }

                    if (!isFreight && dutyBankVal && bankDutyIdx !== -1) {
                        rowData[bankDutyIdx] = dutyBankVal;
                    }

                    if (!isFreight && notaDutyIdx !== -1) {
                        // Limpar a Nota Duty (resposta do operador) sempre que um pagamento é vinculado
                        rowData[notaDutyIdx] = '';
                        if (rowObj.originalRow) rowObj.originalRow[notaDutyIdx] = '';
                    }

                    if (newStatus === 'PENDENTE' && !isFreight) {
                        // Se for PENDENTE, limpar as datas de pagamento e banco
                        const pagIndices = [pag1Idx, pag2Idx, pag3Idx].filter(i => i !== -1);
                        for (const pIdx of pagIndices) {
                            rowData[pIdx] = '';
                            if (rowObj.originalRow) rowObj.originalRow[pIdx] = '';
                        }
                        if (bankDutyIdx !== -1) {
                            rowData[bankDutyIdx] = '';
                            if (rowObj.originalRow) rowObj.originalRow[bankDutyIdx] = '';
                        }
                    }

                    // Gravar Nota e Banco no Frete (com resolucao inteligente de BOSS e JUPITER)
                    if (isFreight) {
                        const firstPayment = selectedPaymentsForLink.length > 0 ? selectedPaymentsForLink[0] : null;
                        let rawSelectedBank = firstPayment ? String(firstPayment.bank || '').toUpperCase() : '';
                        const selectBankVal = String(document.getElementById('select-freight-bank')?.value || '').toUpperCase();
                        
                        let bankVal = (rawSelectedBank || selectBankVal || '').trim();
                        
                        // Banco Inteligente: garantir variações BOSS e JUPITER apenas para BCI e BIM
                        if (bankVal && bankVal !== '—') {
                            if ((bankVal === 'BCI' || bankVal === 'BIM') && !bankVal.includes('BOSS') && !bankVal.includes('JUPITER')) {
                                const owner = firstPayment ? String(firstPayment.account_owner || firstPayment.accountOwner || '').toUpperCase() : '';
                                const ref = firstPayment ? String(firstPayment.reference || firstPayment.ref || '').toUpperCase() : '';
                                
                                // 1. Usar a variação do menu suspenso se o banco raiz corresponder
                                if (selectBankVal.startsWith(bankVal) && (selectBankVal.includes('BOSS') || selectBankVal.includes('JUPITER'))) {
                                    bankVal = selectBankVal;
                                }
                                // 2. Detetar BOSS ou JUPITER pelo titular da conta ou referência do movimento
                                else if (owner.includes('BOSS') || owner.includes('FILIPE') || ref.includes('BOSS') || ref.includes('FILIPE')) {
                                    bankVal = `${bankVal} BOSS`;
                                } else if (owner.includes('JUPITER') || ref.includes('JUPITER')) {
                                    bankVal = `${bankVal} JUPITER`;
                                }
                                // 3. Em último caso, no frete o padrão é JUPITER
                                else {
                                    bankVal = `${bankVal} JUPITER`;
                                }
                            }
                        }

                        let finalNote = 'PAID TO JUPITER';
                        if (window.freightExtrasContext && window.freightExtrasContext.totalExtras > 0) {
                            finalNote = window.freightExtrasContext.finalNote;
                        } else {
                            const totalFreightSheet = (window.currentClientRows || []).reduce((acc, r) => acc + (r.balFreight || r.amtFreight || 0), 0);
                            if (allocatedAmount > totalFreightSheet + 0.01) {
                                const extraDiff = allocatedAmount - totalFreightSheet;
                                finalNote = `PAID TO JUPITER (+${formatMZN(extraDiff)} Extras China)`;
                            }
                        }
                        
                        if (bankFreightIdx !== -1 && bankVal && bankVal !== '—') {
                            rowData[bankFreightIdx] = bankVal;
                            if (rowObj.originalRow) rowObj.originalRow[bankFreightIdx] = bankVal;
                            if (window.currentActiveClient && window.currentActiveClient.rows) {
                                const acr = window.currentActiveClient.rows.find(r => r.originalIndex === originalIndex);
                                if (acr && acr.originalRow) acr.originalRow[bankFreightIdx] = bankVal;
                            }
                        }
                        if (notaFreightIdx !== -1 && finalNote) {
                            rowData[notaFreightIdx] = finalNote;
                            if (rowObj.originalRow) rowObj.originalRow[notaFreightIdx] = finalNote;
                            if (window.currentActiveClient && window.currentActiveClient.rows) {
                                const acr = window.currentActiveClient.rows.find(r => r.originalIndex === originalIndex);
                                if (acr && acr.originalRow) acr.originalRow[notaFreightIdx] = finalNote;
                            }
                        }
                    }

                    // Acumular apenas as células modificadas para o Google Sheets
                    if (paidIdx !== -1) {
                        batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(paidIdx)}${sheetRowNumber}`), values: [[rowData[paidIdx]]] });
                    }
                    if (balanceIdx !== -1) {
                        batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(balanceIdx)}${sheetRowNumber}`), values: [[rowData[balanceIdx]]] });
                    }
                    if (!isFreight && bankDutyIdx !== -1) {
                        if (newStatus === 'PENDENTE') {
                            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(bankDutyIdx)}${sheetRowNumber}`), values: [['']] });
                        } else if (dutyBankVal) {
                            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(bankDutyIdx)}${sheetRowNumber}`), values: [[dutyBankVal]] });
                        }
                    }
                    if (statusIdx !== -1 && !isFreight) {
                        batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(statusIdx)}${sheetRowNumber}`), values: [[rowData[statusIdx]]] });
                    }
                    if (!isFreight && notaDutyIdx !== -1) {
                        batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(notaDutyIdx)}${sheetRowNumber}`), values: [['']] });
                    }
                    if (isFreight) {
                        if (bankFreightIdx !== -1) {
                            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(bankFreightIdx)}${sheetRowNumber}`), values: [[rowData[bankFreightIdx] || '']] });
                        }
                        if (notaFreightIdx !== -1) {
                            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(notaFreightIdx)}${sheetRowNumber}`), values: [[rowData[notaFreightIdx] || '']] });
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
                                range: formatSheetRange(sheetName, `${getColLetter(pIdx)}${sheetRowNumber}`),
                                values: [['']]
                            });
                        } else if (dateVal !== undefined) {
                            batchUpdates.push({
                                range: formatSheetRange(sheetName, `${getColLetter(pIdx)}${sheetRowNumber}`),
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

                // Atualizar lista de status do cliente ativo de forma síncrona
                if (window.currentActiveClient && window.currentActiveClient.rows) {
                    window.currentActiveClient.statuses = window.currentActiveClient.rows.map(r => {
                        const rData = state.confirm.data[r.originalIndex] || r.originalRow;
                        return statusIdx !== -1 ? String(rData[statusIdx] || 'PENDENTE').trim().toUpperCase() : 'PENDENTE';
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

                // 5. PocketBase - Reconciliação como Segurança da Informação (executada após sucesso na planilha Google Sheets)
                if (usedPayments.length > 0) {
                    try {
                        let finalCombinedInfo = combinedInfo;
                        if (isFreight) {
                            if (window.freightExtrasContext && window.freightExtrasContext.totalExtras > 0) {
                                finalCombinedInfo = `FRETE (+${formatMZN(window.freightExtrasContext.totalExtras)} EXTRAS) - ${clientNo} - ${projectName}`;
                            } else {
                                const totalFreightSheet = (window.currentClientRows || []).reduce((acc, r) => acc + (r.balFreight || r.amtFreight || 0), 0);
                                if (allocatedAmount > totalFreightSheet + 0.01) {
                                    const extraDiff = allocatedAmount - totalFreightSheet;
                                    finalCombinedInfo = `FRETE (+${formatMZN(extraDiff)} EXTRAS CHINA) - ${clientNo} - ${projectName}`;
                                }
                            }
                        }
                        for (const up of usedPayments) {
                            await markPaymentReconciled(up.id, finalCombinedInfo, up.amount);
                        }
                    } catch (pbErr) {
                        console.warn("[PocketBase] Falha ao registar conciliação no PocketBase (Google Sheets já foi atualizado com sucesso):", pbErr);
                    }
                }

                // 6. Auditoria: Registar vinculo / reconciliação de pagamento
                const clientNo = window.currentActiveClient?.no || (window.currentClientRows?.[0]?.no) || '';
                const clientName = window.currentActiveClient?.displayName || (window.currentClientRows?.[0]?.client) || '';
                const sheetId = state.confirm?.sheetId || '';
                try {
                    logConfirmAudit(sheetId, clientNo, clientName, 'PAGAMENTO_VINCULADO', {
                        tipo: isFreight ? 'Frete' : 'Duty',
                        allocatedAmount,
                        status: filterStatus,
                        payments: usedPayments.map(p => ({ id: p.id, date: p.date, ref: p.ref, amount: p.amount })),
                        comment: document.getElementById('mini-filter-comment')?.value || ''
                    }).catch(auditErr => console.warn('[Audit] Erro ao registar auditoria de pagamento:', auditErr));
                } catch (auditErr) {
                    console.warn('[Audit] Erro ao disparar auditoria de pagamento:', auditErr);
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
                    if (updatedRowData) {
                        rowObj.originalRow = updatedRowData;
                        const acr = window.currentActiveClient.rows.find(r => r.originalIndex === rowObj.originalIndex);
                        if (acr) acr.originalRow = updatedRowData;
                        updateConfirmDetailRow(rowObj.originalIndex, updatedRowData);
                    }
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
        window.paymentReconciliationContext = null;
        window.freightExtrasContext = null;
        window.storageReconciliationContext = null;
        window.feeReconciliationContext = null;
        setLoader(false);
        setBtnLoading(btn, false);
    }
}

export function closePaymentMiniFilter() {
    closeAllMiniFilterDropdowns();
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
        container.classList.remove('max-w-7xl');
        container.classList.add('max-w-5xl');
    }
    if (modal) modal.classList.add('hidden');
    
    // Limpar o contexto de vínculo para evitar conflitos com Duty
    window.paymentReconciliationContext = null;
    window.freightExtrasContext = null;
    window.storageReconciliationContext = null;
    window.feeReconciliationContext = null;
}

// --- MÓDULO DEFINIÇÕES (USERS) ---

export async function loadSettingsUsers() {
    const tbody = document.getElementById('settings-users-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500 font-normal">A carregar utilizadores...</td></tr>';
    
    try {
        const users = await getSettingsUsers();
        tbody.innerHTML = '';
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-400 font-normal">Nenhum utilizador encontrado.</td></tr>';
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
                <td class="px-6 py-4 font-normal text-gray-900">${user.name || '---'}</td>
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
        
        // Carregar configurações de impressora
        await loadSettingsPrinter();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500 font-normal">Erro: ${err.message}</td></tr>`;
    }
}

// --- CONFIGURAÇÕES DE IMPRESSORA DE REDE ---

export async function loadSettingsPrinter() {
    const urlInput = document.getElementById('settings-printer-url');
    const tokenInput = document.getElementById('settings-printer-token');
    const select = document.getElementById('settings-printer-select');

    if (!urlInput || !select) return;

    urlInput.value = printService.getServerUrl();
    if (tokenInput) tokenInput.value = printService.getApiToken();

    await refreshSettingsPrinters();
}

export function onSettingsPrinterChange(val) {
    if (!val) return;
    printService.setSelectedPrinter(val);
    toast(`🖨️ Impressora ativa selecionada: [${val}]`, 'info');
}

export async function refreshSettingsPrinters() {
    const badge = document.getElementById('settings-printer-status-badge');
    const text = document.getElementById('settings-printer-status-text');
    const select = document.getElementById('settings-printer-select');
    const urlInput = document.getElementById('settings-printer-url');
    const tokenInput = document.getElementById('settings-printer-token');

    if (!select) return;

    // Preservar a impressora que o utilizador selecionou no momento
    const currentlySelected = select.value && !select.value.includes('carregar') ? select.value : '';

    if (badge && text) {
        badge.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 self-start md:self-auto';
        text.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span><span>A verificar servidor...</span>';
    }

    select.innerHTML = '<option value="">A carregar impressoras...</option>';

    const serverUrl = (urlInput?.value || '').trim() || printService.getServerUrl();
    const token = (tokenInput?.value || '').trim();
    if (token) printService.setApiToken(token);

    const status = await printService.checkStatus(serverUrl);

    if (status.ok) {
        if (badge && text) {
            badge.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 self-start md:self-auto';
            text.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span><span>Online (${status.sistema || 'Rede'}) • ${status.total_impressoras || 0} Impressora(s)</span>`;
            badge.title = `Conectado a ${serverUrl} - Padrão SO: ${status.impressora_padrao || 'Nenhuma'}`;
        }

        const res = await printService.getPrinters(serverUrl);
        if (res.ok && res.impressoras && res.impressoras.length > 0) {
            select.innerHTML = '';
            
            // Prioridade de seleção da impressora:
            // 1. O que o utilizador acabou de selecionar
            // 2. O que está gravado no printService (se válido e diferente da offline "Armazem print")
            // 3. A configurada no backend
            // 4. "Armazem" (se existir)
            // 5. A padrão do SO (apenas se for diferente de "Armazem print")
            // 6. A primeira da lista
            const saved = currentlySelected || printService.getSelectedPrinter() || res.impressora_configurada;
            let defaultTarget = '';
            if (saved && res.impressoras.includes(saved) && saved !== 'Armazem print') {
                defaultTarget = saved;
            } else if (res.impressoras.includes('Hewlett-Packard HP LaserJet Pro MFP M125nw')) {
                defaultTarget = 'Hewlett-Packard HP LaserJet Pro MFP M125nw';
            } else if (res.impressoras.includes('Armazem')) {
                defaultTarget = 'Armazem';
            } else if (res.padrao && res.impressoras.includes(res.padrao) && res.padrao !== 'Armazem print') {
                defaultTarget = res.padrao;
            } else {
                defaultTarget = res.impressoras[0];
            }

            res.impressoras.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                let label = p;
                if (p === defaultTarget) label += ' ★ (Selecionada)';
                else if (p === res.padrao) label += ' (Padrão Windows)';
                opt.textContent = label;
                if (p === defaultTarget) opt.selected = true;
                select.appendChild(opt);
            });

            if (select.value) {
                printService.setSelectedPrinter(select.value);
            }
        } else {
            select.innerHTML = '<option value="">Nenhuma impressora disponível</option>';
        }
    } else {
        if (badge && text) {
            badge.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 self-start md:self-auto';
            text.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span><span>Offline (Servidor Inacessível)</span>`;
            badge.title = status.error || 'Verifique se o script servidor_de_impressao_drag_drop.py está a correr';
        }
        select.innerHTML = '<option value="">Servidor offline</option>';
    }
}

export async function testPrinterConnection() {
    const urlInput = document.getElementById('settings-printer-url');
    const serverUrl = (urlInput?.value || '').trim() || printService.getServerUrl();
    
    toast('A testar conexão ao servidor de impressão...', 'info');
    const status = await printService.checkStatus(serverUrl);
    
    if (status.ok) {
        toast(`✅ Conexão estabelecida com sucesso! Impressora padrão: ${status.impressora_padrao || 'Nenhuma'}`, 'success');
        await refreshSettingsPrinters();
    } else {
        toast(`❌ Falha na conexão: ${status.error || 'Servidor inacessível'}`, 'error');
    }
}

export async function printTestDoc() {
    const select = document.getElementById('settings-printer-select');
    const selectedPrinter = select ? select.value : '';
    
    try {
        toast('A enviar página de teste para a impressora...', 'info');
        const res = await printService.printTestPage(selectedPrinter);
        if (res && res.sucesso) {
            toast(`✅ Página de teste impressa com sucesso em: ${res.impressora || selectedPrinter}!`, 'success');
        } else {
            toast(`❌ Erro ao imprimir página de teste: ${res.erro || 'Falha desconhecida'}`, 'error');
        }
    } catch (e) {
        toast(`❌ Erro: ${e.message}`, 'error');
    }
}

export function savePrinterSettings() {
    const urlInput = document.getElementById('settings-printer-url');
    const tokenInput = document.getElementById('settings-printer-token');
    const select = document.getElementById('settings-printer-select');

    if (urlInput) printService.setServerUrl(urlInput.value);
    if (tokenInput) printService.setApiToken(tokenInput.value);
    if (select && select.value) printService.setSelectedPrinter(select.value);

    toast('✅ Definições do servidor de impressão gravadas com sucesso!', 'success');
    refreshSettingsPrinters();
}

/**
 * MODAL RÁPIDO DE IMPRESSÃO (Aba Armazenagem)
 * Permite a qualquer operador verificar e trocar a impressora ativa sem aceder a Definições
 */
export async function openQuickPrinterModal() {
    let modal = document.getElementById('modal-quick-printer');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-quick-printer';
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-all duration-200';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100 flex flex-col gap-5">
                <div class="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                            🖨️
                        </div>
                        <div>
                            <h3 class="font-black text-gray-900 text-base uppercase tracking-tight">Impressora do Armazém</h3>
                            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Configuração de Envio Silencioso</p>
                        </div>
                    </div>
                    <button type="button" onclick="ui.closeQuickPrinterModal()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-black flex items-center justify-center text-sm cursor-pointer">✕</button>
                </div>

                <div id="quick-printer-status" class="flex items-center gap-2 p-3 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>A verificar servidor de impressão...</span>
                </div>

                <div>
                    <label class="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Impressora Ativa para Guias</label>
                    <select id="quick-printer-select" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-bold text-sm bg-white outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all">
                        <option value="">A carregar impressoras...</option>
                    </select>
                    <p class="text-[10px] text-gray-400 mt-1 font-semibold">Os botões "⚡ Direto" e a Guia Dupla enviarão para esta impressora.</p>
                </div>

                <div>
                    <label class="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Servidor / IP</label>
                    <input type="text" id="quick-printer-url" class="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl font-bold text-xs bg-gray-50 outline-none focus:border-blue-600 transition-all" placeholder="http://192.168.88.10:5000">
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-gray-100 gap-2 flex-wrap">
                    <div class="flex gap-2">
                        <button type="button" onclick="ui.testQuickPrinterConnection()" class="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer">
                            Testar
                        </button>
                        <button type="button" onclick="ui.printQuickTestPage()" class="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-all cursor-pointer">
                            Página Teste
                        </button>
                    </div>
                    <button type="button" onclick="ui.saveQuickPrinterConfig()" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer">
                        Gravar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'flex';
    }

    const urlInput = document.getElementById('quick-printer-url');
    if (urlInput) urlInput.value = printService.getServerUrl();

    await refreshQuickPrinterModal();
}

export function closeQuickPrinterModal() {
    const modal = document.getElementById('modal-quick-printer');
    if (modal) modal.style.display = 'none';
}

export async function refreshQuickPrinterModal() {
    const statusBox = document.getElementById('quick-printer-status');
    const select = document.getElementById('quick-printer-select');
    const urlInput = document.getElementById('quick-printer-url');
    if (!statusBox || !select) return;

    const serverUrl = (urlInput?.value || '').trim() || printService.getServerUrl();
    const status = await printService.checkStatus(serverUrl);

    if (status.ok) {
        statusBox.className = 'flex items-center gap-2 p-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200';
        statusBox.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span><span>Online (${serverUrl.replace(/^https?:\/\//, '')}) • ${status.total_impressoras || 0} Impressora(s)</span>`;

        const res = await printService.getPrinters(serverUrl);
        if (res.ok && res.impressoras && res.impressoras.length > 0) {
            select.innerHTML = '';
            const currentSaved = printService.getSelectedPrinter() || res.impressora_configurada;
            let target = '';
            if (currentSaved && res.impressoras.includes(currentSaved) && currentSaved !== 'Armazem print') {
                target = currentSaved;
            } else if (res.impressoras.includes('Hewlett-Packard HP LaserJet Pro MFP M125nw')) {
                target = 'Hewlett-Packard HP LaserJet Pro MFP M125nw';
            } else if (res.impressoras.includes('Armazem')) {
                target = 'Armazem';
            } else if (res.padrao && res.padrao !== 'Armazem print') {
                target = res.padrao;
            } else {
                target = res.impressoras[0];
            }

            res.impressoras.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                let lbl = p;
                if (p === target) lbl += ' ★ (Selecionada)';
                else if (p === res.padrao) lbl += ' (Padrão Windows)';
                opt.textContent = lbl;
                if (p === target) opt.selected = true;
                select.appendChild(opt);
            });
        } else {
            select.innerHTML = '<option value="">Nenhuma impressora disponível</option>';
        }
    } else {
        statusBox.className = 'flex items-center gap-2 p-3 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200';
        statusBox.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span><span>Offline (${status.error || 'Servidor inacessível'})</span>`;
        select.innerHTML = '<option value="">Servidor offline</option>';
    }
}

export async function testQuickPrinterConnection() {
    const urlInput = document.getElementById('quick-printer-url');
    const sUrl = (urlInput?.value || '').trim() || printService.getServerUrl();
    toast('A testar conexão...', 'info');
    const st = await printService.checkStatus(sUrl);
    if (st.ok) {
        toast(`✅ Conexão bem-sucedida! Impressora padrão: ${st.impressora_padrao || 'Nenhuma'}`, 'success');
        await refreshQuickPrinterModal();
    } else {
        toast(`❌ Falha: ${st.error || 'Inacessível'}`, 'error');
    }
}

export async function printQuickTestPage() {
    const select = document.getElementById('quick-printer-select');
    const printer = select ? select.value : '';
    if (!printer) {
        toast('Selecione uma impressora primeiro.', 'warning');
        return;
    }
    try {
        toast(`⚡ A imprimir página de teste em [${printer}]...`, 'info');
        const res = await printService.printTestPage(printer);
        if (res && res.sucesso) {
            toast(`✅ Teste impresso em [${res.impressora || printer}]!`, 'success');
        } else {
            toast(`❌ Erro: ${res.erro || 'Falha'}`, 'error');
        }
    } catch (e) {
        toast(`❌ Erro: ${e.message}`, 'error');
    }
}

export function saveQuickPrinterConfig() {
    const select = document.getElementById('quick-printer-select');
    const urlInput = document.getElementById('quick-printer-url');
    if (urlInput && urlInput.value) printService.setServerUrl(urlInput.value);
    if (select && select.value) {
        printService.setSelectedPrinter(select.value);
        toast(`✅ Impressora ativa definida para: [${select.value}]`, 'success');
    }
    closeQuickPrinterModal();
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
    const txtDate = document.getElementById('txt-quote-exchange-date');
            const customList = document.getElementById('custom-quote-currency-options');
    const customLabel = document.getElementById('custom-quote-currency-label');
    
    if (!select || !inputEx) return;

    // Handler to upload an attachment for a quote item
    window.handleAttachmentUpload = async function(itemId, file) {
        if (!file) return;
        try {
            // Use existing API to upload to Google Drive (folderId can be null for root)
            const result = await api.uploadGDriveFile(file, null);
            // Assume result contains `fileId` and `url`
            const item = window.quoteEditorState.items.find(i => i.id === itemId);
            if (item) {
                item.attachment = result;
                // Refresh the row to show the attached file name (optional)
                window.updateRowDOM(item);
            }
        } catch (e) {
            console.error('Failed to upload attachment', e);
            if (window.toast) window.toast('Erro ao fazer upload do anexo', 'error');
        }
    };

    window.handleGlobalAttachmentUpload = function(file) {
        if (!file) return;
        
        // Guardar o ficheiro numa variável para enviar só quando gravar a simulação
        window.quoteEditorState.pendingAttachment = file;
        
        // Criar um URL temporário para o utilizador poder visualizar o ficheiro imediatamente
        window.quoteEditorState.attachment = {
            name: file.name,
            url: URL.createObjectURL(file)
        };
        
        if (window.toast) window.toast('Anexo em memória! Não se esqueça de Gravar a simulação.', 'success');
        if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
    };

    // Se existirem dados, populamos o dropdown
    if (state.cambios && state.cambios.length > 0) {
        select.innerHTML = '';
        if (customList) customList.innerHTML = '';
        
        state.cambios.forEach(c => {
            // Opção nativa oculta
            const opt = document.createElement('option');
            opt.value = c.moeda;
            opt.text = c.moeda;
            opt.dataset.taxa = c.taxa;
            if (c.today) {
                const d = new Date(c.today);
                opt.dataset.date = d.toLocaleDateString('pt-PT');
            } else {
                opt.dataset.date = '';
            }
            select.appendChild(opt);
            
            // Opção Customizada
            if (customList) {
                const divOpt = document.createElement('div');
                // Added data-moeda for easy filtering
                divOpt.dataset.moeda = c.moeda.toUpperCase();
                divOpt.className = 'currency-option-item px-3 py-1.5 mx-1 my-0.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer flex justify-between items-center transition-colors';
                divOpt.innerHTML = `<span>${c.moeda}</span> <span class="text-[10px] text-gray-400 font-medium">${parseFloat(c.taxa).toFixed(2)}</span>`;
                divOpt.onclick = () => {
                    select.value = c.moeda;
                    if (customLabel) customLabel.innerText = c.moeda;
                    window.closeCurrencyDropdown();
                    window.handleCurrencyChange();
                };
                customList.appendChild(divOpt);
            }
        });

        // Tentar manter o USD selecionado se existir, senão usa o primeiro
        const usdOpt = Array.from(select.options).find(o => o.value === 'USD');
        const defaultOpt = usdOpt || select.options[0];
        
        select.value = defaultOpt.value;
        if (customLabel) customLabel.innerText = defaultOpt.value;
        inputEx.value = parseFloat(defaultOpt.dataset.taxa).toFixed(2);
        if (txtDate && defaultOpt.dataset.date) {
            txtDate.innerText = defaultOpt.dataset.date;
        }
    }
}

window.toggleCurrencyDropdown = function(e) {
    if (e) e.stopPropagation();
    const list = document.getElementById('custom-quote-currency-list');
    const searchInput = document.getElementById('custom-quote-currency-search');
    if (list) {
        list.classList.toggle('hidden');
        if (!list.classList.contains('hidden') && searchInput) {
            searchInput.value = '';
            window.filterCurrencyDropdown();
            // Focus com pequeno delay para garantir que está visível
            setTimeout(() => searchInput.focus(), 50);
        }
    }
};

window.closeCurrencyDropdown = function() {
    const list = document.getElementById('custom-quote-currency-list');
    if (list && !list.classList.contains('hidden')) {
        list.classList.add('hidden');
    }
};

window.filterCurrencyDropdown = function() {
    const searchInput = document.getElementById('custom-quote-currency-search');
    if (!searchInput) return;
    const query = searchInput.value.toUpperCase().trim();
    const items = document.querySelectorAll('.currency-option-item');
    
    items.forEach(item => {
        const moeda = item.dataset.moeda || '';
        if (moeda.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
};

// Global click listener para fechar dropdown clicando fora
document.addEventListener('click', (e) => {
    const btn = document.getElementById('custom-quote-currency-btn');
    const list = document.getElementById('custom-quote-currency-list');
    if (btn && list) {
        if (!btn.contains(e.target) && !list.contains(e.target)) {
            window.closeCurrencyDropdown();
        }
    }
    
    // Antigo comportamento do pauta search
    if (!e.target.closest('#input-pauta-search') && !e.target.closest('#pauta-search-results')) {
        const res = document.getElementById('pauta-search-results');
        if (res) res.classList.add('hidden');
    }
});

window.handleCurrencyChange = function() {
    const select = document.getElementById('input-quote-currency');
    const inputEx = document.getElementById('input-quote-exchange');
    const txtDate = document.getElementById('txt-quote-exchange-date');
    if (!select || !inputEx) return;

    const opt = select.options[select.selectedIndex];
    if (opt && opt.dataset.taxa) {
        inputEx.value = parseFloat(opt.dataset.taxa).toFixed(2);
        if (txtDate) {
            txtDate.innerText = opt.dataset.date || '';
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
        
        let hsCodeText = 'Múltiplos';
        let fob = 0;
        let total = 0;
        
        if (payload.items && payload.items.length > 0) {
            const hsCodes = payload.items.map(i => i.hsCode).filter(Boolean);
            if (hsCodes.length > 0) {
                hsCodeText = hsCodes.slice(0, 2).join(', ');
                if (hsCodes.length > 2) hsCodeText += '...';
            } else {
                hsCodeText = 'S/ Pauta';
            }
            fob = payload.totals?.fobForeign || 0;
            total = payload.totals?.grandTotalMzn || 0;
        } else {
            hsCodeText = payload.itemCode || '---';
            fob = parseFloat(payload.fob) || 0;
            total = parseFloat(payload.results?.totalImport) || 0;
        }
        let cNameList = q.client_name;
        if (!cNameList || cNameList === 'undefined') {
            cNameList = payload.invoiceData?.clientName || payload.clientName || 'Cliente Não Definido';
        }
        
        const card = document.createElement('div');
        card.className = "bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group transition-all hover:shadow hover:border-gray-300 hover:bg-gray-50/50 cursor-pointer active:scale-[0.98] relative";
        card.onclick = () => window.loadSavedQuote(q.id);

        card.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden w-full">
                <div class="bg-gray-50 text-gray-400 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 group-hover:scale-105 group-hover:bg-gray-100 group-hover:text-gray-600 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </div>
                <div class="overflow-hidden pr-8 w-full">
                    <h3 class="text-[13px] font-bold text-gray-700 tracking-tight leading-none truncate group-hover:text-black transition-colors" title="${cNameList}">${cNameList}</h3>
                    <p class="text-[9px] text-gray-400 font-bold uppercase mt-1.5 leading-none tracking-wider">${q.quote_number || 'S/N'}</p>
                </div>
            </div>
            
            <button onclick="event.stopPropagation(); window.handleDeleteQuote('${q.id}')" class="absolute top-1/2 -translate-y-1/2 right-3 w-8 h-8 bg-white text-slate-300 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-slate-100 opacity-0 group-hover:opacity-100 active:scale-90 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
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
            if (typeof searchPauta === 'function') {
                searchPauta(val, 20).then(results => {
                    renderPautaSearchResults(results);
                }).catch(err => console.error(err));
            }
        }, 300);
    }
    
    if (e.target && e.target.id === 'input-quote-history-search') {
        renderQuoteDashboard();
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
                    <td class="px-4 py-2 text-xs font-normal text-gray-700">${name}</td>
                    <td class="px-4 py-2 text-center">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-normal bg-indigo-50 text-indigo-700 border border-indigo-100">${val}</span>
                    </td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="2" class="px-4 py-4 text-center text-xs font-normal text-gray-400 italic">Nenhuma taxa definida.</td></tr>`;
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
        mcnetMzn: 0,
        tsaFixedMzn: 0,
        grandTotalMzn: 0
    }
};

window.openQuoteEditor = function() {
    document.getElementById('quote-history-workspace').classList.add('hidden');
    document.getElementById('quote-editor-workspace').classList.remove('hidden');
    document.getElementById('quote-editor-workspace').classList.add('flex');
    window.renderQuoteItemsTable();
    window.calculateFullInvoice();
    
    // Assegura que o UI do cliente é atualizado com os dados carregados na quote
    if (window.syncClientUIDisplay) {
        window.syncClientUIDisplay();
    }

    // Inicializa abrindo a aba Draft por defeito
    window.switchQuoteTab('draft');

    if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
};

window.closeQuoteEditor = function() {
    document.getElementById('quote-editor-workspace').classList.add('hidden');
    document.getElementById('quote-editor-workspace').classList.remove('flex');
    document.getElementById('quote-history-workspace').classList.remove('hidden');
};

window.openAllInvoiceTabsForPrint = function() {
    const details = document.querySelectorAll('#tab-content-invoice details');
    const openedDetails = [];
    
    details.forEach(d => {
        if (d.hasAttribute('open')) {
            openedDetails.push(d);
        } else {
            d.setAttribute('open', '');
        }
        // Remover name para permitir múltiplas abas abertas simultaneamente
        if (d.hasAttribute('name')) {
            d.dataset.name = d.getAttribute('name');
            d.removeAttribute('name');
        }
    });

    const restore = function() {
        details.forEach(d => {
            if (!openedDetails.includes(d)) {
                d.removeAttribute('open');
            }
            if (d.dataset.name) {
                d.setAttribute('name', d.dataset.name);
            }
        });
        window.removeEventListener('afterprint', restore);
    };
    
    window.addEventListener('afterprint', restore);
};

window.previewQuotePDF = function() {
    window.openAllInvoiceTabsForPrint();
    setTimeout(() => {
        window.print();
    }, 100);
};

window.downloadQuotePDF = function() {
    try {
        if (typeof window.html2pdf === 'undefined') {
            alert('A biblioteca html2pdf não foi carregada. Por favor faça Ctrl+F5 (ou Cmd+Shift+R). Vai abrir a janela de impressão clássica como alternativa.');
            window.previewQuotePDF();
            return;
        }

        const element = document.querySelector('#tab-content-invoice > div');
        if (!element) {
            alert('Não foi possível encontrar a fatura no ecrã.');
            return;
        }

        const quoteNumberInput = document.getElementById('inv-doc-number');
        let quoteNumber = quoteNumberInput ? quoteNumberInput.value.trim() : '';
        if (!quoteNumber || quoteNumber.toUpperCase() === 'AUTO') {
            quoteNumber = 'Rascunho';
        }
        
        const docTypeInput = document.getElementById('inv-doc-type');
        const docType = docTypeInput ? docTypeInput.value.trim() : 'Cotacao';

        const filename = `${docType}_${quoteNumber}.pdf`.replace(/\s+/g, '_');

        const originalClasses = element.className;
        element.classList.remove('overflow-hidden');
        element.classList.add('print:m-0', 'print:p-0', 'print:shadow-none', 'print:border-none');

        if (window.setLoader) window.setLoader(true, 'A gerar PDF da Cotação...');

        const opt = {
            margin:       [10, 0, 10, 0],
            filename:     filename,
            image:        { type: 'jpeg', quality: 1.0 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true,
                scrollY: 0
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Open tabs for html2pdf rendering as well
        window.openAllInvoiceTabsForPrint();

        html2pdf().set(opt).from(element).save().then(() => {
            if (window.setLoader) window.setLoader(false);
            element.className = originalClasses;
            if (window.toast) window.toast('PDF transferido com sucesso!', 'success');
            // manually trigger afterprint to restore tabs since html2pdf doesn't fire it
            window.dispatchEvent(new Event('afterprint'));
        }).catch(err => {
            console.error('Erro ao gerar PDF:', err);
            if (window.setLoader) window.setLoader(false);
            element.className = originalClasses;
            window.dispatchEvent(new Event('afterprint'));
            
            // FALLBACK TO NATIVE PRINT
            alert('Falha na geração direta do ficheiro (erro de rendering). A redirecionar para a Janela de Impressão (Preview Clássico). Pode selecionar "Guardar como PDF" a partir de lá.');
            window.previewQuotePDF();
        });
    } catch (e) {
        console.error('Crash na geração do PDF:', e);
        if (window.setLoader) window.setLoader(false);
        // FALLBACK TO NATIVE PRINT
        window.previewQuotePDF();
    }
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

window.handleQuoteModeChange = function() {
    const mode = document.getElementById('input-quote-mode').value;
    window.quoteEditorState.mode = mode;
    window.quoteIsDirty = true;
    
    const subModeSelect = document.getElementById('input-quote-submode');
    const subModeContainer = document.getElementById('container-quote-submode');
    if (mode === 'Maritimo' || mode === 'Rodoviario') {
        if (subModeContainer) subModeContainer.classList.remove('hidden');
        else subModeSelect.classList.remove('hidden');
    } else {
        if (subModeContainer) subModeContainer.classList.add('hidden');
        else subModeSelect.classList.add('hidden');
        subModeSelect.value = '';
        window.quoteEditorState.subMode = '';
    }
    if (mode === 'Aereo') {
        const freightInput = document.getElementById('input-global-freight');
        const insuranceInput = document.getElementById('input-global-insurance');
        if (freightInput) freightInput.value = '';
        if (insuranceInput) insuranceInput.value = '';
    }
    
    if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
    window.syncInvoiceLinesFromDraft();
    if (typeof window.calculateFullInvoice === 'function') window.calculateFullInvoice();
    if (typeof window.renderInvoiceLines === 'function') window.renderInvoiceLines();
};

window.handleQuoteSubModeChange = function() {
    const subMode = document.getElementById('input-quote-submode').value;
    window.quoteEditorState.subMode = subMode;
    
    const cbmContainer = document.getElementById('container-quote-cbm');
    if (subMode === 'LCL' || subMode === 'CBM') {
        if (cbmContainer) cbmContainer.classList.remove('hidden');
        if (cbmContainer) cbmContainer.classList.add('flex');
    } else {
        if (cbmContainer) cbmContainer.classList.add('hidden');
        if (cbmContainer) cbmContainer.classList.remove('flex');
    }
    
    const carClassContainer = document.getElementById('container-quote-carclass');
    if (subMode === 'CAR') {
        if (carClassContainer) carClassContainer.classList.remove('hidden');
        if (carClassContainer) carClassContainer.classList.add('flex');
    } else {
        if (carClassContainer) carClassContainer.classList.add('hidden');
        if (carClassContainer) carClassContainer.classList.remove('flex');
    }
    
    window.quoteIsDirty = true;
    if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
    window.syncInvoiceLinesFromDraft();
    if (typeof window.calculateFullInvoice === 'function') window.calculateFullInvoice();
    if (typeof window.renderInvoiceLines === 'function') window.renderInvoiceLines();
};

window.handleQuoteCbmChange = function() {
    let rawValue = document.getElementById('input-quote-cbm').value || '';
    
    const cbmInput = document.getElementById('input-quote-cbm');
    if (rawValue.trim() !== '') {
        cbmInput.classList.remove('border-gray-200');
        cbmInput.classList.add('border-transparent');
    } else {
        cbmInput.classList.remove('border-transparent');
        cbmInput.classList.add('border-gray-200');
    }
    
    rawValue = rawValue.replace(',', '.');
    const cbmVal = parseFloat(rawValue) || 0;
    
    if (!window.quoteEditorState.globais) window.quoteEditorState.globais = {};
    window.quoteEditorState.globais.cbm = cbmVal;
    
    window.quoteIsDirty = true;
    if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
    window.syncInvoiceLinesFromDraft();
    if (typeof window.calculateFullInvoice === 'function') window.calculateFullInvoice();
    if (typeof window.renderInvoiceLines === 'function') window.renderInvoiceLines();
};

window.handleQuoteCarClassChange = function() {
    const classVal = document.getElementById('input-quote-carclass').value;
    
    if (!window.quoteEditorState.globais) window.quoteEditorState.globais = {};
    window.quoteEditorState.globais.carClass = classVal;
    
    window.quoteIsDirty = true;
    if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
    window.syncInvoiceLinesFromDraft();
    if (typeof window.calculateFullInvoice === 'function') window.calculateFullInvoice();
    if (typeof window.renderInvoiceLines === 'function') window.renderInvoiceLines();
};

window.startNewQuote = function() {
    window.quoteIsDirty = true;
    window.quoteEditorState = {
        id: null,
        currency: 'USD',
        exchangeRate: 64.00,
        mode: '',
        subMode: '',
        globais: { freight: '', insurance: '', others: '', cbm: '' },
        items: [],
        totals: { fobForeign: 0, freightForeign: 0, insForeign: 0, cifMzn: 0, daMzn: 0, iceMzn: 0, ivaMzn: 0, tsaMzn: 0, mcnetMzn: 0, tsaFixedMzn: 0, grandTotalMzn: 0 }
    };
    
    document.getElementById('input-quote-currency').value = 'USD';
    document.getElementById('input-quote-exchange').value = '64.00';
    document.getElementById('input-quote-mode').value = '';
    document.getElementById('input-quote-submode').value = '';
    const subModeCont = document.getElementById('container-quote-submode');
    if (subModeCont) subModeCont.classList.add('hidden');
    else document.getElementById('input-quote-submode').classList.add('hidden');
    
    const cbmCont = document.getElementById('container-quote-cbm');
    if (cbmCont) {
        cbmCont.classList.add('hidden');
        cbmCont.classList.remove('flex');
    }
    const cbmInput = document.getElementById('input-quote-cbm');
    if (cbmInput) {
        cbmInput.value = '';
        cbmInput.classList.remove('border-transparent');
        cbmInput.classList.add('border-gray-200');
    }
    
    const carClassCont = document.getElementById('container-quote-carclass');
    if (carClassCont) {
        carClassCont.classList.add('hidden');
        carClassCont.classList.remove('flex');
    }
    const carClassInput = document.getElementById('input-quote-carclass');
    if (carClassInput) carClassInput.value = 'Ligeiro';
    
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
        qtyFisica: '',
        iceAlcoholPercent: '',
        iceSugarGrams: '',
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
    
    // Convert commas to dots for numeric fields
    if (field === 'freight' || field === 'insurance' || field === 'others' || field === 'qty' || field === 'unitPrice' || field === 'qtyFisica' || field === 'iceAlcoholPercent' || field === 'iceSugarGrams') {
        if (typeof value === 'string') {
            value = value.replace(',', '.');
        }
    }
    
    if (field === 'freight' || field === 'insurance' || field === 'others') {
        item[field] = value === '' ? null : parseFloat(value);
    } else if (field === 'qty' || field === 'unitPrice') {
        // Clean the input (remove non‑numeric chars, convert comma to dot) and parse as float
        const cleaned = typeof value === 'string' ? value.replace(/[^0-9.,]/g, '').replace(',', '.') : value;
        const numericValue = cleaned !== '' ? parseFloat(cleaned) : 0;
        item[field] = numericValue;
        if (field === 'qty') {
            // Auto-sync qty to qtyFisica se a unidade física for Peças/Unidades (PST)
            const iceData = item.pauta ? getComplexRateFromPauta(item.pauta, ['consumo', 'ice']) : null;
            if (iceData && iceData.specificUnit && iceData.specificUnit.includes('PST')) {
                item.qtyFisica = item.qty;
            }
        }
        // Recalculate fob instantly for this row
        const qtyVal = parseFloat(item.qty) || 0;
        const priceVal = parseFloat(item.unitPrice) || 0;
        item.fob = qtyVal * priceVal;
    } else if (field === 'qtyFisica' || field === 'iceAlcoholPercent' || field === 'iceSugarGrams') {
        item[field] = value;
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
                    setTimeout(() => {
                        window.calculateFullInvoice();
                    }, 0);
                }).catch(() => {
                    item.pauta = null;
                    window.calculateFullInvoice();
                });
            }
            return; // We exit because calculation happens async

        } else {
            item.pauta = null;
        }
    }
    
    // Schedule recalculation and UI refresh on next animation frame
    requestAnimationFrame(() => {
        window.calculateFullInvoice();
    });
    return; // stop further execution
};

window.getQtyFisicaModeAndHTML = function(item) {
    const hsPrefix = (item.hsCode || '').substring(0, 4);
    const isAlcohol = ['2203', '2204', '2205', '2206', '2208'].includes(hsPrefix);
    const isSugar = hsPrefix === '2202';
    const iceData = item.pauta ? getComplexRateFromPauta(item.pauta, ['consumo', 'ice']) : null;
    
    if (isAlcohol) {
        return {
            mode: 'alcohol',
            html: `
                <div class="flex flex-row gap-0.5 w-full">
                    <div class="flex items-center bg-yellow-50/30 hover:bg-yellow-50 w-1/2 rounded overflow-hidden">
                        <input type="text" class="input-qty-fisica w-full text-[9px] text-right py-0 px-0.5 border-none bg-transparent text-yellow-800 font-normal outline-none focus:ring-0 h-5 placeholder-yellow-400" value="${item.qtyFisica || ''}" oninput="this.value = this.value.replace(/[^0-9.,]/g, ''); window.updateQuoteRow(${item.id}, 'qtyFisica', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="Litros" title="Quantidade em Litros">
                        <span class="text-[8px] text-yellow-600 pr-1 font-semibold select-none">L</span>
                    </div>
                    <div class="flex items-center bg-purple-50/30 hover:bg-purple-50 w-1/2 rounded overflow-hidden">
                        <input type="text" class="input-ice-extra w-full text-[9px] text-right py-0 px-0.5 border-none bg-transparent text-purple-800 font-normal outline-none focus:ring-0 h-5 placeholder-purple-400" value="${item.iceAlcoholPercent || ''}" oninput="this.value = this.value.replace(/[^0-9.,]/g, ''); window.updateQuoteRow(${item.id}, 'iceAlcoholPercent', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="Alc" title="Teor Alcoólico (%)">
                        <span class="text-[8px] text-purple-600 pr-1 font-semibold select-none">%</span>
                    </div>
                </div>
            `
        };
    } else if (isSugar) {
        return {
            mode: 'sugar',
            html: `
                <div class="flex flex-row gap-0.5 w-full">
                    <div class="flex items-center bg-yellow-50/30 hover:bg-yellow-50 w-1/2 rounded overflow-hidden">
                        <input type="text" class="input-qty-fisica w-full text-[9px] text-right py-0 px-0.5 border-none bg-transparent text-yellow-800 font-normal outline-none focus:ring-0 h-5 placeholder-yellow-400" value="${item.qtyFisica || ''}" oninput="this.value = this.value.replace(/[^0-9.,]/g, ''); window.updateQuoteRow(${item.id}, 'qtyFisica', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="Litros" title="Quantidade em Litros">
                        <span class="text-[8px] text-yellow-600 pr-1 font-semibold select-none">L</span>
                    </div>
                    <div class="flex items-center bg-pink-50/30 hover:bg-pink-50 w-1/2 rounded overflow-hidden">
                        <input type="text" class="input-ice-extra w-full text-[9px] text-right py-0 px-0.5 border-none bg-transparent text-pink-800 font-normal outline-none focus:ring-0 h-5 placeholder-pink-400" value="${item.iceSugarGrams || ''}" oninput="this.value = this.value.replace(/[^0-9.,]/g, ''); window.updateQuoteRow(${item.id}, 'iceSugarGrams', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="Teor" title="Teor de Açúcar (gramas por 100ml)">
                        <span class="text-[7px] text-pink-600 pr-0.5 font-semibold select-none leading-none">g/100m</span>
                    </div>
                </div>
            `
        };
    } else if (iceData && iceData.specificUnit) {
        return {
            mode: 'specific',
            html: `
                <div class="flex items-center bg-yellow-50/30 hover:bg-yellow-50 w-full rounded overflow-hidden">
                    <input type="text" class="input-qty-fisica w-full text-[10px] text-right py-0 px-1 border-none bg-transparent text-yellow-800 font-normal outline-none focus:ring-0 h-6 placeholder-yellow-400" value="${item.qtyFisica || ''}" oninput="this.value = this.value.replace(/[^0-9.,]/g, ''); window.updateQuoteRow(${item.id}, 'qtyFisica', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="Qtd" title="Quantidade (${iceData.specificUnit})">
                    <span class="text-[8px] text-yellow-600 pr-1 font-semibold select-none">${iceData.specificUnit}</span>
                </div>
            `
        };
    } else {
        return {
            mode: 'disabled',
            html: `<input type="text" class="input-qty-fisica w-full text-xs text-center py-0.5 px-1 border-none bg-gray-50/50 text-gray-300 h-6 cursor-not-allowed" disabled value="N/A" title="Não aplicável">`
        };
    }
};

window.updateRowDOM = function(item) {
    const tr = document.getElementById(`row-${item.id}`);
    if (!tr) return;
    
    const daRate = item.daRate !== undefined ? item.daRate : (item.pauta ? getRateFromPauta(item.pauta, ['Direitos', 'Aduaneiros']) : 0);
    const tsaRate = item.tsaRate !== undefined ? item.tsaRate : (item.pauta ? getRateFromPauta(item.pauta, ['Sobretaxa']) : 0);
    const ivaRate = item.ivaRate !== undefined ? item.ivaRate : (item.pauta ? getRateFromPauta(item.pauta, ['IVA', 'Valor Acrescentado']) : 0);
    
    tr.querySelector('.cell-fob').innerText = formatCurrencyVal(item.fob);
    tr.querySelector('.cell-cif').innerText = formatCurrencyVal(item.cifMzn);
    tr.querySelector('.cell-da').innerHTML = `${formatCurrencyVal(item.daValue)} <span class="text-[9px] text-gray-400">(${parseFloat((daRate*100).toFixed(2))}%)</span>`;
    if (tr.querySelector('.cell-tsa')) {
        tr.querySelector('.cell-tsa').innerHTML = `${formatCurrencyVal(item.tsaValue || 0)} <span class="text-[9px] text-gray-400">(${parseFloat((tsaRate*100).toFixed(2))}%)</span>`;
    }
    if (tr.querySelector('.cell-ice')) {
        tr.querySelector('.cell-ice').innerHTML = `${formatCurrencyVal(item.iceValue || 0)} <span class="text-[9px] text-gray-400">(${item.iceLabel || '0%'})</span>`;
    }
    tr.querySelector('.cell-iva').innerHTML = `${formatCurrencyVal(item.ivaValue)} <span class="text-[9px] text-gray-400">(${parseFloat((ivaRate*100).toFixed(2))}%)</span>`;

    const inFrt = tr.querySelector('.input-readonly-freight');
    if (inFrt) inFrt.value = formatCurrencyVal(item.actualFreight || 0);
    const inIns = tr.querySelector('.input-readonly-insurance');
    if (inIns) inIns.value = formatCurrencyVal(item.actualInsurance || 0);
    const inOth = tr.querySelector('.input-readonly-others');
    if (inOth) inOth.value = formatCurrencyVal(item.actualOthers || 0);

    const qtyObj = window.getQtyFisicaModeAndHTML(item);
    const qtyCell = tr.querySelector('.cell-qty-fis');
    if (qtyCell) {
        const currentMode = qtyCell.getAttribute('data-current-mode');
        if (currentMode !== qtyObj.mode) {
            qtyCell.innerHTML = qtyObj.html;
            qtyCell.setAttribute('data-current-mode', qtyObj.mode);
        }
    }

    const inQty = tr.querySelector('.input-qty');
    if (inQty && document.activeElement !== inQty) inQty.value = item.qty;
    
    const inQtyFis = tr.querySelector('.input-qty-fisica');
    if (inQtyFis && !inQtyFis.disabled && document.activeElement !== inQtyFis) inQtyFis.value = item.qtyFisica;
    
    const inIceExtra = tr.querySelector('.input-ice-extra');
    if (inIceExtra && document.activeElement !== inIceExtra) {
        if (qtyObj.mode === 'alcohol') inIceExtra.value = item.iceAlcoholPercent;
        else if (qtyObj.mode === 'sugar') inIceExtra.value = item.iceSugarGrams;
    }
    
    const inUnitPrice = tr.querySelector('.input-unit-price');
    if (inUnitPrice && document.activeElement !== inUnitPrice) inUnitPrice.value = item.unitPrice;

    const hsInput = tr.querySelector('.input-hscode');
    if (hsInput) {
        hsInput.classList.remove('text-indigo-700', 'text-emerald-600', 'text-red-500', 'font-bold', 'cursor-pointer');
        const hasValidPauta = !!(item.pauta && item.hsCode && item.hsCode.length === 8);
        if (item.hsCode && item.hsCode.length === 8) {
            if (item.pauta) {
                hsInput.classList.add('text-emerald-600', 'font-bold', 'cursor-pointer');
                hsInput.setAttribute('title', 'Código válido na Pauta. Clique no ícone para ver estrutura e localização.');
            } else {
                hsInput.classList.add('text-red-500');
                hsInput.removeAttribute('title');
            }
        } else {
            hsInput.classList.add('text-indigo-700');
            hsInput.removeAttribute('title');
        }

        const cellContainer = hsInput.parentElement;
        if (cellContainer) {
            let inspectBtn = cellContainer.querySelector('.btn-pauta-inspect');
            if (hasValidPauta) {
                if (!inspectBtn) {
                    inspectBtn = document.createElement('button');
                    inspectBtn.type = 'button';
                    inspectBtn.className = 'btn-pauta-inspect text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/80 p-0.5 rounded transition-all shrink-0 cursor-pointer shadow-2xs';
                    inspectBtn.title = 'Ver artigo, estrutura e posição na Pauta Aduaneira';
                    inspectBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>';
                    cellContainer.appendChild(inspectBtn);
                }
                inspectBtn.onclick = () => window.openPautaInspector(item.hsCode, item.id);
            } else if (inspectBtn) {
                inspectBtn.remove();
            }
        }
    }
};

function formatCurrencyVal(val) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

window.calculateFullInvoice = function() {
    window.quoteIsDirty = true;
    if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
    
    const curr = document.getElementById('input-quote-currency').value.toUpperCase() || 'USD';
    const excRate = parseFloat(document.getElementById('input-quote-exchange').value) || 64.00;
    
    window.quoteEditorState.currency = curr;
    window.quoteEditorState.exchangeRate = excRate;

    document.querySelectorAll('.lbl-currency').forEach(el => el.innerText = curr);
    const printCaption = document.getElementById('print-currency-note');
    if (printCaption) printCaption.innerText = `${curr} | ${excRate.toFixed(2)}`;

    const rawCbm = document.getElementById('input-quote-cbm')?.value || '';
    const cbmVal = parseFloat(rawCbm.replace(',', '.')) || 0;
    const carClassVal = document.getElementById('input-quote-carclass')?.value || 'Ligeiro';

    let usdExRate = 1;
    if (window.quoteEditorState.currency === 'USD') {
        usdExRate = parseFloat(window.quoteEditorState.exchangeRate) || 1;
    } else if (typeof state !== 'undefined' && state.cambios) {
        const usdCambio = state.cambios.find(c => c.moeda && c.moeda.toUpperCase() === 'USD');
        if (usdCambio) usdExRate = parseFloat(usdCambio.taxa) || 1;
    }

    const globais = {
        freight: document.getElementById('input-global-freight').value,
        insurance: document.getElementById('input-global-insurance').value,
        others: document.getElementById('input-global-others').value,
        cbm: cbmVal,
        carClass: carClassVal,
        usdExRate: usdExRate
    };
    window.quoteEditorState.globais = globais;

    const result = calculateInvoice(window.quoteEditorState, globais);

    window.quoteEditorState.items = result.items;
    window.quoteEditorState.totals = result.totals;

    window.quoteEditorState.items.forEach(item => {
        window.updateRowDOM(item);
    });

    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };
    
    const { totals } = result;

    setTxt('tot-fob-foreign', formatCurrencyVal(totals.fobForeign));
    setTxt('tot-freight-foreign', formatCurrencyVal(totals.freightForeign));
    setTxt('tot-ins-foreign', formatCurrencyVal(totals.insForeign));
    setTxt('tot-oth-foreign', formatCurrencyVal(totals.othForeign));
    setTxt('tot-cif-foreign', formatCurrencyVal(totals.fobForeign + totals.freightForeign + totals.insForeign + totals.othForeign));
    
    setTxt('tot-cif-mzn', formatMZN(totals.cifMzn));
    setTxt('tot-da-mzn', formatMZN(totals.daMzn));
    setTxt('tot-ice-mzn', formatMZN(totals.iceMzn));
    setTxt('tot-iva-mzn', formatMZN(totals.ivaMzn));
    setTxt('tot-tsa-mzn', formatMZN(totals.tsaMzn));
    
    setTxt('tot-grand-mzn', formatMZN(totals.grandTotalMzn));
    
    // Table Footer Totals
    setTxt('foot-tot-fob', formatCurrencyVal(totals.fobForeign));
    const gFrtInput = document.getElementById('input-global-freight');
    if (gFrtInput) gFrtInput.placeholder = formatCurrencyVal(totals.freightForeign);
    const gInsInput = document.getElementById('input-global-insurance');
    if (gInsInput) gInsInput.placeholder = formatCurrencyVal(totals.insForeign);
    const gOthInput = document.getElementById('input-global-others');
    if (gOthInput) gOthInput.placeholder = formatCurrencyVal(totals.othForeign);
    
    setTxt('foot-tot-cif', formatCurrencyVal(totals.cifMzn));
    setTxt('foot-tot-da', formatCurrencyVal(totals.daMzn));
    setTxt('foot-tot-tsa', formatCurrencyVal(totals.tsaMzn));
    setTxt('foot-tot-ice', formatCurrencyVal(totals.iceMzn));
    setTxt('foot-tot-iva', formatCurrencyVal(totals.ivaMzn));
    
    const tTotalTaxas = totals.daMzn + totals.tsaMzn + totals.iceMzn + totals.ivaMzn + totals.mcnetMzn + totals.tsaFixedMzn;
    setTxt('global-tot-imposicoes', formatCurrencyVal(tTotalTaxas) + ' MT');

    window.toggleDynamicColumnsVisibility();
    window.syncInvoiceLinesFromDraft();
};

window.toggleDynamicColumnsVisibility = function() {
    let hasAnyIce = false;
    let hasSpecificIce = false;
    let hasAnyTsa = false;
    window.quoteEditorState.items.forEach(item => {
        let iceData = item.pauta ? getComplexRateFromPauta(item.pauta, ['consumo', 'ice']) : null;
        let tsaRate = item.pauta ? getRateFromPauta(item.pauta, ['Sobretaxa']) : 0;
        const hsPrefix = (item.hsCode || '').substring(0, 4);
        const isAlcohol = ['2203', '2204', '2205', '2206', '2208'].includes(hsPrefix);
        const isSugar = hsPrefix === '2202';
        
        if (tsaRate > 0) hasAnyTsa = true;
        
        if (iceData || isAlcohol || isSugar) {
            hasAnyIce = true;
            if ((iceData && iceData.specificUnit) || isAlcohol || isSugar) {
                hasSpecificIce = true;
            }
        }
    });

    const thQtyFis = document.getElementById('th-qty-fis');
    if (thQtyFis) thQtyFis.classList.toggle('hidden', !hasSpecificIce);
    const thIce = document.getElementById('th-ice');
    if (thIce) thIce.classList.toggle('hidden', !hasAnyIce);
    const thTsa = document.getElementById('th-tsa');
    if (thTsa) thTsa.classList.toggle('hidden', !hasAnyTsa);
    const tfootTotIce = document.getElementById('foot-tot-ice');
    if (tfootTotIce) tfootTotIce.classList.toggle('hidden', !hasAnyIce);
    const tfootTotTsa = document.getElementById('foot-tot-tsa');
    if (tfootTotTsa) tfootTotTsa.classList.toggle('hidden', !hasAnyTsa);
    const tfootTotalsLabel = document.getElementById('tfoot-totals-label');
    if (tfootTotalsLabel) tfootTotalsLabel.colSpan = hasSpecificIce ? 6 : 5;

    const tbody = document.getElementById('quote-items-tbody');
    if (tbody) {
        Array.from(tbody.children).forEach(tr => {
            const qtyFisTd = tr.querySelector('.cell-qty-fis');
            if (qtyFisTd) qtyFisTd.classList.toggle('hidden', !hasSpecificIce);
            
            const iceTd = tr.querySelector('.cell-ice');
            if (iceTd) iceTd.classList.toggle('hidden', !hasAnyIce);
            
            const tsaTd = tr.querySelector('.cell-tsa');
            if (tsaTd) tsaTd.classList.toggle('hidden', !hasAnyTsa);
        });
    }
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
        tbody.innerHTML = `<tr><td colspan="16" class="p-4 text-center text-gray-400 font-normal">Nenhum artigo adicionado.</td></tr>`;
        if (tfoot) tfoot.classList.add('hidden');
        return;
    }
    
    if (tfoot) tfoot.classList.remove('hidden');
    
    let hasAnyIce = false;
    let hasSpecificIce = false;
    let hasAnyTsa = false;
    window.quoteEditorState.items.forEach(item => {
        const iceData = item.pauta ? getComplexRateFromPauta(item.pauta, ['consumo', 'ice']) : null;
        if (iceData) {
            hasAnyIce = true;
            if (iceData.specificUnit) hasSpecificIce = true;
        }
        const tsaRate = item.pauta ? getRateFromPauta(item.pauta, ['Sobretaxa']) : 0;
        if (tsaRate > 0) hasAnyTsa = true;
    });

    const thQtyFis = document.getElementById('th-qty-fis');
    const thIce = document.getElementById('th-ice');
    const thTsa = document.getElementById('th-tsa');
    
    const thFreight = document.getElementById('th-quote-freight');
    const thInsurance = document.getElementById('th-quote-insurance');
    const tfootTdFreight = document.getElementById('tfoot-td-freight');
    const tfootTdInsurance = document.getElementById('tfoot-td-insurance');

    const tfootTotalsLabel = document.getElementById('tfoot-totals-label');
    const tfootTotIce = document.getElementById('foot-tot-ice');
    const tfootTotTsa = document.getElementById('foot-tot-tsa');
    
    const isAereo = window.quoteEditorState.mode === 'Aereo';

    if (thQtyFis) thQtyFis.classList.toggle('hidden', !hasSpecificIce);
    if (thIce) thIce.classList.toggle('hidden', !hasAnyIce);
    if (thTsa) thTsa.classList.toggle('hidden', !hasAnyTsa);
    if (tfootTotIce) tfootTotIce.classList.toggle('hidden', !hasAnyIce);
    if (tfootTotTsa) tfootTotTsa.classList.toggle('hidden', !hasAnyTsa);
    
    if (thFreight) thFreight.classList.toggle('hidden', isAereo);
    if (thInsurance) thInsurance.classList.toggle('hidden', isAereo);
    if (tfootTdFreight) tfootTdFreight.classList.toggle('hidden', isAereo);
    if (tfootTdInsurance) tfootTdInsurance.classList.toggle('hidden', isAereo);
    
    // adjust colspan for totals label
    let baseColSpan = 5;
    if (hasSpecificIce) baseColSpan++;
    if (isAereo) baseColSpan -= 2; // removed frete and seguro columns from the left side
    
    if (tfootTotalsLabel) tfootTotalsLabel.colSpan = Math.max(1, baseColSpan);
    
    tbody.innerHTML = window.quoteEditorState.items.map((item, index) => {
        const daRate = item.pauta ? getRateFromPauta(item.pauta, ['Direitos', 'Aduaneiros']) : 0;
        const tsaRate = item.pauta ? getRateFromPauta(item.pauta, ['Sobretaxa']) : 0;
        const iceData = item.pauta ? getComplexRateFromPauta(item.pauta, ['consumo', 'ice']) : null;
        const ivaRate = item.pauta ? getRateFromPauta(item.pauta, ['IVA', 'Valor Acrescentado']) : 0;
        
        const qtyObj = window.getQtyFisicaModeAndHTML(item);
        let qtyFisicaInput = qtyObj.html;
        
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
            <td class="p-0 border-b border-r border-gray-100 relative">
                <div class="flex items-center justify-between w-full h-full px-1">
                    <input type="text" maxlength="8" class="input-hscode flex-1 text-xs ${hsColorClass} py-0.5 px-0.5 border-none hover:bg-white focus:ring-0 outline-none rounded bg-transparent h-6 text-center ${item.pauta ? 'cursor-pointer' : ''}" value="${item.hsCode}" oninput="this.value = this.value.replace(/[^0-9]/g, ''); window.updateQuoteRow(${item.id}, 'hsCode', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" ondblclick="if(this.value.length === 8) window.openPautaInspector(this.value, ${item.id})" placeholder="Ex: 8703" title="${item.pauta ? 'Código válido na Pauta. Clique no botão ao lado para ver estrutura e localização.' : 'Ex: 8703'}">
                    ${item.pauta ? `
                    <button type="button" onclick="window.openPautaInspector('${item.hsCode}', ${item.id})" class="btn-pauta-inspect text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/80 p-0.5 rounded transition-all shrink-0 cursor-pointer shadow-2xs" title="Ver artigo, estrutura e posição na Pauta Aduaneira">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </button>
                    ` : ''}
                </div>
            </td>
            <td class="p-0 border-b border-r border-gray-100">
                <input type="text" class="input-qty w-full text-xs text-center py-0.5 px-1 border-none hover:bg-white focus:ring-0 outline-none rounded bg-transparent h-6 placeholder-gray-300" value="${item.qty}" oninput="this.value = this.value.replace(/[^0-9.,]/g, ''); window.updateQuoteRow(${item.id}, 'qty', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="0">
            </td>
            <td class="p-0 border-b border-r border-gray-100 cell-qty-fis ${hasSpecificIce ? '' : 'hidden'}" data-current-mode="${qtyObj.mode}">
                ${qtyFisicaInput}
            </td>
            <td class="p-0 border-b border-r border-gray-100">
                <input type="text" class="input-unit-price w-full text-xs text-center py-0.5 px-1 border-none hover:bg-white focus:ring-0 outline-none rounded bg-transparent h-6 placeholder-gray-300" value="${item.unitPrice}" oninput="this.value = this.value.replace(/[^0-9.,]/g, ''); window.updateQuoteRow(${item.id}, 'unitPrice', this.value)" onkeydown="window.handleQuoteInputKeydown(event, this)" placeholder="0.00">
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-xs text-gray-800 bg-indigo-50/30 cell-fob font-normal">
                ${formatCurrencyVal(item.fob)}
            </td>
            <td class="p-0 border-b border-r border-gray-100 ${isAereo ? 'hidden' : ''}">
                <input type="text" readonly class="input-readonly-freight w-full text-xs text-center py-0.5 px-1 border-none outline-none focus:ring-0 rounded bg-gray-50/50 text-gray-500 cursor-not-allowed h-6" value="${formatCurrencyVal(item.actualFreight || 0)}" title="Rateio Automático">
            </td>
            <td class="p-0 border-b border-r border-gray-100 ${isAereo ? 'hidden' : ''}">
                <input type="text" readonly class="input-readonly-insurance w-full text-xs text-center py-0.5 px-1 border-none outline-none focus:ring-0 rounded bg-gray-50/50 text-gray-500 cursor-not-allowed h-6" value="${formatCurrencyVal(item.actualInsurance || 0)}" title="Rateio Automático">
            </td>
            <td class="p-0 border-b border-r border-gray-100">
                <input type="text" readonly class="input-readonly-others w-full text-xs text-center py-0.5 px-1 border-none outline-none focus:ring-0 rounded bg-gray-50/50 text-gray-500 cursor-not-allowed h-6" value="${formatCurrencyVal(item.actualOthers || 0)}" title="Rateio Automático">
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-xs text-indigo-700 bg-indigo-50/30 cell-cif font-normal">
                ${formatCurrencyVal(item.cifMzn)}
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-[10px] text-gray-700 cell-da leading-tight whitespace-nowrap">
                ${formatCurrencyVal(item.daValue)} <span class="text-[9px] text-gray-400">(${parseFloat((daRate*100).toFixed(2))}%)</span>
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-[10px] text-gray-700 cell-tsa leading-tight whitespace-nowrap ${hasAnyTsa ? '' : 'hidden'}">
                ${formatCurrencyVal(item.tsaValue)} <span class="text-[9px] text-gray-400">(${parseFloat((tsaRate*100).toFixed(2))}%)</span>
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-[10px] text-gray-700 cell-ice leading-tight whitespace-nowrap ${hasAnyIce ? '' : 'hidden'}">
                ${formatCurrencyVal(item.iceValue)} <span class="text-[9px] text-gray-400">(${item.iceLabel || '0%'})</span>
            </td>
            <td class="p-0 px-1 border-b border-r border-gray-100 text-center text-[10px] text-gray-700 cell-iva leading-tight whitespace-nowrap">
                ${formatCurrencyVal(item.ivaValue)} <span class="text-[9px] text-gray-400">(${parseFloat((ivaRate*100).toFixed(2))}%)</span>
            </td>
            <td class="p-0 border-gray-100 text-center">
                <button onclick="window.removeQuoteRow(${item.id})" class="btn-action-scale btn-delete text-gray-300 p-0.5 rounded-md inline-flex items-center justify-center hover:text-red-500" title="Remover Artigo">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </td>
        </tr>
        `;
    }).join('') + '<tr class="h-full"><td colspan="15" class="border-none bg-transparent p-0 m-0"></td></tr>';
};

window.saveQuoteSimulation = async function(preventClose = false) {
    if (window.quoteEditorState.items.length === 0) {
        toast("A fatura não contém artigos.", "error");
        return;
    }
    
    try {
        const quoteData = {
            id: window.quoteEditorState.id || null,
            client_name: window.quoteEditorState.invoiceData?.clientName || '',
            quote_number: window.quoteEditorState.invoiceData?.docNumber || '',
            date: window.quoteEditorState.invoiceData?.dateIssue || '',
            type: 'IMPORTACAO',
            status: 'RASCUNHO',
            total_amount: window.quoteEditorState.totals.grandTotalMzn,
            cargo_description: window.quoteEditorState.items[0]?.description || 'Múltiplos Artigos',
            issuer: window.quoteEditorState.invoiceData?.issuer || 'jupiter',
            payload: window.quoteEditorState,
            pendingAttachment: window.quoteEditorState.pendingAttachment
        };
        
        const saved = await saveQuote(quoteData);
        window.quoteEditorState.id = saved.id;
        
        // Sync generated fields back into state
        window.quoteEditorState.invoiceData = window.quoteEditorState.invoiceData || {};
        if (saved.quote_number) window.quoteEditorState.invoiceData.docNumber = saved.quote_number;
        if (saved.date) window.quoteEditorState.invoiceData.dateIssue = saved.date;
        
        // Atualizar anexo para a versão guardada do PocketBase se existir
        if (saved.attachment || saved.documento || saved.anexo) {
            const fileName = saved.attachment || saved.documento || saved.anexo;
            const recordMeta = {
                id: saved.id,
                collectionId: saved.collectionId || saved.collectionName || 'quotes',
                collectionName: saved.collectionName || 'quotes'
            };
            const fileUrl = api.pb.files.getUrl(recordMeta, fileName);
            window.quoteEditorState.attachment = { name: fileName, url: fileUrl };
        }
        delete window.quoteEditorState.pendingAttachment;
        
        // Sync DOM inputs immediately
        const elNum = document.getElementById('inv-doc-number');
        if (elNum && saved.quote_number) elNum.value = saved.quote_number;
        const elDate = document.getElementById('inv-date-issue');
        if (elDate && saved.date) elDate.value = saved.date.substring(0, 10);
        
        window.quoteIsDirty = false;
        if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
        
        // Sempre dar feedback ao utilizador e sincronizar lista local
        toast("Fatura guardada com sucesso!", "success");
        await listQuotes(); // Refresh the state.quotes with the newly saved quote
        
        if (!preventClose) {
            window.closeQuoteEditor();
            renderQuoteDashboard(); 
        }
    } catch (err) {
        console.error(err);
        let msg = "Erro ao guardar cotação.";
        if (err.data && err.data.data) {
            msg += " Detalhes: " + JSON.stringify(err.data.data);
        } else if (err.message) {
            msg += " " + err.message;
        }
        toast(msg, "error");
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
        
        // Merge client data if available from relation
        if (quote.client_data) {
            window.quoteEditorState.invoiceData = window.quoteEditorState.invoiceData || {};
            window.quoteEditorState.invoiceData.clientName = quote.client_data.name || '';
            window.quoteEditorState.invoiceData.clientNuit = quote.client_data.nuit || '';
            window.quoteEditorState.invoiceData.clientAddress = quote.client_data.address || '';
            window.quoteEditorState.invoiceData.clientPhone = quote.client_data.phone || '';
            window.quoteEditorState.invoiceData.clientEmail = quote.client_data.email || '';
        }
        
        // Load generated or saved fields
        window.quoteEditorState.invoiceData = window.quoteEditorState.invoiceData || {};
        if (quote.quote_number) window.quoteEditorState.invoiceData.docNumber = quote.quote_number;
        if (quote.date) window.quoteEditorState.invoiceData.dateIssue = quote.date.substring(0, 10);
        
        // Restore attachment from PocketBase
        if (quote.attachment || quote.documento || quote.anexo) {
            const fileName = quote.attachment || quote.documento || quote.anexo;
            const recordMeta = {
                id: quote.id,
                collectionId: quote.collectionId || quote.collectionName || 'quotes',
                collectionName: quote.collectionName || 'quotes'
            };
            const fileUrl = api.pb.files.getUrl(recordMeta, fileName);
            window.quoteEditorState.attachment = { name: fileName, url: fileUrl };
        } else {
            delete window.quoteEditorState.attachment;
        }

        document.getElementById('input-quote-currency').value = window.quoteEditorState.currency || 'USD';
        document.getElementById('input-quote-exchange').value = window.quoteEditorState.exchangeRate || 64.00;
        
        const modeVal = window.quoteEditorState.mode || '';
        document.getElementById('input-quote-mode').value = modeVal;
        document.getElementById('input-quote-submode').value = window.quoteEditorState.subMode || '';
        const subModeContainer = document.getElementById('container-quote-submode');
        if (modeVal === 'Maritimo') {
            if (subModeContainer) subModeContainer.classList.remove('hidden');
            else document.getElementById('input-quote-submode').classList.remove('hidden');
        } else {
            if (subModeContainer) subModeContainer.classList.add('hidden');
            else document.getElementById('input-quote-submode').classList.add('hidden');
        }
        
        const cbmContainer = document.getElementById('container-quote-cbm');
        if (window.quoteEditorState.subMode === 'LCL' || window.quoteEditorState.subMode === 'CBM') {
            if (cbmContainer) { cbmContainer.classList.remove('hidden'); cbmContainer.classList.add('flex'); }
        } else {
            if (cbmContainer) { cbmContainer.classList.add('hidden'); cbmContainer.classList.remove('flex'); }
        }
        
        const cbmInput = document.getElementById('input-quote-cbm');
        if (cbmInput) {
            cbmInput.value = window.quoteEditorState.globais?.cbm || '';
            if (cbmInput.value.toString().trim() !== '') {
                cbmInput.classList.remove('border-gray-200');
                cbmInput.classList.add('border-transparent');
            } else {
                cbmInput.classList.remove('border-transparent');
                cbmInput.classList.add('border-gray-200');
            }
        }
        
        const carClassContainer = document.getElementById('container-quote-carclass');
        if (window.quoteEditorState.subMode === 'CAR') {
            if (carClassContainer) {
                carClassContainer.classList.remove('hidden');
                carClassContainer.classList.add('flex');
            }
        } else {
            if (carClassContainer) {
                carClassContainer.classList.add('hidden');
                carClassContainer.classList.remove('flex');
            }
        }
        const carClassInput = document.getElementById('input-quote-carclass');
        if (carClassInput) {
            carClassInput.value = window.quoteEditorState.globais?.carClass || 'Ligeiro';
        }
        
        document.getElementById('input-global-freight').value = window.quoteEditorState.globais?.freight || '';
        document.getElementById('input-global-insurance').value = window.quoteEditorState.globais?.insurance || '';
        document.getElementById('input-global-others').value = window.quoteEditorState.globais?.others || '';
        
        let cNameTitle = quote.client_name;
        if (!cNameTitle || cNameTitle === 'undefined') {
            cNameTitle = quote.payload?.invoiceData?.clientName || quote.payload?.clientName || 'Cliente Não Definido';
        }
        document.getElementById('lbl-quote-editor-title').innerText = `Cotação: ${cNameTitle}`;
        
        window.openQuoteEditor();
        window.quoteIsDirty = false;
        if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
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
            totals: { fobForeign: 0, freightForeign: 0, insForeign: 0, cifMzn: 0, daMzn: 0, iceMzn: 0, ivaMzn: 0, tsaMzn: 0, mcnetMzn: 0, tsaFixedMzn: 0, grandTotalMzn: 0 }
        };
        
        document.getElementById('input-quote-currency').value = 'MT';
        document.getElementById('input-quote-exchange').value = '1';
        const cNameOld = quote.client_name && quote.client_name !== 'undefined' ? quote.client_name : 'Cliente Não Definido';
        document.getElementById('lbl-quote-editor-title').innerText = `Cotação Migrada: ${cNameOld}`;
        
        window.openQuoteEditor();
        window.quoteIsDirty = false;
        if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
    }
};

// ==========================================
// FREIGHT MODAL LOGIC (VALOR DO BILL & CÁLCULO AUTOMÁTICO DE CUSTO EXTRA)
// ==========================================

export function updateFreightTotalCalculation() {
    const freightBase = window.currentFreightBaseAmount !== undefined
        ? window.currentFreightBaseAmount
        : (window.currentClientRows || []).reduce((acc, r) => acc + (r.balFreight || 0), 0);
        
    const billInput = document.getElementById('input-freight-bill-amount');
    const billInputVal = billInput?.value?.trim();
    const hasCustomBill = billInputVal !== undefined && billInputVal !== '' && !isNaN(parseFloat(billInputVal));
    const billAmount = hasCustomBill ? Math.max(0, parseFloat(billInputVal)) : freightBase;

    // A diferença entre o valor do bill e o frete base é o custo extra
    const totalExtras = Math.max(0, billAmount - freightBase);
    const grandTotal = Math.max(freightBase, billAmount);

    // Atualizar displays de valores
    const baseEl = document.getElementById('modal-freight-base-display');
    if (baseEl) baseEl.innerText = formatMZN(freightBase);

    const extrasRow = document.getElementById('modal-freight-extras-row');
    const extrasEl = document.getElementById('modal-freight-extras-display');
    if (extrasRow && extrasEl) {
        if (totalExtras > 0) {
            extrasRow.classList.remove('hidden');
            extrasEl.innerText = `+${formatMZN(totalExtras)}`;
        } else {
            extrasRow.classList.add('hidden');
        }
    }

    const totalValEl = document.getElementById('modal-freight-total-value');
    if (totalValEl) {
        totalValEl.innerText = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(grandTotal);
    }

    const ruleBaseEl = document.getElementById('modal-freight-rule-base');
    if (ruleBaseEl) ruleBaseEl.innerText = formatMZN(freightBase);

    const ruleDiffEl = document.getElementById('modal-freight-rule-diff');
    if (ruleDiffEl) ruleDiffEl.innerText = formatMZN(totalExtras);

    const ruleTotalEl = document.getElementById('modal-freight-rule-total');
    if (ruleTotalEl) ruleTotalEl.innerText = formatMZN(grandTotal);

    const statusBadge = document.getElementById('badge-freight-bill-status');
    if (statusBadge) {
        if (totalExtras > 0) {
            statusBadge.innerText = `+${formatMZN(totalExtras)} Extra`;
            statusBadge.className = 'text-[8.5px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300';
        } else {
            statusBadge.innerText = 'Frete Base';
            statusBadge.className = 'text-[8.5px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200';
        }
    }

    // Gerar prévia da nota
    const notePreviewEl = document.getElementById('modal-freight-note-preview');
    if (notePreviewEl) {
        if (totalExtras > 0) {
            notePreviewEl.innerText = `PAID TO JUPITER (+${formatMZN(totalExtras)} Extras)`;
        } else {
            notePreviewEl.innerText = 'PAID TO JUPITER';
        }
    }

    return {
        freightBase,
        billAmount,
        totalExtras,
        grandTotal,
        hasCustomBill
    };
}
window.updateFreightTotalCalculation = updateFreightTotalCalculation;

export function openFreightModal() {
    const totalBal = (window.currentClientRows || []).reduce((acc, r) => acc + (r.balFreight || 0), 0);
    const totalFrt = (window.currentClientRows || []).reduce((acc, r) => acc + (r.amtFreight || 0), 0);
    const totalPaid = (window.currentClientRows || []).reduce((acc, r) => acc + (r.pdFreight || 0), 0);

    // Se o frete estiver totalmente pago, não abrir o popup
    if (totalFrt > 0 && (totalBal <= 0 || totalPaid >= totalFrt)) {
        toast("O frete deste cliente já se encontra totalmente pago.", "info");
        return;
    }

    const modal = document.getElementById('modal-freight-update');
    if (modal) {
        document.getElementById('select-freight-bank').value = '';

        const baseVal = totalBal > 0 ? totalBal : totalFrt;
        window.currentFreightBaseAmount = baseVal;

        // Inicializar campo do Valor do Bill com o valor base do frete
        const inpBill = document.getElementById('input-freight-bill-amount');
        if (inpBill) {
            inpBill.value = baseVal > 0 ? baseVal.toFixed(2) : '';
            inpBill.placeholder = baseVal > 0 ? baseVal.toFixed(2) : '0.00';
        }
        
        updateFreightTotalCalculation();

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

    const calc = updateFreightTotalCalculation();
    const freightBase = calc.freightBase;
    const totalExtras = calc.totalExtras;
    const totalExpectedInBank = calc.grandTotal;

    let finalNote = 'PAID TO JUPITER';
    if (totalExtras > 0) {
        finalNote = `PAID TO JUPITER (+${formatMZN(totalExtras)} Extras)`;
    }

    // Guardar contexto completo de frete e extras para uso no confirmPaymentFull
    window.freightExtrasContext = {
        freightBase,
        totalExtras,
        totalExpectedInBank,
        finalNote
    };

    let projectName = 'Folha';
    const breadcrumbSpan = document.querySelector('#confirm-breadcrumb > span.hover\\:text-black.cursor-pointer.transition-colors');
    if (breadcrumbSpan) {
        projectName = breadcrumbSpan.innerText.trim();
    }
    
    let combinedTag = 'FRETE';
    if (totalExtras > 0) {
        combinedTag = `FRETE (+${formatMZN(totalExtras)} EXTRAS)`;
    }
    const combinedInfo = `${combinedTag} - ${window.currentActiveClient.no || ''} - ${projectName}`.replace(/(^ - )|( - $)/g, '').trim();

    // Abrir o mini-filtro pesquisando pelo valor TOTAL recebido no banco (ex: 6000 MT)
    ui.openPaymentMiniFilter(
        combinedInfo,
        bankValue,
        totalExpectedInBank,
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

    const isChina = window.currentFreightOrigin === 'china';
    const calc = updateFreightTotalCalculation();
    const totalExtras = calc.totalExtras;

    let finalNote = '';
    let bankVal = '';

    if (isChina) {
        bankVal = 'PAID IN CHINA';
        finalNote = totalExtras > 0 ? `PAID IN CHINA (+${formatMZN(totalExtras)} Extras)` : 'PAID IN CHINA';
    } else {
        bankVal = document.getElementById('select-freight-bank').value;
        if (!bankVal) {
            toast("Por favor, selecione um banco para continuar.", "info");
            return;
        }
        finalNote = totalExtras > 0 ? `PAID TO JUPITER (+${formatMZN(totalExtras)} Extras)` : 'PAID TO JUPITER';
    }

    const btn = document.getElementById('btn-freight-salvar') || document.querySelector('#modal-freight-update button:nth-child(2)');
    if (btn) btn.disabled = true;

    try {
        const columns = state.confirm.columns || [];

        const bankFreightIdx = findColumnIndex(columns, ['BANK IN FREIGHT']);
        const notaFreightIdx = findColumnIndex(columns, ['NOTA FREIGHT']);
        const paidFreightIdx = findColumnIndex(columns, ['PAID FREIGHT']);
        const amountFreightIdx = findColumnIndex(columns, ['AMOUNT FREIGHT']);
        const balanceFreightIdx = findColumnIndex(columns, ['BALANCE FREIGHT']);

        const currentProjectSheetId = state.confirm.sheetId;
        
        let sheetName = 'Folha1';
        if (state.confirm.range && state.confirm.range.includes('!')) {
            sheetName = state.confirm.range.split('!')[0];
        }

        const updates = [];
        
        // Loop sobre todas as ordens deste cliente
        for (const rowObj of window.currentActiveClient.rows) {
            const originalIndex = rowObj.originalIndex;
            const rowIndex = originalIndex + 1; // +1 porque google sheets é 1-indexed

            // Update Bank in Freight
            if (bankFreightIdx !== -1 && bankVal !== '') {
                const bVal = bankVal === '?' ? '' : bankVal;
                if (state.confirm?.data && state.confirm.data[originalIndex]) {
                    state.confirm.data[originalIndex][bankFreightIdx] = bVal;
                }
                if (rowObj.originalRow) {
                    rowObj.originalRow[bankFreightIdx] = bVal;
                }
                updates.push({
                    range: formatSheetRange(sheetName, `${getColLetter(bankFreightIdx)}${rowIndex}`),
                    values: [[bVal]]
                });
            }
            
            // Update Nota Freight com documentação de extras
            if (notaFreightIdx !== -1 && finalNote !== '') {
                if (state.confirm?.data && state.confirm.data[originalIndex]) {
                    state.confirm.data[originalIndex][notaFreightIdx] = finalNote;
                }
                if (rowObj.originalRow) {
                    rowObj.originalRow[notaFreightIdx] = finalNote;
                }
                updates.push({
                    range: formatSheetRange(sheetName, `${getColLetter(notaFreightIdx)}${rowIndex}`),
                    values: [[finalNote]]
                });
            }

            // Update PAID FREIGHT e BALANCE FREIGHT
            // Na lista/folha regista-se ESTRITAMENTE o valor referente ao frete (amt)
            const amountVal = state.confirm?.data?.[originalIndex]?.[amountFreightIdx] ?? rowObj.originalRow?.[amountFreightIdx] ?? rowObj.amtFreight ?? 0;
            const amt = parseFloat(String(amountVal).replace(/[^0-9.-]+/g, "")) || 0;

            if (paidFreightIdx !== -1) {
                if (state.confirm?.data && state.confirm.data[originalIndex]) {
                    state.confirm.data[originalIndex][paidFreightIdx] = amt;
                }
                if (rowObj.originalRow) {
                    rowObj.originalRow[paidFreightIdx] = amt;
                }
                rowObj.pdFreight = amt;
                updates.push({
                    range: formatSheetRange(sheetName, `${getColLetter(paidFreightIdx)}${rowIndex}`),
                    values: [[amt]]
                });
            }

            if (balanceFreightIdx !== -1) {
                if (state.confirm?.data && state.confirm.data[originalIndex]) {
                    state.confirm.data[originalIndex][balanceFreightIdx] = 0;
                }
                if (rowObj.originalRow) {
                    rowObj.originalRow[balanceFreightIdx] = 0;
                }
                rowObj.balFreight = 0;
                updates.push({
                    range: formatSheetRange(sheetName, `${getColLetter(balanceFreightIdx)}${rowIndex}`),
                    values: [[0]]
                });
            } else {
                rowObj.balFreight = 0;
            }

            // Também atualizar no window.currentClientRows se existir
            if (Array.isArray(window.currentClientRows)) {
                const cRow = window.currentClientRows.find(cr => cr.originalIndex === originalIndex);
                if (cRow) {
                    cRow.pdFreight = amt;
                    cRow.balFreight = 0;
                    if (cRow.originalRow) {
                        if (paidFreightIdx !== -1) cRow.originalRow[paidFreightIdx] = amt;
                        if (balanceFreightIdx !== -1) cRow.originalRow[balanceFreightIdx] = 0;
                        if (bankFreightIdx !== -1) cRow.originalRow[bankFreightIdx] = bankVal === '?' ? '' : bankVal;
                        if (notaFreightIdx !== -1) cRow.originalRow[notaFreightIdx] = finalNote;
                    }
                }
            }
        }

        if (updates.length > 0) {
            await updateGSheetBatch(currentProjectSheetId, updates);
            toast("Frete gravado com sucesso no GSheet!", "success");
        } else {
            toast("Erro: Colunas de Frete não encontradas no GSheet.", "warning");
        }

        closeFreightModal();

        // Recarregar os detalhes do cliente ativo imediatamente para refletir na UI sem stale data
        if (window.currentActiveClient) {
            await showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
        }

        // Atualizar lista em segundo plano mantendo a consistência
        const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
        renderConfirmList(state.confirm.data, "", statusFilter);

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

export { parseStorageInfo, calculateClientStorage };
window.parseStorageInfo = parseStorageInfo;
window.calculateClientStorage = calculateClientStorage;

const CLIENT_FEE_CONFIG = {
    STORAGE: {
        prefix: 'ARMAZEM',
        auditLabel: 'Armazém',
        statusTargets: ['STORAGE PAID', 'ARMAZENAGEM PAGO', 'STORAGE_PAID'],
        valueTargets: ['STORAGE VALUE', 'VALOR ARMAZENAGEM', 'ARMAZENAGEM VALOR', 'STORAGE_VALUE'],
        ensureColumnsFn: () => ensureStorageValueColumn(),
        zeroCostPendingLabel: 'NAO',
        preferAmountOnPaid: false
    },
    DESPACHO: {
        prefix: 'DESPACHO',
        auditLabel: 'Cópia de Despacho',
        statusTargets: ['COPIA DESPACHO', 'COPIA DE DESPACHO', 'DESPACHO COPY', 'COPIA_DESPACHO'],
        valueTargets: ['COPIA DESPACHO VALOR', 'VALOR COPIA DESPACHO', 'COPIA DESPACHO VALUE', 'DESPACHO VALUE', 'DESPACHO VALOR'],
        ensureColumnsFn: () => ensureDespachoCopyColumns(),
        zeroCostPendingLabel: 'PENDENTE',
        preferAmountOnPaid: true
    }
};

function getActiveConfirmSheetName() {
    let sheetName = 'Sheet1';
    if (state.confirm?.range && state.confirm.range.includes('!')) {
        sheetName = state.confirm.range.split('!')[0];
    } else if (state.confirm?.sheetTitle) {
        sheetName = String(state.confirm.sheetTitle);
    }
    return (sheetName || 'Sheet1').replace(/^'+|'+$/g, '').trim();
}

async function syncClientFeeToGSheet(feeKey, client, { statusCellVal, valueCellVal, emitStatus = null } = {}) {
    const cfg = CLIENT_FEE_CONFIG[feeKey];
    if (!cfg || !client || !client.rows || client.rows.length === 0) return;
    const sheetId = state.confirm?.sheetId || '';
    const columns = state.confirm.columns || [];
    const statusIdx = findWarehouseCol(columns, cfg.statusTargets);
    const valueIdx = findWarehouseCol(columns, cfg.valueTargets);
    if (statusIdx === -1 && valueIdx === -1) return;

    const sheetName = getActiveConfirmSheetName();
    const sortedRows = [...client.rows].sort((a, b) => a.originalIndex - b.originalIndex);
    const batchUpdates = [];
    const localUpdates = [];

    sortedRows.forEach((r, idx) => {
        const originalIndex = r.originalIndex;
        const rowNum = originalIndex + 1;
        const rawRow = (state.confirm?.data && state.confirm.data[originalIndex]) || r.originalRow || [];
        const rowData = [...rawRow];
        const maxNeededIdx = Math.max(statusIdx, valueIdx);
        while (rowData.length <= maxNeededIdx) rowData.push('');

        if (statusIdx !== -1 && statusCellVal !== undefined) {
            rowData[statusIdx] = statusCellVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(statusIdx)}${rowNum}`), values: [[statusCellVal]] });
        }
        if (valueIdx !== -1 && valueCellVal !== undefined) {
            const cellVal = idx === 0 ? valueCellVal : '';
            rowData[valueIdx] = cellVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(valueIdx)}${rowNum}`), values: [[cellVal]] });
        }
        if (r.originalRow) {
            while (r.originalRow.length <= maxNeededIdx) r.originalRow.push('');
            if (statusIdx !== -1 && statusCellVal !== undefined) r.originalRow[statusIdx] = statusCellVal;
            if (valueIdx !== -1 && valueCellVal !== undefined) r.originalRow[valueIdx] = idx === 0 ? valueCellVal : '';
        }
        localUpdates.push({ originalIndex, rowData });
    });

    if (sheetId && batchUpdates.length > 0) {
        await updateGSheetBatch(sheetId, batchUpdates);
    }

    localUpdates.forEach(item => {
        if (state.confirm?.data) state.confirm.data[item.originalIndex] = item.rowData;
        if (sheetId) {
            emitConfirmEvent(sheetId, item.originalIndex, 'UPDATE', {
                ...(emitStatus ? { status: emitStatus } : {}),
                rowData: item.rowData
            });
        }
    });
}

/**
 * Sincroniza o estado de pagamento no GSheet (ARMAZEM ou DESPACHO) após desalocar um vínculo bancário.
 */
async function syncClientFeeAfterUnallocate(feeKey, client, allocatedToKey) {
    const cfg = CLIENT_FEE_CONFIG[feeKey];
    if (!cfg || !client || !client.rows || client.rows.length === 0 || !state.confirm?.sheetId) return;
    const remainingPmts = allocatedToKey ? await getPaymentsByAllocatedTo(allocatedToKey) : [];
    const remainingBankSum = remainingPmts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const columns = state.confirm.columns || [];

    if (feeKey === 'DESPACHO') {
        const calc = calculateClientDespachoCopy({
            rows: client.rows,
            columns,
            defaultPrice: getDespachoCopyDefaultPrice(),
            bankPayments: []
        });
        const keepRequested = calc.isRequested || remainingBankSum > 0;
        const { statusCellVal, valueCellVal } = formatFeeSheetStatus({
            isRequested: keepRequested,
            targetCost: keepRequested ? (calc.cost > 0 ? calc.cost : calc.defaultPrice) : 0,
            standardCost: calc.defaultPrice,
            bankPaidAmount: remainingBankSum,
            manualStatus: 'NAO',
            zeroCostPendingLabel: cfg.zeroCostPendingLabel,
            preferAmountOnPaid: cfg.preferAmountOnPaid
        });
        await syncClientFeeToGSheet('DESPACHO', client, { statusCellVal, valueCellVal });
        return;
    }

    const calc = calculateClientStorage({
        rows: client.rows,
        columns,
        dischargeDateStr: state.confirm?.dischargeDate || '',
        bankPayments: remainingPmts
    });
    const info = calc.storageInfo;
    const { statusCellVal, valueCellVal } = formatFeeSheetStatus({
        isRequested: true,
        isExempt: info.isExempt,
        isDelivered: calc.isDelivered,
        targetCost: info.cost,
        standardCost: calc.standardCost,
        bankPaidAmount: remainingBankSum,
        manualStatus: 'NAO',
        zeroCostPendingLabel: cfg.zeroCostPendingLabel,
        preferAmountOnPaid: cfg.preferAmountOnPaid
    });
    await syncClientFeeToGSheet('STORAGE', client, { statusCellVal, valueCellVal });
}

function resolveClientAllocatedKey(prefix, client) {
    let projectName = 'Folha';
    const breadcrumbSpan = document.querySelector('#confirm-breadcrumb > span.hover\\:text-black.cursor-pointer.transition-colors');
    if (breadcrumbSpan) {
        projectName = breadcrumbSpan.innerText.trim();
    } else if (document.getElementById('confirm-project-active-name')) {
        projectName = document.getElementById('confirm-project-active-name').innerText.trim();
    }
    const baseCombinedInfo = `${client.no || ''} - ${projectName}`.replace(/(^ - )|( - $)/g, '').trim();
    return `${prefix} - ${baseCombinedInfo}`;
}

function openFeeBankReconciliation(feeKey, { client, standardCost, agreedCost, existingPayments }) {
    const cfg = CLIENT_FEE_CONFIG[feeKey];
    if (!cfg || !client) return;
    const alreadyPaid = (existingPayments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const remainingBalance = Math.max(0, agreedCost - alreadyPaid);

    if (remainingBalance <= 0.05) {
        toast(`O valor total de ${cfg.auditLabel.toLowerCase()} já se encontra vinculado e coberto no banco.`, 'info');
        return;
    }

    const allocatedToKey = resolveClientAllocatedKey(cfg.prefix, client);
    const ctxPayload = {
        feeKey,
        allocatedToKey,
        standardCost,
        agreedCost,
        totalExpected: agreedCost,
        alreadyPaid,
        remainingBalance,
        isNegotiated: Math.abs(agreedCost - standardCost) > 1
    };

    window.paymentReconciliationContext = feeKey;
    window.feeReconciliationContext = ctxPayload;
    if (feeKey === 'STORAGE') window.storageReconciliationContext = ctxPayload;

    const noteLabel = alreadyPaid > 0
        ? `${cfg.auditLabel}: ${formatMZN(agreedCost)} (Vinculado: ${formatMZN(alreadyPaid)} | Falta: ${formatMZN(remainingBalance)})`
        : `${cfg.auditLabel}: ${formatMZN(agreedCost)}`;

    openPaymentMiniFilter(
        allocatedToKey,
        '',
        remainingBalance,
        '',
        client.displayName || '',
        window.currentActiveClientState?.clientPhone || '',
        noteLabel
    );
}

/**
 * Verifica se a data de descarga do projeto ativo está definida.
 * @returns {boolean}
 */
export function hasProjectDischargeDate() {
    return hasValidDischargeDate(state.confirm?.dischargeDate);
}

/**
 * Bloqueia preenchimento/gravação na aba de Armazém enquanto a data de descarga não estiver definida.
 * @returns {boolean}
 */
function requireProjectDischargeDate() {
    if (hasProjectDischargeDate()) return true;
    toast('Defina a Data de Descarga do projeto antes de preencher qualquer campo na aba de Armazém.', 'warning');
    return false;
}

/**
 * Abre a reconciliação bancária dedicada para vincular o valor de armazenagem a um movimento bancário.
 */
export function vincularPagamentoArmazem() {
    if (!requireProjectDischargeDate()) return;
    if (!window.currentActiveClient) {
        toast('Nenhum cliente selecionado.', 'warning');
        return;
    }
    const client = window.currentActiveClient;
    const container = document.getElementById('armazem-form-container') || document;
    const payInput = container.querySelector('#input-storage-pay-amount');
    const isExempt = Boolean(container.querySelector('#check-has-isencao')?.checked || window.currentClientStorageInfo?.isExempt);
    if (isExempt) {
        toast('Cliente isento de taxa de armazenagem (0,00 MT).', 'info');
        return;
    }

    const columns = state.confirm?.columns || [];
    const baseCalc = calculateClientStorage({
        rows: client.rows,
        columns,
        dischargeDateStr: state.confirm?.dischargeDate || '',
        bankPayments: window.currentClientStoragePayments || []
    });

    const standardCost = payInput ? (parseFloat(payInput.getAttribute('data-standard-cost')) || baseCalc.standardCost) : baseCalc.standardCost;
    const agreedCost = (payInput && !payInput.disabled && payInput.value !== '')
        ? (parseFloat(payInput.value) || 0)
        : baseCalc.storageInfo.cost;

    if (agreedCost <= 0) {
        toast('Não há taxa de armazenagem a cobrar neste momento.', 'info');
        return;
    }

    openFeeBankReconciliation('STORAGE', {
        client,
        standardCost,
        agreedCost,
        existingPayments: window.currentClientStoragePayments || []
    });
}
window.vincularPagamentoArmazem = vincularPagamentoArmazem;

export function updateDespachoCardCalculations() {
    const card = document.getElementById('despacho-copy-card');
    if (!card) return;

    const hasDischargeDate = hasProjectDischargeDate();
    const client = window.currentActiveClient;
    const chk = card.querySelector('#check-despacho-solicitado');
    const amountInput = card.querySelector('#input-despacho-amount');
    const statusSelect = card.querySelector('#select-despacho-paid');
    const fieldsWrap = card.querySelector('#despacho-fields-wrap');
    const statusBadge = card.querySelector('#despacho-status-badge');
    const remainingEl = card.querySelector('#despacho-remaining-label');
    const vincularBtn = card.querySelector('#btn-despacho-vincular-banco');
    const guardarBtn = card.querySelector('#btn-despacho-guardar');
    const configBtn = card.querySelector('#btn-despacho-config-toggle');

    const defaultPrice = getDespachoCopyDefaultPrice();
    const despachoPmts = window.currentClientDespachoPayments || [];
    const bankPaidAmount = despachoPmts.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

    if (chk && !chk.checked && bankPaidAmount > 0) {
        chk.checked = true;
        toast('Existe pagamento bancário vinculado à Cópia de Despacho. Desaloque primeiro nos Detalhes de Reconciliação para desactivar.', 'warning');
    }

    const isRequested = Boolean(chk?.checked);
    if (chk) chk.disabled = !hasDischargeDate;
    if (fieldsWrap) fieldsWrap.classList.toggle('opacity-50', !hasDischargeDate || !isRequested);
    if (amountInput) amountInput.disabled = !hasDischargeDate || !isRequested;
    if (statusSelect) statusSelect.disabled = !hasDischargeDate || !isRequested;
    if (guardarBtn) guardarBtn.disabled = !hasDischargeDate;
    if (configBtn) configBtn.disabled = !hasDischargeDate;

    if (hasDischargeDate && isRequested && amountInput && (amountInput.value === '' || parseFloat(amountInput.value) === 0) && amountInput.dataset.userEdited !== 'true') {
        amountInput.value = String(defaultPrice);
    }

    const calc = calculateClientDespachoCopy({
        rows: client?.rows || [],
        columns: state.confirm?.columns || [],
        defaultPrice,
        bankPayments: despachoPmts,
        overrides: {
            isRequested,
            explicitAgreedCost: isRequested && amountInput && amountInput.value !== '' ? (parseFloat(amountInput.value) || 0) : null,
            despachoStatusVal: !isRequested ? 'NAO_SOLICITADO' : (statusSelect ? statusSelect.value : '')
        }
    });

    if (window.currentClientDespachoInfo !== undefined) {
        window.currentClientDespachoInfo = calc;
    }

    if (statusBadge) {
        if (!calc.isRequested) {
            statusBadge.textContent = 'Opcional / Não Solicitada';
            statusBadge.className = 'text-[9px] font-black uppercase px-2.5 py-0.5 rounded-lg border bg-slate-100 text-slate-600 border-slate-200';
        } else if (calc.isPaid) {
            statusBadge.textContent = `Pago (${formatMZN(calc.cost)})`;
            statusBadge.className = 'text-[9px] font-black uppercase px-2.5 py-0.5 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (calc.isPartial) {
            statusBadge.textContent = `Parcial • Falta ${formatMZN(calc.remainingBalance)}`;
            statusBadge.className = 'text-[9px] font-black uppercase px-2.5 py-0.5 rounded-lg border bg-amber-50 text-amber-800 border-amber-200';
        } else {
            statusBadge.textContent = `Pendente (${formatMZN(calc.cost)})`;
            statusBadge.className = 'text-[9px] font-black uppercase px-2.5 py-0.5 rounded-lg border bg-rose-50 text-rose-700 border-rose-200 animate-pulse';
        }
    }

    if (remainingEl) {
        if (calc.isRequested && calc.cost > 0 && calc.remainingBalance > 0.05) {
            remainingEl.textContent = `Falta: ${formatMZN(calc.remainingBalance)}`;
            remainingEl.classList.remove('hidden');
        } else {
            remainingEl.classList.add('hidden');
        }
    }

    if (vincularBtn) {
        const showBtn = hasDischargeDate && calc.cost > 0 && (!calc.isPaid || calc.remainingBalance > 0.05) && isRequested;
        vincularBtn.classList.toggle('hidden', !showBtn);
    }
}
window.updateDespachoCardCalculations = updateDespachoCardCalculations;

export function toggleDespachoConfigRow() {
    if (!requireProjectDischargeDate()) return;
    const row = document.getElementById('despacho-default-config-row');
    if (row) row.classList.toggle('hidden');
}
window.toggleDespachoConfigRow = toggleDespachoConfigRow;

export function applyDespachoDefaultPrice() {
    if (!requireProjectDischargeDate()) return;
    const inp = document.getElementById('input-despacho-default-price');
    const badge = document.getElementById('despacho-default-price-label');
    if (!inp) return;
    const saved = setDespachoCopyDefaultPrice(inp.value);
    inp.value = String(saved);
    if (badge) badge.textContent = formatMZN(saved);

    const clientAmountInp = document.getElementById('input-despacho-amount');
    if (clientAmountInp && clientAmountInp.dataset.userEdited !== 'true' && !window.currentClientDespachoInfo?.isCustomAmount) {
        clientAmountInp.value = String(saved);
    }
    toggleDespachoConfigRow();
    updateDespachoCardCalculations();
    toast(`Valor padrão da Cópia de Despacho atualizado para ${formatMZN(saved)}`, 'success');
}
window.applyDespachoDefaultPrice = applyDespachoDefaultPrice;

export function vincularPagamentoDespacho() {
    if (!requireProjectDischargeDate()) return;
    if (!window.currentActiveClient) {
        toast('Nenhum cliente selecionado.', 'warning');
        return;
    }
    const client = window.currentActiveClient;
    const card = document.getElementById('despacho-copy-card');
    const chk = card?.querySelector('#check-despacho-solicitado');
    if (chk && !chk.checked) {
        chk.checked = true;
        updateDespachoCardCalculations();
    }

    const defaultPrice = getDespachoCopyDefaultPrice();
    const amountInput = card?.querySelector('#input-despacho-amount');
    const agreedCost = (amountInput && amountInput.value !== '')
        ? (parseFloat(amountInput.value) || 0)
        : (window.currentClientDespachoInfo?.cost > 0 ? window.currentClientDespachoInfo.cost : defaultPrice);

    if (agreedCost <= 0) {
        toast('Defina um valor maior que 0,00 MT para a Cópia de Despacho antes de vincular.', 'warning');
        return;
    }

    openFeeBankReconciliation('DESPACHO', {
        client,
        standardCost: defaultPrice,
        agreedCost,
        existingPayments: window.currentClientDespachoPayments || []
    });
}
window.vincularPagamentoDespacho = vincularPagamentoDespacho;

export async function saveDespachoCopy(buttonEl) {
    if (!requireProjectDischargeDate()) return;
    const client = window.currentActiveClient;
    if (!client || !client.rows || client.rows.length === 0) {
        toast('Nenhum cliente selecionado.', 'warning');
        return;
    }
    const card = document.getElementById('despacho-copy-card');
    if (!card) return;

    const chk = card.querySelector('#check-despacho-solicitado');
    const amountInput = card.querySelector('#input-despacho-amount');
    const statusSelect = card.querySelector('#select-despacho-paid');
    const despachoPayments = window.currentClientDespachoPayments || [];
    const bankPaidAmount = despachoPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

    const isRequested = Boolean(chk?.checked) || bankPaidAmount > 0;
    const defaultPrice = getDespachoCopyDefaultPrice();
    const enteredCost = (amountInput && amountInput.value !== '')
        ? Math.max(0, parseFloat(amountInput.value) || 0)
        : defaultPrice;
    const manualStatus = statusSelect ? statusSelect.value : 'NAO';

    const { statusCellVal, valueCellVal } = formatFeeSheetStatus({
        isRequested,
        targetCost: isRequested ? enteredCost : 0,
        standardCost: defaultPrice,
        bankPaidAmount,
        manualStatus,
        zeroCostPendingLabel: 'PENDENTE',
        preferAmountOnPaid: true
    });

    try {
        if (buttonEl) setBtnLoading(buttonEl, true);
        await ensureDespachoCopyColumns();
        await syncClientFeeToGSheet('DESPACHO', client, {
            statusCellVal,
            valueCellVal,
            emitStatus: statusCellVal
        });

        logConfirmAudit(state.confirm.sheetId, client.no, client.displayName, 'COPIA_DESPACHO_ATUALIZADA', {
            solicitada: isRequested,
            valor: valueCellVal,
            estado: statusCellVal,
            totalBanco: bankPaidAmount
        }).catch(err => console.warn('[Audit] Erro ao registar auditoria de cópia de despacho:', err));

        await showConfirmDetail(client, window.currentActiveClientIndex);
        toast('Cópia de Despacho gravada com sucesso!', 'success');
    } catch (err) {
        console.error('[DESPACHO] Erro ao gravar Cópia de Despacho:', err);
        toast('Erro ao gravar Cópia de Despacho: ' + err.message, 'error');
    } finally {
        if (buttonEl) setBtnLoading(buttonEl, false);
    }
}
window.saveDespachoCopy = saveDespachoCopy;

export async function checkAndCreateWarehouseColumns() {
    let columns = state.confirm.columns || (state.confirm.data && state.confirm.data[0]) || [];

    // Se STORAGE PAID já existir mas faltar STORAGE VALUE, inserir estruturalmente logo após STORAGE PAID
    const hasStoragePaid = findWarehouseCol(columns, ['STORAGE PAID', 'ARMAZENAGEM PAGO', 'STORAGE_PAID']) !== -1;
    const hasStorageValue = findWarehouseCol(columns, ['STORAGE VALUE', 'VALOR ARMAZENAGEM', 'ARMAZENAGEM VALOR', 'STORAGE_VALUE']) !== -1;
    if (hasStoragePaid && !hasStorageValue) {
        await ensureStorageValueColumn();
        columns = state.confirm.columns || (state.confirm.data && state.confirm.data[0]) || [];
    }

    const required = ['DISCHARGE', 'DELIVER', 'DELIVER DATE', 'DELIVER TO', 'CONTACTO', 'STORAGE PAID', 'STORAGE VALUE', 'DELIVERED'];
    
    const missing = [];
    required.forEach(req => {
        const targets = req === 'CONTACTO' ? ['CONTACTO', 'CONTACT'] : [req];
        if (findWarehouseCol(columns, targets) === -1) {
            missing.push(req);
        }
    });

    if (missing.length === 0) {
        toast('Todas as colunas de armazém já existem!', 'info');
        if (window.currentActiveClient) {
            await showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
        }
        return;
    }

    console.log('[WAREHOUSE] Criando colunas de Armazém em falta:', missing);
    const newColumns = [...columns, ...missing];
    
    let cleanSheetName = '';
    if (state.confirm.range && state.confirm.range.includes('!')) {
        cleanSheetName = state.confirm.range.split('!')[0].replace(/'/g, '');
    }
    const sheetPrefix = cleanSheetName ? `'${cleanSheetName}'!` : '';
    const lastColLetter = getColLetter(newColumns.length - 1);
    const range = `${sheetPrefix}A1:${lastColLetter}1`;

    try {
        setLoader(true, 'A criar colunas de Armazém...');
        
        // Atualizar estado em memória e expandir matriz
        if (state.confirm.data && state.confirm.data.length > 0) {
            state.confirm.data[0] = newColumns;
            state.confirm.columns = newColumns;
            for (let i = 1; i < state.confirm.data.length; i++) {
                if (state.confirm.data[i] && Array.isArray(state.confirm.data[i])) {
                    while (state.confirm.data[i].length < newColumns.length) {
                        state.confirm.data[i].push('');
                    }
                }
            }
        } else {
            state.confirm.columns = newColumns;
        }

        // Tentar enviar para o Google Sheets
        await updateGSheet(state.confirm.sheetId, range, [newColumns]);
        
        toast('Colunas de Armazém criadas com sucesso!', 'success');
        
        const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
        renderConfirmList(state.confirm.data, "", statusFilter);
        if (window.currentActiveClient) {
            await showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
        }
    } catch (err) {
        console.warn('[WAREHOUSE] Colunas salvas localmente:', err.message);
        toast('Colunas de Armazém criadas com sucesso (PocketBase)!', 'success');
        const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
        renderConfirmList(state.confirm.data, "", statusFilter);
        if (window.currentActiveClient) {
            await showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
        }
    } finally {
        setLoader(false);
    }
}
window.checkAndCreateWarehouseColumns = checkAndCreateWarehouseColumns;

/**
 * Renderiza o painel operacional de Armazém nos detalhes do cliente
 */
export function parseDate(dateStr) {
    return parseWarehouseDate(dateStr);
}

window.updateArmazemSaldo = function() {
    const dischargeInput = document.querySelector('#armazem-form-container input[name="discharge"]');
    const deliverInput = document.querySelector('#armazem-form-container input[name="deliver"]');
    const saldoBadge = document.getElementById('armazem-calc-saldo');
    const entregueBadge = document.getElementById('armazem-badge-entregue');
    if (!saldoBadge) return;
    const discharge = parseFloat(dischargeInput?.value) || 0;
    const deliver = parseFloat(deliverInput?.value) || 0;
    const saldo = Math.max(0, discharge - deliver);
    saldoBadge.innerText = `${saldo} Vol`;
    if (entregueBadge) entregueBadge.innerText = `${deliver} Vol`;
};


export function fillSameClientData() {
    if (!requireProjectDischargeDate()) return;
    const client = window.currentActiveClient;
    if (!client) {
        toast('Nenhum cliente ativo selecionado.', 'warning');
        return;
    }

    const container = document.getElementById('armazem-form-container') || document;
    const deliverToInput = container.querySelector('input[name="deliverTo"]');
    const contactoInput = container.querySelector('input[name="contacto"]');

    const clientName = client.displayName || client.name || '';
    let clientPhone = client.phone || client.contacto || '';
    if (!clientPhone && client.rows && client.rows.length > 0) {
        const columns = state.confirm?.columns || [];
        const cleanString = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
        const phoneIdx = columns.findIndex(c => {
            const h = cleanString(c);
            return h.includes('PHONE') || h.includes('TELEFONE') || h.includes('CELULAR') || h.includes('TEL') || h.includes('CONTACT');
        });
        if (phoneIdx !== -1) {
            for (const r of client.rows) {
                const val = r.originalRow?.[phoneIdx];
                if (val && String(val).trim() !== '' && String(val).trim() !== '—') {
                    clientPhone = String(val).trim();
                    break;
                }
            }
        }
    }

    if (deliverToInput) {
        deliverToInput.value = clientName;
        deliverToInput.classList.add('ring-2', 'ring-indigo-500');
        setTimeout(() => deliverToInput.classList.remove('ring-2', 'ring-indigo-500'), 1500);
    }
    if (contactoInput) {
        contactoInput.value = clientPhone;
        contactoInput.classList.add('ring-2', 'ring-indigo-500');
        setTimeout(() => contactoInput.classList.remove('ring-2', 'ring-indigo-500'), 1500);
    }

    toast(`Dados do próprio cliente preenchidos: ${clientName}`, 'success');
}
window.fillSameClientData = fillSameClientData;

export function toggleViaturaField(checkbox) {
    if (!requireProjectDischargeDate()) {
        if (checkbox) checkbox.checked = !checkbox.checked;
        return;
    }
    const container = checkbox.closest('.col-span-1') || checkbox.closest('.col-span-3') || checkbox.parentElement?.parentElement || document;
    const inputContainer = container.querySelector('#viatura-input-container');
    const hint = container.querySelector('#viatura-badge-hint');
    const input = container.querySelector('input[name="viatura"]');

    if (checkbox.checked) {
        if (inputContainer) inputContainer.classList.remove('hidden');
        if (hint) hint.classList.add('hidden');
        if (input) {
            input.disabled = false;
            input.focus();
        }
    } else {
        if (inputContainer) inputContainer.classList.add('hidden');
        if (hint) hint.classList.remove('hidden');
        if (input) {
            input.value = '';
        }
    }
}
window.toggleViaturaField = toggleViaturaField;

export function toggleIsencao(checkbox) {
    if (!requireProjectDischargeDate()) {
        if (checkbox) checkbox.checked = !checkbox.checked;
        return;
    }
    const container = document.getElementById('armazem-form-container') || document;
    const isencaoFields = container.querySelector('#isencao-fields-container');
    const isencaoHint = container.querySelector('#isencao-active-hint');
    const motivoSelect = container.querySelector('#select-isencao');
    const motivoInput = container.querySelector('input[name="motivoIsencao"]');

    if (checkbox.checked) {
        if (isencaoFields) isencaoFields.classList.remove('hidden');
        if (isencaoHint) isencaoHint.classList.remove('hidden');
        if (motivoSelect) {
            motivoSelect.disabled = false;
            if (!motivoSelect.value) motivoSelect.value = 'Autorização da Direção';
        }
        if (motivoInput) {
            motivoInput.disabled = false;
            if (!motivoInput.value) motivoInput.value = motivoSelect ? motivoSelect.value : 'Isenção autorizada';
            motivoInput.focus();
        }
    } else {
        if (isencaoFields) isencaoFields.classList.add('hidden');
        if (isencaoHint) isencaoHint.classList.add('hidden');
        if (motivoSelect) {
            motivoSelect.disabled = true;
            motivoSelect.value = '';
        }
        if (motivoInput) {
            motivoInput.disabled = true;
            motivoInput.value = '';
        }
    }
    updateArmazemCalculations();
}
window.toggleIsencao = toggleIsencao;

export function handleIsencaoChange(selectEl) {
    if (!requireProjectDischargeDate()) return;
    const container = document.getElementById('armazem-form-container') || document;
    const motivoInput = container.querySelector('input[name="motivoIsencao"]');
    if (!motivoInput) return;

    const val = selectEl.value;
    if (val === 'Outro') {
        motivoInput.value = '';
        motivoInput.focus();
    } else if (val) {
        motivoInput.value = val;
    }
    updateArmazemCalculations();
}
window.handleIsencaoChange = handleIsencaoChange;

export function resetStorageAmount() {
    if (!requireProjectDischargeDate()) return;
    const container = document.getElementById('armazem-form-container') || document;
    const input = container.querySelector('#input-storage-pay-amount');
    if (input) {
        const standard = input.getAttribute('data-standard-cost') || '0';
        input.value = standard;
        updateArmazemCalculations();
        toast('Valor padrão de armazenagem restaurado: ' + formatMZN(parseFloat(standard)), 'info');
    }
}
window.resetStorageAmount = resetStorageAmount;

export function updateArmazemCalculations() {
    const container = document.getElementById('armazem-form-container') || document;
    const isencaoCheckbox = container.querySelector('#check-has-isencao');
    const isencaoFields = container.querySelector('#isencao-fields-container');
    const isencaoHint = container.querySelector('#isencao-active-hint');
    const motivoSelect = container.querySelector('#select-isencao');
    const motivoInput = container.querySelector('input[name="motivoIsencao"]');

    const storagePaymentSection = container.querySelector('#storage-payment-section');
    const storagePayAmountInput = container.querySelector('#input-storage-pay-amount');
    const storagePaidSelect = container.querySelector('select[name="storagePaid"]');
    const storageNegotiateBadge = container.querySelector('#storage-negotiate-badge');

    const badgeSaldo = document.getElementById('armazem-calc-saldo');
    const badgeEntregue = document.getElementById('armazem-badge-entregue');
    const badgeStorage = document.getElementById('armazem-badge-storage-cost');

    // 1. Atualizar contagem de volumes e saldo
    const dischargeInput = container.querySelector('input[name="discharge"]');
    const deliverInput = container.querySelector('input[name="deliver"]');
    if (dischargeInput && deliverInput) {
        const dVal = parseFloat(dischargeInput.value) || 0;
        const eVal = parseFloat(deliverInput.value) || 0;
        if (badgeSaldo) badgeSaldo.textContent = `${Math.max(0, dVal - eVal)} Vol`;
        if (badgeEntregue) badgeEntregue.textContent = `${eVal} Vol`;
    }

    const client = window.currentActiveClient;
    if (!client) return;

    // 2. Calcular dias decorridos e custo padrão (sem parar o relógio até o cliente estar ENTREGUE)
    const storagePayments = window.currentClientStoragePayments || [];
    const isDeliveredVal = container.querySelector('input[name="delivered"]')?.value === 'SIM';
    const deliverDateInput = container.querySelector('input[name="deliverDate"]');
    const storageCalc = calculateClientStorage({
        rows: client.rows,
        columns: state.confirm?.columns || [],
        dischargeDateStr: state.confirm?.dischargeDate || '',
        bankPayments: storagePayments,
        overrides: {
            isDelivered: isDeliveredVal,
            deliverDateVal: deliverDateInput?.value || ''
        }
    });
    const standardCost = storageCalc.standardCost;
    const bankPaidAmount = storageCalc.bankPaidAmount || 0;

    if (storagePayAmountInput) {
        storagePayAmountInput.setAttribute('data-standard-cost', String(standardCost));
    }

    // Sem data de descarga definida: manter todos os controlos do Armazém bloqueados
    if (!hasProjectDischargeDate()) {
        container.querySelectorAll('input, select, button').forEach(el => {
            if (!el.hasAttribute('data-allow-without-discharge')) {
                el.disabled = true;
            }
        });
        if (storagePaymentSection) storagePaymentSection.classList.add('opacity-50', 'pointer-events-none');
        return;
    }

    // 3. Verificar se há Isenção ativa
    const isExempt = isencaoCheckbox && isencaoCheckbox.checked;

    if (isExempt) {
        if (isencaoFields) isencaoFields.classList.remove('hidden');
        if (isencaoHint) isencaoHint.classList.remove('hidden');
        if (motivoSelect) motivoSelect.disabled = false;
        if (motivoInput) motivoInput.disabled = false;

        if (storagePaymentSection) storagePaymentSection.classList.add('hidden');
        if (storagePayAmountInput) {
            storagePayAmountInput.value = '0';
            storagePayAmountInput.disabled = true;
        }
        if (storagePaidSelect) {
            storagePaidSelect.value = 'SIM';
            storagePaidSelect.disabled = true;
        }
        if (storageNegotiateBadge) storageNegotiateBadge.classList.add('hidden');

        if (window.currentClientStorageInfo) {
            window.currentClientStorageInfo.cost = 0;
            window.currentClientStorageInfo.remainingBalance = 0;
            window.currentClientStorageInfo.isPaid = true;
            window.currentClientStorageInfo.isPartial = false;
            window.currentClientStorageInfo.isExempt = true;
        }
        const miniStorageBtn = document.getElementById('btn-confirm-storage-mini');
        if (miniStorageBtn) miniStorageBtn.classList.add('hidden');

        if (badgeStorage) {
            badgeStorage.innerHTML = `Armazenagem: <strong class="ml-1 font-extrabold text-emerald-800">0,00 MT (Isento ✅)</strong>`;
            badgeStorage.className = 'font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200';
        }
        return;
    }

    // 4. Não isento: habilitar secção de pagamento
    if (isencaoFields) isencaoFields.classList.add('hidden');
    if (isencaoHint) isencaoHint.classList.add('hidden');
    if (motivoSelect) motivoSelect.disabled = true;
    if (motivoInput) motivoInput.disabled = true;

    if (storagePaymentSection) storagePaymentSection.classList.remove('opacity-50', 'pointer-events-none');
    if (storagePayAmountInput) storagePayAmountInput.disabled = false;
    if (storagePaidSelect) storagePaidSelect.disabled = false;

    if (standardCost === 0) {
        if (storagePayAmountInput && (!storagePayAmountInput.value || parseFloat(storagePayAmountInput.value) === 0)) {
            storagePayAmountInput.value = '0';
        }
        if (storageNegotiateBadge) storageNegotiateBadge.classList.add('hidden');
        if (storagePaymentSection) storagePaymentSection.classList.add('hidden');

        if (window.currentClientStorageInfo) {
            window.currentClientStorageInfo.cost = 0;
            window.currentClientStorageInfo.remainingBalance = 0;
            window.currentClientStorageInfo.isPaid = true;
            window.currentClientStorageInfo.isPartial = false;
            window.currentClientStorageInfo.isExempt = false;
        }
        const miniStorageBtn = document.getElementById('btn-confirm-storage-mini');
        if (miniStorageBtn) miniStorageBtn.classList.add('hidden');

        if (badgeStorage) {
            badgeStorage.innerHTML = `Armazenagem: <strong class="ml-1 font-extrabold text-emerald-800">0,00 MT (Livre ✅)</strong>`;
            badgeStorage.className = 'font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200';
        }
        return;
    }

    // Se custo padrão > 0, verificar negociação & reconciliação bancária
    let payAmount = storagePayAmountInput ? parseFloat(storagePayAmountInput.value) : standardCost;
    if (isNaN(payAmount) || payAmount < 0) {
        payAmount = standardCost;
        if (storagePayAmountInput) storagePayAmountInput.value = standardCost;
    }

    const isNegotiated = Math.abs(payAmount - standardCost) > 1;
    if (storageNegotiateBadge) {
        if (isNegotiated) {
            storageNegotiateBadge.classList.remove('hidden');
            const diff = standardCost - payAmount;
            storageNegotiateBadge.textContent = diff > 0 ? `🤝 Negociado (-${formatMZN(diff)})` : `🤝 Negociado (+${formatMZN(-diff)})`;
        } else {
            storageNegotiateBadge.classList.add('hidden');
        }
    }

    const selectedStatus = storagePaidSelect ? storagePaidSelect.value : 'NAO';
    const remainingBalance = Math.max(0, payAmount - bankPaidAmount);
    const isPaid = selectedStatus === 'SIM' || (bankPaidAmount >= payAmount - 0.05 && payAmount > 0);
    const isPartial = !isPaid && (selectedStatus === 'PARCIAL' || (bankPaidAmount > 0 && remainingBalance > 0.05));
    const statusText = isPaid ? 'Pago' : (isPartial ? `Parcial - Falta ${formatMZN(remainingBalance)}` : 'Pendente');
    const statusColor = isPaid
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : (isPartial ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-red-50 text-red-700 border-red-200 animate-pulse');

    if (storagePaymentSection) storagePaymentSection.classList.remove('hidden');

    const vincularBtn = container.querySelector('#btn-armazem-vincular-banco');
    if (vincularBtn) {
        const showVincular = !isDeliveredVal && !isExempt && (!isPaid || remainingBalance > 0.05);
        vincularBtn.classList.toggle('hidden', !showVincular);
    }

    if (window.currentClientStorageInfo) {
        window.currentClientStorageInfo.cost = payAmount;
        window.currentClientStorageInfo.paidAmount = isPaid ? payAmount : bankPaidAmount;
        window.currentClientStorageInfo.remainingBalance = isPaid ? 0 : remainingBalance;
        window.currentClientStorageInfo.isPaid = isPaid;
        window.currentClientStorageInfo.isPartial = isPartial;
        window.currentClientStorageInfo.isExempt = false;
        window.currentClientStorageInfo.isNegotiated = isNegotiated;
    }

    const miniStorageBtn = document.getElementById('btn-confirm-storage-mini');
    const miniStorageStatus = document.getElementById('confirm-storage-mini-status');
    if (miniStorageBtn && miniStorageStatus) {
        if (payAmount <= 0 && bankPaidAmount <= 0) {
            miniStorageBtn.classList.add('hidden');
        } else {
            const confirmTab = document.getElementById('btn-tab-confirm');
            if (confirmTab && confirmTab.classList.contains('bg-white')) {
                miniStorageBtn.classList.remove('hidden');
            }
            if (isPartial) {
                miniStorageStatus.innerText = `PARCIAL (FALTA ${formatMZN(remainingBalance)})`;
                miniStorageStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-extrabold';
            } else if (!isPaid) {
                miniStorageStatus.innerText = `PENDENTE (${formatMZN(payAmount)})`;
                miniStorageStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-extrabold animate-pulse';
            } else {
                miniStorageStatus.innerText = `PAGO (${formatMZN(payAmount)})`;
                miniStorageStatus.className = 'text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold';
            }
        }
    }

    if (badgeStorage) {
        badgeStorage.innerHTML = `Armazenagem: <strong class="ml-1 font-extrabold">${formatMZN(payAmount)} (${statusText}${isNegotiated ? ' - Negociado' : ''})</strong>`;
        badgeStorage.className = `font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg border ${statusColor}`;
    }
}
window.updateArmazemCalculations = updateArmazemCalculations;
window.updateArmazemSaldo = updateArmazemCalculations;

export async function renderArmazemDetails(client, totalBalanceFreight, totalAmountFreight, allConfirmed, storagePayments = null, despachoPayments = null) {
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

        let columns = state.confirm?.columns || [];
        const findCol = (targets, opts) => findWarehouseCol(columns, targets, opts);

        // Verificar se todas as colunas base de armazém existem
        const required = ['DISCHARGE', 'DELIVER', 'DELIVER DATE', 'DELIVER TO', 'CONTACTO', 'STORAGE PAID', 'DELIVERED'];
        const hasAll = required.every(req => findCol(req === 'CONTACTO' ? ['CONTACTO', 'CONTACT'] : [req]) !== -1);

        if (!hasAll) {
            container.innerHTML = `
                <div class="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center">
                    <p class="text-xs font-bold text-slate-500 mb-4 uppercase">Para gerir o Armazém e custos, é necessário criar as colunas de controlo (Discharge, Deliver, Deliver Date, Deliver To, Contacto, Storage Paid, Storage Value, Delivered) no GSheet.</p>
                    <button onclick="window.checkAndCreateWarehouseColumns()" class="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer">
                        Criar Colunas de Armazém
                    </button>
                </div>
            `;
            return;
        }

        // Inserir automaticamente STORAGE VALUE logo após STORAGE PAID caso falte numa folha existente
        if (findCol(['STORAGE VALUE', 'VALOR ARMAZENAGEM', 'ARMAZENAGEM VALOR', 'STORAGE_VALUE']) === -1) {
            const sheetKey = state.confirm?.sheetId || 'local';
            window._storageValueEnsureAttempted = window._storageValueEnsureAttempted || {};
            if (!window._storageValueEnsureAttempted[sheetKey]) {
                window._storageValueEnsureAttempted[sheetKey] = true;
                try {
                    await ensureStorageValueColumn();
                    columns = state.confirm?.columns || columns;
                } catch (svErr) {
                    console.warn('[WAREHOUSE] Aviso ao garantir coluna STORAGE VALUE:', svErr);
                }
            }
        }

        const orderNumIdx = findCol(['HF2', 'REF', 'REFERENCIA', 'ORDER NUMBER', 'ORDER NUM', 'ORDER', 'CONV', 'CONTENTOR', 'Nº HF2', 'Nº ORDEM', 'NO.', 'N.O', 'N.º', 'Nº', 'N°', 'NO']);
        const packagesIdx = findCol(['PACKAGES']);
        const dischargeIdx = findCol(['DISCHARGE']);
        const deliverIdx = findCol(['DELIVER']);
        const deliverDateIdx = findCol(['DELIVER DATE']);
        const deliverToIdx = findCol(['DELIVER TO']);
        const contactoIdx = findCol(['CONTACTO', 'CONTACT']);
        const storagePaidIdx = findCol(['STORAGE PAID', 'ARMAZENAGEM PAGO', 'STORAGE_PAID']);
        const deliveredIdx = findCol(['DELIVERED', 'ENTREGUE', 'STATUS ENTREGA', 'DELIVERY STATUS']);
        const motivoIsencaoIdx = findCol(['MOTIVO ISENCAO ARMAZENAGEM', 'MOTIVO ISENCAO', 'MOTIVO DE ISENCAO']);
        const contactNoteIdx = findCol(['NOTA CONTACTO', 'ESTADO CONTACTO', 'OBS CONTACTO', 'NOTA ARMAZEM', 'OBS ARMAZEM', 'CONTACT NOTE']);
        const viaturaIdx = findCol(['VIATURA', 'MATRICULA', 'VIATURA MATRICULA', 'PLACA', 'CARRO', 'VEICULO', 'VEHICLE']);

        // Regras de negócio para autorização de entrega:
        const isDutyConfirmed = allConfirmed;
        const totalPaidFrt = (window.currentClientRows || []).reduce((acc, r) => acc + (r.pdFreight || 0), 0);
        const isFreightPaid = totalBalanceFreight <= 0 || (totalAmountFreight > 0 && totalPaidFrt >= totalAmountFreight);

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
        const motivoIsencaoVal = motivoIsencaoIdx !== -1 ? (firstRowData[motivoIsencaoIdx] || '') : '';
        const contactNoteVal = contactNoteIdx !== -1 ? (firstRowData[contactNoteIdx] || '') : (client.contactNote || '');
        const viaturaVal = viaturaIdx !== -1 ? (firstRowData[viaturaIdx] || '') : (client.viatura || '');
        const storagePaidVal = storagePaidIdx !== -1 ? String(firstRowData[storagePaidIdx] || '').trim().toUpperCase() : 'NAO';
        const deliveredVal = deliveredIdx !== -1 ? String(firstRowData[deliveredIdx] || '').trim().toUpperCase() : 'NAO';
        const isDelivered = (deliveredVal === 'SIM' || deliveredVal === 'ENTREGUE' || deliveredVal === 'YES');
        const isExtraordinaria = String(motivoIsencaoVal).includes('[EXTRAORDINÁRIA]');
        const allowDelivery = isExtraordinaria || (isDutyConfirmed && isFreightPaid);

        // --- CÁLCULO UNIFICADO DE CUSTO DE ARMAZENAGEM ---
        const dischargeDateStr = state.confirm?.dischargeDate || '';
        const hasDischargeDate = hasValidDischargeDate(dischargeDateStr);
        const effectiveStoragePmts = Array.isArray(storagePayments)
            ? storagePayments
            : (window.currentClientStoragePayments || []);
        window.currentClientStoragePayments = effectiveStoragePmts;

        const storageCalc = calculateClientStorage({
            rows: client.rows,
            columns,
            dischargeDateStr,
            bankPayments: effectiveStoragePmts
        });

        const isAnticipated = storageCalc.isAnticipated;
        const daysDiff = storageCalc.daysDiff;
        const standardStorageCost = storageCalc.standardCost;
        const bankPaidAmount = storageCalc.bankPaidAmount || 0;
        client.isAnticipated = isAnticipated;

        const storageInfo = storageCalc.storageInfo;
        window.currentClientStorageInfo = storageInfo;

        const effectiveDespachoPmts = Array.isArray(despachoPayments)
            ? despachoPayments
            : (window.currentClientDespachoPayments || []);
        window.currentClientDespachoPayments = effectiveDespachoPmts;

        const defaultDespachoPrice = getDespachoCopyDefaultPrice();
        const despachoCalc = calculateClientDespachoCopy({
            rows: client.rows,
            columns,
            defaultPrice: defaultDespachoPrice,
            bankPayments: effectiveDespachoPmts
        });
        window.currentClientDespachoInfo = despachoCalc;

        const buildDespachoCopyCardHtml = () => {
            const linkedRowsHtml = effectiveDespachoPmts.length > 0
                ? `
                    <div class="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                        <span class="text-[9px] font-black uppercase text-slate-400">Pagamentos Bancários Vinculados:</span>
                        ${effectiveDespachoPmts.map(p => {
                            const refClean = String(p.reference || p.description || '—').replace(/\[Vinculado:[^\]]+\]/g, '').trim();
                            const dt = p.date ? p.date.split(' ')[0] : '—';
                            return `<span class="inline-flex items-center gap-1.5 text-[9.5px] font-bold bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-lg" title="${refClean.replace(/"/g, '&quot;')}">
                                <span>🏦 ${getPaymentBankDisplay(p)}</span>
                                <span class="text-teal-500">•</span>
                                <span class="font-mono text-[9px]">${dt}</span>
                                <span class="text-teal-500">•</span>
                                <span class="font-black">${formatMZN(p.amount)}</span>
                            </span>`;
                        }).join('')}
                    </div>
                `
                : '';

            let statusBadgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
            let statusBadgeText = 'Opcional / Não Solicitada';
            if (despachoCalc.isRequested) {
                if (despachoCalc.isPaid) {
                    statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    statusBadgeText = `Pago (${formatMZN(despachoCalc.cost)})`;
                } else if (despachoCalc.isPartial) {
                    statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                    statusBadgeText = `Parcial • Falta ${formatMZN(despachoCalc.remainingBalance)}`;
                } else {
                    statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse';
                    statusBadgeText = `Pendente (${formatMZN(despachoCalc.cost)})`;
                }
            }

            const inputAmtVal = despachoCalc.isRequested ? despachoCalc.cost : defaultDespachoPrice;
            const showVincularDespacho = hasDischargeDate && despachoCalc.isRequested && despachoCalc.cost > 0 && (!despachoCalc.isPaid || despachoCalc.remainingBalance > 0.05);
            const despachoControlsDisabled = !hasDischargeDate || !despachoCalc.isRequested;

            return `
                <div id="despacho-copy-card" class="${!hasDischargeDate ? 'bg-slate-50/70 opacity-75' : 'bg-white'} border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3.5 mt-4">
                    <div class="flex items-center justify-between flex-wrap gap-2.5 border-b border-slate-100 pb-3">
                        <div class="flex items-center gap-2.5 flex-wrap">
                            <span class="p-1.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/80">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                            </span>
                            <div>
                                <h4 class="font-black text-xs uppercase tracking-wider text-slate-700">Cópia de Despacho (Opcional)</h4>
                                <p class="text-[10px] text-slate-400 font-semibold">Pagamento adicional caso o cliente solicite a cópia do despacho</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            ${!hasDischargeDate ? '<span class="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-lg border bg-amber-50 text-amber-800 border-amber-200">🔒 Requer Data de Descarga</span>' : ''}
                            <button type="button" id="btn-despacho-config-toggle" onclick="ui.toggleDespachoConfigRow()"
                                ${!hasDischargeDate ? 'disabled' : ''}
                                class="text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg border border-slate-200 transition-all inline-flex items-center gap-1 ${!hasDischargeDate ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer'}"
                                title="${!hasDischargeDate ? 'Defina a Data de Descarga primeiro' : 'Alterar o valor padrão pré-definido da Cópia de Despacho'}">
                                <span>Valor padrão: <strong id="despacho-default-price-label" class="text-slate-800">${formatMZN(defaultDespachoPrice)}</strong></span>
                                <span>⚙️</span>
                            </button>
                            <span id="despacho-status-badge" class="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-lg border ${statusBadgeClass}">
                                ${statusBadgeText}
                            </span>
                        </div>
                    </div>

                    <div id="despacho-default-config-row" class="hidden bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between flex-wrap gap-2">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-black uppercase text-slate-600">Valor Pré-definido (MZN):</span>
                            <input type="number" id="input-despacho-default-price" value="${defaultDespachoPrice}" min="0" step="50"
                                ${!hasDischargeDate ? 'disabled' : ''}
                                class="w-28 text-center py-1.5 px-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-teal-500 disabled:bg-slate-100 disabled:text-slate-400">
                        </div>
                        <div class="flex items-center gap-1.5">
                            <button type="button" id="btn-despacho-apply-default" onclick="ui.applyDespachoDefaultPrice()"
                                ${!hasDischargeDate ? 'disabled' : ''}
                                class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-[9px] font-black uppercase cursor-pointer transition-all">
                                Aplicar Padrão
                            </button>
                            <button type="button" onclick="ui.toggleDespachoConfigRow()"
                                class="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-[9px] font-bold uppercase cursor-pointer">
                                Fechar
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div class="col-span-1 md:col-span-4">
                            <label class="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl transition-all w-full ${!hasDischargeDate ? 'cursor-not-allowed opacity-60' : 'hover:bg-teal-50/40 cursor-pointer'}">
                                <input type="checkbox" id="check-despacho-solicitado" ${despachoCalc.isRequested ? 'checked' : ''}
                                    ${!hasDischargeDate ? 'disabled' : ''}
                                    onchange="ui.updateDespachoCardCalculations()"
                                    class="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 ${!hasDischargeDate ? 'cursor-not-allowed' : 'cursor-pointer'}">
                                <span class="text-[10.5px] font-black uppercase text-slate-700">Cliente solicitou cópia</span>
                            </label>
                        </div>

                        <div id="despacho-fields-wrap" class="col-span-1 md:col-span-5 flex items-center gap-2 ${despachoControlsDisabled ? 'opacity-50' : ''}">
                            <div class="flex-1 min-w-[95px]">
                                <label class="block text-[8.5px] font-black uppercase text-slate-400 mb-1">Valor (MZN)</label>
                                <input type="number" id="input-despacho-amount" value="${inputAmtVal}" min="0" step="50"
                                    data-user-edited="${despachoCalc.isCustomAmount ? 'true' : 'false'}"
                                    oninput="this.dataset.userEdited='true'; ui.updateDespachoCardCalculations()"
                                    ${despachoControlsDisabled ? 'disabled' : ''}
                                    class="w-full text-center py-1.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:border-teal-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
                            </div>
                            <div class="w-[120px] shrink-0">
                                <label class="block text-[8.5px] font-black uppercase text-slate-400 mb-1">Estado</label>
                                <select id="select-despacho-paid" onchange="ui.updateDespachoCardCalculations()"
                                    ${despachoControlsDisabled ? 'disabled' : ''}
                                    class="w-full text-center py-1.5 px-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold focus:border-teal-500 outline-none transition-all ${despachoCalc.isPaid ? 'text-emerald-700 bg-emerald-50' : (despachoCalc.isPartial ? 'text-amber-800 bg-amber-50' : 'text-slate-700')} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
                                    <option value="NAO" ${(!despachoCalc.isPaid && !despachoCalc.isPartial) ? 'selected' : ''}>❌ PENDENTE</option>
                                    <option value="PARCIAL" ${despachoCalc.isPartial ? 'selected' : ''}>⏳ PARCIAL</option>
                                    <option value="SIM" ${despachoCalc.isPaid ? 'selected' : ''}>✅ PAGO</option>
                                </select>
                            </div>
                            <span id="despacho-remaining-label" class="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 self-end mb-0.5 ${(despachoCalc.isRequested && despachoCalc.cost > 0 && despachoCalc.remainingBalance > 0.05) ? '' : 'hidden'}">
                                Falta: ${formatMZN(despachoCalc.remainingBalance)}
                            </span>
                        </div>

                        <div class="col-span-1 md:col-span-3 flex items-center justify-end gap-1.5 flex-wrap">
                            <button type="button" id="btn-despacho-guardar" onclick="ui.saveDespachoCopy(this)"
                                ${!hasDischargeDate ? 'disabled' : ''}
                                class="px-3 py-2 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all shadow-xs flex items-center gap-1 h-[34px] ${!hasDischargeDate ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 text-white active:scale-95 cursor-pointer'}"
                                title="${!hasDischargeDate ? 'Defina a Data de Descarga primeiro' : 'Gravar estado e valor da Cópia de Despacho na planilha'}">
                                <span>Guardar</span>
                            </button>
                            <button type="button" id="btn-despacho-vincular-banco" onclick="ui.vincularPagamentoDespacho()"
                                class="${showVincularDespacho ? '' : 'hidden'} px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1 h-[34px]"
                                title="Vincular pagamento bancário da Cópia de Despacho">
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                <span>Vincular</span>
                            </button>
                        </div>
                    </div>

                    ${linkedRowsHtml}
                </div>
            `;
        };
        const despachoCopyCardHtml = buildDespachoCopyCardHtml();
        const isExempt = storageInfo.isExempt;
        const isNegotiated = storageInfo.isNegotiated;
        const storageCost = storageInfo.cost;
        const isStoragePaid = storageInfo.isPaid;
        const isStoragePartial = storageInfo.isPartial;
        const storageRemaining = storageInfo.remainingBalance;
        const isStorageBlocked = storageCost > 0 && !isStoragePaid && !isExempt;

        const hasDeliveryInfoSaved = totalDelivered > 0 && 
                                     String(deliverDateVal).trim() !== '' && 
                                     String(deliverDateVal).trim() !== '—' &&
                                     String(deliverToVal).trim() !== '' && 
                                     String(deliverToVal).trim() !== '—' &&
                                     String(contactoVal).trim() !== '' && 
                                     String(contactoVal).trim() !== '—';

        const canEmitGuia = allowDelivery && !isStorageBlocked;
        const isEditable = !isDelivered && hasDischargeDate;

        const formatDateForDisplay = (dateStr) => {
            if (!dateStr) return '';
            const p = parseDate(dateStr);
            return p ? p.toLocaleDateString('pt-PT') : dateStr;
        };

        const dischargeMissingBannerHtml = !hasDischargeDate ? `
            <div class="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-3xl flex items-start gap-3 border-l-4 border-l-amber-500">
                <div class="p-2 bg-amber-100 rounded-xl text-amber-600 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </div>
                <div>
                    <h4 class="font-black text-xs uppercase tracking-wider text-amber-900">Data de Descarga Não Definida 🔒</h4>
                    <p class="text-[11px] text-amber-800 font-semibold mt-1">Os campos da aba de Armazém permanecem bloqueados até que a <strong>Data de Descarga</strong> seja definida na disponibilização da carga.</p>
                </div>
            </div>
        ` : '';

        let bannerHtml = '';
        if (isDelivered) {
            bannerHtml = `
                ${dischargeMissingBannerHtml ? `<div class="mb-3">${dischargeMissingBannerHtml}</div>` : ''}
                <div class="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-3xl flex items-start gap-3 border-l-4 border-l-emerald-500">
                    <div class="p-2 bg-emerald-100 rounded-xl text-emerald-600 flex-shrink-0">
                        <svg class="w-5 h-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h4 class="font-black text-xs uppercase tracking-wider text-emerald-900">Carga Entregue ✅</h4>
                        <p class="text-[11px] text-emerald-700 font-semibold mt-1">A entrega desta carga foi confirmada e encerrada. Pode reimprimir a <strong>Guia Dupla (Armazém e Portaria)</strong> a qualquer momento.</p>
                    </div>
                </div>
            `;
        } else if (!hasDischargeDate && allowDelivery) {
            bannerHtml = dischargeMissingBannerHtml;
        } else if (allowDelivery) {
            if (isExtraordinaria) {
                const motivoExtraMatch = String(motivoIsencaoVal).match(/\[EXTRAORDINÁRIA\](.*)/);
                const motivoExtra = motivoExtraMatch ? motivoExtraMatch[1].trim() : 'Autorização forçada manual';
                bannerHtml = `
                    <div class="bg-orange-50 border border-orange-200 text-orange-900 p-4 rounded-3xl flex items-start gap-3 border-l-4 border-l-orange-500">
                        <div class="p-2 bg-orange-100 rounded-xl text-orange-600 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-wider text-orange-900">Entrega Extraordinária Ativa ⚠️</h4>
                            <p class="text-[11px] text-orange-800 font-semibold mt-1">A entrega foi forçada manualmente por um administrador.<br>Motivo: <strong>${motivoExtra}</strong>. A Guia Dupla pode ser emitida.</p>
                        </div>
                    </div>
                `;
            } else if (storageCost > 0 && !isStoragePaid && !isExempt) {
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
                    <div class="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-3xl flex items-start gap-3 border-l-4 border-l-emerald-500">
                        <div class="p-2 bg-emerald-100 rounded-xl text-emerald-600 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-wider text-emerald-900">Dados Gravados — Pronto para Entrega ✅</h4>
                            <p class="text-[11px] text-emerald-700 font-semibold mt-1">Dados operacionais registados com sucesso. Clique em <strong>Entregue</strong> para confirmar a entrega e desbloquear a Guia Dupla.</p>
                        </div>
                    </div>
                `;
            } else {
                bannerHtml = `
                    <div class="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-3xl flex items-start gap-3 border-l-4 border-l-blue-500">
                        <div class="p-2 bg-blue-100 rounded-xl text-blue-600 flex-shrink-0">
                            <svg class="w-5 h-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-wider text-blue-900">Preenchimento de Armazém</h4>
                            <p class="text-[11px] text-blue-700 font-semibold mt-1">Preencha os dados operacionais da carga e clique em <strong>Gravar</strong> para avançar para a confirmação de entrega.</p>
                        </div>
                    </div>
                `;
            }
        } else {
            bannerHtml = `
                ${dischargeMissingBannerHtml ? `<div class="mb-3">${dischargeMissingBannerHtml}</div>` : ''}
                <div class="bg-red-50 border border-red-200 text-red-800 p-4 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-l-4 border-l-red-500">
                    <div class="flex items-start gap-3">
                        <div class="p-2 bg-red-100 rounded-xl text-red-600 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <div>
                            <h4 class="font-black text-xs uppercase tracking-wider text-red-900">Entrega Bloqueada 🔒</h4>
                            <p class="text-[11px] text-red-700 font-bold mt-1">A carga não pode ser entregue até que as pendências sejam resolvidas:</p>
                            <ul class="list-disc pl-5 mt-1 text-[11px] text-red-700 font-bold space-y-0.5">
                                ${!isDutyConfirmed ? '<li>Os Direitos Aduaneiros (Duty) não estão totalmente CONFIRMADOS.</li>' : ''}
                                ${!isFreightPaid ? '<li>O Frete não está totalmente PAGO (Saldo pendente).</li>' : ''}
                                ${(!isStoragePaid && storageCost > 0) ? `${(!isStoragePaid && storageCost > 0 && !isExempt) ? `<li>Armazenagem acumulada pendente: <strong>${formatMZN(storageCost)}</strong>.</li>` : ''}` : ''}
                            </ul>
                        </div>
                    </div>
                    ${isAdmin ? `
                    <button onclick="ui.forceExtraordinaryDelivery(${firstRowIndex}, this)"
                        ${!hasDischargeDate ? 'disabled title="Defina a Data de Descarga primeiro"' : ''}
                        class="${!hasDischargeDate ? 'bg-red-300 opacity-60 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95 cursor-pointer'} text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 flex-shrink-0 mt-3 md:mt-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        Forçar Entrega Extraordinária
                    </button>
                    ` : ''}
                </div>
            `;
        }

        const adminPrinterBtnHtml = isAdmin ? `
            <button data-allow-without-discharge="true" onclick="ui.openQuickPrinterModal()" 
                class="w-9 h-[38px] bg-slate-800 hover:bg-slate-900 text-slate-200 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0 border border-slate-700" title="Configurar Impressora Ativa (Armazém)">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
        ` : '';

        let buttonsHtml = '';
        const btnSpan = (storageCost === 0 && !isNegotiated) ? 'md:col-span-3' : 'md:col-span-2';
        
        if (isDelivered) {
            // Passo 3: Entregue confirmado -> Aparece a Guia Dupla e apenas ela fica ativa
            buttonsHtml = `
                <div class="${btnSpan} flex gap-1.5 flex-wrap md:flex-nowrap">
                    ${isAdmin ? `
                        <button onclick="ui.reopenDelivery(${firstRowIndex}, this)" 
                            class="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer h-[38px]" title="Reabrir edição da entrega">
                            <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                            Reabrir
                        </button>
                    ` : ''}
                    <button onclick="${canEmitGuia ? 'ui.printDeliveryNote()' : 'ui.toast(\'Bloqueado: A entrega não está autorizada.\', \'warning\')'}" 
                        class="flex-1 py-2 px-3 ${canEmitGuia ? 'bg-green-600 hover:bg-green-700 cursor-pointer' : 'bg-gray-400 cursor-not-allowed opacity-50'} text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 h-[38px]" title="${canEmitGuia ? 'Emitir Guia Dupla (Armazém e Portaria)' : 'Bloqueado: Regularize Duty, Frete ou Armazenagem'}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path><path d="M12 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V2"></path></svg>
                        Guia Dupla
                    </button>
                    ${adminPrinterBtnHtml}
                </div>
            `;
        } else if (!hasDischargeDate) {
            buttonsHtml = `
                <div class="${btnSpan} flex gap-1.5 flex-wrap md:flex-nowrap">
                    <button type="button" disabled
                        class="flex-1 py-2 px-3 bg-slate-300 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-not-allowed opacity-70 h-[38px]" title="Bloqueado: Aguardando definição da Data de Descarga">
                        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        Gravar (Bloqueado)
                    </button>
                    ${adminPrinterBtnHtml}
                </div>
            `;
        } else {
            if (!hasDeliveryInfoSaved) {
                // Passo 1: Não gravado / Inicial -> Apenas o botão Gravar
                buttonsHtml = `
                    <div class="${btnSpan} flex gap-1.5 flex-wrap md:flex-nowrap">
                        <button onclick="ui.saveArmazemRow(${firstRowIndex}, this)" 
                            class="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer h-[38px]" title="Gravar dados operacionais de armazém">
                            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            Gravar
                        </button>
                        ${adminPrinterBtnHtml}
                    </div>
                `;
            } else {
                // Passo 2: Tudo gravado -> Aparece o botão Entregue
                buttonsHtml = `
                    <div class="${btnSpan} flex gap-1.5 flex-wrap md:flex-nowrap">
                        <button onclick="ui.confirmDelivery(${firstRowIndex}, this)" 
                            class="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer h-[38px]" title="Confirmar entrega da carga e encerrar edição">
                            <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            Entregue
                        </button>
                        <button onclick="ui.saveArmazemRow(${firstRowIndex}, this)" 
                            class="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer h-[38px]" title="Atualizar dados operacionais">
                            <svg class="w-3.5 h-3.5 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            Actualizar
                        </button>
                        ${adminPrinterBtnHtml}
                    </div>
                `;
            }
        }

        // Badges de Armazenagem
        const dischargeDateBadge = `
            <span class="font-bold uppercase text-[9px] bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200 inline-flex items-center gap-1 select-none" title="Data de Descarga definida na disponibilização da carga">
                Descarga: <strong class="text-amber-900 font-extrabold">${hasDischargeDate ? formatDateForDisplay(dischargeDateStr) : 'NÃO DEFINIDA ⚠️'}</strong>
            </span>
        `;

        let storageBadgesHtml = '';
        if (hasDischargeDate) {
            if (isExempt) {
                storageBadgesHtml = `
                    <span class="text-slate-400 font-bold uppercase text-[9px] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        Dias: <strong class="text-slate-700 ml-1 font-extrabold">${daysDiff}d</strong>
                    </span>
                    <span id="armazem-badge-storage-cost" class="font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200">
                        Armazenagem: <strong class="ml-1 font-extrabold text-emerald-800">0,00 MT (Isento ✅)</strong>
                    </span>
                `;
            } else if (storageCost > 0 || standardStorageCost > 0) {
                const statusColor = isStoragePaid
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : (isStoragePartial ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-red-50 text-red-700 border-red-200 animate-pulse');
                const textStatus = isStoragePaid ? 'Pago' : (isStoragePartial ? `Parcial - Falta ${formatMZN(storageRemaining)}` : 'Pendente');
                storageBadgesHtml = `
                    <span class="text-slate-400 font-bold uppercase text-[9px] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        Dias: <strong class="text-slate-700 ml-1 font-extrabold">${daysDiff}d</strong>
                    </span>
                    <span class="text-slate-400 font-bold uppercase text-[9px] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        Tarifa: <strong class="text-slate-700 ml-1 font-extrabold">${isAnticipated ? 'Antecipado' : 'Normal/Multa'}</strong>
                    </span>
                    <span id="armazem-badge-storage-cost" class="font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg border ${statusColor}">
                        Armazenagem: <strong class="ml-1 font-extrabold">${formatMZN(storageCost)} (${textStatus}${isNegotiated ? ' - Negociado' : ''})</strong>
                    </span>
                `;
            } else {
                storageBadgesHtml = `
                    <span class="text-slate-400 font-bold uppercase text-[9px] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        Dias: <strong class="text-slate-700 ml-1 font-extrabold">${daysDiff}d</strong>
                    </span>
                    <span id="armazem-badge-storage-cost" class="font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200">
                        Armazenagem: <strong class="ml-1 font-extrabold text-emerald-800">0,00 MT (Livre ✅)</strong>
                    </span>
                `;
            }
        }

        const deliveryStatusBadge = `
            <span class="font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg border ${isDelivered ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}">
                Entrega: <strong class="ml-1 font-extrabold text-[9px]">${isDelivered ? 'ENTREGUE ✅' : 'PENDENTE'}</strong>
            </span>
        `;

        // Preservar valores já digitados pelo operador no formulário se ainda não tiverem sido gravados
        let draftValues = null;
        const currentForm = container.querySelector('#armazem-form-container');
        if (currentForm && hasDischargeDate) {
            const hasFocus = currentForm.contains(document.activeElement);
            const activeId = document.activeElement ? (document.activeElement.name || document.activeElement.id) : null;
            const selStart = document.activeElement?.selectionStart;
            const selEnd = document.activeElement?.selectionEnd;

            const dIn = currentForm.querySelector('input[name="discharge"]')?.value;
            const delIn = currentForm.querySelector('input[name="deliver"]')?.value;
            const dateIn = currentForm.querySelector('input[name="deliverDate"]')?.value;
            const toIn = currentForm.querySelector('input[name="deliverTo"]')?.value;
            const contIn = currentForm.querySelector('input[name="contacto"]')?.value;
            const viatIn = currentForm.querySelector('input[name="viatura"]')?.value;
            const hasViat = currentForm.querySelector('#check-has-viatura')?.checked;
            const hasIsenc = currentForm.querySelector('#check-has-isencao')?.checked;
            const isencSel = currentForm.querySelector('#select-isencao')?.value;
            const isencMot = currentForm.querySelector('input[name="motivoIsencao"]')?.value;
            const noteIn = currentForm.querySelector('input[name="notaContacto"]')?.value;
            const payAmtIn = currentForm.querySelector('#input-storage-pay-amount')?.value;
            const paySelIn = currentForm.querySelector('select[name="storagePaid"]')?.value;

            if (hasFocus || delIn || dateIn || toIn || contIn || viatIn || hasIsenc || noteIn) {
                draftValues = {
                    discharge: dIn,
                    deliver: delIn,
                    deliverDate: dateIn,
                    deliverTo: toIn,
                    contacto: contIn,
                    viatura: viatIn,
                    hasViatura: hasViat,
                    hasIsencao: hasIsenc,
                    isencaoSelect: isencSel,
                    isencaoMotivo: isencMot,
                    notaContacto: noteIn,
                    storagePayAmount: payAmtIn,
                    storagePaid: paySelIn,
                    activeId,
                    selStart,
                    selEnd
                };
            }
        }

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
                            Total Carga: <strong class="text-indigo-900 ml-1 font-extrabold">${parseFloat(dischargeVal) || totalOriginal || 0} Vol</strong>
                        </span>
                        <span class="text-slate-400 font-bold uppercase text-[9px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg">
                            Entregue: <strong class="text-emerald-900 ml-1 font-extrabold" id="armazem-badge-entregue">${deliverVal || '0'} Vol</strong>
                        </span>
                        <span class="text-slate-400 font-bold uppercase text-[9px] bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                            Saldo em Armazém: <strong class="text-amber-900 ml-1 font-extrabold" id="armazem-calc-saldo">${Math.max(0, (parseFloat(dischargeVal || totalOriginal) || 0) - (parseFloat(deliverVal) || 0))} Vol</strong>
                        </span>
                        ${dischargeDateBadge}
                        ${storageBadgesHtml}
                        ${deliveryStatusBadge}
                    </div>
                </div>
                
                <div id="armazem-form-container" class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-100 ${!hasDischargeDate ? 'opacity-70' : ''}">
                    <!-- Linha 1: Informações de Carga & Destinatário -->
                    <div class="col-span-1 md:col-span-2">
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Descarregado</label>
                        <input type="number" name="discharge" value="${dischargeVal}" placeholder="Qtd" 
                            oninput="window.updateArmazemCalculations()"
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full text-center py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-normal focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                    </div>
                    <div class="col-span-1 md:col-span-2">
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5 flex items-center justify-between">
                            <span>Entregue (Manual)</span>
                            <span class="text-[8px] text-indigo-600 font-bold">Qtd</span>
                        </label>
                        <input type="number" name="deliver" value="${deliverVal}" placeholder="Qtd" 
                            oninput="window.updateArmazemCalculations()"
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full text-center py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'text-slate-800'}">
                    </div>
                    <div class="col-span-1 md:col-span-2">
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Data Entrega</label>
                        <input type="date" name="deliverDate" value="${formatDateForInput(deliverDateVal)}" data-user-edited="false"
                            oninput="this.dataset.userEdited='true'"
                            onchange="this.dataset.userEdited='true'; window.updateArmazemCalculations()"
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full text-center py-2 px-2 bg-white border border-slate-200 rounded-xl text-[11px] font-normal focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                    </div>
                    <div class="col-span-1 md:col-span-3">
                        <div class="flex items-center justify-between mb-1.5">
                            <label class="block text-[9px] font-black uppercase text-slate-400">Entregue A</label>
                            ${isEditable ? `
                            <button type="button" onclick="ui.fillSameClientData()" 
                                class="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-xs"
                                title="Puxar nome e telefone do próprio cliente">
                                <svg class="w-2.5 h-2.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                <span>Próprio Cliente</span>
                            </button>
                            ` : ''}
                        </div>
                        <input type="text" name="deliverTo" value="${deliverToVal}" placeholder="Nome do Destinatário" 
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-normal focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                    </div>
                    <div class="col-span-1 md:col-span-3">
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Contacto</label>
                        <input type="text" name="contacto" value="${contactoVal}" placeholder="Contacto" 
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-normal focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                    </div>

                    <!-- Linha 2: Veículo, Isenção, Armazenagem e Notas -->
                    <div class="col-span-1 md:col-span-3">
                        <div class="flex items-center justify-between mb-1.5">
                            <label class="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-500 ${!isEditable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-indigo-600'} transition-colors">
                                <input type="checkbox" id="check-has-viatura" onchange="ui.toggleViaturaField(this)" ${viaturaVal ? 'checked' : ''} ${!isEditable ? 'disabled' : ''} class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 ${!isEditable ? 'cursor-not-allowed' : 'cursor-pointer'}">
                                <span>🚗 Veículo / Matrícula</span>
                            </label>
                            <span class="text-[8px] text-slate-400 font-bold ${viaturaVal ? 'hidden' : ''}" id="viatura-badge-hint">(A pé / Sem carro)</span>
                        </div>
                        <div id="viatura-input-container" class="${viaturaVal ? '' : 'hidden'}">
                            <input type="text" name="viatura" value="${viaturaVal}" placeholder="Ex: ABC-123-MC / Toyota" 
                                ${!isEditable ? 'disabled' : ''}
                                class="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-normal focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                        </div>
                    </div>

                    <div class="col-span-1 md:col-span-4">
                        <div class="flex items-center justify-between mb-1.5">
                            <label class="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-500 ${!isEditable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-indigo-600'} transition-colors">
                                <input type="checkbox" id="check-has-isencao" onchange="ui.toggleIsencao(this)" ${isExempt ? 'checked' : ''} ${!isEditable ? 'disabled' : ''} class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 ${!isEditable ? 'cursor-not-allowed' : 'cursor-pointer'}">
                                <span>🎁 Adicionar Isenção (0 MT)</span>
                            </label>
                            <span class="text-[8px] text-emerald-600 font-bold ${isExempt ? '' : 'hidden'}" id="isencao-active-hint">✅ Armazenagem = 0 MT</span>
                        </div>
                        <div id="isencao-fields-container" class="${isExempt ? '' : 'hidden'} flex gap-1.5">
                            <select id="select-isencao" onchange="ui.handleIsencaoChange(this)"
                                ${!isEditable || !isExempt ? 'disabled' : ''}
                                class="w-[125px] py-1.5 px-2 bg-white border border-slate-200 rounded-xl text-[9px] font-bold uppercase tracking-wider focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'text-indigo-700'}">
                                <option value="">Motivo...</option>
                                <option value="Atraso no Despacho" ${motivoIsencaoVal.includes('Atraso no Despacho') ? 'selected' : ''}>Atraso no Despacho</option>
                                <option value="Autorização da Direção" ${motivoIsencaoVal.includes('Autorização da Direção') ? 'selected' : ''}>Autorização Dir.</option>
                                <option value="Erro de Sistema" ${motivoIsencaoVal.includes('Erro de Sistema') ? 'selected' : ''}>Erro Sistema</option>
                                <option value="Outro" ${motivoIsencaoVal && !motivoIsencaoVal.includes('Atraso no Despacho') && !motivoIsencaoVal.includes('Autorização') && !motivoIsencaoVal.includes('Erro de Sistema') ? 'selected' : ''}>Outro</option>
                            </select>
                            <input type="text" name="motivoIsencao" value="${motivoIsencaoVal}" placeholder="Descreva o motivo da isenção..." 
                                ${!isEditable || !isExempt ? 'disabled' : ''}
                                oninput="window.updateArmazemCalculations()"
                                class="flex-1 py-1.5 px-3 bg-white border border-slate-200 rounded-xl text-[10px] font-normal focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                        </div>
                    </div>

                    <div id="storage-payment-section" class="col-span-1 md:col-span-3 ${isExempt || (storageCost === 0 && !isNegotiated) ? 'hidden' : ''}">
                        <div class="flex items-center justify-between mb-1.5 gap-1">
                            <label class="block text-[9px] font-black uppercase text-slate-400">Armazenagem (MZN)</label>
                            <div class="flex items-center gap-1">
                                ${bankPaidAmount > 0 ? `<span class="text-[8px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200" title="Valor já vinculado ao extrato bancário">🏦 ${formatMZN(bankPaidAmount)}</span>` : ''}
                                <span id="storage-negotiate-badge" class="text-[8px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 ${isNegotiated ? '' : 'hidden'}">
                                    🤝 Negociado
                                </span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <div class="relative flex-1 min-w-[78px]">
                                <input type="number" id="input-storage-pay-amount" name="storagePayAmount" 
                                    value="${isExempt ? 0 : storageCost}" min="0" step="100" 
                                    data-standard-cost="${standardStorageCost}"
                                    data-user-edited="false"
                                    oninput="this.dataset.userEdited='true'; window.updateArmazemCalculations()"
                                    ${!isEditable || isExempt ? 'disabled' : ''}
                                    placeholder="${formatMZN(standardStorageCost)}"
                                    title="Valor da armazenagem a pagar (gravado na coluna STORAGE VALUE)"
                                    class="w-full text-center py-2 px-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable || isExempt ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                            </div>
                            <div class="w-[105px] shrink-0">
                                <select name="storagePaid" 
                                    onchange="window.updateArmazemCalculations()"
                                    ${!isEditable || isExempt ? 'disabled' : ''}
                                    class="w-full text-center py-2 px-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${isStoragePaid ? 'text-emerald-700 bg-emerald-50' : (isStoragePartial ? 'text-amber-800 bg-amber-50' : 'text-rose-700 bg-rose-50')} ${!isEditable || isExempt ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                                    <option value="NAO" ${(!isStoragePaid && !isStoragePartial) ? 'selected' : ''}>❌ PENDENTE</option>
                                    <option value="PARCIAL" ${isStoragePartial ? 'selected' : ''}>⏳ PARCIAL</option>
                                    <option value="SIM" ${isStoragePaid ? 'selected' : ''}>✅ PAGO</option>
                                </select>
                            </div>
                            ${isEditable && !isExempt ? `
                            <button type="button" id="btn-armazem-vincular-banco" onclick="ui.vincularPagamentoArmazem()"
                                class="${(!isStoragePaid || storageRemaining > 0.05) ? '' : 'hidden'} px-2.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1 shrink-0 h-[34px]"
                                title="Vincular pagamento de armazenagem a um extrato bancário">
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                <span>Vincular</span>
                            </button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="col-span-1 md:col-span-2">
                        <label class="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Nota Contacto</label>
                        <input type="text" name="notaContacto" value="${contactNoteVal}" placeholder="Ex: Contactado..." 
                            ${!isEditable ? 'disabled' : ''}
                            class="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-[11px] font-normal focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${!isEditable ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}">
                    </div>

                    <!-- Rodapé com Botões de Ação -->
                    <div class="col-span-1 md:col-span-12 pt-2 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                        ${buttonsHtml}
                    </div>
                </div>

                <!-- Rastreio Operacional (Armazém & Guia) -->
                <div class="flex flex-wrap items-center justify-between text-[11px] text-slate-500 bg-slate-50/80 border border-slate-200/60 rounded-2xl px-4 py-2.5 mt-2">
                    <div class="flex items-center gap-4 flex-wrap">
                        <span class="inline-flex items-center gap-1.5 font-medium">
                            <span class="text-slate-400">Gravado por:</span>
                            <strong class="text-slate-700 font-bold">${client.lastWarehouseSavedBy ? `${client.lastWarehouseSavedBy} <span class="text-[10px] text-slate-400 font-normal">(${formatDateDisplay(client.lastWarehouseSavedAt)})</span>` : '<span class="text-slate-400 font-normal italic">Não registado</span>'}</strong>
                        </span>
                        <span class="text-slate-300">|</span>
                        <span class="inline-flex items-center gap-1.5 font-medium">
                            <span class="text-slate-400">Guia emitida por:</span>
                            <strong class="text-slate-700 font-bold">${client.lastGuiaIssuedBy ? `${client.lastGuiaIssuedBy} <span class="text-[10px] text-slate-400 font-normal">(${formatDateDisplay(client.lastGuiaIssuedAt)})</span>` : '<span class="text-slate-400 font-normal italic">Ainda não emitida</span>'}</strong>
                        </span>
                    </div>
                    <button type="button" onclick="ui.openClientAuditModal()" class="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer inline-flex items-center gap-1">
                        Histórico completo &rarr;
                    </button>
                </div>
            </div>
            ` : `
            <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 mt-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
                    <h4 class="font-black text-xs uppercase tracking-wider text-slate-700">Resumo de Armazenagem Acumulada</h4>
                    ${(hasDischargeDate && !isExempt && (!isStoragePaid || storageRemaining > 0.05) && storageCost > 0) ? `
                    <button type="button" onclick="ui.vincularPagamentoArmazem()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        <span>Vincular Armazenagem</span>
                    </button>
                    ` : ''}
                </div>
                <div class="flex flex-wrap items-center gap-2.5 text-xs">
                    ${dischargeDateBadge}
                    ${storageBadgesHtml}
                </div>
            </div>
            `}
            ${despachoCopyCardHtml}
        `;

        // Restaurar valores em edição se o operador estava a preencher
        if (draftValues && hasDischargeDate) {
            const newForm = container.querySelector('#armazem-form-container');
            if (newForm) {
                if (draftValues.discharge !== undefined && draftValues.discharge !== '') {
                    const el = newForm.querySelector('input[name="discharge"]');
                    if (el) el.value = draftValues.discharge;
                }
                if (draftValues.deliver !== undefined && draftValues.deliver !== '') {
                    const el = newForm.querySelector('input[name="deliver"]');
                    if (el) el.value = draftValues.deliver;
                }
                if (draftValues.deliverDate !== undefined && draftValues.deliverDate !== '') {
                    const el = newForm.querySelector('input[name="deliverDate"]');
                    if (el) el.value = draftValues.deliverDate;
                }
                if (draftValues.deliverTo !== undefined && draftValues.deliverTo !== '') {
                    const el = newForm.querySelector('input[name="deliverTo"]');
                    if (el) el.value = draftValues.deliverTo;
                }
                if (draftValues.contacto !== undefined && draftValues.contacto !== '') {
                    const el = newForm.querySelector('input[name="contacto"]');
                    if (el) el.value = draftValues.contacto;
                }
                if (draftValues.viatura !== undefined && draftValues.viatura !== '') {
                    const el = newForm.querySelector('input[name="viatura"]');
                    if (el) el.value = draftValues.viatura;
                }
                if (draftValues.hasViatura !== undefined) {
                    const chk = newForm.querySelector('#check-has-viatura');
                    if (chk) {
                        chk.checked = draftValues.hasViatura;
                        if (typeof toggleViaturaField === 'function') toggleViaturaField(chk);
                    }
                }
                if (draftValues.hasIsencao !== undefined) {
                    const chk = newForm.querySelector('#check-has-isencao');
                    if (chk) {
                        chk.checked = draftValues.hasIsencao;
                        if (typeof toggleIsencao === 'function') toggleIsencao(chk);
                    }
                }
                if (draftValues.isencaoSelect !== undefined && draftValues.isencaoSelect !== '') {
                    const sel = newForm.querySelector('#select-isencao');
                    if (sel) sel.value = draftValues.isencaoSelect;
                }
                if (draftValues.isencaoMotivo !== undefined && draftValues.isencaoMotivo !== '') {
                    const inp = newForm.querySelector('input[name="motivoIsencao"]');
                    if (inp) inp.value = draftValues.isencaoMotivo;
                }
                if (draftValues.notaContacto !== undefined && draftValues.notaContacto !== '') {
                    const el = newForm.querySelector('input[name="notaContacto"]');
                    if (el) el.value = draftValues.notaContacto;
                }
                if (draftValues.storagePayAmount !== undefined && draftValues.storagePayAmount !== '') {
                    const el = newForm.querySelector('#input-storage-pay-amount');
                    if (el) el.value = draftValues.storagePayAmount;
                }
                if (draftValues.storagePaid !== undefined && draftValues.storagePaid !== '') {
                    const el = newForm.querySelector('select[name="storagePaid"]');
                    if (el) el.value = draftValues.storagePaid;
                }
                if (draftValues.activeId) {
                    const activeEl = newForm.querySelector(`[name="${draftValues.activeId}"], #${draftValues.activeId}`);
                    if (activeEl && typeof activeEl.focus === 'function') {
                        activeEl.focus();
                        if (draftValues.selStart !== undefined && draftValues.selEnd !== undefined && typeof activeEl.setSelectionRange === 'function') {
                            try { activeEl.setSelectionRange(draftValues.selStart, draftValues.selEnd); } catch (e) {}
                        }
                    }
                }
                if (window.updateArmazemCalculations) {
                    window.updateArmazemCalculations();
                }
            }
        }
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
    if (!requireProjectDischargeDate()) return;
    const container = buttonEl.closest('#armazem-operations-container') || buttonEl.closest('#armazem-form-container') || document;
    if (!container) return;

    // Obter inputs
    const dischargeInput = container.querySelector('input[name="discharge"]');
    const deliverInput = container.querySelector('input[name="deliver"]');
    const deliverDateInput = container.querySelector('input[name="deliverDate"]');
    const deliverToInput = container.querySelector('input[name="deliverTo"]');
    const contactoInput = container.querySelector('input[name="contacto"]');
    const viaturaInput = container.querySelector('input[name="viatura"]');
    const notaContactoInput = container.querySelector('input[name="notaContacto"]');
    const motivoIsencaoInput = container.querySelector('input[name="motivoIsencao"]');
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

    const isViaturaChecked = container.querySelector('#check-has-viatura')?.checked;
    const viaturaVal = (isViaturaChecked && viaturaInput) ? viaturaInput.value.trim() : '';

    const notaContactoVal = notaContactoInput ? notaContactoInput.value.trim() : '';

    const isIsencaoChecked = container.querySelector('#check-has-isencao')?.checked;
    let motivoIsencaoVal = '';
    if (isIsencaoChecked) {
        const selVal = container.querySelector('#select-isencao')?.value || '';
        const txtVal = motivoIsencaoInput ? motivoIsencaoInput.value.trim() : '';
        if (txtVal && selVal && selVal !== 'Outro' && !txtVal.includes(selVal)) {
            motivoIsencaoVal = `${selVal} - ${txtVal}`;
        } else {
            motivoIsencaoVal = txtVal || selVal || 'Isenção autorizada';
        }
    }

    const client = window.currentActiveClient;
    if (!client) {
        toast('Erro: Cliente ativo não encontrado.', 'error');
        return;
    }

    const despachoCard = document.getElementById('despacho-copy-card');
    const despachoRequestedChk = despachoCard?.querySelector('#check-despacho-solicitado');
    const despachoAmountInp = despachoCard?.querySelector('#input-despacho-amount');
    const despachoPaidSel = despachoCard?.querySelector('#select-despacho-paid');
    const despachoBankPmts = window.currentClientDespachoPayments || [];
    const despachoBankSum = despachoBankPmts.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const hasExistingDespachoCols = findWarehouseCol(state.confirm.columns || [], ['COPIA DESPACHO', 'COPIA DE DESPACHO', 'DESPACHO COPY', 'COPIA_DESPACHO']) !== -1;
    const isDespachoRequestedNow = Boolean(despachoRequestedChk?.checked) || despachoBankSum > 0;

    // Garantir colunas opcionais & STORAGE VALUE ANTES de resolver índices finais
    if (notaContactoVal) await ensureContactNoteColumn();
    if (viaturaVal) await ensureViaturaColumn();
    if (motivoIsencaoVal) await ensureMotivoIsencaoColumn();
    await ensureStorageValueColumn();
    if (isDespachoRequestedNow || hasExistingDespachoCols) await ensureDespachoCopyColumns();

    const columns = state.confirm.columns || [];
    const findCol = (targets, opts) => findWarehouseCol(columns, targets, opts);

    const packagesIdx = findCol(['PACKAGES']);
    const dischargeIdx = findCol(['DISCHARGE']);
    const deliverIdx = findCol(['DELIVER']);
    const deliverDateIdx = findCol(['DELIVER DATE']);
    const deliverToIdx = findCol(['DELIVER TO']);
    const contactoIdx = findCol(['CONTACTO', 'CONTACT']);
    const motivoIsencaoIdx = findCol(['MOTIVO ISENCAO ARMAZENAGEM', 'MOTIVO ISENCAO', 'MOTIVO DE ISENCAO']);
    const storagePaidIdx = findCol(['STORAGE PAID', 'ARMAZENAGEM PAGO', 'STORAGE_PAID']);
    const storageValueIdx = findCol(['STORAGE VALUE', 'VALOR ARMAZENAGEM', 'ARMAZENAGEM VALOR', 'STORAGE_VALUE']);
    const deliveredIdx = findCol(['DELIVERED', 'ENTREGUE', 'STATUS ENTREGA', 'DELIVERY STATUS']);
    const contactNoteIdx = findCol(['NOTA CONTACTO', 'ESTADO CONTACTO', 'OBS CONTACTO', 'NOTA ARMAZEM', 'OBS ARMAZEM', 'CONTACT NOTE']);
    const viaturaIdx = findCol(['VIATURA', 'MATRICULA', 'VIATURA MATRICULA', 'PLACA', 'CARRO', 'VEICULO', 'VEHICLE']);
    const despachoStatusIdx = findCol(['COPIA DESPACHO', 'COPIA DE DESPACHO', 'DESPACHO COPY', 'COPIA_DESPACHO']);
    const despachoValueIdx = findCol(['COPIA DESPACHO VALOR', 'VALOR COPIA DESPACHO', 'COPIA DESPACHO VALUE', 'DESPACHO VALUE', 'DESPACHO VALOR']);
    const defaultDespachoPrice = getDespachoCopyDefaultPrice();
    const enteredDespachoAmount = (despachoAmountInp && despachoAmountInp.value !== '')
        ? Math.max(0, parseFloat(despachoAmountInp.value) || 0)
        : defaultDespachoPrice;
    const despachoFormatted = formatFeeSheetStatus({
        isRequested: isDespachoRequestedNow,
        targetCost: isDespachoRequestedNow ? enteredDespachoAmount : 0,
        standardCost: defaultDespachoPrice,
        bankPaidAmount: despachoBankSum,
        manualStatus: despachoPaidSel ? despachoPaidSel.value : 'NAO',
        zeroCostPendingLabel: 'PENDENTE',
        preferAmountOnPaid: true
    });

    if (dischargeIdx === -1 || deliverIdx === -1 || deliverDateIdx === -1 || deliverToIdx === -1 || contactoIdx === -1 || storagePaidIdx === -1 || deliveredIdx === -1) {
        toast('Erro: Colunas de Armazém não encontradas.', 'error');
        return;
    }

    const firstRowIndex = client.rows[0].originalIndex;
    const firstRowData = state.confirm?.data?.[firstRowIndex] || [];
    const deliveredInput = container.querySelector('input[name="delivered"]');
    const deliveredVal = deliveredInput ? deliveredInput.value.trim().toUpperCase() : (deliveredIdx !== -1 && firstRowData[deliveredIdx] ? String(firstRowData[deliveredIdx]).trim().toUpperCase() : 'NAO');
    const isDeliveredNow = deliveredVal === 'SIM' || deliveredVal === 'ENTREGUE' || deliveredVal === 'YES';

    const storagePayments = window.currentClientStoragePayments || [];
    const bankPaidAmount = storagePayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const liveCalc = calculateClientStorage({
        rows: client.rows,
        columns,
        dischargeDateStr: state.confirm?.dischargeDate || '',
        bankPayments: storagePayments,
        overrides: {
            isDelivered: isDeliveredNow,
            deliverDateVal: deliverDateValRaw
        }
    });

    const storagePayAmountInput = container.querySelector('#input-storage-pay-amount');
    const standardCost = storagePayAmountInput
        ? (parseFloat(storagePayAmountInput.getAttribute('data-standard-cost')) || liveCalc.standardCost)
        : liveCalc.standardCost;
    const enteredAmount = (storagePayAmountInput && storagePayAmountInput.value !== '')
        ? (parseFloat(storagePayAmountInput.value) || 0)
        : standardCost;

    let storagePaidVal = 'NAO';
    let storageValueVal = 0;

    if (isIsencaoChecked) {
        storagePaidVal = 'ISENTO';
        storageValueVal = 0;
    } else if (standardCost === 0 && enteredAmount === 0) {
        storagePaidVal = isDeliveredNow ? 'LIVRE' : 'NAO';
        storageValueVal = 0;
    } else {
        storageValueVal = enteredAmount;
        const paidStatus = storagePaidInput ? storagePaidInput.value.trim().toUpperCase() : 'NAO';
        const isPaid = paidStatus === 'SIM' || (bankPaidAmount >= enteredAmount - 0.05 && enteredAmount > 0);
        const isNegotiated = Math.abs(enteredAmount - standardCost) > 1;

        if (bankPaidAmount > 0 && bankPaidAmount < enteredAmount - 0.05 && paidStatus !== 'SIM') {
            storagePaidVal = isNegotiated
                ? `PARCIAL (${bankPaidAmount} / ${enteredAmount} MT)`
                : `PARCIAL (${bankPaidAmount} MT)`;
        } else if (isNegotiated) {
            storagePaidVal = isPaid ? `PAGO (${enteredAmount} MT)` : `PENDENTE (${enteredAmount} MT)`;
        } else {
            storagePaidVal = isPaid ? 'SIM' : 'NAO';
        }
    }

    const totalDischargeInput = dischargeVal !== '' ? parseFloat(dischargeVal) : null;
    const totalDeliverInput = deliverVal !== '' ? parseFloat(deliverVal) : null;

    let remainingDischarge = totalDischargeInput !== null ? totalDischargeInput : 0;
    let remainingDeliver = totalDeliverInput !== null ? totalDeliverInput : 0;

    const batchUpdates = [];
    let sheetName = 'Folha1';
    if (state.confirm.range && state.confirm.range.includes('!')) {
        sheetName = state.confirm.range.split('!')[0];
    }

    const updatedClientRows = [];

    client.rows.forEach((r, idx) => {
        const rowIndex = r.originalIndex;
        const rowNum = rowIndex + 1;
        const rawRow = (state.confirm?.data && state.confirm.data[rowIndex]) || r.originalRow || [];
        const rowData = [...rawRow];
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
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(dischargeIdx)}${rowNum}`), values: [[allocatedDischarge]] });
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
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(deliverIdx)}${rowNum}`), values: [[allocatedDeliver]] });
        }

        // Metadados replicados para todas as ordens
        if (deliverDateIdx !== -1) {
            rowData[deliverDateIdx] = deliverDateVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(deliverDateIdx)}${rowNum}`), values: [[deliverDateVal]] });
        }
        if (deliverToIdx !== -1) {
            rowData[deliverToIdx] = deliverToVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(deliverToIdx)}${rowNum}`), values: [[deliverToVal]] });
        }
        if (contactoIdx !== -1) {
            rowData[contactoIdx] = contactoVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(contactoIdx)}${rowNum}`), values: [[contactoVal]] });
        }
        if (viaturaIdx !== -1) {
            rowData[viaturaIdx] = viaturaVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(viaturaIdx)}${rowNum}`), values: [[viaturaVal]] });
        }
        if (contactNoteIdx !== -1) {
            rowData[contactNoteIdx] = notaContactoVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(contactNoteIdx)}${rowNum}`), values: [[notaContactoVal]] });
        }
        if (motivoIsencaoIdx !== -1) {
            rowData[motivoIsencaoIdx] = motivoIsencaoVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(motivoIsencaoIdx)}${rowNum}`), values: [[motivoIsencaoVal]] });
        }
        if (storagePaidIdx !== -1) {
            rowData[storagePaidIdx] = storagePaidVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(storagePaidIdx)}${rowNum}`), values: [[storagePaidVal]] });
        }
        if (storageValueIdx !== -1) {
            const svCellVal = idx === 0 ? storageValueVal : '';
            rowData[storageValueIdx] = svCellVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(storageValueIdx)}${rowNum}`), values: [[svCellVal]] });
        }
        if (deliveredIdx !== -1) {
            rowData[deliveredIdx] = deliveredVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(deliveredIdx)}${rowNum}`), values: [[deliveredVal]] });
        }
        if (despachoStatusIdx !== -1 && (isDespachoRequestedNow || hasExistingDespachoCols)) {
            rowData[despachoStatusIdx] = despachoFormatted.statusCellVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(despachoStatusIdx)}${rowNum}`), values: [[despachoFormatted.statusCellVal]] });
        }
        if (despachoValueIdx !== -1 && (isDespachoRequestedNow || hasExistingDespachoCols)) {
            const dvCellVal = idx === 0 ? despachoFormatted.valueCellVal : '';
            rowData[despachoValueIdx] = dvCellVal;
            batchUpdates.push({ range: formatSheetRange(sheetName, `${getColLetter(despachoValueIdx)}${rowNum}`), values: [[dvCellVal]] });
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

        // Atualizar rastreio local
        const opUser = pb.authStore.model?.name || pb.authStore.model?.email || 'Operador';
        const nowIso = new Date().toISOString();
        client.lastWarehouseSavedBy = opUser;
        client.lastWarehouseSavedAt = nowIso;
        client.contactNote = notaContactoVal;
        client.viatura = viaturaVal;

        // Auditoria: Armazém gravado / entregue
        const actionType = deliveredVal === 'SIM' ? 'ARMAZEM_ENTREGUE' : 'ARMAZEM_GRAVADO';
        logConfirmAudit(state.confirm.sheetId, client.no, client.displayName, actionType, {
            descarregado: totalDischargeInput,
            entregue: totalDeliverInput,
            dataEntrega: deliverDateVal,
            entregueA: deliverToVal,
            contacto: contactoVal,
            viatura: viaturaVal,
            notaContacto: notaContactoVal,
            armazenagemPago: storagePaidVal,
            valorArmazenagem: storageValueVal,
            isencao: motivoIsencaoVal,
            statusEntrega: deliveredVal
        }).catch(err => console.warn('[Audit] Erro ao registar auditoria de armazém:', err));

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
    if (!requireProjectDischargeDate()) return;
    const container = buttonEl.closest('#armazem-operations-container') || buttonEl.closest('#armazem-form-container') || document;
    if (!container) return;

    const deliverInput = container.querySelector('input[name="deliver"]');
    const deliverDateInput = container.querySelector('input[name="deliverDate"]');
    const deliverToInput = container.querySelector('input[name="deliverTo"]');
    const contactoInput = container.querySelector('input[name="contacto"]');

    const todayStr = formatLocalYMD(new Date());
    if (deliverDateInput && (!deliverDateInput.value.trim() || (deliverDateInput.dataset.userEdited !== 'true' && deliverDateInput.value.trim() < todayStr))) {
        deliverDateInput.value = todayStr;
    }

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

    // Recalcular custo final exato na data de entrega antes de congelar
    const client = window.currentActiveClient;
    const storagePayments = window.currentClientStoragePayments || [];
    const bankPaidAmount = storagePayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const deliveryCalc = client ? calculateClientStorage({
        rows: client.rows,
        columns: state.confirm?.columns || [],
        dischargeDateStr: state.confirm?.dischargeDate || '',
        bankPayments: storagePayments,
        overrides: { isDelivered: true, deliverDateVal }
    }) : null;

    const isExemptCheck = container.querySelector('#check-has-isencao')?.checked;
    const storagePaidSelectCheck = container.querySelector('select[name="storagePaid"]');
    const storagePayAmountInputCheck = container.querySelector('#input-storage-pay-amount');
    if (storagePayAmountInputCheck && deliveryCalc) {
        storagePayAmountInputCheck.setAttribute('data-standard-cost', String(deliveryCalc.standardCost));
        if (storagePayAmountInputCheck.dataset.userEdited !== 'true' && !isExemptCheck) {
            storagePayAmountInputCheck.value = String(deliveryCalc.standardCost);
        }
    }

    const storageAmountCheck = isExemptCheck
        ? 0
        : (storagePayAmountInputCheck && storagePayAmountInputCheck.value !== ''
            ? (parseFloat(storagePayAmountInputCheck.value) || 0)
            : (deliveryCalc?.standardCost || 0));
    const remainingAtDelivery = Math.max(0, storageAmountCheck - bankPaidAmount);
    const isStoragePaidCheck = isExemptCheck
        || storageAmountCheck === 0
        || (storagePaidSelectCheck && storagePaidSelectCheck.value === 'SIM')
        || (bankPaidAmount >= storageAmountCheck - 0.05 && storageAmountCheck > 0);
    
    if (storageAmountCheck > 0 && !isStoragePaidCheck) {
        toast(`Erro: Armazenagem de ${formatMZN(remainingAtDelivery > 0 ? remainingAtDelivery : storageAmountCheck)} pendente. Registar ou vincular pagamento de armazenagem antes de confirmar a entrega.`, 'error');
        return;
    }

    const storageConfirmNote = (!isExemptCheck && storageAmountCheck > 0)
        ? `\nArmazenagem final congelada: ${formatMZN(storageAmountCheck)}`
        : '';
    const dInfo = window.currentClientDespachoInfo;
    const despachoWarnNote = (dInfo && dInfo.isRequested && !dInfo.isPaid && dInfo.cost > 0)
        ? `\n⚠️ Aviso: Cópia de Despacho solicitada ainda tem saldo pendente de ${formatMZN(dInfo.remainingBalance)}.`
        : '';
    if (!confirm(`Deseja confirmar a entrega da carga na data ${formatDateDisplay(deliverDateVal)}?${storageConfirmNote}${despachoWarnNote}\nEsta ação irá parar a contagem de dias e bloquear futuras edições.`)) {
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
 * Força a entrega extraordinária, ignorando restrições de Duty e Frete
 */
export async function forceExtraordinaryDelivery(originalIndex, buttonEl) {
    if (!requireProjectDischargeDate()) return;
    const reason = prompt('Motivo da Entrega Extraordinária (Ex: Autorização superior, Erro bancário):');
    if (!reason || reason.trim() === '') {
        toast('Erro: É obrigatório justificar a Entrega Extraordinária.', 'warning');
        return;
    }
    
    if (!confirm(`Confirma a autorização extraordinária com o motivo: "${reason}"?`)) {
        return;
    }

    const container = buttonEl.closest('#armazem-operations-container') || buttonEl.closest('#armazem-form-container') || document;
    let motivoInput = container.querySelector('input[name="motivoIsencao"]');
    if (motivoInput) {
        const existing = motivoInput.value.replace(/\[EXTRAORDINÁRIA\][^|]+\|?/g, '').trim();
        motivoInput.value = `[EXTRAORDINÁRIA] ${reason.trim()} ${existing ? '| ' + existing : ''}`.trim();
        
        // Força o gravar para enviar para a folha
        await saveArmazemRow(originalIndex, buttonEl);
        toast('Entrega Extraordinária autorizada e registada com sucesso.', 'success');
    } else {
        toast('Erro: Campo de notas não encontrado para registar o motivo.', 'error');
    }
}

/**
 * Abre o ecrã de impressão para emissão de Guia de Entrega (ou imprime silenciosamente se silentDirect = true)
 * @param {Object} [clientParam] - Cliente ativo
 * @param {boolean} [silentDirect=false] - Se true, imprime direto no computador partilhado sem popup
 */
export async function printDeliveryNote(clientParam = null, silentDirect = false) {
    const client = clientParam || window.currentActiveClient;
    if (!client) return;

    const projectName = document.getElementById('confirm-project-active-name')?.textContent || 'PROJETO';
    const clientName = client.displayName || 'Cliente Sem Nome';
    const clientCode = client.displayIdCode || '---';
    const clientNo = client.no || '—';

    const columns = state.confirm.columns || [];
    const findCol = (targets, opts) => findWarehouseCol(columns, targets, opts);

    const orderNumIdx = findCol(['HF2', 'REF', 'REFERENCIA', 'ORDER NUMBER', 'ORDER NUM', 'ORDER', 'CONV', 'CONTENTOR', 'Nº HF2', 'Nº ORDEM', 'NO.', 'N.O', 'N.º', 'Nº', 'N°', 'NO']);
    const packagesIdx = findCol(['PACKAGES']);
    const dischargeIdx = findCol(['DISCHARGE']);
    const deliverIdx = findCol(['DELIVER']);
    const deliverDateIdx = findCol(['DELIVER DATE']);
    const deliverToIdx = findCol(['DELIVER TO']);
    const contactoIdx = findCol(['CONTACTO', 'CONTACT']);
    const deliveredIdx = findCol(['DELIVERED', 'ENTREGUE', 'STATUS ENTREGA', 'DELIVERY STATUS']);
    const viaturaIdx = findCol(['VIATURA', 'MATRICULA', 'VIATURA MATRICULA', 'PLACA', 'CARRO', 'VEICULO', 'VEHICLE']);
    const descIdx = findCol(['DESCRIPTION', 'DESCRICAO', 'DESCRICÃO', 'DESC', 'MERCADORIA', 'CARGO', 'PRODUTO', 'ARTIGO', 'CONTEUDO', 'NATUREZA', 'GOODS', 'ITEM']);

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
    let deliveryDate = new Date().toLocaleDateString('pt-PT');
    let viaturaVal = viaturaIdx !== -1 ? (firstRowData[viaturaIdx] || '') : (client.viatura || '');

    const deliverDateVal = deliverDateIdx !== -1 ? (firstRowData[deliverDateIdx] || '') : '';
    const deliverToVal = deliverToIdx !== -1 ? (firstRowData[deliverToIdx] || '') : '';
    const contactoVal = contactoIdx !== -1 ? (firstRowData[contactoIdx] || '') : '';

    if (deliverToVal && deliverToVal !== '—') receiverName = deliverToVal;
    if (contactoVal && contactoVal !== '—') receiverContact = contactoVal;
    if (deliverDateVal && deliverDateVal !== '—') deliveryDate = deliverDateVal;

    // Verificar se há valores preenchidos no formulário aberto atualmente
    const formContainer = document.getElementById('armazem-form-container');
    if (formContainer) {
        const liveDeliverTo = formContainer.querySelector('input[name="deliverTo"]')?.value?.trim();
        const liveContacto = formContainer.querySelector('input[name="contacto"]')?.value?.trim();
        const liveDate = formContainer.querySelector('input[name="deliverDate"]')?.value?.trim();
        const liveDeliver = formContainer.querySelector('input[name="deliver"]')?.value?.trim();
        const liveViatura = formContainer.querySelector('input[name="viatura"]')?.value?.trim();
        if (liveDeliverTo) receiverName = liveDeliverTo;
        if (liveContacto) receiverContact = liveContacto;
        if (liveDate) deliveryDate = liveDate;
        if (liveViatura) viaturaVal = liveViatura;
        if (liveDeliver && parseFloat(liveDeliver) > 0) totalDelivered = parseFloat(liveDeliver);
    }
    if (receiverContact === '—' && client.clientPhone) {
        receiverContact = client.clientPhone;
    }
    if (receiverName === '—' && clientName) {
        receiverName = clientName;
    }

    const issuerName = pb.authStore.model?.name || pb.authStore.model?.email || 'Operador Autorizado';
    const now = new Date();
    const nowIso = now.toISOString();
    client.lastGuiaIssuedBy = issuerName;
    client.lastGuiaIssuedAt = nowIso;

    // Gerar Nº único da Guia
    const dateCode = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const cleanClientNum = String(clientNo || '001').replace(/[^0-9]/g, '').padStart(3, '0');
    const guiaNumber = `GD-${dateCode}-${cleanClientNum}`;
    client.lastGuiaNumber = guiaNumber;

    const dataEmissao = now.toLocaleDateString('pt-PT');
    const horaEmissao = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    // Auditoria: Emissão de Guia de Entrega
    const spreadsheetId = state.confirm?.sheetId || '';
    logConfirmAudit(spreadsheetId, client.no, client.displayName, 'GUIA_EMITIDA', {
        numeroGuia: guiaNumber,
        emitidoPor: issuerName,
        volumesEntregues: totalDelivered,
        recebedor: receiverName,
        contacto: receiverContact,
        viatura: viaturaVal,
        dataEntrega: deliveryDate
    }).catch(err => console.warn('[Audit] Erro ao registar emissão de guia:', err));

    const totalCarga = totalDischarged > 0 ? totalDischarged : totalOriginal;

    // --- CÁLCULO UNIFICADO DE ARMAZENAGEM PARA IMPRESSÃO ---
    const dischargeDateStr = state.confirm?.dischargeDate || '';
    const dDate = parseDate(dischargeDateStr);
    const dischargeDateDisplay = dDate 
        ? dDate.toLocaleDateString('pt-PT') 
        : (dischargeDateStr && dischargeDateStr !== '—' && dischargeDateStr !== 'Invalid Date' ? dischargeDateStr : '—');

    const deliveredFlagRaw = deliveredIdx !== -1 ? String(firstRowData[deliveredIdx] || '').trim().toUpperCase() : 'NAO';
    const isDeliveredPrint = (deliveredFlagRaw === 'SIM' || deliveredFlagRaw === 'ENTREGUE' || deliveredFlagRaw === 'YES');
    const storageCalcPrint = calculateClientStorage({
        rows: client.rows,
        columns,
        dischargeDateStr,
        bankPayments: window.currentClientStoragePayments || [],
        overrides: {
            isDelivered: isDeliveredPrint,
            deliverDateVal: deliveryDate
        }
    });

    const isAnticipated = storageCalcPrint.isAnticipated;
    const daysDiff = storageCalcPrint.daysDiff;
    const storageInfo = storageCalcPrint.storageInfo;
    const storageCost = storageInfo.cost;
    const isStoragePaid = storageInfo.isPaid;
    let textStoragePaid = 'PENDENTE';
    if (storageInfo.isExempt) {
        textStoragePaid = 'ISENTO (0,00 MZN)';
    } else if (storageInfo.isNegotiated) {
        textStoragePaid = isStoragePaid ? 'LIVRE / PAGO (NEGOCIADO)' : (storageInfo.isPartial ? 'PARCIAL (NEGOCIADO)' : 'PENDENTE (NEGOCIADO)');
    } else if (storageInfo.isPartial) {
        textStoragePaid = `PARCIAL (PAGO ${formatMZN(storageInfo.paidAmount)})`;
    } else {
        textStoragePaid = isStoragePaid ? 'LIVRE / PAGO' : 'PENDENTE';
    }

    // Determinar modo de impressão baseado no número total de ordens (Otimizado para poupança de papel):
    // - 1 a 6 ordens: '1_FOLHA' (1 folha única A4 dividida ao meio com corte ✂ para poupar papel)
    // - 7 a 14 ordens: '2_FOLHAS' (1 folha A4 completa para 1ª via + 1 folha A4 para 2ª via)
    // - > 14 ordens: '4_FOLHAS' (2 folhas para 1ª via + 2 folhas para 2ª via)
    const totalOrdersCount = client.rows ? client.rows.length : 0;
    let printMode = '1_FOLHA';
    if (totalOrdersCount > 14) {
        printMode = '4_FOLHAS';
    } else if (totalOrdersCount > 6) {
        printMode = '2_FOLHAS';
    }

    // Para o modo 4 Folhas, dividir as ordens em duas partes (Parte 1 e Parte 2):
    // A Parte 1 tem os 3 blocos/cards de cliente/recebimento/armazenagem, por isso comporta confortavelmente até 10 ordens.
    // A Parte 2 tem cabeçalho compacto de continuação, comportando as restantes ordens com totais e assinaturas.
    const splitIdx = Math.min(10, Math.ceil(totalOrdersCount / 2));
    const part1Rows = (client.rows || []).slice(0, splitIdx);
    const part2Rows = (client.rows || []).slice(splitIdx);

    // Helper para gerar o HTML de cada via mantendo a identidade visual com tipografia nítida e legível
    const generateViaHtml = (viaType, pagePart = 'FULL') => {
        const isArmazem = viaType === 'ARMAZEM';
        const docTitle = isArmazem ? 'Guia de Entrega' : 'Guia de Saída';
        
        let badgeLabel = '';
        if (pagePart === 'HALF') {
            badgeLabel = isArmazem ? '1ª VIA — ARMAZÉM / CONFERÊNCIA' : '2ª VIA — PORTARIA & SEGURANÇA';
        } else if (pagePart === 'FULL') {
            badgeLabel = isArmazem ? '1ª VIA — ARMAZÉM / CONFERÊNCIA (FOLHA 1 DE 2)' : '2ª VIA — PORTARIA & SEGURANÇA (FOLHA 2 DE 2)';
        } else if (pagePart === 'PART1') {
            badgeLabel = isArmazem ? '1ª VIA — ARMAZÉM (FOLHA 1 DE 4 — PARTE 1/2)' : '2ª VIA — PORTARIA (FOLHA 3 DE 4 — PARTE 1/2)';
        } else if (pagePart === 'PART2') {
            badgeLabel = isArmazem ? '1ª VIA — ARMAZÉM (FOLHA 2 DE 4 — CONCLUSÃO)' : '2ª VIA — PORTARIA (FOLHA 4 DE 4 — CONCLUSÃO)';
        }

        const badgeStyle = isArmazem 
            ? 'background: #e0e7ff; color: #1e1b4b; border: 1.5px solid #4338ca; font-weight: 900;' 
            : 'background: #fef3c7; color: #78350f; border: 1.5px solid #d97706; font-weight: 900;';
        
        const actionColTitle = isArmazem ? 'Levantado nesta Guia' : 'Volumes a Sair';
        const actionColColor = isArmazem ? '#4338ca' : '#0369a1';
        
        const noteText = isArmazem
            ? '<strong>Nota Armazém:</strong> Esta via fica retida no armazém após conferência e entrega. O fiel regista manualmente os volumes levantados e o saldo restante. Emitida por Jupiter Logistics e conferida pelo recebedor.'
            : '<strong>Nota Portaria:</strong> A segurança da portaria confere os volumes na viatura com o valor autorizado pelo fiel do armazém, carimba e retém esta via para validação diária com o armazém.';
        
        const sigBox1 = isArmazem
            ? `<div class="sig-box">
                   <p>Jupiter Logistics Lda (${issuerName})</p>
                   <span>Assinatura de quem emite a Guia</span>
               </div>`
            : `<div class="sig-box">
                   <p>Fiel do Armazém</p>
                   <span>Assinatura do Fiel do Armazém (Hora: ____:____)</span>
               </div>`;

        const sigBox2 = isArmazem
            ? `<div class="sig-box">
                   <p>${receiverName}</p>
                   <span>Assinatura do Recebedor</span>
               </div>`
            : `<div class="sig-box">
                   <p>Portaria & Segurança</p>
                   <span>Visto / Carimbo da Portaria (Hora Saída: ____:____)</span>
               </div>`;

        // Determinar linhas a renderizar nesta página
        let currentRows = client.rows || [];
        let startRowIndex = 0;
        if (pagePart === 'PART1') {
            currentRows = part1Rows;
            startRowIndex = 0;
        } else if (pagePart === 'PART2') {
            currentRows = part2Rows;
            startRowIndex = splitIdx;
        }

        const tableRowsHtml = currentRows.map((r, idx) => {
            const globalIdx = startRowIndex + idx;
            const orderNum = orderNumIdx !== -1 ? String(r.originalRow[orderNumIdx] || '').trim() : '';
            const desc = descIdx !== -1 ? String(r.originalRow[descIdx] || '').trim() : '';
            const cleanOrder = (orderNum && orderNum !== '—') ? orderNum : '';
            const cleanDesc = (desc && desc !== '—') ? desc : '';
            const pkgs = packagesIdx !== -1 ? (parseFloat(r.originalRow[packagesIdx]) || 0) : 0;
            const discharged = dischargeIdx !== -1 ? (parseFloat(r.originalRow[dischargeIdx]) || 0) : 0;

            let title = cleanOrder ? `Ordem: ${cleanOrder}` : (client.rows.length === 1 ? 'Mercadoria do Cliente' : `Item ${globalIdx + 1}`);

            return `
                <tr>
                    <td class="td-desc">
                        <div class="row-order-title">
                            <strong class="order-tag">${title}</strong>
                            ${cleanDesc ? `<span class="order-desc-inline">${cleanDesc}</span>` : ''}
                        </div>
                    </td>
                    <td class="td-num">${pkgs}</td>
                    <td class="td-num">${discharged}</td>
                    <td class="td-action">
                        <span class="write-line" style="border-bottom-color: ${actionColColor};">&nbsp;</span> <span class="vol-unit">Vol</span>
                    </td>
                    <td class="td-action">
                        <span class="write-line" style="border-bottom-color: ${actionColColor};">&nbsp;</span> <span class="vol-unit">Vol</span>
                    </td>
                </tr>
            `;
        }).join('');

        // Linha final da tabela (Continua na próxima folha OU Total Geral consolidado)
        let tableFooterRowHtml = '';
        if (pagePart === 'PART1') {
            tableFooterRowHtml = `
                <tr class="totals-row">
                    <td colspan="5" style="text-align: center; font-size: 11px; font-weight: 800; background: #f8fafc; padding: 5px;">
                        [ Continua na Folha ${isArmazem ? '2' : '4'} — ${part1Rows.length} de ${totalOrdersCount} ordens listadas nesta folha ]
                    </td>
                </tr>
            `;
        } else {
            tableFooterRowHtml = `
                <tr class="totals-row">
                    <td class="td-desc"><strong>TOTAL GERAL</strong></td>
                    <td class="td-num"><strong>${totalOriginal}</strong></td>
                    <td class="td-num"><strong>${totalDischarged}</strong></td>
                    <td class="td-manual">[ Preenchimento Manual ]</td>
                    <td class="td-manual">[ Preenchimento Manual ]</td>
                </tr>
            `;
        }

        // Bloco de cabeçalho e cards:
        // PART2 usa cabeçalho compacto de continuação sem os 3 cards para aproveitar ao máximo a folha de conclusão
        let topHeaderHtml = '';
        if (pagePart === 'PART2') {
            topHeaderHtml = `
                <div class="header" style="border-bottom: 2px solid #000000; padding-bottom: 4px; margin-bottom: 5px;">
                    <div class="logo-section">
                        <img src="${JUPITER_LOGO_DATA_URL}" alt="Jupiter Logistics" class="header-logo" style="width: 40px; height: 40px;" />
                        <div>
                            <h1 class="company-title" style="font-size: 17px; line-height: 1.1;">JUPITER LOGISTICS LDA</h1>
                            <div class="company-sub" style="font-size: 9.5px; line-height: 1.25; margin-top: 2px;">
                                Guia Nº: <strong>${guiaNumber}</strong> | Cliente: <strong>${clientName}</strong> (${clientCode}) | Viatura: <strong>${viaturaVal || '—'}</strong> | Data: <strong>${deliveryDate}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="doc-info" style="text-align: right;">
                        <h2 style="font-size: 16px; line-height: 1.1;">${docTitle} (Conclusão)</h2>
                        <div style="margin: 2px 0;"><span class="via-badge" style="${badgeStyle}">${badgeLabel}</span></div>
                        <p class="guia-meta" style="font-size: 9.5px;">Data: <strong>${dataEmissao} ${horaEmissao}</strong> | Op: <strong>${issuerName}</strong></p>
                    </div>
                </div>
            `;
        } else {
            topHeaderHtml = `
                <div class="header">
                    <div class="logo-section">
                        <img src="${JUPITER_LOGO_DATA_URL}" alt="Jupiter Logistics" class="header-logo" />
                        <div>
                            <h1 class="company-title">JUPITER LOGISTICS LDA</h1>
                            <div class="company-sub">
                                Av. do Trabalho nº 1412, 3º Andar • Tel: +258 21401334 • Cel: +258 84 0485 691<br>
                                NUIT: 400574472 • Email: commercial@jupiter-logistics.co.mz
                            </div>
                        </div>
                    </div>
                    <div class="doc-info">
                        <h2>${docTitle}</h2>
                        <div style="margin: 3px 0;"><span class="via-badge" style="${badgeStyle}">${badgeLabel}</span></div>
                        <p class="guia-no">Nº Guia: <strong>${guiaNumber}</strong></p>
                        <p class="guia-meta">Data: <strong>${dataEmissao} ${horaEmissao}</strong> | Op: <strong>${issuerName}</strong></p>
                    </div>
                </div>

                <div class="details-grid">
                    <div class="card">
                        <h3>Dados do Cliente</h3>
                        <p><span class="lbl">Cliente:</span> <strong class="val">${clientName}</strong></p>
                        <p><span class="lbl">ID Code:</span> <strong class="val">${clientCode}</strong></p>
                        <p><span class="lbl">Nº Cliente:</span> <strong class="val">${clientNo}</strong></p>
                        <p><span class="lbl">Projeto/Lista:</span> <strong class="val">${projectName}</strong></p>
                    </div>
                    <div class="card">
                        <h3>Informações de Recebimento</h3>
                        <p><span class="lbl">Entregue A:</span> <strong class="val">${receiverName}</strong></p>
                        <p><span class="lbl">Contacto:</span> <strong class="val">${receiverContact}</strong></p>
                        <p><span class="lbl">Data Entrega:</span> <strong class="val">${deliveryDate}</strong></p>
                        <p><span class="lbl">Viatura / Matrícula:</span> <strong class="val viatura-val">${viaturaVal ? viaturaVal : 'Sem Viatura (A pé / Transporte)'}</strong></p>
                    </div>
                    <div class="card">
                        <h3>Controlo de Armazenagem</h3>
                        <p><span class="lbl">Data Descarga:</span> <strong class="val">${dischargeDateDisplay}</strong></p>
                        <p><span class="lbl">Dias Decorridos:</span> <strong class="val">${daysDiff} dias</strong></p>
                        <p><span class="lbl">Custo Armaz.:</span> <strong class="val">${storageInfo.isExempt ? '0,00 MZN (Isento)' : (storageInfo.isNegotiated ? `${formatMZN(storageInfo.cost)} (Negociado)` : formatMZN(storageCost))}</strong></p>
                        <p><span class="lbl">Estado Pag.:</span> <strong class="val" style="color: ${isStoragePaid ? '#047857' : '#b91c1c'}; font-weight: 900;">${textStoragePaid}</strong></p>
                    </div>
                </div>
            `;
        }

        // Bloco de rodapé / notas / assinaturas:
        let bottomContentHtml = '';
        if (pagePart === 'PART1') {
            bottomContentHtml = `
                <div class="note-box" style="border-left-color: ${actionColColor}; margin-top: auto;">
                    <strong>Continuação:</strong> Esta guia possui ${totalOrdersCount} ordens no total. As restantes ${part2Rows.length} ordens, o Total Geral consolidado e as assinaturas oficiais constam na <strong>Folha ${isArmazem ? '2' : '4'}</strong>.
                </div>
            `;
        } else {
            bottomContentHtml = `
                <div class="note-box" style="border-left-color: ${actionColColor};">
                    ${noteText}
                </div>
                <div class="signatures">
                    ${sigBox1}
                    ${sigBox2}
                </div>
            `;
        }

        // Rodapé da página com identificação do documento e folha
        let pageFooterHtml = '';
        if (pagePart === 'FULL') {
            pageFooterHtml = `
                <div class="guia-page-footer">
                    <span>Guia Nº: <strong>${guiaNumber}</strong> • ${isArmazem ? 'Folha 1 de 2 (Armazém / Conferência)' : 'Folha 2 de 2 (Portaria & Segurança)'}</span>
                    <span>Jupiter Logistics Lda • Emitido em: ${dataEmissao} ${horaEmissao}</span>
                </div>
            `;
        } else if (pagePart === 'PART1') {
            pageFooterHtml = `
                <div class="guia-page-footer">
                    <span>Guia Nº: <strong>${guiaNumber}</strong> • ${isArmazem ? 'Folha 1 de 4 (1ª Via — Armazém / Parte 1)' : 'Folha 3 de 4 (2ª Via — Portaria / Parte 1)'}</span>
                    <span>Jupiter Logistics Lda • Emitido em: ${dataEmissao} ${horaEmissao}</span>
                </div>
            `;
        } else if (pagePart === 'PART2') {
            pageFooterHtml = `
                <div class="guia-page-footer">
                    <span>Guia Nº: <strong>${guiaNumber}</strong> • ${isArmazem ? 'Folha 2 de 4 (1ª Via — Armazém / Conclusão)' : 'Folha 4 de 4 (2ª Via — Portaria / Conclusão)'}</span>
                    <span>Jupiter Logistics Lda • Emitido em: ${dataEmissao} ${horaEmissao}</span>
                </div>
            `;
        }

        const watermarkSize = pagePart === 'HALF' ? '330px' : '440px';
        const containerClass = pagePart === 'HALF' ? 'guia-half' : 'guia-full';

        return `
            <div class="${containerClass}">
                <div class="watermark-bg" style="width: ${watermarkSize}; height: ${watermarkSize};">
                    <img src="${JUPITER_LOGO_DATA_URL}" alt="Jupiter Watermark" />
                </div>
                ${topHeaderHtml}

                <table class="guia-table">
                    <thead>
                        <tr>
                            <th style="width: 38%;">Descrição da Mercadoria</th>
                            <th style="width: 14%; text-align: center;">Volumes Enviados</th>
                            <th style="width: 16%; text-align: center;">Volumes Descarregados</th>
                            <th style="width: 16%; text-align: center; color: ${actionColColor};">${actionColTitle}</th>
                            <th style="width: 16%; text-align: center; color: ${actionColColor};">Saldo Restante Armazém</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                        ${tableFooterRowHtml}
                    </tbody>
                </table>

                ${bottomContentHtml}
                ${pageFooterHtml}
            </div>
        `;
    };

    if (silentDirect) {
        // Modo Impressão Silenciosa Direta no Computador Partilhado
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '0';
        tempContainer.style.top = '0';
        tempContainer.style.width = '210mm';
        tempContainer.style.background = '#ffffff';
        tempContainer.style.opacity = '0';
        tempContainer.style.pointerEvents = 'none';
        tempContainer.style.zIndex = '-9999';
        tempContainer.style.overflow = 'hidden';

        const styleEl = document.createElement('style');
        styleEl.textContent = `
            @page { size: A4 portrait; margin: 4mm 6mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; color: #000000; line-height: 1.35; background: #ffffff; }
            .page-wrapper { width: 210mm; max-width: 210mm; height: 288mm; max-height: 288mm; margin: 0 auto; background: white; padding: 4mm 6mm; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; }
            .guia-half { position: relative; height: 48.5%; max-height: 48.5%; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; overflow: hidden; border: 1.5px solid #000000; border-radius: 6px; padding: 4px 8px; background: #ffffff; }
            .guia-half .header { padding-bottom: 2px; margin-bottom: 2px; }
            .guia-half .header-logo { width: 34px; height: 34px; }
            .guia-half .company-title { font-size: 16px; line-height: 1.1; }
            .guia-half .company-sub { font-size: 8px; line-height: 1.2; margin-top: 1px; }
            .guia-half .doc-info h2 { font-size: 14.5px; line-height: 1.1; }
            .guia-half .doc-info .via-badge { font-size: 8.5px; padding: 1.5px 6px; margin-top: 1px; }
            .guia-half .doc-info .guia-no { font-size: 11px; }
            .guia-half .doc-info .guia-meta { font-size: 8.5px; }
            .guia-half .details-grid { gap: 4px; margin-bottom: 2px; }
            .guia-half .card { padding: 2px 5px; }
            .guia-half .card h3 { font-size: 8.5px; margin-bottom: 1px; padding-bottom: 1px; }
            .guia-half .card p { margin: 1px 0; font-size: 9px; line-height: 1.15; }
            .guia-half .card .lbl { font-size: 8px; }
            .guia-half .card .val { font-size: 9px; }
            .guia-half .card .viatura-val { font-size: 9px; }
            .guia-half .guia-table { margin-bottom: 2px; }
            .guia-half .guia-table th { padding: 2px 4px; font-size: 8.5px; }
            .guia-half .guia-table td { padding: 2px 4px; font-size: 9.5px; }
            .guia-half .row-order-title { gap: 0; }
            .guia-half .order-tag { font-size: 9.5px; line-height: 1.1; }
            .guia-half .order-desc-inline { font-size: 8px; line-height: 1.15; }
            .guia-half .td-num { font-size: 10.5px; }
            .guia-half .write-line { height: 12px; min-width: 45px; }
            .guia-half .vol-unit { font-size: 8px; }
            .guia-half .totals-row td { padding: 2px 4px; font-size: 9.5px; }
            .guia-half .td-manual { font-size: 8.5px; }
            .guia-half .note-box { font-size: 8px; padding: 2px 6px; margin: 1px 0 2px 0; line-height: 1.2; }
            .guia-half .signatures { margin-top: 2px; gap: 14px; }
            .guia-half .sig-box { padding-top: 2px; }
            .guia-half .sig-box p { font-size: 9.5px; }
            .guia-half .sig-box span { font-size: 8px; }
            .guia-full { position: relative; height: 100%; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; overflow: hidden; border: 2px solid #000000; border-radius: 6px; padding: 10px 14px; background: #ffffff; }
            .guia-full .header { padding-bottom: 5px; margin-bottom: 5px; }
            .guia-full .header-logo { width: 46px; height: 46px; }
            .guia-full .company-title { font-size: 20px; }
            .guia-full .doc-info h2 { font-size: 18px; }
            .guia-page-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid #000000; padding-top: 4px; margin-top: 4px; font-size: 9.5px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.02em; }
            .watermark-bg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.11; pointer-events: none; z-index: 0; display: flex; align-items: center; justify-content: center; }
            .watermark-bg img { width: 100%; height: 100%; object-fit: contain; }
            .header, .details-grid, .guia-table, .note-box, .signatures, .guia-page-footer { position: relative; z-index: 1; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000000; padding-bottom: 4px; margin-bottom: 4px; }
            .logo-section { display: flex; align-items: center; gap: 8px; }
            .header-logo { width: 44px; height: 44px; object-fit: contain; }
            .company-title { margin: 0; color: #000000; font-size: 19px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.1; }
            .company-sub { font-size: 9.5px; color: #111827; font-weight: 700; line-height: 1.3; margin-top: 1px; }
            .doc-info { text-align: right; }
            .doc-info h2 { margin: 0; color: #000000; font-size: 17px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.01em; line-height: 1.1; }
            .via-badge { display: inline-block; font-size: 10px; font-weight: 900; padding: 2.5px 8px; border-radius: 4px; letter-spacing: 0.02em; text-transform: uppercase; margin-top: 2px; }
            .guia-no { font-size: 12px; font-weight: 800; color: #000000; margin: 1px 0 0 0; }
            .guia-meta { font-size: 10px; color: #111827; margin: 1px 0 0 0; font-weight: 700; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 4px; }
            .card { border: 1.5px solid #1e293b; padding: 4px 7px; border-radius: 5px; background: #ffffff; }
            .card h3 { margin: 0 0 2px 0; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #000000; letter-spacing: 0.03em; border-bottom: 1.5px solid #64748b; padding-bottom: 1px; }
            .card p { margin: 1.5px 0; font-size: 10.5px; font-weight: 700; color: #000000; display: flex; justify-content: space-between; align-items: baseline; gap: 4px; }
            .card .lbl { color: #1e293b; font-weight: 800; font-size: 10px; white-space: nowrap; flex-shrink: 0; }
            .card .val { color: #000000; font-weight: 900; text-align: right; font-size: 11px; word-break: break-word; }
            .card .viatura-val { color: #000000; font-weight: 900; font-size: 11px; }
            .guia-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; border: 2px solid #000000; border-radius: 4px; overflow: hidden; }
            .guia-table th { background: #e2e8f0; padding: 4px 6px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 900; color: #000000; border-bottom: 2px solid #000000; border-right: 1px solid #475569; }
            .guia-table th:last-child { border-right: none; }
            .guia-table td { padding: 3px 6px; font-size: 11px; font-weight: 800; border-bottom: 1px solid #64748b; border-right: 1px solid #cbd5e1; color: #000000; vertical-align: middle; }
            .guia-table td:last-child { border-right: none; }
            .row-order-title { display: flex; flex-direction: column; gap: 1px; }
            .order-tag { font-size: 11px; font-weight: 900; color: #000000; line-height: 1.15; }
            .order-desc-inline { font-size: 9.5px; font-weight: 700; color: #1e293b; line-height: 1.2; }
            .td-num { text-align: center; font-size: 12.5px; font-weight: 900; color: #000000; }
            .td-action { text-align: center; padding: 2px 4px !important; }
            .write-line { display: inline-block; min-width: 60px; border-bottom: 1.5px dashed #000000; height: 15px; vertical-align: bottom; margin-right: 2px; }
            .vol-unit { font-size: 9.5px; color: #000000; font-weight: 900; }
            .totals-row { background: #f1f5f9; border-top: 2px solid #000000; }
            .totals-row td { border-bottom: none; padding: 4px 6px; font-size: 11.5px; }
            .td-manual { text-align: center; font-size: 10px; color: #1e293b; font-weight: 800; font-style: italic; }
            .note-box { font-size: 10px; color: #000000; font-weight: 700; border: 1px solid #cbd5e1; border-left-width: 4px; padding: 3.5px 8px; line-height: 1.35; margin: 2px 0 4px 0; background: #f8fafc; border-radius: 0 4px 4px 0; }
            .note-box strong { font-weight: 900; color: #000000; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 3px; }
            .sig-box { border-top: 2px solid #000000; padding-top: 3px; text-align: center; }
            .sig-box p { margin: 0; font-size: 11px; font-weight: 900; color: #000000; }
            .sig-box span { font-size: 9.5px; font-weight: 700; color: #1e293b; }
            .cut-separator { height: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #000000; font-size: 9.5px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; user-select: none; margin: 1px 0; }
            .cut-line { flex: 1; border-top: 1.5px dashed #475569; }
            .cut-scissors { font-size: 13px; color: #000000; }
        `;
        tempContainer.appendChild(styleEl);

        if (printMode === '4_FOLHAS') {
            // Emissão em 4 Folhas A4 (2 para Armazém e 2 para Portaria)
            const p1 = document.createElement('div');
            p1.className = 'page-wrapper';
            p1.innerHTML = generateViaHtml('ARMAZEM', 'PART1');

            const p2 = document.createElement('div');
            p2.className = 'page-wrapper';
            p2.innerHTML = generateViaHtml('ARMAZEM', 'PART2');

            const p3 = document.createElement('div');
            p3.className = 'page-wrapper';
            p3.innerHTML = generateViaHtml('PORTARIA', 'PART1');

            const p4 = document.createElement('div');
            p4.className = 'page-wrapper';
            p4.innerHTML = generateViaHtml('PORTARIA', 'PART2');

            tempContainer.appendChild(p1);
            tempContainer.appendChild(p2);
            tempContainer.appendChild(p3);
            tempContainer.appendChild(p4);
        } else if (printMode === '2_FOLHAS') {
            // Emissão em 2 Folhas A4 completas (1 para Armazém e 1 para Portaria)
            const page1 = document.createElement('div');
            page1.className = 'page-wrapper';
            page1.innerHTML = generateViaHtml('ARMAZEM', 'FULL');

            const page2 = document.createElement('div');
            page2.className = 'page-wrapper';
            page2.innerHTML = generateViaHtml('PORTARIA', 'FULL');

            tempContainer.appendChild(page1);
            tempContainer.appendChild(page2);
        } else {
            // Emissão padrão em 1 folha única com 2 vias e destaque
            const wrapperDiv = document.createElement('div');
            wrapperDiv.id = 'guia-page-wrapper';
            wrapperDiv.className = 'page-wrapper';
            wrapperDiv.innerHTML = `
                ${generateViaHtml('ARMAZEM', 'HALF')}
                <div class="cut-separator">
                    <span class="cut-scissors">✂</span>
                    <div class="cut-line"></div>
                    <span>DESTAQUE AQUI — 1ª VIA RETIDA NO ARMAZÉM / 2ª VIA RETIDA NA PORTARIA</span>
                    <div class="cut-line"></div>
                    <span class="cut-scissors">✂</span>
                </div>
                ${generateViaHtml('PORTARIA', 'HALF')}
            `;
            tempContainer.appendChild(wrapperDiv);
        }
        document.body.appendChild(tempContainer);

        try {
            const pagesWord = printMode === '4_FOLHAS' ? '4 Folhas' : (printMode === '2_FOLHAS' ? '2 Folhas' : 'Folha Única');
            toast(`⚡ A renderizar PDF de ${pagesWord} da Guia...`, 'info');
            const fileBase64 = await printService.elementToPdfBase64(tempContainer, window);
            // Resolver impressora selecionada ou predefinida do servidor
            let targetPrinter = printService.getSelectedPrinter();
            if (!targetPrinter || targetPrinter === 'Armazem print') {
                const pRes = await printService.getPrinters();
                if (pRes && pRes.ok && pRes.impressoras && pRes.impressoras.length > 0) {
                    if (pRes.impressora_configurada && pRes.impressoras.includes(pRes.impressora_configurada) && pRes.impressora_configurada !== 'Armazem print') {
                        targetPrinter = pRes.impressora_configurada;
                    } else if (pRes.impressoras.includes('Hewlett-Packard HP LaserJet Pro MFP M125nw')) {
                        targetPrinter = 'Hewlett-Packard HP LaserJet Pro MFP M125nw';
                    } else if (pRes.impressoras.includes('Armazem')) {
                        targetPrinter = 'Armazem';
                    } else if (pRes.padrao && pRes.padrao !== 'Armazem print') {
                        targetPrinter = pRes.padrao;
                    } else {
                        targetPrinter = pRes.impressoras[0];
                    }
                    printService.setSelectedPrinter(targetPrinter);
                }
            }
            if (!targetPrinter || targetPrinter === 'Armazem print') targetPrinter = 'Hewlett-Packard HP LaserJet Pro MFP M125nw';

            const serverUrl = printService.getServerUrl();
            toast(`⚡ A enviar para a impressora [${targetPrinter}] (${serverUrl.replace(/^https?:\/\//, '')})...`, 'info');

            const res = await printService.printDocument({
                nome: `Guia_Dupla_${guiaNumber}.pdf`,
                arquivoBase64: fileBase64,
                impressora: targetPrinter,
                serverUrl: serverUrl
            });

            toast(`✅ Guia Dupla (${guiaNumber} • ${pagesWord}) impressa com sucesso no Armazém [${res.impressora || targetPrinter}]!`, 'success');
        } catch (err) {
            console.error('[ERRO DIRECT PRINT]', err);
            toast(`Erro na impressão direta: ${err.message}. A abrir visualização...`, 'error');
            printDeliveryNote(client, false);
        } finally {
            if (tempContainer.parentNode) {
                tempContainer.parentNode.removeChild(tempContainer);
            }
        }
        return;
    }

    const printWindow = window.open('', '_blank', 'width=940,height=980');
    if (!printWindow) {
        toast('Bloqueador de popups detetado. Por favor autorize popups para emitir a Guia.', 'warning');
        return;
    }

    const defaultServerUrl = printService.getServerUrl();
    const defaultPrinter = printService.getSelectedPrinter();
    const defaultToken = printService.getApiToken();
    const appOrigin = window.location.origin;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt">
        <head>
            <meta charset="UTF-8">
            <base href="${appOrigin}/">
            <title>Guia Dupla Oficial - ${clientName} (${guiaNumber})</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 4mm 6mm;
                }
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
                body {
                    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                    color: #000000;
                    line-height: 1.35;
                    background: #f1f5f9;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                /* Barra Superior de Controlo de Impressão */
                .btn-print-bar {
                    background: #0f172a;
                    color: white;
                    padding: 10px 18px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .bar-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .bar-title {
                    font-size: 14px;
                    font-weight: 900;
                    letter-spacing: -0.01em;
                }
                .bar-sub {
                    font-size: 10px;
                    color: #94a3b8;
                    font-weight: 700;
                }
                .server-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 10.5px;
                    font-weight: 800;
                    padding: 4px 10px;
                    border-radius: 9999px;
                    cursor: pointer;
                    transition: all 0.2s;
                    user-select: none;
                }
                .server-badge:hover {
                    opacity: 0.9;
                    transform: scale(1.02);
                }
                .badge-checking {
                    background: #334155;
                    color: #e2e8f0;
                    border: 1px solid #475569;
                }
                .badge-online {
                    background: #064e3b;
                    color: #6ee7b7;
                    border: 1px solid #059669;
                }
                .badge-offline {
                    background: #881337;
                    color: #fecdd3;
                    border: 1px solid #e11d48;
                }
                .badge-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: currentColor;
                }
                .bar-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .printer-group {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #1e293b;
                    padding: 3px 8px;
                    border-radius: 8px;
                    border: 1px solid #334155;
                }
                .printer-label {
                    font-size: 11px;
                    font-weight: 700;
                    color: #94a3b8;
                }
                .printer-select {
                    background: #0f172a;
                    color: #f8fafc;
                    font-size: 11.5px;
                    font-weight: 700;
                    border: 1px solid #475569;
                    padding: 5px 10px;
                    border-radius: 6px;
                    outline: none;
                    cursor: pointer;
                    max-width: 220px;
                }
                .btn-icon {
                    background: #334155;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 5px 8px;
                    cursor: pointer;
                    font-size: 11px;
                }
                .btn-icon:hover {
                    background: #475569;
                }
                .btn-direct {
                    background: #16a34a;
                    color: white;
                    font-weight: 900;
                    font-size: 12.5px;
                    border: none;
                    padding: 7px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    box-shadow: 0 2px 6px rgba(22, 163, 74, 0.4);
                    transition: all 0.2s;
                }
                .btn-direct:hover:not(:disabled) {
                    background: #15803d;
                    transform: translateY(-1px);
                }
                .btn-direct:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .btn-secondary {
                    background: #334155;
                    color: white;
                    font-weight: 800;
                    font-size: 11px;
                    border: none;
                    padding: 7px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-secondary:hover {
                    background: #475569;
                }
                .btn-browser {
                    background: #2563eb;
                    color: white;
                    font-weight: 800;
                    font-size: 11px;
                    border: none;
                    padding: 7px 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-browser:hover {
                    background: #1d4ed8;
                }

                /* Toast de Notificação na Janela */
                #print-toast {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 10000;
                    padding: 12px 20px;
                    border-radius: 10px;
                    font-size: 12px;
                    font-weight: 800;
                    color: white;
                    display: none;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                    transition: all 0.3s;
                }
                .toast-success { background: #059669; }
                .toast-error { background: #dc2626; }
                .toast-info { background: #2563eb; }

                /* Folha A4 */
                .page-wrapper {
                    width: 210mm;
                    max-width: 210mm;
                    height: 288mm;
                    max-height: 288mm;
                    margin: 12px auto;
                    background: white;
                    padding: 4mm 6mm;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-sizing: border-box;
                    box-shadow: 0 4px 25px rgba(0,0,0,0.15);
                }
                .guia-half {
                    position: relative;
                    height: 48.5%;
                    max-height: 48.5%;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-sizing: border-box;
                    overflow: hidden;
                    border: 1.5px solid #000000;
                    border-radius: 6px;
                    padding: 4px 8px;
                    background: #ffffff;
                }
                .guia-half .header { padding-bottom: 2px; margin-bottom: 2px; }
                .guia-half .header-logo { width: 34px; height: 34px; }
                .guia-half .company-title { font-size: 16px; line-height: 1.1; }
                .guia-half .company-sub { font-size: 8px; line-height: 1.2; margin-top: 1px; }
                .guia-half .doc-info h2 { font-size: 14.5px; line-height: 1.1; }
                .guia-half .doc-info .via-badge { font-size: 8.5px; padding: 1.5px 6px; margin-top: 1px; }
                .guia-half .doc-info .guia-no { font-size: 11px; }
                .guia-half .doc-info .guia-meta { font-size: 8.5px; }
                .guia-half .details-grid { gap: 4px; margin-bottom: 2px; }
                .guia-half .card { padding: 2px 5px; }
                .guia-half .card h3 { font-size: 8.5px; margin-bottom: 1px; padding-bottom: 1px; }
                .guia-half .card p { margin: 1px 0; font-size: 9px; line-height: 1.15; }
                .guia-half .card .lbl { font-size: 8px; }
                .guia-half .card .val { font-size: 9px; }
                .guia-half .card .viatura-val { font-size: 9px; }
                .guia-half .guia-table { margin-bottom: 2px; }
                .guia-half .guia-table th { padding: 2px 4px; font-size: 8.5px; }
                .guia-half .guia-table td { padding: 2px 4px; font-size: 9.5px; }
                .guia-half .row-order-title { gap: 0; }
                .guia-half .order-tag { font-size: 9.5px; line-height: 1.1; }
                .guia-half .order-desc-inline { font-size: 8px; line-height: 1.15; }
                .guia-half .td-num { font-size: 10.5px; }
                .guia-half .write-line { height: 12px; min-width: 45px; }
                .guia-half .vol-unit { font-size: 8px; }
                .guia-half .totals-row td { padding: 2px 4px; font-size: 9.5px; }
                .guia-half .td-manual { font-size: 8.5px; }
                .guia-half .note-box { font-size: 8px; padding: 2px 6px; margin: 1px 0 2px 0; line-height: 1.2; }
                .guia-half .signatures { margin-top: 2px; gap: 14px; }
                .guia-half .sig-box { padding-top: 2px; }
                .guia-half .sig-box p { font-size: 9.5px; }
                .guia-half .sig-box span { font-size: 8px; }
                .guia-full {
                    position: relative;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-sizing: border-box;
                    overflow: hidden;
                    border: 2px solid #000000;
                    border-radius: 6px;
                    padding: 10px 14px;
                    background: #ffffff;
                }
                .guia-full .header {
                    padding-bottom: 5px;
                    margin-bottom: 5px;
                }
                .guia-full .header-logo {
                    width: 46px;
                    height: 46px;
                }
                .guia-full .company-title {
                    font-size: 20px;
                }
                .guia-full .doc-info h2 {
                    font-size: 18px;
                }
                .guia-page-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-top: 1.5px solid #000000;
                    padding-top: 4px;
                    margin-top: 4px;
                    font-size: 9.5px;
                    font-weight: 800;
                    color: #1e293b;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                .page-divider-screen {
                    width: 210mm;
                    margin: 20px auto 12px auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #475569;
                    font-size: 11px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    user-select: none;
                }
                .page-divider-screen::before, .page-divider-screen::after {
                    content: '';
                    flex: 1;
                    border-top: 2px dashed #94a3b8;
                    margin: 0 16px;
                }
                .watermark-bg {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    opacity: 0.11;
                    pointer-events: none;
                    z-index: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .watermark-bg img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .header, .details-grid, .guia-table, .note-box, .signatures, .guia-page-footer {
                    position: relative;
                    z-index: 1;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #000000;
                    padding-bottom: 4px;
                    margin-bottom: 4px;
                }
                .logo-section {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .header-logo {
                    width: 44px;
                    height: 44px;
                    object-fit: contain;
                }
                .company-title {
                    margin: 0;
                    color: #000000;
                    font-size: 19px;
                    font-weight: 900;
                    letter-spacing: -0.02em;
                    line-height: 1.1;
                }
                .company-sub {
                    font-size: 9.5px;
                    color: #111827;
                    font-weight: 700;
                    line-height: 1.3;
                    margin-top: 1px;
                }
                .doc-info {
                    text-align: right;
                }
                .doc-info h2 {
                    margin: 0;
                    color: #000000;
                    font-size: 17px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.01em;
                    line-height: 1.1;
                }
                .via-badge {
                    display: inline-block;
                    font-size: 10px;
                    font-weight: 900;
                    padding: 2.5px 8px;
                    border-radius: 4px;
                    letter-spacing: 0.02em;
                    text-transform: uppercase;
                    margin-top: 2px;
                }
                .guia-no {
                    font-size: 12px;
                    font-weight: 800;
                    color: #000000;
                    margin: 1px 0 0 0;
                }
                .guia-no strong {
                    font-weight: 900;
                    color: #000000;
                }
                .guia-meta {
                    font-size: 10px;
                    color: #111827;
                    margin: 1px 0 0 0;
                    font-weight: 700;
                }
                .guia-meta strong {
                    color: #000000;
                }
                .details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 6px;
                    margin-bottom: 4px;
                }
                .card {
                    border: 1.5px solid #1e293b;
                    padding: 4px 7px;
                    border-radius: 5px;
                    background: #ffffff;
                }
                .card h3 {
                    margin: 0 0 2px 0;
                    font-size: 10px;
                    font-weight: 900;
                    text-transform: uppercase;
                    color: #000000;
                    letter-spacing: 0.03em;
                    border-bottom: 1.5px solid #64748b;
                    padding-bottom: 1px;
                }
                .card p {
                    margin: 1.5px 0;
                    font-size: 10.5px;
                    font-weight: 700;
                    color: #000000;
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    gap: 4px;
                }
                .card .lbl {
                    color: #1e293b;
                    font-weight: 800;
                    font-size: 10px;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .card .val {
                    color: #000000;
                    font-weight: 900;
                    text-align: right;
                    font-size: 11px;
                    word-break: break-word;
                }
                .card .viatura-val {
                    color: #000000;
                    font-weight: 900;
                    font-size: 11px;
                }
                .guia-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 4px;
                    border: 2px solid #000000;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .guia-table th {
                    background: #e2e8f0;
                    padding: 4px 6px;
                    text-align: left;
                    font-size: 10px;
                    text-transform: uppercase;
                    font-weight: 900;
                    color: #000000;
                    border-bottom: 2px solid #000000;
                    border-right: 1px solid #475569;
                }
                .guia-table th:last-child {
                    border-right: none;
                }
                .guia-table td {
                    padding: 3px 6px;
                    font-size: 11px;
                    font-weight: 800;
                    border-bottom: 1px solid #64748b;
                    border-right: 1px solid #cbd5e1;
                    color: #000000;
                    vertical-align: middle;
                }
                .guia-table td:last-child {
                    border-right: none;
                }
                .row-order-title {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }
                .order-tag {
                    font-size: 11px;
                    font-weight: 900;
                    color: #000000;
                    line-height: 1.15;
                }
                .order-desc-inline {
                    font-size: 9.5px;
                    font-weight: 700;
                    color: #1e293b;
                    line-height: 1.2;
                }
                .td-num {
                    text-align: center;
                    font-size: 12.5px;
                    font-weight: 900;
                    color: #000000;
                }
                .td-action {
                    text-align: center;
                    padding: 2px 4px !important;
                }
                .write-line {
                    display: inline-block;
                    min-width: 60px;
                    border-bottom: 1.5px dashed #000000;
                    height: 15px;
                    vertical-align: bottom;
                    margin-right: 2px;
                }
                .vol-unit {
                    font-size: 9.5px;
                    color: #000000;
                    font-weight: 900;
                }
                .totals-row {
                    background: #f1f5f9;
                    border-top: 2px solid #000000;
                }
                .totals-row td {
                    border-bottom: none;
                    padding: 4px 6px;
                    font-size: 11.5px;
                }
                .td-manual {
                    text-align: center;
                    font-size: 10px;
                    color: #1e293b;
                    font-weight: 800;
                    font-style: italic;
                }
                .note-box {
                    font-size: 10px;
                    color: #000000;
                    font-weight: 700;
                    border: 1px solid #cbd5e1;
                    border-left-width: 4px;
                    padding: 3.5px 8px;
                    line-height: 1.35;
                    margin: 2px 0 4px 0;
                    background: #f8fafc;
                    border-radius: 0 4px 4px 0;
                }
                .note-box strong {
                    font-weight: 900;
                    color: #000000;
                }
                .signatures {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    margin-top: 3px;
                }
                .sig-box {
                    border-top: 2px solid #000000;
                    padding-top: 3px;
                    text-align: center;
                }
                .sig-box p {
                    margin: 0;
                    font-size: 11px;
                    font-weight: 900;
                    color: #000000;
                }
                .sig-box span {
                    font-size: 9.5px;
                    font-weight: 700;
                    color: #1e293b;
                }
                .cut-separator {
                    height: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    color: #000000;
                    font-size: 9.5px;
                    font-weight: 900;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    user-select: none;
                    margin: 1px 0;
                }
                .cut-line {
                    flex: 1;
                    border-top: 1.5px dashed #475569;
                }
                .cut-scissors {
                    font-size: 13px;
                    color: #000000;
                }

                /* Modal de Configuração Rápida */
                #modal-config {
                    display: none;
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(4px);
                    z-index: 2000;
                    align-items: center;
                    justify-content: center;
                }
                .modal-box {
                    background: white;
                    width: 90%;
                    max-width: 450px;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                }
                .modal-box h3 {
                    margin-top: 0;
                    font-size: 16px;
                    font-weight: 900;
                    color: #0f172a;
                    text-transform: uppercase;
                }
                .form-group {
                    margin-bottom: 14px;
                }
                .form-group label {
                    display: block;
                    font-size: 11px;
                    font-weight: 800;
                    color: #475569;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }
                .form-group input {
                    width: 100%;
                    padding: 8px 12px;
                    font-size: 13px;
                    font-weight: 700;
                    border: 1.5px solid #cbd5e1;
                    border-radius: 8px;
                    outline: none;
                }
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                    margin-top: 18px;
                }

                @media print {
                    .btn-print-bar, #modal-config, #print-toast, .page-divider-screen { display: none !important; }
                    body { background: white !important; margin: 0 !important; }
                    .page-wrapper {
                        padding: 4mm 6mm !important;
                        margin: 0 !important;
                        width: 100% !important;
                        height: 288mm !important;
                        max-height: 288mm !important;
                        box-shadow: none !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                    }
                    .page-wrapper:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    .guia-half, .guia-full {
                        page-break-inside: avoid !important;
                    }
                }
            </style>
        </head>
        <body>
            <!-- Barra Superior de Impressão Direta -->
            <div class="btn-print-bar">
                <div class="bar-left">
                    <div>
                        <div class="bar-title">Guia Dupla Oficial (A4)</div>
                        <div class="bar-sub">${printMode === '4_FOLHAS' ? `📄 4 Folhas (${totalOrdersCount} Ordens • 2 Folhas Armazém + 2 Folhas Portaria)` : (printMode === '2_FOLHAS' ? `📄 2 Folhas (${totalOrdersCount} Ordens • Folha 1: Armazém • Folha 2: Portaria)` : `📄 Folha Única Dupla (${totalOrdersCount} ${totalOrdersCount === 1 ? 'Ordem' : 'Ordens'} • ✂ Destaque Armazém & Portaria)`)}</div>
                    </div>
                    <div id="status-badge" class="server-badge badge-checking" onclick="openServerConfigModal()" title="Clique para ver ou alterar o IP do servidor de impressão">
                        <span class="badge-dot"></span>
                        <span id="status-text">A verificar...</span>
                    </div>
                </div>

                <div class="bar-actions">
                    <div class="printer-group">
                        <span class="printer-label">🖨️</span>
                        <select id="printer-select" class="printer-select" onchange="onPrinterChange(this.value)">
                            <option value="">A carregar impressoras...</option>
                        </select>
                        <button type="button" class="btn-icon" onclick="reloadPrinters()" title="Atualizar impressoras">🔄</button>
                    </div>

                    <button id="btn-direct-print" class="btn-direct" onclick="triggerDirectPrint()" title="Imprimir diretamente na impressora de rede sem diálogo">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                        <span>Imprimir Direto</span>
                    </button>

                    <button class="btn-secondary" onclick="openServerConfigModal()" title="Configurações de Rede">
                        ⚙️ Servidor
                    </button>

                    <button class="btn-browser" onclick="window.print()" title="Imprimir pelo diálogo do navegador ou guardar PDF">
                        🖨️ Navegador
                    </button>
                </div>
            </div>

            <div id="print-toast"></div>

            <!-- Modal de Configuração do Servidor de Impressão -->
            <div id="modal-config">
                <div class="modal-box">
                    <h3>Servidor de Impressão em Rede</h3>
                    <p style="font-size: 11px; color: #64748b; margin-bottom: 14px;">Endereço do computador onde corre o servidor Python</p>
                    
                    <div class="form-group">
                        <label>URL / IP do Servidor</label>
                        <input type="text" id="cfg-server-url" value="${defaultServerUrl}" placeholder="http://192.168.88.10:5000">
                    </div>
                    <div class="form-group">
                        <label>Token de API (Opcional)</label>
                        <input type="password" id="cfg-server-token" placeholder="Deixar vazio se não configurado">
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeServerConfigModal()">Fechar</button>
                        <button type="button" class="btn-browser" onclick="testConnectionFromModal()">Testar</button>
                        <button type="button" class="btn-direct" onclick="saveServerConfigFromModal()">Gravar</button>
                    </div>
                </div>
            </div>

            <!-- Conteúdo da Guia: 4 Folhas, 2 Folhas ou 1 Folha Dupla com Destaque -->
            ${printMode === '4_FOLHAS' ? `
                <!-- Folha 1: 1ª Via Armazém (Parte 1/2) -->
                <div id="guia-page-1" class="page-wrapper">
                    ${generateViaHtml('ARMAZEM', 'PART1')}
                </div>
                <div class="page-divider-screen">
                    <span>FOLHA 2 — 1ª VIA ARMAZÉM / CONFERÊNCIA (PARTE 2 / CONCLUSÃO)</span>
                </div>
                <!-- Folha 2: 1ª Via Armazém (Conclusão) -->
                <div id="guia-page-2" class="page-wrapper">
                    ${generateViaHtml('ARMAZEM', 'PART2')}
                </div>
                <div class="page-divider-screen" style="border-top-color: #3b82f6;">
                    <span>FOLHA 3 — 2ª VIA PORTARIA & SEGURANÇA (PARTE 1/2)</span>
                </div>
                <!-- Folha 3: 2ª Via Portaria (Parte 1/2) -->
                <div id="guia-page-3" class="page-wrapper">
                    ${generateViaHtml('PORTARIA', 'PART1')}
                </div>
                <div class="page-divider-screen">
                    <span>FOLHA 4 — 2ª VIA PORTARIA & SEGURANÇA (PARTE 2 / CONCLUSÃO)</span>
                </div>
                <!-- Folha 4: 2ª Via Portaria (Conclusão) -->
                <div id="guia-page-4" class="page-wrapper">
                    ${generateViaHtml('PORTARIA', 'PART2')}
                </div>
            ` : (printMode === '2_FOLHAS' ? `
                <!-- Folha 1: Armazém e Conferência -->
                <div id="guia-page-1" class="page-wrapper">
                    ${generateViaHtml('ARMAZEM', 'FULL')}
                </div>
                <div class="page-divider-screen">
                    <span>FOLHA 2 — PORTARIA & SEGURANÇA</span>
                </div>
                <!-- Folha 2: Portaria e Segurança -->
                <div id="guia-page-2" class="page-wrapper">
                    ${generateViaHtml('PORTARIA', 'FULL')}
                </div>
            ` : `
                <!-- Folha Única Dupla com Destaque -->
                <div id="guia-page-wrapper" class="page-wrapper">
                    ${generateViaHtml('ARMAZEM', 'HALF')}
                    <div class="cut-separator">
                        <span class="cut-scissors">✂</span>
                        <div class="cut-line"></div>
                        <span>DESTAQUE AQUI — 1ª VIA RETIDA NO ARMAZÉM / 2ª VIA RETIDA NA PORTARIA</span>
                        <div class="cut-line"></div>
                        <span class="cut-scissors">✂</span>
                    </div>
                    ${generateViaHtml('PORTARIA', 'HALF')}
                </div>
            `)}

            <script>
                const APP_ORIGIN = '${appOrigin}';
                const SERVER_STORAGE_KEY = 'printer_server_url';
                const PRINTER_STORAGE_KEY = 'printer_selected_name';
                const TOKEN_STORAGE_KEY = 'printer_api_token';

                function getServerUrl() {
                    try {
                        const val = localStorage.getItem(SERVER_STORAGE_KEY);
                        if (val && val.trim()) return val.trim();
                    } catch (e) {}
                    if (window.opener && window.opener.printService) {
                        try { return window.opener.printService.getServerUrl(); } catch (e) {}
                    }
                    return '${defaultServerUrl}';
                }

                function getSelectedPrinter() {
                    try {
                        const val = localStorage.getItem(PRINTER_STORAGE_KEY);
                        if (val && val.trim() && val.trim() !== 'Armazem print') return val.trim();
                    } catch (e) {}
                    if (window.opener && window.opener.printService) {
                        try {
                            const op = window.opener.printService.getSelectedPrinter();
                            if (op && op.trim() && op.trim() !== 'Armazem print') return op.trim();
                        } catch (e) {}
                    }
                    const def = '${defaultPrinter}';
                    return (def && def !== 'Armazem print') ? def : 'Armazem';
                }

                function getApiToken() {
                    try {
                        const val = localStorage.getItem(TOKEN_STORAGE_KEY);
                        if (val && val.trim()) return val.trim();
                    } catch (e) {}
                    if (window.opener && window.opener.printService) {
                        try { return window.opener.printService.getApiToken(); } catch (e) {}
                    }
                    return '${defaultToken}';
                }

                function showNotice(msg, type = 'info') {
                    const toast = document.getElementById('print-toast');
                    if (!toast) return;
                    toast.className = type === 'success' ? 'toast-success' : (type === 'error' ? 'toast-error' : 'toast-info');
                    toast.textContent = msg;
                    toast.style.display = 'block';
                    setTimeout(() => { toast.style.display = 'none'; }, 4500);
                }

                async function checkStatus() {
                    const badge = document.getElementById('status-badge');
                    const text = document.getElementById('status-text');
                    badge.className = 'server-badge badge-checking';
                    text.textContent = 'A verificar...';

                    const serverUrl = getServerUrl();
                    const token = getApiToken();

                    // Prioridade 1: Usar o printService da janela principal (contexto completo e autenticado)
                    if (window.opener && window.opener.printService && typeof window.opener.printService.checkStatus === 'function') {
                        try {
                            const status = await window.opener.printService.checkStatus(serverUrl);
                            if (status && status.ok) {
                                badge.className = 'server-badge badge-online';
                                text.textContent = 'Online (' + (status.total_impressoras || 'Rede') + ' imp.)';
                                badge.title = 'Servidor ativo: ' + (status.serverUrl || serverUrl) + (status.isDirect ? ' (Direto)' : ' (Proxy)');
                                const btnDirect = document.getElementById('btn-direct-print');
                                if (btnDirect) btnDirect.disabled = false;
                                return true;
                            }
                        } catch (errOpener) {
                            console.warn('[printWindow] Falha ao verificar status via window.opener:', errOpener);
                        }
                    }

                    // Prioridade 2: Tentar diretamente no computador partilhado (192.168.88.10:5000)
                    try {
                        const controller = new AbortController();
                        const to = setTimeout(() => controller.abort(), 2500);
                        const h = {};
                        if (token) h['Authorization'] = 'Bearer ' + token;
                        const directRes = await fetch(serverUrl + '/api/status', { method: 'GET', headers: h, signal: to });
                        clearTimeout(to);
                        if (directRes.ok) {
                            const data = await directRes.json();
                            badge.className = 'server-badge badge-online';
                            text.textContent = 'Online (' + (data.total_impressoras || 'Rede') + ' imp.)';
                            badge.title = 'Conectado diretamente ao computador partilhado: ' + serverUrl;
                            const btnDirect = document.getElementById('btn-direct-print');
                            if (btnDirect) btnDirect.disabled = false;
                            return true;
                        }
                    } catch (e) {
                        // Prossegue para o proxy se o navegador restringir direto
                    }

                    // Prioridade 3: Fallback via proxy Express do servidor web
                    try {
                        const params = new URLSearchParams({ serverUrl });
                        if (token) params.set('token', token);
                        const proxyUrl = APP_ORIGIN + '/api/print/status?' + params.toString();
                        const res = await fetch(proxyUrl);
                        const data = await res.json();
                        if (data && data.ok) {
                            badge.className = 'server-badge badge-online';
                            text.textContent = 'Online (' + (data.total_impressoras || 'Rede') + ' imp.)';
                            badge.title = 'Servidor ativo via proxy: ' + serverUrl;
                            const btnDirect = document.getElementById('btn-direct-print');
                            if (btnDirect) btnDirect.disabled = false;
                            return true;
                        } else {
                            badge.className = 'server-badge badge-offline';
                            text.textContent = 'Offline';
                            badge.title = (data && data.error) ? data.error : 'Servidor inacessível';
                            return false;
                        }
                    } catch (e) {
                        badge.className = 'server-badge badge-offline';
                        text.textContent = 'Offline';
                        badge.title = 'Inicie o servidor de impressão na rede';
                        return false;
                    }
                }

                async function reloadPrinters() {
                    const select = document.getElementById('printer-select');
                    select.innerHTML = '<option value="">A carregar impressoras...</option>';

                    const serverUrl = getServerUrl();
                    const token = getApiToken();

                    let printers = null;
                    let padrao = null;

                    // Prioridade 1: Usar printService da janela principal
                    if (window.opener && window.opener.printService && typeof window.opener.printService.getPrinters === 'function') {
                        try {
                            const resOp = await window.opener.printService.getPrinters(serverUrl);
                            if (resOp && resOp.ok && resOp.impressoras) {
                                printers = resOp.impressoras;
                                padrao = resOp.padrao;
                            }
                        } catch (e) {}
                    }

                    // Prioridade 2: Tentar diretamente no computador partilhado
                    if (!printers) {
                        try {
                            const controller = new AbortController();
                            const to = setTimeout(() => controller.abort(), 3500);
                            const h = {};
                            if (token) h['Authorization'] = 'Bearer ' + token;
                            const directRes = await fetch(serverUrl + '/api/impressoras', { method: 'GET', headers: h, signal: to });
                            clearTimeout(to);
                            if (directRes.ok) {
                                const data = await directRes.json();
                                printers = data.impressoras;
                                padrao = data.padrao;
                            }
                        } catch (e) {}
                    }

                    // Prioridade 3: Fallback via proxy backend
                    if (!printers) {
                        try {
                            const params = new URLSearchParams({ serverUrl });
                            if (token) params.set('token', token);
                            const proxyUrl = APP_ORIGIN + '/api/print/impressoras?' + params.toString();
                            const res = await fetch(proxyUrl);
                            const data = await res.json();
                            if (data && data.ok && data.impressoras) {
                                printers = data.impressoras;
                                padrao = data.padrao;
                            }
                        } catch (e) {}
                    }

                    if (printers && printers.length > 0) {
                        const previousVal = select.value && !select.value.includes('carregar') ? select.value : '';
                        select.innerHTML = '';
                        const saved = previousVal || getSelectedPrinter();
                        let defaultTarget = '';
                        if (saved && printers.includes(saved) && saved !== 'Armazem print' && saved !== 'Armazem') {
                            defaultTarget = saved;
                        } else if (printers.includes('Hewlett-Packard HP LaserJet Pro MFP M125nw')) {
                            defaultTarget = 'Hewlett-Packard HP LaserJet Pro MFP M125nw';
                        } else if (padrao && printers.includes(padrao) && padrao !== 'Armazem print' && padrao !== 'Armazem') {
                            defaultTarget = padrao;
                        } else {
                            defaultTarget = printers[0];
                        }

                        printers.forEach(p => {
                            const opt = document.createElement('option');
                            opt.value = p;
                            let lbl = p;
                            if (p === defaultTarget) lbl += ' ★ (Selecionada)';
                            else if (p === padrao) lbl += ' (Padrão Windows)';
                            opt.textContent = lbl;
                            if (p === defaultTarget) opt.selected = true;
                            select.appendChild(opt);
                        });
                        try { localStorage.setItem(PRINTER_STORAGE_KEY, select.value); } catch(e){}
                        if (window.opener?.printService) {
                            try { window.opener.printService.setSelectedPrinter(select.value); } catch(e){}
                        }
                    } else {
                        select.innerHTML = '<option value="">Nenhuma impressora disponível</option>';
                    }
                }

                function onPrinterChange(val) {
                    if (val) {
                        try { localStorage.setItem(PRINTER_STORAGE_KEY, val); } catch(e){}
                        if (window.opener?.printService) {
                            try { window.opener.printService.setSelectedPrinter(val); } catch(e){}
                        }
                        fetch(APP_ORIGIN + '/api/print/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ impressora: val })
                        }).catch(() => {});
                        showNotice('Impressora ativa: ' + val, 'info');
                    }
                }

                async function triggerDirectPrint() {
                    const btn = document.getElementById('btn-direct-print');
                    const select = document.getElementById('printer-select');
                    const selectedPrinter = select ? select.value : '';
                    const serverUrl = getServerUrl();
                    const token = getApiToken();

                    if (!selectedPrinter) {
                        showNotice('Por favor selecione uma impressora válida.', 'error');
                        return;
                    }

                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<span>⚡ A renderizar Guia...</span>';

                    try {
                        const pages = Array.from(document.querySelectorAll('.page-wrapper'));
                        if (pages.length === 0) throw new Error('Nenhuma folha da Guia encontrada para impressão.');

                        btn.innerHTML = '<span>⚡ A renderizar Guia (' + pages.length + (pages.length > 1 ? ' folhas' : ' folha') + ')...</span>';

                        let fileBase64 = '';
                        let fileName = 'Guia_${guiaNumber}.pdf';

                        // Renderizar cada folha (.page-wrapper) em alta resolução e compilar no jsPDF
                        const jspdfModule = window.jspdf;
                        if (jspdfModule && (jspdfModule.jsPDF || typeof jspdfModule === 'function')) {
                            const JsPdfClass = jspdfModule.jsPDF || jspdfModule;
                            const pdf = new JsPdfClass({
                                orientation: 'portrait',
                                unit: 'mm',
                                format: 'a4'
                            });

                            for (let i = 0; i < pages.length; i++) {
                                if (i > 0) {
                                    pdf.addPage();
                                }
                                const canvas = await html2canvas(pages[i], {
                                    scale: 2.2,
                                    useCORS: true,
                                    allowTaint: true,
                                    backgroundColor: '#ffffff',
                                    logging: false,
                                    windowWidth: 1200
                                });
                                const imgData = canvas.toDataURL('image/png');
                                pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
                            }
                            fileBase64 = pdf.output('datauristring').split(',')[1];
                        } else {
                            const canvas = await html2canvas(pages[0], {
                                scale: 2.2,
                                useCORS: true,
                                allowTaint: true,
                                backgroundColor: '#ffffff',
                                logging: false,
                                windowWidth: 1200
                            });
                            fileBase64 = canvas.toDataURL('image/png').split(',')[1];
                            fileName = 'Guia_${guiaNumber}.png';
                        }

                        btn.innerHTML = '<span>⚡ A enviar para o computador partilhado...</span>';

                        let printSuccess = false;
                        let printerUsed = selectedPrinter;

                        // 3. Prioridade 1: Usar window.opener.printService (contexto validado na janela principal)
                        if (window.opener && window.opener.printService && typeof window.opener.printService.printDocument === 'function') {
                            try {
                                const resOp = await window.opener.printService.printDocument({
                                    nome: fileName,
                                    arquivoBase64: fileBase64,
                                    impressora: selectedPrinter,
                                    serverUrl: serverUrl
                                });
                                if (resOp && (resOp.sucesso || resOp.ok)) {
                                    printSuccess = true;
                                    printerUsed = resOp.impressora || selectedPrinter;
                                }
                            } catch (opErr) {
                                console.warn('[PrintWindow] Envio via window.opener.printService falhou:', opErr.message);
                            }
                        }

                        // 4. Prioridade 2: Tentar envio direto ao computador partilhado
                        if (!printSuccess) {
                            try {
                                const controller = new AbortController();
                                const to = setTimeout(() => controller.abort(), 35000);
                                const h = { 'Content-Type': 'application/json' };
                                if (token) h['Authorization'] = 'Bearer ' + token;

                                const directRes = await fetch(serverUrl + '/api/imprimir', {
                                    method: 'POST',
                                    headers: h,
                                    body: JSON.stringify({
                                        nome: fileName,
                                        arquivo: fileBase64,
                                        impressora: selectedPrinter
                                    }),
                                    signal: controller.signal
                                });
                                clearTimeout(to);

                                if (directRes.ok) {
                                    const directData = await directRes.json();
                                    if (directData.sucesso) {
                                        printSuccess = true;
                                        printerUsed = directData.impressora || selectedPrinter;
                                    }
                                }
                            } catch (directErr) {
                                console.warn('[PrintWindow] Envio direto falhou, usando proxy backend...', directErr.message);
                            }
                        }

                        // 5. Prioridade 3: Enviar via proxy backend do servidor web
                        if (!printSuccess) {
                            const payload = {
                                serverUrl,
                                impressora: selectedPrinter,
                                nome: fileName,
                                arquivo: fileBase64,
                                token
                            };

                            const proxyUrl = APP_ORIGIN + '/api/print/imprimir';
                            const res = await fetch(proxyUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });

                            const respData = await res.json();
                            if (!res.ok || !respData.sucesso) {
                                throw new Error(respData.erro || 'Falha ao processar a impressão no servidor.');
                            }
                            printSuccess = true;
                            printerUsed = respData.impressora || selectedPrinter;
                        }

                        showNotice('✅ Impresso com sucesso na impressora: ' + printerUsed + ' (' + serverUrl + ')', 'success');
                    } catch (err) {
                        console.error('[ERRO IMPRESSÃO]', err);
                        showNotice('❌ ' + err.message, 'error');
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                }

                function openServerConfigModal() {
                    document.getElementById('cfg-server-url').value = getServerUrl();
                    document.getElementById('cfg-server-token').value = getApiToken();
                    document.getElementById('modal-config').style.display = 'flex';
                }

                function closeServerConfigModal() {
                    document.getElementById('modal-config').style.display = 'none';
                }

                async function testConnectionFromModal() {
                    const url = document.getElementById('cfg-server-url').value.trim();
                    const token = document.getElementById('cfg-server-token').value.trim();
                    showNotice('A testar conexão com ' + url + '...', 'info');

                    let connected = false;
                    let padrao = null;

                    // 1. Usar window.opener se disponível
                    if (window.opener && window.opener.printService && typeof window.opener.printService.checkStatus === 'function') {
                        try {
                            const resOp = await window.opener.printService.checkStatus(url);
                            if (resOp && resOp.ok) {
                                connected = true;
                                padrao = resOp.impressora_padrao;
                            }
                        } catch (e) {}
                    }

                    // 2. Tentar direto
                    if (!connected) {
                        try {
                            const controller = new AbortController();
                            const to = setTimeout(() => controller.abort(), 2500);
                            const h = {};
                            if (token) h['Authorization'] = 'Bearer ' + token;
                            const directRes = await fetch(url + '/api/status', { method: 'GET', headers: h, signal: to });
                            clearTimeout(to);
                            if (directRes.ok) {
                                const data = await directRes.json();
                                connected = true;
                                padrao = data.impressora_padrao;
                            }
                        } catch (e) {}
                    }

                    // 3. Fallback proxy
                    if (!connected) {
                        try {
                            const params = new URLSearchParams({ serverUrl: url });
                            if (token) params.set('token', token);
                            const proxyUrl = APP_ORIGIN + '/api/print/status?' + params.toString();
                            const res = await fetch(proxyUrl);
                            const data = await res.json();
                            if (data && data.ok) {
                                connected = true;
                                padrao = data.impressora_padrao;
                            }
                        } catch (e) {}
                    }

                    if (connected) {
                        showNotice('✅ Conexão bem-sucedida! Impressora padrão: ' + (padrao || 'Predefinida'), 'success');
                    } else {
                        showNotice('❌ Falha: Computador partilhado inacessível em ' + url, 'error');
                    }
                }

                function saveServerConfigFromModal() {
                    const url = document.getElementById('cfg-server-url').value.trim();
                    const token = document.getElementById('cfg-server-token').value.trim();

                    if (url) {
                        try { localStorage.setItem(SERVER_STORAGE_KEY, url); } catch(e){}
                        if (window.opener?.printService) {
                            try { window.opener.printService.setServerUrl(url); } catch(e){}
                        }
                    }
                    if (token !== undefined) {
                        try { localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch(e){}
                        if (window.opener?.printService) {
                            try { window.opener.printService.setApiToken(token); } catch(e){}
                        }
                    }

                    showNotice('Definições guardadas com sucesso!', 'success');
                    closeServerConfigModal();
                    checkStatus();
                    reloadPrinters();
                }

                // Iniciar status e impressoras imediatamente e no evento load
                checkStatus();
                reloadPrinters();
                window.addEventListener('load', () => {
                    checkStatus();
                    reloadPrinters();
                });
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

/**
 * Imprime a Guia Dupla diretamente no computador partilhado de impressão (192.168.88.10) sem abrir popup
 * @param {Object} [client] - Cliente ativo (opcional, padrão window.currentActiveClient)
 */
export async function directPrintDeliveryNote(client = null) {
    const targetClient = client || window.currentActiveClient;
    if (!targetClient) {
        toast('Nenhum cliente selecionado para emissão da Guia.', 'warning');
        return;
    }

    try {
        const sUrl = (typeof printService?.getServerUrl === 'function' ? printService.getServerUrl() : '') || '192.168.88.10';
        toast(`⚡ A contactar computador de impressão (${sUrl.replace(/^https?:\/\//, '')})...`, 'info');
        const status = await printService.checkStatus();
        if (!status.ok) {
            toast('Computador de impressão offline. A abrir pré-visualização da Guia...', 'warning');
            await printDeliveryNote(targetClient, false);
            return;
        }

        await printDeliveryNote(targetClient, true);
    } catch (e) {
        console.error('[directPrintDeliveryNote]', e);
        toast(`Erro na impressão direta: ${e.message}`, 'error');
    }
}

export function checkAndShowNewsIcon(version) {
    if (!pb.authStore.isValid) return;
    if (localStorage.getItem('viewed-version-' + version) === 'true') return;
    
    // Se o botão já existir, não criar duplicado
    if (document.getElementById('btn-global-news')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-global-news';
    btn.className = 'fixed top-3.5 right-16 z-[9990] bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all animate-bounce cursor-pointer flex items-center justify-center border border-indigo-400';
    btn.title = 'Novidades da Versão (V1.3.0)';
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
                            <span class="text-[8px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black uppercase tracking-wider block w-fit mb-1.5">Colaboração em Tempo Real</span>
                            <p class="font-bold text-[10px] text-slate-800">⚡ Sincronização Perfeita (Zero Ecrã Branco):</p>
                            <p class="text-[10px] text-slate-500 font-medium mt-1">A atualização remota de ordens agora é instantânea e muito mais fluída. Removido o piscar e o carregamento forçado do ecrã quando vários utilizadores editam clientes em simultâneo. A sua vista mantém-se intacta e só atualiza os dados quando prontos.</p>
                        </div>
                        <div class="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-xs">
                            <span class="text-[8px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black uppercase tracking-wider block w-fit mb-1.5">Inteligência de Filtros</span>
                            <p class="font-bold text-[10px] text-slate-800">🔍 Continuidade Visual:</p>
                            <p class="text-[10px] text-slate-500 font-medium mt-1">Antes, se estivesse a olhar para um cliente e ele fosse confirmado noutro PC, a tela congelava porque o filtro "Pendente" o ocultava. Agora, o sistema tem tolerância visual, forçando sempre a atualização do que o utilizador está a visualizar.</p>
                        </div>
                    </div>
                    <!-- Coluna 2 -->
                    <div class="space-y-3">
                        <div class="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-xs">
                            <span class="text-[8px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-black uppercase tracking-wider block w-fit mb-1.5">Extratos Bancários</span>
                            <p class="font-bold text-[10px] text-slate-800">🏦 Busca Dinâmica de Bancos:</p>
                            <p class="text-[10px] text-slate-500 font-medium mt-1">O menu rápido de Extratos foi simplificado. Os bancos agora aparecem pelo nome raiz (BCI, BIM, STB), mas o sistema faz o cruzamento automático com as contas (BOSS, JUPITER) mantendo todo o histórico acessível de forma limpa.</p>
                        </div>
                        <div class="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-xs">
                            <span class="text-[8px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black uppercase tracking-wider block w-fit mb-1.5">Design de Interface</span>
                            <p class="font-bold text-[10px] text-slate-800">✨ Minimalismo e Compactação:</p>
                            <p class="text-[10px] text-slate-500 font-medium mt-1">Elementos visuais não essenciais (como textos descritivos extra na vinculação) foram removidos. As tabelas assumem a altura mínima essencial (auto-wrap), e menus suspensos ajustam-se à largura máxima do ecrã com opções como "TODOS".</p>
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
        const version = window.__SYSTEM_VERSION__ || 'v1.3.0';
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
            <div class="bg-slate-900/95 backdrop-blur-md text-white px-5 py-2.5 rounded-b-2xl shadow-2xl flex items-center gap-4 pointer-events-auto border-b-2 border-indigo-500 border-x border-slate-700">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                    <span class="text-xs font-black uppercase tracking-wider text-slate-200">Modo PocketBase Ativo</span>
                </div>
                <div class="h-4 w-[1px] bg-slate-700"></div>
                <button onclick="window.triggerGSheetSync()" id="btn-sync-gsheet-now" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer border border-indigo-400">
                    <i class="fas fa-sync-alt text-xs"></i> SINCRONIZAR COM GOOGLE SHEETS
                </button>
                <button onclick="window.location.href='/api/google/auth'" class="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm border border-slate-600">
                    <i class="fas fa-plug text-xs"></i> RECONECTAR GOOGLE
                </button>
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

window.triggerGSheetSync = async function() {
    const btn = document.getElementById('btn-sync-gsheet-now');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i> A SINCRONIZAR...';
    }
    try {
        const result = await syncPendingChangesToGSheet();
        toast(`Sincronização concluída com sucesso! (${result.count || 0} alterações enviadas)`, 'success');
        showSyncStatus(false);
    } catch (e) {
        console.error("Erro ao sincronizar com Google Sheets:", e);
        toast("Erro ao sincronizar com Google Sheets: " + e.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt text-xs"></i> SINCRONIZAR COM GOOGLE SHEETS';
        }
    }
};

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
            const pb_url = window.POCKETBASE_CONFIG && window.POCKETBASE_CONFIG.POCKETBASE_URL ? window.POCKETBASE_CONFIG.POCKETBASE_URL : 'https://pocketbase.mycloudspaces.com';
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



// --- INVOICE GENERATOR LOGIC ---

window.currentWizardStep = 1;

window.switchQuoteTab = async function(tabName) {
    if (tabName === 'quote') {
        if (!window.quoteEditorState.id) {
            toast("Guarde a simulação primeiro antes de avançar para a Cotação.", "error");
            return;
        }
    }

    const tabDraftBtn = document.getElementById('tab-btn-draft');
    const tabQuoteBtn = document.getElementById('tab-btn-quote');
    const contentSim = document.getElementById('tab-content-simulation');
    const contentQuote = document.getElementById('tab-content-quote');
    const btnBackWrapper = document.getElementById('btn-back-to-draft-wrapper');
    const contentInv = document.getElementById('tab-content-invoice');

    if (tabName === 'draft') {
        if (tabDraftBtn) tabDraftBtn.className = "px-5 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg bg-white shadow-sm text-indigo-600 transition-all border border-gray-200/50 flex items-center gap-2";
        if (tabQuoteBtn) tabQuoteBtn.className = "px-5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg text-gray-400 hover:text-gray-700 transition-all flex items-center gap-2";
        
        if (contentSim) {
            contentSim.classList.remove('hidden');
            contentSim.classList.add('flex');
        }
        if (contentQuote) {
            contentQuote.classList.add('hidden');
            contentQuote.classList.remove('flex');
        }
        if (btnBackWrapper) {
            btnBackWrapper.classList.add('hidden');
            btnBackWrapper.classList.remove('flex');
        }
        
        const btnPdf = document.getElementById('btn-quote-pdf-download');
        const btnPreview = document.getElementById('btn-quote-pdf-preview');
        if (btnPdf) {
            btnPdf.style.display = 'none';
        }
        if (btnPreview) {
            btnPreview.style.display = 'none';
        }
    } else if (tabName === 'quote') {
        if (tabQuoteBtn) tabQuoteBtn.className = "px-5 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg bg-white shadow-sm text-indigo-600 transition-all border border-gray-200/50 flex items-center gap-2";
        if (tabDraftBtn) tabDraftBtn.className = "px-5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg text-gray-400 hover:text-gray-700 transition-all flex items-center gap-2";
        
        if (contentSim) {
            contentSim.classList.add('hidden');
            contentSim.classList.remove('flex');
        }
        if (contentQuote) {
            contentQuote.classList.remove('hidden');
            contentQuote.classList.add('flex');
        }
        if (btnBackWrapper) {
            btnBackWrapper.classList.remove('hidden');
            btnBackWrapper.classList.add('flex');
        }
        
        const btnPdf = document.getElementById('btn-quote-pdf-download');
        const btnPreview = document.getElementById('btn-quote-pdf-preview');
        if (btnPdf) {
            btnPdf.style.display = 'flex';
        }
        if (btnPreview) {
            btnPreview.style.display = 'flex';
        }
        
        if (contentInv) {
            contentInv.classList.remove('hidden');
            contentInv.classList.add('flex');
            window.initInvoiceData();
            window.renderInvoiceLines();
        }

        if (!window.quoteEditorState.invoiceData || !window.quoteEditorState.invoiceData.clientName || window.quoteEditorState.invoiceData.clientName.trim() === '') {
            if (window.openClientModal) window.openClientModal();
        }
    }
};

window.issuers = {
    'jupiter': {
        name: 'JUPITER LOGISTICS LDA',
        nuit: 'NUIT: 400574472',
        address: 'Av. do Trabalho nº 1412, 3º Andar',
        contact: 'Tel.: +258 21401334, Cel:+25884 0485 691',
        bankHtml: ''
    },
    'hlces': {
        name: 'HL COMÉRCIO E SERVIÇOS, LDA',
        nuit: 'NUIT: 401950133',
        address: 'Bairro Central, Avenida Guerra popular, 1.º andar, n.º 1346, Cidade de Maputo, Maputo, Moçambique',
        contact: 'Email: info@hlces.com',
        bankHtml: `
                            <div class="mb-4 text-[10px] text-gray-600 space-y-0.5">
                                <p><strong class="text-gray-800 font-bold uppercase">Banco:</strong> BCI</p>
                                <p><strong class="text-gray-800 font-bold uppercase">Titular:</strong> HL COMERCIO E SERVICOS, LDA</p>
                                <p><strong class="text-gray-800 font-bold uppercase">N.º de Conta:</strong> 34391097910001</p>
                                <p><strong class="text-gray-800 font-bold uppercase">Conta / NIB do Beneficiário:</strong> 0008 0000 43910979101 28</p>
                            </div>`
    }
};

window.changeIssuer = function(presetId) {
    const select = document.getElementById('inv-issuer-select');
    if (!select) return;
    
    if (presetId) {
        select.value = presetId;
    }
    
    const issuerId = select.value;
    const issuer = window.issuers[issuerId];
    
    if (issuer) {
        document.getElementById('inv-issuer-name').innerText = issuer.name;
        document.getElementById('inv-issuer-nuit').innerText = issuer.nuit;
        document.getElementById('inv-issuer-address').innerText = issuer.address;
        document.getElementById('inv-issuer-contact').innerText = issuer.contact;
    } else {
        document.getElementById('inv-issuer-name').innerHTML = '&nbsp;';
        document.getElementById('inv-issuer-nuit').innerHTML = '&nbsp;';
        document.getElementById('inv-issuer-address').innerHTML = '&nbsp;';
        document.getElementById('inv-issuer-contact').innerHTML = '&nbsp;';
    }
    
    window.syncInvoiceHeaderToState();
    if (typeof window.renderInvoiceLines === 'function') {
        window.renderInvoiceLines();
    }
};

window.syncInvoiceHeaderToState = function() {
    window.quoteEditorState.invoiceData = window.quoteEditorState.invoiceData || {};
    window.quoteEditorState.invoiceData.docType = document.getElementById('inv-doc-type').value;
    window.quoteEditorState.invoiceData.docNumber = document.getElementById('inv-doc-number').value;
    window.quoteEditorState.invoiceData.dateIssue = document.getElementById('inv-date-issue').value;
    window.quoteEditorState.invoiceData.dateDue = document.getElementById('inv-date-due').value;
    if(document.getElementById('inv-doc-ref')) window.quoteEditorState.invoiceData.reference = document.getElementById('inv-doc-ref').value;
    
    const issuerSelect = document.getElementById('inv-issuer-select');
    if (issuerSelect) window.quoteEditorState.invoiceData.issuer = issuerSelect.value;
    
    window.quoteIsDirty = true;
    if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
};

window.updateInvoiceDocType = function() {
    const el = document.getElementById('inv-doc-type');
    if (!el) return;
    
    const val = el.value;
    window.quoteEditorState.invoiceData.docType = val;
    
    let origQuoteNum = window.quoteEditorState.invoiceData.originalQuoteNumber;
    let invNum = window.quoteEditorState.invoiceData.generatedInvoiceNumber;
    let currentNum = window.quoteEditorState.invoiceData.docNumber;
    
    if (!currentNum || currentNum === 'AUTO') {
        const docEl = document.getElementById('inv-doc-number');
        if (docEl && docEl.value !== 'AUTO') currentNum = docEl.value;
    }
    
    // Store original quote number if not present
    if (!origQuoteNum) {
        if (currentNum && !currentNum.startsWith('F')) {
            origQuoteNum = currentNum;
            window.quoteEditorState.invoiceData.originalQuoteNumber = origQuoteNum;
        }
    }
    
    if (val === 'FATURA' || val === 'FATURA-RECIBO') {
        if (!invNum) {
            const now = new Date();
            const year = now.getFullYear();
            const rnd = Math.floor(Math.random() * 9000) + 1000;
            const prefix = val === 'FATURA' ? 'FT' : 'FR';
            invNum = `${prefix} ${year}/${rnd}`;
            window.quoteEditorState.invoiceData.generatedInvoiceNumber = invNum;
        }
        
        window.quoteEditorState.invoiceData.docNumber = invNum;
        let refVal = origQuoteNum || (window.quoteEditorState.id || '');
        if (refVal) window.quoteEditorState.invoiceData.reference = refVal;
        
    } else {
        // Revert to Cotação
        if (origQuoteNum) {
            window.quoteEditorState.invoiceData.docNumber = origQuoteNum;
        } else {
            window.quoteEditorState.invoiceData.docNumber = currentNum && !currentNum.startsWith('F') ? currentNum : 'AUTO';
        }
        
        if (window.quoteEditorState.invoiceData.reference === origQuoteNum) {
             window.quoteEditorState.invoiceData.reference = '';
        }
    }
    
    const numEl = document.getElementById('inv-doc-number');
    if (numEl) numEl.value = window.quoteEditorState.invoiceData.docNumber || 'AUTO';
    
    const refEl = document.getElementById('inv-doc-ref');
    if (refEl) refEl.value = window.quoteEditorState.invoiceData.reference || '';
    
    const dueDateContainer = document.getElementById('container-inv-date-due');
    if (dueDateContainer) {
        if (val === 'FATURA' || val === 'FATURA-RECIBO') {
            dueDateContainer.style.display = 'none';
        } else {
            dueDateContainer.style.display = 'flex';
        }
    }
    
    window.renderInvoiceLines();
};


window.initInvoiceData = function() {
    window.quoteEditorState.invoiceData = window.quoteEditorState.invoiceData || {};
    const d = window.quoteEditorState.invoiceData;
    
    d.docType = d.docType || 'COTAÇÃO';
    d.docNumber = d.docNumber || '';
    d.dateIssue = d.dateIssue || new Date().toISOString().split('T')[0];
    d.dateDue = d.dateDue || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    d.reference = d.reference || '';
    d.issuerName = d.issuerName || 'JUPITER LOGISTICS LDA';
    d.issuerNuit = d.issuerNuit || '400574472';
    d.issuerAddress = d.issuerAddress || 'Av. do Trabalho nº 1412, 3º Andar\nMaputo, Moçambique';
    d.issuerContact = d.issuerContact || 'Tel.: +258 21401334, Cel:+25884 0485 691';
    d.clientName = d.clientName || '';
    d.clientNuit = d.clientNuit || '';
    d.clientAddress = d.clientAddress || '';
    d.clientContact = d.clientContact || '';
    
    d.quoteLines = d.quoteLines || [];
    d.faturaLines = d.faturaLines || [];
    
    if (d.lines) {
        if (d.faturaLines.length === 0) d.faturaLines = JSON.parse(JSON.stringify(d.lines));
        if (d.quoteLines.length === 0) d.quoteLines = JSON.parse(JSON.stringify(d.lines));
        delete d.lines;
    }

    d.discount = d.discount || 0;
    d.bankDetails = d.bankDetails || 'NIB: 00000000000\nBanco: Millennium Bim\nTitular: Sua Empresa Lda\n\nM-Pesa: 84 000 0000';
    d.observations = d.observations || 'Validade da cotação: 30 dias.';
    
    // Auto-fill from quote state if available
    const quote = (state.quotes || []).find(q => q.id === window.quoteEditorState.id);
    if (quote) {
        if (!d.clientName) d.clientName = quote.client_name;
        if (!d.docNumber) d.docNumber = quote.quote_number;
    }
    
    window.syncInvoiceLinesFromDraft();
    
    // Fill the DOM with state data
    document.getElementById('inv-doc-type').value = d.docType;
    document.getElementById('inv-doc-number').value = d.docNumber || '';
    document.getElementById('inv-date-issue').value = d.dateIssue;
    document.getElementById('inv-date-due').value = d.dateDue;
    if(document.getElementById('inv-doc-ref')) document.getElementById('inv-doc-ref').value = d.reference;
    
    // Emitente is now dynamic from a dropdown
    if (d.issuer) {
        window.changeIssuer(d.issuer);
    } else {
        window.changeIssuer('jupiter'); // Default se não existir
    }
    window.syncClientUIDisplay();
    
    document.getElementById('inv-val-discount').value = d.discount;
    document.getElementById('inv-bank-details').value = d.bankDetails;
    document.getElementById('inv-observations').value = d.observations;
    
    const dueDateContainer = document.getElementById('container-inv-date-due');
    if (dueDateContainer) {
        if (d.docType === 'FATURA' || d.docType === 'FATURA-RECIBO') {
            dueDateContainer.style.display = 'none';
        } else {
            dueDateContainer.style.display = 'flex';
        }
    }
    
    // Add event listeners to sync DOM back to state
    const inputs = ['doc-number', 'date-issue', 'date-due', 'doc-ref', 'issuer-name', 'issuer-nuit', 'issuer-address', 'issuer-contact', 'client-name', 'client-nuit', 'client-address', 'client-contact', 'bank-details', 'observations'];
    inputs.forEach(id => {
        const el = document.getElementById('inv-' + id);
        if (el) {
            el.onchange = (e) => {
                const keyParts = id.split('-');
                const key = keyParts[0] + keyParts[1].charAt(0).toUpperCase() + keyParts[1].slice(1) + (keyParts[2] ? keyParts[2].charAt(0).toUpperCase() + keyParts[2].slice(1) : '');
                
                if (keyParts.length > 1) {
                   const finalKey = keyParts[0] + keyParts.slice(1).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
                   if (window.quoteEditorState.invoiceData[finalKey] !== undefined) {
                        window.quoteEditorState.invoiceData[finalKey] = e.target.value;
                   }
                }
            };
            
            // Removed doc-type override as it is now handled globally
            if(id === 'doc-number') el.onchange = (e) => window.quoteEditorState.invoiceData.docNumber = e.target.value;
            if(id === 'date-issue') el.onchange = (e) => window.quoteEditorState.invoiceData.dateIssue = e.target.value;
            if(id === 'date-due') el.onchange = (e) => window.quoteEditorState.invoiceData.dateDue = e.target.value;
            if(id === 'doc-ref') el.onchange = (e) => window.quoteEditorState.invoiceData.reference = e.target.value;
            if(id === 'issuer-name') el.onchange = (e) => window.quoteEditorState.invoiceData.issuerName = e.target.value;
            if(id === 'issuer-nuit') el.onchange = (e) => window.quoteEditorState.invoiceData.issuerNuit = e.target.value;
            if(id === 'issuer-address') el.onchange = (e) => window.quoteEditorState.invoiceData.issuerAddress = e.target.value;
            if(id === 'issuer-contact') el.onchange = (e) => window.quoteEditorState.invoiceData.issuerContact = e.target.value;
            if(id === 'client-name') el.onchange = (e) => window.quoteEditorState.invoiceData.clientName = e.target.value;
            if(id === 'client-nuit') el.onchange = (e) => window.quoteEditorState.invoiceData.clientNuit = e.target.value;
            if(id === 'client-address') el.onchange = (e) => window.quoteEditorState.invoiceData.clientAddress = e.target.value;
            if(id === 'bank-details') el.onchange = (e) => window.quoteEditorState.invoiceData.bankDetails = e.target.value;
            if(id === 'observations') el.onchange = (e) => window.quoteEditorState.invoiceData.observations = e.target.value;
        }
    });
};


window.numeroParaExtenso = function(valor) {
    const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezasseis", "dezassete", "dezoito", "dezanove"];
    const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    function converterGrupo(n) {
        let texto = "";
        let c = Math.floor(n / 100);
        let d = Math.floor((n % 100) / 10);
        let u = n % 10;

        if (c === 1 && d === 0 && u === 0) return "cem";
        if (c > 0) texto += centenas[c] + ((d > 0 || u > 0) ? " e " : "");

        if (d === 1) {
            texto += unidades[10 + u];
        } else {
            if (d > 1) texto += dezenas[d] + (u > 0 ? " e " : "");
            if (u > 0 && d !== 1) texto += unidades[u];
        }
        return texto;
    }

    if (valor === 0) return "Zero meticais";

    let mt = Math.floor(valor);
    let cent = Math.round((valor - mt) * 100);

    let textoMt = "";
    if (mt > 0) {
        let milhoes = Math.floor(mt / 1000000);
        let milhares = Math.floor((mt % 1000000) / 1000);
        let restos = mt % 1000;

        if (milhoes > 0) {
            textoMt += converterGrupo(milhoes) + (milhoes === 1 ? " milhão" : " milhões");
            if (milhares > 0 || restos > 0) textoMt += (restos === 0 && milhares === 0 ? " e " : " ");
        }
        if (milhares > 0) {
            if (milhares === 1) textoMt += "mil";
            else textoMt += converterGrupo(milhares) + " mil";
            if (restos > 0) textoMt += (restos < 100 || restos % 100 === 0 ? " e " : " ");
        }
        if (restos > 0) {
            textoMt += converterGrupo(restos);
        }
    }

    let textoFinal = "";
    if (mt > 0) {
        textoFinal += textoMt + (mt === 1 ? " metical" : " meticais");
    }
    if (cent > 0) {
        let textoCent = converterGrupo(cent);
        if (mt > 0) textoFinal += " e ";
        textoFinal += textoCent + (cent === 1 ? " centavo" : " centavos");
    }

    return textoFinal.charAt(0).toUpperCase() + textoFinal.slice(1);
};

window.calculateDesembaraco = function(totals, usdExRate) {
    if (!totals) return 16850;
    const cifMzn = totals.cifMzn || 0;
    const cifUsd = cifMzn / usdExRate;

    let priceUsd = 0;
    if (cifUsd <= 5000) priceUsd = 257.40;
    else if (cifUsd <= 10000) priceUsd = 327.60;
    else if (cifUsd <= 20000) priceUsd = 380.25;
    else if (cifUsd <= 30000) priceUsd = 444.60;
    else if (cifUsd <= 40000) priceUsd = 497.25;
    else if (cifUsd <= 50000) priceUsd = 731.25;
    else if (cifUsd <= 100000) priceUsd = 994.50;
    else if (cifUsd <= 200000) priceUsd = 1140.75;
    else if (cifUsd <= 500000) priceUsd = 1272.96;
    else if (cifUsd <= 800000) priceUsd = 1412.19;
    else if (cifUsd <= 1000000) priceUsd = 1725.75;
    else if (cifUsd <= 1500000) priceUsd = 2164.50;
    else if (cifUsd <= 2000000) priceUsd = 2778.75;
    else priceUsd = cifUsd * 0.00152;

    return priceUsd * usdExRate;
};

window.syncInvoiceLinesFromDraft = function() {
    const totals = window.quoteEditorState.totals || {};
    if (!window.quoteEditorState.invoiceData) {
        window.quoteEditorState.invoiceData = {};
    }
    
    // Ensure both arrays exist
    window.quoteEditorState.invoiceData.quoteLines = window.quoteEditorState.invoiceData.quoteLines || [];
    window.quoteEditorState.invoiceData.faturaLines = window.quoteEditorState.invoiceData.faturaLines || [];
    
    const syncArray = (existingLines) => {
        let lines = [...(existingLines || [])];
        const isFirstTime = lines.length === 0;

        lines = lines.filter(l => l.group !== 'alfandegas');
        
        const autoDescs = ['DP World 40', 'DP World 20', 'DP World LCL', 'Ordem de Entrega', 'Caução (Reembolsável)', 'Kudumba', 'Taxa JUE (MCnet)', 'MCnet', 'Agente', 'Taxa de Radio de Difusao', 'Titulo de Propriedade', 'INATRO', 'Maputo Car', 'Gestão de Terminais'];
        lines = lines.filter(l => !(l.group === 'terceiros' && autoDescs.includes(l.desc)));
        
        const mode = window.quoteEditorState.mode;
        const subMode = window.quoteEditorState.subMode;
        
        let usdExRate = 1;
        if (window.quoteEditorState.currency === 'USD') {
            usdExRate = parseFloat(window.quoteEditorState.exchangeRate) || 1;
        } else if (state && state.cambios) {
            const usdCambio = state.cambios.find(c => c.moeda && c.moeda.toUpperCase() === 'USD');
            if (usdCambio) usdExRate = parseFloat(usdCambio.taxa) || 1;
        }
        
        if (mode === 'Maritimo') {
            if (subMode === 'FCL-40') {
                lines.push({ group: 'terceiros', desc: 'DP World 40', price: 32202.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Ordem de Entrega', price: 50385.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Caução (Reembolsável)', price: 130000.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Kudumba', price: 7812.00, tax: 0 });
            } else if (subMode === 'FCL-20') {
                lines.push({ group: 'terceiros', desc: 'DP World 20', price: 17640.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Ordem de Entrega', price: 34800.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Caução (Reembolsável)', price: 70000.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Kudumba', price: 7812.00, tax: 0 });
            } else if (subMode === 'LCL') {
                const cbm = window.quoteEditorState.globais?.cbm || 0;
                const exRate = usdExRate;
                const dpWorldMzn = (23 + (44.50 * cbm)) * exRate * 1.16;
                const kudumbaMzn = 15 * exRate * 1.16;
                lines.push({ group: 'terceiros', desc: 'DP World LCL', price: dpWorldMzn, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Ordem de Entrega', price: 0, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Kudumba', price: kudumbaMzn, tax: 0 });
            } else if (subMode === 'CBM') {
                lines.push({ group: 'terceiros', desc: 'Kudumba', price: 2601.00, tax: 0 });
            } else if (subMode === 'CAR') {
                const exRate = usdExRate;
                const carClass = window.quoteEditorState.globais?.carClass || 'Ligeiro';
                const kudumbaMzn = 30 * exRate * 1.16;
                const maputoCarMzn = 273 * exRate * 1.16;
                const tituloPrice = carClass === 'Pesado' ? 3460.00 : 2460.00;
                lines.push({ group: 'terceiros', desc: 'Kudumba', price: kudumbaMzn, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Agente', price: 8200.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Taxa de Radio de Difusao', price: 59.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Titulo de Propriedade', price: tituloPrice, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'INATRO', price: 11520.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Maputo Car', price: maputoCarMzn, tax: 0 });
            }
        } else if (mode === 'Rodoviario') {
            if (subMode === 'CAR') {
                const exRate = usdExRate;
                const carClass = window.quoteEditorState.globais?.carClass || 'Ligeiro';
                const kudumbaMzn = 30 * exRate * 1.16;
                const tituloPrice = carClass === 'Pesado' ? 3460.00 : 2460.00;
                
                lines.push({ group: 'terceiros', desc: 'Kudumba', price: kudumbaMzn, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Taxa de Radio de Difusao', price: 59.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Titulo de Propriedade', price: tituloPrice, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'INATRO', price: 11520.00, tax: 0 });
                lines.push({ group: 'terceiros', desc: 'Gestão de Terminais', price: 6650.00, tax: 0 });
            }
        }
        
        let addedAlfandegas = false;
        if (totals.daMzn > 0) { lines.push({ group: 'alfandegas', desc: 'Direitos', price: totals.daMzn, tax: 0 }); addedAlfandegas = true; }
        if (totals.ivaMzn > 0) { lines.push({ group: 'alfandegas', desc: 'IVA', price: totals.ivaMzn, tax: 0 }); addedAlfandegas = true; }
        if (totals.tsaMzn > 0) { lines.push({ group: 'alfandegas', desc: 'Sobretaxa', price: totals.tsaMzn, tax: 0 }); addedAlfandegas = true; }
        if (totals.iceMzn > 0) { lines.push({ group: 'alfandegas', desc: 'ICE', price: totals.iceMzn, tax: 0 }); addedAlfandegas = true; }
        if (totals.mcnetMzn > 0) { lines.push({ group: 'terceiros', desc: 'Taxa JUE (MCnet)', price: totals.mcnetMzn, tax: 0 }); }
        if (totals.tsaFixedMzn > 0) { lines.push({ group: 'alfandegas', desc: 'Taxa de Serviço Aduaneiro (TSA)', price: totals.tsaFixedMzn, tax: 0 }); addedAlfandegas = true; }
        if (!addedAlfandegas) { lines.push({ group: 'alfandegas', desc: 'Despesas Aduaneiras', price: 0, tax: 0 }); }
        
        const desPrice = window.calculateDesembaraco(totals, usdExRate);
        
        const existingDesembaraço = lines.find(l => l.desc === 'Desembaraço Moz');
        if (existingDesembaraço) {
            existingDesembaraço.price = desPrice;
        }

        if (isFirstTime) {
            let others = parseFloat(document.getElementById('input-global-others')?.value) || 0;
            if (others > 0) lines.push({ group: 'terceiros', desc: 'Outros Serviços de Navegação / Agência', price: others, tax: 0 });
            
            if (!existingDesembaraço) {
                lines.push({ group: 'servicos', desc: 'Desembaraço Moz', price: desPrice, tax: 16 });
            }
        }
        return lines;
    };

    window.quoteEditorState.invoiceData.quoteLines = syncArray(window.quoteEditorState.invoiceData.quoteLines);
    window.quoteEditorState.invoiceData.faturaLines = syncArray(window.quoteEditorState.invoiceData.faturaLines);
    
    window.renderInvoiceLines();
};


window.openLineModal = function(index, defaultGroup = 'servicos') {
    const isEdit = index >= 0;
    document.getElementById('modal-line-title').innerText = isEdit ? 'Editar Item' : 'Adicionar Item';
    document.getElementById('modal-line-index').value = index;
    
    if (isEdit) {
        const line = window.quoteEditorState.invoiceData.lines[index];
        document.getElementById('modal-line-group').value = line.group || 'servicos';
        document.getElementById('modal-line-desc').value = line.desc || '';
        document.getElementById('modal-line-price').value = line.price || 0;
        document.getElementById('modal-line-tax').value = line.tax || 0;
    } else {
        document.getElementById('modal-line-group').value = defaultGroup;
        document.getElementById('modal-line-desc').value = '';
        document.getElementById('modal-line-price').value = '';
        document.getElementById('modal-line-tax').value = defaultGroup === 'servicos' ? 16 : 0;
    }
    
    document.getElementById('modal-line-edit').classList.remove('hidden');
    document.getElementById('modal-line-edit').classList.add('flex');
};

window.closeLineModal = function() {
    document.getElementById('modal-line-edit').classList.add('hidden');
    document.getElementById('modal-line-edit').classList.remove('flex');
};

window.saveLineModal = function() {
    const index = parseInt(document.getElementById('modal-line-index').value);
    const group = document.getElementById('modal-line-group').value;
    const desc = document.getElementById('modal-line-desc').value;
    const price = parseFloat(document.getElementById('modal-line-price').value) || 0;
    const tax = parseFloat(document.getElementById('modal-line-tax').value) || 0;
    
    const docType = window.quoteEditorState.invoiceData.docType || 'COTAÇÃO';
    const lines = (docType === 'FATURA' || docType === 'FATURA-RECIBO') ? window.quoteEditorState.invoiceData.faturaLines : window.quoteEditorState.invoiceData.quoteLines;
    
    if (index >= 0) {
        // Edit
        lines[index] = { group, desc, price, tax };
    } else {
        // Add
        lines.push({ group, desc, price, tax });
    }
    
    window.renderInvoiceLines();
    window.closeLineModal();
};

window.addCategoryFromDraft = function(groupName) {
    const totals = window.quoteEditorState.totals;
    const docType = window.quoteEditorState.invoiceData.docType || 'COTAÇÃO';
    const isFatura = (docType === 'FATURA' || docType === 'FATURA-RECIBO');
    let lines = isFatura ? (window.quoteEditorState.invoiceData.faturaLines || []) : (window.quoteEditorState.invoiceData.quoteLines || []);
    
    // Clear out existing lines of this group to prevent duplication!
    lines = lines.filter(l => l.group !== groupName);
    if (isFatura) window.quoteEditorState.invoiceData.faturaLines = lines;
    else window.quoteEditorState.invoiceData.quoteLines = lines;
    
    if (groupName === 'alfandegas') {
        let added = false;
        if (totals.daMzn > 0) { lines.push({ group: 'alfandegas', desc: 'Direitos', price: totals.daMzn, tax: 0 }); added = true; }
        if (totals.ivaMzn > 0) { lines.push({ group: 'alfandegas', desc: 'IVA', price: totals.ivaMzn, tax: 0 }); added = true; }
        if (totals.tsaMzn > 0) { lines.push({ group: 'alfandegas', desc: 'Sobretaxa', price: totals.tsaMzn, tax: 0 }); added = true; }
        if (totals.iceMzn > 0) { lines.push({ group: 'alfandegas', desc: 'ICE', price: totals.iceMzn, tax: 0 }); added = true; }
        if (totals.tsaFixedMzn > 0) { lines.push({ group: 'alfandegas', desc: 'Taxa de Serviço Aduaneiro (TSA)', price: totals.tsaFixedMzn, tax: 0 }); added = true; }
        if (!added) {
            lines.push({ group: 'alfandegas', desc: 'Despesas Aduaneiras', price: 0, tax: 0 });
        }
    } else if (groupName === 'terceiros') {
        lines.push({ group: 'terceiros', desc: 'Portagens / Parques', price: 1550, tax: 0 });
        lines.push({ group: 'terceiros', desc: 'Taxas Portuárias / Kudumba', price: 2604, tax: 0 });
        if (totals.mcnetMzn > 0) { lines.push({ group: 'terceiros', desc: 'Taxa JUE (MCnet)', price: totals.mcnetMzn, tax: 0 }); }
    } else if (groupName === 'servicos') {
        let usdExRate = 1;
        if (window.quoteEditorState.currency === 'USD') {
            usdExRate = parseFloat(window.quoteEditorState.exchangeRate) || 1;
        } else if (typeof state !== 'undefined' && state.cambios) {
            const usdCambio = state.cambios.find(c => c.moeda && c.moeda.toUpperCase() === 'USD');
            if (usdCambio) usdExRate = parseFloat(usdCambio.taxa) || 1;
        }
        const desPrice = window.calculateDesembaraco(totals, usdExRate);
        lines.push({ group: 'servicos', desc: 'Desembaraço Moz', price: desPrice, tax: 16 });
    }
    
    window.quoteIsDirty = true;
    if (window.updateQuoteActionsUI) window.updateQuoteActionsUI();
    window.renderInvoiceLines();
};

window.removeInvoiceLine = function(index) {
    const docType = window.quoteEditorState.invoiceData.docType || 'COTAÇÃO';
    const lines = (docType === 'FATURA' || docType === 'FATURA-RECIBO') ? window.quoteEditorState.invoiceData.faturaLines : window.quoteEditorState.invoiceData.quoteLines;
    lines.splice(index, 1);
    window.renderInvoiceLines();
};

window.updateInvoiceLine = function(index, field, value) {
    const docType = window.quoteEditorState.invoiceData.docType || 'COTAÇÃO';
    const lines = (docType === 'FATURA' || docType === 'FATURA-RECIBO') ? window.quoteEditorState.invoiceData.faturaLines : window.quoteEditorState.invoiceData.quoteLines;
    lines[index][field] = value;
    if (field === 'price' || field === 'tax') {
        window.calculateInvoiceTotals();
    }
};

window.updateInvoiceLinePrice = function(index, valueStr) {
    if (typeof valueStr === 'string') {
        valueStr = valueStr.replace(',', '.');
    }
    const val = parseFloat(valueStr) || 0;
    const docType = window.quoteEditorState.invoiceData.docType || 'COTAÇÃO';
    const lines = (docType === 'FATURA' || docType === 'FATURA-RECIBO') ? window.quoteEditorState.invoiceData.faturaLines : window.quoteEditorState.invoiceData.quoteLines;
    if (lines[index]) {
        lines[index].price = val;
        window.calculateInvoiceTotals();
    }
};

window.renderInvoiceLines = function() {
    const container = document.getElementById('inv-lines-container');
    if (!container) return;
    
    const docType = window.quoteEditorState.invoiceData.docType || 'PROFORMA';
    const isFatura = docType === 'FATURA' || docType === 'FATURA-RECIBO';
    
    let html = '';
    
    const lines = isFatura ? (window.quoteEditorState.invoiceData.faturaLines || []) : (window.quoteEditorState.invoiceData.quoteLines || []);
    
    const groups = {
        alfandegas: { title: 'Alfândegas', icon: 'fa-file-invoice', items: [], subtotal: 0 },
        terceiros: { title: 'Terceiros', icon: 'fa-truck-loading', items: [], subtotal: 0 },
        servicos: { title: 'Serviços', icon: 'fa-concierge-bell', items: [], subtotal: 0 }
    };
    
    // Populate
    lines.forEach((l, index) => {
        if (!groups[l.group]) l.group = 'servicos'; // fallback
        
        // AUTO-UPGRADE: Forçar 16% de IVA nas cotações antigas que guardaram o desembaraço a 0%
        if (l.desc && l.desc === 'Desembaraço Moz' && l.tax === 0) {
            l.tax = 16;
        }
        
        // AUTO-RENAME: Reverter nome para "Desembaraço Moz"
        if (l.desc && l.desc === 'Honorários de Desembaraço') {
            l.desc = 'Desembaraço Moz';
        }

        groups[l.group].items.push({ ...l, index });
        groups[l.group].subtotal += parseFloat(l.price) || 0;
    });
    
    Object.keys(groups).forEach(gKey => {
        const group = groups[gKey];
        // if (group.items.length === 0) return; // Always render
        
        // Group Container (Card)
        html += `
        <details class="group print:open border-b border-gray-100 last:border-0" open>
            <summary class="flex justify-between items-center bg-gray-50/50 px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span class="text-[10px] font-black uppercase tracking-widest text-indigo-900"><i class="fas ${group.icon} mr-2"></i>${group.title}</span>
                <span class="text-gray-400 group-open:rotate-180 transition-transform duration-300 print:hidden">
                    <i class="fas fa-chevron-down"></i>
                </span>
            </summary>
            
            <div class="px-4 pb-2 pt-2 print:pb-0 print:pt-0">
                <table class="w-full text-left border-collapse mb-2 print:mb-0">
                    <thead class="bg-red-100/60 border-y border-red-200">
                        <tr>
                            <th class="py-1 px-3 text-[10px] font-normal text-gray-800 uppercase tracking-wider w-1/2">DESCRIÇÃO</th>
                            <th class="py-1 px-3 text-[10px] font-normal text-gray-800 uppercase tracking-wider text-right w-1/4">VALOR</th>
                            <th class="py-1 px-3 text-[10px] font-normal text-gray-800 uppercase tracking-wider text-right w-1/4">SUB-TOTAL</th>
                            <th class="py-1 px-2 w-8 print:hidden"></th>
                        </tr>
                    </thead>
                    <tbody class="text-sm">
        `;
        
        // Group Items
        group.items.forEach((item, i) => {
            html += `
                        <tr class="group/row hover:bg-indigo-50/30 transition-colors border-b border-gray-50 last:border-0">
                            <td class="py-1 print:py-0.5 px-3 pl-6">
                                <span class="text-xs font-normal text-gray-700">${item.desc}</span>
                                ${item.tax > 0 ? `<span class="text-[9px] font-normal bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded ml-2" title="Sujeito a IVA">IVA ${item.tax}%</span>` : ''}
                            </td>
                            <td class="py-1 print:py-0.5 px-3 text-right">
                                ${isFatura ? 
                                `<input type="text" class="w-24 text-xs font-normal text-gray-800 text-right bg-transparent border-b border-dashed border-gray-300 focus:border-indigo-500 outline-none" value="${parseFloat(item.price || 0).toFixed(2)}" oninput="this.value = this.value.replace(/[^0-9.,]/g, ''); window.updateInvoiceLinePrice(${item.index}, this.value)">` 
                                : `<span class="text-xs font-normal text-gray-800">${formatCurrencyVal(item.price)}</span>`}
                            </td>
                            <td class="py-1 print:py-0.5 px-3 text-right">
                                <span class="text-xs font-normal text-gray-400">—</span>
                            </td>
                            <td class="py-1 px-2 text-center print:hidden w-16">
                                <div class="flex items-center justify-center gap-3 opacity-0 group-hover/row:opacity-100 transition-all">
                                    ${gKey !== 'alfandegas' ? `
                                    <button type="button" onclick="window.openLineModal(${item.index})" class="text-gray-400 hover:text-indigo-600 transition-colors" title="Editar">
                                        <i class="fas fa-edit text-xs"></i>
                                    </button>
                                    <button type="button" onclick="window.removeInvoiceLine(${item.index})" class="text-gray-400 hover:text-red-500 transition-colors" title="Remover">
                                        <i class="fas fa-trash-alt text-xs"></i>
                                    </button>
                                    ` : `
                                    <span class="text-[9px] text-gray-300 italic">Auto</span>
                                    `}
                                </div>
                            </td>
                        </tr>
            `;
        });
        
        // Group Subtotal
        html += `
                        <tr class="bg-white">
                            <td class="py-1.5 print:py-0.5 px-3">
                                ${gKey !== 'alfandegas' ? `
                                <button type="button" onclick="window.openLineModal(-1, '${gKey}')" class="text-[10px] font-normal text-indigo-500 hover:text-indigo-700 uppercase tracking-widest print:hidden flex items-center gap-1 transition-all hover:scale-105"><i class="fas fa-plus-circle"></i> Adicionar Item</button>
                                ` : ''}
                            </td>
                            <td class="py-1.5 print:py-0.5 px-3 text-right font-normal text-gray-400 text-[9px] uppercase tracking-widest"></td>
                            <td class="py-1.5 print:py-0.5 px-3 text-right font-normal text-indigo-900 text-sm border-t-2 border-indigo-100" id="inv-group-subtotal-${gKey}">${formatCurrencyVal(group.subtotal)}</td>
                            <td class="py-1.5 print:py-0.5 px-2 print:hidden"></td>
                        </tr>
                    </tbody>
                </table>
        `;
        
        if (gKey === 'servicos') {
            const currentIssuer = window.quoteEditorState?.invoiceData?.issuer || document.getElementById('inv-issuer-select')?.value || 'jupiter';
            const issuerBankHtml = (isFatura && window.issuers[currentIssuer]?.bankHtml) ? window.issuers[currentIssuer].bankHtml : '';
            html += `
                    <div class="mt-8 flex flex-col md:flex-row print:flex-row justify-between items-end gap-4 border-t border-gray-100 pt-6">
                        <div class="flex-1 w-full relative h-full flex flex-col justify-end">
                            ${issuerBankHtml}
                            <div class="border-b border-gray-800 pb-1 inline-block min-w-[70%] max-w-full">
                                <p class="text-xs font-bold text-gray-800 italic" id="inv-val-extenso">Zero meticais</p>
                            </div>
                        </div>
                        
                        <div class="w-full md:w-[350px] print:w-[350px]">
                            <table class="w-full text-sm border-collapse">
                                <tbody>
                                    <tr class="border-b border-gray-200">
                                        <td class="py-1.5 px-4 font-normal text-gray-600 text-right uppercase text-[11px] tracking-wider">TOTAL SEM IVA</td>
                                        <td class="py-1.5 px-4 text-right font-normal text-gray-900" id="inv-val-subtotal">0.00</td>
                                    </tr>
                                    <tr class="border-b border-gray-200">
                                        <td class="py-1.5 px-4 font-normal text-gray-600 text-right uppercase text-[11px] tracking-wider">TAXA DE IVA</td>
                                        <td class="py-1.5 px-4 text-right font-normal text-gray-900">16.00%</td>
                                    </tr>
                                    <tr class="border-b border-gray-200">
                                        <td class="py-1.5 px-4 font-normal text-gray-600 text-right uppercase text-[11px] tracking-wider">IVA</td>
                                        <td class="py-1.5 px-4 text-right font-normal text-gray-900" id="inv-val-tax">0.00</td>
                                    </tr>
                                    <tr class="bg-red-200/50 border-y border-red-300">
                                        <td class="py-2.5 px-4 font-normal text-gray-900 text-right uppercase tracking-wider text-sm">TOTAL</td>
                                        <td class="py-2.5 px-4 text-right font-normal text-gray-900 text-[16px]" id="inv-val-total">0.00</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
            `;
        }
        
        html += `
            </div>
        </details>
        `;
    });
    
    container.innerHTML = html;
    window.calculateInvoiceTotals();
};

window.calculateInvoiceTotals = function() {
    const docType = window.quoteEditorState.invoiceData.docType || 'COTAÇÃO';
    const lines = (docType === 'FATURA' || docType === 'FATURA-RECIBO') ? (window.quoteEditorState.invoiceData.faturaLines || []) : (window.quoteEditorState.invoiceData.quoteLines || []);
    
    let subtotalGeral = 0;
    let totalIva = 0;
    
    const groupSubtotals = {
        alfandegas: 0,
        terceiros: 0,
        servicos: 0
    };
    
    lines.forEach(line => {
        const val = parseFloat(line.price) || 0;
        subtotalGeral += val;
        
        const g = line.group || 'servicos';
        if (groupSubtotals[g] !== undefined) {
            groupSubtotals[g] += val;
        }
        
        // Calcular IVA apenas nas linhas que têm tax (neste caso, "servicos" com 16%)
        if (line.tax > 0) {
            totalIva += val * (line.tax / 100);
        }
    });
    
    // Update HTML for group subtotals
    Object.keys(groupSubtotals).forEach(gKey => {
        const el = document.getElementById(`inv-group-subtotal-${gKey}`);
        if (el) el.innerText = formatCurrencyVal(groupSubtotals[gKey]);
    });
    
    const finalTotal = subtotalGeral + totalIva;
    
    // Update HTML
    const subEl = document.getElementById('inv-val-subtotal');
    if (subEl) subEl.innerText = formatCurrencyVal(subtotalGeral);
    
    const taxEl = document.getElementById('inv-val-tax');
    if (taxEl) taxEl.innerText = formatCurrencyVal(totalIva);
    
    const totalEl = document.getElementById('inv-val-total');
    if (totalEl) totalEl.innerText = formatCurrencyVal(finalTotal);
    
    const extEl = document.getElementById('inv-val-extenso');
    if (extEl) extEl.innerText = window.numeroParaExtenso(finalTotal);

    // Atualizar Cabeçalho (Câmbio e CIF)
    const cifForeign = (window.quoteEditorState.totals?.fobForeign || 0) + 
                       (window.quoteEditorState.totals?.freightForeign || 0) + 
                       (window.quoteEditorState.totals?.insForeign || 0) + 
                       (window.quoteEditorState.totals?.othForeign || 0);
    const curr = window.quoteEditorState.currency || 'USD';
    
    if (document.getElementById('inv-header-cambio-curr')) document.getElementById('inv-header-cambio-curr').innerText = curr;
    if (document.getElementById('inv-header-cif-curr')) document.getElementById('inv-header-cif-curr').innerText = curr;
    if (document.getElementById('inv-header-cambio')) document.getElementById('inv-header-cambio').innerText = formatCurrencyVal(window.quoteEditorState.exchangeRate || 0);
    if (document.getElementById('inv-header-cif')) document.getElementById('inv-header-cif').innerText = formatCurrencyVal(cifForeign);
};
window.openClientModal = async function() {
    const d = window.quoteEditorState.invoiceData;
    document.getElementById('modal-client-name').value = d.clientName || '';
    document.getElementById('modal-client-nuit').value = d.clientNuit || '';
    document.getElementById('modal-client-address').value = d.clientAddress || '';
    document.getElementById('modal-client-phone').value = d.clientPhone || '';
    document.getElementById('modal-client-email').value = d.clientEmail || '';
    
    document.getElementById('modal-client-edit').classList.remove('hidden');
    document.getElementById('modal-client-edit').classList.add('flex');

    const datalistEl = document.getElementById('modal-client-datalist');
    const searchEl = document.getElementById('modal-client-search');
    if (datalistEl && searchEl) {
        searchEl.value = '';
        datalistEl.innerHTML = '';
        try {
            window.availableClients = await getAllClients();
            let html = '';
            window.availableClients.forEach((c) => {
                const displayName = c.name + (c.nuit ? ` (NUIT: ${c.nuit})` : '');
                html += `<option value="${displayName}"></option>`;
            });
            datalistEl.innerHTML = html;
        } catch(err) {
            console.error('Erro ao carregar clientes:', err);
            datalistEl.innerHTML = '';
        }
    }
};

window.handleClientSelection = function() {
    const searchEl = document.getElementById('modal-client-search');
    if (!searchEl || !searchEl.value || searchEl.value === "") return;
    
    const val = searchEl.value;
    const client = window.availableClients && window.availableClients.find(c => {
        const displayName = c.name + (c.nuit ? ` (NUIT: ${c.nuit})` : '');
        return displayName === val;
    });

    if (client) {
        document.getElementById('modal-client-name').value = client.name || '';
        document.getElementById('modal-client-nuit').value = client.nuit || '';
        document.getElementById('modal-client-address').value = client.address || '';
        document.getElementById('modal-client-phone').value = client.phone || '';
        document.getElementById('modal-client-email').value = client.email || '';
        // Clear search so it doesn't stay there confusingly
        searchEl.value = '';
        searchEl.blur();
    }
};

window.closeClientModal = function() {
    document.getElementById('modal-client-edit').classList.add('hidden');
    document.getElementById('modal-client-edit').classList.remove('flex');
};

window.syncClientUIDisplay = function() {
    const d = window.quoteEditorState.invoiceData || {};
    
    const elName = document.getElementById('inv-client-name'); if (elName) elName.value = d.clientName || '';
    const elNuit = document.getElementById('inv-client-nuit'); if (elNuit) elNuit.value = d.clientNuit || '';
    const elAddress = document.getElementById('inv-client-address'); if (elAddress) elAddress.value = d.clientAddress || '';
    const elPhone = document.getElementById('inv-client-phone'); if (elPhone) elPhone.value = d.clientPhone || '';
    const elEmail = document.getElementById('inv-client-email'); if (elEmail) elEmail.value = d.clientEmail || '';
    
    const dispName = document.getElementById('inv-client-name-display'); if (dispName) dispName.innerText = d.clientName || '';
    const dispNuit = document.getElementById('inv-client-nuit-display'); if (dispNuit) dispNuit.innerText = d.clientNuit || '';
    const dispAddress = document.getElementById('inv-client-address-display'); if (dispAddress) dispAddress.innerText = d.clientAddress || '';
    const dispPhone = document.getElementById('inv-client-phone-display'); if (dispPhone) dispPhone.innerText = d.clientPhone ? 'Tel: ' + d.clientPhone : '';
    const dispEmail = document.getElementById('inv-client-email-display'); if (dispEmail) dispEmail.innerText = d.clientEmail ? 'Email: ' + d.clientEmail : '';
    
    const wrapperDetails = document.getElementById('inv-client-details-wrapper');
    const wrapperBody = document.getElementById('inv-body-wrapper');
    const wrapperFooter = document.getElementById('inv-footer-wrapper');
    const hasClient = !!d.clientName && d.clientName.trim().length > 0;
    
    if (wrapperDetails) {
        wrapperDetails.style.display = hasClient ? '' : 'none';
    }
    if (wrapperBody) {
        wrapperBody.style.display = hasClient ? '' : 'none';
    }
    if (wrapperFooter) {
        wrapperFooter.style.display = hasClient ? '' : 'none';
    }
};

window.saveClientModal = async function() {
    const name = document.getElementById('modal-client-name').value.trim();
    const nuit = document.getElementById('modal-client-nuit').value.trim();
    const address = document.getElementById('modal-client-address').value.trim();
    const phone = document.getElementById('modal-client-phone').value.trim();
    const email = document.getElementById('modal-client-email').value.trim();
    
    // Check if quote is saved, if not save it first
    if (!window.quoteEditorState.id) {
        // Remove window.closeQuoteEditor() from saveQuoteSimulation to prevent closing the editor
        await window.saveQuoteSimulation(true); 
        if (!window.quoteEditorState.id) {
            toast("Erro: Não foi possível criar o Rascunho da Fatura para anexar o Cliente.", "error");
            return; // Save failed
        }
    }

    try {
        await saveQuoteClient(window.quoteEditorState.id, {
            name,
            nuit,
            address,
            phone,
            email
        });
        toast("Cliente guardado com sucesso", "success");
        
        // Update state
        window.quoteEditorState.invoiceData.clientName = name;
        window.quoteEditorState.invoiceData.clientNuit = nuit;
        window.quoteEditorState.invoiceData.clientAddress = address;
        window.quoteEditorState.invoiceData.clientPhone = phone;
        window.quoteEditorState.invoiceData.clientEmail = email;
        
        // Update UI and visibility
        window.syncClientUIDisplay();
        
        window.closeClientModal();
    } catch(e) {
        console.error(e);
        toast("Erro ao guardar dados do cliente. Verifique a consola.", "error");
    }
};

// =========================================================================
// MÓDULO CONFIRM: MODO VERIFY (CONSOLIDADO DE CLIENTES POR STATUS)
// =========================================================================

export function getAllProjectsClients() {
    if (!state.confirm) state.confirm = {};
    if (state.confirm.allClientsCache) {
        return state.confirm.allClientsCache;
    }
    const projects = state.confirm?.projects || [];
    const allClients = [];

    projects.forEach(p => {
        let sheetData = p.sheet_data;
        if (!sheetData) return;
        
        if (typeof sheetData === 'string') {
            try {
                sheetData = JSON.parse(sheetData);
            } catch (err) {
                console.error("Erro ao fazer parse de sheet_data:", err);
                return;
            }
        }
        
        const data = sheetData.values || sheetData;
        if (!Array.isArray(data) || data.length <= 1) return;

        const columns = data[0];
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
        const bankDutyIdx = findCol(['BANK IN DUTY', 'BANK DUTY', 'BANK', 'BANCO']);
        const phoneIdx = findCol(['PHONE NUMBER', 'TELEFONE', 'PHONE', 'CONTACTO', 'CONTACT']);
        const cargoIdx = columns.findIndex(c => {
            const h = cleanString(c);
            return h.includes('CARGO') || h.includes('DESCRICAO') || h.includes('DESCRIÇÃO') || h.includes('PACKAGES');
        });

        const paidIdx = columns.findIndex((c, i) => {
            const h = cleanString(c);
            return (h.includes('PAID') || h.includes('PAGO')) && !h.includes('PREPAID') && !h.includes('DUTY') && i !== dutyIdx;
        });

        let noIdx = columns.findIndex(c => {
            const h = String(c || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return h === 'NO' || h === 'Nº' || h === 'N' || h === 'NUMERO' || h.startsWith('NO.') || h.startsWith('Nº.') || h.startsWith('N.');
        });
        if (noIdx === -1 && columns.length > 0) noIdx = 0;

        let lastIdCode = '';
        let lastName = '';
        let lastNo = '';

        const groupedClients = new Map();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const rowString = row.slice(0, 10).map(c => String(c || '').toUpperCase()).join(' ');
            if (rowString.includes('TOTAL')) continue;

            let idCode = idCodeIdx !== -1 ? String(row[idCodeIdx] || '').trim() : '';
            let name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
            let noValue = noIdx !== -1 ? String(row[noIdx] || '').trim() : '';

            if (idCode !== '') lastIdCode = idCode;
            else idCode = lastIdCode;

            if (name !== '') lastName = name;
            else name = lastName;

            if (noValue !== '') lastNo = noValue;
            else noValue = lastNo;

            // Ignorar linhas vazias sem id e nome
            if (!idCode && !name) continue;

            const groupId = `${p.id}_${idCode}_${name}`.replace(/\s+/g, '_') || `ROW_${p.id}_${i}`;

            if (!groupedClients.has(groupId)) {
                groupedClients.set(groupId, {
                    projectId: p.id,
                    projectName: p.name,
                    sheetId: p.sheetId,
                    folderId: p.folderId,
                    idCode: idCode,
                    name: name,
                    no: noValue,
                    phone: phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '',
                    cargo: cargoIdx !== -1 ? String(row[cargoIdx] || '').trim() : '',
                    duty: 0,
                    statuses: [],
                    rows: []
                });
            }

            const client = groupedClients.get(groupId);

            const rawPaid = paidIdx !== -1 ? row[paidIdx] : 0;
            const paidVal = parseFloat(String(rawPaid || '0').replace(/[^0-9.-]+/g, '')) || 0;

            const rawPrepaid = dutyPrepaidIdx !== -1 ? row[dutyPrepaidIdx] : 0;
            const prepaidVal = parseFloat(String(rawPrepaid || '0').replace(/[^0-9.-]+/g, '')) || 0;

            const rawBalance = balanceIdx !== -1 ? row[balanceIdx] : 0;
            const balanceVal = parseFloat(String(rawBalance || '0').replace(/[^0-9.-]+/g, '')) || 0;

            const rawBankDuty = bankDutyIdx !== -1 ? String(row[bankDutyIdx] || '').trim() : '';
            const rowStatus = calculateRowStatus(row[statusIdx], balanceVal, rawBankDuty, paidVal, prepaidVal);

            if (rowStatus) {
                client.statuses.push(rowStatus);
            }

            const rawDuty = dutyIdx !== -1 ? row[dutyIdx] : 0;
            const dutyVal = parseFloat(String(rawDuty || '0').replace(/[^0-9.-]+/g, '')) || 0;
            client.duty += dutyVal;
            
            client.rows.push(row);
        }

        groupedClients.forEach(c => {
            c.uniqueStatuses = Array.from(new Set(c.statuses));
            allClients.push(c);
        });
    });

    state.confirm.allClientsCache = allClients;
    return allClients;
}

export function setConfirmDashboardTab(tab) {
    if (!state.confirm) state.confirm = {};
    state.confirm.dashboardTab = tab;

    const tabNormal = document.getElementById('tab-confirm-normal');
    const tabVerify = document.getElementById('tab-confirm-verify');
    
    const normalContainer = document.getElementById('confirm-normal-container');
    const projectsList = document.getElementById('confirm-projects-list');
    const intervalBar = document.getElementById('confirm-interval-bar');
    const verifyContainer = document.getElementById('confirm-verify-container');
    
    const searchBar = document.getElementById('input-confirm-project-search')?.parentElement?.parentElement;
    const btnNewProject = document.querySelector('button[onclick="openConfirmProjectModal()"]');

    if (tab === 'normal') {
        tabNormal?.classList.add('bg-white', 'shadow-sm', 'text-black');
        tabNormal?.classList.remove('text-gray-500');
        tabVerify?.classList.remove('bg-white', 'shadow-sm', 'text-black');
        tabVerify?.classList.add('text-gray-500');
        
        if (normalContainer) normalContainer.classList.remove('hidden');
        if (projectsList) projectsList.classList.remove('hidden');
        if (intervalBar) intervalBar.classList.remove('hidden');
        if (verifyContainer) verifyContainer.classList.add('hidden');
        
        if (searchBar) searchBar.classList.remove('hidden');
        if (btnNewProject) {
            const role = pb.authStore.model?.role || 'USER';
            btnNewProject.style.display = role === 'ADMIN' ? 'flex' : 'none';
        }
    } else {
        tabVerify?.classList.add('bg-white', 'shadow-sm', 'text-black');
        tabVerify?.classList.remove('text-gray-500');
        tabNormal?.classList.remove('bg-white', 'shadow-sm', 'text-black');
        tabNormal?.classList.add('text-gray-500');
        
        if (normalContainer) normalContainer.classList.add('hidden');
        if (projectsList) projectsList.classList.add('hidden');
        if (intervalBar) intervalBar.classList.add('hidden');
        if (verifyContainer) verifyContainer.classList.remove('hidden');
        
        if (searchBar) searchBar.classList.add('hidden');
        if (btnNewProject) btnNewProject.style.display = 'none';
        
        renderVerifyClients();
    }
}
window.setConfirmDashboardTab = setConfirmDashboardTab;

export function renderVerifyClients() {
    const container = document.getElementById('tbody-verify-clients');
    if (!container) return;

    const allClients = getAllProjectsClients();
    if (!state.confirm) state.confirm = {};
    state.confirm.allClients = allClients;
    
    const projSelect = document.getElementById('select-verify-project');
    if (projSelect) {
        projSelect.innerHTML = '<option value="TODOS">TODOS OS PROJETOS</option>';
        const projects = state.confirm.projects || [];
        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name.toUpperCase();
            projSelect.appendChild(opt);
        });
    }

    filterVerifyClients();
}
window.renderVerifyClients = renderVerifyClients;

export function filterVerifyClients(resetLimit = false) {
    const tbody = document.getElementById('tbody-verify-clients');
    const emptyEl = document.getElementById('verify-clients-empty');
    const countEl = document.getElementById('verify-clients-count');
    if (!tbody) return;

    if (resetLimit) {
        state.confirm.verifyLimit = 100;
    }

    const statusFilter = document.getElementById('select-verify-status')?.value || 'PENDENTE';
    const projectFilter = document.getElementById('select-verify-project')?.value || 'TODOS';
    const searchText = (document.getElementById('input-verify-search')?.value || '').toLowerCase().trim();

    const allClients = state.confirm.allClients || [];
    
    let filtered = allClients;

    // 1. Filtrar por Projeto
    if (projectFilter !== 'TODOS') {
        filtered = filtered.filter(c => c.projectId === projectFilter);
    }

    // 2. Filtrar por Status Estrito Canónico
    if (statusFilter !== 'TODOS') {
        const targetClean = getCanonicalStatus(statusFilter);
        filtered = filtered.filter(c => {
            return c.uniqueStatuses.some(s => {
                const current = getCanonicalStatus(s);
                return current === targetClean;
            });
        });
    }

    // 3. Filtrar por Pesquisa de Texto
    if (searchText) {
        filtered = filtered.filter(c => {
            return (c.name || '').toLowerCase().includes(searchText) ||
                   (c.idCode || '').toLowerCase().includes(searchText) ||
                   (c.phone || '').toLowerCase().includes(searchText) ||
                   (c.cargo || '').toLowerCase().includes(searchText);
        });
    }

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        emptyEl?.classList.remove('hidden');
        if (countEl) countEl.textContent = 'Total: 0 Clientes';
        return;
    }

    emptyEl?.classList.add('hidden');
    
    const limit = state.confirm.verifyLimit || 100;
    const visible = filtered.slice(0, limit);
    
    if (countEl) {
        countEl.textContent = `Mostrando ${visible.length} de ${filtered.length} Clientes`;
    }

    visible.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        
        const statusBadges = c.uniqueStatuses.map(s => {
            const canon = getCanonicalStatus(s);
            let colorClass = "bg-slate-100 text-slate-700 border-slate-300";
            if (canon === 'PENDENTE') colorClass = "bg-yellow-400 text-black border-yellow-500 font-black";
            else if (canon === 'CONFIRMADO') colorClass = "bg-green-100 text-green-800 border-green-300 font-bold";
            else if (canon === 'PARCIAL') colorClass = "bg-amber-100 text-amber-800 border-amber-300 font-bold";
            else if (canon === 'RE-VERIFICANDO') colorClass = "bg-blue-100 text-blue-800 border-blue-300 font-bold";
            else if (canon === 'SEM COMPROVATIVO') colorClass = "bg-orange-100 text-orange-800 border-orange-300 font-bold";
            else if (canon === 'COMPROVATIVO ERRADO') colorClass = "bg-red-100 text-red-800 border-red-300 font-bold";
            else if (canon === 'AGUARDA PAGAMENTO') colorClass = "bg-slate-100 text-slate-600 border-slate-300 font-bold";
            
            return `<span class="px-2 py-0.5 border rounded-md text-[8px] uppercase shrink-0 ${colorClass}">${s}</span>`;
        }).join(' ');

        tr.innerHTML = `
            <td class="py-2 px-3 font-black text-slate-900 uppercase">${c.projectName}</td>
            <td class="py-2 px-3"><div class="flex flex-wrap gap-1">${statusBadges}</div></td>
            <td class="py-2 px-3 font-bold text-slate-700">${c.idCode || '-'}</td>
            <td class="py-2 px-3 font-bold text-slate-900 uppercase">${c.name || '-'}</td>
            <td class="py-2 px-3 text-slate-500">${c.phone || '-'}</td>
            <td class="py-2 px-3 text-slate-500 truncate max-w-xs" title="${c.cargo}">${c.cargo || '-'}</td>
            <td class="py-2 px-3 font-bold text-slate-900 text-center">${formatMZN(c.duty)}</td>
            <td class="py-2 px-3 text-right">
                <button onclick="window.openVerifyClientProject('${c.sheetId}', '${c.folderId || ''}', '${c.projectName.replace(/'/g, "\\'")}', '${(c.idCode || c.name || '').replace(/'/g, "\\'")}')" class="bg-black text-white hover:bg-gray-800 px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all">
                    Abrir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (filtered.length > limit) {
        const trMore = document.createElement('tr');
        trMore.className = "bg-slate-50";
        trMore.innerHTML = `
            <td colspan="8" class="py-3 text-center">
                <button onclick="window.incrementVerifyLimit()" class="text-blue-600 hover:text-blue-800 hover:underline font-black uppercase text-[10px] tracking-widest outline-none active:scale-95 transition-all">
                    Mostrar Mais (+100 resultados)
                </button>
            </td>
        `;
        tbody.appendChild(trMore);
    }
}
window.filterVerifyClients = filterVerifyClients;

window.incrementVerifyLimit = function() {
    state.confirm.verifyLimit = (state.confirm.verifyLimit || 100) + 100;
    filterVerifyClients(false);
};

window.openVerifyClientProject = function(sheetId, folderId, projectName, clientSearch) {
    if (!state.confirm) state.confirm = {};
    state.confirm.pendingAutoOpenClient = clientSearch;

    if (typeof window.selectConfirmProject === 'function') {
        window.selectConfirmProject(sheetId, folderId, projectName);
    }
    
    setTimeout(() => {
        const searchInput = document.getElementById('input-confirm-search');
        if (searchInput) {
            searchInput.value = clientSearch;
            if (typeof window.handleConfirmSearch === 'function') {
                window.handleConfirmSearch();
            }
        }
    }, 1200);
};

/**
 * Abre o modal de auditoria e linha do tempo do cliente ativo
 */
export function setAuditHistoryButtonVisible(visible) {
    const auditBtn = document.getElementById('btn-toggle-audit-history');
    if (auditBtn) {
        if (visible) {
            auditBtn.classList.remove('hidden');
            auditBtn.classList.add('flex');
        } else {
            auditBtn.classList.add('hidden');
            auditBtn.classList.remove('flex');
        }
    }
}
window.setAuditHistoryButtonVisible = setAuditHistoryButtonVisible;

export async function openClientAuditModal() {
    const client = window.currentActiveClient;
    if (!client) {
        toast("Selecione primeiro um cliente para ver o histórico de auditoria.", "warning");
        return;
    }
    const modal = document.getElementById('modal-confirm-audit-trail');
    if (!modal) return;
    modal.classList.remove('hidden');

    const subtitleEl = document.getElementById('modal-audit-client-subtitle');
    if (subtitleEl) {
        subtitleEl.innerText = `CLIENTE: ${client.displayName || 'SEM NOME'} (Nº ${client.no || '—'})`;
    }

    const contentEl = document.getElementById('modal-audit-timeline-content');
    if (!contentEl) return;
    contentEl.innerHTML = `
        <div class="p-8 text-center text-xs font-bold text-slate-400 uppercase italic flex items-center justify-center gap-2">
            <svg class="animate-spin w-4 h-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
            A carregar histórico e auditoria...
        </div>
    `;

    try {
        const sheetId = state.confirm?.sheetId || '';
        const logs = await getClientAuditLogs(sheetId, client.no);

        // Também reunir ficheiros do Google Drive já conhecidos para este cliente
        const driveEvents = [];
        if (state.confirm.clientFiles && state.confirm.clientFiles.length > 0) {
            state.confirm.clientFiles.forEach(f => {
                let uploader = f.appProperties?.uploadedBy || '';
                if (!uploader && f.description && f.description.startsWith('Carregado por: ')) {
                    uploader = f.description.replace('Carregado por: ', '').trim();
                }
                if (uploader) {
                    driveEvents.push({
                        created: f.appProperties?.uploadedAt || f.createdTime || new Date().toISOString(),
                        type: 'AUDIT_DOC_UPLOAD',
                        userDisplay: uploader,
                        payload: {
                            actionType: 'DOC_UPLOAD',
                            userName: uploader,
                            fileName: f.name,
                            source: 'Google Drive'
                        }
                    });
                }
            });
        }

        // Juntar logs do PocketBase e eventos do Drive, remover duplicados e ordenar decrescente
        const allTimeline = [];
        if (logs && Array.isArray(logs)) {
            logs.forEach(l => {
                const p = l.payload || {};
                allTimeline.push({
                    id: l.id,
                    created: l.created,
                    type: l.type,
                    userDisplay: p.userName || l.expand?.user?.name || l.expand?.user?.email || 'Operador',
                    role: p.userRole || '',
                    payload: p
                });
            });
        }

        // Adicionar eventos de ficheiros drive que possam não estar ainda no log
        driveEvents.forEach(de => {
            const alreadyLogged = allTimeline.some(t => t.type === 'AUDIT_DOC_UPLOAD' && t.payload?.fileName === de.payload.fileName);
            if (!alreadyLogged) {
                allTimeline.push(de);
            }
        });

        // Ordenar por data decrescente
        allTimeline.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

        if (allTimeline.length === 0) {
            contentEl.innerHTML = `
                <div class="p-8 text-center bg-white rounded-2xl border border-slate-100 text-slate-400">
                    <p class="text-xs font-bold uppercase mb-1">Sem registos de auditoria</p>
                    <p class="text-[11px]">As novas ações realizadas neste cliente (documentos, pagamentos, armazém) aparecerão aqui automaticamente.</p>
                </div>
            `;
            return;
        }

        // Gerar timeline HTML
        const actionLabels = {
            'AUDIT_DOC_UPLOAD': { label: 'Documento Carregado', color: 'bg-blue-500', icon: '📄' },
            'AUDIT_DOC_DELETE': { label: 'Documento Eliminado', color: 'bg-red-500', icon: '🗑️' },
            'AUDIT_PAGAMENTO_VINCULADO': { label: 'Pagamento Reconciliado', color: 'bg-emerald-500', icon: '💳' },
            'AUDIT_PAGAMENTO_DESALOCADO': { label: 'Pagamento Desalocado', color: 'bg-rose-500', icon: '🔄' },
            'AUDIT_PAGAMENTO_TRANSFERIDO': { label: 'Pagamento Reatribuído', color: 'bg-amber-500', icon: '⇄' },
            'AUDIT_ESTADO_ALTERADO': { label: 'Estado Alterado', color: 'bg-amber-500', icon: '🔄' },
            'AUDIT_ATUALIZACAO_EM_MASSA': { label: 'Atualização em Massa', color: 'bg-indigo-500', icon: '⚡' },
            'AUDIT_ARMAZEM_GRAVADO': { label: 'Armazém Atualizado', color: 'bg-purple-500', icon: '📦' },
            'AUDIT_ARMAZEM_ENTREGUE': { label: 'Carga Entregue', color: 'bg-teal-500', icon: '✅' },
            'AUDIT_GUIA_EMITIDA': { label: 'Guia de Entrega Emitida', color: 'bg-cyan-500', icon: '🖨️' },
            'AUDIT_CLIENT_CREATED': { label: 'Cliente Criado', color: 'bg-emerald-600', icon: '✨' },
            'AUDIT_ARTICLE_ADDED': { label: 'Artigo Adicionado', color: 'bg-sky-600', icon: '➕' }
        };

        let html = `<div class="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">`;

        allTimeline.forEach(item => {
            const meta = actionLabels[item.type] || { label: item.type.replace('AUDIT_', ''), color: 'bg-slate-500', icon: '📌' };
            const dateStr = formatDateDisplay(item.created);
            const p = item.payload || {};
            const userLabel = item.userDisplay || p.userName || 'Operador';

            let detailHtml = '';
            if (item.type === 'AUDIT_DOC_UPLOAD') {
                detailHtml = `Ficheiro: <strong class="text-slate-800">${p.fileName || p.originalName || 'Documento'}</strong>`;
            } else if (item.type === 'AUDIT_DOC_DELETE') {
                detailHtml = `Ficheiro eliminado: <strong class="text-slate-800">${p.fileName || 'Documento'}</strong>`;
            } else if (item.type === 'AUDIT_PAGAMENTO_VINCULADO') {
                detailHtml = `
                    <div>Tipo: <strong class="text-slate-800">${p.tipo || 'Duty'}</strong> | Valor: <strong class="text-emerald-700">${formatMZN(p.allocatedAmount || 0)}</strong></div>
                    ${p.payments && p.payments.length ? `<div class="text-[10px] text-slate-500 mt-0.5">Refs: ${p.payments.map(x => x.ref).filter(Boolean).join(', ')}</div>` : ''}
                    ${p.comment ? `<div class="text-[10px] text-amber-700 italic mt-0.5">Nota: "${p.comment}"</div>` : ''}
                `;
            } else if (item.type === 'AUDIT_PAGAMENTO_DESALOCADO') {
                detailHtml = `
                    <div>Movimento desalocado: <strong class="text-rose-700">${formatMZN(p.amount || 0)}</strong> ${p.tipo ? `(${p.tipo})` : ''}</div>
                    ${p.ref ? `<div class="text-[10px] text-slate-500 mt-0.5 font-mono">Ref: ${p.ref}</div>` : ''}
                    ${p.mergedWithMaster ? `<div class="text-[9px] text-emerald-600 font-bold mt-0.5">Reintegrado ao movimento mestre</div>` : ''}
                `;
            } else if (item.type === 'AUDIT_PAGAMENTO_TRANSFERIDO') {
                detailHtml = `
                    <div>Movimento transferido: <strong class="text-amber-700">${formatMZN(p.amount || 0)}</strong></div>
                    <div class="text-[10px] text-slate-600 mt-0.5">De: <strong class="text-slate-800">${p.de || '—'}</strong> ➔ Para: <strong class="text-emerald-700">${p.para || '—'}</strong></div>
                    ${p.ref ? `<div class="text-[10px] text-slate-500 mt-0.5 font-mono">Ref: ${p.ref}</div>` : ''}
                `;
            } else if (item.type === 'AUDIT_ARMAZEM_GRAVADO' || item.type === 'AUDIT_ARMAZEM_ENTREGUE') {
                detailHtml = `
                    <div>Descarregado: <strong>${p.descarregado ?? '—'}</strong> | Entregue: <strong>${p.entregue ?? '—'}</strong></div>
                    ${p.entregueA ? `<div class="text-[10px] text-slate-600 mt-0.5">Entregue a: <strong>${p.entregueA}</strong> (${p.contacto || 'Sem contacto'})</div>` : ''}
                    ${p.armazenagemPago ? `<div class="text-[10px] text-slate-500">Armazenagem: <strong>${p.armazenagemPago === 'SIM' ? 'PAGO' : 'PENDENTE'}</strong></div>` : ''}
                `;
            } else if (item.type === 'AUDIT_GUIA_EMITIDA') {
                detailHtml = `
                    <div>Emitida por: <strong>${p.emitidoPor || userLabel}</strong></div>
                    <div class="text-[10px] text-slate-600 mt-0.5">Volumes: <strong>${p.volumesEntregues ?? '—'}</strong> | Recebedor: <strong>${p.recebedor || '—'}</strong></div>
                `;
            } else if (item.type === 'AUDIT_ESTADO_ALTERADO') {
                detailHtml = `Novo estado: <strong class="text-indigo-700">${p.status || '—'}</strong> ${p.comentario ? `(Nota: "${p.comentario}")` : ''}`;
            } else if (item.type === 'AUDIT_ATUALIZACAO_EM_MASSA') {
                detailHtml = `Atualizadas <strong class="text-slate-800">${p.qtdOrdens} ordens</strong> ${p.estado ? `para estado <strong>${p.estado}</strong>` : ''} ${p.banco ? `no banco <strong>${p.banco}</strong>` : ''}`;
            } else if (item.type === 'AUDIT_ARTICLE_ADDED') {
                detailHtml = `Artigo: <strong class="text-slate-800">${p.orderNumber || p.subNumber || 'Novo'}</strong> (${p.cbm || 0} CBM, ${p.packages || 0} Pkgs)`;
            } else if (item.type === 'AUDIT_CLIENT_CREATED') {
                detailHtml = `Cliente registado com <strong class="text-slate-800">${p.totalOrders || 1} ordens</strong>`;
            }

            html += `
                <div class="relative group">
                    <div class="absolute -left-[19px] top-1.5 w-3.5 h-3.5 rounded-full ${meta.color} border-2 border-white shadow-xs"></div>
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
                        <div class="flex items-center justify-between gap-2 mb-1 flex-wrap">
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs">${meta.icon}</span>
                                <span class="text-xs font-black uppercase text-slate-800 tracking-tight">${meta.label}</span>
                            </div>
                            <span class="text-[10px] font-bold text-slate-400">${dateStr}</span>
                        </div>
                        <div class="text-[11px] text-slate-600 space-y-0.5">
                            ${detailHtml}
                        </div>
                        <div class="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                            <span>Por: <strong class="text-slate-700">${userLabel}</strong></span>
                            ${item.role ? `<span class="uppercase text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold">${item.role}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        contentEl.innerHTML = html;

    } catch (err) {
        console.error('[AUDIT] Erro ao carregar timeline de auditoria:', err);
        contentEl.innerHTML = `
            <div class="p-6 text-center bg-red-50 rounded-2xl border border-red-200 text-red-700">
                <p class="text-xs font-bold uppercase mb-1">Erro ao carregar auditoria</p>
                <p class="text-[11px]">${err.message}</p>
            </div>
        `;
    }
}
window.openClientAuditModal = openClientAuditModal;


// =====================================================================
// --- MÓDULO PAUTA INSPECTOR (ESTRUTURA EM ESCADA COLAPSÁVEL) ---
// =====================================================================

window.pautaInspectorState = {
    activeCode: '',
    targetRowId: null,
    data: null,
    viewMode: 'staircase',
    expandedSteps: {
        section: true,
        chapter: true,
        heading: true,
        activeSubposition: true
    },
    expandedOtherSubpositions: false,
    expandedSubpositionsMap: {},
    searchTimeout: null
};

window.openPautaInspector = async function(code = null, targetRowId = null) {
    if (!code && targetRowId) {
        const targetItem = window.quoteEditorState.items.find(i => i.id === targetRowId);
        if (targetItem && targetItem.hsCode) code = targetItem.hsCode;
    }
    if (!code) {
        const firstWithCode = window.quoteEditorState.items.find(i => i.hsCode && i.hsCode.length >= 4);
        if (firstWithCode) {
            code = firstWithCode.hsCode;
            if (!targetRowId) targetRowId = firstWithCode.id;
        }
    }
    if (!code) code = '87032390';

    window.pautaInspectorState.activeCode = String(code).replace(/[^0-9]/g, '');
    window.pautaInspectorState.targetRowId = targetRowId;
    window.pautaInspectorState.expandedSteps = {
        section: true,
        chapter: true,
        heading: true,
        activeSubposition: true
    };
    window.pautaInspectorState.expandedOtherSubpositions = false;
    window.pautaInspectorState.expandedSubpositionsMap = {};

    const modal = document.getElementById('modal-pauta-inspector');
    if (!modal) return;
    openModal('modal-pauta-inspector');

    const loadingEl = document.getElementById('pauta-inspector-loading');
    const contentEl = document.getElementById('pauta-inspector-content');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (contentEl) contentEl.classList.add('hidden');

    const searchInput = document.getElementById('pauta-inspector-search');
    if (searchInput) searchInput.value = '';
    const resultsContainer = document.getElementById('pauta-inspector-search-results');
    if (resultsContainer) resultsContainer.classList.add('hidden');

    try {
        const data = await api.getPautaHierarchy(window.pautaInspectorState.activeCode);
        window.pautaInspectorState.data = data;
        window.renderPautaInspector(data);
    } catch (err) {
        console.error('[PAUTA INSPECTOR] Erro ao carregar dados:', err);
        if (loadingEl) {
            loadingEl.innerHTML = '<div class="text-center p-8"><p class="text-sm font-bold text-red-500">Erro ao carregar artigo na Pauta.</p><p class="text-xs text-slate-400 mt-1">' + (err.message || 'Verifique a ligação ou o código inserido.') + '</p><button type="button" onclick="window.closePautaInspector()" class="mt-4 px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl">Fechar</button></div>';
        }
    }
};

window.inspectPautaCode = async function(code) {
    if (!code) return;
    window.pautaInspectorState.activeCode = String(code).replace(/[^0-9]/g, '');
    
    const loadingEl = document.getElementById('pauta-inspector-loading');
    const contentEl = document.getElementById('pauta-inspector-content');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (contentEl) contentEl.classList.add('hidden');

    try {
        const data = await api.getPautaHierarchy(window.pautaInspectorState.activeCode);
        window.pautaInspectorState.data = data;
        window.pautaInspectorState.expandedSteps.activeSubposition = true;
        window.renderPautaInspector(data);
    } catch (err) {
        console.error('[PAUTA INSPECTOR] Erro ao inspecionar código:', err);
        toast('Erro ao buscar artigo ' + code, 'error');
        if (loadingEl) loadingEl.classList.add('hidden');
        if (contentEl) contentEl.classList.remove('hidden');
    }
};

window.setPautaInspectorViewMode = function(mode) {
    window.pautaInspectorState.viewMode = mode;
    const btnStaircase = document.getElementById('btn-pauta-tab-staircase');
    const btnTable = document.getElementById('btn-pauta-tab-table');
    const viewStaircase = document.getElementById('pauta-view-staircase');
    const viewTable = document.getElementById('pauta-view-table');

    if (mode === 'staircase') {
        if (btnStaircase) {
            btnStaircase.className = 'px-2.5 py-1 rounded-lg transition-all bg-white text-slate-900 shadow-xs flex items-center gap-1.5';
        }
        if (btnTable) {
            btnTable.className = 'px-2.5 py-1 rounded-lg transition-all text-slate-600 hover:text-slate-900 flex items-center gap-1.5';
        }
        if (viewStaircase) viewStaircase.classList.remove('hidden');
        if (viewTable) viewTable.classList.add('hidden');
    } else {
        if (btnTable) {
            btnTable.className = 'px-2.5 py-1 rounded-lg transition-all bg-white text-slate-900 shadow-xs flex items-center gap-1.5';
        }
        if (btnStaircase) {
            btnStaircase.className = 'px-2.5 py-1 rounded-lg transition-all text-slate-600 hover:text-slate-900 flex items-center gap-1.5';
        }
        if (viewTable) viewTable.classList.remove('hidden');
        if (viewStaircase) viewStaircase.classList.add('hidden');

        setTimeout(() => {
            const activeRow = document.getElementById('pauta-sibling-row-' + window.pautaInspectorState.activeCode);
            if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
};

window.togglePautaStaircaseStep = function(stepName) {
    window.pautaInspectorState.expandedSteps[stepName] = !window.pautaInspectorState.expandedSteps[stepName];
    const isExpanded = window.pautaInspectorState.expandedSteps[stepName];
    
    const bodyEl = document.getElementById('pauta-step-body-' + stepName);
    const chevronEl = document.getElementById('pauta-step-chevron-' + stepName);
    
    if (bodyEl) {
        if (isExpanded) bodyEl.classList.remove('hidden');
        else bodyEl.classList.add('hidden');
    }
    if (chevronEl) {
        chevronEl.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
    }
};

window.togglePautaOtherSubpositions = function() {
    window.pautaInspectorState.expandedOtherSubpositions = !window.pautaInspectorState.expandedOtherSubpositions;
    const isExpanded = window.pautaInspectorState.expandedOtherSubpositions;
    const bodyEl = document.getElementById('pauta-other-subpositions-body');
    const chevronEl = document.getElementById('pauta-other-subpositions-chevron');
    if (bodyEl) {
        if (isExpanded) bodyEl.classList.remove('hidden');
        else bodyEl.classList.add('hidden');
    }
    if (chevronEl) {
        chevronEl.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
    }
};

window.togglePautaSiblingSubposition = function(subCode) {
    const current = !window.pautaInspectorState.expandedSubpositionsMap[subCode];
    window.pautaInspectorState.expandedSubpositionsMap[subCode] = !current;
    const isExpanded = !current;
    const bodyEl = document.getElementById('pauta-sub-body-' + subCode);
    const chevronEl = document.getElementById('pauta-sub-chevron-' + subCode);
    if (bodyEl) {
        if (isExpanded) bodyEl.classList.remove('hidden');
        else bodyEl.classList.add('hidden');
    }
    if (chevronEl) {
        chevronEl.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
    }
};

window.expandAllPautaStaircase = function() {
    window.pautaInspectorState.expandedSteps = {
        section: true,
        chapter: true,
        heading: true,
        activeSubposition: true
    };
    window.pautaInspectorState.expandedOtherSubpositions = true;
    if (window.pautaInspectorState.data && window.pautaInspectorState.data.subpositions) {
        window.pautaInspectorState.data.subpositions.forEach(s => {
            window.pautaInspectorState.expandedSubpositionsMap[s.code] = true;
        });
    }
    if (window.pautaInspectorState.data) {
        window.renderPautaInspector(window.pautaInspectorState.data);
    }
};

window.collapseAllPautaStaircase = function() {
    window.pautaInspectorState.expandedSteps = {
        section: true,
        chapter: false,
        heading: false,
        activeSubposition: false
    };
    window.pautaInspectorState.expandedOtherSubpositions = false;
    window.pautaInspectorState.expandedSubpositionsMap = {};
    if (window.pautaInspectorState.data) {
        window.renderPautaInspector(window.pautaInspectorState.data);
    }
};

window.renderPautaInspector = function(data) {
    const loadingEl = document.getElementById('pauta-inspector-loading');
    const contentEl = document.getElementById('pauta-inspector-content');
    if (loadingEl) loadingEl.classList.add('hidden');
    if (contentEl) contentEl.classList.remove('hidden');

    const h = data.hierarchy;
    const item = data.item || {};
    const subpositions = data.subpositions || [];
    const activeSubCode = h.subheading.code;
    const activeSub = subpositions.find(s => s.code === activeSubCode) || {
        code: activeSubCode,
        formatted: h.subheading.formatted,
        label: h.subheading.label,
        items: data.siblings.filter(s => s.code.startsWith(activeSubCode))
    };
    const otherSubs = subpositions.filter(s => s.code !== activeSubCode);

    const daRate = getRateFromPauta(item, ['Direitos', 'Aduaneiros']);
    const ivaRate = getRateFromPauta(item, ['IVA', 'Valor Acrescentado']);
    const tsaRate = getRateFromPauta(item, ['Sobretaxa']);
    const iceComplex = getComplexRateFromPauta(item, ['consumo', 'ice']);

    let iceFormatted = '0.00%';
    if (iceComplex) {
        if (iceComplex.raw) iceFormatted = iceComplex.raw;
        else if (iceComplex.adValorem > 0) iceFormatted = (iceComplex.adValorem * 100).toFixed(2) + '%';
        else if (iceComplex.specificAmount > 0) iceFormatted = iceComplex.specificAmount + ' MZN / ' + iceComplex.specificUnit;
    }

    const extraDuties = (item.duties || []).filter(d => {
        const name = (d['Nome da Taxa'] || '').toLowerCase();
        return !name.includes('direitos') && !name.includes('iva') && !name.includes('consumo') && !name.includes('ice') && !name.includes('sobretaxa');
    });

    const targetRowId = window.pautaInspectorState.targetRowId;
    const targetRowIndex = window.quoteEditorState.items.findIndex(i => i.id === targetRowId);
    const st = window.pautaInspectorState.expandedSteps;

    // --- VISTA 1: ESCADA COLAPSÁVEL SEGUINDO A HIERARQUIA ---
    const staircaseContainer = document.getElementById('pauta-view-staircase');
    if (staircaseContainer) {
        staircaseContainer.innerHTML = [
            '<!-- DEGRAU 1: SECÇÃO (I a XXI) -->',
            '<div class="staircase-step bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">',
            '    <div onclick="window.togglePautaStaircaseStep(\'section\')" class="p-3 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 text-white flex items-center justify-between cursor-pointer hover:bg-slate-850 transition-colors">',
            '        <div class="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pr-2">',
            '            <span id="pauta-step-chevron-section" class="w-5 h-5 flex items-center justify-center text-slate-400 transition-transform duration-200 text-xs shrink-0" style="transform: ' + (st.section ? 'rotate(90deg)' : 'rotate(0deg)') + ';">▶</span>',
            '            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 min-w-0">',
            '                <span class="px-2 py-0.5 rounded-lg bg-slate-700/80 text-slate-100 font-black text-[10px] uppercase tracking-wider shrink-0 border border-slate-600/60 shadow-2xs">Secção (I a XXI)</span>',
            '                <h4 class="text-xs sm:text-sm font-black truncate text-white tracking-tight"><strong class="text-emerald-400">' + h.section.roman + ':</strong> ' + h.section.name + '</h4>',
            '            </div>',
            '        </div>',
            '        <span class="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700 shrink-0 hidden sm:inline">Nível 1 da Pauta</span>',
            '    </div>',
            '',
            '    <!-- CORPO DO DEGRAU 1: CONTÉM O DEGRAU 2 (CAPÍTULO) INDENTADO COM LINHA GUIA -->',
            '    <div id="pauta-step-body-section" class="' + (st.section ? '' : 'hidden') + ' p-3 sm:p-4 pt-2 sm:pt-3 bg-slate-50/50">',
            '        <div class="border-l-2 border-indigo-300 ml-2 sm:ml-4 pl-3 sm:pl-5 space-y-3">',
            '',
            '            <!-- DEGRAU 2: CAPÍTULO (01 a 97) -->',
            '            <div class="staircase-step bg-white rounded-2xl border border-indigo-200 shadow-xs overflow-hidden transition-all">',
            '                <div onclick="window.togglePautaStaircaseStep(\'chapter\')" class="p-3 sm:p-3.5 bg-gradient-to-r from-indigo-900 via-indigo-850 to-indigo-800 text-white flex items-center justify-between cursor-pointer hover:bg-indigo-850 transition-colors">',
            '                    <div class="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pr-2">',
            '                        <span id="pauta-step-chevron-chapter" class="w-5 h-5 flex items-center justify-center text-indigo-300 transition-transform duration-200 text-xs shrink-0" style="transform: ' + (st.chapter ? 'rotate(90deg)' : 'rotate(0deg)') + ';">▶</span>',
            '                        <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 min-w-0">',
            '                            <span class="px-2 py-0.5 rounded-lg bg-indigo-700 text-indigo-100 font-black text-[10px] uppercase tracking-wider shrink-0 border border-indigo-600 shadow-2xs">Capítulo (01 a 97)</span>',
            '                            <h4 class="text-xs sm:text-sm font-black truncate text-white tracking-tight"><strong class="text-indigo-200">' + h.chapter.label + ':</strong> ' + h.chapter.name + '</h4>',
            '                        </div>',
            '                    </div>',
            '                    <span class="text-[10px] font-bold text-indigo-200 bg-indigo-800/80 px-2 py-0.5 rounded-lg border border-indigo-700 shrink-0 hidden sm:inline">Capítulo ' + h.chapter.code + '</span>',
            '                </div>',
            '',
            '                <!-- CORPO DO DEGRAU 2: CONTÉM O DEGRAU 3 (POSIÇÃO) INDENTADO COM LINHA GUIA -->',
            '                <div id="pauta-step-body-chapter" class="' + (st.chapter ? '' : 'hidden') + ' p-3 sm:p-4 pt-2 sm:pt-3 bg-indigo-50/20">',
            '                    <div class="border-l-2 border-blue-300 ml-2 sm:ml-4 pl-3 sm:pl-5 space-y-3">',
            '',
            '                        <!-- DEGRAU 3: POSIÇÃO (4 DÍGITOS) -->',
            '                        <div class="staircase-step bg-white rounded-2xl border border-blue-200 shadow-xs overflow-hidden transition-all">',
            '                            <div onclick="window.togglePautaStaircaseStep(\'heading\')" class="p-3 sm:p-3.5 bg-gradient-to-r from-blue-900 via-blue-850 to-blue-800 text-white flex items-center justify-between cursor-pointer hover:bg-blue-850 transition-colors">',
            '                                <div class="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pr-2">',
            '                                    <span id="pauta-step-chevron-heading" class="w-5 h-5 flex items-center justify-center text-blue-300 transition-transform duration-200 text-xs shrink-0" style="transform: ' + (st.heading ? 'rotate(90deg)' : 'rotate(0deg)') + ';">▶</span>',
            '                                    <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 min-w-0">',
            '                                        <span class="px-2 py-0.5 rounded-lg bg-blue-700 text-blue-100 font-black text-[10px] uppercase tracking-wider shrink-0 border border-blue-600 shadow-2xs">Posição (4 dígitos)</span>',
            '                                        <h4 class="text-xs sm:text-sm font-black truncate text-white tracking-tight"><strong class="text-blue-200">' + h.heading.label + ':</strong> ' + h.heading.name + '</h4>',
            '                                    </div>',
            '                                </div>',
            '                                <span class="text-[10px] font-bold text-blue-200 bg-blue-800/80 px-2 py-0.5 rounded-lg border border-blue-700 shrink-0 whitespace-nowrap">' + data.totalInHeading + ' artigos • ' + subpositions.length + ' subposições</span>',
            '                            </div>',
            '',
            '                            <!-- CORPO DO DEGRAU 3: CONTÉM O DEGRAU 4 (SUBPOSIÇÃO) INDENTADO COM LINHA GUIA -->',
            '                            <div id="pauta-step-body-heading" class="' + (st.heading ? '' : 'hidden') + ' p-3 sm:p-4 pt-2 sm:pt-3 bg-blue-50/20 space-y-3">',
            '                                <div class="border-l-2 border-purple-300 ml-2 sm:ml-4 pl-3 sm:pl-5 space-y-3">',
            '',
            '                                    <!-- DEGRAU 4: SUBPOSIÇÃO ATIVA (6 DÍGITOS) -->',
            '                                    <div class="staircase-step bg-white rounded-2xl border-2 border-purple-300 shadow-xs overflow-hidden transition-all">',
            '                                        <div onclick="window.togglePautaStaircaseStep(\'activeSubposition\')" class="p-3 sm:p-3.5 bg-gradient-to-r from-purple-900 via-purple-850 to-purple-800 text-white flex items-center justify-between cursor-pointer hover:bg-purple-850 transition-colors">',
            '                                            <div class="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pr-2">',
            '                                                <span id="pauta-step-chevron-activeSubposition" class="w-5 h-5 flex items-center justify-center text-purple-300 transition-transform duration-200 text-xs shrink-0" style="transform: ' + (st.activeSubposition ? 'rotate(90deg)' : 'rotate(0deg)') + ';">▶</span>',
            '                                                <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 min-w-0">',
            '                                                    <span class="px-2 py-0.5 rounded-lg bg-purple-700 text-purple-100 font-black text-[10px] uppercase tracking-wider shrink-0 border border-purple-600 shadow-2xs">Subposição (6 dígitos)</span>',
            '                                                    <h4 class="text-xs sm:text-sm font-black truncate text-white tracking-tight"><strong class="text-purple-200">' + activeSub.label + '</strong></h4>',
            '                                                </div>',
            '                                            </div>',
            '                                            <span class="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0 whitespace-nowrap">★ Subposição Atual (' + activeSub.items.length + ' artigos)</span>',
            '                                        </div>',
            '',
            '                                        <!-- CORPO DO DEGRAU 4: CONTÉM O DEGRAU 5 (CÓDIGO / LINHA PAUTAL DE 8 DÍGITOS) -->',
            '                                        <div id="pauta-step-body-activeSubposition" class="' + (st.activeSubposition ? '' : 'hidden') + ' p-3 sm:p-4 pt-2 sm:pt-3 bg-purple-50/20 space-y-3">',
            '                                            <div class="border-l-2 border-emerald-400 ml-2 sm:ml-4 pl-3 sm:pl-5 space-y-3">',
            '',
            '                                                <!-- DEGRAU 5: CÓDIGO / LINHA PAUTAL (8 DÍGITOS) - ARTIGO SELECIONADO -->',
            '                                                <div class="staircase-step bg-white rounded-2xl border-2 border-emerald-500 shadow-md overflow-hidden">',
            '                                                    <div class="p-3 sm:p-4 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">',
            '                                                        <div class="flex items-center gap-2.5 sm:gap-3 flex-wrap">',
            '                                                            <span class="px-2 py-0.5 rounded-lg bg-emerald-900/90 text-emerald-100 font-black text-[10px] uppercase tracking-wider border border-emerald-500/60 shadow-2xs">Código / Linha Pautal (8 dígitos)</span>',
            '                                                            <span class="font-mono font-black text-lg sm:text-xl text-emerald-950 bg-white px-3 py-0.5 rounded-xl border border-emerald-200 shadow-xs tracking-tight">' + data.formattedCode + '</span>',
            '                                                            <button type="button" onclick="window.copyInspectedHsCode()" class="text-[11px] font-bold text-emerald-100 hover:text-white bg-emerald-800/80 hover:bg-emerald-800 border border-emerald-500/80 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 shadow-2xs" title="Copiar Código">',
            '                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
            '                                                                <span id="btn-copy-code-text">Copiar</span>',
            '                                                            </button>',
            '                                                        </div>',
            '                                                        <div class="flex items-center gap-2 shrink-0">',
            '                                                            <button type="button" onclick="window.applyInspectedPautaToQuote()" class="btn-action-scale px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-black uppercase rounded-xl shadow-md flex items-center gap-2 transition-all">',
            '                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            '                                                                <span>' + (targetRowIndex >= 0 ? 'Aplicar à Linha #' + (targetRowIndex + 1) : 'Aplicar à Cotação') + '</span>',
            '                                                            </button>',
            '                                                        </div>',
            '                                                    </div>',
            '',
            '                                                    <!-- Descrição e Taxas Oficiais -->',
            '                                                    <div class="p-4 sm:p-5 bg-gradient-to-b from-emerald-50/30 to-white space-y-3">',
            '                                                        <div>',
            '                                                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrição Oficial da Mercadoria:</span>',
            '                                                            <h3 class="text-sm sm:text-base font-black text-slate-900 leading-snug mt-0.5">' + (item.description || 'Sem descrição oficial cadastrada.') + '</h3>',
            '                                                        </div>',
            '',
            '                                                        <!-- Grid de Taxas Aduaneiras Oficiais -->',
            '                                                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">',
            '                                                            <div class="p-3 rounded-2xl bg-blue-50/90 border border-blue-200/90 flex flex-col justify-between shadow-2xs">',
            '                                                                <span class="text-[10px] font-bold uppercase tracking-wider text-blue-600">Direitos Aduaneiros (D.A.)</span>',
            '                                                                <span class="text-lg font-black text-blue-950 mt-1">' + (daRate * 100).toFixed(2) + '%</span>',
            '                                                            </div>',
            '                                                            <div class="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 flex flex-col justify-between shadow-2xs">',
            '                                                                <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">IVA</span>',
            '                                                                <span class="text-lg font-black text-emerald-950 mt-1">' + (ivaRate * 100).toFixed(2) + '%</span>',
            '                                                            </div>',
            '                                                            <div class="p-3 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex flex-col justify-between shadow-2xs">',
            '                                                                <span class="text-[10px] font-bold uppercase tracking-wider text-amber-600">ICE (Consumo Específico)</span>',
            '                                                                <span class="text-xs sm:text-sm font-black text-amber-950 mt-1 truncate" title="' + iceFormatted.replace(/"/g, '&quot;') + '">' + iceFormatted + '</span>',
            '                                                            </div>',
            '                                                            <div class="p-3 rounded-2xl bg-purple-50/90 border border-purple-200/90 flex flex-col justify-between shadow-2xs">',
            '                                                                <span class="text-[10px] font-bold uppercase tracking-wider text-purple-600">Sobretaxa Aduaneira</span>',
            '                                                                <span class="text-lg font-black text-purple-950 mt-1">' + (tsaRate * 100).toFixed(2) + '%</span>',
            '                                                            </div>',
            '                                                            ' + (extraDuties.length > 0 ? [
                                                                            '<div class="col-span-2 sm:col-span-4 p-2.5 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs text-slate-700">',
                                                                            '    <span class="font-bold text-[11px] text-slate-500 uppercase">Outras Taxas / Regras Oficiais:</span>',
                                                                            '    <span class="font-bold text-[11px] text-slate-800">' + extraDuties.map(e => (e['Nome da Taxa'] || 'Taxa') + ': <strong>' + (e['Taxa'] || e['Value'] || '') + '</strong>').join(' • ') + '</span>',
                                                                            '</div>'
                                                                        ].join('') : ''),
            '                                                        </div>',
            '                                                    </div>',
            '                                                </div>',
            '',
            '                                                <!-- Outros Artigos Desta Mesma Subposição (' + activeSub.code + ') -->',
            '                                                <div class="bg-white rounded-2xl border border-purple-200 overflow-hidden shadow-2xs">',
            '                                                    <div class="p-2.5 px-3 bg-purple-50/80 border-b border-purple-100 flex items-center justify-between">',
            '                                                        <span class="text-[11px] font-black uppercase text-purple-900 tracking-tight">Artigos da ' + activeSub.label + ' (' + activeSub.items.length + ' artigos)</span>',
            '                                                        <span class="text-[10px] font-bold text-purple-600">Selecione para inspecionar ou usar</span>',
            '                                                    </div>',
            '                                                    <div class="divide-y divide-slate-100 text-xs">',
            activeSub.items.map(subItem => {
                const isSelected = subItem.code === data.code;
                const itDa = getRateFromPauta(subItem, ['Direitos', 'Aduaneiros']);
                const itIva = getRateFromPauta(subItem, ['IVA', 'Valor Acrescentado']);
                return [
                    '                                                        <div class="p-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ' + (isSelected ? 'bg-emerald-50/80 font-bold border-l-4 border-emerald-500' : 'hover:bg-slate-50') + ' transition-colors">',
                    '                                                            <div class="flex items-start sm:items-center gap-2 flex-1 min-w-0">',
                    '                                                                <span class="font-mono font-bold text-xs ' + (isSelected ? 'text-emerald-900 font-black' : 'text-slate-800') + '">' + subItem.formattedCode + '</span>',
                    isSelected ? '<span class="text-[9px] font-black bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded-full uppercase">Atual</span>' : '',
                    '                                                                <span class="text-xs ' + (isSelected ? 'text-emerald-950 font-black' : 'text-slate-700') + ' truncate" title="' + subItem.description.replace(/"/g, '&quot;') + '">' + subItem.description + '</span>',
                    '                                                            </div>',
                    '                                                            <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">',
                    '                                                                <span class="text-[10px] text-slate-400 font-bold">D.A.: ' + (itDa * 100).toFixed(0) + '% | IVA: ' + (itIva * 100).toFixed(0) + '%</span>',
                    isSelected ? '<span class="text-[10px] font-black text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-lg border border-emerald-200">Selecionado</span>' : (
                        '<button type="button" onclick="window.inspectPautaCode(\'' + subItem.code + '\')" class="px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shadow-2xs">Ver</button>' +
                        '<button type="button" onclick="window.applySiblingPauta(\'' + subItem.code + '\')" class="px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 rounded-lg transition-colors shadow-2xs">Usar</button>'
                    ),
                    '                                                            </div>',
                    '                                                        </div>'
                ].join('');
            }).join(''),
            '                                                    </div>',
            '                                                </div>',
            '                                            </div>',
            '                                        </div>',
            '                                    </div>',
            '',
            '                                    <!-- OUTRAS SUBPOSIÇÕES DA POSIÇÃO ' + h.heading.formatted + ' -->',
            otherSubs.length > 0 ? [
                '                                    <div class="staircase-step bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">',
                '                                        <div onclick="window.togglePautaOtherSubpositions()" class="p-2.5 sm:p-3 bg-slate-100 hover:bg-slate-200/80 cursor-pointer flex items-center justify-between transition-colors">',
                '                                            <div class="flex items-center gap-2 text-xs font-bold text-slate-700">',
                '                                                <span id="pauta-other-subpositions-chevron" class="w-4 h-4 flex items-center justify-center text-slate-500 text-xs transition-transform duration-200" style="transform: ' + (window.pautaInspectorState.expandedOtherSubpositions ? 'rotate(90deg)' : 'rotate(0deg)') + ';">▶</span>',
                '                                                <span>Outras Subposições da ' + h.heading.label + ' (' + otherSubs.length + ' restantes)</span>',
                '                                            </div>',
                '                                            <span class="text-[10px] font-bold text-slate-500">Clique para explorar outras subposições</span>',
                '                                        </div>',
                '                                        <div id="pauta-other-subpositions-body" class="' + (window.pautaInspectorState.expandedOtherSubpositions ? '' : 'hidden') + ' divide-y divide-slate-100 p-2 sm:p-3 space-y-2 bg-slate-50/40">',
                otherSubs.map(os => {
                    const isSubExp = !!window.pautaInspectorState.expandedSubpositionsMap[os.code];
                    return [
                        '                                            <div class="bg-white rounded-xl border border-slate-200/80 overflow-hidden">',
                        '                                                <div onclick="window.togglePautaSiblingSubposition(\'' + os.code + '\')" class="p-2 px-3 hover:bg-purple-50/50 cursor-pointer flex items-center justify-between text-xs transition-colors">',
                        '                                                    <div class="flex items-center gap-2">',
                        '                                                        <span id="pauta-sub-chevron-' + os.code + '" class="w-3.5 h-3.5 flex items-center justify-center text-slate-400 text-[10px] transition-transform duration-200" style="transform: ' + (isSubExp ? 'rotate(90deg)' : 'rotate(0deg)') + ';">▶</span>',
                        '                                                        <span class="font-mono font-bold text-purple-900">' + os.label + '</span>',
                        '                                                    </div>',
                        '                                                    <span class="text-[10px] font-bold text-slate-400">' + os.items.length + ' artigos</span>',
                        '                                                </div>',
                        '                                                <div id="pauta-sub-body-' + os.code + '" class="' + (isSubExp ? '' : 'hidden') + ' divide-y divide-slate-100 p-2 pl-6 bg-slate-50/60 text-xs">',
                        os.items.map(oItem => [
                            '                                                    <div class="p-1.5 flex items-center justify-between gap-2 hover:bg-white rounded transition-colors">',
                            '                                                        <div class="flex items-center gap-2 truncate">',
                            '                                                            <span class="font-mono font-bold text-slate-800">' + oItem.formattedCode + '</span>',
                            '                                                            <span class="text-slate-600 truncate">' + oItem.description + '</span>',
                            '                                                        </div>',
                            '                                                        <div class="flex items-center gap-1 shrink-0">',
                            '                                                            <button type="button" onclick="window.inspectPautaCode(\'' + oItem.code + '\')" class="px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded">Ver</button>',
                            '                                                            <button type="button" onclick="window.applySiblingPauta(\'' + oItem.code + '\')" class="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200 rounded">Usar</button>',
                            '                                                        </div>',
                            '                                                    </div>'
                        ].join('')).join(''),
                        '                                                </div>',
                        '                                            </div>'
                    ].join('');
                }).join(''),
                '                                        </div>',
                '                                    </div>'
            ].join('') : '',
            '',
            '                                </div>',
            '                            </div>',
            '                        </div>',
            '                    </div>',
            '                </div>',
            '            </div>',
            '        </div>',
            '    </div>',
            '</div>'
        ].join('');
    }

    // --- VISTA 2: TABELA GERAL DA POSIÇÃO (ALTERNATIVA) ---
    const headingTitleEl = document.getElementById('pauta-inspector-heading-title');
    if (headingTitleEl) headingTitleEl.innerText = h.heading.label + ': ' + h.heading.name;

    const headingCountEl = document.getElementById('pauta-inspector-heading-count');
    if (headingCountEl) headingCountEl.innerText = data.totalInHeading + ' artigos na Pauta';

    const siblingsTbody = document.getElementById('pauta-inspector-siblings-tbody');
    if (siblingsTbody) {
        if (!data.siblings || data.siblings.length === 0) {
            siblingsTbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400 font-bold">Nenhum artigo encontrado nesta posição.</td></tr>';
        } else {
            siblingsTbody.innerHTML = data.siblings.map(s => {
                const isSelected = (s.code === data.code);
                const da = getRateFromPauta(s, ['Direitos', 'Aduaneiros']);
                const iva = getRateFromPauta(s, ['IVA', 'Valor Acrescentado']);
                const iceC = getComplexRateFromPauta(s, ['consumo', 'ice']);
                let iceLabel = '0%';
                if (iceC) {
                    if (iceC.raw) iceLabel = iceC.raw;
                    else if (iceC.adValorem > 0) iceLabel = (iceC.adValorem * 100).toFixed(0) + '%';
                    else if (iceC.specificAmount > 0) iceLabel = iceC.specificAmount + ' MZN';
                }

                const actionHtml = isSelected
                    ? '<span class="text-[10px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded-lg border border-emerald-200">Selecionado</span>'
                    : ('<div class="flex items-center justify-center gap-1">' +
                       '<button type="button" class="btn-inspect-sib px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shadow-2xs" data-code="' + s.code + '" title="Ver estrutura e taxas">Ver</button>' +
                       '<button type="button" class="btn-use-sib px-2 py-1 text-[10px] font-bold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 rounded-lg transition-colors shadow-2xs" data-code="' + s.code + '" title="Aplicar este código à cotação">Usar</button>' +
                       '</div>');

                return [
                    '<tr id="pauta-sibling-row-' + s.code + '" class="' + (isSelected ? 'bg-emerald-50/90 border-l-4 border-emerald-500 font-medium' : 'hover:bg-slate-50') + ' transition-colors h-9">',
                    '<td class="py-2 px-3 text-center text-[10px] text-slate-400 ' + (isSelected ? 'font-black text-emerald-700' : '') + '">' + s.index + '</td>',
                    '<td class="py-2 px-3 whitespace-nowrap">',
                    '<div class="flex items-center gap-1.5">',
                    '<span class="font-mono font-bold text-xs ' + (isSelected ? 'text-emerald-800 font-black' : 'text-slate-800') + '">' + s.formattedCode + '</span>',
                    isSelected ? '<span class="text-[9px] font-black bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded-full uppercase">Atual</span>' : '',
                    '</div>',
                    '</td>',
                    '<td class="py-2 px-3 text-xs ' + (isSelected ? 'text-emerald-950 font-bold' : 'text-slate-700') + '">' + s.description + '</td>',
                    '<td class="py-2 px-3 text-center text-xs font-bold ' + (da > 0 ? 'text-blue-700' : 'text-slate-400') + '">' + (da * 100).toFixed(0) + '%</td>',
                    '<td class="py-2 px-3 text-center text-xs font-bold ' + (iva > 0 ? 'text-emerald-700' : 'text-slate-400') + '">' + (iva * 100).toFixed(0) + '%</td>',
                    '<td class="py-2 px-3 text-center text-[11px] font-bold ' + (iceLabel !== '0%' ? 'text-amber-700' : 'text-slate-400') + ' truncate max-w-[120px]" title="' + iceLabel.replace(/"/g, '&quot;') + '">' + iceLabel + '</td>',
                    '<td class="py-2 px-3 text-center whitespace-nowrap">' + actionHtml + '</td>',
                    '</tr>'
                ].join('');
            }).join('');

            siblingsTbody.querySelectorAll('.btn-inspect-sib').forEach(btn => {
                btn.addEventListener('click', () => window.inspectPautaCode(btn.getAttribute('data-code')));
            });
            siblingsTbody.querySelectorAll('.btn-use-sib').forEach(btn => {
                btn.addEventListener('click', () => window.applySiblingPauta(btn.getAttribute('data-code')));
            });
        }
    }

    setTimeout(() => {
        if (window.pautaInspectorState.viewMode === 'staircase') {
            const activeStep = document.getElementById('pauta-step-body-activeSubposition');
            if (activeStep) {
                activeStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, 150);
};

window.applySiblingPauta = async function(siblingCode) {
    if (!siblingCode) return;
    try {
        const data = await api.getPautaHierarchy(siblingCode);
        window.pautaInspectorState.activeCode = siblingCode;
        window.pautaInspectorState.data = data;
        window.applyInspectedPautaToQuote();
    } catch (e) {
        console.error('[PAUTA] Erro ao aplicar irmão:', e);
        toast('Erro ao selecionar artigo da pauta.', 'error');
    }
};

window.applyInspectedPautaToQuote = function() {
    const data = window.pautaInspectorState.data;
    if (!data || !data.item) {
        toast('Nenhum artigo selecionado para aplicar.', 'warning');
        return;
    }

    let targetRowId = window.pautaInspectorState.targetRowId;
    let item = null;

    if (targetRowId) {
        item = window.quoteEditorState.items.find(i => i.id === targetRowId);
    }

    if (!item && window.quoteEditorState.items.length > 0) {
        item = window.quoteEditorState.items.find(i => !i.hsCode || i.hsCode.length < 8) || window.quoteEditorState.items[0];
    }

    if (!item) {
        window.addQuoteRow();
        item = window.quoteEditorState.items[window.quoteEditorState.items.length - 1];
    }

    if (item) {
        item.hsCode = data.code;
        item.pauta = data.item;
        if (!item.description || item.description === 'Múltiplos Artigos' || item.description.trim() === '') {
            item.description = data.item.description || '';
        }
        window.updateRowDOM(item);
        window.calculateFullInvoice();
        toast('Artigo ' + data.formattedCode + ' aplicado com sucesso!', 'success');
        window.closePautaInspector();
    }
};

window.copyInspectedHsCode = function() {
    const data = window.pautaInspectorState.data;
    const code = (data && data.code) || window.pautaInspectorState.activeCode;
    if (!code) return;

    navigator.clipboard.writeText(code).then(() => {
        const btnText = document.getElementById('btn-copy-code-text');
        if (btnText) {
            btnText.innerText = 'Copiado!';
            setTimeout(() => { btnText.innerText = 'Copiar'; }, 2000);
        }
        toast('Código ' + code + ' copiado!', 'success');
    }).catch(() => {
        toast('Código: ' + code);
    });
};

window.closePautaInspector = function() {
    closeModal('modal-pauta-inspector');
    window.pautaInspectorState.targetRowId = null;
    const resultsContainer = document.getElementById('pauta-inspector-search-results');
    if (resultsContainer) resultsContainer.classList.add('hidden');
};

window.handlePautaInspectorSearch = function(query) {
    const clearBtn = document.getElementById('btn-pauta-clear-search');
    if (clearBtn) {
        if (query && query.trim()) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }

    if (window.pautaInspectorState.searchTimeout) {
        clearTimeout(window.pautaInspectorState.searchTimeout);
    }

    const trimmed = (query || '').trim();
    const resultsContainer = document.getElementById('pauta-inspector-search-results');
    if (!resultsContainer) return;

    if (!trimmed || trimmed.length < 2) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        return;
    }

    window.pautaInspectorState.searchTimeout = setTimeout(async () => {
        try {
            const results = await api.searchPauta(trimmed, 10);
            if (!results || results.length === 0) {
                resultsContainer.innerHTML = '<div class="p-4 text-center text-xs text-slate-400 font-bold">Nenhum artigo encontrado para "' + trimmed.replace(/"/g, '&quot;') + '".</div>';
                resultsContainer.classList.remove('hidden');
                return;
            }

            resultsContainer.innerHTML = results.map(r => [
                '<div class="search-item p-2.5 px-3 hover:bg-emerald-50 cursor-pointer transition-colors flex items-center justify-between gap-3" data-code="' + r.code + '">',
                '<div class="flex-1 min-w-0">',
                '<div class="flex items-center gap-2">',
                '<span class="font-mono font-bold text-xs text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded">' + r.code + '</span>',
                '<span class="text-xs font-semibold text-slate-800 truncate">' + r.description + '</span>',
                '</div>',
                '</div>',
                '<span class="text-[10px] font-bold text-slate-400 shrink-0">Ver ↗</span>',
                '</div>'
            ].join('')).join('');

            resultsContainer.querySelectorAll('.search-item').forEach(itemEl => {
                itemEl.addEventListener('click', () => {
                    const code = itemEl.getAttribute('data-code');
                    window.clearPautaInspectorSearch();
                    window.inspectPautaCode(code);
                });
            });

            resultsContainer.classList.remove('hidden');
        } catch (e) {
            console.error('[PAUTA SEARCH] Erro:', e);
        }
    }, 200);
};

window.clearPautaInspectorSearch = function() {
    const input = document.getElementById('pauta-inspector-search');
    if (input) input.value = '';
    const clearBtn = document.getElementById('btn-pauta-clear-search');
    if (clearBtn) clearBtn.classList.add('hidden');
    const resultsContainer = document.getElementById('pauta-inspector-search-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
    }
};

window.selectPautaSearchResult = function(code) {
    window.clearPautaInspectorSearch();
    window.inspectPautaCode(code);
};




/**
 * Permite a qualquer operador definir ou alterar rapidamente a data de descarga do projeto ativo
 */
export async function promptSetProjectDischargeDate() {
    const current = state.confirm?.dischargeDate || '';
    const newDateStr = prompt(
        'Introduza a Data de Descarga para este projeto (formato DD/MM/AAAA ou AAAA-MM-DD):\n(Deixar em branco para remover)',
        current
    );
    if (newDateStr === null) return; // cancelado pelo utilizador
    
    const cleanDate = newDateStr.trim();
    let formattedDate = cleanDate;
    if (cleanDate) {
        const parsed = parseDate(cleanDate);
        if (!parsed) {
            toast('Data inválida. Por favor use DD/MM/AAAA ou AAAA-MM-DD.', 'error');
            return;
        }
        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        formattedDate = `${yyyy}-${mm}-${dd}`;
    }

    try {
        setLoader(true, 'A gravar data de descarga...');
        state.confirm.dischargeDate = formattedDate;

        // Gravar no PocketBase se existir projectId
        if (state.confirm.projectId) {
            try {
                await pb.collection('confirm_projects').update(state.confirm.projectId, {
                    dischargeDate: formattedDate
                });
            } catch (pbErr) {
                console.warn('[PROJECT] Erro ao gravar dischargeDate no PocketBase:', pbErr);
            }
        }

        // Gravar na nota da planilha para redundância
        if (state.confirm.sheetId) {
            const noteText = formattedDate ? `DISCHARGE_DATE:${formattedDate}` : '';
            try {
                await updateGSheetNote(state.confirm.sheetId, '', 0, 0, noteText);
            } catch (shErr) {
                console.warn('[PROJECT] Erro ao gravar nota DISCHARGE_DATE na planilha:', shErr);
            }
        }

        toast('Data de descarga atualizada com sucesso!', 'success');

        // Atualizar lista de clientes ou tela de detalhes
        if (window.currentActiveClient) {
            await showConfirmDetail(window.currentActiveClient, window.currentActiveClientIndex);
        } else if (state.confirm.data) {
            const statusFilter = document.getElementById('confirm-status-filter')?.value || 'PENDENTE';
            renderConfirmList(state.confirm.data, '', statusFilter);
        }
    } catch (err) {
        toast('Erro ao atualizar data de descarga: ' + err.message, 'error');
    } finally {
        setLoader(false);
    }
}
window.promptSetProjectDischargeDate = promptSetProjectDischargeDate;

// Fechar dropdowns de ações em massa ao clicar fora
if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#dropdown-bulk-bank-wrapper') && !e.target.closest('#dropdown-bulk-status-wrapper')) {
            if (typeof closeAllBulkDropdowns === 'function') {
                closeAllBulkDropdowns();
            }
        }
        if (!e.target.closest('#dropdown-mini-filter-bank-wrapper') &&
            !e.target.closest('#dropdown-mini-filter-owner-wrapper') &&
            !e.target.closest('#dropdown-mini-filter-amount-mode-wrapper') &&
            !e.target.closest('#dropdown-mini-filter-channel-wrapper') &&
            !e.target.closest('#dropdown-mini-filter-status-wrapper')) {
            if (typeof closeAllMiniFilterDropdowns === 'function') {
                closeAllMiniFilterDropdowns();
            }
        }
    });
}
