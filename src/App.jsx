import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/auth";
import { useState } from "react";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Shell } from "./components/Storefront";
import { AccountPage, AuthPage, CartPage, CheckoutPage, HomePage, NotFoundPage, ProductPage, SellerPage, ShopPage, WishlistPage } from "./pages/MarketPages";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminPage } from "./pages/AdminPage";

function BuyerRoute({ children, requireSignIn = false }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="py-20 text-center text-stone-400">Loading your account...</div>;
  if (profile?.role === "seller") return <Navigate to="/seller" replace/>;
  if (requireSignIn && !user) return <Navigate to="/signin" replace/>;
  return children;
}

function RequiredPhonePage() {
  const { profile, updateAccount, logout } = useAuth();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (phone.replace(/\D/g, "").length < 7) {
      setError("Enter a valid phone number with at least 7 digits.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateAccount({ name: profile.name || "Fashion customer", phone });
    } catch (cause) {
      setError(cause.message || "Could not save your phone number.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-5 py-12"><form onSubmit={submit} className="w-full space-y-5 border border-line bg-panel p-6 sm:p-9"><p className="text-xs uppercase tracking-[.2em] text-gold">Complete your account</p><h1 className="font-display text-3xl">Add your phone number</h1><p className="text-sm leading-6 text-stone-400">We need a contact number for marketplace orders. You only need to provide it once.</p><label className="block text-xs text-stone-300">Phone number<input autoFocus required type="tel" autoComplete="tel" className="mt-2 min-h-12 w-full border border-line bg-ink px-4 text-sm text-cream outline-none focus:border-gold" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}<button disabled={busy} className="min-h-12 bg-gold px-5 text-sm font-semibold text-ink disabled:opacity-60">{busy ? "Saving…" : "Save and continue"}</button><button type="button" onClick={logout} className="ml-4 text-sm text-stone-400 hover:text-gold">Sign out</button></form></main>;
}

function AppRoutes() {
  const { user, profile, logout, loading } = useAuth();
  const restrictionDate = profile?.restrictedUntil?.toDate?.();
  const isRestricted = user && profile?.role !== "admin" && profile?.accountStatus === "restricted" && (!restrictionDate || restrictionDate > new Date());
  if (isRestricted) return <div className="mx-auto max-w-xl px-5 py-24 text-center"><p className="text-xs uppercase tracking-[.2em] text-gold">Account temporarily restricted</p><h1 className="mt-3 font-display text-3xl">Your access is paused.</h1><p className="mt-4 text-sm leading-6 text-stone-400">{restrictionDate ? `Your account is restricted until ${restrictionDate.toLocaleString()}.` : "Contact marketplace support for help restoring access."}</p><button className="mt-7 border border-gold/60 px-5 py-3 text-sm text-gold" onClick={logout}>Sign out</button></div>;
  if (user && loading) return <div className="py-20 text-center text-stone-400">Loading your account...</div>;
  if (user && profile && profile.role !== "admin" && !profile.phone?.trim()) return <RequiredPhonePage />;
  return <Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/shop" element={<BuyerRoute><ShopPage/></BuyerRoute>}/>
    <Route path="/product/:id" element={<ProductPage/>}/>
    <Route path="/signin" element={<AuthPage/>}/>
    <Route path="/signup" element={<AuthPage mode="signup"/>}/>
    <Route path="/seller" element={<SellerPage/>}/>
    <Route path="/admin" element={<AdminPage/>}/>
    <Route path="/account" element={<BuyerRoute requireSignIn><AccountPage/></BuyerRoute>}/>
    <Route path="/settings" element={<SettingsPage/>}/>
    <Route path="/wishlist" element={<BuyerRoute requireSignIn><WishlistPage/></BuyerRoute>}/>
    <Route path="/cart" element={<BuyerRoute><CartPage/></BuyerRoute>}/>
    <Route path="/checkout" element={<CheckoutPage/>}/>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes>;
}

export default function App() {
  return <BrowserRouter><ThemeProvider><AuthProvider><CartProvider><WishlistProvider><Shell><AppRoutes/></Shell></WishlistProvider></CartProvider></AuthProvider></ThemeProvider></BrowserRouter>;
}
