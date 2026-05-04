import React from 'react';
import { X, Info, Shield, Code, User } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <Info size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">O aplikacji ProAbsence</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <section>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800 mb-3">
              <Code size={18} className="text-blue-500" />
              Technologia i Cel
            </h3>
            <p className="text-slate-600 leading-relaxed">
              ProAbsence to nowoczesna aplikacja webowa służąca do kompleksowego zarządzania absencjami, urlopami, zwolnieniami lekarskimi oraz nadgodzinami pracowników na halach produkcyjnych. Została zbudowana z wykorzystaniem najnowszych technologii webowych (React, TypeScript, Tailwind CSS, SQLite), aby zapewnić szybkość, niezawodność i wygodę użytkowania.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800 mb-3">
              <User size={18} className="text-emerald-500" />
              Autor
            </h3>
            <p className="text-slate-600 leading-relaxed font-semibold text-lg">
              Sebastian Serafin
            </p>
          </section>

          <section className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
              <Shield size={16} className="text-rose-500" />
              Prawa Autorskie i Licencja
            </h3>
            <div className="text-sm text-slate-500 space-y-2">
              <p>
                Wszelkie prawa zastrzeżone © {new Date().getFullYear()}.
              </p>
              <p>
                Kopiowanie, modyfikowanie, dystrybucja oraz rozpowszechnianie kodu źródłowego lub elementów interfejsu bez wyraźnej zgody autora jest surowo zabronione i podlega ochronie prawnej.
              </p>
              <p>
                Wersja oprogramowania: <strong>1.0.0</strong>
              </p>
            </div>
          </section>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
