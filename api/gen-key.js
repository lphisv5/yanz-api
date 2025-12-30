import { MongoClient } from "mongodb";
import crypto from "crypto";

const uri = process.env.MONGO_URI;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const { owner } = req.body;
  if (!owner) return res.status(400).json({ error: "Owner required" });

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("keydb");
  const keys = db.collection("keys");

  const existing = await keys.findOne({ owner });
  if (existing) {
    client.close();
    return res.json({ success: true, apiKey: existing.key, message: "Key already generated" });
  }

  const apiKey = "VERCEL-" + crypto.randomBytes(16).toString("hex").toUpperCase();
  await keys.insertOne({
    key: apiKey,
    owner,
    createdAt: new Date(),
    expireAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    active: true,
    used: false,
    verified: false
  });

  client.close();
  res.json({ success: true, apiKey });
}
