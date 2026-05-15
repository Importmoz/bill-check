
const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io');

async function test() {
    try {
        const result = await pb.collection('bank_incomes').getList(1, 5, {
            sort: '-created'
        });
        console.log('CONEXAO OK. TOTAL REGISTROS:', result.totalItems);
        result.items.forEach(item => {
            console.log(`- ID: ${item.id}, Data: ${item.date}, Desc: ${item.description}, Sig: ${item.signature}`);
        });
    } catch (err) {
        console.error('ERRO AO CONECTAR AO POCKETBASE:', err.message);
    }
}

test();
