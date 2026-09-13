const { enviarLista } = require('../lib/botones')

const API_KEY = process.env.ORBIT_API_KEY || 'ORBIT-3540596307'
const API_BASE = 'https://orbit-cloud.onrender.com/api/v1/anime'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 3 * 60 * 1000
const MAX_RESULTADOS = 10
const MAX_VIDEO_SIZE = 60 * 1024 * 1024

if (!global.animeBusquedasPendientes) {
  global.animeBusquedasPendientes = new Map()
}

const busquedasPendientes = global.animeBusquedasPendientes

function limpiarBusquedasVencidas() {
  const ahora = Date.now()

  for (const [clave, valor] of busquedasPendientes) {
    if (!valor || ahora > valor.expira) {
      busquedasPendientes.delete(clave)
    }
  }
}

function claveBusqueda(m) {
  return `${m.chat}_${m.senderNumero || m.sender}`
}

async function llamarOrbit(ruta, query) {
  const url =
    `${API_BASE}/${ruta}?apikey=${encodeURIComponent(API_KEY)}` +
    `&${query}`

  const response = await fetch(url, {
    headers: {
      'x-orbit-ip': ORBIT_IP
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()

  if (!data || data.status !== true) {
    throw new Error(
      data?.error ||
      'La API de Orbit no devolvió un resultado válido'
    )
  }

  return data
}

async function buscarAnime(query) {
  const data = await llamarOrbit(
    'search',
    `query=${encodeURIComponent(query)}`
  )

  if (!Array.isArray(data.result)) {
    throw new Error('Respuesta de búsqueda inválida')
  }

  return data.result
}

async function obtenerEpisodios(link) {
  const data = await llamarOrbit(
    'episodes',
    `link=${encodeURIComponent(link)}`
  )

  if (!Array.isArray(data.result)) {
    throw new Error('Respuesta de episodios inválida')
  }

  return data.result
}

async function obtenerVideo(episodeId) {
  const data = await llamarOrbit(
    'download',
    `episode=${encodeURIComponent(episodeId)}`
  )

  if (!data.result) {
    throw new Error('No se obtuvo el link del video')
  }

  return data.result
}

async function descargarVideo(url) {
  const response = await fetch(url, {
    redirect: 'follow'
  })

  if (!response.ok) {
    throw new Error(
      `No se pudo descargar el video: HTTP ${response.status}`
    )
  }

  const contentType =
    response.headers.get('content-type') || ''

  const contentLength =
    Number(response.headers.get('content-length')) || 0

  if (contentLength > MAX_VIDEO_SIZE) {
    throw new Error(
      `El video pesa ${(contentLength / 1024 / 1024).toFixed(2)} MB y supera el límite de 60 MB`
    )
  }

  if (
    !contentType.includes('video') &&
    !contentType.includes('octet-stream')
  ) {
    throw new Error(
      `El servidor no devolvió un video. Content-Type: ${contentType}`
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (!buffer.length) {
    throw new Error('El video descargado está vacío')
  }

  if (buffer.length > MAX_VIDEO_SIZE) {
    throw new Error(
      `El video pesa ${(buffer.length / 1024 / 1024).toFixed(2)} MB y supera el límite de 60 MB`
    )
  }

  return {
    buffer,
    contentType
  }
}

async function enviarListaAnimes(
  conn,
  m,
  animes,
  usedPrefix,
  query
) {
  return enviarLista(conn, m.chat, {
    texto:
      `🔎 *Resultados para:* ${query}\n\n` +
      `🎬 Encontrados: ${animes.length}`,
    footer: 'Selecciona un anime · expira en 3 minutos',
    titulo: 'Anime Search',
    textoBoton: 'Ver resultados',
    mensajeCitado: m.raw,
    secciones: [
      {
        titulo: `${animes.length} resultado(s)`,
        filas: animes.map((anime, i) => ({
          titulo: (anime.title || 'Sin título').slice(0, 60),
          id: `${usedPrefix}animeep ${i}`,
          descripcion: 'Toca para ver episodios'
        }))
      }
    ]
  })
}

async function enviarListaEpisodios(
  conn,
  m,
  episodios,
  usedPrefix,
  tituloAnime
) {
  return enviarLista(conn, m.chat, {
    texto:
      `📺 *${tituloAnime}*\n\n` +
      `🎬 Episodios: ${episodios.length}`,
    footer: 'Selecciona un episodio · expira en 3 minutos',
    titulo: 'Anime Episodes',
    textoBoton: 'Ver episodios',
    mensajeCitado: m.raw,
    secciones: [
      {
        titulo: `${episodios.length} episodio(s)`,
        filas: episodios.map((ep, i) => ({
          titulo:
            (ep.name || `Episodio ${i + 1}`).slice(0, 60),
          id: `${usedPrefix}animedl ${i}`,
          descripcion: 'Toca para descargar'
        }))
      }
    ]
  })
}

let handler = async (
  m,
  {
    conn,
    text,
    usedPrefix,
    command,
    args
  }
) => {
  limpiarBusquedasVencidas()

  const comando = (command || '').toLowerCase()
  const clave = claveBusqueda(m)

  if (comando === 'animeep') {
    const indice = Number(args[0])
    const pendiente = busquedasPendientes.get(clave)

    if (
      !pendiente ||
      !pendiente.animes ||
      Number.isNaN(indice) ||
      !pendiente.animes[indice]
    ) {
      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ Esa búsqueda expiró o no es válida.\n\n` +
            `> Usa ${usedPrefix}anime de nuevo.`
        },
        {
          quoted: m.raw
        }
      )
    }

    const anime = pendiente.animes[indice]

    try {
      await conn.sendMessage(
        m.chat,
        {
          text:
            `📺 *_Cargando episodios de "${anime.title}"..._*`
        },
        {
          quoted: m.raw
        }
      )

      const episodios = await obtenerEpisodios(anime.link)

      if (!episodios.length) {
        return conn.sendMessage(
          m.chat,
          {
            text:
              `❌ Ese anime no tiene episodios disponibles.`
          },
          {
            quoted: m.raw
          }
        )
      }

      const episodiosRecortados =
        episodios.slice(0, MAX_RESULTADOS)

      busquedasPendientes.set(clave, {
        animes: pendiente.animes,
        episodios: episodiosRecortados,
        animeTitulo: anime.title,
        expira: Date.now() + TIEMPO_SELECCION_MS
      })

      return enviarListaEpisodios(
        conn,
        m,
        episodiosRecortados,
        usedPrefix,
        anime.title
      )
    } catch (error) {
      console.error('[ANIME]', error)

      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ Ocurrió un error al buscar episodios.\n\n` +
            `> ${error.message || 'Error desconocido'}`
        },
        {
          quoted: m.raw
        }
      )
    }
  }

  if (comando === 'animedl') {
    const indice = Number(args[0])
    const pendiente = busquedasPendientes.get(clave)

    if (
      !pendiente ||
      !pendiente.episodios ||
      Number.isNaN(indice) ||
      !pendiente.episodios[indice]
    ) {
      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ Esa selección expiró o no es válida.\n\n` +
            `> Usa ${usedPrefix}anime de nuevo.`
        },
        {
          quoted: m.raw
        }
      )
    }

    const episodio = pendiente.episodios[indice]

    try {
      await conn.sendMessage(
        m.chat,
        {
          text:
            `⬇️ *_Obteniendo "${episodio.name}"..._*`
        },
        {
          quoted: m.raw
        }
      )

      const videoUrl = await obtenerVideo(episodio.id)

      if (
        typeof videoUrl !== 'string' ||
        !videoUrl.trim() ||
        !/^https?:\/\//i.test(videoUrl)
      ) {
        throw new Error(
          'La API devolvió un enlace de video inválido'
        )
      }

      const {
        buffer: videoBuffer,
        contentType
      } = await descargarVideo(videoUrl)

      const mimetype =
        contentType.includes('webm')
          ? 'video/webm'
          : contentType.includes('mkv')
            ? 'video/x-matroska'
            : 'video/mp4'

      await conn.sendMessage(
        m.chat,
        {
          video: videoBuffer,
          mimetype,
          caption:
            `ꕥ *${pendiente.animeTitulo}*\n` +
            `> ✐ ${episodio.name}`
        },
        {
          quoted: m.raw
        }
      )

      return
    } catch (error) {
      console.error('[ANIME]', error)

      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ Ocurrió un error al descargar el video.\n\n` +
            `> ${error.message || 'Error desconocido'}`
        },
        {
          quoted: m.raw
        }
      )
    }
  }

  if (!text || !text.trim()) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Escribe el nombre de un anime.\n\n` +
          `📌 Ejemplo:\n` +
          `${usedPrefix}anime Lil Matthieu es un legado`
      },
      {
        quoted: m.raw
      }
    )
  }

  const query = text.trim()

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `🔎 *Buscando anime...*\n\n` +
          `> ${query}`
      },
      {
        quoted: m.raw
      }
    )

    const animes = await buscarAnime(query)

    if (!animes.length) {
      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ No encontré resultados para:\n` +
            `> ${query}`
        },
        {
          quoted: m.raw
        }
      )
    }

    const resultados = animes
      .filter(
        a => a && a.link && a.title
      )
      .slice(0, MAX_RESULTADOS)

    if (!resultados.length) {
      throw new Error(
        'No se encontraron animes válidos'
      )
    }

    busquedasPendientes.set(clave, {
      animes: resultados,
      episodios: null,
      animeTitulo: null,
      expira: Date.now() + TIEMPO_SELECCION_MS
    })

    return enviarListaAnimes(
      conn,
      m,
      resultados,
      usedPrefix,
      query
    )
  } catch (error) {
    console.error('[ANIME]', error)

    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ Ocurrió un error al buscar.\n\n` +
          `> ${error.message || 'Error desconocido'}`
      },
      {
        quoted: m.raw
      }
    )
  }
}

handler.help = ['anime <búsqueda>']
handler.tags = ['anime']

handler.command = [
  'anime',
  'animesearch',
  'animeep',
  'animedl'
]

handler.registro = false

module.exports = handler