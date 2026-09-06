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
      text,
      footer: 'Tech Master Bot',
      buttons: [
        {
          buttonId: `${usedPrefix}menu`,
          buttonText: {
            displayText: '📋 Menú'
          },
          type: 1
        },
        {
          buttonId: `${usedPrefix}ping`,
          buttonText: {
            displayText: '🏓 Ping'
          },
          type: 1
        }
      ],
      headerType: 1
    },
    { quoted: m.raw }
  )
}

handler.help = ['perfil']
handler.tags = ['general']
handler.command = ['perfil', 'profile']

module.exports = handler