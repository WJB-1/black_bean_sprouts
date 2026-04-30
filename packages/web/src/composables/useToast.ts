import { ref } from "vue";
import type { ToastType } from "../components/ui/AppToast.vue";

const toastRef = ref<
  | {
      success: (message: string, duration?: number) => void;
      error: (message: string, duration?: number) => void;
      warning: (message: string, duration?: number) => void;
      info: (message: string, duration?: number) => void;
    }
  | undefined
>();

export function registerToast(instance: NonNullable<(typeof toastRef)["value"]>) {
  toastRef.value = instance;
}

export function useToast() {
  return {
    success: (message: string, duration?: number) => toastRef.value?.success(message, duration),
    error: (message: string, duration?: number) => toastRef.value?.error(message, duration),
    warning: (message: string, duration?: number) => toastRef.value?.warning(message, duration),
    info: (message: string, duration?: number) => toastRef.value?.info(message, duration),
  };
}
