const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const context = { window: {} };
runInNewContext(readFileSync(require.resolve('../src/recurring.js'), 'utf8'), context);
const { upcoming, reminderDays } = context.window.Recurring;
const day = (year, month, date) => new Date(year, month - 1, date, 12);

test('existing payments default to one day; zero means payment day only', () => {
  assert.equal(reminderDays(undefined), 1);
  assert.equal(reminderDays(null), 1);
  assert.equal(reminderDays(0), 0);
  assert.equal(upcoming({ day_of_month: 21 }, day(2026, 10, 20)).visible, true);
  assert.equal(upcoming({ day_of_month: 21, reminder_days: 0 }, day(2026, 10, 20)).visible, false);
  assert.equal(upcoming({ day_of_month: 21, reminder_days: 0 }, day(2026, 10, 21)).visible, true);
});
test('custom window includes its first day but excludes earlier days', () => {
  const payment = { day_of_month: 25, reminder_days: 5 };
  assert.equal(upcoming(payment, day(2026, 10, 19)).visible, false);
  assert.equal(upcoming(payment, day(2026, 10, 20)).visible, true);
  assert.equal(upcoming(payment, day(2026, 10, 25)).diff, 0);
  assert.equal(upcoming(payment, day(2026, 10, 26)).visible, false);
});
test('reminders cross month and year boundaries', () => {
  const payment = { day_of_month: 2, reminder_days: 5 };
  assert.equal(upcoming(payment, day(2026, 10, 30)).date, '2026-11-02');
  assert.equal(upcoming(payment, day(2026, 10, 30)).diff, 3);
  assert.equal(upcoming(payment, day(2026, 12, 30)).date, '2027-01-02');
  assert.equal(upcoming(payment, day(2026, 12, 30)).visible, true);
});
test('31st clamps to month end including leap years', () => {
  assert.equal(upcoming({ day_of_month: 31 }, day(2026, 2, 27)).date, '2026-02-28');
  assert.equal(upcoming({ day_of_month: 31 }, day(2028, 2, 28)).date, '2028-02-29');
});
test('disabled payments and invalid windows', () => {
  assert.equal(upcoming({ day_of_month: 20, active: false }, day(2026, 10, 20)).visible, false);
  for (const value of [-1, 31, 1.5, 'abc']) assert.equal(reminderDays(value), 1);
  assert.equal(reminderDays(30), 30);
});
