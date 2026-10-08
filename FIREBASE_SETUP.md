# Firebase setup

## Configure the app

1. Create or select a Firebase project and create a Cloud Firestore database.
2. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**. Add `localhost` and the deployed domain to Authorized domains.
3. Copy `.env.example` to `.env` and enter the Firebase web app values. Keep `.env` private; add the same `VITE_FIREBASE_*` values to your production build environment.
4. Product images use public image URLs, so Firebase Storage is not needed.

## Deploy Firebase services

Install and authenticate the Firebase CLI, then select the project whose ID matches `VITE_FIREBASE_PROJECT_ID`:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

Publish the Firestore rules and callable checkout/account-management functions:

```bash
firebase deploy --only firestore:rules,functions
```

Then build and publish the single-page app to Firebase Hosting:

```bash
npm ci
npm run build
firebase deploy --only hosting
```

Cloud Functions deployment requires the Firebase **Blaze** plan. Checkout uses `functions/createMarketplaceOrder` to validate current prices and stock and create orders safely. A signed-in buyer or seller can delete their own account from Settings using Firebase Auth and owner-scoped Firestore rules; order records remain, with the buyer's contact details removed. Deleting another user's Firebase Auth account from the admin dashboard still requires `functions/deleteMarketplaceAccount` and therefore Blaze. Do not expose Firebase Admin credentials in the browser.

The verified admin emails are `hafizjunaid09478@gmail.com` and `m.ayanali051@gmail.com`. Keep the allowlist in `src/data/roles.js`, `firestore.rules`, and `functions/index.js` synchronized. Phone numbers are required on signup and editable in Settings. Admin messages, temporary suspensions, and account status updates use Firestore live listeners. Seller/buyer online status is based on a heartbeat and goes offline after two minutes without activity.

The app stores profiles, products, reviews, messages, wishlists, and orders in Firestore. Checkout creates an order request; sellers coordinate fulfillment and payment with buyers. This app does not process card payments.
