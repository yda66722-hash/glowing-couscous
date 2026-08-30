import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { MENU_PANEL_WIDTH, type FloatingPosition } from "@/lib/floating-menu-utils";
import type { ClickerStatus } from "@/lib/clicker-utils";

export type MenuAction = "toggle" | "stop" | "settings";

type MenuPanelProps = {
  isVisible: boolean;
  onAction: (action: MenuAction) => void;
  position: FloatingPosition;
  status: ClickerStatus;
};

const menuItems: {
  action: MenuAction;
  icon: "play-arrow" | "pause" | "stop" | "tune";
  label: string;
}[] = [
  { action: "toggle", icon: "play-arrow", label: "开始连点" },
  { action: "stop", icon: "stop", label: "停止任务" },
  { action: "settings", icon: "tune", label: "调整参数" },
];

export function MenuPanel({ isVisible, onAction, position, status }: MenuPanelProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(isVisible ? 1 : 0, {
      duration: isVisible ? 240 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [isVisible, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 10 },
      { scale: 0.94 + progress.value * 0.06 },
    ],
  }));

  const positionStyle = { left: position.x, top: position.y };
  const toggleItem = menuItems[0];
  const resolvedItems = [
    { ...toggleItem, icon: status === "running" ? "pause" : "play-arrow", label: status === "running" ? "暂停连点" : "开始连点" },
    menuItems[1],
    menuItems[2],
  ] as const;

  return (
    <Animated.View
      accessibilityLabel="连点器控制菜单"
      pointerEvents={isVisible ? "auto" : "none"}
      style={[styles.panel, positionStyle, panelStyle]}
    >
      <Text style={styles.caption}>快速控制</Text>
      <View style={styles.divider} />
      {resolvedItems.map((item) => (
        <Pressable
          accessibilityLabel={item.label}
          accessibilityRole="button"
          key={item.action}
          onPress={() => onAction(item.action)}
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
        >
          <View style={styles.iconShell}>
            <MaterialIcons color="#BFD0FF" name={item.icon} size={19} />
          </View>
          <Text style={styles.menuLabel}>{item.label}</Text>
          <MaterialIcons color="#91A4D4" name="chevron-right" size={18} />
        </Pressable>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  caption: {
    color: "#AFC3FF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    paddingBottom: 8,
    paddingHorizontal: 14,
    textTransform: "uppercase",
  },
  divider: {
    backgroundColor: "rgba(191, 208, 255, 0.16)",
    height: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  iconShell: {
    alignItems: "center",
    backgroundColor: "rgba(191, 208, 255, 0.12)",
    borderRadius: 12,
    height: 28,
    justifyContent: "center",
    marginRight: 10,
    width: 28,
  },
  menuItem: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    height: 44,
    paddingHorizontal: 10,
  },
  menuItemPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  menuLabel: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  panel: {
    backgroundColor: "#172554",
    borderColor: "rgba(191, 208, 255, 0.18)",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 7,
    paddingBottom: 8,
    paddingTop: 12,
    position: "absolute",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 22,
    width: MENU_PANEL_WIDTH,
  },
});
