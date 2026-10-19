import { describe, expect, it } from "vitest";
import { googleCalendarUrl } from "./google-calendar";

const params = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("googleCalendarUrl", () => {
  it("timed event: one hour, UTC stamps", () => {
    const p = params(
      googleCalendarUrl({ title: "Psikotes · PT A", start: new Date("2026-10-19T09:00:00+07:00"), location: "Zoom" }),
    );
    expect(p).toMatchObject({
      action: "TEMPLATE",
      text: "Psikotes · PT A",
      dates: "20261019T020000Z/20261019T030000Z",
      location: "Zoom",
    });
  });

  it("all-day deadline uses the Jakarta date, end exclusive", () => {
    // Midnight Jakarta = 17:00 UTC the day before; the event must still land on the 31st.
    const p = params(
      googleCalendarUrl({ title: "Deadline", start: new Date("2026-10-31T00:00:00+07:00"), allDay: true }),
    );
    expect(p.dates).toBe("20261031/20261101");
    expect(p).not.toHaveProperty("location");
  });

  it("uses the window for Google Calendar", () => {
    const url = googleCalendarUrl({
      title: "T",
      start: new Date("2026-09-29T07:00:00Z"),
      end: new Date("2026-10-01T02:00:00Z"),
    });
    expect(params(url).dates).toBe("20260929T070000Z/20261001T020000Z");
  });
});
