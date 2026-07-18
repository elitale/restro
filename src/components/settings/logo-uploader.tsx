"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { ImageIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { removeLogoAction, uploadLogoAction } from "@/actions/settings.actions";
import { useImageUpload } from "./use-image-upload";

export function LogoUploader({ logoUrl }: { readonly logoUrl: string | null }) {
  const router = useRouter();
  const { inputRef, uploading, onFile, open } = useImageUpload(
    uploadLogoAction,
    "Logo updated",
  );

  const remove = async () => {
    const result = await removeLogoAction();
    if (result.success) {
      toast.success("Logo removed");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={open}
        disabled={uploading}
        className="border-background ring-border bg-background flex size-20 items-center justify-center overflow-hidden rounded-full border-4 shadow ring-1"
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Logo"
            width={80}
            height={80}
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon className="text-muted-foreground size-6" />
        )}
      </button>
      <button
        type="button"
        onClick={open}
        className="bg-primary text-primary-foreground absolute right-0 bottom-0 rounded-full p-1.5 shadow"
        aria-label="Upload logo"
      >
        <UploadIcon className="size-3.5" />
      </button>
      {logoUrl ? (
        <button
          type="button"
          onClick={remove}
          className="bg-destructive absolute -top-1 -right-1 rounded-full p-1 text-white"
          aria-label="Remove logo"
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
