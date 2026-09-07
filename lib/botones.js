/**
 * lib/botones.js
 * -------------------------------------------------------
 * Helper reutilizable para enviar botones rápidos y listas
 * desplegables interactivas de WhatsApp, con el mismo formato
 * que ya usa plugins/pmenu.js (compatible con el fork de
 * Baileys del bot: github:russellxz/ultra-baileys).
 *
 * Los IDs que el usuario selecciona (botón o fila de lista)
 * ya los interpreta lib/serializar.js y llegan como m.text,
 * así que si el id empieza con el prefijo del bot (ej. "#ping")
 * se procesan solos como si el usuario hubiera escrito el
 * comando.
 * -------------------------------------------------------
 */

const SIMBOLO = 'ꕥ'
const MAX_BOTONES = 3

/**
 * Envía un mensaje con botones rápidos.
 * WhatsApp solo permite mostrar hasta 3 botones a la vez.
 *
 * @param {object} conn - socket de Baileys
 * @param {string} chat - jid del chat destino
 * @param {object} opciones
 * @param {string} opciones.texto - cuerpo del mensaje
 * @param {string} [opciones.footer] - pie del mensaje
 * @param {{ texto: string, id: string }[]} opciones.botones - botones a mostrar (máx. 3)
 * @param {object} [opciones.mensajeCitado] - m.raw del mensaje a citar
 * @param {string[]} [opciones.menciones] - jids a mencionar en el texto
 */
async function enviarBotones(conn, chat, opciones = {}) {
  const { texto, footer, botones, mensajeCitado, menciones } = opciones

  if (!texto) {
    throw new Error('enviarBotones requiere "texto"')
  }

  if (!Array.isArray(botones) || !botones.length) {
    throw new Error('enviarBotones requiere al menos un botón en "botones"')
  }

  if (botones.length > MAX_BOTONES) {
    console.log(`${SIMBOLO}\n> Aviso: WhatsApp solo muestra hasta ${MAX_BOTONES} botones, se recortó la lista.`)
  }

  const botonesFormateados = botones.slice(0, MAX_BOTONES).map((b, i) => {
    if (!b?.id) throw new Error(`El botón en la posición ${i} no tiene "id"`)
    return { text: b.texto || 'Opción', id: b.id }
  })

  return conn.sendMessage(
    chat,
    {
      text: texto,
      footer,
      buttons: botonesFormateados,
      ...(menciones ? { mentions: menciones } : {}),
    },
    mensajeCitado ? { quoted: mensajeCitado } : {}
  )
}

/**
 * Envía una lista desplegable interactiva.
 *
 * @param {object} conn - socket de Baileys
 * @param {string} chat - jid del chat destino
 * @param {object} opciones
 * @param {string} opciones.texto - cuerpo del mensaje
 * @param {string} [opciones.footer] - pie del mensaje
 * @param {string} [opciones.titulo] - título que aparece arriba de la lista
 * @param {string} [opciones.textoBoton] - texto del botón que abre la lista (ej. "Ver opciones")
 * @param {{ titulo?: string, filas: { titulo: string, id: string, descripcion?: string }[] }[]} opciones.secciones
 * @param {object} [opciones.mensajeCitado] - m.raw del mensaje a citar
 * @param {string[]} [opciones.menciones] - jids a mencionar en el texto
 */
async function enviarLista(conn, chat, opciones = {}) {
  const { texto, footer, titulo, textoBoton, secciones, mensajeCitado, menciones } = opciones

  if (!texto) {
    throw new Error('enviarLista requiere "texto"')
  }

  if (!Array.isArray(secciones) || !secciones.length) {
    throw new Error('enviarLista requiere al menos una sección en "secciones"')
  }

  const seccionesFormateadas = secciones.map((s, i) => {
    const filas = Array.isArray(s.filas) ? s.filas : []
    if (!filas.length) throw new Error(`La sección en la posición ${i} no tiene "filas"`)

    return {
      title: s.titulo || '',
      rows: filas.map((f, j) => {
        if (!f?.id) throw new Error(`La fila ${j} de la sección ${i} no tiene "id"`)
        return {
          title: f.titulo || 'Opción',
          rowId: f.id,
          description: f.descripcion || '',
        }
      }),
    }
  })

  return conn.sendMessage(
    chat,
    {
      text: texto,
      footer,
      title: titulo,
      buttonText: textoBoton || 'Ver opciones',
      sections: seccionesFormateadas,
      ...(menciones ? { mentions: menciones } : {}),
    },
    mensajeCitado ? { quoted: mensajeCitado } : {}
  )
}

module.exports = { enviarBotones, enviarLista }