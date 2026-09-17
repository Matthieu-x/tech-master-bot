const { enviarBotones, enviarLista } = require('../lib/botones')
const puppeteer = require('puppeteer')
const sharp = require('sharp')
const ffmpegPath = require('ffmpeg-static')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const API_KEY = process.env.ORBIT_API_KEY || 'MATTH-HIEUX'
const API_BASE = 'https://orbitcloud.hidenfree.com/api/v1'
const ORBIT_IP = process.env.ORBIT_IP || '10.25.121.79'

const TIEMPO_SELECCION_MS = 5 * 60 * 1000
const MAX_RESULTADOS = 10

const CARD_WIDTH = 720
const CARD_HEIGHT = 900

const FPS = 12
const FRAMES = 36

if (!global.tiktokPendientes) {
  global.tiktokPendientes = new Map()
}

const pendientes = global.tiktokPendientes

/* =========================================================
   LIMPIAR BÚSQUEDAS EXPIRADAS
========================================================= */

function limpiarVencidas() {
  const ahora = Date.now()

  for (const [clave, valor] of pendientes) {
    if (!valor || ahora > valor.expira) {
      pendientes.delete(clave)
    }
  }
}

/* =========================================================
   CLAVE DE USUARIO
========================================================= */

function claveBusqueda(m) {
  return `${m.chat}_${m.senderNumero || m.sender}`
}

/* =========================================================
   API ORBIT
========================================================= */

async function orbitFetch(apiPath, params = {}) {
  const qs = new URLSearchParams({
    apikey: API_KEY,
    ...params
  }).toString()

  const url = `${API_BASE}/${apiPath}?${qs}`

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
      throw new Error('Se agotaron las solicitudes (429)')
    }

    throw new Error(`HTTP ${res.status}`)
  }

  return res.json()
}

/* =========================================================
   BUSCAR TIKTOK
========================================================= */

async function buscarTikTok(query) {
  const data = await orbitFetch('tiktok-search', {
    query
  })

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

/* =========================================================
   DESCARGAR TIKTOK
========================================================= */

async function descargarTikTokPorUrl(url) {
  const data = await orbitFetch('download/tiktok', {
    url
  })

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

/* =========================================================
   FORMATEAR NÚMEROS
========================================================= */

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

/* =========================================================
   FORMATEAR DURACIÓN
========================================================= */

function formatearDuracion(seg) {
  const s = Number(seg) || 0

  const m = Math.floor(s / 60)
  const r = s % 60

  return m > 0
    ? `${m}m ${r}s`
    : `${r}s`
}

/* =========================================================
   ESCAPAR HTML
========================================================= */

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/* =========================================================
   CREAR TARJETA ANIMADA
========================================================= */

async function crearTarjetaTikTok(video) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tiktok-card-')
  )

  const framesDir = path.join(
    tempDir,
    'frames'
  )

  fs.mkdirSync(framesDir, {
    recursive: true
  })

  const outputVideo = path.join(
    tempDir,
    'tiktok-card.mp4'
  )

  const cover =
    video.video?.cover ||
    video.video?.originCover ||
    video.video?.dynamicCover ||
    ''

  const author =
    video.author?.uniqueId ||
    '?'

  const nickname =
    video.author?.nickname ||
    ''

  const descripcion =
    video.desc ||
    'Sin descripción'

  const views = formatearNumero(
    video.stats?.playCount
  )

  const likes = formatearNumero(
    video.stats?.diggCount
  )

  const comments = formatearNumero(
    video.stats?.commentCount
  )

  const duration = formatearDuracion(
    video.video?.duration
  )

  const url = video.url || ''

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  })

  try {
    const page = await browser.newPage()

    await page.setViewport({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
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
  width: 720px;
  height: 900px;
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
  position: relative;

  width: 720px;
  height: 900px;

  overflow: hidden;

  background: #090909;

  border-radius: 38px;

  color: white;

  box-shadow:
    0 30px 80px rgba(0, 0, 0, .75);
}

/* =====================================================
   FONDO
===================================================== */

.background {
  position: absolute;

  inset: -70px;

  background-image:
    url("${escapeHtml(cover)}");

  background-size: cover;
  background-position: center;

  filter:
    blur(35px)
    brightness(.35)
    saturate(1.25);

  transform: scale(1.15);

  animation:
    backgroundMove 6s ease-in-out infinite alternate;
}

@keyframes backgroundMove {

  from {
    transform:
      scale(1.15)
      translate(-12px, -8px);
  }

  to {
    transform:
      scale(1.23)
      translate(12px, 8px);
  }

}

/* =====================================================
   OVERLAY
===================================================== */

.overlay {
  position: absolute;

  inset: 0;

  background:
    linear-gradient(
      180deg,
      rgba(0,0,0,.25) 0%,
      rgba(0,0,0,.10) 25%,
      rgba(0,0,0,.35) 55%,
      rgba(0,0,0,.96) 100%
    );
}

/* =====================================================
   LUZ ANIMADA
===================================================== */

.light {
  position: absolute;

  width: 500px;
  height: 500px;

  border-radius: 50%;

  background:
    radial-gradient(
      circle,
      rgba(255,255,255,.12),
      transparent 65%
    );

  filter: blur(25px);

  animation:
    lightMove 5s ease-in-out infinite alternate;
}

@keyframes lightMove {

  from {
    transform:
      translate(
        -180px,
        -160px
      );
  }

  to {
    transform:
      translate(
        400px,
        250px
      );
  }

}

/* =====================================================
   CONTENIDO
===================================================== */

.content {
  position: absolute;

  inset: 0;

  padding: 38px;

  display: flex;

  flex-direction: column;

  justify-content: space-between;
}

/* =====================================================
   HEADER
===================================================== */

.header {
  display: flex;

  align-items: center;

  justify-content: space-between;
}

.brand {
  font-size: 22px;

  font-weight: 700;

  letter-spacing: .4px;
}

.creator {
  margin-top: 5px;

  font-size: 13px;

  color: rgba(255,255,255,.65);
}

.badge {
  padding:
    9px
    15px;

  border-radius: 999px;

  background:
    rgba(255,255,255,.10);

  border:
    1px solid
    rgba(255,255,255,.16);

  backdrop-filter:
    blur(15px);

  font-size: 13px;

  font-weight: 600;
}

/* =====================================================
   CENTRO
===================================================== */

.center {
  margin-top: auto;

  margin-bottom: auto;

  display: flex;

  flex-direction: column;

  justify-content: center;
}

/* =====================================================
   AUTOR
===================================================== */

.author {
  font-size: 28px;

  font-weight: 800;

  margin-bottom: 8px;

  text-shadow:
    0 2px 12px
    rgba(0,0,0,.7);
}

.nickname {
  font-size: 15px;

  color:
    rgba(255,255,255,.72);

  margin-bottom: 18px;
}

/* =====================================================
   DESCRIPCIÓN
===================================================== */

.description {
  font-size: 24px;

  line-height: 1.25;

  font-weight: 600;

  max-height: 120px;

  overflow: hidden;

  text-shadow:
    0 2px 12px
    rgba(0,0,0,.85);
}

/* =====================================================
   ESTADÍSTICAS
===================================================== */

.stats {
  display: flex;

  gap: 12px;

  margin-top: 24px;

  flex-wrap: wrap;
}

.stat {
  padding:
    11px
    15px;

  border-radius: 16px;

  background:
    rgba(0,0,0,.42);

  border:
    1px solid
    rgba(255,255,255,.12);

  backdrop-filter:
    blur(15px);

  font-size: 14px;

  font-weight: 600;
}

/* =====================================================
   FOOTER
===================================================== */

.footer {
  display: flex;

  align-items: center;

  justify-content: space-between;

  padding-top: 20px;

  border-top:
    1px solid
    rgba(255,255,255,.12);
}

.url {
  max-width: 450px;

  overflow: hidden;

  white-space: nowrap;

  text-overflow: ellipsis;

  font-size: 12px;

  color:
    rgba(255,255,255,.55);
}

.duration {
  font-size: 14px;

  font-weight: 700;

  padding:
    9px
    13px;

  border-radius: 12px;

  background:
    rgba(255,255,255,.10);
}

</style>

</head>

<body>

<div class="card">

  <div class="background"></div>

  <div class="light"></div>

  <div class="overlay"></div>

  <div class="content">

    <div class="header">

      <div>

        <div class="brand">
          🎬 TikTok Search
        </div>

        <div class="creator">
          Creator · Matthieu
        </div>

      </div>

      <div class="badge">
        TIKTOK
      </div>

    </div>

    <div class="center">

      <div class="author">
        @${escapeHtml(author)}
      </div>

      <div class="nickname">
        ${escapeHtml(nickname)}
      </div>

      <div class="description">
        ${escapeHtml(descripcion)}
      </div>

      <div class="stats">

        <div class="stat">
          👁️ ${views}
        </div>

        <div class="stat">
          ❤️ ${likes}
        </div>

        <div class="stat">
          💬 ${comments}
        </div>

      </div>

    </div>

    <div class="footer">

      <div class="url">
        ${escapeHtml(url)}
      </div>

      <div class="duration">
        ⏱ ${duration}
      </div>

    </div>

  </div>

</div>

</body>
</html>
`

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    await page.evaluate(() => {
      document.fonts.ready
    })

    /* =====================================================
       GENERAR FRAMES
    ===================================================== */

    for (let i = 0; i < FRAMES; i++) {

      const progreso = i / FRAMES

      await page.evaluate((progreso) => {

        const light =
          document.querySelector('.light')

        const background =
          document.querySelector('.background')

        if (light) {

          const x =
            Math.sin(progreso * Math.PI * 2)
            * 280

          const y =
            Math.cos(progreso * Math.PI * 2)
            * 180

          light.style.transform =
            `translate(${x}px, ${y}px)`
        }

        if (background) {

          const scale =
            1.15 +
            Math.sin(
              progreso *
              Math.PI *
              2
            ) *
            .055

          const x =
            Math.sin(
              progreso *
              Math.PI *
              2
            ) *
            12

          const y =
            Math.cos(
              progreso *
              Math.PI *
              2
            ) *
            10

          background.style.transform =
            `scale(${scale}) translate(${x}px, ${y}px)`
        }

      }, progreso)

      const screenshot =
        await page.screenshot({
          type: 'png'
        })

      const framePath =
        path.join(
          framesDir,
          `frame-${String(i).padStart(4, '0')}.png`
        )

      /*
       * SHARP:
       * Procesamos la captura y la dejamos
       * exactamente en el tamaño del video.
       */

      await sharp(screenshot)
        .resize(
          CARD_WIDTH,
          CARD_HEIGHT,
          {
            fit: 'fill'
          }
        )
        .png({
          compressionLevel: 6
        })
        .toFile(framePath)
    }

  } finally {

    await browser.close()
  }

  /* =====================================================
     FFMPEG
  ===================================================== */

  await ejecutarFFmpeg([
    '-y',

    '-framerate',
    String(FPS),

    '-i',
    path.join(
      framesDir,
      'frame-%04d.png'
    ),

    '-c:v',
    'libx264',

    '-pix_fmt',
    'yuv420p',

    '-movflags',
    '+faststart',

    '-vf',
    `scale=${CARD_WIDTH}:${CARD_HEIGHT}:force_original_aspect_ratio=decrease,pad=${CARD_WIDTH}:${CARD_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,

    '-r',
    String(FPS),

    outputVideo
  ])

  return {
    file: outputVideo,
    tempDir
  }
}

/* =========================================================
   EJECUTAR FFMPEG
========================================================= */

function ejecutarFFmpeg(args) {
  return new Promise((resolve, reject) => {

    const proceso =
      spawn(ffmpegPath, args)

    let stderr = ''

    proceso.stderr.on(
      'data',
      data => {
        stderr += data.toString()
      }
    )

    proceso.on(
      'error',
      error => {
        reject(error)
      }
    )

    proceso.on(
      'close',
      code => {

        if (code === 0) {
          resolve()
          return
        }

        reject(
          new Error(
            `FFmpeg terminó con código ${code}\n${stderr}`
          )
        )
      }
    )
  })
}

/* =========================================================
   BORRAR ARCHIVOS TEMPORALES
========================================================= */

function eliminarDirectorio(dir) {

  try {

    if (fs.existsSync(dir)) {

      fs.rmSync(dir, {
        recursive: true,
        force: true
      })

    }

  } catch (error) {

    console.error(
      '[TIKTOK] Error limpiando temporales:',
      error.message
    )

  }
}

/* =========================================================
   LISTA DE TIKTOK
========================================================= */

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
        `Toca uno para enviarlo · expira en 5 min`,

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
                `${v.desc?.slice(0, 40) || 'Sin desc'}`,

              id:
                `${usedPrefix}tiktokget ${i}`,

              descripcion:
                `👁️ ${formatearNumero(
                  v.stats?.playCount
                )} · ` +

                `❤️ ${formatearNumero(
                  v.stats?.diggCount
                )} · ` +

                `⏱️ ${formatearDuracion(
                  v.video?.duration
                )}`

            }))
        }
      ]
    }
  )
}

/* =========================================================
   BOTÓN MÁS VIDEOS
========================================================= */

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
        `Expira en 5 min`,

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

/* =========================================================
   ENVIAR VIDEO
========================================================= */

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

  const caption =
    `🎬 *@${video.author?.uniqueId || '?'}* ` +
    `(${video.author?.nickname || ''})\n\n` +

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

    `🔗 ${video.url}`

  /*
   * PRIMERO GENERAMOS LA TARJETA
   */

  let tarjeta = null

  try {

    tarjeta =
      await crearTarjetaTikTok(video)

    /*
     * WhatsApp recibe MP4 con gifPlayback.
     * No se envía como documento.
     */

    await conn.sendMessage(
      m.chat,
      {
        video:
          fs.readFileSync(
            tarjeta.file
          ),

        gifPlayback:
          true,

        mimetype:
          'video/mp4',

        caption:
          ''
      },
      {
        quoted:
          m.raw
      }
    )

  } finally {

    if (tarjeta?.tempDir) {

      eliminarDirectorio(
        tarjeta.tempDir
      )

    }

  }

  /*
   * DESPUÉS ENVIAMOS EL TIKTOK REAL
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

/* =========================================================
   HANDLER
========================================================= */

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

  /* =====================================================
     TIKTOKGET
  ===================================================== */

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

  /* =====================================================
     TIKTOKMAS
  ===================================================== */

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

  /* =====================================================
     SIN TEXTO
  ===================================================== */

  if (
    !text ||
    !text.trim()
  ) {

    return conn.sendMessage(
      m.chat,
      {
        text:
          `🎬 Escribe qué buscar en TikTok.\n\n` +
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

  /* =====================================================
     BUSCAR
  ===================================================== */

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
      await buscarTikTok(query)

    if (!videos.length) {

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

/* =========================================================
   CONFIGURACIÓN
========================================================= */

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