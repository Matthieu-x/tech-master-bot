const { enviarLista } = require('../lib/botones')

const API_KEY = process.env.ORBIT_API_KEY || 'ORBIT-3540596307'
const API_BASE = 'https://orbit-cloud.onrender.com/api/v1/anime'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 3 * 60 * 1000
const MAX_RESULTADOS = 10

global.animeBusquedasPendientes = global.animeBusquedasPendientes || new Map()

async function responder(conn, m, texto) {
  return conn.sendMessage(
    m.chat,
    { text: texto },
    { quoted: m.raw }
  )
}

async function orbitRequest(params) {
  const url = new URL(API_BASE)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString(), {
    headers: {
      'x-api-key': API_KEY,
      'x-orbit-ip': ORBIT_IP,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Orbit API respondió ${response.status}`)
  }

  const data = await response.json()

  if (!data || data.status === false) {
    throw new Error(
      data?.message ||
      data?.error ||
      'La API devolvió un error'
    )
  }

  return data
}

async function buscarAnime(query) {
  const data = await orbitRequest({
    action: 'search',
    query
  })

  return data.data?.results || data.results || []
}

async function obtenerEpisodios(animeId) {
  const data = await orbitRequest({
    action: 'episodes',
    id: animeId
  })

  return data.data?.episodes || data.episodes || []
}

async function obtenerVideo(episodeId) {
  const data = await orbitRequest({
    action: 'download',
    id: episodeId
  })

  const result = data.data?.result || data.result

  if (typeof result === 'string') {
    return result
  }

  if (result?.url) {
    return result.url
  }

  if (result?.download) {
    return result.download
  }

  if (result?.video) {
    return result.video
  }

  throw new Error('La API no devolvió un enlace de video válido')
}

function limpiarNombre(nombre) {
  return String(nombre || 'anime')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

async function enviarResultadosAnime(conn, m, resultados) {
  const filas = resultados
    .slice(0, MAX_RESULTADOS)
    .map((anime, index) => ({
      title:
        anime.title ||
        anime.name ||
        `Anime ${index + 1}`,
      description:
        anime.description ||
        anime.type ||
        'Anime',
      id: String(
        anime.id ||
        anime.animeId ||
        index
      )
    }))

  await enviarLista(
    conn,
    m.chat,
    'ꕥ Resultados de anime',
    'Selecciona un anime',
    'ANIME',
    filas,
    m.raw
  )
}

async function enviarEpisodios(conn, m, pendiente) {
  const episodios = await obtenerEpisodios(
    pendiente.animeId
  )

  if (!episodios.length) {
    throw new Error(
      'No se encontraron episodios para este anime'
    )
  }

  pendiente.episodios = episodios

  const filas = episodios.map((episodio, index) => ({
    title:
      episodio.name ||
      episodio.title ||
      `Episodio ${index + 1}`,
    description:
      episodio.description ||
      `Episodio ${index + 1}`,
    id: String(
      episodio.id ||
      episodio.episodeId ||
      index
    )
  }))

  await enviarLista(
    conn,
    m.chat,
    `ꕥ ${pendiente.animeTitulo}`,
    'Selecciona un episodio',
    'ANIME_EPISODIOS',
    filas,
    m.raw
  )
}

let handler = async (m, { conn, text, command }) => {
  try {
    const input = String(text || '').trim()

    if (
      command === 'anime' ||
      command === 'animesearch'
    ) {
      if (!input) {
        return responder(
          conn,
          m,
          'ꕥ Escribe el nombre del anime.\n\n> Ejemplo: .anime Naruto'
        )
      }

      const resultados = await buscarAnime(input)

      if (!resultados.length) {
        return responder(
          conn,
          m,
          'ꕥ No encontré resultados para ese anime.'
        )
      }

      const key = `${m.chat}:${m.sender}`

      animeBusquedasPendientes.set(key, {
        resultados,
        creadoEn: Date.now()
      })

      setTimeout(() => {
        const pendiente =
          animeBusquedasPendientes.get(key)

        if (
          pendiente &&
          Date.now() - pendiente.creadoEn >=
            TIEMPO_SELECCION_MS
        ) {
          animeBusquedasPendientes.delete(key)
        }
      }, TIEMPO_SELECCION_MS)

      return enviarResultadosAnime(
        conn,
        m,
        resultados
      )
    }

    if (command === 'animeep') {
      if (!input) {
        return responder(
          conn,
          m,
          'ꕥ Usa el ID del anime.\n\n> Ejemplo: .animeep 123'
        )
      }

      const key = `${m.chat}:${m.sender}`

      const pendiente =
        animeBusquedasPendientes.get(key)

      if (!pendiente) {
        return responder(
          conn,
          m,
          'ꕥ No hay una búsqueda de anime activa o ya expiró.'
        )
      }

      const anime =
        pendiente.resultados.find(
          x =>
            String(
              x.id ||
              x.animeId
            ) === input
        ) ||
        pendiente.resultados[
          Number(input)
        ]

      if (!anime) {
        return responder(
          conn,
          m,
          'ꕥ No encontré ese anime en la búsqueda.'
        )
      }

      const animeId =
        anime.id ||
        anime.animeId

      pendiente.animeId = animeId

      pendiente.animeTitulo =
        anime.title ||
        anime.name ||
        'Anime'

      pendiente.creadoEn = Date.now()

      return enviarEpisodios(
        conn,
        m,
        pendiente
      )
    }

    if (command === 'animedl') {
      if (!input) {
        return responder(
          conn,
          m,
          'ꕥ Usa el ID del episodio.\n\n> Ejemplo: .animedl 123'
        )
      }

      const key = `${m.chat}:${m.sender}`

      const pendiente =
        animeBusquedasPendientes.get(key)

      if (!pendiente) {
        return responder(
          conn,
          m,
          'ꕥ No hay una selección de anime activa o ya expiró.'
        )
      }

      if (
        !pendiente.episodios ||
        !pendiente.episodios.length
      ) {
        return responder(
          conn,
          m,
          'ꕥ Primero selecciona un anime para cargar sus episodios.'
        )
      }

      const episodio =
        pendiente.episodios.find(
          x =>
            String(
              x.id ||
              x.episodeId
            ) === input
        ) ||
        pendiente.episodios[
          Number(input)
        ]

      if (!episodio) {
        return responder(
          conn,
          m,
          'ꕥ No encontré ese episodio.'
        )
      }

      const episodioId =
        episodio.id ||
        episodio.episodeId

      await responder(
        conn,
        m,
        `ꕥ Preparando el episodio...\n> ✐ ${
          episodio.name ||
          episodio.title ||
          'Episodio'
        }`
      )

      const videoUrl =
        await obtenerVideo(episodioId)

      if (
        typeof videoUrl !== 'string' ||
        !videoUrl.trim() ||
        !/^https?:\/\//i.test(videoUrl)
      ) {
        throw new Error(
          'La API devolvió un enlace de video inválido'
        )
      }

      const titulo =
        limpiarNombre(
          pendiente.animeTitulo
        )

      const nombreEpisodio =
        limpiarNombre(
          episodio.name ||
          episodio.title ||
          `Episodio ${episodioId}`
        )

      await conn.sendMessage(
        m.chat,
        {
          document: {
            url: videoUrl
          },
          mimetype: 'video/mp4',
          fileName:
            `${titulo} - ${nombreEpisodio}.mp4`,
          caption:
            `ꕥ *${pendiente.animeTitulo}*\n` +
            `> ✐ ${
              episodio.name ||
              episodio.title ||
              'Episodio'
            }`
        },
        {
          quoted: m.raw
        }
      )

      return
    }

  } catch (error) {
    console.error(
      'ERROR ANIME:',
      error
    )

    let mensaje =
      error?.message ||
      'Error desconocido'

    if (
      mensaje.includes(
        'Unknown system error -122'
      )
    ) {
      mensaje =
        'El sistema no pudo escribir el archivo. El almacenamiento o la cuota del servidor puede estar agotada.'
    }

    if (
      mensaje.includes(
        'fetch failed'
      )
    ) {
      mensaje =
        'No se pudo conectar con la API de anime o con el servidor del video.'
    }

    return responder(
      conn,
      m,
      `ꕥ *Ocurrió un error ejecutando el comando:*\n> ${mensaje}`
    )
  }
}

handler.command = [
  'anime',
  'animesearch',
  'animeep',
  'animedl'
]

handler.help = [
  'anime <nombre>',
  'animeep <id>',
  'animedl <id>'
]

handler.tags = [
  'anime'
]

module.exports = handler