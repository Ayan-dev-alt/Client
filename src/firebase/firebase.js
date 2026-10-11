import { initializeApp, getApps } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  ...(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
    ? { storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET }
    : {}),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every(Boolean);
if (!firebaseConfigured) {
  throw new Error("Firebase config is missing. Copy .env.example to .env and fill in your Firebase web app values.");
}
export const app = getApps()[0] ?? initializeApp(config);
export const REMEMBER_ME_STORAGE_KEY = "nbf-remember-me";
const initialAuthPersistence =
  typeof window !== "undefined" &&
  window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === "true"
    ? browserLocalPersistence
    : inMemoryPersistence;
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: initialAuthPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch (error) {
  if (error.code !== "auth/already-initialized") throw error;
  authInstance = getAuth(app);
}
export const auth = authInstance;
export const db = getFirestore(app);
