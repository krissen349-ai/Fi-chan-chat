jest.mock('./firebase', () => ({ db: { name: 'test-db' } }));
jest.mock('firebase/auth', () => ({ updateProfile: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...parts) => ({ path: parts.slice(1).join('/') })),
  setDoc: jest.fn()
}));

import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { persistProfile } from './profilePersistence';

describe('persistProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    doc.mockImplementation((...parts) => ({ path: parts.slice(1).join('/') }));
    setDoc.mockResolvedValue(undefined);
    updateProfile.mockResolvedValue(undefined);
  });

  test('saves the authenticated user document before synchronizing Firebase Auth', async () => {
    const calls = [];
    setDoc.mockImplementation(async (...args) => {
      calls.push('firestore');
      return args;
    });
    updateProfile.mockImplementation(async () => calls.push('auth'));
    const user = { uid: 'owner-uid' };
    const profile = {
      username: 'New name',
      bio: 'A new bio',
      pfp: 'data:image/jpeg;base64,abc'
    };

    await expect(persistProfile(user, profile)).resolves.toBeNull();

    expect(doc).toHaveBeenCalledWith({ name: 'test-db' }, 'users', 'owner-uid');
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'users/owner-uid' },
      expect.objectContaining({ uid: 'owner-uid', ...profile }),
      { merge: true }
    );
    expect(updateProfile).toHaveBeenCalledWith(user, { displayName: 'New name' });
    expect(calls).toEqual(['firestore', 'auth']);
  });

  test('does not sync Firebase Auth if the Firestore profile write fails', async () => {
    setDoc.mockRejectedValue(new Error('permission denied'));

    await expect(persistProfile({ uid: 'owner-uid' }, {
      username: 'New name',
      bio: '',
      pfp: 'https://example.test/avatar.png'
    })).rejects.toThrow('permission denied');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  test('returns an Auth sync error after the Firestore profile is saved', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const authError = new Error('auth unavailable');
    updateProfile.mockRejectedValue(authError);

    await expect(persistProfile({ uid: 'owner-uid' }, {
      username: 'New name',
      bio: '',
      pfp: 'https://example.test/avatar.png'
    })).resolves.toBe(authError);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledWith(
      { uid: 'owner-uid' },
      { displayName: 'New name', photoURL: 'https://example.test/avatar.png' }
    );
  });
});
