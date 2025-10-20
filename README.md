# Color picker

### Color selection
**Interactive rectangle color picker**
**Hue slider**
**Alpha/opacity control**
**Real-time preview**

### Color spaces
**Hex** 
**RGB/RGBA** 
**HSL/HSLA** 
**Display P3** 
**LAB** 
**LCH** 
**OKLCH**

### Features
**Editable color values**
**Copy to clipboard**
**Contrast checker**
**Live preview**


## Installation

### Prerequisites
- Node.js 16+ and npm

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   - Navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

### Selecting Colors
1. **Click or drag** on the color rectangle to adjust saturation and lightness
2. **Use the hue slider** to select the base hue (0-360°)
3. **Adjust alpha** using the vertical slider on the right
4. **View real-time updates** of all color format values

### Copying Color Values
- Click the copy icon next to any color format to copy it to your clipboard
- A checkmark will appear to confirm the copy action
- For Hex, RGB, and HSL, you can also edit the values directly

### Checking Contrast
1. Enter or select a background color in the contrast checker section
2. View the contrast ratio between your selected color and the background
3. See WCAG compliance ratings (AAA, AA, Fail)
4. Preview how text will look with the selected colors

## Technology Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library

## Project Structure

```
picker/
├── src/
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Main app component
│   └── index.css         # Global styles with Tailwind
├── color-picker.jsx      # Color picker component
├── index.html            # HTML template
├── package.json          # Dependencies and scripts
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind configuration
├── postcss.config.js     # PostCSS configuration
└── README.md             # This file
```

## Color Space Information

### Display P3
Modern wide-gamut color space supported by newer displays. Offers more vibrant colors than standard sRGB.

### OKLCH
A modern, perceptually uniform color space. Great for creating color palettes and gradients that look natural.

### LAB & LCH
Perceptually uniform color spaces designed to match human vision. LCH is the cylindrical representation of LAB.

### HSL
Hue, Saturation, Lightness - intuitive for designers and easy to manipulate.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Note: Display P3 colors require a compatible display and browser to render accurately.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

