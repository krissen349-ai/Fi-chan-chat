importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Firebase config ko yahan bhi initialize karna padta hai
firebase.initializeApp({
  apiKey: "AIzaSyDTqT68Af9sVxhdUwqFFRPe1GIzHfSc4X8",
  authDomain: "super-chat-app-5dbaa.firebaseapp.com",
  projectId: "super-chat-app-5dbaa",
  storageBucket: "super-chat-app-5dbaa.firebasestorage.app",
  messagingSenderId: "881197529976",
  appId: "1:881197529976:web:baa044554bf2260f21e68d"
});

const messaging = firebase.messaging();

// Optional: Agar app background mein ho aur notification aaye toh yahan handle hoti hai
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico' // Aap chahein toh apna icon laga sakte hain
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});