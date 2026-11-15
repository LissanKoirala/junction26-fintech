export type ShopId = 'ubereats' | 'stockx' | 'zara' | 'generic';

export interface Product {
  id: string;
  store: ShopId;
  merchantName?: string;
  currency?: 'EUR';
  name: string;
  brand: string;
  category: string;
  price: number;
  image: string;
  sourceUrl: string;
  description: string;
  sizes: string[];
  colors?: string[];
  priceNote?: string;
  priceKind: 'snapshot' | 'from' | 'estimate';
  fetchedAt: string;
}

export interface DiscoverResult {
  store: ShopId;
  title: string;
  productIds: string[];
  mode: 'gemini' | 'cache' | 'fallback';
  elapsedMs: number;
  reason?: string;
  catalogueVersion: string;
}

export interface BasketLine {
  productId: string;
  variant: string;
  quantity: number;
}

export interface ImportedShop {
  key: string;
  name: string;
  domain: string;
  url: string;
  fetchedAt: string;
  expiresAt: string;
}

export interface ImportResult {
  status: 'ready' | 'unsupported' | 'error';
  products: Product[];
  shop?: ImportedShop;
  cached: boolean;
  elapsedMs: number;
  message?: string;
  warnings: string[];
  provenance: {
    method: 'direct' | 'search' | 'mixed';
    sources: Array<{title: string; url: string}>;
    searchEntryPoint?: string;
  };
}
