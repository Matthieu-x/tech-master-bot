/**
 * plugins/update.js
 * -------------------------------------------------------
 * Actualización manual del bot:
 *   1) git fetch + compara HEAD local vs remoto
 *   2) si hay cambios -> git pull (+ npm install si package.json cambió)
 *   3) process.exit(0) -- pm2 (con su auto-restart por defecto) es
 *      quien levanta el proceso de nuevo, igual que en autoupdate.js
 *
 * Este archivo NO comparte código con lib/autoupdate.js a propósito
 * (para no tocar ese archivo). Por lo mismo, tiene su propio candado
 * "actualizando" independiente del que usa el autoupdate automático --
 * si ambos se disparan exactamente al mismo tiempo podrían pisarse.
 * Es un caso raro (tendrías que mandar .update justo en el segundo en
 * que corre el polling), pero es un trade-off de mantenerlos separados.
 *
 * Solo puede ejecutarlo el/los número(s) definidos como owner
 * en ../settings (ajusta el nombre del export si el tuyo es
 * distinto, por ejemplo `owners` en vez de `owner`).
 * -------------------------------------------------------
 */

const { exec } = require('child_process')
const path = require('path')
const dfail = require('../lib/dfail')
const { owner } = require('../settings')

const CARPETA_PROYECTO = path.join(__dirname, '..')

function ejecutar(comando) {
  return new Promise((resolve, reject) => {
    exec(comando, { cwd: CARPETA_PROYECTO, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message))
      resolve((stdout || '').trim())
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

let actualizando = false

let handler = async (m, { conn }) => {
  if (!esOwner(m)) {
    return conn.sendMessage(
      m.chat,
      { text: dfail('Solo el owner del bot puede usar este comando.') },
      { quoted: m.raw }
    )
  }

  if (actualizando) {
    return conn.sendMessage(
      m.chat,
      { text: '⏳ Ya hay una actualización en curso, espera a que termine.' },
      { quoted: m.raw }
    )
  }
  actualizando = true

  try {
    await conn.sendMessage(m.chat, { text: '🔄 Buscando actualizaciones...' }, { quoted: m.raw })

    await ejecutar('git fetch')

    const local = await ejecutar('git rev-parse HEAD')
    const remoto = await ejecutar('git rev-parse @{u}')

    if (local === remoto) {
      return await conn.sendMessage(
        m.chat,
        { text: '✅ El bot ya está en la última versión.' },
        { quoted: m.raw }
      )
    }

    const archivosCambiados = await ejecutar(`git diff --name-only ${local} ${remoto}`)
    const cambioPackageJson = archivosCambiados.split('\n').includes('package.json')

    const salidaPull = await ejecutar('git pull')

    let mensaje = `✅ *_Actualización descargada_*\n\n${salidaPull}\n`

    if (cambioPackageJson) {
      await conn.sendMessage(m.chat, { text: '📦 package.json cambió, instalando dependencias...' }, { quoted: m.raw })
      await ejecutar('npm install')
      mensaje += '\n📦 Dependencias actualizadas.\n'
    }

    mensaje += '\n♻️ Reiniciando el bot...'
    await conn.sendMessage(m.chat, { text: mensaje }, { quoted: m.raw })

    // Igual que autoupdate.js: salimos y dejamos que pm2 (con
    // auto-restart activado, su comportamiento por defecto) levante
    // el proceso de nuevo con los cambios ya aplicados.
    process.exit(0)
  } catch (e) {
    console.log('Error actualizando el bot:', e)
    await conn.sendMessage(
      m.chat,
      { text: dfail(`Error actualizando el bot:\n> ${e.message}`) },
      { quoted: m.raw }
    )
  } finally {
    actualizando = false
  }
}

handler.help = ['update']
handler.tags = ['owner']
handler.command = ['update']

module.exports = handler
