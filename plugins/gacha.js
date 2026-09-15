const API_KEY = process.env.ORBIT_API_KEY || 'MATTH-HIEUX'
const API_BASE = 'https://orbitcloud.hidenfree.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

async function obtenerGacha() {
  const url = `${API_BASE}/tools/gacha?apikey=${encodeURIComponent(API_KEY)}`

  const res = await fetch(url, {
    headers: { 'x-orbit-ip': ORBIT_IP }
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('API key inválida o IP no registrada (401)')
    if (res.status === 403) throw new Error('IP bloqueada (403)')
    if (res.status === 429) throw new Error('Se agotaron las solicitudes (429)')
    throw new Error(`HTTP ${res.status}`)
  }

  const data = await res.json()
  if (!data || data.status !== true || !data.data) {
    throw new Error(data?.error || 'Respuesta inválida')
  }
  return data.data
}

// ✅ Nueva función: descarga la imagen como buffer
async function descargarImagen(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fallo descarga: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

let handler = async (m, { conn }) => {
  try {
    await conn.sendMessage(
      m.chat,
      { text: `🎴 *Invocando personaje...*` },
      { quoted: m.raw }
    )

    const p = await obtenerGacha()

    // 1. Descargar la imagen (evita el problema del http://)
    let imagen
    try {
      imagen = await descargarImagen(p.image)
    } catch (e) {
      // Si falla la descarga, enviamos el link como fallback
      return conn.sendMessage(
        m.chat,
        {
          text:
            `🎴 *${p.name}*\n\n` +
            `📺 Anime: ${p.anime}\n` +
            `⚧ Género: ${p.gender}\n\n` +
            `⚠️ No se pudo mostrar la imagen, pero aquí está el link:\n${p.image}`
        },
        { quoted: m.raw }
      )
    }

    // 2. Enviar imagen desde buffer
    return conn.sendMessage(
      m.chat,
      {
        image: imagen,
        caption:
          `🎴 *${p.name}*\n\n` +
          `📺 Anime: ${p.anime}\n` +
          `⚧ Género: ${p.gender}`
      },
      { quoted: m.raw }
    )
  } catch (e) {
    console.error('[GACHA]', e)
    return conn.sendMessage(
      m.chat,
      { text: `❌ Error.\n\n> ${e.message}` },
      { quoted: m.raw }
    )
  }
}

handler.help = ['gacha']
handler.tags = ['anime']
handler.command = ['gacha', 'personaje']
handler.registro = false

module.exports = handler