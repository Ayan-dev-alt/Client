import { useEffect, useMemo, useState } from "react";
import { arrayRemove, arrayUnion, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "./auth";
import { WishlistContext } from "./wishlist";

export function WishlistProvider({ children }) {
  const { user, profile } = useAuth();
  const [snapshot, setSnapshot] = useState({ uid: null, productIds: [] });
  useEffect(() => {
    if (!user || profile?.role !== "buyer") return undefined;
    return onSnapshot(doc(db, "wishlists", user.uid), (result) => setSnapshot({ uid: user.uid, productIds: result.data()?.productIds || [] }), (error) => console.error("Could not load wishlist", error));
  }, [user, profile?.role]);
  const productIds = useMemo(() => snapshot.uid === user?.uid && profile?.role === "buyer" ? snapshot.productIds : [], [snapshot, user?.uid, profile?.role]);
  const value = useMemo(() => ({
    productIds,
    has(id) { return productIds.includes(id); },
    async toggle(product) {
      if (!user) throw new Error("Sign in to save pieces to your wishlist.");
      if (profile?.role !== "buyer") throw new Error("Wishlists are available on buyer accounts.");
      const ref = doc(db, "wishlists", user.uid);
      if (productIds.includes(product.id)) await updateDoc(ref, { productIds: arrayRemove(product.id) });
      else await setDoc(ref, { buyerUid: user.uid, productIds: arrayUnion(product.id) }, { merge: true });
    },
  }), [productIds, user, profile?.role]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
