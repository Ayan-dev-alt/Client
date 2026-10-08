import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "../firebase/firebase";

const functions = getFunctions(app, "us-central1");

export function watchCollection(name, callback, options = {}) {
  const constraints = [];
  if (options.field) constraints.push(where(options.field, options.operator || "==", options.value));
  return onSnapshot(query(collection(db, name), ...constraints), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
  }, (error) => {
    console.error(`Could not read ${name}`, error);
    callback([]);
    options.onError?.(error);
  });
}

export const addProduct = (data) => addDoc(collection(db, "products"), { ...data, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
export const updateProduct = (id, data) => updateDoc(doc(db, "products", id), { ...data, updatedAt: serverTimestamp() });
export const removeProduct = (id) => updateDoc(doc(db, "products", id), { active: false, updatedAt: serverTimestamp() });
export const addReview = (data) => addDoc(collection(db, "reviews"), { ...data, createdAt: serverTimestamp() });
export const sendMessage = (data) => addDoc(collection(db, "messages"), { ...data, createdAt: serverTimestamp(), read: false });
export const deleteMessage = (id) => deleteDoc(doc(db, "messages", id));
export const markMessageRead = (id) => updateDoc(doc(db, "messages", id), { read: true });
export const createOrder = (data) => httpsCallable(functions, "createMarketplaceOrder")({
  buyerName: data.buyerName,
  phone: data.phone,
  address: data.address,
  items: data.items.map(({ productId, quantity }) => ({ productId, quantity })),
});
export const setOrderStatus = (id, status) => updateDoc(doc(db, "orders", id), { status, updatedAt: serverTimestamp() });
export const setUserRestriction = (uid, restrictedUntil) => updateDoc(doc(db, "users", uid), {
  accountStatus: restrictedUntil ? "restricted" : "active",
  restrictedUntil: restrictedUntil || null,
  updatedAt: serverTimestamp(),
});
export const setProductVisibility = (id, active) => updateDoc(doc(db, "products", id), { active, updatedAt: serverTimestamp() });
export const setReviewVisibility = (id, hidden) => updateDoc(doc(db, "reviews", id), { hidden, updatedAt: serverTimestamp() });

