/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchApi } from "./lib/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Foreman from "./pages/Foreman";
import CalendarView from "./pages/CalendarView";
import Chat from "./pages/Chat";
import Layout from "./components/Layout";
import AboutModal from "./components/AboutModal";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) {
      fetchApi("/api/auth/me")
        .then((data) => {
          if (data.user.force_password_change) {
            // If user needs to change password, log them out and let them login again to see the form
            sessionStorage.removeItem("token");
            setUser(null);
          } else {
            setUser(data.user);
          }
        })
        .catch(() => {
          sessionStorage.removeItem("token");
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center">Ładowanie...</div>;

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!user ? <Login onLogin={setUser} onShowAbout={() => setShowAbout(true)} /> : <Navigate to="/" />} />
          
          {user ? (
            <Route element={<Layout user={user} onLogout={() => { sessionStorage.removeItem("token"); setUser(null); }} onShowAbout={() => setShowAbout(true)} />}>
              {user.role === "admin" && <Route path="/" element={<Dashboard />} />}
              <Route path="/foreman" element={<Foreman user={user} />} />
              <Route path="/calendar" element={<CalendarView user={user} />} />
              <Route path="/chat" element={<Chat user={user} />} />
              {user.role === "admin" && <Route path="/admin" element={<Admin user={user} />} />}
              <Route path="*" element={<Navigate to={user.role === "admin" ? "/" : "/foreman"} />} />
            </Route>
          ) : (
            <Route path="*" element={<Navigate to="/login" />} />
          )}
        </Routes>
      </BrowserRouter>
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </>
  );
}
