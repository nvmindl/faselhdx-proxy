FROM node:18-slim

# Install Chromium, Xvfb (virtual display), and required dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    dbus \
    fonts-liberation \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV DISPLAY=:99

WORKDIR /app
COPY package.json .
RUN npm install --production
COPY server.js .
EXPOSE 3000

# Start Xvfb virtual display, then launch Node app
CMD Xvfb :99 -screen 0 1280x720x24 -nolisten tcp &>/dev/null & \
    sleep 1 && \
    node server.js
