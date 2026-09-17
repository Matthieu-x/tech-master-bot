const { enviarBotones, enviarLista } = require('../lib/botones')
const puppeteer = require('puppeteer')

const API_KEY = process.env.ORBIT_API_KEY || 'MATTH-HIEUX'
const API_BASE = 'https://orbitcloud.hidenfree.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 5 * 60 * 1000
const MAX_RESULTADOS = 10

if (!global.tiktokPendientes) {
  global.tiktokPendientes = new Map()
}

const pendientes = global.tiktokPendientes

function limpiarVencidas() {
  const ahora = Date.now()

  for (const [clave, valor] of pendientes) {
    if (!valor || ahora > valor.expira) {
      pendientes.delete(clave)
    }
  }
}

function claveBusqueda(m) {
  return `${m.chat}_${m.senderNumero || m.sender}`
}

/* ═══════════════════════════════════════
   ORBIT API
═══════════════════════════════════════ */

async function orbitFetch(path, params = {}) {
  const qs = new URLSearchParams({
    apikey: API_KEY,
    ...params
  }).toString()

  const url = `${API_BASE}/${path}?${qs}`

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

  return res.json()
}

async function buscarTikTok(query) {
  const data = await orbitFetch('tiktok-search', {
    query
  })

  if (
    !data ||
    data.status !== true ||
    !Array.isArray(data.results)
  ) {
    throw new Error(data?.error || 'Respuesta inválida')
  }

  return data.results
}

async function descargarTikTokPorUrl(url) {
  const data = await orbitFetch('download/tiktok', {
    url
  })

  if (
    !data ||
    data.status !== true ||
    !data.data?.video
  ) {
    throw new Error(data?.error || 'Respuesta inválida')
  }

  return data.data
}

/* ═══════════════════════════════════════
   FORMATOS
═══════════════════════════════════════ */

function formatearNumero(n) {
  if (!n) return '0'

  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1) + 'M'
  }

  if (n >= 1_000) {
    return (n / 1_000).toFixed(1) + 'K'
  }

  return String(n)
}

function formatearDuracion(seg) {
  const s = Number(seg) || 0
  const m = Math.floor(s / 60)
  const r = s % 60

  return m > 0
    ? `${m}m ${r}s`
    : `${r}s`
}

/* ═══════════════════════════════════════
   TARJETA TIKTOK
═══════════════════════════════════════ */

async function generarTarjetaTikTok(video) {
  let browser

  try {
    const author =
      video.author?.uniqueId ||
      video.author?.nickname ||
      'Usuario'

    const nickname =
      video.author?.nickname ||
      author

    const descripcion =
      video.desc ||
      'Sin descripción'

    const cover =
      video.video?.cover ||
      video.video?.originCover ||
      video.video?.dynamicCover ||
      ''

    const vistas = formatearNumero(
      video.stats?.playCount
    )

    const likes = formatearNumero(
      video.stats?.diggCount
    )

    const comentarios = formatearNumero(
      video.stats?.commentCount
    )

    const duracion = formatearDuracion(
      video.video?.duration
    )

    const escapeHTML = (text) => {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    }

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote'
      ]
    })

    const page = await browser.newPage()

    await page.setViewport({
      width: 900,
      height: 1100,
      deviceScaleFactor: 1
    })

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<style>

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 900px;
  height: 1100px;
  background: #050505;
  font-family: Arial, Helvetica, sans-serif;
}

body {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card {
  width: 820px;
  min-height: 1000px;

  background:
    radial-gradient(
      circle at top right,
      rgba(255, 0, 80, .20),
      transparent 35%
    ),
    radial-gradient(
      circle at bottom left,
      rgba(0, 242, 234, .14),
      transparent 35%
    ),
    #101010;

  border: 1px solid rgba(255,255,255,.10);
  border-radius: 38px;

  padding: 32px;

  box-shadow:
    0 30px 80px rgba(0,0,0,.65);

  color: white;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-bottom: 28px;
}

.brand {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: -1px;
}

.brand span {
  color: #ff0050;
}

.badge {
  padding: 10px 18px;
  border-radius: 30px;

  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.10);

  font-size: 17px;
  font-weight: bold;
}

.cover-container {
  width: 100%;
  height: 560px;

  border-radius: 28px;

  overflow: hidden;

  background: #181818;

  position: relative;
}

.cover {
  width: 100%;
  height: 100%;

  object-fit: cover;

  display: block;
}

.cover-overlay {
  position: absolute;
  inset: 0;

  background:
    linear-gradient(
      to top,
      rgba(0,0,0,.75),
      transparent 45%
    );
}

.duration {
  position: absolute;

  right: 20px;
  bottom: 20px;

  padding: 9px 14px;

  border-radius: 12px;

  background: rgba(0,0,0,.72);

  font-size: 18px;
  font-weight: bold;
}

.author {
  margin-top: 26px;

  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar {
  width: 58px;
  height: 58px;

  border-radius: 50%;

  background:
    linear-gradient(
      135deg,
      #ff0050,
      #00f2ea
    );

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 24px;
  font-weight: 900;
}

.username {
  font-size: 23px;
  font-weight: 800;
}

.nickname {
  margin-top: 4px;

  color: #999;

  font-size: 16px;
}

.description {
  margin-top: 22px;

  padding: 20px;

  border-radius: 20px;

  background: rgba(255,255,255,.055);

  color: #eee;

  font-size: 19px;
  line-height: 1.45;

  min-height: 80px;
}

.stats {
  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 14px;

  margin-top: 20px;
}

.stat {
  padding: 18px 10px;

  text-align: center;

  border-radius: 18px;

  background: rgba(255,255,255,.055);

  border: 1px solid rgba(255,255,255,.06);
}

.stat-number {
  font-size: 24px;
  font-weight: 900;
}

.stat-name {
  margin-top: 5px;

  color: #999;

  font-size: 14px;
}

.footer {
  margin-top: 26px;

  display: flex;

  justify-content: space-between;

  color: #777;

  font-size: 14px;
}

.footer strong {
  color: #aaa;
}

</style>
</head>

<body>

<div class="card">

  <div class="header">

    <div class="brand">
      <span>♪</span> TikTok
    </div>

    <div class="badge">
      Duan TikTok
    </div>

  </div>

  <div class="cover-container">

    ${
      cover
        ? `
          <img
            class="cover"
            src="${escapeHTML(cover)}"
          >
        `
        : `
          <div
            style="
              width:100%;
              height:100%;
              display:flex;
              align-items:center;
              justify-content:center;
              color:#777;
              font-size:24px;
            "
          >
            Sin portada disponible
          </div>
        `
    }

    <div class="cover-overlay"></div>

    <div class="duration">
      ${escapeHTML(duracion)}
    </div>

  </div>

  <div class="author">

    <div class="avatar">
      ${escapeHTML(
        String(author)
          .charAt(0)
          .toUpperCase()
      )}
    </div>

    <div>

      <div class="username">
        @${escapeHTML(author)}
      </div>

      <div class="nickname">
        ${escapeHTML(nickname)}
      </div>

    </div>

  </div>

  <div class="description">
    ${escapeHTML(descripcion)}
  </div>

  <div class="stats">

    <div class="stat">
      <div class="stat-number">
        ${vistas}
      </div>

      <div class="stat-name">
        VISTAS
      </div>
    </div>

    <div class="stat">
      <div class="stat-number">
        ${likes}
      </div>

      <div class="stat-name">
        LIKES
      </div>
    </div>

    <div class="stat">
      <div class="stat-number">
        ${comentarios}
      </div>

      <div class="stat-name">
        COMENTARIOS
      </div>
    </div>

  </div>

  <div class="footer">

    <div>
      TikTok Search
    </div>

    <div>
      Powered by <strong>Duan</strong>
    </div>

  </div>

</div>

</body>
</html>
`

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    // Esperar a que las imágenes terminen de cargar
    await page.evaluate(async () => {
      const images = Array.from(
        document.images
      )

      await Promise.all(
        images.map(img => {
          if (img.complete) return

          return new Promise(resolve => {
            img.onload = resolve
            img.onerror = resolve
          })
        })
      )
    })

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    })

    return screenshot

  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

/* ═══════════════════════════════════════
   LISTA DE RESULTADOS
═══════════════════════════════════════ */

async function enviarListaTikTok(
  conn,
  m,
  videos,
  usedPrefix,
  query
) {
  return enviarLista(conn, m.chat, {

    texto:
      `🎬 *TikTok:* ${query}\n\n` +
      `📦 Resultados: ${videos.length}\n` +
      `⏳ Selección disponible durante 5 minutos.`,

    footer:
      `Toca uno para enviarlo`,

    titulo:
      'TikTok Search',

    textoBoton:
      'Ver videos',

    mensajeCitado:
      m.raw,

    secciones: [

      {
        titulo:
          `${videos.length} video(s)`,

        filas:
          videos.map((v, i) => ({

            titulo:
              `@${v.author?.uniqueId || '?'} · ` +
              `${v.desc?.slice(0, 40) || 'Sin descripción'}`,

            id:
              `${usedPrefix}tiktokget ${i}`,

            descripcion:
              `👁️ ${formatearNumero(v.stats?.playCount)}` +
              ` · ❤️ ${formatearNumero(v.stats?.diggCount)}` +
              ` · ⏱️ ${formatearDuracion(v.video?.duration)}`
          }))

      }

    ]
  })
}

/* ═══════════════════════════════════════
   BOTÓN MÁS VIDEOS
═══════════════════════════════════════ */

async function enviarBotonMas(
  conn,
  m,
  usedPrefix,
  query,
  restantes
) {
  return enviarBotones(conn, m.chat, {

    texto:
      `✅ *Video enviado*\n\n` +
      `🔎 Búsqueda: ${query}\n` +
      `📦 Restantes: ${restantes}`,

    footer:
      `La búsqueda expira en 5 minutos.`,

    botones: [

      {
        texto:
          '🎬 Más videos',

        id:
          `${usedPrefix}tiktokmas`
      }

    ],

    mensajeCitado:
      m.raw
  })
}

/* ═══════════════════════════════════════
   ENVIAR TARJETA + VIDEO
═══════════════════════════════════════ */

async function enviarVideoTikTok(
  conn,
  m,
  video
) {

  const urlVideo =
    video.video?.play ||
    video.video?.download

  if (!urlVideo) {
    throw new Error(
      'Sin URL de video'
    )
  }

  const author =
    video.author?.uniqueId ||
    '?'

  const nickname =
    video.author?.nickname ||
    ''

  const caption =
    `🎬 *@${author}*` +
    (nickname
      ? ` · ${nickname}`
      : '') +
    `\n\n` +

    `📝 ${video.desc || 'Sin descripción'}\n\n` +

    `👁️ ${formatearNumero(
      video.stats?.playCount
    )} vistas\n` +

    `❤️ ${formatearNumero(
      video.stats?.diggCount
    )} likes\n` +

    `💬 ${formatearNumero(
      video.stats?.commentCount
    )} comentarios\n\n` +

    `🔗 ${video.url || ''}`

  /*
   * Primero generamos la tarjeta.
   * Si Puppeteer falla, NO detenemos
   * el envío del video.
   */

  try {

    const tarjeta =
      await generarTarjetaTikTok(video)

    await conn.sendMessage(
      m.chat,
      {
        image: tarjeta,
        caption:
          `🎬 *TikTok*\n\n` +
          `@${author}\n` +
          `✨ Tarjeta generada automáticamente.`
      },
      {
        quoted: m.raw
      }
    )

  } catch (error) {

    console.error(
      '[TIKTOK CARD]',
      error
    )

  }

  /*
   * Enviar el video normalmente
   */

  return conn.sendMessage(
    m.chat,
    {
      video: {
        url: urlVideo
      },

      mimetype:
        'video/mp4',

      caption
    },
    {
      quoted: m.raw
    }
  )
}

/* ═══════════════════════════════════════
   HANDLER
═══════════════════════════════════════ */

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

  limpiarVencidas()

  const comando =
    (command || '').toLowerCase()

  const clave =
    claveBusqueda(m)

  /* ─────────────────────────────
     TIKTOKGET
  ───────────────────────────── */

  if (comando === 'tiktokget') {

    const indice =
      Number(args[0])

    const pendiente =
      pendientes.get(clave)

    if (
      !pendiente ||
      !pendiente.videos ||
      Number.isNaN(indice) ||
      !pendiente.videos[indice]
    ) {

      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ *Esa búsqueda expiró.*\n\n` +
            `> Usa ${usedPrefix}tiktok de nuevo.`
        },
        {
          quoted: m.raw
        }
      )
    }

    const video =
      pendiente.videos[indice]

    try {

      await enviarVideoTikTok(
        conn,
        m,
        video
      )

      const restantes =
        pendiente.videos.length -
        (indice + 1)

      if (restantes > 0) {

        return enviarBotonMas(
          conn,
          m,
          usedPrefix,
          pendiente.query,
          restantes
        )
      }

      return

    } catch (e) {

      console.error(
        '[TIKTOK]',
        e
      )

      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ *Error al enviar el video.*\n\n` +
            `> ${e.message}`
        },
        {
          quoted: m.raw
        }
      )
    }
  }

  /* ─────────────────────────────
     TIKTOKMAS
  ───────────────────────────── */

  if (comando === 'tiktokmas') {

    const pendiente =
      pendientes.get(clave)

    if (
      !pendiente ||
      !pendiente.videos
    ) {

      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ *Expiró la búsqueda.*\n\n` +
            `> Usa ${usedPrefix}tiktok de nuevo.`
        },
        {
          quoted: m.raw
        }
      )
    }

    return enviarListaTikTok(
      conn,
      m,
      pendiente.videos,
      usedPrefix,
      pendiente.query
    )
  }

  /* ─────────────────────────────
     SIN TEXTO
  ───────────────────────────── */

  if (
    !text ||
    !text.trim()
  ) {

    return conn.sendMessage(
      m.chat,
      {
        text:
          `🎬 *TikTok Search*\n\n` +
          `Escribe qué quieres buscar.\n\n` +
          `📌 *Ejemplo:*\n` +
          `${usedPrefix}tiktok goku`
      },
      {
        quoted: m.raw
      }
    )
  }

  const query =
    text.trim()

  /* ─────────────────────────────
     BUSCAR
  ───────────────────────────── */

  try {

    await conn.sendMessage(
      m.chat,
      {
        text:
          `🎬 *Buscando en TikTok...*\n\n` +
          `> ${query}`
      },
      {
        quoted: m.raw
      }
    )

    const videos =
      await buscarTikTok(query)

    if (!videos.length) {

      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ *No encontré videos.*\n\n` +
            `🔎 Búsqueda: ${query}`
        },
        {
          quoted: m.raw
        }
      )
    }

    const resultados =
      videos.slice(
        0,
        MAX_RESULTADOS
      )

    pendientes.set(
      clave,
      {
        query,
        videos: resultados,
        expira:
          Date.now() +
          TIEMPO_SELECCION_MS
      }
    )

    return enviarListaTikTok(
      conn,
      m,
      resultados,
      usedPrefix,
      query
    )

  } catch (error) {

    console.error(
      '[TIKTOK]',
      error
    )

    return conn.sendMessage(
      m.chat,
      {
        text:
          `❌ *Error al buscar TikTok.*\n\n` +
          `> ${error.message}`
      },
      {
        quoted: m.raw
      }
    )
  }
}

/* ═══════════════════════════════════════
   CONFIGURACIÓN
═══════════════════════════════════════ */

handler.help = [
  'tiktok <búsqueda>'
]

handler.tags = [
  'tiktok'
]

handler.command = [
  'tiktok',
  'tiktokget',
  'tiktokmas'
]

handler.registro = false

module.exports = handler