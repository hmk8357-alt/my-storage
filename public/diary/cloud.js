import {firebaseConfig} from '../firebase-config.js';
import {createSession,validateEntry,validateBackup} from './domain.js';
export const session = createSession();
let auth, db, sdk, authSdk;
export async function initialize(onUser) {
  if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId || !firebaseConfig?.authDomain || !firebaseConfig?.appId) throw new Error('아직 클라우드 연결을 준비하고 있어요. 설정이 끝나면 Google 로그인으로 이용할 수 있어요.');
  const [appSdk,authentication,firestore] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js')
  ]);
  sdk=firestore;authSdk=authentication;
  const app=appSdk.initializeApp(firebaseConfig);
  auth=authentication.getAuth(app);
  // Memory-only Firestore cache avoids retaining diary text on shared computers.
  db=firestore.initializeFirestore(app,{localCache:firestore.memoryLocalCache()});
  await authentication.setPersistence(auth,authentication.browserSessionPersistence);
  authentication.onAuthStateChanged(auth,user=>{session.setUser(user);onUser(user);});
}
export async function login() {
  if (!auth) throw new Error('클라우드 설정이 완료되지 않았어요.');
  const provider=new authSdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  await authSdk.signInWithPopup(auth,provider);
}
export async function logout() {if(auth) await authSdk.signOut(auth);}
export function readableError(error) {
  const code=error?.code || '';
  if(code==='auth/popup-closed-by-user') return '로그인 창을 닫았어요. 다시 로그인할 수 있어요.';
  if(code==='auth/popup-blocked') return '팝업을 허용한 뒤 다시 로그인해 주세요.';
  if(code==='auth/unauthorized-domain') return '이 주소의 로그인 연결을 준비하고 있어요. 운영자에게 문의해 주세요.';
  if(code==='permission-denied') return '일기에 접근할 권한이 없어요. 로그인 상태와 연결 설정을 확인해 주세요.';
  if(code==='unavailable' || code==='auth/network-request-failed') return '네트워크 연결을 확인하고 다시 시도해 주세요.';
  return code ? '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' : error.message || '다시 시도해 주세요.';
}
const entryRef=(uid,id)=>sdk.doc(db,'users',uid,'entries',id);
const decode=doc=>{const data=doc.data();return {...validateEntry(data),id:doc.id,createdAt:data.createdAt,updatedAt:data.updatedAt};};
export async function api(path,method='GET',body) {
  const token=session.capture();
  if (!db) throw new Error('클라우드 연결을 확인해 주세요.');
  const own=()=>session.assert(token);
  const list=async()=>{const snapshot=await sdk.getDocsFromServer(sdk.collection(db,'users',token.uid,'entries'));own();return snapshot.docs.map(decode);};
  let result;
  try {
    if(path==='/api/entries' && method==='GET') result=await list();
    else if(path==='/api/backup' && method==='GET') result={version:1,exportedAt:new Date().toISOString(),entries:await list()};
    else if(path==='/api/backup' && method==='POST') {
      const values=validateBackup(body);
      result=await sdk.runTransaction(db,async tx=>{
        own();
        const docs=await Promise.all(values.map(e=>tx.get(entryRef(token.uid,e.id))));
        own();let imported=0;
        values.forEach((e,i)=>{if(!docs[i].exists()){const {id,...value}=e;tx.set(entryRef(token.uid,id),{...value,savedAt:sdk.serverTimestamp()});imported++;}});
        return {imported,skipped:values.length-imported};
      });
    } else if(path==='/api/entries' && method==='POST') {
      const now=new Date().toISOString(), id=crypto.randomUUID();
      const value={...validateEntry(body),createdAt:now,updatedAt:now};
      own();await sdk.setDoc(entryRef(token.uid,id),{...value,savedAt:sdk.serverTimestamp()});
      result={...value,id};
    } else {
      const match=/^\/api\/entries\/([a-zA-Z0-9-]{1,100})$/.exec(path);
      if(!match || !['PUT','DELETE'].includes(method)) throw new Error('지원하지 않는 요청이에요.');
      const ref=entryRef(token.uid,match[1]);
      if(method==='DELETE'){own();await sdk.deleteDoc(ref);result={deleted:true};}
      else {
        const value=validateEntry(body);
        result=await sdk.runTransaction(db,async tx=>{
          own();const existing=await tx.get(ref);own();
          if(!existing.exists()) throw new Error('일기를 찾을 수 없어요. 목록을 새로 불러와 주세요.');
          const entry={...value,createdAt:existing.data().createdAt,updatedAt:new Date().toISOString()};
          tx.set(ref,{...entry,savedAt:sdk.serverTimestamp()});return {...entry,id:ref.id};
        });
      }
    }
    own();return result;
  } catch(error) {own();throw new Error(readableError(error));}
}
