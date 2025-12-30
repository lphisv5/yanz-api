import { connectDB } from '../lib/mongodb';
import mongoose from 'mongoose';

const keySchema = new mongoose.Schema({
  key: { type: String, unique: true },
  owner: String,
  used: { type: Boolean, default: false },
});

const Key = mongoose.models.Key || mongoose.model('Key', keySchema);

function generateRandomKey(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export default async function handler(req, res) {
  try {
    await connectDB();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { owner } = req.body;
    if (!owner) return res.status(400).json({ error: 'Owner required' });

    const key = generateRandomKey(20);
    await Key.create({ key, owner });

    res.status(200).json({ key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
