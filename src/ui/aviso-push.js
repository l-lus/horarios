import { TimeUtils } from '../core/time-utils.js';
import { PushReminder } from '../services/push-reminder.js';
import { UICore } from './ui-core.js';
import { UINotificaciones } from './ui-notificaciones.js';

// ====================================================================
// AVISO PUSH — recordatorio discreto de la función de notificaciones
// ====================================================================
async function chequearYAvisar() {
    if (!PushReminder.avisoPendiente()) return;

    while (
        document.querySelector('.modal.show') ||
        document.body.classList.contains('config-onboarding')
    ) {
        await TimeUtils.esperar(2000);
    }

    if (!PushReminder.avisoPendiente()) return;

    PushReminder.consumirAviso();
    UICore.mostrarToast(
        'Podés habilitar las notificaciones de salida desde Ajustes o tocando este aviso',
        'info', 6000, null,
        () => UINotificaciones.abrirModalNotificaciones()
    );
}

export const AvisoPush = { chequearYAvisar };
