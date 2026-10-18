document.addEventListener('DOMContentLoaded', () => {
  let activeReplyTarget = null;
  let selectedMsgElement = null;
  let selectedMediaFile = null;

  // DOM Elements Selection
  const messagesContainer = document.getElementById('messages-container');
  const floatingActionBar = document.getElementById('floating-action-bar');
  const replyBtn = document.getElementById('act-reply');
  const replyPreviewBox = document.getElementById('reply-preview-box');
  const replyPreviewText = document.getElementById('reply-preview-text');
  const cancelReplyBtn = document.getElementById('cancel-reply-btn');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const themeTriggers = document.querySelectorAll('.theme-btn-trigger');
  
  const attachBtn = document.getElementById('attach-btn');
  const mediaInput = document.getElementById('media-input');

  // Modals & Menu Elements
  const mainMenuBtn = document.getElementById('main-menu-btn');
  const mainMenuModal = document.getElementById('main-menu-modal');
  const notifBtnTrigger = document.querySelector('.notif-btn-trigger');
  const notifModal = document.getElementById('notif-modal');
  const closeNotifBtn = document.getElementById('close-notif-btn');
  const chatBackBtn = document.getElementById('chat-back-btn');
  const chatScreen = document.getElementById('chat-screen');

  // 1. Theme Toggle & SVG Icon Switcher
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

  // 2. Modals Management
  if (mainMenuBtn && mainMenuModal) {
    mainMenuBtn.addEventListener('click', () => mainMenuModal.classList.remove('hidden'));
    mainMenuModal.addEventListener('click', (e) => {
      if (e.target === mainMenuModal) mainMenuModal.classList.add('hidden');
    });
  }

  if (notifBtnTrigger && notifModal) {
    notifBtnTrigger.addEventListener('click', () => notifModal.classList.remove('hidden'));
  }
  if (closeNotifBtn) {
    closeNotifBtn.addEventListener('click', () => notifModal.classList.add('hidden'));
  }

  if (chatBackBtn && chatScreen) {
    chatBackBtn.addEventListener('click', () => {
      chatScreen.classList.add('hidden');
      clearReplyState();
      hideFloatingBar();
    });
  }

  // 3. Attachment File Loader (Images, Videos, Documents)
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

  // 4. Message Stream Interaction (Select Message & Quoted Auto-Scroll)
  if (messagesContainer) {
    messagesContainer.addEventListener('click', (e) => {
      // Auto-scroll on clicking a quoted reply box
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

  // 5. Floating Action Bar Logic
  if (replyBtn) {
    replyBtn.addEventListener('click', () => {
      if (!selectedMsgElement) return;

      const msgId = selectedMsgElement.dataset.id;
      const isOwn = selectedMsgElement.classList.contains('own');
      const senderName = isOwn ? 'You' : 'User';
      
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

  // 6. Send Message with Attachments & Download Option
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

    // Inline Quoted Reply Preview
    let replyHeaderHtml = '';
    if (activeReplyTarget) {
      replyHeaderHtml = `
        <div class="quoted-reply-box" data-target-id="${activeReplyTarget.id}" style="padding: 6px 10px; margin-bottom: 6px; border-left: 3px solid var(--primary-color); background: rgba(0,0,0,0.15); border-radius: 8px; cursor: pointer;">
          <div style="font-size: 11px; font-weight: 700; color: var(--primary-color);">${activeReplyTarget.sender}</div>
          <div style="font-size: 12px; color: var(--text-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 200px;">${escapeHtml(activeReplyTarget.text)}</div>
        </div>
      `;
    }

    // Attachment Element with Left Download Button
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

    // Reset Inputs and State
    messageInput.value = '';
    selectedMediaFile = null;
    if (mediaInput) mediaInput.value = '';
    if (attachBtn) attachBtn.style.color = 'var(--text-color)';
    clearReplyState();
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
});