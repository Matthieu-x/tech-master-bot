let handler = async (m, { conn }) => {
  try {
    await conn.sendMessage(
      m.chat,
      {
        text: '🌸 *Buscando una waifu...* ⏳'
      },
      { quoted: m.raw }
    )

    const response = await fetch(
      'https://api.waifu.pics/sfw/waifu'
    )

    if (!response.ok) {
      throw new Error(
        `API HTTP ${response.status}`
      )
    }

    const data = await response.json()

    if (!data.url) {
      throw new Error(
        'La API no devolvió una imagen'
      )
    }

    await conn.sendMessage(
      m.chat,
      {
        image: {
          url: data.url
        },
        caption:
          `╭━━━〔 🌸 WAIFU 〕━━━╮\n` +
          `┃\n` +
          `┃ 💮 *Waifu aleatoria*\n` +
          `┃\n` +
          `┃ 🌸 Disfruta tu waifu\n` +
          `┃\n` +
          `╰━━━━━━━━━━━━━━━━━━╯`
      },
      { quoted: m.raw }
    )
  } catch (error) {
    console.error('[WAIFU]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *No pude obtener la waifu*\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = [
  'waifu'
]

handler.tags = [
  'anime'
]

handler.command = [
  'waifu'
]

handler.registro = true

module.exports = handler