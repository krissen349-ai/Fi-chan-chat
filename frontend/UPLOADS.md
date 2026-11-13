# File and Profile Photo Uploads

Chat attachments and profile photos are uploaded to the Firebase Storage bucket configured in `frontend/src/firebase.js`. Chat attachments are limited to 15 MiB and profile photos to 10 MiB. Uploads are stored under the authenticated user's ID; chat messages continue to use the existing private-chat Firestore and group-chat Socket.IO flows.

## Firebase setup

Enable Firebase Storage for the configured Firebase project, then deploy the rules from the repository root:

```sh
firebase deploy --only storage
```

The rules in `storage.rules` restrict uploads to the authenticated user's own folder, apply the file-size limits, and require profile photos to have an image content type. Signed-in users can read uploaded files so existing chat participants can open shared attachments.
