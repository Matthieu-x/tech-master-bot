const sharp = require('sharp')

const ANCHO_BIENVENIDA = 900
const ALTO_BIENVENIDA = 300
const DIAMETRO_FOTO_BIENVENIDA = 200

const ANCHO_PERFIL = 900
const ALTO_PERFIL = 360
const DIAMETRO_FOTO_PERFIL = 220

function escaparXml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function obtenerBufferFoto(conn, jid) {
  try {
    const url = await conn.profilePictureUrl(jid, 'image')
    const respuesta = await fetch(url)
    if (!respuesta.ok) throw new Error('descarga falló')
    return Buffer.from(await respuesta.arrayBuffer())
  } catch {
    return null // sin foto de perfil o no se pudo descargar: se usa un placeholder
  }
}

async function fotoCircular(bufferFoto, diametro) {
  const mascara = Buffer.from(
    `<svg width="${diametro}" height="${diametro}"><circle cx="${diametro / 2}" cy="${diametro / 2}" r="${diametro / 2}" fill="#fff"/></svg>`
  )

  let fotoBase
  if (bufferFoto) {
    fotoBase = await sharp(bufferFoto)
      .resize(diametro, diametro, { fit: 'cover' })
      .toBuffer()
  } else {
    fotoBase = await sharp({
      create: {
        width: diametro,
        height: diametro,
        channels: 4,
        background: { r: 90, g: 90, b: 90, alpha: 1 },
      },
    }).png().toBuffer()
  }

  return sharp(fotoBase)
    .composite([{ input: mascara, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function generarTarjetaBienvenida({ conn, jid, nombreUsuario, nombreGrupo, numeroMiembros }) {
  const bufferFoto = await obtenerBufferFoto(conn, jid)
  const foto = await fotoCircular(bufferFoto, DIAMETRO_FOTO_BIENVENIDA)

  const svgFondo = `
    <svg width="${ANCHO_BIENVENIDA}" height="${ALTO_BIENVENIDA}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f2027"/>
          <stop offset="50%" stop-color="#203a43"/>
          <stop offset="100%" stop-color="#2c5364"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#fondo)" rx="24"/>
      <circle cx="150" cy="150" r="${DIAMETRO_FOTO_BIENVENIDA / 2 + 8}" fill="none" stroke="#ffffff" stroke-width="6"/>
      <text x="290" y="120" font-size="40" font-family="Arial, sans-serif" font-weight="bold" fill="#ffffff">¡Bienvenido/a!</text>
      <text x="290" y="170" font-size="30" font-family="Arial, sans-serif" fill="#ffffff">${escaparXml(nombreUsuario)}</text>
      <text x="290" y="215" font-size="22" font-family="Arial, sans-serif" fill="#b8d8e8">${escaparXml(nombreGrupo)}</text>
      <text x="290" y="255" font-size="20" font-family="Arial, sans-serif" fill="#8fd3ff">Miembro #${numeroMiembros}</text>
    </svg>
  `

  const fondo = await sharp(Buffer.from(svgFondo)).png().toBuffer()

  return sharp(fondo)
    .composite([{ input: foto, top: 50, left: 50 }])
    .png()
    .toBuffer()
}

async function generarTarjetaPerfil({ conn, jid, nombreUsuario, mastercoins, nivel }) {
  const bufferFoto = await obtenerBufferFoto(conn, jid)
  const foto = await fotoCircular(bufferFoto, DIAMETRO_FOTO_PERFIL)

  const svgFondo = `
    <svg width="${ANCHO_PERFIL}" height="${ALTO_PERFIL}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1f1c2c"/>
          <stop offset="100%" stop-color="#928dab"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#fondo)" rx="24"/>
      <circle cx="170" cy="180" r="${DIAMETRO_FOTO_PERFIL / 2 + 8}" fill="none" stroke="#ffffff" stroke-width="6"/>
      <text x="330" y="140" font-size="42" font-family="Arial, sans-serif" font-weight="bold" fill="#ffffff">${escaparXml(nombreUsuario)}</text>
      <text x="330" y="190" font-size="26" font-family="Arial, sans-serif" fill="#ffe08a">🪙 ${mastercoins} MasterCoins</text>
      <text x="330" y="230" font-size="26" font-family="Arial, sans-serif" fill="#8fd3ff">⭐ Nivel ${nivel}</text>
    </svg>
  `

  const fondo = await sharp(Buffer.from(svgFondo)).png().toBuffer()

  return sharp(fondo)
    .composite([{ input: foto, top: 60, left: 60 }])
    .png()
    .toBuffer()
}

module.exports = { generarTarjetaBienvenida, generarTarjetaPerfil }