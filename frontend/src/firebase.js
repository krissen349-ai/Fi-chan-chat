import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// 🔥 1. Yeh line add karein
import { getMessaging } from "firebase/messaging";

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
// 🔥 2. Messaging initialize karein
const messaging = getMessaging(app);

// 🔥 3. Messaging ko bhi export karein
export { auth, db, messaging };