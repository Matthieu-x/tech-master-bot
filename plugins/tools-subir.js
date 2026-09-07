const { downloadMediaMessage } = require('baileys')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const pino = require('pino')

const UGUU_URL = 'https://uguu.se/upload'
const MAX_SIZE = 200 * 1024 * 1024

function obtenerMensajeConMedia(m) {
  const contexto = m.raw?.message?.extendedTextMessage?.contextInfo
  const citado = contexto?.quotedMessage

  if (citado) {
    return {
      key: {
        remoteJid: m.chat,
        id: contexto.stanzaId,
        participant: contexto.participant
      },
      message: citado
    }
  }

  return m.raw
}

function detectarMedia(mensaje) {
  const message = mensaje?.message || {}

  if (message.imageMessage) {
    return {
      tipo: 'imagen',
      mime: message.imageMessage.mimetype || 'image/jpeg',
      nombre: 'imagen.jpg'
    }
  }

  if (message.videoMessage) {
    return {
      tipo: 'video',
      mime: message.videoMessage.mimetype || 'video/mp4',
      nombre: 'video.mp4'
    }
  }

  if (message.audioMessage) {
    return {
      tipo: 'audio',
      mime: message.audioMessage.mimetype || 'audio/mpeg',
      nombre: 'audio.mp3'
    }
  }

  if (message.documentMessage) {
    return {
      tipo: 'documento',
      mime: message.documentMessage.mimetype || 'application/octet-stream',
      nombre: message.documentMessage.fileName || 'archivo'
    }
  }

  if (message.stickerMessage) {
    return {
      tipo: 'sticker',
      mime: message.stickerMessage.mimetype || 'image/webp',
      nombre: 'sticker.webp'
    }
  }

  return null
}

function crearArchivoTemporal(nombre) {
  const extension = path.extname(nombre) || '.bin'

  return path.join(
    os.tmpdir(),
    `tech-master-${crypto.randomBytes(8).toString('hex')}${extension}`
  )
}

async function subirUguu(buffer, nombre, mime) {
  if (
    typeof FormData === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof fetch === 'undefined'
  ) {
    throw new Error(
      'Este servidor necesita Node.js 18 o superior'
    )
  }

  const form = new FormData()

  form.append(
    'files[]',
    new Blob(
      [buffer],
      {
        type: mime || 'application/octet-stream'
      }
    ),
    nombre
  )

  const response = await fetch(UGUU_URL, {
    method: 'POST',
    body: form,
    headers: {
      'User-Agent': 'Tech-Master-Bot/1.0'
    }
  })

  const texto = await response.text()

  let data

  try {
    data = JSON.parse(texto)
  } catch {
    throw new Error(
      `Uguu devolvió una respuesta inválida: ${texto || 'respuesta vacía'}`
    )
  }

  if (!response.ok) {
    throw new Error(
      `Uguu HTTP ${response.status}: ${
        data?.error ||
        data?.message ||
        texto ||
        'error desconocido'
      }`
    )
  }

  const url = data?.files?.[0]?.url

  if (!url) {
    throw new Error(
      data?.error ||
      data?.message ||
      'Uguu no devolvió una URL'
    )
  }

  return url
}

let handler = async (m, { conn, usedPrefix }) => {
  const mensajeConMedia = obtenerMensajeConMedia(m)
  const media = detectarMedia(mensajeConMedia)

  if (!media) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *No encontré ningún archivo*\n\n` +
          `📌 Envía una imagen, video, audio o documento con:\n\n` +
          `${usedPrefix}subir\n\n` +
          `También puedes responder a un archivo con:\n` +
          `${usedPrefix}subir`
      },
      { quoted: m.raw }
    )
  }

  const archivoTemporal = crearArchivoTemporal(media.nombre)

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `☁️ *Subiendo a Uguu...*\n\n` +
          `📦 Tipo: ${media.tipo}\n` +
          `📄 Archivo: ${media.nombre}\n` +
          `⏳ Espera un momento...`
      },
      { quoted: m.raw }
    )

    const buffer = await downloadMediaMessage(
      mensajeConMedia,
      'buffer',
      {},
      {
        logger: pino({ level: 'silent' }),
        reuploadRequest: conn.updateMediaMessage
      }
    )

    if (!buffer || !buffer.length) {
      throw new Error(
        'No se pudo descargar el archivo desde WhatsApp'
      )
    }

    if (buffer.length > MAX_SIZE) {
      throw new Error(
        'El archivo supera el límite de 200 MB'
      )
    }

    fs.writeFileSync(
      archivoTemporal,
      buffer
    )

    const url = await subirUguu(
      buffer,
      media.nombre,
      media.mime
    )

    await conn.sendMessage(
      m.chat,
      {
        text:
          `╭━━━〔 ☁️ UGUU 〕━━━╮\n` +
          `┃\n` +
          `┃ ✅ *ARCHIVO SUBIDO*\n` +
          `┃\n` +
          `┃ 📦 Tipo: ${media.tipo}\n` +
          `┃ 📄 ${media.nombre}\n` +
          `┃ 💾 Tamaño: ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n` +
          `┃\n` +
          `┃ 🔗 *URL DIRECTA:*\n` +
          `┃\n` +
          `┃ ${url}\n` +
          `┃\n` +
          `╰━━━━━━━━━━━━━━━━━━╯`
      },
      { quoted: m.raw }
    )
  } catch (error) {
    console.error('[SUBIR UGUU]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Error al subir el archivo*\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  } finally {
    try {
      if (fs.existsSync(archivoTemporal)) {
        fs.unlinkSync(archivoTemporal)
      }
    } catch {}
  }
}

handler.help = [
  'subir'
]

handler.tags = [
  'herramientas'
]

handler.command = [
  'subir',
  'uguu'
]

handler.registro = true

module.exports = handler