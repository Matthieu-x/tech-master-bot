const API_KEY = process.env.ORBIT_API_KEY || 'MATTH-HIEUX'
const API_BASE = 'https://orbitcloud.hidenfree.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

async function obtenerGacha() {
  const url = `${API_BASE}/tools/gacha?apikey=${encodeURIComponent(API_KEY)}`

  const res = await fetch(url, {
    headers: {
      'x-orbit-ip': ORBIT_IP
    }
  })

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('API key inválida o IP no registrada (401)')
    }

    if (res.status === 403) {
      throw new Error('IP bloqueada (403)')
    }

    if (res.status === 429) {
      throw new Error('Se agotaron las solicitudes (429)')
    }

    throw new Error(`HTTP ${res.status}`)
  }

  const data = await res.json()

  if (!data || data.status !== true || !data.data) {
    throw new Error(data?.error || 'Respuesta inválida')
  }

  return data.data
}

// Descargar imagen usando HTTPS
async function descargarImagen(url) {
  // Delirius devuelve http://, pero la imagen funciona por https://
  const httpsUrl = url.replace(/^http:/, 'https:')

  const res = await fetch(httpsUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'image/*'
    },
    redirect: 'follow'
  })

  if (!res.ok) {
    throw new Error(`Fallo descarga: HTTP ${res.status}`)
  }

  const contentType = res.headers.get('content-type') || ''

  if (!contentType.startsWith('image/')) {
    throw new Error(`La respuesta no es una imagen: ${contentType}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

let handler = async (m, { conn }) => {
  try {
    await conn.sendMessage(
      m.chat,
      {
        text: `🎴 *Invocando personaje...*`
      },
      {
        quoted: m.raw
      }
    )

    const p = await obtenerGacha()

    // Descargar imagen
    let imagen

    try {
      imagen = await descargarImagen(p.image)
    } catch (e) {
      console.error('[GACHA IMG]', e)

      // Fallback si falla la imagen
      return conn.sendMessage(
        m.chat,
        {
          text:
            `🎴 *${p.name}*\n\n` +
            `📺 Anime: ${p.anime}\n` +
            `⚧ Género: ${p.gender}\n\n` +
            `⚠️ No se pudo mostrar la imagen.\n` +
            `🔗 ${p.image}`
        },
        {
          quoted: m.raw
        }
      )
    }

    // Enviar imagen
    return conn.sendMessage(
      m.chat,
      {
        image: imagen,
        caption:
          `🎴 *${p.name}*\n\n` +
          `📺 Anime: ${p.anime}\n` +
          `⚧ Género: ${p.gender}`
      },
      {
        quoted: m.raw
      }
    )

  } catch (e) {
    console.error('[GACHA]', e)

    return conn.sendMessage(
      m.chat,
      {
        text: `❌ Error.\n\n> ${e.message}`
      },
      {
        quoted: m.raw
      }
    )
  }
}

handler.help = ['gacha']
handler.tags = ['anime']
handler.command = ['gacha', 'personaje']
handler.registro = false

module.exports = handler