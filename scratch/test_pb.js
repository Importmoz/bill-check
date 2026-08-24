const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('https://pocketbase.mycloudspaces.com');

async function main() {
    try {
        console.log("Conectando ao PocketBase...");
        const records = await pb.collection('confirm_projects').getList(1, 1);
        console.log("Registros encontrados:", records.items.length);
        if (records.items.length > 0) {
            console.log("Campos de confirm_projects:", Object.keys(records.items[0]));
            console.log("Registro completo:", records.items[0]);
        } else {
            console.log("Nenhum registro encontrado.");
        }
    } catch (err) {
        console.error("Erro ao consultar PocketBase:", err);
    }
}

main();
