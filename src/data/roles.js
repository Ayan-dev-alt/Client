export const ADMIN_EMAILS = [
  "hafizjunaid09478@gmail.com",
  "m.ayanali051@gmail.com",
];

export function isAdminIdentity(user) {
  const email = user?.email?.toLowerCase();
  return Boolean(user?.emailVerified && email && ADMIN_EMAILS.includes(email));
}
