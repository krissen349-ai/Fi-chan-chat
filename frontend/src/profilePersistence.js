import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const FIRESTORE_UPLOAD_PREFIX = 'fi-upload:';

export const persistProfile = async (user, { username, bio, pfp }) => {
  if (!user?.uid) throw new Error('Please sign in again before saving your profile.');
  if (typeof username !== 'string' || !username.trim()) throw new Error('A username is required.');
  if (typeof bio !== 'string') throw new Error('The profile bio is invalid.');
  if (typeof pfp !== 'string' || !pfp) throw new Error('A profile picture is required.');

  const authProfile = { displayName: username };
  if (!pfp.startsWith(FIRESTORE_UPLOAD_PREFIX) && !pfp.startsWith('data:image/')) {
    authProfile.photoURL = pfp;
  }

  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    username,
    bio,
    pfp,
    lastSeen: Date.now()
  }, { merge: true });

  try {
    await updateProfile(user, authProfile);
    return null;
  } catch (error) {
    console.warn('Firestore profile saved, but Firebase Auth profile sync failed:', error);
    return error;
  }
};
