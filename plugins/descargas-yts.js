const { enviarLista } = require('../lib/botones')

const API_KEY = process.env.ORBIT_API_KEY || 'ORBIT-4096939993'
const API_URL = 'https://api-orbit-9doj.onrender.com/api/v1/search'

const TIEMPO_SELECCION_MS = 3 * 60 * 1000
const MAX_RESULTADOS = 10

if (!global.ytsBusquedasPendientes) {
  global.ytsBusquedasPendientes = new Map()
}

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

function construirDetalle(video) {
  const titulo = video.title || 'Sin título'
  const autor = video.author || 'Desconocido'
  const duracion = video.duration || 'Desconocida'
  const vistas = video.views || 'Desconocidas'
  const publicado = video.publishedAt || 'Desconocido'
  const url =
    video.url ||
    `https://www.youtube.com/watch?v=${video.videoId}`

  return (
    `╭━━━〔 🎬 YOUTUBE 〕━━━╮\n` +
    `┃ 📌 ${titulo}\n` +
    `┃ 👤 ${autor}\n` +
    `┃ ⏱️ ${duracion}\n` +
    `┃ 👁️ ${vistas}\n` +
    `┃ 📅 ${publicado}\n` +
    `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `🔗 ${url}\n\n` +
    `🎵 Audio: yta\n` +
    `🎬 Video: ytv`
  )
}

async function enviarSeleccion(conn, m, video, usedPrefix) {
  const titulo = video.title || 'Sin título'
  const autor = video.author || 'Desconocido'
  const duracion = video.duration || 'Desconocida'
  const vistas = video.views || 'Desconocidas'
  const url =
    video.url ||
    `https://www.youtube.com/watch?v=${video.videoId}`

  const texto =
    `╭━━━〔 🎬 YOUTUBE 〕━━━╮\n` +
    `┃ 📌 ${titulo}\n` +
    `┃ 👤 ${autor}\n` +
    `┃ ⏱️ ${duracion}\n` +
    `┃ 👁️ ${vistas}\n` +
    `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `🔗 ${url}\n\n` +
    `👇 Selecciona qué deseas descargar:`

  return enviarLista(conn, m.chat, {
    texto,
    footer: 'Orbit YouTube Search',
    titulo: 'Descargar YouTube',
    textoBoton: 'Opciones',
    mensajeCitado: m.raw,
    secciones: [
      {
        titulo: 'Descargas',
        filas: [
          {
            titulo: '🎵 Descargar Audio',
            id: `${usedPrefix}yta ${url}`,
            descripcion: 'Descargar como MP3'
          },
          {
            titulo: '🎬 Descargar Video',
            id: `${usedPrefix}ytv ${url}`,
            descripcion: 'Descargar como MP4'
          },
          {
            titulo: '🔗 Ver enlace',
            id: `${usedPrefix}yturl ${video.videoId}`,
            descripcion: 'Mostrar enlace de YouTube'
          }
        ]
      }
    ]
  })
}

let handler = async (
  m,
  { conn, text, usedPrefix, command, args }
) => {
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

    return enviarSeleccion(
      conn,
      m,
      pendiente.videos[indice],
      usedPrefix
    )
  }

  if (comando === 'yturl') {
    const videoId = args[0]

    if (!videoId) {
      return conn.sendMessage(
        m.chat,
        {
          text: `❌ No se encontró el ID del video.`
        },
        { quoted: m.raw }
      )
    }

    const url =
      `https://www.youtube.com/watch?v=${videoId}`

    return conn.sendMessage(
      m.chat,
      {
        text:
          `🔗 *Enlace de YouTube*\n\n` +
          `${url}`
      },
      { quoted: m.raw }
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
          `🔎 *Buscando en YouTube...*\n\n` +
          `> ${query}`
      },
      { quoted: m.raw }
    )

    const videos = await buscarEnYoutube(query)

    if (!videos.length) {
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

    if (!resultados.length) {
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
      footer:
        'Selecciona un video · expira en 3 minutos',
      titulo: 'YouTube Search',
      textoBoton: 'Ver resultados',
      mensajeCitado: m.raw,
      secciones: [
        {
          titulo:
            `${resultados.length} resultado(s)`,
          filas: resultados.map((video, i) => ({
            titulo:
              (video.title || 'Sin título')
                .slice(0, 60),
            id:
              `${usedPrefix}ytsver ${i}`,
            descripcion:
              `${(video.author || 'Desconocido').slice(0, 35)} · ${video.duration || '?'}`
          }))
        }
      ]
    })
  } catch (error) {
    console.error('[YTS]', error)

    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Ocurrió un error al buscar.\n\n` +
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
  'ytsver',
  'yturl'
]

handler.registro = false

module.exports = handler