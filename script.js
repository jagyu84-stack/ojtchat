// === Orangei OJT Chat - Google Sheet 기반 FAQ (안정화 버전) ===

// 1) 구글 앱스 스크립트 '웹 앱 URL'로 바꾸세요.
const API_URL =
  'https://script.google.com/macros/s/AKfycbw32eP3EH7AKasP0EISIMgr01srL9Oi-KFZuKUuVrHJPIfvwIJBzKaiBIED27Lo7ws-/exec';

// ------------------------------------------------------------
// 전역 가드: 스크립트가 두 번 로드되어도 한 번만 동작
// ------------------------------------------------------------
if (!window.__OJT_BOUND) {
  window.__OJT_BOUND = true;

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
  let lastSubmit = { ts: 0, text: '' }; // 중복 제출(Enter+Click 등) 차단용

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
      chip.type = 'button';
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
            s.type = 'button';
            s.className = 'suggest';
            s.textContent = q;
            s.addEventListener('click', () => {
              input.value = q;
              form.requestSubmit(); // submit 경로 하나만 사용
            }, { once: true }); // 같은 버튼 중복 방지
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

    // 문장 종결에서 줄바꿈 (국문 종결형 위주)
    t = t.replace(/([가-힣]{1,20}(다|요|임|니다|됩니다|가능)[.!?]?)\s+/g, '$1<br>');

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
  // [F] 정규화 & 매칭(스코어 기반)
  // ------------------------------------------------------------
  const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '').trim();

  // 문자열을 토큰(한글/영문/숫자)으로 분리
  function tokenize(s = '') {
    return (s.toLowerCase().match(/[가-힣a-z0-9]+/g) || []).filter(Boolean);
  }

  function scoreItem(item, qRaw) {
    const q = qRaw.trim();
    if (!q) return -1;

    const qn = normalize(q);
    const iq = (item.question || '');
    const inq = normalize(iq);

    let score = 0;

    // 1) 질문 정확 일치 (최우선)
    if (inq === qn) score += 1000;

    // 2) 질문 시작 일치
    if (inq.startsWith(qn)) score += 300;

    // 3) 질문 토큰 교집합 점수
    const qTokens  = tokenize(q);
    const iqTokens = tokenize(iq);
    const overlapQ = qTokens.filter(t => iqTokens.includes(t)).length;
    score += overlapQ * 20;

    // 4) 태그 토큰 교집합
    const tags = tokenize(item.tags || '');
    const overlapT = qTokens.filter(t => tags.includes(t)).length;
    score += overlapT * 10;

    // 5) 카테고리 일치(정확/부분)
    const cat = (item.category || '').toLowerCase();
    if (cat) {
      if (cat === q.toLowerCase()) score += 50;
      else if (cat.includes(q.toLowerCase())) score += 10;
    }

    // 6) 부분 포함(질문 내 포함)
    if (inq.includes(qn)) score += 5;

    return score;
  }

  function findBest(query) {
    if (!Array.isArray(FAQ) || FAQ.length === 0) return null;

    // 점수 계산 후 최대 점수 1개만 선택
    let best = null;
    let bestScore = -1;

    for (const it of FAQ) {
      const sc = scoreItem(it, query);
      if (sc > bestScore) {
        bestScore = sc;
        best = it;
      }
    }

    // 너무 낮은 점수면(엉뚱 매칭) 실패 처리
    if (bestScore < 5) return null;
    return best;
  }

  // ------------------------------------------------------------
  // [G] 사용자 입력 처리: "질문 1회 + 답변 1회"만
  // ------------------------------------------------------------
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
  // [H] 데이터 로드 (중복 호출 방지)
  // ------------------------------------------------------------
  async function loadData() {
    if (window.__OJT_LOADED) return;
    window.__OJT_LOADED = true;

    addMessage('FAQ 데이터를 불러오는 중입니다... 잠시만요.', 'bot');
    try {
      const res  = await fetch(API_URL, { cache: 'no-cache' });
      const data = await res.json();
      if (!data.ok || !data.items) throw new Error('데이터 형식 오류');

      FAQ = data.items || [];
      addMessage(`불러오기 완료! 현재 ${FAQ.length}건의 FAQ가 등록되어 있습니다. 예: "휴가"`, 'bot');

      // 카테고리 칩/추천 버튼 표시
      renderHelper(FAQ);
    } catch (err) {
      addMessage('⚠ 네트워크 오류로 데이터를 가져오지 못했습니다. (관리자에게 문의)', 'bot');
      console.error(err);
    }
  }

  // ------------------------------------------------------------
  // [I] 이벤트 바인딩 (중복 방지 + 디바운스)
  // ------------------------------------------------------------
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const q = (input?.value || '').trim();
      if (!q) return;

      // 300ms 이내 동일 텍스트 재제출 차단 (Enter+Click 등)
      const now = Date.now();
      if (q === lastSubmit.text && now - lastSubmit.ts < 300) {
        return;
      }
      lastSubmit = { ts: now, text: q };

      handleQuery(q);
      if (input) input.value = '';
    });
  } else {
    console.warn('[OJT] #chat-form 요소가 없습니다. HTML id를 확인하세요.');
  }

  // 버튼 click 핸들러는 만들지 않습니다(중복 전송 방지).
  // 인라인 onsubmit/onclick도 HTML에서 제거해야 합니다.

  // 시작
  loadData();
}
