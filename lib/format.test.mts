import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatGrouped,
  groupDigitsWhileTyping,
  numberSeparators,
  parseLocaleNumber,
  splitNumericInput,
} from "./format.ts";

test("knows each locale's group and decimal separators", () => {
  assert.deepEqual(numberSeparators("NOK"), { group: " ", decimal: "," });
  assert.deepEqual(numberSeparators("EUR"), { group: ".", decimal: "," });
  assert.deepEqual(numberSeparators("USD"), { group: ",", decimal: "." });
});

test("strips grouping before looking for the decimal point", () => {
  // The same comma groups in en-US and separates decimals in nb-NO, so order
  // of operations is the whole game here.
  assert.equal(parseLocaleNumber("1,234", "USD"), 1234);
  assert.equal(parseLocaleNumber("1,234", "NOK"), 1.234);
  assert.equal(parseLocaleNumber("1.234", "EUR"), 1234);
  assert.equal(parseLocaleNumber("1.234", "USD"), 1.234);
  assert.equal(parseLocaleNumber("1 234 567", "NOK"), 1234567);
  assert.equal(parseLocaleNumber("1.234.567,25", "EUR"), 1234567.25);
});

test("accepts either decimal key where the locale's is a comma", () => {
  // Both keys are on the keyboard; people use whichever is nearer.
  assert.equal(parseLocaleNumber("5000,25", "NOK"), 5000.25);
  assert.equal(parseLocaleNumber("5000.25", "NOK"), 5000.25);
});

test("reads signs, blanks and junk without throwing", () => {
  assert.equal(parseLocaleNumber("-45 000", "NOK"), -45000);
  assert.equal(parseLocaleNumber("", "NOK"), null);
  assert.equal(parseLocaleNumber("-", "NOK"), null);
  assert.equal(parseLocaleNumber("kr", "NOK"), null);
  assert.equal(parseLocaleNumber("12abc", "NOK"), 12);
});

test("groups the integer part and leaves a half-typed fraction alone", () => {
  assert.equal(groupDigitsWhileTyping("1234567", "NOK"), "1 234 567");
  assert.equal(groupDigitsWhileTyping("1234567", "USD"), "1,234,567");
  assert.equal(groupDigitsWhileTyping("1234567", "EUR"), "1.234.567");
  // A trailing separator has to survive, or "5000," could never become
  // "5000,25".
  assert.equal(groupDigitsWhileTyping("5000,", "NOK"), "5 000,");
  assert.equal(groupDigitsWhileTyping("5000,2", "NOK"), "5 000,2");
  assert.equal(groupDigitsWhileTyping("-45000", "NOK"), "-45 000");
  assert.equal(groupDigitsWhileTyping("", "NOK"), "");
});

test("grouping and parsing round-trip in every currency", () => {
  for (const code of ["NOK", "SEK", "DKK", "EUR", "USD", "GBP"] as const) {
    for (const value of [0, 7, 1234, 1_000_000, 987_654_321]) {
      const typed = groupDigitsWhileTyping(String(value), code);
      assert.equal(
        parseLocaleNumber(typed, code),
        value,
        `${code}: ${JSON.stringify(typed)}`,
      );
      assert.equal(parseLocaleNumber(formatGrouped(value, code), code), value);
    }
  }
});

test("groups long entries without losing precision to a float round-trip", () => {
  // 18 digits is past what Number can hold exactly; grouping works on the digit
  // string, so display never mangles what was typed.
  const digits = "123456789012345678";
  assert.equal(
    groupDigitsWhileTyping(digits, "USD").replace(/,/g, ""),
    digits,
  );
});

test("splits sign, integer and fraction the way the input relies on", () => {
  assert.deepEqual(splitNumericInput("-1 234,5", "NOK"), {
    negative: true,
    intDigits: "1234",
    fracDigits: "5",
  });
  // No separator typed at all is distinct from an empty fraction.
  assert.deepEqual(splitNumericInput("1234", "NOK"), {
    negative: false,
    intDigits: "1234",
    fracDigits: null,
  });
});
