import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const db = new Database(path.join(process.cwd(), "data", "database.sqlite"));

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

// Migration: Add chat_messages table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER, -- NULL = global message, otherwise private
      content TEXT NOT NULL,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_read INTEGER DEFAULT 0,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    )
  `);
} catch (e) {
  // Table might already exist
}

// Migration: Add file columns to chat_messages if not exist
try {
  db.exec(`ALTER TABLE chat_messages ADD COLUMN file_url TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE chat_messages ADD COLUMN file_name TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE chat_messages ADD COLUMN file_type TEXT`);
} catch (e) {}

// Migration: Add chat_reactions table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, emoji),
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
} catch (e) {}

// Migration: Add user_status table for online/offline tracking
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_status (
      user_id INTEGER PRIMARY KEY,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_typing INTEGER DEFAULT 0,
      typing_to INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
} catch (e) {}

// Migration: Add typing columns to user_status
try {
  db.exec(`ALTER TABLE user_status ADD COLUMN is_typing INTEGER DEFAULT 0`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE user_status ADD COLUMN typing_to INTEGER`);
} catch (e) {}

// Migration: Add reply_to column to chat_messages for quoting
try {
  db.exec(`ALTER TABLE chat_messages ADD COLUMN reply_to INTEGER REFERENCES chat_messages(id)`);
} catch (e) {}

// Migration: Add shift column to employees (1, 2, or 3)
try {
  db.exec(`ALTER TABLE employees ADD COLUMN shift INTEGER DEFAULT 1`);
} catch (e) {}

// Migration: Add shift_count to halls (number of shifts: 2 or 3)
try {
  db.exec(`ALTER TABLE halls ADD COLUMN shift_count INTEGER DEFAULT 2`);
} catch (e) {}

// Migration: Add shift_rotation_week to settings (which week of rotation we're on)
try {
  db.exec(`INSERT OR IGNORE INTO settings (key, value) VALUES ('shift_rotation_base_date', '2026-01-05')`);
} catch (e) {}

// Migration: Add soft delete columns to employees
try {
  db.exec(`ALTER TABLE employees ADD COLUMN is_deleted INTEGER DEFAULT 0`);
} catch (e) {}

try {
  db.exec(`ALTER TABLE employees ADD COLUMN deleted_at TEXT`);
} catch (e) {}

// Migration: Add sort_order column to employees for custom ordering
try {
  db.exec(`ALTER TABLE employees ADD COLUMN sort_order INTEGER DEFAULT 0`);
} catch (e) {}

// Migration: Add is_supervisor column to employees (for supervisors like Mistrz, Brygadzista)
try {
  db.exec(`ALTER TABLE employees ADD COLUMN is_supervisor INTEGER DEFAULT 0`);
} catch (e) {}

// Migration: Set is_supervisor based on position (one-time migration)
try {
  const supervisorFlag = db.prepare("SELECT value FROM settings WHERE key = 'supervisors_set'").get() as any;
  if (!supervisorFlag) {
    // Mark employees with 'Mistrz' or 'Brygadzista' in position as supervisors
    db.prepare(`
      UPDATE employees 
      SET is_supervisor = 1 
      WHERE LOWER(position) LIKE '%mistrz%' 
         OR LOWER(position) LIKE '%brygadzista%'
    `).run();
    db.prepare("INSERT INTO settings (key, value) VALUES ('supervisors_set', '1')").run();
    console.log('[Migration] Supervisors marked based on position');
  }
} catch (e) {
  console.error('[Migration] Error setting supervisors:', e);
}

// Migration: Swap first_name and last_name (one-time migration)
// This changes display order from "Imię Nazwisko" to "Nazwisko Imię"
try {
  const swapFlag = db.prepare("SELECT value FROM settings WHERE key = 'names_swapped'").get() as any;
  if (!swapFlag) {
    // Check if there are any employees to swap
    const empCount = db.prepare("SELECT COUNT(*) as count FROM employees").get() as any;
    if (empCount.count > 0) {
      // Swap first_name <-> last_name for all employees
      db.prepare(`
        UPDATE employees 
        SET first_name = last_name, 
            last_name = first_name
      `).run();
      console.log(`[Migration] Swapped first_name and last_name for ${empCount.count} employees`);
    }
    // Set flag to prevent re-running
    db.prepare("INSERT INTO settings (key, value) VALUES ('names_swapped', '1')").run();
    console.log('[Migration] names_swapped flag set');
  }
} catch (e) {
  console.error('[Migration] Error swapping names:', e);
}

// Seed some sample data if empty
const hallsCount = db.prepare("SELECT COUNT(*) as count FROM halls").get() as any;
if (hallsCount.count === 0) {
  const insertHall = db.prepare("INSERT INTO halls (name, is_active) VALUES (?, ?)");
  const h1 = insertHall.run("Hala 1", 1).lastInsertRowid;
  const h2 = insertHall.run("Hala 2", 1).lastInsertRowid;
  
  // Seed data: first_name = nazwisko, last_name = imię (zgodnie z nową kolejnością wyświetlania)
  const insertEmp = db.prepare("INSERT INTO employees (first_name, last_name, hall_id, position) VALUES (?, ?, ?, ?)");
  insertEmp.run("Kowalski", "Jan", h1, "Ślusarz");
  insertEmp.run("Nowak", "Anna", h1, "Spawacz");
  insertEmp.run("Wiśniewski", "Piotr", h2, "Brygadzista");
  insertEmp.run("Wójcik", "Katarzyna", h2, "Operator CNC");
}

export default db;
