import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import './App.css';
import appLogo from './fi chat.jpg'; 
import Gifts from './Gifts'; 
import { getToken, isSupported } from "firebase/messaging";

import { messaging } from "./firebase"; // Yeh wahi file hai jisme aapne messaging export kiya hai
// 🔥 FIREBASE IMPORTS
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
  doc 
} from 'firebase/firestore';


// Singleton Socket connection
const socket = io('http://192.168.18.203:5000', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  autoConnect: true
});

// 🔥 Notification Permission Function


async function requestNotificationPermission() {
  try {
    // 🔥 Pehle check karein ki browser messaging support karta hai ya nahi
    const supported = await isSupported();
    if (!supported) {
      console.log("This browser does not support Firebase Cloud Messaging (HTTP connection).");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      
      const currentToken = await getToken(messaging, { 
        vapidKey: 'BDlIEtQFhIRnkhFEQrkyPrZ9lyJT0tSu9PQuSYZhpKU1mff-lYLiYa2clRidpSqU51aqNjK88omNP3z7uW07fXs' 
      });

      if (currentToken) {
        console.log('FCM Token:', currentToken);
      } else {
        console.log('No registration token available.');
      }
    } else {
      console.log('Unable to get permission to notify.');
    }
  } catch (error) {
    console.log('An error occurred while retrieving token. ', error);
  }
}

function App() {
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [showGiftsSection, setShowGiftsSection] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Real-time Push Notification State for Mobile/Desktop alerts
  const [pushNotificationAlert, setPushNotificationAlert] = useState(null);
  
  // Reload state persistence
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
  
  const [activeChat, setActiveChatState] = useState(() => {
    try {
      const savedChat = localStorage.getItem('chat_active_chat');
      return savedChat ? JSON.parse(savedChat) : null;
    } catch (e) {
      return null;
    }
  }); 

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
  
  // Voice Recorder States
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showMicErrorModal, setShowMicErrorModal] = useState(false); 
  const timerRef = useRef(null);

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

  const setActiveChat = useCallback((chatObj) => {
    setActiveChatState(chatObj);
    if (chatObj) {
      localStorage.setItem('chat_active_chat', JSON.stringify(chatObj));
    } else {
      localStorage.removeItem('chat_active_chat');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('chat_active_tab', activeTab);
  }, [activeTab]);

  // 🔥 AUTH STATE LISTENER
  useEffect(() => {
    let splashTimer;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const savedBio = localStorage.getItem(`chat_bio_${user.uid}`) || "Hey there! I am using Fi-chen Chat.";
        const finalUser = {
          id: socket.id,
          uid: user.uid, 
          username: user.displayName || "User",
          bio: savedBio,
          pfp: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=Amaya`
        };
        setCurrentUser(finalUser);
        setIsLoggedIn(true);
        socket.emit('login_user', finalUser);

        // 🚀 Yahin par notification permission function call kar sakte hain!
       requestNotificationPermission();
       
        setShowWelcomeSplash(true);
        splashTimer = setTimeout(() => {
          setShowWelcomeSplash(false);
        }, 2500);

        const savedChat = localStorage.getItem('chat_active_chat');
        if (savedChat) {
          try {
            const parsed = JSON.parse(savedChat);
            socket.emit('join_chat', parsed.id);
          } catch (e) {
            localStorage.removeItem('chat_active_chat');
          }
        }
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
        localStorage.removeItem('chat_active_chat');
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      if (splashTimer) clearTimeout(splashTimer);
    };
  }, []);

  // Theme Toggler
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      localStorage.setItem('chat_theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      localStorage.setItem('chat_theme', 'dark');
    }
  }, [theme]);

  // Scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      const scrollTimer = setTimeout(() => {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }, 80);
      return () => clearTimeout(scrollTimer);
    }
  }, [messages, activeChat]);

  // Read Receipts logic
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

  // Socket Engine Event Listeners & Push Notification Handler
  useEffect(() => {
    const handleUsersUpdate = (data) => {
      setUsersList(data.filter(u => u.uid !== auth.currentUser?.uid));
      const me = data.find(u => u.id === socket.id);
      if (me) setCurrentUser(prev => ({ ...prev, ...me }));
    };

    const handleGroupsUpdate = (data) => setGroupsList(data);

    const handleReceiveMessage = (data) => {
      setMessages(prev => {
        const currentChatMessages = prev[data.chatId] || [];
        const isDuplicate = currentChatMessages.some(msg => msg.id === data.message.id);
        if (isDuplicate) return prev;
        return { ...prev, [data.chatId]: [...currentChatMessages, data.message] };
      });
    };

    const handleMessagesUpdated = (data) => {
      setMessages(prev => ({ ...prev, [data.chatId]: data.messages }));
    };

    const handleUserTyping = (data) => {
      setTypingStatus(prev => ({
        ...prev,
        [data.chatId]: { isTyping: data.isTyping, user: data.username }
      }));
    };

    const handleUserSeenUpdate = ({ chatId, messageId, userId }) => {
      setMessages(prev => {
        const updated = { ...prev };
        const chatMsgs = updated[chatId] ? [...updated[chatId]] : [];
        const msgIndex = chatMsgs.findIndex(m => m.id === messageId);
        if (msgIndex !== -1 && !chatMsgs[msgIndex].seenBy.includes(userId)) {
          chatMsgs[msgIndex] = { ...chatMsgs[msgIndex], seenBy: [...chatMsgs[msgIndex].seenBy, userId] };
        }
        updated[chatId] = chatMsgs;
        return updated;
      });
    };

    const handleMessageDeleted = ({ chatId, messageId }) => {
      setMessages(prev => {
        const chatMsgs = prev[chatId] ? prev[chatId].filter(m => m.id !== messageId) : [];
        return { ...prev, [activeChat?.id || chatId]: chatMsgs };
      });
    };

    // 🔔 Handle direct incoming push notifications for mobile/desktop
    const handlePushNotification = (notif) => {
      setPushNotificationAlert(notif);
      setTimeout(() => {
        setPushNotificationAlert(null);
      }, 4000);
    };

    socket.on('update_users', handleUsersUpdate);
    socket.on('update_groups', handleGroupsUpdate);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('messages_updated', handleMessagesUpdated);
    socket.on('user_typing', handleUserTyping);
    socket.on('userSeenUpdate', handleUserSeenUpdate);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('push_notification', handlePushNotification);

    return () => {
      socket.off('update_users', handleUsersUpdate);
      socket.off('update_groups', handleGroupsUpdate);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('messages_updated', handleMessagesUpdated);
      socket.off('user_typing', handleUserTyping);
      socket.off('userSeenUpdate', handleUserSeenUpdate);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('push_notification', handlePushNotification);
    };
  }, [activeChat]);

  // Firestore Snapshot Listener
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
        setMessages(prev => ({ ...prev, [activeChat.id]: fetchedMsgs }));
      }, (error) => console.error("Firestore Listen Error:", error));

      return () => unsubscribe();
    }
  }, [activeChat]);

  // Voice Recorder Functions
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
        
        const deletePromises = querySnapshot.docs.map((document) => 
          deleteDoc(doc(db, "private_chats", activeChat.id, "messages", document.id))
        );
        await Promise.all(deletePromises);
      } catch (err) {
        console.error("Firestore Permanent Delete Error:", err);
      }
    }
  };

  const selectChat = (chatObj) => {
    setActiveChat(chatObj);
    socket.emit('join_chat', chatObj.id);
    setReplyToMsg(null);
    setEditMsg(null);
  };

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
    const file = e.target.files[0];
    if (!file || !activeChat) return;

    if (file.size > 15 * 1024 * 1024) return alert("File 15MB se kam ki honi chahiye!");

    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      const msgId = `msg-${Date.now()}`;
      const currentUserId = getMyId();
      const now = new Date();
      
      const msgObject = {
        id: msgId,
        senderId: currentUserId,
        senderName: currentUser?.username || "User",
        text: "",
        fileUrl: base64String,
        fileType: isVideo ? 'video' : 'image',
        timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateFormatted: now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
        timestampRaw: now.getTime(),
        seenBy: [currentUserId],
        replyTo: replyToMsg ? { id: replyToMsg.id, senderName: replyToMsg.senderName, text: replyToMsg.text || "📷 Attachment" } : null,
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
        fileUrl: base64String,
        fileType: isVideo ? 'video' : 'image',
        timeFormatted: msgObject.timeFormatted,
        dateFormatted: msgObject.dateFormatted,
        id: msgId,
        replyTo: msgObject.replyTo
      });
      setReplyToMsg(null);

      const isGlobal = activeChat.id === 'global-group' || activeChat.id === 'global' || activeChat.name === 'Global Group';
      if (!isGlobal && activeChat.type === 'private') {
        addDoc(collection(db, "private_chats", activeChat.id, "messages"), msgObject)
          .catch(error => console.error("Firestore Upload Error:", error));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: editUsername.trim(),
          photoURL: editPfp.trim()
        });
        localStorage.setItem(`chat_bio_${auth.currentUser.uid}`, editBio.trim());
      }
      const updatedUser = { ...currentUser, username: editUsername.trim(), bio: editBio.trim(), pfp: editPfp.trim() };
      setCurrentUser(updatedUser);
      socket.emit('update_profile', updatedUser);
      setIsEditingProfile(false);
    } catch (error) {
      console.error(error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_active_chat');
    signOut(auth).then(() => window.location.reload());
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
        const previewAvatar = customPfp || `https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`;
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
        const user = userCredential.user;

        await updateProfile(user, { displayName: username.trim(), photoURL: previewAvatar });
        const userBio = editBio.trim() || "Hey there! I am using Fi-chen Chat.";
        localStorage.setItem(`chat_bio_${user.uid}`, userBio);
        
        const finalUser = { id: socket.id, uid: user.uid, username: username.trim(), bio: userBio, pfp: previewAvatar };
        setCurrentUser(finalUser);
        setIsLoggedIn(true);
        socket.emit('login_user', finalUser);
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
    return <div className="login-container"><div className="login-card"><h4>Loading Fi-chan chat...🚀 </h4></div></div>;
  }
  
  if (isLoggedIn && showWelcomeSplash) {
    return (
      <div className="welcome-splash-overlay">
        <div className="welcome-splash-card animate-pop-in">
          <img src={currentUser?.pfp} alt="User Avatar" className="splash-avatar" />
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
                  <input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) return alert("Image 10MB se kam ki honi chahiye!");
                      const reader = new FileReader();
                      reader.onloadend = () => setCustomPfp(reader.result);
                      reader.readAsDataURL(file);
                    }
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
      {/* 🔔 Push Notification Mobile Popup Banner */}
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
          alignId: 'center',
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
            <button className="theme-toggle-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>
          </div>
          <div className="user-badge">
            <img src={currentUser?.pfp} alt="me" />
            <span>@{currentUser?.username}</span>
          </div>
        </div>

        <div className="tab-menu">
          <button className={activeTab === 'rooms' ? 'active' : ''} onClick={() => setActiveTab('rooms')}>👤 Rooms ({groupsList.length + 1})</button>
          <button className={activeTab === 'friends' ? 'active' : ''} onClick={() => setActiveTab('friends')}>👥 Friends ({usersList.length})</button>
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
              {usersList.length === 0 ? <p className="empty-msg">No online friends found.</p> : 
                usersList.map(user => (
                  <div key={user.uid} className="chat-item-row" onClick={() => setShowProfileModal(user)}>
                    <img className="avatar-icon" src={user.pfp} alt="" />
                    <div className="item-details"><h4>{user.username}</h4><p className="online-tag">● Online</p></div>
                  </div>
                ))
              }
            </div>
          )}

          {activeTab === 'profile' && currentUser && (
            <div className="profile-section animate-fade">
              {isEditingProfile ? (
                <div className="edit-form">
                  <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} placeholder="Username" />
                  <input type="text" value={editPfp} onChange={e => setEditPfp(e.target.value)} placeholder="Avatar URL" />
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Bio..."></textarea>
                  <button className="done-btn" onClick={saveProfileEdit}>Done</button>
                </div>
              ) : (
                <div className="profile-view">
                  <img src={currentUser.pfp} alt="profile" className="large-pfp" />
                  <h3>{currentUser.username}</h3>
                  <p className="bio-text">"{currentUser.bio}"</p>
                  <button className="edit-profile-btn" onClick={() => setIsEditingProfile(true)}>Edit Profile</button>
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
              <img className="header-avatar" src={activeChat.type === 'group' ? 'https://api.dicebear.com/7.x/identicon/svg?seed=global' : (activeChat.userObj?.pfp || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeChat.name}`)} alt="chat-pfp" />
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
                      {!isMe && <img src={msg.pfp || `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.senderName}`} alt="user-pfp" className="message-avatar" />}

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
                  <span className="emoji-stub" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>😊</span>
                  
                  <label htmlFor="image-input" className="file-upload-btn">📁</label>
                  <input type="file" accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} id="image-input" />
                  
                  <button 
                    type="button" 
                    className="voice-record-btn" 
                    onClick={startRecording}
                    title="Record Voice Message"
                  >
                    🎙️
                  </button>

                  <input 
                    type="text" 
                    placeholder={editMsg ? "Edit message..." : "Write message..."} 
                    value={typedMessage} 
                    onChange={handleTypingInput} 
                  />
                  <button type="submit" className="send-rocket-btn">{editMsg ? "✅" : "🚀"}</button>
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
          onClaimReward={() => {
            setShowGiftsSection(false);
          }}
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
            <img src={showProfileModal.pfp} alt="" className="modal-pfp"/>
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
    </div>
  );
}

export default App;