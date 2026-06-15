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
        projectId: '',
        sheetId: localStorage.getItem('confirm_sheet_id') || '',
        data: [],
        columns: [],
        driveFiles: [],
        isOfflineMode: false,
        hasPendingSync: false
    },
    bank: {
        incomes: []
    },
    quotes: [],
    quotesSource: 'local',
    pauta: null
};

/**
 * Processa um extrato bancário no servidor
 */
export async function uploadBankStatement(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/bank/upload', {
        method: 'POST',
        body: formData
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao processar extrato");
    }

    return await res.json();
}

/**
 * Gera uma assinatura única determinística para um movimento bancário
 * Suporta contextos HTTP e HTTPS
 */
async function buildSignature(record) {
    // Se o parser já enviou uma assinatura SHA-256, usamos essa para garantir consistência total
    if (record.signature && !record.signature.startsWith('fallback_')) {
        return record.signature;
    }

    const bankVal = Array.isArray(record.bank) ? record.bank[0] : record.bank;
    const bank = (bankVal || '').trim();
    const date = String(record.date || '').split(' ')[0]; // YYYY-MM-DD
    const amount = Number(record.amount).toFixed(2);
    const balance = Number(record.balance).toFixed(2);
    const reference = (record.reference || '').trim();
    const description = (record.description || '')
        .replace(/\s+/g, '')
        .toUpperCase();
    
    const raw = `${bank}|${date}|${amount}|${balance}|${reference}|${description}`;
    
    // Fallback se crypto.subtle não estiver disponível (HTTP)
    if (!crypto.subtle) {
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            const char = raw.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // Converter para unsigned 32-bit inteiro
        return "fallback_" + (hash >>> 0).toString(16);
    }

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Grava uma entrada bancária no PocketBase (com verificação manual de duplicados)
 */
export async function saveBankIncome(data) {
    try {
        const signature = await buildSignature(data);
        
        // 1. Verificação manual para evitar duplicação (caso a base de dados não tenha índice Unique configurado)
        const existing = await pb.collection('bank_incomes').getFullList({
            filter: `signature = "${signature}"`,
            requestKey: null
        });
        
        if (existing && existing.length > 0) {
            console.warn('[BANK] Duplicado detetado (pesquisa prévia ignorando):', data.description);
            return existing[0];
        }

        // 2. Tentar inserir
        const payload = { ...data, signature };
        return await pb.collection('bank_incomes').create(payload);
    } catch (e) {
        // Fallback: PocketBase returns 422 for unique index violations
        if (e.status === 422 && e?.data?.signature?.code === 'unique') {
            console.warn('[BANK] Duplicado detetado via índice da BD:', data.description);
            const sig = await buildSignature(data);
            const existing = await pb.collection('bank_incomes').getFullList({
                filter: `signature = "${sig}"`,
                requestKey: null
            });
            return existing[0];
        }
        console.error('[BANK] Unexpected error while saving:', e);
        throw e;
    }
}

/**
 * Lista entradas bancárias do PocketBase
 */
export async function listBankIncomes(filter = '', perPage = 5000) {
    const options = {
        sort: '-date',
        requestKey: null // Allow multiple concurrent requests if needed
    };
    if (filter && filter.trim() !== '') {
        options.filter = filter;
    }
    const result = await pb.collection('bank_incomes').getList(1, perPage, options);
    
    // Normalizar dados (PocketBase pode retornar campos de seleção como arrays)
    const normalized = result.items.map(item => ({
        ...item,
        bank: Array.isArray(item.bank) ? item.bank[0] : (item.bank || 'UNKNOWN')
    }));

    state.bank.incomes = normalized;
    return normalized;
}

/**
 * Procura pagamentos não reconciliados no PocketBase
 */
export async function searchPayments(bank, amount, term) {
    let filter = `reconciled != true`;
    
    if (bank) {
        filter += ` && bank ~ "${bank}"`;
    }
    
    if (amount && !isNaN(parseFloat(amount))) {
        filter += ` && amount = ${parseFloat(amount)}`;
    }
    
    if (term) {
        const keywords = term.split(/\s+/).filter(k => k.trim().length > 0);
        for (const kw of keywords) {
            let kwFilter = `description ~ "${kw}" || reference ~ "${kw}" || date ~ "${kw}"`;
            if (!isNaN(parseFloat(kw))) {
                kwFilter += ` || amount = ${parseFloat(kw)}`;
            }
            filter += ` && (${kwFilter})`;
        }
    }
    
    return await listBankIncomes(filter, 100);
}

export async function getPaymentsByAllocatedTo(allocatedTo) {
    try {
        const filter = `allocated_to = "${allocatedTo.replace(/"/g, '\\"')}"`;
        const res = await pb.collection('bank_incomes').getFullList({ filter });
        return res;
    } catch (e) {
        console.error("Erro ao buscar pagamentos alocados:", e);
        return [];
    }
}

/**
 * Marca um pagamento como reconciliado ou faz o split se o valor for parcial
 */
export async function markPaymentReconciled(id, combinedInfo, allocatedAmount = null) {
    // 1. Obter o pagamento original
    const original = await pb.collection('bank_incomes').getOne(id);
    const totalAmount = parseFloat(original.amount);
    const amountToUse = allocatedAmount !== null ? parseFloat(allocatedAmount) : totalAmount;

    // Gerar ou recuperar a Master Reference
    let masterRef = original.reference || "";
    if (!masterRef.includes("(Ref Mestre:")) {
        masterRef = (masterRef ? masterRef + " " : "") + `(Ref Mestre: ${original.id})`;
    }

    if (amountToUse < totalAmount) {
        // --- CENÁRIO DE SPLIT ---
        
        // A. Criar um NOVO registo para a parte reconciliada
        const splitData = {
            date: original.date,
            description: original.description,
            reference: masterRef,
            amount: amountToUse,
            balance: original.balance, // Mantemos o mesmo balance do extrato para a assinatura
            type: original.type || "",
            bank: Array.isArray(original.bank) ? original.bank[0] : (original.bank || ""),
            reconciled: true,
            allocated_to: combinedInfo,
            account_owner: original.account_owner || "",
            account_number: original.account_number || "",
            order_id: original.order_id || ""
        };
        
        // Gerar nova assinatura para o split
        const baseSig = await buildSignature(splitData);
        // Garantir que a assinatura do split é absolutamente única anexando um sufixo aleatório.
        // Isto evita colisões (erro 400 validation_not_unique) se o mesmo movimento for dividido múltiplas vezes.
        splitData.signature = `${baseSig}_split_${Math.random().toString(36).substring(2, 11)}`;
        
        await pb.collection('bank_incomes').create(splitData);

        // B. Atualizar o ORIGINAL com o valor restante e nova assinatura
        const remainingAmount = totalAmount - amountToUse;
        const updatedOriginal = {
            amount: remainingAmount,
            reference: masterRef,
            reconciled: false,
            allocated_to: ""
        };
        
        // NÃO recalculamos a assinatura do original. A assinatura deve ser imutável para evitar 
        // duplicações se o extrato for carregado novamente.

        return await pb.collection('bank_incomes').update(original.id, updatedOriginal);
    } else {
        // --- CENÁRIO NORMAL (TOTAL) ---
        const update = { 
            reconciled: true, 
            allocated_to: combinedInfo,
            reference: masterRef
        };
        
        // NÃO atualizamos a assinatura para manter a impressão digital original do extrato.

        return await pb.collection('bank_incomes').update(id, update);
    }
}

export async function getPaymentsByMasterRef(masterRef) {
    try {
        if (!masterRef || !masterRef.includes("(Ref Mestre:")) return [];
        const filter = `reference ~ "${masterRef.replace(/"/g, '\\"')}"`;
        return await pb.collection('bank_incomes').getFullList({ filter });
    } catch (e) {
        console.error("Erro ao buscar pagamentos por Ref Mestre:", e);
        return [];
    }
}


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

export async function readGSheet(projectRecord, range = 'A1:AZ1000', skipModifiedTimeCheck = false) {
    const spreadsheetId = typeof projectRecord === 'string' ? projectRecord : projectRecord?.sheetId;
    const projectId = typeof projectRecord === 'object' ? projectRecord?.id : (state.confirm.projectId || null);
    
    if (projectId) state.confirm.projectId = projectId;
    state.confirm.sheetId = spreadsheetId;
    state.confirm.isOfflineMode = false;
    
    let hasPendingSync = false;
    let pbRecord = null;
    
    if (projectId) {
        try {
            pbRecord = await pb.collection('confirm_projects').getOne(projectId);
            hasPendingSync = pbRecord.has_pending_sync === true;
            state.confirm.hasPendingSync = hasPendingSync;
            console.log(`[SYNC] Projeto carregado do PB. has_pending_sync = ${hasPendingSync}`);
        } catch (e) {
            console.warn("[SYNC] Erro ao carregar projeto do PocketBase:", e);
        }
    }

    // Fluxo de Sincronização Pendente (Prioridade ao PocketBase)
    if (hasPendingSync && pbRecord?.sheet_data) {
        console.log("[SYNC] Alterações offline detetadas. Verificando conflitos com Google Sheets...");
        let conflictDetected = false;
        
        try {
            // Verificar data de modificação no Google
            const updateCheckRes = await fetch('/api/google/sheet/check-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spreadsheetId })
            });
            
            if (updateCheckRes.ok) {
                const checkData = await updateCheckRes.json();
                const gsheetModifiedTime = checkData.modifiedTime ? new Date(checkData.modifiedTime).getTime() : 0;
                const pbLastSync = pbRecord.last_sync ? new Date(pbRecord.last_sync).getTime() : 0;
                
                // Tolerância de 10 segundos
                if (gsheetModifiedTime > (pbLastSync + 10000)) {
                    console.warn(`[SYNC] CONFLITO! GSheet modificado externamente (${new Date(gsheetModifiedTime)}) depois da última sync (${new Date(pbLastSync)}).`);
                    conflictDetected = true;
                }
            }
        } catch (err) {
            console.log("[SYNC] GSheet ainda está inacessível durante tentativa de verificação.");
            // Mantemos em modo offline
        }

        if (conflictDetected) {
            // Disparar evento global para UI mostrar modal de conflito
            window.dispatchEvent(new CustomEvent('confirmSyncConflict', { 
                detail: { projectId, spreadsheetId, pbRecord }
            }));
            state.confirm.isOfflineMode = true;
        } else {
            console.log("[SYNC] Restaurando dados do PocketBase para o GSheet...");
            try {
                // Tenta restaurar o GSheet
                const restoreData = pbRecord.sheet_data.values || pbRecord.sheet_data;
                await fetch('/api/google/sheet/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ spreadsheetId, range: 'A1', values: restoreData })
                });
                console.log("[SYNC] Restauro no GSheet com sucesso. Limpando pending_sync...");
                await pb.collection('confirm_projects').update(projectId, { has_pending_sync: false });
                state.confirm.hasPendingSync = false;
            } catch (restoreErr) {
                console.error("[SYNC] Falha ao restaurar GSheet. Mantendo modo offline.", restoreErr);
                state.confirm.isOfflineMode = true;
            }
        }

        // Carregar dados locais do PB para a app funcionar
        const pbData = pbRecord.sheet_data;
        state.confirm.data = pbData.values || pbData;
        state.confirm.notes = pbData.notes || [];
        state.confirm.range = pbData.range || 'Folha1!A1:AZ1000';
        if (state.confirm.data && state.confirm.data.length > 0) state.confirm.columns = state.confirm.data[0];
        
        window.dispatchEvent(new CustomEvent('confirmModeChanged', { detail: { offline: state.confirm.isOfflineMode } }));
        return state.confirm.data;
    }

    // Fluxo Normal (Prioridade ao Google Sheets)
    try {
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
        state.confirm.data = data.values || data;
        state.confirm.notes = data.notes || [];
        state.confirm.range = data.range || 'Folha1!A1:AZ1000';
        if (state.confirm.data && state.confirm.data.length > 0) state.confirm.columns = state.confirm.data[0];

        // Atualizar PocketBase com snapshot mais recente
        if (projectId) {
            try {
                await pb.collection('confirm_projects').update(projectId, {
                    sheet_data: {
                        values: state.confirm.data,
                        notes: state.confirm.notes,
                        range: state.confirm.range
                    },
                    last_sync: new Date().toISOString(),
                    has_pending_sync: false
                });
                console.log("[SYNC] Backup do GSheet guardado no PocketBase.");
            } catch (pbErr) {
                console.warn("[SYNC] Erro ao guardar snapshot no PocketBase:", pbErr);
            }
        }

        // Buscar data de modificação inicial da planilha
        if (!skipModifiedTimeCheck) {
            try {
                const updateCheckRes = await fetch('/api/google/sheet/check-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ spreadsheetId })
                });
                if (updateCheckRes.ok) {
                    const updateCheckData = await updateCheckRes.json();
                    state.confirm.lastModifiedTime = updateCheckData.modifiedTime;
                    console.log(`[API] Guardado lastModifiedTime inicial: ${state.confirm.lastModifiedTime}`);
                }
            } catch (checkErr) {
                console.warn("[API] Erro ao obter data de modificação inicial:", checkErr);
            }
        }

        window.dispatchEvent(new CustomEvent('confirmModeChanged', { detail: { offline: false } }));
        return state.confirm.data;

    } catch (gsheetErr) {
        console.error("[SYNC] GSheet inacessível:", gsheetErr);
        // Fallback para PocketBase
        if (pbRecord && pbRecord.sheet_data) {
            console.log("[SYNC] Fallback: Carregando dados do PocketBase (Modo Offline ativado).");
            state.confirm.isOfflineMode = true;
            const pbData = pbRecord.sheet_data;
            state.confirm.data = pbData.values || pbData;
            state.confirm.notes = pbData.notes || [];
            state.confirm.range = pbData.range || 'Folha1!A1:AZ1000';
            if (state.confirm.data && state.confirm.data.length > 0) state.confirm.columns = state.confirm.data[0];
            
            window.dispatchEvent(new CustomEvent('confirmModeChanged', { detail: { offline: true } }));
            return state.confirm.data;
        } else {
            throw new Error("GSheet inacessível e nenhum backup encontrado no PocketBase.");
        }
    }
}

let pbSyncTimeout = null;

async function debouncedSyncToPocketBase() {
    if (!state.confirm.projectId) return;
    
    if (pbSyncTimeout) {
        clearTimeout(pbSyncTimeout);
    }
    
    pbSyncTimeout = setTimeout(async () => {
        try {
            console.log("[SYNC] Guardando alterações pendentes no PocketBase...");
            
            const payload = {
                sheet_data: {
                    values: state.confirm.data,
                    notes: state.confirm.notes,
                    range: state.confirm.range
                }
            };
            
            if (state.confirm.isOfflineMode) {
                payload.has_pending_sync = true;
                state.confirm.hasPendingSync = true;
            }
            
            await pb.collection('confirm_projects').update(state.confirm.projectId, payload);
            console.log("[SYNC] Gravação no PocketBase concluída com sucesso.");
        } catch (e) {
            console.error("[SYNC] Falha ao gravar no PocketBase:", e);
        }
    }, 3000);
}

export async function updateGSheet(spreadsheetId, range, values) {
    if (state.confirm.isOfflineMode) {
        console.log("[SYNC] Modo offline ativo. Ignorando chamada ao GSheet e guardando localmente.");
        debouncedSyncToPocketBase();
        return { success: true, offline: true };
    }

    try {
        const res = await fetch('/api/google/sheet/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId, range, values })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Erro ao atualizar GSheet");
        }
        const data = await res.json();
        debouncedSyncToPocketBase();
        return data;
    } catch (err) {
        console.warn("[SYNC] GSheet update failed. Ativando Modo Offline.", err);
        state.confirm.isOfflineMode = true;
        window.dispatchEvent(new CustomEvent('confirmModeChanged', { detail: { offline: true } }));
        debouncedSyncToPocketBase();
        return { success: true, offline: true };
    }
}

export async function updateGSheetBatch(spreadsheetId, dataUpdate) {
    if (state.confirm.isOfflineMode) {
        console.log("[SYNC] Modo offline ativo. Ignorando batchUpdate ao GSheet e guardando localmente.");
        debouncedSyncToPocketBase();
        return { success: true, offline: true };
    }

    try {
        const res = await fetch('/api/google/sheet/batch-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId, data: dataUpdate })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Erro ao atualizar GSheet em lote");
        }
        const responseData = await res.json();
        debouncedSyncToPocketBase();
        return responseData;
    } catch (err) {
        console.warn("[SYNC] GSheet batchUpdate failed. Ativando Modo Offline.", err);
        state.confirm.isOfflineMode = true;
        window.dispatchEvent(new CustomEvent('confirmModeChanged', { detail: { offline: true } }));
        debouncedSyncToPocketBase();
        return { success: true, offline: true };
    }
}

export async function updateGSheetNote(spreadsheetId, sheetName, row, col, note, color = null) {
    if (state.confirm.isOfflineMode) {
        console.log("[SYNC] Modo offline ativo. Ignorando updateNote ao GSheet e guardando localmente.");
        // Atualizar estado em memória
        if (!state.confirm.notes[row]) state.confirm.notes[row] = [];
        state.confirm.notes[row][col] = note;
        debouncedSyncToPocketBase();
        return { success: true, offline: true };
    }

    try {
        const res = await fetch('/api/google/sheet/update-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId, sheetName, row, col, note, color })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Erro ao atualizar nota no GSheet");
        }
        const data = await res.json();
        
        if (!state.confirm.notes[row]) state.confirm.notes[row] = [];
        state.confirm.notes[row][col] = note;
        debouncedSyncToPocketBase();
        
        return data;
    } catch (err) {
        console.warn("[SYNC] GSheet updateNote failed. Ativando Modo Offline.", err);
        state.confirm.isOfflineMode = true;
        window.dispatchEvent(new CustomEvent('confirmModeChanged', { detail: { offline: true } }));
        if (!state.confirm.notes[row]) state.confirm.notes[row] = [];
        state.confirm.notes[row][col] = note;
        debouncedSyncToPocketBase();
        return { success: true, offline: true };
    }
}

// --- REALTIME EVENTOS (CONFIRM) ---
let confirmUnsubscribe = null;

export async function emitConfirmEvent(sheetId, rowIndex, type, payload = {}) {
    if (!pb.authStore.model) {
        console.warn("[SSE-FASE-1][EMISSÃO-WARN] Tentativa de emitir evento sem estar autenticado.");
        return;
    }
    try {
        console.log(`[SSE-FASE-1][EMISSÃO] Emitindo evento '${type}' para linha ${rowIndex} no GSheet: ${sheetId}`, payload);
        await pb.collection('confirm_events').create({
            sheet_id: sheetId,
            row_index: rowIndex,
            type: type,
            payload: payload,
            user: pb.authStore.model.id
        });
        console.log(`[SSE-FASE-1][SUCESSO] Evento '${type}' gravado no PocketBase com sucesso para a linha ${rowIndex}.`);
    } catch (err) {
        console.error("[SSE-FASE-1][ERRO] Erro ao criar evento no PocketBase:", err);
    }
}

export async function getRecentConfirmEvents(sheetId) {
    if (!pb.authStore.model) {
        console.warn("[PocketBase Realtime] Tentativa de obter eventos recentes sem estar autenticado.");
        return [];
    }
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const filter = `sheet_id = "${sheetId}" && created >= "${fiveMinutesAgo}"`;
    try {
        console.log("[PocketBase Realtime] Procurando locks/eventos recentes com filtro:", filter);
        const list = await pb.collection('confirm_events').getFullList({
            filter: filter,
            sort: 'created'
        });
        console.log("[PocketBase Realtime] Eventos recentes encontrados:", list.length);
        return list;
    } catch (err) {
        console.error("[PocketBase Realtime] Erro ao obter eventos recentes:", err);
        return [];
    }
}

export async function subscribeConfirmEvents(sheetId, callback) {
    if (confirmUnsubscribe) {
        console.log("[SSE-FASE-2][RE-SUBSCRIÇÃO] Cancelando subscrição anterior antes de subscrever novamente...");
        await unsubscribeConfirmEvents();
    }
    
    const filter = `sheet_id = "${sheetId}"`;
    console.log(`[SSE-FASE-2][CONEXÃO] Iniciando subscrição SSE no PocketBase para o GSheet: ${sheetId}`);
    try {
        confirmUnsubscribe = await pb.collection('confirm_events').subscribe('*', function (e) {
            console.log(`[SSE-FASE-3][RECEÇÃO-SSE] Evento '${e.action}' recebido do PocketBase:`, e.record);
            if (e.record.sheet_id === sheetId) {
                console.log(`[SSE-FASE-3][PROCESSAR] O evento pertence ao GSheet atual (${sheetId}). Enviando para o callback do frontend...`);
                callback(e);
            } else {
                console.log(`[SSE-FASE-3][DESCARTE] Evento descartado (sheet_id do evento [${e.record.sheet_id}] diferente do atual [${sheetId}])`);
            }
        }, { filter });
        console.log("[SSE-FASE-2][SUCESSO] Subscrição em tempo real efetuada com sucesso!");
    } catch (err) {
        console.error("[SSE-FASE-2][ERRO] Falha ao conectar ao SSE do PocketBase:", err);
    }
}

export async function unsubscribeConfirmEvents() {
    if (confirmUnsubscribe) {
        console.log("[SSE-FASE-2][CANCELAR-SUBSCRIÇÃO] Cancelando subscrição ativa...");
        try {
            await pb.collection('confirm_events').unsubscribe('*');
            confirmUnsubscribe = null;
            console.log("[SSE-FASE-2][SUCESSO] Subscrição cancelada com sucesso.");
        } catch (err) {
            console.error("[SSE-FASE-2][ERRO] Erro ao cancelar subscrição:", err);
        }
    }
}

// --- REALTIME EVENTOS BANCO (bank_incomes) ---
let bankUnsubscribe = null;

export async function subscribeBankEvents(callback) {
    if (bankUnsubscribe) {
        console.log("[SSE-BANCO][RE-SUBSCRIÇÃO] Cancelando subscrição de banco anterior...");
        await unsubscribeBankEvents();
    }
    
    console.log("[SSE-BANCO][CONEXÃO] Iniciando subscrição SSE no PocketBase para extratos (bank_incomes)");
    try {
        bankUnsubscribe = await pb.collection('bank_incomes').subscribe('*', function (e) {
            console.log(`[SSE-BANCO][RECEÇÃO] Evento de banco '${e.action}':`, e.record);
            callback(e);
        });
        console.log("[SSE-BANCO][SUCESSO] Subscrição de banco em tempo real efetuada!");
    } catch (err) {
        console.error("[SSE-BANCO][ERRO] Falha ao conectar ao SSE de banco:", err);
    }
}

export async function unsubscribeBankEvents() {
    if (bankUnsubscribe) {
        console.log("[SSE-BANCO][CANCELAR] Cancelando subscrição de banco ativa...");
        try {
            await pb.collection('bank_incomes').unsubscribe('*');
            bankUnsubscribe = null;
            console.log("[SSE-BANCO][SUCESSO] Subscrição de banco cancelada.");
        } catch (err) {
            console.error("[SSE-BANCO][ERRO] Erro ao cancelar subscrição de banco:", err);
        }
    }
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
    const userId = pb.authStore.model?.id;
    if (!userId) return [];

    const [tables, containers, balance] = await Promise.all([
        pb.collection('tables').getFullList({ filter: `user_id = "${userId}"`, sort: '-created' }),
        pb.collection('containers').getFullList({ filter: `user_id = "${userId}"`, sort: 'created' }),
        pb.collection('balance').getFullList({ filter: `user_id = "${userId}"`, sort: 'created' })
    ]);
    
    console.log(`[API] Tabelas encontradas: ${tables.length}, Contentores: ${containers.length}, Balanços: ${balance.length}`);

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
    state.containers = containers;
    state.balanceRecords = balance;
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
    const userId = pb.authStore.model?.id;
    if (!userId) return { groups: [], sheets: [] };

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

// --- MÓDULO DEFINIÇÕES (USERS) ---

export async function getSettingsUsers() {
    if (pb.authStore.model?.role !== 'ADMIN') throw new Error("Acesso negado.");
    return await pb.collection('users').getFullList({
        sort: '-created',
    });
}

export async function createSettingsUser(data) {
    if (pb.authStore.model?.role !== 'ADMIN') throw new Error("Acesso negado.");
    data.passwordConfirm = data.password;
    data.emailVisibility = true;
    return await pb.collection('users').create(data);
}

export async function updateSettingsUser(id, data) {
    if (pb.authStore.model?.role !== 'ADMIN') throw new Error("Acesso negado.");
    if (data.password) {
        data.passwordConfirm = data.password;
    }
    return await pb.collection('users').update(id, data);
}

export async function deleteSettingsUser(id) {
    if (pb.authStore.model?.role !== 'ADMIN') throw new Error("Acesso negado.");
    return await pb.collection('users').delete(id);
}

// --- MÓDULO DE COTAÇÕES (QUOTE) API ---

export async function listQuotes() {
    try {
        // Tentar obter do PocketBase
        const records = await pb.collection('quotes').getFullList({
            sort: '-created',
            requestKey: null
        });
        
        // Normalizar
        const normalized = records.map(r => ({
            id: r.id,
            client_name: r.client_name,
            cargo_description: r.cargo_description,
            type: r.type,
            status: r.status,
            quote_number: r.quote_number,
            date: r.date,
            total_amount: r.total_amount,
            payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
            created: r.created
        }));
        
        state.quotes = normalized;
        state.quotesSource = 'pocketbase';
        return normalized;
    } catch (err) {
        console.warn("[QUOTE API] Falha ao aceder ao PocketBase, usando localStorage:", err);
        // Fallback para localStorage
        const localData = localStorage.getItem('quotes');
        const parsed = localData ? JSON.parse(localData) : [];
        state.quotes = parsed;
        state.quotesSource = 'local';
        return parsed;
    }
}

export async function saveQuote(quoteData) {
    // Garantir ID e número de cotação se novos
    const isNew = !quoteData.id;
    const now = new Date();
    
    if (isNew) {
        quoteData.id = 'local_' + Math.random().toString(36).substr(2, 9);
        quoteData.created = now.toISOString();
    }
    
    // Preparar objeto
    const normalizedQuote = {
        id: quoteData.id,
        client_name: quoteData.client_name || '',
        cargo_description: quoteData.cargo_description || '',
        type: quoteData.type || 'TRANSPORTE',
        status: quoteData.status || 'RASCUNHO',
        quote_number: quoteData.quote_number || '',
        date: quoteData.date || now.toISOString().split('T')[0],
        total_amount: Number(quoteData.total_amount) || 0,
        payload: quoteData.payload || {},
        created: quoteData.created
    };

    try {
        // Tentar gravar no PocketBase
        let savedRecord;
        const pbPayload = {
            client_name: normalizedQuote.client_name,
            cargo_description: normalizedQuote.cargo_description,
            type: normalizedQuote.type,
            status: normalizedQuote.status,
            quote_number: normalizedQuote.quote_number,
            date: normalizedQuote.date,
            total_amount: normalizedQuote.total_amount,
            payload: JSON.stringify(normalizedQuote.payload)
        };

        if (isNew || normalizedQuote.id.startsWith('local_')) {
            savedRecord = await pb.collection('quotes').create(pbPayload);
        } else {
            savedRecord = await pb.collection('quotes').update(normalizedQuote.id, pbPayload);
        }
        
        normalizedQuote.id = savedRecord.id;
        normalizedQuote.created = savedRecord.created;
        
        updateLocalQuotesCache(normalizedQuote);
        return normalizedQuote;
    } catch (err) {
        console.warn("[QUOTE API] Falha ao gravar no PocketBase, gravando localmente:", err);
        updateLocalQuotesCache(normalizedQuote);
        return normalizedQuote;
    }
}

function updateLocalQuotesCache(quote) {
    const localData = localStorage.getItem('quotes');
    let list = localData ? JSON.parse(localData) : [];
    
    const idx = list.findIndex(q => q.id === quote.id);
    if (idx !== -1) {
        list[idx] = quote;
    } else {
        list.unshift(quote);
    }
    localStorage.setItem('quotes', JSON.stringify(list));
}

export async function deleteQuote(id) {
    try {
        await pb.collection('quotes').delete(id);
        state.quotes = state.quotes.filter(q => q.id !== id);
        return true;
    } catch (err) {
        console.warn("[QUOTE API] Falha ao apagar no PocketBase, apagando localmente:", err);
        const localData = localStorage.getItem('quotes');
        if (localData) {
            let list = JSON.parse(localData);
            list = list.filter(q => q.id !== id);
            localStorage.setItem('quotes', JSON.stringify(list));
        }
        state.quotes = state.quotes.filter(q => q.id !== id);
        return true;
    }
}

// --- MÓDULO PAUTA (SIMULADOR) ---

export async function loadPautaData() {
    if (state.pauta) return state.pauta;
    
    try {
        console.log("[PAUTA API] Carregando dados da pauta...");
        const response = await fetch('data/pauta.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        state.pauta = data;
        console.log(`[PAUTA API] Pauta carregada com ${data.length} registos.`);
        return data;
    } catch (error) {
        console.error("[PAUTA API] Erro ao carregar pauta.json:", error);
        throw error;
    }
}

export function searchPauta(query, limit = 50) {
    if (!state.pauta) return [];
    if (!query) return state.pauta.slice(0, limit);

    const term = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const results = state.pauta.filter(item => {
        const desc = (item.description || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const code = (item.code || '').toLowerCase();
        return desc.includes(term) || code.includes(term);
    });

    return results.slice(0, limit);
}
