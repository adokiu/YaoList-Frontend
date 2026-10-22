// Polyfill for Object.hasOwn (ES2022) - 兼容旧版浏览器
if (!(Object as any).hasOwn) {
  (Object as any).hasOwn = function(obj: object, prop: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  }
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.scss'
import './styles/theme-transition.scss'
import './styles/admin/fonts.css'
import './styles/admin/tokens.css'
import './styles/admin/ambient.css'
import './styles/admin/manage-page.css'
import './styles/admin/page-shell.css'
import './i18n'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
