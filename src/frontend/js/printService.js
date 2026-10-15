/**
 * printService.js - Serviço de Gestão e Impressão em Rede Local
 * Comunica com o servidor Python (servidor_de_impressao_drag_drop.py)
 * quer diretamente, quer através do proxy Express (/api/print/*)
 */

export const DEFAULT_PRINT_SERVER_URL = 'http://192.168.88.10:5000';

export const printService = {
    /**
     * Devolve a URL configurada do servidor de impressão
     */
    getServerUrl() {
        const saved = localStorage.getItem('printer_server_url');
        if (saved && saved.trim()) {
            let url = saved.trim().replace(/\/+$/, '');
            // Migrar automaticamente se ainda estava com o IP antigo .23
            if (url === 'http://192.168.88.23:5000') {
                url = DEFAULT_PRINT_SERVER_URL;
                localStorage.setItem('printer_server_url', url);
            }
            if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
            return url;
        }
        return DEFAULT_PRINT_SERVER_URL;
    },

    /**
     * Guarda a URL do servidor
     */
    setServerUrl(url) {
        if (!url) {
            localStorage.removeItem('printer_server_url');
        } else {
            let clean = url.trim().replace(/\/+$/, '');
            if (!/^https?:\/\//i.test(clean)) clean = 'http://' + clean;
            localStorage.setItem('printer_server_url', clean);
        }
    },

    /**
     * Devolve o nome da impressora selecionada pelo utilizador
     */
    getSelectedPrinter() {
        return localStorage.getItem('printer_selected_name') || '';
    },

    /**
     * Guarda a impressora selecionada
     */
    setSelectedPrinter(name) {
        if (!name) {
            localStorage.removeItem('printer_selected_name');
        } else {
            localStorage.setItem('printer_selected_name', name.trim());
        }
    },

    /**
     * Devolve o token de autenticação (se existir)
     */
    getApiToken() {
        return localStorage.getItem('printer_api_token') || '';
    },

    /**
     * Guarda o token de autenticação
     */
    setApiToken(token) {
        if (!token) {
            localStorage.removeItem('printer_api_token');
        } else {
            localStorage.setItem('printer_api_token', token.trim());
        }
    },

    /**
     * Verifica o estado do servidor de impressão
     * Tenta conexão direta ao computador partilhado e faz fallback para o proxy backend
     */
    async checkStatus(customUrl = null) {
        const serverUrl = customUrl || this.getServerUrl();
        const token = this.getApiToken();

        // 1. Tentar diretamente para o computador partilhado na rede
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3500);
            const headers = {};
            if (token) headers['Authorization'] = 'Bearer ' + token;
            const directRes = await fetch(`${serverUrl}/api/status`, {
                method: 'GET',
                headers,
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (directRes.ok) {
                const data = await directRes.json();
                return { ok: true, serverUrl, isDirect: true, ...data };
            }
        } catch (directErr) {
            // Falha direta (ex: mixed content ou timeout), prosseguir para proxy backend
        }

        // 2. Fallback via proxy Express (/api/print/status)
        const params = new URLSearchParams({ serverUrl });
        if (token) params.set('token', token);

        try {
            const res = await fetch(`/api/print/status?${params.toString()}`);
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                return {
                    ok: false,
                    error: errJson.error || `Erro de conexão (HTTP ${res.status})`,
                    serverUrl
                };
            }
            const data = await res.json();
            return {
                ok: true,
                ...data
            };
        } catch (e) {
            return {
                ok: false,
                error: e.message || 'Servidor de impressão inacessível',
                serverUrl
            };
        }
    },

    /**
     * Lista as impressoras disponíveis no servidor (direto ou proxy)
     */
    async getPrinters(customUrl = null) {
        const serverUrl = customUrl || this.getServerUrl();
        const token = this.getApiToken();

        // 1. Tentar direto
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const headers = {};
            if (token) headers['Authorization'] = 'Bearer ' + token;
            const directRes = await fetch(`${serverUrl}/api/impressoras`, {
                method: 'GET',
                headers,
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (directRes.ok) {
                const data = await directRes.json();
                return {
                    ok: true,
                    impressoras: data.impressoras || [],
                    padrao: data.padrao || null,
                    serverUrl,
                    isDirect: true
                };
            }
        } catch (directErr) {}

        // 2. Fallback via proxy
        const params = new URLSearchParams({ serverUrl });
        if (token) params.set('token', token);

        try {
            const res = await fetch(`/api/print/impressoras?${params.toString()}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { ok: false, error: err.error || 'Erro ao obter impressoras', impressoras: [], padrao: null };
            }
            const data = await res.json();
            return {
                ok: true,
                impressoras: data.impressoras || [],
                padrao: data.padrao || null,
                serverUrl
            };
        } catch (e) {
            return {
                ok: false,
                error: e.message || 'Falha ao contactar servidor de impressão',
                impressoras: [],
                padrao: null
            };
        }
    },

    /**
     * Envia documento para imprimir diretamente na impressora de rede
     * @param {Object} options
     * @param {string} options.nome - Nome do ficheiro com extensão
     * @param {string} options.arquivoBase64 - String base64
     * @param {string} [options.impressora] - Nome da impressora
     * @param {string} [options.serverUrl] - URL do servidor
     */
    async printDocument({ nome, arquivoBase64, impressora = null, serverUrl = null }) {
        const targetServer = serverUrl || this.getServerUrl();
        const targetPrinter = impressora || this.getSelectedPrinter();
        const token = this.getApiToken();

        if (!arquivoBase64) {
            throw new Error('Conteúdo do documento em base64 não fornecido');
        }

        const directPayload = {
            nome: nome || 'documento.pdf',
            arquivo: arquivoBase64,
            impressora: targetPrinter || undefined
        };

        // 1. Tentar direto para o computador partilhado
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 35000);
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const directRes = await fetch(`${targetServer}/api/imprimir`, {
                method: 'POST',
                headers,
                body: JSON.stringify(directPayload),
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (directRes.ok) {
                const data = await directRes.json();
                if (data.sucesso) return { ...data, isDirect: true };
            }
        } catch (directErr) {
            console.warn('[PRINT] Envio direto falhou, a tentar via proxy backend...', directErr.message);
        }

        // 2. Fallback via backend proxy
        const payload = {
            serverUrl: targetServer,
            nome: nome || 'documento.pdf',
            arquivo: arquivoBase64,
            impressora: targetPrinter || undefined,
            token: token || undefined
        };

        const res = await fetch('/api/print/imprimir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(async () => {
            const text = await res.text();
            return { sucesso: false, erro: text || `HTTP ${res.status}` };
        });

        if (!res.ok || !data.sucesso) {
            throw new Error(data.erro || 'Falha na impressão do documento');
        }

        return data;
    },

    /**
     * Imprime uma página de teste rápida
     */
    async printTestPage(impressora = null) {
        const serverUrl = this.getServerUrl();
        const targetPrinter = impressora || this.getSelectedPrinter();
        const token = this.getApiToken();

        const res = await fetch('/api/print/teste', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverUrl,
                impressora: targetPrinter,
                token
            })
        });

        const data = await res.json();
        if (!res.ok || !data.sucesso) {
            throw new Error(data.erro || 'Falha ao imprimir página de teste');
        }
        return data;
    },

    /**
     * Converte um elemento HTML em PDF Base64 pronto para enviar ao servidor
     * @param {HTMLElement} element - O contentor a imprimir (pode conter múltiplos .page-wrapper ou ser ele próprio um .page-wrapper)
     * @param {Object} [windowContext] - Opcionalmente a window onde o elemento reside
     */
    async elementToPdfBase64(element, windowContext = window) {
        const html2canvas = windowContext.html2canvas || window.html2canvas;
        const jspdf = windowContext.jspdf || window.jspdf;

        if (!html2canvas) {
            throw new Error('Biblioteca html2canvas não encontrada.');
        }

        // Se o elemento contiver páginas filhas .page-wrapper, iteramos cada página
        let pages = [];
        if (element.classList && element.classList.contains('page-wrapper')) {
            pages = [element];
        } else {
            const found = element.querySelectorAll ? element.querySelectorAll('.page-wrapper') : [];
            pages = found.length > 0 ? Array.from(found) : [element];
        }

        if (jspdf && (jspdf.jsPDF || typeof jspdf === 'function')) {
            const JsPdfConstructor = jspdf.jsPDF || jspdf;
            // Folha A4 em modo Retrato (Portrait: 210 x 297 mm)
            const pdf = new JsPdfConstructor({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            for (let i = 0; i < pages.length; i++) {
                if (i > 0) {
                    pdf.addPage();
                }
                const pageEl = pages[i];
                const canvas = await html2canvas(pageEl, {
                    scale: 2.2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    windowWidth: 1200
                });
                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
            }

            const dataUri = pdf.output('datauristring');
            return dataUri.split(',')[1];
        } else {
            // Fallback direto como imagem PNG (renderiza a primeira página ou todo o elemento)
            const canvas = await html2canvas(pages[0] || element, {
                scale: 2.2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 1200
            });
            return canvas.toDataURL('image/png').split(',')[1];
        }
    }
};

// Expor globalmente para acesso fácil em modais e popups
window.printService = printService;
