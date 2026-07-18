"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { ImageIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { removeCoverAction, uploadCoverAction } from "@/actions/settings.actions";
import { Button } from "@/components/ui/button";
import { useImageUpload } from "./use-image-upload";

export function CoverUploader({
  coverUrl,
  brandColor,
}: {
  readonly coverUrl: string | null;
  readonly brandColor: string | null;
}) {
  const router = useRouter();
  const { inputRef, uploading, onFile, open } = useImageUpload(
    uploadCoverAction,
    "Cover updated",
  );

  const remove = async () => {
    const result = await removeCoverAction();
    if (result.success) {
      toast.success("Cover removed");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  return (
    <div
      className="relative h-36 w-full overflow-hidden rounded-xl border"
      style={!coverUrl && brandColor ? { backgroundColor: brandColor } : undefined}
    >
      {coverUrl ? (
        <Image src={coverUrl} alt="Cover" fill className="object-cover" />
      ) : (
        <div className="text-muted-foreground bg-muted/40 flex size-full items-center justify-center">
          <ImageIcon className="size-8" />
        </div>
      )}
      <div className="absolute top-2 right-2 flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={open}
          disabled={uploading}
        >
          <UploadIcon className="size-3.5" />
          {coverUrl ? "Change" : "Add cover"}
        </Button>
        {coverUrl ? (
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            onClick={remove}
            aria-label="Remove cover"
          >
            <XIcon className="size-3.5" />
          </Button>
        ) : null}
      </div>
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
