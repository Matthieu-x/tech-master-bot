/**
 * plugins/pdaily.js
 * -------------------------------------------------------
 * Recompensa diaria de MASTERCOINS 🪙💱 (una vez cada 24h
 * por usuario registrado).
 * -------------------------------------------------------
 */

const { leerDB, guardarDB, numeroDeSender } = require('../lib/db')

const RECOMPENSA_DIARIA = 50
const COOLDOWN_MS = 24 * 60 * 60 * 1000

let handler = async (m, { conn }) => {
  const db = leerDB()
  const numero = numeroDeSender(m)
  const usuario = db[numero]

  const ahora = Date.now()
  const ultimo = usuario.ultimoDaily || 0
  const restante = COOLDOWN_MS - (ahora - ultimo)

  if (restante > 0) {
    const horas = Math.floor(restante / 3600000)
    const minutos = Math.floor((restante % 3600000) / 60000)
    return conn.sendMessage(
      m.chat,
      { text: `ꕥ\n> Ya reclamaste tu recompensa diaria.\n> Vuelve en ${horas}h ${minutos}m.` },
      { quoted: m.raw }
    )
  }

  usuario.mastercoins = (usuario.mastercoins || 0) + RECOMPENSA_DIARIA
  usuario.ultimoDaily = ahora
  guardarDB(db)

  const texto =
    `🪙💱 *¡Recompensa diaria reclamada!*\n\n` +
    `> +${RECOMPENSA_DIARIA} MASTERCOINS\n` +
    `> Saldo actual: ${usuario.mastercoins} MASTERCOINS`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m.raw })
}

handler.help = ['daily']
handler.tags = ['economia']
handler.command = ['daily']

module.exports = handler
