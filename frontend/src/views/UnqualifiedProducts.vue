<template>
  <div class="unqualified-products">
    <el-card class="page-card" shadow="never">
      <!-- <template #header>
        <div class="card-header">
            <div>
            <div class="page-title">不合格产品 / 飞检问题项</div>
            <div class="page-subtitle">将字段拖入「行标签」配置维度顺序（类似数据透视表）；树节点展示当前维度取值与 path，右侧按 path 查明细（支持勾选多 path 合并）。</div>
          </div>
          <el-tag type="danger" size="large">当前命中 {{ summary.matched_count || 0 }} 条</el-tag>
        </div>
      </template> -->

      <el-form :model="filters" class="filter-form" label-width="96px">
        <el-row :gutter="16">
          <!-- <el-col :span="6">
            <el-form-item label="综合关键词">
              <el-input v-model="filters.keyword" placeholder="搜索产品、企业、机构、标题" clearable @keyup.enter="handleSearch" />
            </el-form-item>
          </el-col> -->
          <el-col :span="6">
            <el-form-item label="企业关键词">
              <el-input v-model="filters.company_keyword" placeholder="搜索企业或被抽样单位" clearable @keyup.enter="handleSearch" />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="起始年份">
              <el-select v-model="filters.year_start" clearable filterable placeholder="不限" style="width: 100%">
                <el-option v-for="item in filterOptions.years" :key="`start-${item.value}`" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="结束年份">
              <el-select v-model="filters.year_end" clearable filterable placeholder="不限" style="width: 100%">
                <el-option v-for="item in filterOptions.years" :key="`end-${item.value}`" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <!-- <el-col :span="6">
            <el-form-item label="来源通告">
              <el-input v-model="filters.source_keyword" placeholder="搜索通告/飞检标题" clearable @keyup.enter="handleSearch" />
            </el-form-item>
          </el-col> -->
          <!-- <el-col :span="6">
            <el-form-item label="项目关键词">
              <el-input v-model="filters.unqualified_item" placeholder="如：菌落总数、甲硝唑" clearable @keyup.enter="handleSearch" />
            </el-form-item>
          </el-col> -->
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="不符合项目">
              <el-select
                v-model="filters.issue_items"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                clearable
                placeholder="选择一个或多个项目"
                style="width: 100%"
              >
                <el-option v-for="item in filterOptions.issue_items" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <!-- <el-col :span="4">
            <el-form-item label="产品分类">
              <el-select v-model="filters.product_category" clearable filterable placeholder="全部分类" style="width: 100%">
                <el-option v-for="item in filterOptions.product_categories" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col> -->
          <el-col :span="4">
            <el-form-item label="产品类型">
              <el-select v-model="filters.product_type" clearable placeholder="全部产品类型" style="width: 100%">
                <el-option v-for="item in filterOptions.product_types" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="通告类型">
              <el-select v-model="filters.announcement_type" clearable placeholder="全部通告类型" style="width: 100%">
                <el-option v-for="item in filterOptions.announcement_types" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <div class="filter-actions">
              <el-button type="primary" @click="handleSearch">搜索</el-button>
              <el-button @click="resetFilters">重置</el-button>
            </div>
          </el-col>
          <el-col :span="4">
            <el-form-item label="生产省份">
              <el-select v-model="filters.manufacturer_province" clearable filterable placeholder="全部生产省份" style="width: 100%">
                <el-option v-for="item in filterOptions.manufacturer_provinces" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="样品省份">
              <el-select v-model="filters.sampled_province" clearable filterable placeholder="全部样品省份" style="width: 100%">
                <el-option v-for="item in filterOptions.sampled_provinces" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- <el-row :gutter="16">
        
          
        </el-row> -->
      </el-form>

      <el-alert
        v-if="hasActiveFilters"
        type="info"
        :closable="false"
        show-icon
        class="mb-20"
        :title="`当前检索条件命中 ${summary.matched_count || 0} 条结果`"
      />

      <div class="result-summary mb-20">
        <el-tag type="danger" effect="dark">命中 {{ summary.matched_count || 0 }} 条</el-tag>
        <el-tag type="info">树根节点 {{ summary.root_count || treeRootCount || 0 }} 个</el-tag>
        <el-tag type="success">涉及生产省份 {{ summary.province_count || 0 }} 个</el-tag>
        <el-tag type="warning">当前详情 {{ pagination.total || 0 }} 条</el-tag>
        <el-tag v-if="activeYearLabel" type="warning">年份：{{ activeYearLabel }}</el-tag>
        <el-tag v-if="filters.announcement_id" type="warning">已锁定来源通告</el-tag>
        <el-tag v-if="filters.supervision_id" type="warning">已锁定飞检通告</el-tag>
      </div>

      <el-row :gutter="16" class="stats-row">
        <el-col :span="6">
          <div class="stat-card danger">
            <div class="stat-value">{{ stats.loaded_count || 0 }}</div>
            <div class="stat-label">已录入条目</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card primary">
            <div class="stat-value">{{ stats.source_count || 0 }}</div>
            <div class="stat-label">来源通告数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card success">
            <div class="stat-value">{{ stats.company_count || 0 }}</div>
            <div class="stat-label">涉及企业数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card warning">
            <div class="stat-value">{{ stats.issue_item_count || 0 }}</div>
            <div class="stat-label">可筛选问题项</div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="16" class="content-row">
        <el-col :span="8">
          <el-card shadow="never" class="tree-card" v-loading="treeLoading">
            <template #header>
              <div class="panel-header">
                <div>
                  <div class="panel-title">层级设计器</div>
                  <div class="panel-subtitle">从可选字段拖入「行标签」；自上而下最多 5 级，未选满则树随之变短。</div>
                </div>
                <div class="dimension-actions">
                  <el-button size="small" type="primary" @click="applyDimensionDraft">应用层级</el-button>
                  <el-button size="small" @click="resetDimensionDraft">重置</el-button>
                </div>
              </div>
            </template>

            <div class="tree-card-body-inner">
            <div v-if="recentAppliedDimensionPresets.length" class="dimension-history mb-20">
              <span class="dimension-history-label">最近应用</span>
              <el-button
                v-for="item in recentAppliedDimensionPresets"
                :key="item.key"
                size="small"
                text
                class="dimension-history-item"
                @click="applySavedDimensionPreset(item.order)"
              >
                {{ item.label }}
              </el-button>
              <el-button size="small" link type="danger" @click="clearAppliedDimensionHistory">清空记录</el-button>
            </div>

            <div class="pivot-dimension-designer mb-20">
              <div class="pivot-panel pivot-panel--pool">
                <div class="pivot-panel-head">
                  <span class="pivot-panel-title">可选字段</span>
                  <span class="pivot-panel-hint">拖到右侧「行标签」加入层级</span>
                </div>
                <div class="pivot-fields-pool">
                  <div
                    v-for="item in poolDimensions"
                    :key="`pool-${item.key}`"
                    class="pivot-field-chip"
                    draggable="true"
                    @dragstart="onPoolFieldDragStart($event, item.key)"
                    @dragend="onDimensionDragEnd"
                  >
                    <el-icon class="pivot-drag-icon"><Rank /></el-icon>
                    <span>{{ item.label }}</span>
                  </div>
                  <div v-if="!poolDimensions.length" class="pivot-pool-empty">全部字段已加入行标签</div>
                </div>
              </div>

              <div class="pivot-panel pivot-panel--rows">
                <div class="pivot-panel-head">
                  <span class="pivot-panel-title">行标签</span>
                  <span class="pivot-panel-hint">自上而下最多 5 级；可拖拽排序，未满则树高度变短</span>
                </div>
                <div
                  class="pivot-rows-drop"
                  :class="{ 'is-drag-over': rowDropZoneActive }"
                  @dragover.prevent="onRowZoneDragOver"
                  @dragleave="onRowZoneDragLeave"
                  @drop.prevent="onRowZoneDropEnd"
                >
                  <template v-if="!hierarchyRow.length">
                    <div class="pivot-rows-placeholder">从上方将字段拖入此处</div>
                  </template>
                  <div
                    v-for="(rowKey, index) in hierarchyRow"
                    :key="`row-${rowKey}-${index}`"
                    class="pivot-row-line"
                    :class="{ 'is-drag-over': rowInsertBeforeIndex === index }"
                    @dragover.prevent="onRowLineDragOver($event, index)"
                    @dragleave="onRowLineDragLeave"
                    @drop.prevent="onRowLineDrop($event, index)"
                  >
                    <div
                      class="pivot-row-item"
                      draggable="true"
                      @dragstart="onRowItemDragStart($event, index)"
                      @dragend="onDimensionDragEnd"
                    >
                      <el-icon class="pivot-drag-icon"><Rank /></el-icon>
                      <span class="pivot-row-item-label">{{ getDimensionLabel(rowKey) }}</span>
                      <el-tag size="small" type="info" effect="plain">第 {{ index + 1 }} 级</el-tag>
                      <el-button
                        link
                        type="danger"
                        class="pivot-row-remove"
                        :icon="Close"
                        aria-label="移除此级"
                        @click.stop="removeHierarchyAt(index)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="tree-section-head mb-20">
              <div>
                <div class="tree-section-title">分类</div>
                <!-- <div class="tree-section-subtitle">节点含当前维度取值与 path；勾选多个节点后右侧合并查询明细。搜索后树与筛选条件（含年份）一致。</div> -->
              </div>
              <div class="tree-section-tags">
                <el-tag v-if="activeYearLabel" type="warning" size="small">树数据年份 {{ activeYearLabel }}</el-tag>
                <el-tag type="info">共 {{ treeRootCount }} 个</el-tag>
              </div>
            </div>

            <div class="tree-scroll-area">
            <el-empty v-if="treeIsEmpty" description="暂无树形结果" />

            <el-tree
              v-else-if="treeListFetched && treeRootCount > 0"
              :key="`dim-tree-${treeRerenderKey}`"
              ref="treeRef"
              :data="treeData"
              lazy
              :load="loadTreeNode"
              :props="treeProps"
              node-key="key"
              show-checkbox
              check-strictly
              highlight-current
              :expand-on-click-node="false"
              @node-click="handleTreeNodeClick"
              @check="handleTreeCheck"
            >
              <template #default="{ data }">
                <div class="tree-node" @click.stop>
                  <div class="tree-node-main">
                    <span class="tree-node-label">{{ data.label }}</span>
                    <!-- <span class="tree-node-meta">{{ getDimensionLabel(data.dimension) }}</span> -->
                  </div>
                  <div class="tree-node-side">
                    <el-tag size="small" type="danger">{{ data.count }}</el-tag>
                  </div>
                </div>
              </template>
            </el-tree>
            </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="16">
          <el-card shadow="never" class="detail-card">
            <template #header>
              <div class="panel-header detail-card-header">
                <div>
                  <div class="panel-title">节点详情</div>
                  <div class="panel-subtitle">{{ currentNodeBreadcrumb || '请选择左侧树节点' }}</div>
                </div>
                <div v-if="currentNode" class="detail-card-header-actions">
                  <el-tag type="success">{{ pagination.total }} 条</el-tag>
                  <el-button
                    type="success"
                    plain
                    size="small"
                    @click="detailChartDialogVisible = true"
                  >
                    统计图表
                  </el-button>
                  <el-button
                    type="primary"
                    plain
                    size="small"
                    :loading="exportingNodeDetails"
                    :disabled="!nodeDetailsCanExport"
                    @click="exportNodeDetailsExcel"
                  >
                    导出 Excel
                  </el-button>
                  <el-button
                    type="warning"
                    plain
                    size="small"
                    :loading="generatingVideoCopy"
                    :disabled="!nodeDetailsCanExport"
                    @click="openVideoCopyDialog"
                  >
                    生成文案
                  </el-button>
                </div>
              </div>
            </template>

            <el-empty v-if="!currentNode" description="请选择左侧树节点查看详情" />

            <template v-else>
              <div class="selected-node-summary mb-20">
                <el-tag type="primary">{{ currentNode.label }}</el-tag>
                <el-tag>{{ getNodeLevelLabel(currentNode.level) }}</el-tag>
                <el-tag v-if="currentNode.source_publish_date" type="info">{{ currentNode.source_publish_date }}</el-tag>
                <el-tag v-if="currentNode.source_title" type="warning">{{ currentNode.source_title }}</el-tag>
              </div>

              <el-table :data="tableData" stripe border v-loading="tableLoading" max-height="1080">
                <el-table-column type="expand" width="50">
                  <template #default="{ row }">
                    <el-descriptions :column="2" border>
                      <el-descriptions-item label="来源标题">{{ row.source_title || row.batch_title || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="来源日期">{{ row.source_publish_date || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="产品类型">{{ row.product_type_label || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="通告类型">{{ row.announcement_type_label || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="生产企业名称">{{ row.manufacturer_name || row.company_names || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="生产企业地址">{{ row.manufacturer_address || row.company_addresses || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="经营企业名称">{{ row.operator_name || row.sample_unit_name || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="经营企业地址">{{ row.operator_address || row.sample_unit_address || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="原始标示企业">{{ row.company_names || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="原始企业地址">{{ row.company_addresses || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="包装规格">{{ row.package_spec || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="标示批号">{{ row.batch_no || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="标示生产日期">{{ row.production_date || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="限期使用日期/保质期">{{ row.expiry_date || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="所在地/进口地区">{{ row.product_region || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="生产企业省市">{{ [row.manufacturer_province, row.manufacturer_city].filter(Boolean).join(' / ') || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="样品省市">{{ [row.sampled_province, row.sampled_city].filter(Boolean).join(' / ') || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="注册/备案编号">{{ row.registration_no || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="生产许可证号">{{ row.production_license_no || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="问题类型">{{ row.issue_category || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="产品分类">{{ row.product_category || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="检验结果/处理措施" :span="2">{{ row.inspection_result || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="依据/规定要求" :span="2">{{ row.requirement || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="备注" :span="2">{{ row.remarks || '-' }}</el-descriptions-item>
                    </el-descriptions>
                  </template>
                </el-table-column>
                <el-table-column prop="source_publish_date" label="日期" width="120" />
                <el-table-column prop="source_title" label="来源通告" min-width="240" show-overflow-tooltip />
                <el-table-column prop="product_name" label="问题对象/标题" min-width="220" show-overflow-tooltip />
                <el-table-column prop="manufacturer_name" label="生产企业" min-width="220" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.manufacturer_name || row.company_names || '-' }}</template>
                </el-table-column>
                <el-table-column prop="operator_name" label="经营企业" min-width="200" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.operator_name || row.sample_unit_name || '-' }}</template>
                </el-table-column>
                <el-table-column prop="manufacturer_province" label="生产省份" width="120" show-overflow-tooltip />
                <el-table-column prop="manufacturer_city" label="生产城市" width="120" show-overflow-tooltip />
                <el-table-column prop="unqualified_items" label="不符合规定项目/检查问题" min-width="240" show-overflow-tooltip />
                <el-table-column label="操作" width="80" fixed="right">
                  <template #default="{ row }">
                    <el-button link type="primary" @click="viewDetail(row.id)">查看详情</el-button>
                    <el-button link type="success" @click="goSource(row)" style="margin-left: 0;">查看来源</el-button>
                    <el-button v-if="row.company_id" link type="warning" style="margin-left: 0;" @click="goCompany(row.company_id)">企业详情</el-button>
                  </template>
                </el-table-column>
              </el-table>

              <el-pagination
                :page-size="pagination.limit"
                :current-page="pagination.page"
                :total="pagination.total"
                :page-sizes="[10, 20, 50, 100, 200]"
                layout="total, sizes, prev, pager, next, jumper"
                class="pagination"
                @update:page-size="handlePageSizeChange"
                @update:current-page="handlePageChange"
              />
            </template>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <el-dialog
      v-model="detailChartDialogVisible"
      title="统计图表"
      width="min(1080px, 94vw)"
      height="min(400px, 94vh)"
      align-center
      append-to-body
      destroy-on-close
      class="detail-chart-dialog"
      @opened="onDetailChartDialogOpened"
      @closed="onDetailChartDialogClosed"
    >
      <div v-loading="detailChartDataLoading" class="detail-chart-dialog-body">
        <div class="detail-chart-toolbar">
          <el-select
            v-model="detailChartType"
            placeholder="图表类型"
            size="small"
            style="width: 120px"
          >
            <el-option label="柱状图" value="bar" />
            <el-option label="折线图" value="line" />
            <el-option label="饼图" value="pie" />
          </el-select>
          <el-select
            v-model="detailChartDimension"
            placeholder="统计字段"
            size="small"
            style="width: 220px"
            filterable
          >
            <el-option
              v-for="opt in NODE_DETAIL_CHART_FIELDS"
              :key="opt.key"
              :label="opt.label"
              :value="opt.key"
            />
          </el-select>
          <el-button size="small" :loading="detailChartDataLoading" @click="refreshDetailChartFullData">
            重新加载
          </el-button>
          <span class="detail-chart-hint">
            数据与右侧节点详情范围一致，已加载全量共 {{ detailChartAllRows.length }} 条（分页拉取），按所选字段分组计数
          </span>
        </div>
        <div ref="detailChartRef" class="detail-chart-canvas detail-chart-canvas--dialog" />
      </div>
    </el-dialog>

    <el-dialog
      v-model="videoCopyDialogVisible"
      title="视频文案"
      width="min(820px, 94vw)"
      align-center
      append-to-body
      destroy-on-close
    >
      <div v-loading="generatingVideoCopy" class="video-copy-dialog-body">
        <el-input
          v-model="videoCopyText"
          type="textarea"
          :rows="16"
          readonly
          resize="vertical"
          placeholder="点击“生成文案”后将在这里显示"
        />
      </div>
      <template #footer>
        <el-button @click="videoCopyDialogVisible = false">关闭</el-button>
        <el-button type="primary" :disabled="!videoCopyText" @click="copyVideoCopyText">复制文案</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ExcelJS from 'exceljs'
import * as echarts from 'echarts'
import { Close, Rank } from '@element-plus/icons-vue'
import {
  getUnqualifiedProductFilterOptions,
  getUnqualifiedProductCheckedTreeNodes,
  getUnqualifiedProductNodeDetails,
  getUnqualifiedProductStats,
  getUnqualifiedProductTree,
  getUnqualifiedProductTreeChildren,
  createOperationLog
} from '@/api/index'
import { currentUser } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const treeRef = ref(null)
/** 根节点全选/全消子节点时，避免级联 setCheckedKeys 触发的子节点 @check 重复拉明细 */
const syncingTreeCheckCascade = ref(false)
const treeRerenderKey = ref(0)
const treeLoading = ref(true)
/** 与维度树同一次 /tree 请求是否已结束，用于与懒加载的 data 空数组解耦 */
const treeListFetched = ref(false)
const pendingRootNodes = ref([])
const treeRootCount = ref(0)
const tableLoading = ref(false)
const exportingNodeDetails = ref(false)
const treeReloadTimer = ref(null)
const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: 'is_leaf'
}
/** 懒加载树：由 load 的 resolve 写内部 store，这里保持空数组即可 */
const treeData = ref([])
const tableData = ref([])

/** 节点详情表：可选作图表分类轴的字段（与表格列、行数据一致） */
const NODE_DETAIL_CHART_FIELDS = [
  { key: 'source_publish_date', label: '日期' },
  { key: 'source_title', label: '来源通告' },
  { key: 'product_name', label: '问题对象/标题' },
  { key: 'manufacturer_name', label: '生产企业' },
  { key: 'operator_name', label: '经营企业' },
  { key: 'manufacturer_province', label: '生产省份' },
  { key: 'manufacturer_city', label: '生产城市' },
  { key: 'sampled_province', label: '样品省份' },
  { key: 'sampled_city', label: '样品城市' },
  { key: 'unqualified_items', label: '不符合规定项目' },
  { key: 'product_type_label', label: '产品类型' },
  { key: 'announcement_type_label', label: '通告类型' },
  { key: 'product_category', label: '产品分类' },
  { key: 'issue_category', label: '问题类型' }
]

const detailChartDialogVisible = ref(false)
const detailChartType = ref('bar')
const detailChartDimension = ref('manufacturer_province')
const detailChartRef = ref(null)
/** 图表统计：与导出一致，为当前 path + 筛选下的全部分页明细 */
const detailChartAllRows = ref([])
const detailChartDataLoading = ref(false)
let detailChartInstance = null
const videoCopyDialogVisible = ref(false)
const videoCopyText = ref('')
const generatingVideoCopy = ref(false)

function formatDetailChartCategoryValue(raw) {
  if (raw == null || raw === '') return '(空)'
  if (typeof raw === 'object') {
    try {
      return JSON.stringify(raw)
    } catch {
      return String(raw)
    }
  }
  const s = String(raw).trim()
  return s || '(空)'
}

function aggregateDetailTableForChart(rows, dimensionKey) {
  const map = new Map()
  for (const row of rows || []) {
    const label = formatDetailChartCategoryValue(row?.[dimensionKey])
    map.set(label, (map.get(label) || 0) + 1)
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }))
}

const DETAIL_CHART_MAX_CATEGORIES = 24

function trimChartCategories(items, max = DETAIL_CHART_MAX_CATEGORIES) {
  if (items.length <= max) return items
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const head = sorted.slice(0, max - 1)
  const restSum = sorted.slice(max - 1).reduce((s, x) => s + x.value, 0)
  head.push({ name: `其他（${items.length - max + 1} 项）`, value: restSum })
  return head
}

function sortDetailChartItems(items, dimensionKey) {
  if (dimensionKey === 'source_publish_date') {
    return [...items].sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN', { numeric: true }))
  }
  return [...items].sort((a, b) => b.value - a.value)
}

function disposeDetailChart() {
  if (detailChartInstance) {
    detailChartInstance.dispose()
    detailChartInstance = null
  }
}

function resizeDetailChart() {
  detailChartInstance?.resize()
}

function buildDetailChartOption() {
  const rows = detailChartAllRows.value || []
  const dimensionKey = detailChartDimension.value
  const type = detailChartType.value
  let items = aggregateDetailTableForChart(rows, dimensionKey)
  if (type === 'pie') {
    items = trimChartCategories(sortDetailChartItems(items, dimensionKey))
  } else {
    items = sortDetailChartItems(items, dimensionKey).slice(0, DETAIL_CHART_MAX_CATEGORIES)
  }
  const names = items.map((x) => x.name)
  const values = items.map((x) => x.value)
  const labelText = NODE_DETAIL_CHART_FIELDS.find((f) => f.key === dimensionKey)?.label || dimensionKey

  if (type === 'pie') {
    return {
      color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
      tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 条 ({d}%)' },
      legend: { type: 'scroll', bottom: 0 },
      series: [
        {
          name: labelText,
          type: 'pie',
          radius: ['36%', '62%'],
          center: ['50%', '46%'],
          data: items.map((x) => ({ name: x.name, value: x.value })),
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' }
          }
        }
      ]
    }
  }

  const isLine = type === 'line'
  return {
    color: ['#5470c6'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '2%', right: '3%', bottom: names.length > 10 ? 64 : 40, top: 48, containLabel: true },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { rotate: names.length > 8 ? 32 : 0, interval: 0, hideOverlap: true }
    },
    yAxis: { type: 'value', minInterval: 1, name: '条数' },
    series: [
      {
        name: labelText,
        type: isLine ? 'line' : 'bar',
        data: values,
        smooth: isLine,
        barMaxWidth: 36,
        areaStyle: isLine ? { opacity: 0.06 } : undefined
      }
    ]
  }
}

function updateDetailChart() {
  if (!detailChartDialogVisible.value || !detailChartRef.value) {
    return
  }
  if (!detailChartInstance) {
    detailChartInstance = echarts.init(detailChartRef.value)
  }
  const opt = buildDetailChartOption()
  detailChartInstance.setOption(opt, true)
}

const currentNode = ref(null)
const currentNodeKey = ref('')
const DEFAULT_DIMENSION_ORDER = ['source', 'manufacturer_province', 'manufacturer_city', 'product_category', 'issue_item']
/** 上次在页面点击「应用层级」后写入，下次进入本页时自动恢复 */
const APPLIED_DIMENSION_ORDER_STORAGE_KEY = 'unqualifiedProducts.appliedDimensionOrder'
const APPLIED_DIMENSION_HISTORY_STORAGE_KEY = 'unqualifiedProducts.appliedDimensionHistory'
const APPLIED_DIMENSION_HISTORY_LIMIT = 8
const availableDimensions = ref([])
const dimensionOrder = ref([...DEFAULT_DIMENSION_ORDER])
const dimensionDraft = ref([...DEFAULT_DIMENSION_ORDER])
/** 行标签顺序（与数据透视表行字段一致），最多 5 项 */
const hierarchyRow = ref([...DEFAULT_DIMENSION_ORDER])
const appliedDimensionHistory = ref([])
const dragContext = ref(null)
const rowDropZoneActive = ref(false)
const rowInsertBeforeIndex = ref(null)
const stats = ref({})
const summary = ref({
  matched_count: 0,
  loaded_count: 0,
  source_count: 0,
  province_count: 0,
  root_count: 0
})
const filterOptions = ref({
  issue_items: [],
  product_categories: [],
  product_types: [],
  announcement_types: [],
  provinces: [],
  manufacturer_provinces: [],
  sampled_provinces: [],
  years: []
})
const filters = ref(createDefaultFilters())
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0
})
let treeRequestController = null
let detailRequestController = null

function clearTreeReloadTimer() {
  if (treeReloadTimer.value) {
    window.clearTimeout(treeReloadTimer.value)
    treeReloadTimer.value = null
  }
}

function cancelTreeRequest() {
  if (treeRequestController) {
    treeRequestController.abort()
    treeRequestController = null
  }
}

function cancelDetailRequest() {
  if (detailRequestController) {
    detailRequestController.abort()
    detailRequestController = null
  }
}

function isAbortError(error) {
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'
}

const treeIsEmpty = computed(() => treeListFetched.value && treeRootCount.value === 0)

const dimensionLabelMap = computed(() => {
  const map = {}
  const list = availableDimensions.value?.length ? availableDimensions.value : [
    { key: 'source', label: '来源编号' },
    { key: 'province', label: '综合省份' },
    { key: 'manufacturer_province', label: '生产企业省份' },
    { key: 'manufacturer_city', label: '生产企业城市' },
    { key: 'sampled_province', label: '样品省份' },
    { key: 'sampled_city', label: '样品城市' },
    { key: 'product_category', label: '产品类别' },
    { key: 'issue_item', label: '不符合项目' },
    { key: 'year', label: '年份' }
  ]
  list.forEach((item) => {
    map[item.key] = item.label
  })
  return map
})

function getDimensionLabel(key) {
  return dimensionLabelMap.value[key] || '维度'
}

const poolDimensions = computed(() => {
  const inRow = new Set(hierarchyRow.value)
  const list = availableDimensions.value?.length ? availableDimensions.value : [
    { key: 'source', label: '来源编号' },
    { key: 'province', label: '综合省份' },
    { key: 'manufacturer_province', label: '生产企业省份' },
    { key: 'manufacturer_city', label: '生产企业城市' },
    { key: 'sampled_province', label: '样品省份' },
    { key: 'sampled_city', label: '样品城市' },
    { key: 'product_category', label: '产品类别' },
    { key: 'issue_item', label: '不符合项目' },
    { key: 'year', label: '年份' }
  ]
  return list.filter((item) => !inRow.has(item.key))
})

const recentAppliedDimensionPresets = computed(() => (
  appliedDimensionHistory.value.map((order) => ({
    key: order.join('|'),
    order,
    label: order.map((key) => getDimensionLabel(key)).join(' / ')
  }))
))

function onPoolFieldDragStart(e, key) {
  dragContext.value = { source: 'pool', key }
  try {
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('text/plain', key)
  } catch (_) {
    /* ignore */
  }
}

function onRowItemDragStart(e, index) {
  const key = hierarchyRow.value[index]
  dragContext.value = { source: 'row', key, fromIndex: index }
  try {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
  } catch (_) {
    /* ignore */
  }
}

function onDimensionDragEnd() {
  dragContext.value = null
  rowDropZoneActive.value = false
  rowInsertBeforeIndex.value = null
}

function onRowZoneDragOver(e) {
  e.preventDefault()
  rowDropZoneActive.value = true
}

function onRowZoneDragLeave(e) {
  if (e.currentTarget?.contains?.(e.relatedTarget)) return
  rowDropZoneActive.value = false
}

function moveHierarchyItemToIndex(fromIndex, toIndex) {
  const arr = [...hierarchyRow.value]
  if (fromIndex < 0 || fromIndex >= arr.length) return
  if (fromIndex === toIndex) return
  const [item] = arr.splice(fromIndex, 1)
  let insertAt = toIndex
  if (fromIndex < insertAt) insertAt -= 1
  arr.splice(insertAt, 0, item)
  hierarchyRow.value = arr
}

function moveHierarchyToEnd(fromIndex) {
  const arr = [...hierarchyRow.value]
  if (fromIndex < 0 || fromIndex >= arr.length) return
  const [item] = arr.splice(fromIndex, 1)
  arr.push(item)
  hierarchyRow.value = arr
}

function onRowZoneDropEnd(e) {
  e.preventDefault()
  const ctx = dragContext.value
  if (!ctx) return
  if (ctx.source === 'pool') {
    if (hierarchyRow.value.length >= 4) return
    if (hierarchyRow.value.includes(ctx.key)) return
    hierarchyRow.value = [...hierarchyRow.value, ctx.key]
  } else if (ctx.source === 'row' && typeof ctx.fromIndex === 'number') {
    moveHierarchyToEnd(ctx.fromIndex)
  }
  onDimensionDragEnd()
}

function onRowLineDragOver(e, index) {
  e.preventDefault()
  rowInsertBeforeIndex.value = index
  rowDropZoneActive.value = false
}

function onRowLineDragLeave(e) {
  if (e.currentTarget?.contains?.(e.relatedTarget)) return
  rowInsertBeforeIndex.value = null
}

function onRowLineDrop(e, index) {
  e.preventDefault()
  e.stopPropagation()
  const ctx = dragContext.value
  if (!ctx) return
  if (ctx.source === 'pool') {
    if (hierarchyRow.value.length >= 4) {
      onDimensionDragEnd()
      return
    }
    if (hierarchyRow.value.includes(ctx.key)) {
      onDimensionDragEnd()
      return
    }
    const next = [...hierarchyRow.value]
    next.splice(index, 0, ctx.key)
    hierarchyRow.value = next
  } else if (ctx.source === 'row' && typeof ctx.fromIndex === 'number') {
    moveHierarchyItemToIndex(ctx.fromIndex, index)
  }
  onDimensionDragEnd()
}

function removeHierarchyAt(index) {
  hierarchyRow.value = hierarchyRow.value.filter((_, i) => i !== index)
}

function normalizeDimensionOrder(raw) {
  const allowed = new Set(['source', 'province', 'manufacturer_province', 'manufacturer_city', 'sampled_province', 'sampled_city', 'product_category', 'issue_item', 'year'])
  const list = Array.isArray(raw) ? raw : []
  const unique = []
  list.forEach((key) => {
    if (allowed.has(key) && !unique.includes(key) && unique.length < 5) {
      unique.push(key)
    }
  })
  return unique.length ? unique : [...DEFAULT_DIMENSION_ORDER]
}

function readSavedAppliedDimensionOrder() {
  try {
    const raw = localStorage.getItem(APPLIED_DIMENSION_ORDER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const normalized = normalizeDimensionOrder(Array.isArray(parsed) ? parsed : [])
    return normalized
  } catch {
    return null
  }
}

function persistAppliedDimensionOrder(order) {
  try {
    const normalized = normalizeDimensionOrder([...order])
    localStorage.setItem(APPLIED_DIMENSION_ORDER_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    /* ignore storage quota / private mode */
  }
}

function clearSavedAppliedDimensionOrder() {
  try {
    localStorage.removeItem(APPLIED_DIMENSION_ORDER_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function normalizeDimensionHistory(raw) {
  const list = Array.isArray(raw) ? raw : []
  const normalized = []
  list.forEach((item) => {
    const order = normalizeDimensionOrder(item)
    const signature = order.join('|')
    if (!normalized.find((saved) => saved.join('|') === signature)) {
      normalized.push(order)
    }
  })
  return normalized.slice(0, APPLIED_DIMENSION_HISTORY_LIMIT)
}

function readSavedAppliedDimensionHistory() {
  try {
    const raw = localStorage.getItem(APPLIED_DIMENSION_HISTORY_STORAGE_KEY)
    if (!raw) return []
    return normalizeDimensionHistory(JSON.parse(raw))
  } catch {
    return []
  }
}

function persistAppliedDimensionHistory(history) {
  try {
    const normalized = normalizeDimensionHistory(history)
    localStorage.setItem(APPLIED_DIMENSION_HISTORY_STORAGE_KEY, JSON.stringify(normalized))
    appliedDimensionHistory.value = normalized
  } catch {
    /* ignore storage quota / private mode */
  }
}

function pushAppliedDimensionHistory(order) {
  const normalized = normalizeDimensionOrder(order)
  const signature = normalized.join('|')
  const next = [
    normalized,
    ...appliedDimensionHistory.value.filter((item) => item.join('|') !== signature)
  ]
  persistAppliedDimensionHistory(next)
}

function clearAppliedDimensionHistory() {
  try {
    localStorage.removeItem(APPLIED_DIMENSION_HISTORY_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  appliedDimensionHistory.value = []
}

function syncDraftWithOrder(order) {
  const normalized = normalizeDimensionOrder(order)
  const next = ['', '', '', '']
  normalized.forEach((key, index) => {
    next[index] = key
  })
  dimensionDraft.value = next
  dimensionOrder.value = normalized
  hierarchyRow.value = [...normalized]
}

function applyDimensionDraft() {
  const order = normalizeDimensionOrder([...hierarchyRow.value])
  dimensionOrder.value = order
  syncDraftWithOrder(order)
  persistAppliedDimensionOrder(order)
  pushAppliedDimensionHistory(order)
  pagination.value.page = 1
  scheduleTreeReload()
}

function applySavedDimensionPreset(order) {
  hierarchyRow.value = [...normalizeDimensionOrder(order)]
  applyDimensionDraft()
}

function resetDimensionDraft() {
  clearSavedAppliedDimensionOrder()
  syncDraftWithOrder(DEFAULT_DIMENSION_ORDER)
  pagination.value.page = 1
  scheduleTreeReload()
}

function buildTreeRequestParams() {
  const base = buildBaseParams()
  return {
    ...base,
    year_start: String(base.year_start ?? '').trim(),
    year_end: String(base.year_end ?? '').trim(),
    dimension_order: JSON.stringify(dimensionOrder.value)
  }
}

function buildTreeChildrenRequestParams(parentPath = {}, parentLabels = {}) {
  return {
    ...buildTreeRequestParams(),
    parent_path: JSON.stringify(parentPath || {}),
    parent_labels: JSON.stringify(parentLabels || {})
  }
}

function createDefaultFilters() {
  return {
    keyword: '',
    company_keyword: '',
    source_keyword: '',
    unqualified_item: '',
    issue_items: [],
    product_category: '',
    product_type: '',
    announcement_type: '',
    province: '',
    manufacturer_province: '',
    sampled_province: '',
    year_start: '',
    year_end: '',
    announcement_id: '',
    supervision_id: ''
  }
}

function parseIssueItemsQuery(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch (error) {
    return String(value || '').split('|').map((item) => item.trim()).filter(Boolean)
  }
}

function applyRouteFilters() {
  const fallbackYear = String(route.query.year || '')
  filters.value = {
    ...createDefaultFilters(),
    keyword: String(route.query.keyword || ''),
    company_keyword: String(route.query.company_keyword || ''),
    source_keyword: String(route.query.source_keyword || ''),
    unqualified_item: String(route.query.unqualified_item || ''),
    issue_items: parseIssueItemsQuery(route.query.issue_items),
    product_category: String(route.query.product_category || ''),
    product_type: String(route.query.product_type || ''),
    announcement_type: String(route.query.announcement_type || ''),
    province: String(route.query.province || ''),
    manufacturer_province: String(route.query.manufacturer_province || ''),
    sampled_province: String(route.query.sampled_province || ''),
    year_start: String(route.query.year_start || fallbackYear || ''),
    year_end: String(route.query.year_end || fallbackYear || ''),
    announcement_id: String(route.query.announcement_id || ''),
    supervision_id: String(route.query.supervision_id || '')
  }
}

const hasActiveFilters = computed(() => Boolean(
  filters.value.keyword
  || filters.value.company_keyword
  || filters.value.source_keyword
  || filters.value.unqualified_item
  || (filters.value.issue_items || []).length
  || filters.value.product_category
  || filters.value.product_type
  || filters.value.announcement_type
  || filters.value.province
  || filters.value.manufacturer_province
  || filters.value.sampled_province
  || filters.value.year_start
  || filters.value.year_end
  || filters.value.announcement_id
  || filters.value.supervision_id
))

const activeYearLabel = computed(() => {
  const start = filters.value.year_start
  const end = filters.value.year_end
  if (start && end) return `${start}年 - ${end}年`
  if (start) return `${start}年起`
  if (end) return `截至${end}年`
  return ''
})

const currentNodeBreadcrumb = computed(() => {
  const node = currentNode.value
  if (!node) return ''

  const labels = node.path_labels || {}
  const order = dimensionOrder.value?.length ? dimensionOrder.value : DEFAULT_DIMENSION_ORDER
  const parts = []

  order.forEach((key) => {
    if (labels[key]) {
      parts.push(labels[key])
    }
  })

  if (parts.length) {
    return parts.join(' / ')
  }

  const path = node.path || {}
  return order.map((key) => path[key]).filter(Boolean).join(' / ')
})

const nodeDetailsCanExport = computed(() => (pagination.value.total || 0) > 0)

const VIDEO_COPY_PRODUCT_LIMIT = 6
const VIDEO_COPY_KNOWN_BRANDS = [
  '完美', '安利', '如新', '无限极', '玫琳凯', '自然堂', '欧诗漫',
  '百雀羚', '相宜本草', '韩束', '一叶子', '珀莱雅', '丸美', '卡姿兰',
  '美肤宝', '法兰琳卡', '温碧泉', '韩后', '京润珍珠', '阿芙', '林清轩',
  '高姿', '透真', '瓷肌', '植美村', '柏氏', '花印', '肌研', '芙丽芳丝',
  '雅漾', '理肤泉', '薇姿', '贝德玛', '依泉', '丝塔芙', '珂润',
  '兰蔻', '雅诗兰黛', '资生堂', '兰芝', '雪花秀', '后',
  '小迷糊', '御泥坊', '膜法世家', '三生花', '同仁堂', '片仔癀', '马应龙'
]

function copyTextValue(value) {
  if (value == null) return ''
  const text = String(value).trim()
  if (!text || ['nan', 'none', 'null', 'undefined'].includes(text.toLowerCase())) return ''
  return text
}

function normalizeCopyText(value) {
  return copyTextValue(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n+/g, '；').trim()
}

function uniqueCopyValues(values) {
  const seen = new Set()
  const out = []
  for (const raw of values || []) {
    const value = normalizeCopyText(raw)
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

function cleanProvinceLabel(raw) {
  console.log(raw)
  return copyTextValue(raw).replace(/^(注册人|备案人|境内责任人|标称生产企业)[：:]\s*/, '').trim()
}

function formatCopyList(items, max = 6) {
  const list = (items || []).filter(Boolean)
  if (!list.length) return ''
  const head = list.slice(0, max).join('、')
  return list.length > max ? `${head}等` : head
}

function topProvincePhrase(rows, maxShow = 5) {
  const counts = new Map()
  for (const row of rows || []) {
    const province = cleanProvinceLabel(row?.manufacturer_province || row?.product_region || row?.sampled_province)
    if (!province) continue
    counts.set(province, (counts.get(province) || 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxShow)
  if (!sorted.length) return ''
  const head = sorted.slice(0, 3).map(([name, count]) => `${name}（${count}条）`).join('、')
  return sorted.length > 3 ? `${head}等` : head
}

function shortForVoice(value, maxLen = 72) {
  const text = normalizeCopyText(value)
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text
}

function issuesForVoice(value, maxLen = 96) {
  const parts = normalizeCopyText(value)
    .replace(/;/g, '；')
    .replace(/,/g, '，')
    .split(/[；;，,、\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  return shortForVoice(uniqueCopyValues(parts).join('、'), maxLen)
}

function regionForSampling(rawAddress) {
  const address = copyTextValue(rawAddress)
  if (!address) return ''
  for (const city of ['北京市', '上海市', '天津市', '重庆市']) {
    if (address.startsWith(city)) return city
  }
  const cityMatch = address.match(/^(.+?市)/)
  if (cityMatch && cityMatch[1].length <= 24) return cityMatch[1]
  const leagueMatch = address.match(/^(.+?盟)/)
  if (leagueMatch && leagueMatch[1].length <= 24) return leagueMatch[1]
  const prefectureMatch = address.match(/^(.+?自治州)/)
  if (prefectureMatch && prefectureMatch[1].length <= 28) return prefectureMatch[1]
  return address.length <= 16 ? address : `${address.slice(0, 14)}…`
}

function extractProducerForVoice(companyNames) {
  const text = normalizeCopyText(companyNames)
  if (!text) return ''
  const patterns = [
    /(?:注册人\/生产企业|备案人\/生产企业|标称生产企业|生产企业|注册人|备案人)[：:]\s*([^，,；;\n]+)/,
    /(?:生产者|生产单位)[：:]\s*([^，,；;\n]+)/
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return text
}

function familiarityScore(productName, companyNames, sameNameRowBonus = 0) {
  const blob = `${copyTextValue(productName)}${copyTextValue(companyNames)}`
  if (!blob) return sameNameRowBonus
  const matched = new Set()
  for (const brand of [...VIDEO_COPY_KNOWN_BRANDS].sort((a, b) => b.length - a.length)) {
    if (brand.length < 2) continue
    if (blob.includes(brand)) matched.add(brand)
  }
  let score = sameNameRowBonus
  matched.forEach((brand) => {
    score += 14 + Math.min(brand.length, 10)
  })
  return score
}

function rowCompletenessScore(row) {
  let score = 0
  if (copyTextValue(row?.product_name)) score += 2
  if (copyTextValue(row?.unqualified_items)) score += 2
  if (copyTextValue(row?.manufacturer_name || row?.company_names)) score += 1
  if (copyTextValue(row?.operator_address || row?.sample_unit_address)) score += 1
  return score
}

function pickVideoCopyRows(rows, maxN = VIDEO_COPY_PRODUCT_LIMIT) {
  const productCounts = new Map()
  for (const row of rows || []) {
    const product = copyTextValue(row?.product_name)
    if (!product) continue
    productCounts.set(product, (productCounts.get(product) || 0) + 1)
  }

  const ranked = (rows || [])
    .map((row, index) => {
      const product = copyTextValue(row?.product_name)
      if (!product) return null
      const sameNameCount = productCounts.get(product) || 1
      const freqBonus = Math.min(8, Math.max(0, sameNameCount - 1) * 2)
      return {
        row,
        index,
        product,
        familiarity: familiarityScore(product, row?.manufacturer_name || row?.company_names, freqBonus),
        completeness: rowCompletenessScore(row)
      }
    })
    .filter(Boolean)
    .sort((a, b) => (
      b.familiarity - a.familiarity
      || b.completeness - a.completeness
      || a.index - b.index
    ))

  const picked = []
  const seenProducts = new Set()
  for (const item of ranked) {
    if (picked.length >= maxN) break
    if (seenProducts.has(item.product)) continue
    seenProducts.add(item.product)
    picked.push(item.row)
  }
  for (const item of ranked) {
    if (picked.length >= maxN) break
    if (picked.includes(item.row)) continue
    picked.push(item.row)
  }
  return picked
}

function buildVideoProductLine(row) {
  const product = copyTextValue(row?.product_name)
  const producer = extractProducerForVoice(row?.manufacturer_name || row?.company_names)
  const region = regionForSampling(row?.operator_address)
    || regionForSampling(row?.sample_unit_address)
    || regionForSampling(row?.sampled_province)
    || cleanProvinceLabel(row?.product_region)
  const issues = issuesForVoice(row?.unqualified_items)

  const head = producer && product
    ? `由${producer}生产的${product}`
    : (product || (producer ? `${producer}相关批次产品` : '有关产品'))
  const middle = region ? `在${region}抽检时` : '在通报所列抽检环节中'
  const tail = issues ? `检出${issues}不符合要求` : '检出情况见通报原文'
  return `${head}，${middle}，${tail}。`
}

function buildVideoCopyText(rows) {
  const sourceTitles = uniqueCopyValues((rows || []).map((row) => row?.source_title || row?.batch_title))
  const problemTypes = uniqueCopyValues((rows || []).map((row) => row?.issue_category || row?.announcement_type_label))
  const categories = uniqueCopyValues((rows || []).flatMap((row) => [row?.product_category, row?.product_type_label]))
  const provincePhrase = topProvincePhrase(rows) || '多地'
  const selectedRows = pickVideoCopyRows(rows, VIDEO_COPY_PRODUCT_LIMIT)

  const lines = [
    `据本次资料梳理，共涉及通告 ${sourceTitles.length} 份、不合格记录 ${(rows || []).length} 条。`,
    `根据${formatCopyList(sourceTitles, 4)}，本次共发现${formatCopyList(problemTypes, 8)}等情况，涵盖${formatCopyList(categories, 8)}等品类，样本主要分布在${provincePhrase}。`
  ]

  if (selectedRows.length) {
    lines.push(`以下按通报节选 ${selectedRows.length} 个典型产品，口播时可按序号稍作停顿：`)
    selectedRows.forEach((row, index) => {
      lines.push(`${index + 1}. ${buildVideoProductLine(row)}`)
    })
  }

  return lines.join('\n')
}

function buildCurrentDimensionLabel() {
  const order = dimensionOrder.value?.length ? dimensionOrder.value : DEFAULT_DIMENSION_ORDER
  return order.map((key) => getDimensionLabel(key)).join(' > ')
}

function buildCurrentRangeLabel() {
  const labels = []
  if (currentNode.value?.label) {
    labels.push(currentNode.value.label)
  }
  const checkedNodes = treeRef.value?.getCheckedNodes?.() || []
  if (checkedNodes.length) {
    labels.push(`勾选 ${checkedNodes.length} 个节点`)
  }
  return labels.join('；') || '当前维度树范围'
}

async function recordVideoCopyLog(rows, copyText) {
  if (currentUser.value?.role !== 'normal_user') return
  try {
    await createOperationLog({
      action: 'generate_video_copy',
      module: 'unqualified_products',
      details: {
        dimension_label: buildCurrentDimensionLabel(),
        dimension_order: dimensionOrder.value || [],
        range_label: buildCurrentRangeLabel(),
        detail_count: rows.length,
        copy_text: copyText || ''
      }
    })
  } catch (error) {
    console.error('记录文案生成日志失败:', error)
  }
}

async function openVideoCopyDialog() {
  const pathsPayload = getNodeDetailsPathsPayload()
  if (!pathsPayload.length) {
    ElMessage.warning('没有可生成文案的范围，请先在维度树选择节点')
    return
  }
  if (!(pagination.value.total > 0)) {
    ElMessage.warning('当前没有可生成文案的明细')
    return
  }
  generatingVideoCopy.value = true
  videoCopyDialogVisible.value = true
  try {
    const rows = await fetchAllNodeDetailRows(pathsPayload)
    if (!rows.length) {
      videoCopyText.value = ''
      ElMessage.warning('当前范围没有可生成文案的明细')
      return
    }
    videoCopyText.value = buildVideoCopyText(rows)
    await recordVideoCopyLog(rows, videoCopyText.value)
  } catch (error) {
    console.error('生成视频文案失败:', error)
    ElMessage.error(error?.message || '生成视频文案失败')
    videoCopyText.value = ''
  } finally {
    generatingVideoCopy.value = false
  }
}

async function copyVideoCopyText() {
  if (!videoCopyText.value) return
  try {
    await navigator.clipboard.writeText(videoCopyText.value)
    ElMessage.success('文案已复制')
  } catch (error) {
    console.error('复制文案失败:', error)
    ElMessage.error('复制失败，请手动选择文本复制')
  }
}

function buildBaseParams() {
  return {
    ...filters.value,
    issue_items: filters.value.issue_items || []
  }
}

async function loadStats() {
  try {
    const res = await getUnqualifiedProductStats()
    stats.value = res.data || {}
  } catch (error) {
    console.error('加载统计信息失败:', error)
  }
}

async function loadFilterOptions() {
  try {
    const res = await getUnqualifiedProductFilterOptions()
    filterOptions.value = res.data || filterOptions.value
  } catch (error) {
    console.error('加载筛选项失败:', error)
  }
}

function flattenTreeNodes(nodes = []) {
  const result = []
  nodes.forEach((node) => {
    result.push(node)
    if (node.children?.length) {
      result.push(...flattenTreeNodes(node.children))
    }
  })
  return result
}

function mapTreeItemFromApi(item) {
  if (!item) return item
  return {
    ...item,
    is_leaf: Boolean(item.is_leaf)
  }
}

/** 懒加载子节点插入后：父已勾选则子节点在界面上也显示为勾选（与 handleTreeCheck 级联一致） */
function syncCheckedKeysAfterLazyChildrenLoaded(parentData, childrenList) {
  const tree = treeRef.value
  if (!tree || !parentData || parentData.key == null) return
  const checked = new Set(tree.getCheckedKeys(false) || [])
  if (!checked.has(parentData.key)) return
  const childKeys = (childrenList || [])
    .map((c) => c?.key)
    .filter((k) => k != null)
  if (!childKeys.length) return
  let changed = false
  for (const k of childKeys) {
    if (!checked.has(k)) {
      checked.add(k)
      changed = true
    }
  }
  if (!changed) return
  syncingTreeCheckCascade.value = true
  try {
    tree.setCheckedKeys([...checked])
  } finally {
    nextTick(() => {
      syncingTreeCheckCascade.value = false
    })
  }
}

function loadTreeNode(node, resolve) {
  if (node.level === 0) {
    const roots = Array.isArray(pendingRootNodes.value) ? pendingRootNodes.value : []
    resolve(roots)
    nextTick(async () => {
      const initial = pickInitialNode(roots)
      if (!initial) {
        currentNode.value = null
        currentNodeKey.value = ''
        tableData.value = []
        pagination.value.total = 0
        return
      }
      currentNode.value = initial
      currentNodeKey.value = initial.key
      treeRef.value?.setCurrentKey(initial.key)
      treeRef.value?.setCheckedKeys([])
      pagination.value.page = 1
      await loadNodeDetails()
    })
    return
  }

  const data = node.data
  if (!data || data.is_leaf) {
    resolve([])
    return
  }
  getUnqualifiedProductTreeChildren(
    buildTreeChildrenRequestParams(data.path, data.path_labels || {})
  )
    .then((res) => {
      const list = (res.data || []).map(mapTreeItemFromApi)
      resolve(list)
      nextTick(() => {
        syncCheckedKeysAfterLazyChildrenLoaded(data, list)
      })
    })
    .catch((err) => {
      if (isAbortError(err)) {
        resolve([])
        return
      }
      console.error('展开树节点失败:', err)
      resolve([])
    })
}

function pickInitialNode(nodes = []) {
  const flatNodes = flattenTreeNodes(nodes)
  if (filters.value.announcement_id) {
    const match = flatNodes.find((node) => {
      const composite = String(node.path?.source || '')
      return composite === `announcement:${filters.value.announcement_id}`
    })
    if (match) return match
  }
  if (filters.value.supervision_id) {
    const match = flatNodes.find((node) => {
      const composite = String(node.path?.source || '')
      return composite === `supervision:${filters.value.supervision_id}`
    })
    if (match) return match
  }
  return flatNodes[0] || null
}

function scheduleTreeReload(delay = 180) {
  clearTreeReloadTimer()
  treeReloadTimer.value = window.setTimeout(() => {
    treeReloadTimer.value = null
    loadTree()
  }, delay)
}

async function loadTree() {
  clearTreeReloadTimer()
  cancelTreeRequest()
  cancelDetailRequest()
  treeRequestController = new AbortController()
  treeLoading.value = true
  try {
    const res = await getUnqualifiedProductTree(buildTreeRequestParams(), {
      signal: treeRequestController.signal
    })
    const rawRoots = res.data || []
    pendingRootNodes.value = rawRoots.map(mapTreeItemFromApi)
    summary.value = res.summary || summary.value
    treeRootCount.value = Number(
      summary.value?.root_count ?? rawRoots.length
    ) || 0
    availableDimensions.value = res.available_dimensions || availableDimensions.value

    const serverOrder = normalizeDimensionOrder(res.dimension_order)
    dimensionOrder.value = serverOrder
    syncDraftWithOrder(serverOrder)

    treeRerenderKey.value += 1
    treeListFetched.value = true
  } catch (error) {
    if (isAbortError(error)) {
      return
    }
    console.error('加载树形数据失败:', error)
    pendingRootNodes.value = []
    treeRootCount.value = 0
    treeRerenderKey.value += 1
    currentNode.value = null
    currentNodeKey.value = ''
    tableData.value = []
    pagination.value.total = 0
    treeListFetched.value = true
  } finally {
    treeRequestController = null
    treeLoading.value = false
  }
}

/** 与详情表、导出共用：勾选多 path 合并，否则用当前节点 path */
function getNodeDetailsPathsPayload() {
  const checkedNodes = treeRef.value?.getCheckedNodes?.() || []
  const pathsFromChecks = (checkedNodes.length ? checkedNodes : [])
    .map((node) => node?.path)
    .filter((path) => path && typeof path === 'object')
  const activePath = currentNode.value?.path
  return pathsFromChecks.length > 0 ? pathsFromChecks : (activePath ? [activePath] : [])
}

function getCheckedTreePathsPayload() {
  return (treeRef.value?.getCheckedNodes?.() || [])
    .map((node) => node?.path)
    .filter((path) => path && typeof path === 'object')
}

/** 分页拉取当前 path + 筛选下的节点详情全量（与导出 Excel 一致） */
async function fetchAllNodeDetailRows(pathsPayload, initialTotal = null) {
  const pageSize = 200
  const allRows = []
  let page = 1
  let total = initialTotal != null ? Number(initialTotal) : (Number(pagination.value.total) || 0)
  if (!pathsPayload?.length || total <= 0) {
    return []
  }
  while (allRows.length < total) {
    const res = await getUnqualifiedProductNodeDetails({
      ...buildTreeRequestParams(),
      page,
      limit: pageSize,
      paths: pathsPayload
    })
    const chunk = res.data || []
    allRows.push(...chunk)
    total = res.pagination?.total ?? total
    if (chunk.length === 0) {
      break
    }
    page += 1
    if (page > 2000) {
      break
    }
  }
  return allRows
}

async function refreshDetailChartFullData() {
  if (!detailChartDialogVisible.value) return
  const pathsPayload = getNodeDetailsPathsPayload()
  if (!pathsPayload.length || !(pagination.value.total > 0)) {
    detailChartAllRows.value = []
    detailChartDataLoading.value = false
    await nextTick()
    if (detailChartDialogVisible.value) {
      updateDetailChart()
      resizeDetailChart()
    }
    return
  }
  detailChartDataLoading.value = true
  try {
    const rows = await fetchAllNodeDetailRows(pathsPayload)
    if (!detailChartDialogVisible.value) {
      detailChartAllRows.value = []
      return
    }
    detailChartAllRows.value = rows
  } catch (e) {
    console.error('加载图表全量明细失败:', e)
    ElMessage.error(e?.message || '加载图表数据失败')
    detailChartAllRows.value = []
  } finally {
    detailChartDataLoading.value = false
    if (!detailChartDialogVisible.value) {
      detailChartAllRows.value = []
      return
    }
    await nextTick()
    updateDetailChart()
    resizeDetailChart()
  }
}

async function onDetailChartDialogOpened() {
  await refreshDetailChartFullData()
}

function onDetailChartDialogClosed() {
  disposeDetailChart()
  detailChartAllRows.value = []
}

watch(
  [detailChartDialogVisible, detailChartType, detailChartDimension],
  () => {
    nextTick(() => {
      if (!detailChartDialogVisible.value) {
        return
      }
      updateDetailChart()
      resizeDetailChart()
    })
  },
  { deep: true }
)

watch(
  () => pagination.value.total,
  () => {
    if (detailChartDialogVisible.value) {
      refreshDetailChartFullData()
    }
  }
)

const NODE_DETAILS_EXPORT_COLUMNS = [
  { key: 'source_publish_date', header: '日期' },
  { key: 'source_title', header: '来源通告' },
  { key: 'product_name', header: '问题对象/标题' },
  { key: 'manufacturer_name', header: '生产企业名称' },
  { key: 'manufacturer_address', header: '生产企业地址' },
  { key: 'operator_name', header: '经营企业名称' },
  { key: 'operator_address', header: '经营企业地址' },
  { key: 'company_names', header: '原始标示企业名称' },
  { key: 'product_region', header: '所在省份' },
  { key: 'unqualified_items', header: '不符合规定项目/检查问题' },
  { key: 'batch_title', header: '来源标题(批)' },
  { key: 'product_type_label', header: '产品类型' },
  { key: 'announcement_type_label', header: '通告类型' },
  { key: 'company_addresses', header: '原始企业地址' },
  { key: 'sample_unit_address', header: '被抽样单位地址' },
  { key: 'package_spec', header: '包装规格' },
  { key: 'batch_no', header: '标示批号' },
  { key: 'production_date', header: '标示生产日期' },
  { key: 'expiry_date', header: '限期使用日期/保质期' },
  { key: 'product_region', header: '所在地/进口地区' },
  { key: 'manufacturer_province', header: '生产企业省份' },
  { key: 'manufacturer_city', header: '生产企业城市' },
  { key: 'sampled_province', header: '样品省份' },
  { key: 'sampled_city', header: '样品城市' },
  { key: 'registration_no', header: '注册/备案编号' },
  { key: 'production_license_no', header: '生产许可证号' },
  { key: 'issue_category', header: '问题类型' },
  { key: 'product_category', header: '产品分类' },
  { key: 'inspection_result', header: '检验结果/处理措施' },
  { key: 'requirement', header: '依据/规定要求' },
  { key: 'remarks', header: '备注' }
]

function sanitizeExportFileBase(name) {
  const s = String(name || 'export')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return s.slice(0, 180) || 'export'
}

function buildNodeDetailsExportFileBase() {
  const rowDim = (hierarchyRow.value || [])
    .map((k) => getDimensionLabel(k))
    .join('·')
  const checked = treeRef.value?.getCheckedNodes?.() || []
  const pathHint = (() => {
    if (checked.length > 1) {
      return `多选合并${checked.length}个节点`
    }
    if (currentNodeBreadcrumb.value) {
      return currentNodeBreadcrumb.value
    }
    return currentNode.value?.label || '节点'
  })()
  const date = new Date().toISOString().slice(0, 10)
  return sanitizeExportFileBase(`不合格产品节点详情_${rowDim}_${pathHint}_${date}`)
}

function cellValueForXlsx(value) {
  if (value == null || value === '') {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const TREE_EXPORT_COUNT_HEADER = '计数项:企业名称'
const PIVOT_FILL = {
  header: 'FF4F6B2C',
  l1: 'FFC6E0B4',
  l2: 'FFFFFAE3',
  leaf: 'FFFFFFFF'
}

function sortCheckedTreeNodesByPath(order, nodeList) {
  return [...nodeList].sort((a, b) => {
    for (const key of order) {
      const va = String(a.path?.[key] ?? a.path_labels?.[key] ?? '')
      const vb = String(b.path?.[key] ?? b.path_labels?.[key] ?? '')
      if (va !== vb) {
        return va.localeCompare(vb, 'zh-CN', { numeric: true })
      }
    }
    return (Number(a.level) || 0) - (Number(b.level) || 0)
  })
}

function getPivotNodeLabelOnRow(node, order) {
  const L = Math.min(Math.max(Number(node.level) || 1, 1), order.length)
  const dimKey = order[L - 1]
  if (!dimKey) {
    return node.label || ''
  }
  const fromLabels = node.path_labels?.[dimKey]
  if (fromLabels != null && fromLabels !== '') {
    return String(fromLabels)
  }
  if (node.label != null && node.label !== '') {
    return String(node.label)
  }
  if (node.path?.[dimKey] != null && node.path[dimKey] !== '') {
    return String(node.path[dimKey])
  }
  return ''
}

function fillPivotStyleForRow(row, level, dimCount) {
  const n = orderLevelFill(level)
  const fillColor = n === 1 ? PIVOT_FILL.l1 : n === 2 ? PIVOT_FILL.l2 : PIVOT_FILL.leaf
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fillColor }
    }
    if (colNumber <= dimCount) {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'right' }
    }
  })
}

function orderLevelFill(level) {
  if (level <= 1) return 1
  if (level === 2) return 2
  return 3
}

function columnLetterFromIndex(n) {
  let s = ''
  let i = n
  while (i > 0) {
    const m = (i - 1) % 26
    s = String.fromCharCode(65 + m) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

function downloadExcelWorkbookBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function appendDetailsSheet(wb, allRows) {
  const names = wb.worksheets.map((s) => s.name)
  const safeName = names.includes('节点详情') ? '节点详情_1' : '节点详情'
  const ws = wb.addWorksheet(safeName)
  const headerLabels = NODE_DETAILS_EXPORT_COLUMNS.map((c) => c.header)
  const hr = ws.addRow(headerLabels)
  hr.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  hr.height = 20
  hr.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  for (const row of allRows) {
    const r = ws.addRow(NODE_DETAILS_EXPORT_COLUMNS.map((c) => {
      const v = row[c.key]
      if (v == null) return ''
      if (typeof v === 'object') return JSON.stringify(v)
      return v
    }))
    r.eachCell((cell, colNumber) => {
      if (colNumber > headerLabels.length) return
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
  }
  const maxCol = headerLabels.length
  ws.autoFilter = `A1:${columnLetterFromIndex(maxCol)}1`
  for (let c = 1; c <= maxCol; c += 1) {
    const w = NODE_DETAILS_EXPORT_COLUMNS[c - 1]
    if (!w) continue
    const prop = ['source_title', 'unqualified_items', 'company_names', 'manufacturer_name', 'manufacturer_address', 'operator_name', 'operator_address'].includes(w.key) ? 32 : 18
    ws.getColumn(c).width = Math.min(48, Math.max(10, prop))
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

function appendCheckedDimensionTreeSheet(wb, order, checked) {
  const names = wb.worksheets.map((s) => s.name)
  const name = names.includes('维度树') ? '维度树_1' : '维度树'
  const ws = wb.addWorksheet(name)
  const dimCount = order.length
  if (!dimCount) {
    ws.addRow(['未配置行标签维度'])
    return
  }
  const headerRow = [
    ...order.map((k) => getDimensionLabel(k)),
    TREE_EXPORT_COUNT_HEADER
  ]
  const h = ws.addRow(headerRow)
  h.height = 22
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  h.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: PIVOT_FILL.header }
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  const lastCol = dimCount + 1
  if (!checked.length) {
    const msg = '（未勾选：表2 仅输出已勾选的节点。请在左侧维度树勾选要导出的节点后重新导出。）'
    const rowArr = [msg, ...new Array(lastCol - 1).fill('')]
    const empty = ws.addRow(rowArr)
    empty.getCell(1).font = { italic: true, color: { argb: 'FF808080' } }
    empty.getCell(1).alignment = { wrapText: true, vertical: 'top' }
  } else {
    for (const node of sortCheckedTreeNodesByPath(order, checked)) {
      const L = Math.min(Math.max(Number(node.level) || 1, 1), dimCount)
      const values = new Array(dimCount + 1).fill('')
      const text = getPivotNodeLabelOnRow(node, order)
      values[L - 1] = text
      values[dimCount] = Number(node.count ?? 0) || 0
      const dataRow = ws.addRow(values)
      fillPivotStyleForRow(dataRow, L, dimCount)
    }
  }
  ws.autoFilter = `A1:${columnLetterFromIndex(lastCol)}1`
  for (let c = 1; c <= lastCol; c += 1) {
    ws.getColumn(c).width = c <= dimCount ? 22 : 16
  }
  ws.getColumn(lastCol).numFmt = '#,##0'
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

async function exportNodeDetailsExcel() {
  const pathsPayload = getNodeDetailsPathsPayload()
  const checkedPathsPayload = getCheckedTreePathsPayload()
  if (!pathsPayload.length) {
    ElMessage.warning('没有可导出的范围，请先在维度树选择节点')
    return
  }
  if (!(pagination.value.total > 0)) {
    ElMessage.warning('当前没有可导出的明细')
    return
  }
  exportingNodeDetails.value = true
  try {
    const allRows = await fetchAllNodeDetailRows(pathsPayload)
    const order = dimensionOrder.value?.length ? dimensionOrder.value : DEFAULT_DIMENSION_ORDER
    const checkedRes = checkedPathsPayload.length
      ? await getUnqualifiedProductCheckedTreeNodes({
        ...buildTreeRequestParams(),
        paths: checkedPathsPayload,
        dimension_order: JSON.stringify(order)
      })
      : { data: [] }
    const checked = sortCheckedTreeNodesByPath(order, checkedRes.data || [])
    if (!checked.length) {
      ElMessage.info('提示：表「维度树」当前未勾选节点，表2 仅含说明；导出前请在左侧树勾选要统计的节点。')
    }
    const wb = new ExcelJS.Workbook()
    appendDetailsSheet(wb, allRows)
    appendCheckedDimensionTreeSheet(wb, order, checked)
    const buffer = await wb.xlsx.writeBuffer()
    downloadExcelWorkbookBuffer(buffer, `${buildNodeDetailsExportFileBase()}.xlsx`)
    const treeN = checked.length
    ElMessage.success(`已导出 明细 ${allRows.length} 条，维度树 ${treeN ? `已选 ${treeN} 个节点` : '0 个节点'}`)
  } catch (e) {
    console.error('导出节点详情失败:', e)
    ElMessage.error(e?.message || '导出失败')
  } finally {
    exportingNodeDetails.value = false
  }
}

async function loadNodeDetails() {
  const pathsPayload = getNodeDetailsPathsPayload()

  if (!pathsPayload.length) {
    tableData.value = []
    pagination.value.total = 0
    return
  }

  cancelDetailRequest()
  detailRequestController = new AbortController()
  tableLoading.value = true
  try {
    const res = await getUnqualifiedProductNodeDetails({
      ...buildTreeRequestParams(),
      page: pagination.value.page,
      limit: pagination.value.limit,
      paths: pathsPayload
    }, {
      signal: detailRequestController.signal
    })
    tableData.value = res.data || []
    pagination.value.total = res.pagination?.total || 0
  } catch (error) {
    if (isAbortError(error)) {
      return
    }
    console.error('加载节点详情失败:', error)
    tableData.value = []
    pagination.value.total = 0
  } finally {
    detailRequestController = null
    tableLoading.value = false
  }
}

async function handleSearch() {
  pagination.value.page = 1
  scheduleTreeReload()
}

async function resetFilters() {
  filters.value = createDefaultFilters()
  pagination.value.page = 1
  scheduleTreeReload()
}

function isLevelOneTreeNode(data) {
  return data != null && Number(data.level) === 1
}

function isCascadeManagedTreeNode(data) {
  if (data == null) return false
  const level = Number(data.level)
  return level === 1 || level === 2
}

function collectDescendantKeysFromData(data) {
  const tree = treeRef.value
  if (!tree || !data) return []
  const elNode = tree.getNode(data)
  if (!elNode) return []
  const keys = []
  const walk = (n) => {
    for (const cn of n.childNodes || []) {
      if (cn.data?.key != null) keys.push(cn.data.key)
      walk(cn)
    }
  }
  walk(elNode)
  return keys
}

function collectCascadeParentNodesFromStore() {
  const tree = treeRef.value
  if (!tree?.store?.root) return []
  const result = []
  const walk = (n) => {
    if (!n) return
    const d = n.data
    if (d && d.key != null && n.childNodes?.length && isCascadeManagedTreeNode(d)) {
      result.push(d)
    }
    for (const cn of n.childNodes || []) {
      walk(cn)
    }
  }
  walk(tree.store.root)
  return result
}

async function handleTreeNodeClick(data) {
  currentNode.value = data
  currentNodeKey.value = data.key
  pagination.value.page = 1
  await loadNodeDetails()
}

function setsEqualForKeys(a, bList) {
  const b = new Set(bList)
  if (a.size !== b.size) return false
  for (const k of a) {
    if (!b.has(k)) return false
  }
  return true
}

async function handleTreeCheck(data) {
  if (syncingTreeCheckCascade.value) {
    return
  }
  const tree = treeRef.value
  if (tree) {
    const keySet = new Set(tree.getCheckedKeys())

    if (isCascadeManagedTreeNode(data)) {
      const desc = collectDescendantKeysFromData(data)
      if (desc.length) {
        if (keySet.has(data.key)) {
          for (const k of desc) keySet.add(k)
        } else {
          for (const k of desc) keySet.delete(k)
        }
      }
    }

    for (const parentNode of collectCascadeParentNodesFromStore()) {
      const desc = collectDescendantKeysFromData(parentNode)
      if (!desc.length) continue
      const allDescChecked = desc.every((k) => keySet.has(k))
      if (allDescChecked) {
        keySet.add(parentNode.key)
      } else {
        keySet.delete(parentNode.key)
      }
    }

    const nextKeys = [...keySet]
    if (!setsEqualForKeys(keySet, tree.getCheckedKeys())) {
      syncingTreeCheckCascade.value = true
      try {
        tree.setCheckedKeys(nextKeys)
      } finally {
        await nextTick()
        syncingTreeCheckCascade.value = false
      }
    }
  }
  await nextTick()
  pagination.value.page = 1
  await loadNodeDetails()
}

async function handlePageSizeChange(value) {
  pagination.value.limit = value
  pagination.value.page = 1
  await loadNodeDetails()
}

async function handlePageChange(value) {
  pagination.value.page = value
  await loadNodeDetails()
}

function getNodeLevelLabel(level) {
  const node = currentNode.value
  if (node?.dimension) {
    return getDimensionLabel(node.dimension)
  }
  const order = dimensionOrder.value?.length ? dimensionOrder.value : DEFAULT_DIMENSION_ORDER
  const key = order[level - 1]
  return key ? getDimensionLabel(key) : `第 ${level} 级`
}

function viewDetail(id) {
  router.push(`/unqualified-products/${id}`)
}

function goSource(row) {
  if (row.announcement_id) {
    router.push(`/announcements/${row.announcement_id}`)
    return
  }
  if (row.supervision_id) {
    router.push(`/supervisions/${row.supervision_id}`)
  }
}

function goCompany(companyId) {
  router.push(`/companies/${companyId}`)
}

function onWindowResizeDetailChart() {
  resizeDetailChart()
}

onMounted(async () => {
  applyRouteFilters()
  appliedDimensionHistory.value = readSavedAppliedDimensionHistory()
  syncDraftWithOrder(readSavedAppliedDimensionOrder() ?? DEFAULT_DIMENSION_ORDER)
  await Promise.all([loadStats(), loadFilterOptions()])
  await loadTree()
  window.addEventListener('resize', onWindowResizeDetailChart)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResizeDetailChart)
  disposeDetailChart()
  clearTreeReloadTimer()
  cancelTreeRequest()
  cancelDetailRequest()
})
</script>

<style scoped>
.unqualified-products {
  max-width: 1580px;
  margin: 0 auto;
}

.page-card,
.tree-card,
.detail-card {
  border-radius: 18px;
}

.card-header,
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.detail-card-header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}

.detail-chart-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.detail-chart-hint {
  font-size: 12px;
  color: #909399;
  flex: 1;
  min-width: 200px;
}

.detail-chart-canvas {
  width: 100%;
  height: 360px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #ebeef5;
}

.detail-chart-canvas--dialog {
  height: 420px;
}

.detail-chart-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}

.detail-chart-dialog-body {
  min-height: 200px;
}

.video-copy-dialog-body {
  min-height: 260px;
}

.video-copy-dialog-body :deep(.el-textarea__inner) {
  line-height: 1.8;
  font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.page-subtitle,
.panel-subtitle {
  margin-top: 6px;
  color: #909399;
  font-size: 13px;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}

.dimension-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.pivot-dimension-designer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-shrink: 0;
}

.dimension-history {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fafbfc;
}

.dimension-history-label {
  font-size: 12px;
  color: #909399;
}

.dimension-history-item {
  padding: 4px 8px;
}

.pivot-panel {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fafbfc;
  padding: 12px 12px 14px;
}

.pivot-panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px 12px;
  margin-bottom: 10px;
}

.pivot-panel-title {
  font-size: 13px;
  font-weight: 700;
  color: #303133;
}

.pivot-panel-hint {
  font-size: 12px;
  color: #a8abb2;
}

.pivot-fields-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 36px;
  align-items: center;
}

.pivot-field-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
  background: #fff;
  font-size: 13px;
  color: #606266;
  cursor: grab;
  user-select: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.pivot-field-chip:hover {
  border-color: #c6e2ff;
  box-shadow: 0 1px 4px rgba(64, 158, 255, 0.12);
}

.pivot-field-chip:active {
  cursor: grabbing;
}

.pivot-pool-empty {
  font-size: 12px;
  color: #c0c4cc;
}

.pivot-rows-drop {
  min-height: 120px;
  border: 2px dashed #dcdfe6;
  border-radius: 12px;
  padding: 10px;
  background: #fff;
  transition: border-color 0.15s, background 0.15s;
}

.pivot-rows-drop.is-drag-over {
  border-color: #409eff;
  background: #ecf5ff;
}

.pivot-rows-placeholder {
  font-size: 13px;
  color: #c0c4cc;
  text-align: center;
  padding: 28px 12px;
}

.pivot-row-line {
  position: relative;
  padding-top: 4px;
  margin-top: 2px;
}

.pivot-row-line.is-drag-over::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  background: #409eff;
  border-radius: 1px;
}

.pivot-row-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #e4e7ed;
  background: #f7f9fc;
  cursor: grab;
  user-select: none;
}

.pivot-row-item:active {
  cursor: grabbing;
}

.pivot-row-item-label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.pivot-drag-icon {
  font-size: 14px;
  color: #909399;
}

.pivot-row-remove {
  margin-left: auto;
}

.tree-section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f7f9fc;
  flex-shrink: 0;
}

.tree-section-title {
  font-size: 15px;
  font-weight: 700;
  color: #303133;
}

.tree-section-subtitle {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
}

.filter-form {
  margin-bottom: 20px;
  padding: 16px;
  background: #f7f9fc;
  border-radius: 14px;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.result-summary,
.selected-node-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stats-row {
  margin-bottom: 20px;
}

.content-row {
  align-items: stretch;
}

.tree-card,
.detail-card {
  height: 100%;
}

.tree-card {
  display: flex;
  flex-direction: column;
  min-height: 760px;
}

.tree-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.detail-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  min-height: 760px;
}

.tree-card-body-inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* 限定高度后 overflow 才能生效；仅靠 flex 在父级无固定高度时往往撑满整页 */
.tree-scroll-area {
  flex: 1 1 auto;
  min-height: 200px;
  max-height: min(560px, calc(100vh - 320px));
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  border-radius: 10px;
  border: 1px solid #ebeef5;
  background: #fff;
}

.tree-section-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}

.stat-card {
  padding: 18px;
  border-radius: 10px;
  color: #fff;
  text-align: center;
}

.stat-card.danger {
  background: linear-gradient(135deg, #f56c6c 0%, #ff8a8a 100%);
}

.stat-card.primary {
  background: linear-gradient(135deg, #409eff 0%, #6ab7ff 100%);
}

.stat-card.success {
  background: linear-gradient(135deg, #67c23a 0%, #95d475 100%);
}

.stat-card.warning {
  background: linear-gradient(135deg, #e6a23c 0%, #f3c76a 100%);
}

.stat-value {
  font-size: 30px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
}

.tree-node {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
}

.tree-node-main,
.tree-node-side {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tree-node-main {
  min-width: 0;
}

.tree-node-label {
  color: #303133;
  font-weight: 500;
  word-break: break-all;
}

.tree-node-meta,
.tree-node-subtitle {
  color: #909399;
  font-size: 12px;
}

.tree-node-subtitle {
  text-align: right;
  max-width: 220px;
  word-break: break-all;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.mb-20 {
  margin-bottom: 20px;
}

@media (max-width: 1200px) {
  .content-row {
    display: block;
  }

  .content-row :deep(.el-col) {
    max-width: 100%;
    flex: 0 0 100%;
  }
}
</style>
