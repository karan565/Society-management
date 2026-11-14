import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dateSchema,
  mapComplaintStatus,
  mapComplaintType,
  mapPaymentMethod,
  mapTransactionType,
  monthSchema,
  passwordSchema
} from '../src/lib/validation.js';

test('calendar values reject malformed or impossible dates', () => {
  assert.equal(monthSchema.safeParse('2026-11').success, true);
  assert.equal(monthSchema.safeParse('2026-13').success, false);
  assert.equal(dateSchema.safeParse('2024-02-29').success, true);
  assert.equal(dateSchema.safeParse('2026-02-29').success, false);
});

test('payment, complaint, and finance labels map to database enums', () => {
  assert.equal(mapPaymentMethod('UPI'), 'UPI');
  assert.equal(mapPaymentMethod('Cash'), 'CASH');
  assert.equal(mapComplaintType('Suggestion'), 'SUGGESTION');
  assert.equal(mapComplaintStatus('in progress'), 'IN_PROGRESS');
  assert.equal(mapTransactionType('income'), 'INCOME');
});

test('password schema accepts frontend-compatible passwords and rejects short ones', () => {
  assert.equal(passwordSchema.safeParse('strongpass8').success, true);
  assert.equal(passwordSchema.safeParse('short').success, false);
});
