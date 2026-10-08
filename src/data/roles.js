export const ADMIN_EMAILS = [
  "hafizjunaid09478@gmail.com",
  "m.ayanali051@gmail.com",
];

export function isAdminIdentity(user) {
  return Boolean(
    user?.emailVerified &&
      ADMIN_EMAILS.includes(user.email?.toLowerCase()),
  );
}
