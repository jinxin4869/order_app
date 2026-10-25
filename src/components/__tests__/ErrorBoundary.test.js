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

  test("エラーがない場合は子コンポーネントを表示", async () => {
    const { getByText } = await render(
      <ErrorBoundary>
        <Text>Test content</Text>
      </ErrorBoundary>
    );

    expect(getByText("Test content")).toBeTruthy();
  });

  test("エラーが発生した場合はエラーメッセージを表示", async () => {
    const { getByText, queryByText } = await render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText("エラーが発生しました")).toBeTruthy();
    expect(
      getByText("アプリケーションで予期しないエラーが発生しました。")
    ).toBeTruthy();
    expect(queryByText("Normal content")).toBeNull();
  });

  test("再試行ボタンをクリックするとエラー状態がリセットされる", async () => {
    const { getByText, rerender } = await render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // エラー画面が表示される
    expect(getByText("エラーが発生しました")).toBeTruthy();

    // 再試行ボタンを取得
    const retryButton = getByText("再試行");

    // エラーなしで再レンダリング (Propsを更新しておく)
    await rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    // 再試行ボタンをクリック (エラー状態リセット -> 新しいPropsでレンダリング)
    await fireEvent.press(retryButton);

    // 通常のコンテンツが表示される
    expect(getByText("Normal content")).toBeTruthy();
  });

  test("エラーメッセージが表示される", async () => {
    const { getByText } = await render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText("Test error")).toBeTruthy();
  });
});
