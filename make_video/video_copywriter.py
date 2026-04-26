# -*- coding: utf-8 -*-
"""
产品抽检视频文案生成智能体 - 升级版
Product Inspection Video Copywriter Agent v2.0

新增功能：
1. 爆点评分系统（0-100分）
2. 爆款文案生成器（情绪化、口语化）
3. TOP分析功能
4. 保留原有7段式模板

作者：AI Assistant
版本：2.0.0
"""

import pandas as pd
import os
import re
import json
import time
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field, asdict
from urllib.parse import quote


@dataclass
class ProductRecord:
    """产品记录数据结构"""
    序号: int
    日期: str
    来源通告: str
    产品名称: str
    企业名称: str
    所在省份: str
    不符合项目: str
    产品类型: str
    问题类型: str
    产品分类: str
    检验结果: str
    依据要求: str
    包装规格: str
    标示批号: str
    企业地址: str
    被抽样单位地址: str
    
    @classmethod
    def from_dataframe_row(cls, row: pd.Series, index: int) -> 'ProductRecord':
        """从DataFrame行创建ProductRecord"""
        return cls(
            序号=index + 1,
            日期=str(row.get('日期', '')),
            来源通告=str(row.get('来源通告', '')),
            产品名称=str(row.get('问题对象/标题', '')),
            企业名称=str(row.get('企业名称', '')),
            所在省份=str(row.get('所在省份', '')),
            不符合项目=str(row.get('不符合规定项目/检查问题', '')),
            产品类型=str(row.get('产品类型', '')),
            问题类型=str(row.get('问题类型', '')),
            产品分类=str(row.get('产品分类', '')),
            检验结果=str(row.get('检验结果/处理措施', '')),
            依据要求=str(row.get('依据/规定要求', '')),
            包装规格=str(row.get('包装规格', '')),
            标示批号=str(row.get('标示批号', '')),
            企业地址=str(row.get('企业地址', '')),
            被抽样单位地址=str(row.get('被抽样单位地址', ''))
        )


@dataclass
class VideoScript:
    """视频文案数据结构"""
    产品名称: str
    企业名称: str
    关键词: str
    匹配数量: int
    
    # 基础信息
    问题陈述: str = ""
    检验数据: str = ""
    涉及地区: str = ""
    
    # 文案内容
    开场悬念句: str = ""
    问题详情: str = ""
    数据冲击: str = ""
    危害说明: str = ""
    涉及范围: str = ""
    消费警示: str = ""
    呼吁行动: str = ""
    
    # 完整文案
    完整文案: str = ""
    
    # 图片路径
    图片路径: Optional[str] = None
    
    # 元数据
    生成时间: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            "产品名称": self.产品名称,
            "企业名称": self.企业名称,
            "搜索关键词": self.关键词,
            "匹配记录数": self.匹配数量,
            "问题陈述": self.问题陈述,
            "检验数据": self.检验数据,
            "涉及地区": self.涉及地区,
            "开场悬念句": self.开场悬念句,
            "问题详情": self.问题详情,
            "数据冲击": self.数据冲击,
            "危害说明": self.危害说明,
            "涉及范围": self.涉及范围,
            "消费警示": self.消费警示,
            "呼吁行动": self.呼吁行动,
            "完整文案": self.完整文案,
            "图片路径": self.图片路径,
            "生成时间": self.生成时间
        }


@dataclass
class ViralRecord:
    """爆点记录数据结构"""
    排名: int
    爆点总分: float
    产品名称: str
    企业名称: str
    所在省份: str
    不符合项目: str
    检验结果: str
    问题类型: str
    产品分类: str
    
    # 各维度得分
    危害物质得分: int = 0
    知名品牌得分: int = 0
    反差感得分: int = 0
    问题类型得分: int = 0
    超标加成: float = 0.0
    检出数值: float = 0.0
    
    来源通告: str = ""
    
    def to_dict(self) -> Dict:
        return asdict(self)


class VideoCopywriter:
    """
    产品抽检视频文案生成智能体 v2.0
    
    新增功能：
    - analyze_viral_potential(): 分析所有记录的爆点潜力
    - generate_viral_script(): 生成爆款文案（情绪化、口语化）
    - get_top_records(): 获取TOP N爆点记录
    
    用法示例:
    >>> agent = VideoCopywriter('./用户上传/xxx.xlsx')
    >>> # 分析爆点
    >>> analysis = agent.analyze_all_records()
    >>> top10 = agent.get_top_records(10)
    >>> # 生成爆款文案
    >>> script = agent.generate_viral_script(top10[0])
    >>> # 或使用原有搜索方式
    >>> results = agent.search("祛痘 化妆品")
    >>> script = agent.generate_script(results)
    """
    
    # ====== 爆点评分系统 ======
    # 高危物质（危害等级从高到低）
    HIGHLY_DANGEROUS = {
        '氯霉素': 30, '甲硝唑': 28, '糖皮质激素': 35, '地塞米松': 35,
        '曲安奈德': 35, '雌三醇': 32, '雌二醇': 32, '雌酮': 32,
        '甲基睾酮': 33, '己烯雌酚': 33, '铅': 35, '汞': 35,
        '砷': 32, '铬': 28, '镉': 30, '邻苯二甲酸酯': 25,
        '苯': 30, '甲醇': 25,
    }
    
    DANGEROUS = {
        '黄体酮': 22, '米诺地尔': 25, '维甲酸': 20, '间氨基苯酚': 15,
        '邻氨基苯酚': 15, '甲苯': 20, '二噁烷': 22,
    }
    
    # 知名品牌关键词
    KNOWN_BRANDS = [
        '完美', '安利', '如新', '无限极', '玫琳凯', '自然堂', '欧诗漫', 
        '百雀羚', '相宜本草', '韩束', '一叶子', '珀莱雅', '丸美', '卡姿兰',
        '美肤宝', '法兰琳卡', '温碧泉', '韩后', '京润珍珠', '阿芙', '林清轩',
        '高姿', '透真', '瓷肌', '植美村', '柏氏', '花印', '肌研', '芙丽芳丝',
        '雅漾', '理肤泉', '薇姿', '贝德玛', '依泉', '丝塔芙', '珂润',
        '兰蔻', '雅诗兰黛', '资生堂', '兰芝', '雪花秀', '后',
        '小迷糊', '御泥坊', '膜法世家', '三生花', '同仁堂', '片仔癀', '马应龙',
    ]
    
    # 反差感关键词
    CONTRAST_KEYWORDS = [
        '草本', '本草', '纯天然', '天然', '植物', '温和', 
        '无添加', '有机', '绿色', '安全', '呵护', '宝宝', '婴童',
        '孕妇', '儿童', '敏感肌', '温和配方'
    ]
    
    # 问题类型权重
    PROBLEM_TYPE_WEIGHT = {
        '禁用/限用物质': 25,
        '微生物指标': 15,
        '成分比对': 12,
        '理化指标': 10,
        '其他问题': 5,
    }
    
    # 有害物质危害信息库
    HARMFUL_SUBSTANCES = {
        '甲硝唑': '甲硝唑是抗生素类药物，长期使用会导致细菌耐药性增加，引起过敏反应，孕妇使用可能导致胎儿畸形',
        '氯霉素': '氯霉素是广谱抗生素，长期使用会抑制骨髓造血功能，导致再生障碍性贫血，严重的可能致命',
        '地塞米松': '地塞米松是糖皮质激素，长期使用会导致皮肤变薄、激素依赖性皮炎，皮肤屏障受损',
        '曲安奈德': '曲安奈德是糖皮质激素，长期使用会导致皮肤萎缩、毛细血管扩张，激素依赖性皮炎',
        '糖皮质激素': '糖皮质激素长期使用会导致皮肤变薄、激素依赖性皮炎，皮肤屏障受损',
        '汞': '汞及其化合物具有毒性，长期使用会损伤神经系统、肝肾功能，导致皮肤色素沉着',
        '铅': '铅及其化合物有毒，会累积在体内损伤神经系统，影响儿童智力发育',
        '砷': '砷及其化合物有毒，是致癌物质，长期使用会损伤皮肤、肝肾和神经系统',
        '镉': '镉是重金属有毒物质，会损伤肾功能和骨骼',
        '苯酚': '苯酚有毒，会刺激皮肤和黏膜，高浓度可导致组织坏死',
        '氢醌': '氢醌是美白祛斑成分，但具有毒性，长期使用会导致皮肤色素紊乱和白斑',
        '维甲酸': '维甲酸是处方药成分，有致畸风险，孕妇禁用',
        '水杨酸': '水杨酸高浓度使用会刺激皮肤，导致角质层受损',
        '间苯二酚': '间苯二酚有毒，长期使用会刺激皮肤和黏膜',
        '二噁烷': '二噁烷是可疑致癌物，对皮肤和眼睛有刺激性',
        '酮康唑': '酮康唑是抗真菌药，具有肝脏毒性，需在医生指导下使用',
        '磺胺': '磺胺类药物是抗生素，可引起严重过敏反应，国家禁止添加',
        '林可霉素': '林可霉素是抗生素，长期使用会导致细菌耐药性',
        '三氯生': '三氯生可能干扰内分泌系统，影响甲状腺激素',
        '防腐剂': '防腐剂超标可能导致过敏、皮炎等问题',
        '微生物': '微生物超标使用可能导致皮肤感染，特别是破损皮肤',
        '菌落总数': '菌落总数超标表明产品受到污染，使用后可能引起皮肤感染',
        '铜绿假单胞菌': '铜绿假单胞菌是条件致病菌，可引起皮肤和眼部感染',
        '金黄色葡萄球菌': '金黄色葡萄球菌可引起皮肤化脓性感染',
        '荧光增白剂': '荧光增白剂可能刺激皮肤，长期使用有潜在致癌风险',
    }
    
    # 问题类型说明
    PROBLEM_EXPLANATIONS = {
        '禁用/限用物质': '检出国家禁止添加的成分',
        '成分比对': '实际成分与标签不符',
        '微生物指标': '微生物污染超标',
        '理化指标': '物理化学指标不合格',
        '其他问题': '存在其他质量问题',
    }
    
    def __init__(self, excel_path: str):
        """
        初始化智能体
        
        Args:
            excel_path: Excel文件路径
        """
        self.excel_path = excel_path
        self.df = None
        self.last_search_results: List[ProductRecord] = []
        self.last_script: Optional[VideoScript] = None
        self.viral_analysis: List[ViralRecord] = []
        self.output_dir = './video_copywriter/examples'
        
        self._load_data()
    
    def _load_data(self) -> None:
        """加载Excel数据"""
        if not os.path.exists(self.excel_path):
            raise FileNotFoundError(f"Excel文件不存在: {self.excel_path}")
        
        self.df = pd.read_excel(self.excel_path)
        print(f"✓ 数据加载完成，共 {len(self.df)} 条记录，{len(self.df.columns)} 个字段")
    
    # ====== 爆点评分系统核心方法 ======
    
    def _extract_hazard_score(self, hazard_text: str) -> int:
        """计算危害物质得分"""
        score = 0
        if pd.isna(hazard_text):
            return 0
        text = str(hazard_text)
        for substance, sc in self.HIGHLY_DANGEROUS.items():
            if substance in text:
                score = max(score, sc)
        for substance, sc in self.DANGEROUS.items():
            if substance in text:
                score = max(score, sc)
        return score
    
    def _check_brand(self, product_name: str) -> bool:
        """检查是否为知名品牌"""
        if pd.isna(product_name):
            return False
        name = str(product_name)
        for brand in self.KNOWN_BRANDS:
            if brand in name:
                return True
        return False
    
    def _check_contrast(self, product_name: str) -> bool:
        """检查是否有反差感"""
        if pd.isna(product_name):
            return False
        name = str(product_name)
        count = 0
        for kw in self.CONTRAST_KEYWORDS:
            if kw in name:
                count += 1
        return count >= 1
    
    def _extract_overflow_value(self, result_text: str) -> float:
        """提取超标数值"""
        if pd.isna(result_text):
            return 0
        text = str(result_text)
        # 匹配科学计数法 2.7×103 或 2.7×10³
        matches = re.findall(r'(\d+\.?\d*)[×x×]10(\d+)', text)
        if matches:
            values = [float(m[0]) * (10 ** int(m[1])) for m in matches]
            return max(values)
        # 匹配普通数值
        nums = re.findall(r'(\d+\.?\d*)\s*(?:mg/kg|μg/g|%)', text)
        if nums:
            return max([float(n) for n in nums])
        return 0
    
    def _calculate_exposure_score(self, row: pd.Series) -> int:
        """计算涉及面得分"""
        score = 0
        provinces = str(row.get('所在省份', ''))
        if provinces and provinces != 'nan':
            score += min(len(provinces) // 3, 10)
        return min(score, 15)
    
    def _calculate_viral_score(self, row: pd.Series) -> Tuple[float, Dict]:
        """计算单条记录的爆点分数"""
        hazard_score = self._extract_hazard_score(row.get('不符合规定项目/检查问题', ''))
        brand_score = 20 if self._check_brand(row.get('问题对象/标题', '')) else 0
        contrast_score = 15 if self._check_contrast(row.get('问题对象/标题', '')) else 0
        detect_value = self._extract_overflow_value(row.get('检验结果/处理措施', ''))
        problem_type_score = self.PROBLEM_TYPE_WEIGHT.get(row.get('问题类型', ''), 0)
        exposure_score = self._calculate_exposure_score(row)
        
        # 超标倍数加成
        overflow_bonus = min(detect_value / 1000, 20) if detect_value > 100 else 0
        
        # 总分
        total = hazard_score + brand_score + contrast_score + problem_type_score + exposure_score + overflow_bonus
        
        scores = {
            '危害物质得分': hazard_score,
            '知名品牌得分': brand_score,
            '反差感得分': contrast_score,
            '问题类型得分': problem_type_score,
            '超标加成': overflow_bonus,
            '检出数值': detect_value
        }
        
        return min(total, 100), scores
    
    def analyze_all_records(self) -> List[ViralRecord]:
        """
        分析所有记录的爆点潜力
        
        Returns:
            按爆点分数排序的记录列表
        """
        if self.df is None:
            raise ValueError("数据未加载")
        
        results = []
        
        for idx, row in self.df.iterrows():
            viral_score, scores = self._calculate_viral_score(row)
            
            record = ViralRecord(
                排名=0,  # 稍后填充
                爆点总分=round(viral_score, 1),
                产品名称=str(row.get('问题对象/标题', '')),
                企业名称=str(row.get('企业名称', '')),
                所在省份=str(row.get('所在省份', '')),
                不符合项目=str(row.get('不符合规定项目/检查问题', '')),
                检验结果=str(row.get('检验结果/处理措施', '')),
                问题类型=str(row.get('问题类型', '')),
                产品分类=str(row.get('产品分类', '')),
                来源通告=str(row.get('来源通告', '')),
                **scores
            )
            results.append(record)
        
        # 按爆点分数排序
        results.sort(key=lambda x: x.爆点总分, reverse=True)
        
        # 更新排名
        for i, r in enumerate(results, 1):
            r.排名 = i
        
        self.viral_analysis = results
        print(f"✓ 爆点分析完成，共 {len(results)} 条记录")
        
        return results
    
    def get_top_records(self, n: int = 10) -> List[ViralRecord]:
        """
        获取TOP N爆点记录
        
        Args:
            n: 返回前n条记录
            
        Returns:
            TOP N爆点记录列表
        """
        if not self.viral_analysis:
            self.analyze_all_records()
        
        return self.viral_analysis[:n]
    
    def save_top_analysis(self, n: int = 10, output_path: str = None) -> str:
        """
        保存TOP N分析报告
        
        Args:
            n: 保存前n条
            output_path: 输出路径
            
        Returns:
            保存的文件路径
        """
        if not self.viral_analysis:
            self.analyze_all_records()
        
        top_n = self.viral_analysis[:n]
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        if output_path is None:
            output_path = os.path.join(self.output_dir, "top_analysis.json")
        
        data = [r.to_dict() for r in top_n]
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✓ TOP{n}分析报告已保存到：{output_path}")
        return output_path
    
    def print_top_analysis(self, n: int = 10) -> None:
        """
        打印TOP N分析结果
        
        Args:
            n: 显示前n条
        """
        if not self.viral_analysis:
            self.analyze_all_records()
        
        top_n = self.viral_analysis[:n]
        
        print("\n" + "=" * 80)
        print(f"🔥 TOP{n} 爆点产品分析")
        print("=" * 80)
        
        for r in top_n:
            print(f"\n【第{r.排名}名】爆点分: {r.爆点总分}")
            print(f"  产品: {r.产品名称}")
            print(f"  企业: {r.企业名称}")
            print(f"  省份: {r.所在省份}")
            print(f"  不合格项目: {r.不符合项目}")
            print(f"  检验结果: {r.检验结果}")
            print(f"  问题类型: {r.问题类型}")
            print(f"  各维度得分: 危害{r.危害物质得分} | 品牌{r.知名品牌得分} | 反差{r.反差感得分} | 超标{r.超标加成:.1f}")
        
        print("\n" + "=" * 80)
    
    # ====== 爆款文案生成器 ======
    
    def generate_viral_script(self, record: ViralRecord, style: str = "震惊开场") -> VideoScript:
        """
        生成爆款视频文案
        
        Args:
            record: 爆点记录
            style: 文案风格 ('震惊开场' | '反问质疑' | '场景代入' | '数据冲击')
            
        Returns:
            生成的视频文案对象
        """
        script = VideoScript(
            产品名称=record.产品名称,
            企业名称=record.企业名称,
            关键词=f"爆点评分:{record.爆点总分}",
            匹配数量=1
        )
        
        # 根据风格选择文案生成方法
        if style == "震惊开场":
            script.完整文案 = self._generate_viral_style_1(record)
        elif style == "反问质疑":
            script.完整文案 = self._generate_viral_style_2(record)
        elif style == "场景代入":
            script.完整文案 = self._generate_viral_style_3(record)
        elif style == "数据冲击":
            script.完整文案 = self._generate_viral_style_4(record)
        else:
            script.完整文案 = self._generate_viral_style_1(record)
        
        self.last_script = script
        print(f"✓ 爆款文案生成完成，共 {len(script.完整文案)} 字")
        print(f"  预估朗读时长：约 {len(script.完整文案)//5} 秒")
        
        return script
    
    def _format_detect_value(self, result: str) -> str:
        """格式化检出值为口语化表达"""
        if not result or result == 'nan':
            return ""
        
        # 科学计数法转换
        match = re.search(r'(\d+\.?\d*)[×x×]10(\d+)', result)
        if match:
            num = float(match.group(1))
            exp = int(match.group(2))
            if exp >= 5:
                return f"{int(num * (10 ** exp) / 10000)}万"
            elif exp >= 4:
                return f"{int(num * (10 ** exp) / 1000)}万"
            elif exp >= 3:
                return f"{int(num * (10 ** exp))}"
            else:
                return f"{int(num * (10 ** exp))}"
        
        # 普通数字
        nums = re.findall(r'(\d+\.?\d*)', result.replace(',', ''))
        if nums:
            for num in nums:
                if float(num) > 100:
                    return str(int(float(num)))
        return result
    
    def _extract_hazard_info(self, hazard: str) -> Tuple[str, str]:
        """提取危害物质和危害说明"""
        if not hazard or hazard == 'nan':
            return "", ""
        
        text = str(hazard)
        hazards = []
        harm_descriptions = []
        
        for substance, harm in self.HARMFUL_SUBSTANCES.items():
            if substance in text:
                hazards.append(substance)
                harm_descriptions.append(harm.split('，')[0])  # 取第一句
        
        if not hazards:
            # 检查是否有微生物问题
            if '菌落总数' in text or '微生物' in text:
                hazards.append('微生物超标')
                harm_descriptions.append('可能导致皮肤感染')
            else:
                hazards.append('不合格成分')
                harm_descriptions.append('对身体健康有害')
        
        return '、'.join(hazards[:3]), '；'.join(harm_descriptions[:2])
    
    def _generate_viral_style_1(self, record: ViralRecord) -> str:
        """数据详述型"""
        hazards = record.不符合项目.replace("\n", "、")
        return f"国家药监局通报，{record.企业名称}生产的{record.产品名称}，检出{hazards}。上述物质为化妆品禁用原料。"

    def _generate_viral_style_2(self, record: ViralRecord) -> str:
        """检测数据型"""
        hazards = record.不符合项目.replace("\n", "、")
        return f"根据国家药监局通告，{record.企业名称}生产的{record.产品名称}，检出{hazards}。上述物质为化妆品禁用原料。"

    def _generate_viral_style_3(self, record: ViralRecord) -> str:
        """产品信息型"""
        hazards = record.不符合项目.replace("\n", "、")
        return f"国家药监局发布通告，{record.企业名称}生产的{record.产品名称}，检出{hazards}。上述物质属于化妆品禁用原料。"

    def _generate_viral_style_4(self, record: ViralRecord) -> str:
        """标准格式型"""
        hazards = record.不符合项目.replace("\n", "、")
        return f"{record.企业名称}生产的{record.产品名称}，经国家药监局抽检，检出{hazards}。上述物质为化妆品禁用原料。"

    
    def print_viral_script(self, script: VideoScript) -> None:
        """打印爆款文案"""
        print("\n" + "=" * 80)
        print("🔥 爆款视频文案")
        print("=" * 80)
        print(f"\n【产品】{script.产品名称}")
        print(f"【企业】{script.企业名称}")
        print(f"【风格】{script.关键词}")
        print("\n" + "-" * 80)
        print(script.完整文案)
        print("-" * 80)
        print(f"\n字数统计：约 {len(script.完整文案)} 字")
        print(f"预估朗读时长：约 {len(script.完整文案)//5} 秒")
        print("=" * 80)
    
    def save_viral_script(self, script: VideoScript = None, output_path: str = None) -> str:
        """保存爆款文案"""
        if script is None:
            script = self.last_script
        
        if script is None:
            raise ValueError("没有可保存的文案")
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = re.sub(r'[^\w\u4e00-\u9fff-]', '_', script.产品名称)[:30]
            output_path = os.path.join(self.output_dir, f"viral_{safe_name}_{timestamp}.txt")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("爆款视频文案\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"【产品名称】{script.产品名称}\n")
            f.write(f"【企业名称】{script.企业名称}\n")
            f.write(f"【文案风格】{script.关键词}\n")
            f.write(f"【生成时间】{script.生成时间}\n")
            f.write("\n" + "-" * 60 + "\n\n")
            f.write("【完整文案】\n\n")
            f.write(script.完整文案)
            f.write("\n\n" + "-" * 60 + "\n\n")
            f.write(f"字数统计：约 {len(script.完整文案)} 字\n")
            f.write(f"预估朗读时长：约 {len(script.完整文案)//5} 秒\n")
        
        print(f"✓ 爆款文案已保存到：{output_path}")
        return output_path
    
    # ====== 原有7段式文案生成器（保留）======
    
    def search(self, keywords: str) -> List[ProductRecord]:
        """搜索匹配的产品记录"""
        if self.df is None:
            raise ValueError("数据未加载")
        
        keywords = keywords.strip()
        if not keywords:
            raise ValueError("搜索关键词不能为空")
        
        keyword_list = keywords.split()
        
        search_fields = [
            '问题对象/标题',
            '不符合规定项目/检查问题',
            '企业名称',
            '产品分类',
            '问题类型',
            '检验结果/处理措施',
            '所在省份',
            '来源通告',
            '产品类型',
        ]
        
        mask = pd.Series([False] * len(self.df))
        
        for keyword in keyword_list:
            keyword_lower = keyword.lower()
            keyword_mask = pd.Series([False] * len(self.df))
            
            for field in search_fields:
                if field in self.df.columns:
                    field_values = self.df[field].astype(str).fillna('')
                    keyword_mask = keyword_mask | field_values.str.lower().str.contains(keyword_lower, na=False)
            
            mask = mask & keyword_mask if mask.any() else keyword_mask
        
        matched_df = self.df[mask].reset_index(drop=False)
        matched_df.columns = ['原始序号'] + list(self.df.columns)
        
        self.last_search_results = [
            ProductRecord.from_dataframe_row(row, idx) 
            for idx, (_, row) in enumerate(matched_df.iterrows())
        ]
        
        print(f"✓ 关键词 '{keywords}' 匹配到 {len(self.last_search_results)} 条记录")
        
        return self.last_search_results
    
    def get_record_summary(self, records: List[ProductRecord]) -> Dict:
        """获取记录汇总信息"""
        if not records:
            return {}
        
        unique_products = list(set(r.产品名称 for r in records))
        provinces = list(set(r.所在省份 for r in records if r.所在省份 != '/'))
        
        issues = []
        for r in records:
            issues.extend([i.strip() for i in r.不符合项目.split('\n') if i.strip() and i.strip() != '/'])
        unique_issues = list(set(issues))
        
        companies = list(set(r.企业名称 for r in records if r.企业名称 != '/'))
        batches = list(set(r.标示批号 for r in records if r.标示批号 != '/'))
        
        return {
            '产品数量': len(unique_products),
            '产品列表': unique_products,
            '涉及企业数': len(companies),
            '企业列表': companies,
            '涉及省份': provinces,
            '不符合项目': unique_issues,
            '记录总数': len(records),
            '批次信息': batches[:10],
        }
    
    def generate_script(self, records: List[ProductRecord] = None, 
                       keywords: str = "") -> VideoScript:
        """生成数据陈述型视频文案"""
        if records is None:
            records = self.last_search_results
        
        if not records:
            raise ValueError("没有可用的产品记录，请先进行搜索")
        
        main_record = records[0]
        
        script = VideoScript(
            产品名称=main_record.产品名称,
            企业名称=main_record.企业名称,
            关键词=keywords or "数据陈述",
            匹配数量=len(records)
        )
        
        # 生成数据陈述型文案
        script.完整文案 = self._generate_fact_script(records)
        
        self.last_script = script
        print(f"✓ 视频文案生成完成，共 {len(script.完整文案)} 字")
        
        return script
    
    def _generate_fact_script(self, records: List[ProductRecord]) -> str:
        """生成数据陈述型文案（60秒口播，150-200字）"""
        # 去重：按产品名称去重
        seen = set()
        unique_records = []
        for r in records:
            if r.产品名称 not in seen:
                seen.add(r.产品名称)
                unique_records.append(r)
        
        # 统计不符合项目，生成总起句
        hazard_keywords = {
            '抗生素': ['甲硝唑', '氯霉素', '磺胺', '酮康唑', '林可霉素', '四环素'],
            '激素': ['地塞米松', '曲安奈德', '氢化可的松', '泼尼松', '雌二醇', '雌三醇'],
            '重金属': ['汞', '铅', '砷', '镉', '铬'],
            '微生物': ['菌落总数', '霉菌', '酵母菌', '铜绿假单胞菌', '金黄色葡萄球菌'],
            '限用物质': ['水杨酸', '甲氧基肉桂酸', '防腐剂'],
        }
        
        hazard_counts = {}
        for r in records:
            text = r.不符合项目
            for category, keywords in hazard_keywords.items():
                for kw in keywords:
                    if kw in text:
                        hazard_counts[category] = hazard_counts.get(category, 0) + 1
        
        # 找出占比最多的类型
        if hazard_counts:
            top_category = max(hazard_counts, key=hazard_counts.get)
            category_names = {
                '抗生素': '抗生素类违禁物质',
                '激素': '激素类违禁物质', 
                '重金属': '重金属超标',
                '微生物': '微生物超标',
                '限用物质': '限用物质超标',
            }
            top_name = category_names.get(top_category, '违禁物质')
            summary_line = f"本次抽检发现，{top_name}问题最为突出。"
        else:
            summary_line = ""
        
        # 开场+总起句
        opening = f"国家药监局近期发布化妆品抽检通告，{summary_line}"
        
        # 正文：依次列出产品（最多3个）
        products_text = []
        for r in unique_records[:3]:
            hazards = r.不符合项目.replace('\n', '、').strip()
            if hazards and hazards != '/':
                text = f"{r.企业名称}生产的{r.产品名称}，检出{hazards}"
                products_text.append(text)
        
        main_text = "。".join(products_text) + "。"
        
        # 结尾：物质属性说明
        problem_types = list(set(r.问题类型 for r in records if r.问题类型 != '/'))
        if problem_types:
            attr_text = f"上述物质均为化妆品{problem_types[0]}。"
        else:
            attr_text = "上述物质均为化妆品禁用原料。"
        
        return opening + main_text + attr_text
    
    def _generate_opening(self, summary: Dict) -> str:
        """生成开场悬念句"""
        openings = [
            "紧急曝光！国家药监局刚刚发布最新抽检通告，{product_list}等多款热销产品被检出不合格，大家赶紧看看有没有你在用的！",
            "警告！{product_list}等知名产品被国家药监局点名通报，问题严重，千万别买！",
            "国家药监局重磅通报！这几款产品千万别用，已经被检出不合格，看完记得转发提醒家人！",
            "紧急提醒！市面上的{product_type}出事了，{product_list}等多款产品被检出问题，看完本文帮你避坑！",
        ]
        
        products = summary.get('产品列表', [])
        product_list = '、'.join(products[:3]) if products else '多款产品'
        product_type = summary.get('产品分类', ['化妆品'])[0] if summary.get('产品分类') else '化妆品'
        
        template = openings[0].format(product_list=product_list, product_type=product_type)
        
        return template
    
    def _generate_problem_statement(self, record: ProductRecord, summary: Dict) -> str:
        """生成问题陈述"""
        issues = []
        for i in record.不符合项目.split('\n'):
            if i.strip() and i.strip() != '/':
                issues.append(i.strip())
        
        issue_str = '、'.join(issues[:3]) if issues else '不合格成分'
        
        companies = summary.get('企业列表', [])
        company_list = '、'.join(companies[:2]) if companies else record.企业名称
        
        statements = [
            f"根据国家药监局最新通告，{company_list}生产的「{record.产品名称}」被检出含有{issue_str}，这些问题成分是国家明令禁止添加的！",
            f"国家药监局在对市面化妆品抽检时发现，{company_list}生产的「{record.产品名称}」不符合规定，问题项目为{issue_str}！",
            f"最新抽检结果显示，{company_list}旗下「{record.产品名称}」被查出{issue_str}，问题十分严重！",
        ]
        
        return statements[0]
    
    def _generate_data_impact(self, record: ProductRecord) -> str:
        """生成数据冲击"""
        result = record.检验结果.replace('\n', '，').replace('/', '')
        requirement = record.依据要求.replace('\n', '，').replace('/', '')
        
        data_part = ""
        if result and result != '/' and result.strip():
            numbers = re.findall(r'[\d.]+(?:×\d+)?\s*(?:mg/kg|μg/g|%|CFU|g)', result, re.IGNORECASE)
            if numbers:
                data_part = f"，检出{numbers[0]}"
            else:
                raw_numbers = re.findall(r'\d+(?:\.\d+)?', result)
                if raw_numbers:
                    for num in raw_numbers:
                        if float(num) > 10:
                            data_part = f"，检出{num}"
                            break
                    if not data_part and raw_numbers:
                        data_part = f"，检出{raw_numbers[0]}"
        
        req_part = ""
        if requirement and requirement != '/' and requirement.strip():
            req_part = f"，而国家标准要求{requirement}"
        
        if not data_part and not req_part:
            return "检测数据显示该产品不符合国家相关标准要求。问题相当严重！"
        
        return f"检测数据显示{data_part}{req_part}。这个问题相当严重！"
    
    def _generate_harm_description(self, record: ProductRecord) -> str:
        """生成危害说明"""
        matched_harms = []
        
        for r in self.last_search_results:
            issues_text = r.不符合项目.lower()
            for substance, harm in self.HARMFUL_SUBSTANCES.items():
                if substance.lower() in issues_text:
                    if harm not in matched_harms:
                        matched_harms.append(harm)
        
        if not matched_harms:
            matched_harms = ["长期使用这类不合格产品，可能导致皮肤过敏、皮炎，甚至更严重的健康问题"]
        
        harm_text = matched_harms[0]
        
        descriptions = [
            f"特别要提醒大家的是，{harm_text}，对身体健康危害极大！",
            f"专家特别警告：{harm_text}，这种成分长期积累在体内，后果不堪设想！",
            f"皮肤科医生特别提醒：{harm_text}，大家一定要重视起来！",
        ]
        
        return descriptions[0]
    
    def _generate_scope(self, record: ProductRecord, summary: Dict) -> str:
        """生成涉及范围"""
        provinces = summary.get('涉及省份', [])
        provinces_str = '、'.join(provinces[:5]) if provinces else record.所在省份
        
        batches = summary.get('批次信息', [])
        batch_count = len(batches)
        
        total_records = summary.get('记录总数', 1)
        
        scopes = [
            f"问题产品涉及多个地区，包括{provinces_str}等地，共发现{batch_count}个批次存在问题！",
            f"此次抽检覆盖范围广，抽样地区涉及{provinces_str}，共发现{total_records}批次不合格产品！",
            f"不合格产品流通范围包括{provinces_str}等多个省市，请大家立即自查！",
        ]
        
        return scopes[0]
    
    def _generate_warning(self, record: ProductRecord, summary: Dict) -> str:
        """生成消费警示"""
        products = summary.get('产品列表', [])
        product_list = '、'.join(products[:5]) if products else record.产品名称
        
        batch = record.标示批号 if record.标示批号 != '/' else ''
        
        warnings = [
            f"请立刻检查你的化妆品！如果发现「{product_list}」等产品，特别是标称批号为{batch}的，请立即停止使用！",
            f"重要提醒：正在使用这些产品「{product_list}」的朋友们，赶紧看看你家有没有，千万别再用了！",
            f"消费警示：大家在购买化妆品时，一定要通过正规渠道，对于「{product_list}」等被通报产品，一定要避开！",
        ]
        
        return warnings[0]
    
    def _generate_call_to_action(self) -> str:
        """生成呼吁行动"""
        calls = [
            "如果你身边有朋友在使用这些产品，请赶紧转发告诉他们！\n关注我们，获取更多消费预警信息，让更多人远离不合格产品！",
            "重要的事情说三遍：\n不要买！不要用！不要买！\n转发扩散，让更多人知道！",
            "赶紧检查一下你的化妆包，看看有没有这些产品！\n觉得有用的朋友，记得点赞、转发，让更多人看到！\n关注我，了解更多产品质量信息，保护你和家人的健康！",
        ]
        
        return calls[0]
    
    def _combine_script(self, script: VideoScript) -> str:
        """组合完整文案"""
        parts = [
            f"📢 {script.开场悬念句}\n",
            f"\n📋 问题详情：\n{script.问题详情}",
            f"\n📊 检测数据：\n{script.数据冲击}",
            f"\n⚠️ 健康危害：\n{script.危害说明}",
            f"\n🗺️ 涉及范围：\n{script.涉及范围}",
            f"\n🔔 消费警示：\n{script.消费警示}",
            f"\n{script.呼吁行动}",
        ]
        
        return '\n'.join(parts)
    
    # ====== 原有辅助方法（保留）======
    
    def search_images(self, product_name: str = None) -> List[str]:
        """搜索产品图片（需要外部工具配合）"""
        if product_name is None and self.last_script:
            product_name = self.last_script.产品名称
        
        if not product_name:
            print("⚠ 没有产品名称，无法生成搜索关键词")
            return []
        
        keywords = [
            product_name,
            f"{product_name} 化妆品",
            f"{product_name} 包装",
            product_name.replace('精华', '').replace('水', '').strip(),
        ]
        
        print(f"📷 图片搜索关键词建议：")
        for kw in keywords:
            print(f"   - {kw}")
        
        return keywords
    
    def save_script(self, script: VideoScript = None, output_path: str = None) -> str:
        """保存7段式文案"""
        if script is None:
            script = self.last_script
        
        if script is None:
            raise ValueError("没有可保存的文案")
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = re.sub(r'[^\w\u4e00-\u9fff-]', '_', script.产品名称)[:30]
            output_path = os.path.join(self.output_dir, f"{safe_name}_{timestamp}.txt")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("产品抽检视频文案\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"【产品名称】{script.产品名称}\n")
            f.write(f"【企业名称】{script.企业名称}\n")
            f.write(f"【搜索关键词】{script.关键词}\n")
            f.write(f"【匹配记录数】{script.匹配数量}\n")
            f.write(f"【生成时间】{script.生成时间}\n")
            f.write("\n" + "-" * 60 + "\n\n")
            f.write("【完整文案】\n\n")
            f.write(script.完整文案)
            f.write("\n\n" + "-" * 60 + "\n\n")
            f.write("【文案结构分析】\n")
            f.write(f"1. 开场悬念句：{script.开场悬念句}\n\n")
            f.write(f"2. 问题详情：{script.问题详情}\n\n")
            f.write(f"3. 数据冲击：{script.数据冲击}\n\n")
            f.write(f"4. 危害说明：{script.危害说明}\n\n")
            f.write(f"5. 涉及范围：{script.涉及范围}\n\n")
            f.write(f"6. 消费警示：{script.消费警示}\n\n")
            f.write(f"7. 呼吁行动：{script.呼吁行动}\n")
            
            if script.图片路径:
                f.write(f"\n【配图路径】{script.图片路径}\n")
        
        print(f"✓ 文案已保存到：{output_path}")
        return output_path
    
    def save_records(self, records: List[ProductRecord] = None, 
                     output_path: str = None) -> str:
        """保存搜索结果"""
        if records is None:
            records = self.last_search_results
        
        if not records:
            raise ValueError("没有可保存的记录")
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = os.path.join(self.output_dir, f"search_results_{timestamp}.xlsx")
        
        data = []
        for r in records:
            data.append({
                '序号': r.序号,
                '日期': r.日期,
                '产品名称': r.产品名称,
                '企业名称': r.企业名称,
                '所在省份': r.所在省份,
                '不符合项目': r.不符合项目,
                '产品类型': r.产品类型,
                '问题类型': r.问题类型,
                '产品分类': r.产品分类,
                '检验结果': r.检验结果,
                '包装规格': r.包装规格,
                '标示批号': r.标示批号,
            })
        
        df = pd.DataFrame(data)
        df.to_excel(output_path, index=False, engine='openpyxl')
        
        print(f"✓ 搜索结果已保存到：{output_path}")
        return output_path
    
    def output_all(self, output_dir: str = None) -> Dict[str, str]:
        """输出所有结果"""
        if output_dir:
            self.output_dir = output_dir
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        results = {}
        
        if self.last_script:
            script_path = self.save_script()
            results['script'] = script_path
        
        if self.last_search_results:
            records_path = self.save_records()
            results['records'] = records_path
        
        if self.last_search_results:
            summary = self.get_record_summary(self.last_search_results)
            summary_path = os.path.join(self.output_dir, "search_summary.json")
            with open(summary_path, 'w', encoding='utf-8') as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
            results['summary'] = summary_path
            print(f"✓ 汇总信息已保存到：{summary_path}")
        
        return results
    
    def print_records(self, records: List[ProductRecord] = None, 
                      max_rows: int = 10) -> None:
        """打印记录列表"""
        if records is None:
            records = self.last_search_results
        
        if not records:
            print("没有匹配的记录")
            return
        
        print("\n" + "=" * 80)
        print(f"搜索结果（共 {len(records)} 条）")
        print("=" * 80)
        
        for i, r in enumerate(records[:max_rows]):
            print(f"\n【{i+1}】{r.产品名称}")
            print(f"   企业：{r.企业名称}")
            print(f"   省份：{r.所在省份}")
            print(f"   问题：{r.不符合项目.replace(chr(10), '；')}")
            print(f"   分类：{r.产品分类} / {r.问题类型}")
            print(f"   检验：{r.检验结果.replace(chr(10), '；')}")
        
        if len(records) > max_rows:
            print(f"\n... 还有 {len(records) - max_rows} 条记录未显示")
        
        print("\n" + "=" * 80)
    
    def print_script(self, script: VideoScript = None) -> None:
        """打印文案"""
        if script is None:
            script = self.last_script
        
        if script is None:
            print("没有生成的文案")
            return
        
        print("\n" + "=" * 80)
        print("生成的视频文案")
        print("=" * 80)
        print(f"\n【产品】{script.产品名称}")
        print(f"【企业】{script.企业名称}")
        print(f"【匹配】{script.匹配数量} 条记录")
        print("\n" + "-" * 80)
        print(script.完整文案)
        print("-" * 80)
        print(f"\n字数统计：约 {len(script.完整文案)} 字")
        print(f"预估朗读时长：约 {len(script.完整文案)//5} 秒")
        print("=" * 80)
    
    def interactive_mode(self):
        """交互模式"""
        print("\n" + "=" * 60)
        print("  产品抽检视频文案生成智能体 v2.0")
        print("=" * 60)
        print("\n欢迎使用！请选择操作：")
        print("1. 爆点分析 - 分析所有记录的爆款潜力")
        print("2. 搜索生成 - 按关键词搜索并生成7段式文案")
        print("3. 爆款生成 - 基于爆点分析生成爆款文案")
        print("输入 'q' 退出\n")
        
        while True:
            try:
                user_input = input("\n请选择操作 (1/2/3/q): ").strip()
                
                if user_input.lower() in ['q', 'quit', 'exit']:
                    print("\n感谢使用，再见！")
                    break
                
                if user_input == '1':
                    self._interactive_viral_analysis()
                elif user_input == '2':
                    self._interactive_search()
                elif user_input == '3':
                    self._interactive_viral_generate()
                else:
                    print("请输入 1、2、3 或 q")
            
            except KeyboardInterrupt:
                print("\n\n感谢使用，再见！")
                break
    
    def _interactive_viral_analysis(self):
        """交互式爆点分析"""
        print("\n正在分析所有记录的爆点潜力...")
        analysis = self.analyze_all_records()
        self.print_top_analysis(10)
        
        # 询问是否保存
        save = input("\n是否保存TOP10分析报告? (y/n): ").strip().lower()
        if save in ['y', 'yes', '是']:
            self.save_top_analysis(10)
    
    def _interactive_search(self):
        """交互式搜索生成"""
        keywords = input("\n请输入搜索关键词: ").strip()
        if not keywords:
            print("关键词不能为空")
            return
        
        records = self.search(keywords)
        if not records:
            print("没有找到匹配的记录")
            return
        
        self.print_records(records)
        
        choice = input("\n是否生成7段式视频文案? (y/n): ").strip().lower()
        if choice in ['y', 'yes', '是']:
            script = self.generate_script(records, keywords)
            self.print_script(script)
            
            save = input("\n是否保存文案? (y/n): ").strip().lower()
            if save in ['y', 'yes', '是']:
                self.save_script()
    
    def _interactive_viral_generate(self):
        """交互式爆款生成"""
        if not self.viral_analysis:
            self.analyze_all_records()
        
        self.print_top_analysis(10)
        
        try:
            num = int(input("\n请选择要生成文案的排名 (1-10): ").strip())
            if num < 1 or num > 10:
                print("请输入1-10之间的数字")
                return
        except ValueError:
            print("请输入有效的数字")
            return
        
        record = self.viral_analysis[num - 1]
        
        print(f"\n选择的记录：{record.产品名称}")
        print("可选风格：")
        print("1. 震惊开场型")
        print("2. 反问质疑型")
        print("3. 场景代入型")
        print("4. 数据冲击型")
        
        style_choice = input("\n请选择风格 (1-4): ").strip()
        style_map = {'1': '震惊开场', '2': '反问质疑', '3': '场景代入', '4': '数据冲击'}
        style = style_map.get(style_choice, '震惊开场')
        
        script = self.generate_viral_script(record, style)
        self.print_viral_script(script)
        
        save = input("\n是否保存文案? (y/n): ").strip().lower()
        if save in ['y', 'yes', '是']:
            self.save_viral_script()


# ====== 演示代码 ======
if __name__ == "__main__":
    print("=" * 60)
    print("  产品抽检视频文案生成智能体 v2.0")
    print("=" * 60)
    
    excel_path = './不合格产品节点详情_年份·不符合项目_2024年_2026-04-25.xlsx'
    
    if os.path.exists(excel_path):
        agent = VideoCopywriter(excel_path)
        
        # 演示爆点分析
        print("\n--- 演示1：爆点分析 ---")
        agent.analyze_all_records()
        agent.print_top_analysis(5)
        
        # 演示爆款文案生成
        print("\n--- 演示2：爆款文案生成 ---")
        top3 = agent.get_top_records(3)
        for i, record in enumerate(top3):
            print(f"\n--- TOP{i+1} 爆款文案 ---")
            script = agent.generate_viral_script(record, "震惊开场")
            print(script.完整文案[:200] + "...")
            print(f"字数：{len(script.完整文案)}")
    else:
        print(f"Excel文件不存在: {excel_path}")
        print("请确保Excel文件路径正确")
