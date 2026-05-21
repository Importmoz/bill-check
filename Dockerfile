FROM node:20-slim

# Instalar Python e dependências de sistema para o Pandas
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Criar diretório da aplicação
WORKDIR /app

# Criar e ativar um ambiente virtual para o Python (melhor prática que --break-system-packages)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copiar package.json e instalar dependências Node
COPY package*.json ./
RUN npm install --only=production

# Copiar requisitos do Python e instalar no ambiente virtual
COPY src/python/requirements.txt ./src/python/
RUN pip install --no-cache-dir -r src/python/requirements.txt

# Copiar o restante do código da aplicação
COPY . .

# Criar pastas locais para garantir a sua existência
RUN mkdir -p /app/data /app/tmp /app/logs

EXPOSE 3000

CMD ["npm", "start"]
