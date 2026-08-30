/**
 * plugins/psaldo.js
 * -------------------------------------------------------
 * Muestra el saldo de MASTERCOINS 🪙💱 del usuario.
 * -------------------------------------------------------
 */

const { obtenerUsuario } = require('../lib/db')

let handler = async (m, { conn }) => {
  const usuario = obtenerUsuario(m)

  const texto =
    `🪙💱 *MASTERCOINS*\n\n` +
    `> 👤 ${usuario.nombre}\n` +
    `> 💰 Saldo: ${usuario.mastercoins} MASTERCOINS`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m.raw })
}

handler.help = ['saldo']
handler.tags = ['economia']
handler.command = ['saldo', 'balance', 'mastercoins']

module.exports = handler
