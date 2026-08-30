/**
 * plugins/psavefile.js
 * -------------------------------------------------------
 * Comando de owner que permite crear un plugin nuevo
 * directo desde WhatsApp, sin tocar el servidor a mano.
 *
 * Uso:
 *   {prefijo}savefile nombre
 *   (pega el código del plugin debajo del nombre)
 *
 * Ejemplo real:
 *   #savefile saludo
 *   let handler = async (m, { conn }) => {
 *     await conn.sendMessage(m.chat, { text: 'Hola!' }, { quoted: m.raw })
 *   }
 *   handler.command = ['saludo']
 *   module.exports = handler
 *
 * Nota: "nombre" va SIN .js, el plugin le agrega la extensión solo.
 * handler.owner = true ya hace que handler.js bloquee a quien no sea owner,
 * así que aquí no hace falta chequear eso otra vez.
 * -------------------------------------------------------
 */

const fs = require('fs')
const path = require('path')
const dfail = require('../lib/dfail')

let handler = async (m, { conn, text, args }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      { text: dfail(`Uso:\n> savefile nombre\n> *_pega el código debajo del nombre_*`) },
      { quoted: m.raw }
    )
  }

  // Primera palabra = nombre del archivo, el resto = código del plugin
  const nombreRaw = args[0]
  const nombre = nombreRaw.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!nombre) {
    return conn.sendMessage(m.chat, { text: dfail('Nombre de archivo inválido.') }, { quoted: m.raw })
  }

  const codigo = text.slice(nombreRaw.length).trim()
  if (!codigo) {
    return conn.sendMessage(m.chat, { text: dfail('Falta el código a guardar debajo del nombre.') }, { quoted: m.raw })
  }

  const filePath = path.join(__dirname, `${nombre}.js`)
  const yaExistia = fs.existsSync(filePath)

  // Validación básica de sintaxis antes de guardar, para no tumbar el bot
  try {
    new Function(codigo)
  } catch (e) {
    return conn.sendMessage(m.chat, { text: dfail(`Error de sintaxis en el código:\n> ${e.message}`) }, { quoted: m.raw })
  }

  try {
    fs.writeFileSync(filePath, codigo, 'utf-8')

    // Limpia la caché para que handler.js lo cargue en el próximo mensaje
    delete require.cache[require.resolve(filePath)]

    await conn.sendMessage(
      m.chat,
      {
        text:
          `ꕥ *Plugin guardado*\n` +
          `> Nombre: ${nombre}.js\n` +
          `> Ruta: /plugins/${nombre}.js\n` +
          `> ${yaExistia ? 'Ya existía, se reemplazó ♻️' : 'Es nuevo, se creó 🆕'}\n` +
          `> Se carga solo, sin reiniciar el bot.`,
      },
      { quoted: m.raw }
    )
  } catch (e) {
    await conn.sendMessage(m.chat, { text: dfail(`Error al guardar el archivo:\n> ${e.message}`) }, { quoted: m.raw })
  }
}

handler.help = ['savefile <nombre>']
handler.tags = ['owner']
handler.command = ['savefile']
handler.owner = true

module.exports = handler
