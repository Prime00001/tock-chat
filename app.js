const firebaseConfig = {
  apiKey: "AIzaSyDsS9YG4esj-PT3iBzzW3__98pwxdCtZvg",
  authDomain: "tock-1fd0e.firebaseapp.com",
  databaseURL: "https://tock-1fd0e-default-rtdb.firebaseio.com",
  projectId: "tock-1fd0e",
  storageBucket: "tock-1fd0e.firebasestorage.app",
  messagingSenderId: "704452309911",
  appId: "1:704452309911:web:a8da0db3a31b57a00f4ad2"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

let currentUser = null;
let currentProfileName = '';
let activePartnerPhone = null;
let activePartnerName = '';
let holdTimer = null;

function toggleTheme() {
  document.body.classList.toggle('dark-theme');
}

function toggleMenu() {
  const menu = document.getElementById('main-menu');
  menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    const cleanPhone = currentUser.phoneNumber.replace('+', '');
    firebase.database().ref(`users/${cleanPhone}`).once('value', (snap) => {
      const data = snap.val();
      currentProfileName = data ? data.name : 'User';
      initSession();
    });
  } else {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('chat-container').style.display = 'none';
  }
});

function initSession() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('chat-container').style.display = 'flex';
  loadRecentChats();
  loadContacts();
}

function switchTab(tab) {
  document.getElementById('btn-tab-chats').classList.toggle('active', tab === 'chats');
  document.getElementById('btn-tab-contacts').classList.toggle('active', tab === 'contacts');
  document.getElementById('tab-chats').style.display = tab === 'chats' ? 'block' : 'none';
  document.getElementById('tab-contacts').style.display = tab === 'contacts' ? 'block' : 'none';
}

function openChat(phone, name) {
  activePartnerPhone = phone;
  activePartnerName = name || phone;

  document.getElementById('current-chat-title').innerText = activePartnerName;
  document.getElementById('partner-initial').innerText = activePartnerName.charAt(0).toUpperCase();

  document.getElementById('navigation-tabs').style.display = 'none';
  document.getElementById('search-wrapper').style.display = 'none';
  document.getElementById('tab-chats').style.display = 'none';
  document.getElementById('tab-contacts').style.display = 'none';
  
  document.getElementById('chat-sub-header').style.display = 'flex';
  document.getElementById('active-chat-section').style.display = 'block';

  loadMessages();
  listenToPinnedMessage();
}

function closeChat() {
  activePartnerPhone = null;
  document.getElementById('chat-sub-header').style.display = 'none';
  document.getElementById('active-chat-section').style.display = 'none';
  
  document.getElementById('navigation-tabs').style.display = 'flex';
  document.getElementById('search-wrapper').style.display = 'flex';
  switchTab('chats');
}

function loadMessages() {
  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = activePartnerPhone.replace('+', '');
  const chatId = [cleanMy, cleanPartner].sort().join('_');
  const chatBox = document.getElementById('chat-box');

  firebase.database().ref(`chats/${chatId}`).on('value', (snapshot) => {
    chatBox.innerHTML = '';
    const messages = snapshot.val();

    if (messages) {
      Object.keys(messages).forEach((key) => {
        const msg = messages[key];
        const isMe = msg.sender === currentUser.phoneNumber;

        const wrapper = document.createElement('div');
        wrapper.className = `msg-wrapper ${isMe ? 'my-msg' : ''}`;

        const msgItem = document.createElement('div');
        msgItem.className = 'msg-item';
        msgItem.innerText = msg.text;

        // Press & Hold Event (0.8s)
        msgItem.addEventListener('touchstart', () => startHold(wrapper, key, msg.text, isMe));
        msgItem.addEventListener('touchend', endHold);
        msgItem.addEventListener('mousedown', () => startHold(wrapper, key, msg.text, isMe));
        msgItem.addEventListener('mouseup', endHold);

        wrapper.appendChild(msgItem);
        chatBox.appendChild(wrapper);
      });
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  });
}

function startHold(wrapper, msgKey, text, isMe) {
  holdTimer = setTimeout(() => {
    showActionMenu(wrapper, msgKey, text, isMe);
  }, 800);
}

function endHold() {
  clearTimeout(holdTimer);
}

// 3D Action Menu with correct serial: 1. 3-Dot, 2. Edit, 3. Reply
function showActionMenu(wrapper, msgKey, text, isMe) {
  document.querySelectorAll('.msg-action-bar').forEach(el => el.remove());

  const actionBar = document.createElement('div');
  actionBar.className = 'msg-action-bar';

  // 1. 3-Dot Icon SVG
  const dotBtn = `
    <button class="action-icon-btn" title="More Options" onclick="toggleDropdown('${msgKey}', '${text}')">
      <svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
    </button>
  `;

  // 2. Edit Icon SVG (Middle)
  const editBtn = isMe ? `
    <button class="action-icon-btn" title="Edit Message" onclick="editMsg('${msgKey}', '${text}')">
      <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
    </button>
  ` : '';

  // 3. Reply Icon SVG (Last)
  const replyBtn = `
    <button class="action-icon-btn" title="Reply" onclick="triggerReply('${text}')">
      <svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
    </button>
  `;

  actionBar.innerHTML = dotBtn + editBtn + replyBtn;
  wrapper.appendChild(actionBar);
}

function triggerReply(text) {
  const msgInput = document.getElementById('message');
  msgInput.placeholder = `Replying: "${text.substring(0, 15)}..."`;
  msgInput.focus();
}

function editMsg(key, oldText) {
  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = activePartnerPhone.replace('+', '');
  const chatId = [cleanMy, cleanPartner].sort().join('_');

  const newText = prompt("Edit Message:", oldText);
  if (newText) {
    firebase.database().ref(`chats/${chatId}/${key}`).update({ text: newText });
  }
}

function toggleDropdown(msgKey, text) {
  const opt = confirm("Select Action:\nOK = Pin Message\nCancel = Delete Message");
  if (opt) {
    pinMessage(text);
  } else {
    deleteMessage(msgKey);
  }
}

function pinMessage(text) {
  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = activePartnerPhone.replace('+', '');
  const chatId = [cleanMy, cleanPartner].sort().join('_');

  firebase.database().ref(`pinned/${chatId}`).set({ text });
}

function listenToPinnedMessage() {
  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = activePartnerPhone.replace('+', '');
  const chatId = [cleanMy, cleanPartner].sort().join('_');

  firebase.database().ref(`pinned/${chatId}`).on('value', (snap) => {
    const data = snap.val();
    const banner = document.getElementById('pinned-banner');
    if (data && data.text) {
      banner.style.display = 'flex';
      document.getElementById('pinned-text').innerText = data.text;
    } else {
      banner.style.display = 'none';
    }
  });
}

function deleteMessage(key) {
  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = activePartnerPhone.replace('+', '');
  const chatId = [cleanMy, cleanPartner].sort().join('_');

  firebase.database().ref(`chats/${chatId}/${key}`).remove();
}

function sendMessage() {
  const msgInput = document.getElementById('message');
  const text = msgInput.value.trim();
  if (!text || !activePartnerPhone) return;

  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = activePartnerPhone.replace('+', '');
  const chatId = [cleanMy, cleanPartner].sort().join('_');

  firebase.database().ref(`chats/${chatId}`).push({
    sender: currentUser.phoneNumber,
    text: text,
    timestamp: Date.now()
  });

  saveRecentChat(activePartnerPhone, activePartnerName);
  msgInput.value = '';
}

function saveRecentChat(phone, name) {
  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = phone.replace('+', '');

  firebase.database().ref(`user_chats/${cleanMy}/${cleanPartner}`).set({ phone, name, time: Date.now() });
}

function loadRecentChats() {
  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const listDiv = document.getElementById('recent-chats-list');

  firebase.database().ref(`user_chats/${cleanMy}`).on('value', (snap) => {
    listDiv.innerHTML = '';
    const chats = snap.val();
    if (chats) {
      Object.keys(chats).forEach((k) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
          <div class="item-left">
            <div class="initial-avatar">${chats[k].name.charAt(0).toUpperCase()}</div>
            <b>${chats[k].name}</b>
          </div>
          <button class="icon-btn" onclick="event.stopPropagation(); showPartnerModal('${chats[k].phone}', '${chats[k].name}')">ℹ️</button>
        `;
        item.onclick = () => openChat(chats[k].phone, chats[k].name);
        listDiv.appendChild(item);
      });
    }
  });
}

function loadContacts() {
  const listDiv = document.getElementById('contacts-list');
  firebase.database().ref(`users`).on('value', (snap) => {
    listDiv.innerHTML = '';
    const users = snap.val();
    if (users) {
      Object.keys(users).forEach((k) => {
        if (users[k].phone !== currentUser.phoneNumber) {
          const item = document.createElement('div');
          item.className = 'list-item';
          item.innerHTML = `
            <div class="item-left">
              <div class="initial-avatar">${users[k].name.charAt(0).toUpperCase()}</div>
              <div><b>${users[k].name}</b><br><small>${users[k].phone}</small></div>
            </div>
          `;
          item.onclick = () => openChat(users[k].phone, users[k].name);
          listDiv.appendChild(item);
        }
      });
    }
  });
}

function showPartnerDetails() {
  showPartnerModal(activePartnerPhone, activePartnerName);
}

function showPartnerModal(phone, name) {
  document.getElementById('modal-name').innerText = name;
  document.getElementById('modal-phone').innerText = phone;
  document.getElementById('partner-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('partner-modal').style.display = 'none';
}