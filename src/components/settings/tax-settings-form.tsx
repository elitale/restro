"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { toast } from "sonner"

import { updateTaxProfileAction } from "@/actions/settings.actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Toaster } from "@/components/ui/sonner"
import { useServerAction } from "@/hooks/use-server-action"
import type { GstRegistrationType, TaxProfileDTO } from "@/types/settings"

const TYPES: { value: GstRegistrationType; label: string }[] = [
  { value: "UNREGISTERED", label: "Not GST registered" },
  { value: "REGULAR", label: "Regular (collect GST)" },
  { value: "COMPOSITION", label: "Composition scheme" },
]

export function TaxSettingsForm({ profile }: { profile: TaxProfileDTO }) {
  const router = useRouter()
  const [type, setType] = useState<GstRegistrationType>(
    profile.gstRegistrationType,
  )
  const [rate, setRate] = useState(
    profile.serviceGstRate != null ? String(profile.serviceGstRate) : "",
  )
  const [gstin, setGstin] = useState(profile.gstin ?? "")
  const [sacCode, setSac] = useState(profile.sacCode ?? "")
  const [inclusive, setInclusive] = useState(profile.pricesTaxInclusive)

  const save = useServerAction(updateTaxProfileAction, {
    onSuccess: () => {
      toast.success("Tax settings saved")
      router.refresh()
    },
    onError: (message) => toast.error(message),
  })

  const registered = type !== "UNREGISTERED"

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    save.execute({
      gstRegistrationType: type,
      serviceGstRate: registered && rate ? Number(rate) : undefined,
      pricesTaxInclusive: inclusive,
      gstin: registered && gstin ? gstin : undefined,
      sacCode: registered && sacCode ? sacCode : undefined,
    })
  }

  return (
    <>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>GST / Tax</CardTitle>
          <CardDescription>
            Controls how GST is applied to your menu items and bills.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="reg-type">Registration</FieldLabel>
              <Select
                value={type}
                onValueChange={(v) =>
                  v && setType(v as GstRegistrationType)
                }
              >
                <SelectTrigger id="reg-type">
                  <span>{TYPES.find((t) => t.value === type)?.label}</span>
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {registered ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="rate">Service GST %</FieldLabel>
                    <Input
                      id="rate"
                      inputMode="decimal"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      placeholder="5"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="sac">SAC code</FieldLabel>
                    <Input
                      id="sac"
                      value={sacCode}
                      onChange={(e) => setSac(e.target.value)}
                      placeholder="996331"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="gstin">GSTIN</FieldLabel>
                  <Input
                    id="gstin"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Switch
                    id="incl"
                    checked={inclusive}
                    onCheckedChange={setInclusive}
                  />
                  <label htmlFor="incl" className="text-sm">
                    Menu prices include GST
                  </label>
                </div>
                {type === "COMPOSITION" ? (
                  <p className="text-muted-foreground text-xs">
                    Composition scheme: GST isn&apos;t charged separately on the
                    bill — prices are treated as inclusive.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                No GST will be charged. Menu items show &quot;No GST&quot;.
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Toaster />
    </>
  )
}
