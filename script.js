// 아주 단순한 데모 챗봇입니다.
// key-value로 간단한 답변을 제공합니다. (실무에서는 API 연동으로 확장하세요)

const KB = [
  { q: ['반차', '반차 마감', '반차 신청'], a: '반차 신청 마감은 전일 18:00까지 전자결재 제출입니다.' },
  { q: ['연차', '연차 신청', '연차 마감'], a: '연차는 당일 오전 9시 전까지 제출 권장(협의 가능)입니다.' },
  { q: ['평가', '평가 일정', '성과평가'], a: '분기 말 주간(마지막 주)에 평가가 진행됩니다. 상세일정은 공지 참조.' },
  { q: ['복지', '복지 포인트', '복지포인트'], a: '복지포인트는 분기 초에 일괄 지급되며, 만료 30일 전에 안내됩니다.' },
];

const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('chat-form');
const inputEl = document.getElementById('user-input');

function addMessage(text, type='bot') {
  const div = document.createElement('div');
  div.className = 'message ' + type;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function findAnswer(text) {
  const t = text.trim();
  // 간단 매칭
  for (const item of KB) {
    if (item.q.some(k => t.includes(k))) return item.a;
  }
  return '죄송합니다. 해당 질문은 DB에 없습니다. 다른 표현으로 시도해 보시거나 HR팀에 문의해 주세요.';
}

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  setTimeout(() => {
    const ans = findAnswer(text);
    addMessage(ans, 'bot');
  }, 300);
  inputEl.value = '';
});

// 환영 메시지
addMessage('안녕하세요! Orangei OJT Chat 데모입니다. 예: "반차 마감은?"을 입력해 보세요 😊');
