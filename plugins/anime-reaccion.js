const dfail = require('../lib/dfail')
const { REACCIONES_SOLO, REACCIONES_PAREJA } = require('../lib/reacciones-data')

const BASE_API = 'https://api.delirius.online/reactions'

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
handler.command = new RegExp(`^(${claves.join('|')})$`, 'i')