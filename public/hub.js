import {teacherHubUrl} from './hub-config.js';
const search=document.querySelector('#tool-search');
search.addEventListener('input',()=>{
  const query=search.value.trim().toLocaleLowerCase();let count=0;
  for(const card of document.querySelectorAll('[data-search]')){card.hidden=!card.dataset.search.toLocaleLowerCase().includes(query);if(!card.hidden)count++;}
  document.querySelector('#no-results').hidden=count>0;document.querySelector('#search-status').textContent=`${count}개의 도구`;
});
if(/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(teacherHubUrl)) {
  for(const link of document.querySelectorAll('.teacher-link')){link.href=teacherHubUrl;link.hidden=false;}
  for(const label of document.querySelectorAll('.teacher-status'))label.textContent='기존 교사용 도구';
}
