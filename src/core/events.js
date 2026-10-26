// ====================================================================
// APPLICATION EVENT BUS & HANDLER REGISTRY MODULE
// ====================================================================
const _listeners = new Map();
const _handlers = new Map();

function on(event, listener) {
    if (typeof listener !== 'function') return () => { };
    if (!_listeners.has(event)) _listeners.set(event, new Set());
    _listeners.get(event).add(listener);
    return () => off(event, listener);
}

function off(event, listener) {
    const set = _listeners.get(event);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) _listeners.delete(event);
}

function emit(event, payload) {
    const set = _listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
        try {
            listener(payload);
        } catch (err) {
            console.error(`Error en listener de evento "${event}":`, err);
        }
    }
}

function register(action, handler) {
    if (typeof handler === 'function') {
        _handlers.set(action, handler);
    }
}

function call(action, ...args) {
    const fn = _handlers.get(action);
    if (typeof fn === 'function') {
        return fn(...args);
    }
    return undefined;
}

export const AppEvents = {
    on,
    off,
    emit,
    register,
    call
};
