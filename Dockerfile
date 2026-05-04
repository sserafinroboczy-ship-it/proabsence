# ProAbsence v1.0.0
# System zarządzania obecnością pracowników
# Autor: Sebastian Serafin

FROM node:20-alpine

WORKDIR /app

# Instalacja zależności systemowych dla better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite

# Kopiowanie plików package
COPY package*.json ./

# Instalacja wszystkich zależności (potrzebne do budowania)
RUN npm ci

# Kopiowanie kodu źródłowego
COPY . .

# Budowanie frontendu
RUN npm run build

# Usunięcie devDependencies po buildzie
RUN npm prune --production

# Instalacja tsx globalnie do uruchomienia serwera
RUN npm install -g tsx

# Tworzenie folderów na dane
RUN mkdir -p /app/data /app/backups

# Ustawienie zmiennych środowiskowych
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Uruchomienie serwera
CMD ["tsx", "server.ts"]
