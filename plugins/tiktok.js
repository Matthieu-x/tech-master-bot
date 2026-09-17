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
const DURACION_CARD = 10
const FRAMES = FPS * DURACION_CARD

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

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatearNumero(n) {
  n = Number(n) || 0

  if (n >= 1000000) {
    return (n / 1000000).toFixed(1) + 'M'
  }

  if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'K'
  }

  return String(n)
}

function formatearDuracion(seg) {
  const s = Number(seg) || 0
  const m = Math.floor(s / 60)
  const r = s % 60

  return m > 0
    ? `${m}m ${String(r).padStart(2, '0')}s`
    : `${r}s`
}

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
  const data = await orbitFetch('tiktok-search', { query })

  if (
    !data ||
    data.status !== true ||
    !Array.isArray(data.results)
  ) {
    throw new Error(data?.error || 'Respuesta inválida')
  }

  return data.results
}

function ejecutarFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(ffmpegPath, args)

    let stderr = ''

    proceso.stderr.on('data', data => {
      stderr += data.toString()
    })

    proceso.on('error', reject)

    proceso.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(
          new Error(
            `FFmpeg terminó con código ${code}\n${stderr}`
          )
        )
      }
    })
  })
}

function eliminarDirectorio(dir) {
  try {
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, {
        recursive: true,
        force: true
      })
    }
  } catch (e) {
    console.error(
      '[TIKTOK] Error limpiando temporales:',
      e.message
    )
  }
}

/*
========================================
CREAR TARJETA ANIMADA
========================================
*/

async function crearTarjetaTikTok(video) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tiktok-card-')
  )

  const framesDir = path.join(tempDir, 'frames')

  fs.mkdirSync(framesDir, {
    recursive: true
  })

  const outputVideo = path.join(
    tempDir,
    'card.mp4'
  )

  const cover =
    video.video?.cover ||
    video.video?.originCover ||
    video.video?.dynamicCover

  if (!cover) {
    eliminarDirectorio(tempDir)
    throw new Error('El TikTok no proporcionó miniatura')
  }

  const author =
    video.author?.uniqueId || '?'

  const nickname =
    video.author?.nickname || ''

  const descripcion =
    video.desc || 'Sin descripción'

  const views =
    formatearNumero(video.stats?.playCount)

  const likes =
    formatearNumero(video.stats?.diggCount)

  const comments =
    formatearNumero(video.stats?.commentCount)

  const duration =
    formatearDuracion(video.video?.duration)

  const url =
    video.url || ''

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
  width: ${CARD_WIDTH}px;
  height: ${CARD_HEIGHT}px;
  overflow: hidden;
  background: #000;
  font-family: Arial, Helvetica, sans-serif;
}

.card {
  position: relative;
  width: 720px;
  height: 900px;
  overflow: hidden;
  border-radius: 40px;
  color: white;
  background: #050505;
}

.background {
  position: absolute;
  inset: -100px;

  background-image:
    url("${escapeHtml(cover)}");

  background-size: cover;
  background-position: center;

  filter:
    blur(45px)
    brightness(.25)
    saturate(1.5);

  transform:
    scale(1.3)
    translate(0px, 0px);
}

.overlay {
  position: absolute;
  inset: 0;

  background:
    linear-gradient(
      180deg,
      rgba(0,0,0,.08) 0%,
      rgba(0,0,0,.12) 35%,
      rgba(0,0,0,.60) 72%,
      rgba(0,0,0,.98) 100%
    );
}

/* LUZ ANIMADA */

.beam {
  position: absolute;

  width: 260px;
  height: 1200px;

  left: -400px;
  top: -150px;

  transform:
    rotate(22deg);

  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,.08),
      rgba(255,255,255,.32),
      rgba(255,255,255,.08),
      transparent
    );

  filter: blur(22px);
}

/* BORDE ANIMADO */

.glow {
  position: absolute;
  inset: 8px;

  border-radius: 34px;

  border:
    2px solid
    rgba(255,255,255,.10);

  box-shadow:
    0 0 25px
    rgba(255,255,255,.05);
}

/* CONTENIDO */

.content {
  position: absolute;
  inset: 0;

  padding: 36px;

  display: flex;
  flex-direction: column;

  justify-content: space-between;
}

/* HEADER */

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  transform:
    translateY(0px);
}

.brand {
  font-size: 24px;
  font-weight: 900;
}

.creator {
  margin-top: 5px;
  font-size: 13px;
  color: rgba(255,255,255,.65);
}

.badge {
  padding: 10px 16px;

  border-radius: 999px;

  background:
    rgba(255,255,255,.10);

  border:
    1px solid
    rgba(255,255,255,.18);

  font-size: 13px;
  font-weight: 800;

  backdrop-filter: blur(15px);
}

/* CENTRO */

.center {
  margin-top: auto;
  margin-bottom: auto;

  transform:
    translateY(0px);
}

/* MINIATURA */

.thumbnail {
  position: relative;

  width: 648px;
  height: 390px;

  overflow: hidden;

  border-radius: 30px;

  margin-bottom: 26px;

  background: #111;

  border:
    1px solid
    rgba(255,255,255,.20);

  box-shadow:
    0 25px 70px
    rgba(0,0,0,.70);

  transform:
    scale(1);

  will-change: transform;
}

.thumbnail img {
  width: 100%;
  height: 100%;

  display: block;

  object-fit: cover;

  transform:
    scale(1);

  will-change: transform;
}

/* REFLEJO */

.thumbnail::after {
  content: "";

  position: absolute;

  inset: 0;

  background:
    linear-gradient(
      115deg,
      transparent 35%,
      rgba(255,255,255,.22) 48%,
      transparent 60%
    );

  transform:
    translateX(-130%);

  pointer-events: none;
}

/* AUTOR */

.author {
  font-size: 30px;
  font-weight: 900;

  margin-bottom: 5px;

  text-shadow:
    0 5px 20px
    rgba(0,0,0,.9);
}

.nickname {
  font-size: 15px;

  color:
    rgba(255,255,255,.68);

  margin-bottom: 15px;
}

/* DESCRIPCIÓN */

.description {
  font-size: 21px;

  line-height: 1.25;

  font-weight: 600;

  max-height: 82px;

  overflow: hidden;

  text-shadow:
    0 4px 18px
    rgba(0,0,0,.9);
}

/* ESTADÍSTICAS */

.stats {
  display: flex;
  gap: 10px;

  margin-top: 20px;
}

.stat {
  padding: 10px 14px;

  border-radius: 15px;

  background:
    rgba(0,0,0,.48);

  border:
    1px solid
    rgba(255,255,255,.14);

  font-size: 13px;
  font-weight: 800;

  backdrop-filter: blur(15px);
}

/* FOOTER */

.footer {
  display: flex;

  align-items: center;
  justify-content: space-between;

  padding-top: 18px;

  border-top:
    1px solid
    rgba(255,255,255,.14);
}

.url {
  max-width: 470px;

  overflow: hidden;

  white-space: nowrap;

  text-overflow: ellipsis;

  font-size: 11px;

  color:
    rgba(255,255,255,.48);
}

.duration {
  padding: 8px 12px;

  border-radius: 11px;

  background:
    rgba(255,255,255,.10);

  font-size: 13px;
  font-weight: 800;
}

</style>
</head>

<body>

<div class="card">

  <div class="background"></div>

  <div class="beam"></div>

  <div class="overlay"></div>

  <div class="glow"></div>

  <div class="content">

    <div class="header">

      <div>

        <div class="brand">
          🎬 TikTok
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

      <div class="thumbnail">

        <img
          src="${escapeHtml(cover)}"
        >

      </div>

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

    /*
    ========================================
    120 FRAMES
    12 FPS × 10 SEGUNDOS
    ========================================
    */

    for (let i = 0; i < FRAMES; i++) {

      const t = i / (FRAMES - 1)

      await page.evaluate((t) => {

        const bg =
          document.querySelector('.background')

        const beam =
          document.querySelector('.beam')

        const thumb =
          document.querySelector('.thumbnail')

        const thumbImg =
          document.querySelector('.thumbnail img')

        const center =
          document.querySelector('.center')

        const header =
          document.querySelector('.header')

        const glow =
          document.querySelector('.glow')

        /*
        ================================
        FONDO
        ================================
        */

        const angle =
          t * Math.PI * 2

        const bgX =
          Math.sin(angle) * 18

        const bgY =
          Math.cos(angle) * 14

        const bgScale =
          1.25 +
          (
            Math.sin(angle) + 1
          ) * 0.035

        bg.style.transform =
          `scale(${bgScale}) translate(${bgX}px, ${bgY}px)`

        /*
        ================================
        ZOOM MINIATURA
        ================================
        */

        const zoom =
          1.015 +
          (
            Math.sin(angle * 1.5) + 1
          ) * 0.018

        const imgX =
          Math.sin(angle * 1.2) * 7

        const imgY =
          Math.cos(angle * 1.1) * 5

        thumb.style.transform =
          `scale(${1 + Math.sin(angle) * 0.012})`

        thumbImg.style.transform =
          `scale(${zoom}) translate(${imgX}px, ${imgY}px)`

        /*
        ================================
        REFLEJO
        ================================
        */

        const shine =
          -130 +
          t * 260

        thumb.style.setProperty(
          '--shine',
          `${shine}%`
        )

        /*
        ================================
        LUZ
        ================================
        */

        const beamX =
          -500 +
          t * 1500

        beam.style.left =
          `${beamX}px`

        beam.style.opacity =
          String(
            0.65 +
            Math.sin(angle) * 0.25
          )

        /*
        ================================
        CONTENIDO
        ================================
        */

        const contentY =
          Math.sin(angle * 0.5) * 4

        center.style.transform =
          `translateY(${contentY}px)`

        header.style.transform =
          `translateY(${Math.cos(angle) * 3}px)`

        /*
        ================================
        BORDE
        ================================
        */

        const glowOpacity =
          0.08 +
          (
            Math.sin(angle * 2) + 1
          ) * 0.10

        glow.style.boxShadow =
          `0 0 35px rgba(255,255,255,${glowOpacity})`

        glow.style.borderColor =
          `rgba(255,255,255,${glowOpacity + 0.08})`

      }, t)

      /*
      ==================================
      CAPTURAR FRAME
      ==================================
      */

      const screenshot =
        await page.screenshot({
          type: 'png'
        })

      const framePath =
        path.join(
          framesDir,
          `frame-${String(i).padStart(4, '0')}.png`
        )

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

  /*
  ========================================
  PNG → MP4
  ========================================
  */

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

    '-preset',
    'veryfast',

    '-crf',
    '23',

    '-pix_fmt',
    'yuv420p',

    '-movflags',
    '+faststart',

    '-r',
    String(FPS),

    outputVideo
  ])

  return {
    file: outputVideo,
    tempDir
  }
}

/*
========================================
ENVIAR TIKTOK
========================================
*/

async function enviarVideoTikTok(
  conn,
  m,
  video
) {

  const urlVideo =
    video.video?.play ||
    video.video?.download

  if (!urlVideo) {
    throw new Error('Sin URL de video')
  }

  let tarjeta = null

  try {

    /*
    ======================================
    TARJETA ANIMADA
    ======================================
    */

    tarjeta =
      await crearTarjetaTikTok(video)

    /*
    ======================================
    ENVIAR TARJETA
    ======================================
    */

    await conn.sendMessage(
      m.chat,
      {
        video:
          fs.readFileSync(
            tarjeta.file
          ),

        mimetype:
          'video/mp4',

        gifPlayback:
          true,

        caption: ''
      },
      {
        quoted: m.raw
      }
    )

    /*
    ======================================
    TIKTOK ORIGINAL
    SIN COMPRESIÓN
    ======================================
    */

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
      )} comentarios\n\n` +

      `🔗 ${video.url || urlVideo}`

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

  } finally {

    if (tarjeta?.tempDir) {
      eliminarDirectorio(
        tarjeta.tempDir
      )
    }
  }
}

/*
========================================
LISTA
========================================
*/

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

/*
========================================
BOTÓN MÁS
========================================
*/

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

/*
========================================
HANDLER
========================================
*/

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

  /*
  ======================================
  TIKTOKGET
  ======================================
  */

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
          quoted: m.raw
        }
      )
    }

    return
  }

  /*
  ======================================
  TIKTOKMAS
  ======================================
  */

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

  /*
  ======================================
  SIN TEXTO
  ======================================
  */

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
        quoted: m.raw
      }
    )
  }

  const query =
    text.trim()

  /*
  ======================================
  BUSCAR
  ======================================
  */

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
            `❌ No encontré videos para:\n` +
            `> ${query}`
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
        quoted: m.raw
      }
    )
  }
}

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