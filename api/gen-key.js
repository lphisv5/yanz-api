import { MongoClient } from "mongodb";
import crypto from "crypto";

const uri = process.env.MONGO_URI;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { owner } = req.body;
  if (!owner) return res.status(400).json({ error: "Owner is required" });

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("yanz");
  const keys = db.collection("keys");

  const exists = await keys.findOne({ owner });
  if (exists) {
    client.close();
    return res.json({ success: true, apiKey: exists.key, message: "Key already exists" });
  }

  const apiKey = "YZN-" + crypto.randomBytes(16).toString("hex").toUpperCase();
  await keys.insertOne({
    owner,
    key: apiKey,
    active: true,
    verified: false,
    used: false,
    createdAt: new Date(),
    expireAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) // 1 ปี
  });

  client.close();
  res.json({ success: true, apiKey });
}
