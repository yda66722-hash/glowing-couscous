# 连点器

这是一个 Android 优先的多点连点器应用，基于 Expo SDK 54、React Native、TypeScript 和 Android AccessibilityService 构建。

## 已实现功能

应用支持创建、编号、拖动和删除多个圆形点击点；每个点击点可配置重复次数，方案支持设置点击间隔与运行轮数，并在高频参数下给出可能卡顿的性能提醒。方案可以保存在本地，也可以生成包含随机数字与英文字符的分享代码，复制到官方论坛后由其他用户手动导入复用。

Android 原生部分包含无障碍服务声明、悬浮控制球、前台服务通知和 JavaScript 方案桥接。启用无障碍服务后，原生服务可以在离开主界面后继续显示控制球，并按保存的多点方案执行点击手势。

首次进入应用会显示创作者说明：

> 你好，如果应用有一些错误的话请包容，创作者只是一个人的团队，并且应用与广告也无充值，只为提供给用户最好的体验
> by 纸飞机yut

## 验证

```bash
pnpm check
pnpm test
pnpm lint
EXPO_NO_GIT_STATUS=1 pnpm exec expo prebuild --platform android --no-install
```

当前沙箱没有 Android SDK，因此 APK/AAB 需要通过项目管理界面的 Android 发布构建生成。安装到 Android 真机后，在系统“无障碍”设置中启用“连点器”，再验证悬浮球、前台通知和应用外点击流程。Expo Go 和 iOS 不支持同等的系统级悬浮窗自动点击能力。

## 目录

- `App.tsx`：连点器主界面与状态控制
- `components/click-point-editor.tsx`：多点击点编辑器
- `lib/clicker-model.ts`：点位、方案、性能提示与分享码模型
- `plugins/withClickerAccessibility.js`：Android 原生服务与桥接生成插件
- `tests/`：纯逻辑与交互辅助测试