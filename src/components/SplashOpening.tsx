import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronRight, ShieldCheck, Heart } from 'lucide-react';

import appIconImg from '../assets/images/mari_simas_app_icon_1785897100847.jpg';
import goldLogoImg from '../assets/images/mari_simas_logo_1785897108954.jpg';

interface SplashOpeningProps {
  onEnterApp: () => void;
}

const DESSERT_VARIATIONS = [
  {
    id: 'ninho-nutella',
    name: 'Ninho com Nutella',
    toppingColor: '#451a03', // Chocolate Nutella
    creamColor: '#fef3c7', // Creme Ninho
    cakeColor: '#d97706', // Bolo
    toppingIcon: '🍫',
    badge: 'Mais Vendido 🔥',
  },
  {
    id: 'brigadeiro',
    name: 'Brigadeiro Gourmet 50%',
    toppingColor: '#1c1917', // Brigadeiro escuro
    creamColor: '#44403c', // Creme Brigadeiro
    cakeColor: '#78350f', // Bolo de Chocolate
    toppingIcon: '✨',
    badge: 'Chocolatudo 🍫',
  },
  {
    id: 'limao',
    name: 'Torta de Limão no Pote',
    toppingColor: '#84cc16', // Limão
    creamColor: '#fefef2', // Creme branco
    cakeColor: '#fde047', // Biscoito
    toppingIcon: '🍋',
    badge: 'Cremoso 🍋',
  },
];

export const SplashOpening: React.FC<SplashOpeningProps> = ({ onEnterApp }) => {
  const [selectedSweetIdx, setSelectedSweetIdx] = useState(0);
  const [isScooping, setIsScooping] = useState(false);
  const [scoopCount, setScoopCount] = useState(0);

  const sweet = DESSERT_VARIATIONS[selectedSweetIdx];

  const handleJarClick = () => {
    setIsScooping(true);
    setScoopCount((prev) => prev + 1);
    setTimeout(() => {
      setIsScooping(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-between p-4 relative overflow-hidden font-sans">
      {/* Background Soft Glows */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-200/50 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-pink-200/40 blur-3xl rounded-full pointer-events-none" />

      {/* Title & Header Area */}
      <main className="w-full max-w-md flex flex-col items-center justify-center my-auto py-6 z-10 text-center">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex flex-col items-center space-y-2"
        >
          {/* App Icon Thumbnail */}
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-lg bg-purple-950 my-1">
            <img
              src={appIconImg}
              alt="Ícone Mari Simas Doces"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold uppercase tracking-wider">
            Bolo no Pote Artesanal
          </span>

          <div className="flex items-center justify-center gap-2.5 my-1">
            <Sparkles className="w-6 h-6 text-amber-500 animate-pulse shrink-0" />
            <h1 className="font-brand text-4xl sm:text-5xl text-gold-shimmer font-bold tracking-wide drop-shadow-sm">
              Mari Simas Doces
            </h1>
            <Sparkles className="w-6 h-6 text-amber-500 animate-pulse shrink-0" />
          </div>

          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Toque no pote para provar a consistência do doce!
          </p>
        </motion.div>

        {/* Drawn Bolo de Pote Container */}
        <div className="relative my-4 flex flex-col items-center">
          {/* Flavor badge */}
          <motion.div
            key={sweet.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-3 px-3.5 py-1 rounded-full bg-white border border-purple-200 text-xs font-bold text-slate-800 flex items-center gap-2 shadow-sm"
          >
            <span>{sweet.toppingIcon}</span>
            <span>{sweet.name}</span>
            <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-extrabold">
              {sweet.badge}
            </span>
          </motion.div>

          {/* Drawn Bolo no Pote SVG Container */}
          <motion.button
            type="button"
            onClick={handleJarClick}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            animate={{
              y: isScooping ? [0, -10, 0] : [0, -5, 0],
            }}
            transition={{
              y: isScooping
                ? { duration: 0.3 }
                : { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="relative cursor-pointer focus:outline-none group"
            title="Clique no Bolo no Pote!"
          >
            {/* Scoop particle animations */}
            <AnimatePresence>
              {isScooping && (
                <>
                  <motion.div
                    initial={{ opacity: 1, y: 0, x: -10, scale: 0.6 }}
                    animate={{ opacity: 0, y: -45, x: -25, scale: 1.2 }}
                    className="absolute -top-4 left-4 text-2xl pointer-events-none z-30"
                  >
                    ✨
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 1, y: 0, x: 10, scale: 0.6 }}
                    animate={{ opacity: 0, y: -50, x: 25, scale: 1.3 }}
                    className="absolute -top-4 right-4 text-2xl pointer-events-none z-30"
                  >
                    🥄
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Spoon sticking out of jar */}
            <motion.div
              animate={{
                rotate: isScooping ? [-20, 20, -20] : [-12, -8, -12],
                y: isScooping ? [0, 10, 0] : [0, -2, 0],
              }}
              className="absolute -top-10 right-2 text-5xl z-20 drop-shadow-md select-none pointer-events-none"
            >
              🥄
            </motion.div>

            {/* Drawn Glass Jar SVG Illustration */}
            <div className="w-52 h-64 relative drop-shadow-xl">
              <svg
                viewBox="0 0 200 240"
                className="w-full h-full overflow-visible"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Glass jar gradient */}
                  <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                    <stop offset="20%" stopColor="#ffffff" stopOpacity="0.3" />
                    <stop offset="80%" stopColor="#ffffff" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.7" />
                  </linearGradient>

                  <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#4c1d95" floodOpacity="0.15" />
                  </filter>
                </defs>

                {/* Jar Lid (Tampa rosqueada rosa/roxa) */}
                <g id="jar-lid" filter="url(#softShadow)">
                  <rect x="35" y="10" width="130" height="22" rx="6" fill="#7c3aed" />
                  <rect x="40" y="14" width="120" height="4" rx="2" fill="#a78bfa" opacity="0.6" />
                  <rect x="30" y="30" width="140" height="8" rx="3" fill="#6d28d9" />
                </g>

                {/* Glass Pot Body (Pote Transparente) */}
                <path
                  d="M 38 38 L 162 38 C 168 38 172 42 170 50 L 160 215 C 158 225 148 232 135 232 L 65 232 C 52 232 42 225 40 215 L 30 50 C 28 42 32 38 38 38 Z"
                  fill="url(#glassGrad)"
                  stroke="#94a3b8"
                  strokeWidth="3"
                  filter="url(#softShadow)"
                />

                {/* --- LAYERS OF BOLO NO POTE INSIDE --- */}
                <g id="cake-layers" clipPath="url(#jarClip)">
                  <clipPath id="jarClip">
                    <path d="M 39 40 L 161 40 L 158 214 C 156 223 147 230 135 230 L 65 230 C 53 230 44 223 42 214 Z" />
                  </clipPath>

                  {/* Base Layer: Creme de fundo */}
                  <path d="M 30 185 Q 100 178 170 185 L 170 235 L 30 235 Z" fill={sweet.creamColor} />

                  {/* Layer 2: Bolo esfarelado / Pão de ló (Sponge Cake Layer) */}
                  <path
                    d="M 30 145 Q 60 152 100 146 Q 140 140 170 147 L 170 188 Q 100 180 30 188 Z"
                    fill={sweet.cakeColor}
                  />
                  {/* Crumble dots/crumbs */}
                  <circle cx="60" cy="165" r="2" fill="#78350f" opacity="0.4" />
                  <circle cx="85" cy="170" r="3" fill="#78350f" opacity="0.4" />
                  <circle cx="120" cy="162" r="2.5" fill="#78350f" opacity="0.4" />
                  <circle cx="145" cy="168" r="2" fill="#78350f" opacity="0.4" />

                  {/* Layer 3: Recheio Cremoso Central */}
                  <path
                    d="M 30 100 Q 70 94 110 102 Q 150 108 170 100 L 170 148 Q 120 142 30 147 Z"
                    fill={sweet.creamColor}
                  />

                  {/* Layer 4: Segunda Camada de Bolo */}
                  <path
                    d="M 30 65 Q 80 72 120 66 Q 150 62 170 68 L 170 102 Q 110 96 30 102 Z"
                    fill={sweet.cakeColor}
                  />

                  {/* Layer 5: Cobertura Superior Cremosa com Gotas (Dripping Sauce Top) */}
                  <path
                    d="M 28 40 L 172 40 L 172 68 Q 140 60 115 72 Q 90 80 65 64 Q 40 58 28 66 Z"
                    fill={sweet.toppingColor}
                  />

                  {/* Chocolate drips on glass */}
                  <path
                    d="M 50 62 Q 52 82 56 80 Q 60 78 62 64 Z"
                    fill={sweet.toppingColor}
                  />
                  <path
                    d="M 120 68 Q 123 90 127 88 Q 131 86 133 66 Z"
                    fill={sweet.toppingColor}
                  />
                </g>

                {/* Sticker Label on Front of Jar */}
                <g id="jar-sticker" filter="url(#softShadow)">
                  <rect x="52" y="110" width="96" height="60" rx="10" fill="#ffffff" stroke="#f1f5f9" strokeWidth="2" />
                  <rect x="56" y="114" width="88" height="52" rx="8" fill="#faf5ff" stroke="#e9d5ff" strokeWidth="1" />

                  {/* Sticker Text */}
                  <text x="100" y="130" textAnchor="middle" fill="#6d28d9" fontSize="9" fontWeight="800" fontFamily="sans-serif">
                    MARISIMAS DOCES
                  </text>
                  <text x="100" y="145" textAnchor="middle" fill="#1e293b" fontSize="10" fontWeight="800" fontFamily="sans-serif">
                    {sweet.name.split(' ')[0]}
                  </text>
                  <text x="100" y="157" textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="600" fontFamily="sans-serif">
                    Bolo no Pote • 250ml
                  </text>
                </g>

                {/* Glass Reflection Highlight lines */}
                <path d="M 44 48 L 41 210" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
                <path d="M 52 50 L 49 190" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
              </svg>
            </div>
          </motion.button>

          {/* Flavor Selection Pills */}
          <div className="flex items-center gap-2 mt-4">
            {DESSERT_VARIATIONS.map((sw, idx) => (
              <button
                key={sw.id}
                type="button"
                onClick={() => setSelectedSweetIdx(idx)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedSweetIdx === idx
                    ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-md scale-105'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                }`}
              >
                <span>{sw.toppingIcon}</span>
                <span>{sw.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            💡 Provar no pote (Toques: {scoopCount})
          </p>
        </div>

        {/* Action Button to Enter App */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mt-2"
        >
          <button
            type="button"
            onClick={onEnterApp}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-purple-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            <span>ENTRAR NO SISTEMA DE GESTÃO</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md py-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 z-10">
        <div className="flex items-center gap-1">
          <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
          <span>Mari & Damer © 2026</span>
        </div>
        <div>PWA Offline Ready 📱</div>
      </footer>
    </div>
  );
};
