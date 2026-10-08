import { useState } from "react";
import { useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import { useCart } from "../context/cart";
import { watchCollection } from "../data/marketplace";

const navClass = ({ isActive }) => `nav-underline py-2 transition-colors ${isActive ? "text-gold" : "text-stone-300 hover:text-gold"}`;

export function Header() {
  const { user, profile, logout } = useAuth();
  const { items } = useCart();
  const navigate = useNavigate();
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [notificationState, setNotificationState] = useState({ uid: null, rows: [] });
  const seller = profile?.role === "seller";
  const admin = profile?.role === "admin";
  const currentUid = user?.uid;
  useEffect(() => {
    if (!currentUid || !["buyer", "seller"].includes(profile?.role)) return undefined;
    const field = profile.role === "seller" ? "sellerUid" : "recipientUid";
    return watchCollection("messages", (rows) => {
      setNotificationState({ uid: currentUid, rows: rows.filter((message) => message.senderRole === "admin" && message.recipientUid === currentUid) });
    }, { field, value: currentUid });
  }, [currentUid, profile?.role]);
  const notifications = notificationState.uid === currentUid ? notificationState.rows : [];
  const unreadCount = notifications.filter((message) => message.read !== true).length;
  const openNotifications = () => {
    navigate(seller ? "/seller?tab=notifications" : "/account#notifications");
    window.setTimeout(() => document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  };
  return <>
    {showAnnouncement && <div className="relative bg-gold px-12 py-2 text-center text-[10px] font-semibold tracking-[.18em] text-ink sm:text-xs">NEW SEASON ARRIVALS Â· FREE DELIVERY ON ORDERS OVER RS. 10,000<button type="button" className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center text-ink/80 hover:text-ink" aria-label="Dismiss announcement" onClick={() => setShowAnnouncement(false)}><i className="fa-solid fa-xmark"/></button></div>}
    <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="New Brand Fashion home"><span className="grid size-11 place-items-center rounded-full bg-gold font-bold text-ink">NB</span><span className="leading-tight"><b className="block text-sm tracking-widest">NEW BRAND</b><small className="mt-1 block text-[10px] tracking-[.35em] text-gold">FASHION</small></span></Link>
        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Main navigation">{admin ? <NavLink className={navClass} to="/admin">Admin dashboard</NavLink> : seller ? <><NavLink className={navClass} to="/seller">Seller studio</NavLink><NavLink className={navClass} to="/seller?tab=products">Products</NavLink><NavLink className={navClass} to="/seller?tab=orders">Orders</NavLink></> : <><NavLink className={navClass} to="/shop">Shop</NavLink><NavLink className={navClass} to="/wishlist">Wishlist</NavLink><a className="nav-underline py-2 text-stone-300 transition-colors hover:text-gold" href="/#story">Our story</a><NavLink className={navClass} to="/seller">Sell with us</NavLink></>}</nav>
        <div className="flex shrink-0 items-center gap-3 text-xs sm:gap-5 sm:text-sm">{user ? <><Link className="hidden text-stone-300 hover:text-gold sm:block" to={admin ? "/admin" : seller ? "/seller" : "/account"}>{admin ? "Admin" : seller ? "Studio" : profile?.name?.split(" ")[0] || "Account"}</Link>{!admin && <><button type="button" className="relative grid size-10 place-items-center text-stone-300 transition hover:text-gold" onClick={openNotifications} aria-label={`Notifications, ${unreadCount} unread`}><i className="fa-regular fa-bell text-base"/>{unreadCount > 0 && <span className="absolute right-0 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">{unreadCount}</span>}</button><Link className="flex items-center gap-2 text-stone-300 hover:text-gold" to="/settings" aria-label="Account settings"><i className="fa-solid fa-gear"/><span className="hidden sm:inline">Settings</span></Link></>}{!seller && !admin && <Link className="relative flex items-center gap-2 text-stone-300 hover:text-gold" to="/cart" aria-label={`Shopping bag with ${items.length} items`}><i className="fa-solid fa-bag-shopping"/><span className="hidden sm:inline">Bag</span>{items.length > 0 && <span className="grid size-4 place-items-center rounded-full bg-gold text-[10px] text-ink">{items.length}</span>}</Link>}<button className="text-stone-400 transition hover:text-gold" onClick={logout} aria-label="Sign out"><i className="fa-solid fa-arrow-right-from-bracket"/></button></> : <><Link className="text-stone-300 hover:text-gold" to="/signin">Sign in</Link><Link className="hidden border border-gold/60 px-3 py-2 text-gold transition hover:bg-gold hover:text-ink sm:block" to="/signup">Join us</Link></>}</div>
      </div>
      <nav className="flex items-center justify-center gap-6 border-t border-line/70 px-3 py-2 text-xs md:hidden">{admin ? <NavLink className={navClass} to="/admin">Admin dashboard</NavLink> : seller ? <><NavLink className={navClass} to="/seller">Studio</NavLink><NavLink className={navClass} to="/seller?tab=products">Products</NavLink><NavLink className={navClass} to="/seller?tab=orders">Orders</NavLink></> : <><NavLink className={navClass} to="/shop">Shop</NavLink><NavLink className={navClass} to="/wishlist">Wishlist</NavLink><NavLink className={navClass} to="/seller">Sell with us</NavLink></>}</nav>
    </header>
  </>;
}

export function Footer() {
  return <footer className="border-t border-line bg-panel px-5 py-10 sm:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"><Link to="/" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-gold font-bold text-ink">NB</span><span><b className="block text-xs tracking-widest">NEW BRAND</b><small className="text-[9px] tracking-[.3em] text-gold">FASHION</small></span></Link><p className="font-display text-lg italic text-stone-400">Considered essentials, made to move with you.</p><div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-stone-400"><Link className="hover:text-gold" to="/shop">Shop all</Link><Link className="hover:text-gold" to="/seller">Become a seller</Link><Link className="hover:text-gold" to="/account">Your account</Link></div></div><p className="mx-auto mt-9 max-w-7xl text-[10px] text-stone-600">Â© {new Date().getFullYear()} New Brand Fashion</p></footer>;
}

export function Shell({ children }) { return <div className="min-h-screen bg-ink text-cream"><Header/><main className="min-h-[65vh]">{children}</main><Footer/></div>; }

export function ProductCard({ product, wished = false, onToggleWish }) {
  return <article className="group min-w-0"><div className="relative aspect-[4/5] overflow-hidden bg-panel"><Link to={`/product/${product.id}`} aria-label={`View ${product.title}`}>{product.imageUrl ? <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={product.imageUrl} alt={product.title} loading="lazy"/> : <div className="grid h-full place-items-center text-5xl text-stone-600"><i className="fa-solid fa-shirt"/></div>}</Link><span className="absolute left-3 top-3 bg-ink/90 px-3 py-1.5 text-[10px] uppercase tracking-widest text-gold">{product.category || "New arrival"}</span>{onToggleWish && <button className={`absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-ink/90 text-lg transition hover:text-gold ${wished ? "text-gold" : "text-stone-300"}`} onClick={() => onToggleWish(product)} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}><i className={`${wished ? "fa-solid" : "fa-regular"} fa-heart`}/></button>}</div><Link to={`/product/${product.id}`} className="flex items-start justify-between gap-2 pt-4"><div className="min-w-0"><h3 className="truncate font-display text-lg leading-tight group-hover:text-gold">{product.title}</h3><p className="mt-1 truncate text-xs text-stone-400">by {product.sellerName || "Independent seller"}</p></div><strong className="shrink-0 text-sm font-medium">Rs. {Number(product.price || 0).toLocaleString()}</strong></Link></article>;
}

export function Stars({ value = 0 }) { return <span className="whitespace-nowrap text-gold" aria-label={`${value} out of 5 stars`}>{"â˜…".repeat(Math.round(value))}{"â˜†".repeat(5 - Math.round(value))}<small className="ml-1 font-sans text-xs text-stone-400">{value ? Number(value).toFixed(1) : "No reviews"}</small></span>; }

export function Notice({ children, kind = "info" }) { const color = kind === "error" ? "border-red-500/40 bg-red-500/10 text-red-300" : kind === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-gold/30 bg-gold/5 text-gold"; return children ? <p className={`rounded-sm border px-3 py-2 text-sm leading-relaxed ${color}`} role={kind === "error" ? "alert" : "status"}>{children}</p> : null; }

export function Loading({ label = "Loading the latest collectionâ€¦" }) { return <div className="flex items-center justify-center gap-3 py-20 text-sm text-stone-400"><span className="size-5 animate-spin rounded-full border border-gold/40 border-t-gold"/>{label}</div>; }

export function EmptyState({ title, children }) { return <div className="py-20 text-center"><h2 className="font-display text-2xl">{title}</h2><div className="mt-3 text-sm text-stone-400">{children}</div></div>; }

