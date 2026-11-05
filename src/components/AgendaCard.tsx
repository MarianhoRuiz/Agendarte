import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { AgendaItem } from '../types/agenda';
import { getAgendaFrontDataUrl } from '../utils/coverGenerator';
import { formatPriceARS, getDimensionsForFormat } from '../utils/formatters';

interface AgendaCardProps {
  agenda: AgendaItem;
  reducedMotion: boolean;
  isModalOpenForThis: boolean;
  onSelect: (agenda: AgendaItem) => void;
  onQuickAdd: (agenda: AgendaItem) => void;
}

export const AgendaCard: React.FC<AgendaCardProps> = ({
  agenda,
  reducedMotion,
  isModalOpenForThis,
  onSelect,
  onQuickAdd,
}) => {
  const dims = getDimensionsForFormat(agenda.format);
  const frontDataUrl = getAgendaFrontDataUrl(agenda);

  const handleCardClick = () => {
    onSelect(agenda);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(agenda);
    }
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQuickAdd(agenda);
  };

  const isMini = agenda.format === 'A6';

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Ver detalle 3D de ${agenda.name}, ${formatPriceARS(agenda.price)}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className="group relative bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-xs hover:shadow-md hover:border-stone-300/90 transition-all duration-150 flex items-stretch justify-between gap-4 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B24]"
    >
      {/* Left column: Name, short description, metadata, price */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div className="space-y-1.5">
          {/* Quiet unboxed metadata */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-stone-500">
            <span>Formato {dims.format}</span>
            <span aria-hidden="true">·</span>
            <span>
              {dims.widthMm}×{dims.heightMm} mm
            </span>
            <span aria-hidden="true">·</span>
            <span>{agenda.hasElastic ? 'Con elástico' : 'Sin elástico'}</span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-[#B83B24] transition-colors leading-snug">
            {agenda.name}
          </h3>

          <p className="text-xs sm:text-sm text-stone-600 line-clamp-2 leading-relaxed">
            {agenda.shortDescription}
          </p>
        </div>

        <div className="pt-3 flex items-baseline gap-2.5">
          <span className="text-base sm:text-lg font-bold text-stone-900 font-mono tabular-nums">
            {formatPriceARS(agenda.price)}
          </span>
          <span className="text-xs text-stone-400 group-hover:text-stone-600 transition-colors">
            Ver en 3D →
          </span>
        </div>
      </div>

      {/* Right column: Flat cover image + '+' quick-add button */}
      <div className="relative shrink-0 flex items-center justify-center w-24 sm:w-28">
        <div
          className={`relative ${
            isMini ? 'w-[74px] sm:w-[82px]' : 'w-[84px] sm:w-[94px]'
          } aspect-[148/210] flex items-center justify-center`}
        >
          {!isModalOpenForThis ? (
            <motion.div
              layoutId={reducedMotion ? undefined : `agenda-cover-${agenda.id}`}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
              className="w-full h-full relative rounded-r-lg rounded-l-2xs overflow-hidden shadow-md group-hover:shadow-lg transition-shadow"
            >
              <img
                src={frontDataUrl}
                alt={`Portada de ${agenda.name}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover block"
              />
              {agenda.hasElastic && (
                <div
                  className="absolute top-0 bottom-0 w-[6%] shadow-2xs"
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
          ) : (
            <div className="w-full h-full rounded-r-lg rounded-l-2xs bg-stone-100/60" />
          )}
        </div>

        {/* '+' Button to add to order without triggering card modal */}
        <button
          type="button"
          onClick={handleAddClick}
          aria-label={`Agregar ${agenda.name} al pedido`}
          className="absolute -bottom-1.5 -right-1.5 z-10 w-10 h-10 rounded-full bg-white hover:bg-[#B83B24] text-[#B83B24] hover:text-white border border-stone-200 hover:border-[#B83B24] shadow-md flex items-center justify-center transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </article>
  );
};
