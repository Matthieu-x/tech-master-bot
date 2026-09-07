const API_URL = 'https://api-orbit-9doj.onrender.com/api/v1/download/aptoide'
const API_KEY = 'ORBIT-4096939993'

let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Falta el nombre de la aplicación*\n\n` +
          `📌 Uso:\n` +
          `${usedPrefix}apk <nombre>\n\n` +
          `📝 Ejemplo:\n` +
          `${usedPrefix}apk WhatsApp\n\n` +
          `🔢 También puedes elegir un resultado:\n` +
          `${usedPrefix}apk WhatsApp 1`
      },
      { quoted: m.raw }
    )
  }

  const partes = text.trim().split(/\s+/)
  let index = 0

  if (/^\d+$/.test(partes[partes.length - 1])) {
    index = Number(partes.pop())
  }

  const query = partes.join(' ').trim()

  if (!query) {
    return conn.sendMessage(
      m.chat,
      {
        text: `❌ *Escribe el nombre de la aplicación.*`
      },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `🔎 *Buscando APK...*\n\n` +
          `📱 Aplicación: ${query}\n` +
          `⏳ Espera un momento...`
      },
      { quoted: m.raw }
    )

    const url =
      `${API_URL}?apikey=${encodeURIComponent(API_KEY)}` +
      `&query=${encodeURIComponent(query)}` +
      `&index=${index}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Tech-Master-Bot/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`API HTTP ${response.status}`)
    }

    const data = await response.json()

    if (!data.status || !Array.isArray(data.result) || !data.result.length) {
      throw new Error('No se encontraron aplicaciones')
    }

    const app = data.result[index]

    if (!app) {
      throw new Error(
        `No existe el resultado #${index + 1}. Hay ${data.result.length} resultados disponibles.`
      )
    }

    const descargas = Number(app.downloads || 0).toLocaleString('es-ES')
    const rating = app.rating ?? 0

    const caption =
      `╭━━━〔 📱 APK DOWNLOAD 〕━━━╮\n` +
      `┃\n` +
      `┃ 📲 *${app.name || 'Sin nombre'}*\n` +
      `┃\n` +
      `┃ 📦 Paquete: ${app.package || 'Desconocido'}\n` +
      `┃ 🔢 Versión: ${app.version || 'Desconocida'}\n` +
      `┃ 💾 Tamaño: ${app.size || 'Desconocido'}\n` +
      `┃ ⭐ Rating: ${rating}/5\n` +
      `┃ 📥 Descargas: ${descargas}\n` +
      `┃\n` +
      `┃ 🌐 Fuente: Aptoide\n` +
      `┃ 🔢 Resultado: ${index + 1}/${data.result.length}\n` +
      `┃\n` +
      `┃ 🔗 *DESCARGA APK:*\n` +
      `┃ ${app.downloadUrl || 'No disponible'}\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━━━━━╯`

    if (app.icon && /^https?:\/\//i.test(app.icon)) {
      await conn.sendMessage(
        m.chat,
        {
          image: {
            url: app.icon
          },
          caption
        },
        { quoted: m.raw }
      )
    } else {
      await conn.sendMessage(
        m.chat,
        {
          text: caption
        },
        { quoted: m.raw }
      )
    }
  } catch (error) {
    console.error('[APK]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Error buscando el APK*\n\n` +
          `🔎 Búsqueda: ${query}\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = [
  'apk <nombre>',
  'apk <nombre> <índice>'
]

handler.tags = [
  'descargas'
]

handler.command = [
  'apk',
  'aptoide'
]

handler.registro = true

module.exports = handler