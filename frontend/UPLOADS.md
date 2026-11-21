# File and Profile Photo Uploads

Private-chat attachments (up to 15 MB) are divided into small text chunks and saved in the existing private-chat messages collection. Group-chat files are relayed through Socket.IO and retained in server memory for up to 12 hours. Profile photos (up to 10 MB) are compressed to fit Firestore's document limit and saved in the existing user profile document.

Uploads use Firestore, not Firebase Storage. Profile writes are scoped to `/users/{authenticatedUid}`. Private-chat access is enforced by Firestore rules against the two participant UIDs encoded in the canonical `uid--uid` chat ID; private file chunks must also identify the authenticated uploader and stay within the 15 MB upload limit. Deploy `firestore.rules` after changing the rules.

The group-chat Socket.IO transfer route is separate and is not changed by the private-chat upload rules. Do not configure Firebase Storage as publicly writable; no Storage bucket is used by this upload implementation.
