/**
 * plugins/reacciones.js
 * -------------------------------------------------------
 * Comandos de "reacciones" tipo anime (hug, kiss, slap, pat...)
 * usando la API pública de Delirius.
 *
 * Uso:
 *   .hug @usuario        -> envía un gif de abrazo mencionando a alguien
 *   .kiss                -> envía un gif de beso (sin mencionar a nadie)
 *   .reacciones          -> muestra la lista de reacciones disponibles
 *
 * NOTA IMPORTANTE:
 * La documentación de https://api.delirius.online/reactions se
 * renderiza con JavaScript en el navegador, así que no pude leer
 * desde aquí la lista "oficial" y en vivo de endpoints ni el
 * formato exacto de la respuesta JSON. Dejé abajo el listado más
 * común que usan las APIs de este estilo (asumiendo que cada
 * endpoint es BASE_API/<tipo> y responde algo como
 * { status: true, url: "https://..." }).
 *
 * Antes de usar en producción:
 *   1) Prueba un endpoint en el navegador o con curl, ej:
 *        curl https://api.delirius.online/reactions/hug
 *   2) Ajusta REACCIONES (agrega/quita tipos) según lo que
 *      realmente exista.
 *   3) Ajusta extraerUrl() si el JSON viene con otra estructura
 *      (por ejemplo data.data.url en vez de data.url).
 * -------------------------------------------------------
 */

const fetch = require('node-fetch') // si tu proyecto ya usa axios, puedes cambiarlo
const dfail = require('../lib/dfail')

const BASE_API = 'https://api.delirius.online/reactions'

// Lista de reacciones disponibles: comando -> { endpoint, emoji, texto de acción }
const REACCIONES = {
  hug:      { endpoint: 'hug',      emoji: '🤗', texto: 'abraza a' },
  kiss:     { endpoint: 'kiss',     emoji: '😘', texto: 'besa a' },
  pat:      { endpoint: 'pat',      emoji: '🤚', texto: 'acaricia a' },
  slap:     { endpoint: 'slap',     emoji: '✋', texto: 'abofetea a' },
  punch:    { endpoint: 'punch',    emoji: '👊', texto: 'golpea a' },
  poke:     { endpoint: 'poke',     emoji: '👉', texto: 'pica a' },
  cuddle:   { endpoint: 'cuddle',   emoji: '🥰', texto: 'se acurruca con' },
  bite:     { endpoint: 'bite',     emoji: '😬', texto: 'muerde a' },
  kill:     { endpoint: 'kill',     emoji: '🔪', texto: 'mata a' },
  kick:     { endpoint: 'kick',     emoji: '🦵', texto: 'patea a' },
  blush:    { endpoint: 'blush',    emoji: '😳', texto: 'se sonroja por' },
  cry:      { endpoint: 'cry',      emoji: '😭', texto: 'llora con' },
  dance:    { endpoint: 'dance',    emoji: '💃', texto: 'baila con' },
  laugh:    { endpoint: 'laugh',    emoji: '😂', texto: 'se ríe de' },
  smile:    { endpoint: 'smile',    emoji: '😄', texto: 'le sonríe a' },
  wave:     { endpoint: 'wave',     emoji: '👋', texto: 'saluda a' },
  wink:     { endpoint: 'wink',     emoji: '😉', texto: 'le guiña el ojo a' },
  highfive: { endpoint: 'highfive', emoji: '🙌', texto: 'choca la mano con' },
  handhold: { endpoint: 'handhold', emoji: '🤝', texto: 'toma de la mano a' },
  tickle:   { endpoint: 'tickle',   emoji: '🤭', texto: 'hace cosquillas a' },
}

/**
 * Intenta sacar la URL de la imagen/gif de la respuesta de la API,
 * probando las formas más comunes en las que suelen venir estos JSON.
 */
function extraerUrl(data) {
  return (
    data?.url ||
    data?.data?.url ||
    data?.data ||
    data?.result ||
    data?.result?.url ||
    null
  )
}

async function obtenerReaccion(tipo) {
  const respuesta = await fetch(`${BASE_API}/${tipo}`)
  if (!respuesta.ok) {
    throw new Error(`La API respondió con estado ${respuesta.status}`)
  }
  const data = await respuesta.json()
  const url = extraerUrl(data)
  if (!url) {
    throw new Error('No se encontró una URL de imagen/gif en la respuesta de la API')
  }
  return url
}

/**
 * Handler para el subcomando que muestra la lista de reacciones.
 */
async function mostrarLista(conn, m) {
  const lineas = Object.entries(REACCIONES).map(
    ([comando, info]) => `${info.emoji} *.${comando}*`
  )

  const texto =
    '📋 *Reacciones disponibles*\n\n' +
    lineas.join('\n') +
    '\n\n> Uso: responde o menciona a alguien junto con el comando.\n' +
    '> Ejemplo: *.hug @usuario*'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m.raw })
}

let handler = async (m, { conn, command, text, usedPrefix }) => {
  // .reacciones / .listareacciones -> muestra el menú
  if (command === 'reacciones' || command === 'listareacciones') {
    return mostrarLista(conn, m)
  }

  // Cualquier otro comando registrado (.hug, .kiss, etc.)
  const reaccion = REACCIONES[command]
  if (!reaccion) return // no debería pasar, pero por seguridad

  try {
    const url = await obtenerReaccion(reaccion.endpoint)

    // Si mencionaron a alguien o el mensaje es una respuesta, arma el texto de acción
    const mencionado =
      m.raw.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const autor = m.sender
    const destino = mencionado ? `@${mencionado.split('@')[0]}` : ''

    const caption = destino
      ? `${reaccion.emoji} @${autor.split('@')[0]} ${reaccion.texto} ${destino}`
      : `${reaccion.emoji} ${text || ''}`.trim()

    await conn.sendMessage(
      m.chat,
      {
        image: { url },
        caption,
        mentions: mencionado ? [autor, mencionado] : [autor],
      },
      { quoted: m.raw }
    )
  } catch (e) {
    console.log('Error obteniendo reacción:', e)
    await conn.sendMessage(
      m.chat,
      { text: dfail(`No se pudo obtener la reacción "${command}":\n> ${e.message}`) },
      { quoted: m.raw }
    )
  }
}

handler.help = ['reacciones', ...Object.keys(REACCIONES)]
handler.tags = ['fun']
handler.command = ['reacciones', 'listareacciones', ...Object.keys(REACCIONES)]

module.exports = handler
