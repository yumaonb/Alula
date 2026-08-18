<script setup>
// 手机端汉堡菜单控制的代码，按需加载
import { onMounted, onUnmounted } from 'vue'

const OPEN = 'is-open'

function getEls() {
  return {
    btn: document.querySelector('.hamburger-btn'),
    dropdown: document.getElementById('mobile-dropdown'),
    overlay: document.querySelector('.mobile-overlay'),
  }
}

function toggle() {
  const { btn, dropdown, overlay } = getEls()
  if (!btn) return
  const opening = !btn.classList.contains(OPEN)
  btn.classList.toggle(OPEN, opening)
  dropdown?.classList.toggle(OPEN, opening)
  overlay?.classList.toggle(OPEN, opening)
  btn.setAttribute('aria-expanded', opening)
  document.body.style.overflow = opening ? 'hidden' : ''
}

function closeIfOpen() {
  const { btn } = getEls()
  if (btn?.classList.contains(OPEN)) {
    document.activeElement?.blur()
    toggle()
  }
}

function onClick(e) {
  if (e.target.closest('.hamburger-btn') || e.target.closest('.mobile-overlay')) {
    toggle()
  } else if (e.target.closest('.nav-logo')) {
    closeIfOpen()
  } else if (e.target.closest('.mobile-link')) {
    closeIfOpen()
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') closeIfOpen()
}

function onSwupReplace() {
  closeIfOpen()
}

onMounted(() => {
  document.addEventListener('click', onClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('swup:contentReplaced', onSwupReplace)
})

onUnmounted(() => {
  document.removeEventListener('click', onClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('swup:contentReplaced', onSwupReplace)
})
</script>