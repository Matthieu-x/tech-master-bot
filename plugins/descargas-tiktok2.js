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

  if (!/^(https?:\/\/)?([a-z0-9-]+\.)?tiktok\.com\//i.test(tiktokUrl)) {
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
        text: `Descargando video de TikTok...`
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
      data.status !== true ||
      !data.result ||
      !data.result.video
    ) {
      throw new Error('La API no devolvió información válida del video')
    }

    const result = data.result
    const video = result.video

    if (
      !Array.isArray(video.downloadAddr) ||
      video.downloadAddr.length === 0
    ) {
      throw new Error('La API no devolvió un enlace de descarga')
    }

    const videoUrl = video.downloadAddr[0]

    if (
      typeof videoUrl !== 'string' ||
      !/^https?:\/\//i.test(videoUrl)
    ) {
      throw new Error('El enlace de descarga no es válido')
    }

    const author = result.author || {}
    const statistics = result.statistics || {}

    const caption =
      `TIKTOK\n\n` +
      `Usuario: ${author.nickname || 'Desconocido'}\n` +
      `Cuenta: @${author.uniqueId || 'Desconocido'}\n` +
      `Me gusta: ${statistics.likeCount || 0}\n` +
      `Reproducciones: ${statistics.playCount || 0}\n` +
      `Compartidos: ${statistics.shareCount || 0}\n\n` +
      `${result.desc || 'Sin descripción'}`

    await conn.sendMessage(
      m.chat,
      {
        video: {
          url: videoUrl
        },
        mimetype: 'video/mp4',
        fileName: `tiktok-${result.id || Date.now()}.mp4`,
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