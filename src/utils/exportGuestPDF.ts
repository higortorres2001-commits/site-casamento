import { Envelope, Guest } from "@/types";

interface EnvelopeWithGuests extends Envelope {
    guests: Guest[];
}

interface RsvpData {
    [guestId: string]: {
        attending: string;
        validation_status: string;
    };
}

interface ExportStats {
    totalGuests: number;
    totalConfirmed: number;
    totalWithWhatsApp: number;
}

export const exportGuestListToPDF = async (
    envelopes: EnvelopeWithGuests[],
    stats: ExportStats,
    rsvpData: RsvpData
) => {
    // Helper to calculate stats per envelope
    const getRsvpStats = (guests: Guest[]) => {
        const confirmed = guests.filter((g) => {
            const rsvp = rsvpData[g.id];
            return rsvp?.attending === "yes" && rsvp?.validation_status === "validated";
        }).length;
        return { confirmed, total: guests.length };
    };

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let html = `
        <html>
        <head>
            <title>Lista de Convidados - ${dateStr}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
                h1 { font-size: 18px; margin-bottom: 10px; }
                .summary { background: #f5f5f5; padding: 10px; margin-bottom: 20px; border-radius: 4px; }
                .summary span { margin-right: 20px; }
                .envelope { margin-bottom: 20px; page-break-inside: avoid; }
                .envelope-title { font-weight: bold; font-size: 14px; background: #eee; padding: 5px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 5px; text-align: left; }
                th { background: #f5f5f5; }
                .confirmed { color: green; }
                .pending { color: gray; }
                .declined { color: red; }
                @media print { body { -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <h1>Lista de Convidados</h1>
            <div class="summary">
                <span><strong>${envelopes.length}</strong> convites</span>
                <span><strong>${stats.totalGuests}</strong> convidados</span>
                <span><strong>${stats.totalConfirmed}</strong> confirmados</span>
                <span><strong>${stats.totalWithWhatsApp}</strong> com WhatsApp</span>
                <span>Exportado em: ${dateStr} às ${timeStr}</span>
            </div>
    `;

    // Sort envelopes alphabetically by group_name
    const sortedEnvelopes = [...envelopes].sort((a, b) =>
        a.group_name.localeCompare(b.group_name, 'pt-BR', { sensitivity: 'base' })
    );

    sortedEnvelopes.forEach(env => {
        const envStats = getRsvpStats(env.guests);

        // Sort guests alphabetically by name within each envelope
        const sortedGuests = [...env.guests].sort((a, b) =>
            a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
        );

        html += `
            <div class="envelope">
                <div class="envelope-title">${env.group_name} (${envStats.confirmed}/${envStats.total} confirmados)</div>
                <table>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Tipo</th>
                            <th>WhatsApp</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sortedGuests.forEach(guest => {
            const rsvp = rsvpData[guest.id];
            let status = 'Pendente';
            let statusClass = 'pending';
            if (rsvp?.attending === 'yes' && rsvp?.validation_status === 'validated') {
                status = 'Confirmado';
                statusClass = 'confirmed';
            } else if (rsvp?.attending === 'no') {
                status = 'Recusado';
                statusClass = 'declined';
            }

            html += `
                <tr>
                    <td>${guest.name}</td>
                    <td>${guest.guest_type === 'child' ? 'Criança' : 'Adulto'}</td>
                    <td>${guest.whatsapp || '-'}</td>
                    <td class="${statusClass}">${status}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    });

    html += '</body></html>';

    // Return a promise that resolves when print is triggered/window opened
    return new Promise<void>((resolve) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            // Small timeout to ensure content is loaded before printing (mostly for styles)
            setTimeout(() => {
                printWindow.print();
                resolve();
            }, 500);
        } else {
            resolve();
        }
    });
};
