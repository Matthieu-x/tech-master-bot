const APIS = [
  {
    nombre: 'NekosBest',
    url: 'https://nekos.best/api/v2/waifu',
    obtener: data => data?.results?.[0]?.url
  },
  {
    nombre: 'Waifu.im',
    url: 'https://api.waifu.im/search',
    obtener: data => data?.images?.[0]?.url
  },
  {
    nombre: 'Waifu.pics',
    url: 'https://api.waifu.pics/sfw/waifu',
    obtener: data => data?.url
  }
]

async function obtenerWaifu() {
  const errores = []

  for (const api of APIS) {
    try {
      const controller = new AbortController()

      const timeout = setTimeout(() => {
        controller.abort()
      }, 10000)

      const response = await fetch(api.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Tech-Master-Bot/1.0',
          'Accept': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const url = api.obtener(data)

      if (!url || !/^https?:\/\//i.test(url)) {
        throw new Error('No devolvió una imagen válida')
      }

      return {
        url,
        api: api.nombre
      }
    } catch (error) {
      errores.push(`${api.nombre}: ${error.message}`)
    }
  }

  throw new Error(
    errores.join('\n')
  )
}

let handler = async (m, { conn }) => {
  try {
    await conn.sendMessage(
      m.chat,
      {
        text: '🌸 *Buscando una waifu...* ⏳'
      },
      { quoted: m.raw }
    )

    const resultado = await obtenerWaifu()

    await conn.sendMessage(
      m.chat,
      {
        image: {
          url: resultado.url
        },
        caption:
          `╭━━━〔 🌸 WAIFU 〕━━━╮\n` +
          `┃\n` +
          `┃ 💮 *Waifu aleatoria*\n` +
          `┃\n` +
          `┃ 🌐 Fuente: ${resultado.api}\n` +
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
          `Todas las APIs disponibles fallaron.\n\n` +
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