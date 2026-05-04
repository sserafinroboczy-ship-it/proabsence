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

  useEffect(() => {
    fetchApi("/api/halls").then(data => {
      const activeHalls = data.filter((h: any) => h.is_active);
      setHalls(activeHalls);
      // Pobierz pracowników i filtruj tylko tych z aktywnych hal
      const activeHallIds = activeHalls.map((h: any) => h.id);
      fetchApi("/api/employees").then(emps => {
        setEmployees(emps.filter((e: any) => activeHallIds.includes(e.hall_id)));
      });
    });
  }, []);

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
  }, [selectedMonth, halls]);

  // Generate days of the month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(new Date(selectedMonth)),
    end: endOfMonth(new Date(selectedMonth))
  });

  // Global Daily Data
  const globalDailyData = daysInMonth.map(day => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayAbsences = absences.filter(a => a.date === dateStr);
    
    // We need to count all employees. If they don't have an absence record, they are present.
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

    employees.forEach(emp => {
      const record = dayAbsences.find(a => a.employee_id === emp.id);
      if (!record) return; // Do not count if no record exists
      
      const type = record.type;
      const isPresent = type === "present" && (record.working_hours > 0 || record.overtime_hours > 0);
      
      if (isPresent) {
        present++;
        const hall = halls.find(h => h.id === emp.hall_id);
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

  // Global Hall Stats (Frequency & Overtime per hall)
  const workingDaysInMonth = daysInMonth.filter(isWorkingDay).length;

  const globalHallStats = halls.map(hall => {
    const hallEmployees = employees.filter(e => e.hall_id === hall.id);
    const hallAbsences = absences.filter(a => a.hall_id === hall.id);
    
    // Base is total number of employee-days in working days only
    let totalBaseDays = hallEmployees.length * workingDaysInMonth;
    let totalPresentDays = 0;
    let totalOvertime = 0;

    hallEmployees.forEach(emp => {
      const empAbsences = hallAbsences.filter(a => a.employee_id === emp.id);
      // Liczymy tylko dni robocze (pon-pt, bez świąt) do frekwencji
      let presentDays = empAbsences.filter(a => {
        const date = new Date(a.date);
        return a.type === "present" && (a.working_hours > 0 || a.overtime_hours > 0) && isWorkingDay(date);
      }).length;
      let overtime = empAbsences.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
      
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

  // Hall Specific Data
  const hallDailyData = selectedHallId !== "global" ? daysInMonth.map(day => {
    const dateStr = format(day, "yyyy-MM-dd");
    const hallEmployees = employees.filter(e => e.hall_id === selectedHallId);
    const dayAbsences = absences.filter(a => a.date === dateStr && a.hall_id === selectedHallId);
    
    let present = 0;
    let vacation = 0;
    let sick = 0;
    let unplanned = 0;
    let care = 0;
    let blood = 0;
    let unpaid = 0;
    let overtime = 0;
    let totalHours = 0;

    hallEmployees.forEach(emp => {
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
      
      if (record.overtime_hours) overtime += record.overtime_hours;
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
    bestEmployee: null as any,
    worstEmployee: null as any,
    overtimeLeader: null as any,
    totalOvertime: 0,
    frequencyTrend: 0,
    criticalDays: [] as { date: string; present: number; absent: number }[],
    avgWorkingHours: 0,
    tomorrowAbsences: [] as any[],
    recurringAbsences: [] as any[],
    vacationLimitWarnings: [] as any[]
  };
  
  if (selectedHallId !== "global") {
    const hallEmployees = employees.filter(e => e.hall_id === selectedHallId);
    const hallAbsences = absences.filter(a => a.hall_id === selectedHallId);
    
    let totalBaseDays = hallEmployees.length * workingDaysInMonth;
    let totalPresentDays = 0;
    let totalWorkingHours = 0;

    const empStats = hallEmployees.map(emp => {
      const empAbsences = hallAbsences.filter(a => a.employee_id === emp.id);
      // Filtruj tylko dni robocze (pon-pt, bez świąt) do frekwencji
      let presentDays = empAbsences.filter(a => {
        const date = new Date(a.date);
        return a.type === "present" && (a.working_hours > 0 || a.overtime_hours > 0) && isWorkingDay(date);
      }).length;
      let overtime = empAbsences.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
      let workingHours = empAbsences.reduce((sum, a) => sum + (a.working_hours || 0), 0);
      let vacationDays = empAbsences.filter(a => a.type === "vacation").length;
      let sickDays = empAbsences.filter(a => a.type === "sick").length;
      let unplannedDays = empAbsences.filter(a => a.type === "unplanned").length;
      let totalAbsenceDays = vacationDays + sickDays + unplannedDays;
      
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
        ...emp,
        presentDays,
        overtime,
        workingHours,
        vacationDays,
        sickDays,
        unplannedDays,
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
      // Best employee (most engaged)
      hallStats.bestEmployee = empStats.reduce((best, current) => (current.score > best.score ? current : best), empStats[0]);
      
      // Worst employee (most absences)
      const worstCandidate = empStats.reduce((worst, current) => 
        (current.totalAbsenceDays > worst.totalAbsenceDays ? current : worst), empStats[0]);
      if (worstCandidate.totalAbsenceDays > 0) {
        hallStats.worstEmployee = worstCandidate;
      }
      
      // Overtime leader
      const overtimeCandidate = empStats.reduce((leader, current) => 
        (current.overtime > leader.overtime ? current : leader), empStats[0]);
      if (overtimeCandidate.overtime > 0) {
        hallStats.overtimeLeader = overtimeCandidate;
      }
      
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
      const emp = hallEmployees.find(e => e.id === a.employee_id);
      return { ...a, employee: emp };
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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
              <div style={{ minWidth: '1500px', height: '550px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={globalDailyData} margin={{ top: 100, right: 30, left: 20, bottom: 20 }} barGap={3} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" interval={0} tick={{fontSize: 12, fontWeight: 'bold', fill: '#475569'}} angle={-45} textAnchor="end" height={80} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} label={{ value: 'Suma godzin', angle: -90, position: 'insideLeft', offset: -10, style: { fontSize: 13, fontWeight: 'medium', fill: '#64748b' } }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.6)]} />
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
                      const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
                      const color = colors[index % colors.length];
                      return (
                        <Bar 
                          key={hall.id} 
                          dataKey={hall.name} 
                          fill={color} 
                          name={hall.name}
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList 
                            dataKey={hall.name} 
                            position="top" 
                            content={(props: any) => {
                              const { x, y, width, value } = props;
                              if (!value || value === 0) return null;
                              return (
                                <text 
                                  x={x + width / 2} 
                                  y={y - 18} 
                                  fill={color} 
                                  textAnchor="middle" 
                                  fontSize={11} 
                                  fontWeight="black"
                                  transform={`rotate(-90, ${x + width / 2}, ${y - 18})`}
                                >
                                  {value}h
                                </text>
                              );
                            }}
                          />
                          <LabelList 
                            dataKey={`${hall.name}_count`}
                            position="center" 
                            fill="#fff" 
                            fontSize={11} 
                            fontWeight="black"
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-base font-medium text-gray-700 mb-4">Frekwencja wg Hal (%)</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={globalHallStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
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
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={globalHallStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
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
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hall Stats Summary - Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Frekwencja */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Średnia Frekwencja</p>
                <p className="text-2xl font-bold text-gray-800">{hallStats.frequency}%</p>
                {hallStats.frequencyTrend !== 0 && (
                  <p className={`text-xs font-medium mt-1 ${hallStats.frequencyTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {hallStats.frequencyTrend > 0 ? '↑' : '↓'} {Math.abs(hallStats.frequencyTrend)}% vs 1. połowa m-ca
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>

            {/* Suma nadgodzin */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Suma Nadgodzin Hali</p>
                <p className="text-2xl font-bold text-purple-600">{hallStats.totalOvertime}h</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Średni czas pracy */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Śr. Czas Pracy/Dzień</p>
                <p className="text-2xl font-bold text-cyan-600">{hallStats.avgWorkingHours}h</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>

            {/* Dni krytyczne */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-2">Dni Krytyczne (najniższa obsada)</p>
              {hallStats.criticalDays.length > 0 ? (
                <div className="space-y-1">
                  {hallStats.criticalDays.slice(0, 2).map((d, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-600">{format(new Date(d.date), "dd.MM")}</span>
                      <span className="font-medium">
                        <span className="text-green-600">{d.present} ob.</span> / <span className="text-red-600">{d.absent} nb.</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Brak danych</p>
              )}
            </div>
          </div>

          {/* Hall Stats Summary - Row 2: Employee Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Best Employee */}
            {hallStats.bestEmployee && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-xl shadow-sm border border-amber-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-amber-700 font-medium mb-1">⭐ Najbardziej Zaangażowany</p>
                    <p className="text-lg font-bold text-gray-800">{hallStats.bestEmployee.first_name} {hallStats.bestEmployee.last_name}</p>
                    <p className="text-xs text-gray-600">{hallStats.bestEmployee.position}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                      <span><strong className="text-green-600">Obecność:</strong> {hallStats.bestEmployee.presentDays} dni</span>
                      <span><strong className="text-purple-600">Nadgodziny:</strong> {hallStats.bestEmployee.overtime}h</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Overtime Leader */}
            {hallStats.overtimeLeader && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded-xl shadow-sm border border-purple-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-purple-700 font-medium mb-1">🏆 Lider Nadgodzin</p>
                    <p className="text-lg font-bold text-gray-800">{hallStats.overtimeLeader.first_name} {hallStats.overtimeLeader.last_name}</p>
                    <p className="text-xs text-gray-600">{hallStats.overtimeLeader.position}</p>
                    <div className="mt-2 text-xs">
                      <span className="font-bold text-purple-600">{hallStats.overtimeLeader.overtime}h nadgodzin</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Worst Employee (most absences) */}
            {hallStats.worstEmployee && (
              <div className="bg-gradient-to-br from-red-50 to-rose-50 p-5 rounded-xl shadow-sm border border-red-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-red-700 font-medium mb-1">⚠️ Najczęściej Nieobecny</p>
                    <p className="text-lg font-bold text-gray-800">{hallStats.worstEmployee.first_name} {hallStats.worstEmployee.last_name}</p>
                    <p className="text-xs text-gray-600">{hallStats.worstEmployee.position}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                      {hallStats.worstEmployee.vacationDays > 0 && <span><strong className="text-blue-600">Urlop:</strong> {hallStats.worstEmployee.vacationDays}d</span>}
                      {hallStats.worstEmployee.sickDays > 0 && <span><strong className="text-red-600">L4:</strong> {hallStats.worstEmployee.sickDays}d</span>}
                      {hallStats.worstEmployee.unplannedDays > 0 && <span><strong className="text-orange-600">NŻ:</strong> {hallStats.worstEmployee.unplannedDays}d</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

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
                    <p className="text-xs font-bold text-orange-700 mb-2">📅 Braki kadrowe jutro</p>
                    <div className="space-y-1">
                      {hallStats.tomorrowAbsences.slice(0, 3).map((a, i) => (
                        <p key={i} className="text-xs text-gray-700">
                          {a.employee?.first_name} {a.employee?.last_name} - <span className="font-medium">{a.type === 'vacation' ? 'Urlop' : a.type === 'sick' ? 'L4' : a.type}</span>
                        </p>
                      ))}
                      {hallStats.tomorrowAbsences.length > 3 && (
                        <p className="text-xs text-gray-500">+{hallStats.tomorrowAbsences.length - 3} więcej...</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Recurring absences */}
                {hallStats.recurringAbsences.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-yellow-200">
                    <p className="text-xs font-bold text-yellow-700 mb-2">🔄 Powtarzające się nieobecności</p>
                    <div className="space-y-1">
                      {hallStats.recurringAbsences.slice(0, 3).map((r, i) => (
                        <p key={i} className="text-xs text-gray-700">
                          {r.employee.first_name} {r.employee.last_name} - <span className="font-medium">{r.count}x {r.dayName}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vacation limit warnings */}
                {hallStats.vacationLimitWarnings.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-blue-200">
                    <p className="text-xs font-bold text-blue-700 mb-2">🏖️ Limit urlopu</p>
                    <div className="space-y-1">
                      {hallStats.vacationLimitWarnings.slice(0, 3).map((w, i) => (
                        <p key={i} className="text-xs text-gray-700">
                          {w.employee.first_name} {w.employee.last_name} - <span className="font-medium text-blue-600">{w.used}/{w.limit} dni</span>
                        </p>
                      ))}
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
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                  <BarChart data={hallDailyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" interval={0} tick={{fontSize: 10}} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{fontSize: 12}} />
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
    </div>
  );
}
