export type AgendaCategory = 'Semanales' | 'Diarias' | 'Mini';

export type AgendaFormat = 'A5' | 'A6';

export interface AgendaDimensions {
  format: AgendaFormat;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  label: string;
}

export type CoverPatternType =
  | 'botanical'
  | 'bauhaus'
  | 'waves'
  | 'terracotta_sun'
  | 'celestial'
  | 'editorial_linen'
  | 'citrus_grid'
  | 'lavender_pop';

export interface ProceduralCoverConfig {
  pattern: CoverPatternType;
  bgColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  spineColor: string;
  backColor: string;
  elasticColor?: string;
  yearText: string;
  subtitle: string;
}

export interface CustomTextures {
  frontDataUrl: string;
  backDataUrl: string;
  spineDataUrl: string;
  derivedColor: string;
}

export interface AgendaItem {
  id: string;
  name: string;
  category: AgendaCategory;
  format: AgendaFormat;
  hasElastic: boolean;
  price: number;
  shortDescription: string;
  fullDescription: string;
  pagesCount: number;
  paperWeightGrams: number;
  proceduralConfig?: ProceduralCoverConfig;
  customTextures?: CustomTextures;
}

export interface CartItem {
  agenda: AgendaItem;
  quantity: number;
}

export type CameraPreset = 'front' | 'back' | 'spine';
