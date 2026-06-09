import { describe, it, expect } from 'vitest'
import { toDrivePreviewUrl, isDriveUrl } from './driveEmbed'

describe('toDrivePreviewUrl', () => {
  it('ファイル共有URL → /preview', () => {
    expect(toDrivePreviewUrl('https://drive.google.com/file/d/ABC123_-x/view?usp=sharing'))
      .toBe('https://drive.google.com/file/d/ABC123_-x/preview')
  })
  it('open?id= → ファイル /preview', () => {
    expect(toDrivePreviewUrl('https://drive.google.com/open?id=ABC123'))
      .toBe('https://drive.google.com/file/d/ABC123/preview')
  })
  it('フォルダ → embeddedfolderview', () => {
    expect(toDrivePreviewUrl('https://drive.google.com/drive/folders/FOLDER1'))
      .toBe('https://drive.google.com/embeddedfolderview?id=FOLDER1#list')
  })
  it('Google ドキュメント → /preview', () => {
    expect(toDrivePreviewUrl('https://docs.google.com/document/d/DOC1/edit'))
      .toBe('https://docs.google.com/document/d/DOC1/preview')
  })
  it('スプレッドシート → /preview', () => {
    expect(toDrivePreviewUrl('https://docs.google.com/spreadsheets/d/SHEET1/edit#gid=0'))
      .toBe('https://docs.google.com/spreadsheets/d/SHEET1/preview')
  })
  it('既に /preview はそのまま', () => {
    const u = 'https://drive.google.com/file/d/X/preview'
    expect(toDrivePreviewUrl(u)).toBe(u)
  })
  it('Google 以外 / 不正は null', () => {
    expect(toDrivePreviewUrl('https://example.com/file/d/X/view')).toBeNull()
    expect(toDrivePreviewUrl('not a url')).toBeNull()
    expect(toDrivePreviewUrl('')).toBeNull()
  })
})

describe('isDriveUrl', () => {
  it('google.com 系を判定', () => {
    expect(isDriveUrl('https://drive.google.com/file/d/X/view')).toBe(true)
    expect(isDriveUrl('https://docs.google.com/document/d/X/edit')).toBe(true)
    expect(isDriveUrl('https://example.com/x')).toBe(false)
  })
})
