import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import './App.css';
import appLogo from './fi chat.jpg'; 
import Gifts from './Gifts'; 
import GameModal from './GameModal';
import { deleteToken, getToken, onMessage } from "firebase/messaging";
import { set, get, del } from 'idb-keyval';

import { messagingPromise } from "./firebase";
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  onAuthStateChanged,
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  getDocs, 
  where, 
  deleteDoc, 
  doc,     
  setDoc
} from 'firebase/firestore';

const socket = io('https://fi-chan-chat.onrender.com', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  autoConnect: true
});

const uploadToCloudinary = async (file) => {
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !uploadPreset) {
    throw new Error('Uploads are not configured. Set the Cloudinary cloud name and unsigned upload preset.');
  }

  const resourceType = /^(image|video|audio)\//.test(file.type) ? 'auto' : 'raw';
  const formData = new FormData();
  formData.append('file', file, file.name || 'upload');
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || `Upload failed (HTTP ${response.status}). Check the Cloudinary cloud name and unsigned preset.`);
  }
  return result.secure_url;
};

const ensureHostedImage = async (image) => {
  if (!image?.startsWith('data:image')) return image;
  const blob = await (await fetch(image)).blob();
  const extension = blob.type.split('/')[1] || 'jpg';
  return uploadToCloudinary(new File([blob], `profile.${extension}`, { type: blob.type || 'image/jpeg' }));
};

function App() {
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [showGiftsSection, setShowGiftsSection] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [pushNotificationAlert, setPushNotificationAlert] = useState(null);
  const [notificationStatus, setNotificationStatus] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('chat_active_tab') || 'rooms'); 
  const [theme, setTheme] = useState(() => localStorage.getItem('chat_theme') || 'dark');
  const [avatarSeed, setAvatarSeed] = useState('Amaya'); 
  const [customPfp, setCustomPfp] = useState(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  const [usersList, setUsersList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [allRegisteredUsers, setAllRegisteredUsers] = useState([]);

  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;

    const currentUid = auth.currentUser.uid;
    const q = query(collection(db, "users"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => doc.data());
      setAllRegisteredUsers(fetchedUsers.filter(u => u.uid !== currentUid));
    }, (err) => console.log("Users snapshot error:", err));

    return () => unsubscribe();
  }, [isLoggedIn]);
  
  const [activeChat, setActiveChatState] = useState(null); 
  const [messages, setMessages] = useState({});
  const [typedMessage, setTypedMessage] = useState('');
  
  const [typingStatus, setTypingStatus] = useState({});
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null); 
  const [replyToMsg, setReplyToMsg] = useState(null); 
  const [editMsg, setEditMsg] = useState(null); 

  const [showProfileModal, setShowProfileModal] = useState(null); 
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPfp, setEditPfp] = useState('');
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [scrollDirectionUp, setScrollDirectionUp] = useState(true);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

// Line 149-152 ko aisa kar dein:
  const [gameInvite, setGameInvite] = useState(null); // Pending challenge
  const [gameSession, setGameSession] = useState(null); // Active Game State
  const [isRecording, setIsRecording] = useState(false); // 👈 Uncomment Karein
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showMicErrorModal, setShowMicErrorModal] = useState(false); 
  const timerRef = useRef(null);
  const pushTokenRef = useRef(null);
  const socketUserReadyRef = useRef(false);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const AVAILABLE_SEEDS = [
    'Amaya', 'Brian', 'Chloe', 'Daniel', 'Emily', 'George', 'Heidi', 'Ian', 'Jessica', 
    'Kevin', 'Lily', 'Max','Asher', 'Sasha', 'Cody', 'Luna', 'Ryder', 'Zane', 'Hazel', 
    'Gideon', 'Xander', 'Sierra', 'Dustin', 'Kira', 'Nolan', 'Olivia', 'Tristan', 'Veda', 'Wyatt', 'Felix'
  ];

 const EMOJIS = [
    "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾","👋","👍","👎","👊","✌️","👌","🤝","🙏","💪","🔥","✨","💖","❤️","🎉","🎈"
  ];

  const getMyId = useCallback(() => auth.currentUser?.uid || currentUser?.uid || socket.id, [currentUser]);

  const registerPushToken = useCallback((token) => {
    socket.timeout(5000).emit('register_push_token', { token }, (error, result) => {
      if (error || !result?.ok) {
        setNotificationStatus(result?.error || 'Could not register this device with the notification server.');
      } else if (!result.pushEnabled) {
        setNotificationStatus('Permission is enabled, but server push credentials still need setup.');
      } else {
        setNotificationStatus('Notifications are enabled on this device.');
      }
    });
  }, []);

  const enableNotifications = useCallback(async (userInitiated = true) => {
    try {
      const disabledKey = `chat_notifications_disabled_${auth.currentUser?.uid || ''}`;
      if (userInitiated) {
        try { localStorage.removeItem(disabledKey); } catch (storageError) {
          console.warn('Could not update notification preference:', storageError);
        }
      }
      if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
        setNotificationStatus('Browser notifications are not supported here.');
        return;
      }

      const permission = userInitiated && Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') {
        setNotificationsEnabled(false);
        setNotificationStatus('Notifications are blocked in browser settings.');
        return;
      }

      const messaging = await messagingPromise;
      if (!messaging) {
        setNotificationStatus('Push notifications are not supported by this browser.');
        return;
      }

      const serviceWorkerRegistration = await navigator.serviceWorker.register(
        `${process.env.PUBLIC_URL || ''}/firebase-messaging-sw.js`
      );
      const token = await getToken(messaging, {
        vapidKey: 'BDlIEtQFhIRnkhFEQrkyPrZ9lyJT0tSu9PQuSYZhpKU1mff-lYLiYa2clRidpSqU51aqNjK88omNP3z7uW07fXs',
        serviceWorkerRegistration
      });
      if (!token) throw new Error('Firebase did not provide a push token.');

      pushTokenRef.current = token;
      setNotificationsEnabled(true);
      if (!socket.connected) socket.connect();
      if (socketUserReadyRef.current) registerPushToken(token);
      else setNotificationStatus('Connecting to the notification server...');
    } catch (error) {
      console.error('Notification setup failed:', error);
      setNotificationStatus(error.message || 'Could not enable notifications.');
    }
  }, [registerPushToken]);

  const disableNotifications = async () => {
    try {
      localStorage.setItem(`chat_notifications_disabled_${auth.currentUser?.uid || ''}`, 'true');
    } catch (error) {
      console.warn('Could not save notification preference:', error);
    }
    const token = pushTokenRef.current;
    if (token) {
      await new Promise(resolve => {
        socket.timeout(1500).emit('unregister_push_token', { token }, () => resolve());
      });
    }

    try {
      const messaging = await messagingPromise;
      if (messaging) await deleteToken(messaging);
      pushTokenRef.current = null;
      setNotificationsEnabled(false);
      setNotificationStatus('Notifications are disabled on this device.');
    } catch (error) {
      console.error('Could not disable notifications:', error);
      setNotificationStatus('Could not disable notifications.');
    }
  };

  useEffect(() => {
    if (!isLoggedIn || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const disabledKey = `chat_notifications_disabled_${auth.currentUser?.uid || ''}`;
    try {
      if (localStorage.getItem(disabledKey) === 'true') return;
    } catch (error) {
      console.warn('Could not read notification preference:', error);
    }
    enableNotifications(false);
  }, [isLoggedIn, enableNotifications]);

  const setActiveChat = useCallback((chatObj) => {
    setActiveChatState(chatObj);
    if (chatObj) {
      set('chat_active_chat', chatObj).catch(err => console.error("IDB Set Error:", err));
    } else {
      del('chat_active_chat').catch(err => console.error("IDB Del Error:", err));
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('chat_active_tab', activeTab);
    } catch(e) { console.warn(e); }
  }, [activeTab]);

  useEffect(() => {
    let splashTimer;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const savedBio = localStorage.getItem(`chat_bio_${user.uid}`) || "Hey there! I am using Fi-chan Chat.";
          const savedPfp = localStorage.getItem(`chat_pfp_${user.uid}`);

          const finalUser = {
            id: socket.id,
            uid: user.uid, 
            username: user.displayName || username || "User",
            bio: savedBio,
            pfp: savedPfp || user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.displayName || 'Amaya'}`
          };
          
          setCurrentUser(finalUser);
          setIsLoggedIn(true);
          setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            username: finalUser.username,
            bio: savedBio,
            pfp: finalUser.pfp,
            lastSeen: Date.now()
          }, { merge: true }).catch(e => console.error("Firestore sync error:", e));

          setShowWelcomeSplash(true);
          splashTimer = setTimeout(() => {
            setShowWelcomeSplash(false);
          }, 1500);

          get('chat_active_chat').then((savedChat) => {
            if (savedChat) {
              setActiveChatState(savedChat);
              socket.emit('join_chat', savedChat.id);
            }
          }).catch(() => del('chat_active_chat'));
        } else {
          setIsLoggedIn(false);
          setCurrentUser(null);
          del('chat_active_chat');
        }
      } catch (err) {
        console.error("Auth Listener Error:", err);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (splashTimer) clearTimeout(splashTimer);
    };
  }, [username]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const loginSocketUser = () => {
      const firebaseUser = auth.currentUser;
      if (!currentUserRef.current || !firebaseUser) return;
      socketUserReadyRef.current = false;
      firebaseUser.getIdToken().then(idToken => {
        socket.timeout(5000).emit('login_user', { ...currentUserRef.current, idToken }, (error, result) => {
          if (error || !result?.ok) return;
          socketUserReadyRef.current = true;
          if (pushTokenRef.current) registerPushToken(pushTokenRef.current);
        });
      }).catch(error => console.error('Socket authentication failed:', error));
    };
    const handleSocketDisconnect = () => { socketUserReadyRef.current = false; };

    socket.on('connect', loginSocketUser);
    socket.on('disconnect', handleSocketDisconnect);
    if (socket.connected) loginSocketUser();
    return () => {
      socket.off('connect', loginSocketUser);
      socket.off('disconnect', handleSocketDisconnect);
    };
  }, [isLoggedIn, registerPushToken]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    let unsubscribe;

    messagingPromise.then((messaging) => {
      if (!messaging || cancelled) return;
      unsubscribe = onMessage(messaging, (payload) => {
        if (document.visibilityState === 'visible' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const data = payload.data || {};
        navigator.serviceWorker.ready.then((registration) => registration.showNotification(
          data.title || 'New message',
          {
            body: data.body || 'You received a new message.',
            icon: data.icon || '/fi-chan-logo.jpg',
            data: { url: data.url || '/', chatId: data.chatId || '' }
          }
        ));
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      try { localStorage.setItem('chat_theme', 'light'); } catch(e){}
    } else {
      document.body.classList.remove('light-theme');
      try { localStorage.setItem('chat_theme', 'dark'); } catch(e){}
    }
  }, [theme]);

  useEffect(() => {
    if (chatContainerRef.current) {
      const scrollTimer = setTimeout(() => {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }, 50);
      return () => clearTimeout(scrollTimer);
    }
  }, [messages, activeChat]);

  useEffect(() => {
    if (!activeChat) return;
    const currentChatMessages = messages[activeChat.id] || [];
    if (currentChatMessages.length > 0) {
      const lastMessage = currentChatMessages[currentChatMessages.length - 1];
      const seenArray = lastMessage.seenBy || [];
      const myId = getMyId();
      if (lastMessage.senderId !== myId && !seenArray.includes(myId)) {
        socket.emit("messageSeen", {
          chatId: activeChat.id,
          messageId: lastMessage.id,
          userId: myId
        });
      }
    }
  }, [messages, activeChat, getMyId]);

  useEffect(() => {
    const handleUsersUpdate = (data) => {
      setUsersList(data.filter(u => u.uid !== auth.currentUser?.uid));
      const me = data.find(u => u.id === socket.id);
      if (me) setCurrentUser(prev => ({ ...prev, ...me }));
    };

    const handleGroupsUpdate = (data) => setGroupsList(data);

    const handleReceiveMessage = (data) => {
      if (data.message.senderId !== auth.currentUser?.uid &&
          (document.visibilityState !== 'visible' || activeChat?.id !== data.chatId)) {
        const preview = data.message.text || (data.message.fileType ? `Sent ${data.message.fileType}` : 'Sent an attachment');
        setPushNotificationAlert({
          title: data.message.senderName || 'New message',
          message: preview
        });
      }
      setMessages(prev => {
        const currentChatMessages = prev[data.chatId] || [];
        const isDuplicate = currentChatMessages.some(msg => msg.id === data.message.id);
        if (isDuplicate) return prev;
        
        return { 
          ...prev, 
          [data.chatId]: [...currentChatMessages, data.message] 
        };
      });
    };

    const handleMessagesUpdated = (data) => {
      setMessages(prev => ({ ...prev, [data.chatId]: data.messages }));
    };

   // --- Handlers ---
  const handleUserTyping = (data) => {
    setTypingStatus((prev) => ({
      ...prev,
      [data.chatId]: { isTyping: data.isTyping, user: data.username },
    }));
  };

  const handleUserSeenUpdate = ({ chatId, messageId, userId }) => {
    setMessages((prev) => {
      const updated = { ...prev };
      const chatMsgs = updated[chatId] ? [...updated[chatId]] : [];
      const msgIndex = chatMsgs.findIndex((m) => m.id === messageId);
      if (msgIndex !== -1 && !chatMsgs[msgIndex].seenBy.includes(userId)) {
        chatMsgs[msgIndex] = {
          ...chatMsgs[msgIndex],
          seenBy: [...chatMsgs[msgIndex].seenBy, userId],
        };
      }
      updated[chatId] = chatMsgs;
      return updated;
    });
  };

  const handleMessageDeleted = ({ chatId, messageId }) => {
    setMessages((prev) => {
      const chatMsgs = prev[chatId]
        ? prev[chatId].filter((m) => m.id !== messageId)
        : [];
      return { ...prev, [activeChat?.id || chatId]: chatMsgs };
    });
  };

  const handlePushNotification = (notif) => {
    setPushNotificationAlert(notif);
    setTimeout(() => setPushNotificationAlert(null), 4000);
  };

  // 🎮 Game Handlers
  const handleReceiveGameInvite = (data) => {
    setGameInvite(data);
  };

  const handleGameStarted = (data) => {
    setGameInvite(null); // Invitation popup close
    setGameSession(data); // Launch Game Modal
  };

  const handleGameInviteRejected = () => {
    alert("Opponent rejected the game invite! ❌");
  };

  // --- 1. ATTACH ALL SOCKET LISTENERS (ONCE) ---
  socket.on("update_users", handleUsersUpdate);
  socket.on("update_groups", handleGroupsUpdate);
  socket.on("receive_message", handleReceiveMessage);
  socket.on("messages_updated", handleMessagesUpdated);
  socket.on("user_typing", handleUserTyping);
  socket.on("userSeenUpdate", handleUserSeenUpdate);
  socket.on("message_deleted", handleMessageDeleted);
  socket.on("push_notification", handlePushNotification);

  // Game Socket Listeners
  socket.on("receive_game_invite", handleReceiveGameInvite);
  socket.on("game_started", handleGameStarted);
  socket.on("game_invite_rejected", handleGameInviteRejected);

  // --- 2. SINGLE CLEANUP RETURN FUNCTION ---
  return () => {
    socket.off("update_users", handleUsersUpdate);
    socket.off("update_groups", handleGroupsUpdate);
    socket.off("receive_message", handleReceiveMessage);
    socket.off("messages_updated", handleMessagesUpdated);
    socket.off("user_typing", handleUserTyping);
    socket.off("userSeenUpdate", handleUserSeenUpdate);
    socket.off("message_deleted", handleMessageDeleted);
    socket.off("push_notification", handlePushNotification);

    // Game Listeners Cleanup
    socket.off("receive_game_invite", handleReceiveGameInvite);
    socket.off("game_started", handleGameStarted);
    socket.off("game_invite_rejected", handleGameInviteRejected);
  };
}, [activeChat]);

  useEffect(() => {
    if (!activeChat || !auth.currentUser) return;
    const isGlobal = activeChat.id === 'global-group' || activeChat.id === 'global' || activeChat.name === 'Global Group';
    
    if (!isGlobal && activeChat.type === 'private') {
      const q = query(
        collection(db, "private_chats", activeChat.id, "messages"),
        orderBy("timestampRaw", "asc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedMsgs = snapshot.docs.map(doc => doc.data());
        setMessages(prev => {
          const currentList = prev[activeChat.id] || [];
          const msgMap = new Map();
          currentList.forEach(m => msgMap.set(m.id, m));
          fetchedMsgs.forEach(m => msgMap.set(m.id, m));

          const mergedList = Array.from(msgMap.values()).sort((a, b) => (a.timestampRaw || 0) - (b.timestampRaw || 0));
          return { ...prev, [activeChat.id]: mergedList };
        });
      }, (error) => console.error("Firestore Listen Error:", error));

      return () => unsubscribe();
    }
  }, [activeChat]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          sendVoiceMessage(reader.result);
        };
      };

      setRecordingTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      setShowMicErrorModal(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      clearInterval(timerRef.current);
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      clearInterval(timerRef.current);
      mediaRecorder.onstop = null; 
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const formatRecordingTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const sendVoiceMessage = (base64Audio) => {
    if (!activeChat) return;
    const msgId = `msg-${Date.now()}`;
    const currentUserId = getMyId();
    const now = new Date();

    const msgObject = {
      id: msgId,
      senderId: currentUserId,
      senderName: currentUser?.username || "User",
      text: "",
      fileUrl: base64Audio,
      fileType: 'audio',
      timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateFormatted: now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
      timestampRaw: now.getTime(),
      seenBy: [currentUserId],
      pfp: currentUser?.pfp || null,
      reactions: {}
    };

    setMessages(prev => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), msgObject]
    }));

    socket.emit('send_message', {
      chatId: activeChat.id,
      senderId: currentUserId,
      senderName: currentUser?.username || "User",
      pfp: currentUser?.pfp || null,
      text: "",
      fileUrl: base64Audio,
      fileType: 'audio',
      timeFormatted: msgObject.timeFormatted,
      dateFormatted: msgObject.dateFormatted,
      id: msgId
    });

    const isGlobal = activeChat.id === 'global-group' || activeChat.id === 'global' || activeChat.name === 'Global Group';
    if (!isGlobal && activeChat.type === 'private') {
      addDoc(collection(db, "private_chats", activeChat.id, "messages"), msgObject)
        .catch(err => console.error("Firestore Audio Save Error:", err));
    }
  };

  const handleDelete = async (messageId) => {
    if (!activeChat) return;
    const isGlobal = activeChat.id === 'global-group' || activeChat.id === 'global' || activeChat.name === 'Global Group';

    setMessages(prev => {
      const chatMsgs = prev[activeChat.id] ? prev[activeChat.id].filter(m => m.id !== messageId) : [];
      return { ...prev, [activeChat.id]: chatMsgs };
    });

    socket.emit('delete_message', { chatId: activeChat.id, messageId });
    setActiveMenuMsgId(null);

    if (!isGlobal && activeChat.type === 'private') {
      try {
        const q = query(collection(db, "private_chats", activeChat.id, "messages"), where("id", "==", messageId));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach(async (document) => {
          await deleteDoc(doc(db, "private_chats", activeChat.id, "messages", document.id));
        });
      } catch (err) {
        console.error("Firestore Delete Error:", err);
      }
    }
  };

  const selectChat = useCallback((chatObj) => {
    setActiveChat(chatObj);
    socket.emit('join_chat', chatObj.id);
    setReplyToMsg(null);
    setEditMsg(null);
    set('chat_active_chat', chatObj).catch(err => console.error("IDB Set Error:", err));
  }, [setActiveChat]);

  useEffect(() => {
    if (!isLoggedIn || !('serviceWorker' in navigator)) return;

    const openChat = (chatId) => {
      if (!chatId) return;
      const participantIds = chatId.split('--');
      if (participantIds.length === 2) {
        const peerUid = participantIds.find(uid => uid !== auth.currentUser?.uid);
        const peer = allRegisteredUsers.find(user => user.uid === peerUid) ||
          usersList.find(user => user.uid === peerUid);
        selectChat({
          id: chatId,
          name: peer?.username || 'Direct chat',
          type: 'private',
          userObj: peer || { uid: peerUid }
        });
        return;
      }

      const group = groupsList.find(item => item.id === chatId);
      if (group) selectChat({ id: group.id, name: group.name, type: 'group' });
    };

    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === 'OPEN_CHAT') openChat(event.data.chatId);
    };
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    const params = new URLSearchParams(window.location.search);
    const chatId = params.get('chatId');
    if (chatId) {
      openChat(chatId);
      params.delete('chatId');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }

    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
  }, [isLoggedIn, allRegisteredUsers, usersList, groupsList, selectChat]);

  const handleReaction = (messageId, emoji) => {
    if (!activeChat) return;
    const myId = getMyId();

    socket.emit('react_message', {
      chatId: activeChat.id,
      messageId,
      userId: myId,
      emoji
    });

    setActiveMenuMsgId(null);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activeChat) return;

    if (editMsg) {
      socket.emit('edit_message', {
        chatId: activeChat.id,
        messageId: editMsg.id,
        newText: typedMessage
      });
      setEditMsg(null);
      setTypedMessage('');
      return;
    }

    const msgId = `msg-${Date.now()}`;
    const currentUserId = getMyId();
    const now = new Date();

    const msgObject = {
      id: msgId,
      senderId: currentUserId, 
      senderName: currentUser?.username || "User",
      text: typedMessage,
      timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateFormatted: now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
      timestampRaw: now.getTime(), 
      seenBy: [currentUserId],
      pfp: currentUser?.pfp || null,
      replyTo: replyToMsg ? { id: replyToMsg.id, senderName: replyToMsg.senderName, text: replyToMsg.text || "📷 Attachment" } : null,
      reactions: {}
    };

    const textToSend = typedMessage;
    setTypedMessage('');
    setReplyToMsg(null);
    setShowEmojiPicker(false);

    setMessages(prev => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), msgObject]
    }));

    socket.emit('send_message', {
      chatId: activeChat.id,
      senderId: currentUserId,
      senderName: currentUser?.username || "User",
      pfp: currentUser?.pfp || null,
      text: textToSend,
      timeFormatted: msgObject.timeFormatted,
      dateFormatted: msgObject.dateFormatted,
      id: msgId,
      replyTo: msgObject.replyTo
    });
    
    socket.emit('typing', { chatId: activeChat.id, username: currentUser?.username || 'User', isTyping: false });

    const isGlobal = activeChat.id === 'global-group' || activeChat.id === 'global' || activeChat.name === 'Global Group';
    if (!isGlobal && activeChat.type === 'private') {
      addDoc(collection(db, "private_chats", activeChat.id, "messages"), msgObject)
        .catch(error => console.error("Firestore Save Error:", error));
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    const chat = activeChat;
    e.target.value = '';
    if (!files.length || !chat) return;

    const oversizedFile = files.find(file => file.size > 15 * 1024 * 1024);
    if (oversizedFile) {
      alert(`${oversizedFile.name} is over the 15 MB file limit.`);
      return;
    }

    const currentUserId = getMyId();
    const reply = replyToMsg;
    const isGlobal = chat.id === 'global-group' || chat.id === 'global' || chat.name === 'Global Group';
    for (const file of files) {
      try {
        const uploadedUrl = await uploadToCloudinary(file);
        const fileType = file.type.startsWith('image/') ? 'image'
          : file.type.startsWith('video/') ? 'video'
            : file.type.startsWith('audio/') ? 'audio' : 'file';
        const now = new Date();
        const msgObject = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          senderId: currentUserId,
          senderName: currentUser?.username || 'User',
          text: '',
          fileUrl: uploadedUrl,
          fileType,
          fileName: file.webkitRelativePath || file.name,
          fileSize: file.size,
          timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dateFormatted: now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
          timestampRaw: now.getTime(),
          seenBy: [currentUserId],
          replyTo: reply ? { id: reply.id, senderName: reply.senderName, text: reply.text || 'Attachment' } : null,
          reactions: {}
        };

        setMessages(prev => ({ ...prev, [chat.id]: [...(prev[chat.id] || []), msgObject] }));
        socket.emit('send_message', {
          chatId: chat.id,
          senderId: currentUserId,
          senderName: currentUser?.username || 'User',
          pfp: currentUser?.pfp || null,
          text: '',
          fileUrl: uploadedUrl,
          fileType,
          fileName: file.webkitRelativePath || file.name,
          fileSize: file.size,
          id: msgObject.id,
          replyTo: msgObject.replyTo
        });

        if (!isGlobal && chat.type === 'private') {
          await addDoc(collection(db, 'private_chats', chat.id, 'messages'), msgObject);
        }
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        alert(`Could not upload ${file.name}: ${error.message}`);
        break;
      }
    }
    setReplyToMsg(null);
  };

  const handleProfilePhotoUpload = async (event, setPhoto) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Profile photos must be smaller than 10 MB.');
      return;
    }

    try {
      setPhoto(await uploadToCloudinary(file));
    } catch (error) {
      console.error('Profile photo upload failed:', error);
      alert(`Could not upload profile photo: ${error.message}`);
    }
  };

// 🎮 Game Invite Send Handler
  const handleStartGameClick = () => {
    if (!activeChat) return;

    // Direct User ko target karne ke liye UID ya ActiveChat ID ka use
    const targetUserId = activeChat.userObj?.id || activeChat.id;

    socket.emit('send_game_invite', {
      toUserId: targetUserId,
      senderName: currentUser?.username || 'Friend',
      chatId: activeChat.id
    });

    alert("Game Invite sent to opponent! 🎮");
  };

  // 🎮 Accept Invite
  const handleAcceptInvite = () => {
    if (!gameInvite) return;
    socket.emit('accept_game_invite', {
      chatId: gameInvite.chatId,
      fromUserId: gameInvite.fromUserId
    });
  };

  // 🎮 Decline Invite
  const handleRejectInvite = () => {
    if (!gameInvite) return;
    socket.emit('reject_game_invite', { fromUserId: gameInvite.fromUserId });
    setGameInvite(null);
  };

  const handleTypingInput = (e) => {
    setTypedMessage(e.target.value);
    const isTyping = e.target.value.length > 0;
    if (activeChat) {
      socket.emit('typing', { chatId: activeChat.id, username: currentUser?.username || 'User', isTyping });
    }
  };

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    socket.emit('create_group', { name: newGroupName, description: "Public Session Room" });
    setNewGroupName('');
    setShowNewGroupModal(false);
  };

  const saveProfileEdit = async () => {
    if (!editUsername.trim()) return alert("Username khali nahi chodh sakte!");
    try {
      const finalPfp = await ensureHostedImage(editPfp || currentUser.pfp);
      
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: editUsername.trim(),
          photoURL: finalPfp
        });
        
        try {
          localStorage.setItem(`chat_bio_${auth.currentUser.uid}`, editBio.trim());
          localStorage.setItem(`chat_pfp_${auth.currentUser.uid}`, finalPfp);
        } catch (storageErr) {
          console.warn("LocalStorage Quota Exceeded during edit! Handled safely.", storageErr);
        }

        await setDoc(doc(db, "users", auth.currentUser.uid), {
          uid: auth.currentUser.uid,
          username: editUsername.trim(),
          bio: editBio.trim(),
          pfp: finalPfp,
          lastSeen: Date.now()
        }, { merge: true });
      }
      
      const updatedUser = { 
        ...currentUser, 
        username: editUsername.trim(), 
        bio: editBio.trim(), 
        pfp: finalPfp 
      };
      
      setCurrentUser(updatedUser);
      socket.emit('update_profile', updatedUser);
      setIsEditingProfile(false);
      alert("Profile updated permanently! ✨");
    } catch (error) {
      console.error("Update Error:", error.message);
      alert(`Update Fail: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try { localStorage.removeItem('chat_active_chat'); } catch(e){}
    if (pushTokenRef.current) {
      await new Promise(resolve => {
        socket.timeout(1500).emit('unregister_push_token', { token: pushTokenRef.current }, () => resolve());
      });
      const messaging = await messagingPromise;
      if (messaging) await deleteToken(messaging).catch(() => {});
      pushTokenRef.current = null;
    }
    await signOut(auth);
    window.location.reload();
  };

  const toggleScroll = () => {
    if (chatContainerRef.current) {
      if (scrollDirectionUp) {
        chatContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
      }
      setScrollDirectionUp(!scrollDirectionUp);
    }
  };

  const executeCopy = (text) => {
    navigator.clipboard.writeText(text);
    setActiveMenuMsgId(null);
  };

  const handleAuthAction = async () => {
    if (!email.trim() || !password.trim()) return alert("Email aur Password daalna zaroori hai!");

    if (isSignUp) {
      if (!username.trim()) return alert("Username toh chun lo bhai!");
      try {
        const fallbackAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`;
        const photoToSave = await ensureHostedImage(customPfp || fallbackAvatar);

        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
        const user = userCredential.user;

        await updateProfile(user, { 
          displayName: username.trim(), 
          photoURL: photoToSave
        });

        const userBio = editBio.trim() || "Hey there! I am using Fi-chan Chat.";
        
        try {
          localStorage.setItem(`chat_bio_${user.uid}`, userBio);
          localStorage.setItem(`chat_pfp_${user.uid}`, photoToSave);
        } catch (storageErr) {
          console.warn("LocalStorage Quota Exceeded during signup! Handled safely.", storageErr);
        }

        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          username: username.trim(),
          bio: userBio,
          pfp: photoToSave,
          lastSeen: Date.now()
        }, { merge: true });

        const finalUser = {
          id: socket.id,
          uid: user.uid,
          username: username.trim(),
          bio: userBio,
          pfp: photoToSave
        };

        setCurrentUser(finalUser);
        setIsLoggedIn(true);
      } catch (error) {
        alert(`Signup Fail: ${error.message}`);
      }
    } else {
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      } catch (error) {
        alert(`Login Fail: ${error.message}`);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <h4>Loading Fi-chan chat... 🚀</h4>
        </div>
      </div>
    );
  }
  
  if (isLoggedIn && showWelcomeSplash) {
    return (
      <div className="welcome-splash-overlay">
        <div className="welcome-splash-card animate-pop-in">
          <img src={currentUser?.pfp} alt="User Avatar" className="splash-avatar" onError={(e) => { e.target.src = 'https://api.dicebear.com/7.x/adventurer/svg?seed=Amaya'; }} />
          <h2>Welcome back, <span className="splash-username">@{currentUser?.username}</span>! ✨</h2>
          <p>Setting up your private workspace...</p>
          <div className="splash-loader-bar">
            <div className="splash-loader-progress"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    const previewAvatar = customPfp || `https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`;
    return (
      <div className="login-container premium-backdrop">
        <div className="glow-sphere sphere-1"></div>
        <div className="glow-sphere sphere-2"></div>

        <div className="login-card glass-card animate-pop-in">
          <div className="login-header">
            <div className="login-logo-wrapper">
              <img src={appLogo} className="app-main-logo premium-logo-glow" alt="Fi-chan Logo" />
              <h1 className="brand-title">Fi-chan <span className="brand-highlight">Chat</span></h1>
            </div>
            <p className="login-subtitle">
              {isSignUp ? "Join the next-gen messaging experience ✨" : "Welcome back! Access your workspace 🚀"}
            </p>
          </div>

          {isSignUp && (
            <div className="signup-extended-section animate-fade-in">
              <div className="login-avatar-preview-box premium-avatar-wrapper">
                <img src={previewAvatar} alt="Profile Preview" className="login-live-avatar" />
                <span className={`avatar-badge ${customPfp ? 'custom-photo-badge' : 'avatar-sparkle-badge'}`}>
                  {customPfp ? '📸 Custom Photo' : '✨ Avatar Active'}
                </span>
              </div>
              
              <div className="avatar-control-buttons">
                <button type="button" className="ctrl-btn shuffle-btn glass-btn" onClick={() => setShowAvatarModal(true)}>
                  🎭 Choose Avatar
                </button>
                <label className="ctrl-btn upload-btn glass-btn">
                  📁 Upload Photo
                  <input type="file" accept="image/*" onChange={async (e) => {
                    await handleProfilePhotoUpload(e, setCustomPfp);
                  }} style={{ display: 'none' }} />
                </label>
              </div>

              <div className="login-form-group">
                <label className="input-label">Username</label>
                <input 
                  type="text" 
                  className="premium-input"
                  placeholder="e.g. alex_fi" 
                  value={username} 
                  autoComplete="off"
                  onChange={(e) => setUsername(e.target.value)} 
                  maxLength={50} 
                />
              </div>

              <div className="login-form-group">
                <label className="input-label">Bio / Status</label>
                <textarea 
                  className="premium-input textarea-input"
                  placeholder="Write a cool bio... ✍️" 
                  value={editBio} 
                  autoComplete="off"
                  onChange={(e) => setEditBio(e.target.value)} 
                  maxLength={100} 
                  rows={2} 
                />
              </div>
            </div>
          )}

          <div className="login-form-group">
            <label className="input-label">Email Address</label>
            <input 
              type="email" 
              className="premium-input"
              placeholder="name@gmail.com" 
              value={email} 
              autoComplete="off"
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <div className="login-form-group">
            <label className="input-label">Password</label>
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                className="premium-input password-field"
                placeholder="••••••••••••" 
                value={password} 
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)} 
              />
              <button 
                type="button" 
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? "👁️" : "🙈"}
              </button>
            </div>
          </div>

          <button className="login-submit-btn premium-btn-gradient" onClick={handleAuthAction}>
            {isSignUp ? "Create Account ✨" : "Sign In Securely →"}
          </button>

          <div className="auth-toggle-footer">
            <p onClick={() => { setIsSignUp(!isSignUp); setEmail(''); setPassword(''); setUsername(''); }}>
              {isSignUp ? (
                <>Already have an account? <span className="link-highlight">Log In</span></>
              ) : (
                <>New to Fi-chan Chat? <span className="link-highlight">Create an account</span></>
              )}
            </p>
          </div>
        </div>

        {showAvatarModal && (
          <div className="avatar-modal-overlay glass-overlay" onClick={() => setShowAvatarModal(false)}>
            <div className="avatar-modal-content glass-card animate-pop-in" onClick={(e) => e.stopPropagation()}>
              <h3>Pick Your Style</h3>
              <p className="modal-sub">Select from curated 3D avatar seeds</p>
              <div className="avatar-grid custom-scrollbar">
                {AVAILABLE_SEEDS.map((seed) => (
                  <div 
                    key={seed} 
                    className={`avatar-grid-item ${avatarSeed === seed && !customPfp ? 'active-seed' : ''}`} 
                    onClick={() => { setAvatarSeed(seed); setCustomPfp(null); setShowAvatarModal(false); }}
                  >
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`} alt={seed} />
                  </div>
                ))}
              </div>
              <button type="button" className="modal-close-btn glass-btn" onClick={() => setShowAvatarModal(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentTyping = activeChat ? typingStatus[activeChat.id] : null;

  return (
    <div className="app-layout" onClick={() => setActiveMenuMsgId(null)}>
      {pushNotificationAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#1e1e24',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '12px',
          border: '1px solid #3797f0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'popIn 0.3s ease'
        }}>
          <span style={{ fontSize: '20px' }}>🔔</span>
          <div>
            <h4 style={{ fontSize: '13px', margin: 0, color: '#3797f0' }}>{pushNotificationAlert.title}</h4>
            <p style={{ fontSize: '12px', margin: '2px 0 0 0', color: '#9ca3af' }}>{pushNotificationAlert.message}</p>
          </div>
        </div>
      )}

      <aside className={`sidebar ${activeChat ? 'hide-mobile' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <h2>Fi-chan Chat</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="theme-toggle-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>
              <button
                className="theme-toggle-btn"
                onClick={notificationsEnabled ? disableNotifications : () => enableNotifications(true)}
                title={notificationsEnabled ? 'Disable browser notifications' : 'Enable browser notifications'}
              >
                {notificationsEnabled ? '🔔 On' : '🔕 Enable'}
              </button>
            </div>
          </div>
          <div className="user-badge">
            <img src={currentUser?.pfp} alt="me" onError={(e) => { e.target.src = 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback'; }} />
            <span>@{currentUser?.username}</span>
          </div>
          {notificationStatus && <p role="status" style={{ margin: '8px 0 0', fontSize: '12px' }}>{notificationStatus}</p>}
        </div>

        <div className="tab-menu">
          <button className={activeTab === 'rooms' ? 'active' : ''} onClick={() => setActiveTab('rooms')}>👤 Rooms ({groupsList.length + 1})</button>
          <button className={activeTab === 'friends' ? 'active' : ''} onClick={() => setActiveTab('friends')}>👥 Friends ({allRegisteredUsers.length || usersList.length})</button>
          <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => {
            setActiveTab('profile');
            setEditUsername(currentUser?.username || '');
            setEditBio(currentUser?.bio || '');
            setEditPfp(currentUser?.pfp || '');
          }}>⚙️ Profile</button>
        </div>

        <div className="tab-content">
          {activeTab === 'rooms' && (
            <div className="list-container animate-fade">
              <button className="create-group-trigger" onClick={() => setShowNewGroupModal(true)}>+ Create New Group</button>
              
              <div 
                className={`chat-item-row ${activeChat?.id === 'global-group' ? 'selected' : ''}`} 
                onClick={() => selectChat({ id: 'global-group', name: 'Global Group', type: 'group' })}
              >
                <div className="avatar-icon bg-gradient">🌐</div>
                <div className="item-details">
                  <h4>Global Chat</h4>
                  <p>Active Session Public Stream</p>
                </div>
              </div>

              {groupsList.filter(g => g.id !== 'global-group').map(group => (
                <div key={group.id} className={`chat-item-row ${activeChat?.id === group.id ? 'selected' : ''}`} onClick={() => selectChat({ id: group.id, name: group.name, type: 'group' })}>
                  <div className="avatar-icon bg-gradient">💬</div>
                  <div className="item-details"><h4>{group.name}</h4><p>{group.description}</p></div>
                </div>
              ))}

              <div 
                className="gift-trigger-card" 
                onClick={() => setShowGiftsSection(true)}
              >
                <div className="gift-badge-icon">🎁</div>
                <div className="gift-card-details">
                  <h4>Gifts Section <span className="sparkle-tag">✨ New</span></h4>
                  <p>Send something special...</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="list-container animate-fade">
              {(allRegisteredUsers.length > 0 ? allRegisteredUsers : usersList).length === 0 ? (
                <p className="empty-msg">No other users online or registered yet.</p>
              ) : (
                (allRegisteredUsers.length > 0 ? allRegisteredUsers : usersList).map(user => {
                  const isOnline = usersList.some(u => u.uid === user.uid || u.id === user.id);

                  return (
                    <div 
                      key={user.uid || user.id} 
                      className="chat-item-row" 
                      onClick={() => setShowProfileModal(user)}
                    >
                      <img className="avatar-icon" src={user.pfp} alt="" onError={(e) => { e.target.src = 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback'; }} />
                      <div className="item-details">
                        <h4>{user.username}</h4>
                        <p className={isOnline ? "online-tag" : "offline-tag"}>
                          {isOnline ? "● Online" : "○ Offline"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'profile' && currentUser && (
            <div className="profile-section animate-fade">
              {isEditingProfile ? (
                <div className="edit-form">
                  <div className="login-avatar-preview-box premium-avatar-wrapper" style={{ margin: '0 auto 12px auto' }}>
                    <img src={editPfp || currentUser.pfp} alt="Profile Preview" className="login-live-avatar" onError={(e) => { e.target.src = 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback'; }} />
                  </div>

                  <div className="avatar-control-buttons" style={{ marginBottom: '12px' }}>
                    <button type="button" className="ctrl-btn shuffle-btn glass-btn" onClick={() => setShowAvatarModal(true)}>
                      🎭 Choose Avatar
                    </button>
                    <label className="ctrl-btn upload-btn glass-btn">
                      📁 Upload Photo
                      <input type="file" accept="image/*" onChange={async (e) => {
                        await handleProfilePhotoUpload(e, setEditPfp);
                      }} style={{ display: 'none' }} />
                    </label>
                  </div>

                  <div className="login-form-group" style={{ marginBottom: '10px', textAlign: 'left' }}>
                    <label className="input-label">Username</label>
                    <input 
                      type="text" 
                      className="premium-input" 
                      value={editUsername} 
                      onChange={e => setEditUsername(e.target.value)} 
                      placeholder="Username" 
                      maxLength={50} 
                    />
                  </div>

                  <div className="login-form-group" style={{ marginBottom: '15px', textAlign: 'left' }}>
                    <label className="input-label">Bio / Status</label>
                    <textarea 
                      className="premium-input textarea-input" 
                      value={editBio} 
                      onChange={e => setEditBio(e.target.value)} 
                      placeholder="Write a cool bio..." 
                      maxLength={100} 
                      rows={2} 
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="done-btn premium-btn-gradient" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }} onClick={saveProfileEdit}>
                      Save Changes ✨
                    </button>
                    <button className="glass-btn" style={{ padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setIsEditingProfile(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="profile-view">
                  <img src={currentUser.pfp} alt="profile" className="large-pfp" onError={(e) => { e.target.src = 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback'; }} />
                  <h3>{currentUser.username}</h3>
                  <p className="bio-text">"{currentUser.bio}"</p>
                  <button className="edit-profile-btn" onClick={() => {
                    setIsEditingProfile(true);
                    setEditUsername(currentUser.username);
                    setEditBio(currentUser.bio);
                    setEditPfp(currentUser.pfp);
                  }}>Edit Profile</button>
                  <button className="logout-btn" onClick={handleLogout}>Log Out</button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className={`chat-stream ${!activeChat ? 'hide-mobile' : ''}`}>
        {activeChat ? (
          <>
            <div className="chat-header">
              <button className="back-btn-mobile" onClick={() => setActiveChat(null)}>←</button>
              <img className="header-avatar" src={activeChat.type === 'group' ? 'https://api.dicebear.com/7.x/identicon/svg?seed=global' : (activeChat.userObj?.pfp || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeChat.name}`)} alt="chat-pfp" onError={(e) => { e.target.src = 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback'; }} />
              <div className="header-details">
                <h3>{activeChat.name}</h3>
                <p className="sub-header-info">{activeChat.type === 'group' ? 'Public Room Channel' : '● Active'}</p>
              </div>
            </div>

            <div className="chat-messages-box" ref={chatContainerRef}>
              {((messages[activeChat.id] || []).map((msg, index) => {
                const isMe = msg.senderId === getMyId();
                const totalSeen = msg.seenBy?.length > 1; 
                const isLatestMessage = index === (messages[activeChat.id] || []).length - 1; 

                const displayTime = msg.timeFormatted || (msg.timestamp ? msg.timestamp : new Date(msg.timestampRaw || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                const displayDate = msg.dateFormatted || new Date(msg.timestampRaw || Date.now()).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });

                return (
                  <div key={msg.id || index} className={`message-row ${isMe ? 'outgoing' : 'incoming'}`}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      {!isMe && (
                        <img 
                          src={msg.pfp || `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.senderId}`} 
                          alt="user-pfp" 
                          className="message-avatar" 
                          onError={(e) => { e.target.src = 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback'; }} 
                        />
                      )}
                      <div className="msg-content-wrapper" style={{ position: 'relative' }}>
                        {msg.replyTo && (
                          <div className="reply-preview-in-bubble">
                            <span className="reply-owner">Reply to {msg.replyTo.senderName}</span>
                            <p className="reply-body-text">{msg.replyTo.text}</p>
                          </div>
                        )}

                        <div 
                          className="message-text" 
                          style={{ background: isMe ? 'var(--bubble-outgoing)' : 'var(--bubble-incoming)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id);
                          }}
                        >
                          {msg.image && <img src={msg.image} alt="Sent attachment" className="chat-shared-image" />}
                          {msg.fileUrl && msg.fileType === 'image' && <img src={msg.fileUrl} alt="Sent attachment" className="chat-shared-image" />}
                          {msg.fileUrl && msg.fileType === 'video' && <video src={msg.fileUrl} controls className="chat-shared-video" />}
                          {msg.fileUrl && msg.fileType === 'audio' && <audio src={msg.fileUrl} controls className="chat-shared-audio" />}
                          {msg.fileUrl && msg.fileType === 'file' && (
                            <a href={msg.fileUrl} target="_blank" rel="noreferrer" download={msg.fileName || true}>
                              📎 {msg.fileName || 'Download file'}
                            </a>
                          )}
                          {msg.text && <p style={{ margin: 0, wordBreak: 'break-word' }}>{msg.text}</p>}
                          
                          <div className="msg-time-date-container">
                            <span className="msg-date-tag">{displayDate}</span>
                            <span className="msg-time-tag">{displayTime}</span>
                          </div>

                          {msg.isEdited && <span className="edited-marker">(edited)</span>}
                        </div>
                        
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`message-reaction-badge ${isMe ? 'react-outgoing' : 'react-incoming'}`}>
                            {Array.from(new Set(Object.values(msg.reactions))).join('')}
                            {Object.keys(msg.reactions).length > 1 && (
                              <span className="react-count">{Object.keys(msg.reactions).length}</span>
                            )}
                          </div>
                        )}

                        {activeMenuMsgId === msg.id && (
                          <div className={`insta-context-menu ${isMe ? 'align-right' : 'align-left'}`} onClick={(e) => e.stopPropagation()}>
                            <div className="quick-emojis-row">
                              {['❤️', '👍', '😂', '😮', '🔥'].map(emoji => (
                                <span key={emoji} className="emoji-item" onClick={() => handleReaction(msg.id, emoji)}>{emoji}</span>
                              ))}
                            </div>
                            <div className="menu-actions-list">
                              <button onClick={() => { setReplyToMsg(msg); setEditMsg(null); setActiveMenuMsgId(null); }}>↩️ Reply</button>
                              {msg.text && <button onClick={() => executeCopy(msg.text)}>📋 Copy</button>}
                              {isMe && msg.text && <button onClick={() => { setEditMsg(msg); setReplyToMsg(null); setTypedMessage(msg.text); setActiveMenuMsgId(null); }}>✏️ Edit Message</button>}
                              {isMe && <button className="delete-menu-btn" onClick={() => handleDelete(msg.id)}>🗑️ Delete</button>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {isMe && isLatestMessage && (
                      <span className="seen-status" style={{ color: totalSeen ? '#0095f6' : '#a3a3a3' }}>
                        {totalSeen ? '✓ Seen' : '✓ Sent'}
                      </span>
                    )}
                  </div>
                );
              }))}

              {currentTyping && currentTyping.isTyping && (
                <div className="typing-indicator-bubble">
                  <span>{currentTyping.user} typing</span>
                  <div className="dots-container"><span className="dot"></span><span className="dot"></span><span className="dot"></span></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <button className="smart-scroll-toggle-btn" onClick={toggleScroll}>{scrollDirectionUp ? '↑' : '↓'}</button>

            <div className="chat-footer-wrapper">
              {replyToMsg && (
                <div className="faded-action-preview-bar">
                  <div className="preview-content">
                    <span>Replying to <b>@{replyToMsg.senderName}</b></span>
                    <p>{replyToMsg.text || "📷 Attachment"}</p>
                  </div>
                  <button className="close-preview-btn" onClick={() => setReplyToMsg(null)}>✕</button>
                </div>
              )}

              {editMsg && (
                <div className="faded-action-preview-bar edit-mode-strip">
                  <div className="preview-content">
                    <span>Editing Message Mode</span>
                    <p>{editMsg.text}</p>
                  </div>
                  <button className="close-preview-btn" onClick={() => { setEditMsg(null); setTypedMessage(''); }}>✕</button>
                </div>
              )}

              {showEmojiPicker && (
                <div className="emoji-picker-panel animate-fade">
                  <div className="emoji-picker-header">
                    <span>Select Emoji ✨</span>
                    <button className="emoji-picker-close" onClick={() => setShowEmojiPicker(false)}>✕</button>
                  </div>
                  <div className="emoji-grid">
                    {EMOJIS.map(emoji => (
                      <span 
                        key={emoji} 
                        className="emoji-picker-item" 
                        onClick={() => setTypedMessage(prev => prev + emoji)}
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {isRecording ? (
                <div className="voice-recording-panel animate-fade">
                  <div className="voice-visualizer">
                    <span className="recording-dot"></span>
                    <div className="bouncing-bars">
                      <span className="bar"></span>
                      <span className="bar"></span>
                      <span className="bar"></span>
                      <span className="bar"></span>
                      <span className="bar"></span>
                      <span className="bar"></span>
                    </div>
                    <span className="recording-timer">{formatRecordingTime(recordingTime)}</span>
                  </div>
                  <div className="voice-controls">
                    <button type="button" className="voice-cancel-btn" onClick={cancelRecording}>
                      🗑️ Cancel
                    </button>
                    <button type="button" className="voice-send-btn" onClick={stopRecording}>
                      🚀 Send Voice
                    </button>
                  </div>
                </div>
              ) : (
                <form className="chat-input-bar" onSubmit={sendMessage}>
                  {/* Emoji Button */}
                  <span 
                    className="chat-action-btn" 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    😊
                  </span>
                  
                  {/* File Button */}
                  <label htmlFor="image-input" className="chat-action-btn">📁</label>
                  <input 
                    type="file" 
                    accept="*/*"
                    multiple
                    onChange={handleFileUpload} 
                    style={{ display: 'none' }} 
                    id="image-input" 
                  />
                  <label htmlFor="folder-input" className="chat-action-btn" title="Send a folder">🗂️</label>
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="folder-input"
                  />

                  {/* Game Button Updated */}
                    <button 
                      type="button" 
                      className="chat-action-btn" 
                      onClick={handleStartGameClick} 
                      title="Play Game"
                    >
                      🎮
                    </button>

                  {/* Voice Mic Button */}
                  <button 
                    type="button" 
                    className="chat-action-btn" 
                    onClick={startRecording}
                    title="Record Voice Message"
                  >
                    🎙️
                  </button>

                  {/* Message Input */}
                  <input 
                    type="text" 
                    placeholder={editMsg ? "Edit message..." : "Write message..."} 
                    value={typedMessage} 
                    onChange={handleTypingInput} 
                  />
                  
                  {/* Send Button */}
                  <button type="submit" className="send-rocket-btn">
                    {editMsg ? "✅" : "🚀"}
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="empty-chat-state">
            <h3>Welcome to Fi-chan Chat Rooms</h3>
            <p>Select an ongoing stream thread or chat room to start talking live.</p>
          </div>
        )}
      </main>

      {showGiftsSection && (
        <Gifts 
          socket={socket}
          currentUserId={getMyId()}
          onClose={() => setShowGiftsSection(false)} 
          onClaimReward={() => setShowGiftsSection(false)}
        />
      )}

      {showMicErrorModal && (
        <div className="modal-overlay">
          <div className="custom-popup-card mic-error-card animate-fade">
            <div className="mic-alert-icon">🎙️⚠️</div>
            <h3>Microphone Access Required</h3>
            <p className="modal-bio">
              Voice messaging setup failed! Please allow microphone access in your browser site permissions settings.
            </p>
            <div className="modal-actions-row">
              <button className="popup-close-btn" onClick={() => setShowMicErrorModal(false)}>Got It</button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="modal-overlay">
          <div className="custom-popup-card">
            <img src={showProfileModal.pfp} alt="" className="modal-pfp" onError={(e) => { e.target.src = 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback'; }}/>
            <h3>{showProfileModal.username}</h3>
            <p className="modal-bio">"{showProfileModal.bio}"</p>
            <div className="modal-actions-row">
              <button className="popup-msg-btn" onClick={() => {
                const myUid = auth.currentUser?.uid || currentUser?.uid;
                const targetUid = showProfileModal.uid;
                if (!myUid || !targetUid) return alert("User sync issue, please refresh!");

                const generatedPrivateId = [myUid, targetUid].sort().join('--');
                selectChat({ id: generatedPrivateId, name: showProfileModal.username, type: 'private', userObj: showProfileModal });
                setShowProfileModal(null);
              }}>Message Direct</button>
              <button className="popup-close-btn" onClick={() => setShowProfileModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showNewGroupModal && (
        <div className="modal-overlay">
          <div className="custom-popup-card">
            <h3>Launch New Stream Room</h3>
            <input type="text" placeholder="Group Name..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
            <div className="modal-actions-row">
              <button className="popup-msg-btn" onClick={handleCreateGroup}>Create</button>
              <button className="popup-close-btn" onClick={() => setShowNewGroupModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
{/* 📩 GAME INVITE POPUP NOTIFICATION */}
{gameInvite && (
  <div className="modal-overlay">
    <div className="custom-popup-card animate-pop-in" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎮</div>
      <h3>Game Challenge!</h3>
      <p className="modal-bio">
        <strong>@{gameInvite.senderName}</strong> wants to play Tic-Tac-Toe with you!
      </p>
      <div className="modal-actions-row">
        <button className="popup-msg-btn" onClick={handleAcceptInvite}>
          Accept ⚔️
        </button>
        <button className="popup-close-btn" onClick={handleRejectInvite}>
          Decline ✖
        </button>
      </div>
    </div>
  </div>
)}

{/* 🎮 ACTIVE MULTIPLAYER GAME MODAL */}
{gameSession && (
  <GameModal
    socket={socket}
    gameSession={gameSession}
    currentUser={currentUser}
    onClose={() => setGameSession(null)}
  />
)}

      {showAvatarModal && (
        <div className="avatar-modal-overlay glass-overlay" onClick={() => setShowAvatarModal(false)}>
          <div className="avatar-modal-content glass-card animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <h3>Pick Your Style</h3>
            <p className="modal-sub">Select from curated 3D avatar seeds</p>
            <div className="avatar-grid custom-scrollbar">
              {AVAILABLE_SEEDS.map((seed) => (
                <div 
                  key={seed} 
                  className={`avatar-grid-item ${avatarSeed === seed ? 'active-seed' : ''}`} 
                  onClick={() => { 
                    setAvatarSeed(seed); 
                    const selectedAvatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
                    if (isEditingProfile) {
                      setEditPfp(selectedAvatarUrl);
                    }
                    setShowAvatarModal(false); 
                  }}
                >
                  <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`} alt={seed} />
                </div>
              ))}
            </div>
            <button type="button" className="modal-close-btn glass-btn" onClick={() => setShowAvatarModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;