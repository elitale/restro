"use client"

import { useState } from "react"

import { UtensilsCrossedIcon } from "lucide-react"

import { PhoneInput } from "@/components/phone-input"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { phoneSchema } from "@/lib/validators/shared"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = phoneSchema.safeParse(phone)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid phone number")
      return
    }
    setError(null)
    // TODO: call the request-OTP server action (Twilio) once auth is wired up.
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UtensilsCrossedIcon className="size-6" />
            </span>
            <h1 className="text-xl font-bold">Sign in to ElitaleRestro</h1>
            <FieldDescription>
              Run your restaurant&apos;s orders, inventory, and billing in one
              place.
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="phone">Phone number</FieldLabel>
            <PhoneInput
              id="phone"
              onChange={(value) => {
                setPhone(value)
                if (error) {
                  setError(null)
                }
              }}
              invalid={Boolean(error)}
            />
            <FieldDescription>
              We&apos;ll text you a one-time code. You can add an email later for
              notifications.
            </FieldDescription>
            {error ? (
              <FieldDescription className="text-destructive">
                {error}
              </FieldDescription>
            ) : null}
          </Field>
          <Field>
            <Button type="submit">Continue</Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By continuing, you agree to our <a href="#">Terms of Service</a> and{" "}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
