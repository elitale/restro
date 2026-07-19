"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TableDTO } from "@/types/table";

const fileSlug = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "table";

export function TableShareDialog({
  table,
  username,
  selfOrderEnabled,
  onOpenChange,
}: {
  readonly table: TableDTO;
  readonly username: string;
  readonly selfOrderEnabled: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = origin
    ? `${origin}/order/${username}?table=${table.id}`
    : "";

  useEffect(() => {
    if (!link) {
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(link, { width: 1024, margin: 2 })
      .then((url) => {
        if (!cancelled) {
          setQr(url);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [link]);

  const copy = async () => {
    if (!link) {
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share {table.label}</DialogTitle>
        </DialogHeader>

        {!selfOrderEnabled ? (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            Guest self-ordering is off. Turn it on in{" "}
            <span className="font-medium">Settings → Guest self-ordering</span>{" "}
            for this link to work.
          </p>
        ) : null}

        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <Image
              src={qr}
              alt={`QR code for ${table.label}`}
              width={200}
              height={200}
              unoptimized
              className="rounded-lg border"
            />
          ) : (
            <div className="bg-muted size-[200px] animate-pulse rounded-lg" />
          )}
          <p className="text-muted-foreground text-center text-xs">
            Guests scan this to order for {table.label}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input readOnly value={link} className="text-xs" />
          <Button
            size="icon"
            variant="outline"
            onClick={copy}
            aria-label="Copy link"
          >
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <CopyIcon className="size-4" />
            )}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={!qr}
            render={
              <a href={qr ?? undefined} download={`qr-${fileSlug(table.label)}.png`} />
            }
          >
            <DownloadIcon className="size-4" />
            Download QR
          </Button>
          <Button
            variant="outline"
            disabled={!link}
            render={
              <a href={link || undefined} target="_blank" rel="noopener noreferrer" />
            }
            aria-label="Preview order page"
          >
            <ExternalLinkIcon className="size-4" />
            Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
