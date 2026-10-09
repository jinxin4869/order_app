import { parseOrderLink, buildOrderLink } from "../orderLinks";
test("URL QR codes and legacy QR strings identify the same table", () => {
  const url = buildOrderLink("https://example.test", "rest-test", "table-test");
  expect(url).toBe(
    "https://example.test/order?restaurant=rest-test&table=table-test"
  );
  expect(parseOrderLink(url)).toEqual(parseOrderLink("rest-test/table-test"));
});
test.each([
  "",
  "/table",
  "rest/",
  "rest/table/extra",
  "https://example.test/order?restaurant=../x&table=y",
  "https://example.test/order?restaurant=x&restaurant=z&table=y",
  "https://example.test/staff?restaurant=x&table=y",
  "javascript:alert(1)",
])("rejects malformed QR %s", (input) =>
  expect(parseOrderLink(input)).toBeNull()
);
