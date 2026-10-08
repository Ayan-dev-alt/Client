# New Brand Fashion

A React marketplace for buyers and independent sellers, backed by Firebase Authentication and Cloud Firestore. Sellers can list products, receive orders, manage reviews and messages; buyers can shop, save wishlists, order and contact sellers. Verified admins manage users and marketplace activity from `/admin`.

## Local development

1. Install Node.js 22 or newer and run `npm install`.
2. Copy `.env.example` to `.env` and fill in the Firebase web app configuration from Firebase Console.
3. Enable Email/Password and Google sign-in in Firebase Authentication. Add `localhost` and the deployed domain to Authorized domains.
4. Start the app with `npm run dev`.

## Build and deploy

Run `npm run lint` and `npm run build` before deployment. Firebase Hosting serves the `dist` directory and rewrites app routes to `index.html`:

```bash
firebase deploy --only hosting,firestore:rules,functions
```

Deploying Cloud Functions requires the Firebase Blaze billing plan. Add the Vite Firebase values from `.env` as environment variables in your build provider. Never upload `.env`, private service-account keys, `node_modules`, or `dist` to GitHub; `.env.example` is safe to commit.

The verified admin emails are configured in `src/data/roles.js`, `firestore.rules`, and `functions/index.js`; keep these lists in sync. Product images are saved as public image URLs in Firestore, so Firebase Storage is not used. Marketplace messages, profile data, reviews, wishlists and orders use Cloud Firestore.
