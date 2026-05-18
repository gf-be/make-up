# -*- coding: utf-8 -*-
"""
DrissionPage 抓取市场监管总局“通知通告”中的食品抽检不合格情况通报。

流程：
1. 访问 https://zwfw.samr.gov.cn/scjg/wyk/tbtg/ 列表页；
2. 筛选“市场监管总局办公厅/总局关于 xx 批次食品抽检不合格情况的通报/通告”；
3. 抓取正文，下载 Excel/ZIP/PDF 附件；
4. 调用 data_get/parse_food_attachment.js 解析 Excel/ZIP（以表格第一列序号为分批主键，同序号多行合并；表头序号、同一抽样编号多行亦并入一条；抽样编号合并后续空白行沿用并入；不导入备注列），生成 data_get/output/items/*.json；
5. 可选调用后端接口，分别写入 food_inspection 原始拆解表和导入检查 staging；
6. 可选确认发布，正式同步到 announcements、announcement_product_details、
   inspections、inspection_details、unqualified_products、companies。

常用命令：
    python data_get/get_eatting.py --max-pages 3
    python data_get/get_eatting.py --max-pages 3 --import-db
    python data_get/get_eatting.py --max-pages 3 --import-db --confirm-published
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import subprocess
import sys
import time
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    from DrissionPage import ChromiumOptions, ChromiumPage
except ImportError:  # pragma: no cover - 运行环境提示用
    ChromiumOptions = None
    ChromiumPage = None


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BASE_URL = "https://zwfw.samr.gov.cn"
LIST_URL = f"{BASE_URL}/scjg/wyk/"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "output"
DEFAULT_ITEMS_DIR = DEFAULT_OUTPUT_DIR / "items"
DEFAULT_DOWNLOAD_DIR = Path(__file__).resolve().parent / "downloads" / "samr_food"
DEFAULT_BACKEND_URL = "http://127.0.0.1:3000"
NODE_FOOD_ATTACHMENT_PARSER = Path(__file__).resolve().parent / "parse_food_attachment.js"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)

SUPPORTED_ATTACHMENT_EXTENSIONS = {".xlsx", ".xls", ".pdf", ".zip"}
EXCEL_EXTENSIONS = {".xlsx", ".xls"}
ZIP_EXTENSIONS = {".zip"}
# JSON 中为 Windows 友好路径：第二级目录为通告年号/公告编号 announcement_no（经 safe_filename 清洗）
PRODUCT_IMAGE_PATH_TEMPLATE = r"backend\public\upload\products\{announcement_no_slug}\{sequence_no}.png"


def announcement_picture_folder_slug(announcement_no: object) -> str:
    raw = normalize_whitespace(announcement_no)
    if not raw:
        return "misc"
    slug = safe_filename(raw, limit=120)
    if slug in ("announcement", ""):
        return "misc"
    return slug

CONTENT_CONTAINER_SELECTORS = [
    ".TRS_Editor",
    ".trs_editor_view",
    ".wp_articlecontent",
    ".article-content",
    ".detail-content",
    ".Custom_UnionStyle",
    "article",
    "main",
    ".content",
]

CONTENT_REMOVE_SELECTORS = [
    "script",
    "style",
    "noscript",
    "iframe",
    "form",
    "header",
    "footer",
    "nav",
    ".breadcrumb",
    ".crumb",
    ".pages",
    ".pagination",
    ".related",
    ".attachment",
    ".attachments",
    ".editor-tools",
    ".article-source",
    ".article-info",
    '[class*="breadcrumb"]',
    '[class*="footer"]',
    '[class*="header"]',
    '[class*="nav"]',
    '[class*="tool"]',
    '[class*="source"]',
]

CONTENT_NOISE_LINE_PATTERNS = [
    re.compile(r"^\|+$"),
    re.compile(r"^\d{4}年\d{1,2}月\d{1,2}日(?:\s*星期[一二三四五六日天])?$"),
    re.compile(r"^(发布时间|成文日期|文章来源|信息来源|来源|字号)[:：].{0,50}$"),
    re.compile(r"^(官方微信|官方微博|无障碍|长者版|网站地图|联系我们|打印|关闭窗口|扫一扫在手机打开当前页)$"),
]

CONTENT_NAVIGATION_TOKENS = {
    "首页", "机构", "新闻", "政务", "服务", "互动", "数据", "专题",
    "知识产权", "质量强国", "总局", "要闻", "动态", "信息公开", "办事服务",
    "政务公开", "政策文件", "法规", "解读", "回应", "科普", "下载", "客户端",
}


def build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=3,
        read=3,
        connect=3,
        backoff_factor=1,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET", "HEAD", "POST"}),
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    })
    return session


def setup_logger(verbose: bool = False) -> logging.Logger:
    logger = logging.getLogger("samr_food_crawler")
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    logger.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
    handler.setLevel(logging.DEBUG if verbose else logging.INFO)
    logger.addHandler(handler)
    return logger


def clean_text(value: object) -> str:
    return str(value or "").replace("\u00a0", " ").replace("\u3000", " ").replace("\u0007", " ").strip()


def normalize_whitespace(value: object) -> str:
    return re.sub(r"[ \t]+", " ", clean_text(value).replace("\r", "\n")).strip()


def normalize_multiline_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line).strip()


# 形如 https://spcjsac.\ngsxt.gov.cn/ 的站内强制换行（下一行须为 ASCII 开头的 URL 片段）
_SOFT_URL_DOT_BREAK = re.compile(
    r"(https?://[^\s]+\.)\s*\n\s*([a-zA-Z][a-zA-Z0-9._\-/?:#&%=~+]*)",
    re.IGNORECASE,
)


def repair_soft_wrapped_urls(text: object) -> str:
    """合并 HTML get_text('\\n') 在域名内插入的无效换行（常见于主机名在中间被拆开）。"""
    if not text:
        return ""
    s = text.replace("\r\n", "\n").replace("\r", "\n")
    for _ in range(128):
        s2 = _SOFT_URL_DOT_BREAK.sub(r"\1\2", s, count=1)
        if s2 == s:
            break
        s = s2
    return s


def normalize_date_text(value: object) -> Optional[str]:
    text = normalize_whitespace(value)
    if not text:
        return None
    exact = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", text)
    if exact:
        y, m, d = exact.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"
    chinese = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", text)
    if chinese:
        y, m, d = chinese.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"
    return None


def normalize_cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    return normalize_whitespace(value)


def safe_filename(value: str, limit: int = 90) -> str:
    text = re.sub(r'[\\/:*?"<>|]+', "_", normalize_whitespace(value))
    text = re.sub(r"_+", "_", text).strip("._ ")
    return (text or "announcement")[:limit]


def resolve_download_filename(attachment_name: str, attachment_url: str) -> str:
    raw_name = normalize_whitespace(attachment_name).replace("\\", "/").split("/")[-1]
    url_name = Path(urlparse(attachment_url).path).name
    source_name = raw_name or url_name or "attachment.bin"
    source_path = Path(source_name)
    suffix = (source_path.suffix or Path(url_name).suffix or ".bin").lower()
    stem = source_path.stem if source_path.suffix else source_name
    return f"{safe_filename(stem, 100)}{suffix}"


def build_unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    counter = 1
    while True:
        candidate = path.with_name(f"{path.stem}_{counter}{path.suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


def build_notice_storage_key(title: str, publish_date: Optional[str], announcement_no: Optional[str], detail_url: str) -> str:
    parts: List[str] = []
    if publish_date:
        parts.append(publish_date.replace("-", ""))
    if announcement_no:
        parts.append(safe_filename(announcement_no, 40))
    article_match = re.search(r"(art_[A-Za-z0-9]+)", detail_url or "")
    if article_match:
        parts.append(article_match.group(1))
    parts.append(safe_filename(title, 60))
    return "__".join(part for part in parts if part)[:180]


def classify_food_notice(*values: object) -> Optional[str]:
    text = normalize_whitespace(" ".join(clean_text(value) for value in values if clean_text(value)))
    if not text or "食品" not in text or "抽检" not in text:
        return None
    if "不合格情况" in text and ("通报" in text or "通告" in text):
        return "unqualified_sampling"
    return None


def get_food_notice_label(notice_category: Optional[str]) -> str:
    return {
        "unqualified_sampling": "食品抽检不合格情况通报",
    }.get(notice_category or "", "待人工判断")


def extract_announcement_no(title: str, content_text: str) -> Optional[str]:
    source_text = f"{title}\n{content_text[:1200]}"
    match = re.search(r"([\u4e00-\u9fa5A-Za-z]{0,20}〔\d{4}〕\d+号)", source_text)
    return match.group(1) if match else None


def is_content_noise_line(line: str) -> bool:
    normalized = normalize_whitespace(line)
    compact = normalized.replace(" ", "")
    if not compact:
        return True
    if any(pattern.match(compact) for pattern in CONTENT_NOISE_LINE_PATTERNS):
        return True
    tokens = [token for token in re.split(r"[\s|/、·•]+", normalized) if token]
    if tokens:
        joined = "".join(tokens)
        if len(joined) <= 40 and all(token in CONTENT_NAVIGATION_TOKENS for token in tokens):
            return True
    return "官方微信" in compact or "官方微博" in compact


def clean_content_lines(text: object) -> str:
    lines = normalize_multiline_text(repair_soft_wrapped_urls(text)).split("\n")
    out: List[str] = []
    for line in lines:
        normalized = normalize_whitespace(line)
        if not normalized or is_content_noise_line(normalized):
            continue
        if out and out[-1] == normalized:
            continue
        out.append(normalized)
    return "\n".join(out).strip()


def extract_content_candidate(node: Tag) -> str:
    fragment = BeautifulSoup(str(node), "html.parser")
    for selector in CONTENT_REMOVE_SELECTORS:
        for child in fragment.select(selector):
            child.decompose()
    return clean_content_lines(fragment.get_text("\n", strip=True))


def extract_content_text(soup: BeautifulSoup) -> str:
    candidates: List[str] = []
    seen = set()
    for selector in CONTENT_CONTAINER_SELECTORS:
        for node in soup.select(selector):
            text = extract_content_candidate(node)
            if text and text not in seen:
                seen.add(text)
                candidates.append(text)
    if candidates:
        return max(candidates, key=lambda text: (len(text), -len(text.split("\n"))))
    return extract_content_candidate(soup.body or soup)


def extract_title(soup: BeautifulSoup) -> str:
    for selector in ("h1", ".arti-title", ".article-title", ".title"):
        node = soup.select_one(selector)
        if node:
            text = normalize_whitespace(node.get_text(" ", strip=True))
            if text:
                return text
    title_tag = soup.find("title")
    return normalize_whitespace(title_tag.get_text(" ", strip=True) if title_tag else "")


def extract_publish_date(soup: BeautifulSoup, fallback: Optional[str] = None) -> Optional[str]:
    if fallback:
        normalized = normalize_date_text(fallback)
        if normalized:
            return normalized
    page_text = soup.get_text("\n", strip=True)
    match = re.search(r"(发布时间|成文日期)[：:]?\s*(\d{4}-\d{1,2}-\d{1,2})", page_text)
    if match:
        return normalize_date_text(match.group(2))
    return normalize_date_text(page_text)


def extract_meta_department_hint(soup: BeautifulSoup) -> Optional[str]:
    for node in soup.select("meta"):
        key = clean_text(node.get("name") or node.get("property") or node.get("itemprop")).lower()
        if key in {"author", "source", "department", "publisher", "site"}:
            content = clean_text(node.get("content"))
            if content:
                return content
    return None


def infer_food_announcement_level(
    detail_url: Optional[str],
    title: Optional[str],
    department: Optional[str] = None,
) -> Tuple[str, str]:
    """
    通告层级：national=国家级、municipal=市级（地级市/直辖市等市场监管部门发布）。
    国家市场监督管理总局及总局官网转载一般视为国家级；地方市场监管局发布为市级。
    """
    host = ""
    parsed = urlparse(normalize_whitespace(detail_url))
    if parsed.hostname:
        host = parsed.hostname.lower()

    dept = normalize_whitespace(department)
    t = normalize_whitespace(title)
    blob = f"{dept} {t}"

    if "samr.gov.cn" in host or ("samr.gov.cn" in normalize_whitespace(detail_url).lower()):
        return "national", "国家级"

    national_markers = (
        "国家市场监督管理总局",
        "市场监管总局办公厅",
        "市场监管总局通报",
        "市场监管总局通告",
        "市场监管总局关于",
        "市场监管总局 ",
        "市场监管总局 ",
    )
    if any(marker in blob for marker in national_markers):
        return "national", "国家级"

    if re.search(
        r"[\u4e00-\u9fff]{2,16}?(?:市|自治区|特别行政区)(?:市场监管局|市场监督管理局)(?:发文|通告|通报|发布的通报)?",
        blob,
    ) and "国家市场监督管理总局" not in blob:
        return "municipal", "市级"

    municipal_markers = ("市市场监管局", "市市场监督管理局", "区市场监督管理局")
    if any(marker in blob for marker in municipal_markers) and "总局" not in dept and "国家市场监督管理" not in blob:
        return "municipal", "市级"

    return "national", "国家级"


def select_list_items(soup: BeautifulSoup) -> List[Tag]:
    selectors = [
        "div.seeList ul.gettonggao li",
        "ul.gettonggao li",
        "div.seeList li",
        "ul.items li",
        "li",
    ]
    for selector in selectors:
        items = list(soup.select(selector))
        if items:
            usable = [li for li in items if li.select_one("a[href]") and "食品抽检" in li.get_text(" ", strip=True)]
            if usable:
                return usable
    return []


def extract_link_target(value: object) -> str:
    if isinstance(value, list):
        value = value[0] if value else ""
    text = clean_text(value)
    if not text or text.startswith("javascript:") or text.startswith("#"):
        return ""
    return text


def extract_next_page_url(soup: BeautifulSoup, current_url: str) -> Optional[str]:
    next_link = soup.select_one("a.pageNext")
    if next_link is None:
        for link in soup.select("a"):
            if "下一页" in normalize_whitespace(link.get_text(" ", strip=True)):
                next_link = link
                break
    if next_link is None:
        return None
    candidates = [next_link.get("tagname"), next_link.get("href")]
    onclick = clean_text(next_link.get("onclick"))
    match = re.search(r"queryArticleByCondition\(this,'([^']+)'\)", onclick)
    if match:
        candidates.append(match.group(1))
    for candidate in candidates:
        target = extract_link_target(candidate)
        if target:
            return urljoin(current_url, target)
    return None


def parse_food_attachment_with_node(local_path: Path) -> Tuple[List[Dict[str, object]], str]:
    if not NODE_FOOD_ATTACHMENT_PARSER.is_file():
        raise RuntimeError(f"未找到食品附件解析脚本: {NODE_FOOD_ATTACHMENT_PARSER}")
    completed = subprocess.run(
        ["node", str(NODE_FOOD_ATTACHMENT_PARSER), str(local_path)],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    data = json.loads(completed.stdout.strip() or "{}")
    rows = data.get("rows") if isinstance(data, dict) else []
    if not isinstance(rows, list):
        rows = []
    rows = [row for row in rows if isinstance(row, dict) and normalize_whitespace(row.get("product_name"))]
    message = clean_text(data.get("message") if isinstance(data, dict) else "")
    if not rows and not message:
        message = "未从食品抽检附件中识别到可导入表格明细。"
    return rows, message


def build_product_picture_path(sequence_no: int, announcement_no: Optional[str] = None) -> str:
    announcement_no_slug = announcement_picture_folder_slug(announcement_no or "")
    return PRODUCT_IMAGE_PATH_TEMPLATE.format(
        announcement_no_slug=announcement_no_slug,
        sequence_no=int(sequence_no),
    )


def assign_product_picture_paths(
    attachments: List[Dict[str, object]],
    announcement_no: Optional[str] = None,
) -> int:
    sequence_no = 1
    for attachment in attachments:
        rows = attachment.get("parse_result", {}).get("rows", [])
        if not isinstance(rows, list):
            continue
        for row in rows:
            if isinstance(row, dict) and normalize_whitespace(row.get("product_name")):
                row["sequence_no"] = sequence_no
                row["picture_url"] = build_product_picture_path(sequence_no, announcement_no)
                sequence_no += 1
    return sequence_no - 1


def parse_zip_attachment(local_path: Path, logger: logging.Logger) -> Dict[str, object]:
    extract_dir = build_unique_path(local_path.with_suffix(""))
    extract_dir.mkdir(parents=True, exist_ok=True)
    rows: List[Dict[str, object]] = []
    extracted_files: List[Dict[str, object]] = []
    messages: List[str] = []
    try:
        with zipfile.ZipFile(local_path) as archive:
            for member in archive.infolist():
                if member.is_dir():
                    continue
                member_name = Path(member.filename.replace("\\", "/")).name
                if not member_name:
                    continue
                member_ext = Path(member_name).suffix.lower()
                if member_ext not in EXCEL_EXTENSIONS:
                    continue
                extracted_path = build_unique_path(extract_dir / resolve_download_filename(member_name, member.filename))
                extracted_path.write_bytes(archive.read(member))
                try:
                    parsed_rows, message = parse_food_attachment_with_node(extracted_path)
                except Exception as exc:
                    parsed_rows = []
                    message = f"解析压缩包内 Excel 失败: {exc}"
                    logger.warning("%s", message)
                rows.extend(parsed_rows)
                extracted_files.append({
                    "file_name": member_name,
                    "local_path": str(extracted_path),
                    "file_ext": member_ext,
                    "parsedCount": len(parsed_rows),
                    "message": message,
                })
                if message:
                    messages.append(f"{member_name}: {message}")
    except zipfile.BadZipFile as exc:
        raise RuntimeError(f"ZIP 附件损坏或格式不受支持: {exc}") from exc
    if not extracted_files:
        message = "压缩包内未找到可解析的 Excel 明细附件。"
    elif rows:
        message = ""
    else:
        message = "；".join(messages) if messages else "压缩包内 Excel 未识别到可导入数据。"
    return {
        "supported": True,
        "attachment_type": "zip",
        "parsedCount": len(rows),
        "counterfeitCount": 0,
        "rows": rows,
        "message": message,
        "extracted_files": extracted_files,
    }


FOOD_BODY_START_MARKERS = (
    "现将监督抽检不合格食品具体情况通报如下",
    "现将有关情况通报如下",
    "不合格食品具体情况通报如下",
    "现将抽检不合格食品有关情况通报如下",
    "通报如下：",
    "通报如下",
)
CHINESE_NUMERAL_ITEM = re.compile(r"（([一二三四五六七八九十百千零〇0-9]{1,6})）")
# food_content_segments 切段：括号内仅中文数位或阿拉伯数字，避免匹配「（手机APP）」等
FOOD_BODY_ORDINAL_MARK = re.compile(r"[（(]([一二三四五六七八九十百千零〇两0-9]{1,10})[）)]")


def _normalize_body_text_for_food_parse(content_text: str) -> str:
    text = normalize_multiline_text(content_text)
    text = re.sub(r"([A-Za-z%®])\s*\n\s*([0-9]+)", r"\1\2", text)
    return re.sub(r"\n+", "", text)


def _slice_food_narrative_body(text: str) -> str:
    cut = text
    for marker in FOOD_BODY_START_MARKERS:
        idx = cut.find(marker)
        if idx != -1:
            cut = cut[idx + len(marker):]
            break
    else:
        match = CHINESE_NUMERAL_ITEM.search(cut)
        if match:
            cut = cut[match.start():]
    cut = cut.lstrip("：: \t")
    for end_marker in ("特此通报", "附件下载"):
        idx = cut.find(end_marker)
        if idx != -1:
            cut = cut[:idx]
    return cut.strip()


def _split_food_body_items_by_ordinals(narrative: str, pattern: re.Pattern) -> List[Tuple[str, str]]:
    """按（一）（二）或半角括号序号切分段落，每一段为「标签 + 正文」。"""
    text = normalize_whitespace(narrative)
    if not text:
        return []
    trimmed = text.strip()
    matches = list(pattern.finditer(trimmed))
    out: List[Tuple[str, str]] = []
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(trimmed)
        body = trimmed[match.end():end].strip()
        label = normalize_whitespace(match.group(1))
        if label and body:
            out.append((label, body))
    return out


def parse_food_content_text_segments(content_text: str) -> List[Dict[str, object]]:
    """
    按通报正文「（一）」「（二）」……顺序拆分每款产品对应叙述文案，
    ordinal_index 为从 1 起的顺序序号，与同通报附件产品表中的 sequence_no 对齐。
    """
    text = _normalize_body_text_for_food_parse(content_text)
    narrative = _slice_food_narrative_body(text)
    if not narrative:
        return []
    tuples = _split_food_body_items_by_ordinals(narrative.strip(), FOOD_BODY_ORDINAL_MARK)
    if not tuples:
        tuples = _split_food_body_items_by_ordinals(narrative.strip(), CHINESE_NUMERAL_ITEM)
    items: List[Dict[str, object]] = []
    for index, (label, body) in enumerate(tuples, start=1):
        paragraph_compact = normalize_whitespace(normalize_multiline_text(f"（{label}）{body}"))
        paragraph_compact = re.sub(r"[ \t]+", " ", paragraph_compact)
        items.append({
            "ordinal_label": label,
            "ordinal_index": index,
            "paragraph_text": paragraph_compact,
        })
    return items


class SamrFoodCrawler:
    def __init__(
        self,
        max_pages: int,
        max_items: Optional[int],
        output_dir: Path,
        download_dir: Path,
        request_delay: float,
        logger: logging.Logger,
        browser_path: Optional[str] = None,
        browser_user_data_dir: Optional[str] = None,
        headless: bool = False,
    ) -> None:
        self.max_pages = max_pages
        self.max_items = max_items
        self.output_dir = output_dir
        self.items_dir = output_dir / "items"
        self.download_dir = download_dir
        self.request_delay = max(request_delay, 0)
        self.logger = logger
        self.browser_path = browser_path or None
        self.browser_user_data_dir = browser_user_data_dir or None
        self.headless = headless
        self.session = build_session()
        self._page = None
        self.items_dir.mkdir(parents=True, exist_ok=True)
        self.download_dir.mkdir(parents=True, exist_ok=True)

    def close(self) -> None:
        if self._page is not None:
            try:
                self._page.quit()
            except Exception as exc:
                self.logger.debug("关闭 DrissionPage 失败: %s", exc)
            self._page = None
        self.session.close()

    def ensure_browser(self):
        if self._page is not None:
            return self._page
        if ChromiumOptions is None or ChromiumPage is None:
            raise RuntimeError("未安装 DrissionPage，请先 pip install DrissionPage")
        options = ChromiumOptions()
        options.auto_port()
        options.headless(self.headless)
        options.set_load_mode("normal")
        options.set_timeouts(base=10, page_load=60, script=20)
        options.set_user_agent(USER_AGENT)
        options.set_download_path(str(self.download_dir))
        options.set_argument("--window-size=1440,900")
        options.set_argument("--lang=zh-CN")
        options.set_argument("--disable-blink-features=AutomationControlled")
        options.set_argument("--disable-features=Translate,AutomationControlled")
        options.set_argument("--disable-infobars")
        options.set_argument("--no-default-browser-check")
        options.set_argument("--disable-popup-blocking")
        options.set_argument("--ignore-certificate-errors")
        if self.browser_path:
            options.set_browser_path(self.browser_path)
        if self.browser_user_data_dir:
            user_data_dir = Path(self.browser_user_data_dir).resolve()
            user_data_dir.mkdir(parents=True, exist_ok=True)
            options.set_user_data_path(str(user_data_dir))
        self.logger.info("启动 DrissionPage 浏览器: headless=%s", self.headless)
        self._page = ChromiumPage(options)
        return self._page

    def sync_browser_cookies_to_session(self) -> None:
        if self._page is None:
            return
        try:
            for cookie in self._page.cookies(all_info=True):
                name = cookie.get("name")
                value = cookie.get("value")
                if not name:
                    continue
                self.session.cookies.set(name, value, domain=cookie.get("domain"), path=cookie.get("path", "/"))
        except Exception as exc:
            self.logger.debug("同步浏览器 Cookie 失败: %s", exc)

    def fetch_text(self, url: str, referer: Optional[str] = None) -> str:
        page = self.ensure_browser()
        try:
            page.run_cdp("Network.enable")
            page.run_cdp("Network.setExtraHTTPHeaders", headers={"Referer": referer or LIST_URL})
        except Exception:
            pass
        page.get(url, retry=2, interval=2, timeout=60, show_errmsg=True)
        time.sleep(1.0)
        html = page.html or ""
        self.sync_browser_cookies_to_session()
        if not html.strip():
            raise RuntimeError(f"页面内容为空: {url}")
        return html

    def fetch_binary(self, url: str, referer: Optional[str] = None) -> bytes:
        self.sync_browser_cookies_to_session()
        response = self.session.get(url, timeout=60, headers={"Referer": referer or LIST_URL})
        response.raise_for_status()
        return response.content

    def crawl(self) -> Dict[str, object]:
        candidates = self.load_candidates()
        results: List[Dict[str, object]] = []
        self.logger.info("识别到食品抽检不合格通报候选 %s 条", len(candidates))
        for index, item in enumerate(candidates, start=1):
            self.logger.info("[%s/%s] 抓取 %s", index, len(candidates), item["title"])
            try:
                results.append(self.process_item(item, index))
            except Exception as exc:
                self.logger.exception("处理通报失败: %s", item.get("detail_url"))
                results.append({
                    "sequence": index,
                    "title": item.get("title"),
                    "detail_url": item.get("detail_url"),
                    "publish_date": item.get("publish_date"),
                    "success": False,
                    "error": str(exc),
                })
            if self.request_delay > 0 and index < len(candidates):
                time.sleep(self.request_delay)
        manifest = {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "source": "国家市场监督管理总局-通知通告",
            "list_url": LIST_URL,
            "items_dir": str(self.items_dir),
            "download_dir": str(self.download_dir),
            "total_candidates": len(candidates),
            "success_count": sum(1 for item in results if item.get("success")),
            "failed_count": sum(1 for item in results if not item.get("success")),
            "results": results,
        }
        self.output_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = self.output_dir / "samr_food_manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        self.logger.info("抓取完成，摘要已写入: %s", manifest_path)
        return manifest

    def load_candidates(self) -> List[Dict[str, object]]:
        candidates: List[Dict[str, object]] = []
        seen_urls = set()
        visited_pages = set()
        page_no = 1
        page_url = LIST_URL
        while page_no <= self.max_pages and page_url and page_url not in visited_pages:
            visited_pages.add(page_url)
            html = self.fetch_text(page_url, referer=LIST_URL)
            soup = BeautifulSoup(html, "html.parser")
            page_items = 0
            for li in select_list_items(soup):
                link = li.select_one("h3 a") or li.select_one("a[href]")
                if not link:
                    continue
                title = normalize_whitespace(link.get("title") or link.get_text(" ", strip=True))
                href = urljoin(page_url, extract_link_target(link.get("href")))
                notice_category = classify_food_notice(title, li.get_text(" ", strip=True))
                if not notice_category or not href or href in seen_urls:
                    continue
                time_node = li.select_one(".time")
                publish_date = normalize_date_text(time_node.get_text(" ", strip=True) if time_node else li.get_text(" ", strip=True))
                candidates.append({
                    "title": title,
                    "detail_url": href,
                    "publish_date": publish_date or "",
                    "source_page": page_url,
                    "notice_category": notice_category,
                    "notice_category_label": get_food_notice_label(notice_category),
                    "classification_status": "identified",
                })
                page_items += 1
                seen_urls.add(href)
                if self.max_items and len(candidates) >= self.max_items:
                    return candidates
            next_url = extract_next_page_url(soup, page_url)
            self.logger.info("列表第 %s 页新增 %s 条，下一页：%s", page_no, page_items, next_url or "<无>")
            if not next_url:
                break
            page_no += 1
            page_url = next_url
        return candidates

    def process_item(self, item: Dict[str, object], sequence: int) -> Dict[str, object]:
        detail_url = normalize_whitespace(item.get("detail_url"))
        source_page = normalize_whitespace(item.get("source_page")) or LIST_URL
        html = self.fetch_text(detail_url, referer=source_page)
        soup = BeautifulSoup(html, "html.parser")
        title = extract_title(soup) or normalize_whitespace(item.get("title"))
        content_text = extract_content_text(soup)
        publish_date = extract_publish_date(soup, normalize_whitespace(item.get("publish_date")) or None)
        announcement_no = extract_announcement_no(title, content_text)
        notice_category = classify_food_notice(title, content_text) or item.get("notice_category") or "unqualified_sampling"
        storage_key = build_notice_storage_key(title, publish_date, announcement_no, detail_url)
        attachments = self.extract_attachments(soup, detail_url, storage_key)
        parsed_total = assign_product_picture_paths(attachments, announcement_no)
        department_hint = extract_meta_department_hint(soup)
        ann_level_code, ann_level_label = infer_food_announcement_level(detail_url, title, department_hint)
        payload = {
            "sequence": sequence,
            "title": title,
            "announcement_no": announcement_no,
            "publish_date": publish_date,
            "detail_url": detail_url,
            "source_detail_url": detail_url,
            "source_page": source_page,
            "product_type": "food",
            "announcement_type": "sampling",
            "announcement_level": ann_level_code,
            "announcement_level_label": ann_level_label,
            "department": department_hint,
            "notice_category": notice_category,
            "notice_category_label": get_food_notice_label(notice_category),
            "classification_status": "identified",
            "requires_manual_review": parsed_total == 0,
            "_import_meta": {
                "product_type": "food",
                "announcement_type": "sampling",
                "product_type_label": "食品",
                "announcement_type_label": "抽检通告",
                "notice_category": notice_category,
                "announcement_level": ann_level_code,
                "announcement_level_label": ann_level_label,
            },
            "crawl_record": {
                "product_type": "food",
                "announcement_type": "sampling",
                "source_page": source_page,
                "detail_url": detail_url,
                "announcement_level": ann_level_code,
                "announcement_level_label": ann_level_label,
            },
            "content_text": content_text,
            "content_preview": content_text[:1000],
            "food_content_segments": parse_food_content_text_segments(content_text),
            "attachments": attachments,
            "success": True,
        }
        publish_key = (publish_date or f"no-date-{sequence:03d}").replace("-", "")
        output_path = self.items_dir / f"food_{publish_key}_{safe_filename(title)}.json"
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self.logger.info("已写入 JSON: %s（解析明细 %s 条）", output_path, parsed_total)
        return {
            "sequence": sequence,
            "title": title,
            "detail_url": detail_url,
            "publish_date": publish_date,
            "announcement_no": announcement_no,
            "notice_category": notice_category,
            "attachment_count": len(attachments),
            "parsed_count": parsed_total,
            "output_file": str(output_path),
            "success": True,
        }

    def extract_attachments(self, soup: BeautifulSoup, detail_url: str, storage_key: str) -> List[Dict[str, object]]:
        attachments: List[Dict[str, object]] = []
        seen_urls = set()
        for link in soup.select("a[href]"):
            href = urljoin(detail_url, extract_link_target(link.get("href")))
            ext = Path(urlparse(href).path).suffix.lower()
            if not href or href in seen_urls or ext not in SUPPORTED_ATTACHMENT_EXTENSIONS:
                continue
            attachment_name = normalize_whitespace(link.get_text(" ", strip=True)) or Path(urlparse(href).path).name
            attachments.append(self.download_and_parse_attachment(storage_key, attachment_name, href, detail_url))
            seen_urls.add(href)
        return attachments

    def download_and_parse_attachment(self, storage_key: str, attachment_name: str, attachment_url: str, referer_url: str) -> Dict[str, object]:
        folder = self.download_dir / storage_key
        folder.mkdir(parents=True, exist_ok=True)
        local_path = build_unique_path(folder / resolve_download_filename(attachment_name, attachment_url))
        file_bytes = self.fetch_binary(attachment_url, referer=referer_url)
        local_path.write_bytes(file_bytes)
        file_ext = local_path.suffix.lower()
        if file_ext in EXCEL_EXTENSIONS:
            try:
                rows, message = parse_food_attachment_with_node(local_path)
                parse_result = {
                    "supported": True,
                    "attachment_type": "excel",
                    "parsedCount": len(rows),
                    "counterfeitCount": 0,
                    "rows": rows,
                    "message": message,
                }
            except Exception as exc:
                parse_result = {
                    "supported": True,
                    "attachment_type": "excel",
                    "parsedCount": 0,
                    "counterfeitCount": 0,
                    "rows": [],
                    "message": f"解析食品抽检附件失败: {exc}",
                }
        elif file_ext in ZIP_EXTENSIONS:
            try:
                parse_result = parse_zip_attachment(local_path, self.logger)
            except Exception as exc:
                parse_result = {
                    "supported": True,
                    "attachment_type": "zip",
                    "parsedCount": 0,
                    "counterfeitCount": 0,
                    "rows": [],
                    "message": f"解析食品抽检压缩包失败: {exc}",
                }
        else:
            parse_result = {
                "supported": False,
                "attachment_type": file_ext.replace(".", "") or "unknown",
                "parsedCount": 0,
                "counterfeitCount": 0,
                "rows": [],
                "message": "当前附件已下载保存，不参与食品表格解析。",
            }
        parsed_count = int(parse_result.get("parsedCount") or 0)
        message = clean_text(parse_result.get("message"))
        return {
            "attachment_name": attachment_name,
            "attachment_url": attachment_url,
            "local_path": str(local_path),
            "file_ext": file_ext,
            "download": {"success": True, "bytes": len(file_bytes)},
            "parse_result": parse_result,
            "parse_error": None if parsed_count > 0 else (message or None),
        }


def import_to_backend(
    backend_url: str,
    items_dir: Path,
    confirm_published: bool,
    logger: logging.Logger,
) -> Dict[str, object]:
    session = build_session()
    base = backend_url.rstrip("/")
    food_url = f"{base}/api/food-inspections/import-json"
    staging_url = f"{base}/api/announcement-staging/import-json"
    confirm_url = f"{base}/api/announcement-staging/confirm-all"

    logger.info("写入 food_inspection 原始拆解表: %s", food_url)
    food_resp = session.post(food_url, json={"directory": str(items_dir)}, timeout=180)
    food_resp.raise_for_status()
    food_result = food_resp.json()
    if food_result.get("success") is False:
        raise RuntimeError(food_result.get("message") or "写入 food_inspection 失败")

    logger.info("导入导入检查 staging: %s", staging_url)
    staging_resp = session.post(
        staging_url,
        json={
            "directory": str(items_dir),
            "product_type": "food",
            "announcement_type": "sampling",
        },
        timeout=180,
    )
    staging_resp.raise_for_status()
    staging_result = staging_resp.json()
    if staging_result.get("success") is False:
        raise RuntimeError(staging_result.get("message") or "导入 staging 失败")

    created_ids = [
        int(item["id"])
        for item in ((staging_result.get("data") or {}).get("items") or [])
        if item.get("action") == "created" and item.get("id")
    ]
    confirm_result = None
    if confirm_published and created_ids:
        logger.warning("直接确认发布到正式库: %s", created_ids)
        confirm_resp = session.post(confirm_url, json={"ids": created_ids}, timeout=180)
        confirm_resp.raise_for_status()
        confirm_result = confirm_resp.json()
        if confirm_result.get("success") is False:
            raise RuntimeError(confirm_result.get("message") or "确认发布失败")
    return {"food_import": food_result, "staging_import": staging_result, "confirm": confirm_result, "created_ids": created_ids}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="DrissionPage 抓取市场监管总局办公厅食品抽检不合格通报正文与附件，并解析导入数据库")
    parser.add_argument("--max-pages", type=int, default=3, help="最多抓取列表页数，默认 3")
    parser.add_argument("--max-items", type=int, default=0, help="最多抓取通告数量，0 表示不限制")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="输出目录，默认 data_get/output")
    parser.add_argument("--download-dir", default=str(DEFAULT_DOWNLOAD_DIR), help="附件下载目录")
    parser.add_argument("--request-delay", type=float, default=0.8, help="请求间隔秒数")
    parser.add_argument("--backend-url", default=DEFAULT_BACKEND_URL, help="后端服务地址")
    parser.add_argument("--import-db", action="store_true", help="抓取后写入 food_inspection 并导入前端导入检查 staging")
    parser.add_argument("--confirm-published", action="store_true", help="导入 staging 后直接确认发布到正式库（会隐含 --import-db）")
    parser.add_argument("--headless", action="store_true", help="DrissionPage 无头模式")
    parser.add_argument("--browser-path", default="", help="Chrome/Chromium 可执行文件路径")
    parser.add_argument("--user-data-dir", default="", help="浏览器用户数据目录")
    parser.add_argument("--verbose", action="store_true", help="输出详细日志")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logger = setup_logger(args.verbose)
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    items_dir = output_dir / "items"
    items_dir.mkdir(parents=True, exist_ok=True)
    crawler = SamrFoodCrawler(
        max_pages=max(args.max_pages, 1),
        max_items=args.max_items or None,
        output_dir=output_dir,
        download_dir=Path(args.download_dir).resolve(),
        request_delay=args.request_delay,
        logger=logger,
        browser_path=args.browser_path,
        browser_user_data_dir=args.user_data_dir,
        headless=args.headless,
    )
    try:
        manifest = crawler.crawl()
        logger.info(
            "抓取完成：成功 %s 条，失败 %s 条，JSON 目录 %s",
            manifest["success_count"],
            manifest["failed_count"],
            items_dir,
        )
        if args.import_db or args.confirm_published:
            result = import_to_backend(args.backend_url, items_dir, args.confirm_published, logger)
            logger.info("数据库导入完成，新增 staging 批次 %s 个", len(result.get("created_ids") or []))
        return 0
    except Exception as exc:
        logger.exception("食品抽检通报抓取/导入失败: %s", exc)
        return 1
    finally:
        crawler.close()


if __name__ == "__main__":
    raise SystemExit(main())
