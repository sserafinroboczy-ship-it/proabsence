import React, { useState, useEffect } from "react";
import { fetchApi } from "../lib/api";
import * as XLSX from "xlsx";
import { Database, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [halls, setHalls] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [confirmingUserId, setConfirmingUserId] = useState<number | null>(null);
  const [confirmingEmployeeId, setConfirmingEmployeeId] = useState<number | null>(null);
  
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
  const [addingEmail, setAddingEmail] = useState(false);
  
  // Forms
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "foreman", hall_id: "", employee_number: "" });
  const [newHall, setNewHall] = useState({ name: "", is_active: true });
  const [newEmployee, setNewEmployee] = useState({ first_name: "", last_name: "", position: "", hall_id: "", employee_number: "", employment_type: "Etat" });

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
        body: JSON.stringify({ email: newEmail })
      });
      setNewEmail("");
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

  const loadData = () => {
    fetchApi("/api/users").then(setUsers);
    fetchApi("/api/halls").then(setHalls);
    fetchApi("/api/employees").then(setEmployees);
    fetchApi("/api/backups").then(setBackups);
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
      setNewUser({ username: "", password: "", role: "foreman", hall_id: "", employee_number: "" });
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

  const handleCreateHall = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await fetchApi("/api/halls", {
        method: "POST",
        body: JSON.stringify(newHall)
      });
      setNewHall({ name: "", is_active: true });
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
        body: JSON.stringify({ name: hall.name, is_active: !hall.is_active })
      });
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
      setNewEmployee({ first_name: "", last_name: "", position: "", hall_id: "", employee_number: "", employment_type: "Etat" });
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
          <form onSubmit={handleCreateHall} className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Nazwa hali"
              value={newHall.name}
              onChange={e => setNewHall({...newHall, name: e.target.value})}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
              required
            />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Dodaj Halę
            </button>
          </form>
          <ul className="divide-y divide-gray-100">
            {halls.map(hall => (
              <li key={hall.id} className="py-3 flex justify-between items-center">
                <span className="font-medium">{hall.name}</span>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${hall.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {hall.is_active ? "Aktywna" : "Nieaktywna"}
                  </span>
                  <button 
                    onClick={() => handleToggleHall(hall)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {hall.is_active ? "Dezaktywuj" : "Aktywuj"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Zarządzanie Użytkownikami */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Użytkownicy</h3>
          <form onSubmit={handleCreateUser} className="space-y-4 mb-6">
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
            <div className="grid grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Nr pracownika"
                value={newUser.employee_number}
                onChange={e => setNewUser({...newUser, employee_number: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2"
              />
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
                <option value="">Wybierz halę (opcjonalnie)</option>
                {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Dodaj Użytkownika
            </button>
          </form>
          
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
              <li key={u.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{u.username}</p>
                  <p className="text-xs text-gray-500">Rola: {roleNames[u.role] || u.role} {hallName ? `| Hala: ${hallName}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => handleResetPassword(u.id)}
                    className="text-sm text-amber-600 hover:text-amber-800"
                  >
                    Reset
                  </button>
                  {confirmingUserId === u.id ? (
                    <div className="flex items-center gap-2">
                       <button 
                          type="button"
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                        >
                          Tak, usuń
                        </button>
                        <button 
                          type="button"
                          onClick={() => setConfirmingUserId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Nie
                        </button>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => setConfirmingUserId(u.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Usuń
                    </button>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      </div>

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
              onChange={e => setSettings({...settings, hours_limit_agencja: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2 w-24 text-center font-bold"
              min="0"
            />
            <span className="text-sm text-gray-500">godzin/miesiąc</span>
            <button
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
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-purple-700 min-w-[80px]">DG:</label>
            <input
              type="number"
              value={settings.hours_limit_dg}
              onChange={e => setSettings({...settings, hours_limit_dg: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2 w-24 text-center font-bold"
              min="0"
            />
            <span className="text-sm text-gray-500">godzin/miesiąc</span>
            <button
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
            </button>
          </div>
        </div>
      </div>

      {/* Powiadomienia Mailowe */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">📧 Powiadomienia Mailowe</h3>
        <p className="text-sm text-gray-500 mb-4">
          Dodaj adresy email osób, które mają otrzymywać powiadomienia o przekroczeniu limitu godzin przez pracowników Agencji/DG.
        </p>
        
        <div className="flex gap-3 mb-4">
          <input
            type="email"
            placeholder="Wprowadź adres email..."
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddEmail()}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
          />
          <button
            type="button"
            onClick={handleAddEmail}
            disabled={addingEmail}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {addingEmail ? '...' : 'Dodaj'}
          </button>
        </div>

        {notificationEmails.length > 0 ? (
          <div className="space-y-2">
            {notificationEmails.map(email => (
              <div key={email.id} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-blue-600">📧</span>
                  <span className="text-gray-800">{email.email}</span>
                </div>
                <button
                  onClick={() => handleDeleteEmail(email.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Usuń
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm italic">Brak skonfigurowanych adresów email</p>
        )}
      </div>

      {/* Zarządzanie Pracownikami */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">Baza Pracowników</h3>
        <form onSubmit={handleCreateEmployee} className="space-y-4 mb-6">
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
              placeholder="Imię"
              value={newEmployee.first_name}
              onChange={e => setNewEmployee({...newEmployee, first_name: e.target.value})}
              className="border border-gray-300 rounded-lg px-3 py-2"
              required
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
        </form>

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
                <th className="p-3 bg-gray-50">Imię i Nazwisko</th>
                <th className="p-3 bg-gray-50">Stanowisko</th>
                <th className="p-3 bg-gray-50">Forma</th>
                <th className="p-3 bg-gray-50">Hala</th>
                <th className="p-3 text-right bg-gray-50">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees
                .filter(emp => {
                  const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                  const nameMatch = !employeeFilter.name || fullName.includes(employeeFilter.name.toLowerCase());
                  const positionMatch = !employeeFilter.position || emp.position.toLowerCase().includes(employeeFilter.position.toLowerCase());
                  const hallMatch = !employeeFilter.hall_id || emp.hall_id === parseInt(employeeFilter.hall_id);
                  const formaMatch = !employeeFilter.employment_type || (emp.employment_type || 'Etat') === employeeFilter.employment_type;
                  return nameMatch && positionMatch && hallMatch && formaMatch;
                })
                .map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="p-3 text-gray-500 font-mono text-xs">{emp.employee_number || '-'}</td>
                  <td className="p-3 font-medium">{emp.first_name} {emp.last_name}</td>
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
                    {confirmingEmployeeId === emp.id ? (
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
                    )}
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
          <button
            onClick={handleCreateBackup}
            disabled={backupLoading}
            className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${backupLoading ? 'animate-spin' : ''}`} />
            {backupLoading ? 'Tworzenie...' : 'Utwórz Backup'}
          </button>
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
    </div>
  );
}
