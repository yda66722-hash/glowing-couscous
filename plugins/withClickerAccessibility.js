const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("expo/config-plugins");

const packageName = "com.app.floatingmenuassist";
const serviceClass = `${packageName}.ClickerAccessibilityService`;
const moduleClass = `${packageName}.ClickerNativeModule`;
const packageClass = `${packageName}.ClickerPackage`;

function withClickerAccessibility(config) {
  config = withAndroidManifest(config, (manifestConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifestConfig.modResults);
    application.service = application.service || [];
    const alreadyRegistered = application.service.some(
      (service) => service.$?.["android:name"] === serviceClass,
    );

    if (!alreadyRegistered) {
      application.service.push({
        $: {
          "android:name": serviceClass,
          "android:exported": "true",
          "android:label": "连点器",
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
          "android:foregroundServiceType": "specialUse",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.accessibilityservice.AccessibilityService" } },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": "@xml/clicker_accessibility_service_config",
            },
          },
        ],
        property: [
          {
            $: {
              "android:name": "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
              "android:value": "悬浮连点器控制服务",
            },
          },
        ],
      });
    } else {
      const existing = application.service.find(
        (service) => service.$?.["android:name"] === serviceClass,
      );
      existing.$ = existing.$ || {};
      existing.$["android:foregroundServiceType"] = "specialUse";
      existing.property = existing.property || [];
      if (!existing.property.some((item) => item.$?.["android:name"] === "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE")) {
        existing.property.push({
          $: {
            "android:name": "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
            "android:value": "悬浮连点器控制服务",
          },
        });
      }
    }

    return manifestConfig;
  });

  config = withDangerousMod(config, ["android", async (dangerousConfig) => {
    const androidRoot = dangerousConfig.modRequest.platformProjectRoot;
    const javaDir = path.join(
      androidRoot,
      "app",
      "src",
      "main",
      "java",
      "com",
      "app",
      "floatingmenuassist",
    );
    const xmlDir = path.join(androidRoot, "app", "src", "main", "res", "xml");
    const mainApplicationPath = path.join(
      androidRoot,
      "app",
      "src",
      "main",
      "java",
      "com",
      "app",
      "floatingmenuassist",
      "MainApplication.kt",
    );
    fs.mkdirSync(javaDir, { recursive: true });
    fs.mkdirSync(xmlDir, { recursive: true });

    fs.writeFileSync(
      path.join(javaDir, "ClickerAccessibilityService.kt"),
      `package ${packageName}\n\nimport android.accessibilityservice.AccessibilityService\nimport android.accessibilityservice.GestureDescription\nimport android.app.Notification\nimport android.app.NotificationChannel\nimport android.app.NotificationManager\nimport android.content.Context\nimport android.graphics.Color\nimport android.graphics.Path\nimport android.graphics.PixelFormat\nimport android.graphics.drawable.GradientDrawable\nimport android.os.Build\nimport android.os.Handler\nimport android.os.Looper\nimport android.view.Gravity\nimport android.view.MotionEvent\nimport android.view.View\nimport android.view.WindowManager\nimport android.widget.TextView\nimport android.view.accessibility.AccessibilityEvent\nimport androidx.core.app.NotificationCompat\nimport org.json.JSONArray\nimport org.json.JSONObject\n\nclass ClickerAccessibilityService : AccessibilityService() {\n  private val handler = Handler(Looper.getMainLooper())\n  private var overlayView: TextView? = null\n  private var windowManager: WindowManager? = null\n  private var overlayParams: WindowManager.LayoutParams? = null\n  private var isClicking = false\n  private var pointIndex = 0\n  private var repeatIndex = 0\n  private var cycleIndex = 0\n\n  private val clickRunnable = object : Runnable {\n    override fun run() {\n      if (!isClicking) return\n      val profile = readProfile()\n      val points = profile.first\n      if (points.isEmpty()) {\n        stopClicking()\n        return\n      }\n      if (pointIndex >= points.length()) {\n        pointIndex = 0\n        repeatIndex = 0\n        cycleIndex += 1\n        if (cycleIndex >= profile.third) {\n          stopClicking()\n          return\n        }\n      }\n      val point = points.getJSONObject(pointIndex)\n      val metrics = resources.displayMetrics\n      val x = metrics.widthPixels * point.optDouble("x", 0.5).toFloat()\n      val y = metrics.heightPixels * point.optDouble("y", 0.5).toFloat()\n      dispatchTap(x, y)\n      repeatIndex += 1\n      val repeatCount = point.optInt("repeatCount", 1).coerceIn(1, 9999)\n      if (repeatIndex >= repeatCount) {\n        repeatIndex = 0\n        pointIndex += 1\n      }\n      updateOverlayLabel()\n      handler.postDelayed(this, profile.second.coerceIn(50L, 10000L))\n    }\n  }\n\n  override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit\n\n  override fun onInterrupt() {\n    stopClicking()\n  }\n\n  override fun onServiceConnected() {\n    super.onServiceConnected()\n    serviceInstance = this\n    startForegroundNotification()\n    showOverlay()\n  }\n\n  override fun onDestroy() {\n    stopClicking()\n    removeOverlay()\n    serviceInstance = null\n    super.onDestroy()\n  }\n\n  private fun startForegroundNotification() {\n    val channelId = "clicker-running"\n    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager\n    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n      manager.createNotificationChannel(\n        NotificationChannel(channelId, "连点器运行状态", NotificationManager.IMPORTANCE_LOW),\n      )\n    }\n    val notification: Notification = NotificationCompat.Builder(this, channelId)\n      .setSmallIcon(android.R.drawable.ic_menu_mylocation)\n      .setContentTitle("连点器已就绪")\n      .setContentText("悬浮控制球已显示，点击悬浮球开始或暂停")\n      .setOngoing(true)\n      .setCategory(NotificationCompat.CATEGORY_SERVICE)\n      .build()\n\n    if (Build.VERSION.SDK_INT >= 34) {\n      startForeground(1001, notification, 0x4000)\n    } else {\n      startForeground(1001, notification)\n    }\n  }\n\n  private fun showOverlay() {\n    if (overlayView != null) return\n    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager\n    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY\n    } else {\n      WindowManager.LayoutParams.TYPE_PHONE\n    }\n    overlayParams = WindowManager.LayoutParams(\n      60,\n      60,\n      type,\n      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,\n      PixelFormat.TRANSLUCENT,\n    ).apply {\n      gravity = Gravity.TOP or Gravity.START\n      x = resources.displayMetrics.widthPixels - 88\n      y = resources.displayMetrics.heightPixels / 2\n    }\n\n    overlayView = TextView(this).apply {\n      text = "▶"\n      textSize = 22f\n      gravity = Gravity.CENTER\n      setTextColor(Color.WHITE)\n      background = GradientDrawable().apply {\n        shape = GradientDrawable.OVAL\n        setColor(Color.rgb(49, 94, 244))\n        setStroke(3, Color.WHITE)\n      }\n      contentDescription = "连点器悬浮控制球，点击开始或暂停"\n      setOnTouchListener(OverlayTouchListener())\n    }\n    windowManager?.addView(overlayView, overlayParams)\n  }\n\n  private fun removeOverlay() {\n    overlayView?.let { view -> runCatching { windowManager?.removeView(view) } }\n    overlayView = null\n    windowManager = null\n  }\n\n  private fun updateOverlayLabel() {\n    handler.post { overlayView?.text = if (isClicking) "Ⅱ" else "▶" }\n  }\n\n  fun startClicking() {\n    isClicking = true\n    pointIndex = 0\n    repeatIndex = 0\n    cycleIndex = 0\n    handler.removeCallbacks(clickRunnable)\n    handler.post(clickRunnable)\n    updateOverlayLabel()\n  }\n\n  fun stopClicking() {\n    isClicking = false\n    handler.removeCallbacks(clickRunnable)\n    updateOverlayLabel()\n  }\n\n  private fun toggleClicking() {\n    if (isClicking) stopClicking() else startClicking()\n  }\n\n  private fun dispatchTap(x: Float, y: Float) {\n    val path = Path().apply { moveTo(x, y) }\n    val gesture = GestureDescription.Builder()\n      .addStroke(GestureDescription.StrokeDescription(path, 0, 50))\n      .build()\n    dispatchGesture(gesture, null, null)\n  }\n\n  private fun readProfile(): Triple<JSONArray, Long, Int> {\n    val raw = getSharedPreferences("clicker-native", Context.MODE_PRIVATE).getString("profile", null)\n    return runCatching {\n      val objectValue = JSONObject(raw ?: "{}")\n      Triple(\n        objectValue.optJSONArray("points") ?: JSONArray(),\n        objectValue.optLong("intervalMs", 500L),\n        objectValue.optInt("cycleCount", 30).coerceIn(1, 9999),\n      )\n    }.getOrElse { Triple(JSONArray(), 500L, 30) }\n  }\n\n  private inner class OverlayTouchListener : View.OnTouchListener {\n    private var downX = 0f\n    private var downY = 0f\n    private var startX = 0\n    private var startY = 0\n\n    override fun onTouch(view: View, event: MotionEvent): Boolean {\n      val params = overlayParams ?: return false\n      when (event.actionMasked) {\n        MotionEvent.ACTION_DOWN -> {\n          downX = event.rawX\n          downY = event.rawY\n          startX = params.x\n          startY = params.y\n          return true\n        }\n        MotionEvent.ACTION_MOVE -> {\n          params.x = startX + (event.rawX - downX).toInt()\n          params.y = startY + (event.rawY - downY).toInt()\n          windowManager?.updateViewLayout(view, params)\n          return true\n        }\n        MotionEvent.ACTION_UP -> {\n          if (kotlin.math.abs(event.rawX - downX) < 12 && kotlin.math.abs(event.rawY - downY) < 12) toggleClicking()\n          return true\n        }\n      }\n      return true\n    }\n  }\n\n  companion object {\n    @Volatile var serviceInstance: ClickerAccessibilityService? = null\n  }\n}\n`,
    );

    fs.writeFileSync(
      path.join(javaDir, "ClickerNativeModule.kt"),
      `package ${packageName}\n\nimport android.content.Intent\nimport android.provider.Settings\nimport com.facebook.react.bridge.Promise\nimport com.facebook.react.bridge.ReactApplicationContext\nimport com.facebook.react.bridge.ReactContextBaseJavaModule\nimport com.facebook.react.bridge.ReactMethod\n\nclass ClickerNativeModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {\n  override fun getName() = "ClickerNative"\n\n  @ReactMethod\n  fun syncProfile(profileJson: String, promise: Promise) {\n    context.getSharedPreferences("clicker-native", 0).edit().putString("profile", profileJson).apply()\n    promise.resolve(null)\n  }\n\n  @ReactMethod\n  fun startClicking(promise: Promise) {\n    val service = ClickerAccessibilityService.serviceInstance\n    if (service == null) {\n      promise.reject("SERVICE_NOT_ENABLED", "请先在 Android 无障碍设置中启用连点器")\n      return\n    }\n    service.startClicking()\n    promise.resolve(null)\n  }\n\n  @ReactMethod\n  fun stopClicking(promise: Promise) {\n    ClickerAccessibilityService.serviceInstance?.stopClicking()\n    promise.resolve(null)\n  }\n\n  @ReactMethod\n  fun openAccessibilitySettings(promise: Promise) {\n    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }\n    context.startActivity(intent)\n    promise.resolve(null)\n  }\n}\n`,
    );

    fs.writeFileSync(
      path.join(javaDir, "ClickerPackage.kt"),
      `package ${packageName}\n\nimport com.facebook.react.ReactPackage\nimport com.facebook.react.bridge.NativeModule\nimport com.facebook.react.bridge.ReactApplicationContext\nimport com.facebook.react.uimanager.ViewManager\n\nclass ClickerPackage : ReactPackage {\n  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(ClickerNativeModule(reactContext))\n  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()\n}\n`,
    );

    if (fs.existsSync(mainApplicationPath)) {
      const mainApplication = fs.readFileSync(mainApplicationPath, "utf8");
      const packageImport = `import ${packageClass}`;
      let patched = mainApplication;
      if (!patched.includes(packageImport)) {
        patched = `${packageImport}\n${patched}`;
      }
      if (!patched.includes("add(ClickerPackage())")) {
        patched = patched.replace(
          "PackageList(this).packages",
          "PackageList(this).packages.apply { add(ClickerPackage()) }",
        );
      }
      fs.writeFileSync(mainApplicationPath, patched);
    }

    fs.writeFileSync(
      path.join(xmlDir, "clicker_accessibility_service_config.xml"),
      `<?xml version="1.0" encoding="utf-8"?>\n<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"\n    android:accessibilityEventTypes="typeWindowsChanged|typeWindowStateChanged"\n    android:accessibilityFeedbackType="feedbackGeneric"\n    android:canPerformGestures="true"\n    android:notificationTimeout="100" />\n`,
    );

    return dangerousConfig;
  }]);

  return config;
}

module.exports = withClickerAccessibility;
