import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as IntentLauncher from "expo-intent-launcher";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  NativeModules,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ClickPointEditor } from "@/components/click-point-editor";
import { FloatingMenu } from "@/components/floating-menu";
import type { MenuAction } from "@/components/menu-panel";
import { ScreenContainer } from "@/components/screen-container";
import {
  clampNumber,
  createDefaultProfile,
  createShareCode,
  decodeShareCode,
  getPerformanceWarning,
  MAX_CYCLE_COUNT,
  MAX_INTERVAL_MS,
  MIN_CYCLE_COUNT,
  MIN_INTERVAL_MS,
  normalizePoints,
  type ClickerProfile,
  type ClickPoint,
} from "@/lib/clicker-model";
import {
  getClickProgress,
  getClickerStatusLabel,
  type ClickerStatus,
} from "@/lib/clicker-utils";

const PROFILE_STORAGE_KEY = "clicker.profile.v3";
const WELCOME_STORAGE_KEY = "clicker.welcome.seen";

type ClickerNativeBridge = {
  syncProfile?: (profileJson: string) => Promise<void>;
  startClicking?: () => Promise<void>;
  stopClicking?: () => Promise<void>;
  openAccessibilitySettings?: () => Promise<void>;
};

const clickerNative = NativeModules.ClickerNative as ClickerNativeBridge | undefined;

const statusContent: Record<ClickerStatus, { icon: "touch-app" | "play-arrow" | "pause" | "check-circle"; tone: "blue" | "green" | "amber"; text: string }> = {
  idle: { icon: "touch-app", tone: "blue", text: "添加点击点并设置参数，准备好后开始运行。" },
  running: { icon: "play-arrow", tone: "green", text: "连点器正在运行，授权后可通过系统悬浮球控制。" },
  paused: { icon: "pause", tone: "amber", text: "任务已暂停，当前进度和点位配置都会保留。" },
  complete: { icon: "check-circle", tone: "green", text: "本轮运行完成，可以保存或重新开始。" },
};

const featureCards = [
  { icon: "touch-app" as const, title: "多点编辑", subtitle: "添加、编号、拖动和删除多个圆形点击点。" },
  { icon: "save" as const, title: "随时保存", subtitle: "方案和点位保存在本机，修改后可继续使用。" },
  { icon: "share" as const, title: "代码复用", subtitle: "用随机数字与英文分享码在论坛发布和导入。" },
];

export default function App() {
  const [profile, setProfile] = useState<ClickerProfile>(createDefaultProfile);
  const [selectedPointId, setSelectedPointId] = useState(1);
  const [status, setStatus] = useState<ClickerStatus>("idle");
  const [completedCount, setCompletedCount] = useState(0);
  const [activity, setActivity] = useState("点击右侧加号添加点位，或先调整当前方案参数。");
  const [showWelcome, setShowWelcome] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCode, setShareCode] = useState("");
  const [importCode, setImportCode] = useState("");
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(PROFILE_STORAGE_KEY), AsyncStorage.getItem(WELCOME_STORAGE_KEY)]).then(
      ([storedProfile, welcomeSeen]) => {
        if (!active) return;
        if (storedProfile) {
          try {
            const parsed = JSON.parse(storedProfile) as ClickerProfile;
            if (parsed.points?.length) {
              const restored = { ...createDefaultProfile(), ...parsed, points: normalizePoints(parsed.points) };
              setProfile(restored);
              setSelectedPointId(restored.points[0].id);
            }
          } catch {
            setActivity("本地方案读取失败，已使用默认方案。");
          }
        }
        setShowWelcome(welcomeSeen !== "1");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "android" && clickerNative?.syncProfile) {
      void clickerNative.syncProfile(JSON.stringify(profile));
    }
  }, [profile]);

  useEffect(() => {
    if (status !== "running") return;
    const timer = setInterval(() => {
      setCompletedCount((current) => Math.min(current + 1, profile.cycleCount));
    }, profile.intervalMs);
    return () => clearInterval(timer);
  }, [profile.cycleCount, profile.intervalMs, status]);

  useEffect(() => {
    if (status === "running" && completedCount >= profile.cycleCount) {
      setStatus("complete");
      setActivity("本轮多点连点已完成，可保存当前方案或重新运行。");
    }
  }, [completedCount, profile.cycleCount, status]);

  const selectedPoint = profile.points.find((point) => point.id === selectedPointId) ?? profile.points[0];
  const currentStatus = statusContent[status];
  const progress = useMemo(
    () => getClickProgress(completedCount, profile.cycleCount),
    [completedCount, profile.cycleCount],
  );
  const warning = useMemo(
    () => getPerformanceWarning(profile.points, profile.intervalMs, profile.cycleCount),
    [profile.cycleCount, profile.intervalMs, profile.points],
  );

  const updateProfile = (updater: (current: ClickerProfile) => ClickerProfile) => {
    setProfile((current) => updater(current));
  };

  const handleToggle = () => {
    if (status === "running") {
      setStatus("paused");
      setActivity("连点已暂停，当前方案和进度已保留。");
      return;
    }
    if (status === "complete") setCompletedCount(0);
    setStatus("running");
    setActivity("连点已启动，正在按方案顺序运行点位。");
    if (Platform.OS === "android" && clickerNative?.startClicking) {
      void clickerNative.startClicking().catch(() => setActivity("请先启用 Android 无障碍服务，再开始应用外连点。"));
    }
  };

  const handleStop = () => {
    setStatus("idle");
    setCompletedCount(0);
    setActivity("任务已停止，下一次开始会从 0 计数。");
    if (Platform.OS === "android" && clickerNative?.stopClicking) {
      void clickerNative.stopClicking();
    }
  };

  const handleMenuAction = (action: MenuAction) => {
    if (action === "toggle") {
      handleToggle();
      return;
    }
    if (action === "stop") {
      handleStop();
      return;
    }
    setActivity("已打开当前方案编辑区，可调整点位和运行参数。");
  };

  const addPoint = () => {
    const nextId = profile.points.length + 1;
    updateProfile((current) => ({ ...current, points: [...current.points, { ...createDefaultProfile().points[0], id: nextId, x: 0.2 + (nextId % 4) * 0.18, y: 0.24 + (nextId % 3) * 0.22 }] }));
    setSelectedPointId(nextId);
    setActivity(`已添加点击点 ${nextId}，按住圆点可拖动位置。`);
  };

  const deleteSelectedPoint = () => {
    if (profile.points.length <= 1) return;
    const remaining = normalizePoints(profile.points.filter((point) => point.id !== selectedPointId));
    setProfile((current) => ({ ...current, points: remaining }));
    setSelectedPointId(remaining[0].id);
    setActivity("已删除当前点击点，剩余点位已重新编号。");
  };

  const updatePoint = (id: number, patch: Partial<ClickPoint>) => {
    updateProfile((current) => ({
      ...current,
      points: current.points.map((point) => (point.id === id ? { ...point, ...patch } : point)),
    }));
  };

  const updateInterval = (delta: number) => {
    updateProfile((current) => ({ ...current, intervalMs: clampNumber(current.intervalMs + delta, MIN_INTERVAL_MS, MAX_INTERVAL_MS) }));
    setActivity("全局点击间隔已更新。");
  };

  const updateCycleCount = (delta: number) => {
    updateProfile((current) => ({ ...current, cycleCount: clampNumber(current.cycleCount + delta, MIN_CYCLE_COUNT, MAX_CYCLE_COUNT) }));
    setActivity("循环次数已更新。");
  };

  const saveProfile = async () => {
    const normalized = { ...profile, points: normalizePoints(profile.points), createdAt: new Date().toISOString() };
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
    setProfile(normalized);
    setSavedAt(new Date().toLocaleTimeString());
    setShowSaveModal(false);
    setActivity(`方案“${normalized.name}”已保存到本机。`);
  };

  const generateCode = () => {
    const code = createShareCode(profile);
    setShareCode(code);
    setActivity("分享码已生成，可以复制到官方论坛或发送给其他玩家。");
  };

  const copyCode = async () => {
    if (!shareCode) return;
    await Clipboard.setStringAsync(shareCode);
    setActivity("分享码已复制，可以粘贴到官方论坛。");
  };

  const systemShare = async () => {
    if (!shareCode) return;
    await Share.share({ message: `连点器方案：${profile.name}\n分享码：${shareCode}` });
  };

  const importProfile = () => {
    const decoded = decodeShareCode(importCode.trim());
    if (!decoded) {
      setActivity("分享码无效，请确认是以 YUT- 开头的完整代码。");
      return;
    }
    setProfile(decoded);
    setSelectedPointId(decoded.points[0].id);
    setImportCode("");
    setActivity(`已导入方案“${decoded.name}”，现在可以修改或保存。`);
  };

  const openAccessibilitySettings = async () => {
    if (Platform.OS !== "android") {
      setActivity("系统级悬浮球仅支持 Android；当前平台可使用应用内连点器。");
      return;
    }
    if (clickerNative?.openAccessibilitySettings) {
      await clickerNative.openAccessibilitySettings();
      return;
    }
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.ACCESSIBILITY_SETTINGS);
  };

  const dismissWelcome = async () => {
    await AsyncStorage.setItem(WELCOME_STORAGE_KEY, "1");
    setShowWelcome(false);
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.eyebrow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrowText}>CLICK ASSISTANT</Text>
            </View>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>连点器</Text>
                <Text style={styles.subtitle}>创建多个点击点，配置节奏后随时运行。</Text>
              </View>
              <Pressable accessibilityLabel="分享当前方案" accessibilityRole="button" onPress={() => { setShowShareModal(true); generateCode(); }} style={styles.headerIconButton}>
                <MaterialIcons color="#315EF4" name="share" size={20} />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroOverline}>当前方案 · {profile.name}</Text>
                <Text style={styles.heroTitle}>{getClickerStatusLabel(status)}</Text>
              </View>
              <View style={[styles.statusBadge, statusToneStyles[currentStatus.tone].badge]}>
                <View style={[styles.statusDot, statusToneStyles[currentStatus.tone].dot]} />
                <Text style={[styles.statusBadgeText, statusToneStyles[currentStatus.tone].text]}>{status === "running" ? "ACTIVE" : "READY"}</Text>
              </View>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressValue}>{completedCount}</Text>
              <Text style={styles.progressTarget}>/ {profile.cycleCount} 轮</Text>
            </View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(progress * 100, 3)}%` }]} /></View>
            <Text style={styles.heroHint}>{activity}</Text>
          </View>

          <View style={styles.primaryActions}>
            <Pressable accessibilityLabel={status === "running" ? "暂停连点" : "开始连点"} accessibilityRole="button" onPress={handleToggle} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
              <MaterialIcons color="#FFFFFF" name={status === "running" ? "pause" : "play-arrow"} size={22} />
              <Text style={styles.primaryButtonText}>{status === "running" ? "暂停连点" : "开始连点"}</Text>
            </Pressable>
            <Pressable accessibilityLabel="停止连点任务" accessibilityRole="button" onPress={handleStop} style={({ pressed }) => [styles.stopButton, pressed && styles.secondaryPressed]}>
              <MaterialIcons color="#315EF4" name="stop" size={20} />
              <Text style={styles.stopButtonText}>停止</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionLabel}>点击点编辑器</Text>
            <Text style={styles.sectionMeta}>已选 {selectedPointId}</Text>
          </View>
          <ClickPointEditor points={profile.points} selectedId={selectedPointId} onAdd={addPoint} onDelete={deleteSelectedPoint} onMove={(id, x, y) => updatePoint(id, { x, y })} onSelect={setSelectedPointId} />

          <Text style={styles.sectionLabel}>运行参数</Text>
          <View style={styles.settingsGrid}>
            <SettingCard icon="timer" label="点击间隔" value={`${profile.intervalMs} ms`} hint={`${MIN_INTERVAL_MS}–${MAX_INTERVAL_MS} ms`} onDecrease={() => updateInterval(-50)} onIncrease={() => updateInterval(50)} />
            <SettingCard icon="repeat" label="运行轮数" value={`${profile.cycleCount} 轮`} hint={`${MIN_CYCLE_COUNT}–${MAX_CYCLE_COUNT}`} onDecrease={() => updateCycleCount(-1)} onIncrease={() => updateCycleCount(1)} />
          </View>

          {selectedPoint && (
            <View style={styles.pointSettingsCard}>
              <View style={styles.pointSettingsHeader}>
                <View><Text style={styles.pointSettingsTitle}>点击点 {selectedPoint.id} 参数</Text><Text style={styles.pointSettingsSubtitle}>每轮在该位置执行一次点击</Text></View>
                <MaterialIcons color="#315EF4" name="tune" size={22} />
              </View>
              <View style={styles.inlineParameterRow}>
                <Text style={styles.inlineParameterLabel}>重复次数</Text>
                <View style={styles.inlineStepper}>
                  <StepButton label="−" onPress={() => updatePoint(selectedPoint.id, { repeatCount: clampNumber(selectedPoint.repeatCount - 1, 1, 9999) })} />
                  <Text style={styles.inlineParameterValue}>{selectedPoint.repeatCount}</Text>
                  <StepButton label="＋" onPress={() => updatePoint(selectedPoint.id, { repeatCount: clampNumber(selectedPoint.repeatCount + 1, 1, 9999) })} />
                </View>
              </View>
            </View>
          )}

          {warning && (
            <View style={[styles.warningCard, warning.level === "red" && styles.warningCardRed]}>
              <MaterialIcons color={warning.level === "red" ? "#B42318" : "#B76E00"} name="warning" size={21} />
              <Text style={styles.warningText}>{warning.message}</Text>
            </View>
          )}

          <View style={styles.actionGrid}>
            <ActionButton icon="save" label="保存方案" onPress={() => setShowSaveModal(true)} />
            <ActionButton icon="share" label="生成分享码" onPress={() => { setShowShareModal(true); generateCode(); }} />
          </View>

          <Pressable accessibilityLabel="打开 Android 无障碍服务设置" accessibilityRole="button" onPress={openAccessibilitySettings} style={({ pressed }) => [styles.permissionCard, pressed && styles.secondaryPressed]}>
            <View style={styles.permissionIcon}><MaterialIcons color="#D97706" name="security" size={21} /></View>
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>退出应用后显示悬浮球</Text>
              <Text style={styles.permissionText}>点击打开 Android 无障碍服务设置，启用“连点器”后由前台服务保留悬浮控制球。</Text>
            </View>
            <MaterialIcons color="#D97706" name="open-in-new" size={20} />
          </Pressable>

          <Text style={styles.sectionLabel}>使用方式</Text>
          <View style={styles.features}>{featureCards.map((card) => <View key={card.title} style={styles.featureCard}><View style={styles.featureIcon}><MaterialIcons color="#315EF4" name={card.icon} size={20} /></View><View style={styles.featureCopy}><Text style={styles.featureTitle}>{card.title}</Text><Text style={styles.featureSubtitle}>{card.subtitle}</Text></View></View>)}</View>
        </ScrollView>
        <FloatingMenu onAction={handleMenuAction} status={status} />
      </ScreenContainer>

      <Modal animationType="fade" transparent visible={showWelcome} onRequestClose={dismissWelcome}>
        <View style={styles.modalBackdrop}><View style={styles.welcomeModal}><View style={styles.welcomeIcon}><MaterialIcons color="#315EF4" name="flight" size={28} /></View><Text style={styles.welcomeTitle}>你好，欢迎使用连点器</Text><Text style={styles.welcomeText}>如果应用有一些错误的话请包容，创作者只是一个人的团队，并且应用与广告也无充值，只为提供给用户最好的体验</Text><Text style={styles.welcomeAuthor}>by 纸飞机yut</Text><Pressable accessibilityRole="button" onPress={dismissWelcome} style={styles.modalPrimaryButton}><Text style={styles.modalPrimaryButtonText}>开始使用</Text></Pressable></View></View>
      </Modal>

      <Modal animationType="slide" transparent visible={showSaveModal} onRequestClose={() => setShowSaveModal(false)}>
        <View style={styles.modalBackdrop}><View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>保存方案</Text><Pressable accessibilityLabel="关闭保存窗口" onPress={() => setShowSaveModal(false)}><MaterialIcons color="#64748B" name="close" size={22} /></Pressable></View><Text style={styles.inputLabel}>方案名称</Text><TextInput accessibilityLabel="方案名称" onChangeText={(name) => setProfile((current) => ({ ...current, name }))} placeholder="例如：刷材料方案" placeholderTextColor="#94A3B8" style={styles.textInput} value={profile.name} /><Text style={styles.sheetHint}>{savedAt ? `上次保存：${savedAt}` : "方案只保存在本机，不会自动上传。"}</Text><Pressable accessibilityRole="button" onPress={saveProfile} style={styles.modalPrimaryButton}><MaterialIcons color="#FFFFFF" name="save" size={19} /><Text style={styles.modalPrimaryButtonText}>保存到本机</Text></Pressable></View></View>
      </Modal>

      <Modal animationType="slide" transparent visible={showShareModal} onRequestClose={() => setShowShareModal(false)}>
        <View style={styles.modalBackdrop}><View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>分享与导入</Text><Pressable accessibilityLabel="关闭分享窗口" onPress={() => setShowShareModal(false)}><MaterialIcons color="#64748B" name="close" size={22} /></Pressable></View><Text style={styles.inputLabel}>当前分享码</Text><View style={styles.codeBox}><Text selectable style={styles.codeText}>{shareCode || "点击下方生成分享码"}</Text></View><View style={styles.shareButtonRow}><SmallAction icon="refresh" label="重新生成" onPress={generateCode} /><SmallAction icon="content-copy" label="复制" onPress={copyCode} /><SmallAction icon="ios-share" label="分享" onPress={systemShare} /></View><View style={styles.sheetDivider} /><Text style={styles.inputLabel}>导入他人代码</Text><TextInput accessibilityLabel="导入分享码" autoCapitalize="characters" onChangeText={setImportCode} placeholder="粘贴 YUT- 开头的分享码" placeholderTextColor="#94A3B8" style={[styles.textInput, styles.codeInput]} value={importCode} /><Pressable accessibilityRole="button" onPress={importProfile} style={styles.modalSecondaryButton}><MaterialIcons color="#315EF4" name="file-download" size={19} /><Text style={styles.modalSecondaryButtonText}>导入并编辑</Text></Pressable><Text style={styles.sheetHint}>分享码只包含你主动生成的方案数据。复制到官方论坛后，其他玩家可手动粘贴导入。</Text></View></View>
      </Modal>
    </GestureHandlerRootView>
  );
}

function SettingCard({ icon, label, value, hint, onDecrease, onIncrease }: { icon: "timer" | "repeat"; label: string; value: string; hint: string; onDecrease: () => void; onIncrease: () => void }) {
  return <View style={styles.settingCard}><View style={styles.settingHeader}><View style={styles.settingIcon}><MaterialIcons color="#315EF4" name={icon} size={19} /></View><Text style={styles.settingLabel}>{label}</Text></View><Text style={styles.settingValue}>{value}</Text><View style={styles.stepperRow}><StepButton label="−" onPress={onDecrease} /><Text style={styles.stepHint}>{hint}</Text><StepButton label="＋" onPress={onIncrease} /></View></View>;
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={`${label} 调整参数`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.stepButton, pressed && styles.secondaryPressed]}><Text style={styles.stepButtonText}>{label}</Text></Pressable>;
}

function ActionButton({ icon, label, onPress }: { icon: "save" | "share"; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.secondaryPressed]}><MaterialIcons color="#315EF4" name={icon} size={19} /><Text style={styles.actionButtonText}>{label}</Text></Pressable>;
}

function SmallAction({ icon, label, onPress }: { icon: "refresh" | "content-copy" | "ios-share"; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.smallAction, pressed && styles.secondaryPressed]}><MaterialIcons color="#315EF4" name={icon} size={18} /><Text style={styles.smallActionText}>{label}</Text></Pressable>;
}

const statusToneStyles = {
  amber: { badge: { backgroundColor: "rgba(217, 119, 6, 0.16)" }, dot: { backgroundColor: "#F59E0B" }, text: { color: "#FBBF24" } },
  blue: { badge: { backgroundColor: "rgba(49, 94, 244, 0.16)" }, dot: { backgroundColor: "#93B4FF" }, text: { color: "#BFD0FF" } },
  green: { badge: { backgroundColor: "rgba(15, 158, 130, 0.18)" }, dot: { backgroundColor: "#4ADE80" }, text: { color: "#A7F3D0" } },
} as const;

const styles = StyleSheet.create({
  actionButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE5F5", borderRadius: 15, borderWidth: 1, flex: 1, flexDirection: "row", height: 52, justifyContent: "center" },
  actionButtonText: { color: "#315EF4", fontSize: 14, fontWeight: "800", marginLeft: 7 },
  actionGrid: { flexDirection: "row", gap: 10, marginTop: 14 },
  codeBox: { backgroundColor: "#F1F5FC", borderColor: "#DCE5F5", borderRadius: 13, borderWidth: 1, minHeight: 80, padding: 12 },
  codeInput: { fontSize: 12 },
  codeText: { color: "#172554", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12, lineHeight: 18 },
  editorShell: { flexDirection: "row" },
  eyebrow: { alignItems: "center", flexDirection: "row" },
  eyebrowDot: { backgroundColor: "#0F9E82", borderRadius: 4, height: 8, marginRight: 7, width: 8 },
  eyebrowText: { color: "#5270C9", fontSize: 12, fontWeight: "800", letterSpacing: 1.1 },
  featureCard: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#E4EAF4", borderRadius: 18, borderWidth: 1, flexDirection: "row", padding: 16 },
  featureCopy: { flex: 1 },
  featureIcon: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 12, height: 38, justifyContent: "center", marginRight: 12, width: 38 },
  featureSubtitle: { color: "#64748B", fontSize: 13, lineHeight: 19, marginTop: 4 },
  featureTitle: { color: "#172554", fontSize: 15, fontWeight: "700" },
  features: { gap: 12 },
  header: { paddingTop: 18 },
  headerIconButton: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  heroCard: { backgroundColor: "#172554", borderRadius: 24, marginTop: 24, padding: 20, shadowColor: "#172554", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 18 },
  heroHint: { color: "#BFD0FF", fontSize: 13, lineHeight: 19, marginTop: 13 },
  heroOverline: { color: "#AFC3FF", fontSize: 12, fontWeight: "700", letterSpacing: 0.4, maxWidth: 240 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "800", marginTop: 5 },
  heroTopRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  inlineParameterLabel: { color: "#475569", fontSize: 14, fontWeight: "700" },
  inlineParameterRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  inlineParameterValue: { color: "#172554", fontSize: 18, fontWeight: "800", minWidth: 40, textAlign: "center" },
  inlineStepper: { alignItems: "center", flexDirection: "row", gap: 10 },
  inputLabel: { color: "#475569", fontSize: 13, fontWeight: "800", marginBottom: 8 },
  modalBackdrop: { backgroundColor: "rgba(15, 23, 42, 0.52)", flex: 1, justifyContent: "flex-end" },
  modalPrimaryButton: { alignItems: "center", backgroundColor: "#315EF4", borderRadius: 14, flexDirection: "row", height: 52, justifyContent: "center", marginTop: 20 },
  modalPrimaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", marginLeft: 8 },
  modalSecondaryButton: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 14, flexDirection: "row", height: 50, justifyContent: "center", marginTop: 13 },
  modalSecondaryButtonText: { color: "#315EF4", fontSize: 14, fontWeight: "800", marginLeft: 8 },
  permissionCard: { alignItems: "center", backgroundColor: "#FFF8E7", borderColor: "#F5D99B", borderRadius: 18, borderWidth: 1, flexDirection: "row", marginTop: 22, padding: 15 },
  permissionCopy: { flex: 1, marginHorizontal: 12 },
  permissionIcon: { alignItems: "center", backgroundColor: "#FFEDB8", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  permissionText: { color: "#8A641C", fontSize: 12, lineHeight: 18, marginTop: 3 },
  permissionTitle: { color: "#704F0D", fontSize: 14, fontWeight: "800" },
  pointSettingsCard: { backgroundColor: "#FFFFFF", borderColor: "#DCE5F5", borderRadius: 18, borderWidth: 1, marginTop: 14, padding: 16 },
  pointSettingsHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  pointSettingsSubtitle: { color: "#64748B", fontSize: 12, marginTop: 3 },
  pointSettingsTitle: { color: "#172554", fontSize: 15, fontWeight: "800" },
  primaryActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryButton: { alignItems: "center", backgroundColor: "#315EF4", borderRadius: 15, flex: 1, flexDirection: "row", height: 54, justifyContent: "center", shadowColor: "#315EF4", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.18, shadowRadius: 10 },
  primaryButtonPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", marginLeft: 8 },
  progressFill: { backgroundColor: "#69E5C5", borderRadius: 99, height: "100%" },
  progressRow: { alignItems: "baseline", flexDirection: "row", marginTop: 20 },
  progressTarget: { color: "#AFC3FF", fontSize: 14, marginLeft: 5 },
  progressTrack: { backgroundColor: "rgba(191, 208, 255, 0.18)", borderRadius: 99, height: 8, marginTop: 10, overflow: "hidden" },
  progressValue: { color: "#FFFFFF", fontSize: 42, fontWeight: "800", letterSpacing: -1.5 },
  root: { flex: 1 },
  screen: { backgroundColor: "#F8FAFC" },
  scrollContent: { paddingBottom: 140, paddingHorizontal: 20 },
  secondaryPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  sectionHeadingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionLabel: { color: "#475569", fontSize: 13, fontWeight: "800", letterSpacing: 0.6, marginBottom: 10, marginTop: 28, textTransform: "uppercase" },
  sectionMeta: { color: "#7C8BA5", fontSize: 12, marginTop: 18 },
  settingCard: { backgroundColor: "#FFFFFF", borderColor: "#E4EAF4", borderRadius: 18, borderWidth: 1, flex: 1, minWidth: 0, padding: 14 },
  settingHeader: { alignItems: "center", flexDirection: "row" },
  settingIcon: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 10, height: 32, justifyContent: "center", marginRight: 8, width: 32 },
  settingLabel: { color: "#475569", fontSize: 12, fontWeight: "700" },
  settingValue: { color: "#172554", fontSize: 23, fontWeight: "800", marginTop: 14 },
  settingsGrid: { flexDirection: "row", gap: 12 },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34 },
  sheetDivider: { backgroundColor: "#E2E8F0", height: 1, marginVertical: 18 },
  sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  sheetHint: { color: "#64748B", fontSize: 12, lineHeight: 18, marginTop: 10 },
  sheetTitle: { color: "#172554", fontSize: 21, fontWeight: "800" },
  shareButtonRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  smallAction: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 12, flex: 1, height: 48, justifyContent: "center" },
  smallActionText: { color: "#315EF4", fontSize: 11, fontWeight: "800", marginTop: 3 },
  statusBadge: { alignItems: "center", borderRadius: 99, flexDirection: "row", paddingHorizontal: 10, paddingVertical: 6 },
  stepperRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginLeft: 6 },
  statusDot: { borderRadius: 4, height: 7, width: 7 },
  stepButton: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 10, height: 31, justifyContent: "center", width: 31 },
  stepButtonText: { color: "#315EF4", fontSize: 18, fontWeight: "700", lineHeight: 20 },
  stepHint: { color: "#94A3B8", fontSize: 10, textAlign: "center" },
  stopButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE5F5", borderRadius: 15, flexDirection: "row", height: 54, justifyContent: "center", paddingHorizontal: 17 },
  stopButtonText: { color: "#315EF4", fontSize: 14, fontWeight: "800", marginLeft: 6 },
  subtitle: { color: "#64748B", fontSize: 14, lineHeight: 20, marginTop: 5 },
  textInput: { backgroundColor: "#F8FAFC", borderColor: "#DCE5F5", borderRadius: 13, borderWidth: 1, color: "#172554", fontSize: 15, height: 50, paddingHorizontal: 14 },
  title: { color: "#172554", fontSize: 34, fontWeight: "800", letterSpacing: -1, marginTop: 7 },
  titleCopy: { flex: 1 },
  titleRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  warningCard: { alignItems: "flex-start", backgroundColor: "#FFF8E7", borderColor: "#F5D99B", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 14, padding: 13 },
  warningCardRed: { backgroundColor: "#FFF1F0", borderColor: "#F4B4AF" },
  warningText: { color: "#8A641C", flex: 1, fontSize: 12, lineHeight: 18 },
  welcomeAuthor: { color: "#315EF4", fontSize: 14, fontWeight: "800", marginTop: 16 },
  welcomeIcon: { alignItems: "center", backgroundColor: "#EDF2FF", borderRadius: 24, height: 50, justifyContent: "center", width: 50 },
  welcomeModal: { backgroundColor: "#FFFFFF", borderRadius: 26, margin: 24, padding: 24 },
  welcomeText: { color: "#475569", fontSize: 15, lineHeight: 23, marginTop: 14 },
  welcomeTitle: { color: "#172554", fontSize: 23, fontWeight: "800", marginTop: 18 },
});
