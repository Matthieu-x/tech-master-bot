const { REACCIONES_SOLO, REACCIONES_PAREJA } = require('../lib/reacciones-data')

let handler = async (m, { conn, usedPrefix }) => {
  const prefijo = usedPrefix || '.'

  const listaSolo = Object.keys(REACCIONES_SOLO).map((c) => `${prefijo}${c}`).join(', ')
  const listaPareja = Object.keys(REACCIONES_PAREJA).map((c) => `${prefijo}${c}`).join(', ')

  const texto =
    `〄 *_Reacciones disponibles_*\n\n` +
    `> *_Solo (no necesitas mencionar a nadie):_*\n${listaSolo}\n\n` +
    `> *_Con alguien (menciona o responde su mensaje):_*\n${listaPareja}`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m.raw })
}

handler.help = ['reacciones']
handler.tags = ['reacciones']
handler.command = ['reacciones']

module.exports = handler