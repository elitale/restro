"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import type { ActionResult } from "@/types";

/** Shared file-picker + FormData upload wiring for logo / cover / gallery. */
export function useImageUpload(
  action: (form: FormData) => Promise<ActionResult<unknown>>,
  successMessage: string,
) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    const result = await action(form);
    setUploading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (result.success) {
      toast.success(successMessage);
      router.refresh();
    } else {
      toast.error(result.error ?? "Upload failed");
    }
  };

  return {
    inputRef,
    uploading,
    onFile,
    open: () => inputRef.current?.click(),
  };
}
