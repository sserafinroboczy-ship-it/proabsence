import React, { useState, useEffect } from "react";
import { fetchApi } from "../lib/api";
import * as XLSX from "xlsx";
import { Database, RefreshCw } from "lucide-react";

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
  const [employeeFilter, setEmployeeFilter] = useState({ name: "", position: "", hall_id: "" });
  
  // Forms
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "foreman", hall_id: "" });
  const [newHall, setNewHall] = useState({ name: "", is_active: true });
  const [newEmployee, setNewEmployee] = useState({ first_name: "", last_name: "", position: "", hall_id: "" });

  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    fetchApi("/api/users").then(setUsers);
    fetchApi("/api/halls").then(setHalls);
    fetchApi("/api/employees").then(setEmployees);
    fetchApi("/api/logs").then(setLogs);
    fetchApi("/api/backups").then(setBackups);
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
  
  // Wyświetlaj tylko 15 ostatnich logów
  const displayedLogs = logs.slice(0, 15);

  useEffect(() => {
    loadData();
  }, []);

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
      setNewUser({ username: "", password: "", role: "foreman", hall_id: "" });
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
      setNewEmployee({ first_name: "", last_name: "", position: "", hall_id: "" });
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
    
    const data = logs.map(log => {
      const date = new Date(log.timestamp);
      return {
        "Data": date.toLocaleDateString("pl-PL"),
        "Godzina": date.toLocaleTimeString("pl-PL"),
        "Użytkownik": log.username || "",
        "Akcja": log.action || "",
        "Szczegóły": log.details || ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Ustawienie szerokości kolumn
    ws['!cols'] = [
      { wch: 12 },  // Data
      { wch: 10 },  // Godzina
      { wch: 15 },  // Użytkownik
      { wch: 25 },  // Akcja
      { wch: 50 }   // Szczegóły
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logi_Systemowe");
    XLSX.writeFile(wb, `Logi_Systemowe_${new Date().toISOString().split('T')[0]}.xlsx`);
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

      {/* Zarządzanie Pracownikami */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">Baza Pracowników</h3>
        <form onSubmit={handleCreateEmployee} className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          {(employeeFilter.name || employeeFilter.position || employeeFilter.hall_id) && (
            <button
              type="button"
              onClick={() => setEmployeeFilter({ name: "", position: "", hall_id: "" })}
              className="text-sm text-gray-500 hover:text-red-600 flex items-center justify-center gap-1"
            >
              ✕ Wyczyść filtry
            </button>
          )}
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-3">Imię i Nazwisko</th>
                <th className="p-3">Stanowisko</th>
                <th className="p-3">Hala</th>
                <th className="p-3 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees
                .filter(emp => {
                  const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                  const nameMatch = !employeeFilter.name || fullName.includes(employeeFilter.name.toLowerCase());
                  const positionMatch = !employeeFilter.position || emp.position.toLowerCase().includes(employeeFilter.position.toLowerCase());
                  const hallMatch = !employeeFilter.hall_id || emp.hall_id === parseInt(employeeFilter.hall_id);
                  return nameMatch && positionMatch && hallMatch;
                })
                .map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium">{emp.first_name} {emp.last_name}</td>
                  <td className="p-3 text-gray-600">{emp.position}</td>
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
                        className="text-sm text-red-600 hover:text-red-800 cursor-pointer relative z-20"
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
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Logi Systemowe (Archiwum)</h3>
          <button
            onClick={exportLogsToExcel}
            className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
            title="Eksportuj wszystkie logi do Excela"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Eksport
          </button>
        </div>
        <div className="overflow-x-auto">
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
              {displayedLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-3 whitespace-nowrap">{new Date(log.timestamp).toLocaleString("pl-PL")}</td>
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
