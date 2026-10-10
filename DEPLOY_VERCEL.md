# Deploy to Vercel

This project uses Vercel for the Vite/React website and Firebase for sign-in, Firestore, and two callable Cloud Functions. Deploying the website does not deploy the Firebase backend.

## One-time setup

1. Push this repository to GitHub, GitLab, or Bitbucket and import it in Vercel. Keep the Root Directory set to `.`. Vercel reads `vercel.json`, builds with `npm run build`, and serves `dist` with client-side route rewrites.
2. In Vercel, open **Project Settings → Environment Variables**. Add these six variables for Production (and Preview if you want preview deployments to connect to Firebase):

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

   Copy the values from the Firebase web app configuration. These are browser configuration values; protect the project with Firebase Auth and Firestore rules. Never put a service-account key or Admin SDK credential in a `VITE_` variable.
3. In Firebase Authentication, enable Email/Password and Google sign-in. Add the Vercel production hostname (and any preview hostname you intend to use) to **Authentication → Settings → Authorized domains**. Configure the Google OAuth consent screen and authorized redirect URI shown by Firebase if prompted.
4. Deploy Firestore rules and Cloud Functions from a trusted local terminal with Firebase CLI access:

   ```sh
   npm install
   npm --prefix functions install
   npx firebase-tools login
   npx firebase-tools use YOUR_FIREBASE_PROJECT_ID
   npx firebase-tools deploy --only firestore:rules,functions
   ```

   The functions run in `us-central1` and require the Firebase Blaze plan. The Functions code uses the default Firebase Admin service identity; do not add a downloaded service-account key to this repository.
5. Confirm the two admin email addresses in `src/data/roles.js`, `firestore.rules`, and `functions/index.js` are the intended verified admin accounts.
6. Trigger a Vercel production deployment. Test `/`, `/signin`, `/seller`, and `/admin` by directly opening each URL. Vercel's rewrite handles React Router deep links.

## Future updates

Push website changes to the connected Git branch; Vercel rebuilds automatically. After changing `firestore.rules` or `functions/`, run the Firebase deploy command again. After changing a Vercel environment variable, redeploy so Vite can embed the new values in the static build.

## Keep credentials safe

`.env` and `.env.local` are ignored by Git; `.env.example` contains blank placeholders. Vite exposes every `VITE_` variable in the browser bundle, so only use it for Firebase web-app configuration, never private keys or secrets. Firestore rules and server-side function checks are the authorization boundary.
