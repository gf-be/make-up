<template>
  <div class="announcement-detail" :class="{ 'is-embedded': embedded }">
    <input ref="detailBulkProductImageInputRef" type="file" class="hidden-file-input" multiple accept="image/*"
      @change="handleDetailBulkProductImageInputChange">
    <input ref="detailRowProductImageInputRef" type="file" class="hidden-file-input"
      accept="image/png,image/jpeg,image/webp" @change="handleDetailRowProductImageInputChange">

    <el-page-header v-if="!embedded" @back="goBack" title="返回公告列表" content="公告详情" />

    <el-card v-loading="loading" class="detail-card" shadow="never">
      <template v-if="announcement">
        <!-- <div class="header">
          <h1 class="title">{{ announcement.title }}</h1>
          <div class="meta">
            <el-tag :type="statusType">{{ statusText }}</el-tag>
            <el-tag effect="plain">{{ announcementProductTypeLabel }}</el-tag>
            <span class="date">{{ formatDate(announcement.publish_date) }}</span>
            <span v-if="announcement.announcement_no" class="announcement-no">
              {{ announcement.announcement_no }}
            </span>
          </div>
        </div> -->


        <!-- <el-divider /> -->

        <el-tabs v-model="detailTab" type="border-card" class="detail-main-tabs">
          <el-tab-pane label="公告详情" name="overview">
            <div class="content">
              <div class="overview-key-toolbar section-header">
                <h3>关键信息</h3>
                <div v-if="canManageProductDetails" class="overview-key-actions">
                  <template v-if="!overviewKeyEditMode">
                    <el-button type="primary" plain size="small" @click="startOverviewKeyEdit">
                      编辑
                    </el-button>
                  </template>
                  <template v-else>
                    <el-button size="small" @click="cancelOverviewKeyEdit">取消</el-button>
                    <el-button type="primary" size="small" :loading="savingOverviewKeyInfo" @click="saveOverviewKeyInfo">
                      保存
                    </el-button>
                  </template>
                </div>
              </div>
              <el-descriptions :column="2" border class="overview-key-desc">
                <el-descriptions-item label="产品类型">
                  <el-select
                    v-if="overviewKeyEditMode"
                    v-model="overviewKeyForm.product_type"
                    placeholder="请选择产品类型"
                    filterable
                    style="width: 220px"
                  >
                    <el-option v-for="item in productTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                  <span v-else>{{ announcementProductTypeLabel }}</span>
                </el-descriptions-item>

                <!-- <el-descriptions-item label="检验单位">
                  <el-input
                    v-if="overviewKeyEditMode"
                    v-model="overviewKeyForm.inspection_unit"
                    type="textarea"
                    :rows="2"
                    placeholder="检验单位"
                  />
                  <span v-else>{{ announcement.inspection_unit || '暂无' }}</span>
                </el-descriptions-item> -->
                
                <!-- <el-descriptions-item label="检验时间">
                  <div v-if="overviewKeyEditMode" class="overview-date-inline">
                    <el-date-picker
                      v-model="overviewKeyForm.inspection_start_date"
                      type="date"
                      value-format="YYYY-MM-DD"
                      placeholder="开始日期"
                      style="width: 140px"
                      clearable
                    />
                    <span class="overview-date-sep">至</span>
                    <el-date-picker
                      v-model="overviewKeyForm.inspection_end_date"
                      type="date"
                      value-format="YYYY-MM-DD"
                      placeholder="结束日期"
                      style="width: 140px"
                      clearable
                    />
                  </div>
                  <span v-else>
                    {{
                      announcement.inspection_start_date && announcement.inspection_end_date
                        ? `${formatDate(announcement.inspection_start_date)} 至 ${formatDate(announcement.inspection_end_date)}`
                        : '暂无'
                    }}
                  </span>
                </el-descriptions-item> -->
                <el-descriptions-item label="发布日期">
                  <el-date-picker
                    v-if="overviewKeyEditMode"
                    v-model="overviewKeyForm.publish_date"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="发布日期"
                    style="width: 160px"
                    clearable
                  />
                  <span v-else>{{ formatDate(announcement.publish_date) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="抽检不合格批次">
                  <el-input-number
                    v-if="overviewKeyEditMode"
                    v-model="overviewKeyForm.sampling_unqualified"
                    :min="0"
                    :max="999999"
                    placeholder="不合格批次数"
                    controls-position="right"
                    class="overview-sampling-input"
                  />
                  <span v-else>{{ formatSamplingBatchScalar(announcement.sampling_unqualified_batch_count) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="抽检合格批次">
                  <el-input-number
                    v-if="overviewKeyEditMode"
                    v-model="overviewKeyForm.sampling_qualified"
                    :min="0"
                    :max="9999999"
                    placeholder="合格批次数"
                    controls-position="right"
                    class="overview-sampling-input"
                  />
                  <span v-else>{{ formatSamplingBatchQualifiedSpan(announcement) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="抽检总批次">
                  <el-input-number
                    v-if="overviewKeyEditMode"
                    v-model="overviewKeyForm.sampling_total"
                    :min="0"
                    :max="9999999"
                    placeholder="抽检总批次数"
                    controls-position="right"
                    class="overview-sampling-input"
                  />
                  <span v-else>{{ formatSamplingBatchScalar(announcement.sampling_total_batch_count) }}</span>
                </el-descriptions-item>
              </el-descriptions>

              <div class="section-header">
                <h3>公告内容</h3>
                <el-button
                  v-if="canManageProductDetails"
                  type="primary"
                  plain
                  size="small"
                  :loading="savingContent"
                  @click="openContentDialog"
                >
                  编辑正文
                </el-button>
              </div>
              <div class="announcement-content">{{ announcement.content || '暂无内容' }}</div>

              <div v-if="announcement.attachment_path" class="attachment">
                <h3>附件下载</h3>
                <el-button type="primary" :icon="Download" @click="downloadAttachment">
                  下载附件（{{ announcement.attachment_name || '附件' }}）
                </el-button>
              </div>

              <!-- <el-divider /> -->

              <!-- <div class="related-inspections" v-if="relatedInspections.length > 0">
                <h3>相关检查记录</h3>
                <el-table :data="relatedInspections" stripe>
                  <el-table-column prop="product_name" label="产品名称" min-width="200" />
                  <el-table-column prop="manufacturer" label="生产企业" min-width="200" />
                  <el-table-column prop="inspection_result" label="检查结果" width="100">
                    <template #default="{ row }">
                      <el-tag :type="row.inspection_result === 'unqualified' ? 'danger' : 'success'" size="small">
                        {{ row.inspection_result === 'unqualified' ? '不合格' : '合格' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="unqualified_items" label="不合格项目" min-width="200" show-overflow-tooltip />
                  <el-table-column label="操作" width="100">
                    <template #default="{ row }">
                      <el-button type="primary" size="small" link @click="viewDetail(row.inspection_id || row.id)">
                        查看详情
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div> -->
            </div>
          </el-tab-pane>

          <el-tab-pane label="问题产品明细" name="products">
            <div class="product-details">
              <div class="section-header">
                <!-- <h3>{{ announcementProductTypeLabel }}问题产品详细信息</h3> -->

                <!-- <div class="section-tags">
                  <el-tag type="info">总计 {{ productDetailsSummary.total || 0 }} 批次</el-tag>
                  <el-tag v-if="productDetailsSummary.has_filters" type="success">
                    当前筛选 {{ productDetailsSummary.filtered_total || 0 }} 批次
                  </el-tag>
                  <el-tag v-if="activeCounterfeitCount" type="danger">
                    涉嫌假冒 {{ activeCounterfeitCount }} 批次
                  </el-tag>
                </div> -->
              </div>

              <el-form :model="productDetailFilters" inline class="detail-filter-form">
                <el-form-item label="不符合规定项目">
                  <el-input
                    v-model="productDetailFilters.unqualified_item"
                    placeholder="输入项目关键字"
                    clearable
                    @keyup.enter="handleProductDetailSearch"
                  />
                </el-form-item>
                <el-form-item label="企业名称">
                  <el-input
                    v-model="productDetailFilters.company_keyword"
                    placeholder="输入注册人/备案人/企业名称"
                    clearable
                    @keyup.enter="handleProductDetailSearch"
                  />
                </el-form-item>
                <el-form-item label="被抽样单位">
                  <el-input
                    v-model="productDetailFilters.sample_unit_keyword"
                    placeholder="输入被抽样单位"
                    clearable
                    @keyup.enter="handleProductDetailSearch"
                  />
                </el-form-item>
                <el-form-item label="是否涉嫌假冒">
                  <el-select v-model="productDetailFilters.is_counterfeit" style="width: 100px" clearable placeholder="全部">
                    <el-option label="全部" value="" />
                    <el-option label="涉嫌假冒" value="1" />
                    <el-option label="非假冒" value="0" />
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" size="small" @click="handleProductDetailSearch">筛选</el-button>
                  <el-button size="small" @click="resetProductDetailFilters">重置</el-button>
                  <el-button type="success" plain size="small" :loading="uploadingProductImages" @click="selectDetailBulkProductImages" >
                    导入图片
                  </el-button>
                </el-form-item>
                <!-- <el-form-item v-if="canManageProductDetails" label=" ">
                 
                </el-form-item> -->
              </el-form>

              <div v-loading="productDetailsLoading" class="product-detail-table-wrap">
                <template v-if="productDetailPager.total > 0">
                  <el-table
                    ref="productDetailTableRef"
                    :data="productDetails"
                    stripe
                    size="small"
                    class="product-detail-table"
                    :row-class-name="productDetailRowClassName"
                  >
                    <el-table-column type="expand" width="50">
                      <template #default="{ row }">
                        <el-descriptions :column="2" border size="small"
                          class="detail-expanded detail-product-expanded-descriptions">
                          <el-descriptions-item label="产品名称">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.product_name" size="small" />
                            <span v-else>{{ row.product_name || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="序号">
                            <el-input-number
                              v-if="isEditingProductDetail(row)"
                              v-model="productDetailForm.sequence_no"
                              :min="1"
                              size="small"
                              style="width: 100%"
                            />
                            <span v-else>{{ row.sequence_no || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="产品分类">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.attachment_sampling_category" size="small" />
                            <span v-else>{{ row.attachment_sampling_category || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="注册人/备案人等名称">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.company_names" type="textarea" :rows="1" size="small" />
                            <span v-else>{{ row.company_names || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="注册人/备案人等地址">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.company_addresses" type="textarea" :rows="1" size="small" />
                            <span v-else>{{ row.company_addresses || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="被抽样单位名称">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.sample_unit_name" size="small" />
                            <span v-else>{{ row.sample_unit_name || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="被抽样单位地址">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.sample_unit_address" type="textarea" :rows="1" size="small" />
                            <span v-else>{{ row.sample_unit_address || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="生产日期">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.production_date" size="small" />
                            <span v-else>{{ row.production_date || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="限期使用日期/保质期">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.expiry_date" size="small" />
                            <span v-else>{{ row.expiry_date || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item v-if="!isFoodAnnouncement" label="所在地/进口地区">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.product_region" size="small" />
                            <span v-else>{{ row.product_region || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item v-if="!isFoodAnnouncement" label="注册/备案编号">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.registration_no" size="small" />
                            <span v-else>{{ row.registration_no || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item v-if="!isFoodAnnouncement" label="生产许可证号">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.production_license_no" size="small" />
                            <span v-else>{{ row.production_license_no || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="检验机构">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.inspection_institution" size="small" />
                            <span v-else>{{ row.inspection_institution || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="不符合规定项目" >
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.unqualified_items" type="textarea" size="small" />
                            <span v-else>{{ row.unqualified_items || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="检验结果">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.inspection_result" type="textarea" :rows="1" size="small" />
                            <span v-else>{{ row.inspection_result || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item v-if="isFoodAnnouncement" label="正文文案" :span="2">
                            <el-input
                              v-if="isEditingProductDetail(row)"
                              v-model="productDetailForm.food_body_text"
                              type="textarea"
                              :rows="2"
                              size="small"
                              placeholder="从核验工作台写入或在此编辑；入库同步至问题产品库"
                            />
                            <span v-else class="detail-food-body-preview">{{ row.food_body_text || '暂无' }}</span>
                          </el-descriptions-item>
                         
                          
                          <el-descriptions-item label="规定要求" :span="2">
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.requirement" type="textarea" :rows="1" size="small" />
                            <span v-else>{{ row.requirement || '暂无' }}</span>
                          </el-descriptions-item>
                          <el-descriptions-item label="备注" >
                            <el-input v-if="isEditingProductDetail(row)" v-model="productDetailForm.remarks" type="textarea" :rows="1" size="small" />
                            <span v-else>{{ row.remarks || '暂无' }}</span>
                          </el-descriptions-item>
                          
                          <el-descriptions-item label="涉嫌假冒">
                            <el-switch v-if="isEditingProductDetail(row)" v-model="productDetailForm.is_counterfeit" />
                            <el-tag v-else-if="row.is_counterfeit" type="danger" size="small">涉嫌假冒</el-tag>
                            <span v-else>否</span>
                          </el-descriptions-item>
                          <el-descriptions-item v-if="isEditingProductDetail(row)" label="产品图路径" :span="2">
                            <el-input
                              v-model="productDetailForm.picture_url"
                              size="small"
                              placeholder="可点表格列「上传图片」自动生成，或可填写相对路径、https 链接"
                            />
                          </el-descriptions-item>
                        </el-descriptions>
                      </template>
                    </el-table-column>
                    <el-table-column prop="sequence_no" label="序号" width="70" align="center" />

                    <el-table-column prop="product_name" label="产品" min-width="180" show-overflow-tooltip />
                     <el-table-column prop="unqualified_items" label="不符合规定项目" min-width="130" show-overflow-tooltip />
                    <el-table-column prop="picture_url" label="产品图" width="108" align="center"
                      class-name="detail-picture-table-cell" show-overflow-tooltip>
                      <template #default="{ row }">
                        <div class="detail-product-picture-cell detail-product-picture-cell-col">
                          <div
                            class="detail-product-thumb-wrap"
                            :class="{
                              'is-disabled': !canUploadDetailRowProductPicture(row),
                              'is-uploading': isDetailRowPictureUploading(row)
                            }"
                            v-loading="isDetailRowPictureUploading(row)"
                            @mouseenter="onDetailProductThumbPreviewEnter(row, $event)"
                            @mouseleave="onDetailProductThumbPreviewLeave"
                            @click.stop="onDetailProductThumbClick(row)"
                          >
                            <el-image
                              v-if="resolveProductPictureSrc(row.picture_url) && !isDetailProductPictureLoadFailed(row)"
                              class="detail-product-thumb"
                              fit="cover"
                              :src="resolveProductPictureSrc(row.picture_url)"
                              @error="markDetailProductPictureLoadFailed(row)"
                            />
                            <div v-else class="detail-product-thumb-placeholder">
                              <el-icon v-if="canUploadDetailRowProductPicture(row)" :size="24"><Plus /></el-icon>
                              <span v-else class="muted-text">—</span>
                            </div>
                          </div>
                          <div v-if="isEditingProductDetail(row)" class="muted-text detail-picture-edit-tip">
                            请先保存本次编辑后再上传本行图片
                          </div>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="isFoodAnnouncement"
                      prop="food_body_text"
                      label="正文文案"
                      min-width="120"
                      class-name="detail-food-body-table-cell"
                    >
                      <template #default="{ row }">
                        <div class="staging-food-body-cell">
                          <span
                            class="staging-food-body-snippet"
                            :class="{ 'is-empty': !hasDetailFoodBodyText(row) }"
                            :title="String(row.food_body_text || '').trim() || ''"
                          >
                            {{ formatFoodBodySnippet(row.food_body_text) }}
                          </span>
                          <div v-if="canManageProductDetails" class="staging-food-body-actions">
                            <el-button
                              v-if="hasDetailFoodBodyText(row)"
                              type="danger"
                              link
                              size="small"
                              :loading="foodBodyImportSaving"
                              @click.stop="clearFoodBodyText(row)"
                            >
                              清空
                            </el-button>
                            <el-button
                              v-else
                              type="primary"
                              link
                              size="small"
                              @click.stop="openDetailFoodBodyTextPicker(row)"
                            >
                              查看正文
                            </el-button>
                          </div>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column v-if="canManageProductDetails" label="操作" width="140" fixed="right" align="center">
                      <template #default="{ row }">
                        <el-button
                          link
                          type="primary"
                          :loading="savingProductDetail && isEditingProductDetail(row)"
                          @click="handleProductDetailEditAction(row)"
                        >
                          {{ isEditingProductDetail(row) ? '保存' : '编辑' }}
                        </el-button>
                        <el-button link type="danger" @click="handleDeleteProductDetail(row)">删除</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                  <div class="product-detail-pagination">
                    <el-pagination
                      :current-page="productDetailPager.page"
                      :page-size="productDetailPager.limit"
                      layout="total, sizes, prev, pager, next, jumper"
                      :total="productDetailPager.total"
                      :page-sizes="[10, 20, 50]"
                      background
                      @current-change="handleProductDetailPageChange"
                      @size-change="handleProductDetailPageSizeChange"
                    />
                  </div>
                </template>
                <el-empty v-else-if="!productDetailsLoading" description="当前条件下暂无可展示的批次明细" />
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
      <el-empty v-else-if="embedded" description="请选择左侧通告查看详情" />
    </el-card>

    <el-dialog
      v-model="contentDialogVisible"
      :title="announcement ? `编辑正文：${announcement.title || '当前通告'}` : '编辑通告正文'"
      width="820px"
      :close-on-click-modal="false"
    >
      <div style="margin-bottom: 16px; color: #606266; line-height: 1.7;">
        保存后会同步更新当前抽检通告正文；若该通告来自导入核验工作台，也会同步回写对应临时批次正文。
      </div>
      <el-input
        v-model="contentForm.content"
        type="textarea"
        :rows="18"
        resize="vertical"
        placeholder="请输入修订后的通告正文"
      />
      <template #footer>
        <el-button @click="contentDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingContent" @click="handleSaveContent">保存正文</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="productImageUploadDialogVisible"
      width="760px"
      title="导入图片"
      :close-on-click-modal="false"
    >
      <el-alert type="success" :closable="false" show-icon class="detail-dialog-alert">
        <template #title>
          当前已选中 {{ productImageFileRows.length }} 个图片（规则与核验工作台一致：按序号保存为序号.png）
        </template>
      </el-alert>
      <el-descriptions :column="1" border size="small" class="detail-folder-desc">
        <el-descriptions-item label="通告年号（公告编号）">
          {{ productImageAnnouncementNoPreview || '（请先维护公告编号，图片目录按年号命名）' }}
        </el-descriptions-item>
        <el-descriptions-item label="目录名">{{ productImageAnnouncementSlug }}</el-descriptions-item>
        <el-descriptions-item label="通告标题（对照）">{{ productImageAnnouncementTitlePreview || '—' }}</el-descriptions-item>
      </el-descriptions>
      <el-form label-width="96px" class="detail-product-image-start-form">
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
        <el-button @click="clearDetailProductImageSelection">清空</el-button>
        <el-button type="primary" :loading="uploadingProductImages" @click="handleDetailUploadProductImages">
          上传
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="foodBodyTextDialogVisible"
      width="960px"
      :close-on-click-modal="false"
      destroy-on-close
      draggable
      class="food-body-text-dialog"
      @closed="resetDetailFoodBodyTextPicker"
    >
      <template #header="{ titleId, titleClass }">
        <div class="food-body-dialog-header">
          <span :id="titleId" :class="titleClass">选取文案</span>
          <el-button
            type="primary"
            :loading="foodBodyImportSaving"
            @click="confirmDetailFoodBodyTextImport"
          >
            导入
          </el-button>
        </div>
      </template>
      
      <p class="panel-tip food-body-picker-tip">
        在左侧通告正文中选择文字。
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
            @mouseup="captureDetailFoodBodySelection"
          >
            <pre
              v-if="!foodBodyDialogFullText"
              class="food-body-pre muted-text"
            >（当前通告正文为空，请先在概览区编辑公告正文）</pre>
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
            <div v-if="foodBodySelectionPreview" class="food-body-preview-body preview-text">
              {{ foodBodySelectionPreview }}
            </div>
            <div v-else class="food-body-preview-placeholder muted-text">
              在左侧正文中拖选文字后，将在此处显示预览。
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="foodBodyTextDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>

    <Teleport to="body">
      <div
        v-if="detailPicturePreview.visible"
        class="detail-product-thumb-preview"
        :style="detailPicturePreview.style"
      >
        <img :src="detailPicturePreview.src" alt="" class="detail-product-thumb-preview-image" />
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, Plus } from '@element-plus/icons-vue'
import {
  deleteAnnouncementProductDetail,
  getAnnouncementById,
  getAnnouncementProductDetails,
  getRelatedInspections,
  updateAnnouncementContent,
  updateAnnouncementOverviewFields,
  updateAnnouncementProductDetail,
  updateAnnouncementProductType,
  updateAnnouncementSamplingBatchStats,
  uploadAnnouncementStagingProductImages
} from '@/api/index'
import { canManageAnnouncementProducts } from '@/utils/auth'
import { resolveProductPictureSrc } from '@/utils/productPicture.js'
import FoodBodyTextSearchToolbar from '@/components/FoodBodyTextSearchToolbar.vue'
import { useFoodBodyTextSearch } from '@/composables/useFoodBodyTextSearch.js'


import dayjs from 'dayjs'

const PRODUCT_TYPE_LABELS = {
  cosmetics: '化妆品',
  food: '食品',
  medical_device: '医疗器械',
  unknown: '未分类'
}

const props = defineProps({
  announcementId: {
    type: [String, Number],
    default: ''
  },
  embedded: {
    type: Boolean,
    default: false
  }
})

const productTypeOptions = Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label
}))

const route = useRoute()

const router = useRouter()
const detailTab = ref('overview')
const loading = ref(false)
const productDetailsLoading = ref(false)
const savingProductDetail = ref(false)
const savingOverviewKeyInfo = ref(false)
const savingContent = ref(false)
const announcement = ref(null)
const relatedInspections = ref([])
const productDetails = ref([])
const contentDialogVisible = ref(false)
const overviewKeyEditMode = ref(false)
const productDetailTableRef = ref(null)
const editingProductDetailId = ref(null)

const detailBulkProductImageInputRef = ref(null)
const detailRowProductImageInputRef = ref(null)
const selectedProductImageFiles = ref([])
const productImageUploadDialogVisible = ref(false)
const productImageStartSequence = ref(1)
const uploadingProductImages = ref(false)
const detailRowPictureTargetRow = ref(null)
const uploadingDetailRowPictureDetailId = ref(null)
const detailPicturePreview = ref({
  visible: false,
  src: '',
  style: {}
})
/** @type {HTMLElement | null} */
let detailPicturePreviewScrollEl = null
const detailProductPictureLoadFailedIds = ref(new Set())

const DETAIL_PICTURE_PREVIEW_SIZE = 104
const DETAIL_PICTURE_PREVIEW_GAP = 6

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
const canManageProductDetails = computed(() => canManageAnnouncementProducts())

const productDetailFilters = ref({
  unqualified_item: '',
  company_keyword: '',
  sample_unit_keyword: '',
  is_counterfeit: ''
})
const productDetailsSummary = ref(createEmptySummary())
const productDetailPager = reactive({
  page: 1,
  limit: 20,
  total: 0
})
const overviewKeyForm = reactive({
  product_type: 'unknown',
  inspection_unit: '',
  sampling_unqualified: undefined,
  sampling_qualified: undefined,
  sampling_total: undefined,
  inspection_start_date: '',
  inspection_end_date: '',
  publish_date: ''
})
const contentForm = reactive({
  content: ''
})
const productDetailForm = reactive(createEmptyProductDetailForm())

function createEmptySummary () {
  return {
    total: 0,
    counterfeit_count: 0,
    filtered_total: 0,
    filtered_counterfeit_count: 0,
    has_filters: false
  }
}

function createEmptyProductDetailForm () {
  return {
    id: null,
    sequence_no: 1,
    product_name: '',
    company_names: '',
    company_addresses: '',
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

const embedded = computed(() => props.embedded)
const resolvedAnnouncementId = computed(() => props.announcementId || route.params.id)
const currentAnnouncementId = computed(() => announcement.value?.id || resolvedAnnouncementId.value)
const announcementProductTypeLabel = computed(() => {
  const value = announcement.value?.product_type
  return PRODUCT_TYPE_LABELS[value] || value || '未分类'
})
const isFoodAnnouncement = computed(() => announcement.value?.product_type === 'food')

function normalizeDetailAnnouncementWhitespace(s) {
  return String(s ?? '').replace(/\u0007/g, ' ').replace(/[ \t]+/g, ' ').trim()
}

/** 与核验工作台、`data_get` 目录 slug 规则一致 */
function sanitizeAnnouncementNoPictureFolderForDetail(announcementNoRaw) {
  const raw = normalizeDetailAnnouncementWhitespace(announcementNoRaw)
  if (!raw) return 'misc'
  let text = raw.replace(/[/\\:*?"<>|]+/g, '_')
  text = text.replace(/_+/g, '_').replace(/^[.\s_]+|[.\s_]+$/g, '')
  if (!text) return 'misc'
  const limited = text.slice(0, 120)
  const slug = limited || 'announcement'
  if (slug === 'announcement') return 'misc'
  return slug
}

function resolveAnnouncementNoForDetailProductImages() {
  const ann = announcement.value
  return normalizeDetailAnnouncementWhitespace(ann?.announcement_no || '')
}

function resolveAnnouncementTitleForDetailProductImages() {
  const ann = announcement.value
  return normalizeDetailAnnouncementWhitespace(ann?.title || '')
}

/** 与后端上传接口约定一致：`/upload/products/{slug}/{序号}.png` */
function storedPathFromDetailProductUploadItem(item) {
  return String(item?.picture_url || item?.public_url || '').trim()
}

function formatDetailFileSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const productImageAnnouncementNoPreview = computed(() => resolveAnnouncementNoForDetailProductImages())
const productImageAnnouncementTitlePreview = computed(() => resolveAnnouncementTitleForDetailProductImages())
const productImageAnnouncementSlug = computed(() =>
  sanitizeAnnouncementNoPictureFolderForDetail(productImageAnnouncementNoPreview.value)
)

const productImageFileRows = computed(() => {
  const start = Math.max(Number(productImageStartSequence.value || 1), 1)
  const slug = productImageAnnouncementSlug.value
  const list = Array.isArray(selectedProductImageFiles.value) ? selectedProductImageFiles.value : []
  return list.map((item, index) => {
    const sequenceNo = start + index
    const targetName = `${sequenceNo}.png`
    return {
      ...item,
      sequenceNo,
      targetName,
      targetPath: `backend\\public\\upload\\products\\${slug}\\${targetName}`,
      sizeLabel: formatDetailFileSize(item.size)
    }
  })
})

function canUploadDetailRowProductPicture(row) {
  return Boolean(canManageProductDetails.value && row?.id && !isEditingProductDetail(row))
}

function isDetailRowPictureUploading(row) {
  const id = row?.id
  if (id == null) return false
  return String(uploadingDetailRowPictureDetailId.value) === String(id)
}

function selectDetailBulkProductImages() {
  if (!normalizeDetailAnnouncementWhitespace(resolveAnnouncementNoForDetailProductImages())) {
    ElMessage.warning('请先在本公告填写通告年号/公告编号，图片目录按年号命名（与核验工作台一致）')
    return
  }
  detailBulkProductImageInputRef.value?.click()
}

function handleDetailBulkProductImageInputChange(event) {
  const input = event.target
  const files = input?.files
  if (!files?.length) {
    if (input) input.value = ''
    return
  }

  if (!normalizeDetailAnnouncementWhitespace(resolveAnnouncementNoForDetailProductImages())) {
    ElMessage.warning('请先维护公告编号，导入目录按年号命名')
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

  next.sort((left, right) =>
    String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN', {
      numeric: true,
      sensitivity: 'base'
    })
  )

  selectedProductImageFiles.value = next
  if (input) input.value = ''
  if (!next.length) {
    ElMessage.warning('所选内容中未包含可导入的图片文件')
    return
  }
  productImageUploadDialogVisible.value = true
}

function clearDetailProductImageSelection() {
  selectedProductImageFiles.value = []
  productImageUploadDialogVisible.value = false
}

async function handleDetailUploadProductImages() {
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

  if (!normalizeDetailAnnouncementWhitespace(resolveAnnouncementNoForDetailProductImages())) {
    ElMessage.warning('请先维护公告编号，导入目录按年号命名')
    return
  }

  const end = start + rows.length - 1
  try {
    await ElMessageBox.confirm(`上传后将图片名改为 ${start}.png～${end}.png，同名文件会被覆盖。`, '确认导入', {
      type: 'success',
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    })
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    throw error
  }

  uploadingProductImages.value = true
  try {
    const formData = new FormData()
    rows.forEach((row) => {
      formData.append('files', row.file, row.name)
    })
    formData.append('start_sequence', String(start))
    formData.append('announcement_no', resolveAnnouncementNoForDetailProductImages())
    const aid = currentAnnouncementId.value
    if (aid != null && String(aid).trim() !== '') {
      formData.append('announcement_id', String(aid))
    }
    const res = await uploadAnnouncementStagingProductImages(formData)
    const data = res.data || {}
    ElMessage.success(res.message || data.message || `已导入 ${rows.length} 张图片`)
    selectedProductImageFiles.value = []
    productImageUploadDialogVisible.value = false
    await refreshAnnouncementData()
  } catch (error) {
    console.error('导入产品图片失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '导入产品图片失败')
  } finally {
    uploadingProductImages.value = false
  }
}

function triggerDetailRowProductPictureUpload(row) {
  if (!canUploadDetailRowProductPicture(row)) {
    return
  }
  if (!normalizeDetailAnnouncementWhitespace(resolveAnnouncementNoForDetailProductImages())) {
    ElMessage.warning('请先维护公告通告年号/公告编号，图片目录按年号命名')
    return
  }
  detailRowPictureTargetRow.value = row
  detailRowProductImageInputRef.value?.click()
}

function isDetailProductPictureLoadFailed(row) {
  const id = row?.id
  return id != null && detailProductPictureLoadFailedIds.value.has(String(id))
}

function markDetailProductPictureLoadFailed(row) {
  const id = row?.id
  if (id == null || detailProductPictureLoadFailedIds.value.has(String(id))) {
    return
  }
  const next = new Set(detailProductPictureLoadFailedIds.value)
  next.add(String(id))
  detailProductPictureLoadFailedIds.value = next
}

function clearDetailProductPictureLoadFailed(row) {
  const id = row?.id
  if (id == null || !detailProductPictureLoadFailedIds.value.has(String(id))) {
    return
  }
  const next = new Set(detailProductPictureLoadFailedIds.value)
  next.delete(String(id))
  detailProductPictureLoadFailedIds.value = next
}

function unbindDetailPicturePreviewScrollDismiss() {
  if (detailPicturePreviewScrollEl) {
    detailPicturePreviewScrollEl.removeEventListener('scroll', hideDetailPicturePreview)
    detailPicturePreviewScrollEl = null
  }
}

function hideDetailPicturePreview() {
  detailPicturePreview.value = { visible: false, src: '', style: {} }
  unbindDetailPicturePreviewScrollDismiss()
}

function bindDetailPicturePreviewScrollDismiss() {
  unbindDetailPicturePreviewScrollDismiss()
  const tableEl = productDetailTableRef.value?.$el
  const bodyWrapper = tableEl?.querySelector('.el-table__body-wrapper')
  if (!bodyWrapper) return
  detailPicturePreviewScrollEl = bodyWrapper
  bodyWrapper.addEventListener('scroll', hideDetailPicturePreview, { passive: true })
}

function onDetailProductThumbPreviewEnter(row, event) {
  const src = resolveProductPictureSrc(row.picture_url)
  if (!src || isDetailProductPictureLoadFailed(row)) return

  const trigger = event?.currentTarget
  if (!(trigger instanceof HTMLElement)) return

  const rect = trigger.getBoundingClientRect()
  const tableEl = productDetailTableRef.value?.$el
  const headerWrapper = tableEl?.querySelector('.el-table__header-wrapper')
  const headerBottom = headerWrapper?.getBoundingClientRect().bottom ?? 0
  const rows = productDetails.value
  const rowIndex = rows.indexOf(row)
  const isFirstRow = rowIndex === 0
  const isLastRow = rowIndex >= 0 && rowIndex === rows.length - 1
  const previewSize = DETAIL_PICTURE_PREVIEW_SIZE
  const gap = DETAIL_PICTURE_PREVIEW_GAP

  let top
  if (isLastRow) {
    top = rect.top - previewSize - gap
  } else {
    top = rect.bottom + gap
  }

  if (isFirstRow && !isLastRow) {
    top = Math.max(top, headerBottom + gap)
  }

  if (isLastRow && top < gap) {
    top = rect.bottom + gap
  }

  if (top + previewSize > window.innerHeight - gap) {
    top = Math.max(gap, rect.top - previewSize - gap)
  }

  let left = rect.left + rect.width / 2 - previewSize / 2
  left = Math.max(gap, Math.min(left, window.innerWidth - previewSize - gap))

  detailPicturePreview.value = {
    visible: true,
    src,
    style: {
      top: `${top}px`,
      left: `${left}px`,
      width: `${previewSize}px`,
      height: `${previewSize}px`
    }
  }
  bindDetailPicturePreviewScrollDismiss()
}

function onDetailProductThumbPreviewLeave() {
  hideDetailPicturePreview()
}

function onDetailProductThumbClick(row) {
  if (isEditingProductDetail(row)) {
    return
  }
  triggerDetailRowProductPictureUpload(row)
}

async function handleDetailRowProductImageInputChange(event) {
  const input = event.target
  const file = input?.files?.[0]
  const row = detailRowPictureTargetRow.value
  detailRowPictureTargetRow.value = null
  if (input) input.value = ''

  const announcementId = currentAnnouncementId.value
  if (!file || !row?.id || !announcementId) {
    return
  }

  if (!normalizeDetailAnnouncementWhitespace(resolveAnnouncementNoForDetailProductImages())) {
    ElMessage.warning('请先维护公告编号')
    return
  }

  const seq = Number(row.sequence_no ?? 0)
  if (!Number.isInteger(seq) || seq < 1) {
    ElMessage.warning('当前行序号无效，无法上传')
    return
  }

  uploadingDetailRowPictureDetailId.value = row.id
  try {
    const formData = new FormData()
    formData.append('files', file, file.name || 'image.png')
    formData.append('start_sequence', String(seq))
    formData.append('announcement_no', resolveAnnouncementNoForDetailProductImages())
    formData.append('announcement_id', String(announcementId))

    const upRes = await uploadAnnouncementStagingProductImages(formData)
    const upData = upRes.data || {}
    const first = Array.isArray(upData.items) ? upData.items[0] : null
    const picturePath = storedPathFromDetailProductUploadItem(first)
    if (!picturePath) {
      ElMessage.warning('上传成功但未返回图片路径')
      return
    }

    const rowsUpdated = Number(upData.detail_rows_updated ?? upData.detailRowsUpdated ?? 0)
    if (!Number.isFinite(rowsUpdated) || rowsUpdated < 1) {
      const body = buildProductDetailPutBody({ ...row, picture_url: picturePath })
      await updateAnnouncementProductDetail(announcementId, row.id, body)
    }

    ElMessage.success('产品图已上传并写入本条明细')
    clearDetailProductPictureLoadFailed(row)
    await refreshAnnouncementData()

    const stillEditingSame =
      editingProductDetailId.value != null && String(editingProductDetailId.value) === String(row.id)
    if (stillEditingSame && productDetailForm.id === row.id) {
      productDetailForm.picture_url = picturePath
    }
  } catch (error) {
    console.error('单行产品图上传失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '上传失败')
  } finally {
    uploadingDetailRowPictureDetailId.value = null
  }
}

function buildProductDetailPutBody(source = {}) {
  const counterfeitBool = source.is_counterfeit === true || Number(source.is_counterfeit) === 1
  return {
    sequence_no: Number(source.sequence_no || 1),
    product_name: source.product_name,
    company_names: source.company_names,
    company_addresses: source.company_addresses,
    sample_unit_name: source.sample_unit_name,
    sample_unit_address: source.sample_unit_address,
    package_spec: source.package_spec,
    batch_no: source.batch_no,
    production_date: source.production_date,
    expiry_date: source.expiry_date,
    product_region: source.product_region,
    registration_no: source.registration_no,
    production_license_no: source.production_license_no,
    inspection_institution: source.inspection_institution,
    unqualified_items: source.unqualified_items,
    inspection_result: source.inspection_result,
    requirement: source.requirement,
    remarks: source.remarks,
    picture_url: source.picture_url != null && source.picture_url !== undefined ? String(source.picture_url) : '',
    food_body_text: source.food_body_text != null && source.food_body_text !== undefined ? String(source.food_body_text) : '',
    is_counterfeit: counterfeitBool ? 1 : 0
  }
}

function formatFoodBodySnippet(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim()
  return s || '—'
}

function hasDetailFoodBodyText(row = {}) {
  return Boolean(String(row.food_body_text ?? '').trim())
}

async function clearFoodBodyText(row) {
  if (!canManageProductDetails.value) {
    ElMessage.warning('当前账号无编辑权限')
    return
  }

  const announcementId = currentAnnouncementId.value
  if (!row?.id || !announcementId) {
    return
  }

  if (!hasDetailFoodBodyText(row)) {
    ElMessage.info('当前行暂无正文文案')
    return
  }

  foodBodyImportSaving.value = true
  try {
    await updateAnnouncementProductDetail(
      announcementId,
      row.id,
      buildProductDetailPutBody({ ...row, food_body_text: null })
    )
    ElMessage.success('正文文案已清空')
    await refreshAnnouncementData()

    const stillEditingSame =
      editingProductDetailId.value != null && String(editingProductDetailId.value) === String(row.id)
    if (stillEditingSame && productDetailForm.id === row.id) {
      productDetailForm.food_body_text = ''
    }
  } catch (error) {
    console.error('清空正文文案失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '清空失败')
  } finally {
    foodBodyImportSaving.value = false
  }
}

function openDetailFoodBodyTextPicker(row) {
  if (!currentAnnouncementId.value || !row?.id || !canManageProductDetails.value) {
    return
  }
  foodBodyTextTargetRow.value = row
  foodBodySelectionPreview.value = ''
  foodBodyDialogFullText.value = String(
    announcement.value?.content || ''
  ).replace(/\r\n/g, '\n')
  resetFoodBodySearchState()
  foodBodyTextDialogVisible.value = true
}

function captureDetailFoodBodySelection() {
  if (typeof window === 'undefined') {
    return
  }
  const sel = window.getSelection?.()
  const text = sel && sel.rangeCount ? String(sel.toString() || '').trim() : ''
  foodBodySelectionPreview.value = text
}

function resetDetailFoodBodyTextPicker() {
  foodBodyTextTargetRow.value = null
  foodBodySelectionPreview.value = ''
  foodBodyDialogFullText.value = ''
  resetFoodBodySearchState()
}

async function confirmDetailFoodBodyTextImport() {
  let text = String(foodBodySelectionPreview.value || '').trim()
  if (!text && typeof window !== 'undefined') {
    text = String(window.getSelection?.()?.toString?.() || '').trim()
  }
  if (!text) {
    ElMessage.warning('请先在正文中拖选一段文字')
    return
  }

  const row = foodBodyTextTargetRow.value
  const announcementId = currentAnnouncementId.value
  if (!row?.id || !announcementId) {
    return
  }

  foodBodyImportSaving.value = true
  try {
    await updateAnnouncementProductDetail(
      announcementId,
      row.id,
      buildProductDetailPutBody({ ...row, food_body_text: text })
    )
    ElMessage.success('正文文案已保存到本条明细')
    foodBodyTextDialogVisible.value = false
    await refreshAnnouncementData()
    const stillEditingSame =
      editingProductDetailId.value != null && String(editingProductDetailId.value) === String(row.id)
    if (stillEditingSame && productDetailForm.id === row.id) {
      productDetailForm.food_body_text = text
    }
  } catch (error) {
    console.error('保存正文文案失败:', error)
    ElMessage.error(error?.response?.data?.message || error.message || '保存失败')
  } finally {
    foodBodyImportSaving.value = false
  }
}

const activeCounterfeitCount = computed(() => {

  return productDetailsSummary.value.has_filters
    ? Number(productDetailsSummary.value.filtered_counterfeit_count || 0)
    : Number(productDetailsSummary.value.counterfeit_count || 0)
})

const statusType = computed(() => {
  const map = {
    published: 'success',
    draft: 'info',
    archived: 'warning'
  }
  return map[announcement.value?.status] || 'info'
})

const statusText = computed(() => {
  const map = {
    published: '已发布',
    draft: '草稿',
    archived: '已归档'
  }
  return map[announcement.value?.status] || '未知状态'
})

const goBack = () => {
  router.push('/announcements')
}

const formatDate = (date) => {
  if (!date) return '暂无'
  const value = dayjs(date)
  return value.isValid() ? value.format('YYYY年MM月DD日') : date
}

function hasAnnouncementSamplingScalar(value) {
  return value !== null && value !== undefined && value !== ''
}

function formatSamplingBatchScalar(value) {
  return hasAnnouncementSamplingScalar(value) ? String(value) : '—'
}

function formatSamplingBatchQualifiedSpan(announcementRow) {
  const a = announcementRow || {}
  if (hasAnnouncementSamplingScalar(a.sampling_qualified_batch_count)) {
    return String(a.sampling_qualified_batch_count)
  }
  if (
    hasAnnouncementSamplingScalar(a.sampling_unqualified_batch_count) &&
    hasAnnouncementSamplingScalar(a.sampling_total_batch_count)
  ) {
    return String(Number(a.sampling_total_batch_count) - Number(a.sampling_unqualified_batch_count))
  }
  return '—'
}
// 编辑正文
const openContentDialog = () => {
  contentForm.content = announcement.value?.content || ''
  contentDialogVisible.value = true
}

const handleSaveContent = async () => {
  if (!currentAnnouncementId.value || savingContent.value) {
    return
  }

  const nextContent = String(contentForm.content || '').trim()
  if (!nextContent) {
    ElMessage.warning('通告正文不能为空')
    return
  }

  savingContent.value = true
  try {
    const res = await updateAnnouncementContent(currentAnnouncementId.value, {
      content: nextContent
    })
    contentDialogVisible.value = false
    announcement.value = {
      ...(announcement.value || {}),
      content: res.data?.updated_content || nextContent,
      inspection_unit: res.data?.inspection_unit ?? announcement.value?.inspection_unit,
      inspection_count: res.data?.inspection_count ?? announcement.value?.inspection_count
    }
    ElMessage.success(res.message || '通告正文更新成功')
    await fetchAnnouncementOnly(currentAnnouncementId.value)
  } catch (error) {
    console.error('更新公告正文失败:', error)
    ElMessage.error('更新公告正文失败')
  } finally {
    savingContent.value = false
  }
}

const downloadAttachment = () => {

  if (announcement.value?.attachment_path) {
    window.open(`http://localhost:3000${announcement.value.attachment_path}`, '_blank')
  }
}

const viewDetail = (id) => {
  router.push(`/inspections/${id}`)
}

const applyProductDetailRow = (row = {}) => {
  Object.assign(productDetailForm, createEmptyProductDetailForm(), {
    ...row,
    sequence_no: Number(row.sequence_no || 1),
    is_counterfeit: Boolean(row.is_counterfeit)
  })
}

const stopEditingProductDetail = () => {
  editingProductDetailId.value = null
  applyProductDetailRow()
}

const isEditingProductDetail = (row) => {
  return row?.id != null && String(row.id) === String(editingProductDetailId.value)
}

function productDetailRowClassName({ row }) {
  return isEditingProductDetail(row) ? 'is-editing-product-detail' : ''
}

const fetchAnnouncementOnly = async (announcementId) => {
  const res = await getAnnouncementById(announcementId)
  announcement.value = res.data
  return res.data
}

const fetchRelatedInspections = async (announcementId) => {
  try {
    const res = await getRelatedInspections(announcementId)
    relatedInspections.value = res.data || []
  } catch (error) {
    console.error('获取相关检查记录失败:', error)
    relatedInspections.value = []
  }
}

const fetchProductDetails = async (announcementId, opts = {}) => {
  if (opts.resetPage) {
    productDetailPager.page = 1
  }

  productDetailsLoading.value = true
  try {
    const loadOnce = () =>
      getAnnouncementProductDetails(announcementId, {
        ...productDetailFilters.value,
        page: productDetailPager.page,
        limit: productDetailPager.limit
      })

    let res = await loadOnce()
    productDetails.value = res.data || []
    productDetailsSummary.value = res.summary || createEmptySummary()
    productDetailPager.total = res.pagination ? Number(res.pagination.total || 0) : productDetails.value.length

    const limit = Math.max(1, productDetailPager.limit)
    const lastPage = Math.max(1, Math.ceil(productDetailPager.total / limit) || 1)
    if (productDetailPager.page > lastPage) {
      productDetailPager.page = lastPage
      res = await loadOnce()
      productDetails.value = res.data || []
      productDetailsSummary.value = res.summary || createEmptySummary()
      if (res.pagination) {
        productDetailPager.total = Number(res.pagination.total || 0)
      }
    }
  } catch (error) {
    console.error('获取公告批次明细失败:', error)
    productDetails.value = []
    productDetailsSummary.value = createEmptySummary()
    productDetailPager.total = 0
  } finally {
    productDetailsLoading.value = false
  }
}

const handleProductDetailPageChange = (page) => {
  productDetailPager.page = page
  if (currentAnnouncementId.value) {
    fetchProductDetails(currentAnnouncementId.value)
  }
}

const handleProductDetailPageSizeChange = (size) => {
  productDetailPager.limit = size
  productDetailPager.page = 1
  if (currentAnnouncementId.value) {
    fetchProductDetails(currentAnnouncementId.value)
  }
}

const resetDetailState = () => {
  announcement.value = null
  relatedInspections.value = []
  productDetails.value = []
  productDetailsSummary.value = createEmptySummary()
  productDetailsLoading.value = false
  productDetailPager.page = 1
  productDetailPager.total = 0
  detailTab.value = 'overview'
  overviewKeyEditMode.value = false
  stopEditingProductDetail()
}

const fetchAnnouncement = async (announcementId = resolvedAnnouncementId.value) => {
  const id = announcementId
  if (!id) {
    resetDetailState()
    if (!props.embedded) {
      ElMessage.error('公告ID不存在')
      goBack()
    }
    return
  }

  resetDetailState()

  loading.value = true
  try {
    await Promise.all([
      fetchAnnouncementOnly(id),
      fetchRelatedInspections(id),
      fetchProductDetails(id)
    ])
  } catch (error) {
    ElMessage.error('获取公告详情失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const refreshAnnouncementData = async () => {
  const announcementId = currentAnnouncementId.value
  if (!announcementId) return

  await Promise.all([
    fetchAnnouncementOnly(announcementId),
    fetchProductDetails(announcementId)
  ])
}

function announceDateToPickerString (value) {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD') : ''
}

function fillOverviewKeyFormFromAnnouncement () {
  const a = announcement.value || {}
  overviewKeyForm.product_type = a.product_type || 'unknown'
  overviewKeyForm.inspection_unit = a.inspection_unit ? String(a.inspection_unit) : ''
  const u = a.sampling_unqualified_batch_count
  const q = a.sampling_qualified_batch_count
  const t = a.sampling_total_batch_count
  overviewKeyForm.sampling_unqualified =
    u !== null && u !== undefined && u !== '' ? Number(u) : undefined
  overviewKeyForm.sampling_total =
    t !== null && t !== undefined && t !== '' ? Number(t) : undefined
  if (q !== null && q !== undefined && q !== '') {
    overviewKeyForm.sampling_qualified = Number(q)
  } else if (
    u !== null &&
    u !== undefined &&
    u !== '' &&
    t !== null &&
    t !== undefined &&
    t !== ''
  ) {
    overviewKeyForm.sampling_qualified = Number(t) - Number(u)
  } else {
    overviewKeyForm.sampling_qualified = undefined
  }
  overviewKeyForm.inspection_start_date = announceDateToPickerString(a.inspection_start_date)
  overviewKeyForm.inspection_end_date = announceDateToPickerString(a.inspection_end_date)
  overviewKeyForm.publish_date = announceDateToPickerString(a.publish_date)
}

function startOverviewKeyEdit () {
  if (!canManageProductDetails.value) {
    ElMessage.warning('当前账号无编辑权限')
    return
  }
  fillOverviewKeyFormFromAnnouncement()
  overviewKeyEditMode.value = true
}

function cancelOverviewKeyEdit () {
  overviewKeyEditMode.value = false
}

async function saveOverviewKeyInfo () {
  if (!currentAnnouncementId.value || savingOverviewKeyInfo.value) return
  if (!canManageProductDetails.value) {
    ElMessage.warning('当前账号无编辑权限')
    return
  }

  const uRaw = overviewKeyForm.sampling_unqualified
  const qRaw = overviewKeyForm.sampling_qualified
  const tRaw = overviewKeyForm.sampling_total
  const sampling_unqualified_batch_count =
    uRaw === null || uRaw === undefined || uRaw === '' ? null : Number(uRaw)
  const sampling_qualified_batch_count =
    qRaw === null || qRaw === undefined || qRaw === '' ? null : Number(qRaw)
  const sampling_total_batch_count =
    tRaw === null || tRaw === undefined || tRaw === '' ? null : Number(tRaw)

  const batchStats = [
    sampling_unqualified_batch_count,
    sampling_qualified_batch_count,
    sampling_total_batch_count
  ]

  if (
    sampling_unqualified_batch_count !== null &&
    (Number.isNaN(sampling_unqualified_batch_count) || sampling_unqualified_batch_count < 0)
  ) {
    ElMessage.warning('抽检不合格批次须为非负整数或留空')
    return
  }
  if (
    sampling_qualified_batch_count !== null &&
    (Number.isNaN(sampling_qualified_batch_count) || sampling_qualified_batch_count < 0)
  ) {
    ElMessage.warning('抽检合格批次须为非负整数或留空')
    return
  }
  if (
    sampling_total_batch_count !== null &&
    (Number.isNaN(sampling_total_batch_count) || sampling_total_batch_count < 0)
  ) {
    ElMessage.warning('抽检总批次须为非负整数或留空')
    return
  }

  const filled = batchStats.filter((v) => v !== null).length
  if (filled === 3) {
    if (sampling_unqualified_batch_count + sampling_qualified_batch_count !== sampling_total_batch_count) {
      ElMessage.warning('抽检不合格批次 + 合格批次须等于抽检总批次')
      return
    }
  }

  savingOverviewKeyInfo.value = true
  try {
    const id = currentAnnouncementId.value
    await updateAnnouncementProductType(id, {
      product_type: overviewKeyForm.product_type
    })
    await updateAnnouncementSamplingBatchStats(id, {
      sampling_unqualified_batch_count,
      sampling_qualified_batch_count,
      sampling_total_batch_count
    })
    await updateAnnouncementOverviewFields(id, {
      publish_date: overviewKeyForm.publish_date || null,
      inspection_unit: overviewKeyForm.inspection_unit || null,
      inspection_start_date: overviewKeyForm.inspection_start_date || null,
      inspection_end_date: overviewKeyForm.inspection_end_date || null
    })
    overviewKeyEditMode.value = false
    ElMessage.success('关键信息已保存')
    await refreshAnnouncementData()
  } catch (error) {
    console.error('保存关键信息失败:', error)
    ElMessage.error('保存关键信息失败')
  } finally {
    savingOverviewKeyInfo.value = false
  }
}

const handleProductDetailSearch = () => {
  if (!currentAnnouncementId.value) return
  fetchProductDetails(currentAnnouncementId.value, { resetPage: true })
}

const resetProductDetailFilters = () => {
  productDetailFilters.value = {
    unqualified_item: '',
    company_keyword: '',
    sample_unit_keyword: '',
    is_counterfeit: ''
  }
  handleProductDetailSearch()
}

const openEditProductDetail = async (row) => {
  if (!canManageProductDetails.value) {
    ElMessage.warning('当前账号无编辑权限')
    return
  }
  applyProductDetailRow(row)
  editingProductDetailId.value = row?.id || null
  await nextTick()
  productDetailTableRef.value?.toggleRowExpansion(row, true)
}

const validateProductDetailForm = () => {
  const requiredFields = [
    ['sequence_no', '请输入序号'],
    ['product_name', '请输入产品名称'],
    ['company_names', '请输入注册人/备案人等名称'],
    ['company_addresses', '请输入注册人/备案人等地址'],
    ['sample_unit_name', '请输入被抽样单位名称'],
    ['sample_unit_address', '请输入被抽样单位地址'],
    ['unqualified_items', '请输入不符合规定项目'],
    ['inspection_result', '请输入检验结果'],
    ['requirement', '请输入规定要求']
  ]
  for (const [field, message] of requiredFields) {
    if (productDetailForm[field] === null || productDetailForm[field] === undefined || String(productDetailForm[field]).trim() === '') {
      ElMessage.warning(message)
      return false
    }
  }
  return true
}

const handleProductDetailEditAction = (row) => {
  if (isEditingProductDetail(row)) {
    handleSaveProductDetail()
    return
  }
  openEditProductDetail(row)
}

const handleSaveProductDetail = async () => {
  if (!canManageProductDetails.value) {
    ElMessage.warning('当前账号无编辑权限')
    return
  }
  if (!currentAnnouncementId.value || !productDetailForm.id) {
    return
  }

  if (!validateProductDetailForm()) {
    return
  }

  savingProductDetail.value = true
  try {
    await updateAnnouncementProductDetail(
      currentAnnouncementId.value,
      productDetailForm.id,
      buildProductDetailPutBody(productDetailForm)
    )

    ElMessage.success('批次明细更新成功')
    stopEditingProductDetail()
    await refreshAnnouncementData()
  } catch (error) {
    console.error('更新公告批次明细失败:', error)
    ElMessage.error('更新公告批次明细失败')
  } finally {
    savingProductDetail.value = false
  }
}

const handleDeleteProductDetail = async (row) => {
  if (!canManageProductDetails.value) {
    ElMessage.warning('当前账号无删除权限')
    return
  }
  if (!currentAnnouncementId.value || !row?.id) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认删除“${row.product_name || '该批次明细'}”吗？删除后会同步更新不符合规定化妆品库。`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )

    await deleteAnnouncementProductDetail(currentAnnouncementId.value, row.id)
    ElMessage.success('批次明细删除成功')
    await refreshAnnouncementData()
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error('删除公告批次明细失败:', error)
    ElMessage.error('删除公告批次明细失败')
  }
}

watch(resolvedAnnouncementId, (id) => {
  fetchAnnouncement(id)
}, {
  immediate: true
})
</script>

<style scoped>
.dialog-tip {
  margin-bottom: 16px;
  color: #606266;
  line-height: 1.7;
}

.announcement-detail {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.detail-card {
  margin-top: 20px;
}

.announcement-detail.is-embedded {
  padding: 0;
  max-width: none;
  margin: 0;
}

.announcement-detail.is-embedded .detail-card {
  margin-top: 0;
  border: 0;
}

.detail-main-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.detail-main-tabs :deep(.el-tabs__content) {
  padding: 16px 18px;
}

.detail-main-tabs .product-details {
  margin-top: 0;
}

.header {
  margin-bottom: 20px;
}

.title {
  font-size: 24px;
  color: #303133;
  margin: 0 0 15px 0;
}

.meta {
  display: flex;
  align-items: center;
  gap: 15px;
  color: #909399;
  font-size: 14px;
  flex-wrap: wrap;
}

.date,
.source,
.announcement-no {
  font-size: 14px;
}

.announcement-no {
  color: #606266;
  font-weight: 500;
}

.content {
  padding: 1px 0;
}

.content h3 {
  font-size: 18px;
  color: #303133;
  margin: 6px 0 8px 0;
  border-left: 4px solid #409eff;
  padding-left: 10px;
}

.announcement-content {
  line-height: 1.8;
  color: #606266;
  padding: 15px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: min(520px, 62vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.attachment {
  margin-top: 20px;
}

.product-details {
  margin-top: 30px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 15px;
}

.section-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.overview-key-toolbar.section-header {
  margin-bottom: 12px;
}

.overview-key-toolbar.section-header h3 {
  margin: 0;
}

.overview-key-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/** 关键信息表：固定标签列宽，两列内容区平分剩余宽度 */
.overview-key-desc {
  width: 100%;
}

.overview-key-desc :deep(.el-descriptions__table) {
  table-layout: fixed;
  width: 100%;
}

.overview-key-desc :deep(.el-descriptions__label.el-descriptions__cell) {
  width: 136px;
  min-width: 136px;
  max-width: 136px;
  vertical-align: top;
  box-sizing: border-box;
}

.overview-key-desc :deep(.el-descriptions__content.el-descriptions__cell) {
  width: auto;
  min-width: 0;
  word-break: break-word;
  vertical-align: top;
}

.overview-sampling-input {
  width: 160px;
  max-width: 100%;
}

.overview-date-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.overview-date-sep {
  color: #606266;
  font-size: 13px;
}

.detail-filter-form {
  margin-bottom: 12px;
  padding: 12px 14px;
  background: #f8fbff;
  border: 1px solid #edf2f8;
  border-radius: 12px;
}

.detail-expanded {
  padding: 12px 14px;
  background: linear-gradient(180deg, #f8fbff 0%, #f3f7fc 100%);
}

.detail-product-expanded-descriptions :deep(.el-descriptions__label) {
  /* background: #f0f6fc !important; */
  color: #6b849f;
  font-weight: 600;
}

.detail-product-expanded-descriptions :deep(.el-descriptions__content) {
  background: #ffffff !important;
  color: #5f6f82;
}

.detail-product-expanded-descriptions :deep(.el-descriptions__cell) {
  border-color: #e8eef6 !important;
}

.detail-expanded :deep(.el-descriptions__table) {
  table-layout: fixed;
  width: 100%;
}

.detail-expanded :deep(.el-descriptions__cell.el-descriptions__label),
.detail-expanded :deep(.el-descriptions__label) {
  width: 184px;
  min-width: 184px;
  max-width: 184px;
  box-sizing: border-box;
  vertical-align: top;
}

.detail-expanded :deep(.el-descriptions__cell.el-descriptions__content),
.detail-expanded :deep(.el-descriptions__content) {
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.product-detail-table-wrap {
  min-height: 160px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #edf2f8;
  background: linear-gradient(180deg, #fcfdff 0%, #f8fbff 100%);
}

.product-detail-table {
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #edf2f8;
  background: #ffffff;
}

.product-detail-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.product-detail-table :deep(.el-table__header-wrapper th.el-table__cell) {
  background: #83b1ff !important;
  color: #f6f7f8;
  font-weight: 600;
  border-bottom: 1px solid #edf2f8 !important;
}

.product-detail-table :deep(.el-table__body tr > td.el-table__cell) {
  border-bottom: 1px solid #f3f6fb;
  color: #5f6f82;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.product-detail-table :deep(.el-table__body tr.el-table__row--striped > td.el-table__cell) {
  background: #e2edfd;
}

.product-detail-table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: #f6f9fd !important;
}

.product-detail-table :deep(.el-table__body tr.is-editing-product-detail > td.el-table__cell) {
  background: #f1f6fc !important;
  color: #5b7ea8;
  /* box-shadow: inset 3px 0 0 #b3c7e0; */
}

.product-detail-table :deep(.el-table__body tr.is-editing-product-detail:hover > td.el-table__cell) {
  background: #ebf2fa !important;
}

.product-detail-table :deep(.el-table__expanded-cell) {
  padding: 0;
  background: #f8fbff;
  border-bottom: 1px solid #edf2f8;
}

.product-detail-table :deep(.el-table__expand-icon) {
  color: #7da7d9;
}

.product-detail-table :deep(.el-table__expand-icon:hover) {
  color: #5b9bd5;
}

.product-detail-pagination {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  padding-top: 4px;
}

.remark-text {
  color: #909399;
}

.detail-food-body-preview {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
}

.related-inspections {
  margin-top: 30px;
}

.hidden-file-input {
  display: none;
}

.muted-text {
  color: #909399;
  font-size: 12px;
}

.detail-dialog-alert,
.detail-folder-desc,
.detail-product-image-start-form {
  margin-bottom: 16px;
}

.detail-product-picture-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.detail-product-picture-cell.detail-product-picture-cell-col {
  flex-direction: column;
  align-items: center;
  position: relative;
  width: 52px;
  margin: 0 auto;
}

.detail-product-thumb-wrap {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 6px;
  border: 1px solid #e0ebf5;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  background: #fafcff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.detail-product-thumb-wrap:hover:not(.is-disabled):not(.is-uploading) {
  border-color: #93c5fd;
  box-shadow: 0 0 0 1px rgba(147, 197, 253, 0.18);
}

.detail-product-thumb-wrap.is-disabled {
  cursor: default;
}

.detail-product-thumb-wrap.is-disabled:not(.is-uploading) {
  opacity: 0.88;
}

.detail-product-thumb-wrap.is-uploading {
  cursor: wait;
}

.detail-product-thumb {
  width: 100%;
  height: 100%;
  display: block;
}

.detail-product-thumb :deep(.el-image__inner) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.3);
  transform-origin: center center;
}

.detail-product-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9eb3cc;
  background: #f3f7fc;
}

.detail-product-thumb-wrap:hover:not(.is-disabled):not(.is-uploading) .detail-product-thumb-placeholder {
  color: #7da7d9;
  background: #eef4fb;
}

.detail-product-thumb-preview {
  position: fixed;
  z-index: 4000;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(100, 130, 170, 0.14);
  border: 1px solid #a8c4e8;
  background: #fff;
  pointer-events: none;
}

.detail-product-thumb-preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.product-detail-table-wrap :deep(td.detail-picture-table-cell) {
  overflow: visible;
}

.product-detail-table-wrap :deep(td.detail-picture-table-cell .cell) {
  overflow: visible;
  line-height: 1;
}

.detail-row-picture-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-picture-edit-tip {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: calc(100% + 4px);
  z-index: 4;
  width: max-content;
  max-width: 220px;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
}

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

.food-body-picker-tip {
  margin: 0 0 12px;
  color: #606266;
  font-size: 13px;
  line-height: 1.55;
}

.staging-food-body-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

.staging-food-body-snippet {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.4;
  color: #5f6f82;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.staging-food-body-snippet.is-empty {
  color: #9eb3cc;
}

.staging-food-body-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.staging-food-body-actions :deep(.el-button) {
  padding-left: 4px;
  padding-right: 4px;
}

.product-detail-table-wrap :deep(td.detail-food-body-table-cell .cell) {
  overflow: hidden;
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

.food-body-preview-body.preview-text {
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.food-body-preview-placeholder {
  font-size: 13px;
  line-height: 1.55;
}

@media (max-width: 768px) {
  .announcement-detail {
    padding: 12px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

