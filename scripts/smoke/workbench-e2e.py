#!/usr/bin/env python3
import json
import os
import sys
import time
from pathlib import Path


try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright
except ImportError as exc:
    print(
        json.dumps(
            {
                "ok": False,
                "error": "Python Playwright is not installed. Install it locally or run with an environment that provides playwright.",
                "detail": str(exc),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    sys.exit(1)


FRONTEND_URL = os.environ.get("BBS_E2E_FRONTEND_URL", "http://127.0.0.1:5173/workbench")
TIMEOUT_MS = int(os.environ.get("BBS_E2E_TIMEOUT_MS", "240000"))
OUTPUT_DIR = Path(os.environ.get("BBS_E2E_OUTPUT_DIR", ".tmp/e2e"))

TITLE_SELECTOR = 'input[placeholder="输入文档标题，或留空让 AI 自动提取"]'
RAW_SELECTOR = 'textarea[placeholder="直接粘贴原稿内容，或从上方导入文件..."]'


def now_seconds():
    return round(time.time(), 3)


def elapsed_since(start):
    return round(time.time() - start, 2)


def make_page(context):
    page = context.new_page()
    events = []

    def on_response(response):
        if "/api/workbench/" not in response.url:
            return
        events.append(
            {
                "url": response.url,
                "method": response.request.method,
                "status": response.status,
                "t": now_seconds(),
            }
        )

    page.on("response", on_response)
    return page, events


def fill_workbench(page, title, raw_text):
    page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30000)
    page.fill(TITLE_SELECTOR, title)
    page.fill(RAW_SELECTOR, raw_text)


def run_structure_test(context):
    page, events = make_page(context)
    raw_text = (
        "端到端冒烟测试\n\n"
        "摘要：这是一个短文档，用于确认前端按钮、后端任务、Claude结构化和页面结果展示能连通。\n\n"
        "1 引言\n"
        "本测试内容很短。"
    )
    start = time.time()
    fill_workbench(page, "E2E Short Smoke", raw_text)

    with page.expect_response(
        lambda response: response.request.method == "POST"
        and response.url.endswith("/api/workbench/generate/jobs"),
        timeout=30000,
    ) as create_response_info:
        page.locator("button", has_text="一键整理").click()

    create_response = create_response_info.value
    create_payload = create_response.json()
    job_id = create_payload.get("id")

    done = False
    try:
        page.locator(".progress-message", has_text="结构化文档生成完成").wait_for(
            timeout=TIMEOUT_MS
        )
        done = True
    except PlaywrightTimeoutError:
        done = False

    body = page.locator("body").inner_text(timeout=5000)
    screenshot = OUTPUT_DIR / "workbench-structure.png"
    page.screenshot(path=str(screenshot), full_page=True)

    result = {
        "name": "structure",
        "ok": done and "结构化结果" in body and "本测试内容很短" in body,
        "elapsed_seconds": elapsed_since(start),
        "job_id": job_id,
        "initial_job": create_payload,
        "events": events,
        "screenshot": str(screenshot),
        "body_excerpt": body[:1200],
    }
    page.close()
    return result


def run_direct_docx_test(context):
    page, events = make_page(context)
    raw_text = (
        "直接Word端到端测试\n\n"
        "摘要：确认前端直接 Word 按钮可以调用后端并下载 docx。\n\n"
        "1 结果\n"
        "下载应该成功。"
    )
    start = time.time()
    fill_workbench(page, "Direct Word E2E", raw_text)

    with page.expect_download(timeout=TIMEOUT_MS) as download_info:
        page.locator("button", has_text="直接 Word").click()

    download = download_info.value
    target = OUTPUT_DIR / download.suggested_filename
    download.save_as(str(target))
    size = target.stat().st_size if target.exists() else 0
    screenshot = OUTPUT_DIR / "workbench-direct-docx.png"
    page.screenshot(path=str(screenshot), full_page=True)

    result = {
        "name": "direct-docx",
        "ok": target.exists() and size > 0 and target.suffix.lower() == ".docx",
        "elapsed_seconds": elapsed_since(start),
        "suggested_filename": download.suggested_filename,
        "saved_path": str(target),
        "size_bytes": size,
        "events": events,
        "screenshot": str(screenshot),
    }
    page.close()
    return result


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    started = time.time()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        tests = [run_structure_test(context), run_direct_docx_test(context)]
        context.close()
        browser.close()

    report = {
        "ok": all(test["ok"] for test in tests),
        "elapsed_seconds": elapsed_since(started),
        "frontend_url": FRONTEND_URL,
        "tests": tests,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["ok"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
