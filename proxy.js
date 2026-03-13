import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json()); // Allow JSON payloads

const FEEDS_FILE = path.join(process.cwd(), 'feeds.json');

// Ensure feeds.json exists
if (!fs.existsSync(FEEDS_FILE)) {
  fs.writeFileSync(FEEDS_FILE, JSON.stringify({}));
}

function getFeeds() {
  try {
    const data = fs.readFileSync(FEEDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

function saveFeeds(feeds) {
  fs.writeFileSync(FEEDS_FILE, JSON.stringify(feeds, null, 2));
}

// Still serve the proxy for client-side fetches
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const contentType = response.headers.get('content-type') || 'application/xml';
    res.setHeader('Content-Type', contentType);
    
    const text = await response.text();
    res.send(text);
  } catch (error) {
    res.status(500).send(`Error fetching URL: ${error.message}`);
  }
});

// Endpoint: Generate Live Feed URL
app.post('/api/feeds', (req, res) => {
  const { feedUrl, selectedIds, customLabelValue } = req.body;
  if (!feedUrl || !selectedIds || !Array.isArray(selectedIds)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const feeds = getFeeds();

  // Check if a feed with the same customLabelValue already exists
  const isDuplicate = Object.values(feeds).some(f => f.customLabelValue === customLabelValue);
  if (isDuplicate) {
    return res.status(400).json({ error: `"${customLabelValue}" adına sahip bir etiket zaten var. Lütfen farklı bir isim seçin.` });
  }

  const id = uuidv4();
  feeds[id] = {
    feedUrl,
    selectedIds,
    customLabelValue,
    createdAt: new Date().toISOString()
  };
  saveFeeds(feeds);

  res.json({
    success: true,
    feedId: id,
    liveUrl: `http://localhost:${PORT}/feed/${id}` // Replace with production domain if deployed
  });
});

// Endpoint: Get all generated feeds
app.get('/api/feeds', (req, res) => {
  const feeds = getFeeds();
  // Strip large selectedIds arrays to reduce payload size if we want, or keep them
  const list = Object.keys(feeds).map(id => ({
    id,
    feedUrl: feeds[id].feedUrl,
    selectedCount: feeds[id].selectedIds ? feeds[id].selectedIds.length : 0,
    customLabelValue: feeds[id].customLabelValue,
    createdAt: feeds[id].createdAt,
    liveUrl: `http://localhost:${PORT}/feed/${id}`
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json(list);
});

// Endpoint: Delete a feed
app.delete('/api/feeds/:id', (req, res) => {
  const { id } = req.params;
  const feeds = getFeeds();
  
  if (!feeds[id]) {
    return res.status(404).json({ error: 'Feed not found' });
  }
  
  delete feeds[id];
  saveFeeds(feeds);
  
  res.json({ success: true, message: 'Deleted' });
});

const escapeXML = (unsafe) => {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Endpoint: Evaluate and Stream Live XML
app.get('/feed/:id', async (req, res) => {
  const { id } = req.params;
  const feeds = getFeeds();
  const feedConfig = feeds[id];

  if (!feedConfig) {
    return res.status(404).send('Feed not found');
  }

  try {
    const { feedUrl, selectedIds, customLabelValue } = feedConfig;
    console.log(`Generating live feed for ID: ${id} fetching ${feedUrl}`);
    
    const response = await fetch(feedUrl);
    if (!response.ok) throw new Error(`HTTP error source feed: ${response.status}`);
    
    const xmlText = await response.text();
    
    // We will parse the raw string precisely to replace items without breaking namespaces.
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
    
    const modifiedXml = xmlText.replace(itemRegex, (match) => {
        // Find g:id or id
        const idMatch = match.match(/<(?:g:)?id>(.*?)<\/(?:g:)?id>/);
        let itemId = idMatch ? idMatch[1].trim() : null;
        
        if (itemId) {
            // Strip CDATA tags if present
            itemId = itemId.replace(/^<!\[CDATA\[(.*?)]]>$/, '$1').trim();
        }
        
        if (itemId && selectedIds.includes(itemId)) {
            // Check for stock/availability being 0 or out of stock
            const outOfStockPattern = /<(?:g:)?availability>\s*(?:<!\[CDATA\[\s*)?out\s*of\s*stock(?:\s*]]>)?\s*<\/(?:g:)?availability>/i;
            const zeroQuantityPattern = /<(?:g:)?quantity>\s*(?:<!\[CDATA\[\s*)?0(?:\s*]]>)?\s*<\/(?:g:)?quantity>/i;
            const zeroStockPattern = /<(?:g:)?stock>\s*(?:<!\[CDATA\[\s*)?0(?:\s*]]>)?\s*<\/(?:g:)?stock>/i;
            
            if (outOfStockPattern.test(match) || zeroQuantityPattern.test(match) || zeroStockPattern.test(match)) {
                // Skip this item since it's out of stock
                return '';
            }

            // Keep and modify this item
            const customLabelSafe = escapeXML(customLabelValue);
            const customLabelTag = `<g:custom_label_0>${customLabelSafe}</g:custom_label_0>`;
            
            let newItem = match;
            // Does it already have g:custom_label_0?
            if (/<g:custom_label_0>[\s\S]*?<\/g:custom_label_0>/.test(newItem)) {
                newItem = newItem.replace(/<g:custom_label_0>[\s\S]*?<\/g:custom_label_0>/, customLabelTag);
            } else {
                newItem = newItem.replace(/<\/item>/, `    ${customLabelTag}\n</item>`);
            }
            return newItem;
        }
        
        // Remove unselected items
        return '';
    });
    
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(modifiedXml);

  } catch (error) {
    console.error('Error in feed generation:', error.message);
    res.status(500).send(`Error processing feed: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`CORS Proxy Server running at http://localhost:${PORT}`);
});
