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

// Render Recaptcha for Phone Auth
window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
  'size': 'invisible'
});

// Theme Switcher
function toggleTheme() {
  document.body.classList.toggle("lite-theme");
  document.body.classList.toggle("dark-theme");
}
document.getElementById("theme-btn").onclick = toggleTheme;
document.getElementById("auth-theme-btn").onclick = toggleTheme;

// --- PROBLEM 1 FIX: Strict Bangladeshi (+880) OTP Authentication ---
document.getElementById("send-otp-btn").onclick = () => {
  const name = document.getElementById("auth-name").value.trim();
  const phone = document.getElementById("auth-phone").value.trim();

  // Validate Bangladesh standard mobile numbers
  const bdPhoneRegex = /^\+8801[3-9]\d{8}$/;
  if (!name) return alert("Please enter your name!");
  if (!bdPhoneRegex.test(phone)) return alert("Invalid Bangladesh number! Format must be +8801XXXXXXXXX");

  auth.signInWithPhoneNumber(phone, window.recaptchaVerifier)
    .then((result) => {
      confirmationResult = result;
      document.getElementById("phone-step").classList.add("hidden");
      document.getElementById("otp-step").classList.remove("hidden");
      alert("OTP code has been sent to your mobile phone!");
    })
    .catch((error) => alert("Error sending OTP: " + error.message));
};

document.getElementById("verify-otp-btn").onclick = () => {
  const otp = document.getElementById("auth-otp").value.trim();
  const name = document.getElementById("auth-name").value.trim();
  const phone = document.getElementById("auth-phone").value.trim();

  if (otp.length !== 6) return alert("Please enter a valid 6-digit OTP!");

  confirmationResult.confirm(otp).then((res) => {
    const uid = res.user.uid;
    currentUser = { id: uid, name: name, phone: phone, bio: "Hey there! I am using Tock." };
    
    // Save User Data to Database
    db.ref(`users/${uid}`).set(currentUser).then(() => {
      initApp();
    });
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
    userStatusRef.onDisconnect().set("Offline").then(() => userStatusRef.set("Online"));
  });
}

// --- PROBLEM 2 FIX: Working Notifications & Real Invitations ---
function sendInvite(targetId) {
  db.ref(`invites/${targetId}/${currentUser.id}`).set({
    senderName: currentUser.name,
    senderPhone: currentUser.phone,
    timestamp: Date.now()
  });
}

function listenNotifications() {
  db.ref(`invites/${currentUser.id}`).on("value", (snap) => {
    const badge = document.getElementById("notif-badge");
    const notifList = document.getElementById("notif-list");
    notifList.innerHTML = "";

    if (snap.exists()) {
      badge.classList.add("active");
      snap.forEach((child) => {
        const inv = child.val();
        const senderId = child.key;

        const div = document.createElement("div");
        div.className = "menu-item";
        div.style.justify = "space-between";
        div.innerHTML = `<span><strong>${inv.senderName}</strong> sent you a chat invite.</span>`;
        
        const acceptBtn = document.createElement("button");
        acceptBtn.className = "neumorphic-text-btn invited";
        acceptBtn.textContent = "Accept";
        acceptBtn.onclick = () => {
          // Add to mutual contacts and remove notification
          db.ref(`contacts/${currentUser.id}/${senderId}`).set(true);
          db.ref(`contacts/${senderId}/${currentUser.id}`).set(true);
          db.ref(`invites/${currentUser.id}/${senderId}`).remove();
          alert("Invite accepted!");
        };
        
        div.appendChild(acceptBtn);
        notifList.appendChild(div);
      });
    } else {
      badge.classList.remove("active");
      notifList.innerHTML = "<p>No new notifications</p>";
    }
  });
}

document.getElementById("notif-btn").onclick = () => document.getElementById("notif-modal").classList.remove("hidden");
document.getElementById("close-notif-btn").onclick = () => document.getElementById("notif-modal").classList.add("hidden");

// Contacts List Navigation & Real-time Buttons
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
          sendInvite(user.id);
        };

        row.onclick = () => openChat(user);
        row.appendChild(inviteBtn);
        panel.appendChild(row);
      }
    });
  });
}

// --- PROBLEM 3 FIX: Profile Modal View & Edit ---
document.getElementById("main-menu-btn").onclick = () => document.getElementById("main-menu-modal").classList.remove("hidden");
document.getElementById("menu-my-profile").onclick = () => {
  document.getElementById("main-menu-modal").classList.add("hidden");
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

// --- PROBLEM 4 FIX: Chat Interface & Long Press Floating Actions ---
function openChat(partner) {
  activeChatPartner = partner;
  document.getElementById("chat-screen").classList.remove("hidden");
  document.getElementById("chat-partner-name").textContent = partner.name;

  const messagesContainer = document.getElementById("messages-container");
  messagesContainer.innerHTML = "";

  if (currentChatRef) currentChatRef.off();
  const roomId = currentUser.id < partner.id ? `${currentUser.id}_${partner.id}` : `${partner.id}_${currentUser.id}`;
  currentChatRef = db.ref(`messages/${roomId}`);

  currentChatRef.on("child_added", (snap) => renderMessage(snap.key, snap.val()));
}

function renderMessage(msgKey, msg) {
  const container = document.getElementById("messages-container");
  const bubble = document.createElement("div");
  bubble.id = `msg-${msgKey}`;
  const isOwn = msg.senderId === currentUser.id;
  bubble.className = `msg-bubble ${isOwn ? "own" : "partner"}`;
  bubble.innerHTML = `<div>${msg.text}</div><div class="msg-footer"><span>${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>`;

  // Long press event (Mobile & Desktop mouse hold)
  const handleHold = (e) => {
    longPressTimer = setTimeout(() => {
      selectedMsgId = msgKey;
      selectedMsgText = msg.text;
      
      const bar = document.getElementById("floating-action-bar");
      bar.classList.remove("hidden");
      const rect = bubble.getBoundingClientRect();
      bar.style.top = `${rect.top - 40}px`;
      bar.style.left = `${rect.left}px`;
    }, 700);
  };

  const cancelHold = () => clearTimeout(longPressTimer);

  bubble.addEventListener("touchstart", handleHold);
  bubble.addEventListener("touchend", cancelHold);
  bubble.addEventListener("mousedown", handleHold);
  bubble.addEventListener("mouseup", cancelHold);

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// Floating Actions Binding
document.getElementById("act-reply").onclick = () => {
  document.getElementById("reply-preview-box").classList.remove("hidden");
  document.getElementById("reply-preview-text").textContent = `Replying: ${selectedMsgText}`;
  document.getElementById("floating-action-bar").classList.add("hidden");
};

document.getElementById("act-edit").onclick = () => {
  isEditing = true;
  document.getElementById("message-input").value = selectedMsgText;
  document.getElementById("floating-action-bar").classList.add("hidden");
};

document.getElementById("act-delete").onclick = () => {
  if (currentChatRef && selectedMsgId) {
    currentChatRef.child(selectedMsgId).remove();
    document.getElementById(`msg-${selectedMsgId}`)?.remove();
    document.getElementById("floating-action-bar").classList.add("hidden");
  }
};

document.getElementById("cancel-reply-btn").onclick = () => document.getElementById("reply-preview-box").classList.add("hidden");

// Message Send / Edit Trigger
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

document.getElementById("chat-back-btn").onclick = () => document.getElementById("chat-screen").classList.add("hidden");