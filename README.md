<p align="center">
  <img src="https://i.postimg.cc/MpgS22Wm/file-00000000333c820eabc3104428180474.png" alt="Tech Master Bot" width="100%">
</p>

<h1 align="center">🤖 Tech Master Bot</h1>

<p align="center">
  <strong>Tu asistente inteligente para WhatsApp ⚡</strong>
</p>

<p align="center">
  ⚡ Rápido · 🛡️ Seguro · 🧩 Modular · 🎨 Personalizable
</p>

<p align="center">

![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-WhatsApp-128C7E?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

</p>

---

## 📖 Sobre el proyecto

**Tech Master Bot** es un bot modular para WhatsApp desarrollado con **Node.js** y **Baileys**.

Su arquitectura utiliza un sistema de **plugins**, permitiendo agregar nuevos comandos sin modificar todo el núcleo del bot.

### Objetivos

- 🚀 Fácil instalación
- 🧩 Arquitectura modular
- ⚡ Respuesta rápida
- 🛡️ Funciones administrativas protegidas
- 📱 Experiencia optimizada para WhatsApp
- 🎨 Menú personalizable
- 🔧 Código fácil de mantener

---

## ✨ Características

### 📱 WhatsApp

- 🔗 Vinculación mediante código de teléfono.
- 🚫 No depende de QR.
- 🔄 Reconexión automática.
- 💾 Persistencia de sesión.
- 📡 Procesamiento de mensajes en tiempo real.
- 💬 Soporte para diferentes tipos de mensajes.

### 🧩 Plugins

Los comandos viven dentro de:

```text
plugins/
```

Cada plugin puede definir:

- `handler.command`
- `handler.help`
- `handler.tags`
- `handler.owner`

Ejemplo:

```js
handler.command = ['ping']
handler.help = ['ping']
handler.tags = ['general']
```

### 📋 Menú automático

El menú puede construirse a partir de los plugins instalados y organizarse por categorías.

Ejemplo:

```text
╭────────────────────────╮
│   🤖 TECH MASTER BOT   │
╰────────────────────────╯

📂 GENERAL

> #ping
> #menu
> #info
> #help

📂 OWNER

> #savefile
> #debug
```

### 👑 Owners

Los comandos administrativos pueden protegerse:

```js
handler.owner = true
```

### 🔄 AutoUpdate

El proyecto puede comprobar actualizaciones del repositorio y, cuando está configurado para ello, actualizarse mediante Git y reiniciarse con PM2.

### 🎨 Diseño

- 💚 Estética tecnológica
- 🤖 Branding Tech Master Bot
- 📋 Menú visual
- 🖥️ Banner de terminal
- ⚡ Mensajes personalizados

---

# 🚀 Instalación

## Requisitos

Se recomienda:

- Node.js 18 o superior
- npm
- Git
- Una cuenta de WhatsApp para el bot

## Clonar

```bash
git clone https://github.com/Matthieu-x/tech-master-bot.git
cd tech-master-bot
```

## Instalar

```bash
npm install
```

## Iniciar

```bash
npm start
```

También:

```bash
node index.js
```

---

# 🔗 Vincular WhatsApp

La primera vez se solicitará el número de WhatsApp.

Formato:

```text
51999999999
```

No utilices:

```text
+51999999999
51 999 999 999
51-999-999-999
```

El bot mostrará un código de vinculación.

En WhatsApp:

```text
WhatsApp
  ↓
Dispositivos vinculados
  ↓
Vincular dispositivo
  ↓
Vincular con número de teléfono
```

> ⚠️ Nunca compartas el código de vinculación ni los archivos de sesión.

---

# 🔤 Comandos y prefijos

El sistema puede trabajar con diferentes prefijos según la configuración:

```text
#menu
!menu
.menu
/menu
```

Ejemplos:

```text
#ping
!ping
.ping
/ping
```

> La disponibilidad de cada prefijo depende de la configuración del handler.

---

# 📋 Comandos principales

| Comando | Función | Acceso |
|---|---|---|
| `#menu` | 📋 Menú principal | Todos |
| `#help` | ❓ Ayuda | Todos |
| `#comandos` | 📚 Lista de comandos | Todos |
| `#ping` | ⚡ Latencia | Todos |
| `#info` | ℹ️ Información del bot | Todos |
| `#debug` | 🔧 Diagnóstico | Todos |
| `#savefile` | 💾 Crear plugins | Owner |

Los comandos pueden cambiar según los plugins instalados.

---

# 🧩 Crear un plugin

Crea:

```text
plugins/psaludo.js
```

Contenido:

```js
let handler = async (m, { conn }) => {
  await conn.sendMessage(
    m.chat,
    {
      text: '👋 ¡Hola! Soy Tech Master Bot.'
    },
    {
      quoted: m.raw
    }
  )
}

handler.help = ['saludo']
handler.tags = ['general']
handler.command = ['saludo']

module.exports = handler
```

Después:

```text
#saludo
```

---

# 👑 Plugin exclusivo del Owner

```js
let handler = async (m, { conn }) => {
  await conn.sendMessage(
    m.chat,
    {
      text: '👑 Comando exclusivo del Owner.'
    },
    {
      quoted: m.raw
    }
  )
}

handler.help = ['owner']
handler.tags = ['owner']
handler.command = ['owner']
handler.owner = true

module.exports = handler
```

---

# ⚙️ Configuración

La configuración principal está en:

```text
settings.js
```

Puedes configurar:

- 🤖 Nombre del bot
- 🔤 Prefijos
- 👑 Owners
- 👨‍💻 Creadores
- ⚙️ Opciones generales

Ejemplo de Owner:

```js
global.owner = [
  ['51999999999', 'Nombre del Owner']
]
```

---

# 📂 Estructura

```text
tech-master-bot/
│
├── index.js
├── handler.js
├── settings.js
├── ecosystem.config.js
├── package.json
│
├── session/
│
├── lib/
│   ├── dfail.js
│   ├── banner.js
│   ├── autoupdate.js
│   └── master.jpg
│
└── plugins/
    ├── pmenu.js
    ├── pping.js
    ├── pinfo.js
    ├── psavefile.js
    └── pdebug.js
```

---

# 🖥️ PM2

Instalar:

```bash
sudo npm install -g pm2
```

Iniciar:

```bash
pm2 start ecosystem.config.js
```

Guardar:

```bash
pm2 save
```

Inicio automático:

```bash
pm2 startup
```

## Comandos útiles

```bash
pm2 status
pm2 logs tech-master-bot
pm2 restart tech-master-bot
pm2 stop tech-master-bot
pm2 delete tech-master-bot
```

---

# 🔄 Actualización manual

```bash
git pull
npm install
pm2 restart tech-master-bot
```

---

# 🛡️ Seguridad

Nunca publiques:

```text
session/
```

Tampoco compartas:

- códigos de vinculación
- credenciales
- tokens
- claves API
- archivos de sesión

Se recomienda utilizar variables de entorno para secretos.

---

# 🐛 Diagnóstico

Si el bot está conectado pero no responde:

```bash
pm2 status
```

Después:

```bash
pm2 logs tech-master-bot
```

Prueba:

```text
#ping
```

Si funciona:

```text
#menu
```

Comprueba que exista:

```text
plugins/pmenu.js
```

Y que el plugin exporte:

```js
module.exports = handler
```

---

# 🤝 Contribuir

1. Haz un fork del proyecto.
2. Crea una rama:

```bash
git checkout -b feature/nueva-funcion
```

3. Realiza tus cambios.
4. Prueba el bot.
5. Haz commit:

```bash
git add .
git commit -m "feat: nueva función"
```

6. Envía tu Pull Request.

Consulta `docs/CONTRIBUTING.md` para más información.

---

# 📜 Código de conducta

Consulta:

```text
CODE_OF_CONDUCT.md
```

El objetivo es mantener una comunidad respetuosa y colaborativa.

---

# 🔐 Seguridad

Si encuentras una vulnerabilidad, evita publicarla con credenciales o información sensible.

Consulta:

```text
SECURITY.md
```

---

# 👨‍💻 Creadores

- **Matthieu**
- **AmilcarGit**
- **Damian**

---

# ⭐ Apoya el proyecto

Si te gusta **Tech Master Bot**:

- ⭐ Dale una estrella al repositorio.
- 🍴 Haz un fork.
- 🐛 Reporta errores.
- 💡 Propón nuevas funciones.
- 🤝 Contribuye al proyecto.

---

<p align="center">

### 🤖 TECH MASTER BOT

**El poder de la tecnología a tu servicio.**

⚡ WhatsApp · 🧩 Plugins · 👑 Owners · 🔄 AutoUpdate

</p>
