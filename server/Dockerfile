FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server.js fetch-ytdlp.js ./

EXPOSE 8000
CMD ["node", "server.js"]
