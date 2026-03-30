/**
 * io.js — 파일 저장 / 불러오기 / 내보내기
 *
 * 저장:
 *   .gtree — 편집 가능 JSON (모든 오브젝트 보존)
 *   .svg   — 벡터 이미지
 *   .png   — 래스터 2× 해상도
 *   .jpg   — JPEG (흰 배경)
 *
 * 불러오기:
 *   .gtree      — 편집 재개
 *   PNG / JPG   — 이미지 오브젝트로 삽입
 *   SVG         — 이미지 오브젝트로 삽입
 */

/* ── 타임스탬프 ── */
function ts() {
  const d = new Date();
  return d.getFullYear()
    + String(d.getMonth()+1).padStart(2,'0')
    + String(d.getDate()).padStart(2,'0')
    + '_' + String(d.getHours()).padStart(2,'0')
    + String(d.getMinutes()).padStart(2,'0');
}

/* ── 내보내기용 SVG 복제 ── */
function cloneSvg() {
  const r = cvSvg.getBoundingClientRect();
  const c = cvSvg.cloneNode(true);
  c.setAttribute('width', r.width); c.setAttribute('height', r.height);
  [...c.querySelectorAll('[data-handle]')].forEach(el => el.remove());
  // 선택 박스(점선 테두리) 제거
  [...c.querySelectorAll('rect[stroke-dasharray="5,3"]')].forEach(el => el.remove());
  const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('width','100%'); bg.setAttribute('height','100%'); bg.setAttribute('fill','#fff');
  c.insertBefore(bg, c.firstChild);
  return { clone: c, w: r.width, h: r.height };
}

function download(href, name) {
  const a = document.createElement('a'); a.href = href; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/* ════════════════════════════
   저장 드롭다운
════════════════════════════ */
document.getElementById('save-gtree').addEventListener('click', () => {
  closeDropdowns();
  const data = { version:1, appName:'KS 이미지 에디터', savedAt:new Date().toISOString(), cvW, cvH, objects: JSON.parse(JSON.stringify(objects)) };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  download(URL.createObjectURL(blob), `ks_diagram_${ts()}.gtree`);
});

document.getElementById('save-svg').addEventListener('click', () => {
  closeDropdowns();
  const { clone } = cloneSvg();
  const blob = new Blob([clone.outerHTML], {type:'image/svg+xml'});
  download(URL.createObjectURL(blob), `ks_diagram_${ts()}.svg`);
});

document.getElementById('save-png').addEventListener('click', () => {
  closeDropdowns();
  exportRaster('png');
});

document.getElementById('save-jpg').addEventListener('click', () => {
  closeDropdowns();
  exportRaster('jpg');
});

function exportRaster(fmt) {
  const { clone, w, h } = cloneSvg();
  const url = URL.createObjectURL(new Blob([clone.outerHTML], {type:'image/svg+xml'}));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = w*2; c.height = h*2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(2,2); ctx.drawImage(img, 0, 0, w, h);
    const mime  = fmt==='jpg' ? 'image/jpeg' : 'image/png';
    const qual  = fmt==='jpg' ? 0.92 : undefined;
    download(c.toDataURL(mime, qual), `ks_diagram_${ts()}.${fmt}`);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

/* ════════════════════════════
   불러오기 드롭다운
════════════════════════════ */
document.getElementById('load-gtree').addEventListener('click', () => {
  closeDropdowns();
  document.getElementById('file-gtree').click();
});
document.getElementById('load-image').addEventListener('click', () => {
  closeDropdowns();
  document.getElementById('file-image').click();
});
document.getElementById('load-svg').addEventListener('click', () => {
  closeDropdowns();
  document.getElementById('file-svg').click();
});

/* ── .gtree 불러오기 ── */
document.getElementById('file-gtree').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.objects || !Array.isArray(data.objects)) { alert('올바른 .gtree 파일이 아닙니다.'); return; }
      saveState();
      objects = data.objects;
      oid = objects.reduce((mx,o) => Math.max(mx, o.id||0), 0);
      if (data.cvW) cvW = data.cvW;
      if (data.cvH) cvH = data.cvH;
      selId = null; applyCvSize(); render(); syncProps(); updateSB();
      showMsg(`✓ ${file.name} 불러오기 완료`);
    } catch(err) { alert('파일 오류: ' + err.message); }
  };
  reader.readAsText(file); e.target.value='';
});

/* ── 이미지(PNG/JPG) 불러오기 → 오브젝트로 삽입 ── */
document.getElementById('file-image').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => insertImageObj(ev.target.result);
  reader.readAsDataURL(file); e.target.value='';
});

/* ── SVG 불러오기 → 이미지 오브젝트로 삽입 ── */
document.getElementById('file-svg').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    // SVG를 Blob URL로 변환 후 이미지로 삽입
    const blob = new Blob([ev.target.result], {type:'image/svg+xml'});
    const url  = URL.createObjectURL(blob);
    // dataURL로 변환 (저장 시 포함되도록)
    const img  = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 400; c.height = img.naturalHeight || 300;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      insertImageObj(c.toDataURL('image/png'));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { // canvas 변환 실패 시 dataURL 직접 사용
      const svgData = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(ev.target.result)));
      insertImageObj(svgData);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  reader.readAsText(file); e.target.value='';
});

function insertImageObj(dataUrl) {
  const img = new Image();
  img.onload = () => {
    saveState();
    const MAX_W=400, MAX_H=300;
    let w=img.naturalWidth||400, h=img.naturalHeight||300;
    if (w>MAX_W){h=h*(MAX_W/w);w=MAX_W;}
    if (h>MAX_H){w=w*(MAX_H/h);h=MAX_H;}
    w=Math.round(w); h=Math.round(h);
    const o={id:uid(),type:'image',x:Math.round(cvW/2-w/2),y:Math.round(cvH/2-h/2),w,h,href:dataUrl,opacity:1};
    objects.push(o); selId=o.id; switchTool('select'); render(); syncProps();
  };
  img.src = dataUrl;
}

/* ── 상태바 메시지 ── */
function showMsg(msg) {
  const el = document.getElementById('sb-sel');
  el.textContent = msg;
  setTimeout(() => { el.textContent = selId ? `선택: id=${selId}` : '선택: 없음'; }, 2500);
}

/* ── 드롭다운 열기/닫기 ── */
function closeDropdowns() {
  document.querySelectorAll('.dropdown-panel').forEach(p => p.classList.remove('open'));
}
document.getElementById('btn-save-menu').addEventListener('click', e => {
  e.stopPropagation();
  const panel = document.getElementById('save-panel');
  const wasOpen = panel.classList.contains('open');
  closeDropdowns();
  if (!wasOpen) panel.classList.add('open');
});
document.getElementById('btn-load-menu').addEventListener('click', e => {
  e.stopPropagation();
  const panel = document.getElementById('load-panel');
  const wasOpen = panel.classList.contains('open');
  closeDropdowns();
  if (!wasOpen) panel.classList.add('open');
});
document.addEventListener('click', closeDropdowns);
