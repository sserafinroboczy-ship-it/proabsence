import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchApi } from "../lib/api";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import * as XLSX from "xlsx";
import { Plus, Trash2, UserPlus, X, ArrowLeftRight, ArrowRightLeft, Pencil, Check } from "lucide-react";

// Algorytm obliczania daty Wielkanocy (Meeus/Jones/Butcher)
const getEasterDate = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

// Pobierz wszystkie święta ruchome dla danego roku
const getMovableHolidays = (year: number): Date[] => {
  const easter = getEasterDate(year);
  const holidays: Date[] = [];
  
  // Wielkanoc (niedziela)
  holidays.push(new Date(easter));
  
  // Poniedziałek Wielkanocny (Easter + 1)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays.push(easterMonday);
  
  // Zielone Świątki / Zesłanie Ducha Świętego (Easter + 49)
  const pentecost = new Date(easter);
  pentecost.setDate(easter.getDate() + 49);
  holidays.push(pentecost);
  
  // Boże Ciało (Easter + 60)
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  holidays.push(corpusChristi);
  
  return holidays;
};

const isHoliday = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Święta stałe w Polsce
  const fixedHolidays = [
    "1-1",   // Nowy Rok
    "1-6",   // Trzech Króli
    "5-1",   // Święto Pracy
    "5-3",   // Święto Konstytucji 3 Maja
    "8-15",  // Wniebowzięcie NMP
    "11-1",  // Wszystkich Świętych
    "11-11", // Święto Niepodległości
    "12-25", // Boże Narodzenie
    "12-26"  // Drugi dzień Bożego Narodzenia
  ];
  
  if (fixedHolidays.includes(`${month}-${day}`)) {
    return true;
  }
  
  // Święta ruchome
  const movableHolidays = getMovableHolidays(year);
  return movableHolidays.some(holiday => 
    holiday.getFullYear() === year &&
    holiday.getMonth() === date.getMonth() &&
    holiday.getDate() === day
  );
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
  const [newEmployee, setNewEmployee] = useState({ first_name: "", last_name: "", position: "", employee_number: "", employment_type: "Etat", qualifications: "" });
  const [transferringEmployeeId, setTransferringEmployeeId] = useState<number | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [allHalls, setAllHalls] = useState<any[]>([]);
  const [scrollPositions, setScrollPositions] = useState<Record<number, number>>({});
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const tableCardRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  const [showFixedScrollbar, setShowFixedScrollbar] = useState(false);
  const [settings, setSettings] = useState<{hours_limit_agencja: number, hours_limit_dg: number}>({
    hours_limit_agencja: 200,
    hours_limit_dg: 200
  });
  const [activeHall, setActiveHall] = useState<any>(null);
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<number | null>(null);
  const [dragOverEmployeeId, setDragOverEmployeeId] = useState<number | null>(null);
  const [qualificationsList, setQualificationsList] = useState<any[]>([]);
  const [dayComments, setDayComments] = useState<Record<string, string>>({}); // key: "empId_date"
  const [commentModal, setCommentModal] = useState<{ empId: number; date: string; empName: string; hours: number } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  useEffect(() => {
    fetchApi("/api/qualifications").then(setQualificationsList).catch(() => {});
  }, []);

  useEffect(() => {
    fetchApi("/api/halls").then(data => {
      // Zapisz wszystkie aktywne hale (do przenoszenia pracowników)
      setAllHalls(data.filter((h: any) => h.is_active));
      
      // API zwraca już przefiltrowane hale (user_halls) — pokazujemy wszystkie aktywne z odpowiedzi
      const availableHalls = data.filter((h: any) => h.is_active);

      setHalls(availableHalls);
      if (availableHalls.length > 0) {
        setActiveHallId(availableHalls[0].id);
        setActiveHall(availableHalls[0]);
      }
    }).catch(err => setError("Nie udało się pobrać listy hal."));
  }, [user]);

  // Aktualizuj activeHall gdy zmienia się activeHallId
  useEffect(() => {
    if (activeHallId && halls.length > 0) {
      const hall = halls.find(h => h.id === activeHallId);
      setActiveHall(hall || null);
    }
  }, [activeHallId, halls]);

  const loadAbsences = async () => {
    if (activeHallId) {
      const start = format(startOfMonth(new Date(selectedMonth)), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(selectedMonth)), "yyyy-MM-dd");
      const data = await fetchApi(`/api/absences?start_date=${start}&end_date=${end}&hall_id=${activeHallId}`);
      setAbsences(data);
    }
  };

  const loadDayComments = async () => {
    if (activeHallId) {
      try {
        const data = await fetchApi(`/api/day-comments?hall_id=${activeHallId}&month=${selectedMonth}`);
        const map: Record<string, string> = {};
        data.forEach((c: any) => { map[`${c.employee_id}_${c.date}`] = c.comment; });
        setDayComments(map);
      } catch {}
    }
  };

  // Pobierz ustawienia limitów godzin
  const loadSettings = () => {
    fetchApi("/api/settings").then(data => {
      setSettings({
        hours_limit_agencja: parseInt(data.hours_limit_agencja) || 200,
        hours_limit_dg: parseInt(data.hours_limit_dg) || 200
      });
    });
  };

  useEffect(() => {
    loadSettings();
    // Odświeżaj ustawienia gdy okno uzyska focus (powrót z panelu admina)
    const handleFocus = () => loadSettings();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

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
      setDayComments({});
    }
  }, [activeHallId, selectedMonth]);

  useEffect(() => {
    loadDayComments();
  }, [activeHallId, selectedMonth]);

  // Synchronizacja scrollowania między tabelą a sticky scrollbar
  useEffect(() => {
    const tableScroll = tableScrollRef.current;
    const scrollbar = scrollbarRef.current;
    
    if (!tableScroll) return;
    
    // Ustaw szerokość scrollbar
    const updateWidth = () => {
      if (tableScroll.scrollWidth > 0) {
        setTableWidth(tableScroll.scrollWidth);
      }
    };
    updateWidth();
    
    // Obserwuj zmiany rozmiaru
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(tableScroll);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [employees, selectedMonth]);

  // Osobny useEffect dla synchronizacji scroll - uruchamia się gdy scrollbar jest widoczny
  useEffect(() => {
    const tableScroll = tableScrollRef.current;
    const scrollbar = scrollbarRef.current;
    
    if (!tableScroll || !scrollbar || !showFixedScrollbar) return;
    
    let isScrollingTable = false;
    let isScrollingScrollbar = false;
    
    const handleTableScroll = () => {
      if (isScrollingScrollbar) return;
      isScrollingTable = true;
      scrollbar.scrollLeft = tableScroll.scrollLeft;
      setTimeout(() => { isScrollingTable = false; }, 50);
    };
    
    const handleScrollbarScroll = () => {
      if (isScrollingTable) return;
      isScrollingScrollbar = true;
      tableScroll.scrollLeft = scrollbar.scrollLeft;
      setTimeout(() => { isScrollingScrollbar = false; }, 50);
    };
    
    tableScroll.addEventListener('scroll', handleTableScroll);
    scrollbar.addEventListener('scroll', handleScrollbarScroll);
    
    // Synchronizuj pozycję na starcie
    scrollbar.scrollLeft = tableScroll.scrollLeft;
    
    return () => {
      tableScroll.removeEventListener('scroll', handleTableScroll);
      scrollbar.removeEventListener('scroll', handleScrollbarScroll);
    };
  }, [showFixedScrollbar]);

  // Pokaż/ukryj fixed scrollbar w zależności od widoczności tabeli
  useEffect(() => {
    const tableCard = tableCardRef.current;
    const tableScroll = tableScrollRef.current;
    
    if (!tableCard || !tableScroll || employees.length === 0) {
      setShowFixedScrollbar(false);
      return;
    }
    
    // Ustaw szerokość od razu
    setTableWidth(tableScroll.scrollWidth);
    
    const checkVisibility = () => {
      const rect = tableCard.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      // Pokaż scrollbar gdy tabela jest widoczna na ekranie
      const isVisible = rect.top < windowHeight && rect.bottom > 50;
      setShowFixedScrollbar(isVisible);
      
      // Aktualizuj szerokość
      if (tableScroll.scrollWidth > 0) {
        setTableWidth(tableScroll.scrollWidth);
      }
    };
    
    // Opóźnij pierwsze sprawdzenie aby DOM się załadował
    setTimeout(checkVisibility, 100);
    
    window.addEventListener('scroll', checkVisibility);
    window.addEventListener('resize', checkVisibility);
    
    return () => {
      window.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
    };
  }, [employees, selectedMonth, activeHallId]);

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

      // Sprawdź czy pracownik przekroczył limit (tylko dla Agencja/DG)
      const employee = employees.find(e => e.id === employeeId);
      if (employee && (employee.employment_type === 'Agencja' || employee.employment_type === 'DG')) {
        const hoursLimit = employee.employment_type === 'Agencja' ? settings.hours_limit_agencja : settings.hours_limit_dg;
        
        // Oblicz sumę godzin dla tego pracownika w tym miesiącu
        const empAbsences = newAbsences.filter(a => a.employee_id === employeeId && a.type === 'present');
        const totalHours = empAbsences.reduce((sum, a) => sum + (a.working_hours || 0) + (a.overtime_hours || 0), 0);
        
        if (totalHours > hoursLimit) {
          // Wyślij powiadomienie o przekroczeniu limitu
          fetchApi("/api/check-limit-notifications", {
            method: "POST",
            body: JSON.stringify({
              employee_id: employeeId,
              month: selectedMonth,
              hours_used: totalHours,
              hours_limit: hoursLimit
            })
          }).catch(() => {}); // Ignoruj błędy - to jest w tle
        }
      }
    } catch (err: any) {
      setError(err.message || "Błąd zapisu danych");
      loadAbsences(); // Revert on error
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHallId) return;
    if (!newEmployee.first_name || !newEmployee.last_name) {
      setError("Nazwisko i imię są wymagane.");
      return;
    }

    try {
      await fetchApi("/api/employees", {
        method: "POST",
        body: JSON.stringify({ ...newEmployee, hall_id: activeHallId })
      });
      setIsAddingEmployee(false);
      setNewEmployee({ first_name: "", last_name: "", position: "", employee_number: "", employment_type: "Etat", qualifications: "" });
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

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    
    try {
      await fetchApi(`/api/employees/${editingEmployee.id}`, {
        method: "PUT",
        body: JSON.stringify({
          first_name: editingEmployee.first_name,
          last_name: editingEmployee.last_name,
          position: editingEmployee.position,
          employee_number: editingEmployee.employee_number,
          employment_type: editingEmployee.employment_type,
          hall_id: editingEmployee.hall_id,
          qualifications: editingEmployee.qualifications || ''
        })
      });
      setEditingEmployee(null);
      fetchApi(`/api/employees?hall_id=${activeHallId}`).then(setEmployees);
    } catch (err: any) {
      setError(err.message || "Błąd edycji pracownika");
    }
  };

  const handleTransferEmployee = async (empId: number, targetHallId: number) => {
    try {
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;
      
      await fetchApi(`/api/employees/${empId}`, {
        method: "PUT",
        body: JSON.stringify({
          first_name: emp.first_name,
          last_name: emp.last_name,
          position: emp.position,
          employee_number: emp.employee_number,
          employment_type: emp.employment_type,
          hall_id: targetHallId
        })
      });
      
      // Usuń pracownika z aktualnej listy (został przeniesiony)
      setEmployees(employees.filter(e => e.id !== empId));
      setTransferringEmployeeId(null);
      
      // Odśwież dane nieobecności
      loadAbsences();
    } catch (err: any) {
      setError(err.message || "Błąd przenoszenia pracownika");
    }
  };

  const handleChangeShift = async (empId: number, newShift: number) => {
    try {
      await fetchApi(`/api/employees/${empId}/shift`, {
        method: "PUT",
        body: JSON.stringify({ shift: newShift })
      });
      // Aktualizuj lokalnie
      setEmployees(employees.map(e => e.id === empId ? { ...e, shift: newShift } : e));
    } catch (err: any) {
      setError(err.message || "Błąd zmiany zmiany pracownika");
    }
  };

  const handleRotateShifts = async () => {
    if (!activeHallId) return;
    try {
      await fetchApi(`/api/halls/${activeHallId}/rotate-shifts`, { method: "POST" });
      // Odśwież listę pracowników
      fetchApi(`/api/employees?hall_id=${activeHallId}`).then(setEmployees);
    } catch (err: any) {
      setError(err.message || "Błąd rotacji zmian");
    }
  };

  // Drag & drop - zmiana kolejności pracowników
  const draggedEmpIdRef = useRef<number | null>(null);
  
  const handleDragStart = (e: React.DragEvent, empId: number) => {
    draggedEmpIdRef.current = empId;
    setDraggedEmployeeId(empId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', empId.toString());
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedEmployeeId(null);
    setDragOverEmployeeId(null);
    draggedEmpIdRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent, empId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedEmployeeId !== empId) {
      setDragOverEmployeeId(empId);
    }
  };

  const handleDragLeave = () => {
    setDragOverEmployeeId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetEmpId: number) => {
    e.preventDefault();
    
    const currentDraggedId = draggedEmpIdRef.current;
    
    if (!currentDraggedId || currentDraggedId === targetEmpId) {
      setDraggedEmployeeId(null);
      setDragOverEmployeeId(null);
      draggedEmpIdRef.current = null;
      return;
    }

    // Znajdź indeksy
    const draggedIndex = employees.findIndex(emp => emp.id === currentDraggedId);
    const targetIndex = employees.findIndex(emp => emp.id === targetEmpId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedEmployeeId(null);
      setDragOverEmployeeId(null);
      draggedEmpIdRef.current = null;
      return;
    }

    // Przenieś pracownika w nowe miejsce
    const newEmployees = [...employees];
    const [draggedEmp] = newEmployees.splice(draggedIndex, 1);
    newEmployees.splice(targetIndex, 0, draggedEmp);

    // Zaktualizuj kolejność (sort_order) dla wszystkich pracowników
    const updatedEmployees = newEmployees.map((emp, index) => ({
      ...emp,
      sort_order: index
    }));

    setEmployees(updatedEmployees);

    // Zapisz nową kolejność na serwerze
    try {
      await fetchApi('/api/employees/reorder', {
        method: 'POST',
        body: JSON.stringify({
          hall_id: activeHallId,
          order: updatedEmployees.map(emp => emp.id)
        })
      });
    } catch (err: any) {
      console.error('Błąd zapisywania kolejności:', err);
      // Przywróć poprzednią kolejność w razie błędu
      fetchApi(`/api/employees?hall_id=${activeHallId}`).then(setEmployees);
    }

    setDraggedEmployeeId(null);
    setDragOverEmployeeId(null);
    draggedEmpIdRef.current = null;
  };

  // Liczba zmian dla aktywnej hali
  const shiftCount = activeHall?.shift_count || 2;

  if (user.role === "guest") return <div className="p-8 text-gray-500">Brak dostępu</div>;

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(new Date(selectedMonth)),
    end: endOfMonth(new Date(selectedMonth))
  });

  // Calculate summary for the whole month (tylko pracownicy produkcyjni, bez nadzoru)
  let totalVacation = 0;
  let totalSick = 0;
  let totalUnplanned = 0;
  let totalCare = 0;
  let totalBlood = 0;
  let totalUnpaid = 0;
  let totalPresentDays = 0;
  let hallTotalHoursRaw = 0;    // Suma godzin bez odejmowania przerw
  let hallTotalHours = 0;       // Suma godzin z odjętymi przerwami (-0.5h/dzień)
  let hallTotalOvertime = 0;
  
  // Liczymy tylko dni robocze (pon-pt, bez świąt) do frekwencji
  // Tylko pracownicy produkcyjni (bez nadzoru)
  const productionEmployees = employees.filter(e => !e.is_supervisor);
  const workingDaysCount = daysInMonth.filter(d => !isFreeDay(d)).length;
  let totalExpectedDays = productionEmployees.length * workingDaysCount;

  // Filtruj absences tylko dla pracowników produkcyjnych
  const productionEmployeeIds = new Set(productionEmployees.map(e => e.id));
  
  absences.filter(a => productionEmployeeIds.has(a.employee_id)).forEach(a => {
    if (a.type === "vacation") totalVacation++;
    else if (a.type === "sick") totalSick++;
    else if (a.type === "unplanned") totalUnplanned++;
    else if (a.type === "care") totalCare++;
    else if (a.type === "blood") totalBlood++;
    else if (a.type === "unpaid") totalUnpaid++;
    else if (a.type === "present") {
      // Używamy employment_type z absences (zawiera dane usuniętych pracowników)
      // Fallback do employees dla kompatybilności wstecznej
      const emp = employees.find(e => e.id === a.employee_id);
      const employmentType = a.employment_type || emp?.employment_type;
      const isAgencyOrDG = employmentType === 'Agencja' || employmentType === 'DG';
      
      const workingHours = a.working_hours || 0;
      const overtimeHours = a.overtime_hours || 0;
      
      if (isAgencyOrDG) {
        // Agencja/DG: nadgodziny traktowane jako normalne godziny
        const totalHours = workingHours + overtimeHours;
        if (totalHours > 0) {
          hallTotalHoursRaw += totalHours;
          hallTotalHours += Math.max(0, totalHours - 0.5);
        }
        // Nie dodajemy do hallTotalOvertime
      } else {
        // Etat: standardowa logika
        if (workingHours > 0) {
          hallTotalHoursRaw += workingHours;
          hallTotalHours += Math.max(0, workingHours - 0.5);
        }
        hallTotalOvertime += overtimeHours;
      }
      
      // Liczymy tylko obecności w dni robocze do frekwencji
      if ((workingHours > 0 || overtimeHours > 0)) {
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
        "Nr": emp.employee_number || '',
        "Pracownik": `${emp.last_name} ${emp.first_name}`,
        "Stanowisko": emp.position,
        "Forma": emp.employment_type || 'Etat'
      };
      
      let totalHours = 0;
      let totalOvertime = 0;
      let sumUW = 0, sumCH = 0, sumNZ = 0, sumOP = 0, sumKR = 0, sumBL = 0;
      const isAgencyOrDG = emp.employment_type === 'Agencja' || emp.employment_type === 'DG';

      daysInMonth.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const val = getCellValue(emp.id, dateStr);
        row[format(day, "dd.MM")] = val;
        
        const absence = absences.find(a => a.employee_id === emp.id && a.date === dateStr);
        if (absence) {
          if (absence.type === "present") {
            const wh = absence.working_hours || 0;
            const oh = absence.overtime_hours || 0;
            // Agencja/DG: nadgodziny doliczane do godzin
            totalHours += wh + (isAgencyOrDG ? oh : 0);
            totalOvertime += isAgencyOrDG ? 0 : oh;
          } else if (absence.type === "vacation") sumUW++;
          else if (absence.type === "sick") sumCH++;
          else if (absence.type === "unplanned") sumNZ++;
          else if (absence.type === "care") sumOP++;
          else if (absence.type === "blood") sumKR++;
          else if (absence.type === "unpaid") sumBL++;
        }
      });
      
      // Oblicz limit dla eksportu
      const hoursLimit = emp.employment_type === 'Agencja' ? settings.hours_limit_agencja :
                         emp.employment_type === 'DG' ? settings.hours_limit_dg : null;
      const remainingLimit = hoursLimit !== null ? hoursLimit - totalHours : null;
      
      row["Limit"] = remainingLimit !== null ? remainingLimit : '-';
      row["Suma Godz"] = totalHours;
      row["Suma Nadg"] = totalOvertime;
      row["Razem"] = totalHours + totalOvertime;
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
          <div className="flex items-center gap-2 bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">Bezpłatny:</span>
            <span className="font-bold">{totalUnpaid}</span>
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

      <div ref={tableCardRef} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Karta Obecności</h3>
            <p className="text-sm text-gray-500">Wpisz godziny (np. 8, 10) lub status</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {shiftCount > 1 && (
              <button
                onClick={handleRotateShifts}
                className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded-md transition-colors"
                title="Rotuj wszystkie zmiany (1→2→3→1)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rotuj zmiany
              </button>
            )}
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

        <div ref={tableScrollRef} className={`overflow-x-auto overflow-y-hidden ${showFixedScrollbar ? 'hide-native-scrollbar' : ''}`}>
          <table className="w-full text-left text-sm attendance-table">
            <thead>
              <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                {shiftCount > 1 && (
                  <th className="p-2 font-semibold min-w-[40px] w-[40px] text-center sticky-col-shift-header" title="Zmiana">Zm</th>
                )}
                <th className={`p-2 font-semibold min-w-[60px] w-[60px] ${shiftCount > 1 ? 'sticky-col-0-header-shifted' : 'sticky-col-0-header'}`}>Nr</th>
                <th className={`p-2 font-semibold whitespace-nowrap min-w-[180px] ${shiftCount > 1 ? 'sticky-col-1-header-shifted' : 'sticky-col-1-header'}`}>Pracownik</th>
                <th className="p-2 font-semibold min-w-[80px] w-[80px] bg-gray-100 text-gray-600" title="Kwalifikacje">Kwalif.</th>
                <th className={`p-2 font-semibold min-w-[100px] w-[100px] ${shiftCount > 1 ? 'sticky-col-2-header-shifted' : 'sticky-col-2-header'}`}>Stanowisko</th>
                <th className={`p-2 font-semibold min-w-[60px] w-[60px] text-center ${shiftCount > 1 ? 'sticky-col-forma-header-shifted' : 'sticky-col-forma-header'}`} title="Forma zatrudnienia">Forma</th>
                <th className={`p-2 font-semibold text-center min-w-[40px] w-[40px] ${shiftCount > 1 ? 'sticky-col-edit-header-shifted' : 'sticky-col-edit-header'}`} title="Edytuj pracownika">✏️</th>
                <th className={`p-2 font-semibold text-center min-w-[40px] w-[40px] ${shiftCount > 1 ? 'sticky-col-3-header-shifted' : 'sticky-col-3-header'}`} title="Przesuń na inną halę">↔</th>
                <th className={`p-2 font-semibold text-center min-w-[50px] w-[50px] ${shiftCount > 1 ? 'sticky-col-4-header-shifted' : 'sticky-col-4-header'}`}>Akcja</th>
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
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-amber-50 text-amber-800" title="Pozostały limit godzin (Agencja/DG)">Limit</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-blue-50">Suma Godz</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-purple-50">Suma Nadg</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-green-100 text-green-800" title="Suma godzin + nadgodziny">Razem</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-blue-100 text-blue-800" title="Urlop Wypoczynkowy">UW</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-red-100 text-red-800" title="Chorobowe">CH</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-orange-100 text-orange-800" title="Nieplanowane">NŻ</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-teal-100 text-teal-800" title="Opieka">OP</th>
                <th className="p-2 font-semibold text-center border-r border-gray-200 bg-rose-100 text-rose-800" title="Krew">KR</th>
                <th className="p-2 font-semibold text-center bg-gray-200 text-gray-800" title="Bezpłatny">BL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Sekcja: Pracownicy produkcyjni */}
              {employees.filter(e => !e.is_supervisor).map(emp => {
                const empAbsences = absences.filter(a => a.employee_id === emp.id);
                const isAgencyOrDG = emp.employment_type === 'Agencja' || emp.employment_type === 'DG';
                
                // Dla Agencja/DG: nadgodziny doliczane do godzin, nie do nadgodzin
                const totalHours = empAbsences.reduce((sum, a) => {
                  if (a.type !== "present") return sum;
                  const wh = a.working_hours || 0;
                  const oh = a.overtime_hours || 0;
                  return sum + wh + (isAgencyOrDG ? oh : 0);
                }, 0);
                const totalOvertime = isAgencyOrDG ? 0 : empAbsences.reduce((sum, a) => sum + (a.type === "present" ? (a.overtime_hours || 0) : 0), 0);
                
                const sumUW = empAbsences.filter(a => a.type === "vacation").length;
                const sumCH = empAbsences.filter(a => a.type === "sick").length;
                const sumNZ = empAbsences.filter(a => a.type === "unplanned").length;
                const sumOP = empAbsences.filter(a => a.type === "care").length;
                const sumKR = empAbsences.filter(a => a.type === "blood").length;
                const sumBL = empAbsences.filter(a => a.type === "unpaid").length;
                
                // Oblicz pozostały limit godzin dla Agencja/DG
                const hoursLimit = emp.employment_type === 'Agencja' ? settings.hours_limit_agencja :
                                   emp.employment_type === 'DG' ? settings.hours_limit_dg : null;
                const remainingLimit = hoursLimit !== null ? hoursLimit - totalHours : null;
                const isLimitCritical = remainingLimit !== null && remainingLimit < 20;

                return (
                  <tr 
                    key={emp.id} 
                    className={`group hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing ${
                      dragOverEmployeeId === emp.id ? 'bg-blue-100 border-t-2 border-blue-500' : ''
                    } ${draggedEmployeeId === emp.id ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, emp.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, emp.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, emp.id)}
                  >
                    {shiftCount > 1 && (
                      <td className="p-1 text-center min-w-[40px] w-[40px] sticky-col-shift group-hover:!bg-gray-50">
                        <select
                          value={emp.shift || 1}
                          onChange={(e) => handleChangeShift(emp.id, parseInt(e.target.value))}
                          className={`text-xs font-bold px-1 py-0.5 rounded-full border-0 cursor-pointer ${
                            (emp.shift || 1) === 1 ? 'bg-blue-100 text-blue-700' :
                            (emp.shift || 1) === 2 ? 'bg-green-100 text-green-700' :
                            'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {[1, 2, 3].slice(0, shiftCount).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className={`p-2 text-gray-800 min-w-[60px] w-[60px] ${shiftCount > 1 ? 'sticky-col-0-shifted' : 'sticky-col-0'} group-hover:!bg-gray-50`}>
                      {emp.employee_number || '-'}
                    </td>
                    <td className={`p-2 font-medium text-gray-800 whitespace-nowrap min-w-[180px] ${shiftCount > 1 ? 'sticky-col-1-shifted' : 'sticky-col-1'} group-hover:!bg-gray-50`}>
                      {emp.last_name} {emp.first_name}
                    </td>
                    <td className="p-1 min-w-[80px] w-[80px] group-hover:!bg-gray-50" title={emp.qualifications || ''}>
                      <div className="flex flex-wrap gap-0.5">
                        {(emp.qualifications || '').split(',').map(s => s.trim()).filter(Boolean).map(q => (
                          <span key={q} className="text-[9px] font-semibold px-1 py-0.5 rounded bg-teal-50 text-teal-700">{q}</span>
                        ))}
                      </div>
                    </td>
                    <td className={`p-2 text-gray-500 text-xs truncate min-w-[100px] w-[100px] ${shiftCount > 1 ? 'sticky-col-2-shifted' : 'sticky-col-2'} group-hover:!bg-gray-50`} title={emp.position}>
                      {emp.position}
                    </td>
                    <td className={`p-1 text-center min-w-[60px] w-[60px] ${shiftCount > 1 ? 'sticky-col-forma-shifted' : 'sticky-col-forma'} group-hover:!bg-gray-50`}>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        emp.employment_type === 'Agencja' ? 'bg-orange-100 text-orange-700' :
                        emp.employment_type === 'DG' ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {emp.employment_type || 'Etat'}
                      </span>
                    </td>
                    <td className={`p-1 text-center min-w-[40px] w-[40px] ${shiftCount > 1 ? 'sticky-col-edit-shifted' : 'sticky-col-edit'} group-hover:!bg-gray-50`}>
                      <button 
                        type="button"
                        onClick={() => setEditingEmployee({...emp})}
                        className="text-amber-500 hover:text-amber-700 p-1 cursor-pointer"
                        title="Edytuj pracownika"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                    <td className={`p-1 text-center min-w-[40px] w-[40px] ${shiftCount > 1 ? 'sticky-col-3-shifted' : 'sticky-col-3'} group-hover:!bg-gray-50`}>
                      <button 
                        type="button"
                        onClick={() => setTransferringEmployeeId(emp.id)}
                        className="text-blue-400 hover:text-blue-600 p-1 cursor-pointer"
                        title="Przesuń na inną halę"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </button>
                    </td>
                    <td className={`p-1 text-center min-w-[50px] w-[50px] ${shiftCount > 1 ? 'sticky-col-4-shifted' : 'sticky-col-4'} group-hover:!bg-gray-50`}>
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
                      const commentKey = `${emp.id}_${dateStr}`;
                      const hasComment = !!dayComments[commentKey];

                      // Podświetl gdy: Etat, dzień roboczy, wpisano liczbę < 8
                      const numVal = parseFloat(val);
                      const isShortHours = !isWknd && emp.employment_type === 'Etat' && val && !isNaN(numVal) && numVal > 0 && numVal < 8;

                      return (
                        <td
                          key={dateStr}
                          className={`p-0 border-r relative ${isWknd ? 'bg-red-50 border-red-200' : 'border-gray-200'} ${isToday && !val ? 'bg-yellow-50' : ''} ${isShortHours && hasComment ? 'cell-short-hours-commented' : ''} ${isShortHours && !hasComment ? 'cell-short-hours' : ''}`}
                          title={isShortHours && hasComment ? `Komentarz: ${dayComments[commentKey]}` : isShortHours ? 'Kliknij prawym przyciskiem aby dodać komentarz' : undefined}
                        >
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
                          {isShortHours && (
                            <button
                              type="button"
                              onClick={() => {
                                setCommentModal({ empId: emp.id, date: dateStr, empName: `${emp.last_name} ${emp.first_name}`, hours: numVal });
                                setCommentText(dayComments[commentKey] || "");
                              }}
                              className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold leading-none transition-colors ${hasComment ? 'bg-amber-400 text-white hover:bg-amber-500' : 'bg-red-400 text-white hover:bg-red-600'}`}
                              title={hasComment ? "Edytuj komentarz" : "Dodaj komentarz"}
                            >
                              {hasComment ? '✓' : '!'}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className={`p-2 text-center font-bold border-r border-gray-200 ${
                      isLimitCritical 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : remainingLimit !== null 
                          ? 'bg-amber-50 text-amber-800' 
                          : 'bg-gray-50 text-gray-400'
                    }`} title={hoursLimit !== null ? `Limit: ${hoursLimit}h, Wykorzystano: ${totalHours}h` : 'Etat - brak limitu'}>
                      {remainingLimit !== null ? remainingLimit : '-'}
                    </td>
                    <td className="p-2 text-center font-bold text-blue-700 border-r border-gray-200 bg-blue-50/50">
                      {totalHours > 0 ? totalHours : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-purple-700 border-r border-gray-200 bg-purple-50/50">
                      {totalOvertime > 0 ? totalOvertime : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-green-800 border-r border-gray-200 bg-green-50/50">
                      {(totalHours + totalOvertime) > 0 ? (totalHours + totalOvertime) : ""}
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
              {employees.filter(e => !e.is_supervisor).length === 0 && (
                <tr>
                  <td colSpan={daysInMonth.length + 14} className="p-8 text-center text-gray-500">
                    {activeHallId ? "Brak pracowników produkcyjnych przypisanych do tej hali." : "Wybierz halę, aby zobaczyć pracowników."}
                  </td>
                </tr>
              )}
              
              {/* Sekcja: Nadzór (Mistrzowie, Brygadziści) */}
              {employees.filter(e => e.is_supervisor).length > 0 && (
                <tr className="bg-indigo-100 border-t-4 border-indigo-300">
                  <td colSpan={daysInMonth.length + 14} className="p-3 text-center">
                    <span className="text-indigo-800 font-bold text-sm flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      NADZÓR ({employees.filter(e => e.is_supervisor).length})
                      <span className="text-xs font-normal text-indigo-600 ml-2">(godziny nie wliczane do statystyk hali)</span>
                    </span>
                  </td>
                </tr>
              )}
              {employees.filter(e => e.is_supervisor).map(emp => {
                const empAbsences = absences.filter(a => a.employee_id === emp.id);
                const isAgencyOrDG = emp.employment_type === 'Agencja' || emp.employment_type === 'DG';
                
                // Dla Agencja/DG: nadgodziny doliczane do godzin, nie do nadgodzin
                const totalHours = empAbsences.reduce((sum, a) => {
                  if (a.type !== "present") return sum;
                  const wh = a.working_hours || 0;
                  const oh = a.overtime_hours || 0;
                  return sum + wh + (isAgencyOrDG ? oh : 0);
                }, 0);
                const totalOvertime = isAgencyOrDG ? 0 : empAbsences.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
                const sumUW = empAbsences.filter(a => a.type === "vacation").length;
                const sumCH = empAbsences.filter(a => a.type === "sick").length;
                const sumNZ = empAbsences.filter(a => a.type === "unplanned").length;
                const sumOP = empAbsences.filter(a => a.type === "care").length;
                const sumKR = empAbsences.filter(a => a.type === "blood").length;
                const sumBL = empAbsences.filter(a => a.type === "unpaid").length;
                
                // Oblicz pozostały limit godzin dla Agencja/DG
                const hoursLimit = emp.employment_type === 'Agencja' ? settings.hours_limit_agencja :
                                   emp.employment_type === 'DG' ? settings.hours_limit_dg : null;
                const remainingLimit = hoursLimit !== null ? hoursLimit - totalHours : null;
                const isLimitCritical = remainingLimit !== null && remainingLimit < 20;

                return (
                  <tr 
                    key={emp.id} 
                    className={`group hover:bg-indigo-50 transition-colors cursor-grab active:cursor-grabbing bg-indigo-50/30 ${
                      dragOverEmployeeId === emp.id ? 'bg-blue-100 border-t-2 border-blue-500' : ''
                    } ${draggedEmployeeId === emp.id ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, emp.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, emp.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, emp.id)}
                  >
                    {shiftCount > 1 && (
                      <td className="p-1 text-center min-w-[40px] w-[40px] sticky-col-shift group-hover:!bg-indigo-50">
                        <select
                          value={emp.shift || 1}
                          onChange={(e) => handleChangeShift(emp.id, parseInt(e.target.value))}
                          className={`text-xs font-bold px-1 py-0.5 rounded-full border-0 cursor-pointer ${
                            (emp.shift || 1) === 1 ? 'bg-blue-100 text-blue-700' :
                            (emp.shift || 1) === 2 ? 'bg-green-100 text-green-700' :
                            'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {[1, 2, 3].slice(0, shiftCount).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className={`p-2 text-gray-800 min-w-[60px] w-[60px] ${shiftCount > 1 ? 'sticky-col-0-shifted' : 'sticky-col-0'} group-hover:!bg-indigo-50`}>
                      {emp.employee_number || '-'}
                    </td>
                    <td className={`p-2 font-medium text-indigo-800 whitespace-nowrap min-w-[180px] ${shiftCount > 1 ? 'sticky-col-1-shifted' : 'sticky-col-1'} group-hover:!bg-indigo-50`}>
                      {emp.last_name} {emp.first_name}
                    </td>
                    <td className="p-1 min-w-[80px] w-[80px] group-hover:!bg-indigo-50" title={emp.qualifications || ''}>
                      <div className="flex flex-wrap gap-0.5">
                        {(emp.qualifications || '').split(',').map(s => s.trim()).filter(Boolean).map(q => (
                          <span key={q} className="text-[9px] font-semibold px-1 py-0.5 rounded bg-teal-50 text-teal-700">{q}</span>
                        ))}
                      </div>
                    </td>
                    <td className={`p-2 text-indigo-600 text-xs truncate min-w-[100px] w-[100px] ${shiftCount > 1 ? 'sticky-col-2-shifted' : 'sticky-col-2'} group-hover:!bg-indigo-50`} title={emp.position}>
                      {emp.position}
                    </td>
                    <td className={`p-1 text-center min-w-[60px] w-[60px] ${shiftCount > 1 ? 'sticky-col-forma-shifted' : 'sticky-col-forma'} group-hover:!bg-indigo-50`}>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        emp.employment_type === 'Agencja' ? 'bg-orange-100 text-orange-700' :
                        emp.employment_type === 'DG' ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {emp.employment_type || 'Etat'}
                      </span>
                    </td>
                    <td className={`p-1 text-center min-w-[40px] w-[40px] ${shiftCount > 1 ? 'sticky-col-edit-shifted' : 'sticky-col-edit'} group-hover:!bg-indigo-50`}>
                      <button
                        onClick={() => setEditingEmployee(emp)}
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-100 p-1 rounded transition-colors"
                        title="Edytuj pracownika"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                    <td className={`p-1 text-center min-w-[40px] w-[40px] ${shiftCount > 1 ? 'sticky-col-3-shifted' : 'sticky-col-3'} group-hover:!bg-indigo-50`}>
                      <button
                        onClick={() => setTransferringEmployeeId(emp.id)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 p-1 rounded transition-colors"
                        title="Przenieś na inną halę"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                    </td>
                    <td className={`p-1 text-center min-w-[50px] w-[50px] ${shiftCount > 1 ? 'sticky-col-4-shifted' : 'sticky-col-4'} group-hover:!bg-indigo-50`}>
                      {confirmingDeleteId === emp.id ? (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-100 p-1 rounded transition-colors"
                            title="Potwierdź usunięcie"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteId(null)}
                            className="text-gray-600 hover:text-gray-700 hover:bg-gray-100 p-1 rounded transition-colors"
                            title="Anuluj"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingDeleteId(emp.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
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
                      const commentKey = `${emp.id}_${dateStr}`;
                      const hasComment = !!dayComments[commentKey];

                      // Podświetl gdy: Etat, dzień roboczy, wpisano liczbę < 8
                      const numVal = parseFloat(val);
                      const isShortHours = !isWknd && emp.employment_type === 'Etat' && val && !isNaN(numVal) && numVal > 0 && numVal < 8;

                      return (
                        <td
                          key={dateStr}
                          className={`p-0 border-r relative ${isWknd ? 'bg-red-50 border-red-200' : 'border-gray-200'} ${isToday && !val ? 'bg-yellow-50' : ''} ${isShortHours && hasComment ? 'cell-short-hours-commented' : ''} ${isShortHours && !hasComment ? 'cell-short-hours' : ''}`}
                          title={isShortHours && hasComment ? `Komentarz: ${dayComments[commentKey]}` : isShortHours ? 'Kliknij aby dodać komentarz' : undefined}
                        >
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
                          {isShortHours && (
                            <button
                              type="button"
                              onClick={() => {
                                setCommentModal({ empId: emp.id, date: dateStr, empName: `${emp.last_name} ${emp.first_name}`, hours: numVal });
                                setCommentText(dayComments[commentKey] || "");
                              }}
                              className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold leading-none transition-colors ${hasComment ? 'bg-amber-400 text-white hover:bg-amber-500' : 'bg-red-400 text-white hover:bg-red-600'}`}
                              title={hasComment ? "Edytuj komentarz" : "Dodaj komentarz"}
                            >
                              {hasComment ? '✓' : '!'}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className={`p-2 text-center font-bold border-r border-gray-200 ${
                      isLimitCritical 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : remainingLimit !== null 
                          ? 'bg-amber-50 text-amber-800' 
                          : 'bg-gray-50 text-gray-400'
                    }`} title={hoursLimit !== null ? `Limit: ${hoursLimit}h, Wykorzystano: ${totalHours}h` : 'Etat - brak limitu'}>
                      {remainingLimit !== null ? remainingLimit : '-'}
                    </td>
                    <td className="p-2 text-center font-bold text-blue-700 border-r border-gray-200 bg-blue-50/50">
                      {totalHours > 0 ? totalHours : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-purple-700 border-r border-gray-200 bg-purple-50/50">
                      {totalOvertime > 0 ? totalOvertime : ""}
                    </td>
                    <td className="p-2 text-center font-bold text-green-800 border-r border-gray-200 bg-green-50/50">
                      {(totalHours + totalOvertime) > 0 ? (totalHours + totalOvertime) : ""}
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Fixed horizontal scrollbar - always visible at bottom of screen */}
      {showFixedScrollbar && createPortal(
        <div className="fixed-scrollbar">
          <div 
            ref={scrollbarRef}
            className="fixed-scrollbar-inner"
          >
            <div style={{ width: tableWidth || '100%', height: '1px' }}></div>
          </div>
        </div>,
        document.body
      )}

      {/* Charts */}
      {activeHallId && employees.length > 0 && (() => {
        const chartData = daysInMonth.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          // Filtruj tylko pracowników produkcyjnych (bez nadzoru)
          const productionEmpIds = new Set(employees.filter(e => !e.is_supervisor).map(e => e.id));
          const dayAbsences = absences.filter(a => a.date === dateStr && productionEmpIds.has(a.employee_id));
          
          let present = 0;
          let vacation = 0;
          let sick = 0;
          let unplanned = 0;
          let care = 0;
          let blood = 0;
          let unpaid = 0;
          let totalHours = 0;
          let overtime = 0;

          // Iterujemy po absences zamiast employees - uwzględnia usuniętych pracowników
          dayAbsences.forEach(record => {
            const type = record.type;
            // Używamy employment_type z absences (zawiera dane usuniętych pracowników)
            const emp = employees.find(e => e.id === record.employee_id);
            const employmentType = record.employment_type || emp?.employment_type;
            const isAgencyOrDG = employmentType === 'Agencja' || employmentType === 'DG';
            
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
            
            // Nadgodziny tylko dla Etat (nie Agencja/DG)
            if (record.overtime_hours && !isAgencyOrDG) overtime += record.overtime_hours;
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
            Bezpłatny: unpaid,
            Nadgodziny: overtime
          };
        });

        // Oblicz dynamiczną wysokość wykresu na podstawie maksymalnej wartości i liczby pracowników
        const maxValue = Math.max(...chartData.map(d => 
          (d.Obecni || 0) + (d.Urlop || 0) + (d.Chorobowe || 0) + (d.Nieplanowane || 0) + (d.Opieka || 0) + (d.Krew || 0) + (d.Bezpłatny || 0)
        ), 1);
        // Wysokość: minimum 250px, maksimum 450px, skalowana do danych
        const chartHeight = Math.max(250, Math.min(450, maxValue * 50 + 150));

        // Statystyki kwalifikacji dla aktywnej hali — dynamiczne ze wszystkich pracowników
        const hallProductionEmps = employees.filter(e => !e.is_supervisor);
        const hallMonthAbsences = absences;
        const allHallQuals = new Set<string>();
        hallProductionEmps.forEach((e: any) => {
          (e.qualifications || '').split(',').map((s: string) => s.trim()).filter(Boolean).forEach((q: string) => allHallQuals.add(q));
        });
        const hallQualStats = Array.from(allHallQuals).sort().map(q => {
          const qConfig = qualificationsList.find((c: any) => c.name === q);
          const isDeduction = qConfig?.hours_mode === 'deduction';
          const empsWithQ = hallProductionEmps.filter((e: any) =>
            (e.qualifications || '').split(',').map((s: string) => s.trim()).includes(q)
          );
          const empIds = new Set(empsWithQ.map((e: any) => e.id));
          const qAbsences = hallMonthAbsences.filter((a: any) => empIds.has(a.employee_id));
          const rawHours = qAbsences.reduce((sum: number, a: any) => sum + (a.working_hours || 0) + (a.overtime_hours || 0), 0);
          const presentDays = qAbsences.filter((a: any) => a.type === 'present' && ((a.working_hours || 0) > 0 || (a.overtime_hours || 0) > 0)).length;
          const totalHours = isDeduction ? Math.max(0, rawHours - presentDays * 0.5) : rawHours;
          return { label: q, count: empsWithQ.length, totalHours, isDeduction };
        }).filter(q => q.count > 0);

        return (
          <div className="space-y-6 mt-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <h3 className="text-lg font-semibold text-gray-800 mb-6 font-sans">Stan Osobowy - {format(new Date(selectedMonth), "MMMM yyyy", { locale: pl })}</h3>
              <div className="overflow-x-auto overflow-y-hidden" style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ minWidth: '1000px', height: `${chartHeight}px`, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
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

          {/* Wykres Nadgodzin Dziennie */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-800 mb-6 font-sans">Nadgodziny - Dziennie</h3>
            <div className="overflow-x-auto overflow-y-hidden">
              <div style={{ minWidth: '1000px', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 30, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
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
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 13, fill: '#64748b' }} 
                      dx={-10} 
                      domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.2), 1)]} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#f9fafb' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 shadow-md rounded-lg">
                              <p className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">Data: {label}</p>
                              <p className="text-sm text-purple-600 font-sans font-medium">Nadgodziny: <span className="font-bold underline">{data.Nadgodziny}h</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 10 }} />
                    <Bar dataKey="Nadgodziny" fill="#8b5cf6" name="Suma Nadgodzin (h)" radius={[6, 6, 0, 0]} barSize={28}>
                      <LabelList 
                        dataKey="Nadgodziny" 
                        position="top" 
                        fill="#8b5cf6" 
                        fontSize={13} 
                        fontWeight="bold" 
                        formatter={(val: any) => val > 0 ? `${val}h` : ''} 
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Statystyki kwalifikacji */}
            {hallQualStats.length > 0 && (
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                  Statystyki Kwalifikacji — {format(new Date(selectedMonth), "MMMM yyyy", { locale: pl })}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hallQualStats.map((q, i) => {
                    const colors = [
                      { bg: "bg-teal-50", border: "border-teal-100", badge: "bg-teal-100 text-teal-700", num: "text-teal-700", icon: "text-teal-400" },
                      { bg: "bg-blue-50", border: "border-blue-100", badge: "bg-blue-100 text-blue-700", num: "text-blue-700", icon: "text-blue-400" },
                      { bg: "bg-violet-50", border: "border-violet-100", badge: "bg-violet-100 text-violet-700", num: "text-violet-700", icon: "text-violet-400" },
                    ];
                    const c = colors[i % colors.length];
                    return (
                      <div key={q.label} className={`${c.bg} p-5 rounded-xl border ${c.border}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.badge}`}>{q.label}</span>
                            {q.isDeduction && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">-0.5h/dzień</span>}
                          </div>
                          <svg className={`w-5 h-5 ${c.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Pracownicy</p>
                            <p className={`text-3xl font-bold ${c.num}`}>{q.count}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500 mb-0.5">Przepracowane</p>
                            <p className={`text-2xl font-bold ${c.num}`}>{q.totalHours}h</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/60">
                          <p className="text-xs text-gray-500">
                            Śr. na osobę: <span className="font-semibold text-gray-700">{q.count > 0 ? Math.round(q.totalHours / q.count) : 0}h</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      );
      })()}

      {/* Modal komentarza do krótkiego dnia */}
      {commentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-amber-50">
              <div>
                <h3 className="text-base font-bold text-gray-800">Komentarz do dnia</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {commentModal.empName} &bull; {commentModal.date} &bull; <span className="text-red-600 font-semibold">{commentModal.hours}h</span>
                </p>
              </div>
              <button onClick={() => setCommentModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Powód skróconego czasu pracy
                </label>
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none resize-none"
                  placeholder="np. Wizyta lekarska, wyjście służbowe, awaria maszyny..."
                  autoFocus
                />
              </div>
              {dayComments[`${commentModal.empId}_${commentModal.date}`] && (
                <div className="text-xs text-gray-400 italic">
                  Obecny komentarz zostanie zastąpiony
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3 justify-between">
              {dayComments[`${commentModal.empId}_${commentModal.date}`] && (
                <button
                  type="button"
                  onClick={async () => {
                    await fetchApi("/api/day-comments", {
                      method: "DELETE",
                      body: JSON.stringify({ employee_id: commentModal.empId, date: commentModal.date })
                    });
                    await loadDayComments();
                    setCommentModal(null);
                  }}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg transition-colors"
                >
                  Usuń komentarz
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setCommentModal(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  disabled={savingComment || !commentText.trim()}
                  onClick={async () => {
                    if (!commentText.trim()) return;
                    setSavingComment(true);
                    try {
                      await fetchApi("/api/day-comments", {
                        method: "POST",
                        body: JSON.stringify({ employee_id: commentModal.empId, date: commentModal.date, comment: commentText.trim() })
                      });
                      await loadDayComments();
                      setCommentModal(null);
                    } catch (err: any) {
                      setError(err.message || "Błąd zapisu komentarza");
                    }
                    setSavingComment(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingComment ? "Zapisuję..." : "Zapisz"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Nr pracownika</label>
                <input
                  type="text"
                  value={newEmployee.employee_number || ''}
                  onChange={e => setNewEmployee({...newEmployee, employee_number: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="np. 001"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Stanowisko</label>
                <input
                  type="text"
                  value={newEmployee.position}
                  onChange={e => setNewEmployee({...newEmployee, position: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="np. Monter"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kwalifikacje</label>
                <div className="flex gap-4">
                  {qualificationsList.map(q => (
                    <label key={q.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(newEmployee.qualifications || "").split(",").map(s => s.trim()).filter(Boolean).includes(q.name)}
                        onChange={e => {
                          const current = (newEmployee.qualifications || "").split(",").map(s => s.trim()).filter(Boolean);
                          const updated = e.target.checked ? [...current, q.name] : current.filter(x => x !== q.name);
                          setNewEmployee({...newEmployee, qualifications: updated.join(", ")});
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{q.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Forma zatrudnienia</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="employment_type"
                      value="Etat"
                      checked={newEmployee.employment_type === "Etat"}
                      onChange={e => setNewEmployee({...newEmployee, employment_type: e.target.value})}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Etat</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="employment_type"
                      value="Agencja"
                      checked={newEmployee.employment_type === "Agencja"}
                      onChange={e => setNewEmployee({...newEmployee, employment_type: e.target.value})}
                      className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Agencja</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="employment_type"
                      value="DG"
                      checked={newEmployee.employment_type === "DG"}
                      onChange={e => setNewEmployee({...newEmployee, employment_type: e.target.value})}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">DG</span>
                  </label>
                </div>
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

      {/* Modal Edycji Pracownika */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50">
              <h3 className="text-xl font-bold text-gray-800">Edytuj Pracownika</h3>
              <button 
                onClick={() => setEditingEmployee(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleEditEmployee} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nr pracownika</label>
                <input
                  type="text"
                  value={editingEmployee.employee_number || ''}
                  onChange={e => setEditingEmployee({...editingEmployee, employee_number: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="np. 001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nazwisko</label>
                <input
                  type="text"
                  required
                  value={editingEmployee.last_name}
                  onChange={e => setEditingEmployee({...editingEmployee, last_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="np. Kowalski"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imię</label>
                <input
                  type="text"
                  required
                  value={editingEmployee.first_name}
                  onChange={e => setEditingEmployee({...editingEmployee, first_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="np. Jan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stanowisko</label>
                <input
                  type="text"
                  value={editingEmployee.position || ''}
                  onChange={e => setEditingEmployee({...editingEmployee, position: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="np. Monter"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kwalifikacje</label>
                <div className="flex gap-4">
                  {qualificationsList.map(q => (
                    <label key={q.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(editingEmployee.qualifications || "").split(",").map(s => s.trim()).filter(Boolean).includes(q.name)}
                        onChange={e => {
                          const current = (editingEmployee.qualifications || "").split(",").map(s => s.trim()).filter(Boolean);
                          const updated = e.target.checked ? [...current, q.name] : current.filter(x => x !== q.name);
                          setEditingEmployee({...editingEmployee, qualifications: updated.join(", ")});
                        }}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700">{q.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hala</label>
                <select
                  value={editingEmployee.hall_id}
                  onChange={e => setEditingEmployee({...editingEmployee, hall_id: parseInt(e.target.value)})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  {allHalls.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Forma zatrudnienia</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit_employment_type"
                      value="Etat"
                      checked={editingEmployee.employment_type === "Etat"}
                      onChange={e => setEditingEmployee({...editingEmployee, employment_type: e.target.value})}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Etat</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit_employment_type"
                      value="Agencja"
                      checked={editingEmployee.employment_type === "Agencja"}
                      onChange={e => setEditingEmployee({...editingEmployee, employment_type: e.target.value})}
                      className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Agencja</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit_employment_type"
                      value="DG"
                      checked={editingEmployee.employment_type === "DG"}
                      onChange={e => setEditingEmployee({...editingEmployee, employment_type: e.target.value})}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">DG</span>
                  </label>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition-colors shadow-sm"
                >
                  Zapisz zmiany
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal przenoszenia pracownika */}
      {transferringEmployeeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Przenieś Pracownika</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {employees.find(e => e.id === transferringEmployeeId)?.first_name}{' '}
                  {employees.find(e => e.id === transferringEmployeeId)?.last_name}
                </p>
              </div>
              <button 
                onClick={() => setTransferringEmployeeId(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Wybierz halę docelową:</p>
              <div className="space-y-2">
                {allHalls
                  .filter(h => h.id !== activeHallId)
                  .map(h => (
                    <button
                      key={h.id}
                      onClick={() => handleTransferEmployee(transferringEmployeeId, h.id)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-between group"
                    >
                      <span className="font-medium text-gray-800">{h.name}</span>
                      <ArrowLeftRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                    </button>
                  ))
                }
              </div>
              <button
                onClick={() => setTransferringEmployeeId(null)}
                className="w-full mt-4 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
