const API_KEY = 'lem_dc158e5ad3f4f6ee2de2905a222bfb68f61dd754'
const API_URL = 'https://api.lempi.lat/s/youtube'

let handler = async (m, { conn, text, usedPrefix }) => {
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
      {
        text: `🔎 Buscando en YouTube...\n\n> ${query}`
      },
      { quoted: m.raw }
    )

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

    const videos = data.datos.results.videos

    if (videos.length === 0) {
      return conn.sendMessage(
        m.chat,
        {
          text: `❌ No encontré resultados para: ${query}`
        },
        { quoted: m.raw }
      )
    }

    const resultados = videos.slice(0, 10)

    let mensaje =
      `╭━━━〔 🔎 YOUTUBE SEARCH 〕━━━╮\n` +
      `┃ 🔍 Búsqueda: ${query}\n` +
      `┃ 📊 Resultados: ${resultados.length}\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`

    resultados.forEach((video, index) => {
      mensaje +=
        `╭─〔 ${index + 1} 〕──────────\n` +
        `│ 🎬 *${video.title || 'Sin título'}*\n` +
        `│ 👤 Canal: ${video.channel || 'Desconocido'}\n` +
        `│ ⏱️ Duración: ${video.duration || 'Desconocida'}\n` +
        `│ 👁️ Vistas: ${video.views || 'Desconocidas'}\n` +
        `│ 📅 Publicado: ${video.published || 'Desconocido'}\n` +
        `│ 🔗 ${video.url || 'Sin URL'}\n` +
        `╰────────────────────\n\n`
    })

    mensaje += `🤖 Powered by Lempi API`

    await conn.sendMessage(
      m.chat,
      {
        text: mensaje
      },
      { quoted: m.raw }
    )

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
handler.command = ['yts', 'ytsearch']
handler.registro = false

module.exports = handler