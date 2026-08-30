import { useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import type { ClickPoint } from "@/lib/clicker-model";
import { clampCoordinate, MAX_POINTS } from "@/lib/clicker-model";

type ClickPointEditorProps = {
  points: ClickPoint[];
  selectedId: number;
  onAdd: () => void;
  onDelete: () => void;
  onMove: (id: number, x: number, y: number) => void;
  onSelect: (id: number) => void;
};

export function ClickPointEditor({
  points,
  selectedId,
  onAdd,
  onDelete,
  onMove,
  onSelect,
}: ClickPointEditorProps) {
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  const canAdd = points.length < MAX_POINTS;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvas({ width, height });
  };

  return (
    <View style={styles.editorShell}>
      <View onLayout={handleLayout} style={styles.canvas}>
        <View pointerEvents="none" style={styles.gridHorizontal} />
        <View pointerEvents="none" style={styles.gridVertical} />
        <Text pointerEvents="none" style={styles.canvasHint}>
          点击点位可选择，按住拖动调整位置
        </Text>
        {points.map((point, index) => (
          <PointHandle
            canvas={canvas}
            isSelected={point.id === selectedId}
            key={point.id}
            label={index + 1}
            point={point}
            onMove={onMove}
            onSelect={onSelect}
          />
        ))}
      </View>
      <View style={styles.toolRail}>
        <ToolButton
          accessibilityLabel={canAdd ? "添加点击点" : "已达到最多九个点击点"}
          disabled={!canAdd}
          icon="add"
          onPress={onAdd}
        />
        <ToolButton
          accessibilityLabel="删除当前点击点"
          disabled={points.length <= 1}
          icon="remove"
          onPress={onDelete}
        />
        <View style={styles.toolDivider} />
        <View style={styles.pointCountBadge}>
          <Text style={styles.pointCountValue}>{points.length}</Text>
          <Text style={styles.pointCountLabel}>点位</Text>
        </View>
      </View>
    </View>
  );
}

type PointHandleProps = {
  canvas: { width: number; height: number };
  isSelected: boolean;
  label: number;
  point: ClickPoint;
  onMove: (id: number, x: number, y: number) => void;
  onSelect: (id: number) => void;
};

function PointHandle({ canvas, isSelected, label, point, onMove, onSelect }: PointHandleProps) {
  const origin = useRef({ x: point.x, y: point.y });
  const pointRef = useRef(point);
  pointRef.current = point;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          origin.current = { x: pointRef.current.x, y: pointRef.current.y };
          onSelect(point.id);
        },
        onPanResponderMove: (_, gesture) => {
          if (!canvas.width || !canvas.height) return;
          onMove(
            point.id,
            clampCoordinate(origin.current.x + gesture.dx / canvas.width),
            clampCoordinate(origin.current.y + gesture.dy / canvas.height),
          );
        },
      }),
    [canvas.height, canvas.width, onMove, onSelect, point.id],
  );

  return (
    <View
      {...responder.panHandlers}
      accessibilityLabel={`点击点 ${label}`}
      accessibilityRole="button"
      style={[
        styles.pointHandle,
        {
          left: canvas.width * point.x - 26,
          top: canvas.height * point.y - 26,
        },
        isSelected && styles.pointHandleSelected,
      ]}
    >
      <Text style={styles.pointLabel}>{label}</Text>
    </View>
  );
}

function ToolButton({
  accessibilityLabel,
  disabled,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: "add" | "remove";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.toolButton, disabled && styles.toolButtonDisabled, pressed && styles.toolButtonPressed]}
    >
      <MaterialIcons color={disabled ? "#AAB7CF" : "#315EF4"} name={icon} size={23} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: "#F1F5FC",
    borderColor: "#DCE5F5",
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    minHeight: 280,
    overflow: "hidden",
  },
  canvasHint: {
    color: "#94A3B8",
    fontSize: 11,
    left: 15,
    position: "absolute",
    top: 13,
  },
  editorShell: {
    flexDirection: "row",
    gap: 10,
    height: 330,
    marginTop: 14,
  },
  gridHorizontal: {
    borderTopColor: "#E5ECF7",
    borderTopWidth: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: "50%",
  },
  gridVertical: {
    borderLeftColor: "#E5ECF7",
    borderLeftWidth: 1,
    bottom: 0,
    left: "50%",
    position: "absolute",
    top: 0,
  },
  pointCountBadge: {
    alignItems: "center",
    marginTop: 2,
  },
  pointCountLabel: {
    color: "#94A3B8",
    fontSize: 10,
    marginTop: 2,
  },
  pointCountValue: {
    color: "#172554",
    fontSize: 18,
    fontWeight: "800",
  },
  pointHandle: {
    alignItems: "center",
    backgroundColor: "#315EF4",
    borderColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 3,
    elevation: 5,
    height: 56,
    justifyContent: "center",
    position: "absolute",
    shadowColor: "#315EF4",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: 56,
  },
  pointHandleSelected: {
    backgroundColor: "#172554",
    borderColor: "#69E5C5",
    borderWidth: 4,
    transform: [{ scale: 1.06 }],
  },
  pointLabel: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  toolButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DCE5F5",
    borderRadius: 25,
    borderWidth: 1,
    elevation: 2,
    height: 50,
    justifyContent: "center",
    shadowColor: "#172554",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    width: 50,
  },
  toolButtonDisabled: {
    backgroundColor: "#F4F7FB",
    elevation: 0,
    opacity: 0.7,
  },
  toolButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  toolDivider: {
    backgroundColor: "#DCE5F5",
    height: 1,
    marginVertical: 3,
    width: 30,
  },
  toolRail: {
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    width: 58,
  },
});
