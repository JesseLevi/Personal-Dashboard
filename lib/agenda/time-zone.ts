import { z } from "zod";

/** An IANA time-zone name the runtime knows (e.g. `Europe/Amsterdam`). */
export const timeZoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "invalid time zone");
