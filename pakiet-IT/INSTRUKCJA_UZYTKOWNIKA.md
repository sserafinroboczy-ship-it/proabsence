# ProAbsence v1.0.0 - Instrukcja użytkownika

**System zarządzania obecnością pracowników**

**Autor:** Sebastian Serafin  
**Data wydania:** 13.05.2026  
**Wersja:** 1.0.0

---

## SPIS TREŚCI

**1.** Informacje podstawowe

**2.** Logowanie do systemu

**3.** Pulpit (Dashboard)

**4.** Wprowadzanie obecności (Mistrz/Brygadzista)

**5.** Przeglądanie danych

**6.** Zarządzanie pracownikami

**7.** Zarządzanie limitami godzin (Administrator)

**8.** Zarządzanie użytkownikami (Administrator)

**9.** Zarządzanie halami (Administrator)

**10.** Powiadomienia email

**11.** Historia zmian

---

## 1. Informacje podstawowe

### Czym jest ProAbsence?

ProAbsence to system do zarządzania obecnością pracowników na halach produkcyjnych.

### Główne funkcje

- Rejestracja godzin pracy i nadgodzin
- Ewidencja urlopów i nieobecności
- Kontrola limitów godzin dla pracowników Agencja/DG
- Automatyczne powiadomienia email o przekroczeniu limitów
- Generowanie raportów i eksport do Excel
- Automatyczne kopie zapasowe

### Wymagania

- Przeglądarka internetowa (Chrome, Firefox, Edge)
- Dostęp do sieci firmowej
- Konto użytkownika w systemie

### Role użytkowników

| Rola | Uprawnienia |
|------|-------------|
| **Administrator** | Pełny dostęp do wszystkich funkcji |
| **Mistrz** | Wprowadzanie danych, podgląd statystyk |
| **Brygadzista** | Wprowadzanie danych (ograniczone) |
| **Gość** | Tylko podgląd |

---

## 2. Logowanie do systemu

### Jak się zalogować?

1. Otwórz przeglądarkę internetową
2. Wpisz adres aplikacji: **http://[ADRES_SERWERA]**
3. Wprowadź **Login** i **Hasło**
4. Kliknij przycisk **Zaloguj**

### Pierwsze logowanie

Przy pierwszym logowaniu użyj danych otrzymanych od administratora.

⚠️ **WAŻNE:** Zmień hasło po pierwszym logowaniu!

### Wylogowanie

Kliknij przycisk **Wyloguj** w prawym górnym rogu ekranu.

### Problemy z logowaniem

| Problem | Rozwiązanie |
|---------|-------------|
| Nieprawidłowe hasło | Sprawdź Caps Lock, skontaktuj się z administratorem |
| Konto zablokowane | Skontaktuj się z administratorem |
| Strona nie ładuje się | Sprawdź połączenie z siecią |

---

## 3. Pulpit (Dashboard)

### Opis

Po zalogowaniu zobaczysz pulpit z podsumowaniem danych dla wybranej hali.

### Wybór hali

Na górze ekranu znajduje się lista hal. Kliknij nazwę hali, aby zobaczyć jej statystyki.

### Kafelki statystyk

| Kafelek | Opis |
|---------|------|
| 👥 **Pracownicy** | Liczba pracowników na hali |
| ✅ **Obecni dziś** | Liczba obecnych pracowników |
| 🏖️ **Urlopy** | Liczba pracowników na urlopie |
| 🏥 **Chorobowe** | Liczba pracowników na L4 |
| ⏰ **Suma godzin** | Łączna liczba przepracowanych godzin |
| 💼 **Nadgodziny** | Łączna liczba nadgodzin |

### Alerty i ostrzeżenia

System wyświetla automatyczne alerty:

| Alert | Opis |
|-------|------|
| 📅 **Braki kadrowe jutro** | Lista pracowników nieobecnych jutro |
| 🔄 **Powtarzające się nieobecności** | Pracownicy z częstymi nieobecnościami |
| 🚨 **Przekroczenie limitu godzin** | Pracownicy Agencja/DG z przekroczonym limitem |

---

## 4. Wprowadzanie obecności (Mistrz/Brygadzista)

### Dostęp

1. Kliknij **Wprowadzanie Danych** w menu bocznym
2. Wybierz halę z listy na górze
3. Wybierz miesiąc (domyślnie bieżący)

### Karta obecności

Karta obecności to tabela z pracownikami (wiersze) i dniami miesiąca (kolumny).

### Jak wprowadzić godziny?

1. Kliknij w komórkę odpowiadającą pracownikowi i dniu
2. Wpisz liczbę godzin (np. `8`, `10`, `7.5`)
3. Naciśnij **Enter** aby zapisać

### Jak wprowadzić nieobecność?

Wpisz kod nieobecności w komórce:

| Kod | Znaczenie | Kolor |
|-----|-----------|-------|
| `UW` | Urlop wypoczynkowy | Zielony |
| `CH` lub `L4` | Chorobowe | Czerwony |
| `NŻ` | Nieobecność nieplanowana | Pomarańczowy |
| `OP` | Opieka nad dzieckiem | Niebieski |
| `KR` | Oddawanie krwi | Fioletowy |
| `BL` | Urlop bezpłatny | Żółty |

### Nawigacja klawiaturą

| Klawisz | Akcja |
|---------|-------|
| **Enter** / **↓** | Przejdź w dół |
| **Tab** | Przejdź w prawo |
| **↑** | Przejdź w górę |

### Kolumna Limit (Agencja/DG)

Dla pracowników Agencja/DG wyświetlany jest pozostały limit godzin:

| Kolor | Znaczenie |
|-------|-----------|
| Żółty | Limit w normie |
| Czerwony pulsujący | Limit poniżej 20h - ostrzeżenie |
| Wartość ujemna | Limit przekroczony |

⚠️ Gdy limit zostanie przekroczony, system automatycznie wysyła powiadomienie email.

### Eksport do Excel

1. Kliknij przycisk **📥 Eksport Excel** nad tabelą
2. Plik zostanie pobrany automatycznie

---

## 5. Przeglądanie danych

### Kalendarz

1. Kliknij **Kalendarz** w menu bocznym
2. Przeglądaj dni miesiąca
3. Kliknij na dzień aby zobaczyć szczegóły lub dodać notatkę

### Święta

Dni wolne od pracy są oznaczone kolorem czerwonym w kalendarzu.

### Statystyki

Na pulpicie dostępne są wykresy:
- Wykres obecności w czasie
- Wykres przepracowanych godzin

---

## 6. Zarządzanie pracownikami

### Dodawanie pracownika

1. Przejdź do **Wprowadzanie Danych**
2. Wybierz halę
3. Przewiń na dół strony
4. Wypełnij formularz:
   - Nr pracownika
   - Imię
   - Nazwisko
   - Stanowisko
   - Forma zatrudnienia (Etat/Agencja/DG)
5. Kliknij **Dodaj pracownika**

### Edycja pracownika (Administrator)

1. Przejdź do **Panel Admina**
2. Sekcja **Baza pracowników**
3. Znajdź pracownika (użyj filtrów)
4. Kliknij **Edytuj**
5. Zmień dane i zapisz

### Usuwanie pracownika (Administrator)

1. Przejdź do **Panel Admina**
2. Sekcja **Baza pracowników**
3. Znajdź pracownika
4. Kliknij **Usuń**
5. Potwierdź usunięcie

⚠️ **UWAGA:** Usunięcie pracownika usuwa również jego historię obecności!

---

## 7. Zarządzanie limitami godzin (Administrator)

### Ustawienie limitów

1. Przejdź do **Panel Admina**
2. Znajdź sekcję **Limity godzin**
3. Ustaw **Limit Agencja** (np. 200 godzin/miesiąc)
4. Kliknij **Zapisz**
5. Ustaw **Limit DG** (np. 200 godzin/miesiąc)
6. Kliknij **Zapisz**

### Monitorowanie limitów

1. Przejdź do **Wprowadzanie Danych**
2. Sprawdź kolumnę **Limit** w tabeli
3. Wartości ujemne oznaczają przekroczenie

### Automatyczne powiadomienia

Gdy pracownik przekroczy limit, system automatycznie:
- Wysyła email do wszystkich adresów z listy powiadomień
- Zapisuje informację w logach systemowych

---

## 8. Zarządzanie użytkownikami (Administrator)

### Dodawanie użytkownika

1. Przejdź do **Panel Admina**
2. Sekcja **Zarządzanie użytkownikami**
3. Wypełnij formularz:
   - Login (unikalny)
   - Hasło (min. 6 znaków)
   - Rola (Admin/Mistrz/Brygadzista/Gość)
   - Hala (dla Mistrza/Brygadzisty)
4. Kliknij **Dodaj użytkownika**

### Usuwanie użytkownika

1. Przejdź do **Panel Admina**
2. Sekcja **Zarządzanie użytkownikami**
3. Znajdź użytkownika na liście
4. Kliknij **Usuń**

### Uprawnienia ról

| Funkcja | Admin | Mistrz | Brygadzista | Gość |
|---------|:-----:|:------:|:-----------:|:----:|
| Pulpit | ✅ | ✅ | ✅ | ✅ |
| Wprowadzanie danych | ✅ | ✅ | ✅ | ❌ |
| Kalendarz | ✅ | ✅ | ❌ | ❌ |
| Panel Admina | ✅ | ❌ | ❌ | ❌ |
| Zarządzanie użytkownikami | ✅ | ❌ | ❌ | ❌ |
| Eksport danych | ✅ | ✅ | ❌ | ❌ |

---

## 9. Zarządzanie halami (Administrator)

### Dodawanie hali

1. Przejdź do **Panel Admina**
2. Sekcja **Zarządzanie halami**
3. Wpisz nazwę nowej hali
4. Kliknij **Dodaj halę**

### Aktywacja/Dezaktywacja hali

1. Przejdź do **Panel Admina**
2. Sekcja **Zarządzanie halami**
3. Kliknij przełącznik przy hali

### Usuwanie hali

1. Przejdź do **Panel Admina**
2. Sekcja **Zarządzanie halami**
3. Kliknij **Usuń** przy hali
4. Potwierdź usunięcie

⚠️ **UWAGA:** Usunięcie hali usuwa wszystkich przypisanych pracowników!

---

## 10. Powiadomienia email

### Kiedy wysyłane są powiadomienia?

System automatycznie wysyła email gdy:
- Pracownik Agencja/DG przekroczy miesięczny limit godzin

### Konfiguracja odbiorców (Administrator)

1. Przejdź do **Panel Admina**
2. Sekcja **Powiadomienia mailowe**
3. Wpisz adres email
4. Kliknij **Dodaj**

### Usuwanie odbiorcy

1. Przejdź do **Panel Admina**
2. Sekcja **Powiadomienia mailowe**
3. Kliknij **Usuń** przy adresie email

### Treść powiadomienia

Email zawiera:
- Imię i nazwisko pracownika
- Numer pracownika
- Halę
- Formę zatrudnienia
- Limit godzin
- Wykorzystane godziny
- Przekroczenie

---

## 11. Historia zmian

### Logi systemowe (Administrator)

1. Przejdź do **Panel Admina**
2. Sekcja **Logi systemowe**
3. Wybierz miesiąc
4. Przeglądaj historię zmian

### Co jest logowane?

- Logowania użytkowników
- Zmiany w obecności
- Dodawanie/usuwanie pracowników
- Zmiany ustawień
- Wysłane powiadomienia email

### Eksport logów

1. Przejdź do **Panel Admina**
2. Sekcja **Logi systemowe**
3. Wybierz miesiąc
4. Kliknij **Eksport Excel**

### Kopie zapasowe

System automatycznie tworzy kopie zapasowe:
- **Częstotliwość:** co 24 godziny
- **Retencja:** ostatnie 7 kopii
- **Lokalizacja:** folder `backups/`

---

## Kontakt

W razie problemów technicznych skontaktuj się z:

**Administrator systemu**  
Email: sebastian.serafin@imcpoland.pl

---

*ProAbsence v1.0.0 © 2026 Sebastian Serafin*
