import React, { lazy, Suspense, useState, useEffect } from 'react';
import { AppState, User } from './types';
import {
  getStoredState,
  saveState,
  getCurrentMonthKey,
  initFirebaseSync,
  fetchCloudState,
  stripDeletedRecords,
} from './lib/storage';
import { SplashOpening } from './components/SplashOpening';
import { LoginPage } from './components/LoginPage';
import { Navigation, TabType } from './components/Navigation';
import { HomeDashboard } from './components/HomeDashboard';
import { FeaturePanel } from './components/FeaturePanel';
import { Boxes, ShoppingBag, ReceiptText, WalletCards } from 'lucide-react';

const SalesPage = lazy(() => import('./components/SalesPage').then((module) => ({ default: module.SalesPage })));
const BillingPage = lazy(() => import('./components/BillingPage').then((module) => ({ default: module.BillingPage })));
const CashflowPage = lazy(() => import('./components/CashflowPage').then((module) => ({ default: module.CashflowPage })));
const InventoryPage = lazy(() => import('./components/InventoryPage').then((module) => ({ default: module.InventoryPage })));

const panelDetails: Record<Exclude<TabType, 'home'>, {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tone: 'production' | 'sale' | 'billing' | 'cash';
}> = {
  inventory: {
    eyebrow: 'Depósito e livro de receitas',
    title: 'Produção',
    description: 'Controle insumos, custos, receitas e produções em um só lugar.',
    icon: Boxes,
    tone: 'production',
  },
  sales: {
    eyebrow: 'Lançamento rápido',
    title: 'Vendas',
    description: 'Cadastre clientes, vendas atuais ou retroativas e corrija lançamentos.',
    icon: ShoppingBag,
    tone: 'sale',
  },
  billing: {
    eyebrow: 'Clientes e WhatsApp',
    title: 'Cobranças',
    description: 'Acompanhe os fiados, confirme pagamentos e envie cobranças personalizadas.',
    icon: ReceiptText,
    tone: 'billing',
  },
  cashflow: {
    eyebrow: 'Visão financeira',
    title: 'Meu caixa',
    description: 'Veja recebimentos, custos, lucro real e evolução do negócio.',
    icon: WalletCards,
    tone: 'cash',
  },
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(getStoredState());
  const [view, setView] = useState<'splash' | 'login' | 'main'>('splash');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());

  // One Firestore subscription is the source of truth on every device.
  useEffect(() => {
    fetchCloudState().then((remoteState) => {
      if (remoteState) {
        setAppState((prev) => ({
          ...stripDeletedRecords(remoteState),
          currentUser: prev.currentUser || remoteState.currentUser,
        }));
      }
    });

    // Subscribe to Firebase Firestore live updates
    const unsubscribeFirebase = initFirebaseSync((remoteState) => {
      setAppState((prev) => ({
        ...stripDeletedRecords(remoteState),
        currentUser: prev.currentUser || remoteState.currentUser,
      }));
    });

    // Refresh state when window gains focus (e.g., returning to PC tab)
    const handleFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState && document.visibilityState !== 'visible') {
        return;
      }
      fetchCloudState().then((remoteState) => {
        if (remoteState) {
          setAppState((prev) => ({
            ...stripDeletedRecords(remoteState),
            currentUser: prev.currentUser || remoteState.currentUser,
          }));
        }
      });
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsubscribeFirebase();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const handleStateChange = (newState: AppState) => {
    // Save tombstones before hiding deleted records from the interface.
    saveState(newState);
    setAppState(stripDeletedRecords(newState));
  };

  const handleStateReload = () => {
    const reloaded = getStoredState();
    setAppState(reloaded);
  };

  const handleLoginSuccess = (user: User) => {
    const newState: AppState = {
      ...appState,
      currentUser: user,
    };
    handleStateChange(newState);
    setActiveTab('home');
    setView('main');
  };

  const handleLogout = () => {
    const newState: AppState = {
      ...appState,
      currentUser: null,
    };
    handleStateChange(newState);
    setView('login');
  };

  // View 1: Interactive Splash / Opening Page
  if (view === 'splash') {
    return <SplashOpening onEnterApp={() => setView('login')} />;
  }

  // View 2: Login Page with Pre-registered Users
  if (view === 'login' || !appState.currentUser) {
    return (
      <LoginPage
        users={appState.users}
        onLoginSuccess={handleLoginSuccess}
        onBackToSplash={() => setView('splash')}
      />
    );
  }

  const activePanel = activeTab === 'home' ? null : panelDetails[activeTab];

  const activePage = activeTab === 'sales' ? (
    <SalesPage
      state={appState}
      onStateChange={handleStateChange}
      selectedMonth={selectedMonth}
      currentUser={appState.currentUser}
    />
  ) : activeTab === 'billing' ? (
    <BillingPage
      state={appState}
      onStateChange={handleStateChange}
      selectedMonth={selectedMonth}
      currentUser={appState.currentUser}
    />
  ) : activeTab === 'cashflow' ? (
    <CashflowPage
      state={appState}
      onStateChange={handleStateChange}
      selectedMonth={selectedMonth}
      currentUser={appState.currentUser}
    />
  ) : activeTab === 'inventory' ? (
    <InventoryPage
      state={appState}
      onStateChange={handleStateChange}
      selectedMonth={selectedMonth}
      currentUser={appState.currentUser}
    />
  ) : null;

  // View 3: the simple dashboard stays visible; complex modules open as cards.
  return (
    <div className="dashboard-shell">
      <Navigation
        currentUser={appState.currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        onLogout={handleLogout}
        onStateReload={handleStateReload}
      />

      <main>
        <HomeDashboard
          state={appState}
          selectedMonth={selectedMonth}
          currentUser={appState.currentUser}
          onSelectTab={(tab) => setActiveTab(tab)}
        />
      </main>

      {activePanel && activePage && (
        <FeaturePanel
          key={activeTab}
          eyebrow={activePanel.eyebrow}
          title={activePanel.title}
          description={activePanel.description}
          icon={activePanel.icon}
          tone={activePanel.tone}
          onClose={() => setActiveTab('home')}
        >
          <Suspense fallback={<div className="feature-loading"><span /><strong>Preparando seus dados…</strong></div>}>
            {activePage}
          </Suspense>
        </FeaturePanel>
      )}
    </div>
  );
}
