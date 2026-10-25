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

test("customer screens keep a reloadable table URL instead of serialized navigation objects", () => {
  const { getOrderPath } = require("../orderLinks");
  expect(
    getOrderPath({
      index: 0,
      routes: [
        {
          name: "LanguageSelect",
          params: {
            restaurantId: "rest-test",
            tableId: "table-test",
            restaurant: { name: "Test" },
          },
        },
      ],
    })
  ).toBe("/order?restaurant=rest-test&table=table-test");
  expect(
    getOrderPath({
      routes: [
        {
          name: "OrderEntry",
          params: { restaurant: "rest-test", table: "table-test" },
        },
      ],
    })
  ).toBe("/order?restaurant=rest-test&table=table-test");
  expect(getOrderPath({ routes: [{ name: "QRScanner" }] })).toBeNull();
});
test("table tokens are kept in built links and in the reloadable path", () => {
  const { getOrderPath } = require("../orderLinks");
  const token = "abcdefghijklmnop_-12";
  const url = buildOrderLink(
    "https://example.test",
    "rest-test",
    "table-test",
    token
  );
  expect(url).toBe(
    `https://example.test/order?restaurant=rest-test&table=table-test&token=${token}`
  );
  expect(parseOrderLink(url)).toEqual({
    restaurantId: "rest-test",
    tableId: "table-test",
    token,
  });
  expect(() =>
    buildOrderLink("https://example.test", "rest-test", "table-test", "bad")
  ).toThrow("Invalid table token");
  const path = `/order?restaurant=rest-test&table=table-test&token=${token}`;
  expect(
    getOrderPath({
      routes: [
        {
          name: "Menu",
          params: {
            restaurantId: "rest-test",
            tableId: "table-test",
            table: { token },
          },
        },
      ],
    })
  ).toBe(path);
  expect(
    getOrderPath({
      routes: [
        {
          name: "OrderEntry",
          params: { restaurant: "rest-test", table: "table-test", token },
        },
      ],
    })
  ).toBe(path);
});
