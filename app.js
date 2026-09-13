// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyDsS9YG4esj-PT3iBzzW3__98pwxdCtZvg",
  authDomain: "tock-1fd0e.firebaseapp.com",
  databaseURL: "https://tock-1fd0e-default-rtdb.firebaseio.com",
  projectId: "tock-1fd0e",
  storageBucket: "tock-1fd0e.firebasestorage.app",
  messagingSenderId: "704452309911",
  appId: "1:704452309911:web:a8da0db3a31b57a00f4ad2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentUser = null;
let activeChatPartner = null;
let currentChatRef = null;
let selectedMsgId = null;
let replyToMsgId = null;
let longPressTimer = null;

const messagesContainer = document.getElementById("messages-container");
const msgInput = document.getElementById("message-input");
const floatingBar = document.getElementById("floating-action-bar");

// --- Theme Toggle Logic ---
function toggleTheme() {
  document.body.classList.toggle("lite-theme");
  document.body.classList.toggle("dark-theme");
}

document.getElementById("theme-btn").addEventListener("click", toggleTheme);
document.getElementById("auth-theme-btn").addEventListener("click", toggleTheme);

// --- Login Handler ---
document.getElementById("login-btn").addEventListener("click", () => {
  const name = document.getElementById("auth-name").value.trim();
  const phone = document.getElementById("auth-phone").value.trim();

  if (!name || !phone) return alert("Please enter both Name and Phone!");

  const userId = phone.replace(/[^0-9]/g, "");
  currentUser = { id: userId, name: name, phone: phone };

  db.ref(`users/${userId}`).set(currentUser).then(() => {
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
    setupPresence();
    loadContacts();
  });
});

// Presence System (.onDisconnect)
function setupPresence() {
  const userStatusRef = db.ref(`status/${currentUser.id}`);
  db.ref(".info/connected").on("value", (snap) => {
    if (snap.val() === false) return;
    userStatusRef.onDisconnect().set("Offline").then(() => {
      userStatusRef.set("Online");
    });
  });
}

// Typing Indicator
let typingTimeout;
msgInput.addEventListener("input", () => {
  if (!activeChatPartner) return;
  db.ref(`chats_meta/${getChatRoomId()}/${currentUser.id}_typing`).set(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    db.ref(`chats_meta/${getChatRoomId()}/${currentUser.id}_typing`).set(false);
  }, 2000);
});

// Navigation Tabs
document.getElementById("tab-chats").onclick = function() {
  this.classList.add("active");
  document.getElementById("tab-contacts").classList.remove("active");
  loadChats();
};

document.getElementById("tab-contacts").onclick = function() {
  this.classList.add("active");
  document.getElementById("tab-chats").classList.remove("active");
  loadContacts();
};

// 15-Day Invite Expiration & Render Contacts
function loadContacts() {
  const panel = document.getElementById("list-panel");
  panel.innerHTML = "";

  db.ref("users").once("value", (snap) => {
    snap.forEach((child) => {
      const user = child.val();
      if (user.id !== currentUser.id) {
        const row = document.createElement("div");
        row.className = "menu-item";
        row.style.justifyContent = "space-between";
        
        const info = document.createElement("span");
        info.textContent = `${user.name} (${user.phone})`;
        row.appendChild(info);

        const inviteBtn = document.createElement("button");
        inviteBtn.className = "neumorphic-text-btn";
        
        // Expiration check
        db.ref(`invites/${user.id}/${currentUser.id}`).once("value", (invSnap) => {
          const inv = invSnap.val();
          const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
          if (inv && (Date.now() - inv.timestamp > fifteenDaysMs)) {
            db.ref(`invites/${user.id}/${currentUser.id}`).remove();
            setInviteState(inviteBtn, "Invite", user.id);
          } else if (inv) {
            setInviteState(inviteBtn, "Invited ⏳", user.id);
          } else {
            setInviteState(inviteBtn, "Invite", user.id);
          }
        });

        row.onclick = () => openChat(user);
        row.appendChild(inviteBtn);
        panel.appendChild(row);
      }
    });
  });
}

function setInviteState(btn, state, targetId) {
  btn.textContent = state;
  btn.onclick = (e) => {
    e.stopPropagation();
    if (btn.textContent === "Invite") {
      db.ref(`invites/${targetId}/${currentUser.id}`).set({ timestamp: Date.now() });
      btn.textContent = "Invited ⏳";
      btn.classList.add("invited");
    } else if (btn.textContent === "Invited ⏳") {
      btn.textContent = "Cancel invite ✖";
      btn.classList.add("cancel");
    } else {
      db.ref(`invites/${targetId}/${currentUser.id}`).remove();
      btn.textContent = "Invite";
      btn.classList.remove("invited", "cancel");
    }
  };
}

function loadChats() {
  const panel = document.getElementById("list-panel");
  panel.innerHTML = "<p style='text-align:center; color: var(--text-muted);'>No active chats available.</p>";
}

// Chat System & Clean Listener Logic
function openChat(partner) {
  activeChatPartner = partner;
  document.getElementById("chat-screen").classList.remove("hidden");
  document.getElementById("chat-partner-name").textContent = partner.name;

  if (currentChatRef) currentChatRef.off();

  messagesContainer.innerHTML = "";
  const roomId = getChatRoomId();
  currentChatRef = db.ref(`messages/${roomId}`);

  db.ref(`chats_meta/${roomId}/${partner.id}_typing`).on("value", (snap) => {
    document.getElementById("chat-partner-status").textContent = snap.val() ? "typing..." : "Online";
  });

  currentChatRef.on("child_added", (snap) => {
    const msgKey = snap.key;
    if (!document.getElementById(`msg-${msgKey}`)) {
      renderMessage(msgKey, snap.val());
    }
  });
}

function renderMessage(msgKey, msg) {
  const bubble = document.createElement("div");
  bubble.id = `msg-${msgKey}`;
  const isOwn = msg.senderId === currentUser.id;
  bubble.className = `msg-bubble ${isOwn ? "own" : "partner"}`;

  let ticks = msg.status === "seen" ? "✓✓✓" : (msg.status === "sent" ? "✓✓" : "✓");
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  bubble.innerHTML = `<div>${msg.text}</div><div class="msg-footer"><span>${timeStr}</span> <span>${ticks}</span></div>`;

  bubble.addEventListener("touchstart", (e) => startHold(e, msgKey, msg));
  bubble.addEventListener("mousedown", (e) => startHold(e, msgKey, msg));

  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function startHold(e, msgKey, msg) {
  longPressTimer = setTimeout(() => {
    selectedMsgId = msgKey;
    floatingBar.classList.remove("hidden");
    floatingBar.style.top = `${e.clientY || 200}px`;
    floatingBar.style.left = `${e.clientX || 50}px`;
  }, 800);
}

document.addEventListener("touchend", () => clearTimeout(longPressTimer));
document.addEventListener("mouseup", () => clearTimeout(longPressTimer));

// Copy number 0.8s hold
function setupCopyNumber(element, phoneNum) {
  let timer;
  element.addEventListener("mousedown", () => {
    timer = setTimeout(() => {
      navigator.clipboard.writeText(phoneNum);
      alert("Phone number copied!");
    }, 800);
  });
  element.addEventListener("mouseup", () => clearTimeout(timer));
}

setupCopyNumber(document.getElementById("info-copy-num"), currentUser ? currentUser.phone : "");

function getChatRoomId() {
  return currentUser.id < activeChatPartner.id ? `${currentUser.id}_${activeChatPartner.id}` : `${activeChatPartner.id}_${currentUser.id}`;
}

// UI Handlers
document.getElementById("chat-back-btn").onclick = () => document.getElementById("chat-screen").classList.add("hidden");
document.getElementById("chat-info-btn").onclick = () => document.getElementById("info-modal").classList.remove("hidden");
document.getElementById("main-menu-btn").onclick = () => document.getElementById("main-menu-modal").classList.remove("hidden");

document.getElementById("info-modal").onclick = (e) => {
  if (e.target.id === "info-modal") document.getElementById("info-modal").classList.add("hidden");
};

document.getElementById("main-menu-modal").onclick = (e) => {
  if (e.target.id === "main-menu-modal") document.getElementById("main-menu-modal").classList.add("hidden");
};

document.getElementById("menu-logout").onclick = () => location.reload();

document.getElementById("send-btn").onclick = () => {
  const text = msgInput.value.trim();
  if (!text || !activeChatPartner) return;

  db.ref(`messages/${getChatRoomId()}`).push({
    senderId: currentUser.id,
    text: text,
    timestamp: Date.now(),
    status: "delivered"
  });

  msgInput.value = "";
};