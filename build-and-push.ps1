# ProAbsence v1.0.0 - Skrypt budowania i publikacji
# Autor: Sebastian Serafin
# Data: 13.05.2026

$VERSION = "1.0.0"
$DOCKER_USER = "sserafinroboczy"
$APP_NAME = "proabsence"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ProAbsence v$VERSION - Build & Push" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Sprawdź czy Docker jest uruchomiony
Write-Host "[1/6] Sprawdzanie Docker..." -ForegroundColor Yellow
docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "BŁĄD: Docker nie jest uruchomiony!" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Docker działa" -ForegroundColor Green

# Logowanie do Docker Hub
Write-Host ""
Write-Host "[2/6] Logowanie do Docker Hub..." -ForegroundColor Yellow
docker login
if ($LASTEXITCODE -ne 0) {
    Write-Host "BŁĄD: Nie udało się zalogować do Docker Hub!" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Zalogowano" -ForegroundColor Green

# Budowanie obrazu Frontend
Write-Host ""
Write-Host "[3/6] Budowanie obrazu Frontend..." -ForegroundColor Yellow
docker build -t "${DOCKER_USER}/${APP_NAME}-frontend:${VERSION}" -t "${DOCKER_USER}/${APP_NAME}-frontend:latest" -f Dockerfile.frontend .
if ($LASTEXITCODE -ne 0) {
    Write-Host "BŁĄD: Nie udało się zbudować obrazu Frontend!" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Frontend zbudowany" -ForegroundColor Green

# Budowanie obrazu Backend
Write-Host ""
Write-Host "[4/6] Budowanie obrazu Backend..." -ForegroundColor Yellow
docker build -t "${DOCKER_USER}/${APP_NAME}-backend:${VERSION}" -t "${DOCKER_USER}/${APP_NAME}-backend:latest" -f Dockerfile.backend .
if ($LASTEXITCODE -ne 0) {
    Write-Host "BŁĄD: Nie udało się zbudować obrazu Backend!" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Backend zbudowany" -ForegroundColor Green

# Push obrazów do Docker Hub
Write-Host ""
Write-Host "[5/6] Publikacja obrazów do Docker Hub..." -ForegroundColor Yellow

Write-Host "  -> ${DOCKER_USER}/${APP_NAME}-frontend:${VERSION}" -ForegroundColor Gray
docker push "${DOCKER_USER}/${APP_NAME}-frontend:${VERSION}"
docker push "${DOCKER_USER}/${APP_NAME}-frontend:latest"

Write-Host "  -> ${DOCKER_USER}/${APP_NAME}-backend:${VERSION}" -ForegroundColor Gray
docker push "${DOCKER_USER}/${APP_NAME}-backend:${VERSION}"
docker push "${DOCKER_USER}/${APP_NAME}-backend:latest"

if ($LASTEXITCODE -ne 0) {
    Write-Host "BŁĄD: Nie udało się opublikować obrazów!" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Obrazy opublikowane" -ForegroundColor Green

# Podsumowanie
Write-Host ""
Write-Host "[6/6] Podsumowanie" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Opublikowane obrazy:" -ForegroundColor White
Write-Host "  - ${DOCKER_USER}/${APP_NAME}-frontend:${VERSION}" -ForegroundColor Green
Write-Host "  - ${DOCKER_USER}/${APP_NAME}-frontend:latest" -ForegroundColor Green
Write-Host "  - ${DOCKER_USER}/${APP_NAME}-backend:${VERSION}" -ForegroundColor Green
Write-Host "  - ${DOCKER_USER}/${APP_NAME}-backend:latest" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Następne kroki:" -ForegroundColor Yellow
Write-Host "1. Wypchnij zmiany do GitHub: git push origin main" -ForegroundColor White
Write-Host "2. Utwórz tag: git tag -a v${VERSION} -m 'Release v${VERSION}'" -ForegroundColor White
Write-Host "3. Wypchnij tag: git push origin v${VERSION}" -ForegroundColor White
Write-Host ""
