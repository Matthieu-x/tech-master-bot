/**
 * lib/permisos.js
 * -------------------------------------------------------
 * Chequeo de permisos: owner global (settings.js) o admin
 * del grupo actual. Se usa en comandos como welcome/bye y
 * bot on/off, que no son solo para el owner sino también
 * para admins de cada grupo.
 * -------------------------------------------------------
 */

const { owner } = require('../settings')

function limpiarNumero(numero) {
  return String(numero || '').replace(/[^0-9]/g, '')
}

function esOwner(senderNumero) {
  const limpio = limpiarNumero(senderNumero)
  return owner.some(o => limpiarNumero(o[0]) === limpio)
}

async function esAdminGrupo(conn, chat, senderNumero) {
  if (!chat.endsWith('@g.us')) return false
  try {
    const metadata = await conn.groupMetadata(chat)
    const numeroLimpio = limpiarNumero(senderNumero)
    const participante = metadata.participants.find(p => limpiarNumero(p.id) === numeroLimpio)
    return !!participante && (participante.admin === 'admin' || participante.admin === 'superadmin')
  } catch (e) {
    return false
  }
}

// true si es owner global O admin del grupo donde se mandó el mensaje
async function tienePermiso(conn, m) {
  if (esOwner(m.senderNumero)) return true
  return esAdminGrupo(conn, m.chat, m.senderNumero)
}

module.exports = { esOwner, esAdminGrupo, tienePermiso }
