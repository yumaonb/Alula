<template>
  <!-- 随机一言组件 -->
  <div class="quote-body">
    <template v-if="ready">
      <p class="quote-text">{{ text }}</p>
      <p class="quote-source">{{ source }}</p>
    </template>
    <template v-else>
      <div class="quote-text">
        <div class="skeleton" style="width:100%;height:1em;margin-bottom:8px"></div>
        <div class="skeleton" style="width:72%;height:1em"></div>
      </div>
      <div class="quote-source" style="text-align:right">
        <div class="skeleton" style="display:inline-block;width:40%;height:0.7em"></div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { getRandomQuote } from "../../data/quotes";

const ready = ref(false);
const text = ref("");
const source = ref("");

function loadQuote() {
  const quote = getRandomQuote();
  text.value = quote.text;
  source.value = quote.fromWho
    ? `${quote.fromWho}「${quote.from}」`
    : quote.from || "";
  ready.value = true;
}

onMounted(loadQuote);
</script>

<style scoped>
.quote-body {
  display: flex;
  flex-direction: column;
  height: 90px;
  justify-content: center;
  overflow: hidden;
}
.quote-text {
  font-size: 0.95rem;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 12px;
  font-style: italic;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.quote-source {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  text-align: right;
}
@media (min-width: 1024px) {
  .quote-text { font-size: 1rem; }
}
</style>