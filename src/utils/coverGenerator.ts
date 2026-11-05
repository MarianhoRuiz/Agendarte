import { AgendaItem, ProceduralCoverConfig } from '../types/agenda';
import { deriveSolidHexFromRgb } from './formatters';

export interface GeneratedAgendaCanvases {
  frontCanvas: HTMLCanvasElement;
  backCanvas: HTMLCanvasElement;
  spineCanvas: HTMLCanvasElement;
  frontDataUrl: string;
}

const frontDataUrlCache = new Map<string, string>();
const canvasesCache = new Map<string, GeneratedAgendaCanvases>();

/**
 * Adds a subtle tactile linen/bookcloth grain over a 2D canvas context
 */
function drawBookclothGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opacity = 0.045
) {
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
  ctx.lineWidth = 1;
  for (let y = 0; y < height; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.85})`;
  for (let x = 0; x < width; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws the subtle bookbinding hinge groove near the left edge of the front cover
 * or right edge of the back cover.
 */
function drawBindingGroove(
  ctx: CanvasRenderingContext2D,
  x: number,
  height: number
) {
  ctx.save();
  const grad = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.09)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 6, 0, 12, height);
  ctx.restore();
}

/**
 * Draws pattern artwork onto the front cover canvas
 */
function drawPatternArtwork(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: ProceduralCoverConfig
) {
  ctx.save();
  switch (config.pattern) {
    case 'botanical': {
      // Soft radial glow + stylized botanical leaves and stems
      const grad = ctx.createRadialGradient(w * 0.55, h * 0.42, 40, w * 0.55, h * 0.42, w * 0.7);
      grad.addColorStop(0, config.secondaryColor);
      grad.addColorStop(1, config.bgColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Decorative arch frame
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(w * 0.14, h * 0.09, w * 0.74, h * 0.82, [180, 180, 24, 24]);
      ctx.stroke();

      // Botanical foliage silhouettes
      ctx.fillStyle = config.accentColor;
      const cx = w * 0.51;
      const cy = h * 0.44;
      // Central stem
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 160);
      ctx.quadraticCurveTo(cx - 12, cy, cx + 10, cy - 150);
      ctx.stroke();

      const leafOffsets = [
        { dx: -48, dy: 90, rot: -0.6, rx: 46, ry: 20 },
        { dx: 52, dy: 65, rot: 0.55, rx: 46, ry: 20 },
        { dx: -54, dy: 15, rot: -0.5, rx: 52, ry: 22 },
        { dx: 54, dy: -10, rot: 0.5, rx: 52, ry: 22 },
        { dx: -42, dy: -65, rot: -0.45, rx: 42, ry: 18 },
        { dx: 44, dy: -85, rot: 0.45, rx: 42, ry: 18 },
        { dx: 8, dy: -145, rot: 0.1, rx: 22, ry: 42 },
      ];
      for (const leaf of leafOffsets) {
        ctx.save();
        ctx.translate(cx + leaf.dx, cy + leaf.dy);
        ctx.rotate(leaf.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf.rx, leaf.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'bauhaus': {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);

      // Bold geometric composition
      ctx.fillStyle = config.secondaryColor;
      ctx.beginPath();
      ctx.arc(w * 0.52, h * 0.38, w * 0.27, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = config.accentColor;
      ctx.beginPath();
      ctx.arc(w * 0.34, h * 0.58, w * 0.2, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fill();

      ctx.fillStyle = '#E5A93C';
      ctx.fillRect(w * 0.52, h * 0.48, w * 0.3, h * 0.22);

      // Crisp architectural grid lines
      ctx.strokeStyle = config.textColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w * 0.14, h * 0.22);
      ctx.lineTo(w * 0.88, h * 0.22);
      ctx.moveTo(w * 0.52, h * 0.12);
      ctx.lineTo(w * 0.52, h * 0.78);
      ctx.stroke();
      break;
    }

    case 'waves': {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);

      const waveColors = [config.secondaryColor, '#2C5270', config.accentColor, '#172C3F'];
      waveColors.forEach((col, idx) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        const baseH = h * (0.34 + idx * 0.13);
        ctx.moveTo(0, baseH);
        for (let x = 0; x <= w; x += 40) {
          const y = baseH + Math.sin(x * 0.012 + idx * 1.3) * 32;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
      });

      // Moon / sun disc
      ctx.fillStyle = config.accentColor;
      ctx.beginPath();
      ctx.arc(w * 0.68, h * 0.23, 56, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'terracotta_sun': {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);

      // Arch desert window
      ctx.fillStyle = config.secondaryColor;
      ctx.beginPath();
      ctx.roundRect(w * 0.18, h * 0.18, w * 0.66, h * 0.56, [220, 220, 16, 16]);
      ctx.fill();

      // Sunburst rays
      const sx = w * 0.51;
      const sy = h * 0.45;
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 3;
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI * 2) / 16;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(angle) * 72, sy + Math.sin(angle) * 72);
        ctx.lineTo(sx + Math.cos(angle) * 145, sy + Math.sin(angle) * 145);
        ctx.stroke();
      }

      ctx.fillStyle = config.accentColor;
      ctx.beginPath();
      ctx.arc(sx, sy, 58, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'celestial': {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);

      // Double gold border frame
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(w * 0.12, h * 0.08, w * 0.78, h * 0.84);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w * 0.145, h * 0.1, w * 0.73, h * 0.8);

      // Constellation & crescent moon
      const cx = w * 0.51;
      const cy = h * 0.41;
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 118, 0, Math.PI * 2);
      ctx.stroke();

      // Crescent moon
      ctx.fillStyle = config.accentColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = config.bgColor;
      ctx.beginPath();
      ctx.arc(cx + 24, cy - 14, 52, 0, Math.PI * 2);
      ctx.fill();

      // Stars
      ctx.fillStyle = config.accentColor;
      const stars = [
        [w * 0.28, h * 0.22, 6],
        [w * 0.75, h * 0.24, 8],
        [w * 0.25, h * 0.58, 7],
        [w * 0.74, h * 0.56, 6],
        [w * 0.51, h * 0.21, 9],
      ];
      for (const [sx, sy, r] of stars) {
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'editorial_linen': {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);

      // Editorial frame lines
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(w * 0.13, h * 0.09, w * 0.76, h * 0.82);

      // Central typographic ornament
      ctx.fillStyle = config.accentColor;
      ctx.font = '700 130px "Fraunces", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('27', w * 0.51, h * 0.41);

      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.26, h * 0.51);
      ctx.lineTo(w * 0.76, h * 0.51);
      ctx.stroke();
      break;
    }

    case 'citrus_grid': {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);

      // Checkered/grid playful pattern in center
      const cols = 4;
      const rows = 4;
      const startX = w * 0.18;
      const startY = h * 0.2;
      const cellW = (w * 0.66) / cols;
      const cellH = (h * 0.42) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r + c) % 2 === 0) {
            ctx.fillStyle = config.secondaryColor;
            ctx.beginPath();
            ctx.roundRect(
              startX + c * cellW + 4,
              startY + r * cellH + 4,
              cellW - 8,
              cellH - 8,
              14
            );
            ctx.fill();
          } else {
            ctx.fillStyle = config.accentColor;
            ctx.beginPath();
            ctx.arc(
              startX + (c + 0.5) * cellW,
              startY + (r + 0.5) * cellH,
              Math.min(cellW, cellH) * 0.34,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }
      }
      break;
    }

    case 'lavender_pop': {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);

      // Concentric retro arches
      const archColors = [config.secondaryColor, config.accentColor, '#81B29A'];
      archColors.forEach((col, i) => {
        ctx.fillStyle = col;
        const inset = i * 44;
        ctx.beginPath();
        ctx.roundRect(
          w * 0.2 + inset,
          h * 0.2 + inset,
          w * 0.62 - inset * 2,
          h * 0.46 - inset,
          [180, 180, 12, 12]
        );
        ctx.fill();
      });
      break;
    }
  }
  ctx.restore();
}

/**
 * Generates the Front Cover canvas for a sample or custom agenda
 */
export function generateFrontCanvas(agenda: AgendaItem): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = agenda.format === 'A6' ? 630 : 740;
  const h = agenda.format === 'A6' ? 888 : 1050;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const cfg: ProceduralCoverConfig = agenda.proceduralConfig ?? {
    pattern: 'botanical',
    bgColor: '#2E4F4F',
    secondaryColor: '#4E7C7C',
    accentColor: '#E5B869',
    textColor: '#FAF6EE',
    spineColor: '#1E3535',
    backColor: '#254040',
    yearText: '2027',
    subtitle: `${agenda.category.toUpperCase()} · FORMATO ${agenda.format}`,
  };

  drawPatternArtwork(ctx, w, h, cfg);
  drawBookclothGrain(ctx, w, h, 0.04);

  // Title & typography plate (centered at 0.46*w so right-hand elastic band at 0.85*w never covers text)
  const plateX = w * 0.11;
  const plateW = w * 0.68;
  const centerX = plateX + plateW / 2;
  const plateY = h * 0.69;
  const plateH = h * 0.19;
  ctx.save();
  ctx.fillStyle =
    cfg.pattern === 'bauhaus' || cfg.pattern === 'editorial_linen'
      ? 'rgba(255, 252, 246, 0.94)'
      : 'rgba(18, 18, 22, 0.44)';
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, 14);
  ctx.fill();

  ctx.strokeStyle = cfg.accentColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Year label at top
  ctx.fillStyle = cfg.accentColor;
  ctx.font = `700 ${Math.round(w * 0.036)}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`AGENDA ${cfg.yearText}`, centerX, h * 0.145);

  // Main Agenda Name
  const titleColor =
    cfg.pattern === 'bauhaus' || cfg.pattern === 'editorial_linen'
      ? '#1C1917'
      : cfg.textColor;
  ctx.fillStyle = titleColor;
  ctx.font = `700 ${Math.round(w * 0.052)}px "Fraunces", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(agenda.name, centerX, plateY + plateH * 0.42, plateW * 0.9);

  // Subtitle
  ctx.fillStyle =
    cfg.pattern === 'bauhaus' || cfg.pattern === 'editorial_linen'
      ? '#57534E'
      : cfg.accentColor;
  ctx.font = `600 ${Math.round(w * 0.022)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(cfg.subtitle, centerX, plateY + plateH * 0.74, plateW * 0.9);
  ctx.restore();

  // Left bookbinding hinge groove
  drawBindingGroove(ctx, Math.round(w * 0.055), h);

  return canvas;
}

/**
 * Generates the Back Cover (Contratapa) canvas
 */
export function generateBackCanvas(agenda: AgendaItem): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = agenda.format === 'A6' ? 630 : 740;
  const h = agenda.format === 'A6' ? 888 : 1050;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const cfg = agenda.proceduralConfig;
  const backBg = cfg?.backColor ?? agenda.customTextures?.derivedColor ?? '#263832';
  const accent = cfg?.accentColor ?? '#E5B869';
  const textCol =
    cfg?.pattern === 'bauhaus' || cfg?.pattern === 'editorial_linen'
      ? '#26221E'
      : '#FAF6EE';

  ctx.fillStyle = backBg;
  ctx.fillRect(0, 0, w, h);
  drawBookclothGrain(ctx, w, h, 0.045);

  // Subtle geometric border
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.12, h * 0.09, w * 0.76, h * 0.82);
  ctx.globalAlpha = 1;

  // Center emblem
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(w * 0.49, h * 0.45, 44, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = `700 ${Math.round(w * 0.032)}px "Fraunces", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AD', w * 0.49, h * 0.45);

  // Colophon text at bottom
  ctx.fillStyle = textCol;
  ctx.globalAlpha = 0.8;
  ctx.font = `600 ${Math.round(w * 0.022)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(
    `AGENDAS DEMO · FORMATO ${agenda.format} · ${agenda.pagesCount} PÁGINAS`,
    w * 0.49,
    h * 0.81
  );
  ctx.font = `500 ${Math.round(w * 0.019)}px "JetBrains Mono", monospace`;
  ctx.fillText(
    `PAPEL BOOKCEL ${agenda.paperWeightGrams}G · ENCUADERNACIÓN COSIDA`,
    w * 0.49,
    h * 0.845
  );
  ctx.globalAlpha = 1;

  // Right bookbinding hinge groove (since back cover spine is on its right when viewed from the back)
  drawBindingGroove(ctx, Math.round(w * 0.945), h);

  return canvas;
}

/**
 * Generates the Spine (Lomo) canvas
 */
export function generateSpineCanvas(agenda: AgendaItem): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = 180;
  const h = agenda.format === 'A6' ? 888 : 1050;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const cfg = agenda.proceduralConfig;
  const spineBg = cfg?.spineColor ?? agenda.customTextures?.derivedColor ?? '#1C2B26';
  const accent = cfg?.accentColor ?? '#E5B869';
  const textCol =
    cfg?.pattern === 'bauhaus' ? '#FFF9F2' : cfg?.textColor ?? '#FAF6EE';

  ctx.fillStyle = spineBg;
  ctx.fillRect(0, 0, w, h);
  drawBookclothGrain(ctx, w, h, 0.05);

  // Subtle horizontal bookbinding ribs & foil bands
  ctx.fillStyle = accent;
  ctx.fillRect(24, h * 0.07, w - 48, 5);
  ctx.fillRect(24, h * 0.14, w - 48, 3);
  ctx.fillRect(24, h * 0.86, w - 48, 3);
  ctx.fillRect(24, h * 0.93, w - 48, 5);

  // Year near top of spine
  ctx.fillStyle = accent;
  ctx.font = '700 26px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('2027', w / 2, h * 0.105);

  // Format near bottom of spine
  ctx.fillText(agenda.format, w / 2, h * 0.895);

  // Vertical Rotated Title along the spine center
  ctx.save();
  ctx.translate(w / 2, h * 0.5);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = textCol;
  ctx.font = '700 32px "Fraunces", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(agenda.name.toUpperCase(), 0, 0, h * 0.64);
  ctx.restore();

  return canvas;
}

/**
 * Generates a realistic solid-color canvas when a user omits Back or Spine photo in Pantalla 3
 */
export function generateSolidDerivedCanvas(
  hexColor: string,
  width: number,
  height: number,
  label?: string
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, width, height);
  drawBookclothGrain(ctx, width, height, 0.045);

  if (label) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    if (width < height * 0.4) {
      ctx.rotate(Math.PI / 2);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.font = '700 28px "Fraunces", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.toUpperCase(), 0, 0, Math.max(width, height) * 0.65);
    ctx.restore();
  }
  return canvas;
}

/**
 * Generates the realistic paper edge texture for the page block (bloque de hojas)
 */
export function generatePaperEdgesCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base warm Bookcel ivory paper color
  ctx.fillStyle = '#F5EFE2';
  ctx.fillRect(0, 0, 512, 512);

  // Fine page striations along X (for side edge) and Y (for top/bottom edges)
  for (let i = 0; i < 512; i += 2) {
    const shade = i % 6 === 0 ? '#DFD6C3' : i % 4 === 0 ? '#EAE2D0' : '#F8F3E8';
    ctx.fillStyle = shade;
    ctx.fillRect(i, 0, 1, 512);
  }

  // Subtle horizontal fiber variation
  ctx.fillStyle = 'rgba(180, 165, 140, 0.06)';
  for (let y = 0; y < 512; y += 16) {
    ctx.fillRect(0, y, 512, 4);
  }

  return canvas;
}

/**
 * Loads an image DataURL onto a Canvas
 */
export function loadImageToCanvas(
  dataUrl: string,
  targetW: number,
  targetH: number
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;
      // Cover-fit crop
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (targetW - drawW) / 2;
      const dy = (targetH - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      resolve(canvas);
    };
    img.onerror = () => {
      resolve(generateSolidDerivedCanvas('#3B5249', targetW, targetH));
    };
    img.src = dataUrl;
  });
}

/**
 * Extracts average RGB from an image DataURL and returns a derived solid hex color
 */
export function extractDerivedColorFromDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;
      let r = 0;
      let g = 0;
      let b = 0;
      const count = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      resolve(deriveSolidHexFromRgb(r / count, g / count, b / count, 0.82));
    };
    img.onerror = () => resolve('#3D5A50');
    img.src = dataUrl;
  });
}

/**
 * Returns the cached flat cover DataURL for an agenda so catalog cards and the 3D front cover
 * share the exact same image.
 */
export function getAgendaFrontDataUrl(agenda: AgendaItem): string {
  if (agenda.customTextures?.frontDataUrl) {
    return agenda.customTextures.frontDataUrl;
  }
  const cached = frontDataUrlCache.get(agenda.id);
  if (cached) return cached;

  const frontCanvas = generateFrontCanvas(agenda);
  const url = frontCanvas.toDataURL('image/png');
  frontDataUrlCache.set(agenda.id, url);
  return url;
}

/**
 * Builds or retrieves all three texture canvases (Front, Back, Spine) for the 3D scene
 */
export async function getAgenda3DCanvases(
  agenda: AgendaItem
): Promise<GeneratedAgendaCanvases> {
  const cached = canvasesCache.get(agenda.id);
  if (cached) return cached;

  const w = agenda.format === 'A6' ? 630 : 740;
  const h = agenda.format === 'A6' ? 888 : 1050;

  if (agenda.customTextures) {
    const { frontDataUrl, backDataUrl, spineDataUrl, derivedColor } =
      agenda.customTextures;

    const frontCanvas = frontDataUrl
      ? await loadImageToCanvas(frontDataUrl, w, h)
      : generateSolidDerivedCanvas(derivedColor, w, h, agenda.name);

    const backCanvas = backDataUrl
      ? await loadImageToCanvas(backDataUrl, w, h)
      : generateSolidDerivedCanvas(derivedColor, w, h);

    const spineCanvas = spineDataUrl
      ? await loadImageToCanvas(spineDataUrl, 180, h)
      : generateSolidDerivedCanvas(derivedColor, 180, h, agenda.name);

    const result = {
      frontCanvas,
      backCanvas,
      spineCanvas,
      frontDataUrl: frontDataUrl || frontCanvas.toDataURL('image/png'),
    };
    canvasesCache.set(agenda.id, result);
    return result;
  }

  const frontCanvas = generateFrontCanvas(agenda);
  const backCanvas = generateBackCanvas(agenda);
  const spineCanvas = generateSpineCanvas(agenda);
  const frontDataUrl = getAgendaFrontDataUrl(agenda);

  const result = { frontCanvas, backCanvas, spineCanvas, frontDataUrl };
  canvasesCache.set(agenda.id, result);
  return result;
}
