import React from 'react';
import {
  ArrowRight,
  Boxes,
  Clock3,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { AppState, User } from '../types';
import { formatCurrency, formatMonthShort } from '../lib/storage';
import { getAvailableReadyStock } from '../lib/readyStock';
import { TabType } from './Navigation';

interface HomeDashboardProps {
  state: AppState;
  selectedMonth: string;
  currentUser: User;
  onSelectTab: (tab: TabType) => void;
}

const saoPauloDateKey = (date: Date | string) => {
  const parsed = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  state,
  selectedMonth,
  currentUser,
  onSelectTab,
}) => {
  const now = new Date();
  const todayKey = saoPauloDateKey(now);
  const hour = Number(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    }).format(now)
  );
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const salesInMonth = state.sales.filter(
    (sale) => sale.monthKey === selectedMonth || saoPauloDateKey(sale.saleDate).startsWith(selectedMonth)
  );
  const salesToday = state.sales.filter((sale) => saoPauloDateKey(sale.saleDate) === todayKey);
  const availableReadyStock = getAvailableReadyStock(state.batches, state.sales, state.utilitySettings);
  const soldToday = salesToday.reduce((total, sale) => total + (sale.quantity || 0), 0);

  const grossMonth = salesInMonth.reduce((total, sale) => total + (sale.totalPrice || 0), 0);
  const unitsSoldInMonth = salesInMonth.reduce((total, sale) => total + (sale.quantity || 0), 0);
  const immediateReceived = salesInMonth
    .filter((sale) => sale.isPaidImmediately)
    .reduce((total, sale) => total + (sale.totalPrice || 0), 0);
  const paymentsMonth = state.payments
    .filter((payment) => payment.monthKey === selectedMonth)
    .reduce((total, payment) => total + (payment.amountPaid || 0), 0);
  const pendingMonth = Math.max(0, grossMonth - Math.min(grossMonth, immediateReceived + paymentsMonth));

  const lowStockCount = state.inventory.filter(
    (item) => item.remainingQuantity <= (item.minAlertQuantity ?? 0)
  ).length;
  const pendingCustomers = new Set(
    salesInMonth.filter((sale) => sale.paymentStatus === 'pending').map((sale) => sale.buyerId || sale.buyerName)
  ).size;
  const lastSale = [...state.sales].sort(
    (a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
  )[0];

  const actions = [
    {
      tab: 'inventory' as TabType,
      tone: 'production',
      eyebrow: 'Depósito e receitas',
      title: 'Produção',
      detail: lowStockCount ? `${lowStockCount} ${lowStockCount === 1 ? 'item em alerta' : 'itens em alerta'}` : 'Estoque em ordem',
      icon: Boxes,
    },
    {
      tab: 'sales' as TabType,
      tone: 'sale',
      eyebrow: 'Lançamento rápido',
      title: 'Nova venda',
      detail: `${unitsSoldInMonth} ${unitsSoldInMonth === 1 ? 'pote vendido' : 'potes vendidos'} · ${salesInMonth.length} ${salesInMonth.length === 1 ? 'pedido' : 'pedidos'}`,
      icon: ShoppingBag,
    },
    {
      tab: 'billing' as TabType,
      tone: 'billing',
      eyebrow: 'Fiados do mês',
      title: 'Cobranças',
      detail: pendingCustomers ? `${pendingCustomers} ${pendingCustomers === 1 ? 'cliente pendente' : 'clientes pendentes'}` : 'Nenhuma pendência',
      icon: ReceiptText,
    },
    {
      tab: 'cashflow' as TabType,
      tone: 'cash',
      eyebrow: 'Resumo financeiro',
      title: 'Meu caixa',
      detail: formatMonthShort(selectedMonth),
      icon: WalletCards,
    },
  ];

  return (
    <div className="dashboard-content">
      <section className="welcome-row">
        <div>
          <span className="welcome-tag"><Sparkles size={14} /> Tudo pronto para trabalhar</span>
          <h2>{greeting}, {firstName(currentUser.name)}.</h2>
          <p>O que você quer fazer agora?</p>
        </div>

        <button className="activity-button" type="button" onClick={() => onSelectTab('sales')}>
          <Clock3 size={17} />
          <span>
            <small>Última movimentação</small>
            {lastSale ? `${lastSale.quantity}x ${lastSale.sweetName} · ${lastSale.buyerName}` : 'Nenhuma venda registrada ainda'}
          </span>
          <ArrowRight size={17} />
        </button>
      </section>

      <section className="summary-strip" aria-label="Resumo operacional">
        <div className="summary-title"><span className="live-dot" /> Hoje</div>
        <div className="summary-item"><strong>{availableReadyStock}</strong><span>disponíveis p/ venda</span></div>
        <div className="summary-divider" />
        <div className="summary-item"><strong>{soldToday}</strong><span>vendidos</span></div>
        <div className="summary-divider" />
        <div className="summary-item summary-item--money"><strong>{formatCurrency(pendingMonth)}</strong><span>a receber</span></div>
      </section>

      <section className="action-section">
        <div className="section-heading">
          <div><span>Acesso rápido</span><h3>Escolha uma ação</h3></div>
          <p>A complexidade fica escondida. Você só vê o que precisa.</p>
        </div>

        <div className="action-grid">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.tab}
                type="button"
                className={`action-card action-card--${action.tone}`}
                onClick={() => onSelectTab(action.tab)}
              >
                <span className="action-card__glow" />
                <span className="action-icon"><Icon size={27} strokeWidth={2.1} /></span>
                <span className="action-copy">
                  <small>{action.eyebrow}</small>
                  <strong>{action.title}</strong>
                  <span>{action.detail}</span>
                </span>
                <span className="action-arrow"><ArrowRight size={18} /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="tip-card">
        <div className="tip-icon"><PackageCheck size={22} /></div>
        <div>
          <span>Depósito conectado ao Livro de Receitas</span>
          <p>Ao registrar uma produção, os ingredientes e o custo de cada pote são calculados pelo sistema.</p>
        </div>
        <button type="button" onClick={() => onSelectTab('inventory')}>Ver produção</button>
      </section>
    </div>
  );
};
