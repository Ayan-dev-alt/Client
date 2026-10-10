# New Brand Fashion

A React marketplace for buyers and independent sellers, backed by Firebase Authentication and Cloud Firestore. Sellers can list products, receive orders, manage reviews and messages; buyers can shop, save wishlists, order and contact sellers. Verified admins manage users and marketplace activity from `/admin`.

## Local development

1. Install Node.js 22 or newer and run `npm install`.
2. Copy `.env.example` to `.env` and fill in the Firebase web app configuration from Firebase Console.
3. Enable Email/Password and Google sign-in in Firebase Authentication. Add `localhost` and the deployed domain to Authorized domains.
4. Start the app with `npm run dev`.

## Build and deploy

Run `npm run lint` and `npm run build` before deployment. For Vercel, follow [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md); `vercel.json` configures the Vite build, SPA route rewrites, and browser security headers.

The Vercel site uses Firebase Authentication, Cloud Firestore, and Cloud Functions. Deploying the frontend to Vercel does not deploy Firebase rules or functions; the Firebase setup is a one-time step documented in the deployment guide. Cloud Functions require the Firebase Blaze plan.

Never upload `.env`, private service-account keys, or dependency/build output to GitHub. `.env.example` contains blank placeholders and is safe to commit. The Vite Firebase values belong in Vercel Environment Variables and are included in the public browser build, so they must never contain secrets.

The verified admin emails are configured in `src/data/roles.js`, `firestore.rules`, and `functions/index.js`; keep these lists in sync. Product images are saved as public image URLs in Firestore, so Firebase Storage is not used. Marketplace messages, profile data, reviews, wishlists and orders use Cloud Firestore.
