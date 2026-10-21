const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { spawnSync } = require('node:child_process');

test('calendar date uses local day at UTC boundaries, including fallback parsing', () => {
  const formatPath = require.resolve('../src/format.js');
  for (const [zone, expected] of [['Pacific/Kiritimati', '2026-10-22'], ['America/Los_Angeles', '2026-10-21']]) {
    const script = `const fs=require('node:fs'),vm=require('node:vm');
      const NativeDate=Date; class FixedDate extends NativeDate { constructor(...args){super(...(args.length?args:['2026-10-21T23:30:00Z']));} }
      const context={window:{},Date:FixedDate}; vm.runInNewContext(fs.readFileSync(${JSON.stringify(formatPath)},'utf8'),context);
      const f=context.window.Fmt; process.stdout.write(JSON.stringify([f.todayIso(),f.isoDate(f.parseDate(null)),f.isoDate(f.parseDate('2026-09-30'))]));`;
    const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env: { ...process.env, TZ: zone } });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [expected, expected, '2026-09-30']);
  }
});

test('finance title, editing and sort controls are translated in supported languages', () => {
  for (const locale of ['en', 'es']) {
    const context = { window: { localStorage: { getItem: () => locale } } };
    runInNewContext(readFileSync(require.resolve('../src/i18n.js'), 'utf8'), context);
    for (const text of ['Финансы', 'Редактировать расход', 'По сумме', 'Показать пустые категории']) {
      assert.doesNotMatch(context.window.I18n.t(text), /[А-Яа-я]/);
    }
  }
});
