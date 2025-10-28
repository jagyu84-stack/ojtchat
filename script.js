
// === Orangei OJT Chat - Google Sheet 기반 FAQ ===

// 1) 구글 앱스 스크립트 '웹 앱 URL'로 바꾸세요.
const API_URL = 'https://script.google.com/macros/s/AKfycbw32eP3EH7AKasP0EISIMgr01srL9Oi-KFZuKUuVrHJPIfvwIJBzKaiBIED27Lo7ws-/exec'; // 예: https://script.google.com/macros/s/XXXXX/exec

// [2] 데이터 불러오기
async function loadData() {
  addMessage("FAQ 데이터를 불러오는 중입니다... 잠시만요.", "bot");
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (!data.ok || !data.items) throw new Error("데이터 형식 오류");
    FAQ = data.items;
    addMessage(`불러오기 완료! 현재 ${FAQ.length}건의 FAQ가 등록되어 있습니다. 예: "반차 마감은?"`, "bot");
  } catch (err) {
    addMessage("⚠ 네트워크 오류로 데이터를 가져오지 못했습니다. (관리자에게 문의)", "bot");
  }
}

// [3] 가독성 좋은 줄바꿈 (적당한 여백 유지)
function formatForDisplay(text) {
  if (!text) return "";
  if (/<[^>]+>/.test(text)) return text; // HTML은 그대로

  let t = text.trim();

  // 숫자 목록: 1. 2. 3. 형태는 줄바꿈으로 분리
  t = t.replace(/\s*(\d+)\.\s*/g, "<br><strong>$1.</strong> ");

  // 문장 종결부에서만 줄바꿈 (다. 요. 입니다. 기준)
  t = t.replace(/([가-힣]{2,10}(다|요|임|니다|됩니다|가능).)\s*/g, "$1<br>");

  // 연속된 <br>은 하나로 축소
  t = t.replace(/(<br>\s*){3,}/g, "<br><br>");
  return t;
}

// [4] 챗봇 메시지 추가
function addMessage(text, type = "bot") {
  const div = document.createElement("div");
  div.className = "message " + type;

  // 질문/답변 간 여백용 래퍼
  const inner = document.createElement("div");
  inner.className = "bubble";
  inner.innerHTML = type === "bot" ? formatForDisplay(text) : text;
  div.appendChild(inner);

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// [5] 질문 검색
function findAnswer(q) {
  q = q.trim();
  const found = FAQ.find(
    item =>
      item.question?.includes(q) ||
      item.tags?.split(",").some(tag => q.includes(tag.trim()))
  );
  if (found) {
    addMessage(found.question, "user");
    addMessage(found.answer, "bot");
  } else {
    addMessage("죄송합니다. 해당 질문을 찾지 못했습니다.", "bot");
  }
}

// [6] DOM 요소
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const messagesEl = document.getElementById("messages");
let FAQ = [];

// [7] 전송 이벤트
form.addEventListener("submit", e => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  addMessage(q, "user");
  findAnswer(q);
  input.value = "";
});

// [8] 초기 실행
loadData();
