import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

export function escapeFoodBodyHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function countFoodBodyNeedleHits(text, needle) {
  if (!needle) return 0
  const t = text || ''
  const lower = t.toLowerCase()
  const nl = needle.toLowerCase()
  const len = nl.length
  if (!len) return 0
  let cnt = 0
  let i = 0
  while (i < lower.length) {
    const j = lower.indexOf(nl, i)
    if (j === -1) break
    cnt++
    i = j + len
  }
  return cnt
}

export function buildFoodBodySearchHighlightedHtml(text, needle, activeMatchIndex) {
  const full = text || ''
  if (!needle) return escapeFoodBodyHtml(full)
  const lower = full.toLowerCase()
  const nl = needle.toLowerCase()
  const len = nl.length
  let out = ''
  let i = 0
  let matchIdx = 0
  while (i < full.length) {
    const j = lower.indexOf(nl, i)
    if (j === -1) {
      out += escapeFoodBodyHtml(full.slice(i))
      break
    }
    out += escapeFoodBodyHtml(full.slice(i, j))
    const slice = full.slice(j, j + len)
    const active = matchIdx === activeMatchIndex
    const cls = active ? 'food-body-search-hit food-body-search-hit--active' : 'food-body-search-hit'
    out += `<mark class="${cls}">${escapeFoodBodyHtml(slice)}</mark>`
    matchIdx++
    i = j + len
  }
  return out
}

export function scrollFoodBodySearchHit(preEl) {
  nextTick(() => {
    const root = preEl?.value ?? preEl
    if (!root) return
    const hit = root.querySelector('.food-body-search-hit--active')
    hit?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  })
}

export function runFoodBodySearchGoNext(opts) {
  const { rawQueryRef, matchTotalGetter, activeIndexSetter, getActiveIndex } = opts
  const q = String(rawQueryRef.value || '').trim()
  if (!q) {
    ElMessage.warning('请先输入搜索关键字')
    return
  }
  const total = matchTotalGetter()
  if (!total) {
    ElMessage.warning('未找到匹配内容')
    return
  }
  activeIndexSetter((getActiveIndex() + 1) % total)
}

export function runFoodBodySearchGoPrev(opts) {
  const {
    rawQueryRef,
    matchTotalGetter,
    activeIndexSetter,
    getActiveIndex
  } = opts
  const q = String(rawQueryRef.value || '').trim()
  if (!q) {
    ElMessage.warning('请先输入搜索关键字')
    return
  }
  const total = matchTotalGetter()
  if (!total) {
    ElMessage.warning('未找到匹配内容')
    return
  }
  activeIndexSetter((getActiveIndex() - 1 + total) % total)
}

/** @param {import('vue').Ref<string>} fullTextRef */
export function useFoodBodyTextSearch(fullTextRef) {
  const searchQuery = ref('')
  const activeIndex = ref(0)
  const preRef = ref(null)

  const trimmed = computed(() => String(searchQuery.value || '').trim())

  const matchTotal = computed(() =>
    countFoodBodyNeedleHits(fullTextRef.value || '', trimmed.value)
  )

  const highlightedDisplayHtml = computed(() => {
    const raw = fullTextRef.value || ''
    if (!trimmed.value) return escapeFoodBodyHtml(raw)
    return buildFoodBodySearchHighlightedHtml(raw, trimmed.value, activeIndex.value)
  })

  function goNext() {
    runFoodBodySearchGoNext({
      rawQueryRef: searchQuery,
      matchTotalGetter: () => matchTotal.value,
      activeIndexSetter: (n) => {
        activeIndex.value = n
      },
      getActiveIndex: () => activeIndex.value
    })
  }

  function goPrev() {
    runFoodBodySearchGoPrev({
      rawQueryRef: searchQuery,
      matchTotalGetter: () => matchTotal.value,
      activeIndexSetter: (n) => {
        activeIndex.value = n
      },
      getActiveIndex: () => activeIndex.value
    })
  }

  function reset() {
    searchQuery.value = ''
    activeIndex.value = 0
  }

  watch(trimmed, () => {
    activeIndex.value = 0
  })

  watch(matchTotal, (total) => {
    if (!total) activeIndex.value = 0
    else if (activeIndex.value >= total) activeIndex.value = total - 1
  })

  watch([activeIndex, highlightedDisplayHtml], () => {
    scrollFoodBodySearchHit(preRef)
  })

  return {
    searchQuery,
    activeIndex,
    preRef,
    trimmed,
    matchTotal,
    highlightedDisplayHtml,
    goNext,
    goPrev,
    reset
  }
}
