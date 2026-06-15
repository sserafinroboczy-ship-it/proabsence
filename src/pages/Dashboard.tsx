import React, { useState, useEffect } from "react";
import { fetchApi } from "../lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { pl } from "date-fns/locale";

const isHoliday = (date: Date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const holidays = [
    "1.1", "6.1", "1.5", "3.5", "15.8", "1.11", "11.11", "25.12", "26.12"
  ];
  return holidays.includes(`${day}.${month}`);
};

const isWorkingDay = (date: Date) => {
  const day = date.getDay(); // 0 is Sunday, 6 is Saturday
  return day !== 0 && day !== 6 && !isHoliday(date);
};

export default function Dashboard() {
  const [halls, setHalls] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedHallId, setSelectedHallId] = useState<number | "global">("global");

  const [qualificationsConfig, setQualificationsConfig] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedAlerts, setExpandedAlerts] = useState<{tomorrow: boolean, recurring: boolean, vacation: boolean}>({
    tomorrow: false,
    recurring: false,
    vacation: false
  });

  // Odświeżaj dane gdy okno uzyska focus (powrót z innej strony)
  useEffect(() => {
    const handleFocus = () => setRefreshKey(k => k + 1);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    fetchApi("/api/qualifications").then(setQualificationsConfig).catch(() => {});
    fetchApi("/api/halls").then(data => {
      const activeHalls = data.filter((h: any) => h.is_active);
      setHalls(activeHalls);
      // Pobierz pracowników i filtruj tylko tych z aktywnych hal
      const activeHallIds = activeHalls.map((h: any) => h.id);
      fetchApi("/api/employees").then(emps => {
        setEmployees(emps.filter((e: any) => activeHallIds.includes(e.hall_id)));
      });
    });
  }, [refreshKey]);

  useEffect(() => {
    const start = format(startOfMonth(new Date(selectedMonth)), "yyyy-MM-dd");
    const end = format(endOfMonth(new Date(selectedMonth)), "yyyy-MM-dd");
    fetchApi(`/api/absences?start_date=${start}&end_date=${end}`).then(data => {
      // Filtruj absences tylko do aktywnych hal
      const activeHallIds = halls.map(h => h.id);
      if (activeHallIds.length > 0) {
        setAbsences(data.filter((a: any) => activeHallIds.includes(a.hall_id)));
      } else {
        setAbsences(data);
      }
    });
  }, [selectedMonth, halls, refreshKey]);

  // Generate days of the month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(new Date(selectedMonth)),
    end: endOfMonth(new Date(selectedMonth))
  });

  // Filtruj pracowników produkcyjnych (bez nadzoru) - używane we wszystkich statystykach
  const supervisorIds = new Set(employees.filter(e => e.is_supervisor).map(e => e.id));
  const productionEmployees = employees.filter(e => !e.is_supervisor);

  // Global Daily Data - iterujemy po absences aby uwzględnić usuniętych pracowników (bez nadzoru)
  const globalDailyData = daysInMonth.map(day => {
    const dateStr = format(day, "yyyy-MM-dd");
    // Filtruj tylko pracowników produkcyjnych
    const dayAbsences = absences.filter(a => a.date === dateStr && !supervisorIds.has(a.employee_id));
    
    let present = 0;
    let vacation = 0;
    let sick = 0;
    let unplanned = 0;
    let care = 0;
    let blood = 0;
    let unpaid = 0;
    
    // Hours calculation per hall for global view
    const hallHours: any = {};
    const hallCounts: any = {};
    halls.forEach(h => {
      hallHours[h.name] = 0;
      hallCounts[`${h.name}_count`] = 0;
    });

    // Iterujemy po absences zamiast employees - uwzględnia usuniętych pracowników
    dayAbsences.forEach(record => {
      const type = record.type;
      const isPresent = type === "present" && (record.working_hours > 0 || record.overtime_hours > 0);
      
      if (isPresent) {
        present++;
        const hall = halls.find(h => h.id === record.hall_id);
        if (hall) {
          // Rzeczywiste godziny pracy (working_hours + overtime_hours) minus 0.5h przerwy
          const totalWorked = (record.working_hours || 0) + (record.overtime_hours || 0);
          hallHours[hall.name] += Math.max(0, totalWorked - 0.5);
          hallCounts[`${hall.name}_count`] += 1;
        }
      }
      else if (type === "vacation") vacation++;
      else if (type === "sick") sick++;
      else if (type === "unplanned") unplanned++;
      else if (type === "care") care++;
      else if (type === "blood") blood++;
      else if (type === "unpaid") unpaid++;
    });

    return {
      date: format(day, "dd"),
      fullDate: dateStr,
      Obecni: present,
      Urlop: vacation,
      Chorobowe: sick,
      Nieplanowane: unplanned,
      Opieka: care,
      Krew: blood,
      Bezpłatny: unpaid,
      ...hallHours,
      ...hallCounts
    };
  });

  // Global Hall Stats (Frequency & Overtime per hall) - tylko pracownicy produkcyjni (bez nadzoru)
  const workingDaysInMonth = daysInMonth.filter(isWorkingDay).length;

  const globalHallStats = halls.map(hall => {
    // Filtruj absences tylko dla pracowników produkcyjnych
    const hallAbsences = absences.filter(a => a.hall_id === hall.id && !supervisorIds.has(a.employee_id));
    
    // Grupuj absences po employee_id aby policzyć unikalnych pracowników (w tym usuniętych)
    const uniqueEmployeeIds = [...new Set(hallAbsences.map(a => a.employee_id))];
    const activeEmployeesCount = productionEmployees.filter(e => e.hall_id === hall.id).length;
    // Użyj większej liczby - aktywni lub unikalni z absences
    const totalEmployeesCount = Math.max(activeEmployeesCount, uniqueEmployeeIds.length);
    
    // Base is total number of employee-days in working days only
    let totalBaseDays = totalEmployeesCount * workingDaysInMonth;
    let totalPresentDays = 0;
    let totalOvertime = 0;

    // Iterujemy po unikalnych pracownikach z absences
    uniqueEmployeeIds.forEach(empId => {
      const empAbsences = hallAbsences.filter(a => a.employee_id === empId);
      // Używamy employment_type z absences (zawiera dane usuniętych pracowników)
      const emp = employees.find(e => e.id === empId);
      const employmentType = empAbsences[0]?.employment_type || emp?.employment_type;
      const isAgencyOrDG = employmentType === 'Agencja' || employmentType === 'DG';
      
      // Liczymy tylko dni robocze (pon-pt, bez świąt) do frekwencji
      let presentDays = empAbsences.filter(a => {
        const date = new Date(a.date);
        return a.type === "present" && (a.working_hours > 0 || a.overtime_hours > 0) && isWorkingDay(date);
      }).length;
      // Nadgodziny tylko dla Etat (nie Agencja/DG)
      let overtime = isAgencyOrDG ? 0 : empAbsences.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
      
      totalPresentDays += presentDays;
      totalOvertime += overtime;
    });

    const frequency = totalBaseDays > 0 ? Math.round((totalPresentDays / totalBaseDays) * 100) : 0;

    return {
      name: hall.name,
      Frekwencja: frequency,
      Nadgodziny: totalOvertime
    };
  });

  // Hall Specific Data - iterujemy po absences aby uwzględnić usuniętych pracowników (bez nadzoru)
  const hallDailyData = selectedHallId !== "global" ? daysInMonth.map(day => {
    const dateStr = format(day, "yyyy-MM-dd");
    // Filtruj tylko pracowników produkcyjnych (bez nadzoru)
    const dayAbsences = absences.filter(a => a.date === dateStr && a.hall_id === selectedHallId && !supervisorIds.has(a.employee_id));
    
    let present = 0;
    let vacation = 0;
    let sick = 0;
    let unplanned = 0;
    let care = 0;
    let blood = 0;
    let unpaid = 0;
    let overtime = 0;
    let totalHours = 0;

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
      date: format(day, "dd"),
      fullDate: dateStr,
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
  }) : [];

  // Hall Stats
  let hallStats = { 
    frequency: 0, 
    bestEmployees: [] as any[],
    worstEmployees: [] as any[],
    overtimeLeaders: [] as any[],
    totalOvertime: 0,
    frequencyTrend: 0,
    criticalDays: [] as { date: string; present: number; absent: number }[],
    avgWorkingHours: 0,
    tomorrowAbsences: [] as any[],
    recurringAbsences: [] as any[],
    vacationLimitWarnings: [] as any[]
  };
  
  if (selectedHallId !== "global") {
    // Filtruj tylko pracowników produkcyjnych (bez nadzoru)
    const hallAbsences = absences.filter(a => a.hall_id === selectedHallId && !supervisorIds.has(a.employee_id));
    
    // Grupuj absences po employee_id aby uwzględnić usuniętych pracowników
    const uniqueEmployeeIds = [...new Set(hallAbsences.map(a => a.employee_id))];
    const activeEmployeesCount = productionEmployees.filter(e => e.hall_id === selectedHallId).length;
    const totalEmployeesCount = Math.max(activeEmployeesCount, uniqueEmployeeIds.length);
    
    let totalBaseDays = totalEmployeesCount * workingDaysInMonth;
    let totalPresentDays = 0;
    let totalWorkingHours = 0;

    // Iterujemy po unikalnych pracownikach z absences (w tym usuniętych)
    const empStats = uniqueEmployeeIds.map(empId => {
      const empAbsences = hallAbsences.filter(a => a.employee_id === empId);
      // Używamy danych z absences lub fallback do employees
      const emp = employees.find(e => e.id === empId);
      const employmentType = empAbsences[0]?.employment_type || emp?.employment_type;
      const isAgencyOrDG = employmentType === 'Agencja' || employmentType === 'DG';
      const firstName = empAbsences[0]?.first_name || emp?.first_name || 'Usunięty';
      const lastName = empAbsences[0]?.last_name || emp?.last_name || 'Pracownik';
      const isDeleted = empAbsences[0]?.is_deleted || !emp;
      
      // Filtruj tylko dni robocze (pon-pt, bez świąt) do frekwencji
      let presentDays = empAbsences.filter(a => {
        const date = new Date(a.date);
        return a.type === "present" && (a.working_hours > 0 || a.overtime_hours > 0) && isWorkingDay(date);
      }).length;
      // Nadgodziny tylko dla Etat (nie Agencja/DG)
      let overtime = isAgencyOrDG ? 0 : empAbsences.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
      // Godziny pracy: dla Agencja/DG doliczamy też nadgodziny
      let workingHours = empAbsences.reduce((sum, a) => {
        const wh = a.working_hours || 0;
        const oh = a.overtime_hours || 0;
        return sum + wh + (isAgencyOrDG ? oh : 0);
      }, 0);
      let vacationDays = empAbsences.filter(a => a.type === "vacation").length;
      let sickDays = empAbsences.filter(a => a.type === "sick").length;
      let unplannedDays = empAbsences.filter(a => a.type === "unplanned").length;
      let careDays = empAbsences.filter(a => a.type === "care").length;
      let bloodDays = empAbsences.filter(a => a.type === "blood").length;
      let unpaidDays = empAbsences.filter(a => a.type === "unpaid").length;
      let totalAbsenceDays = vacationDays + sickDays + unplannedDays + careDays + bloodDays + unpaidDays;
      
      // Count absences by day of week for recurring pattern detection
      const absencesByDayOfWeek: Record<number, number> = {};
      empAbsences.filter(a => a.type !== "present").forEach(a => {
        const dayOfWeek = new Date(a.date).getDay();
        absencesByDayOfWeek[dayOfWeek] = (absencesByDayOfWeek[dayOfWeek] || 0) + 1;
      });
      
      totalPresentDays += presentDays;
      totalWorkingHours += workingHours;
      hallStats.totalOvertime += overtime;
      
      return {
        id: empId,
        first_name: firstName,
        last_name: lastName,
        employment_type: employmentType,
        is_deleted: isDeleted,
        presentDays,
        overtime,
        workingHours,
        vacationDays,
        sickDays,
        unplannedDays,
        careDays,
        bloodDays,
        unpaidDays,
        totalAbsenceDays,
        absencesByDayOfWeek,
        score: presentDays + (overtime * 0.5)
      };
    });

    hallStats.frequency = totalBaseDays > 0 ? Math.round((totalPresentDays / totalBaseDays) * 100) : 0;
    hallStats.avgWorkingHours = empStats.length > 0 && totalPresentDays > 0 
      ? Math.round((totalWorkingHours / totalPresentDays) * 10) / 10 
      : 0;
    
    if (empStats.length > 0) {
      // Top 3 best employees (most engaged)
      hallStats.bestEmployees = [...empStats]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      
      // Top 3 worst employees (most absences - BEZ urlopu)
      const withNonVacationAbsences = empStats.map(emp => ({
        ...emp,
        nonVacationAbsences: emp.sickDays + emp.unplannedDays + 
          (emp.careDays || 0) + (emp.bloodDays || 0) + (emp.unpaidDays || 0)
      }));
      hallStats.worstEmployees = [...withNonVacationAbsences]
        .filter(emp => emp.nonVacationAbsences > 0)
        .sort((a, b) => b.nonVacationAbsences - a.nonVacationAbsences)
        .slice(0, 3);
      
      // Top 3 overtime leaders
      hallStats.overtimeLeaders = [...empStats]
        .filter(emp => emp.overtime > 0)
        .sort((a, b) => b.overtime - a.overtime)
        .slice(0, 3);
      
      // Recurring absences (same day of week 3+ times)
      const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
      empStats.forEach(emp => {
        Object.entries(emp.absencesByDayOfWeek).forEach(([day, countVal]) => {
          const count = countVal as number;
          if (count >= 3) {
            hallStats.recurringAbsences.push({
              employee: emp,
              dayName: dayNames[parseInt(day)],
              count
            });
          }
        });
      });
      
      // Vacation limit warnings (assuming 26 days limit, warning at 20+)
      const VACATION_LIMIT = 26;
      const WARNING_THRESHOLD = 20;
      empStats.forEach(emp => {
        if (emp.vacationDays >= WARNING_THRESHOLD) {
          hallStats.vacationLimitWarnings.push({
            employee: emp,
            used: emp.vacationDays,
            limit: VACATION_LIMIT
          });
        }
      });
    }
    
    // Critical days (days with lowest attendance on working days)
    const workingDaysData = hallDailyData.filter(d => {
      const date = new Date(d.fullDate);
      return isWorkingDay(date);
    });
    
    if (workingDaysData.length > 0) {
      const sortedByAttendance = [...workingDaysData].sort((a, b) => a.Obecni - b.Obecni);
      hallStats.criticalDays = sortedByAttendance.slice(0, 3).map(d => ({
        date: d.fullDate,
        present: d.Obecni,
        absent: d.Urlop + d.Chorobowe + d.Nieplanowane + d.Opieka + d.Krew + d.Bezpłatny
      }));
    }
    
    // Tomorrow's absences
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
    const tomorrowAbsenceRecords = hallAbsences.filter(a => a.date === tomorrowStr && a.type !== "present");
    hallStats.tomorrowAbsences = tomorrowAbsenceRecords.map(a => {
      // Używamy danych z absences (zawiera dane usuniętych pracowników)
      const emp = employees.find(e => e.id === a.employee_id);
      return { 
        ...a, 
        employee: emp || { 
          first_name: a.first_name || 'Usunięty', 
          last_name: a.last_name || 'Pracownik' 
        } 
      };
    });
    
    // Frequency trend (mock - would need previous month data for real calculation)
    // For now, we'll calculate based on first half vs second half of month
    const midMonth = Math.floor(workingDaysData.length / 2);
    if (midMonth > 0) {
      const firstHalf = workingDaysData.slice(0, midMonth);
      const secondHalf = workingDaysData.slice(midMonth);
      const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.Obecni, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, d) => sum + d.Obecni, 0) / secondHalf.length : firstHalfAvg;
      hallStats.frequencyTrend = Math.round(((secondHalfAvg - firstHalfAvg) / (firstHalfAvg || 1)) * 100);
    }
  }

  // Statystyki nadzoru (Mistrzowie, Brygadziści)
  const supervisors = employees.filter(e => e.is_supervisor);
  const supervisorAbsences = absences.filter(a => supervisorIds.has(a.employee_id));
  
  const supervisorStats = supervisors.map(sup => {
    const supAbsences = supervisorAbsences.filter(a => a.employee_id === sup.id);
    const presentDays = supAbsences.filter(a => {
      const date = new Date(a.date);
      return a.type === "present" && (a.working_hours > 0 || a.overtime_hours > 0) && isWorkingDay(date);
    }).length;
    const workingHours = supAbsences.reduce((sum, a) => sum + (a.working_hours || 0), 0);
    const overtimeHours = supAbsences.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
    const vacationDays = supAbsences.filter(a => a.type === "vacation").length;
    const sickDays = supAbsences.filter(a => a.type === "sick").length;
    
    return {
      id: sup.id,
      first_name: sup.first_name,
      last_name: sup.last_name,
      position: sup.position,
      hall_id: sup.hall_id,
      employee_number: sup.employee_number,
      presentDays,
      workingHours,
      overtimeHours,
      totalHours: workingHours + overtimeHours,
      vacationDays,
      sickDays,
      frequency: workingDaysInMonth > 0 ? Math.round((presentDays / workingDaysInMonth) * 100) : 0
    };
  });
  
  // Top 3 nadzoru po godzinach
  const topSupervisors = [...supervisorStats].sort((a, b) => b.totalHours - a.totalHours).slice(0, 3);

  // Dynamiczna lista kwalifikacji — zbierana ze wszystkich pracowników produkcyjnych
  const QUALIFICATIONS = (() => {
    const all = new Set<string>();
    productionEmployees.forEach(e => {
      (e.qualifications || '').split(',').map((s: string) => s.trim()).filter(Boolean).forEach((q: string) => all.add(q));
    });
    return Array.from(all).sort();
  })();

  // Statystyki kwalifikacji dla wybranej hali lub globalnie (karty)
  const qualStats = (() => {
    const relevantEmployees = selectedHallId === "global"
      ? productionEmployees
      : productionEmployees.filter(e => e.hall_id === selectedHallId);
    const relevantAbsences = selectedHallId === "global"
      ? absences.filter(a => !supervisorIds.has(a.employee_id))
      : absences.filter(a => a.hall_id === selectedHallId && !supervisorIds.has(a.employee_id));

    return QUALIFICATIONS.map(q => {
      const qConfig = qualificationsConfig.find((c: any) => c.name === q);
      const isDeduction = qConfig?.hours_mode === 'deduction';
      const empsWithQ = relevantEmployees.filter(e =>
        (e.qualifications || '').split(',').map((s: string) => s.trim()).includes(q)
      );
      const empIds = new Set(empsWithQ.map((e: any) => e.id));
      const qAbsences = relevantAbsences.filter(a => empIds.has(a.employee_id));
      const rawHours = qAbsences.reduce((sum, a) => sum + (a.working_hours || 0) + (a.overtime_hours || 0), 0);
      const presentDays = qAbsences.filter(a => a.type === 'present' && ((a.working_hours || 0) > 0 || (a.overtime_hours || 0) > 0)).length;
      const totalHours = isDeduction ? Math.max(0, rawHours - presentDays * 0.5) : rawHours;
      return { label: q, count: empsWithQ.length, totalHours, presentDays, isDeduction };
    }).filter(q => q.count > 0);
  })();

  // Jedna globalna paleta unikalnych kolorów — używana dla hal na WSZYSTKICH wykresach
  const HALL_PALETTE = [
    "#3b82f6", // niebieski
    "#10b981", // zielony
    "#f59e0b", // żółty
    "#ef4444", // czerwony
    "#8b5cf6", // fioletowy
    "#ec4899", // różowy
    "#06b6d4", // cyjan
    "#f97316", // pomarańczowy
    "#84cc16", // limonka
    "#0ea5e9", // błękitny
    "#a855f7", // purpurowy
    "#14b8a6", // turkusowy
  ];

  // Globalne statystyki kwalifikacji z podziałem na hale (wykres)
  const QUAL_COLORS = ["#14b8a6", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#f97316", "#06b6d4"];
  const globalQualChartData = QUALIFICATIONS.map((q, qi) => {
    const qConfig = qualificationsConfig.find((c: any) => c.name === q);
    const isDeduction = qConfig?.hours_mode === 'deduction';
    const row: any = { qualification: q, color: QUAL_COLORS[qi % QUAL_COLORS.length], isDeduction };
    let totalCount = 0;
    let totalHours = 0;
    halls.forEach(hall => {
      const hallEmps = productionEmployees.filter(e =>
        e.hall_id === hall.id &&
        (e.qualifications || '').split(',').map((s: string) => s.trim()).includes(q)
      );
      const empIds = new Set(hallEmps.map((e: any) => e.id));
      const hallAbsForQ = absences.filter(a => a.hall_id === hall.id && empIds.has(a.employee_id) && !supervisorIds.has(a.employee_id));
      const rawHours = hallAbsForQ.reduce((sum, a) => sum + (a.working_hours || 0) + (a.overtime_hours || 0), 0);
      const presentDays = hallAbsForQ.filter(a => a.type === 'present' && ((a.working_hours || 0) > 0 || (a.overtime_hours || 0) > 0)).length;
      const hours = isDeduction ? Math.max(0, rawHours - presentDays * 0.5) : rawHours;
      row[hall.name] = hours;
      row[`${hall.name}_count`] = hallEmps.length;
      totalCount += hallEmps.length;
      totalHours += hours;
    });
    row.totalCount = totalCount;
    row.totalHours = totalHours;
    return row;
  }).filter(r => r.totalCount > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-medium text-gray-800">Dashboard</h3>
          <select 
            value={selectedHallId} 
            onChange={e => setSelectedHallId(e.target.value === "global" ? "global" : parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 font-medium"
          >
            <option value="global">Globalnie (Wszystkie Hale)</option>
            {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <input 
          type="month" 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      {selectedHallId === "global" ? (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h4 className="text-base font-medium text-gray-700 mb-4">Stan Osobowy - Globalnie ({format(new Date(selectedMonth), "MM.yyyy")})</h4>
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div style={{ minWidth: '1000px', height: '500px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={globalDailyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                    <XAxis 
                      dataKey="date" 
                      interval={0} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 12, fontWeight: 'bold', fill: '#475569'}} 
                      angle={-45} 
                      textAnchor="end" 
                      height={80} 
                    />
                    <YAxis tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      const getPlural = (n: number) => {
                        if (n === 1) return 'osoba';
                        const lastDigit = n % 10;
                        const lastTwoDigits = n % 100;
                        if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'osoby';
                        return 'osób';
                      };
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 border border-gray-200 shadow-xl rounded-xl">
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
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Obecni" stackId="a" fill="#10b981" name="Obecni">
                    <LabelList dataKey="Obecni" position="center" fill="#fff" fontSize={14} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="Urlop" stackId="a" fill="#3b82f6" name="Urlop (UW)">
                    <LabelList dataKey="Urlop" position="center" fill="#fff" fontSize={14} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="Chorobowe" stackId="a" fill="#ef4444" name="Chorobowe (CH)">
                    <LabelList dataKey="Chorobowe" position="center" fill="#fff" fontSize={14} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="Nieplanowane" stackId="a" fill="#f59e0b" name="Nieplanowane (NŻ)">
                    <LabelList dataKey="Nieplanowane" position="center" fill="#fff" fontSize={14} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="Opieka" stackId="a" fill="#14b8a6" name="Opieka (OP)">
                    <LabelList dataKey="Opieka" position="center" fill="#fff" fontSize={14} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="Krew" stackId="a" fill="#f43f5e" name="Krew (KR)">
                    <LabelList dataKey="Krew" position="center" fill="#fff" fontSize={14} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="Bezpłatny" stackId="a" fill="#9ca3af" name="Bezpłatny (BL)">
                    <LabelList dataKey="Bezpłatny" position="center" fill="#fff" fontSize={14} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h4 className="text-base font-medium text-gray-700 mb-4">Godziny Pracy - Globalnie (z podziałem na hale)</h4>
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div style={{ minWidth: '1500px', height: '480px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={globalDailyData} margin={{ top: 40, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                    <XAxis dataKey="date" interval={0} tick={{fontSize: 12, fontWeight: 'bold', fill: '#475569'}} angle={-45} textAnchor="end" height={80} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} label={{ value: 'Suma godzin', angle: -90, position: 'insideLeft', offset: -10, style: { fontSize: 13, fontWeight: 'medium', fill: '#64748b' } }} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload, label }) => {
                        const getPlural = (n: number) => {
                          if (n === 1) return 'osoba';
                          const lastDigit = n % 10;
                          const lastTwoDigits = n % 100;
                          if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'osoby';
                          return 'osób';
                        };
                        if (active && payload && payload.length) {
                          // Oblicz sumę łączną ze wszystkich hal
                          const totalHours = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
                          const totalPeople = payload.reduce((sum: number, entry: any) => {
                            const countKey = `${entry.dataKey}_count`;
                            return sum + (entry.payload[countKey] || 0);
                          }, 0);
                          
                          return (
                            <div className="bg-white p-4 border border-gray-200 shadow-xl rounded-xl min-w-[200px]">
                              <p className="text-sm font-bold text-gray-800 mb-2 border-b border-gray-100 pb-2">Dzień: {label}</p>
                              <div className="space-y-2">
                                {payload.map((entry: any, idx: number) => {
                                  const countKey = `${entry.dataKey}_count`;
                                  const count = entry.payload[countKey] || 0;
                                  return (
                                    <div key={idx} className="flex flex-col">
                                      <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                                          <span className="text-xs font-bold text-gray-700">{entry.name}:</span>
                                        </div>
                                        <span className="text-xs font-black text-blue-600">{entry.value}h</span>
                                      </div>
                                      <div className="flex items-center gap-1 mt-0.5 ml-5">
                                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Obecni: {count} {getPlural(count)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Podsumowanie łączne */}
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-gray-800">RAZEM:</span>
                                  <span className="text-sm font-black text-purple-600">{totalHours}h</span>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[10px] text-gray-500 uppercase">Łącznie obecni:</span>
                                  <span className="text-xs font-bold text-emerald-600">{totalPeople} {getPlural(totalPeople)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 30 }} />
                    {halls.map((hall, index) => {
                      const color = HALL_PALETTE[index % HALL_PALETTE.length];
                      const isLastHall = index === halls.length - 1;
                      return (
                        <Bar 
                          key={hall.id} 
                          dataKey={hall.name} 
                          stackId="hours"
                          fill={color} 
                          name={hall.name}
                          radius={isLastHall ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        >
                          <LabelList 
                            dataKey={`${hall.name}_count`}
                            position="center" 
                            fill="#fff" 
                            fontSize={11} 
                            fontWeight="bold"
                            formatter={(val: number) => val > 0 ? val : ''}
                          />
                        </Bar>
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Nowy wykres - Suma godzin dziennie */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h4 className="text-base font-medium text-gray-700 mb-4">Suma Godzin Dziennie - Wszystkie Hale ({format(new Date(selectedMonth), "MM.yyyy")})</h4>
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div style={{ minWidth: '1200px', height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={globalDailyData.map(day => ({
                      ...day,
                      SumaGodzin: halls.reduce((sum, hall) => sum + (day[hall.name] || 0), 0),
                      SumaOsob: halls.reduce((sum, hall) => sum + (day[`${hall.name}_count`] || 0), 0)
                    }))} 
                    margin={{ top: 30, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      interval={0} 
                      tick={{fontSize: 12, fontWeight: 'bold', fill: '#475569'}} 
                      axisLine={false} 
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{fontSize: 11, fill: '#64748b'}} 
                      axisLine={false} 
                      tickLine={false}
                      label={{ value: 'Godziny', angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: 12, fill: '#64748b' } }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 shadow-xl rounded-xl">
                              <p className="text-sm font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1">Dzień: {label}</p>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs font-medium text-gray-600">Suma godzin:</span>
                                  <span className="text-sm font-black text-blue-600">{data.SumaGodzin}h</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs font-medium text-gray-600">Obecnych osób:</span>
                                  <span className="text-sm font-bold text-emerald-600">{data.SumaOsob}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="SumaGodzin" 
                      fill="#6366f1" 
                      radius={[4, 4, 0, 0]}
                      name="Suma godzin"
                    >
                      <LabelList 
                        dataKey="SumaGodzin" 
                        position="top" 
                        fill="#4f46e5" 
                        fontSize={11} 
                        fontWeight="bold"
                        formatter={(val: number) => val > 0 ? `${val}h` : ''}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-base font-medium text-gray-700 mb-4">Frekwencja wg Hal (%)</h4>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={globalHallStats} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip cursor={{ fill: '#f9fafb' }} />
                    <Bar dataKey="Frekwencja" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="Frekwencja" position="top" fill="#3b82f6" fontSize={14} fontWeight="bold" formatter={(val: number) => `${val}%`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-base font-medium text-gray-700 mb-4">Suma Nadgodzin wg Hal</h4>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={globalHallStats} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip cursor={{ fill: '#f9fafb' }} />
                    <Bar dataKey="Nadgodziny" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="Nadgodziny" position="top" fill="#8b5cf6" fontSize={14} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Wykresy kwalifikacji — osobna karta per kwalifikacja */}
          {globalQualChartData.length > 0 && (() => {
            const hallColors = HALL_PALETTE;
            const monthLabel = format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: pl });
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                  <h4 className="text-base font-semibold text-gray-700">Statystyki Kwalifikacji — {monthLabel}</h4>
                </div>
                <div className={`grid gap-4 ${globalQualChartData.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                  {globalQualChartData.map((q, qi) => {
                    const qColor = QUAL_COLORS[qi % QUAL_COLORS.length];
                    // Dane wykresu: jedna pozycja per hala
                    const chartRows = halls
                      .map(hall => ({
                        hall: hall.name,
                        Godziny: q[hall.name] || 0,
                        Pracownicy: q[`${hall.name}_count`] || 0,
                      }))
                      .filter(r => r.Pracownicy > 0);
                    return (
                      <div key={q.qualification} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Nagłówek karty */}
                        <div className="px-5 pt-5 pb-3 border-b border-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: qColor }}></span>
                            <h5 className="text-sm font-bold text-gray-800">{q.qualification}</h5>
                            {q.isDeduction && (
                              <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">-0.5h/dzień</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">{monthLabel}</span>
                        </div>
                        {/* Statystyki sumaryczne */}
                        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                          <div className="px-4 py-3 text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Pracownicy</p>
                            <p className="text-xl font-black" style={{ color: qColor }}>{q.totalCount}</p>
                          </div>
                          <div className="px-4 py-3 text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Godziny łącznie</p>
                            <p className="text-xl font-black" style={{ color: qColor }}>{q.totalHours}h</p>
                          </div>
                          <div className="px-4 py-3 text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Śr. / osoba</p>
                            <p className="text-xl font-black" style={{ color: qColor }}>{q.totalCount > 0 ? Math.round(q.totalHours / q.totalCount) : 0}h</p>
                          </div>
                        </div>
                        {/* Wykres: hale na osi X */}
                        {chartRows.length > 0 ? (
                          <div className="px-4 pt-4 pb-3" style={{ height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartRows} margin={{ top: 15, right: 10, left: -20, bottom: 5 }} barCategoryGap="35%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="hall" tick={{ fontSize: 12, fontWeight: 'bold', fill: '#475569' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                  cursor={{ fill: '#f8fafc' }}
                                  content={({ active, payload, label }) => {
                                    if (!active || !payload?.length) return null;
                                    const row = payload[0]?.payload;
                                    return (
                                      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
                                        <p className="text-xs font-bold text-gray-700 mb-1">{label}</p>
                                        <p className="text-xs" style={{ color: qColor }}><span className="font-semibold">Godziny:</span> {row.Godziny}h{q.isDeduction ? ' (po potrąceniu)' : ''}</p>
                                        <p className="text-xs text-gray-500"><span className="font-semibold">Pracownicy:</span> {row.Pracownicy}</p>
                                        <p className="text-xs text-gray-400">Śr: {row.Pracownicy > 0 ? Math.round(row.Godziny / row.Pracownicy) : 0}h/os.</p>
                                      </div>
                                    );
                                  }}
                                />
                                <Bar dataKey="Godziny" fill={qColor} radius={[6, 6, 0, 0]}>
                                  <LabelList dataKey="Godziny" position="top" fill={qColor} fontSize={11} fontWeight="bold" formatter={(v: number) => v > 0 ? `${v}h` : ''} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-24 text-xs text-gray-400">Brak danych</div>
                        )}
                        {/* Legenda z podziałem na hale */}
                        <div className="px-5 pb-4 flex flex-wrap gap-2">
                          {chartRows.map((r, hi) => (
                            <div key={r.hall} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: hallColors[hi % hallColors.length] }}></div>
                              <span className="text-[11px] text-gray-600 font-medium">{r.hall}: {r.Godziny}h / {r.Pracownicy} os.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hall Stats Summary - Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Frekwencja */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative">
              <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 font-medium mb-1">Średnia Frekwencja</p>
              <p className="text-2xl font-bold text-blue-600">{hallStats.frequency}%</p>
            </div>

            {/* Suma nadgodzin */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative">
              <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center text-purple-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 font-medium mb-1">Suma Nadgodzin Hali</p>
              <p className="text-2xl font-bold text-purple-600">{hallStats.totalOvertime}h</p>
            </div>

            {/* Średni czas pracy */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative">
              <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 font-medium mb-1">Śr. Czas Pracy/Dzień</p>
              <p className="text-2xl font-bold text-cyan-600">{hallStats.avgWorkingHours}h</p>
            </div>

          </div>

          {/* Hall Stats Summary - Row 2: Employee Cards - Top 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top 3 Best Employees */}
            {hallStats.bestEmployees.length > 0 && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-xl shadow-sm border border-amber-100">
                <p className="text-xs text-amber-700 font-medium mb-3">⭐ Top 3 - Najbardziej Zaangażowani</p>
                <div className="space-y-3">
                  {hallStats.bestEmployees.map((emp, idx) => (
                    <div key={emp.id} className={`${idx > 0 ? 'pt-2 border-t border-amber-200' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-amber-600">{idx + 1}.</span>
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {emp.employee_number && <span className="text-sm font-bold text-gray-800 mr-1">{emp.employee_number}</span>}
                            {emp.last_name} {emp.first_name}
                          </p>
                          <p className="text-[10px] text-gray-500">{emp.position}</p>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-1 ml-5 text-[10px]">
                        <span><strong className="text-green-600">Obecność:</strong> {emp.presentDays}d</span>
                        <span><strong className="text-purple-600">Nadgodziny:</strong> {emp.overtime}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top 3 Overtime Leaders */}
            {hallStats.overtimeLeaders.length > 0 && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded-xl shadow-sm border border-purple-100">
                <p className="text-xs text-purple-700 font-medium mb-3">🏆 Top 3 - Liderzy Nadgodzin</p>
                <div className="space-y-3">
                  {hallStats.overtimeLeaders.map((emp, idx) => (
                    <div key={emp.id} className={`${idx > 0 ? 'pt-2 border-t border-purple-200' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-purple-600">{idx + 1}.</span>
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {emp.employee_number && <span className="text-sm font-bold text-gray-800 mr-1">{emp.employee_number}</span>}
                            {emp.last_name} {emp.first_name}
                          </p>
                          <p className="text-[10px] text-gray-500">{emp.position}</p>
                        </div>
                      </div>
                      <div className="mt-1 ml-5 text-[10px]">
                        <span className="font-bold text-purple-600">{emp.overtime}h nadgodzin</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top 3 Worst Employees (most absences - BEZ urlopu) */}
            {hallStats.worstEmployees.length > 0 && (
              <div className="bg-gradient-to-br from-red-50 to-rose-50 p-5 rounded-xl shadow-sm border border-red-100">
                <p className="text-xs text-red-700 font-medium mb-3">⚠️ Top 3 - Najczęściej Nieobecni (bez urlopu)</p>
                <div className="space-y-3">
                  {hallStats.worstEmployees.map((emp, idx) => (
                    <div key={emp.id} className={`${idx > 0 ? 'pt-2 border-t border-red-200' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-red-600">{idx + 1}.</span>
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {emp.employee_number && <span className="text-sm font-bold text-gray-800 mr-1">{emp.employee_number}</span>}
                            {emp.last_name} {emp.first_name}
                          </p>
                          <p className="text-[10px] text-gray-500">{emp.position}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-5 text-[10px]">
                        {emp.sickDays > 0 && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">L4: {emp.sickDays}d</span>}
                        {emp.unplannedDays > 0 && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">NŻ: {emp.unplannedDays}d</span>}
                        {emp.careDays > 0 && <span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">OP: {emp.careDays}d</span>}
                        {emp.bloodDays > 0 && <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded">KR: {emp.bloodDays}d</span>}
                        {emp.unpaidDays > 0 && <span className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">BL: {emp.unpaidDays}d</span>}
                        <span className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                          Σ {emp.nonVacationAbsences}d
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Kwalifikacje Section */}
          {qualStats.length > 0 && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                Statystyki Kwalifikacji — {format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: pl })}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qualStats.map((q, i) => {
                  const colors = [
                    { bg: "bg-teal-50", border: "border-teal-100", badge: "bg-teal-100 text-teal-700", num: "text-teal-700", icon: "text-teal-400", dot: "bg-teal-500" },
                    { bg: "bg-blue-50", border: "border-blue-100", badge: "bg-blue-100 text-blue-700", num: "text-blue-700", icon: "text-blue-400", dot: "bg-blue-500" },
                    { bg: "bg-violet-50", border: "border-violet-100", badge: "bg-violet-100 text-violet-700", num: "text-violet-700", icon: "text-violet-400", dot: "bg-violet-500" },
                  ];
                  const c = colors[i % colors.length];
                  return (
                    <div key={q.label} className={`${c.bg} p-5 rounded-xl border ${c.border}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.badge}`}>{q.label}</span>
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

          {/* Alerts Section */}
          {(hallStats.tomorrowAbsences.length > 0 || hallStats.recurringAbsences.length > 0 || hallStats.vacationLimitWarnings.length > 0) && (
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-5 rounded-xl shadow-sm border border-slate-200">
              <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-lg">🚨</span> Alerty i Ostrzeżenia
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tomorrow's absences */}
                {hallStats.tomorrowAbsences.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-orange-200">
                    <p className="text-xs font-bold text-orange-700 mb-2">📅 Braki kadrowe jutro ({hallStats.tomorrowAbsences.length})</p>
                    <div className="space-y-1">
                      {(expandedAlerts.tomorrow ? hallStats.tomorrowAbsences : hallStats.tomorrowAbsences.slice(0, 3)).map((a, i) => {
                        const hall = halls.find(h => h.id === a.employee?.hall_id);
                        return (
                          <p key={i} className="text-xs text-gray-700">
                            <span className="text-gray-400 font-mono">{a.employee?.employee_number || '-'}</span> {a.employee?.last_name} {a.employee?.first_name}
                            {hall && <span className="text-gray-400"> ({hall.name})</span>}
                            {' - '}<span className="font-medium">{
                              a.type === 'vacation' ? 'Urlop' : 
                              a.type === 'sick' ? 'Chorobowe' : 
                              a.type === 'unplanned' ? 'Nieplanowane' :
                              a.type === 'care' ? 'Opieka' :
                              a.type === 'blood' ? 'Krew' :
                              a.type === 'unpaid' ? 'Bezpłatny' : a.type
                            }</span>
                          </p>
                        );
                      })}
                      {hallStats.tomorrowAbsences.length > 3 && (
                        <button 
                          onClick={() => setExpandedAlerts(prev => ({...prev, tomorrow: !prev.tomorrow}))}
                          className="text-xs text-orange-600 hover:text-orange-800 font-medium mt-1 cursor-pointer"
                        >
                          {expandedAlerts.tomorrow ? '▲ Zwiń' : `▼ Pokaż więcej (+${hallStats.tomorrowAbsences.length - 3})`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Recurring absences */}
                {hallStats.recurringAbsences.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-yellow-200">
                    <p className="text-xs font-bold text-yellow-700 mb-2">🔄 Powtarzające się nieobecności ({hallStats.recurringAbsences.length})</p>
                    <div className="space-y-1">
                      {(expandedAlerts.recurring ? hallStats.recurringAbsences : hallStats.recurringAbsences.slice(0, 3)).map((r, i) => {
                        const hall = halls.find(h => h.id === r.employee?.hall_id);
                        return (
                          <p key={i} className="text-xs text-gray-700">
                            <span className="text-gray-400 font-mono">{r.employee?.employee_number || '-'}</span> {r.employee.last_name} {r.employee.first_name}
                            {hall && <span className="text-gray-400"> ({hall.name})</span>}
                            {' - '}<span className="font-medium">{r.count}x {r.dayName}</span>
                          </p>
                        );
                      })}
                      {hallStats.recurringAbsences.length > 3 && (
                        <button 
                          onClick={() => setExpandedAlerts(prev => ({...prev, recurring: !prev.recurring}))}
                          className="text-xs text-yellow-600 hover:text-yellow-800 font-medium mt-1 cursor-pointer"
                        >
                          {expandedAlerts.recurring ? '▲ Zwiń' : `▼ Pokaż więcej (+${hallStats.recurringAbsences.length - 3})`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Vacation limit warnings */}
                {hallStats.vacationLimitWarnings.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-blue-200">
                    <p className="text-xs font-bold text-blue-700 mb-2">🏖️ Limit urlopu ({hallStats.vacationLimitWarnings.length})</p>
                    <div className="space-y-1">
                      {(expandedAlerts.vacation ? hallStats.vacationLimitWarnings : hallStats.vacationLimitWarnings.slice(0, 3)).map((w, i) => {
                        const hall = halls.find(h => h.id === w.employee?.hall_id);
                        return (
                          <p key={i} className="text-xs text-gray-700">
                            <span className="text-gray-400 font-mono">{w.employee?.employee_number || '-'}</span> {w.employee.last_name} {w.employee.first_name}
                            {hall && <span className="text-gray-400"> ({hall.name})</span>}
                            {' - '}<span className="font-medium text-blue-600">{w.used}/{w.limit} dni</span>
                          </p>
                        );
                      })}
                      {hallStats.vacationLimitWarnings.length > 3 && (
                        <button 
                          onClick={() => setExpandedAlerts(prev => ({...prev, vacation: !prev.vacation}))}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1 cursor-pointer"
                        >
                          {expandedAlerts.vacation ? '▲ Zwiń' : `▼ Pokaż więcej (+${hallStats.vacationLimitWarnings.length - 3})`}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-base font-medium text-gray-700 mb-4">Godziny Pracy - Dziennie (Σ = godziny - 0.5h przerwy)</h4>
              <div className="overflow-x-auto custom-scrollbar">
                <div style={{ minWidth: '800px', height: '350px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hallDailyData} margin={{ top: 50, right: 10, left: -20, bottom: 5 }}>
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
                        <YAxis tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.25)]} />
                      <Tooltip 
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
                              <div className="bg-white p-2 border border-gray-200 shadow-sm rounded">
                                <p className="text-xs font-bold text-gray-600 mb-1">{label}</p>
                                <p className="text-xs text-sky-600 font-sans">Suma Godzin: <span className="font-bold underline">{data.Godziny}h</span></p>
                                <p className="text-xs text-emerald-600 font-sans">Pracownicy: <span className="font-bold underline">{data.Obecni} {getPlural(data.Obecni)}</span></p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="Godziny" fill="#0ea5e9" name="Suma Godzin (h)" radius={[4, 4, 0, 0]}>
                        <LabelList 
                          dataKey="Godziny" 
                          position="top" 
                          fill="#0ea5e9" 
                          fontSize={10} 
                          fontWeight="bold" 
                          angle={-90}
                          offset={15}
                          formatter={(val: any) => val > 0 ? `${val}h` : ''} 
                        />
                        <LabelList 
                          dataKey="Obecni" 
                          position="center" 
                          fill="#fff" 
                          fontSize={10} 
                          fontWeight="bold"
                          formatter={(val: any) => val > 0 ? val : ''}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-base font-medium text-gray-700 mb-4">Stan Osobowy - Dziennie</h4>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hallDailyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                    <XAxis dataKey="date" interval={0} tick={{fontSize: 10}} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{fontSize: 12}} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Obecni" stackId="a" fill="#10b981" name="Obecni">
                      <LabelList dataKey="Obecni" position="center" fill="#fff" fontSize={12} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Urlop" stackId="a" fill="#3b82f6" name="Urlop (UW)">
                      <LabelList dataKey="Urlop" position="center" fill="#fff" fontSize={12} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Chorobowe" stackId="a" fill="#ef4444" name="Chorobowe (CH)">
                      <LabelList dataKey="Chorobowe" position="center" fill="#fff" fontSize={12} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Nieplanowane" stackId="a" fill="#f59e0b" name="Nieplanowane (NŻ)">
                      <LabelList dataKey="Nieplanowane" position="center" fill="#fff" fontSize={12} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Opieka" stackId="a" fill="#14b8a6" name="Opieka (OP)">
                      <LabelList dataKey="Opieka" position="center" fill="#fff" fontSize={12} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Krew" stackId="a" fill="#f43f5e" name="Krew (KR)">
                      <LabelList dataKey="Krew" position="center" fill="#fff" fontSize={12} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar dataKey="Bezpłatny" stackId="a" fill="#9ca3af" name="Bezpłatny (BL)">
                      <LabelList dataKey="Bezpłatny" position="center" fill="#fff" fontSize={12} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-base font-medium text-gray-700 mb-4">Nadgodziny - Dziennie</h4>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hallDailyData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                    <XAxis dataKey="date" interval={0} tick={{fontSize: 10}} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{fontSize: 12}} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Nadgodziny" fill="#8b5cf6" name="Suma Nadgodzin (h)" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="Nadgodziny" position="top" fill="#8b5cf6" fontSize={12} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sekcja Nadzoru */}
      {supervisors.length > 0 && (
        <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-indigo-200">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h4 className="text-base font-medium text-indigo-800">Nadzór - Statystyki ({format(new Date(selectedMonth), "MM.yyyy")})</h4>
            <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">{supervisors.length} osób</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Top 3 Nadzoru */}
            <div className="bg-white p-4 rounded-lg border border-indigo-100">
              <h5 className="text-sm font-medium text-indigo-700 mb-3 flex items-center gap-2">
                <span className="text-lg">🏆</span> Top 3 Nadzoru
              </h5>
              {topSupervisors.length > 0 ? (
                <div className="space-y-2">
                  {topSupervisors.map((sup, i) => {
                    const hall = halls.find(h => h.id === sup.hall_id);
                    return (
                      <div key={sup.id} className="flex items-center justify-between p-2 bg-indigo-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className={`text-lg ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-600'}`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{sup.last_name} {sup.first_name}</p>
                            <p className="text-xs text-gray-500">{sup.position} • {hall?.name || '-'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-indigo-600">{sup.workingHours}h</span>
                          {sup.overtimeHours > 0 && (
                            <span className="text-xs text-purple-600 ml-1">+{sup.overtimeHours}h</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Brak danych</p>
              )}
            </div>

            {/* Frekwencja Nadzoru */}
            <div className="bg-white p-4 rounded-lg border border-indigo-100">
              <h5 className="text-sm font-medium text-indigo-700 mb-3 flex items-center gap-2">
                <span className="text-lg">📊</span> Frekwencja Nadzoru
              </h5>
              <div className="space-y-2">
                {supervisorStats.map(sup => {
                  const hall = halls.find(h => h.id === sup.hall_id);
                  return (
                    <div key={sup.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sup.last_name} {sup.first_name}</p>
                        <p className="text-xs text-gray-500">{hall?.name || '-'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${sup.frequency >= 80 ? 'bg-green-500' : sup.frequency >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, sup.frequency)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-700">{sup.frequency}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Nieobecności Nadzoru */}
            <div className="bg-white p-4 rounded-lg border border-indigo-100">
              <h5 className="text-sm font-medium text-indigo-700 mb-3 flex items-center gap-2">
                <span className="text-lg">📅</span> Nieobecności Nadzoru
              </h5>
              <div className="space-y-2">
                {supervisorStats.filter(s => s.vacationDays > 0 || s.sickDays > 0).length > 0 ? (
                  supervisorStats.filter(s => s.vacationDays > 0 || s.sickDays > 0).map(sup => (
                    <div key={sup.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <p className="text-sm font-medium text-gray-800">{sup.last_name} {sup.first_name}</p>
                      <div className="flex gap-2">
                        {sup.vacationDays > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">UW: {sup.vacationDays}</span>
                        )}
                        {sup.sickDays > 0 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">CH: {sup.sickDays}</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Brak nieobecności w tym miesiącu</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
