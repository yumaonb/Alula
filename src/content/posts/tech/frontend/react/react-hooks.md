---
title: "React Hooks 实战"
date: 2024-12-01
description: "React Hooks 的常用用法和最佳实践。"
image: ""
tags: ["React", "Hooks", "前端"]
pinned: false
---

## useState

```jsx
const [count, setCount] = useState(0);
```

## useEffect

```jsx
useEffect(() => {
  document.title = `点击了 ${count} 次`;
}, [count]);
```

## 自定义 Hook

```jsx
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  return { count, increment, decrement };
}
```