import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Search,
  ShoppingBag,
  X,
  UploadCloud,
  BookMarked,
  CheckCircle2,
} from 'lucide-react';
import { INITIAL_AGENDAS } from './data/agendas';
import { AgendaCategory, AgendaItem, CartItem } from './types/agenda';
import {
  addOrUpdateCartItem,
  calculateCartTotals,
  CATEGORIES_ORDER,
  filterAgendasByName,
  groupAgendasByCategory,
} from './utils/formatters';
import { AgendaCard } from './components/AgendaCard';
import { AgendaDetailModal } from './components/AgendaDetailModal';
import { CartPanel } from './components/CartPanel';
import { UploadAgendaView } from './components/UploadAgendaView';

type ActiveTab = 'catalog' | 'upload';

const CATEGORY_DESCRIPTIONS: Record<AgendaCategory, string> = {
  Semanales: 'Formato A5 (148×210 mm) · Semana a la vista en doble página',
  Diarias: 'Formato A5 (148×210 mm) · Un día completo por página con horarios',
  Mini: 'Formato bolsillo A6 (105×148 mm) · Compactas para llevar a todos lados',
};

export default function App() {
  const [agendas, setAgendas] = useState<AgendaItem[]>(INITIAL_AGENDAS);
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] =
    useState<AgendaCategory>('Semanales');
  const [selectedAgenda, setSelectedAgenda] = useState<AgendaItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const sectionRefs = useRef<Record<AgendaCategory, HTMLElement | null>>({
    Semanales: null,
    Diarias: null,
    Mini: null,
  });
  const isProgrammaticScroll = useRef(false);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  // Filtered and grouped agendas
  const filteredAgendas = useMemo(
    () => filterAgendasByName(agendas, searchQuery),
    [agendas, searchQuery]
  );

  const groupedAgendas = useMemo(
    () => groupAgendasByCategory(filteredAgendas),
    [filteredAgendas]
  );

  const { totalItems, formattedTotal } = useMemo(
    () => calculateCartTotals(cart),
    [cart]
  );

  // Scroll spy for sticky category bar
  useEffect(() => {
    if (activeTab !== 'catalog') return;

    const handleScroll = () => {
      if (isProgrammaticScroll.current) return;
      const offsetThreshold = 165;
      let currentCat: AgendaCategory = 'Semanales';

      for (const cat of CATEGORIES_ORDER) {
        const el = sectionRefs.current[cat];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= offsetThreshold) {
            currentCat = cat;
          }
        }
      }
      setActiveCategory(currentCat);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const handleScrollToCategory = (category: AgendaCategory) => {
    setActiveCategory(category);
    const el = sectionRefs.current[category];
    if (!el) return;

    isProgrammaticScroll.current = true;
    const headerOffset = 128;
    const elementPosition = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: Math.max(0, elementPosition - headerOffset),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });

    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 600);
  };

  const handleUpdateCart = (agenda: AgendaItem, delta: number) => {
    setCart((prev) => addOrUpdateCartItem(prev, agenda, delta));
    if (delta > 0) {
      showToast(`Se agregó "${agenda.name}" al pedido`);
    }
  };

  const handlePublishAgenda = (newAgenda: AgendaItem) => {
    setAgendas((prev) => [newAgenda, ...prev]);
    setActiveTab('catalog');
    setSearchQuery('');
    setActiveCategory(newAgenda.category);
    showToast(`¡Agenda "${newAgenda.name}" publicada con modelo 3D!`);
    window.setTimeout(() => {
      handleScrollToCategory(newAgenda.category);
    }, 120);
  };

  return (
    <LayoutGroup>
      <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-stone-900 pb-20 lg:pb-12">
        {/* Top Bar (Clean 3-zone header: Brand, Navigation Tabs, Cart Button) */}
        <header className="bg-white border-b border-stone-200/80 z-30">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-8">
            {/* Zone 1: Brand Title */}
            <a
              href="#catalogo"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('catalog');
              }}
              className="text-base sm:text-xl font-bold tracking-tight text-stone-900 font-serif whitespace-nowrap shrink-0"
            >
              Agendas Demo
            </a>

            {/* Zone 2: Navigation Tabs (Catálogo / Cargar agenda) */}
            <nav
              aria-label="Navegación principal"
              className="flex items-center gap-2.5 sm:gap-6 text-xs sm:text-sm font-medium text-stone-600"
            >
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'catalog'
                    ? 'border-[#B83B24] text-stone-950 font-semibold'
                    : 'border-transparent hover:text-stone-900'
                }`}
              >
                <BookMarked className="hidden sm:inline w-4 h-4" />
                <span>Catálogo ({agendas.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'upload'
                    ? 'border-[#B83B24] text-stone-950 font-semibold'
                    : 'border-transparent hover:text-stone-900'
                }`}
              >
                <UploadCloud className="hidden sm:inline w-4 h-4" />
                <span>Cargar agenda</span>
              </button>
            </nav>

            {/* Zone 3: Cart Action Button with Counter */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setMobileCartOpen(true);
                  } else {
                    setActiveTab('catalog');
                  }
                }}
                aria-label={`Ver carrito de compras, ${totalItems} ${
                  totalItems === 1 ? 'artículo' : 'artículos'
                }`}
                className="min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
                <span className="hidden sm:inline">Pedido</span>
                <span
                  data-testid="header-cart-count"
                  className="font-mono font-bold bg-white/15 px-1.5 sm:px-2 py-0.5 rounded-md tabular-nums"
                >
                  {totalItems}
                </span>
                {totalItems > 0 && (
                  <span className="hidden md:inline font-mono text-xs text-stone-300 tabular-nums">
                    · {formattedTotal}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        {activeTab === 'upload' ? (
          <main className="flex-1">
            <UploadAgendaView onPublishAgenda={handlePublishAgenda} />
          </main>
        ) : (
          <>
            {/* Search & Sticky Category Navigation Bar */}
            <div className="sticky top-0 z-20 bg-[#FAF7F2]/95 border-b border-stone-200/80 shadow-2xs">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Horizontal Category Pills / Tabs */}
                <div
                  role="tablist"
                  aria-label="Categorías de agendas"
                  className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
                >
                  {CATEGORIES_ORDER.map((category) => {
                    const count = groupedAgendas[category].length;
                    const isActive = activeCategory === category;
                    return (
                      <button
                        key={category}
                        role="tab"
                        aria-selected={isActive}
                        type="button"
                        onClick={() => handleScrollToCategory(category)}
                        className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-stone-900 text-white shadow-2xs'
                            : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200/80'
                        }`}
                      >
                        <span>{category}</span>
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            isActive ? 'text-stone-300' : 'text-stone-400'
                          }`}
                        >
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Input by Name */}
                <div className="relative w-full sm:w-72 md:w-80">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar agenda por nombre…"
                    aria-label="Buscar agenda por nombre"
                    className="w-full h-10 pl-9 pr-9 rounded-xl bg-white border border-stone-200/90 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#B83B24] focus:outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Catalog + Desktop Cart Split Layout */}
            <main
              id="catalogo"
              className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Left 8 Columns: Grouped Category Sections */}
              <div className="lg:col-span-8 space-y-10">
                {filteredAgendas.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-stone-200/80 p-10 text-center space-y-3">
                    <p className="text-base font-bold text-stone-900">
                      No encontramos agendas con "{searchQuery}"
                    </p>
                    <p className="text-xs sm:text-sm text-stone-500">
                      Probá con otro término o limpiá el filtro para ver las{' '}
                      {agendas.length} agendas disponibles.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="mt-2 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                      Mostrar todas las agendas
                    </button>
                  </div>
                ) : (
                  CATEGORIES_ORDER.map((category) => {
                    const items = groupedAgendas[category];
                    if (items.length === 0) return null;

                    return (
                      <section
                        key={category}
                        id={`seccion-${category.toLowerCase()}`}
                        ref={(el) => {
                          sectionRefs.current[category] = el;
                        }}
                        className="space-y-4 scroll-mt-32"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-stone-200/80 pb-2.5">
                          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif tracking-tight">
                            {category}
                          </h2>
                          <span className="text-xs font-medium text-stone-500">
                            {CATEGORY_DESCRIPTIONS[category]}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {items.map((agenda) => (
                            <AgendaCard
                              key={agenda.id}
                              agenda={agenda}
                              reducedMotion={reducedMotion}
                              isModalOpenForThis={
                                selectedAgenda?.id === agenda.id
                              }
                              onSelect={(item) => setSelectedAgenda(item)}
                              onQuickAdd={(item) => handleUpdateCart(item, 1)}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })
                )}
              </div>

              {/* Right 4 Columns: Desktop Cart Panel + Mobile Cart Bar/Drawer */}
              <div className="lg:col-span-4">
                <CartPanel
                  cart={cart}
                  mobileDrawerOpen={mobileCartOpen}
                  onSetMobileDrawerOpen={setMobileCartOpen}
                  onUpdateQuantity={handleUpdateCart}
                  onClearCart={() => setCart([])}
                />
              </div>
            </main>
          </>
        )}

        {/* Subtle Non-Intrusive Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <div
              role="status"
              aria-live="polite"
              className="fixed bottom-16 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-stone-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs sm:text-sm font-medium flex items-center gap-2 pointer-events-none"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}
        </AnimatePresence>

        {/* Pantalla 2: Modal Detalle con Agenda 3D (Mounted only while open) */}
        <AnimatePresence>
          {selectedAgenda && (
            <AgendaDetailModal
              key={selectedAgenda.id}
              agenda={selectedAgenda}
              reducedMotion={reducedMotion}
              onClose={() => setSelectedAgenda(null)}
              onAddToCart={(item, qty) => handleUpdateCart(item, qty)}
            />
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
