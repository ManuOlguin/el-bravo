import "server-only";

// API de medios para el resto del server (§5.8). El cliente importa tipos y helpers puros desde `./keys`.
export { deleteActivityObjects } from "./service";
export {
  ALLOWED_MIME,
  MAX_BYTES,
  MAX_ACTIVITY_PHOTOS,
  keyFromPublicUrl,
  publicUrlFor,
  thumbKeyFor,
  type UploadTarget,
} from "./keys";
