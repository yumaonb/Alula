<template>
  <!-- 随机一言组件 -->
  <div class="quote-body">
    <p class="quote-text">{{ text }}</p>
    <p class="quote-source">{{ source }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { getRandomQuote } from "../data/quotes";

const text = ref("加载中...");
const source = ref("");

function loadQuote() {
  const quote = getRandomQuote();
  text.value = quote.text;
  source.value = quote.fromWho
    ? `${quote.fromWho}「${quote.from}」`
    : quote.from || "";
}

onMounted(loadQuote);
</script>

<style scoped>
.quote-body {
  display: flex;
  flex-direction: column;
}
.quote-text {
  font-size: 0.95rem;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 12px;
  padding-top: 8px;
  font-style: italic;
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