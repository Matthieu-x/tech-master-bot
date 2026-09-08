const API_URL = 'https://api.lempi.lat/dl/ytv'
const API_KEY = 'lem_10b02e6bcce68b82f51252de9d9ec71125528d02'

let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Falta el enlace de YouTube*\n\n` +
          `📌 Uso:\n` +
          `${usedPrefix}ytv <url>\n\n` +
          `📝 Ejemplo:\n` +
          `${usedPrefix}ytv https://youtu.be/h_qaIfL9-UU`
      },
      { quoted: m.raw }
    )
  }

  const url = text.trim()

  if (
    !/^https?:\/\/(?:www\.)?(?:youtube\.com\/|youtu\.be\/)/i.test(url)
  ) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Enlace de YouTube inválido*\n\n` +
          `Solo se aceptan enlaces de:\n` +
          `• youtube.com\n` +
          `• youtu.be`
      },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `🎬 *DESCARGANDO VIDEO*\n\n` +
          `🔗 YouTube detectado\n` +
          `⏳ Procesando el video...\n\n` +
          `⚡ Espera un momento...`
      },
      { quoted: m.raw }
    )

    const endpoint =
      `${API_URL}?url=${encodeURIComponent(url)}` +
      `&apikey=${encodeURIComponent(API_KEY)}`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Tech-Master-Bot/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`API HTTP ${response.status}`)
    }

    const data = await response.json()

    if (
      !data.status ||
      !data.datos ||
      !data.datos.url
    ) {
      throw new Error(
        'La API no devolvió un video válido'
      )
    }

    const videoUrl = data.datos.url

    if (!/^https?:\/\//i.test(videoUrl)) {
      throw new Error(
        'La URL del video no es válida'
      )
    }

    const caption =
      `╭━━━〔 🎬 YOUTUBE VIDEO 〕━━━╮\n` +
      `┃\n` +
      `┃ 🎵 *${data.titulo || 'Video de YouTube'}*\n` +
      `┃\n` +
      `┃ 📺 Canal: ${data.canal || 'Desconocido'}\n` +
      `┃ ⏱️ Duración: ${data.duracion || 'Desconocida'}\n` +
      `┃ 🎞️ Calidad: ${data.datos.calidad || 'Desconocida'}\n` +
      `┃ 💾 Tamaño: ${data.datos.tamaño || 'Desconocido'}\n` +
      `┃ 📁 Formato: ${data.datos.extension || '.mp4'}\n` +
      `┃\n` +
      `┃ ⚡ *Descargado con Lempi API*\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━━━━━╯`

    await conn.sendMessage(
      m.chat,
      {
        video: {
          url: videoUrl
        },
        mimetype: 'video/mp4',
        fileName:
          data.datos.archivo ||
          'youtube-video.mp4',
        caption,
        ptt: false
      },
      { quoted: m.raw }
    )
  } catch (error) {
    console.error('[YTV]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Error descargando el video*\n\n` +
          `> ${error.message || 'Error desconocido'}\n\n` +
          `💡 La API puede estar temporalmente caída o el video no estar disponible.`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = [
  'ytv <url>'
]

handler.tags = [
  'descargas'
]

handler.command = [
  'ytv'
]

handler.registro = true

module.exports = handler