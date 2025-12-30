import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;

export default async function handler(req, res) {
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: "Key is required" });

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("keydb");
  const keys = db.collection("keys");

  const keyData = await keys.findOne({ key });
  if (!keyData) {
    client.close();
    return res.status(403).json({ error: "Key not generated / not found" });
  }
  if (!keyData.active) {
    client.close();
    return res.status(403).json({ error: "Key revoked" });
  }
  if (keyData.expireAt < new Date()) {
    client.close();
    return res.status(403).json({ error: "Key expired" });
  }

  // Update verified = true หลังตรวจสอบสำเร็จ
  await keys.updateOne({ key }, { $set: { verified: true } });

  client.close();
  res.json({ success: true, message: "Key verified" });
}
