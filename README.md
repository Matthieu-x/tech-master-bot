<p align="center">
  <img src="https://i.postimg.cc/MpgS22Wm/file-00000000333c820eabc3104428180474.png" alt="Tech Master Bot" width="100%">
</p>

<h1 align="center">Tech Master Bot</h1>
<p align="center">Tu asistente inteligente en WhatsApp ⚡</p>

---

## ✨ Características

- 🔌 Conexión a WhatsApp por **código de vinculación** (sin QR), usando `@itsliaaa/baileys`.
- 🔄 **AutoUpdate**: revisa el repositorio cada 5 minutos y se actualiza solo (git pull + reinicio vía PM2).
- 🧩 Sistema de **plugins**: cada comando es un archivo independiente en `/plugins`, se carga automáticamente sin reiniciar.
- 👑 Comandos exclusivos de **owner**, compatibles con el sistema `@lid` de WhatsApp (usa el número real, no el identificador interno).
- 📋 Menú generado **automáticamente** a partir de los plugins instalados, agrupado por categoría.
- 🎨 Banner de terminal con estilo propio al iniciar.

## 🚀 Instalación

```bash
npm install
npm start
```

La primera vez te pide el número de WhatsApp del bot (con código de país, sin `+`) y te muestra un **código de vinculación** en consola. Ve a **WhatsApp → Dispositivos vinculados → Vincular con número de teléfono**, e ingresa ese código. No usa QR.

> 💡 También puedes pasar el número directo al arrancar: `node index.js 51999999999`, o dejarlo fijo en `settings.js` con `global.numeroBot`.

## ⚙️ Correr en producción (PM2)

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # sigue las instrucciones que te muestre, para sobrevivir a reinicios
```

Comandos útiles:
```bash
pm2 status                    # ver estado
pm2 logs tech-master-bot      # ver logs en vivo
pm2 restart tech-master-bot   # reiniciar manual
```

## 👑 Owners

Edita `settings.js` para dar acceso a comandos exclusivos:
```js
global.owner = [
  ['51999999999', 'Nombre'],
]
```
Sin `+`, sin espacios, sin guiones.

## 📂 Estructura

```
tech-master-bot/
├── index.js              # conexión con WhatsApp (código de vinculación)
├── handler.js             # carga plugins y ejecuta comandos
├── settings.js             # nombre, prefijo, owners, creadores
├── ecosystem.config.js       # configuración de PM2
├── lib/
│   ├── dfail.js             # mensajes de error con estilo
│   ├── banner.js             # banner de terminal al iniciar
│   ├── autoupdate.js          # revisa y aplica actualizaciones desde git
│   └── master.jpg             # imagen usada en el menú
└── plugins/
    ├── pping.js               # .ping — mide la latencia real del bot
    ├── pmenu.js               # .menu — menú con imagen, generado automáticamente
    ├── pinfo.js               # .info — estado del bot (uptime, memoria, versión)
    ├── psavefile.js            # .savefile (owner) — crea plugins nuevos desde WhatsApp
    └── pdebug.js               # .debug — diagnóstico del JID del remitente
```

## 🧩 Crear un plugin nuevo

Copia `plugins/pping.js`, cámbiale el nombre de archivo y el `handler.command`. El bot lo carga automáticamente, sin reiniciar, y aparece solo en `.menu`.

```js
let handler = async (m, { conn }) => {
  await conn.sendMessage(m.chat, { text: 'Hola!' }, { quoted: m.raw })
}

handler.help = ['saludo']
handler.tags = ['general']   // agrupa el comando en el menú
handler.command = ['saludo']
// handler.owner = true      // descomenta para restringirlo solo a owners

module.exports = handler
```

## 👥 Creadores

- Matthieu
- AmilcarGit
- Damian
- (vacante)

