// テーブルごとのQRトークン。サーバーはハッシュだけを、クライアントから
// 読めない restaurants/{r}/table_secrets/{t} に保存する。
// ENFORCE_TABLE_TOKEN=true のときだけ照合し、それまでは既存のQRがそのまま使える。
const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");

const tokenEnforced = () => process.env.ENFORCE_TABLE_TOKEN === "true";
const hashTableToken = (token) =>
  createHash("sha256").update(token).digest("hex");
// 144 random bits, URL-safe (24 characters).
const newTableToken = () => randomBytes(18).toString("base64url");
const tableSecretRef = (db, restaurantId, tableId) =>
  db
    .collection("restaurants")
    .doc(restaurantId)
    .collection("table_secrets")
    .doc(tableId);
const matchesTableToken = (secret, token) => {
  if (!secret?.exists || typeof token !== "string") return false;
  const expected = Buffer.from(secret.data().token_hash || "", "hex");
  const actual = Buffer.from(hashTableToken(token), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

// Issue (or rotate) tokens for tables. Only the hashes are stored; the
// returned tokens go into the printed QR codes and are not kept anywhere.
const issueTableTokens = async (db, restaurantId, tableIds) => {
  const tables = db
    .collection("restaurants")
    .doc(restaurantId)
    .collection("tables");
  const issued = [];
  const batch = db.batch();
  for (const tableId of tableIds) {
    const table = await tables.doc(tableId).get();
    if (!table.exists) throw new Error(`Table not found: ${tableId}`);
    const token = newTableToken();
    batch.set(tableSecretRef(db, restaurantId, tableId), {
      token_hash: hashTableToken(token),
      rotated_at: new Date(),
    });
    issued.push({
      tableId,
      tableNumber: table.data().table_number ?? "",
      token,
    });
  }
  await batch.commit();
  return issued;
};

module.exports = {
  issueTableTokens,
  tokenEnforced,
  hashTableToken,
  newTableToken,
  tableSecretRef,
  matchesTableToken,
};
