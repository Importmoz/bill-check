/**
 * Módulo de Inicialização da UI - Bill Check v2
 * Carrega dinamicamente os componentes e vistas para o app-root
 */

const VIEWS = [
    'view-login',
    'view-hub',
    'view-dashboard',
    'view-finance',
    'view-team-dashboard',
    'view-team-table',
    'view-term-dashboard',
    'view-term-table',
    'view-confirm-dashboard',
    'view-confirm-table',
    'view-confirm-client-detail',
    'view-bank-dashboard',
    'view-table'
];

const MODALS = [
    'modal-table-actions',
    'modal-edit-container',
    'modal-add-payment',
    'modal-finance-sheet',
    'modal-finance-group',
    'modal-confirm-edit',
    'modal-bank-upload',
    'modal-bank-reconcile'
];

/**
 * Carrega todos os componentes necessários para a SPA
 */
export async function initializeApp() {
    if (window.__APP_INITIALIZED__) {
        console.warn("Tentativa de inicialização duplicada ignorada.");
        return;
    }
    window.__APP_INITIALIZED__ = true;
    
    const root = document.getElementById('app-root');
    const modalsContainer = document.getElementById('modals-container');

    if (!root) {
        console.error("ERRO CRÍTICO: #app-root não encontrado!");
        return;
    }

    try {
        // Limpar recipientes antes de inicializar para evitar duplicados
        root.innerHTML = '';
        modalsContainer.innerHTML = '';

        // 1. Carregar Vistas
        const viewPromises = VIEWS.map(async (view) => {
            const res = await fetch(`../views/${view}.html?v=${Date.now()}`);
            if (!res.ok) throw new Error(`Falha ao carregar vista: ${view}`);
            const html = await res.text();
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html.trim();
            const viewElement = tempDiv.firstElementChild;
            
            if (viewElement) {
                viewElement.classList.add('view-section', 'hidden');
                root.appendChild(viewElement);
            } else {
                console.error(`Vista ${view} está vazia ou malformada.`);
            }
        });

        // 2. Carregar Modais (Agora centralizados em modals.html)
        const loadModals = async () => {
            const res = await fetch(`../components/modals.html?v=${Date.now()}`);
            if (!res.ok) throw new Error(`Falha ao carregar modais centralizados`);
            const html = await res.text();
            modalsContainer.innerHTML = html;
        };

        await Promise.all([...viewPromises, loadModals()]);
        console.log("UI Inicializada com sucesso!");
        
    } catch (err) {
        console.error("Erro na inicialização da UI:", err);
        // Fallback: mostrar erro na tela
        root.innerHTML = `<div class="p-10 text-red-600 font-bold">Erro ao carregar componentes da aplicação: ${err.message}</div>`;
    }
}
