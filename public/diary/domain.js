const moods = new Set(['great','good','calm','sad','tired']);
export function validateEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('일기 형식을 확인해 주세요.');
  const {title,content,date,mood,tags=[],favorite=false} = value;
  if (typeof title !== 'string' || title.length > 120) throw new Error('제목은 120자 이내로 입력해 주세요.');
  if (typeof content !== 'string' || !content.trim() || content.length > 100000) throw new Error('내용은 1~100,000자로 입력해 주세요.');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error('올바른 날짜를 선택해 주세요.');
  if (!moods.has(mood) || typeof favorite !== 'boolean') throw new Error('기분과 소중한 일기 표시를 확인해 주세요.');
  if (!Array.isArray(tags) || tags.length > 10 || tags.some(t => typeof t !== 'string' || !t.trim() || t.length > 30)) throw new Error('태그는 30자 이내로 최대 10개까지 입력해 주세요.');
  return {title:title.trim() || '제목 없는 하루',content,date,mood,tags:[...new Set(tags.map(t=>t.trim()))],favorite};
}
export function validateBackup(backup) {
  if (!backup || backup.version !== 1 || !Array.isArray(backup.entries) || backup.entries.length > 200) throw new Error('버전 1 백업을 선택해 주세요. 한 번에 최대 200편까지 복원할 수 있어요.');
  const ids = new Set();
  return backup.entries.map(row => {
    const value = validateEntry(row);
    if (typeof row.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(row.id) || ids.has(row.id) || ![row.createdAt,row.updatedAt].every(t => typeof t === 'string' && t.length <= 30 && Number.isFinite(Date.parse(t)))) throw new Error('백업의 ID·시간 정보 또는 중복 기록을 확인해 주세요.');
    ids.add(row.id);
    return {...value,id:row.id,createdAt:new Date(row.createdAt).toISOString(),updatedAt:new Date(row.updatedAt).toISOString()};
  });
}
export function createSession() {
  let uid = null, revision = 0;
  return {
    setUser(user) {uid=user?.uid || null; revision++;},
    capture() {if (!uid) throw new Error('Google 로그인 후 이용해 주세요.'); return {uid,revision};},
    assert(token) {if (!uid || token.uid !== uid || token.revision !== revision) throw new Error('계정이 변경되어 작업을 중단했어요. 다시 시도해 주세요.');}
  };
}
export function splitBackup(entries,maxBytes=5*1024*1024) {
  const exportedAt=new Date().toISOString();
  const serialize=rows=>JSON.stringify({version:1,exportedAt,entries:rows});
  const bytes=text=>new TextEncoder().encode(text).length;
  const parts=[];let group=[];
  for(const entry of entries){
    const next=[...group,entry];
    if(next.length>200 || bytes(serialize(next))>maxBytes){
      if(!group.length)throw new Error('한 편의 일기가 백업 파일 크기 제한을 넘었어요.');
      parts.push(serialize(group));group=[];
    }
    group.push(entry);
    if(bytes(serialize(group))>maxBytes)throw new Error('한 편의 일기가 백업 파일 크기 제한을 넘었어요.');
  }
  if(group.length || !parts.length)parts.push(serialize(group));
  return parts;
}
