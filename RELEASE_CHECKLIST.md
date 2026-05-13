# ProAbsence v1.0.0 - Checklist wydania

**Data:** 13.05.2026  
**Autor:** Sebastian Serafin

---

## Pre-release

- [x] Wszystkie funkcje zaimplementowane
- [x] Testy manualne przeprowadzone
- [x] Powiadomienia email działają
- [x] Limity godzin działają
- [x] Eksport Excel działa
- [x] Backup automatyczny działa
- [x] Dokumentacja zaktualizowana

---

## Budowanie i publikacja

### 1. Docker Hub

```powershell
# Uruchom skrypt budowania
.\build-and-push.ps1
```

Lub ręcznie:

```powershell
# Zaloguj się do Docker Hub
docker login

# Zbuduj obrazy
docker build -t sserafinroboczy/proabsence-frontend:1.0.0 -f Dockerfile.frontend .
docker build -t sserafinroboczy/proabsence-backend:1.0.0 -f Dockerfile.backend .

# Wypchnij obrazy
docker push sserafinroboczy/proabsence-frontend:1.0.0
docker push sserafinroboczy/proabsence-backend:1.0.0

# Taguj jako latest
docker tag sserafinroboczy/proabsence-frontend:1.0.0 sserafinroboczy/proabsence-frontend:latest
docker tag sserafinroboczy/proabsence-backend:1.0.0 sserafinroboczy/proabsence-backend:latest
docker push sserafinroboczy/proabsence-frontend:latest
docker push sserafinroboczy/proabsence-backend:latest
```

### 2. GitHub

```powershell
# Dodaj wszystkie zmiany
git add .

# Commit
git commit -m "Release v1.0.0 - System zarządzania obecnością"

# Wypchnij do main
git push origin main

# Utwórz tag
git tag -a v1.0.0 -m "ProAbsence v1.0.0 - Pierwsza wersja produkcyjna

Funkcje:
- Dashboard z wykresami i alertami
- Karta obecności z limitami godzin
- Powiadomienia email o przekroczeniu limitów
- Panel Admina
- Eksport Excel
- Automatyczny backup
- Role użytkowników"

# Wypchnij tag
git push origin v1.0.0
```

### 3. GitHub Release (opcjonalnie)

1. Wejdź na: https://github.com/sserafinroboczy/proabsence/releases
2. Kliknij "Create a new release"
3. Wybierz tag: v1.0.0
4. Tytuł: ProAbsence v1.0.0
5. Opis: skopiuj z tagu
6. Załącz pakiet-IT jako ZIP

---

## Post-release

- [ ] Obrazy Docker opublikowane
- [ ] Kod wypchnięty do GitHub
- [ ] Tag v1.0.0 utworzony
- [ ] Pakiet IT przygotowany
- [ ] Dokumentacja wdrożeniowa gotowa

---

## Linki

| Zasób | URL |
|-------|-----|
| Docker Hub Frontend | https://hub.docker.com/r/sserafinroboczy/proabsence-frontend |
| Docker Hub Backend | https://hub.docker.com/r/sserafinroboczy/proabsence-backend |
| GitHub | https://github.com/sserafinroboczy/proabsence |

---

## Obrazy Docker

```
sserafinroboczy/proabsence-frontend:1.0.0
sserafinroboczy/proabsence-frontend:latest
sserafinroboczy/proabsence-backend:1.0.0
sserafinroboczy/proabsence-backend:latest
```
