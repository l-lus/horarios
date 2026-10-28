const CACHE_PREFIX = 'horarios-';
const CACHE_NAME = `${CACHE_PREFIX}v261027.0245-cache`;
const urlsToCache = [
  './',
  './index.html',
  './assets/manifest.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/badge-96.png',
  './assets/styles/tokens.css',
  './assets/styles/base.css',
  './assets/styles/tarjetas-vistas.css',
  './assets/styles/modales-funciones.css',
  './assets/styles/responsivo-movimiento.css',
  './src/core/tema-inicial.js',
  './src/core/constantes.js',
  './src/core/dom.js',
  './src/core/eventos.js',
  './src/core/movimiento.js',
  './src/core/tiempo-utils.js',
  './src/core/seguridad.js',
  './src/core/almacenamiento.js',
  './src/data/fondos.js',
  './src/data/feriados.js',
  './src/services/estado-app.js',
  './src/services/instalador-pwa.js',
  './src/services/recordatorio-push.js',
  './src/services/gestor-perfiles.js',
  './src/services/gestor-historial.js',
  './src/services/tipos-registro.js',
  './src/services/compensatorios.js',
  './src/services/importar-exportar.js',
  './src/services/filtros-periodos.js',
  './src/services/gestion-datos.js',
  './src/services/saldo-semanal.js',
  './src/services/sincronizacion-gist.js',
  './src/services/feriados-ar.js',
  './src/ui/gestor-temas.js',
  './src/ui/gestor-modales.js',
  './src/ui/animaciones.js',
  './src/ui/base.js',
  './src/ui/perfiles.js',
  './src/ui/calendario.js',
  './src/ui/respaldo-local.js',
  './src/ui/gist-respaldo.js',
  './src/ui/historico-edicion.js',
  './src/ui/historico.js',
  './src/ui/reportes.js',
  './src/ui/estadisticas.js',
  './src/ui/tarjeta-fondos.js',
  './src/ui/tarjeta-tiempo-fuera.js',
  './src/ui/tarjeta-lote.js',
  './src/ui/tarjeta-fichaje.js',
  './src/ui/orden-tarjetas.js',
  './src/ui/notificaciones.js',
  './src/ui/configuracion.js',
  './src/ui/historial-dias.js',
  './src/ui/bienvenida-modal.js',
  './src/ui/aviso-push.js',
  './src/ui/orquestador.js',
  './src/main.js',
];

// Instalación
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache.map(u => new Request(u, { cache: 'reload' }))).catch(err => {
          console.error('CRÍTICO: Falló la carga de archivos en el install:', err);
          throw err;
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activación — limpieza de cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          // Solo cachés propias: el origen de GitHub Pages es compartido con otras apps
          .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch — cache-first aislado en CACHE_NAME, fallback a network
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  
  // Limitar al scope del Service Worker para no cachear otros proyectos en el mismo origen de GitHub Pages
  if (!url.pathname.startsWith(self.registration.scope.replace(location.origin, ''))) return;

  const matchOpts = { cacheName: CACHE_NAME, ignoreSearch: true };

  event.respondWith(
    caches.match(event.request, matchOpts)
      .then(cached => {
        if (cached) return cached;

        return fetch(event.request)
          .then(networkResponse => {
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type !== 'basic'
            ) {
              return networkResponse;
            }
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            return networkResponse;
          })
          .catch(async () => {
            if (event.request.mode === 'navigate') {
              return (await caches.match('./index.html', matchOpts)) || caches.match('./', matchOpts);
            }
          });
      })
  );
});

// Push — recordatorio de fin de jornada (viene del Worker de Cloudflare)
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Horarios', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Horarios', {
      body: data.body || 'Se cumplió tu horario de hoy',
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/badge-96.png',
      tag: 'horarios-recordatorio',
      renotify: true,
    })
  );
});

// Click en la notificación — enfoca la PWA si ya está abierta, si no la abre
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // 1. Prioridad: ventana que tenga la URL de PWA (modo standalone)
      const pwaClient = clientList.find(c => c.url && c.url.includes('mode=pwa'));
      if (pwaClient && 'focus' in pwaClient) {
        return pwaClient.focus();
      }

      // 2. Si no hay con mode=pwa, enfocar cualquier ventana que pertenezca al scope de la app
      for (const client of clientList) {
        if (client.url && client.url.startsWith(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }

      // 3. Si no hay ninguna ventana abierta, abrir la PWA directamente con URL absoluta
      const pwaUrl = new URL('./index.html?mode=pwa', self.registration.scope).href;
      if (self.clients.openWindow) {
        return self.clients.openWindow(pwaUrl);
      }
    })
  );
});
