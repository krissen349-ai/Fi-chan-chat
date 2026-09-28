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
  const data = payload.data || {};
  const notificationTitle = data.title || payload.notification?.title || 'Fi-chan Chat';
  const notificationOptions = {
    body: data.body || payload.notification?.body || 'You received a new message.',
    icon: data.icon || '/fi-chan-logo.jpg',
    data: { url: data.url || '/', chatId: data.chatId || '' }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const appUrl = new URL(notificationData.url || '/', self.location.origin);
  if (notificationData.chatId) {
    appUrl.searchParams.set('chatId', notificationData.chatId);
  }

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin) {
        client.postMessage({ type: 'OPEN_CHAT', chatId: notificationData.chatId || '' });
        return client.focus();
      }
    }
    return self.clients.openWindow(appUrl.href);
  }));
});