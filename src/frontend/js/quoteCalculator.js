/**
 * Quote Calculator Engine
 * Este módulo isola a lógica de negócio do cálculo de impostos, totais e rateios do módulo Quote.
 */

export function getRateFromPauta(pautaItem, nameFragments) {
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

export function parseTaxPart(part, resultObj) {
    if (part.includes('%')) {
        resultObj.adValorem = parseFloat(part.replace('%', '')) / 100;
    } else if (part.includes(' per ')) {
        const parts = part.split(' per ');
        const amountStr = parts[0].trim();
        const unitStr = parts[1].trim();
        const match = amountStr.match(/([0-9.]+)/);
        if (match) {
            resultObj.specificAmount = parseFloat(match[1]);
        }
        resultObj.specificUnit = unitStr.toUpperCase();
    }
}

export function getComplexRateFromPauta(pautaItem, nameFragments) {
    if (!pautaItem || !pautaItem.duties) return null;
    const duty = pautaItem.duties.find(d => {
        const dutyName = (d['Nome da Taxa'] || d['Taxa Description'] || '').toLowerCase();
        return nameFragments.some(frag => dutyName.includes(frag.toLowerCase()));
    });
    if (!duty) return null;
    const rateStr = (duty['Taxa'] || duty['Value'] || '0').toLowerCase();
    
    let result = { adValorem: 0, specificAmount: 0, specificUnit: '', operator: 'none', raw: rateStr };

    if (rateStr.includes(' or ')) {
        result.operator = 'or';
        const parts = rateStr.split(' or ');
        parts.forEach(p => parseTaxPart(p.trim(), result));
    } else {
        parseTaxPart(rateStr, result);
    }
    
    return result;
}

/**
 * calculateInvoice
 * Recebe o estado do Quote (moeda, câmbio, lista de itens, frete global, seguro global, outros globais)
 * Retorna um objeto com os itens atualizados e os totais calculados.
 */
export function calculateInvoice(quoteState, globais) {
    const excRate = quoteState.exchangeRate || 64.00;
    
    const globalFrt = globais.freight === '' || globais.freight == null ? null : parseFloat(globais.freight);
    const globalIns = globais.insurance === '' || globais.insurance == null ? null : parseFloat(globais.insurance);
    const globalOth = globais.others === '' || globais.others == null ? null : parseFloat(globais.others);

    let grandTotalFob = 0;
    
    // Calcula o FOB por item para usar no rateio
    const updatedItems = quoteState.items.map(item => {
        const fob = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
        grandTotalFob += fob;
        return { ...item, fob };
    });

    let tFob = 0, tFrt = 0, tIns = 0, tOth = 0;
    let tCifMzn = 0, tDaMzn = 0, tIceMzn = 0, tIvaMzn = 0, tTsaMzn = 0;

    const computedItems = updatedItems.map(item => {
        const ratio = grandTotalFob > 0 ? (item.fob / grandTotalFob) : 0;
        
        let frt = globalFrt !== null ? (globalFrt * ratio) : (item.fob * 0.10);
        let ins = globalIns !== null ? (globalIns * ratio) : ((item.fob + frt) * 0.02);
        let oth = globalOth !== null ? (globalOth * ratio) : 0;
        
        const cifForeign = item.fob + frt + ins + oth;
        const cifMzn = cifForeign * excRate;
        
        const daRate = item.pauta ? getRateFromPauta(item.pauta, ['Direitos', 'Aduaneiros']) : 0;
        const tsaRate = item.pauta ? getRateFromPauta(item.pauta, ['Sobretaxa']) : 0;
        const ivaRate = item.pauta ? getRateFromPauta(item.pauta, ['IVA', 'Valor Acrescentado']) : 0;
        
        const hsPrefix = (item.hsCode || '').substring(0, 4);
        const isAlcohol = ['2203', '2204', '2205', '2206', '2208'].includes(hsPrefix);
        const isSugar = hsPrefix === '2202';

        let iceData = item.pauta ? getComplexRateFromPauta(item.pauta, ['consumo', 'ice']) : null;
        
        // Fallbacks manuais (regra de negócio)
        if (!iceData) {
            if (isAlcohol) {
                let fbTax = 455;
                if (hsPrefix === '2203') fbTax = 423;
                else if (hsPrefix === '2204') fbTax = 610;
                iceData = { adValorem: 0, specificAmount: fbTax, specificUnit: 'L', operator: 'none', raw: fbTax + ' MT / Alc 100%' };
            } else if (isSugar) {
                iceData = { adValorem: 0, specificAmount: 0.0133, specificUnit: 'L', operator: 'none', raw: '0.0133 MT / gr' };
            }
        }
        
        let iceAdValorem = 0;
        let iceSpecific = 0;
        let appliedIceRateLabel = '0%';
        let iceValue = 0;

        if (iceData) {
            iceAdValorem = cifMzn * iceData.adValorem;
            const qFis = parseFloat(String(item.qtyFisica).replace(',', '.')) || 0;
            const alcPct = parseFloat(String(item.iceAlcoholPercent).replace(',', '.')) || 0;
            const sugGr = parseFloat(String(item.iceSugarGrams).replace(',', '.')) || 0;

            iceSpecific = qFis * iceData.specificAmount;
            
            if (isAlcohol) {
                iceSpecific = iceData.specificAmount * qFis * (alcPct / 100);
            } else if (isSugar) {
                iceSpecific = iceData.specificAmount * sugGr * 10 * qFis;
            }

            if (iceData.operator === 'or') {
                iceValue = Math.max(iceAdValorem, iceSpecific);
                appliedIceRateLabel = iceAdValorem > iceSpecific 
                    ? `${parseFloat((iceData.adValorem*100).toFixed(2))}%` 
                    : `${iceData.specificAmount} MT/${iceData.specificUnit}`;
            } else {
                iceValue = iceSpecific || iceAdValorem;
                appliedIceRateLabel = iceSpecific > 0 
                    ? (isAlcohol ? `${iceData.specificAmount} MT/Alc100%` : (isSugar ? `${iceData.specificAmount} MT/gr` : `${iceData.specificAmount} MT/${iceData.specificUnit}`)) 
                    : `${parseFloat((iceData.adValorem*100).toFixed(2))}%`;
            }
        }

        const daValue = cifMzn * daRate;
        const tsaValue = cifMzn * tsaRate;
        const ivaBase = cifMzn + daValue + iceValue + tsaValue;
        const ivaValue = ivaBase * ivaRate;

        tFob += item.fob;
        tFrt += frt;
        tIns += ins;
        tOth += oth;
        tCifMzn += cifMzn;
        tDaMzn += daValue;
        tIceMzn += iceValue;
        tTsaMzn += tsaValue;
        tIvaMzn += ivaValue;

        return {
            ...item,
            actualFreight: frt,
            actualInsurance: ins,
            actualOthers: oth,
            cifMzn,
            daValue,
            tsaValue,
            iceValue,
            iceLabel: appliedIceRateLabel,
            ivaValue,
            daRate,
            tsaRate,
            ivaRate
        };
    });

    let mcnetUsd = 0;
    if (tFob < 500) {
        mcnetUsd = 5;
    } else if (tFob >= 500 && tFob <= 10000) {
        mcnetUsd = 24;
    } else if (tFob > 10000 && tFob <= 50000) {
        mcnetUsd = 64;
    } else if (tFob > 50000) {
        mcnetUsd = tFob * 0.0085;
    }
    const tMcnetMzn = mcnetUsd * excRate;
    const tsaFixedMzn = 1000;

    const grandTotal = tCifMzn + tDaMzn + tIceMzn + tIvaMzn + tTsaMzn + tMcnetMzn + tsaFixedMzn;

    const computedTotals = {
        fobForeign: tFob, 
        freightForeign: tFrt, 
        insForeign: tIns, 
        othForeign: tOth,
        cifMzn: tCifMzn, 
        daMzn: tDaMzn, 
        iceMzn: tIceMzn, 
        ivaMzn: tIvaMzn, 
        tsaMzn: tTsaMzn, 
        mcnetMzn: tMcnetMzn, 
        tsaFixedMzn: tsaFixedMzn,
        grandTotalMzn: grandTotal
    };

    return {
        items: computedItems,
        totals: computedTotals
    };
}
