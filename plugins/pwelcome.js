/**
 * plugins/pwelcome.js
 * -------------------------------------------------------
 * Activa/desactiva bienvenida y despedida para el grupo
 * donde se manda el comando. Solo owner o admin del grupo.
 *
 * Uso:
 *   {prefijo}welcome on / off
 *   {prefijo}bye on / off
 * -------------------------------------------------------
 */

const { guardarGrupo } = require('../lib/db')
const { tienePermiso } = require('../lib/permisos')
const dfail = require('../lib/dfail')

let handler = async (m, { conn, command, args }) => {
  if (!m.isGroup) {
    return conn.sendMessage(m.chat, { text: dfail('Esto solo funciona dentro de un grupo.') }, { quoted: m.raw })
  }

  const permitido = await tienePermiso(conn, m)
  if (!permitido) {
    return conn.sendMessage(m.chat, { text: dfail('Solo el owner o un admin del grupo puede usar esto.') }, { quoted: m.raw })
  }

  const accion = (args[0] || '').toLowerCase()
  if (accion !== 'on' && accion !== 'off') {
    return conn.sendMessage(
      m.chat,
      { text: dfail(`Uso:\n> ${command} on\n> ${command} off`) },
      { quoted: m.raw }
    )
  }

  const comandoNormalizado = String(command || '').toLowerCase()
  const campo = comandoNormalizado === 'bye' ? 'bye' : 'welcome'
  await guardarGrupo(m.chat, { [campo]: accion === 'on' })

  const nombreFeature = campo === 'welcome' ? 'Bienvenida' : 'Despedida'
  await conn.sendMessage(
    m.chat,
    { text: `ꕥ\n> ${nombreFeature} ${accion === 'on' ? 'activada ✅' : 'desactivada ❌'} en este grupo.` },
    { quoted: m.raw }
  )
}

handler.help = ['welcome on/off', 'bye on/off']
handler.tags = ['grupo']
handler.command = ['welcome', 'bye']

module.exports = handler
