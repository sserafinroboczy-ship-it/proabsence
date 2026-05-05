import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "./src/db/setup.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-dev";

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
  const sourcePath = path.join(process.cwd(), "database.sqlite");
  
  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, backupPath);
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
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);
  
  // Usuń stare backupy (zostaw tylko MAX_BACKUPS)
  if (files.length > MAX_BACKUPS) {
    files.slice(MAX_BACKUPS).forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f.name));
      console.log(`🗑️ Usunięto stary backup: ${f.name}`);
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
  const PORT = 3000;

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
    
    db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
      req.user.id, "ZMIANA_HASLA", `Użytkownik zmienił swoje hasło`
    );
    
    res.json({ success: true });
  });

  // Get Current User
  app.get("/api/auth/me", authenticate, (req: any, res) => {
    const user = db.prepare("SELECT id, username, role, hall_id, force_password_change FROM users WHERE id = ?").get(req.user.id);
    res.json({ user });
  });

  // Users CRUD
  app.get("/api/users", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const users = db.prepare("SELECT id, username, role, hall_id FROM users").all();
    res.json(users);
  });

  app.post("/api/users", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { username, password, role, hall_id } = req.body;
    try {
      const hash = bcrypt.hashSync(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, password, role, hall_id, force_password_change) VALUES (?, ?, ?, ?, 1)");
      const info = stmt.run(username, hash, role, hall_id || null);
      
      db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
        req.user.id, "UTWORZONO_UZYTKOWNIKA", `Utworzono użytkownika ${username}`
      );
      
      res.json({ id: info.lastInsertRowid, username, role, hall_id });
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
      
      db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
        req.user.id, "RESET_HASLA", `Zresetowano hasło dla użytkownika: ${targetUsername}`
      );
      
      res.json({ success: true, message: "Hasło zresetowane do: password123" });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/users/:id", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      // Pobierz dane użytkownika przed usunięciem
      const userToDelete = db.prepare("SELECT username FROM users WHERE id = ?").get(req.params.id) as any;
      const deletedUsername = userToDelete?.username || `ID:${req.params.id}`;
      
      // Clean up related records that might have FK constraints
      db.prepare("DELETE FROM note_reads WHERE user_id = ?").run(req.params.id);
      db.prepare("DELETE FROM calendar_note_history WHERE user_id = ?").run(req.params.id);
      // note: calendar_notes might be owned by this user, we can keep them or null them
      db.prepare("UPDATE calendar_notes SET user_id = NULL WHERE user_id = ?").run(req.params.id);
      // Usuń logi powiązane z użytkownikiem (NOT NULL constraint)
      db.prepare("DELETE FROM logs WHERE user_id = ?").run(req.params.id);

      db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
      db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
        req.user.id, "USUNIETO_UZYTKOWNIKA", `Usunięto użytkownika: ${deletedUsername}`
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete user error:", err);
      res.status(400).json({ error: "Nie można usunąć użytkownika. Sprawdź konsolę serwera." });
    }
  });

  // Halls CRUD
  app.get("/api/halls", authenticate, (req: any, res) => {
    const halls = db.prepare("SELECT * FROM halls").all();
    res.json(halls);
  });

  app.post("/api/halls", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { name, is_active } = req.body;
    const stmt = db.prepare("INSERT INTO halls (name, is_active) VALUES (?, ?)");
    const info = stmt.run(name, is_active ? 1 : 0);
    
    db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
      req.user.id, "UTWORZONO_HALE", `Utworzono halę ${name}`
    );
    res.json({ id: info.lastInsertRowid, name, is_active });
  });

  app.put("/api/halls/:id", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { name, is_active } = req.body;
    db.prepare("UPDATE halls SET name = ?, is_active = ? WHERE id = ?").run(name, is_active ? 1 : 0, req.params.id);
    
    db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
      req.user.id, "AKTUALIZACJA_HALI", `Zaktualizowano halę ID ${req.params.id}`
    );
    res.json({ success: true });
  });

  // Employees CRUD
  app.get("/api/employees", authenticate, (req: any, res) => {
    const hallId = req.query.hall_id;
    let employees;
    if (hallId) {
      employees = db.prepare("SELECT * FROM employees WHERE hall_id = ?").all(hallId);
    } else {
      employees = db.prepare("SELECT * FROM employees").all();
    }
    res.json(employees);
  });

  // Employees CRUD
  app.post("/api/employees", authenticate, (req: any, res) => {
    const isForeman = req.user.role === "foreman" || req.user.role === "mistrz";
    if (req.user.role !== "admin" && !isForeman) return res.status(403).json({ error: "Forbidden" });
    
    const { first_name, last_name, hall_id, position } = req.body;
    
    // Foreman can only add to their own hall
    if (isForeman && req.user.hall_id) {
      if (parseInt(hall_id) !== parseInt(req.user.hall_id)) {
        return res.status(403).json({ error: "Możesz dodawać pracowników tylko do swojej hali." });
      }
    }

    const stmt = db.prepare("INSERT INTO employees (first_name, last_name, hall_id, position) VALUES (?, ?, ?, ?)");
    const info = stmt.run(first_name, last_name, hall_id, position);
    
    db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
      req.user.id, "UTWORZONO_PRACOWNIKA", `Dodano pracownika ${first_name} ${last_name} (Hala ID: ${hall_id})`
    );
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/employees/:id", authenticate, (req: any, res) => {
    const isForeman = req.user.role === "foreman" || req.user.role === "mistrz";
    if (req.user.role !== "admin" && !isForeman) return res.status(403).json({ error: "Forbidden" });
    
    const { first_name, last_name, hall_id, position } = req.body;
    
    // Foreman check
    if (isForeman && req.user.hall_id) {
      const existing = db.prepare("SELECT hall_id FROM employees WHERE id = ?").get(req.params.id) as any;
      if (existing.hall_id !== req.user.hall_id || parseInt(hall_id) !== parseInt(req.user.hall_id)) {
        return res.status(403).json({ error: "Możesz edytować tylko pracowników ze swojej hali." });
      }
    }

    const stmt = db.prepare("UPDATE employees SET first_name = ?, last_name = ?, hall_id = ?, position = ? WHERE id = ?");
    stmt.run(first_name, last_name, hall_id, position, req.params.id);
    
    db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
      req.user.id, "AKTUALIZACJA_PRACOWNIKA", `Zaktualizowano pracownika ID ${req.params.id}`
    );
    res.json({ success: true });
  });

  app.delete("/api/employees/:id", authenticate, (req: any, res) => {
    const isForeman = req.user.role === "foreman" || req.user.role === "mistrz";
    if (req.user.role !== "admin" && !isForeman) return res.status(403).json({ error: "Forbidden" });
    
    try {
      // Foreman check
      if (isForeman && req.user.hall_id) {
        const existing = db.prepare("SELECT hall_id FROM employees WHERE id = ?").get(req.params.id) as any;
        if (!existing || existing.hall_id !== req.user.hall_id) {
          return res.status(403).json({ error: "Możesz usuwać tylko pracowników ze swojej hali." });
        }
      }

      // Delete related absences first to satisfy FK constraints
      db.prepare("DELETE FROM absences WHERE employee_id = ?").run(req.params.id);

      const stmt = db.prepare("DELETE FROM employees WHERE id = ?");
      stmt.run(req.params.id);
      
      db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
        req.user.id, "USUNIETO_PRACOWNIKA", `Usunięto pracownika ID ${req.params.id}`
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete employee error:", err);
      res.status(400).json({ error: "Nie można usunąć pracownika: " + err.message });
    }
  });

  // Absences
  app.get("/api/absences", authenticate, (req: any, res) => {
    const { start_date, end_date, hall_id } = req.query;
    let query = `
      SELECT a.*, e.first_name, e.last_name, e.hall_id 
      FROM absences a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date >= ? AND a.date <= ?
    `;
    const params: any[] = [start_date, end_date];
    
    if (hall_id) {
      query += " AND e.hall_id = ?";
      params.push(hall_id);
    }
    
    const absences = db.prepare(query).all(...params);
    res.json(absences);
  });

  app.post("/api/absences", authenticate, (req: any, res) => {
    if (req.user.role === "guest") return res.status(403).json({ error: "Forbidden" });
    const { employee_id, date, type, overtime_hours, working_hours } = req.body;
    const wh = working_hours !== undefined ? working_hours : 8;
    
    // Check if foreman is allowed for this employee's hall
    if (req.user.role === "foreman" || req.user.role === "mistrz") {
      const emp = db.prepare("SELECT hall_id FROM employees WHERE id = ?").get(employee_id) as any;
      if (req.user.hall_id && emp.hall_id !== req.user.hall_id) {
        return res.status(403).json({ error: "Forbidden: Not your hall" });
      }
    }

    const existing = db.prepare("SELECT id FROM absences WHERE employee_id = ? AND date = ?").get(employee_id, date) as any;
    
    if (existing) {
      db.prepare("UPDATE absences SET type = ?, overtime_hours = ?, working_hours = ? WHERE id = ?").run(type, overtime_hours, wh, existing.id);
    } else {
      db.prepare("INSERT INTO absences (employee_id, date, type, overtime_hours, working_hours) VALUES (?, ?, ?, ?, ?)").run(employee_id, date, type, overtime_hours, wh);
    }
    
    const empDetails = db.prepare("SELECT first_name, last_name FROM employees WHERE id = ?").get(employee_id) as any;
    const empName = empDetails ? `${empDetails.first_name} ${empDetails.last_name}` : `ID ${employee_id}`;

    db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
      req.user.id, "AKTUALIZACJA_ABSENCJI", `Zaktualizowano absencję pracownika ${empName} w dniu ${date}`
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

  app.post("/api/calendar/notes", authenticate, (req: any, res) => {
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

  // Logs
  app.get("/api/logs", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const logs = db.prepare(`
      SELECT l.*, u.username 
      FROM logs l 
      LEFT JOIN users u ON l.user_id = u.id 
      ORDER BY l.timestamp DESC
    `).all();
    res.json(logs);
  });

  // Backups API
  app.get("/api/backups", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    ensureBackupDir();
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith("database_") && f.endsWith(".sqlite"))
        .map(f => {
          const stats = fs.statSync(path.join(BACKUP_DIR, f));
          return {
            name: f,
            size: Math.round(stats.size / 1024) + " KB",
            created: stats.mtime.toISOString()
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
      db.prepare("INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)").run(
        req.user.id, "BACKUP_RECZNY", "Utworzono ręczny backup bazy danych"
      );
      res.json({ success: true, message: "Backup utworzony pomyślnie" });
    } catch (err: any) {
      res.status(500).json({ error: "Błąd podczas tworzenia backupu" });
    }
  });


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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Uruchom automatyczny backup
    startBackupScheduler();
  });
}

startServer();
