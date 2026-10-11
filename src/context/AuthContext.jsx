import { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  EmailAuthProvider,
  signOut,
  updateProfile,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  deleteUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, REMEMBER_ME_STORAGE_KEY } from "../firebase/firebase";
import { isAdminIdentity } from "../data/roles";
import { deleteOwnMarketplaceData } from "../data/admin";

import { AuthContext } from "./auth";

async function applyAuthPersistence(rememberMe) {
  if (rememberMe)
    window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, "true");
  else window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
  await setPersistence(
    auth,
    rememberMe ? browserLocalPersistence : inMemoryPersistence,
  );
}

async function saveProfile(user, role = "buyer", name = "", phone = "") {
  const ref = doc(db, "users", user.uid);
  const old = await getDoc(ref);
  await setDoc(
    ref,
    {
      uid: user.uid,
      name:
        name ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "Fashion customer",
      email: user.email || "",
      ...(phone ? { phone } : {}),
      photoURL: user.photoURL || "",
      role: old.exists() ? old.data().role : role,
      createdAt: old.exists() ? old.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentRequest = 0;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      const requestId = ++currentRequest;
      setUser(nextUser);
      setProfile(null);
      if (!nextUser) {
        setLoading(false);
        return;
      }
      if (isAdminIdentity(nextUser)) {
        const adminProfile = {
          uid: nextUser.uid,
          name:
            nextUser.displayName ||
            nextUser.email?.split("@")[0] ||
            "Administrator",
          email: nextUser.email,
          role: "admin",
        };
        setProfile(adminProfile);
        setLoading(false);
        // Admin access is established by the allowlisted identity, regardless of
        // whether the Firebase email verification flag is stale or missing.
        return;
      }
      setLoading(true);
      try {
        await saveProfile(
          nextUser,
          sessionStorage.getItem("nbf-signup-role") || "buyer",
        );
        const snapshot = await getDoc(doc(db, "users", nextUser.uid));
        if (requestId !== currentRequest) return;
        const savedProfile = snapshot.data() ?? null;
        setProfile(
          isAdminIdentity(nextUser)
            ? { ...savedProfile, role: "admin" }
            : savedProfile,
        );
      } catch (error) {
        if (requestId !== currentRequest) return;
        console.error("Could not load your account profile", error);
        setProfile({
          uid: nextUser.uid,
          name: nextUser.displayName || "Fashion customer",
          email: nextUser.email,
          role: isAdminIdentity(nextUser) ? "admin" : "buyer",
        });
      } finally {
        if (requestId === currentRequest) setLoading(false);
      }
    });
    return () => {
      currentRequest += 1;
      unsubscribe();
    };
  }, []);

  // Firestore has no onDisconnect hook; refresh presence periodically and
  // mark the account offline on tab close / backgrounding. Admins treat stale
  // heartbeats as offline, so a crashed browser cannot stay "online" forever.
  useEffect(() => {
    if (!user || profile?.uid !== user.uid) return undefined;
    const profileRef = doc(db, "users", user.uid);
    let closed = false;
    const mark = (isOnline) =>
      updateDoc(profileRef, {
        isOnline,
        lastSeen: serverTimestamp(),
      }).catch((error) => {
        if (!closed && error.code !== "permission-denied")
          console.warn("Could not update account activity", error);
      });
    const markVisible = () => {
      if (document.visibilityState === "visible") void mark(true);
    };
    void mark(true);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") void mark(true);
    }, 60_000);
    const markOffline = () => {
      void mark(false);
    };
    document.addEventListener("visibilitychange", markVisible);
    window.addEventListener("pagehide", markOffline);
    return () => {
      closed = true;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", markVisible);
      window.removeEventListener("pagehide", markOffline);
      void mark(false);
    };
  }, [user, profile?.uid]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      hasPasswordProvider: Boolean(
        user?.providerData?.some(
          (provider) => provider.providerId === "password",
        ),
      ),
      async signup({ name, email, password, phone, role = "buyer", rememberMe = false }) {
        const safeRole = role === "seller" ? "seller" : "buyer";
        sessionStorage.setItem("nbf-signup-role", safeRole);
        try {
          await applyAuthPersistence(rememberMe);
          const result = await createUserWithEmailAndPassword(
            auth,
            email,
            password,
          );
          await updateProfile(result.user, { displayName: name });
          await saveProfile(
            { ...result.user, displayName: name },
            safeRole,
            name,
            phone,
          );
        } finally {
          sessionStorage.removeItem("nbf-signup-role");
        }
      },
      async signin(email, password, rememberMe = false) {
        await applyAuthPersistence(rememberMe);
        await signInWithEmailAndPassword(auth, email, password);
      },
      async google(role = "buyer", phone = "", rememberMe = false) {
        sessionStorage.setItem("nbf-signup-role", role);
        try {
          await applyAuthPersistence(rememberMe);
          const result = await signInWithPopup(
            auth,
            new GoogleAuthProvider(),
            browserPopupRedirectResolver,
          );
          // Profile persistence is handled by the auth-state listener. Avoid
          // keeping the sign-in screen waiting on Firestore after OAuth succeeds.
          void saveProfile(result.user, role, "", phone.trim()).catch(
            (error) => {
              console.warn("Could not save the signed-in profile", error);
            },
          );
          return result.user;
        } finally {
          sessionStorage.removeItem("nbf-signup-role");
        }
      },
      async becomeSeller() {
        if (!user) throw new Error("Sign in before opening a seller account.");
        await setDoc(
          doc(db, "users", user.uid),
          { role: "seller", updatedAt: serverTimestamp() },
          { merge: true },
        );
        setProfile((current) => ({ ...current, role: "seller" }));
      },
      async updateAccount({ name, phone }) {
        if (!user) throw new Error("Sign in to update account settings.");
        const cleanName = name.trim();
        const cleanPhone = phone.trim();
        if (!cleanName) throw new Error("Name cannot be empty.");
        await updateDoc(doc(db, "users", user.uid), {
          name: cleanName,
          phone: cleanPhone,
          updatedAt: serverTimestamp(),
        });
        await updateProfile(user, { displayName: cleanName });
        setProfile((current) => ({
          ...current,
          name: cleanName,
          phone: cleanPhone,
        }));
      },
      async setAdminPassword({ password, currentPassword }) {
        if (!user || !isAdminIdentity(user))
          throw new Error(
            "Sign in with the verified admin Google account first.",
          );
        if (password.length < 8)
          throw new Error("Use at least 8 characters for the password.");
        if (!user.emailVerified)
          throw new Error(
            "Verify this email address before setting a password.",
          );
        const passwordLinked = user.providerData.some(
          (provider) => provider.providerId === "password",
        );
        if (passwordLinked) {
          if (!currentPassword)
            throw new Error(
              "Enter your current password to confirm this change.",
            );
          const credential = EmailAuthProvider.credential(
            user.email,
            currentPassword,
          );
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, password);
        } else {
          await reauthenticateWithPopup(user, new GoogleAuthProvider());
          await linkWithCredential(
            user,
            EmailAuthProvider.credential(user.email, password),
          );
        }
      },
      async deleteAccount({ password }) {
        if (!user) throw new Error("Sign in to delete your account.");
        const passwordProvider = user.providerData.find(
          (provider) => provider.providerId === "password",
        );
        const googleProvider = user.providerData.find(
          (provider) => provider.providerId === "google.com",
        );
        if (passwordProvider) {
          if (!password)
            throw new Error(
              "Enter your current password to confirm account deletion.",
            );
          await reauthenticateWithCredential(
            user,
            EmailAuthProvider.credential(user.email, password),
          );
        } else if (googleProvider) {
          await reauthenticateWithPopup(user, new GoogleAuthProvider());
        } else {
          throw new Error(
            "This sign-in method cannot be reauthenticated here. Sign in again, then retry.",
          );
        }

        await deleteOwnMarketplaceData(user, profile?.role);
        try {
          await deleteUser(user);
        } catch (error) {
          // A previous server-side delete may have completed while its response
          // was blocked by the browser, so accept an already-removed Auth user.
          if (
            !["auth/user-not-found", "auth/user-token-expired"].includes(
              error.code,
            )
          )
            throw error;
        }
      },
      logout: () => signOut(auth),
    }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
