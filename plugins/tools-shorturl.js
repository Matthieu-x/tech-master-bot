let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Falta el enlace*\n\n` +
          `📌 Uso:\n` +
          `${usedPrefix}shorturl <enlace>\n\n` +
          `📝 Ejemplo:\n` +
          `${usedPrefix}shorturl https://google.com`
      },
      { quoted: m.raw }
    )
  }

  const url = text.trim()

  if (!/^https?:\/\/\S+$/i.test(url)) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Enlace inválido*\n\n` +
          `El enlace debe comenzar con:\n` +
          `https:// o http://`
      },
      { quoted: m.raw }
    )
  }

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `🔗 *Acortando enlace...*\n\n` +
          `⏳ Espera un momento...`
      },
      { quoted: m.raw }
    )

    const endpoint =
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`

    const response = await fetch(endpoint)

    if (!response.ok) {
      throw new Error(
        `TinyURL HTTP ${response.status}`
      )
    }

    const resultado = (await response.text()).trim()

    if (
      !resultado ||
      !/^https?:\/\/\S+$/i.test(resultado)
    ) {
      throw new Error(
        `TinyURL no devolvió un enlace válido: ${resultado || 'respuesta vacía'}`
      )
    }

    await conn.sendMessage(
      m.chat,
      {
        text:
          `╭━━━〔 🔗 SHORT URL 〕━━━╮\n` +
          `┃\n` +
          `┃ ✅ *ENLACE ACORTADO*\n` +
          `┃\n` +
          `┃ 🌐 Original:\n` +
          `┃ ${url}\n` +
          `┃\n` +
          `┃ 🔗 Corto:\n` +
          `┃ ${resultado}\n` +
          `┃\n` +
          `╰━━━━━━━━━━━━━━━━━━╯`
      },
      { quoted: m.raw }
    )
  } catch (error) {
    console.error('[SHORTURL]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Error al acortar el enlace*\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = [
  'shorturl <enlace>'
]

handler.tags = [
  'herramientas'
]

handler.command = [
  'shorturl',
  'short',
  'acortar'
]

handler.registro = true

module.exports = handler