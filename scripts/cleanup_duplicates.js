const PocketBase = require('pocketbase').default;

// URL do servidor (conforme api.js)
const PB_URL = 'http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io';
const pb = new PocketBase(PB_URL);

async function runCleanup(email, password) {
    console.log("A autenticar...");
    try {
        await pb.collection('users').authWithPassword(email, password);
        console.log("Autenticado com sucesso!");
    } catch (e) {
        console.error("Erro na autenticação. Verifique as credenciais.");
        return;
    }

    console.log("A transferir todos os pagamentos...");
    const records = await pb.collection('bank_incomes').getFullList({
        sort: '+created', // Os mais antigos primeiro
    });

    console.log(`Total de registos encontrados: ${records.length}`);

    // Agrupar por chave: Data + Banco + Descrição + Número da Conta
    const groups = {};
    for (const record of records) {
        // Limpar a data para agrupar (apenas YYYY-MM-DD)
        const dateRaw = String(record.date || '').split(' ')[0];
        const desc = String(record.description || '').replace(/\s+/g, '').toUpperCase();
        const bank = Array.isArray(record.bank) ? record.bank[0] : record.bank;
        const acc = record.account_number || '';

        const key = `${dateRaw}|${bank}|${acc}|${desc}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(record);
    }

    let toDelete = [];

    // Analisar cada grupo
    for (const [key, group] of Object.entries(groups)) {
        if (group.length > 1) {
            // Separar processados (conciliados ou com allocated_to) e não-processados
            const processed = group.filter(r => r.reconciled === true || (r.allocated_to && r.allocated_to.trim() !== ''));
            const unprocessed = group.filter(r => r.reconciled === false && (!r.allocated_to || r.allocated_to.trim() === ''));

            // Se existe pelo menos um processado neste grupo, significa que o(s) não-processado(s) 
            // que entraram DEPOIS são duplicados resultantes do bug de assinatura!
            if (processed.length > 0 && unprocessed.length > 0) {
                // Se um pagamento foi parcialmente alocado (split), a parte que sobra está "unprocessed"
                // Mas a parte que sobra terá a referência com "(Ref Mestre: ...)"
                
                for (const unp of unprocessed) {
                    // Se o não-processado tem a Ref Mestre, é a "sobra" de um split legítimo! Não apagar!
                    const hasMasterRef = unp.reference && unp.reference.includes("(Ref Mestre:");
                    
                    // Se NÃO tem Ref Mestre, é uma cópia "virgem" gerada pelo bug de re-upload. Apagar!
                    if (!hasMasterRef) {
                        toDelete.push(unp);
                    }
                }
            }
            
            // Outro cenário: O utilizador carregou 3 vezes antes de processar qualquer um.
            // Neste caso, temos 0 processados, e vários não-processados "virgens".
            if (processed.length === 0 && unprocessed.length > 1) {
                // Mantemos o primeiro (mais antigo), apagamos os restantes
                const sorted = unprocessed.sort((a, b) => new Date(a.created) - new Date(b.created));
                for (let i = 1; i < sorted.length; i++) {
                    toDelete.push(sorted[i]);
                }
            }
        }
    }

    console.log(`\nForam identificados ${toDelete.length} pagamentos duplicados para remoção.`);

    if (toDelete.length === 0) {
        console.log("Nenhuma acção necessária.");
        return;
    }

    // Processar apagamento em lotes para não sobrecarregar
    let apagados = 0;
    for (const record of toDelete) {
        try {
            await pb.collection('bank_incomes').delete(record.id);
            apagados++;
            process.stdout.write(`\rApagados: ${apagados} / ${toDelete.length}`);
        } catch (e) {
            console.error(`\nErro ao apagar registo ${record.id}:`, e.message);
        }
    }
    
    console.log("\n\nLimpeza concluída com sucesso!");
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Uso: node cleanup_duplicates.js <seu_email> <sua_password>");
    process.exit(1);
}

runCleanup(args[0], args[1]);
