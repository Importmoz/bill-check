const fs = require('fs');
let code = fs.readFileSync('src/frontend/js/ui.js', 'utf8');

// 1. Remove goToWizardStep
const startGoTo = code.indexOf('window.goToWizardStep = async function(stepNumber) {');
if (startGoTo > -1) {
    let endGoTo = code.indexOf('window.syncInvoiceHeaderToState = function() {');
    code = code.substring(0, startGoTo) + code.substring(endGoTo);
}

// 2. Remove syncWizardToState
const startSyncWizard = code.indexOf('window.syncWizardToState = function() {');
if (startSyncWizard > -1) {
    const endSyncWizard = code.indexOf('window.openLinesModal = function', startSyncWizard);
    if (endSyncWizard > -1) {
        code = code.substring(0, startSyncWizard) + code.substring(endSyncWizard);
    }
}

// 3. Rewrite switchQuoteTab
const switchQuoteTabStart = code.indexOf('window.switchQuoteTab = async function(tabName) {');
const nextFunc = code.indexOf('window.syncInvoiceHeaderToState = function() {');

if (switchQuoteTabStart > -1 && nextFunc > -1) {
    const newSwitchQuoteTab = `window.switchQuoteTab = async function(tabName) {
    if (tabName === 'quote') {
        if (!window.quoteEditorState.id) {
            toast("Guarde a simulação primeiro antes de avançar para a Cotação.", "error");
            return;
        }
    }

    const tabDraftBtn = document.getElementById('tab-btn-draft');
    const tabQuoteBtn = document.getElementById('tab-btn-quote');
    const contentSim = document.getElementById('tab-content-simulation');
    const contentQuote = document.getElementById('tab-content-quote');
    const btnBackWrapper = document.getElementById('btn-back-to-draft-wrapper');
    const contentInv = document.getElementById('tab-content-invoice');

    if (tabName === 'draft') {
        if (tabDraftBtn) tabDraftBtn.className = "px-5 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg bg-white shadow-sm text-indigo-600 transition-all border border-gray-200/50 flex items-center gap-2";
        if (tabQuoteBtn) tabQuoteBtn.className = "px-5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg text-gray-400 hover:text-gray-700 transition-all flex items-center gap-2";
        
        if (contentSim) {
            contentSim.classList.remove('hidden');
            contentSim.classList.add('flex');
        }
        if (contentQuote) {
            contentQuote.classList.add('hidden');
            contentQuote.classList.remove('flex');
        }
        if (btnBackWrapper) {
            btnBackWrapper.classList.add('hidden');
            btnBackWrapper.classList.remove('flex');
        }
    } else if (tabName === 'quote') {
        if (tabQuoteBtn) tabQuoteBtn.className = "px-5 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg bg-white shadow-sm text-indigo-600 transition-all border border-gray-200/50 flex items-center gap-2";
        if (tabDraftBtn) tabDraftBtn.className = "px-5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg text-gray-400 hover:text-gray-700 transition-all flex items-center gap-2";
        
        if (contentSim) {
            contentSim.classList.add('hidden');
            contentSim.classList.remove('flex');
        }
        if (contentQuote) {
            contentQuote.classList.remove('hidden');
            contentQuote.classList.add('flex');
        }
        if (btnBackWrapper) {
            btnBackWrapper.classList.remove('hidden');
            btnBackWrapper.classList.add('flex');
        }
        
        if (contentInv) {
            contentInv.classList.remove('hidden');
            contentInv.classList.add('flex');
            window.initInvoiceData();
            window.renderInvoiceLines();
        }

        if (!window.quoteEditorState.invoiceData || !window.quoteEditorState.invoiceData.clientName || window.quoteEditorState.invoiceData.clientName.trim() === '') {
            if (window.openClientModal) window.openClientModal();
        }
    }
};

`;
    
    code = code.substring(0, switchQuoteTabStart) + newSwitchQuoteTab + code.substring(nextFunc);
}

fs.writeFileSync('src/frontend/js/ui.js', code);
console.log('ui.js rewritten successfully');
