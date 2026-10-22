import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import './SearchInput.css'

interface SearchInputProps {
  value: string
  placeholder?: string
  debounceMs?: number
  onChange: (value: string) => void
}

export function SearchInput({ value, placeholder = '搜索...', debounceMs = 300, onChange }: SearchInputProps) {
  const [local, setLocal] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setLocal(value)
  }, [value])

  const handleChange = (v: string) => {
    setLocal(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange(v)
    }, debounceMs)
  }

  const handleClear = () => {
    setLocal('')
    onChange('')
  }

  return (
    <div className="search-input">
      <Search size={16} className="search-input__icon" />
      <input
        type="text"
        className="search-input__field"
        value={local}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
      />
      {local && (
        <button className="search-input__clear" onClick={handleClear}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
