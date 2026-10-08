import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/auth";
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

function AppRoutes() {
  const { user, profile, logout } = useAuth();
  const restrictionDate = profile?.restrictedUntil?.toDate?.();
  const isRestricted = user && profile?.role !== "admin" && profile?.accountStatus === "restricted" && (!restrictionDate || restrictionDate > new Date());
  if (isRestricted) return <div className="mx-auto max-w-xl px-5 py-24 text-center"><p className="text-xs uppercase tracking-[.2em] text-gold">Account temporarily restricted</p><h1 className="mt-3 font-display text-3xl">Your access is paused.</h1><p className="mt-4 text-sm leading-6 text-stone-400">{restrictionDate ? `Your account is restricted until ${restrictionDate.toLocaleString()}.` : "Contact marketplace support for help restoring access."}</p><button className="mt-7 border border-gold/60 px-5 py-3 text-sm text-gold" onClick={logout}>Sign out</button></div>;
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
