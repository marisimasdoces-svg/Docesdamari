import React, { useState } from 'react';
import { User } from '../types';
import { Lock, User as UserIcon, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';

import appIconImg from '../assets/images/doces-da-mari-logo.png';
import { signInToFirebase } from '../lib/firebase';

interface LoginPageProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
  onBackToSplash?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users, onLoginSuccess, onBackToSplash }) => {
  const [username, setUsername] = useState('DAMERSIMAS');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = username.trim().toUpperCase();
    const cleanPassword = password.trim();

    const accountByUsername: Record<string, string> = {
      DAMERSIMAS: 'marcosdamersimas@gmail.com',
      MARISIMAS: 'mdamerso@hotmail.com',
    };
    const email = accountByUsername[cleanUsername];
    const localUser = users.find((item) => item.username === cleanUsername);

    if (!email || !localUser || !cleanPassword) {
      setErrorMsg('Usuário ou senha incorretos.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signInToFirebase(email, cleanPassword);
      onLoginSuccess(localUser);
    } catch (error) {
      console.warn('Firebase authentication failed:', error);
      setErrorMsg('Usuário ou senha incorretos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 relative font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-200/40 blur-3xl rounded-full pointer-events-none" />

      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl relative z-10 space-y-5">
        {/* Drawn Symbol / Icon & Header */}
        <div className="text-center space-y-3">
          {/* App Icon */}
          <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-amber-400 shadow-xl mx-auto bg-purple-950">
            <img
              src={appIconImg}
              alt="Ícone Doces da Mari"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-1">
            <h2 className="font-brand text-3xl sm:text-4xl text-gold-shimmer font-bold tracking-wide">
              Doces da Mari
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Acesso ao Sistema de Gestão
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Usuário
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nome de usuário"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors uppercase font-mono tracking-wide"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de acesso"
                required
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:cursor-wait disabled:opacity-70 text-white font-bold text-sm shadow-md shadow-purple-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>{isSubmitting ? 'CONECTANDO…' : 'ENTRAR'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {onBackToSplash && (
          <button
            type="button"
            onClick={onBackToSplash}
            className="w-full text-xs text-slate-400 hover:text-purple-600 text-center block cursor-pointer"
          >
            ← Voltar para a Abertura
          </button>
        )}
      </div>
    </div>
  );
};
