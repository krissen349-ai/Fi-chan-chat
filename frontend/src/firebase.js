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

const messagingPromise = isSupported()
  .then((supported) => supported ? getMessaging(app) : null)
  .catch((error) => {
    console.warn("Firebase Messaging is unavailable:", error);
    return null;
  });

export { auth, db, messagingPromise };