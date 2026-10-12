const firebaseMessages = {
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead, or use a different email.",
  "auth/invalid-email": "That email address does not look valid. Check it and try again.",
  "auth/weak-password": "Choose a stronger password with at least 6 characters.",
  "auth/user-not-found": "We could not find an account with those details. Check your email or create an account.",
  "auth/wrong-password": "That password is incorrect. Check it and try again.",
  "auth/invalid-credential": "Those sign-in details are not correct. Check your email and password, or try Google sign-in.",
  "auth/too-many-requests": "There have been too many attempts. Wait a little while, then try again.",
  "auth/network-request-failed": "The connection failed. Check your internet and try again.",
  "auth/popup-closed-by-user": "Google sign-in was closed before it finished. Try again when you are ready.",
  "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
  "auth/account-exists-with-different-credential": "An account with this email already uses another sign-in method. Sign in with that method first.",
  "auth/requires-recent-login": "For your security, sign out and sign in again before retrying this action.",
  "auth/operation-not-allowed": "This sign-in method is not enabled yet. Contact the site administrator.",
  "permission-denied": "You do not have permission to do that. Check that you are signed in to the right account, then try again.",
  "firestore/permission-denied": "You do not have permission to access this information. Check that you are signed in to the right account.",
  "unavailable": "The service is temporarily unavailable. Check your connection and try again in a moment.",
  "firestore/unavailable": "The database is temporarily unavailable. Check your connection and try again in a moment.",
  "functions/unavailable": "The order service is temporarily unavailable. Try again in a moment.",
  "unauthenticated": "Your session has expired. Sign in again, then retry.",
  "functions/unauthenticated": "Your session has expired. Sign in again, then retry.",
  "functions/invalid-argument": "Some order details are missing or invalid. Review them and try again.",
  "functions/failed-precondition": "This order cannot be placed right now. Check item availability and try again.",
  "functions/resource-exhausted": "There is not enough stock for one or more items. Update your bag and try again.",
  "functions/permission-denied": "This action is not allowed for your account. Sign in to the correct account and try again.",
};

export function userFriendlyError(error, fallback = "Something went wrong. Please try again.") {
  const code = typeof error?.code === "string" ? error.code : "";
  if (firebaseMessages[code]) return firebaseMessages[code];
  if (/^(auth|firestore|functions)\//.test(code)) {
    return `${fallback} If this keeps happening, contact support and share error code ${code}.`;
  }
  return error?.message || fallback;
}
