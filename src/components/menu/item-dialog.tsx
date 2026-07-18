"use client"

import { useState } from "react"

import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { createItemAction, updateItemAction } from "@/actions/menu.actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useServerAction } from "@/hooks/use-server-action"
import type {
  MenuCategoryDTO,
  MenuItemDTO,
  MenuModifierGroupDTO,
} from "@/types/menu"

import { ImageManager } from "./image-manager"

type VariantRow = { name: string; price: string }

const DIETARY = [
  { value: "NONE", label: "Not set" },
  { value: "VEG", label: "Veg" },
  { value: "NON_VEG", label: "Non-veg" },
  { value: "EGG", label: "Egg" },
]

export function ItemDialog({
  open,
  item,
  categories,
  groups,
  gstRegistered,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  item: MenuItemDTO | null
  categories: readonly MenuCategoryDTO[]
  groups: readonly MenuModifierGroupDTO[]
  gstRegistered: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState(item?.name ?? "")
  const [categoryId, setCategoryId] = useState(
    item?.categoryId ?? categories[0]?.id ?? "",
  )
  const [shortDescription, setShort] = useState(item?.shortDescription ?? "")
  const [longDescription, setLong] = useState(item?.longDescription ?? "")
  const [price, setPrice] = useState(item ? String(item.price) : "")
  const [itemType, setItemType] = useState(item?.itemType ?? "SERVED")
  const [dietaryType, setDietary] = useState(item?.dietaryType ?? "NONE")
  const [goodsGstRate, setGoodsGst] = useState(
    item && item.tax.kind === "GOODS" ? String(item.tax.rate) : "",
  )
  const [hsnSacCode, setHsn] = useState(item?.tax.code ?? "")
  const [priceTaxInclusive, setInclusive] = useState(
    item?.tax.inclusive ?? false,
  )
  const [isActive, setIsActive] = useState(item?.isActive ?? true)
  const [variants, setVariants] = useState<VariantRow[]>(
    item
      ? item.variants.map((v) => ({ name: v.name, price: String(v.price) }))
      : [],
  )
  const [groupIds, setGroupIds] = useState<string[]>(
    item ? item.modifierGroups.map((g) => g.id) : [],
  )

  const save = useServerAction(item ? updateItemAction : createItemAction, {
    onSuccess: () => {
      toast.success(item ? "Item updated" : "Item created")
      onOpenChange(false)
      onSaved()
    },
    onError: (message) => toast.error(message),
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const payload = {
      categoryId,
      name,
      shortDescription: shortDescription || undefined,
      longDescription: longDescription || undefined,
      itemType,
      dietaryType: dietaryType === "NONE" ? undefined : dietaryType,
      price: Number(price),
      priceTaxInclusive: gstRegistered ? priceTaxInclusive : undefined,
      goodsGstRate:
        itemType === "PACKAGED_GOODS" && goodsGstRate
          ? Number(goodsGstRate)
          : undefined,
      hsnSacCode: hsnSacCode || undefined,
      isActive,
      variants: variants
        .filter((v) => v.name.trim())
        .map((v) => ({ name: v.name, price: Number(v.price || 0) })),
      modifierGroupIds: groupIds,
    }
    save.execute(item ? { ...payload, id: item.id } : payload)
  }

  const setVariant = (index: number, key: keyof VariantRow, value: string) =>
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    )

  const canSave = Boolean(name.trim() && categoryId && price !== "")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "New item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="item-name">Name</FieldLabel>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Paneer Tikka"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="item-category">Category</FieldLabel>
              <Select
                value={categoryId}
                onValueChange={(v) => v && setCategoryId(v)}
              >
                <SelectTrigger id="item-category">
                  <span>
                    {categories.find((c) => c.id === categoryId)?.name ??
                      "Select"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="item-price">Price (₹)</FieldLabel>
              <Input
                id="item-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="250"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="item-diet">Dietary</FieldLabel>
              <Select value={dietaryType} onValueChange={(v) => v && setDietary(v)}>
                <SelectTrigger id="item-diet">
                  <span>
                    {DIETARY.find((d) => d.value === dietaryType)?.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {DIETARY.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="item-type">Type</FieldLabel>
              <Select value={itemType} onValueChange={(v) => v && setItemType(v)}>
                <SelectTrigger id="item-type">
                  <span>
                    {itemType === "PACKAGED_GOODS" ? "Packaged goods" : "Served"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SERVED">Served</SelectItem>
                  <SelectItem value="PACKAGED_GOODS">Packaged goods</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="item-short">Short description</FieldLabel>
            <Input
              id="item-short"
              value={shortDescription}
              onChange={(e) => setShort(e.target.value)}
              placeholder="Chargrilled cottage cheese, mint chutney"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-long">Long description</FieldLabel>
            <Textarea
              id="item-long"
              value={longDescription}
              onChange={(e) => setLong(e.target.value)}
              rows={2}
            />
          </Field>

          {gstRegistered ? (
            <div className="flex flex-col gap-3 rounded-md border p-3">
              <span className="text-sm font-medium">GST</span>
              <div className="grid grid-cols-2 gap-3">
                {itemType === "PACKAGED_GOODS" ? (
                  <Field>
                    <FieldLabel htmlFor="item-gst">Goods GST %</FieldLabel>
                    <Input
                      id="item-gst"
                      inputMode="decimal"
                      value={goodsGstRate}
                      onChange={(e) => setGoodsGst(e.target.value)}
                      placeholder="18"
                    />
                  </Field>
                ) : (
                  <p className="text-muted-foreground col-span-2 text-xs">
                    Served items use the restaurant service GST rate.
                  </p>
                )}
                <Field>
                  <FieldLabel htmlFor="item-hsn">HSN / SAC</FieldLabel>
                  <Input
                    id="item-hsn"
                    value={hsnSacCode}
                    onChange={(e) => setHsn(e.target.value)}
                    placeholder="996331"
                  />
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="item-inclusive"
                  checked={priceTaxInclusive}
                  onCheckedChange={setInclusive}
                />
                <label htmlFor="item-inclusive" className="text-sm">
                  Price includes GST
                </label>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Sizes / variants</span>
            {variants.map((v, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Half / Full"
                  value={v.name}
                  onChange={(e) => setVariant(i, "name", e.target.value)}
                />
                <Input
                  placeholder="Price"
                  inputMode="decimal"
                  value={v.price}
                  onChange={(e) => setVariant(i, "price", e.target.value)}
                  className="w-28"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setVariants((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label="Remove variant"
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setVariants((prev) => [...prev, { name: "", price: "" }])
              }
            >
              <PlusIcon className="size-4" /> Add size
            </Button>
          </div>

          {groups.length ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Add-on groups</span>
              <div className="flex flex-col gap-1.5">
                {groups.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={groupIds.includes(g.id)}
                      onCheckedChange={(checked) =>
                        setGroupIds((prev) =>
                          checked
                            ? [...prev, g.id]
                            : prev.filter((x) => x !== g.id),
                        )
                      }
                    />
                    {g.name}
                    <span className="text-muted-foreground">
                      ({g.modifiers.length})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Switch
              id="item-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <label htmlFor="item-active" className="text-sm">
              Available on the menu
            </label>
          </div>

          {item ? (
            <ImageManager itemId={item.id} images={item.images} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Save the item first to add photos.
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={save.isPending || !canSave}>
              {save.isPending ? "Saving…" : "Save item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
