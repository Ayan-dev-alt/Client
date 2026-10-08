import { httpsCallable, getFunctions } from "firebase/functions";
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { app, db } from "../firebase/firebase";

const functions = getFunctions(app, "us-central1");
export const permanentlyDeleteUser = httpsCallable(functions, "deleteMarketplaceAccount");

// Self-deletion fallback that works on Firebase Spark: users can remove only
// records they own. Shared order records are retained with buyer details erased.
export async function deleteOwnMarketplaceData(user, role) {
  const uid = user.uid;
  const find = async (name, field) => (await getDocs(query(collection(db, name), where(field, "==", uid)))).docs;
  const [products, reviews, buyerMessages, sellerMessages, receivedMessages, buyerOrders] = await Promise.all([
    role === "seller" ? find("products", "sellerUid") : Promise.resolve([]),
    find("reviews", "buyerUid"),
    find("messages", "buyerUid"),
    find("messages", "sellerUid"),
    find("messages", "recipientUid"),
    find("orders", "buyerUid"),
  ]);

  const toDelete = new Map();
  for (const snapshot of [...products, ...reviews, ...buyerMessages, ...sellerMessages, ...receivedMessages]) {
    toDelete.set(snapshot.ref.path, snapshot.ref);
  }
  const deleteRefs = [...toDelete.values()];
  for (let offset = 0; offset < deleteRefs.length; offset += 450) {
    const batch = writeBatch(db);
    deleteRefs.slice(offset, offset + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  for (let offset = 0; offset < buyerOrders.length; offset += 450) {
    const batch = writeBatch(db);
    buyerOrders.slice(offset, offset + 450).forEach((snapshot) => batch.update(snapshot.ref, {
      buyerUid: "deleted",
      buyerDeleted: true,
      buyerName: "Deleted account",
      buyerEmail: "",
      phone: "",
      address: "",
      updatedAt: serverTimestamp(),
    }));
    await batch.commit();
  }

  await deleteDoc(doc(db, "wishlists", uid));
  await deleteDoc(doc(db, "users", uid));
}
