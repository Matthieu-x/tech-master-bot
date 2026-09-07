const QRCode = require('qrcode')

let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Falta el texto o enlace*\n\n` +
          `📌 Uso:\n` +
          `${usedPrefix}qr texto o enlace\n\n` +
          `📝 Ejemplo:\n` +
          `${usedPrefix}qr https://google.com`
      },
      { quoted: m.raw }
    )
  }

  try {
    const buffer = await QRCode.toBuffer(text, {
      type: 'png',
      width: 800,
      margin: 2,
      errorCorrectionLevel: 'M'
    })

    await conn.sendMessage(
      m.chat,
      {
        image: buffer,
        caption:
          `╭━━━〔 📱 QR 〕━━━╮\n` +
          `┃\n` +
          `┃ ✅ *Código QR generado*\n` +
          `┃\n` +
          `┃ 📝 Contenido:\n` +
          `┃ ${text}\n` +
          `┃\n` +
          `╰━━━━━━━━━━━━━━━━╯`
      },
      { quoted: m.raw }
    )
  } catch (error) {
    console.error('[QR]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Error generando el QR*\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = [
  'qr <texto>'
]

handler.tags = [
  'herramientas'
]

handler.command = [
  'qr'
]

handler.registro = true

module.exports = handler