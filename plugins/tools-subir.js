const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')

const CATBOX_URL = 'https://catbox.moe/user/api.php'
const MAX_SIZE = 200 * 1024 * 1024

function obtenerMensajeMedia(m) {
  if (m.quoted) return m.quoted
  return m
}

function obtenerMime(media) {
  return (
    media?.mimetype ||
    media?.msg?.mimetype ||
    media?.message?.documentMessage?.mimetype ||
    media?.message?.imageMessage?.mimetype ||
    media?.message?.videoMessage?.mimetype ||
    media?.message?.audioMessage?.mimetype ||
    ''
  )
}

function obtenerNombre(media, mime) {
  const nombre =
    media?.fileName ||
    media?.msg?.fileName ||
    media?.message?.documentMessage?.fileName

  if (nombre) return nombre

  const extension = mime.split('/')[1]?.split(';')[0] || 'bin'

  return `archivo.${extension}`
}

function obtenerExtension(nombre, mime) {
  const extension = path
    .extname(nombre || '')
    .replace('.', '')
    .toLowerCase()

  if (extension) return extension

  const mapa = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'application/pdf': 'pdf'
  }

  return mapa[mime] || 'bin'
}

function crearNombreTemporal(nombre, mime) {
  const extension = obtenerExtension(nombre, mime)

  return path.join(
    os.tmpdir(),
    `tech-master-${crypto.randomBytes(8).toString('hex')}.${extension}`
  )
}

function ejecutarCurl(archivo) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(
      'curl',
      [
        '-L',
        '--max-time',
        '180',
        '-sS',
        '-X',
        'POST',
        CATBOX_URL,
        '-F',
        'reqtype=file',
        '-F',
        `fileToUpload=@${archivo}`
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )

    let salida = ''
    let error = ''

    proceso.stdout.on('data', data => {
      salida += data.toString()
    })

    proceso.stderr.on('data', data => {
      error += data.toString()
    })

    proceso.on('error', reject)

    proceso.on('close', codigo => {
      if (codigo !== 0) {
        return reject(
          new Error(
            error || `curl terminó con código ${codigo}`
          )
        )
      }

      resolve(salida.trim())
    })
  })
}

let handler = async (m, { conn, usedPrefix }) => {
  const media = obtenerMensajeMedia(m)
  const mime = obtenerMime(media)

  if (!mime) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *No encontré ningún archivo*\n\n` +
          `📌 Envía o responde a una imagen, video, audio o documento con:\n\n` +
          `${usedPrefix}subir`
      },
      { quoted: m.raw }
    )
  }

  const nombre = obtenerNombre(media, mime)
  const temporal = crearNombreTemporal(nombre, mime)

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `☁️ *Subiendo archivo...*\n\n` +
          `📄 ${nombre}\n` +
          `📦 ${mime}`
      },
      { quoted: m.raw }
    )

    const buffer = await media.download()

    if (!buffer || !buffer.length) {
      throw new Error(
        'No se pudo descargar el archivo de WhatsApp'
      )
    }

    if (buffer.length > MAX_SIZE) {
      throw new Error(
        'El archivo supera el límite de 200 MB'
      )
    }

    fs.writeFileSync(temporal, buffer)

    const url = await ejecutarCurl(temporal)

    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error(
        `Catbox no devolvió una URL válida: ${
          url || 'respuesta vacía'
        }`
      )
    }

    await conn.sendMessage(
      m.chat,
      {
        text:
          `╭━━━〔 ☁️ CATBOX 〕━━━╮\n` +
          `┃\n` +
          `┃ ✅ *Archivo subido*\n` +
          `┃\n` +
          `┃ 📄 ${nombre}\n` +
          `┃ 📦 ${mime}\n` +
          `┃\n` +
          `┃ 🔗 *URL directa:*\n` +
          `┃ ${url}\n` +
          `┃\n` +
          `╰━━━━━━━━━━━━━━━━━━╯`
      },
      { quoted: m.raw }
    )
  } catch (error) {
    console.error('[SUBIR]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *No se pudo subir el archivo*\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      { quoted: m.raw }
    )
  } finally {
    try {
      if (fs.existsSync(temporal)) {
        fs.unlinkSync(temporal)
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
  'catbox'
]

handler.registro = true

module.exports = handler