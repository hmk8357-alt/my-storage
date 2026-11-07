// One-time, explicit text changes to reused public assets. Never reads the diary database.
import {readFileSync,writeFileSync} from 'node:fs';
const file='public/diary/index.html';
let html=readFileSync(file,'utf8');
for(const [before,after] of [
  ['이 컴퓨터에 안전하게 기록 중','내 계정의 클라우드에 기록'],
  ['나만의 로컬 공간','나의 비공개 공간'],
  ['이 컴퓨터의 SQLite에 저장돼요','로그인한 계정의 Firebase에 저장돼요'],
  ['data/diary.sqlite · 외부 서버 전송 없음','일기 원문이 Google 클라우드로 전송돼요. 한 번에 최대 200편 복원.']
]) html=html.replaceAll(before,after);
writeFileSync(file,html);
