require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const OAUTH_PATH = path.join(__dirname, '..', '..', '..', 'google-oauth.json');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', '..', '..');
const TOKENS_PATH = path.join(DATA_DIR, 'tokens.json');

// Garantir que a diretoria de dados existe
if (process.env.DATA_DIR && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getOAuthClient(redirect_uri_param = null) {
  let client_id = process.env.GOOGLE_CLIENT_ID;
  let client_secret = process.env.GOOGLE_CLIENT_SECRET;
  let redirect_uri = redirect_uri_param || process.env.GOOGLE_REDIRECT_URI;

  if (!client_id || !client_secret) {
    let credentials;
    if (process.env.GOOGLE_OAUTH_CONFIG) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_OAUTH_CONFIG);
        console.log("[AUTH] Usando GOOGLE_OAUTH_CONFIG (JSON).");
      } catch (e) {
        console.error("[AUTH] Erro ao processar GOOGLE_OAUTH_CONFIG:", e.message);
      }
    } else if (fs.existsSync(OAUTH_PATH)) {
      credentials = JSON.parse(fs.readFileSync(OAUTH_PATH, 'utf8'));
      console.log("[AUTH] Usando google-oauth.json (Ficheiro).");
    }

    if (credentials) {
      const web = credentials.web || {};
      client_id = client_id || credentials.client_id || web.client_id;
      client_secret = client_secret || credentials.client_secret || web.client_secret;
      
      if (!redirect_uri) {
        redirect_uri = credentials.redirect_uri || (web.redirect_uris ? web.redirect_uris[0] : null);
      }
    }
  }

  if (!client_id || !client_secret) {
    throw new Error("Credenciais Google (ID/Secret) não encontradas via variáveis de ambiente ou ficheiro.");
  }

  return new google.auth.OAuth2(client_id, client_secret, redirect_uri);
}

async function getGoogleAuth() {
  const oauth2Client = getOAuthClient();

  if (!fs.existsSync(TOKENS_PATH)) {
    throw new Error("AUTH_REQUIRED: Precisas de autorizar a aplicação primeiro. Acede a /api/google/auth");
  }

  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
  oauth2Client.setCredentials(tokens);

  // Escutar por novos tokens (refresh) e guardar
  oauth2Client.on('tokens', (newTokens) => {
    const currentTokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    const mergedTokens = { ...currentTokens, ...newTokens };
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(mergedTokens, null, 2));
    console.log('[AUTH] Tokens atualizados e guardados com sucesso.');
  });

  return oauth2Client;
}

module.exports = {
  getOAuthClient,
  getGoogleAuth,
  TOKENS_PATH
};
