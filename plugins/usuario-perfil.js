const { obtenerUsuario, numeroDeSender } = require('../lib/db')

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

  const texto =
    `╭━━━〔 👤 MI PERFIL 〕━━━╮\n` +
    `┃\n` +
    `┃ 👤 Nombre: ${usuario.nombre || 'Sin nombre'}\n` +
    `┃ 🎂 Edad: ${usuario.edad || 'No especificada'}\n` +
    `┃ 📱 Número: +${numero || 'Desconocido'}\n` +
    `┃ 🪙 MasterCoins: ${usuario.mastercoins ?? 0}\n` +
    `┃ 📅 Registro: ${fechaRegistro}\n` +
    `┃\n` +
    `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
    `✨ Selecciona una opción:`

  await conn.sendMessage(
    m.chat,
    {
      text: texto,
      footer: 'Tech Master Bot',
      buttons: [
        {
          text: '📋 Menú',
          id: `${usedPrefix}menu`
        },
        {
          text: '🏓 Ping',
          id: `${usedPrefix}ping`
        }
      ]
    },
    { quoted: m.raw }
  )
}

handler.help = ['perfil']
handler.tags = ['usuario']
handler.command = ['perfil', 'profile']

module.exports = handler