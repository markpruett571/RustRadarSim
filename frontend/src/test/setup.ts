import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Polyfill for URL and URLSearchParams in Node.js test environment
// This must be done before any imports that might use whatwg-url
if (typeof global.URL === 'undefined' || typeof global.URLSearchParams === 'undefined') {
  const { URL, URLSearchParams } = require('url')
  if (typeof global.URL === 'undefined') {
    global.URL = URL as any
  }
  if (typeof global.URLSearchParams === 'undefined') {
    global.URLSearchParams = URLSearchParams as any
  }
}

// Fix for whatwg-url compatibility issue
// Ensure that the global URL constructor is available before jsdom loads
if (typeof window !== 'undefined' && !window.URL) {
  const { URL, URLSearchParams } = require('url')
  ;(window as any).URL = URL
  ;(window as any).URLSearchParams = URLSearchParams
}

// Setup canvas for jsdom - only import canvas if needed
let createCanvas: any
try {
  createCanvas = require('canvas').createCanvas
} catch (e) {
  // Canvas not available, use a mock
  createCanvas = () => ({
    width: 600,
    height: 600,
    getContext: () => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      beginPath: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
    }),
  })
}

// Setup canvas for jsdom
if (typeof global.HTMLCanvasElement === 'undefined') {
  // @ts-ignore
  global.HTMLCanvasElement.prototype.getContext = function (contextType: string) {
    if (contextType === '2d') {
      const canvas = createCanvas(this.width || 600, this.height || 600)
      return canvas.getContext('2d')
    }
    return null
  }
}

// Cleanup after each test
afterEach(() => {
  cleanup()
})

