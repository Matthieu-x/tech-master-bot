const { exec } = require('child_process')

let handler = async (m, { conn }) => {
  await conn.sendMessage(
    m.chat,
    { text: '🔄 Instalando dependencias y reiniciando el bot...' },
    { quoted: m.raw }
  )

  exec('npm install && pm2 restart all', (error, stdout, stderr) => {
    if (error) {
      console.error(error)
      return
    }

    console.log(stdout)
    console.error(stderr)
  })
}

handler.command = ['reload', 'reiniciar']
handler.tags = ['owner']
handler.help = ['reload']

module.exports = handler