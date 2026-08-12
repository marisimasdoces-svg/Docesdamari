import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_STATE } from '../src/data/initialData';
import { mergeAppStates, stripDeletedRecords } from '../src/lib/syncState';
import { AppState, Sale } from '../src/types';

const sale = (id: string, updatedAt: string, extra: Partial<Sale> = {}): Sale => ({
  id,
  buyerId: 'buyer-1',
  buyerName: 'Cliente',
  department: 'Outros',
  sweetId: 'sweet-1',
  sweetName: 'Bolo de Pote',
  batchId: 'batch-1',
  quantity: 1,
  unitPrice: 13,
  totalPrice: 13,
  saleDate: updatedAt,
  monthKey: '2026-08',
  weekLabel: 'Semana',
  isPaidImmediately: false,
  paymentStatus: 'pending',
  registeredBy: 'Teste',
  updatedAt,
  ...extra,
});

const stateWith = (sales: Sale[]): AppState => ({ ...INITIAL_STATE, sales });

test('preserva uma venda criada em outro aparelho', () => {
  const merged = mergeAppStates(
    stateWith([sale('pc', '2026-08-10T10:00:00.000Z')]),
    stateWith([sale('celular', '2026-08-10T10:01:00.000Z')])
  );
  assert.deepEqual(merged.sales.map((item) => item.id).sort(), ['celular', 'pc']);
});

test('a versão remota mais nova vence uma cópia local antiga', () => {
  const merged = mergeAppStates(
    stateWith([sale('same', '2026-08-10T12:00:00.000Z', { quantity: 4 })]),
    stateWith([sale('same', '2026-08-10T11:00:00.000Z', { quantity: 1 })])
  );
  assert.equal(merged.sales[0].quantity, 4);
});

test('uma exclusão remota não é ressuscitada por aparelho desatualizado', () => {
  const merged = mergeAppStates(
    stateWith([sale('deleted', '2026-08-10T12:00:00.000Z', { deletedAt: '2026-08-10T12:00:00.000Z' })]),
    stateWith([sale('deleted', '2026-08-10T11:00:00.000Z')])
  );
  assert.equal(merged.sales[0].deletedAt, '2026-08-10T12:00:00.000Z');
  assert.equal(stripDeletedRecords(merged).sales.length, 0);
});
