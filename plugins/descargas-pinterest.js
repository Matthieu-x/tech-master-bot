const API_KEY = 'ORBIT-3540596307'
const API_URL = 'https://api-orbit-9doj.onrender.com/api/v1/pinterest'
const IP = '186.2.144.215' 

let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `Debes escribir algo para buscar en Pinterest.\n\n` +
          `Ejemplo:\n` +
          `${usedPrefix}pinterest Goku black`
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
          `Buscando en Pinterest...\n\n` +
          `Consulta: ${query}`
      },
      { quoted: m.raw }
    )

    const apiUrl =
      `${API_URL}?apikey=${encodeURIComponent(API_KEY)}` +
      `&query=${encodeURIComponent(query)}`

    const response = await fetch(apiUrl, {
      headers: { 'X-Orbit-IP': IP }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (
      !data ||
      !data.status ||
      !Array.isArray(data.results) ||
      data.results.length === 0
    ) {
      throw new Error('No se encontraron resultados en Pinterest')
    }

    const pin =
      data.results[Math.floor(Math.random() * data.results.length)]

    if (!pin.image && !pin.video && !pin.gif) {
      throw new Error('El resultado no contiene contenido multimedia')
    }

    const title = pin.title || 'Sin título'
    const description =
      pin.description?.trim() || 'Sin descripción'

    const username =
      pin.pinner?.username || 'Desconocido'

    const fullName =
      pin.pinner?.full_name || 'Desconocido'

    const followers =
      pin.pinner?.follower_count ?? 0

    const caption =
      `╭━━━〔 PINTEREST 〕━━━╮\n` +
      `┃ Búsqueda: ${data.query || query}\n` +
      `┃ Título: ${title}\n` +
      `┃ Usuario: ${fullName}\n` +
      `┃ Cuenta: @${username}\n` +
      `┃ Seguidores: ${followers}\n` +
      `┃ Tipo: ${pin.type || 'image'}\n` +
      `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
      `${description}\n\n` +
      `ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴏʀʙɪᴛ`

    if (pin.video) {
      return await conn.sendMessage(
        m.chat,
        {
          video: { url: pin.video },
          mimetype: 'video/mp4',
          caption
        },
        { quoted: m.raw }
      )
    }

    if (pin.gif) {
      return await conn.sendMessage(
        m.chat,
        {
          video: { url: pin.gif },
          mimetype: 'video/mp4',
          caption
        },
        { quoted: m.raw }
      )
    }

    if (pin.image) {
      return await conn.sendMessage(
        m.chat,
        {
          image: { url: pin.image },
          caption
        },
        { quoted: m.raw }
      )
    }

    throw new Error('No se pudo obtener el contenido del pin')

  } catch (error) {
    console.error('[PINTEREST]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `No se pudo obtener el contenido de Pinterest.\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = ['pinterest <búsqueda>']
handler.tags = ['downloader']
handler.command = ['pinterest', 'pin', 'pinterestdl']
handler.registro = true

module.exports = handler