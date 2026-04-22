# Painel de Controlo Duty & Freight

Aplicação web para gestão de custos de shipping (Duty & Freight) com integração PocketBase.

## Funcionalidades

- Autenticação de utilizadores
- CRUD de tabelas de custos
- Gestão de contentores (containers)
- Registro de pagamentos parciais/totais
- Cálculo automático de diferenças e saldos
- Exportação de tabelas como PNG
- Dashboard com resumo geral
- Isolamento de dados por utilizador

## Tecnologias

- Frontend: HTML5, CSS3, JavaScript vanilla
- UI: Tailwind CSS
- Backend: PocketBase (externo)
- Servidor: Node.js + Express (para deploy)

## Configuração Local

1. Clone o repositório:
   ```bash
   git clone https://github.com/Importmoz/bill-check.git
   cd bill-check
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure a variável de ambiente (opcional):
   ```bash
   cp .env.example .env
   # Edite o .env com a URL do seu PocketBase
   ```

4. Inicie o servidor:
   ```bash
   npm start
   ```
   A aplicação estará disponível em `http://localhost:3000`

## Deploy no Coolify

### Método 1: Usando o repositório Git

1. No Coolify, adicione um novo serviço
2. Selecione "Git Repository" e informe a URL do repositório:
   ```
   https://github.com/Importmoz/bill-check.git
   ```
3. Selecione o branch `main`
4. Escolha o tipo de serviço: **Web Application**
5. Configuração automática:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Port**: `3000`
   - **Pasta Pública**: `/` (raiz)

6. Adicione as variáveis de ambiente:
   - `POCKETBASE_URL`: URL do seu servidor PocketBase
   - `PORT`: 3000 (geralmente automático)
   - `NODE_ENV`: production

7. Clique em "Deploy"

### Método 2: Usando Docker

O projeto inclui `Dockerfile` e `docker-compose.yml` para deploy com Docker.

1. No Coolify, selecione "Docker Compose" ou "Dockerfile"
2. Para Docker Compose, use o arquivo `docker-compose.yml`
3. Para Dockerfile, o Coolify detectará automaticamente

### Configuração do PocketBase

A aplicação requer um servidor PocketBase com as seguintes coleções:

1. **users** (padrão do PocketBase)
2. **tables** com campos: `name`, `user_id`
3. **containers** com campos: `table_id`, `container_id`, `duty`, `freight`, `user_id`
4. **balance** com campos: `table_id`, `amount`, `date`, `user_id`

**Importante**: Configure as regras de API no PocketBase para restringir acesso por `user_id`:
- Para cada coleção, adicione regra: `user_id = @request.auth.id`

## Variáveis de Ambiente

| Variável | Descrição | Valor Padrão |
|----------|-----------|--------------|
| `POCKETBASE_URL` | URL do servidor PocketBase | URL hardcoded no código |
| `PORT` | Porta do servidor web | 3000 |
| `NODE_ENV` | Ambiente Node.js | production |

## Estrutura de Arquivos

```
├── index.html          # Página principal
├── style.css           # Estilos CSS
├── app.js              # Lógica da aplicação
├── server.js           # Servidor Node.js
├── package.json        # Dependências Node.js
├── Dockerfile          # Configuração Docker
├── docker-compose.yml  # Docker Compose
├── .env.example        # Exemplo de variáveis de ambiente
└── README.md           # Esta documentação
```

## Notas de Desenvolvimento

- A aplicação é uma SPA (Single Page Application)
- Todas as chamadas API são feitas diretamente para o PocketBase do frontend
- O servidor Node.js apenas serve arquivos estáticos
- O CORS deve estar configurado no PocketBase para permitir o domínio de deploy

## Problemas Comuns

1. **Erro de CORS**: Configure o PocketBase para permitir o domínio da sua aplicação.
2. **Erro 403**: Verifique as regras de API no PocketBase (`user_id = @request.auth.id`).
3. **Variáveis de ambiente não carregadas**: No Coolify, certifique-se de adicionar todas as variáveis na seção "Environment".

## Licença

Privado