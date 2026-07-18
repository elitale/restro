"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { updateRestaurantProfileAction } from "@/actions/settings.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useServerAction } from "@/hooks/use-server-action";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/business-hours";
import { CUISINE_OPTIONS, FORMAT_OPTIONS } from "@/lib/restaurant-format";
import { cn } from "@/lib/utils";
import type {
  BusinessHoursDTO,
  RestaurantFormat,
  RestaurantProfileDTO,
  ServiceOptions,
} from "@/types/settings";

import { BusinessHoursField } from "./business-hours-field";
import { ServiceOptionsField } from "./service-options-field";

const trimmed = (value: string) => value.trim() || undefined;

export function RestaurantProfileForm({
  profile,
}: {
  readonly profile: RestaurantProfileDTO;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: profile.name,
    legalName: profile.legalName ?? "",
    tagline: profile.tagline ?? "",
    brandColor: profile.brandColor ?? "",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    postalCode: profile.postalCode ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    website: profile.website ?? "",
    instagramUrl: profile.instagramUrl ?? "",
    facebookUrl: profile.facebookUrl ?? "",
    googleUrl: profile.googleUrl ?? "",
    seatingCapacity:
      profile.seatingCapacity != null ? String(profile.seatingCapacity) : "",
    fssaiLicense: profile.fssaiLicense ?? "",
    fssaiExpiry: profile.fssaiExpiry ? profile.fssaiExpiry.slice(0, 10) : "",
    panNumber: profile.panNumber ?? "",
  });
  const [restaurantFormat, setRestaurantFormat] = useState<RestaurantFormat | "">(
    profile.restaurantFormat ?? "",
  );
  const [cuisines, setCuisines] = useState<string[]>([...profile.cuisines]);
  const [services, setServices] = useState<ServiceOptions>({
    dineIn: profile.serviceDineIn,
    takeaway: profile.serviceTakeaway,
    delivery: profile.serviceDelivery,
    defaultType: profile.defaultOrderType,
  });
  const [hours, setHours] = useState<BusinessHoursDTO[]>(
    profile.businessHours ? [...profile.businessHours] : DEFAULT_BUSINESS_HOURS,
  );

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleCuisine = (cuisine: string) =>
    setCuisines((current) =>
      current.includes(cuisine)
        ? current.filter((c) => c !== cuisine)
        : [...current, cuisine],
    );

  const save = useServerAction(updateRestaurantProfileAction, {
    onSuccess: () => {
      toast.success("Profile saved");
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    save.execute({
      name: form.name.trim(),
      legalName: trimmed(form.legalName),
      tagline: trimmed(form.tagline),
      brandColor: trimmed(form.brandColor),
      addressLine1: trimmed(form.addressLine1),
      addressLine2: trimmed(form.addressLine2),
      city: trimmed(form.city),
      state: trimmed(form.state),
      postalCode: trimmed(form.postalCode),
      phone: trimmed(form.phone),
      email: trimmed(form.email),
      website: trimmed(form.website),
      instagramUrl: trimmed(form.instagramUrl),
      facebookUrl: trimmed(form.facebookUrl),
      googleUrl: trimmed(form.googleUrl),
      restaurantFormat: restaurantFormat || undefined,
      cuisines,
      seatingCapacity: form.seatingCapacity
        ? Number(form.seatingCapacity)
        : undefined,
      fssaiLicense: trimmed(form.fssaiLicense),
      fssaiExpiry: form.fssaiExpiry || undefined,
      panNumber: trimmed(form.panNumber),
      serviceDineIn: services.dineIn,
      serviceTakeaway: services.takeaway,
      serviceDelivery: services.delivery,
      defaultOrderType: services.defaultType,
      businessHours: hours,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Business identity</CardTitle>
          <CardDescription>
            The brand name shows on the POS + bill header; the legal entity name
            appears on the GST tax invoice.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="p-name">Brand name</FieldLabel>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Spice Route"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-legal">Legal entity name</FieldLabel>
              <Input
                id="p-legal"
                value={form.legalName}
                onChange={(e) => set("legalName", e.target.value)}
                placeholder="Spice Route Foods Pvt Ltd"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="p-tagline">Tagline</FieldLabel>
            <Input
              id="p-tagline"
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Authentic flavours, since 1998"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="p-color">Brand colour</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.brandColor || "#C2410C"}
                onChange={(e) => set("brandColor", e.target.value)}
                className="size-9 shrink-0 rounded-md border"
                aria-label="Brand colour"
              />
              <Input
                value={form.brandColor}
                onChange={(e) => set("brandColor", e.target.value)}
                placeholder="#C2410C"
                className="w-32"
              />
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Location & contact */}
      <Card>
        <CardHeader>
          <CardTitle>Location &amp; contact</CardTitle>
          <CardDescription>Prints on the invoice and POs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="p-addr1">Address line 1</FieldLabel>
            <Input
              id="p-addr1"
              value={form.addressLine1}
              onChange={(e) => set("addressLine1", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="p-addr2">Address line 2</FieldLabel>
            <Input
              id="p-addr2"
              value={form.addressLine2}
              onChange={(e) => set("addressLine2", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="p-city">City</FieldLabel>
              <Input
                id="p-city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-state">State</FieldLabel>
              <Input
                id="p-state"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-pin">PIN code</FieldLabel>
              <Input
                id="p-pin"
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="p-phone">Phone</FieldLabel>
              <Input
                id="p-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                inputMode="tel"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-email">Email</FieldLabel>
              <Input
                id="p-email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                inputMode="email"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="p-web">Website</FieldLabel>
              <Input
                id="p-web"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-ig">Instagram</FieldLabel>
              <Input
                id="p-ig"
                value={form.instagramUrl}
                onChange={(e) => set("instagramUrl", e.target.value)}
                placeholder="@handle or link"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-fb">Facebook</FieldLabel>
              <Input
                id="p-fb"
                value={form.facebookUrl}
                onChange={(e) => set("facebookUrl", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-goog">Google listing</FieldLabel>
              <Input
                id="p-goog"
                value={form.googleUrl}
                onChange={(e) => set("googleUrl", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
          <CardDescription>
            FSSAI licence prints on the customer bill (legally required). PAN is
            kept back-office and never printed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {profile.fssaiStatus === "expired" ? (
            <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
              Your FSSAI licence has expired — renew it before printing more bills.
            </p>
          ) : profile.fssaiStatus === "expiring" ? (
            <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800">
              Your FSSAI licence expires soon — renew it to stay compliant.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="p-fssai">FSSAI licence no.</FieldLabel>
              <Input
                id="p-fssai"
                value={form.fssaiLicense}
                onChange={(e) => set("fssaiLicense", e.target.value)}
                placeholder="14-digit number"
                inputMode="numeric"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-fssai-exp">FSSAI expiry</FieldLabel>
              <Input
                id="p-fssai-exp"
                type="date"
                value={form.fssaiExpiry}
                onChange={(e) => set("fssaiExpiry", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-pan">PAN</FieldLabel>
              <Input
                id="p-pan"
                value={form.panNumber}
                onChange={(e) => set("panNumber", e.target.value)}
                placeholder="ABCDE1234F"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Service & hours */}
      <Card>
        <CardHeader>
          <CardTitle>Service &amp; hours</CardTitle>
          <CardDescription>What you offer and when you&apos;re open.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Service options</p>
            <ServiceOptionsField value={services} onChange={setServices} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Business hours</p>
            <BusinessHoursField value={hours} onChange={setHours} />
          </div>
        </CardContent>
      </Card>

      {/* Optional details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Optional — helps describe your restaurant.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="p-format">Format</FieldLabel>
              <Select
                value={restaurantFormat || undefined}
                onValueChange={(v) => setRestaurantFormat((v ?? "") as RestaurantFormat | "")}
              >
                <SelectTrigger id="p-format">
                  <span>
                    {FORMAT_OPTIONS.find((o) => o.value === restaurantFormat)
                      ?.label ?? "Select…"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="p-seats">Seating capacity</FieldLabel>
              <Input
                id="p-seats"
                inputMode="numeric"
                value={form.seatingCapacity}
                onChange={(e) => set("seatingCapacity", e.target.value)}
                placeholder="40"
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Cuisines</span>
            <div className="flex flex-wrap gap-1.5">
              {CUISINE_OPTIONS.map((cuisine) => {
                const active = cuisines.includes(cuisine);
                return (
                  <button
                    key={cuisine}
                    type="button"
                    onClick={() => toggleCuisine(cuisine)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:border-primary",
                    )}
                  >
                    {cuisine}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-background/80 sticky bottom-0 flex justify-end gap-2 border-t py-3 backdrop-blur">
        <Button type="submit" disabled={save.isPending || !form.name.trim()}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
