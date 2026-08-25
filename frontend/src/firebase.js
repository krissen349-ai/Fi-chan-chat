import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDTqT68Af9sVxhdUwqFFRPe1GIzHfSc4X8",
  authDomain: "super-chat-app-5dbaa.firebaseapp.com",
  projectId: "super-chat-app-5dbaa",
  storageBucket: "super-chat-app-5dbaa.firebasestorage.app",
  messagingSenderId: "881197529976",
  appId: "1:881197529976:web:baa044554bf2260f21e68d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const auth = getAuth(app);
const db = getFirestore(app);

// 🔥 Safety Check: Insecure HTTP / IP address par crash hone se bachane ke liye
let messaging = null;
isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  } else {
    console.log("Firebase Messaging is not supported on this connection (HTTP/IP).");
  }
}).catch((err) => console.log("Messaging check error:", err));

export { auth, db, messaging };