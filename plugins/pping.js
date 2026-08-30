/**
 * plugins/pping.js
 * -------------------------------------------------------
 * Responde con la latencia real del bot: mide el tiempo
 * entre que llega el mensaje y el momento justo antes de
 * enviar la respuesta.
 * -------------------------------------------------------
 */

let handler = async (m, { conn }) => {
  const inicio = Date.now()

  // Enviamos un primer mensaje para poder medir el tiempo hasta este punto,
  // y luego lo editamos con el resultado final (efecto "midiendo...").
  const sent = await conn.sendMessage(
    m.chat,
    { text: 'ꕥ\n> Midiendo velocidad... 🏓' },
    { quoted: m.raw }
  )

  const latencia = Date.now() - inicio

  await conn.sendMessage(m.chat, {
    text: `ꕥ\n> Pong! 🏓\n> Velocidad: ${latencia} ms`,
    edit: sent.key,
  })
}

handler.help = ['ping']
handler.tags = ['general']
handler.command = ['ping']
handler.registro = false // probar si el bot responde no debería requerir registro

module.exports = handler
