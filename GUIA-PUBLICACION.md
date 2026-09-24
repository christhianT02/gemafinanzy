# GemaFinanzy: guía de publicación (una sola vez, ~30 min, costo $0)

Cómo funciona: la app (esta carpeta) se publica en GitHub Pages. Los clientes inician sesión con Google; un servidor en Apps Script comprueba que su correo esté en tu hoja "Autorizados" y guarda sus datos en una carpeta de tu Drive. Así la app se instala con ícono, sincroniza entre dispositivos y solo entra quien tú autorices.

## Paso 1. Hoja de clientes + servidor (Apps Script)
1. Entra a https://sheets.google.com y crea una hoja nueva llamada **GemaFinanzy - Clientes**.
2. Menú **Extensiones → Apps Script**.
3. Borra el código que aparece y pega todo el contenido de `apps-script/Code.gs`. Guarda (ícono de disquete).
4. En la barra superior elige la función **inicializar** y pulsa **Ejecutar**. Google pedirá permisos (Sheets, Drive, conexión externa): acepta. Si sale "Google no ha verificado esta app", pulsa Configuración avanzada → Ir a (proyecto) — es tu propio script.
5. Vuelve a la hoja: ya existe la pestaña **Autorizados** y en tu Drive la carpeta **GemaFinanzy-datos**.

## Paso 2. Inicio de sesión con Google (ID de cliente OAuth)
1. Entra a https://console.cloud.google.com y crea un proyecto llamado GemaFinanzy.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo **Externo**, nombre de la app GemaFinanzy, tu correo de soporte. Deja los permisos por defecto (solo correo y perfil).
3. En esa misma pantalla, pulsa **Publicar aplicación** (estado "En producción"). Si la dejas en "Pruebas", solo podrán entrar 100 correos que agregues a mano.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
5. En **Orígenes autorizados de JavaScript** agrega:
   - `https://TU-USUARIO.github.io` (sin barra final ni ruta; lo obtienes en el Paso 4)
   - `http://localhost:8080` (opcional, para pruebas)
6. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).

## Paso 3. Conectar el servidor y publicarlo
1. En Apps Script: **Configuración del proyecto (engranaje) → Propiedades del script → Agregar propiedad**: nombre `GOOGLE_CLIENT_ID`, valor el ID de cliente del Paso 2.
2. **Implementar → Nueva implementación → Tipo: Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona**. Implementar.
3. Copia la **URL de la aplicación web** (termina en `/exec`).
4. Cada vez que cambies `Code.gs`: Implementar → Administrar implementaciones → editar (lápiz) → Versión: Nueva versión.

## Paso 4. Publicar la app (GitHub Pages)
1. Crea una cuenta gratis en https://github.com y un repositorio público llamado `gemafinanzy`.
2. Abre `config.js` y completa:
   - `API_URL`: la URL `/exec` del Paso 3
   - `GOOGLE_CLIENT_ID`: el ID del Paso 2
   - `CONTACTO`: cómo te contactan (ej. "Escríbeme por WhatsApp al 09...")
3. Sube al repositorio (botón **Add file → Upload files**) el contenido de la carpeta `pwa`: `index.html`, `config.js`, `sw.js`, `manifest.webmanifest` y la carpeta `icons`. **No subas** `apps-script` ni esta guía.
4. **Settings → Pages**: Source = rama `main`, carpeta `/ (root)`. Tu URL será `https://TU-USUARIO.github.io/gemafinanzy/`.
5. Regresa al Paso 2.5 y agrega `https://TU-USUARIO.github.io` a los orígenes autorizados.

## Paso 5. Vender: dar acceso a un cliente
1. Cuando pague, abre la hoja **Autorizados** y agrega una fila: correo de Google del cliente, su nombre, estado `ACTIVO`.
2. Envíale la URL de la app. Debe iniciar sesión con **ese mismo correo**.
3. Instalación:
   - **Android (Chrome)**: menú ⋮ → Instalar aplicación.
   - **iPhone (Safari)**: botón Compartir → Agregar a pantalla de inicio.
   - **Computadora (Chrome/Edge)**: ícono de instalar en la barra de direcciones.
4. Para quitar el acceso: cambia el estado a `BLOQUEADO`. Al sincronizar, la app le pedirá contactarte.

## Cosas que debes saber
- **Privacidad**: los datos de cada cliente quedan en archivos dentro de tu carpeta `GemaFinanzy-datos`. Técnicamente puedes leerlos; avísales en tu oferta y no los uses para nada más.
- **Sincronización**: gana el último cambio. Si dos dispositivos editan a la vez sin conexión, prevalece lo que llegó primero al servidor.
- **Sin internet**: la app sigue funcionando con la copia local y sincroniza al reconectar.
- **Límites gratuitos de Apps Script** (cuenta personal): sobran para decenas de clientes. Si superas ~100 clientes activos, conviene pasar a Firebase.
- **Copias**: quien tenga la URL no pasa de la pantalla de inicio de sesión sin un correo autorizado. Aun así, el código de la página es público: alguien con conocimientos técnicos podría copiarlo, pero sin tu servidor no tendría cuentas ni sincronización. La protección real está en el servidor.
