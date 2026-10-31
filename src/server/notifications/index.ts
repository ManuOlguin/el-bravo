// Punto de entrada de notificaciones (contrato §5.10, dueño W2-3).
// Sin "server-only" a propósito: se importa desde scripts con tsx.
export { notify, normalizeDedupeKey, type NotifyInput } from "./notify";
export {
  emitActivityNotifications,
  emitSeasonPublished,
  emitSeasonStarted,
  emitDueSeasonStarts,
  emitRecentlyPublishedSeasons,
} from "./emit";
export { planActivityNotifications, renderNotification, type PlannedNotification, type RuleContext, type RenderedNotification } from "./rules";
export { CONFIGURABLE_TYPES, TYPE_LABELS, defaultPrefs, loadPrefs, type ConfigurableType, type Channel, type ChannelPrefs } from "./preferences";
