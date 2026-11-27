/**
 * Porte del banco E2E: una sola fonte per il webServer e per le chiamate
 * dirette dei test. I valori predefiniti restano quelli della serata di prova.
 */
export const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT) || 4295;
export const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT) || 8095;
