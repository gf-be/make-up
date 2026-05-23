<template>
  <div class="category-manage">
    <el-card shadow="never" class="page-card">
      <el-row :gutter="16" class="layout-row">
        <el-col :xs="24" :md="8" :lg="7" class="left-col">
          <el-card shadow="never" class="panel-card" v-loading="typesLoading || catalogLoading">
            <template #header>
              <div class="panel-header">
                <span class="panel-title">分类</span>
                <div class="panel-actions">
                  <el-button type="primary" link @click="openTypeDialog">新增类型</el-button>
                  <el-button type="primary" link :disabled="!selectedProductType"
                    @click="openCategoryDialog">新增分类</el-button>
                  <el-button link type="primary" @click="reloadTree">刷新</el-button>
                </div>
              </div>
            </template>

            <el-tree v-if="categoryTree.length" class="category-tree" :data="categoryTree" node-key="key"
              :props="treeProps"  highlight-current :expand-on-click-node="false"
              @node-click="handleTreeNodeClick">

              <template #default="{ data }">

                <div class="tree-node">
                  <span class="tree-node-label">{{ data.label }}</span>
                  <el-tag v-if="data.type === 'category'" size="small" type="info">
                    {{ data.usage_count ?? 0 }}
                  </el-tag>
                </div>
              </template>
            </el-tree>
            <el-empty v-else-if="!typesLoading && !catalogLoading" description="暂无类型或分类" />
          </el-card>
        </el-col>

        <el-col :xs="24" :md="16" :lg="17" class="right-col">
          <el-card shadow="never" class="panel-card" v-loading="abstractLoading">
            <template #header>
              <div class="right-header">
                <div>
                  <span class="panel-title">产品列表</span>
                  <!-- <span v-if="selectedCategoryName" class="panel-sub">
                    {{ currentTypeLabel }} / {{ selectedCategoryName }}
                  </span> -->
                </div>
                <div class="panel-actions">
                  <!-- <el-button
                    type="success"
                    plain
                    :disabled="!selectedCategoryName || !abstractRows.length"
                    :loading="uploadingAbstractProductImageBatch"
                    @click="triggerAbstractProductBatchImageUpload"
                  >
                    上传图片
                  </el-button> -->
                  <el-button type="primary" :disabled="!selectedCategoryName" @click="openAbstractDialog()">
                    新增
                  </el-button>
                </div>
            </div>
            </template>

            <el-empty v-if="!selectedCategoryName" description="请先在左侧选择二级分类" :image-size="96" />

            <template v-else>
              <el-table :data="abstractRows" stripe border row-key="id" empty-text="该分类下暂无抽象产品">
                <el-table-column label="图片" width="92" align="center">
                  <template #default="{ row }">
                    <div class="abstract-product-picture-cell">
                      <el-image
                        v-if="resolveAbstractProductPictureSrc(row.image_url)"
                        class="abstract-thumb"
                        :src="resolveAbstractProductPictureSrc(row.image_url)"
                        fit="cover"
                        :preview-src-list="[resolveAbstractProductPictureSrc(row.image_url)]"
                        preview-teleported
                      >
                        <template #error>
                          <div class="image-fallback">无图</div>
                        </template>
                      </el-image>
                      <div v-else class="image-fallback abstract-thumb">无图</div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="abstract_name" label="名称" min-width="180" show-overflow-tooltip />
                <el-table-column label="类型" min-width="180" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ getTypeLabel(row.product_type) }} / {{ row.category_name }}
                  </template>
                </el-table-column>
                <!-- <el-table-column prop="image_url" label="图片地址" min-width="260" show-overflow-tooltip /> -->
                <el-table-column prop="updated_at" label="更新时间" width="178">
                  <template #default="{ row }">{{ formatDateTime(row.updated_at || row.created_at) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="140" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link @click="openAbstractDialog(row)">编辑</el-button>
                    <el-button type="danger" link :loading="deletingAbstractId === row.id"
                      @click="handleDeleteAbstract(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </template>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <el-dialog v-model="typeDialogVisible" title="新增产品类型" width="min(520px, 94vw)" align-center append-to-body
      destroy-on-close>
      <el-form label-width="92px" class="category-dialog-form">
        <el-form-item label="类型键" required>
          <el-input v-model="newTypeKey" placeholder="数据库内存储的名称" maxlength="50" show-word-limit clearable
            @keyup.enter="handleCreateProductType" />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="newTypeLabel" placeholder="可选，如 化妆品" maxlength="100" clearable
            @keyup.enter="handleCreateProductType" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creatingType" :disabled="!newTypeKey.trim()"
          @click="handleCreateProductType">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="categoryDialogVisible" title="新增分类" width="min(520px, 94vw)" align-center append-to-body
      destroy-on-close>
      <el-form label-width="92px" class="category-dialog-form">
        <el-form-item label="产品类型" required>
          <el-select v-model="selectedProductType" filterable style="width: 100%">
            <el-option v-for="item in productTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类名称" required>
          <el-input v-model="newCategoryName" placeholder="" maxlength="100" show-word-limit clearable
            @keyup.enter="handleCreateCategory" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creatingCategory"
          :disabled="!selectedProductType || !newCategoryName.trim()" @click="handleCreateCategory">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="abstractEditDialogVisible"
      title="编辑产品"
      width="min(620px, 94vw)"
      align-center
      append-to-body
      draggable
      destroy-on-close
    >
        <el-form label-width="96px" class="abstract-form">
          <el-form-item label="名称" required>
            <el-input
              v-model="abstractForm.abstract_name"
              placeholder="产品名称"
              maxlength="150"
              show-word-limit
              clearable
            />
          </el-form-item>
          <el-form-item label="产品图片">
            <div class="abstract-edit-image-field">
              <el-input
                :model-value="abstractFormEditImageDisplay"
                placeholder="选择图片后显示本地路径，保存时上传"
                maxlength="1000"
                readonly
              />
              <el-button
                type="primary"
                plain
                :disabled="!canUploadAbstractEditForm"
                @click="triggerAbstractEditFormImageUpload"
              >
                {{ abstractFormEditImageDisplay ? '替换图片' : '选择图片' }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item label="产品类型" required>
            <el-select
              v-model="abstractForm.product_type"
              filterable
              style="width: 100%"
              @change="onAbstractFormTypeChange"
            >
              <el-option
                v-for="item in productTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="所属分类" required>
            <el-select v-model="abstractForm.category_name" filterable style="width: 100%">
              <el-option
                v-for="cat in formCategoryOptions"
                :key="cat.id || cat.category_name"
                :label="cat.category_name"
                :value="cat.category_name"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="abstractFormEditImagePreviewSrc" label="预览">
            <el-image
              class="abstract-preview"
              :src="abstractFormEditImagePreviewSrc"
              fit="cover"
            >
              <template #error>
                <div class="preview-fallback">图片无法预览</div>
              </template>
            </el-image>
          </el-form-item>
        </el-form>
      <template #footer>
        <el-button @click="abstractEditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingAbstract" @click="saveAbstractProduct">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="abstractCreateDialogVisible"
      title="新增产品"
      width="min(920px, 96vw)"
      align-center
      append-to-body
      draggable
      destroy-on-close
    >
        <el-form label-width="96px" class="abstract-form abstract-create-form">
          <el-row :gutter="16">
            <el-col :xs="24" :md="12">
              <el-form-item label="产品类型" required>
                <el-select
                  v-model="abstractCreateForm.product_type"
                  filterable
                  style="width: 100%"
                  @change="onAbstractCreateFormTypeChange"
                >
                  <el-option
                    v-for="item in productTypeOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="所属分类" required>
                <el-select v-model="abstractCreateForm.category_name" filterable style="width: 100%">
                  <el-option
                    v-for="cat in abstractCreateCategoryOptions"
                    :key="cat.id || cat.category_name"
                    :label="cat.category_name"
                    :value="cat.category_name"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>

        <div class="abstract-create-toolbar">
          <span class="abstract-create-tip">先填写产品名称，再上传图片，路径将自动填入</span>
          <div class="abstract-create-actions">
            <el-button @click="addAbstractCreateDraft">新增一行</el-button>
            <el-button
              type="success"
              plain
              :disabled="!abstractCreateDrafts.length"
              @click="triggerAbstractCreateBatchImageUpload"
            >
              上传图片
            </el-button>
          </div>
        </div>

        <el-table :data="abstractCreateDrafts" row-key="key" size="small" border max-height="420" empty-text="请点击「添加产品」">
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column label="产品名称" min-width="180">
            <template #default="{ row }">
              <el-input
                v-model="row.abstract_name"
                placeholder=""
                maxlength="150"
                clearable
              />
            </template>
          </el-table-column>
          <el-table-column label="图片" width="120" align="center">
            <template #default="{ row }">
              <div class="abstract-product-picture-cell">
                <el-image
                  v-if="resolveAbstractCreateDraftPictureSrc(row)"
                  :key="`${row.key}-${row.pendingPreviewUrl || row.image_url || ''}`"
                  class="abstract-thumb"
                  :src="resolveAbstractCreateDraftPictureSrc(row)"
                  fit="cover"
                  :preview-src-list="[resolveAbstractCreateDraftPictureSrc(row)]"
                  preview-teleported
                >
                  <template #error>
                    <div class="image-fallback">无图</div>
                  </template>
                </el-image>
                <div v-else class="image-fallback abstract-thumb">无图</div>
                <el-button
                  type="primary"
                  link
                  size="small"
                  :loading="row.uploading"
                  :disabled="!canUploadAbstractCreateDraft(row)"
                  @click="triggerAbstractCreateDraftImageUpload(row)"
                >
                  {{ row.image_url ? '替换' : '上传' }}
                </el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="图片路径" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="abstract-create-path">{{ row.image_url || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center" fixed="right">
            <template #default="{ $index }">
              <el-button type="danger" link @click="removeAbstractCreateDraft($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      <template #footer>
        <el-button @click="abstractCreateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingAbstract" @click="saveAbstractProduct">
          保存全部
        </el-button>
      </template>
    </el-dialog>
    <input
      ref="abstractProductImageSingleInputRef"
      type="file"
      class="hidden-file-input"
      accept="image/png,image/jpeg,image/webp,image/*"
      @change="handleAbstractProductImageSingleInputChange"
    >
    <input
      ref="abstractProductImageMultipleInputRef"
      type="file"
      class="hidden-file-input"
      multiple
      accept="image/png,image/jpeg,image/webp,image/*"
      @change="handleAbstractProductImageMultipleInputChange"
    >

    <el-dialog
      v-model="abstractProductImageUploadDialogVisible"
      width="760px"
      :title="abstractProductImageUploadDialogTitle"
      align-center
      append-to-body
      draggable
      :close-on-click-modal="false"
    >
      <el-alert type="success" :closable="false" show-icon class="mb-16">
        <template #title>
          当前已选中 {{ abstractProductImageFileRows.length }} 个图片
          <template v-if="abstractProductImageUploadMode === 'batch'">
            ，将按列表顺序匹配前 {{ abstractProductImageBatchMatchCount }} 个产品
          </template>
          <template v-else-if="abstractProductImageUploadMode === 'create-batch'">
            ，将按表格顺序匹配前 {{ abstractProductImageCreateBatchMatchCount }} 个已填名称的产品
          </template>
        </template>
      </el-alert>
      <el-descriptions :column="1" border size="small" class="mb-16 abstract-product-folder-desc">
        <template v-if="abstractProductImageUploadMode === 'edit-single' || abstractProductImageUploadMode === 'create-single'">
          <el-descriptions-item label="所属分类">
            {{ abstractProductImageFolderKeyPreview || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="目录名">{{ abstractProductImageFolderSlug }}</el-descriptions-item>
          <el-descriptions-item label="产品名称">
            {{ abstractProductImageNamePreview || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="保存为">
            {{ abstractProductImageFileNamePreview || '—' }}
          </el-descriptions-item>
        </template>
        <template v-else-if="abstractProductImageUploadMode === 'batch'">
          <el-descriptions-item label="当前分类">
            {{ abstractProductImageBatchCategoryPreview || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="列表产品数">{{ abstractRows.length }}</el-descriptions-item>
          <el-descriptions-item label="匹配说明">第 1 张图 → 列表第 1 个产品，以此类推</el-descriptions-item>
        </template>
        <template v-else-if="abstractProductImageUploadMode === 'create-batch'">
          <el-descriptions-item label="当前分类">
            {{ abstractCreateBatchCategoryPreview || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="表格行数">{{ abstractCreateDrafts.length }}</el-descriptions-item>
          <el-descriptions-item label="匹配说明">第 1 张图 → 表格第 1 行，以此类推（未填名称的行跳过）</el-descriptions-item>
        </template>
      </el-descriptions>
      <el-table :data="abstractProductImageFileRows" size="small" max-height="360">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column label="预览" width="88" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.previewUrl"
              class="abstract-upload-preview-thumb"
              :src="row.previewUrl"
              fit="cover"
              :preview-src-list="[row.previewUrl]"
              preview-teleported
            >
              <template #error>
                <div class="image-fallback">无图</div>
              </template>
            </el-image>
            <div v-else class="image-fallback abstract-upload-preview-thumb">无图</div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="原文件名" min-width="180" show-overflow-tooltip />
        <el-table-column
          v-if="abstractProductImageUploadMode === 'batch' || abstractProductImageUploadMode === 'create-batch'"
          prop="targetProductName"
          label="对应产品"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="targetName" label="保存为" width="120" />
        <el-table-column prop="targetPath" label="存储路径" min-width="240" show-overflow-tooltip />
        <el-table-column prop="sizeLabel" label="大小" width="96" align="right" />
      </el-table>
      <p v-if="abstractProductImageBatchOverflowCount > 0" class="abstract-upload-tip">
        已选图片比列表产品多 {{ abstractProductImageBatchOverflowCount }} 张，超出部分不会上传。
      </p>
      <p v-if="abstractProductImageCreateBatchOverflowCount > 0" class="abstract-upload-tip">
        已选图片比待新增产品多 {{ abstractProductImageCreateBatchOverflowCount }} 张，超出部分不会上传。
      </p>
      <template #footer>
        <el-button @click="clearAbstractProductImageSelection">清空</el-button>
        <el-button
          type="primary"
          :loading="uploadingAbstractProductImageBatch"
          @click="handleUploadAbstractProductImage"
        >
          {{ abstractProductImageUploadConfirmLabel }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import {
  createCategoryAbstractProduct,
  createCategoryCatalog,
  createCategoryCatalogProductType,
  deleteCategoryAbstractProduct,
  getCategoryCatalogProductTypes,
  listCategoryAbstractProducts,
  listCategoryCatalog,
  updateCategoryAbstractProduct,
  uploadCategoryAbstractProductImage,
  uploadCategoryAbstractProductImageOnly
} from '@/api/index'
import {
  buildAbstractCatalogProductPictureStoredPath,
  buildAbstractCatalogProductPictureTargetPath,
  formatProductPictureFileSize,
  normalizeProductPictureFolderWhitespace,
  resolveProductPictureSrc,
  sanitizeProductPictureFileName,
  sanitizeProductPictureFolderSlug
} from '@/utils/productPicture.js'

const treeProps = {
  label: 'label',
  children: 'children'
}

const typesLoading = ref(false)
const catalogLoading = ref(false)
const abstractLoading = ref(false)
const creatingType = ref(false)
const creatingCategory = ref(false)
const savingAbstract = ref(false)
const deletingAbstractId = ref(null)

const productTypeOptions = ref([])
const categoriesByType = reactive({})
const selectedProductType = ref('')
const selectedCategoryName = ref('')
const abstractRows = ref([])
const newTypeKey = ref('')
const newTypeLabel = ref('')
const newCategoryName = ref('')
const typeDialogVisible = ref(false)
const categoryDialogVisible = ref(false)
const abstractEditDialogVisible = ref(false)
const abstractCreateDialogVisible = ref(false)
const editingAbstractId = ref(null)
const abstractForm = reactive({
  product_type: '',
  category_name: '',
  abstract_name: '',
  image_url: ''
})
const abstractCreateForm = reactive({
  product_type: '',
  category_name: ''
})
const abstractCreateDrafts = ref([])

const abstractProductImageSingleInputRef = ref(null)
const abstractProductImageMultipleInputRef = ref(null)
const abstractProductImageUploadMode = ref('batch')
const abstractProductImageTargetRow = ref(null)
const abstractProductImageTargetDraft = ref(null)
const selectedAbstractProductImageFiles = ref([])
const abstractProductImageUploadDialogVisible = ref(false)
const uploadingAbstractProductImageBatch = ref(false)
const abstractEditPendingImageFile = ref(null)
const abstractEditLocalImagePath = ref('')
const abstractEditPendingImagePreview = ref('')

const currentTypeLabel = computed(() => getTypeLabel(selectedProductType.value))

const selectedCategoryRows = computed(() => categoriesByType[selectedProductType.value] || [])

const formCategoryOptions = computed(() => categoriesByType[abstractForm.product_type] || [])

const abstractCreateCategoryOptions = computed(() => categoriesByType[abstractCreateForm.product_type] || [])

const abstractCreateNamedDrafts = computed(() =>
  abstractCreateDrafts.value.filter((item) => normalizeProductPictureFolderWhitespace(item.abstract_name))
)

const abstractProductImageUploadDialogTitle = computed(() => {
  if (abstractProductImageUploadMode.value === 'batch') return '顺序上传产品图'
  if (abstractProductImageUploadMode.value === 'create-batch') return '批量选图（新增产品）'
  if (abstractProductImageUploadMode.value === 'edit-single') return '上传产品图（编辑）'
  return '上传产品图'
})

const abstractProductImageUploadConfirmLabel = computed(() => {
  if (abstractProductImageUploadMode.value === 'batch') return '开始顺序上传'
  if (abstractProductImageUploadMode.value === 'create-batch') return '上传并填入路径'
  if (abstractProductImageUploadMode.value === 'create-single') return '上传并填入'
  if (abstractProductImageUploadMode.value === 'edit-single') return '确认选图'
  return '上传并保存'
})

const canUploadAbstractEditForm = computed(() =>
  Boolean(
    editingAbstractId.value
      && abstractForm.product_type
      && abstractForm.category_name
      && normalizeProductPictureFolderWhitespace(abstractForm.abstract_name)
  )
)

const abstractFormEditImageDisplay = computed(() => {
  if (abstractEditPendingImageFile.value) {
    const targetPath = buildAbstractCatalogProductPictureStoredPath(
      abstractForm.category_name,
      abstractForm.abstract_name
    )
    if (targetPath) return targetPath
  }
  return abstractEditLocalImagePath.value || abstractForm.image_url || ''
})

const abstractFormEditImagePreviewSrc = computed(() => {
  if (abstractEditPendingImagePreview.value) {
    return abstractEditPendingImagePreview.value
  }
  return resolveAbstractProductPictureSrc(abstractForm.image_url)
})

const abstractCreateBatchCategoryPreview = computed(() => {
  const typeLabel = getTypeLabel(abstractCreateForm.product_type) || abstractCreateForm.product_type
  const categoryName = abstractCreateForm.category_name
  if (!typeLabel || !categoryName) return ''
  return `${typeLabel} / ${categoryName}`
})

function resolveAbstractProductPictureSrc(raw) {
  return resolveProductPictureSrc(raw)
}

function resolveAbstractCreateDraftTargetImagePath(draft) {
  const categoryName = abstractCreateForm.category_name
  const abstractName = normalizeProductPictureFolderWhitespace(draft?.abstract_name)
  if (!categoryName || !abstractName) return ''
  return buildAbstractCatalogProductPictureStoredPath(categoryName, abstractName)
}

function syncAbstractCreateDraftImagePath(draft) {
  if (!draft) return
  draft.image_url = resolveAbstractCreateDraftTargetImagePath(draft)
}

function syncAllAbstractCreateDraftImagePaths() {
  for (const draft of abstractCreateDrafts.value) {
    syncAbstractCreateDraftImagePath(draft)
  }
}

function revokeAbstractCreateDraftPendingPreview(draft) {
  if (!draft?.pendingPreviewUrl) return
  URL.revokeObjectURL(draft.pendingPreviewUrl)
  draft.pendingPreviewUrl = ''
}

function clearAbstractCreateDraftPendingImage(draft) {
  revokeAbstractCreateDraftPendingPreview(draft)
  if (draft) {
    draft.pendingImageFile = null
  }
}

function setAbstractCreateDraftPendingImage(draft, fileItem) {
  if (!draft || !fileItem?.file) return
  clearAbstractCreateDraftPendingImage(draft)
  draft.pendingImageFile = fileItem
  draft.pendingPreviewUrl = URL.createObjectURL(fileItem.file)
}

function syncAbstractCreateDraftPendingImagesFromFiles(files) {
  for (const draft of abstractCreateDrafts.value) {
    clearAbstractCreateDraftPendingImage(draft)
  }
  const list = Array.isArray(files) ? files : []
  list.forEach((item, index) => {
    const draft = abstractCreateDrafts.value[index]
    if (!draft) return
    if (!normalizeProductPictureFolderWhitespace(draft.abstract_name)) return
    setAbstractCreateDraftPendingImage(draft, item)
  })
}

function resolveAbstractCreateDraftPictureSrc(draft) {
  if (draft?.pendingPreviewUrl) {
    return draft.pendingPreviewUrl
  }
  return resolveAbstractProductPictureSrc(draft?.image_url)
}

function revokeAbstractProductImageFilePreviews(files) {
  for (const item of files || []) {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
      item.previewUrl = ''
    }
  }
}

function assignAbstractProductImageFiles(files) {
  revokeAbstractProductImageFilePreviews(selectedAbstractProductImageFiles.value)
  selectedAbstractProductImageFiles.value = (Array.isArray(files) ? files : []).map((item) => ({
    ...item,
    previewUrl: item.file ? URL.createObjectURL(item.file) : ''
  }))
}

function revokeAbstractEditPendingImagePreview() {
  if (abstractEditPendingImagePreview.value) {
    URL.revokeObjectURL(abstractEditPendingImagePreview.value)
    abstractEditPendingImagePreview.value = ''
  }
}

function clearAbstractEditPendingImage() {
  revokeAbstractEditPendingImagePreview()
  abstractEditPendingImageFile.value = null
  abstractEditLocalImagePath.value = ''
}

function resolveLocalImageFilePath(file) {
  if (!file) return ''
  return String(file.path || file.webkitRelativePath || file.name || '').trim()
}

function setAbstractEditPendingImage(fileItem) {
  clearAbstractEditPendingImage()
  abstractEditPendingImageFile.value = fileItem
  const targetPath = buildAbstractCatalogProductPictureStoredPath(
    abstractForm.category_name,
    abstractForm.abstract_name
  )
  abstractEditLocalImagePath.value = targetPath || resolveLocalImageFilePath(fileItem.file)
  abstractEditPendingImagePreview.value = URL.createObjectURL(fileItem.file)
}

async function openAbstractProductImagePicker(multiple = false) {
  await nextTick()
  const input = multiple ? abstractProductImageMultipleInputRef.value : abstractProductImageSingleInputRef.value
  if (!input) return
  input.value = ''
  input.click()
}

function triggerAbstractEditFormImageUpload() {
  if (!canUploadAbstractEditForm.value) {
    ElMessage.warning('请先填写产品名称、产品类型和所属分类')
    return
  }
  abstractProductImageUploadMode.value = 'edit-single'
  abstractProductImageTargetRow.value = null
  abstractProductImageTargetDraft.value = null
  openAbstractProductImagePicker(false)
}

function resolveAbstractProductImageCategoryKeyFromRow(row) {
  if (!row) return ''
  return normalizeProductPictureFolderWhitespace(row.category_name)
}

function resolveAbstractProductImageCategoryKeyFromForm(form) {
  if (!form) return ''
  return resolveAbstractProductImageCategoryKeyFromRow(form)
}

function resolveAbstractProductImageCategoryKeyFromDraft(draft) {
  if (!draft) return ''
  return normalizeProductPictureFolderWhitespace(abstractCreateForm.category_name)
}

function resolveAbstractProductImageFileNameFromRow(row) {
  if (!row) return ''
  return sanitizeProductPictureFileName(row.abstract_name)
}

function resolveAbstractProductImageFileNameFromForm(form) {
  if (!form) return ''
  return sanitizeProductPictureFileName(form.abstract_name)
}

function resolveAbstractProductImageFileNameFromDraft(draft) {
  if (!draft) return ''
  return sanitizeProductPictureFileName(draft.abstract_name)
}

function buildAbstractProductImagePreviewRow(item, categoryName, abstractName, extra = {}) {
  const target = buildAbstractCatalogProductPictureTargetPath(categoryName, abstractName)
  return {
    ...item,
    ...extra,
    targetName: target.targetName,
    targetPath: target.targetPath,
    sizeLabel: formatProductPictureFileSize(item.size)
  }
}

function createEmptyAbstractDraft() {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    abstract_name: '',
    image_url: '',
    pendingPreviewUrl: '',
    pendingImageFile: null,
    uploading: false
  }
}

function resetAbstractCreateDrafts(count = 3) {
  abstractCreateDrafts.value = Array.from({ length: count }, () => createEmptyAbstractDraft())
}

function addAbstractCreateDraft() {
  abstractCreateDrafts.value.push(createEmptyAbstractDraft())
}

function removeAbstractCreateDraft(index) {
  const draft = abstractCreateDrafts.value[index]
  clearAbstractCreateDraftPendingImage(draft)
  abstractCreateDrafts.value.splice(index, 1)
}

function canUploadAbstractCreateDraft(draft) {
  return Boolean(
    abstractCreateForm.product_type
      && abstractCreateForm.category_name
      && normalizeProductPictureFolderWhitespace(draft?.abstract_name)
  )
}

const abstractProductImageFolderKeyPreview = computed(() => {
  if (abstractProductImageUploadMode.value === 'create-single') {
    return resolveAbstractProductImageCategoryKeyFromDraft(abstractProductImageTargetDraft.value)
  }
  if (abstractProductImageUploadMode.value === 'edit-single') {
    return resolveAbstractProductImageCategoryKeyFromForm(abstractForm)
  }
  return resolveAbstractProductImageCategoryKeyFromRow(abstractProductImageTargetRow.value)
})

const abstractProductImageFolderSlug = computed(() =>
  sanitizeProductPictureFolderSlug(abstractProductImageFolderKeyPreview.value)
)

const abstractProductImageNamePreview = computed(() => {
  if (abstractProductImageUploadMode.value === 'create-single') {
    return normalizeProductPictureFolderWhitespace(abstractProductImageTargetDraft.value?.abstract_name)
  }
  if (abstractProductImageUploadMode.value === 'edit-single') {
    return normalizeProductPictureFolderWhitespace(abstractForm.abstract_name)
  }
  return normalizeProductPictureFolderWhitespace(abstractProductImageTargetRow.value?.abstract_name)
})

const abstractProductImageFileNamePreview = computed(() => {
  if (abstractProductImageUploadMode.value === 'create-single') {
    return resolveAbstractProductImageFileNameFromDraft(abstractProductImageTargetDraft.value)
  }
  if (abstractProductImageUploadMode.value === 'edit-single') {
    return resolveAbstractProductImageFileNameFromForm(abstractForm)
  }
  return resolveAbstractProductImageFileNameFromRow(abstractProductImageTargetRow.value)
})

const abstractProductImageBatchCategoryPreview = computed(() => {
  const typeLabel = getTypeLabel(selectedProductType.value) || selectedProductType.value
  const categoryName = selectedCategoryName.value
  if (!typeLabel || !categoryName) return ''
  return `${typeLabel} / ${categoryName}`
})

const abstractProductImageBatchMatchCount = computed(() => {
  if (abstractProductImageUploadMode.value !== 'batch') return 0
  return Math.min(selectedAbstractProductImageFiles.value.length, abstractRows.value.length)
})

const abstractProductImageBatchOverflowCount = computed(() => {
  if (abstractProductImageUploadMode.value !== 'batch') return 0
  return Math.max(selectedAbstractProductImageFiles.value.length - abstractRows.value.length, 0)
})

const abstractProductImageCreateBatchMatchCount = computed(() => {
  if (abstractProductImageUploadMode.value !== 'create-batch') return 0
  const draftCount = abstractCreateDrafts.value.length
  return Math.min(selectedAbstractProductImageFiles.value.length, draftCount)
})

const abstractProductImageCreateBatchOverflowCount = computed(() => {
  if (abstractProductImageUploadMode.value !== 'create-batch') return 0
  return Math.max(selectedAbstractProductImageFiles.value.length - abstractCreateDrafts.value.length, 0)
})

function buildAbstractProductImagePreviewRows() {
  const files = selectedAbstractProductImageFiles.value

  if (abstractProductImageUploadMode.value === 'create-batch') {
    return files.map((item, index) => {
      const draft = abstractCreateDrafts.value[index]
      const hasName = draft && normalizeProductPictureFolderWhitespace(draft.abstract_name)
      const categoryName = abstractCreateForm.category_name
      return buildAbstractProductImagePreviewRow(item, categoryName, hasName ? draft.abstract_name : '', {
        targetProductName: hasName
          ? draft.abstract_name
          : draft
            ? '（未填名称，跳过）'
            : '（无对应行，跳过）',
        targetDraft: hasName ? draft : null
      })
    })
  }

  if (abstractProductImageUploadMode.value === 'batch') {
    return files.map((item, index) => {
      const product = abstractRows.value[index]
      return buildAbstractProductImagePreviewRow(
        item,
        product?.category_name || selectedCategoryName.value,
        product?.abstract_name || '',
        {
          targetProductName: product?.abstract_name || '（无对应产品，跳过）',
          targetRow: product || null
        }
      )
    })
  }

  if (abstractProductImageUploadMode.value === 'create-single') {
    const draft = abstractProductImageTargetDraft.value
    return files.map((item) => buildAbstractProductImagePreviewRow(
      item,
      abstractCreateForm.category_name,
      draft?.abstract_name || '',
      { targetDraft: draft }
    ))
  }

  if (abstractProductImageUploadMode.value === 'edit-single') {
    return files.map((item) => buildAbstractProductImagePreviewRow(
      item,
      abstractForm.category_name,
      abstractForm.abstract_name
    ))
  }

  const targetRow = abstractProductImageTargetRow.value
  return files.map((item) => buildAbstractProductImagePreviewRow(
    item,
    targetRow?.category_name || '',
    targetRow?.abstract_name || '',
    { targetRow }
  ))
}

const abstractProductImageFileRows = computed(() => buildAbstractProductImagePreviewRows())



const categoryTree = computed(() => productTypeOptions.value.map((type) => ({
  key: `type:${type.value}`,
  type: 'type',
  product_type: type.value,
  label: type.label,
  children: (categoriesByType[type.value] || []).map((cat) => ({
    key: `cat:${type.value}:${cat.category_name}`,
    type: 'category',
    product_type: type.value,
    label: cat.category_name,
    category_name: cat.category_name,
    usage_count: cat.usage_count
  }))
})))

function getTypeLabel(value) {
  const opt = productTypeOptions.value.find((o) => o.value === value)
  return opt?.label || value || ''
}

function formatDateTime(value) {
  if (value == null || value === '') return '-'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openTypeDialog() {
  newTypeKey.value = ''
  newTypeLabel.value = ''
  typeDialogVisible.value = true
}

function openCategoryDialog() {
  if (!selectedProductType.value && productTypeOptions.value.length) {
    selectedProductType.value = productTypeOptions.value[0].value
  }
  newCategoryName.value = ''
  categoryDialogVisible.value = true
}

async function loadProductTypes() {
  typesLoading.value = true
  try {
    const res = await getCategoryCatalogProductTypes()
    productTypeOptions.value = res.data || []
    if (!selectedProductType.value && productTypeOptions.value.length) {
      selectedProductType.value = productTypeOptions.value[0].value
    }
  } finally {
    typesLoading.value = false
  }
}

async function loadCatalogForType(productType) {
  if (!productType) return []
  catalogLoading.value = true
  try {
    const res = await listCategoryCatalog({ product_type: productType })
    categoriesByType[productType] = res.data || []
    return categoriesByType[productType]
  } finally {
    catalogLoading.value = false
  }
}

async function ensureCatalogForType(productType) {
  if (!productType) return []
  if (categoriesByType[productType]) return categoriesByType[productType]
  return loadCatalogForType(productType)
}

async function loadAbstractProducts() {
  if (!selectedProductType.value || !selectedCategoryName.value) {
    abstractRows.value = []
    return
  }
  abstractLoading.value = true
  try {
    const res = await listCategoryAbstractProducts({
      product_type: selectedProductType.value,
      category_name: selectedCategoryName.value
    })
    abstractRows.value = res.data || []
  } finally {
    abstractLoading.value = false
  }
}

async function reloadTree() {
  await loadProductTypes()
  await Promise.all(productTypeOptions.value.map((item) => loadCatalogForType(item.value)))
  if (!selectedCategoryName.value && selectedProductType.value) {
    const rows = categoriesByType[selectedProductType.value] || []
    selectedCategoryName.value = rows[0]?.category_name || ''
  }
  if (selectedProductType.value && selectedCategoryName.value) {
    await loadAbstractProducts()
  }
}

async function handleTreeNodeClick(data) {
  if (data.type === 'type') {
    selectedProductType.value = data.product_type
    await ensureCatalogForType(data.product_type)
    const rows = categoriesByType[data.product_type] || []
    selectedCategoryName.value = rows[0]?.category_name || ''
    return
  }
  selectedProductType.value = data.product_type
  selectedCategoryName.value = data.category_name
}

async function handleCreateProductType() {
  const key = newTypeKey.value.trim()
  if (!key) return
  creatingType.value = true
  try {
    const res = await createCategoryCatalogProductType({
      product_type: key,
      display_label: newTypeLabel.value.trim() || undefined
    })
    newTypeKey.value = ''
    newTypeLabel.value = ''
    await loadProductTypes()
    const v = res?.data?.value
    if (v) {
      selectedProductType.value = v
      selectedCategoryName.value = ''
      await loadCatalogForType(v)
    }
    typeDialogVisible.value = false
    ElMessage.success('已新增产品类型')
  } catch {
    /* request interceptor already shows errors */
  } finally {
    creatingType.value = false
  }
}

async function handleCreateCategory() {
  const name = newCategoryName.value.trim()
  if (!selectedProductType.value || !name) return
  creatingCategory.value = true
  try {
    await createCategoryCatalog({
      product_type: selectedProductType.value,
      category_name: name
    })
    newCategoryName.value = ''
    await loadCatalogForType(selectedProductType.value)
    selectedCategoryName.value = name
    categoryDialogVisible.value = false
    ElMessage.success('已新增分类')
  } catch {
    /* request interceptor already shows errors */
  } finally {
    creatingCategory.value = false
  }
}

async function onAbstractFormTypeChange(value) {
  await ensureCatalogForType(value)
  const rows = categoriesByType[value] || []
  if (!rows.some((cat) => cat.category_name === abstractForm.category_name)) {
    abstractForm.category_name = rows[0]?.category_name || ''
  }
}

async function onAbstractCreateFormTypeChange(value) {
  await ensureCatalogForType(value)
  const rows = categoriesByType[value] || []
  if (!rows.some((cat) => cat.category_name === abstractCreateForm.category_name)) {
    abstractCreateForm.category_name = rows[0]?.category_name || ''
  }
}

async function openAbstractDialog(row = null) {
  if (row?.id) {
    editingAbstractId.value = row.id
    clearAbstractEditPendingImage()
    abstractForm.product_type = row.product_type || selectedProductType.value || productTypeOptions.value[0]?.value || ''
    await ensureCatalogForType(abstractForm.product_type)
    abstractForm.category_name = row.category_name || selectedCategoryName.value || formCategoryOptions.value[0]?.category_name || ''
    abstractForm.abstract_name = row.abstract_name || ''
    abstractForm.image_url = row.image_url || ''
    abstractEditDialogVisible.value = true
    return
  }

  editingAbstractId.value = null
  abstractCreateForm.product_type = selectedProductType.value || productTypeOptions.value[0]?.value || ''
  await ensureCatalogForType(abstractCreateForm.product_type)
  abstractCreateForm.category_name = selectedCategoryName.value || abstractCreateCategoryOptions.value[0]?.category_name || ''
  resetAbstractCreateDrafts(1)
  abstractCreateDialogVisible.value = true
}

function triggerAbstractCreateDraftImageUpload(draft) {
  if (!canUploadAbstractCreateDraft(draft)) {
    ElMessage.warning('请先填写产品类型、所属分类与产品名称')
    return
  }
  abstractProductImageUploadMode.value = 'create-single'
  abstractProductImageTargetDraft.value = draft
  abstractProductImageTargetRow.value = null
  openAbstractProductImagePicker(false)
}

function triggerAbstractCreateBatchImageUpload() {
  if (!abstractCreateForm.product_type || !abstractCreateForm.category_name) {
    ElMessage.warning('请先选择产品类型和所属分类')
    return
  }
  if (!abstractCreateDrafts.value.length) {
    ElMessage.warning('请先添加产品行')
    return
  }
  if (!abstractCreateNamedDrafts.value.length) {
    ElMessage.warning('请先在表格中填写至少一个产品名称')
    return
  }
  abstractProductImageUploadMode.value = 'create-batch'
  abstractProductImageTargetDraft.value = null
  abstractProductImageTargetRow.value = null
  openAbstractProductImagePicker(true)
}

function triggerAbstractProductBatchImageUpload() {
  if (!abstractRows.value.length) {
    ElMessage.warning('当前分类下暂无产品，无法顺序上传')
    return
  }
  abstractProductImageUploadMode.value = 'batch'
  abstractProductImageTargetRow.value = null
  openAbstractProductImagePicker(true)
}

function collectAbstractProductImageFiles(fileList) {
  const next = []
  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i]
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
  return next
}

function handleAbstractProductImageMultipleInputChange(event) {
  const input = event.target
  const files = input?.files ? Array.from(input.files) : []
  if (!files.length) {
    if (input) input.value = ''
    return
  }

  if (abstractProductImageUploadMode.value !== 'batch' && abstractProductImageUploadMode.value !== 'create-batch') {
    if (input) input.value = ''
    return
  }

  const next = collectAbstractProductImageFiles(files)
  if (input) input.value = ''
  if (!next.length) {
    ElMessage.warning('所选内容中未包含可导入的图片文件')
    return
  }
  assignAbstractProductImageFiles(next)
  if (abstractProductImageUploadMode.value === 'create-batch') {
    syncAbstractCreateDraftPendingImagesFromFiles(selectedAbstractProductImageFiles.value)
  }
  abstractProductImageUploadDialogVisible.value = true
}

function resetAbstractProductImageUploadState() {
  revokeAbstractProductImageFilePreviews(selectedAbstractProductImageFiles.value)
  selectedAbstractProductImageFiles.value = []
  abstractProductImageTargetDraft.value = null
  abstractProductImageUploadMode.value = 'batch'
}

async function applyAbstractProductImageCreateSingle(draft, fileItem) {
  setAbstractCreateDraftPendingImage(draft, fileItem)
  try {
    await uploadAbstractProductImageForDraft(draft, fileItem)
    resetAbstractProductImageUploadState()
  } catch (error) {
    clearAbstractCreateDraftPendingImage(draft)
    console.error('上传新增产品图片失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '上传失败')
  }
}

function applyAbstractProductImageEditSingle(fileItem) {
  setAbstractEditPendingImage(fileItem)
  resetAbstractProductImageUploadState()
  ElMessage.success('已选中图片，保存时将上传')
}

function handleAbstractProductImageSingleInputChange(event) {
  const input = event.target
  const file = input?.files?.[0]
  if (input) input.value = ''

  if (!file) return

  if (abstractProductImageUploadMode.value === 'create-single') {
    const draft = abstractProductImageTargetDraft.value
    if (!draft || !canUploadAbstractCreateDraft(draft)) {
      ElMessage.warning('请先填写产品类型、所属分类与产品名称')
      abstractProductImageTargetDraft.value = null
      return
    }
    const next = collectAbstractProductImageFiles([file])
    if (!next.length) {
      ElMessage.warning('请选择 PNG、JPEG 或 WebP 图片')
      return
    }
    applyAbstractProductImageCreateSingle(draft, next[0])
    return
  }

  if (abstractProductImageUploadMode.value === 'edit-single') {
    if (!canUploadAbstractEditForm.value) {
      ElMessage.warning('请先填写产品名称、产品类型和所属分类')
      return
    }
    const next = collectAbstractProductImageFiles([file])
    if (!next.length) {
      ElMessage.warning('请选择 PNG、JPEG 或 WebP 图片')
      return
    }
    applyAbstractProductImageEditSingle(next[0])
  }
}

function clearAbstractProductImageSelection() {
  if (abstractProductImageTargetDraft.value) {
    clearAbstractCreateDraftPendingImage(abstractProductImageTargetDraft.value)
  }
  revokeAbstractProductImageFilePreviews(selectedAbstractProductImageFiles.value)
  selectedAbstractProductImageFiles.value = []
  abstractProductImageUploadDialogVisible.value = false
  abstractProductImageTargetRow.value = null
  abstractProductImageTargetDraft.value = null
  abstractProductImageUploadMode.value = 'batch'
}

function buildCategoryAbstractProductImageFormData(categoryName, abstractName, fileItem) {
  const formData = new FormData()
  const fileName = sanitizeProductPictureFileName(abstractName)
  formData.append('files', fileItem.file, fileItem.name || fileItem.file?.name || fileName || 'image.png')
  formData.append('folder_key', categoryName)
  formData.append('category_name', categoryName)
  formData.append('file_name', abstractName)
  formData.append('abstract_name', abstractName)
  return formData
}

function extractUploadedAbstractProductImageUrl(res) {
  return String(
    res?.data?.image_url
    || res?.data?.picture_url
    || res?.data?.items?.[0]?.image_url
    || res?.data?.items?.[0]?.picture_url
    || ''
  ).trim()
}

async function uploadAbstractProductImageFile(categoryName, abstractName, fileItem, abstractProductId = null) {
  const formData = buildCategoryAbstractProductImageFormData(categoryName, abstractName, fileItem)

  if (abstractProductId != null && Number(abstractProductId) > 0) {
    const res = await uploadCategoryAbstractProductImage(abstractProductId, formData)
    const pictureUrlStored = extractUploadedAbstractProductImageUrl(res)
    if (!pictureUrlStored) {
      throw new Error(`产品「${abstractName}」上传成功但未返回图片路径`)
    }
    return pictureUrlStored
  }

  const res = await uploadCategoryAbstractProductImageOnly(formData)
  const pictureUrlStored = extractUploadedAbstractProductImageUrl(res)
  if (!pictureUrlStored) {
    throw new Error(`产品「${abstractName}」上传成功但未返回图片路径`)
  }
  return pictureUrlStored
}

function markAbstractCreateDraftUploadedImage(draft, fileItem, pictureUrlStored) {
  if (!draft) return
  draft.image_url = pictureUrlStored
  draft.pendingImageFile = null
  if (fileItem?.file) {
    revokeAbstractCreateDraftPendingPreview(draft)
    draft.pendingPreviewUrl = URL.createObjectURL(fileItem.file)
  }
}

async function uploadAbstractProductImageForDraft(draft, fileItem) {
  const categoryName = resolveAbstractProductImageCategoryKeyFromDraft(draft)
  const abstractName = normalizeProductPictureFolderWhitespace(draft?.abstract_name)
  if (!categoryName || !abstractName) {
    throw new Error(`产品「${draft.abstract_name}」信息不完整，无法上传`)
  }

  draft.uploading = true
  try {
    const pictureUrlStored = await uploadAbstractProductImageFile(categoryName, abstractName, fileItem)
    markAbstractCreateDraftUploadedImage(draft, fileItem, pictureUrlStored)
    return pictureUrlStored
  } finally {
    draft.uploading = false
  }
}

async function uploadAbstractProductImageForRow(targetRow, fileItem) {
  const categoryName = resolveAbstractProductImageCategoryKeyFromRow(targetRow)
  const abstractName = normalizeProductPictureFolderWhitespace(targetRow?.abstract_name)
  if (!categoryName || !abstractName) {
    throw new Error(`产品「${targetRow.abstract_name}」信息不完整，无法上传`)
  }

  const pictureUrlStored = await uploadAbstractProductImageFile(
    categoryName,
    abstractName,
    fileItem,
    targetRow.id
  )

  if (Number(editingAbstractId.value) === Number(targetRow.id)) {
    abstractForm.image_url = pictureUrlStored
  }

  return pictureUrlStored
}

async function handleUploadAbstractProductImage() {
  if (uploadingAbstractProductImageBatch.value) return

  const previewRows = abstractProductImageFileRows.value
  if (!previewRows.length) {
    ElMessage.warning('请先选择图片文件')
    return
  }

  if (abstractProductImageUploadMode.value === 'create-batch') {
    const pairs = previewRows.filter((item) => item.targetDraft)
    if (!pairs.length) {
      ElMessage.warning('没有可匹配的产品，请先填写产品名称')
      return
    }

    const overflow = abstractProductImageCreateBatchOverflowCount.value
    const confirmMessage = overflow > 0
      ? `将按表格顺序为 ${pairs.length} 个产品上传图片并填入路径，另有 ${overflow} 张图片无对应产品将被忽略。`
      : `将按表格顺序为 ${pairs.length} 个产品上传图片，并自动填入路径。`

    try {
      await ElMessageBox.confirm(confirmMessage, '确认批量选图', {
        type: 'success',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      })
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      throw error
    }

    uploadingAbstractProductImageBatch.value = true
    try {
      let successCount = 0
      for (const item of pairs) {
        await uploadAbstractProductImageForDraft(item.targetDraft, item)
        successCount += 1
      }
      revokeAbstractProductImageFilePreviews(selectedAbstractProductImageFiles.value)
      selectedAbstractProductImageFiles.value = []
      abstractProductImageUploadDialogVisible.value = false
      abstractProductImageTargetDraft.value = null
      abstractProductImageUploadMode.value = 'batch'
      ElMessage.success(`已为 ${successCount} 个产品填入图片路径`)
    } catch (error) {
      console.error('批量上传新增产品图片失败:', error)
      ElMessage.error(error?.response?.data?.message || error?.message || '批量上传失败')
    } finally {
      uploadingAbstractProductImageBatch.value = false
    }
    return
  }

  if (abstractProductImageUploadMode.value === 'batch') {
    const pairs = previewRows.filter((item) => item.targetRow?.id)
    if (!pairs.length) {
      ElMessage.warning('没有可匹配的产品')
      return
    }

    const overflow = abstractProductImageBatchOverflowCount.value
    const confirmMessage = overflow > 0
      ? `将按列表顺序为 ${pairs.length} 个产品上传图片，另有 ${overflow} 张图片无对应产品将被忽略。`
      : `将按列表顺序为 ${pairs.length} 个产品上传图片，并自动保存路径。`

    try {
      await ElMessageBox.confirm(confirmMessage, '确认顺序上传', {
        type: 'success',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      })
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      throw error
    }

    uploadingAbstractProductImageBatch.value = true
    try {
      let successCount = 0
      for (const item of pairs) {
        await uploadAbstractProductImageForRow(item.targetRow, item)
        successCount += 1
      }
      revokeAbstractProductImageFilePreviews(selectedAbstractProductImageFiles.value)
      selectedAbstractProductImageFiles.value = []
      abstractProductImageUploadDialogVisible.value = false
      abstractProductImageTargetRow.value = null
      abstractProductImageUploadMode.value = 'batch'
      await loadAbstractProducts()
      ElMessage.success(`已顺序上传并保存 ${successCount} 张产品图`)
    } catch (error) {
      console.error('顺序上传抽象产品图片失败:', error)
      ElMessage.error(error?.response?.data?.message || error?.message || '顺序上传失败')
      await loadAbstractProducts()
    } finally {
      uploadingAbstractProductImageBatch.value = false
    }
    return
  }
}

async function saveAbstractProduct() {
  if (editingAbstractId.value) {
    const name = abstractForm.abstract_name.trim()
    if (!abstractForm.product_type || !abstractForm.category_name || !name) {
      ElMessage.warning('请填写名称、产品类型和所属分类')
      return
    }
    savingAbstract.value = true
    try {
      let imageUrl = String(abstractForm.image_url || '').trim()
      if (abstractEditPendingImageFile.value) {
        imageUrl = await uploadAbstractProductImageFile(
          abstractForm.category_name,
          name,
          abstractEditPendingImageFile.value,
          editingAbstractId.value
        )
      }
      const payload = {
        product_type: abstractForm.product_type,
        category_name: abstractForm.category_name,
        abstract_name: name,
        image_url: imageUrl
      }
      await updateCategoryAbstractProduct(editingAbstractId.value, payload)
      clearAbstractEditPendingImage()
      abstractForm.image_url = imageUrl
      ElMessage.success('已更新抽象产品')
      abstractEditDialogVisible.value = false
      selectedProductType.value = payload.product_type
      selectedCategoryName.value = payload.category_name
      await loadAbstractProducts()
    } catch {
      /* request interceptor already shows errors */
    } finally {
      savingAbstract.value = false
    }
    return
  }

  const productType = abstractCreateForm.product_type
  const categoryName = abstractCreateForm.category_name
  if (!productType || !categoryName) {
    ElMessage.warning('请选择产品类型和所属分类')
    return
  }

  const drafts = abstractCreateDrafts.value.filter((item) => {
    item.abstract_name = String(item.abstract_name || '').trim()
    return item.abstract_name
  })

  if (!drafts.length) {
    ElMessage.warning('请至少填写一个产品名称')
    return
  }

  savingAbstract.value = true
  try {
    for (const draft of drafts) {
      let imageUrl = String(draft.image_url || '').trim()
      if (draft.pendingImageFile) {
        imageUrl = await uploadAbstractProductImageFile(
          categoryName,
          draft.abstract_name,
          draft.pendingImageFile
        )
        clearAbstractCreateDraftPendingImage(draft)
      }
      await createCategoryAbstractProduct({
        product_type: productType,
        category_name: categoryName,
        abstract_name: draft.abstract_name,
        image_url: imageUrl
      })
    }
    revokeAbstractProductImageFilePreviews(selectedAbstractProductImageFiles.value)
    selectedAbstractProductImageFiles.value = []
    abstractProductImageUploadDialogVisible.value = false
    abstractCreateDialogVisible.value = false
    selectedProductType.value = productType
    selectedCategoryName.value = categoryName
    await loadAbstractProducts()
    ElMessage.success(`已新增 ${drafts.length} 个抽象产品`)
  } catch {
    /* request interceptor already shows errors */
  } finally {
    savingAbstract.value = false
  }
}

async function handleDeleteAbstract(row) {
  try {
    await ElMessageBox.confirm(`确定删除抽象产品「${row.abstract_name}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }

  deletingAbstractId.value = row.id
  try {
    await deleteCategoryAbstractProduct(row.id)
    ElMessage.success('已删除')
    await loadAbstractProducts()
  } catch {
    /* request interceptor already shows errors */
  } finally {
    deletingAbstractId.value = null
  }
}

watch(
  () => selectedProductType.value,
  async (pt, oldPt) => {
    if (!pt || pt === oldPt) return
    await ensureCatalogForType(pt)
    const rows = categoriesByType[pt] || []
    if (!rows.some((cat) => cat.category_name === selectedCategoryName.value)) {
      selectedCategoryName.value = rows[0]?.category_name || ''
    }
  }
)

watch(
  () => abstractEditDialogVisible.value,
  (visible) => {
    if (visible) return
    clearAbstractEditPendingImage()
    revokeAbstractProductImageFilePreviews(selectedAbstractProductImageFiles.value)
    selectedAbstractProductImageFiles.value = []
    abstractProductImageUploadDialogVisible.value = false
    editingAbstractId.value = null
  }
)

watch(
  () => abstractCreateDialogVisible.value,
  (visible) => {
    if (visible) return
    for (const draft of abstractCreateDrafts.value) {
      clearAbstractCreateDraftPendingImage(draft)
    }
    revokeAbstractProductImageFilePreviews(selectedAbstractProductImageFiles.value)
    selectedAbstractProductImageFiles.value = []
    abstractProductImageUploadDialogVisible.value = false
  }
)

watch(
  () => [
    abstractCreateForm.category_name,
    abstractCreateDrafts.value.map((draft) => draft.abstract_name)
  ],
  () => {
    if (!abstractCreateDialogVisible.value) return
    syncAllAbstractCreateDraftImagePaths()
  }
)

watch(
  () => [selectedProductType.value, selectedCategoryName.value],
  () => {
    loadAbstractProducts()
  }
)

onMounted(async () => {
  await reloadTree()
})
</script>

<style scoped>
.category-manage {
  max-width: 1400px;
  margin: 0 auto;
}

.page-card {
  border-radius: 18px;
}

.layout-row {
  align-items: stretch;
}

.panel-card {
  min-height: 360px;
}

.panel-header,
.right-header {
  display: flex;
  align-items: center;
  /* justify-content: flex-end; */
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  font-weight: 600;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.panel-sub {
  margin-left: 10px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.type-toolbar,
.category-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.category-toolbar {
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.category-tree {
  margin-top: 8px;
}

.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding-right: 8px;
}

.tree-node-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.abstract-product-picture-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.abstract-thumb,
.abstract-preview,
.abstract-upload-preview-thumb {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.abstract-preview {
  width: 96px;
  height: 96px;
}

.image-fallback,
.preview-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  background: var(--el-fill-color-light);
}

.abstract-form {
  padding-top: 8px;
}

.abstract-create-form {
  margin-bottom: 8px;
}

.abstract-create-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.abstract-create-tip {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.abstract-create-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.abstract-create-path {
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.abstract-edit-image-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.abstract-edit-image-field .el-input {
  flex: 1;
  min-width: 0;
}

.category-dialog-form {
  padding-top: 8px;
}

.abstract-product-folder-desc {
  margin-bottom: 16px;
}

.hidden-file-input {
  display: none;
}

.mb-16 {
  margin-bottom: 16px;
}

.abstract-upload-tip {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--el-color-warning);
}

.left-col,
.right-col {
  margin-bottom: 16px;
}

@media (min-width: 768px) {

  .left-col,
  .right-col {
    margin-bottom: 0;
  }
}
</style>
