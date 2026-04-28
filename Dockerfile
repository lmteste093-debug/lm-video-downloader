FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --upgrade yt-dlp

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN mkdir -p downloads

EXPOSE 3000

CMD ["node", "server.js"]