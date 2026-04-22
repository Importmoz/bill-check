/**
 * Utilitários para o sistema Bill Check
 */

/**
 * Formata um valor numérico para o padrão de Moeda de Moçambique (MZN)
 * @param {number|string} val - Valor a formatar
 * @returns {string} Valor formatado
 */
export function formatMZN(val) {
    const num = parseFloat(val) || 0;
    return `MZN ${new Intl.NumberFormat('pt-MZ', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    }).format(num)}`;
}

/**
 * Exporta uma área do DOM como imagem PNG
 * @param {string} elementId - ID do elemento a capturar
 * @param {string} fileName - Nome do ficheiro de saída
 */
export function downloadElementAsImage(elementId, fileName) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // @ts-ignore - html2canvas carregado via CDN
    html2canvas(element, { 
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (clonedDoc) => {
            const clonedEl = clonedDoc.getElementById(elementId);
            if (clonedEl) {
                clonedEl.style.width = "1300px"; 
                clonedEl.style.padding = "20px";
                clonedEl.style.margin = "0";
                clonedEl.style.display = "flex";
                clonedEl.style.flexDirection = "column";
                clonedEl.style.alignItems = "center";
                clonedEl.style.justifyContent = "center";

                // Mostrar elementos exclusivos para exportação (ex: Total Geral)
                const exportOnly = clonedEl.querySelectorAll('.export-only');
                exportOnly.forEach(el => {
                    el.style.display = 'table-row';
                });
            }
        }
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${fileName}-${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}
