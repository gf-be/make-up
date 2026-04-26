# -*- coding: utf-8 -*-
"""
根据不合格产品抽检 Excel 汇总生成短视频口播文案，并给出网络配图检索结果。

Excel 列名（与项目内导出一致）：日期、来源通告、问题对象/标题、企业名称、所在省份、
不符合规定项目/检查问题、产品类型、通告类型、被抽样单位地址、生产企业省份、
问题类型、产品分类、检验结果/处理措施 等。

用法:
    python auto_text.py 你的文件.xlsx
    python auto_text.py 你的文件.xlsx -o ./output --images 6 --products 6

依赖: pandas, openpyxl；可选 duckduckgo-search / ddgs（网络图片，失败时仅用必应搜索链接）。

典型产品选取：优先按「知名度」排序（产品名/企业名命中 video_copywriter 中的知名品牌词库；
同表内同名多行另有小幅加分），再按字段完整度与行号作为 tie-break。
"""

from __future__ import annotations

import argparse
import functools
import json
import os
import re
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import quote_plus

import pandas as pd


@functools.lru_cache(maxsize=1)
def _brand_keywords_for_familiarity() -> Tuple[str, ...]:
    """
    知名度近似：与 video_copywriter 中「知名品牌」词库一致，匹配产品名或企业名。
    无法导入时使用精简兜底列表。
    """
    try:
        from video_copywriter import VideoCopywriter  # type: ignore

        return tuple(VideoCopywriter.KNOWN_BRANDS)
    except Exception:
        return (
            "自然堂",
            "百雀羚",
            "珀莱雅",
            "韩束",
            "一叶子",
            "相宜本草",
            "欧诗漫",
            "丸美",
            "卡姿兰",
            "美肤宝",
            "法兰琳卡",
            "御泥坊",
            "膜法世家",
            "同仁堂",
            "片仔癀",
            "兰蔻",
            "雅诗兰黛",
            "资生堂",
            "芙丽芳丝",
            "珂润",
        )


def _familiarity_score(
    product_name: str,
    producer_name: str,
    same_name_row_bonus: int = 0,
) -> int:
    """品牌词命中得分 + 同表重复出现小幅加成（多次上榜更易被观众看到）。"""
    blob = _s(product_name) + _s(producer_name)
    if not blob:
        return same_name_row_bonus
    brands = _brand_keywords_for_familiarity()
    matched: set[str] = set()
    for b in sorted(brands, key=len, reverse=True):
        b = _s(b)
        if len(b) < 2:
            continue
        if b in blob:
            matched.add(b)
    base = 0
    for b in matched:
        base += 14 + min(len(b), 10)
    return base + same_name_row_bonus


# ---------- 列名兼容 ----------
COL = {
    "notice": ("来源通告", "通告名称", "来源标题"),
    "product": ("问题对象/标题", "产品名称", "样品名称"),
    "producer": ("生产企业", "标称生产企业名称", "企业名称", "生产者名称"),
    "operator": ("经营企业", "被抽样单位名称", "经营者名称", "销售企业"),
    # 地域优先用生产企业省份，减少「注册人：xx市」类噪声落在「所在省份」
    "province": ("生产企业省份", "所在省份", "抽样单位省份", "省", "省份"),
    "issue_item": ("不符合规定项目/检查问题", "不合格项", "检验结论"),
    "problem_type": ("问题类型", "不合格类型", "通告类型"),
    "category": ("产品分类", "产品类别", "产品类"),
    "ptype": ("产品类型",),
    "sample_addr": ("被抽样单位地址", "抽样地点", "经营地址"),
}


def _pick_col(df: pd.DataFrame, keys: Sequence[str]) -> Optional[str]:
    for k in keys:
        if k in df.columns:
            return k
    return None


def _s(v: Any) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    t = str(v).strip()
    if t.lower() in ("nan", "none"):
        return ""
    return t


def _norm_newline(s: str) -> str:
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"\n+", "；", s)
    return s.strip()


def _unique_ordered(values: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for v in values:
        v = _norm_newline(v) if v else ""
        if not v or v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out


_PROV_PREFIX = re.compile(
    r"^(注册人|备案人|境内责任人|标称生产企业)[：:]\s*"
)


def _clean_province_label(raw: str) -> str:
    t = _s(raw)
    if not t:
        return ""
    t = _PROV_PREFIX.sub("", t)
    return t.strip()


def _top_provinces(series: pd.Series, max_show: int = 5) -> Tuple[List[str], str]:
    s = series.dropna().map(_clean_province_label)
    s = s[s.astype(str).str.strip() != ""]
    if s.empty:
        return [], ""
    vc = s.value_counts()
    names = list(vc.index[:max_show])
    bits = []
    for n in names[:3]:
        c = int(vc[n])
        bits.append(f"{n}（{c}条）")
    tail = "、".join(bits)
    if len(names) > 3:
        tail += "等"
    return names, tail


def _format_list_zh(items: List[str], max_items: int = 6) -> str:
    if not items:
        return ""
    head = items[:max_items]
    t = "、".join(head)
    if len(items) > max_items:
        t += "等"
    return t


def _short_for_voice(s: str, max_len: int = 72) -> str:
    t = _norm_newline(s) if s else ""
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"


def _raw_address_from_spot_field(spot_field: str) -> str:
    """从「抽样涉及「…」」类口播字段还原原始地址。"""
    t = _s(spot_field)
    if not t:
        return ""
    if t.startswith("抽样涉及「") and t.endswith("」"):
        return t[len("抽样涉及「") : -1]
    if t.startswith("经营端「") and t.endswith("」"):
        return t[len("经营端「") : -1]
    return t.strip("「」")


def _raw_address_from_legacy_经营(legacy: str) -> str:
    """兼容旧式 Rollup 字段：通报所列抽样/经营端（…）。"""
    t = _s(legacy)
    if t.startswith("通报所列抽样/经营端（") and t.endswith("）"):
        return t[len("通报所列抽样/经营端（") : -1]
    return t


def _region_for_sampling(addr: str) -> str:
    """从详细地址截取到地市一级，便于口播「在××抽检时」。"""
    addr = _s(addr)
    if not addr:
        return ""
    for pref in ("北京市", "上海市", "天津市", "重庆市"):
        if addr.startswith(pref):
            return pref
    m = re.match(r"^(.+?市)", addr)
    if m and len(m.group(1)) <= 24:
        return m.group(1)
    m = re.match(r"^(.+?盟)", addr)
    if m and len(m.group(1)) <= 24:
        return m.group(1)
    m = re.match(r"^(.+?自治州)", addr)
    if m and len(m.group(1)) <= 28:
        return m.group(1)
    if len(addr) <= 16:
        return addr
    return addr[:14] + "…"


def _issues_for_voice(issues: str, max_len: int = 96) -> str:
    """不合格项改为顿号朗读，与口播习惯一致。"""
    t = _norm_newline(issues).replace(";", "；").replace(",", "，")
    parts = re.split(r"[；;，,、\n]+", t)
    out: List[str] = []
    seen: set[str] = set()
    for p in parts:
        p = p.strip()
        if not p or p in seen:
            continue
        seen.add(p)
        out.append(p)
    u = "、".join(out)
    return _short_for_voice(u, max_len) if u else ""


def _fluent_product_line(
    prod: str,
    mfr: str,
    spot_field: str,
    legacy_经营: str,
    issues: str,
) -> str:
    """
    流畅口播一句：由××生产的××，在××抽检时，检出××。
    """
    prod, mfr = _s(prod), _s(mfr)
    raw = _raw_address_from_spot_field(spot_field) or _raw_address_from_legacy_经营(legacy_经营)
    region = _region_for_sampling(raw) if raw else ""
    issue_line = _issues_for_voice(issues)

    head = ""
    if mfr and prod:
        head = f"由{mfr}生产的{prod}"
    elif prod:
        head = prod
    elif mfr:
        head = f"{mfr}相关批次产品"
    else:
        head = "有关产品"

    if region:
        mid = f"在{region}抽检时"
    elif raw:
        mid = f"在抽样地（{_short_for_voice(raw, 22)}）抽检时"
    else:
        mid = "在通报所列抽检环节中"

    if issue_line:
        tail = f"检出{issue_line}"
    else:
        tail = "检出情况见通报原文"

    return f"{head}，{mid}，{tail}。"


def _row_completeness_score(
    row: pd.Series,
    c_product: Optional[str],
    c_issue: Optional[str],
    c_producer: Optional[str],
    c_operator: Optional[str],
    c_addr: Optional[str],
) -> int:
    score = 0
    if c_product and _s(row.get(c_product)):
        score += 2
    if c_issue and _s(row.get(c_issue)):
        score += 2
    if c_producer and _s(row.get(c_producer)):
        score += 1
    if c_operator and _s(row.get(c_operator)):
        score += 1
    elif c_addr and _s(row.get(c_addr)):
        score += 1
    return score


def _operator_hint(row: pd.Series, col_op: Optional[str], col_addr: Optional[str]) -> str:
    if col_op:
        v = _s(row.get(col_op, ""))
        if v:
            return v
    if col_addr:
        addr = _norm_newline(_s(row.get(col_addr, "")))
        if addr:
            # 地址过长时截断，避免口播拖沓
            if len(addr) > 36:
                addr = addr[:36] + "…"
            return f"通报所列抽样/经营端（{addr}）"
    return ""


@dataclass
class ProductSpotlight:
    """单条典型产品（用于口播列举）。"""

    产品: str
    生产企业: str = ""
    经营企业或抽样: str = ""
    不合格项: str = ""


@dataclass
class Rollup:
    """从表格聚合出的叙事要素（对应模板占位）。"""

    通告名列表: List[str] = field(default_factory=list)
    不合格类型列表: List[str] = field(default_factory=list)
    产品类列表: List[str] = field(default_factory=list)
    主要省份简述: str = ""
    省份前几名: List[str] = field(default_factory=list)
    记录条数: int = 0
    示例产品列表: List[ProductSpotlight] = field(default_factory=list)
    示例_生产企业: str = ""
    示例_经营企业: str = ""
    示例_产品: str = ""
    示例_不合格项: str = ""
    配图关键词建议: List[str] = field(default_factory=list)


def _spotlight_from_row(
    row: pd.Series,
    c_product: Optional[str],
    c_producer: Optional[str],
    c_operator: Optional[str],
    c_addr: Optional[str],
    c_issue: Optional[str],
) -> Optional[ProductSpotlight]:
    name = _s(row[c_product]) if c_product else ""
    if not name:
        return None
    op_raw = _operator_hint(row, c_operator, c_addr)
    op_out = ""
    if op_raw.startswith("通报所列抽样/经营端（"):
        inner = op_raw[len("通报所列抽样/经营端（") :].rstrip("）")
        op_out = f"抽样涉及「{inner}」"
    elif op_raw:
        op_out = f"经营端「{op_raw}」"
    return ProductSpotlight(
        产品=name,
        生产企业=_s(row[c_producer]) if c_producer else "",
        经营企业或抽样=op_out,
        不合格项=_norm_newline(_s(row[c_issue]) if c_issue else ""),
    )


def _pick_product_spotlights(
    df: pd.DataFrame,
    c_product: Optional[str],
    c_producer: Optional[str],
    c_operator: Optional[str],
    c_addr: Optional[str],
    c_issue: Optional[str],
    max_n: int,
) -> List[ProductSpotlight]:
    if df.empty or not c_product:
        return []
    max_n = max(1, min(max_n, 20))

    prod_counts = (
        df[c_product].map(_s).value_counts()
        if c_product in df.columns
        else pd.Series(dtype=int)
    )

    ranked: List[Tuple[int, int, int, str]] = []
    for i in range(len(df)):
        row = df.iloc[i]
        prod = _s(row.get(c_product, ""))
        if not prod:
            continue
        mfr = _s(row.get(c_producer, "")) if c_producer else ""
        comp = _row_completeness_score(
            row, c_product, c_issue, c_producer, c_operator, c_addr
        )
        n_same = int(prod_counts.get(prod, 1))
        freq_bonus = min(8, max(0, n_same - 1) * 2)
        fam = _familiarity_score(prod, mfr, freq_bonus)
        ranked.append((fam, comp, i, prod))

    # 知名度优先，其次字段完整度，再行号（稳定）
    ranked.sort(key=lambda x: (-x[0], -x[1], x[2]))

    picked_idx: List[int] = []
    seen_name: set[str] = set()

    for fam, sc, i, prod in ranked:
        if len(picked_idx) >= max_n:
            break
        if prod in seen_name:
            continue
        seen_name.add(prod)
        picked_idx.append(i)

    if len(picked_idx) < max_n:
        for fam, sc, i, prod in ranked:
            if len(picked_idx) >= max_n:
                break
            if i in picked_idx:
                continue
            picked_idx.append(i)

    out: List[ProductSpotlight] = []
    for i in picked_idx:
        sp = _spotlight_from_row(df.iloc[i], c_product, c_producer, c_operator, c_addr, c_issue)
        if sp:
            out.append(sp)
    return out[:max_n]


def _image_queries_from_spotlights(spots: List[ProductSpotlight], max_queries: int = 8) -> List[str]:
    kw: List[str] = []
    for sp in spots:
        if not sp.产品:
            continue
        kw.append(f"{sp.产品} 化妆品")
        kw.append(f"{sp.产品} 产品图")
        if len(kw) >= max_queries:
            break
    return _unique_ordered(kw)[:max_queries]


def rollup_from_dataframe(df: pd.DataFrame, max_spotlights: int = 6) -> Rollup:
    if df.empty:
        return Rollup()

    c_notice = _pick_col(df, COL["notice"])
    c_product = _pick_col(df, COL["product"])
    c_producer = _pick_col(df, COL["producer"])
    c_operator = _pick_col(df, COL["operator"])
    c_province = _pick_col(df, COL["province"])
    c_issue = _pick_col(df, COL["issue_item"])
    c_ptype = _pick_col(df, COL["problem_type"])
    c_cat = _pick_col(df, COL["category"])
    c_ptype2 = _pick_col(df, COL["ptype"])
    c_addr = _pick_col(df, COL["sample_addr"])

    notices = _unique_ordered([_s(x) for x in df[c_notice].tolist()]) if c_notice else []
    prob_types = _unique_ordered([_s(x) for x in df[c_ptype].tolist()]) if c_ptype else []
    cats: List[str] = []
    if c_cat:
        cats.extend([_s(x) for x in df[c_cat].tolist()])
    if c_ptype2:
        cats.extend([_s(x) for x in df[c_ptype2].tolist()])
    cats = _unique_ordered(cats)

    prov_names, prov_phrase = ([], "")
    if c_province:
        prov_names, prov_phrase = _top_provinces(df[c_province])

    spots = _pick_product_spotlights(
        df, c_product, c_producer, c_operator, c_addr, c_issue, max_spotlights
    )

    ex_prod = ex_mfr = ex_op = ex_issue = ""
    if spots:
        ex_prod = spots[0].产品
        ex_mfr = spots[0].生产企业
        for i in range(len(df)):
            row = df.iloc[i]
            if c_product and _s(row.get(c_product, "")) == ex_prod:
                ex_op = _operator_hint(row, c_operator, c_addr)
                if c_issue:
                    ex_issue = _norm_newline(_s(row.get(c_issue, "")))
                break
        if not ex_issue:
            ex_issue = spots[0].不合格项

    kw = _image_queries_from_spotlights(spots, max_queries=10)
    if c_cat and spots:
        for i in range(len(df)):
            if c_product and _s(df.iloc[i].get(c_product, "")) == spots[0].产品:
                if c_cat and _s(df.iloc[i].get(c_cat, "")):
                    kw.append(f"{_s(df.iloc[i].get(c_cat, ''))} 化妆品 实拍")
                break
    kw = _unique_ordered(kw)[:10]

    return Rollup(
        通告名列表=notices,
        不合格类型列表=prob_types,
        产品类列表=cats,
        主要省份简述=prov_phrase,
        省份前几名=prov_names,
        记录条数=len(df),
        示例产品列表=spots,
        示例_生产企业=ex_mfr,
        示例_经营企业=ex_op,
        示例_产品=ex_prod,
        示例_不合格项=ex_issue,
        配图关键词建议=kw,
    )


def _notice_count_safe(r: Rollup) -> int:
    return len(r.通告名列表)


def build_video_copy(r: Rollup) -> str:
    """按用户模板组织口播文案，并做轻度润色。"""
    n_notice = _format_list_zh(r.通告名列表, 4)
    n_prob = _format_list_zh(r.不合格类型列表, 8)
    n_cat = _format_list_zh(r.产品类列表, 8)
    prov = r.主要省份简述 or "多地"

    lines = [
        f"据本次资料梳理，共涉及通告 {_notice_count_safe(r)} 份、不合格记录 {r.记录条数} 条。",
        f"根据{n_notice}，本次共发现{n_prob}等情况，涵盖{n_cat}等品类，样本主要分布在{prov}。",
    ]

    if r.示例产品列表:
        n_sp = len(r.示例产品列表)
        lines.append(
            f"以下按通报节选 {n_sp} 个典型产品，口播时可按序号稍作停顿："
        )
        for k, sp in enumerate(r.示例产品列表, 1):
            line = _fluent_product_line(
                sp.产品,
                sp.生产企业,
                sp.经营企业或抽样,
                "",
                sp.不合格项,
            )
            lines.append(f"{k}. {line}")
    else:
        if r.示例_产品 or r.示例_生产企业 or r.示例_不合格项 or r.示例_经营企业:
            line = _fluent_product_line(
                r.示例_产品,
                r.示例_生产企业,
                "",
                r.示例_经营企业,
                r.示例_不合格项,
            )
            lines.append(f"以其中一例来说，{line}")

  
    return "\n".join(lines)


def bing_image_search_url(query: str) -> str:
    return f"https://www.bing.com/images/search?q={quote_plus(query)}"


def _image_url_looks_relevant(url: str, title: str) -> bool:
    u = url.lower()
    blob = u + (title or "").lower()
    junk = (
        "banner",
        "logo",
        "icon",
        "avatar",
        "_mob.",
        "zzzq_",
        "header-bg",
        "footer",
        "sprite",
        "qrcode",
        "weixin",
    )
    if any(x in blob for x in junk):
        return False
    if u.endswith((".svg", ".gif")):
        return False
    return True


def try_fetch_ddgs_images(queries: List[str], per_query: int = 3, max_total: int = 12) -> List[Dict[str, str]]:
    """尽力从 DuckDuckGo 拉取图片直链；失败返回空列表。"""
    out: List[Dict[str, str]] = []
    try:
        try:
            from ddgs import DDGS  # type: ignore  # 优先，避免 duckduckgo_search 重命名告警
        except Exception:
            from duckduckgo_search import DDGS  # type: ignore
    except Exception:
        return out

    def _pull(q: str) -> None:
        nonlocal out
        ddgs = DDGS()
        try:
            for img in ddgs.images(q, max_results=per_query):
                if len(out) >= max_total:
                    return
                url = img.get("image") or img.get("thumbnail") or ""
                if not url:
                    continue
                tit = str(img.get("title", ""))[:120]
                if not _image_url_looks_relevant(url, tit):
                    continue
                out.append(
                    {
                        "query": q,
                        "url": url,
                        "title": tit,
                        "source": str(img.get("source", "")),
                    }
                )
        finally:
            close = getattr(ddgs, "close", None)
            if callable(close):
                close()

    for q in queries:
        if not q or len(out) >= max_total:
            break
        try:
            _pull(q)
        except Exception:
            continue
    return out


def run(
    excel_path: str,
    out_dir: Optional[str],
    max_images: int,
    max_spotlights: int = 6,
) -> Dict[str, Any]:
    df = pd.read_excel(excel_path)
    r = rollup_from_dataframe(df, max_spotlights=max_spotlights)
    copy_text = build_video_copy(r)

    queries = list(r.配图关键词建议)
    if not queries and r.示例_产品:
        queries = [r.示例_产品, f"{r.示例_产品} 包装"]
    per_q = max(2, min(4, max_images // max(1, len(queries)) or max_images))
    images = try_fetch_ddgs_images(queries, per_query=per_q, max_total=max_images)

    bing_links = [{"query": q, "bing_images": bing_image_search_url(q)} for q in queries[:5]]

    payload = {
        "生成时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "源表格": os.path.abspath(excel_path),
        "聚合": asdict(r),
        "视频文案": copy_text,
        "网络图片_直链": images[:max_images],
        "必应图片搜索_备用链接": bing_links,
    }

    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        stem = os.path.splitext(os.path.basename(excel_path))[0]
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_path = os.path.join(out_dir, f"{stem}_auto_text_{ts}.json")
        txt_path = os.path.join(out_dir, f"{stem}_auto_text_{ts}.txt")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(copy_text)
            f.write("\n\n--- 配图检索 ---\n")
            for row in images[:max_images]:
                f.write(f"\n{row.get('url', '')}\n  关键词: {row.get('query', '')}\n")
            if not images:
                f.write("\n（未能自动抓取图片直链，请使用下列必应搜索链接手动打开）\n")
            for bl in bing_links:
                f.write(f"\n{bl['query']}\n  {bl['bing_images']}\n")
        print(f"已写入: {txt_path}\n已写入: {json_path}")

    return payload


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Excel 抽检数据 → 视频文案 + 配图检索")
    p.add_argument("excel", help="xlsx 路径")
    p.add_argument("-o", "--out", default=".", help="输出目录（生成 txt/json）")
    p.add_argument("--images", type=int, default=6, help="最多保留的图片直链条数")
    p.add_argument(
        "--products",
        type=int,
        default=6,
        metavar="N",
        help="口播中列举的典型产品条数（默认 6，建议 5～6）",
    )
    args = p.parse_args(argv)

    if not os.path.isfile(args.excel):
        print(f"文件不存在: {args.excel}", file=sys.stderr)
        return 1

    n_spot = max(1, min(args.products, 20))
    payload = run(args.excel, args.out, args.images, max_spotlights=n_spot)
    print("\n" + "=" * 60 + "\n")
    print(payload["视频文案"])
    print("\n" + "=" * 60 + "\n【网络图片直链】")
    for row in payload["网络图片_直链"]:
        print(row.get("url", ""))
    if not payload["网络图片_直链"]:
        print("（自动抓取失败或被限流，已写入必应图片搜索链接到输出文件）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
