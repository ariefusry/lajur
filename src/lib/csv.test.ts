import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("BOM, CRLF rows, quoting of commas, quotes and newlines; empty for null", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        ["PT A, Tbk", 'kata "kunci"'],
        ["baris\nbaru", null],
      ],
    );
    expect(csv).toBe('﻿a,b\r\n"PT A, Tbk","kata ""kunci"""\r\n"baris\nbaru",\r\n');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(toCsv(["x"], [["=HYPERLINK(1)"], ["-5"], ["@cmd"]])).toBe("﻿x\r\n'=HYPERLINK(1)\r\n'-5\r\n'@cmd\r\n");
  });
});
