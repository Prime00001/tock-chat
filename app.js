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

document.addEventListener('DOMContentLoaded', () => {
  // Global State Variables
  let currentUser = null;
  let activeChatPartner = null;
  let activeReplyTarget = null;
  let selectedMsgElement = null;
  let selectedMediaFile = null;
  let confirmationResult = null;



  // DOM Elements Selection
  const authScreen = document.getElementById('auth-screen');
  const appContainer = document.getElementById('app-container');
  const phoneStep = document.getElementById('phone-step');
  const otpStep = document.getElementById('otp-step');
  const authNameInput = document.getElementById('auth-name');
  const authPhoneInput = document.getElementById('auth-phone');
  const authOtpInput = document.getElementById('auth-otp');
  const sendOtpBtn = document.getElementById('send-otp-btn');
  const verifyOtpBtn = document.getElementById('verify-otp-btn');

  const mainNavTabs = document.querySelectorAll('.nav-tabs .tab-btn');
  const listPanel = document.getElementById('list-panel');
  const chatScreen = document.getElementById('chat-screen');
  const chatBackBtn = document.getElementById('chat-back-btn');
  const chatInfoBtn = document.getElementById('chat-info-btn');
  const chatPartnerAvatar = document.getElementById('chat-partner-avatar');
  const chatPartnerName = document.getElementById('chat-partner-name');
  const chatPartnerStatus = document.getElementById('chat-partner-status');

  const messagesContainer = document.getElementById('messages-container');
  const floatingActionBar = document.getElementById('floating-action-bar');
  const replyBtn = document.getElementById('act-reply');
  const editBtn = document.getElementById('act-edit');
  const pinBtn = document.getElementById('act-pin');
  const deleteBtn = document.getElementById('act-delete');

  const replyPreviewBox = document.getElementById('reply-preview-box');
  const replyPreviewText = document.getElementById('reply-preview-text');
  const cancelReplyBtn = document.getElementById('cancel-reply-btn');

  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const attachBtn = document.getElementById('attach-btn');
  const mediaInput = document.getElementById('media-input');

  const themeTriggers = document.querySelectorAll('.theme-btn-trigger');
  const notifTrigger = document.querySelector('.notif-btn-trigger');
  const notifModal = document.getElementById('notif-modal');
  const closeNotifBtn = document.getElementById('close-notif-btn');

  const infoModal = document.getElementById('info-modal');
  const infoCloseModal = document.getElementById('info-close-modal');
  const infoAvatar = document.getElementById('info-avatar');
  const infoName = document.getElementById('info-name');
  const infoPhone = document.getElementById('info-phone');

  const mainMenuBtn = document.getElementById('main-menu-btn');
  const mainMenuModal = document.getElementById('main-menu-modal');
  const menuMyProfile = document.getElementById('menu-my-profile');
  const menuLogout = document.getElementById('menu-logout');

  const editProfileModal = document.getElementById('edit-profile-modal');
  const editNameInput = document.getElementById('edit-name-input');
  const editBioInput = document.getElementById('edit-bio-input');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const closeProfileBtn = document.getElementById('close-profile-btn');

  const typingIndicator = document.getElementById('typing-indicator');
  const pinnedBanner = document.getElementById('pinned-banner');
  const pinnedMsgText = document.getElementById('pinned-msg-text');
  const unpinBtn = document.getElementById('unpin-btn');

  // -------------------------------------------------------------
  // 1. Theme Switcher with SVG Toggle for Upload Icon
  // -------------------------------------------------------------
  themeTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      document.body.classList.toggle('lite-theme');
      const isLite = document.body.classList.contains('lite-theme');

      const darkShareIcon = document.querySelector('.share-icon-dark');
      const liteShareIcon = document.querySelector('.share-icon-lite');

      if (darkShareIcon && liteShareIcon) {
        if (isLite) {
          darkShareIcon.classList.add('hidden');
          liteShareIcon.classList.remove('hidden');
        } else {
          liteShareIcon.classList.add('hidden');
          darkShareIcon.classList.remove('hidden');
        }
      }
    });
  });

  // -------------------------------------------------------------
  // 2. Attach Media Button Event Listeners
  // -------------------------------------------------------------
  if (attachBtn && mediaInput) {
    attachBtn.addEventListener('click', () => {
      mediaInput.click();
    });

    mediaInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          let fileType = 'file';
          if (file.type.startsWith('image/')) fileType = 'image';
          else if (file.type.startsWith('video/')) fileType = 'video';

          selectedMediaFile = {
            url: evt.target.result,
            name: file.name,
            type: fileType
          };
          attachBtn.style.color = 'var(--primary-color)';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // -------------------------------------------------------------
  // 3. Navigation Tabs Switching
  // -------------------------------------------------------------
  mainNavTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      mainNavTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.id === 'tab-chats') {
        renderChatsList();
      } else {
        renderContactsList();
      }
    });
  });

  function renderChatsList() {
    listPanel.innerHTML = `
      <div class="search-box-wrap">
        <input type="text" class="neu-input" placeholder="Search chats..." />
      </div>
      <div class="menu-item" onclick="openChat('user_alex', 'Alex Vance', 'Online')">
        <div class="avatar-small">A</div>
        <div style="margin-left: 12px; flex: 1;">
          <div style="font-weight: 700;">Alex Vance</div>
          <div style="font-size: 12px; color: var(--text-muted);">Hey, how is Tock project going?</div>
        </div>
      </div>
    `;
  }

  function renderContactsList() {
    listPanel.innerHTML = `
      <div class="search-box-wrap">
        <input type="text" class="neu-input" placeholder="Search contacts..." />
      </div>
      <div class="menu-item" onclick="openChat('user_alex', 'Alex Vance', 'Online')">
        <div class="avatar-small">A</div>
        <div style="margin-left: 12px;">
          <div style="font-weight: 700;">Alex Vance</div>
          <div style="font-size: 12px; color: var(--text-muted);">01700000000</div>
        </div>
      </div>
    `;
  }

  // Initialize view
  renderChatsList();

  // -------------------------------------------------------------
  // 4. Open & Close Active Chat Screen
  // -------------------------------------------------------------
  window.openChat = function(userId, userName, status) {
    activeChatPartner = { id: userId, name: userName, status: status };
    chatPartnerAvatar.innerText = userName.charAt(0).toUpperCase();
    chatPartnerName.innerText = userName;
    chatPartnerStatus.innerText = status;
    chatScreen.classList.remove('hidden');
  };

  if (chatBackBtn) {
    chatBackBtn.addEventListener('click', () => {
      chatScreen.classList.add('hidden');
      activeChatPartner = null;
    });
  }

  if (chatInfoBtn) {
    chatInfoBtn.addEventListener('click', () => {
      if (!activeChatPartner) return;
      infoAvatar.innerText = activeChatPartner.name.charAt(0).toUpperCase();
      infoName.innerText = activeChatPartner.name;
      infoPhone.innerText = 'Phone: +8801700000000';
      infoModal.classList.remove('hidden');
    });
  }

  if (infoCloseModal) {
    infoCloseModal.addEventListener('click', () => {
      infoModal.classList.add('hidden');
    });
  }

  // -------------------------------------------------------------
  // 5. Message Selection & Floating Action Bar
  // -------------------------------------------------------------
  if (messagesContainer) {
    messagesContainer.addEventListener('click', (e) => {
      // Quoted Reply Scroll logic
      const quotedHeader = e.target.closest('.quoted-reply-box');
      if (quotedHeader) {
        const targetId = quotedHeader.dataset.targetId;
        const targetElem = messagesContainer.querySelector(`[data-id="${targetId}"]`);
        if (targetElem) {
          targetElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetElem.classList.add('highlight-pulse');
          setTimeout(() => { targetElem.classList.remove('highlight-pulse'); }, 1200);
        }
        return;
      }

      const msgBubble = e.target.closest('.msg-bubble');
      if (!msgBubble) {
        hideFloatingBar();
        return;
      }

      selectedMsgElement = msgBubble;
      const rect = msgBubble.getBoundingClientRect();
      const containerRect = messagesContainer.getBoundingClientRect();

      if (floatingActionBar) {
        floatingActionBar.style.top = `${rect.top - containerRect.top - 42}px`;
        floatingActionBar.style.left = `${rect.left - containerRect.left}px`;
        floatingActionBar.classList.remove('hidden');
      }
    });
  }

  // Action Bar Triggers
  if (replyBtn) {
    replyBtn.addEventListener('click', () => {
      if (!selectedMsgElement) return;

      const msgId = selectedMsgElement.dataset.id;
      const isOwn = selectedMsgElement.classList.contains('own');
      const senderName = isOwn ? 'You' : (activeChatPartner ? activeChatPartner.name : 'User');

      const textNode = selectedMsgElement.querySelector('.msg-text');
      const msgText = textNode ? textNode.innerText : 'Attachment';

      activeReplyTarget = { id: msgId, sender: senderName, text: msgText };

      if (replyPreviewText && replyPreviewBox) {
        replyPreviewText.innerText = `Replying to ${senderName}: ${msgText}`;
        replyPreviewBox.classList.remove('hidden');
      }

      hideFloatingBar();
      if (messageInput) messageInput.focus();
    });
  }

  if (pinBtn) {
    pinBtn.addEventListener('click', () => {
      if (!selectedMsgElement) return;
      const textNode = selectedMsgElement.querySelector('.msg-text');
      const msgText = textNode ? textNode.innerText : 'Pinned Media';
      pinnedMsgText.innerText = msgText;
      pinnedBanner.classList.remove('hidden');
      hideFloatingBar();
    });
  }

  if (unpinBtn) {
    unpinBtn.addEventListener('click', () => {
      pinnedBanner.classList.add('hidden');
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (selectedMsgElement) {
        selectedMsgElement.remove();
        hideFloatingBar();
      }
    });
  }

  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener('click', clearReplyState);
  }

  function clearReplyState() {
    activeReplyTarget = null;
    if (replyPreviewBox) replyPreviewBox.classList.add('hidden');
  }

  function hideFloatingBar() {
    if (floatingActionBar) floatingActionBar.classList.add('hidden');
    selectedMsgElement = null;
  }

  // -------------------------------------------------------------
  // 6. Send Message Logic (Supports Attachments & Download Buttons)
  // -------------------------------------------------------------
  if (sendBtn && messageInput) {
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !selectedMediaFile) return;

    const newMsgId = 'msg-' + Date.now();
    const msgBubble = document.createElement('div');
    msgBubble.className = 'msg-bubble own';
    msgBubble.dataset.id = newMsgId;

    // Quoted Reply Header
    let replyHeaderHtml = '';
    if (activeReplyTarget) {
      replyHeaderHtml = `
        <div class="quoted-reply-box" data-target-id="${activeReplyTarget.id}" style="padding: 6px 10px; margin-bottom: 6px; border-left: 3px solid var(--primary-color); background: rgba(0,0,0,0.15); border-radius: 8px; cursor: pointer;">
          <div style="font-size: 11px; font-weight: 700; color: var(--primary-color);">${activeReplyTarget.sender}</div>
          <div style="font-size: 12px; color: var(--text-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 200px;">${escapeHtml(activeReplyTarget.text)}</div>
        </div>
      `;
    }

    // Attachment Layout with Left Corner Download SVG Button
    let mediaHtml = '';
    if (selectedMediaFile) {
      const dlBtnHtml = `
        <a href="${selectedMediaFile.url}" download="${selectedMediaFile.name}" class="attachment-dl-btn" title="Download">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4"></path>
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path>
          </svg>
        </a>
      `;

      if (selectedMediaFile.type === 'image') {
        mediaHtml = `
          <div class="media-preview-container">
            ${dlBtnHtml}
            <img src="${selectedMediaFile.url}" alt="Image" style="max-width: 100%; border-radius: 12px; display: block;" />
          </div>`;
      } else if (selectedMediaFile.type === 'video') {
        mediaHtml = `
          <div class="media-preview-container">
            ${dlBtnHtml}
            <video src="${selectedMediaFile.url}" controls style="max-width: 100%; border-radius: 12px; display: block;"></video>
          </div>`;
      } else {
        mediaHtml = `
          <div class="media-preview-container file-card neu-card">
            ${dlBtnHtml}
            <span class="file-name">${escapeHtml(selectedMediaFile.name)}</span>
          </div>`;
      }
    }

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    msgBubble.innerHTML = `
      ${replyHeaderHtml}
      ${mediaHtml}
      ${text ? `<div class="msg-text">${escapeHtml(text)}</div>` : ''}
      <div class="msg-footer">${currentTime}</div>
    `;

    messagesContainer.appendChild(msgBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Reset Input States
    messageInput.value = '';
    selectedMediaFile = null;
    if (mediaInput) mediaInput.value = '';
    if (attachBtn) attachBtn.style.color = 'var(--text-color)';
    clearReplyState();
  }

  // -------------------------------------------------------------
  // 7. Modals & Menu Event Listeners
  // -------------------------------------------------------------
  if (mainMenuBtn) {
    mainMenuBtn.addEventListener('click', () => {
      mainMenuModal.classList.remove('hidden');
    });
  }

  if (menuMyProfile) {
    menuMyProfile.addEventListener('click', () => {
      mainMenuModal.classList.add('hidden');
      editProfileModal.classList.remove('hidden');
    });
  }

  if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', () => {
      editProfileModal.classList.add('hidden');
    });
  }

  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
      editProfileModal.classList.add('hidden');
    });
  }

  if (menuLogout) {
    menuLogout.addEventListener('click', () => {
      mainMenuModal.classList.add('hidden');
      appContainer.classList.add('hidden');
      authScreen.classList.remove('hidden');
    });
  }

  if (notifTrigger) {
    notifTrigger.addEventListener('click', () => {
      notifModal.classList.remove('hidden');
    });
  }

  if (closeNotifBtn) {
    closeNotifBtn.addEventListener('click', () => {
      notifModal.classList.add('hidden');
    });
  }

  // Dummy Auth Handler
  if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', () => {
      phoneStep.classList.add('hidden');
      otpStep.classList.remove('hidden');
    });
  }

  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', () => {
      authScreen.classList.add('hidden');
      appContainer.classList.remove('hidden');
    });
  }

  // Helper Function
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
});