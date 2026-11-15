"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronRight, Grid2X2, Heart, Leaf, MapPin, Menu, Plus, Rows2, Search, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import type { Product, ShopId } from "@/lib/shop-contract";
import "./storefronts.css";

export interface StorefrontProps {
  shop: ShopId; title: string; products: Product[]; categories: string[]; category: string; search: string; favorites: string[]; count: number; total: number; favoriteOnly: boolean;
  onCategory: (v: string) => void; onSearch: (v: string) => void; onHome: () => void; onProduct: (p: Product) => void; onFavorite: (id: string) => void; onBag: () => void; onSaved: () => void; onSavings: () => void;
}
const euro = (n: number) => new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(n / 100);
const foodDescriptors: Record<string, string> = {
  "food-chicken-breast": "Chicken breast, crisp lettuce and a sesame bun.",
  "food-beef-5oz": "A 5oz beef burger with the classic trimmings.",
  "food-mighty-mac": "The Supermac’s burger classic.",
  "food-veggie-burger": "A veggie alternative for your burger craving.",
  "food-fries": "A side of classic golden fries.",
  "food-taco-fries": "Fries with the Supermac’s taco treatment.",
  "food-chocolate-shake": "A chocolate shake on the side.",
  "food-margherita": "The classic cheese and tomato pizza.",
};
function Wordmark({ shop, title }: { shop: ShopId; title: string }) {
  if (shop === "ubereats") return <span className="sf-uber-logo">Uber <b>Eats</b></span>;
  if (shop === "stockx") return <span className="sf-stockx-logo">Stock<span>X</span></span>;
  if (shop === "zara") return <span className="sf-zara-logo">ZARA</span>;
  return <span className="sf-retail-logo">{title}</span>;
}

export function Storefront(props: StorefrontProps) {
  const { shop, title, products, categories, category, search, favorites, count, total, favoriteOnly, onCategory, onSearch, onHome, onProduct, onFavorite, onBag, onSaved, onSavings } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState("featured");
  const [scope, setScope] = useState("woman");
  const [compact, setCompact] = useState(false);
  const [searchOpen, setSearchOpen] = useState(true);
  const food = shop === "ubereats", stock = shop === "stockx", zara = shop === "zara";
  const apparel = zara || (shop === "generic" && products.filter(p => /dress|shirt|fashion|clothing|coat|trouser|skirt|playsuit|jacket|women/i.test(`${p.name} ${p.category}`)).length > products.length / 2);
  const shown = zara && scope === "man" ? [] : sort === "low" ? [...products].sort((a,b) => a.price - b.price) : sort === "high" ? [...products].sort((a,b) => b.price - a.price) : products;
  const run = (fn: () => void) => { setMenuOpen(false); setFiltersOpen(false); fn(); };
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenuOpen(false); setAddressOpen(false); setFiltersOpen(false); } }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, []);

  function productCard(p: Product, i: number) {
    const saved = favorites.includes(p.id);
    return <article data-testid="product-card" data-product-id={p.id} key={p.id} className={`sf-product ${zara && i % 5 === 0 && !compact ? "sf-editorial-product" : ""}`}>
      <div className="sf-product-image">
        <button className="sf-view-product" aria-label={`View ${p.name}`} onClick={() => onProduct(p)}><img src={p.image} alt={p.name} loading={i < 2 ? "eager" : "lazy"}/></button>
        <button className={`sf-save ${saved ? "sf-is-saved" : ""}`} aria-label={`${saved ? "Unsave" : "Save"} ${p.name}`} aria-pressed={saved} onClick={() => onFavorite(p.id)}><Heart size={18} strokeWidth={1.6} fill={saved ? "currentColor" : "none"}/></button>
        {food && <button className="sf-food-add" aria-label={`Add ${p.name}`} onClick={() => onProduct(p)}><Plus size={22}/></button>}
      </div>
      <div className="sf-product-copy">
        {!food && <span className="sf-product-brand">{shop === "generic" ? p.brand || p.merchantName || title : p.brand}</span>}
        <button className="sf-product-title" onClick={() => onProduct(p)}>{p.name}</button>
        {food && <p className="sf-food-description">{foodDescriptors[p.id] || `${p.brand} · ${p.category}`}</p>}
        {stock && <span className="sf-ask-label">{p.priceKind === "estimate" ? "Demo estimate" : "Cached starting ask"}</span>}
        <div className="sf-product-price"><span>{p.priceKind === "from" ? "From " : ""}{euro(p.price)}</span>{!food && !stock && p.priceKind === "estimate" && <small>Demo estimate</small>}{stock && <button aria-label={`Buy ${p.name}`} onClick={() => onProduct(p)}>Buy now <ArrowUpRight size={12}/></button>}</div>
        {zara && <button className="sf-zara-add" aria-label={`Choose options for ${p.name}`} onClick={() => onProduct(p)}>VIEW / ADD <Plus size={12}/></button>}
      </div>
    </article>;
  }

  return <section className={`sf sf-${shop} ${apparel ? "sf-apparel" : ""} ${compact ? "sf-compact" : ""}`}>
    <div className="sf-simulation"><span>SHOPPING SIMULATION</span><span>No real purchase is placed</span></div>
    <header className="sf-header"><div className="sf-topbar"><button className="sf-icon sf-back" aria-label="Back to all shops" onClick={onHome}><ArrowLeft size={21}/></button>{!zara && <Wordmark shop={shop} title={title}/>}<div className="sf-header-tools">{zara && <button className="sf-icon" aria-label="Search the collection" aria-expanded={searchOpen} onClick={() => setSearchOpen(v => !v)}><Search size={20}/></button>}<button data-testid="savings-button" className="sf-icon sf-savings" aria-label="Open private savings pot" onClick={onSavings}><Leaf size={19}/></button><button data-testid="basket-button" className="sf-icon sf-bag" aria-label={`Open shopping bag, ${count} items`} onClick={onBag}><ShoppingBag size={21}/>{count > 0 && <span>{count}</span>}</button><button className="sf-icon" aria-label={menuOpen ? "Close shop menu" : "Open shop menu"} aria-expanded={menuOpen} aria-controls="sf-menu-popover" onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={22}/> : <Menu size={22}/>}</button></div></div>
      {menuOpen && <nav className="sf-menu-popover" id="sf-menu-popover" aria-label="Shop menu"><span>{title || (food ? "Uber Eats" : stock ? "StockX" : "ZARA")}</span><button onClick={() => run(onHome)}><ArrowLeft size={17}/> Explore all shops <ChevronRight size={16}/></button><button onClick={() => run(onSaved)}><Heart size={17}/> {favoriteOnly ? "Show all products" : "Saved products"}<ChevronRight size={16}/></button><button onClick={() => run(onBag)}><ShoppingBag size={17}/> Your {food ? "basket" : "bag"} <span>{count}</span></button><button onClick={() => run(onSavings)}><Leaf size={17}/> Your private savings <ChevronRight size={16}/></button></nav>}
      {zara && <div className="sf-zara-masthead"><Wordmark shop={shop} title={title}/><span>THE EVERYDAY<br/>COLLECTION / 01</span></div>}
      {food && <div className="sf-delivery"><button aria-expanded={addressOpen} onClick={() => setAddressOpen(v => !v)}><MapPin size={18}/><span>Delivery location <b>Helsinki, Finland</b></span><ChevronDown size={16}/></button><span className="sf-delivery-demo">Demo address</span></div>}
      {addressOpen && food && <div className="sf-address-panel"><span className="sf-address-marker"><MapPin size={21}/></span><div><strong>Helsinki, Finland</strong><p>This preview uses a sample delivery location. Menu inspiration comes from Supermac’s Galway; no live delivery quote is requested.</p></div><button className="sf-icon" aria-label="Close delivery details" onClick={() => setAddressOpen(false)}><X size={18}/></button></div>}
      {(!zara || searchOpen || search) && <label className="sf-search"><Search size={19}/><input aria-label="Search this storefront" value={search} onChange={e => onSearch(e.target.value)} placeholder={food ? "Search the menu" : zara ? "SEARCH THE COLLECTION" : stock ? "Search for brands, colourways & more" : `Search ${title || "the collection"}`}/>{search && <button aria-label="Clear search" onClick={() => onSearch("")}><X size={17}/></button>}</label>}
      {stock && <nav className="sf-stock-navigation" aria-label="StockX departments"><button onClick={() => onCategory("All")} className={category === "All" ? "selected" : ""}>Sneakers</button><button onClick={onHome}>More shops</button><button onClick={onSaved} className={favoriteOnly ? "selected" : ""}>Saved</button></nav>}
      {zara && <div className="sf-zara-tabs"><div><button className={scope === "woman" ? "selected" : ""} onClick={() => setScope("woman")}>WOMAN</button><button className={scope === "man" ? "selected" : ""} onClick={() => setScope("man")}>MAN</button></div><button onClick={onSaved} aria-pressed={favoriteOnly}>SAVED {favoriteOnly && <Check size={11}/>}</button></div>}
    </header>

    <div className="sf-content">
      {food && <><section className="sf-food-campaign"><div className="sf-supermacs"><span>S</span><strong>Supermac’s</strong></div><div className="sf-food-campaign-copy"><span>THE COMFORT FOOD EDIT</span><h1>BIG ON<br/>THE GOOD<br/><i>STUFF.</i></h1></div><img className="sf-food-hero-burger" src="/products/food-chicken-breast.webp" alt="Supermac’s chicken breast sandwich"/><img className="sf-food-hero-fries" src="/products/food-fries.webp" alt="Supermac’s fries"/><span className="sf-food-campaign-note">A little comfort. A lot of flavour.</span></section><div className="sf-restaurant-heading"><div><h2>Supermac’s</h2><p>Burgers · Sides · Pizza · Shakes</p></div><span>Galway menu<br/>Demo delivery</span></div></>}
      {stock && <section className="sf-stock-campaign"><span className="sf-stock-campaign-tag">THE ROTATION / EDIT 01</span><div><h1>YOUR NEXT<br/>DAILY<br/><i>ROTATION.</i></h1><p>Icons for the everyday.<br/>Find the pair that feels like you.</p></div><img src="/products/stockx-af1.webp" alt="Nike Air Force 1 Low White sneaker"/><span className="sf-stock-campaign-number">01—08<br/>THE SNEAKER EDIT</span></section>}
      {zara && <section className="sf-zara-editorial-heading sf-zara-photo-story"><img src="/products/zara-4772-395-303.webp" alt="Zara metallic dress photographed by the sea"/><span>{scope === "woman" ? "WOMAN / A SELECTED EDIT" : "MAN / COLLECTION PREVIEW"}</span><h1>{scope === "woman" ? <>New forms.<br/><i>Same you.</i></> : <>A new<br/><i>perspective.</i></>}</h1><button onClick={() => document.getElementById("sf-catalogue")?.scrollIntoView({ behavior: "smooth", block: "start" })}>EXPLORE THE COLLECTION <ArrowRight size={15}/></button></section>}
      {shop === "generic" && <section className="sf-retail-campaign"><div><span>THE CURATED COLLECTION</span><h1>Good things,<br/><i>discovered.</i></h1><p>A considered selection from {title}.<br/>Find something that feels like you.</p></div>{products[0] && <img src={products[0].image} alt={products[0].name}/>}<span className="sf-retail-edition">YOUR NEXT DISCOVERY<br/>A VARA SHOPPING SIMULATION</span></section>}

      <section className="sf-catalogue" id="sf-catalogue" aria-label={`${title} products`}>
        <div className={`sf-catalogue-toolbar ${zara ? "sf-zara-toolbar" : ""}`}>
          <div className="sf-categories" aria-label="Product categories">{categories.map(c => <button key={c} className={category === c ? "selected" : ""} aria-pressed={category === c} onClick={() => onCategory(c)}>{c}</button>)}</div>
          <button className={`sf-filter-button ${filtersOpen ? "selected" : ""}`} aria-label="Open product filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(v => !v)}><SlidersHorizontal size={16}/><span>{zara ? "FILTERS" : "Filter"}</span></button>
          {zara && <button className="sf-layout-toggle" aria-label={compact ? "Switch to editorial view" : "Switch to compact grid"} onClick={() => setCompact(v => !v)}>{compact ? <Rows2 size={16}/> : <Grid2X2 size={16}/>}</button>}
        </div>
        {filtersOpen && <div className="sf-filter-panel"><label>Sort by<select aria-label="Sort products" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label><button className={favoriteOnly ? "selected" : ""} onClick={onSaved}><Heart size={15}/>{favoriteOnly ? "Show all products" : "Show saved products"}</button><button onClick={() => { onCategory("All"); onSearch(""); setSort("featured"); setScope("woman"); if(favoriteOnly)onSaved(); setFiltersOpen(false); }}>Reset filters <X size={13}/></button></div>}
        <div className="sf-results-heading"><h2>{favoriteOnly ? "Your saved edit" : food ? category === "All" ? "Your favourites, on the menu." : category : stock ? "The ones worth a closer look" : zara ? "THE SELECTED COLLECTION" : "The collection"}</h2><span>{shown.length} {food ? "items" : "products"}</span></div>
        {shown.length ? <div className="sf-product-grid">{shown.map(productCard)}</div> : <div className="sf-empty"><Search size={25}/><h3>{zara && scope === "man" ? "The men’s edit is still to come." : favoriteOnly ? "Keep your favourites close." : "A little further afield."}</h3><p>{zara && scope === "man" ? "This demo catalogue contains women’s pieces. Explore the Woman edit to see the available collection." : favoriteOnly ? "Tap a heart on a product to save it here." : "Try another search or category to find your next discovery."}</p><button onClick={() => { setScope("woman"); onCategory("All"); onSearch(""); if(favoriteOnly)onSaved(); }}>{zara && scope === "man" ? "EXPLORE WOMAN" : "Explore all products"}<ArrowRight size={15}/></button></div>}
        <p className="sf-source-note">{food ? "Real Supermac’s Galway menu inspiration. Delivery location and checkout are simulated." : stock ? "Cached starting asks; estimates are labelled. Prices vary by size. No live market order is submitted." : zara ? "A selected women’s catalogue snapshot. Sizes in this demo may be simulated; see product details." : "Products and EUR prices from the original merchant. Availability may change."} <span>Product details include the original source.</span></p>
      </section>
    </div>
    <footer className="sf-store-footer"><Wordmark shop={shop} title={title}/><p>{food ? "A good mood is on the menu." : stock ? "A new perspective. From the ground up." : zara ? "THE EVERYDAY, REIMAGINED." : "A little curiosity. A good discovery."}</p><button onClick={onHome}>Explore all shops <ArrowUpRight size={13}/></button></footer>
    <div className="sf-bottom-bar"><button className="sf-bottom-saved" aria-label={favoriteOnly ? "Show all products" : "View saved products"} onClick={onSaved}><Heart size={20} fill={favoriteOnly ? "currentColor" : "none"}/>{!food && <span>Saved</span>}</button><button className="sf-view-bag" onClick={onBag}><span className="sf-bottom-count">{count}</span><span>{food ? "View basket" : zara ? "SHOPPING BAG" : "View bag"}</span><strong>{euro(total)}</strong><ArrowRight size={17}/></button></div>
  </section>;
}
