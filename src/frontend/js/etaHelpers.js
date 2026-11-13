/**
 * Funções puras de lógica e formatação para o módulo ETA (Cargas em Trânsito)
 */

export const ETA_AGENT_OPTIONS = [
    'MAERSK',
    'SHARAF',
    'MESSINA',
    'CMA CGM',
    'BOLLORE',
    'MSC MOÇAMBIQUE',
    'PIL MOÇAMBIQUE',
    'LBH MOÇAMBIQUE',
    'TIBA MOÇAMBIQUE',
    'DIAMOND EXPRESS',
    'DIAMOND SHIPPING',
    'MANICA MOÇAMBIQUE'
];

export const ETA_STATUS_OPTIONS = [
    'Sem Previsão',
    'Aguarda Chegada',
    'Aguarda Submissão',
    'Aguarda Pagamento',
    'Aguarda Verificação',
    'Aguarda Examinação',
    'Aguarda Saida',
    'Desembaraçado',
    'Finalizado',
    'Regularização',
    'Cancelado'
];

const AWAITING_STATUS_SET = new Set([
    'sem previsão',
    'aguarda chegada',
    'aguarda navio atracado'
]);

const CLOSED_STATUS_SET = new Set([
    'finalizado',
    'cancelado'
]);

const STATUS_STYLE_MAP = {
    'sem previsão': {
        badge: 'bg-slate-100 text-slate-700 border-slate-300',
        dot: 'bg-slate-400'
    },
    'aguarda chegada': {
        badge: 'bg-teal-50 text-teal-700 border-teal-200',
        dot: 'bg-teal-500'
    },
    'aguarda submissão': {
        badge: 'bg-sky-50 text-sky-700 border-sky-200',
        dot: 'bg-sky-500'
    },
    'aguarda pagamento': {
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500'
    },
    'aguarda verificação': {
        badge: 'bg-orange-50 text-orange-700 border-orange-200',
        dot: 'bg-orange-500'
    },
    'aguarda examinação': {
        badge: 'bg-yellow-50 text-yellow-700 border-yellow-300',
        dot: 'bg-yellow-500'
    },
    'aguarda saida': {
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        dot: 'bg-indigo-500'
    },
    'desembaraçado': {
        badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        dot: 'bg-cyan-500'
    },
    'finalizado': {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500'
    },
    'regularização': {
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        dot: 'bg-purple-500'
    },
    'cancelado': {
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500'
    },
    // Compatibilidade com estados legados
    'aguarda navio atracado': {
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500'
    },
    'aguarda despacho': {
        badge: 'bg-violet-50 text-violet-700 border-violet-200',
        dot: 'bg-violet-500'
    },
    'em verificação': {
        badge: 'bg-orange-50 text-orange-700 border-orange-200',
        dot: 'bg-orange-500'
    },
    'pronto p/ levantamento': {
        badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        dot: 'bg-cyan-500'
    }
};

export function parseEtaStatus(rawStatus) {
    if (!rawStatus) {
        return { actualStatus: 'Aguarda Chegada', changesStatus: [], dataStatus: '', own: 'No own' };
    }
    if (typeof rawStatus === 'string') {
        try {
            const parsed = JSON.parse(rawStatus);
            return parseEtaStatus(parsed);
        } catch (_) {
            return { actualStatus: rawStatus, changesStatus: [], dataStatus: '', own: 'No own' };
        }
    }
    return {
        actualStatus: rawStatus.actualStatus || 'Aguarda Chegada',
        changesStatus: Array.isArray(rawStatus.changesStatus) ? rawStatus.changesStatus : [],
        dataStatus: rawStatus.dataStatus || '',
        own: rawStatus.own || 'No own'
    };
}

export function getEtaStatusStyle(statusText) {
    const key = String(statusText || '').trim().toLowerCase();
    return STATUS_STYLE_MAP[key] || {
        badge: 'bg-gray-100 text-gray-700 border-gray-200',
        dot: 'bg-gray-400'
    };
}

export function mergeEtaAgents(records = []) {
    const merged = [...ETA_AGENT_OPTIONS];
    const seen = new Set(merged.map(a => a.toUpperCase()));
    const extras = [];

    (Array.isArray(records) ? records : []).forEach(item => {
        const ag = String(item?.agente || '').trim();
        if (ag && !seen.has(ag.toUpperCase())) {
            seen.add(ag.toUpperCase());
            extras.push(ag);
        }
    });

    extras.sort((a, b) => a.localeCompare(b, 'pt'));
    return [...merged, ...extras];
}

export function mergeEtaStatuses(records = []) {
    const merged = [...ETA_STATUS_OPTIONS];
    const seen = new Set(merged.map(s => s.toLowerCase()));
    const extras = [];

    (Array.isArray(records) ? records : []).forEach(item => {
        const st = String(parseEtaStatus(item?.status).actualStatus || '').trim();
        if (st && !seen.has(st.toLowerCase())) {
            seen.add(st.toLowerCase());
            extras.push(st);
        }
    });

    return [...merged, ...extras];
}

export function getEtaIconUrl(item) {
    if (!item || !item.id || !item.icone) return '';
    return `/api/eta/files/${encodeURIComponent(item.id)}/${encodeURIComponent(item.icone)}`;
}

export function extractEtaYMD(dateStr) {
    if (!dateStr) return '';
    const match = String(dateStr).trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
}

export function formatEtaDateDisplay(dateStr) {
    const ymd = extractEtaYMD(dateStr);
    if (!ymd) return '—';
    const [yyyy, mm, dd] = ymd.split('-');
    return `${dd}/${mm}/${yyyy}`;
}

export function formatEtaHistoryDate(dateInput = new Date()) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

export function formatEtaIsoForSave(ymdStr) {
    const ymd = extractEtaYMD(ymdStr);
    if (!ymd) return '';
    return `${ymd} 10:00:00.123Z`;
}

export function getEtaCountdownMeta(dateStr, actualStatus, todayRef = new Date()) {
    const statusLower = String(actualStatus || '').trim().toLowerCase();
    if (statusLower === 'finalizado') {
        return { label: 'Finalizado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', bucket: 'finished' };
    }
    if (statusLower === 'cancelado') {
        return { label: 'Cancelado', cls: 'bg-rose-50 text-rose-700 border-rose-200', bucket: 'canceled' };
    }
    if (statusLower === 'sem previsão') {
        return { label: 'Sem Previsão', cls: 'bg-slate-100 text-slate-600 border-slate-200', bucket: 'none' };
    }
    const ymd = extractEtaYMD(dateStr);
    if (!ymd) {
        return { label: 'Sem Data', cls: 'bg-gray-100 text-gray-500 border-gray-200', bucket: 'none' };
    }

    const [yyyy, mm, dd] = ymd.split('-').map(Number);
    const targetDay = new Date(yyyy, mm - 1, dd);
    const baseDay = new Date(todayRef.getFullYear(), todayRef.getMonth(), todayRef.getDate());
    const diffDays = Math.round((targetDay.getTime() - baseDay.getTime()) / 86400000);

    if (diffDays < 0) {
        const absDays = Math.abs(diffDays);
        return {
            label: `Há ${absDays}d`,
            cls: 'bg-rose-50 text-rose-700 border-rose-200',
            bucket: 'overdue',
            diffDays
        };
    }
    if (diffDays === 0) {
        return { label: 'Hoje', cls: 'bg-amber-50 text-amber-700 border-amber-200', bucket: 'today', diffDays };
    }
    if (diffDays <= 3) {
        return { label: `Em ${diffDays}d`, cls: 'bg-sky-50 text-sky-700 border-sky-200', bucket: 'soon', diffDays };
    }
    return { label: `Em ${diffDays}d`, cls: 'bg-gray-50 text-gray-600 border-gray-200', bucket: 'upcoming', diffDays };
}

export function buildNewEtaPayload({ referencia, conhecimento, agente, etachegada, status, username = '' }, now = new Date()) {
    const actualStatus = String(status || 'Aguarda Chegada').trim();
    const dataStatus = formatEtaHistoryDate(now);
    return {
        referencia: String(referencia || '').trim(),
        conhecimento: String(conhecimento || '').trim(),
        agente: String(agente || '').trim(),
        etachegada: formatEtaIsoForSave(etachegada),
        status: {
            actualStatus,
            changesStatus: [{ data: dataStatus, status: actualStatus, username: String(username || '').trim() }],
            dataStatus,
            own: 'No own'
        }
    };
}

export function buildUpdateEtaPayload(existingRecord, updates, username = '', now = new Date()) {
    const currentStatus = parseEtaStatus(existingRecord?.status);
    const nextStatusText = updates.status !== undefined
        ? String(updates.status).trim()
        : currentStatus.actualStatus;
    const dateStamp = formatEtaHistoryDate(now);
    const changes = [...(currentStatus.changesStatus || [])];

    if (nextStatusText !== currentStatus.actualStatus) {
        changes.push({
            data: dateStamp,
            status: nextStatusText,
            username: String(username || '').trim()
        });
    }

    const nextPayload = {
        status: {
            actualStatus: nextStatusText,
            changesStatus: changes,
            dataStatus: nextStatusText !== currentStatus.actualStatus ? dateStamp : (currentStatus.dataStatus || dateStamp),
            own: currentStatus.own || 'No own'
        }
    };

    if (updates.referencia !== undefined) nextPayload.referencia = String(updates.referencia).trim();
    if (updates.conhecimento !== undefined) nextPayload.conhecimento = String(updates.conhecimento).trim();
    if (updates.agente !== undefined) nextPayload.agente = String(updates.agente).trim();
    if (updates.etachegada !== undefined) nextPayload.etachegada = formatEtaIsoForSave(updates.etachegada);

    return nextPayload;
}

export function filterEtaRecords(records = [], filters = {}) {
    const search = String(filters.search || '').trim().toLowerCase();
    const statusFilter = String(filters.status || '').trim().toLowerCase();
    const statusGroup = String(filters.statusGroup || '').trim().toLowerCase();
    const agenteFilter = String(filters.agente || '').trim().toLowerCase();
    const includeFinished = Boolean(filters.includeFinished);
    const arrivalBucket = String(filters.arrivalBucket || '').trim().toLowerCase();

    return (Array.isArray(records) ? records : []).filter(item => {
        const parsedStatus = parseEtaStatus(item.status);
        const actualStatus = String(parsedStatus.actualStatus || '').trim();
        const statusLower = actualStatus.toLowerCase();

        if (!includeFinished && statusLower === 'finalizado') {
            return false;
        }
        if (statusFilter && statusLower !== statusFilter) {
            return false;
        }
        if (statusGroup === 'awaiting' && !AWAITING_STATUS_SET.has(statusLower)) {
            return false;
        }
        if (statusGroup === 'clearance' && (AWAITING_STATUS_SET.has(statusLower) || CLOSED_STATUS_SET.has(statusLower))) {
            return false;
        }
        if (agenteFilter && String(item.agente || '').trim().toLowerCase() !== agenteFilter) {
            return false;
        }
        if (arrivalBucket) {
            const countdown = getEtaCountdownMeta(item.etachegada, actualStatus);
            if (arrivalBucket === 'due' && countdown.bucket !== 'overdue' && countdown.bucket !== 'today') {
                return false;
            }
            if (arrivalBucket !== 'due' && countdown.bucket !== arrivalBucket) {
                return false;
            }
        }
        if (search) {
            const haystack = [
                item.referencia,
                item.conhecimento,
                item.agente,
                actualStatus
            ].map(v => String(v || '').toLowerCase()).join(' ');
            if (!haystack.includes(search)) {
                return false;
            }
        }
        return true;
    });
}

export function computeEtaStats(records = [], todayRef = new Date()) {
    const list = Array.isArray(records) ? records : [];
    const agents = mergeEtaAgents(list);
    let activeTotal = 0;
    let dueOrOverdue = 0;
    let awaitingArrival = 0;
    let inClearanceOrReady = 0;
    let finishedCount = 0;

    list.forEach(item => {
        const actualStatus = parseEtaStatus(item?.status).actualStatus;
        const statusLower = String(actualStatus || '').trim().toLowerCase();

        if (statusLower === 'finalizado') {
            finishedCount += 1;
            return;
        }
        if (statusLower === 'cancelado') {
            return;
        }

        activeTotal += 1;
        const countdown = getEtaCountdownMeta(item?.etachegada, actualStatus, todayRef);
        if (countdown.bucket === 'overdue' || countdown.bucket === 'today') {
            dueOrOverdue += 1;
        }

        if (AWAITING_STATUS_SET.has(statusLower)) {
            awaitingArrival += 1;
        } else {
            inClearanceOrReady += 1;
        }
    });

    return {
        totalShown: list.length,
        activeTotal,
        dueOrOverdue,
        awaitingArrival,
        inClearanceOrReady,
        finishedCount,
        agents
    };
}

export function sortEtaRecords(records = []) {
    return [...(Array.isArray(records) ? records : [])].sort((a, b) => {
        const da = extractEtaYMD(a?.etachegada) || '9999-99-99';
        const db = extractEtaYMD(b?.etachegada) || '9999-99-99';
        const dateCmp = da.localeCompare(db);
        if (dateCmp !== 0) return dateCmp;
        const refA = String(a?.referencia || '').trim();
        const refB = String(b?.referencia || '').trim();
        const numA = parseInt(refA, 10);
        const numB = parseInt(refB, 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
            return numA - numB;
        }
        return refA.localeCompare(refB, 'pt', { numeric: true });
    });
}
