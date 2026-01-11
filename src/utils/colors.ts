export const hexToRgba = (hex: string, alpha: number): string => {
    // Remove hash if present
    hex = hex.replace('#', '');

    // Parse r, g, b
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Helper to validate if a string is a valid hex color
export const isValidHex = (hex: string): boolean => {
    return /^#[0-9A-F]{6}$/i.test(hex);
};
