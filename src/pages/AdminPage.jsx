import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import { useTheme } from "../context/theme";
import {
  setProductVisibility,
  setReviewVisibility,
  sendMessage,
  setUserRestriction,
  watchCollection,
} from "../data/marketplace";
import { EmptyState, Loading, Notice, Stars } from "../components/Storefront";
import { ADMIN_EMAILS } from "../data/roles";
import { isAdminIdentity } from "../data/roles";
import { permanentlyDeleteUser } from "../data/admin";

const button =
  "border border-gold/50 px-3 py-2 text-xs text-gold transition hover:bg-gold hover:text-ink";

function useAdminCollection(name, enabled) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return undefined;
    let receivedSnapshot = false;
    const timeout = window.setTimeout(() => {
      if (receivedSnapshot) return;
      setRows([]);
      setError(
        `Could not load ${name} yet. Check your Firebase connection and Firestore rules.`,
      );
    }, 8_000);
    const unsubscribe = watchCollection(
      name,
      (items) => {
        receivedSnapshot = true;
        window.clearTimeout(timeout);
        setRows(items);
        setError("");
      },
      {
        onError: (cause) => {
          window.clearTimeout(timeout);
          setRows([]);
          setError(
            cause.code === "permission-denied"
              ? "Admin page is open, but Firestore denied dashboard data. Publish the latest firestore.rules."
              : `Could not load ${name}. Check your Firebase connection.`,
          );
        },
      },
    );
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, [name, enabled]);
  return { rows: rows || [], loading: rows === null, error };
}

function Metric({ title, value, detail }) {
  return (
    <article className="border border-line bg-panel p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[.15em] text-stone-400">
        {title}
      </p>
      <strong className="mt-3 block font-display text-3xl text-gold">
        {value}
      </strong>
      {detail && <p className="mt-1 text-xs text-stone-500">{detail}</p>}
    </article>
  );
}

function dateOf(value) {
  return value?.toDate?.().toLocaleDateString() || "â€”";
}

function millis(value) {
  return (
    value?.toDate?.().getTime?.() || (value?.seconds ? value.seconds * 1000 : 0)
  );
}

function onlineAt(person, now) {
  const seenAt = millis(person.lastSeen);
  return person.isOnline === true && seenAt > 0 && now - seenAt < 2 * 60_000;
}

function expiryAfterDays(days) {
  return new Date(Date.now() + days * 86400000);
}

function AdminChatList({ messages }) {
  const [activeId, setActiveId] = useState("");
  const threads = Object.values(
    messages
      .filter((item) => item.chatType === "conversation")
      .reduce((groups, item) => {
        const key =
          item.conversationId ||
          `${item.buyerUid}_${item.sellerUid}_${item.id}`;
        (groups[key] ||= []).push(item);
        return groups;
      }, {}),
  ).map((items) =>
    items.sort((a, b) => millis(a.createdAt) - millis(b.createdAt)),
  );
  const active = threads.find(
    (thread) =>
      (thread[0].conversationId ||
        `${thread[0].buyerUid}_${thread[0].sellerUid}_${thread[0].id}`) ===
      activeId,
  );
  const productsDiscussed = active
    ? [
        ...new Map(
          active
            .filter((item) => item.productTitle)
            .map((item) => [item.productId || item.productTitle, item]),
        ).values(),
      ]
    : [];
  return (
    <>
      <section>
        <p className="mb-2 text-xs uppercase tracking-[.18em] text-gold">
          Buyer and seller messages
        </p>
        <h2 className="mb-5 font-display text-2xl">Talks ({threads.length})</h2>
        <div className="space-y-3">
          {threads.map((thread) => {
            const last = thread[thread.length - 1];
            const key =
              thread[0].conversationId ||
              `${thread[0].buyerUid}_${thread[0].sellerUid}_${thread[0].id}`;
            return (
              <article
                key={key}
                className="flex flex-wrap items-center justify-between gap-4 border border-line bg-panel p-4"
              >
                <div className="min-w-0">
                  <strong className="block">
                    Talk between {thread[0].buyerName || "Buyer"} and{" "}
                    {thread[0].sellerName || "Seller"}
                  </strong>
                  <p className="mt-1 truncate text-sm text-stone-400">
                    {last.text}
                  </p>
                  {last.productTitle && (
                    <span className="mt-2 inline-block border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-wider text-gold">
                      Product: {last.productTitle}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveId(key)}
                  className="shrink-0 text-sm text-gold hover:text-cream"
                >
                  See the talk <i className="fa-solid fa-arrow-right ml-1" />
                </button>
              </article>
            );
          })}
        </div>
        {!threads.length && <EmptyState title="No conversations yet." />}
      </section>
      {active && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-3 sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-chat-title"
            className="flex h-[min(88vh,760px)] w-full max-w-3xl flex-col border border-line bg-panel shadow-2xl"
          >
            <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-[.16em] text-gold">
                  Conversation history
                </p>
                <h2 id="admin-chat-title" className="mt-1 font-display text-xl">
                  Talk between {active[0].buyerName || "Buyer"} and{" "}
                  {active[0].sellerName || "Seller"}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {productsDiscussed.map((product) =>
                    product.productId ? (
                      <Link
                        key={product.productId}
                        to={`/product/${product.productId}`}
                        className="border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-wider text-gold hover:border-gold"
                      >
                        Product: {product.productTitle}
                      </Link>
                    ) : (
                      <span
                        key={product.productTitle}
                        className="border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-wider text-gold"
                      >
                        Product: {product.productTitle}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveId("")}
                aria-label="Close conversation"
                className="grid size-10 place-items-center text-stone-400 hover:text-gold"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-ink/40 p-4 sm:p-6">
              {active.map((item) => (
                <article
                  key={item.id}
                  className={`max-w-[85%] rounded-lg px-4 py-3 ${item.senderRole === "seller" ? "ml-auto bg-gold/15" : "bg-panel"}`}
                >
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-gold">
                    {item.senderRole === "seller"
                      ? active[0].sellerName || "Seller"
                      : active[0].buyerName || "Buyer"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-stone-200">
                    {item.text}
                  </p>
                  <p className="mt-2 text-right text-[10px] text-stone-500">
                    {item.createdAt?.toDate?.().toLocaleString?.() ||
                      "Just now"}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function AdminPage() {
  const {
    user,
    profile,
    hasPasswordProvider,
    setAdminPassword,
    loading: authLoading,
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const adminAccess = isAdminIdentity(user);
  const users = useAdminCollection("users", adminAccess);
  const products = useAdminCollection("products", adminAccess);
  const reviews = useAdminCollection("reviews", adminAccess);
  const orders = useAdminCollection("orders", adminAccess);
  const messages = useAdminCollection("messages", adminAccess);
  const [tab, setTab] = useState("overview");
  const tabsRailRef = useRef(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [messageTarget, setMessageTarget] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordLinked, setPasswordLinked] = useState(null);
  const [presenceNow, setPresenceNow] = useState(0);
  useEffect(() => {
    const initial = window.setTimeout(() => setPresenceNow(Date.now()), 0);
    const timer = window.setInterval(() => setPresenceNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);
  const hasPassword = passwordLinked ?? hasPasswordProvider;
  const people = useMemo(() => {
    const marketplaceUsers = users.rows.filter(
      (person) => !ADMIN_EMAILS.includes(person.email?.toLowerCase()),
    );
    const groupByIdentity = (role) => {
      const groups = new Map();
      for (const person of marketplaceUsers.filter(
        (item) => item.role === role,
      )) {
        const key = person.email?.trim().toLowerCase() || person.id;
        const group = groups.get(key) || {
          ...person,
          accountIds: [],
          accounts: [],
        };
        group.accountIds.push(person.id);
        group.accounts.push(person);
        groups.set(key, group);
      }
      return [...groups.values()].map((group) => {
        const latest = [...group.accounts].sort(
          (a, b) => millis(b.lastSeen) - millis(a.lastSeen),
        )[0];
        const restricted = group.accounts.find(
          (person) =>
            person.accountStatus === "restricted" &&
            (!person.restrictedUntil?.toDate ||
              person.restrictedUntil.toDate().getTime() > presenceNow),
        );
        return {
          ...group,
          isOnline: group.accounts.some((person) =>
            onlineAt(person, presenceNow),
          ),
          lastSeen: latest?.lastSeen || group.lastSeen,
          phone:
            group.accounts.find((person) => person.phone)?.phone || group.phone,
          accountStatus: restricted ? "restricted" : "active",
          restrictedUntil: restricted?.restrictedUntil || null,
        };
      });
    };
    return {
      buyers: groupByIdentity("buyer"),
      sellers: groupByIdentity("seller"),
    };
  }, [users.rows, presenceNow]);
  const suspendedCount = [...people.buyers, ...people.sellers].filter(
    (person) => person.accountStatus === "restricted",
  ).length;
  const activeCount = [...people.buyers, ...people.sellers].filter(
    (person) =>
      person.accountStatus !== "restricted" && onlineAt(person, presenceNow),
  ).length;
  const orderByBuyer = useMemo(() => {
    const map = new Map();
    for (const order of orders.rows)
      if (order.buyerUid && !map.has(order.buyerUid))
        map.set(order.buyerUid, order);
    return map;
  }, [orders.rows]);

  if (authLoading) return <Loading label="Checking admin accessâ€¦" />;
  if (!user) return <Navigate to="/signin?redirect=%2Fadmin" replace />;
  if (profile?.role !== "admin")
    return (
      <Navigate to={profile?.role === "seller" ? "/seller" : "/"} replace />
    );

  const run = async (key, action, done) => {
    setBusy(key);
    setNotice("");
    try {
      await action();
      setNotice(done);
    } catch (error) {
      setNotice(
        error.code === "permission-denied"
          ? "Firestore denied this admin action. Publish the included firestore.rules."
          : error.message || "Action failed. Try again.",
      );
    } finally {
      setBusy("");
    }
  };
  const restrict = (person, days) => {
    const until = days ? expiryAfterDays(days) : null;
    const label = days
      ? `${person.name || person.email} restricted for ${days} days.`
      : `${person.name || person.email} restriction removed.`;
    run(
      `user-${person.id}`,
      () =>
        Promise.all(
          (person.accountIds || [person.id]).map((uid) =>
            setUserRestriction(uid, until),
          ),
        ),
      label,
    );
  };
  const sendAdminMessage = async (event) => {
    event.preventDefault();
    if (!messageTarget || !messageText.trim()) return;
    setBusy(`message-${messageTarget.id}`);
    try {
      const recipientIsSeller = messageTarget.role === "seller";
      for (const recipientUid of messageTarget.accountIds || [
        messageTarget.id,
      ]) {
        await sendMessage({
          buyerUid: recipientIsSeller ? user.uid : recipientUid,
          sellerUid: recipientIsSeller ? recipientUid : user.uid,
          buyerName: recipientIsSeller
            ? profile.name || "Marketplace Admin"
            : messageTarget.name,
          buyerEmail: recipientIsSeller ? user.email : messageTarget.email,
          sellerName: recipientIsSeller
            ? messageTarget.name
            : profile.name || "Marketplace Admin",
          sellerEmail: recipientIsSeller ? messageTarget.email : user.email,
          senderUid: user.uid,
          senderName: profile.name || "Marketplace Admin",
          senderEmail: user.email,
          senderRole: "admin",
          recipientUid,
          text: messageText.trim(),
          productTitle: "Message from marketplace admin",
        });
      }
      setNotice(
        `Message sent to ${messageTarget.name || messageTarget.email}.`,
      );
      setMessageTarget(null);
      setMessageText("");
    } catch (error) {
      setNotice(error.message || "Could not send the message.");
    } finally {
      setBusy("");
    }
  };
  const permanentlyDelete = async () => {
    if (!deleteTarget) return;
    setBusy(`delete-${deleteTarget.id}`);
    try {
      for (const uid of deleteTarget.accountIds || [deleteTarget.id]) {
        await permanentlyDeleteUser({ uid });
      }
      setNotice(
        `${deleteTarget.name || deleteTarget.email} was permanently deleted.`,
      );
      setDeleteTarget(null);
      setDeletePhrase("");
    } catch (error) {
      setNotice(
        error.code === "functions/not-found"
          ? "Account deletion service is not deployed. Deploy Firebase Functions, then retry."
          : error.message || "Could not permanently delete this account.",
      );
    } finally {
      setBusy("");
    }
  };
  const tabs = [
    "overview",
    "sellers",
    "buyers",
    "products",
    "reviews",
    "orders",
    "chats",
    "settings",
  ];
  const loading =
    users.loading && products.loading && reviews.loading && orders.loading;
  const pendingCollections = [users, products, reviews, orders].some(
    (collection) => collection.loading,
  );
  const error = [
    users.error,
    products.error,
    reviews.error,
    orders.error,
    messages.error,
  ].find(Boolean);
  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordNotice("");
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordNotice("New password and confirmation do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      await setAdminPassword({
        password: passwordForm.next,
        currentPassword: passwordForm.current,
      });
      setPasswordNotice(
        hasPassword
          ? "Admin password changed."
          : "Password added to your verified Google account.",
      );
      setPasswordLinked(true);
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (cause) {
      setPasswordNotice(
        cause.code === "auth/credential-already-in-use"
          ? "This email already has a password account. Sign in with that account or use its current password to change it."
          : cause.code === "auth/wrong-password" ||
              cause.code === "auth/invalid-credential"
            ? "The current password is incorrect."
            : cause.message || "Could not save the password.",
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-9 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[.2em] text-gold">
            Marketplace control
          </p>
          <h1 className="font-display text-4xl">
            Admin <em className="text-gold">dashboard.</em>
          </h1>
          <p className="mt-2 text-sm text-stone-400">
            Accounts, listings, feedback, and order activity in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="border border-gold/40 px-3 py-2 text-xs text-gold">
            Signed in as {profile.name || user.email}
          </span>
          <button
            type="button"
            className={`${button} ${tab === "settings" ? "bg-gold text-ink" : ""}`}
            onClick={() => setTab("settings")}
            aria-current={tab === "settings" ? "page" : undefined}
          >
            ⚙ Settings
          </button>
        </div>
      </div>
      {error && (
        <div className="mb-6">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      {notice && (
        <div className="mb-5 border border-line bg-panel p-3">
          <Notice>{notice}</Notice>
        </div>
      )}
      {loading ? (
        <Loading label="Loading marketplace data…" />
      ) : (
        <>
          {pendingCollections && (
            <p className="mb-5 text-sm text-stone-400" role="status">
              Loading the remaining marketplace data…
            </p>
          )}
          {tab === "settings" && (
            <div className="mb-8 grid max-w-4xl gap-5">
              <div className="flex justify-end">
                <button
                  type="button"
                  className={button}
                  onClick={() => setTab("overview")}
                >
                  ← Back to account
                </button>
              </div>
              <section className="border border-line bg-panel p-5 sm:p-6">
                <p className="text-xs uppercase tracking-[.16em] text-gold">
                  Appearance
                </p>
                <h2 className="mt-1 font-display text-xl">Theme preference</h2>
                <p className="mt-1 text-xs text-stone-400">
                  Choose how the marketplace looks on this device.
                </p>
                <div className="mt-4 grid max-w-sm grid-cols-2 gap-3">
                  {[
                    { value: "light", label: "Light theme", icon: "☀" },
                    { value: "dark", label: "Dark theme", icon: "☾" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={theme === option.value}
                      onClick={() => setTheme(option.value)}
                      className={`border px-4 py-3 text-sm transition hover:cursor-pointer ${theme === option.value ? "border-gold bg-gold/15 text-gold" : "border-line text-stone-300 hover:border-gold/60"}`}
                    >
                      <span className="mr-2" aria-hidden="true">
                        {option.icon}
                      </span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>
              <form
                onSubmit={savePassword}
                className="grid gap-4 border border-line bg-panel p-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end sm:p-6"
              >
                <div className="sm:col-span-4">
                  <p className="text-xs uppercase tracking-[.16em] text-gold">
                    Admin account security
                  </p>
                  <h2 className="mt-1 font-display text-xl">
                    {hasPassword
                      ? "Change your password"
                      : "Add a password to Google sign-in"}
                  </h2>
                  <p className="mt-1 text-xs text-stone-400">
                    Verified email: {user.email}.{" "}
                    {hasPassword
                      ? "Confirm with your current password."
                      : "Google will ask you to confirm your account before linking a password."}
                  </p>
                </div>
                {hasPassword && (
                  <label className="block text-xs text-stone-300">
                    Current password
                    <input
                      className="mt-2 w-full border border-stone-700 bg-ink px-3 py-3 text-sm outline-none focus:border-gold"
                      required
                      type="password"
                      autoComplete="current-password"
                      value={passwordForm.current}
                      onChange={(event) =>
                        setPasswordForm({
                          ...passwordForm,
                          current: event.target.value,
                        })
                      }
                    />
                  </label>
                )}
                <label className="block text-xs text-stone-300">
                  New password
                  <input
                    className="mt-2 w-full border border-stone-700 bg-ink px-3 py-3 text-sm outline-none focus:border-gold"
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.next}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        next: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="block text-xs text-stone-300">
                  Confirm password
                  <input
                    className="mt-2 w-full border border-stone-700 bg-ink px-3 py-3 text-sm outline-none focus:border-gold"
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.confirm}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirm: event.target.value,
                      })
                    }
                  />
                </label>
                <button className={button} disabled={passwordBusy}>
                  {passwordBusy
                    ? "Saving…"
                    : hasPassword
                      ? "Change password"
                      : "Set password"}
                </button>
                {passwordNotice && (
                  <p className="text-sm text-gold sm:col-span-4" role="status">
                    {passwordNotice}
                  </p>
                )}
              </form>
            </div>
          )}
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Metric
              title="Sellers"
              value={people.sellers.length}
              detail="Unique seller profiles"
            />
            <Metric
              title="Buyers"
              value={people.buyers.length}
              detail="Unique buyer profiles"
            />
            <Metric
              title="Products"
              value={products.rows.length}
              detail={`${products.rows.filter((item) => item.active !== false).length} visible in shop`}
            />
            <Metric
              title="Reviews"
              value={reviews.rows.length}
              detail={`${reviews.rows.filter((item) => !item.hidden).length} published reviews`}
            />
            <Metric
              title="Active accounts"
              value={activeCount}
              detail="Live buyer and seller accounts"
            />
            <Metric
              title="Suspended"
              value={suspendedCount}
              detail="Currently restricted accounts"
            />
          </div>
          <div className="relative mb-6 border-b border-line">
            <button
              type="button"
              aria-label="Scroll tabs left"
              onClick={() =>
                tabsRailRef.current?.scrollBy({
                  left: -180,
                  behavior: "smooth",
                })
              }
              className="absolute left-0 top-1/2 z-20 grid size-8 -translate-y-1/2 place-items-center bg-transparent text-gold md:hidden"
            >
              <i className="fa-solid fa-arrow-left" />
            </button>
            <div
              ref={tabsRailRef}
              className="flex gap-5 overflow-x-auto px-9 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-0"
            >
              {tabs.map((item) => (
                <button
                  key={item}
                  className={`shrink-0 border-b-2 px-1 py-3 text-sm capitalize ${tab === item ? "border-gold text-gold" : "border-transparent text-stone-400 hover:text-cream"}`}
                  onClick={() => setTab(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Scroll tabs right"
              onClick={() =>
                tabsRailRef.current?.scrollBy({ left: 180, behavior: "smooth" })
              }
              className="absolute right-0 top-1/2 z-20 grid size-8 -translate-y-1/2 place-items-center bg-transparent text-gold md:hidden"
            >
              <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
          {tab === "overview" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="border border-line bg-panel p-5 sm:p-7">
                <p className="text-xs uppercase tracking-[.16em] text-gold">
                  Marketplace health
                </p>
                <h2 className="mt-2 font-display text-2xl">
                  Activity snapshot
                </h2>
                <div className="mt-5 space-y-4 text-sm">
                  <p className="flex justify-between border-b border-line pb-3">
                    <span className="text-stone-400">Orders placed</span>
                    <strong>{orders.rows.length}</strong>
                  </p>
                  <p className="flex justify-between border-b border-line pb-3">
                    <span className="text-stone-400">Open orders</span>
                    <strong>
                      {
                        orders.rows.filter(
                          (order) =>
                            !["completed", "cancelled"].includes(order.status),
                        ).length
                      }
                    </strong>
                  </p>
                  <p className="flex justify-between border-b border-line pb-3">
                    <span className="text-stone-400">Restricted accounts</span>
                    <strong>{suspendedCount}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-stone-400">Hidden products</span>
                    <strong>
                      {
                        products.rows.filter((item) => item.active === false)
                          .length
                      }
                    </strong>
                  </p>
                </div>
              </section>
              <section className="border border-line bg-panel p-5 sm:p-7">
                <p className="text-xs uppercase tracking-[.16em] text-gold">
                  Seller ratings
                </p>
                <h2 className="mt-2 font-display text-2xl">
                  Reviews by seller
                </h2>
                <div className="mt-4 divide-y divide-line">
                  {people.sellers.map((seller) => {
                    const listed = products.rows.filter((item) =>
                      (seller.accountIds || [seller.id]).includes(
                        item.sellerUid,
                      ),
                    );
                    const feedback = reviews.rows.filter(
                      (item) =>
                        listed.some(
                          (product) => product.id === item.productId,
                        ) && !item.hidden,
                    );
                    const rating = feedback.length
                      ? feedback.reduce(
                          (sum, item) => sum + Number(item.rating || 0),
                          0,
                        ) / feedback.length
                      : 0;
                    return (
                      <div
                        className="flex items-center justify-between gap-3 py-3"
                        key={seller.id}
                      >
                        <div className="min-w-0">
                          <strong className="block truncate text-sm">
                            {seller.name || "Seller"}
                          </strong>
                          <span className="text-xs text-stone-500">
                            {listed.length} products Â· {feedback.length}{" "}
                            reviews
                          </span>
                        </div>
                        <Stars value={rating} />
                      </div>
                    );
                  })}
                  {!people.sellers.length && (
                    <EmptyState title="No sellers yet." />
                  )}
                </div>
              </section>
            </div>
          )}
          {tab === "chats" && <AdminChatList messages={messages.rows} />}
          {["sellers", "buyers"].includes(tab) && (
            <section>
              <h2 className="mb-4 font-display text-2xl capitalize">
                {tab} (
                {tab === "sellers"
                  ? people.sellers.length
                  : people.buyers.length}
                )
              </h2>
              <div className="overflow-x-auto border border-line">
                <table className="w-full min-w-190 text-left text-sm">
                  <thead className="bg-panel text-xs uppercase tracking-wider text-stone-400">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Joined / activity</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Moderation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(tab === "sellers" ? people.sellers : people.buyers).map(
                      (person) => {
                        const order = (person.accountIds || [person.id])
                          .map((uid) => orderByBuyer.get(uid))
                          .find(Boolean);
                        const restricted =
                          person.accountStatus === "restricted";
                        const phone =
                          person.phone || order?.phone || "Not provided";
                        const online = onlineAt(person, presenceNow);
                        return (
                          <tr key={person.id}>
                            <td className="p-4 font-medium">
                              {person.name || "â€”"}
                            </td>
                            <td className="p-4 text-stone-300">
                              {person.email || "â€”"}
                            </td>
                            <td className="p-4 text-stone-300">{phone}</td>
                            <td className="p-4 text-stone-400">
                              {dateOf(person.createdAt)}
                              {order && (
                                <span className="block text-xs">
                                  Last order: {dateOf(order.createdAt)}
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <span
                                className={
                                  restricted
                                    ? "text-red-300"
                                    : online
                                      ? "text-green-300"
                                      : "text-stone-400"
                                }
                              >
                                {restricted
                                  ? "Suspended"
                                  : online
                                    ? "Online"
                                    : "Offline"}
                              </span>
                              {restricted && (
                                <small className="block text-stone-500">
                                  until {dateOf(person.restrictedUntil)}
                                </small>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-2">
                                {restricted ? (
                                  <button
                                    className={button}
                                    disabled={busy === `user-${person.id}`}
                                    onClick={() => restrict(person, 0)}
                                  >
                                    Restore
                                  </button>
                                ) : (
                                  <button
                                    className={button}
                                    disabled={busy === `user-${person.id}`}
                                    onClick={() => restrict(person, 30)}
                                  >
                                    Suspend
                                  </button>
                                )}
                                <button
                                  className={button}
                                  onClick={() => {
                                    setMessageTarget(person);
                                    setMessageText("");
                                  }}
                                >
                                  Message
                                </button>
                                <button
                                  className="border border-red-500/50 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500 hover:text-white"
                                  onClick={() => {
                                    setDeletePhrase("");
                                    setDeleteTarget(person);
                                  }}
                                >
                                  Delete permanently
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
                {!(tab === "sellers" ? people.sellers : people.buyers)
                  .length && <EmptyState title={`No ${tab} registered yet.`} />}
              </div>
              <p className="mt-3 text-xs text-stone-500">
                New signups provide a phone number; existing users can add one
                in settings. Account status updates live. Suspensions preserve
                account history.
              </p>
            </section>
          )}
          {tab === "products" && (
            <section>
              <h2 className="mb-4 font-display text-2xl">
                Products ({products.rows.length})
              </h2>
              <div className="divide-y divide-line border-y border-line">
                {products.rows.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-wrap items-center gap-4 py-4"
                  >
                    <div className="size-14 shrink-0 bg-panel">
                      {item.imageUrl && (
                        <img
                          className="h-full w-full object-cover"
                          src={item.imageUrl}
                          alt=""
                        />
                      )}
                    </div>
                    <div className="min-w-48 flex-1">
                      <strong>{item.title || "Untitled product"}</strong>
                      <p className="mt-1 text-xs text-stone-400">
                        {item.sellerName || item.sellerUid} Â· Rs.{" "}
                        {Number(item.price || 0).toLocaleString()} Â·{" "}
                        {item.category || "Uncategorized"}
                      </p>
                    </div>
                    <span
                      className={
                        item.active === false
                          ? "text-red-300"
                          : "text-green-300"
                      }
                    >
                      {item.active === false ? "Hidden" : "Visible"}
                    </span>
                    <button
                      className={button}
                      disabled={busy === `product-${item.id}`}
                      onClick={() =>
                        run(
                          `product-${item.id}`,
                          () =>
                            setProductVisibility(
                              item.id,
                              item.active === false,
                            ),
                          item.active === false
                            ? "Product restored to the shop."
                            : "Product hidden from the shop.",
                        )
                      }
                    >
                      {item.active === false ? "Restore" : "Hide listing"}
                    </button>
                  </article>
                ))}
                {!products.rows.length && (
                  <EmptyState title="No products yet." />
                )}
              </div>
            </section>
          )}
          {tab === "reviews" && (
            <section>
              <h2 className="mb-4 font-display text-2xl">
                Reviews ({reviews.rows.length})
              </h2>
              <div className="space-y-3">
                {reviews.rows.map((item) => {
                  const product = products.rows.find(
                    (entry) => entry.id === item.productId,
                  );
                  return (
                    <article
                      key={item.id}
                      className="border border-line bg-panel p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <Stars value={Number(item.rating || 0)} />
                          <p className="mt-2 text-xs text-stone-400">
                            {product?.title || "Product removed"} Â·{" "}
                            {item.buyerName || item.buyerUid || "Buyer"} Â·{" "}
                            {dateOf(item.createdAt)}
                          </p>
                        </div>
                        <button
                          className={button}
                          disabled={busy === `review-${item.id}`}
                          onClick={() =>
                            run(
                              `review-${item.id}`,
                              () => setReviewVisibility(item.id, !item.hidden),
                              item.hidden
                                ? "Review restored."
                                : "Review hidden.",
                            )
                          }
                        >
                          {item.hidden ? "Restore review" : "Hide review"}
                        </button>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-stone-200">
                        {item.text}
                      </p>
                    </article>
                  );
                })}
                {!reviews.rows.length && <EmptyState title="No reviews yet." />}
              </div>
            </section>
          )}
          {tab === "orders" && (
            <section>
              <h2 className="mb-4 font-display text-2xl">
                Orders ({orders.rows.length})
              </h2>
              <div className="space-y-3">
                {orders.rows.map((order) => (
                  <article
                    className="border border-line bg-panel p-4 sm:p-5"
                    key={order.id}
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <strong>
                          Order {order.id.slice(-7).toUpperCase()} Â·{" "}
                          {order.buyerName || "Buyer"}
                        </strong>
                        <p className="mt-1 text-xs text-stone-400">
                          {order.buyerEmail || ""} Â·{" "}
                          {order.phone || "No phone"} Â·{" "}
                          {dateOf(order.createdAt)}
                        </p>
                      </div>
                      <span className="text-xs capitalize text-gold">
                        {order.status || "new"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-stone-300">
                      {order.items
                        ?.map((item) => `${item.title} Ã— ${item.quantity}`)
                        .join(", ")}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      {order.address || ""}
                    </p>
                    <strong className="mt-2 block text-sm">
                      Rs. {Number(order.total || 0).toLocaleString()}
                    </strong>
                  </article>
                ))}
                {!orders.rows.length && <EmptyState title="No orders yet." />}
              </div>
            </section>
          )}
        </>
      )}
      {messageTarget && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4">
          <form
            onSubmit={sendAdminMessage}
            className="w-full max-w-xl space-y-4 border border-line bg-panel p-6 shadow-2xl sm:p-8"
          >
            <p className="text-xs uppercase tracking-[.18em] text-gold">
              Admin message
            </p>
            <h2 className="font-display text-2xl">
              Send to {messageTarget.name || messageTarget.email}
            </h2>
            <p className="text-xs text-stone-400">
              {messageTarget.email} Â· {messageTarget.role}
            </p>
            <textarea
              className="mt-2 w-full border border-line bg-ink px-3 py-3 text-sm text-cream outline-none focus:border-gold"
              rows={5}
              maxLength={2000}
              required
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Write a message to this accountâ€¦"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="border border-line px-4 py-2 text-sm text-stone-300"
                onClick={() => setMessageTarget(null)}
              >
                Cancel
              </button>
              <button
                className={button}
                disabled={
                  busy === `message-${messageTarget.id}` || !messageText.trim()
                }
              >
                {busy === `message-${messageTarget.id}`
                  ? "Sendingâ€¦"
                  : "Send message"}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-delete-title"
            className="w-full max-w-xl space-y-4 border border-red-500/50 bg-panel p-6 shadow-2xl sm:p-8"
          >
            <p className="text-xs uppercase tracking-[.18em] text-red-400">
              Permanent deletion
            </p>
            <h2 id="admin-delete-title" className="font-display text-2xl">
              Delete {deleteTarget.name || deleteTarget.email}?
            </h2>
            <p className="text-sm leading-6 text-stone-300">
              This permanently removes their Firebase login, profile, listings,
              reviews, messages, wishlist and related orders. They cannot sign
              back into this account.
            </p>
            <label className="block text-xs text-stone-300">
              Type <strong className="text-red-300">DELETE</strong> to confirm
              <input
                className="mt-2 w-full border border-line bg-ink px-3 py-3 text-sm text-cream outline-none focus:border-red-400"
                value={deletePhrase}
                onChange={(event) => setDeletePhrase(event.target.value)}
                placeholder="DELETE"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={busy === `delete-${deleteTarget.id}`}
                className="border border-line px-4 py-2 text-sm text-stone-300"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="border border-red-500/50 bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  busy === `delete-${deleteTarget.id}` ||
                  deletePhrase !== "DELETE"
                }
                onClick={permanentlyDelete}
              >
                {busy === `delete-${deleteTarget.id}`
                  ? "Deletingâ€¦"
                  : "Permanently delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
