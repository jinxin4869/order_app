import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import MenuImage from "../MenuImage";
test("no URL shows the placeholder", async () => {
  const screen = await render(<MenuImage uri={null} />);
  expect(screen.getByText("🍽️")).toBeTruthy();
});
test("a broken image falls back to the placeholder, and a new URL is tried again", async () => {
  const screen = await render(<MenuImage uri="https://example.test/a.jpg" />);
  // RNTL 14 removed UNSAFE_getByType; find the host image directly.
  const [image] = screen.container.queryAll((node) => node.type === "Image");
  await fireEvent(image, "error");
  expect(screen.getByText("🍽️")).toBeTruthy();
  await screen.rerender(<MenuImage uri="https://example.test/b.jpg" />);
  expect(screen.queryByText("🍽️")).toBeNull();
});
