const { enviarBotones, enviarLista } = require('../lib/botones')
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

// ═══════════════════════════════════════════════════════
// CONFIGURACIÓN DE LA TARJETA
// ═══════════════════════════════════════════════════════

const CARD_WIDTH = 720
const CARD_HEIGHT = 900

const FPS = 12
const CARD_DURATION = 10
const FRAMES = FPS * CARD_DURATION

const pendientes = global.tiktokPendientes || new Map()
global.tiktokPendientes = pendientes

// ═══════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════

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

function escaparXML(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

function cortarTexto(texto, limite = 90) {
    texto = String(texto || '').trim()

    if (texto.length <= limite) {
        return texto
    }

    return texto.slice(0, limite - 3) + '...'
}

function formatearNumero(n) {
    n = Number(n) || 0

    if (n >= 1_000_000_000) {
        return (n / 1_000_000_000).toFixed(1).replace('.0', '') + 'B'
    }

    if (n >= 1_000_000) {
        return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
    }

    if (n >= 1_000) {
        return (n / 1_000).toFixed(1).replace('.0', '') + 'K'
    }

    return String(n)
}

function formatearDuracion(seg) {
    const s = Number(seg) || 0
    const minutos = Math.floor(s / 60)
    const segundos = s % 60

    if (minutos > 0) {
        return `${minutos}:${String(segundos).padStart(2, '0')}`
    }

    return `0:${String(segundos).padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════
// API ORBIT
// ═══════════════════════════════════════════════════════

async function orbitFetch(endpoint, params = {}) {
    const qs = new URLSearchParams({
        apikey: API_KEY,
        ...params
    }).toString()

    const url = `${API_BASE}/${endpoint}?${qs}`

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
        throw new Error(data?.error || 'Respuesta inválida de la API')
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
        throw new Error(data?.error || 'No se pudo obtener el video')
    }

    return data.data
}

// ═══════════════════════════════════════════════════════
// DESCARGAR MINIATURA
// ═══════════════════════════════════════════════════════

async function obtenerMiniatura(video, tempDir) {
    const cover =
        video.video?.cover ||
        video.video?.originCover ||
        video.video?.dynamicCover

    if (!cover) {
        return null
    }

    try {
        const res = await fetch(cover)

        if (!res.ok) {
            return null
        }

        const buffer = Buffer.from(await res.arrayBuffer())

        const salida = path.join(
            tempDir,
            `cover-${Date.now()}.jpg`
        )

        await sharp(buffer)
            .resize(650, 400, {
                fit: 'cover',
                position: 'attention'
            })
            .jpeg({
                quality: 90
            })
            .toFile(salida)

        return salida

    } catch (e) {
        console.error('[TIKTOK COVER]', e)
        return null
    }
}

// ═══════════════════════════════════════════════════════
// LOGO TIKTOK EN SVG
// ═══════════════════════════════════════════════════════
//
// Se dibuja dentro de la propia tarjeta para no depender
// de una imagen o vídeo externo.
// ═══════════════════════════════════════════════════════

function logoTikTok(x, y, escala = 1) {
    return `
        <g transform="translate(${x} ${y}) scale(${escala})">

            <!-- sombra cyan -->
            <path
                d="M19 5
                   C22 11 26 14 33 15
                   L33 22
                   C28 22 23 20 19 17
                   L19 33
                   C19 43 12 49 4 49
                   C-4 49 -10 43 -10 35
                   C-10 26 -3 20 5 20
                   C7 20 9 20 11 21
                   L11 29
                   C9 28 7 27 5 27
                   C1 27 -2 30 -2 34
                   C-2 38 1 41 5 41
                   C9 41 12 38 12 33
                   L12 5 Z"
                fill="#25F4EE"
                transform="translate(-3 2)"
            />

            <!-- sombra rosa -->
            <path
                d="M19 5
                   C22 11 26 14 33 15
                   L33 22
                   C28 22 23 20 19 17
                   L19 33
                   C19 43 12 49 4 49
                   C-4 49 -10 43 -10 35
                   C-10 26 -3 20 5 20
                   C7 20 9 20 11 21
                   L11 29
                   C9 28 7 27 5 27
                   C1 27 -2 30 -2 34
                   C-2 38 1 41 5 41
                   C9 41 12 38 12 33
                   L12 5 Z"
                fill="#FE2C55"
                transform="translate(3 -2)"
            />

            <!-- logo principal -->
            <path
                d="M19 5
                   C22 11 26 14 33 15
                   L33 22
                   C28 22 23 20 19 17
                   L19 33
                   C19 43 12 49 4 49
                   C-4 49 -10 43 -10 35
                   C-10 26 -3 20 5 20
                   C7 20 9 20 11 21
                   L11 29
                   C9 28 7 27 5 27
                   C1 27 -2 30 -2 34
                   C-2 38 1 41 5 41
                   C9 41 12 38 12 33
                   L12 5 Z"
                fill="white"
            />
        </g>
    `
}

// ═══════════════════════════════════════════════════════
// SVG DE LA TARJETA
// ═══════════════════════════════════════════════════════

function crearSVG(video, coverBase64, frame) {

    const progreso = frame / (FRAMES - 1)
    const tiempo = progreso * CARD_DURATION

    // Movimiento suave del fondo
    const movimientoX =
        Math.sin(tiempo * 0.75) * 18

    const movimientoY =
        Math.cos(tiempo * 0.58) * 14

    const escalaFondo =
        1.02 + Math.sin(tiempo * 0.45) * 0.012

    // Movimiento de la miniatura
    const thumbX =
        Math.sin(tiempo * 0.65) * 5

    const thumbY =
        Math.cos(tiempo * 0.52) * 4

    const thumbScale =
        1.015 + Math.sin(tiempo * 0.7) * 0.008

    // Luz que atraviesa la tarjeta
    const shineX =
        -250 + ((tiempo * 95) % 1200)

    // Glow del borde
    const glow =
        12 + Math.sin(tiempo * 1.8) * 7

    const autor =
        video.author?.uniqueId ||
        video.author?.nickname ||
        'usuario'

    const nickname =
        video.author?.nickname ||
        autor

    const descripcion =
        cortarTexto(video.desc || 'Sin descripción', 100)

    const vistas =
        formatearNumero(video.stats?.playCount)

    const likes =
        formatearNumero(video.stats?.diggCount)

    const comentarios =
        formatearNumero(video.stats?.commentCount)

    const duracion =
        formatearDuracion(video.video?.duration)

    const cover =
        coverBase64
            ? `data:image/jpeg;base64,${coverBase64}`
            : ''

    return `
<svg
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    width="${CARD_WIDTH}"
    height="${CARD_HEIGHT}"
    viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"
>

<defs>

    <!-- Fondo -->
    <linearGradient
        id="bg"
        x1="0"
        y1="0"
        x2="720"
        y2="900"
    >
        <stop offset="0%" stop-color="#08090b"/>
        <stop offset="48%" stop-color="#101114"/>
        <stop offset="100%" stop-color="#080a0b"/>
    </linearGradient>

    <!-- Magenta superior -->
    <radialGradient id="pinkGlow">
        <stop
            offset="0%"
            stop-color="#ff174f"
            stop-opacity=".24"
        />
        <stop
            offset="55%"
            stop-color="#b5003b"
            stop-opacity=".09"
        />
        <stop
            offset="100%"
            stop-color="#000"
            stop-opacity="0"
        />
    </radialGradient>

    <!-- Cyan inferior -->
    <radialGradient id="cyanGlow">
        <stop
            offset="0%"
            stop-color="#00e5d0"
            stop-opacity=".20"
        />
        <stop
            offset="55%"
            stop-color="#008f86"
            stop-opacity=".08"
        />
        <stop
            offset="100%"
            stop-color="#000"
            stop-opacity="0"
        />
    </radialGradient>

    <!-- Gradiente del logo -->
    <linearGradient
        id="logoGradient"
        x1="0"
        y1="0"
        x2="1"
        y2="1"
    >
        <stop offset="0%" stop-color="#25F4EE"/>
        <stop offset="50%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#FE2C55"/>
    </linearGradient>

    <!-- Brillo -->
    <linearGradient
        id="shine"
        x1="0"
        y1="0"
        x2="1"
        y2="0"
    >
        <stop
            offset="0%"
            stop-color="white"
            stop-opacity="0"
        />
        <stop
            offset="48%"
            stop-color="white"
            stop-opacity=".02"
        />
        <stop
            offset="50%"
            stop-color="white"
            stop-opacity=".16"
        />
        <stop
            offset="52%"
            stop-color="white"
            stop-opacity=".02"
        />
        <stop
            offset="100%"
            stop-color="white"
            stop-opacity="0"
        />
    </linearGradient>

    <!-- Máscara general -->
    <clipPath id="cardClip">
        <rect
            x="24"
            y="24"
            width="672"
            height="852"
            rx="48"
        />
    </clipPath>

    <clipPath id="thumbClip">
        <rect
            x="50"
            y="105"
            width="620"
            height="395"
            rx="30"
        />
    </clipPath>

    <!-- Sombra -->
    <filter
        id="shadow"
        x="-30%"
        y="-30%"
        width="160%"
        height="160%"
    >
        <feGaussianBlur
            stdDeviation="20"
        />
    </filter>

    <filter
        id="softGlow"
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
    >
        <feGaussianBlur
            stdDeviation="${Math.max(4, glow / 2)}"
        />
    </filter>

</defs>


<!-- ═══════════════════════════════════════ -->
<!-- FONDO -->
<!-- ═══════════════════════════════════════ -->

<rect
    width="720"
    height="900"
    fill="#000000"
/>

<rect
    x="24"
    y="24"
    width="672"
    height="852"
    rx="48"
    fill="url(#bg)"
/>

<g clip-path="url(#cardClip)">

    <!-- Glow magenta -->
    <ellipse
        cx="${590 + movimientoX}"
        cy="${-40 + movimientoY}"
        rx="410"
        ry="270"
        fill="url(#pinkGlow)"
    />

    <!-- Glow cyan -->
    <ellipse
        cx="${60 - movimientoX}"
        cy="${940 - movimientoY}"
        rx="390"
        ry="290"
        fill="url(#cyanGlow)"
    />

    <!-- Luces ambientales -->
    <circle
        cx="${150 + movimientoX}"
        cy="${280 + movimientoY}"
        r="130"
        fill="#ff174f"
        opacity=".025"
        filter="url(#softGlow)"
    />

    <circle
        cx="${570 - movimientoX}"
        cy="${700 - movimientoY}"
        r="150"
        fill="#00e5d0"
        opacity=".025"
        filter="url(#softGlow)"
    />

    <!-- Barrido de luz -->
    <rect
        x="${shineX}"
        y="0"
        width="150"
        height="900"
        fill="url(#shine)"
        transform="rotate(12 360 450)"
    />

</g>


<!-- ═══════════════════════════════════════ -->
<!-- BORDE EXTERIOR -->
<!-- ═══════════════════════════════════════ -->

<rect
    x="24"
    y="24"
    width="672"
    height="852"
    rx="48"
    fill="none"
    stroke="#ffffff"
    stroke-opacity=".08"
    stroke-width="2"
/>

<rect
    x="26"
    y="26"
    width="668"
    height="848"
    rx="46"
    fill="none"
    stroke="url(#logoGradient)"
    stroke-opacity=".10"
    stroke-width="1.5"
/>


<!-- ═══════════════════════════════════════ -->
<!-- HEADER -->
<!-- ═══════════════════════════════════════ -->

${logoTikTok(96, 55, .72)}

<text
    x="132"
    y="88"
    fill="white"
    font-family="Arial, Helvetica, sans-serif"
    font-size="29"
    font-weight="700"
>
    TikTok
</text>


<!-- Botón Duan TikTok -->

<rect
    x="525"
    y="52"
    width="140"
    height="43"
    rx="22"
    fill="#ffffff"
    fill-opacity=".055"
    stroke="#ffffff"
    stroke-opacity=".10"
    stroke-width="1"
/>

<text
    x="595"
    y="80"
    text-anchor="middle"
    fill="white"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17"
    font-weight="700"
>
    Duan TikTok
</text>


<!-- ═══════════════════════════════════════ -->
<!-- MINIATURA -->
<!-- ═══════════════════════════════════════ -->

<rect
    x="47"
    y="102"
    width="626"
    height="401"
    rx="34"
    fill="#000000"
    opacity=".55"
    filter="url(#shadow)"
/>

<g clip-path="url(#thumbClip)">

    ${
        cover
        ? `
        <image
            x="${50 + thumbX}"
            y="${105 + thumbY}"
            width="${620 * thumbScale}"
            height="${395 * thumbScale}"
            preserveAspectRatio="xMidYMid slice"
            href="${cover}"
            xlink:href="${cover}"
        />
        `
        : `
        <rect
            x="50"
            y="105"
            width="620"
            height="395"
            fill="#18191c"
        />

        <text
            x="360"
            y="310"
            text-anchor="middle"
            fill="#777"
            font-family="Arial"
            font-size="22"
        >
            TikTok
        </text>
        `
    }

    <!-- oscurecimiento -->
    <rect
        x="50"
        y="105"
        width="620"
        height="395"
        fill="#000000"
        opacity=".08"
    />

    <!-- brillo animado -->
    <rect
        x="${shineX - 300}"
        y="70"
        width="180"
        height="500"
        fill="white"
        opacity=".08"
        transform="rotate(12 360 300)"
    />

</g>


<!-- Duración -->

<rect
    x="605"
    y="460"
    width="52"
    height="30"
    rx="15"
    fill="#000000"
    fill-opacity=".60"
/>

<text
    x="631"
    y="481"
    text-anchor="middle"
    fill="white"
    font-family="Arial, Helvetica, sans-serif"
    font-size="15"
    font-weight="700"
>
    ${duracion}
</text>


<!-- ═══════════════════════════════════════ -->
<!-- AUTOR -->
<!-- ═══════════════════════════════════════ -->

<circle
    cx="92"
    cy="548"
    r="34"
    fill="url(#logoGradient)"
/>

<text
    x="92"
    y="559"
    text-anchor="middle"
    fill="white"
    font-family="Arial, Helvetica, sans-serif"
    font-size="27"
    font-weight="700"
>
    ${escaparXML(autor.charAt(0).toUpperCase())}
</text>

<text
    x="140"
    y="550"
    fill="white"
    font-family="Arial, Helvetica, sans-serif"
    font-size="22"
    font-weight="700"
>
    @${escaparXML(autor)}
</text>

<text
    x="140"
    y="575"
    fill="#8e9399"
    font-family="Arial, Helvetica, sans-serif"
    font-size="16"
>
    ${escaparXML(nickname)}
</text>


<!-- ═══════════════════════════════════════ -->
<!-- DESCRIPCIÓN -->
<!-- ═══════════════════════════════════════ -->

<rect
    x="50"
    y="610"
    width="620"
    height="105"
    rx="28"
    fill="#ffffff"
    fill-opacity=".055"
    stroke="#ffffff"
    stroke-opacity=".055"
    stroke-width="1"
/>

<text
    x="75"
    y="650"
    fill="#f4f4f4"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17"
>
    ${escaparXML(descripcion.slice(0, 65))}
</text>

<text
    x="75"
    y="678"
    fill="#f4f4f4"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17"
>
    ${escaparXML(descripcion.slice(65, 130))}
</text>


<!-- ═══════════════════════════════════════ -->
<!-- ESTADÍSTICAS -->
<!-- ═══════════════════════════════════════ -->

<!-- Vistas -->

<rect
    x="50"
    y="742"
    width="192"
    height="82"
    rx="24"
    fill="#ffffff"
    fill-opacity=".045"
    stroke="#ffffff"
    stroke-opacity=".07"
    stroke-width="1"
/>

<text
    x="146"
    y="777"
    text-anchor="middle"
    fill="white"
    font-family="Arial, Helvetica, sans-serif"
    font-size="22"
    font-weight="700"
>
    ${vistas}
</text>

<text
    x="146"
    y="802"
    text-anchor="middle"
    fill="#8d9298"
    font-family="Arial, Helvetica, sans-serif"
    font-size="13"
>
    VISTAS
</text>


<!-- Likes -->

<rect
    x="264"
    y="742"
    width="192"
    height="82"
    rx="24"
    fill="#ffffff"
    fill-opacity=".045"
    stroke="#ffffff"
    stroke-opacity=".07"
    stroke-width="1"
/>

<text
    x="360"
    y="777"
    text-anchor="middle"
    fill="white"
    font-family="Arial, Helvetica, sans-serif"
    font-size="22"
    font-weight="700"
>
    ${likes}
</text>

<text
    x="360"
    y="802"
    text-anchor="middle"
    fill="#8d9298"
    font-family="Arial, Helvetica, sans-serif"
    font-size="13"
>
    LIKES
</text>


<!-- Comentarios -->

<rect
    x="478"
    y="742"
    width="192"
    height="82"
    rx="24"
    fill="#ffffff"
    fill-opacity=".045"
    stroke="#ffffff"
    stroke-opacity=".07"
    stroke-width="1"
/>

<text
    x="574"
    y="777"
    text-anchor="middle"
    fill="white"
    font-family="Arial, Helvetica, sans-serif"
    font-size="22"
    font-weight="700"
>
    ${comentarios}
</text>

<text
    x="574"
    y="802"
    text-anchor="middle"
    fill="#8d9298"
    font-family="Arial, Helvetica, sans-serif"
    font-size="13"
>
    COMENTARIOS
</text>


<!-- ═══════════════════════════════════════ -->
<!-- FOOTER -->
<!-- ═══════════════════════════════════════ -->

<text
    x="50"
    y="855"
    fill="#62676d"
    font-family="Arial, Helvetica, sans-serif"
    font-size="14"
>
    TikTok Search
</text>

<text
    x="670"
    y="855"
    text-anchor="end"
    fill="#62676d"
    font-family="Arial, Helvetica, sans-serif"
    font-size="14"
>
    Powered by
    <tspan
        fill="#d5d5d5"
        font-weight="700"
    >
        Matthieu
    </tspan>
</text>

</svg>
`
}

// ═══════════════════════════════════════════════════════
// CREAR FRAMES
// ═══════════════════════════════════════════════════════

async function crearFrames(video, coverPath, tempDir) {

    let coverBase64 = ''

    if (coverPath && fs.existsSync(coverPath)) {
        const buffer = await fs.promises.readFile(coverPath)
        coverBase64 = buffer.toString('base64')
    }

    const framesDir = path.join(
        tempDir,
        'frames'
    )

    await fs.promises.mkdir(
        framesDir,
        { recursive: true }
    )

    console.log(
        `[TIKTOK] Generando ${FRAMES} frames...`
    )

    for (let i = 0; i < FRAMES; i++) {

        const svg = crearSVG(
            video,
            coverBase64,
            i
        )

        const framePath = path.join(
            framesDir,
            `frame-${String(i).padStart(4, '0')}.png`
        )

        await sharp(
            Buffer.from(svg)
        )
            .png()
            .toFile(framePath)

        if (i % 20 === 0) {
            console.log(
                `[TIKTOK] Frame ${i + 1}/${FRAMES}`
            )
        }
    }

    return framesDir
}

// ═══════════════════════════════════════════════════════
// CREAR MP4 ANIMADO
// ═══════════════════════════════════════════════════════

function crearVideoTarjeta(framesDir, outputPath) {

    return new Promise((resolve, reject) => {

        const inputPattern = path.join(
            framesDir,
            'frame-%04d.png'
        )

        const args = [
            '-y',

            '-framerate',
            String(FPS),

            '-i',
            inputPattern,

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

            '-movflags',
            '+faststart',

            outputPath
        ]

        const ffmpeg = spawn(
            ffmpegPath,
            args,
            {
                stdio: [
                    'ignore',
                    'ignore',
                    'pipe'
                ]
            }
        )

        let error = ''

        ffmpeg.stderr.on(
            'data',
            data => {
                error += data.toString()
            }
        )

        ffmpeg.on(
            'error',
            reject
        )

        ffmpeg.on(
            'close',
            code => {

                if (code !== 0) {
                    return reject(
                        new Error(
                            `FFmpeg terminó con código ${code}\n${error.slice(-2000)}`
                        )
                    )
                }

                resolve(outputPath)
            }
        )
    })
}

// ═══════════════════════════════════════════════════════
// GENERAR TARJETA
// ═══════════════════════════════════════════════════════

async function generarTarjetaTikTok(video) {

    const tempDir = await fs.promises.mkdtemp(
        path.join(
            os.tmpdir(),
            'duan-tiktok-'
        )
    )

    try {

        console.log(
            '[TIKTOK] Descargando miniatura...'
        )

        const coverPath =
            await obtenerMiniatura(
                video,
                tempDir
            )

        console.log(
            '[TIKTOK] Creando animación...'
        )

        const framesDir =
            await crearFrames(
                video,
                coverPath,
                tempDir
            )

        const outputPath = path.join(
            tempDir,
            'tiktok-card.mp4'
        )

        console.log(
            '[TIKTOK] Codificando tarjeta...'
        )

        await crearVideoTarjeta(
            framesDir,
            outputPath
        )

        return {
            path: outputPath,
            tempDir
        }

    } catch (e) {

        await fs.promises.rm(
            tempDir,
            {
                recursive: true,
                force: true
            }
        )

        throw e
    }
}

// ═══════════════════════════════════════════════════════
// LISTA DE TIKTOK
// ═══════════════════════════════════════════════════════

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
                                `👁️ ${formatearNumero(v.stats?.playCount)} · ` +
                                `❤️ ${formatearNumero(v.stats?.diggCount)} · ` +
                                `⏱️ ${formatearDuracion(v.video?.duration)}`
                        }))
                }
            ]
        }
    )
}

// ═══════════════════════════════════════════════════════
// BOTÓN MÁS VIDEOS
// ═══════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════
// ENVIAR VIDEO ORIGINAL
// ═══════════════════════════════════════════════════════
//
// IMPORTANTE:
// Aquí NO se usa FFmpeg.
// NO se descarga para volver a codificar.
// Se manda directamente la URL que devuelve la API.
// ═══════════════════════════════════════════════════════

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
            'El resultado no contiene URL de video'
        )
    }

    const caption =
        `🎬 *@${video.author?.uniqueId || '?'}*` +
        ` (${video.author?.nickname || ''})\n\n` +

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

    // VIDEO ORIGINAL — SIN COMPRESIÓN
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
            quoted:
                m.raw
        }
    )
}

// ═══════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════
    // SELECCIONAR VIDEO
    // ═══════════════════════════════════════

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

            // ═══════════════════════════════════
            // 1. CREAR TARJETA ANIMADA
            // ═══════════════════════════════════

            console.log(
                '[TIKTOK] Generando tarjeta...'
            )

            const tarjeta =
                await generarTarjetaTikTok(
                    video
                )

            // ═══════════════════════════════════
            // 2. ENVIAR TARJETA
            // ═══════════════════════════════════

            await conn.sendMessage(
                m.chat,
                {
                    video: {
                        url: tarjeta.path
                    },

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

            // ═══════════════════════════════════
            // 3. BORRAR TARJETA TEMPORAL
            // ═══════════════════════════════════

            setTimeout(
                async () => {

                    try {

                        await fs.promises.rm(
                            tarjeta.tempDir,
                            {
                                recursive: true,
                                force: true
                            }
                        )

                    } catch {}
                },
                5000
            )

            // ═══════════════════════════════════
            // 4. ENVIAR TIKTOK ORIGINAL
            // ═══════════════════════════════════

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

    // ═══════════════════════════════════════
    // MÁS VIDEOS
    // ═══════════════════════════════════════

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

    // ═══════════════════════════════════════
    // SIN TEXTO
    // ═══════════════════════════════════════

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

    try {

        // ═══════════════════════════════════
        // BUSCANDO
        // ═══════════════════════════════════

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

        // ═══════════════════════════════════
        // BUSCAR
        // ═══════════════════════════════════

        const videos =
            await buscarTikTok(
                query
            )

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

        // ═══════════════════════════════════
        // GUARDAR RESULTADOS
        // ═══════════════════════════════════

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

        // ═══════════════════════════════════
        // MOSTRAR LISTA
        // ═══════════════════════════════════

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

// ═══════════════════════════════════════════════════════
// CONFIG DEL COMANDO
// ═══════════════════════════════════════════════════════

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