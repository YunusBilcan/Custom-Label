import React, { useState, useMemo } from 'react';
import type { Product } from '../utils/xmlParser';
import { fetchAndParseXML, generateCustomXML } from '../utils/xmlParser';

export default function ProductApp() {
  const [feedUrl, setFeedUrl] = useState('https://fakir.com.tr/xml/googleshopping.com.php?language=tr&currency=TL&country=tr');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [customLabelValue, setCustomLabelValue] = useState('YENI_ETIKET');

  const loadFeed = async () => {
    if (!feedUrl) return;
    setLoading(true);
    setError(null);
    try {
      // Direct fetch relies on CORS being enabled on the target server or running via a proxy.
      // Using a free CORS proxy for client-side fetching as a fallback if needed for testing.
      // For this implementation we will try direct first.
      
      const response = await fetch(`http://localhost:3001/proxy?url=${encodeURIComponent(feedUrl)}`);
      if (!response.ok) throw new Error("HTTP connection error");
      const xmlText = await response.text();
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "application/xml");
      
      const parseError = xmlDoc.getElementsByTagName("parsererror");
      if (parseError.length > 0) {
        throw new Error("Invalid XML feed.");
      }

      const items = xmlDoc.getElementsByTagName("item");
      const parsedProducts: Product[] = [];
      
      const getTagValue = (item: Element, tagName: string) => {
        // Handle namespaced tags like g:id
        const el = item.getElementsByTagName(tagName)[0];
        if (el) return el.textContent || "";
        // Try without namespace for generic rss items just in case
        const elFallback = item.getElementsByTagName(tagName.replace('g:', ''))[0];
        return elFallback ? elFallback.textContent || "" : "";
      };

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        parsedProducts.push({
          id: getTagValue(item, "g:id"),
          title: getTagValue(item, "g:title"),
          description: getTagValue(item, "g:description"),
          price: getTagValue(item, "g:price"),
          condition: getTagValue(item, "g:condition"),
          link: getTagValue(item, "g:link"),
          imageLink: getTagValue(item, "g:image_link"),
          customLabel: getTagValue(item, "g:custom_label_0")
        });
      }

      setProducts(parsedProducts);
    } catch (err: any) {
      setError(err.message || 'Error loading URL.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lower = searchTerm.toLowerCase();
    return products.filter(p => 
      (p.title && p.title.toLowerCase().includes(lower)) ||
      (p.id && p.id.toLowerCase().includes(lower))
    );
  }, [products, searchTerm]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    } else {
      setSelectedProductIds(new Set());
    }
  };

  const handleSelectProduct = (id: string) => {
    const newSelected = new Set(selectedProductIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProductIds(newSelected);
  };

  const handleDownload = () => {
    const selectedProducts = products.filter(p => selectedProductIds.has(p.id));
    if (selectedProducts.length === 0) return;

    const xml = generateCustomXML(selectedProducts, customLabelValue);
    
    // Use octet-stream to force download rather than browser viewer
    const blob = new Blob([xml], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.setAttribute('download', 'custom-feed.xml');
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <input 
          type="text" 
          placeholder="Enter XML Feed URL (e.g., https://fakir.com.tr/...)" 
          value={feedUrl}
          onChange={e => setFeedUrl(e.target.value)}
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-gray-700 bg-gray-50/50"
        />
        <button 
          onClick={loadFeed}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-medium transition-all shadow-sm shadow-blue-600/20 active:scale-[0.98] whitespace-nowrap"
        >
          {loading ? 'Yükleniyor...' : 'Veriyi Çek'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium">
          Hata: {error}. Not: Eğer CORS hatası alıyorsanız tarayıcı eklentisi (Allow CORS) kullanmanız gerekebilir veya link doğrudan istekleri engelliyor olabilir.
        </div>
      )}

      {products.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex-1">
              <input 
                type="text" 
                placeholder="Ürün Ara (Başlık veya ID)..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full md:max-w-xs px-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Custom Label Value" 
                value={customLabelValue}
                onChange={e => setCustomLabelValue(e.target.value)}
                className="flex-1 md:w-48 px-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
              />
              <button 
                onClick={handleDownload}
                disabled={selectedProductIds.size === 0}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-all shadow-sm active:scale-[0.98] whitespace-nowrap"
              >
                XML İndir ({selectedProductIds.size})
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 font-medium">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Ürün Adı</th>
                    <th className="px-4 py-3">Fiyat</th>
                    <th className="px-4 py-3 border-l border-gray-100">Görsel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map(p => (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${selectedProductIds.has(p.id) ? 'bg-blue-50/30' : ''}`}
                      onClick={() => handleSelectProduct(p.id)}
                    >
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={selectedProductIds.has(p.id)}
                          onChange={() => handleSelectProduct(p.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-500">{p.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 line-clamp-2" title={p.title}>{p.title}</td>
                      <td className="px-4 py-3 font-semibold text-green-600 whitespace-nowrap">{p.price}</td>
                      <td className="px-4 py-3 border-l border-gray-100">
                        {p.imageLink && (
                          <img src={p.imageLink} alt={p.title} className="w-10 h-10 object-contain rounded bg-white border border-gray-100" />
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        Arama sonucunda ürün bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex justify-between items-center">
              <span>Toplam: <strong>{products.length}</strong> ürün</span>
              <span>Görüntülenen: <strong>{filteredProducts.length}</strong> ürün</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
