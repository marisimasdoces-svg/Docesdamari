import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Database,
  Download,
  Home,
  LogOut,
  Package,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Upload,
  WalletCards,
  WifiOff,
  X,
} from 'lucide-react';
import { User } from '../types';
import {
  exportDatabaseJSON,
  fetchCloudState,
  forceSyncCloud,
  getSyncStatus,
  getSaoPauloDateKey,
  importDatabaseJSON,
  resetToInitialData,
  subscribeSyncStatus,
  SyncStatus,
} from '../lib/storage';
import appLogo from '../assets/images/doces-da-mari-logo.png';

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

const tabs = [
  { id: 'home' as TabType, label: 'Início', icon: Home },
  { id: 'inventory' as TabType, label: 'Produção', icon: Package },
  { id: 'sales' as TabType, label: 'Venda', icon: ShoppingBag, featured: true },
  { id: 'billing' as TabType, label: 'Cobrar', icon: ReceiptText },
  { id: 'cashflow' as TabType, label: 'Caixa', icon: WalletCards },
];

export const Navigation: React.FC<NavigationProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  selectedMonth,
  setSelectedMonth,
  onLogout,
  onStateReload,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [showMenu, setShowMenu] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => subscribeSyncStatus(setSyncStatus), []);

  const monthOptions = useMemo(() => {
    const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const result: Array<{ key: string; label: string }> = [];
    for (let year = 2024; year <= 2032; year += 1) {
      names.forEach((name, index) => result.push({
        key: `${year}-${String(index + 1).padStart(2, '0')}`,
        label: `${name} / ${year}`,
      }));
    }
    return result;
  }, []);

  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
  }).format(new Date()).replace('.', '');

  const syncLabel = syncStatus === 'synced'
    ? 'Sincronizado'
    : syncStatus === 'syncing'
    ? 'Sincronizando'
    : syncStatus === 'offline'
    ? 'Offline'
    : 'Verificar conexão';

  const handleSync = async () => {
    const ok = await forceSyncCloud();
    if (ok) {
      await fetchCloudState();
      onStateReload();
      setMessage('Dados do celular e do computador conferidos com a nuvem.');
    } else {
      setMessage('Não foi possível concluir agora. Verifique a internet e tente novamente.');
    }
  };

  const handleExport = () => {
    const blob = new Blob([exportDatabaseJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `doces-da-mari-backup-${getSaoPauloDateKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Backup baixado com sucesso.');
  };

  const handleImport = () => {
    if (!importText.trim()) {
      setMessage('Escolha um arquivo de backup ou cole o conteúdo JSON.');
      return;
    }
    if (!window.confirm('Este backup substituirá os dados atuais. Deseja continuar?')) return;
    const ok = importDatabaseJSON(importText);
    setMessage(ok ? 'Backup restaurado. Aguarde a sincronização.' : 'Arquivo inválido. Nenhum dado foi alterado.');
    if (ok) window.setTimeout(onStateReload, 600);
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ''));
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (!window.confirm('Apagar os dados atuais e voltar aos exemplos iniciais? Faça um backup antes.')) return;
    resetToInitialData();
    onStateReload();
    setMessage('Dados restaurados para o estado inicial.');
  };

  return (
    <>
      <header className="topbar">
        <button className="brand-lockup" type="button" onClick={() => setActiveTab('home')}>
          <img src={appLogo} alt="Logo Doces da Mari" />
          <span><strong>Doces da Mari</strong><small>Painel de gestão</small></span>
        </button>

        <div className="topbar-right">
          <label className="month-chip" title="Mês exibido no painel">
            <CalendarDays size={15} />
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              {monthOptions.map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
            </select>
          </label>

          <button
            type="button"
            className={`sync-chip sync-chip--${syncStatus}`}
            onClick={handleSync}
            title="Conferir sincronização agora"
          >
            {syncStatus === 'syncing' ? <RefreshCw className="spin" size={16} /> : syncStatus === 'offline' ? <WifiOff size={16} /> : syncStatus === 'synced' ? <CheckCircle2 size={16} /> : <Cloud size={16} />}
            <span>{syncLabel}</span>
          </button>

          <div className="date-chip"><CalendarDays size={16} /><span>{dateLabel}</span></div>

          <div className="profile-wrap">
            <button className="profile-button" type="button" onClick={() => setShowMenu((value) => !value)} aria-label="Abrir menu do usuário">
              <span>{currentUser.name.trim().charAt(0).toUpperCase()}</span><ChevronDown size={15} />
            </button>
            {showMenu && (
              <div className="profile-menu">
                <div className="profile-menu__user"><strong>{currentUser.name}</strong><small>{currentUser.badge}</small></div>
                <button type="button" onClick={() => { setShowDatabase(true); setShowMenu(false); }}><Database size={17} /> Dados e backup</button>
                <button type="button" onClick={onLogout}><LogOut size={17} /> Sair</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="mobile-nav" aria-label="Navegação principal">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`${activeTab === tab.id ? 'mobile-nav__active' : ''} ${tab.featured ? 'mobile-nav__sale' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={19} /><span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {showDatabase && (
        <div className="database-modal" role="dialog" aria-modal="true" aria-label="Dados e backup">
          <button className="database-modal__backdrop" type="button" onClick={() => setShowDatabase(false)} aria-label="Fechar" />
          <section className="database-card">
            <button className="database-card__close" type="button" onClick={() => setShowDatabase(false)}><X size={20} /></button>
            <div className="database-card__title"><span><Database size={22} /></span><div><small>Segurança</small><h2>Dados e backup</h2></div></div>

            <div className={`database-status database-status--${syncStatus}`}>
              {syncStatus === 'synced' ? <CheckCircle2 size={21} /> : syncStatus === 'offline' ? <WifiOff size={21} /> : <RefreshCw className={syncStatus === 'syncing' ? 'spin' : ''} size={21} />}
              <div><strong>{syncLabel}</strong><p>Firebase: docesdamari-e34b7</p></div>
            </div>

            {message && <p className="database-message">{message}</p>}

            <div className="database-actions">
              <button type="button" onClick={handleSync}><RefreshCw size={18} /> Sincronizar agora</button>
              <button type="button" onClick={handleExport}><Download size={18} /> Baixar backup</button>
            </div>

            <div className="database-import">
              <strong>Restaurar um backup</strong>
              <label><Upload size={18} /><span>Escolher arquivo JSON</span><input type="file" accept="application/json,.json" onChange={handleFile} /></label>
              <textarea value={importText} onChange={(event) => setImportText(event.target.value)} rows={4} placeholder="Ou cole aqui o conteúdo do backup..." />
              <button type="button" onClick={handleImport}>Importar e substituir dados</button>
            </div>

            <button className="database-reset" type="button" onClick={handleReset}>Restaurar dados iniciais</button>
          </section>
        </div>
      )}
    </>
  );
};
