/**
 * plugins/psticker.js
 * -------------------------------------------------------
 * Convierte una imagen o video en sticker de WhatsApp.
 * Funciona de dos formas:
 *   1) Enviando la imagen/video con el comando en el caption
 *   2) Respondiendo (citando) una imagen/video con .sticker
 *
 * Imágenes -> se convierten con "sharp" (rápido, sin ffmpeg).
 * Videos/GIFs -> se convierten con "ffmpeg" (debe estar
 * instalado en el sistema: sudo apt install ffmpeg -y).
 * -------------------------------------------------------
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const { exec } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const pino = require('pino')
const dfail = require('../lib/dfail')

const DURACION_MAX_SEGUNDOS = 6 // los stickers animados no deben durar mucho

function ejecutar(comando) {
  return new Promise((resolve, reject) => {
    exec(comando, { maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message))
      resolve(stdout)
    })
  })
}

/**
 * Si el mensaje es una respuesta (cita) a otro mensaje con media,
 * reconstruye un objeto de mensaje "descargable" a partir de esa cita.
 * Si no hay cita, asume que la media viene en el mensaje mismo.
 */
function obtenerMensajeConMedia(m) {
  const contexto = m.raw.message?.extendedTextMessage?.contextInfo
  const citado = contexto?.quotedMessage

  if (citado) {
    return {
      key: {
        remoteJid: m.chat,
        id: contexto.stanzaId,
        participant: contexto.participant,
      },
      message: citado,
    }
  }

  return m.raw
}

function detectarTipoMedia(mensaje) {
  if (mensaje.message?.imageMessage) return 'image'
  if (mensaje.message?.videoMessage) return 'video'
  if (mensaje.message?.stickerMessage) return 'sticker'
  return null
}

let handler = async (m, { conn }) => {
  const mensajeConMedia = obtenerMensajeConMedia(m)
  const tipo = detectarTipoMedia(mensajeConMedia)

  if (!tipo) {
    return conn.sendMessage(
      m.chat,
      { text: dfail('Envía una imagen o video con el comando, o responde a uno con .sticker') },
      { quoted: m.raw }
    )
  }

  let rutaEntrada, rutaSalida

  try {
    const buffer = await downloadMediaMessage(
      mensajeConMedia,
      'buffer',
      {},
      { logger: pino({ level: 'silent' }), reuploadRequest: conn.updateMediaMessage }
    )

    let webpBuffer

    if (tipo === 'sticker') {
      // Ya es un webp -> "reenviar" tal cual (sirve para re-etiquetar, por ejemplo)
      webpBuffer = buffer
    } else if (tipo === 'image') {
      const sharp = require('sharp')
      webpBuffer = await sharp(buffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp()
        .toBuffer()
    } else if (tipo === 'video') {
      const carpetaTemp = path.join(os.tmpdir(), 'tech-master-bot-stickers')
      fs.mkdirSync(carpetaTemp, { recursive: true })

      const id = crypto.randomBytes(6).toString('hex')
      rutaEntrada = path.join(carpetaTemp, `${id}-in.mp4`)
      rutaSalida = path.join(carpetaTemp, `${id}-out.webp`)

      fs.writeFileSync(rutaEntrada, buffer)

      await ejecutar(
        `ffmpeg -y -i "${rutaEntrada}" -t ${DURACION_MAX_SEGUNDOS} -vf ` +
        `"fps=10,scale=512:512:force_original_aspect_ratio=decrease,` +
        `pad=512:512:-1:-1:color=white@0.0,setsar=1" ` +
        `-loop 0 -preset default -an -vsync 0 -s 512:512 "${rutaSalida}"`
      )

      webpBuffer = fs.readFileSync(rutaSalida)
    }

    await conn.sendMessage(m.chat, { sticker: webpBuffer }, { quoted: m.raw })
  } catch (e) {
    console.log('Error creando sticker:', e)
    const pistaFfmpeg = tipo === 'video'
      ? '\n> Si el error menciona "ffmpeg" o "command not found", instálalo con: sudo apt install ffmpeg -y'
      : ''
    await conn.sendMessage(
      m.chat,
      { text: dfail(`Error creando el sticker:\n> ${e.message}${pistaFfmpeg}`) },
      { quoted: m.raw }
    )
  } finally {
    // limpieza de archivos temporales, sin importar si hubo error o no
    try { if (rutaEntrada) fs.unlinkSync(rutaEntrada) } catch {}
    try { if (rutaSalida) fs.unlinkSync(rutaSalida) } catch {}
  }
}

handler.help = ['sticker']
handler.tags = ['general']
handler.command = ['sticker', 's']

module.exports = handler
