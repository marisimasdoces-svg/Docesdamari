import React, { useState, useEffect } from 'react';
import { AppState, User } from './types';
import { getStoredState, saveState, getCurrentMonthKey, initFirebaseSync, fetchCloudState } from './lib/storage';
import { SplashOpening } from './components/SplashOpening';
import { LoginPage } from './components/LoginPage';
import { Navigation, TabType } from './components/Navigation';
import { HomeDashboard } from './components/HomeDashboard';
import { SalesPage } from './components/SalesPage';
import { BillingPage } from './components/BillingPage';
import { CashflowPage } from './components/CashflowPage';
import { InventoryPage } from './components/InventoryPage';

export default function App() {
  const [appState, setAppState] = useState<AppState>(getStoredState());
  const [view, setView] = useState<'splash' | 'login' | 'main'>('splash');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());

  // Keep state synchronized with local storage & Firebase real-time cloud database
  useEffect(() => {
    // Proactively fetch latest cloud state on startup
    fetchCloudState().then((remoteState) => {
      if (remoteState) {
        setAppState((prev) => ({
          ...remoteState,
          currentUser: prev.currentUser || remoteState.currentUser,
        }));
      }
    });

    // Subscribe to Firebase Firestore live updates
    const unsubscribeFirebase = initFirebaseSync((remoteState) => {
      setAppState((prev) => ({
        ...remoteState,
        currentUser: prev.currentUser || remoteState.currentUser,
      }));
    });

    // Refresh state when window gains focus (e.g., returning to PC tab)
    const handleFocus = () => {
      fetchCloudState().then((remoteState) => {
        if (remoteState) {
          setAppState((prev) => ({
            ...remoteState,
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
    setAppState(newState);
    saveState(newState);
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

  // View 3: Main PWA Application
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-purple-500 selection:text-white flex flex-col justify-between overflow-x-hidden w-full max-w-full">
      <div>
        <Navigation
          currentUser={appState.currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          onLogout={handleLogout}
          onStateReload={handleStateReload}
        />

        <main className="w-full max-w-full overflow-x-hidden">
          {activeTab === 'home' && (
            <HomeDashboard
              state={appState}
              selectedMonth={selectedMonth}
              currentUser={appState.currentUser}
              onSelectTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'sales' && (
            <SalesPage
              state={appState}
              onStateChange={handleStateChange}
              selectedMonth={selectedMonth}
              currentUser={appState.currentUser}
            />
          )}

          {activeTab === 'billing' && (
            <BillingPage
              state={appState}
              onStateChange={handleStateChange}
              selectedMonth={selectedMonth}
              currentUser={appState.currentUser}
            />
          )}

          {activeTab === 'cashflow' && (
            <CashflowPage
              state={appState}
              onStateChange={handleStateChange}
              selectedMonth={selectedMonth}
              currentUser={appState.currentUser}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryPage
              state={appState}
              onStateChange={handleStateChange}
              selectedMonth={selectedMonth}
              currentUser={appState.currentUser}
            />
          )}
        </main>
      </div>
    </div>
  );
}
