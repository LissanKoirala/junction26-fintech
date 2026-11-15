// The generated shop: the hunt (search, sort, filters, grid or menu, wishlist), product page, basket and
// checkout, then the pay sheet and the twist (features/crave/Reveal.tsx). Everything stays in this component's
// state for one craving; the diary entry is written the moment the "payment" succeeds.
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, Check, ChevronRight, Clock, Heart, Minus, Plus, Search, ShoppingBasket, Sparkles, Star, Truck, X, Zap, Bike, Info,
} from "lucide-react";
import type { CraveEntry, CraveProduct, CraveShopHeader } from "@shared/crave";
import { CRAVE_MOTTO } from "@shared/crave";
import { engine } from "@shared/engine";
import { useCustomer, useEngineOpts } from "@/state/customer";
import { useEngine } from "@/lib/safeEngine";
import { money } from "@/lib/format";
import { t, tn, rich } from "@/lib/i18n";
import { goBack } from "@/lib/router";
import { Banner, Button, Card, ConceptNotice, cx, IconButton, Muted, Progress, STROKE } from "@/ui/kit";
import { VaraAvatar } from "@/ui/hero";
import { PERSONAS } from "@shared/personas";
import type { ShopSession } from "./session";
import { startShop } from "./session";
import { accentOf, deliveryTime, iconOf, NothingShipsPill, ProductImage, Stars } from "./look";
import { sfx } from "./sfx";
import { craveActions, newOrderId, scheduleEmails } from "./diary";
import { PaySheet } from "./PaySheet";
import { Reveal } from "./Reveal";

interface Line {
  key: string;
  productId: string;
  qty: number;
  choice: Record<string, string>;
  addOns: string[];
  unit: number; // price incl. add-ons
}

type Sort = "rec" | "low" | "high" | "rating" | "deals";
// labels are English keys, translated where shown
const SORTS: { v: Sort; label: string }[] = [
  { v: "rec", label: "Recommended" },
  { v: "low", label: "Price ↑" },
  { v: "high", label: "Price ↓" },
  { v: "rating", label: "Top rated" },
  { v: "deals", label: "Deals" },
];
/** The model's badge enum is English; show it in the user's language. */
const badgeLabel = (b: string) => (b ? t(b) : "");

const discountPct = (p: CraveProduct) => (p.compareAtPrice ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

function MiniChip({ children, on, onClick, color }: { children: React.ReactNode; on?: boolean; onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        sfx.click();
        onClick();
      }}
      className={cx("inline-flex min-h-9 shrink-0 items-center gap-1 rounded-pill border px-3 text-sm font-medium transition-colors", on ? "text-white" : "border-line bg-card text-ink-strong")}
      style={on ? { background: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ hunting animation
const HUNT_LINES = ["Hunting for the best deals…", "Checking a few hundred shelves…", "Comparing prices…", "Reading the reviews so you don't have to…", "Polishing the product photos…"];
export function Hunting({ craving, header }: { craving: string; header: CraveShopHeader | null }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % HUNT_LINES.length), 1100);
    return () => clearInterval(id);
  }, []);
  const a = accentOf(header?.accent);
  const Icon = iconOf(header?.icon);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 pb-24 text-center">
      <div className="relative h-36 w-36">
        {[0, 1, 2].map((k) => (
          <motion.span
            key={k}
            className="absolute inset-0 rounded-pill border-2"
            style={{ borderColor: a.main }}
            initial={{ scale: 0.4, opacity: 0.7 }}
            animate={{ scale: 1.15, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, delay: k * 0.6, ease: "easeOut" }}
          />
        ))}
        <motion.span
          className="absolute inset-6 flex items-center justify-center rounded-pill text-white shadow-middle"
          style={{ background: a.main }}
          animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          {header ? <Icon size={44} strokeWidth={STROKE} aria-hidden /> : <Search size={44} strokeWidth={STROKE} aria-hidden />}
        </motion.span>
      </div>
      <div className="min-h-20">
        <AnimatePresence mode="wait">
          {header ? (
            <motion.div key="h" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: a.main }}>{t("Found a shop")}</p>
              <p className="text-2xl font-bold text-ink">{header.shopName}</p>
              <p className="text-ink-muted">{header.tagline}</p>
            </motion.div>
          ) : (
            <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-lg font-semibold text-green-900">
              {t(HUNT_LINES[i])}
            </motion.p>
          )}
        </AnimatePresence>
        <p className="mt-1 text-sm text-ink-muted">“{craving}”</p>
      </div>
      <NothingShipsPill />
    </div>
  );
}

// ------------------------------------------------------------------ product cards
function Heart2({ on, onClick, color }: { on: boolean; onClick: () => void; color: string }) {
  return (
    <motion.button
      type="button"
      aria-label={on ? t("Remove from wishlist") : t("Add to wishlist")}
      aria-pressed={on}
      whileTap={{ scale: 0.8 }}
      onClick={(e) => {
        e.stopPropagation();
        sfx.pop();
        onClick();
      }}
      className="flex h-9 w-9 items-center justify-center rounded-pill bg-white/90 shadow-low"
    >
      <Heart size={18} strokeWidth={STROKE} style={on ? { color, fill: color } : { color: "#363636" }} aria-hidden />
    </motion.button>
  );
}

function PriceTag({ p, big, noPct }: { p: CraveProduct; big?: boolean; noPct?: boolean }) {
  const d = discountPct(p);
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5">
      <span className={cx("tnum font-bold text-ink", big ? "text-2xl" : "text-base")}>{money(p.price)}</span>
      {p.compareAtPrice && <span className="tnum text-xs text-ink-muted line-through">{money(p.compareAtPrice)}</span>}
      {d > 0 && !noPct && <span className="rounded-sm bg-amber-100 px-1 text-xs font-bold text-amber-800">{t("−{n} % today", { n: d })}</span>}
    </span>
  );
}

function BadgeTag({ p, color, kind }: { p: CraveProduct; color: string; kind: string }) {
  const label = p.badge === "Deal" && discountPct(p) ? t("−{n} % today", { n: discountPct(p) }) : p.badge === "Chef's pick" && kind !== "food" ? t("Staff pick") : badgeLabel(p.badge);
  if (!label) return null;
  return (
    <span className="absolute left-2 top-2 max-w-[calc(100%-3.25rem)] truncate rounded-pill px-2 py-0.5 text-[11px] font-bold text-white shadow-low" style={{ background: color }}>
      {label}
    </span>
  );
}

function GridCard({ p, header, wished, onWish, onOpen, onQuickAdd }: { p: CraveProduct; header: CraveShopHeader; wished: boolean; onWish: () => void; onOpen: () => void; onQuickAdd: () => void }) {
  const a = accentOf(header.accent);
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="relative">
      <button type="button" onClick={onOpen} className="block w-full rounded-app-card bg-card p-2 text-left shadow-app-card transition-transform active:scale-[0.98]">
        <div className="relative">
          <ProductImage src={p.image} icon={iconOf(header.icon)} accent={header.accent} alt={p.name} />
          <BadgeTag p={p} color={a.main} kind={header.kind} />
        </div>
        <div className="px-1 pb-1 pt-2">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-muted">{p.brand}</p>
          <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-ink">{p.name}</p>
          <div className="mt-1"><Stars value={p.rating} count={p.reviewCount} /></div>
          <div className="mt-1 pr-9"><PriceTag p={p} noPct={p.badge === "Deal"} /></div>
          {p.stockLeft != null && <p className="mt-0.5 text-xs font-semibold text-amber-800">{t("Only {n} left", { n: p.stockLeft })}</p>}
        </div>
      </button>
      <div className="absolute right-3 top-3"><Heart2 on={wished} onClick={onWish} color={a.main} /></div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.85 }}
        aria-label={t("Add {name} to basket", { name: p.name })}
        onClick={onQuickAdd}
        className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-pill text-white shadow-middle"
        style={{ background: a.main }}
      >
        <Plus size={20} strokeWidth={2} aria-hidden />
      </motion.button>
    </motion.div>
  );
}

function MenuRow({ p, header, wished, onWish, onOpen, onQuickAdd }: { p: CraveProduct; header: CraveShopHeader; wished: boolean; onWish: () => void; onOpen: () => void; onQuickAdd: () => void }) {
  const a = accentOf(header.accent);
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative">
      <button type="button" onClick={onOpen} className="flex w-full gap-3 border-b border-line py-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{p.name}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{p.pitch}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <PriceTag p={p} />
            {p.badge && p.badge !== "Deal" && <span className="rounded-pill px-2 py-0.5 text-[11px] font-bold" style={{ background: a.soft, color: a.ink }}>{badgeLabel(p.badge)}</span>}
            {p.stockLeft != null && <span className="text-xs font-semibold text-amber-800">{t("Only {n} left today", { n: p.stockLeft })}</span>}
          </div>
          <div className="mt-1"><Stars value={p.rating} count={p.reviewCount} /></div>
        </div>
        <div className="relative w-[104px] shrink-0">
          <ProductImage src={p.image} icon={iconOf(header.icon)} accent={header.accent} alt={p.name} />
        </div>
      </button>
      <div className="absolute right-[86px] top-4"><Heart2 on={wished} onClick={onWish} color={a.main} /></div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.85 }}
        aria-label={t("Add {name} to basket", { name: p.name })}
        onClick={onQuickAdd}
        className="absolute bottom-5 right-1 flex h-9 w-9 items-center justify-center rounded-pill text-white shadow-middle"
        style={{ background: a.main }}
      >
        <Plus size={20} strokeWidth={2} aria-hidden />
      </motion.button>
    </motion.div>
  );
}

// ------------------------------------------------------------------ product page
function ProductPage({ p, header, all, wished, onWish, onClose, onAdd, onOpen }: { p: CraveProduct; header: CraveShopHeader; all: CraveProduct[]; wished: boolean; onWish: () => void; onClose: () => void; onAdd: (l: Omit<Line, "key">) => void; onOpen: (id: string) => void }) {
  const a = accentOf(header.accent);
  const [choice, setChoice] = useState<Record<string, string>>(() => Object.fromEntries(p.variants.map((v) => [v.name, v.options[0]])));
  const [addOns, setAddOns] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  useEffect(() => {
    setChoice((c) => ({ ...Object.fromEntries(p.variants.map((v) => [v.name, v.options[0]])), ...c }));
  }, [p.variants]);
  const unit = r2(p.price + p.addOns.filter((x) => addOns.includes(x.name)).reduce((s, x) => s + x.price, 0));
  const others = all.filter((x) => x.id !== p.id).slice(0, 6);
  return (
    <motion.div
      className="absolute inset-0 z-40 flex flex-col bg-screen"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.28, ease: [0.33, 0, 0.34, 1] }}
      role="dialog"
      aria-label={p.name}
    >
      <div className="no-scrollbar flex-1 overflow-y-auto pb-28">
        <div className="relative bg-card">
          <ProductImage src={p.image} icon={iconOf(header.icon)} accent={header.accent} alt={p.name} rounded="rounded-none" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
            <IconButton icon={ArrowLeft} label={t("Back to shop")} tone="tonal" onClick={onClose} />
            <Heart2 on={wished} onClick={onWish} color={a.main} />
          </div>
          <NothingShipsPill className="absolute bottom-3 left-3" />
        </div>
        <div className="flex flex-col gap-3 px-gutter pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: a.main }}>{p.brand}</p>
            <h2 className="text-2xl font-bold leading-tight text-ink">{p.name}</h2>
            <div className="mt-1 flex items-center gap-3"><Stars value={p.rating} count={p.reviewCount} size={14} />{p.badge && <span className="text-xs font-semibold text-ink-muted">· {badgeLabel(p.badge)}</span>}</div>
            <p className="mt-2 text-ink-strong">{p.pitch}</p>
            <div className="mt-2"><PriceTag p={p} big /></div>
            {p.stockLeft != null && <p className="mt-1 text-sm font-semibold text-amber-800">{t("Hurry, only {n} left", { n: p.stockLeft })}</p>}
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
              {header.kind === "food" ? <Bike size={16} strokeWidth={STROKE} aria-hidden /> : <Truck size={16} strokeWidth={STROKE} aria-hidden />}
              {deliveryTime(header)}
            </p>
          </div>

          {!p.details && (
            <div className="flex flex-col gap-2" aria-busy="true">
              <span className="skeleton h-5 w-24 rounded-sm" />
              <span className="skeleton h-10 w-full rounded-sm" />
              <span className="skeleton h-10 w-3/4 rounded-sm" />
            </div>
          )}
          {p.variants.map((v) => (
            <div key={v.name}>
              <p className="mb-1.5 text-sm font-semibold text-ink-strong">{v.name}: <span className="font-normal">{choice[v.name]}</span></p>
              <div className="flex flex-wrap gap-2">
                {v.options.map((o) => (
                  <MiniChip key={o} on={choice[v.name] === o} color={a.main} onClick={() => setChoice((c) => ({ ...c, [v.name]: o }))}>{o}</MiniChip>
                ))}
              </div>
            </div>
          ))}
          {p.addOns.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-ink-strong">{header.kind === "food" ? t("Add extras") : t("Complete it with")}</p>
              <Card padded={false} className="divide-y divide-line px-3">
                {p.addOns.map((x) => {
                  const on = addOns.includes(x.name);
                  return (
                    <button
                      key={x.name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        sfx.click();
                        setAddOns((l) => (on ? l.filter((n) => n !== x.name) : [...l, x.name]));
                      }}
                      className="flex min-h-12 w-full items-center gap-3 text-left"
                    >
                      <span className={cx("flex h-5 w-5 items-center justify-center rounded-[6px] border")} style={on ? { background: a.main, borderColor: a.main } : { borderColor: "#949494" }}>
                        {on && <Check size={14} strokeWidth={3} className="text-white" aria-hidden />}
                      </span>
                      <span className="flex-1 text-sm text-ink">{x.name}</span>
                      <span className="tnum text-sm text-ink-muted">+{money(x.price)}</span>
                    </button>
                  );
                })}
              </Card>
            </div>
          )}

          {p.reviews.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">{t("Reviews")} <Stars value={p.rating} count={p.reviewCount} /></p>
              <div className="flex flex-col gap-2">
                {p.reviews.map((r, i) => (
                  <Card key={i} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">{r.name}</span>
                      <span className="flex" aria-label={t("{n} of 5", { n: r.rating })}>
                        {Array.from({ length: 5 }, (_, k) => (
                          <Star key={k} size={12} strokeWidth={STROKE} className={k < r.rating ? "fill-amber-400 text-amber-500" : "text-line"} aria-hidden />
                        ))}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-strong">{r.text}</p>
                  </Card>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-muted">{t("Reviews are invented for the simulation.")}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-lg font-bold text-ink">{t("People also bought")}</p>
            <div className="no-scrollbar -mx-gutter flex gap-3 overflow-x-auto px-gutter pb-2">
              {others.map((o) => (
                <button key={o.id} type="button" onClick={() => onOpen(o.id)} className="w-32 shrink-0 rounded-md bg-card p-2 text-left shadow-app-card">
                  <ProductImage src={o.image} icon={iconOf(header.icon)} accent={header.accent} alt={o.name} />
                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-ink">{o.name}</p>
                  <p className="tnum text-xs text-ink-muted">{money(o.price)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-line bg-card px-gutter py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="flex items-center rounded-pill border border-line">
          <button type="button" aria-label={t("Less")} className="flex h-11 w-11 items-center justify-center" onClick={() => { sfx.click(); setQty((q) => Math.max(1, q - 1)); }}><Minus size={18} strokeWidth={STROKE} aria-hidden /></button>
          <span className="tnum w-6 text-center font-semibold">{qty}</span>
          <button type="button" aria-label={t("More")} className="flex h-11 w-11 items-center justify-center" onClick={() => { sfx.click(); setQty((q) => Math.min(9, q + 1)); }}><Plus size={18} strokeWidth={STROKE} aria-hidden /></button>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => onAdd({ productId: p.id, qty, choice, addOns, unit })}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-pill font-semibold text-white shadow-middle"
          style={{ background: a.main }}
        >
          <ShoppingBasket size={20} strokeWidth={STROKE} aria-hidden />
          {t("Add to basket")} · <span className="tnum">{money(unit * qty)}</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------------ main
type Step = "shop" | "basket" | "checkout" | "done";

export function ShopFlow({ session, onNewCraving }: { session: ShopSession; onNewCraving: () => void }) {
  const header = session.header;
  const c = useCustomer();
  const opts = useEngineOpts();
  const safe = useEngine(c ? () => engine.getSafeToSpend(c, opts) : null, [c, opts]);
  const [step, setStep] = useState<Step>("shop");
  const [lines, setLines] = useState<Line[]>([]);
  const [wish, setWish] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("rec");
  const [facets, setFacets] = useState<string[]>([]);
  const [q, setQ] = useState(session.craving);
  const [qDirty, setQDirty] = useState(false);
  const [wishOnly, setWishOnly] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const [express, setExpress] = useState(false);
  const [paying, setPaying] = useState(false);
  const [stash, setStash] = useState<number | null>(null);
  const [entry, setEntry] = useState<CraveEntry | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bump, setBump] = useState(0);

  const products = session.products;
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const a = accentOf(header?.accent);
  const isFood = header?.kind === "food";

  const visible = useMemo(() => {
    let list = products.slice();
    const needle = q.trim().toLowerCase();
    if (qDirty && needle) list = list.filter((p) => `${p.brand} ${p.name} ${p.pitch} ${p.section} ${p.tags.join(" ")}`.toLowerCase().includes(needle));
    if (facets.length) list = list.filter((p) => facets.every((f) => p.tags.includes(f)));
    if (wishOnly) list = list.filter((p) => wish.has(p.id));
    if (sort === "deals") list = list.filter((p) => p.compareAtPrice);
    if (sort === "low") list.sort((x, y) => x.price - y.price);
    if (sort === "high") list.sort((x, y) => y.price - x.price);
    if (sort === "rating") list.sort((x, y) => y.rating - x.rating || y.reviewCount - x.reviewCount);
    return list;
  }, [products, q, qDirty, facets, wishOnly, wish, sort]);

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = r2(lines.reduce((s, l) => s + l.unit * l.qty, 0));
  const freeFrom = header?.freeDeliveryFrom ?? 0;
  const baseFee = !header || subtotal >= freeFrom ? 0 : header.deliveryFee;
  const expressFee = express ? (isFood ? 1.99 : 4.9) : 0;
  const total = r2(subtotal + baseFee + expressFee);
  const freeUntilPayday = safe?.ok ? safe.value.freeUntilPayday : null;
  const overSafe = freeUntilPayday != null && total > Math.max(0, freeUntilPayday);
  const maxStash = freeUntilPayday != null ? Math.max(0, Math.min(total, Math.floor(freeUntilPayday))) : total;
  const stashAmount = stash != null ? Math.min(stash, total) : overSafe ? maxStash : total;

  const add = (l: Omit<Line, "key">) => {
    const key = `${l.productId}|${JSON.stringify(l.choice)}|${l.addOns.join(",")}`;
    setLines((ls) => (ls.some((x) => x.key === key) ? ls.map((x) => (x.key === key ? { ...x, qty: Math.min(9, x.qty + l.qty) } : x)) : [...ls, { ...l, key }]));
    sfx.pop();
    setBump((b) => b + 1);
  };
  const quickAdd = (p: CraveProduct) => add({ productId: p.id, qty: 1, choice: Object.fromEntries(p.variants.map((v) => [v.name, v.options[0]])), addOns: [], unit: p.price });
  const toggleWish = (id: string) => setWish((w) => {
    const n = new Set(w);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const setQty = (key: string, d: number) => {
    sfx.click();
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, qty: Math.max(0, Math.min(9, l.qty + d)) } : l)).filter((l) => l.qty > 0));
  };

  const orderPlaced = () => {
    if (!header) return;
    const e: CraveEntry = {
      id: newOrderId(),
      craving: session.craving,
      shopName: header.shopName,
      kind: header.kind,
      category: header.category,
      basketTotal: total,
      amount: r2(stashAmount),
      items: lines.map((l) => ({ name: byId.get(l.productId)?.name ?? t("Item"), qty: l.qty, price: r2(l.unit * l.qty) })),
      at: Date.now(),
      status: "saved",
    };
    craveActions.add(e);
    scheduleEmails(e);
    setEntry(e);
    setPaying(false);
    setStep("done");
  };

  const back = () => {
    sfx.click();
    if (open) setOpen(null);
    else if (step === "basket") setStep("shop");
    else if (step === "checkout") setStep("basket");
    else goBack("/vara/today");
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  if (step === "done" && entry && header) return <Reveal entry={entry} header={header} products={products} lines={lines.map((l) => ({ ...l, product: byId.get(l.productId) }))} onNewCraving={onNewCraving} />;

  const sections = header?.sections.length ? header.sections : [...new Set(products.map((p) => p.section).filter(Boolean))];
  const facetList = header?.facets.length ? header.facets : [...new Set(products.flatMap((p) => p.tags))].slice(0, 6);
  const loadingMore = session.status === "loading";
  const skeletons = loadingMore ? Math.max(0, Math.min(4, 10 - products.length)) : 0;
  const ShopIcon = iconOf(header?.icon);
  const openP = open ? byId.get(open) : null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-screen">
      {/* top bar */}
      <header className="z-20 flex items-center gap-1 bg-screen px-1 pt-[env(safe-area-inset-top)]">
        <IconButton icon={ArrowLeft} label={t("Back")} onClick={back} />
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-base font-bold text-ink">{step === "shop" ? header?.shopName ?? t("Crave mode") : step === "basket" ? t("Your basket") : t("Checkout")}</p>
          <NothingShipsPill className="mt-0.5 scale-90" />
        </div>
        <motion.button
          key={bump}
          type="button"
          aria-label={tn("Basket, {n} item", "Basket, {n} items", count)}
          initial={{ scale: 1 }}
          animate={{ scale: bump ? [1, 1.25, 1] : 1 }}
          transition={{ duration: 0.3 }}
          onClick={() => { sfx.click(); if (count) setStep("basket"); }}
          className="relative flex h-11 w-11 items-center justify-center rounded-pill text-green-900"
        >
          <ShoppingBasket size={24} strokeWidth={STROKE} aria-hidden />
          {count > 0 && <span className="tnum absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-pill px-1 text-[11px] font-bold text-white" style={{ background: a.main }}>{count}</span>}
        </motion.button>
      </header>

      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto pb-28">
        {step === "shop" && header && (
          <div className="flex flex-col gap-3 pb-4">
            {/* shop banner */}
            <div className="mx-gutter overflow-hidden rounded-app-card shadow-app-card" style={{ background: `linear-gradient(135deg, ${a.main}, ${a.ink})` }}>
              <div className="flex items-center gap-3 p-4 text-white">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-white/15"><ShopIcon size={30} strokeWidth={STROKE} aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-bold">{header.shopName}</p>
                  <p className="truncate text-sm text-white/80">{header.tagline}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/90">
                    <span className="inline-flex items-center gap-1"><Star size={12} strokeWidth={STROKE} className="fill-white" aria-hidden /> {header.rating.toFixed(1).replace(".", ",")} ({header.reviewCount.toLocaleString("fi-FI")})</span>
                    <span className="inline-flex items-center gap-1">{isFood ? <Clock size={12} strokeWidth={STROKE} aria-hidden /> : <Truck size={12} strokeWidth={STROKE} aria-hidden />} {deliveryTime(header)}</span>
                    {freeFrom > 0 && <span>{t("Free delivery from {amount}", { amount: money(freeFrom, { whole: true }) })}</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* search */}
            <div className="mx-gutter flex min-h-12 items-center gap-2 rounded-pill border border-line bg-card px-4 shadow-app-card">
              <Search size={18} strokeWidth={STROKE} className="text-ink-muted" aria-hidden />
              <input
                aria-label={t("Search this shop")}
                value={q}
                onChange={(e) => { setQ(e.target.value); setQDirty(true); }}
                className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none"
              />
              {q && <button type="button" aria-label={t("Clear search")} onClick={() => { setQ(""); setQDirty(true); }}><X size={18} strokeWidth={STROKE} className="text-ink-muted" aria-hidden /></button>}
            </div>

            {/* sort + filters */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-gutter">
              {SORTS.map((s) => <MiniChip key={s.v} on={sort === s.v} color={a.main} onClick={() => setSort(sort === s.v && s.v !== "rec" ? "rec" : s.v)}>{t(s.label)}</MiniChip>)}
              <MiniChip on={wishOnly} color={a.main} onClick={() => setWishOnly((w) => !w)}><Heart size={14} strokeWidth={STROKE} aria-hidden /> {wish.size}</MiniChip>
            </div>
            {facetList.length > 0 && (
              <div className="no-scrollbar -mt-1 flex gap-2 overflow-x-auto px-gutter">
                {facetList.map((f) => (
                  <MiniChip key={f} on={facets.includes(f)} color={a.main} onClick={() => setFacets((l) => (l.includes(f) ? l.filter((x) => x !== f) : [...l, f]))}>{f}</MiniChip>
                ))}
              </div>
            )}

            {isFood ? (
              <div className="mx-gutter">
                {sections.length > 1 && (
                  <div className="no-scrollbar sticky top-0 z-10 -mx-gutter flex gap-4 overflow-x-auto bg-screen px-gutter py-2">
                    {[null, ...sections].map((s) => (
                      <button key={s ?? "all"} type="button" onClick={() => { sfx.click(); setSection(s); }} className={cx("shrink-0 border-b-2 pb-1 text-sm font-semibold", section === s ? "text-ink" : "border-transparent text-ink-muted")} style={section === s ? { borderColor: a.main } : undefined}>
                        {s ?? t("All")}
                      </button>
                    ))}
                  </div>
                )}
                <Card padded={false} className="px-3">
                  {(section ? [section] : sections.length ? sections : [""]).map((sec) => {
                    const items = visible.filter((p) => !sec || p.section === sec || (!sections.includes(p.section) && sec === sections[0]));
                    if (!items.length) return null;
                    return (
                      <section key={sec} aria-label={sec}>
                        {sec && <h3 className="pt-3 text-lg font-bold text-ink">{sec}</h3>}
                        {items.map((p) => <MenuRow key={p.id} p={p} header={header} wished={wish.has(p.id)} onWish={() => toggleWish(p.id)} onOpen={() => { sfx.click(); setOpen(p.id); }} onQuickAdd={() => quickAdd(p)} />)}
                      </section>
                    );
                  })}
                  {Array.from({ length: skeletons }, (_, i) => (
                    <div key={i} className="flex gap-3 border-b border-line py-3"><div className="flex flex-1 flex-col gap-2"><span className="skeleton h-4 w-2/3 rounded-sm" /><span className="skeleton h-3 w-full rounded-sm" /><span className="skeleton h-4 w-16 rounded-sm" /></div><span className="skeleton h-[104px] w-[104px] rounded-md" /></div>
                  ))}
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 px-gutter">
                {visible.map((p) => <GridCard key={p.id} p={p} header={header} wished={wish.has(p.id)} onWish={() => toggleWish(p.id)} onOpen={() => { sfx.click(); setOpen(p.id); }} onQuickAdd={() => quickAdd(p)} />)}
                {Array.from({ length: skeletons }, (_, i) => (
                  <div key={i} className="rounded-app-card bg-card p-2 shadow-app-card"><span className="skeleton block aspect-square w-full rounded-md" /><span className="skeleton mt-2 block h-3 w-1/2 rounded-sm" /><span className="skeleton mt-1.5 block h-4 w-full rounded-sm" /><span className="skeleton mt-1.5 block h-4 w-1/3 rounded-sm" /></div>
                ))}
              </div>
            )}
            {!visible.length && !loadingMore && (
              <div className="mx-gutter rounded-app-card bg-card p-5 text-center shadow-app-card">
                <p className="font-semibold text-ink">{t("Nothing matches those filters")}</p>
                <Button size="sm" variant="ghost" onClick={() => { setFacets([]); setWishOnly(false); setQ(""); setSort("rec"); }}>{t("Clear filters")}</Button>
              </div>
            )}
            {loadingMore && <p className="flex items-center justify-center gap-2 text-sm text-ink-muted"><Sparkles size={14} strokeWidth={STROKE} aria-hidden /> {t("Stocking the shelves…")}</p>}
          </div>
        )}

        {step === "basket" && header && (
          <div className="flex flex-col gap-3 px-gutter pb-4">
            <FreeDelivery subtotal={subtotal} freeFrom={freeFrom} fee={header.deliveryFee} color={a.main} />
            <Card padded={false} className="divide-y divide-line px-3">
              {lines.map((l) => {
                const p = byId.get(l.productId);
                if (!p) return null;
                const extra = [...Object.values(l.choice), ...l.addOns].join(" · ");
                return (
                  <motion.div layout key={l.key} className="flex items-center gap-3 py-3">
                    <div className="w-16 shrink-0"><ProductImage src={p.image} icon={iconOf(header.icon)} accent={header.accent} alt={p.name} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                      {extra && <p className="truncate text-xs text-ink-muted">{extra}</p>}
                      <p className="tnum text-sm font-semibold text-ink">{money(l.unit * l.qty)}</p>
                    </div>
                    <div className="flex items-center rounded-pill border border-line">
                      <button type="button" aria-label={t("Less")} className="flex h-10 w-9 items-center justify-center" onClick={() => setQty(l.key, -1)}><Minus size={16} strokeWidth={STROKE} aria-hidden /></button>
                      <span className="tnum w-5 text-center text-sm font-semibold">{l.qty}</span>
                      <button type="button" aria-label={t("More")} className="flex h-10 w-9 items-center justify-center" onClick={() => setQty(l.key, 1)}><Plus size={16} strokeWidth={STROKE} aria-hidden /></button>
                    </div>
                  </motion.div>
                );
              })}
              {!lines.length && <p className="py-6 text-center text-ink-muted">{t("Your basket is empty.")}</p>}
            </Card>
            <Recommended header={header} products={(session.alsoBought.length ? session.alsoBought.map((id) => byId.get(id)!).filter(Boolean) : products.slice(0, 4)).filter((p) => !lines.some((l) => l.productId === p.id))} onAdd={quickAdd} />
            <Summary subtotal={subtotal} fee={baseFee} express={expressFee} total={total} />
          </div>
        )}

        {step === "checkout" && header && (
          <div className="flex flex-col gap-3 px-gutter pb-4">
            <Card>
              <p className="flex items-center justify-between text-sm font-semibold text-ink-strong">{t("Delivery details")} <span className="rounded-pill bg-sunken px-2 py-0.5 text-xs font-semibold text-ink-muted">{t("Demo data")}</span></p>
              <p className="mt-2 text-ink">{(PERSONAS.find((x) => x.id === c?.id)?.alias ?? "Demo")} Esimerkki</p>
              <p className="text-sm text-ink-muted">Esimerkkikatu 12 B 7, 00100 Helsinki</p>
              <p className="text-sm text-ink-muted">demo@example.invalid · +358 00 000 0000</p>
            </Card>
            <Card>
              <p className="mb-2 text-sm font-semibold text-ink-strong">{t("Delivery")}</p>
              {[
                { on: !express, title: t("Standard · {promise}", { promise: deliveryTime(header) }), sub: baseFee ? money(baseFee) : t("Free"), icon: isFood ? Bike : Truck, set: () => setExpress(false) },
                { on: express, title: isFood ? t("Priority · about 10 min sooner") : t("Express · tomorrow before 12"), sub: `+${money(isFood ? 1.99 : 4.9)}`, icon: Zap, set: () => setExpress(true) },
              ].map((o) => (
                <button key={o.title} type="button" aria-pressed={o.on} onClick={() => { sfx.click(); o.set(); }} className="flex min-h-14 w-full items-center gap-3 rounded-md border px-3 text-left transition-colors [&+&]:mt-2" style={{ borderColor: o.on ? a.main : "#e6e6e6", background: o.on ? a.soft : undefined }}>
                  <o.icon size={20} strokeWidth={STROKE} style={{ color: a.main }} aria-hidden />
                  <span className="flex-1 text-sm font-semibold text-ink">{o.title}</span>
                  <span className="tnum text-sm text-ink-strong">{o.sub}</span>
                </button>
              ))}
            </Card>
            <Card>
              <p className="mb-1 text-sm font-semibold text-ink-strong">{t("Order summary")}</p>
              {lines.map((l) => (
                <p key={l.key} className="flex justify-between gap-2 text-sm text-ink"><span className="truncate">{l.qty} × {byId.get(l.productId)?.name}</span><span className="tnum shrink-0">{money(l.unit * l.qty)}</span></p>
              ))}
              <div className="mt-2"><Summary subtotal={subtotal} fee={baseFee} express={expressFee} total={total} bare /></div>
            </Card>
            <Guard total={total} free={freeUntilPayday} pot={safe?.ok ? safe.value.cravePot ?? 0 : 0} payday={safe?.ok ? safe.value.nextPayday?.date ?? null : null} overSafe={overSafe} maxStash={maxStash} stash={stashAmount} setStash={setStash} />
          </div>
        )}
      </div>

      {/* bottom CTA */}
      {step === "shop" && count > 0 && (
        <motion.button
          type="button"
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          onClick={() => { sfx.click(); setStep("basket"); }}
          className="absolute inset-x-gutter bottom-4 z-20 flex min-h-14 items-center justify-between rounded-pill px-5 font-semibold text-white shadow-middle"
          style={{ background: a.main }}
        >
          <span className="flex items-center gap-2"><ShoppingBasket size={20} strokeWidth={STROKE} aria-hidden /> {t("View basket")} · {count}</span>
          <span className="tnum">{money(subtotal)}</span>
        </motion.button>
      )}
      {step === "basket" && lines.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-line bg-card px-gutter py-3">
          <Button full iconRight={ChevronRight} onClick={() => { sfx.click(); setStep("checkout"); }} style={{ background: a.main }}>{t("Checkout")} · {money(total)}</Button>
        </div>
      )}
      {step === "checkout" && (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-line bg-card px-gutter py-3">
          <Button full onClick={() => { sfx.click(); setPaying(true); }} style={{ background: a.main }}>
            {stashAmount > 0 ? t("Pay {amount}", { amount: money(total) }) : t("Place order (window-shopping)")}
          </Button>
        </div>
      )}

      <AnimatePresence>
        {openP && header && (
          <ProductPage
            key={openP.id}
            p={openP}
            header={header}
            all={products}
            wished={wish.has(openP.id)}
            onWish={() => toggleWish(openP.id)}
            onClose={() => setOpen(null)}
            onOpen={(id) => setOpen(id)}
            onAdd={(l) => { add(l); setOpen(null); }}
          />
        )}
      </AnimatePresence>
      {header && <PaySheet open={paying} header={header} total={total} stash={stashAmount} onClose={() => setPaying(false)} onPaid={orderPlaced} />}
    </div>
  );
}

function FreeDelivery({ subtotal, freeFrom, fee, color }: { subtotal: number; freeFrom: number; fee: number; color: string }) {
  if (!freeFrom || !fee) return null;
  const left = r2(freeFrom - subtotal);
  return (
    <Card className="p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Truck size={18} strokeWidth={STROKE} style={{ color }} aria-hidden />
        {left > 0 ? t("Add {amount} more for free delivery", { amount: money(left) }) : t("Free delivery unlocked")}
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-track">
        <motion.div className="h-full rounded-pill" style={{ background: color }} initial={false} animate={{ width: `${Math.min(100, (subtotal / freeFrom) * 100)}%` }} />
      </div>
    </Card>
  );
}

function Recommended({ header, products, onAdd }: { header: CraveShopHeader; products: CraveProduct[]; onAdd: (p: CraveProduct) => void }) {
  if (!products.length) return null;
  const a = accentOf(header.accent);
  return (
    <div>
      <p className="mb-2 px-1 text-lg font-bold text-ink">{header.kind === "food" ? t("Goes well with") : t("Frequently bought together")}</p>
      <div className="no-scrollbar -mx-gutter flex gap-3 overflow-x-auto px-gutter pb-1">
        {products.slice(0, 5).map((p) => (
          <div key={p.id} className="relative w-32 shrink-0 rounded-md bg-card p-2 shadow-app-card">
            <ProductImage src={p.image} icon={iconOf(header.icon)} accent={header.accent} alt={p.name} />
            <p className="mt-1 line-clamp-2 min-h-8 text-xs font-semibold text-ink">{p.name}</p>
            <p className="tnum text-xs text-ink-muted">{money(p.price)}</p>
            <button type="button" aria-label={t("Add {name}", { name: p.name })} onClick={() => onAdd(p)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-pill text-white shadow-low" style={{ background: a.main }}>
              <Plus size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Summary({ subtotal, fee, express, total, bare }: { subtotal: number; fee: number; express: number; total: number; bare?: boolean }) {
  const rows = (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex justify-between text-ink-strong"><span>{t("Subtotal")}</span><span className="tnum">{money(subtotal)}</span></p>
      <p className="flex justify-between text-ink-strong"><span>{t("Delivery")}</span><span className="tnum">{fee ? money(fee) : t("Free")}</span></p>
      {express > 0 && <p className="flex justify-between text-ink-strong"><span>{t("Faster delivery")}</span><span className="tnum">{money(express)}</span></p>}
      <p className="mt-1 flex justify-between border-t border-line pt-2 text-base font-bold text-ink"><span>{t("Total")}</span><span className="tnum">{money(total)}</span></p>
    </div>
  );
  return bare ? rows : <Card>{rows}</Card>;
}

const paydayLabel = (d: string | null) => (d ? ` (${d.slice(8, 10).replace(/^0/, "")}.${d.slice(5, 7).replace(/^0/, "")}.)` : "");

/** The safe-to-spend guard: the pot only ever takes money that is free until payday. */
function Guard({ total, free, pot, payday, overSafe, maxStash, stash, setStash }: { total: number; free: number | null; pot: number; payday: string | null; overSafe: boolean; maxStash: number; stash: number; setStash: (n: number) => void }) {
  return (
    <Card className="border-2 border-green-200 shadow-none">
      <div className="flex items-start gap-3">
        <VaraAvatar size={32} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-green-900">{t("Where this money goes")}</p>
          <p className="mt-0.5 text-sm text-ink-strong">
            {rich(t("Nothing ships. When you pay, **{amount}** moves from your account into your Crave pot in savings. It stays yours, and you can release it any time.", { amount: money(stash) }))}
          </p>
        </div>
      </div>
      {free != null && overSafe && (
        <div className="mt-3">
          <Banner tone="warning" title={t("That's more than is free until payday")}>
            {free > 0
              ? t("This basket is {total}, and {free} is free until payday{date} once your musts are covered. Vara won't stash rent money. Choose a smaller amount, or just enjoy the window-shopping.", { total: money(total), free: money(free, { whole: true }), date: paydayLabel(payday) })
              : t("This basket is {total}, and nothing is free until payday{date} once your musts are covered. Vara won't stash rent money. Choose a smaller amount, or just enjoy the window-shopping.", { total: money(total), date: paydayLabel(payday) })}
          </Banner>
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="range"
              min={0}
              max={Math.max(1, maxStash)}
              step={1}
              value={Math.min(stash, maxStash)}
              onChange={(e) => setStash(Number(e.target.value))}
              aria-label={t("Amount to stash in the Crave pot")}
              aria-valuetext={money(stash)}
              className="vara-range h-8 w-full"
              style={{ ["--pos" as string]: `${maxStash ? (Math.min(stash, maxStash) / maxStash) * 100 : 0}%` }}
            />
            <div className="flex flex-wrap gap-2">
              {[maxStash, Math.round(maxStash / 2), Math.min(10, maxStash)].filter((v, i, l) => v > 0 && l.indexOf(v) === i).map((v) => (
                <button key={v} type="button" onClick={() => setStash(v)} className={cx("min-h-9 rounded-pill border px-3 text-sm font-semibold", stash === v ? "border-green-700 bg-green-700 text-white" : "border-green-200 bg-card text-green-900")}>{money(v, { whole: true })}</button>
              ))}
              <button type="button" onClick={() => setStash(0)} className={cx("min-h-9 rounded-pill border px-3 text-sm font-semibold", stash === 0 ? "border-green-700 bg-green-700 text-white" : "border-green-200 bg-card text-green-900")}>{t("Just window-shop (0 €)")}</button>
            </div>
          </div>
        </div>
      )}
      {free != null && !overSafe && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted"><Info size={14} strokeWidth={STROKE} className="mt-0.5 shrink-0" aria-hidden /> {t("Checked against your safe-to-spend: {amount} is free until payday, so this fits.", { amount: money(free, { whole: true }) })}</p>
      )}
      {free != null && pot > 0 && <p className="mt-1 text-xs text-ink-muted">{t("After the {amount} held in your Crave pot.", { amount: money(pot) })}</p>}
      <p className="mt-2 text-xs text-ink-muted">{t("Simulation: no money is moved in this demo.")}</p>
    </Card>
  );
}

export function ShopError({ session, customerId }: { session: ShopSession; customerId: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="text-lg font-bold text-green-900">{session.status === "refused" ? t("Crave mode can't open a shop for that") : t("The shop didn't open")}</p>
      <Muted>{session.message ?? t("Please try again.")}</Muted>
      {session.status === "refused" && <Muted>{t("Try something like sushi, new sneakers or a cosy hoodie.")}</Muted>}
      {session.status === "error" && <Button size="sm" onClick={() => startShop(session.craving, customerId, { retry: true })}>{t("Try again")}</Button>}
      <p className="mt-4 text-sm italic text-ink-muted">{t(CRAVE_MOTTO)}</p>
      <ConceptNotice />
    </div>
  );
}
