# -*- coding: utf-8 -*-
"""
抓取市场监管总局“我要看”栏目中的食品抽检不合格情况通报。

输出结构与 getdata.py / get_eatting.py 生成的导入 JSON 保持兼容：
1. 通报级信息写入 JSON 顶层；
2. 附件解析结果写入 attachments[].parse_result.rows（Excel 侧 data_get/parse_food_attachment.js：
   同一附件内以「表格第一列序号」为产品分界，同序号多行的多项不合格拼成一条（字段内换行衔接，检验值/不合格项目等分段去重）；
   同产品续行也会对样品名称、企业/抽样单位、规格、抽样编号展示类字段做取长与去重合并（互为子串取较长；否则并列去重拼接）；
   第一列不可用时按表头「序号」列；若多行共用同一抽样编号，即使序号列递增也会并入一条；
   抽样编号列为合并单元格后续空白时，沿用上一非空抽样编号并按编号并入（如钙铁锌多营养素分行）；
   食品抽检通报附件不导入「备注」列内容，remarks 恒为 null（解析见 data_get/parse_food_attachment.js）。
3. 明确标记 product_type=food、announcement_type=sampling；
4. 按正文「（一）（二）……」拆分 content_text，生成 food_content_segments，入库时写入 food_content 并绑定 food_inspection_products.id；
5. 可选调用后端接口写入 food_inspection 原始表和 announcement_staging。

常用命令：
    python data_get/getShop.py --max-pages 1 --max-items 1
    python data_get/getShop.py --max-pages 1 --max-items 1 --import-db
    python data_get/getShop.py --max-pages 1 --max-items 1 --import-db --confirm-published
"""

from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from bs4 import BeautifulSoup

import get_eatting as food


LIST_URL = f"{food.BASE_URL}/scjg/wyk/tbtg/"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "output"
DEFAULT_DOWNLOAD_DIR = Path(__file__).resolve().parent / "downloads" / "samr_food_shop"
DEFAULT_BACKEND_URL = food.DEFAULT_BACKEND_URL

# get_eatting.SamrFoodCrawler 中的分页、Referer 与清单记录读取全都引用模块级 LIST_URL。
food.LIST_URL = LIST_URL


METADATA_LABEL_ALIASES = {
    "index_no": ("索引号", "信息索引号"),
    "document_no": ("文号", "发文字号", "文件编号"),
    "topic_category": ("主题分类", "主题词", "分类"),
    "department": ("所属机构", "发布机构", "发布单位", "制发单位", "发文机关"),
    "publish_date": ("发布日期", "发布时间"),
    "document_date": ("成文日期", "成文时间"),
}


def normalize_text(value: object) -> str:
    return food.normalize_whitespace(value)


def compact_label(value: object) -> str:
    return re.sub(r"[\s:：/（）()[\]【】]+", "", normalize_text(value))


def iter_visible_lines(soup: BeautifulSoup) -> Iterable[str]:
    for line in soup.get_text("\n", strip=True).splitlines():
        line = normalize_text(line)
        if line:
            yield line


def extract_meta_content(soup: BeautifulSoup, *names: str) -> Optional[str]:
    wanted = {name.lower() for name in names if name}
    for node in soup.select("meta"):
        key = normalize_text(node.get("name") or node.get("property") or node.get("itemprop")).lower()
        if key in wanted:
            content = normalize_text(node.get("content"))
            if content:
                return content
    return None


def extract_labeled_value(lines: List[str], labels: Iterable[str]) -> Optional[str]:
    label_set = {compact_label(label) for label in labels}
    for index, line in enumerate(lines):
        compact = compact_label(line)
        for label in label_set:
            for span in range(2, min(6, len(lines) - index) + 1):
                merged_label = "".join(compact_label(part) for part in lines[index:index + span])
                if merged_label == label and index + span < len(lines):
                    value = normalize_text(lines[index + span])
                    if value:
                        return value
                if merged_label.startswith(label) and merged_label != compact:
                    raw_value = merged_label[len(label):]
                    if raw_value:
                        return raw_value
            if compact == label and index + 1 < len(lines):
                value = normalize_text(lines[index + 1])
                if value and compact_label(value) not in label_set:
                    return value
            if compact.startswith(label):
                raw_value = re.sub(
                    rf"^\s*{re.escape(label)}\s*[:：]?\s*",
                    "",
                    compact,
                    count=1,
                )
                if raw_value:
                    return raw_value

        pattern = rf"(?:{'|'.join(re.escape(label) for label in labels)})\s*[:：]\s*([^\n\r|｜]+)"
        match = re.search(pattern, line)
        if match:
            value = normalize_text(match.group(1))
            if value:
                return value
    return None


def extract_page_metadata(soup: BeautifulSoup, title: str, content_text: str) -> Dict[str, Optional[str]]:
    lines = list(iter_visible_lines(soup))
    metadata: Dict[str, Optional[str]] = {}
    for field, labels in METADATA_LABEL_ALIASES.items():
        metadata[field] = extract_labeled_value(lines, labels)

    page_text = "\n".join(lines)
    metadata["title"] = title
    metadata["index_no"] = metadata["index_no"] or extract_meta_content(soup, "index", "index_no")
    metadata["document_no"] = (
        metadata["document_no"]
        or food.extract_announcement_no(title, content_text)
        or food.extract_announcement_no(title, page_text)
    )
    metadata["publish_date"] = (
        food.normalize_date_text(metadata["publish_date"])
        or food.extract_publish_date(soup)
        or food.normalize_date_text(page_text)
    )
    metadata["document_date"] = food.normalize_date_text(metadata["document_date"])
    metadata["department"] = metadata["department"] or extract_meta_content(soup, "author", "source", "department")
    metadata["topic_category"] = metadata["topic_category"] or extract_meta_content(soup, "keywords", "category")
    return metadata


def is_empty_document_no(value: object) -> bool:
    text = normalize_text(value)
    return not text or text in {"无", "/", "-", "—", "暂无"}


def resequence_attachment_rows(attachments: List[Dict[str, object]], announcement_no: Optional[str]) -> int:
    return food.assign_product_picture_paths(attachments, announcement_no)


class SamrFoodShopCrawler(food.SamrFoodCrawler):
    """面向 /scjg/wyk/ 入口的食品通报爬虫。"""

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
            "source": "国家市场监督管理总局-我要看",
            "list_url": LIST_URL,
            "items_dir": str(self.items_dir),
            "download_dir": str(self.download_dir),
            "total_candidates": len(candidates),
            "success_count": sum(1 for item in results if item.get("success")),
            "failed_count": sum(1 for item in results if not item.get("success")),
            "results": results,
        }
        self.output_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = self.output_dir / "samr_food_shop_manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        self.logger.info("抓取完成，摘要已写入: %s", manifest_path)
        return manifest

    def process_item(self, item: Dict[str, object], sequence: int) -> Dict[str, object]:
        detail_url = normalize_text(item.get("detail_url"))
        source_page = normalize_text(item.get("source_page")) or LIST_URL
        html = self.fetch_text(detail_url, referer=source_page)
        soup = BeautifulSoup(html, "html.parser")
        title = food.extract_title(soup) or normalize_text(item.get("title"))
        
        # 正文见 get_eatting.extract_content_text：已合并站内 HTML 在 URL/域名内因块级排版产生的无效换行
        for sub in soup.find_all("sub"):
            sub.unwrap()
        # print(soup)
        raw_text  = soup.find("div", class_="Three_xilan_07")
        content_text = food.extract_content_text(raw_text) 
        metadata = extract_page_metadata(soup, title, content_text)

        publish_date = metadata.get("publish_date") or food.extract_publish_date(
            soup,
            normalize_text(item.get("publish_date")) or None,
        )
        extracted_announcement_no = food.extract_announcement_no(title, content_text)
        raw_document_no = metadata.get("document_no")
        announcement_no = extracted_announcement_no or (None if is_empty_document_no(raw_document_no) else raw_document_no)
        notice_category = food.classify_food_notice(title, content_text) or item.get("notice_category") or "unqualified_sampling"
        storage_key = food.build_notice_storage_key(title, publish_date, announcement_no, detail_url)
        attachments = self.extract_attachments(soup, detail_url, storage_key)
        parsed_total = resequence_attachment_rows(attachments, announcement_no)

        department_for_level = normalize_text(metadata.get("department")) or food.extract_meta_department_hint(soup)
        ann_level_code, ann_level_label = food.infer_food_announcement_level(detail_url, title, department_for_level)

        payload = {
            "sequence": sequence,
            "title": title,
            "index_no": metadata.get("index_no"),
            "announcement_no": announcement_no,
            "document_no": raw_document_no or announcement_no,
            "topic_category": metadata.get("topic_category"),
            "department": metadata.get("department"),
            "publish_date": publish_date,
            "document_date": metadata.get("document_date"),
            "detail_url": detail_url,
            "source_detail_url": detail_url,
            "source_page": source_page,
            "product_type": "food",
            "announcement_type": "sampling",
            "announcement_level": ann_level_code,
            "announcement_level_label": ann_level_label,
            "notice_category": notice_category,
            "notice_category_label": food.get_food_notice_label(notice_category),
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
                "index_no": metadata.get("index_no"),
                "document_no": raw_document_no or announcement_no,
                "announcement_no": announcement_no,
                "topic_category": metadata.get("topic_category"),
                "department": metadata.get("department"),
                "document_date": metadata.get("document_date"),
                "announcement_level": ann_level_code,
                "announcement_level_label": ann_level_label,
            },
            "content_text": content_text,
            "content_preview": content_text[:1000],
            "food_content_segments": food.parse_food_content_text_segments(content_text),
            "attachments": attachments,
            "success": True,
        }
        publish_key = (publish_date or f"no-date-{sequence:03d}").replace("-", "")
        output_path = self.items_dir / f"food_{publish_key}_{food.safe_filename(title)}.json"
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self.logger.info("已写入 JSON: %s（解析明细 %s 条）", output_path, parsed_total)
        return {
            "sequence": sequence,
            "title": title,
            "detail_url": detail_url,
            "publish_date": publish_date,
            "document_date": metadata.get("document_date"),
            "announcement_no": announcement_no,
            "index_no": metadata.get("index_no"),
            "topic_category": metadata.get("topic_category"),
            "department": metadata.get("department"),
            "notice_category": notice_category,
            "attachment_count": len(attachments),
            "parsed_count": parsed_total,
            "output_file": str(output_path),
            "success": True,
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="抓取市场监管总局“我要看”食品抽检不合格通报，并解析附件生成可导入 JSON。")
    parser.add_argument("--max-pages", type=int, default=3, help="最多抓取列表页数，默认 3")
    parser.add_argument("--max-items", type=int, default=0, help="最多抓取通告数量，0 表示不限制")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="输出目录，默认 data_get/output")
    parser.add_argument("--download-dir", default=str(DEFAULT_DOWNLOAD_DIR), help="附件下载目录")
    parser.add_argument("--request-delay", type=float, default=0.8, help="请求间隔秒数")
    parser.add_argument("--backend-url", default=DEFAULT_BACKEND_URL, help="后端服务地址")
    parser.add_argument("--import-db", action="store_true", help="抓取后写入 food_inspection 并导入 announcement_staging")
    parser.add_argument("--confirm-published", action="store_true", help="导入 staging 后直接确认发布到正式库（会隐含 --import-db）")
    parser.add_argument("--headless", action="store_true", help="DrissionPage 无头模式")
    parser.add_argument("--browser-path", default="", help="Chrome/Chromium 可执行文件路径")
    parser.add_argument("--user-data-dir", default="", help="浏览器用户数据目录")
    parser.add_argument("--verbose", action="store_true", help="输出详细日志")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logger = food.setup_logger(args.verbose)
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    items_dir = output_dir / "items"
    items_dir.mkdir(parents=True, exist_ok=True)

    crawler = SamrFoodShopCrawler(
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
            result = food.import_to_backend(args.backend_url, items_dir, args.confirm_published, logger)
            logger.info("数据库导入完成，新增 staging 批次 %s 个", len(result.get("created_ids") or []))
        return 0
    except Exception as exc:
        logger.exception("食品抽检通报抓取/导入失败: %s", exc)
        return 1
    finally:
        crawler.close()


if __name__ == "__main__":
    raise SystemExit(main())