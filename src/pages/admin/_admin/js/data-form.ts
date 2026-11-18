// data-form.ts — 后台站点数据页结构化表单（13 页共用，改动进待提交队列）
// 用法：由 pages.ts 的 boot() 分发：import { initDataForm } from './data-form'
//
// 页面根元素带 data-admin-page（对应 data-schemas.ts 的键）；表单按字段声明渲染，
// 配置值经 ts-literal.ts 解析与写回，文件里未声明的字段原样保留。
// 多文件页（profile-base）在 #admin-data-files 渲染文件切换，同一时刻只展示一个文件。

import { DATA_PAGE_SPECS, type DataField, type DataFileSpec } from './data-schemas';
import { deepEqual, extractExport, replaceLiteral } from './ts-literal';
import { getFileTextOrNull } from './github';
import { toast } from './shell';
import { adminStore } from './store';

/** 连接生命周期：连上后跑一次、断开再连会重跑，由 pages.ts 注入共用同一实现 */
type WhenConnected = (run: () => Promise<void>) => () => void;
type Cleanup = () => void;
type Path = (string | number)[];
/** 除 group 外都带 key，取值与写回都只认这一类 */
type KeyedField = Extract<DataField, { key: string }>;
type ScalarField = Extract<
  DataField,
  { kind: 'text' | 'textarea' | 'number' | 'date' | 'toggle' | 'select' | 'tags' }
>;

interface FileRuntime {
  spec: DataFileSpec;
  /** 基线文本：远端原文或已暂存内容；暂存成功后推进为暂存内容 */
  source: string;
  /** 基线解析出的各导出值，用于判断「有没有未暂存修改」 */
  original: Record<string, unknown>;
  /** 表单实际编辑的副本，提交时整体写回 */
  working: Record<string, unknown>;
  /** 读取或解析失败的原因；有值时整页只展示这条提示 */
  error: string | null;
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function el<T extends keyof HTMLElementTagNameMap>(
  tag: T,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[T] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 顶层导出条目：group 只是视觉分组，它的子字段直接对应导出 */
function exportEntries(schema: DataField[]): Array<{ name: string; field: KeyedField }> {
  const out: Array<{ name: string; field: KeyedField }> = [];
  for (const field of schema) {
    if (field.kind === 'group') out.push(...exportEntries(field.fields));
    else out.push({ name: field.key, field });
  }
  return out;
}

function getByPath(value: unknown, path: Path): unknown {
  let cur: unknown = value;
  for (const step of path) cur = (cur as Record<string | number, unknown> | undefined)?.[step];
  return cur;
}

function setByPath(value: unknown, path: Path, next: unknown): void {
  let cur = value as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const step = path[i];
    let sub = cur[step];
    // 文件里删掉过这个字段时表单会渲染空值，编辑后按空容器重建，不让写入抛错
    if (sub === null || typeof sub !== 'object') sub = typeof step === 'number' ? [] : {};
    cur[step] = sub;
    cur = sub as Record<string | number, unknown>;
  }
  cur[path[path.length - 1]] = next;
}

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${what}不是对象，文件可能改过结构`);
  }
  return value as Record<string, unknown>;
}

/* ---- 保存前的整理与校验：可选字段留空则摘掉，结构对不上则报错 ---- */

/** 单个顶层导出：可选文本留空就摘掉，其余按类型校验结构 */
function prepareEntry(field: KeyedField, holder: Record<string, unknown>): void {
  const value = holder[field.key];
  if ((field.kind === 'text' || field.kind === 'textarea') && field.optional && value === '') {
    delete holder[field.key];
    return;
  }
  prepareValue(field, value);
}

function prepareFields(fields: DataField[], holder: Record<string, unknown>): void {
  for (const field of fields) {
    if (field.kind === 'group') {
      prepareFields(field.fields, holder);
      continue;
    }
    prepareEntry(field, holder);
  }
}

function prepareValue(field: DataField, value: unknown): void {
  if (field.kind === 'object') {
    prepareFields(field.fields, asObject(value, `字段「${field.key}」`));
    return;
  }
  if (field.kind === 'record') {
    const obj = asObject(value, `字段「${field.key}」`);
    for (const key of Object.keys(obj)) {
      prepareFields(field.fields, asObject(obj[key], `「${key}」条目`));
    }
    return;
  }
  if (field.kind === 'list') {
    if (!Array.isArray(value)) throw new Error(`字段「${field.key}」不是数组，文件可能改过结构`);
    value.forEach((item, index) =>
      prepareFields(field.fields, asObject(item, `第 ${index + 1} 条`)),
    );
    return;
  }
  if (field.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`「${field.label}」需要是数字`);
    }
  }
}

function recordKeysOk(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.every((k) => k.trim() !== '') && new Set(keys).size === keys.length;
}

/* ---- 控件取值 ---- */

function convertValue(
  field: DataField,
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): unknown {
  if (field.kind === 'toggle') return 'checked' in input ? input.checked : false;
  if (field.kind === 'number') {
    const raw = input.value.trim();
    if (raw === '') return NaN;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }
  if (field.kind === 'tags') {
    return input.value
      .split(/[,，]\s*/)
      .map((s) => s.trim())
      .filter((s) => s !== '');
  }
  return input.value;
}

/* ---- 渲染 ---- */

/** 渲染函数需要回调到控制器的两个动作：整体重渲染（增删条目 / 改键名）、刷新状态徽标（值变化） */
interface RenderHost {
  render: () => void;
  markDirty: () => void;
}

function renderListOrRecord(
  file: FileRuntime,
  field: Extract<DataField, { kind: 'list' | 'record' }>,
  value: unknown,
  path: Path,
  container: HTMLElement,
  host: RenderHost,
): void {
  const wrap = el('div', 'field');
  wrap.appendChild(el('label', 'field-label', field.label ?? field.title ?? field.key));
  if (field.hint) wrap.appendChild(el('p', 'hint', field.hint));
  const list = el('div', 'form-list');

  const items: Array<{ id: string | number; data: unknown }> =
    field.kind === 'list'
      ? (Array.isArray(value) ? value : []).map((item, index) => ({ id: index, data: item }))
      : value !== null && typeof value === 'object'
        ? Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ id: k, data: v }))
        : [];

  if (items.length === 0) list.appendChild(el('p', 'empty', '还没有条目'));
  items.forEach((item, index) =>
    list.appendChild(renderItem(file, field, item, [...path, field.key, item.id], index, host)),
  );

  const add = el('button', 'btn btn--dashed btn--block', field.addLabel ?? '添加条目');
  add.type = 'button';
  add.addEventListener('click', () => {
    if (field.kind === 'list') {
      const arr = getByPath(file.working, [...path, field.key]);
      const listArr = Array.isArray(arr) ? arr : [];
      listArr.push({});
      setByPath(file.working, [...path, field.key], listArr);
    } else {
      const obj = getByPath(file.working, [...path, field.key]);
      const record =
        obj !== null && typeof obj === 'object' ? (obj as Record<string, unknown>) : {};
      if (Object.hasOwn(record, '')) {
        toast('还有一条新条目没填键名，先填上或直接删掉它', 'error');
        return;
      }
      record[''] = {};
      setByPath(file.working, [...path, field.key], record);
    }
    host.render();
  });

  wrap.appendChild(list);
  wrap.appendChild(add);
  container.appendChild(wrap);
}

function itemTitle(fields: DataField[], item: unknown, index: number): string {
  if (item !== null && typeof item === 'object') {
    for (const f of fields) {
      if (f.kind === 'text' || f.kind === 'textarea') {
        const v = (item as Record<string, unknown>)[f.key];
        if (typeof v === 'string' && v.trim() !== '') {
          return v.length > 20 ? v.slice(0, 20) + '…' : v;
        }
      }
    }
  }
  return `第 ${index + 1} 条`;
}

function renderItem(
  file: FileRuntime,
  field: Extract<DataField, { kind: 'list' | 'record' }>,
  item: { id: string | number; data: unknown },
  path: Path,
  index: number,
  host: RenderHost,
): HTMLElement {
  const box = el('div', 'form-item');
  const head = el('div', 'form-item-head');
  head.appendChild(
    el(
      'span',
      'form-item-title',
      field.kind === 'record' && item.id === ''
        ? '新条目（请填键名）'
        : String(item.id) !== ''
          ? String(item.id)
          : itemTitle(field.fields, item.data, index),
    ),
  );
  const remove = el('button', 'btn btn--ghost btn--sm', '删除');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    const parentPath = path.slice(0, -1);
    if (field.kind === 'list') {
      const arr = getByPath(file.working, parentPath) as unknown[];
      arr.splice(Number(item.id), 1);
    } else {
      const obj = getByPath(file.working, parentPath) as Record<string, unknown>;
      delete obj[String(item.id)];
    }
    host.render();
  });
  head.appendChild(remove);
  box.appendChild(head);

  const body = el('div', 'form-item-body');
  if (field.kind === 'record') {
    const keyField = el('div', 'field');
    keyField.appendChild(el('label', 'field-label', '键名'));
    const keyInput = document.createElement('input');
    keyInput.className = 'input';
    keyInput.value = String(item.id);
    const commitKey = () => {
      const next = keyInput.value.trim();
      if (next === String(item.id)) return;
      const obj = getByPath(file.working, path.slice(0, -1)) as Record<string, unknown>;
      if (next === '' || Object.hasOwn(obj, next)) {
        toast(next === '' ? '键名不能为空' : '这个键名已经存在', 'error');
        keyInput.value = String(item.id);
        return;
      }
      obj[next] = obj[String(item.id)];
      delete obj[String(item.id)];
      host.render();
    };
    keyInput.addEventListener('change', commitKey);
    keyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitKey();
    });
    keyField.appendChild(keyInput);
    body.appendChild(keyField);
  }
  renderFields(file, field.fields, item.data ?? {}, path, body, host);
  box.appendChild(body);
  return box;
}

function renderScalar(
  file: FileRuntime,
  field: ScalarField,
  value: unknown,
  path: Path,
  container: HTMLElement,
  host: RenderHost,
): void {
  const valuePath = [...path, field.key];
  const current = getByPath(value, valuePath);

  if (field.kind === 'toggle') {
    const wrap = el('div', 'field-toggle');
    const text = el('div', 'field-toggle-text');
    text.appendChild(el('span', 'field-label', field.label));
    if (field.hint) text.appendChild(el('p', 'hint', field.hint));
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'switch';
    input.checked = current === true;
    input.addEventListener('change', () => {
      setByPath(file.working, valuePath, input.checked);
      host.markDirty();
    });
    wrap.appendChild(text);
    wrap.appendChild(input);
    container.appendChild(wrap);
    return;
  }

  const wrap = el('div', 'field');
  wrap.appendChild(el('label', 'field-label', field.label));

  const onInput = (input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    setByPath(file.working, valuePath, convertValue(field, input));
    host.markDirty();
  };

  let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  switch (field.kind) {
    case 'textarea': {
      control = document.createElement('textarea');
      control.className = 'input';
      control.rows = field.rows ?? 3;
      control.value = typeof current === 'string' ? current : '';
      control.placeholder = field.placeholder ?? '';
      control.addEventListener('input', () => onInput(control));
      break;
    }
    case 'select': {
      control = document.createElement('select');
      control.className = 'input';
      for (const opt of field.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        control.appendChild(option);
      }
      // 文件里出现了选项外的值：照样显示，不让旧值被悄悄改掉
      if (typeof current === 'string' && !field.options.some((o) => o.value === current)) {
        const option = document.createElement('option');
        option.value = current;
        option.textContent = current;
        control.appendChild(option);
      }
      if (typeof current === 'string') control.value = current;
      control.addEventListener('change', () => onInput(control));
      break;
    }
    default: {
      control = document.createElement('input');
      control.className = 'input';
      if (field.kind === 'date') {
        control.type = 'date';
        control.value = typeof current === 'string' ? current : '';
      } else if (field.kind === 'number') {
        control.type = 'number';
        if (field.min !== undefined) control.min = String(field.min);
        if (field.max !== undefined) control.max = String(field.max);
        if (field.step !== undefined) control.step = String(field.step);
        control.value = typeof current === 'number' ? String(current) : '';
      } else if (field.kind === 'tags') {
        control.type = 'text';
        control.placeholder = field.placeholder ?? '';
        control.value = Array.isArray(current) ? current.join(', ') : '';
      } else {
        control.type = 'text';
        control.placeholder = field.placeholder ?? '';
        control.value = typeof current === 'string' ? current : '';
      }
      control.addEventListener('input', () => onInput(control));
      break;
    }
  }

  wrap.appendChild(control);
  if (field.hint) wrap.appendChild(el('p', 'hint', field.hint));
  container.appendChild(wrap);
}

function renderFields(
  file: FileRuntime,
  fields: DataField[],
  value: unknown,
  path: Path,
  container: HTMLElement,
  host: RenderHost,
): void {
  for (const field of fields) {
    if (field.kind === 'group' || field.kind === 'object') {
      const box = el('div', 'form-group');
      if (field.title) box.appendChild(el('h4', 'form-group-title', field.title));
      const sub = field.kind === 'object' ? getByPath(value, [...path, field.key]) : value;
      const subPath = field.kind === 'object' ? [...path, field.key] : path;
      renderFields(file, field.fields, sub ?? {}, subPath, box, host);
      container.appendChild(box);
      continue;
    }
    if (field.kind === 'list' || field.kind === 'record') {
      renderListOrRecord(file, field, value, path, container, host);
      continue;
    }
    renderScalar(file, field, value, path, container, host);
  }
}

/* ---- 控制器 ---- */

export function initDataForm(whenConnected: WhenConnected): () => void {
  const cleanups: Cleanup[] = [];
  const name = document.querySelector('[data-admin-page]')?.getAttribute('data-admin-page') ?? '';
  const page = DATA_PAGE_SPECS[name];
  const formEl = byId('admin-data-form');
  const fileList = byId<HTMLUListElement>('admin-data-files');

  if (!page || !formEl) return () => {};

  let files: FileRuntime[] = [];
  let current = 0;
  const host: RenderHost = {
    render,
    markDirty: refreshStateUi,
  };

  function isFileDirty(f: FileRuntime): boolean {
    return Object.keys(f.working).some((k) => !deepEqual(f.working[k], f.original[k]));
  }

  function isFileDirtyByPath(path: string): boolean {
    const f = files.find((x) => x.spec.path === path);
    return f ? isFileDirty(f) : false;
  }

  function refreshStateUi(): void {
    const f = files[current];
    if (!f) return;
    const chip = byId('admin-data-state');
    if (chip) {
      const staged = adminStore.changeOf(f.spec.path);
      chip.textContent = staged ? '已暂存' : isFileDirty(f) ? '有未暂存修改' : '未暂存';
      chip.className = staged ? 'badge is-staged' : isFileDirty(f) ? 'badge is-dirty' : 'badge';
    }
    for (const row of fileList?.querySelectorAll<HTMLLIElement>('.file-row') ?? []) {
      const path = row.dataset.filePath ?? '';
      const rowBadge = row.querySelector<HTMLElement>('.badge');
      if (!rowBadge) continue;
      const staged = adminStore.changeOf(path);
      rowBadge.textContent = staged ? '已暂存' : isFileDirtyByPath(path) ? '未暂存修改' : '未暂存';
      rowBadge.className = staged
        ? 'badge is-staged'
        : isFileDirtyByPath(path)
          ? 'badge is-dirty'
          : 'badge';
    }
  }

  function renderFileList(): void {
    if (!fileList) return;
    fileList.textContent = '';
    files.forEach((f, index) => {
      const li = el('li', 'file-row');
      li.dataset.filePath = f.spec.path;
      if (index === current) li.classList.add('is-active');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'file-link';
      button.textContent = f.spec.title;
      button.addEventListener('click', () => {
        if (
          index !== current &&
          isFileDirty(files[current]) &&
          !window.confirm('当前文件有未暂存的修改，切换会丢弃它们，确定？')
        ) {
          return;
        }
        current = index;
        render();
      });
      li.appendChild(button);
      li.appendChild(el('span', 'badge', '未暂存'));
      fileList.appendChild(li);
    });
  }

  function render(): void {
    if (!formEl) return;
    formEl.textContent = '';
    const f = files[current];
    if (!f) return;

    if (f.error) {
      const box = el('div', 'form-error');
      box.textContent = `${f.error}。可以稍后重试；如果文件被手动改过，需要先让文件恢复成表单认识的结构。`;
      formEl.appendChild(box);
      renderFileList();
      refreshStateUi();
      return;
    }

    const bar = el('div', 'admin-editor-bar');
    bar.appendChild(el('span', 'admin-editor-path', f.spec.path));
    const status = el('span', 'status', '已加载');
    status.id = 'admin-data-status';
    bar.appendChild(status);
    formEl.appendChild(bar);

    const fieldsEl = el('div', 'admin-data-fields');
    renderFields(f, f.spec.schema, f.working, [], fieldsEl, host);
    formEl.appendChild(fieldsEl);

    const actions = el('div', 'admin-editor-actions');
    const save = el('button', 'btn btn--primary', '暂存改动');
    save.type = 'button';
    save.id = 'admin-data-save';
    save.addEventListener('click', saveCurrent);
    actions.appendChild(save);
    formEl.appendChild(actions);

    renderFileList();
    refreshStateUi();
  }

  async function loadFile(spec: DataFileSpec): Promise<FileRuntime> {
    const staged = adminStore.changeOf(spec.path);
    let source: string | null;
    if (staged) {
      source = staged.content;
    } else {
      const remote = await getFileTextOrNull(spec.path, adminStore.state.config.branch);
      source = remote?.text ?? null;
    }
    if (source === null) {
      return { spec, source: '', original: {}, working: {}, error: `${spec.path} 不存在` };
    }
    const original: Record<string, unknown> = {};
    const working: Record<string, unknown> = {};
    for (const { name } of exportEntries(spec.schema)) {
      const ex = extractExport(source, name);
      if (!ex) {
        return {
          spec,
          source,
          original,
          working,
          error: `读不到 ${spec.path} 里的「${name}」`,
        };
      }
      original[name] = ex.value;
      working[name] = structuredClone(ex.value);
    }
    return { spec, source, original, working, error: null };
  }

  function saveCurrent(): void {
    if (adminStore.state.committing) return;
    const f = files[current];
    if (!f || f.error !== null || Object.keys(f.working).length === 0) {
      toast('表单还没加载出来，连接 GitHub 后稍等片刻', 'error');
      return;
    }
    for (const { name, field } of exportEntries(f.spec.schema)) {
      const value = f.working[name];
      if (field.kind === 'record' && !recordKeysOk(value)) {
        toast('有键名为空或重复，改好再暂存', 'error');
        return;
      }
      try {
        prepareEntry(field, f.working);
      } catch (err) {
        toast(`暂存失败：${errorMessage(err)}`, 'error');
        return;
      }
    }
    let out = f.source;
    for (const { name } of exportEntries(f.spec.schema)) {
      const next = replaceLiteral(out, name, f.working[name]);
      if (next === null) {
        toast(`写回「${name}」失败：文件结构在加载后变了`, 'error');
        return;
      }
      out = next;
    }
    adminStore.stage(f.spec.path, out, f.source);
    f.source = out;
    f.original = structuredClone(f.working);
    toast('已暂存，记得在右下角一次性提交');
    render();
  }

  function onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveCurrent();
    }
  }

  document.addEventListener('keydown', onKeydown);
  cleanups.push(() => document.removeEventListener('keydown', onKeydown));
  cleanups.push(adminStore.subscribe(refreshStateUi));

  cleanups.push(
    whenConnected(async () => {
      files = await Promise.all(page.files.map(loadFile));
      current = 0;
      render();
    }),
  );

  return () => cleanups.forEach((fn) => fn());
}
