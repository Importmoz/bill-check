const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid'); // Segurança: gerar nomes dinâmicos

// Configuração segura do Multer para armazenamento em disco e limite de 20MB
const tmpDir = path.join(__dirname, '..', '..', '..', 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const logsDir = path.join(__dirname, '..', '..', '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    // RCE Mitigation: usar UUID seguro mas preservar o nome original sanitizado
    // para que o bank_parser.py consiga extrair o número de conta/banco correto.
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_'); // Substitui caracteres perigosos por underscore
    cb(null, `bank_${uuidv4()}_${safeBase}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // Limite 20MB
});

router.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Nenhum ficheiro enviado ou erro no upload." });

  console.log('[BANK] Ficheiro recebido com segurança. Nome interno:', file.filename);

  const tempPath = file.path;
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, '..', '..', 'python', 'bank_parser.py');

  // RCE Mitigation: Uso de execFile em vez de exec para evitar injection na shell.
  execFile(pythonCmd, [scriptPath, tempPath], { maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
    
    // Limpeza garantida do ficheiro temporário
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    // Registar logs
    const logEntry = `${new Date().toISOString()} - INFO: Arquivo extraído ${file.filename}\nSTDOUT: ${stdout.substring(0, 500)}...\nSTDERR: ${stderr}\n`;
    fs.appendFileSync(path.join(logsDir, 'bank_parser.log'), logEntry);

    // Tentar extrair JSON de stdout (mesmo se o processo terminou com erro ou se bibliotecas emitiram warnings)
    let parsedData = null;
    if (stdout && stdout.trim()) {
      try {
        const trimmed = stdout.trim();
        const firstArr = trimmed.indexOf('[');
        const firstObj = trimmed.indexOf('{');
        let startIdx = -1;
        if (firstArr !== -1 && firstObj !== -1) {
          startIdx = Math.min(firstArr, firstObj);
        } else {
          startIdx = firstArr !== -1 ? firstArr : firstObj;
        }

        if (startIdx !== -1) {
          const lastArr = trimmed.lastIndexOf(']');
          const lastObj = trimmed.lastIndexOf('}');
          const endIdx = Math.max(lastArr, lastObj);
          if (endIdx > startIdx) {
            const rawJson = trimmed.substring(startIdx, endIdx + 1);
            parsedData = JSON.parse(rawJson);
          }
        }
      } catch (pe) {
        console.warn('[BANK-PARSER] Falha ao extrair JSON de stdout:', pe.message);
      }
    }

    if (error) {
      console.error('[BANK-PARSER] ERRO:', error.message);
      if (parsedData && parsedData.error) {
        return res.status(400).json({ error: parsedData.error });
      }
      return res.status(500).json({
        error: "Erro ao processar o extrato bancário.",
        details: stderr || error.message
      });
    }

    if (parsedData !== null) {
      if (parsedData && parsedData.error) {
        return res.status(400).json({ error: parsedData.error });
      }
      return res.json(parsedData);
    }

    console.error('[BANK-PARSER] Erro de Parse do output:', stdout);
    return res.status(500).json({ 
      error: "Erro na interpretação dos dados processados (O script Python não retornou dados legíveis)." 
    });
  });
});

module.exports = router;
