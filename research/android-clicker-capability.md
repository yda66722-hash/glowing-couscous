# 连点器平台能力调研

## 结论

“退出应用后仍显示悬浮小球”不是普通 React Native 页面能力，而是 Android 系统级能力。实现完整连点器通常需要两部分：一是 `SYSTEM_ALERT_WINDOW`/`TYPE_APPLICATION_OVERLAY` 悬浮窗权限，用于在其他应用上方显示控制球；二是 Android `AccessibilityService`，通过 `dispatchGesture` 发送点击手势。两者都需要用户在系统设置中明确授权。

Android 官方文档将无障碍服务定位为“代表用户检查界面并与应用交互”的后台服务，并明确只有通用辅助工具才应创建此类服务。[1] 官方配置示例要求在服务声明中使用 `BIND_ACCESSIBILITY_SERVICE`，且若要派发点击、滑动等手势，服务配置必须声明 `android:canPerformGestures="true"`。[1]

Android 官方权限参考将 `SYSTEM_ALERT_WINDOW` 定义为允许应用创建 `TYPE_APPLICATION_OVERLAY` 窗口的权限。[2] 因此，仅使用当前 Expo Go 或普通应用内组件无法让浮点在用户离开应用后继续覆盖其他应用。

Android 14 及以上对前台服务要求显式声明服务类型与对应权限；如果启动服务时没有合适类型，系统可能抛出 `MissingForegroundServiceTypeException` 或 `SecurityException`。[3] 连点器需要长期运行时，必须结合目标 Android 版本、前台服务通知和应用商店政策设计，不能只用 JavaScript 定时器假设后台常驻。

## 当前工程影响

当前项目是 Expo SDK 54 的移动应用模板，现有实现适合应用内悬浮球演示，但尚未包含 Android 原生悬浮窗服务、无障碍服务声明、原生 Kotlin/Java 服务类或自定义 Expo Module。因此可以先完成连点器配置页、应用内启动/暂停/停止状态机和悬浮球控制界面；要做到真正退出应用后仍显示并自动点击，需要改为 Android 原生构建路径并增加经过用户授权的原生模块。

## References

[1]: https://developer.android.com/guide/topics/ui/accessibility/service "Android Developers: Create an accessibility service"
[2]: https://developer.android.com/reference/android/Manifest.permission "Android Developers: Manifest.permission"
[3]: https://developer.android.com/about/versions/14/changes/fgs-types-required "Android Developers: Foreground service types are required"

## Expo 接入结论

Expo 官方说明，独立构建和开发构建中的 Android 权限需要在构建时配置；可以使用 `android.permissions` 或配置插件修改原生清单。[4] Expo Config Plugins 支持在动态 `app.config.ts` 中为 AndroidManifest 注册自定义权限、服务和元数据。[5] Expo Modules API 允许通过 Kotlin/Swift 编写原生能力，但自定义原生模块需要开发构建或独立构建，Expo Go 不能加载项目自定义的原生模块。[6]

因此，本项目的应用内连点器可以继续在 Expo Web/Expo Go 中验证；真正的“退出应用后悬浮球 + 自动点击”需要通过 Android 原生模块和配置插件接入，并由用户在 Android 真机上授权后验证。

[4]: https://docs.expo.dev/guides/permissions/ "Expo: Permissions"
[5]: https://docs.expo.dev/config-plugins/plugins/ "Expo: Create and use config plugins"
[6]: https://docs.expo.dev/modules/overview/ "Expo Modules API: Overview"

## 多点悬浮连点器补充调研（2026-08-30）

Android 官方文档明确指出，AccessibilityService 必须继承 `AccessibilityService`，并在 Manifest 中声明 `BIND_ACCESSIBILITY_SERVICE`、对应 intent-filter 和服务配置 XML；若需要自动触控，XML 必须声明 `android:canPerformGestures="true"`。[1]

系统级连点需要用户主动在系统设置中启用无障碍服务，应用不能静默开启。前台服务应在应用可见或用户明确操作时启动；Android 12 及以上限制后台启动前台服务，Android 15 对悬浮窗场景还要求应用持有悬浮窗权限且当前已有可见覆盖层。[2]

AccessibilityService 的 `dispatchGesture()` 可以派发点击/滑动手势，因此本项目的多点点击点位可以由服务按保存的坐标序列执行；不过官方同时提醒，无障碍服务应定位为通用辅助工具，发布时需避免误导性用途。[3]

### References

[1]: https://developer.android.com/guide/topics/ui/accessibility/service "Create an accessibility service"
[2]: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start "Restrictions on starting a foreground service from the background"
[3]: https://developer.android.com/reference/android/accessibilityservice/AccessibilityService "AccessibilityService API reference"
