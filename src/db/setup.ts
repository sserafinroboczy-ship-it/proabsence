import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const db = new Database(path.join(process.cwd(), "database.sqlite"));

db.pragma("journal_mode = WAL");

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS halls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- 'admin', 'foreman', 'guest'
    hall_id INTEGER,
    FOREIGN KEY (hall_id) REFERENCES halls(id)
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    hall_id INTEGER NOT NULL,
    position TEXT,
    FOREIGN KEY (hall_id) REFERENCES halls(id)
  );

  CREATE TABLE IF NOT EXISTS absences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    type TEXT NOT NULL, -- 'present', 'vacation', 'sick', 'unplanned'
    overtime_hours INTEGER DEFAULT 0,
    working_hours INTEGER DEFAULT 8,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migration: Add working_hours to absences if it doesn't exist
try {
  db.exec("ALTER TABLE absences ADD COLUMN working_hours INTEGER DEFAULT 8");
} catch (e) {
  // Column might already exist, ignore error
}

// Migration: Add force_password_change to users if it doesn't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN force_password_change INTEGER DEFAULT 0");
} catch (e) {
  // Column might already exist, ignore error
}

// Migration: Add employee_number to employees if it doesn't exist
try {
  db.exec("ALTER TABLE employees ADD COLUMN employee_number TEXT");
} catch (e) {
  // Column might already exist, ignore error
}

// Migration: Add employee_number to users if it doesn't exist (for foreman/mistrz)
try {
  db.exec("ALTER TABLE users ADD COLUMN employee_number TEXT");
} catch (e) {
  // Column might already exist, ignore error
}

// Migration: Add employment_type to employees (Etat, Agencja, DG)
try {
  db.exec("ALTER TABLE employees ADD COLUMN employment_type TEXT DEFAULT 'Etat'");
} catch (e) {
  // Column might already exist, ignore error
}

// Migration: Translate existing logs to Polish
try {
  db.exec(`
    UPDATE logs SET action = 'UTWORZONO_UZYTKOWNIKA', details = replace(details, 'Created user', 'Utworzono użytkownika') WHERE action = 'CREATE_USER';
    UPDATE logs SET action = 'ZMIANA_HASLA', details = 'Użytkownik zmienił swoje hasło' WHERE action = 'CHANGE_PASSWORD';
    UPDATE logs SET action = 'RESET_HASLA', details = replace(details, 'Reset password for user ID', 'Zresetowano hasło dla użytkownika ID') WHERE action = 'RESET_PASSWORD';
    UPDATE logs SET action = 'USUNIETO_UZYTKOWNIKA', details = replace(details, 'Deleted user ID', 'Usunięto użytkownika ID') WHERE action = 'DELETE_USER';
    UPDATE logs SET action = 'UTWORZONO_HALE', details = replace(details, 'Created hall', 'Utworzono halę') WHERE action = 'CREATE_HALL';
    UPDATE logs SET action = 'AKTUALIZACJA_HALI', details = replace(details, 'Updated hall ID', 'Zaktualizowano halę ID') WHERE action = 'UPDATE_HALL';
    UPDATE logs SET action = 'UTWORZONO_PRACOWNIKA', details = replace(details, 'Created employee', 'Dodano pracownika') WHERE action = 'CREATE_EMPLOYEE';
    UPDATE logs SET action = 'AKTUALIZACJA_PRACOWNIKA', details = replace(details, 'Updated employee ID', 'Zaktualizowano pracownika ID') WHERE action = 'UPDATE_EMPLOYEE';
    UPDATE logs SET action = 'USUNIETO_PRACOWNIKA', details = replace(details, 'Deleted employee ID', 'Usunięto pracownika ID') WHERE action = 'DELETE_EMPLOYEE';
    UPDATE logs SET action = 'AKTUALIZACJA_ABSENCJI', details = replace(replace(details, 'Updated absence for employee', 'Zaktualizowano absencję pracownika ID'), 'on', 'w dniu') WHERE action = 'UPDATE_ABSENCE';
  `);
} catch (e) {
  console.error("Log translation migration failed:", e);
}

// Migration: Add calendar notes tables
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      user_id INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS calendar_note_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      user_id INTEGER,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES calendar_notes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
} catch (e) {
  console.error("Calendar notes migration failed:", e);
}

// Migration: Add note_reads table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_reads (
      user_id INTEGER,
      note_id INTEGER,
      last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, note_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (note_id) REFERENCES calendar_notes(id) ON DELETE CASCADE
    );
  `);
} catch (e) {
  console.error("Note reads migration failed:", e);
}

// Create default users
const adminHash = bcrypt.hashSync("admin123", 10);
const superHash = bcrypt.hashSync("super123", 10);

const seedUser = (username: string, passwordHash: string, role: string) => {
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (!exists) {
    db.prepare("INSERT INTO users (username, password, role, force_password_change) VALUES (?, ?, ?, 0)")
      .run(username, passwordHash, role);
  } else {
    db.prepare("UPDATE users SET password = ?, force_password_change = 0 WHERE username = ?")
      .run(passwordHash, username);
  }
};

seedUser("admin", adminHash, "admin");
seedUser("administrator", adminHash, "admin");
seedUser("super", superHash, "admin");
seedUser("guest", bcrypt.hashSync("guest123", 10), "guest");

// Migration: Add note_reads table if not exists (already there but keeping flow)

// Migration: Add settings table for hour limits
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    )
  `);
  // Insert default hour limits if not exist
  db.exec(`INSERT OR IGNORE INTO settings (key, value) VALUES ('hours_limit_agencja', '200')`);
  db.exec(`INSERT OR IGNORE INTO settings (key, value) VALUES ('hours_limit_dg', '200')`);
} catch (e) {
  // Table might already exist
}

// Migration: Add hours_limit to employees (individual limit override)
try {
  db.exec("ALTER TABLE employees ADD COLUMN hours_limit INTEGER");
} catch (e) {
  // Column might already exist, ignore error
}

// Migration: Add notification_emails table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch (e) {
  // Table might already exist
}

// Migration: Add limit_exceeded_notifications table (to track sent notifications)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS limit_exceeded_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, month),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);
} catch (e) {
  // Table might already exist
}

// Seed some sample data if empty
const hallsCount = db.prepare("SELECT COUNT(*) as count FROM halls").get() as any;
if (hallsCount.count === 0) {
  const insertHall = db.prepare("INSERT INTO halls (name, is_active) VALUES (?, ?)");
  const h1 = insertHall.run("Hala 1", 1).lastInsertRowid;
  const h2 = insertHall.run("Hala 2", 1).lastInsertRowid;
  
  const insertEmp = db.prepare("INSERT INTO employees (first_name, last_name, hall_id, position) VALUES (?, ?, ?, ?)");
  insertEmp.run("Jan", "Kowalski", h1, "Ślusarz");
  insertEmp.run("Anna", "Nowak", h1, "Spawacz");
  insertEmp.run("Piotr", "Wiśniewski", h2, "Brygadzista");
  insertEmp.run("Katarzyna", "Wójcik", h2, "Operator CNC");
}

export default db;
