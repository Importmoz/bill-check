const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const originalHtmlPath = path.join(__dirname, '..', 'Bill-Check', 'index.html');
const frontendDir = path.join(__dirname, 'src', 'frontend');
const viewsDir = path.join(frontendDir, 'views');
const componentsDir = path.join(frontendDir, 'components');

const originalHtml = fs.readFileSync(originalHtmlPath, 'utf8');
const dom = new JSDOM(originalHtml);
const document = dom.window.document;

// 1. Extrair Views
const views = document.querySelectorAll('[id^="view-"]');
views.forEach(view => {
    const id = view.id;
    fs.writeFileSync(path.join(viewsDir, `${id}.html`), view.outerHTML);
    view.remove(); // Remove do DOM principal
});

// 2. Extrair Modais e Componentes Globais
const modals = document.querySelectorAll('[id^="modal-"]');
const loader = document.getElementById('loader');
const tableActions = document.getElementById('table-actions');

let componentsHtml = '';
if (loader) {
    componentsHtml += loader.outerHTML + '\n';
    loader.remove();
}
if (tableActions) {
    componentsHtml += tableActions.outerHTML + '\n';
    tableActions.remove();
}
modals.forEach(modal => {
    componentsHtml += modal.outerHTML + '\n';
    modal.remove();
});

fs.writeFileSync(path.join(componentsDir, 'modals.html'), componentsHtml);

// 3. Modificar o Body do index.html para ter os roots de injeção
const body = document.body;
// Limpar o que restou (podem haver scripts vazios ou espaços)
body.innerHTML = `
    <!-- Recipiente Principal para as Views -->
    <div id="app-root"></div>

    <!-- Modais Globais -->
    <div id="modals-root"></div>

    <script type="module" src="js/init.js"></script>
    <script type="module" src="js/app.js?v=20260508"></script>
`;

// Substituir config de pocketbase (já temos um endpoint que dá isto, mas vou inserir o ficheiro de config estático)
const head = document.head;
const configScript = document.createElement('script');
configScript.src = '/config.js';
head.appendChild(configScript);

// Remover scripts do body que já foram movidos ou que não devem estar aqui
// (html2canvas, etc, estão no head)

fs.writeFileSync(path.join(frontendDir, 'index.html'), dom.serialize());

console.log('Split completed successfully!');
