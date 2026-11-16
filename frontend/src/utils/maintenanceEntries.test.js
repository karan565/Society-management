import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMaintenanceEntries } from './maintenanceEntries.js';

const user = {
  id: 'resident-1',
  societyId: 'society-1',
  role: 'resident',
  createdAt: '2026-11-02T00:00:00.000Z'
};
const society = {
  id: 'society-1',
  createdAt: '2026-10-10T00:00:00.000Z',
  maintenanceAmount: 3500,
  initialMaintenanceAmount: 3500,
  maintenanceEffectiveFrom: '2026-10',
  maintenanceOverrides: []
};

test('generates unpaid entries from the later creation month through the current month', () => {
  const entries = buildMaintenanceEntries([user], society, [], new Date('2026-12-01T00:00:00.000Z'));

  assert.deepEqual(
    entries.map(({ month }) => month),
    ['2026-11', '2026-12']
  );
  assert.ok(entries.every((entry) => entry.isVirtual && entry.amount === 3500));
});

test('never generates entries before the society creation month', () => {
  const laterSociety = { ...society, createdAt: '2026-12-20T00:00:00.000Z' };
  const entries = buildMaintenanceEntries([user], laterSociety, [], new Date('2027-01-01T00:00:00.000Z'));

  assert.deepEqual(
    entries.map(({ month }) => month),
    ['2026-12', '2027-01']
  );
});

test('preserves the initial rate before a later permanent rate takes effect', () => {
  const newSociety = {
    ...society,
    maintenanceAmount: 9000,
    initialMaintenanceAmount: 7250,
    maintenanceEffectiveFrom: '2027-01'
  };
  const entries = buildMaintenanceEntries([user], newSociety, [], new Date('2027-01-16T00:00:00.000Z'));

  assert.deepEqual(
    entries.map(({ month, amount }) => ({ month, amount })),
    [
      { month: '2026-11', amount: 7250 },
      { month: '2026-12', amount: 7250 },
      { month: '2027-01', amount: 9000 }
    ]
  );
});

test('does not replace a persisted bill and uses the scheduled rate for remaining months', () => {
  const bills = [
    { id: 'paid-1', userId: user.id, month: '2026-11', amount: 3500, status: 'paid' },
    { id: 'requested-1', userId: user.id, month: '2026-12', amount: 4000, status: 'pending', paymentRequest: {} }
  ];
  const scheduledSociety = {
    ...society,
    maintenanceEffectiveFrom: '2026-12',
    maintenanceAmount: 4000
  };

  const entries = buildMaintenanceEntries([user], scheduledSociety, bills, new Date('2027-01-01T00:00:00.000Z'));

  assert.deepEqual(
    entries.map(({ id, month, amount }) => ({ id, month, amount })),
    [
      { id: 'paid-1', month: '2026-11', amount: 3500 },
      { id: 'requested-1', month: '2026-12', amount: 4000 },
      { id: 'unpaid-resident-1-2027-01', month: '2027-01', amount: 4000 }
    ]
  );
});
