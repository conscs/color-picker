import React, { useState, useEffect, useMemo, useLayoutEffect, useRef, useCallback } from 'react';
import { Copy, Check, Sun, Moon, Palette, ArrowLeftRight, LayoutGrid, Wand2, FileCode } from 'lucide-react';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const oklchToRgbRaw = (L, C, H) => {
  const hRad = H * (Math.PI / 180);
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const lc = l_ ** 3, mc = m_ ** 3, sc = s_ ** 3;
  const rL =  4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const gL = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const bL = -0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc;
  const gamma = (x) => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055;
  return [gamma(rL), gamma(gL), gamma(bL)];
};

const oklchToRgb = (L, C, H) => {
  const [r, g, b] = oklchToRgbRaw(L, C, H);
  return [Math.round(clamp(r, 0, 1) * 255), Math.round(clamp(g, 0, 1) * 255), Math.round(clamp(b, 0, 1) * 255)];
};

const getGamutStatus = (rN, gN, bN) => {
  if (rN >= -0.001 && rN <= 1.001 && gN >= -0.001 && gN <= 1.001 && bN >= -0.001 && bN <= 1.001) return 'srgb';
  const lin = (v) => { const n = Math.max(v, 0); return n > 0.04045 ? Math.pow((n + 0.055) / 1.055, 2.4) : n / 12.92; };
  const X = lin(rN) * 0.4124564 + lin(gN) * 0.3575761 + lin(bN) * 0.1804375;
  const Y = lin(rN) * 0.2126729 + lin(gN) * 0.7151522 + lin(bN) * 0.0721750;
  const Z = lin(rN) * 0.0193339 + lin(gN) * 0.1191920 + lin(bN) * 0.9503041;
  const p3R = 2.4934969 * X - 0.9313836 * Y - 0.4027108 * Z;
  const p3G = -0.8294890 * X + 1.7626641 * Y + 0.0236247 * Z;
  const p3B = 0.0358458 * X - 0.0761724 * Y + 0.9568845 * Z;
  if (p3R >= -0.001 && p3R <= 1.001 && p3G >= -0.001 && p3G <= 1.001 && p3B >= -0.001 && p3B <= 1.001) return 'p3';
  return 'out';
};

const getApcaContrast = (textRgb, bgRgb) => {
  const toY = ([r, g, b]) => {
    const lin = (v) => { const n = v / 255; return n > 0.04045 ? Math.pow((n + 0.055) / 1.055, 2.4) : n / 12.92; };
    return 0.2126729 * lin(r) + 0.7151522 * lin(g) + 0.0721750 * lin(b);
  };
  const Ytext = toY(textRgb), Ybg = toY(bgRgb);
  const clip = 0.022, exp = 1.414;
  const Yts = Ytext > clip ? Ytext : Ytext + Math.pow(clip - Ytext, exp);
  const Ybs = Ybg > clip ? Ybg : Ybg + Math.pow(clip - Ybg, exp);
  const Sapc = Ybs >= Yts
    ? (Math.pow(Ybs, 0.56) - Math.pow(Yts, 0.57)) * 1.14
    : (Math.pow(Ybs, 0.65) - Math.pow(Yts, 0.62)) * 1.14;
  return Math.abs(Math.abs(Sapc) < 0.1 ? 0 : Sapc * 100);
};

// ─── Gradients Section ────────────────────────────────────────────────────────

const GradientsSection = ({ baseColor }) => {
  const [stops, setStops] = useState([
    { id: 1, color: baseColor, position: 0 },
    { id: 2, color: '#ffffff', position: 100 },
  ]);
  const [colorSpace, setColorSpace] = useState('oklch');
  const [angle, setAngle] = useState(90);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStops(prev => prev.map((s, i) => i === 0 ? { ...s, color: baseColor } : s));
  }, [baseColor]);

  const stopsCss = stops.map(s => `${s.color} ${s.position}%`).join(', ');
  const interpolation = colorSpace === 'srgb' ? '' : ` in ${colorSpace}`;
  const gradientCss = `linear-gradient(${angle}deg${interpolation}, ${stopsCss})`;

  const addStop = () => {
    const newId = Date.now();
    const midPos = stops.length >= 2 ? Math.round((stops[0].position + stops[stops.length - 1].position) / 2) : 50;
    setStops(prev => [...prev, { id: newId, color: '#888888', position: midPos }].sort((a, b) => a.position - b.position));
  };

  const removeStop = (id) => {
    if (stops.length <= 2) return;
    setStops(prev => prev.filter(s => s.id !== id));
  };

  const updateStop = (id, field, value) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s).sort((a, b) => a.position - b.position));
  };

  const copyGradient = () => {
    navigator.clipboard.writeText(`background: ${gradientCss};`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const spaces = ['srgb', 'oklab', 'oklch'];

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-lg font-semibold text-foreground mb-1">Gradients</h1>
      <p className="text-sm text-muted-foreground mb-6">Build CSS gradients with OKLCH color space interpolation.</p>

      <div className="space-y-6">
        {/* Controls */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          {/* Color space */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Color space</label>
            <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
              {spaces.map(s => (
                <button key={s} onClick={() => setColorSpace(s)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${colorSpace === s ? 'bg-white dark:bg-gray-700 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Angle */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Angle: {angle}°</label>
            <input type="range" min="0" max="360" value={angle} onChange={e => setAngle(Number(e.target.value))}
              className="w-full accent-primary" />
          </div>

          {/* Color stops */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Color stops</label>
              <button onClick={addStop}
                className="text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1 hover:bg-muted transition-colors">
                + Add stop
              </button>
            </div>
            <div className="space-y-2">
              {stops.map((stop, idx) => (
                <div key={stop.id} className="flex items-center gap-3">
                  <input type="color" value={stop.color} onChange={e => updateStop(stop.id, 'color', e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-border" />
                  <input type="text" value={stop.color} onChange={e => updateStop(stop.id, 'color', e.target.value)}
                    className="w-28 px-2 py-1.5 text-sm font-mono border border-border rounded-lg bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  <input type="number" min="0" max="100" value={stop.position} onChange={e => updateStop(stop.id, 'position', Number(e.target.value))}
                    className="w-16 px-2 py-1.5 text-sm border border-border rounded-lg bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  <span className="text-sm text-muted-foreground">%</span>
                  {stops.length > 2 && (
                    <button onClick={() => removeStop(stop.id)}
                      className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-card rounded-xl border border-border p-5">
          <label className="block text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Preview</label>
          <div className="h-20 rounded-lg" style={{ background: gradientCss }} />

          {/* Also show comparison */}
          <div className="mt-4 space-y-2">
            {['srgb', 'oklab', 'oklch'].map(space => {
              const interp = space === 'srgb' ? '' : ` in ${space}`;
              const css = `linear-gradient(${angle}deg${interp}, ${stopsCss})`;
              return (
                <div key={space} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{space.toUpperCase()}</span>
                  <div className="flex-1 h-8 rounded" style={{ background: css }} />
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Requires Chrome 111+, Firefox 113+, Safari 16.2+ for OKLAB/OKLCH interpolation.
          </p>
        </div>

        {/* CSS output */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CSS</label>
            <button onClick={copyGradient}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500 checkmark-animation" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="text-sm font-mono text-foreground bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {`background: ${gradientCss};`}
          </pre>
        </div>
      </div>
    </div>
  );
};

// ─── Bulk Convert Section ─────────────────────────────────────────────────────

const BulkConvertSection = () => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);
  const [copiedAll, setCopiedAll] = useState(false);

  const hslToRgb = (h, s, l) => {
    const hN = h / 360, sN = s / 100, lN = l / 100;
    const c = (1 - Math.abs(2 * lN - 1)) * sN;
    const x = c * (1 - Math.abs((hN * 6) % 2 - 1));
    const m = lN - c / 2;
    let r, g, b;
    if (hN < 1/6)      { r = c; g = x; b = 0; }
    else if (hN < 2/6) { r = x; g = c; b = 0; }
    else if (hN < 3/6) { r = 0; g = c; b = x; }
    else if (hN < 4/6) { r = 0; g = x; b = c; }
    else if (hN < 5/6) { r = x; g = 0; b = c; }
    else               { r = c; g = 0; b = x; }
    return [Math.round(255*(r+m)), Math.round(255*(g+m)), Math.round(255*(b+m))];
  };

  const rgbToOklchStr = (r, g, b) => {
    const [rL, gL, bL] = [r,g,b].map(v => v/255);
    const l = 0.4122214708*rL + 0.5363325363*gL + 0.0514459929*bL;
    const m = 0.2119034982*rL + 0.6806995451*gL + 0.1073969566*bL;
    const s = 0.0883024619*rL + 0.2817188376*gL + 0.6299787005*bL;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    const L = 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_;
    const a = 1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_;
    const b_ = 0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_;
    const C = Math.sqrt(a*a + b_*b_);
    let H = Math.atan2(b_, a) * (180/Math.PI);
    if (H < 0) H += 360;
    return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(2)})`;
  };

  const parseColor = (token) => {
    const t = token.trim();
    // hex
    const hexM = t.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
    if (hexM) {
      let h = hexM[1];
      if (h.length === 3) h = h.split('').map(c=>c+c).join('');
      const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      return { original: t, rgb: [r,g,b] };
    }
    // rgb
    const rgbM = t.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbM) return { original: t, rgb: [+rgbM[1], +rgbM[2], +rgbM[3]] };
    // hsl
    const hslM = t.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
    if (hslM) return { original: t, rgb: hslToRgb(+hslM[1], +hslM[2], +hslM[3]) };
    return null;
  };

  const convert = () => {
    const colorRegex = /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
    const matches = [...(input.matchAll(colorRegex) ?? [])].map(m => m[0]);
    const parsed = matches.map(parseColor).filter(Boolean);
    // deduplicate by original
    const seen = new Set();
    const unique = parsed.filter(p => { if (seen.has(p.original)) return false; seen.add(p.original); return true; });
    setResults(unique.map(p => ({ ...p, oklch: rgbToOklchStr(...p.rgb) })));
  };

  const copyAll = () => {
    const text = results.map(r => `/* ${r.original} */\n${r.oklch}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-lg font-semibold text-foreground mb-1">Bulk Convert</h1>
      <p className="text-sm text-muted-foreground mb-6">Paste CSS with HEX, RGB, or HSL values — get them all in OKLCH.</p>

      <div className="space-y-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Input</label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`:root {\n  --color-primary: #3b82f6;\n  --color-secondary: rgb(139, 92, 246);\n  --color-accent: hsl(142, 71%, 45%);\n}`}
            rows={8}
            className="w-full text-sm font-mono text-foreground bg-muted border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
          <button onClick={convert}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
            Convert
          </button>
        </div>

        {results.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{results.length} colors found</span>
              <button onClick={copyAll}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                {copiedAll ? <Check className="w-3.5 h-3.5 text-green-500 checkmark-animation" /> : <Copy className="w-3.5 h-3.5" />}
                Copy all
              </button>
            </div>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded-md shrink-0 border border-border"
                    style={{ backgroundColor: r.original.startsWith('#') ? r.original : `rgb(${r.rgb.join(',')})` }} />
                  <span className="text-sm font-mono text-muted-foreground w-40 shrink-0 truncate">{r.original}</span>
                  <span className="text-sm font-mono text-foreground flex-1">{r.oklch}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Palettes Section ─────────────────────────────────────────────────────────

const PalettesSection = ({ hue, saturation, lightness, oklch, baseHex }) => {
  const [copiedColor, setCopiedColor] = useState(null);
  const [animateColor, setAnimateColor] = useState(null);
  const [copiedCssPalette, setCopiedCssPalette] = useState(null);

  const copyColor = (color) => {
    navigator.clipboard.writeText(color);
    setCopiedColor(color);
    setAnimateColor(color);
    setTimeout(() => setCopiedColor(null), 2000);
    setTimeout(() => setAnimateColor(null), 500);
  };

  const copyAsCssVars = (colors, paletteName) => {
    const css = `:root {\n${colors.map(c => `  --color-${c.name}: ${c.hex};`).join('\n')}\n}`;
    navigator.clipboard.writeText(css);
    setCopiedCssPalette(paletteName);
    setTimeout(() => setCopiedCssPalette(null), 2000);
  };

  const hslToRgb = (h, s, l) => {
    const hN = h/360, sN = s/100, lN = l/100;
    const c = (1 - Math.abs(2*lN-1)) * sN;
    const x = c * (1 - Math.abs((hN*6)%2-1));
    const m = lN - c/2;
    let r, g, b;
    if (hN < 1/6)       { r=c; g=x; b=0; }
    else if (hN < 2/6)  { r=x; g=c; b=0; }
    else if (hN < 3/6)  { r=0; g=c; b=x; }
    else if (hN < 4/6)  { r=0; g=x; b=c; }
    else if (hN < 5/6)  { r=x; g=0; b=c; }
    else                { r=c; g=0; b=x; }
    return [Math.round(255*(r+m)), Math.round(255*(g+m)), Math.round(255*(b+m))];
  };

  const toHex = (r, g, b) => '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('').toUpperCase();

  const generateTailwind = () => [
    { name:'50', L:98 }, { name:'100', L:95 }, { name:'200', L:90 }, { name:'300', L:82 },
    { name:'400', L:70 }, { name:'500', L:lightness },
    { name:'600', L:Math.max(lightness-15,25) }, { name:'700', L:Math.max(lightness-25,20) },
    { name:'800', L:Math.max(lightness-35,15) }, { name:'900', L:Math.max(lightness-45,10) },
    { name:'950', L:Math.max(lightness-50,5) },
  ].map(s => { const c = hslToRgb(hue, saturation, s.L); return { name: s.name, hex: toHex(...c) }; });

  const generateOklchScale = () => [
    { name:'50', L:0.975 }, { name:'100', L:0.950 }, { name:'200', L:0.880 }, { name:'300', L:0.800 },
    { name:'400', L:0.700 }, { name:'500', L:0.600 }, { name:'600', L:0.500 }, { name:'700', L:0.400 },
    { name:'800', L:0.300 }, { name:'900', L:0.200 }, { name:'950', L:0.130 },
  ].map(s => { const c = oklchToRgb(s.L, oklch.c, oklch.h); return { name: s.name, hex: toHex(...c) }; });

  const generateTints = () => Array.from({ length: 11 }, (_, i) => {
    const mix = (10 - i) * 9;
    const l = lightness + (100 - lightness) * (mix / 100);
    const s = saturation * (1 - mix / 100);
    return { name: `${mix}%`, hex: toHex(...hslToRgb(hue, s, l)) };
  });

  const generateShades = () => Array.from({ length: 11 }, (_, i) => ({
    name: `${i*10}%`, hex: toHex(...hslToRgb(hue, saturation, lightness * (1 - i/10)))
  }));

  const generateTones = () => Array.from({ length: 11 }, (_, i) => ({
    name: `${i*10}%`, hex: toHex(...hslToRgb(hue, saturation * (1 - i/10), lightness))
  }));

  const isLight = (hex) => {
    const rgb = parseInt(hex.slice(1), 16);
    return 0.2126*((rgb>>16)&0xff) + 0.7152*((rgb>>8)&0xff) + 0.0722*(rgb&0xff) > 128;
  };

  const PaletteRow = ({ colors, title }) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
        <button onClick={() => copyAsCssVars(colors, title)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors">
          {copiedCssPalette === title ? <Check className="w-3 h-3 text-green-500 checkmark-animation" /> : <Copy className="w-3 h-3" />}
          CSS vars
        </button>
      </div>
      <div className="flex rounded-lg overflow-hidden">
        {colors.map((color, idx) => {
          const textColor = isLight(color.hex) ? '#000' : '#fff';
          return (
            <button key={idx} onClick={() => copyColor(color.hex)} title={`${color.name}: ${color.hex}`}
              className="flex-1 aspect-square relative group hover:scale-105 transition-transform">
              <div className="w-full h-full" style={{ backgroundColor: color.hex }} />
              {copiedColor === color.hex && (
                <div className="absolute inset-0 flex items-center justify-center checkmark-overlay-animation">
                  <Check key={animateColor === color.hex ? Date.now() : 'chk'} className="w-4 h-4 checkmark-animation" style={{ color: textColor }} />
                </div>
              )}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-xs font-mono" style={{ color: textColor }}>{color.name}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-lg font-semibold text-foreground mb-1">Color Palettes</h1>
      <p className="text-sm text-muted-foreground mb-6">Generate palettes from your current color. Click any swatch to copy its hex value.</p>

      <div className="bg-card rounded-xl border border-border p-6">
        <PaletteRow colors={generateTailwind()} title="Tailwind scale" />
        <PaletteRow colors={generateOklchScale()} title="OKLCH scale" />
        <PaletteRow colors={generateTints()} title="Tints" />
        <PaletteRow colors={generateShades()} title="Shades" />
        <PaletteRow colors={generateTones()} title="Tones" />
      </div>
    </div>
  );
};

// ─── Main ColorPicker ─────────────────────────────────────────────────────────

const ColorPicker = () => {
  const [hue, setHue] = useState(180);
  const [saturation, setSaturation] = useState(100);
  const [value, setValue] = useState(50);
  const [alpha, setAlpha] = useState(100);
  const [copiedFormat, setCopiedFormat] = useState(null);
  const [animateFormat, setAnimateFormat] = useState(null);
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [isDraggingWheel, setIsDraggingWheel] = useState(false);
  const [isDraggingLightness, setIsDraggingLightness] = useState(false);
  const [isDraggingAlpha, setIsDraggingAlpha] = useState(false);
  const alphaSliderRef = useRef(null);
  const alphaHandleRef = useRef(null);
  const [alphaSliderMetrics, setAlphaSliderMetrics] = useState({ track: 320, handle: 24 });
  const [theme, setTheme] = useState(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
    return dark ? 'dark' : 'light';
  });
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  const [contrastAlgorithm, setContrastAlgorithm] = useState('wcag2');
  const [activeSection, setActiveSection] = useState('create');

  const WHITE_RGB = [255, 255, 255];

  const parseAlphaToken = (token) => {
    if (!token) return null;
    const t = token.trim();
    if (!t) return null;
    if (t.endsWith('%')) { const n = parseFloat(t.slice(0,-1)); return Number.isNaN(n) ? null : clamp(n/100,0,1); }
    const n = parseFloat(t);
    if (Number.isNaN(n)) return null;
    return clamp(n > 1 ? n/100 : n, 0, 1);
  };

  const parseHueToken = (token) => {
    if (!token) return null;
    const t = token.trim().toLowerCase();
    let n = parseFloat(t);
    if (Number.isNaN(n)) return null;
    if (t.endsWith('rad')) n *= 180/Math.PI;
    else if (t.endsWith('turn')) n *= 360;
    return ((n % 360) + 360) % 360;
  };

  const parsePercentageToken = (token) => {
    if (!token) return null;
    const t = token.trim();
    const isP = t.endsWith('%');
    const n = parseFloat(isP ? t.slice(0,-1) : t);
    return Number.isNaN(n) ? null : clamp(n, 0, 100);
  };

  const parseRgbChannelToken = (token) => {
    if (!token) return null;
    const t = token.trim();
    const isP = t.endsWith('%');
    const n = parseFloat(isP ? t.slice(0,-1) : t);
    if (Number.isNaN(n)) return null;
    return clamp(Math.round(isP ? (n/100)*255 : n), 0, 255);
  };

  const parseRgbInput = (input) => {
    if (!input) return null;
    let body = input.trim();
    if (/^rgba?\(/i.test(body)) { const m = body.match(/^rgba?\((.*)\)$/i); if (!m) return null; body = m[1]; }
    const parts = body.split('/');
    const tokens = parts[0].split(/[, ]+/).map(p => p.trim()).filter(Boolean);
    if (tokens.length < 3) return null;
    const channels = tokens.slice(0,3).map(parseRgbChannelToken);
    if (channels.some(c => c === null)) return null;
    let alphaProvided = false, alphaVal = 1;
    const alphaToken = parts[1]?.trim() ?? tokens[3];
    if (alphaToken !== undefined) { const a = parseAlphaToken(alphaToken); if (a === null) return null; alphaProvided = true; alphaVal = a; }
    return { rgb: channels, alpha: alphaVal, alphaProvided };
  };

  const parseHslInput = (input) => {
    if (!input) return null;
    let body = input.trim();
    if (/^hsla?\(/i.test(body)) { const m = body.match(/^hsla?\((.*)\)$/i); if (!m) return null; body = m[1]; }
    const parts = body.split('/');
    const tokens = parts[0].split(/[, ]+/).map(p => p.trim()).filter(Boolean);
    if (tokens.length < 3) return null;
    const h = parseHueToken(tokens[0]), s = parsePercentageToken(tokens[1]), l = parsePercentageToken(tokens[2]);
    if ([h,s,l].some(v => v === null)) return null;
    let alphaProvided = false, alphaVal = 1;
    const alphaToken = parts[1]?.trim() ?? tokens[3];
    if (alphaToken !== undefined) { const a = parseAlphaToken(alphaToken); if (a === null) return null; alphaProvided = true; alphaVal = a; }
    return { h, s, l, alpha: alphaVal, alphaProvided };
  };

  const parseOklchInput = (input) => {
    if (!input) return null;
    let body = input.trim();
    if (/^oklch\(/i.test(body)) { const m = body.match(/^oklch\((.*)\)$/i); if (!m) return null; body = m[1]; }
    const parts = body.split('/');
    const tokens = parts[0].split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
    if (tokens.length < 3) return null;
    const L = parseFloat(tokens[0]), C = parseFloat(tokens[1]), H = parseFloat(tokens[2]);
    if ([L,C,H].some(v => Number.isNaN(v))) return null;
    let alphaProvided = false, alphaVal = 1;
    const alphaToken = parts[1]?.trim() ?? tokens[3];
    if (alphaToken !== undefined) { const a = parseAlphaToken(alphaToken); if (a === null) return null; alphaProvided = true; alphaVal = a; }
    return { l: clamp(L,0,1), c: Math.max(C,0), h: ((H%360)+360)%360, alpha: alphaVal, alphaProvided };
  };

  const compositeColor = (fg, fgAlpha, bg) => {
    const a = clamp(fgAlpha, 0, 1);
    return fg.map((c, i) => a*c + (1-a)*bg[i]);
  };

  useLayoutEffect(() => {
    const update = () => {
      if (!alphaSliderRef.current || !alphaHandleRef.current) return;
      const th = alphaSliderRef.current.getBoundingClientRect().height;
      const hh = alphaHandleRef.current.getBoundingClientRect().height;
      if (th > 0 && hh > 0) setAlphaSliderMetrics(p => p.track===th && p.handle===hh ? p : { track:th, handle:hh });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const updateAlphaFromClientY = useCallback((el, clientY) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.height) return;
    const offset = clamp(clientY - rect.top, 0, rect.height);
    setAlpha(Math.round(((rect.height - offset) / rect.height) * 100));
  }, []);

  const hslToRgb = (h, s, l) => {
    const hN=h/360, sN=s/100, lN=l/100;
    const c=(1-Math.abs(2*lN-1))*sN, x=c*(1-Math.abs((hN*6)%2-1)), m=lN-c/2;
    let r,g,b;
    if (hN<1/6){r=c;g=x;b=0;}else if(hN<2/6){r=x;g=c;b=0;}else if(hN<3/6){r=0;g=c;b=x;}
    else if(hN<4/6){r=0;g=x;b=c;}else if(hN<5/6){r=x;g=0;b=c;}else{r=c;g=0;b=x;}
    return [Math.round(255*(r+m)), Math.round(255*(g+m)), Math.round(255*(b+m))];
  };

  const hsvToRgb = (h, s, v) => {
    const hN=((h%360)+360)%360, sN=clamp(s,0,100)/100, vN=clamp(v,0,100)/100;
    const c=vN*sN, hP=hN/60, x=c*(1-Math.abs((hP%2)-1));
    let r=0,g=0,b=0;
    if(hP<1){r=c;g=x;}else if(hP<2){r=x;g=c;}else if(hP<3){g=c;b=x;}
    else if(hP<4){g=x;b=c;}else if(hP<5){r=x;b=c;}else{r=c;b=x;}
    const m=vN-c;
    return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
  };

  const rgbToHsv = (r,g,b) => {
    const rN=r/255, gN=g/255, bN=b/255;
    const max=Math.max(rN,gN,bN), min=Math.min(rN,gN,bN), d=max-min;
    let h=0;
    if (d) {
      if (max===rN) h=((gN-bN)/d)%6;
      else if (max===gN) h=(bN-rN)/d+2;
      else h=(rN-gN)/d+4;
      h*=60; if(h<0) h+=360;
    }
    return { h, s: clamp(max?d/max:0, 0,1)*100, v: clamp(max,0,1)*100 };
  };

  const rgbToHsl = (r,g,b) => {
    const rN=r/255, gN=g/255, bN=b/255;
    const max=Math.max(rN,gN,bN), min=Math.min(rN,gN,bN);
    let h=0, s=0;
    const l=(max+min)/2;
    if (max!==min) {
      const d=max-min;
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      if(max===rN) h=(gN-bN)/d+(gN<bN?6:0);
      else if(max===gN) h=(bN-rN)/d+2;
      else h=(rN-gN)/d+4;
      h/=6;
    }
    return { h:(h*360+360)%360, s:clamp(s*100,0,100), l:clamp(l*100,0,100) };
  };

  const rgbToHex = (r,g,b) => '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();

  const rgbToXyz = (r,g,b) => {
    const [rL,gL,bL]=[r,g,b].map(v=>{v/=255;return v>0.04045?Math.pow((v+0.055)/1.055,2.4):v/12.92;});
    return { x:rL*0.4124564+gL*0.3575761+bL*0.1804375, y:rL*0.2126729+gL*0.7151522+bL*0.0721750, z:rL*0.0193339+gL*0.1191920+bL*0.9503041 };
  };

  const xyzToLab = (x,y,z) => {
    const f=t=>t>0.008856?Math.pow(t,1/3):7.787*t+16/116;
    const [fx,fy,fz]=[x/0.95047,y/1,z/1.08883].map(f);
    return { l:116*fy-16, a:500*(fx-fy), b:200*(fy-fz) };
  };

  const labToLch = (l,a,b) => {
    const c=Math.sqrt(a*a+b*b); let h=Math.atan2(b,a)*180/Math.PI; if(h<0) h+=360;
    return { l, c, h };
  };

  const rgbToOklch = (r,g,b) => {
    const [rL,gL,bL]=[r,g,b].map(v=>v/255);
    const lm=0.4122214708*rL+0.5363325363*gL+0.0514459929*bL;
    const mm=0.2119034982*rL+0.6806995451*gL+0.1073969566*bL;
    const sm=0.0883024619*rL+0.2817188376*gL+0.6299787005*bL;
    const l_=Math.cbrt(lm), m_=Math.cbrt(mm), s_=Math.cbrt(sm);
    const L=0.2104542553*l_+0.7936177850*m_-0.0040720468*s_;
    const a=1.9779984951*l_-2.4285922050*m_+0.4505937099*s_;
    const b_=0.0259040371*l_+0.7827717662*m_-0.8086757660*s_;
    const C=Math.sqrt(a*a+b_*b_); let H=Math.atan2(b_,a)*180/Math.PI; if(H<0) H+=360;
    return { l:L, c:C, h:H };
  };

  const getLuminance = (r,g,b) => {
    const [rL,gL,bL]=[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
    return 0.2126*rL+0.7152*gL+0.0722*bL;
  };
  const getContrastRatio = (a,b) => { const [l1,l2]=[getLuminance(...a),getLuminance(...b)]; return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };

  const rgb = hsvToRgb(hue, saturation, value);
  const { h: hslHue, s: hslSat, l: hslL } = rgbToHsl(...rgb);
  const hex = rgbToHex(...rgb);
  const xyz = rgbToXyz(...rgb);
  const lab = xyzToLab(xyz.x, xyz.y, xyz.z);
  const lch = labToLch(lab.l, lab.a, lab.b);
  const oklch = rgbToOklch(...rgb);
  const rgbString = `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
  const hslString = `${hslHue.toFixed(1)}, ${hslSat.toFixed(1)}%, ${hslL.toFixed(1)}%`;
  const oklchString = `${oklch.l.toFixed(3)}, ${oklch.c.toFixed(3)}, ${oklch.h.toFixed(2)}`;

  const gamutStatus = useMemo(() => {
    const [rR,gR,bR] = oklchToRgbRaw(oklch.l, oklch.c, oklch.h);
    return getGamutStatus(rR, gR, bR);
  }, [oklch.l, oklch.c, oklch.h]);

  const [formatInputs, setFormatInputs] = useState(() => ({ hex, rgb: rgbString, hsl: hslString, oklch: oklchString }));
  const [editingFormat, setEditingFormat] = useState(null);

  useEffect(() => {
    setFormatInputs(prev => {
      const next = { ...prev };
      let changed = false;
      if (editingFormat !== 'hex'   && next.hex   !== hex)         { next.hex   = hex;         changed = true; }
      if (editingFormat !== 'rgb'   && next.rgb   !== rgbString)   { next.rgb   = rgbString;   changed = true; }
      if (editingFormat !== 'hsl'   && next.hsl   !== hslString)   { next.hsl   = hslString;   changed = true; }
      if (editingFormat !== 'oklch' && next.oklch !== oklchString) { next.oklch = oklchString; changed = true; }
      return changed ? next : prev;
    });
  }, [hex, rgbString, hslString, oklchString, editingFormat]);

  const getDisplayValue = (fmt) => ({ hex, rgb: rgbString, hsl: hslString, oklch: oklchString })[fmt] ?? '';

  const resetFormatInput = (fmt) => {
    const d = getDisplayValue(fmt);
    setFormatInputs(p => p[fmt] === d ? p : { ...p, [fmt]: d });
  };

  const setColorFromRgb = (r, g, b, nextAlpha = null, opts = {}) => {
    const { h, s, v } = rgbToHsv(r, g, b);
    setHue(prev => s === 0 ? (typeof opts.fallbackHue === 'number' ? opts.fallbackHue : prev) : h);
    setSaturation(s);
    setValue(v);
    if (typeof nextAlpha === 'number' && !Number.isNaN(nextAlpha)) setAlpha(clamp(Math.round(nextAlpha), 0, 100));
  };

  const parseBgColor = (color) => {
    if (!color) return { rgb: WHITE_RGB, alpha: 1 };
    const v = color.trim();
    const hm = v.match(/^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
    if (hm) {
      let hv = hm[1];
      if (hv.length===3||hv.length===4) hv=hv.split('').map(c=>c+c).join('');
      const r=parseInt(hv.slice(0,2),16), g=parseInt(hv.slice(2,4),16), b=parseInt(hv.slice(4,6),16);
      let a=1; if(hv.length===8){const ab=parseInt(hv.slice(6,8),16);if(!isNaN(ab))a=clamp(ab/255,0,1);}
      return { rgb:[r,g,b], alpha:a };
    }
    const rr = parseRgbInput(v); if(rr) return { rgb:rr.rgb, alpha:rr.alpha };
    const hr = parseHslInput(v); if(hr) return { rgb:hslToRgb(hr.h,hr.s,hr.l), alpha:hr.alpha };
    return { rgb: WHITE_RGB, alpha: 1 };
  };

  const parsedBg = useMemo(() => {
    const p = parseBgColor(bgColor);
    return { ...p, compositeRgb: p.alpha<1 ? compositeColor(p.rgb,p.alpha,WHITE_RGB) : p.rgb };
  }, [bgColor]);

  const alphaValue = clamp(alpha, 0, 100);
  const alphaHandlePos = useMemo(() => {
    const { track, handle } = alphaSliderMetrics;
    if (!track||!handle) return 100-alphaValue;
    const hp=(handle/track)*100, tp=Math.max(100-hp,0);
    return hp/2 + ((100-alphaValue)/100)*tp;
  }, [alphaSliderMetrics, alphaValue]);

  const normalizedAlpha = alphaValue / 100;
  const textCompositeRgb = useMemo(() => compositeColor(rgb, normalizedAlpha, parsedBg.compositeRgb), [rgb, normalizedAlpha, parsedBg]);
  const contrastRatio = getContrastRatio(textCompositeRgb, parsedBg.compositeRgb);
  const apcaValue = getApcaContrast(textCompositeRgb, parsedBg.compositeRgb);

  const commitColorInput = (format, rawValue) => {
    const v = rawValue.trim();
    if (!v) { resetFormatInput(format); return; }
    try {
      if (format === 'hex') {
        let hv = v.startsWith('#') ? v.slice(1) : v;
        if (![3,4,6,8].includes(hv.length)||!/^[0-9a-fA-F]+$/.test(hv)) throw 0;
        if (hv.length===3||hv.length===4) hv=hv.split('').map(c=>c+c).join('');
        const r=parseInt(hv.slice(0,2),16), g=parseInt(hv.slice(2,4),16), b=parseInt(hv.slice(4,6),16);
        setColorFromRgb(r,g,b, hv.length===8 ? (parseInt(hv.slice(6,8),16)/255)*100 : null);
        return;
      }
      if (format === 'rgb') { const p=parseRgbInput(v); if(!p) throw 0; setColorFromRgb(...p.rgb, p.alphaProvided?p.alpha*100:null); return; }
      if (format === 'hsl') { const p=parseHslInput(v); if(!p) throw 0; setColorFromRgb(...hslToRgb(p.h,p.s,p.l), p.alphaProvided?p.alpha*100:null, {fallbackHue:p.h}); return; }
      if (format === 'oklch') { const p=parseOklchInput(v); if(!p) throw 0; setColorFromRgb(...oklchToRgb(p.l,p.c,p.h), p.alphaProvided?p.alpha*100:null, {fallbackHue:p.h}); return; }
    } catch (_) {}
    resetFormatInput(format);
  };

  const copyToClipboard = (text, fmt) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(fmt); setAnimateFormat(fmt);
    setTimeout(()=>setCopiedFormat(null),2000);
    setTimeout(()=>setAnimateFormat(null),500);
  };

  const gamutBadgeStyles = { srgb:'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', p3:'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', out:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' };
  const gamutLabels = { srgb:'sRGB', p3:'P3', out:'Out of P3' };

  const colorFormats = [
    { name:'Hex',        key:'hex',       value:hex,        copyValue:hex,        editable:true  },
    { name:'RGB',        key:'rgb',       value:rgbString,  copyValue:alphaValue<100?`rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(alphaValue/100).toFixed(2)})`:`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`, editable:true  },
    { name:'HSL',        key:'hsl',       value:hslString,  copyValue:alphaValue<100?`hsla(${hslHue.toFixed(1)}, ${hslSat.toFixed(1)}%, ${hslL.toFixed(1)}%, ${(alphaValue/100).toFixed(2)})`:`hsl(${hslHue.toFixed(1)}, ${hslSat.toFixed(1)}%, ${hslL.toFixed(1)}%)`, editable:true  },
    { name:'Display P3', key:'displayP3', value:`${(rgb[0]/255).toFixed(3)}, ${(rgb[1]/255).toFixed(3)}, ${(rgb[2]/255).toFixed(3)}`, copyValue:alphaValue<100?`color(display-p3 ${(rgb[0]/255).toFixed(3)} ${(rgb[1]/255).toFixed(3)} ${(rgb[2]/255).toFixed(3)} / ${(alphaValue/100).toFixed(2)})`:`color(display-p3 ${(rgb[0]/255).toFixed(3)} ${(rgb[1]/255).toFixed(3)} ${(rgb[2]/255).toFixed(3)})`, editable:false, showGamut:true },
    { name:'LAB',        key:'lab',       value:`${lab.l.toFixed(2)}, ${lab.a.toFixed(2)}, ${lab.b.toFixed(2)}`, copyValue:alphaValue<100?`lab(${lab.l.toFixed(2)} ${lab.a.toFixed(2)} ${lab.b.toFixed(2)} / ${(alphaValue/100).toFixed(2)})`:`lab(${lab.l.toFixed(2)} ${lab.a.toFixed(2)} ${lab.b.toFixed(2)})`, editable:false },
    { name:'LCH',        key:'lch',       value:`${lch.l.toFixed(2)}, ${lch.c.toFixed(2)}, ${lch.h.toFixed(2)}`, copyValue:alphaValue<100?`lch(${lch.l.toFixed(2)} ${lch.c.toFixed(2)} ${lch.h.toFixed(2)} / ${(alphaValue/100).toFixed(2)})`:`lch(${lch.l.toFixed(2)} ${lch.c.toFixed(2)} ${lch.h.toFixed(2)})`, editable:false },
    { name:'OKLCH',      key:'oklch',     value:oklchString, copyValue:alphaValue<100?`oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(2)} / ${(alphaValue/100).toFixed(2)})`:`oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(2)})`, editable:true, showGamut:true },
  ];

  const getWCAGLevel = (r) => {
    if (r>=7)   return { level:'AAA', text:'AAA — Normal & Large', color:'text-green-600 dark:text-green-400' };
    if (r>=4.5) return { level:'AA',  text:'AA — Normal text',     color:'text-green-600 dark:text-green-400' };
    if (r>=3)   return { level:'AA Large', text:'AA — Large text only', color:'text-yellow-600 dark:text-yellow-400' };
    return { level:'Fail', text:'Fails WCAG 2', color:'text-red-500' };
  };
  const getApcaRating = (lc) => {
    if (lc>=75) return { level:`Lc ${lc.toFixed(1)}`, text:'Body text',     color:'text-green-600 dark:text-green-400' };
    if (lc>=60) return { level:`Lc ${lc.toFixed(1)}`, text:'Large text',    color:'text-green-600 dark:text-green-400' };
    if (lc>=45) return { level:`Lc ${lc.toFixed(1)}`, text:'UI components', color:'text-yellow-600 dark:text-yellow-400' };
    return { level:`Lc ${lc.toFixed(1)}`, text:'Fails APCA', color:'text-red-500' };
  };
  const wcagResult = getWCAGLevel(contrastRatio);
  const apcaResult = getApcaRating(apcaValue);
  const contrastResult = contrastAlgorithm === 'wcag2' ? wcagResult : apcaResult;

  useEffect(() => {
    const onMove = (e) => {
      if (isDraggingWheel||isDraggingLightness||isDraggingAlpha) e.preventDefault();
      if (isDraggingWheel) {
        const el = document.querySelector('.rectangle-picker');
        if (el) {
          const rect = el.getBoundingClientRect();
          setSaturation(clamp(((e.clientX-rect.left)/rect.width)*100,0,100));
          setValue(clamp((1-(e.clientY-rect.top)/rect.height)*100,0,100));
        }
      } else if (isDraggingAlpha && alphaSliderRef.current) {
        updateAlphaFromClientY(alphaSliderRef.current, e.clientY);
      }
    };
    const onUp = () => { setIsDraggingWheel(false); setIsDraggingLightness(false); setIsDraggingAlpha(false); };
    const onSel = (e) => { if (isDraggingWheel||isDraggingLightness||isDraggingAlpha) e.preventDefault(); };
    if (isDraggingWheel||isDraggingAlpha) window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('selectstart', onSel);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('selectstart', onSel); };
  }, [isDraggingWheel, isDraggingLightness, isDraggingAlpha, updateAlphaFromClientY]);

  const navItems = [
    { id: 'create',   label: 'Create',        icon: Palette },
    { id: 'convert',  label: 'Convert',        icon: ArrowLeftRight },
    { id: 'palettes', label: 'Color Palettes', icon: LayoutGrid },
    { id: 'gradients',label: 'Gradients',      icon: Wand2 },
    { id: 'bulk',     label: 'Bulk Convert',   icon: FileCode },
  ];

  // ── Format input row shared component (inline render)
  const FormatRow = ({ format }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-muted-foreground">{format.name}</span>
          {format.showGamut && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${gamutBadgeStyles[gamutStatus]}`}>
              {gamutLabels[gamutStatus]}
            </span>
          )}
        </div>
        {format.editable ? (
          <input
            type="text"
            value={editingFormat === format.key ? formatInputs[format.key] : format.value}
            onChange={e => setFormatInputs(p => ({ ...p, [format.key]: e.target.value }))}
            onFocus={() => { setEditingFormat(format.key); setFormatInputs(p => ({ ...p, [format.key]: p[format.key] ?? format.value })); }}
            onBlur={() => { commitColorInput(format.key, formatInputs[format.key] ?? ''); setEditingFormat(c => c===format.key ? null : c); }}
            onKeyDown={e => { if(e.key==='Enter'){commitColorInput(format.key,formatInputs[format.key]??'');e.currentTarget.blur();} if(e.key==='Escape'){resetFormatInput(format.key);e.currentTarget.blur();} }}
            onClick={e => e.stopPropagation()}
            className="text-sm font-mono text-foreground bg-transparent border-0 outline-none focus:bg-muted px-1.5 py-0.5 rounded w-full transition-colors"
            placeholder={format.value}
          />
        ) : (
          <div className="text-sm font-mono text-foreground px-1.5 py-0.5">{format.value}</div>
        )}
      </div>
      <button onClick={() => copyToClipboard(format.copyValue, format.name)}
        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0">
        {copiedFormat === format.name
          ? <Check key={animateFormat===format.name ? Date.now():'c'} className="w-4 h-4 text-green-500 checkmark-animation" />
          : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background transition-colors">

        {/* ── Sidebar ── */}
        <aside className="w-56 shrink-0 h-full flex flex-col bg-sidebar border-r border-sidebar-border overflow-y-auto">
          {/* Logo + color swatch */}
          <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
            <span className="text-sm font-semibold text-foreground tracking-tight">Picker</span>
            <div className="size-7 rounded-md border border-border shrink-0"
              style={{ backgroundColor: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alphaValue/100})` }} />
          </div>

          {/* Nav */}
          <nav className="flex flex-1 flex-col gap-0.5 p-3">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={`flex select-none items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors
                  ${activeSection === item.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="mt-auto border-t border-sidebar-border flex flex-col gap-0.5 p-3">
            <button onClick={() => setTheme(t => t==='light'?'dark':'light')}
              className="flex select-none items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
              {theme === 'dark' ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 h-full overflow-y-auto">

          {/* ── Create ── */}
          {activeSection === 'create' && (
            <div className="p-8">
              <h1 className="text-lg font-semibold text-foreground mb-1">Create</h1>
              <p className="text-sm text-muted-foreground mb-6">Pick a color using the visual selector or by editing any value directly.</p>

              <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-6">
                {/* Picker */}
                <div className="space-y-4">
                  {/* Rectangle */}
                  <div className="w-72 h-72 rounded-xl cursor-crosshair relative rectangle-picker select-none"
                    style={{ background:`linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hue},100%,50%))` }}
                    onMouseDown={e => {
                      e.preventDefault(); setIsDraggingWheel(true);
                      const r=e.currentTarget.getBoundingClientRect();
                      setSaturation(clamp(((e.clientX-r.left)/r.width)*100,0,100));
                      setValue(clamp((1-(e.clientY-r.top)/r.height)*100,0,100));
                    }}>
                    <div className="absolute w-4 h-4 rounded-full border-2 border-white pointer-events-none"
                      style={{ left:`${saturation}%`, top:`${100-value}%`, transform:'translate(-50%,-50%)', boxShadow:'0 0 0 1px rgba(0,0,0,0.3)' }} />
                  </div>

                  {/* Hue */}
                  <div className="w-72 h-5 rounded-full cursor-pointer relative select-none"
                    style={{ background:`linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))` }}
                    onMouseDown={e => { e.preventDefault(); setIsDraggingLightness(true); const r=e.currentTarget.getBoundingClientRect(); setHue(Math.round(clamp(((e.clientX-r.left)/r.width)*360,0,360))); }}
                    onMouseMove={e => { if(!isDraggingLightness)return; const r=e.currentTarget.getBoundingClientRect(); setHue(Math.round(clamp(((e.clientX-r.left)/r.width)*360,0,360))); }}
                    onMouseUp={()=>setIsDraggingLightness(false)} onMouseLeave={()=>setIsDraggingLightness(false)}>
                    <div className="absolute w-1 h-7 bg-white rounded pointer-events-none"
                      style={{ left:`${(hue/360)*100}%`, top:'50%', transform:'translate(-50%,-50%)', boxShadow:'0 0 0 1px rgba(0,0,0,0.3)' }} />
                  </div>

                  {/* Alpha */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-5 rounded-full cursor-pointer relative select-none border border-border"
                      style={{ background:`linear-gradient(to right,transparent,${hex}),repeating-conic-gradient(#ccc 0% 25%,white 0% 50%) 50%/10px 10px` }}
                      onMouseDown={e => { e.preventDefault(); const r=e.currentTarget.getBoundingClientRect(); setAlpha(Math.round(clamp(((e.clientX-r.left)/r.width)*100,0,100))); }}
                      onMouseMove={e => { if(!e.buttons)return; const r=e.currentTarget.getBoundingClientRect(); setAlpha(Math.round(clamp(((e.clientX-r.left)/r.width)*100,0,100))); }}>
                      <div className="absolute w-4 h-4 rounded-full border-2 border-white pointer-events-none"
                        style={{ left:`${alphaValue}%`, top:'50%', transform:'translate(-50%,-50%)', backgroundColor:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alphaValue/100})`, boxShadow:'0 0 0 1px rgba(0,0,0,0.2)' }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">{alphaValue}%</span>
                  </div>

                  {/* Color preview */}
                  <div className="w-72 h-16 rounded-xl border border-border"
                    style={{ backgroundColor:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alphaValue/100})`, backgroundImage:'repeating-conic-gradient(#e5e7eb 0% 25%,white 0% 50%) 50%/16px 16px' }} />

                  <div className="text-xs text-muted-foreground font-mono">
                    H:{hslHue.toFixed(0)}° S:{hslSat.toFixed(0)}% L:{hslL.toFixed(0)}%
                  </div>
                </div>

                {/* Format inputs */}
                <div className="bg-card rounded-xl border border-border p-5 h-fit">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Color values</h2>
                  {colorFormats.map(f => <FormatRow key={f.key} format={f} />)}
                </div>
              </div>
            </div>
          )}

          {/* ── Convert ── */}
          {activeSection === 'convert' && (
            <div className="p-8 max-w-2xl">
              <h1 className="text-lg font-semibold text-foreground mb-1">Convert</h1>
              <p className="text-sm text-muted-foreground mb-6">Edit any color value to update the current color across all formats.</p>

              {/* Color preview */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-xl border border-border shrink-0"
                  style={{ backgroundColor:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alphaValue/100})`, backgroundImage:'repeating-conic-gradient(#e5e7eb 0% 25%,white 0% 50%) 50%/12px 12px' }} />
                <div>
                  <div className="text-2xl font-mono font-semibold text-foreground">{hex}</div>
                  <div className="text-sm text-muted-foreground font-mono">oklch({oklch.l.toFixed(3)} {oklch.c.toFixed(3)} {oklch.h.toFixed(2)})</div>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-5 mb-6">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">All formats</h2>
                {colorFormats.map(f => <FormatRow key={f.key} format={f} />)}
              </div>

              {/* Contrast checker */}
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contrast checker</h2>
                  <div className="flex bg-muted rounded-lg p-0.5">
                    {['wcag2','apca'].map(algo => (
                      <button key={algo} onClick={() => setContrastAlgorithm(algo)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${contrastAlgorithm===algo?'bg-white dark:bg-gray-700 text-foreground shadow-sm':'text-muted-foreground hover:text-foreground'}`}>
                        {algo.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-border" />
                  <input type="text" value={bgColor} onChange={e=>setBgColor(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-border bg-card text-foreground rounded-lg focus:outline-none focus:ring-1 focus:ring-ring" />
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-foreground">
                      {contrastAlgorithm==='wcag2' ? `${contrastRatio.toFixed(2)}:1` : `${apcaValue.toFixed(1)}`}
                    </div>
                    <div className={`text-xs font-semibold ${contrastResult.color}`}>{contrastResult.text}</div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-border"
                  style={{ backgroundColor:bgColor, backgroundImage:(alphaValue<100||parsedBg.alpha<1)?'repeating-conic-gradient(#e5e7eb 0% 25%,white 0% 50%) 50%/16px 16px':'none' }}>
                  <p className="text-sm mb-1.5" style={{ color:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alphaValue/100})` }}>Normal text (16px) — The quick brown fox jumps over the lazy dog</p>
                  <p className="text-lg font-semibold" style={{ color:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alphaValue/100})` }}>Large text (18px bold) — The quick brown fox</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Palettes ── */}
          {activeSection === 'palettes' && (
            <PalettesSection hue={hslHue} saturation={hslSat} lightness={hslL} oklch={oklch} baseHex={hex} />
          )}

          {/* ── Gradients ── */}
          {activeSection === 'gradients' && <GradientsSection baseColor={hex} />}

          {/* ── Bulk Convert ── */}
          {activeSection === 'bulk' && <BulkConvertSection />}

        </main>
      </div>
  );
};

export default ColorPicker;
