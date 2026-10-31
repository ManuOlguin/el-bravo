"use client";
import { Modal, type ModalProps } from "./Modal";

/** Bottom sheet en mobile; modal centrado desde `sm:`. */
export function Sheet(props: Omit<ModalProps, "variant">) {
  return <Modal {...props} variant="sheet" />;
}
