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

  // เช็คว่าผ่าน API Auth หรือยัง
  if (!keyData.verified) {
    client.close();
    return res.status(403).json({ error: "Key not verified yet" });
  }

  // Update used = true
  if (!keyData.used) {
    await keys.updateOne({ key }, { $set: { used: true } });
  }

  client.close();
  res.json({ success: true, message: "Check-in success", owner: keyData.owner });
}
