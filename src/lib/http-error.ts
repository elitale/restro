import { NextResponse } from "next/server";

/** Domain error for API route handlers — maps directly to HTTP status + JSON. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export const apiOk = <T>(data: T, init?: ResponseInit): NextResponse =>
  NextResponse.json(data as unknown as object, init);

export const apiNoContent = (): NextResponse =>
  new NextResponse(null, { status: 204 });

export const apiError = (err: unknown): NextResponse => {
  if (err instanceof HttpError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
      },
      { status: err.status },
    );
  }
  // Unknown error — log server-side, return generic 500.
  console.error("[api] Unhandled error:", err);
  return NextResponse.json(
    { error: "Something went wrong", code: "INTERNAL" },
    { status: 500 },
  );
};
