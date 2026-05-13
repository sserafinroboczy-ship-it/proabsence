# ProAbsence v1.0.0 - Pakiet wdrożeniowy

System zarządzania obecnością pracowników na halach produkcyjnych.

**Autor:** Sebastian Serafin  
**Data wydania:** 13.05.2026

---

## Zawartość pakietu

| Plik | Opis |
|------|------|
| `docker-compose.yml` | Konfiguracja Docker |
| `env.example` | Przykładowy plik zmiennych środowiskowych |
| `README.md` | Instrukcja wdrożenia |

---

## Funkcje aplikacji

- 📊 **Dashboard** - statystyki globalne i per hala, wykresy obecności, alerty
- 📝 **Karta obecności** - wprowadzanie godzin, nadgodzin, absencji
- ⏱️ **Limity godzin** - kontrola limitów dla pracowników Agencja/DG
- 📧 **Powiadomienia email** - automatyczne alerty o przekroczeniu limitów
- 📅 **Kalendarz** - notatki, święta, historia zmian
- 👥 **Panel Admina** - zarządzanie użytkownikami, halami, pracownikami
- 📤 **Eksport Excel** - dane obecności i logi systemowe
- 💾 **Automatyczny backup** - co 24h, ostatnie 7 kopii
- 🔐 **Role użytkowników** - admin, mistrz, brygadzista, gość

---

## Wymagania

- Docker 20.10+
- Docker Compose 2.0+
- Min. 512 MB RAM
- Min. 1 GB miejsca na dysku
- Dostęp do serwera SMTP (dla powiadomień email)

---

## Instrukcja wdrożenia

### 1. Przygotowanie

```bash
# Utwórz folder aplikacji
mkdir -p /opt/proabsence
cd /opt/proabsence

# Skopiuj pliki z pakietu
cp docker-compose.yml .
cp env.example .env
```

### 2. Konfiguracja

Edytuj plik `.env`:

```bash
nano .env
```

**Zmienne środowiskowe:**

| Zmienna | Opis | Wartość domyślna |
|---------|------|------------------|
| `PORT` | Port aplikacji | 80 |
| `JWT_SECRET` | Klucz JWT (min. 32 znaki) | (wymagany) |
| `SMTP_HOST` | Serwer SMTP | imcpoland.home.pl |
| `SMTP_PORT` | Port SMTP | 587 |
| `SMTP_SECURE` | SSL/TLS | false |
| `SMTP_USER` | Login SMTP | (skonfigurowany) |
| `SMTP_PASS` | Hasło SMTP | (skonfigurowany) |
| `SMTP_FROM_NAME` | Nazwa nadawcy | ProAbsence |
| `SMTP_FROM_EMAIL` | Email nadawcy | (skonfigurowany) |

### 3. Uruchomienie

```bash
# Pobierz obrazy i uruchom
docker-compose up -d

# Sprawdź status
docker-compose ps

# Sprawdź logi
docker-compose logs -f
```

### 4. Weryfikacja

Aplikacja dostępna pod adresem: `http://ADRES_SERWERA` (port 80)

**Domyślne dane logowania:**
- Login: `admin`
- Hasło: `admin123`

⚠️ **WAŻNE:** Zmień hasło administratora po pierwszym logowaniu!

---

## Zarządzanie

### Restart aplikacji
```bash
docker-compose restart
```

### Zatrzymanie
```bash
docker-compose down
```

### Aktualizacja do nowej wersji
```bash
docker-compose pull
docker-compose up -d
```

### Backup bazy danych
Backupy są tworzone automatycznie co 24h w folderze `./backups/`

Ręczny backup:
```bash
docker-compose exec backend cp /app/database.sqlite /app/backups/manual_backup_$(date +%Y%m%d_%H%M%S).sqlite
```

### Logi
```bash
# Wszystkie logi
docker-compose logs

# Logi na żywo
docker-compose logs -f

# Ostatnie 100 linii
docker-compose logs --tail=100
```

---

## Porty

| Port | Usługa |
|------|--------|
| 80 | Frontend (Nginx) |
| 3000 | Backend API (wewnętrzny) |

---

## Wolumeny

| Wolumin | Ścieżka w kontenerze | Opis |
|---------|---------------------|------|
| `proabsence_data` | `/app/data` | Dane aplikacji |
| `./backups` | `/app/backups` | Kopie zapasowe |

---

## Rozwiązywanie problemów

### Aplikacja nie startuje
```bash
docker-compose logs backend
```

### Brak połączenia z bazą danych
Sprawdź czy wolumin istnieje:
```bash
docker volume ls | grep proabsence
```

### Reset do ustawień fabrycznych
```bash
docker-compose down -v
docker-compose up -d
```
⚠️ **UWAGA:** To usunie wszystkie dane!

---

## Kontakt

W razie problemów skontaktuj się z autorem: **Sebastian Serafin**
