# W4 — App móvil nativa (Capacitor): APK Android, push nativo y widget de amigos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§3 D12, §4, §6.2).

**Goal:** una app instalable en Android (APK distribuido por link) que:
- carga la web de El Bravo;
- recibe notificaciones push nativas;
- trae un **widget de pantalla de inicio tipo Locket**, que muestra la última foto de entrenamiento de un amigo con su nombre y "hace 2 h · Pesas 1 h", y abre ese entrenamiento al tocarlo.

iOS queda como tarea opcional, con el mismo enfoque.

**Architecture:**
- **App:** proyecto Capacitor en `mobile/`, en **modo remoto**. El WebView carga la URL deployada (`APP_URL`), así que las actualizaciones de la web llegan sin reinstalar. Solo el código nativo (push y widget) requiere un APK nuevo.
- **Puente web ↔ nativo:** vive en `src/features/native/*` y solo se activa cuando `Capacitor.isNativePlatform()`. Registra el token de FCM y le pasa al widget un token propio vía SharedPreferences.
- **Widget:** se escribe en Kotlin con Jetpack Glance y consulta `GET /api/widget/feed` con ese token.
- **Push nativo:** el servidor lo envía con Firebase Cloud Messaging, como un canal más de las notificaciones de W2-3.

**Tech Stack:** Capacitor 7 (`@capacitor/core`, `@capacitor/android`, `@capacitor/push-notifications`, `@capacitor/preferences`, `@capacitor/app`), Firebase (FCM) + `firebase-admin`, Kotlin, Jetpack Glance, WorkManager, Android Studio (JDK 17).

**Spec:** `00-roadmap.md` (D12). **Depende de:** W3 (la web tiene que estar deployada en una URL HTTPS estable). **Rama:** `v2/w4-mobile`.

## Global Constraints
- Ver `00-roadmap.md` §4.
- **Nunca** commitear `google-services.json`, el keystore de firma ni las credenciales de Firebase: van en `mobile/android/app/` con entradas en `.gitignore`, y se documenta dónde guardarlos.
- La app es para uso interno: el APK se firma con un keystore propio y se distribuye por link. No hay Play Store en este alcance.

**Requisitos de la máquina (documentar en `docs/mobile.md`):**
- **Android Studio**, con `brew install --cask android-studio` y el SDK de Android 34+ desde el SDK Manager.
- **JDK 17**, que ya viene con Android Studio.
- **Un emulador** Pixel con API 34.
- **Cuenta de Firebase** (gratis): proyecto `el-bravo`, con una app Android de package `app.elbravo.mobile`.

---

### Task 1: Proyecto Capacitor (modo remoto) y APK de debug

**Files:**
- Create: `mobile/package.json` (dependencias de Capacitor aisladas del web)
- Create: `mobile/capacitor.config.ts`
- Create: `mobile/www/index.html` (página mínima de fallback "Sin conexión. Reintentar", que se usa si la URL remota no carga)
- Create: `mobile/android/**` (generado por `npx cap add android`)
- Create: `docs/mobile.md`
- Modify: `.gitignore` (`mobile/node_modules`, `mobile/android/app/google-services.json`, `*.keystore`, `mobile/android/.gradle`, `mobile/android/app/build`)

**`mobile/capacitor.config.ts`:**

```ts
import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "app.elbravo.mobile",
  appName: "El Bravo",
  webDir: "www",
  server: {
    url: process.env.APP_URL ?? "https://<dominio-de-produccion>",
    androidScheme: "https",
    errorPath: "index.html",
  },
  android: { backgroundColor: "#08142d" },
  plugins: { PushNotifications: { presentationOptions: ["badge", "sound", "alert"] } },
};
export default config;
```

- [ ] **Step 1:** `cd mobile && npm init -y && npm i @capacitor/core @capacitor/android @capacitor/push-notifications @capacitor/preferences @capacitor/app && npm i -D @capacitor/cli typescript`.
- [ ] **Step 2:** `npx cap add android`. Ícono y splash con `@capacitor/assets`, a partir de `public/icons/icon.svg` (W0-B): `npx @capacitor/assets generate --android`.
- [ ] **Step 3:** la sesión: el WebView carga el dominio de la web, así que la cookie `elbravo_token` funciona igual que en el navegador. Verificar que el login persiste al cerrar y reabrir la app. Si no persiste, revisar `sameSite`/`secure` en `setSessionCookie` (W0-A); el valor esperado es `lax` + `secure` en HTTPS.
- [ ] **Step 4:** el botón "atrás" de Android navega hacia atrás en el historial y, en `/home`, minimiza la app. Se implementa con `@capacitor/app` → `backButton` en `src/features/native/NativeBridge.tsx` (Task 2).
- [ ] **Step 5:** generar el APK de debug con `cd mobile/android && ./gradlew assembleDebug`. Expected: `app/build/outputs/apk/debug/app-debug.apk`. Instalarlo en el emulador con `adb install -r`.
- [ ] **Step 6:** documentar en `docs/mobile.md` cómo generar un keystore de release (`keytool -genkey …`), firmar (`./gradlew assembleRelease` con `signingConfigs` leyendo variables de entorno) y distribuir el APK (link de Drive o GitHub Release privado), además de los pasos para instalar en Android ("permitir orígenes desconocidos").
- [ ] **Step 7: Commit**

```bash
git add mobile docs/mobile.md .gitignore
git commit -m "feat(mobile): Capacitor Android shell in remote mode"
```

---

### Task 2: Puente nativo en la web + dispositivos

**Files:**
- Create: `src/features/native/platform.ts` (`isNativeApp()`; sin importar Capacitor en el bundle web común: usar `window.Capacitor?.isNativePlatform?.()`)
- Create: `src/features/native/NativeBridge.tsx` (cliente, montado en `app/layout.tsx` solo si `isNativeApp()`; manejo del botón atrás, registro de push y token del widget)
- Create: `src/server/devices/service.ts`
- Create: `src/server/actions/devices-native.ts`
- Test: `src/server/devices/service.int.test.ts`

**Interfaces:**
- Produce:

```ts
export async function registerNativeDeviceAction(input: { platform: "android" | "ios"; fcmToken: string; label?: string }): Promise<ActionResult<{ deviceId: string }>>;
export async function issueWidgetTokenAction(deviceId: string): Promise<ActionResult<{ token: string }>>; // devuelve el token en claro UNA vez; guarda sha256 en Device.widgetTokenHash
export async function revokeDeviceAction(deviceId: string): Promise<ActionResult<void>>;
export async function deviceFromWidgetToken(token: string): Promise<{ userId: string; deviceId: string } | null>;
```

**Reglas:**
- `fcmToken` es único: si otro usuario lo tenía (por ejemplo, cambió la cuenta en el mismo celular), se reasigna.
- El token del widget son 32 bytes aleatorios en base64url. Se guarda solo su hash. Rotarlo invalida el anterior.
- `NativeBridge`, al iniciar sesión:
  1. pide permiso de notificaciones (Android 13+);
  2. registra FCM y llama a `registerNativeDeviceAction`;
  3. pide un token de widget y lo guarda con `Preferences.set({ key: "widgetToken", value })` y `Preferences.set({ key: "apiBaseUrl", value: location.origin })`. El widget lee los dos desde SharedPreferences (`CapacitorStorage`).
- Al hacer logout, se llama a `revokeDeviceAction` y se borran las preferencias.

- [ ] **Step 1:** tests (registro idempotente, reasignación de un `fcmToken`, que un token de widget válido resuelva el usuario, que uno rotado no, y que revocar borre).
- [ ] **Step 2:** implementar. Las dependencias de Capacitor para la web se agregan al `package.json` raíz: `@capacitor/core`, `@capacitor/push-notifications`, `@capacitor/preferences` y `@capacitor/app`. Se importan dinámicamente dentro de `NativeBridge` para no inflar el bundle web.
- [ ] **Step 3: Commit**

```bash
git add src/features/native src/server/devices src/server/actions/devices-native.ts app/layout.tsx package.json package-lock.json
git commit -m "feat(mobile): native bridge, device registration and widget token"
```

---

### Task 3: Push nativo (FCM)

**Files:**
- Modify: `src/server/notifications/push.ts` (agregar el canal FCM junto a Web Push)
- Modify: `.env.example` (`FIREBASE_SERVICE_ACCOUNT_JSON` en base64)
- Create: `mobile/android/app/src/main/res/drawable/ic_stat_notification.xml` (ícono monocromo para la barra de notificaciones)
- Test: `src/server/notifications/push.int.test.ts` (casos FCM con `firebase-admin` mockeado)

**Reglas:**
- Cada notificación con `push=true` se envía a **todos** los dispositivos del usuario: Web Push a los que tienen `pushSubscription` y FCM a los que tienen `fcmToken`.
- El mensaje FCM lleva `notification: { title, body, imageUrl: thumbUrl }` y `data: { href }`. El `NativeBridge` escucha `pushNotificationActionPerformed` y navega a `href`.
- **Refresco del widget:** cuando un amigo registra una actividad con foto, además se envía un mensaje **data-only** `{ type: "widget_refresh" }` a los dispositivos de sus amigos. Esto no muestra nada: el widget se refresca (Task 4).
- Si FCM devuelve un token inválido (`messaging/registration-token-not-registered`), se borra el `fcmToken`.

- [ ] **Step 1:** `npm i firebase-admin`. Crear el proyecto de Firebase y la app Android, y bajar `google-services.json` a `mobile/android/app/` (no se commitea).
- [ ] **Step 2:** escribir los tests e implementar.
- [ ] **Step 3: Verificación manual en el emulador** (con imagen de Google Play Services)
  - Con la app abierta en segundo plano, un amigo registra un entrenamiento con foto: llega la notificación con imagen.
  - Al tocarla, se abre el entrenamiento.
- [ ] **Step 4: Commit**

```bash
git add src/server/notifications .env.example mobile/android/app/src/main/res package.json package-lock.json
git commit -m "feat(mobile): native push notifications via FCM"
```

---

### Task 4: API del widget + widget Android tipo Locket

**Files:**
- Create: `app/api/widget/feed/route.ts`
- Test: `app/api/widget/feed/route.int.test.ts`
- Create: `mobile/android/app/src/main/java/app/elbravo/mobile/widget/FriendsWidget.kt` (`GlanceAppWidget`)
- Create: `mobile/android/app/src/main/java/app/elbravo/mobile/widget/FriendsWidgetReceiver.kt`
- Create: `mobile/android/app/src/main/java/app/elbravo/mobile/widget/WidgetRepository.kt` (lee las prefs, hace el fetch de la API, cachea el JSON y descarga la imagen a disco)
- Create: `mobile/android/app/src/main/java/app/elbravo/mobile/widget/WidgetRefreshWorker.kt` (WorkManager periódico cada 30 min + on-demand)
- Create: `mobile/android/app/src/main/java/app/elbravo/mobile/push/ElBravoMessagingService.kt` (recibe `widget_refresh` y encola el worker)
- Create: `mobile/android/app/src/main/res/xml/friends_widget_info.xml` (tamaño mínimo 2×2, redimensionable hasta 4×4, `previewLayout`)
- Modify: `mobile/android/app/build.gradle` (Glance, WorkManager, Coil o `HttpURLConnection` + `BitmapFactory`), `AndroidManifest.xml` (receiver del widget, servicio FCM, deep links `elbravo://` y `https://<dominio>/workout/*`)

**API `GET /api/widget/feed`:**
- Usa `Authorization: Bearer <widgetToken>` y `deviceFromWidgetToken`. Responde 401 si el token no es válido.
- Devuelve:

```json
{ "items": [ { "activityId": "...", "userName": "Lucio", "userPhotoUrl": "...", "categoryName": "Fuerza", "durationMinutes": 60, "startedAt": "2026-11-02T21:00:00Z", "ago": "hace 2 h", "thumbUrl": "...", "deepLink": "https://<dominio>/workout/..." } ], "generatedAt": "..." }
```

- Los items son los últimos 10 de `getFriendsLatestWithPhoto` (W1-4), es decir, solo actividades con foto de amigos. Si no hay ninguna, devuelve las últimas actividades de amigos sin foto (con `thumbUrl: null`).
- `ago` se calcula en el servidor en es-AR, con la zona horaria del usuario.
- Usa `Cache-Control: private, max-age=60`.
- Tiene un rate limit de 60 requests por hora por device, con el limitador de W1-4.

**Widget (diseño tipo Locket):**
- La foto ocupa todo el widget con esquinas redondeadas (`cornerRadius 24.dp`).
- Abajo, un degradé oscuro con el avatar circular chico, el nombre en negrita, "Pesas · 1 h · hace 2 h" y un 💪 si el usuario ya reaccionó.
- Si el item no tiene foto, se muestra una tarjeta con el fondo `#08142d`, el ícono de la categoría y el mismo texto.
- **Tocar** abre el deep link del entrenamiento en la app.
- **Rotación:** cada refresco muestra el item más reciente que el usuario todavía no vio en el widget (guarda los ids vistos en prefs). Si todos se vieron, muestra el más reciente.
- **Sin sesión o sin token:** muestra "Abrí El Bravo para ver a tus amigos".
- **Refresco:** WorkManager cada 30 minutos (el mínimo de Android es 15), cuando llega el FCM `widget_refresh` y cuando el widget se agrega.

- [ ] **Step 1:** tests de integración de la API (401 sin token, solo amigos, prioridad de items con foto, rate limit).
- [ ] **Step 2:** implementar la API.
- [ ] **Step 3:** implementar el widget en Kotlin. Al terminar, `./gradlew assembleDebug` tiene que compilar sin warnings de Glance.
- [ ] **Step 4: Verificación manual en el emulador**
  1. Agregar el widget a la pantalla de inicio: muestra la foto del último entrenamiento de un amigo.
  2. Que otro usuario amigo registre un entrenamiento con foto: el widget se actualiza en menos de un minuto (vía FCM).
  3. Tocar el widget: abre el entrenamiento.
  4. Hacer logout: el widget muestra "Abrí El Bravo…".
- [ ] **Step 5: Commit**

```bash
git add app/api/widget mobile/android
git commit -m "feat(mobile): Locket-style friends widget for Android with refresh via FCM"
```

---

### Task 5 (opcional, según la decisión de iOS): iOS con Capacitor + WidgetKit

**Requiere:** Mac con Xcode 16+ y la decisión D12-iOS (Apple Developer, USD 99 por año, para TestFlight). Sin la cuenta, solo se puede instalar desde Xcode en un iPhone propio y la instalación vence cada 7 días.

- [ ] `npx cap add ios` en `mobile/` e íconos con `@capacitor/assets generate --ios`.
- [ ] Push: APNs vía FCM. En Firebase, subir la key APNs (`.p8`) y agregar la capability "Push Notifications".
- [ ] **Widget:** extensión WidgetKit en Swift (`FriendsWidget`) con la misma API. Para que el widget lea `widgetToken`/`apiBaseUrl`, usar un **App Group** (`group.app.elbravo.mobile`) y escribir desde la app con un plugin chico de Capacitor que guarde en `UserDefaults(suiteName:)`. `@capacitor/preferences` no escribe en App Groups, así que el plugin se crea en `mobile/ios/App/App/WidgetBridgePlugin.swift`. El refresco es un `TimelineProvider` cada 30 minutos más `WidgetCenter.shared.reloadAllTimelines()` al recibir el push `widget_refresh`.
- [ ] Verificar en el simulador de iOS: instalación, login persistente, push (el simulador acepta pushes simulados con `xcrun simctl push`) y widget.
- [ ] Distribuir por TestFlight (requiere la cuenta). Documentarlo en `docs/mobile.md`.

---

### Verificación final de W4
- [ ] El APK de release está firmado e instalado en al menos 2 celulares Android reales del grupo.
- [ ] Login persistente, push con imagen y widget funcionando y actualizándose.
- [ ] `docs/mobile.md` completo: compilar, firmar, distribuir, rotar claves y troubleshooting (por ejemplo, optimización de batería que frena WorkManager en algunos fabricantes).
- [ ] Ítems cubiertos: 39, 40 (nativo) y 41.
