"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { ImageIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import {
  removeStaffPhotoAction,
  uploadStaffPhotoAction,
} from "@/actions/staff.actions";

export function StaffPhotoUploader({
  staffId,
  photoUrl,
}: {
  readonly staffId: string;
  readonly photoUrl: string | null;
}) {
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
    form.set("staffId", staffId);
    form.set("file", file);
    const result = await uploadStaffPhotoAction(form);
    setUploading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (result.success) {
      toast.success("Photo updated");
      router.refresh();
    } else {
      toast.error(result.error ?? "Upload failed");
    }
  };

  const remove = async () => {
    const result = await removeStaffPhotoAction(staffId);
    if (result.success) {
      toast.success("Photo removed");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  return (
    <div className="relative w-fit">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="ring-border bg-muted flex size-20 items-center justify-center overflow-hidden rounded-full ring-1"
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt=""
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
        onClick={() => inputRef.current?.click()}
        className="bg-primary text-primary-foreground absolute right-0 bottom-0 rounded-full p-1.5 shadow"
        aria-label="Upload photo"
      >
        <UploadIcon className="size-3.5" />
      </button>
      {photoUrl ? (
        <button
          type="button"
          onClick={remove}
          className="bg-destructive absolute -top-1 -right-1 rounded-full p-1 text-white"
          aria-label="Remove photo"
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
