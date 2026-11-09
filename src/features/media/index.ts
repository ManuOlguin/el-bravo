// Fotos (§5.8): compresión en el cliente, subida directa al bucket y visualización.
export { PhotoUploader } from "./PhotoUploader";
export { PendingPhotoPicker } from "./PendingPhotoPicker";
export { PhotoGrid } from "./PhotoGrid";
export type { GridPhoto } from "./PhotoGrid";
export { uploadFile, uploadPendingPhotos } from "./upload";
export type { UploadedMedia } from "./upload";
export { compressImage, compressImageForAi, fitWithin } from "./compress";
export type { CompressedImage } from "./compress";
export { MAX_ACTIVITY_PHOTOS, type UploadTarget } from "@/src/server/media/keys";
