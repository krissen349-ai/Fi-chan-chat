# File and Profile Photo Uploads

Chat attachments (up to 15 MB) and profile photos (up to 10 MB) are uploaded to the existing backend and stored in MongoDB GridFS. Upload requests are authenticated with the user's Firebase ID token. The uploaded file URL is then saved in the existing private-chat Firestore or group-chat Socket.IO message flow; profile photo URLs continue to be saved to Firebase Auth and Firestore.

## Backend setup

The backend must have a reachable MongoDB database configured with `MONGO_URI`. If Firebase Admin is not configured using `FIREBASE_SERVICE_ACCOUNT_JSON`, the backend validates upload tokens through Firebase Identity Toolkit using the public Firebase API key sent by the frontend.

Files are served from the backend using a random, unguessable file ID so existing chat and profile image views can load them without changing their rendering flow.
