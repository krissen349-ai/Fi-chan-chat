# File and Profile Photo Uploads

Private-chat attachments (up to 15 MB) are divided into small text chunks and saved in the existing private-chat messages collection. Group-chat files are relayed through Socket.IO and retained in server memory for up to 12 hours. Profile photos (up to 10 MB) are compressed to fit Firestore's document limit and saved in the existing user profile document.

Uploads use the existing private-chat and profile Firestore rules; no new rules deployment, Cloudinary, Firebase Storage, or MongoDB file service is required.
