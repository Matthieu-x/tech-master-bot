/**
 * plugins/pbotoff.js
 * -------------------------------------------------------
 * Apaga o prende el bot para el grupo donde se manda el
 * comando. Solo owner o admin del grupo pueden usarlo.
 *
 * Uso:
 *   {prefijo}bot on
 *   {prefijo}bot off
 *
 * OJO: este archivo SOLO define el comando para cambiar el
 * estado (guarda botOff en db.json). El gate real que
 * bloquea los demás comandos cuando botOff=true va en
 * handler.js -- mándamelo y lo agrego ahí para no romper
 * nada de lo que ya tienes.
 * -------------------------------------------------------
 */

const { guardarGrupo } = require('../lib/db')
const { tienePermiso } = require('../lib/permisos')
const dfail = require('../lib/dfail')

let handler = async (m, { conn, args }) => {
  if (!m.isGroup) {
    return conn.sendMessage(m.chat, { text: dfail('Esto solo funciona dentro de un grupo.') }, { quoted: m.raw })
  }

  const permitido = await tienePermiso(conn, m)
  if (!permitido) {
    return conn.sendMessage(m.chat, { text: dfail('Solo el owner o un admin del grupo puede apagar/prender el bot.') }, { quoted: m.raw })
  }

  const accion = (args[0] || '').toLowerCase()
  if (accion !== 'on' && accion !== 'off') {
    return conn.sendMessage(m.chat, { text: dfail(`Uso:\n> bot on\n> bot off`) }, { quoted: m.raw })
  }

  guardarGrupo(m.chat, { botOff: accion === 'off' })

  await conn.sendMessage(
    m.chat,
    {
      text: accion === 'on'
        ? `ꕥ\n> Bot encendido ✅ en este grupo.`
        : `ꕥ\n> Bot apagado ❌ en este grupo.\n> Solo owner/admin pueden volver a prenderlo con "bot on".`,
    },
    { quoted: m.raw }
  )
}

handler.help = ['bot on/off']
handler.tags = ['grupo']
handler.command = ['bot']

module.exports = handler
