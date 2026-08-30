/**
 * plugins/pinfo.js
 * -------------------------------------------------------
 * Muestra información del estado del bot: tiempo activo,
 * uso de memoria, versión de Node, etc.
 * Sirve también como plugin de prueba para confirmar que
 * el AutoUpdate esté funcionando: se sube al repo y, sin
 * tocar la VPS, debería aparecer solo dentro de 5 minutos.
 * -------------------------------------------------------
 */

const { botName } = require('../settings')

function formatearTiempo(segundos) {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = Math.floor(segundos % 60)
  return `${h}h ${m}m ${s}s`
}

let handler = async (m, { conn }) => {
  const memoria = process.memoryUsage()
  const memoriaMB = (memoria.rss / 1024 / 1024).toFixed(1)
  const uptime = formatearTiempo(process.uptime())

  const texto =
    `ꕥ *${botName} — Info*\n\n` +
    `> ⏱️ Activo hace: ${uptime}\n` +
    `> 💾 Memoria (RSS): ${memoriaMB} MB\n` +
    `> ⚙️ Node.js: ${process.version}\n` +
    `> 📡 Plataforma: ${process.platform}\n\n` +
    `> ✅ Si ves este mensaje, el AutoUpdate funcionó correctamente.`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m.raw })
}

handler.help = ['info']
handler.tags = ['general']
handler.command = ['info', 'status']

module.exports = handler
