// ১. Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDsS9YG4esj-PT3iBzzW3__98pwxdCtZvg",
  authDomain: "tock-1fd0e.firebaseapp.com",
  databaseURL: "https://tock-1fd0e-default-rtdb.firebaseio.com",
  projectId: "tock-1fd0e",
  storageBucket: "tock-1fd0e.firebasestorage.app",
  messagingSenderId: "704452309911",
  appId: "1:704452309911:web:a8da0db3a31b57a00f4ad2"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let currentChatRoomId = null;

// ২. reCAPTCHA Verifier সেটআপ
window.onload = () => {
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    'size': 'invisible'
  });
};

// ৩. মোবাইলে OTP পাঠানোর ফাংশন
function sendOTP() {
  const phoneNumber = document.getElementById("auth-phone").value.trim();
  const username = document.getElementById("auth-username").value.trim();

  if (!phoneNumber || !username) {
    alert("অনুগ্রহ করে আপনার নাম এবং সঠিক ফোন নম্বর দিন!");
    return;
  }

  localStorage.setItem("tock_username", username);
  const appVerifier = window.recaptchaVerifier;

  firebase.auth().signInWithPhoneNumber(phoneNumber, appVerifier)
    .then((confirmationResult) => {
      window.confirmationResult = confirmationResult;
      alert("আপনার মোবাইলে OTP কোড পাঠানো হয়েছে!");
      
      document.getElementById("phone-step").style.display = "none";
      document.getElementById("otp-step").style.display = "block";
    })
    .catch((error) => {
      alert("OTP পাঠাতে সমস্যা হয়েছে: " + error.message);
    });
}

// ৪. OTP ভেরিফাই করে লগইন করার ফাংশন
function verifyOTP() {
  const code = document.getElementById("auth-otp").value.trim();

  if (!code) {
    alert("OTP কোডটি টাইপ করুন!");
    return;
  }

  window.confirmationResult.confirm(code).then((result) => {
    const user = result.user;
    const username = localStorage.getItem("tock_username");

    user.updateProfile({ displayName: username }).then(() => {
      alert("অ্যাকাউন্ট সফলভাবে ভেরিফাইড হয়েছে!");
    });

  }).catch((error) => {
    alert("ভুল OTP কোড! আবার চেষ্টা করুন। " + error.message);
  });
}

// ৫. লগআউট ফাংশন
function logOut() {
  firebase.auth().signOut().then(() => {
    alert("লগআউট হয়েছে!");
  });
}

// ৬. নম্বর দিয়ে বন্ধুকে খুঁজে ১-অন-১ প্রাইভেট চ্যাট রুম তৈরি
function searchAndStartChat() {
  const friendPhone = document.getElementById("search-phone").value.trim();
  const currentUser = firebase.auth().currentUser;

  if (!friendPhone) {
    alert("বন্ধুর ফোন নম্বর লিখুন!");
    return;
  }

  if (friendPhone === currentUser.phoneNumber) {
    alert("নিজের নম্বরে চ্যাট করা যাবে না!");
    return;
  }

  // ২টি ফোন নম্বর সাজিয়ে ইউনিক চ্যাট রুম আইডি তৈরি
  const phoneNumbers = [currentUser.phoneNumber, friendPhone].sort();
  currentChatRoomId = `chat_${phoneNumbers[0]}_${phoneNumbers[1]}`.replace(/\+/g, '');

  document.getElementById("current-chat-title").textContent = `Chat: ${friendPhone}`;
  loadPrivateMessages(currentChatRoomId);
}

// ৭. প্রাইভেট রুমের মেসেজ ডাটাবেজ থেকে লোড করা
function loadPrivateMessages(roomId) {
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML = ""; // আগের চ্যাট মুছে দেওয়া

  database.ref(`private_chats/${roomId}`).off();
  database.ref(`private_chats/${roomId}`).on("child_added", (snapshot) => {
    const data = snapshot.val();
    const currentUser = firebase.auth().currentUser;
    const isMe = data.uid === currentUser.uid;

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("msg-item");
    if (isMe) msgDiv.classList.add("my-message");

    msgDiv.innerHTML = `<strong>${data.username}</strong><br>${data.message} <div style="font-size:10px; opacity:0.7; text-align:right;">${data.time}</div>`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

// ৮. ১-অন-১ প্রাইভেট মেসেজ সেন্ড করা
function sendMessage() {
  const user = firebase.auth().currentUser;
  const messageInput = document.getElementById("message");
  const message = messageInput.value.trim();

  if (!user || message === "") return;
  if (!currentChatRoomId) {
    alert("আগে কোনো বন্ধু সার্চ করে চ্যাট রুম শুরু করুন!");
    return;
  }

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  database.ref(`private_chats/${currentChatRoomId}`).push({
    uid: user.uid,
    username: user.displayName || user.phoneNumber,
    message: message,
    time: time,
    timestamp: Date.now()
  });

  messageInput.value = "";
}

// ৯. Auth State লিসেনার
firebase.auth().onAuthStateChanged((user) => {
  const authContainer = document.getElementById("auth-container");
  const chatContainer = document.getElementById("chat-container");

  if (user) {
    authContainer.style.display = "none";
    chatContainer.style.display = "flex";
  } else {
    authContainer.style.display = "flex";
    chatContainer.style.display = "none";
  }
});
// ১০. থিম টগল লজিক (Light / Dark Theme)
const themeToggleBtn = document.getElementById("theme-toggle");

if (themeToggleBtn) {
  // আগের সেভ হওয়া থিম চেক করা
  const currentTheme = localStorage.getItem("tock_theme");
  if (currentTheme === "dark") {
    document.body.classList.add("dark-theme");
    themeToggleBtn.querySelector(".icon").textContent = "🌙";
  }

  themeToggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-theme");
    const isDark = document.body.classList.contains("dark-theme");
    
    // আইকন ও লোকাল স্টোরেজ আপডেট
    themeToggleBtn.querySelector(".icon").textContent = isDark ? "🌙" : "☀️";
    localStorage.setItem("tock_theme", isDark ? "dark" : "light");
  });
}