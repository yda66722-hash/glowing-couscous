#!/usr/bin/env python3
"""One-click local Android APK builder for the floating-menu-assist Expo project.

Usage:
    python scripts/build-apk.py
    python scripts/build-apk.py --variant release
    python scripts/build-apk.py --skip-install --skip-prebuild
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ANDROID_DIR = ROOT / "android"
ARTIFACTS_DIR = ROOT / "artifacts"


def fail(message: str, hint: str | None = None) -> None:
    print(f"\n[ERROR] {message}", file=sys.stderr)
    if hint:
        print(f"[HINT]  {hint}", file=sys.stderr)
    raise SystemExit(1)


def command_path(name: str) -> str:
    path = shutil.which(name)
    if not path:
        fail(
            f"找不到命令: {name}",
            "请安装对应工具并将其加入 PATH。Windows 用户建议使用 Android Studio 自带的终端。",
        )
    return path


def run(command: list[str], *, cwd: Path = ROOT) -> None:
    printable = " ".join(f'"{part}"' if " " in part else part for part in command)
    print(f"\n[RUN] {printable}")
    try:
        completed = subprocess.run(command, cwd=cwd, check=False)
    except OSError as exc:
        fail(f"无法启动命令: {command[0]} ({exc})")
    if completed.returncode != 0:
        fail(
            f"命令执行失败，退出码 {completed.returncode}: {command[0]}",
            "请查看上方 Gradle/Expo 输出；如果是依赖或 SDK 问题，请先在 Android Studio 中完成 SDK 安装。",
        )


def check_environment() -> tuple[str, str]:
    print(f"[INFO] 项目目录: {ROOT}")
    if not (ROOT / "package.json").exists():
        fail("当前脚本不在 Expo 项目目录中。")

    node = command_path("node")
    pnpm = command_path("pnpm")
    command_path("java")

    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if not sdk:
        fail(
            "未设置 ANDROID_HOME 或 ANDROID_SDK_ROOT。",
            "请安装 Android SDK，并设置环境变量；Android Studio 可在 Settings > Android SDK 查看 SDK 路径。",
        )
    sdk_path = Path(sdk).expanduser()
    if not sdk_path.exists():
        fail(f"Android SDK 路径不存在: {sdk_path}")

    print(f"[OK] Node: {node}")
    print(f"[OK] pnpm: {pnpm}")
    print(f"[OK] Java: {shutil.which('java')}")
    print(f"[OK] Android SDK: {sdk_path}")
    return node, pnpm


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="一键构建本地 Android APK")
    parser.add_argument(
        "--variant",
        choices=("debug", "release"),
        default="debug",
        help="构建类型，默认 debug；release 需要已配置签名。",
    )
    parser.add_argument("--skip-install", action="store_true", help="跳过 pnpm install")
    parser.add_argument("--skip-prebuild", action="store_true", help="跳过 Expo Android 预构建")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    _, pnpm = check_environment()

    if not args.skip_install:
        run([pnpm, "install", "--frozen-lockfile"])

    if not args.skip_prebuild:
        run([pnpm, "exec", "expo", "prebuild", "--platform", "android", "--no-install"])

    if not ANDROID_DIR.exists():
        fail("找不到 android 目录。请先运行 Expo Android 预构建。")

    gradle = "gradlew.bat" if platform.system() == "Windows" else "./gradlew"
    gradle_path = ANDROID_DIR / gradle
    if not gradle_path.exists():
        fail(
            f"找不到 Gradle Wrapper: {gradle_path}",
            "请确认 android/gradlew 或 android/gradlew.bat 已存在，并重新执行预构建。",
        )

    task = "assembleDebug" if args.variant == "debug" else "assembleRelease"
    run([str(gradle_path), task, "--no-daemon"], cwd=ANDROID_DIR)

    apk_name = "app-debug.apk" if args.variant == "debug" else "app-release.apk"
    source = ANDROID_DIR / "app" / "build" / "outputs" / "apk" / args.variant / apk_name
    if not source.exists():
        fail(
            f"Gradle 完成但没有找到 APK: {source}",
            "请检查 Gradle 输出中最后的构建任务和签名配置。",
        )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    destination = ARTIFACTS_DIR / f"floating-menu-assist-{args.variant}.apk"
    shutil.copy2(source, destination)

    print("\n[SUCCESS] APK 构建完成")
    print(f"[OUTPUT] {destination.resolve()}")
    print(f"[SIZE]   {destination.stat().st_size / 1024 / 1024:.2f} MB")
    print("[NEXT]   将该 APK 传到 Android 手机安装；首次使用需开启无障碍服务和悬浮窗权限。")


if __name__ == "__main__":
    main()
