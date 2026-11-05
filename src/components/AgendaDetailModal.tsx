import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  RotateCw,
  Plus,
  Minus,
  ShoppingBag,
  BookOpen,
  Layers,
  Ruler,
} from 'lucide-react';
import { AgendaItem, CameraPreset } from '../types/agenda';
import {
  Agenda3DViewer,
  COVER_STAGE_HEIGHT_FRACTION,
} from './Agenda3DViewer';
import { getAgendaFrontDataUrl } from '../utils/coverGenerator';
import { formatPriceARS, getDimensionsForFormat } from '../utils/formatters';

interface AgendaDetailModalProps {
  agenda: AgendaItem;
  reducedMotion: boolean;
  onClose: () => void;
  onAddToCart: (agenda: AgendaItem, quantity: number) => void;
}

export const AgendaDetailModal: React.FC<AgendaDetailModalProps> = ({
  agenda,
  reducedMotion,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [sceneReady, setSceneReady] = useState(false);
  const [layoutDone, setLayoutDone] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPreset | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  const dims = getDimensionsForFormat(agenda.format);
  const frontDataUrl = getAgendaFrontDataUrl(agenda);

  // Trigger the ~400ms crossfade once the layoutId transition completes and the 3D canvas has rendered its first frame
  useEffect(() => {
    if (reducedMotion) {
      const t = window.setTimeout(() => setLayoutDone(true), 50);
      return () => window.clearTimeout(t);
    }
    const timer = window.setTimeout(() => {
      setLayoutDone(true);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (sceneReady && layoutDone) {
      setShow3D(true);
    }
  }, [sceneReady, layoutDone]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelectPreset = (preset: CameraPreset) => {
    setAutoRotate(false);
    setActivePreset(preset);
  };

  const handleToggleAutoRotate = () => {
    setActivePreset(null);
    setAutoRotate((prev) => !prev);
  };

  const handleConfirmAdd = () => {
    onAddToCart(agenda, quantity);
    onClose();
  };

  const aspectRatio = `${dims.widthMm} / ${dims.heightMm}`;
  const stageHeightPct = `${Math.round(COVER_STAGE_HEIGHT_FRACTION * 100)}%`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-agenda-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/60"
      onClick={onClose}
    >
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
        transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 max-h-[92vh] lg:h-[640px]"
      >
        {/* Close Button (X) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="absolute top-4 right-4 z-30 w-11 h-11 rounded-full bg-white text-stone-700 hover:text-stone-950 hover:bg-stone-100 border border-stone-200 shadow-sm flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left / Top Stage: Shared Cover -> 3D Studio Viewport */}
        <div
          className="lg:col-span-7 relative h-[360px] sm:h-[430px] lg:h-full flex items-center justify-center overflow-hidden select-none"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, #FAF7F2 0%, #EFEAE1 65%, #E4DDD0 100%)',
          }}
        >
          {/* Top-left subtle format instruction */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2 text-xs font-medium text-stone-600 bg-white/95 px-3 py-1.5 rounded-lg border border-stone-200/80 shadow-2xs">
            <span>Giro 360° interactivo</span>
            <span aria-hidden="true">·</span>
            <span>Arrastrá o usá la rueda para zoom</span>
          </div>

          {/* 3D Canvas Layer (mounted only while modal is open, crossfades in over 400ms) */}
          <div
            className="absolute inset-0 transition-opacity duration-400 ease-out"
            style={{
              opacity: show3D ? 1 : 0,
              transitionDuration: reducedMotion ? '0ms' : '400ms',
            }}
          >
            <Agenda3DViewer
              agenda={agenda}
              activePreset={activePreset}
              autoRotate={autoRotate}
              reducedMotion={reducedMotion}
              onUserInteract={() => {
                setAutoRotate(false);
                setActivePreset(null);
              }}
              onPresetComplete={() => {}}
              onReady={() => setSceneReady(true)}
            />
          </div>

          {/* Shared Element Flat Cover (layoutId) — matches exact initial 3D camera framing and crossfades out in 400ms */}
          <div
            className="relative z-10 pointer-events-none flex items-center justify-center transition-opacity duration-400 ease-out"
            style={{
              height: stageHeightPct,
              aspectRatio,
              opacity: show3D ? 0 : 1,
              transitionDuration: reducedMotion ? '0ms' : '400ms',
            }}
          >
            <motion.div
              layoutId={reducedMotion ? undefined : `agenda-cover-${agenda.id}`}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
              className="w-full h-full relative rounded-r-xl rounded-l-xs overflow-hidden shadow-xl"
            >
              <img
                src={frontDataUrl}
                alt={`Portada de ${agenda.name}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover block"
              />
              {agenda.hasElastic && (
                <div
                  className="absolute top-0 bottom-0 w-[6%] shadow-xs"
                  style={{
                    left: '82%',
                    backgroundColor:
                      agenda.proceduralConfig?.elasticColor ??
                      agenda.proceduralConfig?.accentColor ??
                      '#1C1917',
                  }}
                />
              )}
            </motion.div>
          </div>

          {/* Bottom Unified Camera & Auto-Rotate Control Dock (solid surface, zero backdrop-blur over WebGL) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 bg-white border border-stone-200/90 rounded-2xl shadow-md max-w-[95vw]">
            <button
              type="button"
              onClick={() => handleSelectPreset('front')}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activePreset === 'front'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              Tapa
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('back')}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activePreset === 'back'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              Contratapa
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('spine')}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activePreset === 'spine'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              Lomo
            </button>

            <div className="w-px h-5 bg-stone-200 mx-0.5" aria-hidden="true" />

            <button
              type="button"
              onClick={handleToggleAutoRotate}
              aria-pressed={autoRotate}
              aria-label={
                autoRotate
                  ? 'Desactivar rotación automática'
                  : 'Activar rotación automática'
              }
              className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                autoRotate
                  ? 'bg-amber-100/90 text-amber-950 border border-amber-300/80'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <RotateCw
                className={`w-3.5 h-3.5 ${
                  autoRotate && !reducedMotion ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '8s' }}
              />
              <span>Auto-giro</span>
            </button>
          </div>
        </div>

        {/* Right / Bottom Panel: Product Details & Purchase Module */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 bg-white overflow-y-auto">
          <div className="space-y-4">
            {/* Unboxed metadata row */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500 pr-10">
              <span>{agenda.category}</span>
              <span aria-hidden="true">·</span>
              <span>{dims.label}</span>
              <span aria-hidden="true">·</span>
              <span>{agenda.hasElastic ? 'Con elástico' : 'Sin elástico'}</span>
            </div>

            <h2
              id="modal-agenda-title"
              className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-serif"
            >
              {agenda.name}
            </h2>

            <div className="text-2xl font-bold text-stone-900 font-mono tabular-nums">
              {formatPriceARS(agenda.price)}
            </div>

            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              {agenda.fullDescription || agenda.shortDescription}
            </p>

            {/* Physical Specifications Summary */}
            <div className="pt-3 border-t border-stone-100 grid grid-cols-3 gap-3 text-xs text-stone-600">
              <div className="flex flex-col gap-1">
                <span className="text-stone-400 flex items-center gap-1">
                  <Ruler className="w-3.5 h-3.5" />
                  Medidas
                </span>
                <span className="font-semibold text-stone-800 tabular-nums">
                  {dims.widthMm}×{dims.heightMm}×{dims.thicknessMm} mm
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-stone-400 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  Interior
                </span>
                <span className="font-semibold text-stone-800 tabular-nums">
                  {agenda.pagesCount} págs · {agenda.paperWeightGrams} g
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-stone-400 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  Cierre
                </span>
                <span className="font-semibold text-stone-800">
                  {agenda.hasElastic ? 'Elástico vertical' : 'Tapa libre'}
                </span>
              </div>
            </div>
          </div>

          {/* Quantity & Add to Order Action */}
          <div className="pt-6 mt-6 border-t border-stone-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-700">
                Cantidad
              </span>
              <div className="flex items-center gap-3 bg-stone-100 rounded-xl p-1 border border-stone-200/60">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Disminuir cantidad"
                  className="w-9 h-9 rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span
                  data-testid="modal-quantity-value"
                  className="w-8 text-center font-mono font-semibold text-sm text-stone-900 tabular-nums"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Aumentar cantidad"
                  className="w-9 h-9 rounded-lg bg-white text-stone-800 hover:bg-stone-50 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmAdd}
              className="w-full min-h-[48px] py-3.5 px-6 rounded-2xl bg-[#B83B24] hover:bg-[#9E311D] active:scale-[0.99] text-white font-semibold text-sm sm:text-base shadow-md flex items-center justify-between transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2 whitespace-nowrap">
                <ShoppingBag className="w-4 h-4" />
                <span>Agregar al pedido</span>
              </span>
              <span className="font-mono font-bold tabular-nums whitespace-nowrap">
                {formatPriceARS(agenda.price * quantity)}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
