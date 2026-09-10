// Firebase Configuration
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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Page load হলে আগের সেভ করা নাম বসানো এবং নোটিফিকেশন পারমিশন চাওয়া
window.onload = () => {
  const savedName = localStorage.getItem("tock_username");
  if (savedName) {
    document.getElementById("username").value = savedName;
  }

  // Request Notification Permission
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
};

// Send Message Function
function sendMessage() {
  const usernameInput = document.getElementById("username");
  const messageInput = document.getElementById("message");

  const username = usernameInput.value.trim();
  const message = messageInput.value.trim();

  if (username === "" || message === "") {
    alert("Please enter both name and message!");
    return;
  }

  localStorage.setItem("tock_username", username);

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  database.ref("messages").push({
    username: username,
    message: message,
    time: time,
    timestamp: Date.now()
  });

  messageInput.value = "";
}

// Enter Key Event
document.getElementById("message").addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

// Read Messages & Show Notification
database.ref("messages").on("child_added", (snapshot) => {
  const data = snapshot.val();
  const chatBox = document.getElementById("chat-box");
  const myUsername = localStorage.getItem("tock_username");

  const messageElement = document.createElement("div");
  messageElement.classList.add("msg-item");
  
  const msgTime = data.time || "";

  messageElement.innerHTML = `
    <strong>${data.username}</strong>
    <span>${data.message}</span>
    <small class="msg-time">${msgTime}</small>
  `;

  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
  // অন্য কেউ মেসেজ দিলে এবং ট্যাব মিনিমাইজড/আলাদা থাকলে নোটিফিকেশন দেখাবে
  if (document.hidden && data.username !== myUsername && Notification.permission === "granted") {
    new Notification(`Tock: ${data.username}`, {
      body: data.message,
      icon: "https://cdn-icons-png.flaticon.com/512/134/134937.png"
    });
  }
});
// Theme Toggle Logic with Sun/Moon Icons
const themeToggleBtn = document.getElementById('theme-toggle');

themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  const iconSpan = themeToggleBtn.querySelector('.icon');
  
  if (document.body.classList.contains('dark-theme')) {
    iconSpan.textContent = '🌙'; // ডার্ক মোড চালু হলে চাঁদ দেখাবে
  } else {
    iconSpan.textContent = '☀️'; // লাইট মোড চালু হলে সূর্য দেখাবে
  }
});