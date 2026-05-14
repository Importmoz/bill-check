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
    // RCE Mitigation: não usar originalname. Usar um UUID seguro.
    // Preservamos a extensão do ficheiro por precaução (usando parse seguro).
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `bank_${uuidv4()}${ext}`);
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

    if (error) {
      console.error('[BANK-PARSER] ERRO:', error.message);
      return res.status(500).json({
        error: "Erro ao processar o extrato bancário.",
        details: stderr || error.message
      });
    }

    try {
      // Remover logs de debug impressos pelo print em Python que não estejam em JSON
      const jsonStr = stdout.trim();
      // O script original no erro poderia fazer print de fallback JSON, tentamos parse.
      const data = JSON.parse(jsonStr);
      res.json(data);
    } catch (parseError) {
      console.error('[BANK-PARSER] Erro de Parse do output:', stdout);
      res.status(500).json({ error: "Erro na interpretação dos dados processados (O script Python não retornou JSON válido)." });
    }
  });
});

module.exports = router;
