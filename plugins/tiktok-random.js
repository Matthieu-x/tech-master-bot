const API_KEY = process.env.ORBIT_API_KEY || 'ORBIT-3540596307'
const API_BASE = 'https://orbitcloud.hidenfree.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

async function obtenerTikTokRandom() {
  const url =
    `${API_BASE}/download/tiktokrandom?apikey=${encodeURIComponent(API_KEY)}`

  const res = await fetch(url, {
    headers: { 'x-orbit-ip': ORBIT_IP }
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('API key inválida o IP no registrada (401)')
    if (res.status === 403) throw new Error('IP bloqueada (403)')
    if (res.status === 429) throw new Error('Se agotaron las solicitudes de hoy (429)')
    throw new Error(`HTTP ${res.status}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

let handler = async (m, { conn, usedPrefix }) => {
  try {
    await conn.sendMessage(
      m.chat,
      { text: `🎬 *Obteniendo TikTok random...*` },
      { quoted: m.raw }
    )

    const video = await obtenerTikTokRandom()

    if (!video || !video.length) {
      throw new Error('Video vacío')
    }

    return conn.sendMessage(
      m.chat,
      {
        video,
        mimetype: 'video/mp4',
        caption: `🎬 *TikTok Random*\n> ${usedPrefix}tiktokrandom`
      },
      { quoted: m.raw }
    )
  } catch (e) {
    console.error('[TIKTOKRANDOM]', e)
    return conn.sendMessage(
      m.chat,
      { text: `❌ Error al obtener TikTok random.\n\n> ${e.message}` },
      { quoted: m.raw }
    )
  }
}

handler.help = ['tiktokrandom']
handler.tags = ['tiktok']
handler.command = ['tiktokrandom', 'ttrandom', 'ttr']
handler.registro = false

module.exports = handler