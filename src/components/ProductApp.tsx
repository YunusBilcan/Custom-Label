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
  
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [feedHistory, setFeedHistory] = useState<any[]>([]);
  const proxyApiBase = import.meta.env.PROD ? '/api/feeds' : 'http://localhost:3001/api/feeds';

  React.useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(proxyApiBase);
      if (res.ok) {
        const data = await res.json();
        setFeedHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const handleDeleteFeed = async (id: string) => {
    if (!window.confirm("Bu canlı linki silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`${proxyApiBase}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
        if (liveUrl && liveUrl.includes(id)) {
          setLiveUrl(null);
        }
      } else {
        alert("Silinirken hata oluştu.");
      }
    } catch (err) {
      console.error(err);
      alert("Silme işlemi başarısız.");
    }
  };

  const loadFeed = async () => {
    if (!feedUrl) return;
    setLoading(true);
    setError(null);
    try {
      // Direct fetch relies on CORS being enabled on the target server or running via a proxy.
      // Using a free CORS proxy for client-side fetching as a fallback if needed for testing.
      // For this implementation we will try direct first.
      
      const proxyBaseUrl = import.meta.env.PROD ? '/api/proxy' : 'http://localhost:3001/proxy';
      const response = await fetch(`${proxyBaseUrl}?url=${encodeURIComponent(feedUrl)}`);
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

  const handleGenerateLiveLink = async () => {
    if (selectedProductIds.size === 0) return;
    setIsGenerating(true);
    setLiveUrl(null);
    try {
      const selectedIdsArray = Array.from(selectedProductIds);
      const res = await fetch(proxyApiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedUrl,
          selectedIds: selectedIdsArray,
          customLabelValue
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      
      setLiveUrl(data.liveUrl);
      fetchHistory(); // Refresh the list
    } catch (err: any) {
      alert(`Hata: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
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
                onClick={handleGenerateLiveLink}
                disabled={selectedProductIds.size === 0 || isGenerating}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-all shadow-sm active:scale-[0.98] whitespace-nowrap"
              >
                {isGenerating ? 'Oluşturuluyor...' : `Canlı Link Oluştur (${selectedProductIds.size})`}
              </button>
            </div>
          </div>

          {liveUrl && (
            <div className="mb-6 p-4 bg-green-50 rounded-xl border border-green-200 flex flex-col md:flex-row items-start md:items-center gap-4 justify-between animate-in fade-in">
              <div className="flex-1 overflow-hidden min-w-0">
                <p className="text-sm text-green-800 font-semibold mb-1 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Canlı XML Linkiniz Hazır!
                </p>
                <div className="text-xs text-green-700 font-mono bg-white px-3 py-2 rounded border border-green-100 truncate flex items-center shadow-sm">
                  <span className="truncate w-full block select-all whitespace-nowrap overflow-x-auto no-scrollbar" title={liveUrl}>{liveUrl}</span>
                </div>
                <p className="text-xs text-green-600 mt-2 font-medium">Bu linkteki veriler ana XML'inizden eşzamanlı çekilir; fiyat ve stok bilgileri daima günceldir.</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(liveUrl);
                  alert('Link kopyalandı!');
                }}
                className="px-5 py-2.5 bg-white text-green-700 hover:bg-green-50 border border-green-200 rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow active:scale-[0.98] whitespace-nowrap shrink-0"
              >
                Kopyala
              </button>
            </div>
          )}

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

      {/* History Section */}
      <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
          Oluşturulan Canlı Linkler
        </h2>
        {feedHistory.length === 0 ? (
          <p className="text-sm text-gray-500">Henüz hiç canlı link oluşturmadınız.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-medium">
                <tr>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Seçilen Sayısı</th>
                  <th className="px-4 py-3">Custom Label</th>
                  <th className="px-4 py-3">Canlı Link</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {feedHistory.map(feed => (
                  <tr key={feed.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(feed.createdAt).toLocaleString('tr-TR')}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{feed.selectedCount}</td>
                    <td className="px-4 py-3 font-mono text-xs">{feed.customLabelValue}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">
                      <a href={feed.liveUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline" title={feed.liveUrl}>
                        {feed.liveUrl}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => handleDeleteFeed(feed.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded transition-colors text-xs font-medium"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
