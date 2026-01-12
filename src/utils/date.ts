/**
 * Safely formats a date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
 * without timezone conversion issues.
 * 
 * The problem: new Date("2026-01-15").toLocaleDateString() interprets the date as UTC midnight,
 * which in Brazil timezone (UTC-3) becomes "January 14th at 21:00", displaying the wrong date.
 * 
 * This function parses the date manually to avoid timezone shifts.
 */
export function formatDateBR(dateString: string | null | undefined): string {
    if (!dateString) return '';

    // Extract date part only (ignore time if present)
    const datePart = dateString.split('T')[0];
    const parts = datePart.split('-');

    if (parts.length !== 3) {
        // Fallback for unexpected format
        return dateString;
    }

    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    // Return in DD/MM/YYYY format
    return `${day}/${month}/${year}`;
}

/**
 * Parses a date string (YYYY-MM-DD) into a Date object in local timezone.
 * Use this for countdown timers and date calculations.
 * 
 * @param dateString - Date in YYYY-MM-DD format
 * @param time - Optional time in HH:MM format
 */
export function parseDateLocal(dateString: string | null | undefined, time?: string | null): Date | null {
    if (!dateString) return null;

    const datePart = dateString.split('T')[0];
    const parts = datePart.split('-');

    if (parts.length !== 3) return null;

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
    const day = parseInt(parts[2]);

    let hours = 0;
    let minutes = 0;

    if (time) {
        const timeParts = time.split(':');
        if (timeParts.length >= 2) {
            hours = parseInt(timeParts[0]);
            minutes = parseInt(timeParts[1]);
        }
    }

    return new Date(year, month, day, hours, minutes, 0);
}
