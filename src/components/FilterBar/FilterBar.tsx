import { Select, type SelectOption } from '@/components/Select/Select'
import './FilterBar.css'

export interface FilterField {
  key: string
  label: string
  options: SelectOption[]
  placeholder?: string
  emptyText?: string
}

interface FilterBarProps {
  fields: FilterField[]
  values: Record<string, string | undefined>
  onChange: (key: string, value: string) => void
}

export function FilterBar({ fields, values, onChange }: FilterBarProps) {
  if (fields.length === 0) return null

  return (
    <div className="filter-bar">
      {fields.map((field) => (
        <Select
          key={field.key}
          value={values[field.key]}
          options={field.options}
          placeholder={field.placeholder || field.label}
          emptyText={field.emptyText}
          onChange={(v) => onChange(field.key, String(v))}
        />
      ))}
    </div>
  )
}
