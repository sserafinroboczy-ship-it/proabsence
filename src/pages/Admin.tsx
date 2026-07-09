import React, { useState, useEffect } from "react";
import { fetchApi } from "../lib/api";
import * as XLSX from "xlsx";
import { Database, RefreshCw, Pencil, X } from "lucide-react";
import { format } from "date-fns";

export default function Admin({ user }: { user: any }) {
  const isGuest = user?.role === 'guest';
  const isSuperAdmin = user?.username === 'admin';
  const [users, setUsers] = useState<any[]>([]);
  const [halls, setHalls] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [confirmingUserId, setConfirmingUserId] = useState<number | null>(null);
  const [confirmingEmployeeId, setConfirmingEmployeeId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [managingHallsUser, setManagingHallsUser] = useState<any | null>(null);
  const [managingHallIds, setManagingHallIds] = useState<number[]>([]);
  const [db_userHalls, setDbUserHalls] = useState<Record<number, number[]>>({});
  
  // Filtry pracowników
  const [employeeFilter, setEmployeeFilter] = useState({ name: "", position: "", hall_id: "", employment_type: "" });
  
  // Filtr logów - domyślnie bieżący miesiąc
  const [logsMonth, setLogsMonth] = useState(format(new Date(), "yyyy-MM"));
  
  // Ustawienia limitów godzin
  const [settings, setSettings] = useState<{hours_limit_agencja: string, hours_limit_dg: string}>({
    hours_limit_agencja: "200",
    hours_limit_dg: "200"
  });
  const [savingAgencja, setSavingAgencja] = useState(false);
  const [savingDG, setSavingDG] = useState(false);
  const [savedAgencja, setSavedAgencja] = useState(false);
  const [savedDG, setSavedDG] = useState(false);
  
  // Powiadomienia mailowe
  const [notificationEmails, setNotificationEmails] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailIsGlobal, setNewEmailIsGlobal] = useState(false);
  const [newEmailUserId, setNewEmailUserId] = useState("");
  const [newEmailNotifType, setNewEmailNotifType] = useState<'exceeded'|'warning'|'both'>('exceeded');
  const [addingEmail, setAddingEmail] = useState(false);
  
  // Forms
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "foreman", hall_id: "", employee_number: "", first_name: "", last_name: "" });
  const [newHall, setNewHall] = useState({ name: "", is_active: true, shift_count: 2 });
  const [editingHall, setEditingHall] = useState<any | null>(null);
  const [newEmployee, setNewEmployee] = useState({ first_name: "", last_name: "", position: "", hall_id: "", employee_number: "", employment_type: "Etat", qualifications: "" });
  const [qualificationsList, setQualificationsList] = useState<any[]>([]);
  const [newQualName, setNewQualName] = useState("");
  const [newQualHoursMode, setNewQualHoursMode] = useState<'standard' | 'deduction'>('standard');
  const [addingQual, setAddingQual] = useState(false);
  const [qualError, setQualError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const loadLogs = (month?: string) => {
    const m = month || logsMonth;
    fetchApi(`/api/logs?month=${m}`).then(setLogs);
  };

  const loadSettings = () => {
    fetchApi("/api/settings").then(data => {
      if (data.hours_limit_agencja || data.hours_limit_dg) {
        setSettings({
          hours_limit_agencja: data.hours_limit_agencja || "200",
          hours_limit_dg: data.hours_limit_dg || "200"
        });
      }
    });
  };

  const saveSettingsAgencja = async () => {
    setSavingAgencja(true);
    setSavedAgencja(false);
    try {
      await fetchApi("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ key: 'hours_limit_agencja', value: settings.hours_limit_agencja })
      });
      setSavedAgencja(true);
      setTimeout(() => setSavedAgencja(false), 2000);
    } catch (e) {
      setError("Błąd zapisu ustawień Agencja");
    }
    setSavingAgencja(false);
  };

  const saveSettingsDG = async () => {
    setSavingDG(true);
    setSavedDG(false);
    try {
      await fetchApi("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ key: 'hours_limit_dg', value: settings.hours_limit_dg })
      });
      setSavedDG(true);
      setTimeout(() => setSavedDG(false), 2000);
    } catch (e) {
      setError("Błąd zapisu ustawień DG");
    }
    setSavingDG(false);
  };

  const loadNotificationEmails = () => {
    fetchApi("/api/notification-emails").then(setNotificationEmails).catch(() => {});
  };

  const handleAddEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      setError("Wprowadź prawidłowy adres email");
      return;
    }
    setAddingEmail(true);
    try {
      await fetchApi("/api/notification-emails", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail,
          is_global: newEmailIsGlobal,
          user_id: (!newEmailIsGlobal && newEmailUserId) ? parseInt(newEmailUserId) : null,
          notification_type: newEmailNotifType
        })
      });
      setNewEmail("");
      setNewEmailIsGlobal(false);
      setNewEmailUserId("");
      setNewEmailNotifType('exceeded');
      loadNotificationEmails();
    } catch (err: any) {
      setError(err.message);
    }
    setAddingEmail(false);
  };

  const handleDeleteEmail = async (id: number) => {
    try {
      await fetchApi(`/api/notification-emails/${id}`, { method: "DELETE" });
      loadNotificationEmails();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChangeNotifType = async (id: number, notification_type: string) => {
    try {
      await fetchApi(`/api/notification-emails/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ notification_type })
      });
      loadNotificationEmails();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadData = () => {
    fetchApi("/api/users").then(setUsers);
    fetchApi("/api/halls").then(setHalls);
    fetchApi("/api/employees").then(setEmployees);
    fetchApi("/api/backups").then(setBackups);
    fetchApi("/api/qualifications").then(setQualificationsList).catch(() => {});
    // Załaduj przypisania hal dla adminów, foreman i mistrz
    fetchApi("/api/users").then(async (usersData: any[]) => {
      const managedUsers = usersData.filter(u => ['admin', 'foreman', 'mistrz'].includes(u.role) && u.username !== 'admin');
      const map: Record<number, number[]> = {};
      await Promise.all(managedUsers.map(async (u: any) => {
        try {
          const rows = await fetchApi(`/api/user-halls/${u.id}`);
          map[u.id] = rows.map((r: any) => r.hall_id);
        } catch {}
      }));
      setDbUserHalls(map);
    }).catch(() => {});
    loadLogs(logsMonth); // Odśwież logi przy każdej akcji
    loadSettings();
    loadNotificationEmails();
  };

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    try {
      await fetchApi("/api/backups", { method: "POST" });
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBackupLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, []);
  
  // Ładuj logi przy zmianie miesiąca
  useEffect(() => {
    loadLogs();
  }, [logsMonth]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await fetchApi("/api/users", {
        method: "POST",
        body: JSON.stringify({
          ...newUser,
          hall_id: newUser.hall_id ? parseInt(newUser.hall_id) : null
        })
      });
      setNewUser({ username: "", password: "", role: "foreman", hall_id: "", employee_number: "", first_name: "", last_name: "" });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (id: number) => {
    setError(null);
    try {
      await fetchApi(`/api/users/${id}`, { method: "DELETE" });
      setConfirmingUserId(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!window.confirm("Czy na pewno chcesz zresetować hasło tego użytkownika do 'password123'?")) return;
    setError(null);
    try {
      const res = await fetchApi(`/api/users/${id}/reset-password`, { method: "POST" });
      alert(res.message);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError(null);
    try {
      await fetchApi(`/api/users/${editingUser.id}`, {
        method: "PUT",
        body: JSON.stringify({
          username: editingUser.username,
          role: editingUser.role,
          hall_id: editingUser.hall_id || null,
          employee_number: editingUser.employee_number || null
        })
      });
      setEditingUser(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateHall = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await fetchApi("/api/halls", {
        method: "POST",
        body: JSON.stringify(newHall)
      });
      setNewHall({ name: "", is_active: true, shift_count: 2 });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleHall = async (hall: any) => {
    setError(null);
    try {
      await fetchApi(`/api/halls/${hall.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: hall.name, is_active: !hall.is_active, shift_count: hall.shift_count })
      });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateHall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHall) return;
    setError(null);
    try {
      await fetchApi(`/api/halls/${editingHall.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editingHall.name, is_active: editingHall.is_active, shift_count: editingHall.shift_count })
      });
      setEditingHall(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await fetchApi("/api/employees", {
        method: "POST",
        body: JSON.stringify(newEmployee)
      });
      setNewEmployee({ first_name: "", last_name: "", position: "", hall_id: "", employee_number: "", employment_type: "Etat", qualifications: "" });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    setError(null);
    try {
      await fetchApi(`/api/employees/${id}`, { method: "DELETE" });
      setConfirmingEmployeeId(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const exportLogsToExcel = () => {
    if (logs.length === 0) return;
    
    const data = logs.map(log => ({
      "Data i Godzina": log.timestamp,
      "Użytkownik": log.username || "",
      "Akcja": log.action || "",
      "Szczegóły": log.details || ""
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Ustawienie szerokości kolumn
    ws['!cols'] = [
      { wch: 20 },  // Data i Godzina
      { wch: 15 },  // Użytkownik
      { wch: 25 },  // Akcja
      { wch: 60 }   // Szczegóły
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Logi_${logsMonth}`);
    XLSX.writeFile(wb, `Logi_Systemowe_${logsMonth}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Zarządzanie Halami */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Zarządzanie Halami</h3>
          {!isGuest && <form onSubmit={handleCreateHall} className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Nazwa hali"
              value={newHall.name}
              onChange={e => setNewHall({...newHall, name: e.target.value})}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
              required
            />
            <select
              value={newHall.shift_count}
              onChange={e => setNewHall({...newHall, shift_count: parseInt(e.target.value)})}
              className="border border-gray-300 rounded-lg px-3 py-2"
              title="Liczba zmian"
            >
              <option value={1}>1 zmiana</option>
              <option value={2}>2 zmiany</option>
              <option value={3}>3 zmiany</option>
            </select>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Dodaj Halę
            </button>
          </form>}
          <ul className="divide-y divide-gray-100">
            {halls.map(hall => (
              <li key={hall.id} className="py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{hall.name}</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {hall.shift_count || 2} {(hall.shift_count || 2) === 1 ? 'zmiana' : 'zmiany'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${hall.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {hall.is_active ? "Aktywna" : "Nieaktywna"}
                  </span>
                  {!isGuest && <button 
                    onClick={() => setEditingHall({...hall})}
                    className="text-sm text-amber-600 hover:text-amber-800"
                  >
                    Edytuj
                  </button>}
                  {!isGuest && <button 
                    onClick={() => handleToggleHall(hall)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {hall.is_active ? "Dezaktywuj" : "Aktywuj"}
                  </button>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Modal edycji hali */}
        {editingHall && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-lg font-semibold mb-4">Edytuj Halę</h3>
              <form onSubmit={handleUpdateHall} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa hali</label>
                  <input
                    type="text"
                    value={editingHall.name}
                    onChange={e => setEditingHall({...editingHall, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Liczba zmian</label>
                  <select
                    value={editingHall.shift_count || 2}
                    onChange={e => setEditingHall({...editingHall, shift_count: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value={1}>1 zmiana (bez rotacji)</option>
                    <option value={2}>2 zmiany</option>
                    <option value={3}>3 zmiany</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Przy 1 zmianie kolumna "Zm" nie będzie wyświetlana w karcie obecności.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hallActive"
                    checked={editingHall.is_active}
                    onChange={e => setEditingHall({...editingHall, is_active: e.target.checked})}
                    className="rounded"
                  />
                  <label htmlFor="hallActive" className="text-sm">Hala aktywna</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    Zapisz
                  </button>
                  <button type="button" onClick={() => setEditingHall(null)} className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Zarządzanie Użytkownikami */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Użytkownicy</h3>
          {!isGuest && <form onSubmit={handleCreateUser} className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Login"
                value={newUser.username}
                onChange={e => setNewUser({...newUser, username: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2"
                required
              />
              <input
                type="password"
                placeholder="Hasło"
                value={newUser.password}
                onChange={e => setNewUser({...newUser, password: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <select
                value={newUser.role}
                onChange={e => setNewUser({...newUser, role: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="admin">Administrator</option>
                <option value="mistrz">Mistrz</option>
                <option value="foreman">Brygadzista</option>
                <option value="guest">Gość</option>
              </select>
              <select
                value={newUser.hall_id}
                onChange={e => setNewUser({...newUser, hall_id: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2"
                disabled={newUser.role === "admin" || newUser.role === "guest"}
              >
                <option value="">Wybierz halę {(newUser.role === "mistrz" || newUser.role === "foreman") ? "*" : "(opcjonalnie)"}</option>
                {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            {/* Imię, nazwisko i nr pracownika dla mistrza/brygadzisty */}
            {(newUser.role === "mistrz" || newUser.role === "foreman") && (
              <div className="grid grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Imię *"
                  value={newUser.first_name}
                  onChange={e => setNewUser({...newUser, first_name: e.target.value})}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
                <input
                  type="text"
                  placeholder="Nazwisko *"
                  value={newUser.last_name}
                  onChange={e => setNewUser({...newUser, last_name: e.target.value})}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
                <input
                  type="text"
                  placeholder="Nr pracownika"
                  value={newUser.employee_number}
                  onChange={e => setNewUser({...newUser, employee_number: e.target.value})}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            )}
            <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Dodaj Użytkownika
            </button>
          </form>}
          
          <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {users.map(u => {
              const roleNames: Record<string, string> = {
                admin: "Administrator",
                foreman: "Brygadzista",
                mistrz: "Mistrz",
                guest: "Gość"
              };
              const hallName = halls.find(h => h.id === u.hall_id)?.name;
              return (
              <li key={u.id} className={`py-3 flex justify-between items-center ${u.username === 'admin' ? 'bg-amber-50 rounded-lg px-2' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{u.username}</p>
                    {u.username === 'admin' && <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">SUPERADMIN</span>}
                  </div>
                  <p className="text-xs text-gray-500">Rola: {roleNames[u.role] || u.role} {hallName ? `| Hala: ${hallName}` : ""}</p>
                  {(u.role === 'admin' || u.role === 'foreman' || u.role === 'mistrz') && u.username !== 'admin' && (() => {
                    const uhRows = (db_userHalls[u.id] || []);
                    return uhRows.length > 0
                      ? <p className="text-[10px] text-teal-600">Hale: {uhRows.map((hid: number) => halls.find(h => h.id === hid)?.name).filter(Boolean).join(', ')}</p>
                      : <p className="text-[10px] text-red-400">Brak przypisanych hal (widzi tylko własną)</p>;
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  {u.username !== 'admin' && (u.role === 'admin' || u.role === 'foreman' || u.role === 'mistrz') && (
                    <button
                      type="button"
                      onClick={async () => {
                        const rows = await fetchApi(`/api/user-halls/${u.id}`);
                        setManagingHallIds(rows.map((r: any) => r.hall_id));
                        setManagingHallsUser(u);
                      }}
                      className="text-xs text-teal-600 hover:text-teal-800 border border-teal-200 px-2 py-1 rounded"
                      title="Zarządzaj dostępem do hal"
                    >
                      Hale
                    </button>
                  )}
                  {u.username !== 'admin' && !isGuest && (
                    <button
                      type="button"
                      onClick={() => setEditingUser({...u})}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Edytuj użytkownika"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {u.username !== 'admin' && !isGuest && (
                    <button
                      type="button"
                      onClick={() => handleResetPassword(u.id)}
                      className="text-sm text-amber-600 hover:text-amber-800"
                    >
                      Reset
                    </button>
                  )}
                  {u.username !== 'admin' && !isGuest && (
                    confirmingUserId === u.id ? (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleDeleteUser(u.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">Tak, usuń</button>
                        <button type="button" onClick={() => setConfirmingUserId(null)} className="text-xs text-gray-400 hover:text-gray-600">Nie</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmingUserId(u.id)} className="text-sm text-red-600 hover:text-red-800">Usuń</button>
                    )
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Modal zarządzania dostępem do hal dla admina */}
      {managingHallsUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-teal-50">
              <div>
                <h3 className="text-base font-bold text-gray-800">Dostęp do hal</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {managingHallsUser.role === 'admin' ? 'Administrator' : managingHallsUser.role === 'mistrz' ? 'Mistrz' : 'Brygadzista'}: <span className="font-semibold">{managingHallsUser.username}</span>
                </p>
              </div>
              <button onClick={() => setManagingHallsUser(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">Wybierz hale/obszary widoczne dla tego użytkownika:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {halls.map(hall => (
                  <label key={hall.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={managingHallIds.includes(hall.id)}
                      onChange={e => {
                        setManagingHallIds(prev =>
                          e.target.checked ? [...prev, hall.id] : prev.filter(id => id !== hall.id)
                        );
                      }}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">{hall.name}</span>
                    {!hall.is_active && <span className="text-[10px] text-gray-400">(nieaktywna)</span>}
                  </label>
                ))}
              </div>
              {managingHallIds.length === 0 && (
                <p className="text-xs text-red-500 mt-2">⚠️ Bez przypisanych hal użytkownik będzie widział tylko swoją domyślną halę</p>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
              <button type="button" onClick={() => setManagingHallsUser(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Anuluj</button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetchApi(`/api/user-halls/${managingHallsUser.id}`, {
                      method: "PUT",
                      body: JSON.stringify({ hall_ids: managingHallIds })
                    });
                    setDbUserHalls(prev => ({ ...prev, [managingHallsUser.id]: managingHallIds }));
                    setManagingHallsUser(null);
                  } catch (err: any) {
                    setError(err.message || "Błąd zapisu");
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
              >
                Zapisz dostęp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ustawienia Limitów Godzin */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">⏱️ Limity Godzin (miesięczne)</h3>
        <p className="text-sm text-gray-500 mb-4">Ustaw miesięczny limit godzin dla pracowników Agencji i DG. Etat nie ma limitu.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-orange-700 min-w-[80px]">Agencja:</label>
            <input
              type="number"
              value={settings.hours_limit_agencja}
              onChange={e => !isGuest && setSettings({...settings, hours_limit_agencja: e.target.value})}
              readOnly={isGuest}
              className="border border-gray-300 rounded-lg px-3 py-2 w-24 text-center font-bold"
              min="0"
            />
            <span className="text-sm text-gray-500">godzin/miesiąc</span>
            {!isGuest && <button
              type="button"
              onClick={saveSettingsAgencja}
              disabled={savingAgencja}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                savedAgencja 
                  ? 'bg-green-500 text-white' 
                  : 'bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50'
              }`}
            >
              {savingAgencja ? '...' : savedAgencja ? '✓ Zapisano' : 'Zapisz'}
            </button>}
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-purple-700 min-w-[80px]">DG:</label>
            <input
              type="number"
              value={settings.hours_limit_dg}
              onChange={e => !isGuest && setSettings({...settings, hours_limit_dg: e.target.value})}
              readOnly={isGuest}
              className="border border-gray-300 rounded-lg px-3 py-2 w-24 text-center font-bold"
              min="0"
            />
            <span className="text-sm text-gray-500">godzin/miesiąc</span>
            {!isGuest && <button
              type="button"
              onClick={saveSettingsDG}
              disabled={savingDG}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                savedDG 
                  ? 'bg-green-500 text-white' 
                  : 'bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50'
              }`}
            >
              {savingDG ? '...' : savedDG ? '✓ Zapisano' : 'Zapisz'}
            </button>}
          </div>
        </div>
      </div>

      {/* Powiadomienia Mailowe */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-2">📧 Powiadomienia Mailowe</h3>
        
        {/* Legenda typów */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
            <span className="font-semibold text-red-700">Przekroczenie</span>
            <span className="text-red-500">— kierownictwo, gdy pracownik wejdzie na minus</span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            <span className="font-semibold text-amber-700">Ostrzeżenie</span>
            <span className="text-amber-600">— nadzór, gdy zostanie &lt;20h do limitu</span>
          </div>
          <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
            <span className="font-semibold text-purple-700">Oba</span>
            <span className="text-purple-500">— otrzymuje oba typy</span>
          </div>
        </div>

        {!isGuest && <div className="space-y-3 mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="Adres email..."
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddEmail()}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm"
            />
            <select
              value={newEmailNotifType}
              onChange={e => setNewEmailNotifType(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
            >
              <option value="exceeded">🔴 Przekroczenie</option>
              <option value="warning">🟡 Ostrzeżenie</option>
              <option value="both">🟣 Oba</option>
            </select>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newEmailIsGlobal}
                onChange={e => { setNewEmailIsGlobal(e.target.checked); if (e.target.checked) setNewEmailUserId(""); }}
                className="w-4 h-4 text-amber-500 rounded"
              />
              <span className="text-sm font-medium text-amber-700">Globalny (wszystkie hale)</span>
            </label>
            {!newEmailIsGlobal && (
              <select
                value={newEmailUserId}
                onChange={e => setNewEmailUserId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]"
              >
                <option value="">Bez przypisania (legacy globalny)</option>
                {users
                  .filter(u => ['admin', 'foreman', 'mistrz'].includes(u.role) && u.username !== 'admin')
                  .map(u => {
                    const roleLabel = u.role === 'admin' ? 'Admin' : u.role === 'foreman' ? 'Brygadzista' : 'Mistrz';
                    const primaryHall = halls.find(h => h.id === u.hall_id);
                    const hallLabel = primaryHall ? primaryHall.name : 'brak hali';
                    return (
                      <option key={u.id} value={u.id}>{u.username} ({roleLabel}) — hala główna: {hallLabel}</option>
                    );
                  })
                }
              </select>
            )}
            <button
              type="button"
              onClick={handleAddEmail}
              disabled={addingEmail}
              className="bg-blue-600 text-white px-5 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
            >
              {addingEmail ? '...' : 'Dodaj'}
            </button>
          </div>
        </div>}

        {notificationEmails.length > 0 ? (
          <div className="space-y-2">
            {notificationEmails.map(email => {
              const assignedUser = email.user_id ? users.find(u => u.id === email.user_id) : null;
              const hallsForUser = email.user_id ? (db_userHalls[email.user_id] || []).map((hid: number) => halls.find(h => h.id === hid)?.name).filter(Boolean) : [];
              const notifType = email.notification_type || 'exceeded';
              const notifColors: Record<string, string> = {
                exceeded: 'bg-red-50 border-red-200 text-red-700',
                warning: 'bg-amber-50 border-amber-200 text-amber-700',
                both: 'bg-purple-50 border-purple-200 text-purple-700'
              };
              const notifLabel: Record<string, string> = {
                exceeded: '🔴 Przekroczenie',
                warning: '🟡 Ostrzeżenie',
                both: '🟣 Oba'
              };
              return (
                <div key={email.id} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                  email.is_global ? 'bg-amber-50 border-amber-200' : assignedUser ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg">{email.is_global ? '🌐' : assignedUser ? '👤' : '📧'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{email.email}</p>
                      {email.is_global && <p className="text-xs text-amber-600 font-medium">Globalny — wszystkie hale</p>}
                      {!email.is_global && assignedUser && (() => {
                        const roleLabel = assignedUser.role === 'admin' ? 'Admin' : assignedUser.role === 'foreman' ? 'Brygadzista' : assignedUser.role === 'mistrz' ? 'Mistrz' : assignedUser.role;
                        const primaryHall = halls.find(h => h.id === assignedUser.hall_id);
                        return (
                          <p className="text-xs text-teal-600">
                            {roleLabel}: <span className="font-semibold">{assignedUser.username}</span>
                            {primaryHall ? ` — hala główna: ${primaryHall.name}` : ' — brak hali głównej'}
                          </p>
                        );
                      })()}
                      {!email.is_global && !assignedUser && <p className="text-xs text-gray-400">Legacy — wszystkie hale</p>}
                    </div>
                    {/* Typ powiadomienia — select inline */}
                    {!isGuest ? (
                      <select
                        value={notifType}
                        onChange={e => handleChangeNotifType(email.id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-3 py-1 border cursor-pointer ${notifColors[notifType]}`}
                      >
                        <option value="exceeded">🔴 Przekroczenie</option>
                        <option value="warning">🟡 Ostrzeżenie</option>
                        <option value="both">🟣 Oba</option>
                      </select>
                    ) : (
                      <span className={`text-xs font-semibold rounded-full px-3 py-1 border ${notifColors[notifType]}`}>
                        {notifLabel[notifType]}
                      </span>
                    )}
                  </div>
                  {!isGuest && <button
                    onClick={() => handleDeleteEmail(email.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium ml-3 shrink-0"
                  >
                    Usuń
                  </button>}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm italic">Brak skonfigurowanych adresów email</p>
        )}
      </div>

      {/* Zarządzanie Kwalifikacjami */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block"></span>
          Kwalifikacje Pracowników
        </h3>
        <p className="text-xs text-gray-400 mb-5">Lista kwalifikacji dostępnych przy dodawaniu i edycji pracowników</p>

        {qualError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{qualError}</div>
        )}

        {/* Formularz dodawania */}
        {!isGuest && <form
          onSubmit={async e => {
            e.preventDefault();
            setQualError(null);
            if (!newQualName.trim()) return;
            setAddingQual(true);
            try {
              await fetchApi("/api/qualifications", {
                method: "POST",
                body: JSON.stringify({ name: newQualName.trim(), hours_mode: newQualHoursMode })
              });
              setNewQualName("");
              setNewQualHoursMode('standard');
              fetchApi("/api/qualifications").then(setQualificationsList);
            } catch (err: any) {
              setQualError(err.message || "Błąd dodawania kwalifikacji");
            }
            setAddingQual(false);
          }}
          className="space-y-3 mb-6"
        >
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nazwa kwalifikacji (np. Spawacz TIG)"
              value={newQualName}
              onChange={e => setNewQualName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none"
              maxLength={50}
            />
            <button
              type="submit"
              disabled={addingQual || !newQualName.trim()}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingQual ? "Dodaję..." : "+ Dodaj"}
            </button>
          </div>
          <div className="flex items-center gap-4 px-1">
            <p className="text-xs text-gray-500 font-medium">Liczenie godzin:</p>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="hoursMode"
                value="standard"
                checked={newQualHoursMode === 'standard'}
                onChange={() => setNewQualHoursMode('standard')}
                className="text-teal-600"
              />
              <span className="text-xs text-gray-700">Standardowe (1:1)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="hoursMode"
                value="deduction"
                checked={newQualHoursMode === 'deduction'}
                onChange={() => setNewQualHoursMode('deduction')}
                className="text-orange-500"
              />
              <span className="text-xs text-orange-700 font-medium">Z potrąceniem (-0.5h/dzień obecności)</span>
            </label>
          </div>
        </form>}

        {/* Lista kwalifikacji */}
        {qualificationsList.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Brak kwalifikacji — dodaj pierwszą powyżej</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {qualificationsList.map(q => (
              <div key={q.id} className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 group ${
                q.hours_mode === 'deduction' ? 'bg-orange-50 border-orange-200' : 'bg-teal-50 border-teal-100'
              }`}>
                <span className={`text-sm font-medium ${q.hours_mode === 'deduction' ? 'text-orange-700' : 'text-teal-700'}`}>{q.name}</span>
                {q.hours_mode === 'deduction' && <span className="text-[10px] text-orange-500 font-semibold">-0.5h</span>}
                <button
                  onClick={async () => {
                    setQualError(null);
                    if (!window.confirm(`Usunąć kwalifikację "${q.name}"? Nie usunie jej z istniejących pracowników.`)) return;
                    try {
                      await fetchApi(`/api/qualifications/${q.id}`, { method: "DELETE" });
                      fetchApi("/api/qualifications").then(setQualificationsList);
                    } catch (err: any) {
                      setQualError(err.message || "Błąd usuwania");
                    }
                  }}
                  className="w-4 h-4 rounded-full bg-teal-200 hover:bg-red-400 text-teal-700 hover:text-white flex items-center justify-center transition-colors text-xs font-bold leading-none"
                  title="Usuń kwalifikację"
                  style={{display: isGuest ? 'none' : undefined}}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zarządzanie Pracownikami */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">Baza Pracowników</h3>
        {!isGuest && <form onSubmit={handleCreateEmployee} className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Nr pracownika"
              value={newEmployee.employee_number}
              onChange={e => setNewEmployee({...newEmployee, employee_number: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="Nazwisko"
              value={newEmployee.last_name}
              onChange={e => setNewEmployee({...newEmployee, last_name: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2"
              required
            />
            <input
              type="text"
              placeholder="Imię"
              value={newEmployee.first_name}
              onChange={e => setNewEmployee({...newEmployee, first_name: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2"
              required
            />
            <input
              type="text"
              placeholder="Stanowisko"
              value={newEmployee.position}
              onChange={e => setNewEmployee({...newEmployee, position: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2"
              required
            />
            <select
              value={newEmployee.hall_id}
              onChange={e => setNewEmployee({...newEmployee, hall_id: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              <option value="">Wybierz halę</option>
              {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          {qualificationsList.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-sm font-medium text-gray-700">Kwalifikacje:</span>
              {qualificationsList.map(q => (
                <label key={q.id} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(newEmployee.qualifications || "").split(",").map(s => s.trim()).filter(Boolean).includes(q.name)}
                    onChange={e => {
                      const current = (newEmployee.qualifications || "").split(",").map(s => s.trim()).filter(Boolean);
                      const updated = e.target.checked ? [...current, q.name] : current.filter(x => x !== q.name);
                      setNewEmployee({...newEmployee, qualifications: updated.join(", ")});
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">{q.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mb-2">
            <span className="text-sm font-medium text-gray-700">Forma:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="admin_employment_type"
                value="Etat"
                checked={newEmployee.employment_type === "Etat"}
                onChange={e => setNewEmployee({...newEmployee, employment_type: e.target.value})}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">Etat</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="admin_employment_type"
                value="Agencja"
                checked={newEmployee.employment_type === "Agencja"}
                onChange={e => setNewEmployee({...newEmployee, employment_type: e.target.value})}
                className="w-4 h-4 text-orange-600"
              />
              <span className="text-sm">Agencja</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="admin_employment_type"
                value="DG"
                checked={newEmployee.employment_type === "DG"}
                onChange={e => setNewEmployee({...newEmployee, employment_type: e.target.value})}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm">DG</span>
            </label>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Dodaj Pracownika
          </button>
        </form>}

        {/* Filtry */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input
            type="text"
            placeholder="🔍 Szukaj po imieniu lub nazwisku..."
            value={employeeFilter.name}
            onChange={e => setEmployeeFilter({...employeeFilter, name: e.target.value})}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="🔍 Szukaj po stanowisku..."
            value={employeeFilter.position}
            onChange={e => setEmployeeFilter({...employeeFilter, position: e.target.value})}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={employeeFilter.hall_id}
            onChange={e => setEmployeeFilter({...employeeFilter, hall_id: e.target.value})}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Wszystkie hale</option>
            {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select
            value={employeeFilter.employment_type}
            onChange={e => setEmployeeFilter({...employeeFilter, employment_type: e.target.value})}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Wszystkie formy</option>
            <option value="Etat">Etat</option>
            <option value="Agencja">Agencja</option>
            <option value="DG">DG</option>
          </select>
          {(employeeFilter.name || employeeFilter.position || employeeFilter.hall_id || employeeFilter.employment_type) && (
            <button
              type="button"
              onClick={() => setEmployeeFilter({ name: "", position: "", hall_id: "", employment_type: "" })}
              className="text-sm text-gray-500 hover:text-red-600 flex items-center justify-center gap-1"
            >
              ✕ Wyczyść filtry
            </button>
          )}
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-50">
                <th className="p-3 bg-gray-50">Nr</th>
                <th className="p-3 bg-gray-50">Nazwisko i Imię</th>
                <th className="p-3 bg-gray-50">Stanowisko</th>
                <th className="p-3 bg-gray-50">Forma</th>
                <th className="p-3 bg-gray-50">Hala</th>
                <th className="p-3 text-right bg-gray-50">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees
                .filter(emp => {
                  const fullName = `${emp.last_name} ${emp.first_name}`.toLowerCase();
                  const nameMatch = !employeeFilter.name || fullName.includes(employeeFilter.name.toLowerCase());
                  const positionMatch = !employeeFilter.position || emp.position.toLowerCase().includes(employeeFilter.position.toLowerCase());
                  const hallMatch = !employeeFilter.hall_id || emp.hall_id === parseInt(employeeFilter.hall_id);
                  const formaMatch = !employeeFilter.employment_type || (emp.employment_type || 'Etat') === employeeFilter.employment_type;
                  return nameMatch && positionMatch && hallMatch && formaMatch;
                })
                .map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="p-3 text-gray-500 font-mono text-xs">{emp.employee_number || '-'}</td>
                  <td className="p-3 font-medium">{emp.last_name} {emp.first_name}</td>
                  <td className="p-3 text-gray-600">{emp.position}</td>
                  <td className="p-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      emp.employment_type === 'Agencja' ? 'bg-orange-100 text-orange-700' :
                      emp.employment_type === 'DG' ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {emp.employment_type || 'Etat'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">
                    {halls.find(h => h.id === emp.hall_id)?.name || `Hala ID: ${emp.hall_id}`}
                  </td>
                  <td className="p-3 text-right">
                    {!isGuest && (confirmingEmployeeId === emp.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          type="button"
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                        >
                          TAK
                        </button>
                        <button 
                          type="button"
                          onClick={() => setConfirmingEmployeeId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          NIE
                        </button>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => setConfirmingEmployeeId(emp.id)}
                        className="text-sm text-red-600 hover:text-red-800 cursor-pointer"
                      >
                        Usuń
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logi Systemowe */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Logi Systemowe</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {logs.length} wpisów
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={logsMonth}
              onChange={(e) => setLogsMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors"
            />
            <button
              onClick={exportLogsToExcel}
              className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
              title={`Eksportuj logi z ${logsMonth} do Excela`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Eksport
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Użytkownik</th>
                <th className="p-3">Akcja</th>
                <th className="p-3">Szczegóły</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-3 whitespace-nowrap">{log.timestamp}</td>
                  <td className="p-3 font-medium">{log.username}</td>
                  <td className="p-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{log.action}</span></td>
                  <td className="p-3 text-gray-600">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backupy */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold">Kopie Zapasowe Bazy Danych</h3>
          </div>
          {!isGuest && <button
            onClick={handleCreateBackup}
            disabled={backupLoading}
            className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${backupLoading ? 'animate-spin' : ''}`} />
            {backupLoading ? 'Tworzenie...' : 'Utwórz Backup'}
          </button>}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Automatyczny backup co 24h. Przechowywane ostatnie 7 kopii. Folder: <code className="bg-gray-100 px-1 rounded">backups/</code>
        </p>
        {backups.length === 0 ? (
          <p className="text-gray-400 text-sm">Brak kopii zapasowych. Pierwszy backup zostanie utworzony automatycznie.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3">Nazwa pliku</th>
                  <th className="p-3">Rozmiar</th>
                  <th className="p-3">Data utworzenia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {backups.map((backup, idx) => (
                  <tr key={backup.name} className={idx === 0 ? "bg-emerald-50" : "hover:bg-gray-50"}>
                    <td className="p-3 font-mono text-xs">
                      {backup.name}
                      {idx === 0 && <span className="ml-2 text-xs bg-emerald-500 text-white px-2 py-0.5 rounded">Najnowszy</span>}
                    </td>
                    <td className="p-3">{backup.size}</td>
                    <td className="p-3">{new Date(backup.created).toLocaleString("pl-PL")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Edycji Użytkownika */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="text-xl font-bold text-gray-800">Edytuj Użytkownika</h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Login</label>
                <input
                  type="text"
                  required
                  value={editingUser.username}
                  onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rola</label>
                <select
                  value={editingUser.role}
                  onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="admin">Administrator</option>
                  <option value="mistrz">Mistrz</option>
                  <option value="foreman">Brygadzista</option>
                  <option value="guest">Gość</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hala (opcjonalnie)</label>
                <select
                  value={editingUser.hall_id || ""}
                  onChange={e => setEditingUser({...editingUser, hall_id: e.target.value ? parseInt(e.target.value) : null})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Brak --</option>
                  {halls.filter(h => h.is_active).map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nr pracownika (opcjonalnie)</label>
                <input
                  type="text"
                  value={editingUser.employee_number || ""}
                  onChange={e => setEditingUser({...editingUser, employee_number: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="np. 001"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Zapisz zmiany
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
