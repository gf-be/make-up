<template>
  <div class="announcement-staging">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">导入核验工作台</div>
            <div class="subtitle">按“上传临时区 → 人工核验 → 导入正式库”的顺序操作，减少无关按钮干扰。</div>
          </div>
          <div class="header-actions">
            <input
              ref="folderInputRef"
              type="file"
              class="hidden-file-input"
              multiple
              webkitdirectory
              accept=".json,application/json"
              @change="handleUploadInputChange"
            >
            <input
              ref="fileInputRef"
              type="file"
              class="hidden-file-input"
              multiple
              accept=".json,application/json"
              @change="handleUploadInputChange"
            >
            <el-button :loading="loading || overviewLoading" @click="refreshAll">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>

        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb-16"
        title="当前页面支持从本机选择 JSON 文件夹批量上传到服务器临时区，系统解析后在本页展示给用户人工核验，再确认导入正式库。"
      />

      <div class="workbench-shell">
        <aside class="stage-nav">
          <div class="stage-nav-title">操作阶段</div>
          <button
            type="button"
            class="stage-nav-item"
            :class="{ active: activeWorkbenchView === 'staging' }"
            @click="setWorkbenchView('staging')"
          >
            <span>临时区</span>
            <small>上传 JSON 与查看导入结果</small>
          </button>
          <button
            type="button"
            class="stage-nav-item"
            :class="{ active: activeWorkbenchView === 'review' }"
            @click="setWorkbenchView('review')"
          >
            <span>人工核验</span>
            <small>按类型核验后导入正式库</small>
          </button>
          <button
            type="button"
            class="stage-nav-item"
            :class="{ active: activeWorkbenchView === 'traceback' }"
            @click="setWorkbenchView('traceback')"
          >
            <span>倒溯处理</span>
            <small>异常修正与删除（本页视图）</small>
          </button>
        </aside>

        <section class="workbench-main">
          <template v-if="activeWorkbenchView === 'staging'">
            <el-card shadow="never" class="recent-card import-entry-card">
              <template #header>
                <div class="recent-header">
                  <div>
                    <div class="recent-title">JSON 上传入口</div>
                    <div class="recent-subtitle">用户只需要选择文件夹或多个 JSON，系统会上传到临时区并记录当前登录用户。</div>
                  </div>
                  <div class="header-actions">
                    <el-button :loading="importing" type="primary" @click="selectUploadFolder">
                      <el-icon><Upload /></el-icon>
                      选择文件夹
                    </el-button>
                    <el-button :disabled="importing" @click="selectUploadFiles">选择 JSON</el-button>
                  </div>
                </div>
              </template>
              <div class="quick-guide">
                <span>1. 选择本机 JSON</span>
                <span>2. 上传进入临时区</span>
                <span>3. 到“人工核验”逐条确认</span>
              </div>
            </el-card>

      <el-card v-if="uploadFileRows.length" shadow="never" class="recent-card upload-preview-card">
        <template #header>
          <div class="recent-header">
            <div>
              <div class="recent-title">待上传 JSON 文件</div>
              <div class="recent-subtitle">已选择 {{ uploadFileRows.length }} 个 JSON 文件，上传后会写入临时区并记录当前登录用户与上传时间。</div>
            </div>
            <div class="header-actions">
              <el-button @click="clearUploadSelection">清空</el-button>
              <el-button type="primary" :loading="importing" @click="handleUploadSelectedJson">上传并导入临时区</el-button>
            </div>
          </div>
        </template>
        <el-table :data="uploadFileRows" size="small" max-height="240">
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="name" label="文件名" min-width="220" show-overflow-tooltip />
          <el-table-column prop="relativePath" label="相对路径" min-width="300" show-overflow-tooltip />
          <el-table-column prop="sizeLabel" label="大小" width="110" align="right" />
        </el-table>
      </el-card>

      <div class="stats-grid" v-loading="overviewLoading">

        <!-- <div class="stat-card primary">
          <div class="stat-label">JSON 文件数</div>
          <div class="stat-value">{{ overview.json_file_count || 0 }}</div>
          <div class="stat-meta">当前待导入 {{ overview.unimported_json_count || 0 }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">临时批次数</div>
          <div class="stat-value">{{ overview.staging_batch_count || 0 }}</div>
          <div class="stat-meta">抽检 {{ overview.sampling_batch_count || 0 }} · 飞检 {{ overview.flight_batch_count || 0 }}</div>
        </div> -->
        <div class="stat-card warning">
          <div class="stat-label">待导入正式库</div>
          <div class="stat-value">{{ overview.pending_batch_count || 0 }}</div>
          <div class="stat-meta">待核验内容 {{ overview.pending_detail_count || 0 }}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">倒溯待处理</div>
          <div class="stat-value">{{ overview.pending_traceback_count || 0 }}</div>
          <div class="stat-meta">重复 {{ overview.duplicate_traceback_count || 0 }} · 解析失败 {{ overview.parse_failed_traceback_count || 0 }} · 异常 {{ overview.import_failed_traceback_count || 0 }}</div>
        </div>

      <!-- </div>

      <div class="progress-grid" v-loading="overviewLoading"> -->
        <!-- <div class="progress-card">
          <div class="progress-header-row">
            <div>
              <div class="progress-title">JSON → 临时表</div>
              <div class="progress-subtitle">当前目录文件与临时批次对齐进度</div>
            </div>
            <div class="progress-percentage">{{ overview.import_progress_percent || 0 }}%</div>
          </div>
          <el-progress :percentage="overview.import_progress_percent || 0" :stroke-width="10" />
          <div class="progress-meta-row">
            <span>已入临时表 {{ overview.staging_batch_count || 0 }} · 当前目录剩余 {{ overview.json_file_count || 0 }}</span>
            <span>来源目录：{{ overview.source_dir || '-' }}</span>
          </div>
        </div> -->

        <div class="progress-card">
          <div class="progress-header-row">
            <div>
              <div class="progress-title">临时表 → 正式库</div>
              <div class="progress-subtitle">待确认批次导入正式库进度</div>
            </div>
            <div class="progress-percentage success-text">{{ overview.publish_progress_percent || 0 }}%</div>
          </div>
          <el-progress :percentage="overview.publish_progress_percent || 0" :stroke-width="10" status="success" />
          <div class="progress-meta-row">
            <span>已导入 {{ overview.confirmed_batch_count || 0 }} / {{ overview.staging_batch_count || 0 }}</span>
            <span>累计产品/问题项 {{ overview.total_detail_count || 0 }}</span>
          </div>
        </div>
      </div>

      <el-card v-if="lastImportResult" shadow="never" class="recent-card">
        <template #header>
          <div class="recent-header">
            <div>
              <div class="recent-title">最近一次导入结果</div>
              <div class="recent-subtitle">新增、重复跳过、待人工核验和导入异常都会在这里展示；可定位批次或切换到左侧「倒溯处理」视图。</div>

            </div>
            <div class="recent-tags">
              <el-tag type="success">新增 {{ lastImportResult.created_count || 0 }}</el-tag>
              <el-tag type="warning">重复 {{ lastImportResult.duplicate_count || 0 }}</el-tag>
              <el-tag type="warning">待核验 {{ lastImportResult.parse_warning_count ?? lastImportResult.parse_failed_count ?? 0 }}</el-tag>
              <el-tag v-if="lastImportResult.error_count" type="info">异常 {{ lastImportResult.error_count }}</el-tag>
            </div>
          </div>
        </template>

        <el-table :data="lastImportResult.items || []" size="small" max-height="300">
          <el-table-column prop="title" label="通告标题" min-width="260" show-overflow-tooltip />
          <el-table-column label="结果" width="130" align="center">
            <template #default="{ row }">
              <el-tag :type="getImportActionMeta(row).type">{{ getImportActionMeta(row).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="detail_count" label="内容数" width="90" align="center" />
          <el-table-column label="提示" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.warning_message || row.delete_message || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="来源用户" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              {{ getSourceUserLabel(row) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" align="center">
            <template #default="{ row }">
              <el-button v-if="row.id" link type="primary" @click="focusBatchById(row.id)">定位批次</el-button>
              <el-button v-else-if="row.traceback_id" link type="warning" @click="goTracebackCenter(row)">定位倒溯</el-button>
              <span v-else class="muted-text">-</span>
            </template>

          </el-table-column>
        </el-table>
      </el-card>

          </template>

          <template v-else-if="activeWorkbenchView === 'review'">
            <el-card shadow="never" class="recent-card review-entry-card">
              <div class="review-stage-header">
                <div>
                  <div class="recent-title">人工核验</div>
                  <div class="recent-subtitle">先按通告类型进入列表，再在右侧查看正文、附件和企业预览。单个通告通过后点击“可导入”。</div>
                </div>
                <el-tabs v-model="reviewAnnouncementType" class="review-type-tabs" @tab-change="handleReviewTypeTabChange">
                  <el-tab-pane label="抽检通告" name="sampling" />
                  <el-tab-pane label="飞行检查" name="flight_inspection" />
                </el-tabs>
              </div>
            </el-card>

      <!-- <el-form :model="filters" inline class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" style="width: 180px" clearable placeholder="全部状态">
            <el-option label="待确认" value="pending" />
            <el-option label="已确认" value="confirmed" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable placeholder="标题 / 公告编号 / 检验单位 / 通告网址" @keyup.enter="applyFilters" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form> -->

      <div class="workspace-layout workspace-layout-review">
        <div class="left-column">
          <div class="filter-sidebar" v-loading="loading">
            <div class="filter-sidebar-section">
              <button type="button" class="filter-sidebar-head" @click="filterNavProductExpanded = !filterNavProductExpanded">
                <el-icon class="filter-sidebar-head-icon"><Grid /></el-icon>
                <span class="filter-sidebar-head-title">产品类别</span>
                <el-icon class="filter-sidebar-chevron" :class="{ 'is-collapsed': !filterNavProductExpanded }">
                  <ArrowDown />
                </el-icon>
              </button>
              <div v-show="filterNavProductExpanded" class="filter-sidebar-list">
                <button
                  v-for="item in productDirectoryOptions"
                  :key="item.value"
                  type="button"
                  class="filter-sidebar-row"
                  :class="{ active: item.value === selectedProductType, disabled: !item.count }"
                  :disabled="!item.count"
                  @click="handleProductSelect(item.value)"
                >
                  <span class="filter-sidebar-label">{{ item.label }}</span>
                  <span class="filter-sidebar-count">{{ item.count }}</span>
                </button>
              </div>
            </div>

            <div class="filter-sidebar-divider" />

            <div class="filter-sidebar-section">
              <button type="button" class="filter-sidebar-head" @click="filterNavYearExpanded = !filterNavYearExpanded">
                <el-icon class="filter-sidebar-head-icon"><Calendar /></el-icon>
                <span class="filter-sidebar-head-title">年度分布</span>
                <el-icon class="filter-sidebar-chevron" :class="{ 'is-collapsed': !filterNavYearExpanded }">
                  <ArrowDown />
                </el-icon>
              </button>
              <div v-show="filterNavYearExpanded" class="filter-sidebar-list filter-sidebar-list--year">
                <div class="filter-sidebar-hint">{{ currentProductLabel }} · 共 {{ visibleTreeRows.length }} 条通告</div>
                <div class="filter-sidebar-scroll">
                  <button
                    v-for="item in yearDirectoryOptions"
                    :key="item.value"
                    type="button"
                    class="filter-sidebar-row"
                    :class="{ active: item.value === selectedYearKey, disabled: !item.count }"
                    :disabled="!item.count"
                    @click="handleYearSelect(item.value)"
                  >
                    <span class="filter-sidebar-label">{{ item.label }}</span>
                    <span class="filter-sidebar-count">{{ item.count }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>


        <div class="detail-layout">
          <el-card class="detail-overview-card" shadow="never" v-loading="detailBusy">
            <template #header>
              <div class="panel-header panel-header-wrap">
                <div>
                  <div class="panel-title">{{ currentBatch ? currentBatch.title : '批次详情工作区' }}</div>
                  <div class="panel-subtitle">{{ currentBatchSubtitle }}</div>
                </div>
                <div v-if="currentBatch" class="panel-actions">
                  <el-select
                    v-if="visibleTreeRows.length"
                    :model-value="currentBatchId"
                    placeholder="选择当前通告"
                    class="batch-picker"
                    @change="handleBatchPickerChange"
                  >
                    <el-option
                      v-for="row in visibleTreeRows"
                      :key="row.id"
                      :label="`${getBatchPeriodLabel(row) || row.announcement_no || `通告${row.id}`}｜${row.title || '未命名通告'}`"
                      :value="row.id"
                    />
                  </el-select>
                  <el-tag>{{ currentTypeInfo.product_type_label }}</el-tag>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    :disabled="!currentBatch"
                    :loading="savingProductTypeId === currentBatchId"
                    @click="openProductTypeEditor()"
                  >
                    修改产品类型
                  </el-button>
                  <el-tag type="success">{{ currentTypeInfo.announcement_type_label }}</el-tag>

                  <el-tag type="info">{{ currentYearLabel }}</el-tag>
                  <el-tag type="info">{{ currentBatchPositionText }}</el-tag>
                  <el-button
                    v-if="nextBatch"
                    type="primary"
                    plain
                    :loading="switchingBatchId === nextBatch.id"
                    @click="handleGoNextBatch()"
                  >
                    下一个通告
                  </el-button>
                  <el-button
                    v-if="currentBatch && (currentBatch.status === 'pending' || currentBatch.status === 'confirmed')"
                    type="warning"
                    plain
                    :loading="retreatingTracebackId === currentBatch.id"
                    @click="handleRetreatToTraceback(currentBatch)"
                  >
                    打回
                  </el-button>

                  <el-button
                    type="success"
                    :loading="confirmingId === currentBatch.id"
                    @click="handleConfirm(currentBatch)"
                  >
                    {{ currentBatch.status === 'confirmed' ? '重新导入' : '可导入' }}
                  </el-button>
                </div>


              </div>
            </template>

            <template v-if="currentBatch">
              <div class="detail-summary-grid">
                <div class="summary-card">
                  <div class="summary-label">附件数量</div>
                  <div class="summary-value">{{ currentBatchSummary.attachment_count }}</div>
                </div>
                <div class="summary-card success">
                  <div class="summary-label">解析成功附件</div>
                  <div class="summary-value">{{ currentBatchSummary.success_attachment_count }}</div>
                </div>
                <div class="summary-card warning">
                  <div class="summary-label">解析失败附件</div>
                  <div class="summary-value">{{ currentBatchSummary.failed_attachment_count }}</div>
                </div>
                <div class="summary-card" :class="{ danger: !isFlightBatch }">
                  <div class="summary-label">{{ isFlightBatch ? '问题项数' : '产品明细数' }}</div>
                  <div class="summary-value">{{ currentBatchSummary.detail_count }}</div>
                </div>
              </div>

              <el-alert
                v-if="currentParseNotice"
                :type="currentParseNotice.type"
                :closable="false"
                show-icon
                class="mb-16"
                :title="currentParseNotice.title"
              />

              <el-descriptions :column="2" border>
                <el-descriptions-item label="列表期号展示">{{ getBatchPeriodLabel(currentBatch) || '-' }}</el-descriptions-item>

                <el-descriptions-item label="状态">
                  <el-tag :type="getStatusTagType(currentBatch.status)">{{ getStatusLabel(currentBatch.status) }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="公告编号">{{ currentBatch.announcement_no || '-' }}</el-descriptions-item>
                <el-descriptions-item label="发布日期">{{ currentBatch.publish_date || '-' }}</el-descriptions-item>
                <el-descriptions-item label="产品类型">{{ currentTypeInfo.product_type_label }}</el-descriptions-item>
                <el-descriptions-item label="通告类型">{{ currentTypeInfo.announcement_type_label }}</el-descriptions-item>
                <el-descriptions-item label="检验/检查单位">{{ currentBatch.inspection_unit || '-' }}</el-descriptions-item>
                <el-descriptions-item label="正式表">{{ currentTypeInfo.target_table }}</el-descriptions-item>
                <el-descriptions-item label="主附件">{{ currentBatch.primary_attachment_name || '-' }}</el-descriptions-item>
                <el-descriptions-item label="来源用户">{{ getSourceUserLabel(currentBatch) }}</el-descriptions-item>
                <el-descriptions-item label="通告网址" :span="2">
                  <a v-if="currentBatch.source_detail_url" :href="currentBatch.source_detail_url" target="_blank" rel="noreferrer">{{ currentBatch.source_detail_url }}</a>
                  <span v-else class="muted-text">-</span>
                </el-descriptions-item>
              </el-descriptions>
            </template>

            <el-empty v-else description="请先从左侧筛选结果中选择一个通告" />

          </el-card>

          <el-card class="detail-content-card" shadow="never" v-loading="detailBusy">
            <template v-if="currentBatch">
              <el-tabs v-model="activeDetailTab" class="detail-tabs">
                <el-tab-pane label="通告正文" name="body">
                  <div class="section-toolbar">
                    <div>
                      <div class="section-title">通告正文内容</div>
                      <div class="panel-tip">支持先在临时批次修订正文再决定是否导入正式库；若该通告已导入正式库，保存时会同步更新正式库正文。</div>
                    </div>
                    <div class="inline-tags">
                      <el-tag>{{ currentBatch.publish_date || '无日期' }}</el-tag>
                      <el-tag type="success">{{ currentBatch.announcement_no || '无编号' }}</el-tag>
                      <el-button
                        v-if="currentBatch"
                        type="primary"
                        plain
                        size="small"
                        :loading="savingBodyId === currentBatch.id"
                        @click="openBodyEditor()"
                      >
                        编辑正文
                      </el-button>
                    </div>
                  </div>

                  <div v-if="currentBatchBodyText" class="content-scroll-panel">
                    <div class="content-body-text">{{ currentBatchBodyText }}</div>
                  </div>
                  <el-empty v-else description="当前批次暂无正文内容" />
                </el-tab-pane>

                <el-tab-pane label="附件解析产品列表" name="attachments">
                  <div class="section-toolbar section-toolbar-wrap">
                    <div>
                      <div class="section-title">附件解析产品列表</div>
                      <div class="panel-tip">支持按附件切换查看解析结果，也可结合“下一个通告”连续快速核验。</div>

                    </div>
                    <div class="detail-filter-actions">
                      <el-input
                        v-model="detailFilters.keyword"
                        clearable
                        placeholder="搜索产品名 / 企业名 / 问题项 / 检查问题"
                        style="width: 320px"
                      />
                    </div>
                  </div>

                  <div v-if="currentBatchAttachments.length" class="attachment-filter-bar">
                    <el-button
                      size="small"
                      :type="selectedAttachmentIndex === null ? 'primary' : undefined"
                      @click="selectAttachmentFilter(null)"
                    >
                      全部附件
                    </el-button>
                    <el-button
                      v-for="attachment in currentBatchAttachments"
                      :key="attachment.index"
                      size="small"
                      :type="selectedAttachmentIndex === attachment.index ? 'primary' : undefined"
                      @click="selectAttachmentFilter(attachment.index)"
                    >
                      {{ attachment.attachment_name || `附件${attachment.index}` }}
                    </el-button>
                  </div>

                  <div v-if="currentAttachmentGroups.length" class="attachment-group-list">
                    <div v-for="attachment in currentAttachmentGroups" :key="attachment.index" class="attachment-group-card">
                      <div class="attachment-group-header">
                        <div>
                          <div class="tree-title">{{ attachment.attachment_name || `附件${attachment.index}` }}</div>
                          <div class="tree-subtitle">{{ attachment.parse_message || '已进入附件解析产品列表' }}</div>
                        </div>
                        <div class="inline-tags end">
                          <el-tag>{{ attachment.attachment_type || 'unknown' }}</el-tag>
                          <el-tag type="success">解析 {{ attachment.parsed_count || 0 }} 条</el-tag>
                          <el-tag v-if="!isFlightBatch" :type="attachment.counterfeit_count ? 'danger' : 'info'">涉假 {{ attachment.counterfeit_count || 0 }}</el-tag>
                        </div>
                      </div>

                      <el-table v-if="isFlightBatch" :data="attachment.filtered_rows" size="small" stripe max-height="3000">
                        <el-table-column prop="sequence_no" label="序号" width="70" align="center" />
                        <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
                        <el-table-column prop="company_name" label="企业名称" min-width="220" show-overflow-tooltip />
                        <el-table-column prop="inspection_unit" label="检查单位" min-width="180" show-overflow-tooltip />
                        <el-table-column prop="defects_and_problems" label="检查问题" min-width="260" show-overflow-tooltip />
                        <el-table-column prop="handling_measures" label="处理措施" min-width="220" show-overflow-tooltip />
                      </el-table>

                      <el-table v-else :data="attachment.filtered_rows" size="small" stripe max-height="300">
                        <el-table-column prop="sequence_no" label="序号" width="70" align="center" />
                        <el-table-column prop="product_name" label="产品名称" min-width="220" show-overflow-tooltip />
                        <el-table-column prop="company_names" label="企业名称" min-width="220" show-overflow-tooltip />
                        <el-table-column prop="sample_unit_name" label="被抽样单位" min-width="180" show-overflow-tooltip />
                        <el-table-column prop="unqualified_items" label="不合格项目" min-width="220" show-overflow-tooltip />
                        <el-table-column prop="remarks" label="备注" min-width="180" show-overflow-tooltip />
                      </el-table>

                      <el-empty
                        v-if="!attachment.filtered_rows.length"
                        :description="detailFilters.keyword ? '当前筛选条件下没有匹配结果' : '当前附件暂无可展示的解析明细'"
                      />
                    </div>
                  </div>
                  <el-empty v-else description="当前批次暂无附件解析产品列表" />
                </el-tab-pane>

                <el-tab-pane label="企业长列表预览" name="companies">
                  <div class="section-toolbar section-toolbar-wrap">
                    <div>
                      <div class="section-title">企业长列表预览</div>
                      <div class="panel-tip">按企业纵向快速扫视地址、地区与涉及内容，适合批量核验时做二次确认。</div>
                    </div>
                    <el-input
                      v-model="detailFilters.companyKeyword"
                      clearable
                      placeholder="搜索企业名 / 地址 / 涉及内容"
                      style="width: 300px"
                    />
                  </div>

                  <div class="list-meta-row compact mb-16">
                    <span>当前显示 {{ currentCompanyPreviewList.length }} / {{ currentBatchSummary.company_count }} 家企业</span>
                    <span>按涉及条目数排序，优先展示高频企业</span>
                  </div>

                  <div v-if="currentCompanyPreviewList.length" class="company-list-scroll company-list-scroll-large">

                    <div v-for="company in currentCompanyPreviewList" :key="buildCompanyKey(company)" class="company-list-item">
                      <div class="company-item-header">
                        <div>
                          <div class="company-name">{{ company.company_name || '未命名企业' }}</div>
                          <div class="company-address">{{ company.company_address || '暂无企业地址' }}</div>
                        </div>
                        <div class="inline-tags end">
                          <el-tag>{{ company.province || '未知地区' }}</el-tag>
                          <el-tag type="primary">涉及 {{ company.product_count || 0 }} 条</el-tag>
                          <el-tag v-if="company.counterfeit_count" type="danger">涉假 {{ company.counterfeit_count }}</el-tag>
                        </div>
                      </div>
                      <div class="company-products-label">涉及内容</div>
                      <div class="company-products-text">{{ company.product_names || '暂无涉及内容' }}</div>
                    </div>
                  </div>
                  <el-empty v-else description="当前批次暂无企业预览数据" />
                </el-tab-pane>
              </el-tabs>
            </template>

            <el-empty v-else description="请选择左侧通告列表中的一条记录查看详细内容" />

          </el-card>
        </div>
      </div>

          </template>

          <template v-else-if="activeWorkbenchView === 'traceback'">
            <AnnouncementTracebacksPanel ref="tracebacksPanelRef" />
          </template>
        </section>
      </div>

    </el-card>

    <el-dialog
      v-model="bodyEditDialogVisible"
      width="820px"
      destroy-on-close
      :title="currentBatch ? `编辑正文：${currentBatch.title || '当前通告'}` : '编辑通告正文'"
    >
      <div class="panel-tip mb-16">保存后会更新当前临时批次正文；若该通告已导入正式库，也会同步更新正式库正文，不会重跑附件解析结果。</div>

      <el-input
        v-model="bodyEditForm.content"
        type="textarea"
        :rows="20"
        resize="vertical"
        maxlength="30000"
        show-word-limit
        placeholder="请输入修订后的通告正文"
      />
      <template #footer>
        <el-button @click="bodyEditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingBodyId === currentBatchId" @click="handleSaveBodyEdit()">保存正文</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="productTypeEditDialogVisible"
      width="480px"
      destroy-on-close
      :title="currentBatch ? `修改产品类型：${currentBatch.title || '当前通告'}` : '修改产品类型'"
    >
      <div class="panel-tip mb-16">保存后会更新当前临时批次产品类型；若该通告已导入正式库，也会同步更新正式库、企业关联和问题产品数据。</div>
      <el-select v-model="productTypeEditForm.product_type" placeholder="请选择产品类型" style="width: 100%">
        <el-option v-for="item in productTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <template #footer>
        <el-button @click="productTypeEditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingProductTypeId === currentBatchId" @click="handleSaveProductType()">保存产品类型</el-button>
      </template>
    </el-dialog>
  </div>
</template>




<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, Calendar, Grid, Refresh, Upload } from '@element-plus/icons-vue'
import {
  getAnnouncementStagingOverview,
  getAnnouncementStagingTree,
  getAnnouncementStagingDetail,
  getAnnouncementStagingWorkspaceCache,
  saveAnnouncementStagingWorkspaceCache,
  uploadAnnouncementStagingJson,
  confirmAnnouncementStaging,
  updateAnnouncementStagingBody,
  updateAnnouncementStagingProductType,
  retreatAnnouncementStagingToTraceback,

  confirmAllAnnouncementStaging
} from '@/api/index'

import AnnouncementTracebacksPanel from '@/components/AnnouncementTracebacksPanel.vue'

import { ElMessage, ElMessageBox } from 'element-plus'

const ALLOWED_WORKBENCH_VIEWS = ['staging', 'review', 'traceback']

const productTypeOptions = [
  { label: '化妆品', value: 'cosmetics' },
  { label: '食品', value: 'food' },
  { label: '医疗器械', value: 'medical_device' },
  { label: '未知', value: 'unknown' }
]


const announcementTypeOptions = [
  { label: '抽检通告', value: 'sampling' },
  { label: '飞行检查', value: 'flight_inspection' }
]

const route = useRoute()
const router = useRouter()
const tracebacksPanelRef = ref(null)
const activeWorkbenchView = ref('staging')
const reviewAnnouncementType = ref('sampling')
const filterNavProductExpanded = ref(true)
const filterNavYearExpanded = ref(true)
const loading = ref(false)
const overviewLoading = ref(false)
const importing = ref(false)
const bulkConfirming = ref(false)
const detailLoadingId = ref(null)
const confirmingId = ref(null)
const savingBodyId = ref(null)

const retreatingTracebackId = ref(null)
const switchingBatchId = ref(null)
const treeRows = ref([])
const detailMap = ref({})

const folderInputRef = ref(null)
const fileInputRef = ref(null)
const selectedUploadFiles = ref([])

const lastImportResult = ref(null)
const selectedBatchId = ref(null)
const selectedTreeKey = ref('')
const selectedProductType = ref('all')
const selectedYearKey = ref('all')
const activeDetailTab = ref('body')
const selectedAttachmentIndex = ref(null)
const workspaceCacheReady = ref(false)
const bodyEditDialogVisible = ref(false)
const bodyEditForm = reactive({
  content: ''
})
const productTypeEditDialogVisible = ref(false)
const savingProductTypeId = ref(null)
const productTypeEditForm = reactive({
  product_type: 'unknown'
})

let workspaceSaveTimer = null

const preloadingBatchIds = new Set()


const filters = reactive({
  status: 'pending',
  product_type: '',
  announcement_type: 'sampling',
  keyword: ''
})

const detailFilters = reactive({
  keyword: '',
  companyKeyword: ''
})

const overview = reactive(createEmptyOverview())

function formatFileSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const uploadFileRows = computed(() => {
  const list = Array.isArray(selectedUploadFiles.value) ? selectedUploadFiles.value : []
  return list.map((item) => ({
    name: item.name || item.relativePath || '未命名',
    relativePath: item.relativePath || item.webkitRelativePath || item.name || '',
    sizeLabel: formatFileSize(item.size)
  }))
})

function selectUploadFolder() {
  folderInputRef.value?.click()
}

function selectUploadFiles() {
  fileInputRef.value?.click()
}

function handleUploadInputChange(event) {
  const input = event.target
  const files = input?.files
  if (!files?.length) {
    if (input) input.value = ''
    return
  }
  const next = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const nameLower = String(f.name || '').toLowerCase()
    if (!nameLower.endsWith('.json')) continue
    next.push({
      file: f,
      name: f.name,
      relativePath: f.webkitRelativePath || f.name,
      size: f.size
    })
  }
  selectedUploadFiles.value = next
  if (input) input.value = ''
  if (!next.length) {
    ElMessage.warning('所选内容中未包含 .json 文件')
  }
}

function clearUploadSelection() {
  selectedUploadFiles.value = []
}

function safeQueryValue(value) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim()
  }
  return String(value || '').trim()
}

function mergeStagingQuery(patch = {}) {
  const q = { ...route.query }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === '') {
      delete q[k]
      continue
    }
    q[k] = typeof v === 'string' ? v : String(v)
  }
  router.replace({
    path: '/announcement-staging',
    query: q
  })
}

function resolveWorkbenchView(cachePayload = {}) {
  const qView = safeQueryValue(route.query.view)
  if (ALLOWED_WORKBENCH_VIEWS.includes(qView)) {
    activeWorkbenchView.value = qView
    return
  }
  const cached = cachePayload?.workbenchView
  if (ALLOWED_WORKBENCH_VIEWS.includes(cached)) {
    activeWorkbenchView.value = cached
    mergeStagingQuery({ view: cached })
  }
}

function setWorkbenchView(view) {
  if (!ALLOWED_WORKBENCH_VIEWS.includes(view)) {
    return
  }
  activeWorkbenchView.value = view
  if (view === 'staging') {
    mergeStagingQuery({
      view: 'staging',
      tracebackId: '',
      id: '',
      focusBatchId: ''
    })
  } else if (view === 'review') {
    mergeStagingQuery({ view: 'review', tracebackId: '', id: '' })
  } else {
    mergeStagingQuery({
      view: 'traceback',
      focusBatchId: '',
      tracebackId: '',
      id: '',
      keyword: ''
    })
  }
}

function handleReviewTypeTabChange(name) {
  reviewAnnouncementType.value = name || 'sampling'
  filters.announcement_type = reviewAnnouncementType.value
  selectedTreeKey.value = ''
  selectedBatchId.value = null
  loadTreeData({ force: true })
}

function getSourceUserLabel(row = {}) {
  return row.imported_by_username || row.uploaded_by_username || row.created_by_username || row.username || '-'
}

async function handleUploadSelectedJson() {
  if (importing.value) {
    return
  }

  const rows = selectedUploadFiles.value
  if (!Array.isArray(rows) || !rows.length) {
    ElMessage.warning('请先选择 JSON 文件')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认将本地选中的 ${rows.length} 个 JSON 上传到服务器并导入临时区吗？已存在的批次可能跳过或进入倒溯处理。`,
      '上传并导入临时区',
      {
        type: 'warning',
        confirmButtonText: '开始上传',
        cancelButtonText: '取消'
      }
    )
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    throw error
  }

  importing.value = true
  try {
    const formData = new FormData()
    const paths = []
    rows.forEach((row, index) => {
      formData.append('files', row.file, row.name)
      paths.push(row.relativePath || row.name || `file_${index}.json`)
    })
    formData.append('relative_paths', JSON.stringify(paths))

    const res = await uploadAnnouncementStagingJson(formData)
    const data = res.data || {}
    lastImportResult.value = data

    const createdCount = data.created_count || 0
    const duplicateCount = data.duplicate_count || 0
    const parseWarningCount = data.parse_warning_count ?? data.parse_failed_count ?? 0
    const errorCount = data.error_count || 0

    if (duplicateCount > 0 || parseWarningCount > 0 || errorCount > 0) {
      ElMessage.warning(`上传导入完成：新增 ${createdCount} 个，重复跳过 ${duplicateCount} 个，待人工核验 ${parseWarningCount} 个，异常 ${errorCount} 个`)
    } else {
      ElMessage.success(`上传导入完成：新增 ${createdCount} 个临时批次`)
    }

    selectedUploadFiles.value = []
    const firstCreatedItem = (data.items || []).find((item) => item.id)
    await refreshAll({ preferredKey: firstCreatedItem?.id ? `body:${firstCreatedItem.id}` : selectedTreeKey.value, force: true })
  } catch (error) {
    console.error('上传导入临时区失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '上传导入失败')
  } finally {
    importing.value = false
  }
}

function createEmptyOverview() {
  return {
    source_dir: '',
    json_file_count: 0,
    staging_batch_count: 0,
    pending_batch_count: 0,
    confirmed_batch_count: 0,
    sampling_batch_count: 0,
    flight_batch_count: 0,
    cosmetics_batch_count: 0,
    food_batch_count: 0,
    medical_device_batch_count: 0,
    unimported_json_count: 0,
    total_detail_count: 0,
    total_counterfeit_count: 0,
    pending_detail_count: 0,
    confirmed_detail_count: 0,
    pending_counterfeit_count: 0,
    confirmed_counterfeit_count: 0,
    traceback_count: 0,
    pending_traceback_count: 0,
    resolved_traceback_count: 0,
    duplicate_traceback_count: 0,
    parse_failed_traceback_count: 0,
    import_failed_traceback_count: 0,
    published_incorrect_traceback_count: 0,
    manual_reject_traceback_count: 0,
    import_progress_percent: 0,


    publish_progress_percent: 0,
    last_imported_at: null,
    last_confirmed_at: null
  }
}

function createEmptyDetail() {
  return {
    batch: {},
    items: [],
    company_preview: [],
    attachments: [],
    parse_validation: {
      blocking: false,
      message: null,
      detail_count: 0,
      attachment_count: 0,
      parseable_attachment_count: 0,
      success_attachment_count: 0,
      failed_attachment_count: 0,
      failed_attachment_names: []
    },
    summary: {
      attachment_count: 0,
      company_count: 0,
      detail_count: 0,
      counterfeit_count: 0,
      success_attachment_count: 0,
      failed_attachment_count: 0
    }
  }
}

function getProductTypeLabel(value) {
  return productTypeOptions.find((item) => item.value === value)?.label || '化妆品'
}

function getAnnouncementTypeLabel(value) {
  return announcementTypeOptions.find((item) => item.value === value)?.label || '抽检通告'
}

function getStatusLabel(status) {
  return status === 'confirmed' ? '已导入' : '待确认'
}

function getStatusTagType(status) {
  return status === 'confirmed' ? 'success' : 'warning'
}

function isFlightBatchRow(row = {}) {

  return (row.announcement_type || 'sampling') === 'flight_inspection'
}

function getTypeInfo(record = {}) {
  const productType = record.product_type || 'cosmetics'
  const announcementType = record.announcement_type || 'sampling'
  return {
    product_type: productType,
    announcement_type: announcementType,
    product_type_label: getProductTypeLabel(productType),
    announcement_type_label: getAnnouncementTypeLabel(announcementType),
    target_table: announcementType === 'flight_inspection' ? 'supervisions' : 'announcements'
  }
}

function getPublishedId(row = {}) {
  return isFlightBatchRow(row)
    ? row.published_supervision_id || null
    : row.published_announcement_id || null
}

function getImportActionMeta(record = {}) {
  const action = typeof record === 'string' ? record : record?.action
  const needsManualReview = Boolean(record?.needs_manual_review)

  if (action === 'created' && needsManualReview) {
    return { label: '已入临时区待核验', type: 'warning' }
  }
  if (action === 'created') {
    return { label: '新增临时批次', type: 'success' }
  }
  if (action === 'skipped_duplicate') {
    return { label: '重复跳过', type: 'warning' }
  }
  if (action === 'skipped_parse_failed') {
    return { label: '历史跳过记录', type: 'info' }
  }
  if (action === 'failed') {
    return { label: '导入异常', type: 'info' }
  }
  return { label: action || '未知状态', type: 'info' }
}

function normalizeText(value) {
  return String(value || '').trim()
}

function getBatchPeriodLabel(row = {}) {
  const sourceText = `${row.announcement_no || ''} ${row.title || ''}`.replace(/\s+/g, '')
  const exactMatch = sourceText.match(/(20\d{2})年第?(\d+)(号|期)/)
  if (exactMatch) {
    return `${exactMatch[1]}年${exactMatch[2]}${exactMatch[3]}`
  }

  const genericMatch = sourceText.match(/(20\d{2})年(\d+)(号|期)/)
  if (genericMatch) {
    return `${genericMatch[1]}年${genericMatch[2]}${genericMatch[3]}`
  }

  if (row.publish_date) {
    return `${String(row.publish_date).slice(0, 4)}年通告`
  }

  return normalizeText(row.announcement_no) || ''
}

function getBatchYearKey(row = {}) {
  const sourceText = `${row.publish_date || ''} ${row.announcement_no || ''} ${row.title || ''}`.replace(/\s+/g, '')
  const match = sourceText.match(/(20\d{2})年|^(20\d{2})-/)
  const year = match?.[1] || match?.[2] || ''
  return year || 'unknown'
}

function getYearLabel(yearKey = '') {
  return yearKey && yearKey !== 'unknown' ? `${yearKey}年` : '未识别年份'
}

function getYearMeta(yearItem) {
  if (yearItem.value === 'all') return '全部年号'
  if (!yearItem.latest_date) return '暂无日期'
  return `最新: ${yearItem.latest_date}`
}

function sortRowsByDisplayOrder(rows = []) {
  return [...rows].sort((left, right) => {
    const leftPendingWeight = left.status === 'pending' ? 0 : 1
    const rightPendingWeight = right.status === 'pending' ? 0 : 1
    if (leftPendingWeight !== rightPendingWeight) {
      return leftPendingWeight - rightPendingWeight
    }

    const leftDate = String(left.publish_date || '')
    const rightDate = String(right.publish_date || '')
    if (leftDate !== rightDate) {
      return rightDate.localeCompare(leftDate)
    }

    return Number(right.id || 0) - Number(left.id || 0)
  })
}

function buildCompanyKey(company = {}) {

  return `${company.company_name || ''}__${company.company_address || ''}`
}

function getCachedDetail(batchId) {
  return batchId ? detailMap.value[batchId] || null : null
}

function getBatchById(batchId) {
  if (!batchId) {
    return null
  }

  const treeRow = treeRows.value.find((item) => Number(item.id) === Number(batchId)) || null
  const detailBatch = getCachedDetail(batchId)?.batch || null

  if (!treeRow && !detailBatch) {
    return null
  }

  return {
    ...(treeRow || {}),
    ...(detailBatch || {})
  }
}


function createFallbackAttachments(batch = {}, items = []) {
  if (!Array.isArray(items) || !items.length) {
    return []
  }

  return [{
    index: 1,
    attachment_name: batch.primary_attachment_name || (isFlightBatchRow(batch) ? '正文解析' : '产品明细回填'),
    attachment_type: 'content',
    parsed_count: items.length,
    counterfeit_count: items.filter((item) => item.is_counterfeit).length,
    parse_message: batch.primary_attachment_name ? '当前已使用解析结果回填附件预览。' : '当前未提供可展示附件，已回填批次解析内容。',
    rows: items
  }]
}

function filterAttachmentRows(rows = [], keyword = '') {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  const sourceRows = Array.isArray(rows) ? rows : []

  if (!normalizedKeyword) {
    return sourceRows
  }

  return sourceRows.filter((item) => {
    const text = [
      item.product_name,
      item.company_names,
      item.sample_unit_name,
      item.unqualified_items,
      item.remarks,
      item.title,
      item.company_name,
      item.defects_and_problems,
      item.handling_measures,
      item.inspection_unit
    ].filter(Boolean).join(' ').toLowerCase()

    return text.includes(normalizedKeyword)
  })
}

function buildWorkspacePayload() {
  return {
    filters: { ...filters },
    detailFilters: { ...detailFilters },
    selectedTreeKey: selectedTreeKey.value,
    selectedBatchId: selectedBatchId.value,
    selectedProductType: selectedProductType.value,
    selectedYearKey: selectedYearKey.value,
    activeDetailTab: activeDetailTab.value,
    selectedAttachmentIndex: selectedAttachmentIndex.value,
    lastImportResult: lastImportResult.value,
    workbenchView: activeWorkbenchView.value
  }
}

function applyWorkspacePayload(payload = {}) {
  const nextFilters = payload.filters || {}
  filters.status = nextFilters.status ?? 'pending'
  filters.product_type = nextFilters.product_type ?? ''
  filters.announcement_type = nextFilters.announcement_type || 'sampling'
  reviewAnnouncementType.value = filters.announcement_type
  filters.keyword = nextFilters.keyword ?? ''

  const nextDetailFilters = payload.detailFilters || {}
  detailFilters.keyword = nextDetailFilters.keyword ?? ''
  detailFilters.companyKeyword = nextDetailFilters.companyKeyword ?? ''

  const cachedTreeKey = payload.selectedTreeKey || ''
  const legacyProductType = cachedTreeKey.startsWith('product:') ? cachedTreeKey.replace('product:', '') : ''

  selectedTreeKey.value = cachedTreeKey.startsWith('product:') ? '' : cachedTreeKey
  selectedBatchId.value = payload.selectedBatchId || null
  selectedProductType.value = payload.selectedProductType || legacyProductType || 'all'
  selectedYearKey.value = payload.selectedYearKey || 'all'
  activeDetailTab.value = payload.activeDetailTab || 'body'

  selectedAttachmentIndex.value = payload.selectedAttachmentIndex ?? null
  lastImportResult.value = payload.lastImportResult || null
}



async function saveWorkspaceCacheNow() {
  if (!workspaceCacheReady.value) {
    return
  }

  try {
    await saveAnnouncementStagingWorkspaceCache({
      payload: buildWorkspacePayload()
    })
  } catch (error) {
    console.error('保存导入工作区缓存失败:', error)
  }
}

function scheduleWorkspaceSave() {
  if (!workspaceCacheReady.value) {
    return
  }

  if (workspaceSaveTimer) {
    clearTimeout(workspaceSaveTimer)
  }

  workspaceSaveTimer = setTimeout(() => {
    saveWorkspaceCacheNow()
  }, 400)
}

async function loadWorkspaceCache() {
  try {
    const res = await getAnnouncementStagingWorkspaceCache()
    return res.data?.payload || {}
  } catch (error) {
    console.error('读取导入工作区缓存失败:', error)
    return {}
  }
}

const currentBatchId = computed(() => Number(selectedBatchId.value || 0) || null)
const currentBatch = computed(() => getBatchById(currentBatchId.value))
const currentBatchDetail = computed(() => getCachedDetail(currentBatchId.value))
const currentTypeInfo = computed(() => getTypeInfo(currentBatch.value || {}))
const isFlightBatch = computed(() => currentTypeInfo.value.announcement_type === 'flight_inspection')
const currentPublishedId = computed(() => getPublishedId(currentBatch.value || {}))
const currentBatchBodyText = computed(() => currentBatch.value?.content || currentBatchDetail.value?.batch?.content || '')

function test() {
  console.log(currentBatchBodyText)
  console.log(currentBatchDetail)
}
const currentBatchAttachments = computed(() => {
  const detailData = currentBatchDetail.value
  if (!detailData) {
    return []
  }

  return Array.isArray(detailData.attachments) && detailData.attachments.length
    ? detailData.attachments
    : createFallbackAttachments(currentBatch.value || {}, detailData.items || [])
})

const currentParseValidation = computed(() => currentBatchDetail.value?.parse_validation || createEmptyDetail().parse_validation)

const currentBatchSummary = computed(() => {
  const batch = currentBatch.value || {}
  const detailData = currentBatchDetail.value
  const summary = detailData?.summary || {}
  const parseValidation = detailData?.parse_validation || {}

  return {
    attachment_count: detailData
      ? Number(summary.attachment_count ?? currentBatchAttachments.value.length ?? 0)
      : Number(batch.attachment_count || 0),
    company_count: detailData
      ? Number(summary.company_count ?? detailData.company_preview?.length ?? 0)
      : 0,
    detail_count: detailData
      ? Number(summary.detail_count ?? detailData.items?.length ?? 0)
      : Number(batch.parsed_detail_count || 0),
    counterfeit_count: detailData
      ? Number(summary.counterfeit_count ?? detailData.items?.filter((item) => item.is_counterfeit).length ?? 0)
      : Number(batch.counterfeit_count || 0),
    success_attachment_count: detailData
      ? Number(summary.success_attachment_count ?? parseValidation.success_attachment_count ?? 0)
      : 0,
    failed_attachment_count: detailData
      ? Number(summary.failed_attachment_count ?? parseValidation.failed_attachment_count ?? 0)
      : 0
  }
})

const currentCompanyPreviewList = computed(() => {
  const keyword = String(detailFilters.companyKeyword || '').trim().toLowerCase()
  const rows = Array.isArray(currentBatchDetail.value?.company_preview) ? currentBatchDetail.value.company_preview : []

  if (!keyword) {
    return rows
  }

  return rows.filter((item) => {
    const text = [
      item.company_name,
      item.company_address,
      item.province,
      item.product_names
    ].filter(Boolean).join(' ').toLowerCase()
    return text.includes(keyword)
  })
})

const currentAttachmentGroups = computed(() => {
  const sourceAttachments = Array.isArray(currentBatchAttachments.value) ? currentBatchAttachments.value : []
  const scopedAttachments = selectedAttachmentIndex.value === null
    ? sourceAttachments
    : sourceAttachments.filter((item) => Number(item.index) === Number(selectedAttachmentIndex.value))

  return scopedAttachments.map((attachment) => ({
    ...attachment,
    filtered_rows: filterAttachmentRows(attachment.rows || [], detailFilters.keyword)
  }))
})

const currentParseNotice = computed(() => {
  const validation = currentParseValidation.value || {}

  if (validation.blocking && validation.message) {
    return {
      type: 'warning',
      title: validation.message
    }
  }

  if (Number(validation.failed_attachment_count || 0) > 0) {
    const names = Array.isArray(validation.failed_attachment_names) ? validation.failed_attachment_names.filter(Boolean).join('、') : ''
    return {
      type: 'info',
      title: names ? `当前仍有未解析成功附件：${names}` : `当前仍有 ${validation.failed_attachment_count} 个附件未解析成功`
    }
  }

  return null
})

const detailBusy = computed(() => Boolean(currentBatchId.value && detailLoadingId.value === currentBatchId.value))

const currentBatchSubtitle = computed(() => {
  if (!currentBatch.value) {
    return '请先从左侧筛选结果中选择通告'
  }

  if (detailBusy.value) {
    return '正在加载当前通告的正文、附件解析产品列表与企业预览'
  }

  const periodLabel = getBatchPeriodLabel(currentBatch.value)
  return [
    currentBatchPositionText.value,
    periodLabel || getStatusLabel(currentBatch.value.status),
    `${currentTypeInfo.value.product_type_label} / ${currentTypeInfo.value.announcement_type_label}`,
    `${currentBatchSummary.value.detail_count} 条内容`
  ].filter(Boolean).join(' · ')
})

const productDirectoryOptions = computed(() => {
  const scopedOptions = productTypeOptions.map((option) => ({
    ...option,
    count: treeRows.value.filter((row) => getTypeInfo(row).product_type === option.value).length
  }))

  return [{
    label: '全部产品类别',
    value: 'all',
    count: treeRows.value.length
  }, ...scopedOptions]
})

const currentProductLabel = computed(() => {
  return productDirectoryOptions.value.find((item) => item.value === selectedProductType.value)?.label || '全部产品类别'
})

const yearDirectoryOptions = computed(() => {
  const scopedRows = treeRows.value.filter((row) => {
    if (selectedProductType.value === 'all') {
      return true
    }
    return getTypeInfo(row).product_type === selectedProductType.value
  })
  const groupedMap = new Map()

  scopedRows.forEach((row) => {
    const yearKey = getBatchYearKey(row)
    if (!groupedMap.has(yearKey)) {
      groupedMap.set(yearKey, {
        value: yearKey,
        label: getYearLabel(yearKey),
        count: 0,
        latest_date: String(row.publish_date || '')
      })
    }

    const group = groupedMap.get(yearKey)
    group.count += 1
    const publishDate = String(row.publish_date || '')
    if (publishDate > String(group.latest_date || '')) {
      group.latest_date = publishDate
    }
  })

  const sortedOptions = [...groupedMap.values()].sort((left, right) => {
    if (left.value === 'unknown' && right.value !== 'unknown') return 1
    if (right.value === 'unknown' && left.value !== 'unknown') return -1
    return String(right.value).localeCompare(String(left.value))
  })

  return [{
    value: 'all',
    label: '全部年号',
    count: scopedRows.length
  }, ...sortedOptions]
})

const currentYearLabel = computed(() => {
  return yearDirectoryOptions.value.find((item) => item.value === selectedYearKey.value)?.label || '全部年号'
})

const visibleTreeRows = computed(() => {
  const productType = selectedProductType.value
  const yearKey = selectedYearKey.value

  return sortRowsByDisplayOrder(
    treeRows.value.filter((row) => {
      if (productType && productType !== 'all' && getTypeInfo(row).product_type !== productType) {
        return false
      }
      if (yearKey && yearKey !== 'all' && getBatchYearKey(row) !== yearKey) {
        return false
      }
      return true
    })
  )
})

const currentBatchIndex = computed(() => {
  return visibleTreeRows.value.findIndex((row) => Number(row.id) === Number(currentBatchId.value || 0))
})

const currentBatchPositionText = computed(() => {
  const totalCount = visibleTreeRows.value.length
  if (!totalCount) {
    return '当前没有可浏览通告'
  }

  if (currentBatchIndex.value < 0) {
    return `当前共 ${totalCount} 个通告`
  }

  return `当前第 ${currentBatchIndex.value + 1} / ${totalCount} 个通告`
})

const nextBatch = computed(() => {
  if (currentBatchIndex.value < 0) {
    return null
  }

  return visibleTreeRows.value[currentBatchIndex.value + 1] || null
})

const currentDirectorySummary = computed(() => {
  const totalCount = visibleTreeRows.value.length
  if (!totalCount) {
    return '请先选择产品类别与年号，当前筛选下暂无通告'
  }

  return `${currentProductLabel.value} · ${currentYearLabel.value} · 当前筛选下共 ${totalCount} 个通告`
})



async function loadOverview() {
  overviewLoading.value = true
  try {
    const res = await getAnnouncementStagingOverview()
    Object.assign(overview, createEmptyOverview(), res.data || {})
  } catch (error) {
    console.error('加载临时表概览失败:', error)
  } finally {
    overviewLoading.value = false
  }
}

async function ensureBatchDetailLoaded(batchId, force = false, options = {}) {
  if (!batchId) {
    return null
  }

  if (!force && detailMap.value[batchId]) {
    return detailMap.value[batchId]
  }

  if (options.silent && preloadingBatchIds.has(batchId)) {
    return null
  }

  if (options.silent) {
    preloadingBatchIds.add(batchId)
  } else {
    detailLoadingId.value = batchId
  }

  try {
    const res = await getAnnouncementStagingDetail(batchId)
    const nextDetail = {
      ...createEmptyDetail(),
      ...(res.data || {})
    }
    detailMap.value = {
      ...detailMap.value,
      [batchId]: nextDetail
    }

    if (!options.skipPrefetch) {
      void preloadNextBatchDetail(batchId)
    }

    return nextDetail
  } catch (error) {
    console.error('加载批次详情失败:', error)
    return null
  } finally {
    if (options.silent) {
      preloadingBatchIds.delete(batchId)
    }

    if (detailLoadingId.value === batchId) {
      detailLoadingId.value = null
    }
  }
}

async function preloadNextBatchDetail(batchId) {
  const currentIndex = visibleTreeRows.value.findIndex((item) => Number(item.id) === Number(batchId))
  if (currentIndex < 0) {
    return
  }

  const targetRow = visibleTreeRows.value[currentIndex + 1]
  if (!targetRow || detailMap.value[targetRow.id] || preloadingBatchIds.has(targetRow.id) || detailLoadingId.value === targetRow.id) {
    return
  }

  await ensureBatchDetailLoaded(targetRow.id, false, {
    silent: true,
    skipPrefetch: true
  })
}

function ensureDirectorySelection(preferredBatchId = null) {
  if (!treeRows.value.length) {
    selectedProductType.value = 'all'
    selectedYearKey.value = 'all'
    return
  }

  const preferredBatch = preferredBatchId
    ? treeRows.value.find((item) => Number(item.id) === Number(preferredBatchId)) || null
    : null

  const availableProductTypes = productDirectoryOptions.value.filter((item) => item.count > 0).map((item) => item.value)
  let nextProductType = preferredBatch ? getTypeInfo(preferredBatch).product_type : selectedProductType.value
  if (!availableProductTypes.includes(nextProductType)) {
    nextProductType = 'all'
  }
  selectedProductType.value = nextProductType || 'all'

  const availableYears = yearDirectoryOptions.value.filter((item) => item.count > 0).map((item) => item.value)
  let nextYearKey = preferredBatch ? getBatchYearKey(preferredBatch) : selectedYearKey.value
  if (!availableYears.includes(nextYearKey)) {
    nextYearKey = 'all'
  }
  selectedYearKey.value = nextYearKey || 'all'
}

async function selectFirstVisibleBatch(options = {}) {
  ensureDirectorySelection(options.preferredBatchId || selectedBatchId.value)

  if (!visibleTreeRows.value.length) {
    selectedBatchId.value = null
    selectedTreeKey.value = ''
    return false
  }

  const preferredBatchId = Number(options.preferredBatchId || selectedBatchId.value || 0)
  const fallbackBatchId = preferredBatchId && visibleTreeRows.value.some((item) => Number(item.id) === preferredBatchId)
    ? preferredBatchId
    : Number(visibleTreeRows.value[0]?.id || 0)

  if (!fallbackBatchId) {
    return false
  }

  const fallbackType = options.preferAttachments ? 'attachments' : 'body'
  return selectTreeNodeByKey(`${fallbackType}:${fallbackBatchId}`, { force: options.force })
}

async function selectTreeNodeByKey(key, options = {}) {
  const normalizedKey = String(key || '')
  if (!normalizedKey) {
    return false
  }

  const [type, rawBatchId] = normalizedKey.split(':')
  const batchId = Number(rawBatchId || 0)
  const targetBatch = batchId
    ? treeRows.value.find((item) => Number(item.id) === batchId) || null
    : null

  if (type === 'product') {
    if (!productDirectoryOptions.value.some((item) => item.value === rawBatchId && item.count > 0)) {
      return false
    }
    selectedProductType.value = rawBatchId
    ensureDirectorySelection()
    return selectFirstVisibleBatch({ force: options.force })
  }

  if (!targetBatch) {
    return false
  }

  ensureDirectorySelection(batchId)
  if (!visibleTreeRows.value.some((item) => Number(item.id) === batchId)) {
    return false
  }

  selectedBatchId.value = batchId
  selectedTreeKey.value = normalizedKey

  if (type === 'attachments') {
    activeDetailTab.value = 'attachments'
  } else {
    activeDetailTab.value = 'body'
  }

  if (type !== 'attachments') {
    selectedAttachmentIndex.value = null
  }

  await ensureBatchDetailLoaded(batchId, Boolean(options.force))
  return true
}

async function selectBatch(row, options = {}) {
  if (!row?.id) {
    return false
  }

  const targetTab = options.tab || (activeDetailTab.value === 'attachments' ? 'attachments' : 'body')
  return selectTreeNodeByKey(`${targetTab}:${row.id}`, { force: options.force })
}

async function loadTreeData(options = {}) {
  loading.value = true
  try {
    const res = await getAnnouncementStagingTree({ ...filters })
    treeRows.value = res.data || []

    if (!treeRows.value.length) {
      selectedBatchId.value = null
      selectedTreeKey.value = ''
      selectedProductType.value = 'all'
      selectedYearKey.value = 'all'
      return
    }

    const preferredKey = options.preferredKey || selectedTreeKey.value || (selectedBatchId.value ? `body:${selectedBatchId.value}` : '')
    if (preferredKey) {
      const restored = await selectTreeNodeByKey(preferredKey, { force: options.force })
      if (restored) {
        return
      }
    }

    await selectFirstVisibleBatch({ force: options.force, preferredBatchId: selectedBatchId.value })
  } catch (error) {
    console.error('加载导入通告列表失败:', error)
  } finally {
    loading.value = false
  }
}



async function refreshAll(options = {}) {
  if (activeWorkbenchView.value === 'traceback') {
    await Promise.all([
      loadOverview(),
      tracebacksPanelRef.value?.refreshAll?.() ?? Promise.resolve()
    ])
    return
  }

  const preferredKey = options.preferredKey || selectedTreeKey.value
  await Promise.all([
    loadOverview(),
    loadTreeData({ preferredKey, force: options.force })
  ])

  if (currentBatchId.value) {
    await ensureBatchDetailLoaded(currentBatchId.value, Boolean(options.force))
  }
}




async function focusBatchById(batchId, options = {}) {

  if (!batchId) {
    return
  }

  activeWorkbenchView.value = 'review'
  if (!options.skipMerge) {
    mergeStagingQuery({
      view: 'review',
      focusBatchId: String(batchId),
      tracebackId: '',
      id: ''
    })
  }

  const preferredKey = `body:${batchId}`
  const located = await selectTreeNodeByKey(preferredKey, { force: true })
  if (located) {
    return
  }

  filters.status = ''
  filters.product_type = ''
  filters.announcement_type = ''
  filters.keyword = ''

  ElMessage.info('当前批次不在现有筛选结果中，已清空筛选条件后重新定位')
  await loadTreeData({ preferredKey, force: true })
}

function goTracebackCenter(row = {}) {
  const tracebackId = row.traceback_id || row.id || ''
  const keyword = row.source_detail_url || row.title || row.source_json_name || ''

  activeWorkbenchView.value = 'traceback'
  mergeStagingQuery({
    view: 'traceback',
    ...(tracebackId ? { tracebackId: String(tracebackId) } : {}),
    ...(keyword ? { keyword } : {})
  })
}

function openBodyEditor() {
  if (!currentBatch.value) {
    return
  }

  bodyEditForm.content = currentBatchBodyText.value || ''
  bodyEditDialogVisible.value = true
}

function openProductTypeEditor() {
  if (!currentBatch.value) {
    return
  }

  productTypeEditForm.product_type = currentBatch.value.product_type || 'unknown'
  productTypeEditDialogVisible.value = true
}

async function handleSaveProductType() {
  if (!currentBatch.value?.id || savingProductTypeId.value) {
    return
  }

  try {
    savingProductTypeId.value = currentBatch.value.id
    const res = await updateAnnouncementStagingProductType(currentBatch.value.id, {
      product_type: productTypeEditForm.product_type
    })
    const data = res.data || {}
    productTypeEditDialogVisible.value = false
    ElMessage.success(data.updated_published_id ? '产品类型已同步更新到正式库' : '产品类型已更新')
    await refreshAll({ preferredKey: `body:${currentBatch.value.id}`, force: true })
  } catch (error) {
    console.error('保存产品类型失败:', error)
    ElMessage.error('保存产品类型失败')
  } finally {
    savingProductTypeId.value = null
  }
}


async function handleSaveBodyEdit() {

  if (!currentBatch.value?.id || savingBodyId.value) {
    return
  }

  const nextContent = String(bodyEditForm.content || '').trim()
  if (!nextContent) {
    ElMessage.warning('通告正文不能为空')
    return
  }

  try {
    savingBodyId.value = currentBatch.value.id
    const res = await updateAnnouncementStagingBody(currentBatch.value.id, {
      content: nextContent
    })

    const data = res.data || {}
    const savedContent = data.updated_content || nextContent

    detailMap.value = {
      ...detailMap.value,
      [currentBatch.value.id]: {
        ...(detailMap.value[currentBatch.value.id] || createEmptyDetail()),
        batch: {
          ...(detailMap.value[currentBatch.value.id]?.batch || {}),
          content: savedContent
        }
      }
    }

    treeRows.value = treeRows.value.map((row) => (
      Number(row.id) === Number(currentBatch.value.id)
        ? { ...row, content: savedContent }
        : row
    ))

    bodyEditDialogVisible.value = false
    ElMessage.success(data.updated_published_id ? '正文已同步更新到正式库' : '正文已更新')
    await ensureBatchDetailLoaded(currentBatch.value.id, true)
  } catch (error) {
    console.error('保存通告正文失败:', error)
    ElMessage.error(error?.response?.data?.message || '保存通告正文失败')
  } finally {
    savingBodyId.value = null
  }
}


async function handleGoNextBatch() {
  if (!nextBatch.value?.id || switchingBatchId.value) {
    return
  }

  try {
    switchingBatchId.value = nextBatch.value.id
    await selectBatch(nextBatch.value, {
      force: false,
      tab: activeDetailTab.value === 'attachments' ? 'attachments' : 'body'
    })
  } finally {
    switchingBatchId.value = null
  }
}

async function handleRetreatToTraceback(row) {
  if (!row?.id || retreatingTracebackId.value) {
    return
  }

  const isConfirmed = row.status === 'confirmed'
  const currentVisibleRows = [...visibleTreeRows.value]
  const currentIndex = currentVisibleRows.findIndex((item) => Number(item.id) === Number(row.id))
  const fallbackBatch = currentVisibleRows[currentIndex + 1] || currentVisibleRows[currentIndex - 1] || null

  try {
    const { value } = await ElMessageBox.prompt(
      isConfirmed
        ? `请填写「${row.title || '该批次'}」从正式库退回的原因，系统将删除对应正式稿并把该通告记入倒溯，临时批次恢复为待确认。`
        : `请填写「${row.title || '该批次'}」核验打回的原因（不通过核验），系统将记入倒溯并从临时区移除此通告。`,
      isConfirmed ? '退回正式库录入' : '核验打回',
      {
        type: 'warning',
        confirmButtonText: '确认打回',
        cancelButtonText: '取消',
        inputPlaceholder: isConfirmed
          ? '例如：正文有误、需在倒溯中心修正后再导入'
          : '例如：附件解析不完整、内容与官网不一致',
        inputValue: isConfirmed
          ? '已导入正式库后发现通告内容有误，需要退回倒溯视图人工处理'
          : '人工核验未通过，需要退回倒溯处理'
      }
    )

    retreatingTracebackId.value = row.id
    const res = await retreatAnnouncementStagingToTraceback(row.id, {
      reason: value
    })
    const data = res.data || {}

    if (isConfirmed) {
      detailMap.value = {
        ...detailMap.value,
        [row.id]: {
          ...(detailMap.value[row.id] || createEmptyDetail()),
          batch: {
            ...(detailMap.value[row.id]?.batch || {}),
            status: 'pending',
            published_announcement_id: null,
            published_supervision_id: null,
            confirmed_at: null
          }
        }
      }
      ElMessage.success(res.message || '已退回正式库并完成倒溯关联，请在「倒溯处理」查看')
      await refreshAll({ preferredKey: `body:${row.id}`, force: true })
    } else {
      const nextDetailMap = { ...detailMap.value }
      delete nextDetailMap[row.id]
      detailMap.value = nextDetailMap
      ElMessage.success(res.message || '核验打回已记入倒溯，临时区已移除该批次')
      await refreshAll({ preferredKey: fallbackBatch?.id ? `body:${fallbackBatch.id}` : '', force: true })
    }

    goTracebackCenter({
      traceback_id: data.traceback_id,
      title: row.title,
      source_detail_url: row.source_detail_url
    })
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error('打回 / 退回倒溯失败:', error)
  } finally {
    if (retreatingTracebackId.value === row?.id) {
      retreatingTracebackId.value = null
    }
  }
}

async function handleProductSelect(productType) {
  if (!productType || productType === selectedProductType.value) {
    return
  }

  selectedProductType.value = productType
  ensureDirectorySelection()

  // 重新筛选可见的批次列表
  const filteredRows = visibleTreeRows.value
  if (filteredRows.length === 0) {
    selectedBatchId.value = null
    ElMessage.info('当前筛选下没有通告')
    return
  }

  // 尝试保持当前选中的批次，如果不在新筛选结果中则选择第一个
  const currentBatchStillVisible = filteredRows.some(row => Number(row.id) === Number(selectedBatchId.value))
  if (currentBatchStillVisible) {
    return
  }

  const firstBatch = filteredRows[0]
  if (firstBatch) {
    await selectBatch(firstBatch)
  }
}

async function handleYearSelect(yearKey) {
  if (!yearKey || yearKey === selectedYearKey.value) {
    return
  }

  selectedYearKey.value = yearKey

  // 重新筛选可见的批次列表
  const filteredRows = visibleTreeRows.value
  if (filteredRows.length === 0) {
    selectedBatchId.value = null
    ElMessage.info('当前筛选下没有通告')
    return
  }

  // 尝试保持当前选中的批次，如果不在新筛选结果中则选择第一个
  const currentBatchStillVisible = filteredRows.some(row => Number(row.id) === Number(selectedBatchId.value))
  if (currentBatchStillVisible) {
    return
  }

  const firstBatch = filteredRows[0]
  if (firstBatch) {
    await selectBatch(firstBatch)
  }
}

async function handleBatchPickerChange(batchId) {
  const targetId = Number(batchId || 0)
  if (!targetId || targetId === Number(currentBatchId.value || 0)) {
    return
  }

  const targetRow = visibleTreeRows.value.find((row) => Number(row.id) === targetId)
  if (!targetRow) {
    return
  }

  await selectBatch(targetRow, {
    force: false,
    tab: activeDetailTab.value === 'attachments' ? 'attachments' : 'body'
  })
}

function selectAttachmentFilter(index = null) {

  selectedAttachmentIndex.value = index === null ? null : Number(index)
  activeDetailTab.value = 'attachments'
}

async function handleConfirmAll() {
  if (bulkConfirming.value || !overview.pending_batch_count) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认将当前 ${overview.pending_batch_count} 个待确认批次一键导入正式库吗？系统会按通告类型自动写入抽检库或飞检库，并同步企业、不合格产品和备用快照。`,
      '一键导入正式库',
      {
        type: 'warning',
        confirmButtonText: '确认导入',
        cancelButtonText: '取消'
      }
    )

    bulkConfirming.value = true
    const res = await confirmAllAnnouncementStaging()
    const data = res.data || {}
    if (data.has_failures) {
      ElMessage.warning(`批量导入完成：成功 ${data.success_count || 0} 个，失败 ${data.failed_count || 0} 个`)
    } else {
      ElMessage.success(`批量导入完成：成功导入 ${data.success_count || 0} 个批次`)
    }

    await refreshAll({ preferredKey: selectedTreeKey.value, force: true })
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error('一键导入正式库失败:', error)
  } finally {
    bulkConfirming.value = false
  }
}

async function handleConfirm(row) {
  if (!row?.id || confirmingId.value) {
    return
  }

  const typeInfo = getTypeInfo(row)
  const targetLabel = typeInfo.announcement_type === 'flight_inspection' ? '飞行检查正式库' : '抽检正式库'

  try {
    await ElMessageBox.confirm(
      `确认将“${row.title || '该批次'}”导入${targetLabel}吗？系统会同步写入正式内容、企业、不合格产品，并生成备用快照。`,
      '导入正式库',
      {
        type: 'warning',
        confirmButtonText: '确认导入',
        cancelButtonText: '取消'
      }
    )

    confirmingId.value = row.id
    const res = await confirmAnnouncementStaging(row.id)
    const data = res.data || {}
    ElMessage.success(`导入成功：已同步 ${data.detail_count || 0} 条内容明细到${data.published_target === 'supervisions' ? '飞检库' : '抽检库'}`)

    await refreshAll({ preferredKey: `body:${row.id}`, force: true })
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error('导入正式库失败:', error)
  } finally {
    if (confirmingId.value === row?.id) {
      confirmingId.value = null
    }
  }
}



const goPublished = (id) => {

  if (!id) return
  router.push(isFlightBatch.value ? `/supervisions/${id}` : `/announcements/${id}`)
}

const applyFilters = () => {
  filters.announcement_type = reviewAnnouncementType.value || 'sampling'
  loadTreeData({ preferredKey: selectedTreeKey.value })
}

const resetFilters = () => {
  filters.status = 'pending'
  filters.product_type = ''
  filters.announcement_type = reviewAnnouncementType.value || 'sampling'
  filters.keyword = ''
  loadTreeData({ preferredKey: selectedTreeKey.value })
}

watch(
  [activeDetailTab, currentBatchId],
  () => {
    if (!currentBatchId.value) {
      return
    }

    selectedTreeKey.value = `${activeDetailTab.value === 'attachments' ? 'attachments' : 'body'}:${currentBatchId.value}`
  },
  { immediate: true }
)

watch(
  [filters, detailFilters, selectedTreeKey, selectedBatchId, selectedProductType, selectedYearKey, activeDetailTab, selectedAttachmentIndex, lastImportResult, activeWorkbenchView],


  () => {
    scheduleWorkspaceSave()
  },
  { deep: true }
)

watch(
  () => safeQueryValue(route.query.view),
  (v) => {
    if (!ALLOWED_WORKBENCH_VIEWS.includes(v)) {
      return
    }
    if (activeWorkbenchView.value !== v) {
      activeWorkbenchView.value = v
    }
  }
)

watch(
  () => [safeQueryValue(route.query.focusBatchId), safeQueryValue(route.query.view)],
  async ([fid, view]) => {
    if (!workspaceCacheReady.value) {
      return
    }
    if (view !== 'review' || !fid) {
      return
    }
    const id = Number(fid)
    if (!id || Number(selectedBatchId.value) === id) {
      return
    }

    await focusBatchById(id, { skipMerge: true })
  },
  { flush: 'post' }
)

onMounted(async () => {
  const cachePayload = await loadWorkspaceCache()
  applyWorkspacePayload(cachePayload)
  resolveWorkbenchView(cachePayload)
  await nextTick()
  test()
  const preferredKey = selectedTreeKey.value || (selectedBatchId.value ? `body:${selectedBatchId.value}` : '')
  await refreshAll({ preferredKey })


  const focusBatchId = Number(route.query.focusBatchId || 0)
  if (focusBatchId) {
    await focusBatchById(focusBatchId)
  }

  workspaceCacheReady.value = true
})



onBeforeUnmount(() => {
  if (workspaceSaveTimer) {
    clearTimeout(workspaceSaveTimer)
    workspaceSaveTimer = null
  }
})

</script>

<style scoped>
.announcement-staging {
  max-width: 1760px;
  margin: 0 auto;
}

.page-card,
.tree-panel,
.traceback-panel,
.detail-overview-card,
.detail-content-card,
.recent-card {
  border-radius: 18px;
}

.card-header,
.progress-header-row,
.recent-header,
.panel-header,
.section-toolbar,
.company-item-header,
.attachment-group-header,
.tree-node {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-header-wrap,
.section-toolbar-wrap {
  flex-wrap: wrap;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.subtitle {
  margin-top: 6px;
  color: #606266;
  font-size: 13px;
}

.header-actions,
.recent-tags,
.panel-actions,
.inline-tags,
.detail-filter-actions,
.row-actions,
.attachment-filter-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.row-actions.center,
.inline-tags.end {
  justify-content: flex-end;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card,
.summary-card {
  padding: 18px;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
  border: 1px solid #e5ecfb;
}

.stat-card.primary {
  background: linear-gradient(135deg, #eef4ff 0%, #dde9ff 100%);
}

.stat-card.warning,
.summary-card.warning {
  background: linear-gradient(135deg, #fff8eb 0%, #ffefd1 100%);
}

.stat-card.danger,
.summary-card.danger {
  background: linear-gradient(135deg, #fff1f0 0%, #ffe2de 100%);
}

.stat-card.success,
.summary-card.success {
  background: linear-gradient(135deg, #eefbf3 0%, #dbf5e5 100%);
}

.stat-label,
.summary-label,
.company-products-label {
  font-size: 13px;
  color: #606266;
}

.stat-value,
.summary-value {
  margin-top: 10px;
  font-size: 32px;
  line-height: 1;
  font-weight: 700;
  color: #303133;
}

.stat-meta,
.panel-tip,
.tree-subtitle,
.company-address {
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
}

.progress-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.progress-card {
  padding: 18px;
  border-radius: 16px;
  background: #f8fbff;
  border: 1px solid #e9eef8;
}

.progress-title,
.recent-title,
.panel-title,
.section-title,
.tree-title {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}

.progress-subtitle,
.recent-subtitle,
.panel-subtitle {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
}

.progress-percentage {
  font-size: 22px;
  font-weight: 700;
  color: #409eff;
}

.success-text {
  color: #67c23a;
}

.progress-meta-row,
.list-meta-row {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #909399;
  font-size: 12px;
  flex-wrap: wrap;
}

.list-meta-row.compact {
  margin-top: 0;
}

.recent-card,
.filter-form {
  margin-bottom: 20px;
}

.filter-form,
.traceback-filter-form {
  padding: 16px;
  background: #f7f9fc;
  border-radius: 14px;
}

.traceback-filter-form {
  margin-bottom: 12px;
}

.workspace-layout {
  display: grid;
  grid-template-columns: 1fr 3fr;
  gap: 20px;
  align-items: start;
}

.workspace-layout-review {
  grid-template-columns: minmax(260px, 300px) minmax(0, 1fr);
  gap: 16px;
}

.filter-sidebar {
  position: relative;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  min-height: 100px;
}

.filter-sidebar-section {
  background: #fff;
}

.filter-sidebar-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: none;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  color: #303133;
}

.filter-sidebar-head:hover {
  background: #fafafa;
}

.filter-sidebar-head-icon {
  font-size: 18px;
  color: #606266;
  flex-shrink: 0;
}

.filter-sidebar-head-title {
  flex: 1;
  font-weight: 600;
}

.filter-sidebar-chevron {
  font-size: 14px;
  color: #909399;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.filter-sidebar-chevron.is-collapsed {
  transform: rotate(-90deg);
}

.filter-sidebar-divider {
  height: 1px;
  background: #ebeef5;
}

.filter-sidebar-list {
  padding: 0 10px 14px 14px;
}

.filter-sidebar-list--year {
  padding-top: 0;
}

.filter-sidebar-hint {
  padding: 0 10px 10px 26px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.filter-sidebar-scroll {
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.filter-sidebar-scroll::-webkit-scrollbar {
  width: 6px;
}

.filter-sidebar-scroll::-webkit-scrollbar-thumb {
  background: #d4d9e1;
  border-radius: 999px;
}

.filter-sidebar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 10px 8px 26px;
  margin: 2px 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.filter-sidebar-row:hover:not(.disabled) {
  background: #f5f7fa;
}

.filter-sidebar-row.active {
  background: #ecf5ff;
}

.filter-sidebar-row.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.filter-sidebar-label {
  font-size: 14px;
  color: #303133;
  line-height: 1.4;
}

.filter-sidebar-count {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  color: #5b9bd5;
}

.filter-sidebar-row.active .filter-sidebar-count {
  color: #409eff;
}

.left-column,
.detail-layout {
  display: grid;
  gap: 16px;
}

.detail-layout {
  grid-template-rows: auto minmax(0, 1fr);
}

.directory-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 10px;
}

.directory-picker {
  display: grid;
  gap: 14px;
}

.product-rail-wrap,
.year-stage {
  min-width: 0;
}

.product-rail {
  display: grid;
  gap: 8px;
}

.product-rail.simple {
  padding: 0;
}

.product-rail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease;
  color: #303133;
}

.product-rail-item:hover:not(.disabled) {
  border-color: #cfd8e3;
  background: #fafafa;
}

.product-rail-item.active {
  border-color: #409eff;
  background: #f5f9ff;
  color: #409eff;
}

.product-rail-item.disabled,
.year-option-card.disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.product-rail-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
}

.product-rail-count {
  flex-shrink: 0;
  min-width: 28px;
  padding: 0 6px;
  height: 22px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #909399;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.product-rail-item.active .product-rail-count {
  background: #e8f3ff;
  color: #409eff;
}

.year-stage {
  padding: 14px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #ffffff;
}

.year-stage-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.year-stage-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.year-stage-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.year-stage-scroll {
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.year-stage-scroll::-webkit-scrollbar {
  width: 6px;
}

.year-stage-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.year-stage-scroll::-webkit-scrollbar-thumb {
  background: #d4d9e1;
  border-radius: 999px;
}

.year-option-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.year-option-card {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.year-option-card:hover:not(.disabled) {
  border-color: #cfd8e3;
  background: #fafafa;
}

.year-option-card.active {
  border-color: #409eff;
  background: #f5f9ff;
}

.year-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.year-option-label {
  font-size: 14px;
  line-height: 1.4;
  font-weight: 600;
  color: #303133;
}

.year-option-count {
  flex-shrink: 0;
  min-width: 28px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #909399;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.year-option-card.active .year-option-count {
  background: #e8f3ff;
  color: #409eff;
}

.year-option-meta {
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

.batch-picker {
  width: min(420px, 100%);
}

.staging-tree :deep(.el-tree-node__content) {
  min-height: 52px;
  border-radius: 12px;
  margin-bottom: 6px;
}

.tree-node {
  width: 100%;
  padding: 6px 0;
}

.product-node {
  padding-right: 8px;
}

.leaf-node .tree-title {
  font-size: 14px;
}

.detail-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.detail-tabs :deep(.el-tabs__nav-wrap) {
  margin-bottom: 8px;
}

.content-scroll-panel,
.company-list-scroll {
  max-height: 720px;
  overflow: auto;
  padding-right: 6px;
}

.company-list-scroll-large {
  max-height: 780px;
}


.content-body-text {
  padding: 18px;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid #e7eefb;
  color: #303133;
  line-height: 1.9;
  white-space: pre-wrap;
  word-break: break-word;
}

.attachment-group-list {
  display: grid;
  gap: 14px;
}

.attachment-group-card,
.company-list-item {
  padding: 18px;
  border-radius: 16px;
  border: 1px solid #e8edf7;
  background: linear-gradient(180deg, #ffffff 0%, #fafcff 100%);
}

.company-products-label {
  margin-top: 14px;
  font-weight: 600;
}

.company-products-text {
  margin-top: 8px;
  color: #303133;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.muted-text {
  color: #909399;
}

.mb-16 {
  margin-bottom: 16px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #eef5ff;
}

@media (max-width: 1400px) {
  .workspace-layout {
    grid-template-columns: minmax(260px, 1fr) minmax(0, 2.4fr);
  }

  .detail-summary-grid,
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .workspace-layout {
    grid-template-columns: 1fr;
  }

  .workspace-layout-review {
    grid-template-columns: 1fr;
  }

  .year-stage-scroll {
    max-height: none;
  }

  .filter-sidebar-scroll {
    max-height: none;
  }
}

@media (max-width: 768px) {
  .card-header,
  .progress-header-row,
  .recent-header,
  .panel-header,
  .section-toolbar,
  .company-item-header,
  .attachment-group-header,
  .year-stage-header {
    flex-direction: column;
    align-items: stretch;
  }

  .stats-grid,
  .progress-grid,
  .detail-summary-grid {
    grid-template-columns: 1fr;
  }

  .progress-meta-row,
  .list-meta-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .detail-filter-actions,
  .batch-picker {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .year-stage,
  .product-rail-item,
  .year-option-card {
    padding-left: 10px;
    padding-right: 10px;
  }
}

/* 简约化目录卡片与年份卡片样式 */
.directory-panel {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
}

/* 使用 simple 修饰类的更简约样式 */
.directory-picker.simple .product-rail-item.simple {
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff;
  border-color: #e5e7eb;
}
.directory-picker.simple .product-rail-item.simple:hover:not(.disabled) {
  background: #fafafa;
  border-color: #dcdfe6;
}
.directory-picker.simple .product-rail-item.simple.active {
  background: #f6faff;
  border-color: #cfe4ff;
  color: #2367d1;
}

.year-stage.simple {
  padding: 12px;
  border-radius: 10px;
  border-color: #ebeef5;
  background: #fff;
}
.year-option-grid.simple .year-option-card.simple {
  padding: 8px 10px;
  border-radius: 8px;
  border-color: #e5e7eb;
  background: #fff;
}
.year-option-grid.simple .year-option-card.simple:hover:not(.disabled) {
  background: #fafafa;
  border-color: #dcdfe6;
}
.year-option-grid.simple .year-option-card.simple.active {
  background: #f6faff;
  border-color: #cfe4ff;
}

/* 调整计数徽标更素雅 */
.product-rail-count,
.year-option-count {
  background: #f5f7fa;
}

/* 卡片 header 更紧凑 */
.directory-panel :deep(.el-card__header) {
  padding: 10px 12px;
}

.hidden-file-input {
  display: none;
}

.workbench-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.stage-nav {
  position: sticky;
  top: 16px;
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid #ebeef5;
  border-radius: 16px;
  background: #fbfcff;
}

.stage-nav-title {
  font-size: 13px;
  font-weight: 700;
  color: #606266;
  margin-bottom: 2px;
}

.stage-nav-item {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  color: #303133;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.stage-nav-item span,
.stage-nav-item small {
  display: block;
}

.stage-nav-item span {
  font-size: 14px;
  font-weight: 700;
}

.stage-nav-item small {
  margin-top: 4px;
  color: #909399;
  line-height: 1.4;
}

.stage-nav-item:hover,
.stage-nav-item.active {
  border-color: #cfe4ff;
  background: #f6faff;
}

.stage-nav-item.active span {
  color: #2367d1;
}

.workbench-main {
  min-width: 0;
}

.hidden-file-input {
  display: none;
}

.quick-guide,
.review-stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.quick-guide span {
  padding: 8px 12px;
  border-radius: 999px;
  background: #f5f7fa;
  color: #606266;
  font-size: 13px;
}

.review-type-tabs {
  min-width: 260px;
}

@media (max-width: 1100px) {
  .workbench-shell {
    grid-template-columns: 1fr;
  }

  .stage-nav {
    position: static;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .stage-nav {
    grid-template-columns: 1fr;
  }
}

</style>
