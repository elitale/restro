"use client"

import { useState } from "react"

import { toast } from "sonner"

import { disableItemAction } from "@/actions/menu.actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useServerAction } from "@/hooks/use-server-action"
import { cn } from "@/lib/utils"
import type { MenuItemDTO } from "@/types/menu"

const REASONS = [
  { value: "OUT_OF_STOCK", label: "Out of stock" },
  { value: "QUALITY", label: "Quality" },
  { value: "PREP_TIME", label: "Prep time" },
  { value: "OTHER", label: "Other" },
] as const

const DURATIONS = [
  { value: "eod", label: "Until end of day" },
  { value: "2h", label: "For 2 hours" },
  { value: "tomorrow", label: "Until tomorrow" },
  { value: "manual", label: "Until I re-enable" },
] as const

const resumeAtFor = (choice: string): Date | undefined => {
  const now = new Date()
  if (choice === "2h") return new Date(now.getTime() + 2 * 60 * 60 * 1000)
  if (choice === "eod") {
    const d = new Date(now)
    d.setHours(23, 59, 0, 0)
    return d
  }
  if (choice === "tomorrow") {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    d.setHours(11, 0, 0, 0)
    return d
  }
  return undefined
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

export function EightySixDialog({
  open,
  item,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  item: MenuItemDTO | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [reason, setReason] = useState<string>("OUT_OF_STOCK")
  const [duration, setDuration] = useState<string>("eod")
  const [note, setNote] = useState("")

  const save = useServerAction(disableItemAction, {
    onSuccess: () => {
      toast.success("Item marked unavailable")
      onOpenChange(false)
      onSaved()
    },
    onError: (message) => toast.error(message),
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!item) return
    const resumeAt = resumeAtFor(duration)
    save.execute({
      itemId: item.id,
      reason,
      note: note || undefined,
      resumeAt: resumeAt ? resumeAt.toISOString() : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {item?.name} unavailable</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Reason</span>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <Chip
                  key={r.value}
                  active={reason === r.value}
                  onClick={() => setReason(r.value)}
                >
                  {r.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">For how long</span>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <Chip
                  key={d.value}
                  active={duration === d.value}
                  onClick={() => setDuration(d.value)}
                >
                  {d.label}
                </Chip>
              ))}
            </div>
          </div>
          <Field>
            <FieldLabel htmlFor="eightysix-note">Note (optional)</FieldLabel>
            <Input
              id="eightysix-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. paneer delivery delayed"
            />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Mark unavailable"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
