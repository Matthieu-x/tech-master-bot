const { listarSubbots } = require('../lib/subbots')

let handler = async (m, { conn }) => {
  const subbots = listarSubbots()

  if (!subbots.length) {
    return conn.sendMessage(m.chat, { text: '📭 No hay subbots vinculados.' }, { quoted: m.raw })
  }

  const texto = subbots
    .map((s, i) => {
      let estado = '🔴 Desconectado'
      if (s.conectado) estado = '🟢 Conectado'
      else if (s.pendiente) estado = '🟡 Pendiente de vincular'
      return `${i + 1}. +${s.numero} — ${estado}`
    })
    .join('\n')

  await conn.sendMessage(m.chat, { text: `📋 Subbots:\n\n${texto}` }, { quoted: m.raw })
}

handler.help = ['subbots']
handler.tags = ['subbot']
handler.command = ['subbots', 'listsubbots']
handler.owner = true

module.exports = handler