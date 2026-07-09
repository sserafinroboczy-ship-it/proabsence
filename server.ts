import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "./src/db/setup.ts";
import { sendLimitExceededEmail, LimitExceededData, sendLimitWarningEmail, LimitWarningData } from "./src/lib/mailer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-dev";

// Funkcja do generowania lokalnej daty/czasu dla logów
function getLocalTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// === BACKUP SYSTEM ===
const BACKUP_DIR = path.join(process.cwd(), "backups");
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 godziny
const MAX_BACKUPS = 7; // Przechowuj ostatnie 7 backupów

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Utworzono folder backupów: ${BACKUP_DIR}`);
  }
}

function createBackup() {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `database_${timestamp}.sqlite`);
  const sourcePath = path.join(process.cwd(), "data", "database.sqlite");
  
  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, backupPath);
      // Ustaw datę modyfikacji na aktualny czas (copyFileSync kopiuje oryginalną datę)
      const now = new Date();
      fs.utimesSync(backupPath, now, now);
      console.log(`✅ Backup utworzony: ${backupPath}`);
      cleanOldBackups();
    } else {
      console.log("⚠️ Brak pliku bazy danych do backupu");
    }
  } catch (err) {
    console.error("❌ Błąd podczas tworzenia backupu:", err);
  }
}

function cleanOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("database_") && f.endsWith(".sqlite"))
    // Sortuj po nazwie pliku (zawiera timestamp ISO) - najnowsze pierwsze
    .sort((a, b) => b.localeCompare(a));
  
  // Usuń stare backupy (zostaw tylko MAX_BACKUPS)
  if (files.length > MAX_BACKUPS) {
    files.slice(MAX_BACKUPS).forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      console.log(`🗑️ Usunięto stary backup: ${f}`);
    });
  }
}

function startBackupScheduler() {
  console.log(`🔄 Backup scheduler uruchomiony (co ${BACKUP_INTERVAL_MS / 1000 / 60 / 60}h, max ${MAX_BACKUPS} backupów)`);
  // Pierwszy backup po 1 minucie od startu
  setTimeout(() => {
    createBackup();
    // Następne backupy co 24h
    setInterval(createBackup, BACKUP_INTERVAL_MS);
  }, 60 * 1000);
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // --- API Routes ---

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Block write access for guest role
  const blockGuest = (req: any, res: any, next: any) => {
    if (req.user?.role === 'guest') return res.status(403).json({ error: "Konto gościa — tylko podgląd" });
    next();
  };

  // === HELPERS ===
  // Superadmin = konto 'admin' (username) — ma pełny dostęp do wszystkich hal
  const isSuperAdmin = (user: any) => user.username === 'admin';

  // Zwraca liste hall_id do których user ma dostęp (null = wszystkie)
  const getAllowedHallIds = (user: any): number[] | null => {
    if (isSuperAdmin(user) || user.role === 'guest') return null;
    // Adminowie, foremani i mistrzowie — sprawdź user_halls
    const rows = db.prepare("SELECT hall_id FROM user_halls WHERE user_id = ?").all(user.id) as any[];
    if (rows.length > 0) return rows.map(r => r.hall_id);
    // Fallback dla foreman/mistrz bez wpisów w user_halls: tylko własna hala
    if ((user.role === 'foreman' || user.role === 'mistrz') && user.hall_id) return [user.hall_id];
    return [];
  };

  // Login
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    console.log(`--- Login Attempt ---`);
    console.log(`Username: [${username}]`);
    console.log(`Password: [${password}]`);
    
    const user = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as any;
    if (!user) {
      console.log(`User not found in DB`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log(`User found: ${user.username}, Role: ${user.role}`);
    const valid = bcrypt.compareSync(password, user.password);
    console.log(`Password match: ${valid}`);
    
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, hall_id: user.hall_id }, JWT_SECRET, { expiresIn: "24h" });
    
    // Logowanie zalogowania
    const roleNames: Record<string, string> = { admin: 'Administrator', mistrz: 'Mistrz', foreman: 'Brygadzista', user: 'Użytkownik' };
    db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
      user.id, "LOGOWANIE", `${user.username} | Rola: ${roleNames[user.role] || user.role}`, getLocalTimestamp()
    );
    
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, hall_id: user.hall_id, force_password_change: user.force_password_change } });
  });

  // Change Password
  app.post("/api/auth/change-password", authenticate, (req: any, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Hasło musi mieć co najmniej 6 znaków" });
    }
    
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password = ?, force_password_change = 0 WHERE id = ?").run(hash, req.user.id);
    
    db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
      req.user.id, "ZMIANA_HASLA", `Użytkownik zmienił swoje hasło`, getLocalTimestamp()
    );
    
    res.json({ success: true });
  });

  // Get Current User
  app.get("/api/auth/me", authenticate, (req: any, res) => {
    const user = db.prepare("SELECT id, username, role, hall_id, force_password_change FROM users WHERE id = ?").get(req.user.id);
    res.json({ user });
  });

  // User-Halls management
  app.get("/api/user-halls/:userId", authenticate, (req: any, res) => {
    if (req.user.role !== "admin" && req.user.role !== "guest") return res.status(403).json({ error: "Forbidden" });
    const rows = db.prepare("SELECT hall_id FROM user_halls WHERE user_id = ?").all(req.params.userId);
    res.json(rows);
  });

  app.put("/api/user-halls/:userId", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { hall_ids } = req.body;
    const userId = parseInt(req.params.userId);
    // Zwykły admin może zarządzać tylko użytkownikami swoich hal i tylko w ramach swoich hal
    if (!isSuperAdmin(req.user)) {
      const myHalls = getAllowedHallIds(req.user) || [];
      // Sprawdź czy target user należy do hal tego admina
      const targetUser = db.prepare("SELECT id, hall_id, role FROM users WHERE id = ?").get(userId) as any;
      if (!targetUser) return res.status(404).json({ error: "Użytkownik nie istnieje" });
      if (targetUser.role === 'admin') return res.status(403).json({ error: "Nie możesz zarządzać halami innego admina" });
      if (targetUser.hall_id && !myHalls.includes(targetUser.hall_id)) {
        return res.status(403).json({ error: "Brak dostępu do tego użytkownika" });
      }
      // Filtruj hall_ids — admin może przypisać tylko swoje hale
      const filteredIds = (hall_ids || []).filter((hid: number) => myHalls.includes(hid));
      db.prepare("DELETE FROM user_halls WHERE user_id = ?").run(userId);
      filteredIds.forEach((hid: number) => {
        db.prepare("INSERT OR IGNORE INTO user_halls (user_id, hall_id) VALUES (?, ?)").run(userId, hid);
      });
      return res.json({ success: true });
    }
    // Superadmin — pełna kontrola
    db.prepare("DELETE FROM user_halls WHERE user_id = ?").run(userId);
    (hall_ids || []).forEach((hid: number) => {
      db.prepare("INSERT OR IGNORE INTO user_halls (user_id, hall_id) VALUES (?, ?)").run(userId, hid);
    });
    res.json({ success: true });
  });

  // Users CRUD
  app.get("/api/users", authenticate, (req: any, res) => {
    if (req.user.role !== "admin" && req.user.role !== "guest") return res.status(403).json({ error: "Forbidden" });
    if (isSuperAdmin(req.user) || req.user.role === "guest") {
      const users = db.prepare("SELECT id, username, role, hall_id, employee_number FROM users").all();
      res.json(users);
    } else {
      // Zwykly admin widzi tylko siebie + foremanow/mistrzow swoich hal
      const allowedHalls = getAllowedHallIds(req.user) || [];
      if (allowedHalls.length === 0) return res.json([req.user]);
      const placeholders = allowedHalls.map(() => '?').join(',');
      const users = db.prepare(`SELECT id, username, role, hall_id, employee_number FROM users WHERE id = ? OR (role IN ('foreman','mistrz') AND hall_id IN (${placeholders}))`).all(req.user.id, ...allowedHalls);
      res.json(users);
    }
  });

  app.post("/api/users", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { username, password, role, hall_id, employee_number, first_name, last_name } = req.body;
    // Zwykly admin moze tworzyc tylko konta dla swoich hal
    if (!isSuperAdmin(req.user) && hall_id) {
      const allowed = getAllowedHallIds(req.user) || [];
      if (!allowed.includes(parseInt(hall_id))) return res.status(403).json({ error: "Brak dostepu do tej hali" });
    }
    try {
      // Walidacja dla mistrza/brygadzisty
      if ((role === 'mistrz' || role === 'foreman') && (!hall_id || !first_name || !last_name)) {
        return res.status(400).json({ error: "Dla mistrza/brygadzisty wymagane są: hala, imię i nazwisko" });
      }
      
      const hash = bcrypt.hashSync(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, password, role, hall_id, force_password_change, employee_number) VALUES (?, ?, ?, ?, 1, ?)");
      const info = stmt.run(username, hash, role, hall_id || null, employee_number || null);
      
      const roleNames: Record<string, string> = { admin: 'Administrator', mistrz: 'Mistrz', foreman: 'Brygadzista', user: 'Użytkownik' };
      const hall = hall_id ? db.prepare("SELECT name FROM halls WHERE id = ?").get(hall_id) as any : null;
      db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
        req.user.id, "DODANO_UZYTKOWNIKA", `${username} | Rola: ${roleNames[role] || role}${hall ? ` | Hala: ${hall.name}` : ''}${employee_number ? ` | Nr prac.: ${employee_number}` : ''}`, getLocalTimestamp()
      );
      
      // Automatycznie utwórz pracownika dla mistrza/brygadzisty
      let employeeId = null;
      if ((role === 'mistrz' || role === 'foreman') && hall_id && first_name && last_name) {
        const position = role === 'mistrz' ? 'Mistrz' : 'Brygadzista';
        const empStmt = db.prepare("INSERT INTO employees (first_name, last_name, hall_id, position, employee_number, employment_type, is_supervisor) VALUES (?, ?, ?, ?, ?, 'Etat', 1)");
        const empInfo = empStmt.run(first_name, last_name, hall_id, position, employee_number || null);
        employeeId = empInfo.lastInsertRowid;
        
        db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
          req.user.id, "DODANO_PRACOWNIKA_NADZOR", `${first_name} ${last_name} | ${position} | Hala: ${hall?.name}`, getLocalTimestamp()
        );
      }
      
      res.json({ id: info.lastInsertRowid, username, role, hall_id, employee_number, employeeId });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/users/:id/reset-password", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      // Pobierz login użytkownika przed resetem
      const targetUser = db.prepare("SELECT username FROM users WHERE id = ?").get(req.params.id) as any;
      const targetUsername = targetUser?.username || `ID:${req.params.id}`;
      
      const hash = bcrypt.hashSync("password123", 10);
      db.prepare("UPDATE users SET password = ?, force_password_change = 1 WHERE id = ?").run(hash, req.params.id);
      
      db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
        req.user.id, "RESET_HASLA", `Zresetowano hasło dla użytkownika: ${targetUsername}`, getLocalTimestamp()
      );
      
      res.json({ success: true, message: "Hasło zresetowane do: password123" });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/users/:id", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const { username, role, hall_id, employee_number } = req.body;
      
      // Pobierz aktualne dane użytkownika
      const existing = db.prepare("SELECT u.*, h.name as hall_name FROM users u LEFT JOIN halls h ON u.hall_id = h.id WHERE u.id = ?").get(req.params.id) as any;
      if (!existing) return res.status(404).json({ error: "Użytkownik nie znaleziony" });
      // Ochrona konta superadmin
      if (existing.username === 'admin' && !isSuperAdmin(req.user)) return res.status(403).json({ error: "Nie możesz edytować konta głównego administratora" });
      
      // Aktualizuj użytkownika
      db.prepare("UPDATE users SET username = ?, role = ?, hall_id = ?, employee_number = ? WHERE id = ?")
        .run(username, role, hall_id || null, employee_number || null, req.params.id);
      
      // Szczegółowe logowanie zmian
      const roleNames: Record<string, string> = { admin: 'Administrator', mistrz: 'Mistrz', foreman: 'Brygadzista', guest: 'Gość' };
      const changes: string[] = [];
      if (existing.username !== username) changes.push(`Login: "${existing.username}" → "${username}"`);
      if (existing.role !== role) changes.push(`Rola: "${roleNames[existing.role] || existing.role}" → "${roleNames[role] || role}"`);
      if (existing.hall_id !== hall_id) {
        const newHall = hall_id ? db.prepare("SELECT name FROM halls WHERE id = ?").get(hall_id) as any : null;
        changes.push(`Hala: "${existing.hall_name || '-'}" → "${newHall?.name || '-'}"`);
      }
      if (existing.employee_number !== employee_number) changes.push(`Nr prac.: "${existing.employee_number || '-'}" → "${employee_number || '-'}"`);
      
      if (changes.length > 0) {
        db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
          req.user.id, "EDYCJA_UZYTKOWNIKA", `${existing.username} | ${changes.join(' | ')}`, getLocalTimestamp()
        );
      }
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/users/:id", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      // Pobierz dane użytkownika przed usunięciem
      const userToDelete = db.prepare("SELECT u.*, h.name as hall_name FROM users u LEFT JOIN halls h ON u.hall_id = h.id WHERE u.id = ?").get(req.params.id) as any;
      if (!userToDelete) return res.status(404).json({ error: "Użytkownik nie znaleziony" });
      // Ochrona konta superadmin — nikt nie może go usunąć
      if (userToDelete.username === 'admin') return res.status(403).json({ error: "Nie można usunąć konta głównego administratora" });
      
      const roleNames: Record<string, string> = { admin: 'Administrator', mistrz: 'Mistrz', foreman: 'Brygadzista', user: 'Użytkownik' };
      
      // Clean up related records that might have FK constraints
      db.prepare("DELETE FROM note_reads WHERE user_id = ?").run(req.params.id);
      db.prepare("DELETE FROM calendar_note_history WHERE user_id = ?").run(req.params.id);
      // note: calendar_notes might be owned by this user, we can keep them or null them
      db.prepare("UPDATE calendar_notes SET user_id = NULL WHERE user_id = ?").run(req.params.id);
      // Usuń logi powiązane z użytkownikiem (NOT NULL constraint)
      db.prepare("DELETE FROM logs WHERE user_id = ?").run(req.params.id);

      db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
      db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
        req.user.id, "USUNIETO_UZYTKOWNIKA", `${userToDelete.username} | Rola: ${roleNames[userToDelete.role] || userToDelete.role}${userToDelete.hall_name ? ` | Hala: ${userToDelete.hall_name}` : ''}`, getLocalTimestamp()
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete user error:", err);
      res.status(400).json({ error: "Nie można usunąć użytkownika. Sprawdź konsolę serwera." });
    }
  });

  // Halls CRUD
  app.get("/api/halls", authenticate, (req: any, res) => {
    if (!isSuperAdmin(req.user) && req.user.role !== "guest") {
      const allowedIds = getAllowedHallIds(req.user) || [];
      if (allowedIds.length === 0) return res.json([]);
      const placeholders = allowedIds.map(() => '?').join(',');
      const halls = db.prepare(`SELECT * FROM halls WHERE id IN (${placeholders})`).all(...allowedIds);
      return res.json(halls);
    }
    const halls = db.prepare("SELECT * FROM halls").all();
    res.json(halls);
  });

  app.post("/api/halls", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { name, is_active, shift_count } = req.body;
    const stmt = db.prepare("INSERT INTO halls (name, is_active, shift_count) VALUES (?, ?, ?)");
    const info = stmt.run(name, is_active ? 1 : 0, shift_count || 2);
    
    db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
      req.user.id, "UTWORZONO_HALE", `Utworzono halę ${name} (${shift_count || 2} zmiany)`, getLocalTimestamp()
    );
    res.json({ id: info.lastInsertRowid, name, is_active, shift_count: shift_count || 2 });
  });

  app.put("/api/halls/:id", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { name, is_active, shift_count } = req.body;
    db.prepare("UPDATE halls SET name = ?, is_active = ?, shift_count = ? WHERE id = ?").run(name, is_active ? 1 : 0, shift_count || 2, req.params.id);
    
    // Reset employees with shift > shift_count to shift 1
    if (shift_count) {
      db.prepare("UPDATE employees SET shift = 1 WHERE hall_id = ? AND shift > ?").run(req.params.id, shift_count);
    }
    
    db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
      req.user.id, "AKTUALIZACJA_HALI", `Zaktualizowano halę ID ${req.params.id} (${shift_count || 2} zmiany)`, getLocalTimestamp()
    );
    res.json({ success: true });
  });

  // Day comments (short-hour explanations)
  app.get("/api/day-comments", authenticate, (req: any, res) => {
    const { hall_id, month } = req.query;
    if (!hall_id || !month) return res.status(400).json({ error: "Wymagane: hall_id, month" });
    const start = `${month}-01`;
    const end = `${month}-31`;
    const rows = db.prepare(`
      SELECT dc.*, e.first_name, e.last_name, u.username as author_name
      FROM day_comments dc
      JOIN employees e ON e.id = dc.employee_id
      JOIN users u ON u.id = dc.author_id
      WHERE e.hall_id = ? AND dc.date >= ? AND dc.date <= ?
      ORDER BY dc.date ASC
    `).all(hall_id, start, end);
    res.json(rows);
  });

  app.post("/api/day-comments", authenticate, blockGuest, (req: any, res) => {
    const isSupervisorOrAdmin = req.user.role === "admin" || req.user.role === "mistrz" || req.user.role === "foreman";
    if (!isSupervisorOrAdmin) return res.status(403).json({ error: "Forbidden" });
    const { employee_id, date, comment } = req.body;
    if (!employee_id || !date || !comment?.trim()) return res.status(400).json({ error: "Wymagane: employee_id, date, comment" });
    db.prepare(`
      INSERT INTO day_comments (employee_id, date, comment, author_id, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(employee_id, date) DO UPDATE SET comment = excluded.comment, author_id = excluded.author_id, created_at = excluded.created_at
    `).run(employee_id, date, comment.trim(), req.user.id, getLocalTimestamp());
    res.json({ success: true });
  });

  app.delete("/api/day-comments", authenticate, blockGuest, (req: any, res) => {
    const isSupervisorOrAdmin = req.user.role === "admin" || req.user.role === "mistrz" || req.user.role === "foreman";
    if (!isSupervisorOrAdmin) return res.status(403).json({ error: "Forbidden" });
    const { employee_id, date } = req.body;
    if (!employee_id || !date) return res.status(400).json({ error: "Wymagane: employee_id, date" });
    db.prepare("DELETE FROM day_comments WHERE employee_id = ? AND date = ?").run(employee_id, date);
    res.json({ success: true });
  });

  // Qualifications CRUD
  app.get("/api/qualifications", authenticate, (_req: any, res) => {
    const rows = db.prepare("SELECT * FROM qualifications ORDER BY name ASC").all();
    res.json(rows);
  });

  app.post("/api/qualifications", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { name, hours_mode } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nazwa kwalifikacji jest wymagana" });
    const trimmed = name.trim();
    const mode = (hours_mode === 'deduction') ? 'deduction' : 'standard';
    const existing = db.prepare("SELECT id FROM qualifications WHERE name = ?").get(trimmed);
    if (existing) return res.status(409).json({ error: "Kwalifikacja o tej nazwie już istnieje" });
    const info = db.prepare("INSERT INTO qualifications (name, hours_mode) VALUES (?, ?)").run(trimmed, mode);
    const modeLabel = mode === 'deduction' ? ' (z potrąceniem -0.5h/dzień)' : '';
    db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
      req.user.id, "DODANO_KWALIFIKACJE", `Kwalifikacja: ${trimmed}${modeLabel}`, getLocalTimestamp()
    );
    res.json({ id: info.lastInsertRowid, name: trimmed, hours_mode: mode });
  });

  app.delete("/api/qualifications/:id", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const qual = db.prepare("SELECT * FROM qualifications WHERE id = ?").get(req.params.id) as any;
    if (!qual) return res.status(404).json({ error: "Nie znaleziono kwalifikacji" });
    db.prepare("DELETE FROM qualifications WHERE id = ?").run(req.params.id);
    db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
      req.user.id, "USUNIETO_KWALIFIKACJE", `Kwalifikacja: ${qual.name}`, getLocalTimestamp()
    );
    res.json({ success: true });
  });

  // Employees CRUD
  app.get("/api/employees", authenticate, (req: any, res) => {
    const hallId = req.query.hall_id;
    const includeDeleted = req.query.include_deleted === 'true';
    const month = req.query.month as string | undefined; // format: YYYY-MM
    let employees;
    
    const deletedFilter = includeDeleted ? '' : 'AND (e.is_deleted = 0 OR e.is_deleted IS NULL)';
    const allowedIds = getAllowedHallIds(req.user);
    
    if (hallId) {
      if (allowedIds !== null && !allowedIds.includes(parseInt(hallId as string))) {
        return res.json([]);
      }
      // Jeśli podano miesiąc — pokaż pracownika na hali tylko jeśli jego transfer
      // nakłada się na ten miesiąc (from_date <= koniec miesiąca AND (to_date IS NULL OR to_date > początek miesiąca))
      if (month) {
        const monthStart = `${month}-01`;
        // Ostatni dzień miesiąca
        const d = new Date(month + '-01');
        d.setMonth(d.getMonth() + 1);
        d.setDate(0);
        const monthEnd = d.toISOString().slice(0, 10);
        employees = db.prepare(`
          SELECT DISTINCT e.* FROM employees e
          JOIN employee_transfers et ON et.employee_id = e.id AND et.hall_id = ?
          WHERE et.from_date <= ?
            AND (et.to_date IS NULL OR et.to_date > ?)
          ${deletedFilter}
          ORDER BY e.sort_order ASC, e.id ASC
        `).all(hallId, monthEnd, monthStart);
      } else {
        // Bez miesiąca — fallback: wszyscy z dowolnym transferem na tej hali
        employees = db.prepare(`
          SELECT DISTINCT e.* FROM employees e
          LEFT JOIN employee_transfers et ON et.employee_id = e.id AND et.hall_id = ?
          WHERE (et.hall_id = ? OR (et.hall_id IS NULL AND e.hall_id = ?))
          ${deletedFilter}
          ORDER BY e.sort_order ASC, e.id ASC
        `).all(hallId, hallId, hallId);
      }
    } else if (allowedIds !== null) {
      if (allowedIds.length === 0) return res.json([]);
      const placeholders = allowedIds.map(() => '?').join(',');
      employees = db.prepare(`
        SELECT DISTINCT e.* FROM employees e
        LEFT JOIN employee_transfers et ON et.employee_id = e.id AND et.hall_id IN (${placeholders})
        WHERE (et.hall_id IN (${placeholders}) OR e.hall_id IN (${placeholders}))
        ${deletedFilter}
        ORDER BY e.hall_id ASC, e.sort_order ASC, e.id ASC
      `).all(...allowedIds, ...allowedIds, ...allowedIds);
    } else {
      employees = db.prepare(`SELECT * FROM employees e WHERE 1=1 ${deletedFilter} ORDER BY e.hall_id ASC, e.sort_order ASC, e.id ASC`).all();
    }
    res.json(employees);
  });

  // Employees CRUD
  app.post("/api/employees", authenticate, blockGuest, (req: any, res) => {
    const isForeman = req.user.role === "foreman" || req.user.role === "mistrz";
    if (req.user.role !== "admin" && !isForeman) return res.status(403).json({ error: "Forbidden" });
    
    const { first_name, last_name, hall_id, position, employee_number, employment_type, qualifications } = req.body;
    
    // Mistrzowie i brygadziści mogą dodawać pracowników do wszystkich hal (zastępstwa)
    
    // Automatycznie ustaw is_supervisor na podstawie stanowiska
    const positionLower = (position || '').toLowerCase();
    const isSupervisor = positionLower.includes('mistrz') || positionLower.includes('brygadzista') ? 1 : 0;

    const stmt = db.prepare("INSERT INTO employees (first_name, last_name, hall_id, position, employee_number, employment_type, is_supervisor, qualifications) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    const info = stmt.run(first_name, last_name, hall_id, position, employee_number || null, employment_type || 'Etat', isSupervisor, qualifications || '');
    
    // Utwórz wpis w employee_transfers dla nowego pracownika
    const today = new Date().toISOString().slice(0, 10);
    db.prepare("INSERT INTO employee_transfers (employee_id, hall_id, from_date, to_date, transferred_by, created_at) VALUES (?, ?, ?, NULL, ?, ?)")
      .run(info.lastInsertRowid, hall_id, today, req.user.id, getLocalTimestamp());
    
    const hall = db.prepare("SELECT name FROM halls WHERE id = ?").get(hall_id) as any;
    db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
      req.user.id, "DODANO_PRACOWNIKA", `${first_name} ${last_name} | Nr: ${employee_number || '-'} | Stanowisko: ${position || '-'} | Hala: ${hall?.name || '-'} | Forma: ${employment_type || 'Etat'} | Kwalif: ${qualifications || '-'}`, getLocalTimestamp()
    );
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/employees/:id", authenticate, blockGuest, (req: any, res) => {
    const isForeman = req.user.role === "foreman" || req.user.role === "mistrz";
    if (req.user.role !== "admin" && !isForeman) return res.status(403).json({ error: "Forbidden" });
    
    const { first_name, last_name, hall_id, position, employee_number, employment_type, qualifications } = req.body;
    
    // Pobierz aktualne dane pracownika
    const existing = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: "Pracownik nie znaleziony" });
    
    const oldHallId = existing.hall_id;
    const isTransfer = oldHallId !== parseInt(hall_id);
    
    // Mistrzowie i brygadziści mogą edytować pracowników ze wszystkich hal (zastępstwa)
    
    // Automatycznie ustaw is_supervisor na podstawie stanowiska
    const positionLower = (position || '').toLowerCase();
    const isSupervisor = positionLower.includes('mistrz') || positionLower.includes('brygadzista') ? 1 : 0;

    const stmt = db.prepare("UPDATE employees SET first_name = ?, last_name = ?, hall_id = ?, position = ?, employee_number = ?, employment_type = ?, is_supervisor = ?, qualifications = ? WHERE id = ?");
    stmt.run(first_name, last_name, hall_id, position, employee_number || null, employment_type || 'Etat', isSupervisor, qualifications || '', req.params.id);
    
    // Szczegółowe logowanie zmian
    const changes: string[] = [];
    if (existing.first_name !== first_name) changes.push(`Imię: "${existing.first_name}" → "${first_name}"`);
    if (existing.last_name !== last_name) changes.push(`Nazwisko: "${existing.last_name}" → "${last_name}"`);
    if (existing.position !== position) changes.push(`Stanowisko: "${existing.position || '-'}" → "${position || '-'}"`);
    if (existing.employee_number !== employee_number) changes.push(`Nr: "${existing.employee_number || '-'}" → "${employee_number || '-'}"`);
    if (existing.employment_type !== (employment_type || 'Etat')) changes.push(`Forma: "${existing.employment_type || 'Etat'}" → "${employment_type || 'Etat'}"`);
    
    if (isTransfer) {
      const oldHall = db.prepare("SELECT name FROM halls WHERE id = ?").get(oldHallId) as any;
      const newHall = db.prepare("SELECT name FROM halls WHERE id = ?").get(hall_id) as any;
      changes.push(`Hala: "${oldHall?.name}" → "${newHall?.name}"`);
      
      // Zamknij aktualny wpis transferu (ustaw to_date na wczoraj)
      const today = new Date().toISOString().slice(0, 10);
      db.prepare("UPDATE employee_transfers SET to_date = ? WHERE employee_id = ? AND to_date IS NULL").run(today, req.params.id);
      
      // Otwórz nowy wpis transferu na nową halę
      db.prepare("INSERT INTO employee_transfers (employee_id, hall_id, from_date, to_date, transferred_by, created_at) VALUES (?, ?, ?, NULL, ?, ?)").run(
        req.params.id, hall_id, today, req.user.id, getLocalTimestamp()
      );
      
      db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
        req.user.id, "PRZENIESIENIE_PRACOWNIKA", `${existing.first_name} ${existing.last_name} | ${changes.join(' | ')}`, getLocalTimestamp()
      );
    } else if (changes.length > 0) {
      db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
        req.user.id, "EDYCJA_PRACOWNIKA", `${existing.first_name} ${existing.last_name} | ${changes.join(' | ')}`, getLocalTimestamp()
      );
    }
    res.json({ success: true });
  });

  // Employee transfers history
  app.get("/api/employee-transfers", authenticate, (req: any, res) => {
    const { hall_id } = req.query;
    if (!hall_id) return res.status(400).json({ error: "Wymagane: hall_id" });
    const rows = db.prepare(`
      SELECT et.*, e.first_name, e.last_name, e.employee_number, e.position, e.employment_type, e.is_supervisor, e.qualifications, e.shift, e.sort_order
      FROM employee_transfers et
      JOIN employees e ON e.id = et.employee_id
      WHERE et.hall_id = ? AND (e.is_deleted = 0 OR e.is_deleted IS NULL)
      ORDER BY et.from_date ASC
    `).all(hall_id);
    res.json(rows);
  });

  app.delete("/api/employees/:id", authenticate, blockGuest, (req: any, res) => {
    const isForeman = req.user.role === "foreman" || req.user.role === "mistrz";
    if (req.user.role !== "admin" && !isForeman) return res.status(403).json({ error: "Forbidden" });
    
    try {
      // Pobierz dane pracownika przed usunięciem
      const employee = db.prepare("SELECT e.*, h.name as hall_name FROM employees e LEFT JOIN halls h ON e.hall_id = h.id WHERE e.id = ?").get(req.params.id) as any;
      if (!employee) return res.status(404).json({ error: "Pracownik nie znaleziony" });
      
      // Soft delete - oznacz jako usunięty zamiast trwale usuwać
      // Dane historyczne (absences, godziny) zostają zachowane
      db.prepare("UPDATE employees SET is_deleted = 1, deleted_at = ? WHERE id = ?").run(
        getLocalTimestamp(),
        req.params.id
      );
      
      db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
        req.user.id, "USUNIETO_PRACOWNIKA", `${employee.first_name} ${employee.last_name} | Nr: ${employee.employee_number || '-'} | Stanowisko: ${employee.position || '-'} | Hala: ${employee.hall_name} | Forma: ${employee.employment_type || 'Etat'} | Dane historyczne zachowane`, getLocalTimestamp()
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete employee error:", err);
      res.status(400).json({ error: "Nie można usunąć pracownika: " + err.message });
    }
  });

  // Reorder employees (drag & drop)
  app.post("/api/employees/reorder", authenticate, blockGuest, (req: any, res) => {
    try {
      const isForeman = req.user.role === "foreman" || req.user.role === "mistrz";
      if (req.user.role !== "admin" && !isForeman) return res.status(403).json({ error: "Forbidden" });
      
      const { hall_id, order } = req.body;
      if (!hall_id || !Array.isArray(order)) {
        return res.status(400).json({ error: "Brak hall_id lub order" });
      }
      
      // Zaktualizuj sort_order dla każdego pracownika
      const updateStmt = db.prepare("UPDATE employees SET sort_order = ? WHERE id = ? AND hall_id = ?");
      order.forEach((empId: number, index: number) => {
        updateStmt.run(index, empId, hall_id);
      });
      
      res.json({ success: true });
    } catch (err: any) {
      console.error("Reorder employees error:", err);
      res.status(400).json({ error: "Błąd zmiany kolejności: " + err.message });
    }
  });

  // Update employee shift
  app.put("/api/employees/:id/shift", authenticate, blockGuest, (req: any, res) => {
    try {
      const isForeman = req.user.role === "foreman" || req.user.role === "mistrz";
      if (req.user.role !== "admin" && !isForeman) return res.status(403).json({ error: "Forbidden" });
      
      const { shift } = req.body;
      if (![1, 2, 3].includes(shift)) return res.status(400).json({ error: "Nieprawidłowa zmiana" });
      
      const employee = db.prepare("SELECT e.*, h.name as hall_name FROM employees e LEFT JOIN halls h ON e.hall_id = h.id WHERE e.id = ?").get(req.params.id) as any;
      if (!employee) return res.status(404).json({ error: "Pracownik nie znaleziony" });
      
      const oldShift = employee.shift || 1;
      db.prepare("UPDATE employees SET shift = ? WHERE id = ?").run(shift, req.params.id);
      
      if (oldShift !== shift) {
        db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
          req.user.id, "ZMIANA_ZMIANY", `${employee.first_name} ${employee.last_name} | Zmiana: ${oldShift} → ${shift} | Hala: ${employee.hall_name}`, getLocalTimestamp()
        );
      }
      
      res.json({ success: true });
    } catch (err: any) {
      console.error("Update shift error:", err);
      res.status(500).json({ error: err.message || "Błąd zmiany zmiany" });
    }
  });

  // Rotate shifts for all employees in a hall
  app.post("/api/halls/:id/rotate-shifts", authenticate, blockGuest, (req: any, res) => {
    try {
      const isForeman = req.user.role === "foreman" || req.user.role === "mistrz";
      if (req.user.role !== "admin" && !isForeman) return res.status(403).json({ error: "Forbidden" });
      
      const hall = db.prepare("SELECT * FROM halls WHERE id = ?").get(req.params.id) as any;
      if (!hall) return res.status(404).json({ error: "Hala nie znaleziona" });
      
      const shiftCount = hall.shift_count || 2;
      
      // Rotate: shift 1 -> 2 -> 3 -> 1 (or 1 -> 2 -> 1 for 2 shifts)
      // Tylko aktywni pracownicy (nie usunięci)
      db.prepare(`
        UPDATE employees 
        SET shift = CASE 
          WHEN COALESCE(shift, 1) >= ? THEN 1 
          ELSE COALESCE(shift, 1) + 1 
        END 
        WHERE hall_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
      `).run(shiftCount, req.params.id);
      
      db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
        req.user.id, "ROTACJA_ZMIAN", `Rotacja zmian na hali: ${hall.name}`, getLocalTimestamp()
      );
      
      res.json({ success: true });
    } catch (err: any) {
      console.error("Rotate shifts error:", err);
      res.status(500).json({ error: err.message || "Błąd rotacji zmian" });
    }
  });

  // Update hall shift count
  app.put("/api/halls/:id/shift-count", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    
    const { shift_count } = req.body;
    if (![2, 3].includes(shift_count)) return res.status(400).json({ error: "Liczba zmian musi być 2 lub 3" });
    
    db.prepare("UPDATE halls SET shift_count = ? WHERE id = ?").run(shift_count, req.params.id);
    
    // Reset employees with shift > shift_count to shift 1
    db.prepare("UPDATE employees SET shift = 1 WHERE hall_id = ? AND shift > ?").run(req.params.id, shift_count);
    
    res.json({ success: true });
  });

  // Absences - zawiera też dane usuniętych pracowników dla zachowania historii
  app.get("/api/absences", authenticate, (req: any, res) => {
    const { start_date, end_date, hall_id } = req.query;
    // Pobierz absencje dla wszystkich pracowników którzy kiedykolwiek byli na danej hali
    // (przez employee_transfers LUB aktualny e.hall_id jako fallback)
    // Frontend sam decyduje które komórki są aktywne/zablokowane na podstawie dat transferu
    let query = `
      SELECT a.*, e.first_name, e.last_name,
             COALESCE(
               (SELECT et2.hall_id FROM employee_transfers et2
                WHERE et2.employee_id = a.employee_id
                  AND a.date >= et2.from_date
                  AND (et2.to_date IS NULL OR a.date < et2.to_date)
                LIMIT 1),
               e.hall_id
             ) as hall_id,
             e.is_deleted, e.employment_type 
      FROM absences a
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.date >= ? AND a.date <= ?
    `;
    const params: any[] = [start_date, end_date];
    
    if (hall_id) {
      // Zwróć absencje pracowników którzy kiedykolwiek byli na tej hali
      query += ` AND a.employee_id IN (
        SELECT DISTINCT employee_id FROM employee_transfers WHERE hall_id = ?
        UNION
        SELECT id FROM employees WHERE hall_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
      )`;
      params.push(hall_id, hall_id);
    } else {
      const allowedIds = getAllowedHallIds(req.user);
      if (allowedIds !== null) {
        if (allowedIds.length === 0) return res.json([]);
        const placeholders = allowedIds.map(() => '?').join(',');
        query += ` AND a.employee_id IN (
          SELECT DISTINCT employee_id FROM employee_transfers WHERE hall_id IN (${placeholders})
          UNION
          SELECT id FROM employees WHERE hall_id IN (${placeholders}) AND (is_deleted = 0 OR is_deleted IS NULL)
        )`;
        params.push(...allowedIds, ...allowedIds);
      }
    }
    
    const absences = db.prepare(query).all(...params);
    res.json(absences);
  });

  app.post("/api/absences", authenticate, (req: any, res) => {
    if (req.user.role === "guest") return res.status(403).json({ error: "Forbidden" });
    const { employee_id, date, type, overtime_hours, working_hours } = req.body;
    const wh = working_hours !== undefined ? working_hours : 8;
    
    // Mistrzowie i brygadziści mogą edytować obecności we wszystkich halach (zastępstwa)

    const existing = db.prepare("SELECT id FROM absences WHERE employee_id = ? AND date = ?").get(employee_id, date) as any;
    
    if (existing) {
      db.prepare("UPDATE absences SET type = ?, overtime_hours = ?, working_hours = ? WHERE id = ?").run(type, overtime_hours, wh, existing.id);
    } else {
      db.prepare("INSERT INTO absences (employee_id, date, type, overtime_hours, working_hours) VALUES (?, ?, ?, ?, ?)").run(employee_id, date, type, overtime_hours, wh);
    }
    
    const empDetails = db.prepare("SELECT e.first_name, e.last_name, h.name as hall_name FROM employees e LEFT JOIN halls h ON e.hall_id = h.id WHERE e.id = ?").get(employee_id) as any;
    const empName = empDetails ? `${empDetails.first_name} ${empDetails.last_name}` : `ID ${employee_id}`;
    
    // Mapowanie typów na polskie nazwy
    const typeNames: Record<string, string> = {
      'present': 'Obecny',
      'absent': 'Nieobecny',
      'vacation': 'Urlop wypoczynkowy',
      'sick': 'Chorobowe',
      'unplanned': 'Nieplanowane',
      'care': 'Opieka',
      'blood': 'Krew',
      'unpaid': 'Bezpłatny'
    };
    const typeName = typeNames[type] || type;
    
    let details = `${empName} | Data: ${date} | Status: ${typeName}`;
    if (type === 'present' && (wh || overtime_hours)) {
      details += ` | Godz: ${wh || 0}h`;
      if (overtime_hours) details += ` + ${overtime_hours}h nadg.`;
    }
    if (empDetails?.hall_name) details += ` | Hala: ${empDetails.hall_name}`;

    db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
      req.user.id, "ZMIANA_OBECNOSCI", details, getLocalTimestamp()
    );
    res.json({ success: true });
  });

  // Calendar Notes
  app.get("/api/calendar/notes", authenticate, (req: any, res) => {
    const { month } = req.query; // YYYY-MM
    if (!month) return res.status(400).json({ error: "Month is required" });

    const notes = db.prepare(`
      SELECT cn.*, u.username,
             CASE 
               WHEN nr.last_read_at IS NULL THEN 1
               WHEN cn.updated_at > nr.last_read_at THEN 1
               ELSE 0
             END as is_unread
      FROM calendar_notes cn
      LEFT JOIN users u ON cn.user_id = u.id
      LEFT JOIN note_reads nr ON cn.id = nr.note_id AND nr.user_id = ?
      WHERE cn.date LIKE ?
    `).all(req.user.id, `${month}-%`);

    const notesWithHistory = notes.map((note: any) => {
      const history = db.prepare(`
        SELECT cnh.*, u.username 
        FROM calendar_note_history cnh
        LEFT JOIN users u ON cnh.user_id = u.id
        WHERE cnh.note_id = ?
        ORDER BY cnh.changed_at DESC
        LIMIT 4
      `).all(note.id);
      return { ...note, history };
    });

    res.json(notesWithHistory);
  });

  app.post("/api/calendar/notes", authenticate, blockGuest, (req: any, res) => {
    const { date, content } = req.body;
    if (!date) return res.status(400).json({ error: "Date is required" });

    const existing = db.prepare("SELECT id FROM calendar_notes WHERE date = ?").get(date) as any;
    let noteId;

    if (existing) {
      db.prepare("UPDATE calendar_notes SET content = ?, user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(content, req.user.id, existing.id);
      noteId = existing.id;
    } else {
      const info = db.prepare("INSERT INTO calendar_notes (date, content, user_id) VALUES (?, ?, ?)").run(date, content, req.user.id);
      noteId = info.lastInsertRowid;
    }

    db.prepare("INSERT INTO calendar_note_history (note_id, content, user_id) VALUES (?, ?, ?)").run(noteId, content, req.user.id);
    
    // Mark as read for the author
    db.prepare(`
      INSERT INTO note_reads (user_id, note_id, last_read_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP) 
      ON CONFLICT(user_id, note_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
    `).run(req.user.id, noteId);

    res.json({ success: true });
  });

  app.get("/api/calendar/unread-count", authenticate, (req: any, res) => {
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM calendar_notes cn
      LEFT JOIN note_reads nr ON cn.id = nr.note_id AND nr.user_id = ?
      WHERE nr.last_read_at IS NULL OR cn.updated_at > nr.last_read_at
    `).get(req.user.id) as any;
    
    res.json({ count: result.count });
  });

  app.post("/api/calendar/notes/:id/read", authenticate, (req: any, res) => {
    const noteId = req.params.id;
    db.prepare(`
      INSERT INTO note_reads (user_id, note_id, last_read_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP) 
      ON CONFLICT(user_id, note_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
    `).run(req.user.id, noteId);
    res.json({ success: true });
  });

  // Delete calendar note (admin only)
  app.delete("/api/calendar/notes/:id", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Tylko administrator może usuwać notatki" });
    }
    const noteId = req.params.id;
    
    // Delete history first
    db.prepare("DELETE FROM calendar_note_history WHERE note_id = ?").run(noteId);
    // Delete reads
    db.prepare("DELETE FROM note_reads WHERE note_id = ?").run(noteId);
    // Delete note
    const result = db.prepare("DELETE FROM calendar_notes WHERE id = ?").run(noteId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "Notatka nie znaleziona" });
    }
    
    res.json({ success: true });
  });

  // Settings API
  app.get("/api/settings", authenticate, (req: any, res) => {
    const settings = db.prepare("SELECT key, value FROM settings").all();
    const result: any = {};
    settings.forEach((s: any) => {
      result[s.key] = s.value;
    });
    res.json(result);
  });

  app.put("/api/settings", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: "Key and value required" });
    }
    
    // Sprawdź czy klucz istnieje
    const existing = db.prepare("SELECT id FROM settings WHERE key = ?").get(key);
    if (existing) {
      db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(value.toString(), key);
    } else {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, value.toString());
    }
    
    db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
      req.user.id, "ZMIANA_USTAWIEN", `Zmieniono ${key} na ${value}`, getLocalTimestamp()
    );
    res.json({ success: true });
  });

  // Notification Emails API
  app.get("/api/notification-emails", authenticate, (req: any, res) => {
    if (req.user.role !== "admin" && req.user.role !== "guest") return res.status(403).json({ error: "Forbidden" });
    const emails = db.prepare("SELECT * FROM notification_emails ORDER BY created_at DESC").all();
    res.json(emails);
  });

  app.patch("/api/notification-emails/:id", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { notification_type } = req.body;
    if (!['exceeded', 'warning', 'both'].includes(notification_type)) {
      return res.status(400).json({ error: "Nieprawidłowy typ powiadomienia" });
    }
    db.prepare("UPDATE notification_emails SET notification_type = ? WHERE id = ?").run(notification_type, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/notification-emails", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { email, is_global, user_id, notification_type } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: "Nieprawidłowy adres email" });
    }
    try {
      const globalFlag = is_global ? 1 : 0;
      const notifType = ['exceeded', 'warning', 'both'].includes(notification_type) ? notification_type : 'exceeded';
      const info = db.prepare("INSERT INTO notification_emails (email, is_global, user_id, notification_type) VALUES (?, ?, ?, ?)").run(email, globalFlag, user_id || null, notifType);
      const typeLabel = globalFlag ? 'globalny' : (user_id ? `przypisany do użytkownika ID:${user_id}` : 'bez przypisania');
      db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
        req.user.id, "DODANO_EMAIL_POWIADOMIEN", `Dodano email: ${email} (${typeLabel}, typ: ${notifType})`, getLocalTimestamp()
      );
      res.json({ id: info.lastInsertRowid, email, is_global: globalFlag, user_id: user_id || null });
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) {
        return res.status(400).json({ error: "Ten email już istnieje" });
      }
      throw e;
    }
  });

  app.delete("/api/notification-emails/:id", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const emailRecord = db.prepare("SELECT email FROM notification_emails WHERE id = ?").get(req.params.id) as any;
    db.prepare("DELETE FROM notification_emails WHERE id = ?").run(req.params.id);
    if (emailRecord) {
      db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
        req.user.id, "USUNIETO_EMAIL_POWIADOMIEN", `Usunięto email: ${emailRecord.email}`, getLocalTimestamp()
      );
    }
    res.json({ success: true });
  });

  // Pomocnik: pobierz odbiorców emaili dla danej hali i typu powiadomienia
  function getNotificationRecipients(hallId: number, notifType: 'warning' | 'exceeded'): string[] {
    const allEmails = db.prepare(`
      SELECT ne.*, u.hall_id as assigned_hall, u.role as user_role
      FROM notification_emails ne 
      LEFT JOIN users u ON u.id = ne.user_id
    `).all() as any[];

    const recipientEmails = new Set<string>();
    allEmails.forEach((row: any) => {
      const matchesType = row.notification_type === notifType || row.notification_type === 'both' || !row.notification_type;
      if (!matchesType) return;
      if (row.is_global) {
        recipientEmails.add(row.email);
      } else if (!row.user_id) {
        recipientEmails.add(row.email);
      } else if (row.assigned_hall === hallId) {
        recipientEmails.add(row.email);
      }
    });
    return Array.from(recipientEmails);
  }

  // Check and send limit notifications (warning + exceeded)
  app.post("/api/check-limit-notifications", authenticate, async (req: any, res) => {
    const { employee_id, month, hours_used, hours_limit } = req.body;
    const remaining = hours_limit - hours_used;

    // Pobierz dane pracownika i hali
    const employee = db.prepare(`
      SELECT e.*, h.name as hall_name 
      FROM employees e 
      LEFT JOIN halls h ON e.hall_id = h.id 
      WHERE e.id = ?
    `).get(employee_id) as any;

    if (!employee) {
      return res.status(404).json({ error: "Pracownik nie znaleziony" });
    }

    const hallId = employee.hall_id;
    const results: any[] = [];

    // === TYP: warning (pozostało <= 20h, ale jeszcze nie przekroczono) ===
    if (remaining <= 20 && remaining > 0) {
      try {
        db.prepare(
          "INSERT INTO limit_exceeded_notifications (employee_id, month, type) VALUES (?, ?, 'warning')"
        ).run(employee_id, month);

        const recipients = getNotificationRecipients(hallId, 'warning');
        if (recipients.length > 0) {
          const data: LimitWarningData = {
            employeeNumber: employee.employee_number || '-',
            firstName: employee.first_name,
            lastName: employee.last_name,
            hallName: employee.hall_name || 'Nieprzypisana',
            employmentType: employee.employment_type,
            hoursLimit: hours_limit,
            hoursUsed: hours_used,
            hoursRemaining: remaining,
            month
          };
          const sent = await sendLimitWarningEmail(recipients, data);
          if (sent) {
            db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
              req.user.id, "WYSLANO_POWIADOMIENIE_OSTRZEZENIE",
              `Ostrzeżenie o zbliżaniu się do limitu: ${employee.first_name} ${employee.last_name} (pozostało ${remaining}h)`,
              getLocalTimestamp()
            );
            results.push({ type: 'warning', sent: true, recipients });
          } else {
            db.prepare("DELETE FROM limit_exceeded_notifications WHERE employee_id = ? AND month = ? AND type = 'warning'").run(employee_id, month);
            results.push({ type: 'warning', sent: false });
          }
        } else {
          results.push({ type: 'warning', sent: false, reason: 'Brak emaili dla ostrzeżeń' });
        }
      } catch (e: any) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === 'SQLITE_CONSTRAINT') {
          results.push({ type: 'warning', sent: false, reason: 'Już wysłano' });
        } else throw e;
      }
    }

    // === TYP: exceeded (przekroczono limit) ===
    if (remaining <= 0) {
      try {
        db.prepare(
          "INSERT INTO limit_exceeded_notifications (employee_id, month, type) VALUES (?, ?, 'exceeded')"
        ).run(employee_id, month);

        const recipients = getNotificationRecipients(hallId, 'exceeded');
        if (recipients.length > 0) {
          const hoursExceeded = hours_used - hours_limit;
          const data: LimitExceededData = {
            employeeNumber: employee.employee_number || '-',
            firstName: employee.first_name,
            lastName: employee.last_name,
            hallName: employee.hall_name || 'Nieprzypisana',
            employmentType: employee.employment_type,
            hoursLimit: hours_limit,
            hoursUsed: hours_used,
            hoursExceeded,
            month
          };
          const sent = await sendLimitExceededEmail(recipients, data);
          if (sent) {
            db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
              req.user.id, "WYSLANO_POWIADOMIENIE_LIMIT",
              `Przekroczenie limitu: ${employee.first_name} ${employee.last_name} (+${hoursExceeded}h ponad limit)`,
              getLocalTimestamp()
            );
            results.push({ type: 'exceeded', sent: true, recipients });
          } else {
            db.prepare("DELETE FROM limit_exceeded_notifications WHERE employee_id = ? AND month = ? AND type = 'exceeded'").run(employee_id, month);
            results.push({ type: 'exceeded', sent: false });
          }
        } else {
          results.push({ type: 'exceeded', sent: false, reason: 'Brak emaili dla przekroczeń' });
        }
      } catch (e: any) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === 'SQLITE_CONSTRAINT') {
          results.push({ type: 'exceeded', sent: false, reason: 'Już wysłano' });
        } else throw e;
      }
    }

    res.json({ results });
  });

  // Logs
  app.get("/api/logs", authenticate, (req: any, res) => {
    if (req.user.role !== "admin" && req.user.role !== "guest") return res.status(403).json({ error: "Forbidden" });
    
    const { month } = req.query; // format: YYYY-MM
    
    let logs;
    if (month) {
      // Filtruj po miesiącu - timestamp format: "YYYY-MM-DD HH:MM:SS"
      const startDate = `${month}-01`;
      const endDate = `${month}-31 23:59:59`;
      logs = db.prepare(`
        SELECT l.*, u.username 
        FROM logs l 
        LEFT JOIN users u ON l.user_id = u.id 
        WHERE l.timestamp >= ? AND l.timestamp <= ?
        ORDER BY l.timestamp DESC
      `).all(startDate, endDate);
    } else {
      logs = db.prepare(`
        SELECT l.*, u.username 
        FROM logs l 
        LEFT JOIN users u ON l.user_id = u.id 
        ORDER BY l.timestamp DESC
      `).all();
    }
    res.json(logs);
  });

  // Backups API
  app.get("/api/backups", authenticate, (req: any, res) => {
    if (req.user.role !== "admin" && req.user.role !== "guest") return res.status(403).json({ error: "Forbidden" });
    ensureBackupDir();
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith("database_") && f.endsWith(".sqlite"))
        .map(f => {
          const stats = fs.statSync(path.join(BACKUP_DIR, f));
          // Użyj birthtime (czas utworzenia pliku) zamiast mtime (czas modyfikacji)
          // mtime jest kopiowany z oryginalnego pliku przy fs.copyFileSync
          return {
            name: f,
            size: Math.round(stats.size / 1024) + " KB",
            created: stats.birthtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      res.json(files);
    } catch (err) {
      res.json([]);
    }
  });

  app.post("/api/backups", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      createBackup();
      db.prepare("INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)").run(
        req.user.id, "BACKUP_RECZNY", "Utworzono ręczny backup bazy danych", getLocalTimestamp()
      );
      res.json({ success: true, message: "Backup utworzony pomyślnie" });
    } catch (err: any) {
      res.status(500).json({ error: "Błąd podczas tworzenia backupu" });
    }
  });

  // ==================== CHAT API ====================

  // Get global messages
  app.get("/api/chat/global", authenticate, (req: any, res) => {
    try {
      const messages = db.prepare(`
        SELECT cm.id, cm.content, cm.created_at, cm.sender_id, cm.reply_to,
               u.username as sender_username, u.role as sender_role,
               rm.content as reply_content, ru.username as reply_username
        FROM chat_messages cm
        JOIN users u ON cm.sender_id = u.id
        LEFT JOIN chat_messages rm ON cm.reply_to = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE cm.recipient_id IS NULL
        ORDER BY cm.created_at DESC
        LIMIT 100
      `).all();
      res.json(messages.reverse());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send global message
  app.post("/api/chat/global", authenticate, (req: any, res) => {
    const { content, replyTo } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Treść wiadomości jest wymagana" });
    }
    try {
      const result = db.prepare(
        "INSERT INTO chat_messages (sender_id, recipient_id, content, reply_to) VALUES (?, NULL, ?, ?)"
      ).run(req.user.id, content.trim(), replyTo || null);
      
      const message = db.prepare(`
        SELECT cm.id, cm.content, cm.created_at, cm.sender_id, cm.reply_to,
               u.username as sender_username, u.role as sender_role,
               rm.content as reply_content, ru.username as reply_username
        FROM chat_messages cm
        JOIN users u ON cm.sender_id = u.id
        LEFT JOIN chat_messages rm ON cm.reply_to = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE cm.id = ?
      `).get(result.lastInsertRowid);
      
      // Reset typing status
      db.prepare(`UPDATE user_status SET is_typing = 0 WHERE user_id = ?`).run(req.user.id);
      
      res.json(message);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get list of users for private chat
  app.get("/api/chat/users", authenticate, (req: any, res) => {
    try {
      const users = db.prepare(`
        SELECT id, username, role FROM users WHERE id != ?
      `).all(req.user.id);
      
      // Get unread count for each user
      const usersWithUnread = users.map((user: any) => {
        const unread = db.prepare(`
          SELECT COUNT(*) as count FROM chat_messages 
          WHERE sender_id = ? AND recipient_id = ? AND is_read = 0
        `).get(user.id, req.user.id) as any;
        return { ...user, unread_count: unread.count };
      });
      
      res.json(usersWithUnread);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get private messages with specific user
  app.get("/api/chat/private/:userId", authenticate, (req: any, res) => {
    const otherUserId = parseInt(req.params.userId);
    try {
      const messages = db.prepare(`
        SELECT cm.id, cm.content, cm.created_at, cm.sender_id, cm.recipient_id, cm.is_read, cm.reply_to,
               u.username as sender_username, u.role as sender_role,
               rm.content as reply_content, ru.username as reply_username
        FROM chat_messages cm
        JOIN users u ON cm.sender_id = u.id
        LEFT JOIN chat_messages rm ON cm.reply_to = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE (cm.sender_id = ? AND cm.recipient_id = ?)
           OR (cm.sender_id = ? AND cm.recipient_id = ?)
        ORDER BY cm.created_at DESC
        LIMIT 100
      `).all(req.user.id, otherUserId, otherUserId, req.user.id);
      
      // Mark messages as read
      db.prepare(`
        UPDATE chat_messages SET is_read = 1 
        WHERE sender_id = ? AND recipient_id = ? AND is_read = 0
      `).run(otherUserId, req.user.id);
      
      res.json(messages.reverse());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send private message
  app.post("/api/chat/private/:userId", authenticate, (req: any, res) => {
    const recipientId = parseInt(req.params.userId);
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Treść wiadomości jest wymagana" });
    }
    
    try {
      const { replyTo } = req.body;
      const result = db.prepare(
        "INSERT INTO chat_messages (sender_id, recipient_id, content, reply_to) VALUES (?, ?, ?, ?)"
      ).run(req.user.id, recipientId, content.trim(), replyTo || null);
      
      const message = db.prepare(`
        SELECT cm.id, cm.content, cm.created_at, cm.sender_id, cm.recipient_id, cm.reply_to,
               u.username as sender_username, u.role as sender_role,
               rm.content as reply_content, ru.username as reply_username
        FROM chat_messages cm
        JOIN users u ON cm.sender_id = u.id
        LEFT JOIN chat_messages rm ON cm.reply_to = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE cm.id = ?
      `).get(result.lastInsertRowid);
      
      // Reset typing status
      db.prepare(`UPDATE user_status SET is_typing = 0 WHERE user_id = ?`).run(req.user.id);
      
      res.json(message);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get total unread messages count
  app.get("/api/chat/unread", authenticate, (req: any, res) => {
    try {
      const result = db.prepare(`
        SELECT COUNT(*) as count FROM chat_messages 
        WHERE recipient_id = ? AND is_read = 0
      `).get(req.user.id) as any;
      res.json({ count: result.count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete all global messages (admin only)
  app.delete("/api/chat/global", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Tylko administrator może usuwać wiadomości" });
    }
    try {
      db.prepare("DELETE FROM chat_messages WHERE recipient_id IS NULL").run();
      res.json({ success: true, message: "Usunięto wszystkie wiadomości globalne" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete private conversation with specific user (admin only)
  app.delete("/api/chat/private/:userId", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Tylko administrator może usuwać konwersacje" });
    }
    const otherUserId = parseInt(req.params.userId);
    try {
      db.prepare(`
        DELETE FROM chat_messages 
        WHERE (sender_id = ? AND recipient_id = ?)
           OR (sender_id = ? AND recipient_id = ?)
      `).run(req.user.id, otherUserId, otherUserId, req.user.id);
      res.json({ success: true, message: "Usunięto konwersację" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete single message (admin only)
  app.delete("/api/chat/message/:messageId", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Tylko administrator może usuwać wiadomości" });
    }
    const messageId = parseInt(req.params.messageId);
    try {
      db.prepare("DELETE FROM chat_messages WHERE id = ?").run(messageId);
      res.json({ success: true, message: "Usunięto wiadomość" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update user online status (heartbeat)
  app.post("/api/chat/heartbeat", authenticate, (req: any, res) => {
    try {
      db.prepare(`
        INSERT INTO user_status (user_id, last_seen) VALUES (?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET last_seen = datetime('now')
      `).run(req.user.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get online users (active in last 2 minutes)
  app.get("/api/chat/online", authenticate, (req: any, res) => {
    try {
      const onlineUsers = db.prepare(`
        SELECT user_id FROM user_status 
        WHERE last_seen > datetime('now', '-2 minutes')
      `).all();
      res.json(onlineUsers.map((u: any) => u.user_id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Set typing status
  app.post("/api/chat/typing", authenticate, (req: any, res) => {
    const { isTyping, typingTo } = req.body;
    try {
      db.prepare(`
        INSERT INTO user_status (user_id, last_seen, is_typing, typing_to) 
        VALUES (?, datetime('now'), ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET is_typing = ?, typing_to = ?, last_seen = datetime('now')
      `).run(req.user.id, isTyping ? 1 : 0, typingTo || null, isTyping ? 1 : 0, typingTo || null);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get who is typing to me
  app.get("/api/chat/typing", authenticate, (req: any, res) => {
    try {
      const typing = db.prepare(`
        SELECT us.user_id, u.username FROM user_status us
        JOIN users u ON us.user_id = u.id
        WHERE us.is_typing = 1 AND (us.typing_to = ? OR us.typing_to IS NULL)
        AND us.last_seen > datetime('now', '-10 seconds')
      `).all(req.user.id);
      res.json(typing);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Search messages
  app.get("/api/chat/search", authenticate, (req: any, res) => {
    const { q, recipientId } = req.query;
    if (!q) return res.json([]);
    try {
      let messages;
      if (recipientId) {
        messages = db.prepare(`
          SELECT cm.*, u.username as sender_username, u.role as sender_role
          FROM chat_messages cm
          JOIN users u ON cm.sender_id = u.id
          WHERE cm.content LIKE ? 
          AND ((cm.sender_id = ? AND cm.recipient_id = ?) OR (cm.sender_id = ? AND cm.recipient_id = ?))
          ORDER BY cm.created_at DESC LIMIT 50
        `).all(`%${q}%`, req.user.id, recipientId, recipientId, req.user.id);
      } else {
        messages = db.prepare(`
          SELECT cm.*, u.username as sender_username, u.role as sender_role
          FROM chat_messages cm
          JOIN users u ON cm.sender_id = u.id
          WHERE cm.content LIKE ? AND cm.recipient_id IS NULL
          ORDER BY cm.created_at DESC LIMIT 50
        `).all(`%${q}%`);
      }
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add reaction to message (one reaction per user per message)
  app.post("/api/chat/reaction/:messageId", authenticate, (req: any, res) => {
    const messageId = parseInt(req.params.messageId);
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: "Emoji wymagane" });
    
    try {
      // Usuń poprzednią reakcję użytkownika na tę wiadomość
      db.prepare(`DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ?`).run(messageId, req.user.id);
      // Dodaj nową reakcję
      db.prepare(`INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`).run(messageId, req.user.id, emoji);
      res.json({ success: true, messageId, emoji });
    } catch (err: any) {
      console.error("Error adding reaction:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Remove reaction from message
  app.delete("/api/chat/reaction/:messageId", authenticate, (req: any, res) => {
    const messageId = parseInt(req.params.messageId);
    const { emoji } = req.body;
    
    try {
      db.prepare(`
        DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?
      `).run(messageId, req.user.id, emoji);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get reactions for messages
  app.get("/api/chat/reactions/:messageIds", authenticate, (req: any, res) => {
    const messageIds = req.params.messageIds.split(',').map(Number);
    console.log("Getting reactions for messages:", messageIds);
    try {
      const reactions = db.prepare(`
        SELECT cr.message_id, cr.emoji, cr.user_id, u.username
        FROM chat_reactions cr
        JOIN users u ON cr.user_id = u.id
        WHERE cr.message_id IN (${messageIds.map(() => '?').join(',')})
      `).all(...messageIds);
      console.log("Found reactions:", reactions);
      res.json(reactions);
    } catch (err: any) {
      console.error("Error getting reactions:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Upload file for chat
  app.post("/api/chat/upload", authenticate, (req: any, res) => {
    // Simple base64 file upload
    const { fileName, fileData, fileType } = req.body;
    if (!fileName || !fileData) {
      return res.status(400).json({ error: "Brak pliku" });
    }
    
    try {
      const uploadsDir = path.join(process.cwd(), "data", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const uniqueName = `${Date.now()}-${fileName}`;
      const filePath = path.join(uploadsDir, uniqueName);
      const buffer = Buffer.from(fileData, 'base64');
      fs.writeFileSync(filePath, buffer);
      
      res.json({ 
        success: true, 
        fileUrl: `/api/chat/file/${uniqueName}`,
        fileName,
        fileType
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve uploaded files
  app.get("/api/chat/file/:filename", (req, res) => {
    const filePath = path.join(process.cwd(), "data", "uploads", req.params.filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "Plik nie znaleziony" });
    }
  });

  // ==================== END CHAT API ====================

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Uruchom automatyczny backup
    startBackupScheduler();
  });
}

startServer();
