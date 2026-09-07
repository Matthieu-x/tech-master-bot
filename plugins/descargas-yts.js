const { enviarLista } = require('../lib/botones')

const API_KEY = 'lem_dc158e5ad3f4f6ee2de2905a222bfb68f61dd754'
const API_URL_SEARCH = 'https://api.lempi.lat/s/youtube'
const API_URL_YTV = 'https://api.lempi.lat/dl/ytv'

const TIEMPO_SELECCION_MS = 3 * 60 * 1000
const MAX_RESULTADOS = 10

// Los plugins se recargan (require.cache se limpia) en cada mensaje,
// así que un Map normal del módulo se resetearía antes de que el
// usuario llegue a tocar la lista. Usamos global para que sobreviva.
if (!global.ytsBusquedasPendientes) global.ytsBusquedasPendientes = new Map()
const busquedasPendientes = global.ytsBusquedasPendientes

function limpiarBusquedasVencidas() {
  const ahora = Date.now()
  for (const [clave, valor] of busquedasPendientes) {
    if (!valor || ahora > valor.expira) busquedasPendientes.delete(clave)
  }
}

function claveBusqueda(m) {
  return `${m.chat}_${m.senderNumero || m.sender}`
}

const TIEMPO_MAX_IMAGEN_MS = 15_000

function conTimeout(promesa, ms) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

function extraerVideoId(url) {
  const coincidencia = String(url || '').match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  return coincidencia ? coincidencia[1] : null
}

function obtenerMiniatura(video) {
  const directa =
    video.thumbnail ||
    video.thumb ||
    video.miniatura ||
    video.imagen ||
    video.image

  if (directa) return directa

  const id = extraerVideoId(video.url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

async function buscarEnYoutube(query) {
  const url =
    `${API_URL_SEARCH}?query=${encodeURIComponent(query)}` +
    `&apikey=${encodeURIComponent(API_KEY)}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()

  if (
    !data ||
    !data.status ||
    !data.datos ||
    !data.datos.results ||
    !Array.isArray(data.datos.results.videos)
  ) {
    throw new Error('La API no devolvió resultados válidos')
  }

  return data.datos.results.videos
}

async function descargarVideoYoutube(youtubeUrl) {
  const apiUrl =
    `${API_URL_YTV}?url=${encodeURIComponent(youtubeUrl)}` +
    `&apikey=${encodeURIComponent(API_KEY)}`

  const response = await fetch(apiUrl)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()

  if (!data || !data.status || !data.datos || !data.datos.url) {
    throw new Error('La API no devolvió el enlace de descarga')
  }

  return data
}

let handler = async (m, { conn, text, usedPrefix, command, args }) => {
  limpiarBusquedasVencidas()

  const comando = (command || '').toLowerCase()

  // Se dispara al tocar una fila de la lista: "#ytsver <indice>"
  // Descarga y manda el video directo, igual que .ytv
  if (comando === 'ytsver') {
    const indice = Number(args[0])
    const clave = claveBusqueda(m)
    const pendiente = busquedasPendientes.get(clave)

    if (!pendiente || Number.isNaN(indice) || !pendiente.videos[indice]) {
      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ Esa búsqueda expiró o no es válida.\n` +
            `> Usa ${usedPrefix}yts de nuevo.`
        },
        { quoted: m.raw }
      )
    }

    const video = pendiente.videos[indice]

    if (!video.url) {
      return conn.sendMessage(
        m.chat,
        { text: `❌ Ese resultado no tiene un enlace válido para descargar.` },
        { quoted: m.raw }
      )
    }

    try {
      await conn.sendMessage(
        m.chat,
        { text: `⏳ Descargando video...\n\n🎬 ${video.title || 'Sin título'}` },
        { quoted: m.raw }
      )

      const data = await descargarVideoYoutube(video.url)

      const videoUrl = data.datos.url
      const filename =
        data.datos.archivo ||
        `${data.titulo || video.title || 'youtube'}.mp4`

      const caption =
        `╭━━━〔 🎬 YOUTUBE VIDEO 〕━━━╮\n` +
        `┃ 🎵 ${data.titulo || video.title || 'Sin título'}\n` +
        `┃ 👤 ${data.canal || video.channel || 'Desconocido'}\n` +
        `┃ ⏱️ ${data.duracion || video.duration || 'Desconocida'}\n` +
        `┃ 🎞️ Calidad: ${data.datos.calidad || 'Desconocida'}\n` +
        `┃ 💾 Tamaño: ${data.datos.tamaño || 'Desconocido'}\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━╯`

      return conn.sendMessage(
        m.chat,
        {
          video: { url: videoUrl },
          mimetype: 'video/mp4',
          fileName: filename,
          caption
        },
        { quoted: m.raw }
      )
    } catch (error) {
      console.error('[YTS-VER]', error)

      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ No se pudo descargar el video.\n\n` +
            `> ${error.message || 'Error desconocido'}`
        },
        { quoted: m.raw }
      )
    }
  }

  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Escribe algo para buscar.\n\n` +
          `📌 Ejemplo:\n` +
          `${usedPrefix}yts William Luna`
      },
      { quoted: m.raw }
    )
  }

  const query = text.trim()

  try {
    await conn.sendMessage(
      m.chat,
      { text: `🔎 Buscando en YouTube...\n\n> ${query}` },
      { quoted: m.raw }
    )

    const videos = await buscarEnYoutube(query)

    if (videos.length === 0) {
      return conn.sendMessage(
        m.chat,
        { text: `❌ No encontré resultados para: ${query}` },
        { quoted: m.raw }
      )
    }

    const resultados = videos.slice(0, MAX_RESULTADOS)
    const clave = claveBusqueda(m)

    busquedasPendientes.set(clave, {
      videos: resultados,
      expira: Date.now() + TIEMPO_SELECCION_MS,
    })

    const miniatura = obtenerMiniatura(resultados[0])

    const datosLista = {
      texto: `🔎 *Resultados para:* ${query}`,
      footer: 'Toca una opción para descargar el video · expira en 3 min',
      titulo: 'YouTube Search',
      textoBoton: 'Ver resultados',
      mensajeCitado: m.raw,
      secciones: [
        {
          titulo: `${resultados.length} resultado(s)`,
          filas: resultados.map((video, i) => ({
            titulo: (video.title || 'Sin título').slice(0, 60),
            id: `${usedPrefix}ytsver ${i}`,
            descripcion: `${video.channel || 'Desconocido'} · ${video.duration || '?'}`,
          })),
        },
      ],
    }

    if (miniatura) {
      try {
        return await conTimeout(
          enviarLista(conn, m.chat, { ...datosLista, imagen: miniatura }),
          TIEMPO_MAX_IMAGEN_MS
        )
      } catch (error) {
        console.log(`[YTS] La miniatura tardó demasiado o falló (${error.message}), mandando la lista sin imagen.`)
      }
    }

    return enviarLista(conn, m.chat, datosLista)
  } catch (error) {
    console.error('[YTS]', error)

    await conn.sendMessage(
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

handler.help = ['yts <búsqueda>', 'ytsearch <búsqueda>']
handler.tags = ['search']
handler.command = ['yts', 'ytsearch', 'ytsver']
handler.registro = false

module.exports = handler