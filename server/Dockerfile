FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Download standalone yt-dlp binary
RUN mkdir -p /app/bin && \
    curl -L -o /app/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux && \
    chmod +x /app/bin/yt-dlp

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

EXPOSE 8000
CMD ["node", "server.js"]
