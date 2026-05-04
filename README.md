# ProAbsence v1.0.0

System zarządzania obecnością pracowników na halach produkcyjnych.

**Autor:** Sebastian Serafin

## Funkcje

- 📊 **Dashboard** - statystyki globalne i per hala, wykresy obecności
- 📝 **Karta obecności** - wprowadzanie godzin, nadgodzin, absencji
- 📅 **Kalendarz** - notatki, święta, historia zmian
- 👥 **Panel Admina** - zarządzanie użytkownikami, halami, pracownikami
- 📤 **Eksport Excel** - dane obecności i logi systemowe
- 💾 **Automatyczny backup** - co 24h, ostatnie 7 kopii
- 🔐 **Role użytkowników** - admin, mistrz, brygadzista, gość

## Uruchomienie z Docker

```bash
# Pobierz obraz
docker pull sserafinroboczy/proabsence:1.0.0

# Uruchom z docker-compose
docker-compose up -d
```

## Uruchomienie lokalne

**Wymagania:** Node.js 20+

```bash
# Instalacja zależności
npm install

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
| `NODE_ENV` | Środowisko | development |

## Domyślne dane logowania

- **Login:** admin
- **Hasło:** admin123

## Technologie

- React 19 + TypeScript
- TailwindCSS
- Express.js
- SQLite (better-sqlite3)
- Recharts
- Docker
