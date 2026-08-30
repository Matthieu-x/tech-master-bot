/**
 * plugins/reaccion.js
 * -------------------------------------------------------
 * Dispara el gif correspondiente para cada reacción individual
 * (.hug, .kiss, .dance, etc.) usando la API pública de Delirius:
 * https://api.delirius.online/reactions/<tipo>
 *
 * handler.command es un RegExp (no un array) a propósito:
 * tu menu.js hace `!Array.isArray(plugin.command)` y salta el
 * archivo si no es array, así que este plugin queda oculto del
 * menú aunque los comandos sigan funcionando con normalidad.
 * El comando visible ".reacciones" vive en plugins/reacciones.js
 *
 * Hay dos tipos de reacción:
 *   - "Solo"    -> el usuario reacciona sin necesitar a nadie más
 *                  (ej: .cry, .dance, .happy)
 *   - "Pareja"  -> el usuario le hace algo a otra persona, ya sea
 *                  mencionándola (@numero) o respondiendo su mensaje
 *                  (ej: .hug @juan, respondiendo un msj con .slap)
 *
 * No requiere API key.
 * -------------------------------------------------------
 */

const dfail = require('../lib/dfail')
const { REACCIONES_SOLO, REACCIONES_PAREJA } = require('../lib/reacciones-data')

const BASE_API = 'https://api.delirius.online/reactions'

/**
 * Obtiene el JID de la persona "objetivo" de la reacción:
 * primero busca una mención (@numero), y si no hay, busca si
 * el comando fue enviado respondiendo (citando) a alguien.
 */
function obtenerObjetivo(m) {
  const contexto = m.raw.message?.extendedTextMessage?.contextInfo
  const mencionados = contexto?.mentionedJid

  if (mencionados && mencionados.length > 0) return mencionados[0]
  if (contexto?.participant) return contexto.participant

  return null
}

function numeroLegible(jid) {
  return jid ? jid.split('@')[0] : null
}

let handler = async (m, { conn, command, usedPrefix }) => {
  const tipo = command.toLowerCase()
  const prefijo = usedPrefix || '.'

  const esSolo = Object.prototype.hasOwnProperty.call(REACCIONES_SOLO, tipo)
  const info = esSolo ? REACCIONES_SOLO[tipo] : REACCIONES_PAREJA[tipo]

  const remitente = m.sender
  let objetivo = null

  if (!esSolo) {
    objetivo = obtenerObjetivo(m)
    if (!objetivo) {
      return conn.sendMessage(
        m.chat,
        {
          text: dfail(
            `Menciona a alguien o responde su mensaje para usar ${prefijo}${tipo}\n` +
            `Ejemplo: ${prefijo}${tipo} @${numeroLegible(remitente)}`
          ),
        },
        { quoted: m.raw }
      )
    }
  }

  try {
    const respuesta = await fetch(`${BASE_API}/${tipo}`)
    if (!respuesta.ok) throw new Error(`La API respondió con estado ${respuesta.status}`)

    const json = await respuesta.json()
    if (!json?.status || !json?.data?.url) {
      throw new Error('La API no devolvió un gif válido para esta reacción')
    }

    const caption = esSolo
      ? `@${numeroLegible(remitente)} ${info.texto} ${info.emoji}`
      : `@${numeroLegible(remitente)} ${info.texto} @${numeroLegible(objetivo)} ${info.emoji}`

    const mentions = esSolo ? [remitente] : [remitente, objetivo]

    await conn.sendMessage(
      m.chat,
      {
        video: { url: json.data.url },
        gifPlayback: true,
        caption,
        mentions,
      },
      { quoted: m.raw }
    )
  } catch (e) {
    console.log(`Error en reacción "${tipo}":`, e)
    await conn.sendMessage(
      m.chat,
      { text: dfail(`Error obteniendo la reacción "${tipo}":\n> ${e.message}`) },
      { quoted: m.raw }
    )
  }
}

const claves = [...Object.keys(REACCIONES_SOLO), ...Object.keys(REACCIONES_PAREJA)]

handler.help = [
  ...Object.keys(REACCIONES_SOLO),
  ...Object.keys(REACCIONES_PAREJA).map((c) => `${c} @tag`),
]
handler.tags = ['reacciones']
// RegExp a propósito (ver comentario arriba) para que menu.js lo ignore.
handler.command = new RegExp(`^(${claves.join('|')})$`, 'i')

module.exports = handler
