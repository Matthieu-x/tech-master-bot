const { obtenerUsuario, numeroDeSender } = require('../lib/db')
const { generarTarjetaPerfil } = require('../lib/tarjetas')

// Sin sistema de niveles todavía: se deriva un "nivel" visual a partir
// del saldo de MasterCoins, solo para la tarjeta (no se guarda en la DB).
function calcularNivel(mastercoins) {
  return Math.floor((mastercoins || 0) / 200) + 1
}

let handler = async (m, { conn, usedPrefix }) => {
  const usuario = obtenerUsuario(m)
  const numero = numeroDeSender(m)

  if (!usuario) {
    return conn.sendMessage(
      m.chat,
      {
        text: `❌ No se pudo obtener tu perfil.`
      },
      { quoted: m.raw }
    )
  }

  let fechaRegistro = 'Desconocida'

  if (usuario.fechaRegistro) {
    const fecha = new Date(usuario.fechaRegistro)

    if (!isNaN(fecha.getTime())) {
      fechaRegistro = fecha.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }
  }

  const mastercoins = usuario.mastercoins ?? 0
  const nivel = calcularNivel(mastercoins)

  const caption =
    `╭━━━〔 👤 MI PERFIL 〕━━━╮\n` +
    `┃\n` +
    `┃ 👤 Nombre: ${usuario.nombre || 'Sin nombre'}\n` +
    `┃ 🎂 Edad: ${usuario.edad || 'No especificada'}\n` +
    `┃ 📱 Número: +${numero || 'Desconocido'}\n` +
    `┃ 📅 Registro: ${fechaRegistro}\n` +
    `┃\n` +
    `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
    `✨ Selecciona una opción:`

  const botones = [
    { text: '📋 Menú', id: `${usedPrefix}menu` },
    { text: '🏓 Ping', id: `${usedPrefix}ping` }
  ]

  try {
    const tarjeta = await generarTarjetaPerfil({
      conn,
      jid: m.sender,
      nombreUsuario: usuario.nombre || `+${numero}`,
      mastercoins,
      nivel,
    })

    await conn.sendMessage(
      m.chat,
      {
        image: tarjeta,
        caption,
        footer: 'Tech Master Bot',
        buttons: botones,
      },
      { quoted: m.raw }
    )
  } catch (e) {
    console.log(`ꕥ\n> Error generando tarjeta de perfil: ${e.message}`)
    await conn.sendMessage(
      m.chat,
      {
        text: caption,
        footer: 'Tech Master Bot',
        buttons: botones,
      },
      { quoted: m.raw }
    )
  }
}

handler.help = ['perfil']
handler.tags = ['usuario']
handler.command = ['perfil', 'profile']

module.exports = handler