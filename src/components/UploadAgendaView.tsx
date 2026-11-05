import React, { useRef, useState } from 'react';
import {
  FolderSync,
  Upload,
  Trash2,
  CheckCircle2,
  Loader2,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { AgendaCategory, AgendaItem } from '../types/agenda';
import {
  extractDerivedColorFromDataUrl,
  generateSolidDerivedCanvas,
} from '../utils/coverGenerator';
import {
  CATEGORIES_ORDER,
  getDefaultFormatForCategory,
  validateUploadForm,
} from '../utils/formatters';

interface UploadAgendaViewProps {
  onPublishAgenda: (newAgenda: AgendaItem) => void;
}

type PublishStep = 'idle' | 'step1' | 'step2' | 'step3';

const STEP_LABELS: Record<Exclude<PublishStep, 'idle'>, string> = {
  step1: 'Procesando fotos…',
  step2: 'Generando modelo 3D…',
  step3: 'Listo',
};

/**
 * Generates a custom sample photo set via canvas so users can also test the 3 dropzones with 1 click
 */
function createSampleUploadPhotos(title: string): {
  front: string;
  back: string;
  spine: string;
} {
  // Front canvas
  const fc = document.createElement('canvas');
  fc.width = 600;
  fc.height = 850;
  const fctx = fc.getContext('2d')!;
  fctx.fillStyle = '#2B4C59';
  fctx.fillRect(0, 0, 600, 850);
  fctx.fillStyle = '#E09F67';
  fctx.beginPath();
  fctx.arc(300, 340, 150, 0, Math.PI * 2);
  fctx.fill();
  fctx.fillStyle = '#F4F1EA';
  fctx.font = '700 38px "Fraunces", Georgia, serif';
  fctx.textAlign = 'center';
  fctx.fillText(title || 'Edición Estudio 2027', 300, 620, 480);
  fctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  fctx.fillStyle = '#E09F67';
  fctx.fillText('DISEÑO PERSONALIZADO · 2027', 300, 665);

  // Back canvas
  const bc = document.createElement('canvas');
  bc.width = 600;
  bc.height = 850;
  const bctx = bc.getContext('2d')!;
  bctx.fillStyle = '#203942';
  bctx.fillRect(0, 0, 600, 850);
  bctx.strokeStyle = '#E09F67';
  bctx.lineWidth = 3;
  bctx.strokeRect(60, 60, 480, 730);
  bctx.fillStyle = '#F4F1EA';
  bctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  bctx.textAlign = 'center';
  bctx.fillText('AGENDAS DEMO · CONTRATAPA PERSONALIZADA', 300, 720);

  // Spine canvas
  const sc = document.createElement('canvas');
  sc.width = 160;
  sc.height = 850;
  const sctx = sc.getContext('2d')!;
  sctx.fillStyle = '#182B33';
  sctx.fillRect(0, 0, 160, 850);
  sctx.save();
  sctx.translate(80, 425);
  sctx.rotate(Math.PI / 2);
  sctx.fillStyle = '#E09F67';
  sctx.font = '700 28px "Fraunces", Georgia, serif';
  sctx.textAlign = 'center';
  sctx.fillText((title || 'EDICIÓN ESTUDIO 2027').toUpperCase(), 0, 8, 560);
  sctx.restore();

  return {
    front: fc.toDataURL('image/png'),
    back: bc.toDataURL('image/png'),
    spine: sc.toDataURL('image/png'),
  };
}

export const UploadAgendaView: React.FC<UploadAgendaViewProps> = ({
  onPublishAgenda,
}) => {
  const [name, setName] = useState('');
  const [priceRaw, setPriceRaw] = useState('');
  const [category, setCategory] = useState<AgendaCategory>('Semanales');
  const [hasElastic, setHasElastic] = useState(true);
  const [shortDescription, setShortDescription] = useState('');

  const [frontPhoto, setFrontPhoto] = useState<string>('');
  const [backPhoto, setBackPhoto] = useState<string>('');
  const [spinePhoto, setSpinePhoto] = useState<string>('');
  const [derivedPreviewColor, setDerivedPreviewColor] =
    useState<string>('#2B4C59');

  const [dragZone, setDragZone] = useState<'front' | 'back' | 'spine' | null>(
    null
  );
  const [errors, setErrors] = useState<{
    name?: string;
    price?: string;
    shortDescription?: string;
  }>({});
  const [publishStep, setPublishStep] = useState<PublishStep>('idle');

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const spineInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = (
    file: File,
    target: 'front' | 'back' | 'spine'
  ) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = String(reader.result || '');
      if (target === 'front') {
        setFrontPhoto(result);
        const derived = await extractDerivedColorFromDataUrl(result);
        setDerivedPreviewColor(derived);
      } else if (target === 'back') {
        setBackPhoto(result);
      } else {
        setSpinePhoto(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDropZone = (
    e: React.DragEvent,
    target: 'front' | 'back' | 'spine'
  ) => {
    e.preventDefault();
    setDragZone(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readFileAsDataUrl(file, target);
    }
  };

  const handleLoadSamplePhotos = async () => {
    const sampleTitle = name.trim() || 'Patagonia Silvestre';
    if (!name.trim()) setName('Patagonia Silvestre');
    if (!priceRaw.trim()) setPriceRaw('21500');
    if (!shortDescription.trim()) {
      setShortDescription(
        'Edición especial cargada desde carpeta con tapas personalizadas y papel Bookcel de 80 g.'
      );
    }
    const sample = createSampleUploadPhotos(sampleTitle);
    setFrontPhoto(sample.front);
    setBackPhoto(sample.back);
    setSpinePhoto(sample.spine);
    const derived = await extractDerivedColorFromDataUrl(sample.front);
    setDerivedPreviewColor(derived);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (publishStep !== 'idle') return;

    const validation = validateUploadForm({
      name,
      priceRaw,
      category,
      shortDescription,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setPublishStep('step1'); // "Procesando fotos…"

    // Compute or fallback front photo and derived solid color
    let finalFrontUrl = frontPhoto;
    let derivedColor = derivedPreviewColor;

    if (!finalFrontUrl) {
      const generatedFront = generateSolidDerivedCanvas(
        '#2B4C59',
        630,
        888,
        name.trim()
      );
      finalFrontUrl = generatedFront.toDataURL('image/png');
      derivedColor = '#203942';
    } else {
      derivedColor = await extractDerivedColorFromDataUrl(finalFrontUrl);
    }

    window.setTimeout(() => {
      setPublishStep('step2'); // "Generando modelo 3D…"

      window.setTimeout(() => {
        setPublishStep('step3'); // "Listo"

        const format = getDefaultFormatForCategory(category);
        const newAgenda: AgendaItem = {
          id: `custom-${Date.now()}`,
          name: name.trim(),
          category,
          format,
          hasElastic,
          price: validation.parsedPrice,
          shortDescription: shortDescription.trim(),
          fullDescription: `${shortDescription.trim()} Modelo 3D generado dinámicamente a partir de las fotografías de frente, dorso y lomo.`,
          pagesCount: category === 'Diarias' ? 368 : 176,
          paperWeightGrams: 80,
          customTextures: {
            frontDataUrl: finalFrontUrl,
            backDataUrl: backPhoto, // Empty string triggers derivedColor solid canvas in 3D viewer
            spineDataUrl: spinePhoto, // Empty string triggers derivedColor solid canvas in 3D viewer
            derivedColor,
          },
          proceduralConfig: {
            pattern: 'botanical',
            bgColor: derivedColor,
            secondaryColor: derivedColor,
            accentColor: '#E09F67',
            textColor: '#FAF6EE',
            spineColor: derivedColor,
            backColor: derivedColor,
            elasticColor: '#1C1917',
            yearText: '2027',
            subtitle: `${category.toUpperCase()} · FORMATO ${format}`,
          },
        };

        window.setTimeout(() => {
          onPublishAgenda(newAgenda);
        }, 420);
      }, 550);
    }, 550);
  };

  const renderDropZone = (
    zone: 'front' | 'back' | 'spine',
    title: string,
    subtitle: string,
    photoUrl: string,
    onClear: () => void,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const isDragging = dragZone === zone;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-800">{title}</span>
          <span className="text-xs text-stone-500">{subtitle}</span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragZone(zone);
          }}
          onDragLeave={() => setDragZone(null)}
          onDrop={(e) => handleDropZone(e, zone)}
          className={`relative rounded-2xl border-2 border-dashed transition-colors min-h-[210px] flex flex-col items-center justify-center p-4 text-center overflow-hidden ${
            isDragging
              ? 'border-[#B83B24] bg-amber-50/50'
              : photoUrl
              ? 'border-stone-200 bg-stone-50'
              : 'border-stone-300 hover:border-stone-400 bg-stone-50/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            aria-label={`Subir foto de ${title}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFileAsDataUrl(file, zone);
            }}
            className="sr-only"
          />

          {photoUrl ? (
            <div className="w-full flex flex-col items-center gap-3">
              <img
                src={photoUrl}
                alt={`Vista previa de ${title}`}
                referrerPolicy="no-referrer"
                className={`${
                  zone === 'spine' ? 'w-14 h-36' : 'w-28 h-36'
                } object-cover rounded-lg shadow-sm border border-stone-200`}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  aria-label={`Quitar foto de ${title}`}
                  className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full h-full flex flex-col items-center justify-center gap-2.5 py-4 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 shadow-2xs flex items-center justify-center text-stone-600">
                <Upload className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-stone-800">
                  Arrastrá y soltá o tocá para elegir
                </p>
                <p className="text-[11px] text-stone-500">
                  {zone === 'front'
                    ? 'Se usa como portada plana y tapa 3D'
                    : 'Si falta, usa color derivado del frente'}
                </p>
              </div>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="max-w-3xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Simulated Google Drive Notice Banner */}
      <div className="rounded-2xl bg-amber-50/90 border border-amber-200/90 p-4 sm:p-5 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
          <FolderSync className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-mono font-semibold text-amber-900">
            SIMULADOR DE INGESTA DE CATÁLOGO
          </p>
          <p className="text-sm font-medium text-stone-800 leading-relaxed">
            En la versión real, esto se reemplaza por la lectura automática de
            una carpeta de Google Drive.
          </p>
        </div>
      </div>

      {/* Main Upload Form Card */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white rounded-3xl border border-stone-200/80 shadow-xs p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif">
              Cargar nueva agenda al catálogo
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Completá los datos y subí las vistas para armar la portada plana y
              el modelo 3D.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLoadSamplePhotos}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#B83B24]" />
            <span>Completar con datos y fotos de prueba</span>
          </button>
        </div>

        {/* Form Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Nombre */}
          <div className="space-y-1.5">
            <label
              htmlFor="agenda-name-input"
              className="block text-xs font-bold text-stone-800"
            >
              Nombre de la agenda *
            </label>
            <input
              id="agenda-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Patagonia Silvestre 2027"
              className="w-full h-11 px-3.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 focus:bg-white focus:border-[#B83B24] focus:outline-none transition-colors"
            />
            {errors.name && (
              <p className="text-xs font-medium text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Precio en ARS */}
          <div className="space-y-1.5">
            <label
              htmlFor="agenda-price-input"
              className="block text-xs font-bold text-stone-800"
            >
              Precio en pesos argentinos (ARS) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono font-semibold text-stone-500">
                $
              </span>
              <input
                id="agenda-price-input"
                type="text"
                inputMode="numeric"
                value={priceRaw}
                onChange={(e) => setPriceRaw(e.target.value)}
                placeholder="21500"
                className="w-full h-11 pl-8 pr-3.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-mono text-stone-900 focus:bg-white focus:border-[#B83B24] focus:outline-none transition-colors"
              />
            </div>
            {errors.price && (
              <p className="text-xs font-medium text-red-600">{errors.price}</p>
            )}
          </div>

          {/* Categoría */}
          <div className="space-y-1.5">
            <label
              htmlFor="agenda-category-select"
              className="block text-xs font-bold text-stone-800"
            >
              Categoría y formato
            </label>
            <select
              id="agenda-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as AgendaCategory)}
              className="w-full h-11 px-3.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 focus:bg-white focus:border-[#B83B24] focus:outline-none transition-colors cursor-pointer"
            >
              {CATEGORIES_ORDER.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} — Formato{' '}
                  {cat === 'Mini' ? 'A6 (105×148 mm)' : 'A5 (148×210 mm)'}
                </option>
              ))}
            </select>
          </div>

          {/* Elástico Toggle */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="flex items-center gap-3 h-11 px-3.5 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasElastic}
                onChange={(e) => setHasElastic(e.target.checked)}
                className="w-4 h-4 accent-[#B83B24] rounded cursor-pointer"
              />
              <span className="text-sm font-medium text-stone-800">
                Incluir elástico vertical en el modelo 3D
              </span>
            </label>
          </div>
        </div>

        {/* Descripción corta */}
        <div className="space-y-1.5">
          <label
            htmlFor="agenda-desc-input"
            className="block text-xs font-bold text-stone-800"
          >
            Descripción corta *
          </label>
          <textarea
            id="agenda-desc-input"
            rows={2}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Ej: Semana a la vista con tapas laminadas en mate, papel Bookcel 80 g y sobre interno."
            className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 focus:bg-white focus:border-[#B83B24] focus:outline-none transition-colors resize-none"
          />
          {errors.shortDescription && (
            <p className="text-xs font-medium text-red-600">
              {errors.shortDescription}
            </p>
          )}
        </div>

        {/* 3 Drag & Drop Photo Zones: Frente, Dorso, Lomo */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-[#B83B24]" />
              <span>Fotografías para las texturas 3D</span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>Color sólido derivado si falta dorso/lomo:</span>
              <span
                className="inline-block w-4 h-4 rounded-full border border-stone-300"
                style={{ backgroundColor: derivedPreviewColor }}
              />
              <span className="font-mono">{derivedPreviewColor}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {renderDropZone(
              'front',
              '1. Frente (Tapa)',
              'Portada plana + 3D',
              frontPhoto,
              () => setFrontPhoto(''),
              frontInputRef
            )}
            {renderDropZone(
              'back',
              '2. Dorso (Contratapa)',
              'Opcional',
              backPhoto,
              () => setBackPhoto(''),
              backInputRef
            )}
            {renderDropZone(
              'spine',
              '3. Lomo (25 mm)',
              'Opcional',
              spinePhoto,
              () => setSpinePhoto(''),
              spineInputRef
            )}
          </div>
        </div>

        {/* 3-Step Fake Progress Indicator during Publishing */}
        {publishStep !== 'idle' && (
          <div
            data-testid="publish-progress-banner"
            className="rounded-2xl bg-stone-900 text-white p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {publishStep === 'step3' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                )}
                <span className="text-sm font-bold">
                  {STEP_LABELS[publishStep]}
                </span>
              </div>
              <span className="text-xs font-mono text-stone-400">
                {publishStep === 'step1'
                  ? 'Paso 1 de 3'
                  : publishStep === 'step2'
                  ? 'Paso 2 de 3'
                  : 'Paso 3 de 3'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div
                className={`py-1.5 px-2.5 rounded-lg font-medium ${
                  publishStep === 'step1'
                    ? 'bg-white/15 text-white'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                1. Procesando fotos…
              </div>
              <div
                className={`py-1.5 px-2.5 rounded-lg font-medium ${
                  publishStep === 'step2'
                    ? 'bg-white/15 text-white'
                    : publishStep === 'step3'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/5 text-stone-500'
                }`}
              >
                2. Generando modelo 3D…
              </div>
              <div
                className={`py-1.5 px-2.5 rounded-lg font-medium ${
                  publishStep === 'step3'
                    ? 'bg-emerald-500/25 text-emerald-300'
                    : 'bg-white/5 text-stone-500'
                }`}
              >
                3. Listo
              </div>
            </div>
          </div>
        )}

        {/* Submit CTA */}
        <div className="pt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={publishStep !== 'idle'}
            className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-2xl bg-[#B83B24] hover:bg-[#9E311D] disabled:opacity-60 text-white font-semibold text-sm sm:text-base shadow-sm transition-all cursor-pointer"
          >
            Publicar agenda en el catálogo
          </button>
        </div>
      </form>
    </section>
  );
};
