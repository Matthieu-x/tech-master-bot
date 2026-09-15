const sharp = require('sharp')

const API_KEY = process.env.ORBIT_API_KEY || 'MATTH-HIEUX'
const API_BASE = 'https://orbitcloud.hidenfree.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

async function generarBrat(texto) {
  const url =
    `${API_BASE}/tools/bratanime?apikey=${encodeURIComponent(API_KEY)}` +
    `&text=${encodeURIComponent(texto)}`

  const res = await fetch(url, {
    headers: { 'x-orbit-ip': ORBIT_IP }
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('API key inválida o IP no registrada (401)')
    if (res.status === 403) throw new Error('IP bloqueada o endpoint no permitido (403)')
    if (res.status === 429) throw new Error('Se agotaron las solicitudes de hoy (429)')
    throw new Error(`HTTP ${res.status}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

async function convertirAWebp(buffer) {
  return sharp(buffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: 90 })
    .toBuffer()
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `🎨 Escribe el texto para el brat.\n\n` +
          `📌 Ejemplo:\n${usedPrefix}brat Welcome to Orbit`
      },
      { quoted: m.raw }
    )
  }

  const texto = text.trim().slice(0, 200)

  try {
    await conn.sendMessage(
      m.chat,
      { text: `🎨 *Generando brat...*\n\n> ${texto}` },
      { quoted: m.raw }
    )

    const imagen = await generarBrat(texto)
    const webp = await convertirAWebp(imagen)

    return conn.sendMessage(
      m.chat,
      { sticker: webp },
      { quoted: m.raw }
    )
  } catch (e) {
    console.error('[BRAT]', e)
    return conn.sendMessage(
      m.chat,
      { text: `❌ Error al generar el brat.\n\n> ${e.message}` },
      { quoted: m.raw }
    )
  }
}

handler.help = ['brat <texto>']
handler.tags = ['sticker']
handler.command = ['brat', 'bratanime']
handler.registro = false

module.exports = handler