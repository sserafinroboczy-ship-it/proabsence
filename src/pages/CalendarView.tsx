import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";
import { fetchApi } from "../lib/api";
import { FileText, X, Trash2 } from "lucide-react";
import { diffWords } from "diff";

// Obliczanie daty Wielkanocy (algorytm Gaussa)
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
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};

// Wszystkie polskie święta ustawowo wolne od pracy
const getHolidays = (year: number): { date: Date; name: string }[] => {
  const easter = getEasterDate(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60); // Boże Ciało - 60 dni po Wielkanocy
  const pentecost = new Date(easter);
  pentecost.setDate(easter.getDate() + 49); // Zielone Świątki - 49 dni po Wielkanocy

  return [
    { date: new Date(year, 0, 1), name: "Nowy Rok" },
    { date: new Date(year, 0, 6), name: "Trzech Króli" },
    { date: easter, name: "Wielkanoc" },
    { date: easterMonday, name: "Poniedziałek Wielkanocny" },
    { date: new Date(year, 4, 1), name: "Święto Pracy" },
    { date: new Date(year, 4, 3), name: "Święto Konstytucji" },
    { date: pentecost, name: "Zielone Świątki" },
    { date: corpusChristi, name: "Boże Ciało" },
    { date: new Date(year, 7, 15), name: "Wniebowzięcie NMP" },
    { date: new Date(year, 10, 1), name: "Wszystkich Świętych" },
    { date: new Date(year, 10, 11), name: "Święto Niepodległości" },
    { date: new Date(year, 11, 25), name: "Boże Narodzenie" },
    { date: new Date(year, 11, 26), name: "Drugi dzień Świąt" },
  ];
};

export default function CalendarView({ user }: { user: any }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [notes, setNotes] = useState<any[]>([]);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [hoveredNote, setHoveredNote] = useState<any | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  
  const isAdmin = user?.role === "admin";

  const loadNotes = async () => {
    try {
      const monthStr = format(currentMonth, "yyyy-MM");
      const data = await fetchApi(`/api/calendar/notes?month=${monthStr}`);
      setNotes(data);
    } catch (err) {
      console.error("Failed to load notes", err);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [currentMonth]);

  const handleSaveNote = async () => {
    if (!editingDate) return;
    try {
      await fetchApi("/api/calendar/notes", {
        method: "POST",
        body: JSON.stringify({
          date: format(editingDate, "yyyy-MM-dd"),
          content: noteContent
        })
      });
      setEditingDate(null);
      loadNotes();
    } catch (err) {
      console.error("Failed to save note", err);
    }
  };

  const markAsRead = async (note: any) => {
    if (!note || !note.is_unread) return;
    try {
      await fetchApi(`/api/calendar/notes/${note.id}/read`, { method: "POST" });
      // Update local state to reflect it's read
      setNotes(notes.map(n => n.id === note.id ? { ...n, is_unread: 0 } : n));
      // Dispatch event to update sidebar badge
      window.dispatchEvent(new Event("note-read"));
    } catch (err) {
      console.error("Failed to mark note as read", err);
    }
  };

  const openNoteEditor = (day: Date, existingNote: any) => {
    if (existingNote) markAsRead(existingNote);
    setEditingDate(day);
    setNoteContent(existingNote ? existingNote.content : "");
    setEditingNoteId(existingNote ? existingNote.id : null);
  };

  const handleDeleteNote = async () => {
    if (!editingNoteId) return;
    if (!confirm("Czy na pewno chcesz usunąć tę notatkę?")) return;
    
    try {
      await fetchApi(`/api/calendar/notes/${editingNoteId}`, { method: "DELETE" });
      setEditingDate(null);
      setEditingNoteId(null);
      loadNotes();
    } catch (err: any) {
      alert(err.message || "Błąd podczas usuwania notatki");
    }
  };

  const renderDiff = (oldText: string, newText: string) => {
    const differences = diffWords(oldText, newText);
    return (
      <>
        {differences.map((part, index) => {
          if (part.added) {
            return <span key={index} className="text-green-400 bg-green-400/10 px-0.5 rounded">{part.value}</span>;
          }
          if (part.removed) {
            return <span key={index} className="text-red-400 bg-red-400/10 line-through px-0.5 rounded">{part.value}</span>;
          }
          return <span key={index} className="text-slate-300">{part.value}</span>;
        })}
      </>
    );
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const holidays = getHolidays(currentMonth.getFullYear());

  const isHoliday = (date: Date) => holidays.some(h => isSameDay(h.date, date));
  const getHolidayName = (date: Date) => holidays.find(h => isSameDay(h.date, date))?.name;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold capitalize">
          {format(currentMonth, "LLLL yyyy", { locale: pl })}
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Poprzedni
          </button>
          <button 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Następny
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Pon", "Wto", "Śro", "Czw", "Pią", "Sob", "Nie"].map((day, idx) => (
          <div key={day} className={`text-center font-semibold py-3 rounded-lg ${idx >= 5 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
            {day}
          </div>
        ))}
        
        {/* Puste dni na początku miesiąca */}
        {Array.from({ length: (startOfMonth(currentMonth).getDay() + 6) % 7 }).map((_, i) => (
          <div key={`empty-${i}`} className="p-4 bg-gray-50 rounded-lg border border-gray-100" />
        ))}

        {days.map(day => {
          const weekend = isWeekend(day);
          const holiday = isHoliday(day);
          const holidayName = getHolidayName(day);
          const isOffDay = weekend || holiday;
          const dateStr = format(day, "yyyy-MM-dd");
          const note = notes.find(n => n.date === dateStr);

          return (
            <div 
              key={day.toISOString()} 
              className={`min-h-28 p-2 border-2 rounded-lg relative group transition-all cursor-pointer shadow-sm hover:shadow-md ${
                holiday 
                  ? 'bg-red-100 border-red-300 hover:bg-red-150' 
                  : weekend 
                    ? 'bg-red-50 border-red-200 hover:bg-red-100' 
                    : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300'
              } ${note?.is_unread ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
              onClick={() => openNoteEditor(day, note)}
              onMouseEnter={() => {
                if (note) {
                  setHoveredNote(note);
                  markAsRead(note);
                }
              }}
              onMouseLeave={() => setHoveredNote(null)}
            >
              <div className={`text-right text-lg font-bold ${holiday ? 'text-red-700' : weekend ? 'text-red-500' : 'text-gray-700'}`}>
                {format(day, "d")}
              </div>
              {holiday && <div className="text-xs text-red-700 mt-1 font-semibold bg-red-200 px-1.5 py-0.5 rounded inline-block">{holidayName}</div>}
              {weekend && !holiday && <div className="text-xs text-red-500 mt-1 font-medium">Weekend</div>}
              
              {note && note.content && (
                <div className={`mt-2 text-xs text-gray-600 p-1.5 rounded border line-clamp-2 ${note.is_unread ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-100'}`}>
                  <div className={`flex items-center gap-1 mb-0.5 font-medium ${note.is_unread ? 'text-blue-700' : 'text-yellow-700'}`}>
                    <FileText size={12} /> {note.is_unread ? 'Nowa Notatka' : 'Notatka'}
                  </div>
                  {note.content}
                </div>
              )}

              {/* Tooltip with history */}
              {hoveredNote && hoveredNote.id === note?.id && note.history && note.history.length > 0 && (
                <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-slate-800 text-white text-xs rounded-lg shadow-xl p-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="font-semibold mb-2 text-slate-200 border-b border-slate-700 pb-1">Historia zmian (ostatnie 3):</div>
                  <div className="space-y-3">
                    {note.history.slice(0, 3).map((h: any, index: number) => {
                      const oldText = index < note.history.length - 1 ? note.history[index + 1].content : "";
                      return (
                        <div key={h.id} className="flex flex-col">
                          <span className="text-slate-400 text-[10px] mb-0.5">{new Date(h.changed_at).toLocaleString("pl-PL")} - {h.username || 'Nieznany'}</span>
                          <div className="text-sm break-words whitespace-pre-wrap leading-relaxed">
                            {renderDiff(oldText, h.content)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Note Editor Modal */}
      {editingDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-800">
                Notatka - {format(editingDate, "dd MMMM yyyy", { locale: pl })}
              </h3>
              <button onClick={() => setEditingDate(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Wpisz notatkę dla tego dnia..."
                className="w-full h-32 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between">
              {/* Przycisk usuwania - tylko dla admina i gdy notatka istnieje */}
              {isAdmin && editingNoteId ? (
                <button
                  onClick={handleDeleteNote}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Usuń notatkę
                </button>
              ) : (
                <div></div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingDate(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Zapisz notatkę
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
