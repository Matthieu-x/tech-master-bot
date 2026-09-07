const APIS = [
  {
    nombre: 'Lyrics.ovh',
    url: async (query) => {
      const partes = query.trim().split(/\s*-\s*/)
      
      if (partes.length >= 2) {
        const artista = partes[0].trim()
        const cancion = partes.slice(1).join(' - ').trim()

        return `https://api.lyrics.ovh/v1/${encodeURIComponent(artista)}/${encodeURIComponent(cancion)}`
      }

      return null
    },
    obtener: data => data?.lyrics
  },
  {
    nombre: 'LRCLIB',
    url: async (query) => {
      return `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`
    },
    obtener: data => {
      if (!Array.isArray(data) || !data.length) return null

      const resultado =
        data.find(x => x.plainLyrics) ||
        data.find(x => x.syncedLyrics)

      return resultado?.plainLyrics || null
    }
  }
]

async function buscarLetra(query) {
  const errores = []

  for (const api of APIS) {
    try {
      const url = await api.url(query)

      if (!url) {
        errores.push(
          `${api.nombre}: formato no compatible`
        )
        continue
      }

      const controller = new AbortController()

      const timeout = setTimeout(() => {
        controller.abort()
      }, 12000)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Tech-Master-Bot/1.0',
          'Accept': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const lyrics = api.obtener(data)

      if (!lyrics || !lyrics.trim()) {
        throw new Error('No se encontró la letra')
      }

      return {
        lyrics: lyrics.trim(),
        api: api.nombre,
        data
      }
    } catch (error) {
      errores.push(
        `${api.nombre}: ${error.message || 'Error desconocido'}`
      )
    }
  }

  throw new Error(
    errores.join('\n')
  )
}

function dividirTexto(texto, limite = 3500) {
  const partes = []
  let actual = ''

  const lineas = texto.split('\n')

  for (const linea of lineas) {
    if (
      actual.length + linea.length + 1 > limite
    ) {
      if (actual.trim()) {
        partes.push(actual.trim())
      }

      actual = linea + '\n'
    } else {
      actual += linea + '\n'
    }
  }

  if (actual.trim()) {
    partes.push(actual.trim())
  }

  return partes
}

let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text) {
    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Falta la canción*\n\n` +
          `📌 Uso:\n` +
          `${usedPrefix}lyrics <canción>\n\n` +
          `📝 Ejemplo:\n` +
          `${usedPrefix}lyrics Shape of You\n\n` +
          `💡 También puedes usar:\n` +
          `${usedPrefix}lyrics Ed Sheeran - Shape of You`
      },
      { quoted: m.raw }
    )
  }

  const query = text.trim()

  try {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `🎵 *Buscando letra...*\n\n` +
          `🔎 ${query}\n` +
          `⏳ Espera un momento...`
      },
      { quoted: m.raw }
    )

    const resultado = await buscarLetra(query)

    const partes = dividirTexto(
      resultado.lyrics
    )

    await conn.sendMessage(
      m.chat,
      {
        text:
          `╭━━━〔 🎵 LYRICS 〕━━━╮\n` +
          `┃\n` +
          `┃ 🎶 *${query}*\n` +
          `┃ 🌐 Fuente: ${resultado.api}\n` +
          `┃\n` +
          `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
          partes[0]
      },
      { quoted: m.raw }
    )

    for (let i = 1; i < partes.length; i++) {
      await conn.sendMessage(
        m.chat,
        {
          text: partes[i]
        },
        { quoted: m.raw }
      )
    }
  } catch (error) {
    console.error('[LYRICS]', error)

    await conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *No encontré la letra*\n\n` +
          `🔎 Búsqueda: ${query}\n\n` +
          `> ${error.message || 'Todas las APIs fallaron'}`
      },
      { quoted: m.raw }
    )
  }
}

handler.help = [
  'lyrics <canción>'
]

handler.tags = [
  'musica'
]

handler.command = [
  'lyrics',
  'letra'
]

handler.registro = true

module.exports = handler