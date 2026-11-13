# File and Profile Photo Uploads

Chat attachments (up to 15 MB) and profile photos (up to 10 MB) are converted to Base64 text and split into small Firestore documents so each stays below Firestore's document-size limit. The chat continues sharing a short file ID through the existing private-chat Firestore or group-chat Socket.IO flow. Profile edit/signup saves the same file ID in Firebase Auth and the user's Firestore profile.

## Firebase setup

Deploy the updated Firestore rules from the repository root:

```sh
firebase deploy --only firestore:rules
```

Only signed-in users can create files; file contents can be fetched by signed-in users who receive the file ID in a chat or profile. Firestore reads/writes are higher than a single URL upload because large files are divided into multiple text chunks.
