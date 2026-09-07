const { enviarLista } = require('../lib/botones')

const API_KEY = process.env.ORBIT_API_KEY || 'ORBIT-4096939993'
const API_URL = 'https://api-orbit-9doj.onrender.com/api/v1/search'

const TIEMPO_SELECCION_MS = 3 * 60 * 1000
const MAX_RESULTADOS = 10

if (!global.ytsBusquedasPendientes) global.ytsBusquedasPendientes = new Map()
const busquedasPendientes = global.ytsBusquedasPendientes

function limpiarBusquedasVencidas() {
  const ahora = Date.now()

  for (const [clave, valor] of busquedasPendientes) {
    if (!valor || ahora > valor.expira) {
      busquedasPendientes.delete(clave)
    }
  }
}

function claveBusqueda(m) {
  return `${m.chat}_${m.senderNumero || m.sender}`
}

async function buscarEnYoutube(query) {
  const url =
    `${API_URL}?apikey=${encodeURIComponent(API_KEY)}` +
    `&query=${encodeURIComponent(query)}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()

  if (
    !data ||
    data.status !== true ||
    !Array.isArray(data.results)
  ) {
    throw new Error('La API de Orbit no devolvió resultados válidos')
  }

  return data.results
}

function construirDetalleVideo(video) {
  const titulo = video.title || 'Sin título'
  const autor = video.author || 'Desconocido'
  const duracion = video.duration || 'Desconocida'
  const vistas = video.views || 'Desconocidas'
  const publicado = video.publishedAt || 'Desconocido'
  const url = video.url || `https://www.youtube.com/watch?v=${video.videoId}`

  return (
    `╭━━━〔 🎬 YOUTUBE 〕━━━╮\n` +
    `┃ 📌 Título: ${titulo}\n` +
    `┃ 👤 Canal: ${autor}\n` +
    `┃ ⏱️ Duración: ${duracion}\n` +
    `┃ 👁️ Vistas: ${vistas}\n` +
    `┃ 📅 Publicado: ${publicado}\n` +
    `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `🔗 ${url}\n\n` +
    `🆔 ID: ${video.videoId || 'Desconocido'}\n` +
    `🌐 Orbit API`
  )
}

async function enviarDetalle(conn, m, video) {
  const titulo = video.title || 'Sin título'
  const autor = video.author || 'Desconocido'
  const duracion = video.duration || 'Desconocida'
  const vistas = video.views || 'Desconocidas'
  const publicado = video.publishedAt || 'Desconocido'
  const url = video.url || `https://www.youtube.com/watch?v=${video.videoId}`

  const texto =
    `╭━━━〔 🎬 YOUTUBE 〕━━━╮\n` +
    `┃ 📌 ${titulo}\n` +
    `┃ 👤 ${autor}\n` +
    `┃ ⏱️ ${duracion}\n` +
    `┃ 👁️ ${vistas}\n` +
    `┃ 📅 ${publicado}\n` +
    `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `🔗 ${url}\n\n` +
    `🤖 Orbit API`

  if (video.thumbnail) {
    try {
      return await conn.sendMessage(
        m.chat,
        {
          image: { url: video.thumbnail },
          caption: texto
        },
        { quoted: m.raw }
      )
    } catch {
      return conn.sendMessage(
        m.chat,
        { text: texto },
        { quoted: m.raw }
      )
    }
  }

  return conn.sendMessage(
    m.chat,
    { text: texto },
    { quoted: m.raw }
  )
}

let handler = async (m, { conn, text, usedPrefix, command, args }) => {
  limpiarBusquedasVencidas()

  const comando = (command || '').toLowerCase()

  if (comando === 'ytsver') {
    const indice = Number(args[0])
    const clave = claveBusqueda(m)
    const pendiente = busquedasPendientes.get(clave)

    if (
      !pendiente ||
      Number.isNaN(indice) ||
      !pendiente.videos[indice]
    ) {
      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ Esa búsqueda expiró o no es válida.\n\n` +
            `> Usa ${usedPrefix}yts de nuevo.`
        },
        { quoted: m.raw }
      )
    }

    return enviarDetalle(
      conn,
      m,
      pendiente.videos[indice]
    )
  }

  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Escribe algo para buscar.\n\n` +
          `📌 Ejemplo:\n` +
          `${usedPrefix}yts Ozuna`
      },
      { quoted: m.raw }
    )
  }

  const query = text.trim()

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `🔎 Buscando en YouTube...\n\n` +
          `> ${query}`
      },
      { quoted: m.raw }
    )

    const videos = await buscarEnYoutube(query)

    if (videos.length === 0) {
      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ No encontré resultados para:\n` +
            `> ${query}`
        },
        { quoted: m.raw }
      )
    }

    const resultados = videos
      .filter(video => video && video.videoId)
      .slice(0, MAX_RESULTADOS)

    if (resultados.length === 0) {
      throw new Error('No se encontraron videos válidos')
    }

    const clave = claveBusqueda(m)

    busquedasPendientes.set(clave, {
      videos: resultados,
      expira: Date.now() + TIEMPO_SELECCION_MS
    })

    return enviarLista(conn, m.chat, {
      texto:
        `🔎 *Resultados para:* ${query}\n\n` +
        `🎬 Encontrados: ${resultados.length}`,
      footer: 'Selecciona un video · expira en 3 min',
      titulo: 'YouTube Search',
      textoBoton: 'Ver resultados',
      mensajeCitado: m.raw,
      secciones: [
        {
          titulo: `${resultados.length} resultado(s)`,
          filas: resultados.map((video, i) => {
            const titulo = video.title || 'Sin título'
            const autor = video.author || 'Desconocido'
            const duracion = video.duration || '?'

            return {
              titulo: titulo.slice(0, 60),
              id: `${usedPrefix}ytsver ${i}`,
              descripcion:
                `${autor.slice(0, 35)} · ${duracion}`
            }
          })
        }
      ]
    })
  } catch (error) {
    console.error('[YTS]', error)

    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Ocurrió un error al buscar en YouTube.\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = [
  'yts <búsqueda>',
  'ytsearch <búsqueda>'
]

handler.tags = ['search']

handler.command = [
  'yts',
  'ytsearch',
  'ytsver'
]

handler.registro = false

module.exports = handler