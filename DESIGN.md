---
name: Obsidian Cyber
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dbe7'
  primary: '#e1fdff'
  on-primary: '#00363a'
  primary-container: '#00f2ff'
  on-primary-container: '#006a71'
  inverse-primary: '#00696f'
  secondary: '#bcc7de'
  on-secondary: '#263143'
  secondary-container: '#3e495d'
  on-secondary-container: '#aeb9d0'
  tertiary: '#eff8ff'
  on-tertiary: '#003547'
  tertiary-container: '#ace2ff'
  on-tertiary-container: '#006788'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#74f5ff'
  primary-fixed-dim: '#00dbe7'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#c0e8ff'
  tertiary-fixed-dim: '#7bd1fa'
  on-tertiary-fixed: '#001e2b'
  on-tertiary-fixed-variant: '#004d66'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  gutter: 1.5rem
  margin: 2rem
---

## Brand & Style

The brand personality of this design system is defined by technical precision and immersive digital organization. It targets a sophisticated gaming audience that values both aesthetic polish and functional efficiency. The UI evokes a "Command Center" feel—reliable, high-performance, and futuristic.

The design style merges **Minimalism** with **Glassmorphism**. By stripping away unnecessary decorative elements, the system allows game cover art to remain the focal point. Glassmorphism is applied strategically to navigational elements and overlays to provide a sense of depth and modern craft without distracting from the primary content library.

## Colors

This design system utilizes a high-contrast dark palette designed to reduce eye strain during long sessions while making game metadata legible. 

- **Primary:** Electric Cyan (#00f2ff) is reserved for high-priority actions, focus states, and progress indicators.
- **Surface Palette:** The foundation is Deep Charcoal (#121212), with Slate Grays used to define containers and interactive surfaces.
- **Borders:** Subtle, low-opacity slate borders (e.g., #334155 at 40% opacity) are used to define game card boundaries without creating visual noise.
- **Accents:** Tertiary sky blues are used for secondary status indicators (e.g., "Verified ROM" or "Updated").

## Typography

The typography system relies on **Inter** for its exceptional legibility and neutral, systematic character. 

- **Hierarchy:** Game titles use `headline-lg` or `headline-md` in bold weights to stand out against rich imagery. 
- **Metadata Labels:** Small, uppercase bold labels with slight letter-spacing are used for technical details like "PLATFORM," "REGION," or "FILE SIZE" to ensure high-contrast readability against dark backgrounds.
- **Body Text:** Standard information uses a comfortable 14px-16px size with generous line height for descriptions and change logs.

## Layout & Spacing

The layout utilizes a **Fluid Grid** model for the main game library, allowing the view to scale from small thumbnails to large hero cards based on the window size. 

- **Sidebars:** A fixed-width sidebar (280px) houses navigation, utilizing a semi-transparent glass effect to maintain a sense of space.
- **Grid System:** An 8px base unit drives all spacing. For the gallery, a 24px (1.5rem) gutter is maintained to prevent visual clutter between cover art.
- **Margins:** Global page margins are set to 32px (2rem) to frame the content comfortably within the desktop application window.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Glassmorphism**.

- **Level 0 (Background):** Solid #121212.
- **Level 1 (Cards/Containers):** Slate Gray (#1e293b) with a 1px subtle border.
- **Level 2 (Overlays/Sidebars):** Semi-transparent slate with a `backdrop-filter: blur(12px)`. This creates a frosted glass effect that suggests the UI is floating above the game library.
- **Shadows:** Use ultra-soft, large-radius shadows (0 10px 30px rgba(0,0,0,0.5)) for active game cards and modals to pull them forward in the Z-space.

## Shapes

The shape language for this design system is consistently **Rounded**, striking a balance between organic approachability and technical precision.

- **Standard Elements:** Buttons, input fields, and small cards use a 0.5rem (8px) radius.
- **Large Components:** Main game cover cards and modal containers use a 1rem (16px) radius to emphasize their importance and soften the overall look of the grid.
- **Interactive States:** On hover, cards may subtly increase their elevation, but the corner radius remains constant to maintain visual rhythm.

## Components

- **Game Cards:** The centerpiece component. It features a full-bleed cover image with a subtle gradient overlay at the bottom to ensure title legibility. Metadata chips sit at the top-right.
- **Buttons:** Primary buttons are solid Electric Cyan with black text. Secondary buttons are outlined in slate with hover-filled states.
- **Metadata Chips:** High-contrast, small-format pills (e.g., "N64", "RPG") with semi-transparent backgrounds and bright borders.
- **Input Fields:** Deep-set dark fields with #00f2ff focus rings and ghost placeholder text.
- **Glass Sidebars:** Navigational links use a subtle "left-border" indicator in primary cyan when active, accompanied by a soft background highlight.
- **Progress Bars:** Thin, 4px tall bars using the primary color for completion, set against a dark slate track.