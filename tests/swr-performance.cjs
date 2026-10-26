// Deterministic API stubs + production controllers/views in the existing VM DOM harness.
// Run: node tests/swr-performance.cjs. No backend or Telegram device is involved.
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const filename = path.join(__dirname, 'app.test.cjs');
const harness = new Module(filename, module);
harness.filename = filename;
harness.paths = module.paths;
harness._compile(fs.readFileSync(filename, 'utf8').split("\ntest('edit entry points")[0] + '\nmodule.exports = { setup, settled };', filename);
const { setup, settled } = harness.exports;
function countPaints(env) {
  const screen = env.nodes.get('#screen');
  let html = screen.innerHTML, count = 0;
  Object.defineProperty(screen, 'innerHTML', { get: () => html, set: value => { html = value; count++; } });
  return () => count;
}
async function measure() {
  const env = setup(undefined, { stubReload: false, api: action => Promise.resolve(action === 'list_plans' ? {} : []) });
  env.app.cached('txCache:2026-09', []);
  const paints = countPaints(env);
  env.app.openTx(); await settled();
  const fresh = { requests: env.apiCalls.length, paints: paints() };
  env.app.openTx(undefined, true); await settled();
  const unchangedRefresh = { requests: env.apiCalls.length - fresh.requests, paints: paints() - fresh.paints };
  env.app.openPlans(); await settled();
  const beforePlans = env.apiCalls.length;
  env.app.openPlans(); await settled();
  const plansReentryRequests = env.apiCalls.length - beforePlans;
  const cold = setup(undefined, { stubReload: false, api: action => Promise.resolve(action === 'summary' ? { income: 0, expense: 0, categories: [] } : action === 'list_plans' ? {} : []) });
  const coldPaints = countPaints(cold);
  cold.app.clearCache(); cold.app.openSummary(); await settled(); await settled();
  const delays = [];
  for (const delay of [300, 1000]) {
    const slow = setup(undefined, { stubReload: false, api: () => new Promise(resolve => setTimeout(() => resolve([{ ...slow.tx, note: 'network-marker' }]), delay)) });
    slow.app.cached('txCache:2026-09', [{ ...slow.tx, note: 'cache-marker' }]);
    const screen = slow.nodes.get('#screen');
    let html = screen.innerHTML, freshMs = null;
    const start = performance.now();
    Object.defineProperty(screen, 'innerHTML', { get: () => html, set: value => {
      html = value;
      if (value.includes('network-marker')) freshMs = performance.now() - start;
    } });
    slow.app.openTx(undefined, true);
    const cachedMs = performance.now() - start;
    if (!slow.nodes.get('#screen').innerHTML.includes('cache-marker')) throw Error('Cache was not painted synchronously');
    await new Promise(resolve => setTimeout(resolve, delay + 25));
    if (!slow.nodes.get('#screen').innerHTML.includes('network-marker')) throw Error('Server data not painted');
    delays.push({ delayMs: delay, cachedMs: +cachedMs.toFixed(2), freshPaintMs: +freshMs.toFixed(2) });
  }
  process.stdout.write(JSON.stringify({ freshFinance: fresh, unchangedRefresh, plansReentryRequests, coldHome: { requests: cold.apiCalls.length, paints: coldPaints() }, delays }, null, 2) + '\n');
}
measure().catch(error => { console.error(error); process.exitCode = 1; });
