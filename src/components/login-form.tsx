"use client"

import { useEffect, useState } from "react"

import { UtensilsCrossedIcon } from "lucide-react"

import { requestOtpAction, verifyOtpAction } from "@/actions/auth.actions"
import { PhoneInput } from "@/components/phone-input"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useServerAction } from "@/hooks/use-server-action"
import { cn } from "@/lib/utils"
import { phoneSchema } from "@/lib/validators/shared"

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OTP_USER_NOT_FOUND:
    "This phone number isn't registered. Ask your administrator to add you.",
}

const toAuthMessage = (raw: string) => AUTH_ERROR_MESSAGES[raw] ?? raw

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [step, setStep] = useState<"phone" | "code">("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)

  const sendCode = useServerAction(requestOtpAction, {
    onSuccess: () => {
      setError(null)
      setStep("code")
    },
    onError: (message) => {
      const msg = toAuthMessage(message);
      return setError(msg)
    },
  })

  const verify = useServerAction(verifyOtpAction, {
    redirectTo: "/dashboard",
    onError: (message) => setError(toAuthMessage(message)),
  })

  const handlePhoneSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = phoneSchema.safeParse(phone)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid phone number")
      return
    }
    setError(null)
    sendCode.execute({ phone })
  }

  const handleCodeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code")
      return
    }
    setError(null)
    verify.execute({ phone, code })
  }

  useEffect(() => {
    console.log({error})
  }, [error])

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UtensilsCrossedIcon className="size-6" />
        </span>
        <h1 className="text-xl font-bold">Sign in to ElitaleRestro</h1>
        <FieldDescription>
          Run your restaurant&apos;s orders, inventory, and billing in one place.
        </FieldDescription>
      </div>

      {step === "phone" ? (
        <form onSubmit={handlePhoneSubmit}>
          <FieldGroup>
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
                disabled={sendCode.isPending}
              />
              <FieldDescription>
                We&apos;ll text you a one-time code.
              </FieldDescription>
              {error ? (
                <FieldDescription className="text-destructive">
                  {error}
                </FieldDescription>
              ) : null}
            </Field>
            <Field>
              <Button type="submit" disabled={sendCode.isPending}>
                {sendCode.isPending ? "Sending code…" : "Continue"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      ) : (
        <form onSubmit={handleCodeSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="code">Verification code</FieldLabel>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  if (error) {
                    setError(null)
                  }
                }}
                aria-invalid={error ? true : undefined}
                autoFocus
              />
              <FieldDescription>
                Sent to {phone}.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setCode("")
                    setError(null)
                    setStep("phone")
                  }}
                >
                  Change number
                </button>
              </FieldDescription>
              {error ? (
                <FieldDescription className="text-destructive">
                  {error}
                </FieldDescription>
              ) : null}
            </Field>
            <Field>
              <Button type="submit" disabled={verify.isPending}>
                {verify.isPending ? "Verifying…" : "Verify & continue"}
              </Button>
              <FieldDescription className="text-center">
                Didn&apos;t get it?{" "}
                <button
                  type="button"
                  className="underline"
                  disabled={sendCode.isPending}
                  onClick={() => sendCode.execute({ phone })}
                >
                  Resend code
                </button>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      )}

      <FieldDescription className="px-6 text-center">
        By continuing, you agree to our <a href="#">Terms of Service</a> and{" "}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
