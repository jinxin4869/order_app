// レスポンシブデザイン用ユーティリティフック
import { useState, useEffect } from "react";
import { Dimensions } from "react-native";

// 基準となる画面幅（iPhone 11/12/13/14 標準）
const BASE_WIDTH = 390;

// 画面サイズの分類
const SCREEN_SIZES = {
  SMALL: 320, // iPhone SE 1st gen
  MEDIUM: 375, // iPhone SE 2nd/3rd gen, iPhone 8
  LARGE: 390, // iPhone 12/13/14
  XLARGE: 428, // iPhone 12/13/14 Pro Max
};

/**
 * レスポンシブデザイン用のカスタムフック
 * 画面サイズに応じた値を計算するためのユーティリティを提供
 */
export const useResponsive = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;

  // 画面サイズカテゴリを判定
  const getScreenSize = () => {
    if (width <= SCREEN_SIZES.SMALL) return "small";
    if (width <= SCREEN_SIZES.MEDIUM) return "medium";
    if (width <= SCREEN_SIZES.LARGE) return "large";
    return "xlarge";
  };

  // 基準幅に対するスケール係数
  const scale = width / BASE_WIDTH;

  // スケーリングされた値を返す（最小値・最大値指定可能）
  const scaleSize = (size, min = 0, max = Infinity) => {
    const scaled = Math.round(size * scale);
    return Math.max(min, Math.min(max, scaled));
  };

  // フォントサイズ用のスケーリング（控えめにスケール）
  const scaleFontSize = (size, min = 10, max = Infinity) => {
    // フォントは0.85〜1.15の範囲でスケール
    const fontScale = Math.max(0.85, Math.min(1.15, scale));
    const scaled = Math.round(size * fontScale);
    return Math.max(min, Math.min(max, scaled));
  };

  // 画面幅の割合で値を計算
  const widthPercent = (percent) => Math.round((width * percent) / 100);

  // 画面高さの割合で値を計算
  const heightPercent = (percent) => Math.round((height * percent) / 100);

  // 小さい画面かどうか
  const isSmallScreen = width <= SCREEN_SIZES.MEDIUM;

  // 非常に小さい画面かどうか（iPhone SE 1st gen）
  const isVerySmallScreen = width <= SCREEN_SIZES.SMALL;

  return {
    width,
    height,
    scale,
    screenSize: getScreenSize(),
    isSmallScreen,
    isVerySmallScreen,
    scaleSize,
    scaleFontSize,
    widthPercent,
    heightPercent,
  };
};

export default useResponsive;
