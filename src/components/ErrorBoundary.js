// エラーバウンダリコンポーネント
import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { COLORS, FONT_SIZES } from "../constants";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    // エラーが発生したら状態を更新
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // エラーログを記録
    console.error("ErrorBoundary caught:", error, errorInfo);
    // 将来的にFirebase Crashlyticsに送信可能
  }

  handleReset() {
    // エラー状態をリセット
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>😢</Text>
          <Text style={styles.title}>エラーが発生しました</Text>
          <Text style={styles.message}>
            アプリケーションで予期しないエラーが発生しました。
          </Text>
          <Text style={styles.errorDetails}>
            {this.state.error?.message || "Unknown error"}
          </Text>
          <View style={styles.buttonContainer}>
            <Button
              title="再試行"
              onPress={this.handleReset}
              color={COLORS.primary}
            />
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: FONT_SIZES.title,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  errorDetails: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.disabled,
    textAlign: "center",
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: "60%",
    marginTop: 10,
  },
});
