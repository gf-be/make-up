<template>
  <div class="food-body-search-controls">
    <el-input
      :model-value="modelValue"
      clearable
      size="small"
      :placeholder="placeholder"
      class="food-body-search-input"
      @update:model-value="$emit('update:modelValue', $event)"
      @keyup.enter="$emit('enter-next')"
    />
    <el-button-group @mousedown.prevent>
      <el-button size="small" :disabled="!matchTotal" @click="$emit('prev')">
        上一处
      </el-button>
      <el-button size="small" :disabled="!matchTotal" @click="$emit('next')">
        下一处
      </el-button>
    </el-button-group>
    <span v-if="showMeta" class="food-body-search-meta">
      <template v-if="matchTotal">{{ activeIndexDisplay }} / {{ matchTotal }}</template>
      <template v-else>无匹配</template>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  matchTotal: {
    type: Number,
    default: 0
  },
  /** 当前高亮序号，0-based */
  activeIndex: {
    type: Number,
    default: 0
  },
  /** 是否有可搜索正文（空则不显示计数行） */
  hasSourceText: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: '搜索正文关键字'
  }
})

defineEmits(['update:modelValue', 'next', 'prev', 'enter-next'])

const trimmed = computed(() => String(props.modelValue || '').trim())

const showMeta = computed(() => props.hasSourceText && Boolean(trimmed.value))

const activeIndexDisplay = computed(() => props.activeIndex + 1)
</script>

<style scoped>
.food-body-search-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.food-body-search-input {
  width: min(240px, 100%);
}

.food-body-search-meta {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}
</style>
