import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react';
import { AgendaItem, CartItem } from '../types/agenda';
import { getAgendaFrontDataUrl } from '../utils/coverGenerator';
import { calculateCartTotals, formatPriceARS } from '../utils/formatters';

interface CartPanelProps {
  cart: CartItem[];
  mobileDrawerOpen: boolean;
  onSetMobileDrawerOpen: (open: boolean) => void;
  onUpdateQuantity: (agenda: AgendaItem, delta: number) => void;
  onClearCart: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  mobileDrawerOpen,
  onSetMobileDrawerOpen,
  onUpdateQuantity,
  onClearCart,
}) => {
  const [orderConfirmed, setOrderConfirmed] = useState<{
    orderNumber: string;
    totalFormatted: string;
    itemCount: number;
  } | null>(null);

  const { totalItems, formattedTotal } = calculateCartTotals(cart);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    setOrderConfirmed({
      orderNumber: `#AD-${randomCode}`,
      totalFormatted: formattedTotal,
      itemCount: totalItems,
    });
    onClearCart();
  };

  const handleDismissConfirmation = () => {
    setOrderConfirmed(null);
    onSetMobileDrawerOpen(false);
  };

  const renderCartBody = () => {
    if (orderConfirmed) {
      return (
        <div
          data-testid="checkout-confirmation"
          className="p-6 text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-mono font-semibold text-emerald-700">
              PEDIDO SIMULADO {orderConfirmed.orderNumber}
            </p>
            <h3 className="text-lg font-bold text-stone-900 font-serif">
              ¡Gracias por tu compra!
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Recibimos tu pedido por{' '}
              <strong className="text-stone-900">
                {orderConfirmed.itemCount}{' '}
                {orderConfirmed.itemCount === 1 ? 'agenda' : 'agendas'}
              </strong>{' '}
              (Total:{' '}
              <span className="font-mono font-semibold text-stone-900">
                {orderConfirmed.totalFormatted}
              </span>
              ). Esto es una simulación del prototipo visual.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismissConfirmation}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Seguir viendo el catálogo
          </button>
        </div>
      );
    }

    if (cart.length === 0) {
      return (
        <div className="py-12 px-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-stone-800">
            Tu pedido está vacío
          </p>
          <p className="text-xs text-stone-500 max-w-[230px] mx-auto leading-relaxed">
            Tocá el botón <strong className="text-stone-700">+</strong> en
            cualquier agenda o abrí su vista 3D para sumarla al pedido.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Itemized list */}
        <ul className="divide-y divide-stone-100 overflow-y-auto max-h-[340px] lg:max-h-[380px] px-5">
          {cart.map(({ agenda, quantity }) => {
            const frontUrl = getAgendaFrontDataUrl(agenda);
            return (
              <li
                key={agenda.id}
                className="py-3.5 flex items-center justify-between gap-3"
              >
                <img
                  src={frontUrl}
                  alt={agenda.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-14 object-cover rounded-r-md rounded-l-2xs shadow-2xs shrink-0 border border-stone-200/60"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-900 truncate">
                    {agenda.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {agenda.category} · {agenda.format}
                  </p>
                  <p className="text-xs font-mono font-semibold text-stone-800 mt-0.5 tabular-nums">
                    {formatPriceARS(agenda.price * quantity)}
                  </p>
                </div>

                {/* Quantity stepper */}
                <div className="flex items-center gap-1.5 bg-stone-100 rounded-xl p-1 border border-stone-200/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(agenda, -1)}
                    aria-label={
                      quantity === 1
                        ? `Quitar ${agenda.name} del pedido`
                        : `Restar una unidad de ${agenda.name}`
                    }
                    className="w-7 h-7 rounded-lg bg-white text-stone-700 hover:text-stone-950 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                  >
                    {quantity === 1 ? (
                      <Trash2 className="w-3.5 h-3.5 text-stone-500" />
                    ) : (
                      <Minus className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="w-6 text-center font-mono text-xs font-bold text-stone-900 tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(agenda, 1)}
                    aria-label={`Sumar una unidad de ${agenda.name}`}
                    className="w-7 h-7 rounded-lg bg-white text-stone-700 hover:text-stone-950 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Subtotal & Checkout CTA */}
        <div className="p-5 bg-stone-50/70 border-t border-stone-200/80 space-y-4 mt-auto">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-stone-600 text-xs">
              <span>Envío a domicilio (AMBA e Interior)</span>
              <span className="font-medium text-emerald-700">Bonificado</span>
            </div>
            <div className="flex items-center justify-between font-bold text-stone-900 text-base pt-1">
              <span>Total</span>
              <span
                data-testid="cart-total-amount"
                className="font-mono text-lg tabular-nums"
              >
                {formattedTotal}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            className="w-full min-h-[48px] py-3 px-5 rounded-xl bg-[#B83B24] hover:bg-[#9E311D] active:scale-[0.99] text-white font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Finalizar compra</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sticky Side Panel */}
      <aside
        aria-label="Resumen de tu pedido"
        className="hidden lg:flex flex-col bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden sticky top-24"
      >
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#B83B24]" />
            <h2 className="text-base font-bold text-stone-900">Tu pedido</h2>
          </div>
          {totalItems > 0 && (
            <span className="text-xs font-mono font-semibold text-stone-500 tabular-nums">
              {totalItems} {totalItems === 1 ? 'unidad' : 'unidades'}
            </span>
          )}
        </div>
        {renderCartBody()}
      </aside>

      {/* Mobile Fixed Bottom Bar (strictly <= 64px height to respect 15% sticky cap) */}
      {(totalItems > 0 || orderConfirmed) && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-2.5 bg-white/95 border-t border-stone-200 shadow-lg">
          <button
            type="button"
            onClick={() => onSetMobileDrawerOpen(true)}
            className="w-full h-11 px-4 rounded-xl bg-[#B83B24] text-white font-semibold text-sm flex items-center justify-between shadow-xs cursor-pointer"
          >
            <span className="flex items-center gap-2 whitespace-nowrap">
              <ShoppingBag className="w-4 h-4" />
              <span>
                Ver pedido ({totalItems}) · {formattedTotal}
              </span>
            </span>
            <span className="text-xs font-medium underline underline-offset-2 whitespace-nowrap">
              Abrir
            </span>
          </button>
        </div>
      )}

      {/* Mobile Slide-Over Sheet Drawer */}
      {mobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Detalle del pedido"
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-stone-950/50"
          onClick={() => onSetMobileDrawerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl border-t border-stone-200 shadow-2xl max-h-[82vh] flex flex-col overflow-hidden"
          >
            <div className="w-10 h-1.5 bg-stone-300 rounded-full mx-auto mt-3 mb-1" />
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">
                Tu pedido ({totalItems})
              </h2>
              <button
                type="button"
                onClick={() => onSetMobileDrawerOpen(false)}
                aria-label="Cerrar carrito"
                className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderCartBody()}
          </div>
        </div>
      )}
    </>
  );
};
