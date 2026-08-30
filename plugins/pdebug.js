/**
 * plugins/pdebug.js
 * -------------------------------------------------------
 * Comando temporal de diagnóstico: muestra el JID crudo de
 * quien envía el mensaje. Sirve para confirmar si WhatsApp
 * está usando el formato clásico (numero@s.whatsapp.net) o
 * el nuevo @lid, que rompería la validación de owner basada
 * en el número de teléfono.
 * -------------------------------------------------------
 */

let handler = async (m, { conn }) => {
  const raw = m.raw

  const texto =
    `ꕥ *Diagnóstico de sender*\n\n` +
    `> m.sender: ${m.sender}\n` +
    `> key.participant: ${raw.key.participant || '(vacío)'}\n` +
    `> key.remoteJid: ${raw.key.remoteJid || '(vacío)'}\n` +
    `> participantAlt: ${raw.key.participantAlt || raw.key.participantPn || '(no existe)'}`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m.raw })
}

handler.help = ['debug']
handler.tags = ['general']
handler.command = ['debug']

module.exports = handler
