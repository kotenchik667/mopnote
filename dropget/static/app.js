const $ = s => document.querySelector(s);
const form = $('#jobForm'), input = $('#mediaUrl'), submit = $('#submitBtn');
const status = $('#statusArea'), label = $('#statusLabel'), detail = $('#statusText'), symbol = $('#statusSymbol');
const output = $('#downloadLink');
const api = (window.DROPGET_API || '').replace(/\/$/, '');
let timer;
function show(state, headline, description) {
  status.hidden = false;
  status.className = 'status ' + state;
  label.textContent = headline;
  detail.textContent = description;
  symbol.textContent = state === 'error' ? '×' : state === 'success' ? '✓' : '✳';
  symbol.className = state ? '' : 'spin';
  output.hidden = true;
}
function finish(){submit.disabled=false;submit.querySelector('span').textContent='ЗАГРУЗИТЬ ФАЙЛ';}
function err(e){show('error','ОШИБКА',e.message || 'Не удалось выполнить запрос.');finish();}
async function send(path, options){
  const r = await fetch(api + path, options);
  let data;
  try { data = await r.json(); } catch { throw Error('Сервер загрузки недоступен. Для работы нужен запущенный backend.'); }
  if(!r.ok) throw Error(typeof data.detail === 'string' ? data.detail : 'Ошибка сервера ('+r.status+').');
  return data;
}
async function poll(id){
  const x=await send('/api/jobs/'+encodeURIComponent(id));
  if(x.state === 'error') throw Error(x.error || 'Ошибка при получении медиа.');
  if(x.state === 'ready') {
    show('success','ФАЙЛ ГОТОВ', x.filename + ' / ' + (x.size/1048576).toFixed(1) + ' MB');
    output.href=api+'/api/files/'+encodeURIComponent(id);
    output.setAttribute('download',x.filename);
    output.hidden=false;
    finish();
    return;
  }
  show('',x.state === 'queued'?'В ОЧЕРЕДИ':'ПОДГОТОВКА ФАЙЛА','Источник обрабатывается. Обычно это занимает некоторое время.');
  timer=setTimeout(()=>poll(id).catch(err),1600);
}
form.addEventListener('submit', async event=>{
  event.preventDefault();clearTimeout(timer);
  const url=input.value.trim(),mode=$('input[name="mode"]:checked').value;
  if(!/^https:\/\//i.test(url)){err(Error('Нужна ссылка, начинающаяся с https://'));return;}
  submit.disabled=true;submit.querySelector('span').textContent='ОБРАБОТКА...';
  show('','ПРОВЕРКА ССЫЛКИ','Связываемся с сервером.');
  try {
    const job=await send('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,mode})});
    await poll(job.id);
  }catch(e){err(e);}
});
$('#pasteBtn').addEventListener('click',async()=>{
  try{input.value=await navigator.clipboard.readText();input.focus();}catch{input.focus();}
});
(async function ads(){
  try{
    const x=await send('/api/ads');
    if(!x.client||!x.slot)return;
    const area=$('#adContainer');area.replaceChildren();
    const ins=document.createElement('ins');ins.className='adsbygoogle';ins.style.display='block';ins.dataset.adClient=x.client;ins.dataset.adSlot=x.slot;ins.dataset.adFormat='auto';ins.dataset.fullWidthResponsive='true';area.append(ins);
    const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(x.client);script.onload=()=>{(window.adsbygoogle=window.adsbygoogle||[]).push({})};document.head.append(script);
  }catch{}
})();

