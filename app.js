
(function () {
    try {
        var stored = localStorage.getItem('temaOscuro');
        if (stored === 'true' || stored === null) {
            document.body.classList.add('dark-mode');
        }
    } catch (e) { }
})();
(function () {
    'use strict';

    const $ = id => document.getElementById(id);

    function _applyDataColors(root) {
        root.querySelectorAll('[data-color]').forEach(el => {
            el.style.color = el.dataset.color;
        });
    }

    // ====================================================================
    // NOTIFICACIONES MANAGER MODULE
    // ====================================================================
    const NotificacionesManager = (function () {
        let habilitadas = false;
        let minutosAntes = 0;
        let ultimaNotificacionFecha = null;

        function inicializar() {
            cargarConfiguracion();
            actualizarUI();
        }

        function cargarConfiguracion() {
            try {
                habilitadas = localStorage.getItem('noti_habilitadas') === 'true';
                minutosAntes = parseInt(localStorage.getItem('noti_minutos') || '0', 10);
                ultimaNotificacionFecha = localStorage.getItem('noti_ultima_fecha');
            } catch (e) {
                console.error("Error al cargar config de notificaciones", e);
            }
        }

        function guardarConfiguracion() {
            try {
                localStorage.setItem('noti_habilitadas', habilitadas);
                localStorage.setItem('noti_minutos', minutosAntes);
                if (ultimaNotificacionFecha) {
                    localStorage.setItem('noti_ultima_fecha', ultimaNotificacionFecha);
                }
            } catch (e) {}
        }

        async function alternarHabilitacion() {
            if (!habilitadas) {
                if (!('Notification' in window)) {
                    if (window.UILogic) UILogic.mostrarToast('Tu navegador no soporta notificaciones.', 'error');
                    return;
                }
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    habilitadas = true;
                    if (window.UILogic) UILogic.mostrarToast('Notificaciones activadas', 'success');
                } else {
                    habilitadas = false;
                    if (window.UILogic) UILogic.mostrarToast('Permiso de notificaciones denegado', 'error');
                }
            } else {
                habilitadas = false;
                if (window.UILogic) UILogic.mostrarToast('Notificaciones desactivadas', 'info');
            }
            guardarConfiguracion();
            actualizarUI();
        }

        function setMinutosAntes(minutos) {
            minutosAntes = minutos;
            guardarConfiguracion();
        }

        function actualizarUI() {
            const btn = document.getElementById('btn-toggle-notificaciones');
            const label = document.getElementById('label-notificaciones-estado');
            const grupoTiempo = document.getElementById('grupo-notificaciones-tiempo');
            const selectTiempo = document.getElementById('select-notificaciones-tiempo');

            if (btn && label && grupoTiempo && selectTiempo) {
                if (habilitadas) {
                    label.textContent = 'Habilitadas';
                    btn.classList.add('active');
                    grupoTiempo.classList.remove('hidden');
                    selectTiempo.value = minutosAntes.toString();
                } else {
                    label.textContent = 'Deshabilitadas';
                    btn.classList.remove('active');
                    grupoTiempo.classList.add('hidden');
                }
            }
        }

        function comprobarYNotificar(faltanteHoras) {
            if (!habilitadas || Notification.permission !== 'granted') return;
            if (!window.DataManagement) return;

            const faltanteMinutos = faltanteHoras * 60;
            if (faltanteMinutos <= minutosAntes && faltanteMinutos >= (minutosAntes - 1.5)) {
                const hoy = window.SecurityAndUtils ? SecurityAndUtils.formatearFechaLocal(new Date()) : new Date().toISOString().split('T')[0];
                if (ultimaNotificacionFecha !== hoy) {
                    enviarNotificacion(`¡Tu jornada está por terminar!`, `Faltan aprox. ${Math.max(0, Math.round(faltanteMinutos))} minutos para cumplir tu objetivo.`);
                    ultimaNotificacionFecha = hoy;
                    guardarConfiguracion();
                }
            }
        }

        function enviarNotificacion(titulo, cuerpo) {
            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(titulo, {
                        body: cuerpo,
                        icon: './icon.svg',
                        vibrate: [200, 100, 200],
                        tag: 'horarios-alerta',
                        renotify: true
                    }).catch(err => {
                        new Notification(titulo, { body: cuerpo, icon: './icon.svg' });
                    });
                }).catch(err => {
                    new Notification(titulo, { body: cuerpo, icon: './icon.svg' });
                });
            } else {
                new Notification(titulo, { body: cuerpo, icon: './icon.svg' });
            }
        }

        return {
            inicializar,
            alternarHabilitacion,
            setMinutosAntes,
            comprobarYNotificar,
            actualizarUI
        };
    })();

    // ====================================================================
    // PWA INSTALLER MODULE
    // ====================================================================
    const PWAInstaller = (function () {
        let deferredPrompt = null;
        const btnInstall = document.getElementById('btn-install');

        function init() {
            if (window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true) {
                if (btnInstall) btnInstall.style.display = 'none';
                return;
            }

            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                if (btnInstall) {
                    btnInstall.style.display = 'flex';
                }
            });

            window.addEventListener('appinstalled', () => {
                if (btnInstall) btnInstall.style.display = 'none';
                deferredPrompt = null;
                if (window.UILogic) {
                    UILogic.mostrarToast('¡App instalada con éxito!', 'success');
                }
            });
        }

        async function instalarApp() {
            if (!deferredPrompt) return;

            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
        }

        return {
            init,
            instalarApp
        };
    })();

    // ====================================================================
    // SECURITY AND UTILS MODULE
    // ====================================================================
    const SecurityAndUtils = (function () {
        const SECURITY_LIMITS = {
            MAX_REGISTROS: 1000,
            MAX_STRING_LENGTH: 100,
            MAX_NOTAS_LENGTH: 35,
            MAX_JSON_SIZE: 4 * 1024 * 1024,
            SCHEMA_VERSION: 3,
        };

        const REGEX_PATTERNS = {
            FECHA: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
            HORA: /^([01]\d|2[0-3]):([0-5]\d)$/,
            ID: /^[a-zA-Z0-9-_]{10,100}$/,
            NOTAS: /[^a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ ]/g
        };

        function sanitizeString(str, maxLength = SECURITY_LIMITS.MAX_STRING_LENGTH) {
            if (typeof str !== 'string') return '';

            return str
                .replace(/[<>"'`]/g, '')
                .replace(/javascript:/gi, '')
                .replace(/data:/gi, '')
                .replace(/vbscript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .replace(/[\x00-\x1F\x7F]/g, '')
                .replace(/&lt;/gi, '')
                .replace(/&gt;/gi, '')
                .replace(/&#/g, '')
                .trim()
                .substring(0, maxLength);
        }

        function sanitizeNotas(str, trim = false) {
            if (typeof str !== 'string') return '';
            const r = str.replace(REGEX_PATTERNS.NOTAS, '').substring(0, SECURITY_LIMITS.MAX_NOTAS_LENGTH);
            return trim ? r.trim() : r;
        }

        function validarFechaSegura(f) {
            if (!f || !REGEX_PATTERNS.FECHA.test(f)) return false;

            try {
                const [y, m, d] = f.split('-').map(Number);
                const fecha = new Date(y, m - 1, d);
                if (fecha.getFullYear() !== y ||
                    fecha.getMonth() !== m - 1 ||
                    fecha.getDate() !== d) {
                    return false;
                }

                const ahora = new Date();
                const hace20Anos = new Date(ahora.getFullYear() - 20, 0, 1);
                const en2Anos = new Date(ahora.getFullYear() + 2, 11, 31);

                return fecha >= hace20Anos && fecha <= en2Anos && !isNaN(fecha.getTime());
            } catch (e) {
                return false;
            }
        }

        function validarHoraSegura(h) {
            return h && REGEX_PATTERNS.HORA.test(h);
        }

        function generarIDSeguro() {
            if (window.crypto && window.crypto.getRandomValues) {
                const array = new Uint32Array(4);
                crypto.getRandomValues(array);
                return Array.from(array, num => num.toString(36)).join('');
            }
            const timestamp = Date.now().toString(36);
            const random1 = Math.random().toString(36).substring(2, 11);
            const random2 = Math.random().toString(36).substring(2, 11);
            return `${timestamp}-${random1}${random2}`;
        }

        async function calcularHashSHA256(data) {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        function validarRegistroSeguro(r) {
            if (!r || typeof r !== 'object') return false;
            if (Array.isArray(r) || r instanceof Date) return false;
            if (typeof r.id !== 'string' || !REGEX_PATTERNS.ID.test(r.id)) return false;
            if (typeof r.fecha !== 'string' || !REGEX_PATTERNS.FECHA.test(r.fecha)) return false;
            if (!validarFechaSegura(r.fecha)) return false;
            if (r.entrada !== null) {
                if (typeof r.entrada !== 'string' || !REGEX_PATTERNS.HORA.test(r.entrada)) return false;
            }
            if (r.salida !== null) {
                if (typeof r.salida !== 'string' || !REGEX_PATTERNS.HORA.test(r.salida)) return false;
            }

            if (r.tiempoFuera !== null && r.tiempoFuera !== '') {
                if (typeof r.tiempoFuera !== 'string' || !REGEX_PATTERNS.HORA.test(r.tiempoFuera)) return false;
            }

            if (r.credito !== null && r.credito !== undefined && r.credito !== '') {
                if (typeof r.credito !== 'string' || !REGEX_PATTERNS.HORA.test(r.credito)) return false;
            }

            if (r.notas !== null && r.notas !== undefined && r.notas !== '') {
                if (typeof r.notas !== 'string' || r.notas.length > SECURITY_LIMITS.MAX_NOTAS_LENGTH) return false;
            }

            if (!Number.isFinite(r.horas) || r.horas < 0 || r.horas > 24) return false;
            if (!Number.isFinite(r.minutos) || r.minutos < 0 || r.minutos > 59) return false;
            if (!Number.isFinite(r.total) || r.total < 0 || r.total > 24) return false;

            const propiedadesPermitidas = ['id', 'fecha', 'entrada', 'salida', 'tiempoFuera', 'horas', 'minutos', 'total', 'credito', 'notas']; const propiedadesActuales = Object.keys(r);
            const tienePropiedadesSospechosas = propiedadesActuales.some(prop => !propiedadesPermitidas.includes(prop));
            if (tienePropiedadesSospechosas) return false;

            return true;
        }
        function fechaLocalISO() {
            const d = new Date();
            const pad = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }

        function formatearFechaLocal(date) {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }

        function parsearFechaLocal(fechaStr) {
            return new Date(fechaStr.replace(/-/g, '/') + ' 00:00:00');
        }

        return {
            SECURITY_LIMITS,
            REGEX_PATTERNS,
            sanitizeString,
            sanitizeNotas,
            validarFechaSegura,
            validarHoraSegura,
            generarIDSeguro,
            calcularHashSHA256,
            validarRegistroSeguro,
            fechaLocalISO,
            formatearFechaLocal,
            parsearFechaLocal
        };
    })();

    // ====================================================================
    // PERFIL MANAGER MODULE
    // ====================================================================
    const PerfilManager = (function (S) {
        const MAX_PERFILES = 7;
        let perfilActual = 'default';
        let perfiles = {};

        function inicializar() {
            cargarPerfiles();
            actualizarSelector();
            actualizarNombrePerfil();
        }

        function cargarPerfiles() {
            try {
                const storedPerfiles = localStorage.getItem('perfiles');

                perfiles = storedPerfiles ? JSON.parse(storedPerfiles, (key, value) => {
                    if (['__proto__', 'constructor', 'prototype'].includes(key)) return undefined;
                    return value;
                }) : {};

                if (!perfiles['default']) {
                    perfiles['default'] = {
                        nombre: 'Principal',
                        registros: [],
                        diasHabiles: [1, 2, 3, 4, 5],
                        horasDiarias: 7
                    };
                }

                perfilActual = localStorage.getItem('perfilActivo') || 'default';
                if (!perfiles[perfilActual]) {
                    const availableIds = Object.keys(perfiles);
                    perfilActual = availableIds.length > 0 ? availableIds[0] : 'default';
                }

            } catch (e) {
                console.error('Error fatal cargando perfiles, reiniciando a estado seguro:', e);
                perfiles = {
                    'default': {
                        nombre: 'Principal',
                        registros: [],
                        diasHabiles: [1, 2, 3, 4, 5],
                        horasDiarias: 7
                    }
                };
                perfilActual = 'default';
            }
        }

        function guardarPerfiles() {
            try {
                localStorage.setItem('perfiles', JSON.stringify(perfiles));
                localStorage.setItem('perfilActivo', perfilActual);
                return true;
            } catch (e) { return false; }
        }

        function actualizarNombrePerfil() {
            const nombreInput = document.getElementById('nombre-perfil-actual');
            if (nombreInput && perfiles[perfilActual]) nombreInput.value = perfiles[perfilActual].nombre;
            const btnEliminar = document.getElementById('btn-eliminar-perfil-modal');
            if (btnEliminar) {
                btnEliminar.disabled = (perfilActual === 'default');
            }
        }

        function guardarDatosPerfilActual() {
            if (!window.DataManagement) return false;
            const actual = perfiles[perfilActual];
            perfiles[perfilActual] = {
                nombre: actual.nombre,
                registros: [...window.DataManagement.registros()],
                diasHabiles: window.DataManagement.diasHabiles(),
                horasDiarias: window.DataManagement.horasDiarias(),
                ...(actual.gistId && { gistId: actual.gistId }),
                ...(actual.gistLastSync && { gistLastSync: actual.gistLastSync }),
                ...(actual.gistAutoSync != null && { gistAutoSync: actual.gistAutoSync }),
                ...(actual.gistRangoDesde && { gistRangoDesde: actual.gistRangoDesde }),
                ...(actual.gistRangoHasta && { gistRangoHasta: actual.gistRangoHasta }),
                ...(actual.gistSyncFecha_subir && { gistSyncFecha_subir: actual.gistSyncFecha_subir }),
                ...(actual.gistSyncCount_subir != null && { gistSyncCount_subir: actual.gistSyncCount_subir }),
                ...(actual.gistSyncFecha_bajar && { gistSyncFecha_bajar: actual.gistSyncFecha_bajar }),
                ...(actual.gistSyncCount_bajar != null && { gistSyncCount_bajar: actual.gistSyncCount_bajar }),
                ...(actual.gistMergeBehavior && { gistMergeBehavior: actual.gistMergeBehavior })
            };
            return guardarPerfiles();
        }

        function cargarDatosPerfilActual() { return perfiles[perfilActual]; }

        function actualizarSelector() {
            const btnTexto = document.getElementById('nombre-perfil-header');
            if (btnTexto && perfiles[perfilActual]) {
                btnTexto.textContent = perfiles[perfilActual].nombre;
            }
        }

        function obtenerListaPerfiles() {
            return Object.entries(perfiles).map(([id, perfil]) => ({
                id: id,
                nombre: perfil.nombre,
                esActual: id === perfilActual,
                totalRegistros: Array.isArray(perfil.registros) ? perfil.registros.length : 0
            })).sort((a, b) => {
                if (a.id === 'default') return -1;
                if (b.id === 'default') return 1;
                return a.nombre.localeCompare(b.nombre);
            });
        }

        function cambiarPerfil(nuevoId) {
            if (!nuevoId) return;
            if (nuevoId === perfilActual) return;

            guardarDatosPerfilActual();
            perfilActual = nuevoId;
            try {
                localStorage.setItem('perfilActivo', perfilActual);
            } catch (e) {
                console.error('Error al guardar perfil activo:', e);
                mostrarToast('Error al guardar: almacenamiento lleno', 'error');
                return;
            }
            location.reload();
        }

        function obtenerPerfilActual() { return perfilActual; }

        function obtenerDatosPerfil() { return perfiles[perfilActual]; }

        function obtenerTodosPerfiles() { return perfiles; }

        function perfilKey(base) {
            return base + '_' + perfilActual;
        }

        return {
            inicializar, cambiarPerfil, guardarDatosPerfilActual, cargarDatosPerfilActual,
            obtenerPerfilActual, obtenerDatosPerfil, obtenerListaPerfiles, obtenerTodosPerfiles,
            guardarPerfiles, perfilKey
        };

    })(SecurityAndUtils);

    // ====================================================================
    // MODAL MANAGER MODULE
    // ====================================================================
    const ModalManager = (function () {
        const _padres = {};

        let _navegandoHaciaAtras = false;
        let _ignorandoPopstate = false;
        let _enAlternanciaHaciaAdelante = false;
        let _enAlternanciaHaciaAtras = false;

        function _getAccionVolver(modalId) {
            const acciones = {
                'modal-gist': () => window.UILogic?.cerrarModalGist(),
                'modal-gist-merge': () => window.UILogic?.gistMergeCancelar(),
                'modal-config': () => window.UILogic && UILogic.cerrarConfig(),
                'modal-selector-perfiles': () => window.UILogic && UILogic.cerrarSelectorPerfiles(),
                'modal-editar': () => window.UILogic && UILogic.cerrarEdicion(),
                'modal-importar': () => window.UILogic && UILogic.cerrarImportar(),
                'modal-exportar': () => window.UILogic && UILogic.cerrarExportar(),
                'modal-filtros': () => window.UILogic && UILogic.cerrarFiltros(),
                'modal-editar-perfil': () => window.UILogic && UILogic.cerrarEditorPerfil(),
                'modal-editar-grupo': () => window.UILogic && UILogic.cerrarEdicionGrupo(),
                'modal-confirmar': () => document.getElementById('modal-confirmar-cancel')?.click(),
            };
            return acciones[modalId] || null;
        }

        window.addEventListener('popstate', (event) => {
            if (_ignorandoPopstate) {
                _ignorandoPopstate = false;
                return;
            }

            _navegandoHaciaAtras = true;

            const modalesAbiertos = Array.from(document.querySelectorAll('.modal.show'));
            if (modalesAbiertos.length > 0) {
                const topModal = modalesAbiertos[modalesAbiertos.length - 1];
                const accionVolver = _getAccionVolver(topModal.id);

                if (accionVolver) {
                    accionVolver();
                } else {
                    cerrar(topModal.id);
                }
            }

            setTimeout(() => { _navegandoHaciaAtras = false; }, 50);
        });

        let _mousedownEnOverlay = false;

        function _handleOverlayMousedown(event) {
            _mousedownEnOverlay = event.target.classList.contains('modal') && event.target.classList.contains('show');
        }

        function handleOutsideClick(event) {
            if (!_mousedownEnOverlay) return;
            if (event.target.classList.contains('modal') && event.target.classList.contains('show')) {
                const modalId = event.target.id;
                const accionVolver = _getAccionVolver(modalId);
                if (accionVolver) {
                    accionVolver();
                } else {
                    cerrar(modalId);
                }
            }
        }

        function abrir(modalId, callback = null) {
            const modal = document.getElementById(modalId);
            if (!modal) return;

            modal.classList.add('show');
            document.body.classList.add('modal-open');

            if (!_navegandoHaciaAtras && !_enAlternanciaHaciaAtras) {
                history.pushState({ modalId: modalId }, "");
            }

            setTimeout(() => {
                modal.addEventListener('mousedown', _handleOverlayMousedown);
                modal.addEventListener('click', handleOutsideClick);
            }, 100);

            if (callback) callback();
        }

        function cerrar(modalId, callback = null) {
            const modal = document.getElementById(modalId);
            if (!modal) return;

            modal.classList.remove('show');

            if (document.querySelectorAll('.modal.show').length === 0) {
                document.body.classList.remove('modal-open');
            }

            modal.removeEventListener('mousedown', _handleOverlayMousedown);
            modal.removeEventListener('click', handleOutsideClick);

            if (!_navegandoHaciaAtras && !_enAlternanciaHaciaAdelante) {
                _ignorandoPopstate = true;
                history.back();
            }

            if (callback) callback();
        }

        function alternar(modalIdCerrar, modalIdAbrir, callbackCerrar = null, callbackAbrir = null) {
            const esHaciaAtras = (_padres[modalIdCerrar] === modalIdAbrir);

            if (esHaciaAtras) {
                _enAlternanciaHaciaAtras = true;
                delete _padres[modalIdCerrar]; 
            } else {
                _enAlternanciaHaciaAdelante = true;
                if (modalIdCerrar && modalIdAbrir) {
                    _padres[modalIdAbrir] = modalIdCerrar;
                }
            }

            cerrar(modalIdCerrar, callbackCerrar);
            abrir(modalIdAbrir, callbackAbrir);

            _enAlternanciaHaciaAdelante = false;
            _enAlternanciaHaciaAtras = false;
        }

        function cerrarTodos() {
            document.querySelectorAll('.modal.show').forEach(modal => {
                modal.classList.remove('show');
                modal.removeEventListener('mousedown', _handleOverlayMousedown);
                modal.removeEventListener('click', handleOutsideClick);
            });
            Object.keys(_padres).forEach(k => delete _padres[k]);
            document.body.classList.remove('modal-open');
        }

        return { abrir, cerrar, alternar, cerrarTodos };
    })();

    // ====================================================================
    // HISTORY MANAGER MODULE
    // ====================================================================
    const HistoryManager = (function () {
        let history = [];
        let currentIndex = -1;
        const MAX_HISTORY = 20;

        function deepClone(obj) {
            if (obj === null || obj === undefined) return obj;

            try {
                return structuredClone(obj);

            } catch (e) {
                console.warn('Fallo en structuredClone. Usando fallback JSON.stringify.', e);
                return JSON.parse(JSON.stringify(obj));
            }
        }

        function saveState(registros) {
            const copiaSegura = deepClone(registros);

            if (currentIndex < history.length - 1) {
                history.splice(currentIndex + 1);
            }

            history.push(copiaSegura);

            if (history.length > MAX_HISTORY) {
                history.shift();
                currentIndex = MAX_HISTORY - 1;
            } else {
                currentIndex = history.length - 1;
            }

            updateButtons();
            saveToLocalStorage();
        }

        function undo() {
            if (currentIndex > 0) {
                currentIndex--;
                updateButtons();
                saveToLocalStorage();
                const estado = deepClone(history[currentIndex]);
                return estado;
            }
            return null;
        }

        function redo() {
            if (currentIndex < history.length - 1) {
                currentIndex++;
                updateButtons();
                saveToLocalStorage();
                const estado = deepClone(history[currentIndex]);
                return estado;
            }
            return null;
        }

        function canUndo() {
            return currentIndex > 0;
        }

        function canRedo() {
            return currentIndex < history.length - 1;
        }

        function updateButtons() {
            const undoBtn = document.getElementById('btn-undo');
            const redoBtn = document.getElementById('btn-redo');

            if (undoBtn) undoBtn.disabled = !canUndo();
            if (redoBtn) redoBtn.disabled = !canRedo();
        }

        function saveToLocalStorage() {
            try {
                const perfilActual = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';
                const storageKey = `history_${perfilActual}`;

                const historyData = {
                    history: history,
                    currentIndex: currentIndex,
                    timestamp: Date.now()
                };

                localStorage.setItem(storageKey, JSON.stringify(historyData));
            } catch (error) {
                console.error('Error guardando historial:', error);
                if (error.name === 'QuotaExceededError' || error.code === 22) {
                    if (window.UILogic) UILogic.mostrarToast('Almacenamiento lleno: historial de deshacer no guardado', 'warning');
                }
            }
        }

        function loadFromLocalStorage() {
            try {
                const perfilActual = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';
                const storageKey = `history_${perfilActual}`;
                const stored = localStorage.getItem(storageKey);

                if (stored) {
                    const historyData = JSON.parse(stored, (key, value) => {
                        if (['__proto__', 'constructor', 'prototype'].includes(key)) return undefined;
                        return value;
                    });

                    const ahora = Date.now();
                    const tiempoTranscurrido = ahora - (historyData.timestamp || 0);
                    const limiteEnMs = 24 * 60 * 60 * 1000;

                    if (tiempoTranscurrido < limiteEnMs) {
                        history = historyData.history || [];
                        currentIndex = historyData.currentIndex !== undefined ? historyData.currentIndex : -1;

                        console.log(`✓ Historial restaurado: ${history.length} estados, índice actual: ${currentIndex}`);

                        return history.length > 0 && currentIndex >= 0;
                    } else {
                        console.log('Historial expirado (más de 24hs), limpiando...');
                        localStorage.removeItem(storageKey);
                        history = [];
                        currentIndex = -1;
                    }
                }
            } catch (error) {
                console.error('Error cargando historial:', error);
                history = [];
                currentIndex = -1;
            }

            updateButtons();
            return false;
        }

        function clearStorage() {
            try {
                const perfilActual = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';
                const storageKey = `history_${perfilActual}`;
                localStorage.removeItem(storageKey);
            } catch (error) {
                console.error('Error limpiando historial:', error);
            }
        }

        function clear() {
            history = [];
            currentIndex = -1;
            clearStorage();
            updateButtons();
        }

        function getCurrentState() {
            if (currentIndex >= 0 && currentIndex < history.length) {
                return deepClone(history[currentIndex]);
            }
            return null;
        }

        return {
            saveState,
            undo,
            redo,
            canUndo,
            canRedo,
            updateButtons,
            clear,
            saveToLocalStorage,
            loadFromLocalStorage,
            getCurrentState
        };
    })();

    function confirmarModal(texto, labelOk = 'Confirmar', icono = '#icon-trash') {
        return new Promise((resolve) => {
            const elTexto = document.getElementById('modal-confirmar-texto');
            const elLabel = document.getElementById('modal-confirmar-label-ok');
            const elIcono = document.querySelector('#modal-confirmar-ok svg use');
            const btnOk = document.getElementById('modal-confirmar-ok');
            const btnCancel = document.getElementById('modal-confirmar-cancel');
            if (!elTexto || !btnOk || !btnCancel) { resolve(false); return; }

            elTexto.textContent = texto;
            if (elLabel) elLabel.textContent = labelOk;
            if (elIcono) elIcono.setAttribute('href', icono);

            const modalPadre = document.querySelector('.modal.show');
            const modalPadreId = modalPadre ? modalPadre.id : null;

            function ok() { cleanup(); resolve(true); }
            function cancel() { cleanup(); resolve(false); }

            function cleanup() {
                btnOk.removeEventListener('click', ok);
                btnCancel.removeEventListener('click', cancel);
                if (modalPadreId) {
                    ModalManager.alternar('modal-confirmar', modalPadreId);
                } else {
                    ModalManager.cerrar('modal-confirmar');
                }
            }

            btnOk.addEventListener('click', ok);
            btnCancel.addEventListener('click', cancel);
            if (modalPadreId) {
                ModalManager.alternar(modalPadreId, 'modal-confirmar');
            } else {
                ModalManager.abrir('modal-confirmar');
            }
        });
    }

    // ====================================================================
    // TIPOS DE REGISTRO MODULE
    // ====================================================================
    const TiposRegistro = (function () {
        const TIPOS = {
            FERIADO: {
                id: 'feriado',
                codigo: '00:00',
                emoji: '🎉',
                label: 'Feriado',
                labelPlural: 'Feriados',
                descripcion: 'Día no laboral',
                color: 'purple',
                contabiliza: true
            },
            AUSENCIA: {
                id: 'ausencia',
                codigo: '11:11',
                emoji: '🏠',
                label: 'Licencia',
                labelPlural: 'Licencias',
                descripcion: 'Día libre',
                color: 'purple',
                contabiliza: true
            },
            VACACIONES: {
                id: 'vacaciones',
                codigo: '12:12',
                emoji: '🏖️',
                label: 'Vacaciones',
                labelPlural: 'Vacaciones',
                descripcion: 'Vacaciones',
                color: 'orange',
                contabiliza: true
            },
            ASUETO: {
                id: 'asueto',
                codigo: '13:13',
                emoji: '🎁',
                label: 'Asueto',
                labelPlural: 'Asuetos',
                descripcion: 'Día de asueto',
                color: 'purple',
                contabiliza: true
            },
            ENFERMEDAD: {
                id: 'enfermedad',
                codigo: '14:14',
                emoji: '🏥',
                label: 'Enfermedad',
                labelPlural: 'Enfermedades',
                descripcion: 'Enfermedad justificada',
                color: 'purple',
                contabiliza: true
            },
            PARO: {
                id: 'paro',
                codigo: '15:15',
                emoji: '📢',
                label: 'Paro',
                labelPlural: 'Paros',
                descripcion: 'Fuerza Mayor',
                color: 'purple',
                contabiliza: true
            },
            REMOTO: {
                id: 'remoto',
                codigo: '16:16',
                emoji: '💻',
                label: 'Remoto',
                labelPlural: 'Remotos',
                descripcion: 'Trabajo desde casa',
                color: 'purple',
                contabiliza: true
            },
            CAPACITACION: {
                id: 'capacitacion',
                codigo: '17:17',
                emoji: '📚',
                label: 'Capacitación',
                labelPlural: 'Capacitaciones',
                descripcion: 'Formacion profesional',
                color: 'purple',
                contabiliza: true
            },
            COMPENSATORIO: {
                id: 'compensatorio',
                codigo: '18:18',
                emoji: '⚖️',
                label: 'Compensatorio',
                labelPlural: 'Compensatorios',
                descripcion: 'Día compensatorio',
                color: 'purple',
                contabiliza: true
            }
        };

        function esRegistroEspecial(entrada, salida) {
            if (!entrada || !salida) return false;
            return entrada === salida && Object.values(TIPOS).some(t => t.codigo === entrada);
        }

        function obtenerTipoPorCodigo(entrada, salida) {
            if (!esRegistroEspecial(entrada, salida)) return null;
            return Object.values(TIPOS).find(t => t.codigo === entrada) || null;
        }

        function obtenerTipoPorId(id) {
            return Object.values(TIPOS).find(t => t.id === id) || null;
        }

        function validarTipoPermitido(id) {
            return Object.values(TIPOS).some(t => t.id === id);
        }

        function obtenerTodosLosTipos() {
            return Object.values(TIPOS);
        }

        function obtenerCodigosPorTipo(id) {
            const tipo = obtenerTipoPorId(id);
            return tipo ? { entrada: tipo.codigo, salida: tipo.codigo } : null;
        }

        return {
            TIPOS,
            esRegistroEspecial,
            obtenerTipoPorCodigo,
            obtenerTipoPorId,
            validarTipoPermitido,
            obtenerTodosLosTipos,
            obtenerCodigosPorTipo
        };
    })();

    // ====================================================================
    // DATA MANAGEMENT MODULE 
    // ====================================================================
    const DataManagement = (function (S) {
        let registros = [], diasHabiles = [1, 2, 3, 4, 5], horasDiarias = 7, editandoId = null; let vistaActual = 'diaria'; let ignorarTiempoFuera = false;
        let filtroActivo = false;

        function ordenarRegistros() {
            registros.sort((a, b) => {
                if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
                return (b.entrada || '').localeCompare(a.entrada || '');
            });
        }
        let filtroDesde = null;
        let filtroHasta = null;
        let filtroTipo = null;
        let grupoEnEdicion = null;

        function editarGrupo(grupo) {
            if (grupoEnEdicion !== null) return;

            grupoEnEdicion = {
                registros: grupo.registros,
                subtipo: grupo.subtipo,
                fechaDesde: grupo.registros[grupo.registros.length - 1].fecha,
                fechaHasta: grupo.registros[0].fecha
            };

            $('edit-grupo-tipo').value = grupo.subtipo;
            $('edit-grupo-desde').value = grupoEnEdicion.fechaDesde;
            $('edit-grupo-hasta').value = grupoEnEdicion.fechaHasta;

            UILogic.actualizarHintGrupo();

            ModalManager.abrir('modal-editar-grupo');
            UILogic.setBloqueoEdicionGrupo(true);
        }

        async function guardarEdicionGrupo() {
            if (!grupoEnEdicion) return;

            const modal = $('modal-editar-grupo');
            const btnGuardar = modal.querySelector('.btn-edit');
            btnGuardar.disabled = true;

            try {
                const nuevoTipo = S.sanitizeString($('edit-grupo-tipo').value.trim(), 20);
                const nuevaDesde = S.sanitizeString($('edit-grupo-desde').value.trim(), 10);
                const nuevaHasta = S.sanitizeString($('edit-grupo-hasta').value.trim(), 10);

                if (!nuevaDesde || !nuevaHasta) {
                    UILogic.mostrarToast('Verifica ambas fechas', 'error');
                    return;
                }
                if (!S.validarFechaSegura(nuevaDesde)) {
                    UILogic.mostrarToast('Fecha "Desde" inválida', 'error');
                    return;
                }
                if (!S.validarFechaSegura(nuevaHasta)) {
                    UILogic.mostrarToast('Fecha "Hasta" inválida', 'error');
                    return;
                }
                if (nuevaDesde > nuevaHasta) {
                    UILogic.mostrarToast('La fecha inicial debe ser inferior a la final', 'error');
                    return;
                }

                const hoy = new Date();
                const fechaInicioObj = S.parsearFechaLocal(nuevaDesde);
                const fechaFinObj = S.parsearFechaLocal(nuevaHasta);

                const dosPasado = new Date(hoy);
                dosPasado.setFullYear(hoy.getFullYear() - 2);
                const dosFuturo = new Date(hoy);
                dosFuturo.setFullYear(hoy.getFullYear() + 2);

                if (fechaInicioObj < dosPasado || fechaFinObj > dosFuturo) {
                    UILogic.mostrarToast('El rango debe estar entre 2 años atrás y 2 años adelante', 'error');
                    return;
                }

                if (!TiposRegistro.validarTipoPermitido(nuevoTipo)) {
                    UILogic.mostrarToast('Tipo de registro inválido', 'error');
                    return;
                }

                const diffDays = Math.ceil(Math.abs(fechaFinObj - fechaInicioObj) / (1000 * 60 * 60 * 24)) + 1;
                if (diffDays > 60) {
                    UILogic.mostrarToast(`El rango contiene ${diffDays} días.\n Máximo: 60 días por operación.`, 'error');
                    return;
                }

                const huboCambios =
                    nuevoTipo !== grupoEnEdicion.subtipo ||
                    nuevaDesde !== grupoEnEdicion.fechaDesde ||
                    nuevaHasta !== grupoEnEdicion.fechaHasta;

                if (!huboCambios) {
                    UILogic.mostrarToast('Sin cambios', 'info');
                    UILogic.cerrarEdicionGrupo();
                    return;
                }

                const fechasNuevas = [];
                let checkFecha = S.parsearFechaLocal(nuevaDesde);
                const checkFin = S.parsearFechaLocal(nuevaHasta);

                while (checkFecha <= checkFin) {
                    fechasNuevas.push(S.formatearFechaLocal(checkFecha));
                    checkFecha.setDate(checkFecha.getDate() + 1);
                }

                const idsDelGrupo = new Set(grupoEnEdicion.registros.map(r => r.id));
                const fechasSet = new Set(fechasNuevas);
                const conflictos = registros.filter(r => fechasSet.has(r.fecha) && !idsDelGrupo.has(r.id));

                if (conflictos.length > 0) {
                    const diasConflicto = conflictos
                        .map(r => r.fecha.substring(8, 10))
                        .sort((a, b) => a - b)
                        .join(', ');
                    UILogic.mostrarToast(`Conflicto en día(s): ${diasConflicto}\n Ya existen registros en esas fechas.`, 'error');
                    return;
                }

                registros = registros.filter(r => !idsDelGrupo.has(r.id));

                const codigosTipo = TiposRegistro.obtenerCodigosPorTipo(nuevoTipo);
                const { entrada, salida } = codigosTipo;

                const nuevosRegistros = fechasNuevas.map(fechaISO => {
                    const t = calcularHoras(entrada, salida, null);
                    return {
                        id: S.generarIDSeguro(),
                        fecha: fechaISO,
                        entrada,
                        salida,
                        tiempoFuera: null,
                        horas: t?.horas || 0,
                        minutos: t?.minutos || 0,
                        total: t?.total || 0
                    };
                });

                registros.push(...nuevosRegistros);
                ordenarRegistros();

                HistoryManager.saveState(registros);
                const saved = await guardarYActualizar(nuevosRegistros.map(r => r.id));

                if (saved) {
                    UILogic.mostrarToast('Grupo actualizado', 'success');
                    UILogic.cerrarEdicionGrupo();
                }
            } finally {
                btnGuardar.disabled = false;
            }
        }

        async function eliminarGrupoActual() {
            if (!grupoEnEdicion) return;

            if (grupoEnEdicion.registros.length > 60) {
                UILogic.mostrarToast(`Este grupo contiene ${grupoEnEdicion.registros.length} registros.\nMáximo permitido: 60 registros por operación.`, 'error');
                return;
            }

            const idsAEliminar = grupoEnEdicion.registros.map(r => r.id);
            registros = registros.filter(r => !idsAEliminar.includes(r.id));

            HistoryManager.saveState(registros);
            const saved = await guardarYActualizar();

            if (saved) {
                UILogic.mostrarToast('Grupo eliminado', 'success');
                UILogic.cerrarEdicionGrupo();
            }
        }

        function setGrupoEnEdicion(val) { grupoEnEdicion = val; }

        async function registrarDiaEspecial(fecha, tipo) {
            const registroExistente = registros.find(r => r.fecha === fecha);

            if (registroExistente) {
                UILogic.mostrarToast('Ya existe un registro para hoy', 'warning');
                throw new Error('Registro ya existe');
            }

            const tipoConfig = TiposRegistro.obtenerTipoPorId(tipo);
            if (!tipoConfig) {
                UILogic.mostrarToast('Tipo inválido', 'error');
                throw new Error('Tipo inválido');
            }

            const entrada = tipoConfig.codigo;
            const salida = tipoConfig.codigo;
            const tipoTexto = `${tipoConfig.emoji} ${tipoConfig.label}`;

            if (registros.length >= S.SECURITY_LIMITS.MAX_REGISTROS) {
                UILogic.mostrarToast('Límite de registros alcanzado', 'error');
                throw new Error('Límite alcanzado');
            }

            const nuevoId = S.generarIDSeguro();
            const t = calcularHoras(entrada, salida, null);

            registros.push({
                id: nuevoId,
                fecha: fecha,
                entrada: entrada,
                salida: salida,
                tiempoFuera: null,
                horas: t?.horas || 0,
                minutos: t?.minutos || 0,
                total: t?.total || 0
            });

            ordenarRegistros();

            HistoryManager.saveState(registros);
            const saved = await guardarYActualizar(nuevoId);

            if (saved) {
                UILogic.mostrarToast(`Registro agregado como ${tipoTexto}`, 'success');
            } else {
                throw new Error('Error al guardar');
            }
        }


        async function guardarYActualizar(idNuevo = null, animarCard = false) {
            let saveSuccessful = false;

            try {
                if (window.PerfilManager) {
                    saveSuccessful = PerfilManager.guardarDatosPerfilActual();
                } else {
                    saveSuccessful = true;
                }
            } catch (e) {
                console.error('Error crítico al guardar:', e);
                saveSuccessful = false;
            }

            if (saveSuccessful) {
                UILogic.actualizarUI(idNuevo, false, animarCard);
            } else {
                UILogic.mostrarToast('Error al guardar. Almacenamiento lleno o bloqueado.', 'error');
            }
            return saveSuccessful;
        }

        function cargarConfiguracion() {
            try {
                let d = JSON.parse(localStorage.getItem('diasHabiles'));
                const hd = parseFloat(localStorage.getItem('horasDiarias'));

                const diasFinal = Array.isArray(d) ? d : [1, 2, 3, 4, 5];

                let t = localStorage.getItem('temaOscuro') === 'true';
                if (localStorage.getItem('temaOscuro') === null) t = true;
                const v = localStorage.getItem('vistaActual');

                const horasFinal = (!isNaN(hd) && Number.isFinite(hd) && hd >= 0 && hd <= 24) ? hd : 7;

                return {
                    diasHabiles: diasFinal,
                    horasDiarias: horasFinal,
                    temaOscuro: t,
                    vistaActual: (v === 'semana' || v === 'diaria') ? v : 'diaria',
                    ignorarTiempoFuera: localStorage.getItem(window.PerfilManager ? PerfilManager.perfilKey('ignorarTiempoFuera') : 'ignorarTiempoFuera_default') === 'true',
                    modoEstadisticas: localStorage.getItem('modoEstadisticas') || 'mensual',
                    fondoCard: localStorage.getItem(window.PerfilManager ? PerfilManager.perfilKey('fondoCard') : 'fondoCard_default') || 'golden-gate'
                };
            } catch (e) {
                console.error('Error config:', e);
                return { diasHabiles: [1, 2, 3, 4, 5], horasDiarias: 7, temaOscuro: true, vistaActual: 'diaria' };
            }
        }

        function tiempoEnMinutos(h) {
            if (!h || !h.includes(':')) return 0;
            const [hr, mn] = h.split(':').map(Number);
            return (hr * 60) + mn;
        }

        function calcularHoras(e, s, tf = null, cr = null, esCalculoTemporal = false) {
            const tfEfectivo = ignorarTiempoFuera ? null : tf;
            const tfMinutos = tfEfectivo ? tiempoEnMinutos(tfEfectivo) : 0;
            const crMinutos = cr ? tiempoEnMinutos(cr) : 0;

            if (!esCalculoTemporal) {
                const tipoEspecial = TiposRegistro.obtenerTipoPorCodigo(e, s);
                if (tipoEspecial) {
                    const resultado = { horas: 0, minutos: 0, total: horasDiarias };
                    resultado[`es${tipoEspecial.label}`] = true;
                    return resultado;
                }
            }

            if (!e || !s || !e.includes(':') || !s.includes(':')) return null;

            const [hE, mE] = e.split(':').map(Number);
            const [hS, mS] = s.split(':').map(Number);

            if (!Number.isFinite(hE) || !Number.isFinite(mE) || !Number.isFinite(hS) || !Number.isFinite(mS)) {
                return null;
            }

            const minutosEntrada = hE * 60 + mE;
            const minutosSalida = hS * 60 + mS;

            let minTotal = minutosSalida - minutosEntrada;
            if (minTotal < 0) minTotal += 24 * 60;

            let minNeto = (minTotal - tfMinutos) + crMinutos;

            if (minNeto < 0) minNeto = 0;

            return { horas: Math.floor(minNeto / 60), minutos: minNeto % 60, total: minNeto / 60 };
        }

        function calcularHorasFeriadoEnRango(inicio, fin) {
            const horasDiariasLocal = horasDiarias;
            const diasHabilesConfig = diasHabiles;
            let horasDescontar = 0;

            registros.forEach(r => {
                const tipoEspecial = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);

                if (r.fecha >= inicio && r.fecha <= fin && tipoEspecial) {
                    if (tipoEspecial.id === 'remoto') {
                        return;
                    }

                    const fechaObj = S.parsearFechaLocal(r.fecha);
                    const diaSemana = fechaObj.getDay();

                    if (diasHabilesConfig.includes(diaSemana)) {
                        horasDescontar += horasDiariasLocal;
                    }
                }
            });
            return horasDescontar;
        }

        function validarFormulario() {
            let valido = true;
            const fecha = $('fecha').value;
            const entrada = $('entrada').value.trim();
            const salida = $('salida').value.trim();

            UILogic.limpiarError('fecha', 'error-fecha');
            UILogic.limpiarError('entrada', 'error-entrada');
            UILogic.limpiarError('salida', 'error-salida');

            if (!fecha || !S.validarFechaSegura(fecha)) {
                UILogic.mostrarError('fecha', 'error-fecha');
                valido = false;
            }
            if (entrada && !S.validarHoraSegura(entrada)) {
                UILogic.mostrarError('entrada', 'error-entrada');
                valido = false;
            }
            if (salida && !S.validarHoraSegura(salida)) {
                UILogic.mostrarError('salida', 'error-salida');
                valido = false;
            }
            return valido;
        }

        async function agregarRegistro() {
            if (!validarFormulario()) {
                UILogic.mostrarToast('Verifica los campos', 'error');
                return;
            }

            const btn = $('btn-agregar');
            btn.disabled = true;
            let usaHoraActual = false;

            let f = S.sanitizeString($('fecha').value, 10);
            let e = S.sanitizeString($('entrada').value.trim(), 5);
            let s = S.sanitizeString($('salida').value.trim(), 5);

            if (!e) {
                const { ayerStr: ayer, ayerAbierto } = detectarAyerAbierto(UILogic.obtenerFechaHoy(), registros);
                const regHoy = registros.find(r => r.fecha === f);

                if (ayerAbierto && !regHoy) {
                    f = ayer;
                    $('fecha').value = f;
                }
            }

            let registroExistente = registros.find(r => r.fecha === f);

            if (!e && !s) {
                const now = new Date();
                const h = String(now.getHours()).padStart(2, '0');
                const m = String(now.getMinutes()).padStart(2, '0');
                const horaActual = `${h}:${m}`;

                if (registroExistente && registroExistente.entrada && !registroExistente.salida) {
                    s = horaActual;
                    $('salida').value = s;
                    usaHoraActual = true;
                } else {
                    e = horaActual;
                    $('entrada').value = e;
                    usaHoraActual = true;
                }
            }

            if (!e && s) {
                if (!registroExistente) {
                    UILogic.resetearBoton(btn);
                    UILogic.mostrarToast('Debes fichar una entrada primero', 'error');
                    return;
                }

                if (registroExistente.salida) {
                    UILogic.resetearBoton(btn);
                    UILogic.mostrarToast('Ya existe un registro completo para esta fecha', 'error');
                    return;
                }

                if (!registroExistente.entrada) {
                    UILogic.resetearBoton(btn);
                    UILogic.mostrarToast('Debes fichar una entrada primero', 'error');
                    return;
                }
            }

            if (registroExistente && !e && s && registroExistente.entrada && !registroExistente.salida) {
                const timerDetenido = detenerYRegistrarTimer(registroExistente);

                registroExistente.salida = s;
                let t = calcularHoras(registroExistente.entrada, s, registroExistente.tiempoFuera || null);
                registroExistente.horas = t?.horas || 0;
                registroExistente.minutos = t?.minutos || 0;
                registroExistente.total = t?.total || 0;

                HistoryManager.saveState(registros);

                const saved = await guardarYActualizar(registroExistente.id);
                if (saved) {
                    const salidaManual = !usaHoraActual;
                    if (salidaManual) {
                        UILogic.aplicarFeedbackCampos([
                            { id: 'entrada', fallback: 'Entrada', mostrar: false },
                            { id: 'salida', fallback: 'Salida', mostrar: true }
                        ]);
                    }

                    let mensaje;
                    if (timerDetenido && usaHoraActual) {
                        const tiempoFuera = registroExistente.tiempoFuera || '00:00';
                        mensaje = `Salida registrada con hora actual \nDescanso finalizado: +${tiempoFuera} \n(entrada: ${registroExistente.entrada})`;
                    } else if (usaHoraActual) {
                        mensaje = `Salida registrada con hora actual \n(entrada: ${registroExistente.entrada})`;
                    } else {
                        mensaje = `Salida ${s} agregada \n(entrada: ${registroExistente.entrada})`;
                    }

                    UILogic.mostrarToast(mensaje, 'success');
                    UILogic.resetearBoton(btn);
                    $('fecha').value = UILogic.obtenerFechaHoy();
                    $('salida').value = '';
                }
                return;
            }

            if (registroExistente) {
                UILogic.resetearBoton(btn);
                if (usaHoraActual) {
                    $('entrada').value = '';
                }
                UILogic.mostrarToast('Ya existe un registro para esta fecha', 'error');
                return;
            }

            if (registros.length >= S.SECURITY_LIMITS.MAX_REGISTROS) {
                UILogic.resetearBoton(btn);
                UILogic.mostrarToast('Límite alcanzado', 'error');
                return;
            }

            const nuevoId = S.generarIDSeguro();

            const t = calcularHoras(e || null, s || null, null);
            registros.push({
                id: nuevoId,
                fecha: f,
                entrada: e || null,
                salida: s || null,
                tiempoFuera: null,
                horas: t?.horas || 0,
                minutos: t?.minutos || 0,
                total: t?.total || 0
            });

            ordenarRegistros();

            HistoryManager.saveState(registros);

            const saved = await guardarYActualizar(nuevoId);

            if (saved) {
                const entradaManual = e && !usaHoraActual;
                const salidaManual = s && !usaHoraActual;

                if (entradaManual || salidaManual) {
                    UILogic.aplicarFeedbackCampos([
                        { id: 'entrada', fallback: 'Entrada', mostrar: entradaManual },
                        { id: 'salida', fallback: 'Salida', mostrar: salidaManual }
                    ]);
                }

                const mensaje = usaHoraActual ? 'Registro agregado con hora actual' : 'Registro agregado';
                UILogic.mostrarToast(mensaje, 'success');
                UILogic.resetearBoton(btn);
                $('fecha').value = UILogic.obtenerFechaHoy();
                $('entrada').value = '';
                $('salida').value = '';
            }

        }

        async function eliminarRegistroActual() {
            if (editandoId) {
                const modal = $('modal-editar');
                const btnEliminar = modal.querySelector('.btn-delete');
                btnEliminar.disabled = true;
                const registroABorrar = registros.find(r => r.id === editandoId);
                const hoy = UILogic.obtenerFechaHoy();

                if (registroABorrar && registroABorrar.fecha === hoy) {
                    const perfilId = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';
                    const storageKey = `breakStartTime_${perfilId}`;
                    if (localStorage.getItem(storageKey)) {
                        localStorage.removeItem(storageKey);
                        UILogic.mostrarToast('Timer detenido al borrar el registro', 'info');
                    }
                }

                registros = registros.filter(r => r.id !== editandoId);
                HistoryManager.saveState(registros);

                const saved = await guardarYActualizar();
                btnEliminar.disabled = false;
                btnEliminar.innerHTML = '<svg class="icon"><use href="#icon-trash"/></svg> Eliminar';

                if (saved) {
                    UILogic.mostrarToast('Registro eliminado', 'success');
                    UILogic.cerrarEdicion();
                    UILogic.actualizarEstadoBotonTimerMain();

                    if (window.UILogic && window.UILogic.actualizarBotonLote) {
                        window.UILogic.actualizarBotonLote();
                    }
                }
            }
        }

        function editarRegistro(id) {
            if (editandoId !== null) return;
            const r = registros.find(x => x.id === id);
            if (!r) return;

            editandoId = id;
            $('edit-fecha').value = r.fecha;
            $('edit-entrada').value = r.entrada || '';
            $('edit-salida').value = r.salida || '';
            $('edit-tiempo-fuera').value = r.tiempoFuera || '';
            $('edit-notas').value = r.notas || '';

            const btnCredito = document.getElementById('btn-toggle-credito');

            btnCredito.style.background = '';
            btnCredito.style.color = '';
            btnCredito.style.border = '';

            if (r.credito && r.credito !== '00:00') {
                btnCredito.dataset.activo = "true";
                btnCredito.classList.add('btn-activo');
            } else {
                btnCredito.dataset.activo = "false";
                btnCredito.classList.remove('btn-activo');
            }

            ModalManager.abrir('modal-editar');

            UILogic.setBloqueoEdicion(true);

            requestAnimationFrame(() => {
                UILogic.verificarBloqueoCredito();
                const hintEl = document.getElementById('edit-hint-resumen');
                if (hintEl) hintEl.dispatchEvent ?
                    document.getElementById('edit-entrada').dispatchEvent(new Event('input')) : null;
            });
        }

        async function guardarEdicion() {
            const r = registros.find(x => x.id === editandoId);
            if (!r) return;

            const modal = $('modal-editar');
            const btnGuardar = modal.querySelector('.btn-edit');
            btnGuardar.disabled = true;

            const f = S.sanitizeString($('edit-fecha').value, 10);
            const e = S.sanitizeString($('edit-entrada').value.trim(), 5);
            const s = S.sanitizeString($('edit-salida').value.trim(), 5);

            let tf = S.sanitizeString($('edit-tiempo-fuera').value.trim(), 5);
            if (tf === '') tf = null;

            let notas = S.sanitizeString($('edit-notas').value.trim(), S.SECURITY_LIMITS.MAX_NOTAS_LENGTH);
            if (notas) notas = S.sanitizeNotas(notas, true) || null;
            if (notas === '') notas = null;

            let cr = null;
            const btnCredito = document.getElementById('btn-toggle-credito');

            if (btnCredito && btnCredito.dataset.activo === "true") {
                const calcTemp = calcularHoras(e, s, tf, null);

                if (calcTemp) {
                    const horasTrabajadas = calcTemp.total;
                    const horasObjetivo = horasDiarias;

                    const diferencia = horasObjetivo - horasTrabajadas;

                    if (diferencia > 0.01) {
                        let h = Math.floor(diferencia);
                        let m = Math.round((diferencia - h) * 60);
                        if (m === 60) { h++; m = 0; }
                        cr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    }
                }
            }
            const hoy = UILogic.obtenerFechaHoy();
            if (f > hoy) {
                const esEspecial = TiposRegistro.esRegistroEspecial(e, s);

                if (!esEspecial) {
                    UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                    UILogic.mostrarToast('Fecha futura no permitida en registro regular', 'warning');
                    return;
                }
            }

            const actualEntrada = r.entrada || '';
            const nuevaEntrada = e || '';
            const actualSalida = r.salida || '';
            const nuevaSalida = s || '';
            const actualTF = r.tiempoFuera || '';
            const nuevoTF = tf || '';
            const actualCR = r.credito || '';
            const nuevoCR = cr || '';
            const actualNotas = r.notas || '';
            const nuevasNotas = notas || '';

            if (r.fecha === f &&
                actualEntrada === nuevaEntrada &&
                actualSalida === nuevaSalida &&
                actualTF === nuevoTF &&
                actualCR === nuevoCR &&
                actualNotas === nuevasNotas) {

                UILogic.mostrarToast('Sin cambios', 'info');
                UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                UILogic.cerrarEdicion();
                return;
            }

            if (!S.validarFechaSegura(f)) {
                UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                UILogic.mostrarToast('Fecha inválida', 'error');
                return;
            }

            if (e && !S.validarHoraSegura(e)) {
                UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                UILogic.mostrarToast('Hora de entrada inválida', 'error');
                return;
            }

            if (s && !S.validarHoraSegura(s)) {
                UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                UILogic.mostrarToast('Hora de salida inválida', 'error');
                return;
            }

            if (tf && !S.validarHoraSegura(tf)) {
                UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                UILogic.mostrarToast('Tiempo fuera inválido', 'error');
                return;
            }

            if (!e && s) {
                UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                UILogic.mostrarToast('Debes fichar una entrada', 'error');
                return;
            }

            if (!e && !s) {
                const registroABorrar = registros.find(r => r.id === editandoId);
                if (registroABorrar && registroABorrar.fecha === UILogic.obtenerFechaHoy()) {
                    const perfilId = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';
                    const storageKey = `breakStartTime_${perfilId}`;
                    localStorage.removeItem(storageKey);
                    UILogic.actualizarEstadoBotonTimerMain();
                }
                registros = registros.filter(r => r.id !== editandoId);
                HistoryManager.saveState(registros);
                const saved = await guardarYActualizar();
                if (saved) {
                    UILogic.mostrarToast('Registro eliminado (vacío)', 'info');
                    UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                    UILogic.cerrarEdicion();
                } else {
                    UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                }
                return;
            }

            const existeFecha = registros.some(reg => reg.fecha === f && reg.id !== editandoId);
            if (existeFecha) {
                UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                UILogic.mostrarToast('Ya existe otro registro para esa fecha', 'error');
                return;
            }

            if (e && s && tf) {
                const [hE, mE] = e.split(':').map(Number);
                const [hS, mS] = s.split(':').map(Number);
                const [hF, mF] = tf.split(':').map(Number);

                const minutosEntrada = hE * 60 + mE;
                const minutosSalida = hS * 60 + mS;
                const minutosFuera = hF * 60 + mF;

                let tiempoTranscurrido = minutosSalida - minutosEntrada;
                if (tiempoTranscurrido < 0) tiempoTranscurrido += 24 * 60;

                if (minutosFuera > tiempoTranscurrido) {
                    UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                    UILogic.mostrarToast('El tiempo fuera no puede superar el tiempo trabajado', 'error');
                    return;
                }
            }

            r.fecha = f;
            r.entrada = e || null;

            if (s && !actualSalida) {
                const timerDetenido = detenerYRegistrarTimer(r);
                if (timerDetenido) tf = r.tiempoFuera;
            }

            r.salida = s || null;
            r.tiempoFuera = tf;
            r.credito = cr;
            r.notas = notas;

            const t = calcularHoras(r.entrada, r.salida, r.tiempoFuera, r.credito);

            r.horas = t?.horas || 0;
            r.minutos = t?.minutos || 0;
            r.total = t?.total || 0;

            ordenarRegistros();

            HistoryManager.saveState(registros);

            const saved = await guardarYActualizar(null, true);

            if (saved) {
                if (cr) {
                    UILogic.mostrarToast(`Guardado con Salida Temprano (+${cr})`, 'success');
                } else {
                    UILogic.mostrarToast('Registro actualizado', 'success');
                }
                UILogic.restaurarBotonGuardarEdicion(btnGuardar);
                UILogic.cerrarEdicion();
            } else {
                UILogic.restaurarBotonGuardarEdicion(btnGuardar);
            }
        }


        async function borrarTodoHistorial() {
            const totalRegistros = registros.length;

            const confirmar = await confirmarModal(`Esto restablecerá el perfil activo: se eliminarán ${totalRegistros} registro${totalRegistros !== 1 ? 's' : ''} y la configuración volverá a los valores por defecto. No afecta otros perfiles.`, 'Restablecer');

            if (!confirmar) return;

            const perfilId = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';

            diasHabiles = [1, 2, 3, 4, 5];
            horasDiarias = 7;
            registros.splice(0, registros.length);
            ignorarTiempoFuera = false;

            localStorage.removeItem(`breakStartTime_${perfilId}`);
            localStorage.removeItem(`history_${perfilId}`);
            localStorage.removeItem(`fondoCard_${perfilId}`);
            localStorage.removeItem(`ignorarTiempoFuera_${perfilId}`);
            localStorage.removeItem(`cardVisible_registrar_${perfilId}`);
            localStorage.removeItem(`cardVisible_estadisticas_${perfilId}`);
            localStorage.removeItem(`cardVisible_historico_${perfilId}`);
            localStorage.removeItem(`ordenCards_${perfilId}`);

            if (window.PerfilManager) {
                const perfil = PerfilManager.obtenerDatosPerfil();
                if (perfil) {
                    delete perfil.gistId;
                    delete perfil.gistLastSync;
                    delete perfil.gistAutoSync;
                    delete perfil.gistRangoDesde;
                    delete perfil.gistRangoHasta;
                    delete perfil.gistSyncFecha_subir;
                    delete perfil.gistSyncCount_subir;
                    delete perfil.gistSyncFecha_bajar;
                    delete perfil.gistSyncCount_bajar;
                    delete perfil.gistMergeBehavior;
                }
            }

            HistoryManager.saveState(registros);

            if (await guardarYActualizar()) {
                location.reload();
            }
        }

        function normalizarRegistrosImportados(rawList, calcularHorasFn) {
            const validarHora = (h) => h && S.REGEX_PATTERNS.HORA.test(h) ? S.sanitizeString(h, 5) : null;

            const normalizados = rawList
                .filter(r => S.validarRegistroSeguro(r))
                .map(r => ({
                    id: (r.id && S.REGEX_PATTERNS.ID.test(r.id)) ? r.id : S.generarIDSeguro(),
                    fecha: S.sanitizeString(r.fecha, 10),
                    entrada: validarHora(r.entrada),
                    salida: validarHora(r.salida),
                    tiempoFuera: validarHora(r.tiempoFuera),
                    horas: Math.max(0, Math.min(24, parseFloat(r.horas) || 0)),
                    minutos: Math.max(0, Math.min(59, parseFloat(r.minutos) || 0)),
                    total: Math.max(0, Math.min(24, parseFloat(r.total) || 0)),
                    credito: validarHora(r.credito),
                    notas: (r.notas && typeof r.notas === 'string')
                        ? S.sanitizeString(r.notas, S.SECURITY_LIMITS.MAX_NOTAS_LENGTH) || null
                        : null,
                }));

            normalizados.forEach(r => {
                const t = calcularHorasFn(r.entrada, r.salida, r.tiempoFuera || null, r.credito || null);
                r.horas = t?.horas || 0;
                r.minutos = t?.minutos || 0;
                r.total = t?.total || 0;
            });

            return normalizados;
        }

        async function exportarJSON() {
            const data = {
                registros,
                diasHabiles,
                horasDiarias,
                fecha: S.fechaLocalISO(),
                version: S.SECURITY_LIMITS.SCHEMA_VERSION,
                hash: await S.calcularHashSHA256(registros),
                timestamp: Date.now()
            };

            try {
                const nombreSafe = window.UILogic.obtenerNombrePerfilSafe();
                const fechaHoy = S.fechaLocalISO().slice(0, 10);
                window.UILogic.descargarJSON(data, `Horarios_${nombreSafe}_${fechaHoy}.json`);
                window.UILogic.mostrarToast('Datos exportados', 'success');
                ModalManager.cerrarTodos();
            } catch (e) {
                console.error(e);
                UILogic.mostrarToast('Error al exportar', 'error');
            }
        }

        function importarDatos(modo = 'replace') {
            const fileInput = $('file-import');
            const file = fileInput.files[0];

            if (!file) {
                UILogic.mostrarToast('Selecciona un archivo primero', 'error');
                return;
            }
            if (file.size > S.SECURITY_LIMITS.MAX_JSON_SIZE) {
                UILogic.mostrarToast('Archivo muy grande', 'error');
                return;
            }

            if (!file.type || file.type !== 'application/json') {
                UILogic.mostrarToast('Solo se permiten archivos JSON', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const contenido = e.target.result;
                    if (!contenido || contenido.trim().length === 0) {
                        UILogic.mostrarToast('Archivo vacío', 'error');
                        return;
                    }

                    if (contenido.length > S.SECURITY_LIMITS.MAX_JSON_SIZE) {
                        UILogic.mostrarToast('Contenido del archivo demasiado grande', 'error');
                        return;
                    }

                    const data = JSON.parse(contenido, (key, value) => {
                        if (['__proto__', 'constructor', 'prototype'].includes(key)) {
                            console.warn('⚠️ Intento de prototype pollution bloqueado');
                            return undefined;
                        }
                        return value;
                    });

                    const allowedRootKeys = [
                        'registros',
                        'diasHabiles',
                        'horasDiarias',
                        'fecha',
                        'version',
                        'hash',
                        'timestamp',
                        'rangoExportado'
                    ];
                    const dataKeys = Object.keys(data);
                    const hasInvalidKeys = dataKeys.some(k => !allowedRootKeys.includes(k));

                    if (hasInvalidKeys) {
                        UILogic.mostrarToast('Archivo con estructura sospechosa', 'error');
                        return;
                    }

                    if (!data || typeof data !== 'object' || Array.isArray(data)) {
                        UILogic.mostrarToast('Estructura de archivo inválida', 'error');
                        return;
                    }

                    if (!data.registros || !Array.isArray(data.registros)) {
                        UILogic.mostrarToast('Archivo inválido o corrupto', 'error');
                        return;
                    }

                    if (data.version && data.version > S.SECURITY_LIMITS.SCHEMA_VERSION) {
                        console.warn(`⚠️ Archivo exportado con schema v${data.version}, app en v${S.SECURITY_LIMITS.SCHEMA_VERSION}`);
                        UILogic.mostrarToast(`Archivo de versión más nueva (v${data.version}). Algunos datos pueden no importarse correctamente.`, 'warning');
                    }

                    if (data.rangoExportado !== undefined) {
                        const rangoSafe = S.sanitizeString(String(data.rangoExportado), 100);

                        const regexRangoSeguro = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-:]+$/;
                        if (!regexRangoSeguro.test(rangoSafe)) {
                            UILogic.mostrarToast('Metadatos de rango inválidos', 'error');
                            return;
                        }

                        if (rangoSafe.includes('Mes')) {
                            const mesMatch = rangoSafe.match(/(\d{4}-\d{2})/);
                            if (mesMatch && data.registros.length > 0) {
                                const mesEsperado = mesMatch[1];
                                const todosDelMes = data.registros.every(r =>
                                    r.fecha && r.fecha.startsWith(mesEsperado)
                                );
                                if (!todosDelMes) {
                                    console.warn('⚠️ Advertencia: Registros no coinciden con el rango declarado');
                                }
                            }
                        }
                    }

                    if (data.hash) {
                        const hashCalculado = await S.calcularHashSHA256(data.registros);
                        if (hashCalculado !== data.hash) {
                            UILogic.mostrarToast('⚠️ El archivo puede estar corrupto o modificado', 'warning');
                            const continuar = await confirmarModal('El hash de integridad no coincide. El archivo puede haber sido modificado o corrompido. ¿Restaurar de todas formas?', 'Restaurar', '#icon-upload');
                            if (!continuar) return;
                        }
                    } else {
                        const continuar = await confirmarModal('Este archivo no tiene verificación de integridad. Puede ser un backup antiguo o haber sido modificado externamente. ¿Restaurar de todas formas?', 'Restaurar', '#icon-upload');
                        if (!continuar) return;
                    }

                    if (data.registros.length > S.SECURITY_LIMITS.MAX_REGISTROS) {
                        UILogic.mostrarToast(`Máximo ${S.SECURITY_LIMITS.MAX_REGISTROS} registros permitidos`, 'error');
                        return;
                    }

                    const registrosImportados = normalizarRegistrosImportados(data.registros, calcularHoras);

                    if (registrosImportados.length === 0) {
                        UILogic.mostrarToast('No se encontraron registros válidos', 'warning');
                        return;
                    }

                    if (modo === 'replace') {
                        registros = registrosImportados;

                        if (Array.isArray(data.diasHabiles)) {
                            const diasValidos = data.diasHabiles.filter(d =>
                                Number.isInteger(d) && d >= 0 && d <= 6
                            );
                            if (diasValidos.length > 0) diasHabiles = diasValidos;
                        }

                        if (data.horasDiarias !== undefined) {
                            const horasParsed = typeof data.horasDiarias === 'string'
                                ? parseFloat(data.horasDiarias)
                                : data.horasDiarias;

                            if (Number.isFinite(horasParsed) && horasParsed >= 0 && horasParsed <= 24) {
                                horasDiarias = horasParsed;
                            }
                        }

                        const mensaje = registrosImportados.length === 1
                            ? 'Se reemplazaron los datos por 1 registro'
                            : `Se reemplazaron los datos por ${registrosImportados.length} registros`;

                        finalizarImportacionAndSave(mensaje);
                    }

                    else if (modo === 'merge') {
                        const fechasExistentes = new Set(registros.map(r => r.fecha));
                        const nuevos = registrosImportados.filter(imp => !fechasExistentes.has(imp.fecha));

                        const complementarios = registrosImportados.filter(imp => {
                            if (!fechasExistentes.has(imp.fecha)) return false;
                            const local = registros.find(r => r.fecha === imp.fecha);
                            if (!local) return false;
                            const aportaSalida = !local.salida && imp.salida;
                            const aportaTF = !local.tiempoFuera && imp.tiempoFuera;
                            return aportaSalida || aportaTF;
                        });

                        if (nuevos.length === 0 && complementarios.length === 0) {
                            UILogic.mostrarToast('No hay días nuevos ni datos para completar', 'info');
                            return;
                        }

                        if (registros.length + nuevos.length > S.SECURITY_LIMITS.MAX_REGISTROS) {
                            UILogic.mostrarToast(`Límite alcanzado. Solo se pueden agregar ${S.SECURITY_LIMITS.MAX_REGISTROS - registros.length} registros más`, 'error');
                            return;
                        }

                        complementarios.forEach(imp => {
                            const local = registros.find(r => r.fecha === imp.fecha);
                            if (!local) return;
                            if (!local.salida && imp.salida) local.salida = imp.salida;
                            if (!local.tiempoFuera && imp.tiempoFuera) local.tiempoFuera = imp.tiempoFuera;
                            const t = calcularHoras(local.entrada, local.salida, local.tiempoFuera || null, local.credito || null);
                            if (t) { local.horas = t.horas; local.minutos = t.minutos; local.total = t.total; }
                        });

                        registros = registros.concat(nuevos);

                        const partes = [];
                        if (nuevos.length > 0) partes.push(`${nuevos.length} día${nuevos.length !== 1 ? 's' : ''} nuevo${nuevos.length !== 1 ? 's' : ''}`);
                        if (complementarios.length > 0) partes.push(`${complementarios.length} registro${complementarios.length !== 1 ? 's' : ''} completado${complementarios.length !== 1 ? 's' : ''}`);
                        finalizarImportacionAndSave(`Combinado: ${partes.join(', ')}`);
                    }

                } catch (err) {
                    console.error('Error en importación:', err);
                    if (err instanceof SyntaxError) {
                        UILogic.mostrarToast('Archivo JSON mal formado', 'error');
                    } else {
                        UILogic.mostrarToast('Error al procesar el archivo', 'error');
                    }
                }
            };

            reader.onerror = () => {
                UILogic.mostrarToast('Error al leer el archivo', 'error');
            };

            reader.readAsText(file);
        }

        async function finalizarImportacionAndSave(mensajeExito) {
            ordenarRegistros();

            HistoryManager.saveState(registros);

            if (await guardarYActualizar()) {
                try {

                    const esPerfilDefault = window.PerfilManager && PerfilManager.obtenerPerfilActual() === 'default';

                    if (esPerfilDefault) {
                        localStorage.setItem('diasHabiles', JSON.stringify(diasHabiles));
                        localStorage.setItem('horasDiarias', horasDiarias);
                    }
                } catch (ex) {
                    console.error('Error guardando configuración:', ex);
                    UILogic.mostrarToast('Datos importados pero ajustes no guardados', 'warning');
                }

                UILogic.mostrarToast(mensajeExito, 'success');
                UILogic.cerrarImportar();
                $('file-import').value = '';
            }
        }

        function detenerYRegistrarTimer(registro) {
            const perfilId = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';
            const storageKey = `breakStartTime_${perfilId}`;
            const storedStart = localStorage.getItem(storageKey);

            if (!storedStart) return false;

            const start = parseInt(storedStart);
            const end = Date.now();
            const diffMs = end - start;
            const segundosTranscurridos = Math.floor(diffMs / 1000);

            if (segundosTranscurridos < 30) {
                localStorage.removeItem(storageKey);
                return false;
            }

            let minutosTranscurridos = Math.floor(segundosTranscurridos / 60);
            const segundosRestantes = segundosTranscurridos % 60;
            if (segundosRestantes >= 30) minutosTranscurridos += 1;

            const tiempoActual = registro.tiempoFuera || '00:00';
            registro.tiempoFuera = UILogic.sumarMinutosAHora(tiempoActual, minutosTranscurridos);

            localStorage.removeItem(storageKey);

            return true;
        }

        function detectarAyerAbierto(fechaHoy, regs) {
            const ayerObj = S.parsearFechaLocal(fechaHoy);
            ayerObj.setDate(ayerObj.getDate() - 1);
            const ayerStr = S.formatearFechaLocal(ayerObj);

            const regAyer = regs instanceof Map
                ? (regs.get(ayerStr) ?? null)
                : (regs.find(r => r.fecha === ayerStr) ?? null);

            let ayerAbierto = false;
            if (regAyer?.entrada && !regAyer.salida) {
                const [hE, mE] = regAyer.entrada.split(':').map(Number);
                const fechaEntrada = S.parsearFechaLocal(ayerStr);
                fechaEntrada.setHours(hE, mE, 0, 0);
                ayerAbierto = (Date.now() - fechaEntrada.getTime()) <= 86400000;
            }

            return { ayerStr, regAyer, ayerAbierto };
        }

        function calcularBufferSemanal(inicioSemana, fechaHoy) {
            const horasDiariasLocal = horasDiarias;
            let buffer = 0;

            const registrosRango = registros.filter(r => r.fecha >= inicioSemana && r.fecha <= fechaHoy);
            const registrosMap = new Map(registrosRango.map(r => [r.fecha, r]));

            let fechaIteracion = S.parsearFechaLocal(inicioSemana);
            let fechaLimite = S.parsearFechaLocal(fechaHoy);

            const { ayerStr, ayerAbierto } = detectarAyerAbierto(fechaHoy, registrosMap);

            while (fechaIteracion <= fechaLimite) {
                const y = fechaIteracion.getFullYear();
                const m = String(fechaIteracion.getMonth() + 1).padStart(2, '0');
                const d = String(fechaIteracion.getDate()).padStart(2, '0');
                const isoDate = `${y}-${m}-${d}`;
                const numDia = fechaIteracion.getDay();
                const esDiaLaboralConfigurado = diasHabiles.includes(numDia);
                const r = registrosMap.get(isoDate);
                let horasObjetivoDia = 0;
                let horasHechasDia = 0;
                const esEspecial = r && TiposRegistro.esRegistroEspecial(r.entrada, r.salida);
                const tieneSalida = r && r.salida && !esEspecial;
                const esRemoto = esEspecial && TiposRegistro.obtenerTipoPorCodigo(r?.entrada, r?.salida)?.id === 'remoto';

                let diaTerminado = false;
                if (isoDate === fechaHoy) {
                    diaTerminado = tieneSalida;
                } else if (ayerAbierto && isoDate === ayerStr) {
                    diaTerminado = false;
                } else {
                    diaTerminado = true;
                }

                if (esRemoto) {
                    if (esDiaLaboralConfigurado) horasObjetivoDia = horasDiariasLocal;
                    horasHechasDia = horasDiariasLocal;
                } else {
                    if (esDiaLaboralConfigurado && !esEspecial) {
                        if (diaTerminado) {
                            horasObjetivoDia = horasDiariasLocal;
                        }
                    }
                    if (r && !esEspecial && r.salida) {
                        horasHechasDia = r.total;
                    }
                }

                buffer += (horasHechasDia - horasObjetivoDia);
                fechaIteracion.setDate(fechaIteracion.getDate() + 1);
            }
            return buffer;
        }

        function limpiarFiltros() {
            filtroActivo = false;
            filtroDesde = null;
            filtroHasta = null;
            filtroTipo = null;
            $('filtro-fecha-desde').value = '';
            $('filtro-fecha-hasta').value = '';
            $('filtro-tipo').value = '';

            guardarYActualizar();
            UILogic.cerrarFiltros();
            UILogic.mostrarToast('Filtro eliminado', 'info');
            document.getElementById('btn-filtro').classList.remove('filtro-activo');
        }

        function aplicarFiltrosInmediato(desde, hasta, tipo) {
            if (!desde && !hasta && !tipo) {
                filtroActivo = false;
                filtroDesde = null;
                filtroHasta = null;
                filtroTipo = null;
                document.getElementById('btn-filtro').classList.remove('filtro-activo');
            } else {
                filtroActivo = true;
                filtroDesde = desde || null;
                filtroHasta = hasta || null;
                filtroTipo = tipo || null;
                document.getElementById('btn-filtro').classList.add('filtro-activo');
            }
            guardarYActualizar();
        }

        function obtenerRegistrosFiltrados() {
            if (!filtroActivo) return registros;

            return registros.filter(r => {
                if (filtroDesde && r.fecha < filtroDesde) return false;
                if (filtroHasta && r.fecha > filtroHasta) return false;

                if (filtroTipo) {
                    const tipoRegistro = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);

                    if (filtroTipo === 'normal') {
                        if (tipoRegistro) return false;
                    } else {
                        if (!tipoRegistro || tipoRegistro.id !== filtroTipo) return false;
                    }
                }

                return true;
            });
        }

        async function registrarVacacionesDirecto(desde, hasta, tipo) {
            const tipoConfig = TiposRegistro.obtenerTipoPorId(tipo);
            if (!tipoConfig) {
                UILogic.mostrarToast('Tipo inválido', 'error');
                throw new Error('Tipo inválido');
            }

            const entrada = tipoConfig.codigo;
            const salida = tipoConfig.codigo;

            let fechaActual = S.parsearFechaLocal(desde);
            const fechaFin = S.parsearFechaLocal(hasta);
            const fechasARegistrar = [];

            while (fechaActual <= fechaFin) {
                const y = fechaActual.getFullYear();
                const m = String(fechaActual.getMonth() + 1).padStart(2, '0');
                const d = String(fechaActual.getDate()).padStart(2, '0');
                fechasARegistrar.push(`${y}-${m}-${d}`);
                fechaActual.setDate(fechaActual.getDate() + 1);
            }

            if (fechasARegistrar.length > 60) {
                UILogic.mostrarToast(`El rango seleccionado contiene ${fechasARegistrar.length} días.\n Máximo permitido: 60 días por operación.`, 'error');
                throw new Error('Límite de días excedido');
            }

            const nuevosRegistros = fechasARegistrar.filter(f => !registros.some(r => r.fecha === f));

            if (nuevosRegistros.length === 0) {
                UILogic.mostrarToast('Todas las fechas ya están registradas', 'warning');
                throw new Error('Sin fechas nuevas');
            }

            const idsNuevosParaAnimar = [];

            nuevosRegistros.forEach(fecha => {
                const t = calcularHoras(entrada, salida, null);
                const nuevoId = S.generarIDSeguro();

                idsNuevosParaAnimar.push(nuevoId);

                registros.push({
                    id: nuevoId,
                    fecha: fecha,
                    entrada: entrada,
                    salida: salida,
                    tiempoFuera: null,
                    horas: t?.horas || 0,
                    minutos: t?.minutos || 0,
                    total: t?.total || 0
                });
            });

            ordenarRegistros();

            HistoryManager.saveState(registros);

            const saved = await guardarYActualizar(idsNuevosParaAnimar);

            if (saved) {
                const mensaje = nuevosRegistros.length === 1
                    ? '1 día registrado'
                    : `${nuevosRegistros.length} días registrados`;
                UILogic.mostrarToast(mensaje, 'success');
                if (UILogic.actualizarBotonLote) {
                    UILogic.actualizarBotonLote();
                }
            } else {
                throw new Error('Error al guardar');
            }
        }

        function _aplicarEstadoHistorial(estado, mensaje) {
            if (!estado) return;
            registros.splice(0, registros.length, ...estado);
            registros.forEach(r => {
                if (r.entrada && r.salida && !TiposRegistro.esRegistroEspecial(r.entrada, r.salida)) {
                    const t = calcularHoras(r.entrada, r.salida, r.tiempoFuera || null, r.credito || null);
                    if (t) { r.horas = t.horas; r.minutos = t.minutos; r.total = t.total; }
                }
            });
            guardarYActualizar(null, true);
            UILogic.mostrarToast(mensaje, 'info');
            if (window.UILogic && window.UILogic.actualizarBotonLote) {
                const modoLote = document.getElementById('modo-lote');
                if (modoLote && getComputedStyle(modoLote).display !== 'none') {
                    window.UILogic.actualizarBotonLote();
                }
            }
            if (window.UILogic && window.UILogic.iniciarTimerAutoCierreBotones) {
                window.UILogic.iniciarTimerAutoCierreBotones();
            }
        }

        async function borrarPeriodoDirecto(desde, hasta) {
            const registrosAEliminar = registros.filter(r => {
                if (r.fecha < desde || r.fecha > hasta) return false;

                const esEspecial = TiposRegistro.esRegistroEspecial(r.entrada, r.salida);

                return !esEspecial;
            });

            if (registrosAEliminar.length > 60) {
                UILogic.mostrarToast(`Máximo 60 registros. Encontrados: ${registrosAEliminar.length}`, 'error');
                throw new Error('Límite excedido');
            }

            if (registrosAEliminar.length === 0) {
                UILogic.mostrarToast('No hay registros de jornadas en ese período', 'info');
                throw new Error('Sin registros');
            }

            registros = registros.filter(r => !registrosAEliminar.includes(r));
            HistoryManager.saveState(registros);

            const saved = await guardarYActualizar();
            if (saved) {
                const mensaje = registrosAEliminar.length === 1
                    ? '1 registro eliminado'
                    : `${registrosAEliminar.length} registros eliminados`;
                UILogic.mostrarToast(mensaje, 'success');
                UILogic.actualizarBotonLote?.();
            } else {
                throw new Error('Error al guardar');
            }
        }

        return {
            registros: () => registros,
            horasSemanales: () => (horasDiarias * diasHabiles.length),
            diasHabiles: () => diasHabiles,
            horasDiarias: () => horasDiarias,
            setDiasHabiles: (v) => diasHabiles = v,
            setHorasDiarias: (v) => horasDiarias = v,
            getIgnorarTiempoFuera: () => ignorarTiempoFuera,
            setIgnorarTiempoFuera: (v) => { ignorarTiempoFuera = v; },
            recalcularTotalesEnMemoria: function () {
                registros.forEach(r => {
                    if (r.entrada && r.salida && !TiposRegistro.esRegistroEspecial(r.entrada, r.salida)) {
                        const t = calcularHoras(r.entrada, r.salida, r.tiempoFuera || null, r.credito || null);
                        if (t) { r.horas = t.horas; r.minutos = t.minutos; r.total = t.total; }
                    }
                });
            },
            editandoId: () => editandoId,
            setEditandoId: (id) => editandoId = id,
            vistaActual: () => vistaActual,
            setVistaActual: (v) => vistaActual = v,
            cargarConfiguracion,
            calcularHoras,
            calcularHorasFeriadoEnRango,
            normalizarRegistrosImportados,
            guardarYActualizar,
            agregarRegistro,
            eliminarRegistroActual,
            editarRegistro,
            guardarEdicion,
            borrarTodoHistorial,
            exportarJSON,
            importarDatos,
            calcularBufferSemanal,
            detectarAyerAbierto,
            aplicarFiltrosInmediato,
            limpiarFiltros,
            obtenerRegistrosFiltrados,
            registrarVacacionesDirecto,
            borrarPeriodoDirecto,
            registrarDiaEspecial,
            editarGrupo,
            guardarEdicionGrupo,
            eliminarGrupoActual,
            setGrupoEnEdicion: (val) => grupoEnEdicion = val,
            undoAction: function () {
                _aplicarEstadoHistorial(HistoryManager.undo(), 'Deshecho');
            },

            redoAction: function () {
                _aplicarEstadoHistorial(HistoryManager.redo(), 'Rehecho');
            }
        };

    })(SecurityAndUtils);

    // ====================================================================
    //                     MÓDULO GIST SYNC
    // ====================================================================
    const GistSync = (function (S) {

        const GIST_FILENAME = 'horarios_backup.json';
        const KEY_TOKEN = 'gistToken';

        const GIST_ID_REGEX = /^[a-f0-9]{20,40}$/i;

        function esGistIdValido(id) {
            return id && GIST_ID_REGEX.test(id.trim());
        }

        function _conPerfil(fn) {
            if (!window.PerfilManager) return;
            const perfil = PerfilManager.obtenerDatosPerfil();
            if (perfil) { fn(perfil); PerfilManager.guardarPerfiles(); }
        }

        function getToken() { return localStorage.getItem(KEY_TOKEN) || ''; }

        function getGistId() {
            const perfil = window.PerfilManager ? PerfilManager.obtenerDatosPerfil() : null;
            return perfil?.gistId || '';
        }

        function getLastSync() {
            const perfil = window.PerfilManager ? PerfilManager.obtenerDatosPerfil() : null;
            return perfil?.gistLastSync || null;
        }

        function getMergeBehavior() {
            const perfil = window.PerfilManager ? PerfilManager.obtenerDatosPerfil() : null;
            return perfil?.gistMergeBehavior || 'replace';
        }

        function setMergeBehavior(valor) {
            _conPerfil(perfil => { perfil.gistMergeBehavior = valor; });
        }

        function getAutoSync() {
            const perfil = window.PerfilManager ? PerfilManager.obtenerDatosPerfil() : null;
            const val = perfil?.gistAutoSync;
            if (val === 1 || val === 2) return val;
            if (val === true) return 1;
            return 0;
        }

        function setAutoSync(valor) {
            _conPerfil(perfil => { perfil.gistAutoSync = valor; });
        }

        function getRangoHorario() {
            const perfil = window.PerfilManager ? PerfilManager.obtenerDatosPerfil() : null;
            return {
                desde: perfil?.gistRangoDesde || '21:00',
                hasta: perfil?.gistRangoHasta || '00:00'
            };
        }

        function setRangoHorario(desde, hasta) {
            _conPerfil(perfil => { perfil.gistRangoDesde = desde; perfil.gistRangoHasta = hasta; });
        }

        function _claveHoraActual() {
            const ahora = new Date();
            return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')} ${String(ahora.getHours()).padStart(2, '0')}`;
        }

        function getSyncCount(tipo) {
            const perfil = window.PerfilManager ? PerfilManager.obtenerDatosPerfil() : null;
            const key = `gistSyncCount_${tipo}`;
            const keyFecha = `gistSyncFecha_${tipo}`;
            if (!perfil?.[keyFecha] || perfil[keyFecha] !== _claveHoraActual()) return 0;
            return perfil?.[key] || 0;
        }

        function marcarSync(tipo) {
            if (getSyncLimite(tipo) === 0) return;
            _conPerfil(perfil => {
                const key = `gistSyncCount_${tipo}`;
                const keyFecha = `gistSyncFecha_${tipo}`;
                const clave = _claveHoraActual();
                const esNuevaHora = perfil[keyFecha] !== clave;
                perfil[keyFecha] = clave;
                perfil[key] = esNuevaHora ? 1 : (perfil[key] || 0) + 1;
            });
        }

        function getSyncLimite(tipo) {
            const key = `gistSyncLimite_${tipo}`;
            const val = parseInt(localStorage.getItem(key));
            if (tipo === 'bajar') return isNaN(val) ? 2 : val;
            if (tipo === 'subir') return isNaN(val) ? 1 : val;
            return 2;
        }

        function setSyncLimite(tipo, valor) {
            const anteriorLimite = getSyncLimite(tipo);
            try { localStorage.setItem(`gistSyncLimite_${tipo}`, valor); } catch (e) { }
            if (anteriorLimite === 0 && valor > 0 && window.PerfilManager) {
                const perfil = PerfilManager.obtenerDatosPerfil();
                if (perfil) {
                    perfil[`gistSyncCount_${tipo}`] = 0;
                    perfil[`gistSyncFecha_${tipo}`] = null;
                    PerfilManager.guardarPerfiles();
                }
            }
        }

        function superaLimite(tipo) {
            const limite = getSyncLimite(tipo);
            if (limite === 0) return false;
            return getSyncCount(tipo) >= limite;
        }

        function dentroDelRangoHorario() {
            const { desde, hasta } = getRangoHorario();
            const ahora = new Date();
            const horaActual = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
            if (desde <= hasta) {
                return horaActual >= desde && horaActual <= hasta;
            } else {
                return horaActual >= desde || horaActual <= hasta;
            }
        }

        function saveCredentials(token, gistId) {
            try {
                if (token) {
                    localStorage.setItem(KEY_TOKEN, S.sanitizeString(token.trim()));
                } else {
                    localStorage.removeItem(KEY_TOKEN);
                }
                if (window.PerfilManager) {
                    const perfil = PerfilManager.obtenerDatosPerfil();
                    if (perfil) {
                        if (gistId && esGistIdValido(gistId)) {
                            perfil.gistId = gistId.trim();
                        } else if (gistId === '') {
                            delete perfil.gistId;
                        }
                        PerfilManager.guardarPerfiles();
                    }
                }
            } catch (e) { console.error('Error guardando credenciales:', e); }
        }

        function saveLastSync(gistId) {
            const ahora = new Date().toLocaleString('es-AR');
            if (window.PerfilManager) {
                const perfil = PerfilManager.obtenerDatosPerfil();
                if (perfil) {
                    perfil.gistLastSync = ahora;
                    if (gistId && esGistIdValido(gistId)) perfil.gistId = gistId;
                    PerfilManager.guardarPerfiles();
                }
            }
        }

        async function subir(registros, diasHabiles, horasDiarias) {
            const token = getToken();
            if (!token) throw new Error('Falta el token de GitHub');

            const hash = await S.calcularHashSHA256(registros);
            const data = {
                registros,
                diasHabiles,
                horasDiarias,
                fecha: S.fechaLocalISO(),
                version: S.SECURITY_LIMITS.SCHEMA_VERSION,
                hash,
                timestamp: Date.now()
            };

            const gistId = getGistId();
            const gistIdValido = esGistIdValido(gistId);
            const url = gistIdValido
                ? `https://api.github.com/gists/${gistId}`
                : 'https://api.github.com/gists';
            const method = gistIdValido ? 'PATCH' : 'POST';

            const body = {
                description: 'Horarios PWA - Backup automático',
                public: false,
                files: {
                    [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) }
                }
            };

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-GitHub-Api-Version': '2022-11-28'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || `Error ${response.status}`);
            }

            const result = await response.json();
            saveLastSync(result.id);
            return result.id;
        }

        async function bajar() {
            const token = getToken();
            const gistId = getGistId();
            if (!token) throw new Error('Falta el token de GitHub');
            if (!gistId || !esGistIdValido(gistId)) throw new Error('Gist ID inválido — dejá el campo vacío y subí primero para crear uno');

            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || `Error ${response.status}`);
            }

            const gist = await response.json();
            const file = gist.files[GIST_FILENAME];
            if (!file) throw new Error(`Archivo ${GIST_FILENAME} no encontrado en el Gist`);

            const data = JSON.parse(file.content, (key, value) => {
                if (['__proto__', 'constructor', 'prototype'].includes(key)) return undefined;
                return value;
            });

            if (data.hash) {
                const hashCalculado = await S.calcularHashSHA256(data.registros);
                if (hashCalculado !== data.hash) {
                    data._hashNoCoincide = true;
                }
            }

            saveLastSync(gistId);
            return data;
        }

        return { getToken, getGistId, getLastSync, getMergeBehavior, setMergeBehavior, getAutoSync, setAutoSync, getRangoHorario, setRangoHorario, getSyncCount, marcarSync, superaLimite, getSyncLimite, setSyncLimite, dentroDelRangoHorario, saveCredentials, esGistIdValido, subir, bajar };

    })(SecurityAndUtils);

    window.GistSync = GistSync;

    const UILogic = (function (S, D, GistSync) {

        let toastTimeout = null;
        let _toastQueue = [];
        let _toastRunning = false;
        let intervaloPulsacion = null;
        let timeoutInicial = null;
        let edicionBloqueada = true;
        let edicionGrupoBloqueada = true;
        let perfilEnEdicion = null;
        let modoLoteActivo = false;
        let tiempoExpansionBotones = null;
        let timerAutoCierreBotones = null;
        let modoEstadisticas = 'mensual';
        let _modalAbiertoDesdeLista = false;

        function registrarSwipe(el, callback, { minX = 50, maxY = 80, ignoreInputs = false } = {}) {
            if (!el || el.dataset.swipeInit) return;
            el.dataset.swipeInit = '1';
            let _x = null, _y = null;
            el.addEventListener('touchstart', e => {
                if (e.touches.length !== 1) return;
                if (ignoreInputs && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
                _x = e.touches[0].clientX;
                _y = e.touches[0].clientY;
            }, { passive: true });
            el.addEventListener('touchend', e => {
                if (_x === null) return;
                const dx = e.changedTouches[0].clientX - _x;
                const dy = e.changedTouches[0].clientY - _y;
                _x = null; _y = null;
                if (Math.abs(dy) > maxY) return;
                if (Math.abs(dx) < minX) return;
                callback(dx < 0 ? 1 : -1);
            }, { passive: true });
        }

        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        function mostrarError(inputId, errorId) {
            const input = $(inputId);
            const error = $(errorId);
            if (input) input.classList.add('error');
            if (error) error.style.display = 'block';
        }

        function limpiarError(inputId, errorId) {
            const input = $(inputId);
            const error = $(errorId);
            if (input) input.classList.remove('error');
            if (error) error.style.display = 'none';
        }

        // ----------------------------------------------------------------
        // HELPERS COMPARTIDOS DE EXPORTACIÓN
        // ----------------------------------------------------------------

        function obtenerNombrePerfilSafe() {
            let nombre = 'Backup';
            if (window.PerfilManager) nombre = window.PerfilManager.obtenerDatosPerfil().nombre;
            return nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ'\-_ ]/g, '').trim().replace(/\s+/g, '_');
        }

        function descargarJSON(data, nombreArchivo) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function mostrarToast(mensaje, tipo = 'info') {
            const textoLimpio = S.sanitizeString(mensaje, 200);
            const ultimo = _toastQueue[_toastQueue.length - 1];
            const actual = _toastRunning ? $('toast')?.textContent : null;
            if ((ultimo && ultimo.mensaje === textoLimpio) || actual === textoLimpio) return;
            _toastQueue.push({ mensaje: textoLimpio, tipo, duracionBase: 3000 });
            if (!_toastRunning) _procesarToastQueue();
        }

        function _procesarToastQueue() {
            if (_toastQueue.length === 0) {
                _toastRunning = false;
                return;
            }

            _toastRunning = true;
            const actual = _toastQueue.shift();
            const toast = $('toast');
            toast.classList.remove('show');
            toast.textContent = actual.mensaje;
            toast.className = `toast ${actual.tipo}`;
            let duracionFinal = actual.duracionBase || 3000;
            if (_toastQueue.length >= 2) {
                duracionFinal = Math.floor(duracionFinal / 2);
            }

            setTimeout(() => {
                toast.classList.add('show');
                toastTimeout = setTimeout(() => {
                    toast.classList.remove('show');
                    toastTimeout = null;
                    setTimeout(() => _procesarToastQueue(), 350);
                }, duracionFinal);
            }, 10);
        }

        function resetearBoton(btn) {
            btn.disabled = false;
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
            btn.innerHTML = '<svg class="icon"><use href="#icon-save"/></svg> <span id="btn-registrar-texto">Fichar</span>';
        }

        function restaurarBotonGuardarEdicion(btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<svg class="icon"><use href="#icon-save"/></svg> Guardar';
        }

        function obtenerFechaHoy() {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }

        function obtenerNombreDia(f) {
            if (!f) return '';
            const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            try {
                const [y, m, d] = f.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                if (isNaN(date.getTime())) return '';
                return dias[date.getDay()];
            } catch (e) { return ''; }
        }

        function obtenerSemanaActual() {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const diaSemana = hoy.getDay();
            const offsetLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
            const lunes = new Date(hoy);
            lunes.setDate(hoy.getDate() + offsetLunes);
            const domingo = new Date(lunes);
            domingo.setDate(lunes.getDate() + 6);
            const formatearFecha = (fecha) => {
                const y = fecha.getFullYear();
                const m = String(fecha.getMonth() + 1).padStart(2, '0');
                const d = String(fecha.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            };

            return {
                inicio: formatearFecha(lunes),
                fin: formatearFecha(domingo)
            };
        }

        function obtenerLunesSemana(fecha) {
            const date = S.parsearFechaLocal(fecha);
            const dia = date.getDay();
            const offset = dia === 0 ? -6 : 1 - dia;
            const lunes = new Date(date);
            lunes.setDate(date.getDate() + offset);
            return S.formatearFechaLocal(lunes);
        }

        function horasATexto(t) {
            const totalHoras = Math.max(0, t);

            let h = Math.floor(totalHoras);
            let m = Math.round((totalHoras - h) * 60);
            if (m === 60) { h++; m = 0; }
            let partes = [];

            if (h > 0) {
                partes.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
            }

            if (m > 0) {
                partes.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
            } else if (h === 0 && m === 0) {
                partes.push('0 minutos');
            }

            return partes.join(' ');
        }

        function horasATextoCorto(totalHoras) {
            const abs = Math.abs(totalHoras);
            let h = Math.floor(abs);
            let m = Math.round((abs - h) * 60);
            if (m === 60) { h++; m = 0; }
            const signo = totalHoras >= 0 ? '+' : '-';
            return h > 0 ? `${signo}${h}h${m > 0 ? ' ' + m + 'm' : ''}` : `${signo}${m}m`;
        }

        function formatoDiferencia(tiempoTotalHoras) {
            const diffMinutos = Math.round(tiempoTotalHoras * 60) - D.horasDiarias() * 60;
            if (diffMinutos === 0) return '';
            const abs = Math.abs(diffMinutos);
            const h = Math.floor(abs / 60);
            const m = abs % 60;
            return (diffMinutos > 0 ? '+' : '-') + (h > 0 ? `${h}h` : '') + (h > 0 && m > 0 ? ' ' : '') + (m > 0 || h === 0 ? `${m}m` : '');
        }

        function formatoTituloMes(claveMes) {
            const [año, mes] = claveMes.split('-');
            const fecha = new Date(año, mes - 1, 1);
            const opciones = { month: 'long', year: 'numeric' };
            let nombre = fecha.toLocaleDateString('es-ES', opciones);
            return nombre.charAt(0).toUpperCase() + nombre.slice(1);
        }

        function agruparRegistrosPorMes(registros) {
            if (!Array.isArray(registros)) {
                console.warn('agruparRegistrosPorMes: entrada inválida');
                return new Map();
            }

            const grupos = new Map();
            registros.forEach(r => {
                if (!r || typeof r !== 'object' || !r.fecha || typeof r.fecha !== 'string') {
                    return;
                }

                if (r.fecha.length < 7) {
                    return;
                }

                const claveMes = r.fecha.substring(0, 7);
                if (!grupos.has(claveMes)) {
                    grupos.set(claveMes, []);
                }
                grupos.get(claveMes).push(r);
            });
            return grupos;
        }

        function obtenerTipoRegistro(registro) {
            if (!registro) return null;

            const tipo = TiposRegistro.obtenerTipoPorCodigo(registro.entrada, registro.salida);
            return tipo ? tipo.id : null;
        }

        function esFechaConsecutiva(fechaActual, fechaSiguiente) {
            const actual = S.parsearFechaLocal(fechaActual);
            const siguiente = S.parsearFechaLocal(fechaSiguiente);
            actual.setDate(actual.getDate() - 1);
            return S.formatearFechaLocal(actual) === fechaSiguiente;
        }

        function agruparRegistrosConsecutivos(registros) {
            if (!registros || registros.length === 0) return [];

            const resultado = [];
            let i = 0;

            while (i < registros.length) {
                const registroActual = registros[i];
                const tipoActual = obtenerTipoRegistro(registroActual);

                if (tipoActual === null) {
                    resultado.push({
                        tipo: 'individual',
                        registros: [registroActual]
                    });
                    i++;
                    continue;
                }

                const grupo = [registroActual];
                let j = i + 1;

                while (j < registros.length) {
                    const registroSiguiente = registros[j];
                    const tipoSiguiente = obtenerTipoRegistro(registroSiguiente);

                    if (tipoSiguiente !== tipoActual) break;

                    const ultimaFecha = grupo[grupo.length - 1].fecha;
                    if (!esFechaConsecutiva(ultimaFecha, registroSiguiente.fecha)) break;

                    grupo.push(registroSiguiente);
                    j++;
                }

                if (grupo.length > 1) {
                    resultado.push({
                        tipo: 'grupo',
                        subtipo: tipoActual,
                        registros: grupo
                    });
                } else {
                    resultado.push({
                        tipo: 'individual',
                        registros: grupo
                    });
                }

                i = j;
            }

            return resultado;
        }

        function _crearChevron() {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'icon chevron-mes chevron-mes-icon');
            svg.setAttribute('viewBox', '0 0 24 24');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', '#icon-chevron-down');
            svg.appendChild(use);
            return svg;
        }

        function crearItemRegistroIndividual(r, horasDiarias, idResaltar = null, hoy = obtenerFechaHoy()) {
            const item = document.createElement('div');

            let className = r.fecha === hoy ? 'registro-item hoy' : 'registro-item';
            if (idResaltar && r.id === idResaltar) className += ' nuevo-registro-animacion';
            item.className = className;
            item.dataset.registroId = r.id;
            item.dataset.accion = 'editar-registro';

            const info = document.createElement('div');
            info.className = 'registro-info';

            const tipoEspecial = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);

            const fechaEl = document.createElement('div');
            fechaEl.className = 'registro-fecha';
            const etiqueta = tipoEspecial ? ` ${tipoEspecial.emoji} (${tipoEspecial.label})` : '';
            fechaEl.textContent = `${obtenerNombreDia(r.fecha)} ${r.fecha.substring(8)}${etiqueta}`;

            const tfText = (() => {
                if (!r.tiempoFuera || r.tiempoFuera === '' || r.tiempoFuera === '00:00') return '';
                const [tfH, tfM] = r.tiempoFuera.split(':').map(Number);
                const tfStr = tfH > 0 ? `${tfH}h${tfM > 0 ? ' ' + tfM + 'm' : ''}` : `${tfM}m`;
                return ` (${tfStr} Fuera)`;
            })();
            const crText = r.credito && r.credito !== '00:00' ? ' (Salida Temprano)' : '';

            const horasEl = document.createElement('div');
            horasEl.className = 'registro-horas';
            horasEl.textContent = tipoEspecial
                ? tipoEspecial.descripcion
                : `${r.entrada || '-'} → ${r.salida || '-'}${tfText}${crText}`;

            const totalEl = document.createElement('div');
            totalEl.className = 'registro-total';
            let totalText = 'Incompleto';

            if (tipoEspecial) {
                totalText = 'Justificado';
                totalEl.classList.add(`${tipoEspecial.color}-text`);
            } else if (r.entrada && r.salida) {
                totalText = `${r.horas}h ${r.minutos}m`;
                if (horasDiarias > 0) {
                    const diffText = formatoDiferencia(r.total);
                    totalEl.classList.add(r.total >= horasDiarias ? 'green-text' : 'red-text');
                    if (diffText) totalText += ` (${diffText})`;
                }
            } else if (r.entrada && !r.salida) {
                if (r.fecha === hoy) {
                    totalText = 'En curso . . .';
                    totalEl.classList.add('blue-text');
                } else {
                    totalText = 'Incompleto';
                    totalEl.classList.add('yellow-text');
                }
            } else {
                totalText = 'Sin datos';
            }

            totalEl.textContent = totalText;
            info.appendChild(fechaEl);
            info.appendChild(horasEl);
            info.appendChild(totalEl);
            item.appendChild(info);

            return item;
        }

        function crearContenedorMes(claveMes, registrosDelMes, horasDiarias, idNuevo, mesHoy, hoy) {
            const grupos = agruparRegistrosConsecutivos(registrosDelMes);

            const contenedorMesActual = document.createElement('div');
            contenedorMesActual.className = 'registro-mes-container';

            const headerMes = document.createElement('h3');
            headerMes.className = 'registro-mes-header';
            headerMes.dataset.mesId = claveMes;
            headerMes.dataset.accion = 'toggle-mes';
            headerMes.dataset.mesContainer = claveMes;

            const chevron = _crearChevron();
            headerMes.appendChild(chevron);
            headerMes.appendChild(document.createTextNode(' ' + formatoTituloMes(claveMes)));

            const detalleMesActual = document.createElement('div');
            detalleMesActual.className = 'registro-mes-detalle';

            let debeEstarExpandido = false;
            try {
                const estadoGuardado = localStorage.getItem(`mes-${claveMes}-expandido`);
                debeEstarExpandido = estadoGuardado !== null ? estadoGuardado === 'true' : claveMes === mesHoy;
            } catch (e) {
                debeEstarExpandido = claveMes === mesHoy;
            }

            if (debeEstarExpandido) {
                detalleMesActual.classList.add('expanded');
                chevron.style.transform = 'rotate(180deg)';
            }

            let semanaAnterior = null;
            grupos.forEach(grupo => {
                const esGrupo = grupo.tipo === 'grupo';
                const r = esGrupo ? grupo.registros[grupo.registros.length - 1] : grupo.registros[0];
                const semanaActual = obtenerLunesSemana(r.fecha);

                if (semanaAnterior && semanaActual !== semanaAnterior) {
                    const sep = document.createElement('div');
                    sep.className = 'separador-semana';
                    detalleMesActual.appendChild(sep);
                }

                detalleMesActual.appendChild(
                    esGrupo
                        ? crearGrupoExpandible(grupo, horasDiarias, idNuevo)
                        : crearItemRegistroIndividual(r, horasDiarias, idNuevo, hoy)
                );
                semanaAnterior = semanaActual;
            });

            contenedorMesActual.appendChild(headerMes);
            contenedorMesActual.appendChild(detalleMesActual);
            return contenedorMesActual;
        }

        function actualizarListaRegistros(registros, idNuevo = null) {
            const lista = $('lista-registros');

            const mesesExpandidos = new Set();
            lista.querySelectorAll('.registro-mes-container').forEach(container => {
                const detalle = container.querySelector('.registro-mes-detalle');
                if (detalle && detalle.classList.contains('expanded')) {
                    const header = container.querySelector('.registro-mes-header');
                    if (header && header.dataset.mesId) mesesExpandidos.add(header.dataset.mesId);
                }
            });

            lista.innerHTML = '';
            const horasDiarias = D.horasDiarias();
            const registrosAMostrar = D.obtenerRegistrosFiltrados();

            if (registrosAMostrar.length === 0) {
                lista.innerHTML = '<div class="empty-state">No hay registros</div>';
                return;
            }

            const hoy = obtenerFechaHoy();
            const mesHoy = hoy.substring(0, 7);
            const anioHoy = hoy.substring(0, 4);
            const gruposPorMes = agruparRegistrosPorMes(registrosAMostrar);
            const fragmento = document.createDocumentFragment();

            const mesesAnioActual = new Map();
            const mesesPorAnio = new Map();

            gruposPorMes.forEach((regs, claveMes) => {
                const anio = claveMes.substring(0, 4);
                if (anio === anioHoy) {
                    mesesAnioActual.set(claveMes, regs);
                } else {
                    if (!mesesPorAnio.has(anio)) mesesPorAnio.set(anio, new Map());
                    mesesPorAnio.get(anio).set(claveMes, regs);
                }
            });

            mesesAnioActual.forEach((registrosDelMes, claveMes) => {
                fragmento.appendChild(crearContenedorMes(claveMes, registrosDelMes, horasDiarias, idNuevo, mesHoy, hoy));
            });

            const aniosOrdenados = Array.from(mesesPorAnio.keys()).sort().reverse();
            aniosOrdenados.forEach(anio => {
                const mesesDelAnio = mesesPorAnio.get(anio);

                const contenedorAnio = document.createElement('div');
                contenedorAnio.className = 'registro-mes-container';

                const headerAnio = document.createElement('h3');
                headerAnio.className = 'registro-mes-header';
                headerAnio.dataset.anioId = anio;
                headerAnio.dataset.accion = 'toggle-anio';

                const chevronAnio = _crearChevron();
                headerAnio.appendChild(chevronAnio);
                headerAnio.appendChild(document.createTextNode(' ' + anio));

                const detalleAnio = document.createElement('div');
                detalleAnio.className = 'registro-mes-detalle';

                let anioExpandido = false;
                try {
                    anioExpandido = localStorage.getItem(`anio-${anio}-expandido`) === 'true';
                } catch (e) { }

                if (anioExpandido) {
                    detalleAnio.classList.add('expanded');
                    chevronAnio.style.transform = 'rotate(180deg)';
                }

                mesesDelAnio.forEach((registrosDelMes, claveMes) => {
                    detalleAnio.appendChild(crearContenedorMes(claveMes, registrosDelMes, horasDiarias, idNuevo, mesHoy, hoy));
                });

                contenedorAnio.appendChild(headerAnio);
                contenedorAnio.appendChild(detalleAnio);
                fragmento.appendChild(contenedorAnio);
            });

            lista.appendChild(fragmento);
        }

        function setProgressBarColor(progressEl, status) {
            if (!progressEl) return;
            progressEl.className = 'progress-fill';
            progressEl.classList.add(status);
            if (status === 'blue') progressEl.classList.add('shimmer');
        }

        function crearGrupoExpandible(grupo, horasDiarias, idResaltar = null) {
            const primerReg = grupo.registros[0];
            const ultimoReg = grupo.registros[grupo.registros.length - 1];

            const container = document.createElement('div');
            container.className = 'registro-grupo-container';

            const header = document.createElement('div');

            let className = 'registro-item';
            let animarGrupo = false;

            if (idResaltar) {
                const idsNuevos = Array.isArray(idResaltar) ? idResaltar : [idResaltar];
                const contieneNuevo = grupo.registros.some(r => idsNuevos.includes(r.id));
                if (contieneNuevo) {
                    animarGrupo = true;
                }
            }

            if (animarGrupo) {
                className += ' nuevo-registro-animacion';
            }
            header.className = className;

            const info = document.createElement('div');
            info.className = 'registro-info';

            const fechaEl = document.createElement('div');
            fechaEl.className = 'registro-fecha';

            const tipoConfig = TiposRegistro.obtenerTipoPorId(grupo.subtipo);
            const emoji = tipoConfig ? tipoConfig.emoji : '📅';
            const label = tipoConfig ? tipoConfig.labelPlural : 'Registros';

            fechaEl.textContent = `${emoji} ${label} (${grupo.registros.length} días)`;

            const horasEl = document.createElement('div');
            horasEl.className = 'registro-horas';
            const rangoFechas = `${ultimoReg.fecha.substring(8)} al ${primerReg.fecha.substring(8)}`;
            horasEl.textContent = rangoFechas;

            const totalEl = document.createElement('div');
            const colorClase = tipoConfig ? `${tipoConfig.color}-text` : 'purple-text';
            totalEl.className = `registro-total ${colorClase}`;
            totalEl.textContent = 'Justificado';

            info.appendChild(fechaEl);
            info.appendChild(horasEl);
            info.appendChild(totalEl);
            header.appendChild(info);

            header.dataset.accion = 'editar-grupo';
            header.dataset.grupoData = JSON.stringify({
                registros: grupo.registros.map(r => r.id),
                subtipo: grupo.subtipo
            });

            container.appendChild(header);
            return container;
        }

        function calcularRegularidad(desviacionMinutos) {
            if (desviacionMinutos === null) return '--:--';
            const mins = Math.round(desviacionMinutos);
            const label = mins <= 20 ? 'Alta' : mins <= 40 ? 'Media' : 'Baja';
            return `±${mins}m | ${label}`;
        }

        function desviacionEstandar(valores) {
            if (valores.length < 2) return null;
            const media = valores.reduce((a, b) => a + b, 0) / valores.length;
            const varianza = valores.reduce((sum, v) => sum + Math.pow(v - media, 2), 0) / valores.length;
            return Math.sqrt(varianza);
        }

        function _calcularEstadisticasRango(registrosRango, opciones = {}) {
            const { regularidadPorMes = false } = opciones;

            const conteosPorTipo = {};
            TiposRegistro.obtenerTodosLosTipos().forEach(t => {
                conteosPorTipo[t.labelPlural.toLowerCase()] = registrosRango.filter(
                    r => r.entrada === t.codigo && r.salida === t.codigo
                ).length;
            });

            const compensaciones = registrosRango.filter(r => r.credito && r.credito !== '00:00').length;

            let tiempoFueraTotalMinutos = 0;
            registrosRango.forEach(r => {
                if (r.tiempoFuera && r.tiempoFuera !== '00:00') {
                    const [h, m] = r.tiempoFuera.split(':').map(Number);
                    if (!isNaN(h) && !isNaN(m)) tiempoFueraTotalMinutos += (h * 60) + m;
                }
            });
            const hTiempoFuera = Math.floor(tiempoFueraTotalMinutos / 60);
            const mTiempoFuera = tiempoFueraTotalMinutos % 60;

            const registrosValidos = registrosRango.filter(r =>
                r.entrada && r.salida && !TiposRegistro.esRegistroEspecial(r.entrada, r.salida)
            );

            const vacios = {
                entradaPromedio: '--:--', salidaPromedio: '--:--',
                diasTrabajados: 0, promedioDiario: '--:--',
                tiempoFueraTotal: '--:--', tiempoTotal: '--:--',
                ...conteosPorTipo, compensaciones,
                regularidadEntrada: '--:--', regularidadJornada: '--:--',
                bufferPeriodo: null
            };
            if (registrosValidos.length === 0) return vacios;

            const toMin = str => { const [h, m] = str.split(':').map(Number); return h * 60 + m; };
            const avgMin = arr => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
            const promedioEntrada = avgMin(registrosValidos.map(r => toMin(r.entrada)));
            const promedioSalida = avgMin(registrosValidos.map(r => toMin(r.salida)));

            const horasDiariasParaRemoto = D.horasDiarias();
            const remotos = conteosPorTipo['remotos'] || 0;
            const totalHorasTrabajadas = registrosValidos.reduce((s, r) => s + r.total, 0);
            const totalHoras = totalHorasTrabajadas + (remotos * horasDiariasParaRemoto);
            const promDiario = totalHorasTrabajadas / registrosValidos.length;
            let hPromedio = Math.floor(promDiario);
            let mPromedio = Math.round((promDiario - hPromedio) * 60);
            if (mPromedio === 60) { hPromedio++; mPromedio = 0; }
            let hTotal = Math.floor(totalHoras);
            let mTotal = Math.round((totalHoras - hTotal) * 60);
            if (mTotal === 60) { hTotal++; mTotal = 0; }

            let regEntrada, regJornada;
            if (regularidadPorMes) {
                const meses = [...new Set(registrosValidos.map(r => r.fecha.substring(0, 7)))];
                const desE = [], desJ = [];
                meses.forEach(mes => {
                    const regs = registrosValidos.filter(r => r.fecha.startsWith(mes));
                    if (regs.length >= 2) {
                        const dE = desviacionEstandar(regs.map(r => toMin(r.entrada)));
                        const dJ = desviacionEstandar(regs.map(r => Math.round(r.total * 60)));
                        if (dE !== null) desE.push(dE);
                        if (dJ !== null) desJ.push(dJ);
                    }
                });
                regEntrada = calcularRegularidad(desE.length > 0 ? desE.reduce((a, b) => a + b, 0) / desE.length : null);
                regJornada = calcularRegularidad(desJ.length > 0 ? desJ.reduce((a, b) => a + b, 0) / desJ.length : null);
            } else {
                regEntrada = calcularRegularidad(desviacionEstandar(registrosValidos.map(r => toMin(r.entrada))));
                regJornada = calcularRegularidad(desviacionEstandar(registrosValidos.map(r => Math.round(r.total * 60))));
            }

            const horasDiariasObj = D.horasDiarias();
            let bufferPeriodo = null;
            if (horasDiariasObj > 0 && opciones.desde && opciones.hasta) {
                const diasHabilesConfig = D.diasHabiles();
                const regsPorFecha = new Map(registrosRango.map(r => [r.fecha, r]));
                const hoy = obtenerFechaHoy();

                const { ayerStr, ayerAbierto } = D.detectarAyerAbierto(hoy, regsPorFecha);

                let objetivo = 0;
                let hechas = 0;
                let fechaIt = S.parsearFechaLocal(opciones.desde);
                const fechaFin = S.parsearFechaLocal(opciones.hasta);
                while (fechaIt <= fechaFin) {
                    const iso = S.formatearFechaLocal(fechaIt);
                    if (iso > hoy) { fechaIt.setDate(fechaIt.getDate() + 1); continue; }
                    const esDiaHabil = diasHabilesConfig.includes(fechaIt.getDay());
                    const r = regsPorFecha.get(iso);
                    const esEspecial = r && TiposRegistro.esRegistroEspecial(r.entrada, r.salida);
                    const esHoy = iso === hoy;
                    const esRemoto = esEspecial && TiposRegistro.obtenerTipoPorCodigo(r?.entrada, r?.salida)?.id === 'remoto';

                    let diaTerminado = true;
                    if (esHoy) {
                        diaTerminado = (r && r.salida);
                    } else if (ayerAbierto && iso === ayerStr) {
                        diaTerminado = false;
                    }

                    if (esDiaHabil && (!esEspecial || esRemoto) && diaTerminado) {
                        objetivo += horasDiariasObj;
                    }
                    if (r && r.salida && !esEspecial && diaTerminado) {
                        hechas += r.total;
                    }
                    if (esRemoto) {
                        hechas += horasDiariasObj;
                    }
                    fechaIt.setDate(fechaIt.getDate() + 1);
                }
                bufferPeriodo = hechas - objetivo;
            }

            return {
                entradaPromedio: `${String(Math.floor(promedioEntrada / 60)).padStart(2, '0')}:${String(promedioEntrada % 60).padStart(2, '0')}`,
                salidaPromedio: `${String(Math.floor(promedioSalida / 60)).padStart(2, '0')}:${String(promedioSalida % 60).padStart(2, '0')}`,
                diasTrabajados: registrosValidos.length,
                promedioDiario: `${hPromedio}h ${mPromedio}m`,
                tiempoFueraTotal: hTiempoFuera > 0 ? `${hTiempoFuera}h ${mTiempoFuera}m` : `${mTiempoFuera}m`,
                tiempoTotal: `${hTotal}h ${mTotal}m`,
                ...conteosPorTipo, compensaciones,
                regularidadEntrada: regEntrada,
                regularidadJornada: regJornada,
                bufferPeriodo
            };
        }

        function _renderizarStats(stats, opciones = {}) {
            const { mostrarBtnReporte = true } = opciones;

            const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
            set('stat-entrada-promedio', stats.entradaPromedio);
            set('stat-salida-promedio', stats.salidaPromedio);
            set('stat-tiempo-fuera-total', stats.tiempoFueraTotal);
            set('stat-tiempo-total', stats.tiempoTotal);

            const toggleStatItem = (id, value) => {
                const el = $(id); if (!el) return;
                const si = el.closest('.stat-item');
                if (si) { if (value === 0) { si.style.display = 'none'; } else { si.style.display = ''; el.textContent = value; } }
            };
            toggleStatItem('stat-dias-trabajados', stats.diasTrabajados);

            TiposRegistro.obtenerTodosLosTipos().forEach(t => {
                const clave = t.labelPlural.toLowerCase();
                toggleStatItem(`stat-${clave}`, stats[clave] || 0);
            });

            toggleStatItem('stat-compensaciones', stats.compensaciones);

            const elProm = $('stat-promedio-diario');
            if (elProm) elProm.textContent = stats.promedioDiario || '--:--';

            const elRegEnt = $('stat-regularidad-entrada');
            if (elRegEnt) elRegEnt.textContent = stats.regularidadEntrada || '--:--';
            const elRegJor = $('stat-regularidad-jornada');
            if (elRegJor) elRegJor.textContent = stats.regularidadJornada || '--:--';

            const btnReporte = document.getElementById('btn-reporte');
            if (btnReporte) {
                btnReporte.disabled = !mostrarBtnReporte;
            }
            const elSaldo = $('stat-saldo');
            const itemSaldo = $('stat-item-saldo');
            if (elSaldo && itemSaldo) {
                if (stats.bufferPeriodo === null) {
                    itemSaldo.style.display = 'none';
                } else {
                    itemSaldo.style.display = '';
                    const b = stats.bufferPeriodo;
                    elSaldo.textContent = b === 0 ? '0h' : horasATextoCorto(b);
                    elSaldo.style.color = b > 0 ? 'var(--c-green)' : b < 0 ? 'var(--c-red)' : 'var(--text-main)';
                }
            }
        }

        function calcularEstadisticasMes(mesAnio = null) {
            let mesActual, añoActual;
            if (mesAnio) {
                const [año, mes] = mesAnio.split('-').map(Number);
                añoActual = año; mesActual = mes - 1;
            } else {
                const hoy = new Date();
                mesActual = hoy.getMonth(); añoActual = hoy.getFullYear();
            }
            const registros = D.registros().filter(r => {
                const [a, m] = r.fecha.split('-').map(Number);
                return a === añoActual && m === mesActual + 1;
            });
            const primerDia = `${añoActual}-${String(mesActual + 1).padStart(2, '0')}-01`;
            const ultimoDia = S.formatearFechaLocal(new Date(añoActual, mesActual + 1, 0));
            return _calcularEstadisticasRango(registros, { regularidadPorMes: false, desde: primerDia, hasta: ultimoDia });
        }

        function actualizarEstadisticas(mesAnio = null) {
            const selectMes = $('select-mes-stats');
            if (!mesAnio && selectMes) mesAnio = selectMes.value;
            if (mesAnio && selectMes) {
                const [año, mes] = mesAnio.split('-').map(Number);
                const tieneRegs = D.registros().some(r => { const [a, m] = r.fecha.split('-').map(Number); return a === año && m === mes; });
                if (!tieneRegs) {
                    const hoy = new Date();
                    mesAnio = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
                    if (selectMes) selectMes.value = mesAnio;
                }
            }
            const stats = calcularEstadisticasMes(mesAnio);
            _renderizarStats(stats, { mostrarBtnReporte: true });
        }

        function _perfilKey(base) {
            return window.PerfilManager ? PerfilManager.perfilKey(base) : base + '_default';
        }

        let _fondoCard = 'golden-gate';

        function setFondoCard(valor) {
            _fondoCard = valor;
        }

        function toggleFondoCard() {
            if (_fondoCard === 'golden-gate') _fondoCard = 'obelisco';
            else if (_fondoCard === 'obelisco') _fondoCard = 'ninguno';
            else _fondoCard = 'golden-gate';
            localStorage.setItem(_perfilKey('fondoCard'), _fondoCard);
            const btn = $('hint-fondo-label');
            const labels = { 'golden-gate': 'Golden Gate', 'obelisco': 'Skyline BA', 'ninguno': 'Sin fondo' };
            if (btn) btn.textContent = labels[_fondoCard];
            const bg = $('stats-card-bg');
            if (bg && bg.dataset.estado) actualizarFondoCard(bg.dataset.estado);
        }

        function _svgSkylineBA(color) {
            return `<svg viewBox="0 0 800 200" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" class="card-bg-svg card-bg-svg--left"><g fill="${color}">` +
                `<rect x="0" y="148" width="800" height="52"/>` +
                `<rect x="0" y="110" width="18" height="40"/><rect x="20" y="100" width="22" height="50"/><rect x="44" y="118" width="14" height="32"/>` +
                `<rect x="580" y="108" width="20" height="42"/><rect x="604" y="95" width="16" height="55"/><rect x="624" y="112" width="22" height="38"/><rect x="650" y="100" width="18" height="50"/><rect x="672" y="115" width="25" height="35"/><rect x="700" y="105" width="20" height="45"/><rect x="724" y="118" width="16" height="32"/><rect x="744" y="98" width="22" height="52"/><rect x="770" y="110" width="30" height="40"/>` +
                `<rect x="62" y="90" width="5" height="58"/><rect x="46" y="92" width="38" height="4"/><rect x="84" y="94" width="4" height="30"/><rect x="105" y="98" width="5" height="50"/><rect x="90" y="100" width="36" height="4"/><rect x="125" y="102" width="4" height="24"/><rect x="145" y="108" width="4" height="40"/><rect x="133" y="110" width="28" height="3"/><rect x="160" y="111" width="3" height="18"/>` +
                `<rect x="185" y="130" width="38" height="18"/><rect x="188" y="95" width="32" height="36"/><rect x="191" y="75" width="26" height="22"/><rect x="194" y="60" width="20" height="17"/><rect x="197" y="48" width="14" height="14"/><rect x="200" y="38" width="8" height="12"/><rect x="203" y="28" width="2" height="12"/>` +
                `<rect x="258" y="118" width="42" height="30"/><rect x="260" y="75" width="38" height="44"/><rect x="270" y="55" width="18" height="22"/><rect x="273" y="44" width="12" height="13"/><ellipse cx="279" cy="44" rx="8" ry="6"/><rect x="277" y="32" width="4" height="14"/><ellipse cx="279" cy="32" rx="4" ry="3"/>` +
                `<polygon points="348,22 354,22 358,118 344,118" opacity="0.5"/><polygon points="348,22 354,22 351,10" opacity="0.5"/>` +
                `<rect x="168" y="120" width="16" height="28"/><rect x="238" y="115" width="18" height="33"/><rect x="304" y="108" width="14" height="40"/><rect x="322" y="115" width="20" height="33"/><rect x="370" y="100" width="16" height="48"/><rect x="390" y="112" width="14" height="36"/><rect x="406" y="118" width="12" height="30"/>` +
                `<rect x="420" y="120" width="60" height="28"/><rect x="422" y="90" width="56" height="32"/><rect x="428" y="78" width="44" height="14"/><rect x="434" y="60" width="32" height="20"/><path d="M434,60 Q450,30 466,60 Z"/><rect x="447" y="28" width="6" height="14"/><ellipse cx="450" cy="28" rx="5" ry="4"/>` +
                `<rect x="484" y="110" width="20" height="38"/><rect x="508" y="102" width="16" height="46"/><rect x="528" y="115" width="18" height="33"/><rect x="550" y="108" width="14" height="40"/>` +
                `</g></svg>`;
        }

        function _svgGoldenGate(color) {
            return `<svg viewBox="300 100 2294 1200" preserveAspectRatio="xMaxYMax meet" xmlns="http://www.w3.org/2000/svg" class="card-bg-svg card-bg-svg--right"><g fill="${color}" fill-rule="evenodd"><path d="M2027.6,194.1C1824.5,35.5,1888.9,70.5,1868.8,51.9c-10.4,6.1-3.4,19.1-15.5,28 c-22.8,16.8-56.9,3.3-81.7,4.2c-30.8,1.1-37.2-19.6-48.1-28c-1.2-1-1.9-2.4-2.2-3.9 c-3.6-17.7-10.3-11.6-11.7,0.2c-2.5,21.7-368.4,590.3-427.2,630.5c-0.5,0.3-1,1-1.1,1.6 c-0.5,7.7-119.6,137.1-120,138.1c-12.5,31.1-262.3,242.1-307.5,239.7 c-3.6,2.4-14,6.8-14,6.8c-1.1,4.1-17.7,8.9-19.3,8.5c-1.1,3.9-9,3.5-12.1,5.4 c-119.5,71.4-309.2-82.3-402.9-269.4c-26.9-53.7,6.2,3.7-46.6-9.2c4.1-4.4,0.1-9.9-2.4-8.6 c-10.3,5.2-2.5,8.6-8.6,8.9c-25,1.4-26.6-11.1-28-13.5c-0.8-1.4-4.2-1.3-4.5,0.1 c-0.5,3.3-2.9,5.3-4.2,8.1c-2.6,5.7,2,7.7-3,19.8c-4,9.5,0.9,6.5,2.4,7.4 c0,2.5-5,141.2-6.1,142.2c-6.6,6.4,1.3,234.1-13.2,235.9c-8.6,1.1-3.2,8.9-6.9,10.1 c-8.9,2.9-5.4-0.7-7.5-1.1c-0.4,2.2,0.1,3.8-4.4,4.6c-24.1,4.2-30.6,14-34.1,5.5 c-13.1,9.3,16.4-0.7-60,23.2c-25.7,8-15.6-2.8-16.8-5.8c-2.4-1.1-5.6-0.9-6.4-4.4 c-0.8-3.2-7.1,1.2-14.3-2.3c-0.5-0.3-1.3-0.2-1.9-0c-4.2,1.1-7.4-1-11-2.9 c-3.5-1.9-8.3-1.3-10.8-5.3c-0.4-0.7-1.3-0.9-1.6-0.4c-3.6,6.1-10.5-8.3-15.7-5 c-2.8,1.7-5.3,2.5-8.4,1.1c-2.3-1.1-2.9,3-6,0.3c-3-2.6-6.6-3.1-10.2-3.9 c-13.4-2.9-16.7-6.9-23.4-5c-3.2,0.9-6.4,3.4-9.9,0.8c-0.1-0.1-0.5-0.1-0.6,0.1 c-6.5,6.1-4.5,1.3-8.3,2.4c-2.4,0.7-4.5,5.3-12.3,2.7c-4.3-1.4-3.7,3.5-3.7,8.3 c-0,212.9-3.7,189.9,8.9,189.9c2677.5,0,2541.2,0.1,2551.1-0.3V541.4 C2577.1,541.4,2275.4,387.5,2027.6,194.1z M294.5,1299.4c-7.1,3.6-12.8-0.1-18.6-3 c-3.7-1.8,4.1-6.4-8-8.2c-3.7-0.6-0.8,3.2-3.1,3.7c-11.2,2.4-10.3-11.8-22.2-14.7 c0.5-2.7-0.9-1.7,33.3-11.4c15.3-4.4,19.2-5.8,19.2-2.3 C295.1,1269.4,294.8,1296.8,294.5,1299.4z M380.5,833.1c-0.5,4.9-11.1,36.7-14.7,43.8 c-8.7-15.4-17-30-25.1-44.3C341.9,830.3,378.9,832.6,380.5,833.1z M376.6,862 c0,4.7,0.3,1.6-0.9,22.5C375.3,890.9,362.9,885.2,376.6,862z M372.1,947.7 c0.1,0,0.2,0,0.2,0c0.6-26.9,0.4-22.9,1.1-27.5c0.1-0.8,1.8-0.9,1.9,0.1 C377,933.9,370.2,1016.3,372.1,947.7z M344.6,1197.9c-3.2,0.7-2.3,0.8-2.3-37.6 c0.2,0,0.4,0,0.6,0c0.8-38.1,0.7-36.5,1-38.1c0.3-1.7,3.4-2,3.6,0.2 c0.2,1.4,0.2-2.9-0.2,70.3C347.4,1195,347.6,1197.3,344.6,1197.9z M329.2,1079.2 c0,0,0-10.8,0-33.5c0.2,0,0.4-35.6,4.2-35.5c2.5,0.1,2.4,1.6,2.3,6.4 c-0,1-1.2,59.3-1.4,62.4C334.2,1082.3,329.2,1082.1,329.2,1079.2z M332.4,1160.5 c-0.1-0-0.1-0-0.2-0c-1,41.3-0.1,41.4-4.7,41.9c-2.2,0.3-2.2-1.3-2-5.8 c3.4-90.4,1.9-60.7,5.3-74.8c0.2-0.6,2.3-0.9,2.4,0.7C333.5,1125.9,333.5,1124.9,332.4,1160.5z M334.4,1160.5c0.1-0,0.1-0,0.2-0c2.8-86.6,7.2-12.3,3.8,36.6 c-0.3,3.7-4.9,5-4.7,0.1C334.6,1166.7,334.4,1181.5,334.4,1160.5z M336.5,1081.2 c-0.3-2.1-0.3-1.1,0.5-34.8c0.1,0,0.2-21,0.3-31.6c0-8.9,4.8-5.5,5-4.5 c0.6,2.7-1,69.5-1.3,70.9C340.6,1083.1,336.8,1083.1,336.5,1081.2z M339.5,956.9 c0-0.8,0-1.5,0.1-2.2v-4.3h0.1c1-36.5,0.2-34.5,4-34.7c4.3-0.2-0,56.5-0,56.5 h-0.3c-0.3,1.5-1.1,2.5-2.6,2.4c-2.2-0.2-2.2-1.4-1.2-4.2v-13.5 C339.5,956.8,339.5,956.9,339.5,956.9z M343.5,886.3c-2.4-0.3-2.4-1.6-2.4-4.5 c-0.1-41.2-0.2-34.8,0.4-38.3c4.4,5.3,6.5,10.2,6,16.4C345.9,883,349.2,887,343.5,886.3z M344.9,1081.1c-0.1-1.4-0.1,0.4-0.1-35.4c0.2,0,1.2-21.4,1.5-32.2c0.2-7.1,3.8-4.4,3.9-3 c0.3,2.7-1.1,68.9-1.5,70.9C348.4,1082.9,345.1,1083.2,344.9,1081.1z M348.9,974.7 c-2.2,0-2.2-1.4-2.1-4.5c0.7-21.4,3.1-53.3,3.1-53.3h2.7V944 C352.5,944,351.8,974.6,348.9,974.7z M350.5,858.4c5.5,8.2,4.9,10.1,3.8,26.3 C354.1,886.3,345.6,896.6,350.5,858.4z M350.9,1157.9c0.8-37.5,0.3-36.6,2.1-36.7 c5.5-0.3-2.7,141.8-2.7,36.7C350.5,1157.9,350.7,1157.9,350.9,1157.9z M353.3,1083v-0.9h-0.4v-2 c-0.1,4.2-0.2,3.1,0-7.3v-13.1h0.2c0-2.8,0.1-6,0.2-9.4v-41.5h2.5V1083H353.3z M355.2,971.9 c1.4-57.2,1-48,2.3-54.2c0.2-1,1.8-0.4,1.9,0.3c0.3,3.3-0.2,27.5-0.2,27.5 c0,28,0.5,29-2,29.2C355.4,974.8,355.2,973.3,355.2,971.9z M358,886.7 c-1.3-0.9-1-1-1-15.8c0.5-0.1,1-0.2,1.5-0.3c2.2,3.2,4.5,6.3,6.7,9.5 C367.4,883.4,362.5,889.7,358,886.7z M359.2,1055.1v28.4h-0.9v-34.4c0,0,1.3-36.1,2.3-39.3 C361.3,1025,359.8,1040,359.2,1055.1z M358.6,1157.5c0.9-38.2,0.3-36.2,2.4-36.6 c5.4-1-2.8,136.5-2.8,36.6C358.4,1157.5,358.5,1157.5,358.6,1157.5z M361.6,1081.2 c-0.1-1.6,0.5-35.5,0.5-35.5c0-91.3,6.1,12.4,2.2,35.3C363.9,1083.6,361.7,1082.4,361.6,1081.2z M365.1,975.1v-57h2.1v57H365.1z M369.5,1127.2c1.2,1.5,0.8,3.3,0.7,4.9 C367.7,1265.6,365.3,1130.1,369.5,1127.2z M339.9,844.2c-1.7,42.1,0.1,41.7-3.4,42 c-4.2,0.3-3.2-1.3-3.2-28h-0.4c0-6.8,0-13.5-0-20.3C333,822.8,340.2,836.8,339.9,844.2z M332.2,942.5h0.1c-0.1-24-1-27.1,4.4-26c3,0.6,0.7,48.1-1.1,54.8 c-0.7,2.5-3.8,3.1-3.8-0.3c0-8.8,0.1-8.3,0.1-25.5h0.3V942.5z M324.9,878 c0.5-34.4-0.7-48.4,6.1-46c2.7,1-0.7,50.9-0.8,52C325,882.4,324.9,882.4,324.9,878z M323.4,950.9c-0.1-25,7.2-41.6,6.9-29.4c-1.3,55.1-1.1,48.8-1.6,50.7 c-6.6-1.6-6.1-8.1-3.8-14.5C325.7,955.2,323.4,953.4,323.4,950.9z M327.8,1021.4 c-1.2,47-1,41-1.6,43.2c-0.3,1.1-1.9,0.4-1.9-0.1c-0.5-3-0.4-2.5-0.2-19 C324.5,1019.2,326,1030.4,327.8,1021.4z M325,1070.7c2.2,0.8,2.1,10-0.5,9.1 c-2.3-0.8-1.1-2.9-1.5-4.3C323.1,1071.8,323.7,1070.2,325,1070.7z M323.2,1158.8 c-0.2,37.8,0.3,35.7-1.8,35.9C319.5,1194.9,320.4,1159.5,323.2,1158.8z M322.1,1304.5 c-0.7,1.6-5,2.6-4.4-1C318.4,1298.7,322.6,1303.4,322.1,1304.5z M319.2,1262 c0.3-13.6,5.1-6.3,16.1-11.9c1.1-0.6,2.9,0.8,2.7,2c-1.7,8,1.1,4.2-15,20.7 C316.9,1279,319.1,1269.3,319.2,1262z M342.5,1264.9c4.9-4.9,4.6-1.5,18.1,12.8 c7.6,8-2.7,6.2-14.9,6.2c0,0,0,0,0,0C322.8,1284,320.7,1286.7,342.5,1264.9z M328.9,1293.1c1.9-0.3,3.8-1.5,5.6-0.4c2,0.6,3.6-0.4,5.3-0.6 c7.2-0.6,14.3,1,21.5,1c6.7,0-5.1,9.3-8.9,14.6C343.1,1320.7,322.7,1294,328.9,1293.1 z M366,1314.6c-1.7-0-3.4-0.3-5.1-0.5c-4.2-0.6,6.8-10.7,8.5-11.9 c2.5-1.8,1.9,3.1,1.9,6c0.1,0,0.1,0,0.2,0C371.5,1320,368.4,1314.6,366,1314.6z M369.1,1273.5c-13.9-15.6-14.3-15.2-14-19.1c0.7-9.3,12.8-13.1,13.1-11.4 c0.6,3.2,4.6,4.6,4.5,8.2c-0.1,2.8-0,5.7-0,8.5c0.1,0,0.1,0,0.2,0 C372.2,1270.5,372.7,1277.5,369.1,1273.5z M372.6,1174.4c-1.5-5.3-0.9-24,0.9-28.1 C374.8,1152.6,374.2,1170.4,372.6,1174.4z M374.7,1065.2c-1.5-9.2-0.7-38.1,1.6-44.3 C376.3,1067.4,376.9,1064.3,374.7,1065.2z M377,972.9c-2-1.1-0.4,0.7-0.3-47.9 C376.8,897.6,382.2,975.6,377,972.9z M381.1,956.1v-26.1C384.4,930.2,381.7,953.8,381.1,956.1z M384.5,861.3h-0.3c0,22.5,0.8,23.4-2.2,24.6c-2.8,1.1-4.2,0.3-4.2-2.6 c-0.1-30.5-0.4-26.3,4.6-44C385.1,829.9,384.5,860.3,384.5,861.3z M1641.6,189.9 c0.1-14.2,30-57,32.2-58c1.2,41.6-1.1,117.8,0.7,126c-1.5,4.2-0,74.5-1.6,88.1 c-1.4,12.4-25.9,38.9-29.2,46.7C1640.5,400.6,1641.6,190.9,1641.6,189.9z M1664.6,943.6 c0.8-5.2,15.9-1.4,6.7,7.6c-0.7,0.7-0.8,2.4-2.1,2c-1.6-0.5-1.3-1.9-0.9-3.2 C1669.5,945.8,1663.7,949.1,1664.6,943.6z M1651.6,411.4c-0-8.5-1-29,22-48.4 c0,252.4,1.1,573.5-3.7,573.6C1648.4,937,1652.8,1187.6,1651.6,411.4z M1646.6,398.8 c3.3-3.5,1.9-9.2,1.9,289l-0.1,0c0,290.3,4,293.6-5.4,289.2c-3-1.4-1.6,2.3-2-546.8 C1641,409.9,1639.8,406.1,1646.6,398.8z M1613.6,224.8c41.9-66.4,17.9-53.7,24.8,170.5 c0.3,9-27.2,41.5-30,44.8c-0.4-3.5-2.1-5.7-0.6-8.4C1607.8,431.6,1602.3,242.6,1613.6,224.8z M1623.9,962c0,0-5.2,132.3-4.3-288.5c0.6-261.8-5.1-229.5,13.2-255.3 c8.8-12.4,4.9-0.1,4.5,72.9c-2.8,501.3,9.4,485.8-7.3,487.6c-5.5,0.6-3.6-13.1-2.5-15.4 C1629.2,959.2,1623,959.6,1623.9,962z M1614.5,443.9c5.1,5.4-1.3,69.7,2,83.6 c-3.1,26.6,3.4,452.3-2.4,453c-7.3,0.8-7.4,2-7.3-6.1C1608.5,404.8,1604.1,457.6,1614.5,443.9 z M1573.9,345.9c-0.1-51-1.4-56.7,6.3-68.3c30.4-45.8,23.9-58.2,23.9,51.1h-0.1 c0,79.3,1,118.7-3.6,123.6C1567.6,487.5,1574.2,533,1573.9,345.9z M1590.2,967.2 c-3-0.4-2.4,15.3-2.4-241.4c0.1,0,0.2,0,0.3,0c0-224.2-5-256.2,13.8-263.4 c3.4,3.2,2.7,607.6-3,514.3C1598.6,969.5,1597.5,968.2,1590.2,967.2z M1597.1,978.9 c-0.1,3.7-0.2,3.7-4,4.3c-1.5,0.2-3,0.9-4.8,0.2c-1-3.9-0.4-8-0.4-11.8 C1589.6,970,1597.5,968.7,1597.1,978.9z M1582.7,486.6c3.4-4.1,1.7,491.7,1.7,492.7 c-0.3,4.9-1,4-5.4,4.5c-7.3,0.9-5.5,29.2-5.5-336.4c-0,0-0,0-0,0 C1573.5,477.2,1570.7,501.1,1582.7,486.6z M1561.9,970.1c0-13.3-1-15.2,4.1-15.7 c6.1-0.6,5.1,0,4.9,27c-0,3.2,0.4,4.2-5.9,4.9c-3.6,0.4-2.8-0.8-2.8-16.3 C1562,970.1,1562,970.1,1561.9,970.1z M1556.8,820.4c0-324.9-3.7-297.9,10.4-312.8 c6.5-6.9,1.5,305,3.4,314.3c-0.6,2.2-0.7,97-0.6,98c4.1,64.2-10.3-0.6-10.6,57.5 c-0,4.2,0.1,6.7-0.9,6.7c-2.5-0-1.6,5.4-1.6-163.7H1556.8z M1541.8,347.3 c-0.4-13.4,4.3-17.7,21-42.5c6.3-9.3,6.2-9.7,7.6-9.2c1,0.4,0.7,137.1-0.5,144.9 c1.5,6.8,1.2,50.4-1.4,54.6c-9.6,15.6-17,18-17.4,23.5c-0.1,1-7.7,10.6-9.5,10.8 C1541.4,528.9,1541.9,350.7,1541.8,347.3z M1541.5,547.9c-1.4-7.6-1.4-7.8,10.4-21.8 c4.1-4.9,2.3-2.5,2.3,230.6c-0.1,0-0.2-0-0.3-0c0,253.7,4.3,230.5-7.3,231.5 C1535.4,989.3,1543,556.5,1541.5,547.9z M1515.8,374.9c18.7-27.4,18.5-29.4,21.9-31 c3.2,7.1-0.4,7.1,0.1,147.4c0.1,40.2,2.5,41.8-2.1,46.8c-31,33-26.5,75-25-92.2 C1511.1,388.3,1507.9,386.4,1515.8,374.9z M1536.7,546.8c2.2,0.7,1.3,440.6,0.7,441.9 c-13.7,3.8-9.9,15.4-10-123.6C1527.3,633.1,1523.4,542.6,1536.7,546.8z M1523,564.3 c1,0.6,5,424.2-2.5,426.3c-4.1,1.1-10.6,2.8-10.6-1.4 C1507.3,557.6,1508.1,576.4,1523,564.3z M1506.5,391.6c0,212.9,7.6,174-22.5,211.3 c-6.9,8.5-4.5,1.6-4.9-122.5C1478.9,433.5,1476,425.1,1506.5,391.6z M1497.6,986.6 c0.7-10.8,12.1-0,7.4,5.4c-0,0-0,0-0.1,0C1499.1,996.5,1497.1,994.1,1497.6,986.6z M1506,979.2c-2.8-0.4-4.7-0.7-6.8-1C1493,959.9,1506,102.8,1506,979.2z M1493.8,601.2 c1.9,2.3,2.4,393.2-2,393.2c-9.3,0-13.2,6.9-13.2-4.6 C1478.6,605.6,1474.9,613.8,1493.8,601.2z M1456.4,461.3c11.7-14.8,15-24.4,19.6-26.2 c0.5,3.1,1.1,178.2-5.4,184.1c-25.3,23.1-21.7,70.3-21.2-117.5 C1449.6,478.3,1448.6,471.2,1456.4,461.3z M1475.1,624.9c1.3,1.8,1,335,1,338.7 c-9-0.5-6.6,5.6-6.6-51.2C1469.4,597.3,1466.7,626.4,1475.1,624.9z M1473.8,966.9 c2.8-0.1,2.2,1,2.2,15.6c0,0,0.1,0,0.1,0c0,7.8,1.3,16.9-5.6,14.8 c-1.3-0.4-1.3-0.8-1.4-11.9C1469.1,968.4,1468.3,967.2,1473.8,966.9z M1463.5,637.8 c4.2-4.5,3.8-2.5,3.5,81.7c-1.1,294.8,1.1,277.2-5,278.3c-16.5,2.9-13.3,26.3-13.3-171.4 c0,0,0.1,0,0.1,0C1448.8,628.5,1443.8,659.3,1463.5,637.8z M1419.9,649.7c0-62.6,2.3-66.1,0.1-74.3 c3.3-76.6-6.3-54.5,19-89.1c3.5-4.8,4.1-7.5,6.3-6.9c1,0.3,3.5,168-2.7,174.1 c-22.8,22.4-22.8,41.6-22.8-3.9H1419.9z M1441.8,849.8h-0C1441.8,518.5,1441.8,695.2,1441.8,849.8 z M1425.2,681.9c19.8-20.8,13.7-40.4,13.7,146.3c0,0,0,0,0,0c0,0.8,0,168.1,0,168.1 c0.2,2.9,0.3,5.5-9.4,6.3c-5.4,0.4-5.5,0.4-6.1-5.2c-4.9-40.2-4,45.5-4-69.9 C1419.4,675.8,1416.9,690.6,1425.2,681.9z M1392.3,572c-0.1-19.9-3.7-20.2,24.1-53.1 c1.5,6.3,2.7,164.1-2.4,168.3C1384,711.9,1392.8,754.9,1392.3,572z M1390.9,967 c0-9-0.1-18,0-27c0.9-73.5,1.2,74.6,1.2-121.5c0-98.8-1.9-96,4.4-102.6 c22.8-23.6,15.5-54.4,15.5,208c0,93.2,2.7,79.7-8.2,82c-16.4,3.5-12.8,5.1-12.8-38.9 C1390.9,967,1390.9,967,1390.9,967z M1364.5,662.8c3.9-86.2-10-60.4,19.7-101.8 c3.9-5.4,5-3.3,4.9,3.3c-4,165.8,9.9,141.2-20,173.2c-1.7,1.8-2.9,3.3-4.2,2.4 C1363.8,739,1364.1,670.9,1364.5,662.8z M1364.1,800.5c-0.7-44.9-0.8-49,6.2-56 c21.8-21.8,15.1-39.2,15.1,108.4c-0.1,0-0.2,0-0.2,0c0,20.8-0.3,41.6,0.1,62.4 c0.4,22.5,0.4,57.8,0.4,57.8c0.3,5.1-5.6,1.6-5.5,8.6c0.5,32.4,3,27.8-14.5,29.6 C1358.3,1012.1,1366.7,964.4,1364.1,800.5z M1383.1,1009c-2.5,0-2.1-0-2-26.4 c0-1,1.2-3.7,3.3-3.3c1.8,0.4,1.4,1.3,1.4,15.1c-0,0-0.1,0-0.1,0 C1385.7,1008.5,1386.4,1008.9,1383.1,1009z M1337.8,634.3c-0.1-14.3,4.4-16.6,20.3-37.7 c4.3-5.7,3.8,1.9,3.8,71.9c-0.1,0-0.2,0-0.3,0c0,112.1-0.4,67.2-21.3,101.6 C1333.4,781.2,1338.5,719.1,1337.8,634.3z M1342.6,774.7c15.6-17,15.7-16.5,16.8-15.8 c0.2,0.1,0.9,245,0.9,245.2c-0,9-0.8,8.3-15.4,9.8c-1-2.5-0.6-4.5-0.8-6.4 c-0.6-8.9-7.7-1.7-7.6-9.1C1337.9,768.6,1336.5,781.3,1342.6,774.7z M1338.6,1004.9 c4.2-0.5,5.9,3.8,4.6,7.8c-0.8,2.5-6.8,1.5-6.4-3.7C1336.9,1007.4,1335.9,1005.2,1338.6,1004.9z M1327.8,634.9c1.5-1.9,2.8-3.9,5.8-4.8c1.9,12.8,0.6-23.6,0.7,83.4 c0,61.6,1.4,60.8-4.3,66.5c-17.3,17.6-16.2,17.2-18,16.8c-2.3-10.5-1.2-21.3-1.3-32 C1309,640.2,1310.4,657.9,1327.8,634.9z M1319.8,798.6c9.5-9.2,9.5-12.1,14.3-13.3 c0,1,0.1,224.7-0.4,227.8c-0.4,2.5-0.7,2.1-18.9,4.8c-3.6,0.5-1.6-182.7-1.6-183.8 C1313.5,813,1311.4,806.7,1319.8,798.6z M1285.5,699.6c-0.1-8.1,2.4-14.9,7.9-20.8 c21.2-22.6,13.7-45.5,14.5,118.5c0,7.2-1.9,7.9-16.9,23 C1282.4,828.9,1286.7,819.7,1285.5,699.6z M1307.6,960.8c1.2,55.5-8,0.9-7.9,51.4 c0,4.8,0.5,6.9-2.2,7.4c-13.8,2.3-9,15.5-8.1-108.4c0.6-91-5.2-75.2,15.8-97.5 c3.5-3.7,2.5,4.6,2.5,54.7c-0.2,0-0.5,0-0.8,0C1306.9,898.4,1307.5,959.8,1307.6,960.8z M1307,991c0.9,3.4,0.4,6.9,0.5,10.3c0.3,20.1,0.1,15.7-3.9,16.7c-1.7,0.4-2.5-0.6-2.4-2.1 C1302.6,1000.6,1297,991.8,1307,991z M1279.4,696.2c1.5-1.3,3.4-1.1,3.4,1.5 c0.1,33.4-0.7,125.1-0.6,125.2c0.6,4.2-0.6,7.5-3.9,10.4c-13.7,12.3-17.9,20.5-18,10.2 C1259.4,718.9,1255.8,717.4,1279.4,696.2z M1281.6,1018.7c0,2.7-0.8,2.2-9.2,4.2 c-0.7-5-0.4-8.9-5-10.5c-3.6-1.2-2.2,5.5-1.8-109c0.2-43.8-1.8-47.4,3.6-53.7 C1289.2,826.4,1279.9,828.9,1281.6,1018.7z M1258.8,965c0.1,0,0.2,0,0.4,0 c0-41.1,1-104.7,1.2-105.7c6.5-27-2.7,156.4,5.3,156.2c5.4-0.1,7,7.7,1.8,8.5 C1256,1025.6,1258.8,1036.3,1258.8,965z M1235.6,810.5c1.5-72.1-5.3-55.8,19.4-85.1 c4.1-4.9,2.6,8.9,2.6,63.7c-0.1,0-0.2,0-0.3,0c0,77,3.9,60.8-17.5,80.4 C1235,874,1234.4,873.6,1235.6,810.5z M1256.6,944.1c0,90.4,2.6,81.8-7.3,82.6 c-2.3,0.2-5.1,1.7-6.9,0c-1-0.9-0.7-131.9,1.1-149.1c0.4-3.9,8.9-13.5,12.3-13.2 c0.8,1.3,0.6-5.3,0.6,79.8C1256.4,944.1,1256.5,944.1,1256.6,944.1z M1239.9,1009.9 c0.3,16.2,0.4,18.5-2.9,18.7c-2.1,0.2-3-0.5-2.9-2.4c0.5-8.5-0.9-17.1,0.8-25.6 C1234.2,995.2,1235.2,723.3,1239.9,1009.9z M1211.8,888.6c4.2-127.5-9.9-101.6,17.5-133.2 c5.5-6.3,3.9,2.9,3.9,58.7c-0.2,0-0.3,0-0.5,0c0,62.1,1.2,62.5-5.1,67.2 C1220.8,886.3,1211.5,897.8,1211.8,888.6z M1226.1,1002.3c-1.3,5.7-9.6,101.2-6.4-96.9 c0.3-15.3,13.6-22.3,12.8-16.6c-0.9,6.4,0.4,97.2-0.3,108.9c-2,1.8-5.6,1.1-6.2,4.5 C1226.1,1002.3,1226.1,1002.3,1226.1,1002.3z M1226.2,1002.3c1.9,0.6,3.7-1,5.8-0 c0.8,1.7,0.6,1.1,0.5,23.3c-0,3.4-0.8,4.2-4.1,4.3C1225.7,1029.9,1226.2,1030.6,1226.2,1002.3z M1217,964.7c-0.1,0-0.1,0-0.2,0c0,69.9,1.5,67.2-4.1,66.5 C1204.7,1030.3,1217,785,1217,964.7z M1189.1,827.3c-1.4-23.3,0.4-27.4,4.3-31.6 c15.7-17.3,13.4-14.9,15.8-15.4c0,137.4,3.6,115-17,132.2 C1182.9,920,1191,859.7,1189.1,827.3z M1197.3,935.5c0.1-15.5-1.5-21.2,9.3-28 c2.1-1.3,2.2,1.4,2.2,15.5c-0.3,140.1,0.5,108.1-6.4,102.9 C1196.2,1014.7,1197,1051,1197.3,935.5z M1202.2,1026c0,7.8-4.9,6-5.2,1.6 C1196.9,1025.4,1198.8,1026,1202.2,1026z M1187.7,926.9c0.1-5.6,2.1-6,6.2-9 c3.4,3.1,0.4,100,0.9,109.8c0.2,3-3.1,4-3.2,6.7c-0.1,1.4-4.1-0-4.4-3.1 C1187.1,1031.3,1187.7,926.9,1187.7,926.9z M1174.9,992.3c0,0.1,0.1,0.1,0.1,0.1 c1.7-7.5,0.3-45.4,1.3-55.1c0.7-6.3,1.8-7.7,9-11.2c3.1,123,0.6,111.8-9.8,110.1 C1175.4,1032.2,1175.8,997.4,1174.9,992.3z M1184.3,806.2c2.6,3.1,0.1,50.5,1.2,105.1 c0.2,9.2-3,9.5-19.9,23.2C1163.4,811.3,1163.3,828.2,1184.3,806.2z M1167.1,939.7 c2-1.3,3.6-3.1,5.8-4.1c2.7,4.1-1,50.5,2,56.6c-5.3,6,5.7,46.1-8.7,46.1 C1164.3,1038.4,1162.1,943,1167.1,939.7z M1143.3,859.5c-0-4.8-0.3-10.7,4.3-15.3 c23-22.6,13.3-32,15.2,88.1c0.1,6.9-1.1,7.8-18.5,21 C1142,952,1144,960.9,1143.3,859.5z M1158.8,1038.9c-2.7,0.4-1.3-22.5-0.8-24.6 c0.4-1.5,3.4-2.2,3.6,0.3c0.2,2.8,0.1,7.2,0.1,11.1h-0 C1161.7,1037.7,1162.4,1038.4,1158.8,1038.9z M1155.5,1012.1c-1.3-1.2-0.7-2.8-0.7-4.2 c0.3-57.6-1.5-59.9,7.9-63C1162.6,998.2,1164.1,1013.2,1155.5,1012.1z M1142,1035.2 c0.3-80.9,0.2-76,2.8-77.4c9.8-5.3,7.7-14.5,7.7,39.3c-0.1,0-0.2,0-0.3,0 c0,47.4,1,43.1-3.4,43.8C1142,1041.9,1141.9,1041.9,1142,1035.2z M1121.2,905.2 c1-30.6-0.6-33.6,4.6-39c22-22.7,12.9-25.2,14.5,84.7c0.1,3.7-0.9,6.5-4.1,8.1 C1121.4,966.6,1118.2,994.7,1121.2,905.2z M1134.1,1029c-0.1-44.5-1.5-68.6,4.8-64.9 c2.3,1.3,0.1,68.4-0.1,69.4C1134.2,1032.4,1134.1,1032.4,1134.1,1029z M1137.5,1040.9 c-1.5,3.3-5.7-1.9-1.7-4.5C1136.8,1037,1138.9,1038,1137.5,1040.9z M1127.8,1043.7 c-10.5,2.1-6.9,7-7-64.9c-0-4.1,6.3-7.7,9.7-9.4c1.7,2.1,1.9,4.2,1.8,6.4 C1130,1004.3,1134.1,1042.5,1127.8,1043.7z M1099.4,978.7c1-98.9-2.3-85,16.5-102.4 c5.6-5.2,2.2,22.9,2.2,27.9c0.1,71,1.8,69-4.5,72.2c-5.9,3-10.8,9.6-13.8,8.5 C1099,982.9,1099.4,980.8,1099.4,978.7z M1117.4,980.2c1.5,0.7,0.5,4.5,0.4,59.3 c-0,3.9,0.1,5.3-2,5.5c-2,0.1-2-1.6-1.9-6.7C1114.4,999.9,1112.4,977.8,1117.4,980.2z M1099.5,1017.2c-0.4-28.9-1.7-25.2,8.1-31.3c5.4-3.3,4.1,1,4.1,29.8c-0.1,0-0.3-0-0.4-0 c0,32.9,1,30-3.8,31.1C1095,1049.7,1099.9,1047.1,1099.5,1017.2z M1093.6,897.8 c4.3-4.1,3.6,0.3,3.6,43.8h-0.3c0,54.1,4.1,44.5-15.7,57.7c-3.2,2.1-2.8-3.7-2.7-7.5 C1078.9,900.5,1074.8,915.7,1093.6,897.8z M1082.8,1003.2c11.4-5.1,8.7-16.2,7.3,36.5 c-0.2,7.1,0.8,9.3-3.1,10.1c-9.2,2-8.7-1.1-8.7-24.4h0 C1078.4,1009,1077.2,1005.7,1082.8,1003.2z M1059.2,932.4c0.2-5.7,2-6,16.3-18.3 c1.3,3,2.4,88-1.8,90.5C1054.2,1016,1055.3,1032.5,1059.2,932.4z M1071,1043.7 c-0.1,0.3,0.2,0.8,0.3,1.2c1.4,8.7,0.9,6.9-6.2,8.6c-9.5,2.3-7.5-3.9-7.5-18.1 c0,0,0.1,0,0.1,0c0-17.6-2.2-15.1,9.4-22.2c4.5-2.8,6.1-3.1,5.1,13 C1071.8,1032,1073.5,1038,1071,1043.7z M1053.5,933c2.7-2.3,2.6,2.9,2.6,4.8 c-0.4,83,0.8,76.7-3.3,80c-2.7,2.2-10.5,7.5-15.1,8.6 C1036.6,933.9,1036.5,947.5,1053.5,933z M1053.3,1051.6c0,2.1-1.1,3.4-3,3.7 c-10.8,2.1-12.9,2.3-12.8-0.7c0.1-18.3-0.8-23.4,6.4-27 C1055.5,1022,1053,1017.3,1053.3,1051.6z M1033.3,950.2c6.6-5,0.4,27.5,2.4,74.8 c0.2,5.1-11.3,10.7-17.9,13.7C1018.3,954.4,1013.9,965,1033.3,950.2z M1032.9,1034.4 c6.2-2.1-1.9,46.7-1.9,12.1h0C1031,1036.3,1030.5,1035.2,1032.9,1034.4z M1019.3,1052.3 c-5.3-8.9,9.9-18.1,10-11.7c0.2,16.8,0.8,17.9-3.4,18.1 C1020.8,1059,1026.1,1055.3,1019.3,1052.3z M1020.8,1057.6c0.1,1.3-1.5,1.5-1.9,0.5 C1018.5,1056.9,1020.6,1055.6,1020.8,1057.6z M1005.2,972.9c6.2-4,8.7-8.9,10.5-3.7 c0.8,2.3,1,4.8,0.6,7.1c-3,17.6,3.4,62.2-5.1,66c-8.1,3.7-8.9,5.5-11.3,4.5 c-0.8-1.6-0.5-3.4-0.5-5.2C999.3,979.7,997.6,977.8,1005.2,972.9z M1015,1057.4 c0.1,4.1-2.5,3.6-13.6,5.2c-3.8-10.5,4.1-13,10.9-16.6 C1015.7,1044.2,1014.8,1049.1,1015,1057.4z M979.8,1037.4c0.4-39.3-1.7-45.3,6.6-50.3 c14.1-8.5,10-19,10,59.1c0,3.4-1.1,5.3-4.3,6.2c-4,1.1-7.1,4.3-12.3,4.6 c0.7-5-1.7-9.8,1.1-14.3C980.3,1041,979.8,1039.3,979.8,1037.4z M983.4,1065.8 c-0.5-2.3-0.6-4.5,1.4-5.8c3.3-2,6.7-3.9,10.4-4.9c0.3,0.4,0.6,0.6,0.6,0.8 C995.9,1063,996.5,1064.7,983.4,1065.8z M976.6,994.8c3.2,2.6,1.2,39.1,1,42.3 c-0.5,7.7-4.4,1-4.3,10.7c0,11,0.6,17.2-5.2,14.9c-4.7-1.9-6.5,2.9-6.5-7.9 C961.4,998,958.8,1007.4,976.6,994.8z M977.3,1057.8c-0.4,3.5-5.7-0.4-2.4-12.2 C975.2,1044.6,979.2,1042.5,977.3,1057.8z M958,1009.2c1.3,1.6,0.9,3.2,0.9,4.6 c0.1,62.2,3.5,54.6-12.4,57.4c-2.1,0.4-3.3-0.7-3.3-3 C943.9,1026.8,940.2,1013,958,1009.2z M926.1,1048.2c0.1-14.3-0.9-18.9,4.1-21.5 c6.4-3.3,10.9-9.2,11.1-2.2c0,1.4,0.3,25.7-0.7,32.1c-1,6.8,2.6,15.9-3.7,16.7 c-12.4,1.5-13.9,6.1-9.3-21.7C927.8,1050.6,926.1,1049.6,926.1,1048.2z M908.5,1047.8 c0-5,1.1-8.9,5.3-11.1c5.4-2.9,9.4-6.7,9.6-1.5c0.5,13.9,0.2,15-2.3,16 c-3,1.3-3.5,15-2.5,19.2c-2.5,0.1-4.5-0.2-6.3,0.8c0.5,1.8,5.1,1.7,4.3,3.9 c-0.3,0.8-0.8,1.7-1.5,1.9C906.5,1080.6,908.4,1068.5,908.5,1047.8z M920.3,1064.1 c0.6-10,0.3-9.2,1.5-9.7c0.7-0.3,1.2,0.6,1.2,1.2c0.1,18.9,0.4,18.6-1.1,18.8 c-1.5,0.1-1.2-0.7-1.2-10.3C920.6,1064.1,920.5,1064.1,920.3,1064.1z M891.6,1054.4 c0.2-6.9,4.8-7.6,9-9.9c6.5-3.5,5.2-0.9,5.2,16.2c-0,0-0,0-0,0 c0,20.8,2.6,17.5-11.8,19.4C891,1080.6,891,1079.5,891.6,1054.4z M874.9,1064.6 c0-2.4,3-2.3,1.4-4.4c-2.1-2.7,1.9-3.3,7.3-6.4c6-3.5,5-0.9,5,13.1 c-0.1,0-0.1,0-0.2,0c0,15.2,2.3,14.6-10.6,16C874.1,1083.3,874.9,1081.5,874.9,1064.6z M862.6,1064.5 c1.6-0.6,2.9-2,4.8-1.6c1,7.8,0.6,10.7-2.9,16.6c-1.7,3,10.5,4-5.9,6.9 C858.2,1068.4,858.5,1066.1,862.6,1064.5z M842.6,1081.7c0.4-5.7-2.4-10,13-12.9 c0,19.4,1.8,18.1-6.8,19.3C841.1,1089.4,842.1,1089,842.6,1081.7z M827.7,1080.9 c0.6-1.7,1.3-1.6,10.4-4.8c2.8,3.8,1.8,8,1.7,12c-0.1,2-2.2,2.1-10.6,3.6 C825.2,1092.4,825.9,1086.1,827.7,1080.9z M820,1090.8c-0.4,3.5-7,3.6-8.2,3.3 C807.3,1088.5,821.6,1075.6,820,1090.8z M807.5,1088.9c1.1,1.2,1.5,5.9-1.6,6.5 C784.9,1099.3,803.8,1084.9,807.5,1088.9z M792.8,1095.8c0.2,2.6-1.5,2.4-7.1,3.2 C777.8,1095.6,792.5,1090.4,792.8,1095.8z M730.1,1106.1c2.5,0.3,0.7,3.8-1.3,3.5 C727.2,1109.4,727,1105.8,730.1,1106.1z M716.6,1104c-0.4-0.2-1.3-0.7-1.3-0.9 C716,1101.1,722.5,1103.3,716.6,1104z M718.9,1107.8c1.7,0.4,1.4,3.1-0.1,3.5 C712.2,1113.3,713.3,1106.3,718.9,1107.8z M703.8,1099.6c5.5-1.8,13,5.7,0.2,5 C701.2,1104.5,701.3,1100.4,703.8,1099.6z M704,1108.6c4.2,0.2,3.7,6-0.7,5.6 C700,1113.9,699.8,1108.4,704,1108.6z M699.4,1101.7c0.2,4.5-7.8,4.8-7.8-0.6 C691.7,1095.4,699.2,1095.9,699.4,1101.7z M686.8,1116.1c-0.8,2.7-4.2,2.9-4.5-0.5 c-0.6-5.8,4.9-11.2,4.9-2C687.2,1113.6,687.2,1114.9,686.8,1116.1z M678.7,1092.4 c1-0.4,7.9-0.6,8.1,6.9c0.1,5.6-0.4,6-5.9,4.9C676.9,1103.5,677.9,1096.4,678.7,1092.4z M677.8,1109.1c2.4-1.3,4.8,9.3,0.5,10.1c-1.6,0.3-1.5-1.8-1.9-5.3 C677.2,1112.2,675.8,1110.2,677.8,1109.1z M665.5,1095.2c0-5.7-0.3-7.1,2.1-7.1 c8.1-0.3,6.8,7.1,6.6,13.4c-0.1,2.4-2.2,2.5-5.9,1.8c-3.6-0.7-3.1-2.3-2.8-8.1 C665.6,1095.2,665.5,1095.2,665.5,1095.2z M674.2,1118.3c-0.2,1-4.6,6.3-3.6-7.9 C670.7,1108.5,676.2,1106.3,674.2,1118.3z M665,1112.6c0.5-10.4,4.9,1.3,1,8.7 C664.6,1117.7,664.8,1115.1,665,1112.6z M659.5,1084c3.8,1.1,3.2,4.2,3.2,10.2h-0.1 c0,6.1,1.4,10-7,7.6c-1.6-0.5-1.7-0.8-2-17.6C653.6,1080.8,657.9,1083.5,659.5,1084z M657.4,1123c-3.8-19.2,5-17,5.3-13.4C663.7,1121.2,664.9,1121.9,657.4,1123z M652,1121 c-0.2,4.6-7,6-7.3,3.3c-1.2-11.4-1.2-18.6,3.8-18.2C652.2,1106.4,652.7,1107.5,652,1121 z M643.1,1077.7c1.9-0.5,8.1,0.9,7.7,6.5c-1,16.4,1.7,17.8-3.2,18.2 c-5.6,0.4-5.2-2.4-5.2-5.3C642.3,1078.3,642,1078.9,643.1,1077.7z M630.9,1071 c11.5,1.2,9,10.6,8.9,26.8c-0,3.1-4.2,2.4-7.1,1.5C630,1098.4,630.6,1097.7,630.9,1071z M631.2,1115.7c0.5-9.9-0.3-12.6,3.8-12.1c5.6,0.8,5.1,2.3,4.8,20.2 c-0.1,2.7,0.4,3.2-5.9,4.2c-2.8,0.4-2.2-1.9-2.2-12.3C631.5,1115.7,631.4,1115.7,631.2,1115.7z M620.9,1130.2c-1.2-4.7-0.4-9.3-0.6-13.8c-0.2-3.3,4.7-2.7,1.5-5.7 c-2.7-2.5-1.7-5.6-1.2-8.5c0.3-1.7,2.5-0.7,5.3,0c2.3,0.6,2.4-0,2.5,22.5 C628.4,1128.6,628.4,1130.2,620.9,1130.2z M618.8,1080.3c0.2,0,0.3,0,0.5-0 c0-11.5-1-16.6,3.6-14.6c6.3,2.8,4.3,4.6,4.7,29.2c0,1.7-0.8,2.4-2.3,2.4 C617.4,1097.8,618.8,1092.9,618.8,1080.3z M608.4,1115.5c0-14.8-1.1-18.4,4-17.2 c1.8,0.4,6,1.1,4.2,9.9c-3.5,17.7,0.4,23.7-4.6,24.5c-3.9,0.6-3.1-0.5-3.1-17.2 C608.7,1115.5,608.5,1115.5,608.4,1115.5z M609,1058.5c6.5,2.2,7.6,3.5,7.5,9.5 c-0.1,26,1,28-4.4,26.3c-3.7-1.2-4.3-1.9-4.4-6.1 C607.2,1066.9,606.8,1063.9,609,1058.5z M598.5,1051.2c4.8,1.4,7.4,4.2,7.2,9.5 c-1,29.5,1.4,31.6-3,30.6c-3.4-0.8-5.8-1.1-5.8-4.2C596.8,1053.8,596.4,1055.2,598.5,1051.2 z M605.2,1098.9c0.7,40.3-0.4,34.3-8.4,36.4C591.2,1077.7,605.2,1097.3,605.2,1098.9z M589.3,1044.4 c6.9,3.2,5.3,2.1,5.2,35.4c-0,6.1,0.8,7.7-1.9,8c-8.2,0.8-6.5-7.5-6.5-23.2 c0,0,0.1,0,0.1,0C586.2,1046.1,585.2,1042.5,589.3,1044.4z M586.6,1090.8 c8.6,0.8,7.6-0.6,6.9,39.2c-0.1,7.5-6.5,8-8.5,7.1c0-14.3-0.4-15.1,1.6-16.2 c0.7-0.4,0.7-1.3,0.2-1.6C582.6,1117,585.6,1095.2,586.6,1090.8z M577.5,1035.9 c4.2,1.6,6.5,4.2,6.4,9.2c-0.5,15.4,0.1,32.6-0.5,37.4c-0.3,2.8-7.9,1.2-8-5.7 C575.2,1039,574.8,1038.7,577.5,1035.9z M577.6,1086.5c7.9,1.9,4.2,3.6,4.7,27.9 c0.2,8.5-2.7,4.1-2.7,11.8c-0.1,11.8,0.7,13.8-2.8,14.2c-3.9,0.4-4-4.2-3.6-8.1 C576.3,1106.2,569.5,1084.6,577.6,1086.5z M566.8,1026.9c1,0.2,6.3,3.4,6.3,8.4 c-0.2,45.3,1.6,45.8-3.9,43.7c-2.8-1.1-4-2.7-4-5.9 C565.7,1027.8,564.2,1028.6,566.8,1026.9z M563.6,1086.7c0.1-8.9,6-4.3,7-2 c1,2.3,0.6,51.4,0.6,52.4c-0,4.5-0.3,4.8-4.4,5.7C562.2,1143.9,562.6,1144.8,563.6,1086.7z M555.4,1046.8c1-27.2-0.7-27.4,1.4-27.6c2-0.2,5.9,3.4,5.8,7.5 c-0.7,52.9,0.2,43.4-0.7,47.2C553,1077.7,555.1,1056.4,555.4,1046.8z M554.9,1076.3 c6.4,2.5,4.7,0.1,4.6,60.6c-0,8.5-5.4,9-5.8,5.7C553.5,1141.4,553.8,1081.9,554.9,1076.3z M545.2,1030c0.2-19.7,0.2-20.4,2.9-19.2c6.8,3.2,3.8,6.3,4.5,52.6 c0,2.6-0,5.5-2.4,5C543.8,1066.9,544.8,1066.7,545.2,1030z M544,1109.6 c0.1,0,0.2-0,0.3-0c0-37.4-0.4-36.4,1.4-36.9C555.1,1070.3,541.9,1211.3,544,1109.6z M536.8,999.9c4.6,2.2,5.7,5.4,5.7,9.8c-0.7,54.1,1.4,54.8-3,53.1 c-3.1-1.2-4.9-3-4.8-6.8C535.4,1002.8,533.8,1003.1,536.8,999.9z M540,1147.8 c-1.6-2.6,1.4-77.9,1.5-78.9C543.4,1072.4,541.3,1146.1,540,1147.8z M534.9,1066.4 c5.2-0.4,3.7-0.9,2.3,77.4c-0.1,3.7,0.1,5.7-2.5,5.7C531.7,1149.5,534.8,1067.4,534.9,1066.4z M532.8,1067c-4.3,174.7-4.4,32.4-2-3.8C533.2,1064.4,532.9,1065.8,532.8,1067z M525.8,990.4 c0.4-3.3,6.4,3.6,6.3,8.8c-0.5,33.7,0.2,53.5-0.5,57.9c-2.8-0.4-3.5-2.7-5.3-3.5 C524.4,1052.7,525.5,992.8,525.8,990.4z M524,1106c0.1,0,0.2-0,0.3-0 c0-44.1-0-42.1,0.1-44.7c0.1-1,3.7-3,3.5,5.9c-1.2,82.5-0.5,86-3.5,84.7 C522.6,1151.1,523,1154.6,524,1106z M516.2,980.8c0.5-3.1,6.2,2.6,6.2,9.5 c-0.5,40.5,0.3,51.9-0.8,60.3c-5.1-1.2-6.4-4.2-6.4-8.8C515.9,986,514.5,992.4,516.2,980.8z M519.3,1102.3c-0-2.8-0.1-5.6,0-8.3c0.1-2.8,0.2-5.6,0.2-8.4V1058.5 c0-0.6,0.3-1,0.8-1.2c0-0.4,0-0.4,0-0c0.8-0.3,1.9,0.1,1.9,1.2v93.7 c0,1.7-2.7,1.7-2.7,0c0-2.5,0-4.9,0-7.4c0-5.5,0-10.9,0-16.4c0-5.6,0-11.2,0-16.8 c0-1.4,0-2.8,0-4.2c0-1.7,0-3.3-0.2-5c-0,0.1-0,0.3-0.1,0.4 C519.3,1102.6,519.3,1102.4,519.3,1102.3z M515.6,1053.1c3.4,0.9,0.5,98.5,0.4,99.5 c-0.2,2-3.2,2.6-3.3,0.1C512.8,1151.7,514.3,1054.4,515.6,1053.1z M506.9,969.1 c2.3-0.8,6,5.2,5.9,11.6c-0.9,58.9,0.8,60.1-0.8,63.2c-5.1-1.7-6.5-4.9-6.5-9.7 C506.4,969.2,504.7,969.8,506.9,969.1z M509.1,1154.6c-2.8-0.1,0.6-104.2,0.7-105.2 c1.8,0.4,2.7,1,2.8,2.2C512.7,1052.7,512.5,1154.7,509.1,1154.6z M506.1,1047.1 c2.6,1.6,2.1,3.5,2.1,5.1c-3.5,100.5-1.6,100.2-3.8,103.3 C502.8,1153.2,505,1051.1,506.1,1047.1z M499.6,958.8c4.7,4.5,3.7,5.9,3.7,19.8 c-0.2,63.3-0.1,53.4-0.3,58.5c-5-1.9-6.6-5-6.5-9.4C497.4,964.1,495.3,954.8,499.6,958.8z M501.2,1156c-0.4,1.6-2.9,2.1-3.8,0.7c-0.5-0.2-0.9-0.6-0.9-1.2V1044c0-0.8,0.6-1.3,1.3-1.3 c0.3-0.3,0.8-0.4,1.3-0.3c0.2-0.2,0.5-0.3,0.8-0.3c0.4,0,0.7,0.1,0.9,0.4 c0-0,0-0,0-0C505.4,1040.3,501.5,1155,501.2,1156z M487.6,986.3 c0-11.6-0-23.1,0-34.7c0-9.2,6.8-0.6,6.7,6.2c-1.2,74.2,1.3,71-1.7,71.9 c-6.9,2.1-4.9-17.8-4.9-43.3C487.7,986.3,487.6,986.3,487.6,986.3z M489.9,1034.6 c3.8,1,4.8,3.2,4.7,6.4c-5.1,121.3,0.1,119.2-6,119.6 C486.5,1160.8,486.2,1168.2,489.9,1034.6z M480.2,935.2c3.2,3.1,4.9,6,4.9,10.1 c-0.6,77.1,0.5,75.8-1.1,77c-1.1,0.8-5.9-3-5.8-9.5C479.1,937.6,477.4,939.3,480.2,935.2z M479.5,1025.1c4.1,2,5.4,4.3,5.3,7.7c-0,1-2.2,123-2.5,126.9 c-0.4,3.8-5.1,3.8-5.3,1.7C476.5,1157.3,479.5,1047.6,479.5,1025.1z M469.1,965.5 c0-32.8-1-46.9,2.1-42.7c6.4,8.6,4.8,1.4,4.6,81.4c-0,8,0.4,8.7-1.5,9.8 c-7.2-4.7-5.3-4.5-5.3-48.4H469.1z M476.3,1025.4c-3.8,151.7-0.2,137.8-8.7,139.4 c-0.9-8.4,2-141.3,3.1-147.6C474.9,1018.5,476.4,1020.9,476.3,1025.4z M460.7,910 c8.9-2.9,6.6,37.1,6.6,96.3c-3.1-1.5-4-3.3-5.4-4.6C458.9,998.8,459.7,910.3,460.7,910z M460.8,1006.4c4.8,3.3,6.4,6.6,6.3,11.6c-4.5,149.6-2.2,146.8-4.4,148.4 C457.3,1170.3,455.1,1178.2,460.8,1006.4z M448.5,1170.6c-0.8-4.8,2.4-161.2,3.5-171.5 c5.6,2.3,6.4,3.4,6.3,9C454.8,1186.2,457.1,1170.6,448.5,1170.6z M452.2,898.3 c6.3,3.8,8.1,1.3,5.6,98.4C449.3,991.4,452.2,996.4,452.2,898.3z M444.8,885.7 c6.3,7.3,4.5-1.2,4.5,102.5c-6.3-3.4-5.7-6.8-5.7-10.3C443.7,880.6,443.3,887.3,444.8,885.7z M449.3,998.8c-11.7,394.8-10.3-4.9-6-10.3C447.2,990.8,449.5,993.6,449.3,998.8z M436.6,872 c2.4,4.7,5.2,8.8,5.1,14.4c-0.4,52.7,0.1,80.9-0.5,92.4c-4.7-3.1-6.6-6.3-6.5-11.3 C435.9,870.6,434,874.6,436.6,872z M436.9,1164.6c-0.2,9.4,0.8,10.4-7.4,10.9 c1.8-65.2,3.2-130.4,5.2-196.3C442.3,984.4,440.4,969.9,436.9,1164.6z M427,859 c3.7,4,6.1,8,6,13.8c-0.8,50.8,0.5,86.9-0.8,96.4c-3.7-3.2-5.7-5.9-5.7-10.3 C426.9,894.4,426.6,864.6,427,859z M432.4,979.3c-14.3,435.4-8.8,19.5-6.6-10.2 C430.3,971.8,432.6,974.2,432.4,979.3z M420.4,846.7c5,6.6,3.9-6.4,3.9,112.5 c-4-3.7-5.7-6.6-5.7-10.7C419.7,841,418.6,848.4,420.4,846.7z M422.8,969.2 c-12.9,478.2-8.4,3.1-4-10.1C422.3,962.3,422.9,965.5,422.8,969.2z M411.3,832 c7.6,8.8,4.9,1,4.9,117.7c-4.6-3.6-5.8-6.9-5.7-11.2C410.6,924.3,410.4,852,411.3,832z M409.3,1153.7c-0.5,25.7,0.2,26.8-4.5,27.1c-0.6-6.3,4.3-224.8,5.1-231.7 C415.1,949.7,413.8,938.2,409.3,1153.7z M403.4,819c4,4,5.1,5.7,5.1,9 c-0.2,121.1-0.1,107.7-0.9,111.3C401.9,930.5,397.6,941,403.4,819z M400.7,937.5 c4.7,1.3,3.6,1.4,3.6,34C399,972,400.3,970.3,400.7,937.5z M399.7,838.3c0-0.4,0-0.9,0-1.3 C400.2,837.3,399.9,837.8,399.7,838.3z M399.4,848.1c0.2-0,0.4-0,0.6-0v32.6 C399.2,875.5,399.4,872.9,399.4,848.1z M1669.6,1298.3c-6.4-0.5-6.5-4-8.3-1.7 c-3.7,4.6-14,2.9-20,2.2c-6.6-0.8-3.6-7-7.7-7.8c-3.9-0.7-6.4,0.3-7.5,1.5 c-6.6,7.6-7.1,0.5-9.5,1.5c-7.8,3.4-5.7-2.1-9.6,0c-3.3,1.8-5.2,5.9-9.6,4.3 c-5.5-2-6.4,3-8,4.7c-5.5,5.7-6.4-2.3-8.9-1.5c-3.4,1.1-7.3,0.6-10.4,2.8 c-3.2,2.3-4.9,4.7-8.4,2.2c-11.2-8.3-15.5,9.1-17.3,8.8c-1-0.2-2.7-1-2.7-1.5 c-0-4.6-5.4-6.8-7.9-0.8c-1.7,3.9-4.8-4.2-15.5-4.2c-8.8-0.1-9.7,0.2-11-0.8 c-7.7-6.2-9.8,6.7-16,4.2c-2.2-0.9-7.4-0.2-8.2-1.4c-2.9-4.1-6.9-3.2-13.2-4.1 c-1.6,1.3,0.5,2.3,0.2,3.4c-0.4,1.2-0.9,2.3-0.6,3.7c1,4.6-11.4,4.1-12.2,3.1 c-1.9-2.4-4.1-3-6.9-1.8c-2.3,1-5.1,0.2-6.8,3.1c-3.3,5.8-7-1-11.7,3 c-5.4,4.6-6.6-2.6-9.4,0.1c-7.3,7.1-21.4,2.1-24.9,3.6c-6,2.4-23.6,1.4-26.7-2.8 c-3.2-4.4-5.5,4.3-11,2c-8.8,2.3-17.9-1.2-26.7,1.6c-4.2-1.2-8,1.2-12.1,1.5 c-35.2,2.4-17.5-3.3-29.2-5.1c-15-2.2-15.9,9.7-25.9,6.1c-6.9-2.4-14.7,0.5-20-2.6 c-6.8-4-12.8-0-16.5,0.2c-7.5,0.4-3.1-5.3-11.4-4.8c-1.2,0.1-7.5,0.4-8.2-1.2 c-1.6-3.8-2.6-2.6-27.1-2.8c-6.7-0.1-8.3,3.7-14,2.8c-6.4-1.1-38.7-1.4-38.7-1.4 c-4.4-3.6-25.1-4.7-26.6-2.3c-2.1,3.4-3,2.7-26.6,2.5c-11.2-0.1-5.8-10.8-32.2,6.4 c-2.4,1.6-3.7-1-5.4-0.8c-1.7,0.2-2.5,3.2-4.3,2.5c-2.2-0.9-4.7-0.3-6.8-1.9 c-11.3-8.6-18.4-0.8-25.1-3.7c-0.8-0.3-1.9-0.5-2.5-0.2c-7.3,3.6-17.7-0.9-21.5,3.7 c-1.9,2.4-8.4,3.2-9.6-0.2c-3.4-9.8-11.4,2-17.5,0.7c-0.5-0.1-1.5,0.3-1.8,0.7 c-3.7,6.6-11,0.3-14.8,3.1c-6.2,4.6-8.3-2.3-23.7,0.8c-1,0.2-9.7,1.8-10.9,0.8 c-8.7-6.7-14.4,5-22.2-0.6c-10.8-7.8-14.5,3.7-20.4,2.3c-3.8-0.9-4.1,2.3-8.8,1 c-9.6-2.7-6.6,4.1-12.4,3c-15.7-3.1-39.3,5.3-44.3,0.1c-6.5-6.8-12.7,0.6-26-0.2 c-6.7-0.4-3.8-10-8.6-7.6c-4.8,2.4-2.7,11.4-10.5,9.4c-12-3.2-19.1,2.5-24.6,1.6 c-14.7-2.4-21.3,2.8-25.3-4c-1-1.6-3.4-2-4.7-0.8c-3.7,3.6-8,1.6-11.7,0.9 c-15.5-2.9-23.7,0.9-32.9-1.9c-4.4-1.3-6,1.4-8.3,0.4c-5.9-2.4-13.9,2.5-18.7,0.7 c-2-0.7-20.2-3.6-25.6-0.3c-6.4,4-11.8-4-18.8,1.9c-1,0.9-32.9,3.9-47.1-1.8 c-2.4-0.9-9.3,2.1-15.6-0.4c-1.4-0.5-7.9-2.1-8.9-1c-4.5,4.7-16.6-2.5-32.5-1.9 c-4.9,0.2-8-6.7-19.2-2.4c-9.8,3.7-25.9,1.9-28.3-0.6c-2-2.1-4.7-2.1-7.4-1.9 c-7.8,0.7-14.9-2.2-22.2-4.2c-3.6-1,1.3-45.8,0.6-80.8c-0.7-41.2,1024-175.5,1290.8-187.2 c-0.4,19.2,1.2,25.1-2.4,26.1c-2.7,0.8,4.8,1.3,0.2,3.1c-0.6,0.2-1.3,0.3-1.5,1.1 c0.7,2.1,5.9,3.8,5.9,10.4C1687.5,1308.1,1698.7,1300.5,1669.6,1298.3z M1678.5,355.2 c5.4-9.1,3.1,297.1,3,298.2c-0,1-0.6,356.7-1.9,307.3C1679,937.9,1672.9,364.7,1678.5,355.2z M1689.5,448.2c-4.2,4.5,1.9,74.4-3.9,79.3c-0.8,0.1-1.1-73.7-1.1-74.4 c0.4-117.4-6.8-99.5,6.7-112.6c0.5,0.1,0.9,0.2,1.4,0.3 C1689.6,407.4,1694.6,442.8,1689.5,448.2z M1695.7,169.3c-0.5,125.4,0.4,166.3-17.4,171.7 c-1.9-1-1.6-2.8-1.6-4.5c-0.3-238.6-2.7-207.6,15.5-237.6 C1698.2,89,1695.9,119.8,1695.7,169.3z M1810.8,148.2c-1.1,2.5-14.8,25.8-16.3,20.7 c-0.1-0.4-0.5-0.9-0.4-1.2C1796,155.8,1786.4,139.5,1810.8,148.2z M1797.8,462.3 c-3.5-0.2-4.2-1.4-4.3-3c0-0,0.3-123,0.3-123c0.4-6.2,2.6-0.8,21.9-2.1 c10.8-0.7,8.4-2.2,8.4,94.6h-0.1C1823.9,471.3,1829.9,464.1,1797.8,462.3z M1820.5,698.5 c-20.7-1.9-26.2,2.4-26.6-4.2c-0.5-10.1-0.1-151.9-0.1-153c0.2-6.7,0.3-4.2,16-3.9 c18.1,0.3,14.3,8.2,13.8,140.3C1823.6,694.9,1825.3,699,1820.5,698.5z M1755.3,187.4 c0.1,0,0.1,0,0.2-0c0-12.2-0-24.5,0-36.7c0-12.9,0.9-4.4,31.8-4.7 c5.3-0.1,3.4,0.4,3.6,26.8c0.1,10.6-30.8,48.4-31.8,54.8c-0.4,2.3-3.6,2.8-3.7-0.9 C1755.3,215.9,1755.3,207.4,1755.3,187.4z M1798.8,945.9c2.9,0.3,2.9,2.6,2.4,8.4 c-0.2,2.5-1,3.4-3.5,4c-3.3,0.9-3-1.1-3-5.3h0 C1794.7,949.9,1794,945.4,1798.8,945.9z M1794.6,1053.9c-3.6,4-9.2-6.8-9.8-8 C1809.5,1039.4,1799.6,1048.4,1794.6,1053.9z M1784.1,926.9c4.9-0.4,4.2,0.1,3.9,26.6 c-0,3.7,0.3,6.2-7.1,5.3c-1.1-2.6-0.6-5.3-0.6-7.8C1780.2,928.7,1779.5,927.2,1784.1,926.9z M1780.7,206.9c10.8-15.6,6.3,11.2,6.3,17.7c0.1,44.1,1.7,42.4-3.9,42.3 C1752.7,266.2,1738.4,267.7,1780.7,206.9z M1754.9,536.7c2.2-1.4,4.1-1.8,6.1-1.7 c28.5,1.5,25.8-0.1,25.8,7.5c0.8,170.1,1.4,155.5-4.9,154.9c-6.9-0.7-24.1-3.1-26-3.4 C1754.3,691.1,1755.8,587.4,1754.9,536.7z M1755.2,424.7c-0.7-103.6-5.5-95,18.5-92.6 c11,1.1,13.6-1.1,13.5,4.7c-2.4,131,3.5,124.4-4.4,124.9c-10.2,0.5-22.5-2.7-24.7-2.8 C1753.8,458.7,1755.4,457.7,1755.2,424.7z M1783.2,779.7c4.4,0.2,4.6-1,4,24.3 c0,0,0.7,113.1,0.7,113.1c0.7,7.8-10.2,0.7-11.1,13.5c-0.5,6.5,0.8,8.6-2.4,9.3 c-4.8,1.1-8.7,1.1-7.1,6.4c1.2,4,2.9,15.6-3.5,15.8c-10,0.3-8.2,0.8-8.2-22.3h0 c0-5,0.1-10.1-0-15.1C1750.8,757.3,1750.9,778.4,1783.2,779.7z M1773.4,960.2 c-0,1.9-3.1,2.9-3.2,0.4c-0.1-13.4-0.4-14,1.7-15 C1773.5,946.8,1773.4,947.3,1773.4,960.2z M1743.2,144.6c1-0.2,9.6-3,9.1,0.8 c-0,0,0.3,47.2-0.8,60.3c-2.5,28.1,6.9,27.4-11.9,49.3c-2.7,3.1-6.5-3.9-6.4-10.2 C1734.4,153.7,1731,146.8,1743.2,144.6z M1744.9,833.8c-0.1-11.1,2.2-3.7,2.6-13.9 c0-1.3,1-21.9,1.9-24.1c2.1,1,1.7,2.9,1.7,4.6c1,168.2,1.4,161.8-6.7,161.1 c-3.4-0.3-2.5,0.2-3.2-68.3C1740.5,831.3,1745.2,891.5,1744.9,833.8z M1745.3,259.1 c1.4-1.8,1.9-4.4,4.6-5.8C1755.4,268.5,1742.4,262.9,1745.3,259.1z M1736.5,402.1 c0.3-12.5-1.7-66.5,9.7-69c5.9-1.3,4.3-5.3,4.9,73.6c0.4,54,2.7,52.9-10.7,45.2 C1733.6,448,1736.3,413.7,1736.5,402.1z M1743.6,565.9c-0.2-8.6-0.2-10.1,1-12.3 c2.2-4-0.3-11.1,5.1-12.8c1.8,4.7,1.9,9.4,1.2,14.2c-1.9,11.6,0.2,132.2,0.2,133.2 c0,3.1-0.9,3.8-4,3.4c-7-0.8-6.6,9.4-7.4-113C1739.5,569,1743.8,573.7,1743.6,565.9 z M1741.3,1103.9c2.6-14.5-2.8-15.6,5.5-23.3c-2.5-0.6-4.1-2.1-3.2-4.5 c1.4-3.8-0.8-5.3-0.8-8.8c-0.1-9.7,7-0.6,7.1-9.8c0.1-7-7.4-1.4-6.1-7 c0.4-1.9,0.4-1.7,13.5-2.4c2.9-0.2,2.7,0.7,15.2,15.7c1.8,2.2,2.4,14.6-0,17 c-3.9,4-27.2,32.3-29.6,35C1741.5,1111.4,1740.6,1107.6,1741.3,1103.9z M1761.5,1205.5 c-1.3,1.4-8,5.2-4.5,10.6c2.3,3.6-20.9,82.1-14.7-39.8c4.5,3.1,6.5,7.1,9.3,10.4 C1765.1,1202,1764.7,1202.2,1761.5,1205.5z M1773,1174.3c-0.4,1.6-2.4,1.8-3.8,0.5 c-12.2-11.6-10.2-13.8-9.1-18.6c0.3-1.5,2.1-1.1,10.6-1.1c0,0.1,0,0.2,0,0.3 C1789.2,1155.4,1776.1,1161.6,1773,1174.3z M1799.2,1111.4c-2.3,11.6-7.8,16.7-13.1,23.4 c-2.6,3.3-4.5,2.6-14.9,2.6c0-0,0-0-0-0c-12.6,0-13,0.7-13.3-3.7 c-0.4-5.3-1.2-3,29.3-40c6.2-7.6,7.2-0.9,12.8,4.5 C1803.7,1101.7,1800.9,1102.5,1799.2,1111.4z M1820.3,953.8c-2.5-3.3,1-14.9,0.4-16.6 c-2.2-6-5.7-0.2-4.8,1.8c2.2,5,0.9,10.3,1.1,15.5c0.1,1.9-1.9,2.5-8.1,2.4 c-4.9-0-2.9-1.7-3.9-7.2c-1.7-9.9-7.3-8.2-9.8-9.6c-0.8-2.3-0.4-4.7-0.4-7.1 c-0.2-154.9-10.6-165,25-150.3c3.7,1.6,6.7,3.3,4.9,8.1 C1824.6,791.7,1828.7,965.2,1820.3,953.8z M1824.6,266.7c1,3.8-33.7,3-30.9-2.2 c0.8-1.6-2.3-74.7,4.5-84.5c19.9-28.7,17.4-30.7,23.9-24.6 C1829.2,162.1,1823.2,261.2,1824.6,266.7z M1827.6,147.7c26.1,6.5,23.7,29.6,11.2,12 c-4.5-6.3-8.5-5.7-12.6-8.7C1824.5,149.8,1825.5,147.2,1827.6,147.7z M1827.8,217.4h0 C1827.8,261.2,1827.8,305.5,1827.8,217.4z M1833.3,560.9c4,0.9,4.2,2.4,3.6,12.7 c-0.4,7.6,4.3,4.3,4.2,11.9c-1.1,76.9,1.5,75-1.3,77.1c-4.6,3.4-3.5,23.7-2.3,24.6 c3.1,2.2,1.4,5.2,1.8,7.9c0.4,2.6-5.2,4.5-4.9,1C1834.3,696,1833.3,571,1833.3,560.9z M1841.1,890.2c-3.6,13.4,3.1,61.6-3.1,62.3c-4,0.5-4.2-120.1-2.9-119.4 c4.5,2.2,0.4,30.6,3.2,34c3.4,4,0.2,13.9,2.8,21.2C1841.4,888.8,1841.3,889.6,1841.1,890.2z M1842.2,427.8c2,6.6-1.3,16-0.5,20.4c0.4,2.1,4.2,3.6,1.5,5.9 c-4,3.5-0.8,9.1-7.1,8.6c-5.2-0.4-1.5-1-2.6-119.2c-0.1-7.1,9.3,5.6,7.8,13.2 c1.7,4.6,2.5,9.9,2.9,39.7c0.4,27.2,0.5,26.7-1.3,28.4C1842.1,425.5,1841.9,426.9,1842.2,427.8z M1848.6,183.1c-1,92.1,1.7,85.7-5.8,85.8c-11,0.2-8.5,6.1-8.5-49.7h0.1 c0-41.2-1.3-54.1,3.9-50C1848,176.8,1848.6,177.1,1848.6,183.1z M2037.5,219.5 c0.1-16,2.5-5.7,31,13.6c18.4,12.4,7.2,20.5,10.4,84.4c-2.1,4.8,1.1,9.9-0.9,14.7 c0.9,3,0.8,5.8-0.7,8.7c-2-0-3.8-0.8-5.2-2.3c-4-4.4-12.3-7.2-14.7-11.7 c-0.9-1.7-2.5-2.4-4.3-2.8c-5.7-1.5-9.4-6.3-14.3-9C2036.7,314,2037.4,220.5,2037.5,219.5z M2039.8,918c0.1-2.4,0.8-3,3.3-2.8c9.1,0.9,8.4,1.9,8.8,10.7c0.2,3.7-1.9,3.5-6.8,3.5 v-0C2039.6,929.3,2039.2,930.1,2039.8,918z M2040.9,911.3c-1.7-1-1.2-2.4-1.3-3.6 c-0.8-14.3-2.4-13.8,10.2-13.8c1.8,0,2.9,0.7,2.9,2.7c-0,4.3,0.3,8.7-0.3,13.5 C2048.2,909.1,2044.4,909.6,2040.9,911.3z M2038.3,325.5c8.3,3.4,12.6,10.1,11.9,18.5 c-4.8,60.3,12.2,626.4-11,539.8c-0.5-2-0.1-78.6,0.3-80c-2.5-18.5-0.1-133.4-1.6-140.2 C2038.1,662.6,2035.8,328.3,2038.3,325.5z M2034.3,924.5c0,11.4-8.9,6-22.5,8.3 c-5.2,0.9-0.6-24.8-3.1-33.1c0.8-7.9-3.2-582.7,0.2-596.4c30.8,22.3,24.8,8.8,23.9,65.6 c-0.4,27.8,0.3,289.3,1,291.9c-2.4,6.8,1,13.8-0.6,20.7 C2034.7,688.8,2034.3,920.4,2034.3,924.5z M1995.9,178c5.5,4.4,11.4,7.3,16.1,11.9 c30.5,29.5,18.9-2.3,21.7,77.9c1.5,42.9,0,45.1-5.2,40.3c-7.5-7-14.6-9.4-18.2-14.8 c-3.4-5.2-17.1-5.4-16.8-16.9c0.1-3.5-0.2-64.5,1-73.8C1993.5,198.4,1993.1,183,1995.9,178 z M1993.9,295.5c-0.2-3.3,9.4-2,9.1,17.5c-0.4,24.7-0,151.6-0,152.7 c-0.1,0-0.2,0-0.3,0c0,60.4,2.4,465.9,2.4,465.9c-0,3.6-5.6,4.3-7.8,2.9 C1992,931,1995.4,320.6,1993.9,295.5z M1956,144.6c31.9,33.5,39.3,2.1,34.3,109 c-0.8,18.3,1,26-3.9,22.6c-23.1-16.2-19.8-17.3-27.9-21.4c-11.7-6-3.9-4.8-7.1-39.3 c0,0,0.9-53.4-0-64.4C1951,146.9,1953.1,141.6,1956,144.6z M1989.9,305.9 c0,0,1.5,627.5,1.5,627.5c-9.2,6.6-16.1-0.1-20.4,3.6c-12.7,10.9-8.9-660.3-7.3-667.2 C1995.3,293.5,1989.7,284.9,1989.9,305.9z M1957.9,304.9h-0C1957.9,256.6,1957.9,246.4,1957.9,304.9 z M1912.5,111.6c1-3.1,4.5,1.7,29.8,22.7c10.1,8.4,5.8,66.5,5.7,67.5 c-0.1,1,2.1,50.4-4.8,41.9c-4.2-5.1-13.9-8.8-21.6-17.9c-4.9-5.8-13.7-5-10.3-16.4 C1912.6,205.1,1908.4,124.4,1912.5,111.6z M1923.3,926.3c-9.3-3.8-3.5-569.9-5.7-682.6 c-0.3-15.5,4.8-4.8,27.9,12.2c2.4,1.8,3.1,684.2,2.9,684.3c-20.7,2.2-20,2.9-20.2-1.8 C1928,934.4,1928.1,928.3,1923.3,926.3z M1923.9,938c-0.2,1.4-0.3,2.7-0.7,3.9 c-0.3,1.1-2.1,1.5-3,0.2C1916.3,936.2,1922.1,923.2,1923.9,938z M1914.6,925.2 c-2.2,0.3-2.2-0.2-2-11C1912.6,913.2,1914.6,906.1,1914.6,925.2z M1913.6,369.5 c0.1-145.4,0.1-211.3,0.1,0C1913.7,369.5,1913.7,369.5,1913.6,369.5z M1913.4,930.6 c1.1-1.7,2.1,5.6,0.9,13.3C1911.5,942.2,1911.9,933,1913.4,930.6z M1887.9,118.3 c-0.2-21.1,0.3-29.8,3.6-27c22,18.9,16.2,2.2,16.2,122.6c-2.7,0.3-3.9-0.7-5-1.7 C1879.9,193.4,1888.9,213,1887.9,118.3z M1899.2,914.8c1,29.3,0.8,28.5-0.1,30.1 c-3.5,6.1-2.5-1.9-3.7-170.5c-0-0.6-4.2-355.3-4.5-355.8c-1.8-2.9-1.3-125.7-1.3-126.7 c0.5-90.5-12.3-90.6,14.7-68.7c4.7,3.8,2,650.6,3.7,675.4C1908.6,909,1898.8,903.5,1899.2,914.8z M1903.6,913.6c1.3-3,4.4-3.4,4.7,0.6c0,0.3-0,24.3-0,24.9c-0.1,3.1-0.4,6.4-3.5,5.8 C1901.5,944.1,1903,915,1903.6,913.6z M2072.9,1033.9c-35.3,1-51.7,2.3-51.7,2.3 c-294.2,8,54.4-21.7,54.3-5.2C2075.5,1032.8,2075,1033.9,2072.9,1033.9z M2080.4,921.3 c-0.1,4,0.3,7.5-21.2,6c-4.2-0.3-3.9-557.5-4.7-561.7c2.2-7.8-2.3-30.7,2.7-27.4 c21.5,14.6,21.1,13.6,21.1,18.9c0.3,84.1-0.9,171.4,0.7,180c-1.5,3.8-0.6,170.6,0.3,176.2 c-1.9,5.6,1.5,11.4-0.6,17C2079.5,732.6,2080.8,904.2,2080.4,921.3z M2096.9,924.1 c-11.8,0.7-11.2,3.6-11.1-7.2c0-3.8-1.4-79.1-1.8-79.8c-0.1-7.5-2.6-470.5-0.5-480.4 c23.8,15.2,12.3-17,16.7,335.4C2103,934.1,2101.9,923.8,2096.9,924.1z M2086.3,348.4 c-5-2.9-4-6.1-4-20.7c0,0,0.1,0,0.1,0c-0.4-95.1-2.7-86.2,11.3-75.9 c35.8,26.3,33.4,8.8,30.6,105.5c-0.2,5.3,2.9,16.9-2.8,14.5c-10.8-4.6-14.2-12.1-19.6-14 C2096,355.8,2091.5,351.5,2086.3,348.4z M2123.2,921.5c-4.5,1.3-10.9-0.1-10.9-0.1 c-6.9,3.4-5.2-1.2-5.5-16c-0.4-15.5-5-369.5-2.8-377.1c-0.2-1.4-1.3-148.1,1-155.5 c1.6-0.3,2.5,0.2,3.5,0.8c16.1,10.8,16.8,10.2,16.7,15.1c-1.3,104.8,1.2,414.3,1.4,415.3 c-1.2,11.5,0.9,23,0.5,34.5C2123.9,921.2,2133,918.8,2123.2,921.5z M2129.3,328.8 c0-57.9-4.3-54.6,14.4-41.1c34.6,25.1,29.1,16,29,56.4c-0,1-0.2,55.3,0.2,58.2 c1.1,9-18.1-11.4-24.1-11.9c-24.6-16.9-19.2-3.6-19.2-61.6 C2129.5,328.8,2129.4,328.8,2129.3,328.8z M2134.5,919.8c-4.5,0.3-4-127.8-4-143.6 c0,0,0,0,0,0c0-1,0.1-166.6-1.3-172.5c1.4-13.5-3-217.5,3.6-213.3 c27.7,17.3,11.3-38.7,20,523.5C2152.9,918.6,2148.9,918.7,2134.5,919.8z M2174.3,914.2 c-1.2,1.8-3.4,0.3-4.8,1.4c-1.7,1.4-3.8,0.9-5.7,1c-8.9,0.2-5,6.4-6.9-47.3 c-0.9-24.4-0.5-178-2-186.4c0,0-1.3-237.2,0.9-277c5.9,2.6,10.1,6.1,14.7,9 c4.6,2.8,0.7,103.8,2.9,107.1C2171.6,530.3,2177.4,909.6,2174.3,914.2z M2178.2,316.9 c0.4-8.3,5.4,1.3,36.2,19.5c6.9,4.1,12.2,4.6,8.3,100.8c-4.4-1.7-8.2-3.9-11.3-6.9 c-5-4.7-33.2-16.9-33.9-24.7c-0.7-8.7,0.2-51.9,0.5-52.7 C2177.5,351.2,2178,320.2,2178.2,316.9z M2189.7,905.9c-0.4-3.4-1.1-5.6,1.3-6.3 C2201.5,896.5,2188.6,928.6,2189.7,905.9z M2203.4,912.5c-4.3,0.7-4.2-4-4-7.8 c0.7-13.9-9.8-8.7-10.1-18c-0.5-18.4,6.4-6.9,11.9-12.9c3.9-4.3-9.6-8.3-15.7-0.5 c-1,1.3-1.4,2.6-1.1,11.6c0.4,13.4-4.7,8.5-1.1,14.3c5.8,9.4-4.6,26.5-3.1,1.2 c0.1-1.9-2.9-383.2-2.9-383.3c1.8-6.5-0.9-81.4,0.6-91.5c0.3-2.2-6-12.2,17.8,5.8 c12.9,9.7,3.8,38.7,6.7,63.2C2202.6,495.6,2206.6,911.9,2203.4,912.5z M2218.2,910.5 c-12.9,10.2-12.7-455.6-9.7-470.4c3,1.1,14.3,6.5,14.3,10.4c-0.1,49.3-0.7,49.7,0.8,55.7 c-2.3,5.1,0.9,56-0.6,60.9c0,0,3.6,343.3,3.6,343.3C2223.1,909,2220.6,908.6,2218.2,910.5z M2228.8,347.6c3.1-0.6,46.1,26.8,45.8,32.1c-0.1,1,2.6,87.7-0.5,89c-3.2,1.4-9.7-7.7-13.4-8.6 c-4.5-1.1-32.2-17.4-32.4-20.1C2227.6,434.1,2227.3,349.4,2228.8,347.6z M2231.1,909.5 c-1.2-5-4.2-454.5-2.4-457.2c34.1,16.2,29.1,9.7,28.8,129.9 C2256.7,954.8,2275.3,903,2231.1,909.5z M2274.8,904.9c-6.2,0.3-8.6,3.4-9.5-2.2 c-0.2-1-4.5-398.6-2.5-427.1c0.2-2.7,3.2-0.9,11,4c2.4,1.5,1.4-2.5,1.4,90.1l0.5-0 c0,98.9,1.2,257,1.2,257c1.9,8.1,1.2,11.1,0.7,64.9C2277.4,902,2278.7,904.7,2274.8,904.9z M2280.2,382.2c-0.1-3.1,0.6-2.4,41.2,23.3c9.6,6.1,7.9,11.5,7.9,54.3c-0,0-0.1,0-0.1,0 c0,59.5,1.3,38-12.4,34.3c-4-1.1-4.6-1.7-33-18.8C2275.9,470.6,2280.4,392,2280.2,382.2 z M2317,900.3c-4.1,1.5-31,3.2-32,3.2c-6,0.4-2.5-212.9-4.8-241.2 c0.7-3.3-1.7-172.3,0.1-177.8c2.7-0.2,4.2,1.4,5.8,2.3c21.8,12.4,28.5,15.3,28.4,25.8 C2313,645.5,2317.9,832.7,2317,900.3z M2320.8,508.2c8.2,3.8,8.3,3.8,8.3,11.6 C2333,1368.6,2312.5,540.4,2320.8,508.2z M2375.9,438.7c11.7,7,9,6.5,9,93.1 c-15.1-5.3-27.4-14.3-40.7-21.1c-11.7-5.9-11.1,1.7-10.4-76.4 C2333.9,407.3,2327.3,409.5,2375.9,438.7z M2365.8,882.6c-5.8-0.5-6.8,12.1-7.5-20.7 c-0.1-7.6,0.5-5.7,10.5-7.6c3.1-0.6,2.8-3.8,1.4-4.2c-18-5.6-16.7,5.5-16.7,24.6 c-13.3-3.1-17.4,4.7-3.4,6.4c4.5,0.5,3.9,5.6,1.1,7.1c-5.9,3.2-6,1.6-10.1,2 c-6.7,0.6-4.3,0.2-4.7-10.5c-0-1-6.5-367-0.1-363.9c56.3,27.1,32.2-1.8,39.3,282.5 C2377.7,878,2380.7,883.9,2365.8,882.6z M2380.2,825.2c-0-0.4,0.8-32.6,0.7-41.3 c-3.1-390.4,6.7-193.1,4.4-187.8c0,0,2.9,280.5,2.9,280.5C2375.5,879.1,2385.1,882,2380.2,825.2z M2403.8,874c-3.5,2.5-10.2,3.5-10.3-0.5c-2.7-60.9-4-312.8-3.2-325.8 c3.2-0.4,5.2,1.6,7.3,3c36.6,25.5,38.9,8.1,38.8,47.8 C2435.3,900.1,2453.1,839,2403.8,874z M2441.1,714.7c0-234.4,0-117.1,0.1,0H2441.1z M2442.6,563c-3.7-0.1-6.8-1-10-2.8c-46.8-26.7-42.8-19.7-42.8-31.8 c-0.1-79.6-0.8-77.9,1.4-79.4c1.6-1.1-2.3-2.8,42.5,23.5c7.8,4.6,9.2,8.4,9,12.5 C2442.4,497.2,2444.6,534.7,2442.6,563z M2503,791.8c0,33,2.7,8.8-34.9,43.6 c-5.2,4.8-11.7,7.6-17.4,11.6c-4.1,2.9-2.7-265.9-1.5-267.2c3.6,0.6,6.6,2.9,9.8,4.5 C2511,611.6,2502.7,581.6,2503,791.8z M2505.1,596.2c-3.4,0.8-5.8-0.1-8.2-1.4 c-49.8-26.5-48.6-24.5-48.7-29.1c-2.5-93.1-1.1-86.1,7-81.5 C2511.9,516.2,2505.1,493.8,2505.1,596.2z M2510.8,515.5c68.9,35.1,56.1,21,57.6,85.2 c0,1.6,0.6,28-1.6,29.8c-70.9-35.8-58-18-57.9-77.5 C2508.9,516.7,2508.3,518,2510.8,515.5z M2567.3,766.1c0,0-16.3,9-20.7,10.7 c-7.2,2.8-14,7-18.6,13.9c-0.8,1.2-2.1,2.4-3.5,2.9c-7.8,3-14.6,23.2-13.5-15.2 c0-1-3.2-158.7-0.3-166.2c74.7,33.9,52.7,26.6,58.1,54.1 C2569,667.4,2571.6,764.5,2567.3,766.1z"/> <path d="M1505.1,992.1C1505.4,991.8,1505.7,992,1505.1,992.1L1505.1,992.1z"/> <polygon points="1749.4,1052 1749.3,1051.6 1749.6,1051.7 "/></g></svg>`;
        }

        function actualizarFondoCard(estado, colorOverride = null) {
            const bg = $('stats-card-bg');
            if (!bg) return;
            bg.dataset.estado = estado;

            const coloresVar = {
                blue: 'rgba(76,114,172,0.12)',
                green: 'rgba(76,172,140,0.12)',
                red: 'rgba(172,90,76,0.12)',
                purple: 'rgba(140,80,200,0.12)',
                gold: 'rgba(172,155,76,0.12)',
                orange: 'rgba(210, 120, 50, 0.12)',
            };

            const colores = {
                esperando: 'rgba(140,150,170,0.07)',
                en_curso: coloresVar.blue,
                finalizado_ok: coloresVar.green,
                finalizado_fail: coloresVar.red,
                especial: coloresVar.pruple
            };

            const color = colorOverride
                ? (coloresVar[colorOverride] || colores.especial)
                : (colores[estado] || colores.esperando);

            if (_fondoCard === 'ninguno') {
                bg.innerHTML = '';
            } else {
                bg.innerHTML = _fondoCard === 'obelisco' ? _svgSkylineBA(color) : _svgGoldenGate(color);
            }
        }

        function calcularEstadoCard() {
            const hoy = obtenerFechaHoy();
            const { inicio: ini, fin: fn } = obtenerSemanaActual();
            const registros = D.registros();
            const horasDiarias = D.horasDiarias();
            const horasSemanales = D.horasSemanales();
            const diasHabiles = D.diasHabiles();
            const { ayerStr: ayer, regAyer, ayerAbierto } = D.detectarAyerAbierto(hoy, registros);

            const diaSemanaHoy = new Date().getDay();
            let esDiaHabil = true;
            if (Array.isArray(diasHabiles)) {
                esDiaHabil = diasHabiles.includes(diaSemanaHoy);
            } else {
                esDiaHabil = diaSemanaHoy === 0 ? (diasHabiles === 7) : (diaSemanaHoy <= diasHabiles);
            }

            const mapDia = d => d === 0 ? 7 : d;
            const hoyIndex = mapDia(diaSemanaHoy);
            let quedanDiasFuturos = false;
            if (Array.isArray(diasHabiles)) {
                for (let d = hoyIndex + 1; d <= 7; d++) {
                    if (diasHabiles.includes(d === 7 ? 0 : d)) { quedanDiasFuturos = true; break; }
                }
            } else {
                quedanDiasFuturos = hoyIndex < diasHabiles;
            }
            const regHoy = registros.find(r => r.fecha === hoy) ?? null;
            const semanaAbierta = quedanDiasFuturos || (esDiaHabil && !(regHoy && regHoy.salida));

            const bufferSemanal = D.calcularBufferSemanal(ini, hoy);

            const fechaLimite = hoy < fn ? hoy : fn;
            const registrosSemana = registros.filter(r => r.fecha >= ini && r.fecha <= fechaLimite);
            let totalSemana = 0;
            registrosSemana.forEach(r => {
                const tipo = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
                if (tipo && tipo.id === 'remoto') totalSemana += horasDiarias;
                else if (!tipo) totalSemana += r.total;
            });

            const horasDescontar = D.calcularHorasFeriadoEnRango(ini, fn);
            const objetivoSemana = Math.max(0, horasSemanales - horasDescontar);

            let todosEspeciales = false;
            if (Array.isArray(diasHabiles) && diasHabiles.length > 0 && horasDiarias > 0) {
                const fechasLaborables = [];
                const [yI, mI, dI] = ini.split('-').map(Number);
                const [yF, mF, dF] = fn.split('-').map(Number);
                let cur = new Date(yI, mI - 1, dI);
                const fin = new Date(yF, mF - 1, dF);
                while (cur <= fin) {
                    if (diasHabiles.includes(cur.getDay())) {
                        const y = cur.getFullYear();
                        const m = String(cur.getMonth() + 1).padStart(2, '0');
                        const d = String(cur.getDate()).padStart(2, '0');
                        fechasLaborables.push(`${y}-${m}-${d}`);
                    }
                    cur = new Date(cur);
                    cur.setDate(cur.getDate() + 1);
                }
                if (fechasLaborables.length > 0) {
                    const especiales = fechasLaborables.filter(fecha => {
                        const r = registros.find(x => x.fecha === fecha);
                        if (!r) return false;
                        const tipo = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
                        return tipo && tipo.id !== 'remoto';
                    });
                    todosEspeciales = (especiales.length === fechasLaborables.length);
                }
            }

            const tipoEspecialHoy = (regHoy && regHoy.salida && regHoy.entrada === regHoy.salida)
                ? TiposRegistro.obtenerTipoPorCodigo(regHoy.entrada, regHoy.salida)
                : null;

            let tiempoHoy = 0;
            if (ayerAbierto && !regHoy) {
                const ahora = new Date();
                const horaActual = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
                const t = D.calcularHoras(regAyer.entrada, horaActual, regAyer.tiempoFuera || null, null, true);
                tiempoHoy = t ? t.total : 0;
            } else if (regHoy && regHoy.entrada && !tipoEspecialHoy) {
                if (regHoy.salida) {
                    tiempoHoy = regHoy.total;
                } else {
                    const ahora = new Date();
                    const horaActual = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
                    const t = D.calcularHoras(regHoy.entrada, horaActual, regHoy.tiempoFuera || null, null, true);
                    tiempoHoy = t ? t.total : 0;
                }
            }

            return {
                hoy, ini, fn,
                registros, regHoy,
                horasDiarias, horasSemanales,
                diasHabiles, esDiaHabil,
                semanaAbierta, bufferSemanal,
                totalSemana, objetivoSemana,
                tipoEspecialHoy, tiempoHoy,
                todosEspeciales,
                ayerAbierto, ayerStr: ayer, regAyer
            };
        }

        function derivarVistaSemana(est) {
            const { totalSemana: tot, objetivoSemana, semanaAbierta, horasDiarias, todosEspeciales } = est;

            const prog = objetivoSemana > 0 ? Math.min((tot / objetivoSemana) * 100, 100) : 100;

            let colorBarra, colorBorde, estadoFondo, mensaje, mostrarMensaje;

            if (horasDiarias === 0) {
                colorBarra = 'blue'; colorBorde = 'transparent';
                estadoFondo = 'esperando';
                mensaje = `Total fichado: ${horasATexto(tot)}`;
                mostrarMensaje = false;
            } else if (todosEspeciales) {
                colorBarra = 'blue'; colorBorde = 'transparent';
                estadoFondo = 'esperando';
                mensaje = 'Semana sin días laborables';
                mostrarMensaje = true;
            } else if (tot >= objetivoSemana) {
                colorBarra = 'green'; colorBorde = 'green';
                estadoFondo = 'finalizado_ok';
                mensaje = `Hiciste ${horasATexto(tot - objetivoSemana)} de más`;
                mostrarMensaje = true;
            } else if (semanaAbierta) {
                colorBarra = 'blue'; colorBorde = 'blue';
                estadoFondo = 'en_curso';
                mensaje = objetivoSemana === 0
                    ? `${horasATexto(tot)} (Sin objetivo)`
                    : `Faltan ${horasATexto(objetivoSemana - tot)}`;
                mostrarMensaje = true;
            } else {
                colorBarra = 'red'; colorBorde = 'red';
                estadoFondo = 'finalizado_fail';
                mensaje = `Faltaron ${horasATexto(objetivoSemana - tot)}`;
                mostrarMensaje = true;
            }

            return {
                titulo: `<svg class="icon"><use href="#icon-calendar-simple" /></svg> Esta Semana`,
                stats: todosEspeciales ? '🌞' : horasATexto(tot),
                mensaje, mostrarMensaje,
                colorBarra, anchoBarra: prog,
                colorBorde, estadoFondo,
                hint: 'Toca para ver Hoy',
                hintEsHTML: false,
            };
        }

        function derivarVistaHoy(est) {
            const { regHoy, tiempoHoy, horasDiarias, esDiaHabil, tipoEspecialHoy, bufferSemanal, diasHabiles } = est;
            const objetivoDiario = horasDiarias;

            if (!regHoy || !regHoy.entrada) {

                if (est.ayerAbierto) {
                    const prog = objetivoDiario > 0 ? Math.min((tiempoHoy / objetivoDiario) * 100, 100) : 100;
                    const cumplido = objetivoDiario === 0 || tiempoHoy >= objetivoDiario;

                    let colorBarra = cumplido ? 'green' : 'blue';
                    let colorBorde = cumplido ? 'green' : 'blue';
                    let mensaje = '';

                    const faltanteParaNotificar = objetivoDiario - tiempoHoy;
                    if (window.NotificacionesManager) NotificacionesManager.comprobarYNotificar(faltanteParaNotificar);

                    if (objetivoDiario === 0) {
                        mensaje = 'En curso (cruce de medianoche)';
                    } else if (cumplido) {
                        const extra = tiempoHoy - objetivoDiario;
                        if (bufferSemanal < 0 && Math.abs(bufferSemanal) > extra) {
                            mensaje = 'Te podes ir, pero debés tiempo';
                        } else {
                            mensaje = extra > 0 ? `Te podes ir (+${horasATexto(extra)})` : 'Te podes ir';
                        }
                    } else {
                        const faltanteTexto = `Faltan ${horasATexto(faltanteParaNotificar)}`;
                        mensaje = bufferSemanal >= faltanteParaNotificar ? `${faltanteTexto}, pero te podés ir` : faltanteTexto;
                    }

                    const nombreDiaAyer = obtenerNombreDia(est.ayerStr);
                    let hint = 'Toca Fichar para registrar salida';
                    let hintEsHTML = false;
                    const regAyer = est.regAyer;

                    if (regAyer && regAyer.entrada && objetivoDiario > 0 && !TiposRegistro.esRegistroEspecial(regAyer.entrada, regAyer.salida)) {
                        const [hE, mE] = regAyer.entrada.split(':').map(Number);
                        let minutosTotal = (hE * 60) + mE + (objetivoDiario * 60);

                        if (regAyer.tiempoFuera && !D.getIgnorarTiempoFuera()) {
                            const [hF, mF] = regAyer.tiempoFuera.split(':').map(Number);
                            minutosTotal += (hF * 60) + mF;
                        }

                        const perfilId = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';
                        const inicioBreak = localStorage.getItem(`breakStartTime_${perfilId}`);
                        if (inicioBreak && !D.getIgnorarTiempoFuera()) {
                            const mins = Math.floor((Date.now() - parseInt(inicioBreak)) / 60000);
                            if (mins > 0) minutosTotal += mins;
                        }

                        let hS = Math.floor(minutosTotal / 60) % 24;
                        const mS = Math.round(minutosTotal % 60);
                        const horaSalida = `${String(hS).padStart(2, '0')}:${String(mS).padStart(2, '0')}`;

                        const esLaborable = Array.isArray(diasHabiles) && diasHabiles.includes(new Date().getDay());
                        const mostrarBuffer = Math.abs(bufferSemanal) > 0.01 && esLaborable;

                        if (mostrarBuffer) {
                            const minutosConBuffer = minutosTotal - (bufferSemanal * 60);
                            let hSB = Math.floor(minutosConBuffer / 60) % 24;
                            const mSB = Math.round(minutosConBuffer % 60);
                            const horaBuf = `${String(hSB).padStart(2, '0')}:${String(mSB).padStart(2, '0')}`;
                            const colorBuffer = bufferSemanal > 0 ? 'var(--c-green)' : bufferSemanal < 0 ? 'var(--c-red)' : 'var(--text-main)';
                            hint = `Salida estimada: <strong>${horaSalida}</strong> <span class="hint-buffer-color" data-color="${colorBuffer}">(<strong>${horaBuf}</strong>)</span>`;
                        } else {
                            hint = `Salida estimada: <strong>${horaSalida}</strong>`;
                        }
                        hintEsHTML = true;
                    }

                    return {
                        titulo: `<svg class="icon"><use href="#icon-clock" /></svg>${nombreDiaAyer} (ayer)`,
                        stats: horasATexto(tiempoHoy),
                        mensaje: mensaje,
                        mostrarMensaje: true,
                        colorBarra: colorBarra, anchoBarra: prog,
                        colorBorde: colorBorde, estadoFondo: 'en_curso', estadoFondoColor: null,
                        hint: hint,
                        hintEsHTML: hintEsHTML,
                    };
                }

                return {
                    titulo: `<svg class="icon"><use href="#icon-clock" /></svg>${obtenerNombreDia(obtenerFechaHoy())}`,
                    stats: esDiaHabil ? '🎒' : '🌞',
                    mensaje: esDiaHabil
                        ? (horasDiarias === 0 ? '' : 'Esperando registro...')
                        : (horasDiarias === 0 ? '' : 'Día libre'),
                    mostrarMensaje: horasDiarias > 0,
                    colorBarra: 'blue', anchoBarra: 0,
                    colorBorde: 'transparent', estadoFondo: 'esperando',
                    hint: 'Toca para ver la Semana', hintEsHTML: false,
                };
            }

            if (tipoEspecialHoy) {
                return {
                    titulo: `<svg class="icon"><use href="#icon-clock" /></svg>${obtenerNombreDia(obtenerFechaHoy())}`,
                    stats: `${tipoEspecialHoy.emoji} ${tipoEspecialHoy.label}`,
                    mensaje: `¡${tipoEspecialHoy.descripcion}!`,
                    mostrarMensaje: true,
                    colorBarra: tipoEspecialHoy.color, anchoBarra: 100,
                    colorBorde: tipoEspecialHoy.color,
                    estadoFondo: 'especial', estadoFondoColor: tipoEspecialHoy.color,
                    hint: 'Toca para ver la Semana', hintEsHTML: false,
                };
            }

            const dayClosed = !!regHoy.salida;
            const prog = objetivoDiario > 0 ? Math.min((tiempoHoy / objetivoDiario) * 100, 100) : 100;
            const cumplido = objetivoDiario === 0 || tiempoHoy >= objetivoDiario;

            let colorBarra, colorBorde, estadoFondo, mensaje, mostrarMensaje;

            if (objetivoDiario === 0) {
                colorBarra = 'blue'; colorBorde = 'transparent';
                estadoFondo = dayClosed ? 'finalizado_ok' : 'en_curso';
                mensaje = ''; mostrarMensaje = false;
            } else if (dayClosed) {
                colorBarra = cumplido ? 'green' : 'red';
                colorBorde = cumplido ? 'green' : 'red';
                estadoFondo = cumplido ? 'finalizado_ok' : 'finalizado_fail';
                const dif = tiempoHoy - objetivoDiario;
                mensaje = dif >= 0 ? `${horasATexto(dif)} extras` : `Faltaron ${horasATexto(Math.abs(dif))}`;
                mostrarMensaje = true;
            } else {
                colorBarra = cumplido ? 'green' : 'blue';
                colorBorde = cumplido ? 'green' : 'blue';
                estadoFondo = 'en_curso';
                mostrarMensaje = true;
                const faltanteParaNotificar = objetivoDiario - tiempoHoy;
                if (window.NotificacionesManager) NotificacionesManager.comprobarYNotificar(faltanteParaNotificar);
                
                if (cumplido) {
                    const extra = tiempoHoy - objetivoDiario;
                    if (bufferSemanal < 0 && Math.abs(bufferSemanal) > extra) {
                        mensaje = 'Te podes ir, pero debés tiempo';
                    } else {
                        mensaje = extra > 0 ? `Te podes ir (+${horasATexto(extra)})` : 'Te podes ir';
                    }
                } else {
                    const faltanteTexto = `Faltan ${horasATexto(faltanteParaNotificar)}`;
                    mensaje = bufferSemanal >= faltanteParaNotificar ? `${faltanteTexto}, pero te podés ir` : faltanteTexto;
                }
            }

            let hint = 'Toca para ver la Semana';
            let hintEsHTML = false;
            if (regHoy.entrada && !dayClosed && objetivoDiario > 0 && !TiposRegistro.esRegistroEspecial(regHoy.entrada, regHoy.salida)) {
                const [hE, mE] = regHoy.entrada.split(':').map(Number);
                let minutosTotal = (hE * 60) + mE + (objetivoDiario * 60);
                if (regHoy.tiempoFuera && !D.getIgnorarTiempoFuera()) {
                    const [hF, mF] = regHoy.tiempoFuera.split(':').map(Number);
                    minutosTotal += (hF * 60) + mF;
                }
                const perfilId = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';
                const inicioBreak = localStorage.getItem(`breakStartTime_${perfilId}`);
                if (inicioBreak && !D.getIgnorarTiempoFuera()) {
                    const mins = Math.floor((Date.now() - parseInt(inicioBreak)) / 60000);
                    if (mins > 0) minutosTotal += mins;
                }
                let hS = Math.floor(minutosTotal / 60) % 24;
                const mS = Math.round(minutosTotal % 60);
                const horaSalida = `${String(hS).padStart(2, '0')}:${String(mS).padStart(2, '0')}`;

                const esLaborable = Array.isArray(diasHabiles) && diasHabiles.includes(new Date().getDay());
                const mostrarBuffer = Math.abs(bufferSemanal) > 0.01 && esLaborable;

                if (mostrarBuffer) {
                    const minutosConBuffer = minutosTotal - (bufferSemanal * 60);
                    let hSB = Math.floor(minutosConBuffer / 60) % 24;
                    const mSB = Math.round(minutosConBuffer % 60);
                    const horaBuf = `${String(hSB).padStart(2, '0')}:${String(mSB).padStart(2, '0')}`;
                    const colorBuffer = bufferSemanal > 0 ? 'var(--c-green)' : bufferSemanal < 0 ? 'var(--c-red)' : 'var(--text-main)';
                    hint = `Salida estimada: <strong>${horaSalida}</strong> <span class="hint-buffer-color" data-color="${colorBuffer}">(<strong>${horaBuf}</strong>)</span>`;
                } else {
                    hint = `Salida estimada: <strong>${horaSalida}</strong>`;
                }
                hintEsHTML = true;
            }

            return {
                titulo: `<svg class="icon"><use href="#icon-clock" /></svg>${obtenerNombreDia(obtenerFechaHoy())}`,
                stats: horasATexto(tiempoHoy),
                mensaje, mostrarMensaje,
                colorBarra, anchoBarra: prog,
                colorBorde, estadoFondo, estadoFondoColor: null,
                hint, hintEsHTML,
            };
        }

        const _COLORES_BORDE = ['blue', 'green', 'red', 'purple', 'orange', 'gold', 'transparent'];

        function _renderTitulo(vista) {
            const el = $('stats-titulo');
            if (el) el.innerHTML = vista.titulo;
        }

        let _cicloStatsInterval = null;
        let _cicloStatsValorHoras = '';
        let _cicloStatsEntrada = '';
        let _cicloStatsSalida = '';

        const _CICLO_DURACION_MS = 2500;

        function _detenerCicloStats() {
            clearTimeout(_cicloStatsInterval);
            _cicloStatsInterval = null;
            const el = $('stats-semana');
            if (el) el.classList.remove('ciclo-fade-out', 'ciclo-fade-in');
        }

        function _iniciarCicloStats() {
            _detenerCicloStats();
            if (!_cicloStatsEntrada) return;

            const fases = [
                _cicloStatsValorHoras,
                `Entrada ${_cicloStatsEntrada}`,
                _cicloStatsSalida ? `Salida ${_cicloStatsSalida}` : null,
            ].filter(Boolean);

            let idx = 0;

            const _cicloTick = () => {
                const el = $('stats-semana');
                if (!el) { _detenerCicloStats(); return; }

                el.classList.add('ciclo-fade-out');

                setTimeout(() => {
                    idx++;
                    if (idx >= fases.length) {
                        el.classList.remove('ciclo-fade-out');
                        el.classList.add('ciclo-fade-in');
                        el.textContent = _cicloStatsValorHoras;
                        void el.offsetWidth;
                        el.classList.remove('ciclo-fade-in');
                        _detenerCicloStats();
                        return;
                    }

                    el.classList.remove('ciclo-fade-out');
                    el.classList.add('ciclo-fade-in');
                    el.textContent = fases[idx];
                    void el.offsetWidth;
                    el.classList.remove('ciclo-fade-in');

                    _cicloStatsInterval = setTimeout(_cicloTick, _CICLO_DURACION_MS);
                }, 350);
            };

            _cicloStatsInterval = setTimeout(_cicloTick, _CICLO_DURACION_MS);
        }

        function _renderStats(vista) {
            const el = $('stats-semana');
            if (!el) return;

            const esDiaria = D.vistaActual() !== 'semana';
            const hoy = S.formatearFechaLocal(new Date());
            const regHoy = D.registros().find(r => r.fecha === hoy) ?? null;
            const esEspecial = regHoy && TiposRegistro.esRegistroEspecial(regHoy.entrada, regHoy.salida);
            const entradaHoy = (esDiaria && regHoy && regHoy.entrada && !esEspecial) ? regHoy.entrada : '';
            const salidaHoy = (esDiaria && regHoy && regHoy.salida && !esEspecial) ? regHoy.salida : '';

            _cicloStatsValorHoras = vista.stats;
            _cicloStatsEntrada = entradaHoy;
            _cicloStatsSalida = salidaHoy;

            if (!_cicloStatsInterval) {
                el.textContent = vista.stats;
            }
        }

        function _renderBarra(vista) {
            const el = $('progress-bar');
            if (!el) return;
            el.style.width = `${vista.anchoBarra}%`;
            setProgressBarColor(el, vista.colorBarra);
        }

        function _renderMensaje(vista) {
            const el = $('stats-mensaje');
            if (!el) return;
            el.textContent = vista.mensaje;
            el.style.display = vista.mostrarMensaje ? 'block' : 'none';
        }

        function _renderCard(vista) {
            const card = $('stats-card');
            if (!card) return;
            card.classList.remove(..._COLORES_BORDE.map(c => `border-${c}`));
            card.classList.add(`border-${vista.colorBorde}`);
            actualizarFondoCard(vista.estadoFondo, vista.estadoFondoColor ?? null);
        }

        function _renderHint(vista) {
            const el = $('toggle-hint');
            if (!el) return;
            if (vista.hintEsHTML) { el.innerHTML = vista.hint; _applyDataColors(el); }
            else el.textContent = vista.hint;
        }

        function _renderBuffer(est) {
            const el = $('stats-buffer');
            if (!el) return;
            el.innerHTML = '';
            const { bufferSemanal, horasDiarias, semanaAbierta } = est;
            if (horasDiarias > 0 && Math.abs(bufferSemanal) > 0.01 && semanaAbierta) {
                const esPositivo = bufferSemanal > 0;
                const color = esPositivo ? 'var(--c-green)' : 'var(--c-red)';
                const punto = document.createElement('span');
                punto.className = 'buffer-semanal-punto';
                punto.style.backgroundColor = color;
                const span = document.createElement('span');
                span.style.color = color;
                span.style.fontWeight = '500';
                span.textContent = `${horasATexto(Math.abs(bufferSemanal))} ${esPositivo ? 'extras' : 'faltantes'} esta semana`;
                span.insertBefore(punto, span.firstChild);
                el.appendChild(span);
            }
        }

        function _renderSelectorStats() {
            const anioEl = $('select-anio-stats');
            const mesEl = $('select-mes-stats');
            const semEl = $('select-semana-stats');
            const labelEl = $('label-periodo-toggle');
            if (modoEstadisticas === 'anual') {
                if (anioEl) anioEl.classList.remove('hidden');
                if (mesEl) mesEl.classList.add('hidden');
                if (semEl) semEl.classList.add('hidden');
                if (labelEl) labelEl.textContent = 'Anual';
                poblarSelectorAnios();
            } else if (modoEstadisticas === 'semanal') {
                if (anioEl) anioEl.classList.add('hidden');
                if (mesEl) mesEl.classList.add('hidden');
                if (semEl) semEl.classList.remove('hidden');
                if (labelEl) labelEl.textContent = 'Semanal';
                poblarSelectorSemanas();
                actualizarEstadisticasSemana(semEl?.value);
            } else {
                if (anioEl) anioEl.classList.add('hidden');
                if (mesEl) mesEl.classList.remove('hidden');
                if (semEl) semEl.classList.add('hidden');
                if (labelEl) labelEl.textContent = 'Mensual';
                poblarSelectorMeses();
            }
        }

        function _animarCambioCard(renderFn) {
            const els = [
                $('stats-semana'),
                $('stats-mensaje'),
                $('stats-buffer'),
                $('toggle-hint'),
            ].filter(Boolean);

            _detenerCicloStats();

            els.forEach(el => el.classList.add('ciclo-fade-out'));

            setTimeout(() => {
                renderFn();
                els.forEach(el => {
                    el.classList.remove('ciclo-fade-out');
                    el.classList.add('ciclo-fade-in');
                    void el.offsetWidth;
                    el.classList.remove('ciclo-fade-in');
                });
            }, 350);
        }

        function actualizarUI(idNuevo = null, soloReloj = false, animarCard = false) {
            if (!soloReloj) {
                actualizarListaRegistros(D.registros(), idNuevo);
            }

            const est = calcularEstadoCard();
            const vista = D.vistaActual() === 'semana'
                ? derivarVistaSemana(est)
                : derivarVistaHoy(est);

            _renderTitulo(vista);
            _renderCard(vista);
            _renderBarra(vista);
            _renderSelectorStats();
            actualizarEstadoBotonTimerMain();
            if (_vistaHistoricoCalendario) {
                const selector = document.getElementById('calendario-selector-meses');
                if (selector && selector.style.display !== 'none') {
                    _cerrarSelectorMeses(idNuevo);
                } else {
                    _renderizarCalendario(idNuevo);
                }
            }

            const debeAnimar = animarCard || (idNuevo !== null && !soloReloj);
            if (debeAnimar) {
                _animarCambioCard(() => {
                    _renderStats(vista);
                    _renderMensaje(vista);
                    _renderHint(vista);
                    _renderBuffer(est);
                });
            } else {
                _renderStats(vista);
                _renderMensaje(vista);
                _renderHint(vista);
                _renderBuffer(est);
            }
        }

        function alternarTema() {
            let temaOscuro = !D.cargarConfiguracion().temaOscuro;
            document.body.classList.toggle('dark-mode');

            try {
                localStorage.setItem('temaOscuro', temaOscuro);
            } catch (e) { }

            const botonesTema = [
                'theme-toggle',
                'theme-toggle-modal',
                'btn-tema-selector'
            ];

            botonesTema.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    const icon = btn.querySelector('use');
                    if (icon) {
                        icon.setAttribute('href', temaOscuro ? '#icon-sun' : '#icon-moon');
                    }
                }
            });
        }

        function alternarVista() {
            const card = document.getElementById('stats-card');
            const content = document.getElementById('stats-card-content');

            if (card) card.classList.add('cambiando-vista');
            if (content) content.classList.add('fade-out');

            setTimeout(() => {
                let vistaActual = D.vistaActual() === 'semana' ? 'diaria' : 'semana';
                D.setVistaActual(vistaActual);
                try {
                    localStorage.setItem('vistaActual', vistaActual);
                } catch (e) { }

                _detenerCicloStats();
                actualizarUI();

                if (content) content.classList.remove('fade-out');

                if (card) card.classList.remove('cambiando-vista');

            }, 300);
        }

        function pegarHoraActual(id) {
            const c = document.getElementById(id);
            if (!c) return;

            if (c.value.trim() !== '') {
                c.value = '';
                UILogic.limpiarError('entrada', 'error-entrada');
                UILogic.limpiarError('salida', 'error-salida');

                if (id === 'edit-entrada' || id === 'edit-salida') {
                    verificarBloqueoCredito();
                    c.dispatchEvent(new Event('input'));
                }
                return;
            }

            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            c.value = `${h}:${m}`;

            if (id === 'edit-entrada' || id === 'edit-salida') {
                verificarBloqueoCredito();
                c.dispatchEvent(new Event('input'));
            }
        }

        function limpiarCampo(id) {
            const c = document.getElementById(id);
            if (!c) return;
            c.value = '';
            c.dispatchEvent(new Event('input'));
        }

        function formatearInput(e) {
            let v = e.target.value.replace(/[^0-9]/g, '');
            if (v.length >= 3) v = v.slice(0, 2) + ':' + v.slice(2, 4);
            e.target.value = v;
        }

        function actualizarFeedbackConfig() {
            const checkboxes = document.querySelectorAll('input[name="dia-habil"]:checked');
            const seleccionados = checkboxes.length;
            const horas = parseFloat($('config-horas-diarias').value) || 0;
            const total = seleccionados * horas;

            const el = $('config-total-feedback');
            if (el) {
                if (horas === 0) el.textContent = `(Registro libre sin objetivos)`;
                else el.textContent = `(Total semanal: ${total}hs)`;
            }

            if (seleccionados > 0) {
                const nuevosDias = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => a - b);
                D.setDiasHabiles(nuevosDias);
                try {
                    const esDefault = window.PerfilManager && PerfilManager.obtenerPerfilActual() === 'default';
                    if (esDefault) localStorage.setItem('diasHabiles', JSON.stringify(nuevosDias));
                } catch (e) { }
                D.guardarYActualizar();
            }
            actualizarEstadoBotonPersistir();
        }

        function iniciarCambioHoras(incremento) {
            cambiarHorasDiarias(incremento);
            timeoutInicial = setTimeout(() => {
                intervaloPulsacion = setInterval(() => {
                    cambiarHorasDiarias(incremento);
                }, 100);
            }, 500);
        }

        function detenerCambio() {
            if (timeoutInicial) {
                clearTimeout(timeoutInicial);
                timeoutInicial = null;
            }
            if (intervaloPulsacion) {
                clearInterval(intervaloPulsacion);
                intervaloPulsacion = null;
            }
        }

        function cambiarHorasDiarias(incremento) {
            let valorActual = parseFloat($('config-horas-diarias').value);
            if (isNaN(valorActual)) valorActual = D.horasDiarias();
            let nuevoValor = Math.min(24, Math.max(0, valorActual + incremento));
            if (isNaN(nuevoValor)) return;
            $('config-horas-diarias').value = nuevoValor;
            actualizarFeedbackConfig();
            D.setHorasDiarias(nuevoValor);
            try {
                const esDefault = window.PerfilManager && PerfilManager.obtenerPerfilActual() === 'default';
                if (esDefault) localStorage.setItem('horasDiarias', nuevoValor);
            } catch (e) { }
            D.guardarYActualizar();
        }

        function cerrarConfig() {
            ModalManager.cerrar('modal-config', () => {
                UILogic.abrirSelectorPerfiles();
            });
        }

        function toggleIgnorarTiempoFuera() {
            const nuevoValor = !D.getIgnorarTiempoFuera();
            D.setIgnorarTiempoFuera(nuevoValor);
            try { localStorage.setItem(_perfilKey('ignorarTiempoFuera'), nuevoValor); } catch (e) { }
            actualizarEstadoBotonIgnorarTF();
            D.recalcularTotalesEnMemoria();
            actualizarUI();
            mostrarToast(nuevoValor ? 'Tiempo fuera ignorado en cálculos' : 'Tiempo fuera incluido en cálculos', 'info');
        }

        function _setBtnActivo(id, activo) {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.classList.toggle('btn-activo', activo);
        }

        function actualizarEstadoBotonIgnorarTF() {
            _setBtnActivo('btn-toggle-ignorar-tf', D.getIgnorarTiempoFuera());
        }

        function toggleHoverPopupCalendario() {
            const actual = localStorage.getItem('hoverPopupCalendario') !== 'false';
            const nuevo = !actual;
            try { localStorage.setItem('hoverPopupCalendario', nuevo); } catch (e) { }
            actualizarEstadoBotonHoverPopup();
            mostrarToast(nuevo ? 'Popup al pasar mouse activado' : 'Popup al pasar mouse desactivado', 'info');
        }

        function actualizarEstadoBotonHoverPopup() {
            _setBtnActivo('btn-toggle-hover-popup', localStorage.getItem('hoverPopupCalendario') !== 'false');
        }

        function togglePersistirTarjetas() {
            const actual = localStorage.getItem('persistirTarjetas') !== 'false';
            const nuevo = !actual;
            try { localStorage.setItem('persistirTarjetas', nuevo); } catch (e) { }
            actualizarEstadoBotonPersistir();
            mostrarToast(nuevo ? 'Estado de tarjetas guardado' : 'Tarjetas siempre cerradas al iniciar', 'info');
        }

        function actualizarEstadoBotonPersistir() {
            _setBtnActivo('btn-toggle-persistir-tarjetas', localStorage.getItem('persistirTarjetas') !== 'false');
        }

        function toggleVisibilidadCard(cual) {
            const key = _perfilKey('cardVisible_' + cual);
            const actual = localStorage.getItem(key) !== 'false';
            const nuevoValor = !actual;
            try { localStorage.setItem(key, nuevoValor); } catch (e) { }
            aplicarVisibilidadCard(cual, nuevoValor);
            actualizarEstadoBotonCard(cual, nuevoValor);
            mostrarToast('Tarjeta ' + cual + (nuevoValor ? ' visible' : ' oculta'), 'info');
        }

        function aplicarVisibilidadCard(cual, visible) {
            const card = document.getElementById('card-' + cual);
            if (card) card.style.display = visible ? '' : 'none';
        }

        function actualizarEstadoBotonCard(cual, activo) {
            _setBtnActivo('btn-toggle-card-' + cual, activo);
        }

        function aplicarVisibilidadCards() {
            ['registrar', 'estadisticas', 'historico'].forEach(cual => {
                const visible = localStorage.getItem(_perfilKey('cardVisible_' + cual)) !== 'false';
                aplicarVisibilidadCard(cual, visible);
                actualizarEstadoBotonCard(cual, visible);
            });
        }

        function obtenerOrdenCards() {
            try {
                const guardado = JSON.parse(localStorage.getItem(_perfilKey('ordenCards')));
                const validos = ['registrar', 'estadisticas', 'historico'];
                if (Array.isArray(guardado) && guardado.length === 3 && validos.every(v => guardado.includes(v))) {
                    return guardado;
                }
            } catch (e) { }
            return ['registrar', 'estadisticas', 'historico'];
        }

        function aplicarOrdenCards(orden) {
            const statsCard = document.getElementById('stats-card');
            const leftColumn = statsCard ? statsCard.parentElement : null;
            const container = leftColumn ? leftColumn.parentElement : null;
            if (!leftColumn || !container) return;

            const delays = [0.10, 0.15, 0.25];
            orden.forEach((cual, idx) => {
                const card = document.getElementById('card-' + cual);
                if (!card) return;
                card.style.animationDelay = `${delays[idx] || 0.25}s`;
                const esUltima = idx === orden.length - 1;
                if (esUltima) {
                    container.appendChild(card);
                } else {
                    leftColumn.appendChild(card);
                }
            });

            const lista = document.getElementById('lista-orden-cards');
            if (lista) {
                orden.forEach(cual => {
                    const item = document.getElementById('orden-item-' + cual);
                    if (item) lista.appendChild(item);
                });
            }
        }

        function iniciarDragOrdenCards() {
            const lista = document.getElementById('lista-orden-cards');
            if (!lista) return;

            let draggingEl = null;
            let dragClone = null;
            let startY = 0;
            let initialYOffset = 0;
            let dragTimer = null;
            const DRAG_DELAY = 150;

            function getCardFromItem(el) {
                const handle = el?.classList?.contains('drag-handle') ? el : el?.querySelector('.drag-handle');
                return handle?.dataset?.card;
            }

            function initDrag(item, clientY) {
                draggingEl = item;
                const rect = item.getBoundingClientRect();
                initialYOffset = clientY - rect.top;

                dragClone = item.cloneNode(true);
                dragClone.style.position = 'fixed';
                dragClone.style.top = `${rect.top}px`;
                dragClone.style.left = `${rect.left}px`;
                dragClone.style.width = `${rect.width}px`;
                dragClone.style.height = `${rect.height}px`;
                dragClone.style.zIndex = '999999';
                dragClone.style.pointerEvents = 'none';
                dragClone.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                dragClone.style.margin = '0';
                dragClone.style.transform = 'scale(1.02)';
                dragClone.style.opacity = '0.9';
                document.body.appendChild(dragClone);
                draggingEl.style.opacity = '0';

                if (navigator.vibrate) navigator.vibrate(30);
            }

            function moveDrag(clientY) {
                if (!dragClone || !draggingEl) return;

                dragClone.style.top = `${clientY - initialYOffset}px`;

                const target = [...lista.querySelectorAll('.orden-card-item')].find(item => {
                    if (item === draggingEl) return false;
                    const r = item.getBoundingClientRect();
                    return clientY >= r.top && clientY <= r.bottom;
                });

                if (target) {
                    const targetRect = target.getBoundingClientRect();
                    const targetMiddle = targetRect.top + targetRect.height / 2;

                    if (clientY < targetMiddle) {
                        lista.insertBefore(draggingEl, target);
                    } else {
                        lista.insertBefore(draggingEl, target.nextSibling);
                    }
                }
            }

            function endDrag() {
                clearTimeout(dragTimer);
                if (!draggingEl) return;

                if (dragClone) {
                    dragClone.remove();
                    dragClone = null;
                }
                draggingEl.style.opacity = '';

                const itemsDOM = Array.from(lista.querySelectorAll('.orden-card-item'));
                const nuevoOrden = itemsDOM.map(i => getCardFromItem(i)).filter(Boolean);

                try {
                    localStorage.setItem(_perfilKey('ordenCards'), JSON.stringify(nuevoOrden));
                } catch (e) { }

                if (typeof aplicarOrdenCards === 'function') {
                    aplicarOrdenCards(nuevoOrden);
                }

                draggingEl = null;
            }

            lista.addEventListener('touchstart', (e) => {
                const handle = e.target.closest('.drag-handle');
                if (!handle) return;
                const item = handle.closest('.orden-card-item');
                if (!item) return;

                startY = e.touches[0].clientY;
                dragTimer = setTimeout(() => {
                    initDrag(item, startY);
                }, DRAG_DELAY);
            }, { passive: true });

            lista.addEventListener('touchmove', (e) => {
                if (!draggingEl) {
                    if (Math.abs(e.touches[0].clientY - startY) > 10) clearTimeout(dragTimer);
                    return;
                }
                e.preventDefault();
                moveDrag(e.touches[0].clientY);
            }, { passive: false });

            lista.addEventListener('touchend', endDrag);
            lista.addEventListener('touchcancel', endDrag);

            lista.addEventListener('mousedown', (e) => {
                const handle = e.target.closest('.drag-handle');
                if (!handle) return;
                const item = handle.closest('.orden-card-item');
                if (!item) return;

                startY = e.clientY;
                dragTimer = setTimeout(() => {
                    initDrag(item, startY);
                }, DRAG_DELAY);
            });

            document.addEventListener('mousemove', (e) => {
                if (!draggingEl) {
                    if (Math.abs(e.clientY - startY) > 10) clearTimeout(dragTimer);
                    return;
                }
                e.preventDefault();
                moveDrag(e.clientY);
            });

            document.addEventListener('mouseup', endDrag);
        }

        function cerrarEdicion() {
            ModalManager.cerrar('modal-editar', () => {
                D.setEditandoId(null);
                document.dispatchEvent(new Event('scroll'));
            });
        }

        function mostrarImportar(desdeLista = false) {
            _modalAbiertoDesdeLista = desdeLista;
            ModalManager.alternar(desdeLista ? null : 'modal-config', 'modal-importar', null, () => {
                $('file-import').value = '';

                const nombreEl = document.getElementById('nombre-archivo-seleccionado');
                if (nombreEl) {
                    nombreEl.style.display = 'none';
                    nombreEl.textContent = '';
                }

                const btnCombinar = document.getElementById('btn-combinar');
                const btnReemplazar = document.getElementById('btn-reemplazar');

                if (btnCombinar) {
                    btnCombinar.disabled = true;
                }
                if (btnReemplazar) {
                    btnReemplazar.disabled = true;
                }

                const btnVolverI = $('btn-volver-importar');
                if (btnVolverI) {
                    btnVolverI.lastChild.textContent = desdeLista ? ' Cerrar' : ' Volver';
                    btnVolverI.querySelector('use').setAttribute('href', desdeLista ? '#icon-cancelar' : '#icon-undo');
                }
                setTimeout(() => $('file-import').click(), 50);
            });
        }

        function cerrarImportar() {
            ModalManager.alternar('modal-importar', _modalAbiertoDesdeLista ? null : 'modal-config');
            _modalAbiertoDesdeLista = false;
        }

        function calcularEstadisticasAnio(anio) {
            const anioNum = parseInt(anio);
            const registros = D.registros().filter(r => parseInt(r.fecha.substring(0, 4)) === anioNum);
            return _calcularEstadisticasRango(registros, { regularidadPorMes: true, desde: `${anioNum}-01-01`, hasta: `${anioNum}-12-31` });
        }

        function poblarSelectorAnios() {
            const selectAnio = $('select-anio-stats');
            if (!selectAnio) return;

            const anioActualmenteSeleccionado = selectAnio.value;

            const aniosUnicos = new Set();
            D.registros().forEach(r => aniosUnicos.add(r.fecha.substring(0, 4)));
            const aniosOrdenados = Array.from(aniosUnicos).sort().reverse();

            selectAnio.innerHTML = '';

            if (aniosOrdenados.length === 0) {
                const opt = document.createElement('option');
                opt.value = ''; opt.textContent = 'Sin registros';
                selectAnio.appendChild(opt);
                actualizarEstadisticasAnio(null);
                return;
            }

            const anioActual = String(new Date().getFullYear());

            let anioASeleccionar;
            if (anioActualmenteSeleccionado && aniosOrdenados.includes(anioActualmenteSeleccionado)) {
                anioASeleccionar = anioActualmenteSeleccionado;
            } else if (aniosOrdenados.includes(anioActual)) {
                anioASeleccionar = anioActual;
            } else {
                anioASeleccionar = aniosOrdenados[0];
            }

            aniosOrdenados.forEach(anio => {
                const opt = document.createElement('option');
                opt.value = anio;
                opt.textContent = anio;
                if (anio === anioASeleccionar) opt.selected = true;
                selectAnio.appendChild(opt);
            });

            actualizarEstadisticasAnio(anioASeleccionar);
        }

        function actualizarEstadisticasAnio(anio) {
            const stats = calcularEstadisticasAnio(anio);
            _renderizarStats(stats, { mostrarBtnReporte: true });
        }

        function _getLunes(fecha = new Date()) {
            const dow = fecha.getDay();
            const diff = (dow === 0) ? -6 : 1 - dow;
            const lunes = new Date(fecha);
            lunes.setDate(fecha.getDate() + diff);
            return lunes;
        }

        function _obtenerSemanas() {
            const semanas = new Map();
            D.registros().forEach(r => {
                const d = new Date(r.fecha + 'T00:00:00');
                const lunes = _getLunes(d);
                const key = S.formatearFechaLocal(lunes);
                if (!semanas.has(key)) semanas.set(key, lunes);
            });
            return Array.from(semanas.keys()).sort().reverse();
        }

        function _formatearSemana(lunesISO) {
            const lunes = new Date(lunesISO + 'T00:00:00');
            const domingo = new Date(lunes);
            domingo.setDate(lunes.getDate() + 6);
            const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            const dL = lunes.getDate();
            const dD = domingo.getDate();
            const mL = meses[lunes.getMonth()];
            const mD = meses[domingo.getMonth()];
            if (lunes.getMonth() === domingo.getMonth()) {
                return `${dL} al ${dD} de ${mD}`;
            }
            return `${dL} ${mL} al ${dD} ${mD}`;
        }

        function poblarSelectorSemanas() {
            const select = $('select-semana-stats');
            if (!select) return;
            const selActual = select.value;
            const semanas = _obtenerSemanas();
            select.innerHTML = '';
            if (semanas.length === 0) {
                const opt = document.createElement('option');
                opt.value = ''; opt.textContent = 'Sin registros';
                select.appendChild(opt);
                actualizarEstadisticasSemana(null);
                return;
            }
            const semanasPorAnio = new Map();
            semanas.forEach(key => {
                const anio = key.substring(0, 4);
                if (!semanasPorAnio.has(anio)) semanasPorAnio.set(anio, []);
                semanasPorAnio.get(anio).push(key);
            });

            let seleccionar;
            if (selActual && semanas.includes(selActual)) {
                seleccionar = selActual;
            } else {
                const lunesISO = S.formatearFechaLocal(_getLunes());
                seleccionar = semanas.includes(lunesISO) ? lunesISO : semanas[0];
            }

            semanasPorAnio.forEach((keys, anio) => {
                const grupo = document.createElement('optgroup');
                grupo.label = anio;
                keys.forEach(key => {
                    const opt = document.createElement('option');
                    opt.value = key;
                    opt.textContent = _formatearSemana(key);
                    if (key === seleccionar) opt.selected = true;
                    grupo.appendChild(opt);
                });
                select.appendChild(grupo);
            });

            actualizarEstadisticasSemana(seleccionar);
        }

        function calcularEstadisticasSemana(lunesISO) {
            if (!lunesISO) return _calcularEstadisticasRango([], { regularidadPorMes: false });
            const lunes = new Date(lunesISO + 'T00:00:00');
            const domingo = new Date(lunes);
            domingo.setDate(lunes.getDate() + 6);
            const hasta = S.formatearFechaLocal(domingo);
            const registros = D.registros().filter(r => r.fecha >= lunesISO && r.fecha <= hasta);
            return _calcularEstadisticasRango(registros, { regularidadPorMes: false, desde: lunesISO, hasta });
        }

        function actualizarEstadisticasSemana(lunesISO) {
            const stats = calcularEstadisticasSemana(lunesISO);
            _renderizarStats(stats, { mostrarBtnReporte: false });
        }

        function _animarCambioStats(fn) {
            const formStats = $('form-stats');
            if (!formStats) return;
            formStats.classList.add('fade-out');
            setTimeout(() => { fn(); formStats.classList.remove('fade-out'); }, 300);
        }

        function cambiarSemanaStats() {
            const v = $('select-semana-stats')?.value;
            if (v !== undefined) _animarCambioStats(() => actualizarEstadisticasSemana(v));
        }

        function cambiarAnioStats() {
            const v = $('select-anio-stats')?.value;
            if (v !== undefined) _animarCambioStats(() => actualizarEstadisticasAnio(v));
        }

        function togglePeriodoStats(direccion = 1) {
            const selectMes = $('select-mes-stats');
            const selectAnio = $('select-anio-stats');
            const label = $('label-periodo-toggle');
            const selectSemana = $('select-semana-stats');

            const orden = ['mensual', 'anual', 'semanal'];
            const idx = orden.indexOf(modoEstadisticas);
            modoEstadisticas = orden[(idx + direccion + orden.length) % orden.length];
            try { localStorage.setItem('modoEstadisticas', modoEstadisticas); } catch (e) { }

            _animarCambioStats(() => {
                selectMes.classList.add('hidden');
                selectAnio.classList.add('hidden');
                if (selectSemana) selectSemana.classList.add('hidden');
                if (modoEstadisticas === 'anual') {
                    selectAnio.classList.remove('hidden');
                    if (label) label.textContent = 'Anual';
                    poblarSelectorAnios();
                } else if (modoEstadisticas === 'semanal') {
                    if (selectSemana) selectSemana.classList.remove('hidden');
                    if (label) label.textContent = 'Semanal';
                    poblarSelectorSemanas();
                } else {
                    selectMes.classList.remove('hidden');
                    if (label) label.textContent = 'Mensual';
                    poblarSelectorMeses();
                }
            });
        }

        function poblarSelectorMeses() {
            const selectMes = $('select-mes-stats');
            if (!selectMes) return;
            const mesActualmenteSeleccionado = selectMes.value;
            const mesesUnicos = new Set();
            D.registros().forEach(r => {
                const mesAnio = r.fecha.substring(0, 7);
                mesesUnicos.add(mesAnio);
            });

            const mesesOrdenados = Array.from(mesesUnicos).sort().reverse();
            selectMes.innerHTML = '';
            if (mesesOrdenados.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Sin registros';
                selectMes.appendChild(option);
                actualizarEstadisticas(null);
                return;
            }

            const hoy = new Date();
            const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

            let mesASeleccionar = mesActual;

            if (mesActualmenteSeleccionado && mesesOrdenados.includes(mesActualmenteSeleccionado)) {
                mesASeleccionar = mesActualmenteSeleccionado;
            } else if (!mesesOrdenados.includes(mesActual)) {
                mesASeleccionar = mesesOrdenados[0];
            }

            const mesesPorAnio = new Map();
            mesesOrdenados.forEach(mesAnio => {
                const anio = mesAnio.substring(0, 4);
                if (!mesesPorAnio.has(anio)) mesesPorAnio.set(anio, []);
                mesesPorAnio.get(anio).push(mesAnio);
            });

            mesesPorAnio.forEach((meses, anio) => {
                const grupo = document.createElement('optgroup');
                grupo.label = anio;

                meses.forEach(mesAnio => {
                    const option = document.createElement('option');
                    option.value = mesAnio;

                    const [a, m] = mesAnio.split('-');
                    const fecha = new Date(a, m - 1, 1);
                    const nombreMes = fecha.toLocaleDateString('es-ES', { month: 'long' });
                    option.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

                    if (mesAnio === mesASeleccionar) {
                        option.selected = true;
                    }

                    grupo.appendChild(option);
                });

                selectMes.appendChild(grupo);
            });

            actualizarEstadisticas(mesASeleccionar);
        }

        function cambiarMesStats() {
            const v = $('select-mes-stats')?.value;
            if (v !== undefined) _animarCambioStats(() => actualizarEstadisticas(v));
        }

        function generarReporte() {
            const esAnual = modoEstadisticas === 'anual';
            const horasDiariasObjetivo = D.horasDiarias();

            const fmtHM = (total) => {
                let h = Math.floor(total), m = Math.round((total - h) * 60);
                if (m === 60) { h++; m = 0; }
                return `${h}h ${String(m).padStart(2, '0')}m`;
            };

            const sumarHoras = (regs) => regs.reduce((sum, r) => {
                const t = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
                if (t && t.id === 'remoto') return sum + horasDiariasObjetivo;
                if (!t) return sum + r.total;
                return sum;
            }, 0);

            let periodoLabel, registrosPeriodo, stats, nombreArchivo, mesSeleccionado;

            if (esAnual) {
                const selectAnio = $('select-anio-stats');
                const anioSeleccionado = selectAnio ? selectAnio.value : null;
                if (!anioSeleccionado) { mostrarToast('No hay año seleccionado', 'error'); return; }
                periodoLabel = anioSeleccionado;
                nombreArchivo = `reporte_${anioSeleccionado}.txt`;
                const anioNum = parseInt(anioSeleccionado);
                registrosPeriodo = D.registros().filter(r => parseInt(r.fecha.substring(0, 4)) === anioNum);
                stats = calcularEstadisticasAnio(anioSeleccionado);
            } else {
                const selectMes = $('select-mes-stats');
                mesSeleccionado = selectMes ? selectMes.value : null;
                if (!mesSeleccionado) { mostrarToast('No hay mes seleccionado', 'error'); return; }
                periodoLabel = selectMes.options[selectMes.selectedIndex].text;
                nombreArchivo = `reporte_${mesSeleccionado}.txt`;
                const [año, mes] = mesSeleccionado.split('-').map(Number);
                registrosPeriodo = D.registros().filter(r => {
                    const [aReg, mReg] = r.fecha.split('-').map(Number);
                    return aReg === año && mReg === mes;
                });
                stats = calcularEstadisticasMes(mesSeleccionado);
            }

            // ============================================
            // ESTRUCTURA MODULAR DEL REPORTE
            // ============================================
            const reporte = {

                header: () => `
================================================================
REPORTE DE HORAS TRABAJADAS                   
================================================================

📅 Período: ${periodoLabel}
📊 Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}

────────────────────────────────────────────────────────────────`,

                resumenGeneral: () => {
                    const lineasTipos = TiposRegistro.obtenerTodosLosTipos()
                        .map(t => `   • ${(t.label + ':').padEnd(24)}${stats[t.labelPlural.toLowerCase()] || 0}`)
                        .join('\n');
                    return `

📈 RESUMEN GENERAL
────────────────────────────────────────────────────────────────

   • Jornadas:               ${stats.diasTrabajados}
${lineasTipos}
   • Salidas Temprano:       ${stats.compensaciones}
   • Entrada promedio:       ${stats.entradaPromedio}
   • Salida promedio:        ${stats.salidaPromedio}
   • Promedio diario:        ${stats.promedioDiario}
   
   • Total horas trabajadas: ${fmtHM(sumarHoras(registrosPeriodo))}
   • Saldo:                  ${stats.bufferPeriodo !== null ? horasATextoCorto(stats.bufferPeriodo) : 'N/A'}`;
                },

                detallePeriodo: () => {
                    if (esAnual) {
                        const mesesOrdenados = Array.from(
                            new Set(registrosPeriodo.map(r => r.fecha.substring(0, 7)))
                        ).sort();

                        let seccion = `

────────────────────────────────────────────────────────────────

📅 TOTALES POR MES
────────────────────────────────────────────────────────────────

`;
                        mesesOrdenados.forEach(claveMes => {
                            const regsM = registrosPeriodo.filter(r => r.fecha.startsWith(claveMes));
                            const normales = regsM.filter(r => !TiposRegistro.esRegistroEspecial(r.entrada, r.salida) && r.entrada && r.salida);
                            const especiales = regsM.filter(r => TiposRegistro.esRegistroEspecial(r.entrada, r.salida));

                            const notas = TiposRegistro.obtenerTodosLosTipos()
                                .map(t => {
                                    const n = especiales.filter(r => {
                                        const tipo = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
                                        return tipo && tipo.id === t.id;
                                    }).length;
                                    return n ? `${n} ${t.labelPlural.toLowerCase()}` : null;
                                })
                                .filter(Boolean);

                            const nombreMesCap = formatoTituloMes(claveMes).split(' ')[0];

                            seccion += `   ${nombreMesCap.padEnd(12)} ${fmtHM(sumarHoras(regsM)).padEnd(10)}  (${normales.length} jornadas)`;
                            if (notas.length > 0) seccion += `  [${notas.join(', ')}]`;
                            seccion += '\n';
                        });
                        return seccion;

                    } else {
                        let seccion = `

──────────────────────────────────────────────────────────────────

📋 DETALLE DIARIO
──────────────────────────────────────────────────────────────────

`;
                        const registrosOrdenados = [...registrosPeriodo].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

                        registrosOrdenados.forEach(r => {
                            const dia = obtenerNombreDia(r.fecha);
                            const fecha = r.fecha.split('-').reverse().join('/');
                            const tipoEspecial = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
                            let linea = '';
                            if (tipoEspecial) {
                                linea = `${fecha}  ${dia.padEnd(10)} ${tipoEspecial.label.toUpperCase()}`;
                            } else {
                                const entrada = r.entrada || '--:--';
                                const salida = r.salida || '--:--';
                                const total = r.salida ? fmtHM(r.total) : 'Incompleto';
                                const tiempoFuera = r.tiempoFuera ? ` (${r.tiempoFuera} fuera)` : '';
                                const infoAsueto = (r.credito && r.credito !== '00:00') ? ' [SALIDA TEMPRANO]' : '';
                                let indicador = '  ';
                                if (r.salida) indicador = r.total >= horasDiariasObjetivo ? '✓ ' : '✗ ';
                                linea = `${fecha}  ${dia.padEnd(10)} ${entrada} → ${salida}  [${total}]${tiempoFuera}${infoAsueto} ${indicador}`;
                            }
                            seccion += linea + '\n';
                        });
                        return seccion;
                    }
                },

                totalesPorSemana: () => {
                    if (esAnual || !mesSeleccionado) return '';

                    const [añoActual, mesActual] = mesSeleccionado.split('-').map(Number);
                    const primerDiaMes = `${añoActual}-${String(mesActual).padStart(2, '0')}-01`;
                    const ultimoDiaMes = new Date(añoActual, mesActual, 0).getDate();
                    const ultimaFechaMes = `${añoActual}-${String(mesActual).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

                    const semanas = new Map();
                    registrosPeriodo.forEach(r => {
                        const lunes = obtenerLunesSemana(r.fecha);
                        if (!semanas.has(lunes)) {
                            const _base = { trabajados: [] };
                            TiposRegistro.obtenerTodosLosTipos().forEach(t => _base[t.labelPlural.toLowerCase()] = []);
                            semanas.set(lunes, _base);
                        }
                        const semana = semanas.get(lunes);
                        const tipoEspecial = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
                        if (tipoEspecial) {
                            const categoria = tipoEspecial.labelPlural.toLowerCase();
                            if (semana[categoria]) semana[categoria].push(r);
                        } else {
                            semana.trabajados.push(r);
                        }
                    });

                    const semanasOrdenadas = Array.from(semanas.entries()).sort((a, b) => new Date(a[0]) - new Date(b[0]));
                    if (semanasOrdenadas.length === 0) return '';

                    let seccion = `

────────────────────────────────────────────────────────────────

📅 TOTALES POR SEMANA
────────────────────────────────────────────────────────────────

`;
                    const semanasIncompletas = [];

                    semanasOrdenadas.forEach(([lunesOriginal, datos], index) => {
                        let totalSemanal = datos.trabajados.reduce((sum, r) => sum + r.total, 0);
                        if (datos.remotos && datos.remotos.length > 0) totalSemanal += datos.remotos.length * horasDiariasObjetivo;

                        const fechaLunes = S.parsearFechaLocal(lunesOriginal);
                        const fechaDomingo = new Date(fechaLunes);
                        fechaDomingo.setDate(fechaLunes.getDate() + 6);
                        const domingo = S.formatearFechaLocal(fechaDomingo);

                        let lunes = lunesOriginal;
                        let fechaFin = domingo;
                        let esIncompleta = false;
                        let continuaEn = '';

                        if (domingo > ultimaFechaMes) {
                            fechaFin = ultimaFechaMes;
                            esIncompleta = true;
                            const mesSig = mesActual === 12 ? 1 : mesActual + 1;
                            const añoSig = mesActual === 12 ? añoActual + 1 : añoActual;
                            continuaEn = `continúa en ${new Date(añoSig, mesSig - 1, 1).toLocaleDateString('es-ES', { month: 'long' })}`;
                        }

                        if (lunes < primerDiaMes) {
                            lunes = primerDiaMes;
                            esIncompleta = true;
                            const mesAnt = mesActual === 1 ? 12 : mesActual - 1;
                            const añoAnt = mesActual === 1 ? añoActual - 1 : añoActual;
                            continuaEn = `viene de ${new Date(añoAnt, mesAnt - 1, 1).toLocaleDateString('es-ES', { month: 'long' })}`;
                        }

                        const lunesFormato = lunes.split('-').reverse().join('/');
                        const finFormato = fechaFin.split('-').reverse().join('/');
                        const asterisco = esIncompleta ? '*' : '';

                        seccion += `   Semana ${index + 1} (${lunesFormato} - ${finFormato})${asterisco}:\n`;
                        seccion += `      └─ ${fmtHM(totalSemanal)}`;

                        const notasExtras = TiposRegistro.obtenerTodosLosTipos()
                            .map(t => {
                                const clave = t.labelPlural.toLowerCase();
                                return datos[clave]?.length > 0 ? `${datos[clave].length} ${clave}` : null;
                            })
                            .filter(Boolean);

                        if (notasExtras.length > 0) seccion += ` [${notasExtras.join(', ')}]`;
                        seccion += '\n\n';

                        if (esIncompleta && continuaEn) semanasIncompletas.push(`* Semana ${index + 1}: ${continuaEn}`);
                    });

                    if (semanasIncompletas.length > 0) seccion += semanasIncompletas.join('\n') + '\n';
                    return seccion;
                },

                configuracion: () => `

────────────────────────────────────────────────────────────────

⚙️ Ajustes
────────────────────────────────────────────────────────────────

   • Horas diarias:          ${D.horasDiarias()}
   • Días hábiles/semana:    ${D.diasHabiles().map(d => ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d]).join(', ')}
   • Horas semanales:        ${D.horasSemanales()}`,

                footer: () => `

────────────────────────────────────────────────────────────────

Generado por Sistema Lushibosca
`
            };

            const contenido =
                reporte.header() +
                reporte.resumenGeneral() +
                reporte.detallePeriodo() +
                reporte.totalesPorSemana() +
                reporte.configuracion() +
                reporte.footer();

            try {
                const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = nombreArchivo;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                mostrarToast(esAnual ? 'Reporte anual generado' : 'Reporte generado', 'success');
            } catch (e) {
                console.error('Error generando reporte:', e);
                mostrarToast('Error al generar reporte', 'error');
            }
        }

        function sumarMinutosAHora(horaString, minutosASumar) {
            let totalMinutos = minutosASumar;

            if (horaString && horaString.includes(':')) {
                const [h, m] = horaString.split(':').map(Number);
                if (!isNaN(h) && !isNaN(m)) {
                    totalMinutos += (h * 60) + m;
                }
            }

            let horas = Math.floor(totalMinutos / 60);
            let mins = Math.round(totalMinutos % 60);

            if (horas > 23) { horas = 23; mins = 59; }

            return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        }

        function actualizarEstadoBotonTimerMain() {
            const btn = document.getElementById('btn-timer-main');
            const card = document.getElementById('stats-card');
            if (!btn) return;

            if (modoLoteActivo) {
                btn.style.display = 'none';
                return;
            }

            btn.style.display = '';

            const hoy = obtenerFechaHoy();
            const registroHoy = D.registros().find(r => r.fecha === hoy);
            const perfilId = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';
            const storageKey = `breakStartTime_${perfilId}`;
            const isRunning = localStorage.getItem(storageKey) !== null;
            const icon = btn.querySelector('use');

            const diaCerrado = registroHoy && registroHoy.salida && registroHoy.salida.trim() !== '';

            if (!isRunning && (!registroHoy || diaCerrado)) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.title = diaCerrado ? "Día finalizado" : "Debes fichar entrada primero";
            } else {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.title = isRunning ? "Detener tiempo fuera" : "Iniciar tiempo fuera";
            }

            if (isRunning) {
                btn.classList.add('running');
                btn.style.color = 'var(--c-red)';
                btn.style.borderColor = 'var(--c-red)';
                icon.setAttribute('href', '#icon-exit');

                if (card) {
                    card.classList.add('timer-running');
                    const titulo = card.querySelector('h2');

                    const vistaActual = D.vistaActual();
                    const icono = vistaActual === 'semana'
                        ? '<svg class="icon"><use href="#icon-calendar-simple"/></svg>'
                        : '<svg class="icon"><use href="#icon-clock"/></svg>';

                    const contexto = vistaActual === 'semana' ? 'Esta Semana' : obtenerNombreDia(obtenerFechaHoy());

                    if (titulo) {
                        titulo.innerHTML = `${icono} ${contexto} - <svg class="icon"><use href="#icon-exit"/></svg> Tiempo fuera `;
                        const breakCounter = document.createElement('span');
                        breakCounter.id = 'break-counter';
                        breakCounter.className = 'break-counter-label';
                        titulo.appendChild(breakCounter);
                        _iniciarContadorBreak(storageKey);
                    }
                }

            } else {
                btn.classList.remove('running');
                btn.style.color = 'var(--text-main)';
                btn.style.borderColor = 'var(--border)';
                icon.setAttribute('href', '#icon-exit');

                if (card) card.classList.remove('timer-running');
                _detenerContadorBreak();
            }
        }

        let _breakCounterInterval = null;

        function _iniciarContadorBreak(storageKey) {
            _detenerContadorBreak();
            function _actualizarContador() {
                const el = document.getElementById('break-counter');
                if (!el) { _detenerContadorBreak(); return; }
                const start = parseInt(localStorage.getItem(storageKey));
                if (isNaN(start)) { el.textContent = ''; _detenerContadorBreak(); return; }
                const totalSeg = Math.floor((Date.now() - start) / 1000);
                const mins = Math.floor(totalSeg / 60);
                const horas = Math.floor(mins / 60);
                const minsResto = mins % 60;
                if (horas > 0) {
                    el.textContent = `${horas}h ${minsResto}m`;
                } else {
                    el.textContent = `${mins}m`;
                }
            }
            _actualizarContador();
            _breakCounterInterval = setInterval(_actualizarContador, 1000);
        }

        function _detenerContadorBreak() {
            if (_breakCounterInterval) {
                clearInterval(_breakCounterInterval);
                _breakCounterInterval = null;
            }
        }

        async function toggleTimerBreakMain() {
            const perfilId = window.PerfilManager ? PerfilManager.obtenerPerfilActual() : 'default';
            const storageKey = `breakStartTime_${perfilId}`;
            const storedStart = localStorage.getItem(storageKey);
            const hoy = obtenerFechaHoy();
            const registroHoy = D.registros().find(r => r.fecha === hoy);

            if (!storedStart && !registroHoy) {
                mostrarToast('Debes crear un registro para hoy primero', 'warning');
                return;
            }

            if (!storedStart) {
                localStorage.setItem(storageKey, Date.now());
                mostrarToast('Tiempo fuera iniciado', 'info');
            } else {
                const start = parseInt(storedStart);
                const end = Date.now();
                const diffMs = end - start;

                const segundosTranscurridos = Math.floor(diffMs / 1000);
                let minutosTranscurridos = Math.floor(segundosTranscurridos / 60);
                const segundosRestantes = segundosTranscurridos % 60;

                if (segundosRestantes >= 30) {
                    minutosTranscurridos += 1;
                }

                if (segundosTranscurridos < 30) {
                    localStorage.removeItem(storageKey);
                    mostrarToast('Tiempo muy corto, no se registró', 'info');
                    actualizarEstadoBotonTimerMain();
                    actualizarUI();
                    return;
                }

                if (!registroHoy) {
                    localStorage.removeItem(storageKey);
                    mostrarToast('No hay registro para hoy, tiempo fuera descartado', 'warning');
                    actualizarEstadoBotonTimerMain();
                    actualizarUI();
                    return;
                }
                const tiempoActual = registroHoy.tiempoFuera || '00:00';
                const nuevoTiempoFuera = sumarMinutosAHora(tiempoActual, minutosTranscurridos);
                registroHoy.tiempoFuera = nuevoTiempoFuera;
                const t = D.calcularHoras(registroHoy.entrada, registroHoy.salida, nuevoTiempoFuera);
                registroHoy.horas = t?.horas || 0;
                registroHoy.minutos = t?.minutos || 0;
                registroHoy.total = t?.total || 0;
                HistoryManager.saveState(D.registros());

                localStorage.removeItem(storageKey);
                await D.guardarYActualizar(registroHoy.id);

                const mensaje = minutosTranscurridos === 1
                    ? 'Se descontó 1 minuto al registro de hoy'
                    : `Se descontaron ${minutosTranscurridos} minutos al registro de hoy`;
                mostrarToast(mensaje, 'success');
            }

            actualizarEstadoBotonTimerMain();
        }

        function setBloqueoEdicion(bloqueado) {
            edicionBloqueada = bloqueado;

            const btnLock = $('btn-lock-toggle');
            if (btnLock) {
                const icon = btnLock.querySelector('use');
                icon.setAttribute('href', bloqueado ? '#icon-lock' : '#icon-lock-open');
                btnLock.title = bloqueado ? "Desbloquear edición" : "Bloquear edición";
                btnLock.style.color = bloqueado ? 'var(--c-red)' : 'var(--text-main)';
            }

            const inputs = ['edit-fecha', 'edit-entrada', 'edit-salida', 'edit-tiempo-fuera', 'edit-notas'];
            inputs.forEach(id => {
                const el = $(id);
                if (el) el.disabled = bloqueado;
            });

            const modal = $('modal-editar');
            if (modal) {
                const botones = modal.querySelectorAll('button:not(#btn-lock-toggle):not(.btn-cancel):not(#btn-toggle-credito)');
                botones.forEach(btn => {
                    btn.disabled = bloqueado;
                });
            }
            verificarBloqueoCredito();
        }

        function toggleBloqueoEdicion() {
            setBloqueoEdicion(!edicionBloqueada);
        }

        function renderizarListaPerfiles() {
            const lista = document.getElementById('lista-perfiles-botones');
            if (!lista) return;

            lista.innerHTML = '';
            const perfiles = window.PerfilManager.obtenerListaPerfiles();

            perfiles.forEach(p => {
                const container = document.createElement('div');
                container.className = `btn-perfil-select ${p.esActual ? 'activo' : ''}`;

                const infoSection = document.createElement('div');
                infoSection.className = 'btn-perfil-info';

                const nombreSpan = document.createElement('div');
                nombreSpan.className = 'btn-perfil-nombre';
                nombreSpan.textContent = p.nombre;

                infoSection.appendChild(nombreSpan);

                const badge = document.createElement('div');
                badge.className = 'btn-perfil-badge';
                badge.style.color = p.esActual ? 'var(--c-green)' : '';
                const countText = `${p.totalRegistros} registro${p.totalRegistros !== 1 ? 's' : ''}`;
                badge.textContent = p.esActual ? `${countText} · Activo` : countText;
                infoSection.appendChild(badge);

                const editBtn = document.createElement('button');
                editBtn.className = 'btn-perfil-edit';
                editBtn.innerHTML = '<svg class="icon"><use href="#icon-edit"/></svg>';
                editBtn.title = 'Editar perfil';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    UILogic.abrirEditorPerfil(p.id);
                };

                container.onclick = () => {
                    if (!p.esActual) {
                        window.PerfilManager.cambiarPerfil(p.id);
                    }
                };

                if (p.esActual) {
                    container.style.cursor = 'default';
                }

                container.appendChild(infoSection);
                container.appendChild(editBtn);
                lista.appendChild(container);
            });
        }

        function _cerrarSelectorMeses(idResaltar = null) {
            const grid = document.getElementById('calendario-grid');
            const selector = document.getElementById('calendario-selector-meses');
            const navBotones = document.getElementById('calendario-nav-botones');
            selector.classList.add('fade-out');
            setTimeout(() => {
                selector.classList.remove('fade-out');
                selector.style.display = 'none';
                navBotones.style.display = 'flex';
                grid.style.display = 'grid';
                grid.classList.add('fade-out');
                grid.offsetHeight;
                _renderizarCalendario(idResaltar);
                grid.classList.remove('fade-out');
            }, 300);
        }

        function abrirSelectorMesesCalendario() {
            const grid = document.getElementById('calendario-grid');
            const selector = document.getElementById('calendario-selector-meses');
            const navBotones = document.getElementById('calendario-nav-botones');
            const titulo = document.getElementById('calendario-titulo-mes');

            if (selector.style.display !== 'none') {
                _cerrarSelectorMeses();
                return;
            }

            const registros = D.registros();
            const mesesUnicos = new Set();
            registros.forEach(r => mesesUnicos.add(r.fecha.substring(0, 7)));
            const mesesOrdenados = Array.from(mesesUnicos).sort().reverse();

            selector.innerHTML = '';
            if (mesesOrdenados.length === 0) {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'empty-state empty-state--calendario';
                emptyEl.textContent = 'No hay registros';
                selector.appendChild(emptyEl);
            } else {
                const hoy = new Date();
                const anioActual = _calendarioMes ? _calendarioMes.anio : hoy.getFullYear();
                const mesActual = _calendarioMes ? _calendarioMes.mes : hoy.getMonth();

                const mesesPorAnio = new Map();
                mesesOrdenados.forEach(mesAnio => {
                    const anioStr = mesAnio.substring(0, 4);
                    if (!mesesPorAnio.has(anioStr)) mesesPorAnio.set(anioStr, []);
                    mesesPorAnio.get(anioStr).push(mesAnio);
                });

                mesesPorAnio.forEach((meses, anioStr) => {
                    const separador = document.createElement('div');
                    separador.className = 'selector-meses-anio-header';
                    separador.textContent = anioStr;
                    selector.appendChild(separador);

                    meses.forEach(mesAnio => {
                        const [aStr, mesStr] = mesAnio.split('-');
                        const anio = parseInt(aStr);
                        const mes = parseInt(mesStr) - 1;

                        const btn = document.createElement('button');
                        btn.className = 'btn-mes-calendario';

                        const fecha = new Date(anio, mes, 1);
                        let nombreMes = fecha.toLocaleDateString('es-ES', { month: 'long' });
                        nombreMes = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1).replace('.', '');
                        btn.textContent = nombreMes;

                        if (anio === anioActual && mes === mesActual) {
                            btn.classList.add('activo');
                        }

                        btn.onclick = (e) => {
                            e.stopPropagation();
                            _calendarioMes = { anio, mes };
                            _cerrarSelectorMeses();
                        };

                        selector.appendChild(btn);
                    });
                });
            }

            const alturaCalendario = grid.offsetHeight;
            selector.style.height = alturaCalendario + 'px';

            grid.classList.add('fade-out');
            setTimeout(() => {
                grid.classList.remove('fade-out');
                grid.style.display = 'none';
                navBotones.style.display = 'none';
                titulo.textContent = 'Selector de mes';
                selector.style.display = 'grid';
                selector.classList.add('fade-out');
                selector.offsetHeight;
                selector.classList.remove('fade-out');
            }, 300);
        }

        function abrirSelectorPerfiles() {
            ModalManager.abrir('modal-selector-perfiles', () => {
                const inputNuevo = document.getElementById('nombre-nuevo-perfil-selector');
                if (inputNuevo) inputNuevo.value = '';

                renderizarListaPerfiles();

                const temaOscuro = document.body.classList.contains('dark-mode');
                const toggleBtnModal = document.getElementById('theme-toggle-modal');

                if (toggleBtnModal) {
                    const icon = toggleBtnModal.querySelector('use');
                    if (temaOscuro) {
                        icon.setAttribute('href', '#icon-sun');
                    } else {
                        icon.setAttribute('href', '#icon-moon');
                    }
                }
            });
        }

        function crearPerfilDesdeSelector() {
            const input = document.getElementById('nombre-nuevo-perfil-selector');
            if (!input) return;

            const nombre = S.sanitizeString(input.value.trim(), 30);

            if (!nombre) {
                mostrarToast('Ingresa un nombre para el perfil', 'error');
                return;
            }

            const regexSeguro = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\-_ ]+$/;

            if (!regexSeguro.test(nombre)) {
                mostrarToast('El nombre contiene caracteres no válidos.\n Solo letras, números y espacios.', 'error');
                return;
            }

            const perfiles = window.PerfilManager ? PerfilManager.obtenerTodosPerfiles() : {};

            const nombreNormalizado = nombre.toLowerCase().trim();
            const nombreExiste = Object.values(perfiles).some(perfil =>
                perfil.nombre.toLowerCase().trim() === nombreNormalizado
            );

            if (nombreExiste) {
                mostrarToast('Ya existe un perfil con ese nombre', 'error');
                return;
            }

            if (Object.keys(perfiles).length >= 7) {
                mostrarToast('Máximo de perfiles alcanzado (7)', 'error');
                return;
            }

            const id = 'perfil_' + Date.now();
            perfiles[id] = {
                nombre: nombre,
                registros: [],
                diasHabiles: [1, 2, 3, 4, 5],
                horasDiarias: 7
            };

            try {
                localStorage.setItem('perfiles', JSON.stringify(perfiles));
            } catch (e) {
                console.error('Error al guardar perfil:', e);
                delete perfiles[id];
                mostrarToast('Error al guardar: almacenamiento lleno', 'error');
                return;
            }

            if (window.PerfilManager) {
                window.PerfilManager.inicializar();
            }

            mostrarToast(`Perfil "${nombre}" creado`, 'success');

            input.value = '';

            renderizarListaPerfiles();

            requestAnimationFrame(() => {
                const lista = document.getElementById('lista-perfiles-botones');
                const nuevoPerfilElement = lista?.lastElementChild;
                if (nuevoPerfilElement) {
                    nuevoPerfilElement.style.animation = 'zoomIn 0.3s ease-out';
                    nuevoPerfilElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        }

        function cerrarSelectorPerfiles() {
            ModalManager.cerrar('modal-selector-perfiles');
        }

        function mostrarconfig() {
            ModalManager.alternar('modal-selector-perfiles', 'modal-config', null, () => {
                $('config-horas-diarias').value = D.horasDiarias();

                const diasActivos = D.diasHabiles();
                const checkboxes = document.querySelectorAll('input[name="dia-habil"]');
                checkboxes.forEach(cb => {
                    cb.checked = diasActivos.includes(parseInt(cb.value));
                    cb.onchange = UILogic.actualizarFeedbackConfig;
                });

                UILogic.actualizarFeedbackConfig();
                actualizarEstadoBotonIgnorarTF();
                const lbl = $('hint-fondo-label');
                const _labels = { 'golden-gate': 'Golden Gate', 'obelisco': 'Skyline BA', 'ninguno': 'Sin fondo' };
                if (lbl) lbl.textContent = _labels[_fondoCard] || 'Golden Gate';
            });
        }

        function abrirEditorPerfil(perfilId) {
            perfilEnEdicion = perfilId;
            const perfiles = window.PerfilManager ? PerfilManager.obtenerTodosPerfiles() : {};
            const perfil = perfiles[perfilId];

            if (!perfil) {
                mostrarToast('Perfil no encontrado', 'error');
                return;
            }

            document.getElementById('nombre-perfil-editar').value = perfil.nombre;
            document.getElementById('id-perfil-editar').value = perfilId;

            const btnEliminar = document.getElementById('btn-eliminar-perfil-editor');
            if (btnEliminar) {
                btnEliminar.disabled = (perfilId === 'default');
            }

            ModalManager.alternar('modal-selector-perfiles', 'modal-editar-perfil');
        }

        function cerrarEditorPerfil() {
            perfilEnEdicion = null;
            ModalManager.alternar('modal-editar-perfil', 'modal-selector-perfiles', null, () => {
                const inputNuevo = document.getElementById('nombre-nuevo-perfil-selector');
                if (inputNuevo) inputNuevo.value = '';
                renderizarListaPerfiles();
            });
        }

        function guardarEdicionPerfil() {
            if (!perfilEnEdicion) return;

            const nuevoNombre = S.sanitizeString(document.getElementById('nombre-perfil-editar').value.trim(), 30);

            if (!nuevoNombre) {
                mostrarToast('Ingresa un nombre válido', 'error');
                return;
            }

            const regexSeguro = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\-_ ]+$/;

            if (!regexSeguro.test(nuevoNombre)) {
                mostrarToast('Caracteres no permitidos en el nombre.', 'error');
                return;
            }

            const perfiles = window.PerfilManager ? PerfilManager.obtenerTodosPerfiles() : {};

            if (!perfiles[perfilEnEdicion]) {
                mostrarToast('Perfil no encontrado', 'error');
                return;
            }

            if (perfiles[perfilEnEdicion].nombre === nuevoNombre) {
                mostrarToast('Sin cambios', 'info');
                cerrarEditorPerfil();
                return;
            }

            const nombreNormalizado = nuevoNombre.toLowerCase().trim();
            const nombreExiste = Object.entries(perfiles).some(([id, perfil]) =>
                id !== perfilEnEdicion &&
                perfil.nombre.toLowerCase().trim() === nombreNormalizado
            );

            if (nombreExiste) {
                mostrarToast('Ya existe otro perfil con ese nombre', 'error');
                return;
            }

            const nombreAnterior = perfiles[perfilEnEdicion].nombre;
            perfiles[perfilEnEdicion].nombre = nuevoNombre;
            try {
                localStorage.setItem('perfiles', JSON.stringify(perfiles));
            } catch (e) {
                console.error('Error al guardar perfil:', e);
                perfiles[perfilEnEdicion].nombre = nombreAnterior;
                mostrarToast('Error al guardar: almacenamiento lleno', 'error');
                return;
            }

            const perfilActual = window.PerfilManager.obtenerPerfilActual();
            if (perfilEnEdicion === perfilActual) {
                const btnTexto = document.getElementById('nombre-perfil-header');
                if (btnTexto) btnTexto.textContent = nuevoNombre;
            }

            if (window.PerfilManager) {
                window.PerfilManager.inicializar();
            }

            mostrarToast('Perfil actualizado', 'success');
            cerrarEditorPerfil();
        }

        async function eliminarPerfilDesdeEditor() {
            if (!perfilEnEdicion || perfilEnEdicion === 'default') {
                mostrarToast('No se puede eliminar el perfil Principal', 'error');
                return;
            }

            const perfiles = window.PerfilManager ? PerfilManager.obtenerTodosPerfiles() : {};
            const perfil = perfiles[perfilEnEdicion];

            if (!perfil) {
                mostrarToast('Perfil no encontrado', 'error');
                return;
            }

            const confirmacion = await confirmarModal(`¿Estás seguro de que querés eliminar el perfil "${perfil.nombre}"? Esta acción no se puede deshacer.`, 'Eliminar');

            if (!confirmacion) return;

            const pid = perfilEnEdicion;
            localStorage.removeItem(`breakStartTime_${pid}`);
            localStorage.removeItem(`history_${pid}`);
            localStorage.removeItem(`fondoCard_${pid}`);
            localStorage.removeItem(`ignorarTiempoFuera_${pid}`);
            localStorage.removeItem(`cardVisible_registrar_${pid}`);
            localStorage.removeItem(`cardVisible_estadisticas_${pid}`);
            localStorage.removeItem(`cardVisible_historico_${pid}`);
            localStorage.removeItem(`ordenCards_${pid}`);

            delete perfiles[perfilEnEdicion];
            try {
                localStorage.setItem('perfiles', JSON.stringify(perfiles));
            } catch (e) {
                console.error('Error al eliminar perfil:', e);
                mostrarToast('Error al guardar: almacenamiento lleno', 'error');
                return;
            }

            const perfilActual = window.PerfilManager.obtenerPerfilActual();
            if (perfilEnEdicion === perfilActual) {
                try {
                    localStorage.setItem('perfilActivo', 'default');
                } catch (e) {
                    console.error('Error al guardar perfil activo:', e);
                    mostrarToast('Error al guardar: almacenamiento lleno', 'error');
                    return;
                }
                mostrarToast('Perfil eliminado. Recargando...', 'success');
                setTimeout(() => location.reload(), 1000);
            } else {
                if (window.PerfilManager) {
                    window.PerfilManager.inicializar();
                }

                mostrarToast('Perfil eliminado', 'success');
                cerrarEditorPerfil();
            }
        }

        function toggleModoLote() {
            const modoNormal = document.getElementById('modo-normal');
            const modoLote = document.getElementById('modo-lote');
            const btnTexto = document.getElementById('btn-registrar-texto');
            const btnTimer = document.getElementById('btn-timer-main');
            const btn = document.getElementById('btn-agregar');

            modoLoteActivo = !modoLoteActivo;

            if (modoLoteActivo) {
                modoNormal.classList.add('fade-out');

                setTimeout(() => {
                    modoNormal.style.display = 'none';
                    modoLote.style.display = 'block';
                    modoLote.offsetHeight;
                    modoLote.classList.remove('fade-out');

                    document.getElementById('lote-tipo').value = 'feriado';
                    document.getElementById('lote-fecha-desde').value = '';
                    document.getElementById('lote-fecha-hasta').value = '';

                    btnTexto.textContent = 'Fichar Lote';
                    btn.style.background = '';
                    btn.style.color = '';

                    setIconoBtn(btn, '#icon-save');

                    btnTimer.disabled = true;
                    btnTimer.style.opacity = '0.3';

                    actualizarBotonLote();
                }, 300);

            } else {
                modoLote.classList.add('fade-out');

                setTimeout(() => {
                    modoLote.style.display = 'none';
                    modoNormal.style.display = 'block';
                    modoNormal.offsetHeight;
                    modoNormal.classList.remove('fade-out');
                    UILogic.resetearBoton(btn);
                    btnTimer.style.opacity = '1';
                    actualizarEstadoBotonTimerMain();
                }, 300);
            }
        }

        async function ejecutarAccionRegistro() {
            if (modoLoteActivo) {
                await registrarLoteDesdeCard();
            } else {
                await DataManagement.agregarRegistro();
            }

            if (modoLoteActivo) {
                setTimeout(() => actualizarBotonLote(), 100);
            }
        }

        async function registrarLoteDesdeCard() {
            const inputDesde = document.getElementById('lote-fecha-desde');
            const inputHasta = document.getElementById('lote-fecha-hasta');
            const tipo = document.getElementById('lote-tipo').value;

            if (inputDesde.value === '' && inputDesde.validity && !inputDesde.validity.valid) {
                mostrarToast('Fecha inicial inválida', 'error');
                return;
            }

            if (inputHasta.value === '' && inputHasta.validity && !inputHasta.validity.valid) {
                mostrarToast('Fecha final inválida', 'error');
                return;
            }

            const desde = inputDesde.value;
            const hasta = inputHasta.value;

            if (!desde && !hasta) {
                if (!inputDesde.checkValidity() || !inputHasta.checkValidity()) {
                    mostrarToast('Revisa las fechas ingresadas', 'error');
                    return;
                }

                if (tipo === 'normal') {
                    mostrarToast('Completa los campos Desde y Hasta.', 'info');
                    return;
                }


                const fechaHoy = UILogic.obtenerFechaHoy();
                const registroExistente = DataManagement.registros().find(r => r.fecha === fechaHoy);
                if (registroExistente) {
                    mostrarToast('Ya existe un registro para hoy', 'warning');
                    return;
                }

                try {
                    await DataManagement.registrarDiaEspecial(fechaHoy, tipo);
                    document.getElementById('lote-fecha-desde').value = '';
                    document.getElementById('lote-fecha-hasta').value = '';
                } catch (error) {
                    console.error('Error al registrar:', error);
                }
                return;
            }

            if (desde && !hasta) {
                if (tipo === 'normal') {
                    mostrarToast('Completa ambos campos', 'info');
                    return;
                }

                const registroExistente = DataManagement.registros().find(r => r.fecha === desde);
                if (registroExistente) {
                    mostrarToast('Ya existe un registro para esa fecha', 'warning');
                    return;
                }

                try {
                    await DataManagement.registrarDiaEspecial(desde, tipo);
                    aplicarFeedbackCampos([
                        { id: 'lote-fecha-desde', fallback: 'Desde', mostrar: true },
                        { id: 'lote-fecha-hasta', fallback: 'Hasta', mostrar: false }
                    ]);
                    document.getElementById('lote-fecha-desde').value = '';
                    document.getElementById('lote-fecha-hasta').value = '';
                } catch (error) {
                    console.error('Error al registrar:', error);
                }
                return;
            }

            if (!desde && hasta) {
                mostrarToast('Completa ambos campos', 'info');
                return;
            }

            if (desde > hasta) {
                mostrarToast('La fecha inicial debe ser inferior a la final', 'error');
                return;
            }

            let registrosDelTipoEnRango;

            if (tipo === 'normal') {
                registrosDelTipoEnRango = DataManagement.registros().filter(r => {
                    const dentroDelRango = r.fecha >= desde && r.fecha <= hasta;
                    const esEspecial = TiposRegistro.esRegistroEspecial(r.entrada, r.salida);
                    return dentroDelRango && !esEspecial;
                });
            } else {
                const codigosTipo = TiposRegistro.obtenerCodigosPorTipo(tipo);

                if (!codigosTipo) {
                    mostrarToast('Tipo de registro inválido', 'error');
                    return;
                }

                registrosDelTipoEnRango = DataManagement.registros().filter(r =>
                    r.fecha >= desde &&
                    r.fecha <= hasta &&
                    r.entrada === codigosTipo.entrada &&
                    r.salida === codigosTipo.salida
                );
            }

            try {
                if (tipo === 'normal') {
                    await DataManagement.borrarPeriodoDirecto(desde, hasta);
                } else {
                    await DataManagement.registrarVacacionesDirecto(desde, hasta, tipo);
                }

                aplicarFeedbackCampos([
                    { id: 'lote-fecha-desde', fallback: 'Desde', mostrar: true },
                    { id: 'lote-fecha-hasta', fallback: 'Hasta', mostrar: true }
                ]);
                document.getElementById('lote-fecha-desde').value = '';
                document.getElementById('lote-fecha-hasta').value = '';
            } catch (error) {
                console.error('Error en operación de lote:', error);
            }
        }

        function setIconoBtn(btn, icono) {
            const use = btn.querySelector('svg use');
            if (use) use.setAttribute('href', icono);
        }

        function poblarSelectoresTipos() {
            const tipos = TiposRegistro.obtenerTodosLosTipos();

            const selectLote = $('lote-tipo');
            if (selectLote) {
                selectLote.innerHTML = '';
                tipos.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = `${t.emoji} ${t.label} (${t.codigo})`;
                    selectLote.appendChild(opt);
                });
                const optNormal = document.createElement('option');
                optNormal.value = 'normal';
                optNormal.textContent = '🕒 Jornadas (borrar)';
                selectLote.appendChild(optNormal);
            }

            const selectFiltro = $('filtro-tipo');
            if (selectFiltro) {
                selectFiltro.innerHTML = '<option value="">Todos</option><option value="normal">🕒 Jornadas</option>';
                tipos.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = `${t.emoji} ${t.labelPlural}`;
                    selectFiltro.appendChild(opt);
                });
            }

            const selectGrupo = $('edit-grupo-tipo');
            if (selectGrupo) {
                selectGrupo.innerHTML = '';
                tipos.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = `${t.emoji} ${t.label}`;
                    selectGrupo.appendChild(opt);
                });
            }
        }

        function actualizarBotonLote() {
            const tipo = document.getElementById('lote-tipo').value;
            const desde = document.getElementById('lote-fecha-desde').value;
            const hasta = document.getElementById('lote-fecha-hasta').value;
            const btn = document.getElementById('btn-agregar');
            const btnTexto = document.getElementById('btn-registrar-texto');

            btn.style.background = '';
            btn.style.color = '';

            if (!desde && !hasta) {
                btnTexto.textContent = 'Fichar';
                setIconoBtn(btn, '#icon-save');
                return;
            }

            if (desde && !hasta) {
                if (tipo === 'normal') {
                    btnTexto.textContent = 'Requiere Rango';
                    btn.style.color = 'var(--c-red)';
                    setIconoBtn(btn, '#icon-save');
                    return;
                }

                const registroExiste = DataManagement.registros().find(r => r.fecha === desde);
                if (registroExiste) {
                    btnTexto.textContent = 'Fichado';
                    btn.style.color = 'var(--text-muted)';
                } else {
                    btnTexto.textContent = 'Fichar';
                }
                setIconoBtn(btn, '#icon-save');
                return;
            }

            if (!desde && hasta) {
                btnTexto.textContent = 'Requiere Rango';
                btn.style.color = 'var(--c-red)';
                return;
            }

            if (!S.validarFechaSegura(desde)) {
                btnTexto.textContent = 'Fecha Inicial Inválida';
                btn.style.color = 'var(--c-red)';
                setIconoBtn(btn, '#icon-save');
                return;
            }

            if (!S.validarFechaSegura(hasta)) {
                btnTexto.textContent = 'Fecha Final Inválida';
                btn.style.color = 'var(--c-red)';
                setIconoBtn(btn, '#icon-save');
                return;
            }

            if (desde > hasta) {
                btnTexto.textContent = 'Rango Inválido';
                btn.style.color = 'var(--c-red)';
                setIconoBtn(btn, '#icon-save');
                return;
            }

            const fechaInicio = S.parsearFechaLocal(desde);
            const fechaFin = S.parsearFechaLocal(hasta);
            const diffTime = Math.abs(fechaFin - fechaInicio);
            const diasTotales = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            let registrosDelTipoEnRango;

            if (tipo === 'normal') {
                registrosDelTipoEnRango = DataManagement.registros().filter(r => {
                    const dentroDelRango = r.fecha >= desde && r.fecha <= hasta;
                    const esEspecial = TiposRegistro.esRegistroEspecial(r.entrada, r.salida);
                    return dentroDelRango && !esEspecial;
                });

                const cantidadRegistros = registrosDelTipoEnRango.length;

                if (cantidadRegistros > 0) {
                    btnTexto.textContent = `Borrar (${cantidadRegistros})`;
                    btn.style.color = 'var(--c-red)';
                    setIconoBtn(btn, '#icon-trash');
                } else {
                    btnTexto.textContent = 'Sin Registros';
                    btn.style.color = 'var(--text-muted)';
                    setIconoBtn(btn, '#icon-save');
                }
            } else {
                const codigosTipo = TiposRegistro.obtenerCodigosPorTipo(tipo);

                if (codigosTipo) {
                    registrosDelTipoEnRango = DataManagement.registros().filter(r =>
                        r.fecha >= desde &&
                        r.fecha <= hasta &&
                        r.entrada === codigosTipo.entrada &&
                        r.salida === codigosTipo.salida
                    );

                    const diasOcupados = DataManagement.registros().filter(r =>
                        r.fecha >= desde && r.fecha <= hasta
                    );

                    const yaRegistrados = registrosDelTipoEnRango.length;
                    const disponibles = diasTotales - diasOcupados.length;
                    const sobreescribirOtros = diasOcupados.length - yaRegistrados;

                    if (disponibles === 0 && yaRegistrados === diasTotales) {
                        btnTexto.textContent = `Fichado (${diasTotales})`;
                        btn.style.color = 'var(--text-muted)';
                    } else if (disponibles === diasTotales) {
                        btnTexto.textContent = `Fichar (${diasTotales})`;
                    } else if (sobreescribirOtros > 0) {
                        btnTexto.textContent = `Fichar (${disponibles} - ${sobreescribirOtros})`;
                    } else {
                        btnTexto.textContent = `Fichar (${disponibles})`;
                    }
                    setIconoBtn(btn, '#icon-save');
                } else {
                    registrosDelTipoEnRango = [];
                    btnTexto.textContent = 'Fichar';
                    setIconoBtn(btn, '#icon-save');
                }
            }
        }

        function toggleCredito() {
            const btn = document.getElementById('btn-toggle-credito');
            const estaActivo = btn.dataset.activo === "true";

            btn.dataset.activo = estaActivo ? "false" : "true";
            _setBtnActivo('btn-toggle-credito', !estaActivo);
            mostrarToast(!estaActivo ? 'Asueto | Salida temprano activado' : 'Asueto | Salida temprano desactivado', 'info');
        }

        function mostrarExportar(desdeLista = false) {
            _modalAbiertoDesdeLista = desdeLista;
            ModalManager.alternar(desdeLista ? null : 'modal-config', 'modal-exportar', null, () => {
                const tipoSelect = document.getElementById('tipo-exportacion');
                if (tipoSelect) tipoSelect.value = 'todo';

                const camposRango = document.getElementById('campos-rango-exportar');
                if (camposRango) { camposRango.style.maxHeight = '0'; camposRango.style.opacity = '0'; }

                document.getElementById('export-fecha-desde').value = '';
                document.getElementById('export-fecha-hasta').value = '';

                const btnVolverE = $('btn-volver-exportar');
                if (btnVolverE) {
                    btnVolverE.lastChild.textContent = desdeLista ? ' Cerrar' : ' Volver';
                    btnVolverE.querySelector('use').setAttribute('href', desdeLista ? '#icon-cancelar' : '#icon-undo');
                }
            });
        }

        function cerrarExportar() {
            ModalManager.alternar('modal-exportar', _modalAbiertoDesdeLista ? null : 'modal-config');
            _modalAbiertoDesdeLista = false;
        }

        function toggleCamposRangoExport() {
            const tipo = document.getElementById('tipo-exportacion').value;
            const camposRango = document.getElementById('campos-rango-exportar');

            if (tipo === 'rango') {
                camposRango.style.maxHeight = '200px';
                camposRango.style.opacity = '1';
            } else {
                camposRango.style.maxHeight = '0';
                camposRango.style.opacity = '0';
            }
        }

        async function ejecutarExportacion() {
            const tipo = document.getElementById('tipo-exportacion').value;
            const btn = document.querySelector('#modal-exportar .btn-export');

            btn.disabled = true;

            try {
                if (tipo === 'todo') {
                    D.exportarJSON();
                    cerrarExportar();

                } else if (tipo === 'mes-actual') {
                    const hoy = new Date();
                    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
                    await exportarRango(mesActual, mesActual, true);

                } else if (tipo === 'rango') {
                    const desde = S.sanitizeString(document.getElementById('export-fecha-desde').value, 10);
                    const hasta = S.sanitizeString(document.getElementById('export-fecha-hasta').value, 10);

                    if (!desde || !hasta) {
                        mostrarToast('Completa ambas fechas', 'error');
                        btn.disabled = false;
                        return;
                    }

                    if (!S.validarFechaSegura(desde) || !S.validarFechaSegura(hasta)) {
                        mostrarToast('Fechas inválidas', 'error');
                        btn.disabled = false;
                        return;
                    }

                    if (desde > hasta) {
                        mostrarToast('La fecha inicial debe ser anterior a la final', 'error');
                        btn.disabled = false;
                        return;
                    }

                    await exportarRango(desde, hasta, false);
                }

            } catch (error) {
                console.error('Error en exportación:', error);
                mostrarToast('Error al exportar', 'error');
            } finally {
                btn.disabled = false;
            }
        }

        async function exportarRango(desde, hasta, esMes = false) {
            let registrosFiltrados;

            if (esMes) {
                const [año, mes] = desde.split('-').map(Number);
                registrosFiltrados = D.registros().filter(r => {
                    const [aReg, mReg] = r.fecha.split('-').map(Number);
                    return aReg === año && mReg === mes;
                });
            } else {
                registrosFiltrados = D.registros().filter(r =>
                    r.fecha >= desde && r.fecha <= hasta
                );
            }

            if (registrosFiltrados.length === 0) {
                mostrarToast('No hay registros en ese rango', 'warning');
                return;
            }

            const ahora = new Date();
            const año = ahora.getFullYear();
            const mes = String(ahora.getMonth() + 1).padStart(2, '0');
            const dia = String(ahora.getDate()).padStart(2, '0');
            const hora = String(ahora.getHours()).padStart(2, '0');
            const minuto = String(ahora.getMinutes()).padStart(2, '0');
            const segundo = String(ahora.getSeconds()).padStart(2, '0');
            const fechaLocal = `${año}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;

            const data = {
                registros: registrosFiltrados,
                diasHabiles: D.diasHabiles(),
                horasDiarias: D.horasDiarias(),
                fecha: fechaLocal,
                version: S.SECURITY_LIMITS.SCHEMA_VERSION,
                hash: await S.calcularHashSHA256(registrosFiltrados),
                timestamp: Date.now(),
                rangoExportado: esMes ? `Mes ${desde}` : `${desde} a ${hasta}`
            };

            if (data.rangoExportado) {
                data.rangoExportado = S.sanitizeString(data.rangoExportado, 100);
            }

            try {
                const nombreSafe = obtenerNombrePerfilSafe();
                const fechaHoy = `${año}-${mes}-${dia}`;
                const sufijo = esMes ? `_${desde}` : `_${desde}_${hasta}`;
                descargarJSON(data, `Horarios_${nombreSafe}${sufijo}_${fechaHoy}.json`);

                const mensaje = esMes
                    ? `Exportados ${registrosFiltrados.length} registros del mes`
                    : `Exportados ${registrosFiltrados.length} registros`;
                mostrarToast(mensaje, 'success');
                cerrarExportar();

            } catch (e) {
                console.error(e);
                mostrarToast('Error al exportar', 'error');
            }
        }

        async function init() {
            if (typeof (Storage) === "undefined") {
                alert("Tu navegador no soporta localStorage.");
                return;
            }

            PerfilManager.inicializar();

            window.DataManagement = {
                agregarRegistro: D.agregarRegistro,
                exportarJSON: D.exportarJSON,
                mostrarImportar: mostrarImportar,
                importarDatos: D.importarDatos,
                borrarTodoHistorial: D.borrarTodoHistorial,
                editarRegistro: D.editarRegistro,
                guardarEdicion: D.guardarEdicion,
                eliminarRegistroActual: D.eliminarRegistroActual,
                undoAction: D.undoAction,
                redoAction: D.redoAction,
                aplicarFiltrosInmediato: D.aplicarFiltrosInmediato,
                limpiarFiltros: D.limpiarFiltros,
                registrarDiaEspecial: D.registrarDiaEspecial,
                registros: D.registros,
                diasHabiles: D.diasHabiles,
                horasDiarias: D.horasDiarias,
                setDiasHabiles: D.setDiasHabiles,
                setHorasDiarias: D.setHorasDiarias,
                calcularHoras: D.calcularHoras,
                registrarVacacionesDirecto: D.registrarVacacionesDirecto,
                borrarPeriodoDirecto: D.borrarPeriodoDirecto,
                editarGrupo: D.editarGrupo,
                guardarEdicionGrupo: D.guardarEdicionGrupo,
                eliminarGrupoActual: D.eliminarGrupoActual
            };
            window.HistoryManager = { undo: D.undoAction, redo: D.redoAction };
            window.PWAInstaller = { instalarApp: PWAInstaller.instalarApp };
            window.PerfilManager = PerfilManager;

            let _gistModalPadre = null;
            let _gistAutoSyncTemp = null;
            let _gistLimitesTemp = null;
            let _gistLimitesOrig = null;
            let _gistMergeDesdeModal = false;

            function actualizarEstadoBotonesGist() {
                const token = document.getElementById('gist-token')?.value.trim() || '';
                const gistId = document.getElementById('gist-id')?.value.trim() || '';
                const soloToken = token !== '';
                const ambosCompletos = soloToken && gistId.length > 10;

                _setBtnDisabled('btn-gist-subir', !soloToken);
                _setBtnDisabled('btn-gist-bajar', !ambosCompletos);
                _setBtnDisabled('btn-toggle-gist-backup', !ambosCompletos);

                const estadoBackup = parseInt(_gistAutoSyncTemp ?? GistSync.getAutoSync());
                _setBtnDisabled('btn-toggle-gist-merge', !(ambosCompletos && estadoBackup === 1));
            }

            function abrirModalGist() {
                const modalAbierto = document.querySelector('.modal.show');
                _gistModalPadre = modalAbierto ? modalAbierto.id : null;

                const tokenInput = document.getElementById('gist-token');
                const gistIdInput = document.getElementById('gist-id');
                const lastSyncEl = document.getElementById('gist-ultima-sync');

                if (tokenInput) tokenInput.value = GistSync.getToken();
                if (gistIdInput) gistIdInput.value = GistSync.getGistId();
                if (lastSyncEl) {
                    const last = GistSync.getLastSync();
                    lastSyncEl.textContent = last ? `Sincronizado: ${last}` : 'No sincronizado';
                }

                const rango = GistSync.getRangoHorario();
                const desdeEl = document.getElementById('gist-rango-desde');
                const hastaEl = document.getElementById('gist-rango-hasta');
                if (desdeEl) desdeEl.value = rango.desde;
                if (hastaEl) hastaEl.value = rango.hasta;

                _gistAutoSyncTemp = GistSync.getAutoSync();
                actualizarBotonGistBackup();
                actualizarBotonGistMerge();
                actualizarEstadoBotonesGist();
                ModalManager.cerrarTodos();
                ModalManager.abrir('modal-gist');
                _gistLimitesTemp = null;
                _actualizarCampoLimite();
                _gistLimitesOrig = { bajar: GistSync.getSyncLimite('bajar'), subir: GistSync.getSyncLimite('subir') };
            }

            function _gistGuardarCredencialesSiModalAbierto() {
                if (document.getElementById('modal-gist')?.classList.contains('show')) {
                    GistSync.saveCredentials(
                        document.getElementById('gist-token')?.value.trim() || '',
                        document.getElementById('gist-id')?.value.trim() || ''
                    );
                }
            }

            function _setBtnDisabled(id, disabled) {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.disabled = disabled;
            }

            function actualizarBotonesHistorico() {
                const btnRespaldar = document.getElementById('btn-hist-respaldar');
                const btnRestaurar = document.getElementById('btn-hist-restaurar');
                if (!btnRespaldar || !btnRestaurar) return;

                const tieneGist = GistSync.esGistIdValido(GistSync.getGistId());

                const newRespaldar = btnRespaldar.cloneNode(true);
                const newRestaurar = btnRestaurar.cloneNode(true);
                btnRespaldar.parentNode.replaceChild(newRespaldar, btnRespaldar);
                btnRestaurar.parentNode.replaceChild(newRestaurar, btnRestaurar);

                if (tieneGist) {
                    newRespaldar.title = 'Subir a Gist';
                    newRespaldar.addEventListener('click', () => gistSubir());
                    newRespaldar.querySelector('use').setAttribute('href', '#icon-cloud-upload');

                    newRestaurar.title = 'Bajar de Gist';
                    newRestaurar.addEventListener('click', () => gistBajar());
                    newRestaurar.querySelector('use').setAttribute('href', '#icon-cloud-download');
                } else {
                    newRespaldar.title = 'Respaldar';
                    newRespaldar.addEventListener('click', () => mostrarExportar(true));
                    newRespaldar.querySelector('use').setAttribute('href', '#icon-download');

                    newRestaurar.title = 'Restaurar';
                    newRestaurar.addEventListener('click', () => mostrarImportar(true));
                    newRestaurar.querySelector('use').setAttribute('href', '#icon-upload');
                }
            }

            function guardarConfigGist() {
                const token = document.getElementById('gist-token')?.value.trim() || '';
                const gistId = document.getElementById('gist-id')?.value.trim() || '';
                const desdeRaw = document.getElementById('gist-rango-desde')?.value || '';
                const hastaRaw = document.getElementById('gist-rango-hasta')?.value || '';

                if (desdeRaw && !S.validarHoraSegura(desdeRaw)) {
                    mostrarToast('Hora inicial inválida.', 'error');
                    return;
                }
                if (hastaRaw && !S.validarHoraSegura(hastaRaw)) {
                    mostrarToast('Hora final inválida.', 'error');
                    return;
                }

                const desde = desdeRaw || '21:00';
                const hasta = hastaRaw || '00:00';

                const rango = GistSync.getRangoHorario();
                const limitesCambiaron = _gistLimitesOrig !== null && (
                    _gistLimitesOrig.bajar !== GistSync.getSyncLimite('bajar') ||
                    _gistLimitesOrig.subir !== GistSync.getSyncLimite('subir')
                );
                const huboCambios = token !== GistSync.getToken()
                    || gistId !== GistSync.getGistId()
                    || desde !== rango.desde
                    || hasta !== rango.hasta
                    || limitesCambiaron
                    || (_gistAutoSyncTemp !== null && _gistAutoSyncTemp !== GistSync.getAutoSync())
                    || (_gistLimitesTemp !== null);

                if (_gistAutoSyncTemp !== null) GistSync.setAutoSync(_gistAutoSyncTemp);
                if (_gistLimitesTemp !== null) {
                    GistSync.setSyncLimite('bajar', _gistLimitesTemp.bajar);
                    GistSync.setSyncLimite('subir', _gistLimitesTemp.subir);
                }
                GistSync.saveCredentials(token, gistId);
                GistSync.setRangoHorario(desde, hasta);
                mostrarToast(huboCambios ? 'Configuración guardada' : 'Sin cambios', huboCambios ? 'success' : 'info');
                _gistAutoSyncTemp = null;
                _gistLimitesTemp = null;
                _gistModalPadre = null;
                _gistLimitesOrig = null;
                ModalManager.cerrar('modal-gist');
                actualizarBotonesHistorico();
            }

            function cerrarModalGist() {
                _gistAutoSyncTemp = null;
                _gistLimitesTemp = null;
                _gistLimitesOrig = null;
                ModalManager.cerrar('modal-gist');
                if (_gistModalPadre) ModalManager.abrir(_gistModalPadre);
                _gistModalPadre = null;
                actualizarBotonesHistorico();
            }

            function _calcularRegistrosMerge(modo, mergeData) {
                const { registrosNormalizados, soloEnGist, complementarios = [], data } = mergeData;

                if (modo === 'merge') {
                    if (soloEnGist.length === 0 && complementarios.length === 0) {
                        return { vacio: true };
                    }
                    if (D.registros().length + soloEnGist.length > S.SECURITY_LIMITS.MAX_REGISTROS) {
                        return { limiteAlcanzado: true };
                    }

                    const registrosActualizados = D.registros().map(local => {
                        const imp = complementarios.find(c => c.fecha === local.fecha);
                        if (!imp) return local;
                        const actualizado = { ...local };
                        if (!actualizado.salida && imp.salida) actualizado.salida = imp.salida;
                        if (!actualizado.tiempoFuera && imp.tiempoFuera) actualizado.tiempoFuera = imp.tiempoFuera;
                        const t = D.calcularHoras(actualizado.entrada, actualizado.salida, actualizado.tiempoFuera || null, actualizado.credito || null);
                        if (t) { actualizado.horas = t.horas; actualizado.minutos = t.minutos; actualizado.total = t.total; }
                        return actualizado;
                    });

                    const partes = [];
                    if (soloEnGist.length > 0) partes.push(`${soloEnGist.length} día${soloEnGist.length !== 1 ? 's' : ''} nuevo${soloEnGist.length !== 1 ? 's' : ''}`);
                    if (complementarios.length > 0) partes.push(`${complementarios.length} registro${complementarios.length !== 1 ? 's' : ''} completado${complementarios.length !== 1 ? 's' : ''}`);

                    return {
                        registrosFinales: [...registrosActualizados, ...soloEnGist],
                        mensajeExito: `Combinado: ${partes.join(', ')}`
                    };

                } else {
                    if (Array.isArray(data.diasHabiles)) {
                        const diasValidos = data.diasHabiles.filter(d => Number.isInteger(d) && d >= 0 && d <= 6);
                        if (diasValidos.length > 0) D.setDiasHabiles(diasValidos);
                    }
                    if (data.horasDiarias != null) {
                        const hd = parseFloat(data.horasDiarias);
                        if (Number.isFinite(hd) && hd >= 0 && hd <= 24) D.setHorasDiarias(hd);
                    }
                    return {
                        registrosFinales: registrosNormalizados,
                        mensajeExito: `${registrosNormalizados.length} registros restaurados desde Gist`
                    };
                }
            }

            async function gistMergeAplicar(modo, modoAutomatico = false) {
                if (!_gistMergeData) return;
                const mergeData = _gistMergeData;
                _gistMergeData = null;

                const resultado = _calcularRegistrosMerge(modo, mergeData);

                if (resultado.vacio) {
                    ModalManager.cerrar('modal-gist-merge');
                    mostrarToast('Sin datos nuevos para completar', 'info');
                    return;
                }
                if (resultado.limiteAlcanzado) {
                    mostrarToast('Límite alcanzado', 'error');
                    return;
                }

                const { registrosFinales, mensajeExito } = resultado;

                D.registros().splice(0, D.registros().length, ...registrosFinales);
                D.registros().sort((a, b) => {
                    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
                    return (b.entrada || '').localeCompare(a.entrada || '');
                });
                HistoryManager.saveState(D.registros());

                await D.guardarYActualizar();
                actualizarUI();

                if (!modoAutomatico) ModalManager.cerrar('modal-gist-merge');
                const lastSyncEl = document.getElementById('gist-ultima-sync');
                if (lastSyncEl) lastSyncEl.textContent = `Última sync: ${GistSync.getLastSync()}`;
                mostrarToast(mensajeExito, 'success');

                const btn = document.getElementById('btn-gist-bajar');
                if (btn) btn.disabled = false;
            }

            function gistMergeCancelar() {
                _gistMergeData = null;
                ModalManager.cerrar('modal-gist-merge');
                const btn = document.getElementById('btn-gist-bajar');
                if (btn) btn.disabled = false;
                if (_gistMergeDesdeModal) {
                    _gistMergeDesdeModal = false;
                    ModalManager.abrir('modal-gist');
                }
            }

            function toggleGistMerge() {
                const actual = GistSync.getMergeBehavior();
                GistSync.setMergeBehavior(actual === 'merge' ? 'replace' : 'merge');
                actualizarBotonGistMerge();
            }

            function actualizarBotonGistMerge() {
                const hint = document.getElementById('hint-gist-merge');
                const iconEl = document.getElementById('icon-gist-merge')?.querySelector('use');
                const esMerge = GistSync.getMergeBehavior() === 'merge';
                if (hint) hint.textContent = esMerge ? 'Combinar' : 'Reemplazar';
                if (iconEl) iconEl.setAttribute('href', esMerge ? '#icon-combine' : '#icon-replace-swap');
            }

            function toggleGistBackup() {
                const actual = parseInt(_gistAutoSyncTemp ?? GistSync.getAutoSync());
                _gistAutoSyncTemp = (actual + 1) % 3;
                actualizarBotonGistBackup();
                actualizarEstadoBotonesGist();
                _actualizarCampoLimite();
            }

            function actualizarBotonGistBackup() {
                const btn = document.getElementById('btn-toggle-gist-backup');
                const hint = document.getElementById('hint-gist-backup');
                const label = document.getElementById('label-gist-backup');
                const rangoEl = document.getElementById('gist-rango-horario');
                const estado = _gistAutoSyncTemp ?? GistSync.getAutoSync();
                if (!btn) return;

                const configs = [
                    { texto: 'Sin automatizar', hint: '', activo: false },
                    { texto: 'Restaurar', hint: '', activo: true },
                    { texto: 'Respaldar', hint: '', activo: true }
                ];
                const c = configs[estado];
                _setBtnActivo(btn.id, c.activo);
                if (label) label.textContent = c.texto;
                if (hint) { hint.textContent = c.hint; hint.style.color = c.color; }

                if (rangoEl) {
                    const mostrar = estado === 1 || estado === 2;
                    rangoEl.style.maxHeight = mostrar ? '60px' : '0';
                    rangoEl.style.opacity = mostrar ? '1' : '0';
                }
            }

            function toggleVerToken() {
                const input = document.getElementById('gist-token');
                if (!input) return;
                input.type = input.type === 'password' ? 'text' : 'password';
            }

            function abrirGistEnBrowser() {
                const gistId = document.getElementById('gist-id')?.value.trim() || GistSync.getGistId();
                if (gistId) {
                    window.open(`https://gist.github.com/${gistId}`, '_blank');
                } else {
                    window.open('https://gist.github.com', '_blank');
                }
            }

            function _tipoSyncActual() {
                const estado = parseInt(_gistAutoSyncTemp ?? GistSync.getAutoSync());
                return estado === 1 ? 'bajar' : estado === 2 ? 'subir' : null;
            }

            function _actualizarCampoLimite() {
                const tipo = _tipoSyncActual();
                const contenedor = document.getElementById('gist-limite-sync');
                if (!contenedor) return;
                if (!tipo) {
                    contenedor.style.maxHeight = '0';
                    contenedor.style.opacity = '0';
                    return;
                }
                const limite = _gistLimitesTemp ? _gistLimitesTemp[tipo] : GistSync.getSyncLimite(tipo);
                const input = document.getElementById('gist-limite-valor');
                const label = document.getElementById('gist-limite-label');
                if (input) input.value = limite;
                if (label) label.textContent = tipo === 'bajar' ? 'Límite bajadas por hora (0 = sin límite)' : 'Límite subidas por hora (0 = sin límite)';
                contenedor.style.maxHeight = '80px';
                contenedor.style.opacity = '1';
            }

            function cambiarLimiteSync(delta) {
                const tipo = _tipoSyncActual();
                if (!tipo) return;
                if (!_gistLimitesTemp) _gistLimitesTemp = { bajar: GistSync.getSyncLimite('bajar'), subir: GistSync.getSyncLimite('subir') };
                _gistLimitesTemp[tipo] = Math.max(0, Math.min(99, _gistLimitesTemp[tipo] + delta));
                _actualizarCampoLimite();
            }

            let _timeoutLimite = null;
            let _intervaloLimite = null;

            function iniciarCambioLimite(delta) {
                cambiarLimiteSync(delta);
                _timeoutLimite = setTimeout(() => {
                    _intervaloLimite = setInterval(() => cambiarLimiteSync(delta), 100);
                }, 500);
            }

            function detenerCambioLimite() {
                if (_timeoutLimite) { clearTimeout(_timeoutLimite); _timeoutLimite = null; }
                if (_intervaloLimite) { clearInterval(_intervaloLimite); _intervaloLimite = null; }
            }


            async function gistSubir() {
                _gistGuardarCredencialesSiModalAbierto();
                const btn = document.getElementById('btn-gist-subir');
                if (btn) btn.disabled = true;
                mostrarToast('Subiendo...', 'info');


                try {
                    const nuevoId = await GistSync.subir(
                        D.registros(),
                        D.diasHabiles(),
                        D.horasDiarias()
                    );
                    const gistIdInput = document.getElementById('gist-id');
                    if (gistIdInput) gistIdInput.value = nuevoId;
                    const lastSyncEl = document.getElementById('gist-ultima-sync');
                    if (lastSyncEl) lastSyncEl.textContent = `Última sync: ${GistSync.getLastSync()}`;
                    mostrarToast('Datos respaldados en Gist', 'success');
                } catch (e) {
                    console.error('Gist subir error:', e);
                    mostrarToast('Error al subir', 'error');
                } finally {
                    if (btn) btn.disabled = false;
                }
            }

            let _gistMergeData = null;

            async function gistBajar(modoAutomatico = false) {
                _gistGuardarCredencialesSiModalAbierto();
                _gistMergeDesdeModal = document.getElementById('modal-gist')?.classList.contains('show') ?? false;
                const btn = document.getElementById('btn-gist-bajar');
                if (btn) btn.disabled = true;
                mostrarToast('Bajando...', 'info');

                try {
                    const data = await GistSync.bajar();

                    if (!data.registros || !Array.isArray(data.registros)) {
                        throw new Error('Datos inválidos en el Gist');
                    }

                    const allowedRootKeys = ['registros', 'diasHabiles', 'horasDiarias', 'fecha', 'version', 'hash', 'timestamp', '_hashNoCoincide'];
                    const hasInvalidKeys = Object.keys(data).some(k => !allowedRootKeys.includes(k));
                    if (hasInvalidKeys) throw new Error('Estructura del Gist sospechosa');

                    if (data._hashNoCoincide) {
                        const continuar = await confirmarModal('El hash de integridad no coincide. El Gist puede haber sido modificado o corrompido. ¿Restaurar de todas formas?', 'Restaurar', '#icon-upload');
                        if (!continuar) {
                            if (btn) btn.disabled = false;
                            return;
                        }
                    }

                    if (data.version && data.version > S.SECURITY_LIMITS.SCHEMA_VERSION) {
                        mostrarToast(`Gist de versión más nueva (v${data.version}). Algunos datos pueden no importarse correctamente.`, 'warning');
                    }

                    const registrosNormalizados = D.normalizarRegistrosImportados(data.registros, D.calcularHoras);

                    if (registrosNormalizados.length === 0) throw new Error('No se encontraron registros válidos');
                    if (registrosNormalizados.length > S.SECURITY_LIMITS.MAX_REGISTROS) throw new Error(`Máximo ${S.SECURITY_LIMITS.MAX_REGISTROS} registros permitidos`);

                    const fechasLocales = new Set(D.registros().map(r => r.fecha));
                    const soloEnGist = registrosNormalizados.filter(r => !fechasLocales.has(r.fecha));
                    const enAmbos = registrosNormalizados.filter(r => fechasLocales.has(r.fecha));
                    const soloLocal = D.registros().filter(r => !registrosNormalizados.some(g => g.fecha === r.fecha));
                    const complementarios = enAmbos.filter(imp => {
                        const local = D.registros().find(r => r.fecha === imp.fecha);
                        if (!local) return false;
                        return (!local.salida && imp.salida) || (!local.tiempoFuera && imp.tiempoFuera);
                    });

                    _gistMergeData = { registrosNormalizados, soloEnGist, complementarios, data };

                    if (modoAutomatico) {
                        await gistMergeAplicar(GistSync.getMergeBehavior(), true);
                    } else {
                        const configCambios = [];
                        if (Array.isArray(data.diasHabiles)) {
                            const diasGist = [...data.diasHabiles].sort().join(',');
                            const diasLocal = [...D.diasHabiles()].sort().join(',');
                            if (diasGist !== diasLocal) configCambios.push('días laborales');
                        }
                        if (data.horasDiarias != null && parseFloat(data.horasDiarias) !== D.horasDiarias()) {
                            configCambios.push(`horas diarias (${D.horasDiarias()}h → ${parseFloat(data.horasDiarias)}h)`);
                        }

                        const resumenEl = document.getElementById('gist-merge-resumen');
                        if (resumenEl) {
                            resumenEl.innerHTML =
                                `<div>` +
                                `<div><svg class="icon"><use href="#icon-cloud"/></svg> En Gist <strong class="text-green">${soloEnGist.length}</strong> registro${soloEnGist.length !== 1 ? 's' : ''} nuevos</div>` +
                                `<div><svg class="icon"><use href="#icon-combine"/></svg> En ambos <strong>${enAmbos.length}</strong> registro${enAmbos.length !== 1 ? 's' : ''} (por fecha${complementarios.length > 0 ? `, <strong class="text-blue">${complementarios.length}</strong> para completar` : ''})</div>` +
                                `<div><svg class="icon"><use href="#icon-save"/></svg> Local <strong>${soloLocal.length}</strong> registro${soloLocal.length !== 1 ? 's' : ''} no subidos</div>` +
                                `</div>` +
                                `<div id="_gist-config-cambios"></div>` +
                                `<div class="gist-resumen-footer">` +
                                `<strong>Combinar</strong>: agrega ${soloEnGist.length} nuevo(s)${complementarios.length > 0 ? `, completa ${complementarios.length} registro(s)` : ''}, mantiene los locales<br>` +
                                `<strong>Reemplazar</strong>: usa los ${registrosNormalizados.length} registros del Gist` +
                                `</div>`;
                            const configEl = resumenEl.querySelector('#_gist-config-cambios');
                            if (configEl) {
                                configEl.textContent = configCambios.length > 0
                                    ? `⚙ Reemplazar cambiará: ${configCambios.join(', ')}`
                                    : `⚙ Sin cambios de configuración`;
                            }
                        }
                        ModalManager.cerrar('modal-gist');
                        ModalManager.abrir('modal-gist-merge');
                    }
                } catch (e) {
                    console.error('Gist bajar error:', e);
                    mostrarToast('Error al bajar', 'error');
                } finally {
                    if (btn) btn.disabled = false;
                }
            }

            window.ModalManager = ModalManager;
            window.NotificacionesManager = NotificacionesManager;

            window.UILogic = {
                alternarTema, cerrarConfig, pegarHoraActual, alternarVista, poblarSelectoresTipos,
                cerrarEdicion, mostrarImportar, cerrarImportar, actualizarUI, mostrarToast,
                mostrarError, limpiarError, resetearBoton, restaurarBotonGuardarEdicion, abrirSelectorMesesCalendario,
                limpiarCampo, obtenerFechaHoy, mostrarFiltros, poblarSelectorMeses, actualizarBotonLote,
                cerrarFiltros, registrarLoteDesdeCard, cambiarMesStats, generarReporte, toggleHistorico, toggleStats,
                sumarMinutosAHora, toggleTimerBreakMain, actualizarEstadoBotonTimerMain, toggleBloqueoEdicion, setBloqueoEdicion,
                actualizarFeedbackConfig, abrirSelectorPerfiles, cerrarSelectorPerfiles, abrirEditorPerfil, cerrarEditorPerfil, guardarEdicionPerfil,
                eliminarPerfilDesdeEditor, crearPerfilDesdeSelector, renderizarListaPerfiles, ejecutarAccionRegistro,
                iniciarCambioHoras, detenerCambio, mostrarconfig, alternarFechaActual, verificarBloqueoCredito,
                toggleCredito, init, toggleFormulario, setBloqueoEdicionGrupo, toggleBloqueoEdicionGrupo, cerrarEdicionGrupo,
                mostrarExportar, cerrarExportar, ejecutarExportacion, toggleCamposRangoExport, aplicarFeedbackCampos,
                iniciarTimerAutoCierreBotones, cancelarTimerAutoCierreBotones, toggleIgnorarTiempoFuera, actualizarEstadoBotonIgnorarTF,
                togglePeriodoStats, cambiarAnioStats, cambiarSemanaStats, toggleFondoCard, setFondoCard, navegarCalendario, toggleGistMerge,
                actualizarEstadoBotonesGist, togglePersistirTarjetas, actualizarEstadoBotonPersistir, toggleVistaHistorico,
                abrirModalGist, cerrarModalGist, guardarConfigGist, toggleVerToken, abrirGistEnBrowser, gistSubir, gistBajar,
                gistMergeAplicar, gistMergeCancelar, actualizarBotonesHistorico, toggleGistBackup, toggleModoLote, toggleVisibilidadCard, aplicarVisibilidadCards,
                _popupCalendario, _popupCalendarioHover, _cerrarPopupCalendarioHover, toggleHoverPopupCalendario, actualizarEstadoBotonHoverPopup,
                cambiarLimiteSync, obtenerOrdenCards, aplicarOrdenCards, iniciarDragOrdenCards, _onclickCalendarioDia,
                actualizarHintGrupo, irHoyCalendario, detenerCambioLimite, iniciarCambioLimite,
                obtenerNombrePerfilSafe, descargarJSON,
            };

            ['entrada', 'salida'].forEach(id => {
                const el = $(id);
                if (el) el.addEventListener('input', formatearInput);
            });

            const verificarBloqueCreditoDebounced = debounce(verificarBloqueoCredito, 200);

            ['edit-entrada', 'edit-salida'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', (e) => {
                        formatearInput(e);
                        verificarBloqueCreditoDebounced();
                    });

                    el.addEventListener('change', verificarBloqueoCredito);
                }
            });

            const tf = document.getElementById('edit-tiempo-fuera');
            if (tf) tf.addEventListener('input', (e) => {
                formatearInput(e);
                verificarBloqueCreditoDebounced();
            });

            const notasEl = document.getElementById('edit-notas');
            if (notasEl) notasEl.addEventListener('input', () => {
                const v = notasEl.value;
                const filtrado = S.sanitizeNotas(v);
                if (filtrado !== v) {
                    const pos = notasEl.selectionStart - (v.length - filtrado.length);
                    notasEl.value = filtrado;
                    notasEl.setSelectionRange(pos, pos);
                }
            });

            ['gist-rango-desde', 'gist-rango-hasta'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', formatearInput);
            });

            function actualizarHintEdicion() {
                const hint = document.getElementById('edit-hint-resumen');
                if (!hint) return;
                const e = document.getElementById('edit-entrada')?.value.trim();
                const s = document.getElementById('edit-salida')?.value.trim();
                const tf = document.getElementById('edit-tiempo-fuera')?.value.trim();

                if (!e && !s) { hint.textContent = ''; return; }

                const tipoEspecial = TiposRegistro.obtenerTipoPorCodigo(e, s);
                if (tipoEspecial) {
                    hint.textContent = tipoEspecial.label;
                    return;
                }

                if (e?.length === 5 && s?.length === 5) {
                    const t = D.calcularHoras(e, s, tf || null, null, false);
                    if (t) {
                        hint.textContent = `Total: ${t.horas}h ${t.minutos}m`;
                    } else {
                        hint.textContent = '';
                    }
                } else {
                    hint.textContent = '';
                }
            }

            ['edit-entrada', 'edit-salida', 'edit-tiempo-fuera'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', actualizarHintEdicion);
            });

            // ===================================
            // LISTENERS PARA TECLA ENTER MODULE
            // ===================================
            const inputEntrada = document.getElementById('entrada');
            if (inputEntrada) {
                inputEntrada.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const inputSalida = document.getElementById('salida');
                        if (inputSalida) inputSalida.focus();
                    }
                });
            }

            const inputSalida = document.getElementById('salida');
            if (inputSalida) {
                inputSalida.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        inputSalida.blur();

                        const btnAgregar = document.getElementById('btn-agregar');
                        if (btnAgregar && !btnAgregar.disabled) {
                            btnAgregar.click();
                        }
                    }
                });
            }

            const editEntrada = document.getElementById('edit-entrada');
            if (editEntrada) {
                editEntrada.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const editSalida = document.getElementById('edit-salida');
                        if (editSalida) editSalida.focus();
                    }
                });
            }

            const editSalida = document.getElementById('edit-salida');
            if (editSalida) {
                editSalida.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const editTiempoFuera = document.getElementById('edit-tiempo-fuera');
                        if (editTiempoFuera) editTiempoFuera.focus();
                    }
                });
            }

            const editTiempoFuera = document.getElementById('edit-tiempo-fuera');
            if (editTiempoFuera) {
                editTiempoFuera.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        editTiempoFuera.blur();

                        const btnGuardar = document.querySelector('#modal-editar .btn-edit');
                        if (btnGuardar && !btnGuardar.disabled) {
                            btnGuardar.click();
                        }
                    }
                });
            }

            const inputNuevoPerfil = document.getElementById('nombre-nuevo-perfil-selector');
            if (inputNuevoPerfil) {
                inputNuevoPerfil.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        inputNuevoPerfil.blur();

                        UILogic.crearPerfilDesdeSelector();
                    }
                });
            }

            const inputEditarPerfil = document.getElementById('nombre-perfil-editar');
            if (inputEditarPerfil) {
                inputEditarPerfil.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        inputEditarPerfil.blur();

                        const btnGuardarPerfil = document.querySelector('#modal-editar-perfil .btn-edit');
                        if (btnGuardarPerfil && !btnGuardarPerfil.disabled) {
                            btnGuardarPerfil.click();
                        }
                    }
                });
            }

            registrarSwipe(document.getElementById('stats-card'), () => alternarVista());

            registrarSwipe(document.getElementById('form-registro'), () => toggleModoLote(), { ignoreInputs: true });

            const anchor = document.getElementById('stat-items-tipos-anchor');
            if (anchor) {
                TiposRegistro.obtenerTodosLosTipos().forEach(t => {
                    const item = document.createElement('div');
                    item.className = 'stat-item';
                    const label = document.createElement('div');
                    label.className = 'stat-label';
                    label.textContent = t.labelPlural;
                    const value = document.createElement('div');
                    value.className = 'stat-value';
                    value.id = `stat-${t.labelPlural.toLowerCase()}`;
                    value.textContent = '0';
                    item.appendChild(label);
                    item.appendChild(value);
                    anchor.parentNode.insertBefore(item, anchor);
                });
            }

            const config = D.cargarConfiguracion();
            const temaOscuro = config.temaOscuro;
            D.setVistaActual(config.vistaActual);
            D.setIgnorarTiempoFuera(config.ignorarTiempoFuera || false);
            UILogic.actualizarEstadoBotonIgnorarTF();
            UILogic.poblarSelectoresTipos();
            UILogic.actualizarEstadoBotonHoverPopup();
            UILogic.aplicarVisibilidadCards();
            UILogic.aplicarOrdenCards(UILogic.obtenerOrdenCards());
            UILogic.iniciarDragOrdenCards();
            UILogic.setFondoCard(config.fondoCard || 'golden-gate');
            if (config.modoEstadisticas === 'anual') UILogic.togglePeriodoStats();
            else if (config.modoEstadisticas === 'semanal') { UILogic.togglePeriodoStats(); UILogic.togglePeriodoStats(); }

            const perfilActual = PerfilManager.obtenerDatosPerfil();
            const diasArraySeguro = Array.isArray(perfilActual.diasHabiles) ? perfilActual.diasHabiles : [1, 2, 3, 4, 5];
            D.setDiasHabiles(diasArraySeguro);
            D.setHorasDiarias(perfilActual.horasDiarias !== undefined ? perfilActual.horasDiarias : 7);

            const registrosCargados = perfilActual.registros || [];
            D.registros().splice(0, D.registros().length, ...registrosCargados);

            const historialCargado = HistoryManager.loadFromLocalStorage();

            if (historialCargado) {
                const estadoActual = HistoryManager.getCurrentState();
                if (estadoActual && estadoActual.length > 0) {
                    D.registros().splice(0, D.registros().length, ...estadoActual);
                    console.log('✓ Registros restaurados desde historial');
                }
            }
            D.recalcularTotalesEnMemoria();
            if (!historialCargado) {
                HistoryManager.saveState(D.registros());
                console.log('✓ Nuevo historial inicializado');
            }

            HistoryManager.updateButtons();

            if (temaOscuro) {
                document.body.classList.add('dark-mode');
            }
            const toggleBtnEl = $('theme-toggle');
            if (toggleBtnEl) {
                const tBtn = toggleBtnEl.querySelector('use');
                if (tBtn) tBtn.setAttribute('href', temaOscuro ? '#icon-sun' : '#icon-moon');
            }
            const toggleBtnModal = $('theme-toggle-modal');
            if (toggleBtnModal) {
                const tBtnM = toggleBtnModal.querySelector('use');
                if (tBtnM) tBtnM.setAttribute('href', temaOscuro ? '#icon-sun' : '#icon-moon');
            }

            $('fecha').value = obtenerFechaHoy();

            try {
                const persistir = localStorage.getItem('persistirTarjetas') !== 'false';
                if (persistir && localStorage.getItem('formularioExpandido') === 'true') toggleFormulario();
                if (persistir && localStorage.getItem('statsExpandido') === 'true') toggleStats();

                const estadoHistoricoGuardado = persistir ? localStorage.getItem('historicoExpandido') : null;
                const estadoHistorico = estadoHistoricoGuardado === 'completo' ? 'meses' : estadoHistoricoGuardado;
                if (estadoHistorico === 'meses' || estadoHistorico === 'completo') {
                    const contenido = $('contenido-historico');
                    const icon = $('icon-indicator-historico');
                    if (contenido) contenido.classList.add('expanded');

                    if (estadoHistorico === 'meses') {
                        if (icon) {
                            icon.style.transform = '';
                            icon.classList.add('rotated');
                        }
                    } else if (estadoHistorico === 'completo') {
                        const botones = $('botones-historico');
                        if (botones) {
                            botones.classList.add('expanded');
                            tiempoExpansionBotones = Date.now();
                        }
                        if (icon) {
                            icon.classList.remove('rotated');
                            icon.style.transform = 'rotate(-90deg)';
                        }
                    }
                } else {
                    const botones = $('botones-historico');
                    const icon = $('icon-indicator-historico');
                    if (botones) botones.classList.remove('expanded');
                    if (icon) {
                        icon.classList.remove('rotated');
                        icon.style.transform = '';
                    }
                }

                const vistaGuardada = localStorage.getItem('vistaHistoricoCalendario');
                const usarCalendario = vistaGuardada === null ? true : vistaGuardada === 'true';
                if (usarCalendario) {
                    const contenidoAbierto = $('contenido-historico')?.classList.contains('expanded');
                    if (contenidoAbierto) {
                        _vistaHistoricoCalendario = false;
                        toggleVistaHistorico();
                    } else {
                        _vistaHistoricoCalendario = true;
                    }
                }
            } catch (e) {
                console.warn('Error restaurando estado visual:', e);
            }

            PWAInstaller.init();

            actualizarUI();
            _iniciarCicloStats();
            actualizarBotonesHistorico();

            if (D.vistaActual() === 'semana') {
                setTimeout(() => {
                    alternarVista();
                    setTimeout(() => { _iniciarCicloStats(); }, 350);
                }, 2500);
            }

            const _autoSyncEstado = GistSync.getAutoSync();
            const _tieneCredenciales = GistSync.getToken() && GistSync.esGistIdValido(GistSync.getGistId());
            if (_tieneCredenciales) {
                if (_autoSyncEstado === 1) {
                    if (GistSync.dentroDelRangoHorario() && !GistSync.superaLimite('bajar')) {
                        setTimeout(async () => {
                            await gistBajar(true);
                            GistSync.marcarSync('bajar');
                        }, 2000);
                    }
                } else if (_autoSyncEstado === 2) {
                    if (GistSync.dentroDelRangoHorario() && !GistSync.superaLimite('subir')) {
                        setTimeout(async () => {
                            await gistSubir();
                            GistSync.marcarSync('subir');
                        }, 2000);
                    }
                }
            }

            setInterval(() => actualizarUI(null, true), 20000);
            console.log('Sistema iniciado correctamente');

            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                const modal = document.querySelector('.modal.show');
                if (!modal) return;
                e.preventDefault();
                const acciones = {
                    'modal-gist': () => cerrarModalGist(),
                    'modal-gist-merge': () => gistMergeCancelar(),
                    'modal-config': () => UILogic.cerrarConfig(),
                    'modal-selector-perfiles': () => UILogic.cerrarSelectorPerfiles(),
                    'modal-editar': () => UILogic.cerrarEdicion(),
                    'modal-importar': () => UILogic.cerrarImportar(),
                    'modal-exportar': () => UILogic.cerrarExportar(),
                    'modal-filtros': () => UILogic.cerrarFiltros(),
                    'modal-editar-perfil': () => UILogic.cerrarEditorPerfil(),
                    'modal-editar-grupo': () => UILogic.cerrarEdicionGrupo(),
                    'modal-confirmar': () => document.getElementById('modal-confirmar-cancel')?.click(),
                };
                const accion = acciones[modal.id];
                if (accion) accion();
            });

            const lista = document.getElementById('lista-registros');
            if (lista) {
                lista.addEventListener('click', (e) => {
                    const target = e.target.closest('[data-accion]');
                    if (!target) return;

                    const accion = target.dataset.accion;

                    if (accion === 'editar-registro') {
                        const id = target.dataset.registroId;
                        if (id) D.editarRegistro(id);
                    }
                    else if (accion === 'editar-grupo') {
                        try {
                            const grupoData = JSON.parse(target.dataset.grupoData);
                            const registrosCompletos = D.registros().filter(r =>
                                grupoData.registros.includes(r.id)
                            );

                            D.editarGrupo({
                                registros: registrosCompletos,
                                subtipo: grupoData.subtipo
                            });
                        } catch (err) {
                            console.error('Error al abrir grupo:', err);
                        }
                    }
                });
            }

            lista.addEventListener('click', (e) => {
                const headerAnio = e.target.closest('.registro-mes-header[data-accion="toggle-anio"]');
                if (!headerAnio) return;

                e.stopPropagation();

                const contenedorAnio = headerAnio.closest('.registro-mes-container');
                if (!contenedorAnio) return;

                const detalleAnio = contenedorAnio.querySelector(':scope > .registro-mes-detalle');
                const chevronAnio = headerAnio.querySelector('.chevron-mes');
                const anioId = headerAnio.dataset.anioId;
                const estaExpandido = detalleAnio.classList.contains('expanded');

                if (estaExpandido) {
                    detalleAnio.classList.remove('expanded');
                    if (chevronAnio) chevronAnio.style.transform = 'rotate(0deg)';
                    try { localStorage.setItem(`anio-${anioId}-expandido`, 'false'); } catch (e) { }
                } else {
                    detalleAnio.classList.add('expanded');
                    if (chevronAnio) chevronAnio.style.transform = 'rotate(180deg)';
                    try { localStorage.setItem(`anio-${anioId}-expandido`, 'true'); } catch (e) { }
                }
            });

            lista.addEventListener('click', (e) => {
                const header = e.target.closest('.registro-mes-header');
                if (!header || header.dataset.accion !== 'toggle-mes') return;

                e.stopPropagation();

                const contenedor = header.closest('.registro-mes-container');
                if (!contenedor) return;

                const detalle = contenedor.querySelector('.registro-mes-detalle');
                const chevronIcon = header.querySelector('.chevron-mes');

                const estaExpandido = detalle.classList.contains('expanded');

                if (estaExpandido) {
                    detalle.classList.remove('expanded');
                    chevronIcon.style.transform = 'rotate(0deg)';

                    try {
                        localStorage.setItem(`mes-${header.dataset.mesId}-expandido`, 'false');
                    } catch (e) { }

                } else {
                    const otrosMesesAbiertos = lista.querySelectorAll('.registro-mes-detalle.expanded');
                    const esContenedorAnio = (el) => {
                        const h = el.closest('.registro-mes-container')?.querySelector('.registro-mes-header');
                        return h && h.dataset.accion === 'toggle-anio';
                    };
                    const detalleAnioPadre = contenedor.parentElement?.closest('.registro-mes-detalle') || null;

                    otrosMesesAbiertos.forEach(otroDetalle => {
                        if (esContenedorAnio(otroDetalle) && otroDetalle !== detalleAnioPadre) {
                            otroDetalle.classList.remove('expanded');
                            const otroContenedor = otroDetalle.closest('.registro-mes-container');
                            const otroChevron = otroContenedor?.querySelector('.chevron-mes');
                            const otroHeader = otroContenedor?.querySelector('.registro-mes-header');
                            if (otroChevron) otroChevron.style.transform = 'rotate(0deg)';
                            if (otroHeader?.dataset.anioId) {
                                try { localStorage.setItem(`anio-${otroHeader.dataset.anioId}-expandido`, 'false'); } catch (e) { }
                            }
                        }
                    });

                    const hayOtrosAbiertos = Array.from(otrosMesesAbiertos).some(otro => otro !== detalle && !esContenedorAnio(otro));

                    if (hayOtrosAbiertos) {
                        otrosMesesAbiertos.forEach(otroDetalle => {
                            if (otroDetalle !== detalle && !esContenedorAnio(otroDetalle)) {
                                const alturaActual = otroDetalle.scrollHeight;

                                otroDetalle.style.minHeight = `${alturaActual}px`;

                                otroDetalle.classList.remove('expanded');
                                const otroContainer = otroDetalle.closest('.registro-mes-container');
                                const otroChevron = otroContainer?.querySelector('.chevron-mes');
                                const otroHeader = otroContainer?.querySelector('.registro-mes-header');

                                if (otroChevron) otroChevron.style.transform = 'rotate(0deg)';

                                if (otroHeader && otroHeader.dataset.mesId) {
                                    try {
                                        localStorage.setItem(`mes-${otroHeader.dataset.mesId}-expandido`, 'false');
                                    } catch (e) { }
                                }

                                setTimeout(() => {
                                    otroDetalle.style.minHeight = '';
                                }, 350);
                            }
                        });

                        setTimeout(() => {
                            detalle.classList.add('expanded');
                            chevronIcon.style.transform = 'rotate(180deg)';

                            try {
                                localStorage.setItem(`mes-${header.dataset.mesId}-expandido`, 'true');
                            } catch (e) { }

                            setTimeout(() => {
                                const margenHeader = 80;
                                const alturaVentana = window.innerHeight;
                                const registros = detalle.querySelectorAll('.registro-item');

                                if (registros.length > 0) {
                                    const primerRegistro = registros[0];
                                    const rectPrimero = primerRegistro.getBoundingClientRect();
                                    const segundoRegistro = registros.length > 1 ? registros[1] : null;
                                    const rectSegundo = segundoRegistro ? segundoRegistro.getBoundingClientRect() : null;

                                    const primeroCortado = rectPrimero.top < margenHeader || rectPrimero.bottom > alturaVentana;
                                    const segundoCortado = rectSegundo && (rectSegundo.top < margenHeader || rectSegundo.bottom > alturaVentana);

                                    if (primeroCortado || segundoCortado) {
                                        contenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                }
                            }, 310);
                        }, 300);

                    } else {
                        detalle.classList.add('expanded');
                        chevronIcon.style.transform = 'rotate(180deg)';

                        try {
                            localStorage.setItem(`mes-${header.dataset.mesId}-expandido`, 'true');
                        } catch (e) { }

                        setTimeout(() => {
                            const margenHeader = 80;
                            const alturaVentana = window.innerHeight;
                            const registros = detalle.querySelectorAll('.registro-item');

                            if (registros.length > 0) {
                                const primerRegistro = registros[0];
                                const rectPrimero = primerRegistro.getBoundingClientRect();
                                const segundoRegistro = registros.length > 1 ? registros[1] : null;
                                const rectSegundo = segundoRegistro ? segundoRegistro.getBoundingClientRect() : null;

                                const primeroCortado = rectPrimero.top < margenHeader || rectPrimero.bottom > alturaVentana;
                                const segundoCortado = rectSegundo && (rectSegundo.top < margenHeader || rectSegundo.bottom > alturaVentana);

                                if (primeroCortado || segundoCortado) {
                                    contenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                            }
                        }, 310);
                    }
                }
            });

            const loteDesde = document.getElementById('lote-fecha-desde');
            const loteHasta = document.getElementById('lote-fecha-hasta');
            const actualizarBotonLoteDebounced = debounce(actualizarBotonLote, 300);

            const agregarListenersFecha = (el) => {
                if (!el) return;
                el.addEventListener('change', () => actualizarBotonLote());
                el.addEventListener('input', () => actualizarBotonLoteDebounced());
            };
            agregarListenersFecha(loteDesde);
            agregarListenersFecha(loteHasta);

            const tipoExportSelect = document.getElementById('tipo-exportacion');
            if (tipoExportSelect) {
                tipoExportSelect.addEventListener('change', () => {
                    UILogic.toggleCamposRangoExport();
                });
            }
            const fileInput = document.getElementById('file-import');
            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    const nombreEl = document.getElementById('nombre-archivo-seleccionado');
                    const btnCombinar = document.getElementById('btn-combinar');
                    const btnReemplazar = document.getElementById('btn-reemplazar');

                    if (e.target.files.length > 0) {
                        if (nombreEl) {
                            const nombreArchivo = e.target.files[0].name;
                            nombreEl.textContent = `✓ ${nombreArchivo}`;
                            nombreEl.style.display = 'block';
                        }

                        if (btnCombinar) {
                            btnCombinar.disabled = false;
                            btnCombinar.style.opacity = '1';
                        }
                        if (btnReemplazar) {
                            btnReemplazar.disabled = false;
                            btnReemplazar.style.opacity = '1';
                        }
                    } else {
                        if (nombreEl) {
                            nombreEl.style.display = 'none';
                            nombreEl.textContent = '';
                        }
                        if (btnCombinar) {
                            btnCombinar.disabled = true;
                        }
                        if (btnReemplazar) {
                            btnReemplazar.disabled = true;
                        }
                    }
                });
            }
        }

        function actualizarHintGrupo() {
            const hint = document.getElementById('edit-grupo-hint');
            if (!hint) return;
            const desde = document.getElementById('edit-grupo-desde')?.value;
            const hasta = document.getElementById('edit-grupo-hasta')?.value;
            if (!desde && !hasta) { hint.textContent = ''; return; }
            if (desde && !hasta) {
                hint.textContent = `1 día`;
                return;
            }
            if (!S.validarFechaSegura(desde) || !S.validarFechaSegura(hasta) || desde > hasta) {
                hint.textContent = 'Rango inválido';
                return;
            }
            const fechaInicio = S.parsearFechaLocal(desde);
            const fechaFin = S.parsearFechaLocal(hasta);
            const diasTotales = Math.ceil(Math.abs(fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;
            hint.textContent = `${diasTotales} día${diasTotales !== 1 ? 's' : ''}`;
        }
        ['edit-grupo-desde', 'edit-grupo-hasta'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', actualizarHintGrupo);
        });

        function mostrarFiltros() {
            if (D.obtenerRegistrosFiltrados().length !== D.registros().length) {
                D.limpiarFiltros();
                return;
            }

            ModalManager.abrir('modal-filtros');

            const aplicarInmediato = () => {
                const desde = $('filtro-fecha-desde').value;
                const hasta = $('filtro-fecha-hasta').value;
                const tipo = $('filtro-tipo').value;
                D.aplicarFiltrosInmediato(desde, hasta, tipo);
            };

            ['filtro-fecha-desde', 'filtro-fecha-hasta', 'filtro-tipo'].forEach(id => {
                const el = $(id);
                if (el) {
                    el.removeEventListener('change', aplicarInmediato);
                    el.addEventListener('change', aplicarInmediato);
                }
            });
        }

        function cerrarFiltros() {
            ModalManager.cerrar('modal-filtros');
        }

        function toggleSeccionGen(elementId, iconId, storageKey, callback = null) {
            const el = $(elementId);
            const icon = $(iconId);

            if (!el) return;

            el.classList.toggle('expanded');
            const isExpanded = el.classList.contains('expanded');

            if (icon) {
                if (isExpanded) icon.classList.add('rotated');
                else icon.classList.remove('rotated');
            }

            if (localStorage.getItem('persistirTarjetas') !== 'false') {
                try { localStorage.setItem(storageKey, isExpanded); } catch (e) { }
            }

            if (isExpanded && callback) callback();
        }

        function toggleFormulario() {
            const el = $('form-registro');
            const estabaExpandido = el.classList.contains('expanded');

            toggleSeccionGen('form-registro', 'icon-indicator-form', 'formularioExpandido');

            if (estabaExpandido) {

                $('entrada').value = '';
                $('salida').value = '';
                $('fecha').value = obtenerFechaHoy();

                const loteDesde = $('lote-fecha-desde');
                const loteHasta = $('lote-fecha-hasta');
                const loteTipo = $('lote-tipo');

                if (loteDesde) loteDesde.value = '';
                if (loteHasta) loteHasta.value = '';
                if (loteTipo) loteTipo.value = 'feriado';

                if (modoLoteActivo) {
                    toggleModoLote();
                } else {
                    actualizarEstadoBotonTimerMain();
                }
            }
        }

        function toggleHistorico() {
            cancelarTimerAutoCierreBotones();

            const contenido = $('contenido-historico');
            const botones = $('botones-historico');
            const icon = $('icon-indicator-historico');


            if (!contenido) return;

            const contenidoExpandido = contenido.classList.contains('expanded');
            const botonesExpandidos = botones.classList.contains('expanded');

            try {
                if (!contenidoExpandido) {
                    contenido.classList.add('expanded');
                    if (icon) {
                        icon.style.transform = '';
                        icon.classList.add('rotated');
                    }
                    localStorage.setItem('historicoExpandido', 'meses');
                    tiempoExpansionBotones = null;

                    if (_vistaHistoricoCalendario) {
                        const lista = document.getElementById('lista-registros');
                        const cal = document.getElementById('vista-calendario-historico');
                        const btnFiltro = document.getElementById('btn-filtro');
                        const btnVista = document.getElementById('btn-vista-calendario');
                        if (lista) lista.classList.add('hidden');
                        if (cal) cal.classList.remove('hidden');
                        if (btnFiltro) { btnFiltro.disabled = false; btnFiltro.style.opacity = ''; }
                        _renderizarCalendario();
                    }

                } else if (contenidoExpandido && !botonesExpandidos) {
                    botones.classList.add('expanded');
                    if (icon) {
                        icon.classList.remove('rotated');
                        icon.style.transform = 'rotate(-90deg)';
                    }
                    localStorage.setItem('historicoExpandido', 'completo');
                    tiempoExpansionBotones = Date.now();

                } else {
                    const tiempoTranscurrido = Date.now() - (tiempoExpansionBotones || 0);
                    const history_toggle_timer = tiempoTranscurrido > 500;

                    if (history_toggle_timer) {
                        botones.classList.remove('expanded');
                        if (icon) {
                            icon.style.transform = '';
                            icon.classList.add('rotated');
                        }
                        localStorage.setItem('historicoExpandido', 'meses');
                        tiempoExpansionBotones = null;
                    } else {
                        botones.classList.remove('expanded');
                        contenido.classList.remove('expanded');
                        if (icon) {
                            icon.classList.remove('rotated');
                            icon.style.transform = '';
                        }
                        localStorage.setItem('historicoExpandido', 'cerrado');
                        tiempoExpansionBotones = null;
                    }
                }
            } catch (e) {
                console.warn('Error guardando estado histórico:', e);
            }
        }

        function iniciarTimerAutoCierreBotones() {
            if (timerAutoCierreBotones) {
                clearTimeout(timerAutoCierreBotones);
                timerAutoCierreBotones = null;
            }

            timerAutoCierreBotones = setTimeout(() => {
                const botones = $('botones-historico');
                const contenido = $('contenido-historico');
                const icon = $('icon-indicator-historico');

                if (botones && botones.classList.contains('expanded')) {
                    botones.classList.remove('expanded');

                    if (icon) {
                        icon.style.transform = '';
                        icon.classList.add('rotated');
                    }

                    try {
                        localStorage.setItem('historicoExpandido', 'meses');
                    } catch (e) {
                        console.warn('Error guardando estado histórico:', e);
                    }

                    tiempoExpansionBotones = null;
                }

                timerAutoCierreBotones = null;
            }, 3000);
        }

        function cancelarTimerAutoCierreBotones() {
            if (timerAutoCierreBotones) {
                clearTimeout(timerAutoCierreBotones);
                timerAutoCierreBotones = null;
            }
        }

        let _calendarioMes = null;

        function _renderizarCalendario(idResaltar = null) {
            const grid = document.getElementById('calendario-grid');
            const titulo = document.getElementById('calendario-titulo-mes');
            if (!grid) return;

            registrarSwipe(grid, dir => navegarCalendario(dir));

            const hoy = new Date();
            const anio = _calendarioMes ? _calendarioMes.anio : hoy.getFullYear();
            const mes = _calendarioMes ? _calendarioMes.mes : hoy.getMonth();
            const nombresMes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            if (titulo) titulo.textContent = `${nombresMes[mes]} ${anio}`;
            const fechaStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const registrosFiltrados = D.obtenerRegistrosFiltrados();
            const todosLosRegistros = D.registros();
            const regsPorFecha = {};
            registrosFiltrados.forEach(r => { regsPorFecha[r.fecha] = r; });
            const todosRegsPorFecha = {};
            todosLosRegistros.forEach(r => { todosRegsPorFecha[r.fecha] = r; });
            const horasDiariasObj = D.horasDiarias();
            const filtroActivo = D.obtenerRegistrosFiltrados().length !== D.registros().length;
            const claseDelDia = (fecha) => {
                const r = regsPorFecha[fecha];
                if (!r && filtroActivo && todosRegsPorFecha[fecha]) return 'dia-filtrado';
                if (!r) return 'dia-sin-registro';
                if (TiposRegistro.esRegistroEspecial(r.entrada, r.salida)) {
                    const tipo = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
                    return `dia-especial-${tipo ? tipo.color : 'purple'}`;
                }
                if (r.entrada && !r.salida) {
                    const fechaHoy = obtenerFechaHoy();
                    return fecha === fechaHoy ? 'dia-en-curso' : 'dia-sin-salida';
                }
                if (r.total >= horasDiariasObj) return 'dia-normal';
                return 'dia-incompleto';
            };

            const diasNombre = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            let html = diasNombre.map(d => `<div class="calendario-dia-nombre">${d}</div>`).join('');
            const primerDia = new Date(anio, mes, 1);
            const ultimoDia = new Date(anio, mes + 1, 0);
            let offsetInicio = primerDia.getDay();
            for (let i = 0; i < offsetInicio; i++) {
                html += `<div class="calendario-dia vacio"></div>`;
            }

            for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
                const fecha = fechaStr(anio, mes, dia);
                const clase = claseDelDia(fecha);
                const esHoy = anio === hoy.getFullYear() && mes === hoy.getMonth() && dia === hoy.getDate();
                const reg = regsPorFecha[fecha];
                const cursor = reg ? ' cursor-pointer' : '';
                const esNuevo = idResaltar && reg && reg.id === idResaltar ? ' nuevo-registro-animacion' : '';
                const dataId = reg ? ` data-reg-id="${reg.id}"` : '';
                html += `<div class="calendario-dia ${clase}${esHoy ? ' hoy' : ''}${esNuevo}${cursor}"${dataId}>${dia}</div>`;
            }

            if (filtroActivo) {
                grid.classList.add('calendario-filtro-activo');
            } else {
                grid.classList.remove('calendario-filtro-activo');
            }
            grid.innerHTML = html;

            grid.querySelectorAll('.calendario-dia[data-reg-id]').forEach(el => {
                const id = el.dataset.regId;
                el.addEventListener('click', (e) => UILogic._onclickCalendarioDia(e, id));
                el.addEventListener('mouseenter', (e) => UILogic._popupCalendarioHover(e, id));
                el.addEventListener('mouseleave', (e) => UILogic._cerrarPopupCalendarioHover(e));
            });

        }

        let _vistaHistoricoCalendario = false;

        function toggleVistaHistorico() {
            _vistaHistoricoCalendario = !_vistaHistoricoCalendario;
            try { localStorage.setItem('vistaHistoricoCalendario', _vistaHistoricoCalendario); } catch (e) { }

            const lista = document.getElementById('lista-registros');
            const cal = document.getElementById('vista-calendario-historico');
            const btnFiltro = document.getElementById('btn-filtro');
            const saliente = _vistaHistoricoCalendario ? lista : cal;
            const entrante = _vistaHistoricoCalendario ? cal : lista;
            if (saliente) saliente.classList.add('fade-out');

            setTimeout(() => {
                if (saliente) { saliente.classList.remove('fade-out'); saliente.classList.add('hidden'); }
                if (entrante) {
                    entrante.classList.remove('hidden');
                    entrante.classList.add('fade-out');
                    entrante.offsetHeight;
                    entrante.classList.remove('fade-out');
                }

                if (_vistaHistoricoCalendario) {
                    if (btnFiltro) { btnFiltro.disabled = false; btnFiltro.style.opacity = ''; }
                    _renderizarCalendario();
                } else {
                    if (btnFiltro) { btnFiltro.disabled = false; btnFiltro.style.opacity = ''; }
                }
            }, 300);

            const selector = document.getElementById('calendario-selector-meses');
            const grid = document.getElementById('calendario-grid');
            const navBotones = document.getElementById('calendario-nav-botones');
            if (selector && !selector.classList.contains('hidden') && selector.style.display !== 'none') {
                selector.style.display = 'none';
                if (grid) grid.style.display = 'grid';
                if (navBotones) navBotones.style.display = 'flex';
            }
        }

        let _popupCalendarioEl = null;

        function _popupCalendario(event, registroId) {
            event.stopPropagation();

            if (_popupCalendarioEl) {
                _popupCalendarioEl.remove();
                _popupCalendarioEl = null;
            }

            const reg = D.registros().find(r => r.id === registroId);
            if (!reg) return;

            const _esc = s => s == null ? '' : String(s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

            const claveMes = reg.fecha.substring(0, 7);
            const registrosDelMes = D.registros().filter(r => r.fecha.substring(0, 7) === claveMes);
            const grupos = agruparRegistrosConsecutivos(registrosDelMes);
            const grupoDelRegistro = grupos.find(g =>
                g.tipo === 'grupo' && g.registros.some(r => r.id === registroId)
            );

            const esEspecial = TiposRegistro.esRegistroEspecial(reg.entrada, reg.salida);
            const fechaObj = new Date(reg.fecha + 'T12:00:00');
            const opcFecha = { weekday: 'long', day: 'numeric', month: 'long' };
            const fechaLabel = fechaObj.toLocaleDateString('es-AR', opcFecha);

            let infoHtml = '';
            if (esEspecial) {
                const tipoConfig = TiposRegistro.obtenerTipoPorCodigo(reg.entrada, reg.salida);
                const emoji = tipoConfig ? tipoConfig.emoji : '';
                const label = tipoConfig ? tipoConfig.label : _esc(reg.entrada);
                infoHtml = `<span class="cal-popup-badge cal-popup-badge--${tipoConfig?.color || 'purple'}">${emoji} ${label}</span>`;
            } else if (reg.entrada && !reg.salida) {
                const esHoy = reg.fecha === obtenerFechaHoy();
                infoHtml = esHoy
                    ? `<div class="cal-popup-info cal-popup-info--blue">En curso</div>
                               <div class="cal-popup-3l">Entrada: ${_esc(reg.entrada)}</div>`
                    : `<div class="cal-popup-info cal-popup-info--gold">Incompleto</div>
                               <div class="cal-popup-3l">Entrada: ${_esc(reg.entrada)}</div>`;
            } else {
                const totalHoras = reg.total || 0;
                const h = Math.floor(totalHoras);
                const m = Math.round((totalHoras - h) * 60);
                const totalStr = `${h}h${m > 0 ? ' ' + m + 'm' : ''}`;
                let tfStr = '';
                if (reg.tiempoFuera && reg.tiempoFuera !== '00:00') {
                    const [tfH, tfM] = reg.tiempoFuera.split(':').map(Number);
                    tfStr = tfH > 0 ? `${tfH}h${tfM > 0 ? ' ' + tfM + 'm' : ''} fuera` : `${tfM}m fuera`;
                }
                const horasDiarias = D.horasDiarias();
                let totalConDiff = totalStr;
                let diffColor = '';
                if (horasDiarias > 0) {
                    const diffText = formatoDiferencia(totalHoras);
                    if (diffText) totalConDiff += ` (${diffText})`;
                    diffColor = totalHoras >= horasDiarias ? 'var(--c-green)' : 'var(--c-red)';
                }
                infoHtml = `<div class="cal-popup-info${diffColor ? ' cal-popup-info--dynamic' : ''}" ${diffColor ? `data-color="${diffColor}"` : ''}>${totalConDiff}</div>
                    <div class="cal-popup-3l">${_esc(reg.entrada)} – ${_esc(reg.salida)}</div>
                    ${tfStr ? `<div class="cal-popup-3l">${_esc(tfStr)}</div>` : ''}`;
            }

            const btnGrupoHtml = grupoDelRegistro ? `
        <button class="cal-popup-btn-edit" id="_cal-popup-btn-grupo">
            <svg class="icon"><use href="#icon-grid-group"/></svg>
            Editar grupo
        </button>` : '';

            if (grupoDelRegistro) {
                window._calPopupGrupo = grupoDelRegistro;
            }

            const popup = document.createElement('div');
            popup.className = 'cal-popup';
            popup.id = '_cal-popup';
            popup.dataset.registroId = reg.id;
            popup.innerHTML = `
        <div class="cal-popup-fecha">${fechaLabel}</div>
        ${infoHtml}
        <button class="cal-popup-btn-edit" id="_cal-popup-btn-edit">
            <svg class="icon"><use href="#icon-edit"/></svg>
            Editar
        </button>
        ${btnGrupoHtml}
    `;

            _applyDataColors(popup);
            popup.style.visibility = 'hidden';

            document.body.appendChild(popup);
            _popupCalendarioEl = popup;

            const btnEditPopup = popup.querySelector('#_cal-popup-btn-edit');
            if (btnEditPopup) {
                btnEditPopup.addEventListener('click', () => {
                    DataManagement.editarRegistro(reg.id);
                    document.getElementById('_cal-popup')?.remove();
                });
            }
            const btnGrupoPopup = popup.querySelector('#_cal-popup-btn-grupo');
            if (btnGrupoPopup) {
                btnGrupoPopup.addEventListener('click', () => {
                    DataManagement.editarGrupo(window._calPopupGrupo);
                    document.getElementById('_cal-popup')?.remove();
                });
            }

            popup.addEventListener('mouseenter', () => {
                clearTimeout(_popupCalendarioHoverTimer);
            });
            popup.addEventListener('mouseleave', () => {
                if (_popupCalendarioEsHover) {
                    _popupCalendarioHoverTimer = setTimeout(() => {
                        if (_popupCalendarioEl) {
                            _popupCalendarioEl.remove();
                            _popupCalendarioEl = null;
                        }
                        _popupCalendarioEsHover = false;
                    }, 500);
                }
            });

            const cerrarPorScroll = () => {
                popup.remove();
                _popupCalendarioEl = null;
                document.removeEventListener('click', cerrar, true);
                document.removeEventListener('scroll', cerrarPorScroll, true);
            };
            const cerrarPopup = () => {
                popup.remove();
                _popupCalendarioEl = null;
                document.removeEventListener('click', cerrar, true);
                document.removeEventListener('scroll', cerrarPorScroll, true);
            };
            const cerrar = (e) => {
                const diaClickeado = e.target.closest('.calendario-dia');
                if (diaClickeado && diaClickeado.dataset.regId === popup.dataset.registroId) return;
                if (!popup.contains(e.target)) cerrarPopup();
            };
            setTimeout(() => {
                document.addEventListener('click', cerrar, true);
                document.addEventListener('scroll', cerrarPorScroll, true);
            }, 10);

            const el = event.currentTarget || event.target;
            const rect = el.getBoundingClientRect();
            const margin = 8;

            requestAnimationFrame(() => {
                const pw = popup.offsetWidth;
                const ph = popup.offsetHeight;

                let top = rect.bottom + 12;
                let left = rect.left + (rect.width / 2) - (pw / 2);

                if (left + pw > window.innerWidth - margin) left = window.innerWidth - pw - margin;
                if (left < margin) left = margin;
                if (top + ph > window.innerHeight - margin) {
                    top = rect.top - ph - 12;
                }
                if (top < margin) top = margin;

                popup.style.top = top + 'px';
                popup.style.left = left + 'px';
                popup.style.visibility = '';

                setTimeout(() => popup.classList.add('listo'), 350);
            });
        }

        let _popupCalendarioEsHover = false;
        let _popupCalendarioHoverTimer = null;

        function _popupCalendarioHover(event, registroId) {
            if (event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents) return;
            if (!window.matchMedia('(hover: hover)').matches) return;
            const stored = localStorage.getItem('hoverPopupCalendario');
            const esHover = window.matchMedia('(hover: hover)').matches;
            if (stored === null ? !esHover : stored !== 'true') return;
            if (_popupCalendarioEl && _popupCalendarioEl.dataset.registroId === registroId) return;

            clearTimeout(_popupCalendarioHoverTimer);
            _popupCalendarioHoverTimer = setTimeout(() => {
                _popupCalendarioEsHover = true;
                _popupCalendario(event, registroId);
            }, 150);
        }

        function _onclickCalendarioDia(event, registroId) {
            const esDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
            const stored = localStorage.getItem('hoverPopupCalendario');
            const hoverActivo = esDesktop && (stored === null ? true : stored === 'true');

            if (hoverActivo) {
                if (_popupCalendarioEl) {
                    _popupCalendarioEl.remove();
                    _popupCalendarioEl = null;
                }
                clearTimeout(_popupCalendarioHoverTimer);
                DataManagement.editarRegistro(registroId);
            } else {
                if (_popupCalendarioEl && _popupCalendarioEl.dataset.registroId === registroId) return;
                _popupCalendario(event, registroId);
            }
        }

        function _cerrarPopupCalendarioHover(event) {
            if (!_popupCalendarioEsHover) return;
            const related = event.relatedTarget;
            if (related && _popupCalendarioEl && _popupCalendarioEl.contains(related)) return;
            clearTimeout(_popupCalendarioHoverTimer);
            _popupCalendarioHoverTimer = setTimeout(() => {
                if (_popupCalendarioEl) {
                    _popupCalendarioEl.remove();
                    _popupCalendarioEl = null;
                }
                _popupCalendarioEsHover = false;
            }, 500);
        }

        function navegarCalendario(delta) {
            if (_popupCalendarioEl) {
                _popupCalendarioEl.remove();
                _popupCalendarioEl = null;
            }

            const hoy = new Date();
            const base = _calendarioMes || { anio: hoy.getFullYear(), mes: hoy.getMonth() };
            let nuevoMes = base.mes + delta;
            let nuevoAnio = base.anio;
            if (nuevoMes > 11) { nuevoMes = 0; nuevoAnio++; }
            if (nuevoMes < 0) { nuevoMes = 11; nuevoAnio--; }
            _calendarioMes = { anio: nuevoAnio, mes: nuevoMes };
            const grid = document.getElementById('calendario-grid');
            if (grid) {
                grid.classList.add('fade-out');
                setTimeout(() => {
                    _renderizarCalendario();
                    grid.classList.remove('fade-out');
                }, 300);
            } else {
                _renderizarCalendario();
            }
        }

        function irHoyCalendario() {
            const hoy = new Date();
            if (_calendarioMes === null ||
                (_calendarioMes.anio === hoy.getFullYear() && _calendarioMes.mes === hoy.getMonth())) {
                return;
            }
            _calendarioMes = null;
            const grid = document.getElementById('calendario-grid');
            if (grid) {
                grid.classList.add('fade-out');
                setTimeout(() => {
                    _renderizarCalendario();
                    grid.classList.remove('fade-out');
                }, 300);
            } else {
                _renderizarCalendario();
            }
        }

        function toggleStats() {
            toggleSeccionGen('form-stats', 'icon-indicator-stats', 'statsExpandido', () => {
                registrarSwipe($('form-stats'), dir => togglePeriodoStats(dir));
                if (modoEstadisticas === 'anual') {
                    poblarSelectorAnios();
                } else if (modoEstadisticas === 'semanal') {
                    poblarSelectorSemanas();
                    actualizarEstadisticasSemana($('select-semana-stats')?.value);
                } else {
                    poblarSelectorMeses();
                    const selectMes = $('select-mes-stats');
                    if (selectMes && selectMes.value) {
                        actualizarEstadisticas(selectMes.value);
                    } else {
                        actualizarEstadisticas();
                    }
                }
            });
        }

        function alternarFechaActual(id) {
            const c = document.getElementById(id);
            if (!c) return;
            if (c.value.trim() !== '') {
                c.value = '';
            } else {
                c.value = obtenerFechaHoy();
            }

            actualizarBotonLote();
            if (id === 'edit-grupo-desde' || id === 'edit-grupo-hasta') {
                c.dispatchEvent(new Event('change'));
            }
        }

        function verificarBloqueoCredito() {
            const btnCredito = document.getElementById('btn-toggle-credito');
            if (!btnCredito) return;

            const _bloquear = () => {
                btnCredito.disabled = true;
                btnCredito.style.opacity = '0.5';
                btnCredito.style.cursor = 'not-allowed';
            };
            const _habilitar = () => {
                btnCredito.disabled = false;
                btnCredito.style.opacity = '1';
                btnCredito.style.cursor = 'pointer';
            };

            if (document.getElementById('edit-fecha').disabled) return _bloquear();

            const e = document.getElementById('edit-entrada').value.trim();
            const s = document.getElementById('edit-salida').value.trim();
            const tf = document.getElementById('edit-tiempo-fuera').value.trim() || null;

            const horarioCompleto = e.length === 5 && s.length === 5;
            if (!horarioCompleto) {
                if (btnCredito.dataset.activo === "true") toggleCredito();
                return _bloquear();
            }

            if (TiposRegistro.esRegistroEspecial(e, s)) return _bloquear();

            const calcTemp = D.calcularHoras(e, s, tf, null);
            if (!calcTemp || calcTemp.total >= D.horasDiarias()) return _bloquear();

            _habilitar();
        }

        function setBloqueoEdicionGrupo(bloqueado) {
            edicionGrupoBloqueada = bloqueado;

            const btnLock = $('btn-lock-grupo-toggle');
            if (btnLock) {
                const icon = btnLock.querySelector('use');
                icon.setAttribute('href', bloqueado ? '#icon-lock' : '#icon-lock-open');
                btnLock.title = bloqueado ? "Desbloquear edición" : "Bloquear edición";
                btnLock.style.color = bloqueado ? 'var(--c-red)' : 'var(--text-main)';
            }

            const inputs = ['edit-grupo-tipo', 'edit-grupo-desde', 'edit-grupo-hasta'];
            inputs.forEach(id => {
                const el = $(id);
                if (el) el.disabled = bloqueado;
            });

            const modal = $('modal-editar-grupo');
            if (modal) {
                const botones = modal.querySelectorAll('button:not(#btn-lock-grupo-toggle):not(.btn-cancel)');
                botones.forEach(btn => {
                    btn.disabled = bloqueado;
                });
            }
        }

        function toggleBloqueoEdicionGrupo() {
            setBloqueoEdicionGrupo(!edicionGrupoBloqueada);
        }

        function cerrarEdicionGrupo() {
            ModalManager.cerrar('modal-editar-grupo', () => {
                D.setGrupoEnEdicion(null);      
                document.dispatchEvent(new Event('scroll'));          
            });
        }

        function aplicarFeedbackCampos(campos) {
            const cambiarTextoSuave = (label, nuevoTexto, color) => {
                if (!label) return;
                label.style.opacity = '0';
                label.style.transform = 'translateY(-3px)';
                setTimeout(() => {
                    label.textContent = nuevoTexto;
                    label.style.color = color;
                    label.style.opacity = '1';
                    label.style.transform = 'translateY(0)';
                }, 150);
            };

            const activos = campos
                .filter(c => c.mostrar)
                .map(c => {
                    const input = document.getElementById(c.id);
                    const label = input?.closest('.form-group')?.querySelector('label');
                    const textoOriginal = label ? label.textContent : c.fallback;
                    if (input && label) {
                        input.classList.add('input-agregado-animacion');
                        cambiarTextoSuave(label, '✓ Agregado', 'var(--c-green)');
                    }
                    return { input, label, textoOriginal };
                });

            setTimeout(() => {
                activos.forEach(({ input, label, textoOriginal }) => {
                    if (input && label) {
                        input.classList.remove('input-agregado-animacion');
                        cambiarTextoSuave(label, textoOriginal, '');
                    }
                });
            }, 2000);
        }

        return {
            init, obtenerFechaHoy, pegarHoraActual, alternarTema, alternarVista, cerrarConfig, abrirSelectorMesesCalendario,
            cerrarEdicion, mostrarImportar, cerrarImportar, actualizarUI, mostrarToast, mostrarError,
            limpiarError, resetearBoton, restaurarBotonGuardarEdicion, toggleFormulario, aplicarOrdenCards, iniciarDragOrdenCards,
            limpiarCampo, mostrarFiltros, cerrarFiltros, registrarLoteDesdeCard, irHoyCalendario, obtenerOrdenCards,
            cambiarMesStats, generarReporte, toggleHistorico, toggleStats, sumarMinutosAHora, actualizarEstadoBotonHoverPopup,
            toggleTimerBreakMain, actualizarEstadoBotonTimerMain, toggleBloqueoEdicion, setBloqueoEdicion,
            actualizarFeedbackConfig, poblarSelectorMeses, abrirSelectorPerfiles, actualizarBotonLote,
            cerrarSelectorPerfiles, abrirEditorPerfil, cerrarEditorPerfil, guardarEdicionPerfil, toggleModoLote,
            eliminarPerfilDesdeEditor, crearPerfilDesdeSelector, renderizarListaPerfiles, ejecutarAccionRegistro,
            iniciarCambioHoras, detenerCambio, mostrarconfig, alternarFechaActual, verificarBloqueoCredito,
            toggleCredito, setBloqueoEdicionGrupo, toggleBloqueoEdicionGrupo, cerrarEdicionGrupo, poblarSelectoresTipos,
            mostrarExportar, cerrarExportar, ejecutarExportacion, toggleCamposRangoExport, aplicarFeedbackCampos,
            iniciarTimerAutoCierreBotones, cancelarTimerAutoCierreBotones, toggleIgnorarTiempoFuera, actualizarEstadoBotonIgnorarTF,
            togglePeriodoStats, cambiarAnioStats, cambiarSemanaStats, toggleFondoCard, setFondoCard, toggleVisibilidadCard, aplicarVisibilidadCards,
            togglePersistirTarjetas, actualizarEstadoBotonPersistir, toggleVistaHistorico, actualizarHintGrupo,
            _popupCalendario, _popupCalendarioHover, _onclickCalendarioDia, _cerrarPopupCalendarioHover, toggleHoverPopupCalendario,


        };

    })(SecurityAndUtils, DataManagement, GistSync);

    UILogic.init();
})();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registrado:', registration.scope);
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            if (window.UILogic) UILogic.mostrarToast('Se actualizará la versión al recargar', 'info');
                        }
                    });
                });
            })
            .catch(err => console.error('❌ Error SW:', err));
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const $ = id => document.getElementById(id);
    
    if (window.NotificacionesManager) NotificacionesManager.inicializar();

    const addHoldEvents = (btn, onStart, onStop) => {
        btn.addEventListener('mousedown', onStart);
        btn.addEventListener('mouseup', onStop);
        btn.addEventListener('mouseleave', onStop);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(); }, { passive: false });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); onStop(); }, { passive: false });
    };

    $('btn-install')?.addEventListener('click', () => PWAInstaller.instalarApp());
    document.querySelector('.header-profile-btn')?.addEventListener('click', () => UILogic.abrirSelectorPerfiles());

    $('stats-card')?.addEventListener('click', () => UILogic.alternarVista());

    $('btn-timer-main')?.addEventListener('click', () => UILogic.toggleTimerBreakMain());
    $('btn-agregar')?.addEventListener('click', () => UILogic.ejecutarAccionRegistro());
    $('icon-indicator-form')?.addEventListener('click', () => UILogic.toggleFormulario());

    $('btn-ir-modo-lote')?.addEventListener('click', () => UILogic.toggleModoLote());
    $('btn-pegar-entrada')?.addEventListener('click', () => UILogic.pegarHoraActual('entrada'));
    $('btn-pegar-salida')?.addEventListener('click', () => UILogic.pegarHoraActual('salida'));

    $('lote-tipo')?.addEventListener('change', () => UILogic.actualizarBotonLote());
    $('btn-ir-modo-normal')?.addEventListener('click', () => UILogic.toggleModoLote());
    $('btn-lote-desde')?.addEventListener('click', () => UILogic.alternarFechaActual('lote-fecha-desde'));
    $('btn-lote-hasta')?.addEventListener('click', () => UILogic.alternarFechaActual('lote-fecha-hasta'));

    document.querySelector('#card-estadisticas .card-header-clickable')?.addEventListener('click', () => UILogic.toggleStats());
    $('select-mes-stats')?.addEventListener('change', () => UILogic.cambiarMesStats());
    $('select-anio-stats')?.addEventListener('change', () => UILogic.cambiarAnioStats());
    $('select-semana-stats')?.addEventListener('change', () => UILogic.cambiarSemanaStats());
    $('btn-toggle-periodo')?.addEventListener('click', () => UILogic.togglePeriodoStats());
    $('btn-reporte')?.addEventListener('click', () => UILogic.generarReporte());

    document.querySelector('#card-historico .card-header-clickable')?.addEventListener('click', () => UILogic.toggleHistorico());
    $('btn-vista-calendario')?.addEventListener('click', () => UILogic.toggleVistaHistorico());
    $('btn-filtro')?.addEventListener('click', () => UILogic.mostrarFiltros());
    $('btn-undo')?.addEventListener('click', () => HistoryManager.undo());
    $('btn-redo')?.addEventListener('click', () => HistoryManager.redo());

    $('calendario-titulo-mes')?.addEventListener('click', () => UILogic.abrirSelectorMesesCalendario());
    document.querySelector('.btn-hoy-calendario')?.addEventListener('click', () => UILogic.irHoyCalendario());
    const navBotones = $('calendario-nav-botones');
    if (navBotones) {
        const navBtns = navBotones.querySelectorAll('button:not(.btn-hoy-calendario)');
        if (navBtns[0]) navBtns[0].addEventListener('click', () => UILogic.navegarCalendario(-1));
        if (navBtns[1]) navBtns[1].addEventListener('click', () => UILogic.navegarCalendario(1));
    }

    $('btn-toggle-fondo')?.addEventListener('click', () => UILogic.toggleFondoCard());
    $('btn-toggle-ignorar-tf')?.addEventListener('click', () => UILogic.toggleIgnorarTiempoFuera());
    $('btn-toggle-hover-popup')?.addEventListener('click', () => UILogic.toggleHoverPopupCalendario());
    $('btn-toggle-persistir-tarjetas')?.addEventListener('click', () => UILogic.togglePersistirTarjetas());
    $('btn-toggle-card-registrar')?.addEventListener('click', () => UILogic.toggleVisibilidadCard('registrar'));
    $('btn-toggle-card-estadisticas')?.addEventListener('click', () => UILogic.toggleVisibilidadCard('estadisticas'));
    $('btn-toggle-card-historico')?.addEventListener('click', () => UILogic.toggleVisibilidadCard('historico'));
    document.querySelector('.config-actions .btn-edit')?.addEventListener('click', () => UILogic.abrirModalGist());
    document.querySelector('.config-actions .btn-backup')?.addEventListener('click', () => UILogic.mostrarImportar());
    document.querySelector('.config-actions .btn-export')?.addEventListener('click', () => UILogic.mostrarExportar());
    document.querySelector('.config-actions .btn-delete')?.addEventListener('click', () => DataManagement.borrarTodoHistorial());
    document.querySelector('#modal-config .modal-panel-footer .btn-delete')?.addEventListener('click', () => UILogic.cerrarConfig());

    const inputHoras = $('config-horas-diarias');
    if (inputHoras) {
        const btnsHoras = inputHoras.closest('.input-number-group')?.querySelectorAll('.btn-increment');
        if (btnsHoras?.[0]) addHoldEvents(btnsHoras[0], () => UILogic.iniciarCambioHoras(0.5), () => UILogic.detenerCambio());
        if (btnsHoras?.[1]) addHoldEvents(btnsHoras[1], () => UILogic.iniciarCambioHoras(-0.5), () => UILogic.detenerCambio());
    }

    $('gist-token')?.addEventListener('input', () => UILogic.actualizarEstadoBotonesGist());
    $('gist-id')?.addEventListener('input', () => UILogic.actualizarEstadoBotonesGist());
    $('btn-toggle-token')?.addEventListener('click', () => UILogic.toggleVerToken());
    $('btn-crear-token')?.addEventListener('click', () => window.open('https://github.com/settings/tokens/new?description=Horarios+sync&scopes=gist', '_blank', 'noopener,noreferrer'));
    $('btn-gist-abrir')?.addEventListener('click', () => UILogic.abrirGistEnBrowser());
    $('btn-gist-subir')?.addEventListener('click', () => UILogic.gistSubir());
    $('btn-gist-bajar')?.addEventListener('click', () => UILogic.gistBajar());
    $('btn-toggle-gist-backup')?.addEventListener('click', () => UILogic.toggleGistBackup());
    $('btn-toggle-gist-merge')?.addEventListener('click', () => UILogic.toggleGistMerge());

    const inputLimite = $('gist-limite-valor');
    if (inputLimite) {
        const btnsLimite = inputLimite.closest('.input-number-group')?.querySelectorAll('.btn-increment');
        if (btnsLimite?.[0]) addHoldEvents(btnsLimite[0], () => UILogic.iniciarCambioLimite(1), () => UILogic.detenerCambioLimite());
        if (btnsLimite?.[1]) addHoldEvents(btnsLimite[1], () => UILogic.iniciarCambioLimite(-1), () => UILogic.detenerCambioLimite());
    }

    $('btn-gist-guardar')?.addEventListener('click', () => UILogic.guardarConfigGist());
    $('btn-gist-volver')?.addEventListener('click', () => UILogic.cerrarModalGist());

    $('btn-gist-merge-combinar')?.addEventListener('click', () => UILogic.gistMergeAplicar('merge'));
    $('btn-gist-merge-reemplazar')?.addEventListener('click', () => UILogic.gistMergeAplicar('replace'));
    $('btn-gist-merge-cancelar')?.addEventListener('click', () => UILogic.gistMergeCancelar());

    $('btn-toggle-credito')?.addEventListener('click', () => UILogic.toggleCredito());
    $('btn-lock-toggle')?.addEventListener('click', () => UILogic.toggleBloqueoEdicion());
    $('btn-edit-entrada')?.addEventListener('click', () => UILogic.pegarHoraActual('edit-entrada'));
    $('btn-edit-salida')?.addEventListener('click', () => UILogic.pegarHoraActual('edit-salida'));
    $('btn-edit-tf')?.addEventListener('click', () => UILogic.limpiarCampo('edit-tiempo-fuera'));
    $('btn-edit-notas')?.addEventListener('click', () => UILogic.limpiarCampo('edit-notas'));
    document.querySelector('#modal-editar .btn-edit')?.addEventListener('click', () => DataManagement.guardarEdicion());
    document.querySelector('#modal-editar .btn-delete')?.addEventListener('click', () => DataManagement.eliminarRegistroActual());
    document.querySelector('#modal-editar .btn-cancel')?.addEventListener('click', () => UILogic.cerrarEdicion());

    $('btn-seleccionar-archivo')?.addEventListener('click', () => $('file-import').click());
    $('btn-combinar')?.addEventListener('click', () => DataManagement.importarDatos('merge'));
    $('btn-reemplazar')?.addEventListener('click', () => DataManagement.importarDatos('replace'));
    $('btn-volver-importar')?.addEventListener('click', () => UILogic.cerrarImportar());

    document.querySelector('#modal-exportar .btn-export')?.addEventListener('click', () => UILogic.ejecutarExportacion());
    $('btn-volver-exportar')?.addEventListener('click', () => UILogic.cerrarExportar());

    document.querySelector('#modal-filtros .btn-cancel')?.addEventListener('click', () => UILogic.cerrarFiltros());

    document.querySelector('#modal-selector-perfiles .btn-edit')?.addEventListener('click', () => UILogic.mostrarconfig());
    $('theme-toggle-modal')?.addEventListener('click', () => UILogic.alternarTema());
    document.querySelector('#modal-selector-perfiles .btn-cancel')?.addEventListener('click', () => UILogic.cerrarSelectorPerfiles());
    $('btn-crear-perfil')?.addEventListener('click', () => UILogic.crearPerfilDesdeSelector());

    document.querySelector('#modal-editar-perfil .btn-edit')?.addEventListener('click', () => UILogic.guardarEdicionPerfil());
    $('btn-eliminar-perfil-editor')?.addEventListener('click', () => UILogic.eliminarPerfilDesdeEditor());
    document.querySelector('#modal-editar-perfil .btn-cancel')?.addEventListener('click', () => UILogic.cerrarEditorPerfil());

    $('btn-lock-grupo-toggle')?.addEventListener('click', () => UILogic.toggleBloqueoEdicionGrupo());
    $('btn-grupo-desde')?.addEventListener('click', () => UILogic.alternarFechaActual('edit-grupo-desde'));
    $('btn-grupo-hasta')?.addEventListener('click', () => UILogic.alternarFechaActual('edit-grupo-hasta'));
    document.querySelector('#modal-editar-grupo .btn-edit')?.addEventListener('click', () => DataManagement.guardarEdicionGrupo());
    document.querySelector('#modal-editar-grupo .btn-delete')?.addEventListener('click', () => DataManagement.eliminarGrupoActual());
    document.querySelector('#modal-editar-grupo .btn-cancel')?.addEventListener('click', () => UILogic.cerrarEdicionGrupo());

    $('btn-config-notificaciones')?.addEventListener('click', () => {
        ModalManager.alternar('modal-config', 'modal-notificaciones', null, () => window.NotificacionesManager && NotificacionesManager.actualizarUI());
    });
    $('btn-toggle-notificaciones')?.addEventListener('click', () => window.NotificacionesManager && NotificacionesManager.alternarHabilitacion());
    $('select-notificaciones-tiempo')?.addEventListener('change', (e) => window.NotificacionesManager && NotificacionesManager.setMinutosAntes(parseInt(e.target.value, 10)));
    $('btn-cerrar-notificaciones')?.addEventListener('click', () => ModalManager.alternar('modal-notificaciones', 'modal-config'));
});

// lushibosca version 260511-v1