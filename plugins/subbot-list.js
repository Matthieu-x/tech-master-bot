const { eliminarSubbot } = require('../lib/subbots')
const { owner } = require('../settings')

let handler = async (m, { conn, args }) => {
  const numeroPropio = (m.senderNumero || m.sender).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
  const numerosOwner = owner.map(o => o[0].replace(/[^0-9]/g, ''))
  const esOwner = numerosOwner.includes(numeroPropio)

  let idObjetivo = numeroPropio

  if (args[0]) {
    if (!esOwner) {
      return conn.sendMessage(
        m.chat,
        { text: '❌ Solo puedes eliminar tu propio subbot (usa .delsubbot sin argumentos).' },
        { quoted: m.raw }
      )
    }
    idObjetivo = args[0].replace(/[^0-9]/g, '')
  }

  const eliminado = eliminarSubbot(idObjetivo)

  if (!eliminado) {
    return conn.sendMessage(m.chat, { text: '❌ No se encontró ese subbot.' }, { quoted: m.raw })
  }

  await conn.sendMessage(m.chat, { text: '🗑️ Subbot eliminado correctamente.' }, { quoted: m.raw })
}

handler.help = ['delsubbot', 'delsubbot <numero> (owner)']
handler.tags = ['subbot']
handler.command = ['delsubbot', 'unsubbot']

module.exports = handler