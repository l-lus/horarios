// ====================================================================
// MATRIX RAIN BACKGROUND MODULE
// Genera lluvia digital estilo Matrix optimizada en un canvas de fondo
// ====================================================================

(function () {
    'use strict';

    const CHARS = 'ｦｱｳｴｵｶｷｹｹｻｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:・."=*+-<>¦|';
    const FONT_SIZE = 16;
    const FPS = 10;
    const FRAME_INTERVAL = 1000 / FPS;

    let canvas = null;
    let ctx = null;
    let animId = null;
    let activo = false;
    let lastTime = 0;
    let drops = [];
    let speeds = [];
    let resizeTimer = null;

    function getCanvas() {
        if (!canvas) {
            canvas = document.getElementById('matrix-canvas');
            if (!canvas && document.body) {
                canvas = document.createElement('canvas');
                canvas.id = 'matrix-canvas';
                canvas.setAttribute('aria-hidden', 'true');
                document.body.insertBefore(canvas, document.body.firstChild);
            }
            if (canvas) {
                ctx = canvas.getContext('2d');
            }
        }
        return canvas;
    }

    function ajustarDimensiones() {
        if (!canvas) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = w;
        canvas.height = h;

        const numColumnas = Math.ceil(w / FONT_SIZE);
        const nuevasGotas = [];
        const nuevasVelocidades = [];
        for (let i = 0; i < numColumnas; i++) {
            nuevasGotas[i] = (drops[i] !== undefined)
                ? drops[i]
                : Math.floor(Math.random() * -(h / FONT_SIZE));
            nuevasVelocidades[i] = (speeds[i] !== undefined)
                ? speeds[i]
                : 0.75 + Math.random() * 0.5;
        }
        drops = nuevasGotas;
        speeds = nuevasVelocidades;

        if (ctx) {
            ctx.fillStyle = '#030603';
            ctx.fillRect(0, 0, w, h);
        }
    }

    function dibujar() {
        if (!ctx || !canvas) return;

        // Estela oscura semitransparente que genera el desvanecimiento progresivo
        ctx.fillStyle = 'rgba(3, 6, 3, 0.08)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = `${FONT_SIZE}px monospace`;

        const numColumnas = drops.length;
        const maxFilas = Math.ceil(canvas.height / FONT_SIZE);

        for (let i = 0; i < numColumnas; i++) {
            const x = i * FONT_SIZE;
            const filaActual = Math.floor(drops[i]);

            if (filaActual >= 0 && filaActual <= maxFilas) {
                const y = filaActual * FONT_SIZE;
                const char = CHARS.charAt(Math.floor(Math.random() * CHARS.length));

                // Carácter punta de gota: blanco menta brillante
                ctx.fillStyle = '#cffff0';
                ctx.fillText(char, x, y);

                // Carácter anterior de la estela: verde Matrix puro
                if (filaActual > 0) {
                    const charEstela = CHARS.charAt(Math.floor(Math.random() * CHARS.length));
                    ctx.fillStyle = '#00ff66';
                    ctx.fillText(charEstela, x, y - FONT_SIZE);
                }
            }

            // Al superar el alto de pantalla, reiniciar aleatoriamente para flujo continuo
            if (filaActual > maxFilas && Math.random() > 0.975) {
                drops[i] = Math.floor(Math.random() * -10);
            }

            drops[i] += (speeds[i] || 1);
        }
    }

    function bucleAnimacion(timestamp) {
        if (!activo) return;
        animId = requestAnimationFrame(bucleAnimacion);

        const delta = timestamp - lastTime;
        if (delta > FRAME_INTERVAL) {
            lastTime = timestamp - (delta % FRAME_INTERVAL);
            dibujar();
        }
    }

    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (activo) ajustarDimensiones();
        }, 150);
    }

    function onVisibilityChange() {
        if (document.hidden) {
            if (animId) {
                cancelAnimationFrame(animId);
                animId = null;
            }
        } else {
            if (activo && !animId) {
                lastTime = performance.now();
                animId = requestAnimationFrame(bucleAnimacion);
            }
        }
    }

    function iniciar() {
        if (activo) return;
        getCanvas();
        if (!canvas || !ctx) return;

        activo = true;
        document.body.classList.add('matrix-active');
        _actualizarBtn(true);

        ajustarDimensiones();

        window.addEventListener('resize', onResize, { passive: true });
        document.addEventListener('visibilitychange', onVisibilityChange);

        lastTime = performance.now();
        animId = requestAnimationFrame(bucleAnimacion);
    }

    function detener() {
        if (!activo) return;
        activo = false;
        document.body.classList.remove('matrix-active');
        _actualizarBtn(false);

        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }

        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibilityChange);

        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    function _actualizarBtn(estado) {
        const btn = document.getElementById('btn-toggle-matrix');
        if (btn) btn.classList.toggle('btn-activo', estado);
    }

    function toggle() {
        if (activo) {
            detener();
        } else {
            iniciar();
        }
        return activo;
    }

    function estaActivo() {
        return activo;
    }

    window.MatrixRain = {
        iniciar,
        detener,
        toggle,
        estaActivo
    };
})();
