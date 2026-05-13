# ProAbsence v1.0.0

System zarządzania obecnością pracowników na halach produkcyjnych.

**Autor:** Sebastian Serafin  
**Data wydania:** 13.05.2026

## Funkcje

- 📊 **Dashboard** - statystyki globalne i per hala, wykresy obecności, alerty
- 📝 **Karta obecności** - wprowadzanie godzin, nadgodzin, absencji
- ⏱️ **Limity godzin** - kontrola limitów dla pracowników Agencja/DG z alertami
- � **Powiadomienia email** - automatyczne alerty o przekroczeniu limitów godzin
- �📅 **Kalendarz** - notatki, święta, historia zmian
- 👥 **Panel Admina** - zarządzanie użytkownikami, halami, pracownikami
- 📤 **Eksport Excel** - dane obecności i logi systemowe
- 💾 **Automatyczny backup** - co 24h, ostatnie 7 kopii
- 🔐 **Role użytkowników** - admin, mistrz, brygadzista, gość

## Uruchomienie z Docker

```bash
# Pobierz obrazy
docker pull sserafinroboczy/proabsence-frontend:1.0.0
docker pull sserafinroboczy/proabsence-backend:1.0.0

# Uruchom z docker-compose
docker-compose up -d
```

## Uruchomienie lokalne

**Wymagania:** Node.js 20+

```bash
# Instalacja zależności
npm install

# Skopiuj i skonfiguruj zmienne środowiskowe
cp .env.example .env

# Uruchomienie w trybie developerskim
npm run dev

# Budowanie produkcyjne
npm run build
```

## Zmienne środowiskowe

| Zmienna | Opis | Domyślnie |
|---------|------|-----------|
| `PORT` | Port aplikacji | 3000 |
| `JWT_SECRET` | Klucz JWT | (wymagany w produkcji) |
| `SMTP_HOST` | Serwer SMTP | imcpoland.home.pl |
| `SMTP_PORT` | Port SMTP | 587 |
| `SMTP_USER` | Login SMTP | (wymagany dla maili) |
| `SMTP_PASS` | Hasło SMTP | (wymagany dla maili) |
| `SMTP_FROM_NAME` | Nazwa nadawcy | ProAbsence |
| `SMTP_FROM_EMAIL` | Email nadawcy | (wymagany dla maili) |

## Domyślne dane logowania

- **Login:** admin
- **Hasło:** admin123

## Technologie

- React 19 + TypeScript
- TailwindCSS
- Express.js
- SQLite (better-sqlite3)
- Nodemailer
- Recharts
- Docker

## Docker Hub

- Frontend: `sserafinroboczy/proabsence-frontend:1.0.0`
- Backend: `sserafinroboczy/proabsence-backend:1.0.0`

## GitHub

Repository: `https://github.com/sserafinroboczy/proabsence`
