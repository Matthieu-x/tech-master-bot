/**
 * plugins/reaccion.js
 * -------------------------------------------------------
 * Comandos de reacciones (gifs animados) usando la API
 * pública de Delirius: https://api.delirius.online/reactions/<tipo>
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

const BASE_API = 'https://api.delirius.online/reactions'

// Reacciones donde solo participa quien envía el comando
const REACCIONES_SOLO = {
  happy: { emoji: '😄', texto: 'está feliz' },
  cry: { emoji: '😢', texto: 'está llorando' },
  dance: { emoji: '💃', texto: 'está bailando' },
  blush: { emoji: '😳', texto: 'se sonrojó' },
  smile: { emoji: '😊', texto: 'sonríe' },
  angry: { emoji: '😠', texto: 'está enojado/a' },
  sad: { emoji: '😞', texto: 'está triste' },
  facepalm: { emoji: '🤦', texto: 'se dio una palmada en la cara' },
  smug: { emoji: '😏', texto: 'se siente superior' },
  run: { emoji: '🏃', texto: 'salió corriendo' },
}

// Reacciones dirigidas a otra persona (mención o cita)
const REACCIONES_PAREJA = {
  hug: { emoji: '🤗', texto: 'abrazó a' },
  kiss: { emoji: '😘', texto: 'besó a' },
  pat: { emoji: '🖐️', texto: 'acarició a' },
  slap: { emoji: '✋', texto: 'abofeteó a' },
  punch: { emoji: '👊', texto: 'golpeó a' },
  kill: { emoji: '🔪', texto: 'asesinó a' },
  poke: { emoji: '👉', texto: 'picó a' },
  cuddle: { emoji: '🥰', texto: 'acurrucó a' },
  bite: { emoji: '😬', texto: 'mordió a' },
  highfive: { emoji: '🙌', texto: 'chocó los cinco con' },
  handhold: { emoji: '🤝', texto: 'tomó de la mano a' },
  tickle: { emoji: '🤣', texto: 'le hizo cosquillas a' },
  kick: { emoji: '🦵', texto: 'pateó a' },
  lick: { emoji: '👅', texto: 'lamió a' },
  wave: { emoji: '👋', texto: 'saludó a' },
  stare: { emoji: '👀', texto: 'miró fijamente a' },
  wink: { emoji: '😉', texto: 'le guiñó el ojo a' },
  feed: { emoji: '🍽️', texto: 'alimentó a' },
  nom: { emoji: '😋', texto: 'devoró a' },
}

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

let handler = async (m, { conn, command }) => {
  const tipo = command.toLowerCase()
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
            `Menciona a alguien o responde su mensaje para usar .${tipo}\n` +
            `Ejemplo: .${tipo} @${numeroLegible(remitente)}`
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

handler.help = [
  ...Object.keys(REACCIONES_SOLO),
  ...Object.keys(REACCIONES_PAREJA).map((c) => `${c} @tag`),
]
handler.tags = ['reacciones']
handler.command = [...Object.keys(REACCIONES_SOLO), ...Object.keys(REACCIONES_PAREJA)]

module.exports = handler
