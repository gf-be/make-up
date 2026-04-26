# -*- coding: utf-8 -*-
"""
产品抽检视频文案生成智能体 - 示例脚本
演示如何使用 VideoCopywriter 智能体

运行方法:
    python demo.py [关键词]

示例:
    python demo.py 祛痘
    python demo.py 防晒
    python demo.py 微生物 面膜
"""

import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from video_copywriter import VideoCopywriter


def main():
    """主函数"""
    # Excel文件路径F:\daoke\化妆品\make_video\不合格产品节点详情_省份·产品类别·不符合项目_多选合并15个节点_2026-04-25.xlsx
    excel_path = "./不合格产品节点详情_省份·产品类别·不符合项目_多选合并15个节点_2026-04-25.xlsx"
    
    # 检查文件是否存在
    if not os.path.exists(excel_path):
        # 尝试其他路径
                   
        excel_path = "./不合格产品节点详情_省份·产品类别·不符合项目_多选合并15个节点_2026-04-25.xlsx"
    
    print("=" * 70)
    print("  产品抽检视频文案生成智能体 - 示例演示")
    print("=" * 70)
    
    # 创建智能体
    print(f"\n📂 正在加载数据: {excel_path}")
    agent = VideoCopywriter(excel_path)
    
    # 获取命令行参数作为搜索关键词
    if len(sys.argv) > 1:
        keywords = " ".join(sys.argv[1:])
    else:
        # 默认关键词
        keywords = "祛痘"
    
    print(f"\n🔍 搜索关键词: {keywords}")
    
    # 执行搜索
    records = agent.search(keywords)
    
    if not records:
        print("\n❌ 没有找到匹配的记录！")
        return
    
    # 显示搜索结果摘要
    summary = agent.get_record_summary(records)
    print(f"\n📊 搜索结果汇总:")
    print(f"   - 匹配记录数: {summary['记录总数']}")
    print(f"   - 产品数量: {summary['产品数量']}")
    print(f"   - 涉及企业: {summary['涉及企业数']}")
    print(f"   - 涉及地区: {', '.join(summary['涉及省份'][:5])}")
    
    # 显示前5条记录
    print(f"\n📋 前5条匹配记录:")
    agent.print_records(records, max_rows=5)
    
    # 生成视频文案
    print("\n" + "=" * 70)
    print("  生成视频文案")
    print("=" * 70)
    
    script = agent.generate_script(records, keywords)
    
    # 显示文案
    print(f"\n【产品】{script.产品名称}")
    print(f"【企业】{script.企业名称}")
    print(f"【匹配记录】{script.匹配数量} 条")
    print("\n" + "-" * 70)
    print(script.完整文案)
    print("-" * 70)
    
    # 字数统计
    word_count = len(script.完整文案)
    duration = word_count // 5  # 约5字/秒
    print(f"\n📝 字数统计: 约 {word_count} 字")
    print(f"⏱️ 预估朗读时长: 约 {duration} 秒 ({duration//60}分{duration%60}秒)")
    
    # 保存结果
    print("\n" + "=" * 70)
    print("  保存结果")
    print("=" * 70)
    
    results = agent.output_all()
    
    print("\n✅ 生成完成！输出文件:")
    for key, path in results.items():
        print(f"   [{key}] {path}")
    
    print("\n" + "=" * 70)
    print("  演示完成！")
    print("=" * 70)
    print("\n提示：")
    print("  1. 查看 ./examples/ 目录下的文案文件")
    print("  2. 使用 search_images() 方法获取产品图片搜索建议")
    print("  3. 交互模式: python video_copywriter.py")
    print("=" * 70)


if __name__ == "__main__":
    main()
