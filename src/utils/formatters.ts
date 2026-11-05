import { AgendaCategory, AgendaDimensions, AgendaFormat, AgendaItem, CartItem } from '../types/agenda';

/**
 * Formats a number in Argentine Pesos with es-AR thousands separator (dot)
 * Example: 18500 -> "$ 18.500"
 */
export function formatPriceARS(amount: number): string {
  const rounded = Math.round(amount);
  const absFormatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-$ ${absFormatted}` : `$ ${absFormatted}`;
}

/**
 * Returns real physical dimensions in millimeters for each agenda format.
 * A5 (148×210 mm) for Semanales and Diarias, A6 (105×148 mm) for Mini, ~25 mm thickness.
 */
export function getDimensionsForFormat(format: AgendaFormat): AgendaDimensions {
  if (format === 'A6') {
    return {
      format: 'A6',
      widthMm: 105,
      heightMm: 148,
      thicknessMm: 25,
      label: 'A6 (105×148 mm)',
    };
  }
  return {
    format: 'A5',
    widthMm: 148,
    heightMm: 210,
    thicknessMm: 25,
    label: 'A5 (148×210 mm)',
  };
}

/**
 * Determines default format from category according to spec:
 * A5 in Semanales and Diarias, A6 in Mini.
 */
export function getDefaultFormatForCategory(category: AgendaCategory): AgendaFormat {
  return category === 'Mini' ? 'A6' : 'A5';
}

/**
 * Filters agendas by search query (case and accent insensitive)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function filterAgendasByName(agendas: AgendaItem[], query: string): AgendaItem[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return agendas;
  return agendas.filter((item) => normalizeText(item.name).includes(normalizedQuery));
}

/**
 * Groups agendas by the three canonical categories in display order
 */
export const CATEGORIES_ORDER: AgendaCategory[] = ['Semanales', 'Diarias', 'Mini'];

export function groupAgendasByCategory(
  agendas: AgendaItem[]
): Record<AgendaCategory, AgendaItem[]> {
  return {
    Semanales: agendas.filter((a) => a.category === 'Semanales'),
    Diarias: agendas.filter((a) => a.category === 'Diarias'),
    Mini: agendas.filter((a) => a.category === 'Mini'),
  };
}

/**
 * Cart calculation helpers
 */
export function addOrUpdateCartItem(
  cart: CartItem[],
  agenda: AgendaItem,
  deltaQuantity: number
): CartItem[] {
  const existingIndex = cart.findIndex((item) => item.agenda.id === agenda.id);
  if (existingIndex === -1) {
    if (deltaQuantity <= 0) return cart;
    return [...cart, { agenda, quantity: deltaQuantity }];
  }

  const nextQty = cart[existingIndex].quantity + deltaQuantity;
  if (nextQty <= 0) {
    return cart.filter((_, idx) => idx !== existingIndex);
  }

  return cart.map((item, idx) =>
    idx === existingIndex ? { ...item, quantity: nextQty } : item
  );
}

export function calculateCartTotals(cart: CartItem[]): {
  totalItems: number;
  totalPrice: number;
  formattedTotal: string;
} {
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cart.reduce(
    (acc, item) => acc + item.agenda.price * item.quantity,
    0
  );
  return {
    totalItems,
    totalPrice,
    formattedTotal: formatPriceARS(totalPrice),
  };
}

/**
 * Validates the new agenda upload form
 */
export interface UploadFormInput {
  name: string;
  priceRaw: string;
  category: AgendaCategory;
  shortDescription: string;
}

export interface UploadFormValidation {
  valid: boolean;
  errors: {
    name?: string;
    price?: string;
    shortDescription?: string;
  };
  parsedPrice: number;
}

export function validateUploadForm(input: UploadFormInput): UploadFormValidation {
  const errors: UploadFormValidation['errors'] = {};
  const trimmedName = input.name.trim();
  const trimmedDesc = input.shortDescription.trim();
  const cleanPriceStr = input.priceRaw.replace(/\./g, '').replace(/,/g, '.').trim();
  const parsedPrice = Number(cleanPriceStr);

  if (!trimmedName) {
    errors.name = 'Ingresá un nombre para la agenda.';
  } else if (trimmedName.length < 3) {
    errors.name = 'El nombre debe tener al menos 3 caracteres.';
  }

  if (!cleanPriceStr || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
    errors.price = 'Ingresá un precio válido en pesos (ej: 18500).';
  }

  if (!trimmedDesc) {
    errors.shortDescription = 'Escribí una descripción corta.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    parsedPrice: Number.isNaN(parsedPrice) ? 0 : Math.round(parsedPrice),
  };
}

/**
 * Derives a warm, darker solid color hex from an average RGB triplet for missing Back/Spine textures
 */
export function deriveSolidHexFromRgb(
  r: number,
  g: number,
  b: number,
  darkenFactor = 0.82
): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const dr = clamp(r * darkenFactor);
  const dg = clamp(g * darkenFactor);
  const db = clamp(b * darkenFactor);
  return (
    '#' +
    [dr, dg, db].map((x) => x.toString(16).padStart(2, '0')).join('')
  );
}
