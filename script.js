// === Orangei OJT Chat - Google Sheet 기반 FAQ ===

// 1) 구글 앱스 스크립트 '웹 앱 URL'로 바꾸세요.
const API_URL =
  'https://script.google.com/macros/s/AKfycbw32eP3EH7AKasP0EISIMgr01srL9Oi-KFZuKUuVrHJPIfvwIJBzKaiBIED27Lo7ws-/exec';

// ------------------------------------------------------------
// [A] Helper(카테고리 칩/추천 버튼) 영역이 없으면 자동 생성
// ------------------------------------------------------------
(function ensureHelperArea() {
  let helper = document.getElementById('helper');
  if (!helper) {
    helper = document.createElement('section');
    helper.id = 'helper';
    helper.className = 'helper';
    helper.innerHTML = `
      <div id="category-chips" aria-label="카테고리 선택 영역"></div>
      <div id="suggestions" aria-label="추천 질문 영역"></div>
    `;
    const header = document.querySelector('.app-header') || document.querySelector('header');
    if (header) header.insertAdjacentElement('afterend', helper);
    else document.body.prepend(helper);
  }
  if (!document.getElementById('category-chips')) {
    const d = document.createElement('div'); d.id = 'category-chips'; helper.appendChild(d);
  }
  if (!document.getElementById('suggestions')) {
    const d = document.createElement('div'); d.id = 'suggestions'; helper.appendChild(d);
  }
})();

// ------------------------------------------------------------
// [B] DOM 핸들 및 전역
// ------------------------------------------------------------
const form       = document.getElementById('chat-form');
const input      = document.getElementById('user-input');
const messagesEl = document.getElementById('messages');

const chipsEl = document.getElementById('category-chips');
const sugEl   = document.getElementById('suggestions');

let FAQ = [];

// ------------------------------------------------------------
// [C] Helper 렌더링 유틸
// ------------------------------------------------------------
function getCategories(items) {
  const set = new Set();
  items.forEach(it => {
    const c = (it.category || '').trim();
    if (c) set.add(c);
  });
  return Array.from(set).sort();
}

function getSuggestions(items, category, limit = 6) {
  return items
    .filter(it => (it.category || '') === category)
    .map(it => it.question)
    .filter(Boolean)
    .slice(0, limit);
}

function renderHelper(items) {
  if (!chipsEl || !sugEl) return;

  chipsEl.innerHTML = '';
  sugEl.innerHTML = '';

  const cats = getCategories(items);
  if (cats.length === 0) {
    sugEl.innerHTML = '<div style="opacity:.7">표시할 카테고리가 없습니다. 시트의 <code>category</code> 열을 채워주세요.</div>';
    return;
  }

  cats.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = cat;
    chip.addEventListener('click', () => {
      const qs = getSuggestions(items, cat, 6);
      sugEl.innerHTML = '';
      if (qs.length === 0) {
        const d = document.createElement('div');
        d.textContent = '추천 질문이 없습니다.';
        sugEl.appendChild(d);
      } else {
        qs.forEach(q => {
          const s = document.createElement('button');
          s.className = 'suggest';
          s.textContent = q;
          s.addEventListener('click', () => {
            input.value = q;
            form.requestSubmit();
          });
          sugEl.appendChild(s);
        });
      }
    });
    chipsEl.appendChild(chip);
  });
}

// ------------------------------------------------------------
// [D] 가독성 좋은 줄바꿈
// ------------------------------------------------------------
function formatForDisplay(text) {
  if (!text) return '';
  if (/<[^>]+>/.test(text)) return text; // HTML은 그대로

  let t = text.trim();

  // 숫자 목록: 1. 2. 3. → 항목 앞 개행 + 번호 강조
  t = t.replace(/\s*(\d+)\.\s*/g, '<br><strong>$1.</strong> ');

  // 문장 종결에서만 줄바꿈 (…다./…요./…입니다./…됩니다./…가능 등)
  t = t.replace(/([가-힣]{2,10}(다|요|임|니다|됩니다|가능).)\s*/g, '$1<br>');

  // 연속 br 축소
  t = t.replace(/(<br>\s*){3,}/g, '<br><br>');
  return t;
}

// ------------------------------------------------------------
// [E] 메시지 렌더
// ------------------------------------------------------------
function addMessage(text, type = 'bot') {
  const row = document.createElement('div');
  row.className = 'message ' + type;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = type === 'bot' ? formatForDisplay(text) : text;

  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ------------------------------------------------------------
// 소문자/공백 제거 정규화
function normalize(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '').trim();
}

// 가장 적합한 항목 찾기: 정확>태그>카테고리>부분일치
function findBest(query) {
  const q = query.trim();
  const qn = normalize(q);

  // 1) 질문 정확 일치
  let item = FAQ.find(it => normalize(it.question) === qn);
  if (item) return item;

  // 2) 태그 매치(여러 단어 중 하나라도 포함)
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  item = FAQ.find(it => tokens.some(t => (it.tags || '').toLowerCase().includes(t)));
  if (item) return item;

  // 3) 카테고리 포함
  item = FAQ.find(it => (it.category || '').toLowerCase().includes(q.toLowerCase()));
  if (item) return item;

  // 4) 질문 부분 포함
  item = FAQ.find(it => normalize(it.question).includes(qn));
  return item || null;
}

// 사용자 입력/버튼 클릭 공통 처리: 사용자 1번 + 답변 1번만 출력
function handleQuery(q) {
  addMessage(q, 'user');                   // 사용자 메시지 1회
  const best = findBest(q);
  if (best) {
    addMessage(best.answer || '답변이 비어 있습니다.', 'bot');
  } else {
    addMessage('죄송합니다. 해당 질문을 찾지 못했습니다.', 'bot');
  }
}

// ------------------------------------------------------------
// [G] 데이터 로드
// ------------------------------------------------------------
async function loadData() {
  addMessage('FAQ 데이터를 불러오는 중입니다... 잠시만요.', 'bot');
  try {
    const res  = await fetch(API_URL);
    const data = await res.json();
    if (!data.ok || !data.items) throw new Error('데이터 형식 오류');

    FAQ = data.items;
    addMessage(`불러오기 완료! 현재 ${FAQ.length}건의 FAQ가 등록되어 있습니다. 예: "휴가"`, 'bot');

    // 카테고리 칩/추천 버튼 표시
    renderHelper(FAQ);
  } catch (err) {
    addMessage('⚠ 네트워크 오류로 데이터를 가져오지 못했습니다. (관리자에게 문의)', 'bot');
    console.error(err);
  }
}

// ------------------------------------------------------------
// [H] 이벤트 바인딩 & 시작
// ------------------------------------------------------------
form.addEventListener('submit', e => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  handleQuery(q);          // ← 이 한 줄만
  input.value = '';
});

loadData();
