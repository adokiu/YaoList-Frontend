import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { 
  Download, Link2, Share2, File, FileImage, FileVideo, FileAudio, 
  FileCode, Calendar, HardDrive, Film, Music, Code, Info, X, MapPin,
  Camera, Aperture, Sun, Zap, Thermometer, Mountain, Clock, Maximize
} from 'lucide-react'
import { api } from '../../../utils/api'
import { useToast } from '../../../components/Toast'
import { getFileType, FileType } from './index'
import { parseVideoMetadata, isAudioCodecSupported, formatChannels, VideoMetadata } from '../../../utils/videoMetadata'
import { extractAudioMetadata, formatSampleRate, AudioMetadata } from '../../../utils/audioMetadata'
import { isEncryptedAudio, extractEncryptedAudioMetadata } from '../../../utils/audioDecrypt'
import './previews.scss'

interface FileItem {
  name: string
  path: string
  is_dir: boolean
  size: number
  modified: string
}

interface DownloadPreviewProps {
  file: FileItem
  url: string
}

interface ExifData {
  // 设备信息
  make?: string           // 相机制造商
  model?: string          // 相机型号
  software?: string       // 软件
  // 拍摄参数
  exposureTime?: string   // 曝光时间
  fNumber?: string        // 光圈
  iso?: number            // ISO
  focalLength?: string    // 焦距
  focalLength35mm?: number // 35mm 等效焦距
  exposureBias?: string   // 曝光补偿
  meteringMode?: string   // 测光模式
  flash?: string          // 闪光灯
  whiteBalance?: string   // 白平衡
  // 时间
  dateTime?: string       // 拍摄时间
  dateTimeOriginal?: string
  // GPS
  gpsLatitude?: number
  gpsLongitude?: number
  gpsAltitude?: number
  // 图像信息
  orientation?: number
  colorSpace?: string
  // 镜头
  lensModel?: string
  lensMake?: string
}

interface FileMetadata {
  // 图片
  width?: number
  height?: number
  isHDR?: boolean
  isRAW?: boolean
  exif?: ExifData
  // 视频
  duration?: number
  videoCodec?: string
  audioCodec?: string
  frameRate?: number
  bitrate?: number
  // 音频
  sampleRate?: number
  channels?: number
  // 代码
  lines?: number
  language?: string
}

// 获取文件类型图标
const getFileTypeIcon = (filename: string) => {
  const type = getFileType(filename)
  switch (type) {
    case FileType.IMAGE: return FileImage
    case FileType.VIDEO: return FileVideo
    case FileType.AUDIO: return FileAudio
    case FileType.TEXT: return FileCode
    default: return File
  }
}

// 格式化文件大小
const formatSize = (bytes: number) => {
  if (bytes === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i]
}

// 格式化日期
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  const lang = localStorage.getItem('language') || 'zh-CN'
  return date.toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US')
}

// 格式化时长
const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 格式化码率
const formatBitrate = (bps: number) => {
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} Mbps`
  if (bps >= 1000) return `${(bps / 1000).toFixed(0)} Kbps`
  return `${bps} bps`
}

// 获取编程语言
const getLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    'js': 'JavaScript', 'ts': 'TypeScript', 'jsx': 'React JSX', 'tsx': 'React TSX',
    'py': 'Python', 'rb': 'Ruby', 'php': 'PHP', 'java': 'Java',
    'c': 'C', 'cpp': 'C++', 'h': 'C Header', 'hpp': 'C++ Header',
    'cs': 'C#', 'go': 'Go', 'rs': 'Rust', 'swift': 'Swift', 'kt': 'Kotlin',
    'sh': 'Shell', 'bash': 'Bash', 'ps1': 'PowerShell', 'bat': 'Batch',
    'sql': 'SQL', 'html': 'HTML', 'css': 'CSS', 'scss': 'SCSS', 'less': 'Less',
    'json': 'JSON', 'xml': 'XML', 'yaml': 'YAML', 'yml': 'YAML',
    'md': 'Markdown', 'txt': 'Text', 'vue': 'Vue', 'svelte': 'Svelte',
  }
  return langMap[ext] || ext.toUpperCase()
}

// 检测是否是 RAW 格式
const isRAWFormat = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  // 各厂商 RAW 格式
  const rawFormats = [
    'cr2', 'cr3',        // Canon
    'nef', 'nrw',        // Nikon
    'arw', 'srf', 'sr2', // Sony
    'orf',               // Olympus
    'rw2',               // Panasonic
    'raf',               // Fujifilm
    'pef', 'ptx',        // Pentax
    'dng',               // Adobe DNG
    'raw', '3fr',        // Hasselblad
    'iiq',               // Phase One
    'erf',               // Epson
    'srw',               // Samsung
    'x3f',               // Sigma
    'kdc', 'dcr',        // Kodak
    'rwl',               // Leica
    'mos',               // Leaf
    'mrw',               // Minolta
  ]
  return rawFormats.includes(ext)
}

// 检测是否是 HDR 格式
const isHDRFormat = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['hdr', 'exr', 'jxl', 'avif', 'heic', 'heif'].includes(ext)
}

// 从视频文件名解析编码信息
const parseVideoInfo = (filename: string) => {
  const name = filename.toUpperCase()
  
  // HDR 格式检测 - 注意顺序，先检测更具体的格式
  let isHDR = false
  let hdrFormat = ''
  if (name.includes('HDR10+') || name.includes('HDR10PLUS')) {
    isHDR = true
    hdrFormat = 'HDR10+'
  } else if (name.includes('DOLBY.VISION') || name.includes('DOVI')) {
    isHDR = true
    hdrFormat = 'Dolby Vision'
  } else if (name.includes('HDR.VIVID') || name.includes('HDRVIVID')) {
    isHDR = true
    hdrFormat = 'HDR Vivid'
  } else if (name.includes('HDR10')) {
    isHDR = true
    hdrFormat = 'HDR10'
  } else if (name.includes('HLG')) {
    isHDR = true
    hdrFormat = 'HLG'
  } else if (name.includes('.HDR.') || name.includes('.HDR-') || name.includes('-HDR.') || name.includes('-HDR-')) {
    // 通用 HDR 检测 - 需要有分隔符避免误判
    isHDR = true
    hdrFormat = 'HDR'
  }
  
  // 视频编码检测
  let videoCodec = ''
  if (name.includes('X265') || name.includes('H265') || name.includes('HEVC')) {
    videoCodec = 'H.265/HEVC'
  } else if (name.includes('X264') || name.includes('H264') || name.includes('AVC')) {
    videoCodec = 'H.264/AVC'
  } else if (name.includes('AV1')) {
    videoCodec = 'AV1'
  } else if (name.includes('VP9')) {
    videoCodec = 'VP9'
  }
  
  // 音频编码检测 + 兼容性警告
  let audioCodec = ''
  let audioWarning: string | null = null
  
  if (name.includes('DTS-HD.MA') || name.includes('DTS-HDMA') || name.includes('DTSHD')) {
    audioCodec = 'DTS-HD MA'
    audioWarning = 'dtsHdMa'
  } else if (name.includes('DTS-HD') || name.includes('DTS.HD')) {
    audioCodec = 'DTS-HD'
    audioWarning = 'dtsHd'
  } else if (name.includes('TRUEHD') || name.includes('TRUE-HD')) {
    audioCodec = 'Dolby TrueHD'
    audioWarning = 'trueHd'
  } else if (name.includes('ATMOS')) {
    audioCodec = 'Dolby Atmos'
    audioWarning = 'atmos'
  } else if (name.includes('DTS')) {
    audioCodec = 'DTS'
    audioWarning = 'dts'
  } else if (name.includes('EAC3') || name.includes('E-AC3') || name.includes('DD+') || name.includes('DDP')) {
    audioCodec = 'E-AC3 (DD+)'
  } else if (name.includes('AC3') || name.includes('DD5.1') || name.includes('DD.5.1')) {
    audioCodec = 'AC3 (Dolby Digital)'
  } else if (name.includes('FLAC')) {
    audioCodec = 'FLAC'
  } else if (name.includes('AAC')) {
    audioCodec = 'AAC'
  }
  
  // 音频声道
  let audioChannels = ''
  if (name.includes('7.1')) {
    audioChannels = '7.1'
  } else if (name.includes('5.1')) {
    audioChannels = '5.1'
  } else if (name.includes('2.0') || name.includes('STEREO')) {
    audioChannels = 'stereo'
  }
  
  // 视频码率（从文件名提取）
  let videoBitrate = ''
  const bitrateMatch = name.match(/(\d+)KBPS|(\d+)MBPS/i)
  if (bitrateMatch) {
    videoBitrate = bitrateMatch[0]
  }
  
  return { isHDR, hdrFormat, videoCodec, audioCodec, audioWarning, audioChannels, videoBitrate }
}

// 格式化 GPS 坐标
const formatGPS = (lat: number, lng: number): string => {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lng).toFixed(6)}°${lngDir}`
}

// EXIF 标签定义
const EXIF_TAGS: Record<number, string> = {
  0x010F: 'make', 0x0110: 'model', 0x0131: 'software',
  0x829A: 'exposureTime', 0x829D: 'fNumber', 0x8827: 'iso',
  0x920A: 'focalLength', 0xA405: 'focalLength35mm',
  0x9204: 'exposureBias', 0x9207: 'meteringMode',
  0x9209: 'flash', 0xA403: 'whiteBalance',
  0x9003: 'dateTimeOriginal', 0x0132: 'dateTime',
  0xA434: 'lensModel', 0xA433: 'lensMake',
}

const GPS_TAGS: Record<number, string> = {
  0x0001: 'latRef', 0x0002: 'lat', 0x0003: 'lngRef', 0x0004: 'lng',
  0x0005: 'altRef', 0x0006: 'alt',
}

const EXIF_HEAD_BYTES = 1024 * 1024
const EXIF_TAIL_BYTES = 512 * 1024

const readU32BE = (data: Uint8Array, offset: number): number =>
  ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0

const exifPayloadLooksValid = (exif: ExifData | null): boolean => {
  if (!exif) return false
  return !!(
    exif.make || exif.model || exif.lensModel || exif.dateTimeOriginal || exif.dateTime ||
    exif.focalLength !== undefined || exif.fNumber !== undefined || exif.exposureTime !== undefined ||
    exif.iso !== undefined || exif.gpsLatitude !== undefined
  )
}

async function fetchExifByteRange(url: string, start: number, endInclusive: number): Promise<ArrayBuffer | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=${start}-${endInclusive}` },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (response.status !== 206 && response.status !== 200) return null

    const maxLen = endInclusive - start + 1
    if (response.status === 200) {
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength, 10) > maxLen * 2) {
        console.warn('EXIF: server ignored Range, file too large')
        return null
      }
    }

    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > maxLen && response.status === 206) {
      return buffer.slice(0, maxLen)
    }
    return buffer
  } catch {
    clearTimeout(timeout)
    return null
  }
}

const parseExifAt = (view: Uint8Array, relativeOffset: number): ExifData | null => {
  const abs = view.byteOffset + relativeOffset
  if (abs + 8 > view.buffer.byteLength) return null
  return parseExifData(view.buffer as ArrayBuffer, abs)
}

const parseExifFromBytes = (buffer: ArrayBuffer): ExifData | null => {
  const dataView = new DataView(buffer)
  const data = new Uint8Array(buffer)
  const firstBytes = dataView.getUint16(0)

  if (firstBytes === 0xFFD8) {
    let offset = 2
    while (offset < buffer.byteLength - 4) {
      const marker = dataView.getUint16(offset)
      if (marker === 0xFFE1) {
        const exifHeader = String.fromCharCode(
          dataView.getUint8(offset + 4), dataView.getUint8(offset + 5),
          dataView.getUint8(offset + 6), dataView.getUint8(offset + 7)
        )
        if (exifHeader === 'Exif') {
          const parsed = parseExifData(buffer, offset + 10)
          if (exifPayloadLooksValid(parsed)) return parsed
        }
      }
      if ((marker & 0xFF00) !== 0xFF00) break
      const segLen = dataView.getUint16(offset + 2)
      offset += 2 + segLen
    }
    return null
  }

  const ftypStr = data.length >= 8
    ? String.fromCharCode(data[4], data[5], data[6], data[7])
    : ''
  if (ftypStr === 'ftyp') {
    return parseIsobmffExif(data)
  }

  if (firstBytes === 0x4949 || firstBytes === 0x4D4D) {
    const parsed = parseExifData(buffer, 0)
    if (exifPayloadLooksValid(parsed)) return parsed
  }

  const magic = dataView.getUint16(2, firstBytes === 0x4949)
  if (magic === 0x002A || magic === 0x2A00) {
    const parsed = parseExifData(buffer, 0)
    if (exifPayloadLooksValid(parsed)) return parsed
  }

  return null
}

const walkIsobmffForExif = (data: Uint8Array, start: number, end: number): ExifData | null => {
  let offset = start
  while (offset + 8 <= end) {
    let size = readU32BE(data, offset)
    const type = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7])
    let headerSize = 8

    if (size === 0) break
    if (size === 1 && offset + 16 <= end) {
      const hi = readU32BE(data, offset + 8)
      const lo = readU32BE(data, offset + 12)
      size = hi * 0x100000000 + lo
      headerSize = 16
    }
    if (size < headerSize) break

    const boxEnd = Math.min(offset + size, end)
    const payloadStart = offset + headerSize

    if (type === 'Exif' && payloadStart + 6 <= boxEnd) {
      let tiffRel = payloadStart
      if (data[payloadStart] === 0x45 && data[payloadStart + 1] === 0x78) {
        tiffRel = payloadStart + 6
      }
      const parsed = parseExifAt(data, tiffRel)
      if (exifPayloadLooksValid(parsed)) return parsed
    }

    if (type === 'meta' && payloadStart + 4 <= boxEnd) {
      const nested = walkIsobmffForExif(data, payloadStart + 4, boxEnd)
      if (nested) return nested
    }

    if (size > end - offset) {
      if (type === 'meta' && payloadStart + 4 < end) {
        const nested = walkIsobmffForExif(data, payloadStart + 4, end)
        if (nested) return nested
      }
      break
    }
    offset += size
  }
  return null
}

const parseIsobmffExif = (data: Uint8Array): ExifData | null => {
  try {
    const fromBoxes = walkIsobmffForExif(data, 0, data.length)
    if (fromBoxes) return fromBoxes
    return scanIsobmffExifMarkers(data)
  } catch (e) {
    console.error('ISOBMFF EXIF parse error:', e)
    return null
  }
}

const scanIsobmffExifMarkers = (data: Uint8Array): ExifData | null => {
  const buffer = data.buffer as ArrayBuffer
  for (let i = 0; i < data.length - 10; i++) {
    if (data[i] === 0x45 && data[i + 1] === 0x78 && data[i + 2] === 0x69 && data[i + 3] === 0x66 &&
        data[i + 4] === 0x00 && data[i + 5] === 0x00) {
      if ((data[i + 6] === 0x49 && data[i + 7] === 0x49) || (data[i + 6] === 0x4D && data[i + 7] === 0x4D)) {
        const parsed = parseExifData(buffer, data.byteOffset + i + 6)
        if (exifPayloadLooksValid(parsed)) return parsed
      }
    }
  }
  for (let i = 0; i < data.length - 8; i++) {
    if (data[i] === 0x49 && data[i + 1] === 0x49 && data[i + 2] === 0x2A && data[i + 3] === 0x00) {
      const ifdOff = data[i + 4] | (data[i + 5] << 8) | (data[i + 6] << 16) | (data[i + 7] << 24)
      if (ifdOff === 8 && i > 100) {
        const parsed = parseExifData(buffer, data.byteOffset + i)
        if (exifPayloadLooksValid(parsed)) return parsed
      }
    }
    if (data[i] === 0x4D && data[i + 1] === 0x4D && data[i + 2] === 0x00 && data[i + 3] === 0x2A) {
      const ifdOff = (data[i + 4] << 24) | (data[i + 5] << 16) | (data[i + 6] << 8) | data[i + 7]
      if (ifdOff === 8 && i > 100) {
        const parsed = parseExifData(buffer, data.byteOffset + i)
        if (exifPayloadLooksValid(parsed)) return parsed
      }
    }
  }
  return null
}

const readExifFromBuffer = async (url: string, fileSize?: number): Promise<ExifData | null> => {
  try {
    const head = await fetchExifByteRange(url, 0, EXIF_HEAD_BYTES - 1)
    if (!head) return null

    let result = parseExifFromBytes(head)
    if (result) return result

    const headView = new Uint8Array(head)
    const isIsobmff = headView.length >= 8 &&
      String.fromCharCode(headView[4], headView[5], headView[6], headView[7]) === 'ftyp'

    if (!isIsobmff || !fileSize || fileSize <= EXIF_HEAD_BYTES) return null

    const tailStart = Math.max(EXIF_HEAD_BYTES, fileSize - EXIF_TAIL_BYTES)
    const tail = await fetchExifByteRange(url, tailStart, fileSize - 1)
    if (!tail) return null
    result = parseExifFromBytes(tail)
    return result
  } catch (e) {
    console.error('EXIF read error:', e)
    return null
  }
}

// 解析 EXIF 数据
const parseExifData = (buffer: ArrayBuffer, tiffOffset: number): ExifData | null => {
  try {
    const dataView = new DataView(buffer)
    
    // 检查字节序
    const byteOrder = dataView.getUint16(tiffOffset)
    const littleEndian = byteOrder === 0x4949 // "II" = Intel = little endian
    
    // 获取 IFD0 偏移
    const ifd0Offset = dataView.getUint32(tiffOffset + 4, littleEndian)
    
    const exif: ExifData = {}
    
    // 解析 IFD0
    parseIFD(dataView, tiffOffset, tiffOffset + ifd0Offset, littleEndian, exif, EXIF_TAGS)
    
    // 查找 EXIF IFD
    const exifIFDOffset = findTag(dataView, tiffOffset, tiffOffset + ifd0Offset, littleEndian, 0x8769)
    if (exifIFDOffset) {
      parseIFD(dataView, tiffOffset, tiffOffset + exifIFDOffset, littleEndian, exif, EXIF_TAGS)
    }
    
    // 查找 GPS IFD
    const gpsIFDOffset = findTag(dataView, tiffOffset, tiffOffset + ifd0Offset, littleEndian, 0x8825)
    if (gpsIFDOffset) {
      const gpsData: Record<string, any> = {}
      parseIFD(dataView, tiffOffset, tiffOffset + gpsIFDOffset, littleEndian, gpsData, GPS_TAGS)
      console.log('GPS data parsed:', gpsData)
      
      // 转换 GPS 坐标
      console.log('Raw GPS data:', JSON.stringify(gpsData))
      if (gpsData.lat !== undefined && gpsData.lng !== undefined) {
        const lat = convertGPS(gpsData.lat)
        const lng = convertGPS(gpsData.lng)
        // 只有在坐标有效时才设置
        if (lat !== 0 || lng !== 0) {
          exif.gpsLatitude = lat * (gpsData.latRef === 'S' ? -1 : 1)
          exif.gpsLongitude = lng * (gpsData.lngRef === 'W' ? -1 : 1)
          console.log('GPS coords:', exif.gpsLatitude, exif.gpsLongitude)
        }
      }
      if (gpsData.alt !== undefined) {
        exif.gpsAltitude = Number(gpsData.alt) * (gpsData.altRef === 1 ? -1 : 1)
      }
    }
    
    return exif
  } catch (e) {
    console.error('EXIF parse error:', e)
    return null
  }
}

// 解析 IFD
const parseIFD = (
  dataView: DataView, tiffOffset: number, ifdOffset: number,
  littleEndian: boolean, result: Record<string, any>, tagMap: Record<number, string>
) => {
  const numEntries = dataView.getUint16(ifdOffset, littleEndian)
  
  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12
    const tag = dataView.getUint16(entryOffset, littleEndian)
    const tagName = tagMap[tag]
    
    if (tagName) {
      const value = readTagValue(dataView, tiffOffset, entryOffset, littleEndian, tag)
      if (value !== null) {
        result[tagName] = value
      }
    }
  }
}

// 查找特定标签
const findTag = (
  dataView: DataView, _tiffOffset: number, ifdOffset: number,
  littleEndian: boolean, targetTag: number
): number | null => {
  const numEntries = dataView.getUint16(ifdOffset, littleEndian)
  
  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12
    const tag = dataView.getUint16(entryOffset, littleEndian)
    
    if (tag === targetTag) {
      return dataView.getUint32(entryOffset + 8, littleEndian)
    }
  }
  return null
}

// 读取标签值
const readTagValue = (
  dataView: DataView, tiffOffset: number, entryOffset: number, littleEndian: boolean, tag?: number
): any => {
  const type = dataView.getUint16(entryOffset + 2, littleEndian)
  const count = dataView.getUint32(entryOffset + 4, littleEndian)
  let valueOffset = entryOffset + 8
  
  // 如果数据超过 4 字节，则值是偏移量
  const typeSize = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] || 1
  if (count * typeSize > 4) {
    valueOffset = tiffOffset + dataView.getUint32(entryOffset + 8, littleEndian)
  }
  
  // GPS 坐标标签 (0x0002=lat, 0x0004=lng) 需要特殊处理
  const isGPSCoord = tag === 0x0002 || tag === 0x0004
  
  switch (type) {
    case 1: // BYTE
    case 7: // UNDEFINED
      return dataView.getUint8(valueOffset)
    case 2: // ASCII
      let str = ''
      for (let i = 0; i < count - 1; i++) {
        const charCode = dataView.getUint8(valueOffset + i)
        // 只保留可打印 ASCII 字符 (32-126)
        if (charCode >= 32 && charCode <= 126) {
          str += String.fromCharCode(charCode)
        }
      }
      return str.trim()
    case 3: // SHORT
      if (count === 1) return dataView.getUint16(valueOffset, littleEndian)
      const shortArr = []
      for (let i = 0; i < count; i++) {
        shortArr.push(dataView.getUint16(valueOffset + i * 2, littleEndian))
      }
      return shortArr
    case 4: // LONG
      return dataView.getUint32(valueOffset, littleEndian)
    case 5: // RATIONAL
      // GPS 坐标总是返回数组 [度, 分, 秒]
      if (count >= 3 || isGPSCoord) {
        const arr = []
        for (let i = 0; i < count; i++) {
          const n = dataView.getUint32(valueOffset + i * 8, littleEndian)
          const d = dataView.getUint32(valueOffset + i * 8 + 4, littleEndian)
          arr.push(d ? n / d : 0)
        }
        if (isGPSCoord) {
          console.log(`GPS coord tag 0x${tag?.toString(16)}: count=${count}, values=`, arr)
        }
        return arr
      }
      // 单个 RATIONAL 值
      const num = dataView.getUint32(valueOffset, littleEndian)
      const den = dataView.getUint32(valueOffset + 4, littleEndian)
      return den ? num / den : 0
    case 10: // SRATIONAL
      if (count === 1) {
        const snum = dataView.getInt32(valueOffset, littleEndian)
        const sden = dataView.getInt32(valueOffset + 4, littleEndian)
        return sden ? snum / sden : 0
      }
      const srArr = []
      for (let i = 0; i < count; i++) {
        const sn = dataView.getInt32(valueOffset + i * 8, littleEndian)
        const sd = dataView.getInt32(valueOffset + i * 8 + 4, littleEndian)
        srArr.push(sd ? sn / sd : 0)
      }
      return srArr
    default:
      return null
  }
}

// 转换 GPS 坐标 [度, 分, 秒] -> 十进制度
const convertGPS = (coords: any): number => {
  // 如果已经是数字，直接返回
  if (typeof coords === 'number') {
    return coords
  }
  // 如果是数组 [度, 分, 秒]
  if (Array.isArray(coords)) {
    if (coords.length >= 3) {
      return coords[0] + coords[1] / 60 + coords[2] / 3600
    }
    if (coords.length === 1) {
      return coords[0]
    }
  }
  // 尝试解析字符串格式 "28; 47; 31.56"
  if (typeof coords === 'string') {
    const parts = coords.split(/[;,\s]+/).map(Number).filter(n => !isNaN(n))
    if (parts.length >= 3) {
      return parts[0] + parts[1] / 60 + parts[2] / 3600
    }
    if (parts.length === 1) {
      return parts[0]
    }
  }
  console.warn('Unknown GPS format:', coords)
  return 0
}

export default function DownloadPreview({ file, url }: DownloadPreviewProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const [permissions, setPermissions] = useState<{ allow_direct_link: boolean; allow_share: boolean } | null>(null)
  const [metadata, setMetadata] = useState<FileMetadata | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [loadingExifModal, setLoadingExifModal] = useState(false)
  const [showExifModal, setShowExifModal] = useState(false)
  const [showVideoInfoModal, setShowVideoInfoModal] = useState(false)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null)
  const [loadingVideoMeta, setLoadingVideoMeta] = useState(false)
  const [showAudioInfoModal, setShowAudioInfoModal] = useState(false)
  const [audioMeta, setAudioMeta] = useState<AudioMetadata | null>(null)
  const [loadingAudioMeta, setLoadingAudioMeta] = useState(false)
  // 直链弹窗
  const [directLinkDialog, setDirectLinkDialog] = useState<{
    visible: boolean
    expiresAt: string
    maxAccessCount: string
  }>({ visible: false, expiresAt: '', maxAccessCount: '' })
  // 分享弹窗
  const [shareDialog, setShareDialog] = useState<{
    visible: boolean
    expiresAt: string
    maxAccessCount: string
    password: string
  }>({ visible: false, expiresAt: '', maxAccessCount: '', password: '' })

  const fileType = getFileType(file.name)
  const isEncryptedFile = isEncryptedAudio(file.name)
  const isRAW = isRAWFormat(file.name)

  // 逆地理编码获取位置名称
  useEffect(() => {
    if (!metadata?.exif?.gpsLatitude || !metadata?.exif?.gpsLongitude) return

    const fetchLocationName = async () => {
      try {
        // 使用 Nominatim API (OpenStreetMap) 进行逆地理编码
        // zoom=18 获取街道级别精度
        const lat = metadata.exif!.gpsLatitude
        const lon = metadata.exif!.gpsLongitude
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=zh-CN`,
          { headers: { 'User-Agent': 'YaoList/1.0' } }
        )
        if (response.ok) {
          const data = await response.json()
          if (data.address) {
            // 构建位置名称：国家, 省, 市, 区, 街道
            const parts = []
            if (data.address.country) parts.push(data.address.country)
            if (data.address.state || data.address.province) parts.push(data.address.state || data.address.province)
            if (data.address.city || data.address.town || data.address.county) {
              parts.push(data.address.city || data.address.town || data.address.county)
            }
            // 区/镇
            if (data.address.district || data.address.suburb || data.address.borough) {
              parts.push(data.address.district || data.address.suburb || data.address.borough)
            }
            // 街道/道路
            if (data.address.road || data.address.street) {
              parts.push(data.address.road || data.address.street)
            }
            // 街道办/社区
            if (data.address.neighbourhood || data.address.quarter) {
              parts.push(data.address.neighbourhood || data.address.quarter)
            }
            if (parts.length > 0) {
              setLocationName(parts.join(', '))
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch location name:', err)
      }
    }

    fetchLocationName()
  }, [metadata?.exif?.gpsLatitude, metadata?.exif?.gpsLongitude])

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const response = await fetch('/api/auth/permissions', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          // 游客被禁用时跳转到登录页
          if (data.is_guest && data.guest_disabled) {
            window.location.href = '/login?msg=guest_disabled'
            return
          }
          if (data.permissions) {
            setPermissions({
              allow_direct_link: !!data.permissions.allow_direct_link,
              allow_share: !!data.permissions.allow_share,
            })
          }
        }
      } catch {}
    }
    loadPermissions()
  }, [])

  // 加载视频元数据
  useEffect(() => {
    if (!showVideoInfoModal || fileType !== FileType.VIDEO || videoMeta) return
    
    const loadVideoMeta = async () => {
      setLoadingVideoMeta(true)
      try {
        const meta = await parseVideoMetadata(url, file.name)
        setVideoMeta(meta)
      } catch (e) {
        console.error('Failed to load video metadata:', e)
      } finally {
        setLoadingVideoMeta(false)
      }
    }
    
    loadVideoMeta()
  }, [showVideoInfoModal, fileType, url, file.name, videoMeta])

  // 打开 EXIF 弹窗时用 Range 重新读取（AVIF/HEIC 等可能需尾部 meta）
  useEffect(() => {
    if (!showExifModal || fileType !== FileType.IMAGE || !url) return

    let cancelled = false
    const loadExif = async () => {
      setLoadingExifModal(true)
      try {
        const exifData = await readExifFromBuffer(url, file.size)
        if (!cancelled && exifData) {
          setMetadata(prev => ({
            ...(prev ?? { isRAW, isHDR: isHDRFormat(file.name) }),
            exif: exifData,
          }))
        }
      } catch (e) {
        console.error('Failed to load EXIF in modal:', e)
      } finally {
        if (!cancelled) setLoadingExifModal(false)
      }
    }

    loadExif()
    return () => { cancelled = true }
  }, [showExifModal, fileType, url, file.size, file.name, isRAW])

  // 加载音频元数据
  useEffect(() => {
    if (!showAudioInfoModal || fileType !== FileType.AUDIO || audioMeta) return
    
    const loadAudioMeta = async () => {
      setLoadingAudioMeta(true)
      try {
        if (isEncryptedFile) {
          // 加密文件 - 只下载头部数据提取元数据（不下载整个文件）
          const meta = await extractEncryptedAudioMetadata(url, file.name)
          if (meta) {
            setAudioMeta({
              title: meta.title,
              artist: meta.artist,
              album: meta.album,
              format: meta.format,
              codec: meta.codec,
              sampleRate: meta.sampleRate,
              channels: meta.channels,
              bitDepth: meta.bitDepth
            })
          }
        } else {
          const meta = await extractAudioMetadata(url, file.size)
          setAudioMeta(meta)
        }
      } catch (e) {
        console.error('Failed to load audio metadata:', e)
      } finally {
        setLoadingAudioMeta(false)
      }
    }
    
    loadAudioMeta()
  }, [showAudioInfoModal, fileType, url, file.name, file.size, audioMeta, isEncryptedFile])

  // 加载文件元信息
  useEffect(() => {
    const loadMetadata = async () => {
      if (!url) return
      setLoadingMeta(true)
      
      const isRAW = isRAWFormat(file.name)
      const isHDR = isHDRFormat(file.name)
      
      try {
        // 图片元信息 - EXIF 读取独立于图片解码
        if (fileType === FileType.IMAGE) {
          const meta: FileMetadata = { isRAW, isHDR }
          
          // 1. 先读取 EXIF（不需要解码图片）
          try {
            const exifData = await readExifFromBuffer(url, file.size)
            if (exifData) meta.exif = exifData
          } catch (e) {
            console.warn('EXIF read failed:', e)
          }
          
          // 2. 尝试获取图片尺寸（可能失败，如 RAW/HEIC）
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          
          await new Promise<void>((resolve) => {
            img.onload = () => {
              meta.width = img.naturalWidth
              meta.height = img.naturalHeight
              resolve()
            }
            img.onerror = () => {
              // 图片无法加载，但 EXIF 已经读取
              console.log('Image decode failed, but EXIF may be available')
              resolve()
            }
            img.src = url
          })
          
          setMetadata(meta)
          setLoadingMeta(false)
        }
        // 视频元信息
        else if (fileType === FileType.VIDEO) {
          const video = document.createElement('video')
          video.crossOrigin = 'anonymous'
          video.preload = 'metadata'
          video.onloadedmetadata = () => {
            setMetadata({
              width: video.videoWidth,
              height: video.videoHeight,
              duration: video.duration,
            })
            setLoadingMeta(false)
          }
          video.onerror = () => setLoadingMeta(false)
          video.src = url
        }
        // 音频元信息
        else if (fileType === FileType.AUDIO) {
          const audio = document.createElement('audio')
          audio.crossOrigin = 'anonymous'
          audio.preload = 'metadata'
          audio.onloadedmetadata = () => {
            setMetadata({
              duration: audio.duration,
            })
            setLoadingMeta(false)
          }
          audio.onerror = () => setLoadingMeta(false)
          audio.src = url
        }
        // 文本/代码 - 获取行数
        else if (fileType === FileType.TEXT) {
          try {
            const res = await fetch(url)
            const text = await res.text()
            const lines = text.split('\n').length
            setMetadata({
              lines,
              language: getLanguage(file.name),
            })
          } catch {}
          setLoadingMeta(false)
        }
        else {
          setLoadingMeta(false)
        }
      } catch {
        setLoadingMeta(false)
      }
    }
    
    loadMetadata()
  }, [url, fileType, file.name])

  // 下载
  const handleDownload = () => {
    if (url) window.open(url, '_blank')
  }

  // 打开直链弹窗
  const openDirectLinkDialog = () => {
    setDirectLinkDialog({ visible: true, expiresAt: '', maxAccessCount: '' })
  }

  // 创建直链
  const handleCreateDirectLink = async () => {
    try {
      const res = await api.post('/api/fs/get_direct_link', { 
        path: file.path,
        expires_at: directLinkDialog.expiresAt || null,
        max_access_count: directLinkDialog.maxAccessCount ? parseInt(directLinkDialog.maxAccessCount) : null
      })
      if (res.data.code === 200 && res.data.data?.url) {
        await navigator.clipboard.writeText(res.data.data.url)
        toast.success(t('filePreview.linkCopied'))
      } else {
        toast.error(res.data.message || t('filePreview.copyFailed'))
      }
    } catch {
      toast.error(t('filePreview.copyFailed'))
    }
    setDirectLinkDialog({ visible: false, expiresAt: '', maxAccessCount: '' })
  }

  // 打开分享弹窗
  const handleShare = () => {
    setShareDialog({ visible: true, expiresAt: '', maxAccessCount: '', password: '' })
  }

  // 创建分享
  const handleCreateShare = async () => {
    try {
      const response = await api.post('/api/shares', { 
        path: file.path,
        expires_at: shareDialog.expiresAt || null,
        max_access_count: shareDialog.maxAccessCount ? parseInt(shareDialog.maxAccessCount) : null,
        password: shareDialog.password || null
      })
      if (response.data.code === 200) {
        const url = window.location.origin + response.data.data.url
        await navigator.clipboard.writeText(url)
        toast.success(t('fileBrowser.shareCreated'))
      } else {
        toast.error(response.data.message || t('fileBrowser.operationFailed'))
      }
    } catch {
      toast.error(t('fileBrowser.operationFailed'))
    }
    setShareDialog({ visible: false, expiresAt: '', maxAccessCount: '', password: '' })
  }

  const FileIcon = getFileTypeIcon(file.name)

  // 格式化 EXIF 值
  const formatExposureTime = (val: any): string => {
    if (typeof val === 'number') {
      if (val < 1) return `1/${Math.round(1/val)}s`
      return `${val}s`
    }
    return String(val)
  }

  const formatFNumber = (val: any): string => {
    if (typeof val === 'number') return `f/${val.toFixed(1)}`
    return String(val)
  }

  const formatFocalLength = (val: any): string => {
    if (typeof val === 'number') return `${val.toFixed(1)}mm`
    return String(val)
  }

  // 格式化闪光灯
  const formatFlash = (val: any): string => {
    if (val === undefined || val === null) return '-'
    if (typeof val === 'string') return val
    // 闪光灯值是一个位字段
    const flashFired = (val & 0x01) !== 0
    return flashFired ? 'flashFired' : 'flashNotFired'
  }

  // 格式化白平衡
  const formatWhiteBalance = (val: any): string => {
    if (val === undefined || val === null) return '-'
    if (typeof val === 'string') return val
    // 0 = 自动, 1 = 手动
    return val === 0 ? 'auto' : 'manual'
  }

  // 渲染元信息
  const renderMetadata = () => {
    if (loadingMeta) {
      return <div className="download-preview__meta-loading">{t('preview.loading')}</div>
    }
    if (!metadata) return null

    const { exif } = metadata
    const hasDevice = exif?.make || exif?.model || exif?.lensModel
    const hasParams = exif?.focalLength || exif?.fNumber || exif?.exposureTime || exif?.iso
    const hasGPS = exif?.gpsLatitude && exif?.gpsLongitude

    return (
      <div className="download-preview__metadata">
        {/* 图片元信息 */}
        {fileType === FileType.IMAGE && (
          <>
            {/* 基本信息 */}
            <div className="download-preview__meta-section">
              <div className="download-preview__meta-section-title">{t('preview.basicInfo')}</div>
              <div className="download-preview__meta-section-content">
                {metadata.width && metadata.height && (
                  <div className="download-preview__meta-item">
                    <span>{t('preview.resolution')}</span>
                    <strong>{metadata.width} × {metadata.height}</strong>
                  </div>
                )}
                {metadata.isRAW && (
                  <div className="download-preview__meta-item download-preview__meta-item--raw">
                    <span>RAW</span>
                  </div>
                )}
                {metadata.isHDR && (
                  <div className="download-preview__meta-item download-preview__meta-item--hdr">
                    <span>HDR</span>
                  </div>
                )}
                {exif?.dateTimeOriginal && (
                  <div className="download-preview__meta-item">
                    <span>{t('preview.shootTime')}</span>
                    <strong>{exif.dateTimeOriginal}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* 设备信息 */}
            {hasDevice && (
              <div className="download-preview__meta-section">
                <div className="download-preview__meta-section-title">{t('preview.device')}</div>
                <div className="download-preview__meta-section-content">
                  {(exif?.make || exif?.model) && (
                    <div className="download-preview__meta-item">
                      <span>{t('preview.camera')}</span>
                      <strong>{[exif.make, exif.model].filter(Boolean).join(' ')}</strong>
                    </div>
                  )}
                  {exif?.lensModel && (
                    <div className="download-preview__meta-item">
                      <span>{t('preview.lens')}</span>
                      <strong>{exif.lensModel}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 拍摄参数 */}
            {hasParams && (
              <div className="download-preview__meta-section">
                <div className="download-preview__meta-section-title">{t('preview.shootParams')}</div>
                <div className="download-preview__meta-section-content">
                  {exif?.focalLength && (
                    <div className="download-preview__meta-item">
                      <span>{t('preview.focalLength')}</span>
                      <strong>{formatFocalLength(exif.focalLength)}{exif.focalLength35mm ? ` (${exif.focalLength35mm}mm)` : ''}</strong>
                    </div>
                  )}
                  {exif?.fNumber && (
                    <div className="download-preview__meta-item">
                      <span>{t('preview.aperture')}</span>
                      <strong>{formatFNumber(exif.fNumber)}</strong>
                    </div>
                  )}
                  {exif?.exposureTime && (
                    <div className="download-preview__meta-item">
                      <span>{t('preview.shutter')}</span>
                      <strong>{formatExposureTime(exif.exposureTime)}</strong>
                    </div>
                  )}
                  {exif?.iso && (
                    <div className="download-preview__meta-item">
                      <span>ISO</span>
                      <strong>{exif.iso}</strong>
                    </div>
                  )}
                  {exif?.exposureBias !== undefined && (
                    <div className="download-preview__meta-item">
                      <span>{t('preview.exposureComp')}</span>
                      <strong>{typeof exif.exposureBias === 'number' ? `${exif.exposureBias > 0 ? '+' : ''}${(exif.exposureBias as number).toFixed(1)} EV` : exif.exposureBias}</strong>
                    </div>
                  )}
                  {exif?.flash && (
                    <div className="download-preview__meta-item">
                      <span>{t('preview.flash')}</span>
                      <strong>{exif.flash}</strong>
                    </div>
                  )}
                  {exif?.whiteBalance && (
                    <div className="download-preview__meta-item">
                      <span>{t('preview.whiteBalance')}</span>
                      <strong>{exif.whiteBalance}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* GPS 信息 */}
            {hasGPS && (
              <div className="download-preview__meta-section">
                <div className="download-preview__meta-section-title">{t('preview.location')}</div>
                <div className="download-preview__meta-section-content">
                  <div className="download-preview__meta-item">
                    <span>{t('preview.coordinates')}</span>
                    <strong>{formatGPS(exif!.gpsLatitude!, exif!.gpsLongitude!)}</strong>
                  </div>
                  {exif?.gpsAltitude && (
                    <div className="download-preview__meta-item">
                      <span>{t('preview.altitude')}</span>
                      <strong>{exif.gpsAltitude.toFixed(1)}m</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RAW 格式提示 */}
            {metadata.isRAW && !metadata.width && (
              <div className="download-preview__raw-notice">
                {t('preview.rawNotice')}
              </div>
            )}
          </>
        )}

        {/* 视频元信息 */}
        {fileType === FileType.VIDEO && (
          <>
            {metadata.width && metadata.height && (
              <div className="download-preview__meta-item">
                <Film size={14} />
                <span>{t('preview.resolution')}</span>
                <strong>{metadata.width} × {metadata.height}</strong>
              </div>
            )}
            {metadata.duration && (
              <div className="download-preview__meta-item">
                <span>{t('preview.duration')}</span>
                <strong>{formatDuration(metadata.duration)}</strong>
              </div>
            )}
            {metadata.frameRate && (
              <div className="download-preview__meta-item">
                <span>{t('preview.frameRate')}</span>
                <strong>{metadata.frameRate} fps</strong>
              </div>
            )}
            {metadata.bitrate && (
              <div className="download-preview__meta-item">
                <span>{t('preview.bitrate')}</span>
                <strong>{formatBitrate(metadata.bitrate)}</strong>
              </div>
            )}
          </>
        )}

        {/* 音频元信息 */}
        {fileType === FileType.AUDIO && metadata.duration && (
          <div className="download-preview__meta-item">
            <Music size={14} />
            <span>{t('preview.duration')}</span>
            <strong>{formatDuration(metadata.duration)}</strong>
          </div>
        )}

        {/* 代码元信息 */}
        {fileType === FileType.TEXT && (
          <>
            {metadata.language && (
              <div className="download-preview__meta-item">
                <Code size={14} />
                <span>{t('preview.language')}</span>
                <strong>{metadata.language}</strong>
              </div>
            )}
            {metadata.lines && (
              <div className="download-preview__meta-item">
                <span>{t('preview.lines')}</span>
                <strong>{metadata.lines.toLocaleString()}</strong>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const isImageType = fileType === FileType.IMAGE || isRAW

  const exifModalHasSections = !!(
    (metadata?.width && metadata?.height) ||
    metadata?.exif?.dateTimeOriginal ||
    (metadata?.exif && (metadata.exif.make || metadata.exif.model || metadata.exif.lensModel)) ||
    (metadata?.exif && (
      metadata.exif.focalLength !== undefined || metadata.exif.fNumber !== undefined ||
      metadata.exif.exposureTime !== undefined || metadata.exif.iso !== undefined
    )) ||
    (metadata?.exif?.gpsLatitude !== undefined && metadata.exif.gpsLongitude !== undefined)
  )

  return (
    <div className="download-preview">
      <div className="download-preview__icon">
        <FileIcon size={80} />
      </div>
      
      {/* 文件名和信息按钮 */}
      <div className="download-preview__title">
        <h2 className="download-preview__name">{file.name}</h2>
        {isImageType && (
          <button 
            className="download-preview__exif-btn"
            onClick={() => setShowExifModal(true)}
            disabled={loadingMeta && !showExifModal}
            style={{ opacity: loadingMeta && !showExifModal ? 0.5 : 1 }}
            title={t('preview.viewExif')}
          >
            <Info size={18} />
          </button>
        )}
        {fileType === FileType.VIDEO && (
          <button 
            className="download-preview__exif-btn"
            onClick={() => setShowVideoInfoModal(true)}
            title={t('preview.viewVideoInfo')}
          >
            <Info size={18} />
          </button>
        )}
        {fileType === FileType.AUDIO && (
          <button 
            className="download-preview__exif-btn"
            onClick={() => setShowAudioInfoModal(true)}
            title={t('preview.viewAudioInfo')}
          >
            <Info size={18} />
          </button>
        )}
      </div>
      
      <div className="download-preview__info">
        <div className="download-preview__info-item">
          <HardDrive size={16} />
          <span>{formatSize(file.size)}</span>
        </div>
        {/* 分辨率 */}
        {metadata?.width && metadata?.height && (
          <div className="download-preview__info-item">
            <Maximize size={16} />
            <span>{metadata.width} × {metadata.height}</span>
          </div>
        )}
        <div className="download-preview__info-item">
          <Calendar size={16} />
          <span>{formatDate(file.modified)}</span>
        </div>
      </div>

      <div className="download-preview__actions">
        <button className="download-preview__btn download-preview__btn--primary" onClick={handleDownload}>
          <Download size={18} />
          <span>{t('filePreview.download')}</span>
        </button>
        {permissions?.allow_direct_link && (
          <button className="download-preview__btn" onClick={openDirectLinkDialog}>
            <Link2 size={18} />
            <span>{t('filePreview.copyLink')}</span>
          </button>
        )}
        {permissions?.allow_share && (
          <button className="download-preview__btn" onClick={handleShare}>
            <Share2 size={18} />
            <span>{t('filePreview.share')}</span>
          </button>
        )}
      </div>

      {/* EXIF 弹窗 - Apple Design 风格 */}
      {showExifModal && createPortal(
        <div className="exif-modal-apple" onClick={() => setShowExifModal(false)}>
          <div className="exif-modal-apple__content" onClick={e => e.stopPropagation()}>
            {/* 头部 */}
            <div className="exif-modal-apple__header">
              <div className="exif-modal-apple__handle" />
              <h3>{t('preview.photoInfo')}</h3>
              <button className="exif-modal-apple__close" onClick={() => setShowExifModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="exif-modal-apple__body">
              {loadingExifModal && (
                <div className="exif-modal-apple__loading">{t('preview.parsingExif')}</div>
              )}
              {!loadingExifModal && !exifModalHasSections && (
                <div className="exif-modal-apple__empty">{t('preview.noExif')}</div>
              )}
              {/* 基本信息卡片 */}
              {(metadata?.width && metadata?.height) || metadata?.exif?.dateTimeOriginal ? (
              <div className="exif-modal-apple__card">
                <div className="exif-modal-apple__grid">
                  {metadata?.width && metadata?.height && (
                    <div className="exif-modal-apple__item">
                      <div className="exif-modal-apple__item-icon">
                        <Maximize size={20} />
                      </div>
                      <div className="exif-modal-apple__item-content">
                        <span className="exif-modal-apple__item-label">{t('preview.resolution')}</span>
                        <span className="exif-modal-apple__item-value">{metadata.width} × {metadata.height}</span>
                      </div>
                    </div>
                  )}
                  {metadata?.exif?.dateTimeOriginal && (
                    <div className="exif-modal-apple__item">
                      <div className="exif-modal-apple__item-icon">
                        <Clock size={20} />
                      </div>
                      <div className="exif-modal-apple__item-content">
                        <span className="exif-modal-apple__item-label">{t('preview.shootTime')}</span>
                        <span className="exif-modal-apple__item-value">{metadata.exif.dateTimeOriginal}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              ) : null}

              {/* 设备信息卡片 */}
              {metadata?.exif && (metadata.exif.make || metadata.exif.model || metadata.exif.lensModel) && (
                <div className="exif-modal-apple__card">
                  <div className="exif-modal-apple__card-title">
                    <Camera size={16} />
                    <span>{t('preview.device')}</span>
                  </div>
                  <div className="exif-modal-apple__list">
                    {(metadata.exif.make || metadata.exif.model) && (
                      <div className="exif-modal-apple__list-item">
                        <span>{t('preview.camera')}</span>
                        <span>{[metadata.exif.make, metadata.exif.model].filter(Boolean).join(' ')}</span>
                      </div>
                    )}
                    {metadata.exif.lensModel && (
                      <div className="exif-modal-apple__list-item">
                        <span>{t('preview.lens')}</span>
                        <span>{metadata.exif.lensModel}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 拍摄参数卡片 */}
              {metadata?.exif && (metadata.exif.focalLength !== undefined || metadata.exif.fNumber !== undefined || metadata.exif.exposureTime !== undefined || metadata.exif.iso !== undefined) && (
                <div className="exif-modal-apple__card">
                  <div className="exif-modal-apple__card-title">
                    <Aperture size={16} />
                    <span>{t('preview.shootParams')}</span>
                  </div>
                  <div className="exif-modal-apple__params">
                    {metadata.exif.focalLength !== undefined && (
                      <div className="exif-modal-apple__param">
                        <span className="exif-modal-apple__param-value">{formatFocalLength(metadata.exif.focalLength)}</span>
                        <span className="exif-modal-apple__param-label">{t('preview.focalLength')}</span>
                      </div>
                    )}
                    {metadata.exif.fNumber !== undefined && (
                      <div className="exif-modal-apple__param">
                        <span className="exif-modal-apple__param-value">{formatFNumber(metadata.exif.fNumber)}</span>
                        <span className="exif-modal-apple__param-label">{t('preview.aperture')}</span>
                      </div>
                    )}
                    {metadata.exif.exposureTime !== undefined && (
                      <div className="exif-modal-apple__param">
                        <span className="exif-modal-apple__param-value">{formatExposureTime(metadata.exif.exposureTime)}</span>
                        <span className="exif-modal-apple__param-label">{t('preview.shutter')}</span>
                      </div>
                    )}
                    {metadata.exif.iso !== undefined && (
                      <div className="exif-modal-apple__param">
                        <span className="exif-modal-apple__param-value">ISO {metadata.exif.iso}</span>
                        <span className="exif-modal-apple__param-label">{t('preview.sensitivity')}</span>
                      </div>
                    )}
                  </div>
                  {(metadata.exif.exposureBias !== undefined || metadata.exif.flash !== undefined || metadata.exif.whiteBalance !== undefined) && (
                    <div className="exif-modal-apple__list" style={{ marginTop: '12px' }}>
                      {metadata.exif.exposureBias !== undefined && (
                        <div className="exif-modal-apple__list-item">
                          <span><Sun size={14} /> {t('preview.exposureComp')}</span>
                          <span>{typeof metadata.exif.exposureBias === 'number' ? `${metadata.exif.exposureBias > 0 ? '+' : ''}${Number(metadata.exif.exposureBias).toFixed(1)} EV` : '-'}</span>
                        </div>
                      )}
                      {metadata.exif.flash !== undefined && (
                        <div className="exif-modal-apple__list-item">
                          <span><Zap size={14} /> {t('preview.flash')}</span>
                          <span>{formatFlash(metadata.exif.flash)}</span>
                        </div>
                      )}
                      {metadata.exif.whiteBalance !== undefined && (
                        <div className="exif-modal-apple__list-item">
                          <span><Thermometer size={14} /> {t('preview.whiteBalance')}</span>
                          <span>{formatWhiteBalance(metadata.exif.whiteBalance)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 位置信息卡片 */}
              {metadata?.exif && metadata.exif.gpsLatitude !== undefined && metadata.exif.gpsLongitude !== undefined && (
                <div className="exif-modal-apple__card exif-modal-apple__card--location">
                  <div className="exif-modal-apple__card-title">
                    <MapPin size={16} />
                    <span>{t('preview.location')}</span>
                  </div>
                  <div className="exif-modal-apple__location">
                    {locationName && (
                      <div className="exif-modal-apple__location-name">
                        {locationName}
                      </div>
                    )}
                    <div className="exif-modal-apple__location-coords">
                      {metadata.exif.gpsLongitude.toFixed(6)}, {metadata.exif.gpsLatitude.toFixed(6)}
                    </div>
                    {metadata.exif.gpsAltitude !== undefined && (
                      <div className="exif-modal-apple__location-alt">
                        <Mountain size={14} />
                        <span>{t('preview.altitude')} {metadata.exif.gpsAltitude.toFixed(1)}m</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 视频信息弹窗 */}
      {showVideoInfoModal && (() => {
        const audioCheck = videoMeta ? isAudioCodecSupported(videoMeta.audioCodec) : { supported: true }
        const duration = metadata?.duration || 0
        const avgBitrate = duration > 0 ? Math.round((file.size * 8) / duration) : 0
        
        return createPortal(
          <div className="exif-modal-apple" onClick={() => setShowVideoInfoModal(false)}>
            <div className="exif-modal-apple__content" onClick={e => e.stopPropagation()}>
              <div className="exif-modal-apple__header">
                <div className="exif-modal-apple__handle" />
                <h3>{t('preview.videoInfo')}</h3>
                <button className="exif-modal-apple__close" onClick={() => setShowVideoInfoModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="exif-modal-apple__body">
                {/* 加载中 */}
                {loadingVideoMeta && (
                  <div className="exif-modal-apple__loading">{t('preview.parsingVideo')}</div>
                )}

                {/* 音频警告 */}
                {!audioCheck.supported && audioCheck.warning && (
                  <div className="exif-modal-apple__warning">
                    {audioCheck.warning}
                  </div>
                )}

                {/* 基本信息卡片 */}
                <div className="exif-modal-apple__card">
                  <div className="exif-modal-apple__card-title">
                    <Film size={16} />
                    <span>{t('preview.basicInfo')}</span>
                  </div>
                  <div className="exif-modal-apple__list">
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.fileName')}</span>
                      <span>{file.name}</span>
                    </div>
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.fileSize')}</span>
                      <span>{formatSize(file.size)}</span>
                    </div>
                    {(videoMeta?.width || metadata?.width) && (videoMeta?.height || metadata?.height) && (
                      <div className="exif-modal-apple__list-item">
                        <span>{t('preview.resolution')}</span>
                        <span>{videoMeta?.width || metadata?.width} × {videoMeta?.height || metadata?.height}</span>
                      </div>
                    )}
                    {metadata?.duration && (
                      <div className="exif-modal-apple__list-item">
                        <span>{t('preview.duration')}</span>
                        <span>{formatDuration(metadata.duration)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 编码信息卡片 */}
                <div className="exif-modal-apple__card">
                  <div className="exif-modal-apple__card-title">
                    <Code size={16} />
                    <span>{t('preview.codecInfo')}</span>
                  </div>
                  <div className="exif-modal-apple__list">
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.container')}</span>
                      <span>{videoMeta?.container || file.name.split('.').pop()?.toUpperCase() || '-'}</span>
                    </div>
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.videoCodec')}</span>
                      <span>{videoMeta?.videoCodec || '-'}</span>
                    </div>
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.audioCodec')}</span>
                      <span>{videoMeta?.audioCodec || '-'}</span>
                    </div>
                    {videoMeta?.audioChannels && (
                      <div className="exif-modal-apple__list-item">
                        <span>{t('preview.audioChannels')}</span>
                        <span>{formatChannels(videoMeta.audioChannels)}</span>
                      </div>
                    )}
                    {videoMeta?.audioSampleRate && (
                      <div className="exif-modal-apple__list-item">
                        <span>{t('preview.sampleRate')}</span>
                        <span>{(videoMeta.audioSampleRate / 1000).toFixed(1)} kHz</span>
                      </div>
                    )}
                    {metadata?.frameRate && (
                      <div className="exif-modal-apple__list-item">
                        <span>{t('preview.frameRate')}</span>
                        <span>{metadata.frameRate} fps</span>
                      </div>
                    )}
                    {avgBitrate > 0 && (
                      <div className="exif-modal-apple__list-item">
                        <span>{t('preview.avgBitrate')}</span>
                        <span>{formatBitrate(avgBitrate)}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>,
          document.body
        )
      })()}

      {/* 音频信息弹窗 - Apple Design 风格 */}
      {showAudioInfoModal && createPortal(
        <div className="exif-modal-apple" onClick={() => setShowAudioInfoModal(false)}>
          <div className="exif-modal-apple__content" onClick={e => e.stopPropagation()}>
            <div className="exif-modal-apple__header">
              <div className="exif-modal-apple__handle" />
              <h3>{t('preview.audioInfo')}</h3>
              <button className="exif-modal-apple__close" onClick={() => setShowAudioInfoModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="exif-modal-apple__body">
              {/* 加载中 */}
              {loadingAudioMeta && (
                <div className="exif-modal-apple__loading">{t('preview.parsingAudio')}</div>
              )}

              {/* 基本信息卡片 */}
              <div className="exif-modal-apple__card">
                <div className="exif-modal-apple__card-title">
                  <Music size={16} />
                  <span>{t('preview.basicInfo')}</span>
                </div>
                <div className="exif-modal-apple__list">
                  <div className="exif-modal-apple__list-item">
                    <span>{t('preview.fileName')}</span>
                    <span>{file.name}</span>
                  </div>
                  <div className="exif-modal-apple__list-item">
                    <span>{t('preview.fileSize')}</span>
                    <span>{formatSize(file.size)}</span>
                  </div>
                  {audioMeta?.title && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.title')}</span>
                      <span>{audioMeta.title}</span>
                    </div>
                  )}
                  {audioMeta?.artist && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.artist')}</span>
                      <span>{audioMeta.artist}</span>
                    </div>
                  )}
                  {audioMeta?.album && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.album')}</span>
                      <span>{audioMeta.album}</span>
                    </div>
                  )}
                  {audioMeta?.year && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.year')}</span>
                      <span>{audioMeta.year}</span>
                    </div>
                  )}
                  {audioMeta?.genre && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.genre')}</span>
                      <span>{audioMeta.genre}</span>
                    </div>
                  )}
                  {(metadata?.duration || audioMeta?.duration) && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.duration')}</span>
                      <span>{formatDuration(metadata?.duration || audioMeta?.duration || 0)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 技术参数卡片 */}
              <div className="exif-modal-apple__card">
                <div className="exif-modal-apple__card-title">
                  <Code size={16} />
                  <span>{t('preview.techParams')}</span>
                </div>
                <div className="exif-modal-apple__list">
                  {isEncryptedFile && audioMeta?.format && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.encryptedFormat')}</span>
                      <span>{audioMeta.format}</span>
                    </div>
                  )}
                  {!isEncryptedFile && audioMeta?.format && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.format')}</span>
                      <span>{audioMeta.format}</span>
                    </div>
                  )}
                  {audioMeta?.codec && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.codec')}</span>
                      <span>{audioMeta.codec}</span>
                    </div>
                  )}
                  {audioMeta?.sampleRate && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.sampleRate')}</span>
                      <span>{formatSampleRate(audioMeta.sampleRate)}</span>
                    </div>
                  )}
                  {audioMeta?.bitRate && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.bitrate')}</span>
                      <span>{audioMeta.bitRate} kbps</span>
                    </div>
                  )}
                  {audioMeta?.channels && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.channels')}</span>
                      <span>{audioMeta.channels === 1 ? t('preview.mono') : audioMeta.channels === 2 ? t('preview.stereo') : t('preview.channelCount', { count: audioMeta.channels })}</span>
                    </div>
                  )}
                  {audioMeta?.bitDepth && (
                    <div className="exif-modal-apple__list-item">
                      <span>{t('preview.bitDepth')}</span>
                      <span>{audioMeta.bitDepth} bit</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 直链弹窗 */}
      {directLinkDialog.visible && createPortal(
        <div className="file-browser__modal-overlay" onClick={() => setDirectLinkDialog({ visible: false, expiresAt: '', maxAccessCount: '' })}>
          <div className="file-browser__direct-link-dialog" onClick={e => e.stopPropagation()}>
            <div className="file-browser__direct-link-dialog-header">
              <h3>{t('fileBrowser.createDirectLink')}</h3>
              <button onClick={() => setDirectLinkDialog({ visible: false, expiresAt: '', maxAccessCount: '' })}>
                <X size={18} />
              </button>
            </div>
            <div className="file-browser__direct-link-dialog-body">
              <p className="file-browser__direct-link-dialog-filename">
                <Link2 size={16} />
                {file.name}
              </p>
              <div className="file-browser__direct-link-dialog-field">
                <label>{t('fileBrowser.expiresAt')}</label>
                <input
                  type="datetime-local"
                  value={directLinkDialog.expiresAt}
                  onChange={e => setDirectLinkDialog(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
                <span className="file-browser__direct-link-dialog-hint">{t('fileBrowser.expiresAtHint')}</span>
              </div>
              <div className="file-browser__direct-link-dialog-field">
                <label>{t('fileBrowser.maxAccessCount')}</label>
                <input
                  type="number"
                  min="1"
                  placeholder="∞"
                  value={directLinkDialog.maxAccessCount}
                  onChange={e => setDirectLinkDialog(prev => ({ ...prev, maxAccessCount: e.target.value }))}
                />
                <span className="file-browser__direct-link-dialog-hint">{t('fileBrowser.maxAccessCountHint')}</span>
              </div>
            </div>
            <div className="file-browser__direct-link-dialog-actions">
              <button 
                className="file-browser__direct-link-dialog-btn file-browser__direct-link-dialog-btn--cancel"
                onClick={() => setDirectLinkDialog({ visible: false, expiresAt: '', maxAccessCount: '' })}
              >
                {t('common.cancel')}
              </button>
              <button 
                className="file-browser__direct-link-dialog-btn file-browser__direct-link-dialog-btn--create"
                onClick={handleCreateDirectLink}
              >
                {t('fileBrowser.copyDirectLink')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 分享弹窗 */}
      {shareDialog.visible && createPortal(
        <div className="file-browser__modal-overlay" onClick={() => setShareDialog({ visible: false, expiresAt: '', maxAccessCount: '', password: '' })}>
          <div className="file-browser__direct-link-dialog" onClick={e => e.stopPropagation()}>
            <div className="file-browser__direct-link-dialog-header">
              <h3>{t('fileBrowser.createShare')}</h3>
              <button onClick={() => setShareDialog({ visible: false, expiresAt: '', maxAccessCount: '', password: '' })}>
                <X size={18} />
              </button>
            </div>
            <div className="file-browser__direct-link-dialog-body">
              <p className="file-browser__direct-link-dialog-filename">
                <Share2 size={16} />
                {file.name}
              </p>
              <div className="file-browser__direct-link-dialog-field">
                <label>{t('fileBrowser.sharePassword')}</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder={t('fileBrowser.sharePasswordPlaceholder')}
                  value={shareDialog.password}
                  onChange={e => setShareDialog(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="file-browser__direct-link-dialog-field">
                <label>{t('fileBrowser.expiresAt')}</label>
                <input
                  type="datetime-local"
                  value={shareDialog.expiresAt}
                  onChange={e => setShareDialog(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
                <span className="file-browser__direct-link-dialog-hint">{t('fileBrowser.expiresAtHint')}</span>
              </div>
              <div className="file-browser__direct-link-dialog-field">
                <label>{t('fileBrowser.maxAccessCount')}</label>
                <input
                  type="number"
                  min="1"
                  placeholder="∞"
                  value={shareDialog.maxAccessCount}
                  onChange={e => setShareDialog(prev => ({ ...prev, maxAccessCount: e.target.value }))}
                />
                <span className="file-browser__direct-link-dialog-hint">{t('fileBrowser.maxAccessCountHint')}</span>
              </div>
            </div>
            <div className="file-browser__direct-link-dialog-actions">
              <button 
                className="file-browser__direct-link-dialog-btn file-browser__direct-link-dialog-btn--cancel"
                onClick={() => setShareDialog({ visible: false, expiresAt: '', maxAccessCount: '', password: '' })}
              >
                {t('common.cancel')}
              </button>
              <button 
                className="file-browser__direct-link-dialog-btn file-browser__direct-link-dialog-btn--create"
                onClick={handleCreateShare}
              >
                {t('fileBrowser.createShareBtn')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
