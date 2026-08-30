const dfail = require('../lib/dfail')

const INSTANCES = [
  'https://pipedapi.kavin.rocks'
]

const MAX_RESULTADOS = 5
const TIMEOUT_MS = 20000

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Tech-Master-Bot/1.0'
      }
    })

    const text = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
    }

    try {
      return JSON.parse(text)
    } catch {
      throw new Error('La API devolvió JSON inválido.')
    }
  } finally {
    clearTimeout(timer)
  }
}

async function buscarYouTube(query) {
  let ultimoError = null

  for (const instance of INSTANCES) {
    try {
      const url =
        `${instance}/search?` +
        `q=${encodeURIComponent(query)}` +
        `filter=videos`

      console.log(`YTS: usando ${instance}`)
      console.log(`YTS: búsqueda "${query}"`)

      const data = await fetchJson(url)

      if (!data || !Array.isArray(data.items)) {
        throw new Error('La respuesta de Piped no contiene resultados válidos.')
      }

      return data.items
        .filter(item => {
          return (
            item &&
            (
              item.type === 'stream' ||
              item.type === 'video' ||
              item.url
            )
          )
        })
        .slice(0, MAX_RESULTADOS)
        .map(item => {
          let videoId = item.url || ''

          if (videoId.includes('watch?v=')) {
            videoId = videoId.split('watch?v=')[1]
          }

          videoId = videoId.split('&')[0]

          return {
            videoId,
            url: videoId
              ? `https://www.youtube.com/watch?v=${videoId}`
              : '',
            title: item.title || 'Sin título',
            thumbnail:
              item.thumbnail ||
              item.thumbnailUrl ||
              '',
            duration:
              item.duration ||
              0,
            uploader:
              item.uploaderName ||
              item.uploader ||
              'Desconocido',
            views:
              item.views || 0,
            uploadedDate:
              item.uploadedDate || ''
          }
        })
        .filter(video => video.videoId)
    } catch (error) {
      ultimoError = error

      console.error(
        `Error usando Piped ${instance}:`,
        error.message
      )
    }
  }

  throw ultimoError || new Error('No hay instancias disponibles.')
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

function formatearDuracion(segundos) {
  const total = Number(segundos)

  if (!Number.isFinite(total) || total <= 0) {
    return 'Desconocida'
  }

  const horas = Math.floor(total / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const segundosRestantes = total % 60

  if (horas > 0) {
    return (
      `${horas}:` +
      `${String(minutos).padStart(2, '0')}:` +
      `${String(segundosRestantes).padStart(2, '0')}`
    )
  }

  return (
    `${minutos}:` +
    `${String(segundosRestantes).padStart(2, '0')}`
  )
}

function limpiarTexto(texto, limite = 120) {
  return String(texto || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite)
}

const handler = async (m, { conn, text, usedPrefix }) => {
  const query = String(text || '').trim()

  if (!query) {
    return conn.sendMessage(
      m.chat,
      {
        text: dfail(
          `Uso correcto:\n\n` +
          `> ${usedPrefix}yts nombre del video\n\n` +
          `Ejemplo:\n` +
          `> ${usedPrefix}yts William Luna`
        )
      },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `🔎 *Buscando en YouTube...*\n\n` +
          `> ${query}`
      },
      { quoted: m.raw }
    )

    const videos = await buscarYouTube(query)

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

    const resultados = videos.map((video, index) => {
      const titulo = limpiarTexto(video.title)
      const autor = limpiarTexto(video.uploader, 60)
      const duracion = formatearDuracion(video.duration)
      const vistas = formatearVistas(video.views)

      return (
        `*${index + 1}. ${titulo}*\n` +
        `> 👤 ${autor}\n` +
        `> ⏱️ ${duracion}\n` +
        `> 👁️ ${vistas} vistas\n` +
        `> 🔗 ${video.url}`
      )
    })

    const mensaje =
      `╭━━〔 🔎 YOUTUBE SEARCH 〕━━╮\n` +
      `┃\n` +
      `┃ 🔍 *${limpiarTexto(query, 100)}*\n` +
      `┃\n` +
      `${resultados
        .map(texto =>
          `┃ ${texto.replace(/\n/g, '\n┃ ')}`
        )
        .join('\n┃\n┃\n')}\n` +
      `┃\n` +
      `┃ 📌 Resultados: *${videos.length}*\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━━━╯`

    await conn.sendMessage(
      m.chat,
      {
        text: mensaje
      },
      { quoted: m.raw }
    )

  } catch (error) {
    console.error('Error en YTS:', error)

    let mensaje = error.message || 'Error desconocido.'

    if (error.name === 'AbortError') {
      mensaje = 'La API tardó demasiado en responder.'
    }

    await conn.sendMessage(
      m.chat,
      {
        text: dfail(
          `No se pudo realizar la búsqueda de YouTube.\n\n` +
          `> ${mensaje}`
        )
      },
      { quoted: m.raw }
    )
  }
}

handler.help = [
  'yts <búsqueda>',
  'ytsearch <búsqueda>'
]

handler.tags = ['downloader']

handler.command = [
  'yts',
  'ytsearch'
]

module.exports = handler