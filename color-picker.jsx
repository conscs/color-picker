import React, { useState, useEffect, useMemo, useLayoutEffect, useRef, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

  const WHITE_RGB = [255, 255, 255];

  const parseAlphaToken = (token) => {
    if (!token) {
      return null;
    }
    const trimmed = token.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.endsWith('%')) {
      const numeric = parseFloat(trimmed.slice(0, -1));
      if (Number.isNaN(numeric)) {
        return null;
      }
      return clamp(numeric / 100, 0, 1);
    }
    const numeric = parseFloat(trimmed);
    if (Number.isNaN(numeric)) {
      return null;
    }
    if (numeric > 1) {
      return clamp(numeric / 100, 0, 1);
    }
    return clamp(numeric, 0, 1);
  };

  const parseHueToken = (token) => {
    if (!token) {
      return null;
    }
    const trimmed = token.trim().toLowerCase();
    if (!trimmed) {
      return null;
    }
    let numeric = parseFloat(trimmed);
    if (Number.isNaN(numeric)) {
      return null;
    }
    if (trimmed.endsWith('rad')) {
      numeric = numeric * (180 / Math.PI);
    } else if (trimmed.endsWith('turn')) {
      numeric = numeric * 360;
    }
    return ((numeric % 360) + 360) % 360;
  };

  const parsePercentageToken = (token) => {
    if (!token) {
      return null;
    }
    const trimmed = token.trim();
    if (!trimmed) {
      return null;
    }
    const isPercent = trimmed.endsWith('%');
    const numeric = parseFloat(isPercent ? trimmed.slice(0, -1) : trimmed);
    if (Number.isNaN(numeric)) {
      return null;
    }
    return clamp(isPercent ? numeric : numeric, 0, 100);
  };

  const parseRgbChannelToken = (token) => {
    if (!token) {
      return null;
    }
    const trimmed = token.trim();
    if (!trimmed) {
      return null;
    }
    const isPercent = trimmed.endsWith('%');
    const numeric = parseFloat(isPercent ? trimmed.slice(0, -1) : trimmed);
    if (Number.isNaN(numeric)) {
      return null;
    }
    const value = isPercent ? (numeric / 100) * 255 : numeric;
    return clamp(Math.round(value), 0, 255);
  };

  const parseRgbInput = (input) => {
    if (!input) {
      return null;
    }
    let body = input.trim();
    if (/^rgba?\(/i.test(body)) {
      const match = body.match(/^rgba?\((.*)\)$/i);
      if (!match) {
        return null;
      }
      body = match[1];
    }
    const parts = body.split('/');
    const channelsPart = parts[0];
    const alphaPart = parts[1]?.trim();

    const channelTokens = channelsPart
      .split(/[, ]+/)
      .map(part => part.trim())
      .filter(Boolean);

    if (channelTokens.length < 3) {
      return null;
    }

    const channels = channelTokens.slice(0, 3).map(parseRgbChannelToken);
    if (channels.some(channel => channel === null)) {
      return null;
    }

    let alphaProvided = false;
    let alpha = 1;
    const alphaToken = alphaPart ?? channelTokens[3];
    if (alphaToken !== undefined) {
      const parsedAlpha = parseAlphaToken(alphaToken);
      if (parsedAlpha === null) {
        return null;
      }
      alphaProvided = true;
      alpha = parsedAlpha;
    }

    return {
      rgb: channels,
      alpha,
      alphaProvided
    };
  };

  const parseHslInput = (input) => {
    if (!input) {
      return null;
    }
    let body = input.trim();
    if (/^hsla?\(/i.test(body)) {
      const match = body.match(/^hsla?\((.*)\)$/i);
      if (!match) {
        return null;
      }
      body = match[1];
    }
    const parts = body.split('/');
    const channelsPart = parts[0];
    const alphaPart = parts[1]?.trim();

    const channelTokens = channelsPart
      .split(/[, ]+/)
      .map(part => part.trim())
      .filter(Boolean);

    if (channelTokens.length < 3) {
      return null;
    }

    const hue = parseHueToken(channelTokens[0]);
    const saturation = parsePercentageToken(channelTokens[1]);
    const lightness = parsePercentageToken(channelTokens[2]);

    if ([hue, saturation, lightness].some(value => value === null)) {
      return null;
    }

    let alphaProvided = false;
    let alpha = 1;
    const alphaToken = alphaPart ?? channelTokens[3];
    if (alphaToken !== undefined) {
      const parsedAlpha = parseAlphaToken(alphaToken);
      if (parsedAlpha === null) {
        return null;
      }
      alphaProvided = true;
      alpha = parsedAlpha;
    }

    return {
      h: hue,
      s: saturation,
      l: lightness,
      alpha,
      alphaProvided
    };
  };

  const compositeColor = (foreground, foregroundAlpha, background) => {
    const alphaValue = clamp(foregroundAlpha, 0, 1);
    return foreground.map((channel, index) => (
      (alphaValue * channel) + ((1 - alphaValue) * background[index])
    ));
  };

  useLayoutEffect(() => {
    const updateMetrics = () => {
      if (!alphaSliderRef.current || !alphaHandleRef.current) {
        return;
      }
      const trackHeight = alphaSliderRef.current.getBoundingClientRect().height;
      const handleHeight = alphaHandleRef.current.getBoundingClientRect().height;
      if (trackHeight > 0 && handleHeight > 0) {
        setAlphaSliderMetrics(prev => (
          prev.track === trackHeight && prev.handle === handleHeight
            ? prev
            : { track: trackHeight, handle: handleHeight }
        ));
      }
    };

    updateMetrics();
    window.addEventListener('resize', updateMetrics);
    return () => window.removeEventListener('resize', updateMetrics);
  }, []);

  const updateAlphaFromClientY = useCallback((sliderElement, clientY) => {
    if (!sliderElement) {
      return;
    }
    const rect = sliderElement.getBoundingClientRect();
    if (rect.height === 0) {
      return;
    }
    const offset = clamp(clientY - rect.top, 0, rect.height);
    const percent = ((rect.height - offset) / rect.height) * 100;
    setAlpha(Math.round(clamp(percent, 0, 100)));
  }, []);

  // Convert HSL to RGB
  const hslToRgb = (h, s, l) => {
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = l / 100;
    
    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs((hNorm * 6) % 2 - 1));
    const m = lNorm - c / 2;
    
    let r, g, b;
    
    if (hNorm >= 0 && hNorm < 1/6) {
      r = c; g = x; b = 0;
    } else if (hNorm >= 1/6 && hNorm < 2/6) {
      r = x; g = c; b = 0;
    } else if (hNorm >= 2/6 && hNorm < 3/6) {
      r = 0; g = c; b = x;
    } else if (hNorm >= 3/6 && hNorm < 4/6) {
      r = 0; g = x; b = c;
    } else if (hNorm >= 4/6 && hNorm < 5/6) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }
    
    return [
      Math.round(255 * (r + m)),
      Math.round(255 * (g + m)),
      Math.round(255 * (b + m))
    ];
  };

  const hsvToRgb = (h, s, v) => {
    const hNorm = ((h % 360) + 360) % 360;
    const sNorm = clamp(s, 0, 100) / 100;
    const vNorm = clamp(v, 0, 100) / 100;
    const c = vNorm * sNorm;
    const hPrime = hNorm / 60;
    const x = c * (1 - Math.abs((hPrime % 2) - 1));
    let r1 = 0, g1 = 0, b1 = 0;

    if (hPrime >= 0 && hPrime < 1) {
      r1 = c; g1 = x; b1 = 0;
    } else if (hPrime >= 1 && hPrime < 2) {
      r1 = x; g1 = c; b1 = 0;
    } else if (hPrime >= 2 && hPrime < 3) {
      r1 = 0; g1 = c; b1 = x;
    } else if (hPrime >= 3 && hPrime < 4) {
      r1 = 0; g1 = x; b1 = c;
    } else if (hPrime >= 4 && hPrime < 5) {
      r1 = x; g1 = 0; b1 = c;
    } else {
      r1 = c; g1 = 0; b1 = x;
    }

    const m = vNorm - c;
    return [
      Math.round((r1 + m) * 255),
      Math.round((g1 + m) * 255),
      Math.round((b1 + m) * 255)
    ];
  };

  const rgbToHsv = (r, g, b) => {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === rNorm) {
        h = ((gNorm - bNorm) / delta) % 6;
      } else if (max === gNorm) {
        h = (bNorm - rNorm) / delta + 2;
      } else {
        h = (rNorm - gNorm) / delta + 4;
      }
      h *= 60;
      if (h < 0) h += 360;
    }

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    return {
      h,
      s: clamp(s * 100, 0, 100),
      v: clamp(v * 100, 0, 100)
    };
  };

  const rgbToHsl = (r, g, b) => {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNorm:
          h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
          break;
        case gNorm:
          h = (bNorm - rNorm) / d + 2;
          break;
        case bNorm:
          h = (rNorm - gNorm) / d + 4;
          break;
        default:
          h = 0;
      }
      h /= 6;
    }

    return {
      h: (h * 360 + 360) % 360,
      s: Math.min(Math.max(s * 100, 0), 100),
      l: Math.min(Math.max(l * 100, 0), 100)
    };
  };

  // RGB to Hex
  const rgbToHex = (r, g, b) => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  };

  // RGB to XYZ (D65)
  const rgbToXyz = (r, g, b) => {
    let [rL, gL, bL] = [r, g, b].map(v => {
      v /= 255;
      return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
    });
    
    return {
      x: rL * 0.4124564 + gL * 0.3575761 + bL * 0.1804375,
      y: rL * 0.2126729 + gL * 0.7151522 + bL * 0.0721750,
      z: rL * 0.0193339 + gL * 0.1191920 + bL * 0.9503041
    };
  };

  // XYZ to LAB
  const xyzToLab = (x, y, z) => {
    const xn = 0.95047, yn = 1.00000, zn = 1.08883;
    
    const f = t => t > 0.008856 ? Math.pow(t, 1/3) : (7.787 * t) + (16/116);
    
    const fx = f(x / xn);
    const fy = f(y / yn);
    const fz = f(z / zn);
    
    return {
      l: (116 * fy) - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  };

  // LAB to LCH
  const labToLch = (l, a, b) => {
    const c = Math.sqrt(a * a + b * b);
    let h = Math.atan2(b, a) * (180 / Math.PI);
    if (h < 0) h += 360;
    return { l, c, h };
  };

  // RGB to OKLCH (simplified conversion)
  const rgbToOklch = (r, g, b) => {
    const [rL, gL, bL] = [r, g, b].map(v => v / 255);
    
    const l = 0.4122214708 * rL + 0.5363325363 * gL + 0.0514459929 * bL;
    const m = 0.2119034982 * rL + 0.6806995451 * gL + 0.1073969566 * bL;
    const s = 0.0883024619 * rL + 0.2817188376 * gL + 0.6299787005 * bL;
    
    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);
    
    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    
    const C = Math.sqrt(a * a + b_ * b_);
    let H = Math.atan2(b_, a) * (180 / Math.PI);
    if (H < 0) H += 360;
    
    return { l: L, c: C, h: H };
  };

  // Check if color is in P3 gamut (simplified check)
  const isInP3Gamut = (r, g, b) => {
    return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255;
  };

  // Calculate relative luminance for contrast
  const getLuminance = (r, g, b) => {
    const [rL, gL, bL] = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
  };

  // Calculate contrast ratio
  const getContrastRatio = (rgb1, rgb2) => {
    const lum1 = getLuminance(...rgb1);
    const lum2 = getLuminance(...rgb2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  };

  const rgb = hsvToRgb(hue, saturation, value);
  const { h: hslHue, s: hslSaturation, l: hslLightness } = rgbToHsl(...rgb);
  const hex = rgbToHex(...rgb);
  const xyz = rgbToXyz(...rgb);
  const lab = xyzToLab(xyz.x, xyz.y, xyz.z);
  const lch = labToLch(lab.l, lab.a, lab.b);
  const oklch = rgbToOklch(...rgb);
  const rgbString = `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
  const hslString = `${hslHue.toFixed(1)}, ${hslSaturation.toFixed(1)}%, ${hslLightness.toFixed(1)}%`;

  const [formatInputs, setFormatInputs] = useState(() => ({
    hex,
    rgb: rgbString,
    hsl: hslString
  }));
  const [editingFormat, setEditingFormat] = useState(null);

  useEffect(() => {
    setFormatInputs(prev => {
      const next = { ...prev };
      let changed = false;

      if (editingFormat !== 'hex' && next.hex !== hex) {
        next.hex = hex;
        changed = true;
      }
      if (editingFormat !== 'rgb' && next.rgb !== rgbString) {
        next.rgb = rgbString;
        changed = true;
      }
      if (editingFormat !== 'hsl' && next.hsl !== hslString) {
        next.hsl = hslString;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [hex, rgbString, hslString, editingFormat]);

  const getDisplayValue = (format) => {
    switch (format) {
      case 'hex':
        return hex;
      case 'rgb':
        return rgbString;
      case 'hsl':
        return hslString;
      default:
        return '';
    }
  };

  const resetFormatInput = (format) => {
    const displayValue = getDisplayValue(format);
    setFormatInputs(prev => (prev[format] === displayValue ? prev : { ...prev, [format]: displayValue }));
  };

  const setColorFromRgb = (r, g, b, nextAlpha = null, options = {}) => {
    const { h, s, v } = rgbToHsv(r, g, b);
    setHue(prevHue => {
      if (s === 0) {
        if (typeof options.fallbackHue === 'number') {
          return options.fallbackHue;
        }
        return prevHue;
      }
      return h;
    });
    setSaturation(s);
    setValue(v);

    if (typeof nextAlpha === 'number' && !Number.isNaN(nextAlpha)) {
      setAlpha(clamp(Math.round(nextAlpha), 0, 100));
    }
  };

  const parseBgColor = (color) => {
    const defaultResult = { rgb: WHITE_RGB, alpha: 1 };
    if (!color) {
      return defaultResult;
    }

    const value = color.trim();

    const hexMatch = value.match(/^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
    if (hexMatch) {
      let hexValue = hexMatch[1];
      if (hexValue.length === 3 || hexValue.length === 4) {
        hexValue = hexValue.split('').map(char => char + char).join('');
      }
      const r = parseInt(hexValue.slice(0, 2), 16);
      const g = parseInt(hexValue.slice(2, 4), 16);
      const b = parseInt(hexValue.slice(4, 6), 16);
      let alphaComponent = 1;
      if (hexValue.length === 8) {
        const alphaByte = parseInt(hexValue.slice(6, 8), 16);
        if (!Number.isNaN(alphaByte)) {
          alphaComponent = clamp(alphaByte / 255, 0, 1);
        }
      }
      return { rgb: [r, g, b], alpha: alphaComponent };
    }

    const rgbResult = parseRgbInput(value);
    if (rgbResult) {
      return { rgb: rgbResult.rgb, alpha: rgbResult.alpha };
    }

    const hslResult = parseHslInput(value);
    if (hslResult) {
      const colorRgb = hslToRgb(hslResult.h, hslResult.s, hslResult.l);
      return { rgb: colorRgb, alpha: hslResult.alpha };
    }

    return defaultResult;
  };

  const parsedBackground = useMemo(() => {
    const parsed = parseBgColor(bgColor);
    const compositeRgb = parsed.alpha < 1
      ? compositeColor(parsed.rgb, parsed.alpha, WHITE_RGB)
      : parsed.rgb;
    return {
      ...parsed,
      compositeRgb
    };
  }, [bgColor]);

  const alphaValue = clamp(alpha, 0, 100);
  const alphaHandlePosition = useMemo(() => {
    const { track, handle } = alphaSliderMetrics;
    if (!track || !handle) {
      return Math.max(0, Math.min(100, 100 - alphaValue));
    }
    const handlePercent = (handle / track) * 100;
    const halfHandlePercent = handlePercent / 2;
    const travelPercent = Math.max(100 - handlePercent, 0);
    const travelFactor = (100 - alphaValue) / 100;
    return halfHandlePercent + (travelFactor * travelPercent);
  }, [alphaSliderMetrics, alphaValue]);
  const normalizedAlpha = alphaValue / 100;
  const textCompositeRgb = useMemo(
    () => compositeColor(rgb, normalizedAlpha, parsedBackground.compositeRgb),
    [rgb, normalizedAlpha, parsedBackground]
  );
  const contrastRatio = getContrastRatio(textCompositeRgb, parsedBackground.compositeRgb);

  const commitColorInput = (format, rawValue) => {
    const value = rawValue.trim();

    if (!value) {
      resetFormatInput(format);
      return;
    }

    try {
      if (format === 'hex') {
        let hexValue = value.startsWith('#') ? value.slice(1) : value;
        if (![3, 4, 6, 8].includes(hexValue.length) || !/^[0-9a-fA-F]+$/.test(hexValue)) {
          throw new Error('Invalid hex value');
        }
        if (hexValue.length === 3 || hexValue.length === 4) {
          hexValue = hexValue.split('').map(char => char + char).join('');
        }

        const r = parseInt(hexValue.slice(0, 2), 16);
        const g = parseInt(hexValue.slice(2, 4), 16);
        const b = parseInt(hexValue.slice(4, 6), 16);
        let nextAlpha = null;

        if (hexValue.length === 8) {
          const alphaByte = parseInt(hexValue.slice(6, 8), 16);
          nextAlpha = (alphaByte / 255) * 100;
        }

        setColorFromRgb(r, g, b, nextAlpha);
        return;
      }

      if (format === 'rgb') {
        const parsed = parseRgbInput(value);
        if (!parsed) {
          throw new Error('Invalid RGB value');
        }

        const [r, g, b] = parsed.rgb;
        const nextAlpha = parsed.alphaProvided ? parsed.alpha * 100 : null;

        setColorFromRgb(r, g, b, nextAlpha);
        return;
      }

      if (format === 'hsl') {
        const parsed = parseHslInput(value);
        if (!parsed) {
          throw new Error('Invalid HSL value');
        }

        const [r, g, b] = hslToRgb(parsed.h, parsed.s, parsed.l);
        const nextAlpha = parsed.alphaProvided ? parsed.alpha * 100 : null;
        setColorFromRgb(r, g, b, nextAlpha, { fallbackHue: parsed.h });
        return;
      }
    } catch (error) {
      // fall through to reset
    }

    resetFormatInput(format);
  };

  const copyToClipboard = (text, format) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    setAnimateFormat(format);
    setTimeout(() => setCopiedFormat(null), 2000);
    setTimeout(() => setAnimateFormat(null), 500);
  };

  const colorFormats = [
    { 
      name: 'Hex',
      key: 'hex',
      value: hex,
      copyValue: hex,
      editable: true
    },
    { 
      name: 'RGB',
      key: 'rgb',
      value: rgbString,
      copyValue: alphaValue < 100 ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(alphaValue/100).toFixed(2)})` : `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
      editable: true
    },
    { 
      name: 'HSL',
      key: 'hsl',
      value: hslString,
      copyValue: alphaValue < 100 ? `hsla(${hslHue.toFixed(1)}, ${hslSaturation.toFixed(1)}%, ${hslLightness.toFixed(1)}%, ${(alphaValue/100).toFixed(2)})` : `hsl(${hslHue.toFixed(1)}, ${hslSaturation.toFixed(1)}%, ${hslLightness.toFixed(1)}%)`,
      editable: true
    },
    { 
      name: 'Display P3',
      key: 'displayP3',
      value: `${(rgb[0]/255).toFixed(3)}, ${(rgb[1]/255).toFixed(3)}, ${(rgb[2]/255).toFixed(3)}`,
      copyValue: alphaValue < 100 ? `color(display-p3 ${(rgb[0]/255).toFixed(3)} ${(rgb[1]/255).toFixed(3)} ${(rgb[2]/255).toFixed(3)} / ${(alphaValue/100).toFixed(2)})` : `color(display-p3 ${(rgb[0]/255).toFixed(3)} ${(rgb[1]/255).toFixed(3)} ${(rgb[2]/255).toFixed(3)})`,
      editable: false
    },
    { 
      name: 'LAB',
      key: 'lab',
      value: `${lab.l.toFixed(2)}, ${lab.a.toFixed(2)}, ${lab.b.toFixed(2)}`,
      copyValue: alphaValue < 100 ? `lab(${lab.l.toFixed(2)} ${lab.a.toFixed(2)} ${lab.b.toFixed(2)} / ${(alphaValue/100).toFixed(2)})` : `lab(${lab.l.toFixed(2)} ${lab.a.toFixed(2)} ${lab.b.toFixed(2)})`,
      editable: false
    },
    { 
      name: 'LCH',
      key: 'lch',
      value: `${lch.l.toFixed(2)}, ${lch.c.toFixed(2)}, ${lch.h.toFixed(2)}`,
      copyValue: alphaValue < 100 ? `lch(${lch.l.toFixed(2)} ${lch.c.toFixed(2)} ${lch.h.toFixed(2)} / ${(alphaValue/100).toFixed(2)})` : `lch(${lch.l.toFixed(2)} ${lch.c.toFixed(2)} ${lch.h.toFixed(2)})`,
      editable: false
    },
    { 
      name: 'OKLCH',
      key: 'oklch',
      value: `${oklch.l.toFixed(3)}, ${oklch.c.toFixed(3)}, ${oklch.h.toFixed(2)}`,
      copyValue: alphaValue < 100 ? `oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(2)} / ${(alphaValue/100).toFixed(2)})` : `oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(2)})`,
      editable: false
    }
  ];

  const getWCAGLevel = (ratio) => {
    if (ratio >= 7) return { level: 'AAA', text: 'AAA (Normal & Large)', color: 'text-green-600' };
    if (ratio >= 4.5) return { level: 'AA', text: 'AA (Normal)', color: 'text-green-600' };
    if (ratio >= 3) return { level: 'AA Large', text: 'AA (Large Text Only)', color: 'text-yellow-600' };
    return { level: 'Fail', text: 'Fails WCAG', color: 'text-red-600' };
  };

  const wcagResult = getWCAGLevel(contrastRatio);

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDraggingWheel || isDraggingLightness || isDraggingAlpha) {
        e.preventDefault(); // Prevent text selection while dragging
      }
      
      if (isDraggingWheel) {
        // Find the rectangle picker element
        const rectPicker = document.querySelector('.rectangle-picker');
        if (rectPicker) {
          const rect = rectPicker.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Calculate precise color values (0-100%)
          const sat = Math.max(0, Math.min(100, (x / rect.width) * 100));
          const val = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
          
          setSaturation(sat);
          setValue(val);
        }
      } else if (isDraggingAlpha && alphaSliderRef.current) {
        updateAlphaFromClientY(alphaSliderRef.current, e.clientY);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingWheel(false);
      setIsDraggingLightness(false);
      setIsDraggingAlpha(false);
    };

    const handleGlobalSelectStart = (e) => {
      if (isDraggingWheel || isDraggingLightness || isDraggingAlpha) {
        e.preventDefault(); // Prevent text selection while dragging
      }
    };
    
    if (isDraggingWheel || isDraggingAlpha) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
    }
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('selectstart', handleGlobalSelectStart);
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('selectstart', handleGlobalSelectStart);
    };
  }, [isDraggingWheel, isDraggingLightness, isDraggingAlpha, updateAlphaFromClientY]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Color picker</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Color Picker Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            
            <div className="flex items-start gap-6">
              {/* Rectangle Color Picker */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-80 h-80 rounded-lg cursor-crosshair relative rectangle-picker select-none"
                  style={{
                    background: `
                      linear-gradient(to top, #000, transparent),
                      linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsDraggingWheel(true);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    // Calculate precise color values (0-100%)
                    const sat = Math.max(0, Math.min(100, (x / rect.width) * 100));
                    const val = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
                    
                    setSaturation(sat);
                    setValue(val);
                  }}
                >
                  {/* Current color indicator */}
                  <div
                    className="absolute w-4 h-4 rounded-full border-2 border-white pointer-events-none"
                    style={{
                      // Ensure indicator position exactly matches the calculated saturation and value
                      left: `${Math.max(0, Math.min(100, saturation))}%`,
                      top: `${Math.max(0, Math.min(100, 100 - value))}%`,
                      transform: 'translate(-50%, -50%)',
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 0 2px rgba(0,0,0,0.5)'
                    }}
                  />
                </div>
                
                {/* Hue Slider */}
                <div className="mt-4">
                  <div className="text-xs font-medium text-gray-500 mb-2">Hue</div>
                  <div
                    className="w-80 h-6 rounded cursor-pointer relative select-none"
                    style={{
                      background: `linear-gradient(to right, 
                        hsl(0, 100%, 50%), 
                        hsl(60, 100%, 50%), 
                        hsl(120, 100%, 50%), 
                        hsl(180, 100%, 50%), 
                        hsl(240, 100%, 50%), 
                        hsl(300, 100%, 50%), 
                        hsl(360, 100%, 50%))`
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsDraggingLightness(true);
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const hueVal = (x / rect.width) * 360;
                      setHue(Math.round(Math.max(0, Math.min(360, hueVal))));
                    }}
                    onMouseMove={(e) => {
                      if (isDraggingLightness) {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const hueVal = (x / rect.width) * 360;
                        setHue(Math.round(Math.max(0, Math.min(360, hueVal))));
                      }
                    }}
                    onMouseUp={() => setIsDraggingLightness(false)}
                    onMouseLeave={() => setIsDraggingLightness(false)}
                  >
                    <div
                      className="absolute w-1 h-8 bg-white rounded pointer-events-none"
                      style={{
                        left: `${(hue / 360) * 100}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 0 2px rgba(0,0,0,0.5)'
                      }}
                    />
                  </div>
                </div>
                
                <div className="text-center mt-3 text-xs text-gray-500">
                  H: {hslHue.toFixed(1)}° S: {hslSaturation.toFixed(1)}% L: {hslLightness.toFixed(1)}% · V: {value.toFixed(1)}%
                </div>
              </div>
              
              {/* Alpha Slider */}
              <div className="flex-1 flex justify-center">
                <div className="flex flex-col items-center">
                  <div className="text-sm font-medium text-gray-700 mb-2">Alpha</div>
                  <div 
                    className="w-8 h-80 rounded-full cursor-pointer relative border-2 border-gray-200 select-none"
                    style={{
                      background: `linear-gradient(to bottom, 
                        ${hex}, 
                        transparent),
                        repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 50% / 10px 10px`
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsDraggingAlpha(true);
                      updateAlphaFromClientY(e.currentTarget, e.clientY);
                    }}
                    onMouseMove={(e) => {
                      if (isDraggingAlpha) {
                        e.preventDefault();
                        updateAlphaFromClientY(e.currentTarget, e.clientY);
                      }
                    }}
                    onMouseUp={() => setIsDraggingAlpha(false)}
                    ref={alphaSliderRef}
                  >
                    <div
                      ref={alphaHandleRef}
                      className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white shadow-lg pointer-events-none"
                      style={{
                        top: `${alphaHandlePosition}%`,
                        backgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alphaValue/100})`,
                        boxShadow: '0 0 0 1px white, 0 0 0 2px rgba(0,0,0,0.3)'
                      }}
                    />
                  </div>
                  <div className="text-center mt-3 text-xs text-gray-500">
                    {alphaValue}%
                  </div>
                </div>
              </div>
            </div>
            
            {/* Color Preview */}
            <div className="mt-6">
              <div 
                className="w-full h-24 rounded-lg border-2 border-gray-200"
                style={{ 
                  backgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alphaValue/100})`,
                  backgroundImage: 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 50% / 20px 20px'
                }}
              />
            </div>
          </div>
          
          {/* Color Values Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            
            <div className="space-y-3">
              {colorFormats.map((format) => (
                <div 
                  key={format.key} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={(e) => {
                    // Only copy if clicking on the container, not on input or button
                    if (e.target === e.currentTarget || e.target.closest('.value-container')) {
                      copyToClipboard(format.copyValue, format.name);
                    }
                  }}
                >
                  <div className="flex-1 mr-3 value-container">
                    <div className="text-xs font-medium text-gray-500 mb-1">{format.name}</div>
                    {format.editable ? (
                      <input
                        type="text"
                        value={editingFormat === format.key ? formatInputs[format.key] : format.value}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setFormatInputs(prev => ({ ...prev, [format.key]: nextValue }));
                        }}
                        onFocus={() => {
                          setEditingFormat(format.key);
                          setFormatInputs(prev => ({
                            ...prev,
                            [format.key]: prev[format.key] ?? format.value
                          }));
                        }}
                        onBlur={() => {
                          commitColorInput(format.key, formatInputs[format.key] ?? '');
                          setEditingFormat(current => (current === format.key ? null : current));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            commitColorInput(format.key, formatInputs[format.key] ?? '');
                            e.currentTarget.blur();
                          }
                          if (e.key === 'Escape') {
                            resetFormatInput(format.key);
                            e.currentTarget.blur();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-mono text-gray-900 bg-transparent border-0 outline-none focus:bg-white px-2 py-1 rounded transition-all"
                        style={{ width: '220px' }}
                        placeholder={format.value}
                      />
                    ) : (
                      <div className="text-sm font-mono text-gray-900 inline-block px-2 py-1" style={{ width: '220px' }}>{format.value}</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(format.copyValue, format.name);
                    }}
                    className="ml-4 p-2 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    {copiedFormat === format.name ? (
                      <Check 
                        key={animateFormat === format.name ? Date.now() : 'check'}
                        className="w-4 h-4 text-green-600 checkmark-animation" 
                      />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Contrast Checker */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Contrast checker</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-16 h-16 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Contrast ratio</div>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-gray-900">
                  {contrastRatio.toFixed(2)}:1
                </div>
                <div>
                  <div className={`text-sm font-semibold ${wcagResult.color}`}>
                    {wcagResult.level}
                  </div>
                  <div className="text-xs text-gray-600">{wcagResult.text}</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Preview */}
          <div className="mt-6">
            <div className="text-sm font-medium text-gray-700 mb-2">Preview</div>
            <div 
              className="p-6 rounded-lg border-2 border-gray-200 relative"
              style={{ 
                backgroundColor: bgColor,
                backgroundImage: (alphaValue < 100 || parsedBackground.alpha < 1) ? 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 50% / 20px 20px' : 'none'
              }}
            >
              <p className="text-base mb-2" style={{ color: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alphaValue/100})` }}>Normal text (16px) — The quick brown fox jumps over the lazy dog</p>
              <p className="text-lg font-semibold" style={{ color: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alphaValue/100})` }}>Large text (18px bold) — The quick brown fox jumps</p>
            </div>
          </div>
        </div>
        
        {/* Color Palettes */}
        <ColorPalettes hue={hslHue} saturation={hslSaturation} lightness={hslLightness} baseColor={hex} />
      </div>
    </div>
  );
};

// Color Palettes Component
const ColorPalettes = ({ hue, saturation, lightness, baseColor }) => {
  const [copiedColor, setCopiedColor] = useState(null);
  const [animateColor, setAnimateColor] = useState(null);

  const copyColor = (color) => {
    navigator.clipboard.writeText(color);
    setCopiedColor(color);
    setAnimateColor(color);
    setTimeout(() => setCopiedColor(null), 2000);
    setTimeout(() => setAnimateColor(null), 500);
  };

  // Generate Tailwind-style shades (50-950)
  const generateTailwindShades = () => {
    const shades = [
      { name: '50', lightness: 98 },
      { name: '100', lightness: 95 },
      { name: '200', lightness: 90 },
      { name: '300', lightness: 82 },
      { name: '400', lightness: 70 },
      { name: '500', lightness: lightness }, // Base color
      { name: '600', lightness: Math.max(lightness - 15, 25) },
      { name: '700', lightness: Math.max(lightness - 25, 20) },
      { name: '800', lightness: Math.max(lightness - 35, 15) },
      { name: '900', lightness: Math.max(lightness - 45, 10) },
      { name: '950', lightness: Math.max(lightness - 50, 5) },
    ];

    return shades.map(shade => {
      const color = hslToRgb(hue, saturation, shade.lightness);
      const hex = rgbToHex(...color);
      return { ...shade, hex, rgb: color };
    });
  };

  // Generate tints (mix with white)
  const generateTints = () => {
    const tints = [];
    // Start from 90% (lightest but not white) down to 0% (base color)
    for (let i = 10; i >= 0; i--) {
      const mix = i * 9; // 90% to 0% (avoid pure white at 100%)
      const l = lightness + (100 - lightness) * (mix / 100);
      const s = saturation * (1 - mix / 100);
      const color = hslToRgb(hue, s, l);
      const hex = rgbToHex(...color);
      tints.push({ name: `${mix}%`, hex, rgb: color });
    }
    return tints;
  };

  // Generate shades (mix with black)
  const generateShades = () => {
    const shades = [];
    for (let i = 0; i <= 10; i++) {
      const mix = i * 10; // 0% to 100%
      const l = lightness * (1 - mix / 100);
      const color = hslToRgb(hue, saturation, l);
      const hex = rgbToHex(...color);
      shades.push({ name: `${mix}%`, hex, rgb: color });
    }
    return shades;
  };

  // Generate tones (mix with gray)
  const generateTones = () => {
    const tones = [];
    for (let i = 0; i <= 10; i++) {
      const mix = i * 10; // 0% to 100%
      const s = saturation * (1 - mix / 100);
      const color = hslToRgb(hue, s, lightness);
      const hex = rgbToHex(...color);
      tones.push({ name: `${mix}%`, hex, rgb: color });
    }
    return tones;
  };

  const hslToRgb = (h, s, l) => {
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = l / 100;
    
    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs((hNorm * 6) % 2 - 1));
    const m = lNorm - c / 2;
    
    let r, g, b;
    
    if (hNorm >= 0 && hNorm < 1/6) {
      r = c; g = x; b = 0;
    } else if (hNorm >= 1/6 && hNorm < 2/6) {
      r = x; g = c; b = 0;
    } else if (hNorm >= 2/6 && hNorm < 3/6) {
      r = 0; g = c; b = x;
    } else if (hNorm >= 3/6 && hNorm < 4/6) {
      r = 0; g = x; b = c;
    } else if (hNorm >= 4/6 && hNorm < 5/6) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }
    
    return [
      Math.round(255 * (r + m)),
      Math.round(255 * (g + m)),
      Math.round(255 * (b + m))
    ];
  };

  const rgbToHex = (r, g, b) => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  };

  const tailwindShades = generateTailwindShades();
  const tints = generateTints();
  const shades = generateShades();
  const tones = generateTones();

  // Calculate relative luminance to determine if color is light or dark
  const isLightColor = (hex) => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 128;
  };

  const PaletteRow = ({ colors, title, showLabels = true, showLabelsOnHover = false, showHexOnHover = false, enableHoverScale = true }) => (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="grid grid-cols-11">
        {colors.map((color, index) => {
          const isFirst = index === 0;
          const isLast = index === colors.length - 1;
          const getBorderRadius = () => {
            if (isFirst) return 'rounded-l-lg';
            if (isLast) return 'rounded-r-lg';
            return 'rounded-none';
          };
          
          const textColor = isLightColor(color.hex) ? 'text-black' : 'text-white';
          
          return (
            <div key={index} className="flex flex-col relative group">
              <button
                onClick={() => copyColor(color.hex)}
                className={`w-full aspect-square ${getBorderRadius()} transition-all ${enableHoverScale ? 'hover:scale-105' : ''} relative`}
                style={{ backgroundColor: color.hex }}
                title={`${color.hex}`}
              >
                {copiedColor === color.hex && (
                  <div key={animateColor === color.hex ? Date.now() : 'overlay'} className={`absolute inset-0 flex items-center justify-center ${getBorderRadius()} checkmark-overlay-animation`}>
                    <Check key={animateColor === color.hex ? Date.now() + 1 : 'check'} className={`w-5 h-5 ${textColor} checkmark-animation`} />
                  </div>
                )}
                {(showLabelsOnHover || showHexOnHover) && copiedColor !== color.hex && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={`text-xs font-medium font-mono ${textColor}`}>
                      {showLabelsOnHover ? color.name : color.hex}
                    </div>
                  </div>
                )}
              </button>
            {showLabels && !showLabelsOnHover && !showHexOnHover && (
              <div className="mt-1 text-center">
                <div className="text-xs font-medium text-gray-600">{color.name}</div>
                <div className="text-xs text-gray-400 font-mono">{color.hex}</div>
              </div>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-6 text-gray-900">Color palettes</h2>
      
      {/* Tailwind Shades */}
      <PaletteRow 
        colors={tailwindShades} 
        title="Tailwind scale" 
        showLabels={false}
        showLabelsOnHover={true}
        enableHoverScale={true}
      />
      
      {/* Tints */}
      <PaletteRow 
        colors={tints} 
        title="Tints" 
        showLabels={false}
        showHexOnHover={true}
      />
      
      {/* Shades */}
      <PaletteRow 
        colors={shades} 
        title="Shades" 
        showLabels={false}
        showHexOnHover={true}
      />
      
      {/* Tones */}
      <PaletteRow 
        colors={tones} 
        title="Tones" 
        showLabels={false}
        showHexOnHover={true}
      />
    </div>
  );
};

export default ColorPicker;
