import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  clamp,
  FLOATING_BALL_SIZE,
  snapToNearestEdge,
  type FloatingMenuBounds,
  type FloatingPosition,
} from "@/lib/floating-menu-utils";

type FloatingBallProps = {
  bounds: FloatingMenuBounds;
  isMenuOpen: boolean;
  onDragStart: () => void;
  onPositionChange: (position: FloatingPosition) => void;
  onToggle: () => void;
};

export function FloatingBall({
  bounds,
  isMenuOpen,
  onDragStart,
  onPositionChange,
  onToggle,
}: FloatingBallProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const iconRotation = useSharedValue(0);
  const isReady = useSharedValue(0);
  const hasInitialized = useRef(false);

  useEffect(() => {
    iconRotation.value = withTiming(isMenuOpen ? 45 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [iconRotation, isMenuOpen]);

  useEffect(() => {
    if (hasInitialized.current || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) {
      return;
    }

    const initialPosition = { x: bounds.maxX, y: bounds.maxY };
    translateX.value = initialPosition.x;
    translateY.value = initialPosition.y;
    isReady.value = withTiming(1, { duration: 180 });
    hasInitialized.current = true;
    onPositionChange(initialPosition);
  }, [bounds, isReady, onPositionChange, translateX, translateY]);

  const pan = Gesture.Pan()
    .minDistance(6)
    .runOnJS(true)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      onDragStart();
    })
    .onUpdate((event) => {
      translateX.value = clamp(startX.value + event.translationX, bounds.minX, bounds.maxX);
      translateY.value = clamp(startY.value + event.translationY, bounds.minY, bounds.maxY);
    })
    .onEnd(() => {
      const snappedPosition = snapToNearestEdge(
        { x: translateX.value, y: translateY.value },
        bounds,
      );
      translateX.value = withTiming(snappedPosition.x, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(snappedPosition.y, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      onPositionChange(snappedPosition);
    });

  const tap = Gesture.Tap()
    .maxDistance(8)
    .runOnJS(true)
    .onEnd((_event, success) => {
      if (success) {
        onToggle();
      }
    });

  const ballStyle = useAnimatedStyle(() => ({
    opacity: isReady.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotation.value}deg` }],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View
        accessible
        accessibilityLabel={isMenuOpen ? "关闭快捷菜单" : "打开快捷菜单"}
        accessibilityRole="button"
        accessibilityState={{ expanded: isMenuOpen }}
        style={[styles.ball, ballStyle]}
      >
        <Animated.View style={iconStyle}>
          <MaterialIcons color="#FFFFFF" name="add" size={28} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  ball: {
    alignItems: "center",
    backgroundColor: "#315EF4",
    borderRadius: FLOATING_BALL_SIZE / 2,
    elevation: 8,
    height: FLOATING_BALL_SIZE,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    shadowColor: "#172554",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    top: 0,
    width: FLOATING_BALL_SIZE,
  },
});
