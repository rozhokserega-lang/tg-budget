import {test} from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {telegramUser} from '../functions/leisure/auth.ts';
const token='test-token',now=Date.now();
function signed(date=Math.floor(now/1000)){
 const q=new URLSearchParams({auth_date:String(date),user:JSON.stringify({id:12345,first_name:'Test'}),query_id:'abc'});
 const secret=createHmac('sha256','WebAppData').update(token).digest();
 const hash=createHmac('sha256',secret).update([...q.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex');q.set('hash',hash);return q.toString();
}
test('Telegram HMAC, expiry, replay field ambiguity and tampering',async()=>{
 assert.equal(await telegramUser(signed(),token,now),'12345');
 await assert.rejects(telegramUser(signed()+'&auth_date=1',token,now));await assert.rejects(telegramUser(signed().replace('12345','54321'),token,now));await assert.rejects(telegramUser(signed(Math.floor(now/1000)-86401),token,now));await assert.rejects(telegramUser(signed(),token+'bad',now));await assert.rejects(telegramUser(signed(Math.floor(now/1000)+120),token,now));
});
