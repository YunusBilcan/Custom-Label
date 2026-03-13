import { kv } from '@vercel/kv';

const escapeXML = (unsafe) => {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).send('No feed ID provided');
  }

  try {
    let existingFeeds = await kv.get('all_feeds');
    
    // In Vercel KV, it might return string or object depending on structure
    if (typeof existingFeeds === 'string') {
        try {
            existingFeeds = JSON.parse(existingFeeds);
        } catch(e){}
    }
    
    const feedConfig = existingFeeds ? existingFeeds[id] : null;

    if (!feedConfig) {
      return res.status(404).send('Feed not found');
    }

    const { feedUrl, selectedIds, customLabelValue } = feedConfig;
    
    const response = await fetch(feedUrl);
    if (!response.ok) throw new Error(`HTTP error source feed: ${response.status}`);
    
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    const xmlText = await response.text();
    
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
    
    const modifiedXml = xmlText.replace(itemRegex, (match) => {
        const idMatch = match.match(/<(?:g:)?id>(.*?)<\/(?:g:)?id>/);
        let itemId = idMatch ? idMatch[1].trim() : null;
        
        if (itemId) {
            itemId = itemId.replace(/^<!\[CDATA\[(.*?)]]>$/, '$1').trim();
        }
        
        if (itemId && selectedIds.includes(itemId)) {
            const outOfStockPattern = /<(?:g:)?availability>\s*(?:<!\[CDATA\[\s*)?out\s*of\s*stock(?:\s*]]>)?\s*<\/(?:g:)?availability>/i;
            const zeroQuantityPattern = /<(?:g:)?quantity>\s*(?:<!\[CDATA\[\s*)?0(?:\s*]]>)?\s*<\/(?:g:)?quantity>/i;
            const zeroStockPattern = /<(?:g:)?stock>\s*(?:<!\[CDATA\[\s*)?0(?:\s*]]>)?\s*<\/(?:g:)?stock>/i;
            
            if (outOfStockPattern.test(match) || zeroQuantityPattern.test(match) || zeroStockPattern.test(match)) {
                return '';
            }

            const customLabelSafe = escapeXML(customLabelValue);
            const customLabelTag = `<g:custom_label_0>${customLabelSafe}</g:custom_label_0>`;
            
            let newItem = match;
            if (/<g:custom_label_0>[\s\S]*?<\/g:custom_label_0>/.test(newItem)) {
                newItem = newItem.replace(/<g:custom_label_0>[\s\S]*?<\/g:custom_label_0>/, customLabelTag);
            } else {
                newItem = newItem.replace(/<\/item>/, `    ${customLabelTag}\n</item>`);
            }
            return newItem;
        }
        return '';
    });
    
    return res.status(200).send(modifiedXml);

  } catch (error) {
    console.error('Feed generation error:', error);
    return res.status(500).send(`Error processing feed: ${error.message}`);
  }
}
