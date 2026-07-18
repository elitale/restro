"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import {
  removeGalleryImageAction,
  uploadGalleryImageAction,
} from "@/actions/settings.actions";
import { useServerAction } from "@/hooks/use-server-action";
import type { RestaurantImageDTO } from "@/types/settings";

import { useImageUpload } from "./use-image-upload";

export function GalleryManager({
  gallery,
}: {
  readonly gallery: readonly RestaurantImageDTO[];
}) {
  const router = useRouter();
  const { inputRef, uploading, onFile, open } = useImageUpload(
    uploadGalleryImageAction,
    "Photo added",
  );
  const remove = useServerAction(removeGalleryImageAction, {
    onSuccess: () => {
      toast.success("Photo removed");
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  return (
    <div className="flex flex-wrap gap-2">
      {gallery.map((image) => (
        <div key={image.id} className="relative">
          <Image
            src={image.url}
            alt=""
            width={96}
            height={96}
            className="size-24 rounded-md object-cover"
          />
          <button
            type="button"
            onClick={() => remove.execute({ imageId: image.id })}
            className="bg-destructive absolute -top-1.5 -right-1.5 rounded-full p-1 text-white"
            aria-label="Remove photo"
          >
            <Trash2Icon className="size-3" />
          </button>
        </div>
      ))}
      {gallery.length < 8 ? (
        <button
          type="button"
          onClick={open}
          disabled={uploading}
          className="text-muted-foreground flex size-24 items-center justify-center rounded-md border border-dashed disabled:opacity-50"
          aria-label="Add photo"
        >
          <UploadIcon className="size-5" />
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
