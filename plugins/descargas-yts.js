const { enviarLista } = require('../lib/botones')

const API_KEY = 'lem_dc158e5ad3f4f6ee2de2905a222bfb68f61dd754'
const API_URL = 'https://api.lempi.lat/s/youtube'

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

async function buscarEnYoutube(query) {
  const url =
    `${API_URL}?query=${encodeURIComponent(query)}` +
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

function construirDetalleVideo(video) {
  return (
    `╭━━━〔 🎬 YOUTUBE 〕━━━╮\n` +
    `┃ 📌 Título: ${video.title || 'Sin título'}\n` +
    `┃ 👤 Canal: ${video.channel || 'Desconocido'}\n` +
    `┃ ⏱️ Duración: ${video.duration || 'Desconocida'}\n` +
    `┃ 👁️ Vistas: ${video.views || 'Desconocidas'}\n` +
    `┃ 📅 Publicado: ${video.published || 'Desconocido'}\n` +
    `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `🔗 ${video.url || 'Sin URL'}\n\n` +
    `🤖 Powered by Lempi API`
  )
}

let handler = async (m, { conn, text, usedPrefix, command, args }) => {
  limpiarBusquedasVencidas()

  const comando = (command || '').toLowerCase()

  // Se dispara al tocar una fila de la lista: "#ytsver <indice>"
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

    return conn.sendMessage(
      m.chat,
      { text: construirDetalleVideo(pendiente.videos[indice]) },
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

    return enviarLista(conn, m.chat, {
      texto: `🔎 *Resultados para:* ${query}`,
      footer: 'Toca una opción para ver el detalle · expira en 3 min',
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
    })
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