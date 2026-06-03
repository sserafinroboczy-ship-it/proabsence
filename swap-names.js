/**
 * Skrypt do zamiany imienia i nazwiska w bazie danych
 * 
 * UWAGA: Ten skrypt zamienia wartości kolumn first_name i last_name
 * dla wszystkich pracowników w bazie danych.
 * 
 * Użycie:
 *   node swap-names.js
 * 
 * Przed uruchomieniem zrób backup bazy danych!
 */

const Database = require('better-sqlite3');
const path = require('path');

// Ścieżka do bazy danych
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('=== Skrypt zamiany imienia i nazwiska ===\n');
console.log(`Baza danych: ${dbPath}\n`);

try {
  const db = new Database(dbPath);
  
  // Pobierz wszystkich pracowników przed zmianą
  const employeesBefore = db.prepare('SELECT id, first_name, last_name FROM employees').all();
  
  console.log(`Znaleziono ${employeesBefore.length} pracowników.\n`);
  console.log('PRZED zamianą:');
  employeesBefore.forEach(emp => {
    console.log(`  ID ${emp.id}: ${emp.first_name} ${emp.last_name}`);
  });
  
  // Zamiana first_name <-> last_name
  console.log('\nWykonuję zamianę...\n');
  
  const updateStmt = db.prepare(`
    UPDATE employees 
    SET first_name = last_name, 
        last_name = first_name
  `);
  
  const result = updateStmt.run();
  
  console.log(`Zaktualizowano ${result.changes} rekordów.\n`);
  
  // Pobierz pracowników po zmianie
  const employeesAfter = db.prepare('SELECT id, first_name, last_name FROM employees').all();
  
  console.log('PO zamianie:');
  employeesAfter.forEach(emp => {
    console.log(`  ID ${emp.id}: ${emp.first_name} ${emp.last_name}`);
  });
  
  console.log('\n✅ Zamiana zakończona pomyślnie!');
  console.log('\nTeraz w aplikacji będzie wyświetlane: Nazwisko Imię');
  console.log('(gdzie "Nazwisko" to teraz wartość z kolumny first_name, a "Imię" z last_name)');
  
  db.close();
  
} catch (error) {
  console.error('❌ Błąd:', error.message);
  process.exit(1);
}
