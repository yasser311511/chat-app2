const socket = io();

const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const online = document.getElementById('online');
const typingEl = document.getElementById('typing');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('joinBtn');
const sendBtn = document.getElementById('sendBtn');

let myName = null;
let typingTimeout = null;

function addMessage({ from, text, time }, isMe = false) {
  const div = document.createElement('div');
  div.className = 'msg' + (isMe ? ' me' : '');
  const meta = document.createElement('div');
  meta.className = 'meta';
  const d = new Date(time || Date.now());
  meta.textContent = `${from} — ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const body = document.createElement('div');
  body.textContent = text;
  div.appendChild(meta);
  div.appendChild(body);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// دخول المستخدم
joinBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if (!name) { alert('اكتب اسمك أولًا'); return; }
  myName = name;
  socket.emit('join', name);
  input.disabled = false;
  sendBtn.disabled = false;
  usernameInput.disabled = true;
  joinBtn.disabled = true;
});

// إرسال الرسالة
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat_message', text);
  input.value = '';
});

// يكتب الآن
input.addEventListener('input', () => {
  socket.emit('typing', true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('typing', false), 800);
});

// استقبال الرسائل
socket.on('chat_message', (msg) => {
  const isMe = msg.from === myName;
  addMessage(msg, isMe);
});

// رسائل النظام
socket.on('system_message', (text) => {
  const div = document.createElement('div');
  div.className = 'system';
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

// عرض المتصلين
socket.on('online_list', (list) => {
  online.innerHTML = '';
  list.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    online.appendChild(li);
  });
});

// عرض حالة الكتابة
socket.on('typing', ({ from, isTyping }) => {
  if (isTyping) {
    typingEl.textContent = `${from} يكتب الآن...`;
    typingEl.hidden = false;
  } else {
    typingEl.hidden = true;
  }
});
