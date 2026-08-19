// ============================================================================
// TUTORIAL — TEXTOS Y CONTENIDO
// ============================================================================
// Este archivo contiene únicamente el contenido (textos, pasos, selectores)
// del tutorial guiado de la app. Toda la lógica que interpreta y muestra
// estos datos vive en app.js, dentro del módulo TutorialManager.
//
// Se carga antes que app.js y expone su contenido en window.TutorialTexts.
(function () {
    'use strict';

    window.TutorialTexts = {

        // ── Tutorial "Esenciales": repaso corto de las funciones principales ──
        pasosEsenciales: [
            {
                selector: '.header-profile-btn',
                titulo: 'Tu perfil',
                desc: 'Acá ves el perfil activo. Tocá este botón para cambiar de perfil, alternar el tema claro/oscuro o entrar a los Ajustes.'
            },
            {
                selector: '#stats-card',
                titulo: 'Resumen',
                desc: 'Esta tarjeta muestra tu progreso actual. Tocala para alternar entre la vista de Hoy y la de Semana.'
            },
            {
                selector: '#btn-agregar',
                titulo: 'Fichar',
                desc: 'Con este botón registrás tu entrada y tu salida. El reloj de al lado te permite marcar un Tiempo Fuera, como el almuerzo.'
            },
            {
                selector: '#icon-indicator-form',
                titulo: 'Registro manual',
                desc: 'Desplegá esta flecha para cargar o corregir un registro a mano, o para cargar varios días de una vez en modo rango.'
            },
            {
                selector: '#card-estadisticas .card-header-clickable',
                titulo: 'Estadísticas',
                desc: 'Consultá tus horas trabajadas, promedios y saldo por semana, mes o año. Tocá cada dato para ver el detalle.'
            },
            {
                selector: '#card-historico .card-header-clickable',
                titulo: 'Historial',
                desc: 'Acá están todos tus registros. Podés filtrarlos, verlos en calendario, deshacer/rehacer cambios y tocar uno para editarlo.'
            },
            {
                selector: '.header-profile-btn',
                titulo: '¡Listo!',
                desc: 'Eso es todo por ahora. Si querés volver a ver este recorrido, buscá el botón "Ver tutorial" dentro de Ajustes.'
            }
        ],

        // ── Tutorial "Completo": recorrido detallado, tarjeta por tarjeta ──
        // Cada paso puede pedir que el formulario esté abierto (requiereFormAbierto)
        // y/o que la tarjeta esté en un modo puntual ('normal' o 'lote') antes de
        // resaltarlo; TutorialManager se encarga de dejar la UI en ese estado.
        tarjetasCompleto: {
            registrar: {
                nombre: 'Fichar',
                cardSelector: '#card-registrar',
                pasos: [
                    {
                        selector: '#card-registrar', requiereFormAbierto: false,
                        titulo: 'Tarjeta Fichar',
                        desc: 'Es el corazón de la app: acá cargás tus jornadas, a mano día por día o en lote. Vamos a recorrer cada botón y campo, en modo Normal y en modo Lote.'
                    },
                    {
                        selector: '#btn-agregar', requiereFormAbierto: false,
                        titulo: 'Botón principal',
                        desc: 'Guarda el registro con los datos cargados en el formulario. Su texto y color cambian según el modo y la situación: "Fichar", "Fichar Lote", "Borrar (3)", etc.'
                    },
                    {
                        selector: '#btn-timer-main', requiereFormAbierto: false,
                        titulo: 'Tiempo Fuera',
                        desc: 'Cronómetro para pausas como el almuerzo. Tocalo para iniciar el conteo y volvé a tocarlo para detenerlo: el tiempo se resta de la jornada de hoy. Necesita que ya exista un registro de hoy con entrada y sin salida.'
                    },
                    {
                        selector: '#icon-indicator-form', requiereFormAbierto: false,
                        titulo: 'Desplegar formulario',
                        desc: 'Esta flecha abre y cierra el formulario de carga. Lo vamos a abrir para ver cada campo en detalle.'
                    },
                    {
                        selector: '#fecha', requiereFormAbierto: true, modo: 'normal',
                        titulo: 'Fecha (modo Normal)',
                        desc: 'La fecha del registro que vas a cargar a mano. Por defecto es hoy, pero podés elegir cualquier otro día para completar jornadas pasadas.'
                    },
                    {
                        selector: '#btn-ir-modo-lote', requiereFormAbierto: true, modo: 'normal',
                        titulo: 'Ir a modo Lote',
                        desc: 'Cambia el formulario al modo Lote, pensado para feriados, vacaciones u otros días especiales, o para borrar varias jornadas normales de una fecha a otra.'
                    },
                    {
                        selector: '#entrada', requiereFormAbierto: true, modo: 'normal',
                        titulo: 'Entrada',
                        desc: 'Hora de entrada en formato hh:mm (por ejemplo 08:30). Es obligatoria para poder guardar el registro.'
                    },
                    {
                        selector: '#btn-pegar-entrada', requiereFormAbierto: true, modo: 'normal',
                        titulo: 'Pegar hora actual',
                        desc: 'Si el campo Entrada está vacío, lo completa con la hora actual. Si ya tiene un valor, lo vacía. Este mismo comportamiento se repite en los demás botones con ícono de reloj.'
                    },
                    {
                        selector: '#salida', requiereFormAbierto: true, modo: 'normal',
                        titulo: 'Salida',
                        desc: 'Hora de salida en formato hh:mm. Es opcional: podés fichar solo la entrada y cargar la salida más tarde, editando el registro desde el Historial.'
                    },
                    {
                        selector: '#btn-pegar-salida', requiereFormAbierto: true, modo: 'normal',
                        titulo: 'Pegar hora actual',
                        desc: 'Igual que en Entrada: pega la hora actual si el campo está vacío, o lo limpia si ya tiene un valor cargado.'
                    },
                    {
                        selector: '#lote-tipo', requiereFormAbierto: true, modo: 'lote',
                        titulo: 'Tipo de registro (modo Lote)',
                        desc: 'Elegí qué vas a cargar: un tipo especial (feriado, vacaciones, etc., según los que tengas configurados) o "Jornadas (borrar)" para eliminar registros normales dentro de un rango de fechas.'
                    },
                    {
                        selector: '#btn-ir-modo-normal', requiereFormAbierto: true, modo: 'lote',
                        titulo: 'Volver a modo Normal',
                        desc: 'Te lleva de nuevo al formulario simple de Entrada y Salida, para cargar un solo día a mano.'
                    },
                    {
                        selector: '#lote-fecha-desde', requiereFormAbierto: true, modo: 'lote',
                        titulo: 'Desde',
                        desc: 'Fecha inicial. Si completás solo este campo con un tipo especial elegido, se registra ese día puntual. Con "Jornadas (borrar)" además necesitás completar "Hasta".'
                    },
                    {
                        selector: '#btn-lote-desde', requiereFormAbierto: true, modo: 'lote',
                        titulo: 'Pegar hoy / Limpiar',
                        desc: 'Completa el campo Desde con la fecha de hoy, o lo limpia si ya tenía una fecha cargada.'
                    },
                    {
                        selector: '#lote-fecha-hasta', requiereFormAbierto: true, modo: 'lote',
                        titulo: 'Hasta',
                        desc: 'Fecha final del rango. Con un tipo especial, registra ese tipo en todos los días del rango sin pisar los que ya tengan otro registro. Con "Jornadas (borrar)", elimina todas las jornadas normales dentro del rango.'
                    },
                    {
                        selector: '#btn-lote-hasta', requiereFormAbierto: true, modo: 'lote',
                        titulo: 'Pegar hoy / Limpiar',
                        desc: 'Igual que el botón de Desde: completa Hasta con la fecha de hoy, o lo limpia si ya tenía un valor.'
                    },
                    {
                        selector: '#btn-agregar', requiereFormAbierto: true, modo: 'lote',
                        titulo: 'Fichar Lote',
                        desc: 'El mismo botón principal, ahora en modo Lote. Su texto va anticipando la acción: por ejemplo "Fichar (5)" para cargar 5 días, o "Borrar (3)" si vas a eliminar 3 jornadas normales del rango elegido.'
                    },
                    {
                        selector: '#card-registrar', requiereFormAbierto: true, modo: 'normal',
                        titulo: '¡Eso es todo!',
                        desc: 'Ya conocés todos los campos y botones de la tarjeta Fichar, en modo Normal y en modo Lote. Podés repetir cualquier tutorial cuando quieras desde Ajustes → Ayuda.'
                    }
                ]
            }
        },

        // ── Textos de los diálogos de confirmación del tutorial ──
        dialogoBienvenida: {
            texto: '¿Querés hacer un recorrido rápido por las funciones principales de la app?',
            labelOk: 'Sí, comenzar',
            icono: '#icon-help',
            opciones: { titulo: '¡Bienvenido a Horarios!', labelCancel: 'No, gracias' }
        },
        dialogoElegirTipo: {
            texto: 'El modo "Esenciales" es un repaso corto de lo más importante. El modo "Completo" explica en detalle cada campo y botón, tarjeta por tarjeta (por ahora solo la tarjeta Fichar).',
            labelOk: 'Completo (por tarjeta)',
            icono: '#icon-help',
            opciones: { titulo: '¿Qué tipo de tutorial querés?', labelCancel: 'Esenciales' }
        },

        // ── Mensajes (toasts) usados por la lógica del tutorial ──
        avisoTarjetaOculta: 'Esa tarjeta está oculta. Activala desde Ajustes para ver este tutorial.',
        avisoTarjetaNoDisponible: 'El tutorial completo de esa tarjeta todavía no está disponible.'
    };
})();
