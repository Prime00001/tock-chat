// --- Firebase Config & Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyDsS9YG4esj-PT3iBzzW3__98pwxdCtZvg",
  authDomain: "tock-1fd0e.firebaseapp.com",
  databaseURL: "https://tock-1fd0e-default-rtdb.firebaseio.com",
  projectId: "tock-1fd0e",
  storageBucket: "tock-1fd0e.firebasestorage.app",
  messagingSenderId: "704452309911",
  appId: "1:704452309911:web:a8da0db3a31b57a00f4ad2"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Global Variables
let currentUser = null;
let activePartnerPhone = null;
let typingTimeout = null;
let replyingToMsg = null;
let confirmationResult = null;

// --- 1. Universal Theme Toggle ---
function toggleTheme() {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  const themeBtn = document.getElementById('theme-toggle');

  if (themeBtn) {
    themeBtn.querySelector('.icon').innerText = isDark ? '🌙' : '☀️';
  }
  localStorage.setItem('tock-theme', isDark ? 'dark' : 'light');
}

window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('tock-theme') === 'dark') {
    document.body.classList.add('dark-theme');
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.querySelector('.icon').innerText = '🌙';
  }

  // Setup Recaptcha
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    'size': 'invisible'
  });

  // Enter Key Listener for Message Input
  const msgInput = document.getElementById('message');
  if (msgInput) {
    msgInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }
});

// --- 2. Auth System (1 Phone = 1 Account) ---
function sendOTP() {
  const phoneNumber = document.getElementById('auth-phone').value;
  if (!phoneNumber) {
    alert("অনুগ্রহ করে আপনার ফোন নম্বরটি লিখুন!");
    return;
  }

  const appVerifier = window.recaptchaVerifier;

  firebase.auth().signInWithPhoneNumber(phoneNumber, appVerifier)
    .then((result) => {
      confirmationResult = result;
      document.getElementById('phone-step').style.display = 'none';
      document.getElementById('otp-step').style.display = 'block';
      alert('OTP পাঠানো হয়েছে!');
    }).catch((error) => {
      alert('Error: ' + error.message);
      console.error("OTP Send Error:", error);
    });
}

function verifyOTP() {
  const code = document.getElementById('auth-otp').value;
  if (!code) {
    alert("অনুগ্রহ করে OTP কোড দিন!");
    return;
  }

  confirmationResult.confirm(code).then((result) => {
    currentUser = result.user;
    const username = document.getElementById('auth-username').value || 'User';
    
    firebase.database().ref('users/' + currentUser.phoneNumber.replace('+', '')).set({
      name: username,
      phone: currentUser.phoneNumber
    });

    initUserSession();
  }).catch((error) => {
    alert('ভুল OTP: ' + error.message);
  });
}

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    initUserSession();
  } else {
    setUserPresence(false);
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('chat-container').style.display = 'none';
  }
});

function initUserSession() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('chat-container').style.display = 'flex';
  setUserPresence(true);
  loadRecentChats();
  loadContacts();
}

function logOut() {
  setUserPresence(false);
  firebase.auth().signOut().then(() => location.reload());
}

// --- 3. Presence System (Adaptive Active Dot) ---
function setUserPresence(isOnline) {
  if (!currentUser) return;
  const cleanPhone = currentUser.phoneNumber.replace('+', '');
  const userStatusRef = firebase.database().ref(`status/${cleanPhone}`);

  if (isOnline) {
    userStatusRef.set({ state: 'online', last_changed: Date.now() });
    userStatusRef.onDisconnect().set({ state: 'offline', last_changed: Date.now() });
  } else {
    userStatusRef.set({ state: 'offline', last_changed: Date.now() });
  }
}

function listenToPartnerStatus(partnerPhone) {
  const cleanPartner = partnerPhone.replace('+', '');
  const statusDot = document.getElementById('active-status-dot');

  firebase.database().ref(`status/${cleanPartner}`).on('value', (snapshot) => {
    const data = snapshot.val();
    if (data && data.state === 'online') {
      statusDot.classList.add('active');
    } else {
      statusDot.classList.remove('active');
    }
  });
}

// --- 4. Typing Indicator ---
function handleTyping() {
  if (!currentUser || !activePartnerPhone) return;
  const cleanMyPhone = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = activePartnerPhone.replace('+', '');

  firebase.database().ref(`typing/${cleanPartner}/${cleanMyPhone}`).set(true);

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    firebase.database().ref(`typing/${cleanPartner}/${cleanMyPhone}`).set(false);
  }, 2000);
}

function listenToTyping(partnerPhone) {
  if (!currentUser) return;
  const cleanMyPhone = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = partnerPhone.replace('+', '');
  const typingIndicator = document.getElementById('typing-indicator');

  firebase.database().ref(`typing/${cleanMyPhone}/${cleanPartner}`).on('value', (snapshot) => {
    if (snapshot.val() === true) {
      typingIndicator.innerText = "Typing...";
    } else {
      typingIndicator.innerText = "";
    }
  });
}

// --- 5. Tabs & Search Filtering ---
function switchTab(tabName) {
  document.getElementById('btn-tab-chats').classList.remove('active');
  document.getElementById('btn-tab-contacts').classList.remove('active');
  document.getElementById('tab-chats').style.display = 'none';
  document.getElementById('tab-contacts').style.display = 'none';

  if (tabName === 'chats') {
    document.getElementById('btn-tab-chats').classList.add('active');
    document.getElementById('tab-chats').style.display = 'block';
  } else {
    document.getElementById('btn-tab-contacts').classList.add('active');
    document.getElementById('tab-contacts').style.display = 'block';
  }
}

function filterContacts() {
  const query = document.getElementById('search-contact-input').value.toLowerCase();
  const contactItems = document.querySelectorAll('#contacts-list .list-item');

  contactItems.forEach(item => {
    const text = item.innerText.toLowerCase();
    item.style.display = text.includes(query) ? 'flex' : 'none';
  });
}

// --- 6. Open Chat & Messaging Core ---
function openChat(partnerPhone, partnerName = '') {
  activePartnerPhone = partnerPhone;
  document.getElementById('current-chat-title').innerText = partnerName || partnerPhone;
  
  listenToPartnerStatus(partnerPhone);
  listenToTyping(partnerPhone);
  loadMessages();
}

function sendMessage() {
  const msgInput = document.getElementById('message');
  const text = msgInput.value.trim();
  if (!text || !activePartnerPhone || !currentUser) return;

  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = activePartnerPhone.replace('+', '');
  const chatId = [cleanMy, cleanPartner].sort().join('_');

  const msgData = {
    sender: currentUser.phoneNumber,
    text: text,
    timestamp: Date.now(),
    status: 'delivered'
  };

  if (replyingToMsg) {
    msgData.replyTo = replyingToMsg;
    replyingToMsg = null;
    msgInput.placeholder = "মেসেজ লিখুন...";
  }

  firebase.database().ref(`chats/${chatId}`).push(msgData);
  saveToRecentChats(activePartnerPhone);

  msgInput.value = '';
  firebase.database().ref(`typing/${cleanPartner}/${cleanMy}`).set(false);
}

function setReply(sender, text) {
  replyingToMsg = { sender, text };
  const msgInput = document.getElementById('message');
  msgInput.placeholder = `Replying: "${text.substring(0, 15)}..."`;
  msgInput.focus();
}

// --- 7. Dynamic Time Limit Edit (15 min / 15 sec) ---
function editMessage(msgKey, oldText, timestamp, isSeen) {
  const timeElapsed = Date.now() - timestamp;
  const allowedTime = isSeen ? (15 * 1000) : (15 * 60 * 1000);

  if (timeElapsed > allowedTime) {
    alert(isSeen ? "মেসেজটি দেখা হয়েছে! ১৫ সেকেন্ড পার হওয়ায় আর এডিট করা সম্ভব নয়।" : "১৫ মিনিট পার হয়ে গেছে! আর এডিট করা সম্ভব নয়।");
    return;
  }

  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = activePartnerPhone.replace('+', '');
  const chatId = [cleanMy, cleanPartner].sort().join('_');

  const newText = prompt("মেসেজ পরিবর্তন করুন:", oldText);
  if (newText && newText.trim() !== "" && newText !== oldText) {
    firebase.database().ref(`chats/${chatId}/${msgKey}`).update({
      text: newText.trim() + " (edited)"
    });
  }
}

// --- 8. Load Messages with Tripartite Delivery Status ---
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

        // Auto Mark as Seen
        if (!isMe && msg.status !== 'seen') {
          firebase.database().ref(`chats/${chatId}/${key}`).update({ status: 'seen' });
        }

        // Tripartite Status Logic
        let statusHTML = '';
        if (isMe) {
          if (msg.status === 'seen') {
            statusHTML = '<span class="msg-status-text">🗸🗸🗸 Seen</span>';
          } else if (msg.status === 'sent') {
            statusHTML = '<span class="msg-status-text">🗸🗸 Sent</span>';
          } else {
            statusHTML = '<span class="msg-status-text">🗸 Delivered</span>';
          }
        }

        let replyHTML = msg.replyTo ? `<div style="font-size:10px; opacity:0.8; border-left:2px solid #007aff; padding-left:4px; margin-bottom:4px;"><b>${msg.replyTo.sender}:</b> ${msg.replyTo.text}</div>` : '';
        let editBtn = isMe ? `<button style="padding:1px 4px; font-size:9px; margin-left:4px; cursor:pointer;" onclick="editMessage('${key}', '${msg.text.replace(" (edited)", "")}', ${msg.timestamp}, ${msg.status === 'seen'})">✏️</button>` : '';

        const msgDiv = document.createElement('div');
        msgDiv.className = `msg-item ${isMe ? 'my-message' : ''}`;
        msgDiv.innerHTML = `
          ${replyHTML}
          <span>${msg.text}</span>
          ${statusHTML}
          ${editBtn}
          <button style="padding:1px 4px; font-size:9px; margin-left:2px; cursor:pointer;" onclick="setReply('${msg.sender}', '${msg.text}')">↩</button>
        `;

        chatBox.appendChild(msgDiv);
      });
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  });
}

// --- 9. Recent Chats & Contacts Data Sync ---
function saveToRecentChats(partnerPhone) {
  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const cleanPartner = partnerPhone.replace('+', '');

  firebase.database().ref(`user_chats/${cleanMy}/${cleanPartner}`).set({ phone: partnerPhone, time: Date.now() });
  firebase.database().ref(`user_chats/${cleanPartner}/${cleanMy}`).set({ phone: currentUser.phoneNumber, time: Date.now() });
}

function loadRecentChats() {
  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const listDiv = document.getElementById('recent-chats-list');

  firebase.database().ref(`user_chats/${cleanMy}`).on('value', (snapshot) => {
    listDiv.innerHTML = '';
    const chats = snapshot.val();
    if (chats) {
      Object.keys(chats).forEach((key) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `<span>📱 ${chats[key].phone}</span>`;
        item.onclick = () => openChat(chats[key].phone);
        listDiv.appendChild(item);
      });
    } else {
      listDiv.innerHTML = '<p style="font-size:12px; opacity:0.6;">কোনো সাম্প্রতিক চ্যাট নেই</p>';
    }
  });
}

function loadContacts() {
  const cleanMy = currentUser.phoneNumber.replace('+', '');
  const listDiv = document.getElementById('contacts-list');

  firebase.database().ref(`users`).on('value', (snapshot) => {
    listDiv.innerHTML = '';
    const users = snapshot.val();
    if (users) {
      Object.keys(users).forEach((key) => {
        const user = users[key];
        if (user.phone !== currentUser.phoneNumber) {
          const item = document.createElement('div');
          item.className = 'list-item';
          item.innerHTML = `<span>👤 <b>${user.name}</b> (${user.phone})</span>`;
          item.onclick = () => openChat(user.phone, user.name);
          listDiv.appendChild(item);
        }
      });
    }
  });
}