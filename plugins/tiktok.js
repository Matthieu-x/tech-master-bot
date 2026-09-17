const { enviarBotones, enviarLista } = require('../lib/botones')
const puppeteer = require('puppeteer')
const GIFEncoder = require('gif-encoder-2')
const { PNG } = require('pngjs')

const API_KEY = process.env.ORBIT_API_KEY || 'MATTH-HIEUX'
const API_BASE = 'https://orbitcloud.hidenfree.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 5 * 60 * 1000
const MAX_RESULTADOS = 10

if (!global.tiktokPendientes) {
  global.tiktokPendientes = new Map()
}

const pendientes = global.tiktokPendientes

/* ═══════════════════════════════════════
   LIMPIAR BÚSQUEDAS VENCIDAS
═══════════════════════════════════════ */

function limpiarVencidas() {
  const ahora = Date.now()

  for (const [clave, valor] of pendientes) {
    if (!valor || ahora > valor.expira) {
      pendientes.delete(clave)
    }
  }
}

/* ═══════════════════════════════════════
   CLAVE DE USUARIO
═══════════════════════════════════════ */

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
      throw new Error(
        'API key inválida o IP no registrada (401)'
      )
    }

    if (res.status === 403) {
      throw new Error('IP bloqueada (403)')
    }

    if (res.status === 429) {
      throw new Error(
        'Se agotaron las solicitudes (429)'
      )
    }

    throw new Error(`HTTP ${res.status}`)
  }

  return res.json()
}

/* ═══════════════════════════════════════
   BUSCAR TIKTOK
═══════════════════════════════════════ */

async function buscarTikTok(query) {
  const data = await orbitFetch(
    'tiktok-search',
    { query }
  )

  if (
    !data ||
    data.status !== true ||
    !Array.isArray(data.results)
  ) {
    throw new Error(
      data?.error || 'Respuesta inválida'
    )
  }

  return data.results
}

/* ═══════════════════════════════════════
   DESCARGAR TIKTOK
═══════════════════════════════════════ */

async function descargarTikTokPorUrl(url) {
  const data = await orbitFetch(
    'download/tiktok',
    { url }
  )

  if (
    !data ||
    data.status !== true ||
    !data.data?.video
  ) {
    throw new Error(
      data?.error || 'Respuesta inválida'
    )
  }

  return data.data
}

/* ═══════════════════════════════════════
   FORMATEAR NÚMEROS
═══════════════════════════════════════ */

function formatearNumero(n) {
  if (!n) return '0'

  if (n >= 1_000_000) {
    return (
      n / 1_000_000
    ).toFixed(1) + 'M'
  }

  if (n >= 1_000) {
    return (
      n / 1_000
    ).toFixed(1) + 'K'
  }

  return String(n)
}

/* ═══════════════════════════════════════
   FORMATEAR DURACIÓN
═══════════════════════════════════════ */

function formatearDuracion(seg) {
  const s = Number(seg) || 0

  const m = Math.floor(s / 60)
  const r = s % 60

  return m > 0
    ? `${m}m ${r}s`
    : `${r}s`
}

/* ═══════════════════════════════════════
   ESCAPAR HTML
═══════════════════════════════════════ */

function escapeHTML(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/* ═══════════════════════════════════════
   GENERAR TARJETA GIF
═══════════════════════════════════════ */

async function generarTarjetaTikTok(video) {
  let browser = null

  try {
    const author =
      video.author?.uniqueId ||
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

    const vistas =
      formatearNumero(
        video.stats?.playCount
      )

    const likes =
      formatearNumero(
        video.stats?.diggCount
      )

    const comentarios =
      formatearNumero(
        video.stats?.commentCount
      )

    const duracion =
      formatearDuracion(
        video.video?.duration
      )

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

    const page =
      await browser.newPage()

    const WIDTH = 900
    const HEIGHT = 1050

    await page.setViewport({
      width: WIDTH,
      height: HEIGHT,
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
  height: 1050px;

  overflow: hidden;

  background: #050505;

  font-family:
    Arial,
    Helvetica,
    sans-serif;
}

body {
  display: flex;

  align-items: center;
  justify-content: center;
}

.card {

  width: 820px;
  height: 970px;

  padding: 30px;

  border-radius: 38px;

  overflow: hidden;

  position: relative;

  background:
    radial-gradient(
      circle at var(--x1) var(--y1),
      rgba(255, 0, 80, .25),
      transparent 34%
    ),

    radial-gradient(
      circle at var(--x2) var(--y2),
      rgba(0, 242, 234, .20),
      transparent 36%
    ),

    #101010;

  border:
    1px solid
    rgba(255,255,255,.10);

  box-shadow:
    0 30px 80px
    rgba(0,0,0,.75);

  color: white;
}

.glow {

  position: absolute;

  width: 350px;
  height: 350px;

  border-radius: 50%;

  background:
    radial-gradient(
      circle,
      rgba(255,0,80,.18),
      transparent 70%
    );

  filter: blur(30px);

  transform:
    translate(
      var(--gx),
      var(--gy)
    );

  pointer-events: none;
}

.header {

  height: 65px;

  display: flex;

  align-items: center;

  justify-content:
    space-between;

  position: relative;

  z-index: 3;
}

.brand {

  font-size: 34px;

  font-weight: 900;

  letter-spacing: -1px;
}

.brand span {
  color: #ff0050;
}

.creator {

  padding:
    10px 18px;

  border-radius: 30px;

  background:
    rgba(255,255,255,.07);

  border:
    1px solid
    rgba(255,255,255,.10);

  font-size: 16px;

  font-weight: 700;
}

.cover {

  width: 100%;
  height: 550px;

  object-fit: cover;

  display: block;

  border-radius: 28px;

  position: relative;

  z-index: 2;

  box-shadow:
    0 20px 50px
    rgba(0,0,0,.45);
}

.cover-fallback {

  width: 100%;
  height: 550px;

  border-radius: 28px;

  background: #181818;

  display: flex;

  align-items: center;

  justify-content: center;

  color: #777;

  font-size: 24px;
}

.author {

  display: flex;

  align-items: center;

  gap: 15px;

  margin-top: 24px;

  position: relative;

  z-index: 3;
}

.avatar {

  width: 58px;
  height: 58px;

  flex-shrink: 0;

  border-radius: 50%;

  display: flex;

  align-items: center;
  justify-content: center;

  font-size: 25px;

  font-weight: 900;

  background:
    linear-gradient(
      135deg,
      #ff0050,
      #00f2ea
    );

  box-shadow:
    0 0 25px
    rgba(255,0,80,.20);
}

.username {

  font-size: 23px;

  font-weight: 800;
}

.nickname {

  margin-top: 4px;

  color: #999;

  font-size: 15px;
}

.description {

  margin-top: 20px;

  padding: 18px;

  min-height: 70px;

  max-height: 92px;

  overflow: hidden;

  border-radius: 20px;

  background:
    rgba(255,255,255,.055);

  border:
    1px solid
    rgba(255,255,255,.05);

  color: #eee;

  font-size: 17px;

  line-height: 1.4;

  position: relative;

  z-index: 3;
}

.stats {

  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 14px;

  margin-top: 17px;

  position: relative;

  z-index: 3;
}

.stat {

  padding:
    15px 8px;

  border-radius: 18px;

  text-align: center;

  background:
    rgba(255,255,255,.055);

  border:
    1px solid
    rgba(255,255,255,.06);
}

.number {

  font-size: 22px;

  font-weight: 900;
}

.label {

  margin-top: 4px;

  color: #888;

  font-size: 12px;

  font-weight: 700;
}

.duration {

  position: absolute;

  right: 50px;
  top: 570px;

  z-index: 5;

  padding:
    9px 14px;

  border-radius: 12px;

  background:
    rgba(0,0,0,.78);

  font-size: 16px;

  font-weight: 800;
}

</style>

</head>

<body>

<div
  class="card"
  id="card"
>

  <div class="glow"></div>

  <div class="header">

    <div class="brand">
      <span>♪</span> TikTok
    </div>

    <div class="creator">
      Creator · Matthieu
    </div>

  </div>

  ${
    cover
      ? `
        <img
          class="cover"
          src="${escapeHTML(cover)}"
        >
      `
      : `
        <div class="cover-fallback">
          Sin portada disponible
        </div>
      `
  }

  <div class="duration">
    ${escapeHTML(duracion)}
  </div>

  <div class="author">

    <div class="avatar">
      ${escapeHTML(
        author
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

      <div class="number">
        ${vistas}
      </div>

      <div class="label">
        VISTAS
      </div>

    </div>

    <div class="stat">

      <div class="number">
        ${likes}
      </div>

      <div class="label">
        LIKES
      </div>

    </div>

    <div class="stat">

      <div class="number">
        ${comentarios}
      </div>

      <div class="label">
        COMENTARIOS
      </div>

    </div>

  </div>

</div>

</body>

</html>
`

    await page.setContent(
      html,
      {
        waitUntil:
          'networkidle0'
      }
    )

    /*
     * Esperar a que la portada
     * termine de cargar.
     */

    await page.evaluate(async () => {

      const images =
        Array.from(
          document.images
        )

      await Promise.all(
        images.map(img => {

          if (img.complete) {
            return
          }

          return new Promise(
            resolve => {

              img.onload =
                resolve

              img.onerror =
                resolve

            }
          )
        })
      )

    })

    /*
     * Crear GIF
     */

    const encoder =
      new GIFEncoder(
        WIDTH,
        HEIGHT
      )

    encoder.setRepeat(0)

    encoder.setDelay(100)

    encoder.setQuality(8)

    encoder.start()

    /*
     * 24 frames
     * = aproximadamente
     * 2.4 segundos.
     */

    const FRAMES = 24

    for (
      let i = 0;
      i < FRAMES;
      i++
    ) {

      const progress =
        i / FRAMES

      const angle =
        progress *
        Math.PI *
        2

      const x1 =
        20 +
        Math.sin(angle) * 25

      const y1 =
        20 +
        Math.cos(angle) * 20

      const x2 =
        80 +
        Math.cos(angle) * 20

      const y2 =
        80 +
        Math.sin(angle) * 25

      const gx =
        Math.sin(angle) * 120

      const gy =
        Math.cos(angle) * 90

      await page.evaluate(
        ({
          x1,
          y1,
          x2,
          y2,
          gx,
          gy,
          progress
        }) => {

          const card =
            document.getElementById(
              'card'
            )

          card.style.setProperty(
            '--x1',
            `${x1}%`
          )

          card.style.setProperty(
            '--y1',
            `${y1}%`
          )

          card.style.setProperty(
            '--x2',
            `${x2}%`
          )

          card.style.setProperty(
            '--y2',
            `${y2}%`
          )

          card.style.setProperty(
            '--gx',
            `${gx}px`
          )

          card.style.setProperty(
            '--gy',
            `${gy}px`
          )

          /*
           * Zoom muy suave.
           */

          const scale =
            1 +
            Math.sin(
              progress *
              Math.PI *
              2
            ) *
            0.006

          card.style.transform =
            `scale(${scale})`

        },
        {
          x1,
          y1,
          x2,
          y2,
          gx,
          gy,
          progress
        }
      )

      const screenshot =
        await page.screenshot({
          type: 'png'
        })

      const png =
        PNG.sync.read(
          screenshot
        )

      encoder.addFrame(
        png.data
      )
    }

    encoder.finish()

    return encoder.out.getData()

  } finally {

    if (browser) {
      await browser.close()
    }

  }
}

/* ═══════════════════════════════════════
   LISTA DE TIKTOK
═══════════════════════════════════════ */

async function enviarListaTikTok(
  conn,
  m,
  videos,
  usedPrefix,
  query
) {

  return enviarLista(
    conn,
    m.chat,
    {

      texto:
        `🎬 *TikTok:* ${query}\n\n` +
        `📦 Resultados: ${videos.length}`,

      footer:
        'Toca uno para enviarlo · expira en 5 min',

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
            videos.map(
              (v, i) => ({

                titulo:
                  `@${v.author?.uniqueId || '?'} · ` +
                  `${v.desc?.slice(0, 40) || 'Sin desc'}`,

                id:
                  `${usedPrefix}tiktokget ${i}`,

                descripcion:
                  `👁️ ${formatearNumero(v.stats?.playCount)}` +
                  ` · ❤️ ${formatearNumero(v.stats?.diggCount)}` +
                  ` · ⏱️ ${formatearDuracion(v.video?.duration)}`
              })
            )
        }

      ]
    }
  )
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

  return enviarBotones(
    conn,
    m.chat,
    {

      texto:
        `✅ *Video enviado*\n\n` +
        `🔎 Búsqueda: ${query}\n` +
        `📦 Restantes: ${restantes}`,

      footer:
        'Expira en 5 min',

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
    }
  )
}

/* ═══════════════════════════════════════
   ENVIAR TARJETA GIF + VIDEO
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
    (
      nickname
        ? ` (${nickname})`
        : ''
    ) +

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
    )} comentarios\n` +

    `🔗 ${video.url || ''}`

  /*
   * TARJETA GIF
   */

  try {

    const tarjeta =
      await generarTarjetaTikTok(
        video
      )

    await conn.sendMessage(
      m.chat,
      {

        video:
          tarjeta,

        gifPlayback:
          true,

        caption:
          ''

      },
      {
        quoted:
          m.raw
      }
    )

  } catch (error) {

    console.error(
      '[TIKTOK CARD]',
      error
    )

  }

  /*
   * VIDEO TIKTOK
   */

  return conn.sendMessage(
    m.chat,
    {

      video: {
        url:
          urlVideo
      },

      mimetype:
        'video/mp4',

      caption

    },
    {
      quoted:
        m.raw
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
    (command || '')
      .toLowerCase()

  const clave =
    claveBusqueda(m)

  /* ═════════════════════════════
     TIKTOKGET
  ═════════════════════════════ */

  if (
    comando === 'tiktokget'
  ) {

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
            `❌ Esa búsqueda expiró.\n\n` +
            `> Usa ${usedPrefix}tiktok de nuevo.`
        },
        {
          quoted:
            m.raw
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

      if (
        restantes > 0
      ) {

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
            `❌ Error al enviar el video.\n\n` +
            `> ${e.message}`
        },
        {
          quoted:
            m.raw
        }
      )
    }
  }

  /* ═════════════════════════════
     TIKTOKMAS
  ═════════════════════════════ */

  if (
    comando === 'tiktokmas'
  ) {

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
            `❌ Expiró la búsqueda.\n\n` +
            `> Usa ${usedPrefix}tiktok de nuevo.`
        },
        {
          quoted:
            m.raw
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

  /* ═════════════════════════════
     SIN TEXTO
  ═════════════════════════════ */

  if (
    !text ||
    !text.trim()
  ) {

    return conn.sendMessage(
      m.chat,
      {
        text:
          `🎬 *TikTok Search*\n\n` +
          `Escribe qué buscar.\n\n` +
          `📌 Ejemplo:\n` +
          `${usedPrefix}tiktok goku`
      },
      {
        quoted:
          m.raw
      }
    )
  }

  const query =
    text.trim()

  /* ═════════════════════════════
     BUSCAR
  ═════════════════════════════ */

  try {

    await conn.sendMessage(
      m.chat,
      {
        text:
          `🎬 *Buscando en TikTok...*\n\n` +
          `> ${query}`
      },
      {
        quoted:
          m.raw
      }
    )

    const videos =
      await buscarTikTok(
        query
      )

    if (
      !videos.length
    ) {

      return conn.sendMessage(
        m.chat,
        {
          text:
            `❌ No encontré videos para:\n` +
            `> ${query}`
        },
        {
          quoted:
            m.raw
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
        videos:
          resultados,

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
          `❌ Error al buscar.\n\n` +
          `> ${error.message}`
      },
      {
        quoted:
          m.raw
      }
    )
  }
}

/* ═══════════════════════════════════════
   CONFIG
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