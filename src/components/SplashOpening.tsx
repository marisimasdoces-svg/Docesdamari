import React, { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import appLogo from '../assets/images/doces-da-mari-logo.png';

interface SplashOpeningProps {
  onEnterApp: () => void;
}

export const SplashOpening: React.FC<SplashOpeningProps> = ({ onEnterApp }) => {
  const [leaving, setLeaving] = useState(false);

  const handleEnter = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onEnterApp, 520);
  };

  return (
    <section className={`intro-screen ${leaving ? 'intro-screen--leaving' : ''}`}>
      <div className="intro-orb intro-orb--one" />
      <div className="intro-orb intro-orb--two" />
      <div className="intro-orb intro-orb--three" />

      <div className="intro-content">
        <div className="intro-logo-wrap">
          <div className="intro-logo-ring" />
          <img className="intro-logo" src={appLogo} alt="Logo Doces da Mari" />
          <Sparkles className="intro-spark intro-spark--one" />
          <Sparkles className="intro-spark intro-spark--two" />
        </div>

        <div className="intro-copy">
          <span className="preview-pill">Gestão simples e inteligente</span>
          <p className="intro-kicker">Feito com carinho. Gerido com clareza.</p>
          <h1>Doces da Mari</h1>
          <p className="intro-subtitle">
            Tudo que você precisa para produzir, vender e cobrar sem complicação na tela.
          </p>
        </div>

        <button type="button" className="primary-cta shine-button" onClick={handleEnter}>
          <span>Abrir meu painel</span>
          <ArrowRight size={19} strokeWidth={2.4} />
        </button>

        <p className="intro-hint">Seus dados continuam seguros e sincronizados na nuvem</p>
      </div>
    </section>
  );
};
