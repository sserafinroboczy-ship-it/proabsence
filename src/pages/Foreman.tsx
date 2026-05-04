import React, { useState, useEffect, useRef } from "react";
import { fetchApi } from "../lib/api";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import * as XLSX from "xlsx";
import { Plus, Trash2, UserPlus, X } from "lucide-react";

const isHoliday = (date: Date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const fixedHolidays = [
    "1-1", "1-6", "5-1", "5-3", "8-15", "11-1", "11-11", "12-25", "12-26"
  ];
  // Note: Easter and Corpus Christi are movable, but this covers fixed ones.
  return fixedHolidays.includes(`${month}-${day}`);
};

const isFreeDay = (date: Date) => isWeekend(date) || isHoliday(date);

export default function Foreman({ user }: { user: any }) {
  const [halls, setHalls] = useState<any[]>([]);
  const [activeHallId, setActiveHallId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [error, setError] = useState<string | null>(null);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [newEmployee, setNewEmployee] = useState({ first_name: "", last_name: "", position: "" });
  const [scrollPositions, setScrollPositions] = useState<Record<number, number>>({});
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchApi("/api/halls").then(data => {
      const availableHalls = (user.role === "admin" || user.role === "mistrz") && !user.hall_id
        ? data.filter((h: any) => h.is_active)
        : data.filter((h: any) => h.id === user.hall_id && h.is_active);

      setHalls(availableHalls);
      if (availableHalls.length > 0) {
        setActiveHallId(availableHalls[0].id);
      }
    }).catch(err => setError("Nie udało się pobrać listy hal."));
  }, [user]);

  const loadAbsences = async () => {
    if (activeHallId) {
      const start = format(startOfMonth(new Date(selectedMonth)), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(selectedMonth)), "yyyy-MM-dd");
      const data = await fetchApi(`/api/absences?start_date=${start}&end_date=${end}&hall_id=${activeHallId}`);
      setAbsences(data);
    }
  };

  useEffect(() => {
    if (activeHallId) {
      fetchApi(`/api/employees?hall_id=${activeHallId}`).then(setEmployees);
      loadAbsences();
      // Przywróć pozycję scrolla dla tej hali
      setTimeout(() => {
        if (tableScrollRef.current && scrollPositions[activeHallId] !== undefined) {
          tableScrollRef.current.scrollLeft = scrollPositions[activeHallId];
        }
      }, 50);
    } else {
      setEmployees([]);
      setAbsences([]);
    }
  }, [activeHallId, selectedMonth]);

  // Zapisz pozycję scrolla przed zmianą hali
  const handleHallChange = (hallId: number) => {
    if (activeHallId && tableScrollRef.current) {
      setScrollPositions(prev => ({
        ...prev,
        [activeHallId]: tableScrollRef.current!.scrollLeft
      }));
    }
    setActiveHallId(hallId);
  };

  const handleCellChange = async (employeeId: number, dateStr: string, value: string) => {
    setError(null);
    const val = value.trim().toLowerCase();
    let type = "present";
    let wh = 0;
    let ot = 0;

    if (val === "uw") {
      type = "vacation";
    } else if (val === "ch" || val === "l4") {
      type = "sick";
    } else if (val === "nż" || val === "nz") {
      type = "unplanned";
    } else if (val === "bl") {
      type = "unpaid";
    } else if (val === "op") {
      type = "care";
    } else if (val === "kr" || val === "krew") {
      type = "blood";
    } else if (val === "") {
      // If empty, we can just set it to present 0 hours, effectively clearing it
      type = "present";
      wh = 0;
      ot = 0;
    } else {
      // Try to parse as number
      const num = parseFloat(val.replace(",", "."));
      if (!isNaN(num)) {
        type = "present";
        const dateObj = new Date(dateStr);
        if (isFreeDay(dateObj)) {
          // On weekends/holidays, all hours are overtime
          wh = 0;
          ot = num;
        } else {
          // Regular day
          wh = Math.min(8, num);
          ot = Math.max(0, num - 8);
        }
      } else {
        // Invalid input, ignore or set to present 8
        type = "present";
        wh = 8;
      }
    }

    try {
      // Optimistic update
      const newAbsences = [...absences];
      const existingIndex = newAbsences.findIndex(a => a.employee_id === employeeId && a.date === dateStr);
      const newRecord = { employee_id: employeeId, date: dateStr, type, working_hours: wh, overtime_hours: ot };
      
      if (existingIndex >= 0) {
        newAbsences[existingIndex] = { ...newAbsences[existingIndex], ...newRecord };
      } else {
        newAbsences.push(newRecord);
      }
      setAbsences(newAbsences);

      await fetchApi("/api/absences", {
        method: "POST",
        body: JSON.stringify(newRecord)
      });
    } catch (err: any) {
      setError(err.message || "Błąd zapisu danych");
      loadAbsences(); // Revert on error
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHallId) return;
    if (!newEmployee.first_name || !newEmployee.last_name) {
      setError("Imię i nazwisko są wymagane.");
      return;
    }

    try {
      await fetchApi("/api/employees", {
        method: "POST",
        body: JSON.stringify({ ...newEmployee, hall_id: activeHallId })
      });
      setIsAddingEmployee(false);
      setNewEmployee({ first_name: "", last_name: "", position: "" });
      fetchApi(`/api/employees?hall_id=${activeHallId}`).then(setEmployees);
    } catch (err: any) {
      setError(err.message || "Błąd dodawania pracownika");
    }
  };

  const handleDeleteEmployee = async (empId: number) => {
    try {
      await fetchApi(`/api/employees/${empId}`, { method: "DELETE" });
      setEmployees(employees.filter(e => e.id !== empId));
      setConfirmingDeleteId(null);
    } catch (err: any) {
      setError(err.message || "Błąd usuwania pracownika");
    }
  };

  if (user.role === "guest") return <div className="p-8 text-gray-500">Brak dostępu</div>;

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(new Date(selectedMonth)),
    end: endOfMonth(new Date(selectedMonth))
  });

  // Calculate summary for the whole month
  let totalVacation = 0;
  let totalSick = 0;
  let totalUnplanned = 0;
  let totalCare = 0;
  let totalBlood = 0;
  let totalPresentDays = 0;
  let hallTotalHoursRaw = 0;    // Suma godzin bez odejmowania przerw
  let hallTotalHours = 0;       // Suma godzin z odjętymi przerwami (-0.5h/dzień)
  let hallTotalOvertime = 0;
  
  // Liczymy tylko dni robocze (pon-pt, bez świąt) do frekwencji
  const workingDaysCount = daysInMonth.filter(d => !isFreeDay(d)).length;
  let totalExpectedDays = employees.length * workingDaysCount;

  absences.forEach(a => {
    if (a.type === "vacation") totalVacation++;
    else if (a.type === "sick") totalSick++;
    else if (a.type === "unplanned") totalUnplanned++;
    else if (a.type === "care") totalCare++;
    else if (a.type === "blood") totalBlood++;
    else if (a.type === "present") {
      // Sumuj godziny pracy
      const workingHours = a.working_hours || 0;
      if (workingHours > 0) {
        hallTotalHoursRaw += workingHours;                    // Suma surowa
        hallTotalHours += Math.max(0, workingHours - 0.5);    // Odejmij 30 min przerwy
      }
      hallTotalOvertime += (a.overtime_hours || 0);
      
      // Liczymy tylko obecności w dni robocze do frekwencji
      if ((a.working_hours > 0 || a.overtime_hours > 0)) {
        const date = new Date(a.date);
        if (!isFreeDay(date)) {
          totalPresentDays++;
        }
      }
    }
  });

  // Frekwencja liczona tylko dla dni roboczych (pon-pt, bez świąt)
  const frequency = totalExpectedDays > 0 ? Math.round((totalPresentDays / totalExpectedDays) * 100) : 0;

  const getCellValue = (empId: number, dateStr: string) => {
    const absence = absences.find(a => a.employee_id === empId && a.date === dateStr);
    if (!absence) return "";
    if (absence.type === "vacation") return "uw";
    if (absence.type === "sick") return "ch";
    if (absence.type === "unplanned") return "nż";
    if (absence.type === "unpaid") return "bl";
    if (absence.type === "care") return "op";
    if (absence.type === "blood") return "kr";
    if (absence.type === "present") {
      const total = (absence.working_hours || 0) + (absence.overtime_hours || 0);
      return total > 0 ? total.toString() : "";
    }
    return "";
  };

  const getCellColor = (val: string) => {
    if (val === "uw") return "bg-blue-100 text-blue-800";
    if (val === "ch") return "bg-red-100 text-red-800";
    if (val === "nż" || val === "nz") return "bg-orange-100 text-orange-800";
    if (val === "bl") return "bg-gray-200 text-gray-800";
    if (val === "op") return "bg-teal-100 text-teal-800";
    if (val === "kr" || val === "krew") return "bg-rose-100 text-rose-800";
    if (val !== "") return "bg-green-50 text-green-800 font-medium";
    return "bg-white";
  };

  const exportToExcel = () => {
    if (!activeHallId || employees.length === 0) return;
    
    const hallName = halls.find(h => h.id === activeHallId)?.name || "Hala";
    const monthName = format(new Date(selectedMonth), "yyyy-MM");
    
    const data = employees.map(emp => {
      const row: any = {
        "Pracownik": `${emp.first_name} ${emp.last_name}`,
        "Stanowisko": emp.position
      };
      
      let totalHours = 0;
      let totalOvertime = 0;
      let sumUW = 0, sumCH = 0, sumNZ = 0, sumOP = 0, sumKR = 0, sumBL = 0;

      daysInMonth.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const val = getCellValue(emp.id, dateStr);
        row[format(day, "dd.MM")] = val;
        
        const absence = absences.find(a => a.employee_id === emp.id && a.date === dateStr);
        if (absence) {
          if (absence.type === "present") {
            totalHours += (absence.working_hours || 0);
            totalOvertime += (absence.overtime_hours || 0);
          } else if (absence.type === "vacation") sumUW++;
          else if (absence.type === "sick") sumCH++;
          else if (absence.type === "unplanned") sumNZ++;
          else if (absence.type === "care") sumOP++;
          else if (absence.type === "blood") sumKR++;
          else if (absence.type === "unpaid") sumBL++;
        }
      });
      
      row["Suma Godz"] = totalHours;
      row["Suma Nadg"] = totalOvertime;
      row["UW"] = sumUW;
      row["CH"] = sumCH;
      row["NŻ"] = sumNZ;
      row["OP"] = sumOP;
      row["KR"] = sumKR;
      row["BL"] = sumBL;
      
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Obecności");
    XLSX.writeFile(wb, `Obecnosci_${hallName}_${monthName}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Zakładki Hal */}
      {halls.length > 0 && (
        <div className="flex space-x-1 border-b border-gray-200">
          {halls.map(hall => (
            <button
              key={hall.id}
              onClick={() => handleHallChange(hall.id)}
              className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeHallId === hall.id
                  ? "border-blue-600 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {hall.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary Bar */}
      {activeHallId && (
        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 bg-blue-50 text-blue-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">Suma UW:</span>
            <span className="font-bold">{totalVacation}</span>
          </div>
          <div className="flex items-center gap-2 bg-red-50 text-red-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">Suma CH:</span>
            <span className="font-bold">{totalSick}</span>
          </div>
          <div className="flex items-center gap-2 bg-orange-50 text-orange-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">Nieplanowane:</span>
            <span className="font-bold">{totalUnplanned}</span>
          </div>
          <div className="flex items-center gap-2 bg-teal-50 text-teal-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">Opieka:</span>
            <span className="font-bold">{totalCare}</span>
          </div>
          <div className="flex items-center gap-2 bg-rose-50 text-rose-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">Krew:</span>
            <span className="font-bold">{totalBlood}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 text-slate-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">Godziny:</span>
            <span className="font-bold">{hallTotalHoursRaw}h</span>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">Godziny (-0.5h/dzień):</span>
            <span className="font-bold">{hallTotalHours}h</span>
          </div>
          <div className="flex items-center gap-2 bg-purple-50 text-purple-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">Nadgodziny:</span>
            <span className="font-bold">{hallTotalOvertime}h</span>
          </div>
          <div className="flex items-center gap-2 bg-green-50 text-green-800 px-4 py-2 rounded-lg ml-auto">
            <span className="text-sm font-medium">Śr. frekwencja:</span>
            <span className="font-bold">{frequency}%</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Karta Obecności</h3>
            <p className="text-sm text-gray-500">Wpisz godziny (np. 8, 10) lub status</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsAddingEmployee(true)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Dodaj pracownika
            </button>
            <div className="w-px h-6 bg-gray-200 hidden md:block"></div>
            <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
                title="Eksportuj do Excela"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Eksport
              </button>
              <div className="w-px h-6 bg-gray-200"></div>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border-none bg-transparent text-gray-700 font-medium focus:ring-0 outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-amber-50 border-b border-amber-100">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200"></span> UW - Urlop</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-200"></span> CH/L4 - Chorobowe</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-200"></span> NŻ - Nieplanowane</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-200"></span> OP - Opieka</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-100 border border-rose-200"></span> KR - Krew</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 border border-gray-300"></span> BL - Bezpłatny</span>
          </div>
        </div>

        <div ref={tableScrollRef} className="overflow-x-auto overflow-y-hidden">
          <table className="w-full text-left text-sm attendance-table">
            <thead>
              <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                <th className="p-2 font-semibold min-w-[150px] w-[150px] sticky-col-1-header">Pracownik</th>
                <th className="p-2 font-semibold min-w-[100px] w-[100px] sticky-col-2-header">Stanowisko</th>
                <th className="p-2 font-semibold text-center min-w-[50px] w-[50px] sticky-col-3-header">Akcja</th>
                {daysInMonth.map(day => {
                  const isWknd = isFreeDay(day);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <th key={day.toISOString()} className={`p-1 text-center border-r min-w-[40px] ${
                      isWknd 
                        ? 'bg-red-200 text-red-700 border-red-300' 
                        : 'bg-blue-100 text-blue-800 border-blue-200'
                    } ${isToday ? 'ring-2 ring-yellow-400 ring-inset bg-yellow-100 !text-yellow-800' : ''}`}>
                      <div className="text-xs font-medium">{format(day, "EE", { locale: pl }).substring(0, 2)}</div>
                      <div className="font-bold">{format(day, "dd")}</div>
                    </th>
                  );
                })}
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-blue-50">Suma Godz</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-purple-50">Suma Nadg</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-blue-100 text-blue-800" title="Urlop Wypoczynkowy">UW</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-red-100 text-red-800" title="Chorobowe">CH</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-orange-100 text-orange-800" title="Nieplanowane">NŻ</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-teal-100 text-teal-800" title="Opieka">OP</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-rose-100 text-rose-800" title="Krew">KR</th>
                <th className="p-2 font-semibold text-center bg-gray-200 text-gray-800" title="Bezpłatny">BL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.map(emp => {
                const empAbsences = absences.filter(a => a.employee_id === emp.id);
                const totalHours = empAbsences.reduce((sum, a) => sum + (a.type === "present" ? (a.working_hours || 0) : 0), 0);
                const totalOvertime = empAbsences.reduce((sum, a) => sum + (a.type === "present" ? (a.overtime_hours || 0) : 0), 0);
                
                const sumUW = empAbsences.filter(a => a.type === "vacation").length;
                const sumCH = empAbsences.filter(a => a.type === "sick").length;
                const sumNZ = empAbsences.filter(a => a.type === "unplanned").length;
                const sumOP = empAbsences.filter(a => a.type === "care").length;
                const sumKR = empAbsences.filter(a => a.type === "blood").length;
                const sumBL = empAbsences.filter(a => a.type === "unpaid").length;

                return (
                  <tr key={emp.id} className="group hover:bg-gray-50 transition-colors">
                    <td className="p-2 font-medium text-gray-800 min-w-[150px] w-[150px] sticky-col-1 group-hover:!bg-gray-50">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td className="p-2 text-gray-500 text-xs truncate min-w-[100px] w-[100px] sticky-col-2 group-hover:!bg-gray-50" title={emp.position}>
                      {emp.position}
                    </td>
                    <td className="p-1 text-center min-w-[50px] w-[50px] sticky-col-3 group-hover:!bg-gray-50">
                      {confirmingDeleteId === emp.id ? (
                        <div className="flex flex-col items-center gap-1 p-0.5">
                          <button 
                            type="button"
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded hover:bg-red-700 font-bold"
                          >
                            TAK
                          </button>
                          <button 
                            type="button"
                            onClick={() => setConfirmingDeleteId(null)}
                            className="text-gray-400 hover:text-gray-600 text-[10px]"
                          >
                            NIE
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => setConfirmingDeleteId(emp.id)}
                          className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                          title="Usuń pracownika"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                    {daysInMonth.map(day => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const val = getCellValue(emp.id, dateStr);
                      const isWknd = isFreeDay(day);
                      const isToday = isSameDay(day, new Date());
                      const colorClass = getCellColor(val);

                      return (
                        <td key={dateStr} className={`p-0 border-r relative ${isWknd ? 'bg-red-50 border-red-200' : 'border-gray-200'} ${isToday && !val ? 'bg-yellow-50' : ''}`}>
                          <input
                            key={val}
                            type="text"
                            data-row={emp.id}
                            data-col={dateStr}
                            defaultValue={val}
                            onBlur={(e) => {
                              if (e.target.value !== val) {
                                handleCellChange(emp.id, dateStr, e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              const currentInput = e.currentTarget;
                              const table = currentInput.closest('table');
                              if (!table) return;
                              
                              const allInputs = Array.from(table.querySelectorAll('input[data-row][data-col]')) as HTMLInputElement[];
                              const currentIndex = allInputs.indexOf(currentInput);
                              const numCols = daysInMonth.length;
                              
                              let nextInput: HTMLInputElement | null = null;
                              
                              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                e.preventDefault();
                                // Zapisz wartość i przejdź w dół
                                if (currentInput.value !== val) {
                                  handleCellChange(emp.id, dateStr, currentInput.value);
                                }
                                nextInput = allInputs[currentIndex + numCols] || null;
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                nextInput = allInputs[currentIndex - numCols] || null;
                              } else if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                nextInput = allInputs[currentIndex + 1] || null;
                              } else if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                nextInput = allInputs[currentIndex - 1] || null;
                              } else if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault();
                                if (currentInput.value !== val) {
                                  handleCellChange(emp.id, dateStr, currentInput.value);
                                }
                                nextInput = allInputs[currentIndex + 1] || null;
                              } else if (e.key === 'Tab' && e.shiftKey) {
                                e.preventDefault();
                                nextInput = allInputs[currentIndex - 1] || null;
                              }
                              
                              if (nextInput) {
                                nextInput.focus();
                                nextInput.select();
                              }
                            }}
                            className={`w-full h-full min-h-[36px] text-center text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${colorClass} ${isWknd && !val ? 'bg-red-50' : ''} ${isToday && !val ? 'bg-yellow-50' : ''}`}
                          />
                        </td>
                      );
                    })}
                    <td className="p-2 text-center font-bold text-blue-700 border-r border-gray-200 bg-blue-50/50">
                      {totalHours > 0 ? totalHours : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-purple-700 border-r border-gray-200 bg-purple-50/50">
                      {totalOvertime > 0 ? totalOvertime : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-blue-800 border-r border-gray-200 bg-blue-50/50">
                      {sumUW > 0 ? sumUW : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-red-800 border-r border-gray-200 bg-red-50/50">
                      {sumCH > 0 ? sumCH : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-orange-800 border-r border-gray-200 bg-orange-50/50">
                      {sumNZ > 0 ? sumNZ : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-teal-800 border-r border-gray-200 bg-teal-50/50">
                      {sumOP > 0 ? sumOP : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-rose-800 border-r border-gray-200 bg-rose-50/50">
                      {sumKR > 0 ? sumKR : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-gray-800 bg-gray-100/50">
                      {sumBL > 0 ? sumBL : ""}
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={daysInMonth.length + 10} className="p-12 text-center text-gray-500">
                    {activeHallId ? "Brak pracowników przypisanych do tej hali." : "Wybierz halę, aby zobaczyć pracowników."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      {activeHallId && employees.length > 0 && (() => {
        const chartData = daysInMonth.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayAbsences = absences.filter(a => a.date === dateStr);
          
          let present = 0;
          let vacation = 0;
          let sick = 0;
          let unplanned = 0;
          let care = 0;
          let blood = 0;
          let unpaid = 0;
          let totalHours = 0;

          employees.forEach(emp => {
            const record = dayAbsences.find(a => a.employee_id === emp.id);
            if (!record) return;
            
            const type = record.type;
            if (type === "present" && (record.working_hours > 0 || record.overtime_hours > 0)) {
              present++;
              // Rzeczywiste godziny pracy (working_hours + overtime_hours) minus 0.5h przerwy
              const totalWorked = (record.working_hours || 0) + (record.overtime_hours || 0);
              totalHours += Math.max(0, totalWorked - 0.5);
            }
            else if (type === "vacation") vacation++;
            else if (type === "sick") sick++;
            else if (type === "unplanned") unplanned++;
            else if (type === "care") care++;
            else if (type === "blood") blood++;
            else if (type === "unpaid") unpaid++;
          });

          return {
            date: format(day, "dd.MM"),
            Obecni: present,
            Godziny: totalHours,
            Urlop: vacation,
            Chorobowe: sick,
            Nieplanowane: unplanned,
            Opieka: care,
            Krew: blood,
            Bezpłatny: unpaid
          };
        });

        // Oblicz dynamiczną wysokość wykresu na podstawie maksymalnej wartości i liczby pracowników
        const maxValue = Math.max(...chartData.map(d => 
          (d.Obecni || 0) + (d.Urlop || 0) + (d.Chorobowe || 0) + (d.Nieplanowane || 0) + (d.Opieka || 0) + (d.Krew || 0) + (d.Bezpłatny || 0)
        ), 1);
        // Wysokość: minimum 250px, maksimum 450px, skalowana do danych
        const chartHeight = Math.max(250, Math.min(450, maxValue * 50 + 150));

        return (
          <div className="space-y-6 mt-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <h3 className="text-lg font-semibold text-gray-800 mb-6 font-sans">Stan Osobowy - {format(new Date(selectedMonth), "MMMM yyyy", { locale: pl })}</h3>
              <div className="overflow-x-auto overflow-y-hidden" style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ minWidth: '1000px', height: `${chartHeight}px`, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      interval={0} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fontWeight: 'bold', fill: '#475569' }} 
                      angle={-45} 
                      textAnchor="end" 
                      height={80} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                    <Tooltip 
                      wrapperStyle={{ zIndex: 99999, pointerEvents: 'none' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                      position={{ y: 50 }}
                      offset={15}
                      content={({ active, payload, label }) => {
                        const getPlural = (n: number) => {
                          if (n === 1) return 'osoba';
                          const lastDigit = n % 10;
                          const lastTwoDigits = n % 100;
                          if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'osoby';
                          return 'osób';
                        };
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const totalEmployees = employees.length;
                          const presentCount = data.Obecni || 0;
                          const dailyFrequency = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;
                          
                          return (
                            <div className="bg-white p-3 border border-gray-200 shadow-2xl rounded-xl" style={{ zIndex: 9999 }}>
                              <p className="text-sm font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1">Dzień: {label}</p>
                              <div className="space-y-1">
                                {payload.map((entry: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                      <span className="font-medium text-gray-600">{entry.name}:</span>
                                    </div>
                                    <span className="font-bold text-gray-900">{entry.value} {getPlural(entry.value as number)}</span>
                                  </div>
                                ))}
                              </div>
                              {/* Frekwencja dzienna */}
                              <div className="mt-3 pt-2 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-600">Frekwencja dzienna:</span>
                                  <span className={`text-sm font-black ${dailyFrequency >= 80 ? 'text-green-600' : dailyFrequency >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {dailyFrequency}%
                                  </span>
                                </div>
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  ({presentCount} z {totalEmployees} pracowników)
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar dataKey="Obecni" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]}>
                      <LabelList dataKey="Obecni" position="center" fill="#fff" fontSize={11} formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Urlop" stackId="a" fill="#3b82f6">
                      <LabelList dataKey="Urlop" position="center" fill="#fff" fontSize={11} formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Chorobowe" stackId="a" fill="#ef4444">
                      <LabelList dataKey="Chorobowe" position="center" fill="#fff" fontSize={11} formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Nieplanowane" stackId="a" fill="#f97316">
                      <LabelList dataKey="Nieplanowane" position="center" fill="#fff" fontSize={11} formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Opieka" stackId="a" fill="#14b8a6">
                      <LabelList dataKey="Opieka" position="center" fill="#fff" fontSize={11} formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Krew" stackId="a" fill="#f43f5e">
                      <LabelList dataKey="Krew" position="center" fill="#fff" fontSize={11} formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Bezpłatny" stackId="a" fill="#9ca3af" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="Bezpłatny" position="center" fill="#fff" fontSize={11} formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <h3 className="text-lg font-semibold text-gray-800 mb-6 font-sans">Suma Godzin Pracy (godziny - 0.5h przerwy)</h3>
              <div className="overflow-x-auto overflow-y-hidden">
                <div style={{ minWidth: '1000px', height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 30, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      interval={0} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fontWeight: 'bold', fill: '#475569' }} 
                      angle={-45} 
                      textAnchor="end" 
                      height={80} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} dx={-10} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.3)]} />
                    <Tooltip 
                      cursor={{ fill: '#f9fafb' }}
                      content={({ active, payload, label }) => {
                        const getPlural = (n: number) => {
                          if (n === 1) return 'osoba';
                          const lastDigit = n % 10;
                          const lastTwoDigits = n % 100;
                          if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'osoby';
                          return 'osób';
                        };
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 shadow-md rounded-lg">
                              <p className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">Data: {label}</p>
                              <p className="text-sm text-sky-600 font-sans font-medium">Suma Godzin: <span className="font-bold underline">{data.Godziny}h</span></p>
                              <p className="text-sm text-emerald-600 font-sans font-medium">Pracownicy: <span className="font-bold underline">{data.Obecni} {getPlural(data.Obecni)}</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 10 }} />
                    <Bar dataKey="Godziny" fill="#0ea5e9" name="Suma Godzin (h)" radius={[6, 6, 0, 0]} barSize={28}>
                      <LabelList dataKey="Godziny" position="top" fill="#0ea5e9" fontSize={13} fontWeight="bold" formatter={(val: any) => val > 0 ? `${val}h` : ''} />
                      <LabelList 
                        dataKey="Obecni" 
                        position="center" 
                        fill="#fff" 
                        fontSize={12} 
                        fontWeight="bold"
                        formatter={(val: any) => val > 0 ? val : ''}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      );
      })()}

      {/* Modal Dodawania Pracownika */}
      {isAddingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">Dodaj Pracownika</h3>
              <button 
                onClick={() => setIsAddingEmployee(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imię</label>
                <input
                  type="text"
                  required
                  value={newEmployee.first_name}
                  onChange={e => setNewEmployee({...newEmployee, first_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="np. Jan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nazwisko</label>
                <input
                  type="text"
                  required
                  value={newEmployee.last_name}
                  onChange={e => setNewEmployee({...newEmployee, last_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="np. Kowalski"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stanowisko</label>
                <input
                  type="text"
                  value={newEmployee.position}
                  onChange={e => setNewEmployee({...newEmployee, position: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="np. Monter"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingEmployee(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Dodaj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
