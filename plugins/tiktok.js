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

// ==========================================
// CONFIGURACIÓN DE LA TARJETA
// ==========================================

const CARD_WIDTH = 720
const CARD_HEIGHT = 900

// 12 FPS × 10 segundos = 120 frames
const FPS = 12
const DURACION_CARD = 10
const FRAMES = FPS * DURACION_CARD

if (!global.tiktokPendientes) {
  global.tiktokPendientes = new Map()
}

const pendientes = global.tiktokPendientes

// ==========================================
// LIMPIAR BÚSQUEDAS EXPIRADAS
// ==========================================

function limpiarVencidas() {
  const ahora = Date.now()

  for (const [clave, valor] of pendientes) {
    if (!valor || ahora > valor.expira) {
      pendientes.delete(clave)
    }
  }
}

// ==========================================
// CLAVE DE BÚSQUEDA
// ==========================================

function claveBusqueda(m) {
  return `${m.chat}_${m.senderNumero || m.sender}`
}

// ==========================================
// ESCAPAR HTML
// ==========================================

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ==========================================
// FORMATEAR NÚMEROS
// ==========================================

function formatearNumero(n) {
  if (!n) return '0'

  n = Number(n) || 0

  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1) + 'M'
  }

  if (n >= 1_000) {
    return (n / 1_000).toFixed(1) + 'K'
  }

  return String(n)
}

// ==========================================
// FORMATEAR DURACIÓN
// ==========================================

function formatearDuracion(seg) {
  const s = Number(seg) || 0

  const m = Math.floor(s / 60)
  const r = s % 60

  return m > 0
    ? `${m}m ${r}s`
    : `${r}s`
}

// ==========================================
// ORBIT API
// ==========================================

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
      throw new Error(
        'Se agotaron las solicitudes (429)'
      )
    }

    throw new Error(`HTTP ${res.status}`)
  }

  return res.json()
}

// ==========================================
// BUSCAR TIKTOK
// ==========================================

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

// ==========================================
// DESCARGAR TIKTOK
// ==========================================

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

// ==========================================
// EJECUTAR FFMPEG
// ==========================================

function ejecutarFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(
      ffmpegPath,
      args
    )

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

// ==========================================
// ELIMINAR TEMPORALES
// ==========================================

function eliminarDirectorio(dir) {
  try {
    if (
      dir &&
      fs.existsSync(dir)
    ) {
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

// ==========================================
// CREAR TARJETA ANIMADA
// ==========================================

async function crearTarjetaTikTok(video) {
  const tempDir = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'tiktok-card-'
    )
  )

  const framesDir = path.join(
    tempDir,
    'frames'
  )

  fs.mkdirSync(
    framesDir,
    {
      recursive: true
    }
  )

  const outputVideo = path.join(
    tempDir,
    'card.mp4'
  )

  const cover =
    video.video?.cover ||
    video.video?.originCover ||
    video.video?.dynamicCover ||
    ''

  if (!cover) {
    eliminarDirectorio(tempDir)
    throw new Error(
      'El TikTok no proporcionó una miniatura'
    )
  }

  const author =
    video.author?.uniqueId ||
    '?'

  const nickname =
    video.author?.nickname ||
    ''

  const descripcion =
    video.desc ||
    'Sin descripción'

  const views =
    formatearNumero(
      video.stats?.playCount
    )

  const likes =
    formatearNumero(
      video.stats?.diggCount
    )

  const comments =
    formatearNumero(
      video.stats?.commentCount
    )

  const duration =
    formatearDuracion(
      video.video?.duration
    )

  const url =
    video.url || ''

  // ========================================
  // PUPPETEER
  // ========================================

  const browser =
    await puppeteer.launch({
      headless: true,

      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    })

  try {
    const page =
      await browser.newPage()

    await page.setViewport({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      deviceScaleFactor: 1
    })

    // ======================================
    // HTML DE LA TARJETA
    // ======================================

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

  width: ${CARD_WIDTH}px;
  height: ${CARD_HEIGHT}px;

  overflow: hidden;

  border-radius: 38px;

  color: white;

  background: #080808;

  box-shadow:
    0 30px 80px
    rgba(0,0,0,.75);
}

/* ========================================
   FONDO CON LA MISMA MINIATURA
======================================== */

.background {

  position: absolute;

  inset: -80px;

  background-image:
    url("${escapeHtml(cover)}");

  background-size: cover;

  background-position: center;

  filter:
    blur(38px)
    brightness(.30)
    saturate(1.35);

  transform: scale(1.18);
}

/* ========================================
   OSCURECER FONDO
======================================== */

.overlay {

  position: absolute;

  inset: 0;

  background:
    linear-gradient(
      180deg,
      rgba(0,0,0,.22) 0%,
      rgba(0,0,0,.12) 25%,
      rgba(0,0,0,.40) 60%,
      rgba(0,0,0,.97) 100%
    );
}

/* ========================================
   LUZ ANIMADA
======================================== */

.light {

  position: absolute;

  width: 520px;
  height: 520px;

  border-radius: 50%;

  background:
    radial-gradient(
      circle,
      rgba(255,255,255,.14),
      transparent 68%
    );

  filter: blur(30px);

  transform:
    translate(-200px,-180px);
}

/* ========================================
   CONTENIDO
======================================== */

.content {

  position: absolute;

  inset: 0;

  padding: 36px;

  display: flex;

  flex-direction: column;

  justify-content: space-between;
}

/* ========================================
   HEADER
======================================== */

.header {

  display: flex;

  align-items: center;

  justify-content: space-between;
}

.brand {

  font-size: 22px;

  font-weight: 800;

  letter-spacing: .3px;
}

.creator {

  margin-top: 5px;

  font-size: 13px;

  color:
    rgba(255,255,255,.65);
}

.badge {

  padding:
    9px 15px;

  border-radius: 999px;

  background:
    rgba(255,255,255,.10);

  border:
    1px solid
    rgba(255,255,255,.16);

  font-size: 13px;

  font-weight: 700;

  backdrop-filter:
    blur(15px);
}

/* ========================================
   CENTRO
======================================== */

.center {

  margin-top: auto;

  margin-bottom: auto;

  display: flex;

  flex-direction: column;
}

/* ========================================
   MINIATURA
======================================== */

.thumbnail {

  width: 100%;

  height: 370px;

  overflow: hidden;

  border-radius: 28px;

  margin-bottom: 25px;

  background: #111;

  border:
    1px solid
    rgba(255,255,255,.15);

  box-shadow:
    0 20px 50px
    rgba(0,0,0,.55);
}

.thumbnail img {

  width: 100%;
  height: 100%;

  display: block;

  object-fit: cover;
}

/* ========================================
   AUTOR
======================================== */

.author {

  font-size: 28px;

  font-weight: 800;

  margin-bottom: 5px;

  text-shadow:
    0 3px 15px
    rgba(0,0,0,.8);
}

.nickname {

  font-size: 15px;

  color:
    rgba(255,255,255,.70);

  margin-bottom: 15px;
}

/* ========================================
   DESCRIPCIÓN
======================================== */

.description {

  font-size: 22px;

  line-height: 1.25;

  font-weight: 600;

  max-height: 84px;

  overflow: hidden;

  text-shadow:
    0 3px 15px
    rgba(0,0,0,.9);
}

/* ========================================
   ESTADÍSTICAS
======================================== */

.stats {

  display: flex;

  gap: 10px;

  margin-top: 19px;
}

.stat {

  padding:
    10px 14px;

  border-radius: 15px;

  background:
    rgba(0,0,0,.45);

  border:
    1px solid
    rgba(255,255,255,.12);

  font-size: 13px;

  font-weight: 700;

  backdrop-filter:
    blur(15px);
}

/* ========================================
   FOOTER
======================================== */

.footer {

  display: flex;

  align-items: center;

  justify-content: space-between;

  padding-top: 18px;

  border-top:
    1px solid
    rgba(255,255,255,.12);
}

.url {

  max-width: 470px;

  overflow: hidden;

  white-space: nowrap;

  text-overflow: ellipsis;

  font-size: 11px;

  color:
    rgba(255,255,255,.50);
}

.duration {

  padding:
    8px 12px;

  border-radius: 11px;

  background:
    rgba(255,255,255,.10);

  font-size: 13px;

  font-weight: 700;
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
          🎬 TikTok
        </div>

        <div class="creator">
          Creator · Matthieu
        </div>

      </div>

      <div class="badge">
        TikTok
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

    await page.setContent(
      html,
      {
        waitUntil:
          'networkidle0'
      }
    )

    // ======================================
    // GENERAR 120 FRAMES = 10 SEGUNDOS
    // ======================================

    for (
      let i = 0;
      i < FRAMES;
      i++
    ) {

      const progreso =
        i / FRAMES

      await page.evaluate(
        (progreso) => {

          const light =
            document.querySelector(
              '.light'
            )

          const background =
            document.querySelector(
              '.background'
            )

          const thumbnail =
            document.querySelector(
              '.thumbnail'
            )

          // Movimiento de luz
          if (light) {

            const x =
              Math.sin(
                progreso *
                Math.PI *
                2
              ) * 270

            const y =
              Math.cos(
                progreso *
                Math.PI *
                2
              ) * 190

            light.style.transform =
              `translate(${x}px,${y}px)`
          }

          // Movimiento del fondo
          if (background) {

            const scale =
              1.18 +
              Math.sin(
                progreso *
                Math.PI *
                2
              ) * .045

            const x =
              Math.sin(
                progreso *
                Math.PI *
                2
              ) * 10

            const y =
              Math.cos(
                progreso *
                Math.PI *
                2
              ) * 8

            background.style.transform =
              `scale(${scale}) translate(${x}px,${y}px)`
          }

          // Zoom suave de miniatura
          if (thumbnail) {

            const scale =
              1 +
              (
                Math.sin(
                  progreso *
                  Math.PI *
                  2
                ) + 1
              ) * .0125

            thumbnail.style.transform =
              `scale(${scale})`
          }

        },
        progreso
      )

      const screenshot =
        await page.screenshot({
          type: 'png'
        })

      const framePath =
        path.join(
          framesDir,
          `frame-${String(i).padStart(4, '0')}.png`
        )

      await sharp(
        screenshot
      )
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
        .toFile(
          framePath
        )
    }

  } finally {

    await browser.close()
  }

  // ========================================
  // CONVERTIR FRAMES A MP4
  // ========================================

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
    '27',

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

// ==========================================
// COMPRIMIR VIDEO DE TIKTOK
// ==========================================

async function comprimirTikTok(urlVideo) {
  const tempDir = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'tiktok-video-'
    )
  )

  const input =
    path.join(
      tempDir,
      'original.mp4'
    )

  const output =
    path.join(
      tempDir,
      'compressed.mp4'
    )

  try {

    // ======================================
    // DESCARGAR ORIGINAL
    // ======================================

    const respuesta =
      await fetch(
        urlVideo
      )

    if (!respuesta.ok) {
      throw new Error(
        `No se pudo descargar el video: HTTP ${respuesta.status}`
      )
    }

    const buffer =
      Buffer.from(
        await respuesta.arrayBuffer()
      )

    fs.writeFileSync(
      input,
      buffer
    )

    // ======================================
    // COMPRESIÓN
    // ======================================

    await ejecutarFFmpeg([
      '-y',

      '-i',
      input,

      // Máximo 720p
      '-vf',
      'scale=-2:min(720\\,ih)',

      '-c:v',
      'libx264',

      // Más pequeño
      '-crf',
      '28',

      '-preset',
      'veryfast',

      // Audio
      '-c:a',
      'aac',

      '-b:a',
      '96k',

      '-pix_fmt',
      'yuv420p',

      '-movflags',
      '+faststart',

      output
    ])

    return {
      file: output,
      tempDir
    }

  } catch (error) {

    eliminarDirectorio(
      tempDir
    )

    throw error
  }
}

// ==========================================
// ENVIAR VIDEO
// ==========================================

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

  let tarjeta = null
  let videoComprimido = null

  try {

    // ======================================
    // CREAR TARJETA DE 10 SEGUNDOS
    // ======================================

    tarjeta =
      await crearTarjetaTikTok(
        video
      )

    // ======================================
    // ENVIAR TARJETA
    // ======================================

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

        caption:
          ''
      },
      {
        quoted:
          m.raw
      }
    )

    // ======================================
    // COMPRIMIR TIKTOK
    // ======================================

    videoComprimido =
      await comprimirTikTok(
        urlVideo
      )

    // ======================================
    // MINIATURA PARA PREVIEW
    // ======================================

    let jpegThumbnail = null

    const cover =
      video.video?.cover ||
      video.video?.originCover ||
      video.video?.dynamicCover

    if (cover) {

      try {

        const thumbnailResponse =
          await fetch(
            cover
          )

        if (
          thumbnailResponse.ok
        ) {

          const thumbnailBuffer =
            Buffer.from(
              await thumbnailResponse.arrayBuffer()
            )

          jpegThumbnail =
            await sharp(
              thumbnailBuffer
            )
              .resize(
                320,
                320,
                {
                  fit: 'cover'
                }
              )
              .jpeg({
                quality: 75
              })
              .toBuffer()
        }

      } catch (e) {

        console.log(
          '[TIKTOK] Error creando miniatura:',
          e.message
        )
      }
    }

    // ======================================
    // CAPTION
    // ======================================

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

    const mensaje = {

      video:
        fs.readFileSync(
          videoComprimido.file
        ),

      mimetype:
        'video/mp4',

      caption
    }

    if (jpegThumbnail) {
      mensaje.jpegThumbnail =
        jpegThumbnail
    }

    // ======================================
    // ENVIAR TIKTOK COMPRIMIDO
    // ======================================

    return conn.sendMessage(
      m.chat,
      mensaje,
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

    if (
      videoComprimido?.tempDir
    ) {
      eliminarDirectorio(
        videoComprimido.tempDir
      )
    }
  }
}

// ==========================================
// LISTA
// ==========================================

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
            videos.map(
              (v, i) => ({

                titulo:
                  `@${v.author?.uniqueId || '?'} · ` +
                  `${v.desc?.slice(
                    0,
                    40
                  ) || 'Sin desc'}`,

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
              })
            )
        }
      ]
    }
  )
}

// ==========================================
// BOTÓN MÁS
// ==========================================

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

// ==========================================
// HANDLER
// ==========================================

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

  // ========================================
  // TIKTOKGET
  // ========================================

  if (
    comando === 'tiktokget'
  ) {

    const indice =
      Number(args[0])

    const pendiente =
      pendientes.get(
        clave
      )

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

  // ========================================
  // TIKTOKMAS
  // ========================================

  if (
    comando === 'tiktokmas'
  ) {

    const pendiente =
      pendientes.get(
        clave
      )

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

  // ========================================
  // SIN TEXTO
  // ========================================

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

  // ========================================
  // BUSCAR
  // ========================================

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

// ==========================================
// CONFIGURACIÓN
// ==========================================

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