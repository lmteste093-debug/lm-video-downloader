FROM node:20-slim

# Instala dependências do sistema e yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instala yt-dlp usando pip (forçando instalação)
RUN python3 -m pip install --no-cache-dir --break-system-packages yt-dlp

# Verifica instalação
RUN yt-dlp --version

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN mkdir -p downloads

EXPOSE 3000

CMD ["node", "server.js"]