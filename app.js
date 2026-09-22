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
let typingTimeout = null;

let replyTargetId = null;
let replyTargetSender = "";

window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });

// Global Theme Switcher
document.querySelectorAll(".theme-btn-trigger").forEach(btn => {
  btn.onclick = () => {
    document.body.classList.toggle("lite-theme");
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
  loadChats();
}

// Online Presence & Background Auto-Delivery
function setupPresence() {
  const userStatusRef = db.ref(`status/${currentUser.id}`);
  
  db.ref(".info/connected").on("value", (snap) => {
    if (!snap.val()) return;
    
    userStatusRef.onDisconnect().set({ state: "Offline", lastSeen: Date.now() }).then(() => {
      userStatusRef.set({ state: "Online", lastSeen: Date.now() });
      listenAndMarkAllIncomingMessagesAsDelivered();
    });
  });
}

function listenAndMarkAllIncomingMessagesAsDelivered() {
  db.ref(`friends/${currentUser.id}`).once("value", (friendsSnap) => {
    if (!friendsSnap.exists()) return;
    
    friendsSnap.forEach((friendChild) => {
      const friendId = friendChild.key;
      const roomId = currentUser.id < friendId ? `${currentUser.id}_${friendId}` : `${friendId}_${currentUser.id}`;
      
      db.ref(`messages/${roomId}`).orderByChild("status").equalTo("sent").on("value", (msgSnap) => {
        msgSnap.forEach((mChild) => {
          if (mChild.val().senderId !== currentUser.id) {
            db.ref(`messages/${roomId}/${mChild.key}`).update({ status: "delivered" });
          }
        });
      });
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

// Contacts Tab
function loadContacts() {
  const panel = document.getElementById("list-panel");
  panel.innerHTML = "";

  const searchWrap = document.createElement("div");
  searchWrap.className = "search-box-wrap";
  searchWrap.style.display = "flex";
  searchWrap.style.gap = "8px";
  searchWrap.innerHTML = `
    <input type="tel" id="contact-search-input" class="neu-input" placeholder="Search phone (e.g. 01700000000)" />
    <button id="contact-search-btn" class="neu-btn primary">Search</button>
  `;
  panel.appendChild(searchWrap);

  const resultsContainer = document.createElement("div");
  resultsContainer.id = "search-results-area";
  panel.appendChild(resultsContainer);

  const friendsContainer = document.createElement("div");
  friendsContainer.id = "friends-list-area";
  panel.appendChild(friendsContainer);

  document.getElementById("contact-search-btn").onclick = () => {
    let inputPhone = document.getElementById("contact-search-input").value.trim();
    if (!inputPhone) return alert("Please enter a phone number!");

    if (inputPhone.startsWith("01")) inputPhone = "+88" + inputPhone;
    else if (inputPhone.startsWith("8801")) inputPhone = "+" + inputPhone;
    inputPhone = inputPhone.replace(/[\s-]/g, "");

    resultsContainer.innerHTML = "<p style='text-align:center; padding:10px; color:var(--text-muted);'>Searching...</p>";

    db.ref("users").orderByChild("phone").equalTo(inputPhone).once("value", (snap) => {
      resultsContainer.innerHTML = "";
      
      if (!snap.exists()) {
        resultsContainer.innerHTML = `
          <div style="text-align:center; padding:15px; color:var(--danger-color); font-size:14px;" class="menu-item">
            Currently this number may not have account in tock
          </div>
        `;
        return;
      }

      snap.forEach((userChild) => {
        const foundUser = userChild.val();
        if (foundUser.id === currentUser.id) {
          resultsContainer.innerHTML = `<div style="text-align:center; padding:10px; color:var(--text-muted);" class="menu-item">This is your own phone number.</div>`;
          return;
        }

        const firstLetter = foundUser.name ? foundUser.name.charAt(0).toUpperCase() : "U";

        const row = document.createElement("div");
        row.className = "menu-item";
        row.style.justifyContent = "space-between";

        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="avatar-small">${firstLetter}</div>
            <div>
              <div style="font-weight:600;">${foundUser.name}</div>
              <div style="font-size:12px; color:var(--text-muted);">${foundUser.phone}</div>
            </div>
          </div>
        `;

        const inviteBtn = document.createElement("button");
        inviteBtn.className = "neu-btn sm primary";
        inviteBtn.textContent = "Invite";

        db.ref(`friends/${currentUser.id}/${foundUser.id}`).once("value", (fSnap) => {
          if (fSnap.exists()) {
            inviteBtn.textContent = "Connected";
            inviteBtn.disabled = true;
            inviteBtn.style.opacity = "0.7";
          }
        });

        inviteBtn.onclick = (e) => {
          e.stopPropagation();
          db.ref(`invites/${foundUser.id}/${currentUser.id}`).set({
            senderName: currentUser.name,
            senderPhone: currentUser.phone,
            timestamp: Date.now()
          }).then(() => {
            alert(`Invite sent to ${foundUser.name}!`);
            inviteBtn.textContent = "Sent";
            inviteBtn.disabled = true;
          });
        };

        row.appendChild(inviteBtn);
        resultsContainer.appendChild(row);
      });
    });
  };

  db.ref(`friends/${currentUser.id}`).once("value", (friendsSnap) => {
    if (!friendsSnap.exists()) {
      friendsContainer.innerHTML = "<p style='text-align:center; color:var(--text-muted); padding:20px;'>No connected contacts yet.</p>";
      return;
    }

    friendsSnap.forEach((friendChild) => {
      const friendId = friendChild.key;

      db.ref(`users/${friendId}`).once("value", (userSnap) => {
        const user = userSnap.val();
        if (!user) return;

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
          <button class="neu-btn sm" disabled style="opacity:0.7; cursor:default;">Connected</button>
        `;

        row.onclick = () => openChat(user);
        friendsContainer.appendChild(row);
      });
    });
  });
}

// Chats List
function loadChats() {
  const panel = document.getElementById("list-panel");
  panel.innerHTML = "";

  db.ref(`friends/${currentUser.id}`).once("value", (friendsSnap) => {
    if (!friendsSnap.exists()) {
      panel.innerHTML = "<p style='text-align:center; color:var(--text-muted); padding:20px;'>No active chats available.</p>";
      return;
    }

    friendsSnap.forEach((friendChild) => {
      const friendId = friendChild.key;
      const roomId = currentUser.id < friendId ? `${currentUser.id}_${friendId}` : `${friendId}_${currentUser.id}`;

      db.ref(`messages/${roomId}`).once("value", (msgSnap) => {
        if (msgSnap.exists()) {
          let unseenCount = 0;
          msgSnap.forEach((mChild) => {
            const m = mChild.val();
            if (m.senderId !== currentUser.id && m.status !== "seen") {
              unseenCount++;
            }
          });

          db.ref(`users/${friendId}`).once("value", (userSnap) => {
            const user = userSnap.val();
            if (!user) return;

            let indicatorText = "";
            let textStyle = "color: var(--text-muted);";

            if (unseenCount === 1) {
              indicatorText = "new message";
              textStyle = "color: var(--primary-color); font-weight: 600;";
            } else if (unseenCount > 1) {
              indicatorText = `${unseenCount} new messages`;
              textStyle = "color: var(--primary-color); font-weight: 600;";
            }

            const firstLetter = user.name ? user.name.charAt(0).toUpperCase() : "U";

            const row = document.createElement("div");
            row.className = "menu-item";
            row.style.justifyContent = "space-between";

            row.innerHTML = `
              <div style="display:flex; align-items:center; gap:12px; width:100%;">
                <div class="avatar-small">${firstLetter}</div>
                <div style="flex:1; overflow:hidden;">
                  <div style="font-weight:600;">${user.name}</div>
                  <div style="font-size:13px; ${textStyle} text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                    ${indicatorText}
                  </div>
                </div>
              </div>
            `;

            row.onclick = () => openChat(user);
            panel.appendChild(row);
          });
        }
      });
    });
  });
}

// Open Active Chat
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

  currentChatRef.on("child_added", (snap) => {
    const msg = snap.val();
    const msgKey = snap.key;

    if (msg.senderId !== currentUser.id && msg.status !== "seen") {
      db.ref(`messages/${roomId}/${msgKey}`).update({ status: "seen" });
    }

    renderMessage(msgKey, msg);
  });

  currentChatRef.on("child_changed", (snap) => {
    const msgKey = snap.key;
    const updatedMsg = snap.val();
    const msgElem = document.getElementById(`msg-${msgKey}`);
    if (msgElem && updatedMsg.senderId === currentUser.id) {
      const tickElem = msgElem.querySelector(".msg-status-ticks");
      if (tickElem) {
        if (updatedMsg.status === "seen") tickElem.textContent = " ✓✓✓";
        else if (updatedMsg.status === "delivered") tickElem.textContent = " ✓✓";
        else tickElem.textContent = " ✓";
      }
    }
  });

  // Typing Listener
  db.ref(`typing/${roomId}/${partner.id}`).on("value", (tSnap) => {
    const isTyping = tSnap.val();
    const indicator = document.getElementById("typing-indicator");
    if (indicator) {
      if (isTyping) indicator.classList.remove("hidden");
      else indicator.classList.add("hidden");
    }
  });
}

// Typing Event
document.getElementById("message-input").addEventListener("input", () => {
  if (!activeChatPartner) return;
  const roomId = currentUser.id < activeChatPartner.id ? `${currentUser.id}_${activeChatPartner.id}` : `${activeChatPartner.id}_${currentUser.id}`;
  
  db.ref(`typing/${roomId}/${currentUser.id}`).set(true);

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    db.ref(`typing/${roomId}/${currentUser.id}`).set(false);
  }, 2000);
});

// Render Messages with Modern Neumorphic Quoted Header
function renderMessage(msgKey, msg) {
  const container = document.getElementById("messages-container");
  let bubble = document.getElementById(`msg-${msgKey}`);
  const isOwn = msg.senderId === currentUser.id;

  let statusTicks = "";
  if (isOwn) {
    if (msg.status === "seen") statusTicks = " ✓✓✓";
    else if (msg.status === "delivered") statusTicks = " ✓✓";
    else statusTicks = " ✓";
  }

  if (!bubble) {
    bubble = document.createElement("div");
    bubble.id = `msg-${msgKey}`;
    bubble.className = `msg-bubble ${isOwn ? "own" : "partner"}`;

    let quoteHTML = "";
    if (msg.replyToText) {
      quoteHTML = `
        <div class="neu-quoted-header" data-target-id="${msg.replyToId || ''}">
          <div class="quoted-bar"></div>
          <div class="quoted-content">
            <span class="quoted-title">${msg.replyToSender || 'Replied'}</span>
            <span class="quoted-text">${msg.replyToText}</span>
          </div>
        </div>
      `;
    }

    bubble.innerHTML = `
      ${quoteHTML}
      <div class="msg-content">${msg.text}</div>
      <div class="msg-footer">
        <span>${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        <span class="msg-status-ticks" style="margin-left: 4px; font-weight: bold; color: var(--primary-color);">${statusTicks}</span>
      </div>
    `;

    // Click Quoted Header -> Scroll To Target Message
    const quoteElem = bubble.querySelector(".neu-quoted-header");
    if (quoteElem) {
      quoteElem.onclick = (e) => {
        e.stopPropagation();
        const targetId = quoteElem.getAttribute("data-target-id");
        if (targetId) {
          const targetMsgElem = document.getElementById(`msg-${targetId}`);
          if (targetMsgElem) {
            targetMsgElem.scrollIntoView({ behavior: "smooth", block: "center" });
            targetMsgElem.classList.add("highlight-pulse");
            setTimeout(() => targetMsgElem.classList.remove("highlight-pulse"), 1200);
          }
        }
      };
    }

    // Dynamic Floating Action Bar Position Logic
    const showFloatingBar = () => {
      selectedMsgId = msgKey;
      selectedMsgText = msg.text;

      const bar = document.getElementById("floating-action-bar");
      bar.classList.remove("hidden");

      const bubbleTop = bubble.offsetTop - container.scrollTop;

      bar.style.top = `${Math.max(10, bubbleTop - 45)}px`;
      if (isOwn) {
        bar.style.right = "16px";
        bar.style.left = "auto";
      } else {
        bar.style.left = `${Math.max(16, bubble.offsetLeft)}px`;
        bar.style.right = "auto";
      }
    };

    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const startHold = () => {
      isDragging = false;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (!isDragging) showFloatingBar();
      }, 800);
    };

    const cancelHold = () => clearTimeout(longPressTimer);

    // --- Touch Events (Mobile Swipe Right) ---
    bubble.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      currentX = startX;
      startHold();
    }, { passive: true });

    bubble.addEventListener("touchmove", (e) => {
      currentX = e.touches[0].clientX;
      const diffX = currentX - startX;

      if (diffX > 10) {
        isDragging = true;
        cancelHold();
        if (diffX < 80) bubble.style.transform = `translateX(${diffX}px)`;
      }
    }, { passive: true });

    bubble.addEventListener("touchend", () => {
      cancelHold();
      const diffX = currentX - startX;
      bubble.style.transform = "translateX(0px)";

      if (diffX > 40 && isDragging) {
        triggerReply(msgKey, msg.text, isOwn ? currentUser.name : activeChatPartner.name);
      }
      isDragging = false;
    });

    // --- Mouse Events (Desktop Swipe Right) ---
    bubble.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      currentX = startX;
      startHold();

      const onMouseMove = (moveEvent) => {
        currentX = moveEvent.clientX;
        const diffX = currentX - startX;
        if (diffX > 10) {
          isDragging = true;
          cancelHold();
          if (diffX < 80) bubble.style.transform = `translateX(${diffX}px)`;
        }
      };

      const onMouseUp = () => {
        cancelHold();
        const diffX = currentX - startX;
        bubble.style.transform = "translateX(0px)";

        if (diffX > 40 && isDragging) {
          triggerReply(msgKey, msg.text, isOwn ? currentUser.name : activeChatPartner.name);
        }

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        isDragging = false;
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    container.appendChild(bubble);
  } else {
    const tickElem = bubble.querySelector(".msg-status-ticks");
    if (tickElem && isOwn) {
      tickElem.textContent = statusTicks;
    }
  }

  container.scrollTop = container.scrollHeight;
}

// Hide Action Bar
document.getElementById("messages-container").addEventListener("click", (e) => {
  if (!e.target.closest(".msg-bubble") && !e.target.closest("#floating-action-bar")) {
    document.getElementById("floating-action-bar").classList.add("hidden");
  }
});

function triggerReply(msgId, text, senderName) {
  selectedMsgId = msgId;
  selectedMsgText = text;
  replyTargetId = msgId;
  replyTargetSender = senderName || (activeChatPartner ? activeChatPartner.name : "User");

  const previewBox = document.getElementById("reply-preview-box");
  const previewText = document.getElementById("reply-preview-text");
  
  if (previewBox && previewText) {
    previewBox.classList.remove("hidden");
    previewText.textContent = `${replyTargetSender}: ${text}`;
  }
  
  document.getElementById("floating-action-bar").classList.add("hidden");
  document.getElementById("message-input").focus();
}

document.getElementById("cancel-reply-btn").onclick = () => {
  document.getElementById("reply-preview-box").classList.add("hidden");
  replyTargetId = null;
  replyTargetSender = "";
};

// Neumorphic Bar Actions
document.getElementById("act-reply").onclick = () => {
  const isOwn = selectedMsgId ? document.getElementById(`msg-${selectedMsgId}`)?.classList.contains("own") : false;
  triggerReply(selectedMsgId, selectedMsgText, isOwn ? currentUser.name : activeChatPartner.name);
};

document.getElementById("act-edit").onclick = () => {
  isEditing = true;
  document.getElementById("message-input").value = selectedMsgText;
  document.getElementById("message-input").focus();
  document.getElementById("floating-action-bar").classList.add("hidden");
};

document.getElementById("act-pin").onclick = () => {
  if (!selectedMsgId || !activeChatPartner) return;
  const roomId = currentUser.id < activeChatPartner.id ? `${currentUser.id}_${activeChatPartner.id}` : `${activeChatPartner.id}_${currentUser.id}`;
  
  db.ref(`pinned/${roomId}`).set({ msgId: selectedMsgId, text: selectedMsgText });
  document.getElementById("pinned-banner").classList.remove("hidden");
  document.getElementById("pinned-msg-text").textContent = selectedMsgText;
  document.getElementById("floating-action-bar").classList.add("hidden");
};

document.getElementById("act-delete").onclick = () => {
  if (!selectedMsgId || !activeChatPartner) return;
  if (confirm("Delete this message?")) {
    const roomId = currentUser.id < activeChatPartner.id ? `${currentUser.id}_${activeChatPartner.id}` : `${activeChatPartner.id}_${currentUser.id}`;
    db.ref(`messages/${roomId}/${selectedMsgId}`).remove();
    document.getElementById(`msg-${selectedMsgId}`)?.remove();
  }
  document.getElementById("floating-action-bar").classList.add("hidden");
};

// Unpin Action
document.getElementById("unpin-btn").onclick = () => {
  if (!activeChatPartner) return;
  const roomId = currentUser.id < activeChatPartner.id ? `${currentUser.id}_${activeChatPartner.id}` : `${activeChatPartner.id}_${currentUser.id}`;
  db.ref(`pinned/${roomId}`).remove();
  document.getElementById("pinned-banner").classList.add("hidden");
};

// Send / Edit Logic with Quoted Header Data Payload
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

  db.ref(`typing/${roomId}/${currentUser.id}`).set(false);

  if (isEditing && selectedMsgId) {
    db.ref(`messages/${roomId}/${selectedMsgId}`).update({ text: text });
    isEditing = false;
  } else {
    db.ref(`status/${activeChatPartner.id}`).once("value", (statusSnap) => {
      const partnerStatus = statusSnap.val();
      const initialStatus = (partnerStatus && partnerStatus.state === "Online") ? "delivered" : "sent";

      const payload = {
        senderId: currentUser.id,
        text: text,
        timestamp: Date.now(),
        status: initialStatus
      };

      const replyBox = document.getElementById("reply-preview-box");
      if (replyBox && !replyBox.classList.contains("hidden") && replyTargetId) {
        payload.replyToId = replyTargetId;
        payload.replyToText = selectedMsgText;
        payload.replyToSender = replyTargetSender;
      }

      db.ref(`messages/${roomId}`).push(payload);
    });
  }

  input.value = "";
  replyTargetId = null;
  replyTargetSender = "";
  document.getElementById("reply-preview-box").classList.add("hidden");
};

// Notifications Listener
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
        const senderId = child.key;
        const inv = child.val();
        
        const div = document.createElement("div");
        div.className = "menu-item";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";

        div.innerHTML = `
          <span><strong>${inv.senderName}</strong> sent you a chat invite.</span>
        `;

        const acceptBtn = document.createElement("button");
        acceptBtn.className = "neu-btn sm primary";
        acceptBtn.textContent = "Accept";

        acceptBtn.onclick = () => {
          db.ref(`friends/${currentUser.id}/${senderId}`).set(true);
          db.ref(`friends/${senderId}/${currentUser.id}`).set(true);

          db.ref(`invites/${currentUser.id}/${senderId}`).remove();
          db.ref(`invites/${senderId}/${currentUser.id}`).remove();

          alert(`Accepted invite from ${inv.senderName}!`);
        };

        div.appendChild(acceptBtn);
        notifList.appendChild(div);
      });
    } else {
      notifList.innerHTML = "<p style='text-align:center; color:var(--text-muted);'>No new notifications</p>";
    }
  });
}

// Modals Setup
document.getElementById("chat-info-btn").onclick = () => {
  if (!activeChatPartner) return;
  const firstLetter = activeChatPartner.name ? activeChatPartner.name.charAt(0).toUpperCase() : "U";
  document.getElementById("info-avatar").textContent = firstLetter;
  document.getElementById("info-name").textContent = activeChatPartner.name;
  document.getElementById("info-phone").textContent = activeChatPartner.phone;
  document.getElementById("info-modal").classList.remove("hidden");
};
document.getElementById("info-close-modal").onclick = () => document.getElementById("info-modal").classList.add("hidden");

document.querySelectorAll(".notif-btn-trigger").forEach(btn => {
  btn.onclick = () => document.getElementById("notif-modal").classList.remove("hidden");
});
document.getElementById("close-notif-btn").onclick = () => document.getElementById("notif-modal").classList.add("hidden");

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

document.getElementById("chat-back-btn").onclick = () => {
  document.getElementById("chat-screen").classList.add("hidden");
  loadChats();
};

document.getElementById("menu-logout").onclick = () => location.reload();

// হেডার টাইপিং ইন্ডিকেটর দেখানোর জন্য
function showHeaderTyping(statusText = 'typing') {
  const statusElem = document.getElementById('chatPartnerStatus');
  if (!statusElem) return;
  
  statusElem.classList.add('typing');
  statusElem.innerHTML = `
    ${statusText}
    <span class="header-typing-dots">
      <span></span>
      <span></span>
      <span></span>
    </span>
  `;
}

// সাধারণ স্ট্যাটাসে ফিরে যাওয়ার জন্য (যেমন: Online / Offline)
function hideHeaderTyping(defaultStatus = 'Online') {
  const statusElem = document.getElementById('chatPartnerStatus');
  if (!statusElem) return;
  
  statusElem.classList.remove('typing');
  statusElem.textContent = defaultStatus;
}