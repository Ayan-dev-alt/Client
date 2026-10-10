import { useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../context/auth";
import { useCart } from "../context/cart";
import { useWishlist } from "../context/wishlist";
import { isAdminIdentity } from "../data/roles";
import {
  addProduct,
  addReview,
  createOrder,
  deleteMessage,
  markMessageRead,
  removeProduct,
  sendMessage,
  setOrderStatus,
  setProductVisibility,
  updateProduct,
  watchCollection,
} from "../data/marketplace";
import {
  EmptyState,
  Loading,
  Notice,
  ProductCard,
  Stars,
} from "../components/Storefront";

function useLive(name, field, value, operator) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (field && !value) return undefined;
    return watchCollection(
      name,
      (rows) => {
        setData(rows);
        setError("");
      },
      {
        ...(field ? { field, value, operator } : {}),
        onError: (cause) =>
          setError(
            cause.code === "permission-denied"
              ? "Firestore denied access. Publish the included firestore.rules in your Firebase project."
              : "Could not connect to Firestore. Check your Firebase project and internet connection.",
          ),
      },
    );
  }, [name, field, value, operator]);
  return { data: data || [], loading: data === null, error };
}

function AdminNotifications({ items }) {
  const [deleting, setDeleting] = useState("");
  const [error, setError] = useState("");
  const sectionRef = useRef(null);
  const sorted = [...items].sort((a, b) => {
    const aTime =
      a.createdAt?.toDate?.().getTime() || a.createdAt?.seconds * 1000 || 0;
    const bTime =
      b.createdAt?.toDate?.().getTime() || b.createdAt?.seconds * 1000 || 0;
    return bTime - aTime;
  });
  useEffect(() => {
    if (!items.some((item) => item.read !== true) || !sectionRef.current)
      return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        items
          .filter((item) => item.read !== true)
          .forEach((item) => {
            markMessageRead(item.id).catch((cause) =>
              setError(cause.message || "Could not mark notification as read."),
            );
          });
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [items]);
  const remove = async (id) => {
    setDeleting(id);
    setError("");
    try {
      await deleteMessage(id);
    } catch (cause) {
      setError(
        cause.code === "permission-denied"
          ? "Firestore denied this action. Publish the latest firestore.rules."
          : cause.message || "Could not delete the notification.",
      );
    } finally {
      setDeleting("");
    }
  };

  return (
    <section
      ref={sectionRef}
      id="notifications"
      className="mt-8 max-w-2xl scroll-mt-28 border border-line bg-panel p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.16em] text-gold">
            Marketplace updates
          </p>
          <h2 className="mt-1 font-display text-xl">
            Notifications{" "}
            <span className="text-sm text-stone-400">({sorted.length})</span>
          </h2>
        </div>
        {sorted.length > 0 && (
          <span className="text-[10px] text-stone-500">Newest first</span>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {error}
        </p>
      )}
      {sorted.length ? (
        <div className="mt-3 space-y-2">
          {sorted.map((item) => (
            <article
              key={item.id}
              className="flex items-start gap-3 border border-line px-3 py-2.5"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gold/10 text-xs text-gold">
                <i className="fa-regular fa-bell" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <strong className="truncate text-xs font-medium">
                    From Admin
                  </strong>
                  <span className="text-[10px] text-stone-500">
                    {item.createdAt?.toDate?.().toLocaleString?.() ||
                      "Just now"}
                  </span>
                </div>
                <details className="group mt-1">
                  <summary className="line-clamp-2 cursor-pointer list-none text-xs leading-5 text-stone-300">
                    {item.text}
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap border-t border-line pt-2 text-xs leading-5 text-stone-300">
                    {item.text}
                  </p>
                </details>
              </div>
              <button
                type="button"
                className="grid size-8 shrink-0 place-items-center rounded text-stone-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                disabled={deleting === item.id}
                onClick={() => remove(item.id)}
                aria-label="Delete notification"
                title="Delete notification"
              >
                {deleting === item.id ? (
                  <i className="fa-solid fa-spinner animate-spin text-xs" />
                ) : (
                  <i className="fa-regular fa-trash-can text-sm" />
                )}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 border border-dashed border-line px-3 py-4 text-xs text-stone-400">
          You’re all caught up. New admin notifications will appear here.
        </p>
      )}
    </section>
  );
}

const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-3 bg-gold px-6 py-3 text-sm font-semibold text-ink transition hover:bg-[#e4c374] disabled:cursor-not-allowed disabled:opacity-50";
const outlineButton =
  "inline-flex min-h-11 items-center justify-center gap-2 border border-gold/60 px-5 py-2.5 text-sm text-gold transition hover:bg-gold hover:text-ink";
const fieldClass =
  "mt-2 w-full border border-stone-700 bg-panel px-3 py-3 text-sm text-cream outline-none transition placeholder:text-stone-600 focus:border-gold";

function PageFrame({ children, className = "" }) {
  return (
    <div
      className={`mx-auto w-full max-w-7xl px-5 py-12 sm:px-9 sm:py-16 ${className}`}
    >
      {children}
    </div>
  );
}
function PageTitle({ eyebrow, title, children }) {
  return (
    <div className="mb-10">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-gold">
        {eyebrow}
      </p>
      <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
        {title}
      </h1>
      {children && (
        <div className="mt-3 max-w-2xl text-base leading-relaxed text-stone-400">
          {children}
        </div>
      )}
    </div>
  );
}
function useProductWish() {
  const wishlist = useWishlist();
  return (product) =>
    wishlist.toggle(product).catch((error) => window.alert(error.message));
}
function Catalog({ products }) {
  const toggle = useProductWish();
  const wishlist = useWishlist();
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          wished={wishlist.has(product.id)}
          onToggleWish={toggle}
        />
      ))}
    </div>
  );
}

function ChatFeed({ messages, user, role }) {
  const [openThread, setOpenThread] = useState("");
  const threads = Object.values(
    messages
      .filter((item) => item.chatType === "conversation")
      .reduce((all, item) => {
        const key = item.conversationId || item.id;
        (all[key] ||= []).push(item);
        return all;
      }, {}),
  );
  return (
    <>
      <div className="space-y-3">
        {threads.map((thread) => {
          const key = thread[0].conversationId || thread[0].id;
          const latest = [...thread].sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
          )[0];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpenThread(key)}
              className="flex w-full items-center gap-4 border border-line bg-panel p-4 text-left transition hover:border-gold/60"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold/10 text-gold">
                <i className="fa-regular fa-message" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">
                  {role === "buyer"
                    ? thread[0].sellerName || "Seller"
                    : thread[0].buyerName || "Buyer"}
                </strong>
                <span className="mt-1 block truncate text-xs text-stone-400">
                  {latest.productTitle || "Shop conversation"} · {latest.text}
                </span>
              </span>
              <i
                className="fa-solid fa-chevron-right text-xs text-gold"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      {openThread &&
        threads.find(
          (thread) => (thread[0].conversationId || thread[0].id) === openThread,
        ) && (
          <ChatThread
            messages={threads.find(
              (thread) =>
                (thread[0].conversationId || thread[0].id) === openThread,
            )}
            user={user}
            role={role}
            onClose={() => setOpenThread("")}
          />
        )}
    </>
  );
}

function ChatThread({ messages, user, role, onClose }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const sorted = [...messages].sort(
    (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0),
  );
  const thread = sorted[0];
  const context = sorted[sorted.length - 1];
  const productsDiscussed = [
    ...new Map(
      sorted
        .filter((item) => item.productTitle)
        .map((item) => [item.productId || item.productTitle, item]),
    ).values(),
  ];
  async function reply(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      await sendMessage({
        chatType: "conversation",
        conversationId: thread.conversationId,
        buyerUid: thread.buyerUid,
        buyerName: thread.buyerName,
        buyerEmail: thread.buyerEmail || "",
        sellerUid: thread.sellerUid,
        sellerName: thread.sellerName || "Seller",
        productId: context.productId || "",
        productTitle: context.productTitle || "Shop conversation",
        senderUid: user.uid,
        senderRole: role,
        text: draft.trim(),
      });
      setDraft("");
      setError("");
    } catch (cause) {
      setError(cause.message || "Could not send message.");
    }
  }
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-3 sm:p-6">
      <article
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${role === "buyer" ? thread.sellerName || "seller" : thread.buyerName || "buyer"}`}
        className="flex h-[min(88vh,760px)] w-full max-w-3xl flex-col border border-line bg-panel shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              {productsDiscussed.length ? (
                productsDiscussed.map((product) =>
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
                )
              ) : (
                <span className="text-xs text-gold">Shop conversation</span>
              )}
            </div>
            <h2 className="mt-1 truncate font-display text-xl">
              {role === "buyer"
                ? thread.sellerName || "Seller"
                : thread.buyerName || "Buyer"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="grid size-10 shrink-0 place-items-center text-stone-400 hover:text-gold"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-ink/40 p-4 sm:p-6">
          {sorted.map((item) => (
            <div
              key={item.id}
              className={`max-w-[85%] rounded-lg px-4 py-3 ${item.senderUid === user.uid ? "ml-auto bg-gold/15 text-cream" : "bg-panel text-stone-300"}`}
            >
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-gold">
                {item.senderRole === "seller" ? "Seller" : "Buyer"}
              </span>
              <p className="whitespace-pre-wrap text-sm leading-6">
                {item.text}
              </p>
              <span className="mt-2 block text-right text-[10px] text-stone-500">
                {item.createdAt?.toDate?.().toLocaleString?.() || "Just now"}
              </span>
            </div>
          ))}
        </div>
        <form
          onSubmit={reply}
          className="flex gap-2 border-t border-line p-3 sm:p-4"
        >
          <input
            className="min-w-0 flex-1 border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-gold"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            placeholder="Write a message…"
          />
          <button className="bg-gold px-5 text-sm font-semibold text-ink">
            <i className="fa-solid fa-paper-plane sm:mr-2" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
        {error && (
          <p role="alert" className="px-4 pb-3 text-xs text-red-300">
            {error}
          </p>
        )}
      </article>
    </div>
  );
}

function ProductImagePicker({ imageUrl, onChange, onRemove, disabled }) {
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const imageFailed = Boolean(imageUrl) && failedImageUrl === imageUrl;
  return (
    <div>
      <label
        className="block text-xs text-stone-300"
        htmlFor="product-image-url"
      >
        Product image URL
      </label>
      <div className="mt-2 flex min-h-36 items-center gap-4 border border-dashed border-stone-700 bg-ink p-4">
        {imageUrl && !imageFailed && (
          <div className="relative size-24 shrink-0">
            <img
              className="h-full w-full object-cover"
              src={imageUrl}
              alt="Product preview"
              onError={() => setFailedImageUrl(imageUrl)}
            />
            <button
              type="button"
              disabled={disabled}
              className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border border-line bg-panel text-sm text-cream shadow-md hover:text-red-300"
              aria-label="Remove product image"
              title="Remove image"
              onClick={onRemove}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}
        {imageUrl && imageFailed && (
          <div className="grid size-24 shrink-0 place-items-center bg-panel text-xs text-red-300">
            Image link failed
          </div>
        )}
        <div className="min-w-0 flex-1">
          <input
            id="product-image-url"
            className={fieldClass}
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com/product.jpg"
            value={imageUrl}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
          />
          <p className="mt-2 text-xs leading-5 text-stone-500">
            Paste a public, direct image link (JPG, PNG or WebP). A link to a
            webpage may not display.
          </p>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const toggleWish = useProductWish();
  const wishlist = useWishlist();
  const { data: products, error } = useLive("products");
  const productsRailRef = useRef(null);
  if (!authLoading && profile?.role === "seller")
    return <Navigate to="/seller" replace />;
  const newest = [...products]
    .filter((item) => item.active !== false)
    .slice(0, 12);
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-10 sm:px-9 md:min-h-152.5 md:grid-cols-2 md:gap-14 md:py-14">
        <div className="max-w-xl py-7 md:py-0">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[.2em] text-gold">
            A marketplace for independent style
          </p>
          <h1 className="font-display text-5xl leading-[.98] tracking-tight sm:text-6xl lg:text-7xl">
            Wear what
            <br />
            <em className="text-gold">moves you.</em>
          </h1>
          <p className="mt-6 max-w-md text-base leading-8 text-stone-300 sm:text-lg">
            Discover thoughtful pieces from the people who make them. Shop
            directly, ask questions, and find your next favourite.
          </p>
          <Link to="/shop" className={`${primaryButton} mt-8`}>
            Explore the collection <i className="fa-solid fa-arrow-right" />
          </Link>
          <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-[10px] tracking-widest text-stone-500">
            <span>01 / PERSONAL STYLE</span>
            <span>02 / INDEPENDENT SELLERS</span>
          </div>
        </div>
        <div className="relative ml-3 h-97.5 bg-panel sm:h-125 md:ml-0">
          <img
            className="h-full w-full object-cover brightness-75"
            src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1100&q=85"
            alt="New season fashion"
          />
          <div className="absolute -bottom-5 -left-3 border border-line bg-ink p-5 sm:-left-8 sm:p-7">
            <span className="text-[10px] tracking-[.2em] text-gold">
              THE NEW EDIT
            </span>
            <strong className="mt-2 block font-display text-xl leading-tight">
              Everyday form,
              <br />
              elevated.
            </strong>
          </div>
          <span className="absolute right-4 top-4 text-xs tracking-widest text-white">
            N° 01 — 26
          </span>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-y border-line px-4 py-5 text-[9px] font-medium tracking-[.16em] text-stone-400 sm:gap-x-8 sm:text-[10px]">
        <span>CURATED BY PEOPLE</span>
        <span className="text-gold">•</span>
        <span>BUILT FOR EVERYDAY</span>
        <span className="text-gold">•</span>
        <span>SHOP DIRECT WITH SELLERS</span>
        <span className="text-gold">•</span>
        <span>MADE TO BE YOURS</span>
      </div>
      <PageFrame>
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[.2em] text-gold">
              Just landed
            </p>
            <h2 className="font-display text-2xl sm:text-3xl">
              Fresh from the makers
            </h2>
          </div>
          <Link to="/shop" className="text-sm text-gold hover:text-cream">
            View everything <i className="fa-solid fa-arrow-right ml-2" />
          </Link>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        {newest.length ? (
          <div className="relative">
            <button
              type="button"
              aria-label="Scroll products left"
              onClick={() =>
                productsRailRef.current?.scrollBy({
                  left: -320,
                  behavior: "smooth",
                })
              }
              className="absolute -left-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-gold bg-gold text-ink shadow-lg transition hover:bg-[#e4c374] sm:-left-5"
            >
              <i className="fa-solid fa-arrow-left" />
            </button>
            <div
              ref={productsRailRef}
              className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-1 pb-4 md:gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {newest.map((product) => (
                <div
                  key={product.id}
                  className="w-[calc(33.333%-0.333rem)] shrink-0 snap-start md:w-[calc(25%-0.75rem)] lg:w-[calc(20%-0.8rem)]"
                >
                  <ProductCard
                    product={product}
                    wished={wishlist.has(product.id)}
                    onToggleWish={toggleWish}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              aria-label="Scroll products right"
              onClick={() =>
                productsRailRef.current?.scrollBy({
                  left: 320,
                  behavior: "smooth",
                })
              }
              className="absolute -right-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-gold bg-gold text-ink shadow-lg transition hover:bg-[#e4c374] sm:-right-5"
            >
              <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
        ) : (
          <EmptyState
            title={
              error
                ? "The shop is unavailable."
                : "The first pieces are on their way."
            }
          >
            <Link className="text-gold" to="/shop">
              Browse the shop
            </Link>
          </EmptyState>
        )}
      </PageFrame>
      <section
        id="story"
        className="grid items-center gap-8 border-y border-line bg-panel px-5 py-14 sm:px-12 md:grid-cols-2 md:gap-16 md:px-[10vw] md:py-20"
      >
        <div>
          <p className="mb-3 text-xs uppercase tracking-[.2em] text-gold">
            More than a marketplace
          </p>
          <h2 className="font-display text-3xl leading-tight sm:text-4xl">
            Good things happen
            <br />
            when you shop <em className="text-gold">closer.</em>
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-stone-300">
            Meet the makers behind every piece. Ask about the fit. Find out how
            it is made. Keep independent fashion moving.
          </p>
          <Link to="/shop" className={`${outlineButton} mt-6`}>
            Meet the makers
          </Link>
        </div>
        <img
          className="h-72 w-full object-cover brightness-75 sm:h-96"
          src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85"
          alt="Independent fashion"
        />
      </section>
      <section className="px-5 py-16 text-center sm:py-20">
        <p className="mb-3 text-xs uppercase tracking-[.2em] text-gold">
          Made something good?
        </p>
        <h2 className="font-display text-3xl sm:text-4xl">
          Your shop belongs here.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-stone-300">
          Open a seller account, list your collection, and talk directly with
          the people who wear it.
        </p>
        <Link
          to={user ? "/seller" : "/signup?role=seller"}
          className={`${primaryButton} mt-7`}
        >
          Start selling <i className="fa-solid fa-arrow-right" />
        </Link>
      </section>
    </>
  );
}

export function ShopPage() {
  const { data: products, loading, error } = useLive("products");
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(
    searchParams.get("category") || "All pieces",
  );
  const categories = [
    "All pieces",
    ...new Set(products.map((item) => item.category).filter(Boolean)),
  ];
  const shown = products.filter(
    (item) =>
      item.active !== false &&
      (category === "All pieces" || item.category === category) &&
      `${item.title} ${item.description} ${item.sellerName}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <PageFrame>
      <PageTitle
        eyebrow="The collection"
        title={
          <>
            Find your <em className="text-gold">everyday.</em>
          </>
        }
      >
        Pieces from independent sellers, made to fit your point of view.
      </PageTitle>
      <div className="mb-8 flex flex-col gap-5 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((name) => (
            <button
              key={name}
              className={`border px-3 py-2 text-xs transition ${category === name ? "border-gold text-gold" : "border-line text-stone-400 hover:border-gold/70 hover:text-gold"}`}
              onClick={() => {
                setCategory(name);
                setSearchParams(
                  name === "All pieces" ? {} : { category: name },
                );
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 border-b border-stone-600 py-2 text-gold lg:w-64">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            className="w-full bg-transparent text-sm text-cream outline-none placeholder:text-stone-500"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pieces or makers"
          />
        </label>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {loading ? (
        <Loading />
      ) : shown.length ? (
        <Catalog products={shown} />
      ) : (
        <EmptyState
          title={
            products.length
              ? "No pieces found."
              : error
                ? "The collection is unavailable."
                : "The collection is on its way."
          }
        >
          {products.length ? (
            "Try another search or category."
          ) : error ? (
            "Check your Firebase setup and Firestore rules."
          ) : (
            <Link className="text-gold" to="/seller">
              Be the first to list a piece.
            </Link>
          )}
        </EmptyState>
      )}
    </PageFrame>
  );
}

export function ProductPage() {
  const { id } = useParams();
  const { data: products, loading } = useLive("products");
  const { data: reviews } = useLive("reviews");
  const { user, profile } = useAuth();
  const { add } = useCart();
  const wishlist = useWishlist();
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState("");
  const [rating, setRating] = useState("5");
  const [bagDialog, setBagDialog] = useState(false);
  const autoAddHandled = useRef(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const product = products.find(
    (item) => item.id === id && item.active !== false,
  );
  const productReviews = reviews.filter(
    (item) => item.productId === id && !item.hidden,
  );
  const average = productReviews.length
    ? productReviews.reduce((n, item) => n + Number(item.rating), 0) /
      productReviews.length
    : 0;
  useEffect(() => {
    if (
      searchParams.get("action") !== "add" ||
      !user ||
      profile?.role !== "buyer" ||
      !product ||
      autoAddHandled.current
    )
      return;
    autoAddHandled.current = true;
    add(product);
    setBagDialog(true);
    navigate(`/product/${id}`, { replace: true });
  }, [add, id, navigate, product, profile?.role, searchParams, user]);
  if (!product && loading) return <Loading />;
  if (!product)
    return (
      <PageFrame>
        <EmptyState title="That piece is no longer here.">
          <Link className="text-gold" to="/shop">
            Back to the collection
          </Link>
        </EmptyState>
      </PageFrame>
    );
  async function contactSeller(event) {
    event.preventDefault();
    if (!user || profile?.role !== "buyer")
      return setNotice("Sign in with a buyer account to message this seller.");
    try {
      await sendMessage({
        chatType: "conversation",
        conversationId: `${user.uid}_${product.sellerUid}`,
        sellerUid: product.sellerUid,
        sellerName: product.sellerName,
        buyerUid: user.uid,
        buyerName: profile?.name || user.displayName || user.email,
        buyerEmail: user.email,
        productId: id,
        productTitle: product.title,
        senderUid: user.uid,
        senderRole: "buyer",
        text: message.trim(),
      });
      setMessage("");
      setNotice("Your message was sent to the seller.");
    } catch (error) {
      setNotice(error.message || "Could not send your message.");
    }
  }
  async function submitReview(event) {
    event.preventDefault();
    if (!user || profile?.role !== "buyer")
      return setNotice("Sign in with a buyer account to leave a review.");
    if (user.uid === product.sellerUid)
      return setNotice("Sellers cannot review their own pieces.");
    try {
      await addReview({
        productId: id,
        sellerUid: product.sellerUid,
        buyerUid: user.uid,
        buyerName: profile?.name || "Buyer",
        rating: Number(rating),
        text: review.trim(),
      });
      setReview("");
      setNotice("Thanks, your review is live.");
    } catch (error) {
      setNotice(error.message || "Could not post your review.");
    }
  }
  async function saveWish() {
    const wasSaved = wishlist.has(id);
    try {
      await wishlist.toggle(product);
      setNotice(
        wasSaved ? "Removed from wishlist." : "Saved to your wishlist.",
      );
    } catch (error) {
      setNotice(error.message);
    }
  }
  return (
    <PageFrame>
      <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <div className="relative aspect-4/5 max-h-195 bg-panel">
          {product.imageUrl ? (
            <img
              className="h-full w-full object-cover"
              src={product.imageUrl}
              alt={product.title}
            />
          ) : (
            <div className="grid h-full place-items-center text-6xl text-stone-600">
              <i className="fa-solid fa-shirt" />
            </div>
          )}
          <span className="absolute bottom-4 left-4 bg-ink/90 px-3 py-2 text-[10px] tracking-[.16em] text-gold">
            INDEPENDENTLY LISTED
          </span>
        </div>
        <div className="py-2 sm:py-7">
          <p className="text-xs uppercase tracking-[.2em] text-gold">
            {product.category || "The collection"}
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {product.title}
          </h1>
          <p className="mt-3 text-sm text-stone-300">
            Designed and listed by{" "}
            <strong className="font-medium text-gold">
              {product.sellerName || "Independent seller"}
            </strong>
          </p>
          <div className="mt-5 flex items-center gap-3">
            <Stars value={average} />
            <a
              className="text-xs text-stone-400 hover:text-gold"
              href="#reviews"
            >
              ({productReviews.length} reviews)
            </a>
          </div>
          <p className="mt-7 font-display text-xl">
            Rs. {Number(product.price).toLocaleString()}
          </p>
          <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-stone-300">
            {product.description}
          </p>
          <p className="mt-5 text-xs text-gold">
            {Number(product.stock || 0) > 0
              ? `${product.stock} available`
              : "Currently unavailable â€” contact the seller"}
          </p>
          {profile?.role !== "seller" && (
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                className={primaryButton}
                disabled={Number(product.stock || 0) < 1}
                onClick={() => {
                  if (!user) {
                    navigate(
                      `/signin?redirect=${encodeURIComponent(`/product/${id}?action=add`)}`,
                    );
                    return;
                  }
                  add(product);
                  setBagDialog(true);
                }}
              >
                Add to bag <i className="fa-solid fa-arrow-right" />
              </button>
              <button className={outlineButton} onClick={saveWish}>
                <i
                  className={`${wishlist.has(id) ? "fa-solid" : "fa-regular"} fa-heart`}
                />
                {wishlist.has(id) ? "Saved" : "Wishlist"}
              </button>
            </div>
          )}
          <Notice>{notice}</Notice>
          <div className="mt-9 border-t border-line pt-6">
            <h2 className="font-display text-xl">Ask the seller</h2>
            <p className="mt-2 text-sm leading-6 text-stone-400">
              Questions about fit, fabric, or availability? Send{" "}
              {product.sellerName || "the maker"} a note.
            </p>
            {profile?.role !== "seller" ? (
              <form className="mt-4 grid gap-3" onSubmit={contactSeller}>
                <textarea
                  className={fieldClass}
                  rows="3"
                  required
                  maxLength={2000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write your messageâ€¦"
                />
                <button
                  className={`${outlineButton} justify-self-start`}
                  type="submit"
                >
                  Send a message
                </button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-stone-500">
                Seller accounts can manage their own products in the studio.
              </p>
            )}
          </div>
        </div>
      </div>
      <section id="reviews" className="mt-16 border-t border-line pt-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-gold">
              From the community
            </p>
            <h2 className="mt-2 font-display text-3xl">
              Reviews{" "}
              <span className="font-sans text-base text-stone-500">
                ({productReviews.length})
              </span>
            </h2>
          </div>
          <Stars value={average} />
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-5">
            {productReviews.length ? (
              productReviews.map((item) => (
                <article key={item.id} className="border-b border-line pb-5">
                  <Stars value={item.rating} />
                  <p className="my-3 font-display text-xl leading-relaxed">
                    {item.text}
                  </p>
                  <span className="text-xs text-stone-400">
                    {item.buyerName || "Buyer"}
                  </span>
                </article>
              ))
            ) : (
              <p className="text-sm text-stone-400">
                Be the first to share how this piece feels.
              </p>
            )}
          </div>
          {profile?.role !== "seller" && (
            <form
              className="space-y-4 border border-line bg-panel p-5 sm:p-7"
              onSubmit={submitReview}
            >
              <h3 className="font-display text-xl">Leave a review</h3>
              <label className="block text-xs text-stone-300">
                Your rating
                <select
                  className={fieldClass}
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} stars
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                className={fieldClass}
                rows="4"
                required
                minLength={3}
                maxLength={1000}
                value={review}
                onChange={(event) => setReview(event.target.value)}
                placeholder="Tell others what you thinkâ€¦"
              />
              <button className={primaryButton} type="submit">
                Post review
              </button>
            </form>
          )}
        </div>
      </section>
      {bagDialog && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setBagDialog(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bag-dialog-title"
            className="w-full max-w-md border border-line bg-panel p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[.18em] text-gold">
                  Added to your bag
                </p>
                <h2
                  id="bag-dialog-title"
                  className="mt-2 font-display text-2xl"
                >
                  Keep shopping?
                </h2>
              </div>
              <button
                type="button"
                className="text-stone-400 hover:text-gold"
                aria-label="Close"
                onClick={() => setBagDialog(false)}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="mt-5 flex items-center gap-4 border-y border-line py-4">
              {product.imageUrl && (
                <img
                  className="size-16 object-cover"
                  src={product.imageUrl}
                  alt=""
                />
              )}
              <div>
                <strong className="font-display text-lg">
                  {product.title}
                </strong>
                <p className="mt-1 text-sm text-stone-400">
                  Rs. {Number(product.price).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={outlineButton}
                onClick={() => {
                  setBagDialog(false);
                  navigate("/shop");
                }}
              >
                Keep shopping
              </button>
              <button
                type="button"
                className={primaryButton}
                onClick={() => navigate("/checkout")}
              >
                Go to checkout <i className="fa-solid fa-arrow-right" />
              </button>
            </div>
          </section>
        </div>
      )}
    </PageFrame>
  );
}

export function AuthPage({ mode = "signin" }) {
  const { user, profile, signin, signup, google, loading } = useAuth();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const sellerIntent = search.get("role") === "seller";
  const requestedRedirect = search.get("redirect");
  const safeRedirect =
    requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "";
  const isAdmin = isAdminIdentity(user) || profile?.role === "admin";
  const fallbackRoute = isAdmin
    ? "/admin"
    : sellerIntent
      ? "/seller"
      : "/account";
  const isSignup = mode === "signup";
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user && !loading)
    return (
      <Navigate
        to={
          (isAdmin ? "/admin" : safeRedirect) ||
          (profile?.role === "seller" ? "/seller" : fallbackRoute)
        }
        replace
      />
    );
  const signupQuery = new URLSearchParams();
  if (sellerIntent) signupQuery.set("role", "seller");
  if (safeRedirect) signupQuery.set("redirect", safeRedirect);
  const signupHref = `/signup${signupQuery.size ? `?${signupQuery.toString()}` : ""}`;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (isSignup && form.phone.replace(/\D/g, "").length < 7)
        throw new Error("Enter a valid phone number with at least 7 digits.");
      if (isSignup)
        await signup({ ...form, role: sellerIntent ? "seller" : "buyer" });
      else await signin(form.email, form.password);
      navigate(safeRedirect || fallbackRoute);
    } catch (cause) {
      setError(cause.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function googleLogin() {
    setBusy(true);
    setError("");
    try {
      if (isSignup && form.phone.replace(/\D/g, "").length < 7)
        throw new Error(
          "Enter a valid phone number before continuing with Google.",
        );
      const signedInUser = await google(
        sellerIntent ? "seller" : "buyer",
        form.phone,
      );
      navigate(
        isAdminIdentity(signedInUser)
          ? "/admin"
          : safeRedirect || fallbackRoute,
      );
    } catch (cause) {
      setError(cause.message || "Google sign-in could not start.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageFrame className="grid max-w-6xl items-center gap-9 md:grid-cols-2 md:gap-16">
      <div>
        <p className="mb-4 text-xs uppercase tracking-[.2em] text-gold">
          New Brand Fashion
        </p>
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">
          {sellerIntent ? (
            <>
              Make room
              <br />
              for <em className="text-gold">your work.</em>
            </>
          ) : (
            <>
              Find your
              <br />
              <em className="text-gold">own way.</em>
            </>
          )}
        </h1>
        <p className="mt-5 max-w-sm text-base leading-7 text-stone-300">
          {sellerIntent
            ? "Create an account and open your independent seller studio."
            : "A considered collection and a community of independent makers."}
        </p>
        <Link className="mt-6 inline-block text-sm text-gold" to="/shop">
          Explore the shop <i className="fa-solid fa-arrow-right ml-2" />
        </Link>
      </div>
      <form
        className="space-y-4 border border-line bg-panel p-6 sm:p-9"
        onSubmit={submit}
      >
        <p className="text-xs uppercase tracking-[.2em] text-gold">
          {isSignup ? "Create an account" : "Welcome back"}
        </p>
        <h2 className="font-display text-2xl">
          {isSignup ? "Join the community" : "Sign in to continue"}
        </h2>
        <p className="text-sm leading-6 text-stone-400">
          Save your bag, message makers, leave reviews, and manage orders.
        </p>
        <button
          className="flex min-h-12 w-full items-center justify-center gap-3 bg-cream px-4 text-sm font-semibold text-ink transition hover:bg-white"
          type="button"
          onClick={googleLogin}
          disabled={busy}
        >
          <span className="font-bold text-blue-600">G</span> Continue with
          Google
        </button>
        <div className="flex items-center gap-3 py-1 text-xs text-stone-500">
          <span className="h-px flex-1 bg-line" />
          or use email
          <span className="h-px flex-1 bg-line" />
        </div>
        {isSignup && (
          <label className="block text-xs text-stone-300">
            Your name
            <input
              className={fieldClass}
              required
              autoComplete="name"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
        )}
        {isSignup && (
          <label className="block text-xs text-stone-300">
            Phone number
            <input
              className={fieldClass}
              type="tel"
              autoComplete="tel"
              required
              minLength={7}
              maxLength={20}
              pattern="[0-9+() -]{7,20}"
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
          </label>
        )}
        <label className="block text-xs text-stone-300">
          Email address
          <input
            className={fieldClass}
            required
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
          />
        </label>
        <label className="block text-xs text-stone-300">
          Password
          <input
            className={fieldClass}
            required
            minLength={6}
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
          />
        </label>
        <Notice kind="error">{error}</Notice>
        <button className={`${primaryButton} w-full`} disabled={busy}>
          {busy ? "Please waitâ€¦" : isSignup ? "Create account" : "Sign in"}
        </button>
        <p className="text-center text-xs text-stone-400">
          {isSignup ? "Already have an account?" : "New around here?"}{" "}
          <Link
            className="text-gold"
            to={
              isSignup
                ? `/signin${safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : ""}`
                : signupHref
            }
          >
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </form>
    </PageFrame>
  );
}

export function SellerPage() {
  const { user, profile, becomeSeller, loading: authLoading } = useAuth();
  const {
    data: products,
    loading: productsLoading,
    error: productsError,
  } = useLive("products");
  const { data: messages, error: messagesError } = useLive(
    "messages",
    "sellerUid",
    user?.uid,
  );
  const { data: orders, error: ordersError } = useLive(
    "orders",
    "sellerIds",
    user?.uid,
    "array-contains",
  );
  const { data: reviews, error: reviewsError } = useLive("reviews");
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [form, setForm] = useState({
    title: "",
    category: "Clothing",
    price: "",
    stock: "1",
    imageUrl: "",
    description: "",
  });
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("info");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState("");
  const productFormRef = useRef(null);
  const [deleteCandidate, setDeleteCandidate] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [sellerActivation, setSellerActivation] = useState(false);
  if (authLoading) return <Loading label="Loading your accountâ€¦" />;
  if (!user) return <Navigate to="/signin?role=seller" replace />;
  if (profile?.role !== "seller")
    return (
      <PageFrame className="max-w-3xl py-20">
        <div className="border border-line bg-panel p-7 sm:p-12">
          <p className="mb-3 text-xs uppercase tracking-[.2em] text-gold">
            Independent seller studio
          </p>
          <h1 className="font-display text-4xl">
            Make room for <em className="text-gold">your work.</em>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-stone-300">
            Open a seller studio to list your pieces, track incoming orders, and
            connect with buyers. Your buyer account and purchase history remain
            available.
          </p>
          <Notice kind="error">{sellerActivation}</Notice>
          <button
            className={`${primaryButton} mt-6`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setSellerActivation("");
              try {
                await becomeSeller();
              } catch (error) {
                setSellerActivation(error.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Opening your studioâ€¦" : "Open my seller studio"}{" "}
            <i className="fa-solid fa-arrow-right" />
          </button>
        </div>
      </PageFrame>
    );

  const sellerProducts = products.filter((item) => item.sellerUid === user.uid);
  const sellerOrders = orders.filter((item) =>
    item.sellerIds?.includes(user.uid),
  );
  const sellerMessages = messages.filter((item) => item.sellerUid === user.uid);
  const sellerNotifications = sellerMessages.filter(
    (item) => item.senderRole === "admin" && item.recipientUid === user.uid,
  );
  const buyerMessages = sellerMessages.filter(
    (item) => item.senderRole !== "admin" && item.chatType !== "conversation",
  );
  const sellerChats = sellerMessages.filter(
    (item) => item.chatType === "conversation",
  );
  const sellerReviews = reviews.filter((item) => item.sellerUid === user.uid);
  const newOrders = sellerOrders.filter((item) => item.status === "new").length;
  const completedTotal = sellerOrders
    .filter((item) => ["shipped", "completed"].includes(item.status))
    .reduce(
      (total, order) =>
        total +
        order.items
          .filter((item) => item.sellerUid === user.uid)
          .reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
      0,
    );
  const rating = sellerReviews.length
    ? sellerReviews.reduce((sum, item) => sum + Number(item.rating), 0) /
      sellerReviews.length
    : 0;
  async function submitProduct(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setNoticeKind("info");
    try {
      if (!form.imageUrl.trim())
        throw new Error("Add a product image URL before publishing.");
      let parsedImageUrl;
      try {
        parsedImageUrl = new URL(form.imageUrl.trim());
      } catch {
        throw new Error("Enter a valid direct image URL.");
      }
      if (!["http:", "https:"].includes(parsedImageUrl.protocol))
        throw new Error("Image URL must start with http:// or https://.");
      setNotice("Saving product listing…");
      const data = {
        ...form,
        imageUrl: parsedImageUrl.href,
        price: Number(form.price),
        stock: Number(form.stock),
        sellerUid: user.uid,
        sellerName: profile?.name || user.displayName || "Independent seller",
      };
      if (editing) await updateProduct(editing, data);
      else await addProduct(data);
      setForm({
        title: "",
        category: "Clothing",
        price: "",
        stock: "1",
        imageUrl: "",
        description: "",
      });
      setEditing("");
      setNotice("Your listing is live in the marketplace.");
      setNoticeKind("success");
    } catch (error) {
      setNotice(
        error.message || "Could not save this listing. Check Firestore rules.",
      );
      setNoticeKind("error");
    } finally {
      setBusy(false);
    }
  }
  function editProduct(item) {
    setForm({
      title: item.title,
      category: item.category || "Clothing",
      price: item.price,
      stock: item.stock,
      imageUrl: item.imageUrl || "",
      description: item.description || "",
    });
    setEditing(item.id);
    setParams({ tab: "products" });
    window.requestAnimationFrame(() =>
      productFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      }),
    );
  }
  const tabs = [
    "overview",
    "products",
    "orders",
    "inbox",
    "notifications",
    "reviews",
  ];
  const chooseTab = (value) =>
    setParams(value === "overview" ? {} : { tab: value });
  return (
    <PageFrame>
      <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[.2em] text-gold">
            Independent seller studio
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            Your shop, <em className="text-gold">your story.</em>
          </h1>
          <p className="mt-3 text-sm text-stone-400">
            Welcome, {profile?.name || user.displayName || "seller"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link className={outlineButton} to="/settings">
            <i className="fa-solid fa-gear" /> Settings
          </Link>
          <span className="border border-line px-4 py-2 text-xs text-stone-300">
            <i className="fa-solid fa-circle text-[8px] text-gold" /> Seller
            account
          </span>
        </div>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            "Live products",
            sellerProducts.filter((item) => item.active !== false).length,
            "fa-shirt",
          ],
          ["Total orders", sellerOrders.length, "fa-box"],
          ["Needs attention", newOrders, "fa-bell"],
          [
            "Completed sales",
            `Rs. ${completedTotal.toLocaleString()}`,
            "fa-chart-line",
          ],
        ].map(([label, value, icon]) => (
          <div className="border border-line bg-panel p-4 sm:p-6" key={label}>
            <i className={`fa-solid ${icon} text-gold`} />
            <p className="mt-5 text-xs text-stone-400">{label}</p>
            <strong className="mt-1 block wrap-break-word font-display text-xl sm:text-2xl">
              {value}
            </strong>
          </div>
        ))}
      </div>
      {[productsError, ordersError, messagesError, reviewsError].filter(Boolean)
        .length > 0 && (
        <Notice kind="error">
          {[productsError, ordersError, messagesError, reviewsError]
            .filter(Boolean)
            .join(" ")}
        </Notice>
      )}
      <div className="mb-8 flex gap-5 overflow-x-auto border-b border-line">
        {tabs.map((name) => (
          <button
            key={name}
            className={`shrink-0 border-b-2 px-1 py-3 text-sm capitalize transition ${tab === name ? "border-gold text-gold" : "border-transparent text-stone-400 hover:text-cream"}`}
            onClick={() => chooseTab(name)}
          >
            {name}
            {name === "orders" && newOrders > 0 ? (
              <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[10px] text-ink">
                {newOrders}
              </span>
            ) : null}
            {name === "notifications" && sellerNotifications.length > 0 ? (
              <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[10px] text-ink">
                {sellerNotifications.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <section>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[.18em] text-gold">
                  Latest activity
                </p>
                <h2 className="mt-2 font-display text-2xl">Incoming orders</h2>
              </div>
              <button
                className="text-sm text-gold"
                onClick={() => chooseTab("orders")}
              >
                All orders <i className="fa-solid fa-arrow-right ml-1" />
              </button>
            </div>
            {sellerOrders.slice(0, 4).map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                sellerUid={user.uid}
                onStatus={setOrderStatus}
              />
            ))}
            {!sellerOrders.length && (
              <EmptyState title="Your first order is on its way.">
                Publish a product to start getting discovered.
              </EmptyState>
            )}
          </section>
          <section className="border border-line bg-panel p-5 sm:p-7">
            <p className="text-xs uppercase tracking-[.18em] text-gold">
              Your shop at a glance
            </p>
            <h2 className="mt-2 font-display text-2xl">Growing with you.</h2>
            <div className="mt-6 space-y-4 text-sm">
              <p className="flex justify-between border-b border-line pb-3">
                <span className="text-stone-400">Published pieces</span>
                <strong>
                  {
                    sellerProducts.filter((item) => item.active !== false)
                      .length
                  }
                </strong>
              </p>
              <p className="flex justify-between border-b border-line pb-3">
                <span className="text-stone-400">Buyer messages</span>
                <strong>{sellerMessages.length}</strong>
              </p>
              <p className="flex justify-between border-b border-line pb-3">
                <span className="text-stone-400">Reviews received</span>
                <strong>{sellerReviews.length}</strong>
              </p>
              <p className="flex justify-between">
                <span className="text-stone-400">Average rating</span>
                <strong className="text-gold">
                  {rating ? `${rating.toFixed(1)} / 5` : "No reviews yet"}
                </strong>
              </p>
            </div>
            <button
              className={`${primaryButton} mt-7 w-full`}
              onClick={() => chooseTab("products")}
            >
              Add a product <i className="fa-solid fa-plus" />
            </button>
          </section>
        </div>
      )}
      {tab === "products" && (
        <div className="grid items-start gap-8 lg:grid-cols-[.85fr_1.15fr]">
          <form
            ref={productFormRef}
            className="space-y-4 border border-line bg-panel p-5 sm:p-7"
            onSubmit={submitProduct}
          >
            <p className="text-xs uppercase tracking-[.18em] text-gold">
              {editing ? "Editing product" : "Add a piece"}
            </p>
            <h2 className="font-display text-2xl">
              {editing
                ? `Edit ${form.title || "product"}`
                : "List something good."}
            </h2>
            {editing && (
              <p className="text-xs leading-5 text-stone-400">
                Update the name, category, price, stock, image, or product
                details below.
              </p>
            )}
            <label className="block text-xs text-stone-300">
              Product name
              <input
                className={fieldClass}
                required
                maxLength={90}
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="e.g. Linen everyday shirt"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-stone-300">
                Category
                <select
                  className={fieldClass}
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                >
                  {[
                    "Clothing",
                    "Tops",
                    "Bottoms",
                    "Outerwear",
                    "Accessories",
                    "Footwear",
                    "Other",
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-stone-300">
                Price (Rs.)
                <input
                  className={fieldClass}
                  required
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-stone-300">
                Stock
                <input
                  className={fieldClass}
                  required
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(event) =>
                    setForm({ ...form, stock: event.target.value })
                  }
                />
              </label>
            </div>
            <ProductImagePicker
              imageUrl={form.imageUrl}
              onChange={(imageUrl) => setForm({ ...form, imageUrl })}
              onRemove={() => setForm({ ...form, imageUrl: "" })}
              disabled={busy}
            />
            <label className="block text-xs text-stone-300">
              Details
              <textarea
                className={fieldClass}
                required
                minLength={8}
                maxLength={4000}
                rows="4"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Fabric, fit, care, and what makes it yoursâ€¦"
              />
            </label>
            <Notice kind={noticeKind}>{notice}</Notice>
            <button className={`${primaryButton} w-full`} disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Publish listing"}
            </button>
            {editing && (
              <button
                className="text-sm text-stone-400 hover:text-cream"
                type="button"
                onClick={() => {
                  setEditing("");
                  setForm({
                    title: "",
                    category: "Clothing",
                    price: "",
                    stock: "1",
                    imageUrl: "",
                    description: "",
                  });
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-[.18em] text-gold">
                  Your storefront
                </p>
                <h2 className="mt-2 font-display text-2xl">
                  {sellerProducts.length}{" "}
                  {sellerProducts.length === 1 ? "piece" : "pieces"}
                </h2>
              </div>
              {productsLoading && (
                <span className="text-xs text-stone-500">Syncingâ€¦</span>
              )}
            </div>
            <div className="divide-y divide-line">
              {sellerProducts.map((item) => (
                <div key={item.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="size-16 shrink-0 bg-panel">
                      {item.imageUrl ? (
                        <img
                          className="h-full w-full object-cover"
                          src={item.imageUrl}
                          alt=""
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-xl text-stone-600">
                          <i className="fa-solid fa-shirt" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate font-display text-lg">
                        {item.title}
                      </strong>
                      <span className="text-xs text-stone-400">
                        Rs. {Number(item.price).toLocaleString()} Â·{" "}
                        {item.stock} in stock
                      </span>
                      {item.active === false && (
                        <span className="mt-1 block text-[10px] uppercase tracking-wider text-red-300">
                          Hidden from shop
                        </span>
                      )}
                    </div>
                    <button
                      className="text-xs text-gold hover:text-cream"
                      onClick={() => editProduct(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs text-red-300 hover:text-red-200"
                      onClick={async () => {
                        if (item.active === false) {
                          await setProductVisibility(item.id, true);
                          return;
                        }
                        setDeleteCandidate(item.id);
                      }}
                    >
                      {item.active === false ? "Restore" : "Delete"}
                    </button>
                  </div>
                  {deleteCandidate === item.id && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-line bg-panel p-4">
                      <div>
                        <p className="text-sm font-medium">
                          Delete “{item.title}” from your shop?
                        </p>
                        <p className="mt-1 text-xs text-stone-400">
                          It will be hidden from buyers. Existing order and
                          review history stays saved.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="border border-line px-3 py-2 text-xs text-stone-400 hover:text-cream"
                          disabled={deleteBusy}
                          onClick={() => setDeleteCandidate("")}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="border border-red-400/60 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10"
                          disabled={deleteBusy}
                          onClick={async () => {
                            setDeleteBusy(true);
                            try {
                              await removeProduct(item.id);
                              setDeleteCandidate("");
                            } catch (error) {
                              setNotice(
                                error.message ||
                                  "Could not delete this product.",
                              );
                            } finally {
                              setDeleteBusy(false);
                            }
                          }}
                        >
                          {deleteBusy ? "Deleting…" : "Delete product"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!sellerProducts.length && (
              <p className="py-8 text-sm text-stone-400">
                Your published pieces will appear here.
              </p>
            )}
          </section>
        </div>
      )}
      {tab === "orders" && (
        <section>
          <p className="mb-1 text-xs uppercase tracking-[.18em] text-gold">
            Fulfilment
          </p>
          <h2 className="mb-6 font-display text-2xl">
            Orders from your buyers
          </h2>
          {sellerOrders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              sellerUid={user.uid}
              onStatus={setOrderStatus}
              detailed
            />
          ))}
          {!sellerOrders.length && (
            <EmptyState title="No orders yet.">
              Orders for your pieces will appear here as buyers check out.
            </EmptyState>
          )}
        </section>
      )}
      {tab === "inbox" && (
        <section>
          <p className="mb-1 text-xs uppercase tracking-[.18em] text-gold">
            Buyer questions
          </p>
          <h2 className="mb-6 font-display text-2xl">Your inbox</h2>
          <ChatFeed messages={sellerChats} user={user} role="seller" />
          <div className="space-y-4">
            {buyerMessages.map((item) => (
              <article
                key={item.id}
                className="border border-line bg-panel p-5"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="font-display text-xl">
                    {item.buyerName || "Buyer"}
                  </strong>
                  <span className="text-xs text-gold">
                    {item.productTitle || "Shop enquiry"}
                  </span>
                </div>
                <p className="my-3 text-sm leading-7 text-stone-300">
                  {item.text}
                </p>
                <a
                  className="text-sm text-gold hover:text-cream"
                  href={`mailto:${item.buyerEmail}?subject=${encodeURIComponent(`About ${item.productTitle || "your shop"}`)}`}
                >
                  Reply to {item.buyerEmail}{" "}
                  <i className="fa-solid fa-arrow-right ml-1" />
                </a>
              </article>
            ))}
          </div>
          {!buyerMessages.length && (
            <EmptyState title="Your inbox is clear.">
              Buyer messages will show up here.
            </EmptyState>
          )}
        </section>
      )}
      {tab === "notifications" && (
        <AdminNotifications items={sellerNotifications} />
      )}
      {tab === "reviews" && (
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[.18em] text-gold">
                Community feedback
              </p>
              <h2 className="mt-2 font-display text-2xl">
                Reviews for your pieces
              </h2>
            </div>
            <Stars value={rating} />
          </div>
          <div className="space-y-4">
            {sellerReviews.map((item) => (
              <article
                className="border border-line bg-panel p-5"
                key={item.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stars value={item.rating} />
                  <span className="text-xs text-stone-400">
                    {sellerProducts.find(
                      (product) => product.id === item.productId,
                    )?.title || "Your piece"}
                  </span>
                </div>
                <p className="my-3 font-display text-xl leading-relaxed">
                  {item.text}
                </p>
                <span className="text-xs text-stone-400">{item.buyerName}</span>
              </article>
            ))}
          </div>
          {!sellerReviews.length && (
            <EmptyState title="Your first review is on its way.">
              Buyers can review a piece from its product page.
            </EmptyState>
          )}
        </section>
      )}
    </PageFrame>
  );
}

function OrderRow({ order, sellerUid, onStatus, detailed = false }) {
  const pieces = order.items.filter((item) => item.sellerUid === sellerUid);
  const total = pieces.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );
  return (
    <article className="mb-3 border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong className="font-display text-lg">
            Order {order.id.slice(-7).toUpperCase()}
          </strong>
          <p className="mt-1 text-xs text-stone-400">
            {order.buyerName} Â·{" "}
            {order.createdAt?.toDate?.().toLocaleDateString() || "Just placed"}
          </p>
        </div>
        <span className="border border-gold/40 px-3 py-1 text-xs capitalize text-gold">
          {order.status}
        </span>
      </div>
      <p className="my-3 text-sm">
        {pieces.map((item) => `${item.title} Ã— ${item.quantity}`).join(", ")}
      </p>
      {detailed && (
        <p className="mb-3 text-xs leading-6 text-stone-400">
          Deliver to: {order.address} Â· {order.phone} Â·{" "}
          <a className="text-gold" href={`mailto:${order.buyerEmail}`}>
            {order.buyerEmail}
          </a>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong className="text-sm">Rs. {total.toLocaleString()}</strong>
        <select
          className="border border-line bg-ink px-3 py-2 text-xs capitalize text-cream outline-none focus:border-gold"
          value={order.status}
          onChange={(event) => onStatus(order.id, event.target.value)}
        >
          {["new", "confirmed", "shipped", "completed", "cancelled"].map(
            (status) => (
              <option className="capitalize" key={status}>
                {status}
              </option>
            ),
          )}
        </select>
      </div>
    </article>
  );
}

export function AccountPage() {
  const { user, profile, logout } = useAuth();
  const { data: orders, loading } = useLive("orders", "buyerUid", user?.uid);
  const { data: conversations } = useLive("messages", "buyerUid", user?.uid);
  const { data: adminMessages } = useLive(
    "messages",
    "recipientUid",
    user?.uid,
  );
  const { data: products } = useLive("products");
  const navigate = useNavigate();
  if (!user) return <Navigate to="/signin" replace />;
  if (profile?.role === "seller") return <Navigate to="/seller" replace />;
  return (
    <PageFrame>
      <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[.2em] text-gold">
            Your corner
          </p>
          <h1 className="font-display text-4xl">
            Good to see you,{" "}
            <em className="text-gold">
              {profile?.name?.split(" ")[0] || "friend"}.
            </em>
          </h1>
          <p className="mt-3 text-sm text-stone-400">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className={outlineButton} to="/settings">
            <i className="fa-solid fa-gear" /> Settings
          </Link>
          <button className={outlineButton} onClick={logout}>
            Sign out <i className="fa-solid fa-arrow-right-from-bracket" />
          </button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="border border-line bg-panel p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[.18em] text-gold">
            Your profile
          </p>
          <h2 className="mt-2 font-display text-2xl">Fashion community</h2>
          <p className="mt-3 text-sm leading-6 text-stone-400">
            Keep up with your orders, wishlist, and conversations.
          </p>
          <div className="mt-7 grid gap-4 text-sm text-gold">
            <Link to="/wishlist">
              Your wishlist <i className="fa-solid fa-arrow-right ml-2" />
            </Link>
            <Link to="/shop">
              Continue browsing <i className="fa-solid fa-arrow-right ml-2" />
            </Link>
            <button className="text-left" onClick={() => navigate("/seller")}>
              Open a seller studio{" "}
              <i className="fa-solid fa-arrow-right ml-2" />
            </button>
          </div>
        </section>
        <section className="border border-line bg-panel p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[.18em] text-gold">
            Your orders
          </p>
          <h2 className="mt-2 font-display text-2xl">
            {orders.length
              ? `${orders.length} placed ${orders.length === 1 ? "order" : "orders"}`
              : "No orders yet"}
          </h2>
          {loading ? (
            <Loading label="Loading your ordersâ€¦" />
          ) : (
            orders.map((order) => (
              <article
                className="mt-5 border-t border-line pt-4"
                key={order.id}
              >
                <div className="flex justify-between gap-2">
                  <strong className="font-display text-lg">
                    {order.id.slice(-7).toUpperCase()}
                  </strong>
                  <span className="text-xs capitalize text-gold">
                    {order.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-stone-400">
                  {order.items
                    .map((item) => `${item.title} Ã— ${item.quantity}`)
                    .join(", ")}
                </p>
                <strong className="mt-2 block text-sm">
                  Rs. {Number(order.total).toLocaleString()}
                </strong>
              </article>
            ))
          )}
          {!orders.length && !loading && (
            <Link className="mt-5 inline-block text-sm text-gold" to="/shop">
              Find your first piece{" "}
              <i className="fa-solid fa-arrow-right ml-2" />
            </Link>
          )}
        </section>
      </div>
      <AdminNotifications
        items={adminMessages.filter((item) => item.senderRole === "admin")}
      />
      <section className="mt-10">
        <p className="mb-2 text-xs uppercase tracking-[.18em] text-gold">
          Seller conversations
        </p>
        <h2 className="mb-5 font-display text-2xl">Your chats</h2>
        <ChatFeed messages={conversations} user={user} role="buyer" />
        {!conversations.some((item) => item.chatType === "conversation") && (
          <p className="text-sm text-stone-400">
            Open a product and message its seller to start a chat.
          </p>
        )}
      </section>
      <div className="mb-6 mt-14 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-gold">
            From your sellers
          </p>
          <h2 className="mt-2 font-display text-2xl">Keep exploring</h2>
        </div>
        <Link className="text-sm text-gold" to="/shop">
          Shop all <i className="fa-solid fa-arrow-right ml-2" />
        </Link>
      </div>
      <Catalog
        products={products.filter((item) => item.active !== false).slice(0, 4)}
      />
    </PageFrame>
  );
}

export function WishlistPage() {
  const { user, profile } = useAuth();
  const { productIds, toggle } = useWishlist();
  const { data: products, loading } = useLive("products");
  if (!user) return <Navigate to="/signin" replace />;
  if (profile?.role === "seller") return <Navigate to="/seller" replace />;
  const saved = productIds
    .map((id) => products.find((item) => item.id === id))
    .filter((item) => item && item.active !== false);
  return (
    <PageFrame>
      <PageTitle
        eyebrow="Saved for later"
        title={
          <>
            Your <em className="text-gold">wishlist.</em>
          </>
        }
      >
        Pieces you have your eye on.
      </PageTitle>
      {loading ? (
        <Loading />
      ) : saved.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">
          {saved.map((item) => (
            <div key={item.id}>
              <ProductCard
                product={item}
                wished
                onToggleWish={(product) =>
                  toggle(product).catch((error) => window.alert(error.message))
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Your wishlist is waiting.">
          <Link className="text-gold" to="/shop">
            Find a piece to save
          </Link>
        </EmptyState>
      )}
    </PageFrame>
  );
}

export function CartPage() {
  const { items, quantity, remove, total } = useCart();
  const { profile } = useAuth();
  if (profile?.role === "seller") return <Navigate to="/seller" replace />;
  return (
    <PageFrame>
      <PageTitle
        eyebrow="Your selection"
        title={
          <>
            The <em className="text-gold">bag.</em>
          </>
        }
      />
      {items.length ? (
        <div className="grid items-start gap-8 lg:grid-cols-[1.4fr_.6fr]">
          <div className="divide-y divide-line">
            {items.map((item) => (
              <article className="flex gap-4 py-5" key={item.id}>
                <Link
                  className="grid h-32 w-24 shrink-0 place-items-center bg-panel text-xl text-stone-600"
                  to={`/product/${item.id}`}
                >
                  {item.imageUrl ? (
                    <img
                      className="h-full w-full object-cover"
                      src={item.imageUrl}
                      alt=""
                    />
                  ) : (
                    <i className="fa-solid fa-shirt" />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-wrap justify-between gap-3">
                  <div>
                    <Link
                      to={`/product/${item.id}`}
                      className="font-display text-xl hover:text-gold"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs text-stone-400">
                      by {item.sellerName}
                    </p>
                    <p className="mt-3 text-sm">
                      Rs. {Number(item.price).toLocaleString()}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs">
                      <button
                        className="grid size-7 place-items-center border border-line"
                        onClick={() => quantity(item.id, item.quantity - 1)}
                      >
                        âˆ’
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        className="grid size-7 place-items-center border border-line"
                        onClick={() => quantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    className="self-start text-xs text-stone-400 hover:text-red-300"
                    onClick={() => remove(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
          <aside className="space-y-5 border border-line bg-panel p-5 sm:p-7">
            <p className="text-xs uppercase tracking-[.18em] text-gold">
              Order summary
            </p>
            <div className="flex justify-between text-sm text-stone-300">
              <span>Subtotal</span>
              <strong className="text-cream">
                Rs. {total.toLocaleString()}
              </strong>
            </div>
            <div className="flex justify-between text-sm text-stone-300">
              <span>Delivery</span>
              <span>Arranged with seller</span>
            </div>
            <div className="flex justify-between border-t border-line pt-4 text-base">
              <span>Total</span>
              <strong>Rs. {total.toLocaleString()}</strong>
            </div>
            <Link className={`${primaryButton} w-full`} to="/checkout">
              Continue to checkout <i className="fa-solid fa-arrow-right" />
            </Link>
            <p className="text-xs leading-5 text-stone-500">
              Each independent seller will coordinate delivery for their items.
            </p>
          </aside>
        </div>
      ) : (
        <EmptyState title="Your bag is taking a breather.">
          <p>Find something you will reach for again and again.</p>
          <Link className={`${primaryButton} mt-5`} to="/shop">
            Explore pieces
          </Link>
        </EmptyState>
      )}
    </PageFrame>
  );
}

export function CheckoutPage() {
  const { user, profile } = useAuth();
  const { items, total, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: profile?.name || "",
    phone: "",
    address: "",
  });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return <Navigate to="/signin" replace />;
  if (profile?.role === "seller") return <Navigate to="/seller" replace />;
  if (!items.length) return <Navigate to="/cart" replace />;
  async function placeOrder(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const sellerIds = [...new Set(items.map((item) => item.sellerUid))];
      await createOrder({
        buyerUid: user.uid,
        buyerName: form.name,
        buyerEmail: user.email,
        phone: form.phone,
        address: form.address,
        sellerIds,
        items: items.map(
          ({
            id,
            title,
            price,
            quantity,
            sellerUid,
            sellerName,
            imageUrl,
          }) => ({
            productId: id,
            title,
            price: Number(price),
            quantity,
            sellerUid,
            sellerName,
            imageUrl: imageUrl || "",
          }),
        ),
        total,
      });
      clear();
      navigate("/account?order=placed");
    } catch (error) {
      setNotice(
        error.message ||
          "We could not place your order. Check your Firestore rules.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageFrame>
      <PageTitle
        eyebrow="Almost yours"
        title={
          <>
            Delivery <em className="text-gold">details.</em>
          </>
        }
      />
      <div className="grid items-start gap-8 lg:grid-cols-[1.2fr_.8fr]">
        <form
          className="space-y-5 border border-line bg-panel p-5 sm:p-8"
          onSubmit={placeOrder}
        >
          <label className="block text-xs text-stone-300">
            Full name
            <input
              className={fieldClass}
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          <label className="block text-xs text-stone-300">
            Phone number
            <input
              className={fieldClass}
              required
              type="tel"
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
          </label>
          <label className="block text-xs text-stone-300">
            Delivery address
            <textarea
              className={fieldClass}
              required
              rows="3"
              value={form.address}
              onChange={(event) =>
                setForm({ ...form, address: event.target.value })
              }
            />
          </label>
          <Notice kind="error">{notice}</Notice>
          <button className={`${primaryButton} w-full`} disabled={busy}>
            {busy
              ? "Placing orderâ€¦"
              : `Place order Â· Rs. ${total.toLocaleString()}`}
          </button>
          <p className="text-xs leading-5 text-stone-500">
            This records an order request in Firestore. The seller confirms
            payment and delivery with you.
          </p>
        </form>
        <aside className="space-y-4 border border-line bg-panel p-5 sm:p-7">
          <p className="text-xs uppercase tracking-[.18em] text-gold">
            Your pieces
          </p>
          {items.map((item) => (
            <div className="flex justify-between gap-3 text-sm" key={item.id}>
              <span className="text-stone-300">
                {item.title} Ã— {item.quantity}
              </span>
              <strong>
                Rs. {(item.price * item.quantity).toLocaleString()}
              </strong>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-4">
            <span>Total</span>
            <strong>Rs. {total.toLocaleString()}</strong>
          </div>
        </aside>
      </div>
    </PageFrame>
  );
}

export function NotFoundPage() {
  return (
    <PageFrame>
      <EmptyState
        title={
          <>
            Nothing here, <em className="text-gold">yet.</em>
          </>
        }
      >
        <Link className={`${primaryButton} mt-5`} to="/">
          Back to the homepage
        </Link>
      </EmptyState>
    </PageFrame>
  );
}
