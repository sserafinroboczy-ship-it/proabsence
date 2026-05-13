# ProAbsence v1.0.0 - Procedura obsługi systemu

**System zarządzania obecnością pracowników**

**Autor:** Sebastian Serafin  
**Data wydania:** 13.05.2026  
**Wersja:** 1.0.0

---

## Spis treści

1. [Cel dokumentu](#1-cel-dokumentu)
2. [Procedura codzienna - Mistrz/Brygadzista](#2-procedura-codzienna---mistrzbrygadzista)
3. [Procedura tygodniowa - Mistrz](#3-procedura-tygodniowa---mistrz)
4. [Procedura miesięczna - Admin](#4-procedura-miesięczna---admin)
5. [Procedura zarządzania limitami godzin](#5-procedura-zarządzania-limitami-godzin)
6. [Procedura obsługi alertów](#6-procedura-obsługi-alertów)
7. [Procedura dodawania pracownika](#7-procedura-dodawania-pracownika)
8. [Procedura usuwania pracownika](#8-procedura-usuwania-pracownika)
9. [Procedura tworzenia użytkownika](#9-procedura-tworzenia-użytkownika)
10. [Procedura eksportu danych](#10-procedura-eksportu-danych)
11. [Procedura awaryjna](#11-procedura-awaryjna)

---

## 1. Cel dokumentu

Dokument opisuje standardowe procedury obsługi systemu ProAbsence dla różnych ról użytkowników. Przestrzeganie procedur zapewnia poprawność danych i efektywne wykorzystanie systemu.

---

## 2. Procedura codzienna - Mistrz/Brygadzista

### Cel
Rejestracja obecności i godzin pracy pracowników.

### Kiedy wykonywać
Codziennie, najlepiej na koniec zmiany lub następnego dnia rano.

### Kroki

| Krok | Akcja | Uwagi |
|------|-------|-------|
| 1 | Zaloguj się do systemu | Użyj swojego loginu i hasła |
| 2 | Przejdź do **Wprowadzanie Danych** | Menu boczne |
| 3 | Wybierz swoją halę | Lista na górze ekranu |
| 4 | Sprawdź czy wybrany jest bieżący miesiąc | Selektor miesiąca |
| 5 | Znajdź kolumnę z dzisiejszą datą | Przewiń tabelę w prawo |
| 6 | Dla każdego pracownika wpisz: | |
| 6a | - Liczbę przepracowanych godzin (np. `8`, `10`) | Lub kod nieobecności |
| 6b | - Lub kod nieobecności (`UW`, `CH`, `NŻ`, etc.) | Patrz tabela kodów |
| 7 | Sprawdź kolumnę **Limit** dla Agencja/DG | Czerwony = ostrzeżenie |
| 8 | Wyloguj się po zakończeniu | Przycisk w prawym górnym rogu |

### Kody nieobecności

| Kod | Znaczenie |
|-----|-----------|
| `UW` | Urlop wypoczynkowy |
| `CH` / `L4` | Chorobowe |
| `NŻ` | Nieobecność nieplanowana |
| `OP` | Opieka |
| `KR` | Oddawanie krwi |
| `BL` | Urlop bezpłatny |

### Weryfikacja

- [ ] Wszystkie obecności wprowadzone
- [ ] Brak pustych komórek dla obecnych pracowników
- [ ] Limity godzin sprawdzone (Agencja/DG)

---

## 3. Procedura tygodniowa - Mistrz

### Cel
Weryfikacja danych i kontrola limitów.

### Kiedy wykonywać
Raz w tygodniu, najlepiej w piątek lub poniedziałek.

### Kroki

| Krok | Akcja | Uwagi |
|------|-------|-------|
| 1 | Zaloguj się do systemu | |
| 2 | Przejdź do **Pulpit** | |
| 3 | Wybierz swoją halę | |
| 4 | Sprawdź sekcję **Alerty** | |
| 5 | Przeanalizuj alert **Braki kadrowe jutro** | Zaplanuj zastępstwa |
| 6 | Sprawdź **Powtarzające się nieobecności** | Rozważ rozmowę z pracownikiem |
| 7 | Przejdź do **Wprowadzanie Danych** | |
| 8 | Sprawdź kolumnę **Limit** | Pracownicy Agencja/DG |
| 9 | Dla pracowników z limitem < 50h | Zaplanuj ograniczenie godzin |
| 10 | Eksportuj dane do Excel (opcjonalnie) | Przycisk 📥 |

### Weryfikacja

- [ ] Alerty przeanalizowane
- [ ] Limity godzin pod kontrolą
- [ ] Braki kadrowe zaplanowane

---

## 4. Procedura miesięczna - Admin

### Cel
Zamknięcie miesiąca, weryfikacja danych, raportowanie.

### Kiedy wykonywać
Pierwszy tydzień nowego miesiąca.

### Kroki

| Krok | Akcja | Uwagi |
|------|-------|-------|
| 1 | Zaloguj się jako Admin | |
| 2 | Przejdź do **Wprowadzanie Danych** | |
| 3 | Wybierz **poprzedni miesiąc** | |
| 4 | Dla każdej hali: | |
| 4a | - Sprawdź kompletność danych | Brak pustych komórek |
| 4b | - Eksportuj do Excel | Archiwizacja |
| 5 | Przejdź do **Panel Admina** | |
| 6 | Sekcja **Logi systemowe** | |
| 7 | Wybierz poprzedni miesiąc | |
| 8 | Eksportuj logi do Excel | Archiwizacja |
| 9 | Sprawdź sekcję **Limity godzin** | |
| 10 | Dostosuj limity na nowy miesiąc (jeśli potrzeba) | |
| 11 | Sprawdź **Kopie zapasowe** | Min. 7 kopii |
| 12 | Utwórz ręczną kopię zapasową | Przycisk "Utwórz backup" |

### Weryfikacja

- [ ] Dane poprzedniego miesiąca kompletne
- [ ] Eksporty Excel zapisane
- [ ] Logi wyeksportowane
- [ ] Limity zaktualizowane
- [ ] Backup utworzony

---

## 5. Procedura zarządzania limitami godzin

### Cel
Ustawienie i monitorowanie limitów godzin dla pracowników Agencja/DG.

### Kto wykonuje
Administrator

### Ustawienie limitów

| Krok | Akcja |
|------|-------|
| 1 | Zaloguj się jako Admin |
| 2 | Przejdź do **Panel Admina** |
| 3 | Znajdź sekcję **Limity godzin** |
| 4 | Ustaw **Limit Agencja** (np. 200) |
| 5 | Kliknij **Zapisz** przy polu Agencja |
| 6 | Ustaw **Limit DG** (np. 200) |
| 7 | Kliknij **Zapisz** przy polu DG |

### Monitorowanie limitów

| Krok | Akcja |
|------|-------|
| 1 | Przejdź do **Wprowadzanie Danych** |
| 2 | Sprawdź kolumnę **Limit** |
| 3 | Wartości < 20 pulsują na czerwono |
| 4 | Wartości ujemne = przekroczenie |

### Powiadomienia email

System automatycznie wysyła email gdy:
- Pracownik przekroczy limit (wartość < 0)
- Email wysyłany do wszystkich adresów z listy powiadomień

### Konfiguracja powiadomień

| Krok | Akcja |
|------|-------|
| 1 | Panel Admina → **Powiadomienia mailowe** |
| 2 | Wpisz adres email |
| 3 | Kliknij **Dodaj** |
| 4 | Powtórz dla wszystkich odbiorców |

---

## 6. Procedura obsługi alertów

### Alert: Braki kadrowe jutro

| Krok | Akcja |
|------|-------|
| 1 | Sprawdź listę nieobecnych jutro |
| 2 | Zidentyfikuj typ nieobecności (urlop, L4, etc.) |
| 3 | Zaplanuj zastępstwa |
| 4 | Poinformuj zespół |

### Alert: Powtarzające się nieobecności

| Krok | Akcja |
|------|-------|
| 1 | Sprawdź listę pracowników |
| 2 | Przeanalizuj wzorzec nieobecności |
| 3 | Rozważ rozmowę z pracownikiem |
| 4 | Udokumentuj ustalenia |

### Alert: Limit urlopu

| Krok | Akcja |
|------|-------|
| 1 | Sprawdź listę pracowników |
| 2 | Skontaktuj się z pracownikiem |
| 3 | Zaplanuj wykorzystanie urlopu |

### Alert: Przekroczenie limitu godzin

| Krok | Akcja |
|------|-------|
| 1 | Zidentyfikuj pracownika |
| 2 | Sprawdź szczegóły (ile godzin przekroczono) |
| 3 | Ogranicz dalsze godziny pracy |
| 4 | Skontaktuj się z działem HR/kadr |
| 5 | Udokumentuj sytuację |

---

## 7. Procedura dodawania pracownika

### Kto wykonuje
Mistrz, Admin

### Kroki

| Krok | Akcja | Uwagi |
|------|-------|-------|
| 1 | Przejdź do **Wprowadzanie Danych** | |
| 2 | Wybierz halę pracownika | |
| 3 | Przewiń na dół strony | Formularz dodawania |
| 4 | Wypełnij **Nr pracownika** | Unikalny numer |
| 5 | Wypełnij **Imię** | |
| 6 | Wypełnij **Nazwisko** | |
| 7 | Wypełnij **Stanowisko** | |
| 8 | Wybierz **Formę zatrudnienia** | Etat / Agencja / DG |
| 9 | Kliknij **Dodaj pracownika** | |
| 10 | Sprawdź czy pracownik pojawił się na liście | |

### Weryfikacja

- [ ] Pracownik widoczny w tabeli
- [ ] Dane poprawne
- [ ] Forma zatrudnienia prawidłowa

---

## 8. Procedura usuwania pracownika

### Kto wykonuje
Tylko Administrator

### Kroki

| Krok | Akcja | Uwagi |
|------|-------|-------|
| 1 | Przejdź do **Panel Admina** | |
| 2 | Sekcja **Baza pracowników** | |
| 3 | Znajdź pracownika (użyj filtrów) | |
| 4 | Kliknij **Usuń** przy pracowniku | |
| 5 | Potwierdź usunięcie | ⚠️ Operacja nieodwracalna |

### Uwagi

⚠️ **WAŻNE:** Usunięcie pracownika usuwa również jego historię obecności!

Rozważ alternatywę:
- Przeniesienie do nieaktywnej hali
- Zmiana statusu zamiast usunięcia

---

## 9. Procedura tworzenia użytkownika

### Kto wykonuje
Tylko Administrator

### Kroki

| Krok | Akcja | Uwagi |
|------|-------|-------|
| 1 | Przejdź do **Panel Admina** | |
| 2 | Sekcja **Zarządzanie użytkownikami** | |
| 3 | Wypełnij **Login** | Unikalny |
| 4 | Wypełnij **Hasło** | Min. 6 znaków |
| 5 | Wybierz **Rolę** | Admin / Mistrz / Brygadzista / Gość |
| 6 | Wybierz **Halę** (dla Mistrza/Brygadzisty) | |
| 7 | Opcjonalnie: **Nr pracownika** | Powiązanie z pracownikiem |
| 8 | Kliknij **Dodaj użytkownika** | |
| 9 | Przekaż dane logowania użytkownikowi | Bezpiecznie! |

### Role i uprawnienia

| Rola | Uprawnienia |
|------|-------------|
| Admin | Pełny dostęp |
| Mistrz | Wprowadzanie danych, podgląd |
| Brygadzista | Wprowadzanie danych (ograniczone) |
| Gość | Tylko podgląd |

---

## 10. Procedura eksportu danych

### Eksport karty obecności

| Krok | Akcja |
|------|-------|
| 1 | Przejdź do **Wprowadzanie Danych** |
| 2 | Wybierz halę |
| 3 | Wybierz miesiąc |
| 4 | Kliknij ikonę **📥 Eksport Excel** |
| 5 | Zapisz plik |

### Eksport logów systemowych

| Krok | Akcja |
|------|-------|
| 1 | Przejdź do **Panel Admina** |
| 2 | Sekcja **Logi systemowe** |
| 3 | Wybierz miesiąc |
| 4 | Kliknij **Eksport Excel** |
| 5 | Zapisz plik |

### Nazewnictwo plików

Zalecane nazewnictwo:
- `ProAbsence_Hala1_2026-05.xlsx`
- `ProAbsence_Logi_2026-05.xlsx`

---

## 11. Procedura awaryjna

### System nie odpowiada

| Krok | Akcja |
|------|-------|
| 1 | Odśwież stronę (F5) |
| 2 | Wyczyść cache (Ctrl+Shift+Delete) |
| 3 | Spróbuj innej przeglądarki |
| 4 | Skontaktuj się z IT |

### Błąd logowania

| Krok | Akcja |
|------|-------|
| 1 | Sprawdź poprawność loginu i hasła |
| 2 | Sprawdź czy Caps Lock jest wyłączony |
| 3 | Skontaktuj się z administratorem |

### Dane nie zapisują się

| Krok | Akcja |
|------|-------|
| 1 | Sprawdź połączenie internetowe |
| 2 | Odśwież stronę |
| 3 | Spróbuj ponownie |
| 4 | Skontaktuj się z IT |

### Utrata danych

| Krok | Akcja |
|------|-------|
| 1 | **NIE PANIKUJ** |
| 2 | Skontaktuj się z administratorem |
| 3 | System posiada automatyczne kopie zapasowe |
| 4 | Administrator przywróci dane z backupu |

---

## Kontakt

**Administrator systemu:**  
Sebastian Serafin  
Email: sebastian.serafin@imcpoland.pl

---

*ProAbsence v1.0.0 © 2026 Sebastian Serafin*
