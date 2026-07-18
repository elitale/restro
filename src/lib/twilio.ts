import twilio from "twilio";

type TwilioClient = ReturnType<typeof twilio>;

let client: TwilioClient | null = null;

const getClient = (): TwilioClient => {
  const accountSid = process.env.TWILLIO_A_SID;
  const authToken =
    process.env.TWILLIO_PRIMARY_TOKEN ?? process.env.TWILLIO_AUTH_SECRET;
  if (!accountSid || !authToken) {
    throw new Error(
      "Twilio credentials (TWILLIO_A_SID / TWILLIO_PRIMARY_TOKEN) are not set.",
    );
  }
  client ??= twilio(accountSid, authToken);
  return client;
};

/** Send an SMS via Twilio Programmable Messaging. */
export const sendSms = async (to: string, body: string): Promise<void> => {
  const from = process.env.TWILLIO_FROM_NUMBER;
  if (!from) {
    throw new Error("TWILLIO_FROM_NUMBER is not set.");
  }
  await getClient().messages.create({ to, from, body });
};
