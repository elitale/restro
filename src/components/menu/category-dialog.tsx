"use client"

import { useState } from "react"

import { toast } from "sonner"

import { createCategoryAction, updateCategoryAction } from "@/actions/menu.actions"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useServerAction } from "@/hooks/use-server-action"
import type { MenuCategoryDTO } from "@/types/menu"

export function CategoryDialog({
  open,
  category,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  category: MenuCategoryDTO | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState(category?.name ?? "")
  const [description, setDescription] = useState(category?.description ?? "")
  const [isActive, setIsActive] = useState(category?.isActive ?? true)

  const save = useServerAction(
    category ? updateCategoryAction : createCategoryAction,
    {
      onSuccess: () => {
        toast.success(category ? "Category updated" : "Category created")
        onOpenChange(false)
        onSaved()
      },
      onError: (message) => toast.error(message),
    },
  )

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const payload = {
      name,
      description: description || undefined,
      isActive,
    }
    save.execute(category ? { ...payload, id: category.id } : payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="cat-name">Name</FieldLabel>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Starters"
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cat-desc">Description</FieldLabel>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
          <div className="flex items-center gap-2">
            <Switch
              id="cat-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <label htmlFor="cat-active" className="text-sm">
              Visible on the menu
            </label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending || !name.trim()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
