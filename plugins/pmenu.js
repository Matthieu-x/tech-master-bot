/**
 * plugins/pmenu.js
 * -------------------------------------------------------
 * Muestra el menú del bot y los créditos. También sirve
 * de ejemplo de cómo mencionar de verdad al usuario:
 * usando su jid real en la propiedad "mentions".
 * -------------------------------------------------------
 */

const { botName, creators } = require('../settings')

let handler = async (m, { conn }) => {
  // Lista de créditos, saltando la vacante vacía
  const listaCreadores = creators
    .filter(c => c.nombre)
    .map(c => `> ${c.nombre} (${c.rol})`)
    .join('\n')

  // @numero se arma a partir del jid real del sender (m.sender)
  const numeroMencion = m.sender.split('@')[0]

  const texto =
    `ꕥ *${botName}*\n\n` +
    `Hola @${numeroMencion}, estos son los comandos disponibles:\n\n` +
    `> ${'{'}prefijo{'}'}ping - probar si el bot responde\n` +
    `> ${'{'}prefijo{'}'}menu - este menú\n\n` +
    `Creadores:\n${listaCreadores}`

  // "mentions" es lo que hace que la @mención sea real y clickeable en WhatsApp,
  // no solo texto plano con una @.
  await conn.sendMessage(
    m.chat,
    { text: texto, mentions: [m.sender] },
    { quoted: m.raw }
  )
}

handler.help = ['menu']
handler.tags = ['general']
handler.command = ['menu', 'help']

module.exports = handler
