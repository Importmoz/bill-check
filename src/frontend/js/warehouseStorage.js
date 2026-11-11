/**
 * Lógica pura e centralizada de cálculo e normalização da cobrança de armazém.
 * Mantém uma única fonte de verdade entre a listagem geral, o detalhe do cliente,
 * o recálculo em tempo real e a impressão da Guia Dupla.
 */

/**
 * Normaliza cabeçalhos de colunas para comparação tolerante a acentos, espaços e pontuação.
 */
export function cleanHeaderString(str) {
    return String(str || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, '')
        .trim();
}

/**
 * Localiza o índice de uma coluna no cabeçalho (correspondência exata primeiro, depois parcial).
 * @param {Array} columns
 * @param {Array<string>} targets
 * @param {{ exclude?: Array<string> }} [opts]
 */
export function findWarehouseCol(columns, targets, opts = {}) {
    if (!Array.isArray(columns) || columns.length === 0) return -1;
    const cleanedTargets = targets.map(cleanHeaderString);
    const cleanedExcludes = (opts.exclude || []).map(cleanHeaderString);

    const isExcluded = (col) => {
        if (cleanedExcludes.length === 0) return false;
        const c = cleanHeaderString(col);
        return cleanedExcludes.some(ex => c.includes(ex));
    };

    for (const target of cleanedTargets) {
        const idx = columns.findIndex(c => !isExcluded(c) && cleanHeaderString(c) === target);
        if (idx !== -1) return idx;
    }
    for (const target of cleanedTargets) {
        const idx = columns.findIndex(c => !isExcluded(c) && cleanHeaderString(c).includes(target));
        if (idx !== -1) return idx;
    }
    return -1;
}

/**
 * Formata uma data para YYYY-MM-DD usando o calendário local.
 */
export function formatLocalYMD(dateObj = new Date()) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Faz parsing seguro de datas nos formatos Date, YYYY-MM-DD, ISO, DD/MM/YYYY ou DD-MM-YYYY.
 */
export function parseWarehouseDate(dateStr) {
    if (!dateStr || dateStr === '—' || dateStr === '-' || dateStr === 'Invalid Date') return null;
    if (dateStr instanceof Date) {
        return isNaN(dateStr.getTime()) ? null : dateStr;
    }
    const trimmed = String(dateStr).trim();
    if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed === 'Invalid Date') return null;

    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), 0, 0, 0, 0);
    }

    const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (slashMatch) {
        return new Date(Number(slashMatch[3]), Number(slashMatch[2]) - 1, Number(slashMatch[1]), 0, 0, 0, 0);
    }

    const clean = trimmed.replace(' ', 'T');
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

/**
 * Indica se a data de descarga do projeto foi definida e é válida.
 * Enquanto estiver vazia ou inválida, nenhum preenchimento na aba de Armazém é permitido.
 * @param {string|Date|null|undefined} dischargeDateStr
 * @returns {boolean}
 */
export function hasValidDischargeDate(dischargeDateStr) {
    return parseWarehouseDate(dischargeDateStr) !== null;
}

function parseLocaleMoney(raw) {
    if (raw === undefined || raw === null) return null;
    let clean = String(raw).replace(/(?:MT|MZN)/gi, '').trim();
    if (!clean || clean === '-' || clean === '—') return null;
    if (clean.includes('.') && clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',') && !/^\d{1,3},\d{3}$/.test(clean)) {
        clean = clean.replace(',', '.');
    } else {
        clean = clean.replace(/,/g, '');
    }
    clean = clean.replace(/[^0-9.-]+/g, '');
    if (!clean) return null;
    const parsed = parseFloat(clean);
    return !isNaN(parsed) && parsed >= 0 ? parsed : null;
}

function parseCellFloat(raw) {
    if (raw === undefined || raw === null || raw === '') return 0;
    return parseFloat(String(raw).replace(/[^0-9.-]+/g, '')) || 0;
}

/**
 * Extrai valores numéricos e flags de estado a partir de uma célula de estado e célula de valor.
 */
function parseSheetFeeStrings(statusStr, valueStr) {
    const rawPaid = String(statusStr || '').trim().toUpperCase();
    const storedValueNum = parseLocaleMoney(valueStr);
    const isRawNumericDefault = /^(0|0\.00?|0,00?|-|—)?$/.test(rawPaid);

    let negotiatedAmount = null;
    let partialPaidFromSheet = 0;

    if (!isRawNumericDefault) {
        const partialNegMatch = rawPaid.match(/PARCIAL\s*\(\s*([0-9.,]+)\s*\/\s*([0-9.,]+)\s*(?:MT|MZN)?\s*\)/i);
        if (partialNegMatch) {
            partialPaidFromSheet = parseLocaleMoney(partialNegMatch[1]) || 0;
            negotiatedAmount = parseLocaleMoney(partialNegMatch[2]);
        } else if (rawPaid.includes('PARCIAL')) {
            const partialOnlyMatch = rawPaid.match(/\(\s*([0-9.,]+)\s*(?:MT|MZN)?\s*\)/i)
                || rawPaid.match(/PARCIAL\s*([0-9.,]+)\s*(?:MT|MZN)?/i);
            if (partialOnlyMatch && partialOnlyMatch[1]) {
                partialPaidFromSheet = parseLocaleMoney(partialOnlyMatch[1]) || 0;
            }
        } else {
            const parenMatch = rawPaid.match(/\(\s*([0-9.,]+)\s*(?:MT|MZN)?\s*\)/i);
            if (parenMatch && parenMatch[1]) {
                negotiatedAmount = parseLocaleMoney(parenMatch[1]);
            } else {
                const mtMatch = rawPaid.match(/(?:PAGO|PENDENTE)?\s*([0-9.,]+)\s*(?:MT|MZN)/i);
                if (mtMatch && mtMatch[1]) {
                    negotiatedAmount = parseLocaleMoney(mtMatch[1]);
                }
            }
        }
    }

    const sheetSaysPaid = (
        (rawPaid.includes('PAGO') && !rawPaid.includes('PENDENTE') && !rawPaid.includes('PARCIAL'))
        || rawPaid === 'SIM'
        || rawPaid === 'OK'
        || (rawPaid.includes('SIM') && !rawPaid.includes('NAO') && !rawPaid.includes('PENDENTE') && !rawPaid.includes('PARCIAL'))
    );

    return {
        rawPaid,
        storedValueNum,
        negotiatedAmount,
        partialPaidFromSheet,
        sheetSaysPaid
    };
}

/**
 * Formata o par de células (estado textual e valor numérico da 1.ª linha) para colunas financeiras por cliente.
 */
export function formatFeeSheetStatus({
    isRequested = true,
    isExempt = false,
    isDelivered = false,
    targetCost = 0,
    standardCost = null,
    bankPaidAmount = 0,
    manualStatus = 'NAO',
    zeroCostPendingLabel = 'NAO',
    preferAmountOnPaid = false
} = {}) {
    if (isExempt) {
        return { statusCellVal: 'ISENTO', valueCellVal: 0 };
    }
    if (!isRequested) {
        return { statusCellVal: 'NAO_SOLICITADO', valueCellVal: 0 };
    }
    const costNum = Math.max(0, Number(targetCost) || 0);
    const paidBankNum = Math.max(0, Number(bankPaidAmount) || 0);
    const refStdCost = (typeof standardCost === 'number' && !isNaN(standardCost)) ? standardCost : costNum;
    const isNegotiated = Math.abs(costNum - refStdCost) > 1;
    const manualUpper = String(manualStatus || 'NAO').trim().toUpperCase();
    const isPaid = manualUpper === 'SIM' || (paidBankNum >= costNum - 0.05 && costNum > 0);

    if (costNum === 0) {
        if (paidBankNum > 0) {
            return { statusCellVal: `PAGO (${paidBankNum} MT)`, valueCellVal: paidBankNum };
        }
        return { statusCellVal: isDelivered ? 'LIVRE' : (manualUpper === 'SIM' ? 'SIM' : zeroCostPendingLabel), valueCellVal: 0 };
    }

    if (paidBankNum > 0 && paidBankNum < costNum - 0.05 && manualUpper !== 'SIM') {
        return {
            statusCellVal: isNegotiated
                ? `PARCIAL (${paidBankNum} / ${costNum} MT)`
                : `PARCIAL (${paidBankNum} MT)`,
            valueCellVal: costNum
        };
    }

    if (isPaid) {
        return {
            statusCellVal: (isNegotiated || preferAmountOnPaid) ? `PAGO (${costNum} MT)` : 'SIM',
            valueCellVal: costNum
        };
    }

    return {
        statusCellVal: isNegotiated ? `PENDENTE (${costNum} MT)` : zeroCostPendingLabel,
        valueCellVal: costNum
    };
}

/**
 * Interpreta o estado de pagamento, isenção, negociação e vínculo bancário da armazenagem.
 */
export function parseStorageInfo(
    storagePaidStr,
    calculatedCost,
    motivoIsencaoStr,
    isDelivered = false,
    storageValueStr = '',
    bankPaidAmount = null,
    explicitAgreedCost = null
) {
    const rawPaid = String(storagePaidStr || '').trim().toUpperCase();
    const rawMotivo = String(motivoIsencaoStr || '').trim();
    const calcCost = Math.max(0, Number(calculatedCost) || 0);
    const hasExplicitBankPaid = typeof bankPaidAmount === 'number' && !isNaN(bankPaidAmount) && bankPaidAmount > 0;
    const bankPaidVal = hasExplicitBankPaid ? bankPaidAmount : 0;

    // Preserva entrega extraordinária no mesmo campo sem tratar como isenção de armazenagem
    const isExempt = (!!rawMotivo && !rawMotivo.includes('[EXTRAORDINÁRIA]') && !rawMotivo.includes('[EXTRAORDINARIA]'))
        || rawPaid === 'ISENTO'
        || rawPaid.startsWith('ISENTO');

    if (isExempt) {
        return {
            cost: 0,
            originalCost: calcCost,
            paidAmount: bankPaidVal,
            remainingBalance: 0,
            isExempt: true,
            isNegotiated: false,
            isPaid: true,
            isPartial: false,
            statusText: 'ISENTO'
        };
    }

    const {
        storedValueNum,
        negotiatedAmount,
        partialPaidFromSheet,
        sheetSaysPaid
    } = parseSheetFeeStrings(storagePaidStr, storageValueStr);

    let effectiveCost;
    if (typeof explicitAgreedCost === 'number' && !isNaN(explicitAgreedCost) && explicitAgreedCost >= 0) {
        effectiveCost = explicitAgreedCost;
    } else if (isDelivered && storedValueNum !== null && negotiatedAmount === null) {
        effectiveCost = storedValueNum;
    } else if (negotiatedAmount !== null) {
        effectiveCost = negotiatedAmount;
    } else {
        effectiveCost = calcCost;
    }

    const isNegotiated = Math.abs(effectiveCost - calcCost) > 1;

    let paidAmount = 0;
    let remainingBalance = 0;
    let isPaid = false;
    let isPartial = false;

    if (effectiveCost === 0) {
        paidAmount = bankPaidVal;
        remainingBalance = 0;
        isPaid = true;
        isPartial = false;
    } else if (hasExplicitBankPaid) {
        paidAmount = bankPaidVal;
        remainingBalance = Math.max(0, effectiveCost - paidAmount);
        isPaid = remainingBalance <= 0.05;
        isPartial = !isPaid && paidAmount > 0;
    } else if (rawPaid.includes('PARCIAL')) {
        paidAmount = partialPaidFromSheet;
        remainingBalance = Math.max(0, effectiveCost - paidAmount);
        isPaid = remainingBalance <= 0.05;
        isPartial = !isPaid && paidAmount > 0;
    } else if (sheetSaysPaid) {
        // Se foi marcado como PAGO/SIM manualmente com valor gravado inferior ao acumulado antes da entrega,
        // considerar pago apenas o valor gravado para manter a diferença pendente até clicar em Entregue.
        if (!isDelivered && storedValueNum !== null && storedValueNum > 0 && effectiveCost > storedValueNum + 0.05 && negotiatedAmount === null) {
            paidAmount = storedValueNum;
            remainingBalance = Math.max(0, effectiveCost - paidAmount);
            isPaid = false;
            isPartial = true;
        } else {
            paidAmount = effectiveCost;
            remainingBalance = 0;
            isPaid = true;
            isPartial = false;
        }
    } else if (rawPaid.includes('LIVRE')) {
        isPaid = isDelivered || calcCost === 0;
        paidAmount = isPaid ? effectiveCost : 0;
        remainingBalance = isPaid ? 0 : effectiveCost;
        isPartial = false;
    } else {
        paidAmount = 0;
        remainingBalance = effectiveCost;
        isPaid = false;
        isPartial = false;
    }

    let statusText = 'PENDENTE';
    if (effectiveCost === 0) {
        statusText = 'LIVRE';
    } else if (isPaid) {
        statusText = 'PAGO';
    } else if (isPartial) {
        statusText = 'PARCIAL';
    }

    return {
        cost: effectiveCost,
        originalCost: calcCost,
        paidAmount,
        remainingBalance,
        isExempt: false,
        isNegotiated,
        isPaid,
        isPartial,
        statusText
    };
}

/**
 * Interpreta o estado opcional da Cópia de Despacho (Não Solicitada por defeito;
 * passa a Pendente/Parcial/Pago quando solicitada ou ao vincular pagamento bancário).
 */
export function parseDespachoCopyInfo(
    despachoPaidStr,
    despachoValueStr = '',
    defaultPrice = 500,
    bankPaidAmount = null,
    explicitRequested = null,
    explicitAgreedCost = null
) {
    const baseDefault = Math.max(0, Number(defaultPrice) || 0);
    const hasExplicitBankPaid = typeof bankPaidAmount === 'number' && !isNaN(bankPaidAmount) && bankPaidAmount > 0;
    const bankPaidVal = hasExplicitBankPaid ? bankPaidAmount : 0;

    const {
        rawPaid,
        storedValueNum,
        negotiatedAmount,
        partialPaidFromSheet,
        sheetSaysPaid
    } = parseSheetFeeStrings(despachoPaidStr, despachoValueStr);

    const explicitlyUnrequested = rawPaid === 'NAO_SOLICITADO'
        || rawPaid === 'NAO SOLICITADO'
        || rawPaid === 'OPCIONAL'
        || rawPaid === 'NAO'
        || rawPaid === 'N/A'
        || rawPaid === '-'
        || rawPaid === '—'
        || rawPaid === '';

    let isRequested;
    if (bankPaidVal > 0) {
        isRequested = true;
    } else if (typeof explicitRequested === 'boolean') {
        isRequested = explicitRequested;
    } else if (rawPaid === 'NAO_SOLICITADO' || rawPaid === 'NAO SOLICITADO' || rawPaid === 'OPCIONAL' || rawPaid === 'N/A') {
        isRequested = false;
    } else if (sheetSaysPaid || rawPaid.includes('PARCIAL') || rawPaid.includes('PENDENTE') || rawPaid.includes('SOLICITAD') || negotiatedAmount !== null) {
        isRequested = true;
    } else if (storedValueNum !== null && storedValueNum > 0 && rawPaid === '') {
        isRequested = true;
    } else {
        isRequested = !explicitlyUnrequested;
    }

    if (!isRequested) {
        return {
            isRequested: false,
            defaultPrice: baseDefault,
            cost: 0,
            paidAmount: 0,
            remainingBalance: 0,
            isPaid: false,
            isPartial: false,
            isCustomAmount: false,
            statusText: 'NAO_SOLICITADO'
        };
    }

    let cost;
    if (typeof explicitAgreedCost === 'number' && !isNaN(explicitAgreedCost) && explicitAgreedCost >= 0) {
        cost = explicitAgreedCost;
    } else if (negotiatedAmount !== null) {
        cost = negotiatedAmount;
    } else if (storedValueNum !== null && storedValueNum > 0) {
        cost = storedValueNum;
    } else if (bankPaidVal > baseDefault && storedValueNum === null) {
        cost = bankPaidVal;
    } else {
        cost = baseDefault;
    }

    let paidAmount = 0;
    let remainingBalance = cost;
    let isPaid = false;
    let isPartial = false;

    if (cost === 0 && bankPaidVal === 0) {
        paidAmount = 0;
        remainingBalance = 0;
        isPaid = sheetSaysPaid;
    } else if (hasExplicitBankPaid) {
        paidAmount = bankPaidVal;
        remainingBalance = Math.max(0, cost - paidAmount);
        isPaid = remainingBalance <= 0.05 && cost > 0;
        isPartial = !isPaid && paidAmount > 0;
    } else if (rawPaid.includes('PARCIAL')) {
        paidAmount = partialPaidFromSheet;
        remainingBalance = Math.max(0, cost - paidAmount);
        isPaid = remainingBalance <= 0.05 && cost > 0;
        isPartial = !isPaid && paidAmount > 0;
    } else if (sheetSaysPaid) {
        paidAmount = cost;
        remainingBalance = 0;
        isPaid = true;
    } else {
        paidAmount = 0;
        remainingBalance = cost;
    }

    const statusText = isPaid ? 'PAGO' : (isPartial ? 'PARCIAL' : 'PENDENTE');
    return {
        isRequested: true,
        defaultPrice: baseDefault,
        cost,
        paidAmount,
        remainingBalance,
        isPaid,
        isPartial,
        isCustomAmount: Math.abs(cost - baseDefault) > 0.01,
        statusText
    };
}

/**
 * Calcula toda a lógica de dias, antecipação, tarifa e estado de pagamento de armazém para um cliente.
 * Enquanto o cliente não estiver marcado como ENTREGUE (`DELIVERED === 'SIM'`), a contagem de dias
 * continua até hoje (`todayStr`) e só congela na `deliverDate` após clicar em Entregue.
 */
export function calculateClientStorage({
    rows = [],
    columns = [],
    dischargeDateStr = '',
    bankPayments = null,
    overrides = {}
} = {}) {
    const dutyIdx = findWarehouseCol(columns, ['AMOUNT DUTY', 'AMT DUTY', 'TOTAL DUTY', 'VALOR DUTY', 'DUTY', 'ADUANEIROS'], { exclude: ['FREIGHT'] });
    const dutyPrepaidIdx = findWarehouseCol(columns, ['DUTY PREPAID', 'PREPAID', 'PRE-PAGO']);
    const balanceIdx = findWarehouseCol(columns, ['BALANCE', 'BALANCO', 'SALDO'], { exclude: ['FREIGHT'] });
    const pag1Idx = findWarehouseCol(columns, ['PAG 1', 'PAG1']);
    const pag2Idx = findWarehouseCol(columns, ['PAG 2', 'PAG2']);
    const pag3Idx = findWarehouseCol(columns, ['PAG 3', 'PAG3']);
    const pagIndices = [pag1Idx, pag2Idx, pag3Idx].filter(idx => idx !== -1);

    const deliverDateIdx = findWarehouseCol(columns, ['DELIVER DATE', 'DATA ENTREGA']);
    const storagePaidIdx = findWarehouseCol(columns, ['STORAGE PAID', 'ARMAZENAGEM PAGO', 'STORAGE_PAID']);
    const storageValueIdx = findWarehouseCol(columns, ['STORAGE VALUE', 'VALOR ARMAZENAGEM', 'ARMAZENAGEM VALOR', 'STORAGE_VALUE']);
    const deliveredIdx = findWarehouseCol(columns, ['DELIVERED', 'ENTREGUE', 'STATUS ENTREGA', 'DELIVERY STATUS']);
    const motivoIsencaoIdx = findWarehouseCol(columns, ['MOTIVO ISENCAO ARMAZENAGEM', 'MOTIVO ISENCAO', 'MOTIVO DE ISENCAO']);

    const dDate = parseWarehouseDate(dischargeDateStr);

    let totalDuty = 0;
    let totalPrepaid = 0;
    let totalBalance = 0;
    let hasPaymentAfterDischarge = false;

    rows.forEach(r => {
        const rowData = (r && r.originalRow) ? r.originalRow : (r || []);
        totalDuty += dutyIdx !== -1 ? parseCellFloat(rowData[dutyIdx]) : 0;
        totalPrepaid += dutyPrepaidIdx !== -1 ? parseCellFloat(rowData[dutyPrepaidIdx]) : 0;
        totalBalance += balanceIdx !== -1 ? parseCellFloat(rowData[balanceIdx]) : 0;

        pagIndices.forEach(pIdx => {
            const dateStr = rowData[pIdx];
            if (dateStr && String(dateStr).trim() !== '' && String(dateStr).trim() !== '—') {
                const pDate = parseWarehouseDate(dateStr);
                if (pDate && dDate && pDate.getTime() > dDate.getTime()) {
                    hasPaymentAfterDischarge = true;
                }
            }
        });
    });

    const isFullyPaid = totalBalance <= 1.0;
    const isAnticipated = (totalPrepaid >= totalDuty) || (isFullyPaid && !hasPaymentAfterDischarge);

    const firstRowData = rows[0] ? (rows[0].originalRow || rows[0]) : [];
    const rawDelivered = overrides.isDelivered !== undefined
        ? (overrides.isDelivered ? 'SIM' : 'NAO')
        : (deliveredIdx !== -1 ? String(firstRowData[deliveredIdx] || '').trim().toUpperCase() : 'NAO');
    const isDelivered = (rawDelivered === 'SIM' || rawDelivered === 'ENTREGUE' || rawDelivered === 'YES');

    const rawDeliverDate = overrides.deliverDateVal !== undefined
        ? overrides.deliverDateVal
        : (deliverDateIdx !== -1 ? (firstRowData[deliverDateIdx] || '') : '');
    const cleanDeliverDateStr = (rawDeliverDate && String(rawDeliverDate).trim() !== '—' && String(rawDeliverDate).trim() !== '-')
        ? String(rawDeliverDate).trim()
        : '';

    const todayStr = overrides.todayStr || formatLocalYMD(new Date());
    // Regra crítica: o relógio só para depois que o botão "Entregue" for clicado (DELIVERED === 'SIM')
    const targetEndDateStr = (isDelivered && cleanDeliverDateStr) ? cleanDeliverDateStr : todayStr;
    const targetEndDate = parseWarehouseDate(targetEndDateStr);

    let daysDiff = 0;
    if (dDate && targetEndDate) {
        const utcStart = Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
        const utcEnd = Date.UTC(targetEndDate.getFullYear(), targetEndDate.getMonth(), targetEndDate.getDate());
        daysDiff = Math.max(0, Math.floor((utcEnd - utcStart) / 86400000));
    }

    let standardCost = 0;
    if (dischargeDateStr && dDate) {
        if (isAnticipated) {
            standardCost = daysDiff <= 3 ? 0 : (daysDiff - 3) * 1000;
        } else {
            standardCost = daysDiff <= 3 ? daysDiff * 500 : 1500 + (daysDiff - 3) * 1000;
        }
    }

    const storagePaidVal = overrides.storagePaidVal !== undefined
        ? String(overrides.storagePaidVal || '').trim().toUpperCase()
        : (storagePaidIdx !== -1 ? String(firstRowData[storagePaidIdx] || '').trim().toUpperCase() : 'NAO');
    const storageValueVal = overrides.storageValueVal !== undefined
        ? overrides.storageValueVal
        : (storageValueIdx !== -1 ? (firstRowData[storageValueIdx] ?? '') : '');
    const motivoIsencaoVal = overrides.motivoIsencaoVal !== undefined
        ? String(overrides.motivoIsencaoVal || '').trim()
        : (motivoIsencaoIdx !== -1 ? String(firstRowData[motivoIsencaoIdx] || '').trim() : '');

    const bankPaidAmount = Array.isArray(bankPayments)
        ? bankPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
        : null;

    const storageInfo = parseStorageInfo(
        storagePaidVal,
        standardCost,
        motivoIsencaoVal,
        isDelivered,
        storageValueVal,
        bankPaidAmount,
        overrides.explicitAgreedCost ?? null
    );

    return {
        totalDuty,
        totalPrepaid,
        totalBalance,
        hasPaymentAfterDischarge,
        isAnticipated,
        isDelivered,
        deliverDateStr: cleanDeliverDateStr,
        targetEndDateStr,
        daysDiff,
        standardCost,
        bankPaidAmount: bankPaidAmount || 0,
        storagePaidVal,
        storageValueVal,
        motivoIsencaoVal,
        storageInfo
    };
}

/**
 * Calcula o estado completo e os valores da Cópia de Despacho para um cliente (cobrança fixa e opcional).
 */
export function calculateClientDespachoCopy({
    rows = [],
    columns = [],
    defaultPrice = 500,
    bankPayments = null,
    overrides = {}
} = {}) {
    const despachoStatusIdx = findWarehouseCol(columns, ['COPIA DESPACHO', 'COPIA DE DESPACHO', 'DESPACHO COPY', 'COPIA_DESPACHO']);
    const despachoValueIdx = findWarehouseCol(columns, ['COPIA DESPACHO VALOR', 'VALOR COPIA DESPACHO', 'COPIA DESPACHO VALUE', 'DESPACHO VALUE', 'DESPACHO VALOR']);

    const firstRowData = rows[0] ? (rows[0].originalRow || rows[0]) : [];
    const despachoStatusVal = overrides.despachoStatusVal !== undefined
        ? String(overrides.despachoStatusVal || '').trim().toUpperCase()
        : (despachoStatusIdx !== -1 ? String(firstRowData[despachoStatusIdx] || '').trim().toUpperCase() : '');
    const despachoValueVal = overrides.despachoValueVal !== undefined
        ? overrides.despachoValueVal
        : (despachoValueIdx !== -1 ? (firstRowData[despachoValueIdx] ?? '') : '');

    const bankPaidAmount = Array.isArray(bankPayments)
        ? bankPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
        : null;

    const info = parseDespachoCopyInfo(
        despachoStatusVal,
        despachoValueVal,
        defaultPrice,
        bankPaidAmount,
        overrides.isRequested ?? null,
        overrides.explicitAgreedCost ?? null
    );

    return {
        hasColumns: despachoStatusIdx !== -1 || despachoValueIdx !== -1,
        despachoStatusIdx,
        despachoValueIdx,
        despachoStatusVal,
        despachoValueVal,
        bankPaidAmount: bankPaidAmount || 0,
        ...info
    };
}
