# 样式文件组织结构

本项目采用SCSS进行样式管理，使用BEM命名规范，便于团队协作和维护。

## 目录结构

```
styles/
├── variables.scss          # 全局变量（颜色、间距、字体等）
├── mixins.scss            # 混合宏（可复用的样式片段）
├── global.scss            # 全局样式（重置、基础元素样式）
├── components/            # 组件样式
│   ├── dashboard.scss     # Dashboard布局样式
│   ├── login.scss         # 登录页面样式
│   └── ...
└── pages/                 # 页面样式
    ├── mounts.scss        # 挂载点管理页面
    ├── users.scss         # 用户管理页面
    └── ...
```

## 命名规范

### BEM (Block Element Modifier)

- **Block（块）**: 独立的组件，如 `.login`, `.dashboard`
- **Element（元素）**: 块的组成部分，使用 `__` 连接，如 `.login__form`, `.dashboard__nav`
- **Modifier（修饰符）**: 块或元素的状态/变体，使用 `--` 连接，如 `.button--primary`, `.nav-item--active`

### 示例

```scss
// Block
.mounts {
  // Element
  &__header {
    display: flex;
  }
  
  &__card {
    padding: 16px;
    
    // Modifier
    &--highlighted {
      background: yellow;
    }
  }
  
  &__button {
    // Element Modifier
    &--primary {
      background: blue;
    }
  }
}
```

生成的CSS:
```css
.mounts__header { display: flex; }
.mounts__card { padding: 16px; }
.mounts__card--highlighted { background: yellow; }
.mounts__button--primary { background: blue; }
```

## 使用变量和混合宏

### 引入方式

```scss
@use '../mixins' as *;

.my-component {
  color: $text-primary;
  @include button-primary;
}
```

### 常用变量

```scss
// 颜色
$bg-primary, $bg-secondary, $bg-tertiary
$text-primary, $text-secondary, $text-tertiary
$accent-color, $accent-hover

// 间距
$spacing-xs, $spacing-sm, $spacing-md, $spacing-lg, $spacing-xl

// 圆角
$radius-sm, $radius-md, $radius-lg

// 阴影
$shadow-sm, $shadow-md, $shadow-lg
```

### 常用混合宏

```scss
@include button-primary;      // 主按钮样式
@include button-secondary;    // 次要按钮样式
@include icon-button;         // 图标按钮样式
@include input-base;          // 输入框基础样式
@include card;                // 卡片样式
@include flex-center;         // Flex居中
@include text-ellipsis;       // 单行文本截断
@include custom-scrollbar;    // 自定义滚动条
```

## 团队协作规范

1. **新增组件样式**
   - 组件样式放在 `styles/components/` 目录
   - 页面样式放在 `styles/pages/` 目录
   - 使用BEM命名，避免样式冲突

2. **修改全局样式**
   - 修改 `variables.scss` 需要团队讨论
   - 新增混合宏需要添加注释说明用途

3. **样式复用**
   - 优先使用混合宏而非复制代码
   - 相似样式提取到mixins.scss

4. **响应式设计**
   - 使用提供的响应式混合宏
   - 移动端优先原则

5. **代码审查要点**
   - 是否使用了变量而非硬编码颜色
   - 是否遵循BEM命名规范
   - 是否有重复代码可以提取为混合宏
   - 是否考虑了响应式布局

## 注意事项

- ⚠️ 不要在组件中使用内联样式（除非是动态计算的值）
- ⚠️ 不要使用 `!important`（除非绝对必要）
- ⚠️ 避免深层嵌套（最多3层）
- ✅ 使用语义化的类名
- ✅ 保持样式文件简洁，单个文件不超过300行
