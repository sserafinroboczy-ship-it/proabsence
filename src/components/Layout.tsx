import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, LogOut, ClipboardList, Info } from "lucide-react";
import { clsx } from "clsx";
import { fetchApi } from "../lib/api";

export default function Layout({ user, onLogout, onShowAbout }: { user: any; onLogout: () => void; onShowAbout: () => void }) {
  const location = useLocation();
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const data = await fetchApi("/api/calendar/unread-count");
      setUnreadNotesCount(data.count);
    } catch (err) {
      console.error("Failed to fetch unread count", err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    
    // Listen for custom event when a note is read
    const handleNoteRead = () => {
      fetchUnreadCount();
    };
    window.addEventListener("note-read", handleNoteRead);
    
    // Also poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    
    return () => {
      window.removeEventListener("note-read", handleNoteRead);
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard, hidden: user.role !== "admin" },
    { name: "Wprowadzanie Danych", path: "/foreman", icon: ClipboardList, hidden: user.role === "guest" },
    { name: "Kalendarz", path: "/calendar", icon: Calendar },
    { name: "Panel Admina", path: "/admin", icon: Users, hidden: user.role !== "admin" },
  ].filter((item) => !item.hidden);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-blue-400" size={28} />
            <h1 className="text-2xl font-bold text-blue-400">ProAbsence</h1>
          </div>
          <p className="text-slate-400 text-sm mt-2">Zarządzanie Produkcją</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  "flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                  isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} />
                  {item.name}
                </div>
                {item.path === "/calendar" && unreadNotesCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadNotesCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          {/* Logo firmy - wgraj plik do public/logo.png */}
          <div className="mb-4 px-2 flex justify-center">
            <img 
              src="/logo.png" 
              alt="Logo firmy" 
              className="h-24 w-full object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div className="mb-3 px-4">
            <p className="text-sm text-slate-400">Zalogowano jako:</p>
            <p className="font-medium truncate">{user.username} ({
              { admin: "Administrator", foreman: "Brygadzista", mistrz: "Mistrz", guest: "Gość" }[user.role] || user.role
            })</p>
          </div>
          <div className="mb-3 px-4 text-center">
            <p className="text-xs text-slate-300 font-medium bg-slate-800 py-1 px-3 rounded-full inline-block">Wersja 1.0.0</p>
          </div>
          <button
            onClick={onShowAbout}
            className="flex items-center gap-3 px-4 py-2 w-full rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm"
          >
            <Info size={18} />
            O aplikacji
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut size={20} />
            Wyloguj
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            {navItems.find((i) => i.path === location.pathname)?.name || "ProAbsence"}
          </h2>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
