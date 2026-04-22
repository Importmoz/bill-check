# Painel de Controlo Duty & Freight

Aplicação web para gestão de custos de shipping (Duty & Freight) com integração PocketBase.

## Funcionalidades

### 1. Módulo BILL (Duty & Freight)
- CRUD de tabelas de custos
- Gestão de contentores (containers)
- Registro de pagamentos parciais/totais
- Cálculo automático de diferenças e saldos

### 2. Módulo TEAM (Relatórios de Equipa)
- Gestão de equipas e grupos de trabalho
- Relatórios de produtividade e pagamentos internos
- Agrupamento dinâmico de registos por categoria

### 3. Módulo TERM (Prazos de Contentor)
- Controlo de ETA (Estimated Time of Arrival) e prazos
- Automação de status (**PENDING** vs **NEXT**) baseada no calendário
- Destaque visual para pagamentos efetuados (**PAID**)
- Cálculos de 50% e balanço por contentor

### Funcionalidades Globais
- Autenticação de utilizadores
- Exportação de tabelas como PNG
- Dashboard unificado com resumo geral
- Isolamento de dados por utilizador (Segurança via PB)

## Tecnologias

- Frontend: HTML5, CSS3, JavaScript vanilla
- UI: Tailwind CSS (Configuração neo-brutalista)
- Backend: PocketBase (externo)
- Servidor: Node.js + Express (para deploy)

## Configuração do PocketBase

A aplicação requer um servidor PocketBase com as seguintes coleções configuradas. Para todas as coleções, aplique a regra de API: `user_id = @request.auth.id`.

### Módulo BILL
- **tables**: `name`, `user_id`
- **containers**: `table_id`, `container_id`, `duty`, `freight`, `user_id`
- **balance**: `table_id`, `amount`, `date`, `user_id`

### Módulo TEAM
- **team_tables**: `name`, `user_id`
- **team_groups**: `name`, `table_id`, `user_id`
- **team_records**: `table_id`, `group_id`, `user_id`, `name`, `interna_val`, `interna_month`, `interna_paid`

### Módulo TERM
- **term_v2_tables**: `name`, `user_id`
- **term_v2_records**: `table_id`, `user_id`, `container_id_str`, `eta`, `tcs`, `unit`, `status`

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