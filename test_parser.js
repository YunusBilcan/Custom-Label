const xmlText = `<rss><channel>
  <item>
    <g:id>TR1001</g:id>
    <g:title>Test Product</g:title>
    <g:price>100 TL</g:price>
  </item>
  <item>
     <g:id>NON</g:id>
  </item>
  <item>
    <id>41003730</id>
    <g:custom_label_0>OLD</g:custom_label_0>
  </item>
</channel></rss>`;

const selectedIds = ['TR1001', '41003730'];
const customLabelValue = 'MY_CUSTOM_TEST';

const escapeXML = (unsafe) => String(unsafe).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/g;

const modifiedXml = xmlText.replace(itemRegex, (match) => {
    const idMatch = match.match(/<(?:g:)?id>(.*?)<\/(?:g:)?id>/);
    const itemId = idMatch ? idMatch[1].trim() : null;
    
    if (itemId && selectedIds.includes(itemId)) {
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

console.log(modifiedXml);
