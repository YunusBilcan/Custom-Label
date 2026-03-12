export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  condition: string;
  link: string;
  imageLink: string;
  customLabel: string;
}

export const fetchAndParseXML = async (url: string): Promise<Product[]> => {
  try {
    // using a CORS proxy if needed, but assuming direct access for now
    const response = await fetch(url);
    const xmlText = await response.text();
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    // Check for parse error
    const parseError = xmlDoc.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      throw new Error("Error parsing XML feed.");
    }
    
    const items = xmlDoc.getElementsByTagName("item");
    const products: Product[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Helper function to get text content safely
      const getTagValue = (tagName: string) => {
        const el = item.getElementsByTagName(tagName)[0];
        return el ? el.textContent || "" : "";
      };

      products.push({
        id: getTagValue("g:id"),
        title: getTagValue("title") || getTagValue("g:title"), // Support alternate tags
        description: getTagValue("description") || getTagValue("g:description"),
        price: getTagValue("g:price"),
        condition: getTagValue("g:condition"),
        link: getTagValue("link") || getTagValue("g:link"),
        imageLink: getTagValue("g:image_link"),
        customLabel: getTagValue("g:custom_label_0") // Keep existing if any
      });
    }
    
    return products;
  } catch (error) {
    console.error("Failed to fetch/parse XML:", error);
    throw error;
  }
};

export const generateCustomXML = (products: Product[], customLabelValue: string): string => {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n`;
  xml += `  <channel>\n`;
  xml += `    <title>Custom Label Feed</title>\n`;
  xml += `    <link>http://example.com</link>\n`;
  xml += `    <description>Generated custom label feed</description>\n`;

  products.forEach(p => {
    xml += `    <item>\n`;
    xml += `      <g:id>${escapeXML(p.id)}</g:id>\n`;
    xml += `      <g:title>${escapeXML(p.title)}</g:title>\n`;
    xml += `      <g:description>${escapeXML(p.description)}</g:description>\n`;
    xml += `      <g:price>${escapeXML(p.price)}</g:price>\n`;
    xml += `      <g:condition>${escapeXML(p.condition)}</g:condition>\n`;
    xml += `      <g:availability>true</g:availability>\n`;
    xml += `      <g:link>${escapeXML(p.link)}</g:link>\n`;
    if (p.imageLink) {
      xml += `      <g:image_link>${escapeXML(p.imageLink)}</g:image_link>\n`;
    }
    xml += `      <g:custom_label_0>${escapeXML(customLabelValue)}</g:custom_label_0>\n`;
    xml += `    </item>\n`;
  });

  xml += `  </channel>\n</rss>`;
  return xml;
};

// Helper function to escape special XML characters
const escapeXML = (unsafe: string) => {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};
