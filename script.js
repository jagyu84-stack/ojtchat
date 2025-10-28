// === Orangei OJT Chat (Google Sheets 연동 버전) ===

// 1) 구글 앱스 스크립트 '웹 앱 URL'로 바꾸세요.
const API_URL = 'https://script.google.com/macros/s/AKfycbw32eP3EH7AKasP0EISIMgr01srL9Oi-KFZuKUuVrHJPIfvwIJBzKaiBIED27Lo7ws-/exec'; // 예: https://script.google.com/macros/s/XXXXX/exec

let KB = []; // 시트에서 불러온 데이터가 들어갑니다.

const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('chat-form');
const inputEl = document.getElementById('user-input');

// === (신규) 카테고리 칩 & 추천질문 ===
const chipsEl = document.getElementById('category-chips');
const sugEl = document.getElementById('suggestions');

// 카테고리 추출
function getCategories(items) {
  const set = new Set();
  items.forEach(it => {
    const c = (it.category || '').trim();
    if (c) set.add(c);
  });
  return Array.from(set).sort();
}

// 질문 상위 N개 추천(카테고리 기준)
function getSuggestions(items, category, limit = 6) {
  const list = items.filter(it => (it.category || '') === category)
                    .map(it => it.question).filter(Boolean);
  return list.slice(0, limit);
}

// 칩/추천 렌더링
function renderHelper(items) {
  chipsEl.innerHTML = '';
  sugEl.innerHTML = '';

  const cats = getCategories(items);
  if (cats.length === 0) return;

  cats.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = cat;
    chip.addEventListener('click', () => {
      // 추천질문 렌더
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
            // 추천 질문 클릭 시, 입력창에 넣고 전송
            inputEl.value = q;
            formEl.requestSubmit();
          });
          sugEl.appendChild(s);
        });
      }
    });
    chipsEl.appendChild(chip);
  });
}

function addMessage(text, type='bot') {
  const div = document.createElement('div');
  div.className = 'message ' + type;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// 간단한 검색(질문/태그/카테고리 포함 부분매칭)
function findAnswer(text) {
  const q = text.trim().toLowerCase();
  if (!q) return '질문을 입력해 주세요.';

  // 1) 완전 일치 우선
  const exact = KB.find(item => (item.question || '').trim().toLowerCase() === q);
  if (exact) return exact.answer || '답변이 비어 있습니다.';

  // 2) 부분 일치(질문/태그/카테고리)
  const hit = KB.find(item => {
    const question = (item.question || '').toLowerCase();
    const tags = (item.tags || '').toLowerCase();
    const category = (item.category || '').toLowerCase();
    return question.includes(q) || tags.includes(q) || category.includes(q);
  });

  if (hit) return hit.answer || '답변이 비어 있습니다.';

  // 3) 추천어 제시
  const suggestions = KB
    .map(it => it.question)
    .filter(Boolean)
    .slice(0, 5)
    .join(' / ');
  return `죄송합니다. 해당 질문을 찾지 못했습니다.\n예시: ${suggestions}`;
}

// 시트에서 FAQ 불러오기
async function loadFAQ() {
  addMessage('FAQ 데이터를 불러오는 중입니다… 잠시만요.');
  try {
    const res = await fetch(API_URL, { method: 'GET' });
    const data = await res.json();
    if (data.ok && Array.isArray(data.items)) {
      KB = data.items;
      renderHelper(KB); // ← 이 줄 추가 (카테고리/추천 렌더)
      const count = KB.length;
      addMessage(`불러오기 완료! 현재 ${count}건의 FAQ가 등록되어 있습니다. 예: "휴가"`);
    } else {
      addMessage('FAQ 데이터를 불러오는 데 실패했습니다. 나중에 다시 시도해 주세요.');
    }
  } catch (e) {
    addMessage('네트워크 오류로 데이터를 가져오지 못했습니다. (관리자에게 문의)');
    console.error(e);
  }
}

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  setTimeout(() => {
    const ans = findAnswer(text);
    addMessage(ans, 'bot');
  }, 200);
  inputEl.value = '';
});

// 초기 실행
loadFAQ();
