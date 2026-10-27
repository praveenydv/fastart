// FastArt Unified Obsidian Dark Design System
import { THEME_COLORS, DESIGN_CONSTANTS } from './designConstants';

export const theme = {
  colors: THEME_COLORS,
  typography: {
    fontFamily: DESIGN_CONSTANTS.TYPOGRAPHY.fontFamily,
    sizes: {
      xs: DESIGN_CONSTANTS.TYPOGRAPHY.sizes.micro,
      sm: DESIGN_CONSTANTS.TYPOGRAPHY.sizes.label,
      base: DESIGN_CONSTANTS.TYPOGRAPHY.sizes.input,
      lg: DESIGN_CONSTANTS.TYPOGRAPHY.sizes.heading,
      xl: 20,
      xxl: DESIGN_CONSTANTS.TYPOGRAPHY.sizes.display,
      display: 30,
    },
    weights: DESIGN_CONSTANTS.TYPOGRAPHY.weights,
  },
  spacing: DESIGN_CONSTANTS.SPACING,
  borderRadius: {
    xs: DESIGN_CONSTANTS.RADII.xs,
    sm: DESIGN_CONSTANTS.RADII.sm,
    md: DESIGN_CONSTANTS.RADII.md,
    lg: DESIGN_CONSTANTS.RADII.lg,
    xl: DESIGN_CONSTANTS.RADII.xl,
    full: DESIGN_CONSTANTS.RADII.full,
  },
  dimensions: DESIGN_CONSTANTS.DIMENSIONS,
  shadows: DESIGN_CONSTANTS.SHADOWS,
  zIndex: DESIGN_CONSTANTS.Z_INDEX,
};

export { THEME_COLORS, DESIGN_CONSTANTS };
export default theme;
