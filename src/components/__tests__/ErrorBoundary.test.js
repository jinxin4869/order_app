/**
 * ErrorBoundaryコンポーネントのテスト
 */

import React from "react";
import { Text } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { ErrorBoundary } from "../ErrorBoundary";

// エラーをスローするコンポーネント
const ThrowError = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <Text>Normal content</Text>;
};

describe("ErrorBoundary", () => {
  // コンソールエラーを抑制
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  test("エラーがない場合は子コンポーネントを表示", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Test content</Text>
      </ErrorBoundary>,
    );

    expect(getByText("Test content")).toBeTruthy();
  });

  test("エラーが発生した場合はエラーメッセージを表示", () => {
    const { getByText, queryByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(getByText("エラーが発生しました")).toBeTruthy();
    expect(
      getByText("アプリケーションでエラーが発生しました。"),
    ).toBeTruthy();
    expect(queryByText("Normal content")).toBeNull();
  });

  test("再試行ボタンをクリックするとエラー状態がリセットされる", () => {
    const { getByText, rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // エラー画面が表示される
    expect(getByText("エラーが発生しました")).toBeTruthy();

    // 再試行ボタンをクリック
    const retryButton = getByText("再試行");
    fireEvent.press(retryButton);

    // エラーなしで再レンダリング
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    // 通常のコンテンツが表示される
    expect(getByText("Normal content")).toBeTruthy();
  });

  test("エラーメッセージが表示される", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(getByText("Test error")).toBeTruthy();
  });
});
