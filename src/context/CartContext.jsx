import { useEffect, useMemo, useState } from "react";
import { CartContext } from "./cart";

const readCart = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("nbf-cart") || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) => item && typeof item.id === "string"
      && Number.isFinite(Number(item.price))
      && Number.isInteger(Number(item.quantity))
      && Number(item.quantity) > 0)
      .map((item) => ({ ...item, price: Number(item.price), quantity: Number(item.quantity) }));
  } catch { return []; }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart);
  useEffect(() => { try { localStorage.setItem("nbf-cart", JSON.stringify(items)); } catch { /* The in-memory cart remains usable if browser storage is unavailable. */ } }, [items]);
  const value = useMemo(() => ({
    items,
    add(product) { setItems((current) => { const found = current.find((item) => item.id === product.id); const limit = Math.max(0, Number(product.stock) || 0); if (found) return current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(limit, item.quantity + 1) } : item); return limit > 0 ? [...current, { ...product, quantity: 1 }] : current; }); },
    quantity(id, amount) {
      setItems((current) => current.map((item) => item.id === id
        ? { ...item, quantity: Math.min(Math.max(1, Math.trunc(Number(amount) || 1)), Math.max(1, Math.trunc(Number(item.stock) || 1))) }
        : item));
    },
    remove(id) { setItems((current) => current.filter((item) => item.id !== id)); },
    clear() { setItems([]); },
    total: items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0),
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
