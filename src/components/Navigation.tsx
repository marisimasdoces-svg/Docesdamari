import React, { useState } from 'react';
import { User } from '../types';
import {
  Home,
  ShoppingBag,
  Receipt,
  Wallet,
  Package,
  LogOut,
  Database,
  Download,
  Upload,
  RefreshCw,
  Calendar,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { exportDatabaseJSON, importDatabaseJSON, resetToInitialData, forceSyncCloud } from '../lib/storage';

import appIconImg from '../assets/images/mari_simas_app_icon_1785897100847.jpg';
import goldLogoImg from '../assets/images/mari_simas_logo_1785897108954.jpg';

export type TabType = 'home' | 'sales' | 'billing' | 'cashflow' | 'inventory';

interface NavigationProps {
  currentUser: User;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onLogout: () => void;
  onStateReload: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  selectedMonth,
  setSelectedMonth,
  onLogout,
  onStateReload,
}) => {
  const [showDbModal, setShowDbModal] = useState(false);
  const [showIconModal, setShowIconModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [dbMsg, setDbMsg] = useState('');

  const handleExport = () => {
    const jsonStr = exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marisimas_doces_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDbMsg('✅ Backup baixado com sucesso!');
  };

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) return;
    const ok = importDatabaseJSON(importJsonText);
    if (ok) {
      setDbMsg('✅ Base de dados restaurada com sucesso!');
      setTimeout(() => {
        onStateReload();
        setShowDbModal(false);
      }, 1000);
    } else {
      setDbMsg('❌ JSON inválido. Verifique o arquivo de backup.');
    }
  };

  const handleResetData = () => {
    if (window.confirm('Tem certeza que deseja restaurar a base de dados de exemplo inicial?')) {
      resetToInitialData();
      onStateReload();
      setDbMsg('✅ Base restaurada para o estado inicial!');
      setTimeout(() => setShowDbModal(false), 1000);
    }
  };

  const tabs = [
    {
      id: 'home' as TabType,
      label: 'Início (Menu)',
      shortLabel: 'Menu',
      icon: Home,
    },
    {
      id: 'inventory' as TabType,
      label: 'Produção',
      shortLabel: 'Produção',
      icon: Package,
    },
    {
      id: 'sales' as TabType,
      label: 'Vendas',
      shortLabel: 'Venda',
      icon: ShoppingBag,
    },
    {
      id: 'billing' as TabType,
      label: 'Cobranças',
      shortLabel: 'Cobrança',
      icon: Receipt,
    },
    {
      id: 'cashflow' as TabType,
      label: 'Caixa',
      shortLabel: 'Caixa',
      icon: Wallet,
    },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo Brand Clickable to Home */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-amber-300 shadow-2xs group-hover:scale-105 transition-all duration-200 shrink-0 bg-purple-950">
              <img
                src={appIconImg}
                alt="Mari Simas Doces Icon"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="font-brand text-xl sm:text-2xl text-gold-shimmer font-bold tracking-wide group-hover:scale-105 transition-transform leading-none drop-shadow-xs">
                Mari Simas Doces
              </h1>
            </div>
          </button>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Month Filter Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs hover:border-purple-300 transition-colors">
              <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="2026-08">Agosto / 2026</option>
                <option value="2026-07">Julho / 2026</option>
                <option value="2026-06">Junho / 2026</option>
                <option value="2026-09">Setembro / 2026</option>
              </select>
            </div>

            {/* Sync Cloud Button */}
            <button
              type="button"
              onClick={async () => {
                const ok = await forceSyncCloud();
                onStateReload();
                if (ok) {
                  alert('☁️ Dados sincronizados com a nuvem! Celular e PC atualizados.');
                }
              }}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center gap-1.5"
              title="Sincronizar Celular e Computador (Nuvem em Tempo Real)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline text-xs font-bold text-emerald-800">Sincronizar</span>
            </button>

            {/* DB Backup Modal Button */}
            <button
              type="button"
              onClick={() => setShowDbModal(true)}
              className="p-2 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-700 rounded-xl border border-slate-200 hover:border-purple-300 transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Backup & Base de Dados"
            >
              <Database className="w-4 h-4 text-purple-600" />
            </button>

            {/* Logged User Chip */}
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-xl text-xs">
              <span className="text-base">{currentUser.avatar}</span>
              <div className="hidden md:block text-left">
                <div className="font-bold text-slate-900 leading-none">{currentUser.name}</div>
                <div className="text-[9px] text-purple-700 font-semibold">{currentUser.badge}</div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="ml-1 text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer hover:scale-110"
                title="Sair da Conta"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop / Tablet Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto no-scrollbar border-t border-slate-100 hidden sm:block">
          <nav className="flex space-x-2 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap hover:scale-105 active:scale-95 ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md border border-purple-600 ring-2 ring-purple-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-purple-50 hover:border-purple-200 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-600'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 sm:hidden shadow-xl">
        <div className="grid grid-cols-5 h-16">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-90 ${
                  isActive ? 'text-purple-700 font-black' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-purple-100 shadow-xs' : ''}`}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-purple-700 scale-110' : ''}`} />
                </div>
                <span className="text-[9px] truncate max-w-[65px]">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal: Base de Dados & Backup */}
      {showDbModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-base">
                <Database className="w-5 h-5 text-purple-600" />
                <span>Gerenciar Base de Dados</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                className="text-slate-400 hover:text-slate-800 text-lg font-bold px-2"
              >
                ✕
              </button>
            </div>

            {dbMsg && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-800 font-semibold">
                {dbMsg}
              </div>
            )}

            {/* Firebase Cloud Sync Status */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0 text-sm shadow-xs animate-pulse">
                ☁️
              </div>
              <div className="text-left text-xs">
                <div className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                  <span>Sincronização em Nuvem Ativa</span>
                  <span className="bg-emerald-200 text-emerald-900 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                    ONLINE
                  </span>
                </div>
                <div className="text-emerald-800 text-[11px] font-medium">
                  Projeto Firebase: <code className="font-mono font-bold">docesdamari-e34b7</code>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Todas as suas vendas, receitas, pagamentos e cobranças estão salvas em tempo real no seu banco de dados Firebase.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-2xl text-xs font-bold text-purple-800 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-5 h-5 text-purple-600" />
                <span>Baixar Backup JSON</span>
              </button>

              <button
                type="button"
                onClick={handleResetData}
                className="p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-5 h-5 text-rose-600" />
                <span>Restaurar Inicial</span>
              </button>
            </div>

            {/* Import JSON Section */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-700">
                Restaurar do arquivo de Backup JSON:
              </label>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder="Cole o código JSON do backup aqui..."
                rows={4}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600"
              />
              <button
                type="button"
                onClick={handleImportSubmit}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Importar e Substituir Dados</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ícone do Celular e Logo Dourada */}
      {showIconModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-6 text-white text-center relative overflow-hidden">
            <button
              type="button"
              onClick={() => setShowIconModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold p-2"
            >
              ✕
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Identidade Visual do App</span>
              </div>
              <h3 className="text-xl font-black text-amber-200">
                Ícone do Celular & Logo Dourada
              </h3>
              <p className="text-xs text-slate-300">
                Mari Simas Doces • Ícone oficial preparado para Apple Store & Tela de Início
              </p>
            </div>

            {/* APP ICON SHOWCASE CONTAINER */}
            <div className="flex flex-col items-center space-y-3">
              <div className="relative group">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-2 border-amber-400 shadow-2xl shadow-amber-900/50 hover:scale-105 transition-transform duration-300">
                  <img
                    src={appIconImg}
                    alt="Ícone do Celular Mari Simas Doces"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-2 text-[11px] font-mono font-bold text-amber-300">
                  mari_simas_app_icon.jpg (1:1 Borda a Borda)
                </div>
              </div>

              {/* LOGO DOURADA SHOWCASE */}
              <div className="w-full pt-3 border-t border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Logo Dourada com Caligrafia Elegante:
                </span>
                <div className="rounded-2xl overflow-hidden border border-amber-500/30 bg-purple-950/80 p-2 shadow-lg max-h-36 flex items-center justify-center">
                  <img
                    src={goldLogoImg}
                    alt="Logo Dourada Mari Simas Doces"
                    referrerPolicy="no-referrer"
                    className="max-h-32 w-auto object-contain rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 text-xs text-slate-400 leading-relaxed font-medium bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              📌 <strong>Nota:</strong> Este é o ícone exclusivo gerado para a tela de início do seu celular. Ele preenche totalmente as bordas com a paleta vinho/dourada para reconhecimento instantâneo!
            </div>

            <button
              type="button"
              onClick={() => setShowIconModal(false)}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-2xl shadow-lg cursor-pointer transition-all"
            >
              FECHAR VISUALIZAÇÃO
            </button>
          </div>
        </div>
      )}
    </>
  );
};
