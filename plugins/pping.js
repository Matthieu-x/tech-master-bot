/**
 * plugins/pping.js
 * -------------------------------------------------------
 * Plugin de ejemplo más simple posible: responde "pong".
 * Sirve como plantilla base para crear nuevos comandos.
 * -------------------------------------------------------
 */

let handler = async (m, { conn }) => {
  await conn.sendMessage(m.chat, { text: 'ꕥ\n> pong 🏓' }, { quoted: m.raw })
}

handler.help = ['ping']
handler.tags = ['general']
handler.command = ['ping']

module.exports = handler
