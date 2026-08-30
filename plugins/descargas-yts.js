const dfail = require('../lib/dfail')

const API_URL = 'https://delirius-api-oficial.vercel.app/api/ytsearch'
const MAX_RESULTADOS = 5
const TIMEOUT_MS = 30000

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Tech-Master-Bot'
      }
    })

    if (!response.ok) {
      throw new Error(`La API respondió con HTTP ${response.status}.`)
    }

    const data = await response.json()

    if (!Array.isArray(data)) {
      throw new Error('La API devolvió una respuesta inválida.')
    }

    return data
  } finally {
    clearTimeout(timer)
  }
}

function formatearVistas(vistas) {
  const numero = Number(vistas)

  if (!Number.isFinite(numero)) return 'Desconocidas'

  if (numero >= 1_000_000) {
    return `${(numero / 1_000_000).toFixed(1)} M`
  }

  if (numero >= 1_000) {
    return `${(numero / 1_000).toFixed(1)} K`
  }

  return String(numero)
}

let handler = async (m, { conn, text, usedPrefix }) => {
  const query = String(text || '').trim()

  if (!query) {
    return conn.sendMessage(
      m.chat,
      {
        text: dfail(
          `Uso correcto:\n` +
          `> ${usedPrefix}yts nombre del video\n\n` +
          `Ejemplo:\n` +
          `> ${usedPrefix}yts funny cats`
        )
      },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(
      m.chat,
      {
        text: `🔎 Buscando en YouTube:\n> ${query}`
      },
      { quoted: m.raw }
    )

    const consulta = encodeURIComponent(query)
    const url = `${API_URL}?q=${consulta}`

    const resultados = await fetchJson(url)

    const videos = resultados
      .filter(video => video && video.type === 'video' && video.videoId)
      .slice(0, MAX_RESULTADOS)

    if (!videos.length) {
      return conn.sendMessage(
        m.chat,
        {
          text: dfail(`No encontré resultados para: ${query}`)
        },
        { quoted: m.raw }
      )
    }

    const lineas = videos.map((video, index) => {
      const titulo = video.title || 'Sin título'
      const autor = video.author?.name || 'Desconocido'
      const duracion =
        video.timestamp ||
        video.duration?.timestamp ||
        'Desconocida'

      const vistas = formatearVistas(video.views)

      return (
        `*${index + 1}.* ${titulo}\n` +
        `> 👤 ${autor}\n` +
        `> ⏱️ ${duracion} | 👁️ ${vistas} vistas`
      )
    })

    const mensaje =
      `╭━━━〔 🔎 YOUTUBE SEARCH 〕━━━╮\n` +
      `┃\n` +
      `┃ 🔍 *${query}*\n` +
      `┃\n` +
      `${lineas.map(linea => `┃ ${linea.replace(/\n/g, '\n┃ ')}`).join('\n┃\n')}\n` +
      `┃\n` +
      `┃ Responde con un número del *1 al ${videos.length}*.\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`

    await conn.sendMessage(
      m.chat,
      {
        text: mensaje
      },
      { quoted: m.raw }
    )

  } catch (error) {
    console.error('Error en YTS:', error)

    const mensaje =
      error.name === 'AbortError'
        ? 'La API tardó demasiado en responder.'
        : error.message

    await conn.sendMessage(
      m.chat,
      {
        text: dfail(
          `No se pudo realizar la búsqueda de YouTube:\n> ${mensaje}`
        )
      },
      { quoted: m.raw }
    )
  }
}

handler.help = ['yts <búsqueda>']
handler.tags = ['downloader']
handler.command = ['yts', 'ytsearch', 'youtube']

module.exports = handler