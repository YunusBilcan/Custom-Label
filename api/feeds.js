import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const { feedUrl, selectedIds, customLabelValue } = req.body;
      if (!feedUrl || !selectedIds || !Array.isArray(selectedIds)) {
        return res.status(400).json({ error: 'Invalid payload' });
      }

      // Check for duplicates
      let existingFeeds = await kv.get('all_feeds');
      if (!existingFeeds) existingFeeds = {};

      const isDuplicate = Object.values(existingFeeds).some((f) => f.customLabelValue === customLabelValue);
      if (isDuplicate) {
        return res.status(400).json({ error: `"${customLabelValue}" adına sahip bir etiket zaten var. Lütfen farklı bir isim seçin.` });
      }

      const id = uuidv4();
      existingFeeds[id] = {
        feedUrl,
        selectedIds,
        customLabelValue,
        createdAt: new Date().toISOString()
      };
      
      await kv.set('all_feeds', existingFeeds);

      // We determine base URL from request headers in serverless context
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      
      return res.status(200).json({
        success: true,
        feedId: id,
        liveUrl: `${protocol}://${host}/api/liveFeed?id=${id}`
      });
    }

    if (req.method === 'GET') {
      let existingFeeds = await kv.get('all_feeds');
      if (!existingFeeds) existingFeeds = {};

      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;

      const list = Object.keys(existingFeeds).map(id => ({
        id,
        feedUrl: existingFeeds[id].feedUrl,
        selectedCount: existingFeeds[id].selectedIds ? existingFeeds[id].selectedIds.length : 0,
        customLabelValue: existingFeeds[id].customLabelValue,
        createdAt: existingFeeds[id].createdAt,
        liveUrl: `${protocol}://${host}/api/liveFeed?id=${id}`
      })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      return res.status(200).json(list);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
