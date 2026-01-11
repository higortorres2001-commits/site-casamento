/**
 * Generates a URL-friendly slug from text
 * @param text - Text to convert to slug
 * @returns URL-friendly slug
 */
export function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD') // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generates a unique slug from couple names
 * @param brideName - Bride's name
 * @param groomName - Groom's name
 * @returns Slug in format "firstname1-firstname2"
 */
export function generateCoupleSlug(brideName: string, groomName: string): string {
    // Get first names
    const brideFirstName = brideName.trim().split(' ')[0];
    const groomFirstName = groomName.trim().split(' ')[0];

    // Create slug from first names
    const baseSlug = generateSlug(`${brideFirstName} ${groomFirstName}`);

    return baseSlug;
}

/**
 * Adds a numeric suffix to make slug unique
 * @param baseSlug - Base slug
 * @param existingSlugs - Array of existing slugs to check against
 * @returns Unique slug
 */
export function makeSlugUnique(baseSlug: string, existingSlugs: string[]): string {
    let slug = baseSlug;
    let counter = 1;

    while (existingSlugs.includes(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    return slug;
}
