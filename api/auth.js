import { connectDB } from '../lib/mongodb';
import mongoose from 'mongoose';

const keySchema = new mongoose.Schema({
  key: { type: String, unique: true },
  owner: String,
  used: { type: Boolean, default: false },
});

const Key = mongoose.models.Key || mongoose.model('Key', keySchema);

export default async function handler(req, res) {
  try {
    await connectDB();

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'Key required' });

    const found = await Key.findOne({ key });
    if (!found) return res.status(404).json({ error: 'Key not found or not generated' });

    res.status(200).json({ key: found.key, owner: found.owner, used: found.used });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
