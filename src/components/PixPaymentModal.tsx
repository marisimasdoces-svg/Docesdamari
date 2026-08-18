import React from 'react';
import { Copy, QrCode, X } from 'lucide-react';
import { formatCurrency } from '../lib/storage';
import { buildPixPayload } from '../lib/pix';

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  pixKey: string;
  recipientName: string;
  city: string;
}

export const PixPaymentModal: React.FC<PixPaymentModalProps> = ({
  open, onClose, amount, description, pixKey, recipientName, city,
}) => {
  if (!open) return null;
  const payload = buildPixPayload({ key: pixKey, recipientName, city, amount, transactionId: 'DOCESDAMARI' });
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(payload)}`;
  const copy = async () => {
    await navigator.clipboard.writeText(payload);
    alert('Código PIX copiado!');
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div><span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-emerald-700"><QrCode className="w-4 h-4"/> Receber via PIX</span><h3 className="text-xl font-black text-slate-900 mt-1">{amount > 0 ? formatCurrency(amount) : 'PIX para pagamento na hora'}</h3><p className="text-xs text-slate-500 mt-1">{description}</p></div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-5 h-5"/></button>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-center">
          <img src={qrUrl} alt={amount > 0 ? `QR Code PIX de ${formatCurrency(amount)}` : 'QR Code PIX para pagamento na hora'} className="w-64 h-64 max-w-full rounded-xl bg-white" />
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-950">
          <strong>{recipientName}</strong><br/>Chave: {pixKey}<br/>{amount > 0 ? <>Valor: {formatCurrency(amount)}</> : <>Valor: informado pelo cliente no banco</>}
        </div>
        <button type="button" onClick={copy} className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2"><Copy className="w-4 h-4"/> PIX Copia e Cola</button>
        <p className="text-[10px] text-slate-400 text-center">O pagamento continua sendo confirmado manualmente no aplicativo.</p>
      </div>
    </div>
  );
};
