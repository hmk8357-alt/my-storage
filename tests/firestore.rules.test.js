import {test,before,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '../.tools/firebase/node_modules/@firebase/rules-unit-testing/dist/esm/index.esm.js';
import {doc,collection,setDoc,getDoc,getDocs,deleteDoc,updateDoc,serverTimestamp} from '../.tools/firebase/node_modules/firebase/firestore/dist/index.mjs';
let env;
const projectId='demo-teacher-diary-hub';
const sample=()=>({title:'테스트 일기',content:'가상 데이터',date:'2026-11-07',mood:'calm',tags:['기록'],favorite:false,createdAt:'2026-11-07T00:00:00.000Z',updatedAt:'2026-11-07T00:00:00.000Z',savedAt:serverTimestamp()});
const user=(uid,provider='google.com')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).firestore();
before(async()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Run only inside the demo Firestore emulator.');env=await initializeTestEnvironment({projectId,firestore:{rules:await readFile('firestore.rules','utf8')}});});
after(async()=>{if(env)await env.cleanup();});
test('Google owner can create, list, update and delete own records',async()=>{
  const db=user('alice'),ref=doc(db,'users/alice/entries/lifecycle');
  await assertSucceeds(setDoc(ref,sample()));await assertSucceeds(getDoc(ref));await assertSucceeds(getDocs(collection(db,'users/alice/entries')));
  await assertSucceeds(updateDoc(ref,{title:'수정한 가상 일기',savedAt:serverTimestamp()}));await assertSucceeds(deleteDoc(ref));
});
test('unauthenticated, non-Google and foreign users cannot get/list/create/update/delete diary records',async()=>{
  await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'users/alice/entries/private'),sample());});
  for(const db of [env.unauthenticatedContext().firestore(),user('bob'),user('alice','password')]){
    const ref=doc(db,'users/alice/entries/private');
    await assertFails(getDoc(ref));await assertFails(getDocs(collection(db,'users/alice/entries')));
    await assertFails(setDoc(doc(db,'users/alice/entries/injected'),sample()));
    await assertFails(updateDoc(ref,{title:'공격',savedAt:serverTimestamp()}));await assertFails(deleteDoc(ref));
  }
});
test('strict schema and bounded fields apply equally to create and update',async()=>{
  const db=user('validator');
  const invalid=[{title:'a'.repeat(121)},{content:'a'.repeat(100001)},{date:'bad'},{mood:'admin'},{tags:[42]},{tags:Array(11).fill('a')},{tags:['a'.repeat(31)]},{favorite:'yes'},{extraData:'unexpected'},{createdAt:42},{updatedAt:'bad'},{savedAt:new Date(0)}];
  for(let i=0;i<invalid.length;i++){
    const ref=doc(db,`users/validator/entries/case-${i}`);
    await assertFails(setDoc(ref,{...sample(),...invalid[i]}));
    await assertSucceeds(setDoc(ref,sample()));
    await assertFails(updateDoc(ref,{...invalid[i],...(Object.hasOwn(invalid[i],'savedAt')?{}:{savedAt:serverTimestamp()})}));
  }
  const ref=doc(db,'users/validator/entries/missing');
  const missing=sample();delete missing.content;await assertFails(setDoc(ref,missing));
});
test('createdAt is immutable, public profiles and arbitrary paths are denied',async()=>{
  const db=user('alice'),ref=doc(db,'users/alice/entries/immutable');await assertSucceeds(setDoc(ref,sample()));
  await assertFails(updateDoc(ref,{createdAt:'2025-01-01T00:00:00.000Z',savedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(db,'users/alice'),{isAdmin:true}));await assertFails(getDoc(doc(db,'users/alice')));
  await assertFails(getDocs(collection(db,'users')));await assertFails(setDoc(doc(db,'public/diary'),sample()));
});
