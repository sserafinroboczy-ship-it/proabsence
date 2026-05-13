# ProAbsence v1.0.0 - Instrukcja użytkownika

**System zarządzania obecnością pracowników**

**Autor:** Sebastian Serafin  
**Data wydania:** 13.05.2026  
**Wersja:** 1.0.0

---

## Spis treści

1. [Wprowadzenie](#1-wprowadzenie)
2. [Logowanie do systemu](#2-logowanie-do-systemu)
3. [Pulpit (Dashboard)](#3-pulpit-dashboard)
4. [Wprowadzanie danych (Karta obecności)](#4-wprowadzanie-danych-karta-obecności)
5. [Kalendarz](#5-kalendarz)
6. [Panel Admina](#6-panel-admina)
7. [Role użytkowników](#7-role-użytkowników)
8. [Skróty i kody](#8-skróty-i-kody)
9. [Eksport danych](#9-eksport-danych)
10. [Często zadawane pytania (FAQ)](#10-często-zadawane-pytania-faq)

---

## 1. Wprowadzenie

### Czym jest ProAbsence?

ProAbsence to system do zarządzania obecnością pracowników na halach produkcyjnych. Umożliwia:

- Rejestrację godzin pracy i nadgodzin
- Ewidencję urlopów i nieobecności
- Kontrolę limitów godzin dla pracowników Agencja/DG
- Automatyczne powiadomienia email o przekroczeniu limitów
- Generowanie raportów i eksport do Excel

### Wymagania

- Przeglądarka internetowa (Chrome, Firefox, Edge)
- Dostęp do sieci firmowej
- Konto użytkownika w systemie

---

## 2. Logowanie do systemu

### Dostęp do aplikacji

1. Otwórz przeglądarkę internetową
2. Wpisz adres: **http://[ADRES_SERWERA]**
3. Pojawi się ekran logowania

### Ekran logowania

![Ekran logowania](screenshots/login.png)

1. **Login** - wpisz swoją nazwę użytkownika
2. **Hasło** - wpisz swoje hasło
3. Kliknij przycisk **Zaloguj**

### Pierwsze logowanie

Przy pierwszym logowaniu użyj danych otrzymanych od administratora.

⚠️ **WAŻNE:** Zmień hasło po pierwszym logowaniu!

### Wylogowanie

Kliknij przycisk **Wyloguj** w prawym górnym rogu ekranu.

---

## 3. Pulpit (Dashboard)

Po zalogowaniu zobaczysz pulpit z podsumowaniem danych.

### Elementy pulpitu

#### Pasek wyboru hali

Na górze ekranu znajduje się lista hal. Kliknij nazwę hali, aby zobaczyć jej statystyki.

- **Wszystkie hale** - podsumowanie globalne
- **Hala 1, Hala 2, ...** - statystyki konkretnej hali

#### Kafelki statystyk

| Kafelek | Opis |
|---------|------|
| 👥 **Pracownicy** | Liczba pracowników na hali |
| ✅ **Obecni dziś** | Liczba obecnych pracowników |
| 🏖️ **Urlopy** | Liczba pracowników na urlopie |
| 🏥 **Chorobowe** | Liczba pracowników na L4 |
| ⏰ **Suma godzin** | Łączna liczba przepracowanych godzin |
| 💼 **Nadgodziny** | Łączna liczba nadgodzin |

#### Wykresy

- **Wykres obecności** - pokazuje rozkład obecności w czasie
- **Wykres godzin** - pokazuje przepracowane godziny

#### Alerty i ostrzeżenia

System wyświetla automatyczne alerty:

| Alert | Opis |
|-------|------|
| 📅 **Braki kadrowe jutro** | Lista pracowników nieobecnych jutro |
| 🔄 **Powtarzające się nieobecności** | Pracownicy z częstymi nieobecnościami |
| ⚠️ **Limit urlopu** | Pracownicy zbliżający się do limitu urlopu |
| 🚨 **Przekroczenie limitu godzin** | Pracownicy Agencja/DG z przekroczonym limitem |

---

## 4. Wprowadzanie danych (Karta obecności)

### Dostęp do karty obecności

1. Kliknij **Wprowadzanie Danych** w menu bocznym
2. Wybierz halę z listy na górze
3. Wybierz miesiąc (domyślnie bieżący)

### Wygląd karty obecności

Karta obecności to tabela z:
- **Wiersze** - pracownicy
- **Kolumny** - dni miesiąca + podsumowania

### Kolumny specjalne

| Kolumna | Opis |
|---------|------|
| **Nr** | Numer pracownika |
| **Imię Nazwisko** | Dane pracownika |
| **Forma** | Forma zatrudnienia (Etat/Agencja/DG) |
| **Limit** | Pozostały limit godzin (tylko Agencja/DG) |
| **Suma Godz** | Suma przepracowanych godzin |
| **Nadgodziny** | Suma nadgodzin |
| **UW** | Liczba dni urlopu |
| **CH** | Liczba dni chorobowego |

### Wprowadzanie godzin

1. Kliknij w komórkę odpowiadającą pracownikowi i dniu
2. Wpisz wartość:
   - **Liczba** (np. `8`, `10`, `7.5`) - godziny pracy
   - **Kod nieobecności** (np. `UW`, `CH`) - patrz [Skróty i kody](#8-skróty-i-kody)
3. Naciśnij **Enter** lub **Tab** aby przejść do następnej komórki

### Nawigacja klawiaturą

| Klawisz | Akcja |
|---------|-------|
| **Enter** / **↓** | Przejdź w dół |
| **Tab** | Przejdź w prawo |
| **Shift+Tab** | Przejdź w lewo |
| **↑** | Przejdź w górę |

### Kolumna Limit (Agencja/DG)

Dla pracowników z formą zatrudnienia **Agencja** lub **DG**:

- Wyświetla pozostały limit godzin
- **Kolor żółty** - limit w normie
- **Kolor czerwony pulsujący** - limit poniżej 20h (ostrzeżenie)
- **Wartość ujemna** - limit przekroczony

⚠️ Gdy limit zostanie przekroczony, system automatycznie wysyła powiadomienie email do osób odpowiedzialnych.

### Kolorowanie komórek

| Kolor | Znaczenie |
|-------|-----------|
| Biały | Dzień roboczy |
| Szary | Weekend/święto |
| Zielony | Urlop (UW) |
| Czerwony | Chorobowe (CH/L4) |
| Pomarańczowy | Nieplanowana nieobecność (NŻ) |
| Niebieski | Opieka (OP) |
| Fioletowy | Krew (KR) |
| Żółty | Bezpłatny (BL) |

### Dodawanie pracownika

1. Wypełnij formularz na dole karty:
   - Nr pracownika
   - Imię
   - Nazwisko
   - Stanowisko
   - Forma zatrudnienia
2. Kliknij **Dodaj pracownika**

---

## 5. Kalendarz

### Dostęp do kalendarza

Kliknij **Kalendarz** w menu bocznym.

### Funkcje kalendarza

#### Notatki

1. Kliknij na dzień w kalendarzu
2. Wpisz notatkę
3. Kliknij **Zapisz**

#### Święta

Dni wolne od pracy są oznaczone kolorem czerwonym.

#### Historia zmian

Kliknij **Historia** aby zobaczyć ostatnie zmiany w systemie.

---

## 6. Panel Admina

⚠️ **Dostępny tylko dla administratorów**

### Dostęp

Kliknij **Panel Admina** w menu bocznym (widoczny tylko dla roli Admin).

### Sekcje panelu

#### Zarządzanie użytkownikami

- Dodawanie nowych użytkowników
- Przypisywanie ról
- Przypisywanie do hal
- Usuwanie użytkowników

#### Zarządzanie halami

- Dodawanie nowych hal
- Aktywacja/dezaktywacja hal
- Usuwanie hal

#### Limity godzin

Ustawienie limitów godzin dla pracowników:

| Pole | Opis |
|------|------|
| **Limit Agencja** | Miesięczny limit godzin dla pracowników Agencja |
| **Limit DG** | Miesięczny limit godzin dla pracowników DG |

Po zmianie kliknij **Zapisz**.

#### Powiadomienia mailowe

Lista adresów email osób otrzymujących powiadomienia o przekroczeniu limitów:

1. Wpisz adres email
2. Kliknij **Dodaj**
3. Aby usunąć - kliknij **Usuń** przy adresie

#### Baza pracowników

- Przeglądanie wszystkich pracowników
- Filtrowanie po imieniu, stanowisku, hali, formie zatrudnienia
- Edycja danych pracownika
- Usuwanie pracownika

#### Logi systemowe

- Historia wszystkich akcji w systemie
- Filtrowanie po miesiącu
- Eksport do Excel

#### Kopie zapasowe

- Lista automatycznych kopii zapasowych
- Tworzenie ręcznej kopii
- Przywracanie z kopii

---

## 7. Role użytkowników

### Admin

Pełny dostęp do wszystkich funkcji:
- ✅ Pulpit
- ✅ Wprowadzanie danych (wszystkie hale)
- ✅ Kalendarz
- ✅ Panel Admina
- ✅ Zarządzanie użytkownikami
- ✅ Zarządzanie halami
- ✅ Ustawienia limitów
- ✅ Eksport danych

### Mistrz

Dostęp do przypisanych hal:
- ✅ Pulpit
- ✅ Wprowadzanie danych (przypisane hale)
- ✅ Kalendarz
- ❌ Panel Admina

### Brygadzista

Ograniczony dostęp:
- ✅ Pulpit (tylko podgląd)
- ✅ Wprowadzanie danych (przypisane hale)
- ❌ Kalendarz (tylko podgląd)
- ❌ Panel Admina

### Gość

Tylko podgląd:
- ✅ Pulpit (tylko podgląd)
- ❌ Wprowadzanie danych
- ❌ Kalendarz
- ❌ Panel Admina

---

## 8. Skróty i kody

### Kody nieobecności

Wpisz kod w komórce karty obecności:

| Kod | Znaczenie | Kolor |
|-----|-----------|-------|
| `UW` | Urlop wypoczynkowy | Zielony |
| `CH` lub `L4` | Chorobowe | Czerwony |
| `NŻ` lub `NZ` | Nieobecność nieplanowana | Pomarańczowy |
| `OP` | Opieka nad dzieckiem | Niebieski |
| `KR` lub `KREW` | Oddawanie krwi | Fioletowy |
| `BL` | Urlop bezpłatny | Żółty |

### Wprowadzanie godzin

| Wartość | Interpretacja |
|---------|---------------|
| `8` | 8 godzin pracy |
| `10` | 8h pracy + 2h nadgodzin |
| `7.5` lub `7,5` | 7.5 godziny pracy |
| `12` | 8h pracy + 4h nadgodzin |

### Weekendy i święta

Godziny wpisane w weekendy/święta są automatycznie liczone jako nadgodziny.

---

## 9. Eksport danych

### Eksport karty obecności

1. Przejdź do **Wprowadzanie Danych**
2. Wybierz halę i miesiąc
3. Kliknij przycisk **Eksport Excel** (ikona 📥)
4. Plik zostanie pobrany automatycznie

### Eksport logów (tylko Admin)

1. Przejdź do **Panel Admina**
2. Sekcja **Logi systemowe**
3. Wybierz miesiąc
4. Kliknij **Eksport Excel**

---

## 10. Często zadawane pytania (FAQ)

### Jak zmienić hasło?

Skontaktuj się z administratorem systemu.

### Nie widzę swojej hali

Twoje konto nie ma przypisanej tej hali. Skontaktuj się z administratorem.

### Komórka nie zapisuje wartości

- Sprawdź czy wpisałeś poprawną wartość (liczbę lub kod)
- Sprawdź połączenie z internetem
- Odśwież stronę (F5)

### Limit godzin pulsuje na czerwono

Pracownik zbliża się do lub przekroczył miesięczny limit godzin. Skontaktuj się z przełożonym.

### Nie otrzymuję powiadomień email

Skontaktuj się z administratorem - Twój adres email może nie być dodany do listy powiadomień.

### Jak dodać nowego pracownika?

1. Przejdź do **Wprowadzanie Danych**
2. Wybierz halę
3. Wypełnij formularz na dole strony
4. Kliknij **Dodaj pracownika**

### Jak usunąć pracownika?

Tylko administrator może usunąć pracownika z systemu (Panel Admina → Baza pracowników).

### Dane nie wyświetlają się poprawnie

1. Odśwież stronę (F5)
2. Wyczyść cache przeglądarki (Ctrl+Shift+Delete)
3. Spróbuj innej przeglądarki

---

## Kontakt

W razie problemów technicznych skontaktuj się z:

**Administrator systemu**  
Email: sebastian.serafin@imcpoland.pl

---

*ProAbsence v1.0.0 © 2026 Sebastian Serafin*
