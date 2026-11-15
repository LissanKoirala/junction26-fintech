"use client";

import { useId, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, CreditCard, Heart, Minus, Plus, Smartphone } from 'lucide-react';
import type { Product, ShopId } from '../lib/shop-contract';
import './purchase.css';

const euro = new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' });
const money = (minor: number) => euro.format(minor / 100);
const brandName = (brand: ShopId) => ({ ubereats: 'Uber Eats', stockx: 'StockX', zara: 'ZARA', generic: 'Your order' })[brand];

export interface ProductDetailProps {
  product: Product;
  variant: string;
  onVariant: (variant: string) => void;
  quantity: number;
  onQuantity: (quantity: number) => void;
  error: string;
  saved: boolean;
  onFavorite: () => void;
  onAdd: () => void;
  onBuyNow: () => void;
}

function Quantity({ quantity, onQuantity }: { quantity: number; onQuantity: (quantity: number) => void }) {
  return <div className="purchase-count" role="group" aria-label="Quantity">
    <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => onQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button>
    <span aria-live="polite">{quantity}</span>
    <button type="button" aria-label="Increase quantity" disabled={quantity >= 20} onClick={() => onQuantity(Math.min(20, quantity + 1))}><Plus size={16} /></button>
  </div>;
}

export function ProductDetail({ product, variant, onVariant, quantity, onQuantity, error, saved, onFavorite, onAdd, onBuyNow }: ProductDetailProps) {
  const errorId = useId();
  const food = product.store === 'ubereats', stockx = product.store === 'stockx', zara = product.store === 'zara';
  const retailer = product.merchantName || brandName(product.store);
  return <div className={`purchase-detail purchase-brand-${product.store}`}>
    <div className="purchase-detail-scroll">
      <div className="purchase-product-photo">
        <img src={product.image} alt={product.name} />
        <button type="button" className={`purchase-save ${saved ? 'is-saved' : ''}`} onClick={onFavorite} aria-label={saved ? 'Unsave product' : 'Save product'} aria-pressed={saved}><Heart size={22} strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} /></button>
        {zara && <span className="purchase-photo-caption">{product.category}</span>}
      </div>
      <div className="purchase-product-copy">
        <p className="purchase-product-eyebrow">{food ? product.brand : product.store === 'generic' ? retailer : product.brand} <span>/ {product.category}</span></p>
        <h3>{product.name}</h3>
        <div className="purchase-product-price">
          <span>{product.priceKind === 'from' ? 'From ' : ''}{money(product.price)}</span>
          {stockx && <small>EUR</small>}
        </div>
        {product.colors?.length ? <p className="purchase-colour"><span>Colour</span>{product.colors.join(' / ')}</p> : null}
        {product.sizes.length > 0 && <fieldset className="purchase-options" aria-describedby={error ? errorId : undefined}>
          <legend>{food ? 'Choose your option' : 'Select your size'}<span>{variant || 'Required'}</span></legend>
          <div className="purchase-option-grid">
            {product.sizes.map(option => <button type="button" key={option} onClick={() => onVariant(option)} className={variant === option ? 'is-selected' : ''} aria-pressed={variant === option}>{option}{food && variant === option ? <Check size={17} /> : null}</button>)}
          </div>
        </fieldset>}
        {error && <p className="purchase-error" role="alert" id={errorId}>{error}</p>}
        <details className="purchase-product-information">
          <summary><span>{food ? 'Item information' : 'Product details'}</span><Plus size={16} /><Minus size={16} /></summary>
          <div>
            <p>{product.description}</p>
            {product.priceNote && <p>{product.priceNote}</p>}
            {product.priceKind === 'estimate' && <p>Illustrative demo price.</p>}
            <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">View original product<ArrowUpRight size={13} /></a>
          </div>
        </details>
      </div>
    </div>
    <div className="purchase-detail-footer">
      {stockx ? <>
        <div className="purchase-footer-quantity"><Quantity quantity={quantity} onQuantity={onQuantity} /><span>Item total <strong>{money(product.price * quantity)}</strong></span></div>
        <div className="purchase-stockx-actions"><button type="button" className="purchase-primary" onClick={onBuyNow}>Buy now <span>{money(product.price * quantity)}</span></button><button type="button" data-testid="add-to-basket" className="purchase-secondary" onClick={onAdd}>Add to bag<Plus size={18} /></button></div>
      </> : <div className="purchase-action-row"><Quantity quantity={quantity} onQuantity={onQuantity} /><button type="button" data-testid="add-to-basket" className="purchase-primary" onClick={onAdd}><span>{food ? 'Add to order' : 'Add to bag'}</span><strong>{money(product.price * quantity)}</strong></button></div>}
      <p className="purchase-simulation">Simulation · no payment charged</p>
    </div>
  </div>;
}

export interface CheckoutProps {
  brand: ShopId;
  lines: Array<{ product: Product; variant: string; quantity: number }>;
  subtotal: number;
  shipping: number;
  total: number;
  onOrder: () => void;
}

export function Checkout({ brand, lines, subtotal, shipping, total, onOrder }: CheckoutProps) {
  const id = useId();
  const [editing, setEditing] = useState<'contact' | 'delivery' | null>(null);
  const [contact, setContact] = useState({ first: 'Alex', last: 'Demo', email: 'alex@example.com', phone: '+358 40 123 4567' });
  const [delivery, setDelivery] = useState({ address: 'Mannerheimintie 1', postal: '00100', city: 'Helsinki', country: 'Finland' });
  const [payment, setPayment] = useState<'card' | 'mobile'>('card');
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  return <div className={`purchase-checkout purchase-brand-${brand}`}>
    <div className="purchase-checkout-scroll">
      <div className="purchase-checkout-masthead"><span className="purchase-checkout-wordmark">{brandName(brand)}</span><span>Checkout</span></div>
      <div className="purchase-checkout-intro"><h2>Review your order</h2><p>A real shopping feeling. A simulated finish.</p></div>
      <section className="purchase-checkout-section" aria-labelledby={`${id}-delivery-heading`}>
        <h3 id={`${id}-delivery-heading`}>Delivery &amp; contact</h3>
        <div className="purchase-edit-card">
          <div className="purchase-edit-heading"><h4>Contact details <span>DEMO</span></h4><button type="button" aria-expanded={editing === 'contact'} aria-controls={`${id}-contact`} onClick={() => setEditing(editing === 'contact' ? null : 'contact')}>{editing === 'contact' ? 'Close' : 'Edit'}</button></div>
          {editing === 'contact' ? <div id={`${id}-contact`} className="purchase-edit-fields">
            <div className="purchase-field-row"><label htmlFor={`${id}-first`}>First name<input id={`${id}-first`} value={contact.first} autoComplete="off" onChange={event => setContact({ ...contact, first: event.target.value })} /></label><label htmlFor={`${id}-last`}>Last name<input id={`${id}-last`} value={contact.last} autoComplete="off" onChange={event => setContact({ ...contact, last: event.target.value })} /></label></div>
            <label htmlFor={`${id}-email`}>Email<input id={`${id}-email`} type="email" value={contact.email} autoComplete="off" onChange={event => setContact({ ...contact, email: event.target.value })} /></label>
            <label htmlFor={`${id}-phone`}>Phone<input id={`${id}-phone`} type="tel" value={contact.phone} autoComplete="off" onChange={event => setContact({ ...contact, phone: event.target.value })} /></label>
            <button type="button" className="purchase-save-details" onClick={() => setEditing(null)}>Save details<Check size={15} /></button>
          </div> : <div className="purchase-address-summary"><strong>{contact.first} {contact.last}</strong><span>{contact.email}</span><span>{contact.phone}</span></div>}
        </div>
        <div className="purchase-edit-card">
          <div className="purchase-edit-heading"><h4>Delivery address <span>DEMO</span></h4><button type="button" aria-expanded={editing === 'delivery'} aria-controls={`${id}-address`} onClick={() => setEditing(editing === 'delivery' ? null : 'delivery')}>{editing === 'delivery' ? 'Close' : 'Edit'}</button></div>
          {editing === 'delivery' ? <div id={`${id}-address`} className="purchase-edit-fields">
            <label htmlFor={`${id}-street`}>Street address<input id={`${id}-street`} value={delivery.address} autoComplete="off" onChange={event => setDelivery({ ...delivery, address: event.target.value })} /></label>
            <div className="purchase-field-row"><label htmlFor={`${id}-postal`}>Postal code<input id={`${id}-postal`} inputMode="numeric" value={delivery.postal} autoComplete="off" onChange={event => setDelivery({ ...delivery, postal: event.target.value })} /></label><label htmlFor={`${id}-city`}>City<input id={`${id}-city`} value={delivery.city} autoComplete="off" onChange={event => setDelivery({ ...delivery, city: event.target.value })} /></label></div>
            <label htmlFor={`${id}-country`}>Country<input id={`${id}-country`} value={delivery.country} autoComplete="off" onChange={event => setDelivery({ ...delivery, country: event.target.value })} /></label>
            <button type="button" className="purchase-save-details" onClick={() => setEditing(null)}>Save address<Check size={15} /></button>
          </div> : <div className="purchase-address-summary"><strong>{delivery.address}</strong><span>{delivery.postal} {delivery.city}</span><span>{delivery.country}</span></div>}
        </div>
        <p className="purchase-field-note">Sample details for this demo. Nothing will be delivered.</p>
      </section>
      <section className="purchase-checkout-section">
        <h3>Payment method</h3>
        <div className="purchase-payment-options" role="radiogroup" aria-label="Demo payment method">
          <label className={payment === 'card' ? 'is-selected' : ''}><input type="radio" name={`${id}-payment`} checked={payment === 'card'} onChange={() => setPayment('card')} /><CreditCard size={22} strokeWidth={1.5} /><span><strong>Demo card</strong><small>Simulated · no card needed</small></span><span className="purchase-radio-mark">{payment === 'card' && <Check size={12} strokeWidth={3} />}</span></label>
          <label className={payment === 'mobile' ? 'is-selected' : ''}><input type="radio" name={`${id}-payment`} checked={payment === 'mobile'} onChange={() => setPayment('mobile')} /><Smartphone size={22} strokeWidth={1.5} /><span><strong>Demo mobile wallet</strong><small>Simulated · no wallet connection</small></span><span className="purchase-radio-mark">{payment === 'mobile' && <Check size={12} strokeWidth={3} />}</span></label>
        </div>
      </section>
      <section className="purchase-checkout-section purchase-order-section">
        <details open className="purchase-order-details"><summary><h3>Your order <span>{count} {count === 1 ? 'item' : 'items'}</span></h3><ChevronDown size={17} /></summary>
          <div className="purchase-checkout-lines">{lines.map(({ product, variant, quantity }) => <div className="purchase-checkout-line" key={`${product.id}-${variant}`}><img src={product.image} alt={product.name} /><div><span className="purchase-line-brand">{product.merchantName || product.brand}</span><h4>{product.name}</h4>{variant && <p>Size / option: {variant}</p>}<p>Quantity: {quantity}</p></div><strong>{money(product.price * quantity)}</strong></div>)}</div>
        </details>
        <div className="purchase-totals"><div><span>Subtotal</span><span>{money(subtotal)}</span></div><div><span>Delivery</span><span>{money(shipping)}</span></div><div className="purchase-grand-total"><strong>Total</strong><strong>{money(total)}</strong></div></div>
      </section>
    </div>
    <div className="purchase-checkout-footer"><button type="button" data-testid="place-order" className="purchase-primary" onClick={onOrder} disabled={!lines.length}><span>Place demo order</span><strong>{money(total)}</strong></button><p className="purchase-simulation">Simulation · no payment charged</p></div>
  </div>;
}
