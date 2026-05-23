<template>
  <div class="unqualified-products">
    <el-card class="page-card" shadow="never">

      <!-- 筛选框 -->
      <el-form :model="filters" class="filter-form" label-width="96px">
        <el-row :gutter="32">

          <el-col :span="5">
            <el-form-item label="企业关键词">
              <el-input v-model="filters.company_keyword" placeholder="搜索企业或被抽样单位" clearable
                @keyup.enter="handleSearch" />
            </el-form-item>
          </el-col>
         
          <!-- <el-col :span="4">
            <el-form-item label="结束年份">
              <el-select v-model="filters.year_end" clearable filterable placeholder="不限" style="width: 100%">
                <el-option v-for="item in filterOptions.years" :key="`end-${item.value}`" :label="item.label"
                  :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col> -->
          <el-col :span="4">
            <el-form-item label="生产企业省份">
              <el-select v-model="filters.manufacturer_province" clearable filterable placeholder="全部"
                style="width: 100%">
                <el-option v-for="item in filterOptions.manufacturer_provinces" :key="item.value" :label="item.label"
                  :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="抽检企业省份">
              <el-select v-model="filters.sampled_province" clearable filterable placeholder="全部"
                style="width: 100%">
                <el-option v-for="item in filterOptions.sampled_provinces" :key="item.value" :label="item.label"
                  :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="不符合项目">
              <el-select v-model="filters.issue_items" multiple filterable collapse-tags collapse-tags-tooltip clearable
                placeholder="选择一个或多个项目" style="width: 100%">
                <el-option v-for="item in filterOptions.issue_items" :key="item.value" :title="item.label" :label="item.label"
                  :value="item.value" filterable style="width: 200px" show-overflow-tooltip />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="产品类型">
              <el-select v-model="filters.product_type" clearable placeholder="全部产品类型" style="width: 100%">
                <el-option v-for="item in filterOptions.product_types" :key="item.value" :label="item.label"
                  :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="32">
        
          <el-col :span="5">
            <el-form-item label="年份" style="width: 100%">
              <el-select v-model="filters.year_start" clearable filterable placeholder="不限" >
                <el-option v-for="item in filterOptions.years" :key="`start-${item.value}`" :label="item.label"
                  :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="产品分类">
              <el-select v-model="filters.product_category" clearable placeholder="全部" style="width: 100%">
                <el-option v-for="item in filterOptions.product_categories" :key="item.value" :label="item.label"
                  :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <div class="filter-actions">
              <el-button type="primary" @click="handleSearch">搜索</el-button>
              <el-button @click="resetFilters">重置</el-button>
            </div>
          </el-col>

        </el-row>

      </el-form>

      <el-alert v-if="hasActiveFilters" type="success" :closable="false" show-icon class="mb-20"
        :title="`当前检索条件命中 ${summary.matched_count || 0} 条结果`" />
      <el-row :gutter="16" class="content-row">
        <el-col :span="7">
          <el-card shadow="never" class="tree-card" v-loading="treeLoading">
            <template #header>
              <div class="panel-header panel-header--stacked">
                <div>
                  <div class="panel-title">分类</div>

                </div>
                <div class="panel-header-actions">
                  <el-button size="small" :disabled="!treeCanSelectAll" @click="selectAllTreeNodes" type="primary" link>全选</el-button>
                  <el-button size="small" :disabled="!treeHasCheckedNodes" @click="clearTreeSelection" type="info" link>清空</el-button>
                  <el-button size="small" type="primary" @click="openCategorySettingDialog">设置</el-button>
                  <el-select v-model="themePresetSelectValue" class="theme-preset-select" placeholder="方案主题" clearable
                    filterable size="small" :disabled="!themePresetDropdownEnabled"
                    @visible-change="onThemePresetDropdownVisible" @change="onThemePresetSelected">
                    <el-option v-for="p in serverSavedDimensionPresets" :key="p.id" :label="p.title" :value="p.id">
                      <div class="theme-preset-option">
                        <span class="theme-preset-option-name">{{ p.title }}</span>
                        <button type="button" class="theme-preset-option-delete" :disabled="deletingPresetId === p.id"
                          @click.stop.prevent="confirmDeleteDimensionPreset(p)">
                          删除
                        </button>
                      </div>
                    </el-option>
                  </el-select>
                </div>
              </div>
            </template>

            <div class="tree-card-body-inner">
              <div class="tree-scroll-area">
                
                <el-empty v-if="treeIsEmpty" description="暂无数据" />
                
                <el-tree v-else-if="treeListFetched && treeRootCount > 0" :key="`dim-tree-${treeRerenderKey}`"
                  ref="treeRef" :data="treeData" lazy :load="loadTreeNode" :props="treeProps" node-key="key"
                  show-checkbox check-strictly highlight-current :expand-on-click-node="false"
                  @node-click="handleTreeNodeClick" @check="handleTreeCheck">
                  
                  <template #default="{ node, data }">
                    
                    <div class="tree-node" @click.stop="onTreeRowContentClick(node, data, $event)">
                      <div class="tree-node-main">
                        <span class="tree-node-label">{{ data.label }}</span>
                      </div>
                      <!-- <div class="tree-node-side">
                        <el-tag size="small" type="danger">{{ data.count }}</el-tag>
                      </div> -->
                    </div>
                  </template>
                </el-tree>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="17">
          <el-card shadow="never" class="detail-card">
            <template #header>
              <div class="panel-header detail-card-header">

                <div v-if="currentNode" class="detail-card-header-actions">
                  <el-tag type="success">共{{ pagination.total }}/已选中{{ detailTableSelectedCount }} 条</el-tag>
                  <el-button type="success" plain size="small" @click="detailChartDialogVisible = true">
                    统计图
                  </el-button>

                  <el-button type="primary" plain size="small" :loading="combinedExportLoading"
                    :disabled="!nodeDetailsCanExport || detailTableSelectedCount === 0"
                    @click="openCombinedExportDialog">
                    导出
                  </el-button>
                  <!-- <el-button type="primary" plain size="small" :loading="exportingNodeDetails"
                    :disabled="!nodeDetailsCanExport" @click="exportNodeDetailsExcel">
                    导出 Excel
                  </el-button>
                  <el-button type="warning" plain size="small" :loading="generatingVideoCopy"
                    :disabled="!nodeDetailsCanExport" @click="openVideoCopyDialog">
                    文案
                  </el-button> -->
                </div>
              </div>
            </template>
            <el-empty v-if="!currentNode" description="请选择左侧树节点查看详情" />
            <template v-else class="unqualified-product-detail-table">
              <el-table ref="detailTableRef" :data="tableData" row-key="id" stripe border v-loading="tableLoading"
                max-height="1080" @selection-change="onDetailTableSelectionChange" @sort-change="handleDetailSortChange"
                class="table-height ">
                <el-table-column type="expand" width="50">
                  <template #default="{ row }">
                    <el-descriptions :column="2" border>
                      <el-descriptions-item label="来源标题">{{ row.source_title || row.batch_title || '-'
                      }}</el-descriptions-item>
                      <el-descriptions-item label="商品图片" >
                        <el-image
                          :src="resolveProductPictureSrcFromRow(row)"
                          :preview-src-list="[resolveProductPictureSrcFromRow(row)]"
                          style="height: 70px; width: 70px;"
                        />
                      </el-descriptions-item>
                      <el-descriptions-item label="来源日期">{{ formatDate(row.source_publish_date) || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="产品分类">{{ row.product_category || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="正文文案" :span="2">
                        <div class="detail-food-body-preview">{{ row.food_body_text || '暂无' }}</div>
                      </el-descriptions-item>
                      <!-- <el-descriptions-item label="产品类型">{{ row.product_type_label || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="通告类型">{{ row.announcement_type_label || '-' }}</el-descriptions-item> -->
                      <el-descriptions-item label="生产企业名称">{{ row.manufacturer_name || row.company_names || '-'
                      }}</el-descriptions-item>
                      <el-descriptions-item label="生产企业地址">{{ row.manufacturer_address || row.company_addresses || '-'
                      }}</el-descriptions-item>
                      <el-descriptions-item label="经营企业名称">{{ row.operator_name || row.sample_unit_name || '-'
                      }}</el-descriptions-item>
                      <el-descriptions-item label="经营企业地址">{{ row.operator_address || row.sample_unit_address || '-'
                      }}</el-descriptions-item>
                      <el-descriptions-item label="原始标示企业">{{ row.company_names || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="原始企业地址">{{ row.company_addresses || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="包装规格">{{ row.package_spec || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="标示批号">{{ row.batch_no || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="标示生产日期">{{ row.production_date || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="限期使用日期/保质期">{{ row.expiry_date || '-' }}</el-descriptions-item>
                      <el-descriptions-item v-if="!isUnqualifiedFoodRow(row)" label="所在地/进口地区">{{ row.product_region || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="生产企业省市">{{ formatProvinceCityDisplay(row.manufacturer_province,
                        row.manufacturer_city) }}</el-descriptions-item>
                      <el-descriptions-item label="样品省市">{{ formatProvinceCityDisplay(row.sampled_province,
                        row.sampled_city) }}</el-descriptions-item>
                      <el-descriptions-item v-if="!isUnqualifiedFoodRow(row)" label="注册/备案编号">{{ row.registration_no || '-' }}</el-descriptions-item>
                      <el-descriptions-item v-if="!isUnqualifiedFoodRow(row)" label="生产许可证号">{{ row.production_license_no || '-' }}</el-descriptions-item>
                      <el-descriptions-item label="问题类型">{{ row.issue_category || '-' }}</el-descriptions-item>
                      <!-- <el-descriptions-item label="产品分类">{{ row.product_category || '-' }}</el-descriptions-item> -->
                      <el-descriptions-item label="检验结果/处理措施" :span="2">{{ row.inspection_result || '-'
                      }}</el-descriptions-item>
                      <el-descriptions-item label="依据/规定要求" >{{ row.requirement || '-'
                      }}</el-descriptions-item>
                      <el-descriptions-item label="备注" >{{ row.remarks || '-' }}</el-descriptions-item>
                    </el-descriptions>
                  </template>
                </el-table-column>
                <el-table-column type="selection" width="48" />
                <el-table-column prop="product_name" label="产品名称" min-width="170" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="detail-product-name-cell" title="双击查看详情" @click="viewDetail(row.id)">{{
                      row.product_name }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="unqualified_items" label="不符合规定项目" min-width="220" show-overflow-tooltip />
                <!-- <el-table-column prop="inspection_result" label="检验结果/处理措施" min-width="220" show-overflow-tooltip /> -->
                <el-table-column prop="manufacturer_name" label="生产企业" min-width="220" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="manufacturer-nav-cell" :class="{ 'manufacturer-nav-cell--link': row.company_id }"
                      :title="row.company_id ? '点击查看企业详情' : '暂无关联企业'"
                      @click="row.company_id && goCompany(row.company_id)">{{ row.manufacturer_name || row.company_names
                        || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="usage_count" label="使用次数"  sortable="custom"
                  :sort-orders="['descending', 'ascending', null]" min-width="110">
                  <template #default="{ row }">
                    <span class="usage-count-cell" title="双击查看使用情况" @dblclick="goUsageRecords(row.id)">
                      {{ formatUsageCount(row) }}
                    </span>
                  </template>
                </el-table-column>
                
              </el-table>

              <el-pagination :page-size="pagination.limit" :current-page="pagination.page" :total="pagination.total"
                :page-sizes="[10, 20, 50, 100, 200]" layout="total, sizes, prev, pager, next, jumper" class="pagination"
                @update:page-size="handlePageSizeChange" @update:current-page="handlePageChange" />
            </template>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <el-dialog v-model="detailChartDialogVisible" title="统计图表" width="min(1080px, 94vw)" height="min(400px, 94vh)"
      align-center append-to-body destroy-on-close class="detail-chart-dialog" @opened="onDetailChartDialogOpened"
      @closed="onDetailChartDialogClosed">
      <div v-loading="detailChartDataLoading" class="detail-chart-dialog-body">
        <div class="detail-chart-toolbar">
          <el-select v-model="detailChartType" placeholder="图表类型" size="small" style="width: 120px">
            <el-option label="饼图" value="pie" />
            <el-option label="柱状图" value="bar" />
            <el-option label="折线图" value="line" />
          </el-select>
          <el-select
            v-model="detailChartExportDimensionKeys"
            multiple
            collapse-tags
            collapse-tags-tooltip
            :max-collapse-tags="2"
            filterable
            placeholder="统计字段（多选）"
            size="small"
            class="detail-chart-dimension-select-multiple"
            style="width: min(380px, 46vw)"
            title="可多选字段，下拉每项带勾选样式；第一项为当前预览图统计维度，并与「导出压缩包」一致。"
          >
            <el-option v-for="opt in NODE_DETAIL_CHART_FIELDS" :key="opt.key" :label="opt.label" :value="opt.key" />
          </el-select>
          <el-button
            size="small"
            type="success"
            plain
            :loading="detailChartBulkExporting"
            @click="runDetailChartBulkExportFromToolbarChecked"
          >
            导出压缩包
          </el-button>
          <!-- <el-button size="small" :loading="detailChartDataLoading" @click="refreshDetailChartFullData">
            重新加载
          </el-button> -->
          <span class="detail-chart-hint">
            <template v-if="detailTableSelectedCount > 0">
              按已勾选的 {{ detailTableSelectedCount }} 条参与统计
            </template>
            <template v-else>
              当前未勾选，展示通告下全部条数 {{ pagination.total || 0 }} 
            </template>
            <!-- <el-button type="primary" size="small" @click="openDetailChartBulkExportDialog">批量导出…</el-button> -->
          </span>
        </div>
        <div ref="detailChartRef" class="detail-chart-canvas detail-chart-canvas--dialog" />
      </div>
    </el-dialog>

    <el-dialog
      v-model="detailChartBulkExportDialogVisible"
      title="批量导出图表"
      width="min(520px, 92vw)"
      align-center
      append-to-body
      destroy-on-close
      class="detail-chart-bulk-export-dialog"
    >
      <p class="detail-chart-bulk-export-intro">
        可多选「图表类型 + 统计字段」组合；统计字段下拉已支持多选（与图表工具栏第一项维度一致）。
        导出为一张压缩包写入您所选文件夹；统计口径与当前弹窗一致（含表格勾选 subset）。
      </p>
      <div class="detail-chart-bulk-export-actions">
        <el-button size="small" @click="selectAllDetailChartBulkExportChoices">全选</el-button>
        <el-button size="small" @click="clearDetailChartBulkExportSelections">清空</el-button>
      </div>
      <el-checkbox-group v-model="detailChartBulkExportSelectedKeys" class="detail-chart-bulk-export-group">
        <el-scrollbar max-height="min(420px, 55vh)">
          <div
            v-for="opt in detailChartBulkExportChoices"
            :key="opt.key"
            class="detail-chart-bulk-export-row"
          >
            <el-checkbox :label="opt.key">{{ opt.label }}</el-checkbox>
          </div>
        </el-scrollbar>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="detailChartBulkExportDialogVisible = false">关闭</el-button>
        <el-button
          type="primary"
          :loading="detailChartBulkExporting"
          :disabled="!detailChartBulkExportSelectedKeys.length"
          @click="runDetailChartBulkExportToFolderZip"
        >
          选择文件夹并保存压缩包
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="categorySettingDialogVisible" title="分类设置" width="min(720px, 96vw)" align-center append-to-body
      class="category-setting-dialog" @closed="onCategorySettingDialogClosed">
      <div class="category-setting-dialog-body">
        <el-form label-width="100px" class="category-setting-name-form">
          <el-form-item label="方案名称" required>
            <el-input v-model="dimensionPresetName" maxlength="200" show-word-limit placeholder="为该层级方案命名，应用后将保存到账号"
              clearable />
          </el-form-item>
        </el-form>
        <div class="dimension-actions">

          <el-button size="small" type="info" :disabled="savingDimensionPreset"
            @click="resetDimensionDraft">重置</el-button>
        </div>
        <!-- <div v-if="dimensionPresetPickList.length" class="dimension-history mb-20">
          <span class="dimension-history-label">猜你想用</span>
          <el-button v-for="item in dimensionPresetPickList" :key="item.key" size="small" text
            class="dimension-history-item" @click="applySavedDimensionPreset(item.order)">
            {{ item.label }}
          </el-button>
        </div> -->

        <div class="pivot-dimension-designer mb-20">
          <div class="pivot-panel pivot-panel--pool">
            <div class="pivot-panel-head">
              <span class="pivot-panel-title">可选字段</span>
              <span class="pivot-panel-hint">可拖到右侧加入层级</span>
            </div>
            <div class="pivot-fields-pool">
              <div v-for="item in poolDimensions" :key="`pool-${item.key}`" class="pivot-field-chip" draggable="true"
                @dragstart="onPoolFieldDragStart($event, item.key)" @dragend="onDimensionDragEnd">
                <el-icon class="pivot-drag-icon">
                  <Rank />
                </el-icon>
                <span>{{ item.label }}</span>
              </div>
              <div v-if="!poolDimensions.length" class="pivot-pool-empty">全部字段已加入行标签</div>
            </div>
          </div>

          <div class="pivot-panel pivot-panel--rows">
            <div class="pivot-panel-head">
              <span class="pivot-panel-title">（最多5层）</span>
              <el-button type="danger" size="small" @click="resetHierarchy">清空</el-button>
            </div>
            <div class="pivot-rows-drop" :class="{ 'is-drag-over': rowDropZoneActive }"
              @dragover.prevent="onRowZoneDragOver" @dragleave="onRowZoneDragLeave" @drop.prevent="onRowZoneDropEnd">
              <template v-if="!hierarchyRow.length">
                <div class="pivot-rows-placeholder">从上方将字段拖入此处</div>
              </template>
              <div v-for="(rowKey, index) in hierarchyRow" :key="`row-${rowKey}-${index}`" class="pivot-row-line"
                :class="{ 'is-drag-over': rowInsertBeforeIndex === index }"
                @dragover.prevent="onRowLineDragOver($event, index)" @dragleave="onRowLineDragLeave"
                @drop.prevent="onRowLineDrop($event, index)">
                <div class="pivot-row-item" draggable="true" @dragstart="onRowItemDragStart($event, index)"
                  @dragend="onDimensionDragEnd">
                  <el-icon class="pivot-drag-icon">
                    <Rank />
                  </el-icon>
                  <span class="pivot-row-item-label">{{ getDimensionLabel(rowKey) }}</span>
                  <el-tag size="small" type="info" effect="plain">第 {{ index + 1 }} 级</el-tag>
                  <el-button link type="danger" class="pivot-row-remove" :icon="Close" aria-label="移除此级"
                    @click.stop="removeHierarchyAt(index)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" :loading="savingDimensionPreset" @click="applyCategoryDimensionWithName">
          保存
        </el-button>
        <el-button @click="categorySettingDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="videoCopyDialogVisible" title="文案" width="min(820px, 94vw)" align-center append-to-body
      destroy-on-close>
      <div v-loading="generatingVideoCopy" class="video-copy-dialog-body">
        <el-input v-model="videoCopyText" type="textarea" :rows="16" readonly resize="vertical"
          placeholder="点击“生成文案”后将在这里显示" />
      </div>
      <template #footer>
        <el-button @click="videoCopyDialogVisible = false">关闭</el-button>
        <el-button type="success" :loading="savingVideoCopy" :disabled="!videoCopyText"
          @click="saveVideoCopyText">保存</el-button>
        <el-button type="primary" :disabled="!videoCopyText" @click="copyVideoCopyText">复制</el-button>

      </template>
    </el-dialog>

    <el-dialog
      v-model="combinedExportDialogVisible"
      width="min(1200px, 96vw)"
      align-center
      append-to-body
      destroy-on-close
      class="combined-export-dialog"
    >
      <template #header="{ titleId, titleClass }">
        <div class="combined-export-dialog-header">
          <span :id="titleId" :class="titleClass">导出</span>
          <div class="combined-export-dialog-header-actions">
            <el-button @click="combinedExportDialogVisible = false">关闭</el-button>
            <el-button
              type="primary"
              :loading="combinedExportPackaging"
              :disabled="!combinedExportRows.length"
              title="下载 zip：内含 文案.txt、Excel、商品图片/（文案内容一致）"
              @click="exportCombinedExportPackageZip"
            >
              导出
            </el-button>
          </div>
        </div>
      </template>
      <div v-loading="combinedExportLoading" class="combined-export-dialog-body">
        <div class="combined-export-summary">
          <el-tag type="success">已勾选明细 {{ combinedExportRows.length }} 条</el-tag>
        </div>
        <el-tabs v-model="combinedExportMainTab" class="combined-export-main-tabs">
          <el-tab-pane label="文案" name="copy">
            <div class="combined-export-copy-panel">
              <div class="combined-export-copy-theme-row">
                <span class="combined-export-copy-theme-label">文案主题</span>
                <el-select
                  v-model="combinedExportCopyTab"
                  class="combined-export-copy-theme-select"
                  placeholder="选择文案主题"
                >
                  <el-option label="当前文案生成方案" value="scheme" />
                  <el-option
                    v-if="showCombinedExportFoodBodyTab"
                    label="食品正文"
                    value="food_body"
                  />
                </el-select>
                <el-button type="primary" plain @click="toggleCombinedExportCopyEdit">
                  {{ combinedExportCopyEditMode ? '完成' : '编辑' }}
                </el-button>
              </div>
              <el-alert
                v-if="combinedExportCopyTab === 'food_body' && combinedExportFoodBodySegmentCount === 0"
                type="info"
                :closable="false"
                show-icon
                class="combined-export-food-alert"
                title="当前勾选结果中暂无食品类明细的正文文案（food_body_text）；仍将展示开头两段统计说明。"
              />
              <el-input
                v-model="combinedExportActiveCopyModel"
                class="combined-export-copy-textarea"
                type="textarea"
                :rows="18"
                :readonly="!combinedExportCopyEditMode"
                resize="vertical"
                placeholder="打开弹窗后自动生成文案"
              />
            </div>
          </el-tab-pane>
          <el-tab-pane label="详情" name="detail">
            <el-table :data="combinedExportRows" size="small" border stripe max-height="520">
              <el-table-column type="index" label="#" width="52" align="center" />
              <el-table-column label="日期" width="105" show-overflow-tooltip>
                <template #default="{ row }">{{ formatDate(row.source_publish_date) }}</template>
              </el-table-column>
              <el-table-column prop="source_title" label="来源通告" min-width="220" show-overflow-tooltip />
              <el-table-column prop="product_name" label="问题对象/标题" min-width="160" show-overflow-tooltip />
              <el-table-column prop="manufacturer_name" label="生产企业" min-width="150" show-overflow-tooltip />
              <el-table-column prop="unqualified_items" label="不符合规定项目/检查问题" min-width="180" show-overflow-tooltip />
              <el-table-column prop="product_category" label="产品分类" width="120" show-overflow-tooltip />
              <el-table-column prop="picture_url" label="商品图片" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">
                  <div
                    class="combined-export-picture-cell"
                    title="点击更换本次导出使用的图片"
                    @click="openCombinedExportPictureDialog(row)"
                  >
                    <el-image
                      v-if="resolveCombinedExportRowPictureSrc(row)"
                      :key="resolveCombinedExportRowPictureSrc(row)"
                      class="combined-export-picture-thumb"
                      :src="resolveCombinedExportRowPictureSrc(row)"
                      fit="cover"
                    >
                      <template #error>
                        <div class="image-fallback combined-export-picture-thumb">无图</div>
                      </template>
                    </el-image>
                    <div v-else class="image-fallback combined-export-picture-thumb">无图</div>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>

    <el-dialog
      v-model="combinedExportPictureDialogVisible"
      title="更换导出图片"
      width="min(760px, 94vw)"
      align-center
      append-to-body
      destroy-on-close
      class="combined-export-picture-dialog"
      @closed="resetCombinedExportPictureDialog"
    >
      <p class="combined-export-picture-hint">仅影响本次导出压缩包，不会修改数据库中的产品图片。</p>
      <div v-if="combinedExportPictureTargetRow" class="combined-export-picture-meta">
        <span>{{ combinedExportPictureTargetRow.product_name || '—' }}</span>
        <span v-if="combinedExportPictureTargetRow.product_category" class="combined-export-picture-meta-sub">
          · {{ combinedExportPictureTargetRow.product_category }}
        </span>
      </div>
      <div v-loading="combinedExportPictureDialogLoading" class="combined-export-picture-options">
        <div
          class="combined-export-picture-option"
          :class="{ 'is-active': combinedExportPictureDraftSource === 'original' }"
          @click="combinedExportPictureDraftSource = 'original'"
        >
          <div class="combined-export-picture-option-title">当前图片</div>
          <el-image
            v-if="combinedExportPictureOriginalSrc"
            class="combined-export-picture-option-image"
            :src="combinedExportPictureOriginalSrc"
            fit="contain"
          >
            <template #error>
              <div class="image-fallback combined-export-picture-option-image">无图</div>
            </template>
          </el-image>
          <div v-else class="image-fallback combined-export-picture-option-image">无图</div>
        </div>
        <div
          class="combined-export-picture-option"
          :class="{
            'is-active': combinedExportPictureDraftSource === 'category',
            'is-disabled': !combinedExportPictureCategoryMatches.length
          }"
          @click="selectCombinedExportPictureCategory"
        >
          <div class="combined-export-picture-option-title">产品分类图片</div>
          <el-image
            v-if="combinedExportPictureCategorySrc"
            class="combined-export-picture-option-image"
            :src="combinedExportPictureCategorySrc"
            fit="contain"
          >
            <template #error>
              <div class="image-fallback combined-export-picture-option-image">无图</div>
            </template>
          </el-image>
          <div v-else class="image-fallback combined-export-picture-option-image">暂无分类图片</div>
          <div
            v-if="combinedExportPictureCategoryMatches.length"
            class="combined-export-picture-category-meta"
          >
            <span class="combined-export-picture-category-name">
              {{ combinedExportPictureCategoryMatchLabel || '—' }}
            </span>
            <span class="combined-export-picture-category-counter">
              {{ combinedExportPictureCategoryIndex + 1 }} / {{ combinedExportPictureCategoryMatches.length }}
            </span>
          </div>
          <el-button
            v-if="combinedExportPictureCategoryMatches.length > 1"
            type="primary"
            plain
            size="small"
            @click.stop="showNextCombinedExportCategoryPicture"
          >
            下一张
          </el-button>
        </div>
        <div
          class="combined-export-picture-option"
          :class="{ 'is-active': combinedExportPictureDraftSource === 'upload' }"
          @click="combinedExportPictureDraftSource = 'upload'"
        >
          <div class="combined-export-picture-option-title">上传图片</div>
          <el-image
            v-if="combinedExportPictureUploadPreview"
            class="combined-export-picture-option-image"
            :src="combinedExportPictureUploadPreview"
            fit="contain"
          />
          <div v-else class="image-fallback combined-export-picture-option-image">未选择</div>
          <el-button type="primary" plain size="small" @click.stop="triggerCombinedExportPictureUpload">
            选择图片
          </el-button>
        </div>
      </div>
      <input
        ref="combinedExportPictureUploadInputRef"
        type="file"
        class="hidden-file-input"
        accept="image/png,image/jpeg,image/webp,image/*"
        @change="handleCombinedExportPictureUploadChange"
      >
      <template #footer>
        <el-button @click="combinedExportPictureDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCombinedExportPictureSelection">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Close, Rank } from '@element-plus/icons-vue'
import {
  getUnqualifiedProductFilterOptions,
  getUnqualifiedProductCheckedTreeNodes,
  getUnqualifiedProductNodeDetails,
  getUnqualifiedProductNodeDetailChart,
  getUnqualifiedProductStats,
  getUnqualifiedProductTree,
  getUnqualifiedProductTreeChildren,
  createOperationLog,
  updateCurrentUserProfile,
  listMyUnqualifiedDimensionPresets,
  createMyUnqualifiedDimensionPreset,
  deleteMyUnqualifiedDimensionPreset,
  saveUnqualifiedProductCopyText,
  recordUnqualifiedProductExportUsage,
  resolveUnqualifiedCategoryProductImages
} from '@/api/index'
import { currentUser, getAuthToken, getUserScopedStorageKey, setAuthSession } from '@/utils/auth'
import {
  getProductPictureStoredPath,
  resolveProductPictureAbsoluteUrl,
  resolveProductPictureSrc,
  resolveProductPictureSrcFromRow
} from '@/utils/productPicture.js'

const route = useRoute()
const router = useRouter()
const treeRef = ref(null)
/** 根节点全选/全消子节点时，避免级联 setCheckedKeys 触发的子节点 @check 重复拉明细 */
const syncingTreeCheckCascade = ref(false)
/** 「全选」拉取子树 key 后，懒加载子层插入时据此补勾选（el-tree 懒加载未展开节点默认无 Node） */
const fullTreeSelectAllKeysRef = shallowRef(null)
/** >0 时表示正在程序性改勾选，handleTreeCheck 勿清掉 fullTreeSelectAllKeysRef */
const programmaticTreeCheckLock = ref(0)
const treeRerenderKey = ref(0)
const treeLoading = ref(true)
/** 与维度树同一次 /tree 请求是否已结束，用于与懒加载的 data 空数组解耦 */
const treeListFetched = ref(false)
const pendingRootNodes = ref([])
const treeRootCount = ref(0)
const tableLoading = ref(false)
const exportingNodeDetails = ref(false)
const combinedExportPackaging = ref(false)
const treeReloadTimer = ref(null)
const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: 'is_leaf'
}
/** 懒加载树：由 load 的 resolve 写内部 store，这里保持空数组即可 */
const treeData = ref([])
const tableData = ref([])
const detailTableRef = ref(null)
/** 跨分页累积勾选的明细 id（paths + 筛选不变时保留） */
const detailTableSelectedIds = shallowRef(new Set())
/** 与 paths + buildTreeRequestParams 序列化一致；变化则丢弃跨页勾选 */
const detailTableSelectionScopeKey = ref('')
const syncingDetailTableSelectionDom = ref(false)
const detailTableSelectedCount = computed(() => detailTableSelectedIds.value.size)

/** 节点详情表：可选作图表分类轴的字段（与表格列、行数据一致） */
const NODE_DETAIL_CHART_FIELDS = [
  { key: 'source_publish_date', label: '日期' },
  { key: 'source_title', label: '来源通告' },
  { key: 'product_name', label: '产品名称' },
  { key: 'manufacturer_name', label: '生产企业' },
  { key: 'operator_name', label: '经营企业' },
  { key: 'manufacturer_province', label: '生产省份' },
  { key: 'manufacturer_city', label: '生产城市' },
  { key: 'sampled_province', label: '抽检省份' },
  { key: 'sampled_city', label: '抽检城市' },
  { key: 'unqualified_items', label: '不符合规定项目' },
  { key: 'product_type_label', label: '产品类型' },
  { key: 'announcement_type_label', label: '通告类型' },
  { key: 'product_category', label: '产品分类' },
  { key: 'issue_category', label: '问题类型' }
]

const DETAIL_CHART_TYPE_OPTIONS = [
  { value: 'pie', label: '饼图' },
  { value: 'bar', label: '柱状图' },
  { value: 'line', label: '折线图' }
]

function detailChartExportChoiceKey(chartType, dimensionKey) {
  return `${chartType}|${dimensionKey}`
}

const detailChartBulkExportChoices = computed(() => {
  const rows = []
  for (const t of DETAIL_CHART_TYPE_OPTIONS) {
    for (const f of NODE_DETAIL_CHART_FIELDS) {
      rows.push({
        key: detailChartExportChoiceKey(t.value, f.key),
        chartType: t.value,
        typeLabel: t.label,
        dimensionKey: f.key,
        dimensionLabel: f.label,
        label: `${t.label} · ${f.label}`
      })
    }
  }
  return rows
})

const detailChartDialogVisible = ref(false)
const detailChartType = ref('pie')
const detailChartDimension = ref('manufacturer_province')
/** 工具栏勾选：参与「导出压缩包」的统计字段（与当前图表类型组合） */
const detailChartExportDimensionKeys = ref(['manufacturer_province'])
const detailChartRef = ref(null)
/** 图表统计：服务端聚合后的分桶数据 */
const detailChartBuckets = ref([])
const detailChartDataLoading = ref(false)
const detailChartBulkExportDialogVisible = ref(false)
const detailChartBulkExportSelectedKeys = ref([])
const detailChartBulkExporting = ref(false)
let detailChartInstance = null
let echartsModulePromise = null
const videoCopyDialogVisible = ref(false)
const videoCopyText = ref('')
/** 与当前文案正文对应的产品明细 id（文案中「节选/勾选」出现的条目） */
const videoCopyProductIds = ref([])
const generatingVideoCopy = ref(false)
const savingVideoCopy = ref(false)
const combinedExportDialogVisible = ref(false)
const combinedExportLoading = ref(false)
const combinedExportRows = ref([])
const combinedExportCheckedNodes = ref([])
const combinedExportCopyText = ref('')
const combinedExportFoodBodyCopyText = ref('')
const combinedExportCopyEditMode = ref(false)
const combinedExportCopyTab = ref('scheme')
const combinedExportMainTab = ref('copy')
const combinedExportCategoryPictureMap = ref({})
const combinedExportPictureDialogVisible = ref(false)
const combinedExportPictureDialogLoading = ref(false)
const combinedExportPictureTargetRow = ref(null)
const combinedExportPictureDraftSource = ref('original')
const combinedExportPictureUploadFile = ref(null)
const combinedExportPictureUploadPreview = ref('')
const combinedExportPictureUploadInputRef = ref(null)
const combinedExportPictureCategoryIndex = ref(0)

const combinedExportFoodBodySegmentCount = computed(() => {
  const rows = combinedExportRows.value || []
  return rows.filter(
    (r) => String(r?.product_type || '').toLowerCase() === 'food' && String(r?.food_body_text ?? '').trim()
  ).length
})

const combinedExportActiveCopyModel = computed({
  get() {
    return combinedExportCopyTab.value === 'food_body'
      ? combinedExportFoodBodyCopyText.value
      : combinedExportCopyText.value
  },
  set(value) {
    if (combinedExportCopyTab.value === 'food_body') {
      combinedExportFoodBodyCopyText.value = value
    } else {
      combinedExportCopyText.value = value
    }
  }
})

const activeCombinedExportCopyText = computed(() => combinedExportActiveCopyModel.value)

function toggleCombinedExportCopyEdit() {
  combinedExportCopyEditMode.value = !combinedExportCopyEditMode.value
}

function buildCombinedExportCategoryPictureKey(productCategoryId, productName) {
  const id = Number.parseInt(String(productCategoryId ?? '').trim(), 10)
  const name = String(productName ?? '').trim()
  if (!Number.isFinite(id) || id <= 0 || !name) return ''
  return `${id}::${name}`
}

function getCombinedExportRowOriginalPictureStoredPath(row) {
  return getProductPictureStoredPath(row)
}

function getCombinedExportCategoryPictureEntry(row) {
  const key = buildCombinedExportCategoryPictureKey(row?.product_category_id, row?.product_name)
  if (!key) return null
  return combinedExportCategoryPictureMap.value[key] || null
}

function getCombinedExportCategoryPictureMatches(row) {
  const entry = getCombinedExportCategoryPictureEntry(row)
  const matches = Array.isArray(entry?.matches) ? entry.matches : []
  return matches.filter((item) => String(item?.image_url || '').trim())
}

function getCombinedExportCategoryPictureMatch(row, index = 0) {
  const matches = getCombinedExportCategoryPictureMatches(row)
  if (!matches.length) return null
  const safeIndex = ((Number(index) || 0) % matches.length + matches.length) % matches.length
  return matches[safeIndex] || matches[0]
}

function getCombinedExportCategoryPictureStoredPath(row, index = combinedExportPictureCategoryIndex.value) {
  const match = getCombinedExportCategoryPictureMatch(row, index)
  return String(match?.image_url || '').trim()
}

function resolveCombinedExportRowPictureSrc(row) {
  const overridePreview = String(row?.export_picture_override?.previewUrl || '').trim()
  if (overridePreview) return overridePreview
  return resolveProductPictureSrcFromRow(row)
}

const combinedExportPictureOriginalSrc = computed(() => {
  const row = combinedExportPictureTargetRow.value
  if (!row) return ''
  return resolveProductPictureSrc(getCombinedExportRowOriginalPictureStoredPath(row))
})

const combinedExportPictureCategoryMatches = computed(() =>
  getCombinedExportCategoryPictureMatches(combinedExportPictureTargetRow.value)
)

const combinedExportPictureCategorySrc = computed(() => {
  const match = getCombinedExportCategoryPictureMatch(
    combinedExportPictureTargetRow.value,
    combinedExportPictureCategoryIndex.value
  )
  return resolveProductPictureSrc(match?.image_url)
})

const combinedExportPictureCategoryMatchLabel = computed(() => {
  const match = getCombinedExportCategoryPictureMatch(
    combinedExportPictureTargetRow.value,
    combinedExportPictureCategoryIndex.value
  )
  return String(match?.abstract_name || '').trim()
})

function revokeCombinedExportPictureOverridePreview(override) {
  const previewUrl = String(override?.previewUrl || '').trim()
  if (previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl)
  }
}

function clearCombinedExportRowPictureOverride(row) {
  if (!row?.export_picture_override) return
  revokeCombinedExportPictureOverridePreview(row.export_picture_override)
  delete row.export_picture_override
}

function clearCombinedExportPictureUploadDraft() {
  const rowPreview = combinedExportPictureTargetRow.value?.export_picture_override?.previewUrl
  if (
    combinedExportPictureUploadPreview.value
    && combinedExportPictureUploadPreview.value !== rowPreview
  ) {
    URL.revokeObjectURL(combinedExportPictureUploadPreview.value)
  }
  combinedExportPictureUploadPreview.value = ''
  combinedExportPictureUploadFile.value = null
}

function resetCombinedExportPictureDialog() {
  combinedExportPictureTargetRow.value = null
  combinedExportPictureDraftSource.value = 'original'
  combinedExportPictureDialogLoading.value = false
  combinedExportPictureCategoryIndex.value = 0
  clearCombinedExportPictureUploadDraft()
  if (combinedExportPictureUploadInputRef.value) {
    combinedExportPictureUploadInputRef.value.value = ''
  }
}

function showNextCombinedExportCategoryPicture() {
  const matches = combinedExportPictureCategoryMatches.value
  if (matches.length <= 1) return
  combinedExportPictureCategoryIndex.value = (combinedExportPictureCategoryIndex.value + 1) % matches.length
  combinedExportPictureDraftSource.value = 'category'
}

function clearCombinedExportPictureSession() {
  for (const row of combinedExportRows.value || []) {
    clearCombinedExportRowPictureOverride(row)
  }
  combinedExportCategoryPictureMap.value = {}
  resetCombinedExportPictureDialog()
}

async function loadCombinedExportCategoryPictures(rows) {
  const list = Array.isArray(rows) ? rows : []
  const items = []
  const seen = new Set()
  for (const row of list) {
    const key = buildCombinedExportCategoryPictureKey(row?.product_category_id, row?.product_name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    items.push({
      product_category_id: row.product_category_id,
      product_name: row.product_name
    })
  }
  if (!items.length) {
    combinedExportCategoryPictureMap.value = {}
    return
  }

  const res = await resolveUnqualifiedCategoryProductImages({ items })
  const next = {}
  for (const item of res.data || []) {
    const key = buildCombinedExportCategoryPictureKey(item?.product_category_id, item?.product_name)
    if (!key) continue
    next[key] = item
  }
  combinedExportCategoryPictureMap.value = next
}

async function ensureCombinedExportCategoryPictureForRow(row) {
  const key = buildCombinedExportCategoryPictureKey(row?.product_category_id, row?.product_name)
  if (!key || combinedExportCategoryPictureMap.value[key]) return
  combinedExportPictureDialogLoading.value = true
  try {
    const res = await resolveUnqualifiedCategoryProductImages({
      items: [{
        product_category_id: row.product_category_id,
        product_name: row.product_name
      }]
    })
    const item = Array.isArray(res.data) ? res.data[0] : null
    if (item) {
      combinedExportCategoryPictureMap.value = {
        ...combinedExportCategoryPictureMap.value,
        [key]: item
      }
    }
  } finally {
    combinedExportPictureDialogLoading.value = false
  }
}

async function openCombinedExportPictureDialog(row) {
  if (!row) return
  combinedExportPictureTargetRow.value = row
  combinedExportPictureDraftSource.value = row.export_picture_override?.source || 'original'
  combinedExportPictureCategoryIndex.value = Number.isFinite(row.export_picture_override?.categoryMatchIndex)
    ? row.export_picture_override.categoryMatchIndex
    : 0
  clearCombinedExportPictureUploadDraft()
  if (combinedExportPictureDraftSource.value === 'upload' && row.export_picture_override?.blob) {
    combinedExportPictureUploadFile.value = row.export_picture_override.blob
    combinedExportPictureUploadPreview.value = row.export_picture_override.previewUrl
      || URL.createObjectURL(row.export_picture_override.blob)
  }
  combinedExportPictureDialogVisible.value = true
  await ensureCombinedExportCategoryPictureForRow(row)
  const matches = getCombinedExportCategoryPictureMatches(row)
  if (matches.length) {
    const savedIndex = Number(row.export_picture_override?.categoryMatchIndex)
    combinedExportPictureCategoryIndex.value = Number.isFinite(savedIndex)
      ? ((savedIndex % matches.length) + matches.length) % matches.length
      : 0
  } else {
    combinedExportPictureCategoryIndex.value = 0
  }
}

function selectCombinedExportPictureCategory() {
  if (!combinedExportPictureCategoryMatches.value.length) {
    ElMessage.warning('当前产品暂无匹配的分类目录图片')
    return
  }
  combinedExportPictureDraftSource.value = 'category'
}

function triggerCombinedExportPictureUpload() {
  combinedExportPictureDraftSource.value = 'upload'
  combinedExportPictureUploadInputRef.value?.click()
}

function handleCombinedExportPictureUploadChange(event) {
  const input = event.target
  const file = input?.files?.[0]
  if (input) input.value = ''
  if (!file) return

  const nameLower = String(file.name || '').toLowerCase()
  if (!file.type?.startsWith('image/') && !/\.(png|jpe?g|webp)$/i.test(nameLower)) {
    ElMessage.warning('请选择 PNG、JPEG 或 WebP 图片')
    return
  }

  clearCombinedExportPictureUploadDraft()
  combinedExportPictureUploadFile.value = file
  combinedExportPictureUploadPreview.value = URL.createObjectURL(file)
  combinedExportPictureDraftSource.value = 'upload'
}

function buildCombinedExportRowPictureOverride(row, source) {
  if (source === 'original') {
    return null
  }
  if (source === 'category') {
    const match = getCombinedExportCategoryPictureMatch(row, combinedExportPictureCategoryIndex.value)
    const storedPath = String(match?.image_url || '').trim()
    if (!storedPath) return null
    return {
      source: 'category',
      storedPath,
      previewUrl: resolveProductPictureSrc(storedPath),
      categoryMatchIndex: combinedExportPictureCategoryIndex.value,
      abstractName: match?.abstract_name || '',
      blob: null
    }
  }
  if (source === 'upload') {
    const file = combinedExportPictureUploadFile.value
    if (!file) return null
    return {
      source: 'upload',
      storedPath: '',
      previewUrl: URL.createObjectURL(file),
      blob: file
    }
  }
  return null
}

function confirmCombinedExportPictureSelection() {
  const row = combinedExportPictureTargetRow.value
  if (!row) return

  const source = combinedExportPictureDraftSource.value
  if (source === 'category' && !combinedExportPictureCategoryMatches.value.length) {
    ElMessage.warning('当前产品暂无匹配的分类目录图片')
    return
  }
  if (source === 'upload' && !combinedExportPictureUploadFile.value) {
    ElMessage.warning('请先选择要上传的图片')
    return
  }

  clearCombinedExportRowPictureOverride(row)
  const override = buildCombinedExportRowPictureOverride(row, source)
  if (override) {
    row.export_picture_override = override
  }

  const idx = combinedExportRows.value.findIndex((item) => item?.id === row.id)
  if (idx >= 0) {
    combinedExportRows.value[idx] = { ...combinedExportRows.value[idx], export_picture_override: row.export_picture_override }
  }

  combinedExportPictureDialogVisible.value = false
}

async function fetchCombinedExportRowImageBlob(row) {
  const override = row?.export_picture_override
  if (override?.blob instanceof Blob) {
    return override.blob
  }

  const storedPath = String(override?.storedPath || getProductPictureStoredPath(row) || '').trim()
  const fetchUrl = resolveProductPictureAbsoluteUrl(storedPath)
  if (!fetchUrl) return null

  const sameOrigin = fetchUrl.startsWith(window.location.origin)
  const res = await fetch(fetchUrl, {
    cache: 'no-store',
    credentials: sameOrigin ? 'same-origin' : 'omit',
    mode: 'cors'
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  if (!String(blob?.type || '').startsWith('image/')) {
    throw new Error('响应非图片类型')
  }
  return blob
}

function loadEchartsModule() {
  if (!echartsModulePromise) {
    echartsModulePromise = import('echarts').then((mod) => mod.default || mod)
  }
  return echartsModulePromise
}

async function loadExcelJSModule() {
  const mod = await import('exceljs')
  return mod.default || mod
}

async function loadJSZipModule() {
  const mod = await import('jszip')
  return mod.default || mod
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 食品抽检不合格记录：与详情页一致，不展示化妆品式注册/备案、生产许可等字段 */
function isUnqualifiedFoodRow(row) {
  return String(row?.product_type || '').toLowerCase() === 'food'
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

function buildDetailChartOptionSpec(dimensionKey, chartType, buckets, { forExport = false } = {}) {
  const type = chartType
  let items = (buckets || []).length
    ? sortDetailChartItems([...buckets], dimensionKey)
    : []
  const animPartial = forExport ? { animation: false, animationDuration: 0 } : {}
  if (!items.length) {
    return {
      ...animPartial,
      title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#909399', fontSize: 14 } },
      xAxis: { show: false },
      yAxis: { show: false },
      series: []
    }
  }
  if (type === 'pie') {
    items = trimChartCategories(items)
  } else {
    items = items.slice(0, DETAIL_CHART_MAX_CATEGORIES)
  }
  const names = items.map((x) => x.name)
  const values = items.map((x) => x.value)
  const labelText = NODE_DETAIL_CHART_FIELDS.find((f) => f.key === dimensionKey)?.label || dimensionKey

  if (type === 'pie') {
    return {
      ...animPartial,
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
    ...animPartial,
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

function buildDetailChartOption() {
  return buildDetailChartOptionSpec(
    detailChartDimension.value,
    detailChartType.value,
    detailChartBuckets.value
  )
}

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl || '').split(',')
  if (parts.length < 2) return new Blob([], { type: 'image/png' })
  const head = parts[0]
  const base64 = parts.slice(1).join(',')
  const mimeMatch = head.match(/data:([^;]+)/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  try {
    const binary = atob(base64)
    const arr = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      arr[i] = binary.charCodeAt(i)
    }
    return new Blob([arr], { type: mime })
  } catch {
    return new Blob([], { type: mime })
  }
}

/** 离屏渲染单张图表 PNG（批量导出） */
async function renderDetailChartToPngBlob(dimensionKey, chartType, buckets) {
  const echarts = await loadEchartsModule()
  const div = document.createElement('div')
  const W = 1080
  const H = 640
  div.style.cssText = `width:${W}px;height:${H}px;position:fixed;left:-12000px;top:0;visibility:hidden`
  document.body.appendChild(div)
  let chart = null
  try {
    chart = echarts.init(div, null, { renderer: 'canvas', width: W, height: H, devicePixelRatio: 2 })
    const opt = buildDetailChartOptionSpec(dimensionKey, chartType, buckets, { forExport: true })
    chart.setOption(opt, true)
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 140)))
    })
    const dataUrl = chart.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#ffffff'
    })
    return dataUrlToBlob(dataUrl)
  } finally {
    chart?.dispose()
    div.remove()
  }
}

async function updateDetailChart() {
  if (!detailChartDialogVisible.value || !detailChartRef.value) {
    return
  }
  const echarts = await loadEchartsModule()
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

function appliedDimensionOrderStorageKey() {
  return getUserScopedStorageKey(APPLIED_DIMENSION_ORDER_STORAGE_KEY)
}

function appliedDimensionHistoryStorageKey() {
  return getUserScopedStorageKey(APPLIED_DIMENSION_HISTORY_STORAGE_KEY)
}
const availableDimensions = ref([])
const dimensionOrder = ref([...DEFAULT_DIMENSION_ORDER])
const dimensionDraft = ref([...DEFAULT_DIMENSION_ORDER])
/** 行标签顺序（与数据透视表行字段一致），最多 5 项 */
const hierarchyRow = ref([...DEFAULT_DIMENSION_ORDER])
const appliedDimensionHistory = ref([])
const categorySettingDialogVisible = ref(false)
const dimensionPresetName = ref('')
const savingDimensionPreset = ref(false)
/** 服务端保存的方案（标题表 + 关联表），供「猜你想用」优先展示 */
const serverSavedDimensionPresets = ref([])
const SAVED_DIMENSION_PRESETS_TTL_MS = 30_000
let savedDimensionPresetsPromise = null
let savedDimensionPresetsFetchedAt = 0
/** 分类卡片 header：方案主题下拉当前选中 id */
const themePresetSelectValue = ref(null)
const deletingPresetId = ref(null)

const themePresetDropdownEnabled = computed(() => Boolean(currentUser.value?.id))
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

/** 仅食品类产品/食品抽检通告场景展示「食品正文」导出 Tab（须在 filters 声明之后，避免 TDZ） */
const showCombinedExportFoodBodyTab = computed(() => {
  if (String(filters.value.product_type || '').toLowerCase() === 'food') return true
  const rows = combinedExportRows.value || []
  return rows.some((r) => String(r?.product_type || '').toLowerCase() === 'food')
})

watch(showCombinedExportFoodBodyTab, (visible) => {
  if (!visible && combinedExportCopyTab.value === 'food_body') {
    combinedExportCopyTab.value = 'scheme'
  }
})

watch(combinedExportCopyTab, () => {
  combinedExportCopyEditMode.value = false
})

watch(combinedExportDialogVisible, (visible) => {
  if (!visible) {
    combinedExportCopyEditMode.value = false
    clearCombinedExportPictureSession()
  }
})

const pagination = ref({
  page: 1,
  limit: 10,
  total: 0
})
const detailSort = ref({
  prop: '',
  order: ''
})
let treeRequestController = null
let detailRequestController = null
const nodeDetailInflight = new Map()
let loadNodeDetailsDebounceTimer = null

function getNodeDetailRequestSignature(pathsPayload) {
  return JSON.stringify({
    paths: pathsPayload,
    q: { ...buildTreeRequestParams(), ...buildDetailSortParams() },
    page: pagination.value.page,
    limit: pagination.value.limit
  })
}

function scheduleLoadNodeDetailsDebounced() {
  window.clearTimeout(loadNodeDetailsDebounceTimer)
  loadNodeDetailsDebounceTimer = window.setTimeout(() => {
    loadNodeDetailsDebounceTimer = null
    void loadNodeDetails()
  }, 120)
}

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
const treeCanSelectAll = computed(() => treeListFetched.value && pendingRootNodes.value.length > 0)
const treeCheckedKeyCount = ref(0)
const treeHasCheckedNodes = computed(() => treeCheckedKeyCount.value > 0)

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

/** 服务端已命名方案优先，其余为本机最近应用的层级（按维度顺序去重） */
const dimensionPresetPickList = computed(() => {
  const seen = new Set()
  const out = []
  for (const p of serverSavedDimensionPresets.value) {
    const order = normalizeDimensionOrder(p.dimension_order || [])
    const sig = order.join('|')
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push({
      key: `srv-${p.id}`,
      label: String(p.title || '').trim() || order.map((key) => getDimensionLabel(key)).join(' / '),
      order
    })
  }
  for (const order of appliedDimensionHistory.value) {
    const normalized = normalizeDimensionOrder(order)
    const sig = normalized.join('|')
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push({
      key: sig,
      label: normalized.map((key) => getDimensionLabel(key)).join(' / '),
      order: normalized
    })
  }
  return out.slice(0, 24)
})

async function fetchSavedDimensionPresets({ force = false } = {}) {
  if (!getAuthToken()) {
    serverSavedDimensionPresets.value = []
    themePresetSelectValue.value = null
    savedDimensionPresetsFetchedAt = 0
    return
  }
  if (!force) {
    if (savedDimensionPresetsPromise) {
      return savedDimensionPresetsPromise
    }
    if (Date.now() - savedDimensionPresetsFetchedAt < SAVED_DIMENSION_PRESETS_TTL_MS) {
      return serverSavedDimensionPresets.value
    }
  }
  savedDimensionPresetsPromise = (async () => {
    try {
      const res = await listMyUnqualifiedDimensionPresets()
      serverSavedDimensionPresets.value = Array.isArray(res.data) ? res.data : []
      savedDimensionPresetsFetchedAt = Date.now()
      if (
        themePresetSelectValue.value != null
        && !serverSavedDimensionPresets.value.some((x) => x.id === themePresetSelectValue.value)
      ) {
        themePresetSelectValue.value = null
      }
      return serverSavedDimensionPresets.value
    } catch {
      serverSavedDimensionPresets.value = []
      savedDimensionPresetsFetchedAt = 0
      return []
    } finally {
      savedDimensionPresetsPromise = null
    }
  })()
  return savedDimensionPresetsPromise
}

function onThemePresetDropdownVisible(visible) {
  if (visible) {
    fetchSavedDimensionPresets()
  }
}

function onThemePresetSelected(id) {
  if (id == null || id === '') {
    return
  }
  const preset = serverSavedDimensionPresets.value.find((x) => x.id === id)
  if (!preset) {
    return
  }
  applySavedDimensionPreset(preset.dimension_order || [])
}

async function confirmDeleteDimensionPreset(p) {
  if (!p?.id || deletingPresetId.value) {
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除方案「${String(p.title || '').trim() || '未命名'}」？`, '删除方案', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  deletingPresetId.value = p.id
  try {
    await deleteMyUnqualifiedDimensionPreset(p.id)
    ElMessage.success('已删除')
    if (themePresetSelectValue.value === p.id) {
      themePresetSelectValue.value = null
    }
    serverSavedDimensionPresets.value = serverSavedDimensionPresets.value.filter((x) => x.id !== p.id)
  } catch {
    await fetchSavedDimensionPresets({ force: true })
  } finally {
    deletingPresetId.value = null
  }
}

function openCategorySettingDialog() {
  const suggested = hierarchyRow.value.map((k) => getDimensionLabel(k)).join(' / ')
  dimensionPresetName.value =
    String(currentUser.value?.unqualified_dimension_preset_name || '').trim() || suggested
  categorySettingDialogVisible.value = true
  fetchSavedDimensionPresets()
}

function onCategorySettingDialogClosed() {
  savingDimensionPreset.value = false
}

async function applyCategoryDimensionWithName() {
  const name = String(dimensionPresetName.value || '').trim()
  if (!name) {
    ElMessage.warning('请填写层级名称')
    return
  }
  savingDimensionPreset.value = true
  try {
    applyDimensionDraft()
    const order = normalizeDimensionOrder([...dimensionOrder.value])
    if (getAuthToken()) {
      await createMyUnqualifiedDimensionPreset({ title: name, dimension_order: order })
    }
    const res = await updateCurrentUserProfile({ unqualified_dimension_preset_name: name })
    const next = res.data
    if (next) {
      setAuthSession(getAuthToken(), next)
    }
    await fetchSavedDimensionPresets({ force: true })
    ElMessage.success('层级已应用并保存名称')
    categorySettingDialogVisible.value = false
  } finally {
    savingDimensionPreset.value = false
  }
}

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

function resetHierarchy() {
  hierarchyRow.value = []
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
    const raw = localStorage.getItem(appliedDimensionOrderStorageKey())
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
    localStorage.setItem(appliedDimensionOrderStorageKey(), JSON.stringify(normalized))
  } catch {
    /* ignore storage quota / private mode */
  }
}

function clearSavedAppliedDimensionOrder() {
  try {
    localStorage.removeItem(appliedDimensionOrderStorageKey())
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
    const raw = localStorage.getItem(appliedDimensionHistoryStorageKey())
    if (!raw) return []
    return normalizeDimensionHistory(JSON.parse(raw))
  } catch {
    return []
  }
}

function persistAppliedDimensionHistory(history) {
  try {
    const normalized = normalizeDimensionHistory(history)
    localStorage.setItem(appliedDimensionHistoryStorageKey(), JSON.stringify(normalized))
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
  const out = {
    ...base,
    year_start: String(base.year_start ?? '').trim(),
    year_end: String(base.year_end ?? '').trim(),
    dimension_order: JSON.stringify(dimensionOrder.value)
  }
  if (themePresetSelectValue.value != null && themePresetSelectValue.value !== '') {
    out.dimension_preset_id = themePresetSelectValue.value
  }
  return out
}

function buildTreeChildrenRequestParams(parentPath = {}, parentLabels = {}) {
  return {
    ...buildTreeRequestParams(),
    parent_path: JSON.stringify(parentPath || {}),
    parent_labels: JSON.stringify(parentLabels || {})
  }
}

function buildDetailSortParams() {
  if (detailSort.value.prop !== 'usage_count' || !detailSort.value.order) {
    return {}
  }

  return {
    sort_by: 'usage_count',
    sort_order: detailSort.value.order === 'ascending' ? 'asc' : 'desc'
  }
}

const DEFAULT_FILTER_YEAR_START = '2026'
const DEFAULT_FILTER_FOOD_TYPE = 'food'

function createDefaultFilters() {
  return {
    keyword: '',
    company_keyword: '',
    source_keyword: '',
    unqualified_item: '',
    issue_items: [],
    product_category: '',
    product_type: DEFAULT_FILTER_FOOD_TYPE,
    announcement_type: '',
    province: '',
    manufacturer_province: '',
    sampled_province: '',
    year_start: DEFAULT_FILTER_YEAR_START,
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
    product_type: String(route.query.product_type || DEFAULT_FILTER_FOOD_TYPE),
    announcement_type: String(route.query.announcement_type || ''),
    province: String(route.query.province || ''),
    manufacturer_province: normalizeProvinceToStandard(route.query.manufacturer_province ?? '') || '',
    sampled_province: normalizeProvinceToStandard(route.query.sampled_province ?? '') || '',
    year_start: String(route.query.year_start || fallbackYear || DEFAULT_FILTER_YEAR_START),
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

// const activeYearLabel = computed(() => {
//   const start = filters.value.year_start
//   const end = filters.value.year_end
//   if (start && end) return `${start}年 - ${end}年`
//   if (start) return `${start}年起`
//   if (end) return `截至${end}年`
//   return ''
// })

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

/**
 * 中国全部省级行政区标准全称（含直辖市、自治区、特别行政区；台湾省按惯例列出便于数据归一）。
 * 用于将库内各类写法归并为统一展示名。
 */
const STANDARD_CN_PROVINCES = Object.freeze([
  '北京市',
  '天津市',
  '上海市',
  '重庆市',
  '河北省',
  '山西省',
  '辽宁省',
  '吉林省',
  '黑龙江省',
  '江苏省',
  '浙江省',
  '安徽省',
  '福建省',
  '江西省',
  '山东省',
  '河南省',
  '湖北省',
  '湖南省',
  '广东省',
  '海南省',
  '四川省',
  '贵州省',
  '云南省',
  '陕西省',
  '甘肃省',
  '青海省',
  '台湾省',
  '内蒙古自治区',
  '广西壮族自治区',
  '西藏自治区',
  '宁夏回族自治区',
  '新疆维吾尔自治区',
  '香港特别行政区',
  '澳门特别行政区'
])

const STANDARD_CN_PROVINCE_SET = new Set(STANDARD_CN_PROVINCES)
/** 优先匹配长名称，避免「黑龙江」误套「黑」等极端情况；本省名互相区分靠全称长度 */
const STANDARD_CN_PROVINCES_BY_LENGTH = [...STANDARD_CN_PROVINCES].sort((a, b) => b.length - a.length)

function buildProvinceAliasToCanonical() {
  const m = new Map()
  for (const p of STANDARD_CN_PROVINCES) {
    m.set(p, p)
  }
  for (const p of STANDARD_CN_PROVINCES) {
    if (p.endsWith('特别行政区')) {
      m.set(p.replace(/特别行政区$/, ''), p)
    } else if (p.endsWith('自治区')) {
      const short = p
        .replace(/壮族自治区$/, '')
        .replace(/维吾尔自治区$/, '')
        .replace(/回族自治区$/, '')
        .replace(/自治区$/, '')
      if (short) {
        m.set(short, p)
      }
    } else if (p.endsWith('省')) {
      m.set(p.slice(0, -1), p)
    } else if (p.endsWith('市')) {
      m.set(p.slice(0, -1), p)
    }
  }
  const extras = [
    ['内蒙', '内蒙古自治区'],
    ['广西省', '广西壮族自治区'],
    ['新疆自治区', '新疆维吾尔自治区'],
    ['中国香港', '香港特别行政区'],
    ['中国澳门', '澳门特别行政区'],
    ['中国台湾', '台湾省'],
    ['台湾地区', '台湾省']
  ]
  for (const [alias, canonical] of extras) {
    if (!m.has(alias)) {
      m.set(alias, canonical)
    }
  }
  return m
}

const PROVINCE_ALIAS_TO_CANONICAL = buildProvinceAliasToCanonical()

/** 去掉字段里常见前缀噪音，便于匹配标准省名 */
function stripProvinceFieldNoise(raw) {
  return copyTextValue(raw)
    .replace(/^(注册人|备案人|境内责任人|标称生产企业)[：:]\s*/, '')
    .replace(/^(生产企业|生产地|产地)[：:]\s*/u, '')
    .trim()
}

/**
 * 将库内省份字符串归并为 STANDARD_CN_PROVINCES 中的标准全称；无法识别时返回去前缀后的原文。
 */
function normalizeProvinceToStandard(raw) {
  const text = stripProvinceFieldNoise(raw)
  if (!text) return ''
  if (STANDARD_CN_PROVINCE_SET.has(text)) return text
  const collapsed = text.replace(/\s+/g, '')
  if (STANDARD_CN_PROVINCE_SET.has(collapsed)) return collapsed
  const mapped = PROVINCE_ALIAS_TO_CANONICAL.get(text) || PROVINCE_ALIAS_TO_CANONICAL.get(collapsed)
  if (mapped) return mapped
  for (const p of STANDARD_CN_PROVINCES_BY_LENGTH) {
    if (text.includes(p) || collapsed.includes(p)) {
      return p
    }
  }
  return text
}

/**
 * 去掉中英文括号及其中内容（可反复剥离嵌套），用于树节点上「省/市+备注」与标准名归并展示。
 */
function stripParentheticalNotes(raw) {
  let s = copyTextValue(raw)
  if (!s) return ''
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return s
}

function formatProvinceCityDisplay(provinceRaw, cityRaw) {
  const p = normalizeProvinceToStandard(provinceRaw)
  const c = normalizeCityToStandard(cityRaw)
  const parts = [p, c].filter(Boolean)
  return parts.length ? parts.join(' / ') : '-'
}

function normalizeCityToStandard(raw) {
  const text = copyTextValue(raw)
  if (!text || text === '未标注' || text === '未标注城市') return ''
  if (['北京市', '天津市', '上海市', '重庆市'].includes(text)) return text
  const match = text.match(/([\u4e00-\u9fa5]{2,20}?(?:市|自治州|地区|盟))/)
  if (match) return match[1]
  if (/^[\u4e00-\u9fa5]{2,20}$/.test(text)) return `${text}市`
  return text
}

function normalizeTreeRegionLabel(item = {}) {
  const dimension = item.dimension
  const raw = item.label ?? item.value
  if (['province', 'manufacturer_province', 'sampled_province'].includes(dimension)) {
    const stripped = stripParentheticalNotes(raw)
    const forNorm = stripped !== '' ? stripped : copyTextValue(raw)
    return normalizeProvinceToStandard(forNorm) || copyTextValue(raw)
  }
  if (['manufacturer_city', 'sampled_city'].includes(dimension)) {
    const stripped = stripParentheticalNotes(raw)
    const forNorm = stripped !== '' ? stripped : copyTextValue(raw)
    return normalizeCityToStandard(forNorm) || copyTextValue(raw)
  }
  return item.label
}

/** 省份筛选项：接口中的各类写法合并为标准全称，下拉 label/value 均为标准省名 */
function mergeProvinceSelectOptions(items = []) {
  const byCanon = new Map()
  for (const item of items) {
    const raw = copyTextValue(item?.value ?? item?.label ?? '')
    if (!raw) continue
    const canon = normalizeProvinceToStandard(raw)
    if (!canon) continue
    if (!byCanon.has(canon)) {
      byCanon.set(canon, { value: canon, label: canon })
    }
  }
  return Array.from(byCanon.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
}

/** 图表统计、文案等：省份统一为标准全称，合并「广东」「广东省」等写法 */
function cleanProvinceLabel(raw) {
  return normalizeProvinceToStandard(raw)
}

function formatCopyList(items, max = 6) {
  const list = (items || []).filter(Boolean)
  if (!list.length) return ''
  const head = list.slice(0, max).join('、')
  return list.length > max ? `${head}等` : head
}

function getUsageUserRecords(raw) {
  if (raw == null || raw === '') return []
  let parsed = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed) || !parsed.length) return []
  return parsed
    .map((item) => ({
      username: String(item?.username || '').trim(),
      display_name: String(item?.display_name || item?.username || '').trim(),
      saved_at: item?.saved_at || ''
    }))
    .filter((item) => item.username)
}

/** usage_user：后端 JSON 数组 [{ username, display_name, saved_at }] → 去重后的用户名，中文分号分隔 */
function formatUsageUsernamesDisplay(raw) {
  const records = getUsageUserRecords(raw)
  if (!records.length) return '-'
  const seen = new Set()
  const names = []
  for (const item of records) {
    const u = item.username
    if (!u || seen.has(u)) continue
    seen.add(u)
    names.push(item.display_name || u)
  }
  return names.length ? names.join('；') : '-'
}

function formatUsageSavedAt(value) {
  if (!value) return '时间未记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

function formatUsageCount(row) {
  const raw = row?.usage_count
  if (raw !== null && raw !== undefined && raw !== '') {
    const count = Number(raw)
    if (Number.isFinite(count)) {
      return count
    }
  }
  return getUsageUserRecords(row?.usage_user).length || 0
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
  const head = sorted.slice(0, 3).map(([name, count]) => `${name}`).join('、')
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
  console.log(row)
  const producer = extractProducerForVoice(row?.manufacturer_name || row?.company_names)
  const sales = extractProducerForVoice(row?.operator_name || row?.manufacturer_name)
  const region = regionForSampling(row?.operator_address)
    || regionForSampling(row?.sample_unit_address)
    || regionForSampling(row?.sampled_province)
    || cleanProvinceLabel(row?.product_region)
  const issues = issuesForVoice(row?.unqualified_items)

  const head = producer && product && sales
    ? `由${producer}生产，${sales}销售的${product}`
    : (product || (producer ? `${producer}相关批次产品` : '有关产品'))
  // const middle = region ? `在${region}抽检时` : '在通报所列抽检环节中'
  // const middle = sales ? `${sales}经销的` : '在通报所列抽检环节中'
  const tail = issues ? `检出${issues}不符合要求` : '检出情况见通报原文'
  return `${head}，${tail}。`
}

function getVideoCopyProductLineRows(rows, fromTableSelection) {
  return fromTableSelection
    ? [...(rows || [])]
    : pickVideoCopyRows(rows || [], VIDEO_COPY_PRODUCT_LIMIT)
}

/** 视频/导出文案开头的两段统计口径说明（与 Tab「当前文案生成方案」一致） */
function buildVideoCopyPreambleParts(rows, fromTableSelection) {
  const sourceTitles = uniqueCopyValues((rows || []).map((row) => row?.source_title || row?.batch_title))
  const problemTypes = uniqueCopyValues((rows || []).map((row) => row?.issue_category || row?.announcement_type_label))
  const categories = uniqueCopyValues((rows || []).flatMap((row) => [row?.product_category, row?.product_type_label]))
  const provincePhrase = topProvincePhrase(rows) || '多地'

  return [
    fromTableSelection
      ? `据本次在明细表中勾选的产品梳理，共涉及通告 ${sourceTitles.length} 份、不合格记录 ${(rows || []).length} 条。`
      : `据本次资料梳理，共涉及通告 ${sourceTitles.length} 份、不合格记录 ${(rows || []).length} 条。`,
    `根据${formatCopyList(sourceTitles, 4)}，本次共发现${formatCopyList(problemTypes, 8)}等情况，涵盖${formatCopyList(categories, 8)}等品类，样本主要分布在${provincePhrase}。`
  ]
}

/** 导出弹窗 Tab「食品正文」：前两段复用 preamble，接「以下为勾选的 N 个产品：」，再接序号 food_body_text */
function buildCombinedExportFoodBodyFullCopy(rows) {
  const preamble = buildVideoCopyPreambleParts(rows || [], true).join('\n')
  const segments = []
  for (const row of rows || []) {
    if (String(row?.product_type || '').toLowerCase() !== 'food') continue
    const t = String(row?.food_body_text ?? '').trim()
    if (t) segments.push(t)
  }
  if (!segments.length) return preamble
  const n = segments.length
  const numbered = segments.map((t, i) => `${i + 1}. ${t}`)
  const joined = numbered.join('\n')
  return `${preamble}\n以下为勾选的 ${n} 个产品：\n${joined}`
}

function buildVideoCopyTextShared(rows, fromTableSelection) {
  const lines = [...buildVideoCopyPreambleParts(rows, fromTableSelection)]
  const productLinesRows = getVideoCopyProductLineRows(rows, fromTableSelection)

  if (productLinesRows.length) {
    lines.push(
      fromTableSelection
        ? `以下为勾选的 ${productLinesRows.length} 个产品：`
        : `以下按通报节选 ${productLinesRows.length} 个典型产品：`
    )
    productLinesRows.forEach((row, index) => {
      lines.push(`${index + 1}. ${buildVideoProductLine(row)}`)
    })
  }

  return lines.join('\n')
}

function buildVideoCopyText(rows) {
  return buildVideoCopyTextShared(rows, false)
}

/** 仅基于表格已勾选行（调用方已按 id 筛好）生成文案 */
function buildVideoCopyTextForSelectedRows(rows) {
  return buildVideoCopyTextShared(rows, true)
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
    videoCopyProductIds.value = []
    const allRows = await fetchAllNodeDetailRows(pathsPayload)
    if (!allRows.length) {
      videoCopyText.value = ''
      videoCopyProductIds.value = []
      ElMessage.warning('当前范围没有可生成文案的明细')
      return
    }
    const selectedIds = detailTableSelectedIds.value
    if (selectedIds.size > 0) {
      const rowsForCopy = allRows.filter((r) => r?.id != null && selectedIds.has(r.id))
      if (!rowsForCopy.length) {
        videoCopyText.value = ''
        videoCopyProductIds.value = []
        ElMessage.warning('当前勾选的产品在所选范围内未匹配到明细，请刷新列表或重新勾选后再试')
        return
      }
      videoCopyText.value = buildVideoCopyTextForSelectedRows(rowsForCopy)
      videoCopyProductIds.value = getVideoCopyProductLineRows(rowsForCopy, true)
        .map((r) => r?.id)
        .filter((id) => id != null && id !== '')
      await recordVideoCopyLog(rowsForCopy, videoCopyText.value)
    } else {
      videoCopyText.value = buildVideoCopyText(allRows)
      videoCopyProductIds.value = getVideoCopyProductLineRows(allRows, false)
        .map((r) => r?.id)
        .filter((id) => id != null && id !== '')
      await recordVideoCopyLog(allRows, videoCopyText.value)
    }
  } catch (error) {
    console.error('生成视频文案失败:', error)
    ElMessage.error(error?.message || '生成视频文案失败')
    videoCopyText.value = ''
    videoCopyProductIds.value = []
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

async function saveVideoCopyText() {
  if (!videoCopyText.value) return
  if (!currentUser.value?.id) {
    ElMessage.warning('请先登录后再保存')
    return
  }
  savingVideoCopy.value = true
  try {
    await saveUnqualifiedProductCopyText({
      copy_text: videoCopyText.value,
      product_ids: [...videoCopyProductIds.value],
      dimension_label: buildCurrentDimensionLabel(),
      range_label: buildCurrentRangeLabel()
    })
    ElMessage.success('保存成功')
    await loadNodeDetails()
  } catch {
    /* request 拦截器已提示 */
  } finally {
    savingVideoCopy.value = false
  }
}

async function buildCombinedExportPayload() {
  const pathsPayload = getNodeDetailsPathsPayload()
  const checkedPathsPayload = getCheckedTreePathsPayload()
  if (!pathsPayload.length) {
    ElMessage.warning('没有可导出的范围，请先在维度树选择节点')
    return null
  }
  if (!(pagination.value.total > 0)) {
    ElMessage.warning('当前没有可导出的明细')
    return null
  }

  const allRows = await fetchAllNodeDetailRows(pathsPayload)
  if (!allRows.length) {
    ElMessage.warning('当前范围没有可导出的明细')
    return null
  }

  const order = dimensionOrder.value?.length ? dimensionOrder.value : DEFAULT_DIMENSION_ORDER
  const checkedRes = checkedPathsPayload.length
    ? await getUnqualifiedProductCheckedTreeNodes({
      ...buildTreeRequestParams(),
      paths: checkedPathsPayload,
      dimension_order: JSON.stringify(order)
    })
    : { data: [] }
  const checked = sortCheckedTreeNodesByPath(order, checkedRes.data || [])

  const selectedIds = detailTableSelectedIds.value
  if (!selectedIds.size) {
    ElMessage.warning('请先在明细表格勾选要导出的产品')
    return null
  }
  const rowsForExport = allRows.filter((row) => row?.id != null && selectedIds.has(row.id))

  if (!rowsForExport.length) {
    ElMessage.warning('当前勾选的产品在所选范围内未匹配到明细，请刷新列表或重新勾选后再试')
    return null
  }

  const copyText = buildVideoCopyTextForSelectedRows(rowsForExport)

  return {
    exportRows: rowsForExport,
    checked,
    copyText,
    rowsForCopy: rowsForExport
  }
}

async function openCombinedExportDialog() {
  if (combinedExportLoading.value) return
  combinedExportDialogVisible.value = true
  combinedExportLoading.value = true
  combinedExportRows.value = []
  combinedExportCheckedNodes.value = []
  combinedExportCopyText.value = ''
  combinedExportFoodBodyCopyText.value = ''
  combinedExportCopyEditMode.value = false
  combinedExportCopyTab.value = 'scheme'
  combinedExportMainTab.value = 'copy'
  clearCombinedExportPictureSession()

  try {
    const payload = await buildCombinedExportPayload()
    if (!payload) {
      combinedExportDialogVisible.value = false
      return
    }
    combinedExportRows.value = payload.exportRows
    combinedExportCheckedNodes.value = payload.checked
    combinedExportCopyText.value = payload.copyText
    combinedExportFoodBodyCopyText.value = buildCombinedExportFoodBodyFullCopy(payload.exportRows)
    await loadCombinedExportCategoryPictures(payload.exportRows)
    await recordVideoCopyLog(payload.rowsForCopy, payload.copyText)
  } catch (error) {
    console.error('打开导出弹窗失败:', error)
    ElMessage.error(error?.message || '生成导出内容失败')
    combinedExportDialogVisible.value = false
  } finally {
    combinedExportLoading.value = false
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
    const data = res.data || {}
    filterOptions.value = {
      ...filterOptions.value,
      ...data,
      manufacturer_provinces: mergeProvinceSelectOptions(data.manufacturer_provinces),
      sampled_provinces: mergeProvinceSelectOptions(data.sampled_provinces)
    }
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
  const label = normalizeTreeRegionLabel(item)
  const pathLabels = item.path_labels && typeof item.path_labels === 'object'
    ? { ...item.path_labels, [item.dimension]: label }
    : item.path_labels
  return {
    ...item,
    label,
    path_labels: pathLabels,
    is_leaf: Boolean(item.is_leaf)
  }
}

function clearFullTreeSelectAllPending() {
  fullTreeSelectAllKeysRef.value = null
}

/** 懒加载子节点 resolve 后，把全选子树中应勾选的 key 合并进当前勾选集合 */
function mergeFullSelectKeysIntoTree(childNodesData) {
  const pending = fullTreeSelectAllKeysRef.value
  if (!pending?.size || !childNodesData?.length) {
    return
  }
  const tree = treeRef.value
  if (!tree) {
    return
  }
  const toAdd = []
  for (const c of childNodesData) {
    const k = c?.key
    if (k != null && pending.has(k)) {
      toAdd.push(k)
    }
  }
  if (!toAdd.length) {
    return
  }
  const cur = new Set(tree.getCheckedKeys())
  toAdd.forEach((k) => cur.add(k))
  syncingTreeCheckCascade.value = true
  try {
    tree.setCheckedKeys([...cur])
  } finally {
    syncTreeCheckedKeyCount()
    nextTick(() => {
      syncingTreeCheckCascade.value = false
    })
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
    syncTreeCheckedKeyCount()
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
        resetDetailTableSelection()
        return
      }
      currentNode.value = initial
      currentNodeKey.value = initial.key
      treeRef.value?.setCurrentKey(initial.key)
      treeRef.value?.setCheckedKeys([])
      syncTreeCheckedKeyCount()
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
        mergeFullSelectKeysIntoTree(list)
        setTimeout(() => {
          syncCheckedKeysAfterLazyChildrenLoaded(data, list)
        }, 0)
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
  clearFullTreeSelectAllPending()
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
    treeCheckedKeyCount.value = 0
    treeRerenderKey.value += 1
    currentNode.value = null
    currentNodeKey.value = ''
    tableData.value = []
    pagination.value.total = 0
    resetDetailTableSelection()
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
      ...buildDetailSortParams(),
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
    detailChartBuckets.value = []
    detailChartDataLoading.value = false
    await nextTick()
    if (detailChartDialogVisible.value) {
      await updateDetailChart()
      resizeDetailChart()
    }
    return
  }
  detailChartDataLoading.value = true
  try {
    const selectedChartIds = Array.from(detailTableSelectedIds.value)
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0)
    const chartBody = {
      ...buildTreeRequestParams(),
      paths: pathsPayload,
      chart_dimension: detailChartDimension.value
    }
    if (selectedChartIds.length > 0) {
      chartBody.product_ids = selectedChartIds
    }
    const res = await getUnqualifiedProductNodeDetailChart(chartBody)
    if (!detailChartDialogVisible.value) {
      detailChartBuckets.value = []
      return
    }
    detailChartBuckets.value = res.data || []
  } catch (e) {
    console.error('加载图表聚合数据失败:', e)
    ElMessage.error(e?.message || '加载图表数据失败')
    detailChartBuckets.value = []
  } finally {
    detailChartDataLoading.value = false
    if (!detailChartDialogVisible.value) {
      detailChartBuckets.value = []
      return
    }
    await nextTick()
    await updateDetailChart()
    resizeDetailChart()
  }
}

async function fetchDetailChartBucketsForDimension(chartDimension) {
  const pathsPayload = getNodeDetailsPathsPayload()
  if (!pathsPayload.length || !(pagination.value.total > 0)) {
    return []
  }
  const selectedChartIds = Array.from(detailTableSelectedIds.value)
    .map((id) => Number(id))
    .filter((n) => Number.isFinite(n) && n > 0)
  const chartBody = {
    ...buildTreeRequestParams(),
    paths: pathsPayload,
    chart_dimension: chartDimension
  }
  if (selectedChartIds.length > 0) {
    chartBody.product_ids = selectedChartIds
  }
  const res = await getUnqualifiedProductNodeDetailChart(chartBody)
  return res.data || []
}

async function onDetailChartDialogOpened() {
  const allowed = new Set(NODE_DETAIL_CHART_FIELDS.map((f) => f.key))
  let list = [...(detailChartExportDimensionKeys.value || [])]
    .map(String)
    .filter((k) => allowed.has(k))
  const seen = new Set()
  list = list.filter((k) => (seen.has(k) ? false : seen.add(k)))
  if (!list.length) {
    const fb =
      detailChartDimension.value && allowed.has(String(detailChartDimension.value))
        ? detailChartDimension.value
        : 'manufacturer_province'
    detailChartExportDimensionKeys.value = [fb]
    detailChartDimension.value = fb
  } else {
    if (JSON.stringify(detailChartExportDimensionKeys.value) !== JSON.stringify(list)) {
      detailChartExportDimensionKeys.value = list
    }
    if (!allowed.has(String(detailChartDimension.value)) || detailChartDimension.value !== list[0]) {
      detailChartDimension.value = list[0]
    }
  }
  await refreshDetailChartFullData()
}

function onDetailChartDialogClosed() {
  disposeDetailChart()
  detailChartBuckets.value = []
}

watch(
  detailChartExportDimensionKeys,
  () => {
    const allowed = new Set(NODE_DETAIL_CHART_FIELDS.map((f) => f.key))
    let list = [...(detailChartExportDimensionKeys.value || [])]
      .map(String)
      .filter((k) => allowed.has(k))
    const seen = new Set()
    list = list.filter((k) => (seen.has(k) ? false : seen.add(k)))
    if (!list.length) {
      const fb =
        detailChartDimension.value && allowed.has(String(detailChartDimension.value))
          ? detailChartDimension.value
          : 'manufacturer_province'
      const next = [fb]
      if (JSON.stringify(detailChartExportDimensionKeys.value) !== JSON.stringify(next)) {
        detailChartExportDimensionKeys.value = next
        return
      }
      if (detailChartDimension.value !== fb) {
        detailChartDimension.value = fb
      }
      return
    }
    if (JSON.stringify(detailChartExportDimensionKeys.value) !== JSON.stringify(list)) {
      detailChartExportDimensionKeys.value = list
      return
    }
    const primary = list[0]
    if (detailChartDimension.value !== primary) {
      detailChartDimension.value = primary
    }
  },
  { deep: true }
)

watch(
  () => detailChartDimension.value,
  () => {
    if (detailChartDialogVisible.value) {
      void refreshDetailChartFullData()
    }
  }
)

watch(
  () => detailChartType.value,
  () => {
    nextTick(() => {
      if (!detailChartDialogVisible.value) {
        return
      }
      void updateDetailChart()
      resizeDetailChart()
    })
  }
)

watch(
  () => {
    const s = detailTableSelectedIds.value
    return `${s.size}\u0000${[...s].map((id) => Number(id)).sort((a, b) => a - b).join(',')}`
  },
  () => {
    if (detailChartDialogVisible.value) {
      void refreshDetailChartFullData()
    }
  }
)

watch(
  () => pagination.value.total,
  () => {
    if (detailChartDialogVisible.value) {
      void refreshDetailChartFullData()
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

function buildChartBulkExportZipBaseName() {
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
  return sanitizeExportFileBase(`统计图表批量导出_${rowDim}_${pathHint}_${date}`)
}

function buildToolbarDetailChartExportKeys() {
  const allowed = new Set(NODE_DETAIL_CHART_FIELDS.map((f) => f.key))
  let dims = (detailChartExportDimensionKeys.value || []).filter((k) => allowed.has(String(k)))
  if (!dims.length) {
    dims = [detailChartDimension.value].filter((k) => allowed.has(String(k)))
  }
  const t = detailChartType.value
  return dims.map((dim) => detailChartExportChoiceKey(t, dim))
}

function runDetailChartBulkExportFromToolbarChecked() {
  const keys = buildToolbarDetailChartExportKeys()
  if (!keys.length) {
    ElMessage.warning('没有可导出的统计字段')
    return
  }
  void runDetailChartBulkExportToFolderZip(keys)
}

function parseChartExportChoiceKey(key) {
  const k = String(key || '')
  const i = k.indexOf('|')
  if (i <= 0) {
    return { chartType: 'pie', dimensionKey: '' }
  }
  return { chartType: k.slice(0, i), dimensionKey: k.slice(i + 1) }
}

// function openDetailChartBulkExportDialog() {
//   detailChartBulkExportSelectedKeys.value = buildToolbarDetailChartExportKeys()
//   detailChartBulkExportDialogVisible.value = true
// }

function selectAllDetailChartBulkExportChoices() {
  detailChartBulkExportSelectedKeys.value = detailChartBulkExportChoices.value.map((c) => c.key)
}

function clearDetailChartBulkExportSelections() {
  detailChartBulkExportSelectedKeys.value = []
}

async function runDetailChartBulkExportToFolderZip(exportKeysOverride = null) {
  const resolvedKeys =
    Array.isArray(exportKeysOverride) && exportKeysOverride.length > 0
      ? [...exportKeysOverride]
      : [...detailChartBulkExportSelectedKeys.value]
  if (!resolvedKeys.length || detailChartBulkExporting.value) return
  if (typeof window.showDirectoryPicker !== 'function') {
    ElMessage.warning('当前浏览器不支持选择本地文件夹，请使用 Chrome 或 Edge 最新版')
    return
  }
  let dirHandle
  try {
    dirHandle = await window.showDirectoryPicker()
  } catch (e) {
    if (e?.name === 'AbortError') return
    ElMessage.error(e?.message || '无法打开文件夹选择器')
    return
  }

  const pathsPayload = getNodeDetailsPathsPayload()
  if (!pathsPayload.length || !(pagination.value.total > 0)) {
    ElMessage.warning('当前没有可统计的明细范围，无法导出图表')
    return
  }

  detailChartBulkExporting.value = true
  try {
    const selectedKeys = resolvedKeys
    const dimSet = new Set()
    for (const key of selectedKeys) {
      const { dimensionKey } = parseChartExportChoiceKey(key)
      if (dimensionKey) dimSet.add(dimensionKey)
    }

    const bucketCache = new Map()
    for (const d of dimSet) {
      try {
        const buckets = await fetchDetailChartBucketsForDimension(d)
        bucketCache.set(d, buckets)
      } catch (err) {
        console.error(err)
        ElMessage.error(err?.message || `加载统计字段「${d}」数据失败`)
        return
      }
    }

    const JSZip = await loadJSZipModule()
    const zip = new JSZip()
    let okCount = 0
    let failCount = 0
    const usedNames = new Set()

    const choiceMap = new Map(detailChartBulkExportChoices.value.map((c) => [c.key, c]))

    for (const key of selectedKeys) {
      const { chartType, dimensionKey } = parseChartExportChoiceKey(key)
      const choice = choiceMap.get(key)
      const typeLabel = choice?.typeLabel || chartType
      const dimLabel = choice?.dimensionLabel || dimensionKey
      const buckets = bucketCache.get(dimensionKey) || []
      try {
        const blob = await renderDetailChartToPngBlob(dimensionKey, chartType, buckets)
        let base = sanitizeExportFileBase(`${typeLabel}_${dimLabel}`)
        let fname = `${base}.png`
        let suf = 1
        while (usedNames.has(fname)) {
          base = sanitizeExportFileBase(`${typeLabel}_${dimLabel}_${suf}`)
          fname = `${base}.png`
          suf += 1
        }
        usedNames.add(fname)
        zip.file(fname, blob)
        okCount += 1
      } catch (err) {
        console.warn('导出单张图表失败', key, err)
        failCount += 1
      }
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    const zipName = `${buildChartBulkExportZipBaseName()}.zip`
    const zfh = await dirHandle.getFileHandle(zipName, { create: true })
    const zw = await zfh.createWritable()
    await zw.write(zipBlob)
    await zw.close()

    detailChartBulkExportDialogVisible.value = false
    ElMessage.success(`已写入 ${zipName}（${okCount} 张 PNG${failCount ? `，${failCount} 张失败` : ''}）`)
  } catch (error) {
    console.error('批量导出图表失败:', error)
    ElMessage.error(error?.message || '导出失败')
  } finally {
    detailChartBulkExporting.value = false
  }
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

function downloadBlobAsFile(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadExcelWorkbookBuffer(buffer, filename) {
  downloadBlobAsFile(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  )
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

function guessImageExtensionFromMimeOrUrl(mime, url) {
  const m = String(mime || '').toLowerCase()
  if (m.includes('png')) return 'png'
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  if (m.includes('webp')) return 'webp'
  if (m.includes('gif')) return 'gif'
  const u = String(url || '').split('?')[0].toLowerCase()
  const m2 = u.match(/\.(png|jpe?g|webp|gif)$/)
  if (m2) return m2[1] === 'jpeg' ? 'jpg' : m2[1]
  return 'png'
}

function sanitizeExportImageFileBase(name) {
  const s = String(name || 'image')
    .replace(/[\\/:*?"<>|\r\n\t\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return s.slice(0, 120) || 'image'
}

function buildCombinedExportImageFilename(row, index1, ext) {
  const idx = String(index1).padStart(3, '0')
  const idPart = row?.id != null && row.id !== '' ? sanitizeExportImageFileBase(String(row.id)).slice(0, 36) : ''
  const namePart = sanitizeExportImageFileBase(row?.product_name || '未命名').slice(0, 80)
  const stem = `${idx}_${idPart ? `${idPart}_` : ''}${namePart}`
  return `${stem.slice(0, 180)}.${ext}`
}

async function buildCombinedExportExcelBuffer() {
  const order = dimensionOrder.value?.length ? dimensionOrder.value : DEFAULT_DIMENSION_ORDER
  const ExcelJS = await loadExcelJSModule()
  const wb = new ExcelJS.Workbook()
  appendDetailsSheet(wb, combinedExportRows.value)
  appendCheckedDimensionTreeSheet(wb, order, combinedExportCheckedNodes.value)
  return wb.xlsx.writeBuffer()
}

/**
 * 导出弹窗合一：打包为 zip 下载（文案.txt、Excel、商品图片/）
 */
async function emitCombinedExportUsageRecords() {
  const uid = currentUser.value?.id
  if (uid == null || uid === '') {
    return
  }
  const raw = combinedExportRows.value || []
  const ids = [
    ...new Set(
      raw
        .map((r) => Number.parseInt(String(r?.id ?? '').trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ]
  if (!ids.length) {
    return
  }
  try {
    await recordUnqualifiedProductExportUsage({ product_ids: ids })
  } catch (error) {
    console.warn('导出使用记录写入失败（不影响压缩包下载）:', error?.response?.data || error?.message || error)
  }
}

async function exportCombinedExportPackageZip() {
  if (!combinedExportRows.value.length || combinedExportPackaging.value) return

  combinedExportPackaging.value = true
  const text = String(activeCombinedExportCopyText.value || '').trim()
  let imageOk = 0
  let imageSkip = 0
  let imageFail = 0
  try {
    const JSZip = await loadJSZipModule()
    const zip = new JSZip()

    if (text) {
      zip.file('文案.txt', `\ufeff${text}`)
    }

    const buffer = await buildCombinedExportExcelBuffer()
    const excelName = `${buildNodeDetailsExportFileBase()}.xlsx`
    zip.file(excelName, new Uint8Array(buffer))

    const rows = combinedExportRows.value || []
    const imgPrefix = '商品图片/'
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      try {
        const blob = await fetchCombinedExportRowImageBlob(row)
        if (!blob) {
          imageSkip += 1
          continue
        }
        const ext = guessImageExtensionFromMimeOrUrl(blob.type, row?.export_picture_override?.storedPath || getProductPictureStoredPath(row))
        const fname = buildCombinedExportImageFilename(row, i + 1, ext)
        zip.file(`${imgPrefix}${fname}`, blob)
        imageOk += 1
      } catch (err) {
        console.warn('打包商品图片失败:', getProductPictureStoredPath(row), err)
        imageFail += 1
      }
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    const zipName = `${sanitizeExportFileBase(`${buildNodeDetailsExportFileBase()}_导出包`)}.zip`
    downloadBlobAsFile(zipBlob, zipName)
    await emitCombinedExportUsageRecords()
    await loadNodeDetails()

    const parts = []
    parts.push(text ? '文案.txt' : '文案为空已跳过 txt')
    parts.push(`Excel（${excelName}）`)
    parts.push(`商品图片 ${imageOk} 张`)
    if (imageSkip) parts.push(`无图跳过 ${imageSkip}`)
    if (imageFail) parts.push(`下载失败 ${imageFail}`)
    combinedExportDialogVisible.value = false
    ElMessage.success(`已开始下载压缩包：${parts.join('；')}`)
  } catch (error) {
    console.error('导出压缩包失败:', error)
    ElMessage.error(error?.message || '导出失败')
  } finally {
    combinedExportPackaging.value = false
  }
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
    const ExcelJS = await loadExcelJSModule()
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

function getDetailTableSelectionScopeKey(pathsPayload) {
  return JSON.stringify({
    paths: pathsPayload || [],
    q: buildTreeRequestParams()
  })
}

function onDetailTableSelectionChange(selection) {
  if (syncingDetailTableSelectionDom.value) {
    return
  }
  const pageRows = tableData.value || []
  const pageIdSet = new Set(pageRows.map((r) => r?.id).filter((id) => id != null && id !== ''))
  const selectedOnPage = new Set((selection || []).map((r) => r?.id).filter((id) => id != null && id !== ''))
  const next = new Set(detailTableSelectedIds.value)
  pageIdSet.forEach((id) => {
    if (selectedOnPage.has(id)) next.add(id)
    else next.delete(id)
  })
  detailTableSelectedIds.value = next
}

/** 清空跨页勾选（切换树范围、无 path、加载失败等） */
function resetDetailTableSelection() {
  detailTableSelectedIds.value = new Set()
  detailTableSelectionScopeKey.value = ''
  nextTick(() => {
    detailTableRef.value?.clearSelection?.()
  })
}

/** 当前页 DOM 与 detailTableSelectedIds 对齐（翻页、接口返回后调用） */
function syncDetailTableSelectionToDom() {
  nextTick(() => {
    const table = detailTableRef.value
    if (!table) return
    syncingDetailTableSelectionDom.value = true
    try {
      table.clearSelection()
      const ids = detailTableSelectedIds.value
      for (const row of tableData.value || []) {
        if (row?.id != null && ids.has(row.id)) {
          table.toggleRowSelection(row, true)
        }
      }
    } finally {
      nextTick(() => {
        syncingDetailTableSelectionDom.value = false
      })
    }
  })
}

async function loadNodeDetails() {
  const pathsPayload = getNodeDetailsPathsPayload()

  if (!pathsPayload.length) {
    tableData.value = []
    pagination.value.total = 0
    resetDetailTableSelection()
    return
  }

  const reqSig = getNodeDetailRequestSignature(pathsPayload)
  if (nodeDetailInflight.has(reqSig)) {
    return nodeDetailInflight.get(reqSig)
  }

  const run = (async () => {
    const scopeKey = getDetailTableSelectionScopeKey(pathsPayload)
    if (scopeKey !== detailTableSelectionScopeKey.value) {
      detailTableSelectedIds.value = new Set()
      detailTableSelectionScopeKey.value = scopeKey
      nextTick(() => {
        detailTableRef.value?.clearSelection?.()
      })
    }

    cancelDetailRequest()
    detailRequestController = new AbortController()
    tableLoading.value = true
    try {
      const res = await getUnqualifiedProductNodeDetails({
        ...buildTreeRequestParams(),
        ...buildDetailSortParams(),
        page: pagination.value.page,
        limit: pagination.value.limit,
        paths: pathsPayload
      }, {
        signal: detailRequestController.signal
      })
      tableData.value = res.data || []
      pagination.value.total = res.pagination?.total || 0
      await nextTick()
      syncDetailTableSelectionToDom()
    } catch (error) {
      if (isAbortError(error)) {
        return
      }
      console.error('加载节点详情失败:', error)
      tableData.value = []
      pagination.value.total = 0
      resetDetailTableSelection()
    } finally {
      detailRequestController = null
      tableLoading.value = false
    }
  })()

  nodeDetailInflight.set(reqSig, run)
  run.finally(() => {
    nodeDetailInflight.delete(reqSig)
  })
  return run
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
  scheduleLoadNodeDetailsDebounced()
}

/** 点击标签行区域切换勾选（与复选框一致，并走 handleTreeCheck 级联） */
function onTreeRowContentClick(_node, data, e) {
  e?.stopPropagation?.()
  const tree = treeRef.value
  if (!tree || data?.key == null) {
    return
  }
  clearFullTreeSelectAllPending()
  currentNode.value = data
  currentNodeKey.value = data.key
  pagination.value.page = 1
  const wasChecked = tree.getCheckedKeys().includes(data.key)
  tree.setChecked(data.key, !wasChecked, false)
  syncTreeCheckedKeyCount()
  void handleTreeCheck(data)
}

function setsEqualForKeys(a, bList) {
  const b = new Set(bList)
  if (a.size !== b.size) return false
  for (const k of a) {
    if (!b.has(k)) return false
  }
  return true
}

function syncTreeCheckedKeyCount() {
  treeCheckedKeyCount.value = treeRef.value?.getCheckedKeys?.()?.length || 0
}

async function selectAllTreeNodes() {
  const tree = treeRef.value
  const roots = pendingRootNodes.value || []
  const rootKeys = roots.map((node) => node?.key).filter((key) => key != null)
  if (!tree || !rootKeys.length) {
    return
  }
  fullTreeSelectAllKeysRef.value = null
  programmaticTreeCheckLock.value += 1
  syncingTreeCheckCascade.value = true
  try {
    const order = dimensionOrder.value?.length ? dimensionOrder.value : DEFAULT_DIMENSION_ORDER
    const rootPaths = roots
      .map((n) => n?.path)
      .filter((p) => p && typeof p === 'object' && Object.keys(p).length)
    let allKeys = [...rootKeys]
    if (rootPaths.length) {
      try {
        const res = await getUnqualifiedProductCheckedTreeNodes({
          ...buildTreeRequestParams(),
          paths: rootPaths,
          dimension_order: JSON.stringify(order)
        })
        const nodes = res.data || []
        const keysFromApi = [...new Set(nodes.map((n) => n?.key).filter((k) => k != null))]
        if (keysFromApi.length) {
          allKeys = keysFromApi
          fullTreeSelectAllKeysRef.value = new Set(keysFromApi)
        }
      } catch (e) {
        console.error('全选：拉取子树节点失败，仅勾选根节点', e)
      }
    }
    tree.setCheckedKeys(allKeys)
    currentNode.value = roots[0] || currentNode.value
    currentNodeKey.value = currentNode.value?.key || currentNodeKey.value
    pagination.value.page = 1
  } finally {
    await nextTick()
    await nextTick()
    syncingTreeCheckCascade.value = false
    programmaticTreeCheckLock.value -= 1
  }
  syncTreeCheckedKeyCount()
  scheduleLoadNodeDetailsDebounced()
}

async function clearTreeSelection() {
  const tree = treeRef.value
  if (!tree) {
    return
  }
  clearFullTreeSelectAllPending()
  syncingTreeCheckCascade.value = true
  try {
    tree.setCheckedKeys([])
    pagination.value.page = 1
  } finally {
    await nextTick()
    syncingTreeCheckCascade.value = false
  }
  syncTreeCheckedKeyCount()
  await loadNodeDetails()
}

async function handleTreeCheck(data) {
  if (syncingTreeCheckCascade.value) {
    return
  }
  if (programmaticTreeCheckLock.value === 0) {
    clearFullTreeSelectAllPending()
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
  syncTreeCheckedKeyCount()
  pagination.value.page = 1
  scheduleLoadNodeDetailsDebounced()
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

async function handleDetailSortChange({ prop, order }) {
  detailSort.value = prop === 'usage_count' && order
    ? { prop, order }
    : { prop: '', order: '' }
  pagination.value.page = 1
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

function goUsageRecords(id) {
  if (!id) return
  router.push(`/unqualified-products/${id}/usage`)
}



function goCompany(companyId) {
  router.push(`/companies/${companyId}`)
}

function onWindowResizeDetailChart() {
  resizeDetailChart()
}

onMounted(() => {
  applyRouteFilters()
  appliedDimensionHistory.value = readSavedAppliedDimensionHistory()
  syncDraftWithOrder(readSavedAppliedDimensionOrder() ?? DEFAULT_DIMENSION_ORDER)
  window.addEventListener('resize', onWindowResizeDetailChart)
  void fetchSavedDimensionPresets()
  void loadStats()
  void loadFilterOptions()
  void loadTree()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResizeDetailChart)
  disposeDetailChart()
  clearTreeReloadTimer()
  window.clearTimeout(loadNodeDetailsDebounceTimer)
  loadNodeDetailsDebounceTimer = null
  cancelTreeRequest()
  cancelDetailRequest()
})
</script>

<style scoped>
/* .el-form-item__label{
  width: 60% !important;
} */

.unqualified-product-detail-table{
  padding: 4px !important;
}
.unqualified-products {
  max-width: 1580px;
  margin: 0 auto;
}

.detail-product-name-cell {
  cursor: pointer;
  color: #3396c4;
}

.usage-count-cell {
  cursor: pointer;
  color: #409eff;
  font-weight: 600;
}

.manufacturer-nav-cell--link {
  cursor: pointer;
  color: #4ea6cf;
}

.manufacturer-nav-cell--link:hover {
  text-decoration: underline;
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

.panel-header--stacked {
  align-items: flex-start;
}

.panel-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.theme-preset-select {
  width: 168px;
  max-width: 42vw;
}

.theme-preset-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 24px;
}

.theme-preset-option-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-preset-option-delete {
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--el-color-danger);
  cursor: pointer;
  line-height: 1.2;
}

.theme-preset-option-delete:hover:not(:disabled) {
  color: var(--el-color-danger-dark-2);
}

.theme-preset-option-delete:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.category-setting-dialog-body {
  padding: 4px 0 8px;
}

.category-setting-name-form {
  margin-bottom: 12px;
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

.detail-chart-dimension-select-multiple {
  flex: 1 1 220px;
  min-width: 200px;
}

.detail-chart-dimension-select-multiple :deep(.el-select__tags) {
  flex-wrap: wrap;
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

.detail-chart-bulk-export-intro {
  margin: 0 0 12px;
  font-size: 13px;
  color: #606266;
  line-height: 1.55;
}

.detail-chart-bulk-export-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.detail-chart-bulk-export-group {
  width: 100%;
}

.detail-chart-bulk-export-row {
  padding: 5px 8px 5px 0;
}

.detail-chart-bulk-export-dialog :deep(.el-dialog__body) {
  padding-top: 12px;
}

.video-copy-dialog-body {
  min-height: 260px;
}

.video-copy-dialog-body :deep(.el-textarea__inner) {
  line-height: 1.8;
  font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
}

.combined-export-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
  padding-right: 36px;
}

.combined-export-dialog-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.combined-export-dialog-body {
  min-height: 420px;
}

.combined-export-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.combined-export-main-tabs :deep(.el-tabs__content) {
  padding-top: 12px;
}

.combined-export-copy-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 420px;
}

.combined-export-copy-theme-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.combined-export-copy-theme-row .el-button {
  margin-left: auto;
}

.combined-export-copy-theme-label {
  flex-shrink: 0;
  font-size: 14px;
  color: #606266;
}

.combined-export-copy-theme-select {
  width: min(320px, 100%);
}

.combined-export-picture-cell {
  display: inline-flex;
  cursor: pointer;
}

.combined-export-picture-thumb,
.combined-export-picture-cell .image-fallback.combined-export-picture-thumb {
  width: 50px;
  height: 50px;
  border-radius: 6px;
}

.combined-export-picture-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}

.combined-export-picture-meta {
  margin-bottom: 14px;
  font-size: 14px;
  color: #303133;
}

.combined-export-picture-meta-sub {
  color: #909399;
}

.combined-export-picture-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.combined-export-picture-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.combined-export-picture-option.is-active {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.15);
}

.combined-export-picture-option.is-disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.combined-export-picture-option-title {
  width: 100%;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  text-align: center;
}

.combined-export-picture-option-image,
.combined-export-picture-option .image-fallback.combined-export-picture-option-image {
  width: 100%;
  height: 160px;
  border-radius: 8px;
  background: #f5f7fa;
}

.combined-export-picture-category-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 40px;
}

.combined-export-picture-category-name {
  max-width: 100%;
  font-size: 12px;
  color: #606266;
  text-align: center;
  word-break: break-all;
}

.combined-export-picture-category-counter {
  font-size: 12px;
  color: #909399;
}

.hidden-file-input {
  display: none;
}

@media (max-width: 768px) {
  .combined-export-picture-options {
    grid-template-columns: 1fr;
  }
}

.combined-export-tab-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #606266;
  line-height: 1.55;
}

.combined-export-tab-hint code {
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 3px;
  background: #f0f2f5;
}

.combined-export-food-alert {
  margin-bottom: 10px;
}

.combined-export-copy-textarea :deep(.el-textarea__inner) {
  line-height: 1.8;
  font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
}

.combined-export-hint {
  color: #909399;
  font-size: 13px;
}

.usage-user-tooltip {
  max-width: 320px;
  line-height: 1.7;
  white-space: pre-wrap;
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
  border-color: #77a7d8;
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
  background: #d9eaf8;
  border-radius: 14px;
  color: black;
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
  color: #0a0a0a;
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
  cursor: pointer;
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
