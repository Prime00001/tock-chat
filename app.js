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
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let activeChatPartner = null;
let currentChatRef = null;
let confirmationResult = null;
let selectedMsgId = null;
let selectedMsgText = "";
let isEditing = false;
let longPressTimer = null;

window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });

// Global Theme Switcher Trigger
document.querySelectorAll(".theme-btn-trigger").forEach(btn => {
  btn.onclick = () => {
    document.body.classList.toggle("lite-theme");
    document.body.classList.toggle("dark-theme");
  };
});

// Phone OTP Auth
document.getElementById("send-otp-btn").onclick = () => {
  const name = document.getElementById("auth-name").value.trim();
  let phone = document.getElementById("auth-phone").value.trim();

  if (!name) return alert("Please enter your name!");
  if (phone.startsWith("01")) phone = "+88" + phone;
  else if (phone.startsWith("8801")) phone = "+" + phone;
  phone = phone.replace(/[\s-]/g, "");

  if (!/^\+8801[3-9]\d{8}$/.test(phone)) return alert("Invalid Bangladesh number!");

  auth.signInWithPhoneNumber(phone, window.recaptchaVerifier)
    .then((result) => {
      confirmationResult = result;
      document.getElementById("phone-step").classList.add("hidden");
      document.getElementById("otp-step").classList.remove("hidden");
      alert("OTP code has been sent!");
    })
    .catch((error) => alert("Error: " + error.message));
};

document.getElementById("verify-otp-btn").onclick = () => {
  const otp = document.getElementById("auth-otp").value.trim();
  const name = document.getElementById("auth-name").value.trim();
  let phone = document.getElementById("auth-phone").value.trim();

  if (phone.startsWith("01")) phone = "+88" + phone;
  phone = phone.replace(/[\s-]/g, "");

  if (otp.length !== 6) return alert("Enter valid 6-digit OTP!");

  confirmationResult.confirm(otp).then((res) => {
    currentUser = { id: res.user.uid, name: name, phone: phone, bio: "Hey there! I am using Tock." };
    db.ref(`users/${res.user.uid}`).set(currentUser).then(initApp);
  }).catch((err) => alert("Invalid OTP: " + err.message));
};

function initApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");
  setupPresence();
  listenNotifications();
  loadContacts();
}

// Presence System
function setupPresence() {
  const userStatusRef = db.ref(`status/${currentUser.id}`);
  db.ref(".info/connected").on("value", (snap) => {
    if (!snap.val()) return;
    userStatusRef.onDisconnect().set({ state: "Offline", lastSeen: Date.now() }).then(() => {
      userStatusRef.set({ state: "Online", lastSeen: Date.now() });
    });
  });
}

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

// Contacts Tab (With Add Chat Icon UI)
function loadContacts() {
  const panel = document.getElementById("list-panel");
  panel.innerHTML = "";

  db.ref("users").once("value", (snap) => {
    snap.forEach((child) => {
      const user = child.val();
      if (user.id !== currentUser.id) {
        const firstLetter = user.name ? user.name.charAt(0).toUpperCase() : "U";
        
        const row = document.createElement("div");
        row.className = "menu-item";
        row.style.justifyContent = "space-between";

        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="avatar-small">${firstLetter}</div>
            <div>
              <div style="font-weight:600;">${user.name}</div>
              <div style="font-size:12px; color:var(--text-muted);">${user.phone}</div>
            </div>
          </div>
        `;

        const inviteBtn = document.createElement("button");
        inviteBtn.className = "neumorphic-text-btn";

        db.ref(`invites/${user.id}/${currentUser.id}`).on("value", (invSnap) => {
          if (invSnap.exists()) {
            inviteBtn.textContent = "Invited ⏳";
            inviteBtn.classList.add("invited");
          } else {
            inviteBtn.textContent = "Invite";
            inviteBtn.classList.remove("invited");
          }
        });

        inviteBtn.onclick = (e) => {
          e.stopPropagation();
          db.ref(`invites/${user.id}/${currentUser.id}`).set({
            senderName: currentUser.name,
            senderPhone: currentUser.phone,
            timestamp: Date.now()
          });
        };

        row.onclick = () => openChat(user);
        row.appendChild(inviteBtn);
        panel.appendChild(row);
      }
    });
  });
}

function loadChats() {
  const panel = document.getElementById("list-panel");
  panel.innerHTML = "<p style='text-align:center; color:var(--text-muted); padding:20px;'>Select Contacts tab to find users & start chatting.</p>";
}

// Open Chat
function openChat(partner) {
  activeChatPartner = partner;
  document.getElementById("chat-screen").classList.remove("hidden");
  document.getElementById("chat-partner-name").textContent = partner.name;

  const firstLetter = partner.name ? partner.name.charAt(0).toUpperCase() : "U";
  document.getElementById("chat-partner-avatar").textContent = firstLetter;

  db.ref(`status/${partner.id}`).on("value", (snap) => {
    const val = snap.val();
    const statusElem = document.getElementById("chat-partner-status");
    if (val && val.state === "Online") {
      statusElem.textContent = "Online";
      statusElem.style.color = "#34C759";
    } else if (val && val.lastSeen) {
      const timeStr = new Date(val.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      statusElem.textContent = `Last seen ${timeStr}`;
      statusElem.style.color = "var(--text-muted)";
    } else {
      statusElem.textContent = "Offline";
      statusElem.style.color = "var(--text-muted)";
    }
  });

  const messagesContainer = document.getElementById("messages-container");
  messagesContainer.innerHTML = "";

  if (currentChatRef) currentChatRef.off();
  const roomId = currentUser.id < partner.id ? `${currentUser.id}_${partner.id}` : `${partner.id}_${currentUser.id}`;
  currentChatRef = db.ref(`messages/${roomId}`);

  currentChatRef.on("child_added", (snap) => renderMessage(snap.key, snap.val()));
}

// Render Messages, 0.8s Hold & Swipe-to-Reply
function renderMessage(msgKey, msg) {
  const container = document.getElementById("messages-container");
  const bubble = document.createElement("div");
  bubble.id = `msg-${msgKey}`;
  const isOwn = msg.senderId === currentUser.id;
  bubble.className = `msg-bubble ${isOwn ? "own" : "partner"}`;
  bubble.innerHTML = `<div>${msg.text}</div><div class="msg-footer"><span>${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>`;

  // 0.8s Hold Trigger
  const startHold = () => {
    longPressTimer = setTimeout(() => {
      selectedMsgId = msgKey;
      selectedMsgText = msg.text;
      
      const bar = document.getElementById("floating-action-bar");
      bar.classList.remove("hidden");
      const rect = bubble.getBoundingClientRect();
      bar.style.top = `${bubble.offsetTop - 45}px`;
      bar.style.left = isOwn ? `${rect.left - 40}px` : `${rect.left}px`;
    }, 800);
  };

  const cancelHold = () => clearTimeout(longPressTimer);

  bubble.addEventListener("touchstart", startHold);
  bubble.addEventListener("touchend", cancelHold);
  bubble.addEventListener("mousedown", startHold);
  bubble.addEventListener("mouseup", cancelHold);

  // Swipe to Reply
  let startX = 0, currentX = 0;
  bubble.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; });
  bubble.addEventListener("touchmove", (e) => {
    currentX = e.touches[0].clientX;
    const diffX = currentX - startX;
    if (Math.abs(diffX) < 100) bubble.style.transform = `translateX(${diffX}px)`;
  });
  bubble.addEventListener("touchend", () => {
    const diffX = currentX - startX;
    bubble.style.transform = "translateX(0px)";
    if (Math.abs(diffX) > 50) triggerReply(msg.text);
    startX = 0; currentX = 0;
  });

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function triggerReply(text) {
  selectedMsgText = text;
  document.getElementById("reply-preview-box").classList.remove("hidden");
  document.getElementById("reply-preview-text").textContent = `Replying: ${text}`;
  document.getElementById("message-input").focus();
}

// Action Bar Buttons
document.getElementById("act-reply").onclick = () => {
  triggerReply(selectedMsgText);
  document.getElementById("floating-action-bar").classList.add("hidden");
};

document.getElementById("act-edit").onclick = () => {
  isEditing = true;
  document.getElementById("message-input").value = selectedMsgText;
  document.getElementById("floating-action-bar").classList.add("hidden");
};

document.getElementById("act-more").onclick = () => {
  if (confirm("Delete this message?")) {
    const roomId = currentUser.id < activeChatPartner.id ? `${currentUser.id}_${activeChatPartner.id}` : `${activeChatPartner.id}_${currentUser.id}`;
    db.ref(`messages/${roomId}/${selectedMsgId}`).remove();
    document.getElementById(`msg-${selectedMsgId}`)?.remove();
  }
  document.getElementById("floating-action-bar").classList.add("hidden");
};

// Enter Key Send Execution
document.getElementById("message-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    document.getElementById("send-btn").click();
  }
});

document.getElementById("send-btn").onclick = () => {
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text || !activeChatPartner) return;

  const roomId = currentUser.id < activeChatPartner.id ? `${currentUser.id}_${activeChatPartner.id}` : `${activeChatPartner.id}_${currentUser.id}`;

  if (isEditing && selectedMsgId) {
    db.ref(`messages/${roomId}/${selectedMsgId}`).update({ text: text });
    isEditing = false;
  } else {
    db.ref(`messages/${roomId}`).push({
      senderId: currentUser.id,
      text: text,
      timestamp: Date.now()
    });
  }

  input.value = "";
  document.getElementById("reply-preview-box").classList.add("hidden");
};

// Info Modal
document.getElementById("chat-info-btn").onclick = () => {
  if (!activeChatPartner) return;
  const firstLetter = activeChatPartner.name ? activeChatPartner.name.charAt(0).toUpperCase() : "U";
  document.getElementById("info-avatar").textContent = firstLetter;
  document.getElementById("info-name").textContent = activeChatPartner.name;
  document.getElementById("info-phone").textContent = activeChatPartner.phone;
  document.getElementById("info-modal").classList.remove("hidden");
};
document.getElementById("info-close-modal").onclick = () => document.getElementById("info-modal").classList.add("hidden");

// Notifications Modal
document.querySelectorAll(".notif-btn-trigger").forEach(btn => {
  btn.onclick = () => document.getElementById("notif-modal").classList.remove("hidden");
});
document.getElementById("close-notif-btn").onclick = () => document.getElementById("notif-modal").classList.add("hidden");

function listenNotifications() {
  db.ref(`invites/${currentUser.id}`).on("value", (snap) => {
    const notifList = document.getElementById("notif-list");
    notifList.innerHTML = "";

    document.querySelectorAll(".notif-badge-elem").forEach(b => {
      if (snap.exists()) b.classList.add("active");
      else b.classList.remove("active");
    });

    if (snap.exists()) {
      snap.forEach((child) => {
        const inv = child.val();
        const div = document.createElement("div");
        div.className = "menu-item";
        div.style.justifyContent = "space-between";
        div.innerHTML = `<span><strong>${inv.senderName}</strong> sent you a chat invite.</span>`;
        notifList.appendChild(div);
      });
    } else {
      notifList.innerHTML = "<p style='text-align:center; color:var(--text-muted);'>No new notifications</p>";
    }
  });
}

// Profile and Main Menu
document.getElementById("main-menu-btn").onclick = () => document.getElementById("main-menu-modal").classList.remove("hidden");
document.getElementById("menu-my-profile").onclick = () => {
  document.getElementById("main-menu-modal").classList.add("hidden");
  document.getElementById("my-avatar").textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U";
  document.getElementById("edit-name-input").value = currentUser.name;
  document.getElementById("edit-bio-input").value = currentUser.bio || "";
  document.getElementById("edit-profile-modal").classList.remove("hidden");
};

document.getElementById("save-profile-btn").onclick = () => {
  currentUser.name = document.getElementById("edit-name-input").value.trim();
  currentUser.bio = document.getElementById("edit-bio-input").value.trim();
  
  db.ref(`users/${currentUser.id}`).update(currentUser).then(() => {
    alert("Profile updated!");
    document.getElementById("edit-profile-modal").classList.add("hidden");
  });
};
document.getElementById("close-profile-btn").onclick = () => document.getElementById("edit-profile-modal").classList.add("hidden");

document.getElementById("chat-back-btn").onclick = () => document.getElementById("chat-screen").classList.add("hidden");
document.getElementById("menu-logout").onclick = () => location.reload();