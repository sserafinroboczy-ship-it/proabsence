# PROCEDURA OBSŁUGI SYSTEMU ProAbsence

**Numer procedury:** PRO-PA-001  
**Wersja:** 1.0  
**Data wydania:** 13.05.2026  
**Autor:** Sebastian Serafin

---

## SPIS TREŚCI

1. Cel procedury
2. Zakres stosowania
3. Odpowiedzialność osób
4. Opis postępowania
5. Dokumenty powiązane
6. Definicje i terminologia
7. Historia zmian

---

## 1. CEL PROCEDURY

Celem niniejszej procedury jest określenie zasad i sposobu obsługi systemu ProAbsence służącego do zarządzania obecnością pracowników na halach produkcyjnych.

Procedura ma na celu:
- Zapewnienie prawidłowego wprowadzania danych o obecności pracowników
- Określenie odpowiedzialności poszczególnych użytkowników systemu
- Standaryzację procesów związanych z ewidencją czasu pracy
- Zapewnienie kontroli limitów godzin dla pracowników Agencja/DG
- Określenie zasad reagowania na alerty systemowe

---

## 2. ZAKRES STOSOWANIA

### 2.1. Zakres przedmiotowy

Procedura obejmuje następujące obszary:
- Codzienne wprowadzanie danych o obecności pracowników
- Rejestrację godzin pracy i nadgodzin
- Ewidencję urlopów i nieobecności
- Kontrolę limitów godzin dla pracowników Agencja/DG
- Zarządzanie użytkownikami i uprawnieniami
- Zarządzanie halami produkcyjnymi
- Obsługę alertów i powiadomień systemowych
- Eksport danych do plików Excel
- Tworzenie i przywracanie kopii zapasowych

### 2.2. Zakres podmiotowy

Procedura dotyczy wszystkich użytkowników systemu ProAbsence:
- Administratorów systemu
- Mistrzów produkcji
- Brygadzistów
- Użytkowników z uprawnieniami podglądu (Gość)

### 2.3. Zakres terytorialny

Procedura obowiązuje we wszystkich lokalizacjach firmy, w których wdrożony jest system ProAbsence.

---

## 3. ODPOWIEDZIALNOŚĆ OSÓB

### 3.1. Administrator systemu

Administrator systemu odpowiada za:

| Obszar | Zakres odpowiedzialności |
|--------|--------------------------|
| Użytkownicy | Tworzenie, edycja i usuwanie kont użytkowników |
| Hale | Dodawanie, aktywacja/dezaktywacja i usuwanie hal |
| Limity | Ustawianie limitów godzin dla pracowników Agencja/DG |
| Powiadomienia | Konfiguracja adresów email do powiadomień |
| Pracownicy | Edycja i usuwanie pracowników z bazy |
| Backup | Nadzór nad kopiami zapasowymi, przywracanie danych |
| Logi | Przeglądanie i eksport logów systemowych |
| Wsparcie | Pomoc techniczna dla pozostałych użytkowników |

### 3.2. Mistrz produkcji

Mistrz produkcji odpowiada za:

| Obszar | Zakres odpowiedzialności |
|--------|--------------------------|
| Obecność | Codzienne wprowadzanie danych o obecności pracowników |
| Godziny | Rejestracja przepracowanych godzin i nadgodzin |
| Nieobecności | Wprowadzanie urlopów, zwolnień i innych nieobecności |
| Limity | Monitorowanie limitów godzin pracowników Agencja/DG |
| Alerty | Reagowanie na alerty o brakach kadrowych |
| Pracownicy | Dodawanie nowych pracowników do systemu |
| Raporty | Eksport danych obecności do Excel |

### 3.3. Brygadzista

Brygadzista odpowiada za:

| Obszar | Zakres odpowiedzialności |
|--------|--------------------------|
| Obecność | Wprowadzanie danych o obecności w przypisanej hali |
| Godziny | Rejestracja przepracowanych godzin |
| Raportowanie | Zgłaszanie nieprawidłowości do Mistrza |

### 3.4. Gość

Użytkownik z rolą Gość:

| Obszar | Zakres odpowiedzialności |
|--------|--------------------------|
| Podgląd | Przeglądanie danych na pulpicie |
| Brak edycji | Brak możliwości wprowadzania zmian |

---

## 4. OPIS POSTĘPOWANIA

### 4.1. Procedura codzienna - wprowadzanie obecności

**Wykonuje:** Mistrz, Brygadzista  
**Częstotliwość:** Codziennie, na koniec zmiany lub następnego dnia rano

| Krok | Czynność | Uwagi |
|:----:|----------|-------|
| 1 | Zaloguj się do systemu ProAbsence | Użyj przydzielonego loginu i hasła |
| 2 | Wybierz **Wprowadzanie Danych** z menu bocznego | |
| 3 | Wybierz właściwą halę z listy na górze ekranu | |
| 4 | Upewnij się, że wybrany jest bieżący miesiąc | |
| 5 | Znajdź kolumnę odpowiadającą bieżącej dacie | Przewiń tabelę w prawo |
| 6 | Dla każdego pracownika wprowadź dane: | |
| 6a | - Liczbę przepracowanych godzin (np. 8, 10, 7.5) | Dla obecnych pracowników |
| 6b | - Lub kod nieobecności (UW, CH, NŻ, OP, KR, BL) | Dla nieobecnych pracowników |
| 7 | Sprawdź kolumnę **Limit** dla pracowników Agencja/DG | Czerwony kolor = ostrzeżenie |
| 8 | Wyloguj się po zakończeniu pracy | Przycisk w prawym górnym rogu |

**Kody nieobecności:**

| Kod | Znaczenie |
|-----|-----------|
| UW | Urlop wypoczynkowy |
| CH / L4 | Chorobowe / zwolnienie lekarskie |
| NŻ | Nieobecność nieusprawiedliwiona |
| OP | Opieka nad dzieckiem |
| KR | Oddawanie krwi |
| BL | Urlop bezpłatny |

### 4.2. Procedura tygodniowa - weryfikacja danych

**Wykonuje:** Mistrz  
**Częstotliwość:** Raz w tygodniu (piątek lub poniedziałek)

| Krok | Czynność | Uwagi |
|:----:|----------|-------|
| 1 | Zaloguj się do systemu | |
| 2 | Przejdź do **Pulpit** | |
| 3 | Wybierz swoją halę | |
| 4 | Przeanalizuj sekcję **Alerty**: | |
| 4a | - Braki kadrowe jutro | Zaplanuj zastępstwa |
| 4b | - Powtarzające się nieobecności | Rozważ rozmowę z pracownikiem |
| 4c | - Przekroczenie limitu godzin | Ogranicz godziny pracownika |
| 5 | Przejdź do **Wprowadzanie Danych** | |
| 6 | Sprawdź kolumnę **Limit** dla Agencja/DG | |
| 7 | Dla pracowników z limitem < 50h zaplanuj ograniczenie | |
| 8 | Opcjonalnie: eksportuj dane do Excel | Przycisk 📥 |

### 4.3. Procedura miesięczna - zamknięcie miesiąca

**Wykonuje:** Administrator  
**Częstotliwość:** Pierwszy tydzień nowego miesiąca

| Krok | Czynność | Uwagi |
|:----:|----------|-------|
| 1 | Zaloguj się jako Administrator | |
| 2 | Przejdź do **Wprowadzanie Danych** | |
| 3 | Wybierz **poprzedni miesiąc** | |
| 4 | Dla każdej hali: | |
| 4a | - Sprawdź kompletność danych | Brak pustych komórek |
| 4b | - Eksportuj dane do Excel | Archiwizacja |
| 5 | Przejdź do **Panel Admina** | |
| 6 | Sekcja **Logi systemowe** - wybierz poprzedni miesiąc | |
| 7 | Eksportuj logi do Excel | Archiwizacja |
| 8 | Sprawdź sekcję **Limity godzin** | |
| 9 | Dostosuj limity na nowy miesiąc (jeśli potrzeba) | |
| 10 | Sprawdź **Kopie zapasowe** | Minimum 7 kopii |
| 11 | Utwórz ręczną kopię zapasową | Przycisk "Utwórz backup" |

### 4.4. Procedura zarządzania limitami godzin

**Wykonuje:** Administrator  
**Częstotliwość:** Według potrzeb

#### 4.4.1. Ustawienie limitów

| Krok | Czynność |
|:----:|----------|
| 1 | Przejdź do **Panel Admina** |
| 2 | Znajdź sekcję **Limity godzin** |
| 3 | Ustaw **Limit Agencja** (np. 200 godzin/miesiąc) |
| 4 | Kliknij **Zapisz** |
| 5 | Ustaw **Limit DG** (np. 200 godzin/miesiąc) |
| 6 | Kliknij **Zapisz** |

#### 4.4.2. Konfiguracja powiadomień email

| Krok | Czynność |
|:----:|----------|
| 1 | Przejdź do **Panel Admina** |
| 2 | Znajdź sekcję **Powiadomienia mailowe** |
| 3 | Wpisz adres email odbiorcy |
| 4 | Kliknij **Dodaj** |
| 5 | Powtórz dla wszystkich odbiorców |

**Uwaga:** System automatycznie wysyła powiadomienie email gdy pracownik Agencja/DG przekroczy miesięczny limit godzin.

### 4.5. Procedura dodawania pracownika

**Wykonuje:** Mistrz, Administrator  
**Częstotliwość:** Według potrzeb

| Krok | Czynność | Uwagi |
|:----:|----------|-------|
| 1 | Przejdź do **Wprowadzanie Danych** | |
| 2 | Wybierz halę pracownika | |
| 3 | Przewiń na dół strony | Formularz dodawania |
| 4 | Wypełnij **Nr pracownika** | Unikalny numer |
| 5 | Wypełnij **Imię** | |
| 6 | Wypełnij **Nazwisko** | |
| 7 | Wypełnij **Stanowisko** | |
| 8 | Wybierz **Formę zatrudnienia** | Etat / Agencja / DG |
| 9 | Kliknij **Dodaj pracownika** | |
| 10 | Zweryfikuj czy pracownik pojawił się na liście | |

### 4.6. Procedura usuwania pracownika

**Wykonuje:** Administrator  
**Częstotliwość:** Według potrzeb

| Krok | Czynność | Uwagi |
|:----:|----------|-------|
| 1 | Przejdź do **Panel Admina** | |
| 2 | Wybierz sekcję **Baza pracowników** | |
| 3 | Znajdź pracownika (użyj filtrów) | |
| 4 | Kliknij **Usuń** przy pracowniku | |
| 5 | Potwierdź usunięcie | ⚠️ Operacja nieodwracalna |

**UWAGA:** Usunięcie pracownika powoduje usunięcie całej jego historii obecności!

### 4.7. Procedura tworzenia użytkownika

**Wykonuje:** Administrator  
**Częstotliwość:** Według potrzeb

| Krok | Czynność | Uwagi |
|:----:|----------|-------|
| 1 | Przejdź do **Panel Admina** | |
| 2 | Wybierz sekcję **Zarządzanie użytkownikami** | |
| 3 | Wypełnij **Login** | Unikalny |
| 4 | Wypełnij **Hasło** | Minimum 6 znaków |
| 5 | Wybierz **Rolę** | Admin / Mistrz / Brygadzista / Gość |
| 6 | Wybierz **Halę** | Dla Mistrza/Brygadzisty |
| 7 | Kliknij **Dodaj użytkownika** | |
| 8 | Przekaż dane logowania użytkownikowi | W sposób bezpieczny |

### 4.8. Procedura eksportu danych

**Wykonuje:** Administrator, Mistrz  
**Częstotliwość:** Według potrzeb

#### 4.8.1. Eksport karty obecności

| Krok | Czynność |
|:----:|----------|
| 1 | Przejdź do **Wprowadzanie Danych** |
| 2 | Wybierz halę |
| 3 | Wybierz miesiąc |
| 4 | Kliknij przycisk **📥 Eksport Excel** |
| 5 | Zapisz plik |

#### 4.8.2. Eksport logów systemowych (tylko Administrator)

| Krok | Czynność |
|:----:|----------|
| 1 | Przejdź do **Panel Admina** |
| 2 | Wybierz sekcję **Logi systemowe** |
| 3 | Wybierz miesiąc |
| 4 | Kliknij **Eksport Excel** |
| 5 | Zapisz plik |

**Zalecane nazewnictwo plików:**
- `ProAbsence_[NazwaHali]_[RRRR-MM].xlsx`
- `ProAbsence_Logi_[RRRR-MM].xlsx`

### 4.9. Procedura awaryjna

#### 4.9.1. System nie odpowiada

| Krok | Czynność |
|:----:|----------|
| 1 | Odśwież stronę (klawisz F5) |
| 2 | Wyczyść cache przeglądarki (Ctrl+Shift+Delete) |
| 3 | Spróbuj innej przeglądarki |
| 4 | Skontaktuj się z działem IT |

#### 4.9.2. Błąd logowania

| Krok | Czynność |
|:----:|----------|
| 1 | Sprawdź poprawność loginu i hasła |
| 2 | Sprawdź czy Caps Lock jest wyłączony |
| 3 | Skontaktuj się z Administratorem systemu |

#### 4.9.3. Utrata danych

| Krok | Czynność |
|:----:|----------|
| 1 | Zachowaj spokój |
| 2 | Skontaktuj się z Administratorem systemu |
| 3 | Administrator przywróci dane z kopii zapasowej |

**Uwaga:** System automatycznie tworzy kopie zapasowe co 24 godziny (ostatnie 7 kopii).

---

## 5. DOKUMENTY POWIĄZANE

| Dokument | Opis |
|----------|------|
| INSTRUKCJA_UZYTKOWNIKA.md | Szczegółowa instrukcja obsługi systemu dla użytkowników |
| PROCEDURA_WDROZENIA.md | Procedura wdrożenia systemu na serwerze (dla IT) |
| README.md | Skrócona instrukcja wdrożenia |
| docker-compose.yml | Konfiguracja kontenerów Docker |
| env.txt | Plik konfiguracyjny zmiennych środowiskowych |

---

## 6. DEFINICJE I TERMINOLOGIA

| Termin | Definicja |
|--------|-----------|
| **ProAbsence** | System informatyczny do zarządzania obecnością pracowników |
| **Hala** | Jednostka organizacyjna (hala produkcyjna) w systemie |
| **Karta obecności** | Tabela z danymi o obecności pracowników w danym miesiącu |
| **Limit godzin** | Maksymalna liczba godzin pracy w miesiącu dla pracowników Agencja/DG |
| **Agencja** | Forma zatrudnienia - pracownik z agencji pracy tymczasowej |
| **DG** | Forma zatrudnienia - pracownik na umowie cywilnoprawnej |
| **Etat** | Forma zatrudnienia - pracownik na umowie o pracę |
| **Administrator** | Użytkownik z pełnymi uprawnieniami do zarządzania systemem |
| **Mistrz** | Użytkownik odpowiedzialny za wprowadzanie danych w przypisanych halach |
| **Brygadzista** | Użytkownik z ograniczonymi uprawnieniami do wprowadzania danych |
| **Gość** | Użytkownik z uprawnieniami tylko do podglądu |
| **Alert** | Automatyczne powiadomienie systemowe o zdarzeniu wymagającym uwagi |
| **Backup** | Kopia zapasowa bazy danych systemu |
| **Eksport** | Zapisanie danych z systemu do pliku Excel |

### Kody nieobecności

| Kod | Pełna nazwa |
|-----|-------------|
| UW | Urlop wypoczynkowy |
| CH | Chorobowe |
| L4 | Zwolnienie lekarskie (synonim CH) |
| NŻ | Nieobecność nieusprawiedliwiona |
| OP | Opieka nad dzieckiem |
| KR | Oddawanie krwi |
| BL | Urlop bezpłatny |

---

## 7. HISTORIA ZMIAN

| Wersja | Data | Autor | Opis zmian |
|:------:|:----:|-------|------------|
| 1.0 | 13.05.2026 | Sebastian Serafin | Wydanie pierwsze procedury |

---

**Zatwierdzono do stosowania:**

Data: 13.05.2026

Podpis: _________________________

---

*ProAbsence v1.0.0 © 2026 IMC Poland*
