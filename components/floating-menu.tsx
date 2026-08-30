import { useCallback, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";

import { FloatingBall } from "@/components/floating-ball";
import { MenuPanel, type MenuAction } from "@/components/menu-panel";
import type { ClickerStatus } from "@/lib/clicker-utils";
import {
  createFloatingMenuBounds,
  getMenuPanelPosition,
  type FloatingPosition,
} from "@/lib/floating-menu-utils";

type FloatingMenuProps = {
  onAction: (action: MenuAction) => void;
  status: ClickerStatus;
};

export function FloatingMenu({ onAction, status }: FloatingMenuProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [ballPosition, setBallPosition] = useState<FloatingPosition>({ x: 0, y: 0 });

  const bounds = useMemo(
    () => createFloatingMenuBounds(containerSize.width, containerSize.height),
    [containerSize.height, containerSize.width],
  );

  const panelPosition = useMemo(
    () => getMenuPanelPosition(ballPosition, containerSize.width, containerSize.height),
    [ballPosition, containerSize.height, containerSize.width],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  const handleAction = useCallback(
    (action: MenuAction) => {
      setIsMenuOpen(false);
      onAction(action);
    },
    [onAction],
  );

  return (
    <View onLayout={handleLayout} pointerEvents="box-none" style={styles.overlay}>
      <MenuPanel
        isVisible={isMenuOpen}
        onAction={handleAction}
        position={panelPosition}
        status={status}
      />
      <FloatingBall
        bounds={bounds}
        isMenuOpen={isMenuOpen}
        onDragStart={() => setIsMenuOpen(false)}
        onPositionChange={setBallPosition}
        onToggle={() => setIsMenuOpen((open) => !open)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
