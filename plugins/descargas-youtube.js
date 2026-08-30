const API_KEY = 'lem_dc158e5ad3f4f6ee2de2905a222bfb68f61dd754'
const API_URL = 'https://api.lempi.lat/dl/ytv'

let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Debes enviar un enlace de YouTube.\n\n` +
          `📌 Ejemplo:\n` +
          `${usedPrefix}ytv https://www.youtube.com/watch?v=ZFG0mHN-BNA`
      },
      { quoted: m.raw }
    )
  }

  const youtubeUrl = text.trim()

  if (
    !youtubeUrl.includes('youtube.com/') &&
    !youtubeUrl.includes('youtu.be/')
  ) {
    return conn.sendMessage(
      m.chat,
      {
        text: `❌ El enlace no parece ser un enlace válido de YouTube.`
      },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(
      m.chat,
      {
        text: `⏳ Descargando video...\n\n🔗 ${youtubeUrl}`
      },
      { quoted: m.raw }
    )

    const apiUrl =
      `${API_URL}?url=${encodeURIComponent(youtubeUrl)}` +
      `&apikey=${encodeURIComponent(API_KEY)}`

    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (
      !data ||
      !data.status ||
      !data.datos ||
      !data.datos.url
    ) {
      throw new Error('La API no devolvió el enlace de descarga')
    }

    const videoUrl = data.datos.url
    const filename =
      data.datos.archivo ||
      `${data.titulo || 'youtube'}.mp4`

    const caption =
      `╭━━━〔 🎬 YOUTUBE VIDEO 〕━━━╮\n` +
      `┃ 🎵 ${data.titulo || 'Sin título'}\n` +
      `┃ 👤 ${data.canal || 'Desconocido'}\n` +
      `┃ ⏱️ ${data.duracion || 'Desconocida'}\n` +
      `┃ 🎞️ Calidad: ${data.datos.calidad || 'Desconocida'}\n` +
      `┃ 💾 Tamaño: ${data.datos.tamaño || 'Desconocido'}\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━╯`

    await conn.sendMessage(
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
    console.error('[YTV]', error)

    await conn.sendMessage(
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

handler.help = ['ytv <url>']
handler.tags = ['downloader']
handler.command = ['ytv', 'ytvideo']
handler.registro = true

module.exports = handler