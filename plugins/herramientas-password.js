const crypto = require('crypto')
const dfail = require('../lib/dfail')
const { botName } = require('../settings')

const LONGITUD_DEFECTO = 16
const LONGITUD_MINIMA = 8
const LONGITUD_MAXIMA = 64
const CARACTERES = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-+='

function generarPassword(longitud) {
  let resultado = ''
  while (resultado.length < longitud) {
    resultado += CARACTERES[crypto.randomInt(0, CARACTERES.length)]
  }
  return resultado
}

function evaluarFortaleza(password) {
  let grupos = 0
  if (/[A-Z]/.test(password)) grupos++
  if (/[a-z]/.test(password)) grupos++
  if (/[0-9]/.test(password)) grupos++
  if (/[^A-Za-z0-9]/.test(password)) grupos++
  if (password.length >= 20 && grupos >= 3) return 'MUY FUERTE'
  if (password.length >= 12 && grupos >= 3) return 'FUERTE'
  if (password.length >= 10 && grupos >= 2) return 'BUENA'
  return 'MEDIA'
}

function crearBarra(password) {
  let grupos = 0
  if (/[A-Z]/.test(password)) grupos++
  if (/[a-z]/.test(password)) grupos++
  if (/[0-9]/.test(password)) grupos++
  if (/[^A-Za-z0-9]/.test(password)) grupos++
  return `${'◆'.repeat(Math.max(1, grupos))}${'◇'.repeat(4 - Math.max(1, grupos))}`
}

function mensajePassword(password, longitud, numeroMencion) {
  const seguridad = evaluarFortaleza(password)
  return [
    `ꕥ *${botName}*`,
    `❧ Hola @${numeroMencion}, aquí tienes tu contraseña segura`,
    '',
    '✰ *Generador de contraseñas*',
    '',
    '〄 *RESULTADO*',
    `> 🔐 *${password}*`,
    `> ✦ Longitud: *${longitud} caracteres*`,
    `> ✦ Seguridad: *${seguridad}*`,
    `> ✦ Nivel: ${crearBarra(password)}`,
    '',
    '𖣔 *Recomendaciones*',
    '> ࿇ No compartas esta contraseña',
    '> ࿇ No la reutilices en otras cuentas',
    '> ࿇ Guárdala en un gestor seguro',
    '',
    '> 💡 Ejemplo: #password 24',
  ].join('\n')
}

let handler = async (m, { conn, args }) => {
  const entrada = args[0]
  const longitud = entrada === undefined ? LONGITUD_DEFECTO : Number(entrada)

  if (!Number.isInteger(longitud) || longitud < LONGITUD_MINIMA || longitud > LONGITUD_MAXIMA) {
    return conn.sendMessage(
      m.chat,
      { text: dfail(`La longitud debe estar entre ${LONGITUD_MINIMA} y ${LONGITUD_MAXIMA}.\n> 💡 Ejemplo: password 20`) },
      { quoted: m.raw }
    )
  }

  const password = generarPassword(longitud)
  const numeroMencion = String(m.sender || '').split('@')[0]
  await conn.sendMessage(
    m.chat,
    { text: mensajePassword(password, longitud, numeroMencion), mentions: [m.sender] },
    { quoted: m.raw }
  )
}

handler.help = ['password [longitud]']
handler.tags = ['herramientas']
handler.command = ['password', 'pass']

module.exports = handler
