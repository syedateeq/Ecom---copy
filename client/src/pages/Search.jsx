import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import API from '../utils/api';
import ProductCard from '../components/ProductCard';
import NearbyStoresFinder from '../components/NearbyStoresFinder';
import { HiSearch, HiFilter, HiSortDescending, HiX, HiShoppingBag, HiExternalLink, HiLink, HiTrendingDown } from 'react-icons/hi';

export default function Search() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || searchParams.get('url') || '');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState('');
  const [budget, setBudget] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');

  const isUrl = (str) => str.startsWith('http://') || str.startsWith('https://');

  useEffect(() => {
    const q = searchParams.get('q');
    const url = searchParams.get('url');

    if (url) {
      setQuery(url);
      doCompare(url);
    } else if (q) {
      setQuery(q);
      doCompare(q);
    }
  }, [searchParams]);

  const doCompare = async (input) => {
    setLoading(true);
    setError('');
    setMeta(null);
    setResults(null);

    try {
      let data;

      if (isUrl(input)) {
        const res = await API.post('/products/url-search', { url: input });
        data = res.data;
      } else {
        const res = await API.get(`/products/search?q=${encodeURIComponent(input)}`);
        data = res.data;
      }

      setMeta({
        product: data.query || data.extractedTitle || input,
        platform: data.sourcePlatform || null,
        resolvedUrl: data.sourceUrl || null,
        isUrl: !!data.wasShortLink || isUrl(input),
      });

      let filteredOnline = data.onlinePrices || [];
      let filteredOffline = data.offlineProducts || [];

      const maxBudget = budget ? parseFloat(budget) : Infinity;

      if (maxBudget !== Infinity) {
        filteredOnline = filteredOnline.filter((p) => p.price <= maxBudget);
        filteredOffline = filteredOffline.filter((p) => p.price <= maxBudget);
      }

      if (sort === 'price') {
        filteredOnline.sort((a, b) => a.price - b.price);
        filteredOffline.sort((a, b) => a.price - b.price);
      } else if (sort === 'rating') {
        filteredOnline.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        filteredOffline.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else if (sort === 'distance') {
        filteredOffline.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      const bestPrice =
        data.recommendations?.bestOverallValue ||
        data.recommendations?.cheapestOnline ||
        data.recommendations?.bestNearbyShop ||
        null;

      setResults({
        onlinePrices: filteredOnline,
        offlineProducts: filteredOffline,
        bestPrice,
        totalResults: data.totalResults || filteredOnline.length + filteredOffline.length,
      });
    } catch (err) {
      console.error('Search error:', err);
      const message = err.response?.data?.message || 'Unable to search products. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (isUrl(trimmed)) {
      navigate(`/search?url=${encodeURIComponent(trimmed)}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const filteredOnline = results?.onlinePrices || [];
  const filteredOffline = results?.offlineProducts || [];
  const bestPrice = results?.bestPrice || null;

  const platformColors = {
    Amazon: { bg: 'rgba(255,153,0,0.12)', border: 'rgba(255,153,0,0.3)', text: '#FF9900' },
    Flipkart: { bg: 'rgba(47,128,237,0.12)', border: 'rgba(47,128,237,0.3)', text: '#2F80ED' },
  };

  return (
    <div className="min-h-screen py-8 px-4 max-w-7xl mx-auto">
      <form onSubmit={handleSearch} className="mb-8 animate-fade-in-up">
        <div className="flex items-center glass-card !rounded-2xl overflow-hidden">
          <HiSearch className="text-xl text-muted ml-5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product name or paste Amazon / Flipkart link…"
            className="flex-1 bg-transparent border-none outline-none px-4 py-4 text-text placeholder:text-muted"
          />
          <button type="submit" className="btn-primary !rounded-xl mr-2 !py-2.5 !px-6">
            Search
          </button>
        </div>
      </form>

      {meta?.isUrl && meta?.platform && !loading && (
        <div className="glass-card p-4 mb-6 animate-fade-in-up" style={{ borderColor: platformColors[meta.platform]?.border || 'rgba(108,60,225,0.3)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <HiLink className="text-lg" style={{ color: platformColors[meta.platform]?.text || '#8B5CF6' }} />
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: platformColors[meta.platform]?.bg,
                  color: platformColors[meta.platform]?.text,
                  border: `1px solid ${platformColors[meta.platform]?.border}`,
                }}
              >
                {meta.platform}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text">
                Showing results for: <span className="font-semibold text-primary-light">"{meta.product}"</span>
              </p>
            </div>
            {meta.resolvedUrl && (
              <a
                href={meta.resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted hover:text-primary-light flex items-center gap-1 transition-colors flex-shrink-0"
              >
                <HiExternalLink /> View original
              </a>
            )}
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="glass-card p-5 mb-6 animate-fade-in-up" style={{ borderColor: 'rgba(255,77,106,0.3)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,77,106,0.15)' }}>
              <HiX className="text-danger text-lg" />
            </div>
            <div>
              <p className="text-danger text-sm font-medium">{error}</p>
              <p className="text-xs text-muted mt-1">
                Try searching by product name like iPhone 15, laptop, or headphones.
              </p>
            </div>
          </div>
        </div>
      )}

      {bestPrice && !loading && (
        <div className="glass-card p-5 mb-6 animate-fade-in-up" style={{ borderColor: 'rgba(0,200,83,0.3)', background: 'rgba(0,200,83,0.05)' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,200,83,0.15)' }}>
              <HiTrendingDown className="text-2xl" style={{ color: '#00C853' }} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold" style={{ color: '#00C853' }}>🏆 Best Price Found</h3>
              <p className="text-lg font-bold text-text">
                ₹{bestPrice.price?.toLocaleString()}
                <span className="text-sm font-normal text-muted ml-2">
                  at <span className="font-semibold text-primary-light">{bestPrice.platform || bestPrice.shopName || bestPrice.store}</span>
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {!error && (
        <div className="flex flex-wrap items-center gap-3 mb-6 animate-fade-in-up stagger-1">
          <div className="flex items-center gap-2">
            <HiFilter className="text-muted" />
            <span className="text-sm text-muted">Budget:</span>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Max ₹"
              className="input-field !w-32 !py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <HiSortDescending className="text-muted" />
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="input-field !w-36 !py-2 text-sm cursor-pointer">
              <option value="">Sort By</option>
              <option value="price">Price: Low to High</option>
              <option value="rating">Rating</option>
              <option value="distance">Distance</option>
            </select>
          </div>

          {(budget || sort) && (
            <button onClick={() => { setBudget(''); setSort(''); }} className="text-xs text-danger flex items-center gap-1 hover:underline">
              <HiX /> Clear
            </button>
          )}

          <button onClick={() => {
            const q = searchParams.get('q') || searchParams.get('url');
            if (q) doCompare(q);
          }} className="btn-secondary text-xs !py-2 !px-4 ml-auto">
            Apply Filters
          </button>
        </div>
      )}

      <div className="flex gap-1 mb-6 bg-card rounded-xl p-1 w-fit">
        {[
          { key: 'all', label: `All (${filteredOnline.length + filteredOffline.length})` },
          { key: 'online', label: `Online (${filteredOnline.length})` },
          { key: 'offline', label: `Nearby Shops (${filteredOffline.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-primary text-white' : 'text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted mt-4">
            Searching products and nearby shops…
          </p>
        </div>
      )}

      {results && !loading && filteredOnline.length === 0 && filteredOffline.length === 0 && !error && (
        <div className="text-center py-20">
          <HiShoppingBag className="text-6xl text-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-text mb-2">No products found</h3>
          <p className="text-muted">
            Try searching for "iPhone 15", "laptop", "Samsung", "Nike", or "boAt".
          </p>
        </div>
      )}

      {!loading && results && (
        <>
          <div className="space-y-8">
            {(activeTab === 'all' || activeTab === 'online') && filteredOnline.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  🌐 Online Prices <span className="text-sm text-muted font-normal">({filteredOnline.length} results)</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredOnline.map((product, i) => (
                    <div key={product.id || i} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                      <ProductCard
                        product={product}
                        type="online"
                        recommendation={bestPrice && bestPrice.type === 'online' && bestPrice.price === product.price ? 'Cheapest Online' : null}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'offline') && filteredOffline.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  🏪 Nearby Shops <span className="text-sm text-muted font-normal">({filteredOffline.length} results)</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredOffline.map((product, i) => (
                    <div key={product._id || i} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                      <ProductCard
                        product={product}
                        type="offline"
                        recommendation={bestPrice && bestPrice.type === 'offline' && bestPrice.price === product.price ? 'Best Nearby Shop' : null}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(meta?.product || searchParams.get('q')) && (
            <NearbyStoresFinder keyword={meta?.product || searchParams.get('q')} />
          )}
        </>
      )}
    </div>
  );
}