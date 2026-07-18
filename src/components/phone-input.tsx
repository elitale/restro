"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DEFAULT_COUNTRY: CountryCode = "IN";

/** ISO 3166-1 alpha-2 code → flag emoji (regional indicator symbols). */
const flagEmoji = (country: string): string =>
  country
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

/** Best-effort country detection from the browser locale (client-only). */
const detectCountryByLocale = (): CountryCode | undefined => {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  const locales = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const locale of locales) {
    try {
      const region = new Intl.Locale(locale).region;
      if (region && isSupportedCountry(region)) {
        return region;
      }
    } catch {
      // Ignore malformed locale tags.
    }
  }
  return undefined;
};

/** Compose an E.164 string from a national number typed in the given country. */
const toE164 = (nationalNumber: string, country: CountryCode): string => {
  const digits = nationalNumber.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  const parsed = parsePhoneNumberFromString(digits, country);
  return parsed?.number ?? `+${getCountryCallingCode(country)}${digits}`;
};

/**
 * Detect the country from the visitor's IP address — i.e. where they are
 * accessing from. Runs on the client so it also works in local development.
 * Returns undefined on any failure so the caller can fall back to locale.
 */
const detectCountryByIp = async (
  signal: AbortSignal,
): Promise<CountryCode | undefined> => {
  try {
    const response = await fetch("https://get.geojs.io/v1/ip/country.json", {
      signal,
    });
    if (!response.ok) {
      return undefined;
    }
    const data: unknown = await response.json();
    const code = (data as { country?: unknown }).country;
    if (typeof code === "string" && isSupportedCountry(code)) {
      return code;
    }
  } catch {
    // Network error, blocked, or aborted — caller falls back to locale.
  }
  return undefined;
};

type PhoneInputProps = {
  id?: string;
  onChange: (e164: string) => void;
  defaultCountry?: CountryCode;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
};

export function PhoneInput({
  id,
  onChange,
  defaultCountry,
  invalid,
  disabled,
  className,
}: PhoneInputProps) {
  const [detectedCountry, setDetectedCountry] = useState<CountryCode | null>(
    null,
  );
  const [selectedCountry, setSelectedCountry] = useState<CountryCode | null>(
    null,
  );
  const [nationalNumber, setNationalNumber] = useState("");

  const country =
    selectedCountry ?? defaultCountry ?? detectedCountry ?? DEFAULT_COUNTRY;

  // Auto-detect the country from the visitor's IP (falls back to locale).
  useEffect(() => {
    if (defaultCountry) {
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    detectCountryByIp(controller.signal).then((byIp) => {
      if (cancelled) {
        return;
      }
      const detected = byIp ?? detectCountryByLocale();
      if (detected) {
        setDetectedCountry(detected);
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [defaultCountry]);

  // Keep the parent's E.164 value in sync with the country + national number.
  useEffect(() => {
    onChange(toE164(nationalNumber, country));
  }, [country, nationalNumber, onChange]);

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return getCountries()
      .map((code) => ({
        code,
        name: names.of(code) ?? code,
        dialCode: getCountryCallingCode(code),
        flag: flagEmoji(code),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const handleCountryChange = (value: string | null) => {
    if (!value) {
      return;
    }
    setSelectedCountry(value as CountryCode);
  };

  const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNationalNumber(event.target.value);
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={country}
        onValueChange={handleCountryChange}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label="Country"
          aria-invalid={invalid || undefined}
          className="w-[7rem] shrink-0"
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden>{flagEmoji(country)}</span>
            <span>+{getCountryCallingCode(country)}</span>
          </span>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="min-w-[18rem]"
        >
          {countries.map((item) => (
            <SelectItem key={item.code} value={item.code}>
              <span aria-hidden>{item.flag}</span>
              <span className="flex-1">{item.name}</span>
              <span className="text-muted-foreground">+{item.dialCode}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="98765 43210"
        value={nationalNumber}
        onChange={handleNumberChange}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}
