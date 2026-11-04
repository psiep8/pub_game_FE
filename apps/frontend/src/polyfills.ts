/**
 * Shim per le librerie CommonJS che nel browser si aspettano un ambiente Node
 * (`sockjs-client` usa `global` e `process`).
 *
 * In ambiente di test (jsdom) `process` è già quello di Node: sovrascriverlo con
 * uno stub minimale rompe le dipendenze che lo usano davvero — per esempio
 * `debug`, importato da `sockjs-client`, che legge `process.stderr`.
 */
const globalScope = window as any;

globalScope.global = globalScope.global ?? globalScope;

if (!globalScope.process) {
  globalScope.process = {
    env: { DEBUG: undefined },
    version: '',
    nextTick: (fn: Function) => setTimeout(fn, 0),
  };
}
