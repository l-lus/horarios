import { el, fijar, mostrar, entonar, crearDuracion, pintarDuracion, crearDato, pintarDato, textoDia, tonoBanco } from './tarjeta-estilos-piezas.js';

// ====================================================================
// TARJETA DE ESTADO · diseño «Lista de filas»
// ====================================================================
// Parte de tarjeta-estilos.js (no lo importa).

export function crearFilas() {
    const raiz = el('div', 'est-filas');
    const cabecera = el('div', 'est-fila est-fila--cabecera');
    const etiqueta = el('span', 'est-fila-etiqueta est-fila-etiqueta--chica', 'Llevás trabajado');
    const grande = el('span', 'est-fila-grande');
    const duracion = crearDuracion('est-duracion--media');
    const emoji = el('span', 'est-emoji');
    const texto = el('span', 'est-fila-texto');
    grande.append(emoji, texto, duracion.raiz);
    cabecera.append(etiqueta, grande);
    raiz.append(cabecera);

    /** @type {Record<string, ReturnType<typeof crearDato>>} */
    const filas = {};
    const nueva = (id, rotulo) => {
        const f = crearDato(rotulo, 'est-fila');
        f.etiqueta.className = 'est-fila-etiqueta';
        f.valor.className = 'est-fila-valor';
        raiz.append(f.raiz);
        filas[id] = f;
        return f;
    };
    for (const [id, rotulo] of [['entrada', 'Entrada'], ['salida', 'Salida estimada'], ['conBanco', 'Salida con banco'], ['fuera', 'Tiempo fuera']]) nueva(id, rotulo);
    const dias = Array.from({ length: 7 }, (_, i) => nueva(`dia${i}`, ''));
    for (const [id, rotulo] of [['balance', 'Faltan'], ['banco', 'Banco de horas'], ['estado', 'Estado'], ['nota', 'Nota']]) nueva(id, rotulo);
    return { raiz, cabecera, etiqueta, emoji, texto, duracion, filas, dias };
}

export function pintarFilas(r, d) {
    r.raiz.dataset.tipo = d.tipo;
    const f = r.filas;
    for (const fila of Object.values(f)) mostrar(fila.raiz, false);
    const conTotal = d.tipo === 'registro' || d.tipo === 'semana';
    mostrar(r.duracion.raiz, conTotal);
    mostrar(r.emoji, d.tipo === 'especial');
    mostrar(r.texto, !conTotal);
    r.cabecera.dataset.color = d.tipo === 'especial' ? d.color : 'neutro';
    entonar(r.texto, d.tipo === 'espera' ? 'apagado' : 'neutro');

    const fila = (id, etiqueta, valor, tono) => { mostrar(f[id].raiz, true); pintarDato(f[id], etiqueta, valor, tono); };

    if (d.tipo === 'registro') {
        fijar(r.etiqueta, d.cerrado ? 'Trabajaste' : 'Llevás trabajado');
        pintarDuracion(r.duracion, d.trabajado);
        fila('entrada', 'Entrada', d.entrada);
        if (d.cerrado) fila('salida', 'Salida', d.salida);
        else if (d.salidaEstimada) fila('salida', 'Salida estimada', d.salidaEstimada);
        if (d.salidaBanco) fila('conBanco', 'Salida con banco', d.salidaBanco, tonoBanco(d.banco));
        if (d.tiempoFuera) fila('fuera', d.tiempoFuera.corriendo ? 'Tiempo fuera (en curso)' : 'Tiempo fuera', d.tiempoFuera.texto);
        if (d.balance) fila('balance', d.balance.etiqueta, d.balance.texto, d.balance.tono);
        if (d.banco) fila('banco', 'Banco de horas', d.banco.texto, tonoBanco(d.banco));
    } else if (d.tipo === 'semana') {
        fijar(r.etiqueta, d.abierta ? 'Llevás en la semana' : 'Total de la semana');
        pintarDuracion(r.duracion, d.trabajado);
        d.dias.forEach((dia, i) => {
            if (i >= r.dias.length) return;
            fila(`dia${i}`, dia.hoy ? `${dia.sigla} (hoy)` : dia.sigla, textoDia(dia));
            r.dias[i].valor.dataset.color = dia.color ?? 'neutro';
            r.dias[i].etiqueta.classList.add('est-fila-etiqueta--dia');
        });
        if (d.balance) fila('balance', d.balance.etiqueta, d.balance.texto, d.balance.tono);
        if (d.banco) fila('banco', 'Banco de horas', d.banco.texto, tonoBanco(d.banco));
    } else if (d.tipo === 'espera') {
        fijar(r.etiqueta, 'Llevás trabajado');
        fijar(r.texto, d.mensaje || '—');
        fila('entrada', 'Entrada', '--:--', 'apagado');
        fila('salida', 'Salida estimada', '--:--', 'apagado');
        fila('conBanco', 'Salida con banco', '--:--', 'apagado');
        if (d.banco) fila('banco', 'Banco de horas', d.banco.texto, tonoBanco(d.banco));
    } else {
        fijar(r.etiqueta, 'Hoy');
        fijar(r.emoji, d.emoji);
        fijar(r.texto, d.etiqueta);
        fila('estado', 'Estado', d.etiqueta);
        f.estado.valor.dataset.color = d.color;
        fila('nota', 'Nota', d.descripcion);
    }
}
