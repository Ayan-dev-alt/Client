export const ADMIN_EMAILS = [
  "hafizjunaid09478@gmail.com",
  "m.ayanali051@gmail.com",
];

export function isAdminIdentity(user) {
  const email = user?.email?.toLowerCase();
  // Keep the client check aligned with Firestore's admin allowlist. Firebase
  // can report a stale emailVerified flag for an existing Google session.
  return Boolean(email && ADMIN_EMAILS.includes(email));
}
