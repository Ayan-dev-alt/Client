import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import { useTheme } from "../context/theme";

const field = "mt-2 w-full border border-line bg-ink px-3 py-3 text-sm text-cream outline-none placeholder:text-stone-500 focus:border-gold";
const outline = "inline-flex min-h-11 items-center justify-center gap-2 border border-gold/60 px-4 py-2 text-sm text-gold transition hover:bg-gold hover:text-ink";

export function SettingsPage() {
  const { user, profile, loading, updateAccount, deleteAccount, hasPasswordProvider, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState(() => ({ name: profile?.name || "", phone: profile?.phone || "" }));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  if (loading) return <div className="py-20 text-center text-stone-400">Loading settings…</div>;
  if (!user) return <Navigate to="/signin?redirect=%2Fsettings" replace/>;
  if (profile?.role === "admin") return <Navigate to="/admin" replace/>;

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await updateAccount(form);
      setNotice("Your account details have been updated.");
    } catch (error) {
      setNotice(error.code === "permission-denied" ? "Firestore denied this update. Publish the included firestore.rules." : error.message || "Could not update your details.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(event) {
    event.preventDefault();
    if (deletePhrase !== "DELETE") return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAccount({ password: deletePassword });
    } catch (error) {
      setDeleteError(error.code === "permission-denied"
        ? "Firebase denied the cleanup. Publish the latest firestore.rules, then sign in again and retry."
        : error.code === "auth/requires-recent-login"
          ? "Please sign out and sign in again, then retry account deletion."
          : error.code === "auth/wrong-password" || error.code === "auth/invalid-credential"
            ? "The password you entered is incorrect."
            : error.message || "Could not delete this account.");
    } finally {
      setDeleting(false);
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-9 sm:py-14">
    <div className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-[.2em] text-gold">Your preferences</p><h1 className="font-display text-4xl">Account <em className="text-gold">settings.</em></h1><p className="mt-2 text-sm text-stone-400">Manage how your account and marketplace look.</p></div><Link to={profile?.role === "seller" ? "/seller" : "/account"} className={outline}><i className="fa-solid fa-arrow-left"/> Back to {profile?.role === "seller" ? "seller studio" : "account"}</Link></div>
    <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <form className="space-y-5 border border-line bg-panel p-5 sm:p-8" onSubmit={save}><div><p className="text-xs uppercase tracking-[.16em] text-gold">Profile</p><h2 className="mt-2 font-display text-2xl">Your details</h2></div><label className="block text-xs text-stone-300">Name<input className={field} required maxLength={80} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label className="block text-xs text-stone-300">Email address<input className={`${field} opacity-70`} readOnly value={user.email || ""}/><span className="mt-2 block text-[11px] text-stone-500">{user.emailVerified ? "Email verified" : "Email not verified"}</span></label><label className="block text-xs text-stone-300">Phone number<input className={field} type="tel" autoComplete="tel" placeholder="Add a contact number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label>{notice && <p className="text-sm text-gold" role="status">{notice}</p>}<button className="inline-flex min-h-11 items-center gap-2 bg-gold px-5 py-3 text-sm font-semibold text-ink" disabled={busy}>{busy ? "Saving…" : "Save details"}</button></form>
      <div className="space-y-6"><section className="border border-line bg-panel p-5 sm:p-8"><p className="text-xs uppercase tracking-[.16em] text-gold">Appearance</p><h2 className="mt-2 font-display text-2xl">Choose your theme</h2><p className="mt-2 text-sm leading-6 text-stone-400">Your choice is saved on this device.</p><div className="mt-5 grid grid-cols-2 gap-3">{["dark", "light"].map((option) => <button key={option} type="button" onClick={() => setTheme(option)} aria-pressed={theme === option} className={`flex min-h-16 items-center justify-center gap-2 border px-4 text-sm capitalize transition ${theme === option ? "border-gold text-gold" : "border-line text-stone-400 hover:border-gold/70"}`}><i className={`fa-solid ${option === "dark" ? "fa-moon" : "fa-sun"}`}/>{option}{theme === option && <i className="fa-solid fa-check text-xs"/>}</button>)}</div></section><section className="border border-line bg-panel p-5 sm:p-8"><p className="text-xs uppercase tracking-[.16em] text-gold">Account</p><h2 className="mt-2 font-display text-2xl">{profile?.role === "seller" ? "Seller account" : "Buyer account"}</h2><p className="mt-2 text-sm leading-6 text-stone-400">Your name and contact details are used on marketplace conversations and order details.</p><button type="button" onClick={logout} className="mt-5 text-sm text-stone-400 transition hover:text-gold">Sign out <i className="fa-solid fa-arrow-right-from-bracket ml-2"/></button></section><section className="border border-red-500/40 bg-panel p-5 sm:p-8"><p className="text-xs uppercase tracking-[.16em] text-red-400">Danger zone</p><h2 className="mt-2 font-display text-2xl">Delete account</h2><p className="mt-2 text-sm leading-6 text-stone-400">Delete your login and profile, remove your listings and messages, and erase contact details from saved orders. Order records stay for marketplace history.</p><button type="button" onClick={() => { setDeleteError(""); setDeletePhrase(""); setDeletePassword(""); setDeleteOpen(true); }} className="mt-5 border border-red-500/60 px-4 py-3 text-sm text-red-300 transition hover:bg-red-500 hover:!text-white">Delete my account</button></section></div>
    </div>
    {deleteOpen && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4"><form onSubmit={confirmDelete} role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="w-full max-w-lg space-y-4 border border-red-500/50 bg-panel p-6 shadow-2xl sm:p-8"><p className="text-xs uppercase tracking-[.18em] text-red-400">This cannot be undone</p><h2 id="delete-account-title" className="font-display text-3xl">Delete your account?</h2><p className="text-sm leading-6 text-stone-300">Your login, profile, listings and messages will be removed. Order history stays in the marketplace, with your buyer contact details erased.</p>{hasPasswordProvider && <label className="block text-xs text-stone-300">Current password<input className={field} required type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)}/></label>}<label className="block text-xs text-stone-300">Type <strong className="text-red-300">DELETE</strong> to confirm<input className={field} required autoComplete="off" value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} placeholder="DELETE"/></label>{deleteError && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{deleteError}</p>}<div className="flex flex-wrap justify-end gap-3 pt-2"><button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)} className="border border-line px-4 py-3 text-sm text-stone-300 hover:bg-ink">Cancel</button><button disabled={deleting || deletePhrase !== "DELETE"} className="bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? "Deleting account…" : "Permanently delete"}</button></div></form></div>}
  </main>;
}
