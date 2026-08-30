const { botName, creators, prefijo } = require('../settings')

const IMAGEN_MENU = 'https://files.catbox.moe/TU_IMAGEN.jpg'

let handler = async (m, { conn }) => {
  const listaCreadores = creators
    .filter(c => c.nombre)
    .map(c => `> ✨ ${c.nombre} — ${c.rol}`)
    .join('\n')

  const numeroMencion = m.sender.split('@')[0]

  const texto =
    `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n` +
    `│   🌸 *${botName}* 🌸   │\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `👋 ¡Hola @${numeroMencion}! Aquí están los comandos disponibles:\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 *Información*\n` +
    `> ${prefijo}ping — Comprobar si estoy activo\n` +
    `> ${prefijo}menu — Mostrar este menú\n` +
    `> ${prefijo}infobot — Información del bot\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👨‍💻 *Creadores del proyecto*\n` +
    `${listaCreadores}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 *Consejo:* Escribe ${prefijo}help para ver todos los comandos\n` +
    `> ${botName} — Creado con 💚 por el equipo Tech Master`

  try {
    await conn.sendMessage(
      m.chat,
      {
        image: { url: IMAGEN_MENU },
        caption: texto,
        mentions: [m.sender]
      },
      { quoted: m.raw }
    )
  } catch (err) {
    await conn.sendMessage(
      m.chat,
      { text: texto, mentions: [m.sender] },
      { quoted: m.raw }
    )
  }
}

handler.help = ['menu']
handler.tags = ['general']
handler.command = ['menu', 'help', 'comandos']

module.exports = handler
