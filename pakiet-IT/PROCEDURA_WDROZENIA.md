# ProAbsence v1.0.0 - Procedura wdrożenia

**System zarządzania obecnością pracowników**

**Autor:** Sebastian Serafin  
**Data wydania:** 13.05.2026  
**Wersja:** 1.0.0

---

## Spis treści

1. [Informacje ogólne](#1-informacje-ogólne)
2. [Wymagania systemowe](#2-wymagania-systemowe)
3. [Architektura aplikacji](#3-architektura-aplikacji)
4. [Procedura wdrożenia](#4-procedura-wdrożenia)
5. [Konfiguracja](#5-konfiguracja)
6. [Weryfikacja wdrożenia](#6-weryfikacja-wdrożenia)
7. [Zarządzanie aplikacją](#7-zarządzanie-aplikacją)
8. [Backup i przywracanie](#8-backup-i-przywracanie)
9. [Aktualizacja](#9-aktualizacja)
10. [Rozwiązywanie problemów](#10-rozwiązywanie-problemów)
11. [Kontakt](#11-kontakt)

---

## 1. Informacje ogólne

### Opis aplikacji

ProAbsence to system zarządzania obecnością pracowników na halach produkcyjnych. Umożliwia:

- Rejestrację obecności i godzin pracy
- Kontrolę limitów godzin dla pracowników Agencja/DG
- Automatyczne powiadomienia email o przekroczeniu limitów
- Zarządzanie urlopami i nieobecnościami
- Generowanie raportów i eksport do Excel
- Automatyczne kopie zapasowe

### Dane dostępowe (domyślne)

| Parametr | Wartość |
|----------|---------|
| URL | http://ADRES_SERWERA |
| Login | admin |
| Hasło | admin123 |

⚠️ **WAŻNE:** Zmień hasło administratora po pierwszym logowaniu!

---

## 2. Wymagania systemowe

### Serwer

| Komponent | Minimum | Zalecane |
|-----------|---------|----------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 MB | 1 GB |
| Dysk | 1 GB | 5 GB |
| System | Linux (Docker) | Ubuntu 22.04 LTS |

### Oprogramowanie

- Docker 20.10+
- Docker Compose 2.0+

### Sieć

| Port | Protokół | Opis |
|------|----------|------|
| 80 | TCP | HTTP (aplikacja) |
| 587 | TCP | SMTP (wychodzące, dla maili) |

---

## 3. Architektura aplikacji

```
┌─────────────────────────────────────────────────────────┐
│                      SERWER                              │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │    Frontend     │    │         Backend             │ │
│  │    (Nginx)      │───▶│       (Express.js)          │ │
│  │    Port: 80     │    │       Port: 3000            │ │
│  └─────────────────┘    └──────────────┬──────────────┘ │
│                                        │                 │
│                         ┌──────────────▼──────────────┐ │
│                         │        SQLite DB            │ │
│                         │     (Volume: data)          │ │
│                         └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Kontenery Docker

| Kontener | Obraz | Port | Opis |
|----------|-------|------|------|
| proabsence-frontend | sserafinroboczy/proabsence-frontend:1.0.0 | 80 | Nginx + React |
| proabsence-backend | sserafinroboczy/proabsence-backend:1.0.0 | 3000 | Express API |

### Wolumeny

| Wolumin | Ścieżka | Opis |
|---------|---------|------|
| proabsence_data | /app/data | Baza danych SQLite |
| ./backups | /app/backups | Kopie zapasowe |

---

## 4. Procedura wdrożenia

### Krok 1: Przygotowanie serwera

```bash
# Zaloguj się na serwer
ssh user@ADRES_SERWERA

# Utwórz folder aplikacji
sudo mkdir -p /opt/proabsence
cd /opt/proabsence

# Utwórz folder na backupy
mkdir -p backups
```

### Krok 2: Skopiowanie plików

Skopiuj pliki z pakietu wdrożeniowego:

```bash
# Z lokalnego komputera (Windows PowerShell)
scp docker-compose.yml user@ADRES_SERWERA:/opt/proabsence/
scp env.example user@ADRES_SERWERA:/opt/proabsence/.env
```

Lub ręcznie utwórz pliki na serwerze.

### Krok 3: Konfiguracja zmiennych środowiskowych

```bash
cd /opt/proabsence

# Edytuj plik .env
nano .env
```

Zawartość pliku `.env`:

```env
# Port aplikacji
PORT=80

# Klucz JWT (min. 32 znaki)
JWT_SECRET=ProAbsence2026!IMC-Engineering@SecureKey#PL

# Konfiguracja SMTP
SMTP_HOST=imcpoland.home.pl
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=aplikacje.imc@imcpoland.home.pl
SMTP_PASS=AplikowanieWdw74!c
SMTP_FROM_NAME=ProAbsence
SMTP_FROM_EMAIL=aplikacje.imc@imcpoland.home.pl
```

### Krok 4: Pobranie obrazów Docker

```bash
# Zaloguj się do Docker Hub (jeśli wymagane)
docker login

# Pobierz obrazy
docker pull sserafinroboczy/proabsence-frontend:1.0.0
docker pull sserafinroboczy/proabsence-backend:1.0.0
```

### Krok 5: Uruchomienie aplikacji

```bash
cd /opt/proabsence

# Uruchom kontenery
docker-compose up -d

# Sprawdź status
docker-compose ps
```

Oczekiwany wynik:

```
NAME                    STATUS              PORTS
proabsence-frontend     Up (healthy)        0.0.0.0:80->80/tcp
proabsence-backend      Up (healthy)        3000/tcp
```

---

## 5. Konfiguracja

### Zmienne środowiskowe

| Zmienna | Opis | Wymagana | Domyślna |
|---------|------|----------|----------|
| `PORT` | Port HTTP | Nie | 80 |
| `JWT_SECRET` | Klucz szyfrowania JWT | **Tak** | - |
| `SMTP_HOST` | Serwer SMTP | Nie* | imcpoland.home.pl |
| `SMTP_PORT` | Port SMTP | Nie | 587 |
| `SMTP_SECURE` | SSL/TLS | Nie | false |
| `SMTP_USER` | Login SMTP | Nie* | - |
| `SMTP_PASS` | Hasło SMTP | Nie* | - |
| `SMTP_FROM_NAME` | Nazwa nadawcy | Nie | ProAbsence |
| `SMTP_FROM_EMAIL` | Email nadawcy | Nie* | - |

*Wymagane dla funkcji powiadomień email

### Konfiguracja SMTP (powiadomienia email)

Aplikacja wysyła automatyczne powiadomienia email gdy pracownik Agencja/DG przekroczy limit godzin.

Domyślna konfiguracja używa serwera: `imcpoland.home.pl`

---

## 6. Weryfikacja wdrożenia

### Sprawdzenie statusu kontenerów

```bash
docker-compose ps
```

### Sprawdzenie logów

```bash
# Wszystkie logi
docker-compose logs

# Logi na żywo
docker-compose logs -f

# Logi konkretnego kontenera
docker-compose logs backend
docker-compose logs frontend
```

### Test dostępności

```bash
# Test HTTP
curl -I http://localhost

# Test API
curl http://localhost/api/health
```

### Checklist weryfikacji

- [ ] Kontenery uruchomione (status: Up)
- [ ] Strona logowania dostępna w przeglądarce
- [ ] Logowanie działa (admin/admin123)
- [ ] Dashboard wyświetla dane
- [ ] Panel Admina dostępny
- [ ] Eksport Excel działa
- [ ] Powiadomienia email działają (opcjonalnie)

---

## 7. Zarządzanie aplikacją

### Uruchomienie

```bash
cd /opt/proabsence
docker-compose up -d
```

### Zatrzymanie

```bash
docker-compose down
```

### Restart

```bash
docker-compose restart
```

### Restart pojedynczego kontenera

```bash
docker-compose restart backend
docker-compose restart frontend
```

### Sprawdzenie logów

```bash
# Ostatnie 100 linii
docker-compose logs --tail=100

# Logi na żywo
docker-compose logs -f

# Logi z timestampem
docker-compose logs -t
```

### Sprawdzenie zużycia zasobów

```bash
docker stats
```

---

## 8. Backup i przywracanie

### Automatyczne backupy

Aplikacja tworzy automatyczne kopie zapasowe:
- **Częstotliwość:** co 24 godziny
- **Retencja:** ostatnie 7 kopii
- **Lokalizacja:** `/opt/proabsence/backups/`

### Ręczny backup

```bash
# Backup bazy danych
docker-compose exec backend cp /app/database.sqlite /app/backups/manual_$(date +%Y%m%d_%H%M%S).sqlite

# Sprawdź backupy
ls -la backups/
```

### Przywracanie z backupu

```bash
# Zatrzymaj aplikację
docker-compose down

# Przywróć backup
docker-compose run --rm backend cp /app/backups/NAZWA_BACKUPU.sqlite /app/database.sqlite

# Uruchom aplikację
docker-compose up -d
```

### Eksport backupu na zewnętrzny serwer

```bash
scp /opt/proabsence/backups/*.sqlite user@backup-server:/backups/proabsence/
```

---

## 9. Aktualizacja

### Aktualizacja do nowej wersji

```bash
cd /opt/proabsence

# Zatrzymaj aplikację
docker-compose down

# Pobierz nowe obrazy
docker-compose pull

# Uruchom nową wersję
docker-compose up -d

# Sprawdź logi
docker-compose logs -f
```

### Rollback do poprzedniej wersji

Edytuj `docker-compose.yml` i zmień tagi obrazów na poprzednią wersję:

```yaml
image: sserafinroboczy/proabsence-frontend:POPRZEDNIA_WERSJA
image: sserafinroboczy/proabsence-backend:POPRZEDNIA_WERSJA
```

Następnie:

```bash
docker-compose up -d
```

---

## 10. Rozwiązywanie problemów

### Problem: Aplikacja nie startuje

```bash
# Sprawdź logi
docker-compose logs backend

# Sprawdź czy porty są wolne
netstat -tlnp | grep 80
netstat -tlnp | grep 3000
```

### Problem: Błąd połączenia z bazą danych

```bash
# Sprawdź wolumin
docker volume ls | grep proabsence

# Sprawdź uprawnienia
docker-compose exec backend ls -la /app/
```

### Problem: Brak powiadomień email

1. Sprawdź konfigurację SMTP w `.env`
2. Sprawdź logi:
   ```bash
   docker-compose logs backend | grep -i smtp
   docker-compose logs backend | grep -i mail
   ```
3. Sprawdź czy port 587 jest otwarty (firewall)

### Problem: Wolne działanie

```bash
# Sprawdź zużycie zasobów
docker stats

# Restart kontenerów
docker-compose restart
```

### Reset do ustawień fabrycznych

⚠️ **UWAGA:** To usunie wszystkie dane!

```bash
docker-compose down -v
docker-compose up -d
```

---

## 11. Kontakt

W razie problemów skontaktuj się z autorem:

**Sebastian Serafin**  
Email: sebastian.serafin@imcpoland.pl

---

## Historia zmian

| Wersja | Data | Opis |
|--------|------|------|
| 1.0.0 | 13.05.2026 | Pierwsza wersja produkcyjna |

