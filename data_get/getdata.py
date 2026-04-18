import argparse
import json
import logging
import random
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib.parse import urljoin, urlparse

import requests

from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    from DrissionPage import ChromiumOptions, ChromiumPage
except ImportError:
    ChromiumOptions = None
    ChromiumPage = None

BASE_URL = "https://www.nmpa.gov.cn"
DEFAULT_LIST_URL = f"{BASE_URL}/hzhp/hzhpcjgg/index.html"
LIST_PAGE_TEMPLATE = f"{BASE_URL}/hzhp/hzhpcjgg/index_{{page_index}}.html"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "output"
DEFAULT_DOWNLOAD_DIR = Path(__file__).resolve().parent / "downloads"
NODE_WRAPPER = Path(__file__).resolve().parent / "parse_announcement_attachment.js"
BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
SUPPORTED_ATTACHMENT_EXTENSIONS = {".doc", ".docx", ".xls", ".xlsx", ".pdf"}
ATTACHMENT_PARSE_EXTENSIONS = {".doc", ".docx", ".xls", ".xlsx"}
ANTI_BOT_KEYWORDS = (
    "Precondition Failed",
    "document.cookie",
    "meta id=",
    "__jsl",
    "安全验证",
    "访问过于频繁",
    "访问验证",
)
REQUEST_TIMEOUT = 45
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
LOGGER_NAME = "nmpa_drission_crawler"
PRODUCT_TYPE_LABELS = {
    "cosmetics": "化妆品",
    "food": "食品",
    "medical_device": "医疗器械",
    "unknown": "未知",
}

PRODUCT_TYPE_ALIASES = {
    "1": "cosmetics",
    "cosmetics": "cosmetics",
    "化妆品": "cosmetics",
    "2": "food",
    "food": "food",
    "食品": "food",
    "3": "medical_device",
    "medical_device": "medical_device",
    "medical-device": "medical_device",
    "medicaldevice": "medical_device",
    "医疗器械": "medical_device",
    "4": "unknown",
    "unknown": "unknown",
    "未知": "unknown",
    "未分类": "unknown",
    "未回复": "unknown",
    "空值": "unknown",
}



PRODUCT_TYPE_PROMPT_TEXT = (
    "请选择本次抓取的产品类型（直接回车则记录为未知）\n"
    "1. 化妆品（cosmetics）\n"
    "2. 食品（food）\n"
    "3. 医疗器械（medical_device）\n"
    "4. 未知（unknown）\n"
    "请输入编号或类型值: "
)


def normalize_product_type(value: Optional[str], default: str = "unknown") -> str:
    raw_value = str(value or "").strip()
    if not raw_value:
        return default

    normalized = raw_value.lower()
    return PRODUCT_TYPE_ALIASES.get(normalized, PRODUCT_TYPE_ALIASES.get(raw_value, default))


def get_product_type_label(value: Optional[str]) -> str:
    return PRODUCT_TYPE_LABELS.get(normalize_product_type(value), PRODUCT_TYPE_LABELS["unknown"])



def infer_product_type_from_record(*values: Optional[str]) -> str:
    text = " ".join(clean_text(value) for value in values if value).lower()
    if not text:
        return "cosmetics"
    if any(token in text for token in ("医疗器械", "器械", "/ylqx/", "ylqx", "medical_device")):
        return "medical_device"
    if any(token in text for token in ("食品", "保健食品", "食用", "/sp/", "/food/", "shipin", "food")):
        return "food"
    return "cosmetics"


@dataclass
class AnnouncementItem:
    title: str
    detail_url: str
    publish_date: Optional[str] = None
    source_page: Optional[str] = None
    product_type: Optional[str] = None



@dataclass
class AntiBotConfig:
    headless: bool
    user_agent: str
    page_timeout: float
    retry_times: int
    retry_interval: float
    min_delay: float
    max_delay: float
    warmup_url: str = BASE_URL
    min_valid_text_length: int = 200


class NmpaAnnouncementCrawler:
    def __init__(
        self,
        max_pages: int,
        max_items: Optional[int],
        output_dir: Path,
        download_dir: Path,
        input_urls_file: Optional[Path],
        antibot: AntiBotConfig,
        logger: logging.Logger,
        selected_product_type: str,
        browser_path: str = "",
        browser_user_data_dir: str = "",
    ) -> None:
        self.max_pages = max_pages
        self.max_items = max_items
        self.output_dir = output_dir
        self.download_dir = download_dir
        self.input_urls_file = input_urls_file
        self.antibot = antibot
        self.logger = logger
        self.selected_product_type = normalize_product_type(selected_product_type)
        self.browser_path = browser_path.strip()
        self.browser_user_data_dir = browser_user_data_dir.strip()


        self.items_dir = self.output_dir / "items"
        self.attachments_dir = self.download_dir / "announcements"
        self.logs_dir = self.output_dir / "logs"
        self.snapshots_dir = self.logs_dir / "snapshots"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.items_dir.mkdir(parents=True, exist_ok=True)
        self.attachments_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)

        self.session = self._build_session()
        self._page = None
        self._browser_ready = False
        self._anti_bot_hits = 0
        self._has_warmup = False


    def _build_session(self) -> requests.Session:
        session = requests.Session()
        retry = Retry(
            total=3,
            read=3,
            connect=3,
            backoff_factor=1,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET", "HEAD"}),
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        session.headers.update(
            {
                "User-Agent": self.antibot.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Referer": f"{BASE_URL}/",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
        )
        return session

    def close(self) -> None:
        if self._page is not None:
            try:
                self._page.quit(timeout=10, force=True, del_data=False)
            except Exception as exc:
                self.logger.debug("关闭 DrissionPage 失败: %s", exc)
            finally:
                self._page = None
        self.session.close()

    def crawl(self) -> object:

        started_at = datetime.now().isoformat(timespec="seconds")
        candidates = self._load_candidates()
        results = []
        self.logger.info("待处理公告数: %s", len(candidates))

        for index, item in enumerate(candidates, start=1):
            self.logger.info("[%s/%s] 处理公告: %s", index, len(candidates), item.title)
            try:
                result = self._process_announcement(item, index)
                results.append(result)
            except Exception as exc:
                self.logger.exception("处理公告失败: %s", item.detail_url)
                results.append(
                    {
                        "sequence": index,
                        "title": item.title,
                        "detail_url": item.detail_url,
                        "publish_date": item.publish_date,
                        "source_page": item.source_page,
                        "product_type": normalize_product_type(item.product_type),
                        "success": False,
                        "error": str(exc),
                    }
                )

            self._sleep_random(f"公告处理间隔 #{index}")

        manifest = {
            "meta": {
                "generated_at": datetime.now().isoformat(timespec="seconds"),
                "started_at": started_at,
                "source": "国家药监局化妆品抽检通告",
                "list_url": DEFAULT_LIST_URL,
                "crawler_engine": "DrissionPage",
                "max_pages": self.max_pages,
                "max_items": self.max_items,
                "total_candidates": len(candidates),
                "success_count": sum(1 for item in results if item.get("success")),
                "failed_count": sum(1 for item in results if not item.get("success")),
                "items_dir": str(self.items_dir),
                "downloads_dir": str(self.attachments_dir),
                "anti_bot_hits": self._anti_bot_hits,
                "headless": self.antibot.headless,
                "retry_times": self.antibot.retry_times,
                "retry_interval": self.antibot.retry_interval,
                "delay_range": [self.antibot.min_delay, self.antibot.max_delay],
            },
            "items": [
                {
                    "sequence": item.get("sequence"),
                    "title": item.get("title"),
                    "publish_date": item.get("publish_date"),
                    "detail_url": item.get("detail_url"),
                    "product_type": normalize_product_type(item.get("product_type")),
                    "success": item.get("success"),

                    "attachment_count": len(item.get("attachments", [])),
                    "parsed_attachment_count": sum(
                        1
                        for att in item.get("attachments", [])
                        if (att.get("parse_result") or {}).get("parsedCount", 0) > 0
                    ),
                    "output_file": item.get("output_file"),
                    "error": item.get("error"),
                }
                for item in results
            ],
        }

        manifest_path = self.output_dir / "announcements_manifest.json"
        with manifest_path.open("w", encoding="utf-8") as fp:
            json.dump(manifest, fp, ensure_ascii=False, indent=2)

        self.logger.info("清单已写入: %s", manifest_path)
        return manifest

    def _load_candidates(self) -> List[AnnouncementItem]:
        if self.input_urls_file:
            self.logger.info("从本地 URL 清单读取公告: %s", self.input_urls_file)
            return self._load_candidates_from_file(self.input_urls_file)
        self.logger.info("使用 DrissionPage 抓取列表页")
        return self._crawl_candidates_from_site()

    def _load_candidates_from_file(self, path: Path) -> List[AnnouncementItem]:
        raw_text = path.read_text(encoding="utf-8")
        if path.suffix.lower() == ".json":
            payload = json.loads(raw_text)
            records = payload if isinstance(payload, list) else payload.get("items", [])
        else:
            records = [line.strip() for line in raw_text.splitlines() if line.strip()]

        items = []
        for record in records:
            if isinstance(record, str):
                items.append(AnnouncementItem(title=record, detail_url=record))
                continue
            detail_url = normalize_url(DEFAULT_LIST_URL, record.get("detail_url") or record.get("url") or "")
            if not detail_url:
                continue
            items.append(
                AnnouncementItem(
                    title=clean_text(record.get("title")) or detail_url,
                    detail_url=detail_url,
                    publish_date=normalize_date(record.get("publish_date")),
                    source_page=record.get("source_page"),
                    product_type=self.selected_product_type,
                )
            )


        return self._limit_items(items)

    def _crawl_candidates_from_site(self) -> List[AnnouncementItem]:
        items: List[AnnouncementItem] = []
        seen_urls = set()
        for page_number in range(1, self.max_pages + 1):
            page_url = DEFAULT_LIST_URL if page_number == 1 else LIST_PAGE_TEMPLATE.format(page_index=page_number - 1)
            self.logger.info("抓取列表页: %s", page_url)
            self._fetch_html(page_url, page_kind="list")
            list_items = self._extract_list_items(self._ensure_browser(), page_url)
            self.logger.info("列表页提取到 %s 条候选公告", len(list_items))
            for item in list_items:
                if item.detail_url in seen_urls:
                    continue
                seen_urls.add(item.detail_url)
                items.append(item)
                if self.max_items and len(items) >= self.max_items:
                    self.logger.info("达到 max_items=%s，停止继续抓取列表页", self.max_items)
                    return items
            self._sleep_random(f"列表页抓取间隔 #{page_number}")
        return items


    def _ensure_browser(self):
        if self._page is not None:
            return self._page
        if ChromiumOptions is None or ChromiumPage is None:
            raise RuntimeError("未安装 DrissionPage，无法执行浏览器抓取")

        options = ChromiumOptions()
        options.auto_port()
        options.headless(self.antibot.headless)
        options.set_load_mode("normal")
        options.set_timeouts(base=10, page_load=self.antibot.page_timeout, script=20)
        options.set_user_agent(self.antibot.user_agent)
        options.set_download_path(str(self.attachments_dir))
        options.set_argument("--window-size=1440,900")
        options.set_argument("--lang=zh-CN")
        options.set_argument("--disable-blink-features=AutomationControlled")
        options.set_argument("--disable-features=Translate,AutomationControlled")
        options.set_argument("--disable-infobars")
        options.set_argument("--no-default-browser-check")
        options.set_argument("--disable-popup-blocking")
        options.set_argument("--disable-dev-shm-usage")
        options.set_argument("--ignore-certificate-errors")
        if self.browser_path:
            options.set_browser_path(self.browser_path)
        if self.browser_user_data_dir:
            user_data_dir = Path(self.browser_user_data_dir).resolve()
            user_data_dir.mkdir(parents=True, exist_ok=True)
            options.set_user_data_path(str(user_data_dir))

        self.logger.info(
            "启动 DrissionPage 浏览器: headless=%s, browser_path=%s, user_data_dir=%s",
            self.antibot.headless,
            self.browser_path or "<auto>",
            self.browser_user_data_dir or "<auto>",
        )
        self._page = ChromiumPage(options)
        self._configure_browser_headers()
        self._prime_browser_context()
        return self._page


    def _configure_browser_headers(self) -> None:
        if self._page is None:
            return
        try:
            self._page.run_cdp("Network.enable")
            self._page.run_cdp(
                "Network.setExtraHTTPHeaders",
                headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    "Referer": f"{BASE_URL}/",
                    "Upgrade-Insecure-Requests": "1",
                },
            )
            self.logger.debug("已为浏览器请求注入额外请求头")
        except Exception as exc:
            self.logger.warning("配置浏览器额外请求头失败，将继续抓取: %s", exc)

    def _apply_stealth_patches(self) -> None:

        if self._page is None or self._browser_ready:
            return

        stealth_script = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'platform', {get: () => 'Win32'});
Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN', 'zh', 'en-US', 'en']});
Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
window.chrome = window.chrome || { runtime: {} };
const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
if (originalQuery) {
  window.navigator.permissions.query = (parameters) => (
    parameters && parameters.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters)
  );
}
"""
        try:
            self._page.run_cdp("Page.addScriptToEvaluateOnNewDocument", source=stealth_script)
            self._browser_ready = True
            self.logger.debug("已注入浏览器反自动化脚本")
        except Exception as exc:
            self.logger.warning("注入浏览器反自动化脚本失败，将继续抓取: %s", exc)

    def _prime_browser_context(self, force: bool = False) -> None:
        page = self._ensure_browser() if self._page is None else self._page
        if page is None:
            return
        if not force and getattr(self, "_has_warmup", False):
            return
        try:
            self.logger.debug("预热站点上下文: %s", self.antibot.warmup_url)
            page.get(
                self.antibot.warmup_url,
                retry=self.antibot.retry_times,
                interval=self.antibot.retry_interval,
                timeout=self.antibot.page_timeout,
            )
            self._sleep_brief(1.0, 1.8)
            self._sync_browser_cookies_to_session()
            self._has_warmup = True
        except Exception as exc:
            self.logger.warning("站点预热失败，将在后续请求中继续重试: %s", exc)

    def _fetch_html(self, url: str, page_kind: str) -> str:
        page = self._ensure_browser()
        last_error: Optional[Exception] = None

        for attempt in range(1, self.antibot.retry_times + 1):
            self.logger.info("抓取%s页，第 %s/%s 次: %s", page_kind, attempt, self.antibot.retry_times, url)
            self._sleep_random(f"请求前抖动 {page_kind}#{attempt}")
            try:
                page.get(
                    url,
                    retry=0,
                    interval=self.antibot.retry_interval,
                    timeout=self.antibot.page_timeout,
                    show_errmsg=True,
                )
                self._sleep_brief(1.5, 2.8)
                html = page.html or ""
                self._sync_browser_cookies_to_session()

                if self._is_valid_html(html):
                    self.logger.debug("抓取成功，页面文本长度=%s: %s", len(clean_text(html)), url)
                    return html

                snapshot_path = self._save_html_snapshot(html, page_kind, attempt, url)
                self._anti_bot_hits += 1
                message = f"疑似命中反爬或页面内容过短: {url}"
                self.logger.warning("%s，快照已保存: %s", message, snapshot_path)
                last_error = RuntimeError(message)
                self._recover_after_anti_bot(url, attempt)

            except Exception as exc:
                last_error = exc
                self.logger.warning("抓取失败，第 %s 次重试: %s", attempt, exc)
                self._recover_after_anti_bot(url, attempt)

        raise RuntimeError(
            f"DrissionPage 连续 {self.antibot.retry_times} 次仍未拿到可解析页面，请考虑切换为可视化模式或使用 --input-urls-file 继续。"
            f" URL: {url}; 最后错误: {last_error}"
        )

    def _recover_after_anti_bot(self, url: str, attempt: int) -> None:
        if self._page is None:
            return
        try:
            self.logger.debug("尝试恢复浏览器上下文，第 %s 次: %s", attempt, url)
            self._page.run_js("window.scrollTo(0, document.body.scrollHeight * 0.3);")
        except Exception:
            pass
        self._sleep_brief(2.5, 4.0)
        if attempt < self.antibot.retry_times:
            self._prime_browser_context(force=True)

    def _save_html_snapshot(self, html: str, page_kind: str, attempt: int, url: str) -> Path:
        file_name = (
            f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{page_kind}_attempt{attempt}_"
            f"{safe_filename(urlparse(url).path.replace('/', '_') or 'page')}.html"
        )
        snapshot_path = self.snapshots_dir / file_name
        snapshot_path.write_text(html or "", encoding="utf-8")
        return snapshot_path

    def _is_valid_html(self, html: str) -> bool:

        if not html:
            return False
        if is_anti_bot_page(html):
            return False
        if len(clean_text(html)) < self.antibot.min_valid_text_length:
            return False
        return True

    def _sync_browser_cookies_to_session(self) -> None:
        if self._page is None:
            return
        try:
            for cookie in self._page.cookies(all_info=True):
                name = cookie.get("name")
                value = cookie.get("value")
                if not name:
                    continue
                self.session.cookies.set(
                    name,
                    value,
                    domain=cookie.get("domain"),
                    path=cookie.get("path", "/"),
                )
        except Exception as exc:
            self.logger.debug("同步浏览器 Cookie 失败: %s", exc)

    def _run_json_script(self, page, script: str):
        result = page.run_js(script)
        if result is None:
            return None
        if isinstance(result, (dict, list)):
            return result
        if isinstance(result, str):
            payload_text = result.strip()
            if not payload_text:
                return None
            return json.loads(payload_text)
        raise RuntimeError(f"无法解析 DrissionPage 返回结果: {type(result).__name__}")

    def _extract_list_items(self, page, page_url: str) -> List[AnnouncementItem]:
        payload = self._run_json_script(
            page,
            r"""
const cleanInline = (value) => String(value || '')
  .replace(/[\u00a0\u3000]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const extractDate = (value) => {
  const text = cleanInline(value);
  const match = text.match(/20\d{2}[年./-]\d{1,2}[月./-]\d{1,2}日?/);
  return match ? match[0] : '';
};
const links = Array.from(document.querySelectorAll('a[href]'));
const records = links.map((link) => {
  const container = link.closest('li, tr, .item, .list-item, .news-item, .article-item, .title, .tit, .wp_article_list li') || link.parentElement;
  const containerText = container ? (container.innerText || container.textContent || '') : '';
  return {
    title: cleanInline(link.innerText || link.textContent || ''),
    href: link.href || link.getAttribute('href') || '',
    nearby_text: cleanInline(containerText),
    publish_date: extractDate(containerText),
  };
});
return JSON.stringify(records);
""",
        ) or []

        candidates: List[AnnouncementItem] = []
        for record in payload:
            if not isinstance(record, dict):
                continue
            title = clean_text(record.get("title"))
            href = normalize_url(page_url, str(record.get("href", "")))
            if not href or not title:
                continue
            if should_skip_list_link(title, href):
                continue
            score = score_announcement_link(title, href)
            if score < 4:
                continue
            publish_date = normalize_date(record.get("publish_date") or extract_date_from_nearby_text(str(record.get("nearby_text", ""))))
            candidates.append(
                AnnouncementItem(
                    title=title,
                    detail_url=href,
                    publish_date=publish_date,
                    source_page=page_url,
                    product_type=infer_product_type_from_record(title, href, page_url, str(record.get("nearby_text", ""))),
                )
            )

        return self._limit_items(deduplicate_items(candidates))


    def _process_announcement(self, item: AnnouncementItem, sequence: int) -> dict[str, object]:
        self._fetch_html(item.detail_url, page_kind="detail")
        detail = self._extract_detail(item, self._ensure_browser())
        detail["sequence"] = sequence
        detail_title = str(detail.get("title") or item.title)
        file_name = f"{sequence:03d}_{safe_filename(detail_title)}.json"
        output_path = self.items_dir / file_name
        detail["output_file"] = str(output_path)
        with output_path.open("w", encoding="utf-8") as fp:
            json.dump(detail, fp, ensure_ascii=False, indent=2)
        self.logger.info("单条公告 JSON 已写入: %s", output_path)
        return detail


    def _extract_detail_payload(self, page) -> dict[str, object]:
        payload = self._run_json_script(
            page,
            r"""
const cleanInline = (value) => String(value || '')
  .replace(/[\u00a0\u3000]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const cleanBlock = (value) => String(value || '')
  .replace(/[\u00a0\u3000]/g, ' ')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .split('\n')
  .map((line) => line.replace(/[ \t]+/g, ' ').trim())
  .filter(Boolean)
  .join('\n')
  .trim();
const pickText = (selectors, mode) => {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (!node) continue;
    const text = mode === 'block'
      ? cleanBlock(node.innerText || node.textContent || '')
      : cleanInline(node.innerText || node.textContent || '');
    if (text) return text;
  }
  return '';
};
const attachments = Array.from(document.querySelectorAll('a[href]')).map((link) => ({
  href: link.href || link.getAttribute('href') || '',
  text: cleanInline(link.innerText || link.textContent || ''),
})).filter((item) => /\.(doc|docx|xls|xlsx|pdf)(?:$|[?#])/i.test(item.href));
const pageText = cleanBlock(document.body ? (document.body.innerText || document.body.textContent || '') : '');
const titleText = pickText(['h1', '.article-title', '.details-title', '.tit', '.title'], 'inline') || cleanInline(document.title || '');
const contentText = pickText([
  '.article-content',
  '.TRS_Editor',
  '.trs_editor_view',
  '.content',
  '#Zoom',
  '.zoom',
  '.Custom_UnionStyle',
  'div.text',
  'div.data'
], 'block');
const pageTextWithoutTitle = titleText && pageText.startsWith(titleText)
  ? cleanBlock(pageText.slice(titleText.length))
  : pageText;
return JSON.stringify({
  title: titleText,
  content_text: contentText && contentText !== titleText ? contentText : (pageTextWithoutTitle || pageText),
  page_text: pageText,
  attachments,
});
""",
        )
        return payload if isinstance(payload, dict) else {}

    def _extract_detail(self, item: AnnouncementItem, page) -> dict[str, object]:
        payload = self._extract_detail_payload(page)
        title = extract_title_from_payload(payload) or item.title
        content_text = extract_content_text_from_payload(payload)
        page_text = clean_multiline_text(str(payload.get("page_text") or content_text))
        publish_date = normalize_date(item.publish_date or extract_publish_date(page_text, content_text))
        announcement_no = extract_announcement_no(title, content_text)
        attachment_payload = payload.get("attachments")
        attachments = self._extract_attachments(
            attachment_payload if isinstance(attachment_payload, list) else [],
            item.detail_url,
            title,
        )
        product_type = normalize_product_type(
            item.product_type or infer_product_type_from_record(title, item.detail_url, item.source_page, content_text[:200], page_text[:200])
        )
        return {
            "sequence": None,
            "title": title,
            "announcement_no": announcement_no,
            "publish_date": publish_date,
            "detail_url": item.detail_url,
            "source_page": item.source_page,
            "product_type": product_type,
            "crawl_record": {
                "product_type": product_type,
                "source_page": item.source_page,
                "detail_url": item.detail_url,
            },
            "content_text": content_text,
            "content_preview": content_text[:1000],
            "attachments": attachments,
            "success": True,
        }

    def _extract_attachments(self, attachment_payload: list[dict[str, object]], detail_url: str, title: str) -> list[dict[str, object]]:
        attachments = []
        seen = set()
        for item in attachment_payload:
            if not isinstance(item, dict):
                continue
            href = normalize_url(detail_url, str(item.get("href", "")))
            text = clean_text(str(item.get("text") or ""))
            ext = Path(urlparse(href).path).suffix.lower()
            if not href or href in seen:
                continue
            if ext not in SUPPORTED_ATTACHMENT_EXTENSIONS:
                continue
            seen.add(href)
            attachment_record = self._download_and_parse_attachment(title, href, text, detail_url)
            attachments.append(attachment_record)
        return attachments


    def _download_and_parse_attachment(self, title: str, attachment_url: str, link_text: str, referer_url: str) -> dict[str, object]:
        file_ext = Path(urlparse(attachment_url).path).suffix.lower()
        folder = self.attachments_dir / safe_filename(title)
        folder.mkdir(parents=True, exist_ok=True)
        guessed_name = Path(urlparse(attachment_url).path).name or f"attachment{file_ext or '.bin'}"
        local_path = folder / guessed_name

        self.logger.info("下载附件: %s", attachment_url)
        download_info = self._download_file(attachment_url, local_path, referer_url)
        parse_result = None
        parse_error = None
        if local_path.exists() and file_ext in ATTACHMENT_PARSE_EXTENSIONS:
            try:
                parse_result = run_node_attachment_parser(local_path)
                self.logger.info("附件解析完成: %s", local_path)
            except Exception as exc:
                parse_error = str(exc)
                self.logger.warning("附件解析失败: %s | %s", local_path, parse_error)

        return {
            "attachment_name": clean_text(link_text) or guessed_name,
            "attachment_url": attachment_url,
            "local_path": str(local_path),
            "file_ext": file_ext,
            "download": download_info,
            "parse_result": parse_result,
            "parse_error": parse_error,
        }

    def _download_file(self, url: str, local_path: Path, referer_url: str) -> dict[str, object]:
        headers = {
            "Referer": referer_url or DEFAULT_LIST_URL,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        try:
            response = self.session.get(url, timeout=REQUEST_TIMEOUT, stream=True, headers=headers)
            if response.status_code == 412:
                self.logger.warning("附件下载命中 412，尝试预热后重试: %s", url)
                self._anti_bot_hits += 1
                self._prime_browser_context(force=True)
                response = self.session.get(url, timeout=REQUEST_TIMEOUT, stream=True, headers=headers)
            response.raise_for_status()
            with local_path.open("wb") as fp:
                for chunk in response.iter_content(chunk_size=65536):
                    if chunk:
                        fp.write(chunk)
            return {
                "success": True,
                "status_code": response.status_code,
                "file_size": local_path.stat().st_size,
            }
        except Exception as exc:
            if local_path.exists():
                local_path.unlink()
            self.logger.warning("附件下载失败: %s | %s", url, exc)
            return {
                "success": False,
                "error": str(exc),
            }

    def _limit_items(self, items: List[AnnouncementItem]) -> List[AnnouncementItem]:
        if self.max_items:
            return items[: self.max_items]
        return items

    def _sleep_random(self, scene: str) -> None:
        self._sleep_brief(self.antibot.min_delay, self.antibot.max_delay, scene)

    def _sleep_brief(self, lower: float, upper: float, scene: str = "等待") -> None:
        lower = max(0.0, lower)
        upper = max(lower, upper)
        seconds = random.uniform(lower, upper)
        self.logger.debug("%s，休眠 %.2f 秒", scene, seconds)
        time.sleep(seconds)


def clean_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def normalize_url(base_url: str, href: str) -> str:
    href = clean_text(href)
    if not href or href.startswith("javascript:") or href.startswith("#"):
        return ""
    return urljoin(base_url, href)


def should_skip_list_link(title: str, href: str) -> bool:
    skip_keywords = ("上一页", "下一页", "首页", "尾页", "更多", "返回", "打印", "关闭")
    if any(keyword in title for keyword in skip_keywords):
        return True
    if not href.endswith(".html"):
        return True
    if len(title) < 8:
        return True
    return False


def score_announcement_link(title: str, href: str) -> int:
    score = 0
    if title.startswith("国家药监局关于") or title.startswith("国家药品监督管理局关于"):
        score += 4
    if "化妆品" in title:
        score += 3
    if "通告" in title or "公告" in title:
        score += 2
    if "检出禁用原料" in title or "不符合规定" in title:
        score += 2
    if "国家药监局" in title or "国家药品监督管理局" in title:
        score += 1
    if 12 <= len(title) <= 80:
        score += 1
    if any(token in href for token in ["/xxgk/ggtg/hzhpggtg/", "/hzhpchjgg/", "/hzhpcjgjj/"]):
        score += 4
    if any(token in href for token in ["/hzhp/", "/xxgk/"]):
        score += 1
    return score



def deduplicate_items(items: Iterable[AnnouncementItem]) -> List[AnnouncementItem]:
    unique = []
    seen = set()
    for item in items:
        if item.detail_url in seen:
            continue
        seen.add(item.detail_url)
        unique.append(item)
    return unique


def extract_title_from_payload(payload: Optional[dict[str, object]]) -> str:
    if not isinstance(payload, dict):
        return ""
    return clean_text(str(payload.get("title") or ""))



def extract_content_text_from_payload(payload: Optional[dict[str, object]]) -> str:
    if not isinstance(payload, dict):
        return ""
    return clean_multiline_text(str(payload.get("content_text") or payload.get("page_text") or ""))





def clean_multiline_text(value: str) -> str:
    value = str(value or "")
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line)


def extract_publish_date(page_text: str, content_text: str) -> Optional[str]:
    return extract_date_from_nearby_text(page_text) or extract_date_from_nearby_text(content_text)



def extract_date_from_nearby_text(text: str) -> Optional[str]:
    normalized = clean_text(text)
    patterns = [r"(20\d{2})[-年/.](\d{1,2})[-月/.](\d{1,2})", r"(20\d{2})(\d{2})(\d{2})"]
    for pattern in patterns:
        match = re.search(pattern, normalized)
        if match:
            year, month, day = match.groups()
            try:
                return datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
            except ValueError:
                return None
    return None


def normalize_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return extract_date_from_nearby_text(str(value)) or clean_text(value)


def extract_announcement_no(title: str, content_text: str) -> Optional[str]:
    patterns = [r"（(20\d{2}年第\d+号)）", r"\((20\d{2}年第\d+号)\)", r"(20\d{2}年第\d+号)"]
    source_text = f"{title}\n{content_text[:500]}"
    for pattern in patterns:
        match = re.search(pattern, source_text)
        if match:
            return match.group(1)
    return None


def safe_filename(value: str, fallback: str = "announcement") -> str:
    value = clean_text(value)
    if not value:
        return fallback
    value = re.sub(r"[\\/:*?\"<>|]", "_", value)
    value = value[:120].strip("._ ")
    return value or fallback


def is_anti_bot_page(text: str) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in ANTI_BOT_KEYWORDS)


def run_node_attachment_parser(file_path: Path) -> dict[str, object]:
    node_bin = shutil.which("node")
    if not node_bin:
        raise RuntimeError("未找到 node，可先安装 Node.js 后再执行附件解析")

    completed = subprocess.run(
        [node_bin, str(NODE_WRAPPER), str(file_path)],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip() or "Node 附件解析失败")
    stdout = completed.stdout.strip()
    if not stdout:
        raise RuntimeError("Node 附件解析未返回任何内容")
    return json.loads(stdout)


def configure_logger(output_dir: Path, log_level: str, log_file_name: str) -> logging.Logger:
    logs_dir = output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_file = logs_dir / log_file_name

    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    logger.propagate = False

    if logger.handlers:
        for handler in list(logger.handlers):
            logger.removeHandler(handler)
            handler.close()

    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=2 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    logger.info("日志已初始化，日志文件: %s", log_file)
    return logger


def prompt_product_type(cli_value: str = "", logger: Optional[logging.Logger] = None) -> str:
    normalized_cli = normalize_product_type(cli_value, default="")
    if normalized_cli:
        if logger:
            logger.info("已通过命令行指定本次抓取产品类型: %s（%s）", normalized_cli, get_product_type_label(normalized_cli))
        return normalized_cli

    if not sys.stdin or not sys.stdin.isatty():
        if logger:
            logger.info("当前为非交互环境，且未传入 --product-type，本次抓取产品类型默认记录为未知")
        return "unknown"

    try:
        raw_value = input(PRODUCT_TYPE_PROMPT_TEXT)
    except EOFError:
        raw_value = ""

    selected = normalize_product_type(raw_value, default="unknown")
    if logger:
        logger.info("本次抓取产品类型已记录为: %s（%s）", selected, get_product_type_label(selected))
    return selected


def build_parser() -> argparse.ArgumentParser:

    parser = argparse.ArgumentParser(description="使用 DrissionPage 批量抓取国家药监局化妆品抽检通告，并先将附件解析结果写入 JSON。")
    parser.add_argument("--max-pages", type=int, default=2, help="最多抓取多少个列表页，默认 2")
    parser.add_argument("--max-items", type=int, default=2000, help="最多处理多少条公告，默认 10")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="JSON 输出目录")
    parser.add_argument("--download-dir", default=str(DEFAULT_DOWNLOAD_DIR), help="附件下载目录")
    parser.add_argument("--input-urls-file", default="", help="可选：从本地 JSON/TXT 读取公告详情 URL，而不是直接抓列表页")
    parser.add_argument("--product-type", default="", help="可选：直接指定本次抓取产品类型，如 cosmetics、food、medical_device、unknown")
    parser.add_argument("--headless", action="store_true", help="以无头模式运行 DrissionPage，默认关闭以降低反爬风险")

    parser.add_argument("--browser-path", default="", help="可选：指定 Chromium/Edge 浏览器路径")
    parser.add_argument("--browser-user-data-dir", default="", help="可选：指定浏览器用户数据目录，便于复用 Cookie/缓存")
    parser.add_argument("--page-timeout", type=float, default=45, help="页面加载超时秒数，默认 45")
    parser.add_argument("--retry-times", type=int, default=3, help="页面抓取最大重试次数，默认 3")
    parser.add_argument("--retry-interval", type=float, default=2.5, help="页面重试间隔秒数，默认 2.5")
    parser.add_argument("--min-delay", type=float, default=1.5, help="请求间最小随机等待秒数，默认 1.5")
    parser.add_argument("--max-delay", type=float, default=3.2, help="请求间最大随机等待秒数，默认 3.2")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"], help="日志级别，默认 INFO")
    parser.add_argument("--log-file", default="crawler.log", help="日志文件名，默认 crawler.log")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    output_dir = Path(args.output_dir).resolve()
    download_dir = Path(args.download_dir).resolve()
    logger = configure_logger(output_dir, args.log_level, args.log_file)
    selected_product_type = prompt_product_type(args.product_type, logger)

    antibot = AntiBotConfig(
        headless=bool(args.headless),
        user_agent=DEFAULT_USER_AGENT,
        page_timeout=max(10.0, args.page_timeout),
        retry_times=max(1, args.retry_times),
        retry_interval=max(0.5, args.retry_interval),
        min_delay=max(0.0, args.min_delay),
        max_delay=max(0.0, args.min_delay, args.max_delay),
    )


    logger.info(
        "启动抓取任务: max_pages=%s, max_items=%s, headless=%s, input_urls_file=%s, product_type=%s",
        args.max_pages,
        args.max_items,
        antibot.headless,
        args.input_urls_file or "<site>",
        selected_product_type,
    )

    crawler = NmpaAnnouncementCrawler(
        max_pages=max(1, args.max_pages),
        max_items=max(1, args.max_items) if args.max_items else None,
        output_dir=output_dir,
        download_dir=download_dir,
        input_urls_file=Path(args.input_urls_file).resolve() if args.input_urls_file else None,
        antibot=antibot,
        logger=logger,
        selected_product_type=selected_product_type,
        browser_path=args.browser_path,
        browser_user_data_dir=args.browser_user_data_dir,
    )

    try:
        manifest = crawler.crawl()
        meta = manifest.get("meta", {}) if isinstance(manifest, dict) else {}
        print(json.dumps(meta, ensure_ascii=False, indent=2))
        return 0

    except Exception as exc:
        logger.exception("执行失败")
        print(f"执行失败: {exc}", file=sys.stderr)
        return 1
    finally:
        crawler.close()


if __name__ == "__main__":
    raise SystemExit(main())
