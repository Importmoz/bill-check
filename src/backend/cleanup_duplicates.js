const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io');

async function cleanup() {
    console.log('--- Iniciando Limpeza de Duplicados ---');
    try {
        const records = await pb.collection('bank_incomes').getFullList({
            sort: 'created'
        });
        
        console.log(`Total de registos encontrados: ${records.length}`);
        
        // Agrupar por lógica (Data, Valor, Banco, Descrição sem espaços)
        const groups = {};
        records.forEach(r => {
            const date = r.date.split(' ')[0];
            const amount = Number(r.amount).toFixed(2);
            const bank = Array.isArray(r.bank) ? r.bank[0] : (r.bank || '');
            const desc = r.description.replace(/\s+/g, '').toUpperCase();
            
            const key = `${date}|${amount}|${bank}|${desc}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        
        let deletedCount = 0;
        let preservedCount = 0;
        
        for (const key in groups) {
            const list = groups[key];
            if (list.length > 1) {
                console.log(`\nDuplicado detetado: ${key}`);
                
                // Prioridade: manter o que tem allocated_to ou reconciled=true
                // Se múltiplos tiverem, manter o mais antigo
                list.sort((a, b) => {
                    const scoreA = (a.allocated_to ? 2 : 0) + (a.reconciled ? 1 : 0);
                    const scoreB = (b.allocated_to ? 2 : 0) + (b.reconciled ? 1 : 0);
                    if (scoreA !== scoreB) return scoreB - scoreA;
                    return new Date(a.created) - new Date(b.created);
                });
                
                const toKeep = list[0];
                const toDelete = list.slice(1);
                
                console.log(`  MANTER: ID ${toKeep.id} (Signature: ${toKeep.signature}, Alloc: ${toKeep.allocated_to || 'N/A'})`);
                
                for (const item of toDelete) {
                    if (item.reconciled || item.allocated_to) {
                        console.warn(`  AVISO: Item ${item.id} tem reconciliação mas será ignorado para deleção para evitar perda de dados (Manual Review Required)`);
                        preservedCount++;
                        continue;
                    }
                    
                    console.log(`  APAGAR: ID ${item.id} (Signature: ${item.signature})`);
                    await pb.collection('bank_incomes').delete(item.id);
                    deletedCount++;
                }
            }
        }
        
        console.log(`\n--- Limpeza concluída ---`);
        console.log(`Total apagados: ${deletedCount}`);
        console.log(`Total preservados com aviso: ${preservedCount}`);
        
    } catch (e) {
        console.error('Erro durante a limpeza:', e);
    }
}

cleanup();
