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
// BÚSQUEDA
// ==========================================

const TIEMPO_SELECCION_MS =
  5 * 60 * 1000

const MAX_RESULTADOS = 10

// ==========================================
// TARJETA ANIMADA
// ==========================================

const CARD_WIDTH = 720
const CARD_HEIGHT = 900

const FPS = 12

// IMPORTANTE:
// duración de la tarjeta animada
const CARD_DURATION = 10

const FRAMES =
  FPS * CARD_DURATION

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

  for (
    const [clave, valor]
    of pendientes
  ) {

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

  return `${
    m.chat
  }_${
    m.senderNumero || m.sender
  }`
}

// ==========================================
// ESCAPAR HTML
// ==========================================

function escapeHtml(text = '') {

  return String(text)
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    )
}

// ==========================================
// NÚMEROS
// ==========================================

function formatearNumero(n) {

  n = Number(n) || 0

  if (n >= 1000000000) {
    return (
      n / 1000000000
    ).toFixed(1) + 'B'
  }

  if (n >= 1000000) {
    return (
      n / 1000000
    ).toFixed(1) + 'M'
  }

  if (n >= 1000) {
    return (
      n / 1000
    ).toFixed(1) + 'K'
  }

  return String(n)
}

// ==========================================
// DURACIÓN
// ==========================================

function formatearDuracion(seg) {

  const s =
    Number(seg) || 0

  const minutos =
    Math.floor(s / 60)

  const segundos =
    s % 60

  return (
    `${minutos}:` +
    `${String(segundos).padStart(2, '0')}`
  )
}

// ==========================================
// ORBIT FETCH
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
        'x-orbit-ip':
          ORBIT_IP
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
// BUSCAR TIKTOK
// ==========================================

async function buscarTikTok(query) {

  const data =
    await orbitFetch(
      'tiktok-search',
      {
        query
      }
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
          stderr +=
            data.toString()
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
            return
          }

          reject(
            new Error(
              `FFmpeg terminó con código ${code}\n${stderr}`
            )
          )
        }
      )
    }
  )
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
// DESCARGAR MINIATURA
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
// CREAR TARJETA ANIMADA
// ==========================================

async function crearTarjetaTikTok(
  video
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

  const tempDir =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'tiktok-card-'
      )
    )

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

  const coverPath =
    path.join(
      tempDir,
      'cover.jpg'
    )

  const outputVideo =
    path.join(
      tempDir,
      'card.mp4'
    )

  try {

    // ======================================
    // MINIATURA
    // ======================================

    await descargarMiniatura(
      cover,
      coverPath
    )

    const coverBase64 =
      fs.readFileSync(
        coverPath
      ).toString(
        'base64'
      )

    // ======================================
    // DATOS
    // ======================================

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

    // ======================================
    // PUPPETEER
    // ======================================

    const browser =
      await puppeteer.launch({

        headless: true,

        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]

      })

    try {

      const page =
        await browser.newPage()

      await page.setViewport({
        width:
          CARD_WIDTH,

        height:
          CARD_HEIGHT,

        deviceScaleFactor: 1
      })

      // ====================================
      // HTML
      // ====================================

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

  width: 950px;
  height: 1150px;

  left: -115px;
  top: -125px;

  background:

    radial-gradient(
      circle at 20% 20%,
      rgba(255,255,255,.20),
      transparent 23%
    ),

    radial-gradient(
      circle at 85% 25%,
      rgba(255,40,130,.18),
      transparent 28%
    ),

    radial-gradient(
      circle at 70% 85%,
      rgba(80,120,255,.20),
      transparent 30%
    ),

    radial-gradient(
      circle at 25% 80%,
      rgba(180,60,255,.13),
      transparent 28%
    ),

    linear-gradient(
      135deg,
      #030303,
      #161616,
      #070707,
      #191919
    );

  filter:
    blur(28px);

  transform:
    scale(1.15);

  will-change:
    transform;
}

/* ========================================
   ORBES
======================================== */

.orb {

  position: absolute;

  border-radius: 50%;

  filter:
    blur(45px);

  will-change:
    transform;
}

.orb1 {

  width: 300px;
  height: 300px;

  left: -120px;
  top: 100px;

  background:
    rgba(255,255,255,.12);
}

.orb2 {

  width: 330px;
  height: 330px;

  right: -130px;
  bottom: 100px;

  background:
    rgba(255,30,130,.12);
}

.orb3 {

  width: 250px;
  height: 250px;

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
      rgba(0,0,0,.12),
      rgba(0,0,0,.25) 42%,
      rgba(0,0,0,.70) 72%,
      rgba(0,0,0,.96)
    );
}

/* ========================================
   LUZ
======================================== */

.light {

  position: absolute;

  width: 160px;
  height: 1400px;

  top: -260px;
  left: -420px;

  transform:
    rotate(24deg);

  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,.04),
      rgba(255,255,255,.30),
      rgba(255,255,255,.04),
      transparent
    );

  filter:
    blur(18px);

  will-change:
    left;
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
    rgba(255,255,255,.23);

  box-shadow:
    inset 0 0 35px
    rgba(255,255,255,.08);

  will-change:
    box-shadow;
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

  align-items: center;

  justify-content:
    space-between;

  will-change:
    transform,
    opacity;
}

.title {

  font-size: 27px;

  font-weight: 900;

  letter-spacing:
    -.5px;

  text-shadow:
    0 4px 20px
    rgba(0,0,0,.8);
}

.creator {

  margin-top: 5px;

  font-size: 13px;

  color:
    rgba(255,255,255,.58);

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

  backdrop-filter:
    blur(18px);

  font-size: 11px;

  font-weight: 900;
}

/* ========================================
   CENTRO
======================================== */

.center {

  margin-top: auto;

  margin-bottom: auto;

  will-change:
    transform;
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

  will-change:
    transform;
}

.thumbnail img {

  position: absolute;

  width: 100%;
  height: 100%;

  object-fit: cover;

  transform:
    scale(1.04);

  will-change:
    transform;
}

/* ========================================
   OSCURECER MINIATURA
======================================== */

.thumbDark {

  position: absolute;

  inset: 0;

  background:
    linear-gradient(
      180deg,
      transparent 40%,
      rgba(0,0,0,.38)
    );
}

/* ========================================
   REFLEJO
======================================== */

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
      rgba(255,255,255,.35),
      transparent
    );

  transform:
    skewX(-18deg);

  filter:
    blur(8px);

  will-change:
    left;
}

/* ========================================
   AUTOR
======================================== */

.author {

  margin-top: 23px;

  font-size: 29px;

  font-weight: 900;

  text-shadow:
    0 5px 22px
    rgba(0,0,0,.95);

  will-change:
    transform;
}

.nickname {

  margin-top: 4px;

  font-size: 14px;

  color:
    rgba(255,255,255,.55);
}

/* ========================================
   DESCRIPCIÓN
======================================== */

.description {

  margin-top: 13px;

  font-size: 18px;

  line-height: 1.30;

  font-weight: 600;

  max-height: 70px;

  overflow: hidden;

  text-shadow:
    0 4px 18px
    rgba(0,0,0,.95);
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

  backdrop-filter:
    blur(18px);

  font-size: 12px;

  font-weight: 800;

  will-change:
    transform;
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

  will-change:
    transform;
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

      await page.setContent(
        html,
        {
          waitUntil:
            'networkidle0'
        }
      )

      // ====================================
      // GENERAR FRAMES
      // ====================================

      for (
        let i = 0;
        i < FRAMES;
        i++
      ) {

        const progreso =
          i /
          (FRAMES - 1)

        const tiempo =
          progreso *
          CARD_DURATION

        await page.evaluate(
          ({
            progreso,
            tiempo
          }) => {

            const background =
              document.querySelector(
                '.background'
              )

            const orb1 =
              document.querySelector(
                '.orb1'
              )

            const orb2 =
              document.querySelector(
                '.orb2'
              )

            const orb3 =
              document.querySelector(
                '.orb3'
              )

            const light =
              document.querySelector(
                '.light'
              )

            const thumbnail =
              document.querySelector(
                '.thumbnail'
              )

            const image =
              document.querySelector(
                '.thumbnail img'
              )

            const shine =
              document.querySelector(
                '.shine'
              )

            const center =
              document.querySelector(
                '.center'
              )

            const header =
              document.querySelector(
                '.header'
              )

            const footer =
              document.querySelector(
                '.footer'
              )

            const border =
              document.querySelector(
                '.border'
              )

            // ==============================
            // CICLO
            // ==============================

            const a =
              tiempo *
              Math.PI *
              2 /
              5

            // ==============================
            // FONDO
            // ==============================

            const bgX =
              Math.sin(a) *
              35

            const bgY =
              Math.cos(a * .8) *
              25

            const bgScale =
              1.15 +
              (
                Math.sin(a) + 1
              ) * .035

            background.style.transform =
              `
              translate(
                ${bgX}px,
                ${bgY}px
              )
              scale(${bgScale})
              `

            // ==============================
            // ORB 1
            // ==============================

            orb1.style.transform =
              `
              translate(
                ${Math.sin(a * 1.3) * 120}px,
                ${Math.cos(a) * 80}px
              )
              scale(
                ${1 + Math.sin(a) * .12}
              )
              `

            // ==============================
            // ORB 2
            // ==============================

            orb2.style.transform =
              `
              translate(
                ${Math.cos(a * 1.1) * 100}px,
                ${Math.sin(a * .8) * 100}px
              )
              scale(
                ${1 + Math.cos(a) * .15}
              )
              `

            // ==============================
            // ORB 3
            // ==============================

            orb3.style.transform =
              `
              translate(
                ${Math.sin(a * .7) * 90}px,
                ${Math.cos(a * 1.2) * 70}px
              )
              `

            // ==============================
            // LUZ
            // ==============================

            light.style.left =
              `${
                -420 +
                progreso * 1050
              }px`

            // ==============================
            // MINIATURA
            // ==============================

            const thumbScale =
              1 +
              (
                Math.sin(a * 1.4) + 1
              ) * .018

            const thumbY =
              Math.sin(a) * 5

            thumbnail.style.transform =
              `
              translateY(
                ${thumbY}px
              )
              scale(
                ${thumbScale}
              )
              `

            // ==============================
            // IMAGEN
            // ==============================

            const imageScale =
              1.04 +
              (
                Math.sin(a * 1.2) + 1
              ) * .035

            const imageX =
              Math.sin(a * 1.1) * 9

            const imageY =
              Math.cos(a * .9) * 7

            image.style.transform =
              `
              translate(
                ${imageX}px,
                ${imageY}px
              )
              scale(
                ${imageScale}
              )
              `

            // ==============================
            // SHINE
            // ==============================

            shine.style.left =
              `${
                -250 +
                progreso * 900
              }px`

            // ==============================
            // CENTRO
            // ==============================

            center.style.transform =
              `
              translateY(
                ${Math.sin(a * .8) * 4}px
              )
              `

            // ==============================
            // HEADER
            // ==============================

            header.style.transform =
              `
              translateY(
                ${Math.cos(a) * 3}px
              )
              `

            // ==============================
            // FOOTER
            // ==============================

            footer.style.transform =
              `
              translateY(
                ${Math.sin(a * .9) * 3}px
              )
              `

            // ==============================
            // BORDE
            // ==============================

            const glow =
              .06 +
              (
                Math.sin(a * 2) + 1
              ) * .10

            border.style.boxShadow =
              `
              inset 0 0 38px
              rgba(
                255,
                255,
                255,
                ${glow}
              ),

              0 0 38px
              rgba(
                255,
                255,
                255,
                ${glow}
              )
              `

          },
          {
            progreso,
            tiempo
          }
        )

        // ==================================
        // SCREENSHOT
        // ==================================

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

    // ======================================
    // FRAMES → MP4
    // ======================================

    await ejecutarFFmpeg([
      '-y',

      '-framerate',
      String(FPS),

      '-i',
      path.join(
        framesDir,
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

      outputVideo
    ])

    return {
      file:
        outputVideo,

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
    // CREAR TARJETA
    // ======================================

    tarjeta =
      await crearTarjetaTikTok(
        video
      )

    // ======================================
    // TARJETA ANIMADA
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
    // VIDEO ORIGINAL
    // SIN COMPRESIÓN
    // ======================================

    const caption =
      `🎬 *@${
        video.author?.uniqueId || '?'
      }* ` +
      `(${
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
      pendiente.videos[
        indice
      ]

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