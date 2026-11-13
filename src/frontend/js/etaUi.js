/**
 * Módulo de Interface (UI) para o módulo ETA (Cargas em Trânsito)
 */
import { state, pb, etaPb, listEtaRecords, createEtaRecord, updateEtaRecord, deleteEtaRecord, checkEtaHealth, subscribeEtaEvents, unsubscribeEtaEvents } from './api.js';
import {
    ETA_AGENT_OPTIONS,
    ETA_STATUS_OPTIONS,
    parseEtaStatus,
    getEtaStatusStyle,
    mergeEtaAgents,
    mergeEtaStatuses,
    getEtaIconUrl,
    extractEtaYMD,
    formatEtaDateDisplay,
    getEtaCountdownMeta,
    buildNewEtaPayload,
    buildUpdateEtaPayload,
    filterEtaRecords,
    computeEtaStats,
    sortEtaRecords
} from './etaHelpers.js?v=20261113_01';

let activeDetailRecordId = null;
let etaLayoutObserver = null;

function syncEtaStickyHeaderOffset() {
    const viewEl = document.getElementById('view-eta-dashboard');
    const appRoot = document.getElementById('app-root');
    if (!viewEl || !appRoot) return;

    const applyHeight = () => {
        if (viewEl.classList.contains('hidden') || window.innerWidth < 768) {
            viewEl.style.height = '';
            return;
        }
        const cs = getComputedStyle(appRoot);
        const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        const available = Math.max(360, appRoot.clientHeight - padY);
        viewEl.style.height = `${available}px`;
    };

    applyHeight();

    if (!etaLayoutObserver && typeof ResizeObserver !== 'undefined') {
        etaLayoutObserver = new ResizeObserver(applyHeight);
        etaLayoutObserver.observe(appRoot);
    }
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getCurrentUsername() {
    const model = pb?.authStore?.model;
    return model?.name || model?.email || '';
}

function renderStatusBadgeHtml(statusText, { fixedWidth = false } = {}) {
    const style = getEtaStatusStyle(statusText);
    const shapeCls = fixedWidth
        ? 'w-[180px] h-8 rounded-md justify-center text-center whitespace-nowrap'
        : 'rounded-full py-0.5 justify-center';
    return `
        <span class="inline-flex items-center ${shapeCls} px-2.5 text-[11px] font-black uppercase tracking-wide border ${style.badge}">
            ${escapeHtml(statusText || 'Aguarda Chegada')}
        </span>
    `;
}

const SHIP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a1 1 0 0 1 1 1v2h3a1 1 0 0 1 1 1v3.38l2.32.77a1 1 0 0 1 .64 1.24l-1.5 4.86a3.5 3.5 0 0 1-1.96-.44A3.5 3.5 0 0 1 14 16.5a3.5 3.5 0 0 1-2-.63 3.5 3.5 0 0 1-2 .63 3.5 3.5 0 0 1-2.5-.69 3.5 3.5 0 0 1-1.96.44l-1.5-4.86a1 1 0 0 1 .64-1.24L7 9.38V6a1 1 0 0 1 1-1h3V3a1 1 0 0 1 1-1Zm3 5H9v1.72l3-1 3 1V7Zm4.5 11.75c-.97 0-1.85-.39-2.5-1.02a3.49 3.49 0 0 1-5 0 3.49 3.49 0 0 1-5 0A3.48 3.48 0 0 1 4.5 18.75a1 1 0 1 0 0 2c1.02 0 1.97-.35 2.75-.93.78.58 1.73.93 2.75.93s1.97-.35 2.75-.93c.78.58 1.73.93 2.75.93s1.97-.35 2.75-.93c.78.58 1.73.93 2.75.93a1 1 0 1 0 0-2Z"/></svg>`;

function renderEtaIconHtml(item) {
    const iconUrl = getEtaIconUrl(item);
    if (iconUrl) {
        return `<img src="${escapeHtml(iconUrl)}" alt="${escapeHtml(item.referencia || 'Navio')}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" class="w-8 h-8 rounded-md object-cover border border-gray-200 bg-white shrink-0" /><span style="display:none" class="w-8 h-8 p-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 items-center justify-center shrink-0">${SHIP_ICON_SVG}</span>`;
    }
    return `<span class="w-8 h-8 p-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">${SHIP_ICON_SVG}</span>`;
}

function populateSelectOptions(selectEl, options, { emptyLabel = '', selectedValue = '' } = {}) {
    if (!selectEl) return;
    const prefix = emptyLabel ? `<option value="">${escapeHtml(emptyLabel)}</option>` : '';
    selectEl.innerHTML = prefix + options.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('');
    if (selectedValue && options.includes(selectedValue)) {
        selectEl.value = selectedValue;
    } else if (!emptyLabel && options.length > 0 && !selectEl.value) {
        selectEl.value = options[0];
    }
}

export function populateEtaSelectOptions(records = state.eta.records || []) {
    const agents = mergeEtaAgents(records);
    const statuses = mergeEtaStatuses(records);

    populateSelectOptions(document.getElementById('eta-agente-filter'), agents, {
        emptyLabel: `Todos os Agentes (${agents.length})`,
        selectedValue: state.eta.filters.agente || ''
    });

    populateSelectOptions(document.getElementById('eta-status-filter'), statuses, {
        emptyLabel: 'Todos os Estágios',
        selectedValue: state.eta.filters.status || ''
    });

    populateSelectOptions(document.getElementById('eta-form-agente'), agents, {
        emptyLabel: 'Selecionar Agente...'
    });

    populateSelectOptions(document.getElementById('eta-form-status'), statuses);
    populateSelectOptions(document.getElementById('eta-detail-status-select'), statuses);
}

export function renderEtaDashboard() {
    syncEtaStickyHeaderOffset();
    const records = state.eta.records || [];
    const filters = state.eta.filters || {};
    const stats = computeEtaStats(records);
    const filtered = filterEtaRecords(records, {
        ...filters,
        includeFinished: state.eta.includeFinished
    });

    populateEtaSelectOptions(records);

    const kpiActive = document.getElementById('eta-kpi-active');
    const kpiDue = document.getElementById('eta-kpi-due');
    const kpiAwaiting = document.getElementById('eta-kpi-awaiting');
    const kpiClearance = document.getElementById('eta-kpi-clearance');
    if (kpiActive) kpiActive.textContent = stats.activeTotal;
    if (kpiDue) kpiDue.textContent = stats.dueOrOverdue;
    if (kpiAwaiting) kpiAwaiting.textContent = stats.awaitingArrival;
    if (kpiClearance) kpiClearance.textContent = stats.inClearanceOrReady;

    const countBadge = document.getElementById('eta-count-badge');
    if (countBadge) {
        countBadge.textContent = `${filtered.length} Registo${filtered.length === 1 ? '' : 's'}`;
    }

    const clearBtn = document.getElementById('eta-clear-filters-btn');
    const filterActiveDot = document.getElementById('eta-filter-active-dot');
    const hasFilter = Boolean(filters.search || filters.status || filters.statusGroup || filters.agente || filters.arrivalBucket);
    if (clearBtn) clearBtn.classList.toggle('hidden', !hasFilter);
    if (filterActiveDot) filterActiveDot.classList.toggle('hidden', !(hasFilter || state.eta.includeFinished));

    const errorBox = document.getElementById('eta-error-box');
    const errorMsg = document.getElementById('eta-error-message');
    if (errorBox) {
        if (state.eta.error) {
            errorBox.classList.remove('hidden');
            if (errorMsg) errorMsg.textContent = state.eta.error;
        } else {
            errorBox.classList.add('hidden');
        }
    }

    const liveBadge = document.getElementById('eta-live-badge');
    if (liveBadge) {
        if (state.eta.realtimeConnected) {
            liveBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200';
            liveBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Tempo Real';
        } else {
            liveBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200';
            liveBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>A sincronizar...';
        }
    }

    const footerSummary = document.getElementById('eta-footer-summary');
    const footerLatency = document.getElementById('eta-footer-latency');
    if (footerSummary) {
        footerSummary.textContent = `A exibir ${filtered.length} de ${records.length} cargas carregadas`;
    }
    if (footerLatency) {
        const liveIndicator = state.eta.realtimeConnected
            ? '<span class="inline-flex items-center gap-1 text-emerald-600 font-bold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Tempo Real Ativo</span>'
            : '<span class="inline-flex items-center gap-1 text-gray-500 font-bold"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Sincronizado</span>';
        footerLatency.innerHTML = `${liveIndicator} • ${state.eta.latencyMs !== null ? `${state.eta.latencyMs}ms` : 'PocketBase'}`;
    }

    const tbody = document.getElementById('eta-table-body');
    const mobileList = document.getElementById('eta-mobile-list');
    if (!tbody || !mobileList) return;

    if (filtered.length === 0) {
        const emptyMsg = state.eta.error
            ? 'Sem dados disponíveis devido a erro de ligação.'
            : 'Nenhuma carga encontrada com os filtros atuais.';
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-gray-400 font-semibold bg-white rounded-xl border border-gray-200">${escapeHtml(emptyMsg)}</td></tr>`;
        mobileList.innerHTML = `<div class="p-8 text-center text-xs text-gray-400 font-semibold bg-white rounded-xl border border-gray-200">${escapeHtml(emptyMsg)}</div>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const parsedStatus = parseEtaStatus(item.status);
        const countdown = getEtaCountdownMeta(item.etachegada, parsedStatus.actualStatus);
        const formattedDate = formatEtaDateDisplay(item.etachegada);
        const safeId = escapeHtml(item.id);
        const cellHover = 'bg-white border-y border-gray-200/90 group-hover:bg-teal-50/40 group-hover:border-teal-300 transition-colors align-middle';

        return `
            <tr onclick="editEtaRecord('${safeId}')" data-eta-id="${safeId}" class="group shadow-2xs cursor-pointer">
                <td class="pl-1 pr-2 py-1 ${cellHover} border-l rounded-l-lg text-left">
                    <div class="flex items-center justify-start gap-2.5">
                        ${renderEtaIconHtml(item)}
                        <span class="eta-ref-bold font-bold text-gray-800 text-sm">${escapeHtml(item.referencia || '—')}</span>
                    </div>
                </td>
                <td class="px-2 py-1 ${cellHover} text-center font-mono font-normal text-gray-500 text-sm">${escapeHtml(item.conhecimento || '—')}</td>
                <td class="px-2 py-1 ${cellHover} text-center font-normal text-gray-500 text-sm">${escapeHtml(item.agente || '—')}</td>
                <td class="px-2 py-1 ${cellHover} text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <span class="font-normal text-gray-500 text-sm">${escapeHtml(formattedDate)}</span>
                        <span class="px-1.5 py-0.5 rounded-md text-[11px] font-bold border ${countdown.cls}">${escapeHtml(countdown.label)}</span>
                    </div>
                </td>
                <td class="pl-2 pr-1 py-1 ${cellHover} border-r rounded-r-lg text-right">${renderStatusBadgeHtml(parsedStatus.actualStatus, { fixedWidth: true })}</td>
            </tr>
        `;
    }).join('');

    mobileList.innerHTML = filtered.map(item => {
        const parsedStatus = parseEtaStatus(item.status);
        const countdown = getEtaCountdownMeta(item.etachegada, parsedStatus.actualStatus);
        const formattedDate = formatEtaDateDisplay(item.etachegada);
        const safeId = escapeHtml(item.id);

        return `
            <div onclick="editEtaRecord('${safeId}')" data-eta-id="${safeId}" class="p-3 space-y-2.5 bg-white border border-gray-200/90 rounded-xl shadow-2xs hover:border-teal-300 transition-colors cursor-pointer">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-2.5 min-w-0">
                        ${renderEtaIconHtml(item)}
                        <div class="min-w-0">
                            <div class="text-sm font-black text-gray-900 truncate">Ref. ${escapeHtml(item.referencia || '—')}</div>
                            <div class="text-[11px] font-mono font-bold text-gray-500 truncate">${escapeHtml(item.conhecimento || '—')}</div>
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-black border shrink-0 ${countdown.cls}">${escapeHtml(countdown.label)}</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 rounded-xl p-2 border border-gray-100">
                    <div>
                        <span class="text-[9px] font-black uppercase text-gray-400 block">Agente</span>
                        <span class="font-bold text-gray-800">${escapeHtml(item.agente || '—')}</span>
                    </div>
                    <div>
                        <span class="text-[9px] font-black uppercase text-gray-400 block">Previsão de Chegada</span>
                        <span class="font-bold text-gray-900">${escapeHtml(formattedDate)}</span>
                    </div>
                </div>
                <div class="flex items-center justify-between gap-2 pt-0.5">
                    ${renderStatusBadgeHtml(parsedStatus.actualStatus)}
                    <span class="text-[10px] font-bold uppercase text-teal-600">Tocar para editar</span>
                </div>
            </div>
        `;
    }).join('');
}

export async function refreshEtaRecords({ showLoading = true } = {}, uiHelpers) {
    syncEtaStickyHeaderOffset();
    const includeFinished = Boolean(document.getElementById('eta-include-finished')?.checked);
    populateEtaSelectOptions(state.eta.records);

    if (showLoading && uiHelpers?.setLoader) {
        uiHelpers.setLoader(true, 'A carregar cargas em trânsito...');
    }
    try {
        await listEtaRecords({ includeFinished, sort: 'etachegada' });
        renderEtaDashboard();
        startEtaRealtime(uiHelpers);
    } catch (err) {
        console.error('[ETA REFRESH ERROR]', err);
        state.eta.error = err.message || 'Erro ao comunicar com o servidor ETA.';
        renderEtaDashboard();
        if (uiHelpers?.toast) uiHelpers.toast(state.eta.error, 'error');
    } finally {
        if (showLoading && uiHelpers?.setLoader) uiHelpers.setLoader(false);
    }
}

export function handleEtaRealtimeEvent(e) {
    if (!e || !e.record) return;
    const action = e.action;
    const rawRecord = e.record;
    const incoming = {
        ...rawRecord,
        status: parseEtaStatus(rawRecord.status)
    };

    console.log(`[SSE-ETA][PROCESSAR] Ação '${action}' na carga Ref. ${incoming.referencia || incoming.id}`);

    const records = state.eta.records || [];
    const idx = records.findIndex(r => r.id === incoming.id);

    if (action === 'delete') {
        if (idx !== -1) {
            records.splice(idx, 1);
            state.eta.totalItems = Math.max(0, (state.eta.totalItems || records.length + 1) - 1);
        }
        if (activeDetailRecordId === incoming.id) {
            closeEtaDetailModal();
        }
        const openFormId = document.getElementById('eta-form-id')?.value;
        if (openFormId === incoming.id) {
            closeEtaFormModal();
        }
    } else if (action === 'create') {
        if (idx !== -1) {
            records[idx] = incoming;
        } else {
            records.push(incoming);
            state.eta.totalItems = Math.max(state.eta.totalItems || 0, records.length);
        }
        state.eta.records = sortEtaRecords(records);
    } else if (action === 'update') {
        if (idx !== -1) {
            records[idx] = { ...records[idx], ...incoming };
        } else {
            records.push(incoming);
            state.eta.totalItems = Math.max(state.eta.totalItems || 0, records.length);
        }
        state.eta.records = sortEtaRecords(records);
        if (activeDetailRecordId === incoming.id) {
            openEtaDetailModal(incoming.id);
        }
    }

    state.eta.lastSyncAt = new Date().toISOString();

    const viewEl = document.getElementById('view-eta-dashboard');
    if (viewEl && !viewEl.classList.contains('hidden')) {
        renderEtaDashboard();

        if (action === 'create' || action === 'update') {
            setTimeout(() => {
                const tr = document.querySelector(`tr[data-eta-id="${incoming.id}"]`);
                if (tr) {
                    tr.classList.add('eta-row-highlight');
                    setTimeout(() => tr.classList.remove('eta-row-highlight'), 2200);
                }
                const card = document.querySelector(`div[data-eta-id="${incoming.id}"]`);
                if (card) {
                    card.classList.add('eta-card-highlight');
                    setTimeout(() => card.classList.remove('eta-card-highlight'), 2200);
                }
            }, 50);
        }
    }
}

let etaRealtimeActive = false;

export async function startEtaRealtime(uiHelpers) {
    if (etaRealtimeActive && state.eta.realtimeConnected) return;
    etaRealtimeActive = true;
    const ok = await subscribeEtaEvents((e) => {
        handleEtaRealtimeEvent(e);
    });
    const liveBadge = document.getElementById('eta-live-badge');
    const footerLatency = document.getElementById('eta-footer-latency');
    if (liveBadge) {
        if (ok) {
            liveBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200';
            liveBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Tempo Real';
        } else {
            liveBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200';
            liveBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Reconectando...';
        }
    }
    if (footerLatency) {
        const liveIndicator = ok
            ? '<span class="inline-flex items-center gap-1 text-emerald-600 font-bold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Tempo Real Ativo</span>'
            : '<span class="inline-flex items-center gap-1 text-amber-600 font-bold"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Reconectando...</span>';
        footerLatency.innerHTML = `${liveIndicator} • ${state.eta.latencyMs !== null ? `${state.eta.latencyMs}ms` : 'PocketBase'}`;
    }
}

export async function stopEtaRealtime() {
    etaRealtimeActive = false;
    await unsubscribeEtaEvents();
    const liveBadge = document.getElementById('eta-live-badge');
    if (liveBadge) {
        liveBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-400 border border-gray-200';
        liveBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Pausa';
    }
}

function toggleEtaHeaderPanel(panelId, btnId, focusInputId = '') {
    const panel = document.getElementById(panelId);
    const btn = document.getElementById(btnId);
    if (!panel) return;
    const isHidden = panel.classList.toggle('hidden');
    if (btn) {
        btn.classList.toggle('bg-teal-600', !isHidden);
        btn.classList.toggle('hover:bg-teal-700', !isHidden);
        btn.classList.toggle('text-white', !isHidden);
        btn.classList.toggle('bg-white', isHidden);
        btn.classList.toggle('hover:bg-gray-50', isHidden);
        btn.classList.toggle('text-gray-800', isHidden);
    }
    if (!isHidden && focusInputId) {
        document.getElementById(focusInputId)?.focus();
    }
}

export function toggleEtaFilters() {
    toggleEtaHeaderPanel('eta-filter-panel', 'btn-eta-toggle-filters', 'eta-search-input');
}

export function toggleEtaKpis() {
    toggleEtaHeaderPanel('eta-kpi-panel', 'btn-eta-toggle-kpis');
}

export function handleEtaFilterChange() {
    state.eta.filters.search = document.getElementById('eta-search-input')?.value || '';
    state.eta.filters.status = document.getElementById('eta-status-filter')?.value || '';
    state.eta.filters.agente = document.getElementById('eta-agente-filter')?.value || '';
    state.eta.filters.statusGroup = '';
    state.eta.filters.arrivalBucket = '';
    renderEtaDashboard();
}

export function applyEtaQuickFilter(kind) {
    const statusSelect = document.getElementById('eta-status-filter');
    const agenteSelect = document.getElementById('eta-agente-filter');
    if (statusSelect) statusSelect.value = '';
    if (agenteSelect) agenteSelect.value = '';
    state.eta.filters.status = '';
    state.eta.filters.agente = '';
    state.eta.filters.statusGroup = '';
    state.eta.filters.arrivalBucket = '';

    if (kind === 'due') {
        state.eta.filters.arrivalBucket = 'due';
    } else if (kind === 'awaiting') {
        state.eta.filters.statusGroup = 'awaiting';
    } else if (kind === 'clearance') {
        state.eta.filters.statusGroup = 'clearance';
    }
    renderEtaDashboard();
}

export function clearEtaFilters() {
    const searchInput = document.getElementById('eta-search-input');
    const statusSelect = document.getElementById('eta-status-filter');
    const agenteSelect = document.getElementById('eta-agente-filter');
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = '';
    if (agenteSelect) agenteSelect.value = '';
    state.eta.filters = { search: '', status: '', statusGroup: '', agente: '', arrivalBucket: '' };
    renderEtaDashboard();
}

export function handleEtaFormStatusChange() {
    const statusSelect = document.getElementById('eta-form-status');
    const dateInput = document.getElementById('eta-form-date');
    const reqMark = document.getElementById('eta-form-date-req');
    if (!statusSelect || !dateInput) return;

    const isNoPrevision = String(statusSelect.value || '').trim().toLowerCase() === 'sem previsão';
    dateInput.required = !isNoPrevision;
    if (reqMark) reqMark.textContent = isNoPrevision ? '(opcional)' : '*';
}

export function openNewEtaModal() {
    populateEtaSelectOptions(state.eta.records);
    const form = document.getElementById('form-eta-record');
    if (form) form.reset();

    const idInput = document.getElementById('eta-form-id');
    const iconHost = document.getElementById('modal-eta-form-icon');
    const title = document.getElementById('modal-eta-form-title');
    const submitBtn = document.getElementById('btn-eta-submit');
    const dateInput = document.getElementById('eta-form-date');
    const statusSelect = document.getElementById('eta-form-status');
    const agenteSelect = document.getElementById('eta-form-agente');
    const deleteBtn = document.getElementById('btn-eta-form-delete');
    const historyBtn = document.getElementById('btn-eta-form-history');

    if (idInput) idInput.value = '';
    if (iconHost) iconHost.innerHTML = renderEtaIconHtml(null);
    if (title) title.textContent = 'Nova Previsão de Carga';
    if (submitBtn) submitBtn.textContent = 'Guardar Previsão';
    if (statusSelect) statusSelect.value = ETA_STATUS_OPTIONS[1] || 'Aguarda Chegada';
    if (agenteSelect && !agenteSelect.value && ETA_AGENT_OPTIONS.length > 0) {
        agenteSelect.value = '';
    }
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    if (deleteBtn) deleteBtn.classList.add('hidden');
    if (historyBtn) historyBtn.classList.add('hidden');
    handleEtaFormStatusChange();

    document.getElementById('modal-eta-form')?.classList.remove('hidden');
}

export function editEtaRecord(id) {
    const record = (state.eta.records || []).find(r => r.id === id);
    if (!record) return;

    populateEtaSelectOptions(state.eta.records);
    const parsed = parseEtaStatus(record.status);

    document.getElementById('eta-form-id').value = record.id;
    document.getElementById('eta-form-referencia').value = record.referencia || '';
    document.getElementById('eta-form-conhecimento').value = record.conhecimento || '';
    document.getElementById('eta-form-agente').value = record.agente || '';
    document.getElementById('eta-form-date').value = extractEtaYMD(record.etachegada);
    document.getElementById('eta-form-status').value = parsed.actualStatus || 'Aguarda Chegada';

    const iconHost = document.getElementById('modal-eta-form-icon');
    const title = document.getElementById('modal-eta-form-title');
    const submitBtn = document.getElementById('btn-eta-submit');
    const deleteBtn = document.getElementById('btn-eta-form-delete');
    const historyBtn = document.getElementById('btn-eta-form-history');
    if (iconHost) iconHost.innerHTML = renderEtaIconHtml(record);
    if (title) title.textContent = `Editar Carga Ref. ${record.referencia || ''}`;
    if (submitBtn) submitBtn.textContent = 'Atualizar Previsão';
    if (deleteBtn) {
        deleteBtn.classList.remove('hidden');
        deleteBtn.onclick = () => window.deleteEtaRecord?.(record.id);
    }
    if (historyBtn) {
        historyBtn.classList.remove('hidden');
        historyBtn.onclick = () => {
            closeEtaFormModal();
            openEtaDetailModal(record.id);
        };
    }

    handleEtaFormStatusChange();
    document.getElementById('modal-eta-form')?.classList.remove('hidden');
}

export function closeEtaFormModal() {
    document.getElementById('modal-eta-form')?.classList.add('hidden');
}

export async function submitEtaForm(e, uiHelpers) {
    e.preventDefault();
    const id = document.getElementById('eta-form-id')?.value?.trim() || '';
    const referencia = document.getElementById('eta-form-referencia')?.value?.trim() || '';
    const conhecimento = document.getElementById('eta-form-conhecimento')?.value?.trim() || '';
    const agente = document.getElementById('eta-form-agente')?.value?.trim() || '';
    const etachegada = document.getElementById('eta-form-date')?.value || '';
    const status = document.getElementById('eta-form-status')?.value || 'Aguarda Chegada';
    const isNoPrevision = status.trim().toLowerCase() === 'sem previsão';

    if (!referencia || !conhecimento || !agente || (!isNoPrevision && !etachegada)) {
        if (uiHelpers?.toast) uiHelpers.toast('Preencha todos os campos obrigatórios.', 'warning');
        return;
    }

    const submitBtn = document.getElementById('btn-eta-submit');
    if (uiHelpers?.setBtnLoading) uiHelpers.setBtnLoading(submitBtn, true, 'A gravar...');

    try {
        const username = getCurrentUsername();
        if (id) {
            const existing = (state.eta.records || []).find(r => r.id === id);
            const payload = buildUpdateEtaPayload(existing, { referencia, conhecimento, agente, etachegada, status }, username);
            await updateEtaRecord(id, payload);
            if (uiHelpers?.toast) uiHelpers.toast('Previsão ETA atualizada com sucesso!', 'success');
        } else {
            const payload = buildNewEtaPayload({ referencia, conhecimento, agente, etachegada, status, username });
            await createEtaRecord(payload);
            if (uiHelpers?.toast) uiHelpers.toast('Nova previsão ETA criada com sucesso!', 'success');
        }
        closeEtaFormModal();
        await refreshEtaRecords({ showLoading: false }, uiHelpers);
    } catch (err) {
        console.error('[ETA SAVE ERROR]', err);
        if (uiHelpers?.toast) uiHelpers.toast(err.message || 'Erro ao gravar previsão ETA.', 'error');
    } finally {
        if (uiHelpers?.setBtnLoading) uiHelpers.setBtnLoading(submitBtn, false);
    }
}

export async function deleteEtaRecordById(id, uiHelpers) {
    const record = (state.eta.records || []).find(r => r.id === id);
    if (!record) return;

    const label = record.referencia ? `Ref. ${record.referencia} (${record.conhecimento || ''})` : id;
    if (!confirm(`Tem a certeza que deseja apagar permanentemente o registo ${label}?`)) {
        return;
    }

    if (uiHelpers?.setLoader) uiHelpers.setLoader(true, 'A apagar registo ETA...');
    try {
        await deleteEtaRecord(id);
        state.eta.records = (state.eta.records || []).filter(r => r.id !== id);
        closeEtaFormModal();
        closeEtaDetailModal();
        renderEtaDashboard();
        if (uiHelpers?.toast) uiHelpers.toast('Registo ETA apagado com sucesso!', 'success');
    } catch (err) {
        console.error('[ETA DELETE ERROR]', err);
        if (uiHelpers?.toast) uiHelpers.toast(err.message || 'Erro ao apagar registo ETA.', 'error');
    } finally {
        if (uiHelpers?.setLoader) uiHelpers.setLoader(false);
    }
}

export function openEtaDetailModal(id) {
    const record = (state.eta.records || []).find(r => r.id === id);
    if (!record) return;
    populateEtaSelectOptions(state.eta.records);
    activeDetailRecordId = record.id;

    const parsed = parseEtaStatus(record.status);
    document.getElementById('eta-detail-title').textContent = `Ref. ${record.referencia || '—'}`;
    document.getElementById('eta-detail-conhecimento').textContent = record.conhecimento || '—';
    document.getElementById('eta-detail-agente').textContent = record.agente || '—';
    document.getElementById('eta-detail-date').textContent = formatEtaDateDisplay(record.etachegada);

    const statusSelect = document.getElementById('eta-detail-status-select');
    if (statusSelect) statusSelect.value = parsed.actualStatus || 'Aguarda Chegada';

    const editBtn = document.getElementById('btn-eta-detail-edit');
    if (editBtn) {
        editBtn.onclick = () => {
            closeEtaDetailModal();
            editEtaRecord(record.id);
        };
    }

    const deleteBtn = document.getElementById('btn-eta-detail-delete');
    if (deleteBtn) {
        deleteBtn.onclick = () => window.deleteEtaRecord?.(record.id);
    }

    const historyBox = document.getElementById('eta-detail-history');
    const historyItems = [...(parsed.changesStatus || [])].reverse();
    if (historyBox) {
        if (historyItems.length === 0) {
            historyBox.innerHTML = `<div class="p-4 text-center text-gray-400 text-xs font-semibold bg-gray-50 rounded-xl border border-gray-100">Sem registos de histórico.</div>`;
        } else {
            historyBox.innerHTML = historyItems.map((entry, idx) => `
                <div class="flex items-center justify-between gap-3 p-3 rounded-xl border ${idx === 0 ? 'bg-teal-50/40 border-teal-200' : 'bg-gray-50 border-gray-100'}">
                    <div class="flex items-center gap-2.5 min-w-0">
                        ${renderStatusBadgeHtml(entry.status)}
                        ${entry.username ? `<span class="text-[10px] font-bold text-gray-500 truncate">por ${escapeHtml(entry.username)}</span>` : ''}
                    </div>
                    <span class="text-[10px] font-mono font-bold text-gray-500 shrink-0">${escapeHtml(entry.data || '—')}</span>
                </div>
            `).join('');
        }
    }

    document.getElementById('modal-eta-detail')?.classList.remove('hidden');
}

export function closeEtaDetailModal() {
    activeDetailRecordId = null;
    document.getElementById('modal-eta-detail')?.classList.add('hidden');
}

export async function quickUpdateEtaStatus(uiHelpers) {
    if (!activeDetailRecordId) return;
    const record = (state.eta.records || []).find(r => r.id === activeDetailRecordId);
    if (!record) return;

    const nextStatus = document.getElementById('eta-detail-status-select')?.value;
    if (!nextStatus) return;

    const btn = document.getElementById('btn-eta-quick-status');
    if (uiHelpers?.setBtnLoading) uiHelpers.setBtnLoading(btn, true, 'A aplicar...');

    try {
        const payload = buildUpdateEtaPayload(record, { status: nextStatus }, getCurrentUsername());
        const updated = await updateEtaRecord(record.id, payload);
        const idx = state.eta.records.findIndex(r => r.id === record.id);
        if (idx !== -1) state.eta.records[idx] = updated;
        renderEtaDashboard();
        openEtaDetailModal(record.id);
        if (uiHelpers?.toast) uiHelpers.toast(`Estágio atualizado para "${nextStatus}".`, 'success');
    } catch (err) {
        console.error('[ETA QUICK STATUS ERROR]', err);
        if (uiHelpers?.toast) uiHelpers.toast(err.message || 'Erro ao atualizar estágio.', 'error');
    } finally {
        if (uiHelpers?.setBtnLoading) uiHelpers.setBtnLoading(btn, false);
    }
}

export function openEtaDiagnosticsModal() {
    document.getElementById('modal-eta-diagnostics')?.classList.remove('hidden');
    runEtaDiagnostics();
}

export function closeEtaDiagnosticsModal() {
    document.getElementById('modal-eta-diagnostics')?.classList.add('hidden');
}

export async function runEtaDiagnostics() {
    const resultsEl = document.getElementById('eta-diagnostics-results');
    const btn = document.getElementById('btn-eta-run-diagnostics');
    if (btn) btn.disabled = true;
    if (resultsEl) {
        resultsEl.innerHTML = `
            <div class="p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 font-semibold flex items-center justify-center gap-2">
                <span class="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></span>
                A testar conectividade e latência com a API ETA...
            </div>
        `;
    }

    try {
        const res = await checkEtaHealth();
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        const okBadge = res.ok
            ? '<span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-black uppercase text-[10px]">Operacional</span>'
            : '<span class="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-black uppercase text-[10px]">Falha</span>';

        if (resultsEl) {
            resultsEl.innerHTML = `
                <div class="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <span class="font-bold text-gray-700">Estado do Navegador</span>
                    <span class="font-black text-[10px] uppercase ${isOnline ? 'text-emerald-600' : 'text-rose-600'}">${isOnline ? 'Online' : 'Offline'}</span>
                </div>
                <div class="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <span class="font-bold text-gray-700">API PocketBase ETA</span>
                    ${okBadge}
                </div>
                <div class="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <span class="font-bold text-gray-700">Latência Proxy -> PocketBase</span>
                    <span class="font-mono font-bold text-gray-900">${escapeHtml(String(res.latencyMs ?? '—'))} ms</span>
                </div>
                <div class="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <span class="font-bold text-gray-700">Total de Registos na Coleção</span>
                    <span class="font-mono font-bold text-gray-900">${escapeHtml(String(res.totalRecords ?? '—'))}</span>
                </div>
                ${res.error ? `<div class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">${escapeHtml(res.error)}</div>` : ''}
            `;
        }
    } catch (err) {
        if (resultsEl) {
            resultsEl.innerHTML = `<div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">Erro ao executar diagnóstico: ${escapeHtml(err.message)}</div>`;
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

const ETA_HEX_BG = {
    'bg-slate-100': '#f1f5f9', 'bg-slate-400': '#94a3b8',
    'bg-teal-50': '#f0fdfa', 'bg-teal-500': '#14b8a6',
    'bg-sky-50': '#f0f9ff', 'bg-sky-500': '#0ea5e9',
    'bg-amber-50': '#fffbeb', 'bg-amber-500': '#f59e0b',
    'bg-orange-50': '#fff7ed', 'bg-orange-500': '#f97316',
    'bg-yellow-50': '#fefce8', 'bg-yellow-500': '#eab308',
    'bg-indigo-50': '#eef2ff', 'bg-indigo-500': '#6366f1',
    'bg-cyan-50': '#ecfeff', 'bg-cyan-500': '#06b6d4',
    'bg-emerald-50': '#ecfdf5', 'bg-emerald-500': '#10b981',
    'bg-purple-50': '#faf5ff', 'bg-purple-500': '#a855f7',
    'bg-rose-50': '#fff1f2', 'bg-rose-500': '#f43f5e',
    'bg-violet-50': '#f5f3ff', 'bg-violet-500': '#8b5cf6',
    'bg-gray-50': '#f9fafb', 'bg-gray-100': '#f3f4f6', 'bg-gray-400': '#9ca3af'
};

const ETA_HEX_TEXT = {
    'text-slate-600': '#475569', 'text-slate-700': '#334155',
    'text-teal-700': '#0f766e', 'text-sky-700': '#0369a1',
    'text-amber-700': '#b45309', 'text-orange-700': '#c2410c',
    'text-yellow-700': '#a16207', 'text-indigo-700': '#4338ca',
    'text-cyan-700': '#0e7490', 'text-emerald-700': '#047857',
    'text-purple-700': '#7e22ce', 'text-rose-700': '#be123c',
    'text-violet-700': '#6d28d9',
    'text-gray-500': '#6b7280', 'text-gray-600': '#4b5563', 'text-gray-700': '#374151'
};

const ETA_HEX_BORDER = {
    'border-slate-200': '#e2e8f0', 'border-slate-300': '#cbd5e1',
    'border-teal-200': '#99f6e4', 'border-sky-200': '#bae6fd',
    'border-amber-200': '#fde68a', 'border-orange-200': '#fed7aa',
    'border-yellow-300': '#fde047', 'border-indigo-200': '#c7d2fe',
    'border-cyan-200': '#a5f3fc', 'border-emerald-200': '#a7f3d0',
    'border-purple-200': '#e9d5ff', 'border-rose-200': '#fecdd3',
    'border-violet-200': '#ddd6fe', 'border-gray-200': '#e5e7eb'
};

function resolveBadgeInlineStyle(clsStr) {
    let bg = '#f3f4f6';
    let color = '#374151';
    let border = '#e5e7eb';
    String(clsStr || '').split(/\s+/).forEach(tok => {
        if (ETA_HEX_BG[tok]) bg = ETA_HEX_BG[tok];
        if (ETA_HEX_TEXT[tok]) color = ETA_HEX_TEXT[tok];
        if (ETA_HEX_BORDER[tok]) border = ETA_HEX_BORDER[tok];
    });
    return { bg, color, border };
}

const SHIP_ICON_PATH_D = 'M12 2a1 1 0 0 1 1 1v2h3a1 1 0 0 1 1 1v3.38l2.32.77a1 1 0 0 1 .64 1.24l-1.5 4.86a3.5 3.5 0 0 1-1.96-.44A3.5 3.5 0 0 1 14 16.5a3.5 3.5 0 0 1-2-.63 3.5 3.5 0 0 1-2 .63 3.5 3.5 0 0 1-2.5-.69 3.5 3.5 0 0 1-1.96.44l-1.5-4.86a1 1 0 0 1 .64-1.24L7 9.38V6a1 1 0 0 1 1-1h3V3a1 1 0 0 1 1-1Zm3 5H9v1.72l3-1 3 1V7Zm4.5 11.75c-.97 0-1.85-.39-2.5-1.02a3.49 3.49 0 0 1-5 0 3.49 3.49 0 0 1-5 0A3.48 3.48 0 0 1 4.5 18.75a1 1 0 1 0 0 2c1.02 0 1.97-.35 2.75-.93.78.58 1.73.93 2.75.93s1.97-.35 2.75-.93c.78.58 1.73.93 2.75.93s1.97-.35 2.75-.93c.78.58 1.73.93 2.75.93a1 1 0 1 0 0-2Z';

function drawRoundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function fitCanvasText(ctx, text, maxWidth) {
    const raw = String(text ?? '');
    if (!maxWidth || ctx.measureText(raw).width <= maxWidth) return raw;
    let lo = 0;
    let hi = raw.length;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ctx.measureText(`${raw.slice(0, mid)}…`).width <= maxWidth) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    return `${raw.slice(0, lo)}…`;
}

function fillTextCapCentered(ctx, text, x, centerY, align = 'left', refGlyph = 'M') {
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    const sample = refGlyph || text;
    const m = ctx.measureText(sample);
    const ascent = m.actualBoundingBoxAscent ?? 8;
    const descent = refGlyph ? 0 : (m.actualBoundingBoxDescent ?? 0);
    const drawY = centerY + (ascent - descent) / 2;
    ctx.fillText(text, x, drawY);
}

function loadCanvasImage(url, timeoutMs = 2000) {
    return new Promise(resolve => {
        if (!url) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const timer = setTimeout(() => resolve(null), timeoutMs);
        img.onload = () => {
            clearTimeout(timer);
            resolve(img.naturalWidth > 0 ? img : null);
        };
        img.onerror = () => {
            clearTimeout(timer);
            resolve(null);
        };
        img.src = url;
    });
}

function drawShipCellIcon(ctx, x, y, size, img) {
    ctx.save();
    drawRoundRectPath(ctx, x, y, size, size, 6);
    if (img) {
        ctx.clip();
        const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, size, size);
        ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
        ctx.restore();
        ctx.save();
        drawRoundRectPath(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 6);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        return;
    }
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundRectPath(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 6);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    if (typeof Path2D !== 'undefined') {
        ctx.save();
        const iconSize = 20;
        const scale = iconSize / 24;
        ctx.translate(x + (size - iconSize) / 2, y + (size - iconSize) / 2);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#475569';
        ctx.fill(new Path2D(SHIP_ICON_PATH_D));
        ctx.restore();
    }
}

export async function exportEtaTableScreenshot(uiHelpers) {
    const records = state.eta.records || [];
    const filters = state.eta.filters || {};
    const filtered = filterEtaRecords(records, {
        ...filters,
        includeFinished: state.eta.includeFinished
    });

    if (filtered.length === 0) {
        if (uiHelpers?.toast) uiHelpers.toast('Não existem registos visíveis na tabela para capturar.', 'info');
        return;
    }

    const btn = document.getElementById('btn-eta-screenshot');
    if (btn) btn.disabled = true;
    if (uiHelpers?.setLoader) uiHelpers.setLoader(true, `A gerar screenshot de ${filtered.length} registo(s)...`);

    try {
        if (document.fonts?.ready) {
            await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]);
        }

        const uniqueUrls = [...new Set(filtered.map(getEtaIconUrl).filter(Boolean))];
        const imageMap = new Map();
        await Promise.all(uniqueUrls.map(async url => {
            imageMap.set(url, await loadCanvasImage(url));
        }));

        const filterParts = [];
        if (filters.arrivalBucket === 'due') filterParts.push('Chegada Hoje / Atrasadas');
        if (filters.statusGroup === 'awaiting') filterParts.push('Em Trânsito / Atracagem');
        if (filters.statusGroup === 'clearance') filterParts.push('Despacho / Prontas');
        if (filters.agente) filterParts.push(`Agente: ${filters.agente}`);
        if (filters.status) filterParts.push(`Estágio: ${filters.status}`);
        if (filters.search) filterParts.push(`Pesquisa: "${filters.search}"`);
        if (state.eta.includeFinished) filterParts.push('Inclui finalizados');
        const subtitleText = (filterParts.length > 0 ? filterParts.join('  •  ') : 'Cargas em Trânsito — Todos os registos ativos').toUpperCase();

        const now = new Date();
        const stampText = `${now.toLocaleDateString('pt-PT')} ${now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
        const countLabel = `${filtered.length} REGISTO${filtered.length === 1 ? '' : 'S'}`;

        const outerPad = 24;
        const tableW = 1152;
        const totalW = tableW + outerPad * 2;
        const headBarH = 54;
        const thH = 36;
        const headToRowsGap = 12;
        const rowH = 42;
        const rowGap = 4;
        const rowsTotalH = filtered.length * rowH + Math.max(0, filtered.length - 1) * rowGap;
        const totalH = outerPad + headBarH + thH + headToRowsGap + rowsTotalH + outerPad;

        const scale = Math.min(2, Math.max(1, Math.floor((30000 / totalH) * 10) / 10));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(totalW * scale);
        canvas.height = Math.round(totalH * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        const sansFont = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        const monoFont = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

        // Fundo geral igual ao dashboard (#f3f4f6)
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, totalW, totalH);

        // Cabeçalho superior da imagem
        ctx.fillStyle = '#111827';
        ctx.font = `900 24px ${sansFont}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('ETA', outerPad, outerPad - 2);

        ctx.fillStyle = '#6b7280';
        ctx.font = `700 11px ${sansFont}`;
        ctx.fillText(fitCanvasText(ctx, subtitleText, tableW - 220), outerPad, outerPad + 27);

        ctx.textAlign = 'right';
        ctx.fillText(countLabel, totalW - outerPad, outerPad + 4);
        ctx.fillText(stampText, totalW - outerPad, outerPad + 22);

        // Definição geométrica das 5 colunas (soma = 1152)
        const tableX = outerPad;
        const colWidths = [200, 230, 250, 260, 212];
        const colStarts = [];
        let accX = tableX;
        for (const w of colWidths) {
            colStarts.push(accX);
            accX += w;
        }
        const badgeW = 180;
        const badgeH = 32;
        const badgeX = tableX + tableW - 5 - badgeW;

        // Header da tabela
        const thY = outerPad + headBarH;
        drawRoundRectPath(ctx, tableX + 0.5, thY + 0.5, tableW - 1, thH - 1, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.stroke();

        const thCenterY = thY + thH / 2;
        ctx.fillStyle = '#6b7280';
        ctx.font = `800 11px ${sansFont}`;
        fillTextCapCentered(ctx, 'REFERÊNCIA', colStarts[0] + 6, thCenterY, 'left');
        fillTextCapCentered(ctx, 'BL/AWB/CM', colStarts[1] + colWidths[1] / 2, thCenterY, 'center');
        fillTextCapCentered(ctx, 'AGENTE', colStarts[2] + colWidths[2] / 2, thCenterY, 'center');
        fillTextCapCentered(ctx, 'PREVISÃO DE CHEGADA', colStarts[3] + colWidths[3] / 2, thCenterY, 'center');
        fillTextCapCentered(ctx, 'ESTÁGIO', badgeX + badgeW / 2, thCenterY, 'center');

        // Linhas da tabela
        let curY = thY + thH + headToRowsGap;
        for (const item of filtered) {
            const parsedStatus = parseEtaStatus(item.status);
            const actualStatus = parsedStatus.actualStatus || 'Aguarda Chegada';
            const countdown = getEtaCountdownMeta(item.etachegada, actualStatus);
            const formattedDate = formatEtaDateDisplay(item.etachegada);
            const statusMeta = getEtaStatusStyle(actualStatus);
            const stStyle = resolveBadgeInlineStyle(statusMeta.badge);
            const cdStyle = resolveBadgeInlineStyle(countdown.cls);

            drawRoundRectPath(ctx, tableX + 0.5, curY + 0.5, tableW - 1, rowH - 1, 8);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            ctx.stroke();

            const centerY = curY + rowH / 2;

            // Col 1: Ícone + Referência
            const iconImg = imageMap.get(getEtaIconUrl(item)) || null;
            drawShipCellIcon(ctx, colStarts[0] + 5, curY + (rowH - 32) / 2, 32, iconImg);
            ctx.fillStyle = '#1f2937';
            ctx.font = `600 14px ${sansFont}`;
            fillTextCapCentered(ctx, fitCanvasText(ctx, item.referencia || '—', colWidths[0] - 54), colStarts[0] + 47, centerY, 'left');

            // Col 2: BL/AWB/CM
            ctx.fillStyle = '#6b7280';
            ctx.font = `400 14px ${monoFont}`;
            fillTextCapCentered(ctx, fitCanvasText(ctx, item.conhecimento || '—', colWidths[1] - 16), colStarts[1] + colWidths[1] / 2, centerY, 'center');

            // Col 3: Agente
            ctx.fillStyle = '#6b7280';
            ctx.font = `400 14px ${sansFont}`;
            fillTextCapCentered(ctx, fitCanvasText(ctx, item.agente || '—', colWidths[2] - 16), colStarts[2] + colWidths[2] / 2, centerY, 'center');

            // Col 4: Previsão de Chegada + Pill de Contagem
            ctx.font = `400 14px ${sansFont}`;
            const dateW = ctx.measureText(formattedDate).width;
            ctx.font = `700 11px ${sansFont}`;
            const cdTextW = ctx.measureText(countdown.label).width;
            const cdPillW = cdTextW + 14;
            const cdPillH = 22;
            const cdGap = 8;
            const groupW = dateW + cdGap + cdPillW;
            const groupStartX = colStarts[3] + (colWidths[3] - groupW) / 2;

            ctx.fillStyle = '#6b7280';
            ctx.font = `400 14px ${sansFont}`;
            fillTextCapCentered(ctx, formattedDate, groupStartX, centerY, 'left');

            const cdPillX = groupStartX + dateW + cdGap;
            const cdPillY = centerY - cdPillH / 2;
            drawRoundRectPath(ctx, cdPillX + 0.5, cdPillY + 0.5, cdPillW - 1, cdPillH - 1, 6);
            ctx.fillStyle = cdStyle.bg;
            ctx.fill();
            ctx.strokeStyle = cdStyle.border;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = cdStyle.color;
            ctx.font = `700 11px ${sansFont}`;
            fillTextCapCentered(ctx, countdown.label, cdPillX + cdPillW / 2, centerY, 'center');

            // Col 5: Estágio (180x32, texto centralizado)
            const badgeY = curY + (rowH - badgeH) / 2;
            drawRoundRectPath(ctx, badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1, 6);
            ctx.fillStyle = stStyle.bg;
            ctx.fill();
            ctx.strokeStyle = stStyle.border;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.font = `800 11px ${sansFont}`;
            const statusText = fitCanvasText(ctx, actualStatus.toUpperCase(), badgeW - 20);
            ctx.fillStyle = stStyle.color;
            fillTextCapCentered(ctx, statusText, badgeX + badgeW / 2, centerY, 'center');

            curY += rowH + rowGap;
        }

        const ymd = now.toISOString().split('T')[0];
        const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const link = document.createElement('a');
        link.download = `eta_tabela_${ymd}_${hhmm}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        if (uiHelpers?.toast) uiHelpers.toast(`Screenshot de ${filtered.length} registo(s) descarregado!`, 'success');
    } catch (err) {
        console.error('[ETA SCREENSHOT ERROR]', err);
        if (uiHelpers?.toast) uiHelpers.toast(`Erro ao gerar screenshot: ${err.message || err}`, 'error');
    } finally {
        if (uiHelpers?.setLoader) uiHelpers.setLoader(false);
        if (btn) btn.disabled = false;
    }
}
