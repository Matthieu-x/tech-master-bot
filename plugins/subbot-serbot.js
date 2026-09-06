const { crearSubbot } = require('../lib/subbots')

let handler = async (m, { conn, args }) => {
  const primerArg = (args[0] || '').toLowerCase()

  let metodo = 'qr'
  let numeroVincular = null

  if (primerArg === 'code') {
    numeroVincular = (args[1] || '').replace(/[^0-9]/g, '')
    if (!numeroVincular) {
      return conn.sendMessage(
        m.chat,
        { text: '❌ Debes indicar el número.\n> Ejemplo: .serbot code 5219991234567' },
        { quoted: m.raw }
      )
    }
    metodo = 'code'
  } else if (/^\d{8,15}$/.test(primerArg)) {
    metodo = 'code'
    numeroVincular = primerArg
  } else {
    metodo = 'qr'
  }

  await crearSubbot({ conn, m, metodo, numeroVincular })
}

handler.help = ['serbot', 'serbot code <numero>']
handler.tags = ['subbot']
handler.command = ['serbot', 'subbot']

module.exports = handler