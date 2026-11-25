/**
 * Mencatat durasi request ke histogram Prometheus.
 *
 * TODO:
 *  - Timer mulai di awal, berhenti pada event 'finish'
 *  - Normalisasi UUID di path agar jumlah label terkendali; rute tak dikenal = 'unmatched'
 */
