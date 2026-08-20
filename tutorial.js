// ============================================================================
// TUTORIAL — TEXTOS Y CONTENIDO
// ============================================================================
// Este archivo contiene únicamente el contenido (textos, pasos, selectores)
// del tutorial guiado de la app. Toda la lógica que interpreta y muestra
// estos datos vive en app.js, dentro del módulo TutorialManager.

(function () {
    'use strict';

    window.TutorialTexts = {

        // ── Tutorial "Esenciales" ──
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

        // ── Tutorial "Completo" ──
        tarjetasCompleto: {
            estado: {
                nombre: 'Estado',
                cardSelector: '#stats-card',
                pasos: []
            },
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
                        selector: '#btn-timer-main', requiereFormAbierto: false, forzarVisible: true,
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
            },
            estadisticas: {
                nombre: 'Estadísticas',
                cardSelector: '#card-estadisticas',
                pasos: [
                    {
                        selector: '#card-estadisticas',
                        titulo: 'Tarjeta Estadísticas',
                        desc: 'Acá vas a encontrar tus horas trabajadas, promedios y saldo, calculados según el período que elijas. Vamos a recorrerla por partes.'
                    },
                    {
                        selector: '#btn-toggle-periodo',
                        titulo: 'Cambiar de vista',
                        desc: 'Este botón alterna entre vista Mensual, Anual y Semanal. Mirá cómo cambia.',
                        demoPeriodo: true
                    },
                    {
                        selector: '.stats-periodo-row select:not(.hidden)',
                        titulo: 'Elegí el período',
                        desc: 'Con este selector elegís qué mes, año o semana querés consultar, según la vista que tengas activa.'
                    },            
                    {
                        selector: '.stats-grid',
                        titulo: 'Los datos',
                        desc: 'Acá tenés el resumen: horas trabajadas, promedios, regularidad, saldo y más. Tocá cualquier dato para ver una explicación de qué significa y cómo se calcula.'
                    },
                    {
                        selector: '#btn-reporte',
                        titulo: 'Reporte',
                        desc: 'Genera un reporte descargable con el detalle del período que tengas seleccionado en ese momento.'
                    },
                    {
                        selector: '#card-estadisticas',
                        titulo: '¡Eso es todo!',
                        desc: 'Ya conocés la tarjeta de Estadísticas. Podés repetir cualquier tutorial cuando quieras desde Ajustes → Ayuda.'
                    }
                ]
            },
            historico: {
                nombre: 'Registros',
                cardSelector: '#card-historico',
                pasos: [
                    {
                        selector: '#card-historico',
                        titulo: 'Tarjeta Registros',
                        desc: 'Acá están todos tus registros: podés filtrarlos, verlos en lista o en calendario, deshacer/rehacer cambios y tocar cualquiera para editarlo. Vamos a recorrer cada botón.'
                    },
                    {
                        selector: '#btn-vista-calendario',
                        titulo: 'Vista lista o calendario',
                        desc: 'Alterna entre ver tus registros en una lista agrupada por mes, o marcados sobre un calendario. Mirá cómo cambia.',
                        demoVista: true
                    },
                    {
                        selector: '#btn-filtro',
                        titulo: 'Filtrar',
                        desc: 'Abre un filtro por rango de fechas y por tipo de registro. Mientras haya un filtro activo, este ícono queda resaltado; tocalo de nuevo para quitarlo.'
                    },
                    {
                        selector: '#btn-hist-restaurar',
                        titulo: 'Restaurar',
                        desc: 'Importa un backup que hayas exportado antes, para restaurar tus registros en este u otro dispositivo.'
                    },
                    {
                        selector: '#btn-hist-respaldar',
                        titulo: 'Respaldar',
                        desc: 'Exporta tus registros a un archivo que podés guardar o compartir, como backup o para pasarlos a otro dispositivo.'
                    },
                    {
                        selector: '#btn-undo',
                        titulo: 'Deshacer',
                        desc: 'Revierte el último cambio que hiciste: crear, editar o borrar un registro. También podés usar Ctrl+Z.'
                    },
                    {
                        selector: '#btn-redo',
                        titulo: 'Rehacer',
                        desc: 'Vuelve a aplicar un cambio que acabás de deshacer. También podés usar Ctrl+Y.'
                    },
                    {
                        selector: '#lista-registros:not(.hidden), #vista-calendario-historico:not(.hidden)',
                        titulo: 'Tus registros',
                        desc: 'Acá aparecen tus registros: agrupados por mes y año en la lista, o marcados día por día en el calendario. Tocá cualquiera para ver el detalle o editarlo.'
                    },
                    {
                        selector: '#card-historico',
                        titulo: '¡Eso es todo!',
                        desc: 'Ya conocés la tarjeta de Registros. Podés repetir cualquier tutorial cuando quieras desde Ajustes → Ayuda.'
                    }
                ]
            }
        },

        // ── Lista de opciones del modal "¿Qué querés aprender?" ──
        menuTutorial: [
            { key: 'esencial', label: 'Esencial', icono: '#icon-help' },
            { key: 'estado', label: 'Tarjeta de estado', icono: '#icon-dashboard' },
            { key: 'registrar', label: 'Tarjeta de fichaje', icono: '#icon-save' },
            { key: 'estadisticas', label: 'Tarjeta de estadísticas', icono: '#icon-stats' },
            { key: 'historico', label: 'Tarjeta de registros', icono: '#icon-list' }
        ],

        // ── Mensajes (toasts) usados por la lógica del tutorial ──
        avisoTarjetaOculta: 'Esa tarjeta está oculta. Activala desde Ajustes para ver este tutorial.',
        avisoTarjetaNoDisponible: 'El tutorial completo de esa tarjeta todavía no está disponible.'
    };
})();
