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
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    })

    const body = await response.text()

    if (!response.ok) {
      console.error('Delirius YTS HTTP:', response.status)
      console.error('Delirius YTS respuesta:', body.slice(0, 2000))

      if (response.status === 451) {
        throw new Error(
          'Delirius rechazó la solicitud (HTTP 451). ' +
          'La API está bloqueando temporalmente esta petición.'
        )
      }

      throw new Error(
        `La API respondió con HTTP ${response.status}.`
      )
    }

    let data

    try {
      data = JSON.parse(body)
    } catch {
      throw new Error('La API devolvió una respuesta JSON inválida.')
    }

    if (!Array.isArray(data)) {
      throw new Error('La API devolvió un formato inesperado.')
    }

    return data
  } finally {
    clearTimeout(timer)
  }
}

function formatearVistas(vistas) {
  const numero = Number(vistas)

  if (!Number.isFinite(numero)) {
    return 'Desconocidas'
  }

  if (numero >= 1_000_000) {
    return `${(numero / 1_000_000).toFixed(1)} M`
  }

  if (numero >= 1_000) {
    return `${(numero / 1_000).toFixed(1)} K`
  }

  return String(numero)
}

function limpiarTexto(texto, max = 150) {
  return String(texto || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
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

    console.log(`YTS: buscando "${query}"`)
    console.log(`YTS URL: ${url}`)

    const resultados = await fetchJson(url)

    const videos = resultados
      .filter(video =>
        video &&
        video.type === 'video' &&
        video.videoId
      )
      .slice(0, MAX_RESULTADOS)

    if (!videos.length) {
      return conn.sendMessage(
        m.chat,
        {
          text: dfail(
            `No encontré resultados para:\n> ${query}`
          )
        },
        { quoted: m.raw }
      )
    }

    const lineas = videos.map((video, index) => {
      const titulo = limpiarTexto(
        video.title || 'Sin título',
        120
      )

      const autor = limpiarTexto(
        video.author?.name || 'Desconocido',
        60
      )

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
      `┃ 🔍 *${limpiarTexto(query, 100)}*\n` +
      `┃\n` +
      `${lineas
        .map(linea =>
          `┃ ${linea.replace(/\n/g, '\n┃ ')}`
        )
        .join('\n┃\n')}\n` +
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

    let mensaje

    if (error.name === 'AbortError') {
      mensaje = 'La API tardó demasiado en responder.'
    } else {
      mensaje = error.message || 'Error desconocido.'
    }

    await conn.sendMessage(
      m.chat,
      {
        text: dfail(
          `No se pudo realizar la búsqueda de YouTube:\n` +
          `> ${mensaje}`
        )
      },
      { quoted: m.raw }
    )
  }
}

handler.help = [
  'yts <búsqueda>',
  'ytsearch <búsqueda>',
  'youtube <búsqueda>'
]

handler.tags = ['downloader']

handler.command = [
  'yts',
  'ytsearch',
  'youtube'
]

module.exports = handler