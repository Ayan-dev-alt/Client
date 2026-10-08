const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();

const ADMIN_EMAILS = new Set([
  "hafizjunaid09478@gmail.com",
  "m.ayanali051@gmail.com",
]);

exports.createMarketplaceOrder = onCall({ region: "us-central1", timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in before placing an order.");
  const uid = request.auth.uid;
  const { buyerName, phone, address, items } = request.data || {};
  if (typeof buyerName !== "string" || !buyerName.trim() || buyerName.trim().length > 80) {
    throw new HttpsError("invalid-argument", "Enter a valid name.");
  }
  if (typeof phone !== "string" || phone.trim().length > 30 || phone.replace(/\D/g, "").length < 7) {
    throw new HttpsError("invalid-argument", "Enter a valid phone number.");
  }
  if (typeof address !== "string" || address.trim().length < 8 || address.trim().length > 500) {
    throw new HttpsError("invalid-argument", "Enter a valid delivery address.");
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    throw new HttpsError("invalid-argument", "An order must contain 1 to 50 products.");
  }

  const cleanItems = items.map((item) => ({ productId: item?.productId, quantity: item?.quantity }));
  if (cleanItems.some((item) => typeof item.productId !== "string" || !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100)
    || new Set(cleanItems.map((item) => item.productId)).size !== cleanItems.length) {
    throw new HttpsError("invalid-argument", "The order contains invalid or repeated products.");
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const orderRef = db.collection("orders").doc();
  const productRefs = cleanItems.map((item) => db.doc(`products/${item.productId}`));
  return db.runTransaction(async (transaction) => {
    const buyerSnapshot = await transaction.get(userRef);
    if (!buyerSnapshot.exists || buyerSnapshot.data().role !== "buyer") {
      throw new HttpsError("permission-denied", "Only active buyer accounts can place orders.");
    }
    const buyer = buyerSnapshot.data();
    if (buyer.accountStatus === "restricted") {
      const until = buyer.restrictedUntil?.toDate?.();
      if (!until || until > new Date()) throw new HttpsError("permission-denied", "This account is temporarily suspended.");
    }

    const productSnapshots = [];
    for (const ref of productRefs) productSnapshots.push(await transaction.get(ref));
    const sellerIds = [...new Set(productSnapshots.map((snapshot) => snapshot.data()?.sellerUid).filter(Boolean))];
    const sellerRefs = sellerIds.map((sellerUid) => db.doc(`users/${sellerUid}`));
    const sellerSnapshots = [];
    for (const ref of sellerRefs) sellerSnapshots.push(await transaction.get(ref));
    const sellers = new Map(sellerIds.map((sellerUid, index) => [sellerUid, sellerSnapshots[index].data()]));

    const orderItems = cleanItems.map((requested, index) => {
      const snapshot = productSnapshots[index];
      if (!snapshot.exists) throw new HttpsError("not-found", "A product in your bag is no longer available.");
      const product = snapshot.data();
      const seller = sellers.get(product.sellerUid);
      const sellerUntil = seller?.restrictedUntil?.toDate?.();
      const sellerSuspended = seller?.accountStatus === "restricted" && (!sellerUntil || sellerUntil > new Date());
      if (product.active === false || !seller || seller.role !== "seller" || sellerSuspended) {
        throw new HttpsError("failed-precondition", `${product.title || "A product"} is no longer available.`);
      }
      const price = Number(product.price);
      const stock = Number(product.stock);
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(stock) || stock < requested.quantity) {
        throw new HttpsError("failed-precondition", `${product.title || "A product"} does not have enough stock.`);
      }
      return {
        ref: snapshot.ref,
        stock,
        item: {
          productId: snapshot.id,
          title: product.title || "Product",
          price,
          quantity: requested.quantity,
          sellerUid: product.sellerUid,
          sellerName: product.sellerName || seller.name || "Independent seller",
          imageUrl: product.imageUrl || "",
        },
      };
    });

    const total = orderItems.reduce((sum, entry) => sum + entry.item.price * entry.item.quantity, 0);
    if (!Number.isFinite(total) || total <= 0 || total > 1000000000) {
      throw new HttpsError("failed-precondition", "The order total is invalid.");
    }
    for (const entry of orderItems) transaction.update(entry.ref, {
      stock: entry.stock - entry.item.quantity,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(orderRef, {
      buyerUid: uid,
      buyerName: buyerName.trim(),
      buyerEmail: request.auth.token.email || "",
      phone: phone.trim(),
      address: address.trim(),
      sellerIds,
      items: orderItems.map((entry) => entry.item),
      total,
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
    });
    return { orderId: orderRef.id, total };
  });
});

exports.deleteMarketplaceAccount = onCall({ region: "us-central1", timeoutSeconds: 300 }, async (request) => {
  const email = request.auth?.token.email?.toLowerCase();
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in before deleting an account.");

  const uid = request.data?.uid;
  if (typeof uid !== "string" || !uid) {
    throw new HttpsError("invalid-argument", "Choose a valid account to remove.");
  }
  const isSelfDelete = uid === request.auth.uid;
  const isVerifiedAdmin = request.auth.token.email_verified === true && ADMIN_EMAILS.has(email);
  if (!isSelfDelete && !isVerifiedAdmin) throw new HttpsError("permission-denied", "Verified admin access is required to delete another account.");

  const auth = getAuth();
  const db = getFirestore();
  const [target, userProfile] = await Promise.all([
    auth.getUser(uid).catch((error) => {
      if (error.code === "auth/user-not-found") return null;
      throw error;
    }),
    db.doc(`users/${uid}`).get(),
  ]);
  if (!isSelfDelete && (ADMIN_EMAILS.has((target?.email || "").toLowerCase()) || userProfile.data()?.role === "admin")) {
    throw new HttpsError("failed-precondition", "Admin accounts cannot be deleted from this dashboard.");
  }

  const own = (name, field) => db.collection(name).where(field, "==", uid).get();
  const [products, buyerReviews, sellerReviews, buyerMessages, sellerMessages, buyerOrders, sellerOrders] = await Promise.all([
    own("products", "sellerUid"),
    own("reviews", "buyerUid"),
    own("reviews", "sellerUid"),
    own("messages", "buyerUid"),
    own("messages", "sellerUid"),
    own("orders", "buyerUid"),
    db.collection("orders").where("sellerIds", "array-contains", uid).get(),
  ]);

  const records = new Map();
  for (const snapshot of [products, buyerReviews, sellerReviews, buyerMessages, sellerMessages, buyerOrders, sellerOrders]) {
    snapshot.docs.forEach((item) => records.set(item.ref.path, item.ref));
  }
  records.set(`users/${uid}`, db.doc(`users/${uid}`));
  records.set(`wishlists/${uid}`, db.doc(`wishlists/${uid}`));
  const refs = [...records.values()];
  for (let index = 0; index < refs.length; index += 450) {
    const batch = db.batch();
    refs.slice(index, index + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  if (target) await auth.deleteUser(uid);
  return { deleted: true, authAccountRemoved: Boolean(target), uid, removedRecords: refs.length };
});
