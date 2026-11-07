import {api, session, initialize, login, logout, readableError} from './cloud.js';
import {splitBackup} from './domain.js';
const $ = selector => document.querySelector(selector);
const icon = (name, small = false) => `<svg class="icon${small ? ' small' : ''}" aria-hidden="true"><use href="#${name}"/></svg>`;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const moods = [
  { id: 'great', label: '행복해요', color: '#a58d4c', bg: '#f4edcc', mouth: '<path d="M7 12h10c0 6-10 6-10 0Z"/>' },
  { id: 'good', label: '좋아요', color: '#8a9c5c', bg: '#eef1da', mouth: '<path d="M7.5 13q4.5 5 9 0"/>' },
  { id: 'calm', label: '평온해요', color: '#7e9473', bg: '#e7eddf', mouth: '<path d="M8 14h8"/>' },
  { id: 'sad', label: '속상해요', color: '#8295a1', bg: '#e9eef1', mouth: '<path d="M8 16q4-4 8 0"/>' },
  { id: 'tired', label: '지쳤어요', color: '#a694aa', bg: '#eee9ef', mouth: '<path d="M9 15h6"/>' }
];
const face = id => {
  const mood = moods.find(m => m.id === id) || moods[2];
  return `<svg class="mood-face" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="${mood.bg}" stroke="${mood.color}"/><g fill="none" stroke="${mood.color}" stroke-linecap="round">${id === 'tired' ? '<path d="M6.5 9h3m5 0h3"/>' : '<path d="M8 9v1m8-1v1"/>'}${mood.mouth}</g></svg>`;
};
const state = { entries: [], id: null, mood: 'calm', favorite: false, dirty: false, saving: false, view: 'all', day: '', query: '', moodFilter: '', newest: true, year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1, loaded: false };
let toastTimer;
let backupUrls=[];
function clearBackupLinks(){for(const url of backupUrls)URL.revokeObjectURL(url);backupUrls=[];$('#backup-parts').replaceChildren();}
function notify(message, error = false) {
  clearTimeout(toastTimer);
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, error ? 6500 : 3500);
}
function setDirty() {
  state.dirty = true;
  $('#save-state').textContent = '저장하지 않은 변경사항';
  $('#save-state').classList.add('dirty');
}
function canLeave() {
  if (state.saving) { notify('저장이 끝날 때까지 잠시 기다려 주세요.'); return false; }
  return !state.dirty || window.confirm('저장하지 않은 내용이 있어요. 변경사항을 버리고 이동할까요?');
}
function updateWeekday() {
  const date = $('#entry-date').value;
  $('#entry-weekday').textContent = date ? new Intl.DateTimeFormat('ko-KR', { weekday: 'long' }).format(new Date(date + 'T12:00:00')) : '';
}
function renderMoods() {
  $('#mood-picker').innerHTML = moods.map(mood => `<button type="button" class="mood-button" data-mood="${mood.id}" aria-pressed="${state.mood === mood.id}">${face(mood.id)}${mood.label}</button>`).join('');
}
function renderFavorite() {
  const button = $('#favorite-entry');
  button.setAttribute('aria-pressed', String(state.favorite));
  button.setAttribute('aria-label', state.favorite ? '소중한 일기 표시 해제' : '소중한 일기로 표시');
}
function openEntry(entry, { check = true, mobile = true } = {}) {
  if (check && !canLeave()) return;
  state.id = entry?.id || null;
  state.mood = entry?.mood || 'calm';
  state.favorite = entry?.favorite || false;
  state.dirty = false;
  $('#entry-date').value = entry?.date || state.day || today;
  $('#entry-title').value = entry?.title || '';
  $('#entry-content').value = entry?.content || '';
  $('#entry-tags').value = entry?.tags.join(', ') || '';
  $('#character-count').textContent = `${(entry?.content.length || 0).toLocaleString('ko-KR')}자`;
  $('#editor-label').textContent = entry ? '다시 꺼내 보는 하루' : '새로운 하루의 기록';
  $('#save-state').textContent = entry ? '저장된 기록' : '나만 볼 수 있어요';
  $('#save-state').classList.remove('dirty');
  $('#delete-entry').hidden = !entry;
  $('#save-entry').innerHTML = `${icon('check', true)}${entry ? '변경사항 저장' : '일기 저장하기'}`;
  updateWeekday();
  renderMoods();
  renderFavorite();
  renderList();
  $('.paper').scrollTop = 0;
  if (mobile) $('.workspace').classList.add('editor-open');
}
function filteredEntries() {
  const query = state.query.toLocaleLowerCase();
  let entries = state.entries.filter(e =>
    (state.view !== 'favorites' || e.favorite) &&
    (!state.day || e.date === state.day) &&
    (!state.moodFilter || e.mood === state.moodFilter) &&
    (!query || `${e.title}\n${e.content}\n${e.tags.join(' ')}`.toLocaleLowerCase().includes(query))
  );
  entries.sort((a, b) => (b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) * (state.newest ? 1 : -1));
  return entries;
}
function shortDate(date) {
  const value = new Date(date + 'T12:00:00');
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일 · ${new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(value)}`;
}
function renderList() {
  if (!state.loaded) return;
  const entries = filteredEntries();
  $('#list-title').textContent = state.view === 'favorites' ? '소중한 일기' : state.view === 'today' ? '오늘의 기록' : '모든 일기';
  $('#list-count').textContent = `${entries.length}편`;
  $('#sort-order').textContent = state.newest ? '최신순 ↓' : '오래된순 ↑';
  $('#clear-date').hidden = !state.day;
  $('#clear-date span').textContent = state.day ? shortDate(state.day) : '';
  const list = $('#entries-list');
  if (!entries.length) {
    const noRecords = !state.entries.length;
    list.innerHTML = `<div class="empty-list"><svg class="empty-art" viewBox="0 0 110 120" fill="none" aria-hidden="true"><path d="m28 34 49-8 11 69-49 8Z" fill="#e9eddf" stroke="#c0cbb0"/><rect x="22" y="25" width="52" height="70" rx="4" fill="#fdfcf5" stroke="#b5c3a3"/><path d="M32 44h30M32 53h30M32 62h22M32 71h26" stroke="#d9e1cb" stroke-linecap="round"/><path d="M69 34V16m0 10C59 27 57 16 57 16s12-1 12 10Zm0-7c0-9 12-12 12-12s2 12-12 12Z" stroke="#8fa37a" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 106h67" stroke="#dfe5d5" stroke-linecap="round"/><circle cx="87" cy="48" r="2" fill="#cbd6b8"/><circle cx="16" cy="74" r="1.5" fill="#cbd6b8"/></svg><h3>${noRecords ? '아직 펼치지 않은 이야기' : '잠시, 다른 기억을 찾아볼까요?'}</h3><p>${noRecords ? '완벽한 하루가 아니어도 괜찮아요.<br>오늘의 첫 조각을 남겨보세요.' : '선택한 조건에 맞는 일기가 없어요.<br>검색어나 필터를 바꿔보세요.'}</p><button data-action="${noRecords ? 'new' : 'reset'}">${icon(noRecords ? 'plus' : 'search', true)}${noRecords ? '첫 일기 쓰기' : '필터 초기화'}</button></div>`;
  } else {
    list.innerHTML = entries.map(e => `<button class="entry-card${state.id === e.id ? ' selected' : ''}" data-id="${escape(e.id)}" aria-label="${escape(e.title)}, ${escape(e.date)}" ${state.id === e.id ? 'aria-current="true"' : ''}><div class="card-meta"><span>${face(e.mood)}${shortDate(e.date)}</span>${e.favorite ? icon('star', true) : ''}</div><h3>${escape(e.title)}</h3><p class="card-preview">${escape(e.content)}</p>${e.tags.length ? `<div class="card-tags">${e.tags.slice(0, 3).map(tag => `<span>#${escape(tag)}</span>`).join('')}</div>` : ''}</button>`).join('');
  }
  $('#list-footer-text').textContent = state.entries.length ? `${new Set(state.entries.map(e => e.date)).size}일의 기억, ${state.entries.length}개의 조각` : '오늘의 작은 조각을 남겨보세요.';
}
function renderCalendar() {
  $('#calendar-title').textContent = `${state.year}년 ${state.month + 1}월`;
  const first = new Date(state.year, state.month, 1).getDay();
  const total = new Date(state.year, state.month + 1, 0).getDate();
  const dates = new Set(state.entries.map(e => e.date));
  let html = '<span></span>'.repeat(first);
  for (let day = 1; day <= total; day++) {
    const date = `${String(state.year).padStart(4, '0')}-${String(state.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    html += `<button class="day${date === today ? ' today' : ''}${date === state.day ? ' selected' : ''}${dates.has(date) ? ' has-entry' : ''}" data-date="${date}" aria-label="${state.year}년 ${state.month + 1}월 ${day}일${dates.has(date) ? ', 기록 있음' : ''}" aria-pressed="${state.day === date}">${day}</button>`;
  }
  $('#calendar-grid').innerHTML = html;
}
function renderNavigation() {
  $('#all-count').textContent = state.entries.length;
  $('#favorite-count').textContent = state.entries.filter(e => e.favorite).length;
  for (const name of ['all', 'favorites', 'today']) {
    const button = $(`#nav-${name}`);
    button.classList.toggle('active', state.view === name);
    if (state.view === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
}
function renderAll() { renderNavigation(); renderCalendar(); renderList(); }
function resetFilters() {
  state.day = ''; state.moodFilter = ''; state.query = ''; state.view = 'all';
  $('#search').value = ''; $('#mood-filter').value = '';
  renderAll();
}
async function loadEntries(initial = false) {
  try {
    state.entries = await api('/api/entries');
    state.loaded = true;
    renderAll();
    if (initial && !state.dirty) openEntry(filteredEntries()[0], { check: false, mobile: false });
    return true;
  } catch (error) {
    notify(error.message, true);
    if (!state.loaded) $('#entries-list').innerHTML = '<div class="empty-list"><h3>기록을 불러오지 못했어요</h3><p>네트워크와 로그인 상태를 확인해 주세요.</p><button data-action="retry">다시 불러오기</button></div>';
    return false;
  }
}

$('#today-label').textContent = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full', timeZone: 'Asia/Seoul' }).format(new Date());
$('#new-entry').addEventListener('click', () => { openEntry(); if (!state.dirty) $('#entry-title').focus(); });
$('#entries-list').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.action === 'new') { openEntry(); $('#entry-title').focus(); }
  else if (button.dataset.action === 'reset') resetFilters();
  else if (button.dataset.action === 'retry') loadEntries(true);
  else if (button.dataset.id) {
    if (state.id === button.dataset.id) { $('.workspace').classList.add('editor-open'); return; }
    openEntry(state.entries.find(e => e.id === button.dataset.id));
  }
});
$('#search').addEventListener('input', event => { state.query = event.target.value; renderList(); });
$('#mood-filter').addEventListener('change', event => { state.moodFilter = event.target.value; renderList(); });
$('#sort-order').addEventListener('click', () => { state.newest = !state.newest; renderList(); });
for (const name of ['all', 'favorites', 'today']) $(`#nav-${name}`).addEventListener('click', () => {
  state.view = name;
  state.day = name === 'today' ? today : '';
  renderAll();
  $('.workspace').classList.remove('editor-open');
});
$('#clear-date').addEventListener('click', () => { state.day = ''; if (state.view === 'today') state.view = 'all'; renderAll(); });
for (const [selector, change] of [['#prev-month', -1], ['#next-month', 1]]) $(selector).addEventListener('click', () => {
  const month = new Date(state.year, state.month + change, 1);
  state.year = month.getFullYear(); state.month = month.getMonth(); renderCalendar();
});
$('#calendar-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-date]');
  if (!button) return;
  state.day = state.day === button.dataset.date ? '' : button.dataset.date;
  state.view = 'all'; renderAll(); $('.workspace').classList.remove('editor-open');
});
$('#back-to-list').addEventListener('click', () => $('.workspace').classList.remove('editor-open'));
$('#entry-form').addEventListener('input', event => {
  setDirty();
  if (event.target.id === 'entry-content') $('#character-count').textContent = `${event.target.value.length.toLocaleString('ko-KR')}자`;
  if (event.target.id === 'entry-date') updateWeekday();
});
$('#mood-picker').addEventListener('click', event => {
  const button = event.target.closest('[data-mood]');
  if (!button || state.saving) return;
  state.mood = button.dataset.mood; renderMoods(); setDirty();
});
$('#favorite-entry').addEventListener('click', () => {
  if (state.saving) return;
  state.favorite = !state.favorite; renderFavorite(); setDirty();
});
$('#entry-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.saving) return;
  const content = $('#entry-content').value;
  if (!content.trim()) { notify('오늘의 이야기를 한 줄 남겨주세요.', true); $('#entry-content').focus(); return; }
  const tags = $('#entry-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  if (tags.length > 10 || tags.some(t => t.length > 30)) { notify('태그는 각 30자 이내로, 최대 10개까지 적어주세요.', true); $('#entry-tags').focus(); return; }
  const body = { title: $('#entry-title').value, content, date: $('#entry-date').value, mood: state.mood, tags, favorite: state.favorite };
  state.saving = true;
  $('#save-entry').disabled = true;
  $('#save-entry').textContent = '저장하는 중…';
  // Lock editable fields during the request so late responses cannot erase newer edits.
  for (const input of $('#entry-form').querySelectorAll('input,textarea')) input.readOnly = true;
  try {
    const saved = await api(state.id ? `/api/entries/${state.id}` : '/api/entries', state.id ? 'PUT' : 'POST', body);
    state.entries = [...state.entries.filter(e => e.id !== saved.id), saved];
    openEntry(saved, { check: false });
    $('#save-state').textContent = '내 계정의 클라우드에 저장했어요';
    renderAll();
    notify('오늘의 조각을 소중히 담았어요.');
  } catch (error) {
    notify(error.message, true);
    $('#save-entry').innerHTML = `${icon('check', true)}다시 저장하기`;
  } finally {
    state.saving = false;
    $('#save-entry').disabled = false;
    for (const input of $('#entry-form').querySelectorAll('input,textarea')) input.readOnly = false;
  }
});
$('#delete-entry').addEventListener('click', async () => {
  if (!state.id || state.saving || !window.confirm('이 일기를 삭제할까요? 삭제한 기록은 되돌릴 수 없어요.')) return;
  const id = state.id;
  state.saving = true;
  for (const input of $('#entry-form').querySelectorAll('input,textarea')) input.readOnly = true;
  $('#delete-entry').disabled = true;
  try {
    await api(`/api/entries/${id}`, 'DELETE');
    state.entries = state.entries.filter(e => e.id !== id);
    state.dirty = false;
    openEntry(filteredEntries()[0], { check: false, mobile: false });
    renderAll();
    notify('일기를 삭제했어요.');
  } catch (error) { notify(error.message, true); }
  finally { state.saving = false; $('#delete-entry').disabled = false; for(const input of $('#entry-form').querySelectorAll('input,textarea'))input.readOnly=false; }
});
$('#open-backup').addEventListener('click', () => $('#backup-dialog').showModal());
$('#close-backup').addEventListener('click', () => $('#backup-dialog').close());
$('#backup-dialog').addEventListener('click', event => { if (event.target === $('#backup-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });
$('#export-backup').addEventListener('click', async () => {
  $('#export-backup').disabled = true;
  try {
    const backup = await api('/api/backup');
    clearBackupLinks();
    const parts=splitBackup(backup.entries);
    const heading=document.createElement('p');heading.textContent=`${backup.entries.length}편을 ${parts.length}개 파일로 준비했어요. 아래 파일을 모두 내려받아 보관해 주세요.`;$('#backup-parts').append(heading);
    parts.forEach((part,index)=>{
      const url=URL.createObjectURL(new Blob([part],{type:'application/json;charset=utf-8'}));backupUrls.push(url);
      const link=document.createElement('a');link.href=url;link.download=`오늘의조각-${today}-${index+1}of${parts.length}.json`;link.textContent=`백업 ${index+1} / ${parts.length} 내려받기`;link.className='backup-part';$('#backup-parts').append(link);
    });
    notify('백업 파일이 준비됐어요. 파일 링크를 눌러 내려받아 주세요.');
  } catch (error) { notify(error.message, true); }
  finally { $('#export-backup').disabled = false; }
});
$('#import-backup').addEventListener('click', () => $('#backup-file').click());
$('#backup-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  $('#import-backup').disabled = true;
  try {
    const account = session.capture();
    if (file.size > 5 * 1024 * 1024) throw new Error('백업은 최대 5MB까지 불러올 수 있어요.');
    let data;
    try { data = JSON.parse(await file.text()); } catch { throw new Error('JSON 백업 파일을 선택해 주세요.'); }
    session.assert(account);
    if (!window.confirm('이 백업의 일기 원문을 현재 로그인한 계정의 Firebase에 저장할까요? 한 번에 최대 200편까지 복원할 수 있어요.')) return;
    const result = await api('/api/backup', 'POST', data);
    const loaded = await loadEntries();
    if (loaded) notify(`${result.imported}편을 불러왔어요.${result.skipped ? ` 중복된 ${result.skipped}편은 건너뛰었어요.` : ''}`);
  } catch (error) { notify(error.message, true); }
  finally { event.target.value = ''; $('#import-backup').disabled = false; }
});
window.addEventListener('beforeunload', event => { if (state.dirty || state.saving) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('keydown', event => {
  if ($('#backup-dialog').open) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); $('#entry-form').requestSubmit(); }
  if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) { event.preventDefault(); openEntry(); }
});
updateWeekday();
renderMoods();
renderCalendar();
$('#google-login').addEventListener('click', async () => {
  $('#google-login').disabled = true;
  try {await login();} catch(error) {$('#auth-message').textContent=readableError(error);}
  finally {$('#google-login').disabled=false;}
});
$('#logout').addEventListener('click', async () => {
  if (!canLeave()) return;
  try {await logout();} catch(error) {notify(readableError(error),true);}
});
try {
  await initialize(async user => {
    // Clear text synchronously before showing any new account or issuing requests.
    state.entries=[];state.loaded=false;state.id=null;state.dirty=false;state.saving=false;
    clearBackupLinks();
    $('#backup-dialog').close();$('#backup-file').value='';
    clearTimeout(toastTimer);$('#toast').hidden=true;
    $('#search').value='';$('#mood-filter').value='';state.query='';state.moodFilter='';state.day='';state.view='all';
    $('#entries-list').replaceChildren();
    openEntry(null,{check:false,mobile:false});
    $('#all-count').textContent='0';$('#favorite-count').textContent='0';$('#list-count').textContent='0편';
    renderCalendar();
    $('.app-shell').hidden=!user;$('.app-shell').inert=!user;
    $('#auth-panel').hidden=!!user;$('#account-bar').hidden=!user;
    $('#account-name').textContent=user?.displayName || '나의 계정';
    if(user) await loadEntries(true);
  });
  $('#google-login').disabled=false;
  $('#auth-message').textContent='Google 계정으로 나만의 기록을 이어가세요.';
} catch(error) {$('#auth-message').textContent=readableError(error);$('#google-login').disabled=true;}
