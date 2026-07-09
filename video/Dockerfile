# Remotion-renderserver voor Railway (Linux). macOS kan Remotion's compositor
# vanaf macOS 13+ pas draaien; op Linux werkt het out-of-the-box mits de
# Chromium-systeemlibs aanwezig zijn.
FROM node:20-bookworm-slim

# Chrome Headless Shell / Remotion-compositor systeemafhankelijkheden.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies eerst (betere layer-caching).
COPY package.json package-lock.json ./
RUN npm ci

# Broncode.
COPY . .

# Chrome Headless Shell vooraf downloaden zodat de eerste render snel is.
RUN npx remotion browser ensure

# Railway zet $PORT; server.mjs leest die.
CMD ["node", "server.mjs"]
