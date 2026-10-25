// メニュー画像。URLがない・読み込めない・差し替え中に壊れた表示を出さない。
import React, { useState } from "react";
import { Image, View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants";

const MenuImage = ({ uri, style, placeholderSize = 30 }) => {
  const [failed, setFailed] = useState(null);
  if (!uri || failed === uri)
    return (
      <View style={[style, styles.placeholder]}>
        <Text style={{ fontSize: placeholderSize }}>🍽️</Text>
      </View>
    );
  return (
    <Image source={{ uri }} style={style} onError={() => setFailed(uri)} />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default MenuImage;
