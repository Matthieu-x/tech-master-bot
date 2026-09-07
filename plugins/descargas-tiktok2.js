const API_KEY = 'ORBIT-UODSS'
const API_URL = 'https://api-orbit-9doj.onrender.com/api/v1/download/tiktok'

let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `Debes enviar un enlace de TikTok.\n\n` +
          `Ejemplo:\n` +
          `${usedPrefix}tiktok https://vm.tiktok.com/ZSqjVCUSw/`
      },
      { quoted: m.raw }
    )
  }

  const tiktokUrl = text.trim()

  if (
    !tiktokUrl.includes('tiktok.com/') &&
    !tiktokUrl.includes('vm.tiktok.com/')
  ) {
    return conn.sendMessage(
      m.chat,
      {
        text: `El enlace no parece ser un enlace válido de TikTok.`
      },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `Descargando video de TikTok...\n\n` +
          `Enlace: ${tiktokUrl}`
      },
      { quoted: m.raw }
    )

    const apiUrl =
      `${API_URL}?apikey=${encodeURIComponent(API_KEY)}` +
      `&url=${encodeURIComponent(tiktokUrl)}`

    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (
      !data ||
      !data.status ||
      !data.result
    ) {
      throw new Error('La API no devolvió un resultado válido')
    }

    const result = data.result

    const videoUrl =
      result.video ||
      result.download ||
      result.url ||
      result.videoUrl ||
      result.play

    if (!videoUrl) {
      throw new Error(
        'La API no devolvió la URL directa del video'
      )
    }

    const caption =
      `╭━━━〔 TIKTOK 〕━━━╮\n` +
      `┃ ID: ${result.id || 'Desconocido'}\n` +
      `┃ Descripción: ${result.desc || 'Sin descripción'}\n` +
      `┃ Comentarios: ${result.isTurnOffComment ? 'Desactivados' : 'Activados'}\n` +
      `┃ Publicidad: ${result.isADS ? 'Sí' : 'No'}\n` +
      `╰━━━━━━━━━━━━━━━━╯`

    await conn.sendMessage(
      m.chat,
      {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        caption
      },
      { quoted: m.raw }
    )

  } catch (error) {
    console.error('[TIKTOK]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `No se pudo descargar el video de TikTok.\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = ['tiktok <url>']
handler.tags = ['downloader']
handler.command = ['tiktok', 'tt', 'ttdl']
handler.registro = true

module.exports = handler