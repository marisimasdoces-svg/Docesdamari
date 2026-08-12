import React, { useEffect, useRef, useState } from 'react';
import { GripHorizontal, X } from 'lucide-react';

interface FeaturePanelProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tone: 'production' | 'sale' | 'billing' | 'cash';
  onClose: () => void;
  children: React.ReactNode;
}

interface DragState {
  pointerId: number;
  startY: number;
  startTop: number;
}

const initialTop = () => (typeof window !== 'undefined' && window.innerWidth <= 720 ? 76 : 92);

export const FeaturePanel: React.FC<FeaturePanelProps> = ({
  eyebrow,
  title,
  description,
  icon: Icon,
  tone,
  onClose,
  children,
}) => {
  const [top, setTop] = useState(initialTop);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const minTop = window.innerWidth <= 720 ? 58 : 78;
    const maxTop = Math.min(260, Math.round(window.innerHeight * 0.38));
    setTop(Math.max(minTop, Math.min(maxTop, drag.startTop + event.clientY - drag.startY)));
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <>
      <button className="feature-backdrop" onClick={onClose} aria-label="Fechar painel" />
      <section
        className={`feature-panel feature-panel--${tone}`}
        style={{ top: `${top}px` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="feature-panel__drag"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          title="Arraste somente para cima ou para baixo"
        >
          <GripHorizontal size={28} />
          <span>Arraste para cima ou para baixo</span>
        </div>

        <button className="feature-panel__close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={21} />
        </button>

        <header className="feature-panel__header">
          <span className="feature-panel__icon"><Icon size={25} /></span>
          <div>
            <small>{eyebrow}</small>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </header>

        <div className="feature-panel__body">{children}</div>
      </section>
    </>
  );
};
