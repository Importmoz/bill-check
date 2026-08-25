/**
 * Módulo de API e Gestão de Estado para Bill Check
 */

const PB_URL = (window.POCKETBASE_CONFIG && window.POCKETBASE_CONFIG.POCKETBASE_URL) || 'https://pocketbase.mycloudspaces.com';

// @ts-ignore - PocketBase carregado via CDN
export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

export function buildSearchFilter(term) {
    if (!term) return '';
    const keywords = term.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const filters = [];
    
    for (let kw of keywords) {
        // Remover aspas externas do bloco principal se existirem
        kw = kw.replace(/^"|"$/g, '').trim();
        if (!kw) continue;
        
        let escapedKw = kw.replace(/"/g, '\\"');
        // Remover acentos para garantir que buscas como 'joão' encontrem 'JOAO'
        let cleanKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let escapedCleanKw = cleanKw.replace(/"/g, '\\"');

        // Advanced Search Prefixes
        let isAdvanced = false;
        const lowerKw = kw.toLowerCase();
        
        const advancedPrefixes = {
            'banco:': 'bank',
            'valor:': 'amount',
            'data:': 'date',
            'ref:': 'reference',
            'desc:': 'description',
            'conta:': 'account_number',
            'titular:': 'account_owner',
            'ordem:': 'order_id'
        };

        for (const [prefix, field] of Object.entries(advancedPrefixes)) {
            if (lowerKw.startsWith(prefix)) {
                let val = kw.substring(prefix.length).trim();
                // Limpar aspas se o utilizador usou desc:"meu texto"
                val = val.replace(/^"|"$/g, '').trim();
                if (!val) continue;

                let cleanVal = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                if (field === 'amount') {
                    let op = '=';
                    let numStr = val;
                    if (val.match(/^(>=|<=|>|<|=)/)) {
                        const match = val.match(/^(>=|<=|>|<|=)(.*)/);
                        op = match[1];
                        numStr = match[2].trim();
                    }
                    
                    let cleanNum = numStr;
                    if (/^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$/.test(numStr)) {
                        cleanNum = numStr.replace(/\./g, '').replace(',', '.');
                    } else if (/^-?\d+(?:,\d+)?$/.test(numStr)) { 
                        cleanNum = numStr.replace(',', '.');
                    }
                    const numVal = parseFloat(cleanNum);
                    if (!isNaN(numVal)) {
                        filters.push(`(${field} ${op} ${numVal})`);
                    }
                } else if (field === 'date') {
                    let searchDate = val;
                    const dateMatch = val.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
                    if (dateMatch) {
                        if (dateMatch[3]) {
                            searchDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
                        } else {
                            searchDate = `-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
                        }
                    }
                    filters.push(`(${field} ~ "${searchDate.replace(/"/g, '\\"')}")`);
                } else {
                    filters.push(`(${field} ~ "${cleanVal.replace(/"/g, '\\"')}")`);
                }
                isAdvanced = true;
                break;
            }
        }

        if (isAdvanced) continue;
        
        // 1. Tratar formato de data dd/mm/yyyy para permitir busca flexível
        let searchDate = escapedKw;
        const dateMatch = kw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
        if (dateMatch) {
            if (dateMatch[3]) {
                searchDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
            } else {
                searchDate = `-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
            }
        }
        
        // Combina colunas, usando a versão sem acentos para maior tolerância!
        let kwFilter = `description ~ "${escapedCleanKw}" || reference ~ "${escapedCleanKw}" || date ~ "${searchDate}" || order_id ~ "${escapedCleanKw}" || account_owner ~ "${escapedCleanKw}" || account_number ~ "${escapedCleanKw}" || bank ~ "${escapedCleanKw}"`;
        
        // 2. Tratar valores monetários pt-BR/pt-PT
        let cleanNum = kw;
        if (/^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$/.test(kw)) {
             cleanNum = kw.replace(/\./g, '').replace(',', '.');
        } else if (/^-?\d+(?:,\d+)?$/.test(kw)) { 
             cleanNum = kw.replace(',', '.');
        }

        const numVal = parseFloat(cleanNum);
        if (!isNaN(numVal) && isFinite(numVal) && String(cleanNum).match(/^-?\d+(\.\d+)?$/)) {
            kwFilter += ` || amount = ${numVal}`;
        }
        
        filters.push(`(${kwFilter})`);
    }
    return filters.join(' && ');
}

// Estado da Aplicação
export const state = {
    tables: [],
    currentTableId: null,
    containers: [],
    balanceRecords: [],
    activeBalance: 0,
    finance: {
        groups: [],
        sheets: [],
        selectedSheets: new Set(),
        expandedGroups: new Set(JSON.parse(localStorage.getItem('finance_expanded_groups') || '[]'))
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
 * Procura pagamentos no PocketBase
 */
export async function searchPayments(bank, amount, term, includeReconciled = false) {
    let conditions = [];
    
    // Se pesquisar por termo ou valor, assumimos que procura um movimento específico e mostramos tudo
    const isSpecificSearch = (term && term.trim() !== '') || (amount && String(amount).trim() !== '');
    
    if (!includeReconciled && !isSpecificSearch) {
        conditions.push(`reconciled != true`);
    }
    
    if (bank) {
        let cleanBank = bank.replace(' BOSS', '').replace(' JUPITER', '').trim();
        conditions.push(`bank ~ "${cleanBank}"`);
    }
    
    if (amount) {
        let cleanAmount = String(amount).trim();
        if (/^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$/.test(cleanAmount)) {
             cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
        } else if (/^-?\d+(?:,\d+)?$/.test(cleanAmount)) { 
             cleanAmount = cleanAmount.replace(',', '.');
        }
        
        const numVal = parseFloat(cleanAmount);
        if (!isNaN(numVal)) {
            conditions.push(`amount = ${numVal}`);
        }
    }
    
    if (term) {
        const termFilter = buildSearchFilter(term);
        if (termFilter) conditions.push(`(${termFilter})`);
    }
    
    const filter = conditions.join(" && ");
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

        // Carregar dados locais do PB para a app funcionar imediatamente
        const pbData = pbRecord.sheet_data;
        state.confirm.data = pbData.values || pbData;
        state.confirm.notes = pbData.notes || [];
        state.confirm.range = pbData.range || 'Folha1!A1:AZ1000';
        if (state.confirm.data && state.confirm.data.length > 0) state.confirm.columns = state.confirm.data[0];

        if (conflictDetected) {
            // Disparar evento global para UI mostrar modal de conflito
            window.dispatchEvent(new CustomEvent('confirmSyncConflict', { 
                detail: { projectId, spreadsheetId, pbRecord }
            }));
            state.confirm.isOfflineMode = true;
        } else {
            console.log("[SYNC] Sincronizando dados pendentes do PocketBase para o GSheet...");
            syncPendingChangesToGSheet().then(() => {
                console.log("[SYNC] Restauro no GSheet concluído com sucesso.");
            }).catch(syncErr => {
                console.warn("[SYNC] GSheet inacessível no arranque. Mantendo modo PocketBase ativo.", syncErr.message);
                state.confirm.isOfflineMode = true;
                window.dispatchEvent(new CustomEvent('confirmModeChanged', { detail: { offline: true, pendingSync: true } }));
            });
        }
        
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

export async function debouncedSyncToPocketBase(forcePending = false) {
    if (!state.confirm.projectId) return;
    
    if (pbSyncTimeout) {
        clearTimeout(pbSyncTimeout);
    }
    
    pbSyncTimeout = setTimeout(async () => {
        try {
            console.log("[SYNC] Guardando alterações no PocketBase...");
            
            const payload = {
                sheet_data: {
                    values: state.confirm.data,
                    notes: state.confirm.notes,
                    range: state.confirm.range
                }
            };
            
            if (forcePending || state.confirm.isOfflineMode || state.confirm.hasPendingSync) {
                payload.has_pending_sync = true;
                state.confirm.hasPendingSync = true;
            }
            
            await pb.collection('confirm_projects').update(state.confirm.projectId, payload);
            console.log("[SYNC] Gravação no PocketBase concluída com sucesso.");
        } catch (e) {
            console.error("[SYNC] Falha ao gravar no PocketBase:", e);
        }
    }, 400);
}

function getColLetterFromIdx(idx) {
    let colLetter = '';
    while (idx >= 0) {
        colLetter = String.fromCharCode(65 + (idx % 26)) + colLetter;
        idx = Math.floor(idx / 26) - 1;
    }
    return colLetter;
}

function getIdxFromColLetter(letter) {
    let idx = 0;
    for (let i = 0; i < letter.length; i++) {
        idx = idx * 26 + (letter.charCodeAt(i) - 65 + 1);
    }
    return idx - 1;
}

function protectGSheetUpdates(updates, isSingleUpdate = false) {
    if (!updates) return updates;
    const items = isSingleUpdate ? [updates] : (Array.isArray(updates) ? updates : [updates]);
    
    const protectedCols = new Set();
    const protectedRows = new Set();
    
    if (state && state.confirm && state.confirm.data && state.confirm.data.length > 0) {
        const headers = state.confirm.columns || state.confirm.data[0] || [];
        headers.forEach((col, idx) => {
            const h = String(col || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            // Fórmulas exatas protegidas: AMOUNT DUTY, BALANCE, AMOUNT FREIGHT, BALANCE FREIGHT
            if (
                (h.includes('AMOUNT') && h.includes('DUTY')) || h === 'VALOR DUTY' || h === 'TOTAL DUTY' ||
                h === 'BALANCE' || h === 'SALDO' || h === 'BALANCO' ||
                (h.includes('AMOUNT') && h.includes('FREIGHT')) || (h.includes('VALOR') && h.includes('FRETE')) ||
                (h.includes('BALANCE') && h.includes('FREIGHT')) || (h.includes('SALDO') && h.includes('FRETE'))
            ) {
                protectedCols.add(getColLetterFromIdx(idx).toUpperCase());
                protectedCols.add(idx);
            }
        });

        state.confirm.data.forEach((row, idx) => {
            if (!row || idx === 0) return;
            const c0 = String(row[0] || '').toUpperCase().trim();
            const c1 = String(row[1] || '').toUpperCase().trim();
            if (c0 === 'TOTAL' || c0 === 'TOTAIS' || c0.startsWith('TOTAL ') || c1 === 'TOTAL') {
                protectedRows.add(idx + 1); // GSheet rows are 1-indexed
            }
        });
    }

    const cleanUpdates = [];

    for (const item of items) {
        if (!item || !item.range) continue;
        const rangeStr = item.range.includes('!') ? item.range.split('!')[1] : item.range;
        const sheetPrefix = item.range.includes('!') ? item.range.split('!')[0] + '!' : '';
        
        const match = rangeStr.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (!match) {
            cleanUpdates.push(item);
            continue;
        }

        const startColStr = match[1].toUpperCase();
        const startRow = parseInt(match[2], 10);
        const endColStr = match[3] ? match[3].toUpperCase() : startColStr;
        const endRow = match[4] ? parseInt(match[4], 10) : startRow;

        // Linha 1 é linha de cabeçalhos (headers) - permitida
        if (startRow === 1 && endRow === 1) {
            cleanUpdates.push(item);
            continue;
        }

        let touchesTotalRow = false;
        for (let r = startRow; r <= endRow; r++) {
            if (protectedRows.has(r)) {
                touchesTotalRow = true;
                break;
            }
        }
        if (touchesTotalRow) {
            console.warn(`[GSHEET-PROTECTED] Bloqueada tentativa de alteração na linha de TOTAL: ${item.range}`);
            continue;
        }

        if (startColStr === endColStr) {
            if (protectedCols.has(startColStr)) {
                console.warn(`[GSHEET-PROTECTED] Bloqueada alteração na coluna com fórmula (${startColStr}): ${item.range}`);
                continue;
            }
            cleanUpdates.push(item);
        } else if (startRow === endRow && Array.isArray(item.values) && item.values[0]) {
            const startColIdx = getIdxFromColLetter(startColStr);
            const valuesRow = item.values[0];
            for (let c = 0; c < valuesRow.length; c++) {
                const currentColIdx = startColIdx + c;
                const currentColLetter = getColLetterFromIdx(currentColIdx).toUpperCase();
                if (protectedCols.has(currentColLetter) || protectedCols.has(currentColIdx)) {
                    console.warn(`[GSHEET-PROTECTED] Pulada coluna com fórmula (${currentColLetter}) ao atualizar linha inteira.`);
                    continue;
                }
                cleanUpdates.push({
                    range: `${sheetPrefix}${currentColLetter}${startRow}`,
                    values: [[valuesRow[c]]]
                });
            }
        } else {
            cleanUpdates.push(item);
        }
    }

    return isSingleUpdate ? (cleanUpdates.length > 0 ? cleanUpdates[0] : null) : cleanUpdates;
}

export async function updateGSheet(spreadsheetId, range, values) {
    const protectedItem = protectGSheetUpdates({ range, values }, true);
    if (!protectedItem) {
        console.warn(`[GSHEET-PROTECTED] Atualização única bloqueada em ${range} para proteger fórmulas/totais.`);
        return { success: true, protected: true };
    }

    try {
        const res = await fetch('/api/google/sheet/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId, range: protectedItem.range, values: protectedItem.values })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Erro ao atualizar GSheet");
        }
        const data = await res.json();
        debouncedSyncToPocketBase(false);
        return data;
    } catch (err) {
        console.warn("[SYNC] GSheet update falhou. Guardando no PocketBase como pendência.", err.message);
        state.confirm.hasPendingSync = true;
        debouncedSyncToPocketBase(true);
        window.dispatchEvent(new CustomEvent('confirmModeChanged', { detail: { offline: true, pendingSync: true } }));
        return { success: true, offline: true, pendingSync: true };
    }
}

export async function updateGSheetBatch(spreadsheetId, dataUpdate) {
    const protectedBatch = protectGSheetUpdates(dataUpdate, false);
    if (!protectedBatch || protectedBatch.length === 0) {
        console.warn(`[GSHEET-PROTECTED] Todos os itens em batch foram bloqueados para proteger fórmulas ou linha de TOTAL.`);
        return { success: true, protected: true };
    }

    try {
        const res = await fetch('/api/google/sheet/batch-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId, data: protectedBatch })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Erro ao atualizar GSheet em lote");
        }
        const responseData = await res.json();
        debouncedSyncToPocketBase(false);
        return responseData;
    } catch (err) {
        console.warn("[SYNC] GSheet batchUpdate falhou. Guardando no PocketBase como pendência.", err.message);
        state.confirm.hasPendingSync = true;
        debouncedSyncToPocketBase(true);
        window.dispatchEvent(new CustomEvent('confirmModeChanged', { detail: { offline: true, pendingSync: true } }));
        return { success: true, offline: true, pendingSync: true };
    }
}

export async function updateGSheetNote(spreadsheetId, sheetName, row, col, note, color = null) {
    if (!state.confirm.notes[row]) state.confirm.notes[row] = [];
    state.confirm.notes[row][col] = note;
    debouncedSyncToPocketBase(false);

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
        return await res.json();
    } catch (err) {
        console.warn("[SYNC] GSheet updateNote falhou. Guardando no PocketBase.", err.message);
        debouncedSyncToPocketBase(true);
        return { success: true, offline: true };
    }
}

export async function syncPendingChangesToGSheet() {
    if (!state.confirm.sheetId) {
        throw new Error("Nenhum projeto Google Sheets ativo.");
    }

    let valuesToSync = state.confirm.data;
    if (state.confirm.projectId) {
        try {
            const pbRec = await pb.collection('confirm_projects').getOne(state.confirm.projectId);
            if (pbRec?.sheet_data?.values) {
                valuesToSync = pbRec.sheet_data.values;
            }
        } catch (e) {
            console.warn("[SYNC-ALL] Usando dados em memória local:", e);
        }
    }

    if (!valuesToSync || valuesToSync.length === 0) {
        throw new Error("Nenhum dado encontrado para sincronizar.");
    }

    let sheetName = 'Folha1';
    if (state.confirm.range && state.confirm.range.includes('!')) {
        sheetName = state.confirm.range.split('!')[0].replace(/'/g, '');
    }

    const batch = [];
    const headers = valuesToSync[0] || [];
    const protectedCols = new Set();
    
    headers.forEach((col, idx) => {
        const h = String(col || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (
            (h.includes('AMOUNT') && h.includes('DUTY')) || h === 'VALOR DUTY' || h === 'TOTAL DUTY' ||
            h === 'BALANCE' || h === 'SALDO' || h === 'BALANCO' ||
            (h.includes('AMOUNT') && h.includes('FREIGHT')) || (h.includes('VALOR') && h.includes('FRETE')) ||
            (h.includes('BALANCE') && h.includes('FREIGHT')) || (h.includes('SALDO') && h.includes('FRETE'))
        ) {
            protectedCols.add(idx);
        }
    });

    for (let r = 1; r < valuesToSync.length; r++) {
        const row = valuesToSync[r];
        if (!row || row.length === 0) continue;
        const c0 = String(row[0] || '').toUpperCase().trim();
        if (c0 === 'TOTAL' || c0 === 'TOTAIS' || c0.startsWith('TOTAL ')) continue;

        const rowNum = r + 1;
        for (let c = 0; c < row.length; c++) {
            if (protectedCols.has(c)) continue;
            const val = row[c];
            if (val !== undefined && val !== null && String(val) !== '') {
                const colLetter = getColLetterFromIdx(c);
                batch.push({
                    range: `${sheetName}!${colLetter}${rowNum}`,
                    values: [[val]]
                });
            }
        }
    }

    if (batch.length === 0) {
        return { success: true, message: "Nenhuma alteração para enviar." };
    }

    const res = await fetch('/api/google/sheet/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: state.confirm.sheetId, data: batch })
    });

    if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Falha ao enviar alterações para o Google Sheets");
    }

    state.confirm.hasPendingSync = false;
    state.confirm.isOfflineMode = false;
    if (state.confirm.projectId) {
        await pb.collection('confirm_projects').update(state.confirm.projectId, {
            has_pending_sync: false,
            last_sync: new Date().toISOString()
        });
    }

    window.dispatchEvent(new CustomEvent('confirmModeChanged', { detail: { offline: false, pendingSync: false } }));
    return { success: true, count: batch.length };
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
    const user = pb.authStore.model;
    if (!user) return [];
    const userId = user.id;
    const isAdmin = user.role === 'ADMIN';

    let tables = [];
    try {
        const filter = isAdmin ? '' : `user_id = "${userId}" || user_id = ""`;
        tables = await pb.collection('tables').getFullList(filter ? { filter, sort: '-created' } : { sort: '-created' });
    } catch (e) {
        tables = await pb.collection('tables').getFullList({ sort: '-created' });
    }

    if (tables.length === 0 && !isAdmin) {
        try {
            tables = await pb.collection('tables').getFullList({ sort: '-created' });
        } catch (e) {}
    }

    const [containers, balance] = await Promise.all([
        pb.collection('containers').getFullList({ sort: 'created' }),
        pb.collection('balance').getFullList({ sort: 'created' })
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
    state.currentTableId = tableId;
    
    const [containers, balance] = await Promise.all([
        pb.collection('containers').getFullList({ filter: `table_id = "${tableId}"`, sort: 'created' }),
        pb.collection('balance').getFullList({ filter: `table_id = "${tableId}"`, sort: 'created' })
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

// --- MÓDULO FINANCE (CONSOLIDATOR VIA CONFIRM PROJECTS) ---

/**
 * Calcula os totais financeiros a partir dos dados do projeto Confirm (sheet_data)
 */
export function calculateConfirmProjectTotals(rowsInput) {
    let rows = [];
    if (typeof rowsInput === 'string') {
        try { rowsInput = JSON.parse(rowsInput); } catch (e) {}
    }
    if (Array.isArray(rowsInput)) {
        rows = rowsInput;
    } else if (rowsInput && Array.isArray(rowsInput.values)) {
        rows = rowsInput.values;
    }
    if (!rows || rows.length === 0) {
        return { dutyPrepaid: 0, amountDuty: 0, paid: 0, balance: 0 };
    }

    const columns = rows[0].map(c => String(c || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
    const findCol = (targets) => {
        for (const target of targets) {
            const idx = columns.findIndex(c => c === target || c.includes(target));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const dutyIdx = findCol(['AMOUNT DUTY', 'DUTY', 'TOTAL DUTY', 'VALOR DUTY']);
    const dutyPrepaidIdx = findCol(['DUTY PREPAID', 'PREPAID']);
    const balanceIdx = findCol(['BALANCE', 'BALANCO', 'SALDO']);
    const paidIdx = columns.findIndex((c, i) => {
        return (c.includes('PAID') || c.includes('PAGO')) && !c.includes('PREPAID') && !c.includes('DUTY') && i !== dutyIdx;
    });

    const parseVal = (val) => {
        if (!val) return 0;
        return parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
    };

    let totalDuty = 0;
    let totalPrepaid = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    let foundValidRows = false;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const rowString = row.slice(0, 10).map(c => String(c || '').toUpperCase()).join(' ');
        if (rowString.includes('TOTAL')) continue;
        
        const dutyVal = dutyIdx !== -1 ? parseVal(row[dutyIdx]) : 0;
        const prepaidVal = dutyPrepaidIdx !== -1 ? parseVal(row[dutyPrepaidIdx]) : 0;
        const paidVal = paidIdx !== -1 ? parseVal(row[paidIdx]) : 0;
        const balanceVal = balanceIdx !== -1 ? parseVal(row[balanceIdx]) : 0;

        if (dutyVal || prepaidVal || paidVal || balanceVal) {
            foundValidRows = true;
        }
        totalDuty += dutyVal;
        totalPrepaid += prepaidVal;
        totalPaid += paidVal;
        totalBalance += balanceVal;
    }

    // Fallback caso a tabela não tenha linhas de clientes parseadas mas possua uma linha TOTAL
    if (!foundValidRows) {
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const rowString = row.map(c => String(c || '').toUpperCase()).join(' ');
            if (rowString.includes('TOTAL')) {
                totalDuty = dutyIdx !== -1 ? parseVal(row[dutyIdx]) : 0;
                totalPrepaid = dutyPrepaidIdx !== -1 ? parseVal(row[dutyPrepaidIdx]) : 0;
                totalPaid = paidIdx !== -1 ? parseVal(row[paidIdx]) : 0;
                totalBalance = balanceIdx !== -1 ? parseVal(row[balanceIdx]) : 0;
                break;
            }
        }
    }

    return {
        dutyPrepaid: totalPrepaid,
        amountDuty: totalDuty,
        paid: totalPaid,
        balance: totalBalance
    };
}

/**
 * Carrega todos os grupos financeiros e consolida automaticamente a partir do backend ou confirm_projects
 */
export async function fetchFinanceData(forceRefresh = false) {
    const userId = pb.authStore.model?.id;

    // 1. Tentar primeiro o endpoint rápido e otimizado do backend (/api/finance/consolidated)
    try {
        const cRes = await fetch(`/api/finance/consolidated${forceRefresh ? '?refresh=1' : ''}`);
        if (cRes.ok) {
            const consolidated = await cRes.json();
            if (consolidated && Array.isArray(consolidated.sheets) && consolidated.sheets.length > 0) {
                const localHidden = JSON.parse(localStorage.getItem('finance_hidden_projects') || '[]');
                const localGroupMapping = JSON.parse(localStorage.getItem('finance_project_groups') || '{}');

                state.finance.groups = consolidated.groups || [];
                state.finance.sheets = consolidated.sheets
                    .filter(s => !localHidden.includes(s.id))
                    .map(s => ({
                        ...s,
                        groupId: localGroupMapping[s.id] || (s.sheetId && localGroupMapping[s.sheetId]) || s.groupId
                    }));
                return { groups: state.finance.groups, sheets: state.finance.sheets };
            }
        }
    } catch (cErr) {
        console.warn("[FINANCE] Falha ao consultar /api/finance/consolidated, usando fallback:", cErr);
    }

    // 2. Fallback direto ao PocketBase e ao Estado Local
    let pbGroups = [];
    try {
        if (userId) {
            pbGroups = await pb.collection('groups').getFullList({ filter: `user_id = "${userId}"`, sort: 'order' });
        }
        if (!pbGroups || pbGroups.length === 0) {
            pbGroups = await pb.collection('groups').getFullList({ sort: 'order' });
        }
    } catch (e) {
        console.warn("[FINANCE] Falha ao carregar grupos do PocketBase:", e);
    }

    let serverConfig = { groups: [], groupMapping: {}, hiddenProjects: [] };
    try {
        const sRes = await fetch('/api/finance/state');
        if (sRes.ok) {
            serverConfig = await sRes.json();
        }
    } catch (sErr) {}

    let groups = [];
    if (pbGroups && pbGroups.length > 0) {
        groups = pbGroups;
    } else if (serverConfig.groups && serverConfig.groups.length > 0) {
        groups = serverConfig.groups;
    }

    let confirmProjects = [];
    try {
        confirmProjects = await pb.collection('confirm_projects').getFullList({
            batch: 15,
            sort: '-created'
        });
    } catch (e) {
        console.warn("[FINANCE] Falha no fallback confirm_projects:", e);
    }

    const localHidden = JSON.parse(localStorage.getItem('finance_hidden_projects') || '[]');
    const hiddenProjects = Array.from(new Set([...(serverConfig.hiddenProjects || []), ...localHidden]));

    const localGroupMapping = JSON.parse(localStorage.getItem('finance_project_groups') || '{}');
    const groupMapping = { ...(serverConfig.groupMapping || {}), ...localGroupMapping };
    localStorage.setItem('finance_project_groups', JSON.stringify(groupMapping));

    const sheets = confirmProjects
        .filter(p => !hiddenProjects.includes(p.id))
        .map(p => {
            const totals = calculateConfirmProjectTotals(p.sheet_data);
            const groupId = p.groupId || p.group_id || groupMapping[p.id] || (p.sheetId && groupMapping[p.sheetId]) || null;
            return {
                id: p.id,
                title: p.name || "Projeto Sem Nome",
                sourceUrl: p.sheetId ? `https://docs.google.com/spreadsheets/d/${p.sheetId}/edit` : "#",
                sheetId: p.sheetId,
                folderId: p.folderId,
                groupId: groupId,
                dutyPrepaid: totals.dutyPrepaid,
                amountDuty: totals.amountDuty,
                paid: totals.paid,
                balance: totals.balance,
                lastUpdated: p.updated || p.created || new Date().toISOString(),
                isConfirmProject: true
            };
        });

    state.finance.groups = groups;
    state.finance.sheets = sheets;
    return { groups, sheets };
}

export async function createFinanceGroup(name) {
    const maxOrder = state.finance.groups.length > 0 ? Math.max(...state.finance.groups.map(g => g.order || 0)) : 0;
    let newGroup = null;
    try {
        newGroup = await pb.collection('groups').create({ 
            name, 
            order: maxOrder + 100, 
            user_id: pb.authStore.model?.id || '' 
        });
    } catch (e) {
        console.warn("[FINANCE] Falha ao gravar grupo no PocketBase, criando localmente:", e);
        newGroup = {
            id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: name,
            order: maxOrder + 100
        };
    }

    state.finance.groups.push(newGroup);
    // Sincronizar com o backend
    try {
        await fetch('/api/finance/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groups: state.finance.groups })
        });
    } catch (e) {}

    return newGroup;
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

    groupA.order = orderB;
    groupB.order = orderA;

    groups[index] = groupB;
    groups[targetIndex] = groupA;

    try {
        await Promise.all([
            pb.collection('groups').update(groupA.id, { order: orderB }),
            pb.collection('groups').update(groupB.id, { order: orderA })
        ]);
    } catch (e) {
        console.warn("[FINANCE] Falha ao atualizar ordem de grupos no PB:", e);
    }

    try {
        await fetch('/api/finance/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groups: state.finance.groups })
        });
    } catch (e) {}
}

export async function deleteFinanceGroup(groupId) {
    const affected = state.finance.sheets.filter(s => s.groupId === groupId);
    const groupMapping = JSON.parse(localStorage.getItem('finance_project_groups') || '{}');
    
    for (const sheet of affected) {
        delete groupMapping[sheet.id];
        if (sheet.sheetId) delete groupMapping[sheet.sheetId];
        sheet.groupId = null;
        try {
            await pb.collection('confirm_projects').update(sheet.id, { group_id: null, groupId: null });
        } catch (e) {}
        try {
            await fetch('/api/finance/group-mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: sheet.id, sheetId: sheet.sheetId, groupId: null })
            });
        } catch (e) {}
    }
    localStorage.setItem('finance_project_groups', JSON.stringify(groupMapping));

    state.finance.groups = state.finance.groups.filter(g => g.id !== groupId);

    try {
        await pb.collection('groups').delete(groupId);
    } catch (e) {
        console.warn("[FINANCE] Falha ao apagar grupo no PB:", e);
    }

    try {
        await fetch('/api/finance/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groups: state.finance.groups })
        });
    } catch (e) {}

    return { success: true };
}

export async function saveFinanceSheet(data, id = null) {
    if (!id) return null;
    const item = state.finance.sheets.find(s => s.id === id);
    const sheetId = item ? item.sheetId : null;

    const groupMapping = JSON.parse(localStorage.getItem('finance_project_groups') || '{}');
    const targetGroupId = data.groupId || null;

    if (!targetGroupId) {
        delete groupMapping[id];
        if (sheetId) delete groupMapping[sheetId];
    } else {
        groupMapping[id] = targetGroupId;
        if (sheetId) groupMapping[sheetId] = targetGroupId;
    }
    localStorage.setItem('finance_project_groups', JSON.stringify(groupMapping));

    // 1. Sincronizar com o backend do servidor (persistência permanente)
    try {
        await fetch('/api/finance/group-mapping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: id, sheetId: sheetId, groupId: targetGroupId })
        });
    } catch (sErr) {
        console.warn("[FINANCE] Falha ao salvar mapeamento no backend:", sErr);
    }

    // 2. Tentar atualizar no PocketBase
    try {
        await pb.collection('confirm_projects').update(id, { group_id: targetGroupId, groupId: targetGroupId });
    } catch (e) {
        // Fallback se PocketBase não aceitar ambos os campos
        try {
            await pb.collection('confirm_projects').update(id, { group_id: targetGroupId });
        } catch (e2) {
            try {
                await pb.collection('confirm_projects').update(id, { groupId: targetGroupId });
            } catch (e3) {
                console.warn("[FINANCE] PocketBase não possui coluna de grupo no confirm_projects. Persistido no servidor e local.");
            }
        }
    }

    if (item) item.groupId = targetGroupId;
    return item;
}

export async function saveBulkFinanceSheets(sheetIds, targetGroupId = null) {
    if (!Array.isArray(sheetIds) || sheetIds.length === 0) return [];
    
    const groupMapping = JSON.parse(localStorage.getItem('finance_project_groups') || '{}');
    const backendMappings = [];
    const updatedItems = [];

    for (const id of sheetIds) {
        const item = state.finance.sheets.find(s => s.id === id);
        const sheetId = item ? item.sheetId : null;

        if (!targetGroupId) {
            delete groupMapping[id];
            if (sheetId) delete groupMapping[sheetId];
        } else {
            groupMapping[id] = targetGroupId;
            if (sheetId) groupMapping[sheetId] = targetGroupId;
        }

        backendMappings.push({
            projectId: id,
            sheetId: sheetId,
            groupId: targetGroupId
        });

        if (item) {
            item.groupId = targetGroupId;
            updatedItems.push(item);
        }

        // Tentar atualizar no PocketBase em background
        pb.collection('confirm_projects').update(id, { group_id: targetGroupId, groupId: targetGroupId })
            .catch(() => {
                pb.collection('confirm_projects').update(id, { group_id: targetGroupId })
                    .catch(() => {
                        pb.collection('confirm_projects').update(id, { groupId: targetGroupId }).catch(() => {});
                    });
            });
    }

    localStorage.setItem('finance_project_groups', JSON.stringify(groupMapping));

    // Sincronizar com o backend em um único request
    try {
        await fetch('/api/finance/group-mapping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings: backendMappings })
        });
    } catch (sErr) {
        console.warn("[FINANCE] Falha ao salvar lote no backend:", sErr);
    }

    return updatedItems;
}

export async function deleteFinanceSheet(id) {
    const item = state.finance.sheets.find(s => s.id === id);
    const hiddenProjects = JSON.parse(localStorage.getItem('finance_hidden_projects') || '[]');
    if (!hiddenProjects.includes(id)) {
        hiddenProjects.push(id);
        localStorage.setItem('finance_hidden_projects', JSON.stringify(hiddenProjects));
    }

    try {
        await fetch('/api/finance/hidden-projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hiddenProjects })
        });
    } catch (e) {}

    state.finance.sheets = state.finance.sheets.filter(s => s.id !== id);
    return { success: true, hidden: true };
}

/**
 * Motor de Extração Legado (Mantido como utilitário de reserva)
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
    const user = pb.authStore.model;
    if (!user) return [];
    const userId = user.id;
    const isAdmin = user.role === 'ADMIN';

    let tables = [];
    try {
        const filter = isAdmin ? '' : `user_id = "${userId}" || user_id = ""`;
        tables = await pb.collection('team_tables').getFullList(filter ? { filter, sort: '-created' } : { sort: '-created' });
    } catch (e) {
        tables = await pb.collection('team_tables').getFullList({ sort: '-created' });
    }

    if (tables.length === 0 && !isAdmin) {
        try {
            tables = await pb.collection('team_tables').getFullList({ sort: '-created' });
        } catch (e) {}
    }

    state.team.tables = tables;
    return tables;
}

/**
 * Carrega dados de um relatório de equipe específico
 */
export async function fetchTeamTableData(tableId) {
    state.team.currentTableId = tableId;
    
    const [groups, records] = await Promise.all([
        pb.collection('team_groups').getFullList({ 
            filter: `table_id = "${tableId}"`, 
            sort: 'created' 
        }),
        pb.collection('team_records').getFullList({ 
            filter: `table_id = "${tableId}"`, 
            sort: 'created' 
        })
    ]);
    console.log("[TEAM] Groups found:", groups.length, "Records found:", records.length);

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
        const user = pb.authStore.model;
        if (!user) return [];
        const userId = user.id;
        const isAdmin = user.role === 'ADMIN';

        let tables = [];
        try {
            const filter = isAdmin ? '' : `user_id = "${userId}" || user_id = ""`;
            tables = await pb.collection('term_v2_tables').getFullList(filter ? { filter, sort: '-created' } : { sort: '-created' });
        } catch (e) {
            tables = await pb.collection('term_v2_tables').getFullList({ sort: '-created' });
        }

        if (tables.length === 0 && !isAdmin) {
            try {
                tables = await pb.collection('term_v2_tables').getFullList({ sort: '-created' });
            } catch (e) {}
        }

        state.term.tables = tables;
        return tables;
    } catch (err) {
        if (err.status === 404) {
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
        state.term.currentTableId = tableId;
        
        const records = await pb.collection('term_v2_records').getFullList({ 
            filter: `table_id = "${tableId}"`, 
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

// --- MÓDULO DE CÂMBIO API ---

export async function listCambios() {
    try {
        const records = await pb.collection('cambio').getFullList({
            sort: 'moeda',
        });
        return records;
    } catch (err) {
        console.error("[CAMBIO API] Falha ao aceder ao PocketBase:", err);
        return [];
    }
}

// --- MÓDULO DE COTAÇÕES (QUOTE) API ---

export async function listQuotes() {
    try {
        // Tentar obter do PocketBase
        const records = await pb.collection('quotes').getFullList({
            sort: '-created',
            expand: 'client_ref',
            requestKey: null
        });
        
        // Normalizar
        const normalized = records.map(r => ({
            id: r.id,
            collectionId: r.collectionId || 'quotes',
            collectionName: r.collectionName || 'quotes',
            client_ref: r.client_ref,
            client_data: r.expand?.client_ref || null,
            client_name: r.client_name,
            cargo_description: r.cargo_description,
            type: r.type,
            status: r.status,
            quote_number: r.quote_number,
            date: r.date,
            total_amount: r.total_amount,
            anexo: r.anexo || r.attachment || r.documento || null,
            attachment: r.anexo || r.attachment || r.documento || null,
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
    
    let number = quoteData.quote_number;
    if (!number) {
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear()).slice(-2);
        const prefix = `${dd}`;
        const suffix = `/${mm}/${yy}`;
        
        let highestCode = 64; 
        
        if (state.quotes && state.quotes.length > 0) {
            state.quotes.forEach(q => {
                const qn = q.quote_number || '';
                if (qn.startsWith(prefix) && qn.endsWith(suffix)) {
                    const letterStr = qn.substring(prefix.length, qn.length - suffix.length);
                    if (letterStr.length === 1) {
                        const code = letterStr.charCodeAt(0);
                        if (code > highestCode && code <= 90) { 
                            highestCode = code;
                        }
                    }
                }
            });
        }
        
        let nextLetter = String.fromCharCode(highestCode + 1);
        if (highestCode === 64) nextLetter = 'A';
        else if (highestCode >= 90) nextLetter = 'Z';
        
        number = `${prefix}${nextLetter}${suffix}`;
    }
    
    // Preparar objeto
    const normalizedQuote = {
        id: quoteData.id,
        client_name: quoteData.client_name || '',
        cargo_description: quoteData.cargo_description || '',
        type: quoteData.type || 'TRANSPORTE',
        status: quoteData.status || 'RASCUNHO',
        quote_number: number,
        date: quoteData.date || now.toISOString().split('T')[0],
        total_amount: Number(quoteData.total_amount) || 0,
        issuer: quoteData.issuer || '',
        payload: quoteData.payload || {},
        created: quoteData.created
    };

    try {
        // Tentar gravar no PocketBase usando FormData para suportar upload de ficheiros
        let savedRecord;
        const formData = new FormData();
        
        formData.append('client_name', normalizedQuote.client_name);
        formData.append('cargo_description', normalizedQuote.cargo_description);
        formData.append('type', normalizedQuote.type);
        formData.append('status', normalizedQuote.status);
        formData.append('quote_number', normalizedQuote.quote_number);
        formData.append('date', normalizedQuote.date);
        formData.append('total_amount', normalizedQuote.total_amount);
        formData.append('payload', JSON.stringify(normalizedQuote.payload));

        if (quoteData.pendingAttachment) {
            // Pode ser 'anexo', 'documento', ou 'attachment' dependendo do seu PocketBase
            formData.append('anexo', quoteData.pendingAttachment);
        }

        if (isNew || normalizedQuote.id.startsWith('local_')) {
            savedRecord = await pb.collection('quotes').create(formData);
        } else {
            savedRecord = await pb.collection('quotes').update(normalizedQuote.id, formData);
        }
        
        normalizedQuote.id = savedRecord.id;
        normalizedQuote.created = savedRecord.created;
        normalizedQuote.collectionId = savedRecord.collectionId || 'quotes';
        normalizedQuote.collectionName = savedRecord.collectionName || 'quotes';
        
        // Se a gravação devolver o nome do ficheiro (ex: savedRecord.anexo), 
        // guardamos na normalizedQuote para poder ser usado pelo loadSavedQuote
        if (savedRecord.anexo || savedRecord.attachment || savedRecord.documento) {
            const fName = savedRecord.anexo || savedRecord.attachment || savedRecord.documento;
            normalizedQuote.anexo = fName;
            normalizedQuote.attachment = fName;
        }
        
        updateLocalQuotesCache(normalizedQuote);
        return savedRecord; // Return the actual DB record so ui.js can extract .anexo
    } catch (err) {
        console.warn("[QUOTE API] Falha ao gravar no PocketBase:", err);
        // Se for um erro de validação (ex: campo não existe), devemos avisar o utilizador
        if (err.status >= 400 && err.status < 500) {
            throw err;
        }
        console.warn("Gravando localmente como fallback...");
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

export async function getAllClients() {
    try {
        const records = await pb.collection('quotes_clients').getFullList({
            sort: '-created',
        });
        
        // Filter out duplicates by name or nuit
        const uniqueClients = [];
        const seen = new Set();
        
        for (const record of records) {
            const key = (record.name || '').trim().toLowerCase() + '|' + (record.nuit || '').trim();
            if (key !== '|' && !seen.has(key)) {
                seen.add(key);
                uniqueClients.push(record);
            }
        }
        
        return uniqueClients;
    } catch (err) {
        console.error("[QUOTE CLIENT API] Erro ao obter lista de clientes:", err);
        return [];
    }
}

export async function getQuoteClient(quoteId) {
    try {
        const quote = await pb.collection('quotes').getOne(quoteId, { expand: 'client_ref' });
        return quote.expand?.client_ref || null;
    } catch (err) {
        console.warn("[QUOTE CLIENT API] Não foi possível obter o cliente ou a cotação não existe:", err);
        return null;
    }
}

export async function saveQuoteClient(quoteId, clientData) {
    try {
        const quote = await pb.collection('quotes').getOne(quoteId);
        
        let clientRecord;
        if (quote.client_ref) {
            // Update existing client record
            clientRecord = await pb.collection('quotes_clients').update(quote.client_ref, clientData);
        } else {
            // Create new client record
            clientRecord = await pb.collection('quotes_clients').create(clientData);
            // Link it to the quote
            await pb.collection('quotes').update(quoteId, { client_ref: clientRecord.id, client_name: clientData.name || quote.client_name });
        }
        
        return clientRecord;
    } catch (err) {
        console.error("[QUOTE CLIENT API] Erro ao gravar cliente da cotação:", err);
        throw err;
    }
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
    console.log("[PAUTA API] Pauta.json já não é descarregado para o frontend (migrado para backend).");
    return [];
}

export async function searchPauta(query, limit = 50) {
    if (!query) return [];
    try {
        const res = await fetch(`/api/pauta/search?q=${encodeURIComponent(query)}&limit=${limit}`);
        if (!res.ok) throw new Error('API não retornou sucesso.');
        
        // Para precaver que Live Server não envie HTML de erro
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await res.json();
        } else {
            throw new Error('A resposta da API não é JSON válido.');
        }
    } catch (err) {
        console.warn('[PAUTA API] Backend falhou ou não existe. A ativar modo Fallback (Offline/Live Server)...');
        
        if (!state.pauta) {
            try {
                const response = await fetch('data/pauta.json');
                if (response.ok) {
                    state.pauta = await response.json();
                } else {
                    return [];
                }
            } catch (e) {
                return [];
            }
        }
        
        const term = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const results = state.pauta.filter(item => {
            const desc = (item.description || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const code = (item.code || '').toLowerCase();
            return desc.includes(term) || code.includes(term);
        });
        return results.slice(0, limit);
    }
}
