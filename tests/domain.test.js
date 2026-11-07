import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateEntry, validateBackup, createSession, splitBackup} from '../public/diary/domain.js';
const entry = {title:'하루',content:'오늘의 기록',date:'2026-11-07',mood:'calm',tags:['기록'],favorite:false};
test('validates text, dates, tags and strips untrusted ownership fields', () => {
  assert.deepEqual(validateEntry({...entry,ownerId:'someone'}),entry);
  for (const invalid of [{date:'2026-02-30'}, {content:' '}, {content:'a'.repeat(100001)}, {favorite:'yes'}, {tags:[42]}, {tags:Array(11).fill('a')}, {mood:'admin'}]) {
    assert.throws(() => validateEntry({...entry,...invalid}));
  }
});
test('rejects invalid backup entirely, duplicate IDs, paths and excessive batch size', () => {
  const row = {...entry,id:'abc-123',createdAt:'2026-11-07T00:00:00.000Z',updatedAt:'2026-11-07T00:00:00.000Z'};
  assert.equal(validateBackup({version:1,entries:[row]}).length,1);
  for (const rows of [[row,{...row,id:'bad/path'}],[row,row],[{...row,createdAt:'invalid'}],Array(201).fill(row)]) assert.throws(() => validateBackup({version:1,entries:rows}));
});
test('session rejects unauthenticated work and responses from a previous account', async () => {
  const session = createSession();
  assert.throws(() => session.capture());
  session.setUser({uid:'alice'});
  const first = session.capture();
  session.setUser({uid:'bob'});
  assert.throws(() => session.assert(first));
  session.setUser({uid:'alice'});
  assert.throws(() => session.assert(first));
  session.assert(session.capture());
  session.setUser(null);
  assert.throws(() => session.capture());
});
test('every exported part can be restored, with no dropped entries and bounded UTF8 bytes', () => {
  const rows=Array.from({length:401},(_,i)=>({...entry,id:`entry-${i}`,createdAt:'2026-11-07T00:00:00.000Z',updatedAt:'2026-11-07T00:00:00.000Z'}));
  const parts=splitBackup(rows);
  assert.deepEqual(parts.map(p=>validateBackup(JSON.parse(p)).length),[200,200,1]);
  const small=splitBackup(rows.slice(0,5),800);
  assert.equal(small.flatMap(p=>validateBackup(JSON.parse(p))).length,5);
  assert.ok(small.every(p=>new TextEncoder().encode(p).length<=800));
});
