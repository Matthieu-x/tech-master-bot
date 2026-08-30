const API_KEY = 'yosoyyo_sk_qin39ynp'
const API_URL = 'https://apiyosoyyo-ofc.onrender.com/api/ytsearch'

let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Debes escribir algo para buscar.\n\n` +
          `📌 Ejemplo:\n` +
          `> ${usedPrefix}yts William Luna\n\n` +
          `> ${usedPrefix}yts funny cats`
      },
      { quoted: m.raw }
    )
  }

  const consulta = text.trim()

  try {
    await conn.sendMessage(
      m.chat,
      {
        text: `🔎 Buscando en YouTube...\n> ${consulta}`
      },
      { quoted: m.raw }
    )

    const url =
      `${API_URL}?q=${encodeURIComponent(consulta)}` +
      `&apiKey=${encodeURIComponent(API_KEY)}`

    const respuesta = await fetch(url)

    if (!respuesta.ok) {
      throw new Error(`API respondió con HTTP ${respuesta.status}`)
    }

    const datos = await respuesta.json()

    if (!datos || !Array.isArray(datos.result) || datos.result.length === 0) {
      return conn.sendMessage(
        m.chat,
        {
          text: `❌ No encontré resultados para: ${consulta}`
        },
        { quoted: m.raw }
      )
    }

    const resultados = datos.result.slice(0, 10)

    let textoResultado =
      `╭━━━〔 🔎 YOUTUBE SEARCH 〕━━━╮\n` +
      `┃ 🔍 Búsqueda: ${consulta}\n` +
      `┃ 📊 Resultados: ${resultados.length}\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`

    resultados.forEach((item, index) => {
      const vistas = Number(item.views || 0).toLocaleString('es-ES')

      textoResultado +=
        `*${index + 1}. ${item.title || 'Sin título'}*\n` +
        `👤 ${item.channelName || 'Desconocido'}\n` +
        `⏱️ ${item.duration || 'Desconocida'}\n` +
        `👁️ ${vistas} vistas\n` +
        `📅 ${item.publishedAgo || 'Desconocido'}\n` +
        `🔗 ${item.videoUrl || 'Sin URL'}\n\n`
    })

    textoResultado +=
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 YOSOYYO API`

    const primera = resultados[0]

    if (primera.thumbnailUrl) {
      await conn.sendMessage(
        m.chat,
        {
          image: { url: primera.thumbnailUrl },
          caption: textoResultado
        },
        { quoted: m.raw }
      )
    } else {
      await conn.sendMessage(
        m.chat,
        { text: textoResultado },
        { quoted: m.raw }
      )
    }

  } catch (error) {
    console.error('[YTS]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Error realizando la búsqueda.\n\n` +
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