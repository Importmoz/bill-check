const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

let pautaData = [];
let isLoaded = false;

// Tabela de Secções Oficiais do Sistema Harmonizado (Pauta Aduaneira de Moçambique)
const SECTIONS = [
    { id: 'I', name: 'Animais Vivos e Produtos do Reino Animal', chapters: [1, 2, 3, 4, 5] },
    { id: 'II', name: 'Produtos do Reino Vegetal', chapters: [6, 7, 8, 9, 10, 11, 12, 13, 14] },
    { id: 'III', name: 'Gorduras e Óleos Animais ou Vegetais; Ceras de Origem Animal ou Vegetal', chapters: [15] },
    { id: 'IV', name: 'Produtos das Indústrias Alimentares; Bebidas, Líquidos Alcoólicos e Vinagres; Tabaco', chapters: [16, 17, 18, 19, 20, 21, 22, 23, 24] },
    { id: 'V', name: 'Produtos Minerais', chapters: [25, 26, 27] },
    { id: 'VI', name: 'Produtos das Indústrias Químicas ou das Indústrias Conexas', chapters: [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38] },
    { id: 'VII', name: 'Plásticos e suas Obras; Borracha e suas Obras', chapters: [39, 40] },
    { id: 'VIII', name: 'Peles, Couros, Peleteria e suas Obras; Artigos de Correeiro ou Seleiro; Artigos de Viagem', chapters: [41, 42, 43] },
    { id: 'IX', name: 'Madeira, Carvão Vegetal e Obras de Madeira; Cortiça e suas Obras; Espartaria ou Cestaria', chapters: [44, 45, 46] },
    { id: 'X', name: 'Pastas de Madeira ou outras Matérias Fibrosas; Papel ou Cartão e suas Obras', chapters: [47, 48, 49] },
    { id: 'XI', name: 'Matérias Têxteis e suas Obras', chapters: [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63] },
    { id: 'XII', name: 'Calçado, Chapéus e outros Artefactos; Flores Artificiais; Obras de Cabelo', chapters: [64, 65, 66, 67] },
    { id: 'XIII', name: 'Obras de Pedra, Gesso, Cimento, Amianto, Mica; Produtos Cerâmicos; Vidro e suas Obras', chapters: [68, 69, 70] },
    { id: 'XIV', name: 'Pérolas, Pedras Preciosas, Metais Preciosos e suas Obras; Bijutarias; Moedas', chapters: [71] },
    { id: 'XV', name: 'Metais Comuns e suas Obras', chapters: [72, 73, 74, 75, 76, 78, 79, 80, 81, 82, 83] },
    { id: 'XVI', name: 'Máquinas e Aparelhos, Material Eléctrico, e suas Partes; Aparelhos de Som e Imagem', chapters: [84, 85] },
    { id: 'XVII', name: 'Material de Transporte (Veículos Automóveis, Aeronaves, Embarcações e Material Conexo)', chapters: [86, 87, 88, 89] },
    { id: 'XVIII', name: 'Instrumentos de Óptica, Fotografia, Medida, Controlo, Médico-Cirúrgicos; Relojoaria; Instrumentos Musicais', chapters: [90, 91, 92] },
    { id: 'XIX', name: 'Armas e Munições; suas Partes e Acessórios', chapters: [93] },
    { id: 'XX', name: 'Mercadorias e Produtos Diversos (Móveis, Brinquedos, Iluminação, Construções Pré-fabricadas)', chapters: [94, 95, 96] },
    { id: 'XXI', name: 'Objectos de Arte, de Colecção e Antiguidades', chapters: [97] }
];

// Tabela de Capítulos Oficiais (01 a 97)
const CHAPTERS = {
    "01": "Animais vivos",
    "02": "Carnes e miudezas comestíveis",
    "03": "Peixes e crustáceos, moluscos e outros invertebrados aquáticos",
    "04": "Leite e lacticínios; ovos de aves; mel natural; produtos comestíveis de origem animal",
    "05": "Outros produtos de origem animal, não especificados nem compreendidos noutros capítulos",
    "06": "Plantas vivas e produtos de floricultura",
    "07": "Produtos hortícolas, plantas, raízes e tubérculos, comestíveis",
    "08": "Frutas comestíveis; cascas de citrinos ou de melões",
    "09": "Café, chá, mate e especiarias",
    "10": "Cereais",
    "11": "Produtos da moagem; malte; amidos e féculas; inulina; glúten de trigo",
    "12": "Sementes e frutos oleaginosos; sementes e frutos diversos; plantas industriais ou medicinais; palhas e forragens",
    "13": "Gomas, resinas e outros sucos e extractos vegetais",
    "14": "Matérias para entrançar e outros produtos de origem vegetal",
    "15": "Gorduras e óleos animais ou vegetais; produtos da sua dissociação; gorduras alimentares preparadas; ceras",
    "16": "Preparações de carne, de peixes ou de crustáceos, de moluscos ou de outros invertebrados aquáticos",
    "17": "Açúcares e produtos de confeitaria",
    "18": "Cacau e suas preparações",
    "19": "Preparações à base de cereais, farinhas, amidos e féculas ou de leite; produtos de pastelaria",
    "20": "Preparações de produtos hortícolas, de frutas ou de outras partes de plantas",
    "21": "Preparações alimentícias diversas",
    "22": "Bebidas, líquidos alcoólicos e vinagres",
    "23": "Resíduos e desperdícios das indústrias alimentares; alimentos preparados para animais",
    "24": "Tabaco e seus sucedâneos manufacturados",
    "25": "Sal; enxofre; terras e pedras; gesso, cal e cimento",
    "26": "Minérios, escórias e cinzas",
    "27": "Combustíveis minerais, óleos minerais e produtos da sua destilação; matérias betuminosas; ceras minerais",
    "28": "Produtos químicos inorgânicos; compostos inorgânicos ou orgânicos de metais preciosos",
    "29": "Produtos químicos orgânicos",
    "30": "Produtos farmacêuticos",
    "31": "Adubos (fertilizantes)",
    "32": "Extractos tanantes ou tintoriais; taninos; matérias corantes; tintas e vernizes; mástiques",
    "33": "Óleos essenciais e resinóides; produtos de perfumaria ou de toucador preparados e cosméticos",
    "34": "Sabões, agentes orgânicos de superfície, preparações lubrificantes, ceras artificiais, produtos de limpeza",
    "35": "Matérias albuminóides; amidos ou féculas modificados; colas; enzimas",
    "36": "Pólvoras e explosivos; artigos de pirotecnia; fósforos; ligas pirofóricas",
    "37": "Produtos para fotografia e cinematografia",
    "38": "Produtos diversos das indústrias químicas",
    "39": "Plásticos e suas obras",
    "40": "Borracha e suas obras",
    "41": "Peles, excepto a peleteria (peles com pêlo), e couros",
    "42": "Obras de couro; artigos de correeiro ou de seleiro; artigos de viagem, bolsas e semelhantes",
    "43": "Peleteria (peles com pêlo) e suas obras; peleteria artificial",
    "44": "Madeira, carvão vegetal e obras de madeira",
    "45": "Cortiça e suas obras",
    "46": "Obras de espartaria ou de cestaria",
    "47": "Pastas de madeira ou de outras matérias fibrosas celulósicas; papel ou cartão para reciclar",
    "48": "Papel e cartão; obras de pasta de celulose, de papel ou de cartão",
    "49": "Livros, jornais, gravuras e outros produtos das indústrias gráficas; textos manuscritos e planos",
    "50": "Seda",
    "51": "Lã, pêlos finos ou grosseiros; fios e tecidos de crina",
    "52": "Algodão",
    "53": "Outras fibras têxteis vegetais; fios de papel e tecidos de fios de papel",
    "54": "Filamentos sintéticos ou artificiais; lâminas e formas semelhantes",
    "55": "Fibras sintéticas ou artificiais, descontinuas",
    "56": "Pastas, feltros e falsos tecidos; fios especiais; cordéis, cordas e cabos",
    "57": "Tapetes e outros revestimentos para pavimentos, de matérias têxteis",
    "58": "Tecidos especiais; tecidos tufados; rendas; tapeçarias; passamanarias; bordados",
    "59": "Tecidos impregnados, revestidos, recobertos ou estratificados; artigos para usos técnicos",
    "60": "Tecidos de malha",
    "61": "Vestuário e seus acessórios, de malha",
    "62": "Vestuário e seus acessórios, excepto de malha",
    "63": "Outros artefactos têxteis confeccionados; sortidos; artefactos de matérias têxteis usados",
    "64": "Calçado, polainas e artefactos semelhantes; suas partes",
    "65": "Chapéus e outros artefactos de uso semelhante, e suas partes",
    "66": "Guarda-chuvas, sombrinhas, guarda-sóis, bengalas, chicotes, e suas partes",
    "67": "Penas e penugem preparadas, e suas obras; flores artificiais; obras de cabelo",
    "68": "Obras de pedra, gesso, cimento, amianto, mica ou de matérias semelhantes",
    "69": "Produtos cerâmicos",
    "70": "Vidro e suas obras",
    "71": "Pérolas, pedras preciosas, metais preciosos, folheados e suas obras; bijutarias; moedas",
    "72": "Ferro fundido, ferro e aço",
    "73": "Obras de ferro fundido, ferro ou aço",
    "74": "Cobre e suas obras",
    "75": "Níquel e suas obras",
    "76": "Alumínio e suas obras",
    "78": "Chumbo e suas obras",
    "79": "Zinco e suas obras",
    "80": "Estanho e suas obras",
    "81": "Outros metais comuns; ceramais; suas obras",
    "82": "Ferramentas, artefactos de cutelaria e talheres, e suas partes, de metais comuns",
    "83": "Obras diversas de metais comuns",
    "84": "Reactores nucleares, caldeiras, máquinas, aparelhos e instrumentos mecânicos, e suas partes",
    "85": "Máquinas, aparelhos e materiais eléctricos, e suas partes; aparelhos de gravação ou reprodução de som e imagens",
    "86": "Veículos e material para vias férreas ou semelhantes, e suas partes; aparelhos mecânicos de sinalização",
    "87": "Veículos automóveis, tractores, ciclos e outros veículos terrestres, suas partes e acessórios",
    "88": "Navegação aérea ou espacial, e suas partes",
    "89": "Navegação marítima, fluvial e lacustre",
    "90": "Instrumentos e aparelhos de óptica, fotografia, cinematografia, medida, controlo ou precisão; médico-cirúrgicos",
    "91": "Aparelhos de relojoaria e suas partes",
    "92": "Instrumentos musicais; suas partes e acessórios",
    "93": "Armas e munições; suas partes e acessórios",
    "94": "Móveis; mobiliário médico-cirúrgico; colchões; aparelhos de iluminação; construções pré-fabricadas",
    "95": "Brinquedos, jogos, artigos para divertimento ou para desporto; suas partes e acessórios",
    "96": "Obras diversas (canetas, botões, fechos de correr, vassouras, etc.)",
    "97": "Objectos de arte, de colecção e antiguidades"
};

// Dicionário das Principais Posições (4 dígitos)
const HEADINGS = {
    "8701": "Tractores (excepto os carros-tractores da posição 87.09)",
    "8702": "Veículos automóveis para transporte de 10 pessoas ou mais, incluindo o motorista (autocarros, miniautocarros)",
    "8703": "Automóveis de passageiros e outros veículos concebidos principalmente para transporte de pessoas",
    "8704": "Veículos automóveis para transporte de mercadorias (camiões, furgões, carrinhas)",
    "8705": "Veículos automóveis para usos especiais (prontos-socorros, camiões-bomba, guindastes)",
    "8708": "Partes e acessórios dos veículos automóveis das posições 87.01 a 87.05",
    "8711": "Motociclos (incluindo ciclomotores) e velocípedes com motor auxiliar",
    "8712": "Bicicletas e outros velocípedes (incluindo os triciclos de carga), sem motor",
    "8716": "Reboques e semi-reboques, para quaisquer veículos; outros veículos não autopropulsionados",
    "8471": "Máquinas automáticas para processamento de dados (computadores, servidores) e suas unidades",
    "8517": "Aparelhos telefónicos, incluindo smartphones; aparelhos para emissão/recepção de voz e dados",
    "8528": "Monitores e projectores; aparelhos receptores de televisão",
    "8504": "Transformadores eléctricos, conversores eléctricos estáticos (ex: carregadores, fontes), bobinas",
    "8544": "Fios, cabos e outros condutores isolados para electricidade; cabos de fibras ópticas",
    "2201": "Águas, incluindo as águas minerais naturais ou artificiais e as águas gaseificadas",
    "2202": "Águas com adição de açúcar ou outros edulcorantes ou aromatizadas, refrigerantes",
    "2203": "Cervejas de malte",
    "2204": "Vinhos de uvas frescas, incluindo os vinhos enriquecidos com álcool; mostos",
    "2208": "Álcool etílico não desnaturado (<80% vol); aguardentes, licores e outras bebidas espirituosas",
    "2710": "Óleos de petróleo ou de minerais betuminosos (combustíveis, gasolina, gasóleo, lubrificantes)",
    "1006": "Arroz",
    "1001": "Trigo e mistura de trigo com centeio",
    "1701": "Açúcares de cana ou de beterraba e sacarose quimicamente pura, no estado sólido",
    "1902": "Massas alimentícias, mesmo cozidas ou recheadas (esparguete, macarrão, etc.)",
    "3004": "Medicamentos preparados para fins terapêuticos ou profilácticos",
    "3923": "Artigos de transporte ou de embalagem, de plásticos; rolhas, tampas, cápsulas",
    "3926": "Outras obras de plásticos e obras de outras matérias das posições 39.01 a 39.14",
    "4011": "Pneumáticos novos, de borracha",
    "4407": "Madeira serrada ou fendida longitudinalmente, cortada ou desenrolada",
    "4819": "Caixas, sacos, bolsas, cartuchos e outras embalagens, de papel, cartão, pasta de celulose",
    "6403": "Calçado com sola exterior de borracha, plástico, couro e parte superior em couro",
    "6404": "Calçado com sola exterior de borracha ou plástico e parte superior em matérias têxteis",
    "7214": "Barras de ferro ou aço não ligado, simplesmente forjadas ou laminadas a quente",
    "7308": "Construções e suas partes, de ferro fundido, ferro ou aço; chapas, perfis preparados",
    "9018": "Instrumentos e aparelhos para medicina, cirurgia, odontologia ou veterinária",
    "9403": "Outros móveis e suas partes",
    "9405": "Aparelhos de iluminação e suas partes, não especificados nem compreendidos noutras posições"
};

// Formatar código pautal com pontos padrão (ex: 87032390 -> 8703.23.90)
function formatHsCode(code) {
    if (!code) return '';
    const clean = String(code).replace(/[^0-9]/g, '');
    if (clean.length === 8) {
        return `${clean.slice(0, 4)}.${clean.slice(4, 6)}.${clean.slice(6, 8)}`;
    } else if (clean.length === 6) {
        return `${clean.slice(0, 4)}.${clean.slice(4, 6)}`;
    } else if (clean.length === 4) {
        return `${clean.slice(0, 2)}.${clean.slice(2, 4)}`;
    }
    return clean;
}

// Load lazily or on startup
function loadPautaData() {
    if (isLoaded) return;
    try {
        const dataPath = path.join(__dirname, '..', '..', 'frontend', 'data', 'pauta.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        pautaData = JSON.parse(rawData);
        isLoaded = true;
        console.log(`[PAUTA BACKEND] Pauta carregada na memória do servidor com ${pautaData.length} registos.`);
    } catch (error) {
        console.error('[PAUTA BACKEND] Erro ao carregar pauta.json no servidor:', error);
    }
}

// Ensure data is loaded
loadPautaData();

// Obter estrutura hierárquica completa para um código
function buildHierarchy(rawCode) {
    const clean = String(rawCode || '').replace(/[^0-9]/g, '');
    if (clean.length < 2) return null;

    const chKey = clean.substring(0, 2);
    const chNum = parseInt(chKey, 10);
    const chapterName = CHAPTERS[chKey] || `Capítulo ${chKey}`;

    const section = SECTIONS.find(s => s.chapters.includes(chNum)) || {
        id: '?',
        name: 'Secção Não Definida'
    };

    const headingCode = clean.length >= 4 ? clean.substring(0, 4) : clean.padEnd(4, '0');
    const headingFormatted = `${headingCode.slice(0, 2)}.${headingCode.slice(2, 4)}`;
    const headingName = HEADINGS[headingCode] || `Posição ${headingFormatted} (${chapterName})`;

    const subheadingCode = clean.length >= 6 ? clean.substring(0, 6) : '';
    const subheadingFormatted = subheadingCode ? `${subheadingCode.slice(0, 4)}.${subheadingCode.slice(4, 6)}` : '';

    const tariffFormatted = clean.length === 8 ? `${clean.slice(0, 4)}.${clean.slice(4, 6)}.${clean.slice(6, 8)}` : clean;

    return {
        section: {
            id: section.id,
            roman: `SECÇÃO ${section.id}`,
            name: section.name
        },
        chapter: {
            code: chKey,
            label: `CAPÍTULO ${chKey}`,
            name: chapterName
        },
        heading: {
            code: headingCode,
            formatted: headingFormatted,
            label: `POSIÇÃO ${headingFormatted}`,
            name: headingName
        },
        subheading: {
            code: subheadingCode,
            formatted: subheadingFormatted,
            label: subheadingFormatted ? `SUBPOSIÇÃO ${subheadingFormatted}` : ''
        },
        tariffLine: {
            code: clean,
            formatted: tariffFormatted
        }
    };
}

// ROTA: Obter a hierarquia e artigos da posição (irmãos)
router.get('/hierarchy/:code', (req, res) => {
    try {
        const clean = String(req.params.code || '').replace(/[^0-9]/g, '');
        if (clean.length < 2) {
            return res.status(400).json({ error: 'Código pautal deve conter pelo menos 2 dígitos.' });
        }

        const hierarchy = buildHierarchy(clean);
        if (!hierarchy) {
            return res.status(400).json({ error: 'Não foi possível mapear a hierarquia.' });
        }

        const headingCode = hierarchy.heading.code;
        
        // Localizar todos os artigos da mesma posição pautal (4 dígitos)
        const siblings = pautaData.filter(p => String(p.code).startsWith(headingCode));

        // Artigo selecionado (exato ou o mais próximo)
        const exactItem = pautaData.find(p => String(p.code) === clean) || null;

        // Se for um item exato, anexar à resposta
        const currentIndex = exactItem ? siblings.findIndex(s => s.code === exactItem.code) : -1;

        // Agrupar os artigos da posição por subposição (6 dígitos)
        const subpositionMap = {};
        siblings.forEach((s, idx) => {
            const s6 = String(s.code).slice(0, 6);
            if (!subpositionMap[s6]) {
                const subFormatted = s6.length >= 6 ? `${s6.slice(0, 4)}.${s6.slice(4, 6)}` : s6;
                subpositionMap[s6] = {
                    code: s6,
                    formatted: subFormatted,
                    label: `SUBPOSIÇÃO ${subFormatted}`,
                    isCurrent: s6 === hierarchy.subheading.code,
                    items: []
                };
            }
            subpositionMap[s6].items.push({
                index: idx + 1,
                code: s.code,
                formattedCode: formatHsCode(s.code),
                description: s.description,
                duties: s.duties || [],
                isSelected: exactItem ? s.code === exactItem.code : false
            });
        });
        const subpositions = Object.values(subpositionMap);

        // Capítulos pertencentes à secção ativa
        const sectionDef = SECTIONS.find(sec => sec.id === hierarchy.section.id);
        const sectionChapters = sectionDef ? sectionDef.chapters.map(c => {
            const chStr = String(c).padStart(2, '0');
            return {
                code: chStr,
                label: `CAPÍTULO ${chStr}`,
                name: CHAPTERS[chStr] || `Capítulo ${chStr}`,
                isCurrent: chStr === hierarchy.chapter.code
            };
        }) : [];

        res.json({
            success: true,
            found: !!exactItem,
            code: clean,
            formattedCode: formatHsCode(clean),
            item: exactItem,
            hierarchy,
            sectionChapters,
            subpositions,
            totalInHeading: siblings.length,
            currentIndex,
            siblings: siblings.map((s, idx) => ({
                index: idx + 1,
                code: s.code,
                formattedCode: formatHsCode(s.code),
                description: s.description,
                duties: s.duties || [],
                isSelected: exactItem ? s.code === exactItem.code : false
            }))
        });
    } catch (error) {
        console.error('[PAUTA BACKEND] Erro ao obter hierarquia:', error);
        res.status(500).json({ error: 'Erro ao processar hierarquia da Pauta Aduaneira.' });
    }
});

// ROTA: Obter um item específico por código
router.get('/item/:code', (req, res) => {
    try {
        const clean = String(req.params.code || '').replace(/[^0-9]/g, '');
        const item = pautaData.find(p => String(p.code) === clean);
        if (!item) {
            return res.status(404).json({ error: 'Artigo não encontrado na Pauta.' });
        }
        res.json(item);
    } catch (error) {
        console.error('[PAUTA BACKEND] Erro ao obter artigo:', error);
        res.status(500).json({ error: 'Erro ao buscar artigo.' });
    }
});

// ROTA: Pesquisa de artigos por código ou descrição
router.get('/search', (req, res) => {
    try {
        const q = (req.query.q || '').toLowerCase().trim();
        const limit = parseInt(req.query.limit) || 50;
        
        if (!q) {
            return res.json([]);
        }
        
        // Normalizar para ignorar acentos na pesquisa
        const cleanQ = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const results = pautaData.filter(p => {
            const code = p.code ? String(p.code).toLowerCase() : '';
            const desc = p.description ? String(p.description).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
            return code.startsWith(cleanQ) || desc.includes(cleanQ);
        }).slice(0, limit);
        
        res.json(results);
    } catch (error) {
        console.error('[PAUTA BACKEND] Erro na pesquisa:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
