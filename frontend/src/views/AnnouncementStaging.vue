<template>
  <div class="announcement-staging">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">数据导入</div>
          </div>
          <div class="header-actions">
            <input ref="folderInputRef" type="file" class="hidden-file-input" multiple webkitdirectory
              accept=".json,application/json" @change="handleUploadInputChange">
            <input ref="fileInputRef" type="file" class="hidden-file-input" multiple accept=".json,application/json"
              @change="handleUploadInputChange">
            <input ref="productImageInputRef" type="file" class="hidden-file-input" multiple accept="image/*"
              @change="handleProductImageInputChange">
            <input ref="stagingRowPictureInputRef" type="file" class="hidden-file-input"
              accept="image/png,image/jpeg,image/webp" @change="handleStagingRowPictureInputChange">
            <!-- <el-button type="primary" :loading="importing" @click="selectUploadFolder">
              <el-icon>
                <Upload />
              </el-icon>
              上传文件夹
            </el-button> -->
            <el-button type="primary" :disabled="importing" @click="selectUploadFiles">上传文件</el-button>

            <el-button v-if="uploadFileRows.length" plain @click="uploadPreviewDialogVisible = true">
              已选 {{ uploadFileRows.length }} 个文件
            </el-button>
            <el-button :loading="loading || overviewLoading" @click="refreshAll({ force: true })">
              <el-icon>
                <Refresh />
              </el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="mainTab" class="staging-main-tabs" @tab-change="onMainTabChange">
        <!-- <el-tab-pane label="批量 JSON 工作台" name="batches"> -->
        <!-- <el-alert
            type="info"
            :closable="false"
            show-icon
            class="mb-16"
            title="在此上传 JSON 并查看概览；筛选列表、修订正文与「可导入」请打开「临时批次核验」页签。"
          /> -->

        <!-- <div class="staging-stats-row" v-loading="overviewLoading">
            <div class="stats-grid stats-grid-simple">
              <div class="stat-card">
                <div class="stat-label">临时批次总数</div>
                <div class="stat-value">{{ overview.staging_batch_count || 0 }}</div>
                <div class="stat-meta">
                  待入库 {{ overview.pending_batch_count || 0 }} · 已导入 {{ overview.confirmed_batch_count || 0 }}
                </div>
              </div>
              <div class="stat-card warning">
                <div class="stat-label">待核验条目</div>
                <div class="stat-value">{{ overview.pending_detail_count || 0 }}</div>
                <div class="stat-meta">逐条校对后再入库更稳妥</div>
              </div>
              <div class="stat-card danger">
                <div class="stat-label">倒溯待处理</div>
                <div class="stat-value">{{ overview.pending_traceback_count || 0 }}</div>
                <div class="stat-meta">重复 / 解析失败 / 入库异常等在「异常倒溯」页签查看</div>
              </div>
            </div>
             <div class="progress-strip">
              <div class="progress-strip-head">
                <span class="progress-strip-title">正式库入库进度</span>
                <span class="progress-strip-pct success-text">{{ overview.publish_progress_percent || 0 }}%</span>
              </div>
              <el-progress :percentage="overview.publish_progress_percent || 0" :stroke-width="8" status="success" />
              <div class="progress-strip-meta">
                <span>{{ overview.confirmed_batch_count || 0 }} / {{ overview.staging_batch_count || 0 }} 批次</span>
                <span>条目累计 {{ overview.total_detail_count || 0 }}</span>
              </div>
            </div> 
          </div> -->

        <!-- <el-card v-if="lastImportResult" shadow="never" class="recent-card mb-16">
            <template #header>
              <div class="recent-header">
                <div>
                  <div class="recent-title">最近一次上传结果</div>
                  <div class="recent-subtitle">可点击「定位」切换到「临时批次核验」并选中对应批次；倒溯请打开「异常倒溯」。</div>
                </div>
                <div class="recent-tags">
                  <el-tag type="success">新增 {{ lastImportResult.created_count || 0 }}</el-tag>
                  <el-tag type="warning">重复 {{ lastImportResult.duplicate_count || 0 }}</el-tag>
                  <el-tag type="warning">待核验 {{ lastImportResult.parse_warning_count ?? lastImportResult.parse_failed_count ?? 0 }}</el-tag>
                  <el-tag v-if="lastImportResult.error_count" type="info">异常 {{ lastImportResult.error_count }}</el-tag>
                </div>
              </div>
            </template>
            <el-table :data="lastImportResult.items || []" size="small" max-height="220">
              <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
              <el-table-column label="结果" width="120" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="getImportActionMeta(row).type">{{ getImportActionMeta(row).label }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="detail_count" label="内容数" width="76" align="center" />
              <el-table-column label="提示" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.warning_message || row.delete_message || '-' }}</template>
              </el-table-column>
              <el-table-column label="上传人" width="100" show-overflow-tooltip>
                <template #default="{ row }">{{ getSourceUserLabel(row) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="112" align="center">
                <template #default="{ row }">
                  <el-button v-if="row.id" link type="primary" size="small" @click="focusBatchById(row.id)">定位</el-button>
                  <el-button v-else-if="row.traceback_id" link type="warning" size="small" @click="goTracebackCenter(row)">倒溯</el-button>
                  <span v-else class="muted-text">—</span>
                </template>
              </el-table-column>
            </el-table>
          </el-card> -->

        <!-- </el-tab-pane> -->

        <el-tab-pane label="待核验批次" name="batchReview">
          <div class="workspace-layout workspace-layout-simple">
            <div class="batch-list-pane">
              <el-card shadow="never" class="batch-list-card" v-loading="loading">


                <el-form :model="filters" inline class="filter-form-batch">
                  <el-form-item label="年份">
                    <el-select v-model="filters.year" clearable placeholder="全部" style="width: 120px"
                      @change="applyFilters">
                      <el-option v-for="opt in yearOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="产品">
                    <el-select v-model="filters.product_type" clearable placeholder="全部" style="width: 120px"
                      @change="applyFilters">
                      <el-option v-for="opt in productTypeOptions" :key="opt.value" :label="opt.label"
                        :value="opt.value" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="状态">
                    <el-select v-model="filters.status" clearable placeholder="全部状态" style="width: 138px"
                      @change="applyFilters">
                      <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                    </el-select>
                  </el-form-item>
                  <el-form-item style="margin-bottom: 0px;">
                    <el-button type="primary" @click="applyFilters">检索</el-button>
                    <el-button @click="resetFilters">重置</el-button>
                    <el-button type="success" plain :disabled="!overview.pending_batch_count" :loading="bulkConfirming"
                      style="margin: 12px 10px !important;" @click="handleConfirmAll">
                      一键入库（{{ overview.pending_batch_count || 0 }}）
                    </el-button>
                  </el-form-item>
                </el-form>

                <el-table class="batch-table " :data="batchListRows" row-key="id"
                  :max-height="batchReviewTableMaxHeight" size="small" stripe :row-class-name="batchRowClassName"
                  @row-click="handleBatchRowClick">
                  <el-table-column label="通告标题" min-width="190" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.title || '（无标题）' }}</template>
                  </el-table-column>
                  <!-- <el-table-column prop="announcement_no" label="年号" width="90" align="center" show-overflow-tooltip/> -->
                  <!-- <el-table-column label="状态" width="82" align="center">
                    <template #default="{ row }">
                      <el-tag size="small" :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status)
                        }}</el-tag>
                    </template>
                  </el-table-column> -->
                  <!-- <el-table-column label="上传人" width="88" show-overflow-tooltip>
                    <template #default="{ row }">{{ getSourceUserLabel(row) }}</template>
                  </el-table-column> -->
                  <!-- <el-table-column label="来源文件" min-width="140" show-overflow-tooltip>
                    <template #default="{ row }">{{ getStagingSourceFileLabel(row) }}</template>
                  </el-table-column> -->
                  <!-- <el-table-column prop="publish_date" label="发布日期" width="112" align="center" /> -->
                </el-table>
              </el-card>
            </div>

            <div class="detail-layout">


              <el-card class="detail-content-card" shadow="never" v-loading="detailBusy">

                <template #header>
                  <div class="panel-header panel-header-wrap">
                    <div>
                      <div class="panel-title">{{ currentBatch ? currentBatch.title : '详细信息' }}</div>
                    </div>
                    <div v-if="currentBatch" class="panel-actions"> <el-button type="danger" plain
                        :loading="stagingBatchDeleting"
                        :disabled="stagingDraftSaving || bulkConfirming || confirmingId === currentBatch?.id"
                        @click="handleDeleteCurrentBatch">
                        删除
                      </el-button>
                      <el-button type="primary" plain :loading="stagingDraftSaving" @click="handleStagingDraftSave">
                        暂存
                      </el-button>

                      <!-- <el-button v-if="nextBatch" type="primary" plain :loading="switchingBatchId === nextBatch.id"
                        @click="handleGoNextBatch()">
                        下一个通告
                      </el-button> -->


                      <el-button type="success" :loading="confirmingId === currentBatch.id"
                        @click="handleConfirm(currentBatch)">
                        {{ currentBatch.status === 'confirmed' ? '重新导入' : '导入' }}
                      </el-button>
                    </div>
                  </div>
                </template>
                <template v-if="currentBatch">
                  <el-tabs v-model="activeDetailTab" class="detail-tabs">
                    <el-tab-pane label="通告正文" name="body">
                      <div class="section-toolbar section-toolbar-wrap">
                        <div class="attachment-table-edit-actions">
                          <el-button v-if="!bodyTabEditing" link @click="enterBodyTabEdit">
                            编辑
                          </el-button>
                          <el-button v-else @click="saveBodyTabEdit" link>
                            保存
                          </el-button>
                        </div>
                      </div>
                      <div v-if="currentBatch" class="content-scroll-panel">
                        <el-form v-show="bodyTabEditing" ref="infoEditFormRef" :model="infoEditForm"
                          :rules="infoEditRules" class="inline-staging-info-form">
                          <el-descriptions :column="2" border>
                            <el-descriptions-item label="列表期号展示">{{ getBatchPeriodLabel(currentBatch) || '-'
                            }}</el-descriptions-item>
                            <el-descriptions-item label="通告标题">
                              <el-form-item prop="title" class="nested-form-item">
                                <el-input v-model="infoEditForm.title" size="small" placeholder="通告标题" />
                              </el-form-item>
                            </el-descriptions-item>
                            <el-descriptions-item label="公告编号">
                              <el-input v-model="infoEditForm.announcement_no" size="small" />
                            </el-descriptions-item>
                            <el-descriptions-item label="发布日期">
                              <el-date-picker v-model="infoEditForm.publish_date" type="date" width="100%"
                                value-format="YYYY-MM-DD" placeholder="选择日期" size="small" />
                            </el-descriptions-item>
                            <el-descriptions-item label="产品类型">
                              <el-form-item class="nested-form-item">
                                <el-select v-model="infoEditForm.product_type" placeholder="请选择" size="small">
                                  <el-option v-for="opt in productTypeOptions" :key="opt.value" :label="opt.label"
                                    :value="opt.value" />
                                </el-select>
                              </el-form-item>
                            </el-descriptions-item>
                            <el-descriptions-item label="通告类型">
                              <el-form-item class="nested-form-item">
                                <el-select v-model="infoEditForm.announcement_type" placeholder="请选择" size="small">
                                  <el-option v-for="opt in announcementTypeOptions" :key="opt.value" :label="opt.label"
                                    :value="opt.value" />
                                </el-select>
                              </el-form-item>
                            </el-descriptions-item>
                            <el-descriptions-item label="检验/检查单位">
                              <el-input v-model="infoEditForm.inspection_unit" size="small" />
                            </el-descriptions-item>

                            <!-- <el-descriptions-item label="来源用户" :span="2">{{ getSourceUserLabel(currentBatch)
                              }}</el-descriptions-item> -->

                            <el-descriptions-item label="通告网址" :span="2">
                              <el-input v-model="infoEditForm.source_detail_url" size="small" />
                            </el-descriptions-item>
                            <el-descriptions-item label="来源页" :span="2">
                              <el-input v-model="infoEditForm.source_page" size="small" />
                            </el-descriptions-item>
                          </el-descriptions>
                        </el-form>
                        <div v-show="bodyTabEditing" class="content-body-text content-body-editor-wrap">
                          <el-input v-model="bodyEditForm.content" type="textarea" :rows="16" resize="vertical"
                            maxlength="30000" show-word-limit class="content-body-editor-input"
                            placeholder="通告正文（可在此直接编辑）" />
                        </div>
                        <el-descriptions v-show="!bodyTabEditing" :column="2" border>
                          <el-descriptions-item label="列表期号展示">{{ getBatchPeriodLabel(currentBatch) || '-'
                          }}</el-descriptions-item>
                          <el-descriptions-item label="通告标题">{{ infoEditForm.title || '—' }}</el-descriptions-item>
                          <el-descriptions-item label="公告编号">{{ infoEditForm.announcement_no || '—'
                          }}</el-descriptions-item>
                          <el-descriptions-item label="发布日期">{{ infoEditForm.publish_date || '—'
                          }}</el-descriptions-item>
                          <el-descriptions-item label="产品类型">{{ getStagingProductTypeLabel(infoEditForm.product_type)
                          }}</el-descriptions-item>
                          <el-descriptions-item label="通告类型">{{
                            getStagingAnnouncementTypeLabel(infoEditForm.announcement_type) }}</el-descriptions-item>
                          <el-descriptions-item label="检验/检查单位" :span="2">{{ infoEditForm.inspection_unit || '—'
                          }}</el-descriptions-item>
                          <el-descriptions-item label="通告网址" :span="2">{{ infoEditForm.source_detail_url || '—'
                          }}</el-descriptions-item>
                          <el-descriptions-item label="来源页" :span="2">{{ infoEditForm.source_page || '—'
                          }}</el-descriptions-item>
                        </el-descriptions>
                        <div v-show="!bodyTabEditing"
                          class="content-body-text content-body-editor-wrap content-body-readonly">
                          {{ bodyEditForm.content || '—' }}
                        </div>
                      </div>
                    </el-tab-pane>

                    <el-tab-pane label="附件解析产品列表" name="attachments">
                      <div class="section-toolbar section-toolbar-wrap" >
                        <div v-if="hasAttachmentSamplingEditableTable" class="attachment-table-edit-actions">
                          <el-button v-if="!attachmentsTableEditingRowKey" link
                            title="请先在表格左侧展开恰好一行后再编辑该产品"
                            @click="enterAttachmentsTableEdit">
                            编辑
                          </el-button>

                          <el-button v-else :loading="savingStagingAttachmentsInline" link type="primary"
                            @click="saveAttachmentsTableEdit">
                            保存
                          </el-button>
                          <el-button type="success" plain :loading="uploadingProductImages" link
                            @click="selectProductImages">
                            导入图片
                          </el-button>
                        </div>
                      </div>

                      <el-alert v-if="currentParseNotice" :type="currentParseNotice.type" :closable="false" show-icon
                        class="mb-16" :title="currentParseNotice.title" />


                      <div v-if="currentAttachmentGroups.length" class="attachment-parse-body">
                        <div class="attachment-group-list">
                          <div class="attachment-group-card attachment-group-card-combined">

                            <template v-if="currentMergedJsonAttachmentGroup.filtered_rows.length">
                              <div class="staging-attachment-table-shell">
                              <el-table v-if="isFlightBatch" :data="currentMergedJsonAttachmentGroup.filtered_rows"
                                size="small" stripe :max-height="attachmentTableMaxHeight"
                                class="table-height staging-attachment-table" style="width: 100%">
                                <el-table-column prop="sequence_no" label="序号" width="64" align="center" />
                                <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
                                <el-table-column prop="company_name" label="企业名称" min-width="160"
                                  show-overflow-tooltip />
                                <el-table-column prop="inspection_unit" label="检查单位" min-width="140"
                                  show-overflow-tooltip />
                                <el-table-column prop="defects_and_problems" label="检查问题" min-width="200"
                                  show-overflow-tooltip />
                                <el-table-column prop="handling_measures" label="处理措施" min-width="160"
                                  show-overflow-tooltip />
                              </el-table>

                              <el-table v-else :data="currentMergedJsonAttachmentGroup.filtered_rows" size="small"
                                stripe :max-height="attachmentTableMaxHeight"
                                class="table-height staging-attachment-table" style="width: 100%"
                                :row-key="(row) => stagingSamplingTableRowKey(currentMergedJsonAttachmentGroup, row)"
                                :expand-row-keys="stagingMergedAccordionExpandKeys"
                                @expand-change="onStagingSamplingMergedTableExpandChange">
                                <el-table-column type="expand" width="44">
                                  <template #default="{ row }">
                                    <template v-if="isStagingMergedSamplingRowEditing(row)">
                                      <el-descriptions :column="2" border size="small" class="detail-expanded">
                                        <el-descriptions-item label="生产企业">
                                          <el-input v-model="row.company_names" :autosize="{ minRows: 2, maxRows: 6 }"
                                            size="small" placeholder="注册人/备案人等名称" />
                                        </el-descriptions-item>
                                        <el-descriptions-item label="生产企业地址">
                                          <el-input v-model="row.company_addresses" type="textarea"
                                            :autosize="{ minRows: 2, maxRows: 6 }" size="small" placeholder="地址" />
                                        </el-descriptions-item>
                                        <el-descriptions-item label="被抽样单位名称">
                                          <el-input v-model="row.sample_unit_name" size="small" placeholder="被抽样单位名称" />
                                        </el-descriptions-item>
                                        <el-descriptions-item label="被抽样单位地址">
                                          <el-input v-model="row.sample_unit_address" type="textarea"
                                            :autosize="{ minRows: 2, maxRows: 4 }" size="small" placeholder="地址" />
                                        </el-descriptions-item>
                                        <el-descriptions-item label="正文文案" :span="2">
                                          <el-input v-model="row.food_body_text" type="textarea"
                                            :autosize="{ minRows: 2, maxRows: 6 }" size="small" placeholder="正文文案" />
                                        </el-descriptions-item>
                                        <el-descriptions-item label="生产日期">
                                          <el-input v-model="row.production_date" size="small" placeholder="生产日期" />
                                        </el-descriptions-item>
                                        <el-descriptions-item label="限期使用日期/保质期">
                                          <el-input v-model="row.expiry_date" size="small" placeholder="限期使用日期/保质期" />
                                        </el-descriptions-item>
                                        <el-descriptions-item v-if="!isFoodStagingBatch" label="所在地/进口地区">
                                          <el-input v-model="row.product_region" size="small" placeholder="所在地/进口地区" />
                                        </el-descriptions-item>
                                        <el-descriptions-item v-if="!isFoodStagingBatch" label="注册/备案编号">
                                          <el-input v-model="row.registration_no" size="small" placeholder="注册/备案编号" />
                                        </el-descriptions-item>
                                        <el-descriptions-item v-if="!isFoodStagingBatch" label="生产许可证号">
                                          <el-input v-model="row.production_license_no" size="small"
                                            placeholder="生产许可证号" />
                                        </el-descriptions-item>
                                        <el-descriptions-item label="检验结果">
                                          <el-input v-model="row.inspection_result" type="textarea"
                                            :autosize="{ minRows: 2, maxRows: 6 }" size="small" placeholder="检验结果" />
                                        </el-descriptions-item>
                                        <el-descriptions-item label="规定要求">
                                          <el-input v-model="row.requirement" type="textarea"
                                            :autosize="{ minRows: 2, maxRows: 6 }" size="small" placeholder="规定要求" />
                                        </el-descriptions-item>
                                        <el-descriptions-item label="备注" >
                                          <el-input v-model="row.remarks" type="textarea"
                                            :autosize="{ minRows: 2, maxRows: 6 }" size="small" placeholder="备注" />
                                        </el-descriptions-item>
                                        <el-descriptions-item label="涉嫌假冒">
                                          <el-switch :model-value="Boolean(Number(row.is_counterfeit))"
                                            @update:model-value="(v) => { row.is_counterfeit = v ? 1 : 0 }" />
                                        </el-descriptions-item>
                                      </el-descriptions>
                                    </template>
                                    <el-descriptions v-else :column="2" border size="small" class="detail-expanded">
                                      <el-descriptions-item label="生产企业">
                                        <span class="attachment-readonly-block">{{ row.company_names || '—' }}</span>
                                      </el-descriptions-item>
                                      <el-descriptions-item label="生产企业地址">
                                        <span class="attachment-readonly-block">{{ row.company_addresses || '—'
                                        }}</span>
                                      </el-descriptions-item>
                                      <el-descriptions-item label="被抽样单位名称">
                                        {{ row.sample_unit_name || '—' }}
                                      </el-descriptions-item>
                                      <el-descriptions-item label="被抽样单位地址">
                                        <span class="attachment-readonly-block">{{ row.sample_unit_address || '—'
                                          }}</span>
                                      </el-descriptions-item>
                                      <el-descriptions-item label="生产日期">
                                        {{ row.production_date || '—' }}
                                      </el-descriptions-item>
                                      <el-descriptions-item label="限期使用日期/保质期">
                                        {{ row.expiry_date || '—' }}
                                      </el-descriptions-item>
                                      <el-descriptions-item v-if="!isFoodStagingBatch" label="所在地/进口地区">
                                        {{ row.product_region || '—' }}
                                      </el-descriptions-item>
                                      <el-descriptions-item v-if="!isFoodStagingBatch" label="注册/备案编号">
                                        {{ row.registration_no || '—' }}
                                      </el-descriptions-item>
                                      <el-descriptions-item v-if="!isFoodStagingBatch" label="生产许可证号">
                                        {{ row.production_license_no || '—' }}
                                      </el-descriptions-item>
                                      <el-descriptions-item label="检验结果">
                                        <span class="attachment-readonly-block">{{ row.inspection_result || '—'
                                        }}</span>
                                      </el-descriptions-item>
                                      <el-descriptions-item label="规定要求">
                                        <span class="attachment-readonly-block">{{ row.requirement || '—' }}</span>
                                      </el-descriptions-item>
                                      <el-descriptions-item label="备注" >
                                        <span class="attachment-readonly-block">{{ row.remarks || '—' }}</span>
                                      </el-descriptions-item>
                                      <el-descriptions-item label="涉嫌假冒">
                                        {{ Number(row.is_counterfeit) ? '是' : '否' }}
                                      </el-descriptions-item>
                                    </el-descriptions>
                                  </template>
                                </el-table-column>
                                <el-table-column label="序号" width="60" align="center">
                                  <template #default="{ row }">
                                    <span>{{ row.sequence_no || '—' }}</span>
                                  </template>
                                </el-table-column>
         
                                <el-table-column label="产品名称" min-width="140" show-overflow-tooltip>
                                  <template #default="{ row }">
                                    <el-input v-if="isStagingMergedSamplingRowEditing(row)" v-model="row.product_name"
                                      size="small" />
                                    <span v-else>{{ row.product_name || '—' }}</span>
                                  </template>
                                </el-table-column>
                                <el-table-column prop="attachment_sampling_category" label="产品分类" min-width="72" show-overflow-tooltip>
                                  <template #default="{ row }">
                                    <el-input v-if="isStagingMergedSamplingRowEditing(row)"
                                      v-model="row.attachment_sampling_category" size="small" />
                                    <span v-else>{{ row.attachment_sampling_category || '—' }}</span>
                                  </template>
                                </el-table-column>
                                <!-- <el-table-column prop="sample_unit_name" label="被抽样单位" show-overflow-tooltip>
                                    <template #default="{ row }">
                                      <el-input v-if="attachmentsListEditing" v-model="row.sample_unit_name" size="small" />
                                      <span v-else>{{ row.sample_unit_name || '—' }}</span>
                                    </template>
                                  </el-table-column> -->

                                
                                <el-table-column prop="unqualified_items" label="不符合规定项目" min-width="130" show-overflow-tooltip>
                                  <template #default="{ row }">
                                    <el-input v-if="isStagingMergedSamplingRowEditing(row)"
                                      v-model="row.unqualified_items" size="small" />
                                    <span v-else>{{ row.unqualified_items || '—' }}</span>
                                  </template>
                                </el-table-column>
                                <el-table-column
                                  v-if="isFoodStagingBatch"
                                  prop="food_body_text"
                                  label="正文文案"
                                  min-width="120"
                                  show-overflow-tooltip
                                >
                                  <template #default="{ row }">
                                    <div class="staging-food-body-cell" >
                                      <span class="staging-food-body-snippet muted-text" >{{ formatFoodBodySnippet(row.food_body_text) }}</span>
                                      <el-button
                                        type="primary"
                                        link
                                        size="small"
                                        @click.stop="openFoodBodyTextPicker(row)"
                                        v-if="row.food_body_text == null"
                                      >
                                        查看正文
                                      </el-button>

                                    </div>
                                  </template>
                                </el-table-column>
                                <el-table-column prop="picture_url" label="产品图" min-width="108" align="center" show-overflow-tooltip>
                                  <template #default="{ row }">
                                    <div class="staging-product-picture-cell staging-product-picture-cell-col">
                                      <template v-if="resolveProductPictureSrc(row.picture_url)">
                                        <el-image class="staging-product-thumb" fit="cover"
                                          :src="resolveProductPictureSrc(row.picture_url)"
                                          :preview-src-list="[resolveProductPictureSrc(row.picture_url)]"
                                          preview-teleported hide-on-click-modal />
                                        <!-- <span class="staging-picture-meta muted-text">{{ row.picture_url }}</span> -->
                                      </template>
                                      <span v-else class="muted-text">—</span>
                                      <div v-if="canUploadStagingRowProductPicture" class="staging-row-picture-actions">
                                        <el-button type="primary" link size="small"
                                          :loading="isStagingRowPictureUploading(currentMergedJsonAttachmentGroup, row)"
                                          @click.stop="triggerStagingRowPictureUpload(row)">
                                          <!-- {{ row.picture_url ? '替换图片' : '本地上传' }} -->
                                          上传图片
                                        </el-button>
                                      </div>
                                      <div v-if="isStagingMergedSamplingRowEditing(row)"
                                        class="muted-text staging-picture-edit-tip">
                                        请先点「保存」完成本条编辑后，再为本行上传图片
                                      </div>
                                    </div>
                                  </template>
                                </el-table-column>

                              </el-table>
                              </div>
                            </template>
                            <el-empty v-else :description="detailFilters.keyword ? '当前筛选条件下没有匹配结果' : '暂无附件解析明细'" />
                          </div>
                        </div>
                      </div>
                      <el-empty v-else description="当前批次暂无附件解析产品列表" />

                      <!-- Legacy per-attachment renderer retained for reference during migration.
                      <div v-if="currentAttachmentGroups.length" class="attachment-group-list">
                        <div v-for="attachment in currentAttachmentGroups" :key="attachment.index"
                          class="attachment-group-card">

                          <template v-if="attachment.filtered_rows.length">
                            <el-table v-if="isFlightBatch" :data="attachment.filtered_rows" size="small" stripe
                              :max-height="attachmentTableMaxHeight" class="table-height">
                              <el-table-column prop="sequence_no" label="序号" width="70" align="center" />
                              <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
                              <el-table-column prop="company_name" label="企业名称" min-width="220" show-overflow-tooltip />
                              <el-table-column prop="inspection_unit" label="检查单位" min-width="180"
                                show-overflow-tooltip />
                              <el-table-column prop="defects_and_problems" label="检查问题" min-width="260"
                                show-overflow-tooltip />
                              <el-table-column prop="handling_measures" label="处理措施" min-width="220"
                                show-overflow-tooltip />
                            </el-table>

                            <el-table v-else :data="attachment.filtered_rows" size="small" stripe
                              :max-height="attachmentTableMaxHeight" class="table-height"
                              :row-key="(row) => stagingSamplingTableRowKey(attachment, row)">
                              <el-table-column type="expand" width="40">
                                <template #default="{ row }">
                                  <template v-if="attachmentsListEditing">
                                    <el-descriptions :column="2" border size="small" class="detail-expanded">
                                      <el-descriptions-item label="注册人/备案人等名称">
                                        <el-input v-model="row.company_names" :autosize="{ minRows: 2, maxRows: 6 }"
                                          size="small" placeholder="注册人/备案人等名称" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="注册人/备案人等地址">
                                        <el-input v-model="row.company_addresses" type="textarea"
                                          :autosize="{ minRows: 2, maxRows: 6 }" size="small" placeholder="地址" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="被抽样单位名称">
                                        <el-input v-model="row.sample_unit_name" size="small" placeholder="被抽样单位名称" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="被抽样单位地址">
                                        <el-input v-model="row.sample_unit_address" type="textarea"
                                          :autosize="{ minRows: 2, maxRows: 4 }" size="small" placeholder="地址" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="生产日期">
                                        <el-input v-model="row.production_date" size="small" placeholder="生产日期" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="限期使用日期/保质期">
                                        <el-input v-model="row.expiry_date" size="small" placeholder="限期使用日期/保质期" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="所在地/进口地区">
                                        <el-input v-model="row.product_region" size="small" placeholder="所在地/进口地区" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="注册/备案编号">
                                        <el-input v-model="row.registration_no" size="small" placeholder="注册/备案编号" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="生产许可证号">
                                        <el-input v-model="row.production_license_no" size="small"
                                          placeholder="生产许可证号" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="检验结果">
                                        <el-input v-model="row.inspection_result" type="textarea"
                                          :autosize="{ minRows: 2, maxRows: 6 }" size="small" placeholder="检验结果" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="规定要求">
                                        <el-input v-model="row.requirement" type="textarea"
                                          :autosize="{ minRows: 2, maxRows: 6 }" size="small" placeholder="规定要求" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="备注" :span="2">
                                        <el-input v-model="row.remarks" type="textarea"
                                          :autosize="{ minRows: 2, maxRows: 6 }" size="small" placeholder="备注" />
                                      </el-descriptions-item>
                                      <el-descriptions-item label="涉嫌假冒">
                                        <el-switch :model-value="Boolean(Number(row.is_counterfeit))"
                                          @update:model-value="(v) => { row.is_counterfeit = v ? 1 : 0 }" />
                                      </el-descriptions-item>
                                    </el-descriptions>
                                  </template>
                                  <el-descriptions v-else :column="2" border size="small" class="detail-expanded">
                                    <el-descriptions-item label="注册人/备案人等名称">
                                      <span class="attachment-readonly-block">{{ row.company_names || '—' }}</span>
                                    </el-descriptions-item>
                                    <el-descriptions-item label="注册人/备案人等地址">
                                      <span class="attachment-readonly-block">{{ row.company_addresses || '—' }}</span>
                                    </el-descriptions-item>
                                    <el-descriptions-item label="被抽样单位名称">
                                      {{ row.sample_unit_name || '—' }}
                                    </el-descriptions-item>
                                    <el-descriptions-item label="被抽样单位地址">
                                      <span class="attachment-readonly-block">{{ row.sample_unit_address || '—'
                                      }}</span>
                                    </el-descriptions-item>
                                    <el-descriptions-item label="生产日期">
                                      {{ row.production_date || '—' }}
                                    </el-descriptions-item>
                                    <el-descriptions-item label="限期使用日期/保质期">
                                      {{ row.expiry_date || '—' }}
                                    </el-descriptions-item>
                                    <el-descriptions-item label="所在地/进口地区">
                                      {{ row.product_region || '—' }}
                                    </el-descriptions-item>
                                    <el-descriptions-item label="注册/备案编号">
                                      {{ row.registration_no || '—' }}
                                    </el-descriptions-item>
                                    <el-descriptions-item label="生产许可证号">
                                      {{ row.production_license_no || '—' }}
                                    </el-descriptions-item>
                                    <el-descriptions-item label="检验结果">
                                      <span class="attachment-readonly-block">{{ row.inspection_result || '—' }}</span>
                                    </el-descriptions-item>
                                    <el-descriptions-item label="规定要求">
                                      <span class="attachment-readonly-block">{{ row.requirement || '—' }}</span>
                                    </el-descriptions-item>
                                    <el-descriptions-item label="备注" :span="2">
                                      <span class="attachment-readonly-block">{{ row.remarks || '—' }}</span>
                                    </el-descriptions-item>
                                    <el-descriptions-item label="涉嫌假冒">
                                      {{ Number(row.is_counterfeit) ? '是' : '否' }}
                                    </el-descriptions-item>
                                  </el-descriptions>
                                </template>
                              </el-table-column>
                              <el-table-column label="产品名称" show-overflow-tooltip>
                                <template #default="{ row }">
                                  <el-input v-if="attachmentsListEditing" v-model="row.product_name" size="small" />
                                  <span v-else>{{ row.product_name || '—' }}</span>
                                </template>
                              </el-table-column>

                              <el-table-column prop="sample_unit_name" label="被抽样单位" show-overflow-tooltip>
                                <template #default="{ row }">
                                  <el-input v-if="attachmentsListEditing" v-model="row.sample_unit_name" size="small" />
                                  <span v-else>{{ row.sample_unit_name || '—' }}</span>
                                </template>
                              </el-table-column>
                              <el-table-column prop="unqualified_items" label="不符合规定项目" show-overflow-tooltip>
                                <template #default="{ row }">
                                  <el-input v-if="attachmentsListEditing" v-model="row.unqualified_items"
                                    size="small" />
                                  <span v-else>{{ row.unqualified_items || '—' }}</span>
                                </template>
                              </el-table-column>

                            </el-table>
                          </template>
                          <el-empty v-else :description="detailFilters.keyword ? '当前筛选条件下没有匹配结果' : '当前附件暂无可展示的解析明细'" />
                        </div>
                      </div>
                      </div>
                      <el-empty v-else description="当前批次暂无附件解析产品列表" /> -->
                    </el-tab-pane>


                  </el-tabs>
                </template>

                <el-empty v-else description="请先在列表中选择一条批次查看正文与解析明细" />

              </el-card>
            </div>
          </div>

        </el-tab-pane>

        <el-tab-pane label="导入失败" name="traceback">
          <AnnouncementTracebacksPanel ref="tracebacksPanelRef" />
        </el-tab-pane>
      </el-tabs>

    </el-card>

    <!-- <el-dialog v-model="productTypeEditDialogVisible" width="480px" destroy-on-close
      :title="currentBatch ? `修改产品类型：${currentBatch.title || '当前通告'}` : '修改产品类型'">
      <div class="panel-tip mb-16">保存后会更新当前临时批次产品类型；若该通告已导入正式库，也会同步更新正式库、企业关联和问题产品数据。</div>
      <el-select v-model="productTypeEditForm.product_type" placeholder="请选择产品类型" style="width: 100%">
        <el-option v-for="item in productTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <template #footer>
        <el-button @click="productTypeEditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingProductTypeId === currentBatchId"
          @click="handleSaveProductType()">保存产品类型</el-button>
      </template>
    </el-dialog> -->

    <!-- <el-dialog v-model="stagingItemDialogVisible" width="900px" destroy-on-close :close-on-click-modal="false"
      title="新增产品明细">
      <el-form ref="stagingItemFormRef" :model="stagingItemForm" :rules="stagingItemRules" label-width="125px">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="序号" prop="sequence_no">
              <el-input-number v-model="stagingItemForm.sequence_no" :min="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="产品名称" prop="product_name">
              <el-input v-model="stagingItemForm.product_name" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="生产企业" prop="company_names">
              <el-input v-model="stagingItemForm.company_names" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="生产企业地址">
              <el-input v-model="stagingItemForm.company_addresses" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="被抽样单位">
              <el-input v-model="stagingItemForm.sample_unit_name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="被抽样单位地址">
              <el-input v-model="stagingItemForm.sample_unit_address" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="生产日期">
              <el-input v-model="stagingItemForm.production_date" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="限期使用日期">
              <el-input v-model="stagingItemForm.expiry_date" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="注册/备案编号">
              <el-input v-model="stagingItemForm.registration_no" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="所在地/进口地区">
              <el-input v-model="stagingItemForm.product_region" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="生产许可证号">
              <el-input v-model="stagingItemForm.production_license_no" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="检验机构">
              <el-input v-model="stagingItemForm.inspection_institution" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="不符合规定项目" prop="unqualified_items">
          <el-input v-model="stagingItemForm.unqualified_items" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="检验结果">
          <el-input v-model="stagingItemForm.inspection_result" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="规定要求">
          <el-input v-model="stagingItemForm.requirement" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="stagingItemForm.remarks" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="产品图片">
          <el-input v-model="stagingItemForm.picture_url" placeholder="本地图：`/upload/products/文件名`，或外链 https://..." />
        </el-form-item>
        <el-form-item label="涉嫌假冒">
          <el-switch v-model="stagingItemForm.is_counterfeit" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeStagingItemDialog">取消</el-button>
        <el-button type="primary" :loading="savingStagingItem" @click="handleSaveStagingItem">保存</el-button>
      </template>
    </el-dialog> -->

    <el-dialog v-model="uploadPreviewDialogVisible" width="720px" :title="`待上传文件（${uploadFileRows.length}）`"
      :close-on-click-modal="false">
      <!-- <p class="panel-tip mb-16">确认后上传到服务器写入临时批次，并记录当前用户与时间。</p> -->
      <el-table :data="uploadFileRows" size="small" max-height="360">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="name" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="relativePath" label="路径" min-width="240" show-overflow-tooltip />
        <el-table-column prop="sizeLabel" label="大小" width="96" align="right" />
      </el-table>
      <template #footer>
        <el-button @click="clearUploadSelection">清空</el-button>
        <el-button type="primary" :loading="importing" @click="handleUploadSelectedJson">上传到临时库</el-button>
      </template>
    </el-dialog>

    
<el-dialog
      v-model="productImageUploadDialogVisible"
      width="760px"
      title="导入图片"
      draggable
      :close-on-click-modal="false"
    >
      <el-alert type="success" :closable="false" show-icon class="mb-16">
        <template #title>
          当前已选中{{ productImageFileRows.length }}个图片
        </template>
      </el-alert>
      <el-descriptions :column="1" border size="small" class="mb-16 staging-product-folder-desc">
        <el-descriptions-item label="通告年号（公告编号）">
          {{ productImageAnnouncementNoPreview || '（未填写，请先在基础信息填写公告编号）' }}
        </el-descriptions-item>
        <el-descriptions-item label="目录名">{{ productImageAnnouncementSlug }}</el-descriptions-item>
        <el-descriptions-item label="通告标题（对照）">{{ productImageAnnouncementTitlePreview || '—' }}</el-descriptions-item>
      </el-descriptions>
      <el-form label-width="96px" class="mb-16">
        <el-form-item label="起始序号">
          <el-input-number v-model="productImageStartSequence" :min="1" :step="1" />
        </el-form-item>
      </el-form>
      <el-table :data="productImageFileRows" size="small" max-height="360">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="name" label="原文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="targetName" label="保存为" width="120" />
        <el-table-column prop="targetPath" label="存储路径" min-width="260" show-overflow-tooltip />
        <el-table-column prop="sizeLabel" label="大小" width="96" align="right" />
      </el-table>
      <template #footer>
        <el-button @click="clearProductImageSelection">清空</el-button>
        <el-button type="primary" :loading="uploadingProductImages" @click="handleUploadProductImages">
          上传图片
        </el-button>
      </template>
    </el-dialog>
    <el-dialog
      v-model="foodBodyTextDialogVisible"
      width="960px"
      draggable
      :close-on-click-modal="false"
      destroy-on-close
      class="food-body-text-dialog"
      @closed="resetFoodBodyTextPicker"
    >
      <template #header="{ titleId, titleClass }">
        <div class="food-body-dialog-header">
          <span :id="titleId" :class="titleClass">选取文案</span>
          <el-button
            type="primary"
            :loading="foodBodyImportSaving"
            @click="confirmFoodBodyTextImport"
          >
            导入
          </el-button>
        </div>
      </template>
      <p class="panel-tip food-body-picker-tip">
        选择正文内容作为产品文案。
      </p>
      <div class="food-body-dialog-columns">
        <div class="food-body-dialog-col">
          <div class="food-body-dialog-col-heading food-body-heading-row">
            <span>正文内容</span>
            <FoodBodyTextSearchToolbar
              v-model="foodBodySearchQuery"
              :match-total="foodBodyMatchTotal"
              :active-index="foodBodySearchActiveIndex"
              :has-source-text="Boolean(foodBodyDialogFullText)"
              @prev="foodBodySearchGoPrev"
              @next="foodBodySearchGoNext"
              @enter-next="foodBodySearchGoNext"
            />
          </div>
          <div
            class="food-body-select-surface"
            @mouseup="captureFoodBodySelection"
          >
            <pre
              v-if="!foodBodyDialogFullText"
              class="food-body-pre muted-text"
            >（当前批次正文为空，请先在「通告正文」页签编辑并暂存正文）</pre>
            <pre
              v-else
              ref="foodBodyPreRef"
              class="food-body-pre"
              v-html="foodBodyHighlightedDisplayHtml"
            />
          </div>
        </div>
        <div class="food-body-dialog-col">
          <div class="food-body-dialog-col-heading">选中预览</div>
          <div class="food-body-preview-panel">
            <el-input
              v-model="foodBodySelectionPreview"
              type="textarea"
              :autosize="{ minRows: 12, maxRows: 28 }"
              resize="vertical"
              class="food-body-preview-editor"
              placeholder="在左侧正文中拖选文字后，将自动填入此处；可直接增删修改后再通过标题栏「导入」保存。"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="foodBodyTextDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="bulkPublishDialogVisible" title="一键入库进度" width="640px" class="bulk-publish-dialog"
      destroy-on-close :close-on-click-modal="false" :close-on-press-escape="bulkPublishPhase !== 'running'"
      :show-close="bulkPublishPhase !== 'running'">
      <div v-if="bulkPublishPhase === 'running' && bulkPublishTotal" class="bulk-publish-head">
        <p class="bulk-publish-line">
          正在入库第 <strong>{{ bulkPublishCurrentIndex }}</strong> / {{ bulkPublishTotal }} 个批次
          <span v-if="currentBulkTitle" class="muted-text"> · {{ currentBulkTitle }}</span>
        </p>
        <el-progress :percentage="bulkPublishPercent" :stroke-width="10" />
      </div>
      <el-alert v-if="bulkPublishPhase === 'done'" :type="bulkPublishSummary.fail ? 'warning' : 'success'" show-icon
        :closable="false" class="mb-16"
        :title="`已完成：成功 ${bulkPublishSummary.success} 个 · 失败 ${bulkPublishSummary.fail} 个`" />
      <el-alert v-if="bulkPublishPhase === 'error'" type="error" show-icon :closable="false" class="mb-16"
        title="批量入库未正常完成，请查看下方列表或控制台后重试。" />
      <p v-if="bulkPublishPhase === 'running'" class="panel-tip bulk-publish-tip">
        服务端将逐条批次写入正式库并清理临时数据，请稍候，勿关闭本窗口。
      </p>
      <el-table :data="bulkPublishLogs" size="small" max-height="320" stripe class="bulk-publish-table">
        <el-table-column type="index" label="#" width="48" align="center" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="bulkPublishLogTagType(row.phase)">{{ bulkPublishLogLabel(row.phase) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="批次标题" min-width="160" show-overflow-tooltip />
        <el-table-column prop="message" label="说明" min-width="200" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button v-if="bulkPublishPhase !== 'running'" type="primary" @click="bulkPublishDialogVisible = false">
          关闭
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>




<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue'

import { useRoute, useRouter } from 'vue-router'
import { Refresh, Upload } from '@element-plus/icons-vue'
import {
  getAnnouncementStagingOverview,
  getAnnouncementStagingTree,
  getAnnouncementStagingFilterYears,
  getAnnouncementStagingDetail,
  createAnnouncementStagingItem,
  updateAnnouncementStagingItem,
  deleteAnnouncementStagingItem,
  deleteAnnouncementStagingBatch,
  getAnnouncementStagingWorkspaceCache,
  saveAnnouncementStagingWorkspaceCache,
  uploadAnnouncementStagingJson,
  confirmAnnouncementStaging,
  updateAnnouncementStagingBody,
  updateAnnouncementStagingInfo,
  updateAnnouncementStagingProductType,
  syncAnnouncementStagingItems
  // retreatAnnouncementStagingToTraceback,

} from '@/api/index'

import AnnouncementTracebacksPanel from '@/components/AnnouncementTracebacksPanel.vue'
import FoodBodyTextSearchToolbar from '@/components/FoodBodyTextSearchToolbar.vue'
import { useFoodBodyTextSearch } from '@/composables/useFoodBodyTextSearch.js'
import { resolveProductPictureSrc, buildProductPictureUploadPreviewRows } from '@/utils/productPicture.js'
import {
  getFirstAnnouncementStagingUploadedPictureStoredPath,
  postAnnouncementStagingProductImages
} from '@/utils/announcementStagingProductPictureUpload.js'


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

function getStagingProductTypeLabel(value) {
  const opt = productTypeOptions.find((o) => o.value === value)
  return opt?.label || (value ? String(value) : '—')
}

function getStagingAnnouncementTypeLabel(value) {
  const opt = announcementTypeOptions.find((o) => o.value === value)
  return opt?.label || (value ? String(value) : '—')
}

const route = useRoute()
const router = useRouter()
const tracebacksPanelRef = ref(null)
const mainTab = ref('batches')
const loading = ref(false)
const overviewLoading = ref(false)
const importing = ref(false)
const bulkConfirming = ref(false)
/** 一键入库进度弹窗：`idle` | `running` | `done` | `error` */
const bulkPublishPhase = ref('idle')
const bulkPublishDialogVisible = ref(false)
const bulkPublishLogs = ref([])
const bulkPublishTotal = ref(0)
const bulkPublishCurrentIndex = ref(0)
const bulkPublishSummary = ref({ success: 0, fail: 0 })

const bulkPublishPercent = computed(() => {
  if (!bulkPublishTotal.value || !bulkPublishLogs.value.length) {
    return 0
  }
  const done = bulkPublishLogs.value.filter((row) => row.phase === 'success' || row.phase === 'failed').length
  return Math.min(100, Math.round((done / bulkPublishTotal.value) * 100))
})

const currentBulkTitle = computed(() => {
  if (bulkPublishPhase.value !== 'running' || bulkPublishCurrentIndex.value < 1) {
    return ''
  }
  const row = bulkPublishLogs.value[bulkPublishCurrentIndex.value - 1]
  return row?.title || ''
})

function bulkPublishLogTagType(phase) {
  switch (phase) {
    case 'running':
      return 'primary'
    case 'success':
      return 'success'
    case 'failed':
      return 'danger'
    case 'pending':
    default:
      return 'info'
  }
}

function bulkPublishLogLabel(phase) {
  switch (phase) {
    case 'pending':
      return '待处理'
    case 'running':
      return '进行中'
    case 'success':
      return '成功'
    case 'failed':
      return '失败'
    default:
      return '—'
  }
}

const detailLoadingId = ref(null)
const confirmingId = ref(null)
const stagingDraftSaving = ref(false)
const stagingBatchDeleting = ref(false)

const batchReviewTableMaxHeight = ref(480)
const attachmentTableMaxHeight = ref(520)

function syncBatchReviewViewportHeights() {
  if (typeof window === 'undefined') {
    return
  }
  const h = window.innerHeight
  batchReviewTableMaxHeight.value = Math.max(220, Math.min(680, Math.round(h * 0.42)))
  attachmentTableMaxHeight.value = Math.max(280, Math.min(680, Math.round(h * 0.52)))
}

// const retreatingTracebackId = ref(null)
const switchingBatchId = ref(null)
const treeRows = ref([])
const detailMap = ref({})

// const folderInputRef = ref(null)
const fileInputRef = ref(null)
const productImageInputRef = ref(null)
const stagingRowPictureInputRef = ref(null)
const selectedUploadFiles = ref([])
const uploadPreviewDialogVisible = ref(false)
const selectedProductImageFiles = ref([])
const productImageUploadDialogVisible = ref(false)
const productImageStartSequence = ref(1)
const uploadingProductImages = ref(false)

const foodBodyTextDialogVisible = ref(false)
const foodBodyDialogFullText = ref('')
const foodBodySelectionPreview = ref('')
const foodBodyTextTargetRow = ref(null)
const foodBodyImportSaving = ref(false)

const {
  searchQuery: foodBodySearchQuery,
  activeIndex: foodBodySearchActiveIndex,
  preRef: foodBodyPreRef,
  matchTotal: foodBodyMatchTotal,
  highlightedDisplayHtml: foodBodyHighlightedDisplayHtml,
  goNext: foodBodySearchGoNext,
  goPrev: foodBodySearchGoPrev,
  reset: resetFoodBodySearchState
} = useFoodBodyTextSearch(foodBodyDialogFullText)

/** 按行上传产品图：选中的明细行引用 */
const stagingRowPictureTargetRow = ref(null)
const stagingRowPictureUploadingKey = ref('')
const lastImportResult = ref(null)
const selectedBatchId = ref(null)
const selectedTreeKey = ref('')
const activeDetailTab = ref('body')
/** 抽检合并表中正在内联编辑的产品行 row-key；仅展开行可与「保存」对齐 */
const attachmentsTableEditingRowKey = ref(null)
const stagingSamplingAttachmentExpandedRows = ref([])
/** 合并抽检明细表：手风琴式展开，`expand-row-keys` 至多一项 */
const stagingMergedAccordionExpandKeys = ref([])
const savingStagingAttachmentsInline = ref(false)
/** 通告正文页签：默认只读，点击「编辑」后显示表单与正文编辑器 */
const bodyTabEditing = ref(false)
const selectedAttachmentIndex = ref(null)
const workspaceCacheReady = ref(false)
const bodyEditForm = reactive({
  content: ''
})
const infoEditFormRef = ref(null)
const infoEditForm = reactive({
  title: '',
  announcement_no: '',
  publish_date: '',
  inspection_unit: '',
  primary_attachment_name: '',
  primary_attachment_path: '',
  source_detail_url: '',
  source_page: '',
  product_type: 'cosmetics',
  announcement_type: 'sampling'
})
const infoEditRules = {
  title: [{ required: true, message: '请输入通告标题', trigger: 'blur' }]
}
const productTypeEditDialogVisible = ref(false)
// const savingProductTypeId = ref(null)
// const productTypeEditForm = reactive({
//   product_type: 'unknown'
// })
// const stagingItemDialogVisible = ref(false)
const stagingItemFormRef = ref(null)
const savingStagingItem = ref(false)
const stagingItemLocator = ref(null)
const stagingItemForm = reactive(createEmptyStagingItemForm())
// const stagingItemRules = {
//   sequence_no: [{ required: true, message: '请输入序号', trigger: 'change' }],
//   product_name: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
//   company_names: [{ required: true, message: '请输入注册人/备案人名称', trigger: 'blur' }],
//   unqualified_items: [{ required: true, message: '请输入不符合规定项目', trigger: 'blur' }]
// }

let workspaceSaveTimer = null

const preloadingBatchIds = new Set()


/** 左侧批次列表状态：`announcement_staging_batches.status` ENUM（与后端一致） */
const STAGING_BATCH_STATUS_OPTIONS = [
  { value: 'pending', label: '待确认' },
  { value: 'confirmed', label: '已入库' }
]

const filters = reactive({
  status: '',
  product_type: '',
  announcement_type: '',
  keyword: '',
  year: ''
})

const stagingFilterYears = ref([])

const yearOptions = computed(() => [
  { value: '', label: '全部' },
  ...stagingFilterYears.value.map((y) => ({
    value: String(y),
    label: `${y}年`
  }))
])

const statusOptions = STAGING_BATCH_STATUS_OPTIONS

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

/** 与 data_get/get_eatting announcement_picture_folder_slug / safe_filename 对齐（用于通告年号 announcement_no） */
function normalizeStagingWhitespace(s) {
  return String(s ?? '').replace(/\u0007/g, ' ').replace(/[ \t]+/g, ' ').trim()
}

function sanitizeAnnouncementNoPictureFolderStaging(announcementNoRaw) {
  const raw = normalizeStagingWhitespace(announcementNoRaw)
  if (!raw) return 'misc'
  let text = raw.replace(/[/\\:*?"<>|]+/g, '_')
  text = text.replace(/_+/g, '_').replace(/^[.\s_]+|[.\s_]+$/g, '')
  if (!text) return 'misc'
  const limited = text.slice(0, 120)
  const slug = limited || 'announcement'
  if (slug === 'announcement') return 'misc'
  return slug
}

function resolveAnnouncementNoForProductImages() {
  const formNo = normalizeStagingWhitespace(infoEditForm.announcement_no || '')
  if (formNo) return formNo
  const bid = Number(selectedBatchId.value || 0)
  if (!bid) return ''
  const row = treeRows.value.find((item) => Number(item.id) === bid)
  return normalizeStagingWhitespace(row?.announcement_no || '')
}

function resolveAnnouncementTitleForProductImages() {
  const formTitle = normalizeStagingWhitespace(infoEditForm.title || '')
  if (formTitle) return formTitle
  const bid = Number(selectedBatchId.value || 0)
  if (!bid) return ''
  const row = treeRows.value.find((item) => Number(item.id) === bid)
  return normalizeStagingWhitespace(row?.title || '')
}

const productImageAnnouncementNoPreview = computed(() => resolveAnnouncementNoForProductImages())

const productImageAnnouncementTitlePreview = computed(() => resolveAnnouncementTitleForProductImages())

const productImageAnnouncementSlug = computed(() =>
  sanitizeAnnouncementNoPictureFolderStaging(productImageAnnouncementNoPreview.value)
)

function createEmptyStagingItemForm() {
  return {
    sequence_no: 1,
    product_name: '',
    company_names: '',
    company_addresses: '',
    manufacturer_name: '',
    manufacturer_address: '',
    operator_name: '',
    operator_address: '',
    sample_unit_name: '',
    sample_unit_address: '',
    package_spec: '',
    batch_no: '',
    production_date: '',
    expiry_date: '',
    product_region: '',
    registration_no: '',
    production_license_no: '',
    inspection_institution: '',
    unqualified_items: '',
    inspection_result: '',
    requirement: '',
    remarks: '',
    picture_url: '',
    food_body_text: '',
    is_counterfeit: false
  }
}

function applyStagingItemToForm(row = {}) {
  Object.assign(stagingItemForm, createEmptyStagingItemForm(), {
    ...row,
    sequence_no: Number(row.sequence_no || 1),
    is_counterfeit: Boolean(row.is_counterfeit)
  })
}

// function buildStagingItemPayloadFromRow(row = {}) {

//   return {
//     sequence_no: Number(row.sequence_no || 1),
//     product_name: row.product_name || '',
//     company_names: row.company_names || '',
//     company_addresses: row.company_addresses || '',
//     manufacturer_name: row.manufacturer_name || '',
//     manufacturer_address: row.manufacturer_address || '',
//     operator_name: row.operator_name || '',
//     operator_address: row.operator_address || '',
//     sample_unit_name: row.sample_unit_name || '',
//     sample_unit_address: row.sample_unit_address || '',
//     package_spec: row.package_spec || '',
//     batch_no: row.batch_no || '',
//     production_date: row.production_date || '',
//     expiry_date: row.expiry_date || '',
//     product_region: row.product_region || '',
//     registration_no: row.registration_no || '',
//     production_license_no: row.production_license_no || '',
//     inspection_institution: row.inspection_institution || '',
//     unqualified_items: row.unqualified_items || '',
//     inspection_result: row.inspection_result || '',
//     requirement: row.requirement || '',
//     remarks: row.remarks || '',
//     is_counterfeit: Number(row.is_counterfeit) ? 1 : 0
//   }
// }

// function getStagingRowSaveKey(row = {}) {
//   return `${row.__attachment_index ?? ''}:${row.__row_index ?? ''}:${row.sequence_no ?? ''}`
// }

// const savingStagingRowKey = ref('')


function buildStagingItemPayload() {
  return {
    sequence_no: stagingItemForm.sequence_no,
    product_name: stagingItemForm.product_name,
    company_names: stagingItemForm.company_names,
    company_addresses: stagingItemForm.company_addresses,
    manufacturer_name: stagingItemForm.manufacturer_name,
    manufacturer_address: stagingItemForm.manufacturer_address,
    operator_name: stagingItemForm.operator_name,
    operator_address: stagingItemForm.operator_address,
    sample_unit_name: stagingItemForm.sample_unit_name,
    sample_unit_address: stagingItemForm.sample_unit_address,
    package_spec: stagingItemForm.package_spec,
    batch_no: stagingItemForm.batch_no,
    production_date: stagingItemForm.production_date,
    expiry_date: stagingItemForm.expiry_date,
    product_region: stagingItemForm.product_region,
    registration_no: stagingItemForm.registration_no,
    production_license_no: stagingItemForm.production_license_no,
    inspection_institution: stagingItemForm.inspection_institution,
    unqualified_items: stagingItemForm.unqualified_items,
    inspection_result: stagingItemForm.inspection_result,
    requirement: stagingItemForm.requirement,
    remarks: stagingItemForm.remarks,
    picture_url: stagingItemForm.picture_url,
    food_body_text: stagingItemForm.food_body_text ?? '',
    is_counterfeit: stagingItemForm.is_counterfeit ? 1 : 0
  }
}

const uploadFileRows = computed(() => {
  const list = Array.isArray(selectedUploadFiles.value) ? selectedUploadFiles.value : []
  return list.map((item) => ({
    name: item.name || item.relativePath || '未命名',
    relativePath: item.relativePath || item.webkitRelativePath || item.name || '',
    sizeLabel: formatFileSize(item.size)
  }))
})

const productImageFileRows = computed(() => {
  const start = Math.max(Number(productImageStartSequence.value || 1), 1)
  const slug = productImageAnnouncementSlug.value
  const list = Array.isArray(selectedProductImageFiles.value) ? selectedProductImageFiles.value : []
  return buildProductPictureUploadPreviewRows(list, { startSequence: start, folderSlug: slug })
})


function selectUploadFiles() {
  fileInputRef.value?.click()
}

function selectProductImages() {
  if (!normalizeStagingWhitespace(resolveAnnouncementNoForProductImages())) {
    ElMessage.warning('请先填写当前批次通告年号/公告编号（基础信息），图片目录按年号命名')
    return
  }
  productImageInputRef.value?.click()
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
    return
  }
  uploadPreviewDialogVisible.value = true
}

function clearUploadSelection() {
  selectedUploadFiles.value = []
  uploadPreviewDialogVisible.value = false
}

function handleProductImageInputChange(event) {
  const input = event.target
  const files = input?.files
  if (!files?.length) {
    if (input) input.value = ''
    return
  }

  if (!normalizeStagingWhitespace(resolveAnnouncementNoForProductImages())) {
    ElMessage.warning('请先填写当前批次通告年号/公告编号（基础信息），图片目录按年号命名')
    if (input) input.value = ''
    return
  }

  const next = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const nameLower = String(f.name || '').toLowerCase()
    if (!f.type?.startsWith('image/') && !/\.(png|jpe?g|webp)$/i.test(nameLower)) continue
    next.push({
      file: f,
      name: f.name,
      relativePath: f.webkitRelativePath || f.name,
      size: f.size
    })
  }

  next.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN', {
    numeric: true,
    sensitivity: 'base'
  }))

  selectedProductImageFiles.value = next
  if (input) input.value = ''
  if (!next.length) {
    ElMessage.warning('所选内容中未包含可导入的图片文件')
    return
  }
  productImageUploadDialogVisible.value = true
}

function clearProductImageSelection() {
  selectedProductImageFiles.value = []
  productImageUploadDialogVisible.value = false
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

function resolveMainTabFromRoute(cachePayload = {}) {
  const qView = safeQueryValue(route.query.view)
  if (qView === 'traceback') {
    mainTab.value = 'traceback'
    return
  }

  const qStagingTab = safeQueryValue(route.query.stagingTab)
  if (qStagingTab === 'batchReview') {
    mainTab.value = 'batchReview'
    return
  }

  const cachedMain = cachePayload.mainTab
  const legacyView = cachePayload.workbenchView
  const legacyInner = cachePayload.batchesInnerTab

  const migrated =
    cachedMain === 'traceback' ? 'traceback'
      : legacyView === 'traceback' ? 'traceback'
        : null

  if (migrated === 'traceback') {
    mainTab.value = 'traceback'
    mergeStagingQuery({ view: 'traceback' })
    return
  }

  if (cachedMain === 'batchReview' || legacyInner === 'batchReview') {
    mainTab.value = 'batchReview'
    mergeStagingQuery({
      view: 'staging',
      stagingTab: 'batchReview',
      tracebackId: '',
      id: ''
    })
    return
  }

  mainTab.value = 'batches'
}

function onMainTabChange(name) {
  if (name === 'traceback') {
    mergeStagingQuery({
      view: 'traceback',
      focusBatchId: '',
      stagingTab: ''
    })
    return
  }

  mergeStagingQuery({
    view: 'staging',
    tracebackId: '',
    id: '',
    stagingTab: name === 'batchReview' ? 'batchReview' : ''
  })
}


function batchRowClassName({ row }) {
  return Number(row.id) === Number(selectedBatchId.value || 0) ? 'is-active-batch' : ''
}

function handleBatchRowClick(row) {
  void selectBatch(row, { force: true })
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
      ElMessage.warning(
        `上传导入完成：新增 ${createdCount} 个，重复跳过 ${duplicateCount} 个（不产生倒溯记录），待人工核验 ${parseWarningCount} 个，异常 ${errorCount} 个`
      )
    } else {
      ElMessage.success(`上传导入完成：新增 ${createdCount} 个临时批次`)
    }

    selectedUploadFiles.value = []
    uploadPreviewDialogVisible.value = false
    const firstCreatedItem = (data.items || []).find((item) => item.id)
    await refreshAll({ preferredKey: firstCreatedItem?.id ? `body:${firstCreatedItem.id}` : selectedTreeKey.value, force: true })
  } catch (error) {
    console.error('上传导入临时区失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '上传导入失败')
  } finally {
    importing.value = false
  }
}

async function handleUploadProductImages() {
  if (uploadingProductImages.value) {
    return
  }

  const rows = selectedProductImageFiles.value
  if (!Array.isArray(rows) || !rows.length) {
    ElMessage.warning('请先选择图片文件')
    return
  }

  const start = Number(productImageStartSequence.value || 0)
  if (!Number.isInteger(start) || start <= 0) {
    ElMessage.warning('请输入有效的起始序号')
    return
  }

  if (!normalizeStagingWhitespace(resolveAnnouncementNoForProductImages())) {
    ElMessage.warning('请先填写当前批次通告年号/公告编号（基础信息），导入目录按年号命名')
    return
  }

  const end = start + rows.length - 1
  try {
    await ElMessageBox.confirm(

      `上传后将图片名改为 ${start}.png～${end}.png，同名文件会被覆盖。`,
      '确认导入',
      {
        type: 'success',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      }
    )
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    throw error
  }

  uploadingProductImages.value = true
  try {
    const publishedAid = Number(currentBatch.value?.published_announcement_id ?? 0)
    const res = await postAnnouncementStagingProductImages(rows, {
      startSequence: start,
      announcementNo: resolveAnnouncementNoForProductImages(),
      announcementId: Number.isInteger(publishedAid) && publishedAid > 0 ? publishedAid : null,
      stagingBatchId: currentBatchId.value || null
    })
    const data = res.data || {}
    ElMessage.success(res.message || data.message || `已导入 ${rows.length} 张图片`)
    selectedProductImageFiles.value = []
    productImageUploadDialogVisible.value = false
    await refreshAll({ preferredKey: selectedTreeKey.value, force: true })
  } catch (error) {
    console.error('导入产品图片失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '导入产品图片失败')
  } finally {
    uploadingProductImages.value = false
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

// function getImportActionMeta(record = {}) {
//   const action = typeof record === 'string' ? record : record?.action
//   const needsManualReview = Boolean(record?.needs_manual_review)

//   if (action === 'created' && needsManualReview) {
//     return { label: '已入临时区待核验', type: 'warning' }
//   }
//   if (action === 'created') {
//     return { label: '新增临时批次', type: 'success' }
//   }
//   if (action === 'skipped_duplicate') {
//     return { label: '重复跳过（未入倒溯）', type: 'info' }
//   }
//   if (action === 'skipped_parse_failed') {
//     return { label: '历史跳过记录', type: 'info' }
//   }
//   if (action === 'failed') {
//     return { label: '导入异常', type: 'info' }
//   }
//   return { label: action || '未知状态', type: 'info' }
// }

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

// function getBatchYearKey(row = {}) {
//   const sourceText = `${row.publish_date || ''} ${row.announcement_no || ''} ${row.title || ''}`.replace(/\s+/g, '')
//   const match = sourceText.match(/(20\d{2})年|^(20\d{2})-/)
//   const year = match?.[1] || match?.[2] || ''
//   return year || 'unknown'
// }

// function getYearLabel(yearKey = '') {
//   return yearKey && yearKey !== 'unknown' ? `${yearKey}年` : '未识别年份'
// }

// function getYearMeta(yearItem) {
//   if (yearItem.value === 'all') return '全部年号'
//   if (!yearItem.latest_date) return '暂无日期'
//   return `最新: ${yearItem.latest_date}`
// }

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

// function buildCompanyKey(company = {}) {

//   return `${company.company_name || ''}__${company.company_address || ''}`
// }

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
    const raw = toRaw(item)
    const text = [
      raw.product_name,
      raw.company_names,
      raw.sample_unit_name,
      raw.unqualified_items,
      raw.remarks,
      raw.title,
      raw.company_name,
      raw.defects_and_problems,
      raw.handling_measures,
      raw.inspection_unit
    ].filter(Boolean).join(' ').toLowerCase()

    return text.includes(normalizedKeyword)
  })
}

function stagingSamplingTableRowKey(attachment, row) {
  const r = row || {}
  const attIdx = r.__attachment_index ?? attachment?.__attachment_index ?? attachment?.index ?? 0
  return `${attIdx}-${r.__row_index ?? 'r'}-${r.sequence_no ?? 's'}`
}

/** 与 backend `STAGING_DETAIL_FIELDS` 对齐；保存本条时写入 announcement_staging_items（经 persistStagingDetailPayload.replaceStagingItems） */
const STAGING_SAMPLING_DETAIL_SAVE_KEYS = [
  'sequence_no',
  'product_name',
  'company_names',
  'company_addresses',
  'manufacturer_name',
  'manufacturer_address',
  'operator_name',
  'operator_address',
  'sample_unit_name',
  'sample_unit_address',
  'package_spec',
  'batch_no',
  'production_date',
  'expiry_date',
  'product_region',
  'attachment_sampling_category',
  'registration_no',
  'production_license_no',
  'inspection_institution',
  'unqualified_items',
  'inspection_result',
  'requirement',
  'remarks',
  'picture_url',
  'food_body_text',
  'is_counterfeit'
]

function buildStagingSamplingItemPayloadFromRow(row = {}) {
  const item = {}
  for (const key of STAGING_SAMPLING_DETAIL_SAVE_KEYS) {
    item[key] = row[key]
  }
  return item
}

function isStagingMergedSamplingRowEditing(row) {
  const key = attachmentsTableEditingRowKey.value
  if (!key || !row) return false
  const g = currentMergedJsonAttachmentGroup.value
  return stagingSamplingTableRowKey(g, row) === key
}

/** 抽检合并明细表：仅允许一行展开；受控 expand-row-keys 自动收起上一行 */
function onStagingSamplingMergedTableExpandChange(row, expandedRows) {
  const g = currentMergedJsonAttachmentGroup.value
  const list = Array.isArray(expandedRows) ? [...expandedRows] : []
  const clickedKey = row ? stagingSamplingTableRowKey(g, row) : null

  let nextKeys = []
  let openRow = null
  if (clickedKey && row && list.some((r) => stagingSamplingTableRowKey(g, r) === clickedKey)) {
    nextKeys = [clickedKey]
    openRow = g.filtered_rows.find((r) => stagingSamplingTableRowKey(g, r) === clickedKey) || row
    stagingSamplingAttachmentExpandedRows.value = openRow ? [openRow] : []
  } else {
    stagingSamplingAttachmentExpandedRows.value = []
  }

  stagingMergedAccordionExpandKeys.value = nextKeys

  const editKey = attachmentsTableEditingRowKey.value
  if (!editKey) return
  const still =
    stagingSamplingAttachmentExpandedRows.value.some((r) => stagingSamplingTableRowKey(g, r) === editKey)
  if (!still) {
    attachmentsTableEditingRowKey.value = null
  }
}

function buildWorkspacePayload() {
  return {
    filters: { ...filters },
    detailFilters: { ...detailFilters },
    selectedTreeKey: selectedTreeKey.value,
    selectedBatchId: selectedBatchId.value,
    activeDetailTab: activeDetailTab.value,
    selectedAttachmentIndex: selectedAttachmentIndex.value,
    lastImportResult: lastImportResult.value,
    mainTab: mainTab.value
  }
}

function applyWorkspacePayload(payload = {}) {
  const nextFilters = payload.filters || {}
  filters.status = nextFilters.status ?? ''
  filters.product_type = nextFilters.product_type ?? ''
  filters.announcement_type = nextFilters.announcement_type ?? ''
  filters.keyword = nextFilters.keyword ?? ''
  filters.year = String(nextFilters.year ?? '')

  const nextDetailFilters = payload.detailFilters || {}
  detailFilters.keyword = nextDetailFilters.keyword ?? ''
  detailFilters.companyKeyword = nextDetailFilters.companyKeyword ?? ''

  const cachedTreeKey = payload.selectedTreeKey || ''
  const legacyProductType = cachedTreeKey.startsWith('product:') ? cachedTreeKey.replace('product:', '') : ''

  selectedTreeKey.value = cachedTreeKey.startsWith('product:') ? '' : cachedTreeKey
  selectedBatchId.value = payload.selectedBatchId || null
  if (!filters.product_type && legacyProductType) {
    filters.product_type = legacyProductType
  }
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
/** 食品抽检附件明细不展示化妆品域：所在地、注册备案号、生产许可证号（查看与列表编辑展开区一致隐藏） */
const isFoodStagingBatch = computed(() => currentTypeInfo.value.product_type === 'food')
/** 附件产品表：非正文编辑、非列表编辑时允许按行本地上传（与批量导入共用目录规则） */
const canUploadStagingRowProductPicture = computed(
  () =>
  Boolean(currentBatchId.value)
    && !isFlightBatch.value
    && !attachmentsTableEditingRowKey.value
    && !bodyTabEditing.value
)
const currentBatchBodyText = computed(() => currentBatch.value?.content || currentBatchDetail.value?.batch?.content || '')

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

// const currentBatchSummary = computed(() => {
//   const batch = currentBatch.value || {}
//   const detailData = currentBatchDetail.value
//   const summary = detailData?.summary || {}
//   const parseValidation = detailData?.parse_validation || {}

//   return {
//     attachment_count: detailData
//       ? Number(summary.attachment_count ?? currentBatchAttachments.value.length ?? 0)
//       : Number(batch.attachment_count || 0),
//     company_count: detailData
//       ? Number(summary.company_count ?? detailData.company_preview?.length ?? 0)
//       : 0,
//     detail_count: detailData
//       ? Number(summary.detail_count ?? detailData.items?.length ?? 0)
//       : Number(batch.parsed_detail_count || 0),
//     counterfeit_count: detailData
//       ? Number(summary.counterfeit_count ?? detailData.items?.filter((item) => item.is_counterfeit).length ?? 0)
//       : Number(batch.counterfeit_count || 0),
//     success_attachment_count: detailData
//       ? Number(summary.success_attachment_count ?? parseValidation.success_attachment_count ?? 0)
//       : 0,
//     failed_attachment_count: detailData
//       ? Number(summary.failed_attachment_count ?? parseValidation.failed_attachment_count ?? 0)
//       : 0
//   }
// })


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

/**
 * 合并当前批次全部附件已由服务端展平的行（每条对应 JSON attachments[].parse_result.rows 的一条），
 * 不再按 excel/word 扩展名分流。
 */
const currentMergedJsonAttachmentGroup = computed(() => ({
  index: 'merged-json',
  __attachment_index: 'merged-json',
  attachment_name: '附件解析明细',
  filtered_rows: currentAttachmentGroups.value.flatMap((attachment) => attachment.filtered_rows || [])
}))

/** 当前是否存在可切换编辑模式的抽检附件表格（非飞行检查且有过滤后行） */
const hasAttachmentSamplingEditableTable = computed(() => {
  if (isFlightBatch.value) return false
  return currentMergedJsonAttachmentGroup.value.filtered_rows.length > 0
})

function isStagingRowPictureUploading(attachmentGroup, row) {
  if (!row) return false
  return stagingRowPictureUploadingKey.value === stagingSamplingTableRowKey(attachmentGroup, row)
}

function triggerStagingRowPictureUpload(row) {
  if (!canUploadStagingRowProductPicture.value || !currentBatch.value?.id || !row) {
    return
  }
  if (!normalizeStagingWhitespace(resolveAnnouncementNoForProductImages())) {
    ElMessage.warning('请先在通告正文区填写通告年号（公告编号），图片目录按年号命名')
    return
  }
  stagingRowPictureTargetRow.value = row
  stagingRowPictureInputRef.value?.click()
}

async function handleStagingRowPictureInputChange(event) {
  const input = event.target
  const file = input?.files?.[0]
  const row = stagingRowPictureTargetRow.value
  stagingRowPictureTargetRow.value = null
  if (input) input.value = ''

  const batchId = currentBatch.value?.id
  if (!file || !row || !batchId) {
    return
  }

  if (!normalizeStagingWhitespace(resolveAnnouncementNoForProductImages())) {
    ElMessage.warning('请先在通告正文区填写通告年号（公告编号）')
    return
  }

  const seq = Number(row.sequence_no ?? 0)
  if (!Number.isInteger(seq) || seq < 1) {
    ElMessage.warning('当前行序号无效，无法上传')
    return
  }

  const merged = currentMergedJsonAttachmentGroup.value
  const rowKey = stagingSamplingTableRowKey(merged, row)
  stagingRowPictureUploadingKey.value = rowKey

  try {
    const publishedAid = Number(currentBatch.value?.published_announcement_id ?? 0)
    const upRes = await postAnnouncementStagingProductImages(
      [{ file, name: file.name }],
      {
        startSequence: seq,
        announcementNo: resolveAnnouncementNoForProductImages(),
        announcementId: Number.isInteger(publishedAid) && publishedAid > 0 ? publishedAid : null,
        stagingBatchId: batchId
      }
    )
    const pictureUrlStored = getFirstAnnouncementStagingUploadedPictureStoredPath(upRes)
    if (!pictureUrlStored) {
      ElMessage.warning('上传成功但未返回图片路径')
      return
    }

    const patchRes = await updateAnnouncementStagingItem(batchId, {
      locator: buildStagingSamplingRowLocator(row),
      item: { picture_url: pictureUrlStored }
    })

    updateCurrentBatchDetail(patchRes.data)
    fillInlineStagingEditors()

    ElMessage.success('产品图已上传并写入本条明细')
  } catch (error) {
    console.error('单行产品图上传失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '上传失败')
  } finally {
    stagingRowPictureUploadingKey.value = ''
  }
}

function formatFoodBodySnippet(raw, maxLen = 56) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!s) return '—'
  return s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`
}

function buildStagingSamplingRowLocator(row = {}) {
  const locator = { sequence_no: row.sequence_no }
  const attIdx = Number(row.__attachment_index)
  if (Number.isInteger(attIdx) && attIdx >= 1) {
    locator.attachment_index = attIdx
  }
  const ri = Number(row.__row_index)
  if (Number.isInteger(ri) && ri >= 0) {
    locator.row_index = ri
  }
  return locator
}

function openFoodBodyTextPicker(row) {
  if (!currentBatch.value?.id || !row) {
    return
  }
  foodBodyTextTargetRow.value = row
  foodBodySelectionPreview.value = ''
  foodBodyDialogFullText.value = String(
    bodyEditForm.content || currentBatchBodyText.value || currentBatch.value?.content || ''
  ).replace(/\r\n/g, '\n')
  resetFoodBodySearchState()
  foodBodyTextDialogVisible.value = true
}

function captureFoodBodySelection() {
  if (typeof window === 'undefined') {
    return
  }
  const sel = window.getSelection?.()
  const text = sel && sel.rangeCount ? String(sel.toString() || '').trim() : ''
  foodBodySelectionPreview.value = text
}

function resetFoodBodyTextPicker() {
  foodBodyTextTargetRow.value = null
  foodBodySelectionPreview.value = ''
  foodBodyDialogFullText.value = ''
  resetFoodBodySearchState()
}

async function confirmFoodBodyTextImport() {
  let text = String(foodBodySelectionPreview.value || '').trim()
  if (!text && typeof window !== 'undefined') {
    text = String(window.getSelection?.()?.toString?.() || '').trim()
  }
  if (!text) {
    ElMessage.warning('请先在正文中拖选一段文字')
    return
  }

  const row = foodBodyTextTargetRow.value
  const batchId = currentBatch.value?.id
  if (!row || !batchId) {
    return
  }

  foodBodyImportSaving.value = true
  try {
    const patchRes = await updateAnnouncementStagingItem(batchId, {
      locator: buildStagingSamplingRowLocator(row),
      item: { food_body_text: text }
    })
    updateCurrentBatchDetail(patchRes.data)
    fillInlineStagingEditors()
    ElMessage.success('正文文案已保存到本条明细')
    foodBodyTextDialogVisible.value = false
  } catch (error) {
    console.error('保存正文文案失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '保存失败')
  } finally {
    foodBodyImportSaving.value = false
  }
}

function enterAttachmentsTableEdit() {
  const expanded = stagingSamplingAttachmentExpandedRows.value || []
  if (expanded.length !== 1) {
    ElMessage.warning('请先在表格左侧展开恰好一行产品，再点击「编辑」')
    return
  }
  const row = expanded[0]
  const group = currentMergedJsonAttachmentGroup.value
  attachmentsTableEditingRowKey.value = stagingSamplingTableRowKey(group, row)
}

async function saveAttachmentsTableEdit() {
  const editKey = attachmentsTableEditingRowKey.value
  const batchId = currentBatchId.value
  const group = currentMergedJsonAttachmentGroup.value
  if (!editKey || !batchId || !group?.filtered_rows?.length) {
    attachmentsTableEditingRowKey.value = null
    return
  }
  const row = group.filtered_rows.find((r) => stagingSamplingTableRowKey(group, r) === editKey)
  if (!row) {
    ElMessage.warning('未找到当前编辑行，请重新展开后再试')
    attachmentsTableEditingRowKey.value = null
    return
  }
  const productName = String(row.product_name || '').trim()
  if (!productName) {
    ElMessage.warning('产品名称不能为空')
    return
  }
  savingStagingAttachmentsInline.value = true
  try {
    const patchRes = await updateAnnouncementStagingItem(batchId, {
      locator: buildStagingSamplingRowLocator(row),
      item: buildStagingSamplingItemPayloadFromRow(row)
    })
    updateCurrentBatchDetail(patchRes.data)
    fillInlineStagingEditors()
    attachmentsTableEditingRowKey.value = null
    ElMessage.success('保存成功')
  } catch (error) {
    console.error('保存抽检明细编辑失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '保存失败')
  } finally {
    savingStagingAttachmentsInline.value = false
  }
}

function enterBodyTabEdit() {
  bodyTabEditing.value = true
}

function saveBodyTabEdit() {
  bodyTabEditing.value = false
}

const currentParseNotice = computed(() => {
  const validation = currentParseValidation.value || {}

  if (validation.blocking && validation.message) {
    return {
      type: 'warning',
      title: validation.message
    }
  }

  // if (Number(validation.failed_attachment_count || 0) > 0) {
  //   const names = Array.isArray(validation.failed_attachment_names) ? validation.failed_attachment_names.filter(Boolean).join('、') : ''
  //   return {
  //     type: 'info',
  //     title: names ? `当前仍有未解析成功附件：${names}` : `当前仍有 ${validation.failed_attachment_count} 个附件未解析成功`
  //   }
  // }

  return null
})

const detailBusy = computed(() => Boolean(currentBatchId.value && detailLoadingId.value === currentBatchId.value))


const batchListRows = computed(() => sortRowsByDisplayOrder([...treeRows.value]))

const currentBatchIndex = computed(() => {
  return batchListRows.value.findIndex((row) => Number(row.id) === Number(currentBatchId.value || 0))
})


const nextBatch = computed(() => {
  if (currentBatchIndex.value < 0) {
    return null
  }

  return batchListRows.value[currentBatchIndex.value + 1] || null
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
  const currentIndex = batchListRows.value.findIndex((item) => Number(item.id) === Number(batchId))
  if (currentIndex < 0) {
    return
  }

  const targetRow = batchListRows.value[currentIndex + 1]
  if (!targetRow || detailMap.value[targetRow.id] || preloadingBatchIds.has(targetRow.id) || detailLoadingId.value === targetRow.id) {
    return
  }

  await ensureBatchDetailLoaded(targetRow.id, false, {
    silent: true,
    skipPrefetch: true
  })
}


async function selectFirstVisibleBatch(options = {}) {
  if (!batchListRows.value.length) {
    selectedBatchId.value = null
    selectedTreeKey.value = ''
    return false
  }

  const preferredBatchId = Number(options.preferredBatchId || selectedBatchId.value || 0)
  const fallbackBatchId =
    preferredBatchId && batchListRows.value.some((item) => Number(item.id) === preferredBatchId)
      ? preferredBatchId
      : Number(batchListRows.value[0]?.id || 0)

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
    filters.product_type = String(rawBatchId || '').trim()
    await loadTreeData({ force: options.force })
    return selectFirstVisibleBatch({ force: options.force })
  }

  if (!targetBatch) {
    return false
  }

  if (!batchListRows.value.some((item) => Number(item.id) === batchId)) {
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

async function loadStagingFilterYears() {
  try {
    const res = await getAnnouncementStagingFilterYears({ ...filters })
    const list = res.data?.years ?? []
    stagingFilterYears.value = Array.isArray(list) ? list : []
  } catch (error) {
    console.error('加载年份筛选列表失败:', error)
  }
}

async function loadTreeData(options = {}) {
  loading.value = true
  try {
    const res = await getAnnouncementStagingTree({ ...filters })
    treeRows.value = res.data || []

    if (!treeRows.value.length) {
      selectedBatchId.value = null
      selectedTreeKey.value = ''
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
  if (mainTab.value === 'traceback') {
    await Promise.all([
      loadOverview(),
      tracebacksPanelRef.value?.refreshAll?.() ?? Promise.resolve()
    ])
    return
  }

  const preferredKey = options.preferredKey || selectedTreeKey.value
  await Promise.all([
    loadOverview(),
    loadStagingFilterYears(),
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

  mainTab.value = 'batchReview'
  if (!options.skipMerge) {
    mergeStagingQuery({
      view: 'staging',
      stagingTab: 'batchReview',
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

  // filters.status = STAGING_BATCH_LIST_STATUS
  filters.status = ''
  filters.product_type = ''
  filters.announcement_type = ''
  filters.keyword = ''
  filters.year = ''

  ElMessage.info('当前批次不在现有筛选结果中，已重置筛选条件后重新定位')
  await Promise.all([loadStagingFilterYears(), loadTreeData({ preferredKey, force: true })])
}

function goTracebackCenter(row = {}) {
  const tracebackId = row.traceback_id || row.id || ''
  const keyword = row.source_detail_url || row.title || row.source_json_name || ''

  mainTab.value = 'traceback'
  mergeStagingQuery({
    view: 'traceback',
    stagingTab: '',
    ...(tracebackId ? { tracebackId: String(tracebackId) } : {}),
    ...(keyword ? { keyword } : {})
  })
}

function fillInlineStagingEditors() {
  if (!currentBatch.value) {
    Object.assign(infoEditForm, {
      title: '',
      announcement_no: '',
      publish_date: '',
      inspection_unit: '',
      primary_attachment_name: '',
      primary_attachment_path: '',
      source_detail_url: '',
      source_page: '',
      product_type: 'cosmetics',
      announcement_type: 'sampling'
    })
    bodyEditForm.content = ''
    return
  }

  const typeInfo = getTypeInfo(currentBatch.value)
  Object.assign(infoEditForm, {
    title: currentBatch.value.title || '',
    announcement_no: currentBatch.value.announcement_no || '',
    publish_date: currentBatch.value.publish_date ? String(currentBatch.value.publish_date).slice(0, 10) : '',
    inspection_unit: currentBatch.value.inspection_unit || '',
    primary_attachment_name: currentBatch.value.primary_attachment_name || '',
    primary_attachment_path: currentBatch.value.primary_attachment_path || '',
    source_detail_url: currentBatch.value.source_detail_url || '',
    source_page: currentBatch.value.source_page || '',
    product_type: typeInfo.product_type || 'cosmetics',
    announcement_type: typeInfo.announcement_type || 'sampling'
  })
  bodyEditForm.content = currentBatchBodyText.value || ''
  nextTick(() => infoEditFormRef.value?.clearValidate?.())
}

async function handleStagingDraftSave() {
  if (!currentBatch.value?.id || stagingDraftSaving.value) {
    return
  }

  const valid = await infoEditFormRef.value?.validate?.().catch(() => false)
  if (!valid) {
    return
  }

  const nextContent = String(bodyEditForm.content || '').trim()
  if (!nextContent) {
    ElMessage.warning('通告正文不能为空')
    return
  }

  const batchId = currentBatch.value.id
  stagingDraftSaving.value = true
  try {
    const infoRes = await updateAnnouncementStagingInfo(batchId, { ...infoEditForm })
    const bodyRes = await updateAnnouncementStagingBody(batchId, {
      content: nextContent
    })
    const syncRes = await syncAnnouncementStagingItems(batchId)
    updateCurrentBatchDetail(syncRes.data)
    fillInlineStagingEditors()

    const syncedPub = infoRes.data?.updated_published_id || bodyRes.data?.updated_published_id
    ElMessage.success(
      syncedPub
        ? '保存成功'
        : '已暂存'
    )
  } catch (error) {
    console.error('暂存失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '暂存失败')
  } finally {
    stagingDraftSaving.value = false
  }
}



// async function handleSaveProductType() {
//   if (!currentBatch.value?.id || savingProductTypeId.value) {
//     return
//   }

//   try {
//     savingProductTypeId.value = currentBatch.value.id
//     const res = await updateAnnouncementStagingProductType(currentBatch.value.id, {
//       product_type: productTypeEditForm.product_type
//     })
//     const data = res.data || {}
//     productTypeEditDialogVisible.value = false
//     ElMessage.success(data.updated_published_id ? '产品类型已同步更新到正式库' : '产品类型已更新')
//     await refreshAll({ preferredKey: `body:${currentBatch.value.id}`, force: true })
//   } catch (error) {
//     console.error('保存产品类型失败:', error)
//     ElMessage.error('保存产品类型失败')
//   } finally {
//     savingProductTypeId.value = null
//   }
// }

function updateCurrentBatchDetail(nextDetail) {
  if (!currentBatch.value?.id || !nextDetail) {
    return
  }

  const batchId = currentBatch.value.id
  const normalizedDetail = {
    ...createEmptyDetail(),
    ...nextDetail
  }
  detailMap.value = {
    ...detailMap.value,
    [batchId]: normalizedDetail
  }

  const nextBatch = normalizedDetail.batch || {}
  const summary = normalizedDetail.summary || {}
  treeRows.value = treeRows.value.map((row) => (
    Number(row.id) === Number(batchId)
      ? {
        ...row,
        ...nextBatch,
        parsed_detail_count: Number(summary.detail_count ?? nextBatch.parsed_detail_count ?? row.parsed_detail_count ?? 0),
        inspection_count: Number(summary.detail_count ?? nextBatch.inspection_count ?? row.inspection_count ?? 0),
        counterfeit_count: Number(summary.counterfeit_count ?? nextBatch.counterfeit_count ?? row.counterfeit_count ?? 0),
        attachment_count: Number(summary.attachment_count ?? nextBatch.attachment_count ?? row.attachment_count ?? 0)
      }
      : row
  ))
}

function closeStagingItemDialog() {
  stagingItemDialogVisible.value = false
  stagingItemLocator.value = null
  applyStagingItemToForm()
  stagingItemFormRef.value?.clearValidate?.()
}

async function handleSaveStagingItem() {
  if (!currentBatch.value?.id || savingStagingItem.value) {
    return
  }

  const valid = await stagingItemFormRef.value?.validate?.().catch(() => false)
  if (!valid) {
    return
  }

  savingStagingItem.value = true
  try {
    const payload = buildStagingItemPayload()
    const locator = stagingItemLocator.value || {}
    const res = await createAnnouncementStagingItem(currentBatch.value.id, {
      attachment_index: locator.attachment_index || 1,
      item: payload
    })

    updateCurrentBatchDetail(res.data)
    ElMessage.success('产品明细已新增')
    closeStagingItemDialog()
  } catch (error) {
    console.error('保存临时产品明细失败:', error)
    ElMessage.error(error?.response?.data?.message || '保存产品明细失败')
  } finally {
    savingStagingItem.value = false
  }
}

async function handleDeleteStagingItem(row = {}) {
  if (!currentBatch.value?.id) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认删除“${row.product_name || '该产品明细'}”吗？保存后导入正式库时将不再包含该产品。`,
      '删除产品明细',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )

    const res = await deleteAnnouncementStagingItem(currentBatch.value.id, {
      locator: {
        attachment_index: row.__attachment_index || 1,
        row_index: row.__row_index,
        sequence_no: row.sequence_no
      }
    })
    updateCurrentBatchDetail(res.data)
    ElMessage.success('产品明细已删除')
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error('删除临时产品明细失败:', error)
    ElMessage.error(error?.response?.data?.message || '删除产品明细失败')
  }
}

async function handleDeleteCurrentBatch() {
  const row = currentBatch.value
  if (!row?.id || stagingBatchDeleting.value || stagingDraftSaving.value || bulkConfirming.value) {
    return
  }
  if (confirmingId.value && Number(confirmingId.value) === Number(row.id)) {
    return
  }

  const title = row.title || '该批次'
  const isConfirmed = row.status === 'confirmed'
  const hint = isConfirmed
    ? `批次「${title}」已导入正式库。删除后将按服务端规则同步移除对应正式库记录，且不易恢复，确定要删除吗？`
    : `确定删除临时批次「${title}」吗？临时区内的正文与产品明细将被全部移除（未写入正式库的数据将丢失）。`

  try {
    await ElMessageBox.confirm(hint, '删除临时通告', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    })
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    throw error
  }

  stagingBatchDeleting.value = true
  const currentIndex = batchListRows.value.findIndex((item) => Number(item.id) === Number(row.id))
  const fallbackBatch =
    currentIndex >= 0
      ? (batchListRows.value[currentIndex + 1] || batchListRows.value[currentIndex - 1] || null)
      : null

  try {
    const res = await deleteAnnouncementStagingBatch(row.id)
    const msg = res.data?.message || '已删除临时通告'
    ElMessage.success(msg)
    await refreshAll({ preferredKey: fallbackBatch?.id ? `body:${fallbackBatch.id}` : '', force: true })
  } catch (error) {
    console.error('删除临时通告失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '删除临时通告失败')
  } finally {
    stagingBatchDeleting.value = false
  }
}


// async function handleGoNextBatch() {
//   if (!nextBatch.value?.id || switchingBatchId.value) {
//     return
//   }

//   try {
//     switchingBatchId.value = nextBatch.value.id
//     await selectBatch(nextBatch.value, {
//       force: false,
//       tab: activeDetailTab.value === 'attachments' ? 'attachments' : 'body'
//     })
//   } finally {
//     switchingBatchId.value = null
//   }
// }


async function handleConfirmAll() {
  if (bulkConfirming.value || !overview.pending_batch_count) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认将当前 ${overview.pending_batch_count} 个待确认批次一键导入正式库吗？系统会按通告类型自动写入抽检库或飞检库，同步企业、不合格产品和备用快照，并清理临时区数据。`,
      '一键导入正式库',
      {
        type: 'warning',
        confirmButtonText: '确认导入',
        cancelButtonText: '取消'
      }
    )
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    throw error
  }

  bulkConfirming.value = true
  bulkPublishPhase.value = 'running'
  bulkPublishLogs.value = []
  bulkPublishTotal.value = 0
  bulkPublishCurrentIndex.value = 0
  bulkPublishSummary.value = { success: 0, fail: 0 }
  bulkPublishDialogVisible.value = true

  try {
    const treeRes = await getAnnouncementStagingTree({ status: 'pending' })
    const pendingList = Array.isArray(treeRes.data) ? treeRes.data : []

    if (!pendingList.length) {
      bulkPublishPhase.value = 'done'
      ElMessage.warning('当前没有待入库批次（可能已被处理或列表已刷新）')
      await refreshAll({ preferredKey: selectedTreeKey.value, force: true })
      return
    }

    bulkPublishTotal.value = pendingList.length
    bulkPublishLogs.value = pendingList.map((row) => ({
      id: row.id,
      title: row.title || '（无标题）',
      phase: 'pending',
      message: ''
    }))

    for (let i = 0; i < pendingList.length; i += 1) {
      bulkPublishCurrentIndex.value = i + 1
      const batchRow = pendingList[i]
      const logRow = bulkPublishLogs.value[i]
      logRow.phase = 'running'
      await nextTick()

      try {
        const res = await confirmAnnouncementStaging(batchRow.id)
        const data = res.data || {}
        const targetLib = data.published_target === 'supervisions' ? '飞检库' : '抽检库'
        const cleanupText = data.deleted_staging_batch_count ? '，已清理临时区' : ''
        logRow.phase = 'success'
        logRow.message = `已同步 ${data.detail_count || 0} 条明细到${targetLib}${cleanupText}`
        bulkPublishSummary.value.success += 1
      } catch (error) {
        logRow.phase = 'failed'
        logRow.message = error?.response?.data?.message || error?.message || '导入失败'
        bulkPublishSummary.value.fail += 1
      }
    }

    bulkPublishPhase.value = 'done'

    if (bulkPublishSummary.value.fail > 0) {
      ElMessage.warning(`批量入库结束：成功 ${bulkPublishSummary.value.success} 个，失败 ${bulkPublishSummary.value.fail} 个`)
    } else {
      ElMessage.success(`批量入库完成：共 ${bulkPublishSummary.value.success} 个批次`)
    }

    await refreshAll({ preferredKey: selectedTreeKey.value, force: true })
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error('一键导入正式库失败:', error)
    bulkPublishPhase.value = 'error'
    ElMessage.error(error?.response?.data?.message || error?.message || '一键入库失败')
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
      `确认将“${row.title || '该批次'}”导入${targetLabel}吗？导入成功后,将会删除待核验批次。`,
      '导入正式库',
      {
        type: 'warning',
        confirmButtonText: '确认导入',
        cancelButtonText: '取消'
      }
    )

    confirmingId.value = row.id
    const currentIndex = batchListRows.value.findIndex((item) => Number(item.id) === Number(row.id))
    // console.log(currentIndex)
    // console.log(batchListRows.value[currentIndex + 1])
    console.log(batchListRows.value[currentIndex - 1])
    const fallbackBatch = currentIndex >= 0
      ? (batchListRows.value[currentIndex + 1] || batchListRows.value[currentIndex - 1] || null)
      : null
    const res = await confirmAnnouncementStaging(row.id)
    const data = res.data || {}
    const cleanupText = data.deleted_staging_batch_count ? '，并已清理临时区数据' : ''
    ElMessage.success(`导入成功：已同步 ${data.detail_count || 0} 条内容明细到${data.published_target === 'supervisions' ? '飞检库' : '抽检库'}${cleanupText}`)

    await refreshAll({ preferredKey: fallbackBatch?.id ? `body:${fallbackBatch.id}` : '', force: true })
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

const applyFilters = async () => {
  await Promise.all([
    loadStagingFilterYears(),
    loadTreeData({ preferredKey: selectedTreeKey.value })
  ])
}

const resetFilters = async () => {
  // filters.status = STAGING_BATCH_LIST_STATUS
  filters.status = ''
  filters.product_type = ''
  filters.announcement_type = ''
  filters.keyword = ''
  filters.year = ''
  await Promise.all([
    loadStagingFilterYears(),
    loadTreeData({ preferredKey: selectedTreeKey.value })
  ])
}

watch(
  [activeDetailTab, currentBatchId],
  () => {
    attachmentsTableEditingRowKey.value = null
    stagingSamplingAttachmentExpandedRows.value = []
    stagingMergedAccordionExpandKeys.value = []
    bodyTabEditing.value = false
    if (!currentBatchId.value) {
      return
    }

    selectedTreeKey.value = `${activeDetailTab.value === 'attachments' ? 'attachments' : 'body'}:${currentBatchId.value}`
  },
  { immediate: true }
)

watch(
  [filters, detailFilters, selectedTreeKey, selectedBatchId, activeDetailTab, selectedAttachmentIndex, lastImportResult, mainTab],


  () => {
    scheduleWorkspaceSave()
  },
  { deep: true }
)

watch(
  () => [safeQueryValue(route.query.view), safeQueryValue(route.query.stagingTab)],
  ([view, stagingTab]) => {
    if (view === 'traceback') {
      if (mainTab.value !== 'traceback') {
        mainTab.value = 'traceback'
      }
      return
    }
    const next = stagingTab === 'batchReview' ? 'batchReview' : 'batches'
    if (mainTab.value !== next) {
      mainTab.value = next
    }
  }
)

watch(
  () => Number(safeQueryValue(route.query.focusBatchId) || 0),
  async (fid) => {
    if (!workspaceCacheReady.value) {
      return
    }
    if (!fid || Number(selectedBatchId.value) === fid) {
      return
    }

    await focusBatchById(fid, { skipMerge: true })
  },
  { flush: 'post' }
)

watch(
  selectedBatchId,
  async (batchId) => {
    if (!batchId) {
      fillInlineStagingEditors()
      return
    }
    await ensureBatchDetailLoaded(batchId, false)
    fillInlineStagingEditors()
  },
  { flush: 'post' }
)

onMounted(async () => {
  const cachePayload = await loadWorkspaceCache()
  applyWorkspacePayload(cachePayload)
  resolveMainTabFromRoute(cachePayload)
  await nextTick()
  syncBatchReviewViewportHeights()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', syncBatchReviewViewportHeights)
  }
  const preferredKey = selectedTreeKey.value || (selectedBatchId.value ? `body:${selectedBatchId.value}` : '')
  await refreshAll({ preferredKey })

  const focusBatchId = Number(route.query.focusBatchId || 0)
  if (focusBatchId) {
    await focusBatchById(focusBatchId)
  }

  workspaceCacheReady.value = true
})



onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncBatchReviewViewportHeights)
  }
  if (workspaceSaveTimer) {
    clearTimeout(workspaceSaveTimer)
    workspaceSaveTimer = null
  }
})

</script>

<style scoped>
/* .el-table .cell {
  padding: 0 10px !important;
  --el-table-text-color:black!important;
} */
.food-body-text-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}

.food-body-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding-right: 32px;
  box-sizing: border-box;
}

.food-body-dialog-columns {
  display: flex;
  gap: 16px;
  align-items: stretch;
  margin-top: 4px;
}

.food-body-dialog-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.food-body-dialog-col-heading {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  flex-shrink: 0;
}

.food-body-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

:deep(mark.food-body-search-hit) {
  background: rgba(253, 230, 138, 0.85);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}

:deep(mark.food-body-search-hit--active) {
  background: rgba(251, 191, 36, 0.95);
  outline: 2px solid rgba(245, 158, 11, 0.75);
}
.announcement-staging {
  max-width: 1760px;
  margin: 0 auto;
}

.el-card__body {
  padding: 10px !important;
}

.page-card,
.tree-panel,
.traceback-panel,
.detail-overview-card,
.recent-card {
  border-radius: 18px;
  /* width: 75vw; */
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

.attachment-table-edit-actions {
  margin-left: auto;
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
  grid-template-columns: minmax(0, 3fr) minmax(0, 7fr);
  gap: 12px;
  align-items: stretch;
}

.workspace-layout-simple {
  min-height: 0;
}

.staging-main-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}

.staging-stats-row {
  margin-bottom: 16px;
}

.stats-grid-simple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.progress-strip {
  margin-top: 4px;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid #e9eef8;
  background: #fafcff;
}

.progress-strip-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.progress-strip-title {
  font-weight: 700;
  color: #303133;
  font-size: 14px;
}

.progress-strip-pct {
  font-size: 18px;
  font-weight: 700;
}

.progress-strip-meta {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #909399;
}

.filter-form-batch {
  /* margin-bottom: 12px; */
  padding: 10px 12px;
  background: #f7f9fc;
  border-radius: 12px;
}

.batch-list-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.batch-list-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.batch-list-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0px !important;
}

.batch-list-card :deep(.el-card__header) {
  padding: 8px 10px;
  /* width: 20vw; */
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.batch-list-title {
  font-weight: 700;
  font-size: 14px;
}

.batch-list-hint {
  font-size: 12px;
  color: #909399;
}

.batch-table :deep(.el-table__body tr.is-active-batch > td.el-table__cell) {
  background-color: #ecf5ff !important;
}

.batch-table :deep(.el-table__body tr) {
  cursor: pointer;
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

.detail-content-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.detail-content-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.detail-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.detail-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.detail-tabs :deep(.el-tab-pane) {
  height: auto;
}

.left-column,
.detail-layout {
  display: grid;
  gap: 16px;
}

.detail-layout {
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
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
  margin-bottom: 4px;
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

.content-body-editor-wrap {
  margin-top: 12px;
}

.content-body-readonly {
  min-height: 320px;
}

.content-body-editor-input :deep(textarea.el-textarea__inner) {
  min-height: 320px;
  line-height: 1.9;
  background: transparent;
  box-shadow: none;
  padding: 0;
  resize: vertical;
}

.inline-staging-info-form {
  margin-bottom: 4px;
}

.inline-staging-info-form :deep(.nested-form-item) {
  margin-bottom: 0;
}

.inline-staging-info-form :deep(.nested-form-item .el-form-item__content) {
  margin-left: 0 !important;
}

.detail-expanded :deep(.el-input),
.detail-expanded :deep(.el-textarea) {
  width: 100%;
}

.attachment-readonly-block {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.staging-product-picture-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.staging-product-picture-cell.staging-product-picture-cell-col {
  /* flex-direction: column; */
  align-items: stretch;
  gap: 6px;
}

.staging-row-picture-actions {
  display: flex;
  justify-content: space-between;
}

.staging-picture-edit-tip {
  font-size: 12px;
  line-height: 1.35;
}

.staging-product-thumb {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.staging-picture-meta {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.35;
}

.staging-food-body-cell {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.staging-food-body-snippet {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.35;
  color: #606266;
}

.staging-food-body-snippet-empty {
  color: #909399;
}

.food-body-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.65;
}

.food-body-select-surface {
  flex: 1;
  min-height: min(380px, 50vh);
  max-height: min(420px, 55vh);
  overflow: auto;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #e8edf7;
  background: linear-gradient(180deg, #ffffff 0%, #fafcff 100%);
}

.food-body-preview-panel {
  flex: 1;
  min-height: min(380px, 50vh);
  max-height: min(420px, 55vh);
  overflow: auto;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #e8edf7;
  background: #f5f7fa;
}



.food-body-preview-editor :deep(.el-textarea__inner) {
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}


.attachment-group-list {
  display: grid;
  gap: 14px;
}

.staging-attachment-table-shell {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.attachment-group-card,
.company-list-item {
  padding: 10px;
  border-radius: 16px;
  border: 1px solid #e8edf7;
  background: linear-gradient(180deg, #ffffff 0%, #fafcff 100%);
}

.attachment-parse-body {
  margin-top: 4px;
}

.attachment-group-summary,
.attachment-word-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.attachment-word-title {
  font-weight: 600;
  color: #303133;
}

.attachment-word-message {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  color: #606266;
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

.inline-code {
  padding: 2px 6px;
  margin: 0 2px;
  font-size: 12px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  background: #f4f4f5;
  border-radius: 4px;
}

.muted-text {
  color: #909399;
}

.mb-16 {
  margin-bottom: 16px;
}

.bulk-publish-head {
  margin-bottom: 16px;
}

.bulk-publish-line {
  margin: 0 0 10px;
  font-size: 14px;
  color: #303133;
}

.bulk-publish-tip {
  margin-bottom: 12px;
}

.bulk-publish-table {
  margin-top: 8px;
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
  .workspace-layout:not(.workspace-layout-simple) {
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

  .workspace-layout-simple {
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
