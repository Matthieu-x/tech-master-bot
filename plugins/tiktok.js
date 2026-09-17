const { enviarBotones, enviarLista } = require('../lib/botones')

const puppeteer = require('puppeteer')
const sharp = require('sharp')
const ffmpegPath = require('ffmpeg-static')

const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

// ==========================================
// API
// ==========================================

const API_KEY =
  process.env.ORBIT_API_KEY || 'MATTH-HIEUX'

const API_BASE =
  'https://orbitcloud.hidenfree.com/api/v1'

const ORBIT_IP =
  process.env.ORBIT_IP || '10.25.121.79'

// ==========================================
// CONFIGURACIÓN
// ==========================================

const TIEMPO_SELECCION_MS =
  5 * 60 * 1000

const MAX_RESULTADOS = 10

// ==========================================
// TARJETA
// ==========================================

const CARD_WIDTH = 720
const CARD_HEIGHT = 900

const FPS = 12
const CARD_DURATION = 10
const FRAMES = FPS * CARD_DURATION

// ==========================================
// PENDIENTES
// ==========================================

if (!global.tiktokPendientes) {
  global.tiktokPendientes = new Map()
}

const pendientes =
  global.tiktokPendientes

// ==========================================
// LIMPIAR
// ==========================================

function limpiarVencidas() {

  const ahora = Date.now()

  for (const [clave, valor] of pendientes) {

    if (
      !valor ||
      ahora > valor.expira
    ) {
      pendientes.delete(clave)
    }
  }
}

// ==========================================
// CLAVE
// ==========================================

function claveBusqueda(m) {

  return `${m.chat}_${m.senderNumero || m.sender}`
}

// ==========================================
// HTML SAFE
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
// NÚMEROS
// ==========================================

function formatearNumero(n) {

  n = Number(n) || 0

  if (n >= 1000000000) {
    return (n / 1000000000).toFixed(1) + 'B'
  }

  if (n >= 1000000) {
    return (n / 1000000).toFixed(1) + 'M'
  }

  if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'K'
  }

  return String(n)
}

// ==========================================
// DURACIÓN
// ==========================================

function formatearDuracion(seg) {

  const s = Number(seg) || 0

  const minutos =
    Math.floor(s / 60)

  const segundos =
    s % 60

  return `${minutos}:${String(segundos).padStart(2, '0')}`
}

// ==========================================
// ORBIT
// ==========================================

async function orbitFetch(
  apiPath,
  params = {}
) {

  const qs =
    new URLSearchParams({
      apikey: API_KEY,
      ...params
    }).toString()

  const url =
    `${API_BASE}/${apiPath}?${qs}`

  const res =
    await fetch(url, {
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
      throw new Error(
        'IP bloqueada (403)'
      )
    }

    if (res.status === 429) {
      throw new Error(
        'Se agotaron las solicitudes (429)'
      )
    }

    throw new Error(
      `HTTP ${res.status}`
    )
  }

  return res.json()
}

// ==========================================
// BUSCAR
// ==========================================

async function buscarTikTok(query) {

  const data =
    await orbitFetch(
      'tiktok-search',
      { query }
    )

  if (
    !data ||
    data.status !== true ||
    !Array.isArray(data.results)
  ) {
    throw new Error(
      data?.error ||
      'Respuesta inválida'
    )
  }

  return data.results
}

// ==========================================
// FFMPEG
// ==========================================

function ejecutarFFmpeg(args) {

  return new Promise(
    (resolve, reject) => {

      const proceso =
        spawn(
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
        reject
      )

      proceso.on(
        'close',
        code => {

          if (code === 0) {
            resolve()
          } else {
            reject(
              new Error(
                `FFmpeg terminó con código ${code}\n${stderr}`
              )
            )
          }
        }
      )
    }
  )
}

// ==========================================
// LIMPIAR TEMP
// ==========================================

function eliminarDirectorio(dir) {

  try {

    if (
      dir &&
      fs.existsSync(dir)
    ) {

      fs.rmSync(
        dir,
        {
          recursive: true,
          force: true
        }
      )
    }

  } catch (e) {

    console.error(
      '[TIKTOK] Error limpiando:',
      e.message
    )
  }
}

// ==========================================
// MINIATURA
// ==========================================

async function descargarMiniatura(
  url,
  destino
) {

  const res =
    await fetch(url)

  if (!res.ok) {
    throw new Error(
      `No se pudo descargar la miniatura: HTTP ${res.status}`
    )
  }

  const buffer =
    Buffer.from(
      await res.arrayBuffer()
    )

  await sharp(buffer)
    .resize(
      900,
      600,
      {
        fit: 'cover',
        position: 'attention'
      }
    )
    .jpeg({
      quality: 90
    })
    .toFile(
      destino
    )
}

// ==========================================
// CREAR IMAGEN BASE
// ==========================================

async function crearImagenBase(
  video,
  tempDir
) {

  const cover =
    video.video?.cover ||
    video.video?.originCover ||
    video.video?.dynamicCover

  if (!cover) {
    throw new Error(
      'El TikTok no proporcionó miniatura'
    )
  }

  const coverPath =
    path.join(
      tempDir,
      'cover.jpg'
    )

  await descargarMiniatura(
    cover,
    coverPath
  )

  const coverBase64 =
    fs.readFileSync(
      coverPath
    ).toString('base64')

  const author =
    video.author?.uniqueId || '?'

  const nickname =
    video.author?.nickname || ''

  const descripcion =
    video.desc || 'Sin descripción'

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
  // HTML
  // ========================================

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

  background: #000;

  font-family:
    Arial,
    Helvetica,
    sans-serif;
}

.card {

  position: relative;

  width: 720px;
  height: 900px;

  overflow: hidden;

  border-radius: 42px;

  color: white;

  background: #080808;
}

/* ========================================
   FONDO
======================================== */

.background {

  position: absolute;

  inset: -100px;

  background:

    radial-gradient(
      circle at 20% 20%,
      rgba(255,255,255,.18),
      transparent 24%
    ),

    radial-gradient(
      circle at 85% 20%,
      rgba(255,0,120,.18),
      transparent 28%
    ),

    radial-gradient(
      circle at 70% 85%,
      rgba(80,100,255,.20),
      transparent 30%
    ),

    radial-gradient(
      circle at 20% 85%,
      rgba(160,50,255,.15),
      transparent 28%
    ),

    linear-gradient(
      135deg,
      #020202,
      #151515,
      #050505,
      #181818
    );

  filter:
    blur(20px);
}

/* ========================================
   LUCES
======================================== */

.orb {

  position: absolute;

  border-radius: 50%;

  filter:
    blur(55px);
}

.orb1 {

  width: 330px;
  height: 330px;

  left: -150px;
  top: 100px;

  background:
    rgba(255,255,255,.11);
}

.orb2 {

  width: 340px;
  height: 340px;

  right: -140px;
  bottom: 100px;

  background:
    rgba(255,20,130,.13);
}

.orb3 {

  width: 280px;
  height: 280px;

  left: 230px;
  top: 330px;

  background:
    rgba(70,100,255,.10);
}

/* ========================================
   OSCURIDAD
======================================== */

.dark {

  position: absolute;

  inset: 0;

  background:
    linear-gradient(
      180deg,
      rgba(0,0,0,.10),
      rgba(0,0,0,.30) 45%,
      rgba(0,0,0,.72) 72%,
      rgba(0,0,0,.97)
    );
}

/* ========================================
   BORDE
======================================== */

.border {

  position: absolute;

  inset: 10px;

  border-radius: 35px;

  border:
    1px solid
    rgba(255,255,255,.25);

  box-shadow:
    inset 0 0 35px
    rgba(255,255,255,.08);
}

/* ========================================
   LUZ DIAGONAL
======================================== */

.light {

  position: absolute;

  width: 170px;
  height: 1400px;

  top: -250px;
  left: -400px;

  transform:
    rotate(24deg);

  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,.04),
      rgba(255,255,255,.27),
      rgba(255,255,255,.04),
      transparent
    );

  filter:
    blur(14px);
}

/* ========================================
   CONTENIDO
======================================== */

.content {

  position: absolute;

  inset: 0;

  padding:
    34px 36px;

  display: flex;

  flex-direction: column;

  justify-content:
    space-between;
}

/* ========================================
   HEADER
======================================== */

.header {

  display: flex;

  justify-content:
    space-between;

  align-items:
    center;
}

.title {

  font-size: 27px;

  font-weight: 900;
}

.creator {

  margin-top: 5px;

  font-size: 13px;

  color:
    rgba(255,255,255,.55);

  font-weight: 600;
}

.badge {

  padding:
    10px 15px;

  border-radius:
    999px;

  background:
    rgba(255,255,255,.10);

  border:
    1px solid
    rgba(255,255,255,.20);

  font-size: 11px;

  font-weight: 900;
}

/* ========================================
   CENTRO
======================================== */

.center {

  margin-top: auto;
  margin-bottom: auto;
}

/* ========================================
   MINIATURA
======================================== */

.thumbnail {

  position: relative;

  width: 648px;
  height: 390px;

  overflow: hidden;

  border-radius: 30px;

  background: #111;

  border:
    1px solid
    rgba(255,255,255,.26);

  box-shadow:
    0 30px 75px
    rgba(0,0,0,.75);
}

.thumbnail img {

  width: 100%;
  height: 100%;

  object-fit: cover;
}

.thumbDark {

  position: absolute;

  inset: 0;

  background:
    linear-gradient(
      180deg,
      transparent 35%,
      rgba(0,0,0,.40)
    );
}

.shine {

  position: absolute;

  top: -50px;
  bottom: -50px;

  left: -250px;

  width: 170px;

  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,.38),
      transparent
    );

  transform:
    skewX(-18deg);

  filter:
    blur(8px);
}

/* ========================================
   DATOS
======================================== */

.author {

  margin-top: 23px;

  font-size: 29px;

  font-weight: 900;
}

.nickname {

  margin-top: 4px;

  font-size: 14px;

  color:
    rgba(255,255,255,.55);
}

.description {

  margin-top: 13px;

  font-size: 18px;

  line-height: 1.30;

  font-weight: 600;

  max-height: 70px;

  overflow: hidden;
}

/* ========================================
   STATS
======================================== */

.stats {

  display: flex;

  gap: 9px;

  margin-top: 17px;
}

.stat {

  padding:
    9px 13px;

  border-radius: 14px;

  background:
    rgba(0,0,0,.42);

  border:
    1px solid
    rgba(255,255,255,.16);

  font-size: 12px;

  font-weight: 800;
}

/* ========================================
   FOOTER
======================================== */

.footer {

  display: flex;

  align-items: center;

  justify-content:
    space-between;

  padding-top: 17px;

  border-top:
    1px solid
    rgba(255,255,255,.13);
}

.url {

  width: 490px;

  overflow: hidden;

  white-space: nowrap;

  text-overflow: ellipsis;

  font-size: 10px;

  color:
    rgba(255,255,255,.40);
}

.duration {

  padding:
    8px 12px;

  border-radius: 11px;

  background:
    rgba(255,255,255,.10);

  border:
    1px solid
    rgba(255,255,255,.13);

  font-size: 12px;

  font-weight: 900;
}

</style>

</head>

<body>

<div class="card">

  <div class="background"></div>

  <div class="orb orb1"></div>
  <div class="orb orb2"></div>
  <div class="orb orb3"></div>

  <div class="dark"></div>

  <div class="light"></div>

  <div class="border"></div>

  <div class="content">

    <div class="header">

      <div>

        <div class="title">
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
          src="data:image/jpeg;base64,${coverBase64}"
        >

        <div class="thumbDark"></div>

        <div class="shine"></div>

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

  // ========================================
  // PUPPETEER SOLO UNA VEZ
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

    await page.setContent(
      html,
      {
        waitUntil:
          'networkidle0'
      }
    )

    // UNA SOLA CAPTURA
    const base =
      await page.screenshot({
        type: 'png'
      })

    const basePath =
      path.join(
        tempDir,
        'base.png'
      )

    await sharp(base)
      .png()
      .toFile(
        basePath
      )

    return basePath

  } finally {

    await browser.close()
  }
}

// ==========================================
// CREAR FRAMES ANIMADOS
// ==========================================

async function crearFrames(
  basePath,
  tempDir
) {

  const framesDir =
    path.join(
      tempDir,
      'frames'
    )

  fs.mkdirSync(
    framesDir,
    {
      recursive: true
    }
  )

  const baseBuffer =
    fs.readFileSync(
      basePath
    )

  // ========================================
  // GENERAR FRAMES
  // ========================================

  for (
    let i = 0;
    i < FRAMES;
    i++
  ) {

    const progreso =
      i / (FRAMES - 1)

    const t =
      progreso *
      Math.PI *
      2

    const x =
      Math.round(
        Math.sin(t * 1.3) * 12
      )

    const y =
      Math.round(
        Math.cos(t) * 9
      )

    const zoom =
      1 +
      (
        Math.sin(t * 1.7) + 1
      ) * 0.004

    const framePath =
      path.join(
        framesDir,
        `frame-${String(i).padStart(4, '0')}.png`
      )

    /*
     * Animación mediante transformaciones
     * de Sharp.
     */

    let frame =
      sharp(baseBuffer)

    // Movimiento horizontal/vertical
    const left =
      Math.max(
        0,
        Math.min(
          CARD_WIDTH - 680,
          20 + x
        )
      )

    const top =
      Math.max(
        0,
        Math.min(
          CARD_HEIGHT - 860,
          20 + y
        )
      )

    // Creamos una ligera variación
    // del frame para que no sea estático.
    const resized =
      await frame
        .resize({
          width:
            Math.round(
              CARD_WIDTH * zoom
            ),

          height:
            Math.round(
              CARD_HEIGHT * zoom
            ),

          fit: 'fill'
        })
        .png()
        .toBuffer()

    await sharp({
      create: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        channels: 4,
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 1
        }
      }
    })
      .composite([
        {
          input: resized,
          left,
          top
        }
      ])
      .png()
      .toFile(
        framePath
      )
  }

  return framesDir
}

// ==========================================
// CREAR VIDEO DE TARJETA
// ==========================================

async function crearTarjetaTikTok(
  video
) {

  const tempDir =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'tiktok-card-'
      )
    )

  const output =
    path.join(
      tempDir,
      'card.mp4'
    )

  try {

    // ======================================
    // BASE
    // ======================================

    const base =
      await crearImagenBase(
        video,
        tempDir
      )

    // ======================================
    // FRAMES
    // ======================================

    const frames =
      await crearFrames(
        base,
        tempDir
      )

    // ======================================
    // FFMPEG
    // ======================================

    await ejecutarFFmpeg([
      '-y',

      '-framerate',
      String(FPS),

      '-i',
      path.join(
        frames,
        'frame-%04d.png'
      ),

      '-t',
      String(CARD_DURATION),

      '-c:v',
      'libx264',

      '-preset',
      'veryfast',

      '-crf',
      '23',

      '-pix_fmt',
      'yuv420p',

      '-r',
      String(FPS),

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

  try {

    // ======================================
    // TARJETA
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
    // VIDEO TIKTOK ORIGINAL
    // ======================================

    const caption =
      `🎬 *@${
        video.author?.uniqueId || '?'
      }* (${
        video.author?.nickname || ''
      })\n\n` +

      `📝 ${
        video.desc ||
        'Sin descripción'
      }\n\n` +

      `👁️ ${
        formatearNumero(
          video.stats?.playCount
        )
      } vistas\n` +

      `❤️ ${
        formatearNumero(
          video.stats?.diggCount
        )
      } likes\n` +

      `💬 ${
        formatearNumero(
          video.stats?.commentCount
        )
      } comentarios\n\n` +

      `🔗 ${
        video.url ||
        urlVideo
      }`

    // IMPORTANTE:
    // NO se comprime.
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

  } finally {

    if (
      tarjeta?.tempDir
    ) {

      eliminarDirectorio(
        tarjeta.tempDir
      )
    }
  }
}

// ==========================================
// LISTA TIKTOK
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
                  `@${
                    v.author?.uniqueId ||
                    '?'
                  } · ${
                    v.desc?.slice(
                      0,
                      40
                    ) ||
                    'Sin desc'
                  }`,

                id:
                  `${usedPrefix}tiktokget ${i}`,

                descripcion:
                  `👁️ ${
                    formatearNumero(
                      v.stats?.playCount
                    )
                  } · ` +

                  `❤️ ${
                    formatearNumero(
                      v.stats?.diggCount
                    )
                  } · ` +

                  `⏱️ ${
                    formatearDuracion(
                      v.video?.duration
                    )
                  }`
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
    comando ===
    'tiktokget'
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

    return
  }

  // ========================================
  // TIKTOKMAS
  // ========================================

  if (
    comando ===
    'tiktokmas'
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
  // SIN BÚSQUEDA
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
// EXPORT
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