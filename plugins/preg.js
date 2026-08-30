/**
 * plugins/preg.js
 * -------------------------------------------------------
 * Registro obligatorio para poder usar los comandos del bot.
 * Uso: .reg Nombre.Edad   (ej: .reg Carlos.20)
 * Regala un saldo inicial de MASTERCOINS 🪙💱 al registrarse.
 * -------------------------------------------------------
 */

const { estaRegistrado, registrarUsuario } = require('../lib/db')
const dfail = require('../lib/dfail')

let handler = async (m, { conn, text, usedPrefix }) => {
  if (estaRegistrado(m)) {
    return conn.sendMessage(
      m.chat,
      { text: 'ꕥ\n> Ya estás registrado, no necesitas volver a hacerlo.' },
      { quoted: m.raw }
    )
  }

  const partes = (text || '').split('.')
  const nombre = partes[0]?.trim()
  const edadTexto = partes[1]?.trim()
  const edad = parseInt(edadTexto, 10)

  if (!nombre || !edadTexto || isNaN(edad)) {
    return conn.sendMessage(
      m.chat,
      { text: dfail(`Uso incorrecto.\n> Ejemplo: ${usedPrefix}reg Carlos.20`) },
      { quoted: m.raw }
    )
  }

  if (edad < 8 || edad > 90) {
    return conn.sendMessage(
      m.chat,
      { text: dfail('Ingresa una edad válida (entre 8 y 90).') },
      { quoted: m.raw }
    )
  }

  const usuario = registrarUsuario(m, nombre, edad)

  const texto =
    `ꕥ *¡Registro exitoso!* 🎉\n\n` +
    `> 👤 Nombre: ${usuario.nombre}\n` +
    `> 🎂 Edad: ${usuario.edad}\n` +
    `> 🪙💱 MASTERCOINS: ${usuario.mastercoins}\n\n` +
    `> Ya puedes usar todos los comandos del bot.`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m.raw })
}

handler.help = ['reg <nombre>.<edad>']
handler.tags = ['general']
handler.command = ['reg', 'register']
handler.registro = false // este comando es justamente para poder registrarse

module.exports = handler
