# Web Push Notifications

The app supports browser push for direct messages. Users enable it from the **Enable** control in the signed-in sidebar. The browser must support Firebase Web Messaging and the app must run over HTTPS (localhost is also allowed).

## Firebase setup

1. In the Firebase Console for the same project used by the frontend, open **Project settings > Cloud Messaging** and confirm Web Push is enabled. The VAPID public key used by the frontend must belong to that project.
2. In **Project settings > Service accounts**, create/download an Admin SDK service-account key. Keep this private key secret; never add the downloaded JSON file to the repo or frontend.
3. Set the backend environment variable `FIREBASE_SERVICE_ACCOUNT_JSON` to the complete service-account JSON on the local backend and on the production host (for example Render's environment settings). When entering it as a single-line environment value, preserve JSON escaping for newlines in `private_key`.
4. Restart/redeploy the backend. Its startup log should say `Firebase Admin push notifications enabled.` If it reports that push is disabled, token registration and push delivery will not work.
5. Sign in to the app and choose **Enable** in the sidebar. Allow notifications in the browser prompt. The app registers its service worker and the server stores the device token against the Firebase-authenticated user.

Push delivery currently targets direct chats whose IDs are the two Firebase UIDs joined with `--`. The existing public/group rooms do not have membership lists, so group push delivery is intentionally not broadcast to every user. Invalid/expired FCM tokens are removed when Firebase reports them, and logging out unregisters the current device.

If permission was previously denied, change the site's notification permission in the browser settings before trying again. Push delivery also depends on the browser not force-quitting the app, device notification settings, network connectivity, and Firebase Cloud Messaging availability.
