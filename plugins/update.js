/**
 * plugins/update.js
 * -------------------------------------------------------
 * Actualización manual del bot:
 *   1) git pull
 *   2) si package.json cambió en el pull -> npm install
 *   3) reinicia el proceso con pm2
 *
 * Solo puede ejecutarlo el/los número(s) definidos como owner
 * en ../settings (ajusta el nombre del export si el tuyo es
 * distinto, por ejemplo `owners` en vez de `owner`).
 * -------------------------------------------------------
 */

const { exec } = require('child_process')
const dfail = require('../lib/dfail')
const { owner } = require('../settings')

function ejecutar(comando, cwd) {
  return new Promise((resolve, reject) => {
    exec(comando, { cwd, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message))
      resolve(stdout.trim())
    })
  })
}

function esOwner(m) {
  // Usamos senderNumero (no sender) porque sender puede venir como
  // JID @lid en vez del número real -- ver comentario en index.js
  const numero = String(m.senderNumero || m.sender || '').split('@')[0]
  const listaOwners = Array.isArray(owner) ? owner : [owner]
  return listaOwners.map(String).includes(numero)
}

let handler = async (m, { conn }) => {
  if (!esOwner(m)) {
    return conn.sendMessage(
      m.chat,
      { text: dfail('Solo el owner del bot puede usar este comando.') },
      { quoted: m.raw }
    )
  }

  const proyecto = process.cwd()

  try {
    await conn.sendMessage(m.chat, { text: '🔄 Buscando actualizaciones...' }, { quoted: m.raw })

    const salidaPull = await ejecutar('git pull', proyecto)

    if (/already up to date/i.test(salidaPull) || /ya está actualizado/i.test(salidaPull)) {
      return conn.sendMessage(
        m.chat,
        { text: `✅ El bot ya está en la última versión.\n\n> ${salidaPull}` },
        { quoted: m.raw }
      )
    }

    let mensaje = `✅ *_Actualización descargada_*\n\n${salidaPull}\n`

    // Si package.json (o package-lock.json) cambió en este pull, reinstala dependencias
    const packageCambio = /package(-lock)?\.json/i.test(salidaPull)
    if (packageCambio) {
      await conn.sendMessage(m.chat, { text: '📦 package.json cambió, instalando dependencias...' }, { quoted: m.raw })
      await ejecutar('npm install', proyecto)
      mensaje += '\n📦 Dependencias actualizadas.\n'
    }

    mensaje += '\n♻️ Reiniciando el bot...'
    await conn.sendMessage(m.chat, { text: mensaje }, { quoted: m.raw })

    // process.env.pm2_id lo define pm2 automáticamente en el proceso que administra,
    // así reinicia exactamente esta instancia sin necesidad de saber su nombre.
    const idPm2 = process.env.pm2_id
    const comandoRestart = idPm2 ? `pm2 restart ${idPm2}` : 'pm2 restart all'

    // No esperamos la resolución: pm2 restart mata este proceso, así que
    // si hiciéramos await nunca llegaríamos a resolver la promesa.
    exec(comandoRestart, { cwd: proyecto })
  } catch (e) {
    console.log('Error actualizando el bot:', e)
    await conn.sendMessage(
      m.chat,
      { text: dfail(`Error actualizando el bot:\n> ${e.message}`) },
      { quoted: m.raw }
    )
  }
}

handler.help = ['update']
handler.tags = ['owner']
handler.command = ['update']

module.exports = handler
