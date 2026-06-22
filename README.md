## (Changelog)

### 260621
* **Fix:** Corrección en el *toggle* al modo lote (evita la transición abrupta en el primer uso).
* **Fix:** Se aplica de forma consistente la validacion de fecha futura para registro
regular, se aplicaba en editar registro pero no en la tarjeta de fichar.
* **Nuevo:** Se agrega un *popup* a los días sin registro en el calendario, con opciones para agregar registros regulares o especiales.
* **Mantenimiento:** Se mueve el chanelog del index al readme.md
* **Mejora:** Se agrega limpieza del estado error en campos de tarjeta fichar
* **Mejora:** Se agrega validacion de fecha futura en el popup sin registro, para ocultar
el boton de agregar registro regular.

### 260618
* **Mejora:** Cambios menores en los colores de los botones de edición y configuración.
* **Nuevo:** Se agrega un *popup* a cada `stat-item` con su descripción, y un *flag* opcional en "saldo" y "tiempo fuera" por mes y año.
* **Mejora:** Se incrementa la cantidad máxima de perfiles de 7 a 9, implementando una variable previamente definida pero sin uso.
* **Fix:** Corrección en el botón de crear perfil, vinculado a la implementación de la nueva variable.

### 260617
* **Mejora:** Se modifica la animación del calendario al cambiar de mes.
* **Nuevo:** Se agrega la opción para elegir cómo calcular el saldo anual de estadísticas (desde el primer registro del año o desde el primer día del año).
* **Fix:** Corrección en el cambio de mes con *swipe* en dispositivos móviles para garantizar una transición fluida sin bloqueos por animación.

### 260616
* **Nuevo:** Se agrega el módulo **FERIADOS AR MODULE** para la detección de días festivos y consulta para agregarlos al registro (funcionamiento *hardcodeado*).
* **Fix:** Corrección al restablecer el perfil; no se guardaba correctamente el estado en el `history manager`.

### 260611
* **Mejora:** La función de restablecer ahora persiste el *gist ID* y resetea la configuración de automatización.