# Web Push Notifications

The app supports browser push for direct messages. Users enable it from the **Enable** control in the signed-in sidebar. The browser must support Firebase Web Messaging and the app must run over HTTPS (localhost is also allowed).

## Firebase setup

1. In the Firebase Console for the same project used by the frontend, open **Project settings > Cloud Messaging** and confirm Web Push is enabled. The VAPID public key used by the frontend must belong to that project.
2. Configure Firebase Admin credentials on the backend host only (the Vercel frontend must not receive this secret). Either set `FIREBASE_SERVICE_ACCOUNT_JSON` to the complete service-account JSON, or use the host's application-default credentials (for example `GOOGLE_APPLICATION_CREDENTIALS` with a securely mounted key file). Optionally set `FIREBASE_PROJECT_ID`. Never put Admin credentials in frontend environment variables or commit them to the repo.
3. Restart/redeploy the backend. Its startup log should say `Firebase Admin authentication and push notifications enabled.` The backend verifies the Firebase ID token sent during Socket.IO login; device tokens are stored against the UID from that verified token, never a UID supplied by the browser. Without Admin credentials, device registration fails with a configuration-specific message.
4. Sign in to the app and choose **Enable** in the sidebar. Allow notifications in the browser prompt. The app registers its service worker and the server stores the device token against the Firebase-authenticated user.

Push delivery currently targets direct chats whose IDs are the two Firebase UIDs joined with `--`. The existing public/group rooms do not have membership lists, so group push delivery is intentionally not broadcast to every user. Invalid/expired FCM tokens are removed when Firebase reports them, and logging out unregisters the current device.

If permission was previously denied, change the site's notification permission in the browser settings before trying again. Push delivery also depends on the browser not force-quitting the app, device notification settings, network connectivity, and Firebase Cloud Messaging availability.
