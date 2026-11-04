// Proxy del dev-server: il frontend chiama la propria origine e il dev-server
// inoltra le richieste al backend locale. La porta arriva da BE_PORT (.env),
// così non serve toccare il codice quando cambi porta.
const backendPort = process.env.BE_PORT || process.env.SERVER_PORT || '8080';
const target = `http://127.0.0.1:${backendPort}`;

export default {
  '/categories': { target, secure: false, changeOrigin: true },
  '/questions': { target, secure: false, changeOrigin: true },
  '/games': { target, secure: false, changeOrigin: true },
  '/ws-pubgame': { target, secure: false, ws: true, changeOrigin: true }
};
