import React, { useState } from "react";
import { fetchApi } from "../lib/api";
import { ClipboardList, Info, BarChart2, Users, Calendar } from "lucide-react";

export default function Login({ onLogin, onShowAbout }: { onLogin: (user: any) => void, onShowAbout: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tempUser, setTempUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    
    try {
      const data = await fetchApi("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: trimmedUsername, password: trimmedPassword }),
      });
      localStorage.setItem("token", data.token);
      
      if (data.user.force_password_change) {
        setNeedsPasswordChange(true);
        setTempUser(data.user);
      } else {
        onLogin(data.user);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (newPassword !== confirmPassword) {
      return setError("Hasła nie pasują do siebie");
    }
    if (newPassword.length < 6) {
      return setError("Hasło musi mieć co najmniej 6 znaków");
    }

    try {
      await fetchApi("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      // Update tempUser to not need password change anymore
      onLogin({ ...tempUser, force_password_change: 0 });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Pattern / Graphics */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center">
        <div className="grid grid-cols-3 gap-16 transform -rotate-12 scale-150">
          <BarChart2 size={200} className="text-blue-500" />
          <Users size={200} className="text-emerald-500" />
          <Calendar size={200} className="text-purple-500" />
          <Calendar size={200} className="text-amber-500" />
          <BarChart2 size={200} className="text-rose-500" />
          <Users size={200} className="text-cyan-500" />
        </div>
      </div>

      <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 z-10 border border-white/20">
        <div className="text-center mb-8">
          {/* Logo firmy - wgraj plik do public/logo.png */}
          <div className="mb-4">
            <img 
              src="/logo.png" 
              alt="Logo firmy" 
              className="h-16 mx-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-600/20">
              <ClipboardList className="text-white" size={32} />
            </div>
            <h1 className="text-4xl font-bold text-blue-600 tracking-tight">ProAbsence</h1>
          </div>
          <p className="text-slate-500 font-medium">Zarządzanie Produkcją i Absencjami</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg mb-6 text-sm font-medium">
            {error}
          </div>
        )}

        {!needsPasswordChange ? (
          <>
            <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nazwa użytkownika</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-2">Hasło</label>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Ukryj" : "Pokaż"}
              </button>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-lg shadow-blue-600/20"
            >
              Zaloguj się
            </button>
          </form>
          </>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mb-6 text-sm">
              <strong>Wymagana zmiana hasła!</strong><br/>
              Logujesz się po raz pierwszy lub administrator zresetował Twoje hasło. Ustaw nowe hasło, aby kontynuować.
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nowe hasło</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Potwierdź nowe hasło</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-lg shadow-emerald-600/20"
            >
              Zmień hasło i kontynuuj
            </button>
          </form>
        )}
        
        <div className="mt-8 flex items-center justify-between text-sm text-slate-500 border-t border-slate-100 pt-6">
          <span className="font-medium">Wersja 1.0.0</span>
          <button 
            onClick={onShowAbout}
            type="button"
            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <Info size={16} />
            O aplikacji
          </button>
        </div>
      </div>
    </div>
  );
}
