export async function telegramUser(init: string, token: string, now = Date.now()): Promise<string> {
  if (!init || init.length > 16384 || !token) throw new Error('UNAUTHORIZED');
  const q = new URLSearchParams(init), hash = q.get('hash') || '';
  if ([...new Set(q.keys())].some(k => q.getAll(k).length !== 1)) throw new Error('UNAUTHORIZED');
  const date = Number(q.get('auth_date'));
  if (!Number.isFinite(date) || date <= 0 || now/1000-date > 86400 || date-now/1000 > 60 || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('UNAUTHORIZED');
  q.delete('hash');
  const enc = new TextEncoder();
  async function hmac(key: Uint8Array, value: string) {
    const k = await crypto.subtle.importKey('raw', new Uint8Array(key).buffer, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(value)));
  }
  const secret = await hmac(enc.encode('WebAppData'), token);
  const result = await hmac(secret, [...q.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n'));
  let diff=0; for(let i=0;i<32;i++) diff |= result[i] ^ parseInt(hash.slice(i*2,i*2+2),16);
  if(diff) throw new Error('UNAUTHORIZED');
  const user = JSON.parse(q.get('user') || '{}');
  if (!Number.isSafeInteger(user.id) || user.id<=0) throw new Error('UNAUTHORIZED');
  return String(user.id);
}
