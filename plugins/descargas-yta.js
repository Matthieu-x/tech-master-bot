const API_KEY = process.env.ORBIT_API_KEY || 'ORBIT-4096939993'
const API_URL = 'https://api-orbit-9doj.onrender.com/api/v1/download/ytaudio'

let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Falta el enlace de YouTube*\n\n` +
          `📌 Ejemplo:\n` +
          `${usedPrefix}yta https://www.youtube.com/watch?v=8QkY_PDfAlE`
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
        text:
          `❌ *Enlace inválido*\n\n` +
          `> Envía un enlace válido de YouTube.`
      },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `🎵 *Descargando audio...*\n\n` +
          `> Espera un momento mientras proceso el video.`
      },
      { quoted: m.raw }
    )

    const apiUrl =
      `${API_URL}?apikey=${encodeURIComponent(API_KEY)}` +
      `&url=${encodeURIComponent(youtubeUrl)}`

    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`API HTTP ${response.status}`)
    }

    const data = await response.json()

    // ✅ CORRECCIÓN: Los datos están en la raíz, no en data.result
    if (
      !data ||
      data.status !== true ||
      !data.download_url
    ) {
      throw new Error('Orbit no devolvió un enlace de descarga válido')
    }

    const audioUrl = data.download_url
    const title = data.title || 'Audio de YouTube'

    const filename =
      `${title}`
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100) + '.mp3'

    // Opcional: Enviar información del audio
    await conn.sendMessage(
      m.chat,
      {
        text:
          `✅ *Audio descargado*\n\n` +
          `📌 *Título:* ${title}\n` +
          `⏱️ *Duración:* ${data.duration ? Math.floor(data.duration / 60) + ':' + String(data.duration % 60).padStart(2, '0') : 'N/A'}\n` +
          `🎵 *Formato:* ${data.format || 'mp3'}`
      },
      { quoted: m.raw }
    )

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: audioUrl },
        mimetype: 'audio/mpeg',
        fileName: filename,
        ptt: false
      },
      { quoted: m.raw }
    )
  } catch (error) {
    console.error('[YTA]', error)

    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *No se pudo descargar el audio*\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = ['yta <url>', 'ytaudio <url>']
handler.tags = ['downloader']
handler.command = ['yta', 'ytaudio']
handler.registro = true

module.exports = handler